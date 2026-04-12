import hmac
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from core.audit import record_operator_action
from core.config import (
    ALLOW_SIGNUP,
    AUTH_COOKIE_MAX_AGE_SECONDS,
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_SAMESITE,
    AUTH_COOKIE_SECURE,
    AUTH_RATE_LIMIT_MAX_ATTEMPTS,
    AUTH_RATE_LIMIT_WINDOW_SECONDS,
    GOOGLE_CLIENT_ID,
)
from core.database import db
from core.mfa import (
    disable_mfa_for_user,
    get_user_mfa_status,
    is_mfa_required,
    setup_mfa_for_user,
    verify_user_mfa,
)
from core.request_security import enforce_rate_limit, extract_client_ip
from core.security import create_token, hash_password, stable_hash, verify_and_upgrade_password
from core.time_utils import iso_now
from dependencies import current_user
from schemas import GoogleRequest, LoginRequest, SignupRequest


router = APIRouter()
AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS = max(AUTH_RATE_LIMIT_MAX_ATTEMPTS * 4, AUTH_RATE_LIMIT_MAX_ATTEMPTS + 4)


def _apply_auth_rate_limit(request: Request, *, action: str, identifier: str) -> None:
    client_ip = extract_client_ip(request)
    normalized_identifier = stable_hash((identifier or "").strip().lower() or "anonymous", 24)
    enforce_rate_limit(f"auth-ip:{action}:{client_ip}", AUTH_IP_RATE_LIMIT_MAX_ATTEMPTS, AUTH_RATE_LIMIT_WINDOW_SECONDS)
    enforce_rate_limit(f"auth-id:{action}:{normalized_identifier}", AUTH_RATE_LIMIT_MAX_ATTEMPTS, AUTH_RATE_LIMIT_WINDOW_SECONDS)


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        max_age=AUTH_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
        path="/",
    )


def _verify_google_credential(credential: str) -> dict[str, Any]:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google login is not configured on server.")
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import id_token
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Google login dependencies are not installed on server.") from exc

    try:
        claims = id_token.verify_oauth2_token(credential, Request(), GOOGLE_CLIENT_ID)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Google credential.") from exc

    issuer = str(claims.get("iss") or "")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google credential.")
    if not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    email = str(claims.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google account email is unavailable.")
    return claims


@router.get("/auth/providers")
def auth_providers() -> dict[str, Any]:
    return {
        "signup": {
            "enabled": bool(ALLOW_SIGNUP),
        },
        "providers": {
            "google": {
                "enabled": bool(GOOGLE_CLIENT_ID),
                "client_id": GOOGLE_CLIENT_ID,
            }
        }
    }


@router.post("/auth/signup")
def signup(payload: SignupRequest, request: Request) -> dict[str, Any]:
    if not ALLOW_SIGNUP:
        raise HTTPException(status_code=403, detail="Signup is disabled for this deployment.")
    username = payload.username.strip()
    email = payload.email.strip().lower()
    _apply_auth_rate_limit(request, action="signup", identifier=f"{username}|{email}")
    if len(username) < 3 or len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Username or password does not meet minimum requirements.")
    with db() as conn:
        exists = conn.execute("select id from users where username = ? or email = ?", (username, email)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="User already exists.")
        conn.execute(
            "insert into users (username, email, password_hash, role, created_at) values (?, ?, ?, ?, ?)",
            (username, email, hash_password(payload.password), "owner", iso_now()),
        )
    return {"status": "created"}


@router.post("/auth/login")
def login(payload: LoginRequest, request: Request, response: Response) -> dict[str, Any]:
    identifier = payload.username.strip()
    _apply_auth_rate_limit(request, action="login", identifier=identifier)
    with db() as conn:
        row = conn.execute(
            "select * from users where username = ? or email = ?",
            (identifier, identifier.lower()),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Authentication failed. Check credentials.")
        verified, upgraded_hash = verify_and_upgrade_password(payload.password, row["password_hash"])
        if not verified:
            raise HTTPException(status_code=401, detail="Authentication failed. Check credentials.")
        if upgraded_hash and not hmac.compare_digest(upgraded_hash, row["password_hash"]):
            conn.execute("update users set password_hash = ? where id = ?", (upgraded_hash, row["id"]))
            row = conn.execute("select * from users where id = ?", (row["id"],)).fetchone()
        user = dict(row)
    
    # Check if MFA is required
    user_id = int(user["id"])
    if is_mfa_required(user_id):
        # Verify MFA code if provided
        if not payload.mfa_code:
            raise HTTPException(
                status_code=403,
                detail="MFA code required. Please provide your authenticator code."
            )
        if not verify_user_mfa(user_id, payload.mfa_code):
            raise HTTPException(
                status_code=403,
                detail="Invalid MFA code. Please try again."
            )
    
    token = create_token(user)
    _set_auth_cookie(response, token)
    return {
        "token": token,
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "mfa_required": is_mfa_required(user_id),
    }


@router.post("/auth/google")
def auth_google(payload: GoogleRequest, request: Request, response: Response) -> dict[str, Any]:
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(status_code=400, detail="Invalid Google credential.")
    _apply_auth_rate_limit(request, action="google", identifier=credential)
    claims = _verify_google_credential(credential)
    email = str(claims["email"]).strip().lower()
    username = f"google_{stable_hash(str(claims.get('sub') or email), 12)}"
    with db() as conn:
        row = conn.execute("select * from users where email = ? or username = ?", (email, username)).fetchone()
        new_user = False
        if not row:
            if not ALLOW_SIGNUP:
                raise HTTPException(status_code=403, detail="Signup is disabled for this deployment.")
            conn.execute(
                "insert into users (username, email, password_hash, role, created_at) values (?, ?, ?, ?, ?)",
                (username, email, hash_password(secrets.token_urlsafe(16)), "owner", iso_now()),
            )
            row = conn.execute("select * from users where username = ?", (username,)).fetchone()
            new_user = True
        user = dict(row)
    token = create_token(user)
    _set_auth_cookie(response, token)
    return {
        "token": token,
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "new_user": new_user,
    }


@router.post("/auth/biometric-login")
def biometric_login(request: Request) -> dict[str, Any]:
    _apply_auth_rate_limit(request, action="biometric", identifier=extract_client_ip(request))
    raise HTTPException(status_code=503, detail="Biometric login is not configured on server.")


@router.get("/auth/mfa/status")
def mfa_status(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Get MFA status for current user"""
    return get_user_mfa_status(int(user["id"]))


@router.post("/auth/mfa/setup")
def mfa_setup(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Setup MFA for current user - returns secret and QR code"""
    try:
        username = str(user.get("username") or "user")
        result = setup_mfa_for_user(int(user["id"]), username)
        
        with db() as conn:
            record_operator_action(
                conn,
                user_id=int(user["id"]),
                actor_username=username,
                action="mfa.setup",
                summary="MFA setup initiated",
                severity="medium",
                target_type="user",
                target_id=int(user["id"]),
            )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to setup MFA: {str(e)}")


@router.post("/auth/mfa/enable")
def mfa_enable(code: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Enable MFA after verifying code"""
    if not verify_user_mfa(int(user["id"]), code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")
    
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="mfa.enable",
            summary="MFA enabled for account",
            severity="high",
            target_type="user",
            target_id=int(user["id"]),
        )
    
    return {"status": "enabled"}


@router.post("/auth/mfa/disable")
def mfa_disable(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Disable MFA for current user"""
    if not disable_mfa_for_user(int(user["id"])):
        raise HTTPException(status_code=500, detail="Failed to disable MFA")
    
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="mfa.disable",
            summary="MFA disabled for account",
            severity="high",
            target_type="user",
            target_id=int(user["id"]),
        )
    
    return {"status": "disabled"}


@router.post("/auth/logout")
def logout(response: Response, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="auth.logout",
            summary="Revoked current operator session",
            severity="low",
            target_type="session",
            metadata={"token_version": int(user.get("token_version") or 0) + 1},
        )
        conn.execute(
            "update users set token_version = coalesce(token_version, 0) + 1 where id = ?",
            (int(user["id"]),),
        )
    _clear_auth_cookie(response)
    return {"status": "logged_out"}


@router.get("/auth/me")
def auth_me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
    }

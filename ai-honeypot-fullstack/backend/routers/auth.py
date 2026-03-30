import hmac
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from core.config import ALLOW_SIGNUP, AUTH_RATE_LIMIT_MAX_ATTEMPTS, AUTH_RATE_LIMIT_WINDOW_SECONDS, GOOGLE_CLIENT_ID
from core.database import db
from core.request_security import build_rate_limit_dependency
from core.security import create_token, hash_password, stable_hash, verify_and_upgrade_password
from core.time_utils import iso_now
from dependencies import current_user
from schemas import GoogleRequest, LoginRequest, SignupRequest


router = APIRouter()
auth_rate_limit = build_rate_limit_dependency("auth", AUTH_RATE_LIMIT_MAX_ATTEMPTS, AUTH_RATE_LIMIT_WINDOW_SECONDS)


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
def signup(payload: SignupRequest, _: None = Depends(auth_rate_limit)) -> dict[str, Any]:
    if not ALLOW_SIGNUP:
        raise HTTPException(status_code=403, detail="Signup is disabled for this deployment.")
    username = payload.username.strip()
    email = payload.email.strip().lower()
    if len(username) < 3 or len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Username or password does not meet minimum requirements.")
    with db() as conn:
        exists = conn.execute("select id from users where username = ? or email = ?", (username, email)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="User already exists.")
        conn.execute(
            "insert into users (username, email, password_hash, role, created_at) values (?, ?, ?, ?, ?)",
            (username, email, hash_password(payload.password), "admin", iso_now()),
        )
    return {"status": "created"}


@router.post("/auth/login")
def login(payload: LoginRequest, _: None = Depends(auth_rate_limit)) -> dict[str, Any]:
    identifier = payload.username.strip()
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
    token = create_token(user)
    return {
        "token": token,
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
    }


@router.post("/auth/google")
def auth_google(payload: GoogleRequest, _: None = Depends(auth_rate_limit)) -> dict[str, Any]:
    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(status_code=400, detail="Invalid Google credential.")
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
                (username, email, hash_password(secrets.token_urlsafe(16)), "admin", iso_now()),
            )
            row = conn.execute("select * from users where username = ?", (username,)).fetchone()
            new_user = True
        user = dict(row)
    return {
        "token": create_token(user),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "new_user": new_user,
    }


@router.post("/auth/biometric-login")
def biometric_login(_: None = Depends(auth_rate_limit)) -> dict[str, Any]:
    raise HTTPException(status_code=503, detail="Biometric login is not configured on server.")


@router.get("/auth/me")
def auth_me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
    }

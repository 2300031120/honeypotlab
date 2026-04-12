import asyncio
from typing import Any

from fastapi import (
    Cookie,
    Depends,
    Header,
    HTTPException,
    Request,
    WebSocket,
    WebSocketException,
    status,
)

from core.config import AUTH_COOKIE_NAME, CSRF_TRUSTED_ORIGINS
from core.csrf import get_csrf_token_from_request, validate_csrf_token
from core.database import fetch_user_by_id
from core.request_security import (
    enforce_trusted_origin,
    enforce_trusted_request_origin,
    resolve_request_origin,
)
from core.security import decode_token, parse_bearer_token


def _assert_active_session(payload: dict[str, Any], user: dict[str, Any]) -> None:
    token_version = int(payload.get("token_version", 0))
    user_token_version = int(user.get("token_version") or 0)
    if token_version != user_token_version:
        raise HTTPException(
            status_code=401, detail="Session has been revoked. Please sign in again."
        )


def _resolve_auth_token(authorization: str | None, auth_cookie: str | None) -> str:
    if authorization:
        return parse_bearer_token(authorization)
    if auth_cookie:
        return str(auth_cookie).strip()
    raise HTTPException(status_code=401, detail="Missing authorization header.")


def _enforce_cookie_session_origin(request: Request, *, using_cookie: bool) -> None:
    if not using_cookie:
        return
    enforce_trusted_request_origin(
        method=request.method,
        origin=request.headers.get("origin"),
        referer=request.headers.get("referer"),
        allowed_origins=set(CSRF_TRUSTED_ORIGINS),
        detail="Cross-site session request blocked.",
    )


def current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    auth_cookie: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> dict[str, Any]:
    using_cookie = not authorization and bool(auth_cookie)
    _enforce_cookie_session_origin(request, using_cookie=using_cookie)
    token = _resolve_auth_token(authorization, auth_cookie)
    payload = decode_token(token)
    user = fetch_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    _assert_active_session(payload, user)
    return user


def optional_user(
    request: Request,
    authorization: str | None = Header(default=None),
    auth_cookie: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> dict[str, Any] | None:
    if not authorization and not auth_cookie:
        return None
    try:
        return current_user(request, authorization, auth_cookie)
    except HTTPException:
        return None


def require_roles(*allowed_roles: str):
    normalized_roles = {
        str(role or "").strip().lower()
        for role in allowed_roles
        if str(role or "").strip()
    }
    if not normalized_roles:
        raise ValueError("At least one allowed role must be provided.")

    def dependency(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        role = str(user.get("role") or "").strip().lower()
        if role not in normalized_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions.")
        return user

    return dependency


current_admin_user = require_roles("admin", "owner")


async def current_websocket_user(websocket: WebSocket) -> dict[str, Any]:
    token = str(websocket.cookies.get(AUTH_COOKIE_NAME) or "").strip()
    request_origin = resolve_request_origin(
        websocket.headers.get("origin"), websocket.headers.get("referer")
    )
    using_cookie = bool(token) and bool(request_origin)
    if using_cookie:
        try:
            enforce_trusted_origin(
                origin=websocket.headers.get("origin"),
                referer=websocket.headers.get("referer"),
                allowed_origins=set(CSRF_TRUSTED_ORIGINS),
                detail="Cross-site WebSocket session blocked.",
            )
        except HTTPException as exc:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION, reason=exc.detail
            ) from exc
    elif token:
        token = ""
    if not token:
        try:
            auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        except asyncio.TimeoutError as exc:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="WebSocket authentication timed out.",
            ) from exc
        except Exception as exc:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="WebSocket authentication failed.",
            ) from exc

        if (
            not isinstance(auth_message, dict)
            or str(auth_message.get("type") or "").strip().lower() != "auth"
        ):
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required."
            )

        token = str(auth_message.get("token") or "").strip()
        if not token:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required."
            )
    try:
        payload = decode_token(token)
    except HTTPException as exc:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION, reason=exc.detail
        ) from exc
    user = fetch_user_by_id(int(payload["sub"]))
    if not user:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION, reason="User not found."
        )
    try:
        _assert_active_session(payload, user)
    except HTTPException as exc:
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION, reason=exc.detail
        ) from exc
    return user


def require_csrf(request: Request, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    """Dependency that validates CSRF token for state-changing requests"""
    # Get session ID from user (using user ID as session identifier)
    session_id = str(user.get("id") or "")
    
    # Get CSRF token from request
    token = get_csrf_token_from_request(request)
    
    if not token:
        raise HTTPException(
            status_code=403,
            detail="CSRF token missing. Include X-CSRF-Token header or csrf_token in request body."
        )
    
    # Validate CSRF token
    if not validate_csrf_token(token, session_id):
        raise HTTPException(
            status_code=403,
            detail="Invalid or expired CSRF token. Please refresh the page and try again."
        )
    
    return user


def require_csrf_optional(request: Request) -> None:
    """Optional CSRF validation - validates token if present but doesn't require it"""
    # For public endpoints that may have CSRF protection but don't require it
    token = get_csrf_token_from_request(request)
    if token:
        # If token is provided, validate it (using empty session ID for public requests)
        if not validate_csrf_token(token, ""):
            raise HTTPException(
                status_code=403,
                detail="Invalid CSRF token provided."
            )

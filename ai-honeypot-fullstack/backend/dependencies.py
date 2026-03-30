from typing import Any

from fastapi import Depends, Header, HTTPException, WebSocket, WebSocketException, status

from core.database import fetch_user_by_id
from core.security import decode_token, parse_bearer_token


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = parse_bearer_token(authorization)
    payload = decode_token(token)
    user = fetch_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def optional_user(authorization: str | None = Header(default=None)) -> dict[str, Any] | None:
    if not authorization:
        return None
    try:
        return current_user(authorization)
    except HTTPException:
        return None


def require_roles(*allowed_roles: str):
    normalized_roles = {str(role or "").strip().lower() for role in allowed_roles if str(role or "").strip()}
    if not normalized_roles:
        raise ValueError("At least one allowed role must be provided.")

    def dependency(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        role = str(user.get("role") or "").strip().lower()
        if role not in normalized_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions.")
        return user

    return dependency


current_admin_user = require_roles("admin")


def current_websocket_user(websocket: WebSocket) -> dict[str, Any]:
    token = websocket.query_params.get("token")
    if not token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Authentication required.")
    try:
        payload = decode_token(token)
    except HTTPException as exc:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=exc.detail) from exc
    user = fetch_user_by_id(int(payload["sub"]))
    if not user:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="User not found.")
    return user

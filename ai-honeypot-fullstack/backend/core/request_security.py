from __future__ import annotations

from collections import defaultdict, deque
from math import ceil
from threading import Lock
from time import monotonic
from typing import Callable

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_RATE_LOCK = Lock()


def extract_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip", "").strip()
    if forwarded_for:
        return forwarded_for
    if real_ip:
        return real_ip
    if request.client and request.client.host:
        return str(request.client.host)
    return "unknown"


def reset_rate_limits() -> None:
    with _RATE_LOCK:
        _RATE_BUCKETS.clear()


def _hit_bucket(bucket_key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    now = monotonic()
    cutoff = now - float(window_seconds)
    with _RATE_LOCK:
        bucket = _RATE_BUCKETS[bucket_key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, ceil(window_seconds - (now - bucket[0])))
            return False, retry_after
        bucket.append(now)
        return True, 0


def build_rate_limit_dependency(
    scope: str,
    limit: int,
    window_seconds: int,
    key_builder: Callable[[Request], str] | None = None,
) -> Callable[[Request], None]:
    def dependency(request: Request) -> None:
        client_ip = extract_client_ip(request)
        key_part = key_builder(request) if key_builder else request.url.path
        allowed, retry_after = _hit_bucket(f"{scope}:{client_ip}:{key_part}", limit=limit, window_seconds=window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please retry shortly.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app,
        *,
        hsts_seconds: int = 0,
        content_security_policy: str = "",
    ) -> None:
        super().__init__(app)
        self.hsts_seconds = max(0, int(hsts_seconds))
        self.content_security_policy = str(content_security_policy or "").strip()

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

        forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
        is_https = request.url.scheme == "https" or forwarded_proto == "https"
        if self.hsts_seconds > 0 and is_https:
            response.headers.setdefault("Strict-Transport-Security", f"max-age={self.hsts_seconds}; includeSubDomains")
        if self.content_security_policy:
            response.headers.setdefault("Content-Security-Policy", self.content_security_policy)
        return response

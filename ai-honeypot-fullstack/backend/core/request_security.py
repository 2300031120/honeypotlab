from __future__ import annotations

from collections import defaultdict, deque
import ipaddress
from math import ceil
from threading import Lock
from time import monotonic
from typing import Callable
from urllib.parse import urlparse

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# Enhanced Security Headers - WEB SECURITY FIX
ENHANCED_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
}


def get_csp_header() -> str:
    """Content Security Policy header for XSS protection"""
    return (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://accounts.google.com https://apis.google.com; "
        "frame-src 'self' https://accounts.google.com; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "base-uri 'self'; "
        "upgrade-insecure-requests;"
    )


_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_RATE_LOCK = Lock()
SAFE_HTTP_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
TRUSTED_PROXY_LABELS = {"localhost", "127.0.0.1", "::1", "testclient"}


def _is_trusted_proxy_source(host: str) -> bool:
    normalized = str(host or "").strip().lower()
    if not normalized:
        return False
    if normalized in TRUSTED_PROXY_LABELS:
        return True
    try:
        parsed = ipaddress.ip_address(normalized)
    except ValueError:
        return False
    return parsed.is_loopback or parsed.is_private or parsed.is_link_local


def extract_client_ip(request: Request) -> str:
    source_host = str(request.client.host) if request.client and request.client.host else ""
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip", "").strip()
    if _is_trusted_proxy_source(source_host):
        if forwarded_for:
            return forwarded_for
        if real_ip:
            return real_ip
    if source_host:
        return source_host
    return "unknown"


def reset_rate_limits() -> None:
    with _RATE_LOCK:
        _RATE_BUCKETS.clear()


def normalize_origin(candidate: str | None) -> str:
    parsed = urlparse(str(candidate or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}".lower()


def resolve_request_origin(origin: str | None, referer: str | None) -> str:
    normalized_origin = normalize_origin(origin)
    if normalized_origin:
        return normalized_origin
    return normalize_origin(referer)


def enforce_trusted_origin(
    *,
    origin: str | None,
    referer: str | None,
    allowed_origins: set[str],
    detail: str = "Cross-site request blocked.",
) -> None:
    request_origin = resolve_request_origin(origin, referer)
    if request_origin and request_origin in allowed_origins:
        return
    raise HTTPException(status_code=403, detail=detail)


def enforce_trusted_request_origin(
    *,
    method: str,
    origin: str | None,
    referer: str | None,
    allowed_origins: set[str],
    detail: str = "Cross-site request blocked.",
) -> None:
    if str(method or "").upper() in SAFE_HTTP_METHODS:
        return
    enforce_trusted_origin(origin=origin, referer=referer, allowed_origins=allowed_origins, detail=detail)


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


def enforce_rate_limit(bucket_key: str, limit: int, window_seconds: int) -> None:
    allowed, retry_after = _hit_bucket(bucket_key, limit=limit, window_seconds=window_seconds)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please retry shortly.",
            headers={"Retry-After": str(retry_after)},
        )


def build_rate_limit_dependency(
    scope: str,
    limit: int,
    window_seconds: int,
    key_builder: Callable[[Request], str] | None = None,
) -> Callable[[Request], None]:
    def dependency(request: Request) -> None:
        client_ip = extract_client_ip(request)
        key_part = key_builder(request) if key_builder else request.url.path
        enforce_rate_limit(f"{scope}:{client_ip}:{key_part}", limit=limit, window_seconds=window_seconds)

    return dependency


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enhanced security headers middleware with XSS and clickjacking protection"""
    
    def __init__(
        self,
        app,
        *,
        hsts_seconds: int = 0,
        content_security_policy: str = "",
    ) -> None:
        super().__init__(app)
        self.hsts_seconds = max(0, int(hsts_seconds))
        # Use provided CSP or default enhanced CSP - WEB SECURITY FIX
        self.content_security_policy = str(content_security_policy or get_csp_header()).strip()

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        
        # Remove server header to hide version information
        if "Server" in response.headers:
            del response.headers["Server"]
        if "X-Powered-By" in response.headers:
            del response.headers["X-Powered-By"]
        
        # Enhanced security headers - WEB SECURITY FIX
        response.headers.setdefault("X-Frame-Options", "DENY")  # Prevent clickjacking
        response.headers.setdefault("X-Content-Type-Options", "nosniff")  # Prevent MIME sniffing
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")  # XSS filter
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")  # Referrer policy
        response.headers.setdefault(
            "Permissions-Policy", 
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
        )  # Feature policy
        
        # Additional headers to hide version information
        response.headers.setdefault("X-Server", "Unknown")  # Generic server header
        response.headers.setdefault("X-Application-Version", "Unknown")  # Hide version

        # HSTS for HTTPS
        forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
        is_https = request.url.scheme == "https" or forwarded_proto == "https"
        if self.hsts_seconds > 0 and is_https:
            response.headers.setdefault(
                "Strict-Transport-Security", 
                f"max-age={self.hsts_seconds}; includeSubDomains"
            )
        
        # Always set CSP for XSS protection - WEB SECURITY FIX
        response.headers.setdefault("Content-Security-Policy", self.content_security_policy)
        
        return response

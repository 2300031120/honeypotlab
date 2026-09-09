from contextlib import asynccontextmanager
from typing import Any
import time
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from middleware.ai_protection import AIProtectionMiddleware
from middleware.request_fingerprinting import RequestFingerprintingMiddleware
from middleware.ip_whitelist import IPWhitelistMiddleware
from middleware.response_obfuscation import ResponseObfuscationMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse

from core.config import (
    APP_ENV,
    APP_TITLE,
    ADMIN_WHITELIST_IPS,
    CORS_ORIGINS,
    RESPONSE_OBFUSCATION_ENABLED,
    FORCE_HTTPS_REDIRECT,
    JSON_LOGS,
    LOG_LEVEL,
    LOG_REQUESTS,
    SENTRY_DSN,
    SENTRY_ENVIRONMENT,
    SENTRY_TRACES_SAMPLE_RATE,
    SECURITY_CONTENT_SECURITY_POLICY,
    SECURITY_HEADERS_ENABLED,
    SECURITY_HSTS_SECONDS,
    TRUSTED_HOSTS,
    validate_runtime_config,
)
from core.database import build_summary, db_read, seed_database, check_database_health, check_redis_health
from core.observability import RequestIdMiddleware, configure_logging, init_sentry
from core.request_logging import log_request
from core.request_security import SecurityHeadersMiddleware
from core.time_utils import utc_now
from core.metrics import metrics_collector
from routers.auth import router as auth_router
from routers.leads import router as leads_router
from routers.sites import router as sites_router
from routers.telemetry import router as telemetry_router
from routers.consent import router as consent_router
from routers.ai import router as ai_router
from routers.decoy import router as decoy_router


APP_STARTED_AT = utc_now()
configure_logging(level=LOG_LEVEL, json_logs=JSON_LOGS)
logger = logging.getLogger(__name__)

# Rate limiting for public endpoints
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_runtime_config()
    init_sentry(dsn=SENTRY_DSN, environment=SENTRY_ENVIRONMENT, traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE)
    seed_database()
    yield


app = FastAPI(
    title=APP_TITLE,
    version="2.0.0",
    description="CyberSentil AI-Enhanced Honeypot & Deception System",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )
app.add_middleware(RequestIdMiddleware, log_requests=LOG_REQUESTS)


class RequestLoggingMiddleware:
    """Middleware to log all API requests for security monitoring"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Create request object for logging
        from starlette.requests import Request
        request = Request(scope, receive)
        
        # Record start time
        start_time = time.time()
        
        # Store original send to capture response
        status_code = 500
        
        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)
        
        # Process request
        try:
            await self.app(scope, receive, send_wrapper)
        except ValueError as e:
            # Log validation errors
            response_time = (time.time() - start_time) * 1000
            try:
                user_id = getattr(request.state, "user_id", None)
                log_request(
                    request=request,
                    response_status=status_code,
                    response_time_ms=response_time,
                    user_id=user_id,
                    error_message=f"Validation error: {str(e)}"
                )
            except Exception:
                pass
            raise
        except (ConnectionError, TimeoutError) as e:
            # Log network errors
            response_time = (time.time() - start_time) * 1000
            try:
                user_id = getattr(request.state, "user_id", None)
                log_request(
                    request=request,
                    response_status=status_code,
                    response_time_ms=response_time,
                    user_id=user_id,
                    error_message=f"Network error: {str(e)}"
                )
            except Exception:
                pass
            raise
        except Exception as e:
            # Log unexpected errors
            response_time = (time.time() - start_time) * 1000
            try:
                user_id = getattr(request.state, "user_id", None)
                log_request(
                    request=request,
                    response_status=status_code,
                    response_time_ms=response_time,
                    user_id=user_id,
                    error_message=f"Unexpected error: {str(e)}"
                )
            except Exception:
                pass
            raise
        else:
            # Log successful requests
            response_time = (time.time() - start_time) * 1000
            try:
                user_id = getattr(request.state, "user_id", None)
                # Skip logging health checks and static assets
                path = request.url.path
                if not (path == "/health" or path.startswith("/static") or path.endswith(".css") or path.endswith(".js")):
                    log_request(
                        request=request,
                        response_status=status_code,
                        response_time_ms=response_time,
                        user_id=user_id
                    )
            except:
                pass
# Security: Don't default to wildcard in production
if not CORS_ORIGINS and APP_ENV == "production":
    raise RuntimeError("CORS_ORIGINS must be explicitly set in production environment")
resolved_cors_origins = CORS_ORIGINS or ["*"]
allow_all_cors_origins = "*" in resolved_cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all_cors_origins else resolved_cors_origins,
    # Browsers reject Access-Control-Allow-Credentials=true with wildcard origins.
    allow_credentials=not allow_all_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
if TRUSTED_HOSTS and APP_ENV == "production":
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=TRUSTED_HOSTS)
if FORCE_HTTPS_REDIRECT:
    app.add_middleware(HTTPSRedirectMiddleware)
if SECURITY_HEADERS_ENABLED:
    app.add_middleware(
        SecurityHeadersMiddleware,
        hsts_seconds=SECURITY_HSTS_SECONDS,
        content_security_policy=SECURITY_CONTENT_SECURITY_POLICY,
    )
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(AIProtectionMiddleware)
app.add_middleware(RequestFingerprintingMiddleware, enable_blocking=False)
app.add_middleware(IPWhitelistMiddleware, whitelist_ips=ADMIN_WHITELIST_IPS, admin_paths=["/admin", "/api/admin"])
app.add_middleware(ResponseObfuscationMiddleware, enable_obfuscation=RESPONSE_OBFUSCATION_ENABLED)


@app.get("/health")
@limiter.limit("60/minute")
def health(request: Request) -> dict[str, Any]:
    with db_read() as conn:
        summary = build_summary(conn)["summary"]
    now = utc_now()
    uptime_seconds = int((now - APP_STARTED_AT).total_seconds()) if APP_STARTED_AT else 0
    return {
        "status": "healthy",
        "service": APP_TITLE,
        "time": now.isoformat(),
        "uptime_seconds": uptime_seconds,
        "services": {
            "backend": "operational",
            "database": "operational",
        },
        "metrics": {
            "active_sessions": summary["live_sessions"],
            "total_events": summary["total"],
            "critical_events": summary["critical"],
            "unique_ips": summary["unique_ips"],
            "blocked_ips": summary["blocked"],
        },
        "summary": summary,
    }


@app.get("/health/detailed")
@limiter.limit("30/minute")
def health_detailed(request: Request) -> JSONResponse:
    """Dependency-aware health probe for load balancers and ops monitors."""
    db_health = check_database_health()
    redis_health = check_redis_health()

    now = utc_now()
    uptime_seconds = int((now - APP_STARTED_AT).total_seconds()) if APP_STARTED_AT else 0

    critical_ok = bool(db_health.get("healthy"))
    # Redis is optional: only degrade when it is configured but unreachable.
    redis_ok = (not redis_health.get("configured")) or bool(redis_health.get("healthy"))
    overall_status = "healthy" if critical_ok and redis_ok else "degraded"
    status_code = 200 if overall_status == "healthy" else 503

    payload = {
        "status": overall_status,
        "service": APP_TITLE,
        "time": now.isoformat(),
        "uptime_seconds": uptime_seconds,
        "environment": APP_ENV,
        "dependencies": {
            "database": db_health,
            "redis": redis_health,
        },
        "services": {
            "backend": "operational" if critical_ok else "degraded",
        },
    }
    return JSONResponse(content=payload, status_code=status_code)


API_V1_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_V1_PREFIX, tags=["v1-auth"])
app.include_router(sites_router, prefix=API_V1_PREFIX, tags=["v1-sites"])
app.include_router(telemetry_router, prefix=API_V1_PREFIX, tags=["v1-telemetry"])
app.include_router(leads_router, prefix=API_V1_PREFIX, tags=["v1-leads"])
app.include_router(consent_router, prefix=API_V1_PREFIX, tags=["v1-consent"])
app.include_router(ai_router, prefix=API_V1_PREFIX, tags=["v1-ai"])
app.include_router(decoy_router, prefix=API_V1_PREFIX, tags=["v1-decoy"])


@app.get("/metrics")
def metrics():
    """Prometheus-compatible metrics endpoint"""
    from starlette.responses import PlainTextResponse
    return PlainTextResponse(
        content=metrics_collector.export_metrics(),
        media_type="text/plain; charset=utf-8",
    )


@app.get("/metrics/json")
def metrics_json():
    """Metrics endpoint in JSON format"""
    return metrics_collector.export_json()

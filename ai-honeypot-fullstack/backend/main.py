from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from core.config import (
    APP_TITLE,
    CORS_ORIGINS,
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
from core.database import build_summary, db, seed_database
from core.observability import RequestIdMiddleware, configure_logging, init_sentry
from core.request_security import SecurityHeadersMiddleware
from core.time_utils import utc_now
from routers.auth import router as auth_router
from routers.leads import router as leads_router
from routers.sites import router as sites_router
from routers.telemetry import router as telemetry_router


APP_STARTED_AT = utc_now()
configure_logging(level=LOG_LEVEL, json_logs=JSON_LOGS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_runtime_config()
    init_sentry(dsn=SENTRY_DSN, environment=SENTRY_ENVIRONMENT, traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE)
    seed_database()
    yield


app = FastAPI(title=APP_TITLE, lifespan=lifespan)
app.add_middleware(RequestIdMiddleware, log_requests=LOG_REQUESTS)
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
if TRUSTED_HOSTS:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=TRUSTED_HOSTS)
if FORCE_HTTPS_REDIRECT:
    app.add_middleware(HTTPSRedirectMiddleware)
if SECURITY_HEADERS_ENABLED:
    app.add_middleware(
        SecurityHeadersMiddleware,
        hsts_seconds=SECURITY_HSTS_SECONDS,
        content_security_policy=SECURITY_CONTENT_SECURITY_POLICY,
    )


@app.get("/health")
def health() -> dict[str, Any]:
    with db() as conn:
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


app.include_router(auth_router)
app.include_router(sites_router)
app.include_router(telemetry_router)
app.include_router(leads_router)

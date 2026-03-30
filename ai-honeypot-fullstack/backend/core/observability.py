from __future__ import annotations

import json
import logging
import os
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


REQUEST_ID_HEADER = "X-Request-ID"
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get("-")
        return True


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", request_id_ctx.get("-")),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack_info"] = self.formatStack(record.stack_info)
        return json.dumps(payload, ensure_ascii=True, separators=(",", ":"))


def configure_logging(*, level: str = "INFO", json_logs: bool = False) -> None:
    resolved_level = str(level or "INFO").upper()
    root_logger = logging.getLogger()
    root_logger.setLevel(resolved_level)
    root_logger.handlers.clear()

    handler = logging.StreamHandler()
    if json_logs:
        handler.setFormatter(JsonLogFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"))
    handler.addFilter(RequestIdFilter())
    root_logger.addHandler(handler)


def init_sentry(*, dsn: str, environment: str, traces_sample_rate: float) -> bool:
    if not dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
    except Exception:
        logging.getLogger(__name__).warning("Sentry DSN provided but sentry_sdk is not installed.")
        return False

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        traces_sample_rate=traces_sample_rate,
        integrations=[FastApiIntegration()],
        release=os.getenv("APP_RELEASE", "").strip() or None,
    )
    return True


class RequestIdMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, log_requests: bool = True):
        super().__init__(app)
        self.log_requests = log_requests
        self.logger = logging.getLogger("request")

    async def dispatch(self, request: Request, call_next: Callable[..., Any]) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER, "").strip() or uuid.uuid4().hex
        token = request_id_ctx.set(request_id)
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            self.logger.exception(
                "request_failed method=%s path=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                duration_ms,
            )
            raise
        else:
            duration_ms = (time.perf_counter() - start) * 1000
            response.headers[REQUEST_ID_HEADER] = request_id
            if self.log_requests:
                self.logger.info(
                    "request_completed method=%s path=%s status=%s duration_ms=%.2f",
                    request.method,
                    request.url.path,
                    response.status_code,
                    duration_ms,
                )
            return response
        finally:
            request_id_ctx.reset(token)

from __future__ import annotations

import json
import logging
import os
import ssl
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from core.config import (
    PUBLIC_BASE_URL,
    SPLUNK_HEC_TIMEOUT_SECONDS,
    SPLUNK_HEC_TOKEN,
    SPLUNK_HEC_URL,
    SPLUNK_HEC_VERIFY_TLS,
    is_placeholder_secret,
)


logger = logging.getLogger(__name__)
SPLUNK_SOURCE = "cybersentinel-backend"
SPLUNK_SOURCETYPE = "cybersentinel:honeypot:event"


def splunk_enabled() -> bool:
    return bool(
        SPLUNK_HEC_URL
        and SPLUNK_HEC_TOKEN
        and not is_placeholder_secret(SPLUNK_HEC_URL)
        and not is_placeholder_secret(SPLUNK_HEC_TOKEN)
    )


def _resolve_host() -> str:
    parsed = urlparse(PUBLIC_BASE_URL) if PUBLIC_BASE_URL else None
    if parsed and parsed.hostname:
        return parsed.hostname
    return os.getenv("HOSTNAME", "").strip() or "cybersentinel"


def _event_timestamp(event: dict[str, Any]) -> float:
    candidate = str(event.get("created_at") or event.get("timestamp") or event.get("ts") or "").strip()
    if not candidate:
        return time.time()
    normalized = candidate.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized).timestamp()
    except ValueError:
        return time.time()


def build_splunk_hec_payload(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "event": event,
        "host": _resolve_host(),
        "source": SPLUNK_SOURCE,
        "sourcetype": SPLUNK_SOURCETYPE,
        "time": _event_timestamp(event),
    }


def _ssl_context() -> ssl.SSLContext | None:
    if SPLUNK_HEC_VERIFY_TLS:
        return None
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def _post_splunk_hec(payload: dict[str, Any]) -> bool:
    body = json.dumps(payload, default=str).encode("utf-8")
    request = urllib.request.Request(
        SPLUNK_HEC_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Splunk {SPLUNK_HEC_TOKEN}",
            "Content-Type": "application/json",
            "X-Splunk-Request-Channel": str(uuid.uuid4()),
        },
    )
    try:
        with urllib.request.urlopen(
            request,
            timeout=SPLUNK_HEC_TIMEOUT_SECONDS,
            context=_ssl_context(),
        ) as response:
            status_code = getattr(response, "status", response.getcode())
            return 200 <= int(status_code) < 300
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        logger.warning("Splunk HEC forwarding failed: %s", exc)
        return False


def _dispatch_event(event: dict[str, Any]) -> bool:
    if not splunk_enabled():
        return False
    return _post_splunk_hec(build_splunk_hec_payload(event))


def forward_event_to_splunk(event: dict[str, Any], *, background: bool = True) -> bool:
    if not splunk_enabled():
        return False
    if not background:
        return _dispatch_event(event)

    worker = threading.Thread(
        target=_dispatch_event,
        args=(dict(event),),
        name="splunk-hec-dispatch",
        daemon=True,
    )
    worker.start()
    return True

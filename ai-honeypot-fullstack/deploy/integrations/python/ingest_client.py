from __future__ import annotations

import os
from typing import Any, Dict, Optional

import requests


def build_ingest_url(base_url: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        raise ValueError("Missing HONEYPOT_BASE_URL")
    if base.lower().endswith("/api"):
        return f"{base}/ingest"
    return f"{base}/api/ingest"


def send_honeypot_event(
    event: Dict[str, Any],
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout_sec: float = 6.0,
) -> Dict[str, Any]:
    base_url = base_url or os.getenv("HONEYPOT_BASE_URL", "")
    api_key = api_key or os.getenv("HONEYPOT_API_KEY", "")
    if not api_key:
        return {"ok": False, "status_code": 0, "data": None, "error": "Missing HONEYPOT_API_KEY"}

    try:
        url = build_ingest_url(base_url)
    except Exception as exc:
        return {"ok": False, "status_code": 0, "data": None, "error": str(exc)}

    try:
        resp = requests.post(
            url,
            json=event or {},
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            timeout=timeout_sec,
        )
        try:
            payload = resp.json()
        except Exception:
            payload = {"raw": resp.text}
        return {"ok": resp.ok, "status_code": resp.status_code, "data": payload, "error": None}
    except requests.RequestException as exc:
        return {"ok": False, "status_code": 0, "data": None, "error": str(exc)}


if __name__ == "__main__":
    sample_event = {
        "event_type": "auth_fail",
        "url_path": "/login",
        "http_method": "POST",
        "captured_data": {"reason": "invalid_password"},
        "session_id": "py-smoke-local",
    }
    print(send_honeypot_event(sample_event))


from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable


BACKEND_INTERNAL_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:5000").strip().rstrip("/")
PROTOCOL_SHARED_SECRET = os.getenv("PROTOCOL_SHARED_SECRET", "").strip()
COWRIE_JSON_LOG = Path(os.getenv("COWRIE_JSON_LOG", "/cowrie/cowrie-git/var/log/cowrie/cowrie.json")).resolve()
COWRIE_SITE_ID = int(os.getenv("COWRIE_SITE_ID", "0").strip() or "0") or None
COWRIE_HTTP_TIMEOUT_SEC = max(1, int(os.getenv("COWRIE_HTTP_TIMEOUT_SEC", "4")))
COWRIE_BRIDGE_POLL_INTERVAL_SEC = max(1, int(os.getenv("COWRIE_BRIDGE_POLL_INTERVAL_SEC", "2")))
COWRIE_BRIDGE_STATE_FILE = Path(os.getenv("COWRIE_BRIDGE_STATE_FILE", "/data/cowrie-bridge-state.json")).resolve()


def _load_state() -> dict[str, Any]:
    if not COWRIE_BRIDGE_STATE_FILE.exists():
        return {"inode": None, "offset": 0}
    try:
        return json.loads(COWRIE_BRIDGE_STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"inode": None, "offset": 0}


def _save_state(state: dict[str, Any]) -> None:
    COWRIE_BRIDGE_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    COWRIE_BRIDGE_STATE_FILE.write_text(json.dumps(state), encoding="utf-8")


def _string(value: Any) -> str:
    return str(value or "").strip()


def translate_cowrie_event(raw: dict[str, Any]) -> dict[str, Any] | None:
    eventid = _string(raw.get("eventid"))
    session_id = _string(raw.get("session") or raw.get("session_id"))
    ip = _string(raw.get("src_ip") or raw.get("src") or raw.get("ip"))
    if not eventid or not session_id or not ip:
        return None

    timestamp = _string(raw.get("timestamp")) or None
    metadata = {
        "source": "cowrie-bridge",
        "cowrie_eventid": eventid,
        "sensor": _string(raw.get("sensor")) or None,
        "dst_ip": _string(raw.get("dst_ip")) or None,
        "dst_port": raw.get("dst_port"),
    }

    payload: dict[str, Any] = {
        "protocol": "ssh",
        "site_id": COWRIE_SITE_ID,
        "session_id": session_id,
        "event_type": eventid.replace(".", "_"),
        "timestamp": timestamp,
        "phase": "interaction",
        "ip": ip,
        "geo": "Cowrie",
        "username": _string(raw.get("username")) or None,
        "status": _string(raw.get("message")) or "ok",
        "execution_mode": "real",
        "metadata": {key: value for key, value in metadata.items() if value not in {None, ""}},
    }

    if eventid == "cowrie.login.success":
        payload.update(
            {
                "event_type": "ssh_auth",
                "phase": "auth",
                "password": _string(raw.get("password")) or None,
                "accepted": True,
                "status": "accepted",
            }
        )
        return payload

    if eventid == "cowrie.login.failed":
        payload.update(
            {
                "event_type": "ssh_auth",
                "phase": "auth",
                "password": _string(raw.get("password")) or None,
                "accepted": False,
                "status": "rejected",
            }
        )
        return payload

    if eventid == "cowrie.command.input":
        command = _string(raw.get("input") or raw.get("command"))
        if not command:
            return None
        payload.update(
            {
                "event_type": "ssh_command",
                "phase": "interaction",
                "cmd": command,
                "status": "ok",
            }
        )
        return payload

    if eventid == "cowrie.session.connect":
        payload.update({"event_type": "ssh_session_open", "phase": "connect", "status": "connected"})
        return payload

    if eventid == "cowrie.session.closed":
        payload.update({"event_type": "ssh_session_close", "phase": "disconnect", "status": "closed"})
        return payload

    if eventid == "cowrie.session.file_download":
        payload.update(
            {
                "event_type": "cowrie_file_download",
                "phase": "interaction",
                "status": "file_download",
                "metadata": {
                    **payload["metadata"],
                    "url": _string(raw.get("url")) or None,
                    "shasum": _string(raw.get("shasum")) or None,
                    "outfile": _string(raw.get("outfile")) or None,
                },
            }
        )
        payload["metadata"] = {key: value for key, value in payload["metadata"].items() if value not in {None, ""}}
        return payload

    return payload


def _post_payload(payload: dict[str, Any]) -> bool:
    if not BACKEND_INTERNAL_URL or not PROTOCOL_SHARED_SECRET:
        return False
    request = urllib.request.Request(
        f"{BACKEND_INTERNAL_URL}/internal/protocols/event",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Protocol-Secret": PROTOCOL_SHARED_SECRET,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=COWRIE_HTTP_TIMEOUT_SEC) as response:
            status_code = getattr(response, "status", response.getcode())
            return 200 <= int(status_code) < 300
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError, ValueError):
        return False


def process_log_once(post_payload: Callable[[dict[str, Any]], bool] | None = None) -> bool:
    sender = post_payload or _post_payload
    state = _load_state()
    if not COWRIE_JSON_LOG.exists():
        return False

    stat = COWRIE_JSON_LOG.stat()
    inode = f"{stat.st_dev}:{stat.st_ino}"
    offset = int(state.get("offset") or 0)
    if state.get("inode") != inode or offset > stat.st_size:
        offset = 0

    with COWRIE_JSON_LOG.open("r", encoding="utf-8", errors="replace") as handle:
        handle.seek(offset)
        while True:
            line_start = handle.tell()
            line = handle.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                offset = handle.tell()
                continue
            try:
                payload = translate_cowrie_event(json.loads(line))
            except json.JSONDecodeError:
                offset = handle.tell()
                continue
            if payload is not None and not sender(payload):
                _save_state({"inode": inode, "offset": line_start})
                return False
            offset = handle.tell()

    _save_state({"inode": inode, "offset": offset})
    return True


def main() -> None:
    while True:
        process_log_once()
        time.sleep(COWRIE_BRIDGE_POLL_INTERVAL_SEC)


if __name__ == "__main__":
    main()

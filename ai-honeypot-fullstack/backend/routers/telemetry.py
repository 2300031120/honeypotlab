import asyncio
import csv
from contextlib import suppress
import html
import io
import ipaddress
import json
import logging
import os
import posixpath
import re
import secrets
import shlex
import threading
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
)
from fastapi.responses import (
    HTMLResponse,
    JSONResponse,
    PlainTextResponse,
    RedirectResponse,
    StreamingResponse,
)

from core.audit import (
    log_command_validation_failure,
    log_rate_limit_violation,
    log_security_event,
    log_sql_injection_attempt,
    operator_action_log_entry,
    record_operator_action,
)
from core.config import (
    ALLOW_SIGNUP,
    AI_ADVISOR_RATE_LIMIT_MAX_ATTEMPTS,
    AI_ADVISOR_RATE_LIMIT_WINDOW_SECONDS,
    APP_ENV,
    DATABASE_BACKEND,
    DECOY_COOKIE_SAMESITE,
    DECOY_COOKIE_SECURE,
    ENABLE_DEMO_SEED,
    FINAL_REPORT_RATE_LIMIT_MAX_ATTEMPTS,
    FINAL_REPORT_RATE_LIMIT_WINDOW_SECONDS,
    FORCE_HTTPS_REDIRECT,
    GOOGLE_CLIENT_ID,
    PROTOCOL_SHARED_SECRET,
    PROTOCOL_SSH_AUTH_TRAP_ENABLED,
    PUBLIC_BASE_URL,
    RESEARCH_RUN_RATE_LIMIT_MAX_ATTEMPTS,
    RESEARCH_RUN_RATE_LIMIT_WINDOW_SECONDS,
    SIMULATOR_RATE_LIMIT_MAX_ATTEMPTS,
    SIMULATOR_RATE_LIMIT_WINDOW_SECONDS,
    SSH_DECOY_HEALTH_URL,
    TERMINAL_CMD_RATE_LIMIT_MAX_ATTEMPTS,
    TERMINAL_CMD_RATE_LIMIT_WINDOW_SECONDS,
    TERMINAL_EXEC_TIMEOUT_SEC,
    TERMINAL_MAX_OUTPUT_CHARS,
    TERMINAL_REAL_EXEC_ENABLED,
    TERMINAL_SANDBOX_URL,
    TRUSTED_HOSTS,
    URL_SCAN_RATE_LIMIT_MAX_ATTEMPTS,
    URL_SCAN_RATE_LIMIT_WINDOW_SECONDS,
    is_placeholder_secret,
    trusted_host_matches,
)
from core.database import build_summary, db, frontend_event, normalize_event
from core.event_safety import clean_event_text, sanitize_captured_data
from core.public_hosts import normalize_public_host, select_matching_site_row
from core.request_security import enforce_rate_limit
from core.security import hash_api_key
from core.security import integrity_fingerprint
from core.security import sha256_hex
from core.security import sign_integrity_payload
from core.security import stable_hash
from core.splunk import forward_event_to_splunk
from core.time_utils import iso_now, utc_now
from dependencies import (
    current_admin_user,
    current_user,
    current_websocket_user,
    optional_user,
)
from schemas import (
    AdvisorPayload,
    AutoModePayload,
    BlockIpPayload,
    CanaryTokenCreatePayload,
    DeceptionDeployPayload,
    DeceptionProtocolTogglePayload,
    IngestRequest,
    InternalProtocolEventPayload,
    RuntimeModuleTogglePayload,
    SimulatorPayload,
    TerminalCommandPayload,
    UrlScanPayload,
)


router = APIRouter()
logger = logging.getLogger(__name__)
ROUTER_STARTED_AT = utc_now()
AUDIT_LOG_SOURCES = {"all", "incident", "response", "operator"}


def _build_operator_rate_limit_dependency(scope: str, limit: int, window_seconds: int):
    def dependency(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        enforce_rate_limit(
            f"operator:{scope}:user:{int(user['id'])}",
            limit=limit,
            window_seconds=window_seconds,
        )
        return user

    return dependency


final_report_rate_limit = _build_operator_rate_limit_dependency(
    "forensics-final-report",
    FINAL_REPORT_RATE_LIMIT_MAX_ATTEMPTS,
    FINAL_REPORT_RATE_LIMIT_WINDOW_SECONDS,
)
simulator_rate_limit = _build_operator_rate_limit_dependency(
    "simulator-inject",
    SIMULATOR_RATE_LIMIT_MAX_ATTEMPTS,
    SIMULATOR_RATE_LIMIT_WINDOW_SECONDS,
)
terminal_cmd_rate_limit = _build_operator_rate_limit_dependency(
    "terminal-cmd",
    TERMINAL_CMD_RATE_LIMIT_MAX_ATTEMPTS,
    TERMINAL_CMD_RATE_LIMIT_WINDOW_SECONDS,
)
ai_advisor_rate_limit = _build_operator_rate_limit_dependency(
    "ai-expert-advisor",
    AI_ADVISOR_RATE_LIMIT_MAX_ATTEMPTS,
    AI_ADVISOR_RATE_LIMIT_WINDOW_SECONDS,
)
url_scan_rate_limit = _build_operator_rate_limit_dependency(
    "intel-url-scan",
    URL_SCAN_RATE_LIMIT_MAX_ATTEMPTS,
    URL_SCAN_RATE_LIMIT_WINDOW_SECONDS,
)
research_run_rate_limit = _build_operator_rate_limit_dependency(
    "research-run",
    RESEARCH_RUN_RATE_LIMIT_MAX_ATTEMPTS,
    RESEARCH_RUN_RATE_LIMIT_WINDOW_SECONDS,
)

DEFAULT_DECEPTION_PROTOCOLS = {
    "credential_injection": True,
    "honeyfile_generation": True,
    "ai_adaptive": True,
    "decoy_services": False,
}
PROFILE_PROTOCOLS = {
    "defensive": {
        "credential_injection": False,
        "honeyfile_generation": True,
        "ai_adaptive": False,
        "decoy_services": False,
    },
    "balanced": {
        "credential_injection": True,
        "honeyfile_generation": True,
        "ai_adaptive": True,
        "decoy_services": True,
    },
    "aggressive": {
        "credential_injection": True,
        "honeyfile_generation": True,
        "ai_adaptive": True,
        "decoy_services": True,
    },
}
DEFAULT_RUNTIME_MODULES = {
    "ssh": {"enabled": True, "host": "0.0.0.0", "port": 22},
    "http": {"enabled": True, "host": "0.0.0.0", "port": 80},
    "mysql": {"enabled": True, "host": "0.0.0.0", "port": 3306},
}
DEFAULT_HONEYTOKEN_PATHS = [
    "/.env",
    "/phpmyadmin/",
    "/admin",
    "/wp-login.php",
    "/.git/config",
]
PUBLIC_DEMO_SNAPSHOT_TEMPLATES = [
    {
        "event_type": "http_probe",
        "path": "/.env",
        "severity": "high",
        "score": 92,
        "ip": "203.0.113.24",
        "geo": "Singapore",
        "behavior": "credential_sinkhole",
    },
    {
        "event_type": "http_probe",
        "path": "/phpmyadmin/",
        "severity": "high",
        "score": 88,
        "ip": "198.51.100.13",
        "geo": "Germany",
        "behavior": "credential_spray",
    },
    {
        "event_type": "wp_probe",
        "path": "/wp-login.php",
        "severity": "medium",
        "score": 72,
        "ip": "198.51.100.31",
        "geo": "India",
        "behavior": "progressive_disclosure",
    },
    {
        "event_type": "admin_probe",
        "path": "/admin/login",
        "severity": "medium",
        "score": 69,
        "ip": "203.0.113.73",
        "geo": "United States",
        "behavior": "progressive_disclosure",
    },
    {
        "event_type": "exposure_scan",
        "path": "/.git/config",
        "severity": "high",
        "score": 86,
        "ip": "192.0.2.42",
        "geo": "Japan",
        "behavior": "credential_sinkhole",
    },
    {
        "event_type": "api_probe",
        "path": "/actuator/env",
        "severity": "medium",
        "score": 64,
        "ip": "203.0.113.91",
        "geo": "Brazil",
        "behavior": "observe",
    },
    {
        "event_type": "xmlrpc_probe",
        "path": "/xmlrpc.php",
        "severity": "medium",
        "score": 61,
        "ip": "198.51.100.88",
        "geo": "United Kingdom",
        "behavior": "progressive_disclosure",
    },
    {
        "event_type": "backup_probe",
        "path": "/backup.sql",
        "severity": "high",
        "score": 85,
        "ip": "192.0.2.58",
        "geo": "Netherlands",
        "behavior": "credential_sinkhole",
    },
]
SAMPLE_INCIDENT_TEMPLATES = [
    {
        "minutes_ago": 48,
        "session_id": "sample-portal-01",
        "event_type": "admin_probe",
        "severity": "medium",
        "score": 68,
        "ip": "198.51.100.44",
        "geo": "Singapore",
        "url_path": "/admin/login",
        "http_method": "GET",
        "cmd": None,
        "attacker_type": "scanner",
        "reputation": 61,
        "mitre_tactic": "Reconnaissance",
        "mitre_technique": "T1595",
        "policy_strategy": "progressive_disclosure",
        "policy_risk_score": 72,
        "captured_data": {
            "surface": "admin_login",
            "note": "Decoy admin panel fingerprinted.",
        },
    },
    {
        "minutes_ago": 41,
        "session_id": "sample-portal-01",
        "event_type": "credential_harvest",
        "severity": "high",
        "score": 86,
        "ip": "198.51.100.44",
        "geo": "Singapore",
        "url_path": "/admin/login",
        "http_method": "POST",
        "cmd": None,
        "attacker_type": "interactive",
        "reputation": 78,
        "mitre_tactic": "Credential Access",
        "mitre_technique": "T1110",
        "policy_strategy": "credential_sinkhole",
        "policy_risk_score": 91,
        "captured_data": {
            "username": "opsadmin",
            "password": "[REDACTED]",
            "source": "admin_decoy_form",
        },
    },
    {
        "minutes_ago": 34,
        "session_id": "sample-portal-01",
        "event_type": "terminal_exec",
        "severity": "high",
        "score": 93,
        "ip": "198.51.100.44",
        "geo": "Singapore",
        "url_path": "/admin/console",
        "http_method": "POST",
        "cmd": "cat /var/www/html/.env",
        "attacker_type": "interactive",
        "reputation": 88,
        "mitre_tactic": "Discovery",
        "mitre_technique": "T1083",
        "policy_strategy": "aggressive_containment",
        "policy_risk_score": 96,
        "captured_data": {
            "output": "APP_ENV=production\nDB_HOST=10.0.4.12\nJWT_SECRET=[FAKE_SECRET]\n",
            "status": "blocked",
            "prompt": "admin@web-ops-01:~/portal$",
            "cwd": "/home/admin/portal",
            "execution_mode": "emulated",
        },
    },
    {
        "minutes_ago": 28,
        "session_id": "sample-api-01",
        "event_type": "api_probe",
        "severity": "medium",
        "score": 71,
        "ip": "203.0.113.121",
        "geo": "Germany",
        "url_path": "/api/internal/users",
        "http_method": "GET",
        "cmd": None,
        "attacker_type": "bot",
        "reputation": 63,
        "mitre_tactic": "Reconnaissance",
        "mitre_technique": "T1595",
        "policy_strategy": "observe",
        "policy_risk_score": 74,
        "captured_data": {
            "headers": {"x-forwarded-for": "203.0.113.121"},
            "surface": "internal_api",
        },
    },
    {
        "minutes_ago": 22,
        "session_id": "sample-api-01",
        "event_type": "token_probe",
        "severity": "high",
        "score": 89,
        "ip": "203.0.113.121",
        "geo": "Germany",
        "url_path": "/actuator/env",
        "http_method": "GET",
        "cmd": None,
        "attacker_type": "interactive",
        "reputation": 81,
        "mitre_tactic": "Credential Access",
        "mitre_technique": "T1552",
        "policy_strategy": "credential_sinkhole",
        "policy_risk_score": 93,
        "captured_data": {"token_hint": "svc-export", "surface": "actuator"},
    },
    {
        "minutes_ago": 15,
        "session_id": "sample-api-01",
        "event_type": "terminal_exec",
        "severity": "high",
        "score": 94,
        "ip": "203.0.113.121",
        "geo": "Germany",
        "url_path": "/api/admin/export",
        "http_method": "POST",
        "cmd": "curl -s https://portal.example.com/api/admin/export",
        "attacker_type": "interactive",
        "reputation": 91,
        "mitre_tactic": "Execution",
        "mitre_technique": "T1059",
        "policy_strategy": "aggressive_containment",
        "policy_risk_score": 97,
        "captured_data": {
            "output": '{"status":"blocked","reason":"egress sinkhole"}',
            "status": "blocked",
            "prompt": "admin@api-gateway-02:/srv$",
            "cwd": "/srv",
            "execution_mode": "emulated",
        },
    },
]
AUTO_RESPONSE_EVENT_LIMIT = 120
AUTO_RESPONSE_BLOCK_CONFIDENCE = 78
AUTO_RESPONSE_REASON_PREFIX = "auto-campaign:"
EDGE_BLOCK_EXPORT_FORMATS = {"plain", "nginx", "cloudflare-json"}
TACTIC_TO_PHASE = {
    "Reconnaissance": "Recon",
    "Initial Access": "Access",
    "Execution": "Interact",
    "Discovery": "Interact",
    "Credential Access": "Contain",
}
SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}
DEFAULT_TERMINAL_HOSTS = [
    "web-ops-01",
    "db-gateway-02",
    "vault-proxy-01",
    "ops-cache-04",
]
DEFAULT_TERMINAL_DIRECTORIES = [
    "/",
    "/bin",
    "/dev",
    "/etc",
    "/home",
    "/home/admin",
    "/home/admin/.ssh",
    "/opt",
    "/opt/ops",
    "/proc",
    "/srv",
    "/srv/backups",
    "/tmp",
    "/var",
    "/var/log",
    "/var/www",
    "/var/www/html",
]
DEFAULT_TERMINAL_FILES = {
    "/etc/hostname": "web-ops-01\n",
    "/etc/os-release": 'NAME="Ubuntu"\nVERSION="22.04.3 LTS (Jammy Jellyfish)"\nID=ubuntu\n',
    "/etc/passwd": "root:x:0:0:root:/root:/bin/bash\nadmin:x:1000:1000:admin:/home/admin:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
    "/home/admin/.bash_history": "sudo systemctl restart nginx\ncat /var/www/html/.env\nmysql -u reporting -p\n",
    "/home/admin/.ssh/known_hosts": "10.0.4.12 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBaiteddecoykeymaterial\n",
    "/home/admin/notes.txt": "1. Rotate service credentials after payroll import.\n2. Audit exposed admin paths before quarter close.\n",
    "/opt/ops/deploy.sh": "#!/bin/bash\nexport APP_ENV=production\nsystemctl restart honeypot-http\n",
    "/srv/backups/payroll_2024.csv": "employee_id,name,bank_ref\n1042,Anika Rao,masked-8472\n1198,Rahul Iyer,masked-2891\n",
    "/var/log/auth.log": "Mar 28 09:14:22 web-ops-01 sshd[1842]: Failed password for invalid user deploy from 203.0.113.14 port 60211 ssh2\n",
    "/var/www/html/.env": "APP_ENV=production\nDB_HOST=10.0.4.12\nDB_USER=svc_portal\nDB_PASSWORD=[FAKE_PASSWORD]\nJWT_SECRET=[FAKE_SECRET]\n",
    "/var/www/html/index.php": "<?php\n$portal = 'Secure Operations Portal';\necho $portal;\n",
}
WEB_DECOY_COOKIE = "cybersentinel_decoy"
WEB_DECOY_SESSION_LIMIT = 240
WEB_DECOY_ACCEPT_USERS = {
    "root",
    "admin",
    "dbadmin",
    "pma",
    "administrator",
    "wp_admin",
    "opsadmin",
}
WEB_DECOY_SESSIONS: dict[str, dict[str, Any]] = {}
WEB_DECOY_DATABASES = {
    "operations": {
        "users": {
            "columns": [
                {"name": "id", "type": "int", "key": "PRI"},
                {"name": "username", "type": "varchar(64)", "key": "UNI"},
                {"name": "email", "type": "varchar(128)", "key": ""},
                {"name": "role", "type": "varchar(32)", "key": ""},
                {"name": "status", "type": "varchar(16)", "key": ""},
            ],
            "rows": [
                {
                    "id": 1,
                    "username": "svc_portal",
                    "email": "svc_portal@ops.local",
                    "role": "service",
                    "status": "active",
                },
                {
                    "id": 2,
                    "username": "admin",
                    "email": "admin@ops.local",
                    "role": "administrator",
                    "status": "active",
                },
                {
                    "id": 3,
                    "username": "reporting",
                    "email": "reporting@ops.local",
                    "role": "analyst",
                    "status": "locked",
                },
            ],
        },
        "sessions": {
            "columns": [
                {"name": "session_id", "type": "varchar(48)", "key": "PRI"},
                {"name": "user_id", "type": "int", "key": ""},
                {"name": "ip_address", "type": "varchar(48)", "key": ""},
                {"name": "last_seen", "type": "datetime", "key": ""},
            ],
            "rows": [
                {
                    "session_id": "sess-8f2a1d",
                    "user_id": 2,
                    "ip_address": "10.0.4.18",
                    "last_seen": "2026-03-28 09:06:11",
                },
                {
                    "session_id": "sess-11ca29",
                    "user_id": 1,
                    "ip_address": "10.0.4.22",
                    "last_seen": "2026-03-28 08:58:44",
                },
            ],
        },
        "audit_log": {
            "columns": [
                {"name": "event_id", "type": "int", "key": "PRI"},
                {"name": "actor", "type": "varchar(64)", "key": ""},
                {"name": "action", "type": "varchar(120)", "key": ""},
                {"name": "created_at", "type": "datetime", "key": ""},
            ],
            "rows": [
                {
                    "event_id": 9042,
                    "actor": "svc_portal",
                    "action": "exported payroll summary",
                    "created_at": "2026-03-28 08:31:05",
                },
                {
                    "event_id": 9043,
                    "actor": "admin",
                    "action": "rotated edge API credential",
                    "created_at": "2026-03-28 08:39:51",
                },
            ],
        },
    },
    "crm_portal": {
        "contacts": {
            "columns": [
                {"name": "contact_id", "type": "int", "key": "PRI"},
                {"name": "full_name", "type": "varchar(96)", "key": ""},
                {"name": "email", "type": "varchar(128)", "key": ""},
                {"name": "tier", "type": "varchar(24)", "key": ""},
            ],
            "rows": [
                {
                    "contact_id": 1021,
                    "full_name": "Anika Rao",
                    "email": "anika.rao@crm.local",
                    "tier": "enterprise",
                },
                {
                    "contact_id": 1034,
                    "full_name": "Rahul Iyer",
                    "email": "rahul.iyer@crm.local",
                    "tier": "priority",
                },
            ],
        },
        "tickets": {
            "columns": [
                {"name": "ticket_id", "type": "int", "key": "PRI"},
                {"name": "owner", "type": "varchar(64)", "key": ""},
                {"name": "summary", "type": "varchar(160)", "key": ""},
                {"name": "state", "type": "varchar(20)", "key": ""},
            ],
            "rows": [
                {
                    "ticket_id": 5501,
                    "owner": "ops-bot",
                    "summary": "Portal cache drift on node 04",
                    "state": "open",
                },
                {
                    "ticket_id": 5502,
                    "owner": "admin",
                    "summary": "Reset decoy mail relay token",
                    "state": "closed",
                },
            ],
        },
    },
}
WEB_DECOY_FILES = {
    "/.env": {
        "body": "APP_ENV=production\nDB_HOST=10.0.4.12\nDB_USER=svc_portal\nDB_PASSWORD=[FAKE_PASSWORD]\nJWT_SECRET=[FAKE_SECRET]\n",
        "content_type": "text/plain; charset=utf-8",
        "severity": "high",
        "score": 91,
        "mitre_tactic": "Credential Access",
        "mitre_technique": "T1552",
        "policy_strategy": "credential_sinkhole",
        "policy_risk_score": 93,
    },
    "/.git/config": {
        "body": '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote "origin"]\n\turl = git@github.example:finance/portal.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
        "content_type": "text/plain; charset=utf-8",
        "severity": "high",
        "score": 88,
        "mitre_tactic": "Credential Access",
        "mitre_technique": "T1552",
        "policy_strategy": "credential_sinkhole",
        "policy_risk_score": 90,
    },
    "/config.php": {
        "body": "<?php\n$cfg['Servers'][1]['host'] = '10.0.4.12';\n$cfg['Servers'][1]['user'] = 'svc_portal';\n$cfg['Servers'][1]['password'] = '[FAKE_PASSWORD]';\n",
        "content_type": "text/plain; charset=utf-8",
        "severity": "high",
        "score": 83,
        "mitre_tactic": "Credential Access",
        "mitre_technique": "T1552",
        "policy_strategy": "credential_sinkhole",
        "policy_risk_score": 86,
    },
    "/backup.sql": {
        "body": "-- CyberSentil decoy dump\nCREATE TABLE users (id int, username varchar(64), email varchar(128));\nINSERT INTO users VALUES (1,'svc_portal','svc_portal@ops.local');\n",
        "content_type": "text/plain; charset=utf-8",
        "severity": "high",
        "score": 87,
        "mitre_tactic": "Collection",
        "mitre_technique": "T1005",
        "policy_strategy": "credential_sinkhole",
        "policy_risk_score": 89,
    },
    "/db.sql": {
        "body": "-- CyberSentil decoy schema snapshot\nCREATE TABLE sessions (session_id varchar(48), user_id int, ip_address varchar(48));\n",
        "content_type": "text/plain; charset=utf-8",
        "severity": "medium",
        "score": 76,
        "mitre_tactic": "Collection",
        "mitre_technique": "T1005",
        "policy_strategy": "progressive_disclosure",
        "policy_risk_score": 79,
    },
    "/ssh/fingerprint": {
        "body": "SHA256:6aNQx7xJrV2FHQvM8f0YxBsv0wz2YzGfK7J6vQd4xQ8 web-ops-01 (ED25519)\n",
        "content_type": "text/plain; charset=utf-8",
        "severity": "medium",
        "score": 62,
        "mitre_tactic": "Discovery",
        "mitre_technique": "T1046",
        "policy_strategy": "progressive_disclosure",
        "policy_risk_score": 60,
    },
}


def _request_host(request: Request) -> str:
    return normalize_public_host(
        request.headers.get("host") or request.url.hostname or ""
    )


def _request_ip(request: Request) -> str:
    forwarded = (
        str(request.headers.get("x-forwarded-for") or "").split(",", 1)[0].strip()
    )
    if forwarded:
        return forwarded
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _resolve_public_site_id(conn, request: Request) -> int | None:
    host = _request_host(request)
    rows = conn.execute("select id, domain from sites order by id asc").fetchall()
    row = select_matching_site_row(rows, host, allow_local_singleton_fallback=True)
    return int(row["id"]) if row is not None else None


def _prune_web_decoy_sessions() -> None:
    if len(WEB_DECOY_SESSIONS) <= WEB_DECOY_SESSION_LIMIT:
        return
    ordered = sorted(
        WEB_DECOY_SESSIONS.items(),
        key=lambda item: item[1].get("last_seen") or "",
        reverse=True,
    )
    WEB_DECOY_SESSIONS.clear()
    WEB_DECOY_SESSIONS.update(dict(ordered[:WEB_DECOY_SESSION_LIMIT]))


def _new_web_decoy_state(session_id: str) -> dict[str, Any]:
    return {
        "session_id": session_id,
        "created_at": iso_now(),
        "last_seen": iso_now(),
        "visited_paths": [],
        "actor": "scanner",
        "login_attempts": {"phpmyadmin": 0, "wordpress": 0, "admin": 0},
        "auth": {"phpmyadmin": False, "wordpress": False, "admin": False},
        "usernames": {},
        "selected_db": "operations",
        "sql_history": [],
        "last_sql_result": None,
    }


# Thread-safe session management - FIXED
_session_lock = threading.Lock()

def _web_decoy_state(request: Request) -> tuple[str, dict[str, Any], bool]:
    """Thread-safe web decoy state management with collision detection - SECURITY FIX"""
    _prune_web_decoy_sessions()
    
    with _session_lock:
        session_id = str(request.cookies.get(WEB_DECOY_COOKIE) or "").strip()
        is_new = session_id not in WEB_DECOY_SESSIONS
        
        if is_new:
            # Generate unique session with collision detection - SECURITY FIX
            max_attempts = 10
            for attempt in range(max_attempts):
                new_session_id = f"web-{uuid.uuid4().hex[:12]}"
                if new_session_id not in WEB_DECOY_SESSIONS:
                    session_id = new_session_id
                    break
            else:
                # Fallback with timestamp to ensure uniqueness
                session_id = f"web-{uuid.uuid4().hex[:12]}-{int(datetime.utcnow().timestamp())}"
            
            WEB_DECOY_SESSIONS[session_id] = _new_web_decoy_state(session_id)
        
        state = WEB_DECOY_SESSIONS[session_id]
        state["last_seen"] = iso_now()
        return session_id, state, is_new


def _set_web_decoy_cookie(response, session_id: str) -> None:
    response.set_cookie(
        WEB_DECOY_COOKIE,
        session_id,
        httponly=True,
        samesite=DECOY_COOKIE_SAMESITE,
        secure=DECOY_COOKIE_SECURE,
        path="/",
    )


def _touch_web_decoy_state(state: dict[str, Any], path: str) -> None:
    visited = list(state.get("visited_paths") or [])
    if not visited or visited[-1] != path:
        visited.append(path)
    state["visited_paths"] = visited[-24:]
    attempts = sum(
        int(value or 0) for value in dict(state.get("login_attempts") or {}).values()
    )
    sql_count = len(list(state.get("sql_history") or []))
    if sql_count >= 2 or any(
        bool(value) for value in dict(state.get("auth") or {}).values()
    ):
        state["actor"] = "manual_operator"
    elif attempts >= 3:
        state["actor"] = "brute_forcer"
    elif len(state["visited_paths"]) >= 4:
        state["actor"] = "exploratory_user"
    else:
        state["actor"] = "scanner"


def _decoy_layout(
    title: str, body: str, *, accent: str = "#0f6cbd", subtitle: str = ""
) -> str:
    subtitle_html = (
        f"<div class='decoy-subtitle'>{html.escape(subtitle)}</div>" if subtitle else ""
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <style>
    :root {{
      color-scheme: light;
      --accent: {accent};
      --border: #d9e2ec;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --muted: #52606d;
      --text: #102a43;
      --danger: #c62828;
      --ok: #2e7d32;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: Segoe UI, Arial, sans-serif; background: var(--bg); color: var(--text); }}
    .shell {{ max-width: 1080px; margin: 32px auto; padding: 0 20px; }}
    .header {{ background: linear-gradient(135deg, var(--accent), #16324f); color: #fff; padding: 18px 22px; border-radius: 16px 16px 0 0; }}
    .header h1 {{ margin: 0; font-size: 28px; font-weight: 700; }}
    .decoy-subtitle {{ margin-top: 8px; opacity: 0.88; font-size: 13px; }}
    .panel {{ background: var(--panel); border: 1px solid var(--border); border-top: 0; border-radius: 0 0 16px 16px; padding: 22px; box-shadow: 0 20px 40px rgba(16,42,67,0.08); }}
    .row {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 18px; }}
    .card {{ border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: #fbfdff; }}
    .card h3 {{ margin: 0 0 8px; font-size: 15px; }}
    .muted {{ color: var(--muted); }}
    .nav {{ display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }}
    .nav a {{ color: var(--accent); text-decoration: none; font-weight: 600; }}
    .nav a:hover {{ text-decoration: underline; }}
    form {{ display: grid; gap: 12px; }}
    label {{ display: grid; gap: 6px; font-size: 13px; color: var(--muted); }}
    input, textarea, select {{ width: 100%; border: 1px solid #c7d2e3; border-radius: 10px; padding: 11px 12px; font: inherit; background: #fff; }}
    textarea {{ min-height: 180px; resize: vertical; font-family: Consolas, monospace; }}
    button {{ width: fit-content; border: 0; border-radius: 10px; padding: 11px 16px; background: var(--accent); color: #fff; font-weight: 700; cursor: pointer; }}
    .banner {{ padding: 10px 14px; border-radius: 10px; margin-bottom: 16px; font-size: 13px; }}
    .banner.error {{ background: #fff0f0; color: var(--danger); border: 1px solid #f1b0b7; }}
    .banner.ok {{ background: #edf7ed; color: var(--ok); border: 1px solid #b7d9bb; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
    th, td {{ border-bottom: 1px solid var(--border); text-align: left; padding: 9px 10px; vertical-align: top; }}
    th {{ background: #f0f4f8; font-weight: 700; }}
    code, pre {{ font-family: Consolas, monospace; }}
    pre {{ background: #0f1720; color: #d7e2f0; padding: 14px; border-radius: 12px; overflow: auto; }}
    .kpi {{ font-size: 24px; font-weight: 700; }}
  </style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <h1>{html.escape(title)}</h1>
      {subtitle_html}
    </div>
    <div class="panel">{body}</div>
  </div>
</body>
</html>"""


def _html_table(columns: list[str], rows: list[dict[str, Any]]) -> str:
    header = "".join(f"<th>{html.escape(column)}</th>" for column in columns)
    body_rows = []
    for row in rows:
        cells = "".join(
            f"<td>{html.escape(str(row.get(column, '')))}</td>" for column in columns
        )
        body_rows.append(f"<tr>{cells}</tr>")
    if not body_rows:
        body_rows.append(
            f"<tr><td colspan='{len(columns)}' class='muted'>No rows.</td></tr>"
        )
    return f"<table><thead><tr>{header}</tr></thead><tbody>{''.join(body_rows)}</tbody></table>"


def _parse_request_form(raw_body: bytes) -> dict[str, str]:
    parsed = parse_qs(raw_body.decode("utf-8", errors="ignore"), keep_blank_values=True)
    return {key: values[-1] if values else "" for key, values in parsed.items()}


def _phpmyadmin_login_html(
    state: dict[str, Any], *, error: str = "", username: str = ""
) -> str:
    banner = f"<div class='banner error'>{html.escape(error)}</div>" if error else ""
    body = f"""
      <div class="row">
        <div class="card"><h3>Server</h3><div class="kpi">10.0.4.12</div><div class="muted">Primary DB node</div></div>
        <div class="card"><h3>Session Profile</h3><div class="kpi">{html.escape(state.get("actor", "scanner"))}</div><div class="muted">Adaptive decoy posture</div></div>
      </div>
      {banner}
      <form method="post" action="/phpmyadmin/index.php">
        <label>Username<input name="pma_username" autocomplete="username" value="{html.escape(username)}"></label>
        <label>Password<input name="pma_password" type="password" autocomplete="current-password"></label>
        <label>Server Choice<select name="server"><option>10.0.4.12</option><option>db-gateway-02</option></select></label>
        <button type="submit">Log in</button>
      </form>
      <div class="muted" style="margin-top:14px">phpMyAdmin 5.2.1 on MariaDB 10.6. Login activity is monitored.</div>
    """
    return _decoy_layout(
        "phpMyAdmin",
        body,
        accent="#00618a",
        subtitle="Database administration interface",
    )


def _phpmyadmin_home_html(state: dict[str, Any], *, notice: str = "") -> str:
    current_db = str(state.get("selected_db") or "operations")
    db_links = "".join(
        f"<li><a href='/phpmyadmin/tables.php?db={html.escape(name)}'>{html.escape(name)}</a></li>"
        for name in WEB_DECOY_DATABASES
    )
    notice_html = (
        f"<div class='banner ok'>{html.escape(notice)}</div>" if notice else ""
    )
    body = f"""
      <div class="nav">
        <a href="/phpmyadmin/index.php">Home</a>
        <a href="/phpmyadmin/sql.php">SQL</a>
        <a href="/phpmyadmin/tables.php?db={html.escape(current_db)}">Tables</a>
        <a href="/phpmyadmin/import-export.php">Import / Export</a>
        <a href="/phpmyadmin/sessions.php">Sessions</a>
        <a href="/phpmyadmin/intrusion.php">Intrusion</a>
        <a href="/phpmyadmin/alerts.php">Alerts</a>
      </div>
      {notice_html}
      <div class="row">
        <div class="card"><h3>Authenticated User</h3><div class="kpi">{html.escape(state.get("usernames", {}).get("phpmyadmin", "root"))}</div><div class="muted">Privilege: SUPER</div></div>
        <div class="card"><h3>Current Database</h3><div class="kpi">{html.escape(current_db)}</div><div class="muted">2 schemas staged for review</div></div>
        <div class="card"><h3>SQL Queries</h3><div class="kpi">{len(list(state.get("sql_history") or []))}</div><div class="muted">Recent decoy interactions</div></div>
      </div>
      <div class="card"><h3>Schemas</h3><ul>{db_links}</ul></div>
    """
    return _decoy_layout(
        "phpMyAdmin",
        body,
        accent="#00618a",
        subtitle="Server: 10.0.4.12  |  MariaDB 10.6",
    )


def _normalize_identifier(value: str) -> str:
    return str(value or "").strip().strip("`").strip(";").strip()


def _table_columns(database: str, table: str) -> list[str]:
    table_state = dict(WEB_DECOY_DATABASES.get(database, {}).get(table, {}))
    return [
        str(item.get("name"))
        for item in list(table_state.get("columns") or [])
        if item.get("name")
    ]


# Security constants for SQL validation - SECURITY FIX
MAX_SQL_QUERY_LENGTH = 2000

def _normalize_sql_query(query: str) -> str:
    """Normalize SQL query to prevent Unicode bypasses - SECURITY FIX"""
    if not query:
        return ""
    
    # Normalize Unicode to prevent bypasses
    import unicodedata
    normalized = unicodedata.normalize('NFKC', query)
    # Remove dangerous Unicode characters
    cleaned = ''.join(char for char in normalized if ord(char) < 127)
    return cleaned.strip()

def _validate_sql_query(query: str) -> tuple[bool, str]:
    """Validate SQL query for injection attempts - SECURITY FIX"""
    if not query:
        return False, "Empty query"
    
    if len(query) > MAX_SQL_QUERY_LENGTH:
        return False, f"Query too long (max {MAX_SQL_QUERY_LENGTH} characters)"
    
    normalized = _normalize_sql_query(query)
    lowered = normalized.lower()
    
    # Enhanced pattern matching for SQL injection - SECURITY FIX
    dangerous_patterns = [
        r'\b(drop\s+table|delete\s+from|truncate\s+table|alter\s+table|update\s+.*set|insert\s+into|grant\s+.*on|create\s+user)\b',
        r'\b(union\s+select\b)',
        r'\b(into\s+outfile|load_file|dumpfile)\b',
        r'\b(exec\s*\(|xp_cmdshell|sp_executesql)\b',
        r'\b(waitfor\s+delay|benchmark\s*\(|sleep\s*\()\b',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, lowered, re.IGNORECASE):
            return False, f"Potentially dangerous SQL pattern detected"
    
    return True, "Query appears safe"

def _fake_sql_result(state: dict[str, Any], query: str, source_ip: str | None = None) -> dict[str, Any]:
    """Enhanced SQL result function with comprehensive validation - SECURITY FIX"""
    # Validate SQL query first - SECURITY FIX
    is_valid, validation_msg = _validate_sql_query(query)
    if not is_valid:
        # Log SQL injection attempt - SECURITY AUDIT
        log_sql_injection_attempt(
            source_ip=source_ip or "unknown",
            query=query,
            pattern_detected=validation_msg,
        )
        return {
            "status": "blocked",
            "summary": f"SQL validation failed: {validation_msg}",
            "columns": [],
            "rows": [],
            "severity": "high",
            "score": 90,
            "mitre_tactic": "Execution",
            "mitre_technique": "T1059",
            "policy_strategy": "aggressive_containment",
            "policy_risk_score": 94,
        }
    
    normalized = query.strip().rstrip(";")
    lowered = normalized.lower()
    
    # Enhanced destructive pattern detection - SECURITY FIX
    destructive_patterns = [
        r'\b(drop\s+table|delete\s+from|truncate\s+table|alter\s+table|update\s+.*set|insert\s+into|grant\s+.*on|create\s+user)\b',
        r'\b(into\s+outfile|load_file|dumpfile)\b',
        r'\b(exec\s*\(|xp_cmdshell|sp_executesql)\b',
        r'\b(waitfor\s+delay|benchmark\s*\(|sleep\s*\()\b',
    ]
    
    is_destructive = False
    for pattern in destructive_patterns:
        if re.search(pattern, lowered, re.IGNORECASE):
            is_destructive = True
            break
    
    if is_destructive:
        return {
            "status": "blocked",
            "summary": "ERROR 1142 (42000): administrative statement blocked by deception policy",
            "columns": [],
            "rows": [],
            "severity": "high",
            "score": 90,
            "mitre_tactic": "Execution",
            "mitre_technique": "T1059",
            "policy_strategy": "aggressive_containment",
            "policy_risk_score": 94,
        }
    if lowered == "show databases" or lowered == "show schemas":
        rows = [{"Database": name} for name in WEB_DECOY_DATABASES]
        return {
            "status": "ok",
            "summary": f"{len(rows)} databases returned.",
            "columns": ["Database"],
            "rows": rows,
            "severity": "medium",
            "score": 61,
            "mitre_tactic": "Discovery",
            "mitre_technique": "T1087",
            "policy_strategy": "progressive_disclosure",
            "policy_risk_score": 58,
        }
    if lowered.startswith("use "):
        database = _normalize_identifier(normalized.split(" ", 1)[1])
        if database not in WEB_DECOY_DATABASES:
            return {
                "status": "error",
                "summary": f"Unknown database '{database}'",
                "columns": [],
                "rows": [],
                "severity": "medium",
                "score": 57,
                "mitre_tactic": "Discovery",
                "mitre_technique": "T1087",
                "policy_strategy": "progressive_disclosure",
                "policy_risk_score": 55,
            }
        state["selected_db"] = database
        return {
            "status": "ok",
            "summary": f"Database changed to {database}.",
            "columns": [],
            "rows": [],
            "severity": "medium",
            "score": 54,
            "mitre_tactic": "Discovery",
            "mitre_technique": "T1087",
            "policy_strategy": "progressive_disclosure",
            "policy_risk_score": 52,
        }
    show_tables = re.match(r"show\s+tables(?:\s+from\s+([a-zA-Z0-9_`]+))?$", lowered)
    if show_tables:
        database = _normalize_identifier(
            show_tables.group(1) or str(state.get("selected_db") or "operations")
        )
        tables = sorted(WEB_DECOY_DATABASES.get(database, {}).keys())
        rows = [{f"Tables_in_{database}": table} for table in tables]
        return {
            "status": "ok",
            "summary": f"{len(rows)} tables listed from {database}.",
            "columns": [f"Tables_in_{database}"],
            "rows": rows,
            "severity": "medium",
            "score": 63,
            "mitre_tactic": "Discovery",
            "mitre_technique": "T1087",
            "policy_strategy": "progressive_disclosure",
            "policy_risk_score": 60,
        }
    describe_match = re.match(
        r"(describe|desc|show\s+columns\s+from)\s+([a-zA-Z0-9_`]+)", lowered
    )
    if describe_match:
        table = _normalize_identifier(describe_match.group(2))
        database = str(state.get("selected_db") or "operations")
        columns = list(
            WEB_DECOY_DATABASES.get(database, {}).get(table, {}).get("columns") or []
        )
        rows = [
            {
                "Field": item["name"],
                "Type": item["type"],
                "Key": item["key"],
                "Null": "YES",
            }
            for item in columns
        ]
        return {
            "status": "ok" if rows else "error",
            "summary": f"Structure for {table}."
            if rows
            else f"Table '{table}' not found.",
            "columns": ["Field", "Type", "Key", "Null"] if rows else [],
            "rows": rows,
            "severity": "medium",
            "score": 66 if rows else 57,
            "mitre_tactic": "Discovery",
            "mitre_technique": "T1087",
            "policy_strategy": "progressive_disclosure",
            "policy_risk_score": 62 if rows else 56,
        }
    if lowered in {"select database()", "select current_database()"}:
        database = str(state.get("selected_db") or "operations")
        return {
            "status": "ok",
            "summary": "Current database returned.",
            "columns": ["database()"],
            "rows": [{"database()": database}],
            "severity": "medium",
            "score": 58,
            "mitre_tactic": "Discovery",
            "mitre_technique": "T1087",
            "policy_strategy": "progressive_disclosure",
            "policy_risk_score": 55,
        }
    select_match = re.search(r"from\s+([a-zA-Z0-9_`]+)(?:\.([a-zA-Z0-9_`]+))?", lowered)
    if lowered.startswith("select") and select_match:
        if select_match.group(2):
            database = _normalize_identifier(select_match.group(1))
            table = _normalize_identifier(select_match.group(2))
        else:
            database = str(state.get("selected_db") or "operations")
            table = _normalize_identifier(select_match.group(1))
        table_state = dict(WEB_DECOY_DATABASES.get(database, {}).get(table, {}))
        rows = list(table_state.get("rows") or [])
        if not rows:
            return {
                "status": "error",
                "summary": f"Table '{table}' not found in {database}.",
                "columns": [],
                "rows": [],
                "severity": "medium",
                "score": 57,
                "mitre_tactic": "Discovery",
                "mitre_technique": "T1087",
                "policy_strategy": "progressive_disclosure",
                "policy_risk_score": 56,
            }
        limit_match = re.search(r"limit\s+(\d+)", lowered)
        limit = max(1, min(int(limit_match.group(1)) if limit_match else 5, 25))
        sliced = rows[:limit]
        if any(token in lowered for token in ["password", "token", "secret", "email"]):
            severity = "high"
            score = 86
            tactic = "Credential Access"
            technique = "T1552"
            policy = "credential_sinkhole"
            risk = 88
        else:
            severity = "medium"
            score = 68
            tactic = "Discovery"
            technique = "T1087"
            policy = "progressive_disclosure"
            risk = 64
        return {
            "status": "ok",
            "summary": f"{len(sliced)} rows returned from {database}.{table}.",
            "columns": _table_columns(database, table),
            "rows": sliced,
            "severity": severity,
            "score": score,
            "mitre_tactic": tactic,
            "mitre_technique": technique,
            "policy_strategy": policy,
            "policy_risk_score": risk,
        }
    return {
        "status": "error",
        "summary": "Unsupported statement in bounded SQL console.",
        "columns": [],
        "rows": [],
        "severity": "medium",
        "score": 52,
        "mitre_tactic": "Execution",
        "mitre_technique": "T1059",
        "policy_strategy": "observe",
        "policy_risk_score": 49,
    }


def _phpmyadmin_sql_html(
    state: dict[str, Any], *, query: str = "", result: dict[str, Any] | None = None
) -> str:
    result_html = ""
    if result is not None:
        banner_class = "ok" if result["status"] == "ok" else "error"
        table_html = (
            _html_table(result["columns"], result["rows"]) if result["columns"] else ""
        )
        result_html = f"<div class='banner {banner_class}'>{html.escape(result['summary'])}</div>{table_html}"
    body = f"""
      <div class="nav">
        <a href="/phpmyadmin/index.php">Home</a>
        <a href="/phpmyadmin/tables.php?db={html.escape(str(state.get("selected_db") or "operations"))}">Tables</a>
        <a href="/phpmyadmin/sessions.php">Sessions</a>
      </div>
      <form method="post" action="/phpmyadmin/sql.php">
        <label>SQL query<textarea name="query">{html.escape(query)}</textarea></label>
        <button type="submit">Go</button>
      </form>
      {result_html}
    """
    return _decoy_layout(
        "phpMyAdmin SQL Console",
        body,
        accent="#00618a",
        subtitle=f"Database: {state.get('selected_db') or 'operations'}",
    )


def _wordpress_login_html(
    state: dict[str, Any], *, error: str = "", username: str = ""
) -> str:
    banner = f"<div class='banner error'>{html.escape(error)}</div>" if error else ""
    body = f"""
      <div class="row">
        <div class="card"><h3>Site</h3><div class="kpi">Citizen Portal</div><div class="muted">WordPress 6.5.2</div></div>
        <div class="card"><h3>Behavior</h3><div class="kpi">{html.escape(state.get("actor", "scanner"))}</div><div class="muted">Adaptive web decoy</div></div>
      </div>
      {banner}
      <form method="post" action="/wp-login.php">
        <label>Username or Email Address<input name="log" value="{html.escape(username)}"></label>
        <label>Password<input name="pwd" type="password"></label>
        <button type="submit">Log In</button>
      </form>
      <div class="muted" style="margin-top:14px">Protected by managed reverse proxy and credential telemetry.</div>
    """
    return _decoy_layout("WordPress", body, accent="#3858e9", subtitle="Login")


def _wordpress_admin_html(state: dict[str, Any]) -> str:
    body = f"""
      <div class="nav">
        <a href="/wp-admin/">Dashboard</a>
        <a href="/wp-admin/users.php">Users</a>
        <a href="/wp-admin/plugins.php">Plugins</a>
      </div>
      <div class="row">
        <div class="card"><h3>Pending Updates</h3><div class="kpi">3</div><div class="muted">Core, Akismet, Contact Form 7</div></div>
        <div class="card"><h3>Authenticated User</h3><div class="kpi">{html.escape(state.get("usernames", {}).get("wordpress", "administrator"))}</div><div class="muted">Role: Administrator</div></div>
      </div>
      <div class="card"><h3>Operational Notes</h3><ul><li>Citizen portal theme cache pending flush.</li><li>XML-RPC calls throttled after repeated failures.</li><li>Backup export retained on internal volume.</li></ul></div>
    """
    return _decoy_layout(
        "WordPress Dashboard", body, accent="#3858e9", subtitle="Administration"
    )


def _admin_login_html(
    state: dict[str, Any], *, error: str = "", username: str = ""
) -> str:
    banner = f"<div class='banner error'>{html.escape(error)}</div>" if error else ""
    body = f"""
      <div class="row">
        <div class="card"><h3>Portal</h3><div class="kpi">Secure Operations</div><div class="muted">Access restricted to SOC staff</div></div>
        <div class="card"><h3>Observer Model</h3><div class="kpi">{html.escape(state.get("actor", "scanner"))}</div><div class="muted">Real-time deception telemetry</div></div>
      </div>
      {banner}
      <form method="post" action="/admin/login">
        <label>Username<input name="username" value="{html.escape(username)}"></label>
        <label>Password<input name="password" type="password"></label>
        <button type="submit">Access Portal</button>
      </form>
    """
    return _decoy_layout(
        "Secure Operations Portal",
        body,
        accent="#8b1e3f",
        subtitle="Administrative access",
    )


def _admin_portal_html(state: dict[str, Any]) -> str:
    body = f"""
      <div class="nav">
        <a href="/admin/portal">Overview</a>
        <a href="/phpmyadmin/index.php">Database</a>
        <a href="/phpmyadmin/intrusion.php">Intrusion Review</a>
      </div>
      <div class="row">
        <div class="card"><h3>Operator</h3><div class="kpi">{html.escape(state.get("usernames", {}).get("admin", "opsadmin"))}</div><div class="muted">Privilege: Incident commander</div></div>
        <div class="card"><h3>Cluster Health</h3><div class="kpi">89%</div><div class="muted">2 degraded alerts</div></div>
      </div>
      <div class="card"><h3>Pending Tasks</h3><ul><li>Rotate shared admin token after payroll import.</li><li>Review high-risk canary trigger from edge gateway.</li><li>Reconcile MariaDB replica drift on db-gateway-02.</li></ul></div>
    """
    return _decoy_layout(
        "Secure Operations Portal",
        body,
        accent="#8b1e3f",
        subtitle="Operational dashboard",
    )


def _public_decoy_event(
    request: Request,
    *,
    session_id: str,
    event_type: str,
    severity: str,
    score: float,
    mitre_tactic: str,
    mitre_technique: str,
    policy_strategy: str,
    policy_risk_score: float,
    captured_data: dict[str, Any] | None = None,
    url_path: str | None = None,
    attacker_type: str = "scanner",
) -> dict[str, Any]:
    with db() as conn:
        site_id = _resolve_public_site_id(conn, request)
    payload = {
        "source": "web-decoy",
        "host": _request_host(request),
        "user_agent": request.headers.get("user-agent", ""),
        **(captured_data or {}),
    }
    return store_event(
        site_id=site_id,
        session_id=session_id,
        event_type=event_type,
        severity=severity,
        score=score,
        ip=_request_ip(request),
        geo="Internet",
        url_path=url_path or request.url.path,
        http_method=request.method,
        cmd=None,
        attacker_type=attacker_type,
        reputation=min(99, max(12, int(score))),
        mitre_tactic=mitre_tactic,
        mitre_technique=mitre_technique,
        policy_strategy=policy_strategy,
        policy_risk_score=policy_risk_score,
        captured_data=payload,
    )


def _clean_analytics_text(value: Any, *, max_len: int = 255) -> str:
    normalized = re.sub(r"[\x00-\x1f\x7f]+", "", str(value or ""))
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return ""
    return normalized[:max_len]


def _analytics_payload_value(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload and payload.get(key) is not None:
            return payload.get(key)
    return None


def _normalize_analytics_event_name(value: Any) -> str:
    candidate = _clean_analytics_text(value, max_len=120).lower()
    candidate = re.sub(r"[^a-z0-9_./:-]+", "_", candidate).strip("_")
    return candidate or "unknown"


def _normalize_analytics_page_path(value: Any) -> str:
    candidate = _clean_analytics_text(value, max_len=255)
    if not candidate:
        return "/"
    if "://" in candidate:
        parsed = urlparse(candidate)
        candidate = parsed.path or "/"
    if not candidate.startswith("/"):
        candidate = f"/{candidate.lstrip('/')}"
    return candidate[:255]


def _normalize_analytics_properties(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    result: dict[str, Any] = {}
    for raw_key, raw_value in value.items():
        key = _clean_analytics_text(raw_key, max_len=80)
        if not key:
            continue
        if isinstance(raw_value, (int, float, bool)) or raw_value is None:
            result[key] = raw_value
        elif isinstance(raw_value, str):
            result[key] = _clean_analytics_text(raw_value, max_len=500)
        else:
            try:
                result[key] = _clean_analytics_text(json.dumps(raw_value), max_len=500)
            except TypeError:
                result[key] = _clean_analytics_text(raw_value, max_len=500)
    return result


def _build_analytics_record(
    payload: dict[str, Any], request: Request
) -> dict[str, Any]:
    event_name = _normalize_analytics_event_name(
        _analytics_payload_value(payload, "event_name", "name")
    )
    page_path = _normalize_analytics_page_path(
        _analytics_payload_value(payload, "page_path", "pagePath")
    )
    session_id = _clean_analytics_text(
        _analytics_payload_value(payload, "session_id", "sessionId"), max_len=120
    )
    source = (
        _clean_analytics_text(_analytics_payload_value(payload, "source"), max_len=64)
        or "frontend"
    )
    category = (
        _clean_analytics_text(
            _analytics_payload_value(payload, "event_category", "category"), max_len=64
        )
        or "frontend"
    )
    occurred_at_ms = _analytics_payload_value(payload, "occurred_at_ms", "occurredAtMs")
    try:
        occurred_at_ms = int(occurred_at_ms) if occurred_at_ms is not None else None
    except (TypeError, ValueError):
        occurred_at_ms = None
    return {
        "event_name": event_name,
        "page_path": page_path,
        "session_id": session_id,
        "source": source,
        "event_category": category,
        "occurred_at_ms": occurred_at_ms,
        "properties": _normalize_analytics_properties(payload.get("properties")),
        "host": _request_host(request),
        "source_ip": _request_ip(request),
        "user_agent": _clean_analytics_text(
            request.headers.get("user-agent", ""), max_len=500
        ),
        "referer": _clean_analytics_text(
            request.headers.get("referer", ""), max_len=500
        ),
        "origin": _clean_analytics_text(request.headers.get("origin", ""), max_len=255),
        "accept_language": _clean_analytics_text(
            request.headers.get("accept-language", ""), max_len=120
        ),
    }


def _analytics_event_profile(event_name: str) -> dict[str, Any]:
    if event_name == "cta_click":
        return {
            "event_type": "web_cta_click",
            "severity": "medium",
            "score": 36,
            "policy_strategy": "observe",
            "policy_risk_score": 32,
        }
    if event_name in {"page_engagement", "page_engagement_heartbeat"}:
        return {
            "event_type": "web_page_engagement",
            "severity": "low",
            "score": 18,
            "policy_strategy": "observe",
            "policy_risk_score": 16,
        }
    if event_name == "page_visit":
        return {
            "event_type": "web_page_visit",
            "severity": "low",
            "score": 10,
            "policy_strategy": "observe",
            "policy_risk_score": 10,
        }
    return {
        "event_type": "web_activity",
        "severity": "low",
        "score": 12,
        "policy_strategy": "observe",
        "policy_risk_score": 12,
    }


def _promote_analytics_event(
    request: Request, site_id: int | None, record: dict[str, Any], created_at: str
) -> dict[str, Any] | None:
    if site_id is None:
        return None
    profile = _analytics_event_profile(str(record.get("event_name") or "unknown"))
    payload = dict(record)
    payload["client_source"] = payload.get("source") or "frontend"
    payload["source"] = "frontend-analytics"
    return store_event(
        site_id=site_id,
        session_id=str(record.get("session_id") or "") or None,
        created_at=created_at,
        event_type=profile["event_type"],
        severity=profile["severity"],
        score=profile["score"],
        ip=_request_ip(request),
        geo="Internet",
        url_path=str(record.get("page_path") or "/"),
        http_method=request.method,
        cmd=None,
        attacker_type="visitor",
        reputation=min(40, max(1, int(profile["score"]))),
        mitre_tactic="Reconnaissance",
        mitre_technique="T1595",
        policy_strategy=profile["policy_strategy"],
        policy_risk_score=profile["policy_risk_score"],
        captured_data=payload,
    )


def _decoy_html_response(
    content: str, session_id: str, *, status_code: int = 200
) -> HTMLResponse:
    response = HTMLResponse(content=content, status_code=status_code)
    _set_web_decoy_cookie(response, session_id)
    return response


def _decoy_text_response(
    content: str, session_id: str, *, media_type: str, status_code: int = 200
) -> PlainTextResponse:
    response = PlainTextResponse(
        content=content, status_code=status_code, media_type=media_type
    )
    _set_web_decoy_cookie(response, session_id)
    return response


def _decoy_json_response(
    payload: Any, session_id: str, *, status_code: int = 200
) -> JSONResponse:
    response = JSONResponse(content=payload, status_code=status_code)
    _set_web_decoy_cookie(response, session_id)
    return response


def _decoy_redirect_response(
    location: str, session_id: str, *, status_code: int = 303
) -> RedirectResponse:
    response = RedirectResponse(url=location, status_code=status_code)
    _set_web_decoy_cookie(response, session_id)
    return response


def _serve_public_lure_file(request: Request, path: str):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, path)
    file_config = dict(WEB_DECOY_FILES[path])
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity=str(file_config["severity"]),
        score=float(file_config["score"]),
        mitre_tactic=str(file_config["mitre_tactic"]),
        mitre_technique=str(file_config["mitre_technique"]),
        policy_strategy=str(file_config["policy_strategy"]),
        policy_risk_score=float(file_config["policy_risk_score"]),
        captured_data={
            "surface": "lure_file",
            "file_path": path,
            "actor": state.get("actor"),
            "visited_paths": len(list(state.get("visited_paths") or [])),
        },
        url_path=path,
        attacker_type=str(state.get("actor") or "scanner"),
    )
    return _decoy_text_response(
        str(file_config["body"]),
        session_id,
        media_type=str(file_config["content_type"]),
    )


def _terminal_sessions(conn, user_id: int) -> dict[str, dict[str, Any]]:
    sessions = _json_setting(conn, "terminal_sessions", {}, user_id=user_id)
    return sessions if isinstance(sessions, dict) else {}


def _save_terminal_sessions(
    conn, user_id: int, sessions: dict[str, dict[str, Any]]
) -> None:
    ordered = sorted(
        sessions.items(),
        key=lambda item: item[1].get("last_updated") or "",
        reverse=True,
    )
    trimmed = dict(ordered[:12])
    _save_setting(conn, "terminal_sessions", trimmed, user_id=user_id)


def _terminal_transcript_entries(state: dict[str, Any]) -> list[dict[str, Any]]:
    entries = state.get("transcript")
    return list(entries) if isinstance(entries, list) else []


def _append_terminal_transcript(
    state: dict[str, Any],
    *,
    cmd: str,
    output: str,
    status: str,
    prompt: str,
    cwd: str,
    execution_mode: str,
) -> None:
    if not cmd:
        return
    entries = _terminal_transcript_entries(state)
    entries.append(
        {
            "ts": iso_now(),
            "cmd": cmd,
            "output": output,
            "status": status,
            "prompt": prompt,
            "cwd": cwd,
            "execution_mode": execution_mode,
        }
    )
    state["transcript"] = entries[-120:]


def _transcript_hash(entries: list[dict[str, Any]]) -> str:
    return stable_hash(json.dumps(entries, sort_keys=True), 32)


def _terminal_home(state: dict[str, Any]) -> str:
    return str(state.get("home") or "/home/admin")


def _terminal_prompt(state: dict[str, Any]) -> str:
    cwd = str(state.get("cwd") or _terminal_home(state))
    home = _terminal_home(state)
    display = (
        "~"
        if cwd == home
        else cwd.replace(f"{home}/", "~/", 1)
        if cwd.startswith(f"{home}/")
        else cwd
    )
    return f"{state.get('username', 'admin')}@{state.get('hostname', 'honeypot')}:{display}$"


def _terminal_session_state(session_id: str) -> dict[str, Any]:
    host = DEFAULT_TERMINAL_HOSTS[
        int(stable_hash(session_id, 2), 16) % len(DEFAULT_TERMINAL_HOSTS)
    ]
    files = dict(DEFAULT_TERMINAL_FILES)
    files["/etc/hostname"] = f"{host}\n"
    return {
        "session_id": session_id,
        "username": "admin",
        "hostname": host,
        "home": "/home/admin",
        "cwd": "/home/admin",
        "directories": list(DEFAULT_TERMINAL_DIRECTORIES),
        "files": files,
        "history": [],
        "last_updated": iso_now(),
    }


def _load_terminal_state(
    conn, user_id: int, requested_session_id: str | None
) -> tuple[str, dict[str, Any], dict[str, dict[str, Any]]]:
    sessions = _terminal_sessions(conn, user_id)
    session_id = requested_session_id or f"term-{uuid.uuid4().hex[:10]}"
    state = sessions.get(session_id)
    if not isinstance(state, dict):
        state = _terminal_session_state(session_id)
    state.setdefault("history", [])
    state.setdefault("files", dict(DEFAULT_TERMINAL_FILES))
    state.setdefault("directories", list(DEFAULT_TERMINAL_DIRECTORIES))
    state.setdefault("username", "admin")
    state.setdefault("hostname", DEFAULT_TERMINAL_HOSTS[0])
    state.setdefault("home", "/home/admin")
    state.setdefault("cwd", state["home"])
    state["session_id"] = session_id
    return session_id, state, sessions


def _terminal_normalize_path(state: dict[str, Any], raw_path: str | None) -> str:
    candidate = (raw_path or "").strip() or _terminal_home(state)
    if candidate == "~":
        candidate = _terminal_home(state)
    elif candidate.startswith("~/"):
        candidate = posixpath.join(_terminal_home(state), candidate[2:])
    elif not candidate.startswith("/"):
        candidate = posixpath.join(
            str(state.get("cwd") or _terminal_home(state)), candidate
        )
    normalized = posixpath.normpath(candidate)
    return normalized if normalized.startswith("/") else f"/{normalized}"


def _terminal_directory_exists(state: dict[str, Any], path: str) -> bool:
    return path in set(state.get("directories") or [])


def _terminal_file_exists(state: dict[str, Any], path: str) -> bool:
    return path in dict(state.get("files") or {})


def _terminal_list_directory(
    state: dict[str, Any], path: str, *, show_hidden: bool = False
) -> list[tuple[str, str]]:
    directories = set(state.get("directories") or [])
    files = dict(state.get("files") or {})
    if path not in directories:
        return []
    prefix = "/" if path == "/" else f"{path.rstrip('/')}/"
    items: dict[str, str] = {}
    for directory in directories:
        if directory == path or not directory.startswith(prefix):
            continue
        child = directory[len(prefix) :].split("/", 1)[0]
        if child:
            items[child] = "dir"
    for file_path in files:
        if not file_path.startswith(prefix):
            continue
        child = file_path[len(prefix) :].split("/", 1)[0]
        if child and child not in items:
            items[child] = "file"
    entries = sorted(items.items())
    if not show_hidden:
        entries = [entry for entry in entries if not entry[0].startswith(".")]
    return entries


def _terminal_add_directory(
    state: dict[str, Any], path: str, *, parents: bool = False
) -> bool:
    directories = set(state.get("directories") or [])
    if path in directories:
        state["directories"] = sorted(directories)
        return True
    parent = posixpath.dirname(path.rstrip("/")) or "/"
    if parent not in directories:
        if not parents:
            return False
        chain: list[str] = []
        current = path
        while current not in directories and current not in chain:
            chain.append(current)
            current = posixpath.dirname(current.rstrip("/")) or "/"
            if current == "/":
                chain.append("/")
                break
        directories.add("/")
        for item in reversed(chain):
            directories.add(item)
    else:
        directories.add(path)
    state["directories"] = sorted(directories)
    return True


def _terminal_write_file(
    state: dict[str, Any], path: str, content: str, *, append: bool = False
) -> bool:
    parent = posixpath.dirname(path.rstrip("/")) or "/"
    if not _terminal_directory_exists(state, parent):
        return False
    files = dict(state.get("files") or {})
    existing = str(files.get(path) or "")
    files[path] = f"{existing}{content}" if append else content
    state["files"] = files
    return True


def _terminal_remove_path(state: dict[str, Any], path: str) -> bool:
    files = dict(state.get("files") or {})
    directories = set(state.get("directories") or [])
    removed = False
    if path in files:
        files.pop(path, None)
        removed = True
    elif path in directories and path not in {"/", _terminal_home(state)}:
        prefix = f"{path.rstrip('/')}/"
        files = {
            key: value for key, value in files.items() if not key.startswith(prefix)
        }
        directories = {
            directory
            for directory in directories
            if directory != path and not directory.startswith(prefix)
        }
        removed = True
    state["files"] = files
    state["directories"] = sorted(directories)
    return removed


def _terminal_env(state: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"HOME={_terminal_home(state)}",
            f"HOSTNAME={state.get('hostname')}",
            "LANG=en_US.UTF-8",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "PWD=" + str(state.get("cwd") or _terminal_home(state)),
            "SHELL=/bin/bash",
            f"USER={state.get('username')}",
        ]
    )


def _terminal_process_table() -> str:
    return "\n".join(
        [
            "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND",
            "root         1  0.0  0.2 169812 11024 ?        Ss   08:10   0:02 /sbin/init",
            "root       842  0.1  0.4 229484 19020 ?        Ssl  08:11   0:04 /usr/sbin/sshd -D",
            "www-data  1324  0.0  0.6 286112 25240 ?        S    08:12   0:01 php-fpm: pool www",
            "mysql     1450  0.4  4.1 1547292 167800 ?      Ssl  08:12   0:18 /usr/sbin/mysqld",
            "admin     2258  0.0  0.1  13284  4820 pts/0    Ss   09:02   0:00 -bash",
        ]
    )


def _terminal_network_table() -> str:
    return "\n".join(
        [
            "Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process",
            "tcp   LISTEN 0      128    0.0.0.0:22       0.0.0.0:*       users:(('sshd',pid=842,fd=3))",
            "tcp   LISTEN 0      256    0.0.0.0:80       0.0.0.0:*       users:(('nginx',pid=1192,fd=6))",
            "tcp   LISTEN 0      128    127.0.0.1:3306   0.0.0.0:*       users:(('mysqld',pid=1450,fd=21))",
        ]
    )


def _terminal_assessment(cmd: str, output: str, status: str) -> dict[str, Any]:
    normalized = cmd.lower()
    vulnerabilities: list[dict[str, Any]] = []
    severity = "low"
    score = 28
    intent = "Environment reconnaissance"
    tactic = "Discovery"
    technique = "T1082"
    policy_strategy = "observe"
    risk = 28
    thought = "Low-noise command sequence suggests environmental validation."
    explanation = (
        "Command stayed within routine discovery boundaries and was safely emulated."
    )

    if any(
        token in normalized
        for token in [
            "/etc/passwd",
            "/etc/shadow",
            ".env",
            "id_rsa",
            "payroll",
            "mysql",
            "sudo",
        ]
    ):
        severity = "high"
        score = 86
        intent = "Credential discovery"
        tactic = "Credential Access"
        technique = "T1552"
        policy_strategy = "credential_sinkhole"
        risk = 84
        vulnerabilities.append(
            {"type": "Sensitive file enumeration", "severity": "High", "vector": cmd}
        )
        thought = "Command sequence pivoted from reconnaissance into credential-oriented discovery."
        explanation = "The shell trap detected attempts to access high-value secrets and switched to containment posture."
    elif any(
        token in normalized
        for token in ["curl", "wget", "netstat", "ss ", "ps ", "find ", "cat "]
    ):
        severity = "medium"
        score = 61
        intent = "Service and asset discovery"
        tactic = "Discovery"
        technique = "T1046"
        policy_strategy = "progressive_disclosure"
        risk = 58
        thought = "Attacker is mapping reachable services and local artifacts before privilege escalation."
        explanation = (
            "The command expands host visibility without directly modifying the system."
        )
    elif any(
        token in normalized for token in ["mkdir", "touch", "echo ", "rm ", "cd "]
    ):
        severity = "medium"
        score = 47
        intent = "Interactive environment shaping"
        tactic = "Execution"
        technique = "T1059"
        policy_strategy = "progressive_disclosure"
        risk = 46
        thought = "Interactive shell behavior indicates a human or advanced bot exploring persistence options."
        explanation = "The decoy shell accepted low-risk file and directory operations to sustain interaction."

    if status == "blocked":
        severity = "high"
        score = max(score, 88)
        risk = max(risk, 86)
        policy_strategy = "aggressive_containment"
        explanation = "Dangerous action was intercepted and reflected with a believable failure response."

    entropy = 0.78 if severity == "high" else 0.46 if severity == "medium" else 0.24
    return {
        "severity": severity,
        "score": score,
        "intent": intent,
        "mitre_tactic": tactic,
        "mitre_technique": technique,
        "policy_strategy": policy_strategy,
        "policy_risk_score": risk,
        "thought": thought,
        "explanation": explanation,
        "entropy": entropy,
        "vulnerabilities": vulnerabilities,
        "execution_status": status,
    }


# Security constants for input validation - SECURITY FIX
MAX_COMMAND_LENGTH = 1000
MAX_ARGS_COUNT = 100
MAX_ARG_LENGTH = 200

def _validate_terminal_command(cmd: str) -> tuple[bool, str]:
    """Validate terminal command for security and bounds checking - SECURITY FIX"""
    if not cmd:
        return False, "Empty command"
    
    if len(cmd) > MAX_COMMAND_LENGTH:
        return False, f"Command too long (max {MAX_COMMAND_LENGTH} characters)"
    
    args = cmd.split()
    if len(args) > MAX_ARGS_COUNT:
        return False, f"Too many arguments (max {MAX_ARGS_COUNT})"
    
    for arg in args:
        if len(arg) > MAX_ARG_LENGTH:
            return False, f"Argument too long (max {MAX_ARG_LENGTH} characters)"
    
    return True, "Valid command"

def _execute_terminal_command(state: dict[str, Any], command: str, source_ip: str | None = None) -> dict[str, Any]:
    """Execute terminal command with comprehensive security validation - SECURITY FIX"""
    stripped = command.strip()
    if not stripped:
        return {"output": "", "status": "ok"}
    
    # Validate command before execution - SECURITY FIX
    is_valid, error_msg = _validate_terminal_command(stripped)
    if not is_valid:
        # Log command validation failure - SECURITY AUDIT
        log_command_validation_failure(
            source_ip=source_ip or "unknown",
            command=stripped,
            reason=error_msg,
        )
        return {
            "output": f"bash: {error_msg}",
            "status": "error",
            "blocked": True,
            "reason": "Command validation failed"
        }

    redirect_match = re.match(r"^echo\s+(.+?)\s*(>>?)\s*(\S+)\s*$", stripped)
    if redirect_match:
        raw_value, operator, target = redirect_match.groups()
        content = raw_value.strip()
        if (content.startswith('"') and content.endswith('"')) or (
            content.startswith("'") and content.endswith("'")
        ):
            content = content[1:-1]
        path = _terminal_normalize_path(state, target)
        success = _terminal_write_file(
            state, path, f"{content}\n", append=operator == ">>"
        )
        if not success:
            return {
                "output": f"bash: {target}: No such file or directory",
                "status": "error",
            }
        return {"output": "", "status": "ok"}

    try:
        parts = shlex.split(stripped)
    except ValueError:
        return {"output": "bash: syntax error near unexpected token", "status": "error"}
    if not parts:
        return {"output": "", "status": "ok"}

    binary = parts[0]
    args = parts[1:]
    cwd = str(state.get("cwd") or _terminal_home(state))

    if binary == "pwd":
        return {"output": cwd, "status": "ok"}
    if binary == "whoami":
        return {"output": str(state.get("username") or "admin"), "status": "ok"}
    if binary == "hostname":
        return {"output": str(state.get("hostname") or "honeypot"), "status": "ok"}
    if binary == "id":
        return {
            "output": "uid=1000(admin) gid=1000(admin) groups=1000(admin),27(sudo),33(www-data)",
            "status": "ok",
        }
    if binary == "uname":
        if "-a" in args:
            return {
                "output": f"Linux {state.get('hostname')} 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux",
                "status": "ok",
            }
        return {"output": "Linux", "status": "ok"}
    if binary == "env":
        return {"output": _terminal_env(state), "status": "ok"}
    if binary == "ps":
        return {"output": _terminal_process_table(), "status": "ok"}
    if binary in {"ss", "netstat"}:
        return {"output": _terminal_network_table(), "status": "ok"}
    if binary == "history":
        history = state.get("history") or []
        output = (
            "\n".join(f"{index + 1:>4}  {entry}" for index, entry in enumerate(history))
            if history
            else ""
        )
        return {"output": output, "status": "ok"}
    if binary == "cd":
        destination = _terminal_normalize_path(
            state, args[0] if args else _terminal_home(state)
        )
        if not _terminal_directory_exists(state, destination):
            return {
                "output": f"bash: cd: {args[0] if args else destination}: No such file or directory",
                "status": "error",
            }
        state["cwd"] = destination
        return {"output": "", "status": "ok"}
    if binary == "ls":
        show_hidden = any(
            flag in {"-a", "-la", "-al"} for flag in args if flag.startswith("-")
        )
        long_view = any("l" in flag for flag in args if flag.startswith("-"))
        target_arg = next((item for item in args if not item.startswith("-")), cwd)
        target = _terminal_normalize_path(state, target_arg)
        if _terminal_file_exists(state, target):
            name = posixpath.basename(target)
            return {"output": name, "status": "ok"}
        if not _terminal_directory_exists(state, target):
            return {
                "output": f"ls: cannot access '{target_arg}': No such file or directory",
                "status": "error",
            }
        entries = _terminal_list_directory(state, target, show_hidden=show_hidden)
        if long_view:
            lines = []
            for name, item_type in entries:
                mode = "drwxr-xr-x" if item_type == "dir" else "-rw-r--r--"
                lines.append(f"{mode} 1 admin admin 4096 Mar 28 09:14 {name}")
            return {"output": "\n".join(lines), "status": "ok"}
        return {"output": "\n".join(name for name, _ in entries), "status": "ok"}
    if binary == "cat":
        if not args:
            return {"output": "cat: missing file operand", "status": "error"}
        path = _terminal_normalize_path(state, args[0])
        if path == "/etc/shadow":
            return {
                "output": "cat: /etc/shadow: Permission denied",
                "status": "blocked",
            }
        if _terminal_directory_exists(state, path):
            return {"output": f"cat: {args[0]}: Is a directory", "status": "error"}
        files = dict(state.get("files") or {})
        if path not in files:
            return {
                "output": f"cat: {args[0]}: No such file or directory",
                "status": "error",
            }
        return {"output": str(files[path]), "status": "ok"}
    if binary == "touch":
        if not args:
            return {"output": "touch: missing file operand", "status": "error"}
        path = _terminal_normalize_path(state, args[0])
        success = _terminal_write_file(
            state, path, str(dict(state.get("files") or {}).get(path, ""))
        )
        if not success:
            return {
                "output": f"touch: cannot touch '{args[0]}': No such file or directory",
                "status": "error",
            }
        return {"output": "", "status": "ok"}
    if binary == "mkdir":
        if not args:
            return {"output": "mkdir: missing operand", "status": "error"}
        parents = any(flag == "-p" for flag in args if flag.startswith("-"))
        target_arg = next((item for item in args if not item.startswith("-")), "")
        path = _terminal_normalize_path(state, target_arg)
        success = _terminal_add_directory(state, path, parents=parents)
        if not success:
            return {
                "output": f"mkdir: cannot create directory '{target_arg}': No such file or directory",
                "status": "error",
            }
        return {"output": "", "status": "ok"}
    if binary == "rm":
        if not args:
            return {"output": "rm: missing operand", "status": "error"}
        recursive = any(
            flag == "-r" or flag == "-rf" for flag in args if flag.startswith("-")
        )
        target_arg = next((item for item in args if not item.startswith("-")), "")
        path = _terminal_normalize_path(state, target_arg)
        if path.startswith("/etc") or path.startswith("/var/www/html/.env"):
            return {
                "output": f"rm: cannot remove '{target_arg}': Permission denied",
                "status": "blocked",
            }
        if _terminal_directory_exists(state, path) and not recursive:
            return {
                "output": f"rm: cannot remove '{target_arg}': Is a directory",
                "status": "error",
            }
        if not _terminal_remove_path(state, path):
            return {
                "output": f"rm: cannot remove '{target_arg}': No such file or directory",
                "status": "error",
            }
        return {"output": "", "status": "ok"}
    if binary == "curl":
        target = args[-1] if args else "http://127.0.0.1/"
        body = (
            "<html><title>Secure Operations Portal</title><body>login-required=true</body></html>"
            if "admin" in target or "127.0.0.1" in target
            else "curl: (7) Failed to connect"
        )
        return {
            "output": body,
            "status": "ok" if body.startswith("<html>") else "error",
        }
    if binary == "sudo":
        return {
            "output": f"Sorry, user {state.get('username', 'admin')} may not run sudo on {state.get('hostname', 'honeypot')}.",
            "status": "blocked",
        }
    if binary == "mysql":
        return {
            "output": "ERROR 1045 (28000): Access denied for user 'reporting'@'localhost' (using password: YES)",
            "status": "blocked",
        }

    return {"output": f"bash: {binary}: command not found", "status": "error"}


def _run_terminal_real_exec(session_id: str, cmd: str) -> dict[str, Any] | None:
    if not TERMINAL_REAL_EXEC_ENABLED or not TERMINAL_SANDBOX_URL:
        return None
    body = json.dumps({"session_id": session_id, "cmd": cmd}).encode("utf-8")
    request = urllib.request.Request(
        f"{TERMINAL_SANDBOX_URL.rstrip('/')}/exec",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(
            request, timeout=max(2, TERMINAL_EXEC_TIMEOUT_SEC + 1)
        ) as response:
            raw = response.read().decode("utf-8")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    output = str(payload.get("output") or "")
    if len(output) > TERMINAL_MAX_OUTPUT_CHARS:
        output = f"{output[:TERMINAL_MAX_OUTPUT_CHARS]}\n...[truncated]"
    status = str(payload.get("status") or "ok").strip().lower() or "ok"
    if status not in {"ok", "error", "blocked"}:
        status = "error"
    return {
        "session_id": str(payload.get("session_id") or session_id),
        "output": output,
        "prompt": str(payload.get("prompt") or "admin@honeypot:~$"),
        "cwd": str(payload.get("cwd") or "/home/admin"),
        "status": status,
        "execution_mode": "real",
        "engine": str(payload.get("engine") or "proot"),
    }


def _terminal_sandbox_health() -> dict[str, Any]:
    if not TERMINAL_REAL_EXEC_ENABLED or not TERMINAL_SANDBOX_URL:
        return {
            "enabled": False,
            "mode": "emulated",
            "healthy": True,
            "reachable": False,
            "engine": "emulated",
            "status": "disabled",
            "fallback": "emulated",
        }
    request = urllib.request.Request(
        f"{TERMINAL_SANDBOX_URL.rstrip('/')}/health", method="GET"
    )
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            raw = response.read().decode("utf-8")
        payload = json.loads(raw)
    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
        OSError,
        json.JSONDecodeError,
    ):
        return {
            "enabled": True,
            "mode": "hybrid",
            "healthy": False,
            "reachable": False,
            "engine": "unknown",
            "status": "unreachable",
            "fallback": "emulated",
        }
    if not isinstance(payload, dict):
        return {
            "enabled": True,
            "mode": "hybrid",
            "healthy": False,
            "reachable": False,
            "engine": "unknown",
            "status": "invalid",
            "fallback": "emulated",
        }
    status = str(payload.get("status") or "unknown")
    engine = str(payload.get("engine") or "unknown")
    return {
        "enabled": True,
        "mode": "hybrid",
        "healthy": status == "healthy",
        "reachable": True,
        "engine": engine,
        "status": status,
        "fallback": "emulated",
    }


def _ssh_listener_health() -> dict[str, Any]:
    if not PROTOCOL_SSH_AUTH_TRAP_ENABLED or not SSH_DECOY_HEALTH_URL:
        return {
            "enabled": False,
            "healthy": True,
            "reachable": False,
            "status": "disabled",
            "engine": "asyncssh",
        }
    request = urllib.request.Request(SSH_DECOY_HEALTH_URL.rstrip("/"), method="GET")
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            raw = response.read().decode("utf-8")
        payload = json.loads(raw)
    except (
        urllib.error.HTTPError,
        urllib.error.URLError,
        TimeoutError,
        OSError,
        json.JSONDecodeError,
    ):
        return {
            "enabled": True,
            "healthy": False,
            "reachable": False,
            "status": "unreachable",
            "engine": "asyncssh",
        }
    if not isinstance(payload, dict):
        return {
            "enabled": True,
            "healthy": False,
            "reachable": False,
            "status": "invalid",
            "engine": "asyncssh",
        }
    return {
        "enabled": True,
        "healthy": str(payload.get("status") or "") == "healthy",
        "reachable": True,
        "status": str(payload.get("status") or "unknown"),
        "engine": str(payload.get("engine") or "asyncssh"),
        "active_sessions": int(payload.get("active_sessions") or 0),
        "listen_host": payload.get("listen_host") or "0.0.0.0",
        "listen_port": int(payload.get("listen_port") or 0),
    }


def _site_ids_for_user(conn, user_id: int) -> list[int]:
    rows = conn.execute(
        "select id from sites where user_id = ? order by id asc", (user_id,)
    ).fetchall()
    return [int(row["id"]) for row in rows]


def _default_site_id_for_user(conn, user_id: int) -> int | None:
    row = conn.execute(
        "select id from sites where user_id = ? order by id desc limit 1", (user_id,)
    ).fetchone()
    return int(row["id"]) if row else None


def _site_owner_id(conn, site_id: int | None) -> int | None:
    if site_id is None:
        return None
    row = conn.execute(
        "select user_id from sites where id = ? limit 1", (site_id,)
    ).fetchone()
    if not row or row["user_id"] is None:
        return None
    return int(row["user_id"])


def _site_scope_clause(
    site_ids: list[int], *, column: str = "site_id"
) -> tuple[str, tuple[Any, ...]]:
    if not site_ids:
        return "1 = 0", ()
    placeholders = ", ".join("?" for _ in site_ids)
    return f"{column} in ({placeholders})", tuple(site_ids)


def _sample_incident_rows(
    *,
    limit: int,
    order: str = "desc",
    offset: int = 0,
    session_id: str | None = None,
    ip: str | None = None,
) -> list[dict[str, Any]]:
    now = utc_now()
    rows: list[dict[str, Any]] = []
    for index, template in enumerate(SAMPLE_INCIDENT_TEMPLATES):
        created_at = (now - timedelta(minutes=int(template["minutes_ago"]))).isoformat()
        row = normalize_event(
            {
                "id": 900000 + index + 1,
                "site_id": 0,
                "session_id": template["session_id"],
                "event_type": template["event_type"],
                "severity": template["severity"],
                "score": template["score"],
                "ip": template["ip"],
                "geo": template["geo"],
                "url_path": template["url_path"],
                "http_method": template["http_method"],
                "cmd": template["cmd"],
                "attacker_type": template["attacker_type"],
                "reputation": template["reputation"],
                "mitre_tactic": template["mitre_tactic"],
                "mitre_technique": template["mitre_technique"],
                "policy_strategy": template["policy_strategy"],
                "policy_risk_score": template["policy_risk_score"],
                "captured_data": dict(template.get("captured_data") or {}),
                "created_at": created_at,
                "demo_mode": True,
                "sample_incident": True,
            }
        )
        rows.append(row)
    if session_id is not None:
        rows = [row for row in rows if row.get("session_id") == session_id]
    if ip is not None:
        rows = [row for row in rows if row.get("ip") == ip]
    rows.sort(
        key=lambda item: str(item.get("created_at") or ""), reverse=order != "asc"
    )
    if offset:
        rows = rows[offset:]
    return rows[:limit]


def _event_summary_from_rows(
    rows: list[dict[str, Any]], *, blocked: int = 0
) -> dict[str, Any]:
    feed = [normalize_event(row) for row in rows]
    trap_distribution: dict[str, int] = {}
    mitre_distribution: dict[str, int] = {}
    live_sessions = set()
    unique_ips = set()
    for row in feed:
        target = row.get("url_path") or row.get("event_type") or "unknown"
        trap_distribution[target] = trap_distribution.get(target, 0) + 1
        tactic = row.get("mitre_tactic") or "Reconnaissance"
        mitre_distribution[tactic] = mitre_distribution.get(tactic, 0) + 1
        if row.get("session_id"):
            live_sessions.add(row["session_id"])
        if row.get("ip"):
            unique_ips.add(row["ip"])
    return {
        "summary": {
            "total": len(feed),
            "critical": sum(1 for row in feed if row.get("severity") == "high"),
            "blocked": blocked,
            "live_sessions": len(live_sessions),
            "unique_ips": len(unique_ips),
        },
        "feed": feed,
        "trap_distribution": trap_distribution,
        "mitre_distribution": mitre_distribution,
    }


def _session_items_from_rows(
    rows: list[dict[str, Any]], *, limit: int
) -> list[dict[str, Any]]:
    sessions: dict[str, dict[str, Any]] = {}
    for row in rows:
        session_key = str(row.get("session_id") or "")
        if not session_key:
            continue
        existing = sessions.setdefault(
            session_key,
            {
                "session_id": session_key,
                "severity_rank": 0,
                "event_count": 0,
                "max_score": 0,
                "last_seen": row.get("created_at"),
            },
        )
        existing["event_count"] += 1
        existing["max_score"] = max(
            float(existing["max_score"]), float(row.get("score") or 0)
        )
        existing["last_seen"] = max(
            str(existing.get("last_seen") or ""), str(row.get("created_at") or "")
        )
        severity_rank = (
            3
            if row.get("severity") == "high"
            else 2
            if row.get("severity") == "medium"
            else 1
        )
        existing["severity_rank"] = max(int(existing["severity_rank"]), severity_rank)
    items = []
    for row in sorted(
        sessions.values(), key=lambda item: str(item["last_seen"]), reverse=True
    )[:limit]:
        rank = int(row["severity_rank"])
        severity = "high" if rank == 3 else "medium" if rank == 2 else "low"
        items.append(
            {
                "session_id": row["session_id"],
                "severity": severity,
                "event_count": row["event_count"],
                "max_score": row["max_score"],
                "last_seen": row["last_seen"],
            }
        )
    return items


def _scoped_event_rows(
    conn,
    site_ids: list[int],
    *,
    limit: int,
    order: str = "desc",
    offset: int = 0,
    session_id: str | None = None,
    ip: str | None = None,
    allow_demo_fallback: bool = True,
) -> list[dict[str, Any]]:
    clause, site_params = _site_scope_clause(site_ids)
    filters = [clause]
    params: list[Any] = list(site_params)
    if session_id is not None:
        filters.append("session_id = ?")
        params.append(session_id)
    if ip is not None:
        filters.append("ip = ?")
        params.append(ip)
    query = f"select * from events where {' and '.join(filters)} order by datetime(created_at) {'asc' if order == 'asc' else 'desc'} limit ?"
    params.append(limit)
    if offset:
        query += " offset ?"
        params.append(offset)
    rows = [
        normalize_event(row) for row in conn.execute(query, tuple(params)).fetchall()
    ]
    if rows or not allow_demo_fallback or site_ids:
        return rows
    return _sample_incident_rows(
        limit=limit, order=order, offset=offset, session_id=session_id, ip=ip
    )


def _scoped_event_count(
    conn,
    site_ids: list[int],
    *,
    ip: str | None = None,
    allow_demo_fallback: bool = True,
) -> int:
    clause, site_params = _site_scope_clause(site_ids)
    filters = [clause]
    params: list[Any] = list(site_params)
    if ip is not None:
        filters.append("ip = ?")
        params.append(ip)
    row = conn.execute(
        f"select count(*) as count from events where {' and '.join(filters)}",
        tuple(params),
    ).fetchone()
    count = int(row["count"] or 0)
    if count or not allow_demo_fallback or site_ids:
        return count
    return len(_sample_incident_rows(limit=len(SAMPLE_INCIDENT_TEMPLATES), ip=ip))


def _scoped_session_rows(
    conn, site_ids: list[int], session_id: str
) -> list[dict[str, Any]]:
    return _scoped_event_rows(
        conn, site_ids, limit=500, order="asc", session_id=session_id
    )


def _blocked_ip_count(conn, user_id: int) -> int:
    row = conn.execute(
        "select count(*) as count from blocked_ips where user_id = ?", (user_id,)
    ).fetchone()
    return int(row["count"] or 0)


def _blocked_ip_lookup(conn, user_id: int) -> set[str]:
    return {
        row["ip"]
        for row in conn.execute(
            "select ip from blocked_ips where user_id = ?", (user_id,)
        ).fetchall()
    }


def _blocked_ip_rows(conn, user_id: int) -> list[dict[str, Any]]:
    return [
        {"ip": row["ip"], "reason": row["reason"], "created_at": row["created_at"]}
        for row in conn.execute(
            "select ip, reason, created_at from blocked_ips where user_id = ? order by datetime(created_at) desc, ip asc",
            (user_id,),
        ).fetchall()
    ]


def _canonical_edge_ip(value: Any) -> str | None:
    candidate = str(value or "").strip()
    if not candidate:
        return None
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return None


def _edge_block_entries(conn, user_id: int) -> tuple[list[dict[str, Any]], int]:
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()
    invalid_entries = 0
    for row in _blocked_ip_rows(conn, user_id):
        ip = _canonical_edge_ip(row.get("ip"))
        if not ip:
            invalid_entries += 1
            continue
        if ip in seen:
            continue
        seen.add(ip)
        entries.append(
            {
                "ip": ip,
                "reason": str(row.get("reason") or "").strip(),
                "created_at": row.get("created_at") or "",
            }
        )
    return entries, invalid_entries


def _edge_reason_comment(value: Any) -> str:
    text = " ".join(str(value or "").replace("\r", " ").replace("\n", " ").split())
    return text[:160]


def _render_edge_block_export(
    entries: list[dict[str, Any]], export_format: str
) -> tuple[str, str]:
    normalized = str(export_format or "").strip().lower()
    generated_at = iso_now()
    if normalized == "plain":
        body = "".join(f"{item['ip']}\n" for item in entries)
        return body, "text/plain; charset=utf-8"
    if normalized == "nginx":
        lines = [
            "# CyberSentil edge block export",
            f"# generated_at: {generated_at}",
            f"# total_blocked_ips: {len(entries)}",
        ]
        for item in entries:
            reason = _edge_reason_comment(item.get("reason"))
            created_at = str(item.get("created_at") or "")
            if reason or created_at:
                lines.append(
                    f"# {item['ip']} | reason={reason or 'manual'} | created_at={created_at or 'n/a'}"
                )
            lines.append(f"deny {item['ip']};")
        return "\n".join(lines).rstrip() + "\n", "text/plain; charset=utf-8"
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported export format. Use one of: {', '.join(sorted(EDGE_BLOCK_EXPORT_FORMATS))}.",
    )


def _canary_counts(conn, user_id: int) -> dict[str, int]:
    row = conn.execute(
        """
        select count(*) as total, coalesce(sum(case when triggered = 1 then 1 else 0 end), 0) as triggered
        from canary_tokens
        where user_id = ?
        """,
        (user_id,),
    ).fetchone()
    return {"total": int(row["total"] or 0), "triggered": int(row["triggered"] or 0)}


def _json_setting(conn, key: str, default: Any, *, user_id: int | None = None) -> Any:
    row = None
    if user_id is not None:
        row = conn.execute(
            "select value from runtime_settings where user_id = ? and key = ? order by datetime(updated_at) desc limit 1",
            (user_id, key),
        ).fetchone()
    if not row:
        row = conn.execute(
            "select value from runtime_settings where user_id is null and key = ? order by datetime(updated_at) desc limit 1",
            (key,),
        ).fetchone()
    if not row:
        return default
    try:
        return json.loads(row["value"])
    except Exception:
        return default


def _save_setting(conn, key: str, value: Any, *, user_id: int) -> None:
    now = iso_now()
    conn.execute(
        """
        insert into runtime_settings (user_id, key, value, updated_at) values (?, ?, ?, ?)
        on conflict(user_id, key) do update set value = excluded.value, updated_at = excluded.updated_at
        """,
        (user_id, key, json.dumps(value), now),
    )


def _merge_protocols(value: Any) -> dict[str, bool]:
    merged = dict(DEFAULT_DECEPTION_PROTOCOLS)
    if isinstance(value, dict):
        for key, default in DEFAULT_DECEPTION_PROTOCOLS.items():
            if key in value:
                merged[key] = bool(value[key])
    return merged


def _merge_runtime_modules(value: Any) -> dict[str, dict[str, Any]]:
    merged = {
        name: {
            **config,
            "enabled": bool(config["enabled"]),
        }
        for name, config in DEFAULT_RUNTIME_MODULES.items()
    }
    if isinstance(value, dict):
        for name, state in value.items():
            if name in merged and isinstance(state, dict):
                merged[name].update(state)
                merged[name]["enabled"] = bool(merged[name].get("enabled"))
    return merged


def _module_for_event(row: dict[str, Any]) -> str:
    event_type = str(row.get("event_type") or "").lower()
    url_path = str(row.get("url_path") or "").lower()
    cmd = str(row.get("cmd") or "").lower()
    protocol = str((row.get("captured_data") or {}).get("protocol") or "").lower()
    if "mysql" in event_type or "mysql" in url_path:
        return "mysql"
    if protocol == "ssh" or event_type.startswith("ssh_"):
        return "ssh"
    if cmd or event_type == "shell_command":
        return "ssh"
    if url_path or event_type == "http_probe" or event_type == "canary_trigger":
        return "http"
    return "http"


def _profile_for_rows(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return "defensive"
    critical = sum(1 for row in rows if row["severity"] == "high")
    avg_risk = sum(
        float(row.get("policy_risk_score") or row.get("score") or 0) for row in rows
    ) / max(len(rows), 1)
    if critical >= 3 or avg_risk >= 78:
        return "aggressive"
    if critical >= 1 or avg_risk >= 45 or len(rows) >= 6:
        return "balanced"
    return "defensive"


def _format_duration(delta: timedelta) -> str:
    total_seconds = max(0, int(delta.total_seconds()))
    days, rem = divmod(total_seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)
    if days:
        return f"{days}d {hours}h"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def _parse_event_time(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _correlate_campaigns(
    rows: list[dict[str, Any]],
    blocked_lookup: set[str] | None = None,
    *,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    blocked_lookup = blocked_lookup or set()
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        ip = str(row.get("ip") or "").strip()
        if not ip or ip == "unknown":
            continue
        captured = row.get("captured_data") or {}
        surface = str(
            captured.get("surface")
            or row.get("url_path")
            or row.get("event_type")
            or "unknown"
        )
        event_type = str(row.get("event_type") or "unknown")
        timestamp = _parse_event_time(row.get("created_at"))
        item = grouped.setdefault(
            ip,
            {
                "ip": ip,
                "session_id": row.get("session_id"),
                "geo": row.get("geo") or "Global",
                "event_count": 0,
                "max_score": 0.0,
                "high_risk_events": 0,
                "credential_attempts": 0,
                "accepted_credentials": 0,
                "interactive_events": 0,
                "sessions": set(),
                "surfaces": set(),
                "surface_counts": {},
                "event_types": {},
                "tactic_counts": {},
                "attacker_types": {},
                "first_seen": timestamp,
                "last_seen": timestamp,
                "first_seen_raw": row.get("created_at"),
                "last_seen_raw": row.get("created_at"),
            },
        )
        item["event_count"] += 1
        item["max_score"] = max(item["max_score"], float(row.get("score") or 0))
        if row.get("severity") == "high" or float(row.get("score") or 0) >= 80:
            item["high_risk_events"] += 1
        if event_type == "credential_attempt":
            item["credential_attempts"] += 1
        if bool(captured.get("accepted")):
            item["accepted_credentials"] += 1
        if row.get("cmd") or event_type in {
            "credential_attempt",
            "sql_query",
            "xmlrpc_call",
            "shell_command",
            "ssh_auth",
            "ssh_command",
        }:
            item["interactive_events"] += 1
        if row.get("session_id"):
            item["sessions"].add(row["session_id"])
            item["session_id"] = item["session_id"] or row.get("session_id")
        item["surfaces"].add(surface)
        item["surface_counts"][surface] = (
            int(item["surface_counts"].get(surface, 0)) + 1
        )
        item["event_types"][event_type] = (
            int(item["event_types"].get(event_type, 0)) + 1
        )
        tactic = str(row.get("mitre_tactic") or "Reconnaissance")
        item["tactic_counts"][tactic] = int(item["tactic_counts"].get(tactic, 0)) + 1
        attacker_type = str(row.get("attacker_type") or "unknown")
        item["attacker_types"][attacker_type] = (
            int(item["attacker_types"].get(attacker_type, 0)) + 1
        )
        if timestamp is not None:
            if item["first_seen"] is None or timestamp < item["first_seen"]:
                item["first_seen"] = timestamp
                item["first_seen_raw"] = row.get("created_at")
            if item["last_seen"] is None or timestamp > item["last_seen"]:
                item["last_seen"] = timestamp
                item["last_seen_raw"] = row.get("created_at")

    label_map = {
        "credential_spray": "Credential Spray",
        "multi_surface_recon": "Multi-Surface Recon",
        "interactive_intrusion": "Interactive Intrusion",
        "persistent_scanner": "Persistent Scanner",
        "targeted_probe": "Targeted Probe",
    }
    campaigns: list[dict[str, Any]] = []
    for item in grouped.values():
        surface_count = len(item["surfaces"])
        session_count = len(item["sessions"])
        blocked = item["ip"] in blocked_lookup
        if item["accepted_credentials"] >= 1 or (
            item["interactive_events"] >= 4 and item["max_score"] >= 82
        ):
            campaign_type = "interactive_intrusion"
        elif item["credential_attempts"] >= 3 and surface_count >= 2:
            campaign_type = "credential_spray"
        elif surface_count >= 4 or (surface_count >= 3 and item["event_count"] >= 5):
            campaign_type = "multi_surface_recon"
        elif item["event_count"] >= 5 or session_count >= 3:
            campaign_type = "persistent_scanner"
        else:
            campaign_type = "targeted_probe"
        confidence = min(
            99,
            int(
                32
                + item["max_score"] * 0.38
                + min(surface_count, 6) * 6
                + min(item["credential_attempts"], 5) * 8
                + min(item["interactive_events"], 6) * 5
                + min(item["event_count"], 10) * 2
                + (10 if blocked else 0)
            ),
        )
        severity = (
            "high"
            if item["high_risk_events"] >= 1 or item["max_score"] >= 80
            else "medium"
            if item["event_count"] >= 2
            else "low"
        )
        primary_surface = max(
            item["surface_counts"].items(), key=lambda current: (current[1], current[0])
        )[0]
        primary_tactic = max(
            item["tactic_counts"].items(), key=lambda current: (current[1], current[0])
        )[0]
        primary_type = max(
            item["attacker_types"].items(), key=lambda current: (current[1], current[0])
        )[0]
        first_seen = item["first_seen_raw"] or ""
        last_seen = item["last_seen_raw"] or ""
        duration = (
            _format_duration(item["last_seen"] - item["first_seen"])
            if item["first_seen"] is not None and item["last_seen"] is not None
            else f"{item['event_count']} events"
        )
        if blocked:
            recommended_action = "monitor_block"
        elif (
            campaign_type in {"interactive_intrusion", "credential_spray"}
            and confidence >= 78
        ):
            recommended_action = "block_and_sinkhole"
        elif campaign_type == "multi_surface_recon":
            recommended_action = "escalate_decoys"
        elif campaign_type == "persistent_scanner":
            recommended_action = "observe_and_profile"
        else:
            recommended_action = "monitor"
        campaigns.append(
            {
                "ip": item["ip"],
                "session_id": item["session_id"],
                "geo": item["geo"],
                "campaign_type": campaign_type,
                "label": label_map[campaign_type],
                "confidence": confidence,
                "severity": severity,
                "event_count": item["event_count"],
                "surface_count": surface_count,
                "session_count": session_count,
                "credential_attempts": item["credential_attempts"],
                "interactive_events": item["interactive_events"],
                "accepted_credentials": item["accepted_credentials"],
                "primary_surface": primary_surface,
                "primary_tactic": primary_tactic,
                "attacker_type": primary_type,
                "recommended_action": recommended_action,
                "first_seen": first_seen,
                "last_seen": last_seen,
                "duration": duration,
                "blocked": blocked,
                "max_score": round(float(item["max_score"]), 1),
            }
        )
    priority = {
        "interactive_intrusion": 5,
        "credential_spray": 4,
        "multi_surface_recon": 3,
        "persistent_scanner": 2,
        "targeted_probe": 1,
    }
    campaigns.sort(
        key=lambda current: (
            priority.get(str(current["campaign_type"]), 0),
            int(current["confidence"]),
            int(current["event_count"]),
            float(current["max_score"]),
        ),
        reverse=True,
    )
    return campaigns[:limit] if limit is not None else campaigns


def _block_ip_exists(conn, user_id: int, ip: str) -> bool:
    return (
        conn.execute(
            "select 1 from blocked_ips where user_id = ? and ip = ? limit 1",
            (user_id, ip),
        ).fetchone()
        is not None
    )


def _insert_blocked_ip(
    conn, *, user_id: int, ip: str, reason: str, created_at: str | None = None
) -> bool:
    normalized_ip = ip.strip()
    if not normalized_ip:
        return False
    if _block_ip_exists(conn, user_id, normalized_ip):
        return False
    conn.execute(
        """
        insert into blocked_ips (user_id, ip, reason, created_at)
        values (?, ?, ?, ?)
        on conflict(user_id, ip) do nothing
        """,
        (user_id, normalized_ip, reason, created_at or iso_now()),
    )
    return True


def _event_supports_auto_response(row: dict[str, Any]) -> bool:
    captured = row.get("captured_data") or {}
    if bool(captured.get("simulated")):
        return False
    if (
        bool(captured.get("terminal"))
        and str(captured.get("source") or "") != "protocol-decoy"
    ):
        return False
    return True


def _maybe_apply_auto_response(conn, row: dict[str, Any]) -> dict[str, Any] | None:
    ip = str(row.get("ip") or "").strip()
    if not ip or ip == "unknown" or not _event_supports_auto_response(row):
        return None
    user_id = _site_owner_id(conn, row.get("site_id"))
    if user_id is None:
        return None
    if not bool(_json_setting(conn, "auto_mode", False, user_id=user_id)):
        return None
    site_ids = _site_ids_for_user(conn, user_id)
    if not site_ids:
        return None
    blocked_lookup = _blocked_ip_lookup(conn, user_id)
    recent_rows = _scoped_event_rows(
        conn, site_ids, limit=AUTO_RESPONSE_EVENT_LIMIT, ip=ip
    )
    campaigns = _correlate_campaigns(recent_rows, blocked_lookup, limit=1)
    if not campaigns:
        return None
    campaign = campaigns[0]
    if (
        campaign["recommended_action"] != "block_and_sinkhole"
        or int(campaign["confidence"]) < AUTO_RESPONSE_BLOCK_CONFIDENCE
        or ip in blocked_lookup
    ):
        return {
            "enabled": True,
            "action": "observe",
            "campaign_type": campaign["campaign_type"],
            "confidence": int(campaign["confidence"]),
            "blocked": ip in blocked_lookup,
        }
    reason = f"{AUTO_RESPONSE_REASON_PREFIX}{campaign['campaign_type']}"
    blocked = _insert_blocked_ip(
        conn, user_id=user_id, ip=ip, reason=reason, created_at=iso_now()
    )
    return {
        "enabled": True,
        "action": "block_and_sinkhole",
        "campaign_type": campaign["campaign_type"],
        "confidence": int(campaign["confidence"]),
        "blocked": blocked,
        "reason": reason,
    }


def _build_posture(
    rows: list[dict[str, Any]], active_profile: str, protocols: dict[str, bool]
) -> dict[str, Any]:
    total = len(rows)
    critical = sum(1 for row in rows if row["severity"] == "high")
    unique_targets = len({row.get("url_path") or row.get("event_type") for row in rows})
    noise_floor = min(99, max(5, total * 5))
    trigger_density = min(99, critical * 20 + unique_targets * 6)
    cover_story_strength = 90 if protocols.get("honeyfile_generation") else 65
    signal_strength = min(99, 25 + critical * 15 + total * 4)
    return {
        "mode": active_profile,
        "signal_strength": signal_strength,
        "noise_floor": noise_floor,
        "trigger_density": trigger_density,
        "cover_story_strength": cover_story_strength,
        "recommended_profile": _profile_for_rows(rows),
    }


def _build_runtime_state(
    conn, rows: list[dict[str, Any]], *, user_id: int | None = None
) -> dict[str, Any]:
    persisted_modules = _merge_runtime_modules(
        _json_setting(
            conn, "protocol_runtime_modules", DEFAULT_RUNTIME_MODULES, user_id=user_id
        )
    )
    metrics: dict[str, dict[str, Any]] = {}
    alerts: list[dict[str, Any]] = []
    blocked_lookup = _blocked_ip_lookup(conn, user_id) if user_id is not None else set()
    now = utc_now()
    terminal_exec = _terminal_sandbox_health()
    ssh_listener = _ssh_listener_health()
    for name, module in persisted_modules.items():
        module_rows = [row for row in rows if _module_for_event(row) == name]
        active_sessions = len(
            {row["session_id"] for row in module_rows if row.get("session_id")}
        )
        severity_count = sum(1 for row in module_rows if row["severity"] == "high")
        p95_latency = min(
            1800,
            30
            + len(module_rows) * 12
            + severity_count * 35
            + (5 if module["enabled"] else 0),
        )
        errors_total = sum(
            1 for row in module_rows if float(row.get("score") or 0) >= 85
        )
        healthy = True if not module["enabled"] else errors_total < 4
        running = bool(module["enabled"]) and healthy
        if name == "ssh":
            module["listener"] = ssh_listener
            if module["enabled"] and not ssh_listener["healthy"]:
                healthy = False
                running = False
        metrics[name] = {
            "events_total": len(module_rows),
            "active_sessions": ssh_listener.get("active_sessions", active_sessions)
            if name == "ssh"
            else active_sessions,
            "p95_latency_ms": p95_latency,
            "errors_total": errors_total,
        }
        module.update(
            {
                "healthy": healthy,
                "running": running,
                "active_sessions": ssh_listener.get("active_sessions", active_sessions)
                if name == "ssh"
                else active_sessions,
                "last_updated": now.isoformat(),
            }
        )
        if module["enabled"] and not healthy:
            alerts.append(
                {
                    "module": name,
                    "severity": "high",
                    "message": f"{name.upper()} runtime is experiencing elevated suspicious load.",
                    "timestamp": iso_now(),
                }
            )
    if ssh_listener["enabled"] and not ssh_listener["healthy"]:
        alerts.append(
            {
                "module": "ssh_listener",
                "severity": "high",
                "message": "SSH decoy listener is enabled but unreachable.",
                "timestamp": iso_now(),
            }
        )
    summary = {
        "registered": len(persisted_modules),
        "enabled": sum(1 for module in persisted_modules.values() if module["enabled"]),
        "running": sum(1 for module in persisted_modules.values() if module["running"]),
        "unhealthy": [
            name
            for name, module in persisted_modules.items()
            if module["enabled"] and not module["healthy"]
        ],
    }
    if terminal_exec["enabled"] and not terminal_exec["healthy"]:
        alerts.append(
            {
                "module": "terminal_exec",
                "severity": "medium",
                "message": "Real terminal sandbox unavailable. Falling back to emulated shell responses.",
                "timestamp": iso_now(),
            }
        )
    for campaign in _correlate_campaigns(rows, blocked_lookup, limit=3):
        if campaign["confidence"] < 78 and campaign["campaign_type"] not in {
            "credential_spray",
            "interactive_intrusion",
        }:
            continue
        alerts.append(
            {
                "module": f"campaign:{campaign['ip']}",
                "severity": campaign["severity"],
                "message": f"{campaign['label']} detected from {campaign['ip']} across {campaign['surface_count']} surfaces.",
                "timestamp": campaign["last_seen"] or iso_now(),
            }
        )
    return {
        "summary": summary,
        "modules": persisted_modules,
        "metrics": {"protocols": metrics},
        "alerts": alerts[:12],
        "persistence": {
            "state_file": f"sqlite:runtime_settings[{user_id if user_id is not None else 'global'}].protocol_runtime_modules",
            "state_loaded": True,
            "terminal_exec": terminal_exec,
            "ssh_listener": ssh_listener,
        },
    }


def _session_meta(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    metadata: dict[str, dict[str, Any]] = {}
    for row in rows:
        session_id = row.get("session_id")
        if session_id and session_id not in metadata:
            metadata[session_id] = row
    return metadata


def _transcript_entries_from_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for row in rows:
        captured = row.get("captured_data") or {}
        if not row.get("cmd"):
            continue
        entries.append(
            {
                "ts": row.get("created_at"),
                "cmd": row.get("cmd"),
                "output": str(captured.get("output") or ""),
                "status": str(captured.get("status") or "ok"),
                "prompt": str(captured.get("prompt") or ""),
                "cwd": str(captured.get("cwd") or ""),
                "execution_mode": str(
                    captured.get("execution_mode")
                    or ("real" if captured.get("sandboxed") else "emulated")
                ),
            }
        )
    return entries


def _terminal_transcript_artifacts(
    conn, user_id: int, rows: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    session_meta = _session_meta(rows)
    artifacts: list[dict[str, Any]] = []
    for session_id, state in _terminal_sessions(conn, user_id).items():
        entries = _terminal_transcript_entries(state)
        if not entries:
            continue
        meta = session_meta.get(session_id, {})
        transcript_json = json.dumps(entries, sort_keys=True)
        artifacts.append(
            {
                "name": f"transcript_{session_id}.json",
                "kind": "Session Transcript",
                "type": "transcript",
                "session_id": session_id,
                "ip": meta.get("ip"),
                "first_seen": entries[0]["ts"],
                "last_seen": entries[-1]["ts"],
                "hash": _transcript_hash(entries),
                "summary": f"{len(entries)} commands captured ({', '.join(sorted({entry['execution_mode'] for entry in entries}))})",
                "size_bytes": len(transcript_json.encode("utf-8")),
            }
        )
    for session_id, session_rows in {
        row.get("session_id"): [
            entry for entry in rows if entry.get("session_id") == row.get("session_id")
        ]
        for row in rows
        if row.get("session_id")
    }.items():
        if not session_id:
            continue
        entries = _transcript_entries_from_rows(session_rows)
        if not entries or any(item["session_id"] == session_id for item in artifacts):
            continue
        meta = session_meta.get(session_id, {})
        transcript_json = json.dumps(entries, sort_keys=True)
        artifacts.append(
            {
                "name": f"transcript_{session_id}.json",
                "kind": "Session Transcript",
                "type": "transcript",
                "session_id": session_id,
                "ip": meta.get("ip"),
                "first_seen": entries[0]["ts"],
                "last_seen": entries[-1]["ts"],
                "hash": _transcript_hash(entries),
                "summary": f"{len(entries)} commands reconstructed from telemetry",
                "size_bytes": len(transcript_json.encode("utf-8")),
            }
        )
    artifacts.sort(key=lambda item: item.get("last_seen") or "", reverse=True)
    return artifacts


def _session_rows(conn, session_id: str) -> list[dict[str, Any]]:
    return [
        normalize_event(row)
        for row in conn.execute(
            "select * from events where session_id = ? order by datetime(created_at) asc",
            (session_id,),
        ).fetchall()
    ]


def _save_runtime_state(
    conn,
    *,
    user_id: int,
    active_profile: str | None = None,
    protocols: dict[str, bool] | None = None,
    auto_mode: bool | None = None,
    runtime_modules: dict[str, Any] | None = None,
) -> None:
    if active_profile is not None:
        _save_setting(conn, "active_profile", active_profile, user_id=user_id)
    if protocols is not None:
        _save_setting(
            conn, "deception_protocols", _merge_protocols(protocols), user_id=user_id
        )
    if auto_mode is not None:
        _save_setting(conn, "auto_mode", bool(auto_mode), user_id=user_id)
    if runtime_modules is not None:
        _save_setting(
            conn,
            "protocol_runtime_modules",
            _merge_runtime_modules(runtime_modules),
            user_id=user_id,
        )


def _serialize_canary(row: dict[str, Any]) -> dict[str, Any]:
    triggered = bool(row.get("triggered"))
    result = {
        "id": row["id"],
        "label": row["label"],
        "type": row["token_type"],
        "url": row["relative_path"],
        "triggered": triggered,
        "created_at": row["created_at"],
    }
    if triggered:
        result["triggered_by"] = {
            "ip": row.get("triggered_ip") or "unknown",
            "time": row.get("triggered_at"),
        }
    return result


def _readiness_check(
    key: str, ok: bool, summary: str, *, level: str = "required"
) -> dict[str, Any]:
    return {
        "key": key,
        "status": "pass" if ok else ("warn" if level == "recommended" else "fail"),
        "level": level,
        "summary": summary,
    }


def _build_ops_readiness(conn, user: dict[str, Any]) -> dict[str, Any]:
    site_ids = _site_ids_for_user(conn, int(user["id"]))
    summary = build_summary(conn, site_ids=site_ids, blocked_user_id=int(user["id"]))[
        "summary"
    ]
    sites_total = len(site_ids)
    leads_total = conn.execute(
        "select count(*) as count from leads where user_id = ?", (int(user["id"]),)
    ).fetchone()["count"]
    canary_counts = _canary_counts(conn, int(user["id"]))
    latest_event_rows = _scoped_event_rows(
        conn, site_ids, limit=1, allow_demo_fallback=False
    )
    latest_event = latest_event_rows[0] if latest_event_rows else None

    public_host = urlparse(PUBLIC_BASE_URL).hostname or ""
    public_url_ready = bool(PUBLIC_BASE_URL) and not is_placeholder_secret(
        PUBLIC_BASE_URL
    )
    trusted_hosts_ready = bool(TRUSTED_HOSTS) and (
        not public_host or trusted_host_matches(public_host, TRUSTED_HOSTS)
    )
    google_ready = bool(GOOGLE_CLIENT_ID) and not is_placeholder_secret(
        GOOGLE_CLIENT_ID
    )
    lead_notifications_enabled = str(
        os.getenv("LEAD_NOTIFICATION_ENABLED", "true")
    ).strip().lower() in {"1", "true", "yes", "on"}
    lead_notification_ready = bool(
        os.getenv("LEAD_NOTIFICATION_EMAIL_TO", "").strip()
        or os.getenv("LEAD_SLACK_WEBHOOK_URL", "").strip()
    )

    checks = [
        _readiness_check(
            "database_backend",
            DATABASE_BACKEND == "postgresql" if APP_ENV == "production" else True,
            "Production should run on PostgreSQL."
            if APP_ENV == "production"
            else "Development runtime can use SQLite or PostgreSQL.",
        ),
        _readiness_check(
            "public_base_url",
            public_url_ready if APP_ENV == "production" else True,
            "Public HTTPS URL configured for operators and integrations."
            if APP_ENV == "production"
            else "Set PUBLIC_BASE_URL before launch.",
        ),
        _readiness_check(
            "trusted_hosts",
            trusted_hosts_ready if APP_ENV == "production" else True,
            "Trusted hosts cover the public hostname."
            if APP_ENV == "production"
            else "Trusted hosts can be locked before production.",
        ),
        _readiness_check(
            "https_redirect",
            FORCE_HTTPS_REDIRECT if APP_ENV == "production" else True,
            "HTTPS redirect is active."
            if APP_ENV == "production"
            else "HTTPS redirect is mainly required for production.",
        ),
        _readiness_check(
            "demo_seed_disabled",
            not ENABLE_DEMO_SEED if APP_ENV == "production" else True,
            "Demo seed is disabled for a production launch."
            if APP_ENV == "production"
            else "Demo seed can stay on for local previews.",
        ),
        _readiness_check(
            "signup_policy",
            not ALLOW_SIGNUP,
            "Public signup is closed for controlled onboarding.",
            level="recommended",
        ),
        _readiness_check(
            "site_integrations",
            sites_total > 0,
            "At least one site integration is configured.",
            level="recommended",
        ),
        _readiness_check(
            "telemetry_flow",
            summary["total"] > 0,
            "Real telemetry is reaching the platform.",
            level="recommended",
        ),
        _readiness_check(
            "canary_coverage",
            int(canary_counts["total"] or 0) > 0,
            "At least one canary token is deployed.",
            level="recommended",
        ),
        _readiness_check(
            "lead_notifications",
            (not lead_notifications_enabled) or lead_notification_ready,
            "Lead notification routing is configured.",
            level="recommended",
        ),
        _readiness_check(
            "google_oauth",
            google_ready or not bool(os.getenv("VITE_GOOGLE_CLIENT_ID", "").strip()),
            "Google OAuth client IDs are configured when login is enabled.",
            level="recommended",
        ),
    ]

    failures = [item for item in checks if item["status"] == "fail"]
    recommendations = [
        item["summary"] for item in checks if item["status"] in {"fail", "warn"}
    ]
    return {
        "status": "ready" if not failures else "attention",
        "deployment": {
            "app_env": APP_ENV,
            "database_backend": DATABASE_BACKEND,
            "public_base_url": PUBLIC_BASE_URL,
            "trusted_hosts": TRUSTED_HOSTS,
            "https_redirect": FORCE_HTTPS_REDIRECT,
            "allow_signup": ALLOW_SIGNUP,
            "demo_seed_enabled": ENABLE_DEMO_SEED,
        },
        "coverage": {
            "sites_total": sites_total,
            "events_total": summary["total"],
            "unique_ips": summary["unique_ips"],
            "blocked_ips": summary["blocked"],
            "live_sessions": summary["live_sessions"],
            "leads_total": leads_total,
            "canary_tokens_total": canary_counts["total"],
            "canary_tokens_triggered": canary_counts["triggered"],
            "latest_event_at": latest_event["created_at"] if latest_event else None,
        },
        "checks": checks,
        "next_actions": recommendations,
    }


def _public_demo_feed(limit: int) -> list[dict[str, Any]]:
    feed_limit = max(1, min(int(limit or 8), len(PUBLIC_DEMO_SNAPSHOT_TEMPLATES)))
    now = utc_now()
    feed: list[dict[str, Any]] = []
    for index, template in enumerate(PUBLIC_DEMO_SNAPSHOT_TEMPLATES[:feed_limit]):
        created_at = (now - timedelta(minutes=index * 7 + 3)).isoformat()
        feed.append(
            {
                "id": f"public-demo-{index + 1}",
                "ts": created_at,
                "timestamp": created_at,
                "timestamp_utc": created_at,
                "created_at": created_at,
                "path": template["path"],
                "url_path": template["path"],
                "event_type": template["event_type"],
                "severity": template["severity"],
                "score": template["score"],
                "risk_score": template["score"],
                "policy_risk_score": template["score"],
                "ip": template["ip"],
                "session_id": f"demo-session-{(index // 2) + 1}",
                "geo": template["geo"],
                "country": template["geo"],
                "behavior": template["behavior"],
                "deception_mode": str(template["behavior"]).replace("_", " ").upper(),
            }
        )
    return feed


def _public_demo_snapshot(
    conn, *, limit: int = 8, hours: int = 24, include_training: bool = False
) -> dict[str, Any]:
    feed = _public_demo_feed(limit)
    runtime = _build_runtime_state(conn, [], user_id=None)
    target_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    timeline: dict[str, dict[str, float]] = {}
    behaviors: dict[str, int] = {}
    for item in feed:
        path = str(item["path"])
        ip = str(item["ip"])
        hour = str(item["created_at"])[11:13] + ":00"
        target_counts[path] = target_counts.get(path, 0) + 1
        source_counts[ip] = source_counts.get(ip, 0) + 1
        behaviors[item["behavior"]] = behaviors.get(item["behavior"], 0) + 1
        bucket = timeline.setdefault(hour, {"events": 0, "score_total": 0.0})
        bucket["events"] += 1
        bucket["score_total"] += float(item["score"])
    critical_events = sum(1 for item in feed if item["severity"] == "high")
    medium_events = sum(1 for item in feed if item["severity"] == "medium")
    low_events = sum(1 for item in feed if item["severity"] == "low")
    avg_score = round(sum(float(item["score"]) for item in feed) / max(len(feed), 1), 1)
    dominant_behavior = max(behaviors, key=behaviors.get) if behaviors else "observe"
    threat_score = min(
        99,
        18
        + critical_events * 11
        + medium_events * 5
        + len(runtime["summary"]["unhealthy"]) * 4,
    )
    top_target = max(target_counts, key=target_counts.get) if target_counts else "none"
    risk_level = "high" if critical_events else ("medium" if medium_events else "low")
    return {
        "scope": "public_demo",
        "summary": {
            "total_events": len(feed),
            "critical_events": critical_events,
            "medium_events": medium_events,
            "low_events": low_events,
            "blocked_ips": 0,
            "unique_ips": len(source_counts),
            "unique_sessions": len(
                {item["session_id"] for item in feed if item.get("session_id")}
            ),
            "live_sessions": 0,
            "active_decoys": len(DEFAULT_HONEYTOKEN_PATHS)
            + runtime["summary"]["enabled"],
            "threat_score": threat_score,
            "top_target": top_target,
            "risk_level": risk_level,
            "avg_score": avg_score,
        },
        "feed": feed,
        "timeline": [
            {
                "hour": hour,
                "events": int(values["events"]),
                "avg_score": round(values["score_total"] / max(values["events"], 1), 1),
            }
            for hour, values in sorted(timeline.items(), reverse=True)[:6]
        ],
        "top_targets": [
            {"path": path, "hits": hits, "avg_score": 70}
            for path, hits in sorted(
                target_counts.items(), key=lambda item: (-item[1], item[0])
            )[:5]
        ],
        "top_source_ips": [
            {"ip": ip, "events": hits}
            for ip, hits in sorted(
                source_counts.items(), key=lambda item: (-item[1], item[0])
            )[:5]
        ],
        "insights": {
            "dominant_behavior": dominant_behavior.replace("_", " "),
            "recommended_action": "Public snapshot is demo-safe. Use the operator dashboard for real tenant telemetry and active incident review.",
        },
        "ai_summary": "Demo-safe telemetry preview active. Adaptive decoys are staged without exposing live tenant events in the public surface.",
        "generated_at": iso_now(),
        "window_hours": max(1, int(hours or 24)),
        "include_training": bool(include_training),
    }


def _health_payload(
    conn, rows: list[dict[str, Any]], *, user_id: int | None, scope: str
) -> dict[str, Any]:
    system = _system_snapshot(conn, rows, user_id=user_id)
    runtime = _build_runtime_state(conn, rows, user_id=user_id)
    active_sessions = (
        len({row["session_id"] for row in rows if row.get("session_id")})
        if scope == "tenant"
        else 0
    )
    avg_risk = (
        round(
            sum(
                float(row.get("policy_risk_score") or row.get("score") or 0)
                for row in rows
            )
            / max(len(rows), 1),
            1,
        )
        if scope == "tenant"
        else 0.0
    )
    trust_penalty = len(runtime["summary"]["unhealthy"]) * 18
    if scope == "tenant":
        trust_penalty += sum(1 for row in rows if row["severity"] == "high") * 4
    trust_index = max(5, min(99, 100 - trust_penalty))
    payload = {
        "scope": scope,
        "resources": {"cpu": system["cpu"], "memory": system["memory"]},
        "metrics": {"active_sessions": active_sessions, "avg_risk_score": avg_risk},
        "neural_hive": {"latency_ms": system["latency"]},
        "integrity": {
            "trust_index": trust_index,
            "siem_sync": "100%" if not runtime["summary"]["unhealthy"] else "degraded",
        },
    }
    if scope != "tenant":
        payload["metrics"]["runtime_modules"] = runtime["summary"]["enabled"]
        payload["integrity"]["public_feed"] = "demo_safe"
    return payload


def _system_snapshot(
    conn, rows: list[dict[str, Any]], *, user_id: int | None = None
) -> dict[str, Any]:
    runtime = _build_runtime_state(conn, rows, user_id=user_id)
    enabled_modules = runtime["summary"]["enabled"]
    total_events = len(rows)
    critical_hits = sum(1 for row in rows if row["severity"] == "high")
    cpu = min(95, 12 + enabled_modules * 11 + total_events * 2 + critical_hits * 8)
    memory = min(
        92,
        18
        + enabled_modules * 9
        + len({row.get("session_id") for row in rows if row.get("session_id")}) * 6,
    )
    latency = min(1800, max(24, 35 + total_events * 7 + critical_hits * 15))
    uptime = _format_duration(utc_now() - ROUTER_STARTED_AT)
    components = [
        {
            "name": "API Gateway",
            "status": "online",
            "load": f"{cpu}%",
            "icon": "activity",
        },
        {
            "name": "Telemetry DB",
            "status": "online",
            "load": f"{memory}%",
            "icon": "database",
        },
        {
            "name": "Threat Feed",
            "status": "online",
            "load": f"{latency}ms",
            "icon": "wifi",
        },
        {"name": "AI Advisor", "status": "online", "load": "local", "icon": "brain"},
    ]
    notifications = []
    if critical_hits:
        notifications.append(
            {
                "msg": f"{critical_hits} high-risk events require review.",
                "severity": "high",
            }
        )
    if runtime["summary"]["unhealthy"]:
        notifications.append(
            {
                "msg": f"Runtime modules degraded: {', '.join(runtime['summary']['unhealthy'])}.",
                "severity": "medium",
            }
        )
    if not notifications:
        notifications.append(
            {"msg": "Telemetry pipeline healthy and synchronized.", "severity": "low"}
        )
    return {
        "cpu": cpu,
        "memory": memory,
        "latency": latency,
        "threads": threading.active_count(),
        "uptime": uptime,
        "components": components,
        "notifications": notifications[:5],
        "metrics": {"total_incidents": total_events, "critical_hits": critical_hits},
    }


def _deception_status_payload(
    conn, rows: list[dict[str, Any]], *, user_id: int
) -> dict[str, Any]:
    active_profile = str(
        _json_setting(conn, "active_profile", "balanced", user_id=user_id) or "balanced"
    )
    if active_profile not in PROFILE_PROTOCOLS:
        active_profile = "balanced"
    auto_mode = bool(_json_setting(conn, "auto_mode", False, user_id=user_id))
    protocols = _merge_protocols(
        _json_setting(
            conn,
            "deception_protocols",
            PROFILE_PROTOCOLS.get(active_profile, DEFAULT_DECEPTION_PROTOCOLS),
            user_id=user_id,
        )
    )
    posture = _build_posture(rows, active_profile, protocols)
    blocked_count = _blocked_ip_count(conn, user_id)
    canary_count = _canary_counts(conn, user_id)["total"]
    http_hits = sum(1 for row in rows if _module_for_event(row) == "http")
    shell_sessions = len(
        {
            row["session_id"]
            for row in rows
            if _module_for_event(row) == "ssh" and row.get("session_id")
        }
    )
    tactic_counts = {"Recon": 0, "Access": 0, "Interact": 0, "Contain": 0}
    for row in rows:
        phase = TACTIC_TO_PHASE.get(
            row.get("mitre_tactic") or "Reconnaissance", "Interact"
        )
        tactic_counts[phase] += 1
    escalation_matrix = [
        {"phase": phase, "count": count, "active": count > 0}
        for phase, count in tactic_counts.items()
    ]
    return {
        "auto_mode": auto_mode,
        "active_profile": active_profile,
        "profiles_loaded": len(PROFILE_PROTOCOLS),
        "deployed_decoys": len(
            {row.get("url_path") for row in rows if row.get("url_path")}
        )
        + canary_count,
        "status": "armed" if any(protocols.values()) else "standby",
        "protocols": protocols,
        "posture": posture,
        "stats": {
            "total_intercepts": len(rows),
            "critical_threats": sum(1 for row in rows if row["severity"] == "high"),
            "http_trap_hits": http_hits,
            "shell_sessions": shell_sessions,
            "blocked_ips": blocked_count,
            "breadcrumb_score": min(
                10,
                max(
                    1,
                    len({row.get("ip") for row in rows if row.get("ip")}) // 2
                    + canary_count,
                ),
            ),
        },
        "escalation_matrix": escalation_matrix,
    }


def _protocol_event_assessment(payload: InternalProtocolEventPayload) -> dict[str, Any]:
    event_type = str(payload.event_type or "").lower()
    protocol = str(payload.protocol or "").lower()
    status = str(payload.status or "ok").lower()
    if payload.cmd:
        assessment = _terminal_assessment(payload.cmd, payload.output or "", status)
        assessment["event_type"] = "shell_command"
        return assessment
    if protocol == "ssh" and event_type == "ssh_auth":
        accepted = bool(payload.accepted)
        return {
            "event_type": "ssh_auth",
            "severity": "high" if accepted else "medium",
            "score": 84 if accepted else 52,
            "mitre_tactic": "Initial Access" if accepted else "Credential Access",
            "mitre_technique": "T1078" if accepted else "T1110",
            "policy_strategy": "credential_sinkhole"
            if accepted
            else "progressive_disclosure",
            "policy_risk_score": 82 if accepted else 48,
            "intent": "Valid account abuse" if accepted else "Credential probing",
            "thought": "SSH credential interaction matched known attacker access patterns.",
            "explanation": "The decoy listener captured an authentication workflow and forwarded it to the control plane.",
            "entropy": 0.63 if accepted else 0.38,
            "vulnerabilities": [],
        }
    return {
        "event_type": event_type or f"{protocol}_event",
        "severity": payload.severity or "low",
        "score": float(payload.score or 25),
        "mitre_tactic": "Command and Control"
        if protocol == "ssh"
        else "Reconnaissance",
        "mitre_technique": "T1090" if protocol == "ssh" else "T1595",
        "policy_strategy": "observe",
        "policy_risk_score": float(payload.score or 25),
        "intent": f"{protocol.upper()} interaction",
        "thought": "Protocol event recorded for operator visibility.",
        "explanation": "The control plane stored a protocol lifecycle event.",
        "entropy": 0.21,
        "vulnerabilities": [],
    }


def store_event(
    *,
    event_type: str,
    severity: str,
    score: float,
    ip: str,
    geo: str,
    url_path: str | None,
    http_method: str | None,
    cmd: str | None,
    attacker_type: str,
    reputation: int,
    mitre_tactic: str,
    mitre_technique: str,
    policy_strategy: str,
    policy_risk_score: float,
    captured_data: dict[str, Any] | None = None,
    site_id: int | None = None,
    session_id: str | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    created_at_value = created_at or iso_now()
    session_value = clean_event_text(session_id, max_len=80) or f"sess-{uuid.uuid4().hex[:10]}"
    event_type_value = clean_event_text(event_type, max_len=80, collapse_spaces=True) or "unknown"
    severity_value = clean_event_text(severity, max_len=16, collapse_spaces=True) or "low"
    ip_value = clean_event_text(ip, max_len=64)
    geo_value = clean_event_text(geo, max_len=80)
    url_path_value = clean_event_text(url_path, max_len=255) or None
    http_method_value = clean_event_text(http_method, max_len=16, collapse_spaces=True).upper() or None
    cmd_value = clean_event_text(cmd, max_len=512) or None
    attacker_type_value = clean_event_text(attacker_type, max_len=64, collapse_spaces=True) or "unknown"
    mitre_tactic_value = clean_event_text(mitre_tactic, max_len=64, collapse_spaces=True) or "Unknown"
    mitre_technique_value = clean_event_text(mitre_technique, max_len=32, collapse_spaces=True) or "unknown"
    policy_strategy_value = clean_event_text(policy_strategy, max_len=64, collapse_spaces=True) or "observe"
    captured_data_value = sanitize_captured_data(captured_data if captured_data is not None else {})
    with db() as conn:
        cur = conn.execute(
            """
            insert into events (
                site_id, session_id, event_type, severity, score, ip, geo, url_path, http_method, cmd,
                attacker_type, reputation, mitre_tactic, mitre_technique, policy_strategy,
                policy_risk_score, captured_data, created_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                site_id,
                session_value,
                event_type_value,
                severity_value,
                score,
                ip_value,
                geo_value,
                url_path_value,
                http_method_value,
                cmd_value,
                attacker_type_value,
                reputation,
                mitre_tactic_value,
                mitre_technique_value,
                policy_strategy_value,
                policy_risk_score,
                json.dumps(captured_data_value),
                created_at_value,
            ),
        )
        row = conn.execute(
            "select * from events where id = ?", (cur.lastrowid,)
        ).fetchone()
        event = normalize_event(row)
        auto_response = _maybe_apply_auto_response(conn, event)
        if auto_response is not None:
            event["auto_response"] = auto_response
    forward_event_to_splunk(event)
    return event


@router.get("/.env", response_class=PlainTextResponse)
def public_env_file(request: Request):
    return _serve_public_lure_file(request, "/.env")


@router.get("/.git/config", response_class=PlainTextResponse)
def public_git_config(request: Request):
    return _serve_public_lure_file(request, "/.git/config")


@router.get("/config.php", response_class=PlainTextResponse)
def public_config_php(request: Request):
    return _serve_public_lure_file(request, "/config.php")


@router.get("/backup.sql", response_class=PlainTextResponse)
def public_backup_sql(request: Request):
    return _serve_public_lure_file(request, "/backup.sql")


@router.get("/db.sql", response_class=PlainTextResponse)
def public_db_sql(request: Request):
    return _serve_public_lure_file(request, "/db.sql")


@router.get("/ssh/fingerprint", response_class=PlainTextResponse)
def public_ssh_fingerprint(request: Request):
    return _serve_public_lure_file(request, "/ssh/fingerprint")


@router.get("/robots.txt", response_class=PlainTextResponse)
def public_robots_txt(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="low",
        score=24,
        mitre_tactic="Discovery",
        mitre_technique="T1595",
        policy_strategy="observe",
        policy_risk_score=22,
        captured_data={"surface": "robots", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    body = "User-agent: *\nDisallow: /admin\nDisallow: /phpmyadmin/\nDisallow: /wp-admin/\n"
    return _decoy_text_response(
        body, session_id, media_type="text/plain; charset=utf-8"
    )


@router.get("/server-status", response_class=PlainTextResponse)
def public_server_status(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=58,
        mitre_tactic="Discovery",
        mitre_technique="T1046",
        policy_strategy="progressive_disclosure",
        policy_risk_score=55,
        captured_data={"surface": "server-status", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    body = "\n".join(
        [
            "Total Accesses: 1484",
            "Total kBytes: 98212",
            "CPULoad: .024",
            "ReqPerSec: .31",
            "BytesPerSec: 677.8",
            "BusyWorkers: 2",
            "IdleWorkers: 12",
            "Scoreboard: __W___K____....",
        ]
    )
    return _decoy_text_response(
        body, session_id, media_type="text/plain; charset=utf-8"
    )


@router.get("/actuator/health", response_class=JSONResponse)
def public_actuator_health(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=61,
        mitre_tactic="Discovery",
        mitre_technique="T1082",
        policy_strategy="progressive_disclosure",
        policy_risk_score=58,
        captured_data={"surface": "actuator-health", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    payload = {
        "status": "UP",
        "components": {
            "db": {
                "status": "UP",
                "details": {"database": "PostgreSQL", "validationQuery": "isValid()"},
            },
            "diskSpace": {
                "status": "UP",
                "details": {"total": 51539607552, "free": 19327352832},
            },
            "ping": {"status": "UP"},
        },
    }
    return _decoy_json_response(payload, session_id)


@router.get("/actuator/env", response_class=JSONResponse)
def public_actuator_env(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="high",
        score=84,
        mitre_tactic="Credential Access",
        mitre_technique="T1552",
        policy_strategy="credential_sinkhole",
        policy_risk_score=86,
        captured_data={"surface": "actuator-env", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    payload = {
        "activeProfiles": ["prod"],
        "propertySources": [
            {
                "name": "systemEnvironment",
                "properties": {
                    "DB_HOST": {"value": "10.0.4.12"},
                    "DB_USER": {"value": "svc_portal"},
                    "DB_PASSWORD": {"value": "redacted-placeholder"},
                    "JWT_SECRET": {"value": "redacted-placeholder"},
                },
            }
        ],
    }
    return _decoy_json_response(payload, session_id)


@router.get("/api/v1/users", response_class=JSONResponse)
def public_users_api(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=67,
        mitre_tactic="Discovery",
        mitre_technique="T1087",
        policy_strategy="progressive_disclosure",
        policy_risk_score=64,
        captured_data={"surface": "users-api", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    payload = {
        "items": [
            {"id": 1, "username": "svc_portal", "role": "service"},
            {"id": 2, "username": "admin", "role": "administrator"},
            {"id": 3, "username": "reporting", "role": "analyst"},
        ]
    }
    return _decoy_json_response(payload, session_id)


@router.get("/phpmyadmin", response_class=HTMLResponse)
@router.get("/phpmyadmin/", response_class=HTMLResponse)
@router.get("/phpmyadmin/index.php", response_class=HTMLResponse)
def public_phpmyadmin_index(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=66,
        mitre_tactic="Discovery",
        mitre_technique="T1190",
        policy_strategy="progressive_disclosure",
        policy_risk_score=63,
        captured_data={
            "surface": "phpmyadmin",
            "authenticated": bool(state.get("auth", {}).get("phpmyadmin")),
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    content = (
        _phpmyadmin_home_html(state)
        if state.get("auth", {}).get("phpmyadmin")
        else _phpmyadmin_login_html(state)
    )
    return _decoy_html_response(content, session_id)


@router.post("/phpmyadmin/index.php", response_class=HTMLResponse)
async def public_phpmyadmin_login(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    form = _parse_request_form(await request.body())
    username = str(form.get("pma_username") or "").strip()
    password = str(form.get("pma_password") or "")
    attempts = int(state.get("login_attempts", {}).get("phpmyadmin") or 0) + 1
    state.setdefault("login_attempts", {})["phpmyadmin"] = attempts
    state.setdefault("usernames", {})["phpmyadmin"] = username or "root"
    normalized = _normalize_identifier(username)
    accepted = (
        bool(username)
        and len(password) >= 6
        and (normalized in WEB_DECOY_ACCEPT_USERS or attempts >= 3)
    )
    state.setdefault("auth", {})["phpmyadmin"] = accepted
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="credential_attempt",
        severity="high",
        score=88 if accepted else 79,
        mitre_tactic="Credential Access",
        mitre_technique="T1110",
        policy_strategy="credential_sinkhole",
        policy_risk_score=90 if accepted else 82,
        captured_data={
            "surface": "phpmyadmin",
            "username": username,
            "password_hash": stable_hash(password, 16) if password else "",
            "password_length": len(password),
            "accepted": accepted,
            "attempt": attempts,
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if accepted:
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)
    return _decoy_html_response(
        _phpmyadmin_login_html(
            state, error="Access denied for supplied credentials.", username=username
        ),
        session_id,
    )


@router.get("/phpmyadmin/sql.php", response_class=HTMLResponse)
def public_phpmyadmin_sql(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=71,
        mitre_tactic="Execution",
        mitre_technique="T1059",
        policy_strategy="progressive_disclosure",
        policy_risk_score=69,
        captured_data={"surface": "phpmyadmin-sql", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("phpmyadmin"):
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)
    return _decoy_html_response(_phpmyadmin_sql_html(state), session_id)


@router.post("/phpmyadmin/sql.php", response_class=HTMLResponse)
async def public_phpmyadmin_sql_submit(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    form = _parse_request_form(await request.body())
    query = str(form.get("query") or "").strip()
    _touch_web_decoy_state(state, request.url.path)
    if not state.get("auth", {}).get("phpmyadmin"):
        _public_decoy_event(
            request,
            session_id=session_id,
            event_type="sql_query",
            severity="high",
            score=81,
            mitre_tactic="Execution",
            mitre_technique="T1059",
            policy_strategy="observe",
            policy_risk_score=77,
            captured_data={
                "surface": "phpmyadmin-sql",
                "query": query,
                "authenticated": False,
                "actor": state.get("actor"),
            },
            attacker_type=str(state.get("actor") or "scanner"),
        )
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)

    result = _fake_sql_result(state, query)
    state["last_sql_result"] = result
    history = list(state.get("sql_history") or [])
    history.append(
        {
            "ts": iso_now(),
            "query": query,
            "status": result["status"],
            "summary": result["summary"],
            "database": state.get("selected_db"),
        }
    )
    state["sql_history"] = history[-20:]
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="sql_query",
        severity=str(result["severity"]),
        score=float(result["score"]),
        mitre_tactic=str(result["mitre_tactic"]),
        mitre_technique=str(result["mitre_technique"]),
        policy_strategy=str(result["policy_strategy"]),
        policy_risk_score=float(result["policy_risk_score"]),
        captured_data={
            "surface": "phpmyadmin-sql",
            "query": query,
            "query_length": len(query),
            "result_summary": result["summary"],
            "database": state.get("selected_db"),
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    return _decoy_html_response(
        _phpmyadmin_sql_html(state, query=query, result=result), session_id
    )


@router.get("/phpmyadmin/tables.php", response_class=HTMLResponse)
def public_phpmyadmin_tables(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    database = _normalize_identifier(
        request.query_params.get("db") or str(state.get("selected_db") or "operations")
    )
    if database not in WEB_DECOY_DATABASES:
        database = "operations"
    state["selected_db"] = database
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=64,
        mitre_tactic="Discovery",
        mitre_technique="T1087",
        policy_strategy="progressive_disclosure",
        policy_risk_score=60,
        captured_data={
            "surface": "phpmyadmin-tables",
            "database": database,
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("phpmyadmin"):
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)
    rows = [
        {
            "Table": table_name,
            "Rows": len(
                list(
                    (
                        WEB_DECOY_DATABASES.get(database, {}).get(table_name, {}) or {}
                    ).get("rows")
                    or []
                )
            ),
            "Inspect": f"/phpmyadmin/table.php?db={database}&table={table_name}",
        }
        for table_name in sorted(WEB_DECOY_DATABASES.get(database, {}).keys())
    ]
    body = f"""
      <div class="nav">
        <a href="/phpmyadmin/index.php">Home</a>
        <a href="/phpmyadmin/sql.php">SQL</a>
        <a href="/phpmyadmin/import-export.php">Import / Export</a>
      </div>
      <div class="banner ok">Browsing schema: {html.escape(database)}</div>
      {_html_table(["Table", "Rows", "Inspect"], rows)}
    """
    return _decoy_html_response(
        _decoy_layout(
            "phpMyAdmin Tables", body, accent="#00618a", subtitle=f"Schema: {database}"
        ),
        session_id,
    )


@router.get("/phpmyadmin/table.php", response_class=HTMLResponse)
def public_phpmyadmin_table(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    database = _normalize_identifier(
        request.query_params.get("db") or str(state.get("selected_db") or "operations")
    )
    table = _normalize_identifier(request.query_params.get("table") or "")
    if database not in WEB_DECOY_DATABASES:
        database = "operations"
    state["selected_db"] = database
    table_state = dict(WEB_DECOY_DATABASES.get(database, {}).get(table, {}))
    rows = list(table_state.get("rows") or [])[:10]
    columns = _table_columns(database, table)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=72,
        mitre_tactic="Collection",
        mitre_technique="T1005",
        policy_strategy="progressive_disclosure",
        policy_risk_score=68,
        captured_data={
            "surface": "phpmyadmin-table",
            "database": database,
            "table": table,
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("phpmyadmin"):
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)
    if not columns:
        body = f"""
          <div class="banner error">Table '{html.escape(table)}' was not found in schema '{html.escape(database)}'.</div>
          <div class="nav"><a href="/phpmyadmin/tables.php?db={html.escape(database)}">Back to tables</a></div>
        """
        return _decoy_html_response(
            _decoy_layout(
                "phpMyAdmin Table",
                body,
                accent="#00618a",
                subtitle=f"Schema: {database}",
            ),
            session_id,
        )
    body = f"""
      <div class="nav">
        <a href="/phpmyadmin/tables.php?db={html.escape(database)}">Tables</a>
        <a href="/phpmyadmin/sql.php">SQL</a>
      </div>
      {_html_table(columns, rows)}
    """
    return _decoy_html_response(
        _decoy_layout(
            "phpMyAdmin Table", body, accent="#00618a", subtitle=f"{database}.{table}"
        ),
        session_id,
    )


@router.get("/phpmyadmin/import-export.php", response_class=HTMLResponse)
def public_phpmyadmin_import_export(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=69,
        mitre_tactic="Collection",
        mitre_technique="T1567",
        policy_strategy="observe",
        policy_risk_score=66,
        captured_data={
            "surface": "phpmyadmin-import-export",
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("phpmyadmin"):
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)
    body = """
      <div class="nav">
        <a href="/phpmyadmin/index.php">Home</a>
        <a href="/phpmyadmin/sql.php">SQL</a>
      </div>
      <div class="row">
        <div class="card"><h3>Export Queue</h3><div class="kpi">2</div><div class="muted">payroll_2024, session_audit</div></div>
        <div class="card"><h3>Import Policy</h3><div class="kpi">Manual</div><div class="muted">Uploads require privileged approval</div></div>
      </div>
      <pre>mysqldump --single-transaction operations audit_log > /srv/backups/audit_log.sql</pre>
    """
    return _decoy_html_response(
        _decoy_layout(
            "phpMyAdmin Import / Export",
            body,
            accent="#00618a",
            subtitle="Transfer workflows",
        ),
        session_id,
    )


@router.get("/phpmyadmin/sessions.php", response_class=HTMLResponse)
def public_phpmyadmin_sessions(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=67,
        mitre_tactic="Discovery",
        mitre_technique="T1087",
        policy_strategy="progressive_disclosure",
        policy_risk_score=63,
        captured_data={"surface": "phpmyadmin-sessions", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("phpmyadmin"):
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)
    rows = list(
        (WEB_DECOY_DATABASES.get("operations", {}).get("sessions", {}) or {}).get(
            "rows"
        )
        or []
    )
    body = f"""
      <div class="nav">
        <a href="/phpmyadmin/index.php">Home</a>
        <a href="/phpmyadmin/intrusion.php">Intrusion</a>
      </div>
      {_html_table(["session_id", "user_id", "ip_address", "last_seen"], rows)}
    """
    return _decoy_html_response(
        _decoy_layout(
            "phpMyAdmin Sessions",
            body,
            accent="#00618a",
            subtitle="Active MariaDB sessions",
        ),
        session_id,
    )


@router.get("/phpmyadmin/intrusion.php", response_class=HTMLResponse)
def public_phpmyadmin_intrusion(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="high",
        score=82,
        mitre_tactic="Discovery",
        mitre_technique="T1592",
        policy_strategy="observe",
        policy_risk_score=80,
        captured_data={"surface": "phpmyadmin-intrusion", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("phpmyadmin"):
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)
    last_sql_result = dict(state.get("last_sql_result") or {})
    summary = last_sql_result.get("summary") or "No SQL statements replayed yet."
    body = f"""
      <div class="row">
        <div class="card"><h3>Session Profile</h3><div class="kpi">{html.escape(str(state.get("actor") or "scanner"))}</div><div class="muted">Adaptive assessment</div></div>
        <div class="card"><h3>Visited Paths</h3><div class="kpi">{len(list(state.get("visited_paths") or []))}</div><div class="muted">Public decoy pages touched</div></div>
        <div class="card"><h3>Login Attempts</h3><div class="kpi">{int(state.get("login_attempts", {}).get("phpmyadmin") or 0)}</div><div class="muted">Credential telemetry</div></div>
      </div>
      <div class="card"><h3>Last SQL Result</h3><div class="muted">{html.escape(str(summary))}</div></div>
      <pre>{html.escape(json.dumps(list(state.get("sql_history") or []), indent=2))}</pre>
    """
    return _decoy_html_response(
        _decoy_layout(
            "Intrusion Review", body, accent="#00618a", subtitle="Decoy session replay"
        ),
        session_id,
    )


@router.get("/phpmyadmin/alerts.php", response_class=HTMLResponse)
def public_phpmyadmin_alerts(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="high",
        score=79,
        mitre_tactic="Discovery",
        mitre_technique="T1497",
        policy_strategy="observe",
        policy_risk_score=76,
        captured_data={"surface": "phpmyadmin-alerts", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("phpmyadmin"):
        return _decoy_redirect_response("/phpmyadmin/index.php", session_id)
    rows = [
        {
            "alert": "Replica drift detected",
            "severity": "medium",
            "owner": "db-gateway-02",
        },
        {
            "alert": "Credential spray observed",
            "severity": "high",
            "owner": _request_ip(request),
        },
        {
            "alert": "Backup export pending review",
            "severity": "low",
            "owner": "svc_portal",
        },
    ]
    body = f"""
      <div class="nav">
        <a href="/phpmyadmin/index.php">Home</a>
        <a href="/phpmyadmin/intrusion.php">Intrusion</a>
      </div>
      {_html_table(["alert", "severity", "owner"], rows)}
    """
    return _decoy_html_response(
        _decoy_layout(
            "phpMyAdmin Alerts",
            body,
            accent="#00618a",
            subtitle="Operational alert board",
        ),
        session_id,
    )


@router.get("/phpmyadmin/{subpath:path}", response_class=HTMLResponse)
def public_phpmyadmin_catchall(subpath: str, request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=63,
        mitre_tactic="Discovery",
        mitre_technique="T1595",
        policy_strategy="progressive_disclosure",
        policy_risk_score=60,
        captured_data={
            "surface": "phpmyadmin-catchall",
            "path": subpath,
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    content = (
        _phpmyadmin_home_html(
            state, notice=f"Resource /phpmyadmin/{subpath} opened in bounded mode."
        )
        if state.get("auth", {}).get("phpmyadmin")
        else _phpmyadmin_login_html(state)
    )
    return _decoy_html_response(content, session_id)


@router.get("/wp-login.php", response_class=HTMLResponse)
def public_wp_login(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=59,
        mitre_tactic="Discovery",
        mitre_technique="T1190",
        policy_strategy="progressive_disclosure",
        policy_risk_score=56,
        captured_data={"surface": "wordpress-login", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if state.get("auth", {}).get("wordpress"):
        return _decoy_redirect_response("/wp-admin/", session_id)
    return _decoy_html_response(_wordpress_login_html(state), session_id)


@router.post("/wp-login.php", response_class=HTMLResponse)
async def public_wp_login_submit(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    form = _parse_request_form(await request.body())
    username = str(form.get("log") or "").strip()
    password = str(form.get("pwd") or "")
    attempts = int(state.get("login_attempts", {}).get("wordpress") or 0) + 1
    state.setdefault("login_attempts", {})["wordpress"] = attempts
    state.setdefault("usernames", {})["wordpress"] = username or "administrator"
    normalized = _normalize_identifier(
        username.split("@", 1)[0] if "@" in username else username
    )
    accepted = (
        bool(username)
        and len(password) >= 6
        and (normalized in WEB_DECOY_ACCEPT_USERS or attempts >= 3)
    )
    state.setdefault("auth", {})["wordpress"] = accepted
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="credential_attempt",
        severity="high",
        score=84 if accepted else 76,
        mitre_tactic="Credential Access",
        mitre_technique="T1110",
        policy_strategy="credential_sinkhole",
        policy_risk_score=86 if accepted else 79,
        captured_data={
            "surface": "wordpress-login",
            "username": username,
            "password_hash": stable_hash(password, 16) if password else "",
            "password_length": len(password),
            "accepted": accepted,
            "attempt": attempts,
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if accepted:
        return _decoy_redirect_response("/wp-admin/", session_id)
    return _decoy_html_response(
        _wordpress_login_html(
            state, error="Unknown username or incorrect password.", username=username
        ),
        session_id,
    )


@router.get("/wp-admin", response_class=HTMLResponse)
@router.get("/wp-admin/", response_class=HTMLResponse)
@router.get("/wp-admin/{subpath:path}", response_class=HTMLResponse)
def public_wp_admin(request: Request, subpath: str = ""):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=68,
        mitre_tactic="Discovery",
        mitre_technique="T1087",
        policy_strategy="progressive_disclosure",
        policy_risk_score=64,
        captured_data={
            "surface": "wordpress-admin",
            "path": subpath or "/",
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("wordpress"):
        return _decoy_redirect_response("/wp-login.php", session_id)
    return _decoy_html_response(_wordpress_admin_html(state), session_id)


@router.get("/admin", response_class=HTMLResponse)
@router.get("/admin/", response_class=HTMLResponse)
@router.get("/admin/login", response_class=HTMLResponse)
def public_admin_login(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=64,
        mitre_tactic="Discovery",
        mitre_technique="T1190",
        policy_strategy="progressive_disclosure",
        policy_risk_score=60,
        captured_data={"surface": "secure-admin", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if state.get("auth", {}).get("admin"):
        return _decoy_redirect_response("/admin/portal", session_id)
    return _decoy_html_response(_admin_login_html(state), session_id)


@router.post("/admin/login", response_class=HTMLResponse)
async def public_admin_login_submit(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    form = _parse_request_form(await request.body())
    username = str(form.get("username") or "").strip()
    password = str(form.get("password") or "")
    attempts = int(state.get("login_attempts", {}).get("admin") or 0) + 1
    state.setdefault("login_attempts", {})["admin"] = attempts
    state.setdefault("usernames", {})["admin"] = username or "opsadmin"
    normalized = _normalize_identifier(username)
    accepted = (
        bool(username)
        and len(password) >= 6
        and (normalized in WEB_DECOY_ACCEPT_USERS or attempts >= 2)
    )
    state.setdefault("auth", {})["admin"] = accepted
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="credential_attempt",
        severity="high",
        score=87 if accepted else 78,
        mitre_tactic="Credential Access",
        mitre_technique="T1110",
        policy_strategy="credential_sinkhole",
        policy_risk_score=89 if accepted else 80,
        captured_data={
            "surface": "secure-admin",
            "username": username,
            "password_hash": stable_hash(password, 16) if password else "",
            "password_length": len(password),
            "accepted": accepted,
            "attempt": attempts,
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if accepted:
        return _decoy_redirect_response("/admin/portal", session_id)
    return _decoy_html_response(
        _admin_login_html(
            state, error="Administrative access denied.", username=username
        ),
        session_id,
    )


@router.get("/admin/portal", response_class=HTMLResponse)
def public_admin_portal(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="high",
        score=74,
        mitre_tactic="Discovery",
        mitre_technique="T1592",
        policy_strategy="progressive_disclosure",
        policy_risk_score=71,
        captured_data={"surface": "secure-admin-portal", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    if not state.get("auth", {}).get("admin"):
        return _decoy_redirect_response("/admin/login", session_id)
    return _decoy_html_response(_admin_portal_html(state), session_id)


@router.get("/xmlrpc.php", response_class=PlainTextResponse)
def public_xmlrpc_probe(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="http_probe",
        severity="medium",
        score=62,
        mitre_tactic="Discovery",
        mitre_technique="T1190",
        policy_strategy="observe",
        policy_risk_score=59,
        captured_data={"surface": "xmlrpc", "actor": state.get("actor")},
        attacker_type=str(state.get("actor") or "scanner"),
    )
    return _decoy_text_response(
        "XML-RPC server accepts POST requests only.\n",
        session_id,
        media_type="text/plain; charset=utf-8",
    )


@router.post("/xmlrpc.php", response_class=PlainTextResponse)
async def public_xmlrpc_call(request: Request):
    session_id, state, _ = _web_decoy_state(request)
    raw_body = (await request.body()).decode("utf-8", errors="ignore")
    match = re.search(r"<methodName>([^<]+)</methodName>", raw_body)
    method_name = match.group(1) if match else "unknown.method"
    severity = (
        "high" if method_name in {"system.multicall", "wp.getUsersBlogs"} else "medium"
    )
    score = 83 if severity == "high" else 66
    risk = 84 if severity == "high" else 64
    _touch_web_decoy_state(state, request.url.path)
    _public_decoy_event(
        request,
        session_id=session_id,
        event_type="xmlrpc_call",
        severity=severity,
        score=score,
        mitre_tactic="Credential Access" if severity == "high" else "Execution",
        mitre_technique="T1110" if severity == "high" else "T1059",
        policy_strategy="observe",
        policy_risk_score=risk,
        captured_data={
            "surface": "xmlrpc",
            "method": method_name,
            "body_hash": stable_hash(raw_body, 16) if raw_body else "",
            "body_length": len(raw_body),
            "actor": state.get("actor"),
        },
        attacker_type=str(state.get("actor") or "scanner"),
    )
    fault = (
        '<?xml version="1.0"?>'
        "<methodResponse><fault><value><struct>"
        "<member><name>faultCode</name><value><int>403</int></value></member>"
        "<member><name>faultString</name><value><string>Authentication required.</string></value></member>"
        "</struct></value></fault></methodResponse>"
    )
    return _decoy_text_response(fault, session_id, media_type="text/xml; charset=utf-8")


@router.post("/internal/protocols/event")
def protocol_event_ingest(
    payload: InternalProtocolEventPayload,
    x_protocol_secret: str | None = Header(default=None),
) -> dict[str, Any]:
    if not PROTOCOL_SHARED_SECRET:
        raise HTTPException(
            status_code=503, detail="Internal protocol ingest is not configured."
        )
    if x_protocol_secret != PROTOCOL_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid protocol secret.")

    assessment = _protocol_event_assessment(payload)
    captured_data = {
        "protocol": payload.protocol.lower(),
        "phase": payload.phase,
        "output": payload.output or "",
        "prompt": payload.prompt,
        "cwd": payload.cwd,
        "status": payload.status or "ok",
        "username": payload.username,
        "accepted": payload.accepted,
        "password_hash": stable_hash(payload.password or "", 16)
        if payload.password
        else None,
        "password_length": len(payload.password or "") if payload.password else 0,
        "execution_mode": payload.execution_mode
        or ("real" if payload.cmd else "emulated"),
        "source": str(payload.metadata.get("source") or "protocol-decoy"),
    }
    if payload.metadata:
        captured_data["metadata"] = payload.metadata
    event = store_event(
        site_id=payload.site_id,
        session_id=payload.session_id,
        event_type=assessment["event_type"],
        severity=str(assessment["severity"]),
        score=float(assessment["score"]),
        ip=payload.ip,
        geo=payload.geo,
        url_path=None,
        http_method=None,
        cmd=payload.cmd,
        attacker_type="interactive" if payload.cmd or payload.accepted else "scanner",
        reputation=77 if payload.cmd or payload.accepted else 46,
        mitre_tactic=str(assessment["mitre_tactic"]),
        mitre_technique=str(assessment["mitre_technique"]),
        policy_strategy=str(assessment["policy_strategy"]),
        policy_risk_score=float(assessment["policy_risk_score"]),
        captured_data=captured_data,
        created_at=payload.timestamp,
    )
    return {"status": "accepted", "event": event}


@router.post("/ingest")
def ingest_event(
    payload: IngestRequest, x_api_key: str | None = Header(default=None)
) -> dict[str, Any]:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key.")
    api_key = x_api_key.strip()
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key.")
    with db() as conn:
        hashed_key = hash_api_key(api_key)
        site = conn.execute(
            "select * from sites where api_key = ?", (hashed_key,)
        ).fetchone()
        if not site:
            site = conn.execute(
                "select * from sites where api_key = ?", (api_key,)
            ).fetchone()
            if site:
                conn.execute(
                    "update sites set api_key = ?, updated_at = ? where id = ?",
                    (hashed_key, iso_now(), site["id"]),
                )
    if not site:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    score = (
        payload.score
        if payload.score is not None
        else (85 if payload.url_path in ["/.env", "/phpmyadmin/"] else 48)
    )
    severity = payload.severity or (
        "high" if score >= 75 else "medium" if score >= 45 else "low"
    )
    event = store_event(
        site_id=site["id"],
        event_type=payload.event_type,
        severity=severity,
        score=score,
        ip=payload.ip or "198.51.100.10",
        geo="Internet",
        url_path=payload.url_path,
        http_method=payload.http_method,
        cmd=payload.cmd,
        attacker_type="integration",
        reputation=min(int(score), 99),
        mitre_tactic="Initial Access" if payload.url_path else "Execution",
        mitre_technique="T1078" if payload.url_path else "T1059",
        policy_strategy="progressive_disclosure",
        policy_risk_score=min(score + 5, 99),
        captured_data=payload.captured_data,
    )
    return {"status": "accepted", "event_id": event["id"]}


@router.get("/dashboard/stats")
def dashboard_stats(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        site_ids = _site_ids_for_user(conn, int(user["id"]))
        summary = build_summary(
            conn,
            site_ids=site_ids,
            blocked_user_id=int(user["id"]),
        )
        if not summary["feed"] and not site_ids:
            summary = _event_summary_from_rows(
                _sample_incident_rows(limit=min(12, len(SAMPLE_INCIDENT_TEMPLATES))),
                blocked=int(summary["summary"]["blocked"]),
            )
            summary["demo_mode"] = True
        else:
            summary["demo_mode"] = False
        summary["feed"] = [frontend_event(row) for row in summary["feed"]]
        geo_distribution: dict[str, int] = {}
        for item in summary["feed"]:
            country = item.get("geo") or "Unknown"
            geo_distribution[country] = geo_distribution.get(country, 0) + 1
        summary["geo_distribution"] = geo_distribution
    return summary


@router.get("/ops/readiness")
def ops_readiness(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        return _build_ops_readiness(conn, user)


@router.get("/public/telemetry/snapshot")
def public_snapshot(
    limit: int = 8, hours: int = 24, include_training: bool = False
) -> dict[str, Any]:
    with db() as conn:
        return _public_demo_snapshot(
            conn, limit=limit, hours=hours, include_training=include_training
        )


@router.get("/intelligence/health")
def intelligence_health(
    user: dict[str, Any] | None = Depends(optional_user),
) -> dict[str, Any]:
    with db() as conn:
        if user is None:
            return _health_payload(conn, [], user_id=None, scope="public_demo")
        user_id = int(user["id"])
        rows = _scoped_event_rows(conn, _site_ids_for_user(conn, user_id), limit=120)
        return _health_payload(conn, rows, user_id=user_id, scope="tenant")


@router.get("/intelligence/predict")
def intelligence_predict(
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=60
        )
    target_counts: dict[str, int] = {}
    for row in rows:
        target = row.get("url_path") or row.get("event_type") or "unknown"
        target_counts[target] = target_counts.get(target, 0) + 1
    predicted_top_target = (
        max(target_counts, key=target_counts.get) if target_counts else "/admin"
    )
    confidence = round(
        min(
            0.97,
            0.35 + (target_counts.get(predicted_top_target, 0) / max(len(rows), 1)),
        ),
        2,
    )
    critical_recent = sum(1 for row in rows[:12] if row["severity"] == "high")
    next_wave_eta = max(8, 60 - min(45, critical_recent * 6 + len(rows) // 4))
    recommended_action = (
        "Escalate deception profile and review repeat source IPs."
        if critical_recent >= 2
        else "Keep adaptive decoys armed and continue monitoring the top target."
    )
    return {
        "next_wave_eta_minutes": next_wave_eta,
        "predicted_top_target": predicted_top_target,
        "confidence": confidence,
        "recommended_action": recommended_action,
    }


@router.get("/deception/adaptive/metrics")
def adaptive_metrics(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=30
        )
    sessions: dict[str, dict[str, Any]] = {}
    strategies: dict[str, int] = {}
    total_risk = 0.0
    for row in rows:
        sid = row["session_id"]
        sessions.setdefault(
            sid,
            {
                "session_id": sid,
                "policy_strategy": row["policy_strategy"],
                "policy_risk_score": row["policy_risk_score"],
                "interaction_steps": 0,
            },
        )
        sessions[sid]["interaction_steps"] += 1
        sessions[sid]["policy_risk_score"] = max(
            float(sessions[sid]["policy_risk_score"]), float(row["policy_risk_score"])
        )
        strategy = row["policy_strategy"] or "observe"
        strategies[strategy] = strategies.get(strategy, 0) + 1
        total_risk += float(row["policy_risk_score"])
    session_values = list(sessions.values())
    return {
        "profile_mode": "adaptive",
        "summary": {
            "total_sessions": len(session_values),
            "avg_policy_risk_score": round(total_risk / max(len(rows), 1), 1),
            "avg_interaction_steps": round(
                sum(item["interaction_steps"] for item in session_values)
                / max(len(session_values), 1),
                1,
            ),
        },
        "distribution": {"policy_strategy": strategies},
        "sessions": session_values,
    }


@router.get("/deception/adaptive/intelligence")
def adaptive_intelligence(
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=50
        )
    countries: dict[str, dict[str, Any]] = {}
    paths: dict[str, int] = {}
    tactics: dict[tuple[str, str], int] = {}
    series: list[dict[str, Any]] = []
    strategies: dict[str, int] = {}
    for index, row in enumerate(rows[:12]):
        country = row["geo"] or "Unknown"
        info = countries.setdefault(
            country,
            {
                "country": country,
                "events": 0,
                "critical_events": 0,
                "avg_score": 0,
                "risk_index": 0,
            },
        )
        info["events"] += 1
        info["critical_events"] += 1 if row["severity"] == "high" else 0
        info["avg_score"] += row["score"]
        info["risk_index"] = min(99, info["risk_index"] + row["policy_risk_score"] / 2)
        path = row["url_path"] or row["event_type"]
        paths[path] = paths.get(path, 0) + 1
        key = (row["mitre_tactic"] or "Reconnaissance", row["severity"])
        tactics[key] = tactics.get(key, 0) + 1
        strategy = row["policy_strategy"] or "observe"
        strategies[strategy] = strategies.get(strategy, 0) + 1
        series.append(
            {
                "index": index,
                "risk_score": row["policy_risk_score"],
                "ts": row["created_at"],
            }
        )
    top_countries = []
    for item in countries.values():
        item["avg_score"] = round(item["avg_score"] / max(item["events"], 1), 1)
        item["risk_index"] = round(item["risk_index"], 1)
        top_countries.append(item)
    top_countries.sort(key=lambda item: item["risk_index"], reverse=True)
    return {
        "window": {"event_count": len(rows), "hours": 24},
        "policy_summary": {
            "total_sessions": len({row["session_id"] for row in rows}),
            "avg_policy_risk_score": round(
                sum(row["policy_risk_score"] for row in rows) / max(len(rows), 1), 1
            ),
            "dominant_strategy": rows[0]["policy_strategy"] if rows else None,
            "strategy_distribution": strategies,
        },
        "top_countries": top_countries[:8],
        "top_paths": [
            {"path": key, "hits": value} for key, value in list(paths.items())[:8]
        ],
        "tactic_matrix": [
            {"tactic": key[0], "severity": key[1], "events": value}
            for key, value in tactics.items()
        ],
        "risk_series": series,
        "high_risk_sessions": [
            {
                "session_id": row["session_id"],
                "policy_risk_score": row["policy_risk_score"],
                "policy_strategy": row["policy_strategy"],
            }
            for row in rows[:5]
        ],
    }


@router.get("/deception/adaptive/timeline/{session_id}")
def adaptive_timeline(
    session_id: str, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_session_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), session_id
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {
        "session_id": session_id,
        "timeline": [
            {
                "index": index,
                "ts": row["created_at"],
                "event_type": row["event_type"],
                "cmd": row["cmd"] or row["url_path"] or row["event_type"],
                "policy_strategy": row["policy_strategy"],
                "policy_risk_score": row["policy_risk_score"],
            }
            for index, row in enumerate(rows)
        ],
    }


@router.post("/soc/block-ip")
def block_ip(
    payload: BlockIpPayload, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    with db() as conn:
        _insert_blocked_ip(
            conn,
            user_id=int(user["id"]),
            ip=payload.ip,
            reason=payload.reason or "manual",
            created_at=iso_now(),
        )
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="soc.block_ip",
            summary=f"Blocked IP {payload.ip}",
            severity="high",
            target_type="ip",
            target_id=payload.ip,
            metadata={"ip": payload.ip, "reason": payload.reason or "manual"},
        )
    return {"status": "success", "message": f"IP {payload.ip} blocked."}


@router.get("/soc/blocked-ips/export")
def export_blocked_ips(
    export_format: str = Query(default="nginx", alias="format"),
    user: dict[str, Any] = Depends(current_user),
):
    normalized_format = str(export_format or "").strip().lower()
    with db() as conn:
        entries, invalid_entries = _edge_block_entries(conn, int(user["id"]))
    headers = {
        "Cache-Control": "no-store",
        "X-CyberSentil-Invalid-Entries": str(invalid_entries),
    }
    if normalized_format == "cloudflare-json":
        headers["Content-Disposition"] = (
            'attachment; filename="cybersentinel-blocked-ips.cloudflare.json"'
        )
        return JSONResponse(
            {
                "format": "cloudflare-json",
                "generated_at": iso_now(),
                "count": len(entries),
                "invalid_entries": invalid_entries,
                "items": [
                    {
                        "ip": item["ip"],
                        "comment": _edge_reason_comment(item.get("reason"))
                        or "CyberSentil auto/manual block",
                        "created_at": item.get("created_at") or "",
                    }
                    for item in entries
                ],
            },
            headers=headers,
        )
    content, media_type = _render_edge_block_export(entries, normalized_format)
    suffix = "conf" if normalized_format == "nginx" else "txt"
    headers["Content-Disposition"] = (
        f'attachment; filename="cybersentinel-blocked-ips.{suffix}"'
    )
    return PlainTextResponse(content, media_type=media_type, headers=headers)


@router.get("/deception/status")
def deception_status(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=120
        )
        return _deception_status_payload(conn, rows, user_id=int(user["id"]))


@router.get("/deception/honeytokens")
def honeytokens(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=200
        )
    paths = {
        path: {
            "path": path,
            "hits": 0,
            "unique_attackers": set(),
            "severity": "low",
            "last_hit": None,
        }
        for path in DEFAULT_HONEYTOKEN_PATHS
    }
    for row in rows:
        path = row.get("url_path")
        if not path:
            continue
        item = paths.setdefault(
            path,
            {
                "path": path,
                "hits": 0,
                "unique_attackers": set(),
                "severity": "low",
                "last_hit": None,
            },
        )
        item["hits"] += 1
        if row.get("ip"):
            item["unique_attackers"].add(row["ip"])
        if SEVERITY_RANK.get(row["severity"], 0) > SEVERITY_RANK.get(
            item["severity"], 0
        ):
            item["severity"] = row["severity"]
        item["last_hit"] = max(
            filter(None, [item["last_hit"], row["created_at"]]),
            default=row["created_at"],
        )
    items = []
    for item in paths.values():
        items.append(
            {
                "path": item["path"],
                "status": "TRIGGERED" if item["hits"] else "ARMED",
                "hits": item["hits"],
                "unique_attackers": len(item["unique_attackers"]),
                "severity": item["severity"],
                "last_hit": item["last_hit"],
            }
        )
    items.sort(
        key=lambda entry: (entry["hits"], entry["severity"] == "high"), reverse=True
    )
    return items[:12]


@router.get("/deception/canary-tokens")
def canary_tokens(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
    with db() as conn:
        rows = [
            dict(row)
            for row in conn.execute(
                "select * from canary_tokens where user_id = ? order by datetime(created_at) desc",
                (int(user["id"]),),
            ).fetchall()
        ]
    return [_serialize_canary(row) for row in rows]


@router.get("/deception/live-feed")
def deception_live_feed(
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=15
        )
    return [frontend_event(row) for row in rows]


@router.post("/deception/deploy")
def deception_deploy(
    payload: DeceptionDeployPayload, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    requested_profile = str(payload.profile or "balanced").lower()
    if requested_profile not in PROFILE_PROTOCOLS:
        raise HTTPException(status_code=400, detail="Unknown deception profile.")
    protocols = _merge_protocols(
        payload.protocols or PROFILE_PROTOCOLS[requested_profile]
    )
    with db() as conn:
        site_ids = _site_ids_for_user(conn, int(user["id"]))
        _save_runtime_state(
            conn,
            user_id=int(user["id"]),
            active_profile=requested_profile,
            protocols=protocols,
        )
        rows = _scoped_event_rows(conn, site_ids, limit=120)
        posture = _build_posture(rows, requested_profile, protocols)
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="deception.deploy",
            summary=f"Deployed deception profile {requested_profile}",
            severity="high",
            target_type="deception_profile",
            target_id=requested_profile,
            metadata={"profile": requested_profile, "protocols": protocols},
        )
    return {
        "status": "success",
        "message": f"Deception profile {requested_profile} deployed.",
        "result": {
            "profile": requested_profile,
            "protocols": protocols,
            "posture": posture,
        },
    }


@router.post("/deception/auto-mode")
def deception_auto_mode(
    payload: AutoModePayload, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    with db() as conn:
        site_ids = _site_ids_for_user(conn, int(user["id"]))
        rows = _scoped_event_rows(conn, site_ids, limit=120)
        profile = (
            _profile_for_rows(rows)
            if payload.enabled
            else str(
                _json_setting(
                    conn, "active_profile", "balanced", user_id=int(user["id"])
                )
            )
        )
        protocols = (
            PROFILE_PROTOCOLS[profile]
            if payload.enabled
            else _merge_protocols(
                _json_setting(
                    conn,
                    "deception_protocols",
                    DEFAULT_DECEPTION_PROTOCOLS,
                    user_id=int(user["id"]),
                )
            )
        )
        _save_runtime_state(
            conn,
            user_id=int(user["id"]),
            auto_mode=payload.enabled,
            active_profile=profile,
            protocols=protocols,
        )
        posture = _build_posture(rows, profile, protocols)
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="deception.auto_mode",
            summary=f"Set deception auto-mode to {'enabled' if payload.enabled else 'disabled'}",
            severity="medium",
            target_type="deception_runtime",
            metadata={
                "enabled": bool(payload.enabled),
                "profile": profile,
                "protocols": protocols,
            },
        )
    return {
        "status": "success",
        "auto_mode": payload.enabled,
        "result": {"profile": profile, "protocols": protocols, "posture": posture},
    }


@router.post("/deception/autotune")
def deception_autotune(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=120
        )
        profile = _profile_for_rows(rows)
        protocols = PROFILE_PROTOCOLS[profile]
        _save_runtime_state(
            conn, user_id=int(user["id"]), active_profile=profile, protocols=protocols
        )
        posture = _build_posture(rows, profile, protocols)
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="deception.autotune",
            summary=f"Auto-tuned deception profile to {profile}",
            severity="medium",
            target_type="deception_profile",
            target_id=profile,
            metadata={"profile": profile, "protocols": protocols},
        )
    return {
        "status": "success",
        "message": "Auto-tune completed.",
        "profile": profile,
        "protocols": protocols,
        "posture": posture,
    }


@router.post("/deception/canary-tokens/generate")
def canary_generate(
    payload: CanaryTokenCreatePayload, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    token = secrets.token_urlsafe(8).replace("-", "").replace("_", "").lower()
    relative_path = f"/canary/{token}"
    now = iso_now()
    with db() as conn:
        site_id = _default_site_id_for_user(conn, int(user["id"]))
        cur = conn.execute(
            """
            insert into canary_tokens (user_id, site_id, token, label, token_type, relative_path, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(user["id"]),
                site_id,
                token,
                payload.label.strip(),
                payload.type.strip().upper() or "URL",
                relative_path,
                now,
                now,
            ),
        )
        row = conn.execute(
            "select * from canary_tokens where id = ?", (cur.lastrowid,)
        ).fetchone()
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="deception.canary_generate",
            summary=f"Generated canary token {payload.label.strip()}",
            severity="medium",
            target_type="canary_token",
            target_id=cur.lastrowid,
            metadata={
                "label": payload.label.strip(),
                "token_type": payload.type.strip().upper() or "URL",
                "relative_path": relative_path,
            },
        )
    return _serialize_canary(dict(row))


@router.post("/deception/protocols/toggle")
def deception_protocol_toggle(
    payload: DeceptionProtocolTogglePayload,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if payload.protocol not in DEFAULT_DECEPTION_PROTOCOLS:
        raise HTTPException(status_code=404, detail="Unknown deception protocol.")
    with db() as conn:
        protocols = _merge_protocols(
            _json_setting(
                conn,
                "deception_protocols",
                DEFAULT_DECEPTION_PROTOCOLS,
                user_id=int(user["id"]),
            )
        )
        protocols[payload.protocol] = bool(payload.active)
        _save_runtime_state(conn, user_id=int(user["id"]), protocols=protocols)
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="deception.protocol_toggle",
            summary=f"Set deception protocol {payload.protocol} to {'enabled' if protocols[payload.protocol] else 'disabled'}",
            severity="medium",
            target_type="deception_protocol",
            target_id=payload.protocol,
            metadata={
                "protocol": payload.protocol,
                "active": protocols[payload.protocol],
            },
        )
    return {
        "status": "success",
        "protocol": payload.protocol,
        "active": protocols[payload.protocol],
        "protocols": protocols,
    }


@router.post("/protocols/{module_name}/toggle")
def runtime_module_toggle(
    module_name: str,
    payload: RuntimeModuleTogglePayload,
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    with db() as conn:
        site_ids = _site_ids_for_user(conn, int(user["id"]))
        modules = _merge_runtime_modules(
            _json_setting(
                conn,
                "protocol_runtime_modules",
                DEFAULT_RUNTIME_MODULES,
                user_id=int(user["id"]),
            )
        )
        if module_name not in modules:
            raise HTTPException(status_code=404, detail="Unknown runtime module.")
        modules[module_name]["enabled"] = bool(payload.enabled)
        _save_runtime_state(conn, user_id=int(user["id"]), runtime_modules=modules)
        rows = _scoped_event_rows(conn, site_ids, limit=120)
        runtime = _build_runtime_state(conn, rows, user_id=int(user["id"]))
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="protocol.runtime_module_toggle",
            summary=f"Set runtime module {module_name} to {'enabled' if modules[module_name]['enabled'] else 'disabled'}",
            severity="medium",
            target_type="runtime_module",
            target_id=module_name,
            metadata={
                "module": module_name,
                "enabled": modules[module_name]["enabled"],
            },
        )
    return {
        "status": "success",
        "module": runtime["modules"][module_name],
        "summary": runtime["summary"],
    }


@router.get("/protocols/status")
def protocols_status(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=120
        )
        runtime = _build_runtime_state(conn, rows, user_id=int(user["id"]))
    return {
        "summary": runtime["summary"],
        "modules": runtime["modules"],
        "persistence": runtime["persistence"],
    }


@router.get("/protocols/metrics")
def protocols_metrics(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=200
        )
        runtime = _build_runtime_state(conn, rows, user_id=int(user["id"]))
    return {"metrics": runtime["metrics"]}


@router.get("/protocols/alerts")
def protocols_alerts(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=200
        )
        runtime = _build_runtime_state(conn, rows, user_id=int(user["id"]))
    return {"alerts": runtime["alerts"]}


@router.get("/system/status")
def system_status(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=120
        )
        return _system_snapshot(conn, rows, user_id=int(user["id"]))


@router.get("/attacker/profiles")
def attacker_profiles(
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=120
        )
    profiles = []
    campaigns = _correlate_campaigns(rows, limit=6)
    for index, item in enumerate(campaigns, start=1):
        skill_score = min(
            99,
            int(
                float(item["max_score"]) * 0.55
                + int(item["event_count"]) * 4
                + int(item["surface_count"]) * 5
                + int(item["credential_attempts"]) * 6
                + int(item["interactive_events"]) * 5
            ),
        )
        alias_prefix = (
            "BOT" if item["attacker_type"] in {"bot", "scanner", "crawler"} else "ACTOR"
        )
        profiles.append(
            {
                "session_id": item["session_id"],
                "ip": item["ip"],
                "alias": f"{alias_prefix}-{index:02d}",
                "skillScore": skill_score,
                "severity": item["severity"],
                "type": str(item["attacker_type"]).title(),
                "intent": item["primary_tactic"],
                "event_count": item["event_count"],
                "duration": item["duration"],
                "complexity": "High"
                if skill_score >= 75
                else "Medium"
                if skill_score >= 40
                else "Low",
                "dna": stable_hash(f"{item['ip']}|{item['session_id'] or index}")[
                    :8
                ].upper(),
                "geo": item["geo"],
                "last_seen": item["last_seen"],
                "campaign": item["label"],
                "confidence": item["confidence"],
                "recommended_action": item["recommended_action"],
                "surface_count": item["surface_count"],
            }
        )
    return profiles


@router.get("/mapping/mitre")
def mitre_mapping(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=120
        )
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        tactic = row.get("mitre_tactic") or "Reconnaissance"
        grouped.setdefault(tactic, []).append(
            {
                "cmd": row.get("cmd") or row.get("url_path") or row.get("event_type"),
                "technique": row.get("mitre_technique") or "Unknown Technique",
                "severity": row.get("severity") or "low",
                "timestamp": row.get("created_at"),
                "ip": row.get("ip"),
            }
        )
    return grouped


def _build_audit_log_items(
    event_rows, blocked_rows, operator_rows
) -> list[dict[str, Any]]:
    logs = [{**frontend_event(row), "source": "incident"} for row in event_rows]
    for row in blocked_rows:
        logs.append(
            {
                "source": "response",
                "ts": row["created_at"],
                "timestamp": row["created_at"],
                "timestamp_utc": row["created_at"],
                "ip": row["ip"],
                "cmd": f"block-ip ({row['reason'] or 'manual'})",
                "deception_mode": "SOC RESPONSE",
                "risk_score": 99.0,
                "severity": "high",
            }
        )
    logs.extend(operator_action_log_entry(dict(row)) for row in operator_rows)
    return logs


def _matches_audit_log_filters(
    log: dict[str, Any], *, search: str, severity: str, source: str
) -> bool:
    normalized_source = str(source or "all").strip().lower() or "all"
    if (
        normalized_source != "all"
        and str(log.get("source") or "").strip().lower() != normalized_source
    ):
        return False

    normalized_severity = str(severity or "all").strip().lower() or "all"
    if (
        normalized_severity != "all"
        and str(log.get("severity") or "").strip().lower() != normalized_severity
    ):
        return False

    query = str(search or "").strip().lower()
    if not query:
        return True

    haystacks = [
        log.get("cmd"),
        log.get("ip"),
        log.get("deception_mode"),
        log.get("source"),
        log.get("action"),
        log.get("actor_username"),
        log.get("target_type"),
        log.get("target_id"),
        log.get("session_id"),
        log.get("event_type"),
    ]
    return any(query in str(value or "").lower() for value in haystacks)


def _serialize_audit_logs_csv(logs: list[dict[str, Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "timestamp_utc",
            "source",
            "severity",
            "risk_score",
            "ip",
            "action_command",
            "deception_mode",
            "actor_username",
            "action",
            "target_type",
            "target_id",
            "session_id",
        ]
    )
    for item in logs:
        writer.writerow(
            [
                item.get("timestamp_utc")
                or item.get("timestamp")
                or item.get("ts")
                or "",
                item.get("source") or "",
                item.get("severity") or "",
                item.get("risk_score") or "",
                item.get("ip") or "",
                item.get("cmd") or "",
                item.get("deception_mode") or "",
                item.get("actor_username") or "",
                item.get("action") or "",
                item.get("target_type") or "",
                item.get("target_id") or "",
                item.get("session_id") or "",
            ]
        )
    return buffer.getvalue()


@router.get("/audit/logs")
def audit_logs(
    search: str = Query(default=""),
    severity: str = Query(default="all"),
    source: str = Query(default="all"),
    limit: int = Query(default=100, ge=1, le=500),
    export_format: str = Query(default="json", alias="format"),
    user: dict[str, Any] = Depends(current_user),
):
    normalized_source = str(source or "all").strip().lower() or "all"
    if normalized_source not in AUDIT_LOG_SOURCES:
        raise HTTPException(status_code=400, detail="Invalid audit log source filter.")

    normalized_format = str(export_format or "json").strip().lower() or "json"
    if normalized_format not in {"json", "csv"}:
        raise HTTPException(status_code=400, detail="Invalid audit log export format.")

    raw_limit = min(max(limit * 4, 120), 1000)
    with db() as conn:
        event_rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=raw_limit
        )
        blocked_rows = conn.execute(
            "select ip, reason, created_at from blocked_ips where user_id = ? order by datetime(created_at) desc limit ?",
            (int(user["id"]), raw_limit),
        ).fetchall()
        operator_rows = conn.execute(
            "select * from operator_actions where user_id = ? order by datetime(created_at) desc limit ?",
            (int(user["id"]), raw_limit),
        ).fetchall()
    logs = _build_audit_log_items(event_rows, blocked_rows, operator_rows)
    logs.sort(
        key=lambda item: item.get("ts") or item.get("timestamp") or "", reverse=True
    )
    filtered_logs = [
        log
        for log in logs
        if _matches_audit_log_filters(
            log, search=search, severity=severity, source=normalized_source
        )
    ][:limit]

    if normalized_format == "csv":
        csv_content = _serialize_audit_logs_csv(filtered_logs)
        headers = {
            "Content-Disposition": 'attachment; filename="cybersentinel-audit-logs.csv"'
        }
        return StreamingResponse(
            iter([csv_content]), media_type="text/csv", headers=headers
        )

    return filtered_logs


@router.get("/forensics/artifacts")
def forensics_artifacts(
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=12
        )
        transcript_artifacts = _terminal_transcript_artifacts(
            conn, int(user["id"]), rows
        )
    event_artifacts = [
        {
            "name": f"artifact_{row['id']}.json",
            "kind": "Event Snapshot",
            "type": "terminal" if row["cmd"] else "network",
            "ip": row["ip"],
            "session_id": row["session_id"],
            "first_seen": row["created_at"],
            "last_seen": row["created_at"],
            "summary": row.get("cmd") or row.get("url_path") or row.get("event_type"),
            "hash": stable_hash(
                f"{row['id']}|{row.get('session_id')}|{row.get('cmd') or row.get('url_path') or row.get('event_type')}",
                32,
            ),
        }
        for row in rows
    ]
    combined = transcript_artifacts + event_artifacts
    combined.sort(
        key=lambda item: item.get("last_seen") or item.get("first_seen") or "",
        reverse=True,
    )
    return combined[:12]


@router.get("/forensics/transcript/{session_id}")
def forensics_transcript(
    session_id: str, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    with db() as conn:
        state = _terminal_sessions(conn, int(user["id"])).get(session_id) or {}
        entries = _terminal_transcript_entries(state)
        session_rows = _scoped_session_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), session_id
        )
    if not entries:
        entries = _transcript_entries_from_rows(session_rows)
    if not entries:
        raise HTTPException(status_code=404, detail="Transcript not found.")
    return {
        "session_id": session_id,
        "summary": {
            "commands": len(entries),
            "blocked": sum(1 for entry in entries if entry.get("status") == "blocked"),
            "execution_modes": sorted(
                {entry.get("execution_mode") or "emulated" for entry in entries}
            ),
            "first_seen": entries[0]["ts"],
            "last_seen": entries[-1]["ts"],
            "hash": _transcript_hash(entries),
            "ip": session_rows[0]["ip"] if session_rows else None,
        },
        "entries": entries,
    }


@router.get("/forensics/behavior/{session_id}")
def forensics_behavior(
    session_id: str, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_session_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), session_id
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Session not found.")
    score = round(sum(float(row["score"]) for row in rows) / max(len(rows), 1))
    cmd_count = sum(1 for row in rows if row.get("cmd"))
    recon_count = sum(
        1 for row in rows if (row.get("mitre_tactic") or "").lower() == "reconnaissance"
    )
    credential_count = sum(
        1
        for row in rows
        if (row.get("mitre_tactic") or "").lower() == "credential access"
    )
    bot_probability = min(95, 20 + recon_count * 12 + max(0, len(rows) - cmd_count) * 5)
    return {
        "session_id": session_id,
        "behavior": "Credential-focused probing"
        if credential_count
        else "Reconnaissance and environment discovery",
        "bot_probability": bot_probability,
        "human_likelihood": max(5, 100 - bot_probability),
        "skill_level": "Intermediate" if score < 75 else "Advanced",
        "exploit_chain_depth": max(
            1, len({row.get("mitre_tactic") for row in rows if row.get("mitre_tactic")})
        ),
    }


@router.get("/soc/playbooks/{session_id}")
def soc_playbook(
    session_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    with db() as conn:
        rows = _scoped_session_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), session_id
        )
    if not rows:
        return []
    focus = (
        "Rotate exposed secrets"
        if any(
            (row.get("mitre_tactic") or "").lower() == "credential access"
            for row in rows
        )
        else "Harden exposed routes"
    )
    return [
        {
            "session_id": session_id,
            "title": "Adaptive Incident Response",
            "steps": [
                "Validate source IP",
                "Preserve telemetry",
                focus,
                "Monitor repeat offender activity",
            ],
        }
    ]


@router.get("/forensics/narrative/{session_id}")
def forensics_narrative(
    session_id: str, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_session_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), session_id
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Session not found.")
    first = rows[0]
    last = rows[-1]
    unique_paths = [row.get("url_path") for row in rows if row.get("url_path")]
    narrative = (
        f"Session {session_id} started with {first.get('event_type')} from {first.get('ip') or 'an unknown source'} "
        f"and progressed through {len(rows)} observed actions. "
        f"The latest behavior mapped to {last.get('mitre_tactic') or 'an unknown tactic'} using "
        f"{last.get('mitre_technique') or 'an unmapped technique'}. "
        f"Primary decoy focus: {unique_paths[0] if unique_paths else last.get('cmd') or last.get('event_type')}."
    )
    return {"session_id": session_id, "narrative": narrative}


@router.get("/forensics/timeline/{session_id}")
def forensics_timeline(
    session_id: str, user: dict[str, Any] = Depends(current_user)
) -> list[dict[str, Any]]:
    with db() as conn:
        rows = _scoped_session_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), session_id
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Session not found.")
    return [
        {
            "cmd": row["cmd"] or row["url_path"] or row["event_type"],
            "res": f"Captured {row['event_type']} event with severity={row['severity']} and score={row['score']}",
            "timestamp": row["created_at"],
        }
        for row in rows
    ]


@router.post("/forensics/final-report")
def final_report(
    payload: dict[str, Any], user: dict[str, Any] = Depends(final_report_rate_limit)
) -> dict[str, Any]:
    ip = payload.get("ip", "unknown")
    session_id = payload.get("session_id", "n/a")
    generated_at = iso_now()
    report_id = f"report-{secrets.token_hex(4)}"
    report = (
        f"Threat summary for {ip}\n"
        f"Session: {session_id}\n"
        "Observed credential-focused reconnaissance with adaptive deception containment.\n"
        "Recommended action: preserve logs, rotate exposed secrets, continue monitoring repeat IP activity."
    )
    integrity_payload = {
        "report_id": report_id,
        "ip": ip,
        "session_id": session_id,
        "generated_at": generated_at,
        "report_sha256": sha256_hex(report),
    }
    integrity_signature = sign_integrity_payload(integrity_payload)
    with db() as conn:
        record_operator_action(
            conn,
            user_id=int(user["id"]),
            actor_username=str(user.get("username") or "operator"),
            action="forensics.final_report",
            summary=f"Generated final report {report_id} for session {session_id}",
            severity="medium",
            target_type="forensics_report",
            target_id=report_id,
            metadata={"ip": ip, "session_id": session_id},
        )
    return {
        "status": "success",
        "report_id": report_id,
        "generated_at": generated_at,
        "integrity_algorithm": "hmac-sha256",
        "integrity_code": integrity_fingerprint(
            integrity_signature, integrity_payload["report_sha256"]
        ),
        "integrity_signature": integrity_signature,
        "integrity_payload": integrity_payload,
        "report": report,
    }


@router.post("/simulator/inject")
def simulator_inject(
    payload: SimulatorPayload, user: dict[str, Any] = Depends(simulator_rate_limit)
) -> dict[str, Any]:
    with db() as conn:
        site_id = _default_site_id_for_user(conn, int(user["id"]))
    event = store_event(
        site_id=site_id,
        event_type=payload.event_type,
        severity=payload.severity,
        score=84
        if payload.severity == "high"
        else 62
        if payload.severity == "medium"
        else 30,
        ip=payload.ip,
        geo="Lab",
        url_path=payload.url_path,
        http_method="GET" if payload.url_path else None,
        cmd=payload.cmd,
        attacker_type="simulator",
        reputation=40,
        mitre_tactic="Execution" if payload.cmd else "Reconnaissance",
        mitre_technique="T1059" if payload.cmd else "T1595",
        policy_strategy="progressive_disclosure",
        policy_risk_score=67,
        captured_data={"simulated": True},
    )
    return {"status": "accepted", "event": event}


@router.post("/terminal/cmd")
def terminal_cmd(
    payload: TerminalCommandPayload,
    user: dict[str, Any] = Depends(terminal_cmd_rate_limit),
) -> dict[str, Any]:
    cmd = payload.cmd.strip()
    requested_session_id = payload.session_id or f"term-{uuid.uuid4().hex[:10]}"
    real_result = _run_terminal_real_exec(requested_session_id, cmd)
    execution_mode = "real" if real_result is not None else "emulated"

    with db() as conn:
        site_id = _default_site_id_for_user(conn, int(user["id"]))
        session_id, state, sessions = _load_terminal_state(
            conn, int(user["id"]), requested_session_id
        )
        if real_result is not None:
            session_id = str(real_result["session_id"])
            if session_id != requested_session_id:
                state = (
                    sessions.get(session_id)
                    if isinstance(sessions.get(session_id), dict)
                    else _terminal_session_state(session_id)
                )
            result = {"output": real_result["output"], "status": real_result["status"]}
            prompt = str(real_result["prompt"])
            cwd = str(real_result["cwd"])
            state["cwd"] = cwd
        else:
            result = _execute_terminal_command(state, cmd)
            state["last_updated"] = iso_now()
            prompt = _terminal_prompt(state)
            cwd = str(state["cwd"])
        if cmd:
            state["history"] = [*(state.get("history") or []), cmd][-40:]
            _append_terminal_transcript(
                state,
                cmd=cmd,
                output=result["output"],
                status=result["status"],
                prompt=prompt,
                cwd=cwd,
                execution_mode=execution_mode,
            )
        state["last_updated"] = iso_now()
        sessions[session_id] = state
        _save_terminal_sessions(conn, int(user["id"]), sessions)

    assessment = _terminal_assessment(cmd, result["output"], result["status"])
    event = None
    if cmd:
        event = store_event(
            site_id=site_id,
            session_id=session_id,
            event_type="shell_command",
            severity=assessment["severity"],
            score=assessment["score"],
            ip="203.0.113.9",
            geo="Terminal",
            url_path=None,
            http_method=None,
            cmd=cmd,
            attacker_type="interactive",
            reputation=77,
            mitre_tactic=assessment["mitre_tactic"],
            mitre_technique=assessment["mitre_technique"],
            policy_strategy=assessment["policy_strategy"],
            policy_risk_score=assessment["policy_risk_score"],
            captured_data={
                "terminal": True,
                "cwd": cwd,
                "session_id": session_id,
                "status": result["status"],
                "high_interaction": True,
                "execution_mode": execution_mode,
                "sandboxed": execution_mode == "real",
            },
        )
    return {
        "output": result["output"],
        "prompt": prompt,
        "session_id": session_id,
        "execution_mode": execution_mode,
        "execution_status": result["status"],
        "ai_metadata": {
            "confidence": int(event["score"]) if event else int(assessment["score"]),
            "intent": assessment["intent"],
            "mitre_tactic": event["mitre_tactic"]
            if event
            else assessment["mitre_tactic"],
            "mitre_technique": event["mitre_technique"]
            if event
            else assessment["mitre_technique"],
            "stage": "interactive",
            "mode": execution_mode,
            "entropy": assessment["entropy"],
            "thought": assessment["thought"],
            "explanation": assessment["explanation"],
            "vulnerabilities": assessment["vulnerabilities"],
        },
    }


@router.post("/ai/expert-advisor")
def ai_expert_advisor(
    payload: AdvisorPayload, _: dict[str, Any] = Depends(ai_advisor_rate_limit)
) -> dict[str, Any]:
    query = payload.query.strip().lower()
    if query == "status":
        answer = "Platform healthy. Telemetry ingestion is active, adaptive decoys are armed, and analyst dashboard data is available."
    else:
        answer = (
            f"[{payload.persona}] Focus on telemetry quality, believable decoys, clean auth flows, and operator response speed. "
            f"Query received: {payload.query}"
        )
    return {
        "response": answer,
        "response_source": "local_model",
        "persona_active": payload.persona,
    }


@router.post("/intel/url-scan")
def url_scan(
    payload: UrlScanPayload, _: dict[str, Any] = Depends(url_scan_rate_limit)
) -> dict[str, Any]:
    score = (
        82
        if any(
            token in payload.url.lower() for token in ["login", "admin", "phpmyadmin"]
        )
        else 26
    )
    return {
        "url": payload.url,
        "risk_score": score,
        "classification": "suspicious" if score >= 70 else "low-risk",
        "indicators": ["exposed credential surface", "admin portal fingerprint"]
        if score >= 70
        else ["no immediate high-risk pattern"],
    }


@router.get("/intelligence/reputation/{search_ip}")
def reputation(
    search_ip: str, user: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    with db() as conn:
        site_ids = _site_ids_for_user(conn, int(user["id"]))
        platform_history_count = _scoped_event_count(conn, site_ids, ip=search_ip)
        blocked = (
            conn.execute(
                "select 1 from blocked_ips where user_id = ? and ip = ? limit 1",
                (int(user["id"]), search_ip),
            ).fetchone()
            is not None
        )
        campaigns = _correlate_campaigns(
            _scoped_event_rows(conn, site_ids, limit=200, ip=search_ip),
            {search_ip} if blocked else set(),
            limit=1,
        )
    campaign = campaigns[0] if campaigns else None
    score = min(
        99,
        (sum(ord(char) for char in search_ip) % 50)
        + 20
        + platform_history_count * 8
        + (15 if blocked else 0)
        + (int(campaign["confidence"]) // 8 if campaign else 0),
    )
    return {
        "ip": search_ip,
        "reputation": {
            "abuse_score": score,
            "usage_type": "hosting" if score >= 60 else "residential",
        },
        "platform_history_count": platform_history_count,
        "is_blacklisted": blocked or score >= 80,
        "label": "suspicious" if score >= 60 else "watch",
        "campaign_type": campaign["campaign_type"] if campaign else None,
        "campaign_label": campaign["label"] if campaign else None,
        "campaign_confidence": campaign["confidence"] if campaign else 0,
        "recommended_action": campaign["recommended_action"] if campaign else "monitor",
        "surface_count": campaign["surface_count"] if campaign else 0,
        "credential_attempts": campaign["credential_attempts"] if campaign else 0,
        "last_seen": campaign["last_seen"] if campaign else None,
    }


@router.get("/intelligence/iocs")
def intelligence_iocs(
    user: dict[str, Any] = Depends(current_user),
) -> list[dict[str, Any]]:
    with db() as conn:
        rows = _scoped_event_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), limit=120
        )
    iocs: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for row in rows:
        candidates = []
        if row.get("ip"):
            candidates.append(("IP", row["ip"]))
        if row.get("url_path"):
            candidates.append(("URL", row["url_path"]))
        if row.get("cmd"):
            candidates.append(("CMD", row["cmd"]))
        for ioc_type, value in candidates:
            key = (ioc_type, value, row.get("ip") or "")
            if key in seen:
                continue
            seen.add(key)
            iocs.append({"type": ioc_type, "value": value, "ip": row.get("ip")})
            if len(iocs) >= 24:
                return iocs
    return iocs


@router.get("/admin/telemetry/summary")
def admin_telemetry_summary(
    hours: int = 24, user: dict[str, Any] = Depends(current_admin_user)
) -> dict[str, Any]:
    with db() as conn:
        user_id = int(user["id"])
        site_ids = _site_ids_for_user(conn, user_id)
        rows = _scoped_event_rows(conn, site_ids, limit=100)
        blocked_lookup = _blocked_ip_lookup(conn, user_id)
        blocked_rows = conn.execute(
            "select ip, reason, created_at from blocked_ips where user_id = ? order by datetime(created_at) desc",
            (user_id,),
        ).fetchall()
        auto_mode = bool(_json_setting(conn, "auto_mode", False, user_id=user_id))
    demo_mode = bool(
        not site_ids and rows and any(bool(row.get("demo_mode")) for row in rows)
    )
    campaigns = _correlate_campaigns(rows, blocked_lookup, limit=5)
    auto_response_rows = [
        row
        for row in blocked_rows
        if str(row["reason"] or "").startswith(AUTO_RESPONSE_REASON_PREFIX)
    ]
    totals = {
        "events": len(rows),
        "unique_ips": len({row["ip"] for row in rows if row.get("ip")}),
        "unique_sessions": len(
            {row["session_id"] for row in rows if row.get("session_id")}
        ),
        "high_risk_events": sum(1 for row in rows if row["severity"] == "high"),
        "avg_score": round(
            sum(float(row["score"]) for row in rows) / max(len(rows), 1), 1
        ),
    }
    type_counts: dict[str, int] = {}
    behavior_counts: dict[str, int] = {}
    decoy_counts: dict[str, int] = {}
    ip_counts: dict[str, int] = {}
    for row in rows:
        event_type = row["event_type"] or "unknown"
        type_counts[event_type] = type_counts.get(event_type, 0) + 1
        behavior = row["policy_strategy"] or "observe"
        behavior_counts[behavior] = behavior_counts.get(behavior, 0) + 1
        decoy = row["url_path"] or row["event_type"]
        decoy_counts[decoy] = decoy_counts.get(decoy, 0) + 1
        if row.get("ip"):
            ip_counts[row["ip"]] = ip_counts.get(row["ip"], 0) + 1
    top_ips = []
    for ip, count in sorted(ip_counts.items(), key=lambda item: item[1], reverse=True)[
        :5
    ]:
        top_ips.append({"ip": ip, "count": count, "blocked": ip in blocked_lookup})
    if demo_mode:
        ai_summary = (
            "Sample incident mode is active for this workspace. Review the seeded route touches, analyst summary, "
            "and session timeline before moving into a live pilot."
        )
    elif campaigns:
        lead_campaign = campaigns[0]
        ai_summary = (
            f"Telemetry indicates {lead_campaign['label'].lower()} from {lead_campaign['ip']} "
            f"across {lead_campaign['surface_count']} surfaces with {lead_campaign['event_count']} events."
        )
    else:
        ai_summary = "Telemetry indicates repeated recon across decoy surfaces with selective escalation into credential-focused probes."
    return {
        "totals": totals,
        "top_event_types": [
            {"event_type": key, "count": value}
            for key, value in sorted(
                type_counts.items(), key=lambda item: item[1], reverse=True
            )[:5]
        ],
        "behavior_breakdown": [
            {"behavior": key, "count": value}
            for key, value in sorted(
                behavior_counts.items(), key=lambda item: item[1], reverse=True
            )[:5]
        ],
        "top_decoys": [
            {"decoy": key, "count": value}
            for key, value in sorted(
                decoy_counts.items(), key=lambda item: item[1], reverse=True
            )[:6]
        ],
        "top_source_ips": top_ips,
        "top_campaigns": campaigns,
        "response_posture": {
            "active_blocks": len(blocked_lookup),
            "repeat_offenders": sum(
                1 for campaign in campaigns if int(campaign["event_count"]) >= 2
            ),
            "repeat_threshold": 2,
            "window_minutes": hours * 60,
            "auto_block_enabled": auto_mode,
            "auto_responses": len(auto_response_rows),
            "last_auto_response": auto_response_rows[0]["created_at"]
            if auto_response_rows
            else None,
        },
        "ai_summary": ai_summary,
        "demo_mode": demo_mode,
    }


@router.get("/admin/telemetry/sessions")
def admin_telemetry_sessions(
    hours: int = 24, limit: int = 20, user: dict[str, Any] = Depends(current_admin_user)
) -> dict[str, Any]:
    with db() as conn:
        site_ids = _site_ids_for_user(conn, int(user["id"]))
        clause, params = _site_scope_clause(site_ids)
        rows = conn.execute(
            """
            select session_id, max(created_at) as last_seen, count(*) as event_count, max(score) as max_score,
                   max(case when severity = 'high' then 3 when severity = 'medium' then 2 else 1 end) as severity_rank
            from events
            where session_id is not null and """
            + clause
            + """
            group by session_id
            order by datetime(last_seen) desc
            limit ?
            """,
            (*params, limit),
        ).fetchall()
        demo_mode = False
        if rows:
            items = []
            for row in rows:
                rank = row["severity_rank"]
                severity = "high" if rank == 3 else "medium" if rank == 2 else "low"
                items.append(
                    {
                        "session_id": row["session_id"],
                        "severity": severity,
                        "event_count": row["event_count"],
                        "max_score": row["max_score"],
                        "last_seen": row["last_seen"],
                    }
                )
        elif not site_ids:
            items = _session_items_from_rows(
                _sample_incident_rows(limit=len(SAMPLE_INCIDENT_TEMPLATES)),
                limit=limit,
            )
            demo_mode = True
        else:
            items = []
    return {"hours": hours, "items": items, "demo_mode": demo_mode}


@router.get("/admin/telemetry/events")
def admin_telemetry_events(
    hours: int = 24,
    limit: int = 30,
    offset: int = 0,
    user: dict[str, Any] = Depends(current_admin_user),
) -> dict[str, Any]:
    with db() as conn:
        site_ids = _site_ids_for_user(conn, int(user["id"]))
        rows = _scoped_event_rows(conn, site_ids, limit=limit, offset=offset)
    demo_mode = bool(
        not site_ids and rows and any(bool(row.get("demo_mode")) for row in rows)
    )
    items = []
    for row in rows:
        item = normalize_event(row)
        items.append(
            {
                "id": item["id"],
                "event_type": item["event_type"],
                "behavior": item["policy_strategy"] or "observe",
                "ip": item["ip"],
                "score": item["score"],
                "decoy": item["url_path"] or item["event_type"],
                "severity": item["severity"],
                "timestamp": item["created_at"],
            }
        )
    return {"hours": hours, "items": items, "demo_mode": demo_mode}


@router.get("/admin/telemetry/sessions/{session_id}/timeline")
def admin_telemetry_session_timeline(
    session_id: str, user: dict[str, Any] = Depends(current_admin_user)
) -> dict[str, Any]:
    with db() as conn:
        rows = _scoped_session_rows(
            conn, _site_ids_for_user(conn, int(user["id"])), session_id
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Session not found.")
    demo_mode = any(bool(row.get("demo_mode")) for row in rows)
    return {
        "items": [
            {
                "event_id": row["id"],
                "step": index + 1,
                "event_type": row["event_type"],
                "severity": row["severity"],
                "score": row["score"],
                "path": row["url_path"],
                "command": row["cmd"],
                "behavior": row["policy_strategy"] or "observe",
                "timestamp": row["created_at"],
            }
            for index, row in enumerate(rows)
        ],
        "summary": f"{len(rows)} events reconstructed for session {session_id}.",
        "demo_mode": demo_mode,
    }


@router.post("/analytics/event")
def analytics_event(payload: dict[str, Any], request: Request) -> dict[str, Any]:
    record = _build_analytics_record(payload, request)
    created_at = iso_now()
    with db() as conn:
        site_id = _resolve_public_site_id(conn, request)
        conn.execute(
            "insert into analytics_events (name, page_path, payload, created_at) values (?, ?, ?, ?)",
            (
                record["event_name"],
                record["page_path"],
                json.dumps(record),
                created_at,
            ),
        )
    promoted = _promote_analytics_event(request, site_id, record, created_at)
    return {
        "status": "ok",
        "event_name": record["event_name"],
        "site_matched": site_id is not None,
        "promoted": promoted is not None,
    }


@router.websocket("/ws/incidents")
async def ws_incidents(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        user = await current_websocket_user(websocket)
    except WebSocketException as exc:
        with suppress(Exception):
            await websocket.close(code=exc.code, reason=exc.reason)
        return
    try:
        while True:
            with db() as conn:
                rows = _scoped_event_rows(
                    conn, _site_ids_for_user(conn, int(user["id"])), limit=1
                )
                row = rows[0] if rows else None
            payload = (
                frontend_event(row) if row else {"type": "keepalive", "ts": iso_now()}
            )
            await websocket.send_json(payload)
            if await _websocket_wait_for_disconnect(websocket, timeout_seconds=10):
                return
    except WebSocketDisconnect:
        return
    except Exception:
        logger.exception("ws_incidents loop failed.")
        with suppress(Exception):
            await websocket.close()


async def _websocket_wait_for_disconnect(websocket: WebSocket, timeout_seconds: float) -> bool:
    try:
        message = await asyncio.wait_for(websocket.receive(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        return False
    except WebSocketDisconnect:
        return True
    except RuntimeError:
        # Starlette raises RuntimeError when the close frame has already been processed.
        return True
    return str(message.get("type") or "") == "websocket.disconnect"


@router.websocket("/ws/system")
async def ws_system(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        user = await current_websocket_user(websocket)
    except WebSocketException as exc:
        with suppress(Exception):
            await websocket.close(code=exc.code, reason=exc.reason)
        return
    try:
        while True:
            with db() as conn:
                rows = _scoped_event_rows(
                    conn, _site_ids_for_user(conn, int(user["id"])), limit=80
                )
                system = _system_snapshot(conn, rows, user_id=int(user["id"]))
            await websocket.send_json(
                {
                    "cpu": system["cpu"],
                    "memory": system["memory"],
                    "latency": system["latency"],
                    "ts": iso_now(),
                }
            )
            if await _websocket_wait_for_disconnect(websocket, timeout_seconds=10):
                return
    except WebSocketDisconnect:
        return
    except Exception:
        logger.exception("ws_system loop failed.")
        with suppress(Exception):
            await websocket.close()


@router.get("/canary/{token}", response_class=PlainTextResponse)
def trigger_canary(token: str, request: Request) -> str:
    with db() as conn:
        row = conn.execute(
            "select * from canary_tokens where token = ?", (token,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Canary token not found.")
        now = iso_now()
        source_ip = request.client.host if request.client else "unknown"
        conn.execute(
            "update canary_tokens set triggered = 1, triggered_at = ?, triggered_ip = ?, updated_at = ? where token = ?",
            (now, source_ip, now, token),
        )
    store_event(
        site_id=row.get("site_id"),
        event_type="canary_trigger",
        severity="high",
        score=92,
        ip=source_ip,
        geo="Internet",
        url_path=f"/canary/{token}",
        http_method=request.method,
        cmd=None,
        attacker_type="canary",
        reputation=85,
        mitre_tactic="Credential Access",
        mitre_technique="T1552",
        policy_strategy="aggressive_containment",
        policy_risk_score=95,
        captured_data={"headers": dict(request.headers)},
    )
    return "ok"


@router.get("/research/experiments/latest")
@router.get("/research/experiments/{run_id}")
def research_runs(
    run_id: str | None = None, _: dict[str, Any] = Depends(current_user)
) -> dict[str, Any]:
    return {
        "run_id": run_id or "latest",
        "status": "complete",
        "winner": "variant_b",
        "confidence": 0.74,
    }


@router.post("/research/experiments/run")
def research_run(
    _: dict[str, Any] = Depends(research_run_rate_limit),
) -> dict[str, Any]:
    return {"run_id": f"exp-{secrets.token_hex(4)}", "status": "started"}


@router.get("/deception/profiles")
def deception_profiles(
    _: dict[str, Any] = Depends(current_admin_user),
) -> dict[str, Any]:
    return {
        "profiles": [
            {"id": "defensive", "label": "Defensive"},
            {"id": "balanced", "label": "Balanced"},
            {"id": "aggressive", "label": "Aggressive"},
        ]
    }


@router.get("/intelligence/healthz", response_class=PlainTextResponse)
def healthz() -> str:
    return "ok"

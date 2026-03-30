import importlib
import hashlib
import importlib.util
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
COWRIE_BRIDGE_PATH = BACKEND_DIR.parent / "cowrie-bridge" / "main.py"


def load_main(monkeypatch, tmp_path):
    def set_default_env(name: str, value: str) -> None:
        if name not in os.environ:
            monkeypatch.setenv(name, value)

    db_path = tmp_path / "runtime.db"
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "x" * 40)
    monkeypatch.setenv("ENABLE_DEMO_SEED", "false")
    monkeypatch.setenv("ALLOW_SIGNUP", "true")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    set_default_env("SECURITY_HEADERS_ENABLED", "true")
    set_default_env("FORCE_HTTPS_REDIRECT", "false")
    set_default_env("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "8")
    set_default_env("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60")
    set_default_env("LEAD_RATE_LIMIT_MAX_ATTEMPTS", "5")
    set_default_env("LEAD_RATE_LIMIT_WINDOW_SECONDS", "300")
    set_default_env("TERMINAL_REAL_EXEC_ENABLED", "false")
    set_default_env("TERMINAL_SANDBOX_URL", "http://127.0.0.1:5100")
    set_default_env("TERMINAL_EXEC_TIMEOUT_SEC", "4")
    set_default_env("TERMINAL_MAX_OUTPUT_CHARS", "12000")
    set_default_env("SPLUNK_HEC_URL", "")
    set_default_env("SPLUNK_HEC_TOKEN", "")
    set_default_env("SPLUNK_HEC_VERIFY_TLS", "true")
    set_default_env("SPLUNK_HEC_TIMEOUT_SECONDS", "4")
    set_default_env("PROTOCOL_SHARED_SECRET", "test-protocol-secret")
    set_default_env("PROTOCOL_SSH_AUTH_TRAP_ENABLED", "true")
    set_default_env("SSH_DECOY_HEALTH_URL", "http://127.0.0.1:5101/health")
    monkeypatch.delenv("BACKEND_DB_PATH", raising=False)
    monkeypatch.delenv("TRUSTED_HOSTS", raising=False)

    for module_name in [
        "main",
        "core.config",
        "core.database",
        "core.request_security",
        "core.security",
        "core.splunk",
        "core.time_utils",
        "dependencies",
        "routers.auth",
        "routers.leads",
        "routers.sites",
        "routers.telemetry",
        "schemas",
    ]:
        sys.modules.pop(module_name, None)

    module = importlib.import_module("main")
    return importlib.reload(module)


def create_tenant(client: TestClient, *, username: str, email: str, domain: str) -> dict[str, object]:
    signup = client.post(
        "/auth/signup",
        json={"username": username, "email": email, "password": "StrongPass123"},
    )
    assert signup.status_code == 200
    login = client.post("/auth/login", json={"username": username, "password": "StrongPass123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    site = client.post("/sites", headers=headers, json={"name": f"{username}-site", "domain": domain})
    assert site.status_code == 200
    return {"headers": headers, "site": site.json()}


def load_cowrie_bridge():
    spec = importlib.util.spec_from_file_location("cowrie_bridge_main", COWRIE_BRIDGE_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def solve_lead_challenge(client: TestClient) -> dict[str, str]:
    response = client.get("/lead/challenge")
    assert response.status_code == 200
    payload = response.json()
    match = re.search(r"(\d+)\s*\+\s*(\d+)", str(payload.get("prompt") or ""))
    assert match is not None
    answer = int(match.group(1)) + int(match.group(2))
    return {"challenge_id": payload["challenge_id"], "challenge_answer": str(answer)}


def with_lead_challenge(client: TestClient, payload: dict[str, object]) -> dict[str, object]:
    return {**payload, **solve_lead_challenge(client)}


def run_high_confidence_public_campaign(client: TestClient, *, host: str, ip: str) -> None:
    host_headers = {
        "Host": host,
        "X-Forwarded-For": ip,
        "User-Agent": "sqlmap-test/1.0",
    }
    assert client.get("/.env", headers=host_headers).status_code == 200
    assert client.get("/phpmyadmin/", headers=host_headers).status_code == 200
    assert client.post(
        "/phpmyadmin/index.php",
        headers=host_headers,
        data={"pma_username": "root", "pma_password": "Winter2026!"},
        follow_redirects=False,
    ).status_code == 303
    assert client.post(
        "/admin/login",
        headers=host_headers,
        data={"username": "opsadmin", "password": "Winter2026!"},
        follow_redirects=False,
    ).status_code == 303
    assert client.post(
        "/xmlrpc.php",
        headers=host_headers,
        content="<?xml version='1.0'?><methodCall><methodName>system.multicall</methodName></methodCall>",
    ).status_code == 200


def test_health_endpoint(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["service"] == "CyberSentinel Backend"
    assert payload["metrics"]["total_events"] == 0
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"


def test_health_endpoint_sets_request_id_header(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        response = client.get("/health")

    request_id = response.headers.get("x-request-id")
    assert response.status_code == 200
    assert isinstance(request_id, str)
    assert len(request_id) >= 16


def test_health_endpoint_respects_incoming_request_id(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    request_id = "req-smoke-123"
    with TestClient(main.app) as client:
        response = client.get("/health", headers={"X-Request-ID": request_id})

    assert response.status_code == 200
    assert response.headers.get("x-request-id") == request_id


def test_cors_wildcard_disables_credentials_header(monkeypatch, tmp_path):
    monkeypatch.setenv("CORS_ORIGINS", "*")
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "*"
    assert response.headers.get("access-control-allow-credentials") is None


def test_cors_explicit_origin_keeps_credentials_header(monkeypatch, tmp_path):
    monkeypatch.setenv("CORS_ORIGINS", "https://app.cybersentil.online")
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": "https://app.cybersentil.online",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://app.cybersentil.online"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_sensitive_routes_require_auth(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        for method, path in [
            ("GET", "/dashboard/stats"),
            ("GET", "/deception/status"),
            ("GET", "/admin/leads"),
            ("GET", "/admin/telemetry/summary"),
            ("POST", "/terminal/cmd"),
        ]:
            if method == "GET":
                response = client.get(path)
            else:
                response = client.post(path, json={"cmd": "status"})
            assert response.status_code == 401, path


def test_admin_routes_require_admin_role(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    database = sys.modules["core.database"]
    security = sys.modules["core.security"]
    time_utils = sys.modules["core.time_utils"]

    with TestClient(main.app) as client:
        with database.db() as conn:
            conn.execute(
                "insert into users (username, email, password_hash, role, created_at) values (?, ?, ?, ?, ?)",
                ("readonly", "readonly@example.com", security.hash_password("StrongPass123"), "user", time_utils.iso_now()),
            )
        login = client.post("/auth/login", json={"username": "readonly", "password": "StrongPass123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        for path in ["/admin/leads/statuses", "/admin/telemetry/summary", "/deception/profiles"]:
            response = client.get(path, headers=headers)
            assert response.status_code == 403, path
            assert response.json()["detail"] == "Insufficient permissions."


def test_public_web_decoy_cookie_uses_runtime_security_flags(monkeypatch, tmp_path):
    monkeypatch.setenv("DECOY_COOKIE_SECURE", "true")
    monkeypatch.setenv("DECOY_COOKIE_SAMESITE", "none")
    main = load_main(monkeypatch, tmp_path)

    with TestClient(main.app) as client:
        create_tenant(client, username="cookieadmin", email="cookieadmin@example.com", domain="cookie.example.com")
        response = client.get("/phpmyadmin/", headers={"Host": "cookie.example.com"})

    assert response.status_code == 200
    set_cookie = response.headers.get("set-cookie", "")
    assert "secure" in set_cookie.lower()
    assert "samesite=none" in set_cookie.lower()


def test_analytics_event_accepts_frontend_payload_and_promotes_public_visit(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    database = sys.modules["core.database"]

    with TestClient(main.app) as client:
        tenant = create_tenant(
            client,
            username="visitorops",
            email="visitorops@example.com",
            domain="cybersentil.online",
        )
        response = client.post(
            "/analytics/event",
            headers={
                "Host": "cybersentil.online",
                "X-Forwarded-For": "198.51.100.77",
                "User-Agent": "Mozilla/5.0 (Telemetry Smoke)",
            },
            json={
                "event_name": "page_visit",
                "event_category": "engagement",
                "page_path": "/pricing",
                "source": "frontend",
                "session_id": "sess_public_1",
                "occurred_at_ms": 1711690000123,
                "properties": {"page_name": "Pricing"},
            },
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["event_name"] == "page_visit"
    assert response.json()["site_matched"] is True
    assert response.json()["promoted"] is True

    with database.db() as conn:
        analytics_row = conn.execute("select * from analytics_events order by id desc limit 1").fetchone()
        event_row = conn.execute("select * from events order by id desc limit 1").fetchone()

    assert analytics_row is not None
    assert analytics_row["name"] == "page_visit"
    assert analytics_row["page_path"] == "/pricing"
    analytics_payload = json.loads(analytics_row["payload"])
    assert analytics_payload["host"] == "cybersentil.online"
    assert analytics_payload["source_ip"] == "198.51.100.77"
    assert analytics_payload["session_id"] == "sess_public_1"

    assert event_row is not None
    assert event_row["site_id"] == tenant["site"]["id"]
    assert event_row["event_type"] == "web_page_visit"
    assert event_row["url_path"] == "/pricing"
    assert event_row["ip"] == "198.51.100.77"
    captured = json.loads(event_row["captured_data"])
    assert captured["event_name"] == "page_visit"
    assert captured["source"] == "frontend-analytics"
    assert captured["properties"]["page_name"] == "Pricing"


def test_production_config_rejects_placeholder_trap_settings(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "s" * 40)
    monkeypatch.setenv("ENABLE_DEMO_SEED", "false")
    monkeypatch.setenv("ALLOW_SIGNUP", "false")
    monkeypatch.setenv("DATABASE_URL", "postgresql://cybersentinel:StrongPostgresPass123!@postgres:5432/cybersentinel")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://cybersentil.online")
    monkeypatch.setenv("CORS_ORIGINS", "https://cybersentil.online")
    monkeypatch.setenv("TRUSTED_HOSTS", "cybersentil.online,www.cybersentil.online")
    monkeypatch.setenv("FORCE_HTTPS_REDIRECT", "true")
    monkeypatch.setenv("SECURITY_HEADERS_ENABLED", "true")
    monkeypatch.setenv("DECOY_COOKIE_SECURE", "true")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "StrongAdminPass123!")
    monkeypatch.setenv("PROTOCOL_SSH_AUTH_TRAP_ENABLED", "true")
    monkeypatch.setenv("PROTOCOL_SSH_TRAP_CREDENTIALS", "CHANGE_THIS_SSH_USER:CHANGE_THIS_SSH_PASSWORD")
    monkeypatch.setenv("PROTOCOL_MYSQL_AUTH_TRAP_ENABLED", "true")
    monkeypatch.setenv("PROTOCOL_MYSQL_TRAP_CREDENTIALS", "CHANGE_THIS_MYSQL_USER:CHANGE_THIS_MYSQL_PASSWORD")
    monkeypatch.setenv("PROTOCOL_SHARED_SECRET", "CHANGE_THIS_INTERNAL_PROTOCOL_SECRET")
    monkeypatch.setenv("TERMINAL_REAL_EXEC_ENABLED", "false")

    sys.modules.pop("core.config", None)
    config = importlib.import_module("core.config")
    config = importlib.reload(config)

    with pytest.raises(RuntimeError) as excinfo:
        config.validate_runtime_config()

    message = str(excinfo.value)
    assert "PROTOCOL_SHARED_SECRET must be a strong non-placeholder value" in message
    assert "PROTOCOL_SSH_TRAP_CREDENTIALS must contain non-placeholder user:pass pairs" in message
    assert "PROTOCOL_MYSQL_TRAP_CREDENTIALS must contain non-placeholder user:pass pairs" in message


def test_production_config_rejects_invalid_sentry_settings(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "s" * 40)
    monkeypatch.setenv("ENABLE_DEMO_SEED", "false")
    monkeypatch.setenv("ALLOW_SIGNUP", "false")
    monkeypatch.setenv("DATABASE_URL", "postgresql://cybersentinel:StrongPostgresPass123!@postgres:5432/cybersentinel")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://cybersentil.online")
    monkeypatch.setenv("CORS_ORIGINS", "https://cybersentil.online")
    monkeypatch.setenv("TRUSTED_HOSTS", "cybersentil.online,www.cybersentil.online")
    monkeypatch.setenv("FORCE_HTTPS_REDIRECT", "true")
    monkeypatch.setenv("SECURITY_HEADERS_ENABLED", "true")
    monkeypatch.setenv("DECOY_COOKIE_SECURE", "true")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "StrongAdminPass123!")
    monkeypatch.setenv("TERMINAL_REAL_EXEC_ENABLED", "false")
    monkeypatch.setenv("PROTOCOL_SSH_AUTH_TRAP_ENABLED", "false")
    monkeypatch.setenv("PROTOCOL_MYSQL_AUTH_TRAP_ENABLED", "false")
    monkeypatch.setenv("SENTRY_DSN", "ftp://invalid-sentry-dsn")
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "2")

    sys.modules.pop("core.config", None)
    config = importlib.import_module("core.config")
    config = importlib.reload(config)

    with pytest.raises(RuntimeError) as excinfo:
        config.validate_runtime_config()

    message = str(excinfo.value)
    assert "SENTRY_DSN must be a valid HTTP/HTTPS URL." in message
    assert "SENTRY_TRACES_SAMPLE_RATE must be between 0.0 and 1.0." in message


def test_auth_site_and_ingest_flow(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "analyst1", "email": "analyst1@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "analyst1", "password": "StrongPass123"})
        assert login.status_code == 200
        token = login.json()["token"]

        site_resp = client.post(
            "/sites",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Primary Site", "domain": "example.com"},
        )
        assert site_resp.status_code == 200
        api_key = site_resp.json()["api_key"]

        ingest = client.post(
            "/ingest",
            headers={"X-API-Key": api_key},
            json={"event_type": "http_probe", "url_path": "/.env", "http_method": "GET"},
        )
        assert ingest.status_code == 200
        assert ingest.json()["status"] == "accepted"

        dashboard = client.get("/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
        assert dashboard.status_code == 200
        assert dashboard.json()["summary"]["total"] == 1


def test_site_api_keys_are_hashed_at_rest(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    database = sys.modules["core.database"]
    security = sys.modules["core.security"]

    with TestClient(main.app) as client:
        tenant = create_tenant(client, username="hashsite", email="hashsite@example.com", domain="hash.example.com")

    with database.db() as conn:
        site = conn.execute("select api_key from sites where id = ?", (tenant["site"]["id"],)).fetchone()

    assert site is not None
    assert site["api_key"] != tenant["site"]["api_key"]
    assert site["api_key"] == security.hash_api_key(tenant["site"]["api_key"])


def test_ingest_migrates_legacy_plaintext_api_keys(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    database = sys.modules["core.database"]
    security = sys.modules["core.security"]

    with TestClient(main.app) as client:
        tenant = create_tenant(client, username="legacysite", email="legacysite@example.com", domain="legacy.example.com")
        raw_api_key = str(tenant["site"]["api_key"])

        with database.db() as conn:
            conn.execute("update sites set api_key = ? where id = ?", (raw_api_key, tenant["site"]["id"]))

        ingest = client.post(
            "/ingest",
            headers={"X-API-Key": raw_api_key},
            json={"event_type": "http_probe", "url_path": "/admin", "http_method": "GET"},
        )

    assert ingest.status_code == 200

    with database.db() as conn:
        site = conn.execute("select api_key from sites where id = ?", (tenant["site"]["id"],)).fetchone()

    assert site is not None
    assert site["api_key"] == security.hash_api_key(raw_api_key)


def test_store_event_dispatches_splunk_forwarding(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    telemetry = sys.modules["routers.telemetry"]
    forwarded: list[dict[str, object]] = []

    def fake_forward(event: dict[str, object], *, background: bool = True) -> bool:
        forwarded.append({"event": dict(event), "background": background})
        return True

    monkeypatch.setattr(telemetry, "forward_event_to_splunk", fake_forward)

    with TestClient(main.app) as client:
        tenant = create_tenant(client, username="splunkuser", email="splunk@example.com", domain="splunk.example.com")
        api_key = tenant["site"]["api_key"]

        ingest = client.post(
            "/ingest",
            headers={"X-API-Key": api_key},
            json={"event_type": "http_probe", "url_path": "/admin", "http_method": "GET"},
        )
        assert ingest.status_code == 200

    assert len(forwarded) == 1
    event = forwarded[0]["event"]
    assert forwarded[0]["background"] is True
    assert event["event_type"] == "http_probe"
    assert event["url_path"] == "/admin"
    assert event["site_id"] == tenant["site"]["id"]


def test_splunk_helper_posts_hec_payload(monkeypatch, tmp_path):
    monkeypatch.setenv("SPLUNK_HEC_URL", "https://splunk.hec.local:8088/services/collector/event")
    monkeypatch.setenv("SPLUNK_HEC_TOKEN", "splunk-test-token")
    monkeypatch.setenv("SPLUNK_HEC_VERIFY_TLS", "false")
    main = load_main(monkeypatch, tmp_path)
    splunk = sys.modules["core.splunk"]
    captured: dict[str, object] = {}

    class FakeResponse:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def getcode(self):
            return 200

    def fake_urlopen(request, timeout=0, context=None):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        captured["headers"] = dict(request.header_items())
        captured["body"] = json.loads(request.data.decode("utf-8"))
        captured["verify_tls_disabled"] = context is not None and getattr(context, "verify_mode", None) == 0
        return FakeResponse()

    monkeypatch.setattr(splunk.urllib.request, "urlopen", fake_urlopen)

    forwarded = splunk.forward_event_to_splunk(
        {
            "id": 7,
            "site_id": 3,
            "session_id": "sess-splunk123",
            "event_type": "ssh_auth",
            "severity": "high",
            "score": 91,
            "ip": "198.51.100.77",
            "geo": "India",
            "created_at": "2026-03-29T10:20:30+00:00",
            "captured_data": {"username": "admin"},
        },
        background=False,
    )

    assert forwarded is True
    assert captured["url"] == "https://splunk.hec.local:8088/services/collector/event"
    assert captured["timeout"] == 4
    headers = captured["headers"]
    assert headers["Authorization"] == "Splunk splunk-test-token"
    assert headers["Content-type"] == "application/json"
    payload = captured["body"]
    assert payload["sourcetype"] == "cybersentinel:honeypot:event"
    assert payload["source"] == "cybersentinel-backend"
    assert payload["event"]["event_type"] == "ssh_auth"
    assert payload["event"]["captured_data"]["username"] == "admin"
    assert payload["event"]["session_id"] == "sess-splunk123"
    assert payload["host"]
    assert captured["verify_tls_disabled"] is True


def test_cowrie_bridge_translates_login_and_command_events(monkeypatch, tmp_path):
    monkeypatch.setenv("COWRIE_SITE_ID", "9")
    bridge = load_cowrie_bridge()

    login_payload = bridge.translate_cowrie_event(
        {
            "eventid": "cowrie.login.success",
            "session": "cowrie-abcd1234",
            "src_ip": "198.51.100.44",
            "username": "root",
            "password": "toor",
            "timestamp": "2026-03-29T12:00:00.000000Z",
        }
    )
    assert login_payload["site_id"] == 9
    assert login_payload["event_type"] == "ssh_auth"
    assert login_payload["accepted"] is True
    assert login_payload["status"] == "accepted"
    assert login_payload["metadata"]["cowrie_eventid"] == "cowrie.login.success"

    command_payload = bridge.translate_cowrie_event(
        {
            "eventid": "cowrie.command.input",
            "session": "cowrie-abcd1234",
            "src_ip": "198.51.100.44",
            "input": "cat /etc/passwd",
            "timestamp": "2026-03-29T12:00:02.000000Z",
        }
    )
    assert command_payload["event_type"] == "ssh_command"
    assert command_payload["cmd"] == "cat /etc/passwd"
    assert command_payload["execution_mode"] == "real"


def test_cowrie_bridge_processes_log_file_and_preserves_offsets(monkeypatch, tmp_path):
    log_dir = tmp_path / "cowrie" / "var" / "log" / "cowrie"
    log_dir.mkdir(parents=True)
    log_file = log_dir / "cowrie.json"
    state_file = tmp_path / "cowrie-bridge-state.json"
    log_file.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "eventid": "cowrie.login.failed",
                        "session": "cowrie-a1",
                        "src_ip": "203.0.113.90",
                        "username": "admin",
                        "password": "admin",
                        "timestamp": "2026-03-29T13:10:00.000000Z",
                    }
                ),
                json.dumps(
                    {
                        "eventid": "cowrie.command.input",
                        "session": "cowrie-a1",
                        "src_ip": "203.0.113.90",
                        "input": "uname -a",
                        "timestamp": "2026-03-29T13:10:05.000000Z",
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("COWRIE_JSON_LOG", str(log_file))
    monkeypatch.setenv("COWRIE_BRIDGE_STATE_FILE", str(state_file))
    bridge = load_cowrie_bridge()
    sent: list[dict[str, object]] = []

    assert bridge.process_log_once(lambda payload: sent.append(dict(payload)) or True) is True
    assert len(sent) == 2
    assert sent[0]["event_type"] == "ssh_auth"
    assert sent[1]["cmd"] == "uname -a"

    state = json.loads(state_file.read_text(encoding="utf-8"))
    first_offset = state["offset"]
    assert first_offset > 0

    assert bridge.process_log_once(lambda payload: sent.append(dict(payload)) or True) is True
    assert len(sent) == 2
    state_second = json.loads(state_file.read_text(encoding="utf-8"))
    assert state_second["offset"] == first_offset


def test_password_hashes_upgrade_from_legacy_sha256(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    db_path = tmp_path / "runtime.db"
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "hashuser", "email": "hashuser@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        with sqlite3.connect(db_path) as conn:
            row = conn.execute("select password_hash from users where username = ?", ("hashuser",)).fetchone()
        assert row is not None
        assert row[0] != hashlib.sha256("StrongPass123".encode("utf-8")).hexdigest()
        assert row[0].startswith("$argon2") or row[0].startswith("pbkdf2_sha256$")

        legacy_hash = hashlib.sha256("LegacyPass123".encode("utf-8")).hexdigest()
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                "insert into users (username, email, password_hash, role, created_at) values (?, ?, ?, ?, ?)",
                ("legacyuser", "legacy@example.com", legacy_hash, "admin", "2026-01-01T00:00:00+00:00"),
            )
            conn.commit()

        login = client.post("/auth/login", json={"username": "legacyuser", "password": "LegacyPass123"})
        assert login.status_code == 200

        with sqlite3.connect(db_path) as conn:
            migrated = conn.execute("select password_hash from users where username = ?", ("legacyuser",)).fetchone()
        assert migrated is not None
        assert migrated[0] != legacy_hash
        assert migrated[0].startswith("$argon2") or migrated[0].startswith("pbkdf2_sha256$")


def test_tenant_isolation_scopes_telemetry(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        def create_tenant(username: str, email: str, domain: str) -> tuple[dict[str, str], str]:
            signup = client.post(
                "/auth/signup",
                json={"username": username, "email": email, "password": "StrongPass123"},
            )
            assert signup.status_code == 200

            login = client.post("/auth/login", json={"username": username, "password": "StrongPass123"})
            assert login.status_code == 200
            headers = {"Authorization": f"Bearer {login.json()['token']}"}

            site = client.post("/sites", headers=headers, json={"name": f"{username}-site", "domain": domain})
            assert site.status_code == 200
            return headers, site.json()["api_key"]

        headers_a, api_key_a = create_tenant("tenanta", "tenant-a@example.com", "tenant-a.example.com")
        headers_b, api_key_b = create_tenant("tenantb", "tenant-b@example.com", "tenant-b.example.com")

        ingest_a = client.post(
            "/ingest",
            headers={"X-API-Key": api_key_a},
            json={"event_type": "http_probe", "url_path": "/.env", "http_method": "GET", "ip": "203.0.113.10"},
        )
        ingest_b = client.post(
            "/ingest",
            headers={"X-API-Key": api_key_b},
            json={"event_type": "http_probe", "url_path": "/admin", "http_method": "GET", "ip": "203.0.113.20"},
        )
        assert ingest_a.status_code == 200
        assert ingest_b.status_code == 200

        canary_a = client.post("/deception/canary-tokens/generate", headers=headers_a, json={"label": "Tenant A Canary", "type": "URL"})
        assert canary_a.status_code == 200

        block_a = client.post("/soc/block-ip", headers=headers_a, json={"ip": "203.0.113.10", "reason": "manual"})
        assert block_a.status_code == 200

        dashboard_a = client.get("/dashboard/stats", headers=headers_a)
        dashboard_b = client.get("/dashboard/stats", headers=headers_b)
        assert dashboard_a.status_code == 200
        assert dashboard_b.status_code == 200
        assert dashboard_a.json()["summary"]["total"] == 1
        assert dashboard_b.json()["summary"]["total"] == 1
        assert dashboard_a.json()["feed"][0]["ip"] == "203.0.113.10"
        assert dashboard_b.json()["feed"][0]["ip"] == "203.0.113.20"

        session_a = dashboard_a.json()["feed"][0]["session_id"]

        admin_events_a = client.get("/admin/telemetry/events", headers=headers_a)
        admin_events_b = client.get("/admin/telemetry/events", headers=headers_b)
        assert admin_events_a.status_code == 200
        assert admin_events_b.status_code == 200
        assert len(admin_events_a.json()["items"]) == 1
        assert len(admin_events_b.json()["items"]) == 1
        assert admin_events_a.json()["items"][0]["ip"] == "203.0.113.10"
        assert admin_events_b.json()["items"][0]["ip"] == "203.0.113.20"

        cross_timeline = client.get(f"/admin/telemetry/sessions/{session_a}/timeline", headers=headers_b)
        assert cross_timeline.status_code == 404

        canaries_a = client.get("/deception/canary-tokens", headers=headers_a)
        canaries_b = client.get("/deception/canary-tokens", headers=headers_b)
        assert canaries_a.status_code == 200
        assert canaries_b.status_code == 200
        assert len(canaries_a.json()) == 1
        assert canaries_b.json() == []

        status_a = client.get("/deception/status", headers=headers_a)
        status_b = client.get("/deception/status", headers=headers_b)
        assert status_a.status_code == 200
        assert status_b.status_code == 200
        assert status_a.json()["stats"]["blocked_ips"] == 1
        assert status_b.json()["stats"]["blocked_ips"] == 0


def test_terminal_session_persists_state(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "termuser", "email": "termuser@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "termuser", "password": "StrongPass123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        site = client.post("/sites", headers=headers, json={"name": "term-site", "domain": "term.example.com"})
        assert site.status_code == 200

        pwd_initial = client.post("/terminal/cmd", headers=headers, json={"cmd": "pwd"})
        assert pwd_initial.status_code == 200
        assert pwd_initial.json()["output"] == "/home/admin"
        session_id = pwd_initial.json()["session_id"]
        assert session_id.startswith("term-")

        cd_result = client.post("/terminal/cmd", headers=headers, json={"cmd": "cd /var/www/html", "session_id": session_id})
        assert cd_result.status_code == 200
        assert cd_result.json()["execution_status"] == "ok"
        assert cd_result.json()["prompt"].endswith(":/var/www/html$")

        pwd_after_cd = client.post("/terminal/cmd", headers=headers, json={"cmd": "pwd", "session_id": session_id})
        assert pwd_after_cd.status_code == 200
        assert pwd_after_cd.json()["output"] == "/var/www/html"

        touch_file = client.post("/terminal/cmd", headers=headers, json={"cmd": "touch beacon.txt", "session_id": session_id})
        assert touch_file.status_code == 200
        assert touch_file.json()["execution_status"] == "ok"

        ls_result = client.post("/terminal/cmd", headers=headers, json={"cmd": "ls", "session_id": session_id})
        assert ls_result.status_code == 200
        assert "beacon.txt" in ls_result.json()["output"].splitlines()

        history_result = client.post("/terminal/cmd", headers=headers, json={"cmd": "history", "session_id": session_id})
        assert history_result.status_code == 200
        assert "cd /var/www/html" in history_result.json()["output"]
        assert "touch beacon.txt" in history_result.json()["output"]


def test_terminal_uses_real_sandbox_when_available(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    telemetry = sys.modules["routers.telemetry"]

    def fake_real_exec(session_id: str, cmd: str) -> dict[str, str]:
        assert cmd == "find /var/www/html -maxdepth 1 -type f"
        return {
            "session_id": session_id,
            "output": "/var/www/html/.env\n/var/www/html/index.php",
            "prompt": "admin@web-ops-01:/var/www/html$",
            "cwd": "/var/www/html",
            "status": "ok",
            "execution_mode": "real",
            "engine": "fake",
        }

    monkeypatch.setattr(telemetry, "_run_terminal_real_exec", fake_real_exec)

    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "realterm", "email": "realterm@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "realterm", "password": "StrongPass123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        site = client.post("/sites", headers=headers, json={"name": "real-site", "domain": "real.example.com"})
        assert site.status_code == 200

        response = client.post("/terminal/cmd", headers=headers, json={"cmd": "find /var/www/html -maxdepth 1 -type f"})
        assert response.status_code == 200
        payload = response.json()
        assert payload["execution_mode"] == "real"
        assert payload["execution_status"] == "ok"
        assert payload["prompt"] == "admin@web-ops-01:/var/www/html$"
        assert "/var/www/html/.env" in payload["output"]
        assert payload["ai_metadata"]["mode"] == "real"


def test_forensics_transcript_replays_terminal_session(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "transcriptuser", "email": "transcript@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "transcriptuser", "password": "StrongPass123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        site = client.post("/sites", headers=headers, json={"name": "transcript-site", "domain": "transcript.example.com"})
        assert site.status_code == 200

        first = client.post("/terminal/cmd", headers=headers, json={"cmd": "pwd"})
        assert first.status_code == 200
        session_id = first.json()["session_id"]

        second = client.post("/terminal/cmd", headers=headers, json={"cmd": "cat /etc/passwd", "session_id": session_id})
        assert second.status_code == 200
        assert "root:x:0:0:root" in second.json()["output"]

        transcript = client.get(f"/forensics/transcript/{session_id}", headers=headers)
        assert transcript.status_code == 200
        payload = transcript.json()
        assert payload["session_id"] == session_id
        assert payload["summary"]["commands"] == 2
        assert payload["summary"]["execution_modes"] == ["emulated"]
        assert payload["entries"][0]["cmd"] == "pwd"
        assert payload["entries"][1]["cmd"] == "cat /etc/passwd"
        assert "root:x:0:0:root" in payload["entries"][1]["output"]

        artifacts = client.get("/forensics/artifacts", headers=headers)
        assert artifacts.status_code == 200
        transcript_artifacts = [item for item in artifacts.json() if item["type"] == "transcript"]
        assert transcript_artifacts
        assert transcript_artifacts[0]["session_id"] == session_id
        assert transcript_artifacts[0]["hash"] == payload["summary"]["hash"]


def test_protocols_status_reports_terminal_exec_health(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    telemetry = sys.modules["routers.telemetry"]
    monkeypatch.setattr(
        telemetry,
        "_terminal_sandbox_health",
        lambda: {
            "enabled": True,
            "mode": "hybrid",
            "healthy": True,
            "reachable": True,
            "engine": "proot",
            "status": "healthy",
            "fallback": "emulated",
        },
    )
    monkeypatch.setattr(
        telemetry,
        "_ssh_listener_health",
        lambda: {
            "enabled": True,
            "healthy": True,
            "reachable": True,
            "status": "healthy",
            "engine": "asyncssh",
            "active_sessions": 2,
        },
    )

    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "healthuser", "email": "health@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "healthuser", "password": "StrongPass123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        site = client.post("/sites", headers=headers, json={"name": "health-site", "domain": "health.example.com"})
        assert site.status_code == 200

        response = client.get("/protocols/status", headers=headers)
        assert response.status_code == 200
        payload = response.json()
        assert payload["persistence"]["terminal_exec"]["healthy"] is True
        assert payload["persistence"]["terminal_exec"]["engine"] == "proot"
        assert payload["persistence"]["terminal_exec"]["mode"] == "hybrid"
        assert payload["persistence"]["ssh_listener"]["healthy"] is True
        assert payload["persistence"]["ssh_listener"]["active_sessions"] == 2


def test_internal_protocol_ingest_reconstructs_ssh_transcript(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "sshuser", "email": "sshuser@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "sshuser", "password": "StrongPass123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        site = client.post("/sites", headers=headers, json={"name": "ssh-site", "domain": "ssh.example.com"})
        assert site.status_code == 200
        site_id = site.json()["id"]
        session_id = "ssh-deadbeef01"

        auth_event = client.post(
            "/internal/protocols/event",
            headers={"X-Protocol-Secret": "test-protocol-secret"},
            json={
                "protocol": "ssh",
                "site_id": site_id,
                "session_id": session_id,
                "event_type": "ssh_auth",
                "phase": "auth",
                "ip": "203.0.113.44",
                "geo": "SSH Decoy",
                "username": "admin",
                "password": "Winter2026!",
                "accepted": True,
                "status": "accepted",
            },
        )
        assert auth_event.status_code == 200
        assert auth_event.json()["status"] == "accepted"

        command_event = client.post(
            "/internal/protocols/event",
            headers={"X-Protocol-Secret": "test-protocol-secret"},
            json={
                "protocol": "ssh",
                "site_id": site_id,
                "session_id": session_id,
                "event_type": "ssh_command",
                "phase": "interaction",
                "ip": "203.0.113.44",
                "geo": "SSH Decoy",
                "username": "admin",
                "cmd": "whoami",
                "output": "admin",
                "prompt": "admin@web-ops-01:~$",
                "cwd": "/home/admin",
                "status": "ok",
                "execution_mode": "real",
            },
        )
        assert command_event.status_code == 200
        assert command_event.json()["event"]["event_type"] == "shell_command"

        dashboard = client.get("/dashboard/stats", headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()["summary"]["total"] == 2

        transcript = client.get(f"/forensics/transcript/{session_id}", headers=headers)
        assert transcript.status_code == 200
        transcript_payload = transcript.json()
        assert transcript_payload["summary"]["commands"] == 1
        assert transcript_payload["summary"]["execution_modes"] == ["real"]
        assert transcript_payload["entries"][0]["cmd"] == "whoami"
        assert transcript_payload["entries"][0]["output"] == "admin"

        events = client.get("/admin/telemetry/events", headers=headers)
        assert events.status_code == 200
        assert any(item["event_type"] == "ssh_auth" for item in events.json()["items"])


def test_public_phpmyadmin_decoy_is_host_scoped(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        def create_tenant(username: str, email: str, domain: str) -> dict[str, str]:
            signup = client.post(
                "/auth/signup",
                json={"username": username, "email": email, "password": "StrongPass123"},
            )
            assert signup.status_code == 200
            login = client.post("/auth/login", json={"username": username, "password": "StrongPass123"})
            assert login.status_code == 200
            headers = {"Authorization": f"Bearer {login.json()['token']}"}
            site = client.post("/sites", headers=headers, json={"name": f"{username}-site", "domain": domain})
            assert site.status_code == 200
            return headers

        headers_a = create_tenant("decoyowner", "decoy@example.com", "decoy.example.com")
        headers_b = create_tenant("otherowner", "other@example.com", "other.example.com")
        host_headers = {"Host": "decoy.example.com", "User-Agent": "sqlmap-test"}

        probe = client.get("/phpmyadmin/", headers=host_headers)
        assert probe.status_code == 200
        assert "phpMyAdmin" in probe.text

        login = client.post(
            "/phpmyadmin/index.php",
            headers=host_headers,
            data={"pma_username": "root", "pma_password": "Winter2026!"},
            follow_redirects=False,
        )
        assert login.status_code == 303

        sql = client.post(
            "/phpmyadmin/sql.php",
            headers=host_headers,
            data={"query": "SHOW DATABASES"},
        )
        assert sql.status_code == 200
        assert "crm_portal" in sql.text

        dashboard_a = client.get("/dashboard/stats", headers=headers_a)
        dashboard_b = client.get("/dashboard/stats", headers=headers_b)
        assert dashboard_a.status_code == 200
        assert dashboard_b.status_code == 200
        assert dashboard_a.json()["summary"]["total"] >= 3
        assert dashboard_b.json()["summary"]["total"] == 0

        events_a = client.get("/admin/telemetry/events", headers=headers_a)
        events_b = client.get("/admin/telemetry/events", headers=headers_b)
        assert events_a.status_code == 200
        assert events_b.status_code == 200
        assert any(item["decoy"] == "/phpmyadmin/sql.php" for item in events_a.json()["items"])
        assert all(str(item["decoy"]).startswith("/phpmyadmin") for item in events_a.json()["items"])
        assert events_b.json()["items"] == []


def test_public_web_decoys_capture_wordpress_admin_xmlrpc_and_lure_files(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "webowner", "email": "webowner@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200
        login = client.post("/auth/login", json={"username": "webowner", "password": "StrongPass123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}
        site = client.post("/sites", headers=headers, json={"name": "web-site", "domain": "lure.example.com"})
        assert site.status_code == 200

        host_headers = {"Host": "lure.example.com", "User-Agent": "curl/8.6.0"}

        env_file = client.get("/.env", headers=host_headers)
        assert env_file.status_code == 200
        assert "DB_PASSWORD" in env_file.text

        actuator = client.get("/actuator/env", headers=host_headers)
        assert actuator.status_code == 200
        assert actuator.json()["activeProfiles"] == ["prod"]

        users = client.get("/api/v1/users", headers=host_headers)
        assert users.status_code == 200
        assert users.json()["items"][0]["username"] == "svc_portal"

        wp_login = client.get("/wp-login.php", headers=host_headers)
        assert wp_login.status_code == 200
        assert "WordPress" in wp_login.text

        wp_submit = client.post(
            "/wp-login.php",
            headers=host_headers,
            data={"log": "administrator", "pwd": "Winter2026!"},
            follow_redirects=False,
        )
        assert wp_submit.status_code == 303

        wp_admin = client.get("/wp-admin/", headers=host_headers)
        assert wp_admin.status_code == 200
        assert "WordPress Dashboard" in wp_admin.text

        admin_login = client.post(
            "/admin/login",
            headers=host_headers,
            data={"username": "opsadmin", "password": "Winter2026!"},
            follow_redirects=False,
        )
        assert admin_login.status_code == 303

        admin_portal = client.get("/admin/portal", headers=host_headers)
        assert admin_portal.status_code == 200
        assert "Secure Operations Portal" in admin_portal.text

        xmlrpc = client.post(
            "/xmlrpc.php",
            headers=host_headers,
            content="<?xml version='1.0'?><methodCall><methodName>wp.getUsersBlogs</methodName></methodCall>",
        )
        assert xmlrpc.status_code == 200
        assert "Authentication required" in xmlrpc.text

        dashboard = client.get("/dashboard/stats", headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()["summary"]["total"] >= 7

        events = client.get("/admin/telemetry/events", headers=headers)
        assert events.status_code == 200
        event_paths = {item["decoy"] for item in events.json()["items"]}
        assert "/.env" in event_paths
        assert "/wp-login.php" in event_paths
        assert "/admin/login" in event_paths
        assert "/xmlrpc.php" in event_paths
        assert "/actuator/env" in event_paths
        assert "/api/v1/users" in event_paths


def test_campaign_correlation_enriches_profiles_summary_alerts_and_reputation(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "intelowner", "email": "intelowner@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200
        login = client.post("/auth/login", json={"username": "intelowner", "password": "StrongPass123"})
        assert login.status_code == 200
        auth_headers = {"Authorization": f"Bearer {login.json()['token']}"}
        site = client.post("/sites", headers=auth_headers, json={"name": "intel-site", "domain": "intel.example.com"})
        assert site.status_code == 200

        host_headers = {
            "Host": "intel.example.com",
            "X-Forwarded-For": "203.0.113.88",
            "User-Agent": "recon-bot/1.0",
        }

        assert client.get("/.env", headers=host_headers).status_code == 200
        assert client.get("/phpmyadmin/", headers=host_headers).status_code == 200
        assert client.post(
            "/phpmyadmin/index.php",
            headers=host_headers,
            data={"pma_username": "root", "pma_password": "Winter2026!"},
            follow_redirects=False,
        ).status_code == 303
        assert client.post(
            "/admin/login",
            headers=host_headers,
            data={"username": "opsadmin", "password": "Winter2026!"},
            follow_redirects=False,
        ).status_code == 303
        assert client.post(
            "/xmlrpc.php",
            headers=host_headers,
            content="<?xml version='1.0'?><methodCall><methodName>system.multicall</methodName></methodCall>",
        ).status_code == 200

        profiles = client.get("/attacker/profiles", headers=auth_headers)
        assert profiles.status_code == 200
        top_profile = profiles.json()[0]
        assert top_profile["ip"] == "203.0.113.88"
        assert top_profile["campaign"] in {"Interactive Intrusion", "Credential Spray", "Multi-Surface Recon"}
        assert top_profile["recommended_action"] in {"block_and_sinkhole", "escalate_decoys", "observe_and_profile", "monitor"}

        summary = client.get("/admin/telemetry/summary", headers=auth_headers)
        assert summary.status_code == 200
        summary_payload = summary.json()
        assert summary_payload["top_campaigns"][0]["ip"] == "203.0.113.88"
        assert summary_payload["top_campaigns"][0]["campaign_type"] in {
            "interactive_intrusion",
            "credential_spray",
            "multi_surface_recon",
        }
        assert "203.0.113.88" in summary_payload["ai_summary"]

        alerts = client.get("/protocols/alerts", headers=auth_headers)
        assert alerts.status_code == 200
        assert any("203.0.113.88" in item["message"] for item in alerts.json()["alerts"])

        reputation = client.get("/intelligence/reputation/203.0.113.88", headers=auth_headers)
        assert reputation.status_code == 200
        assert reputation.json()["campaign_type"] in {"interactive_intrusion", "credential_spray", "multi_surface_recon"}
        assert reputation.json()["recommended_action"] in {"block_and_sinkhole", "escalate_decoys", "observe_and_profile", "monitor"}


def test_auto_mode_blocks_high_confidence_campaign(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        tenant = create_tenant(client, username="autoblock", email="autoblock@example.com", domain="autoblock.example.com")
        headers = tenant["headers"]

        auto_mode = client.post("/deception/auto-mode", headers=headers, json={"enabled": True})
        assert auto_mode.status_code == 200
        assert auto_mode.json()["auto_mode"] is True

        run_high_confidence_public_campaign(client, host="autoblock.example.com", ip="203.0.113.90")

        summary = client.get("/admin/telemetry/summary", headers=headers)
        assert summary.status_code == 200
        payload = summary.json()
        assert payload["response_posture"]["auto_block_enabled"] is True
        assert payload["response_posture"]["active_blocks"] == 1
        assert payload["response_posture"]["auto_responses"] == 1
        assert payload["response_posture"]["last_auto_response"] is not None
        assert payload["top_campaigns"][0]["ip"] == "203.0.113.90"
        assert payload["top_campaigns"][0]["blocked"] is True

        reputation = client.get("/intelligence/reputation/203.0.113.90", headers=headers)
        assert reputation.status_code == 200
        assert reputation.json()["is_blacklisted"] is True
        assert reputation.json()["recommended_action"] == "monitor_block"

        audit = client.get("/audit/logs", headers=headers)
        assert audit.status_code == 200
        assert any(
            item["ip"] == "203.0.113.90" and str(item.get("cmd") or "").startswith("block-ip (auto-campaign:")
            for item in audit.json()
        )


def test_auto_mode_disabled_only_recommends_blocking(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        tenant = create_tenant(client, username="manualmode", email="manualmode@example.com", domain="manualmode.example.com")
        headers = tenant["headers"]

        run_high_confidence_public_campaign(client, host="manualmode.example.com", ip="203.0.113.91")

        summary = client.get("/admin/telemetry/summary", headers=headers)
        assert summary.status_code == 200
        payload = summary.json()
        assert payload["response_posture"]["auto_block_enabled"] is False
        assert payload["response_posture"]["active_blocks"] == 0
        assert payload["response_posture"]["auto_responses"] == 0
        assert payload["top_campaigns"][0]["ip"] == "203.0.113.91"
        assert payload["top_campaigns"][0]["recommended_action"] == "block_and_sinkhole"
        assert payload["top_campaigns"][0]["blocked"] is False

        audit = client.get("/audit/logs", headers=headers)
        assert audit.status_code == 200
        assert not any(str(item.get("cmd") or "").startswith("block-ip (auto-campaign:") for item in audit.json())


def test_auto_mode_blocks_are_tenant_scoped(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        tenant_a = create_tenant(client, username="scopea", email="scopea@example.com", domain="scope-a.example.com")
        tenant_b = create_tenant(client, username="scopeb", email="scopeb@example.com", domain="scope-b.example.com")

        enable = client.post("/deception/auto-mode", headers=tenant_a["headers"], json={"enabled": True})
        assert enable.status_code == 200
        assert enable.json()["auto_mode"] is True

        run_high_confidence_public_campaign(client, host="scope-a.example.com", ip="203.0.113.92")

        summary_a = client.get("/admin/telemetry/summary", headers=tenant_a["headers"])
        summary_b = client.get("/admin/telemetry/summary", headers=tenant_b["headers"])
        assert summary_a.status_code == 200
        assert summary_b.status_code == 200
        assert summary_a.json()["response_posture"]["active_blocks"] == 1
        assert summary_b.json()["response_posture"]["active_blocks"] == 0
        assert summary_b.json()["totals"]["events"] == 0

        reputation_b = client.get("/intelligence/reputation/203.0.113.92", headers=tenant_b["headers"])
        assert reputation_b.status_code == 200
        assert reputation_b.json()["platform_history_count"] == 0
        assert reputation_b.json()["is_blacklisted"] is False


def test_google_auth_requires_real_verification(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        response = client.post("/auth/google", json={"credential": "fake-google-token"})

    assert response.status_code == 503
    assert "Google login is not configured" in response.json()["detail"]


def test_auth_providers_expose_signup_state_and_google_respects_disabled_signup(monkeypatch, tmp_path):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "google-client-id.apps.googleusercontent.com")
    main = load_main(monkeypatch, tmp_path)
    auth_module = sys.modules["routers.auth"]
    database = sys.modules["core.database"]
    security = sys.modules["core.security"]
    time_utils = sys.modules["core.time_utils"]
    monkeypatch.setattr(auth_module, "ALLOW_SIGNUP", False)

    def fake_verify_google_credential(credential: str) -> dict[str, str | bool]:
        email = "existing-google@example.com" if credential == "existing-user-token" else "new-google@example.com"
        return {
            "email": email,
            "sub": f"sub-{credential}",
            "email_verified": True,
            "iss": "https://accounts.google.com",
        }

    monkeypatch.setattr(auth_module, "_verify_google_credential", fake_verify_google_credential)

    with TestClient(main.app) as client:
        with database.db() as conn:
            conn.execute(
                "insert into users (username, email, password_hash, role, created_at) values (?, ?, ?, ?, ?)",
                (
                    "google_existing",
                    "existing-google@example.com",
                    security.hash_password("StrongPass123"),
                    "admin",
                    time_utils.iso_now(),
                ),
            )
        providers = client.get("/auth/providers")
        assert providers.status_code == 200
        assert providers.json()["signup"]["enabled"] is False
        assert providers.json()["providers"]["google"]["enabled"] is True

        existing_user = client.post("/auth/google", json={"credential": "existing-user-token"})
        assert existing_user.status_code == 200
        assert existing_user.json()["new_user"] is False
        assert existing_user.json()["email"] == "existing-google@example.com"

        blocked = client.post("/auth/google", json={"credential": "new-user-token"})

    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "Signup is disabled for this deployment."


def test_biometric_login_disabled_by_default(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        response = client.post("/auth/biometric-login")

    assert response.status_code == 503
    assert "Biometric login is not configured" in response.json()["detail"]


def test_contact_lead_flow(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        lead = client.post(
            "/contact/submit",
            json=with_lead_challenge(
                client,
                {
                "name": "Analyst Contact",
                "email": "ops@example.com",
                "organization": "Cyber Ops",
                "use_case": "Honeypot visibility",
                "message": "Need a guided walkthrough for telemetry triage.",
                "website": "",
                "source": "/contact",
                "campaign": "",
                "utm_source": "",
                "utm_medium": "",
                "utm_campaign": "",
                "challenge_id": None,
                "challenge_answer": None,
                },
            ),
        )
        assert lead.status_code == 200
        assert lead.json()["lead_status"] == "new"
        assert lead.json()["review_state"] == "new"
        assert lead.json()["next_step"] == "team_review"


def test_lead_challenge_requires_valid_signed_token(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    payload = {
        "name": "Challenge Lead",
        "email": "challenge@example.com",
        "organization": "Ops Security",
        "use_case": "Deployment review",
        "message": "Need a deployment readiness walkthrough with operator review.",
        "website": "",
    }
    with TestClient(main.app) as client:
        missing = client.post("/contact/submit", json=payload)
        assert missing.status_code == 400

        valid_challenge = solve_lead_challenge(client)
        wrong_answer = client.post("/contact/submit", json={**payload, **valid_challenge, "challenge_answer": "999"})
        assert wrong_answer.status_code == 400

        tampered_id = valid_challenge["challenge_id"][:-1] + ("A" if valid_challenge["challenge_id"][-1] != "A" else "B")
        tampered = client.post(
            "/contact/submit",
            json={**payload, "challenge_id": tampered_id, "challenge_answer": valid_challenge["challenge_answer"]},
        )
        assert tampered.status_code == 400

        accepted = client.post("/contact/submit", json=with_lead_challenge(client, payload))
        assert accepted.status_code == 200


def test_duplicate_lead_returns_existing_thread_message(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    payload = {
        "name": "Repeat Lead",
        "email": "repeat@example.com",
        "organization": "Ops Team",
        "use_case": "Threat visibility rollout",
        "message": "Need a live workflow walkthrough for our operators.",
        "website": "",
    }
    with TestClient(main.app) as client:
        first = client.post("/demo/submit", json=with_lead_challenge(client, payload))
        assert first.status_code == 200
        assert first.json()["duplicate"] is False

        second = client.post("/demo/submit", json=with_lead_challenge(client, payload))
        assert second.status_code == 200
        assert second.json()["duplicate"] is True
        assert second.json()["review_state"] == "duplicate"
        assert second.json()["next_step"] == "existing_thread"


def test_admin_leads_are_tenant_scoped_by_public_host(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        tenant_a = create_tenant(client, username="leadownera", email="leadownera@example.com", domain="tenant-a.example.com")
        tenant_b = create_tenant(client, username="leadownerb", email="leadownerb@example.com", domain="tenant-b.example.com")

        lead_a = client.post(
            "/contact/submit",
            headers={"Host": "tenant-a.example.com"},
            json=with_lead_challenge(
                client,
                {
                "name": "Tenant A Lead",
                "email": "tenant-a-lead@example.com",
                "organization": "Tenant A Org",
                "use_case": "Tenant isolated SOC workflows",
                "message": "Need a tenant specific walkthrough for our A-team operators.",
                "website": "",
                "source": "/contact",
                },
            ),
        )
        lead_b = client.post(
            "/contact/submit",
            headers={"Host": "tenant-b.example.com"},
            json=with_lead_challenge(
                client,
                {
                "name": "Tenant B Lead",
                "email": "tenant-b-lead@example.com",
                "organization": "Tenant B Org",
                "use_case": "Deception rollout for B-team",
                "message": "Need deployment help for the isolated B-team environment.",
                "website": "",
                "source": "/contact",
                },
            ),
        )
        assert lead_a.status_code == 200
        assert lead_b.status_code == 200

        leads_a = client.get("/admin/leads", headers=tenant_a["headers"])
        leads_b = client.get("/admin/leads", headers=tenant_b["headers"])
        assert leads_a.status_code == 200
        assert leads_b.status_code == 200
        assert leads_a.json()["total"] == 1
        assert leads_b.json()["total"] == 1
        assert leads_a.json()["items"][0]["email"] == "tenant-a-lead@example.com"
        assert leads_b.json()["items"][0]["email"] == "tenant-b-lead@example.com"
        assert leads_a.json()["items"][0]["user_id"] != leads_b.json()["items"][0]["user_id"]

        readiness_a = client.get("/ops/readiness", headers=tenant_a["headers"])
        readiness_b = client.get("/ops/readiness", headers=tenant_b["headers"])
        assert readiness_a.status_code == 200
        assert readiness_b.status_code == 200
        assert readiness_a.json()["coverage"]["leads_total"] == 1
        assert readiness_b.json()["coverage"]["leads_total"] == 1

        owners_a = client.get("/admin/leads/owners", headers=tenant_a["headers"])
        assert owners_a.status_code == 200
        assert owners_a.json()["owners"] == [{"username": "leadownera", "role": "admin"}]

        lead_b_id = int(lead_b.json()["id"])
        detail_cross = client.get(f"/admin/leads/{lead_b_id}", headers=tenant_a["headers"])
        status_cross = client.post(
            f"/admin/leads/{lead_b_id}/status",
            headers=tenant_a["headers"],
            json={"status": "contacted"},
        )
        note_cross = client.post(
            f"/admin/leads/{lead_b_id}/notes",
            headers=tenant_a["headers"],
            json={"note": "Should not be allowed"},
        )
        assign_cross = client.post(
            f"/admin/leads/{lead_b_id}/assign",
            headers=tenant_a["headers"],
            json={"assigned_to": "leadownera"},
        )
        assert detail_cross.status_code == 404
        assert status_cross.status_code == 404
        assert note_cross.status_code == 404
        assert assign_cross.status_code == 404

        export_a = client.get("/admin/leads/export.csv", headers=tenant_a["headers"])
        assert export_a.status_code == 200
        assert "tenant-a-lead@example.com" in export_a.text
        assert "tenant-b-lead@example.com" not in export_a.text


def test_lead_scope_falls_back_to_source_url(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        tenant = create_tenant(client, username="sourceowner", email="sourceowner@example.com", domain="source.example.com")

        lead = client.post(
            "/demo/submit",
            json=with_lead_challenge(
                client,
                {
                "name": "Source Scoped Lead",
                "email": "source-scoped@example.com",
                "organization": "Source Org",
                "use_case": "Centralized form posting",
                "message": "Need central backend posting while preserving tenant ownership.",
                "website": "",
                "source": "https://source.example.com/demo",
                },
            ),
        )
        assert lead.status_code == 200

        leads = client.get("/admin/leads", headers=tenant["headers"])
        assert leads.status_code == 200
        assert leads.json()["total"] == 1
        assert leads.json()["items"][0]["email"] == "source-scoped@example.com"
        assert leads.json()["items"][0]["site_id"] == tenant["site"]["id"]


def test_public_snapshot_and_health_are_demo_safe(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        tenant = create_tenant(client, username="healthowner", email="healthowner@example.com", domain="health.example.com")
        ingest = client.post(
            "/ingest",
            headers={"X-API-Key": tenant["site"]["api_key"]},
            json={
                "event_type": "shell_command",
                "cmd": "cat /srv/secret-admin",
                "url_path": "/secret-admin",
                "ip": "203.0.113.250",
                "session_id": "tenant-session-1",
            },
        )
        assert ingest.status_code == 200

        public_snapshot = client.get("/public/telemetry/snapshot")
        assert public_snapshot.status_code == 200
        snapshot_payload = public_snapshot.json()
        assert snapshot_payload["scope"] == "public_demo"
        assert all(str(item["id"]).startswith("public-demo-") for item in snapshot_payload["feed"])
        assert all(item["path"] != "/secret-admin" for item in snapshot_payload["feed"])
        assert all(item["ip"] != "203.0.113.250" for item in snapshot_payload["top_source_ips"])

        public_health = client.get("/intelligence/health")
        assert public_health.status_code == 200
        assert public_health.json()["scope"] == "public_demo"
        assert public_health.json()["metrics"]["active_sessions"] == 0
        assert public_health.json()["metrics"]["avg_risk_score"] == 0.0

        tenant_health = client.get("/intelligence/health", headers=tenant["headers"])
        assert tenant_health.status_code == 200
        assert tenant_health.json()["scope"] == "tenant"
        assert tenant_health.json()["metrics"]["active_sessions"] == 1
        assert tenant_health.json()["metrics"]["avg_risk_score"] > 0


def test_blocked_ip_exports_are_tenant_scoped_and_edge_ready(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        tenant_a = create_tenant(client, username="edgeowner", email="edgeowner@example.com", domain="edge.example.com")
        tenant_b = create_tenant(client, username="edgeother", email="edgeother@example.com", domain="edge-other.example.com")

        block_a_1 = client.post("/soc/block-ip", headers=tenant_a["headers"], json={"ip": "203.0.113.10", "reason": "manual"})
        block_a_2 = client.post("/soc/block-ip", headers=tenant_a["headers"], json={"ip": "198.51.100.4", "reason": "auto-campaign:credential_spray"})
        block_b = client.post("/soc/block-ip", headers=tenant_b["headers"], json={"ip": "192.0.2.8", "reason": "manual"})
        assert block_a_1.status_code == 200
        assert block_a_2.status_code == 200
        assert block_b.status_code == 200

        nginx_export = client.get("/soc/blocked-ips/export?format=nginx", headers=tenant_a["headers"])
        assert nginx_export.status_code == 200
        assert 'attachment; filename="cybersentinel-blocked-ips.conf"' == nginx_export.headers["content-disposition"]
        assert "deny 203.0.113.10;" in nginx_export.text
        assert "deny 198.51.100.4;" in nginx_export.text
        assert "192.0.2.8" not in nginx_export.text

        plain_export = client.get("/soc/blocked-ips/export?format=plain", headers=tenant_a["headers"])
        assert plain_export.status_code == 200
        assert "203.0.113.10" in plain_export.text
        assert "198.51.100.4" in plain_export.text
        assert "192.0.2.8" not in plain_export.text

        cloudflare_export = client.get("/soc/blocked-ips/export?format=cloudflare-json", headers=tenant_a["headers"])
        assert cloudflare_export.status_code == 200
        payload = cloudflare_export.json()
        assert payload["format"] == "cloudflare-json"
        assert payload["count"] == 2
        assert payload["invalid_entries"] == 0
        assert {item["ip"] for item in payload["items"]} == {"203.0.113.10", "198.51.100.4"}


def test_auth_rate_limit(monkeypatch, tmp_path):
    monkeypatch.setenv("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "2")
    monkeypatch.setenv("AUTH_RATE_LIMIT_WINDOW_SECONDS", "60")
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        for _ in range(2):
            response = client.post("/auth/login", json={"username": "admin", "password": "wrong-pass"})
            assert response.status_code == 401

        blocked = client.post("/auth/login", json={"username": "admin", "password": "wrong-pass"})
        assert blocked.status_code == 429
        assert blocked.headers["retry-after"] == "60"


def test_lead_rate_limit(monkeypatch, tmp_path):
    monkeypatch.setenv("LEAD_RATE_LIMIT_MAX_ATTEMPTS", "1")
    monkeypatch.setenv("LEAD_RATE_LIMIT_WINDOW_SECONDS", "300")
    main = load_main(monkeypatch, tmp_path)
    payload = {
        "name": "Lead Tester",
        "email": "lead-rate@example.com",
        "organization": "Ops",
        "use_case": "Detection",
        "message": "Need a walkthrough for early detection coverage.",
        "website": "",
    }
    with TestClient(main.app) as client:
        accepted = client.post("/contact/submit", json=with_lead_challenge(client, payload))
        assert accepted.status_code == 200

        blocked = client.post("/contact/submit", json=with_lead_challenge(client, payload))
        assert blocked.status_code == 429
        assert blocked.headers["retry-after"] == "300"


def test_deception_status_and_canary_flow(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "deceptionadmin", "email": "deception@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "deceptionadmin", "password": "StrongPass123"})
        assert login.status_code == 200
        auth_headers = {"Authorization": f"Bearer {login.json()['token']}"}

        status = client.get("/deception/status", headers=auth_headers)
        assert status.status_code == 200
        payload = status.json()
        assert "stats" in payload
        assert "protocols" in payload

        canary = client.post("/deception/canary-tokens/generate", headers=auth_headers, json={"label": "Payroll Doc", "type": "URL"})
        assert canary.status_code == 200
        canary_payload = canary.json()
        assert canary_payload["triggered"] is False

        trigger = client.get(canary_payload["url"])
        assert trigger.status_code == 200
        assert trigger.text == "ok"

        canary_list = client.get("/deception/canary-tokens", headers=auth_headers)
        assert canary_list.status_code == 200
        assert canary_list.json()[0]["triggered"] is True


def test_frontend_endpoint_inventory_smoke(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "opsadmin", "email": "opsadmin@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "opsadmin", "password": "StrongPass123"})
        assert login.status_code == 200
        token = login.json()["token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        site_resp = client.post(
            "/sites",
            headers=auth_headers,
            json={"name": "Prod Site", "domain": "example.org"},
        )
        assert site_resp.status_code == 200
        api_key = site_resp.json()["api_key"]

        for payload in [
            {"event_type": "http_probe", "url_path": "/.env", "http_method": "GET", "ip": "203.0.113.10"},
            {"event_type": "shell_command", "cmd": "cat /etc/passwd", "ip": "203.0.113.11"},
        ]:
            ingest = client.post("/ingest", headers={"X-API-Key": api_key}, json=payload)
            assert ingest.status_code == 200

        lead = client.post(
            "/contact/submit",
            json=with_lead_challenge(
                client,
                {
                "name": "Security Lead",
                "email": "lead@example.com",
                "organization": "Secure Corp",
                "use_case": "Deception platform",
                "message": "Need end to end telemetry visibility.",
                "website": "",
                },
            ),
        )
        assert lead.status_code == 200
        lead_id = lead.json()["id"]

        canary = client.post("/deception/canary-tokens/generate", headers=auth_headers, json={"label": "Admin Sheet", "type": "URL"})
        assert canary.status_code == 200
        canary_url = canary.json()["url"]
        assert client.get(canary_url).status_code == 200

        dashboard = client.get("/dashboard/stats", headers=auth_headers)
        assert dashboard.status_code == 200
        feed = dashboard.json()["feed"]
        session_id = feed[0]["session_id"]

        checks = [
            ("GET", "/health", None, lambda p: p["status"] == "healthy"),
            ("GET", "/auth/providers", None, lambda p: "providers" in p),
            ("GET", "/auth/me", auth_headers, lambda p: p["username"] == "opsadmin"),
            ("GET", "/sites", auth_headers, lambda p: isinstance(p, list) and len(p) == 1),
            ("POST", f"/sites/{site_resp.json()['id']}/rotate-key", auth_headers, lambda p: "api_key" in p),
            ("GET", "/ops/readiness", auth_headers, lambda p: p["coverage"]["sites_total"] >= 1 and p["coverage"]["events_total"] >= 2 and isinstance(p["checks"], list)),
            ("GET", "/public/telemetry/snapshot", None, lambda p: "summary" in p and "feed" in p),
            ("GET", "/intelligence/health", None, lambda p: "resources" in p and "integrity" in p),
            ("GET", "/intelligence/predict", auth_headers, lambda p: "predicted_top_target" in p),
            ("GET", "/deception/adaptive/metrics", auth_headers, lambda p: "sessions" in p),
            ("GET", "/deception/adaptive/intelligence", auth_headers, lambda p: "top_countries" in p),
            ("GET", f"/deception/adaptive/timeline/{session_id}", auth_headers, lambda p: p["session_id"] == session_id),
            ("GET", "/deception/status", auth_headers, lambda p: "stats" in p and "protocols" in p),
            ("GET", "/deception/honeytokens", auth_headers, lambda p: isinstance(p, list)),
            ("GET", "/deception/canary-tokens", auth_headers, lambda p: isinstance(p, list) and p[0]["triggered"] is True),
            ("GET", "/deception/live-feed", auth_headers, lambda p: isinstance(p, list)),
            ("POST", "/deception/deploy", auth_headers, lambda p: p["status"] == "success"),
            ("POST", "/deception/auto-mode", auth_headers, lambda p: "auto_mode" in p),
            ("POST", "/deception/autotune", auth_headers, lambda p: "profile" in p),
            ("POST", "/deception/protocols/toggle", auth_headers, lambda p: p["status"] == "success"),
            ("POST", "/protocols/ssh/toggle", auth_headers, lambda p: "module" in p),
            ("GET", "/protocols/status", auth_headers, lambda p: "modules" in p),
            ("GET", "/protocols/metrics", auth_headers, lambda p: "metrics" in p),
            ("GET", "/protocols/alerts", auth_headers, lambda p: "alerts" in p),
            ("GET", "/system/status", auth_headers, lambda p: "components" in p and "metrics" in p),
            ("GET", "/attacker/profiles", auth_headers, lambda p: isinstance(p, list)),
            ("GET", "/mapping/mitre", auth_headers, lambda p: isinstance(p, dict)),
            ("GET", "/audit/logs", auth_headers, lambda p: isinstance(p, list)),
            ("GET", "/forensics/artifacts", auth_headers, lambda p: isinstance(p, list)),
            ("GET", f"/forensics/behavior/{session_id}", auth_headers, lambda p: p["session_id"] == session_id),
            ("GET", f"/soc/playbooks/{session_id}", auth_headers, lambda p: isinstance(p, list)),
            ("GET", f"/forensics/narrative/{session_id}", auth_headers, lambda p: "narrative" in p),
            ("GET", f"/forensics/timeline/{session_id}", auth_headers, lambda p: isinstance(p, list)),
            ("POST", "/forensics/final-report", auth_headers, lambda p: p["status"] == "success"),
            ("POST", "/simulator/inject", auth_headers, lambda p: p["status"] == "accepted"),
            ("POST", "/terminal/cmd", auth_headers, lambda p: "output" in p),
            ("POST", "/ai/expert-advisor", auth_headers, lambda p: "response" in p),
            ("POST", "/intel/url-scan", auth_headers, lambda p: "risk_score" in p),
            ("GET", "/intelligence/reputation/203.0.113.10", auth_headers, lambda p: p["ip"] == "203.0.113.10"),
            ("GET", "/intelligence/iocs", auth_headers, lambda p: isinstance(p, list)),
            ("GET", "/admin/telemetry/summary", auth_headers, lambda p: "totals" in p),
            ("GET", "/admin/telemetry/sessions", auth_headers, lambda p: "items" in p),
            ("GET", "/admin/telemetry/events", auth_headers, lambda p: "items" in p),
            ("GET", f"/admin/telemetry/sessions/{session_id}/timeline", auth_headers, lambda p: "items" in p),
            ("POST", "/analytics/event", None, lambda p: p["status"] == "ok"),
            ("GET", "/lead/challenge", None, lambda p: "challenge_id" in p),
            ("POST", "/demo/submit", None, lambda p: "lead_status" in p),
            ("GET", "/admin/leads/statuses", auth_headers, lambda p: "statuses" in p),
            ("GET", "/admin/leads", auth_headers, lambda p: "items" in p),
            ("GET", "/admin/leads/owners", auth_headers, lambda p: "owners" in p),
            ("GET", "/admin/leads/report", auth_headers, lambda p: "totals" in p),
            ("GET", f"/admin/leads/{lead_id}", auth_headers, lambda p: "lead" in p),
            ("POST", f"/admin/leads/{lead_id}/status", auth_headers, lambda p: "lead" in p),
            ("POST", f"/admin/leads/{lead_id}/notes", auth_headers, lambda p: "note" in p),
            ("POST", f"/admin/leads/{lead_id}/assign", auth_headers, lambda p: "lead" in p),
            ("GET", "/admin/leads/export.csv", auth_headers, lambda _: True),
            ("GET", "/deception/profiles", auth_headers, lambda p: "profiles" in p),
            ("GET", "/intelligence/healthz", None, lambda p: p == "ok"),
        ]

        payloads = {
            "/deception/deploy": {"profile": "balanced", "protocols": {"credential_injection": True}},
            "/deception/auto-mode": {"enabled": True},
            "/deception/autotune": {},
            "/deception/protocols/toggle": {"protocol": "decoy_services", "active": True},
            "/protocols/ssh/toggle": {"enabled": False},
            "/forensics/final-report": {"ip": "203.0.113.10", "session_id": session_id},
            "/simulator/inject": {"event_type": "http_probe", "severity": "medium", "ip": "203.0.113.99", "url_path": "/admin"},
            "/terminal/cmd": {"cmd": "status"},
            "/ai/expert-advisor": {"query": "status", "persona": "GENERAL_SENTINEL"},
            "/intel/url-scan": {"url": "https://example.org/admin"},
            "/analytics/event": {"name": "page_view", "pagePath": "/dashboard"},
            "/demo/submit": {
                "name": "Demo Lead",
                "email": "demo@example.com",
                "organization": "Demo Org",
                "use_case": "Threat visibility",
                "message": "Schedule a platform walkthrough for our team.",
                "website": "",
            },
            f"/admin/leads/{lead_id}/status": {"status": "contacted"},
            f"/admin/leads/{lead_id}/notes": {"note": "Reached out to the customer."},
            f"/admin/leads/{lead_id}/assign": {"assigned_to": "opsadmin"},
        }

        for method, path, headers, validator in checks:
            if method == "GET":
                response = client.get(path, headers=headers or {})
                assert response.status_code == 200, path
                if path in {"/intelligence/healthz", "/admin/leads/export.csv"}:
                    payload = response.text
                else:
                    payload = response.json()
            else:
                body = payloads.get(path, {})
                if path == "/demo/submit":
                    body = with_lead_challenge(client, body)
                response = client.post(path, headers=headers or {}, json=body)
                assert response.status_code == 200, path
                payload = response.json()
            assert validator(payload), path


def test_websocket_incidents_require_valid_token(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post(
            "/auth/signup",
            json={"username": "wsadmin", "email": "wsadmin@example.com", "password": "StrongPass123"},
        )
        assert signup.status_code == 200

        login = client.post("/auth/login", json={"username": "wsadmin", "password": "StrongPass123"})
        assert login.status_code == 200
        token = login.json()["token"]

        with client.websocket_connect(f"/ws/incidents?token={token}") as websocket:
            payload = websocket.receive_json()
            assert "ts" in payload


def test_postgres_url_translation_support(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "x" * 40)
    monkeypatch.setenv("DATABASE_URL", "postgresql://demo:demo@localhost/demo")
    monkeypatch.delenv("BACKEND_DB_PATH", raising=False)

    for module_name in ["core.config", "core.database"]:
        sys.modules.pop(module_name, None)

    database = importlib.import_module("core.database")
    database = importlib.reload(database)

    assert database.DATABASE_BACKEND == "postgresql"
    translated = database.translate_sql_for_backend(
        "select * from events order by datetime(created_at) desc limit ?",
        "postgresql",
    )
    assert translated == "select * from events order by created_at desc limit %s"


def test_postgres_script_split_preserves_do_blocks(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "x" * 40)
    monkeypatch.setenv("DATABASE_URL", "postgresql://demo:demo@localhost/demo")
    monkeypatch.delenv("BACKEND_DB_PATH", raising=False)

    for module_name in ["core.config", "core.database"]:
        sys.modules.pop(module_name, None)

    database = importlib.import_module("core.database")
    database = importlib.reload(database)

    statements = database._split_sql_script(
        """
        alter table blocked_ips add column if not exists user_id bigint;
        do $$
        begin
            if exists (select 1 from information_schema.table_constraints where table_name = 'blocked_ips') then
                perform 1;
            end if;
        end $$;
        create unique index if not exists idx_blocked_ips_user_ip on blocked_ips(user_id, ip);
        """
    )

    assert len(statements) == 3
    assert statements[1].startswith("do $$")
    assert "end $$" in statements[1]


def test_normalize_event_handles_non_string_captured_data(monkeypatch, tmp_path):
    load_main(monkeypatch, tmp_path)
    database = sys.modules["core.database"]

    mapped = database.normalize_event({"captured_data": {"protocol": "ssh", "username": "root"}, "geo": None})
    assert mapped["captured_data"] == {"protocol": "ssh", "username": "root"}
    assert mapped["geo"] == "Global"

    list_json = database.normalize_event({"captured_data": "[1,2,3]", "geo": "India"})
    assert list_json["captured_data"] == {"items": [1, 2, 3]}
    assert list_json["geo"] == "India"

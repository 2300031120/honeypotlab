import importlib
import os
import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def load_main(monkeypatch, tmp_path):
    def set_default_env(name: str, value: str) -> None:
        if name not in os.environ:
            monkeypatch.setenv(name, value)

    db_path = tmp_path / f"contract-runtime-{uuid.uuid4().hex}.db"
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "x" * 40)
    monkeypatch.setenv("ENABLE_DEMO_SEED", "false")
    monkeypatch.setenv("ALLOW_SIGNUP", "true")
    monkeypatch.setenv("BACKEND_DB_PATH", db_path.as_posix())
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
    set_default_env("PROTOCOL_SHARED_SECRET", "test-protocol-secret")
    set_default_env("PROTOCOL_SSH_AUTH_TRAP_ENABLED", "true")
    set_default_env("SSH_DECOY_HEALTH_URL", "http://127.0.0.1:5101/health")
    monkeypatch.delenv("DB_PATH", raising=False)
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


def signup_login_and_create_site(client: TestClient, username: str, email: str, domain: str) -> tuple[dict[str, str], dict]:
    signup = client.post("/auth/signup", json={"username": username, "email": email, "password": "StrongPass123"})
    assert signup.status_code == 200

    login = client.post("/auth/login", json={"username": username, "password": "StrongPass123"})
    assert login.status_code == 200
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    site = client.post("/sites", headers=headers, json={"name": f"{username}-site", "domain": domain})
    assert site.status_code == 200
    return headers, site.json()


def test_login_contract_uses_username_and_returns_token(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post("/auth/signup", json={"username": "contractadmin", "email": "contractadmin@example.com", "password": "StrongPass123"})
        assert signup.status_code == 200

        bad_login = client.post("/auth/login", json={"email": "contractadmin@example.com", "password": "StrongPass123"})
        assert bad_login.status_code == 422

        good_login = client.post("/auth/login", json={"username": "contractadmin", "password": "StrongPass123"})
        assert good_login.status_code == 200
        payload = good_login.json()
        assert isinstance(payload.get("token"), str) and payload["token"]
        assert "access_token" not in payload


def test_sites_contract_requires_domain_and_returns_api_key(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        signup = client.post("/auth/signup", json={"username": "siteowner", "email": "siteowner@example.com", "password": "StrongPass123"})
        assert signup.status_code == 200
        login = client.post("/auth/login", json={"username": "siteowner", "password": "StrongPass123"})
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['token']}"}

        invalid_payload = client.post("/sites", headers=headers, json={"name": "siteowner-site", "hostnames": ["siteowner.example.com"]})
        assert invalid_payload.status_code == 422

        valid_payload = client.post("/sites", headers=headers, json={"name": "siteowner-site", "domain": "siteowner.example.com"})
        assert valid_payload.status_code == 200
        site = valid_payload.json()
        assert isinstance(site.get("id"), int)
        assert isinstance(site.get("api_key"), str) and site["api_key"].startswith("hp_")

        rotate = client.post(f"/sites/{site['id']}/rotate-key", headers=headers)
        assert rotate.status_code == 200
        assert isinstance(rotate.json().get("api_key"), str) and rotate.json()["api_key"].startswith("hp_")


def test_ingest_contract_accepts_x_api_key_and_rejects_x_site_key(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        _, site = signup_login_and_create_site(client, "ingestowner", "ingestowner@example.com", "ingest.example.com")
        api_key = site["api_key"]

        accepted = client.post(
            "/ingest",
            headers={"X-API-Key": api_key},
            json={"event_type": "request", "url_path": "/contract", "http_method": "GET", "ip": "127.0.0.1"},
        )
        assert accepted.status_code == 200
        assert isinstance(accepted.json().get("event_id"), int)

        rejected = client.post(
            "/ingest",
            headers={"X-Site-Key": api_key},
            json={"event_type": "request", "url_path": "/contract", "http_method": "GET", "ip": "127.0.0.1"},
        )
        assert rejected.status_code == 401
        assert "API key" in str(rejected.json().get("detail"))


def test_public_snapshot_contract_path(monkeypatch, tmp_path):
    main = load_main(monkeypatch, tmp_path)
    with TestClient(main.app) as client:
        current_endpoint = client.get("/public/telemetry/snapshot")
        assert current_endpoint.status_code == 200
        assert "summary" in current_endpoint.json()

        old_endpoint = client.get("/public/snapshot")
        assert old_endpoint.status_code == 404

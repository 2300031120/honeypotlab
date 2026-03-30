#!/usr/bin/env python3
"""
Launch preflight checks for CyberSentinel startup deployment.

Usage:
  py -3 deploy/scripts/launch_preflight.py
  py -3 deploy/scripts/launch_preflight.py --check-url
  py -3 deploy/scripts/launch_preflight.py --strict --check-url
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from urllib.parse import urlparse
from urllib.request import Request, urlopen


def parse_env_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def env_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def is_placeholder_secret(value: str) -> bool:
    lowered = str(value or "").strip().lower()
    markers = ("change-me", "change_this", "placeholder", "your_", "replace_with", "example")
    return (not lowered) or any(marker in lowered for marker in markers)


def has_real_trap_credentials(value: str) -> bool:
    normalized = ",".join(part.strip() for part in str(value or "").split(",") if part.strip())
    if not normalized:
        return False
    if is_placeholder_secret(normalized):
        return False
    if normalized.lower() == "user1:pass1,user2:pass2":
        return False
    for pair in normalized.split(","):
        if ":" not in pair:
            return False
        username, password = pair.split(":", 1)
        if not username.strip() or not password.strip():
            return False
    return True


def host_matches_trusted(hostname: str, trusted_hosts: List[str]) -> bool:
    target = str(hostname or "").strip().lower()
    if not target:
        return False
    for item in trusted_hosts:
        current = str(item or "").strip().lower()
        if not current:
            continue
        if current == target:
            return True
        if current.startswith("*.") and target.endswith(current[1:]):
            return True
    return False


def first_defined(env: Dict[str, str], key: str, default: str = "") -> str:
    return str(os.environ.get(key, env.get(key, default))).strip()


def looks_like_email(value: str) -> bool:
    candidate = str(value or "").strip()
    return bool(candidate and "@" in candidate and "." in candidate.rsplit("@", 1)[-1])


def same_host(left: str, right: str) -> bool:
    return str(left or "").strip().lower() == str(right or "").strip().lower()


def run_preflight(env: Dict[str, str], check_url: bool, *, repo_root: Path | None = None) -> Tuple[List[str], List[str], List[str]]:
    passes: List[str] = []
    warns: List[str] = []
    fails: List[str] = []

    app_env = first_defined(env, "APP_ENV", "development").lower()
    if app_env == "production":
        passes.append("APP_ENV is production.")
    else:
        fails.append("APP_ENV must be 'production' for launch.")

    secret_key = first_defined(env, "SECRET_KEY")
    if len(secret_key) >= 32 and not is_placeholder_secret(secret_key):
        passes.append("SECRET_KEY looks strong.")
    else:
        fails.append("SECRET_KEY is weak/placeholder (need 32+ chars, non-placeholder).")

    public_base_url = first_defined(env, "PUBLIC_BASE_URL")
    parsed_public = urlparse(public_base_url)
    if parsed_public.scheme == "https" and parsed_public.netloc:
        if is_placeholder_secret(public_base_url):
            fails.append("PUBLIC_BASE_URL still looks like a placeholder/example value.")
        else:
            passes.append("PUBLIC_BASE_URL uses HTTPS.")
    else:
        fails.append("PUBLIC_BASE_URL must be an HTTPS URL for market launch.")

    protocol_shared_secret = first_defined(env, "PROTOCOL_SHARED_SECRET")
    if len(protocol_shared_secret) >= 24 and not is_placeholder_secret(protocol_shared_secret):
        passes.append("PROTOCOL_SHARED_SECRET looks production-safe.")
    else:
        fails.append("PROTOCOL_SHARED_SECRET is weak/placeholder.")

    cors_origins_raw = first_defined(env, "CORS_ORIGINS")
    cors_origins = [item.strip() for item in cors_origins_raw.split(",") if item.strip()]
    if not cors_origins:
        fails.append("CORS_ORIGINS is empty. Add your frontend domain.")
    elif "*" in cors_origins:
        fails.append("CORS_ORIGINS cannot include '*'.")
    elif any(("localhost" in item.lower()) or ("127.0.0.1" in item.lower()) for item in cors_origins):
        fails.append("CORS_ORIGINS contains localhost/127.0.0.1. Remove local origins for production.")
    else:
        passes.append("CORS_ORIGINS looks production-safe.")

    trusted_hosts_raw = first_defined(env, "TRUSTED_HOSTS")
    trusted_hosts = [item.strip() for item in trusted_hosts_raw.split(",") if item.strip()]
    public_host = parsed_public.hostname or ""
    if not trusted_hosts:
        fails.append("TRUSTED_HOSTS is empty. Add your public hostnames.")
    elif any(("localhost" in item.lower()) or ("127.0.0.1" in item.lower()) for item in trusted_hosts):
        fails.append("TRUSTED_HOSTS contains localhost/127.0.0.1. Remove local hosts for production.")
    elif public_host and not host_matches_trusted(public_host, trusted_hosts):
        fails.append("TRUSTED_HOSTS must include the PUBLIC_BASE_URL hostname.")
    else:
        passes.append("TRUSTED_HOSTS is configured.")

    vite_site_url = first_defined(env, "VITE_PUBLIC_SITE_URL")
    parsed_site_url = urlparse(vite_site_url)
    if parsed_site_url.scheme != "https" or not parsed_site_url.netloc:
        fails.append("VITE_PUBLIC_SITE_URL must be an HTTPS URL.")
    elif is_placeholder_secret(vite_site_url):
        fails.append("VITE_PUBLIC_SITE_URL still looks like a placeholder/example value.")
    elif public_host and not same_host(parsed_site_url.hostname or "", public_host):
        warns.append("VITE_PUBLIC_SITE_URL host differs from PUBLIC_BASE_URL. Confirm this is intentional.")
    else:
        passes.append("VITE_PUBLIC_SITE_URL is launch-ready.")

    vite_app_url = first_defined(env, "VITE_PUBLIC_APP_URL")
    parsed_app_url = urlparse(vite_app_url)
    if parsed_app_url.scheme != "https" or not parsed_app_url.netloc:
        fails.append("VITE_PUBLIC_APP_URL must be an HTTPS URL.")
    elif is_placeholder_secret(vite_app_url):
        fails.append("VITE_PUBLIC_APP_URL still looks like a placeholder/example value.")
    elif public_host and not same_host(parsed_app_url.hostname or "", public_host):
        warns.append("VITE_PUBLIC_APP_URL host differs from PUBLIC_BASE_URL. Confirm app routing/CORS for split-host deployment.")
    else:
        passes.append("VITE_PUBLIC_APP_URL is launch-ready.")

    vite_login_url = first_defined(env, "VITE_PUBLIC_LOGIN_URL")
    if vite_login_url:
        parsed_login_url = urlparse(vite_login_url)
        if parsed_login_url.scheme != "https" or not parsed_login_url.netloc or is_placeholder_secret(vite_login_url):
            fails.append("VITE_PUBLIC_LOGIN_URL must be an HTTPS non-placeholder URL when set.")
        else:
            passes.append("VITE_PUBLIC_LOGIN_URL looks valid.")

    if repo_root is not None:
        index_template = repo_root / "frontend" / "index.html"
        if index_template.exists():
            template_text = index_template.read_text(encoding="utf-8")
            if "__PUBLIC_STRUCTURED_DATA__" in template_text:
                fails.append(
                    "frontend/index.html still contains __PUBLIC_STRUCTURED_DATA__ marker. "
                    "Replace it with real JSON-LD or Vite placeholders before deploy."
                )
            else:
                passes.append("frontend/index.html JSON-LD marker is deploy-safe.")

    if env_bool(first_defined(env, "FORCE_HTTPS_REDIRECT", "true"), default=True):
        passes.append("FORCE_HTTPS_REDIRECT is enabled.")
    else:
        fails.append("FORCE_HTTPS_REDIRECT must be true for launch.")

    if env_bool(first_defined(env, "DECOY_COOKIE_SECURE", "true"), default=True):
        passes.append("DECOY_COOKIE_SECURE is enabled.")
    else:
        fails.append("DECOY_COOKIE_SECURE must be true for launch.")

    database_url = first_defined(env, "DATABASE_URL")
    if database_url.lower().startswith(("postgresql://", "postgres://")):
        parsed_db = urlparse(database_url)
        if is_placeholder_secret(parsed_db.password or ""):
            fails.append("DATABASE_URL uses a placeholder PostgreSQL password.")
        else:
            passes.append("DATABASE_URL uses PostgreSQL.")
    elif database_url.lower().startswith("sqlite"):
        fails.append("DATABASE_URL uses SQLite. Switch to PostgreSQL for production launch.")
    else:
        fails.append("DATABASE_URL must use PostgreSQL for launch.")

    bootstrap_admin_password = first_defined(env, "BOOTSTRAP_ADMIN_PASSWORD")
    if len(bootstrap_admin_password) >= 12 and not is_placeholder_secret(bootstrap_admin_password) and bootstrap_admin_password != "Admin@123":
        passes.append("BOOTSTRAP_ADMIN_PASSWORD looks production-safe.")
    else:
        fails.append("BOOTSTRAP_ADMIN_PASSWORD is weak/placeholder.")

    if not env_bool(first_defined(env, "ENABLE_DEMO_SEED", "false"), default=False):
        passes.append("ENABLE_DEMO_SEED is disabled.")
    else:
        fails.append("ENABLE_DEMO_SEED must be false for production launch.")

    for key in [
        "VITE_PUBLIC_CONTACT_EMAIL",
        "VITE_PUBLIC_SECURITY_EMAIL",
        "VITE_PUBLIC_PRIVACY_EMAIL",
        "BOOTSTRAP_ADMIN_EMAIL",
        "TLS_EMAIL",
    ]:
        value = first_defined(env, key)
        if not looks_like_email(value) or is_placeholder_secret(value):
            fails.append(f"{key} must be a real email address, not a placeholder.")
        else:
            passes.append(f"{key} looks valid.")

    tls_domain = first_defined(env, "TLS_DOMAIN")
    if not tls_domain:
        fails.append("TLS_DOMAIN must be set for production launch.")
    elif is_placeholder_secret(tls_domain) or "." not in tls_domain:
        fails.append("TLS_DOMAIN still looks like a placeholder/example value.")
    elif public_host and not same_host(tls_domain, public_host):
        warns.append("TLS_DOMAIN differs from PUBLIC_BASE_URL hostname. Confirm reverse proxy/tunnel routing.")
    else:
        passes.append("TLS_DOMAIN matches the public hostname.")

    cloudflare_hostname = first_defined(env, "CLOUDFLARE_PUBLIC_HOSTNAME")
    cloudflare_token = first_defined(env, "CLOUDFLARE_TUNNEL_TOKEN")
    if cloudflare_token:
        if is_placeholder_secret(cloudflare_token):
            fails.append("CLOUDFLARE_TUNNEL_TOKEN still looks like a placeholder/example value.")
        elif not cloudflare_hostname or is_placeholder_secret(cloudflare_hostname):
            fails.append("CLOUDFLARE_PUBLIC_HOSTNAME must be set when CLOUDFLARE_TUNNEL_TOKEN is used.")
        elif public_host and not same_host(cloudflare_hostname, public_host):
            warns.append("CLOUDFLARE_PUBLIC_HOSTNAME differs from PUBLIC_BASE_URL hostname.")
        else:
            passes.append("Cloudflare public hostname is aligned.")

    if env_bool(first_defined(env, "ALLOW_SIGNUP", "false"), default=False):
        warns.append("ALLOW_SIGNUP is enabled. Close public signup unless you intentionally want self-service onboarding.")

    if not first_defined(env, "SECURITY_CONTENT_SECURITY_POLICY"):
        warns.append("SECURITY_CONTENT_SECURITY_POLICY is empty. Add a CSP before market launch.")

    lead_notifications_enabled = env_bool(first_defined(env, "LEAD_NOTIFICATION_ENABLED", "true"), default=True)
    lead_email = first_defined(env, "LEAD_NOTIFICATION_EMAIL_TO")
    lead_slack = first_defined(env, "LEAD_SLACK_WEBHOOK_URL")
    if lead_notifications_enabled and not (lead_email or lead_slack):
        warns.append("Lead notifications are enabled but no email or Slack target is configured.")
    elif lead_email and (not looks_like_email(lead_email) or is_placeholder_secret(lead_email)):
        warns.append("LEAD_NOTIFICATION_EMAIL_TO still looks like a placeholder/example value.")

    google_client_id = first_defined(env, "GOOGLE_OAUTH_CLIENT_ID")
    vite_google_client_id = first_defined(env, "VITE_GOOGLE_CLIENT_ID")
    if google_client_id or vite_google_client_id:
        if is_placeholder_secret(google_client_id) or is_placeholder_secret(vite_google_client_id):
            warns.append("Google OAuth client IDs still look like placeholders.")
        elif google_client_id != vite_google_client_id:
            warns.append("GOOGLE_OAUTH_CLIENT_ID and VITE_GOOGLE_CLIENT_ID should match.")

    ssh_trap_enabled = env_bool(first_defined(env, "PROTOCOL_SSH_AUTH_TRAP_ENABLED", "true"), default=True)
    mysql_trap_enabled = env_bool(first_defined(env, "PROTOCOL_MYSQL_AUTH_TRAP_ENABLED", "true"), default=True)
    ssh_creds = first_defined(env, "PROTOCOL_SSH_TRAP_CREDENTIALS")
    mysql_creds = first_defined(env, "PROTOCOL_MYSQL_TRAP_CREDENTIALS")
    if ssh_trap_enabled and not has_real_trap_credentials(ssh_creds):
        fails.append("PROTOCOL_SSH_TRAP_CREDENTIALS must contain non-placeholder user:pass pairs when SSH auth trap is enabled.")
    elif ssh_trap_enabled:
        passes.append("SSH trap credentials configured.")
    if mysql_trap_enabled and not has_real_trap_credentials(mysql_creds):
        fails.append("PROTOCOL_MYSQL_TRAP_CREDENTIALS must contain non-placeholder user:pass pairs when MySQL auth trap is enabled.")
    elif mysql_trap_enabled:
        passes.append("MySQL trap credentials configured.")

    if check_url:
        if not parsed_public.scheme or not parsed_public.netloc:
            fails.append("Cannot run --check-url because PUBLIC_BASE_URL is invalid.")
        else:
            api_health = f"{parsed_public.scheme}://{parsed_public.netloc}/api/health"
            try:
                req = Request(api_health, method="GET")
                with urlopen(req, timeout=8) as resp:
                    code = int(getattr(resp, "status", 0) or 0)
                if code == 200:
                    passes.append(f"Health check reachable: {api_health}")
                else:
                    fails.append(f"Health check failed: {api_health} returned {code}")
            except Exception as exc:
                fails.append(f"Health check failed: {api_health} ({exc})")

    return passes, warns, fails


def main() -> int:
    parser = argparse.ArgumentParser(description="Run launch readiness checks.")
    parser.add_argument("--check-url", action="store_true", help="Also call PUBLIC_BASE_URL/api/health.")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as launch blockers.")
    parser.add_argument("--env-file", default="", help="Optional env file to validate instead of the repo root .env.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    merged_env: Dict[str, str] = {}
    env_path = Path(args.env_file).expanduser().resolve() if args.env_file else (repo_root / ".env")
    merged_env.update(parse_env_file(env_path))
    merged_env.update(parse_env_file(repo_root / "backend" / ".env"))

    passes, warns, fails = run_preflight(merged_env, check_url=args.check_url, repo_root=repo_root)

    print("=== Launch Preflight ===")
    for item in passes:
        print(f"[PASS] {item}")
    for item in warns:
        print(f"[WARN] {item}")
    for item in fails:
        print(f"[FAIL] {item}")

    print(f"\nSummary: pass={len(passes)} warn={len(warns)} fail={len(fails)}")
    strict_blocked = args.strict and bool(warns)
    if strict_blocked:
        print("[STRICT] Warnings are treated as failures in strict mode.")

    if fails or strict_blocked:
        print("Launch decision: BLOCKED")
        return 1
    print("Launch decision: READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

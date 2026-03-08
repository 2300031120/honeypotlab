#!/usr/bin/env python3
"""
Launch preflight checks for CyberSentinel startup deployment.

Usage:
  py -3 deploy/scripts/launch_preflight.py
  py -3 deploy/scripts/launch_preflight.py --check-url
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
    markers = ("change-me", "placeholder", "your_", "replace_with", "example")
    return (not lowered) or any(marker in lowered for marker in markers)


def first_defined(env: Dict[str, str], key: str, default: str = "") -> str:
    return str(os.environ.get(key, env.get(key, default))).strip()


def run_preflight(env: Dict[str, str], check_url: bool) -> Tuple[List[str], List[str], List[str]]:
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
        passes.append("PUBLIC_BASE_URL uses HTTPS.")
    else:
        fails.append("PUBLIC_BASE_URL must be an HTTPS URL for market launch.")

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
    if trusted_hosts:
        passes.append("TRUSTED_HOSTS is configured.")
    else:
        fails.append("TRUSTED_HOSTS is empty. Add your public hostnames.")

    if env_bool(first_defined(env, "FORCE_HTTPS_REDIRECT", "true"), default=True):
        passes.append("FORCE_HTTPS_REDIRECT is enabled.")
    else:
        fails.append("FORCE_HTTPS_REDIRECT must be true for launch.")

    if env_bool(first_defined(env, "DECOY_COOKIE_SECURE", "true"), default=True):
        passes.append("DECOY_COOKIE_SECURE is enabled.")
    else:
        fails.append("DECOY_COOKIE_SECURE must be true for launch.")

    database_url = first_defined(env, "DATABASE_URL")
    if database_url.lower().startswith("sqlite"):
        warns.append("DATABASE_URL points to SQLite. Use managed MySQL/Postgres for launch traffic.")
    elif database_url:
        passes.append("DATABASE_URL is not SQLite.")
    else:
        fails.append("DATABASE_URL is missing.")

    ssh_trap_enabled = env_bool(first_defined(env, "PROTOCOL_SSH_AUTH_TRAP_ENABLED", "true"), default=True)
    mysql_trap_enabled = env_bool(first_defined(env, "PROTOCOL_MYSQL_AUTH_TRAP_ENABLED", "true"), default=True)
    ssh_creds = first_defined(env, "PROTOCOL_SSH_TRAP_CREDENTIALS")
    mysql_creds = first_defined(env, "PROTOCOL_MYSQL_TRAP_CREDENTIALS")
    if ssh_trap_enabled and not ssh_creds:
        fails.append("PROTOCOL_SSH_TRAP_CREDENTIALS required when SSH auth trap is enabled.")
    else:
        passes.append("SSH trap credentials configured.")
    if mysql_trap_enabled and not mysql_creds:
        fails.append("PROTOCOL_MYSQL_TRAP_CREDENTIALS required when MySQL auth trap is enabled.")
    else:
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
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    merged_env: Dict[str, str] = {}
    merged_env.update(parse_env_file(repo_root / ".env"))
    merged_env.update(parse_env_file(repo_root / "backend" / ".env"))

    passes, warns, fails = run_preflight(merged_env, check_url=args.check_url)

    print("=== Launch Preflight ===")
    for item in passes:
        print(f"[PASS] {item}")
    for item in warns:
        print(f"[WARN] {item}")
    for item in fails:
        print(f"[FAIL] {item}")

    print(f"\nSummary: pass={len(passes)} warn={len(warns)} fail={len(fails)}")
    if fails:
        print("Launch decision: BLOCKED")
        return 1
    print("Launch decision: READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Export tenant blocked IPs from CyberSentil into edge-consumable files.

Examples:
  py -3 deploy/scripts/export_edge_blocks.py --base-url https://security.example.com --token <jwt>
  py -3 deploy/scripts/export_edge_blocks.py --base-url https://security.example.com/api --token <jwt> --format cloudflare-json
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen


FORMATS = {"plain", "nginx", "cloudflare-json"}


def first_defined(*values: str) -> str:
    for value in values:
        candidate = str(value or "").strip()
        if candidate:
            return candidate
    return ""


def default_output_path(repo_root: Path, export_format: str) -> Path:
    if export_format == "nginx":
        return repo_root / "deploy" / "nginx" / "generated" / "cybersentinel-blocked-ips.conf"
    if export_format == "cloudflare-json":
        return repo_root / "deploy" / "artifacts" / "cybersentinel-blocked-ips.cloudflare.json"
    return repo_root / "deploy" / "artifacts" / "cybersentinel-blocked-ips.txt"


def build_export_url(base_url: str, api_prefix: str, export_format: str) -> str:
    parsed = urlparse(base_url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("Base URL must include scheme and hostname, for example https://security.example.com")
    prefix = str(api_prefix or "").strip()
    if prefix and not prefix.startswith("/"):
        prefix = "/" + prefix
    prefix = prefix.rstrip("/")
    base_path = parsed.path.rstrip("/")
    if prefix and (base_path == prefix or base_path.endswith(prefix)):
        path = f"{base_path}/soc/blocked-ips/export"
    else:
        path = f"{base_path}{prefix}/soc/blocked-ips/export"
    query = urlencode({"format": export_format})
    return urlunparse((parsed.scheme, parsed.netloc, path, "", query, ""))


def fetch_export(url: str, token: str, timeout: int) -> bytes:
    request = Request(url, method="GET", headers={"Authorization": f"Bearer {token}"})
    with urlopen(request, timeout=timeout) as response:
        status = int(getattr(response, "status", 0) or 0)
        if status != 200:
            raise RuntimeError(f"Export request failed with status {status}")
        return response.read()


def main() -> int:
    parser = argparse.ArgumentParser(description="Export CyberSentil blocked IPs for edge enforcement.")
    parser.add_argument("--base-url", default=os.environ.get("CYBERSENTINEL_BASE_URL", ""), help="Public base URL for the deployment.")
    parser.add_argument("--token", default=os.environ.get("CYBERSENTINEL_OPERATOR_TOKEN", ""), help="Operator bearer token.")
    parser.add_argument("--api-prefix", default=os.environ.get("CYBERSENTINEL_API_PREFIX", "/api"), help="API prefix used by the public deployment.")
    parser.add_argument("--format", choices=sorted(FORMATS), default="nginx", help="Export format.")
    parser.add_argument("--output", default="", help="Output path. Defaults inside deploy/ for the selected format.")
    parser.add_argument("--timeout", type=int, default=15, help="HTTP timeout in seconds.")
    args = parser.parse_args()

    base_url = first_defined(args.base_url)
    token = first_defined(args.token)
    if not base_url:
        print("Missing --base-url or CYBERSENTINEL_BASE_URL.", file=sys.stderr)
        return 1
    if not token:
        print("Missing --token or CYBERSENTINEL_OPERATOR_TOKEN.", file=sys.stderr)
        return 1

    repo_root = Path(__file__).resolve().parents[2]
    output_path = Path(args.output) if args.output else default_output_path(repo_root, args.format)
    try:
        export_url = build_export_url(base_url, args.api_prefix, args.format)
        payload = fetch_export(export_url, token, args.timeout)
    except Exception as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(payload)
    print(f"Wrote {len(payload)} bytes to {output_path}")
    print(f"Source: {export_url}")
    if args.format == "nginx":
        print("Nginx include hint:")
        print("  include /etc/nginx/cybersentinel/cybersentinel-blocked-ips.conf;")
        print("Use deploy/scripts/sync-edge-blocks.ps1 to export and reload the gateway automatically.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

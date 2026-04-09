#!/usr/bin/env python3
"""
Render a production-focused .env scaffold for a real domain.

Example:
  py -3 deploy/scripts/render_domain_env.py --domain cybersentil.online --output .env.cybersentil
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a production env scaffold for a domain.")
    parser.add_argument("--domain", required=True, help="Primary production hostname, for example cybersentil.online")
    parser.add_argument("--output", default=".env.production.generated", help="Output env file path.")
    parser.add_argument(
        "--app-subdomain",
        default="app",
        help="Authenticated app/API subdomain prefix. Use an empty string to keep a single-host deployment.",
    )
    parser.add_argument("--site-name", default="CyberSentil", help="Public site name.")
    parser.add_argument("--company-name", default="CyberSentil", help="Company/legal display name.")
    parser.add_argument("--contact-email", default="", help="Optional explicit contact email.")
    parser.add_argument("--security-email", default="", help="Optional explicit security email.")
    parser.add_argument("--privacy-email", default="", help="Optional explicit privacy email.")
    parser.add_argument("--admin-email", default="", help="Optional explicit bootstrap admin email.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    example_path = repo_root / ".env.example"
    if not example_path.exists():
        raise SystemExit(f"Missing template: {example_path}")

    domain = args.domain.strip().lower()
    if "://" in domain or "/" in domain or "." not in domain:
        raise SystemExit("--domain must be a bare hostname like cybersentil.online")

    contact_email = args.contact_email.strip() or f"contact@{domain}"
    security_email = args.security_email.strip() or f"security@{domain}"
    privacy_email = args.privacy_email.strip() or f"privacy@{domain}"
    admin_email = args.admin_email.strip() or f"admin@{domain}"
    app_subdomain = args.app_subdomain.strip().strip(".")
    site_url = f"https://{domain}"
    app_host = f"{app_subdomain}.{domain}" if app_subdomain else domain
    app_url = f"https://{app_host}"
    trusted_hosts = [app_host, domain, f"www.{domain}", "frontend"]

    replacements = {
        "PUBLIC_BASE_URL": app_url,
        "VITE_PUBLIC_SITE_NAME": args.site_name.strip() or "CyberSentil",
        "VITE_PUBLIC_SITE_URL": site_url,
        "VITE_PUBLIC_APP_URL": app_url,
        "VITE_PUBLIC_LOGIN_URL": f"{app_url}/auth/login",
        "VITE_PUBLIC_COMPANY_NAME": args.company_name.strip() or "CyberSentil",
        "VITE_PUBLIC_CONTACT_EMAIL": contact_email,
        "VITE_PUBLIC_SECURITY_EMAIL": security_email,
        "VITE_PUBLIC_PRIVACY_EMAIL": privacy_email,
        "CORS_ORIGINS": ",".join(dict.fromkeys([site_url, app_url])),
        "TRUSTED_HOSTS": ",".join(dict.fromkeys(trusted_hosts)),
        "BOOTSTRAP_ADMIN_EMAIL": admin_email,
        "LEAD_NOTIFICATION_EMAIL_TO": security_email,
        "GOOGLE_OAUTH_CLIENT_ID": "",
        "VITE_GOOGLE_CLIENT_ID": "",
        "TLS_DOMAIN": app_host,
        "TLS_EMAIL": security_email,
        "DUCKDNS_DOMAIN": "",
        "DUCKDNS_TOKEN": "",
        "CLOUDFLARE_TUNNEL_TOKEN": "",
        "CLOUDFLARE_PUBLIC_HOSTNAME": app_host,
    }

    rendered_lines: list[str] = []
    for raw_line in example_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip("\n")
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in line:
            rendered_lines.append(line)
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        replacement = replacements.get(key)
        rendered_lines.append(f"{key}={replacement if replacement is not None else value}")

    output_path = Path(args.output).expanduser()
    if not output_path.is_absolute():
        output_path = repo_root / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(rendered_lines) + "\n", encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

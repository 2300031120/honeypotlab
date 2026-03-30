# Production Deploy Checklist

Use this checklist before putting CyberSentinel on a public server.

## Launch gate

- `APP_ENV=production`
- `SECRET_KEY` is a unique 32+ character secret
- `DATABASE_URL` uses PostgreSQL with a non-placeholder password
- `PUBLIC_BASE_URL` points to the real HTTPS hostname
- `TRUSTED_HOSTS` includes the public hostname
- `CORS_ORIGINS` contains only the real frontend origins
- `FORCE_HTTPS_REDIRECT=true`
- `DECOY_COOKIE_SECURE=true`
- `ENABLE_DEMO_SEED=false`
- `BOOTSTRAP_ADMIN_PASSWORD` changed from the default

## Product proof

- At least one site is created in `/sites`
- Real events arrive through `POST /ingest`
- At least one canary token is deployed and tested
- Lead routing is configured if public demo/contact forms are enabled
- Operators can log in and review `/ops/readiness`
- Edge block export is wired to your reverse proxy or WAF if `auto-mode` is enabled

## Commands

Run preflight:

```bash
py -3 deploy/scripts/launch_preflight.py
```

Run live URL probe:

```bash
py -3 deploy/scripts/launch_preflight.py --check-url
```

Smoke the backend tests:

```bash
python -m pytest backend/tests -q
```

Export Nginx edge blocks:

```bash
py -3 deploy/scripts/export_edge_blocks.py --base-url https://your-public-domain --token <operator-jwt>
```

Automatic export + gateway reload:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/sync-edge-blocks.ps1 -BaseUrl "https://your-public-domain" -Token "<operator-jwt>"
```

The TLS gateway includes the generated file automatically:

```nginx
include /etc/nginx/cybersentinel/cybersentinel-blocked-ips.conf;
```

Direct Cloudflare sync:

```bash
py -3 deploy/scripts/sync_cloudflare_edge.py --base-url https://your-public-domain --operator-token <operator-jwt> --zone-id <cloudflare-zone-id>
```

Use a Cloudflare API token that can manage IP Access Rules on the target zone or account. If you prefer account-wide scope, pass `--account-id` instead of `--zone-id`.

## Runtime check

After login, call:

```text
GET /ops/readiness
```

This returns deployment checks, coverage counts, and the next actions still needed before launch.

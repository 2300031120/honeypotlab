# cybersentil.online Deployment

Use [deploy/env/cybersentil.online.env.example](../deploy/env/cybersentil.online.env.example) as the production starting point for `cybersentil.online`.

Recommended topology:

- `cybersentil.online` serves the public marketing site.
- `app.cybersentil.online` serves the authenticated app, API, and `/api/health`.
- SSH/Cowrie or other exposed deception protocols should live on a separate host or IP, not on the marketing hostname.

Important: this repo can be configured for split-host URLs, but that alone does not turn the apex domain into a fully isolated brochure site. If both `cybersentil.online` and `app.cybersentil.online` point at the same frontend container, both hosts still reach the same SPA and backend trap routes. For a clean company launch, put the apex domain behind a separate marketing site or reverse proxy policy that does not expose the product and decoy paths on the apex host.

## Prepare `.env`

```powershell
Copy-Item deploy\env\cybersentil.online.env.example .env
```

The template already assumes:

- `PUBLIC_BASE_URL=https://app.cybersentil.online`
- `VITE_PUBLIC_SITE_URL=https://cybersentil.online`
- `VITE_PUBLIC_APP_URL=https://app.cybersentil.online`
- `VITE_PUBLIC_LOGIN_URL=https://app.cybersentil.online/auth/login`
- `CORS_ORIGINS=https://cybersentil.online,https://app.cybersentil.online`
- `TRUSTED_HOSTS=app.cybersentil.online,cybersentil.online,www.cybersentil.online,frontend`

Replace these placeholders before launch:

- `SECRET_KEY`
- `POSTGRES_PASSWORD` and `DATABASE_URL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `PROTOCOL_SHARED_SECRET`
- `PROTOCOL_SSH_TRAP_CREDENTIALS`
- `PROTOCOL_MYSQL_TRAP_CREDENTIALS`

Optional values stay blank unless you actually use them:

- `GOOGLE_OAUTH_CLIENT_ID`
- `VITE_GOOGLE_CLIENT_ID`
- `CLOUDFLARE_TUNNEL_TOKEN`
- `DUCKDNS_DOMAIN`
- `DUCKDNS_TOKEN`
- `SPLUNK_HEC_URL`
- `SPLUNK_HEC_TOKEN`

If you want the repo to generate the same split-host scaffold from the generic template, use:

```powershell
py -3 deploy\scripts\render_domain_env.py --domain cybersentil.online --output .env
```

## DNS and routing

- Point `app.cybersentil.online` at the runtime that serves this stack.
- Point `cybersentil.online` either at a separate marketing host or at a front proxy that only serves brochure pages and redirects product sign-in to `app.cybersentil.online`.
- Keep SSH exposure on a separate hostname or raw IP if you plan to publish ports `2222` or `2223`.

If you keep both apex and `app.` on the same runtime temporarily, treat it as an MVP deployment, not the final startup launch shape.

## Validate

```powershell
py -3 deploy\scripts\launch_preflight.py --env-file .env
```

Expected result before filling secrets: `Launch decision: BLOCKED`.

Expected result after filling real values: no `FAIL` lines.

`--check-url` probes `PUBLIC_BASE_URL/api/health`, so for this topology it checks `https://app.cybersentil.online/api/health`.

## Start

```powershell
docker compose up --build -d
```

If you use the TLS gateway profile:

```powershell
docker compose --profile tls up -d tls-gateway
```

If you terminate TLS outside Docker or through Cloudflare, make sure both the apex and `app.` hostnames resolve correctly before running the smoke checks.

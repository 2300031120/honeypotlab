# cybersentil.online Deployment

Use [deploy/env/cybersentil.online.env.example](../deploy/env/cybersentil.online.env.example) as the production starting point for `cybersentil.online`.

## Prepare `.env`

```powershell
Copy-Item deploy\env\cybersentil.online.env.example .env
```

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

## Validate

```powershell
py -3 deploy\scripts\launch_preflight.py --env-file .env
```

Expected result before filling secrets: `Launch decision: BLOCKED`.

Expected result after filling real values: no `FAIL` lines.

## Start

```powershell
docker compose up --build -d
```

If you use the TLS gateway profile:

```powershell
docker compose --profile tls up -d tls-gateway
```

If later you split marketing and product onto different hostnames, update:

- `VITE_PUBLIC_APP_URL`
- `VITE_PUBLIC_LOGIN_URL`
- `CORS_ORIGINS`
- `TRUSTED_HOSTS`

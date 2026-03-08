# AI Deception Security Platform (High-Interaction Dynamic Honeypot)

This project is an **AI‑enhanced, high‑interaction, dynamic deception system** that can run as a **startup/SaaS-style security dashboard**:
- Add websites (multi‑tenant)
- Generate API keys per website
- Ingest security/traffic events from customer websites
- Enrich events with AI analysis + scoring
- Visualize attacks in a dashboard (frontend)

## What changed (SaaS mode)
- ✅ Added **Sites** + **API Keys** tables
- ✅ Added authenticated endpoints:
  - `GET /sites` (list)
  - `POST /sites` (create + returns API key once)
  - `POST /sites/{id}/rotate-key`
- ✅ Added public ingest endpoint:
  - `POST /ingest` with header `X-API-Key: hp_<prefix>_<secret>`
- ✅ Cleaned repo for real-world usage:
  - removed `.git`, `.venv`, `node_modules`, `dist`
  - replaced secrets with `.env.example`

> **Safety note**: Deploy honeypots only in isolated infrastructure. Never “attack back”. Collect only the minimum data you need.

---

## Quick start (Docker)
1. Copy env:
```bash
cp .env.example .env
```
Set `CORS_ORIGINS` in `.env` if your frontend is served from a non-localhost origin.
When `APP_ENV=production`, set these mandatory trap credentials too:
`PROTOCOL_SSH_TRAP_CREDENTIALS` and `PROTOCOL_MYSQL_TRAP_CREDENTIALS` (comma-separated `user:pass` pairs).
For Google login, set `GOOGLE_OAUTH_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend) to the same OAuth Web client ID.
2. Start:
```bash
docker compose up --build
```
3. Open:
- Frontend: `http://localhost/`
- Backend API (via reverse proxy): `http://localhost/api/`
- Backend direct port is internal-only in secure mode.

## Launch preflight (do before market launch)
Run automated launch checks against your `.env`:
```bash
py -3 deploy/scripts/launch_preflight.py
```
Optional live URL probe:
```bash
py -3 deploy/scripts/launch_preflight.py --check-url
```
This validates production-critical settings such as `APP_ENV`, `SECRET_KEY`, `CORS_ORIGINS`, `TRUSTED_HOSTS`, HTTPS redirect, secure cookies, trap credentials, and database mode.

Frontend hotfix redeploy (force refresh stale bundles in production):
```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/redeploy-frontend.ps1 -NoCache -RebuildBackend
```
Use `-Pull` if you also want latest base images.

Optional local dev tooling (not public):
```bash
docker compose --profile dev-tools up -d phpmyadmin
```
phpMyAdmin will bind only to `127.0.0.1:8080`.

Optional HTTPS (Let's Encrypt + Certbot):
1. Set `TLS_DOMAIN` and `TLS_EMAIL` in `.env`.
2. Keep port `80` reachable from the internet for HTTP-01 validation.
3. Issue certificate:
```bash
docker compose --profile tls run --rm certbot certonly --webroot -w /var/www/certbot -d your-domain.com --email you@your-domain.com --agree-tos --no-eff-email
```
4. Start TLS gateway:
```bash
docker compose --profile tls up -d tls-gateway
```
5. Renew certificate (run periodically):
```bash
docker compose --profile tls run --rm certbot renew --webroot -w /var/www/certbot
docker compose exec tls-gateway nginx -s reload
```

Optional fixed public URL via Cloudflare Tunnel (no port forwarding):
1. In Cloudflare Zero Trust, create a Named Tunnel (Docker connector).
2. Add one Public Hostname (for example `honeypot.example.com`) and set Service URL to:
   - `http://frontend:80` (recommended when using the compose service below)
3. Copy the generated tunnel token and set in `.env`:
```env
CLOUDFLARE_TUNNEL_TOKEN=your-cloudflare-tunnel-token
CLOUDFLARE_PUBLIC_HOSTNAME=honeypot.example.com
PUBLIC_BASE_URL=https://honeypot.example.com
CORS_ORIGINS=https://honeypot.example.com,http://localhost,http://127.0.0.1
```
4. Start tunnel:
```bash
docker compose --profile cloudflare up -d cloudflared
```
5. Verify:
```bash
curl -i https://honeypot.example.com/api/health
```

Note: A fixed hostname requires a domain managed in Cloudflare DNS. If you do not have one, use Quick Tunnel (random `trycloudflare.com` URL).

Quick Tunnel (best free option, random public URL):
1. Start:
```bash
docker compose --profile quick-tunnel up -d cloudflared-quick
```
2. Find the generated public URL:
```bash
docker compose --profile quick-tunnel logs --tail=50 cloudflared-quick
```
3. Verify:
```bash
curl -i https://<random-name>.trycloudflare.com/api/health
```
4. Keep in mind: URL changes if the quick tunnel container is recreated.

DuckDNS quick setup (no paid domain):
1. Create a DuckDNS subdomain and copy token from `duckdns.org`.
2. Set in `.env`:
```env
DUCKDNS_DOMAIN=your-subdomain
DUCKDNS_TOKEN=your-duckdns-token
TLS_DOMAIN=your-subdomain.duckdns.org
PUBLIC_BASE_URL=https://your-subdomain.duckdns.org
CORS_ORIGINS=https://your-subdomain.duckdns.org,http://your-subdomain.duckdns.org,http://localhost,http://127.0.0.1
```
3. Update DuckDNS A record:
```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/update-duckdns.ps1
```
4. Issue certificate for DuckDNS:
```bash
docker compose --profile tls run --rm certbot certonly --webroot -w /var/www/certbot -d your-subdomain.duckdns.org --email you@example.com --agree-tos --no-eff-email
docker compose --profile tls up -d tls-gateway
```
5. Refresh DuckDNS IP regularly (Task Scheduler/Cron) using the same script.

---

## Create account + add a website
1. Signup in UI (or API):
- `POST /auth/signup`
2. Login:
- `POST /auth/login` → JWT token
3. Add website:
- `POST /sites` (Bearer token) → returns **API key** (copy now)

---

## Send events from a real website (server-side recommended)
Example:
```bash
curl -X POST "http://localhost/api/ingest" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"event_type":"http","url_path":"/login","http_method":"POST","captured_data":{"username":"test"}}'
```

One-command integration bootstrap (login + site create/rotate-key + Cloudflare/M365 seed events):
```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/bootstrap-integrations.ps1 -BaseUrl "https://your-public-domain" -Username "ops_check_user" -Password "Strong@123456" -SiteName "startup-main" -SiteDomain "yourdomain.com"
```

Quick tunnel auto-bootstrap (auto-detect trycloudflare URL):
```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/bootstrap-from-quick-tunnel.ps1 -Username "ops_check_user" -Password "Strong@123456"
```

Integration verification:
```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/verify-integrations.ps1
```

---

## “Startup” positioning (real world)
You can pitch this as:
- **AI Deception Platform**
- **Attack Intelligence Dashboard**
- **Website Threat Monitoring as a Service**

Suggested tiers:
- Free: 1 website, 7 days retention
- Pro: 5 websites, 30 days retention + alerts
- Team: unlimited websites + SIEM export

## Adaptive web decoy design
See [docs/ADAPTIVE_WEB_DECOY_ARCHITECTURE.md](docs/ADAPTIVE_WEB_DECOY_ARCHITECTURE.md) for the FastAPI control-plane + phpMyAdmin-like decoy architecture and safety boundaries.
See [docs/STARTUP_FOLDER_FORMAT.md](docs/STARTUP_FOLDER_FORMAT.md) for the startup-oriented folder structure and module ownership.
See [docs/CUSTOMER_WEBSITE_INTEGRATION_PACK.md](docs/CUSTOMER_WEBSITE_INTEGRATION_PACK.md) for production ingest templates (Node/PHP/Python), Cloudflare Worker + M365 templates, and one-command integration bootstrap.
Analyst evaluation endpoint: `GET /deception/adaptive/metrics` (requires auth).
Adaptive global intelligence endpoint: `GET /deception/adaptive/intelligence` (requires auth, 24h risk/country/tactic summaries).
Adaptive session timeline endpoint: `GET /deception/adaptive/timeline/{session_id}` (requires auth, event-by-event policy progression).
A/B/C experiment endpoints: `POST /research/experiments/run`, `GET /research/experiments/latest`, `GET /research/experiments/{run_id}`.
Deception profiles endpoint: `GET /deception/profiles` (requires admin auth; backed by `backend/config/deception_profiles.json`).
Decoy UI pages: `/phpmyadmin/`, `/phpmyadmin/index.php`, `/phpmyadmin/tables.php`, `/phpmyadmin/table.php`, `/phpmyadmin/sql.php`, `/phpmyadmin/import-export.php`, `/phpmyadmin/sessions.php`, `/phpmyadmin/intrusion.php`, `/phpmyadmin/alerts.php`.

---

## Repo hygiene
Do not commit:
- `.env`
- database files with real data
- logs


## Real data (no mock / no samples)
This repo **does not require any mock data**. Real events appear in the DB only when:
- your website sends events to `POST /ingest` (with `X-API-Key`)
- or real attackers hit your honeypot endpoints

### Important (MySQL/phpMyAdmin)
If you manually created tables earlier, the column names may not match the backend models.
Do this once:
1) Keep the database name: `honeypot_db`
2) In phpMyAdmin run: `backend/sql/reset_schema.sql` (drops old tables)
3) Start the backend → it will auto-create the correct tables.

### MySQL Workbench / phpMyAdmin port note
On many Windows/XAMPP setups MySQL listens on **3307** (not 3306). Set `DATABASE_URL` accordingly.

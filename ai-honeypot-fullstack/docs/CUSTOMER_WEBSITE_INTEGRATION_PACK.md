# Customer Website Integration Pack

This runbook connects external systems to your platform so attacks appear in your telemetry in real time.

## Coverage

- Direct honeypot hits on your deployment.
- Customer website telemetry via `POST /api/ingest` + `X-API-Key`.
- Cloudflare edge request intelligence via Worker relay template.
- Microsoft 365 Defender alerts via Logic App HTTP action template.
- Splunk HEC outbound validation.

## 1) One-command bootstrap (recommended)

Run from repo root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/bootstrap-integrations.ps1 -BaseUrl "https://your-public-domain" -Username "ops_check_user" -Password "Strong@123456" -SiteName "startup-main" -SiteDomain "yourdomain.com"
```

What it does:

- Logs in to `/api/auth/login`
- Finds or creates site
- Rotates API key (safe way to get fresh key)
- Sends two seed events (`cloudflare_waf`, `m365_alert`)
- Saves `.integration.env.local` with:
  - `HONEYPOT_BASE_URL`
  - `HONEYPOT_API_KEY`
  - `HONEYPOT_SITE_ID`
  - `HONEYPOT_SITE_NAME`
  - `HONEYPOT_SITE_DOMAIN`

If you use quick tunnel and want full auto URL detection:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/bootstrap-from-quick-tunnel.ps1 -Username "ops_check_user" -Password "Strong@123456" -SiteName "startup-main" -SiteDomain "yourdomain.com"
```

Generate provider-ready files from `.integration.env.local`:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/render-provider-configs.ps1
```

Generated output:

- `deploy/integrations/generated/cloudflare-worker.env`
- `deploy/integrations/generated/logic-app-http-action.generated.json`

Cloudflare Worker deploy helper:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/deploy-cloudflare-worker.ps1 -WorkerName "honeypot-ingest-relay"
```

Direct deploy in one step:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/deploy-cloudflare-worker.ps1 -WorkerName "honeypot-ingest-relay" -DeployNow
```

If needed first install + login:

```powershell
npm install -g wrangler
wrangler login
```

## 2) Event contract

Endpoint:

- `POST /api/ingest`

Headers:

- `Content-Type: application/json`
- `X-API-Key: <customer-site-api-key>`

Body fields:

- `event_type` string (examples: `http`, `auth_fail`, `cloudflare_waf`, `m365_alert`)
- `url_path` string
- `http_method` string
- `captured_data` object
- `cmd` string (optional)
- `session_id` string (optional)

## 3) Integration templates in this repo

Application backends:

- Node: `deploy/integrations/node/ingest-client.js`
- PHP: `deploy/integrations/php/ingest_client.php`
- Python: `deploy/integrations/python/ingest_client.py`

Provider relays:

- Cloudflare Worker relay: `deploy/integrations/cloudflare/worker-ingest-relay.js`
- M365 Logic App HTTP action: `deploy/integrations/m365/logic-app-http-action.json`

Splunk test utility:

- `deploy/scripts/test-splunk-hec.ps1`

## 4) Smoke test (single line)

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/ingest-smoke-test.ps1 -ApiKey "hp_xxxxx_xxxxxxxxxxxxxxxxx" -BaseUrl "https://your-public-domain"
```

Expected response:

```json
{
  "ok": true,
  "event_id": 123,
  "site_id": 5,
  "tenant_id": 2,
  "blocked": false,
  "auto_blocked": false,
  "block_reason": null
}
```

## 5) UI verification

1. Login to the platform.
2. Open `/telemetry` and click `Refresh`.
3. Verify latest events (`smoke_test`, `cloudflare_waf`, `m365_alert`).
4. Open `/forensics/detail` for session-level timeline.

## 6) Splunk setup check

Add to `.env`:

```env
SPLUNK_HEC_URL=https://your-splunk-host:8088/services/collector/event
SPLUNK_HEC_TOKEN=your-token
```

Restart backend:

```powershell
docker compose up -d --build backend
```

Or update `.env` automatically:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/configure-splunk-env.ps1 -HecUrl "https://your-splunk-host:8088/services/collector/event" -HecToken "your-token" -RestartBackend
```

Note: placeholder values like `YOUR-SPLUNK`, `REAL-SPLUNK-HOST`, `YOUR_TOKEN`, `REAL_TOKEN` are now rejected by scripts.

Public URL updater (safe `.env` write without BOM):

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/set-public-url.ps1 -HostName "your-public-hostname"
```

Optional direct HEC test:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/test-splunk-hec.ps1 -HecUrl "https://your-splunk-host:8088/services/collector/event" -HecToken "your-token"
```

## 7) Important limits

- Platform can only see:
  - direct hits on this deployment
  - telemetry pushed from integrated systems
- Platform cannot auto-read attacks on unrelated websites without integration.
- For direct prevention on customer infrastructure, connect block actions to WAF/firewall/IAM automation.

## 8) One command verification

```powershell
powershell -ExecutionPolicy Bypass -File deploy/scripts/verify-integrations.ps1
```

This prints:

- container status
- latest provider events (`smoke_test`, `cloudflare_waf`, `cloudflare_edge`, `m365_alert`)
- blocked IP table
- backend warning/alert log lines

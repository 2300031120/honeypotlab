param(
    [string]$ComposeFile = "docker-compose.yml",
    [int]$RecentLimit = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path ".integration.env.local")) {
    Write-Warning ".integration.env.local not found. Run bootstrap first."
}

Write-Host "=== Integration Verification ==="

Write-Host ""
Write-Host "[1/4] Service status"
docker compose -f $ComposeFile ps | Out-Host

Write-Host ""
Write-Host "[2/4] Latest provider events"
docker compose -f $ComposeFile exec db mariadb -uuser -ppassword honeypot_db -e "SELECT id,timestamp_utc,event_type,url_path,session_id,site_id,tenant_id,ip,severity,score FROM events WHERE event_type IN ('smoke_test','cloudflare_waf','cloudflare_edge','m365_alert') ORDER BY id DESC LIMIT $RecentLimit;" | Out-Host

Write-Host ""
Write-Host "[3/4] Blocked IPs"
docker compose -f $ComposeFile exec db mariadb -uuser -ppassword honeypot_db -e "SELECT id,ip,reason,timestamp,expires_at FROM blocked_ips ORDER BY id DESC LIMIT 20;" | Out-Host

Write-Host ""
Write-Host "[4/4] Backend alert and error logs (tail)"
docker compose -f $ComposeFile logs backend --tail=200 | findstr /I "TRAP HIT AUTO-BLOCK IP BLOCKED WARNING ERROR SPLUNK" | Out-Host

Write-Host ""
Write-Host "Verification complete."
Write-Host "UI check: /telemetry -> Refresh, /forensics/detail"


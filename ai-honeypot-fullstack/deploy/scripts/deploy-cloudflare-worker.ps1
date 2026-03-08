param(
    [string]$WorkerName = "honeypot-ingest-relay",
    [string]$Route = "",
    [string]$CloudflareAccountId = "",
    [string]$SourceDir = "deploy/integrations/cloudflare",
    [string]$GeneratedEnvFile = "deploy/integrations/generated/cloudflare-worker.env",
    [switch]$DeployNow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    throw "wrangler is not installed. Install with: npm install -g wrangler"
}

if (-not (Test-Path $SourceDir)) {
    throw "Cloudflare source dir not found: $SourceDir"
}

if (-not (Test-Path $GeneratedEnvFile)) {
    throw "Generated env file not found: $GeneratedEnvFile. Run deploy/scripts/render-provider-configs.ps1 first."
}

$vars = @{}
Get-Content $GeneratedEnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()
    $vars[$k] = $v
}

if (-not $vars["HONEYPOT_BASE_URL"] -or -not $vars["HONEYPOT_API_KEY"]) {
    throw "Generated env file missing HONEYPOT_BASE_URL or HONEYPOT_API_KEY."
}

$date = Get-Date -Format "yyyy-MM-dd"
$tomlPath = Join-Path $SourceDir "wrangler.generated.toml"
$devVarsPath = Join-Path $SourceDir ".dev.vars.generated"

$tomlLines = @(
    "name = `"$WorkerName`"",
    "main = `"worker-ingest-relay.js`"",
    "compatibility_date = `"$date`""
)
if ($CloudflareAccountId) {
    $tomlLines += "account_id = `"$CloudflareAccountId`""
}
if ($Route) {
    $tomlLines += "routes = [`"$Route`"]"
}
Set-Content -Path $tomlPath -Value $tomlLines -Encoding UTF8

$sampleRate = "1.0"
if ($vars.ContainsKey("RELAY_SAMPLE_RATE") -and [string]$vars["RELAY_SAMPLE_RATE"]) {
    $sampleRate = [string]$vars["RELAY_SAMPLE_RATE"]
}

$devLines = @(
    "HONEYPOT_BASE_URL=$($vars["HONEYPOT_BASE_URL"])",
    "HONEYPOT_API_KEY=$($vars["HONEYPOT_API_KEY"])",
    "RELAY_SAMPLE_RATE=$sampleRate"
)
Set-Content -Path $devVarsPath -Value $devLines -Encoding UTF8

Write-Host "Generated:"
Write-Host "- $tomlPath"
Write-Host "- $devVarsPath"
Write-Host ""
Write-Host "Run Cloudflare login if needed:"
Write-Host "wrangler login"
Write-Host ""
Write-Host "Deploy command:"
Write-Host "wrangler deploy --config $tomlPath --var HONEYPOT_BASE_URL:$($vars["HONEYPOT_BASE_URL"]) --var HONEYPOT_API_KEY:<REDACTED> --var RELAY_SAMPLE_RATE:$sampleRate"
Write-Host "Note: API key is already present in $devVarsPath"

if ($DeployNow.IsPresent) {
    Write-Host ""
    Write-Host "Deploying worker now..."
    wrangler deploy --config $tomlPath --var "HONEYPOT_BASE_URL:$($vars["HONEYPOT_BASE_URL"])" --var "HONEYPOT_API_KEY:$($vars["HONEYPOT_API_KEY"])" --var "RELAY_SAMPLE_RATE:$sampleRate"
}

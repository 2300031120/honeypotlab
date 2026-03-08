param(
    [string]$EnvFile = ".integration.env.local",
    [string]$OutDir = "deploy/integrations/generated"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
    throw "$EnvFile not found. Run bootstrap-integrations first."
}

$map = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()
    $map[$k] = $v
}

$base = [string]$map["HONEYPOT_BASE_URL"]
$key = [string]$map["HONEYPOT_API_KEY"]
if (-not $base -or -not $key) {
    throw "Missing HONEYPOT_BASE_URL or HONEYPOT_API_KEY in $EnvFile."
}

New-Item -ItemType Directory -Force $OutDir | Out-Null

$workerEnv = @(
    "HONEYPOT_BASE_URL=$base"
    "HONEYPOT_API_KEY=$key"
    "RELAY_SAMPLE_RATE=1.0"
)
Set-Content -Path (Join-Path $OutDir "cloudflare-worker.env") -Value $workerEnv -Encoding UTF8

$logicTemplatePath = "deploy/integrations/m365/logic-app-http-action.json"
if (-not (Test-Path $logicTemplatePath)) {
    throw "Template not found: $logicTemplatePath"
}
$logic = Get-Content $logicTemplatePath -Raw
$logic = $logic.Replace("https://your-platform-domain/api/ingest", "$base/api/ingest")
$logic = $logic.Replace("hp_replace_with_site_api_key", $key)
Set-Content -Path (Join-Path $OutDir "logic-app-http-action.generated.json") -Value $logic -Encoding UTF8

Write-Host "Generated provider config files:"
Write-Host "- $(Join-Path $OutDir 'cloudflare-worker.env')"
Write-Host "- $(Join-Path $OutDir 'logic-app-http-action.generated.json')"


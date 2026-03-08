param(
    [Parameter(Mandatory = $true)]
    [string]$HecUrl,

    [Parameter(Mandatory = $true)]
    [string]$HecToken,

    [switch]$SkipTlsVerify,
    [switch]$RestartBackend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Placeholder {
    param([string]$Value)
    $v = [string]$Value
    if (-not $v) { return $true }
    return $v -match "(?i)(YOUR[-_]|REAL[-_]|<REDACTED>|<TOKEN>|example\.com)"
}

if (Test-Placeholder -Value $HecUrl) {
    throw "HecUrl looks like a placeholder. Use real Splunk HEC URL."
}
if (Test-Placeholder -Value $HecToken) {
    throw "HecToken looks like a placeholder. Use real Splunk HEC token."
}

try {
    $uri = [Uri]$HecUrl
    if (-not $uri.Scheme -or $uri.Scheme.ToLower() -ne "https") {
        throw "HecUrl must use https."
    }
} catch {
    throw "HecUrl is not a valid URL: $HecUrl"
}

$envPath = ".env"
if (-not (Test-Path $envPath)) {
    throw ".env file not found. Create it from .env.example first."
}

$verifyText = if ($SkipTlsVerify.IsPresent) { "false" } else { "true" }

$lines = Get-Content $envPath
$foundUrl = $false
$foundToken = $false
$foundVerify = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^SPLUNK_HEC_URL=") {
        $lines[$i] = "SPLUNK_HEC_URL=$HecUrl"
        $foundUrl = $true
        continue
    }
    if ($lines[$i] -match "^SPLUNK_HEC_TOKEN=") {
        $lines[$i] = "SPLUNK_HEC_TOKEN=$HecToken"
        $foundToken = $true
        continue
    }
    if ($lines[$i] -match "^SPLUNK_HEC_VERIFY_TLS=") {
        $lines[$i] = "SPLUNK_HEC_VERIFY_TLS=$verifyText"
        $foundVerify = $true
        continue
    }
}

if (-not $foundUrl) {
    $lines += "SPLUNK_HEC_URL=$HecUrl"
}
if (-not $foundToken) {
    $lines += "SPLUNK_HEC_TOKEN=$HecToken"
}
if (-not $foundVerify) {
    $lines += "SPLUNK_HEC_VERIFY_TLS=$verifyText"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Resolve-Path $envPath), $lines, $utf8NoBom)
Write-Host "Updated .env with SPLUNK_HEC_URL and SPLUNK_HEC_TOKEN."
if ($SkipTlsVerify.IsPresent) {
    Write-Host "SPLUNK_HEC_VERIFY_TLS=false (self-signed cert mode)."
}

if ($RestartBackend.IsPresent) {
    Write-Host "Restarting backend container..."
    docker compose up -d --build backend | Out-Host
}

Write-Host "Next: run deploy/scripts/test-splunk-hec.ps1 to validate HEC token."

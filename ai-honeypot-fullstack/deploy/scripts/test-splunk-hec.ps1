param(
    [Parameter(Mandatory = $true)]
    [string]$HecUrl,

    [Parameter(Mandatory = $true)]
    [string]$HecToken,

    [string]$Index = "main",
    [string]$SourceType = "cybersentinel:honeypot:events",
    [switch]$Insecure
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

if ($Insecure.IsPresent) {
    try {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    } catch {
        Write-Warning "Could not enable insecure TLS mode in this PowerShell runtime."
    }
}

$payload = @{
    event      = @{
        event_type = "splunk_hec_smoke"
        source     = "deploy/scripts/test-splunk-hec.ps1"
        timestamp  = [DateTime]::UtcNow.ToString("o")
        status     = "ok"
    }
    sourcetype = $SourceType
    host       = $env:COMPUTERNAME
    index      = $Index
} | ConvertTo-Json -Depth 6 -Compress

$channelId = [Guid]::NewGuid().ToString()
Write-Host "Posting test event to Splunk HEC: $HecUrl"
Write-Host "Request channel: $channelId"

try {
    $resp = Invoke-RestMethod -Method Post -Uri $HecUrl -Headers @{
        Authorization = "Splunk $HecToken"
        "Content-Type" = "application/json"
        "X-Splunk-Request-Channel" = $channelId
    } -Body $payload -TimeoutSec 15

    Write-Host "Splunk HEC response:"
    $resp | ConvertTo-Json -Depth 6
} catch {
    Write-Error "Splunk HEC test failed: $($_.Exception.Message)"
    if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
        if ($raw) {
            Write-Host "Server response:"
            Write-Host $raw
        }
    }
    exit 1
}

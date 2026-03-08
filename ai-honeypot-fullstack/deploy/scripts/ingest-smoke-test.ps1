param(
    [Parameter(Mandatory = $true)]
    [string]$ApiKey,

    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [string]$EventType = "smoke_test",
    [string]$Path = "/smoke",
    [string]$Method = "POST",
    [string]$SessionId = "",
    [switch]$Insecure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-IngestUrl {
    param([string]$InputBase)
    $normalized = $InputBase.Trim().TrimEnd("/")
    if (-not $normalized) {
        throw "BaseUrl is empty."
    }
    if ($normalized.ToLower().EndsWith("/api")) {
        return "$normalized/ingest"
    }
    return "$normalized/api/ingest"
}

if ($Insecure.IsPresent) {
    try {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    } catch {
        Write-Warning "Could not enable insecure TLS mode on this PowerShell runtime."
    }
}

if (-not $SessionId) {
    $SessionId = "smoke-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
}

$ingestUrl = Get-IngestUrl -InputBase $BaseUrl
$body = @{
    event_type    = $EventType
    url_path      = $Path
    http_method   = $Method
    captured_data = @{
        source      = "ingest-smoke-test.ps1"
        machine     = $env:COMPUTERNAME
        utc         = [DateTime]::UtcNow.ToString("o")
        random_seed = (Get-Random -Minimum 1000 -Maximum 9999)
    }
    session_id    = $SessionId
} | ConvertTo-Json -Depth 6 -Compress

Write-Host "Posting smoke event to: $ingestUrl"

try {
    $resp = Invoke-RestMethod -Method Post -Uri $ingestUrl -ContentType "application/json" -Headers @{
        "X-API-Key" = $ApiKey
    } -Body $body -TimeoutSec 15

    Write-Host "Ingest response:"
    $resp | ConvertTo-Json -Depth 6
} catch {
    Write-Error "Smoke test failed: $($_.Exception.Message)"
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


param(
    [Parameter(Mandatory = $true)]
    [string]$Username,

    [Parameter(Mandatory = $true)]
    [string]$Password,

    [string]$SiteName = "startup-main",
    [string]$SiteDomain = "yourdomain.com",
    [int]$WaitSeconds = 90,
    [switch]$ForceRecreate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-ReachableTunnelUrl {
    param([string]$CandidateUrl)
    try {
        $hostName = ([Uri]$CandidateUrl).Host
        [System.Net.Dns]::GetHostEntry($hostName) | Out-Null
    } catch {
        return $false
    }

    try {
        $health = Invoke-WebRequest -Method Get -Uri "$CandidateUrl/api/health" -TimeoutSec 8
        return ($health.StatusCode -ge 200 -and $health.StatusCode -lt 500)
    } catch {
        return $false
    }
}

$existingCandidate = $null
if (Test-Path ".integration.env.local") {
    $line = (Get-Content ".integration.env.local" | Where-Object { $_ -like "HONEYPOT_BASE_URL=*" } | Select-Object -First 1)
    if ($line) {
        $existingCandidate = ($line -replace "^HONEYPOT_BASE_URL=", "").Trim()
    }
}

Write-Host "Starting quick tunnel service..."
if ($ForceRecreate.IsPresent) {
    docker compose --profile quick-tunnel up -d --force-recreate cloudflared-quick | Out-Host
} else {
    docker compose --profile quick-tunnel up -d cloudflared-quick | Out-Host
}

Write-Host "Waiting for tunnel URL (up to $WaitSeconds seconds)..."
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$url = $null

while ((Get-Date) -lt $deadline) {
    $logs = docker compose --profile quick-tunnel logs --tail=600 cloudflared-quick
    $text = $logs -join "`n"
    $matches = [regex]::Matches($text, "https://[a-z0-9-]+\.trycloudflare\.com", "IgnoreCase")
    $candidates = New-Object System.Collections.Generic.List[string]

    if ($existingCandidate -and $existingCandidate.ToLower().Contains(".trycloudflare.com")) {
        if (-not $candidates.Contains($existingCandidate)) {
            $candidates.Add($existingCandidate)
        }
    }

    if ($matches.Count -gt 0) {
        foreach ($m in $matches) {
            $val = [string]$m.Value
            if (-not $candidates.Contains($val)) {
                $candidates.Add($val)
            }
        }
    }

    if ($candidates.Count -gt 0) {
        for ($i = $candidates.Count - 1; $i -ge 0; $i--) {
            $candidate = $candidates[$i]
            if (Test-ReachableTunnelUrl -CandidateUrl $candidate) {
                $url = $candidate
                break
            }
        }
        if ($url) { break }
    }
    Start-Sleep -Seconds 3
}

if (-not $url) {
    throw "Could not find a reachable quick tunnel URL within $WaitSeconds seconds."
}

Write-Host "Detected quick tunnel URL: $url"

$bootstrapScript = Join-Path $PSScriptRoot "bootstrap-integrations.ps1"
& $bootstrapScript `
    -BaseUrl $url `
    -Username $Username `
    -Password $Password `
    -SiteName $SiteName `
    -SiteDomain $SiteDomain

Write-Host ""
Write-Host "Bootstrap via quick tunnel complete."
Write-Host "Saved integration values in .integration.env.local"
Write-Host "Use this URL now: $url"

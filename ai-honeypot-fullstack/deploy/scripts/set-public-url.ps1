param(
    [Parameter(Mandatory = $true)]
    [string]$HostName,
    [switch]$SetTlsDomain
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$hostClean = ($HostName.Trim()).TrimStart("https://").Trim("/")
if (-not $hostClean) {
    throw "HostName is empty."
}

$envPath = ".env"
if (-not (Test-Path $envPath)) {
    throw ".env not found."
}

$lines = Get-Content $envPath
$foundPublic = $false
$foundCors = $false
$foundTrusted = $false
$foundTlsDomain = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^PUBLIC_BASE_URL=") {
        $lines[$i] = "PUBLIC_BASE_URL=https://$hostClean"
        $foundPublic = $true
        continue
    }
    if ($lines[$i] -match "^CORS_ORIGINS=") {
        $lines[$i] = "CORS_ORIGINS=https://$hostClean,http://localhost,http://127.0.0.1"
        $foundCors = $true
        continue
    }
    if ($lines[$i] -match "^TRUSTED_HOSTS=") {
        $lines[$i] = "TRUSTED_HOSTS=$hostClean,*.trycloudflare.com,localhost,127.0.0.1"
        $foundTrusted = $true
        continue
    }
    if ($lines[$i] -match "^TLS_DOMAIN=") {
        if ($SetTlsDomain.IsPresent) {
            $lines[$i] = "TLS_DOMAIN=$hostClean"
        }
        $foundTlsDomain = $true
        continue
    }
}

if (-not $foundPublic) { $lines += "PUBLIC_BASE_URL=https://$hostClean" }
if (-not $foundCors) { $lines += "CORS_ORIGINS=https://$hostClean,http://localhost,http://127.0.0.1" }
if (-not $foundTrusted) { $lines += "TRUSTED_HOSTS=$hostClean,*.trycloudflare.com,localhost,127.0.0.1" }
if ($SetTlsDomain.IsPresent -and -not $foundTlsDomain) { $lines += "TLS_DOMAIN=$hostClean" }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Resolve-Path $envPath), $lines, $utf8NoBom)

Write-Host "Updated .env:"
Write-Host "- PUBLIC_BASE_URL=https://$hostClean"
Write-Host "- CORS_ORIGINS=https://$hostClean,http://localhost,http://127.0.0.1"
Write-Host "- TRUSTED_HOSTS=$hostClean,*.trycloudflare.com,localhost,127.0.0.1"
if ($SetTlsDomain.IsPresent) {
    Write-Host "- TLS_DOMAIN=$hostClean"
}


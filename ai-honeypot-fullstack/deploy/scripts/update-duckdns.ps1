param(
    [string]$Domain = "",
    [string]$Token = "",
    [string]$Ip = ""
)

$ErrorActionPreference = "Stop"

function Read-DotEnvFile {
    param([string]$Path)
    $data = @{}
    if (-not (Test-Path $Path)) {
        return $data
    }
    foreach ($line in Get-Content $Path) {
        $raw = [string]$line
        if ([string]::IsNullOrWhiteSpace($raw)) { continue }
        $trimmed = $raw.Trim()
        if ($trimmed.StartsWith("#")) { continue }
        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -ne 2) { continue }
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $data[$key] = $value
        }
    }
    return $data
}

if ([string]::IsNullOrWhiteSpace($Domain) -or [string]::IsNullOrWhiteSpace($Token)) {
    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
    $envFile = Join-Path $repoRoot ".env"
    $envMap = Read-DotEnvFile -Path $envFile

    if ([string]::IsNullOrWhiteSpace($Domain) -and $envMap.ContainsKey("DUCKDNS_DOMAIN")) {
        $Domain = [string]$envMap["DUCKDNS_DOMAIN"]
    }
    if ([string]::IsNullOrWhiteSpace($Token) -and $envMap.ContainsKey("DUCKDNS_TOKEN")) {
        $Token = [string]$envMap["DUCKDNS_TOKEN"]
    }
}

if ([string]::IsNullOrWhiteSpace($Domain) -or [string]::IsNullOrWhiteSpace($Token)) {
    throw "Missing DuckDNS credentials. Provide -Domain and -Token, or set DUCKDNS_DOMAIN and DUCKDNS_TOKEN in .env."
}

$uri = "https://www.duckdns.org/update?domains=$Domain&token=$Token&ip=$Ip"
$response = Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 20
$text = [string]$response

if ($text.Trim().ToUpperInvariant() -eq "OK") {
    Write-Output "DuckDNS updated successfully for $Domain.duckdns.org"
    exit 0
}

throw "DuckDNS update failed. Response: $text"

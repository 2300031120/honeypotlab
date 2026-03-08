param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$Username,

    [Parameter(Mandatory = $true)]
    [string]$Password,

    [string]$SiteName = "startup-main",
    [string]$SiteDomain = "yourdomain.com",
    [switch]$NoRotate,
    [switch]$SkipSeedEvents,
    [string]$OutFile = ".integration.env.local",
    [switch]$Insecure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-ApiBase {
    param([string]$RawBase)
    $trimmed = ($RawBase | ForEach-Object { $_.Trim() }).TrimEnd("/")
    if (-not $trimmed) {
        throw "BaseUrl is empty."
    }
    if ($trimmed.ToLower().EndsWith("/api")) {
        return $trimmed
    }
    return "$trimmed/api"
}

function Ensure-Array {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [System.Array]) { return $Value }
    return @($Value)
}

function Post-IngestEvent {
    param(
        [string]$ApiBase,
        [string]$ApiKey,
        [hashtable]$EventBody
    )
    return Invoke-RestMethod -Method Post -Uri "$ApiBase/ingest" -Headers @{
        "X-API-Key"    = $ApiKey
        "Content-Type" = "application/json"
    } -Body ($EventBody | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 20
}

if ($Insecure.IsPresent) {
    try {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    } catch {
        Write-Warning "Could not enable insecure TLS mode in this PowerShell runtime."
    }
}

$apiBase = Normalize-ApiBase -RawBase $BaseUrl
Write-Host "API base: $apiBase"

$loginPayload = @{
    username = $Username
    password = $Password
} | ConvertTo-Json -Compress

$login = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/login" -ContentType "application/json" -Body $loginPayload -TimeoutSec 20
$token = [string]$login.token
if (-not $token) {
    throw "Login succeeded but token is empty."
}

$authHeader = @{ Authorization = "Bearer $token" }
$sitesRaw = Invoke-RestMethod -Method Get -Uri "$apiBase/sites" -Headers $authHeader -TimeoutSec 20
$sites = Ensure-Array -Value $sitesRaw

$site = $null
foreach ($s in $sites) {
    $nameMatch = [string]$s.name -eq $SiteName
    $domainMatch = [string]$s.domain -eq $SiteDomain
    if ($nameMatch -or $domainMatch) {
        $site = $s
        break
    }
}

$apiKey = ""

if ($null -eq $site) {
    Write-Host "No matching site found. Creating site: $SiteName ($SiteDomain)"
    $sitePayload = @{
        name   = $SiteName
        domain = $SiteDomain
    } | ConvertTo-Json -Compress
    $created = Invoke-RestMethod -Method Post -Uri "$apiBase/sites" -Headers $authHeader -ContentType "application/json" -Body $sitePayload -TimeoutSec 20
    $site = $created.site
    $apiKey = [string]$created.api_key
    if (-not $apiKey) {
        throw "Site created but API key was not returned."
    }
} else {
    if ($NoRotate.IsPresent) {
        throw "Existing site found but current API key cannot be read. Re-run without -NoRotate so key can be rotated."
    }
    $siteId = [int]$site.id
    Write-Host "Rotating API key for site id $siteId ($($site.name))"
    $rotated = Invoke-RestMethod -Method Post -Uri "$apiBase/sites/$siteId/rotate-key" -Headers $authHeader -TimeoutSec 20
    $apiKey = [string]$rotated.api_key
    if (-not $apiKey) {
        throw "Rotate-key response did not include api_key."
    }
}

if ($SkipSeedEvents.IsPresent -eq $false) {
    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

    $cfEvent = @{
        event_type    = "cloudflare_waf"
        url_path      = "/wp-login.php"
        http_method   = "POST"
        captured_data = @{
            source       = "bootstrap-script"
            provider     = "cloudflare"
            action       = "managed_challenge"
            ray_id       = "bootstrap-$suffix"
            client_ip    = "198.51.100.10"
            country      = "IN"
            threat_score = 37
        }
        session_id    = "cf-bootstrap-$suffix"
    }

    $m365Event = @{
        event_type    = "m365_alert"
        url_path      = "/identity"
        http_method   = "ALERT"
        captured_data = @{
            source      = "bootstrap-script"
            provider    = "m365"
            alert_title = "Impossible travel activity"
            severity    = "high"
            user        = "user@company.com"
            ip          = "203.0.113.5"
        }
        session_id    = "m365-bootstrap-$suffix"
    }

    $cfResp = Post-IngestEvent -ApiBase $apiBase -ApiKey $apiKey -EventBody $cfEvent
    $m365Resp = Post-IngestEvent -ApiBase $apiBase -ApiKey $apiKey -EventBody $m365Event

    Write-Host "Seed events posted:"
    Write-Host ("- cloudflare_waf event_id={0}" -f $cfResp.event_id)
    Write-Host ("- m365_alert event_id={0}" -f $m365Resp.event_id)
}

$publicBase = $apiBase.Substring(0, $apiBase.Length - 4)
$siteIdOut = [int]$site.id
$outLines = @(
    "HONEYPOT_BASE_URL=$publicBase"
    "HONEYPOT_API_KEY=$apiKey"
    "HONEYPOT_SITE_ID=$siteIdOut"
    "HONEYPOT_SITE_NAME=$($site.name)"
    "HONEYPOT_SITE_DOMAIN=$($site.domain)"
)

Set-Content -Path $OutFile -Value $outLines -Encoding UTF8

Write-Host ""
Write-Host "Integration bootstrap completed."
Write-Host "Saved credentials file: $OutFile"
Write-Host "Next checks:"
Write-Host "1) Open /telemetry and click Refresh"
Write-Host "2) Query DB for latest events"
Write-Host "3) Configure provider webhooks with HONEYPOT_API_KEY from $OutFile"


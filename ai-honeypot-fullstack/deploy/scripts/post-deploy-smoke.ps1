param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [string]$Username = "ops_smoke",
    [string]$Password = "StrongPass123!",
    [string]$Token = "",
    [string]$HostHeader = "",
    [string]$Email = "",
    [string]$SiteName = "smoke-site",
    [string]$SiteDomain = "smoke.example.com",
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

function Get-HeaderValue {
    param(
        $Headers,
        [Parameter(Mandatory = $true)][string]$Name
    )
    if ($null -eq $Headers) {
        return ""
    }
    $value = $Headers[$Name]
    if ($value -is [System.Array]) {
        return [string]$value[0]
    }
    return [string]$value
}

function Merge-Headers {
    param(
        [hashtable]$Base,
        [hashtable]$Extra
    )

    $merged = @{}
    if ($Base) {
        foreach ($key in $Base.Keys) {
            $merged[$key] = $Base[$key]
        }
    }
    if ($Extra) {
        foreach ($key in $Extra.Keys) {
            $merged[$key] = $Extra[$key]
        }
    }
    return $merged
}

function Is-PlaceholderValue {
    param([string]$Value)
    if (-not $Value) {
        return $false
    }
    $trimmed = $Value.Trim()
    return $trimmed -match '^<[^>]+>$'
}

function Get-ResponseStatusCode {
    param($ErrorRecord)
    if ($null -eq $ErrorRecord) { return $null }
    if ($null -eq $ErrorRecord.Exception) { return $null }

    if ($null -ne $ErrorRecord.Exception.Response) {
        try {
            return [int]$ErrorRecord.Exception.Response.StatusCode
        } catch {
            try {
                return [int]$ErrorRecord.Exception.Response.StatusCode.value__
            } catch {
                # Continue and try alternate shape.
            }
        }
    }

    try {
        return [int]$ErrorRecord.Exception.StatusCode
    } catch {
        return $null
    }
}

function Get-ResponseBodyText {
    param($ErrorRecord)
    if ($null -eq $ErrorRecord) {
        return ""
    }

    if ($null -ne $ErrorRecord.ErrorDetails -and $null -ne $ErrorRecord.ErrorDetails.Message -and [string]$ErrorRecord.ErrorDetails.Message) {
        return [string]$ErrorRecord.ErrorDetails.Message
    }

    if ($null -eq $ErrorRecord.Exception -or $null -eq $ErrorRecord.Exception.Response) {
        return ""
    }

    try {
        $stream = $ErrorRecord.Exception.Response.GetResponseStream()
        if ($null -eq $stream) {
            return ""
        }
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        $reader.Dispose()
        return [string]$body
    } catch {
        return ""
    }
}

function Try-Login {
    param(
        [Parameter(Mandatory = $true)][string]$ApiBase,
        [Parameter(Mandatory = $true)][string]$LoginUser,
        [Parameter(Mandatory = $true)][string]$LoginPassword,
        [hashtable]$BaseHeaders = @{}
    )
    $payload = @{
        username = $LoginUser
        password = $LoginPassword
    } | ConvertTo-Json -Compress

    try {
        return Invoke-RestMethod -Method Post -Uri "$ApiBase/auth/login" -Headers $BaseHeaders -ContentType "application/json" -Body $payload -TimeoutSec 20
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            try {
                $statusCode = [int]$_.Exception.Response.StatusCode.value__
            } catch {
                $statusCode = $null
            }
        }
        if ($statusCode -eq 401) {
            return $null
        }
        throw
    }
}

if ($Insecure.IsPresent) {
    try {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    } catch {
        Write-Warning "Could not enable insecure TLS mode in this PowerShell runtime."
    }
}

$apiBase = Normalize-ApiBase -RawBase $BaseUrl
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$defaultHeaders = @{}
if ($HostHeader) {
    $defaultHeaders["Host"] = $HostHeader.Trim()
}

if (-not $Email) {
    $Email = "$Username+$runId@example.com"
}

if (-not $Token) {
    if ((Is-PlaceholderValue -Value $Username) -or (Is-PlaceholderValue -Value $Password) -or (Is-PlaceholderValue -Value $Email)) {
        throw "Replace placeholder values (example: <user>, <pass>, <email>) with real credentials, or pass -Token with a valid operator JWT."
    }
}

Write-Host "API base: $apiBase"

Write-Host "[1/7] Health check"
$healthResponse = $null
try {
    $healthResponse = Invoke-WebRequest -UseBasicParsing -Method Get -Uri "$apiBase/health" -Headers $defaultHeaders -TimeoutSec 20
} catch {
    $statusCode = Get-ResponseStatusCode -ErrorRecord $_
    $responseBody = Get-ResponseBodyText -ErrorRecord $_
    if ($statusCode -eq 530 -or $responseBody -match "error code:\s*1033") {
        throw "Health check failed with Cloudflare 1033 (origin/tunnel unavailable). Restore origin connectivity for '$BaseUrl' and rerun smoke."
    }
    throw
}
$healthPayload = $healthResponse.Content | ConvertFrom-Json
if ([string]$healthPayload.status -ne "healthy") {
    throw "Health endpoint did not return status=healthy."
}
$healthRequestId = Get-HeaderValue -Headers $healthResponse.Headers -Name "X-Request-ID"
if (-not $healthRequestId) {
    throw "Health response did not include X-Request-ID header."
}

Write-Host "[2/7] Auth (login or signup fallback)"
$tokenValue = [string]$Token
if (-not $tokenValue) {
    $login = Try-Login -ApiBase $apiBase -LoginUser $Username -LoginPassword $Password -BaseHeaders $defaultHeaders
    if ($null -eq $login) {
        $signupPayload = @{
            username = $Username
            email = $Email
            password = $Password
        } | ConvertTo-Json -Compress
        try {
            $signup = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/signup" -Headers $defaultHeaders -ContentType "application/json" -Body $signupPayload -TimeoutSec 20
            if ($null -eq $signup) {
                throw "Signup failed with empty response."
            }
            $login = Try-Login -ApiBase $apiBase -LoginUser $Username -LoginPassword $Password -BaseHeaders $defaultHeaders
        } catch {
            $statusCode = Get-ResponseStatusCode -ErrorRecord $_
            $responseBody = Get-ResponseBodyText -ErrorRecord $_
            if ($responseBody -match "Signup is disabled" -or $statusCode -eq 403) {
                throw "Login failed for user '$Username' and signup is disabled on this deployment. Use valid existing operator credentials or pass -Token."
            }
            throw
        }
    }
    $tokenValue = [string]$login.token
    if (-not $tokenValue) {
        throw "Could not obtain auth token from login."
    }
} else {
    Write-Host "Using provided operator token (skipping login/signup)."
}
$authHeader = Merge-Headers -Base $defaultHeaders -Extra @{ Authorization = "Bearer $tokenValue" }

Write-Host "[3/7] Auth profile check"
$me = Invoke-RestMethod -Method Get -Uri "$apiBase/auth/me" -Headers $authHeader -TimeoutSec 20
$expectedIdentity = [string]$Username
$actualUsername = [string]$me.username
$actualEmail = ""
if ($me.PSObject.Properties.Name -contains "email") {
    $actualEmail = [string]$me.email
}

$identityMatches = $false
if ($actualUsername -eq $expectedIdentity -or ($actualEmail -and $actualEmail -eq $expectedIdentity)) {
    $identityMatches = $true
}

# Common case: caller passes email, auth profile returns username.
if (-not $identityMatches -and $expectedIdentity.Contains("@")) {
    $localPart = $expectedIdentity.Split("@", 2)[0]
    if ($localPart -and $actualUsername -eq $localPart) {
        $identityMatches = $true
    }
}

if (-not $identityMatches) {
    throw "Authenticated user mismatch. Expected '$expectedIdentity', got username '$actualUsername' and email '$actualEmail'."
}

Write-Host "[4/7] Site key check (create or rotate)"
$sitesRaw = Invoke-RestMethod -Method Get -Uri "$apiBase/sites" -Headers $authHeader -TimeoutSec 20
$sites = Ensure-Array -Value $sitesRaw
$site = $null
foreach ($candidate in $sites) {
    if ([string]$candidate.domain -eq $SiteDomain -or [string]$candidate.name -eq $SiteName) {
        $site = $candidate
        break
    }
}

$apiKey = ""
if ($null -eq $site) {
    $createPayload = @{
        name = $SiteName
        domain = $SiteDomain
    } | ConvertTo-Json -Compress
    $created = Invoke-RestMethod -Method Post -Uri "$apiBase/sites" -Headers $authHeader -ContentType "application/json" -Body $createPayload -TimeoutSec 20
    if ($created.PSObject.Properties.Name -contains "site") {
        $site = $created.site
    } else {
        $site = $created
    }
    $apiKey = [string]$created.api_key
} else {
    $siteId = [int]$site.id
    $rotated = Invoke-RestMethod -Method Post -Uri "$apiBase/sites/$siteId/rotate-key" -Headers $authHeader -TimeoutSec 20
    $apiKey = [string]$rotated.api_key
}

if (-not $apiKey) {
    throw "API key was not returned from site create/rotate flow."
}

$resolvedSiteDomain = $SiteDomain
if ($null -ne $site -and ($site.PSObject.Properties.Name -contains "domain")) {
    $resolvedSiteDomain = [string]$site.domain
}

Write-Host "[5/7] Ingest check"
$sessionId = "post-deploy-smoke-$runId"
$ingestBody = @{
    event_type = "smoke_test"
    url_path = "/post-deploy-smoke"
    http_method = "POST"
    session_id = $sessionId
    captured_data = @{
        source = "post-deploy-smoke.ps1"
        utc = [DateTime]::UtcNow.ToString("o")
    }
} | ConvertTo-Json -Depth 6 -Compress

$ingestHeaders = Merge-Headers -Base $defaultHeaders -Extra @{
    "X-API-Key" = $apiKey
    "Content-Type" = "application/json"
}
$ingestResp = Invoke-RestMethod -Method Post -Uri "$apiBase/ingest" -Headers $ingestHeaders -Body $ingestBody -TimeoutSec 20

if ([string]$ingestResp.status -ne "accepted") {
    throw "Ingest did not return accepted status."
}

Write-Host "[6/7] Dashboard stats check"
$dashboard = Invoke-RestMethod -Method Get -Uri "$apiBase/dashboard/stats" -Headers $authHeader -TimeoutSec 20
$summary = $dashboard.summary
if ($null -eq $summary -or [int]$summary.total -lt 1) {
    throw "Dashboard stats did not reflect ingested events."
}

Write-Host "[7/7] Public telemetry snapshot check"
$snapshot = Invoke-RestMethod -Method Get -Uri "$apiBase/public/telemetry/snapshot" -Headers $defaultHeaders -TimeoutSec 20
if ($null -eq $snapshot.summary) {
    throw "Public telemetry snapshot missing summary."
}
$snapshotFeed = Ensure-Array -Value $snapshot.feed
if ($snapshotFeed.Count -lt 1) {
    throw "Public telemetry snapshot feed is empty."
}

Write-Host ""
Write-Host "Post-deploy smoke checks passed."
Write-Host "request_id=$healthRequestId user=$Username site=$resolvedSiteDomain session=$sessionId"

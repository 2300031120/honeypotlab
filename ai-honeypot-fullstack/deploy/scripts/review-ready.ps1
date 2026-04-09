param(
    [switch]$SkipChecks,
    [switch]$NoBuild,
    [switch]$SkipApiFlow,
    [switch]$Down
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Name"
    & $Action
}

function Wait-UrlReady {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$ExpectedStatus = 200,
        [int]$Attempts = 30,
        [int]$SleepSeconds = 2
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing
            if ([int]$response.StatusCode -eq $ExpectedStatus) {
                return $true
            }
        } catch {
            # Retry until attempts are exhausted.
        }
        Start-Sleep -Seconds $SleepSeconds
    }

    return $false
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $repoRoot

try {
    if ($Down) {
        Invoke-Step -Name "Stopping local stack" -Action {
            powershell -ExecutionPolicy Bypass -File deploy/scripts/local-up.ps1 -Down
        }
        exit 0
    }

    if (-not $SkipChecks) {
        Invoke-Step -Name "Running full quality gate (backend + frontend)" -Action {
            powershell -ExecutionPolicy Bypass -File deploy/scripts/check-all.ps1
        }
    } else {
        Write-Host "Skipping quality gate as requested."
    }

    Invoke-Step -Name "Starting local demo stack" -Action {
        if ($NoBuild) {
            powershell -ExecutionPolicy Bypass -File deploy/scripts/local-up.ps1 -NoBuild
        } else {
            powershell -ExecutionPolicy Bypass -File deploy/scripts/local-up.ps1
        }
    }

    Invoke-Step -Name "Waiting for frontend/backend readiness" -Action {
        if (-not (Wait-UrlReady -Url "http://localhost/" -ExpectedStatus 200 -Attempts 30 -SleepSeconds 2)) {
            throw "Frontend did not become ready at http://localhost/."
        }
        if (-not (Wait-UrlReady -Url "http://localhost/api/health" -ExpectedStatus 200 -Attempts 30 -SleepSeconds 2)) {
            throw "Backend did not become ready at http://localhost/api/health."
        }
    }

    $health = Invoke-RestMethod -Uri "http://localhost/api/health"
    Write-Host ""
    Write-Host "Health summary:"
    Write-Host ("- status: {0}" -f $health.status)
    Write-Host ("- total events: {0}" -f $health.summary.total)
    Write-Host ("- live sessions: {0}" -f $health.summary.live_sessions)

    $apiFlowResult = $null
    if (-not $SkipApiFlow) {
        Invoke-Step -Name "Running API smoke flow (signup/login/site/ingest/dashboard)" -Action {
            $base = "http://localhost/api"
            $suffix = Get-Random -Minimum 10000 -Maximum 99999
            $username = "review_$suffix"
            $email = "$username@example.com"
            $password = "StrongPass123"

            $signupBody = @{
                username = $username
                email = $email
                password = $password
            } | ConvertTo-Json
            $signup = Invoke-RestMethod -Uri "$base/auth/signup" -Method Post -ContentType "application/json" -Body $signupBody

            $loginBody = @{
                username = $username
                password = $password
            } | ConvertTo-Json
            $login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body $loginBody

            $token = [string]$login.token
            if (-not $token) {
                throw "Login token was empty."
            }
            $authHeaders = @{ Authorization = "Bearer $token" }

            $siteBody = @{
                name = "review-site"
                domain = "review-$suffix.example.com"
            } | ConvertTo-Json
            $site = Invoke-RestMethod -Uri "$base/sites" -Method Post -ContentType "application/json" -Headers $authHeaders -Body $siteBody

            $apiKey = [string]$site.api_key
            if (-not $apiKey) {
                throw "Site API key was not returned."
            }

            $ingestHeaders = @{ "X-API-Key" = $apiKey }
            $ingestBody = @{
                event_type = "http"
                url_path = "/admin/login"
                http_method = "POST"
                captured_data = @{
                    username = "attacker"
                    source = "review-ready-smoke"
                }
            } | ConvertTo-Json -Depth 8
            $ingest = Invoke-RestMethod -Uri "$base/ingest" -Method Post -ContentType "application/json" -Headers $ingestHeaders -Body $ingestBody

            $stats = Invoke-RestMethod -Uri "$base/dashboard/stats" -Headers $authHeaders

            $script:apiFlowResult = [ordered]@{
                signup_status = [string]$signup.status
                login_user = [string]$login.username
                site_id = [int]$site.id
                ingest_status = [string]$ingest.status
                dashboard_total = [int]$stats.summary.total
            }
        }
    } else {
        Write-Host ""
        Write-Host "Skipping API smoke flow as requested."
    }

    Write-Host ""
    Write-Host "Review-ready summary"
    Write-Host "- Frontend: http://localhost/"
    Write-Host "- Backend health: http://localhost/api/health"
    if ($apiFlowResult) {
        Write-Host ("- API smoke: signup={0}, ingest={1}, dashboard_total={2}" -f $apiFlowResult.signup_status, $apiFlowResult.ingest_status, $apiFlowResult.dashboard_total)
    }
    Write-Host ""
    Write-Host "Stack status:"
    docker compose ps
}
finally {
    Pop-Location
}

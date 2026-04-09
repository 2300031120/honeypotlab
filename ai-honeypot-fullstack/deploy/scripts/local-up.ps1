param(
    [switch]$NoBuild,
    [switch]$Down
)

$ErrorActionPreference = "Stop"

function Set-LocalEnvDefaults {
    param([hashtable]$Defaults)

    foreach ($entry in $Defaults.GetEnumerator()) {
        Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value
    }
}

function Import-EnvFile {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            return
        }

        $name = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Item -Path "Env:$name" -Value $value
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Push-Location $repoRoot

try {
    if ($Down) {
        & docker compose down
        exit $LASTEXITCODE
    }

    $defaults = @{
        APP_ENV                    = "development"
        PUBLIC_BASE_URL            = "http://localhost"
        VITE_PUBLIC_SITE_NAME      = "CyberSentinel AI"
        VITE_PUBLIC_SHORT_NAME     = "CyberSentinel"
        VITE_PUBLIC_BRAND_TEXT     = "CYBERSENTINEL AI"
        VITE_PUBLIC_TAGLINE        = "Deception-led threat detection"
        VITE_PUBLIC_SITE_DESCRIPTION = "Deception-led threat detection platform for earlier attacker visibility, preserved evidence, and analyst-ready incident context."
        VITE_PUBLIC_SITE_URL       = "http://localhost"
        VITE_PUBLIC_APP_URL        = "http://localhost"
        VITE_PUBLIC_LOGIN_URL      = "/auth/login"
        CORS_ORIGINS               = "http://localhost,http://127.0.0.1,http://localhost:5173,http://127.0.0.1:5173"
        TRUSTED_HOSTS              = "localhost,127.0.0.1,testserver,backend"
        FORCE_HTTPS_REDIRECT       = "false"
        DECOY_COOKIE_SECURE        = "false"
        AUTH_COOKIE_SECURE         = "false"
        AUTH_COOKIE_SAMESITE       = "lax"
        DECOY_COOKIE_SAMESITE      = "lax"
        ENABLE_DEMO_SEED           = "true"
        ALLOW_SIGNUP               = "true"
    }

    Set-LocalEnvDefaults -Defaults $defaults
    Import-EnvFile -Path (Join-Path $repoRoot ".env.local")

    $composeArgs = @("compose", "up", "-d")
    if (-not $NoBuild) {
        $composeArgs += "--build"
    }
    $composeArgs += @("frontend", "backend")

    Write-Host "Starting local stack with development-safe overrides..."
    & docker @composeArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    Write-Host ""
    Write-Host "Local URLs"
    Write-Host "Frontend: http://localhost/"
    Write-Host "Backend health: http://localhost/api/health"
    Write-Host ""
    Write-Host "Use '.env.local' to override these local defaults without touching production '.env'."
}
finally {
    Pop-Location
}

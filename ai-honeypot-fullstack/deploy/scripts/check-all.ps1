param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$frontendDir = Join-Path $repoRoot "frontend"

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$WorkingDir,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Name"
    Push-Location $WorkingDir
    try {
        & $Action
    } finally {
        Pop-Location
    }
}

if (-not $SkipBackend) {
    Invoke-Step -Name "Backend tests" -WorkingDir $repoRoot -Action { python -m pytest -q }
}

if (-not $SkipFrontend) {
    Invoke-Step -Name "Frontend lint" -WorkingDir $frontendDir -Action { npm run lint }
    Invoke-Step -Name "Frontend tests" -WorkingDir $frontendDir -Action { npm run test:ci }
    if (-not $SkipBuild) {
        Invoke-Step -Name "Frontend build" -WorkingDir $frontendDir -Action { npm run build }
    }
}

Write-Host ""
Write-Host "All selected checks passed."

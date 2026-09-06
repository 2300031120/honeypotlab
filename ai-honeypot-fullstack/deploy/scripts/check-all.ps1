param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$frontendDir = Join-Path $repoRoot "frontend"

function Get-PythonExe {
    $venvPython = Join-Path $repoRoot ".venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        return @($venvPython)
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @("python")
    }
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return @("py", "-3")
    }
    throw "Python executable not found (expected .venv, 'python', or 'py')."
}

function Invoke-Python {
    param([Parameter(Mandatory = $true)][string[]]$Args)
    $python = @(Get-PythonExe)
    if ($python.Length -eq 2) {
        & $python[0] $python[1] @Args
    } else {
        & $python[0] @Args
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed with exit code $LASTEXITCODE."
    }
}

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
    Invoke-Step -Name "Backend tests" -WorkingDir $repoRoot -Action { Invoke-Python -Args @("-m", "pytest", "-q") }
}

if (-not $SkipFrontend) {
    Invoke-Step -Name "Frontend lint" -WorkingDir $frontendDir -Action { npm run lint }
    Invoke-Step -Name "Frontend type-check" -WorkingDir $frontendDir -Action { npm run type-check }
    Invoke-Step -Name "Frontend tests" -WorkingDir $frontendDir -Action { npm run test:ci }
    if (-not $SkipBuild) {
        Invoke-Step -Name "Frontend build" -WorkingDir $frontendDir -Action { npm run build }
    }
}

Write-Host ""
Write-Host "All selected checks passed."

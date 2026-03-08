[CmdletBinding()]
param(
    [switch]$NoCache,
    [switch]$Pull,
    [switch]$RebuildBackend,
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

function Resolve-DefaultProjectRoot {
    $scriptDir = $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($scriptDir)) {
        if (-not [string]::IsNullOrWhiteSpace($PSCommandPath)) {
            $scriptDir = Split-Path -Parent $PSCommandPath
        } elseif ($MyInvocation.MyCommand.Path) {
            $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        }
    }
    if ([string]::IsNullOrWhiteSpace($scriptDir)) {
        throw "Unable to resolve script directory. Pass -ProjectRoot explicitly."
    }
    return (Resolve-Path (Join-Path $scriptDir "..\\..")).Path
}

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

Require-Command -Name "docker"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Resolve-DefaultProjectRoot
} else {
    $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

Set-Location $ProjectRoot

Write-Host "Project root: $ProjectRoot" -ForegroundColor Cyan

$frontendBuildArgs = @("compose", "build")
if ($Pull) { $frontendBuildArgs += "--pull" }
if ($NoCache) { $frontendBuildArgs += "--no-cache" }
$frontendBuildArgs += "frontend"

Write-Host "Running: docker $($frontendBuildArgs -join ' ')" -ForegroundColor Yellow
& docker @frontendBuildArgs

if ($RebuildBackend) {
    $backendBuildArgs = @("compose", "build")
    if ($Pull) { $backendBuildArgs += "--pull" }
    if ($NoCache) { $backendBuildArgs += "--no-cache" }
    $backendBuildArgs += "backend"
    Write-Host "Running: docker $($backendBuildArgs -join ' ')" -ForegroundColor Yellow
    & docker @backendBuildArgs
}

$services = @("frontend")
if ($RebuildBackend) {
    $services += "backend"
}

$upArgs = @("compose", "up", "-d", "--force-recreate") + $services
Write-Host "Running: docker $($upArgs -join ' ')" -ForegroundColor Yellow
& docker @upArgs

Write-Host "Container status:" -ForegroundColor Cyan
& docker compose ps frontend backend

Write-Host "Published frontend assets (container):" -ForegroundColor Cyan
try {
    & docker compose exec -T frontend sh -lc "ls -1 /usr/share/nginx/html/assets | head -n 20"
} catch {
    Write-Warning "Unable to list frontend assets inside container."
}

Write-Host "Redeploy completed." -ForegroundColor Green
Write-Host "Tip: hard refresh browser (Ctrl+Shift+R) and re-test Google login." -ForegroundColor Green

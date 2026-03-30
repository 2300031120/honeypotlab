[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$ApiPrefix = "/api",
    [string]$GatewayService = "tls-gateway",
    [string]$OutputPath = "",
    [string]$ProjectRoot = "",
    [switch]$NoReload,
    [switch]$StartGateway,
    [switch]$ForceRecreateGateway
)

Set-StrictMode -Version Latest
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

function Resolve-PythonCommand {
    foreach ($candidate in @("py", "python", "python3")) {
        if (Get-Command $candidate -ErrorAction SilentlyContinue) {
            if ($candidate -eq "py") {
                return @("py", "-3")
            }
            return @($candidate)
        }
    }
    throw "Missing required Python launcher: py, python, or python3."
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @()
    )
    $display = @($FilePath) + $Arguments
    Write-Host "Running: $($display -join ' ')" -ForegroundColor Yellow
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

function Get-GatewayContainerId {
    param([Parameter(Mandatory = $true)][string]$Service)
    $result = & docker compose ps -q $Service 2>$null
    if ($LASTEXITCODE -ne 0) {
        return ""
    }
    return [string](($result | Select-Object -First 1) -as [string]).Trim()
}

function Ensure-GatewayStarted {
    param(
        [Parameter(Mandatory = $true)][string]$Service,
        [switch]$ForceRecreate
    )
    $args = @("compose", "--profile", "tls", "up", "-d")
    if ($ForceRecreate.IsPresent) {
        $args += "--force-recreate"
    }
    $args += $Service
    Invoke-CheckedCommand -FilePath "docker" -Arguments $args
}

function Test-GatewayHookActive {
    param([Parameter(Mandatory = $true)][string]$Service)
    & docker compose exec -T $Service sh -lc "grep -q 'cybersentinel-blocked-ips.conf' /etc/nginx/conf.d/default.conf && test -f /etc/nginx/cybersentinel/cybersentinel-blocked-ips.conf" *> $null
    return ($LASTEXITCODE -eq 0)
}

Require-Command -Name "docker"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Resolve-DefaultProjectRoot
} else {
    $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

Set-Location $ProjectRoot
Write-Host "Project root: $ProjectRoot" -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $ProjectRoot "deploy\\nginx\\generated\\cybersentinel-blocked-ips.conf"
} else {
    if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
        $OutputPath = Join-Path $ProjectRoot $OutputPath
    }
    $outputParent = Split-Path -Parent $OutputPath
    if (-not [string]::IsNullOrWhiteSpace($outputParent) -and (Test-Path $outputParent)) {
        $OutputPath = Join-Path (Resolve-Path $outputParent).Path (Split-Path -Leaf $OutputPath)
    }
}

$pythonCommand = Resolve-PythonCommand
$pythonExe = $pythonCommand[0]
$pythonArgs = @()
if ($pythonCommand.Count -gt 1) {
    $pythonArgs += $pythonCommand[1..($pythonCommand.Count - 1)]
}
$pythonArgs += @(
    (Join-Path $ProjectRoot "deploy\\scripts\\export_edge_blocks.py"),
    "--base-url", $BaseUrl,
    "--token", $Token,
    "--api-prefix", $ApiPrefix,
    "--format", "nginx",
    "--output", $OutputPath
)
Invoke-CheckedCommand -FilePath $pythonExe -Arguments $pythonArgs

$containerId = Get-GatewayContainerId -Service $GatewayService
if (-not $containerId -and ($StartGateway.IsPresent -or $ForceRecreateGateway.IsPresent)) {
    Ensure-GatewayStarted -Service $GatewayService -ForceRecreate:$ForceRecreateGateway
    $containerId = Get-GatewayContainerId -Service $GatewayService
}

if (-not $containerId) {
    Write-Warning "Gateway service '$GatewayService' is not running. Start it with 'docker compose --profile tls up -d $GatewayService' and rerun this script to reload nginx."
    return
}

if ($ForceRecreateGateway.IsPresent -or -not (Test-GatewayHookActive -Service $GatewayService)) {
    Write-Host "Gateway hook is not active yet. Recreating $GatewayService to apply the mounted block file." -ForegroundColor Cyan
    Ensure-GatewayStarted -Service $GatewayService -ForceRecreate
}

if ($NoReload.IsPresent) {
    Write-Host "Edge block export completed. Reload skipped by -NoReload." -ForegroundColor Green
    return
}

Invoke-CheckedCommand -FilePath "docker" -Arguments @("compose", "exec", "-T", $GatewayService, "nginx", "-t")
Invoke-CheckedCommand -FilePath "docker" -Arguments @("compose", "exec", "-T", $GatewayService, "nginx", "-s", "reload")

Write-Host "Edge blocks synced and nginx reloaded." -ForegroundColor Green

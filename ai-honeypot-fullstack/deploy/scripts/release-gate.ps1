param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$RemoteHost,

    [string]$User = "root",
    [int]$Port = 22,
    [string]$SshKey = "",
    [string]$SshPassword = "",
    [string]$SshKeyPassphrase = "",
    [string]$SmokeUser = "admin",
    [string]$SmokePassword = "",
    [string]$RemoteRoot = "/root/ai-honeypot-fullstack",
    [string]$SiteName = "smoke-site",
    [string]$SiteDomain = "smoke.example.com",
    [switch]$SkipLocalChecks,
    [switch]$SkipPreflight,
    [switch]$SkipRemoteDeploy,
    [switch]$SkipSmoke,
    [switch]$Insecure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )
    Write-Host ""
    Write-Host "==> $Name"
    & $Action
}

function Get-PythonExe {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @("python")
    }
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return @("py", "-3")
    }
    throw "Python executable not found (expected 'py' or 'python')."
}

$python = @(Get-PythonExe)

function Invoke-Python {
    param([Parameter(Mandatory = $true)][string[]]$Args)
    if ($python.Length -eq 2) {
        & $python[0] $python[1] @Args
    } else {
        & $python[0] @Args
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed with exit code $LASTEXITCODE."
    }
}

if (-not $SkipLocalChecks.IsPresent) {
    Invoke-Step -Name "Local quality gate (check-all.ps1)" -Action {
        powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-all.ps1")
    }
}

if (-not $SkipPreflight.IsPresent) {
    Invoke-Step -Name "Strict launch preflight" -Action {
        Invoke-Python -Args @(
            (Join-Path $PSScriptRoot "launch_preflight.py"),
            "--strict",
            "--check-url"
        )
    }
}

if (-not $SkipRemoteDeploy.IsPresent) {
    Invoke-Step -Name "Remote redeploy + live verification" -Action {
        if (-not $SshKey -and -not $SshPassword) {
            throw "Provide -SshKey or -SshPassword when remote deploy is enabled."
        }
        if (-not $SkipSmoke.IsPresent -and -not $SmokePassword) {
            throw "Provide -SmokePassword when smoke is enabled."
        }

        if ($SshPassword) {
            $env:REMOTE_DEPLOY_SSH_PASSWORD = $SshPassword
        }
        if ($SmokePassword) {
            $env:REMOTE_DEPLOY_SMOKE_PASSWORD = $SmokePassword
        }

        $args = @(
            (Join-Path $PSScriptRoot "remote_redeploy.py"),
            "--host", $RemoteHost,
            "--port", "$Port",
            "--user", $User,
            "--remote-root", $RemoteRoot,
            "--base-url", $BaseUrl,
            "--smoke-user", $SmokeUser,
            "--site-name", $SiteName,
            "--site-domain", $SiteDomain
        )

        if ($SshKey) {
            $args += @("--ssh-key", $SshKey)
            if ($SshKeyPassphrase) {
                $args += @("--ssh-key-passphrase", $SshKeyPassphrase)
            }
        }

        if ($SkipSmoke.IsPresent) {
            $args += "--skip-smoke"
        }

        if ($Insecure.IsPresent) {
            $args += "--insecure"
        }

        Invoke-Python -Args $args
    }
}

Write-Host ""
Write-Host "Release gate completed successfully."

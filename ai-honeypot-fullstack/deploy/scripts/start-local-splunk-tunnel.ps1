param(
    [string]$ContainerName = "splunk-hec-tunnel",
    [string]$OriginUrl = "https://host.docker.internal:8088",
    [int]$WaitSeconds = 20
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

docker rm -f $ContainerName 2>$null | Out-Null
docker run -d --name $ContainerName cloudflare/cloudflared:latest tunnel --no-autoupdate --url $OriginUrl --no-tls-verify | Out-Null

$deadline = (Get-Date).AddSeconds($WaitSeconds)
$tunnelUrl = $null
while ((Get-Date) -lt $deadline -and -not $tunnelUrl) {
    Start-Sleep -Seconds 2
    $logs = docker logs $ContainerName 2>&1
    $match = [regex]::Match(($logs -join [Environment]::NewLine), 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) {
        $tunnelUrl = $match.Value
    }
}

if (-not $tunnelUrl) {
    throw "Cloudflare quick tunnel URL was not detected. Check: docker logs $ContainerName"
}

Write-Host "Tunnel ready: $tunnelUrl"
Write-Host "Use this HEC URL:"
Write-Host "$tunnelUrl/services/collector/event"

[CmdletBinding()]
param(
    [int]$Port = 8766
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ServerScript = (Join-Path $Root 'serve.cjs')
$PidFile = Join-Path $Root '.observatory-server.pid'

function Get-ObservatoryServers {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -match '(?i)serve\.cjs' -and
            $_.CommandLine -match [regex]::Escape($ServerScript)
        }
}

$existing = @(Get-ObservatoryServers)
if ($existing.Count -gt 0) {
    $ids = ($existing | ForEach-Object ProcessId) -join ', '
    Write-Output "Sphere Observatory is already running (PID $ids). Use npm run stop to shut it down."
    exit 0
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$process = Start-Process -FilePath $node -ArgumentList @($ServerScript, $Port) -WorkingDirectory $Root -WindowStyle Hidden -PassThru
Set-Content -LiteralPath $PidFile -Value $process.Id -NoNewline
Start-Sleep -Milliseconds 250

if ($process.HasExited) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    throw "Sphere Observatory server exited immediately with code $($process.ExitCode). Port $Port may already be in use."
}

Write-Output "Sphere Observatory started at http://127.0.0.1:$Port (PID $($process.Id))."
Write-Output 'Stop it with: npm run stop'

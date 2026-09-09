[CmdletBinding()]
param()

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

$servers = @(Get-ObservatoryServers)
$pidFromFile = 0
if (Test-Path -LiteralPath $PidFile) {
    $pidFromFile = [int](Get-Content -LiteralPath $PidFile -Raw).Trim()
}

$ids = @($servers | ForEach-Object ProcessId)
if ($pidFromFile -gt 0 -and $ids -notcontains $pidFromFile) {
    $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$pidFromFile" -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.CommandLine -match '(?i)serve\.cjs' -and $candidate.CommandLine -match [regex]::Escape($ServerScript)) {
        $ids += $pidFromFile
    }
}
$ids = @($ids | Select-Object -Unique)

if ($ids.Count -eq 0) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    Write-Output 'No managed Sphere Observatory server is running.'
    exit 0
}

foreach ($id in $ids) {
    Stop-Process -Id $id -ErrorAction SilentlyContinue
}

$deadline = (Get-Date).AddSeconds(3)
do {
    Start-Sleep -Milliseconds 150
    $remaining = @(Get-ObservatoryServers | Where-Object { $ids -contains $_.ProcessId })
} while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline)

if ($remaining.Count -gt 0) {
    $remaining | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
Write-Output ("Stopped managed Sphere Observatory server process(es): " + ($ids -join ', ') + '.')

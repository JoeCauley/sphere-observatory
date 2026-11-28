[CmdletBinding()]
param(
    [ValidateRange(1,65535)][int]$Port=8766,
    [string]$Route='/',
    [string]$Register,
    [string]$Profile,
    [switch]$Check
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (!$Route.StartsWith('/') -or $Route.StartsWith('//') -or $Route.Contains('\')) { throw 'Supply a local Observatory route.' }
if ($Register) { $env:SPHERE_INSTALL_STORE=(Resolve-Path -LiteralPath $Register).Path }
$portResult=& (Join-Path $PSScriptRoot 'start-observatory.ps1') -Port $Port -AllowAlternatePort -PortOnly
if (!$portResult) { throw 'The Observatory did not return a serving port.' }
$url='http://127.0.0.1:'+([int]$portResult)+$Route
if($Check){Write-Output $url;return}
if(!$Profile){Start-Process -FilePath $url;Write-Output $url;return}
$exe=@("$env:ProgramFiles\Google\Chrome\Application\chrome.exe","${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
if(!$exe){throw 'An isolated field window requires Chrome or Edge.'}
$profilePath=[IO.Path]::GetFullPath($Profile)
& (Get-Command node.exe -ErrorAction Stop).Source (Join-Path $PSScriptRoot 'open-field-window.cjs') $profilePath $url $exe
if($LASTEXITCODE -ne 0){throw 'The Observatory field window could not open.'}
Write-Output $url

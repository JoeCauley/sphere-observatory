[CmdletBinding()]
param([switch]$Check)
$ErrorActionPreference='Stop'
$checkout=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$trial=[IO.Directory]::GetParent($checkout).FullName
$env:SPHERE_INSTALL_STORE=Join-Path $trial 'installed-biomes.json'
if(!(Test-Path -LiteralPath $env:SPHERE_INSTALL_STORE)){throw 'The private City-Marsh trial register is required.'}
$port=& (Join-Path $checkout 'scripts\start-observatory.ps1') -Port 8812 -AllowAlternatePort -PortOnly
if($LASTEXITCODE -or !$port){throw 'The private Observatory did not start.'}
$origin='http://127.0.0.1:'+([int]$port)
$client=New-Object Net.WebClient
$client.Proxy=$null
try {
    $health=$client.DownloadString($origin+'/api/health') | ConvertFrom-Json
    $module=$client.DownloadString($origin+'/tools/bay0-doorway/trial-page.js')
    if($health.service -ne 'sphere-observatory' -or !$module.Contains('export function lightSchedule')){throw 'The doorway trial did not answer.'}
} finally {$client.Dispose()}
$url=$origin+'/?crossing=city-marsh&doorway=clipped&light=sphere&hold=1'
if($Check){Write-Output $url;return}
$browser=@("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe","${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe","$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
if(!$browser){throw 'Native Chrome was not found on this ALPHA installation.'}
$profile=Join-Path $trial 'doorway-pilot'
Start-Process -FilePath $browser -ArgumentList @(('--user-data-dir="'+$profile+'"'),'--no-first-run','--no-default-browser-check',('"'+$url+'"'))

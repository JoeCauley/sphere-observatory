[CmdletBinding()]
param(
    [ValidateSet('All','Visual','Timing','Crossing','Regression')][string]$Stage='All',
    [string]$OutputDirectory,
    [switch]$Quick
)
$ErrorActionPreference='Stop'
$checkout=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$trial=[IO.Directory]::GetParent($checkout).FullName
$work=[IO.Directory]::GetParent($trial).FullName
$forest=Join-Path $work 'bay-0-forest-walk'
$node=(Get-Command node.exe -ErrorAction Stop).Source
if(!$env:NODE_PATH){$env:NODE_PATH=Join-Path $work 'border-integration-20261124\node_modules'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
if(!$OutputDirectory){$OutputDirectory=Join-Path $trial "evidence\run-$stamp"}
$OutputDirectory=[IO.Path]::GetFullPath($OutputDirectory)
$null=New-Item -ItemType Directory -Path $OutputDirectory -Force
function Invoke-TrialNode([string]$Name,[string]$From,[string[]]$NodeArgs){
    $log=Join-Path $OutputDirectory ($Name+'.log')
    $err=Join-Path $OutputDirectory ($Name+'.stderr.log')
    if((Test-Path -LiteralPath $log) -or (Test-Path -LiteralPath $err)){throw "Use a fresh output path for $Name"}
    $quoted=foreach($arg in $NodeArgs){if($arg.Contains('"')){throw 'Unexpected quote in an argument'};'"'+$arg+'"'}
    Write-Host "Running $Name. Progress is in $log"
    $child=Start-Process -FilePath $node -ArgumentList $quoted -WorkingDirectory $From -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $log -RedirectStandardError $err
    Set-Content -LiteralPath (Join-Path $OutputDirectory ($Name+'.exit')) -Value $child.ExitCode
    if($child.ExitCode -ne 0){Get-Content -LiteralPath $err -Tail 15;throw "$Name failed ($($child.ExitCode))."}
}
if($Stage -ne 'Regression'){
    $name=if($Stage -eq 'All'){'doorway'}else{$Stage.ToLowerInvariant()}
    $mode=if($Stage -eq 'All'){'all'}else{$Stage.ToLowerInvariant()}
    $arguments=@('tools\bay0-doorway\run-trial.cjs',(Join-Path $trial 'installed-biomes.json'),(Join-Path $OutputDirectory $name),('--part='+$mode))
    if($Quick){$arguments+='--quick'}
    Invoke-TrialNode $name $checkout $arguments
    $proof=Get-Content -Raw -LiteralPath (Join-Path $OutputDirectory "$name\trial.json") | ConvertFrom-Json
    if(!$proof.passed -or $proof.errors.Count){throw "$name has incomplete route evidence."}
}
if($Stage -in 'All','Regression'){
    $destination=Join-Path $OutputDirectory 'bay0'
    if(Test-Path -LiteralPath $destination){throw 'Use a fresh regression output folder.'}
    $null=New-Item -ItemType Directory -Path $destination
    $source=Join-Path $forest 'installed-biomes.json'
    $register=Join-Path $destination 'register.json'
    Copy-Item -LiteralPath $source -Destination $register -ErrorAction Stop
    Copy-Item -LiteralPath ($source+'.border-atlas') -Destination ($register+'.border-atlas') -Recurse -ErrorAction Stop
    $env:SPHERE_FIELD_SERVER=Join-Path $checkout 'tests\support\observatory-server.cjs'
    $env:SPHERE_FIELD_STORE=$register
    $env:SPHERE_FIELD_PROFILE=Join-Path $destination 'chrome-profile'
    $phase="doorway-native-$stamp"
    Invoke-TrialNode 'bay0' $forest @('survey-run.cjs',$phase)
    $file=Join-Path $forest "evidence\$phase\survey.json"
    Copy-Item -LiteralPath $file -Destination (Join-Path $destination 'survey.json') -ErrorAction Stop
    $s=Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
    if($s.errors.Count -or $s.samples.Count -ne 3){throw 'Bay 0 did not complete three clean samples.'}
    foreach($sample in $s.samples){if($sample.durationMs -lt 29995 -or $sample.glError -ne 0 -or $sample.contextLost){throw 'Incomplete Bay 0 sample.'}}
    $p95=@($s.samples | ForEach-Object {$_.p95} | Sort-Object)[1]
    Write-Host ('Bay 0 frame p95 {0:N2} ms, budget 20.8 ms.' -f $p95)
    if($p95 -gt 20.8){throw 'Bay 0 exceeded the existing frame-time budget.'}
}
if($Stage -eq 'All' -and !$Quick){
    $proof=Join-Path $OutputDirectory 'doorway\trial.json'
    & $node (Join-Path $PSScriptRoot 'summary.cjs') $proof $proof $proof (Join-Path $OutputDirectory 'bay0\survey.json') (Join-Path $OutputDirectory 'table.md')
    if($LASTEXITCODE -ne 0){throw 'The comparison table did not validate.'}
}
Write-Host "Completed $Stage. Evidence in $OutputDirectory"

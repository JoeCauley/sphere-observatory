[CmdletBinding()]
param(
    [ValidateRange(1,65535)][int]$Port = 8766,
    [switch]$AllowAlternatePort,
    [switch]$PortOnly
)

$ErrorActionPreference = 'Stop'
$env:SPHERE_FIELD_KEYS = '1'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ServerScript = Join-Path $Root 'serve.cjs'
$PidFile = Join-Path $Root '.observatory-server.pid'
$PortFile = Join-Path $Root ".observatory-server-$Port.port"

$RegisterDigest = $null
$Digest = [System.Security.Cryptography.SHA256]::Create()
try {
    if ($env:SPHERE_INSTALL_STORE) {
        $RegisterPath = [IO.Path]::GetFullPath($env:SPHERE_INSTALL_STORE).ToUpperInvariant()
        $RegisterDigest = [BitConverter]::ToString($Digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($RegisterPath))).Replace('-', '').ToLowerInvariant()
    }
    $Checkout = [BitConverter]::ToString($Digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($Root.ToUpperInvariant()))).Replace('-', '').ToLowerInvariant()
} finally { $Digest.Dispose() }

function Get-ReadyServer([int]$Candidate) {
    try {
        $request = [Net.HttpWebRequest]::Create("http://127.0.0.1:$Candidate/api/health")
        $request.Proxy = $null
        $request.Timeout = 350
        $request.ReadWriteTimeout = 350
        $response = $request.GetResponse()
        try {
            $reader = New-Object IO.StreamReader($response.GetResponseStream())
            try { $health = ConvertFrom-Json -InputObject $reader.ReadToEnd() } finally { $reader.Dispose() }
            if ($health.service -eq 'sphere-observatory' -and $health.checkout -eq $Checkout -and $health.fieldKeys -and (!$RegisterDigest -or $health.register -eq $RegisterDigest)) { return $health }
        } finally { $response.Dispose() }
    } catch { return $null }
}

function Get-FreePort([int]$Candidate) {
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Candidate)
    try {
        $probe.Server.ExclusiveAddressUse = $true
        $probe.Start()
        return $probe.LocalEndpoint.Port
    } catch [Net.Sockets.SocketException] {
        if ($_.Exception.SocketErrorCode -notin 'AddressAlreadyInUse','AccessDenied') { throw }
        return 0
    } finally { $probe.Stop() }
}

function Report-Ready([int]$Selected, $Health) {
    Set-Content -LiteralPath $PidFile -Value $Health.pid -NoNewline
    if ($AllowAlternatePort) { Set-Content -LiteralPath $PortFile -Value $Selected -NoNewline }
    if ($PortOnly) { Write-Output $Selected }
    else { Write-Output "Sphere Observatory is ready at http://127.0.0.1:$Selected (PID $($Health.pid))." }
}

# Reuse this checkout on its usual port or its last alternate before creating a process.
$candidates = @($Port)
if ($AllowAlternatePort -and (Test-Path -LiteralPath $PortFile)) {
    $remembered = 0
    if ([int]::TryParse((Get-Content -Raw -LiteralPath $PortFile), [ref]$remembered) -and
        $remembered -ge 1 -and $remembered -le 65535 -and $remembered -ne $Port) { $candidates += $remembered }
}
foreach ($candidate in $candidates) {
    $known = Get-ReadyServer $candidate
    if ($known) { Report-Ready $candidate $known; exit 0 }
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
if ($AllowAlternatePort) {
    $adjacent = 1 + ($Port % 65535)
    if ($adjacent -notin $candidates) { $candidates += $adjacent }
    # Let Windows choose a free port if both fixed ports are occupied.
    $candidates += 0,0
}
foreach ($requested in $candidates) {
    $candidate = Get-FreePort $requested
    if (-not $candidate) {
        $known = Get-ReadyServer $requested
        if ($known) { Report-Ready $requested $known; exit 0 }
        continue
    }
    $process = Start-Process -FilePath $node -ArgumentList @(('"' + $ServerScript + '"'), [string]$candidate) -WorkingDirectory $Root -WindowStyle Hidden -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(6)
    do {
        $known = Get-ReadyServer $candidate
        if ($known) { Report-Ready $candidate $known; exit 0 }
        if ($process.HasExited) { break }
        Start-Sleep -Milliseconds 60
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $process.HasExited -or (Get-FreePort $candidate)) {
        throw "Sphere Observatory did not start on port $candidate."
    }
}
throw "No available Observatory port starting at $Port."

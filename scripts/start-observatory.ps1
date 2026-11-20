[CmdletBinding()]
param(
    [int]$Port = 8766
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ServerScript = (Join-Path $Root 'serve.cjs')
$PidFile = Join-Path $Root '.observatory-server.pid'

$Digest = [System.Security.Cryptography.SHA256]::Create()
try {
    $Checkout = [BitConverter]::ToString($Digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($Root.ToUpperInvariant()))).Replace('-', '').ToLowerInvariant()
} finally { $Digest.Dispose() }
$Address = "http://127.0.0.1:$Port"

function Get-ReadyServer {
    try {
        $request = [Net.HttpWebRequest]::Create("$Address/api/health")
        $request.Proxy = $null
        $request.Timeout = 350
        $response = $request.GetResponse()
        try {
            $reader = New-Object IO.StreamReader($response.GetResponseStream())
            try { $health = ConvertFrom-Json -InputObject $reader.ReadToEnd() } finally { $reader.Dispose() }
            if ($health.service -eq 'sphere-observatory' -and $health.checkout -eq $Checkout) { return $health }
        } finally { $response.Dispose() }
    } catch { return $null }
}

# A saved PID gives an inexpensive hint. The HTTP reply identifies the checkout and the port.
if (Test-Path -LiteralPath $PidFile) {
    $known = Get-ReadyServer
    if ($known) {
        Write-Output "Sphere Observatory is ready at $Address (PID $($known.pid))."
        exit 0
    }
}
$node = (Get-Command node.exe -ErrorAction Stop).Source
$process = Start-Process -FilePath $node -ArgumentList @(('"' + $ServerScript + '"'), [string]$Port) -WorkingDirectory $Root -WindowStyle Hidden -PassThru
$deadline = [DateTime]::UtcNow.AddSeconds(6)
do {
    $known = Get-ReadyServer
    if ($known) {
        Set-Content -LiteralPath $PidFile -Value $known.pid -NoNewline
        Write-Output "Sphere Observatory is ready at $Address (PID $($known.pid))."
        exit 0
    }
    if ($process.HasExited) { break }
    Start-Sleep -Milliseconds 60
} while ([DateTime]::UtcNow -lt $deadline)
throw "Sphere Observatory did not answer at $Address. The port may already belong to another server."

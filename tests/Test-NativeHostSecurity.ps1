param(
    [Parameter(Mandatory = $true)]
    [string] $ExecutablePath
)

$ErrorActionPreference = "Stop"
$exe = (Resolve-Path $ExecutablePath).Path
$localData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
$stateDirectory = Join-Path $localData "Teiletracking"
if (Test-Path $stateDirectory) {
    throw "Test benötigt ein frisches Windows-Benutzerprofil ohne vorhandenes Teiletracking-Verzeichnis."
}
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$configDirectory = $stateDirectory
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
$defaultConfigPath = Join-Path (Split-Path $exe) "appsettings.default.json"
$config = Get-Content -LiteralPath $defaultConfigPath -Raw | ConvertFrom-Json
$config.network.port = $port
$config.network.remoteAccessEnabled = $false
$config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $configDirectory "config.json") -Encoding utf8

$process = $null
$client = [System.Net.Http.HttpClient]::new()
try {
    $process = Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe) -PassThru -WindowStyle Hidden
    $baseUrl = "http://127.0.0.1:$port"
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        if ($process.HasExited) {
            throw "Host-Prozess wurde vor dem Start beendet (Exit-Code $($process.ExitCode))."
        }
        try {
            $status = $client.GetStringAsync("$baseUrl/api/status").GetAwaiter().GetResult() | ConvertFrom-Json
            $ready = $true
            break
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $ready) { throw "Host wurde innerhalb von 20 Sekunden nicht bereit." }

    if ($status.remoteAccessEnabled -ne $false) {
        throw "Remote-Zugriff ist in der Standardkonfiguration nicht deaktiviert."
    }

    $listeners = Get-NetTCPConnection -State Listen -OwningProcess $process.Id -ErrorAction SilentlyContinue
    if (-not $listeners) { throw "Kein Listener des Host-Prozesses gefunden." }
    $nonLoopback = @($listeners | Where-Object {
        $_.LocalAddress -ne "127.0.0.1" -and $_.LocalAddress -ne "::1"
    })
    if ($nonLoopback.Count -gt 0) {
        throw "Host lauscht unerwartet auf einer Nicht-Loopback-Adresse: $($nonLoopback.LocalAddress -join ', ')"
    }

    $request = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Post, "$baseUrl/api/queue")
    $request.Headers.Add("Origin", "https://attacker.example")
    $request.Content = [System.Net.Http.StringContent]::new(
        '{"RecordId":"security-test"}', [System.Text.Encoding]::UTF8, "application/json")
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne 403) {
        throw "Cross-Origin-POST wurde nicht abgewiesen (HTTP $([int]$response.StatusCode))."
    }
    $request.Dispose()
    $response.Dispose()

    $sameOriginRequest = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Post, "$baseUrl/api/queue")
    $sameOriginRequest.Headers.Add("Origin", $baseUrl)
    $sameOriginRequest.Content = [System.Net.Http.StringContent]::new(
        '{"RecordId":"security-test"}', [System.Text.Encoding]::UTF8, "application/json")
    $sameOriginResponse = $client.SendAsync($sameOriginRequest).GetAwaiter().GetResult()
    if ([int]$sameOriginResponse.StatusCode -ne 202) {
        throw "Gleich-originäre Queue-Anfrage funktioniert nicht (HTTP $([int]$sameOriginResponse.StatusCode))."
    }

    Write-Host "Native Host Security smoke test passed."
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $process.WaitForExit(5000) | Out-Null
    }
    $client.Dispose()
    Remove-Item -LiteralPath $stateDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

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

$previousPfxPassword = $env:TEILETRACKING_PFX_PASSWORD
$previousAccessPassword = $env:TEILETRACKING_ACCESS_PASSWORD
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
    foreach ($asset in @("/prototype/vendor/jsQR-1.4.0.js", "/prototype/vendor/jszip-3.10.1.min.js")) {
        $assetResponse = $client.GetAsync("$baseUrl$asset").GetAwaiter().GetResult()
        if ([int]$assetResponse.StatusCode -ne 200) {
            throw "Lokale Browser-Abhängigkeit fehlt im veröffentlichten Host: $asset (HTTP $([int]$assetResponse.StatusCode))."
        }
        $assetResponse.Dispose()
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

    $dbBefore = $client.GetStringAsync("$baseUrl/api/database/tracking").GetAwaiter().GetResult() | ConvertFrom-Json
    if ($dbBefore.revision -ne 0 -or @($dbBefore.records).Count -ne 0) {
        throw "Neue lokale Datenbank startet nicht mit dem erwarteten leeren Ausgangszustand."
    }
    $masterRequest = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Put, "$baseUrl/api/database/master-data")
    $masterRequest.Headers.Add("Origin", $baseUrl)
    $masterRequest.Content = [System.Net.Http.StringContent]::new(
        '{"Derivate":[{"Code":"SYNTHETIC"}],"IStufen":[{"Code":"SYNTHETIC"}],"AktivOverrides":{"Derivate":{},"IStufen":{}}}',
        [System.Text.Encoding]::UTF8, "application/json")
    $masterResponse = $client.SendAsync($masterRequest).GetAwaiter().GetResult()
    if ([int]$masterResponse.StatusCode -ne 200) {
        throw "Stammdaten konnten nicht gespeichert werden (HTTP $([int]$masterResponse.StatusCode))."
    }
    $masterSave = $masterResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($masterSave.revision -ne 1) { throw "Stammdatenänderung erhöhte die Datenbankrevision nicht." }
    $masterRequest.Dispose()
    $masterResponse.Dispose()

    $records = @(
        @{ LocalId = "instance-1"; PartNumber = "TEST-PN"; SerialNumber = "TEST-SN"; AssignmentKey = "same-assignment" },
        @{ LocalId = "instance-2"; PartNumber = "TEST-PN"; SerialNumber = "TEST-SN"; AssignmentKey = "same-assignment" }
    ) | ConvertTo-Json -Compress
    $dbRequest = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Put, "$baseUrl/api/database/tracking")
    $dbRequest.Headers.Add("Origin", $baseUrl)
    $dbRequest.Content = [System.Net.Http.StringContent]::new(
        ('{"revision":1,"records":' + $records + '}'),
        [System.Text.Encoding]::UTF8, "application/json")
    $dbResponse = $client.SendAsync($dbRequest).GetAwaiter().GetResult()
    if ([int]$dbResponse.StatusCode -ne 200) {
        throw "SQLite-Trackingdaten konnten nicht gespeichert werden (HTTP $([int]$dbResponse.StatusCode))."
    }
    $dbSave = $dbResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($dbSave.revision -ne 2 -or $dbSave.saved -ne 2) {
        throw "SQLite-Speichern lieferte eine unerwartete Revision oder Anzahl."
    }
    $dbRequest.Dispose()
    $dbResponse.Dispose()

    $staleRequest = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Put, "$baseUrl/api/database/tracking")
    $staleRequest.Headers.Add("Origin", $baseUrl)
    $staleRequest.Content = [System.Net.Http.StringContent]::new(
        '{"revision":1,"records":[]}', [System.Text.Encoding]::UTF8, "application/json")
    $staleResponse = $client.SendAsync($staleRequest).GetAwaiter().GetResult()
    if ([int]$staleResponse.StatusCode -ne 409) {
        throw "Veraltete Datenbankrevision wurde nicht mit HTTP 409 zurückgewiesen."
    }
    $staleRequest.Dispose()
    $staleResponse.Dispose()

    $backupText = $client.GetStringAsync("$baseUrl/api/database/backup").GetAwaiter().GetResult()
    $backupEnvelope = $backupText | ConvertFrom-Json -AsHashtable
    $previewRequest = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Post, "$baseUrl/api/database/restore/preview")
    $previewRequest.Headers.Add("Origin", $baseUrl)
    $previewRequest.Content = [System.Net.Http.StringContent]::new(
        $backupText, [System.Text.Encoding]::UTF8, "application/json")
    $previewResponse = $client.SendAsync($previewRequest).GetAwaiter().GetResult()
    if ([int]$previewResponse.StatusCode -ne 200) {
        throw "Gültige Datenbanksicherung konnte nicht geprüft werden (HTTP $([int]$previewResponse.StatusCode))."
    }
    $preview = $previewResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($preview.trackingRecords -ne 2 -or $preview.currentTrackingRecords -ne 2 -or $preview.derivate -ne 1 -or $preview.iStufen -ne 1) {
        throw "Sicherungsvorschau meldet unerwartete Datensatzanzahlen."
    }
    $previewRequest.Dispose()
    $previewResponse.Dispose()

    $badBackup = $backupEnvelope.Clone()
    $badBackup["sha256"] = "0000000000000000000000000000000000000000000000000000000000000000"
    $badPreviewRequest = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Post, "$baseUrl/api/database/restore/preview")
    $badPreviewRequest.Headers.Add("Origin", $baseUrl)
    $badPreviewRequest.Content = [System.Net.Http.StringContent]::new(
        ($badBackup | ConvertTo-Json -Depth 20 -Compress),
        [System.Text.Encoding]::UTF8, "application/json")
    $badPreviewResponse = $client.SendAsync($badPreviewRequest).GetAwaiter().GetResult()
    if ([int]$badPreviewResponse.StatusCode -ne 400) {
        throw "Beschädigtes oder manipuliertes Backup wurde nicht abgewiesen."
    }
    $badPreviewRequest.Dispose()
    $badPreviewResponse.Dispose()

    $clearRequest = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Put, "$baseUrl/api/database/tracking")
    $clearRequest.Headers.Add("Origin", $baseUrl)
    $clearRequest.Content = [System.Net.Http.StringContent]::new(
        '{"revision":2,"records":[]}', [System.Text.Encoding]::UTF8, "application/json")
    $clearResponse = $client.SendAsync($clearRequest).GetAwaiter().GetResult()
    if ([int]$clearResponse.StatusCode -ne 200) {
        throw "Testvorbereitung konnte Trackingdaten nicht leeren (HTTP $([int]$clearResponse.StatusCode))."
    }
    $clearRequest.Dispose()
    $clearResponse.Dispose()

    $restoreBody = @{ backup = $backupEnvelope; revision = 3 } | ConvertTo-Json -Depth 20 -Compress
    $restoreRequest = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::Post, "$baseUrl/api/database/restore")
    $restoreRequest.Headers.Add("Origin", $baseUrl)
    $restoreRequest.Content = [System.Net.Http.StringContent]::new(
        $restoreBody, [System.Text.Encoding]::UTF8, "application/json")
    $restoreResponse = $client.SendAsync($restoreRequest).GetAwaiter().GetResult()
    if ([int]$restoreResponse.StatusCode -ne 200) {
        throw "Datenbank konnte aus Sicherung nicht wiederhergestellt werden (HTTP $([int]$restoreResponse.StatusCode))."
    }
    $restored = $restoreResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
    if ($restored.trackingRecords -ne 2 -or $restored.revision -ne 4) {
        throw "Restore lieferte eine unerwartete Datensatzanzahl oder Revision."
    }
    $restoreRequest.Dispose()
    $restoreResponse.Dispose()

    $auditEvents = $client.GetStringAsync("$baseUrl/api/database/audit").GetAwaiter().GetResult() | ConvertFrom-Json
    if (@($auditEvents).Count -lt 4 -or $auditEvents[0].operation -ne "DATABASE_RESTORED") {
        throw "Datenbankänderungen oder Restore wurden nicht im lokalen Verlauf protokolliert."
    }

    Stop-Process -Id $process.Id -Force
    $process.WaitForExit(5000) | Out-Null
    $process = $null

    $config.network.remoteAccessEnabled = $true
    $config.https.enabled = $true
    $config.https.pfxPath = Join-Path $env:TEMP ("missing-teiletracking-cert-" + [guid]::NewGuid().ToString("N") + ".pfx")
    $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $configDirectory "config.json") -Encoding utf8
    $env:TEILETRACKING_PFX_PASSWORD = "test-only-pfx-password"
    $env:TEILETRACKING_ACCESS_PASSWORD = "test-only-access-password-with-more-than-20-characters"
    $process = Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe) -PassThru -WindowStyle Hidden

    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        if ($process.HasExited) {
            throw "Host mit angefordertem Remote-Zugriff wurde vor dem Start beendet (Exit-Code $($process.ExitCode))."
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
    if (-not $ready) { throw "Host mit ungültigem Zertifikat wurde nicht bereit." }
    if ($status.remoteAccessEnabled -ne $false) {
        throw "Remote-Zugriff blieb trotz fehlendem Zertifikat aktiv."
    }
    $persistedDb = $client.GetStringAsync("$baseUrl/api/database/tracking").GetAwaiter().GetResult() | ConvertFrom-Json
    if ($persistedDb.revision -ne 4 -or @($persistedDb.records).Count -ne 2) {
        throw "SQLite-Datenbank blieb nach Host-Neustart nicht erhalten."
    }
    $listeners = Get-NetTCPConnection -State Listen -OwningProcess $process.Id -ErrorAction SilentlyContinue
    $nonLoopback = @($listeners | Where-Object {
        $_.LocalAddress -ne "127.0.0.1" -and $_.LocalAddress -ne "::1"
    })
    if ($nonLoopback.Count -gt 0) {
        throw "Remote-Listener wurde trotz fehlendem Zertifikat geöffnet."
    }

    Write-Host "Native Host Security smoke test passed."
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $process.WaitForExit(5000) | Out-Null
    }
    $client.Dispose()
    $env:TEILETRACKING_PFX_PASSWORD = $previousPfxPassword
    $env:TEILETRACKING_ACCESS_PASSWORD = $previousAccessPassword
    Remove-Item -LiteralPath $stateDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

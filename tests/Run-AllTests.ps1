$ErrorActionPreference = "Stop"

$TestFiles = @(
    "Test-Validation.ps1",
    "Test-MasterData.ps1",
    "Test-LocalSharePoint.ps1",
    "Test-LocalDuplicates.ps1",
    "Test-EndToEndLocal.ps1",
    "Test-MigrationSchema.ps1"
)

$Passed = 0
$Failed = 0
$Results = @()

Write-Host ""
Write-Host "=============================================="
Write-Host " Teiletracking - Lokaler Gesamttest"
Write-Host "=============================================="
Write-Host ""

foreach ($TestFile in $TestFiles) {
    $TestPath = Join-Path $PSScriptRoot $TestFile

    Write-Host "----------------------------------------------"
    Write-Host "Starte: $TestFile"
    Write-Host "----------------------------------------------"

    if (-not (Test-Path $TestPath)) {
        Write-Host "FEHLER: Testdatei wurde nicht gefunden: $TestPath"
        $Failed++

        $Results += [pscustomobject]@{
            Test   = $TestFile
            Status = "FAILED"
            Fehler = "Datei nicht gefunden"
        }

        Write-Host ""
        continue
    }

    try {
        & pwsh -NoProfile -File $TestPath

        if ($LASTEXITCODE -ne 0) {
            throw "Testprozess wurde mit Exit-Code $LASTEXITCODE beendet"
        }

        $Passed++

        $Results += [pscustomobject]@{
            Test   = $TestFile
            Status = "PASSED"
            Fehler = ""
        }

        Write-Host ""
        Write-Host "ERGEBNIS: $TestFile -> PASSED"
    }
    catch {
        $Failed++

        $message = $_.Exception.Message

        $Results += [pscustomobject]@{
            Test   = $TestFile
            Status = "FAILED"
            Fehler = $message
        }

        Write-Host ""
        Write-Host "ERGEBNIS: $TestFile -> FAILED"
        Write-Host "Fehler: $message"
    }

    Write-Host ""
}

Write-Host ""
Write-Host "=============================================="
Write-Host " Testzusammenfassung"
Write-Host "=============================================="

$Results |
    Format-Table `
        Test,
        Status,
        Fehler `
        -AutoSize

Write-Host "Bestanden: $Passed"
Write-Host "Fehlgeschlagen: $Failed"
Write-Host "Gesamt: $($TestFiles.Count)"
Write-Host ""

if ($Failed -gt 0) {
    Write-Host "=============================================="
    Write-Host "GESAMTTEST FEHLGESCHLAGEN"
    Write-Host "=============================================="

    exit 1
}

Write-Host "=============================================="
Write-Host "TEST OK: Alle lokalen Tests bestanden"
Write-Host "=============================================="

exit 0

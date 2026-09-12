$ErrorActionPreference = "Stop"

. "$PSScriptRoot/../src/Validation.ps1"
. "$PSScriptRoot/Mock-PnP.ps1"

Reset-MockPnP

$errors = @(
    Test-TrackingMasterData `
        -Derivat "G70" `
        -IStufe "S15A-26-03-500"
)

if ($errors.Count -ne 0) {
    throw "Aktive Stammdaten wurden abgelehnt: $($errors -join '; ')"
}

$errors = @(
    Test-TrackingMasterData `
        -Derivat "G30" `
        -IStufe "S15A-26-03-500"
)

if ($errors -notmatch "inaktiv") {
    throw "Inaktives Derivat G30 wurde nicht erkannt"
}

$errors = @(
    Test-TrackingMasterData `
        -Derivat "G99" `
        -IStufe "S15A-26-03-500"
)

if ($errors -notmatch "unbekannt") {
    throw "Unbekanntes Derivat G99 wurde nicht erkannt"
}

$errors = @(
    Test-TrackingMasterData `
        -Derivat "G70" `
        -IStufe "S15A-25-11-400"
)

if ($errors -notmatch "inaktiv") {
    throw "Inaktive I-Stufe wurde nicht erkannt"
}

$errors = @(
    Test-TrackingMasterData `
        -Derivat "G70" `
        -IStufe "S15A-99-99-999"
)

if ($errors -notmatch "unbekannt") {
    throw "Unbekannte I-Stufe wurde nicht erkannt"
}

Write-Host "TEST OK: Lokale SharePoint-Stammdatensimulation bestanden"

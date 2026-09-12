$ErrorActionPreference = "Stop"
. "$PSScriptRoot/../src/Validation.ps1"

function Get-PnPListItem {
    param(
        [string]$List,
        [string]$Query
    )

    if ($Query -match "UNKNOWN") {
        return @()
    }

    if ($Query -match "INACTIVE") {
        return @{
            Aktiv = $false
        }
    }

    return @{
        Aktiv = $true
    }
}

# 1. Beide Stammdaten aktiv
$errors = @(Test-TrackingMasterData -Derivat "G70" -IStufe "ACTIVE")
if ($errors.Count -ne 0) {
    throw "Aktive Stammdaten wurden fälschlich abgelehnt: $errors"
}

# 2. Derivat unbekannt
$errors = @(Test-TrackingMasterData -Derivat "UNKNOWN" -IStufe "ACTIVE")
if ($errors -notmatch "Derivat 'UNKNOWN' ist unbekannt") {
    throw "Unbekanntes Derivat wurde nicht erkannt"
}

# 3. Derivat inaktiv
$errors = @(Test-TrackingMasterData -Derivat "INACTIVE" -IStufe "ACTIVE")
if ($errors -notmatch "Derivat 'INACTIVE' ist inaktiv") {
    throw "Inaktives Derivat wurde nicht erkannt"
}

# 4. I-Stufe unbekannt
$errors = @(Test-TrackingMasterData -Derivat "G70" -IStufe "UNKNOWN")
if ($errors -notmatch "I-Stufe 'UNKNOWN' ist unbekannt") {
    throw "Unbekannte I-Stufe wurde nicht erkannt"
}

# 5. I-Stufe inaktiv
$errors = @(Test-TrackingMasterData -Derivat "G70" -IStufe "INACTIVE")
if ($errors -notmatch "I-Stufe 'INACTIVE' ist inaktiv") {
    throw "Inaktive I-Stufe wurde nicht erkannt"
}

Write-Host "TEST OK: Stammdatenvalidierung bestanden"

# 6. Vollständiger Import mit aktiven Stammdaten
$result = Invoke-TrackingImportValidated `
    -LabelString "PN=123;SN=456;HW=1;SW=1" `
    -QRString "PN=123;SN=456;HW=1;SW=1" `
    -Derivat "G70" `
    -IStufe "ACTIVE" `
    -DryRun

if (-not $result) {
    throw "Validierter Import hat kein Ergebnis geliefert"
}

# 7. Vollständiger Import mit unbekanntem Derivat muss abbrechen
$failed = $false
try {
    Invoke-TrackingImportValidated `
        -LabelString "PN=123;SN=456;HW=1;SW=1" `
        -QRString "PN=123;SN=456;HW=1;SW=1" `
        -Derivat "UNKNOWN" `
        -IStufe "ACTIVE"
}
catch {
    $failed = $_.Exception.Message -match "Derivat 'UNKNOWN' ist unbekannt"
}

if (-not $failed) {
    throw "Unbekanntes Derivat wurde im Gesamtimport nicht blockiert"
}

Write-Host "TEST OK: Gesamtimport mit Stammdatenvalidierung bestanden"

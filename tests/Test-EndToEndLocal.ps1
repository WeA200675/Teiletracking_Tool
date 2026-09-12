$ErrorActionPreference = "Stop"

. "$PSScriptRoot/../src/Validation.ps1"
. "$PSScriptRoot/Mock-PnP.ps1"

Reset-MockPnP

Write-Host "Testdaten geladen:"
Write-Host "  Derivate:      $($script:MockMasterData.Derivate.Count)"
Write-Host "  I-Stufen:      $($script:MockMasterData.IStufen.Count)"
Write-Host "  Steuergeräte:  $($script:MockTrackingData.Steuergeraete.Count)"
Write-Host ""


# ============================================================
# TEST 1
# Neues Teil -> OK
# ============================================================

Invoke-TrackingImportValidated `
    -LabelString "PN=7654321;SN=SN002;HW=HW1;SW=SW1" `
    -QRString "PN=7654321;SN=SN002;HW=HW1;SW=SW1" `
    -Derivat "G70" `
    -IStufe "S15A-26-03-500" |
    Out-Null

$savedItems = @(Get-MockSavedItems)

if ($savedItems.Count -ne 1) {
    throw "TEST 1: Erwartet 1 gespeicherten Datensatz, vorhanden: $($savedItems.Count)"
}

$saved = $savedItems[-1]

if ($saved["ValidationStatus"] -ne "OK") {
    throw "TEST 1: Erwartet OK, erhalten: $($saved['ValidationStatus'])"
}

Write-Host "TEST 1 OK: Neues Teil -> OK"


# ============================================================
# TEST 2
# Gleiches physisches Teil in anderem Derivat
# ============================================================

Invoke-TrackingImportValidated `
    -LabelString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -QRString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -Derivat "G60" `
    -IStufe "S15A-26-07-500" |
    Out-Null

$savedItems = @(Get-MockSavedItems)

if ($savedItems.Count -ne 2) {
    throw "TEST 2: Erwartet 2 gespeicherte Datensätze, vorhanden: $($savedItems.Count)"
}

$saved = $savedItems[-1]

if ($saved["ValidationStatus"] -ne "DOUBLE_DERIVATIVE") {
    throw "TEST 2: Erwartet DOUBLE_DERIVATIVE, erhalten: $($saved['ValidationStatus'])"
}

if (-not [bool]$saved["DoppelDerivat"]) {
    throw "TEST 2: DoppelDerivat wurde nicht auf true gesetzt"
}

Write-Host "TEST 2 OK: Gleiches physisches Teil in anderem Derivat -> DOUBLE_DERIVATIVE"


# ============================================================
# TEST 3
# Exaktes Duplikat aus den Ausgangsdaten
# ============================================================

$countBefore = @(Get-MockSavedItems).Count

Invoke-TrackingImportValidated `
    -LabelString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -QRString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -Derivat "G70" `
    -IStufe "S15A-26-03-500" |
    Out-Null

$countAfter = @(Get-MockSavedItems).Count

if ($countAfter -ne $countBefore) {
    throw "TEST 3: DUPLICATE wurde trotzdem gespeichert"
}

Write-Host "TEST 3 OK: Exaktes Duplikat aus Ausgangsdaten wurde nicht gespeichert"


# ============================================================
# TEST 4
# Label / QR Abweichung
# ============================================================

Invoke-TrackingImportValidated `
    -LabelString "PN=9999999;SN=SN999;HW=HW1;SW=SW1" `
    -QRString "PN=8888888;SN=SN999;HW=HW1;SW=SW1" `
    -Derivat "G70" `
    -IStufe "S15A-26-03-500" |
    Out-Null

$savedItems = @(Get-MockSavedItems)

if ($savedItems.Count -ne 3) {
    throw "TEST 4: Erwartet 3 gespeicherte Datensätze, vorhanden: $($savedItems.Count)"
}

$saved = $savedItems[-1]

if ($saved["ValidationStatus"] -ne "LABEL_QR_MISMATCH") {
    throw "TEST 4: Erwartet LABEL_QR_MISMATCH, erhalten: $($saved['ValidationStatus'])"
}

Write-Host "TEST 4 OK: Label / QR Abweichung -> LABEL_QR_MISMATCH"


# ============================================================
# TEST 5
# Während des Testlaufs gespeichertes Teil erneut importieren
# ============================================================

$countBefore = @(Get-MockSavedItems).Count

Invoke-TrackingImportValidated `
    -LabelString "PN=7654321;SN=SN002;HW=HW1;SW=SW1" `
    -QRString "PN=7654321;SN=SN002;HW=HW1;SW=SW1" `
    -Derivat "G70" `
    -IStufe "S15A-26-03-500" |
    Out-Null

$countAfter = @(Get-MockSavedItems).Count

if ($countAfter -ne $countBefore) {
    throw "TEST 5: Bereits gespeichertes Teil wurde erneut gespeichert"
}

if ($countAfter -ne 3) {
    throw "TEST 5: Erwartet weiterhin 3 gespeicherte Datensätze, vorhanden: $countAfter"
}

Write-Host "TEST 5 OK: Neu gespeichertes Teil wird beim zweiten Import als DUPLICATE blockiert"


# ============================================================
# TEST 6
# Unbekanntes Derivat muss Import blockieren
# ============================================================

$countBefore = @(Get-MockSavedItems).Count
$errorCaught = $false

try {
    Invoke-TrackingImportValidated `
        -LabelString "PN=6000001;SN=SN601;HW=HW1;SW=SW1" `
        -QRString "PN=6000001;SN=SN601;HW=HW1;SW=SW1" `
        -Derivat "G99" `
        -IStufe "S15A-26-03-500" |
        Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "Derivat 'G99' ist unbekannt") {
        throw "TEST 6: Falsche Fehlermeldung: $($_.Exception.Message)"
    }
}

if (-not $errorCaught) {
    throw "TEST 6: Unbekanntes Derivat G99 wurde nicht blockiert"
}

$countAfter = @(Get-MockSavedItems).Count

if ($countAfter -ne $countBefore) {
    throw "TEST 6: Trotz unbekanntem Derivat wurde ein Datensatz gespeichert"
}

Write-Host "TEST 6 OK: Unbekanntes Derivat wird blockiert"


# ============================================================
# TEST 7
# Inaktives Derivat muss Import blockieren
# ============================================================

$countBefore = @(Get-MockSavedItems).Count
$errorCaught = $false

try {
    Invoke-TrackingImportValidated `
        -LabelString "PN=7000001;SN=SN701;HW=HW1;SW=SW1" `
        -QRString "PN=7000001;SN=SN701;HW=HW1;SW=SW1" `
        -Derivat "G30" `
        -IStufe "S15A-26-03-500" |
        Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "Derivat 'G30' ist inaktiv") {
        throw "TEST 7: Falsche Fehlermeldung: $($_.Exception.Message)"
    }
}

if (-not $errorCaught) {
    throw "TEST 7: Inaktives Derivat G30 wurde nicht blockiert"
}

$countAfter = @(Get-MockSavedItems).Count

if ($countAfter -ne $countBefore) {
    throw "TEST 7: Trotz inaktivem Derivat wurde ein Datensatz gespeichert"
}

Write-Host "TEST 7 OK: Inaktives Derivat wird blockiert"


# ============================================================
# TEST 8
# Unbekannte I-Stufe muss Import blockieren
# ============================================================

$countBefore = @(Get-MockSavedItems).Count
$errorCaught = $false

try {
    Invoke-TrackingImportValidated `
        -LabelString "PN=8000001;SN=SN801;HW=HW1;SW=SW1" `
        -QRString "PN=8000001;SN=SN801;HW=HW1;SW=SW1" `
        -Derivat "G70" `
        -IStufe "S15A-99-99-999" |
        Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "I-Stufe 'S15A-99-99-999' ist unbekannt") {
        throw "TEST 8: Falsche Fehlermeldung: $($_.Exception.Message)"
    }
}

if (-not $errorCaught) {
    throw "TEST 8: Unbekannte I-Stufe wurde nicht blockiert"
}

$countAfter = @(Get-MockSavedItems).Count

if ($countAfter -ne $countBefore) {
    throw "TEST 8: Trotz unbekannter I-Stufe wurde ein Datensatz gespeichert"
}

Write-Host "TEST 8 OK: Unbekannte I-Stufe wird blockiert"


# ============================================================
# TEST 9
# Inaktive I-Stufe muss Import blockieren
# ============================================================

$countBefore = @(Get-MockSavedItems).Count
$errorCaught = $false

try {
    Invoke-TrackingImportValidated `
        -LabelString "PN=9000001;SN=SN901;HW=HW1;SW=SW1" `
        -QRString "PN=9000001;SN=SN901;HW=HW1;SW=SW1" `
        -Derivat "G70" `
        -IStufe "S15A-25-11-400" |
        Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "I-Stufe 'S15A-25-11-400' ist inaktiv") {
        throw "TEST 9: Falsche Fehlermeldung: $($_.Exception.Message)"
    }
}

if (-not $errorCaught) {
    throw "TEST 9: Inaktive I-Stufe wurde nicht blockiert"
}

$countAfter = @(Get-MockSavedItems).Count

if ($countAfter -ne $countBefore) {
    throw "TEST 9: Trotz inaktiver I-Stufe wurde ein Datensatz gespeichert"
}

Write-Host "TEST 9 OK: Inaktive I-Stufe wird blockiert"


# ============================================================
# TEST 10
# Doppelderivat + Label/QR-Abweichung gleichzeitig
#
# Zusätzlich wird geprüft, dass die ursprünglichen Werte von
# Label und QR getrennt im gespeicherten Datensatz erhalten
# bleiben.
#
# Ausgangslage:
# 1234567|SN001 existiert bereits in G70.
#
# Jetzt:
# - dasselbe Label-Teil wird G60 zugeordnet
# - QR-PartNumber weicht vom Label ab
#
# Erwartung:
# - ValidationStatus = LABEL_QR_MISMATCH
# - DoppelDerivat = true
# - LabelPartNumber = 1234567
# - QRPartNumber = 1234568
# - LabelSerialNumber = SN001
# - QRSerialNumber = SN001
#
# DeviceKey und AssignmentKey basieren weiterhin bewusst
# auf den Label-Daten.
# ============================================================

$countBefore = @(Get-MockSavedItems).Count

Invoke-TrackingImportValidated `
    -LabelString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -QRString "PN=1234568;SN=SN001;HW=HW1;SW=SW1" `
    -Derivat "G60" `
    -IStufe "S15A-26-03-500" |
    Out-Null

$savedItems = @(Get-MockSavedItems)
$countAfter = $savedItems.Count

if ($countAfter -ne ($countBefore + 1)) {
    throw "TEST 10: Erwartet einen zusätzlich gespeicherten Datensatz. Vorher: $countBefore, nachher: $countAfter"
}

$saved = $savedItems[-1]

if ($saved["ValidationStatus"] -ne "LABEL_QR_MISMATCH") {
    throw "TEST 10: Erwartet LABEL_QR_MISMATCH, erhalten: $($saved['ValidationStatus'])"
}

if (-not [bool]$saved["DoppelDerivat"]) {
    throw "TEST 10: DoppelDerivat wurde trotz bekanntem DeviceKey nicht auf true gesetzt"
}

if ($saved["LabelPartNumber"] -ne "1234567") {
    throw "TEST 10: Falsche LabelPartNumber: $($saved['LabelPartNumber'])"
}

if ($saved["QRPartNumber"] -ne "1234568") {
    throw "TEST 10: Falsche QRPartNumber: $($saved['QRPartNumber'])"
}

if ($saved["LabelSerialNumber"] -ne "SN001") {
    throw "TEST 10: Falsche LabelSerialNumber: $($saved['LabelSerialNumber'])"
}

if ($saved["QRSerialNumber"] -ne "SN001") {
    throw "TEST 10: Falsche QRSerialNumber: $($saved['QRSerialNumber'])"
}

if ($saved["DeviceKey"] -ne "1234567|SN001") {
    throw "TEST 10: Falscher DeviceKey: $($saved['DeviceKey'])"
}

if ($saved["AssignmentKey"] -ne "1234567|SN001|G60|S15A-26-03-500") {
    throw "TEST 10: Falscher AssignmentKey: $($saved['AssignmentKey'])"
}

Write-Host "TEST 10 OK: Label/QR-Rohdaten getrennt gespeichert, Mismatch priorisiert und DoppelDerivat erhalten"


# ============================================================
# Ergebnis
# ============================================================

$finalCount = @(Get-MockSavedItems).Count

if ($finalCount -ne 4) {
    throw "Gesamttest: Erwartet exakt 4 gespeicherte Datensätze, vorhanden: $finalCount"
}

Write-Host ""
Write-Host "=============================================="
Write-Host "TEST OK: Lokaler End-to-End-Test bestanden"
Write-Host "=============================================="
Write-Host "Lokal neu gespeicherte Datensätze: $finalCount"

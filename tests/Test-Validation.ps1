$ErrorActionPreference = "Stop"

. "$PSScriptRoot/../src/Validation.ps1"


# ============================================================
# TEST 1
# Normaler Datensatz -> OK
# ============================================================

$r1 = New-TrackingRecord `
    -LabelString "PN=123;SN=ABC;HW=01;SW=02" `
    -QRString "PN=123;SN=ABC;HW=01;SW=02" `
    -Derivat "G20" `
    -IStufe "26-07" `
    -DuplicateStatus "NEW"

if ($r1.ValidationStatus -ne "OK") {
    throw "TEST 1: OK-Test fehlgeschlagen"
}

Write-Host "TEST 1 OK: Normaler Datensatz -> OK"


# ============================================================
# TEST 2
# Echte Label/QR-Abweichung
# ============================================================

$r2 = New-TrackingRecord `
    -LabelString "PN=123;SN=ABC;HW=01;SW=02" `
    -QRString "PN=123;SN=ABC;HW=01;SW=03" `
    -Derivat "G20" `
    -IStufe "26-07" `
    -DuplicateStatus "NEW"

if ($r2.ValidationStatus -ne "LABEL_QR_MISMATCH") {
    throw "TEST 2: Mismatch-Test fehlgeschlagen"
}

Write-Host "TEST 2 OK: Echte Label/QR-Abweichung erkannt"


# ============================================================
# TEST 3
# Doppelderivat
# ============================================================

$r3 = New-TrackingRecord `
    -LabelString "PN=123;SN=ABC;HW=01;SW=02" `
    -QRString "PN=123;SN=ABC;HW=01;SW=02" `
    -Derivat "G21" `
    -IStufe "26-07" `
    -DuplicateStatus "DOUBLE_DERIVATIVE"

if ($r3.ValidationStatus -ne "DOUBLE_DERIVATIVE") {
    throw "TEST 3: DOUBLE_DERIVATIVE wurde nicht gesetzt"
}

if (-not $r3.DoppelDerivat) {
    throw "TEST 3: DoppelDerivat wurde nicht auf true gesetzt"
}

Write-Host "TEST 3 OK: Doppelderivat erkannt"


# ============================================================
# TEST 4
# Exaktes Duplikat
# ============================================================

$r4 = New-TrackingRecord `
    -LabelString "PN=123;SN=ABC;HW=01;SW=02" `
    -QRString "PN=123;SN=ABC;HW=01;SW=02" `
    -Derivat "G20" `
    -IStufe "26-07" `
    -DuplicateStatus "DUPLICATE"

if ($r4.ValidationStatus -ne "DUPLICATE") {
    throw "TEST 4: Duplikat-Test fehlgeschlagen"
}

Write-Host "TEST 4 OK: Exaktes Duplikat erkannt"


# ============================================================
# TEST 5
# Get-NormalizedText
# ============================================================

$normalized = Get-NormalizedText "  sn001  "

if ($normalized -ne "SN001") {
    throw "TEST 5: Normalisierung fehlgeschlagen. Erhalten: '$normalized'"
}

Write-Host "TEST 5 OK: Leerzeichen und Groß-/Kleinschreibung normalisiert"


# ============================================================
# TEST 6
# Tracking-String normalisieren
# ============================================================

$parsed = ConvertFrom-TrackingString `
    " pn = 1234567 ; sn = sn001 ; hw = hw-01 ; sw = sw-a "

if ($parsed.PartNumber -ne "1234567") {
    throw "TEST 6: PartNumber falsch normalisiert"
}

if ($parsed.SerialNumber -ne "SN001") {
    throw "TEST 6: SerialNumber falsch normalisiert"
}

if ($parsed.Hardware -ne "HW-01") {
    throw "TEST 6: Hardware falsch normalisiert"
}

if ($parsed.Software -ne "SW-A") {
    throw "TEST 6: Software falsch normalisiert"
}

Write-Host "TEST 6 OK: Tracking-String vollständig normalisiert"


# ============================================================
# TEST 7
# DeviceKey stabil
# ============================================================

$key1 = Get-DeviceKey `
    -PartNumber "1234567" `
    -SerialNumber "SN001"

$key2 = Get-DeviceKey `
    -PartNumber " 1234567 " `
    -SerialNumber " sn001 "

if ($key1 -ne $key2) {
    throw "TEST 7: DeviceKeys unterscheiden sich"
}

if ($key1 -ne "1234567|SN001") {
    throw "TEST 7: Unerwarteter DeviceKey: '$key1'"
}

Write-Host "TEST 7 OK: DeviceKey ist normalisierungsstabil"


# ============================================================
# TEST 8
# AssignmentKey stabil
# ============================================================

$assignment1 = Get-AssignmentKey `
    -PartNumber "1234567" `
    -SerialNumber "SN001" `
    -Derivat "G70" `
    -IStufe "S15A-26-03-500"

$assignment2 = Get-AssignmentKey `
    -PartNumber " 1234567 " `
    -SerialNumber " sn001 " `
    -Derivat " g70 " `
    -IStufe " s15a-26-03-500 "

if ($assignment1 -ne $assignment2) {
    throw "TEST 8: AssignmentKeys unterscheiden sich"
}

if ($assignment1 -ne "1234567|SN001|G70|S15A-26-03-500") {
    throw "TEST 8: Unerwarteter AssignmentKey"
}

Write-Host "TEST 8 OK: AssignmentKey ist normalisierungsstabil"


# ============================================================
# TEST 9
# Schreibweisenunterschiede sind kein Mismatch
# ============================================================

$r9 = New-TrackingRecord `
    -LabelString "PN=1234567;SN=sn001;HW=hw1;SW=sw1" `
    -QRString " pn = 1234567 ; sn = SN001 ; hw = HW1 ; sw = SW1 " `
    -Derivat " g70 " `
    -IStufe " s15a-26-03-500 " `
    -DuplicateStatus "new"

if ($r9.ValidationStatus -ne "OK") {
    throw "TEST 9: Schreibweisen wurden fälschlich als Mismatch erkannt"
}

if ($r9.PartNumber -ne "1234567") {
    throw "TEST 9: PartNumber wurde nicht normalisiert"
}

if ($r9.SerialNumber -ne "SN001") {
    throw "TEST 9: SerialNumber wurde nicht normalisiert"
}

if ($r9.Derivat -ne "G70") {
    throw "TEST 9: Derivat wurde nicht normalisiert"
}

if ($r9.IStufe -ne "S15A-26-03-500") {
    throw "TEST 9: I-Stufe wurde nicht normalisiert"
}

if ($r9.DeviceKey -ne "1234567|SN001") {
    throw "TEST 9: DeviceKey falsch"
}

if ($r9.AssignmentKey -ne "1234567|SN001|G70|S15A-26-03-500") {
    throw "TEST 9: AssignmentKey falsch"
}

Write-Host "TEST 9 OK: Schreibweisenunterschiede erzeugen keinen falschen Mismatch"


# ============================================================
# TEST 10
# Get-DuplicateStatus normalisiert Schlüssel
# ============================================================

$duplicateStatus = Get-DuplicateStatus `
    -ExistingDeviceKey "1234567|SN001" `
    -ExistingAssignmentKey "1234567|SN001|G70|S15A-26-03-500" `
    -NewDeviceKey " 1234567|sn001 " `
    -NewAssignmentKey " 1234567|sn001|g70|s15a-26-03-500 "

if ($duplicateStatus -ne "DUPLICATE") {
    throw "TEST 10: Normalisiertes Duplikat wurde nicht erkannt"
}

Write-Host "TEST 10 OK: Duplikaterkennung ist normalisierungsstabil"


# ============================================================
# TEST 11
# Pflichtfelder
# ============================================================

$errorCaught = $false

try {
    Invoke-TrackingImportValidated `
        -LabelString "PN=;SN=;HW=04;SW=12" `
        -QRString "PN=;SN=;HW=04;SW=12" `
        -Derivat "" `
        -IStufe "" `
        -DryRun |
        Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "PartNumber fehlt") {
        throw "TEST 11: Fehlende Label-PartNumber wurde nicht gemeldet"
    }

    if ($_.Exception.Message -notmatch "SerialNumber fehlt") {
        throw "TEST 11: Fehlende Label-SerialNumber wurde nicht gemeldet"
    }

    if ($_.Exception.Message -notmatch "QR PartNumber fehlt") {
        throw "TEST 11: Fehlende QR-PartNumber wurde nicht gemeldet"
    }

    if ($_.Exception.Message -notmatch "QR SerialNumber fehlt") {
        throw "TEST 11: Fehlende QR-SerialNumber wurde nicht gemeldet"
    }

    if ($_.Exception.Message -notmatch "Derivat fehlt") {
        throw "TEST 11: Fehlendes Derivat wurde nicht gemeldet"
    }

    if ($_.Exception.Message -notmatch "I-Stufe fehlt") {
        throw "TEST 11: Fehlende I-Stufe wurde nicht gemeldet"
    }
}

if (-not $errorCaught) {
    throw "TEST 11: Pflichtfeldvalidierung hat keinen Fehler ausgelöst"
}

Write-Host "TEST 11 OK: Pflichtfeldvalidierung blockiert ungültige Eingaben"


# ============================================================
# TEST 12
# Leerer Tracking-String
# ============================================================

$errorCaught = $false

try {
    ConvertFrom-TrackingString "" | Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "Tracking-String ist leer") {
        throw "TEST 12: Falsche Fehlermeldung: $($_.Exception.Message)"
    }
}

if (-not $errorCaught) {
    throw "TEST 12: Leerer Tracking-String wurde akzeptiert"
}

Write-Host "TEST 12 OK: Leerer Tracking-String wird blockiert"


# ============================================================
# TEST 13
# Segment ohne Gleichheitszeichen
# ============================================================

$errorCaught = $false

try {
    ConvertFrom-TrackingString `
        "PN=123;SN=ABC;UNGUELTIG" |
        Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "Segment ohne '='") {
        throw "TEST 13: Falsche Fehlermeldung: $($_.Exception.Message)"
    }
}

if (-not $errorCaught) {
    throw "TEST 13: Segment ohne '=' wurde akzeptiert"
}

Write-Host "TEST 13 OK: Segment ohne '=' wird blockiert"


# ============================================================
# TEST 14
# Unbekannter Schlüssel
# ============================================================

$errorCaught = $false

try {
    ConvertFrom-TrackingString `
        "PN=123;SN=ABC;XYZ=4711" |
        Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "Unbekannter Tracking-Schlüssel: 'XYZ'") {
        throw "TEST 14: Falsche Fehlermeldung: $($_.Exception.Message)"
    }
}

if (-not $errorCaught) {
    throw "TEST 14: Unbekannter Schlüssel wurde akzeptiert"
}

Write-Host "TEST 14 OK: Unbekannte Schlüssel werden blockiert"


# ============================================================
# TEST 15
# Doppelter Schlüssel
# ============================================================

$errorCaught = $false

try {
    ConvertFrom-TrackingString `
        "PN=123;SN=ABC;PN=456" |
        Out-Null
}
catch {
    $errorCaught = $true

    if ($_.Exception.Message -notmatch "Tracking-Schlüssel 'PN' ist mehrfach vorhanden") {
        throw "TEST 15: Falsche Fehlermeldung: $($_.Exception.Message)"
    }
}

if (-not $errorCaught) {
    throw "TEST 15: Doppelter Schlüssel wurde akzeptiert"
}

Write-Host "TEST 15 OK: Doppelte Schlüssel werden blockiert"


# ============================================================
# TEST 16
# Schlüssel-Reihenfolge ist beliebig
# ============================================================

$parsed16 = ConvertFrom-TrackingString `
    "SW=SW1;HW=HW1;SN=SN001;PN=1234567"

if ($parsed16.PartNumber -ne "1234567") {
    throw "TEST 16: PartNumber falsch"
}

if ($parsed16.SerialNumber -ne "SN001") {
    throw "TEST 16: SerialNumber falsch"
}

if ($parsed16.Hardware -ne "HW1") {
    throw "TEST 16: Hardware falsch"
}

if ($parsed16.Software -ne "SW1") {
    throw "TEST 16: Software falsch"
}

Write-Host "TEST 16 OK: Reihenfolge der Schlüssel ist beliebig"


# ============================================================
# TEST 17
# HW und SW dürfen fehlen
# ============================================================

$parsed17 = ConvertFrom-TrackingString `
    "PN=1234567;SN=SN001"

if ($parsed17.PartNumber -ne "1234567") {
    throw "TEST 17: PartNumber falsch"
}

if ($parsed17.SerialNumber -ne "SN001") {
    throw "TEST 17: SerialNumber falsch"
}

if ($parsed17.Hardware -ne "") {
    throw "TEST 17: Fehlendes HW wurde nicht leer zurückgegeben"
}

if ($parsed17.Software -ne "") {
    throw "TEST 17: Fehlendes SW wurde nicht leer zurückgegeben"
}

Write-Host "TEST 17 OK: HW und SW bleiben optional"


# ============================================================
# TEST 18
# Abschließendes Semikolon wird toleriert
# ============================================================

$parsed18 = ConvertFrom-TrackingString `
    "PN=1234567;SN=SN001;HW=HW1;SW=SW1;"

if ($parsed18.PartNumber -ne "1234567") {
    throw "TEST 18: Tracking-String mit abschließendem Semikolon fehlgeschlagen"
}

Write-Host "TEST 18 OK: Abschließendes Semikolon wird toleriert"


# ============================================================
# Ergebnis
# ============================================================

Write-Host ""
Write-Host "=============================================="
Write-Host "TEST OK: Validierung, Normalisierung und Parser"
Write-Host "         vollständig bestanden"
Write-Host "=============================================="

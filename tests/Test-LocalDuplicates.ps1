$ErrorActionPreference = "Stop"

. "$PSScriptRoot/../src/Validation.ps1"
. "$PSScriptRoot/Mock-PnP.ps1"

Reset-MockPnP


# ============================================================
# TEST 1
# Exakte Zuordnung -> DUPLICATE
# ============================================================

$duplicate = Get-SharePointDuplicateStatus `
    -AssignmentKey "1234567|SN001|G70|S15A-26-03-500" `
    -DeviceKey "1234567|SN001"

if ($duplicate -ne "DUPLICATE") {
    throw "TEST 1: Erwartet DUPLICATE, erhalten: $duplicate"
}

Write-Host "TEST 1 OK: Exakte Zuordnung -> DUPLICATE"


# ============================================================
# TEST 2
# Gleiches physisches Teil, andere Zuordnung
# -> DOUBLE_DERIVATIVE
# ============================================================

$double = Get-SharePointDuplicateStatus `
    -AssignmentKey "1234567|SN001|G60|S15A-26-07-500" `
    -DeviceKey "1234567|SN001"

if ($double -ne "DOUBLE_DERIVATIVE") {
    throw "TEST 2: Erwartet DOUBLE_DERIVATIVE, erhalten: $double"
}

Write-Host "TEST 2 OK: Gleiches Teil, andere Zuordnung -> DOUBLE_DERIVATIVE"


# ============================================================
# TEST 3
# Vollständig neues physisches Teil -> NEW
# ============================================================

$new = Get-SharePointDuplicateStatus `
    -AssignmentKey "7654321|SN002|G70|S15A-26-03-500" `
    -DeviceKey "7654321|SN002"

if ($new -ne "NEW") {
    throw "TEST 3: Erwartet NEW, erhalten: $new"
}

Write-Host "TEST 3 OK: Neues Teil -> NEW"


# ============================================================
# TEST 4
# XML-/CAML-Escaping
#
# Kritische XML-Zeichen müssen korrekt maskiert werden:
# &  -> &amp;
# <  -> &lt;
# >  -> &gt;
# "  -> &quot;
# '  -> &apos;
# ============================================================

$rawValue = "A&B<C>D`"E'F"
$escapedValue = ConvertTo-CamlValue $rawValue

$expectedEscapedValue = "A&amp;B&lt;C&gt;D&quot;E&apos;F"

if ($escapedValue -ne $expectedEscapedValue) {
    throw "TEST 4: CAML-Escaping falsch. Erwartet '$expectedEscapedValue', erhalten '$escapedValue'"
}

Write-Host "TEST 4 OK: XML-/CAML-Sonderzeichen werden korrekt escaped"


# ============================================================
# TEST 5
# DUPLICATE mit Sonderzeichen
#
# Wir legen einen Datensatz mit XML-kritischen Zeichen lokal im
# Mock ab. Get-SharePointDuplicateStatus muss den AssignmentKey
# für CAML escapen und der Mock muss ihn wieder korrekt aus XML
# auslesen können.
# ============================================================

$specialDeviceKey = "12&34|SN<01>"
$specialAssignmentKey = "12&34|SN<01>|G`"70|S'15A"

Add-PnPListItem `
    -List "Steuergeraete" `
    -Values @{
        Title         = $specialAssignmentKey
        DeviceKey     = $specialDeviceKey
        AssignmentKey = $specialAssignmentKey
    } |
    Out-Null

$specialDuplicate = Get-SharePointDuplicateStatus `
    -AssignmentKey $specialAssignmentKey `
    -DeviceKey $specialDeviceKey

if ($specialDuplicate -ne "DUPLICATE") {
    throw "TEST 5: Sonderzeichen-Datensatz wurde nicht als DUPLICATE erkannt. Erhalten: $specialDuplicate"
}

Write-Host "TEST 5 OK: DUPLICATE funktioniert auch mit XML-Sonderzeichen"


# ============================================================
# TEST 6
# DOUBLE_DERIVATIVE mit Sonderzeichen
#
# Derselbe DeviceKey wird verwendet, aber der AssignmentKey
# unterscheidet sich.
# ============================================================

$specialOtherAssignmentKey = "12&34|SN<01>|G60|S15A-26-07-500"

$specialDouble = Get-SharePointDuplicateStatus `
    -AssignmentKey $specialOtherAssignmentKey `
    -DeviceKey $specialDeviceKey

if ($specialDouble -ne "DOUBLE_DERIVATIVE") {
    throw "TEST 6: Sonderzeichen-DeviceKey wurde nicht als DOUBLE_DERIVATIVE erkannt. Erhalten: $specialDouble"
}

Write-Host "TEST 6 OK: DOUBLE_DERIVATIVE funktioniert auch mit XML-Sonderzeichen"


# ============================================================
# TEST 7
# Sonderzeichen dürfen nicht zu einem falschen Treffer führen
# ============================================================

$specialNewDeviceKey = "99&99|SN<99>"
$specialNewAssignmentKey = "99&99|SN<99>|G70|S15A-26-03-500"

$specialNew = Get-SharePointDuplicateStatus `
    -AssignmentKey $specialNewAssignmentKey `
    -DeviceKey $specialNewDeviceKey

if ($specialNew -ne "NEW") {
    throw "TEST 7: Neuer Sonderzeichen-Datensatz wurde fälschlich als $specialNew erkannt"
}

Write-Host "TEST 7 OK: Neuer Sonderzeichen-Datensatz -> NEW"


# ============================================================
# Ergebnis
# ============================================================

Write-Host ""
Write-Host "=============================================="
Write-Host "TEST OK: DUPLICATE / DOUBLE_DERIVATIVE / NEW"
Write-Host "         inklusive CAML-Sonderzeichen"
Write-Host "=============================================="

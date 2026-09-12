$ErrorActionPreference = "Stop"

. "$PSScriptRoot/../src/Validation.ps1"

# ------------------------------------------------------------
# Testdaten laden
# ------------------------------------------------------------

$MasterDataPath = Join-Path $PSScriptRoot "data/MasterData.json"
$TrackingDataPath = Join-Path $PSScriptRoot "data/TrackingData.json"

if (-not (Test-Path $MasterDataPath)) {
    throw "MasterData.json wurde nicht gefunden: $MasterDataPath"
}

if (-not (Test-Path $TrackingDataPath)) {
    throw "TrackingData.json wurde nicht gefunden: $TrackingDataPath"
}

$script:MasterData = Get-Content $MasterDataPath -Raw | ConvertFrom-Json
$script:TrackingData = Get-Content $TrackingDataPath -Raw | ConvertFrom-Json
$script:SavedItems = @()

if (-not $script:MasterData.Derivate) {
    throw "MasterData.json enthält keine Derivate"
}

if (-not $script:MasterData.IStufen) {
    throw "MasterData.json enthält keine I-Stufen"
}

if (-not $script:TrackingData.Steuergeraete) {
    throw "TrackingData.json enthält keine Steuergeräte"
}

Write-Host "Testdaten geladen:"
Write-Host "  Derivate:      $($script:MasterData.Derivate.Count)"
Write-Host "  I-Stufen:      $($script:MasterData.IStufen.Count)"
Write-Host "  Steuergeräte:  $($script:TrackingData.Steuergeraete.Count)"
Write-Host ""


# ------------------------------------------------------------
# CAML-Wert auslesen
# ------------------------------------------------------------

function Get-CamlValue {
    param(
        [Parameter(Mandatory)]
        [string]$Query,

        [Parameter(Mandatory)]
        [string]$FieldName
    )

    try {
        [xml]$xml = $Query
    }
    catch {
        throw "Mock konnte CAML nicht als XML lesen: $Query"
    }

    $fieldNodes = @($xml.SelectNodes("//FieldRef"))

    foreach ($fieldNode in $fieldNodes) {

        if ($fieldNode.Name -ne $FieldName) {
            continue
        }

        $parent = $fieldNode.ParentNode

        if ($null -eq $parent) {
            continue
        }

        $valueNode = $parent.SelectSingleNode("Value")

        if ($null -ne $valueNode) {
            return [string]$valueNode.InnerText
        }
    }

    return $null
}


# ------------------------------------------------------------
# Simuliertes Get-PnPListItem
# ------------------------------------------------------------

function Get-PnPListItem {
    param(
        [Parameter(Mandatory)]
        [string]$List,

        [Parameter(Mandatory)]
        [string]$Query
    )

    switch ($List) {

        "Derivate" {

            $value = Get-CamlValue `
                -Query $Query `
                -FieldName "DerivatCode"

            if ($null -eq $value) {
                throw "Mock: DerivatCode konnte aus CAML nicht gelesen werden: $Query"
            }

            $item = @(
                $script:MasterData.Derivate |
                    Where-Object {
                        $_.DerivatCode -eq $value
                    } |
                    Select-Object -First 1
            )

            if ($item.Count -eq 0) {
                return @()
            }

            return @{
                DerivatCode = $item[0].DerivatCode
                Aktiv       = [bool]$item[0].Aktiv
            }
        }


        "IStufen" {

            $value = Get-CamlValue `
                -Query $Query `
                -FieldName "IStufeCode"

            if ($null -eq $value) {
                throw "Mock: IStufeCode konnte aus CAML nicht gelesen werden: $Query"
            }

            $item = @(
                $script:MasterData.IStufen |
                    Where-Object {
                        $_.IStufeCode -eq $value
                    } |
                    Select-Object -First 1
            )

            if ($item.Count -eq 0) {
                return @()
            }

            return @{
                IStufeCode = $item[0].IStufeCode
                Aktiv      = [bool]$item[0].Aktiv
            }
        }


        "Steuergeraete" {

            $assignmentKey = Get-CamlValue `
                -Query $Query `
                -FieldName "AssignmentKey"

            if ($null -ne $assignmentKey) {

                $allItems = @(
                    $script:TrackingData.Steuergeraete
                    $script:SavedItems
                )

                $item = @(
                    $allItems |
                        Where-Object {
                            $_.AssignmentKey -eq $assignmentKey
                        } |
                        Select-Object -First 1
                )

                if ($item.Count -eq 0) {
                    return @()
                }

                return @{
                    AssignmentKey = $item[0].AssignmentKey
                    DeviceKey     = $item[0].DeviceKey
                }
            }


            $deviceKey = Get-CamlValue `
                -Query $Query `
                -FieldName "DeviceKey"

            if ($null -ne $deviceKey) {

                $allItems = @(
                    $script:TrackingData.Steuergeraete
                    $script:SavedItems
                )

                $item = @(
                    $allItems |
                        Where-Object {
                            $_.DeviceKey -eq $deviceKey
                        } |
                        Select-Object -First 1
                )

                if ($item.Count -eq 0) {
                    return @()
                }

                return @{
                    AssignmentKey = $item[0].AssignmentKey
                    DeviceKey     = $item[0].DeviceKey
                }
            }

            throw "Mock: Weder AssignmentKey noch DeviceKey im CAML gefunden: $Query"
        }


        default {
            throw "Mock kennt die Liste '$List' nicht"
        }
    }
}


# ------------------------------------------------------------
# Simuliertes Add-PnPListItem
# ------------------------------------------------------------

function Add-PnPListItem {
    param(
        [Parameter(Mandatory)]
        [string]$List,

        [Parameter(Mandatory)]
        [hashtable]$Values
    )

    if ($List -ne "Steuergeraete") {
        throw "Mock kann nicht in Liste '$List' schreiben"
    }

    $script:SavedItems += $Values

    return [pscustomobject]@{
        Id = $script:SavedItems.Count
    }
}


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

if ($script:SavedItems.Count -ne 1) {
    throw "TEST 1: Erwartet 1 gespeicherten Datensatz, vorhanden: $($script:SavedItems.Count)"
}

$saved = $script:SavedItems[-1]

if ($saved["ValidationStatus"] -ne "OK") {
    throw "TEST 1: Erwartet OK, erhalten: $($saved['ValidationStatus'])"
}

Write-Host "TEST 1 OK: Neues Teil -> OK"


# ============================================================
# TEST 2
# Bekanntes physisches Teil in anderem Derivat
# -> DOUBLE_DERIVATIVE
# ============================================================

Invoke-TrackingImportValidated `
    -LabelString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -QRString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -Derivat "G60" `
    -IStufe "S15A-26-07-500" |
    Out-Null

if ($script:SavedItems.Count -ne 2) {
    throw "TEST 2: Erwartet 2 gespeicherte Datensätze, vorhanden: $($script:SavedItems.Count)"
}

$saved = $script:SavedItems[-1]

if ($saved["ValidationStatus"] -ne "DOUBLE_DERIVATIVE") {
    throw "TEST 2: Erwartet DOUBLE_DERIVATIVE, erhalten: $($saved['ValidationStatus'])"
}

if (-not [bool]$saved["DoppelDerivat"]) {
    throw "TEST 2: DoppelDerivat wurde nicht auf true gesetzt"
}

Write-Host "TEST 2 OK: Gleiches physisches Teil in anderem Derivat -> DOUBLE_DERIVATIVE"


# ============================================================
# TEST 3
# Exaktes Duplikat darf nicht gespeichert werden
# ============================================================

$countBefore = $script:SavedItems.Count

Invoke-TrackingImportValidated `
    -LabelString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -QRString "PN=1234567;SN=SN001;HW=HW1;SW=SW1" `
    -Derivat "G70" `
    -IStufe "S15A-26-03-500" |
    Out-Null

$countAfter = $script:SavedItems.Count

if ($countAfter -ne $countBefore) {
    throw "TEST 3: DUPLICATE wurde trotzdem gespeichert"
}

Write-Host "TEST 3 OK: Exaktes Duplikat wurde nicht gespeichert"


# ============================================================
# TEST 4
# Label / QR unterschiedlich
# -> LABEL_QR_MISMATCH
# ============================================================

Invoke-TrackingImportValidated `
    -LabelString "PN=9999999;SN=SN999;HW=HW1;SW=SW1" `
    -QRString "PN=8888888;SN=SN999;HW=HW1;SW=SW1" `
    -Derivat "G70" `
    -IStufe "S15A-26-03-500" |
    Out-Null

if ($script:SavedItems.Count -ne 3) {
    throw "TEST 4: Erwartet 3 gespeicherte Datensätze, vorhanden: $($script:SavedItems.Count)"
}

$saved = $script:SavedItems[-1]

if ($saved["ValidationStatus"] -ne "LABEL_QR_MISMATCH") {
    throw "TEST 4: Erwartet LABEL_QR_MISMATCH, erhalten: $($saved['ValidationStatus'])"
}

Write-Host "TEST 4 OK: Label / QR Abweichung -> LABEL_QR_MISMATCH"


# ============================================================
# Ergebnis
# ============================================================

Write-Host ""
Write-Host "=============================================="
Write-Host "TEST OK: Lokaler End-to-End-Test bestanden"
Write-Host "=============================================="
Write-Host "Lokal neu gespeicherte Datensätze: $($script:SavedItems.Count)"

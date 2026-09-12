$ErrorActionPreference = "Stop"

# ============================================================
# Lokale SharePoint-/PnP-Simulation
# ============================================================

$MasterDataPath = Join-Path $PSScriptRoot "data/MasterData.json"
$TrackingDataPath = Join-Path $PSScriptRoot "data/TrackingData.json"

if (-not (Test-Path $MasterDataPath)) {
    throw "MasterData.json wurde nicht gefunden: $MasterDataPath"
}

if (-not (Test-Path $TrackingDataPath)) {
    throw "TrackingData.json wurde nicht gefunden: $TrackingDataPath"
}

$script:MockMasterData = Get-Content $MasterDataPath -Raw | ConvertFrom-Json
$script:MockTrackingData = Get-Content $TrackingDataPath -Raw | ConvertFrom-Json
$script:MockSavedItems = @()


# ============================================================
# Mock zurücksetzen
# ============================================================

function Reset-MockPnP {
    $script:MockMasterData = Get-Content $MasterDataPath -Raw | ConvertFrom-Json
    $script:MockTrackingData = Get-Content $TrackingDataPath -Raw | ConvertFrom-Json
    $script:MockSavedItems = @()
}


# ============================================================
# Gespeicherte Mock-Datensätze zurückgeben
# ============================================================

function Get-MockSavedItems {
    return @($script:MockSavedItems)
}


# ============================================================
# CAML-Wert auslesen
# ============================================================

function Get-MockCamlValue {
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


# ============================================================
# Get-PnPListItem simulieren
# ============================================================

function Get-PnPListItem {
    param(
        [Parameter(Mandatory)]
        [string]$List,

        [Parameter(Mandatory)]
        [string]$Query
    )

    switch ($List) {

        "Derivate" {
            $value = Get-MockCamlValue `
                -Query $Query `
                -FieldName "DerivatCode"

            if ($null -eq $value) {
                throw "Mock: DerivatCode konnte aus CAML nicht gelesen werden: $Query"
            }

            $item = @(
                $script:MockMasterData.Derivate |
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
            $value = Get-MockCamlValue `
                -Query $Query `
                -FieldName "IStufeCode"

            if ($null -eq $value) {
                throw "Mock: IStufeCode konnte aus CAML nicht gelesen werden: $Query"
            }

            $item = @(
                $script:MockMasterData.IStufen |
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
            $assignmentKey = Get-MockCamlValue `
                -Query $Query `
                -FieldName "AssignmentKey"

            if ($null -ne $assignmentKey) {
                $allItems = @(
                    $script:MockTrackingData.Steuergeraete
                    $script:MockSavedItems
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


            $deviceKey = Get-MockCamlValue `
                -Query $Query `
                -FieldName "DeviceKey"

            if ($null -ne $deviceKey) {
                $allItems = @(
                    $script:MockTrackingData.Steuergeraete
                    $script:MockSavedItems
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


# ============================================================
# Add-PnPListItem simulieren
# ============================================================

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

    $script:MockSavedItems += $Values

    return [pscustomobject]@{
        Id = $script:MockSavedItems.Count
    }
}

$ErrorActionPreference = "Stop"

. "$PSScriptRoot/../src/Validation.ps1"

$TrackingDataPath = "$PSScriptRoot/data/TrackingData.json"
$script:TrackingData = Get-Content $TrackingDataPath -Raw | ConvertFrom-Json

function Get-PnPListItem {
    param(
        [string]$List,
        [string]$Query
    )

    if ($List -ne "Steuergeraete") {
        return @()
    }

    if ($Query -match "FieldRef Name='AssignmentKey'") {
        foreach ($item in $script:TrackingData.Steuergeraete) {
            if ($Query -match [regex]::Escape($item.AssignmentKey)) {
                return @{
                    AssignmentKey = $item.AssignmentKey
                    DeviceKey     = $item.DeviceKey
                }
            }
        }

        return @()
    }

    if ($Query -match "FieldRef Name='DeviceKey'") {
        foreach ($item in $script:TrackingData.Steuergeraete) {
            if ($Query -match [regex]::Escape($item.DeviceKey)) {
                return @{
                    AssignmentKey = $item.AssignmentKey
                    DeviceKey     = $item.DeviceKey
                }
            }
        }

        return @()
    }

    return @()
}

$duplicate = Get-SharePointDuplicateStatus `
    -AssignmentKey "1234567|SN001|G70|S15A-26-03-500" `
    -DeviceKey "1234567|SN001"

if ($duplicate -ne "DUPLICATE") {
    throw "Erwartet DUPLICATE, erhalten: $duplicate"
}

$double = Get-SharePointDuplicateStatus `
    -AssignmentKey "1234567|SN001|G60|S15A-26-07-500" `
    -DeviceKey "1234567|SN001"

if ($double -ne "DOUBLE_DERIVATIVE") {
    throw "Erwartet DOUBLE_DERIVATIVE, erhalten: $double"
}

$new = Get-SharePointDuplicateStatus `
    -AssignmentKey "7654321|SN002|G70|S15A-26-03-500" `
    -DeviceKey "7654321|SN002"

if ($new -ne "NEW") {
    throw "Erwartet NEW, erhalten: $new"
}

Write-Host "TEST OK: DUPLICATE / DOUBLE_DERIVATIVE / NEW korrekt erkannt"

param(
    [string]$ConfigPath = (
        Join-Path $PSScriptRoot "../../config/settings.example.json"
    ),

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"


function Get-JsonFile {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    return Get-Content `
        -Path (Resolve-Path $Path) `
        -Raw |
        ConvertFrom-Json
}


function Get-ConfiguredListName {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Config,

        [Parameter(Mandatory)]
        [string]$LogicalName,

        [Parameter(Mandatory)]
        [string]$DefaultName
    )

    if (
        $null -ne $Config.Lists -and
        $null -ne $Config.Lists.$LogicalName -and
        -not [string]::IsNullOrWhiteSpace(
            [string]$Config.Lists.$LogicalName
        )
    ) {
        return [string]$Config.Lists.$LogicalName
    }

    return $DefaultName
}


function Get-FieldXml {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Field
    )

    $required =
        if ([bool]$Field.Required) {
            "TRUE"
        }
        else {
            "FALSE"
        }

    $displayName =
        [System.Security.SecurityElement]::Escape(
            [string]$Field.DisplayName
        )

    $internalName =
        [System.Security.SecurityElement]::Escape(
            [string]$Field.InternalName
        )

    $fieldType =
        switch ([string]$Field.Type) {
            "Text" {
                "Text"
                break
            }

            "Boolean" {
                "Boolean"
                break
            }

            default {
                throw (
                    "Nicht unterstützter Feldtyp: " +
                    [string]$Field.Type
                )
            }
        }

    return (
        "<Field " +
        "Type='$fieldType' " +
        "Name='$internalName' " +
        "StaticName='$internalName' " +
        "DisplayName='$displayName' " +
        "Required='$required' />"
    )
}


function Ensure-List {
    param(
        [Parameter(Mandatory)]
        [string]$Title,

        [string]$Description = "",

        [switch]$DryRun
    )

    if ($DryRun) {
        Write-Host (
            "[DRY-RUN] Liste sicherstellen: " +
            $Title
        )
        return
    }

    $existing =
        Get-PnPList `
            -Identity $Title `
            -ErrorAction SilentlyContinue

    if ($null -eq $existing) {
        Add-PnPList `
            -Title $Title `
            -Template GenericList `
            -OnQuickLaunch:$false |
            Out-Null

        Write-Host "Erstellt: $Title"
    }
    else {
        Write-Host "Vorhanden: $Title"
    }

    if (
        -not [string]::IsNullOrWhiteSpace(
            $Description
        )
    ) {
        Set-PnPList `
            -Identity $Title `
            -Description $Description |
            Out-Null
    }
}


function Ensure-Field {
    param(
        [Parameter(Mandatory)]
        [string]$ListTitle,

        [Parameter(Mandatory)]
        [pscustomobject]$Field,

        [switch]$DryRun
    )

    if ($DryRun) {
        Write-Host (
            "[DRY-RUN] Feld sicherstellen: " +
            "$ListTitle -> $($Field.InternalName) [$($Field.Type)]"
        )
        return
    }

    $existing =
        Get-PnPField `
            -List $ListTitle `
            -Identity $Field.InternalName `
            -ErrorAction SilentlyContinue

    if ($null -ne $existing) {
        Write-Host (
            "Feld vorhanden: " +
            "$ListTitle -> $($Field.InternalName)"
        )
        return
    }

    Add-PnPFieldFromXml `
        -List $ListTitle `
        -FieldXml (
            Get-FieldXml `
                -Field $Field
        ) |
        Out-Null

    Write-Host (
        "Feld erstellt: " +
        "$ListTitle -> $($Field.InternalName)"
    )
}


function Ensure-Rules {
    param(
        [Parameter(Mandatory)]
        [string]$ListTitle,

        [Parameter(Mandatory)]
        [pscustomobject]$Rules,

        [switch]$DryRun
    )

    foreach ($fieldName in @($Rules.Indexes)) {
        if ($DryRun) {
            Write-Host (
                "[DRY-RUN] Index sicherstellen: " +
                "$ListTitle -> $fieldName"
            )
            continue
        }

        Set-PnPField `
            -List $ListTitle `
            -Identity $fieldName `
            -Values @{
                Indexed = $true
            } |
            Out-Null
    }

    foreach ($fieldName in @($Rules.Unique)) {
        if ($DryRun) {
            Write-Host (
                "[DRY-RUN] Eindeutigkeit sicherstellen: " +
                "$ListTitle -> $fieldName"
            )
            continue
        }

        Set-PnPField `
            -List $ListTitle `
            -Identity $fieldName `
            -Values @{
                Indexed             = $true
                EnforceUniqueValues = $true
            } |
            Out-Null
    }
}


function Install-MasterList {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Config,

        [Parameter(Mandatory)]
        [string]$LogicalName,

        [Parameter(Mandatory)]
        [string]$SchemaPath,

        [Parameter(Mandatory)]
        [string]$RulesPath,

        [switch]$DryRun
    )

    $schema =
        Get-JsonFile `
            -Path $SchemaPath

    $rules =
        Get-JsonFile `
            -Path $RulesPath

    $title =
        Get-ConfiguredListName `
            -Config $Config `
            -LogicalName $LogicalName `
            -DefaultName ([string]$schema.Title)

    Ensure-List `
        -Title $title `
        -Description ([string]$schema.Description) `
        -DryRun:$DryRun

    foreach ($field in @($schema.Fields)) {
        Ensure-Field `
            -ListTitle $title `
            -Field $field `
            -DryRun:$DryRun
    }

    Ensure-Rules `
        -ListTitle $title `
        -Rules $rules `
        -DryRun:$DryRun
}


$config =
    Get-JsonFile `
        -Path $ConfigPath

$listFolder =
    Join-Path `
        $PSScriptRoot `
        "../lists"


if (-not $DryRun) {
    try {
        Get-PnPConnection `
            -ErrorAction Stop |
            Out-Null
    }
    catch {
        throw (
            "Keine aktive PnP-Verbindung vorhanden. " +
            "Für die lokale Prüfung bitte -DryRun verwenden."
        )
    }
}


Write-Host ""
Write-Host "=============================================="
Write-Host " Teiletracking - Zusatz-Stammdaten"
Write-Host "=============================================="
Write-Host ""


foreach (
    $definition in @(
        @{
            LogicalName = "ATS"
            Schema      = "ATS.json"
            Rules       = "ATS.rules.json"
        },
        @{
            LogicalName = "YNummern"
            Schema      = "YNummern.json"
            Rules       = "YNummern.rules.json"
        },
        @{
            LogicalName = "Statuswerte"
            Schema      = "Statuswerte.json"
            Rules       = "Statuswerte.rules.json"
        }
    )
) {
    Install-MasterList `
        -Config $config `
        -LogicalName $definition.LogicalName `
        -SchemaPath (
            Join-Path `
                $listFolder `
                $definition.Schema
        ) `
        -RulesPath (
            Join-Path `
                $listFolder `
                $definition.Rules
        ) `
        -DryRun:$DryRun
}


Write-Host ""

if ($DryRun) {
    Write-Host "DRY-RUN OK: Keine SharePoint-Aenderung ausgefuehrt"
}
else {
    Write-Host "OK: ATS, Y-Nummern und Statuswerte sind provisioniert"
}

Write-Host ""

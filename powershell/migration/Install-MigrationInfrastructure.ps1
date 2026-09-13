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

    $resolvedPath = Resolve-Path $Path

    return Get-Content `
        -Path $resolvedPath `
        -Raw |
        ConvertFrom-Json
}


function Get-ConfiguredName {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Config,

        [Parameter(Mandatory)]
        [ValidateSet(
            "List",
            "Library"
        )]
        [string]$Kind,

        [Parameter(Mandatory)]
        [string]$LogicalName,

        [Parameter(Mandatory)]
        [string]$DefaultName
    )

    if ($Kind -eq "List") {
        if (
            $null -ne $Config.Lists -and
            $null -ne $Config.Lists.$LogicalName -and
            -not [string]::IsNullOrWhiteSpace(
                [string]$Config.Lists.$LogicalName
            )
        ) {
            return [string]$Config.Lists.$LogicalName
        }
    }

    if ($Kind -eq "Library") {
        if (
            $null -ne $Config.Libraries -and
            $null -ne $Config.Libraries.$LogicalName -and
            -not [string]::IsNullOrWhiteSpace(
                [string]$Config.Libraries.$LogicalName
            )
        ) {
            return [string]$Config.Libraries.$LogicalName
        }
    }

    return $DefaultName
}


function ConvertTo-PnPFieldType {
    param(
        [Parameter(Mandatory)]
        [string]$Type
    )

    switch ($Type) {
        "Text" {
            return "Text"
        }

        "Note" {
            return "Note"
        }

        "Boolean" {
            return "Boolean"
        }

        "Choice" {
            return "Choice"
        }

        "DateTime" {
            return "DateTime"
        }

        "Number" {
            return "Number"
        }

        default {
            throw "Nicht unterstützter Feldtyp: $Type"
        }
    }
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
        ConvertTo-PnPFieldType `
            -Type ([string]$Field.Type)

    if ($fieldType -eq "Choice") {
        $choiceXml =
            @(
                $Field.Choices |
                    ForEach-Object {
                        $escapedChoice =
                            [System.Security.SecurityElement]::Escape(
                                [string]$_
                            )

                        "<CHOICE>$escapedChoice</CHOICE>"
                    }
            ) -join ""

        return (
            "<Field " +
            "Type='Choice' " +
            "Name='$internalName' " +
            "StaticName='$internalName' " +
            "DisplayName='$displayName' " +
            "Required='$required'>" +
            "<CHOICES>$choiceXml</CHOICES>" +
            "</Field>"
        )
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


function Ensure-PnPList {
    param(
        [Parameter(Mandatory)]
        [string]$Title,

        [string]$Description = "",

        [ValidateSet(
            "GenericList",
            "DocumentLibrary"
        )]
        [string]$Template = "GenericList",

        [switch]$DryRun
    )

    if ($DryRun) {
        Write-Host (
            "[DRY-RUN] Liste/Bibliothek sicherstellen: " +
            "$Title ($Template)"
        )

        return
    }

    $existing =
        Get-PnPList `
            -Identity $Title `
            -ErrorAction SilentlyContinue

    if ($null -ne $existing) {
        Write-Host "Vorhanden: $Title"
        return
    }

    Add-PnPList `
        -Title $Title `
        -Template $Template `
        -OnQuickLaunch:$false |
        Out-Null

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

    Write-Host "Erstellt: $Title"
}


function Ensure-PnPField {
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
            "$ListTitle -> $($Field.InternalName) " +
            "[$($Field.Type)]"
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

    $fieldXml =
        Get-FieldXml `
            -Field $Field

    Add-PnPFieldFromXml `
        -List $ListTitle `
        -FieldXml $fieldXml |
        Out-Null

    Write-Host (
        "Feld erstellt: " +
        "$ListTitle -> $($Field.InternalName)"
    )
}


function Ensure-PnPFieldRules {
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


function Install-Schema {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Schema,

        [Parameter(Mandatory)]
        [pscustomobject]$Rules,

        [Parameter(Mandatory)]
        [string]$TargetTitle,

        [ValidateSet(
            "GenericList",
            "DocumentLibrary"
        )]
        [string]$Template,

        [switch]$DryRun
    )

    Ensure-PnPList `
        -Title $TargetTitle `
        -Description ([string]$Schema.Description) `
        -Template $Template `
        -DryRun:$DryRun

    foreach ($field in @($Schema.Fields)) {
        Ensure-PnPField `
            -ListTitle $TargetTitle `
            -Field $field `
            -DryRun:$DryRun
    }

    Ensure-PnPFieldRules `
        -ListTitle $TargetTitle `
        -Rules $Rules `
        -DryRun:$DryRun
}


$Config =
    Get-JsonFile `
        -Path $ConfigPath

$ListFolder =
    Join-Path $PSScriptRoot "../lists"

$LibraryFolder =
    Join-Path $PSScriptRoot "../libraries"

$SteuergeraeteSchema =
    Get-JsonFile `
        -Path (
            Join-Path $ListFolder "Steuergeraete.json"
        )

$SteuergeraeteRules =
    Get-JsonFile `
        -Path (
            Join-Path $ListFolder "Steuergeraete.rules.json"
        )

$ImportBatchesSchema =
    Get-JsonFile `
        -Path (
            Join-Path $ListFolder "ImportBatches.json"
        )

$ImportBatchesRules =
    Get-JsonFile `
        -Path (
            Join-Path $ListFolder "ImportBatches.rules.json"
        )

$ArchiveSchema =
    Get-JsonFile `
        -Path (
            Join-Path $LibraryFolder "TrackingImportArchiv.json"
        )

$ArchiveRules =
    Get-JsonFile `
        -Path (
            Join-Path $LibraryFolder "TrackingImportArchiv.rules.json"
        )


$SteuergeraeteTitle =
    Get-ConfiguredName `
        -Config $Config `
        -Kind "List" `
        -LogicalName "Steuergeraete" `
        -DefaultName ([string]$SteuergeraeteSchema.Title)

$ImportBatchesTitle =
    Get-ConfiguredName `
        -Config $Config `
        -Kind "List" `
        -LogicalName "ImportBatches" `
        -DefaultName ([string]$ImportBatchesSchema.Title)

$ArchiveTitle =
    Get-ConfiguredName `
        -Config $Config `
        -Kind "Library" `
        -LogicalName "TrackingImportArchiv" `
        -DefaultName ([string]$ArchiveSchema.Title)


Write-Host ""
Write-Host "=============================================="
Write-Host " Teiletracking - Migrationsinfrastruktur"
Write-Host "=============================================="
Write-Host ""
Write-Host "Steuergeraete:" $SteuergeraeteTitle
Write-Host "ImportBatches:" $ImportBatchesTitle
Write-Host "Archiv:" $ArchiveTitle
Write-Host ""


if (-not $DryRun) {
    try {
        Get-PnPConnection `
            -ErrorAction Stop |
            Out-Null
    }
    catch {
        throw (
            "Keine aktive PnP-Verbindung vorhanden. " +
            "Für den aktuellen lokalen Stand bitte -DryRun verwenden. " +
            "Eine echte Verbindung wird erst später auf dem Import-PC eingerichtet."
        )
    }
}


Install-Schema `
    -Schema $SteuergeraeteSchema `
    -Rules $SteuergeraeteRules `
    -TargetTitle $SteuergeraeteTitle `
    -Template "GenericList" `
    -DryRun:$DryRun


Install-Schema `
    -Schema $ImportBatchesSchema `
    -Rules $ImportBatchesRules `
    -TargetTitle $ImportBatchesTitle `
    -Template "GenericList" `
    -DryRun:$DryRun


Install-Schema `
    -Schema $ArchiveSchema `
    -Rules $ArchiveRules `
    -TargetTitle $ArchiveTitle `
    -Template "DocumentLibrary" `
    -DryRun:$DryRun


Write-Host ""
Write-Host "=============================================="

if ($DryRun) {
    Write-Host "DRY-RUN OK: Keine SharePoint-Aenderung ausgefuehrt"
}
else {
    Write-Host "OK: Migrationsinfrastruktur ist provisioniert"
}

Write-Host "=============================================="
Write-Host ""

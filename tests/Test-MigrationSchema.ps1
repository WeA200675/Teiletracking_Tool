$ErrorActionPreference = "Stop"


function Assert-True {
    param(
        [Parameter(Mandatory)]
        [bool]$Condition,

        [Parameter(Mandatory)]
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}


function Get-JsonFile {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    return Get-Content `
        -Path $Path `
        -Raw |
        ConvertFrom-Json
}


$RepoRoot =
    Split-Path `
        -Parent $PSScriptRoot

$ConfigPath =
    Join-Path `
        $RepoRoot `
        "config/settings.example.json"

$ListFolder =
    Join-Path `
        $RepoRoot `
        "powershell/lists"

$LibraryFolder =
    Join-Path `
        $RepoRoot `
        "powershell/libraries"

$InstallerPath =
    Join-Path `
        $RepoRoot `
        "powershell/migration/Install-MigrationInfrastructure.ps1"


Write-Host ""
Write-Host "TEST 1: Portable Konfiguration"

$config =
    Get-JsonFile `
        -Path $ConfigPath

Assert-True `
    -Condition (
        [string]$config.Lists.ImportBatches -eq
        "ImportBatches"
    ) `
    -Message "ImportBatches fehlt in settings.example.json"

Assert-True `
    -Condition (
        [string]$config.Libraries.TrackingImportArchiv -eq
        "TrackingImportArchiv"
    ) `
    -Message "TrackingImportArchiv fehlt in settings.example.json"

Write-Host "TEST 1 OK"


Write-Host ""
Write-Host "TEST 2: Steuergeraete Herkunftsfelder"

$steuergeraete =
    Get-JsonFile `
        -Path (
            Join-Path `
                $ListFolder `
                "Steuergeraete.json"
        )

$requiredSteuergeraeteFields =
    @(
        "SourceRecordId",
        "ImportBatchId",
        "SourceDeviceId",
        "SourceOrigin",
        "CapturedAt",
        "ImportedAt",
        "ImportedBy",
        "RecordHash",
        "LabelImageFile",
        "LabelImageHash",
        "ATS",
        "YNummer",
        "Teilestatus",
        "TransferBatchId",
        "TransferSourceRecordId"
    )

$steuergeraeteFieldNames =
    @(
        $steuergeraete.Fields |
            ForEach-Object {
                [string]$_.InternalName
            }
    )

foreach ($fieldName in $requiredSteuergeraeteFields) {
    Assert-True `
        -Condition (
            $fieldName -in
            $steuergeraeteFieldNames
        ) `
        -Message (
            "Steuergeraete-Feld fehlt: " +
            $fieldName
        )
}

$steuerRules =
    Get-JsonFile `
        -Path (
            Join-Path `
                $ListFolder `
                "Steuergeraete.rules.json"
        )

Assert-True `
    -Condition (
        "SourceRecordId" -in
        @($steuerRules.Unique)
    ) `
    -Message "SourceRecordId muss eindeutig sein"

Assert-True `
    -Condition (
        "ImportBatchId" -in
        @($steuerRules.Indexes)
    ) `
    -Message "ImportBatchId muss indexiert sein"

Write-Host "TEST 2 OK"


Write-Host ""
Write-Host "TEST 3: ImportBatches Schema"

$importBatches =
    Get-JsonFile `
        -Path (
            Join-Path `
                $ListFolder `
                "ImportBatches.json"
        )

$batchFieldNames =
    @(
        $importBatches.Fields |
            ForEach-Object {
                [string]$_.InternalName
            }
    )

$requiredBatchFields =
    @(
        "BatchId",
        "DeviceId",
        "PackageHash",
        "CreatedAt",
        "ImportedAt",
        "ImportedBy",
        "SchemaVersion",
        "PackageFormatVersion",
        "RecordCount",
        "ImportedCount",
        "SkippedDuplicateCount",
        "ConflictCount",
        "ImageCount",
        "FileName",
        "ArchiveFileName",
        "ImportStatus"
    )

foreach ($fieldName in $requiredBatchFields) {
    Assert-True `
        -Condition (
            $fieldName -in
            $batchFieldNames
        ) `
        -Message (
            "ImportBatches-Feld fehlt: " +
            $fieldName
        )
}

$batchRules =
    Get-JsonFile `
        -Path (
            Join-Path `
                $ListFolder `
                "ImportBatches.rules.json"
        )

Assert-True `
    -Condition (
        "BatchId" -in
        @($batchRules.Unique)
    ) `
    -Message "BatchId muss eindeutig sein"

Assert-True `
    -Condition (
        "PackageHash" -in
        @($batchRules.Unique)
    ) `
    -Message "PackageHash muss eindeutig sein"

Write-Host "TEST 3 OK"


Write-Host ""
Write-Host "TEST 4: TrackingImportArchiv Schema"

$archive =
    Get-JsonFile `
        -Path (
            Join-Path `
                $LibraryFolder `
                "TrackingImportArchiv.json"
        )

Assert-True `
    -Condition (
        [string]$archive.Template -eq
        "DocumentLibrary"
    ) `
    -Message "TrackingImportArchiv muss eine DocumentLibrary sein"

$archiveFieldNames =
    @(
        $archive.Fields |
            ForEach-Object {
                [string]$_.InternalName
            }
    )

foreach (
    $fieldName in @(
        "BatchId",
        "DeviceId",
        "PackageHash",
        "OriginalFileName",
        "PackageCreatedAt",
        "ImportedAt",
        "ImportedBy",
        "SchemaVersion",
        "RecordCount",
        "ImportStatus"
    )
) {
    Assert-True `
        -Condition (
            $fieldName -in
            $archiveFieldNames
        ) `
        -Message (
            "Archiv-Feld fehlt: " +
            $fieldName
        )
}

$archiveRules =
    Get-JsonFile `
        -Path (
            Join-Path `
                $LibraryFolder `
                "TrackingImportArchiv.rules.json"
        )

Assert-True `
    -Condition (
        "BatchId" -in
        @($archiveRules.Unique)
    ) `
    -Message "Archiv BatchId muss eindeutig sein"

Write-Host "TEST 4 OK"


Write-Host ""
Write-Host "TEST 5: Installer bleibt tenant-neutral"

$installerText =
    Get-Content `
        -Path $InstallerPath `
        -Raw

Assert-True `
    -Condition (
        $installerText -notmatch
        "https://.+sharepoint\.com"
    ) `
    -Message "Installer enthält eine fest codierte SharePoint-URL"

Assert-True `
    -Condition (
        $installerText -notmatch
        "Connect-PnPOnline"
    ) `
    -Message (
        "Installer soll keine eigene Anmeldung durchführen; " +
        "die Verbindung wird später vom Import-PC bereitgestellt"
    )

Write-Host "TEST 5 OK"


Write-Host ""
Write-Host "TEST 6: Installer Dry-Run"

& $InstallerPath `
    -ConfigPath $ConfigPath `
    -DryRun

Write-Host "TEST 6 OK"


Write-Host ""
Write-Host "=============================================="
Write-Host "TEST OK: Migrationsschema und Dry-Run bestanden"
Write-Host "=============================================="

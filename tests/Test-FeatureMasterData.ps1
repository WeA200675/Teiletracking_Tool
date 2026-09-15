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


function Read-Json {
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

$ListFolder =
    Join-Path `
        $RepoRoot `
        "powershell/lists"

$ConfigPath =
    Join-Path `
        $RepoRoot `
        "config/settings.example.json"

$InstallerPath =
    Join-Path `
        $RepoRoot `
        "powershell/migration/Install-FeatureMasterData.ps1"


Write-Host ""
Write-Host "TEST 1: ATS- und Y-Nummer-Stammdaten"

$ats =
    Read-Json `
        -Path (
            Join-Path $ListFolder "ATS.json"
        )

$y =
    Read-Json `
        -Path (
            Join-Path $ListFolder "YNummern.json"
        )

Assert-True `
    -Condition (
        "ATSCode" -in
        @(
            $ats.Fields |
            ForEach-Object {
                [string]$_.InternalName
            }
        )
    ) `
    -Message "ATSCode fehlt"

Assert-True `
    -Condition (
        "YNummerCode" -in
        @(
            $y.Fields |
            ForEach-Object {
                [string]$_.InternalName
            }
        )
    ) `
    -Message "YNummerCode fehlt"

Write-Host "TEST 1 OK"


Write-Host ""
Write-Host "TEST 2: Statuswerte und eindeutige Farbe"

$status =
    Read-Json `
        -Path (
            Join-Path $ListFolder "Statuswerte.json"
        )

$statusRules =
    Read-Json `
        -Path (
            Join-Path $ListFolder "Statuswerte.rules.json"
        )

foreach (
    $fieldName in @(
        "StatusCode",
        "Anzeigename",
        "Farbe",
        "Aktiv"
    )
) {
    Assert-True `
        -Condition (
            $fieldName -in
            @(
                $status.Fields |
                ForEach-Object {
                    [string]$_.InternalName
                }
            )
        ) `
        -Message (
            "Statusfeld fehlt: " +
            $fieldName
        )
}

Assert-True `
    -Condition (
        "Farbe" -in
        @($statusRules.Unique)
    ) `
    -Message "Farbe muss eindeutig sein"

Write-Host "TEST 2 OK"


Write-Host ""
Write-Host "TEST 3: Konfiguration"

$config =
    Read-Json `
        -Path $ConfigPath

foreach (
    $name in @(
        "ATS",
        "YNummern",
        "Statuswerte"
    )
) {
    Assert-True `
        -Condition (
            -not [string]::IsNullOrWhiteSpace(
                [string]$config.Lists.$name
            )
        ) `
        -Message (
            "Konfiguration fehlt: " +
            $name
        )
}

Write-Host "TEST 3 OK"


Write-Host ""
Write-Host "TEST 4: Tenant-neutraler Dry-Run"

$installerText =
    Get-Content `
        -Path $InstallerPath `
        -Raw

Assert-True `
    -Condition (
        $installerText -notmatch
        "Connect-PnPOnline"
    ) `
    -Message "Installer darf keine eigene Anmeldung enthalten"

& $InstallerPath `
    -ConfigPath $ConfigPath `
    -DryRun

Write-Host "TEST 4 OK"


Write-Host ""
Write-Host "=============================================="
Write-Host "TEST OK: Zusatz-Stammdaten bestanden"
Write-Host "=============================================="

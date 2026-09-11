param([string]$SiteUrl,[string]$ClientId,[switch]$DryRun)

$ConfigPath=Join-Path $PSScriptRoot "../config/settings.example.json"

$Config=Get-Content $ConfigPath -Raw | ConvertFrom-Json

if(-not $SiteUrl){$SiteUrl=$Config.SiteUrl}

if(-not $ClientId){$ClientId=$Config.ClientId}

Write-Host "=== Teiletracking Installation ==="

Write-Host "Ziel-Site:" $SiteUrl

Write-Host "DryRun:" $DryRun

if(-not $DryRun){Write-Host "Verbinde mit SharePoint..."; Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId}

$ListFiles=Get-ChildItem (Join-Path $PSScriptRoot "lists/*.json") | Where-Object {$_.Name -notlike "*.rules.json"}

foreach($File in $ListFiles){$ListDef=Get-Content $File.FullName -Raw | ConvertFrom-Json; if($DryRun){Write-Host ""; Write-Host "[DRY-RUN] Liste:" $ListDef.Title}else{$Existing=Get-PnPList -Identity $ListDef.Title -ErrorAction SilentlyContinue; if(-not $Existing){Write-Host "Erstelle Liste:" $ListDef.Title; New-PnPList -Title $ListDef.Title -Template GenericList | Out-Null}else{Write-Host "Liste vorhanden:" $ListDef.Title}}; foreach($Field in $ListDef.Fields){if($DryRun){Write-Host "  [DRY-RUN] Feld:" $Field.InternalName "-" $Field.Type}else{$ExistingField=Get-PnPField -List $ListDef.Title -Identity $Field.InternalName -ErrorAction SilentlyContinue; if($ExistingField){Write-Host "  Feld vorhanden:" $Field.InternalName}else{Write-Host "  Erstelle Feld:" $Field.InternalName; if($Field.Type -eq "Choice"){Add-PnPField -List $ListDef.Title -DisplayName $Field.DisplayName -InternalName $Field.InternalName -Type Choice -Choices $Field.Choices -Required:$Field.Required | Out-Null}else{Add-PnPField -List $ListDef.Title -DisplayName $Field.DisplayName -InternalName $Field.InternalName -Type $Field.Type -Required:$Field.Required | Out-Null}}}}}

$RuleFiles=Get-ChildItem (Join-Path $PSScriptRoot "lists/*.rules.json")

foreach($RuleFile in $RuleFiles){$Rules=Get-Content $RuleFile.FullName -Raw | ConvertFrom-Json; Write-Host ""; Write-Host "Regeln für:" $Rules.List; foreach($FieldName in $Rules.Indexes){if($DryRun){Write-Host "  [DRY-RUN] Index:" $FieldName}else{Set-PnPField -List $Rules.List -Identity $FieldName -Values @{Indexed=$true} | Out-Null; Write-Host "  Index gesetzt:" $FieldName}}; foreach($FieldName in $Rules.Unique){if($DryRun){Write-Host "  [DRY-RUN] Unique:" $FieldName}else{Set-PnPField -List $Rules.List -Identity $FieldName -Values @{EnforceUniqueValues=$true;Indexed=$true} | Out-Null; Write-Host "  Unique gesetzt:" $FieldName}}}

$ViewFiles=Get-ChildItem (Join-Path $PSScriptRoot "views/*.json")

foreach($ViewFile in $ViewFiles){$ViewDef=Get-Content $ViewFile.FullName -Raw | ConvertFrom-Json; Write-Host ""; Write-Host "Views für Liste:" $ViewDef.List; foreach($View in $ViewDef.Views){Write-Host "  View:" $View.Title; if($View.FilterField){Write-Host "    Filter:" $View.FilterField $View.FilterOperator $View.FilterValue}}}

$FormattingPath=Join-Path $PSScriptRoot "../sharepoint/formatting/ValidationStatus.json"

if(Test-Path $FormattingPath){Write-Host ""; Write-Host "Formatierung gefunden: ValidationStatus"; if($DryRun){Write-Host "[DRY-RUN] Formatierung würde auf Steuergeraete.ValidationStatus angewendet werden"}}


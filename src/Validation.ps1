function Get-NormalizedText {
 param([string]$Value) if($null -eq $Value){return ""}; return $Value.Trim().ToUpperInvariant() 
}

function Get-DeviceKey {
 param([string]$PartNumber,[string]$SerialNumber) $pn=Get-NormalizedText $PartNumber; $sn=Get-NormalizedText $SerialNumber; return "$pn|$sn" 
}

function Get-AssignmentKey {
 param([string]$PartNumber,[string]$SerialNumber,[string]$Derivat,[string]$IStufe) $pn=Get-NormalizedText $PartNumber; $sn=Get-NormalizedText $SerialNumber; $d=Get-NormalizedText $Derivat; $i=Get-NormalizedText $IStufe; return "$pn|$sn|$d|$i" 
}

function ConvertFrom-TrackingString {
 param([string]$InputString) $data=@{}; foreach($part in $InputString -split ";"){ if($part -match "="){ $kv=$part -split "=",2; $data[(Get-NormalizedText $kv[0])]=$kv[1].Trim() } }; [pscustomobject]@{PartNumber=$data["PN"];SerialNumber=$data["SN"];Hardware=$data["HW"];Software=$data["SW"]} 
}

function Test-TrackingMatch {
 param([pscustomobject]$Label,[pscustomobject]$QR) if((Get-NormalizedText $Label.PartNumber) -ne (Get-NormalizedText $QR.PartNumber)){return "LABEL_QR_MISMATCH"}; if((Get-NormalizedText $Label.SerialNumber) -ne (Get-NormalizedText $QR.SerialNumber)){return "LABEL_QR_MISMATCH"}; if((Get-NormalizedText $Label.Hardware) -ne (Get-NormalizedText $QR.Hardware)){return "LABEL_QR_MISMATCH"}; if((Get-NormalizedText $Label.Software) -ne (Get-NormalizedText $QR.Software)){return "LABEL_QR_MISMATCH"}; return "OK" 
}

function Get-DuplicateStatus {
 param([string]$ExistingDeviceKey,[string]$ExistingAssignmentKey,[string]$NewDeviceKey,[string]$NewAssignmentKey) if($ExistingAssignmentKey -eq $NewAssignmentKey){return "DUPLICATE"}; if($ExistingDeviceKey -eq $NewDeviceKey){return "DOUBLE_DERIVATIVE"}; return "NEW" 
}

function New-TrackingRecord {
 param([string]$LabelString,[string]$QRString,[string]$Derivat,[string]$IStufe,[string]$DuplicateStatus="NEW") $Label=ConvertFrom-TrackingString $LabelString; $QR=ConvertFrom-TrackingString $QRString; $DeviceKey=Get-DeviceKey -PartNumber $Label.PartNumber -SerialNumber $Label.SerialNumber; $AssignmentKey=Get-AssignmentKey -PartNumber $Label.PartNumber -SerialNumber $Label.SerialNumber -Derivat $Derivat -IStufe $IStufe; $MatchStatus=Test-TrackingMatch -Label $Label -QR $QR; if($MatchStatus -eq "LABEL_QR_MISMATCH"){$ValidationStatus="LABEL_QR_MISMATCH"}elseif($DuplicateStatus -eq "DUPLICATE"){$ValidationStatus="DUPLICATE"}elseif($DuplicateStatus -eq "DOUBLE_DERIVATIVE"){$ValidationStatus="DOUBLE_DERIVATIVE"}else{$ValidationStatus="OK"}; [pscustomobject]@{PartNumber=$Label.PartNumber;SerialNumber=$Label.SerialNumber;Derivat=(Get-NormalizedText $Derivat);IStufe=(Get-NormalizedText $IStufe);LabelHardware=$Label.Hardware;QRHardware=$QR.Hardware;LabelSoftware=$Label.Software;QRSoftware=$QR.Software;DeviceKey=$DeviceKey;AssignmentKey=$AssignmentKey;DuplicateStatus=$DuplicateStatus;ValidationStatus=$ValidationStatus;DoppelDerivat=($DuplicateStatus -eq "DOUBLE_DERIVATIVE")} 
}

function Save-TrackingRecord {
 param([pscustomobject]$Record,[switch]$DryRun) if($Record.DuplicateStatus -eq "DUPLICATE"){Write-Host "DUPLICATE: Datensatz wird nicht gespeichert:" $Record.AssignmentKey; return}; $Values=@{Title=$Record.AssignmentKey;DeviceKey=$Record.DeviceKey;AssignmentKey=$Record.AssignmentKey;PartNumber=$Record.PartNumber;SerialNumber=$Record.SerialNumber;Derivat=$Record.Derivat;IStufe=$Record.IStufe;LabelHardware=$Record.LabelHardware;QRHardware=$Record.QRHardware;LabelSoftware=$Record.LabelSoftware;QRSoftware=$Record.QRSoftware;ValidationStatus=$Record.ValidationStatus;DoppelDerivat=$Record.DoppelDerivat}; if($DryRun){Write-Host "[DRY-RUN] Datensatz würde gespeichert:" $Record.AssignmentKey; return}; Add-PnPListItem -List "Steuergeraete" -Values $Values | Out-Null; Write-Host "Datensatz gespeichert:" $Record.AssignmentKey 
}

function ConvertTo-CamlValue {
 param([string]$Value) return [System.Security.SecurityElement]::Escape($Value) 
}

function Get-SharePointDuplicateStatus {
 param([string]$DeviceKey,[string]$AssignmentKey,[switch]$DryRun) if($DryRun){Write-Host "[DRY-RUN] Suche AssignmentKey:" $AssignmentKey; Write-Host "[DRY-RUN] Suche DeviceKey:" $DeviceKey; return "NEW"}; $a=ConvertTo-CamlValue $AssignmentKey; $d=ConvertTo-CamlValue $DeviceKey; $AssignmentItems=Get-PnPListItem -List "Steuergeraete" -Query "<View><Query><Where><Eq><FieldRef Name='AssignmentKey'/><Value Type='Text'>$a</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>"; if($AssignmentItems.Count -gt 0){return "DUPLICATE"}; $DeviceItems=Get-PnPListItem -List "Steuergeraete" -Query "<View><Query><Where><Eq><FieldRef Name='DeviceKey'/><Value Type='Text'>$d</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>"; if($DeviceItems.Count -gt 0){return "DOUBLE_DERIVATIVE"}; return "NEW" 
}

function Test-TrackingRequiredFields {
 param([pscustomobject]$Label,[string]$Derivat,[string]$IStufe) $Errors=@(); if([string]::IsNullOrWhiteSpace($Label.PartNumber)){$Errors+="PartNumber fehlt"}; if([string]::IsNullOrWhiteSpace($Label.SerialNumber)){$Errors+="SerialNumber fehlt"}; if([string]::IsNullOrWhiteSpace($Derivat)){$Errors+="Derivat fehlt"}; if([string]::IsNullOrWhiteSpace($IStufe)){$Errors+="I-Stufe fehlt"}; return $Errors 
}

function Test-QRRequiredFields {
 param([pscustomobject]$QR) $Errors=@(); if([string]::IsNullOrWhiteSpace($QR.PartNumber)){$Errors+="QR PartNumber fehlt"}; if([string]::IsNullOrWhiteSpace($QR.SerialNumber)){$Errors+="QR SerialNumber fehlt"}; return $Errors 
}

function Invoke-TrackingImport {
 param([string]$LabelString,[string]$QRString,[string]$Derivat,[string]$IStufe,[switch]$DryRun) $Label=ConvertFrom-TrackingString $LabelString; $DeviceKey=Get-DeviceKey -PartNumber $Label.PartNumber -SerialNumber $Label.SerialNumber; $AssignmentKey=Get-AssignmentKey -PartNumber $Label.PartNumber -SerialNumber $Label.SerialNumber -Derivat $Derivat -IStufe $IStufe; $DuplicateStatus=Get-SharePointDuplicateStatus -DeviceKey $DeviceKey -AssignmentKey $AssignmentKey -DryRun:$DryRun; $Record=New-TrackingRecord -LabelString $LabelString -QRString $QRString -Derivat $Derivat -IStufe $IStufe -DuplicateStatus $DuplicateStatus; Save-TrackingRecord -Record $Record -DryRun:$DryRun; return $Record 
}

function Invoke-TrackingImportValidated {
    param(
        [string]$LabelString,
        [string]$QRString,
        [string]$Derivat,
        [string]$IStufe,
        [switch]$DryRun
    )

    $Label = ConvertFrom-TrackingString $LabelString
    $QR = ConvertFrom-TrackingString $QRString

    $Errors = @()
    $Errors += Test-TrackingRequiredFields -Label $Label -Derivat $Derivat -IStufe $IStufe
    $Errors += Test-QRRequiredFields -QR $QR

    if ($Errors.Count -eq 0) {
        $Errors += Test-TrackingMasterData -Derivat $Derivat -IStufe $IStufe -DryRun:$DryRun
    }

    if ($Errors.Count -gt 0) {
        throw ("Eingabe ungültig: " + ($Errors -join "; "))
    }

    Invoke-TrackingImport -LabelString $LabelString -QRString $QRString -Derivat $Derivat -IStufe $IStufe -DryRun:$DryRun
}

function Test-TrackingMasterData {
    param([string]$Derivat,[string]$IStufe,[switch]$DryRun)
    if($DryRun){ return @() }
    $Errors=@()
    $d=@(Get-PnPListItem -List "Derivate" -Query "<View><Query><Where><Eq><FieldRef Name='DerivatCode'/><Value Type='Text'>$(ConvertTo-CamlValue $Derivat)</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>")
    if($d.Count -eq 0){$Errors+="Derivat '$Derivat' ist unbekannt"}elseif(-not [bool]$d[0]["Aktiv"]){$Errors+="Derivat '$Derivat' ist inaktiv"}
    $i=@(Get-PnPListItem -List "IStufen" -Query "<View><Query><Where><Eq><FieldRef Name='IStufeCode'/><Value Type='Text'>$(ConvertTo-CamlValue $IStufe)</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>")
    if($i.Count -eq 0){$Errors+="I-Stufe '$IStufe' ist unbekannt"}elseif(-not [bool]$i[0]["Aktiv"]){$Errors+="I-Stufe '$IStufe' ist inaktiv"}
    return $Errors
}



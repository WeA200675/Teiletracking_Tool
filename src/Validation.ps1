function Get-NormalizedText {
    param(
        [AllowNull()]
        [string]$Value
    )

    if ($null -eq $Value) {
        return ""
    }

    return $Value.Trim().ToUpperInvariant()
}


function Get-DeviceKey {
    param(
        [string]$PartNumber,
        [string]$SerialNumber
    )

    $pn = Get-NormalizedText $PartNumber
    $sn = Get-NormalizedText $SerialNumber

    return "$pn|$sn"
}


function Get-AssignmentKey {
    param(
        [string]$PartNumber,
        [string]$SerialNumber,
        [string]$Derivat,
        [string]$IStufe
    )

    $pn = Get-NormalizedText $PartNumber
    $sn = Get-NormalizedText $SerialNumber
    $d = Get-NormalizedText $Derivat
    $i = Get-NormalizedText $IStufe

    return "$pn|$sn|$d|$i"
}


function ConvertFrom-TrackingString {
    param(
        [AllowNull()]
        [string]$InputString
    )

    if ([string]::IsNullOrWhiteSpace($InputString)) {
        throw "Tracking-String ist leer"
    }

    $allowedKeys = @(
        "PN",
        "SN",
        "HW",
        "SW"
    )

    $data = @{}

    $segments = $InputString -split ";"

    foreach ($segmentRaw in $segments) {
        $segment = $segmentRaw.Trim()

        # Ein abschließendes Semikolon oder zusätzliche Leersegmente
        # werden toleriert.
        if ([string]::IsNullOrWhiteSpace($segment)) {
            continue
        }

        if ($segment -notmatch "=") {
            throw "Ungültiges Segment ohne '=': '$segment'"
        }

        $kv = $segment -split "=", 2

        $key = Get-NormalizedText $kv[0]
        $value = Get-NormalizedText $kv[1]

        if ([string]::IsNullOrWhiteSpace($key)) {
            throw "Tracking-Schlüssel darf nicht leer sein"
        }

        if ($key -notin $allowedKeys) {
            throw "Unbekannter Tracking-Schlüssel: '$key'"
        }

        if ($data.ContainsKey($key)) {
            throw "Tracking-Schlüssel '$key' ist mehrfach vorhanden"
        }

        $data[$key] = $value
    }

    if ($data.Count -eq 0) {
        throw "Tracking-String enthält keine verwertbaren Daten"
    }

    return [pscustomobject]@{
        PartNumber   = Get-NormalizedText $data["PN"]
        SerialNumber = Get-NormalizedText $data["SN"]
        Hardware     = Get-NormalizedText $data["HW"]
        Software     = Get-NormalizedText $data["SW"]
    }
}


function Test-TrackingMatch {
    param(
        [pscustomobject]$Label,
        [pscustomobject]$QR
    )

    if (
        (Get-NormalizedText $Label.PartNumber) -ne
        (Get-NormalizedText $QR.PartNumber)
    ) {
        return "LABEL_QR_MISMATCH"
    }

    if (
        (Get-NormalizedText $Label.SerialNumber) -ne
        (Get-NormalizedText $QR.SerialNumber)
    ) {
        return "LABEL_QR_MISMATCH"
    }

    if (
        (Get-NormalizedText $Label.Hardware) -ne
        (Get-NormalizedText $QR.Hardware)
    ) {
        return "LABEL_QR_MISMATCH"
    }

    if (
        (Get-NormalizedText $Label.Software) -ne
        (Get-NormalizedText $QR.Software)
    ) {
        return "LABEL_QR_MISMATCH"
    }

    return "OK"
}


function Get-DuplicateStatus {
    param(
        [string]$ExistingDeviceKey,
        [string]$ExistingAssignmentKey,
        [string]$NewDeviceKey,
        [string]$NewAssignmentKey
    )

    $existingDevice = Get-NormalizedText $ExistingDeviceKey
    $existingAssignment = Get-NormalizedText $ExistingAssignmentKey
    $newDevice = Get-NormalizedText $NewDeviceKey
    $newAssignment = Get-NormalizedText $NewAssignmentKey

    if ($existingAssignment -eq $newAssignment) {
        return "DUPLICATE"
    }

    if ($existingDevice -eq $newDevice) {
        return "DOUBLE_DERIVATIVE"
    }

    return "NEW"
}


function New-TrackingRecord {
    param(
        [string]$LabelString,
        [string]$QRString,
        [string]$Derivat,
        [string]$IStufe,
        [string]$DuplicateStatus = "NEW"
    )

    $Label = ConvertFrom-TrackingString $LabelString
    $QR = ConvertFrom-TrackingString $QRString

    $normalizedDerivat = Get-NormalizedText $Derivat
    $normalizedIStufe = Get-NormalizedText $IStufe
    $normalizedDuplicateStatus = Get-NormalizedText $DuplicateStatus

    $DeviceKey = Get-DeviceKey `
        -PartNumber $Label.PartNumber `
        -SerialNumber $Label.SerialNumber

    $AssignmentKey = Get-AssignmentKey `
        -PartNumber $Label.PartNumber `
        -SerialNumber $Label.SerialNumber `
        -Derivat $normalizedDerivat `
        -IStufe $normalizedIStufe

    $MatchStatus = Test-TrackingMatch `
        -Label $Label `
        -QR $QR

    if ($MatchStatus -eq "LABEL_QR_MISMATCH") {
        $ValidationStatus = "LABEL_QR_MISMATCH"
    }
    elseif ($normalizedDuplicateStatus -eq "DUPLICATE") {
        $ValidationStatus = "DUPLICATE"
    }
    elseif ($normalizedDuplicateStatus -eq "DOUBLE_DERIVATIVE") {
        $ValidationStatus = "DOUBLE_DERIVATIVE"
    }
    else {
        $ValidationStatus = "OK"
    }

    return [pscustomobject]@{
        PartNumber       = $Label.PartNumber
        SerialNumber     = $Label.SerialNumber
        Derivat          = $normalizedDerivat
        IStufe           = $normalizedIStufe
        LabelHardware    = $Label.Hardware
        QRHardware       = $QR.Hardware
        LabelSoftware    = $Label.Software
        QRSoftware       = $QR.Software
        DeviceKey        = $DeviceKey
        AssignmentKey    = $AssignmentKey
        DuplicateStatus  = $normalizedDuplicateStatus
        ValidationStatus = $ValidationStatus
        DoppelDerivat    = ($normalizedDuplicateStatus -eq "DOUBLE_DERIVATIVE")
    }
}


function Save-TrackingRecord {
    param(
        [pscustomobject]$Record,
        [switch]$DryRun
    )

    if ($Record.DuplicateStatus -eq "DUPLICATE") {
        Write-Host "DUPLICATE: Datensatz wird nicht gespeichert:" $Record.AssignmentKey
        return
    }

    $Values = @{
        Title            = $Record.AssignmentKey
        DeviceKey        = $Record.DeviceKey
        AssignmentKey    = $Record.AssignmentKey
        PartNumber       = $Record.PartNumber
        SerialNumber     = $Record.SerialNumber
        Derivat          = $Record.Derivat
        IStufe           = $Record.IStufe
        LabelHardware    = $Record.LabelHardware
        QRHardware       = $Record.QRHardware
        LabelSoftware    = $Record.LabelSoftware
        QRSoftware       = $Record.QRSoftware
        ValidationStatus = $Record.ValidationStatus
        DoppelDerivat    = $Record.DoppelDerivat
    }

    if ($DryRun) {
        Write-Host "[DRY-RUN] Datensatz würde gespeichert:" $Record.AssignmentKey
        return
    }

    Add-PnPListItem `
        -List "Steuergeraete" `
        -Values $Values |
        Out-Null

    Write-Host "Datensatz gespeichert:" $Record.AssignmentKey
}


function ConvertTo-CamlValue {
    param(
        [string]$Value
    )

    return [System.Security.SecurityElement]::Escape($Value)
}


function Get-SharePointDuplicateStatus {
    param(
        [string]$DeviceKey,
        [string]$AssignmentKey,
        [switch]$DryRun
    )

    $normalizedDeviceKey = Get-NormalizedText $DeviceKey
    $normalizedAssignmentKey = Get-NormalizedText $AssignmentKey

    if ($DryRun) {
        Write-Host "[DRY-RUN] Suche AssignmentKey:" $normalizedAssignmentKey
        Write-Host "[DRY-RUN] Suche DeviceKey:" $normalizedDeviceKey

        return "NEW"
    }

    $assignmentCaml = ConvertTo-CamlValue $normalizedAssignmentKey
    $deviceCaml = ConvertTo-CamlValue $normalizedDeviceKey

    $AssignmentItems = @(
        Get-PnPListItem `
            -List "Steuergeraete" `
            -Query "<View><Query><Where><Eq><FieldRef Name='AssignmentKey'/><Value Type='Text'>$assignmentCaml</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>"
    )

    if ($AssignmentItems.Count -gt 0) {
        return "DUPLICATE"
    }

    $DeviceItems = @(
        Get-PnPListItem `
            -List "Steuergeraete" `
            -Query "<View><Query><Where><Eq><FieldRef Name='DeviceKey'/><Value Type='Text'>$deviceCaml</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>"
    )

    if ($DeviceItems.Count -gt 0) {
        return "DOUBLE_DERIVATIVE"
    }

    return "NEW"
}


function Test-TrackingRequiredFields {
    param(
        [pscustomobject]$Label,
        [string]$Derivat,
        [string]$IStufe
    )

    $Errors = @()

    if ([string]::IsNullOrWhiteSpace($Label.PartNumber)) {
        $Errors += "PartNumber fehlt"
    }

    if ([string]::IsNullOrWhiteSpace($Label.SerialNumber)) {
        $Errors += "SerialNumber fehlt"
    }

    if ([string]::IsNullOrWhiteSpace($Derivat)) {
        $Errors += "Derivat fehlt"
    }

    if ([string]::IsNullOrWhiteSpace($IStufe)) {
        $Errors += "I-Stufe fehlt"
    }

    return $Errors
}


function Test-QRRequiredFields {
    param(
        [pscustomobject]$QR
    )

    $Errors = @()

    if ([string]::IsNullOrWhiteSpace($QR.PartNumber)) {
        $Errors += "QR PartNumber fehlt"
    }

    if ([string]::IsNullOrWhiteSpace($QR.SerialNumber)) {
        $Errors += "QR SerialNumber fehlt"
    }

    return $Errors
}


function Invoke-TrackingImport {
    param(
        [string]$LabelString,
        [string]$QRString,
        [string]$Derivat,
        [string]$IStufe,
        [switch]$DryRun
    )

    $Label = ConvertFrom-TrackingString $LabelString

    $normalizedDerivat = Get-NormalizedText $Derivat
    $normalizedIStufe = Get-NormalizedText $IStufe

    $DeviceKey = Get-DeviceKey `
        -PartNumber $Label.PartNumber `
        -SerialNumber $Label.SerialNumber

    $AssignmentKey = Get-AssignmentKey `
        -PartNumber $Label.PartNumber `
        -SerialNumber $Label.SerialNumber `
        -Derivat $normalizedDerivat `
        -IStufe $normalizedIStufe

    $DuplicateStatus = Get-SharePointDuplicateStatus `
        -DeviceKey $DeviceKey `
        -AssignmentKey $AssignmentKey `
        -DryRun:$DryRun

    $Record = New-TrackingRecord `
        -LabelString $LabelString `
        -QRString $QRString `
        -Derivat $normalizedDerivat `
        -IStufe $normalizedIStufe `
        -DuplicateStatus $DuplicateStatus

    Save-TrackingRecord `
        -Record $Record `
        -DryRun:$DryRun

    return $Record
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

    $normalizedDerivat = Get-NormalizedText $Derivat
    $normalizedIStufe = Get-NormalizedText $IStufe

    $Errors = @()

    $Errors += Test-TrackingRequiredFields `
        -Label $Label `
        -Derivat $normalizedDerivat `
        -IStufe $normalizedIStufe

    $Errors += Test-QRRequiredFields `
        -QR $QR

    if ($Errors.Count -eq 0) {
        $Errors += Test-TrackingMasterData `
            -Derivat $normalizedDerivat `
            -IStufe $normalizedIStufe `
            -DryRun:$DryRun
    }

    if ($Errors.Count -gt 0) {
        throw ("Eingabe ungültig: " + ($Errors -join "; "))
    }

    return Invoke-TrackingImport `
        -LabelString $LabelString `
        -QRString $QRString `
        -Derivat $normalizedDerivat `
        -IStufe $normalizedIStufe `
        -DryRun:$DryRun
}


function Test-TrackingMasterData {
    param(
        [string]$Derivat,
        [string]$IStufe,
        [switch]$DryRun
    )

    if ($DryRun) {
        return @()
    }

    $Errors = @()

    $normalizedDerivat = Get-NormalizedText $Derivat
    $normalizedIStufe = Get-NormalizedText $IStufe

    $derivatCaml = ConvertTo-CamlValue $normalizedDerivat
    $iStufeCaml = ConvertTo-CamlValue $normalizedIStufe

    $d = @(
        Get-PnPListItem `
            -List "Derivate" `
            -Query "<View><Query><Where><Eq><FieldRef Name='DerivatCode'/><Value Type='Text'>$derivatCaml</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>"
    )

    if ($d.Count -eq 0) {
        $Errors += "Derivat '$normalizedDerivat' ist unbekannt"
    }
    elseif (-not [bool]$d[0]["Aktiv"]) {
        $Errors += "Derivat '$normalizedDerivat' ist inaktiv"
    }

    $i = @(
        Get-PnPListItem `
            -List "IStufen" `
            -Query "<View><Query><Where><Eq><FieldRef Name='IStufeCode'/><Value Type='Text'>$iStufeCaml</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>"
    )

    if ($i.Count -eq 0) {
        $Errors += "I-Stufe '$normalizedIStufe' ist unbekannt"
    }
    elseif (-not [bool]$i[0]["Aktiv"]) {
        $Errors += "I-Stufe '$normalizedIStufe' ist inaktiv"
    }

    return $Errors
}

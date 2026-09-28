param([switch]$Setup,[switch]$Status,[switch]$Stop,[switch]$NoBrowser)

$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $PSScriptRoot
$Runtime=Join-Path $Root ".teiletracking"
$ConfigPath=Join-Path $Runtime "config.json"
$PidPath=Join-Path $Runtime "server.pid"
$LogPath=Join-Path $Runtime "server.log"
$StatePath=Join-Path $Runtime "state.json"
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

function Read-Config {
    if(-not(Test-Path $ConfigPath)){Copy-Item (Join-Path $PSScriptRoot "config.example.json") $ConfigPath}
    Get-Content $ConfigPath -Raw | ConvertFrom-Json
}
function Save-Config($cfg){$cfg|ConvertTo-Json -Depth 10|Set-Content $ConfigPath -Encoding UTF8}
function Get-IPv4Candidates {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue|Where-Object {
        $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.AddressState -eq "Preferred"
    }|ForEach-Object {[pscustomobject]@{IP=$_.IPAddress;PrefixLength=$_.PrefixLength;InterfaceAlias=$_.InterfaceAlias}}
}
function Convert-IPv4ToUInt32([string]$ip){
    $b=[Net.IPAddress]::Parse($ip).GetAddressBytes();[array]::Reverse($b);[BitConverter]::ToUInt32($b,0)
}
function Test-IPInCidr([string]$ip,[string]$cidr){
    try{
        $parts=$cidr.Split("/");if($parts.Count -ne 2){return $false}
        $prefix=[int]$parts[1];if($prefix -lt 0 -or $prefix -gt 32){return $false}
        $ipN=Convert-IPv4ToUInt32 $ip;$netN=Convert-IPv4ToUInt32 $parts[0]
        $mask=if($prefix -eq 0){[uint32]0}else{[uint32]([uint64]0xffffffff -shl (32-$prefix))}
        (($ipN -band $mask) -eq ($netN -band $mask))
    }catch{$false}
}
function Select-Address($cfg){
    $all=@(Get-IPv4Candidates);if(-not $all){return $null}
    if($cfg.Network.PreferredInterface){
        $byIf=@($all|Where-Object InterfaceAlias -eq $cfg.Network.PreferredInterface);if($byIf){$all=$byIf}
    }
    if($cfg.Network.Mode -eq "MANUAL_RANGE" -and $cfg.Network.PreferredCidr){
        $match=@($all|Where-Object {Test-IPInCidr $_.IP $cfg.Network.PreferredCidr})
        if($match){return $match[0]};return $null
    }
    $all[0]
}
function Show-Setup($cfg){
    Write-Host "";Write-Host "=== Teiletracking - geschuetzte Ersteinrichtung ===" -ForegroundColor Cyan
    Write-Host "Dieser Bereich wird im Normalbetrieb nicht angezeigt.";Write-Host ""
    $c=@(Get-IPv4Candidates)
    if($c){Write-Host "Erkannte IPv4-Adressen:";$c|Format-Table IP,PrefixLength,InterfaceAlias -AutoSize}
    else{Write-Warning "Keine geeignete IPv4-Adresse gefunden."}
    $mode=Read-Host "Netzwerkmodus [MANUAL_RANGE/AUTO] (aktuell: $($cfg.Network.Mode))"
    if($mode){$cfg.Network.Mode=$mode.ToUpperInvariant()}
    if($cfg.Network.Mode -eq "MANUAL_RANGE"){
        $cidr=Read-Host "Erlaubter IP-Bereich/CIDR (aktuell: $($cfg.Network.PreferredCidr))"
        if($cidr){$cfg.Network.PreferredCidr=$cidr}
    }
    $iface=Read-Host "Bevorzugte Schnittstelle, leer = beliebig (aktuell: $($cfg.Network.PreferredInterface))"
    if($iface){$cfg.Network.PreferredInterface=$iface}
    $port=Read-Host "Port (aktuell: $($cfg.Network.Port))";if($port){$cfg.Network.Port=[int]$port}
    Write-Host "";Write-Host "SharePoint wird nur konfiguriert; Zugangsdaten werden NICHT gespeichert."
    $spMode=Read-Host "SharePoint-Modus [DISABLED/MANUAL] (aktuell: $($cfg.SharePoint.Mode))"
    if($spMode){$cfg.SharePoint.Mode=$spMode.ToUpperInvariant()}
    if($cfg.SharePoint.Mode -ne "DISABLED"){
        $site=Read-Host "SharePoint Site URL (aktuell: $($cfg.SharePoint.SiteUrl))";if($site){$cfg.SharePoint.SiteUrl=$site}
        $client=Read-Host "PnP ClientId/AppId, falls von IT vorgegeben (aktuell: $($cfg.SharePoint.ClientId))";if($client){$cfg.SharePoint.ClientId=$client}
    }
    $cfg.SetupCompleted=$true;Save-Config $cfg
    Write-Host "Konfiguration gespeichert: $ConfigPath" -ForegroundColor Green
    $cfg
}
function Stop-Server {
    if(Test-Path $PidPath){
        $serverPid=(Get-Content $PidPath -Raw).Trim()
        if($serverPid -match "^\d+$"){Stop-Process -Id ([int]$serverPid) -Force -ErrorAction SilentlyContinue}
        Remove-Item $PidPath -Force -ErrorAction SilentlyContinue
    }
}
function Test-Server([int]$port){
    try{$r=Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 3;($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)}
    catch{$false}
}
function Start-Server($cfg){
    if(Test-Server $cfg.Network.Port){return}
    $python=if(Get-Command python -ErrorAction SilentlyContinue){"python"}elseif(Get-Command py -ErrorAction SilentlyContinue){"py"}else{throw "Python 3 wurde nicht gefunden."}
    $args=if($python -eq "py"){@("-3","-m","http.server",$cfg.Network.Port,"--bind","0.0.0.0","--directory",$Root)}else{@("-m","http.server",$cfg.Network.Port,"--bind","0.0.0.0","--directory",$Root)}
    $p=Start-Process -FilePath $python -ArgumentList $args -WindowStyle Hidden -PassThru -RedirectStandardOutput $LogPath -RedirectStandardError "$LogPath.err"
    Set-Content $PidPath $p.Id;Start-Sleep 1
    if(-not(Test-Server $cfg.Network.Port)){throw "Webserver konnte nicht gestartet werden. Siehe $LogPath.err"}
}

$cfg=Read-Config
if($Setup){$cfg=Show-Setup $cfg}
elseif(-not $cfg.SetupCompleted){
    Write-Host "Ersteinrichtung fehlt. Einmal ausfuehren:" -ForegroundColor Yellow
    Write-Host ".\control-center\Start-Teiletracking.ps1 -Setup";exit 2
}
if($Stop){Stop-Server;Write-Host "Teiletracking wurde gestoppt.";exit}

$selected=Select-Address $cfg
$localUrl="http://127.0.0.1:$($cfg.Network.Port)/prototype/"
$lanUrl=if($selected){"http://$($selected.IP):$($cfg.Network.Port)/prototype/"}else{$null}
if($Status){
    Write-Host "Teiletracking: $(if(Test-Server $cfg.Network.Port){'ONLINE'}else{'OFFLINE'})"
    Write-Host "Lokal: $localUrl";if($lanUrl){Write-Host "LAN: $lanUrl"}else{Write-Warning "Keine IP im konfigurierten Bereich."}
    Write-Host "SharePoint: $($cfg.SharePoint.Mode) $($cfg.SharePoint.SiteUrl)";exit
}

Start-Server $cfg
$state=[ordered]@{UpdatedAt=(Get-Date).ToString("o");Status="ONLINE";Port=$cfg.Network.Port;LocalUrl=$localUrl;LanUrl=$lanUrl;IP=if($selected){$selected.IP}else{""};Interface=if($selected){$selected.InterfaceAlias}else{""};SharePointMode=$cfg.SharePoint.Mode;SharePointSite=$cfg.SharePoint.SiteUrl}
$state|ConvertTo-Json|Set-Content $StatePath -Encoding UTF8
Write-Host "";Write-Host "=== Teiletracking Control Center ===" -ForegroundColor Cyan
Write-Host "Status: ONLINE" -ForegroundColor Green;Write-Host "Lokal: $localUrl"
if($lanUrl){Write-Host "LAN: $lanUrl" -ForegroundColor Green}else{Write-Warning "Keine passende LAN-IP. Lokal bleibt das Tool erreichbar."}
Write-Host "SharePoint: $($cfg.SharePoint.Mode) $($cfg.SharePoint.SiteUrl)"
Write-Host "Setup (versteckt): .\control-center\Start-Teiletracking.ps1 -Setup"
if(-not $NoBrowser){Start-Process $localUrl}

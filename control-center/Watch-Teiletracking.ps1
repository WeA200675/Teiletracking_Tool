param([switch]$Once)
$ErrorActionPreference="Continue"
$Root=Split-Path -Parent $PSScriptRoot
$Runtime=Join-Path $Root ".teiletracking"
$ConfigPath=Join-Path $Runtime "config.json"
$StatePath=Join-Path $Runtime "state.json"
$Launcher=Join-Path $PSScriptRoot "Start-Teiletracking.ps1"
if(-not(Test-Path $ConfigPath)){Write-Error "Zuerst die Ersteinrichtung ausfuehren.";exit 2}
function Healthy($port){try{(Invoke-WebRequest "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 3).StatusCode -lt 500}catch{$false}}
function U([string]$x){$b=[Net.IPAddress]::Parse($x).GetAddressBytes();[array]::Reverse($b);[BitConverter]::ToUInt32($b,0)}
function Get-IP($cfg){
    $ips=@(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue|Where-Object {$_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.AddressState -eq "Preferred"})
    if(-not $ips){return $null}
    if($cfg.Network.PreferredInterface){$m=@($ips|Where-Object InterfaceAlias -eq $cfg.Network.PreferredInterface);if($m){$ips=$m}}
    if($cfg.Network.Mode -ne "MANUAL_RANGE" -or -not $cfg.Network.PreferredCidr){return $ips[0]}
    $parts=$cfg.Network.PreferredCidr.Split("/");if($parts.Count -ne 2){return $null}
    $prefix=[int]$parts[1];$mask=if($prefix -eq 0){[uint32]0}else{[uint32]([uint64]0xffffffff -shl (32-$prefix))};$net=U $parts[0]
    @($ips|Where-Object {((U $_.IPAddress) -band $mask) -eq ($net -band $mask)})[0]
}
do{
    $cfg=Get-Content $ConfigPath -Raw|ConvertFrom-Json
    $ip=Get-IP $cfg
    if(-not(Healthy $cfg.Network.Port)){& $Launcher -NoBrowser}
    $state=[ordered]@{UpdatedAt=(Get-Date).ToString("o");Status=if(Healthy $cfg.Network.Port){"ONLINE"}else{"ERROR"};IP=if($ip){$ip.IPAddress}else{""};Interface=if($ip){$ip.InterfaceAlias}else{""};Port=$cfg.Network.Port;LanUrl=if($ip){"http://$($ip.IPAddress):$($cfg.Network.Port)/prototype/"}else{""};SharePointMode=$cfg.SharePoint.Mode;SharePointSite=$cfg.SharePoint.SiteUrl}
    $state|ConvertTo-Json|Set-Content $StatePath -Encoding UTF8
    if($Once){break}
    Start-Sleep ([Math]::Max(5,[int]$cfg.Network.MonitorSeconds))
}while($true)

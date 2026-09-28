param([switch]$Once,[switch]$TestOnly)
$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $PSScriptRoot
$Runtime=Join-Path $Root ".teiletracking"
$ConfigPath=Join-Path $Runtime "config.json"
$QueuePath=Join-Path $Runtime "sync-queue.json"
$LogPath=Join-Path $Runtime "sync.log"
$FallbackDir=Join-Path $Runtime "fallback"
New-Item -ItemType Directory -Force $Runtime,$FallbackDir|Out-Null

function Log([string]$m){$line="$(Get-Date -Format o) $m";Add-Content $LogPath $line;Write-Host $line}
function Load-Queue {if(Test-Path $QueuePath){@(Get-Content $QueuePath -Raw|ConvertFrom-Json)}else{@()}}
function Save-Queue($q){@($q)|ConvertTo-Json -Depth 20|Set-Content $QueuePath -Encoding UTF8}
function Test-SP($cfg){
    if($cfg.SharePoint.Mode -eq "DISABLED"){return @{Ok=$false;Code="SP-DISABLED";Message="SharePoint deaktiviert"}}
    if(-not $cfg.SharePoint.SiteUrl){return @{Ok=$false;Code="SP-CONFIG-001";Message="SiteUrl fehlt"}}
    if(-not(Get-Module -ListAvailable PnP.PowerShell)){return @{Ok=$false;Code="SP-PNP-001";Message="PnP.PowerShell fehlt"}}
    try{
        $args=@{Url=$cfg.SharePoint.SiteUrl;Interactive=$true;ReturnConnection=$true}
        if($cfg.SharePoint.ClientId){$args.ClientId=$cfg.SharePoint.ClientId}
        $conn=Connect-PnPOnline @args
        Get-PnPWeb -Connection $conn|Out-Null
        foreach($p in $cfg.SharePoint.Lists.PSObject.Properties){Get-PnPList -Identity $p.Value -Connection $conn -ErrorAction Stop|Out-Null}
        @{Ok=$true;Connection=$conn;Code="OK";Message="SharePoint erreichbar und Listen gefunden"}
    }catch{@{Ok=$false;Code="SP-CONNECT-001";Message=$_.Exception.Message}}
}
function Export-Fallback($items,$reason){
    if(-not $items -or @($items).Count -eq 0){return}
    $stamp=Get-Date -Format "yyyyMMdd-HHmmss"
    $pkg=[ordered]@{Format="TeiletrackingFallback";Version=1;CreatedAt=(Get-Date).ToString("o");Reason=$reason;Items=@($items)}
    $path=Join-Path $FallbackDir "tracking-fallback-$stamp.json"
    $pkg|ConvertTo-Json -Depth 30|Set-Content $path -Encoding UTF8
    Log "FALLBACK $path"
}
function Push-Item($item,$cfg,$conn){
    $list=$cfg.SharePoint.Lists.Steuergeraete
    $values=@{}
    foreach($p in $item.Data.PSObject.Properties){$values[$p.Name]=$p.Value}
    if(-not $values.ContainsKey("RecordId") -and $item.RecordId){$values.RecordId=$item.RecordId}
    $existing=$null
    if($item.RecordId){
        $safe=$item.RecordId.Replace("'","''")
        $existing=Get-PnPListItem -List $list -Query "<View><Query><Where><Eq><FieldRef Name='RecordId'/><Value Type='Text'>$safe</Value></Eq></Where></Query><RowLimit>1</RowLimit></View>" -Connection $conn -ErrorAction Stop|Select-Object -First 1
    }
    if($existing){Set-PnPListItem -List $list -Identity $existing.Id -Values $values -Connection $conn|Out-Null}
    else{Add-PnPListItem -List $list -Values $values -Connection $conn|Out-Null}
}
if(-not(Test-Path $ConfigPath)){throw "Control Center nicht eingerichtet."}
$cfg=Get-Content $ConfigPath -Raw|ConvertFrom-Json
$test=Test-SP $cfg
Log "$($test.Code) $($test.Message)"
if($TestOnly){if(-not $test.Ok){exit 2}else{exit 0}}
$q=@(Load-Queue)
if(-not $test.Ok){
    if($cfg.Sync.Fallback -eq "PACKAGE"){Export-Fallback $q "$($test.Code): $($test.Message)"}
    exit 2
}
$remaining=@()
foreach($item in $q){
    try{
        Push-Item $item $cfg $test.Connection
        Log "SYNCED RecordId=$($item.RecordId)"
    }catch{
        $item.Attempts=[int]$item.Attempts+1;$item.LastError=$_.Exception.Message;$item.Status="ERROR"
        if($item.Attempts -ge [int]$cfg.Sync.RetryCount){
            if($cfg.Sync.Fallback -eq "PACKAGE"){Export-Fallback @($item) $item.LastError}
        }else{$remaining+=$item}
        Log "ERROR RecordId=$($item.RecordId) $($item.LastError)"
    }
}
Save-Queue $remaining

param([Parameter(Mandatory=$true)][string]$JsonPath)
$Root=Split-Path -Parent $PSScriptRoot
$Runtime=Join-Path $Root ".teiletracking";$QueuePath=Join-Path $Runtime "sync-queue.json"
New-Item -ItemType Directory -Force $Runtime|Out-Null
$data=Get-Content $JsonPath -Raw|ConvertFrom-Json
$items=if($data -is [array]){@($data)}else{@($data)}
$q=if(Test-Path $QueuePath){@(Get-Content $QueuePath -Raw|ConvertFrom-Json)}else{@()}
foreach($d in $items){
    $rid=if($d.RecordId){$d.RecordId}else{[guid]::NewGuid().ToString()}
    if(-not(@($q|Where-Object RecordId -eq $rid))){
        $q+=[pscustomobject]@{RecordId=$rid;Status="PENDING";Attempts=0;CreatedAt=(Get-Date).ToString("o");LastError="";Data=$d}
    }
}
$q|ConvertTo-Json -Depth 30|Set-Content $QueuePath -Encoding UTF8
Write-Host "$($items.Count) Datensatz/Datensaetze verarbeitet. Queue: $($q.Count)"

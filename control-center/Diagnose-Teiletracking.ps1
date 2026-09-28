$Root=Split-Path -Parent $PSScriptRoot
$Runtime=Join-Path $Root ".teiletracking";$Config=Join-Path $Runtime "config.json";$State=Join-Path $Runtime "state.json";$Queue=Join-Path $Runtime "sync-queue.json"
Write-Host "=== Teiletracking Diagnose ===" -ForegroundColor Cyan
Write-Host "Windows: $([Environment]::OSVersion.VersionString)"
Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host "Python: $(if(Get-Command python -ErrorAction SilentlyContinue){(python --version 2>&1)}elseif(Get-Command py -ErrorAction SilentlyContinue){(py -3 --version 2>&1)}else{'FEHLT'})"
Write-Host "PnP.PowerShell: $(if(Get-Module -ListAvailable PnP.PowerShell){'vorhanden'}else{'FEHLT'})"
if(Test-Path $Config){$c=Get-Content $Config -Raw|ConvertFrom-Json;Write-Host "Netz: $($c.Network.Mode) $($c.Network.PreferredCidr), Port $($c.Network.Port)";Write-Host "SharePoint: $($c.SharePoint.Mode) $($c.SharePoint.SiteUrl)"}
if(Test-Path $State){Write-Host "State:";Get-Content $State}
if(Test-Path $Queue){$q=@(Get-Content $Queue -Raw|ConvertFrom-Json);Write-Host "Sync Queue: $($q.Count)"}else{Write-Host "Sync Queue: 0"}

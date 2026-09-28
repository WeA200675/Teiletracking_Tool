param([switch]$Install,[switch]$Uninstall)
$ErrorActionPreference="Stop"
$task="Teiletracking Watchdog"
$script=Join-Path $PSScriptRoot "Watch-Teiletracking.ps1"
if($Uninstall){Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue;Write-Host "Watchdog-Autostart entfernt.";exit}
if(-not $Install){Write-Host "Mit -Install als Windows-Autostart einrichten oder -Uninstall entfernen.";exit}
$action=New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$trigger=New-ScheduledTaskTrigger -AtLogOn
$settings=New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -Description "Ueberwacht Teiletracking Webserver und lokale IP" -Force|Out-Null
Write-Host "Watchdog startet kuenftig bei Windows-Anmeldung." -ForegroundColor Green

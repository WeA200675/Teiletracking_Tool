param([switch]$CreateDesktopShortcut)
$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $PSScriptRoot
$Runtime=Join-Path $Root ".teiletracking"
New-Item -ItemType Directory -Force $Runtime|Out-Null
Write-Host "=== Teiletracking Setup & Control Center ===" -ForegroundColor Cyan
Write-Host "Projekt: $Root"
if(-not(Get-Command python -ErrorAction SilentlyContinue) -and -not(Get-Command py -ErrorAction SilentlyContinue)){Write-Warning "Python 3 fehlt; lokaler Webserver kann noch nicht starten."}
& (Join-Path $PSScriptRoot "Start-Teiletracking.ps1") -Setup -NoBrowser
if($CreateDesktopShortcut){
    $desktop=[Environment]::GetFolderPath("Desktop");$shortcut=Join-Path $desktop "Teiletracking.lnk"
    $shell=New-Object -ComObject WScript.Shell;$s=$shell.CreateShortcut($shortcut)
    $s.TargetPath="powershell.exe";$s.Arguments="-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\Start-Teiletracking.ps1`"";$s.WorkingDirectory=$Root;$s.IconLocation="shell32.dll,14";$s.Save()
    Write-Host "Desktop-Verknuepfung erstellt: $shortcut" -ForegroundColor Green
}
Write-Host "Einrichtung abgeschlossen." -ForegroundColor Green
Write-Host "Normaler Start: .\control-center\Start-Teiletracking.ps1"
Write-Host "Admin-Setup: .\control-center\Start-Teiletracking.ps1 -Setup"
Write-Host "Watchdog: .\control-center\Watch-Teiletracking.ps1"

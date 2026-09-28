# Teiletracking Setup & Control Center

Lokale Windows-Betriebs- und Einrichtungsumgebung fuer Teiletracking.

## Erste Einrichtung

In PowerShell im Projektordner:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\control-center\Install-ControlCenter.ps1 -CreateDesktopShortcut
```

Der Assistent fragt Test-IP-Bereich (CIDR), optionale Netzwerkschnittstelle, Port und SharePoint-Ziel ab.

## Normalbetrieb

```powershell
.\control-center\Start-Teiletracking.ps1
```

Die Einrichtungsparameter werden im Normalbetrieb nicht angezeigt. Der administrative Setup-Modus ist nur explizit erreichbar:

```powershell
.\control-center\Start-Teiletracking.ps1 -Setup
```

Status/Stop:

```powershell
.\control-center\Start-Teiletracking.ps1 -Status
.\control-center\Start-Teiletracking.ps1 -Stop
```

## Netzwerkueberwachung

```powershell
.\control-center\Watch-Teiletracking.ps1
```

Der Watchdog prueft den lokalen Webserver, ermittelt die IPv4-Adresse im konfigurierten Bereich neu und versucht bei Serverausfall einen Neustart. Laufzeitdaten liegen nur lokal unter `.teiletracking/`.

## SharePoint

Die Einrichtung speichert Site-URL, Listenmapping und optional eine von der IT vorgegebene ClientId. Keine Kennwoerter oder Zugriffstokens werden gespeichert. MANUAL konfiguriert das Ziel, startet aber noch keine automatische Synchronisation. Die echte Authentifizierung sowie Sync-/Fallback-Logik wird erst an den in der Zielumgebung erlaubten SharePoint-Zugriffsweg gebunden.

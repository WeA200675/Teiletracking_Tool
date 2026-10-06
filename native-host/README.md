# Teiletracking Native Windows Host

Dieser Host stellt den lokalen Webprototyp bereit. Netzwerkzugriff ist standardmäßig deaktiviert.

## Ziel

- keine Änderung der PowerShell Execution Policy
- kein lokal installiertes Python oder Node.js
- selbstenthaltene Windows-x64-Anwendung
- integrierter Kestrel-Webserver
- automatische Erkennung aktiver IPv4-Schnittstellen
- lokale Konfiguration unter `%LOCALAPPDATA%\Teiletracking\config.json`
- Control Center nur über Loopback: `http://127.0.0.1:8000/control-center`
- dauerhafte lokale Sync-Queue und SHA-256-Fallback-Pakete

## Build

Der GitHub-Workflow **Native Windows Build** veröffentlicht eine selbstenthaltene ZIP-Datei. Auf dem Ziel-PC muss kein .NET SDK/Runtime installiert sein.

Für Entwickler:

```text
dotnet publish native-host/Teiletracking.Host.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist
```

## Start auf dem Ziel-PC

ZIP entpacken und `Teiletracking.exe` per Doppelklick starten. Es wird keine PowerShell-Ausführungsrichtlinie geändert. Beim ersten Start öffnet sich das lokale Control Center.

## Netzwerk und Anmeldung

Der sichere Standard ist Loopback-only: HTTP lauscht nur auf `127.0.0.1`. Die bevorzugte Netzwerkschnittstelle bestimmt keine Netzwerkfreigabe.

Ein Netzwerkzugriff wird nur geöffnet, wenn alle Voraussetzungen erfüllt sind:

1. `network.remoteAccessEnabled` ist explizit aktiviert.
2. HTTPS ist aktiviert und ein gültiges PFX-Zertifikat mit privatem Schlüssel ist vorhanden.
3. `TEILETRACKING_PFX_PASSWORD` enthält das PFX-Kennwort.
4. `TEILETRACKING_ACCESS_PASSWORD` ist gesetzt und mindestens 20 Zeichen lang.
5. Die konfigurierte Netzwerkschnittstelle liefert eine IPv4-Adresse.

Der entfernte Listener bindet ausschließlich an diese ausgewählte IPv4-Adresse und ausschließlich per HTTPS. Fehlt eine Voraussetzung oder ist das Zertifikat ungültig/abgelaufen, bleibt der Listener geschlossen. HTTP bleibt auf Loopback. Anmeldungen werden pro Quell-IP begrenzt; Sessions sind acht Stunden gültig und verwenden ein HttpOnly-/Secure-/SameSite-Cookie. Schreibende HTTP-Anfragen ohne passende Origin werden abgewiesen. Queue-Eingaben sind größen- und tiefenbegrenzt.

Zertifikate müssen auf den Smartphones als vertrauenswürdig gelten. Ein beliebiges selbstsigniertes Zertifikat genügt dafür nicht. Das Control Center ist nur lokal erreichbar. Einstellungen werden nach einem Neustart aktiv.

## SharePoint

Der Verbindungstest sendet nur eine HEAD-Anfrage über HTTPS, folgt keinen Redirects und ist auf explizit freigegebene Hostnamen begrenzt. Die Hostnamen werden kommasepariert in `TEILETRACKING_SHAREPOINT_ALLOWED_HOSTS` gesetzt.

Direkte authentifizierte M365-Schreibzugriffe werden nicht vorgetäuscht: Dafür muss die konkrete, vom Unternehmens-Tenant freigegebene Authentifizierung feststehen (z. B. App-Registrierung/Client-ID und Consent). Bis dahin bleiben Datensätze lokal und können als Fallback-Paket exportiert werden. SharePoint bleibt standardmäßig deaktiviert.

## Lokale Daten

Die Queue und Fallback-Pakete liegen unter `%LOCALAPPDATA%\Teiletracking`. Tracking-Datensätze werden im Browserprofil gespeichert und können vertrauliche Gerätewerte enthalten. Der Datenservice enthält IndexedDB-Bildspeicherfunktionen, die die Haupt-App aktuell nicht aufruft; ein Test schützt dieses Verhalten. Browserdaten- und Geräteaufbewahrung bleiben Teil der betrieblichen Lösch- und Datenschutzregelung.

## Datenintegrität

Queue-Schreibvorgänge erfolgen über eine temporäre Datei und anschließendes Ersetzen. Fallback-Pakete enthalten Batch-ID, Zeitstempel und SHA-256 des eingebetteten Payloads. SHA-256 schützt die Integrität, beweist aber keine Urheberschaft.

## Unternehmensumgebung

Windows Firewall, Client-Isolation, Zertifikatsverteilung und Anwendungsfreigaben können zentral durch IT gesteuert sein. Der Host versucht nicht, diese Richtlinien zu umgehen oder Firewall-/Netzwerkeinstellungen eigenmächtig zu verändern. Vor einem Unternehmenseinsatz müssen BMW Security und Betrieb den Authentifizierungs-, Netzwerk-, Zertifikats- und Updatepfad freigeben.

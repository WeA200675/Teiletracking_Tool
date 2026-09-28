# Teiletracking Native Windows Host

Dieser Host ersetzt den bisherigen Python-/PowerShell-Startpfad für den normalen Betrieb.

## Ziel

- keine Änderung der PowerShell Execution Policy
- kein lokal installiertes Python oder Node.js
- selbstenthaltene Windows-x64-Anwendung
- integrierter Kestrel-Webserver
- automatische Erkennung aktiver IPv4-Schnittstellen
- lokale Konfiguration unter `%LOCALAPPDATA%\Teiletracking\config.json`
- Control Center nur über Loopback: `http://127.0.0.1:8000/control-center`
- Tracking über LAN: `http://<PC-IP>:8000/prototype/`
- optional HTTPS mit einem von der Organisation bereitgestellten PFX-Zertifikat
- dauerhafte lokale Sync-Queue und SHA-256-Fallback-Pakete

## Build

Der GitHub-Workflow **Native Windows Build** veröffentlicht eine selbstenthaltene ZIP-Datei. Auf dem Ziel-PC muss kein .NET SDK/Runtime installiert sein.

Für Entwickler:

```text
dotnet publish native-host/Teiletracking.Host.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist
```

## Start auf dem Ziel-PC

ZIP entpacken und `Teiletracking.exe` per Doppelklick starten. Es wird keine PowerShell-Ausführungsrichtlinie geändert. Beim ersten Start öffnet sich das lokale Control Center.

## Netzwerk

`MANUAL_RANGE` wählt nur eine bereits vorhandene IPv4-Adresse aus dem konfigurierten CIDR. Die Windows-Netzwerkkonfiguration wird nicht verändert. `AUTO` verwendet eine aktive IPv4-Schnittstelle. Der integrierte Monitor erkennt Adressänderungen.

Kestrel lauscht auf allen lokalen Adressen. Die Auswahl des bevorzugten Netzes bestimmt, welche Adresse im Status als Tracking-Adresse veröffentlicht wird.

## Smartphone und HTTPS

Browser-Kamerazugriff auf einem Smartphone benötigt einen sicheren Kontext. Für LAN-Betrieb ist deshalb ein Zertifikat nötig, dem das Smartphone vertraut. Ein beliebiges selbstsigniertes Zertifikat löst dieses Problem nicht zuverlässig.

Im Control Center können PFX-Pfad und HTTPS-Port konfiguriert werden. Das PFX-Passwort wird **nicht** in JSON gespeichert. Es wird aus der Umgebungsvariable `TEILETRACKING_PFX_PASSWORD` gelesen.

Nach einer HTTPS-/Portänderung muss die Anwendung neu gestartet werden.

## SharePoint

Die Modi `DISABLED`, `MANUAL`, `PACKAGE` und `AUTO_FALLBACK` können konfiguriert werden. Der integrierte Verbindungstest prüft zunächst nur Erreichbarkeit und HTTP-Status.

Direkte authentifizierte M365-Schreibzugriffe werden nicht vorgetäuscht: Dafür muss die konkrete, vom Unternehmens-Tenant freigegebene Authentifizierung feststehen (z. B. App-Registrierung/Client-ID und Consent). Bis dahin bleiben Datensätze lokal und können als Fallback-Paket exportiert werden.

## Datenintegrität

Queue-Schreibvorgänge erfolgen über eine temporäre Datei und anschließendes Ersetzen. Fallback-Pakete enthalten Batch-ID, Zeitstempel und SHA-256 des eingebetteten Payloads. SHA-256 schützt die Integrität, beweist aber keine Urheberschaft.

## Unternehmensumgebung

Windows Firewall, Client-Isolation, Zertifikatsverteilung und Anwendungsfreigaben können zentral durch IT gesteuert sein. Der Host versucht nicht, diese Richtlinien zu umgehen oder Firewall-/Netzwerkeinstellungen eigenmächtig zu verändern.

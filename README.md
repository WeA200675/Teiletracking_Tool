# Teiletracking Tool

Lokale Anwendung zur Erfassung und Verwaltung von Teilen und Steuergeräten. Die bestehende Oberfläche unterstützt QR-/OCR-Erfassung, Prüfung, Stammdatenpflege, Tracking-Historie sowie JSON-/CSV-Import und -Export.

## Aktueller Stand

Der native Windows-Host stellt eine lokale SQLite-Datenbank bereit. Die Datenbank liegt im Benutzerprofil unter `%LOCALAPPDATA%\Teiletracking\teiletracking.db`. Die Oberfläche kommuniziert mit ihr über die lokale HTTP-API des Hosts. Wird die Oberfläche ohne Host als statische Seite geöffnet, bleibt der bisherige Browser-Speicher aktiv.

Der Host bindet standardmäßig ausschließlich an `127.0.0.1`. Netzwerkzugriff ist abgeschaltet. Das WLAN- oder Domänennetz wird nicht automatisch verwendet. Der aktuelle Datenbankweg ist für lokale Erprobung vorgesehen; er ist noch keine Freigabe für den produktiven Einsatz oder für BMW-Daten.

## Start und Entwicklung

- Weboberfläche: `prototype/index.html`
- Windows-Host, lokaler Datenpfad und Build: [native-host/README.md](native-host/README.md)
- OCR-Datenschutz und Bildverarbeitung: [docs/ocr-privacy.md](docs/ocr-privacy.md)

Windows-Build:

```text
dotnet publish native-host/Teiletracking.Host.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist
```

Tests:

```powershell
./tests/Run-AllTests.ps1
```

```sh
node tests/Test-OcrPrivacy.js
```

## Datenübernahme

Vorhandene Datensätze können über die Importfunktion der Oberfläche als JSON eingelesen werden. Vor einer Übernahme sollte ein Export als Sicherung erstellt und der Import anhand der angezeigten Datensätze kontrolliert werden. Die Anwendung löscht die Importdatei nicht.

## Compliance und Daten

Dieses GitHub-Repository ist öffentlich. Deshalb dürfen weder echte Teile-/Fahrzeugdaten, personenbezogene Daten, Datenbankdateien, Migrationspakete, Screenshots mit Echtdaten noch Zugangsdaten oder Zertifikate eingecheckt werden. Nur synthetische Beispieldaten gehören in Tests.

Vor einem produktiven Einsatz müssen mindestens Datenklassifizierung und zulässiger Zweck, Berechtigungen, Aufbewahrung/Löschung, Verschlüsselung und Wiederherstellung, Updateprozess, Abhängigkeiten sowie erforderliche Datenschutz- und IT-Security-Freigaben geklärt sein. Es gibt derzeit keine zentrale Benutzer-/Rollenverwaltung, keinen revisionssicheren Änderungsnachweis und keine automatisierte Datenbanksicherung. Netzwerkzugriff bleibt deaktiviert, bis eine genehmigte Architektur und Konfiguration vorliegt.

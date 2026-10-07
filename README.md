# Teiletracking Tool

Lokale Anwendung zur Erfassung und Verwaltung von Teilen und Steuergeräten. Die bestehende Oberfläche unterstützt QR-/OCR-Erfassung, Prüfung, Stammdatenpflege, Tracking-Historie sowie JSON-/CSV-Import und -Export. Ein lokaler Verwaltungsbereich ermöglicht Sicherung, Wiederherstellung und Einsicht in ein begrenztes Änderungsprotokoll.

## Aktueller Stand

Der native Windows-Host stellt eine lokale SQLite-Datenbank bereit. Die Datenbank liegt im Benutzerprofil unter `%LOCALAPPDATA%\Teiletracking\teiletracking.db`. Die Oberfläche kommuniziert mit ihr über die lokale HTTP-API des Hosts. Wird die Oberfläche ohne Host als statische Seite geöffnet, bleibt der bisherige Browser-Speicher aktiv.

Der Host bindet ausschließlich an `127.0.0.1`; Netzwerkzugriff ist deaktiviert und wird nicht durch Konfiguration freigeschaltet. Das WLAN- oder Domänennetz wird nicht verwendet. Der Datenbankweg ist für lokale Erprobung vorgesehen und nicht für produktive Verarbeitung oder BMW-Daten freigegeben.

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
node tests/Test-DatabaseBackup.js
```

## Datenübernahme

Vorhandene Datensätze können über die Importfunktion der Oberfläche als JSON eingelesen werden. Vor dem Import eine Sicherung erstellen, den Import in der Vorschau prüfen und anschließend Datensatzanzahl sowie Stichproben vergleichen. Die Anwendung löscht die Importdatei nicht.

## Sicherung und Wiederherstellung

Vor jeder Datenbankänderung erstellt der Host einen lokalen Wiederherstellungspunkt. Es werden höchstens sieben dieser Punkte unter `%LOCALAPPDATA%\Teiletracking\automatic-backups` aufbewahrt. Sie sind unverschlüsselte Kopien auf demselben Rechner und schützen vor versehentlichen Änderungen, aber nicht vor Geräteverlust, Defekt oder Schadsoftware. Sie werden nicht automatisch auf ein anderes Medium übertragen.

Für eine manuelle Sicherung bietet das Control Center ein passwortgeschütztes Backup-Paket (AES-256-GCM, Schlüsselableitung mit PBKDF2-SHA-256 und 310.000 Iterationen). Das Passwort muss mindestens 16 Zeichen haben und getrennt vom Paket sicher aufbewahrt werden. Bei Verlust des Passworts ist das Paket nicht wiederherstellbar. Ein SHA-256-Prüfwert erkennt Beschädigung, bestätigt aber weder Herkunft noch Unverändertheit gegenüber einem Angreifer, der Paket und Prüfwert zusammen ändern kann. Wiederherstellung zeigt zunächst eine Vorschau, verlangt Bestätigung und verwirft die aktuelle Datenbank vollständig; eine Revisionsprüfung weist Änderungen seit der Vorschau zurück.

Die Notfallsicherung ohne Verschlüsselung ist ausdrücklich als Klartext gekennzeichnet. Vor dem produktiven Einsatz sind ein genehmigter, getrennter Sicherungsort und regelmäßige Wiederherstellungstests festzulegen. Die SQLite-Datenbank selbst ist nicht anwendungsseitig verschlüsselt; Geräteschutz und Datenträgerverschlüsselung müssen separat sichergestellt werden.

## Compliance und Daten

Dieses GitHub-Repository ist öffentlich. Deshalb dürfen weder echte Teile-/Fahrzeugdaten, personenbezogene Daten, Datenbankdateien, Migrationspakete, Screenshots mit Echtdaten noch Zugangsdaten oder Zertifikate eingecheckt werden. Nur synthetische Beispieldaten gehören in Tests.

Das lokale Änderungsprotokoll speichert begrenzt Operation, Zeitpunkt, Anzahl und Hash, jedoch keine Datensatzinhalte oder Benutzeridentität. Es ist lokal und nicht manipulationssicher; es erfüllt keine Anforderungen an einen revisionssicheren Nachweis. Es gibt keine Benutzer-/Rollenverwaltung.

Vor einem produktiven Einsatz müssen mindestens Datenklassifizierung und zulässiger Zweck, Berechtigungen, Aufbewahrung/Löschung, Verschlüsselung, Sicherungsort und Wiederherstellung, Updateprozess, Abhängigkeiten sowie erforderliche Datenschutz- und IT-Security-Freigaben geklärt sein. Netzwerkzugriff bleibt deaktiviert.

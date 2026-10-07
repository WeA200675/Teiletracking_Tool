# Teiletracking Native Windows Host

Der Host liefert die Weboberfläche aus und speichert Anwendungsdaten lokal in einer SQLite-Datenbank.

## Aktueller Funktionsumfang

- selbstenthaltene Windows-x64-Anwendung mit integriertem Kestrel-Webserver
- Datenbankdatei unter `%LOCALAPPDATA%\Teiletracking\teiletracking.db`
- getrennte Tabellen für Anwendungszustand und Tracking-Datensätze
- transaktionales Speichern der Datensatzliste und Revisionsprüfung gegen parallele Änderungen
- vorhandene Erfassungs-, Such-, Filter-, Stammdaten-, Import- und Exportfunktionen der Oberfläche
- keine dauerhafte Speicherung der aufgenommenen Label-Fotos durch die Hauptanwendung

Das ist ein erster lokaler Datenbankstand. Ein eigenständiger Verwaltungsbereich mit Änderungsprotokoll, Konten/Rollen, automatischer Sicherung und Wiederherstellungsablauf ist noch nicht implementiert.

## Build

Der GitHub-Workflow **Native Windows Build** erstellt ein selbstenthaltenes ZIP. Für den Build lokal wird das .NET 10 SDK benötigt:

```text
dotnet publish native-host/Teiletracking.Host.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist
```

Auf dem Ziel-PC muss keine .NET Runtime installiert werden.

## Start und Netzwerk

ZIP entpacken und `Teiletracking.exe` starten. Der Host öffnet das lokale Control Center. Der Standardlistener verwendet ausschließlich `http://127.0.0.1:8000`; damit ist die Anwendung nur auf demselben Rechner erreichbar.

Die Einstellung `network.remoteAccessEnabled` ist standardmäßig `false`. Eine eventuell konfigurierte WLAN- oder Netzwerkschnittstelle wird nicht automatisch freigeschaltet. Keine Firewall-, Router-, WLAN- oder Domäneneinstellungen für diese Anwendung eigenmächtig ändern. Eine spätere Nutzung mit mehreren Geräten erfordert zunächst die Freigabe einer konkreten Netzwerk-, Authentifizierungs- und Zertifikatsarchitektur durch die zuständige IT.

## Datenbank und Übernahme

Die SQLite-Datei wird auf einem lokalen Datenträger im Benutzerprofil gespeichert. Sie darf nicht auf ein Netzlaufwerk, einen synchronisierten Ordner oder einen gemeinsam genutzten Ordner verschoben werden. SQLite ist hier als Einzelrechner-Datenbank vorgesehen.

Die API stellt Stammdaten und Tracking-Datensätze für die bestehende Oberfläche bereit. Beim Speichern der Tracking-Liste wird die Änderung in einer SQLite-Transaktion geschrieben. Eine Revisionsnummer weist veraltete Schreibstände zurück; bei einem Konflikt muss die Oberfläche neu geladen werden.

Vorhandene Browserdaten können über die JSON-Importfunktion der Oberfläche eingespielt werden. Für einen sicheren Übernahmeablauf zuerst exportieren, Datei auf Echtdaten prüfen, importieren und anschließend die Anzahl sowie Stichproben kontrollieren. Das ist noch kein automatischer oder revisionssicherer Migrationsworkflow.

## Sicherheit und Compliance

- Nur mit synthetischen Testdaten entwickeln, solange keine Freigabe zur Verarbeitung echter Betriebsdaten vorliegt.
- Das Quellrepository ist öffentlich. Niemals Datenbankdateien, echte Export-/Importpakete, Screenshots mit Echtdaten, personenbezogene Daten, Tokens, Kennwörter oder Zertifikate committen.
- Auf Loopback gibt es keine getrennte Benutzeranmeldung; Zugriffsschutz basiert auf dem angemeldeten Windows-Benutzer und dessen Geräteschutz.
- Die SQLite-Datei wird derzeit nicht anwendungsseitig verschlüsselt. Windows-Geräteverschlüsselung und Zugriffsschutz des Benutzerprofils sind durch den Geräteverantwortlichen zu prüfen.
- Es gibt noch keine automatische Sicherung oder geprüfte Wiederherstellung.
- Es gibt kein revisionssicheres Änderungsprotokoll und keine Rollen-/Berechtigungsverwaltung in der Anwendung.
- Aufbewahrungs- und Löschregeln, Klassifizierung, Datenschutz, Security, Betrieb und Drittanbieterabhängigkeiten sind vor produktiver Nutzung zu prüfen.
- Label-Fotos werden von der Hauptanwendung nicht dauerhaft in SQLite gespeichert. Browserprofile und manuell exportierte Dateien können dennoch lokale Daten enthalten.


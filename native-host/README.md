# Teiletracking Native Windows Host

Der Host liefert die Weboberfläche aus und speichert Anwendungsdaten lokal in einer SQLite-Datenbank.

## Aktueller Funktionsumfang

- selbstenthaltene Windows-x64-Anwendung mit integriertem Kestrel-Webserver
- Datenbankdatei unter `%LOCALAPPDATA%\Teiletracking\teiletracking.db`
- getrennte Tabellen für Anwendungszustand und Tracking-Datensätze
- transaktionales Speichern und Revisionsprüfung gegen parallele oder veraltete Änderungen
- vorhandene Erfassungs-, Such-, Filter-, Stammdaten-, Import- und Exportfunktionen der Oberfläche
- lokales Control Center mit Datenbankstatus, Sicherung, Wiederherstellungsvorschau und begrenztem Änderungsprotokoll
- vor jeder Datenänderung ein automatischer lokaler Wiederherstellungspunkt, maximal sieben Kopien
- manuelles, passwortgeschütztes Backup-Paket und Wiederherstellung mit Vorschau/Bestätigung
- keine dauerhafte Speicherung der aufgenommenen Label-Fotos durch die Hauptanwendung

## Build

Der GitHub-Workflow **Native Windows Build** erstellt ein selbstenthaltenes ZIP. Für den Build lokal wird das .NET 10 SDK benötigt:

```text
dotnet publish native-host/Teiletracking.Host.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist
```

Auf dem Ziel-PC muss keine .NET Runtime installiert sein.

## Start und Netzwerk

ZIP entpacken und `Teiletracking.exe` starten. Der Host öffnet das lokale Control Center. Der Listener verwendet ausschließlich `http://127.0.0.1:8000`; damit ist die Anwendung nur auf demselben Rechner erreichbar. Die Anwendung konfiguriert keine Firewall- oder WLAN-Freigaben.

Netzwerkzugriff ist im Host fest deaktiviert. Keine Firewall-, Router-, WLAN- oder Domäneneinstellungen für diese Anwendung ändern. Mehrgerätebetrieb braucht eine neu geprüfte und genehmigte Architektur mit Authentifizierung, Berechtigungen, TLS und Betriebskonzept.

## Datenbank und Übernahme

Die SQLite-Datei wird auf einem lokalen Datenträger im Benutzerprofil gespeichert. Sie darf nicht auf ein Netzlaufwerk, einen synchronisierten Ordner oder einen gemeinsam genutzten Ordner verschoben werden. SQLite ist hier als Einzelrechner-Datenbank vorgesehen.

Beim Speichern prüft die API eine Revisionsnummer und weist veraltete Schreibstände mit HTTP 409 zurück. Die Oberfläche kann anschließend neu laden. Vorhandene Browserdaten können über die JSON-Importfunktion eingespielt werden. Vor dem Import sichern, Vorschau prüfen und danach Anzahl sowie Stichproben vergleichen.

## Sicherung und Wiederherstellung

Vor jeder schreibenden Datenbankoperation legt der Host einen unverschlüsselten Wiederherstellungspunkt in `%LOCALAPPDATA%\Teiletracking\automatic-backups` an. Die letzten sieben Kopien bleiben lokal erhalten. Der Control Center-Bereich ermöglicht den Download. Weil die Kopien auf demselben Datenträger liegen, sind sie nur für lokale Fehler und versehentliche Änderungen geeignet, nicht für Geräteverlust oder Katastrophenwiederherstellung.

Das manuelle Backup ist ein passwortgeschütztes Paket mit AES-256-GCM und PBKDF2-SHA-256 (310.000 Iterationen). Mindestens 16 Zeichen Passwort sind erforderlich. Passwort und Paket müssen getrennt verwahrt werden; ohne Passwort ist keine Wiederherstellung möglich. Die Prüfsumme erkennt zufällige Beschädigung, ist aber keine Signatur und kein Herkunftsnachweis. Eine Klartext-Notfallsicherung wird als unverschlüsselt markiert.

Die Wiederherstellung validiert und zeigt den Inhalt vorab an. Nach expliziter Bestätigung ersetzt sie die Datenbank in einer Transaktion. Wenn sich die Datenbank seit der Vorschau geändert hat, wird der Vorgang abgewiesen. Für produktiven Betrieb braucht es einen freigegebenen getrennten Sicherungsort und dokumentierte, regelmäßig getestete Wiederherstellung.

## Sicherheit und Compliance

- Das Quellrepository ist öffentlich. Niemals Echtdaten, Datenbankdateien, echte Export-/Importpakete, Screenshots mit Echtdaten, personenbezogene Daten, Tokens, Kennwörter oder Zertifikate committen.
- API und UI sind auf Loopback beschränkt. Der Host hat keine getrennte Benutzeranmeldung; Zugriffsschutz basiert auf dem angemeldeten Windows-Benutzer und dessen Geräteschutz.
- Die SQLite-Datei und automatische Wiederherstellungspunkte sind nicht anwendungsseitig verschlüsselt. Windows-Geräte- und Datenträgerverschlüsselung sowie ACLs des Benutzerprofils müssen separat geprüft werden.
- Das Änderungsprotokoll ist begrenzt, lokal und nicht manipulationssicher. Es protokolliert keine Benutzeridentität und ist kein revisionssicherer Nachweis.
- Es gibt keine Rollen-/Berechtigungsverwaltung, zentrale Administration oder genehmigte Mehrbenutzerfunktion.
- Zweck, Datenklassifizierung, Aufbewahrungs- und Löschregeln, Datenschutz, Security, Betrieb, Backup-Ziel und Drittanbieterabhängigkeiten müssen vor produktiver Nutzung geprüft und freigegeben werden.
- Label-Fotos werden von der Hauptanwendung nicht dauerhaft in SQLite gespeichert. Browserprofile und manuell exportierte Dateien können dennoch lokale Daten enthalten.

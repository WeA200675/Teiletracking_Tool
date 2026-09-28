# Abnahmetest Windows

1. GitHub Actions: **Native Windows Build** ausführen bzw. Build von `main` verwenden.
2. Artefakt `Teiletracking-Windows-x64` herunterladen und ZIP lokal entpacken.
3. `Teiletracking.exe` per Doppelklick starten.
4. Prüfen: Browser öffnet `http://127.0.0.1:8000/control-center`.
5. Unter Netzwerk den aktiven Adapter und CIDR auswählen, speichern, Anwendung neu starten.
6. Prüfen: `http://127.0.0.1:8000/health` liefert Status `ok`.
7. Tracking lokal über `http://127.0.0.1:8000/prototype/` öffnen.
8. Von einem zweiten Gerät im erlaubten Netz die angezeigte PC-IP testen. Falls blockiert, Windows-/Unternehmens-Firewall durch IT prüfen lassen.
9. Für Smartphone-Kamera HTTPS mit einem vertrauenswürdigen Unternehmenszertifikat konfigurieren.
10. SharePoint zunächst auf `DISABLED` oder `PACKAGE` lassen. Danach Site URL eintragen und Erreichbarkeit testen.
11. Authentifizierten SharePoint-Sync erst aktivieren, wenn die zulässige Tenant-Authentifizierung bekannt/freigegeben ist.

Die alten PowerShell-Dateien bleiben vorerst als Diagnose-/Migrationswerkzeuge im Repository, sind aber nicht mehr Voraussetzung für den normalen Start.

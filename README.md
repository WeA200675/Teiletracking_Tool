# Teiletracking Tool

Prototyp für Teiletracking, QR-/OCR-Erfassung, lokale Queue und SharePoint-Migrationswerkzeuge.

> **Betriebsstatus:** Der aktuelle Stand ist nicht für produktive BMW-Daten freigegeben. Vor einem Einsatz in BMW-Umgebungen müssen die Rechte-, Datenschutz-, Security-, OSS- und Betriebsfreigaben aus [docs/ghe-migration-compliance.md](docs/ghe-migration-compliance.md) abgeschlossen sein. Der native Windows-Host stellt LAN-Endpunkte ohne Anmeldung bereit und verwendet öffentliche CDN-Skripte; beide Punkte sind Freigabegates.

## Lokaler Einstieg

- Webprototyp: `prototype/index.html`
- Windows-Host und Build: [native-host/README.md](native-host/README.md)
- PowerShell-/Control-Center-Ablauf: [control-center/README.md](control-center/README.md)
- OCR-Datenschutzbeschreibung: [docs/ocr-privacy.md](docs/ocr-privacy.md)
- GHE-/Compliance-Übergabe: [docs/ghe-migration-compliance.md](docs/ghe-migration-compliance.md)

Tests:

```powershell
./tests/Run-AllTests.ps1
```

```sh
node tests/Test-OcrPrivacy.js
```

## GHE-Migration

Workflows sind für GitHub.com und GitHub Enterprise Server vorbereitet; der native Windows Build wählt die passende Artifact-Action anhand von `github.server_url`. Für den Zielbetrieb gelten die GHE-Admin-Regeln und Freigabegates in der Übergabedokumentation. Eine konkrete Zielorganisation und ein Zielrepository sind dort noch durch BMW Repository-Verantwortliche festzulegen.

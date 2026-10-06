# Teiletracking Tool

Prototyp für Teiletracking, QR-/OCR-Erfassung, lokale Queue und SharePoint-Migrationswerkzeuge.

> **Betriebsstatus:** Nicht für produktive BMW-Daten freigegeben. Der native Host ist standardmäßig Loopback-only; Netzwerkzugriff erfordert eine explizite Aktivierung mit HTTPS-Zertifikat und starkem Kennwort. Vor einem BMW-Einsatz müssen Rechte-, Datenschutz-, Security-, OSS- und Betriebsfreigaben aus [docs/ghe-migration-compliance.md](docs/ghe-migration-compliance.md) abgeschlossen sein.

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

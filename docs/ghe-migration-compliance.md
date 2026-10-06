# GHE-Migrations- und Compliance-Übergabe

Stand der Prüfung: 2026-10-06  
Quellrepository: https://github.com/WeA200675/Teiletracking_Tool  
Geprüfter Ausgangs-Commit: `e9fbb50d56d4f5f6a44acb96a6138a3b813c8767` (Branch `main`)  
Ziel: GitHub Enterprise Server unter `ghe.bmw.de` (konkrete Zielorganisation/Repository noch durch BMW-Repository-Verantwortliche festzulegen).

## Ergebnis

**Status: NICHT FREIGABEFÄHIG für produktive BMW-Daten oder produktiven Betrieb.** Diese Änderung bereitet Repository und CI auf den Transfer vor. Sie ist keine BMW-Rechts-, Datenschutz-, Informationssicherheits- oder Betriebsfreigabe.

Kritische technische Sperre: Der native Host bindet HTTP/HTTPS an alle lokalen Netzwerkschnittstellen. Die Browser-App und API-Endpunkte für Queue-Schreiben und Fallback-Export sind ohne Anmeldung erreichbar. Die SharePoint-Konfigurationsendpunkte sind nur auf Loopback beschränkt. Vor produktivem Einsatz muss BMW Security/Architektur einen freigegebenen Authentifizierungs-, Transport- und Netzwerk-Schutzpfad festlegen und testen. Die Freigabe allein des Git-Transfers hebt diese Sperre nicht auf.

## Bereits vorbereitet

- Actions in den zwei vorhandenen Workflows sind auf unveränderliche Commit-SHAs festgelegt; die ursprünglichen Versions-Tags stehen als Kommentare daneben.
- Der native Build nutzt auf GitHub.com `upload-artifact@v4.6.2` und auf GitHub Enterprise Server `upload-artifact@v3.2.2-node20`, jeweils SHA-gepinnt. Diese Plattformtrennung ist erforderlich, weil die v4+-Reihe laut Upstream-Aktionsdokumentation derzeit nicht auf GHES unterstützt wird.
- Least-privilege `contents: read` blieb für die Workflows erhalten.
- Diese Übergabe beschreibt Daten-, Lizenz-, Sicherheits-, Betriebs- und Migrationsprüfungen und enthält eine PR-Checkliste.

## Freigabegates – vor Import/Zusammenführung abzuschließen

### 1. Rechte, Herkunft und Open Source

- [ ] Rechteinhaber und Beschäftigungs-/Auftragskontext für alle Beiträge klären; dokumentierte Übertragung oder Freigabe für BMW einholen.
- [ ] Keine Lizenzdatei ist im Ausgangsrepository vorhanden. Eine geeignete interne Lizenz-/Nutzungsregelung vom Rechteinhaber und BMW Legal festlegen; keine Lizenz automatisch ergänzen.
- [ ] Git-Historie und Beiträge auf fremde/übernommene Quellen prüfen. Öffentliche Sichtbarkeit des Repositories ist keine Nutzungslizenz.
- [ ] Sämtliche Komponenten inventarisieren: Laufzeit-CDNs (`jsqr`, `zxing-wasm`), .NET self-contained Runtime, PnP.PowerShell/SharePoint-Bezug sowie eingebettete oder kopierte Dateien. Exakte Versionen, Herkunft, Lizenztexte/Notices und CVEs in einer SBOM festhalten.
- [ ] BMW OSS/Legal-Freigabe und geforderte Notices/Attribution im Repository ergänzen.

### 2. Geheimnisse, Daten und Datenschutz

- [ ] Vor dem Transfer vollständige Git-Historie und alle Referenzen scannen (Secrets, Schlüssel, Zertifikate, Tokens, personenbezogene Daten und vertrauliche BMW-Informationen); Treffer bereinigen und ggf. kompromittierte Zugangsdaten rotieren.
- [ ] Inhalt aller Test-/Beispieldaten durch Datenverantwortliche als synthetisch und freigegeben bestätigen. Aktuelle Fixtures enthalten beispielhafte Teile-/Seriennummern sowie Produkt-/Projektcodes; nicht ohne fachliche Freigabe als synthetisch einstufen.
- [ ] Zweck, Datenkategorien, Betroffene, Speicherorte, Aufbewahrung/Löschung, Zugriff und Verantwortliche für Seriennummern, QR/OCR, Fotos, Queue, Logs und Exportpakete dokumentieren.
- [ ] Prüfen, ob Kamerabilder/OCR, Browserdaten, LocalStorage, logs, Fallback-Pakete oder Importe reale Werte persistieren. Keine realen Daten in Fixtures, Issues, Testreports oder CI-Artefakten.
- [ ] Datenschutzbeauftragte/r und zuständige Informationsklassifizierung einbeziehen; erforderliche DSFA/Verarbeitungsverzeichnis-Einträge klären.

### 3. Anwendungssicherheit – produktionsblockierend

- [ ] Authentifizierung/Autorisierung für LAN-App und mutierende APIs festlegen und umsetzen. Im aktuellen Stand kann insbesondere `POST /api/queue` ohne Anmeldung auf dem LAN Daten annehmen; `POST /api/sync/export` kann Queue-Daten ausleiten.
- [ ] HTTPS verpflichtend und BMW-zertifikatsgestützt betreiben; Klartext-HTTP auf Netzwerkschnittstellen vermeiden. Kein Smartphone-/Produktivbetrieb über HTTP.
- [ ] Sichere Browser-Header/CSP, CSRF-/Origin-Absicherung, Eingabegrößen/-validierung, Rate Limits und Protokollierung mit Datenschutz prüfen.
- [ ] Netzwerkbindung, Firewall und Zugriff nur für genehmigte Clients/Segmente in BMW Testumgebung absichern.
- [ ] Bedrohungsmodell und Sicherheitsprüfung für C# Host, Browser-App, PowerShell-Installations-/Migrationsskripte und SharePoint-Import durchführen.
- [ ] Security-Test inkl. nicht angemeldeter Zugriffe, fremdem Origin, Queue-Missbrauch, Export, Konfigurationszugriff und Fehlerfällen als CI/Abnahme dokumentieren.

### 4. Drittanbieter-Laufzeitcode

- [ ] `prototype/index.html` und `prototype/label-trainer.html` laden JavaScript/WASM von `cdn.jsdelivr.net`. Das bindet den Betrieb an einen öffentlichen CDN und führt fremden Code zur Laufzeit aus.
- [ ] BMW-seitig genehmigte Strategie wählen: intern gespiegelt/gescannt und versionsfixiert, freigegebene Paketregistrierung, oder genehmigte Internet-Freigabe. Subresource Integrity allein schützt nur unveränderte Bytes und ersetzt keine OSS-/Netzfreigabe.
- [ ] Exakte Artefakt-Hashes, Lizenznachweise und Vulnerability Scan dokumentieren. Bei Offlinebetrieb einen geprüften lokalen Fallback bereitstellen.
- [ ] Keine externen Fonts, Skripte oder sonstige Browser-Endpunkte ohne Netzwerk-/Datenschutzfreigabe zulassen.

### 5. GHE-Repository und CI-Betrieb

- [ ] Ziel-Owner/Organisation, Repositoryname, interne Sichtbarkeit, Teams/Owner, CODEOWNERS und Branch-Protection durch GHE-Verantwortliche festlegen.
- [ ] GHES-Version, Runner-Betriebssysteme/Labels, installierte Node-Runtimes und Aktionsrichtlinien prüfen. Workflows benötigen Linux-Runner mit Node 22/PowerShell 7 und Windows-Runner mit .NET SDK 8.
- [ ] Gepinnte Actions und alle transitiven Aktionen im GHE-Actions-Allowlist-/Mirror-Prozess freigeben. Keine ungeprüften Actions aus externen Repositories zulassen.
- [ ] Artifact-Aufbewahrung, Zugriff und Löschfristen in GHES festlegen; Artefakt enthält selbstenthaltene Windows-Binaries.
- [ ] Geheimnisscan, Code-/Dependency-Scan, Lizenzprüfung, SBOM-Erstellung und Build-Provenienz gemäß BMW-Standard als erforderliche PR-Gates konfigurieren.
- [ ] Mindestens zwei unabhängige Reviewer, verpflichtende Statuschecks, keine direkten Pushes auf geschützte Branches und signierte Releases konfigurieren.
- [ ] PowerShell-Modulquellen und Versionen fixieren/allowlisten; Installation gegen genehmigte PSGallery-/intern gespiegelte Quelle testen.
- [ ] Build/Tests auf dem Ziel-GHES ausführen. Vor erfolgreichem Zieltest ist GHES-Kompatibilität nur vorbereitet, nicht nachgewiesen.

### 6. Öffentliche Quelle und Deployments

- [x] Öffentliche Pages-App am 2026-10-06 zurückgezogen und Pages-Quelle auf `None` gesetzt. GitHub bestätigt: „GitHub Pages is currently disabled“.
- [x] Pages-Neubuilds sind deaktiviert. Die frühere Live-Seite war die Teiletracking-Webapp unter `https://wea200675.github.io/Teiletracking_Tool/prototype/`.
- [ ] Das Quellrepository und seine Git-Historie bleiben öffentlich. Eigentümer und BMW Kommunikation/Legal müssen vor dem GHE-Import über Privatstellung, Verbleib oder Archivierung des öffentlichen Quellrepos entscheiden. Das Abschalten von Pages entfernt keine bereits geklonten Kopien oder Git-Historie.
- [ ] Vor dem internen Import öffentliche Git-Historie genauso scannen wie den aktuellen Stand. Bei sensiblen historischen Inhalten Git-Historie bereinigen und exponierte Geheimnisse rotieren.

## Empfohlene Transferabfolge

1. Obige Gates 1–4 mit Rechteinhaber, BMW Legal, Informationssicherheit und Datenschutz klären.
2. Quellhistorie offline oder in genehmigter Umgebung mirror-klonen; Referenzen/Tags, Git LFS, Submodule und Releases inventarisieren. Secrets-/Datenprüfung über alle Commits ausführen.
3. GHE-Repository als **privat/intern** mit genehmigter Owner-/Teamstruktur anlegen; Regeln und Actions-Allowlist vor dem ersten Build setzen.
4. Nur freigegebene Historie übertragen. Wenn Vollhistorie genehmigt ist: Mirror push verwenden; Issues, Pull Requests, Wikis, Pages, Actions-Secrets/Variables, Releases und Artefakte sind separat zu behandeln und werden nicht durch `git push --mirror` übertragen.
5. Actions auf GHES ausführen und Ergebnisse prüfen; SBOM, Lizenz-/Security-Scans und Windows-Artefakt revisionsfähig ablegen.
6. Anwendung in isolierter BMW Testumgebung mit synthetischen Daten und genehmigter Authentifizierung abnehmen.
7. Erst nach schriftlicher Freigabe durch Rechteinhaber, BMW OSS/Legal, Informationssicherheit, Datenschutz und Produkt-/Betriebsverantwortliche produktive Daten bzw. Nutzer zulassen.

## Quellen für plattformabhängige Action-Pins

Die unveränderlichen SHA-Pins wurden aus den Upstream-Git-Refs der genannten Versionstags abgeleitet und sollten durch den GHE-Actions-Allowlist-Prozess geprüft werden:

- `actions/checkout@v4.2.2` → `11bd71901bbe5b1630ceea73d27597364c9af683`
- `actions/setup-node@v4.4.0` → `49933ea5288caeca8642d1e84afbd3f7d6820020`
- `actions/setup-dotnet@v4.3.1` → `67a3573c9a986a3f9c594539f4ab511d57bb3ce9`
- GitHub.com: `actions/upload-artifact@v4.6.2` → `ea165f8d65b6e75b540449e92b4886f43607fa02`
- GHES: `actions/upload-artifact@v3.2.2-node20` → `c6a3b2bd78b3985e4b2f15397fec357f0fd808de`

Die GHES-spezifische v3.2.2-node20-Variante steht unter Upstream-Pflegehinweis; BMW Security/Actions-Verantwortliche müssen deren weitere Zulässigkeit gegen die konkrete GHES-Version prüfen.

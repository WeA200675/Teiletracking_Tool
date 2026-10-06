# Datenschutz und OCR-Verarbeitung

## Schutzziel und tatsächliche Speicherung

Kamerabilder, OCR-Rohtext, QR-Inhalte und echte Gerätewerte dürfen nicht als Trainingsmaterial gespeichert, exportiert oder in das Repository übernommen werden.

Die Kameraaufnahme und OCR-Verarbeitung erfolgen im Browser. Die aktuell aufgenommene Bilddatei wird im Arbeitsspeicher der Seite gehalten. Wenn ein Tracking-Datensatz gespeichert wird, speichert die Haupt-App das Labelbild jedoch **dauerhaft im Browserprofil** in IndexedDB (Datenbank `teiletracking.binary.v1`, Store `labelImages`). Das Bild ist über die Datensatz-ID zugeordnet. Beim Löschen des lokalen Tracking-Datensatzes versucht die App auch das Bild zu löschen. Das Löschen kann bei Browserfehlern scheitern; eine Bestätigung der erfolgreichen Löschung wird derzeit nicht separat angezeigt.

Daher gilt: Browserdaten der App können personenbezogene oder vertrauliche Label-/Geräteinformationen enthalten. Gerätezugriff, Browserprofile, Backups und Aufbewahrungsfristen müssen organisatorisch geschützt und geregelt werden. Die Behauptung, gespeicherte Tracking-Datensätze enthielten keine Bilder, wäre für den aktuellen Code falsch.

## Aufnahme und Qualitätsprüfung

Nach dem Autofokus werden fünf Videoframes aufgenommen. Die App bewertet Schärfe, Bewegung, Helligkeit und Reflexion und verarbeitet nur den besten Frame. Unzureichende Aufnahmen werden abgelehnt, statt unsichere Werte zu übernehmen.

## OCR-Validierung

PN und SN sind Pflichtfelder. Ein Feld gilt nicht allein deshalb als erkannt, weil es nicht leer ist. OCR-Kandidaten werden formal validiert und gegen die QR-Referenz bewertet. Eindeutige Zeichenverwechslungen wie O/0 oder S/5 dürfen korrigiert werden. Andere kleine Abweichungen erfordern eine manuelle Prüfung; größere Abweichungen werden abgelehnt.

## Lernexport

Der Lernexport wird ausschließlich nach einer manuellen Korrektur erzeugt und enthält nur:

- Feldname
- abstrakte Verwechslungsklasse
- grobe Positions- und Längenklasse
- grobe Bildqualitätsklassen
- ausdrücklich synthetische Beispielwerte

Der Export enthält keine Fotos, Rohtexte, QR-Inhalte, echten Werte oder Hashes echter Werte. Vor der Aufnahme in das Repository ist der JSON-Inhalt manuell zu prüfen. Nur Einträge mit `synthetic: true` sind zulässig.

## Mobile Labelprofil-App

Die Seite `prototype/label-trainer.html` ermöglicht auf dem Smartphone:

- ein Label für den aktuellen OCR-Test aufzunehmen,
- relative Bereiche für PN, SN, HW und SW per Touch zu markieren,
- Sollwerte ausschließlich für den aktuellen lokalen OCR-Test einzugeben,
- OCR-Abweichungen als abstrakte Fehlermuster auszuwerten,
- mehrere Profile lokal zu speichern und für die Tracking-App zu aktivieren,
- Profile als geprüfte JSON-Dateien zu exportieren oder zu importieren.

Gespeicherte Profile enthalten nur relative Koordinaten, Vorverarbeitungsoptionen und sichere synthetische Erkenntnisse. Sollwerte und Originalbilder werden beim Profilaufbau verworfen. Die Haupt-App versucht ein aktives Profil vor der allgemeinen Vollbild-OCR und fällt bei unsicheren Ergebnissen auf den bestehenden OCR-Prozess zurück.

## Repository-Prozess

1. Anonymisierten Export lokal öffnen und auf Rohwerte prüfen.
2. Aus der Erkenntnis eine allgemeine Regel oder Konfigurationsänderung ableiten.
3. Ausschließlich synthetische Regressionstests hinzufügen.
4. Änderungen per Pull Request prüfen lassen.
5. Tests für JavaScript-Syntax, OCR-Validierung und Datenschutz müssen bestehen.

## Grenzen

OCR kann keine hundertprozentige Erkennungsquote garantieren. Unklare Aufnahmen oder Werte werden nicht automatisch akzeptiert und benötigen eine neue Aufnahme oder manuelle Bestätigung.

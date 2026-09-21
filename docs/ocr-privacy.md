# Datenschutzsicherer OCR-Prozess

## Schutzziel

Kamerabilder, OCR-Rohtext, QR-Inhalte und echte Gerätewerte dürfen nicht als
Trainingsmaterial gespeichert, exportiert oder in das Repository übernommen
werden. Die Anwendung verarbeitet das Kamerabild ausschließlich flüchtig im
Browser. Beim Speichern eines Tracking-Datensatzes wird kein Labelbild
persistiert.

## Aufnahme und Qualitätsprüfung

Nach dem Autofokus werden fünf Videoframes aufgenommen. Die App bewertet
Schärfe, Bewegung, Helligkeit und Reflexion und verarbeitet nur den besten
Frame. Unzureichende Aufnahmen werden abgelehnt, statt unsichere Werte zu
übernehmen.

## OCR-Validierung

PN und SN sind Pflichtfelder. Ein Feld gilt nicht allein deshalb als erkannt,
weil es nicht leer ist. OCR-Kandidaten werden formal validiert und gegen die
QR-Referenz bewertet. Eindeutige Zeichenverwechslungen wie O/0 oder S/5 dürfen
korrigiert werden. Andere kleine Abweichungen erfordern eine manuelle Prüfung;
größere Abweichungen werden abgelehnt.

## Lernexport

Der Lernexport wird ausschließlich nach einer manuellen Korrektur erzeugt und
enthält nur:

- Feldname
- abstrakte Verwechslungsklasse
- grobe Positions- und Längenklasse
- grobe Bildqualitätsklassen
- ausdrücklich synthetische Beispielwerte

Der Export enthält keine Fotos, Rohtexte, QR-Inhalte, echten Werte oder Hashes
echter Werte. Vor der Aufnahme in das Repository ist der JSON-Inhalt manuell zu
prüfen. Nur Einträge mit `synthetic: true` sind zulässig.

## Mobile Labelprofil-App

Die Seite `prototype/label-trainer.html` ermöglicht auf dem Smartphone:

- ein Label zu fotografieren, ohne das Bild dauerhaft zu speichern,
- relative Bereiche für PN, SN, HW und SW per Touch zu markieren,
- Sollwerte ausschließlich für den aktuellen lokalen OCR-Test einzugeben,
- OCR-Abweichungen als abstrakte Fehlermuster auszuwerten,
- mehrere Profile lokal zu speichern und für die Tracking-App zu aktivieren,
- Profile als geprüfte JSON-Dateien zu exportieren oder zu importieren.

Gespeicherte Profile enthalten nur relative Koordinaten, Vorverarbeitungsoptionen
und sichere synthetische Erkenntnisse. Sollwerte und Originalbilder werden beim
Profilaufbau ausdrücklich verworfen. Die Haupt-App versucht ein aktives Profil
vor der allgemeinen Vollbild-OCR und fällt bei unsicheren Ergebnissen auf den
bestehenden OCR-Prozess zurück.

## Repository-Prozess

1. Anonymisierten Export lokal öffnen und auf Rohwerte prüfen.
2. Aus der Erkenntnis eine allgemeine Regel oder Konfigurationsänderung ableiten.
3. Ausschließlich synthetische Regressionstests hinzufügen.
4. Änderungen per Pull Request prüfen lassen.
5. Tests für JavaScript-Syntax, OCR-Validierung und Datenschutz müssen bestehen.

## Grenzen

OCR kann keine hundertprozentige Erkennungsquote garantieren. Die Sicherheit
entsteht durch ein Fail-Closed-Verfahren: Unklare Aufnahmen oder Werte werden
nicht automatisch akzeptiert und benötigen eine neue Aufnahme oder manuelle
Bestätigung.

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const validation = require("../prototype/ocr-validation-service.js");
const learning = require("../prototype/ocr-learning-service.js");
const quality = require("../prototype/image-quality-service.js");

const memoryStorage = new Map();
global.localStorage = {
    getItem: key => memoryStorage.has(key) ? memoryStorage.get(key) : null,
    setItem: (key, value) => memoryStorage.set(key, String(value)),
    removeItem: key => memoryStorage.delete(key)
};
const profiles = require("../prototype/label-profile-service.js");

const exact = validation.compareField("ABC-123", "ABC-123", { required: true });
assert.equal(exact.status, "EXACT");

const confusion = validation.compareField("ABO-12S", "AB0-125", { required: true });
assert.equal(confusion.status, "CONFUSION_CORRECTED");
assert.equal(confusion.value, "AB0-125");

const review = validation.compareField("ABC-124", "ABC-123", { required: true });
assert.equal(review.status, "FUZZY_REVIEW");

const mismatch = validation.compareField("WRONG-999", "ABC-123", { required: true });
assert.equal(mismatch.status, "MISMATCH");

const record = validation.validateRecord(
    { partNumber: "PN-O123", serialNumber: "SN-12S", hardware: "H1", software: "S1" },
    { partNumber: "PN-0123", serialNumber: "SN-125", hardware: "H1", software: "S1" }
);
assert.equal(record.accepted, true);
assert.equal(record.data.partNumber, "PN-0123");
assert.equal(record.data.serialNumber, "SN-125");

const realObserved = "REAL-SERIAL-O12345";
const realExpected = "REAL-SERIAL-012345";
const insight = learning.createInsight({
    field: "SerialNumber",
    observed: realObserved,
    expected: realExpected,
    quality: { sharpnessBucket: "medium" }
});
const exported = learning.createExport([insight]);
const serialized = JSON.stringify(exported);
assert.equal(learning.assertSafeInsight(insight), true);
assert.equal(serialized.includes(realObserved), false);
assert.equal(serialized.includes(realExpected), false);
assert.equal(exported.insights[0].synthetic, true);

const acceptedQuality = quality.evaluate({
    sharpness: 18,
    brightness: 130,
    glarePercent: 2,
    motion: 4
});
assert.equal(acceptedQuality.accepted, true);

const rejectedQuality = quality.evaluate({
    sharpness: 4,
    brightness: 20,
    glarePercent: 1,
    motion: 40
});
assert.equal(rejectedQuality.accepted, false);
assert.ok(rejectedQuality.reasons.includes("UNSHARP"));
assert.ok(rejectedQuality.reasons.includes("MOTION"));

const safeProfile = profiles.saveProfile({
    schemaVersion: 1,
    synthetic: true,
    id: "synthetic-a",
    name: "Synthetic A",
    regions: {
        partNumber: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }
    },
    expectedValue: "REAL-PN-MUST-NOT-SURVIVE",
    imageData: "data:image/jpeg;base64,SECRET"
});
const profileText = JSON.stringify(profiles.exportProfile(safeProfile));
assert.equal(profiles.isSafeProfile(safeProfile), true);
assert.equal(profileText.includes("REAL-PN-MUST-NOT-SURVIVE"), false);
assert.equal(profileText.includes("data:image"), false);
profiles.setActiveProfile(safeProfile.id);
assert.equal(profiles.getActiveProfile().id, safeProfile.id);

const appSource = fs.readFileSync(
    path.join(__dirname, "../prototype/app.js"),
    "utf8"
);
assert.equal(
    /saveLabelImage\s*\(/.test(appSource),
    false,
    "Kamerabilder dürfen im App-Ablauf nicht dauerhaft gespeichert werden."
);

const indexSource = fs.readFileSync(
    path.join(__dirname, "../prototype/index.html"),
    "utf8"
);
assert.equal(
    indexSource.includes("two-stage-label-workflow.js"),
    false,
    "Der zweite Kamera-/OCR-Scanweg muss deaktiviert bleiben."
);
assert.equal(
    indexSource.includes("qr-only-input"),
    true,
    "Die operative Erfassung muss die QR-Feldgruppe enthalten."
);
assert.equal(
    appSource.includes("teiletracking:qr-detected"),
    true,
    "Erkannte QR-Werte müssen direkt in die Erfassung übernommen werden."
);
for (const fieldId of [
    "qrPartNumberField",
    "qrCpidField",
    "qrHardwareField"
]) {
    assert.equal(
        indexSource.includes(`id="${fieldId}"`),
        true,
        `Das Erfassungsfeld ${fieldId} muss vorhanden sein.`
    );
}
assert.equal(indexSource.includes('id="openIStufeOcrButton"'), false);
assert.equal(indexSource.includes("Label fotografieren &amp; QR übernehmen"), true);
assert.equal(indexSource.includes("Foto aufnehmen &amp; QR übernehmen"), true);
const captureButtonMarkup = indexSource.match(
    /<button[^>]*id="captureLabelButton"[^>]*>/
);
assert.ok(captureButtonMarkup, "Der Foto-Auslöser muss vorhanden sein.");
assert.doesNotMatch(
    captureButtonMarkup[0],
    /\bhidden\b/,
    "Der Foto-Auslöser darf nicht versteckt sein."
);
assert.equal(appSource.includes("recognizeProfileField"), false);
assert.equal(indexSource.includes('id="captureIStufe"'), false);
assert.match(
    appSource,
    /createCapturedLabelCanvas\(\);\s*\n\s*closeQrScanner\(\);/,
    "Die Kamera muss direkt nach der Fotoübernahme geschlossen werden."
);
assert.equal(
    appSource.includes("populateQrFields(qrText)"),
    true,
    "Die QR-Werte müssen nach dem Foto in die sichtbaren Felder geschrieben werden."
);
assert.equal(
    appSource.includes("parseProfileMappedQrFields"),
    true,
    "Die Tracking-App muss die QR-Zuordnung des aktiven Labelprofils verwenden."
);
assert.match(
    appSource,
    /split\(\/\[_\|;/,
    "Positionsbasierte QR-Inhalte müssen auch am Unterstrich getrennt werden."
);
assert.equal(
    appSource.includes("partNumber: normalizeText(values[1])"),
    true,
    "Im bestätigten QR-Schema muss Index 1 als PartNumber verwendet werden."
);
assert.equal(
    appSource.includes("serialNumber: normalizeText(values[2])"),
    true,
    "Im bestätigten QR-Schema muss Index 2 als CPID verwendet werden."
);
assert.equal(
    appSource.includes("PartNumber, CPID und Hardware wurden ausschließlich aus dem QR-Code"),
    false,
    "Hardware darf nicht mehr als QR-Wert bestätigt werden."
);
assert.equal(appSource.includes('editButton.textContent = "Bearbeiten"'), true);
assert.equal(appSource.includes('elements.saveButton.textContent = "Änderungen speichern"'), true);
assert.equal(appSource.includes("UpdatedAt: new Date().toISOString()"), true);
assert.match(
    appSource,
    /item\.LocalId !== state\.editingLocalId/,
    "Der bearbeitete Datensatz darf sich nicht selbst als Duplikat erkennen."
);

console.log("OCR privacy and validation tests: PASS");

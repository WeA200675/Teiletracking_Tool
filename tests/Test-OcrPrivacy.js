"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const validation = require("../prototype/ocr-validation-service.js");
const learning = require("../prototype/ocr-learning-service.js");
const quality = require("../prototype/image-quality-service.js");

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

const appSource = fs.readFileSync(
    path.join(__dirname, "../prototype/app.js"),
    "utf8"
);
assert.equal(
    /saveLabelImage\s*\(/.test(appSource),
    false,
    "Kamerabilder dürfen im App-Ablauf nicht dauerhaft gespeichert werden."
);

console.log("OCR privacy and validation tests: PASS");

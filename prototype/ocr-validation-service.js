"use strict";

(function initializeOcrValidationService(global) {
    const FIELD_NAMES = Object.freeze([
        "partNumber", "serialNumber", "hardware", "software"
    ]);

    const CONFUSIONS = Object.freeze({
        O: "0", Q: "0", I: "1", L: "1", S: "5",
        B: "8", Z: "2", G: "6"
    });

    function normalize(value) {
        return String(value || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "")
            .replace(/[^A-Z0-9._/\-]/g, "");
    }

    function canonical(value) {
        return normalize(value)
            .split("")
            .map(character => CONFUSIONS[character] || character)
            .join("");
    }

    function levenshtein(left, right) {
        const a = normalize(left);
        const b = normalize(right);
        const row = Array.from({ length: b.length + 1 }, (_, index) => index);
        for (let i = 1; i <= a.length; i += 1) {
            let diagonal = row[0];
            row[0] = i;
            for (let j = 1; j <= b.length; j += 1) {
                const previous = row[j];
                row[j] = Math.min(
                    row[j] + 1,
                    row[j - 1] + 1,
                    diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
                diagonal = previous;
            }
        }
        return row[b.length];
    }

    function isFormallyValid(value, required = false) {
        const normalized = normalize(value);
        if (!normalized) return !required;
        return normalized.length >= 2 && normalized.length <= 64;
    }

    function compareField(ocrValue, qrValue, options = {}) {
        const observed = normalize(ocrValue);
        const expected = normalize(qrValue);
        const required = Boolean(options.required);

        if (!expected) {
            return {
                status: isFormallyValid(observed, required) ? "NO_REFERENCE" : "INVALID",
                value: observed,
                distance: null,
                corrected: false
            };
        }

        if (!observed || !isFormallyValid(observed, required)) {
            return { status: "MISSING", value: "", distance: null, corrected: false };
        }

        if (observed === expected) {
            return { status: "EXACT", value: observed, distance: 0, corrected: false };
        }

        if (canonical(observed) === canonical(expected)) {
            return { status: "CONFUSION_CORRECTED", value: expected, distance: 0, corrected: true };
        }

        const distance = levenshtein(observed, expected);
        const maxDistance = expected.length >= 12 ? 2 : expected.length >= 5 ? 1 : 0;
        const lengthDifference = Math.abs(observed.length - expected.length);
        if (distance <= maxDistance && lengthDifference <= 1) {
            return { status: "FUZZY_REVIEW", value: observed, distance, corrected: false };
        }

        return { status: "MISMATCH", value: observed, distance, corrected: false };
    }

    function validateRecord(ocrData = {}, qrData = null) {
        const qr = qrData || {};
        const fields = {};
        const accepted = { ...ocrData };
        const reviewFields = [];

        for (const fieldName of FIELD_NAMES) {
            const required = fieldName === "partNumber" || fieldName === "serialNumber";
            const comparison = compareField(
                ocrData[fieldName], qr[fieldName], { required }
            );
            fields[fieldName] = comparison;
            accepted[fieldName] = comparison.value;
            if (!["EXACT", "CONFUSION_CORRECTED", "NO_REFERENCE"].includes(comparison.status)) {
                reviewFields.push(fieldName);
            }
            if (required && comparison.status === "NO_REFERENCE" && !comparison.value) {
                reviewFields.push(fieldName);
            }
        }

        return {
            fields,
            data: accepted,
            reviewFields: [...new Set(reviewFields)],
            accepted: reviewFields.length === 0
        };
    }

    const api = Object.freeze({
        FIELD_NAMES, normalize, canonical, levenshtein,
        isFormallyValid, compareField, validateRecord
    });
    global.TeiletrackingOcrValidationService = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

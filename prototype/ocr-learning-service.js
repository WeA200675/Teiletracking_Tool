"use strict";

(function initializeOcrLearningService(global) {
    const SAFE_FIELDS = Object.freeze([
        "schemaVersion", "synthetic", "createdAt", "profile",
        "field", "outcome", "confusionClass", "positionBucket",
        "lengthBucket", "quality", "example"
    ]);

    const CONFUSION_PAIRS = Object.freeze([
        ["O", "0"], ["Q", "0"], ["I", "1"], ["L", "1"],
        ["S", "5"], ["B", "8"], ["Z", "2"], ["G", "6"]
    ]);

    function normalize(value) {
        return String(value || "").trim().toUpperCase();
    }

    function lengthBucket(value) {
        const length = normalize(value).length;
        if (length <= 4) return "2-4";
        if (length <= 8) return "5-8";
        if (length <= 12) return "9-12";
        return "13+";
    }

    function positionBucket(index, length) {
        if (index < 0 || length <= 1) return "unknown";
        const ratio = index / (length - 1);
        return ratio < 0.34 ? "start" : ratio < 0.67 ? "middle" : "end";
    }

    function detectConfusion(observed, expected) {
        const left = normalize(observed);
        const right = normalize(expected);
        const max = Math.max(left.length, right.length);
        for (let index = 0; index < max; index += 1) {
            if (left[index] === right[index]) continue;
            const pair = CONFUSION_PAIRS.find(([a, b]) =>
                (left[index] === a && right[index] === b) ||
                (left[index] === b && right[index] === a)
            );
            return {
                confusionClass: pair ? `${pair[0]}↔${pair[1]}` : "OTHER_EDIT",
                positionBucket: positionBucket(index, max)
            };
        }
        return { confusionClass: "NONE", positionBucket: "unknown" };
    }

    function syntheticExample(confusionClass) {
        const replacements = {
            "O↔0": ["SYN-O-248", "SYN-0-248"],
            "I↔1": ["SYN-I-572", "SYN-1-572"],
            "L↔1": ["SYN-L-804", "SYN-1-804"],
            "S↔5": ["SYN-S-631", "SYN-5-631"],
            "B↔8": ["SYN-B-407", "SYN-8-407"],
            "Z↔2": ["SYN-Z-915", "SYN-2-915"],
            "G↔6": ["SYN-G-183", "SYN-6-183"]
        };
        const [ocr, expected] = replacements[confusionClass] ||
            ["SYN-ABC-123", "SYN-ABX-123"];
        return { ocr, expected };
    }

    function createInsight({ field, observed, expected, quality = {}, profile = "standard-label" }) {
        const confusion = detectConfusion(observed, expected);
        return {
            schemaVersion: 1,
            synthetic: true,
            createdAt: new Date().toISOString(),
            profile,
            field,
            outcome: "MANUAL_CONFIRMATION",
            confusionClass: confusion.confusionClass,
            positionBucket: confusion.positionBucket,
            lengthBucket: lengthBucket(expected || observed),
            quality: {
                sharpness: String(quality.sharpnessBucket || "unknown"),
                brightness: String(quality.brightnessBucket || "unknown"),
                motion: String(quality.motionBucket || "unknown")
            },
            example: syntheticExample(confusion.confusionClass)
        };
    }

    function assertSafeInsight(insight) {
        if (!insight || insight.synthetic !== true) return false;
        if (Object.keys(insight).some(key => !SAFE_FIELDS.includes(key))) return false;
        const serialized = JSON.stringify(insight);
        return !/(data:image|PN=|SN=|QR|rawText|imageData)/i.test(serialized);
    }

    function createExport(insights) {
        const safe = (Array.isArray(insights) ? insights : [])
            .filter(assertSafeInsight);
        return {
            schemaVersion: 1,
            privacy: "NO_IMAGES_NO_RAW_VALUES_SYNTHETIC_EXAMPLES_ONLY",
            insights: safe
        };
    }

    const api = Object.freeze({
        SAFE_FIELDS, detectConfusion, createInsight, assertSafeInsight, createExport
    });
    global.TeiletrackingOcrLearningService = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

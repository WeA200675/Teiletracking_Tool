"use strict";

(function initializeLabelProfileService(global) {
    const STORAGE_KEY = "teiletracking.labelProfiles.v1";
    const ACTIVE_KEY = "teiletracking.activeLabelProfile.v1";
    const FIELD_TYPES = Object.freeze([
        "partNumber", "serialNumber", "hardware"
    ]);

    function normalizeRegion(region = {}) {
        const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
        const x = clamp(region.x);
        const y = clamp(region.y);
        return {
            x,
            y,
            width: Math.min(1 - x, Math.max(0.02, clamp(region.width))),
            height: Math.min(1 - y, Math.max(0.02, clamp(region.height)))
        };
    }

    function sanitizeProfile(profile = {}) {
        const regions = {};
        const mappings = {};
        for (const field of FIELD_TYPES) {
            if (profile.regions && profile.regions[field]) {
                regions[field] = normalizeRegion(profile.regions[field]);
            }
            const index = Number(profile.mappings && profile.mappings[field]);
            if (Number.isInteger(index) && index >= 0 && index <= 99) {
                mappings[field] = index;
            }
        }
        return {
            schemaVersion: 1,
            synthetic: true,
            id: String(profile.id || `profile-${Date.now()}`)
                .replace(/[^a-zA-Z0-9._-]/g, "-")
                .slice(0, 80),
            name: String(profile.name || "Labelprofil").trim().slice(0, 80),
            regions,
            mappings,
            preprocessing: {
                contrast: Boolean(profile.preprocessing && profile.preprocessing.contrast),
                threshold: Boolean(profile.preprocessing && profile.preprocessing.threshold),
                rotateAuto: true
            },
            insights: Array.isArray(profile.insights)
                ? profile.insights.filter(item =>
                    global.TeiletrackingOcrLearningService &&
                    global.TeiletrackingOcrLearningService.assertSafeInsight(item)
                )
                : []
        };
    }

    function isSafeProfile(profile) {
        if (!profile || profile.synthetic !== true || profile.schemaVersion !== 1) return false;
        const serialized = JSON.stringify(profile);
        if (/(data:image|base64|rawText|expectedValue|qrText|PN=|SN=)/i.test(serialized)) return false;
        return Object.keys(profile.regions || {}).every(field => FIELD_TYPES.includes(field)) &&
            Object.entries(profile.mappings || {}).every(([field, index]) =>
                FIELD_TYPES.includes(field) && Number.isInteger(index) && index >= 0 && index <= 99
            );
    }

    function loadProfiles() {
        try {
            const parsed = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(parsed) ? parsed.filter(isSafeProfile).map(sanitizeProfile) : [];
        }
        catch {
            return [];
        }
    }

    function saveProfile(profile) {
        const safe = sanitizeProfile(profile);
        if (!isSafeProfile(safe)) throw new Error("Das Profil enthält nicht erlaubte Daten.");
        const profiles = loadProfiles().filter(item => item.id !== safe.id);
        profiles.push(safe);
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        return safe;
    }

    function deleteProfile(id) {
        const profiles = loadProfiles().filter(item => item.id !== id);
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        if (global.localStorage.getItem(ACTIVE_KEY) === id) {
            global.localStorage.removeItem(ACTIVE_KEY);
        }
    }

    function setActiveProfile(id) {
        if (!loadProfiles().some(item => item.id === id)) {
            throw new Error("Profil nicht gefunden.");
        }
        global.localStorage.setItem(ACTIVE_KEY, id);
    }

    function getActiveProfile() {
        const id = global.localStorage.getItem(ACTIVE_KEY);
        return loadProfiles().find(item => item.id === id) || null;
    }

    function exportProfile(profile) {
        const safe = sanitizeProfile(profile);
        if (!isSafeProfile(safe)) throw new Error("Profil konnte nicht sicher exportiert werden.");
        return safe;
    }

    function importProfile(raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!isSafeProfile(parsed)) {
            throw new Error("Profil abgelehnt: Es ist nicht synthetisch oder enthält unzulässige Daten.");
        }
        return saveProfile(parsed);
    }

    function cropRegion(sourceCanvas, region) {
        const safe = normalizeRegion(region);
        const sx = Math.round(sourceCanvas.width * safe.x);
        const sy = Math.round(sourceCanvas.height * safe.y);
        const sw = Math.max(1, Math.round(sourceCanvas.width * safe.width));
        const sh = Math.max(1, Math.round(sourceCanvas.height * safe.height));
        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        canvas.getContext("2d").drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
        return canvas;
    }

    const api = Object.freeze({
        STORAGE_KEY, ACTIVE_KEY, FIELD_TYPES, normalizeRegion, sanitizeProfile,
        isSafeProfile, loadProfiles, saveProfile, deleteProfile,
        setActiveProfile, getActiveProfile, exportProfile, importProfile, cropRegion
    });
    global.TeiletrackingLabelProfileService = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

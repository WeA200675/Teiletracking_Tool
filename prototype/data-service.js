"use strict";

(function initializeDataService(global) {
    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function readJson(key, fallbackValue) {
        try {
            const stored = global.localStorage.getItem(key);

            if (!stored) {
                return clone(fallbackValue);
            }

            return JSON.parse(stored);
        }
        catch (error) {
            console.error(
                `Lokale Daten konnten nicht gelesen werden (${key}):`,
                error
            );

            return clone(fallbackValue);
        }
    }

    function writeJson(key, value) {
        global.localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    }

    function remove(key) {
        global.localStorage.removeItem(key);
    }

    function createLocalRecordId() {
        if (
            typeof global.crypto !== "undefined" &&
            typeof global.crypto.randomUUID === "function"
        ) {
            return global.crypto.randomUUID();
        }

        return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function downloadTextFile(
        fileName,
        content,
        mimeType
    ) {
        const blob = new Blob(
            [content],
            { type: mimeType }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    global.TeiletrackingDataService = Object.freeze({
        readJson,
        writeJson,
        remove,
        createLocalRecordId,
        downloadTextFile
    });
})(window);

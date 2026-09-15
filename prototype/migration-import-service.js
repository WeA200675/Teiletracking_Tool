"use strict";

(function initializeMigrationImportService(global) {
    function sortForCanonicalJson(value) {
        if (Array.isArray(value)) {
            return value.map(
                sortForCanonicalJson
            );
        }

        if (
            value &&
            typeof value === "object" &&
            !(value instanceof Date)
        ) {
            const sorted = {};

            for (
                const key of
                Object.keys(value).sort()
            ) {
                sorted[key] =
                    sortForCanonicalJson(
                        value[key]
                    );
            }

            return sorted;
        }

        return value;
    }

    function canonicalJson(value) {
        return JSON.stringify(
            sortForCanonicalJson(
                value
            )
        );
    }

    function bytesToHex(buffer) {
        return Array.from(
            new Uint8Array(buffer)
        )
            .map(byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
            )
            .join("")
            .toUpperCase();
    }

    async function sha256Bytes(bytes) {
        if (
            !global.crypto ||
            !global.crypto.subtle
        ) {
            throw new Error(
                "SHA-256 steht in diesem Browser nicht zur Verfügung."
            );
        }

        const digest =
            await global.crypto.subtle.digest(
                "SHA-256",
                bytes
            );

        return (
            "SHA256:" +
            bytesToHex(digest)
        );
    }

    async function sha256Text(text) {
        return sha256Bytes(
            new TextEncoder().encode(
                String(text)
            )
        );
    }

    function addCheck(
        checks,
        id,
        title,
        ok,
        detail,
        severity = "ERROR"
    ) {
        checks.push({
            id,
            title,
            ok: Boolean(ok),
            detail:
                String(
                    detail || ""
                ),
            severity
        });
    }

    function normalizeHash(value) {
        return String(value || "")
            .trim()
            .toUpperCase();
    }

    function normalizeText(value) {
        return String(value || "")
            .trim();
    }

    function parseJsonFile(
        text,
        fileName
    ) {
        try {
            return JSON.parse(text);
        }
        catch (error) {
            throw new Error(
                `${fileName} enthält kein gültiges JSON: ${error.message}`
            );
        }
    }

    function getRecordForHash(
        record,
        packageFormatVersion
    ) {
        const copy = {
            ...record
        };

        delete copy.RecordHash;

        if (
            Number(
                packageFormatVersion
            ) >= 2
        ) {
            delete copy.BatchId;
        }

        return copy;
    }

    function getManifestWithoutPackageHash(
        manifest
    ) {
        const copy = {
            ...manifest
        };

        delete copy.PackageHash;

        return copy;
    }

    function getUniqueValues(
        values
    ) {
        return [
            ...new Set(
                values
                    .map(
                        normalizeText
                    )
                    .filter(Boolean)
            )
        ];
    }

    async function verifyImageFiles(
        zip,
        manifest,
        trackingPayload,
        checks
    ) {
        const manifestImageHashes =
            Array.isArray(
                manifest.ImageHashes
            )
                ? manifest.ImageHashes
                : [];

        const manifestHashMap =
            new Map(
                manifestImageHashes
                    .filter(item =>
                        item &&
                        item.File
                    )
                    .map(item => [
                        normalizeText(
                            item.File
                        ),
                        normalizeHash(
                            item.Hash
                        )
                    ])
            );

        const referencedImages =
            getUniqueValues(
                (
                    Array.isArray(
                        trackingPayload.Records
                    )
                        ? trackingPayload.Records
                        : []
                )
                    .map(record =>
                        record &&
                        record.LabelImageFile
                    )
            );

        let allImagesOk = true;
        const imageResults = [];

        for (
            const fileName of
            referencedImages
        ) {
            const zipEntry =
                zip.file(fileName);

            if (!zipEntry) {
                allImagesOk = false;

                imageResults.push({
                    fileName,
                    ok: false,
                    detail:
                        "Datei fehlt im ZIP."
                });

                continue;
            }

            const bytes =
                await zipEntry.async(
                    "uint8array"
                );

            const actualHash =
                await sha256Bytes(
                    bytes
                );

            const expectedManifestHash =
                manifestHashMap.get(
                    fileName
                );

            const recordHashes =
                getUniqueValues(
                    trackingPayload.Records
                        .filter(record =>
                            normalizeText(
                                record.LabelImageFile
                            ) ===
                            fileName
                        )
                        .map(record =>
                            normalizeHash(
                                record.LabelImageHash
                            )
                        )
                );

            const manifestHashOk =
                Boolean(
                    expectedManifestHash
                ) &&
                normalizeHash(
                    actualHash
                ) ===
                expectedManifestHash;

            const recordHashOk =
                recordHashes.length === 1 &&
                recordHashes[0] ===
                normalizeHash(
                    actualHash
                );

            const ok =
                manifestHashOk &&
                recordHashOk;

            if (!ok) {
                allImagesOk = false;
            }

            imageResults.push({
                fileName,
                ok,
                actualHash,
                expectedManifestHash:
                    expectedManifestHash ||
                    "",
                recordHashes
            });
        }

        const extraManifestImages =
            [...manifestHashMap.keys()]
                .filter(fileName =>
                    !referencedImages.includes(
                        fileName
                    )
                );

        if (
            extraManifestImages.length > 0
        ) {
            allImagesOk = false;
        }

        addCheck(
            checks,
            "images",
            "Labelbilder und Bild-Hashes",
            allImagesOk,
            allImagesOk
                ? `${referencedImages.length} referenzierte Labelbilder wurden vollständig geprüft.`
                : (
                    "Mindestens ein Labelbild fehlt, ist verändert oder die Hash-Referenzen sind nicht konsistent. " +
                    (
                        extraManifestImages.length > 0
                            ? `Nicht referenzierte Manifest-Bilder: ${extraManifestImages.join(", ")}`
                            : ""
                    )
                )
        );

        return {
            imageResults,
            allImagesOk
        };
    }

    async function verifyRecordHashes(
        trackingPayload,
        manifest,
        checks
    ) {
        const records =
            Array.isArray(
                trackingPayload.Records
            )
                ? trackingPayload.Records
                : [];

        const results = [];
        let allOk = true;

        for (
            let index = 0;
            index < records.length;
            index += 1
        ) {
            const record =
                records[index];

            const expectedHash =
                normalizeHash(
                    record &&
                    record.RecordHash
                );

            const actualHash =
                await sha256Text(
                    canonicalJson(
                        getRecordForHash(
                            record || {},
                            manifest
                                .PackageFormatVersion
                        )
                    )
                );

            const ok =
                Boolean(
                    expectedHash
                ) &&
                expectedHash ===
                normalizeHash(
                    actualHash
                );

            if (!ok) {
                allOk = false;
            }

            results.push({
                index,
                recordId:
                    normalizeText(
                        record &&
                        record.RecordId
                    ),
                ok,
                expectedHash,
                actualHash
            });
        }

        addCheck(
            checks,
            "recordHashes",
            "Datensatz-Hashes",
            allOk,
            allOk
                ? `${records.length} Datensatz-Hashes sind gültig.`
                : "Mindestens ein Datensatz wurde seit dem Export verändert oder besitzt keinen gültigen RecordHash."
        );

        return {
            results,
            allOk
        };
    }

    function validatePackageStructure(
        manifest,
        trackingPayload,
        checks
    ) {
        const manifestFormatOk =
            manifest &&
            manifest.Format ===
                "teiletracking.migration.package";

        addCheck(
            checks,
            "manifestFormat",
            "Manifest-Format",
            manifestFormatOk,
            manifestFormatOk
                ? "Unterstütztes Teiletracking-Migrationspaket."
                : "Manifest.Format entspricht nicht dem erwarteten Migrationspaketformat."
        );

        const trackingFormatOk =
            trackingPayload &&
            trackingPayload.Format ===
                "teiletracking.migration.data";

        addCheck(
            checks,
            "trackingFormat",
            "Trackingdaten-Format",
            trackingFormatOk,
            trackingFormatOk
                ? "Unterstütztes Trackingdatenformat."
                : "tracking-data.json besitzt ein unbekanntes Format."
        );

        const manifestBatchId =
            normalizeText(
                manifest &&
                manifest.BatchId
            );

        const trackingBatchId =
            normalizeText(
                trackingPayload &&
                trackingPayload.BatchId
            );

        const batchIdOk =
            Boolean(
                manifestBatchId
            ) &&
            manifestBatchId ===
                trackingBatchId;

        addCheck(
            checks,
            "batchId",
            "BatchId-Konsistenz",
            batchIdOk,
            batchIdOk
                ? manifestBatchId
                : (
                    `Manifest: ${manifestBatchId || "–"} · Tracking: ${trackingBatchId || "–"}`
                )
        );

        const manifestDeviceId =
            normalizeText(
                manifest &&
                manifest.DeviceId
            );

        const trackingDeviceId =
            normalizeText(
                trackingPayload &&
                trackingPayload.DeviceId
            );

        const deviceIdOk =
            Boolean(
                manifestDeviceId
            ) &&
            manifestDeviceId ===
                trackingDeviceId;

        addCheck(
            checks,
            "deviceId",
            "DeviceId-Konsistenz",
            deviceIdOk,
            deviceIdOk
                ? manifestDeviceId
                : (
                    `Manifest: ${manifestDeviceId || "–"} · Tracking: ${trackingDeviceId || "–"}`
                )
        );

        const records =
            Array.isArray(
                trackingPayload &&
                trackingPayload.Records
            )
                ? trackingPayload.Records
                : [];

        const recordCountOk =
            Number(
                manifest &&
                manifest.RecordCount
            ) ===
                records.length &&
            Number(
                trackingPayload &&
                trackingPayload.RecordCount
            ) ===
                records.length;

        addCheck(
            checks,
            "recordCount",
            "Datensatzanzahl",
            recordCountOk,
            `Manifest: ${manifest && manifest.RecordCount} · Tracking: ${trackingPayload && trackingPayload.RecordCount} · Tatsächlich: ${records.length}`
        );

        const recordIds =
            records.map(record =>
                normalizeText(
                    record &&
                    record.RecordId
                )
            );

        const missingRecordIds =
            recordIds.filter(
                value => !value
            );

        const uniqueRecordIds =
            new Set(
                recordIds.filter(Boolean)
            );

        const recordIdsOk =
            missingRecordIds.length === 0 &&
            uniqueRecordIds.size ===
                recordIds.length;

        addCheck(
            checks,
            "recordIds",
            "Eindeutige RecordIds",
            recordIdsOk,
            recordIdsOk
                ? `${recordIds.length} eindeutige RecordIds.`
                : "Mindestens eine RecordId fehlt oder kommt innerhalb des Pakets mehrfach vor."
        );

        const recordBatchIds =
            getUniqueValues(
                records.map(record =>
                    record &&
                    record.BatchId
                )
            );

        const recordBatchOk =
            recordBatchIds.length === 1 &&
            recordBatchIds[0] ===
                manifestBatchId;

        addCheck(
            checks,
            "recordBatchIds",
            "RecordId → BatchId-Zuordnung",
            recordBatchOk,
            recordBatchOk
                ? `Alle Datensätze gehören zu ${manifestBatchId}.`
                : (
                    `Gefundene BatchIds in Datensätzen: ${recordBatchIds.join(", ") || "–"}`
                )
        );

        const sourceDeviceIds =
            getUniqueValues(
                records.map(record =>
                    record &&
                    record.SourceDeviceId
                )
            );

        const sourceDeviceOk =
            sourceDeviceIds.length === 1 &&
            sourceDeviceIds[0] ===
                manifestDeviceId;

        addCheck(
            checks,
            "sourceDeviceIds",
            "Record → SourceDeviceId",
            sourceDeviceOk,
            sourceDeviceOk
                ? `Alle Datensätze stammen laut Paket von ${manifestDeviceId}.`
                : (
                    `Gefundene SourceDeviceIds: ${sourceDeviceIds.join(", ") || "–"}`
                )
        );

        return {
            records,
            manifestBatchId,
            manifestDeviceId
        };
    }

    async function verifyPackage(file) {
        if (
            typeof global.JSZip !==
            "function"
        ) {
            throw new Error(
                "JSZip konnte nicht geladen werden."
            );
        }

        if (!file) {
            throw new Error(
                "Es wurde keine ZIP-Datei ausgewählt."
            );
        }

        const checks = [];

        let zip;

        try {
            zip =
                await global.JSZip.loadAsync(
                    file
                );
        }
        catch (error) {
            throw new Error(
                `ZIP-Datei konnte nicht geöffnet werden: ${error.message}`
            );
        }

        const manifestEntry =
            zip.file(
                "manifest.json"
            );

        const trackingEntry =
            zip.file(
                "tracking-data.json"
            );

        if (!manifestEntry) {
            throw new Error(
                "manifest.json fehlt im Migrationspaket."
            );
        }

        if (!trackingEntry) {
            throw new Error(
                "tracking-data.json fehlt im Migrationspaket."
            );
        }

        const manifestText =
            await manifestEntry.async(
                "string"
            );

        const trackingText =
            await trackingEntry.async(
                "string"
            );

        const manifest =
            parseJsonFile(
                manifestText,
                "manifest.json"
            );

        const trackingPayload =
            parseJsonFile(
                trackingText,
                "tracking-data.json"
            );

        const structure =
            validatePackageStructure(
                manifest,
                trackingPayload,
                checks
            );

        const actualTrackingHash =
            await sha256Text(
                canonicalJson(
                    trackingPayload
                )
            );

        const expectedTrackingHash =
            normalizeHash(
                manifest.TrackingDataHash
            );

        const trackingHashOk =
            Boolean(
                expectedTrackingHash
            ) &&
            expectedTrackingHash ===
                normalizeHash(
                    actualTrackingHash
                );

        addCheck(
            checks,
            "trackingHash",
            "TrackingDataHash",
            trackingHashOk,
            trackingHashOk
                ? actualTrackingHash
                : (
                    `Erwartet: ${expectedTrackingHash || "–"} · Berechnet: ${actualTrackingHash}`
                )
        );

        const manifestWithoutPackageHash =
            getManifestWithoutPackageHash(
                manifest
            );

        const actualPackageHash =
            await sha256Text(
                canonicalJson(
                    manifestWithoutPackageHash
                )
            );

        const expectedPackageHash =
            normalizeHash(
                manifest.PackageHash
            );

        const packageHashOk =
            Boolean(
                expectedPackageHash
            ) &&
            expectedPackageHash ===
                normalizeHash(
                    actualPackageHash
                );

        addCheck(
            checks,
            "packageHash",
            "PackageHash",
            packageHashOk,
            packageHashOk
                ? actualPackageHash
                : (
                    `Erwartet: ${expectedPackageHash || "–"} · Berechnet: ${actualPackageHash}`
                )
        );

        const recordHashVerification =
            await verifyRecordHashes(
                trackingPayload,
                manifest,
                checks
            );

        const imageVerification =
            await verifyImageFiles(
                zip,
                manifest,
                trackingPayload,
                checks
            );

        const criticalFailures =
            checks.filter(
                check =>
                    !check.ok &&
                    check.severity ===
                        "ERROR"
            );

        return {
            valid:
                criticalFailures.length ===
                0,
            checks,
            manifest,
            trackingPayload,
            records:
                structure.records,
            batchId:
                structure.manifestBatchId,
            deviceId:
                structure.manifestDeviceId,
            packageHash:
                normalizeHash(
                    manifest.PackageHash
                ),
            file,
            fileName:
                file.name,
            fileSize:
                file.size,
            recordHashVerification,
            imageVerification
        };
    }

    global.TeiletrackingMigrationImportService =
        Object.freeze({
            verifyPackage,
            canonicalJson,
            sha256Text
        });
})(window);

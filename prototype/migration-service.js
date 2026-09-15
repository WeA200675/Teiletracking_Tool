"use strict";

(function initializeMigrationService(global) {
    function getMigrationConfig() {
        const config =
            global.TeiletrackingDataService
                .getConfiguration();

        return {
            AppVersion:
                String(
                    config.Migration &&
                    config.Migration.AppVersion
                        ? config.Migration.AppVersion
                        : "0.1.0"
                ),
            SchemaVersion:
                Number(
                    config.Migration &&
                    config.Migration.SchemaVersion
                        ? config.Migration.SchemaVersion
                        : 1
                ),
            PackageFormatVersion:
                Number(
                    config.Migration &&
                    config.Migration.PackageFormatVersion
                        ? config.Migration.PackageFormatVersion
                        : 1
                )
        };
    }

    function normalizeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .trim()
            .toUpperCase();
    }

    function normalizeDescription(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

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
        const bytes =
            new TextEncoder()
                .encode(
                    String(text)
                );

        return sha256Bytes(bytes);
    }

    function dataUrlToUint8Array(dataUrl) {
        const match =
            String(dataUrl || "")
                .match(
                    /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i
                );

        if (!match) {
            throw new Error(
                "Gespeichertes Labelbild hat kein unterstütztes Data-URL-Format."
            );
        }

        const mimeType =
            match[1] ||
            "application/octet-stream";

        const binary =
            global.atob(match[2]);

        const bytes =
            new Uint8Array(
                binary.length
            );

        for (
            let index = 0;
            index < binary.length;
            index += 1
        ) {
            bytes[index] =
                binary.charCodeAt(index);
        }

        return {
            mimeType,
            bytes
        };
    }

    function getImageExtension(mimeType) {
        const normalized =
            String(mimeType || "")
                .toLowerCase();

        if (normalized.includes("png")) {
            return "png";
        }

        if (normalized.includes("webp")) {
            return "webp";
        }

        return "jpg";
    }

    function sanitizeFileName(value) {
        return String(value || "")
            .replace(
                /[^A-Z0-9._-]/gi,
                "_"
            );
    }

    function getUtcStamp(date) {
        const value =
            date instanceof Date
                ? date
                : new Date(date);

        return value
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}Z$/, "Z");
    }

    function createRandomSuffix() {
        if (
            global.crypto &&
            typeof global.crypto.randomUUID ===
                "function"
        ) {
            return global.crypto
                .randomUUID()
                .replace(/-/g, "")
                .slice(0, 10)
                .toUpperCase();
        }

        return Math.random()
            .toString(16)
            .slice(2, 12)
            .toUpperCase();
    }

    function createBatchId(
        deviceId,
        createdAt
    ) {
        return (
            `BATCH-${getUtcStamp(createdAt)}-` +
            `${sanitizeFileName(deviceId)}-` +
            createRandomSuffix()
        );
    }

    function createRecordId(
        deviceId,
        capturedAt
    ) {
        return (
            `REC-${getUtcStamp(capturedAt)}-` +
            `${sanitizeFileName(deviceId)}-` +
            createRandomSuffix()
        );
    }

    function createMigrationRecordBase(
        record,
        batchId
    ) {
        return {
            RecordId:
                normalizeDescription(
                    record.SourceRecordId
                ),
            BatchId:
                batchId,
            SourceDeviceId:
                normalizeDescription(
                    record.SourceDeviceId
                ),
            SourceOrigin:
                normalizeDescription(
                    record.SourceOrigin ||
                    "UNKNOWN"
                ),
            CapturedAt:
                record.CapturedAt ||
                record.SavedAt ||
                null,
            SavedAt:
                record.SavedAt ||
                null,
            PartNumber:
                normalizeText(
                    record.PartNumber
                ),
            SerialNumber:
                normalizeText(
                    record.SerialNumber
                ),
            LabelPartNumber:
                normalizeText(
                    record.LabelPartNumber
                ),
            QRPartNumber:
                normalizeText(
                    record.QRPartNumber
                ),
            LabelSerialNumber:
                normalizeText(
                    record.LabelSerialNumber
                ),
            QRSerialNumber:
                normalizeText(
                    record.QRSerialNumber
                ),
            Derivat:
                normalizeText(
                    record.Derivat
                ),
            IStufe:
                normalizeText(
                    record.IStufe
                ),
            ATS:
                normalizeText(
                    record.ATS
                ),
            YNummer:
                normalizeText(
                    record.YNummer
                ),
            PartStatuses:
                Array.isArray(
                    record.PartStatuses
                )
                    ? record.PartStatuses
                        .map(normalizeText)
                        .filter(Boolean)
                        .sort()
                    : String(
                        record.Teilestatus ||
                        ""
                    )
                        .split(/[;,|]/)
                        .map(normalizeText)
                        .filter(Boolean),
            Teilestatus:
                Array.isArray(
                    record.PartStatuses
                )
                    ? record.PartStatuses
                        .map(normalizeText)
                        .filter(Boolean)
                        .sort()
                        .join(";")
                    : normalizeText(
                        record.Teilestatus
                    ),
            TransferBatchId:
                normalizeDescription(
                    record.TransferBatchId
                ),
            TransferSourceRecordId:
                normalizeDescription(
                    record.TransferSourceRecordId
                ),
            LabelHardware:
                normalizeText(
                    record.LabelHardware
                ),
            QRHardware:
                normalizeText(
                    record.QRHardware
                ),
            LabelSoftware:
                normalizeText(
                    record.LabelSoftware
                ),
            QRSoftware:
                normalizeText(
                    record.QRSoftware
                ),
            DeviceKey:
                normalizeText(
                    record.DeviceKey
                ),
            AssignmentKey:
                normalizeText(
                    record.AssignmentKey
                ),
            DuplicateStatus:
                normalizeText(
                    record.DuplicateStatus ||
                    "NEW"
                ),
            ValidationStatus:
                normalizeText(
                    record.ValidationStatus ||
                    "OK"
                ),
            DoppelDerivat:
                Boolean(
                    record.DoppelDerivat
                ),
            MismatchFields:
                Array.isArray(
                    record.MismatchFields
                )
                    ? record.MismatchFields
                        .map(
                            normalizeDescription
                        )
                    : []
        };
    }

    async function prepareMigrationRecord(
        record,
        batchId
    ) {
        const base =
            createMigrationRecordBase(
                record,
                batchId
            );

        let imageDescriptor = null;

        if (base.RecordId) {
            const dataUrl =
                await global
                    .TeiletrackingDataService
                    .getLabelImage(
                        base.RecordId
                    );

            if (dataUrl) {
                const {
                    mimeType,
                    bytes
                } = dataUrlToUint8Array(
                    dataUrl
                );

                const extension =
                    getImageExtension(
                        mimeType
                    );

                const fileName =
                    `images/${sanitizeFileName(base.RecordId)}.${extension}`;

                const imageHash =
                    await sha256Bytes(
                        bytes
                    );

                imageDescriptor = {
                    fileName,
                    mimeType,
                    bytes,
                    hash: imageHash
                };

                base.LabelImageFile =
                    fileName;

                base.LabelImageHash =
                    imageHash;
            }
        }

        const stableRecordForHash = {
            ...base
        };

        delete stableRecordForHash.BatchId;

        const recordHash =
            await sha256Text(
                canonicalJson(
                    stableRecordForHash
                )
            );

        return {
            migrationRecord: {
                ...base,
                RecordHash:
                    recordHash
            },
            imageDescriptor
        };
    }

    async function exportPackage(records) {
        if (
            typeof global.JSZip !==
            "function"
        ) {
            throw new Error(
                "JSZip konnte nicht geladen werden. Das Migrationspaket kann nicht erzeugt werden."
            );
        }

        if (
            !Array.isArray(records) ||
            records.length === 0
        ) {
            throw new Error(
                "Es sind keine lokalen Tracking-Datensätze für ein Migrationspaket vorhanden."
            );
        }

        const migrationConfig =
            getMigrationConfig();

        const deviceId =
            global.TeiletrackingDataService
                .getOrCreateDeviceId();

        const createdAt =
            new Date();

        const batchId =
            createBatchId(
                deviceId,
                createdAt
            );

        const preparedRecords = [];
        const images = [];

        for (const record of records) {
            const prepared =
                await prepareMigrationRecord(
                    record,
                    batchId
                );

            preparedRecords.push(
                prepared.migrationRecord
            );

            if (prepared.imageDescriptor) {
                images.push(
                    prepared.imageDescriptor
                );
            }
        }

        const featureMasterData =
            global.TeiletrackingFeatureService &&
            typeof global.TeiletrackingFeatureService
                .getMigrationSnapshot ===
                "function"
                ? global.TeiletrackingFeatureService
                    .getMigrationSnapshot()
                : {
                    ATS: [],
                    YNummern: [],
                    Statuswerte: []
                };

        const trackingPayload = {
            Format:
                "teiletracking.migration.data",
            SchemaVersion:
                migrationConfig.SchemaVersion,
            BatchId:
                batchId,
            DeviceId:
                deviceId,
            RecordCount:
                preparedRecords.length,
            FeatureMasterData:
                featureMasterData,
            Records:
                preparedRecords
        };

        const trackingJson =
            JSON.stringify(
                trackingPayload,
                null,
                2
            );

        const trackingDataHash =
            await sha256Text(
                canonicalJson(
                    trackingPayload
                )
            );

        const imageHashes =
            images
                .map(image => ({
                    File:
                        image.fileName,
                    Hash:
                        image.hash
                }))
                .sort(
                    (left, right) =>
                        left.File.localeCompare(
                            right.File
                        )
                );

        const manifestBase = {
            Format:
                "teiletracking.migration.package",
            PackageFormatVersion:
                migrationConfig
                    .PackageFormatVersion,
            SchemaVersion:
                migrationConfig.SchemaVersion,
            AppVersion:
                migrationConfig.AppVersion,
            BatchId:
                batchId,
            DeviceId:
                deviceId,
            CreatedAt:
                createdAt.toISOString(),
            RecordCount:
                preparedRecords.length,
            ImageCount:
                images.length,
            TrackingDataFile:
                "tracking-data.json",
            TrackingDataHash:
                trackingDataHash,
            ImageHashes:
                imageHashes,
            HashAlgorithm:
                "SHA-256",
            RecordHashScope:
                "Canonical record without RecordHash and BatchId",
            HashScope:
                "Canonical manifest without PackageHash + TrackingDataHash + sorted image hashes"
        };

        const packageHash =
            await sha256Text(
                canonicalJson(
                    manifestBase
                )
            );

        const manifest = {
            ...manifestBase,
            PackageHash:
                packageHash
        };

        const zip =
            new global.JSZip();

        zip.file(
            "manifest.json",
            JSON.stringify(
                manifest,
                null,
                2
            )
        );

        zip.file(
            "tracking-data.json",
            trackingJson
        );

        for (const image of images) {
            zip.file(
                image.fileName,
                image.bytes,
                {
                    binary: true
                }
            );
        }

        const packageBlob =
            await zip.generateAsync(
                {
                    type: "blob",
                    compression:
                        "DEFLATE",
                    compressionOptions: {
                        level: 6
                    }
                }
            );

        const shortDeviceId =
            sanitizeFileName(deviceId)
                .slice(-18);

        const fileName =
            `TrackingBatch_${getUtcStamp(createdAt)}_${shortDeviceId}.zip`;

        global.TeiletrackingDataService
            .downloadBlobFile(
                fileName,
                packageBlob
            );

        return {
            fileName,
            batchId,
            deviceId,
            recordCount:
                preparedRecords.length,
            imageCount:
                images.length,
            packageHash
        };
    }

    global.TeiletrackingMigrationService =
        Object.freeze({
            createRecordId,
            exportPackage
        });
})(window);

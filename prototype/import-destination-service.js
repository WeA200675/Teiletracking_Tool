"use strict";

(function initializeImportDestinationService(global) {
    const DEFAULT_CONFIG = Object.freeze({
        Provider:
            "LOCAL_MOCK",
        LocalMock: {
            DatabaseName:
                "teiletracking.pcImporter.v1",
            DatabaseVersion:
                1
        },
        SharePoint: {
            Lists: {
                ImportBatches:
                    "ImportBatches",
                Steuergeraete:
                    "Steuergeraete"
            },
            Libraries: {
                TrackingImportArchiv:
                    "TrackingImportArchiv"
            }
        }
    });

    let activeConfig = null;
    let activeProvider = null;

    function clone(value) {
        return JSON.parse(
            JSON.stringify(value)
        );
    }

    function mergeConfig(
        supplied
    ) {
        const result =
            clone(
                DEFAULT_CONFIG
            );

        if (
            !supplied ||
            typeof supplied !==
                "object"
        ) {
            return result;
        }

        if (
            typeof supplied.Provider ===
                "string" &&
            supplied.Provider.trim()
        ) {
            result.Provider =
                supplied.Provider
                    .trim()
                    .toUpperCase();
        }

        if (
            supplied.LocalMock &&
            typeof supplied.LocalMock ===
                "object"
        ) {
            result.LocalMock = {
                ...result.LocalMock,
                ...supplied.LocalMock
            };
        }

        if (
            supplied.SharePoint &&
            typeof supplied.SharePoint ===
                "object"
        ) {
            result.SharePoint = {
                ...result.SharePoint,
                ...supplied.SharePoint,
                Lists: {
                    ...result.SharePoint.Lists,
                    ...(supplied.SharePoint.Lists || {})
                },
                Libraries: {
                    ...result.SharePoint.Libraries,
                    ...(supplied.SharePoint.Libraries || {})
                }
            };
        }

        return result;
    }

    async function loadConfig(
        configUrl
    ) {
        try {
            const response =
                await fetch(
                    configUrl,
                    {
                        cache:
                            "no-store"
                    }
                );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            return mergeConfig(
                await response.json()
            );
        }
        catch (error) {
            console.warn(
                "import-config.json konnte nicht geladen werden. LOCAL_MOCK wird verwendet.",
                error
            );

            return clone(
                DEFAULT_CONFIG
            );
        }
    }

    function openLocalDatabase(
        config
    ) {
        return new Promise(
            (resolve, reject) => {
                if (!global.indexedDB) {
                    reject(
                        new Error(
                            "IndexedDB wird von diesem Browser nicht unterstützt."
                        )
                    );
                    return;
                }

                const request =
                    global.indexedDB.open(
                        config.DatabaseName,
                        Number(
                            config.DatabaseVersion
                        ) || 1
                    );

                request.onupgradeneeded =
                    event => {
                        const database =
                            event.target.result;

                        if (
                            !database.objectStoreNames
                                .contains(
                                    "batches"
                                )
                        ) {
                            database.createObjectStore(
                                "batches",
                                {
                                    keyPath:
                                        "BatchId"
                                }
                            );
                        }

                        if (
                            !database.objectStoreNames
                                .contains(
                                    "records"
                                )
                        ) {
                            const store =
                                database.createObjectStore(
                                    "records",
                                    {
                                        keyPath:
                                            "RecordId"
                                    }
                                );

                            store.createIndex(
                                "BatchId",
                                "ImportedBatchId",
                                {
                                    unique:
                                        false
                                }
                            );
                        }

                        if (
                            !database.objectStoreNames
                                .contains(
                                    "packages"
                                )
                        ) {
                            database.createObjectStore(
                                "packages",
                                {
                                    keyPath:
                                        "BatchId"
                                }
                            );
                        }
                    };

                request.onsuccess =
                    () => resolve(
                        request.result
                    );

                request.onerror =
                    () => reject(
                        request.error ||
                        new Error(
                            "Lokale Importdatenbank konnte nicht geöffnet werden."
                        )
                    );
            }
        );
    }

    async function withStore(
        database,
        storeName,
        mode,
        operation
    ) {
        return new Promise(
            (resolve, reject) => {
                const transaction =
                    database.transaction(
                        storeName,
                        mode
                    );

                const store =
                    transaction.objectStore(
                        storeName
                    );

                try {
                    operation(
                        store,
                        resolve,
                        reject
                    );
                }
                catch (error) {
                    reject(error);
                }

                transaction.onerror =
                    () => reject(
                        transaction.error ||
                        new Error(
                            `Transaktion auf ${storeName} ist fehlgeschlagen.`
                        )
                    );

                transaction.onabort =
                    () => reject(
                        transaction.error ||
                        new Error(
                            `Transaktion auf ${storeName} wurde abgebrochen.`
                        )
                    );
            }
        );
    }

    async function getByKey(
        database,
        storeName,
        key
    ) {
        return withStore(
            database,
            storeName,
            "readonly",
            (
                store,
                resolve,
                reject
            ) => {
                const request =
                    store.get(key);

                request.onsuccess =
                    () => resolve(
                        request.result ||
                        null
                    );

                request.onerror =
                    () => reject(
                        request.error
                    );
            }
        );
    }

    async function getAll(
        database,
        storeName
    ) {
        return withStore(
            database,
            storeName,
            "readonly",
            (
                store,
                resolve,
                reject
            ) => {
                const request =
                    store.getAll();

                request.onsuccess =
                    () => resolve(
                        Array.isArray(
                            request.result
                        )
                            ? request.result
                            : []
                    );

                request.onerror =
                    () => reject(
                        request.error
                    );
            }
        );
    }

    async function putOne(
        database,
        storeName,
        value
    ) {
        return withStore(
            database,
            storeName,
            "readwrite",
            (
                store,
                resolve,
                reject
            ) => {
                const request =
                    store.put(value);

                request.onsuccess =
                    () => resolve(true);

                request.onerror =
                    () => reject(
                        request.error
                    );
            }
        );
    }

    function createLocalMockProvider(
        config
    ) {
        async function openDatabase() {
            return openLocalDatabase(
                config.LocalMock
            );
        }

        return Object.freeze({
            info: Object.freeze({
                key:
                    "LOCAL_MOCK",
                displayName:
                    "Lokaler PC-Testimport",
                isProduction:
                    false
            }),

            async getBatch(batchId) {
                const database =
                    await openDatabase();

                try {
                    return await getByKey(
                        database,
                        "batches",
                        batchId
                    );
                }
                finally {
                    database.close();
                }
            },

            async getRecordsByIds(
                recordIds
            ) {
                const database =
                    await openDatabase();

                try {
                    const results =
                        new Map();

                    for (
                        const recordId of
                        recordIds
                    ) {
                        const record =
                            await getByKey(
                                database,
                                "records",
                                recordId
                            );

                        if (record) {
                            results.set(
                                recordId,
                                record
                            );
                        }
                    }

                    return results;
                }
                finally {
                    database.close();
                }
            },

            async listBatches() {
                const database =
                    await openDatabase();

                try {
                    const batches =
                        await getAll(
                            database,
                            "batches"
                        );

                    return batches.sort(
                        (left, right) =>
                            String(
                                right.ImportedAt ||
                                ""
                            ).localeCompare(
                                String(
                                    left.ImportedAt ||
                                    ""
                                )
                            )
                    );
                }
                finally {
                    database.close();
                }
            },

            async importVerifiedPackage(
                verifiedPackage,
                importedBy,
                preflight
            ) {
                const database =
                    await openDatabase();

                const importedAt =
                    new Date()
                        .toISOString();

                const newRecords =
                    preflight.recordResults
                        .filter(result =>
                            result.action ===
                                "IMPORT"
                        )
                        .map(result =>
                            result.record
                        );

                try {
                    for (
                        const record of
                        newRecords
                    ) {
                        await putOne(
                            database,
                            "records",
                            {
                                ...record,
                                ImportedBatchId:
                                    verifiedPackage
                                        .batchId,
                                ImportedAt:
                                    importedAt,
                                ImportedBy:
                                    importedBy
                            }
                        );
                    }

                    await putOne(
                        database,
                        "packages",
                        {
                            BatchId:
                                verifiedPackage
                                    .batchId,
                            PackageHash:
                                verifiedPackage
                                    .packageHash,
                            FileName:
                                verifiedPackage
                                    .fileName,
                            FileSize:
                                verifiedPackage
                                    .fileSize,
                            Blob:
                                verifiedPackage.file,
                            ArchivedAt:
                                importedAt
                        }
                    );

                    const batchRecord = {
                        BatchId:
                            verifiedPackage
                                .batchId,
                        DeviceId:
                            verifiedPackage
                                .deviceId,
                        PackageHash:
                            verifiedPackage
                                .packageHash,
                        CreatedAt:
                            verifiedPackage
                                .manifest
                                .CreatedAt ||
                            null,
                        ImportedAt:
                            importedAt,
                        ImportedBy:
                            importedBy,
                        AppVersion:
                            verifiedPackage
                                .manifest
                                .AppVersion ||
                            "",
                        SchemaVersion:
                            verifiedPackage
                                .manifest
                                .SchemaVersion ||
                            null,
                        PackageFormatVersion:
                            verifiedPackage
                                .manifest
                                .PackageFormatVersion ||
                            null,
                        RecordCount:
                            verifiedPackage
                                .records
                                .length,
                        ImportedCount:
                            newRecords.length,
                        SkippedDuplicateCount:
                            preflight
                                .duplicateCount,
                        ConflictCount:
                            preflight
                                .conflictCount,
                        ImageCount:
                            Number(
                                verifiedPackage
                                    .manifest
                                    .ImageCount ||
                                0
                            ),
                        FileName:
                            verifiedPackage
                                .fileName,
                        Status:
                            preflight
                                .conflictCount >
                            0
                                ? "CONFLICT"
                                : "IMPORTED"
                    };

                    await putOne(
                        database,
                        "batches",
                        batchRecord
                    );

                    return batchRecord;
                }
                finally {
                    database.close();
                }
            }
        });
    }

    function createSharePointProvider(
        config
    ) {
        const info =
            Object.freeze({
                key:
                    "SHAREPOINT",
                displayName:
                    "SharePoint Online",
                isProduction:
                    true,
                lists:
                    clone(
                        config.SharePoint
                            .Lists
                    ),
                libraries:
                    clone(
                        config.SharePoint
                            .Libraries
                    )
            });

        function notImplemented() {
            throw new Error(
                "Der SharePoint-Importprovider ist vorbereitet, aber noch nicht aktiviert. " +
                "Der nächste Schritt ersetzt diese Methoden durch SPFx/PnPjs-Aufrufe."
            );
        }

        return Object.freeze({
            info,
            getBatch:
                notImplemented,
            getRecordsByIds:
                notImplemented,
            listBatches:
                notImplemented,
            importVerifiedPackage:
                notImplemented
        });
    }

    async function initialize(
        configUrl =
            "./import-config.json"
    ) {
        activeConfig =
            await loadConfig(
                configUrl
            );

        const provider =
            String(
                activeConfig.Provider ||
                "LOCAL_MOCK"
            )
                .trim()
                .toUpperCase();

        if (
            provider ===
            "LOCAL_MOCK"
        ) {
            activeProvider =
                createLocalMockProvider(
                    activeConfig
                );
        }
        else if (
            provider ===
            "SHAREPOINT"
        ) {
            activeProvider =
                createSharePointProvider(
                    activeConfig
                );
        }
        else {
            throw new Error(
                `Unbekannter Importprovider '${provider}'.`
            );
        }

        return getProviderInfo();
    }

    function ensureInitialized() {
        if (!activeProvider) {
            throw new Error(
                "ImportDestinationService wurde noch nicht initialisiert."
            );
        }
    }

    function getProviderInfo() {
        ensureInitialized();

        return clone(
            activeProvider.info
        );
    }

    async function preflight(
        verifiedPackage
    ) {
        ensureInitialized();

        const existingBatch =
            await activeProvider
                .getBatch(
                    verifiedPackage
                        .batchId
                );

        if (existingBatch) {
            const sameHash =
                String(
                    existingBatch
                        .PackageHash ||
                    ""
                )
                    .toUpperCase() ===
                String(
                    verifiedPackage
                        .packageHash ||
                    ""
                )
                    .toUpperCase();

            return {
                batchStatus:
                    sameHash
                        ? "ALREADY_IMPORTED"
                        : "BATCH_CONFLICT",
                existingBatch,
                recordResults: [],
                importCount: 0,
                duplicateCount: 0,
                conflictCount:
                    sameHash
                        ? 0
                        : 1
            };
        }

        const recordIds =
            verifiedPackage.records
                .map(record =>
                    String(
                        record.RecordId ||
                        ""
                    ).trim()
                )
                .filter(Boolean);

        const existingRecords =
            await activeProvider
                .getRecordsByIds(
                    recordIds
                );

        const recordResults = [];
        let importCount = 0;
        let duplicateCount = 0;
        let conflictCount = 0;

        for (
            const record of
            verifiedPackage.records
        ) {
            const recordId =
                String(
                    record.RecordId ||
                    ""
                ).trim();

            const existing =
                existingRecords.get(
                    recordId
                );

            if (!existing) {
                importCount += 1;

                recordResults.push({
                    action:
                        "IMPORT",
                    record,
                    existing:
                        null
                });

                continue;
            }

            const existingHash =
                String(
                    existing.RecordHash ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            const incomingHash =
                String(
                    record.RecordHash ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            if (
                existingHash &&
                incomingHash &&
                existingHash ===
                    incomingHash
            ) {
                duplicateCount += 1;

                recordResults.push({
                    action:
                        "SKIP_DUPLICATE",
                    record,
                    existing
                });

                continue;
            }

            conflictCount += 1;

            recordResults.push({
                action:
                    "CONFLICT",
                record,
                existing
            });
        }

        return {
            batchStatus:
                conflictCount > 0
                    ? "RECORD_CONFLICT"
                    : "READY",
            existingBatch:
                null,
            recordResults,
            importCount,
            duplicateCount,
            conflictCount
        };
    }

    async function listBatches() {
        ensureInitialized();

        return (
            activeProvider
                .listBatches()
        );
    }

    async function importVerifiedPackage(
        verifiedPackage,
        importedBy,
        preflightResult
    ) {
        ensureInitialized();

        const normalizedImportedBy =
            String(
                importedBy ||
                ""
            ).trim();

        if (!normalizedImportedBy) {
            throw new Error(
                "Bitte eine Importeur-Kennung angeben."
            );
        }

        if (
            preflightResult.batchStatus !==
            "READY"
        ) {
            throw new Error(
                "Dieses Paket ist nicht für den Import freigegeben."
            );
        }

        if (
            preflightResult.conflictCount >
            0
        ) {
            throw new Error(
                "Der Import enthält RecordId-Konflikte und wurde blockiert."
            );
        }

        return (
            activeProvider
                .importVerifiedPackage(
                    verifiedPackage,
                    normalizedImportedBy,
                    preflightResult
                )
        );
    }

    global.TeiletrackingImportDestinationService =
        Object.freeze({
            initialize,
            getProviderInfo,
            preflight,
            listBatches,
            importVerifiedPackage
        });
})(window);

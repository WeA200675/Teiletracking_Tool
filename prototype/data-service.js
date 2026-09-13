"use strict";

(function initializeDataService(global) {
    const DEFAULT_CONFIG = Object.freeze({
        Provider: "LOCAL",
        Local: {
            BaseMasterDataUrl:
                "../tests/data/MasterData.json",
            BaseTrackingDataUrl:
                "../tests/data/TrackingData.json",
            MasterDataStorageKey:
                "teiletracking.masterData.v2",
            LegacyMasterDataStorageKey:
                "teiletracking.masterData.v1",
            TrackingStorageKey:
                "teiletracking.tracking.v1"
        },
        SharePoint: {
            Lists: {
                Derivate: "Derivate",
                IStufen: "IStufen",
                Steuergeraete: "Steuergeraete"
            }
        },
        Migration: {
            AppVersion: "0.1.0",
            SchemaVersion: 1,
            PackageFormatVersion: 1,
            DeviceIdStorageKey:
                "teiletracking.deviceId.v1",
            DeviceIdPrefix: "DEV"
        }
    });

    let activeConfig = null;
    let activeProvider = null;
    let initialized = false;

    function clone(value) {
        return JSON.parse(
            JSON.stringify(value)
        );
    }

    function mergeConfig(
        defaults,
        supplied
    ) {
        const result =
            clone(defaults);

        if (
            !supplied ||
            typeof supplied !== "object"
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
            supplied.Local &&
            typeof supplied.Local === "object"
        ) {
            result.Local = {
                ...result.Local,
                ...supplied.Local
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
                }
            };
        }

        if (
            supplied.Migration &&
            typeof supplied.Migration === "object"
        ) {
            result.Migration = {
                ...result.Migration,
                ...supplied.Migration
            };
        }

        return result;
    }

    async function fetchJson(
        url,
        errorMessage
    ) {
        const response =
            await fetch(
                url,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `${errorMessage} (HTTP ${response.status})`
            );
        }

        return response.json();
    }

    function readStorageJson(
        key,
        fallbackValue
    ) {
        try {
            const stored =
                global.localStorage.getItem(
                    key
                );

            if (!stored) {
                return clone(
                    fallbackValue
                );
            }

            return JSON.parse(stored);
        }
        catch (error) {
            console.error(
                `Lokale Daten konnten nicht gelesen werden (${key}):`,
                error
            );

            return clone(
                fallbackValue
            );
        }
    }

    function writeStorageJson(
        key,
        value
    ) {
        global.localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    }

    function removeStorageKey(key) {
        global.localStorage.removeItem(
            key
        );
    }

    function createRecordId() {
        if (
            typeof global.crypto !==
                "undefined" &&
            typeof global.crypto.randomUUID ===
                "function"
        ) {
            return global.crypto.randomUUID();
        }

        return (
            `local-${Date.now()}-` +
            Math.random()
                .toString(16)
                .slice(2)
        );
    }

    function downloadTextFile(
        fileName,
        content,
        mimeType
    ) {
        const blob =
            new Blob(
                [content],
                {
                    type: mimeType
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement("a");

        link.href = url;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    function downloadBlobFile(
        fileName,
        blob
    ) {
        if (!(blob instanceof Blob)) {
            throw new Error(
                "downloadBlobFile erwartet ein Blob-Objekt."
            );
        }

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    function createEmptyLocalMasterData() {
        return {
            Derivate: [],
            IStufen: [],
            AktivOverrides: {
                Derivate: {},
                IStufen: {}
            }
        };
    }

    function getMigrationConfig() {
        if (!activeConfig) {
            return clone(
                DEFAULT_CONFIG.Migration
            );
        }

        return {
            ...DEFAULT_CONFIG.Migration,
            ...(activeConfig.Migration || {})
        };
    }

    function getOrCreateDeviceId() {
        const migrationConfig =
            getMigrationConfig();

        const storageKey =
            migrationConfig.DeviceIdStorageKey ||
            "teiletracking.deviceId.v1";

        const prefix =
            String(
                migrationConfig.DeviceIdPrefix ||
                "DEV"
            )
                .trim()
                .toUpperCase();

        const existing =
            String(
                global.localStorage.getItem(
                    storageKey
                ) || ""
            ).trim();

        if (existing) {
            return existing;
        }

        const rawId =
            typeof global.crypto !== "undefined" &&
            typeof global.crypto.randomUUID === "function"
                ? global.crypto.randomUUID()
                : (
                    `${Date.now()}-` +
                    Math.random().toString(16).slice(2) +
                    "-" +
                    Math.random().toString(16).slice(2)
                );

        const deviceId =
            `${prefix}-${rawId}`
                .toUpperCase();

        global.localStorage.setItem(
            storageKey,
            deviceId
        );

        return deviceId;
    }

    const BINARY_DB_NAME =
        "teiletracking.binary.v1";

    const BINARY_DB_VERSION = 1;

    const LABEL_IMAGE_STORE =
        "labelImages";

    function openBinaryDatabase() {
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
                        BINARY_DB_NAME,
                        BINARY_DB_VERSION
                    );

                request.onupgradeneeded =
                    event => {
                        const database =
                            event.target.result;

                        if (
                            !database.objectStoreNames
                                .contains(
                                    LABEL_IMAGE_STORE
                                )
                        ) {
                            database.createObjectStore(
                                LABEL_IMAGE_STORE,
                                {
                                    keyPath: "RecordId"
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
                            "Bildspeicher konnte nicht geöffnet werden."
                        )
                    );
            }
        );
    }

    async function runImageStoreTransaction(
        mode,
        callback
    ) {
        const database =
            await openBinaryDatabase();

        try {
            return await new Promise(
                (resolve, reject) => {
                    const transaction =
                        database.transaction(
                            LABEL_IMAGE_STORE,
                            mode
                        );

                    const store =
                        transaction.objectStore(
                            LABEL_IMAGE_STORE
                        );

                    try {
                        callback(
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
                                "Bildspeicher-Transaktion ist fehlgeschlagen."
                            )
                        );

                    transaction.onabort =
                        () => reject(
                            transaction.error ||
                            new Error(
                                "Bildspeicher-Transaktion wurde abgebrochen."
                            )
                        );
                }
            );
        }
        finally {
            database.close();
        }
    }

    async function saveLabelImage(
        recordId,
        dataUrl
    ) {
        const normalizedRecordId =
            String(recordId || "").trim();

        const normalizedDataUrl =
            String(dataUrl || "").trim();

        if (
            !normalizedRecordId ||
            !normalizedDataUrl
        ) {
            return false;
        }

        await runImageStoreTransaction(
            "readwrite",
            (store, resolve, reject) => {
                const request =
                    store.put({
                        RecordId:
                            normalizedRecordId,
                        DataUrl:
                            normalizedDataUrl,
                        SavedAt:
                            new Date()
                                .toISOString()
                    });

                request.onsuccess =
                    () => resolve(true);

                request.onerror =
                    () => reject(
                        request.error
                    );
            }
        );

        return true;
    }

    async function getLabelImage(
        recordId
    ) {
        const normalizedRecordId =
            String(recordId || "").trim();

        if (!normalizedRecordId) {
            return null;
        }

        return runImageStoreTransaction(
            "readonly",
            (store, resolve, reject) => {
                const request =
                    store.get(
                        normalizedRecordId
                    );

                request.onsuccess =
                    () => resolve(
                        request.result &&
                        request.result.DataUrl
                            ? request.result.DataUrl
                            : null
                    );

                request.onerror =
                    () => reject(
                        request.error
                    );
            }
        );
    }

    async function deleteLabelImage(
        recordId
    ) {
        const normalizedRecordId =
            String(recordId || "").trim();

        if (!normalizedRecordId) {
            return false;
        }

        await runImageStoreTransaction(
            "readwrite",
            (store, resolve, reject) => {
                const request =
                    store.delete(
                        normalizedRecordId
                    );

                request.onsuccess =
                    () => resolve(true);

                request.onerror =
                    () => reject(
                        request.error
                    );
            }
        );

        return true;
    }

    function createLocalProvider(config) {
        const localConfig =
            config.Local;

        async function loadLocalMasterData() {
            const current =
                readStorageJson(
                    localConfig
                        .MasterDataStorageKey,
                    null
                );

            if (
                current &&
                typeof current === "object"
            ) {
                return current;
            }

            const legacy =
                readStorageJson(
                    localConfig
                        .LegacyMasterDataStorageKey,
                    null
                );

            if (
                !legacy ||
                typeof legacy !== "object"
            ) {
                return (
                    createEmptyLocalMasterData()
                );
            }

            const migrated = {
                Derivate:
                    Array.isArray(
                        legacy.Derivate
                    )
                        ? legacy.Derivate
                        : [],
                IStufen:
                    Array.isArray(
                        legacy.IStufen
                    )
                        ? legacy.IStufen
                        : [],
                AktivOverrides: {
                    Derivate: {},
                    IStufen: {}
                }
            };

            writeStorageJson(
                localConfig
                    .MasterDataStorageKey,
                migrated
            );

            return migrated;
        }

        async function loadTrackingData() {
            const records =
                readStorageJson(
                    localConfig
                        .TrackingStorageKey,
                    []
                );

            return Array.isArray(records)
                ? records
                : [];
        }

        return Object.freeze({
            info: Object.freeze({
                key: "LOCAL",
                displayName:
                    "Lokale Datenquelle",
                isLocal: true
            }),

            async loadBootstrapData() {
                const [
                    baseMasterData,
                    baseTrackingPayload,
                    localMasterData,
                    trackingRecords
                ] = await Promise.all([
                    fetchJson(
                        localConfig
                            .BaseMasterDataUrl,
                        "MasterData.json konnte nicht geladen werden"
                    ),
                    fetchJson(
                        localConfig
                            .BaseTrackingDataUrl,
                        "TrackingData.json konnte nicht geladen werden"
                    ),
                    loadLocalMasterData(),
                    loadTrackingData()
                ]);

                return {
                    baseMasterData,
                    baseTrackingData:
                        Array.isArray(
                            baseTrackingPayload
                                .Steuergeraete
                        )
                            ? baseTrackingPayload
                                .Steuergeraete
                            : [],
                    localMasterData,
                    trackingRecords
                };
            },

            async saveMasterData(
                localMasterData
            ) {
                writeStorageJson(
                    localConfig
                        .MasterDataStorageKey,
                    localMasterData
                );
            },

            async saveTrackingData(
                records
            ) {
                writeStorageJson(
                    localConfig
                        .TrackingStorageKey,
                    records
                );
            },

            async clearTrackingData() {
                removeStorageKey(
                    localConfig
                        .TrackingStorageKey
                );
            }
        });
    }

    function createSharePointProvider(
        config
    ) {
        const listConfig =
            config.SharePoint &&
            config.SharePoint.Lists
                ? config.SharePoint.Lists
                : {};

        const providerInfo =
            Object.freeze({
                key: "SHAREPOINT",
                displayName:
                    "SharePoint Online",
                isLocal: false,
                lists: Object.freeze({
                    Derivate:
                        listConfig.Derivate ||
                        "Derivate",
                    IStufen:
                        listConfig.IStufen ||
                        "IStufen",
                    Steuergeraete:
                        listConfig
                            .Steuergeraete ||
                        "Steuergeraete"
                })
            });

        function notImplemented() {
            throw new Error(
                "Der SharePoint-Provider ist vorbereitet, aber noch nicht aktiviert. " +
                "Die produktive Implementierung erfolgt später im SPFx-Kontext ohne fest codierte Tenant- oder Site-URL."
            );
        }

        return Object.freeze({
            info: providerInfo,
            loadBootstrapData:
                notImplemented,
            saveMasterData:
                notImplemented,
            saveTrackingData:
                notImplemented,
            clearTrackingData:
                notImplemented
        });
    }

    function createProvider(config) {
        const providerName =
            String(
                config.Provider ||
                "LOCAL"
            )
                .trim()
                .toUpperCase();

        if (
            providerName ===
            "LOCAL"
        ) {
            return createLocalProvider(
                config
            );
        }

        if (
            providerName ===
            "SHAREPOINT"
        ) {
            return (
                createSharePointProvider(
                    config
                )
            );
        }

        throw new Error(
            `Unbekannter Datenprovider '${providerName}'.`
        );
    }

    async function loadConfiguration(
        configUrl
    ) {
        try {
            const supplied =
                await fetchJson(
                    configUrl,
                    "data-config.json konnte nicht geladen werden"
                );

            return mergeConfig(
                DEFAULT_CONFIG,
                supplied
            );
        }
        catch (error) {
            console.warn(
                "data-config.json konnte nicht geladen werden. LOCAL-Standardkonfiguration wird verwendet.",
                error
            );

            return clone(
                DEFAULT_CONFIG
            );
        }
    }

    async function initialize(
        configUrl = "./data-config.json"
    ) {
        activeConfig =
            await loadConfiguration(
                configUrl
            );

        activeProvider =
            createProvider(
                activeConfig
            );

        initialized = true;

        console.info(
            `Datenprovider aktiv: ${activeProvider.info.displayName}`
        );

        return getProviderInfo();
    }

    function ensureInitialized() {
        if (
            !initialized ||
            !activeProvider
        ) {
            throw new Error(
                "TeiletrackingDataService wurde noch nicht initialisiert."
            );
        }
    }

    function getProviderInfo() {
        ensureInitialized();

        return clone(
            activeProvider.info
        );
    }

    function getConfiguration() {
        ensureInitialized();

        return clone(
            activeConfig
        );
    }

    async function loadBootstrapData() {
        ensureInitialized();

        return (
            activeProvider
                .loadBootstrapData()
        );
    }

    async function saveMasterData(
        localMasterData
    ) {
        ensureInitialized();

        return (
            activeProvider
                .saveMasterData(
                    clone(
                        localMasterData
                    )
                )
        );
    }

    async function saveTrackingData(
        records
    ) {
        ensureInitialized();

        return (
            activeProvider
                .saveTrackingData(
                    clone(records)
                )
        );
    }

    async function clearTrackingData() {
        ensureInitialized();

        return (
            activeProvider
                .clearTrackingData()
        );
    }

    global.TeiletrackingDataService =
        Object.freeze({
            initialize,
            getProviderInfo,
            getConfiguration,
            loadBootstrapData,
            saveMasterData,
            saveTrackingData,
            clearTrackingData,
            createLocalRecordId:
                createRecordId,
            getOrCreateDeviceId,
            saveLabelImage,
            getLabelImage,
            deleteLabelImage,
            downloadTextFile,
            downloadBlobFile
        });
})(window);

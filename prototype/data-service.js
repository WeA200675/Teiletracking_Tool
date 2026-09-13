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
            downloadTextFile
        });
})(window);

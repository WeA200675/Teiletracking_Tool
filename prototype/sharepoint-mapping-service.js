"use strict";

(function initializeSharePointMappingService(global) {
    let mappingConfig = null;

    function clone(value) {
        return JSON.parse(
            JSON.stringify(value)
        );
    }

    async function initialize(
        configUrl =
            "./sharepoint-import-map.json"
    ) {
        const response =
            await fetch(
                configUrl,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `SharePoint-Mapping konnte nicht geladen werden (HTTP ${response.status}).`
            );
        }

        const loaded =
            await response.json();

        if (
            !loaded ||
            typeof loaded !== "object" ||
            !loaded.Targets ||
            typeof loaded.Targets !== "object"
        ) {
            throw new Error(
                "sharepoint-import-map.json besitzt kein gültiges Targets-Objekt."
            );
        }

        mappingConfig = loaded;

        return getInfo();
    }

    function ensureInitialized() {
        if (!mappingConfig) {
            throw new Error(
                "TeiletrackingSharePointMappingService wurde noch nicht initialisiert."
            );
        }
    }

    function getInfo() {
        ensureInitialized();

        return {
            version:
                Number(
                    mappingConfig.Version ||
                    1
                ),
            description:
                String(
                    mappingConfig.Description ||
                    ""
                )
        };
    }

    function getPathValue(
        root,
        path
    ) {
        const normalizedPath =
            String(path || "")
                .trim();

        if (!normalizedPath) {
            return undefined;
        }

        const parts =
            normalizedPath.split(".");

        let current = root;

        for (const part of parts) {
            if (
                current === null ||
                current === undefined
            ) {
                return undefined;
            }

            current =
                current[part];
        }

        return current;
    }

    function isMissing(value) {
        return (
            value === null ||
            value === undefined ||
            (
                typeof value === "string" &&
                value.trim() === ""
            )
        );
    }

    function coerceValue(
        value,
        type
    ) {
        if (isMissing(value)) {
            if (
                type === "Text" ||
                type === "Choice"
            ) {
                return "";
            }

            return null;
        }

        switch (
            String(type || "Text")
        ) {
            case "Boolean":
                return Boolean(value);

            case "Number": {
                const numericValue =
                    Number(value);

                if (
                    !Number.isFinite(
                        numericValue
                    )
                ) {
                    throw new Error(
                        `Wert '${value}' kann nicht in Number umgewandelt werden.`
                    );
                }

                return numericValue;
            }

            case "DateTime": {
                const date =
                    new Date(value);

                if (
                    Number.isNaN(
                        date.getTime()
                    )
                ) {
                    throw new Error(
                        `Wert '${value}' ist kein gültiger DateTime-Wert.`
                    );
                }

                return date.toISOString();
            }

            case "Choice":
            case "Text":
            default:
                return String(value);
        }
    }

    function getSourceLabel(
        fieldRule
    ) {
        if (
            Object.prototype
                .hasOwnProperty
                .call(
                    fieldRule,
                    "Constant"
                )
        ) {
            return (
                `Konstante: ${fieldRule.Constant}`
            );
        }

        if (
            fieldRule.FallbackSource
        ) {
            return (
                `${fieldRule.Source} → Fallback: ${fieldRule.FallbackSource}`
            );
        }

        return String(
            fieldRule.Source ||
            "–"
        );
    }

    function buildFieldValues(
        targetKey,
        scope
    ) {
        ensureInitialized();

        const target =
            mappingConfig
                .Targets[targetKey];

        if (!target) {
            throw new Error(
                `Unbekanntes Mapping-Ziel '${targetKey}'.`
            );
        }

        const values = {};

        for (
            const [
                fieldName,
                fieldRule
            ] of Object.entries(
                target.Fields ||
                {}
            )
        ) {
            let rawValue;

            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        fieldRule,
                        "Constant"
                    )
            ) {
                rawValue =
                    fieldRule.Constant;
            }
            else {
                rawValue =
                    getPathValue(
                        scope,
                        fieldRule.Source
                    );

                if (
                    isMissing(rawValue) &&
                    fieldRule.FallbackSource
                ) {
                    rawValue =
                        getPathValue(
                            scope,
                            fieldRule
                                .FallbackSource
                        );
                }
            }

            values[fieldName] =
                coerceValue(
                    rawValue,
                    fieldRule.Type
                );
        }

        const missingRequired =
            (
                target.RequiredForImport ||
                []
            )
                .filter(fieldName =>
                    isMissing(
                        values[fieldName]
                    )
                );

        if (
            missingRequired.length >
            0
        ) {
            throw new Error(
                `${targetKey}: Pflichtfelder für den SharePoint-Import fehlen: ${missingRequired.join(", ")}`
            );
        }

        return values;
    }

    function resolveTargetNames(
        targetNames
    ) {
        return {
            Steuergeraete:
                String(
                    targetNames &&
                    targetNames.Steuergeraete
                        ? targetNames.Steuergeraete
                        : "Steuergeraete"
                ),
            ImportBatches:
                String(
                    targetNames &&
                    targetNames.ImportBatches
                        ? targetNames.ImportBatches
                        : "ImportBatches"
                ),
            TrackingImportArchiv:
                String(
                    targetNames &&
                    targetNames.TrackingImportArchiv
                        ? targetNames.TrackingImportArchiv
                        : "TrackingImportArchiv"
                )
        };
    }

    function describeContract(
        targetNames
    ) {
        ensureInitialized();

        const resolvedNames =
            resolveTargetNames(
                targetNames
            );

        const targets = [];

        for (
            const [
                targetKey,
                target
            ] of Object.entries(
                mappingConfig.Targets
            )
        ) {
            const requiredSet =
                new Set(
                    target.RequiredForImport ||
                    []
                );

            const fields =
                Object.entries(
                    target.Fields ||
                    {}
                )
                    .map(
                        ([
                            fieldName,
                            fieldRule
                        ]) => ({
                            fieldName,
                            source:
                                getSourceLabel(
                                    fieldRule
                                ),
                            type:
                                String(
                                    fieldRule.Type ||
                                    "Text"
                                ),
                            required:
                                requiredSet
                                    .has(
                                        fieldName
                                    )
                        })
                    );

            targets.push({
                key:
                    targetKey,
                kind:
                    String(
                        target.Kind ||
                        "List"
                    ),
                targetName:
                    resolvedNames[
                        targetKey
                    ],
                fileNameSource:
                    target.FileNameSource ||
                    null,
                fields
            });
        }

        return {
            version:
                Number(
                    mappingConfig.Version ||
                    1
                ),
            description:
                String(
                    mappingConfig.Description ||
                    ""
                ),
            targets
        };
    }

    function buildImportPlan(
        verifiedPackage,
        preflight,
        importedBy,
        importedAt,
        targetNames
    ) {
        ensureInitialized();

        const normalizedImportedBy =
            String(
                importedBy ||
                ""
            ).trim();

        if (!normalizedImportedBy) {
            throw new Error(
                "Importeur-Kennung fehlt für das SharePoint-Mapping."
            );
        }

        const normalizedImportedAt =
            new Date(
                importedAt
            ).toISOString();

        const resolvedNames =
            resolveTargetNames(
                targetNames
            );

        const context = {
            ImportedBy:
                normalizedImportedBy,
            ImportedAt:
                normalizedImportedAt,
            ArchiveFileName:
                `${verifiedPackage.batchId}.zip`
        };

        const recordPayloads =
            preflight.recordResults
                .filter(result =>
                    result.action ===
                    "IMPORT"
                )
                .map(result => {
                    const scope = {
                        record:
                            result.record,
                        package:
                            verifiedPackage,
                        preflight,
                        context
                    };

                    return {
                        RecordId:
                            String(
                                result.record
                                    .RecordId ||
                                ""
                            ),
                        Target:
                            resolvedNames
                                .Steuergeraete,
                        Values:
                            buildFieldValues(
                                "Steuergeraete",
                                scope
                            )
                    };
                });

        const packageScope = {
            record: null,
            package:
                verifiedPackage,
            preflight,
            context
        };

        const batchPayload = {
            Target:
                resolvedNames
                    .ImportBatches,
            Values:
                buildFieldValues(
                    "ImportBatches",
                    packageScope
                )
        };

        const archiveTarget =
            mappingConfig
                .Targets
                .TrackingImportArchiv;

        const archiveFileName =
            getPathValue(
                packageScope,
                archiveTarget
                    .FileNameSource
            );

        if (isMissing(archiveFileName)) {
            throw new Error(
                "Dateiname für das TrackingImportArchiv konnte nicht ermittelt werden."
            );
        }

        const archivePayload = {
            Target:
                resolvedNames
                    .TrackingImportArchiv,
            FileName:
                String(
                    archiveFileName
                ),
            Metadata:
                buildFieldValues(
                    "TrackingImportArchiv",
                    packageScope
                )
        };

        return {
            MappingVersion:
                Number(
                    mappingConfig.Version ||
                    1
                ),
            CreatedAt:
                normalizedImportedAt,
            Targets:
                resolvedNames,
            Records:
                recordPayloads,
            Batch:
                batchPayload,
            Archive:
                archivePayload
        };
    }

    global.TeiletrackingSharePointMappingService =
        Object.freeze({
            initialize,
            getInfo,
            describeContract,
            buildImportPlan
        });
})(window);

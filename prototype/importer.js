"use strict";

const state = {
    verifiedPackage: null,
    preflight: null,
    lastImportLog: null
};

const elements = {
    providerBadge:
        document.getElementById(
            "providerBadge"
        ),
    packageFileInput:
        document.getElementById(
            "packageFileInput"
        ),
    selectedFileName:
        document.getElementById(
            "selectedFileName"
        ),
    mainMessage:
        document.getElementById(
            "mainMessage"
        ),
    packageSummaryCard:
        document.getElementById(
            "packageSummaryCard"
        ),
    packageSummary:
        document.getElementById(
            "packageSummary"
        ),
    integrityCard:
        document.getElementById(
            "integrityCard"
        ),
    integrityChecks:
        document.getElementById(
            "integrityChecks"
        ),
    preflightCard:
        document.getElementById(
            "preflightCard"
        ),
    preflightBanner:
        document.getElementById(
            "preflightBanner"
        ),
    preflightSummary:
        document.getElementById(
            "preflightSummary"
        ),
    recordsCard:
        document.getElementById(
            "recordsCard"
        ),
    recordsTableBody:
        document.getElementById(
            "recordsTableBody"
        ),
    importCard:
        document.getElementById(
            "importCard"
        ),
    importedByInput:
        document.getElementById(
            "importedByInput"
        ),
    executeImportButton:
        document.getElementById(
            "executeImportButton"
        ),
    downloadImportLogButton:
        document.getElementById(
            "downloadImportLogButton"
        ),
    importResultMessage:
        document.getElementById(
            "importResultMessage"
        ),
    batchHistory:
        document.getElementById(
            "batchHistory"
        )
};

function setMessage(
    element,
    message,
    type
) {
    element.classList.remove(
        "hidden",
        "info",
        "success",
        "warning",
        "error"
    );

    element.classList.add(type);
    element.textContent = message;
}

function hideMessage(element) {
    element.classList.add("hidden");
    element.textContent = "";
}

function showCard(element) {
    element.classList.remove("hidden");
}

function hideCard(element) {
    element.classList.add("hidden");
}

function clearCurrentPackage() {
    state.verifiedPackage = null;
    state.preflight = null;
    state.lastImportLog = null;

    elements.packageSummary.innerHTML = "";
    elements.integrityChecks.innerHTML = "";
    elements.preflightSummary.innerHTML = "";
    elements.recordsTableBody.innerHTML = "";

    hideCard(
        elements.packageSummaryCard
    );
    hideCard(
        elements.integrityCard
    );
    hideCard(
        elements.preflightCard
    );
    hideCard(
        elements.recordsCard
    );
    hideCard(
        elements.importCard
    );

    elements.executeImportButton.disabled =
        true;

    elements.downloadImportLogButton.classList.add(
        "hidden"
    );

    hideMessage(
        elements.importResultMessage
    );
}

function createSummaryItem(
    label,
    value
) {
    const wrapper =
        document.createElement("div");

    wrapper.className =
        "summary-item";

    const labelElement =
        document.createElement("span");

    labelElement.textContent =
        label;

    const valueElement =
        document.createElement("strong");

    valueElement.textContent =
        value === null ||
        value === undefined ||
        value === ""
            ? "–"
            : String(value);

    wrapper.append(
        labelElement,
        valueElement
    );

    return wrapper;
}

function renderPackageSummary(
    verifiedPackage
) {
    const manifest =
        verifiedPackage.manifest;

    elements.packageSummary.innerHTML =
        "";

    const items = [
        [
            "BatchId",
            verifiedPackage.batchId
        ],
        [
            "DeviceId",
            verifiedPackage.deviceId
        ],
        [
            "Erstellt",
            manifest.CreatedAt
                ? new Date(
                    manifest.CreatedAt
                ).toLocaleString(
                    "de-DE"
                )
                : "–"
        ],
        [
            "App-Version",
            manifest.AppVersion
        ],
        [
            "Schema",
            manifest.SchemaVersion
        ],
        [
            "Datensätze",
            manifest.RecordCount
        ],
        [
            "Labelbilder",
            manifest.ImageCount
        ],
        [
            "PackageHash",
            verifiedPackage
                .packageHash
        ]
    ];

    for (
        const [label, value] of items
    ) {
        elements.packageSummary.appendChild(
            createSummaryItem(
                label,
                value
            )
        );
    }

    showCard(
        elements.packageSummaryCard
    );
}

function renderIntegrityChecks(
    checks
) {
    elements.integrityChecks.innerHTML =
        "";

    for (const check of checks) {
        const item =
            document.createElement("div");

        item.className =
            `check-item ${
                check.ok
                    ? "ok"
                    : "fail"
            }`;

        const icon =
            document.createElement("div");

        icon.className =
            "check-icon";

        icon.textContent =
            check.ok
                ? "✓"
                : "✕";

        const content =
            document.createElement("div");

        const title =
            document.createElement("div");

        title.className =
            "check-title";

        title.textContent =
            check.title;

        const detail =
            document.createElement("div");

        detail.className =
            "check-detail";

        detail.textContent =
            check.detail;

        content.append(
            title,
            detail
        );

        item.append(
            icon,
            content
        );

        elements.integrityChecks
            .appendChild(
                item
            );
    }

    showCard(
        elements.integrityCard
    );
}

function renderPreflight(
    preflight
) {
    elements.preflightSummary.innerHTML =
        "";

    elements.preflightBanner.className =
        "preflight-banner";

    let bannerText = "";

    switch (
        preflight.batchStatus
    ) {
        case "READY":
            elements.preflightBanner
                .classList.add(
                    "ready"
                );

            bannerText =
                "Paket ist für den Import freigegeben.";
            break;

        case "ALREADY_IMPORTED":
            elements.preflightBanner
                .classList.add(
                    "warning"
                );

            bannerText =
                "Dieser Batch wurde bereits mit demselben PackageHash importiert. Er wird nicht erneut importiert.";
            break;

        case "BATCH_CONFLICT":
            elements.preflightBanner
                .classList.add(
                    "error"
                );

            bannerText =
                "Kritischer Batch-Konflikt: Die BatchId existiert bereits, aber mit einem anderen PackageHash. Import blockiert.";
            break;

        case "RECORD_CONFLICT":
            elements.preflightBanner
                .classList.add(
                    "error"
                );

            bannerText =
                "Mindestens eine RecordId existiert bereits mit anderem RecordHash. Import blockiert.";
            break;

        default:
            elements.preflightBanner
                .classList.add(
                    "error"
                );

            bannerText =
                `Unbekannter Vorprüfstatus: ${preflight.batchStatus}`;
            break;
    }

    elements.preflightBanner.textContent =
        bannerText;

    const summaryItems = [
        [
            "Neu importieren",
            preflight.importCount
        ],
        [
            "Dubletten überspringen",
            preflight.duplicateCount
        ],
        [
            "Konflikte",
            preflight.conflictCount
        ],
        [
            "Batchstatus",
            preflight.batchStatus
        ]
    ];

    for (
        const [label, value] of
        summaryItems
    ) {
        elements.preflightSummary.appendChild(
            createSummaryItem(
                label,
                value
            )
        );
    }

    showCard(
        elements.preflightCard
    );
}

function getActionLabel(action) {
    switch (action) {
        case "IMPORT":
            return {
                label: "IMPORT",
                cssClass: "import"
            };

        case "SKIP_DUPLICATE":
            return {
                label: "ÜBERSPRINGEN",
                cssClass: "skip"
            };

        case "CONFLICT":
            return {
                label: "KONFLIKT",
                cssClass: "conflict"
            };

        default:
            return {
                label: action,
                cssClass: "conflict"
            };
    }
}

function appendCell(
    row,
    value,
    mono = false
) {
    const cell =
        document.createElement("td");

    if (mono) {
        cell.classList.add(
            "mono"
        );
    }

    cell.textContent =
        value === null ||
        value === undefined ||
        value === ""
            ? "–"
            : String(value);

    row.appendChild(cell);
}

function renderRecordPreview(
    verifiedPackage,
    preflight
) {
    elements.recordsTableBody.innerHTML =
        "";

    let recordResults =
        preflight.recordResults;

    if (
        !Array.isArray(
            recordResults
        ) ||
        recordResults.length === 0
    ) {
        recordResults =
            verifiedPackage.records
                .map(record => ({
                    action:
                        preflight.batchStatus ===
                        "ALREADY_IMPORTED"
                            ? "SKIP_DUPLICATE"
                            : "CONFLICT",
                    record
                }));
    }

    for (
        const result of recordResults
    ) {
        const record =
            result.record;

        const row =
            document.createElement("tr");

        const actionCell =
            document.createElement("td");

        const actionMeta =
            getActionLabel(
                result.action
            );

        const pill =
            document.createElement("span");

        pill.className =
            `status-pill ${actionMeta.cssClass}`;

        pill.textContent =
            actionMeta.label;

        actionCell.appendChild(
            pill
        );

        row.appendChild(
            actionCell
        );

        appendCell(
            row,
            record.RecordId,
            true
        );
        appendCell(
            row,
            record.PartNumber,
            true
        );
        appendCell(
            row,
            record.SerialNumber,
            true
        );
        appendCell(
            row,
            record.Derivat
        );
        appendCell(
            row,
            record.IStufe
        );
        appendCell(
            row,
            record.ValidationStatus
        );
        appendCell(
            row,
            record.SourceOrigin
        );

        elements.recordsTableBody
            .appendChild(
                row
            );
    }

    showCard(
        elements.recordsCard
    );
}

function updateImportButtonState() {
    const ready =
        state.verifiedPackage &&
        state.verifiedPackage.valid &&
        state.preflight &&
        state.preflight.batchStatus ===
            "READY" &&
        state.preflight.conflictCount ===
            0 &&
        elements.importedByInput
            .value
            .trim();

    elements.executeImportButton.disabled =
        !ready;
}

async function processSelectedFile(
    file
) {
    clearCurrentPackage();

    if (!file) {
        elements.selectedFileName
            .textContent =
            "Keine Datei ausgewählt";

        return;
    }

    elements.selectedFileName.textContent =
        `${file.name} · ${Math.round(file.size / 1024)} KB`;

    setMessage(
        elements.mainMessage,
        "Migrationspaket wird vollständig geprüft …",
        "info"
    );

    try {
        const verifiedPackage =
            await TeiletrackingMigrationImportService
                .verifyPackage(
                    file
                );

        state.verifiedPackage =
            verifiedPackage;

        renderPackageSummary(
            verifiedPackage
        );

        renderIntegrityChecks(
            verifiedPackage.checks
        );

        if (!verifiedPackage.valid) {
            setMessage(
                elements.mainMessage,
                "Integritätsprüfung fehlgeschlagen. Das Paket darf nicht importiert werden.",
                "error"
            );

            return;
        }

        const preflight =
            await TeiletrackingImportDestinationService
                .preflight(
                    verifiedPackage
                );

        state.preflight =
            preflight;

        renderPreflight(
            preflight
        );

        renderRecordPreview(
            verifiedPackage,
            preflight
        );

        showCard(
            elements.importCard
        );

        if (
            preflight.batchStatus ===
            "READY"
        ) {
            setMessage(
                elements.mainMessage,
                "Integritätsprüfung erfolgreich. Das Paket ist unverändert und kann nach Angabe der Importeur-Kennung kontrolliert importiert werden.",
                "success"
            );
        }
        else if (
            preflight.batchStatus ===
            "ALREADY_IMPORTED"
        ) {
            setMessage(
                elements.mainMessage,
                "Paket ist gültig, wurde aber bereits importiert.",
                "warning"
            );
        }
        else {
            setMessage(
                elements.mainMessage,
                "Paket ist kryptografisch gültig, besitzt aber einen Importkonflikt. Der Import wurde blockiert.",
                "error"
            );
        }

        updateImportButtonState();
    }
    catch (error) {
        console.error(
            "Paketprüfung fehlgeschlagen:",
            error
        );

        setMessage(
            elements.mainMessage,
            `Paketprüfung fehlgeschlagen: ${error.message}`,
            "error"
        );
    }
}

function createImportLog(
    batchRecord,
    verifiedPackage,
    preflight
) {
    return {
        Format:
            "teiletracking.import.log",
        Version:
            1,
        GeneratedAt:
            new Date()
                .toISOString(),
        Batch:
            batchRecord,
        Package: {
            FileName:
                verifiedPackage
                    .fileName,
            FileSize:
                verifiedPackage
                    .fileSize,
            BatchId:
                verifiedPackage
                    .batchId,
            DeviceId:
                verifiedPackage
                    .deviceId,
            PackageHash:
                verifiedPackage
                    .packageHash
        },
        Result: {
            ImportedCount:
                preflight.importCount,
            SkippedDuplicateCount:
                preflight.duplicateCount,
            ConflictCount:
                preflight.conflictCount
        },
        Records:
            preflight.recordResults
                .map(result => ({
                    RecordId:
                        result.record
                            .RecordId,
                    RecordHash:
                        result.record
                            .RecordHash,
                    Action:
                        result.action
                }))
    };
}

function downloadJson(
    fileName,
    value
) {
    const blob =
        new Blob(
            [
                JSON.stringify(
                    value,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json;charset=utf-8"
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

async function executeImport() {
    updateImportButtonState();

    if (
        elements.executeImportButton
            .disabled
    ) {
        return;
    }

    elements.executeImportButton.disabled =
        true;

    hideMessage(
        elements.importResultMessage
    );

    try {
        const importedBy =
            elements.importedByInput
                .value
                .trim();

        const batchRecord =
            await TeiletrackingImportDestinationService
                .importVerifiedPackage(
                    state.verifiedPackage,
                    importedBy,
                    state.preflight
                );

        state.lastImportLog =
            createImportLog(
                batchRecord,
                state.verifiedPackage,
                state.preflight
            );

        setMessage(
            elements.importResultMessage,
            `Import abgeschlossen: ${batchRecord.ImportedCount} neu importiert · ${batchRecord.SkippedDuplicateCount} Record-Dubletten übersprungen · Originalpaket lokal archiviert · Batch ${batchRecord.BatchId}`,
            "success"
        );

        elements.downloadImportLogButton
            .classList.remove(
                "hidden"
            );

        await refreshBatchHistory();

        const refreshedPreflight =
            await TeiletrackingImportDestinationService
                .preflight(
                    state.verifiedPackage
                );

        state.preflight =
            refreshedPreflight;

        renderPreflight(
            refreshedPreflight
        );

        renderRecordPreview(
            state.verifiedPackage,
            refreshedPreflight
        );

        updateImportButtonState();
    }
    catch (error) {
        console.error(
            "Import fehlgeschlagen:",
            error
        );

        setMessage(
            elements.importResultMessage,
            `Import fehlgeschlagen: ${error.message}`,
            "error"
        );

        updateImportButtonState();
    }
}

async function refreshBatchHistory() {
    const batches =
        await TeiletrackingImportDestinationService
            .listBatches();

    elements.batchHistory.innerHTML =
        "";

    if (batches.length === 0) {
        elements.batchHistory.className =
            "history-empty";

        elements.batchHistory.textContent =
            "Noch keine Batches importiert.";

        return;
    }

    elements.batchHistory.className =
        "table-wrap";

    const table =
        document.createElement("table");

    const thead =
        document.createElement("thead");

    thead.innerHTML =
        "<tr>" +
        "<th>BatchId</th>" +
        "<th>DeviceId</th>" +
        "<th>Importiert am</th>" +
        "<th>Importiert von</th>" +
        "<th>Neu</th>" +
        "<th>Übersprungen</th>" +
        "<th>PackageHash</th>" +
        "</tr>";

    const tbody =
        document.createElement("tbody");

    for (const batch of batches) {
        const row =
            document.createElement("tr");

        appendCell(
            row,
            batch.BatchId,
            true
        );
        appendCell(
            row,
            batch.DeviceId,
            true
        );
        appendCell(
            row,
            batch.ImportedAt
                ? new Date(
                    batch.ImportedAt
                ).toLocaleString(
                    "de-DE"
                )
                : "–"
        );
        appendCell(
            row,
            batch.ImportedBy
        );
        appendCell(
            row,
            batch.ImportedCount
        );
        appendCell(
            row,
            batch.SkippedDuplicateCount
        );
        appendCell(
            row,
            batch.PackageHash,
            true
        );

        tbody.appendChild(row);
    }

    table.append(
        thead,
        tbody
    );

    elements.batchHistory
        .appendChild(
            table
        );
}

async function initialize() {
    try {
        const providerInfo =
            await TeiletrackingImportDestinationService
                .initialize(
                    "./import-config.json"
                );

        elements.providerBadge.textContent =
            providerInfo.displayName;

        await refreshBatchHistory();
    }
    catch (error) {
        console.error(
            "Importer konnte nicht initialisiert werden:",
            error
        );

        setMessage(
            elements.mainMessage,
            `Importer konnte nicht initialisiert werden: ${error.message}`,
            "error"
        );

        elements.packageFileInput.disabled =
            true;
    }
}

elements.packageFileInput.addEventListener(
    "change",
    event => {
        const [file] =
            event.target.files || [];

        processSelectedFile(
            file
        );
    }
);

elements.importedByInput.addEventListener(
    "input",
    updateImportButtonState
);

elements.executeImportButton.addEventListener(
    "click",
    executeImport
);

elements.downloadImportLogButton.addEventListener(
    "click",
    () => {
        if (!state.lastImportLog) {
            return;
        }

        downloadJson(
            `ImportLog_${state.lastImportLog.Batch.BatchId}.json`,
            state.lastImportLog
        );
    }
);

initialize();

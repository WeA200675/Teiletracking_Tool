"use strict";

const MASTER_DATA_STORAGE_KEY = "teiletracking.masterData.v2";
const LEGACY_MASTER_DATA_STORAGE_KEY = "teiletracking.masterData.v1";
const TRACKING_STORAGE_KEY = "teiletracking.tracking.v1";

const state = {
    masterData: null,
    baseMasterData: null,
    localMasterData: createEmptyLocalMasterData(),
    initialTrackingData: [],
    savedItems: [],
    currentRecord: null
};

const elements = {
    dataStatus: document.getElementById("dataStatus"),
    derivat: document.getElementById("derivat"),
    iStufe: document.getElementById("iStufe"),
    newDerivatCode: document.getElementById("newDerivatCode"),
    newDerivatDescription: document.getElementById("newDerivatDescription"),
    addDerivatButton: document.getElementById("addDerivatButton"),
    newIStufeCode: document.getElementById("newIStufeCode"),
    newIStufeDescription: document.getElementById("newIStufeDescription"),
    addIStufeButton: document.getElementById("addIStufeButton"),
    masterDataMessage: document.getElementById("masterDataMessage"),
    derivatCount: document.getElementById("derivatCount"),
    iStufeCount: document.getElementById("iStufeCount"),
    localMasterDataCount: document.getElementById("localMasterDataCount"),
    derivateList: document.getElementById("derivateList"),
    iStufenList: document.getElementById("iStufenList"),
    labelInput: document.getElementById("labelInput"),
    qrInput: document.getElementById("qrInput"),
    checkButton: document.getElementById("checkButton"),
    saveButton: document.getElementById("saveButton"),
    resetButton: document.getElementById("resetButton"),
    resultCard: document.getElementById("resultCard"),
    resultTitle: document.getElementById("resultTitle"),
    resultMessage: document.getElementById("resultMessage"),
    statusBadge: document.getElementById("statusBadge"),
    comparisonSummary: document.getElementById("comparisonSummary"),
    comparisonPartNumber: document.getElementById("comparisonPartNumber"),
    comparisonSerialNumber: document.getElementById("comparisonSerialNumber"),
    comparisonHardware: document.getElementById("comparisonHardware"),
    comparisonSoftware: document.getElementById("comparisonSoftware"),
    labelPartNumber: document.getElementById("labelPartNumber"),
    qrPartNumber: document.getElementById("qrPartNumber"),
    partNumberStatus: document.getElementById("partNumberStatus"),
    labelSerialNumber: document.getElementById("labelSerialNumber"),
    qrSerialNumber: document.getElementById("qrSerialNumber"),
    serialNumberStatus: document.getElementById("serialNumberStatus"),
    labelHardware: document.getElementById("labelHardware"),
    qrHardware: document.getElementById("qrHardware"),
    hardwareStatus: document.getElementById("hardwareStatus"),
    labelSoftware: document.getElementById("labelSoftware"),
    qrSoftware: document.getElementById("qrSoftware"),
    softwareStatus: document.getElementById("softwareStatus"),
    resultPartNumber: document.getElementById("resultPartNumber"),
    resultSerialNumber: document.getElementById("resultSerialNumber"),
    resultDerivat: document.getElementById("resultDerivat"),
    resultIStufe: document.getElementById("resultIStufe"),
    resultDeviceKey: document.getElementById("resultDeviceKey"),
    resultAssignmentKey: document.getElementById("resultAssignmentKey"),
    savedItems: document.getElementById("savedItems"),
    savedCount: document.getElementById("savedCount"),
    trackingSearch: document.getElementById("trackingSearch"),
    trackingStatusFilter: document.getElementById("trackingStatusFilter"),
    trackingDerivatFilter: document.getElementById("trackingDerivatFilter"),
    trackingIStufeFilter: document.getElementById("trackingIStufeFilter"),
    trackingResultInfo: document.getElementById("trackingResultInfo"),
    resetTrackingFiltersButton: document.getElementById("resetTrackingFiltersButton"),
    trackingDetailOverlay: document.getElementById("trackingDetailOverlay"),
    trackingDetailTitle: document.getElementById("trackingDetailTitle"),
    trackingDetailSource: document.getElementById("trackingDetailSource"),
    trackingDetailStatus: document.getElementById("trackingDetailStatus"),
    trackingDetailContent: document.getElementById("trackingDetailContent"),
    closeTrackingDetailButton: document.getElementById("closeTrackingDetailButton")
};

function normalizeText(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim().toUpperCase();
}

function normalizeDescription(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}

function displayValue(value) {
    return normalizeText(value) || "–";
}

function parseTrackingString(inputString) {
    if (!inputString || !inputString.trim()) {
        throw new Error("Tracking-String ist leer");
    }

    const allowedKeys = new Set(["PN", "SN", "HW", "SW"]);
    const data = {};

    for (const rawSegment of inputString.split(";")) {
        const segment = rawSegment.trim();

        if (!segment) {
            continue;
        }

        if (!segment.includes("=")) {
            throw new Error(`Ungültiges Segment ohne '=': '${segment}'`);
        }

        const separatorIndex = segment.indexOf("=");
        const key = normalizeText(segment.slice(0, separatorIndex));
        const value = normalizeText(segment.slice(separatorIndex + 1));

        if (!key) {
            throw new Error("Tracking-Schlüssel darf nicht leer sein");
        }

        if (!allowedKeys.has(key)) {
            throw new Error(`Unbekannter Tracking-Schlüssel: '${key}'`);
        }

        if (Object.prototype.hasOwnProperty.call(data, key)) {
            throw new Error(`Tracking-Schlüssel '${key}' ist mehrfach vorhanden`);
        }

        data[key] = value;
    }

    if (Object.keys(data).length === 0) {
        throw new Error("Tracking-String enthält keine verwertbaren Daten");
    }

    return {
        partNumber: normalizeText(data.PN),
        serialNumber: normalizeText(data.SN),
        hardware: normalizeText(data.HW),
        software: normalizeText(data.SW)
    };
}

function getDeviceKey(partNumber, serialNumber) {
    return [
        normalizeText(partNumber),
        normalizeText(serialNumber)
    ].join("|");
}

function getAssignmentKey(partNumber, serialNumber, derivat, iStufe) {
    return [
        normalizeText(partNumber),
        normalizeText(serialNumber),
        normalizeText(derivat),
        normalizeText(iStufe)
    ].join("|");
}

function getMismatchFields(label, qr) {
    const mismatchFields = [];

    if (normalizeText(label.partNumber) !== normalizeText(qr.partNumber)) {
        mismatchFields.push("PartNumber");
    }

    if (normalizeText(label.serialNumber) !== normalizeText(qr.serialNumber)) {
        mismatchFields.push("SerialNumber");
    }

    if (normalizeText(label.hardware) !== normalizeText(qr.hardware)) {
        mismatchFields.push("Hardware");
    }

    if (normalizeText(label.software) !== normalizeText(qr.software)) {
        mismatchFields.push("Software");
    }

    return mismatchFields;
}

function validateRequiredFields(label, qr, derivat, iStufe) {
    const errors = [];

    if (!label.partNumber) {
        errors.push("PartNumber fehlt");
    }

    if (!label.serialNumber) {
        errors.push("SerialNumber fehlt");
    }

    if (!qr.partNumber) {
        errors.push("QR PartNumber fehlt");
    }

    if (!qr.serialNumber) {
        errors.push("QR SerialNumber fehlt");
    }

    if (!derivat) {
        errors.push("Derivat fehlt");
    }

    if (!iStufe) {
        errors.push("I-Stufe fehlt");
    }

    if (errors.length > 0) {
        throw new Error(errors.join("; "));
    }
}

function getAllTrackingItems() {
    return [
        ...state.initialTrackingData,
        ...state.savedItems
    ];
}

function getDuplicateStatus(deviceKey, assignmentKey) {
    const items = getAllTrackingItems();

    const assignmentExists = items.some(
        item => normalizeText(item.AssignmentKey) === normalizeText(assignmentKey)
    );

    if (assignmentExists) {
        return "DUPLICATE";
    }

    const deviceExists = items.some(
        item => normalizeText(item.DeviceKey) === normalizeText(deviceKey)
    );

    if (deviceExists) {
        return "DOUBLE_DERIVATIVE";
    }

    return "NEW";
}

function buildRecord(label, qr, derivat, iStufe) {
    const normalizedDerivat = normalizeText(derivat);
    const normalizedIStufe = normalizeText(iStufe);
    const labelPartNumber = normalizeText(label.partNumber);
    const qrPartNumber = normalizeText(qr.partNumber);
    const labelSerialNumber = normalizeText(label.serialNumber);
    const qrSerialNumber = normalizeText(qr.serialNumber);
    const labelHardware = normalizeText(label.hardware);
    const qrHardware = normalizeText(qr.hardware);
    const labelSoftware = normalizeText(label.software);
    const qrSoftware = normalizeText(qr.software);

    const deviceKey = getDeviceKey(
        labelPartNumber,
        labelSerialNumber
    );

    const assignmentKey = getAssignmentKey(
        labelPartNumber,
        labelSerialNumber,
        normalizedDerivat,
        normalizedIStufe
    );

    const duplicateStatus = getDuplicateStatus(
        deviceKey,
        assignmentKey
    );

    const mismatchFields = getMismatchFields(label, qr);

    let validationStatus = "OK";

    if (mismatchFields.length > 0) {
        validationStatus = "LABEL_QR_MISMATCH";
    }
    else if (duplicateStatus === "DUPLICATE") {
        validationStatus = "DUPLICATE";
    }
    else if (duplicateStatus === "DOUBLE_DERIVATIVE") {
        validationStatus = "DOUBLE_DERIVATIVE";
    }

    return {
        PartNumber: labelPartNumber,
        SerialNumber: labelSerialNumber,
        LabelPartNumber: labelPartNumber,
        QRPartNumber: qrPartNumber,
        LabelSerialNumber: labelSerialNumber,
        QRSerialNumber: qrSerialNumber,
        Derivat: normalizedDerivat,
        IStufe: normalizedIStufe,
        LabelHardware: labelHardware,
        QRHardware: qrHardware,
        LabelSoftware: labelSoftware,
        QRSoftware: qrSoftware,
        DeviceKey: deviceKey,
        AssignmentKey: assignmentKey,
        DuplicateStatus: duplicateStatus,
        ValidationStatus: validationStatus,
        DoppelDerivat: duplicateStatus === "DOUBLE_DERIVATIVE",
        MismatchFields: mismatchFields
    };
}

function getStatusMeta(status) {
    switch (normalizeText(status)) {
        case "OK":
            return {
                cssClass: "ok",
                cardClass: "status-ok",
                title: "Teil ist plausibel",
                message: "Label und QR stimmen überein. Die Zuordnung ist neu."
            };

        case "DOUBLE_DERIVATIVE":
            return {
                cssClass: "double",
                cardClass: "status-double",
                title: "Doppelderivat erkannt",
                message: "Das physische Teil ist bereits bekannt, wird aber einer anderen Zuordnung hinzugefügt."
            };

        case "LABEL_QR_MISMATCH":
            return {
                cssClass: "mismatch",
                cardClass: "status-mismatch",
                title: "Label / QR Abweichung",
                message: "Mindestens ein Wert auf Label und QR stimmt nicht überein."
            };

        case "DUPLICATE":
            return {
                cssClass: "duplicate",
                cardClass: "status-duplicate",
                title: "Datensatz bereits vorhanden",
                message: "Diese Kombination aus Teil, Derivat und I-Stufe existiert bereits."
            };

        default:
            return {
                cssClass: "error",
                cardClass: "status-error",
                title: "Fehler",
                message: "Die Eingabe konnte nicht verarbeitet werden."
            };
    }
}

function clearResultClasses() {
    elements.resultCard.classList.remove(
        "status-ok",
        "status-double",
        "status-mismatch",
        "status-duplicate",
        "status-error"
    );

    elements.statusBadge.classList.remove(
        "ok",
        "double",
        "mismatch",
        "duplicate",
        "error"
    );
}

function setComparisonRow(
    rowElement,
    labelElement,
    qrElement,
    statusElement,
    labelValue,
    qrValue
) {
    const normalizedLabel = normalizeText(labelValue);
    const normalizedQR = normalizeText(qrValue);
    const matches = normalizedLabel === normalizedQR;

    rowElement.classList.remove("match", "mismatch");
    rowElement.classList.add(matches ? "match" : "mismatch");

    labelElement.textContent = displayValue(normalizedLabel);
    qrElement.textContent = displayValue(normalizedQR);
    statusElement.textContent = matches ? "✓ Gleich" : "⚠ Abweichung";
}

function renderComparison(record) {
    setComparisonRow(
        elements.comparisonPartNumber,
        elements.labelPartNumber,
        elements.qrPartNumber,
        elements.partNumberStatus,
        record.LabelPartNumber,
        record.QRPartNumber
    );

    setComparisonRow(
        elements.comparisonSerialNumber,
        elements.labelSerialNumber,
        elements.qrSerialNumber,
        elements.serialNumberStatus,
        record.LabelSerialNumber,
        record.QRSerialNumber
    );

    setComparisonRow(
        elements.comparisonHardware,
        elements.labelHardware,
        elements.qrHardware,
        elements.hardwareStatus,
        record.LabelHardware,
        record.QRHardware
    );

    setComparisonRow(
        elements.comparisonSoftware,
        elements.labelSoftware,
        elements.qrSoftware,
        elements.softwareStatus,
        record.LabelSoftware,
        record.QRSoftware
    );

    const mismatchCount = record.MismatchFields.length;

    elements.comparisonSummary.textContent =
        mismatchCount === 0
            ? "Alle Werte stimmen überein"
            : `${mismatchCount} ${mismatchCount === 1 ? "Abweichung" : "Abweichungen"}`;
}

function clearComparison() {
    const rows = [
        elements.comparisonPartNumber,
        elements.comparisonSerialNumber,
        elements.comparisonHardware,
        elements.comparisonSoftware
    ];

    for (const row of rows) {
        row.classList.remove("match", "mismatch");
    }

    const values = [
        elements.labelPartNumber,
        elements.qrPartNumber,
        elements.partNumberStatus,
        elements.labelSerialNumber,
        elements.qrSerialNumber,
        elements.serialNumberStatus,
        elements.labelHardware,
        elements.qrHardware,
        elements.hardwareStatus,
        elements.labelSoftware,
        elements.qrSoftware,
        elements.softwareStatus,
        elements.comparisonSummary
    ];

    for (const element of values) {
        element.textContent = "–";
    }
}

function renderRecord(record) {
    const meta = getStatusMeta(record.ValidationStatus);

    clearResultClasses();

    elements.resultCard.classList.remove("hidden");
    elements.resultCard.classList.add(meta.cardClass);
    elements.statusBadge.classList.add(meta.cssClass);

    elements.resultTitle.textContent = meta.title;
    elements.statusBadge.textContent = record.ValidationStatus;

    if (
        record.ValidationStatus === "LABEL_QR_MISMATCH" &&
        record.MismatchFields.length > 0
    ) {
        elements.resultMessage.textContent =
            `${meta.message} Abweichend: ${record.MismatchFields.join(", ")}.`;
    }
    else {
        elements.resultMessage.textContent = meta.message;
    }

    renderComparison(record);

    elements.resultPartNumber.textContent = record.PartNumber;
    elements.resultSerialNumber.textContent = record.SerialNumber;
    elements.resultDerivat.textContent = record.Derivat;
    elements.resultIStufe.textContent = record.IStufe;
    elements.resultDeviceKey.textContent = record.DeviceKey;
    elements.resultAssignmentKey.textContent = record.AssignmentKey;

    elements.saveButton.disabled =
        record.DuplicateStatus === "DUPLICATE";
}

function renderError(error) {
    clearResultClasses();
    clearComparison();

    state.currentRecord = null;
    elements.saveButton.disabled = true;

    elements.resultCard.classList.remove("hidden");
    elements.resultCard.classList.add("status-error");
    elements.statusBadge.classList.add("error");

    elements.statusBadge.textContent = "FEHLER";
    elements.resultTitle.textContent = "Eingabe ungültig";
    elements.resultMessage.textContent = error.message;

    elements.resultPartNumber.textContent = "–";
    elements.resultSerialNumber.textContent = "–";
    elements.resultDerivat.textContent = "–";
    elements.resultIStufe.textContent = "–";
    elements.resultDeviceKey.textContent = "–";
    elements.resultAssignmentKey.textContent = "–";
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

function getLocalMasterData() {
    try {
        const stored = localStorage.getItem(MASTER_DATA_STORAGE_KEY);

        if (stored) {
            const parsed = JSON.parse(stored);

            return {
                Derivate: Array.isArray(parsed.Derivate)
                    ? parsed.Derivate
                    : [],

                IStufen: Array.isArray(parsed.IStufen)
                    ? parsed.IStufen
                    : [],

                AktivOverrides: {
                    Derivate:
                        parsed.AktivOverrides?.Derivate &&
                        typeof parsed.AktivOverrides.Derivate === "object"
                            ? parsed.AktivOverrides.Derivate
                            : {},

                    IStufen:
                        parsed.AktivOverrides?.IStufen &&
                        typeof parsed.AktivOverrides.IStufen === "object"
                            ? parsed.AktivOverrides.IStufen
                            : {}
                }
            };
        }

        const legacyStored = localStorage.getItem(
            LEGACY_MASTER_DATA_STORAGE_KEY
        );

        if (!legacyStored) {
            return createEmptyLocalMasterData();
        }

        const legacy = JSON.parse(legacyStored);

        const migrated = {
            Derivate: Array.isArray(legacy.Derivate)
                ? legacy.Derivate
                : [],

            IStufen: Array.isArray(legacy.IStufen)
                ? legacy.IStufen
                : [],

            AktivOverrides: {
                Derivate: {},
                IStufen: {}
            }
        };

        localStorage.setItem(
            MASTER_DATA_STORAGE_KEY,
            JSON.stringify(migrated)
        );

        return migrated;
    }
    catch (error) {
        console.error(
            "Lokale Stammdaten konnten nicht gelesen werden:",
            error
        );

        return createEmptyLocalMasterData();
    }
}

function saveLocalMasterData() {
    localStorage.setItem(
        MASTER_DATA_STORAGE_KEY,
        JSON.stringify(state.localMasterData)
    );
}

function getLocalTrackingData() {
    try {
        const stored = localStorage.getItem(TRACKING_STORAGE_KEY);

        if (!stored) {
            return [];
        }

        const parsed = JSON.parse(stored);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter(item => item && typeof item === "object")
            .map(normalizeStoredTrackingRecord);
    }
    catch (error) {
        console.error(
            "Lokale Tracking-Daten konnten nicht gelesen werden:",
            error
        );

        return [];
    }
}

function normalizeStoredTrackingRecord(item) {
    const mismatchFields =
        Array.isArray(item.MismatchFields)
            ? item.MismatchFields.map(normalizeDescription)
            : [];

    const partNumber = normalizeText(
        item.PartNumber || item.LabelPartNumber
    );

    const serialNumber = normalizeText(
        item.SerialNumber || item.LabelSerialNumber
    );

    const derivat = normalizeText(item.Derivat);
    const iStufe = normalizeText(item.IStufe);

    return {
        ...item,
        PartNumber: partNumber,
        SerialNumber: serialNumber,
        LabelPartNumber: normalizeText(
            item.LabelPartNumber || partNumber
        ),
        QRPartNumber: normalizeText(
            item.QRPartNumber || partNumber
        ),
        LabelSerialNumber: normalizeText(
            item.LabelSerialNumber || serialNumber
        ),
        QRSerialNumber: normalizeText(
            item.QRSerialNumber || serialNumber
        ),
        Derivat: derivat,
        IStufe: iStufe,
        LabelHardware: normalizeText(item.LabelHardware),
        QRHardware: normalizeText(item.QRHardware),
        LabelSoftware: normalizeText(item.LabelSoftware),
        QRSoftware: normalizeText(item.QRSoftware),
        DeviceKey: normalizeText(
            item.DeviceKey || getDeviceKey(partNumber, serialNumber)
        ),
        AssignmentKey: normalizeText(
            item.AssignmentKey ||
            getAssignmentKey(
                partNumber,
                serialNumber,
                derivat,
                iStufe
            )
        ),
        DuplicateStatus: normalizeText(
            item.DuplicateStatus || "NEW"
        ),
        ValidationStatus: normalizeText(
            item.ValidationStatus || "OK"
        ),
        DoppelDerivat: Boolean(item.DoppelDerivat),
        MismatchFields: mismatchFields,
        SavedAt: item.SavedAt || null,
        LocalId: item.LocalId || createLocalRecordId()
    };
}

function saveLocalTrackingData() {
    localStorage.setItem(
        TRACKING_STORAGE_KEY,
        JSON.stringify(state.savedItems)
    );
}

function createLocalRecordId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getOverrideValue(type, code) {
    const normalizedCode = normalizeText(code);
    const overrides =
        state.localMasterData.AktivOverrides[type];

    if (
        Object.prototype.hasOwnProperty.call(
            overrides,
            normalizedCode
        )
    ) {
        return Boolean(overrides[normalizedCode]);
    }

    return null;
}

function mergeMasterDataItems(
    baseItems,
    localItems,
    valueField,
    type
) {
    const merged = [];
    const seen = new Set();

    for (const item of [
        ...(baseItems || []),
        ...(localItems || [])
    ]) {
        const value = normalizeText(item[valueField]);

        if (!value || seen.has(value)) {
            continue;
        }

        seen.add(value);

        const override = getOverrideValue(type, value);

        merged.push({
            ...item,
            [valueField]: value,
            Beschreibung: normalizeDescription(item.Beschreibung),
            Aktiv:
                override !== null
                    ? override
                    : item.Aktiv !== false
        });
    }

    return merged;
}

function rebuildMasterData() {
    state.masterData = {
        Derivate: mergeMasterDataItems(
            state.baseMasterData?.Derivate || [],
            state.localMasterData.Derivate || [],
            "DerivatCode",
            "Derivate"
        ),

        IStufen: mergeMasterDataItems(
            state.baseMasterData?.IStufen || [],
            state.localMasterData.IStufen || [],
            "IStufeCode",
            "IStufen"
        )
    };
}

function fillSelect(
    selectElement,
    items,
    valueField,
    selectedValue = "",
    placeholderText = "Bitte wählen",
    activeOnly = true
) {
    selectElement.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = placeholderText;
    selectElement.appendChild(placeholder);

    const sorted = [...items]
        .filter(item => !activeOnly || item.Aktiv !== false)
        .sort((a, b) =>
            normalizeText(a[valueField]).localeCompare(
                normalizeText(b[valueField]),
                "de"
            )
        );

    for (const item of sorted) {
        const value = normalizeText(item[valueField]);

        if (!value) {
            continue;
        }

        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;

        selectElement.appendChild(option);
    }

    const normalizedSelectedValue = normalizeText(selectedValue);

    if (
        normalizedSelectedValue &&
        [...selectElement.options].some(
            option => option.value === normalizedSelectedValue
        )
    ) {
        selectElement.value = normalizedSelectedValue;
    }
}

function isLocalMasterDataItem(type, valueField, code) {
    const normalizedCode = normalizeText(code);

    return state.localMasterData[type].some(
        item =>
            normalizeText(item[valueField]) === normalizedCode
    );
}

function createMasterDataItem(type, item, valueField) {
    const code = normalizeText(item[valueField]);

    const local = isLocalMasterDataItem(
        type,
        valueField,
        code
    );

    const row = document.createElement("div");
    row.className = "master-data-item";

    if (item.Aktiv === false) {
        row.classList.add("inactive");
    }

    const main = document.createElement("div");
    main.className = "master-data-item-main";

    const title = document.createElement("div");
    title.className = "master-data-item-title";

    const codeElement = document.createElement("span");
    codeElement.className = "master-data-code";
    codeElement.textContent = code;

    const source = document.createElement("span");
    source.className = local
        ? "master-data-source local"
        : "master-data-source";
    source.textContent = local ? "Lokal" : "Basis";

    title.append(codeElement, source);

    const description = document.createElement("p");
    description.className = "master-data-description";
    description.textContent =
        item.Beschreibung ||
        (item.Aktiv === false ? "Inaktiv" : "Aktiv");

    main.append(title, description);

    const actions = document.createElement("div");
    actions.className = "master-data-item-actions";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className =
        item.Aktiv === false
            ? "mini-button activate"
            : "mini-button deactivate";
    toggleButton.textContent =
        item.Aktiv === false
            ? "Aktivieren"
            : "Deaktivieren";

    toggleButton.addEventListener(
        "click",
        () => {
            toggleMasterDataStatus(
                type,
                valueField,
                code
            );
        }
    );

    actions.appendChild(toggleButton);

    if (local) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "mini-button delete";
        deleteButton.textContent = "Löschen";

        deleteButton.addEventListener(
            "click",
            () => {
                deleteLocalMasterDataItem(
                    type,
                    valueField,
                    code
                );
            }
        );

        actions.appendChild(deleteButton);
    }

    row.append(main, actions);

    return row;
}

function renderMasterDataList(
    container,
    type,
    items,
    valueField
) {
    container.innerHTML = "";

    const sorted = [...items].sort(
        (a, b) =>
            normalizeText(a[valueField]).localeCompare(
                normalizeText(b[valueField]),
                "de"
            )
    );

    if (sorted.length === 0) {
        const empty = document.createElement("div");
        empty.className = "master-data-list-empty";
        empty.textContent = "Keine Stammdaten vorhanden.";
        container.appendChild(empty);
        return;
    }

    for (const item of sorted) {
        container.appendChild(
            createMasterDataItem(
                type,
                item,
                valueField
            )
        );
    }
}

function renderMasterDataLists() {
    renderMasterDataList(
        elements.derivateList,
        "Derivate",
        state.masterData.Derivate || [],
        "DerivatCode"
    );

    renderMasterDataList(
        elements.iStufenList,
        "IStufen",
        state.masterData.IStufen || [],
        "IStufeCode"
    );
}

function refreshMasterDataUi(
    selectedDerivat = null,
    selectedIStufe = null
) {
    const currentDerivat =
        selectedDerivat !== null
            ? selectedDerivat
            : elements.derivat.value;

    const currentIStufe =
        selectedIStufe !== null
            ? selectedIStufe
            : elements.iStufe.value;

    fillSelect(
        elements.derivat,
        state.masterData.Derivate || [],
        "DerivatCode",
        currentDerivat
    );

    fillSelect(
        elements.iStufe,
        state.masterData.IStufen || [],
        "IStufeCode",
        currentIStufe
    );

    elements.derivatCount.textContent =
        state.masterData.Derivate.length;

    elements.iStufeCount.textContent =
        state.masterData.IStufen.length;

    elements.localMasterDataCount.textContent =
        state.localMasterData.Derivate.length +
        state.localMasterData.IStufen.length;

    renderMasterDataLists();
    refreshTrackingFilterOptions();
    updateDataStatus();
}

function updateDataStatus() {
    if (!state.masterData) {
        return;
    }

    const activeDerivate =
        state.masterData.Derivate.filter(
            item => item.Aktiv !== false
        ).length;

    const activeIStufen =
        state.masterData.IStufen.filter(
            item => item.Aktiv !== false
        ).length;

    elements.dataStatus.textContent =
        `${activeDerivate} aktive Derivate · ` +
        `${activeIStufen} aktive I-Stufen · ` +
        `${state.initialTrackingData.length} Basis-Teile · ` +
        `${state.savedItems.length} lokal gespeichert`;
}

function showMasterDataMessage(message, type) {
    elements.masterDataMessage.classList.remove(
        "hidden",
        "success",
        "error"
    );

    elements.masterDataMessage.classList.add(type);
    elements.masterDataMessage.textContent = message;
}

function masterDataValueExists(items, valueField, value) {
    const normalizedValue = normalizeText(value);

    return items.some(
        item =>
            normalizeText(item[valueField]) ===
            normalizedValue
    );
}

function findMasterDataItem(type, valueField, code) {
    const normalizedCode = normalizeText(code);

    return state.masterData[type].find(
        item =>
            normalizeText(item[valueField]) ===
            normalizedCode
    );
}

function toggleMasterDataStatus(type, valueField, code) {
    const item = findMasterDataItem(
        type,
        valueField,
        code
    );

    if (!item) {
        showMasterDataMessage(
            `Stammdatensatz '${code}' wurde nicht gefunden.`,
            "error"
        );
        return;
    }

    const newStatus = item.Aktiv === false;

    state.localMasterData
        .AktivOverrides[type][normalizeText(code)] =
        newStatus;

    saveLocalMasterData();
    rebuildMasterData();
    refreshMasterDataUi();

    showMasterDataMessage(
        `'${normalizeText(code)}' wurde ` +
        (newStatus ? "aktiviert." : "deaktiviert."),
        "success"
    );
}

function deleteLocalMasterDataItem(
    type,
    valueField,
    code
) {
    const normalizedCode = normalizeText(code);

    if (
        !isLocalMasterDataItem(
            type,
            valueField,
            normalizedCode
        )
    ) {
        showMasterDataMessage(
            "Nur lokal angelegte Stammdaten können gelöscht werden.",
            "error"
        );
        return;
    }

    state.localMasterData[type] =
        state.localMasterData[type].filter(
            item =>
                normalizeText(item[valueField]) !==
                normalizedCode
        );

    delete state.localMasterData
        .AktivOverrides[type][normalizedCode];

    saveLocalMasterData();
    rebuildMasterData();
    refreshMasterDataUi();

    showMasterDataMessage(
        `'${normalizedCode}' wurde aus den lokalen Stammdaten gelöscht.`,
        "success"
    );
}

function addDerivat() {
    const code = normalizeText(
        elements.newDerivatCode.value
    );

    const description = normalizeDescription(
        elements.newDerivatDescription.value
    );

    if (!code) {
        showMasterDataMessage(
            "Bitte einen Derivat-Code eingeben.",
            "error"
        );

        elements.newDerivatCode.focus();
        return;
    }

    if (
        masterDataValueExists(
            state.masterData.Derivate,
            "DerivatCode",
            code
        )
    ) {
        showMasterDataMessage(
            `Derivat '${code}' ist bereits vorhanden.`,
            "error"
        );

        elements.newDerivatCode.focus();
        return;
    }

    state.localMasterData.Derivate.push({
        DerivatCode: code,
        Beschreibung: description,
        Aktiv: true
    });

    saveLocalMasterData();
    rebuildMasterData();
    refreshMasterDataUi(code, null);

    elements.newDerivatCode.value = "";
    elements.newDerivatDescription.value = "";

    showMasterDataMessage(
        `Derivat '${code}' wurde lokal angelegt und ausgewählt.`,
        "success"
    );
}

function addIStufe() {
    const code = normalizeText(
        elements.newIStufeCode.value
    );

    const description = normalizeDescription(
        elements.newIStufeDescription.value
    );

    if (!code) {
        showMasterDataMessage(
            "Bitte eine I-Stufe eingeben.",
            "error"
        );

        elements.newIStufeCode.focus();
        return;
    }

    if (
        masterDataValueExists(
            state.masterData.IStufen,
            "IStufeCode",
            code
        )
    ) {
        showMasterDataMessage(
            `I-Stufe '${code}' ist bereits vorhanden.`,
            "error"
        );

        elements.newIStufeCode.focus();
        return;
    }

    state.localMasterData.IStufen.push({
        IStufeCode: code,
        Beschreibung: description,
        Aktiv: true
    });

    saveLocalMasterData();
    rebuildMasterData();
    refreshMasterDataUi(null, code);

    elements.newIStufeCode.value = "";
    elements.newIStufeDescription.value = "";

    showMasterDataMessage(
        `I-Stufe '${code}' wurde lokal angelegt und ausgewählt.`,
        "success"
    );
}

function getRecordValidationStatus(record) {
    const explicitStatus = normalizeText(
        record.ValidationStatus
    );

    if (explicitStatus) {
        return explicitStatus;
    }

    if (record.DoppelDerivat === true) {
        return "DOUBLE_DERIVATIVE";
    }

    return "OK";
}

function getTrackingDisplayItems() {
    const baseItems = state.initialTrackingData.map(
        (record, index) => ({
            ...record,
            ValidationStatus:
                getRecordValidationStatus(record),
            Source: "BASE",
            DisplayId: `base-${index}`
        })
    );

    const localItems = state.savedItems.map(
        record => ({
            ...record,
            ValidationStatus:
                getRecordValidationStatus(record),
            Source: "LOCAL",
            DisplayId: record.LocalId
        })
    );

    return [
        ...baseItems,
        ...localItems
    ];
}

function getFilteredTrackingItems() {
    const search = normalizeText(
        elements.trackingSearch.value
    );

    const status = normalizeText(
        elements.trackingStatusFilter.value
    );

    const derivat = normalizeText(
        elements.trackingDerivatFilter.value
    );

    const iStufe = normalizeText(
        elements.trackingIStufeFilter.value
    );

    return getTrackingDisplayItems().filter(
        record => {
            const haystack = [
                record.PartNumber,
                record.SerialNumber,
                record.LabelPartNumber,
                record.QRPartNumber,
                record.LabelSerialNumber,
                record.QRSerialNumber,
                record.DeviceKey,
                record.AssignmentKey,
                record.Derivat,
                record.IStufe,
                record.ValidationStatus
            ]
                .map(normalizeText)
                .join(" ");

            if (search && !haystack.includes(search)) {
                return false;
            }

            if (
                status &&
                getRecordValidationStatus(record) !== status
            ) {
                return false;
            }

            if (
                derivat &&
                normalizeText(record.Derivat) !== derivat
            ) {
                return false;
            }

            if (
                iStufe &&
                normalizeText(record.IStufe) !== iStufe
            ) {
                return false;
            }

            return true;
        }
    );
}

function refreshTrackingFilterOptions() {
    const currentDerivat =
        elements.trackingDerivatFilter.value;

    const currentIStufe =
        elements.trackingIStufeFilter.value;

    const displayItems = getTrackingDisplayItems();

    const derivatMap = new Map();
    const iStufeMap = new Map();

    for (const record of displayItems) {
        const derivat = normalizeText(record.Derivat);
        const iStufe = normalizeText(record.IStufe);

        if (derivat) {
            derivatMap.set(
                derivat,
                { DerivatCode: derivat, Aktiv: true }
            );
        }

        if (iStufe) {
            iStufeMap.set(
                iStufe,
                { IStufeCode: iStufe, Aktiv: true }
            );
        }
    }

    for (const item of state.masterData?.Derivate || []) {
        const value = normalizeText(item.DerivatCode);

        if (value) {
            derivatMap.set(
                value,
                { DerivatCode: value, Aktiv: true }
            );
        }
    }

    for (const item of state.masterData?.IStufen || []) {
        const value = normalizeText(item.IStufeCode);

        if (value) {
            iStufeMap.set(
                value,
                { IStufeCode: value, Aktiv: true }
            );
        }
    }

    fillSelect(
        elements.trackingDerivatFilter,
        [...derivatMap.values()],
        "DerivatCode",
        currentDerivat,
        "Alle Derivate",
        false
    );

    fillSelect(
        elements.trackingIStufeFilter,
        [...iStufeMap.values()],
        "IStufeCode",
        currentIStufe,
        "Alle I-Stufen",
        false
    );
}

function createTrackingDetail(label, value) {
    const detail = document.createElement("div");
    detail.className = "saved-item-detail";

    const strong = document.createElement("strong");
    strong.textContent = label;

    const span = document.createElement("span");
    span.textContent = displayValue(value);

    detail.append(strong, span);

    return detail;
}


function createDetailField(label, value, mono = true) {
    const field = document.createElement("div");
    field.className = "detail-field";

    const labelElement = document.createElement("span");
    labelElement.className = "detail-field-label";
    labelElement.textContent = label;

    const valueElement = document.createElement("span");
    valueElement.className = mono
        ? "detail-field-value mono"
        : "detail-field-value";
    valueElement.textContent = displayValue(value);

    field.append(labelElement, valueElement);
    return field;
}

function createDetailSection(titleText) {
    const section = document.createElement("section");
    section.className = "detail-section";

    const title = document.createElement("h3");
    title.textContent = titleText;

    section.appendChild(title);
    return section;
}

function createDetailComparisonRow(
    fieldName,
    labelValue,
    qrValue
) {
    const row = document.createElement("div");
    row.className = "detail-comparison-row";

    const normalizedLabel = normalizeText(labelValue);
    const normalizedQR = normalizeText(qrValue);
    const matches = normalizedLabel === normalizedQR;

    row.classList.add(matches ? "match" : "mismatch");

    const field = document.createElement("div");
    field.className = "detail-comparison-field";
    field.textContent = fieldName;

    const label = document.createElement("div");
    label.className = "detail-comparison-value";
    label.textContent = displayValue(normalizedLabel);

    const qr = document.createElement("div");
    qr.className = "detail-comparison-value";
    qr.textContent = displayValue(normalizedQR);

    const status = document.createElement("div");
    status.className = "detail-comparison-status";
    status.textContent = matches
        ? "✓ Gleich"
        : "⚠ Abweichung";

    row.append(field, label, qr, status);
    return row;
}

function openTrackingDetail(record) {
    const status = getRecordValidationStatus(record);
    const meta = getStatusMeta(status);
    const isLocal = record.Source === "LOCAL";

    const partNumber = normalizeText(
        record.PartNumber || record.LabelPartNumber
    );

    const serialNumber = normalizeText(
        record.SerialNumber || record.LabelSerialNumber
    );

    const labelPartNumber = normalizeText(
        record.LabelPartNumber || partNumber
    );

    const qrPartNumber = normalizeText(
        record.QRPartNumber || partNumber
    );

    const labelSerialNumber = normalizeText(
        record.LabelSerialNumber || serialNumber
    );

    const qrSerialNumber = normalizeText(
        record.QRSerialNumber || serialNumber
    );

    const labelHardware = normalizeText(record.LabelHardware);
    const qrHardware = normalizeText(record.QRHardware);
    const labelSoftware = normalizeText(record.LabelSoftware);
    const qrSoftware = normalizeText(record.QRSoftware);

    const assignmentKey = normalizeText(record.AssignmentKey) ||
        getAssignmentKey(
            partNumber,
            serialNumber,
            record.Derivat,
            record.IStufe
        );

    const deviceKey = normalizeText(record.DeviceKey) ||
        getDeviceKey(partNumber, serialNumber);

    elements.trackingDetailTitle.textContent = assignmentKey;

    elements.trackingDetailSource.className = isLocal
        ? "record-source local"
        : "record-source";
    elements.trackingDetailSource.textContent = isLocal
        ? "Lokal"
        : "Basis";

    elements.trackingDetailStatus.className =
        `status-badge ${meta.cssClass}`;
    elements.trackingDetailStatus.textContent = status;

    elements.trackingDetailContent.innerHTML = "";

    const assignmentSection = createDetailSection("Zuordnung");
    const assignmentGrid = document.createElement("div");
    assignmentGrid.className = "detail-grid";

    assignmentGrid.append(
        createDetailField("PartNumber", partNumber),
        createDetailField("SerialNumber", serialNumber),
        createDetailField("Derivat", record.Derivat),
        createDetailField("I-Stufe", record.IStufe),
        createDetailField("DeviceKey", deviceKey),
        createDetailField("AssignmentKey", assignmentKey)
    );

    assignmentSection.appendChild(assignmentGrid);

    const comparisonSection = createDetailSection("Label / QR Vergleich");
    const comparison = document.createElement("div");
    comparison.className = "detail-comparison";

    const comparisonHeader = document.createElement("div");
    comparisonHeader.className =
        "detail-comparison-row detail-comparison-header";

    for (const text of ["Feld", "Label", "QR-Code", "Status"]) {
        const cell = document.createElement("div");
        cell.textContent = text;
        comparisonHeader.appendChild(cell);
    }

    comparison.append(
        comparisonHeader,
        createDetailComparisonRow(
            "PartNumber",
            labelPartNumber,
            qrPartNumber
        ),
        createDetailComparisonRow(
            "SerialNumber",
            labelSerialNumber,
            qrSerialNumber
        ),
        createDetailComparisonRow(
            "Hardware",
            labelHardware,
            qrHardware
        ),
        createDetailComparisonRow(
            "Software",
            labelSoftware,
            qrSoftware
        )
    );

    comparisonSection.appendChild(comparison);

    const statusSection = createDetailSection("Validierung");
    const statusGrid = document.createElement("div");
    statusGrid.className = "detail-grid";

    statusGrid.append(
        createDetailField("ValidationStatus", status),
        createDetailField(
            "DuplicateStatus",
            record.DuplicateStatus || "NEW"
        ),
        createDetailField(
            "DoppelDerivat",
            record.DoppelDerivat === true ? "JA" : "NEIN",
            false
        ),
        createDetailField(
            "Abweichungsfelder",
            Array.isArray(record.MismatchFields) &&
            record.MismatchFields.length > 0
                ? record.MismatchFields.join(", ")
                : "KEINE",
            false
        )
    );

    statusSection.appendChild(statusGrid);

    if (record.DoppelDerivat === true) {
        const note = document.createElement("p");
        note.className = "detail-note warning";
        note.textContent =
            "Dieses physische Teil ist zusätzlich einer weiteren Zuordnung zugeordnet (Doppelderivat).";
        statusSection.appendChild(note);
    }

    if (
        status === "LABEL_QR_MISMATCH" &&
        Array.isArray(record.MismatchFields) &&
        record.MismatchFields.length > 0
    ) {
        const note = document.createElement("p");
        note.className = "detail-note error";
        note.textContent =
            `Label/QR-Abweichung in: ${record.MismatchFields.join(", ")}.`;
        statusSection.appendChild(note);
    }

    const sourceSection = createDetailSection("Quelle");
    const sourceGrid = document.createElement("div");
    sourceGrid.className = "detail-grid";

    sourceGrid.append(
        createDetailField(
            "Quelle",
            isLocal ? "LOKALER BROWSER-SPEICHER" : "BASIS-TESTDATEN",
            false
        ),
        createDetailField(
            "Gespeichert am",
            isLocal && record.SavedAt
                ? new Date(record.SavedAt).toLocaleString("de-DE")
                : "–",
            false
        )
    );

    sourceSection.appendChild(sourceGrid);

    elements.trackingDetailContent.append(
        assignmentSection,
        comparisonSection,
        statusSection,
        sourceSection
    );

    elements.trackingDetailOverlay.classList.remove("hidden");
    document.body.classList.add("detail-open");
    elements.closeTrackingDetailButton.focus();
}

function closeTrackingDetail() {
    elements.trackingDetailOverlay.classList.add("hidden");
    document.body.classList.remove("detail-open");
}

function createTrackingItem(record) {
    const status = getRecordValidationStatus(record);
    const meta = getStatusMeta(status);
    const isLocal = record.Source === "LOCAL";

    const item = document.createElement("article");
    item.className =
        `saved-item ${meta.cardClass}`;

    const main = document.createElement("div");
    main.className = "saved-item-main";

    const heading = document.createElement("div");
    heading.className = "saved-item-heading";

    const title = document.createElement("div");
    title.className = "saved-item-title";
    title.textContent =
        normalizeText(record.AssignmentKey) ||
        getAssignmentKey(
            record.PartNumber,
            record.SerialNumber,
            record.Derivat,
            record.IStufe
        );

    const source = document.createElement("span");
    source.className =
        isLocal
            ? "record-source local"
            : "record-source";
    source.textContent =
        isLocal
            ? "Lokal"
            : "Basis";

    heading.append(title, source);

    const subtitle = document.createElement("p");
    subtitle.className = "saved-item-subtitle";

    let subtitleText =
        `DeviceKey: ${displayValue(record.DeviceKey)}`;

    if (
        status === "LABEL_QR_MISMATCH" &&
        Array.isArray(record.MismatchFields) &&
        record.MismatchFields.length > 0
    ) {
        subtitleText +=
            ` · Abweichend: ${record.MismatchFields.join(", ")}`;
    }

    subtitle.textContent = subtitleText;

    const details = document.createElement("div");
    details.className = "saved-item-details";

    details.append(
        createTrackingDetail("PartNumber", record.PartNumber),
        createTrackingDetail("SerialNumber", record.SerialNumber),
        createTrackingDetail("Derivat", record.Derivat),
        createTrackingDetail("I-Stufe", record.IStufe)
    );

    if (isLocal && record.SavedAt) {
        const savedAt = document.createElement("p");
        savedAt.className = "saved-item-meta";

        const date = new Date(record.SavedAt);

        savedAt.textContent =
            Number.isNaN(date.getTime())
                ? "Lokal gespeichert"
                : `Lokal gespeichert: ${date.toLocaleString("de-DE")}`;

        main.append(
            heading,
            subtitle,
            details,
            savedAt
        );
    }
    else {
        main.append(
            heading,
            subtitle,
            details
        );
    }

    const actions = document.createElement("div");
    actions.className = "saved-item-actions";

    const badge = document.createElement("span");
    badge.className =
        `status-badge saved-status ${meta.cssClass}`;
    badge.textContent = status;

    actions.appendChild(badge);

    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.className = "mini-button";
    detailButton.textContent = "Details";

    detailButton.addEventListener(
        "click",
        () => {
            openTrackingDetail(record);
        }
    );

    actions.appendChild(detailButton);

    if (isLocal) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "mini-button delete";
        deleteButton.textContent = "Löschen";

        deleteButton.addEventListener(
            "click",
            () => {
                deleteLocalTrackingRecord(
                    record.LocalId
                );
            }
        );

        actions.appendChild(deleteButton);
    }

    item.append(main, actions);

    return item;
}

function renderSavedItems() {
    const allItems = getTrackingDisplayItems();
    const filteredItems = getFilteredTrackingItems();

    elements.savedCount.textContent =
        allItems.length;

    elements.trackingResultInfo.textContent =
        `${filteredItems.length} von ${allItems.length} Datensätzen`;

    elements.savedItems.innerHTML = "";

    if (filteredItems.length === 0) {
        elements.savedItems.className =
            "saved-items empty-state";

        elements.savedItems.textContent =
            allItems.length === 0
                ? "Noch keine Datensätze vorhanden."
                : "Keine Datensätze entsprechen den aktuellen Filtern.";

        return;
    }

    elements.savedItems.className = "saved-items";

    const sorted = [...filteredItems].sort(
        (a, b) => {
            const aTime =
                a.Source === "LOCAL" && a.SavedAt
                    ? new Date(a.SavedAt).getTime()
                    : 0;

            const bTime =
                b.Source === "LOCAL" && b.SavedAt
                    ? new Date(b.SavedAt).getTime()
                    : 0;

            return bTime - aTime;
        }
    );

    for (const record of sorted) {
        elements.savedItems.appendChild(
            createTrackingItem(record)
        );
    }
}

function deleteLocalTrackingRecord(localId) {
    const before = state.savedItems.length;

    state.savedItems = state.savedItems.filter(
        item => item.LocalId !== localId
    );

    if (state.savedItems.length === before) {
        return;
    }

    saveLocalTrackingData();
    refreshTrackingFilterOptions();
    renderSavedItems();
    updateDataStatus();

    if (state.currentRecord) {
        checkCurrentInput();
    }
}

function resetTrackingFilters() {
    elements.trackingSearch.value = "";
    elements.trackingStatusFilter.value = "";
    elements.trackingDerivatFilter.value = "";
    elements.trackingIStufeFilter.value = "";

    renderSavedItems();
}

function checkCurrentInput() {
    try {
        const label = parseTrackingString(
            elements.labelInput.value
        );

        const qr = parseTrackingString(
            elements.qrInput.value
        );

        const derivat = normalizeText(
            elements.derivat.value
        );

        const iStufe = normalizeText(
            elements.iStufe.value
        );

        validateRequiredFields(
            label,
            qr,
            derivat,
            iStufe
        );

        const record = buildRecord(
            label,
            qr,
            derivat,
            iStufe
        );

        state.currentRecord = record;

        renderRecord(record);
    }
    catch (error) {
        renderError(error);
    }
}

function saveCurrentRecord() {
    if (!state.currentRecord) {
        return;
    }

    if (
        state.currentRecord.DuplicateStatus ===
        "DUPLICATE"
    ) {
        return;
    }

    const savedRecord = normalizeStoredTrackingRecord({
        ...state.currentRecord,
        MismatchFields: [
            ...state.currentRecord.MismatchFields
        ],
        SavedAt: new Date().toISOString(),
        LocalId: createLocalRecordId()
    });

    state.savedItems.push(savedRecord);

    saveLocalTrackingData();
    refreshTrackingFilterOptions();
    renderSavedItems();
    updateDataStatus();

    checkCurrentInput();
}

function resetForm() {
    elements.derivat.value = "";
    elements.iStufe.value = "";
    elements.labelInput.value = "";
    elements.qrInput.value = "";

    elements.resultCard.classList.add("hidden");
    elements.saveButton.disabled = true;

    clearComparison();

    state.currentRecord = null;
}

async function loadData() {
    try {
        const [
            masterResponse,
            trackingResponse
        ] = await Promise.all([
            fetch("../tests/data/MasterData.json"),
            fetch("../tests/data/TrackingData.json")
        ]);

        if (!masterResponse.ok) {
            throw new Error(
                "MasterData.json konnte nicht geladen werden"
            );
        }

        if (!trackingResponse.ok) {
            throw new Error(
                "TrackingData.json konnte nicht geladen werden"
            );
        }

        state.baseMasterData =
            await masterResponse.json();

        state.localMasterData =
            getLocalMasterData();

        state.savedItems =
            getLocalTrackingData();

        rebuildMasterData();

        const tracking =
            await trackingResponse.json();

        state.initialTrackingData =
            tracking.Steuergeraete || [];

        refreshMasterDataUi();
        refreshTrackingFilterOptions();
        renderSavedItems();

        elements.dataStatus.classList.remove("error");
    }
    catch (error) {
        elements.dataStatus.textContent =
            error.message;

        elements.dataStatus.classList.add("error");
        elements.checkButton.disabled = true;
        elements.addDerivatButton.disabled = true;
        elements.addIStufeButton.disabled = true;

        console.error(error);
    }
}

elements.checkButton.addEventListener(
    "click",
    checkCurrentInput
);

elements.saveButton.addEventListener(
    "click",
    saveCurrentRecord
);

elements.resetButton.addEventListener(
    "click",
    resetForm
);

elements.addDerivatButton.addEventListener(
    "click",
    addDerivat
);

elements.addIStufeButton.addEventListener(
    "click",
    addIStufe
);

elements.newDerivatCode.addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            addDerivat();
        }
    }
);

elements.newIStufeCode.addEventListener(
    "keydown",
    event => {
        if (event.key === "Enter") {
            addIStufe();
        }
    }
);

elements.trackingSearch.addEventListener(
    "input",
    renderSavedItems
);

elements.trackingStatusFilter.addEventListener(
    "change",
    renderSavedItems
);

elements.trackingDerivatFilter.addEventListener(
    "change",
    renderSavedItems
);

elements.trackingIStufeFilter.addEventListener(
    "change",
    renderSavedItems
);

elements.resetTrackingFiltersButton.addEventListener(
    "click",
    resetTrackingFilters
);

elements.closeTrackingDetailButton.addEventListener(
    "click",
    closeTrackingDetail
);

elements.trackingDetailOverlay.addEventListener(
    "click",
    event => {
        if (event.target === elements.trackingDetailOverlay) {
            closeTrackingDetail();
        }
    }
);

document.addEventListener(
    "keydown",
    event => {
        if (
            event.key === "Escape" &&
            !elements.trackingDetailOverlay.classList.contains("hidden")
        ) {
            closeTrackingDetail();
        }
    }
);

renderSavedItems();
loadData();

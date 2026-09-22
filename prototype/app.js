"use strict";

const state = {
    masterData: null,
    baseMasterData: null,
    localMasterData: createEmptyLocalMasterData(),
    initialTrackingData: [],
    savedItems: [],
    currentRecord: null,
    editingLocalId: null,
    qrScannerRunning: false,
    pendingQrText: "",
    capturedLabelImageDataUrl: null,
    capturedLabelCapturedAt: null,
    labelOcrBusy: false,
    lastOcrOriginal: null,
    labelScanAttempts: 0,
    maxLabelScanAttempts: 5
};

const elements = {
    dataStatus: document.getElementById("dataStatus"),
    derivat: document.getElementById("derivat"),
    iStufe: document.getElementById("iStufe"),
    ats: document.getElementById("ats"),
    yNummer: document.getElementById("yNummer"),
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
    qrPartNumberField: document.getElementById("qrPartNumberField"),
    qrCpidField: document.getElementById("qrCpidField"),
    qrHardwareField: document.getElementById("qrHardwareField"),
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
    resultAts: document.getElementById("resultAts"),
    resultYNummer: document.getElementById("resultYNummer"),
    resultPartStatuses: document.getElementById("resultPartStatuses"),
    resultDeviceKey: document.getElementById("resultDeviceKey"),
    resultAssignmentKey: document.getElementById("resultAssignmentKey"),
    savedItems: document.getElementById("savedItems"),
    savedCount: document.getElementById("savedCount"),
    trackingSearch: document.getElementById("trackingSearch"),
    trackingStatusFilter: document.getElementById("trackingStatusFilter"),
    trackingDerivatFilter: document.getElementById("trackingDerivatFilter"),
    trackingIStufeFilter: document.getElementById("trackingIStufeFilter"),
    trackingAtsFilter: document.getElementById("trackingAtsFilter"),
    trackingYNummerFilter: document.getElementById("trackingYNummerFilter"),
    trackingPartStatusFilter: document.getElementById("trackingPartStatusFilter"),
    trackingResultInfo: document.getElementById("trackingResultInfo"),
    resetTrackingFiltersButton: document.getElementById("resetTrackingFiltersButton"),
    trackingDetailOverlay: document.getElementById("trackingDetailOverlay"),
    trackingDetailTitle: document.getElementById("trackingDetailTitle"),
    trackingDetailSource: document.getElementById("trackingDetailSource"),
    trackingDetailStatus: document.getElementById("trackingDetailStatus"),
    trackingDetailContent: document.getElementById("trackingDetailContent"),
    closeTrackingDetailButton: document.getElementById("closeTrackingDetailButton"),
    exportMigrationPackageButton: document.getElementById("exportMigrationPackageButton"),
    migrationDeviceInfo: document.getElementById("migrationDeviceInfo"),
    exportTrackingJsonButton: document.getElementById("exportTrackingJsonButton"),
    exportTrackingCsvButton: document.getElementById("exportTrackingCsvButton"),
    importTrackingJsonButton: document.getElementById("importTrackingJsonButton"),
    trackingImportFile: document.getElementById("trackingImportFile"),
    trackingTransferMessage: document.getElementById("trackingTransferMessage"),
    openQrScannerButton: document.getElementById("openQrScannerButton"),
    qrScanResult: document.getElementById("qrScanResult"),
    qrScannerOverlay: document.getElementById("qrScannerOverlay"),
    qrScannerVideo: document.getElementById("qrScannerVideo"),
    qrScannerStatus: document.getElementById("qrScannerStatus"),
    scannerDiagnostics: document.getElementById("scannerDiagnostics"),
    closeQrScannerButton: document.getElementById("closeQrScannerButton"),
    cancelQrScannerButton: document.getElementById("cancelQrScannerButton"),
    retryQrScannerButton: document.getElementById("retryQrScannerButton"),
    captureLabelButton: document.getElementById("captureLabelButton"),
    capturedLabelPreview: document.getElementById("capturedLabelPreview"),
    capturedLabelImage: document.getElementById("capturedLabelImage"),
    capturedLabelInfo: document.getElementById("capturedLabelInfo"),
    removeCapturedLabelButton: document.getElementById("removeCapturedLabelButton"),
    labelOcrPanel: document.getElementById("labelOcrPanel"),
    labelOcrProgress: document.getElementById("labelOcrProgress"),
    labelOcrPartNumber: document.getElementById("labelOcrPartNumber"),
    labelOcrSerialNumber: document.getElementById("labelOcrSerialNumber"),
    labelOcrHardware: document.getElementById("labelOcrHardware"),
    labelOcrSoftware: document.getElementById("labelOcrSoftware"),
    labelOcrStatus: document.getElementById("labelOcrStatus"),
    labelOcrRawText: document.getElementById("labelOcrRawText"),
    labelOcrPartNumberField: document.getElementById("labelOcrPartNumberField"),
    labelOcrSerialNumberField: document.getElementById("labelOcrSerialNumberField"),
    labelOcrHardwareField: document.getElementById("labelOcrHardwareField"),
    labelOcrSoftwareField: document.getElementById("labelOcrSoftwareField"),
    labelOcrPartNumberCompare: document.getElementById("labelOcrPartNumberCompare"),
    labelOcrSerialNumberCompare: document.getElementById("labelOcrSerialNumberCompare"),
    labelOcrHardwareCompare: document.getElementById("labelOcrHardwareCompare"),
    labelOcrSoftwareCompare: document.getElementById("labelOcrSoftwareCompare"),
    exportOcrInsightButton: document.getElementById("exportOcrInsightButton"),
    ocrLearningStatus: document.getElementById("ocrLearningStatus"),
    applyOcrValuesButton: document.getElementById("applyOcrValuesButton"),
    scanRetryHint: document.getElementById("scanRetryHint"),
    scanRetryTitle: document.getElementById("scanRetryTitle"),
    scanRetryText: document.getElementById("scanRetryText"),
    manualAddAfterScanButton: document.getElementById("manualAddAfterScanButton")
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

function normalizeTrackingKey(value) {
    const compact = normalizeText(value)
        .replace(/[^A-Z0-9]/g, "");

    const aliases = {
        PN: "PN",
        PARTNO: "PN",
        PARTNUMBER: "PN",
        PARTNR: "PN",
        TEILENUMMER: "PN",
        TEILENR: "PN",
        SN: "SN",
        SERIAL: "SN",
        SERIALNO: "SN",
        SERIALNUMBER: "SN",
        SERIENNUMMER: "SN",
        SERIENNR: "SN",
        HW: "HW",
        HARDWARE: "HW",
        HARDWAREVERSION: "HW",
        HWVERSION: "HW",
        SW: "SW",
        SOFTWARE: "SW",
        SOFTWAREVERSION: "SW",
        SWVERSION: "SW"
    };

    return aliases[compact] || "";
}

function parseTrackingString(
    inputString,
    options = {}
) {
    const raw = String(inputString || "").trim();

    if (!raw) {
        throw new Error("Tracking-String ist leer");
    }

    const allowUnknown = Boolean(
        options.allowUnknown
    );
    const data = {};

    function addValue(rawKey, rawValue) {
        const key =
            normalizeTrackingKey(rawKey);

        if (!key) {
            if (allowUnknown) {
                return;
            }

            throw new Error(
                `Unbekannter Tracking-Schlüssel: '${normalizeText(rawKey)}'`
            );
        }

        const value =
            normalizeText(rawValue);

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                key
            )
        ) {
            if (data[key] === value) {
                return;
            }

            throw new Error(
                `Tracking-Schlüssel '${key}' ist mehrfach mit unterschiedlichen Werten vorhanden`
            );
        }

        data[key] = value;
    }

    if (
        raw.startsWith("{") &&
        raw.endsWith("}")
    ) {
        try {
            const parsed = JSON.parse(raw);

            for (
                const [key, value] of
                Object.entries(parsed)
            ) {
                if (
                    value === null ||
                    value === undefined ||
                    typeof value === "object"
                ) {
                    continue;
                }

                addValue(key, value);
            }
        }
        catch (error) {
            if (!allowUnknown) {
                throw new Error(
                    `QR/Tracking-JSON ist ungültig: ${error.message}`
                );
            }
        }
    }

    if (Object.keys(data).length === 0) {
        let normalizedRaw = raw;
        const questionMark =
            normalizedRaw.indexOf("?");

        if (questionMark >= 0) {
            normalizedRaw =
                normalizedRaw.slice(
                    questionMark + 1
                );
        }

        const segments =
            normalizedRaw
                .replace(/\r/g, "\n")
                .split(/[;\n&|]+/)
                .map(item => item.trim())
                .filter(Boolean);

        for (const segment of segments) {
            const match =
                segment.match(
                    /^\s*([^:=]+?)\s*[:=]\s*(.*?)\s*$/
                );

            if (!match) {
                if (allowUnknown) {
                    continue;
                }

                throw new Error(
                    `Ungültiges Segment ohne '=' oder ':': '${segment}'`
                );
            }

            addValue(
                match[1],
                match[2]
            );
        }
    }

    if (Object.keys(data).length === 0) {
        throw new Error(
            "QR-Code wurde technisch gelesen, enthält aber noch keine unterstützten PN/SN/HW/SW-Felder."
        );
    }

    return {
        partNumber:
            normalizeText(data.PN),
        serialNumber:
            normalizeText(data.SN),
        hardware:
            normalizeText(data.HW),
        software:
            normalizeText(data.SW)
    };
}

function getDeviceKey(partNumber, serialNumber) {
    return [
        normalizeText(partNumber),
        normalizeText(serialNumber)
    ].join("|");
}

function syncQrTextFromFields() {
    const values = [
        ["PN", elements.qrPartNumberField.value],
        ["SN", elements.qrCpidField.value],
        ["HW", elements.qrHardwareField.value]
    ];
    const qrText = values
        .filter(([, value]) => normalizeText(value))
        .map(([key, value]) => `${key}=${normalizeText(value)}`)
        .join(";");

    elements.qrInput.value = qrText;
    elements.labelInput.value = qrText;
}

function getQrTokenValues(qrText) {
    return String(qrText || "")
        .split(/[_|;,\n\r\t]+/)
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => value.includes("=")
            ? value.slice(value.indexOf("=") + 1).trim()
            : value);
}

function parseProfileMappedQrFields(qrText) {
    const values = getQrTokenValues(qrText);
    const usesConfirmedSchema =
        /^\d{2}\.\d{2}\.\d{4}$/.test(values[0] || "") &&
        values.length >= 3;

    // Das bestätigte Schema hat Vorrang vor älteren, lokal gespeicherten
    // Profilen: Datum_PartNumber_CPID_Status_Index.
    if (usesConfirmedSchema) {
        return {
            partNumber: normalizeText(values[1]),
            serialNumber: normalizeText(values[2]),
            hardware: ""
        };
    }

    const profile = TeiletrackingLabelProfileService &&
        typeof TeiletrackingLabelProfileService.getActiveProfile === "function"
        ? TeiletrackingLabelProfileService.getActiveProfile()
        : null;
    const mappings = profile && profile.mappings || {};
    let partNumber = values[mappings.partNumber] || "";
    let serialNumber = values[mappings.serialNumber] || "";

    if (!partNumber || !serialNumber) {
        throw new Error("Das aktive Labelprofil enthält noch keine vollständige QR-Zuordnung für PartNumber und CPID.");
    }

    return {
        partNumber: normalizeText(partNumber),
        serialNumber: normalizeText(serialNumber),
        hardware: ""
    };
}

function populateQrFields(qrText) {
    let parsed;
    try {
        parsed = parseTrackingString(qrText, { allowUnknown: true });
    }
    catch {
        parsed = parseProfileMappedQrFields(qrText);
    }

    elements.qrPartNumberField.value = parsed.partNumber;
    elements.qrCpidField.value = parsed.serialNumber;
    if (parsed.hardware) {
        elements.qrHardwareField.value = parsed.hardware;
    }
    syncQrTextFromFields();
}

function getAssignmentKey(
    partNumber,
    serialNumber,
    derivat,
    iStufe,
    ats = "",
    yNummer = ""
) {
    const base = [
        normalizeText(partNumber),
        normalizeText(serialNumber),
        normalizeText(derivat),
        normalizeText(iStufe)
    ];

    const normalizedAts =
        normalizeText(ats);
    const normalizedYNummer =
        normalizeText(yNummer);

    if (
        normalizedAts ||
        normalizedYNummer
    ) {
        base.push(
            normalizedAts,
            normalizedYNummer
        );
    }

    return base.join("|");
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

function validateRequiredFields(
    label,
    qr,
    derivat,
    iStufe
) {
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
        throw new Error(
            errors.join("; ")
        );
    }
}

function getAllTrackingItems() {
    return [
        ...state.initialTrackingData,
        ...state.savedItems
    ];
}

function getDuplicateStatus(deviceKey, assignmentKey) {
    const items = getAllTrackingItems().filter(
        item => !state.editingLocalId || item.LocalId !== state.editingLocalId
    );

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

function buildRecord(
    label,
    qr,
    derivat,
    iStufe,
    ats = "",
    yNummer = "",
    partStatuses = []
) {
    const normalizedDerivat =
        normalizeText(derivat);
    const normalizedIStufe =
        normalizeText(iStufe);
    const normalizedAts =
        normalizeText(ats);
    const normalizedYNummer =
        normalizeText(yNummer);

    const normalizedStatuses =
        TeiletrackingFeatureService
            .normalizeStatusArray(
                partStatuses
            );

    const labelPartNumber =
        normalizeText(label.partNumber);
    const qrPartNumber =
        normalizeText(qr.partNumber);
    const labelSerialNumber =
        normalizeText(label.serialNumber);
    const qrSerialNumber =
        normalizeText(qr.serialNumber);
    const labelHardware =
        normalizeText(label.hardware);
    const qrHardware =
        normalizeText(qr.hardware);
    const labelSoftware =
        normalizeText(label.software);
    const qrSoftware =
        normalizeText(qr.software);

    const deviceKey =
        getDeviceKey(
            labelPartNumber,
            labelSerialNumber
        );

    const assignmentKey =
        getAssignmentKey(
            labelPartNumber,
            labelSerialNumber,
            normalizedDerivat,
            normalizedIStufe,
            normalizedAts,
            normalizedYNummer
        );

    const duplicateStatus =
        getDuplicateStatus(
            deviceKey,
            assignmentKey
        );

    const mismatchFields =
        getMismatchFields(
            label,
            qr
        );

    let validationStatus = "OK";

    if (mismatchFields.length > 0) {
        validationStatus =
            "LABEL_QR_MISMATCH";
    }
    else if (
        duplicateStatus === "DUPLICATE"
    ) {
        validationStatus =
            "DUPLICATE";
    }
    else if (
        duplicateStatus ===
        "DOUBLE_DERIVATIVE"
    ) {
        validationStatus =
            "DOUBLE_DERIVATIVE";
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
        ATS: normalizedAts,
        YNummer: normalizedYNummer,
        PartStatuses: normalizedStatuses,
        Teilestatus:
            normalizedStatuses.join(";"),
        LabelHardware: labelHardware,
        QRHardware: qrHardware,
        LabelSoftware: labelSoftware,
        QRSoftware: qrSoftware,
        DeviceKey: deviceKey,
        AssignmentKey: assignmentKey,
        DuplicateStatus: duplicateStatus,
        ValidationStatus: validationStatus,
        DoppelDerivat:
            duplicateStatus ===
            "DOUBLE_DERIVATIVE",
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
                message: "QR-/DataMatrix-Werte sind gültig. Die Zuordnung ist neu."
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
    elements.resultAts.textContent =
        displayValue(record.ATS);
    elements.resultYNummer.textContent =
        displayValue(record.YNummer);

    elements.resultPartStatuses.innerHTML = "";
    elements.resultPartStatuses.appendChild(
        TeiletrackingFeatureService
            .createStatusChips(
                record.PartStatuses ||
                record.Teilestatus
            )
    );

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
    elements.resultAts.textContent = "–";
    elements.resultYNummer.textContent = "–";
    elements.resultPartStatuses.innerHTML = "–";
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

function normalizeLocalMasterData(
    parsed
) {
    const empty =
        createEmptyLocalMasterData();

    if (
        !parsed ||
        typeof parsed !== "object"
    ) {
        return empty;
    }

    return {
        Derivate:
            Array.isArray(
                parsed.Derivate
            )
                ? parsed.Derivate
                : [],
        IStufen:
            Array.isArray(
                parsed.IStufen
            )
                ? parsed.IStufen
                : [],
        AktivOverrides: {
            Derivate:
                parsed.AktivOverrides &&
                parsed.AktivOverrides.Derivate &&
                typeof parsed.AktivOverrides.Derivate ===
                    "object"
                    ? parsed
                        .AktivOverrides
                        .Derivate
                    : {},
            IStufen:
                parsed.AktivOverrides &&
                parsed.AktivOverrides.IStufen &&
                typeof parsed.AktivOverrides.IStufen ===
                    "object"
                    ? parsed
                        .AktivOverrides
                        .IStufen
                    : {}
        }
    };
}

function normalizeStoredTrackingRecord(item) {
    const mismatchFields =
        Array.isArray(item.MismatchFields)
            ? item.MismatchFields
                .map(normalizeDescription)
            : [];

    const partNumber =
        normalizeText(
            item.PartNumber ||
            item.LabelPartNumber
        );

    const serialNumber =
        normalizeText(
            item.SerialNumber ||
            item.LabelSerialNumber
        );

    const derivat =
        normalizeText(item.Derivat);
    const iStufe =
        normalizeText(item.IStufe);
    const ats =
        normalizeText(item.ATS);
    const yNummer =
        normalizeText(item.YNummer);

    const partStatuses =
        TeiletrackingFeatureService
            .normalizeStatusArray(
                item.PartStatuses ||
                item.Teilestatus
            );

    return {
        ...item,
        PartNumber: partNumber,
        SerialNumber: serialNumber,
        LabelPartNumber:
            normalizeText(
                item.LabelPartNumber ||
                partNumber
            ),
        QRPartNumber:
            normalizeText(
                item.QRPartNumber ||
                partNumber
            ),
        LabelSerialNumber:
            normalizeText(
                item.LabelSerialNumber ||
                serialNumber
            ),
        QRSerialNumber:
            normalizeText(
                item.QRSerialNumber ||
                serialNumber
            ),
        Derivat: derivat,
        IStufe: iStufe,
        ATS: ats,
        YNummer: yNummer,
        PartStatuses:
            partStatuses,
        Teilestatus:
            partStatuses.join(";"),
        LabelHardware:
            normalizeText(
                item.LabelHardware
            ),
        QRHardware:
            normalizeText(
                item.QRHardware
            ),
        LabelSoftware:
            normalizeText(
                item.LabelSoftware
            ),
        QRSoftware:
            normalizeText(
                item.QRSoftware
            ),
        DeviceKey:
            normalizeText(
                item.DeviceKey ||
                getDeviceKey(
                    partNumber,
                    serialNumber
                )
            ),
        AssignmentKey:
            normalizeText(
                item.AssignmentKey ||
                getAssignmentKey(
                    partNumber,
                    serialNumber,
                    derivat,
                    iStufe,
                    ats,
                    yNummer
                )
            ),
        DuplicateStatus:
            normalizeText(
                item.DuplicateStatus ||
                "NEW"
            ),
        ValidationStatus:
            normalizeText(
                item.ValidationStatus ||
                "OK"
            ),
        DoppelDerivat:
            Boolean(item.DoppelDerivat),
        MismatchFields:
            mismatchFields,
        SavedAt:
            item.SavedAt || null,
        CapturedAt:
            item.CapturedAt ||
            item.SavedAt ||
            null,
        SourceRecordId:
            normalizeDescription(
                item.SourceRecordId
            ),
        SourceDeviceId:
            normalizeDescription(
                item.SourceDeviceId
            ),
        SourceOrigin:
            normalizeDescription(
                item.SourceOrigin ||
                "LEGACY_LOCAL"
            ),
        TransferBatchId:
            normalizeDescription(
                item.TransferBatchId
            ),
        TransferSourceRecordId:
            normalizeDescription(
                item.TransferSourceRecordId
            ),
        LocalId:
            item.LocalId ||
            createLocalRecordId()
    };
}

async function saveMasterData() {
    await TeiletrackingDataService
        .saveMasterData(
            state.localMasterData
        );
}

async function saveTrackingData() {
    await TeiletrackingDataService
        .saveTrackingData(
            state.savedItems
        );
}

function createLocalRecordId() {
    return TeiletrackingDataService
        .createLocalRecordId();
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

    const providerInfo =
        TeiletrackingDataService
            .getProviderInfo();

    const featureStats =
        TeiletrackingFeatureService
            .getStats();

    elements.dataStatus.textContent =
        `${providerInfo.displayName} · ` +
        `${activeDerivate} aktive Derivate · ` +
        `${activeIStufen} aktive I-Stufen · ` +
        `${featureStats.activeATS} aktive ATS · ` +
        `${featureStats.activeYNumbers} aktive Y-Nummern · ` +
        `${featureStats.activeStatuses} Statuswerte · ` +
        `${state.initialTrackingData.length} Basis-Teile · ` +
        `${state.savedItems.length} gespeichert`;
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

async function toggleMasterDataStatus(type, valueField, code) {
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

    await saveMasterData();
    rebuildMasterData();
    refreshMasterDataUi();

    showMasterDataMessage(
        `'${normalizeText(code)}' wurde ` +
        (newStatus ? "aktiviert." : "deaktiviert."),
        "success"
    );
}

async function deleteLocalMasterDataItem(
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

    await saveMasterData();
    rebuildMasterData();
    refreshMasterDataUi();

    showMasterDataMessage(
        `'${normalizedCode}' wurde aus den lokalen Stammdaten gelöscht.`,
        "success"
    );
}

async function addDerivat() {
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

    await saveMasterData();
    rebuildMasterData();
    refreshMasterDataUi(code, null);

    elements.newDerivatCode.value = "";
    elements.newDerivatDescription.value = "";

    showMasterDataMessage(
        `Derivat '${code}' wurde lokal angelegt und ausgewählt.`,
        "success"
    );
}

async function addIStufe() {
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

    await saveMasterData();
    rebuildMasterData();
    refreshMasterDataUi(null, code);

    elements.newIStufeCode.value = "";
    elements.newIStufeDescription.value = "";

    showMasterDataMessage(
        `I-Stufe '${code}' wurde lokal angelegt und ausgewählt.`,
        "success"
    );
}




function hideScanRetryHint() {
    elements.scanRetryHint.classList.add(
        "hidden"
    );

    elements.scanRetryHint.classList.remove(
        "manual"
    );

    elements.manualAddAfterScanButton.classList.add(
        "hidden"
    );

    elements.scanRetryTitle.textContent =
        "Bitte erneut scannen";

    elements.scanRetryText.textContent = "";
}

function resetLabelScanAttempts() {
    state.labelScanAttempts = 0;
    hideScanRetryHint();
}

function registerLabelScanSuccess() {
    state.labelScanAttempts = 0;
    hideScanRetryHint();
}

function registerLabelScanFailure(
    reason
) {
    state.labelScanAttempts += 1;

    const currentAttempt =
        Math.min(
            state.labelScanAttempts,
            state.maxLabelScanAttempts
        );

    elements.scanRetryHint.classList.remove(
        "hidden"
    );

    if (
        currentAttempt >=
        state.maxLabelScanAttempts
    ) {
        elements.scanRetryHint.classList.add(
            "manual"
        );

        elements.scanRetryTitle.textContent =
            "Manuell hinzufügen";

        elements.scanRetryText.textContent =
            `Auch nach ${state.maxLabelScanAttempts} Scanversuchen konnten nicht alle benötigten Daten zuverlässig gelesen werden. ${reason} Bitte die Werte jetzt manuell erfassen.`;

        elements.manualAddAfterScanButton.classList.remove(
            "hidden"
        );

        setQrScannerStatus(
            "Manuell hinzufügen: Nach 5 Scanversuchen ist keine vollständige automatische Erkennung gelungen.",
            "error"
        );

        return;
    }

    elements.scanRetryHint.classList.remove(
        "manual"
    );

    elements.scanRetryTitle.textContent =
        "Bitte erneut scannen";

    elements.scanRetryText.textContent =
        `Versuch ${currentAttempt} von ${state.maxLabelScanAttempts} war nicht vollständig lesbar. ${reason} Bitte Label neu ausrichten und erneut scannen.`;

    elements.manualAddAfterScanButton.classList.add(
        "hidden"
    );

    setQrScannerStatus(
        `Bitte erneut scannen · Versuch ${currentAttempt} von ${state.maxLabelScanAttempts}.`,
        "error"
    );
}

function openManualEntryAfterScan() {
    closeQrScanner();

    setQrScanResult(
        "Automatische Erkennung nach 5 Versuchen nicht vollständig. Bitte QR- und Label-Daten manuell hinzufügen.",
        "error"
    );

    elements.labelInput.focus();
}

function setQrScanResult(message, type = "") {
    elements.qrScanResult.classList.remove(
        "success",
        "error"
    );

    if (type) {
        elements.qrScanResult.classList.add(type);
    }

    elements.qrScanResult.textContent = message;
}

function setQrScannerStatus(message, type = "") {
    elements.qrScannerStatus.classList.remove(
        "success",
        "error"
    );

    if (type) {
        elements.qrScannerStatus.classList.add(type);
    }

    elements.qrScannerStatus.textContent = message;
}

function stopQrScannerCamera() {
    state.qrScannerRunning = false;

    TeiletrackingScannerService.stopCamera(
        elements.qrScannerVideo
    );
}

function closeQrScanner() {
    stopQrScannerCamera();

    elements.qrScannerOverlay.classList.add(
        "hidden"
    );

    document.body.classList.remove(
        "scanner-open"
    );
}


function setLabelOcrProgress(
    text,
    type = ""
) {
    elements.labelOcrProgress.classList.remove(
        "running",
        "success",
        "error"
    );

    if (type) {
        elements.labelOcrProgress.classList.add(type);
    }

    elements.labelOcrProgress.textContent = text;
}

function setLabelOcrStatus(
    text,
    type = ""
) {
    elements.labelOcrStatus.classList.remove(
        "success",
        "warning",
        "error"
    );

    if (type) {
        elements.labelOcrStatus.classList.add(type);
    }

    elements.labelOcrStatus.textContent = text;
}

function clearOcrFieldComparison() {
    const fieldElements = [
        elements.labelOcrPartNumberField,
        elements.labelOcrSerialNumberField,
        elements.labelOcrHardwareField,
        elements.labelOcrSoftwareField
    ];

    for (const fieldElement of fieldElements) {
        fieldElement.classList.remove(
            "match",
            "mismatch",
            "missing"
        );
    }

    elements.labelOcrPartNumberCompare.textContent =
        "Noch nicht verglichen";

    elements.labelOcrSerialNumberCompare.textContent =
        "Noch nicht verglichen";

    elements.labelOcrHardwareCompare.textContent =
        "Noch nicht verglichen";

    elements.labelOcrSoftwareCompare.textContent =
        "Noch nicht verglichen";
}

function clearLabelOcrResult() {
    state.lastOcrOriginal = null;
    elements.labelOcrPanel.classList.add("hidden");

    setLabelOcrProgress("–");

    elements.labelOcrPartNumber.value = "";
    elements.labelOcrSerialNumber.value = "";
    elements.labelOcrHardware.value = "";
    elements.labelOcrSoftware.value = "";

    elements.labelOcrStatus.textContent = "";
    elements.labelOcrStatus.classList.remove(
        "success",
        "warning",
        "error"
    );

    elements.labelOcrRawText.textContent = "";

    clearOcrFieldComparison();
}

function updateLabelOcrServiceProgress(message) {
    if (!message) {
        return;
    }

    const status =
        String(message.status || "").trim();

    const progress =
        Number(message.progress);

    const passPrefix =
        message.passLabel
            ? `${message.passLabel} · `
            : "";

    if (
        Number.isFinite(progress) &&
        progress >= 0 &&
        progress <= 1
    ) {
        const percent =
            Math.round(progress * 100);

        setLabelOcrProgress(
            `${percent} %`,
            "running"
        );
    }

    if (status) {
        setLabelOcrStatus(
            `${passPrefix}${status} …`
        );
    }
}

async function loadOcrConfig() {
    const result =
        await TeiletrackingOcrService
            .loadConfig(
                "./ocr-config.json"
            );

    console.info(
        `OCR-Mapping geladen: ${TeiletrackingOcrService.getProfileName()} (${result.source})`
    );
}

function getOcrProfileName() {
    return TeiletrackingOcrService
        .getProfileName();
}

function buildTrackingStringFromOcrData(
    data
) {
    return TeiletrackingOcrService
        .buildTrackingString(data);
}


function getEditableOcrData() {
    return {
        partNumber:
            normalizeText(
                elements.labelOcrPartNumber.value
            ),
        serialNumber:
            normalizeText(
                elements.labelOcrSerialNumber.value
            ),
        hardware:
            normalizeText(
                elements.labelOcrHardware.value
            ),
        software:
            normalizeText(
                elements.labelOcrSoftware.value
            )
    };
}

function getQrDataForOcrPreview() {
    const qrText =
        elements.qrInput.value.trim();

    if (!qrText) {
        return null;
    }

    try {
        return parseTrackingString(
            qrText,
            { allowUnknown: true }
        );
    }
    catch {
        return null;
    }
}

function updateSingleOcrComparison(
    fieldElement,
    statusElement,
    labelValue,
    qrValue
) {
    fieldElement.classList.remove(
        "match",
        "mismatch",
        "missing"
    );

    const normalizedLabel =
        normalizeText(labelValue);

    const normalizedQr =
        normalizeText(qrValue);

    if (
        !normalizedLabel &&
        !normalizedQr
    ) {
        statusElement.textContent =
            "Auf Label und QR nicht vorhanden";

        return;
    }

    if (
        !normalizedLabel &&
        normalizedQr
    ) {
        fieldElement.classList.add(
            "missing"
        );

        statusElement.textContent =
            `OCR fehlt · QR: ${normalizedQr}`;

        return;
    }

    if (
        normalizedLabel &&
        !normalizedQr
    ) {
        fieldElement.classList.add(
            "missing"
        );

        statusElement.textContent =
            "Wert auf Label erkannt · QR-Feld leer";

        return;
    }

    if (
        normalizedLabel ===
        normalizedQr
    ) {
        fieldElement.classList.add(
            "match"
        );

        statusElement.textContent =
            "✓ Gleich";

        return;
    }

    fieldElement.classList.add(
        "mismatch"
    );

    statusElement.textContent =
        `⚠ Abweichung · QR: ${normalizedQr}`;
}

function updateLabelOcrComparisonPreview() {
    const qrData =
        getQrDataForOcrPreview();

    if (!qrData) {
        clearOcrFieldComparison();

        elements.labelOcrPartNumberCompare.textContent =
            "Kein auswertbarer QR-Code";

        elements.labelOcrSerialNumberCompare.textContent =
            "Kein auswertbarer QR-Code";

        elements.labelOcrHardwareCompare.textContent =
            "Kein auswertbarer QR-Code";

        elements.labelOcrSoftwareCompare.textContent =
            "Kein auswertbarer QR-Code";

        return;
    }

    const ocrData =
        getEditableOcrData();

    updateSingleOcrComparison(
        elements.labelOcrPartNumberField,
        elements.labelOcrPartNumberCompare,
        ocrData.partNumber,
        qrData.partNumber
    );

    updateSingleOcrComparison(
        elements.labelOcrSerialNumberField,
        elements.labelOcrSerialNumberCompare,
        ocrData.serialNumber,
        qrData.serialNumber
    );

    updateSingleOcrComparison(
        elements.labelOcrHardwareField,
        elements.labelOcrHardwareCompare,
        ocrData.hardware,
        qrData.hardware
    );

    updateSingleOcrComparison(
        elements.labelOcrSoftwareField,
        elements.labelOcrSoftwareCompare,
        ocrData.software,
        qrData.software
    );
}

function renderLabelOcrResult(
    ocrData,
    rawText
) {
    state.lastOcrOriginal = {
        partNumber: normalizeText(ocrData.partNumber),
        serialNumber: normalizeText(ocrData.serialNumber),
        hardware: normalizeText(ocrData.hardware),
        software: normalizeText(ocrData.software)
    };
    elements.labelOcrPanel.classList.remove(
        "hidden"
    );

    elements.labelOcrPartNumber.value =
        normalizeText(
            ocrData.partNumber
        );

    elements.labelOcrSerialNumber.value =
        normalizeText(
            ocrData.serialNumber
        );

    elements.labelOcrHardware.value =
        normalizeText(
            ocrData.hardware
        );

    elements.labelOcrSoftware.value =
        normalizeText(
            ocrData.software
        );

    elements.labelOcrRawText.textContent =
        String(rawText || "").trim();

    updateLabelOcrComparisonPreview();
}

function getOcrQualityBuckets() {
    const diagnostics =
        TeiletrackingScannerService.getLastDiagnostics() || {};
    const quality = diagnostics.quality || {};
    const sharpness = Number(quality.edgeScore || 0);
    const brightness = Number(quality.brightness || 0);
    const motion = Number(quality.motion || 0);

    return {
        sharpnessBucket: sharpness >= 18 ? "high" : sharpness >= 11 ? "medium" : "low",
        brightnessBucket: brightness < 58 ? "dark" : brightness > 220 ? "bright" : "balanced",
        motionBucket: motion > 24 ? "high" : motion > 10 ? "medium" : "low"
    };
}

function exportAnonymizedOcrInsights() {
    if (!state.lastOcrOriginal) {
        elements.ocrLearningStatus.textContent =
            "Noch keine OCR-Erkennung vorhanden.";
        return;
    }

    const corrected = getEditableOcrData();
    const quality = getOcrQualityBuckets();
    const fields = [
        ["PartNumber", "partNumber"],
        ["SerialNumber", "serialNumber"],
        ["Hardware", "hardware"],
        ["Software", "software"]
    ];
    const insights = [];

    for (const [label, key] of fields) {
        const observed = state.lastOcrOriginal[key];
        const expected = corrected[key];
        if (!observed || !expected || observed === expected) continue;
        insights.push(
            TeiletrackingOcrLearningService.createInsight({
                field: label,
                observed,
                expected,
                quality,
                profile: getOcrProfileName()
            })
        );
    }

    if (insights.length === 0) {
        elements.ocrLearningStatus.textContent =
            "Keine manuell korrigierte Abweichung gefunden; es wurde nichts exportiert.";
        return;
    }

    const safeExport =
        TeiletrackingOcrLearningService.createExport(insights);
    const blob = new Blob(
        [JSON.stringify(safeExport, null, 2)],
        { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ocr-insights-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    elements.ocrLearningStatus.textContent =
        `${insights.length} anonymisierte Erkenntnis(se) exportiert. Keine Rohwerte oder Bilder enthalten.`;
}

function applyOcrValuesAndCompare() {
    const ocrData =
        getEditableOcrData();

    const missingRequired = [];

    if (!ocrData.partNumber) {
        missingRequired.push("PartNumber");
    }

    if (!ocrData.serialNumber) {
        missingRequired.push("SerialNumber");
    }

    if (missingRequired.length > 0) {
        setLabelOcrStatus(
            `Bitte zuerst die OCR-Pflichtfelder korrigieren: ${missingRequired.join(", ")}.`,
            "warning"
        );

        updateLabelOcrComparisonPreview();
        return;
    }

    const labelTrackingString =
        buildTrackingStringFromOcrData(
            ocrData
        );

    elements.labelInput.value =
        labelTrackingString;

    updateLabelOcrComparisonPreview();

    if (!elements.qrInput.value.trim()) {
        setLabelOcrStatus(
            "OCR-Werte wurden in das Label-Feld übernommen. Für den Vergleich fehlt noch ein QR-Code.",
            "warning"
        );

        return;
    }

    if (
        !elements.derivat.value ||
        !elements.iStufe.value
    ) {
        setLabelOcrStatus(
            "OCR-Werte wurden übernommen und mit dem QR-Code vorverglichen. Für die vollständige Teileprüfung bitte Derivat und I-Stufe wählen.",
            "warning"
        );

        return;
    }

    checkCurrentInput();

    setLabelOcrStatus(
        "Korrigierte OCR-Werte wurden übernommen. Die vollständige Label/QR-Prüfung wurde ausgeführt.",
        "success"
    );
}

async function recognizeVisibleLabelText(
    sourceCanvas,
    qrText
) {
    elements.labelOcrPanel.classList.remove(
        "hidden"
    );

    setLabelOcrProgress(
        "Start …",
        "running"
    );

    setLabelOcrStatus(
        `OCR wird vorbereitet · Mapping: ${getOcrProfileName()} …`
    );

    state.labelOcrBusy = true;

    try {
        let qrData = null;

        try {
            if (qrText) {
                qrData =
                    parseTrackingString(
                        qrText,
                        { allowUnknown: true }
                    );
            }
        }
        catch {
            qrData = null;
        }

        const bestCandidate =
            await TeiletrackingOcrService
                .recognizeBest(
                    sourceCanvas,
                    qrData,
                    {
                        onProgress:
                            updateLabelOcrServiceProgress
                    }
                );

        const {
            ocrData,
            rawText,
            variantName,
            confidence,
            missingFields
        } = bestCandidate;

        renderLabelOcrResult(
            ocrData,
            rawText
        );

        const labelTrackingString =
            buildTrackingStringFromOcrData(
                ocrData
            );

        if (labelTrackingString) {
            elements.labelInput.value =
                labelTrackingString;
        }

        const confidenceText =
            Number.isFinite(
                Number(confidence)
            )
                ? `${Math.round(confidence)} %`
                : "–";

        if (!bestCandidate.complete) {
            setLabelOcrProgress(
                "Unvollständig",
                "error"
            );

            setLabelOcrStatus(
                `Beste OCR-Variante: ${variantName} · OCR-Konfidenz: ${confidenceText}. Nicht sicher erkannt: ${missingFields.join(", ")}. Bitte erneut scannen oder die Werte manuell korrigieren.`,
                "warning"
            );

            return bestCandidate;
        }

        setLabelOcrProgress(
            "Fertig",
            "success"
        );

        setLabelOcrStatus(
            `OCR abgeschlossen · Variante: ${variantName} · Konfidenz: ${confidenceText} · Mapping: ${getOcrProfileName()}. Bitte die erkannten Werte kontrollieren und anschließend „OCR-Werte übernehmen & vergleichen“ verwenden.`,
            "success"
        );

        return bestCandidate;
    }
    catch (error) {
        setLabelOcrProgress(
            "Fehler",
            "error"
        );

        setLabelOcrStatus(
            error.message ||
            "Die OCR-Texterkennung ist fehlgeschlagen.",
            "error"
        );

        throw error;
    }
    finally {
        state.labelOcrBusy = false;
    }
}

async function terminateLabelOcrWorker() {
    await TeiletrackingOcrService
        .terminate();
}


function showCapturedLabelPreview(dataUrl, infoText) {
    state.capturedLabelImageDataUrl = dataUrl;
    state.capturedLabelCapturedAt =
        new Date().toISOString();
    elements.capturedLabelImage.src = dataUrl;
    elements.capturedLabelInfo.textContent = infoText;
    elements.capturedLabelPreview.classList.remove("hidden");
}

function removeCapturedLabel() {
    state.capturedLabelImageDataUrl = null;
    state.capturedLabelCapturedAt = null;
    elements.capturedLabelImage.removeAttribute("src");
    elements.capturedLabelInfo.textContent = "";
    elements.capturedLabelPreview.classList.add("hidden");
    clearLabelOcrResult();
}

function createCapturedLabelCanvas() {
    return TeiletrackingScannerService
        .captureFrame(
            elements.qrScannerVideo
        );
}

async function detectQrFromCapturedCanvas(
    canvas,
    context
) {
    return TeiletrackingScannerService
        .detectQr(
            canvas,
            context
        );
}


async function captureLabelPhoto() {
    if (state.labelOcrBusy) {
        setQrScannerStatus(
            "Die Aufnahme wird bereits verarbeitet. Bitte kurz warten.",
            "error"
        );

        return;
    }

    state.labelOcrBusy = true;
    elements.captureLabelButton.disabled = true;

    try {
        hideScanRetryHint();

        setQrScannerStatus(
            "Foto wurde aufgenommen. Kamera wird geschlossen und der QR-Code ausgewertet …"
        );

        const { canvas, context, dataUrl } =
            createCapturedLabelCanvas();

        closeQrScanner();

        let capturedQrText = "";
        try {
            capturedQrText = normalizeDescription(
                await detectQrFromCapturedCanvas(
                    canvas,
                    context
                )
            );
        }
        catch (error) {
            console.warn(
                "QR-Auswertung des Fotos fehlgeschlagen:",
                error
            );
        }

        const qrText =
            capturedQrText ||
            state.pendingQrText ||
            normalizeDescription(
                TeiletrackingScannerService
                    .getLiveQrText()
            );

        const diagnostics =
            TeiletrackingScannerService
                .getLastDiagnostics();

        if (
            diagnostics &&
            elements.scannerDiagnostics
        ) {
            const quality =
                diagnostics.quality || {};

            const warnings =
                Array.isArray(
                    quality.warnings
                )
                    ? quality.warnings
                    : [];

            elements.scannerDiagnostics.textContent =
                `Bild ${diagnostics.resolution || `${canvas.width}×${canvas.height}`} · ` +
                `Helligkeit ${Math.round(Number(quality.brightness || 0))} · ` +
                `Schärfe ${Math.round(Number(quality.edgeScore || 0))} · ` +
                `QR-Versuche ${Array.isArray(diagnostics.qrAttempts) ? diagnostics.qrAttempts.length : 0}` +
                (diagnostics.qrFoundBy
                    ? ` · erkannt mit ${diagnostics.qrFoundBy}`
                    : "") +
                (warnings.length > 0
                    ? ` · Hinweis: ${warnings.join(" ")}`
                    : "");
        }

        if (qrText) {
            try {
                populateQrFields(qrText);
                state.pendingQrText = qrText;
                registerLabelScanSuccess();
                setQrScanResult(
                    "Foto übernommen. PartNumber und CPID wurden aus dem QR-Code in die Felder geschrieben. Hardware folgt separat aus der Label-Beschriftung.",
                    "success"
                );
            }
            catch (error) {
                setQrScanResult(
                    `Foto übernommen, aber der QR-Code konnte nicht zugeordnet werden: ${error.message}`,
                    "error"
                );
            }
        }
        else {
            setQrScanResult(
                "Foto übernommen, aber kein QR-/DataMatrix-Code erkannt. Bitte erneut fotografieren oder die benötigten Werte manuell eintragen.",
                "error"
            );
        }

        showCapturedLabelPreview(
            dataUrl || canvas.toDataURL("image/jpeg", 0.92),
            "Diese Aufnahme wird nur lokal als Vorschau gehalten und nicht ins Repository übertragen."
        );

    }
    catch (error) {
        console.error(
            "Label-Aufnahme fehlgeschlagen:",
            error
        );

        registerLabelScanFailure(
            error.message ||
            "Die Aufnahme konnte nicht verarbeitet werden."
        );
    }
    finally {
        state.labelOcrBusy = false;
        elements.captureLabelButton.disabled = false;
    }
}


async function startQrScannerCamera() {
    stopQrScannerCamera();

    setQrScannerStatus(
        "Kamera wird vorbereitet …"
    );

    try {
        const scanner =
            await TeiletrackingScannerService
                .startCamera(
                    elements.qrScannerVideo
                );

        state.qrScannerRunning = true;

        setQrScannerStatus(
            `Kamera aktiv (${scanner.displayName}) · ${scanner.width}×${scanner.height} · Fokus: ${scanner.focusMode}. Richte den QR-/DataMatrix-Code mittig und scharf aus.`
        );

        if (elements.scannerDiagnostics) {
            elements.scannerDiagnostics.textContent =
                `Kamera: ${scanner.width}×${scanner.height} · QR-Engine: ${scanner.displayName}`;
        }
    }
    catch (error) {
        stopQrScannerCamera();

        setQrScannerStatus(
            TeiletrackingScannerService
                .getErrorMessage(error),
            "error"
        );
    }
}


async function openQrScanner() {
    state.pendingQrText = "";
    elements.captureLabelButton.hidden = false;
    elements.captureLabelButton.classList.remove("hidden");
    elements.captureLabelButton.textContent = "Foto aufnehmen & QR übernehmen";
    const scannerTitle = document.getElementById("qrScannerTitle");
    if (scannerTitle) {
        scannerTitle.textContent = "Gesamtes Label erfassen";
    }
    setQrScanResult("");
    resetLabelScanAttempts();

    elements.qrScannerOverlay.classList.remove(
        "hidden"
    );

    document.body.classList.add(
        "scanner-open"
    );

    await startQrScannerCamera();
    setQrScannerStatus(
        "QR-/DataMatrix-Code mittig und scharf ausrichten. Nach dem Foto wird die Kamera automatisch geschlossen."
    );
}

function showTrackingTransferMessage(message, type) {
    elements.trackingTransferMessage.classList.remove(
        "hidden",
        "success",
        "warning",
        "error"
    );

    elements.trackingTransferMessage.classList.add(type);
    elements.trackingTransferMessage.textContent = message;
}

function clearTrackingTransferMessage() {
    elements.trackingTransferMessage.classList.add("hidden");
    elements.trackingTransferMessage.classList.remove(
        "success",
        "warning",
        "error"
    );
    elements.trackingTransferMessage.textContent = "";
}

function getTrackingExportRecords() {
    return state.savedItems.map(record => ({
        PartNumber: normalizeText(record.PartNumber),
        SerialNumber: normalizeText(record.SerialNumber),
        LabelPartNumber: normalizeText(record.LabelPartNumber),
        QRPartNumber: normalizeText(record.QRPartNumber),
        LabelSerialNumber: normalizeText(record.LabelSerialNumber),
        QRSerialNumber: normalizeText(record.QRSerialNumber),
        Derivat: normalizeText(record.Derivat),
        IStufe: normalizeText(record.IStufe),
        ATS: normalizeText(record.ATS),
        YNummer: normalizeText(record.YNummer),
        PartStatuses:
            TeiletrackingFeatureService
                .normalizeStatusArray(
                    record.PartStatuses ||
                    record.Teilestatus
                ),
        Teilestatus:
            TeiletrackingFeatureService
                .normalizeStatusArray(
                    record.PartStatuses ||
                    record.Teilestatus
                )
                .join(";"),
        TransferBatchId:
            normalizeDescription(
                record.TransferBatchId
            ),
        TransferSourceRecordId:
            normalizeDescription(
                record.TransferSourceRecordId
            ),
        LabelHardware: normalizeText(record.LabelHardware),
        QRHardware: normalizeText(record.QRHardware),
        LabelSoftware: normalizeText(record.LabelSoftware),
        QRSoftware: normalizeText(record.QRSoftware),
        DeviceKey: normalizeText(record.DeviceKey),
        AssignmentKey: normalizeText(record.AssignmentKey),
        DuplicateStatus: normalizeText(record.DuplicateStatus || "NEW"),
        ValidationStatus: normalizeText(record.ValidationStatus || "OK"),
        DoppelDerivat: Boolean(record.DoppelDerivat),
        MismatchFields: Array.isArray(record.MismatchFields)
            ? [...record.MismatchFields]
            : [],
        SavedAt: record.SavedAt || null,
        CapturedAt:
            record.CapturedAt ||
            record.SavedAt ||
            null,
        SourceRecordId:
            normalizeDescription(
                record.SourceRecordId
            ),
        SourceDeviceId:
            normalizeDescription(
                record.SourceDeviceId
            ),
        SourceOrigin:
            normalizeDescription(
                record.SourceOrigin
            )
    }));
}

function getTimestampForFileName() {
    const now = new Date();

    const parts = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        "-",
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0")
    ];

    return parts.join("");
}

function downloadTextFile(
    fileName,
    content,
    mimeType
) {
    TeiletrackingDataService
        .downloadTextFile(
            fileName,
            content,
            mimeType
        );
}


async function ensureMigrationMetadata() {
    const deviceId =
        TeiletrackingDataService
            .getOrCreateDeviceId();

    let changed = false;

    for (const record of state.savedItems) {
        if (!record.SourceDeviceId) {
            record.SourceDeviceId =
                deviceId;
            changed = true;
        }

        if (!record.CapturedAt) {
            record.CapturedAt =
                record.SavedAt ||
                new Date().toISOString();
            changed = true;
        }

        if (!record.SourceRecordId) {
            record.SourceRecordId =
                TeiletrackingMigrationService
                    .createRecordId(
                        record.SourceDeviceId,
                        record.CapturedAt
                    );

            if (!record.SourceOrigin) {
                record.SourceOrigin =
                    "LEGACY_LOCAL";
            }

            changed = true;
        }
    }

    if (changed) {
        await saveTrackingData();
    }

    return deviceId;
}

async function exportMigrationPackage() {
    clearTrackingTransferMessage();

    if (state.savedItems.length === 0) {
        showTrackingTransferMessage(
            "Es sind keine lokalen Tracking-Datensätze für ein Migrationspaket vorhanden.",
            "warning"
        );
        return;
    }

    elements.exportMigrationPackageButton.disabled =
        true;

    try {
        await ensureMigrationMetadata();

        const result =
            await TeiletrackingMigrationService
                .exportPackage(
                    state.savedItems
                );

        showTrackingTransferMessage(
            `Migrationspaket erzeugt: ${result.recordCount} Datensätze · ${result.imageCount} Labelbilder · Batch ${result.batchId} · ${result.packageHash}`,
            "success"
        );
    }
    catch (error) {
        console.error(
            "Migrationspaket konnte nicht erzeugt werden:",
            error
        );

        showTrackingTransferMessage(
            `Migrationspaket fehlgeschlagen: ${error.message}`,
            "error"
        );
    }
    finally {
        elements.exportMigrationPackageButton.disabled =
            false;
    }
}

function exportTrackingJson() {
    clearTrackingTransferMessage();

    const records = getTrackingExportRecords();

    if (records.length === 0) {
        showTrackingTransferMessage(
            "Es sind keine lokalen Tracking-Datensätze für den Export vorhanden.",
            "warning"
        );
        return;
    }

    const payload = {
        format: "teiletracking.localTracking",
        version: 1,
        exportedAt: new Date().toISOString(),
        recordCount: records.length,
        records
    };

    const content = JSON.stringify(
        payload,
        null,
        2
    );

    downloadTextFile(
        `teiletracking-${getTimestampForFileName()}.json`,
        content,
        "application/json;charset=utf-8"
    );

    showTrackingTransferMessage(
        `${records.length} lokale Datensätze wurden als JSON exportiert.`,
        "success"
    );
}

function escapeCsvValue(value) {
    const text =
        value === null || value === undefined
            ? ""
            : String(value);

    return `"${text.replaceAll('"', '""')}"`;
}

function exportTrackingCsv() {
    clearTrackingTransferMessage();

    const records = getTrackingExportRecords();

    if (records.length === 0) {
        showTrackingTransferMessage(
            "Es sind keine lokalen Tracking-Datensätze für den Export vorhanden.",
            "warning"
        );
        return;
    }

    const columns = [
        "PartNumber",
        "SerialNumber",
        "LabelPartNumber",
        "QRPartNumber",
        "LabelSerialNumber",
        "QRSerialNumber",
        "Derivat",
        "IStufe",
        "ATS",
        "YNummer",
        "Teilestatus",
        "TransferBatchId",
        "TransferSourceRecordId",
        "LabelHardware",
        "QRHardware",
        "LabelSoftware",
        "QRSoftware",
        "DeviceKey",
        "AssignmentKey",
        "DuplicateStatus",
        "ValidationStatus",
        "DoppelDerivat",
        "MismatchFields",
        "SavedAt"
    ];

    const rows = [
        columns.map(escapeCsvValue).join(";")
    ];

    for (const record of records) {
        const row = columns.map(column => {
            if (column === "MismatchFields") {
                return escapeCsvValue(
                    Array.isArray(record.MismatchFields)
                        ? record.MismatchFields.join(",")
                        : ""
                );
            }

            if (column === "DoppelDerivat") {
                return escapeCsvValue(
                    record.DoppelDerivat ? "TRUE" : "FALSE"
                );
            }

            return escapeCsvValue(record[column]);
        });

        rows.push(row.join(";"));
    }

    const content =
        "\uFEFF" +
        rows.join("\r\n");

    downloadTextFile(
        `teiletracking-${getTimestampForFileName()}.csv`,
        content,
        "text/csv;charset=utf-8"
    );

    showTrackingTransferMessage(
        `${records.length} lokale Datensätze wurden als CSV exportiert.`,
        "success"
    );
}

function getImportRecordsFromPayload(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (
        payload &&
        typeof payload === "object" &&
        Array.isArray(payload.records)
    ) {
        return payload.records;
    }

    throw new Error(
        "Die JSON-Datei enthält kein unterstütztes Tracking-Format."
    );
}

function validateImportedRecord(record, index) {
    if (!record || typeof record !== "object") {
        throw new Error(
            `Datensatz ${index + 1} ist kein gültiges Objekt.`
        );
    }

    const partNumber = normalizeText(
        record.PartNumber || record.LabelPartNumber
    );

    const serialNumber = normalizeText(
        record.SerialNumber || record.LabelSerialNumber
    );

    const derivat = normalizeText(record.Derivat);
    const iStufe = normalizeText(record.IStufe);

    const missing = [];

    if (!partNumber) {
        missing.push("PartNumber");
    }

    if (!serialNumber) {
        missing.push("SerialNumber");
    }

    if (!derivat) {
        missing.push("Derivat");
    }

    if (!iStufe) {
        missing.push("IStufe");
    }

    if (missing.length > 0) {
        throw new Error(
            `Datensatz ${index + 1}: Pflichtfelder fehlen: ${missing.join(", ")}.`
        );
    }

    const normalized = normalizeStoredTrackingRecord({
        ...record,
        PartNumber: partNumber,
        SerialNumber: serialNumber,
        Derivat: derivat,
        IStufe: iStufe,
        DeviceKey: getDeviceKey(
            partNumber,
            serialNumber
        ),
        AssignmentKey: getAssignmentKey(
            partNumber,
            serialNumber,
            derivat,
            iStufe,
            record.ATS,
            record.YNummer
        ),
        LocalId: createLocalRecordId(),
        SavedAt:
            record.SavedAt ||
            new Date().toISOString()
    });

    return normalized;
}

async function importTrackingRecords(records) {
    const existingAssignmentKeys = new Set(
        getAllTrackingItems()
            .map(item => normalizeText(item.AssignmentKey))
            .filter(Boolean)
    );

    let imported = 0;
    let duplicates = 0;
    let invalid = 0;

    const errors = [];

    records.forEach((record, index) => {
        try {
            const normalized =
                validateImportedRecord(
                    record,
                    index
                );

            if (!normalized.SourceOrigin) {
                normalized.SourceOrigin =
                    "JSON_IMPORT";
            }

            const assignmentKey =
                normalizeText(
                    normalized.AssignmentKey
                );

            if (
                existingAssignmentKeys.has(
                    assignmentKey
                )
            ) {
                duplicates += 1;
                return;
            }

            const sameDeviceExists =
                getAllTrackingItems().some(
                    item =>
                        normalizeText(item.DeviceKey) ===
                        normalizeText(
                            normalized.DeviceKey
                        )
                ) ||
                state.savedItems.some(
                    item =>
                        normalizeText(item.DeviceKey) ===
                        normalizeText(
                            normalized.DeviceKey
                        )
                );

            if (
                normalized.ValidationStatus !==
                "LABEL_QR_MISMATCH"
            ) {
                normalized.DuplicateStatus =
                    sameDeviceExists
                        ? "DOUBLE_DERIVATIVE"
                        : "NEW";

                normalized.ValidationStatus =
                    sameDeviceExists
                        ? "DOUBLE_DERIVATIVE"
                        : "OK";
            }

            normalized.DoppelDerivat =
                sameDeviceExists;

            state.savedItems.push(normalized);
            existingAssignmentKeys.add(assignmentKey);
            imported += 1;
        }
        catch (error) {
            invalid += 1;

            if (errors.length < 5) {
                errors.push(error.message);
            }
        }
    });

    await saveTrackingData();
    refreshTrackingFilterOptions();
    renderSavedItems();
    updateDataStatus();

    return {
        imported,
        duplicates,
        invalid,
        errors
    };
}

async function importTrackingJsonFile(file) {
    clearTrackingTransferMessage();

    if (!file) {
        return;
    }

    try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const records =
            getImportRecordsFromPayload(payload);

        const result =
            await importTrackingRecords(
                records
            );

        const parts = [
            `${result.imported} importiert`,
            `${result.duplicates} Dubletten übersprungen`,
            `${result.invalid} ungültig`
        ];

        const type =
            result.invalid > 0
                ? "warning"
                : "success";

        let message =
            `Import abgeschlossen: ${parts.join(" · ")}.`;

        if (result.errors.length > 0) {
            message +=
                ` Hinweise: ${result.errors.join(" | ")}`;
        }

        showTrackingTransferMessage(
            message,
            type
        );
    }
    catch (error) {
        showTrackingTransferMessage(
            `Import fehlgeschlagen: ${error.message}`,
            "error"
        );
    }
    finally {
        elements.trackingImportFile.value = "";
    }
}

function openTrackingImportDialog() {
    clearTrackingTransferMessage();
    elements.trackingImportFile.click();
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
    const search =
        normalizeText(
            elements.trackingSearch.value
        );

    const status =
        normalizeText(
            elements.trackingStatusFilter.value
        );

    const derivat =
        normalizeText(
            elements.trackingDerivatFilter.value
        );

    const iStufe =
        normalizeText(
            elements.trackingIStufeFilter.value
        );

    const ats =
        normalizeText(
            elements.trackingAtsFilter?.value
        );

    const yNummer =
        normalizeText(
            elements.trackingYNummerFilter?.value
        );

    const partStatus =
        normalizeText(
            elements.trackingPartStatusFilter?.value
        );

    return getTrackingDisplayItems()
        .filter(record => {
            const recordStatuses =
                TeiletrackingFeatureService
                    .normalizeStatusArray(
                        record.PartStatuses ||
                        record.Teilestatus
                    );

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
                record.ATS,
                record.YNummer,
                recordStatuses.join(" "),
                record.ValidationStatus
            ]
                .map(normalizeText)
                .join(" ");

            if (
                search &&
                !haystack.includes(search)
            ) {
                return false;
            }

            if (
                status &&
                getRecordValidationStatus(
                    record
                ) !== status
            ) {
                return false;
            }

            if (
                derivat &&
                normalizeText(
                    record.Derivat
                ) !== derivat
            ) {
                return false;
            }

            if (
                iStufe &&
                normalizeText(
                    record.IStufe
                ) !== iStufe
            ) {
                return false;
            }

            if (
                ats &&
                normalizeText(
                    record.ATS
                ) !== ats
            ) {
                return false;
            }

            if (
                yNummer &&
                normalizeText(
                    record.YNummer
                ) !== yNummer
            ) {
                return false;
            }

            if (
                partStatus &&
                !recordStatuses.includes(
                    partStatus
                )
            ) {
                return false;
            }

            return true;
        });
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
    TeiletrackingFeatureService
        .refreshTrackingFilters(
            displayItems
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
            record.IStufe,
            record.ATS,
            record.YNummer
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
        createDetailField("CPID", serialNumber),
        createDetailField("Derivat", record.Derivat),
        createDetailField("I-Stufe", record.IStufe),
        createDetailField("ATS", record.ATS),
        createDetailField("Y-Nummer", record.YNummer),
        createDetailField(
            "Teile-Status",
            TeiletrackingFeatureService
                .normalizeStatusArray(
                    record.PartStatuses ||
                    record.Teilestatus
                )
                .join(", "),
            false
        ),
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
        ),
        createDetailField(
            "Erfasst am",
            isLocal && record.CapturedAt
                ? new Date(record.CapturedAt).toLocaleString("de-DE")
                : "–",
            false
        ),
        createDetailField(
            "SourceRecordId",
            record.SourceRecordId || "–"
        ),
        createDetailField(
            "SourceDeviceId",
            record.SourceDeviceId || "–"
        ),
        createDetailField(
            "SourceOrigin",
            record.SourceOrigin || "–",
            false
        ),
        createDetailField(
            "TransferBatchId",
            record.TransferBatchId || "–"
        ),
        createDetailField(
            "TransferSourceRecordId",
            record.TransferSourceRecordId || "–"
        )
    );

    sourceSection.appendChild(sourceGrid);

    elements.trackingDetailContent.append(
        assignmentSection,
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
            record.IStufe,
            record.ATS,
            record.YNummer
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
        createTrackingDetail("I-Stufe", record.IStufe),
        createTrackingDetail("ATS", record.ATS),
        createTrackingDetail("Y-Nummer", record.YNummer)
    );

    const partStatusChips =
        TeiletrackingFeatureService
            .createStatusChips(
                record.PartStatuses ||
                record.Teilestatus
            );

    if (partStatusChips.childNodes.length > 0) {
        details.appendChild(
            partStatusChips
        );
    }

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
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "mini-button";
        editButton.textContent = "Bearbeiten";

        editButton.addEventListener(
            "click",
            () => {
                editLocalTrackingRecord(record.LocalId);
            }
        );

        actions.appendChild(editButton);

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

function ensureSelectValue(select, value) {
    const normalized = normalizeText(value);
    if (!select || !normalized) return;
    if (![...select.options].some(option => normalizeText(option.value) === normalized)) {
        const option = document.createElement("option");
        option.value = normalized;
        option.textContent = `${normalized} (gespeichert)`;
        select.appendChild(option);
    }
    select.value = [...select.options]
        .find(option => normalizeText(option.value) === normalized)?.value || "";
}

function editLocalTrackingRecord(localId) {
    const record = state.savedItems.find(item => item.LocalId === localId);
    if (!record) return;

    state.editingLocalId = localId;
    elements.qrPartNumberField.value = normalizeText(record.PartNumber);
    elements.qrCpidField.value = normalizeText(record.SerialNumber);
    elements.qrHardwareField.value = normalizeText(record.LabelHardware || record.QRHardware);
    syncQrTextFromFields();

    ensureSelectValue(elements.derivat, record.Derivat);
    ensureSelectValue(elements.iStufe, record.IStufe);
    ensureSelectValue(elements.ats, record.ATS);
    ensureSelectValue(elements.yNummer, record.YNummer);
    TeiletrackingFeatureService.setSelectedStatuses(record.PartStatuses || record.Teilestatus);

    elements.saveButton.textContent = "Änderungen speichern";
    closeTrackingDetail();
    checkCurrentInput();
    elements.qrPartNumberField.scrollIntoView({ behavior: "smooth", block: "center" });
    elements.qrPartNumberField.focus();
    setQrScanResult("Bearbeitungsmodus: Werte ändern, prüfen und anschließend „Änderungen speichern“ wählen.", "success");
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

        TeiletrackingFeatureService
            .notifyTrackingChanged();

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

    TeiletrackingFeatureService
        .notifyTrackingChanged();
}

async function deleteLocalTrackingRecord(localId) {
    const before = state.savedItems.length;

    const deletedRecord =
        state.savedItems.find(
            item =>
                item.LocalId === localId
        );

    state.savedItems =
        state.savedItems.filter(
            item =>
                item.LocalId !== localId
        );

    if (state.savedItems.length === before) {
        return;
    }

    await saveTrackingData();

    if (
        deletedRecord &&
        deletedRecord.SourceRecordId
    ) {
        try {
            await TeiletrackingDataService
                .deleteLabelImage(
                    deletedRecord.SourceRecordId
                );
        }
        catch (error) {
            console.warn(
                "Labelbild konnte beim Löschen nicht entfernt werden:",
                error
            );
        }
    }

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

    if (elements.trackingAtsFilter) {
        elements.trackingAtsFilter.value = "";
    }

    if (elements.trackingYNummerFilter) {
        elements.trackingYNummerFilter.value = "";
    }

    if (elements.trackingPartStatusFilter) {
        elements.trackingPartStatusFilter.value = "";
    }

    renderSavedItems();
}

function checkCurrentInput() {
    try {
        const qr =
            parseTrackingString(
                elements.qrInput.value,
                {
                    allowUnknown: true
                }
            );

        const label = {
            ...qr
        };

        elements.labelInput.value =
            elements.qrInput.value;

        const derivat =
            normalizeText(
                elements.derivat.value
            );

        const iStufe =
            normalizeText(
                elements.iStufe.value
            );

        const ats =
            TeiletrackingFeatureService
                .getSelectedAts();

        const yNummer =
            TeiletrackingFeatureService
                .getSelectedYNumber();

        const partStatuses =
            TeiletrackingFeatureService
                .getSelectedStatuses();

        validateRequiredFields(
            label,
            qr,
            derivat,
            iStufe
        );

        const record =
            buildRecord(
                label,
                qr,
                derivat,
                iStufe,
                ats,
                yNummer,
                partStatuses
            );

        state.currentRecord =
            record;

        renderRecord(record);
    }
    catch (error) {
        renderError(error);
    }
}

async function saveCurrentRecord() {
    if (!state.currentRecord) {
        return;
    }

    if (
        !state.editingLocalId &&
        state.currentRecord.DuplicateStatus ===
        "DUPLICATE"
    ) {
        return;
    }

    if (state.editingLocalId) {
        const index = state.savedItems.findIndex(item => item.LocalId === state.editingLocalId);
        if (index < 0) return;
        const original = state.savedItems[index];
        state.savedItems[index] = normalizeStoredTrackingRecord({
            ...original,
            ...state.currentRecord,
            MismatchFields: [...state.currentRecord.MismatchFields],
            LocalId: original.LocalId,
            SourceRecordId: original.SourceRecordId,
            SourceDeviceId: original.SourceDeviceId,
            SavedAt: original.SavedAt,
            UpdatedAt: new Date().toISOString()
        });
        state.editingLocalId = null;
        elements.saveButton.textContent = "Lokal speichern";
        await saveTrackingData();
        refreshTrackingFilterOptions();
        renderSavedItems();
        updateDataStatus();
        resetForm();
        showTrackingTransferMessage("Datensatz wurde aktualisiert.", "success");
        return;
    }

    const sourceDeviceId =
        TeiletrackingDataService
            .getOrCreateDeviceId();

    const capturedAt =
        state.capturedLabelCapturedAt ||
        new Date().toISOString();

    const sourceRecordId =
        TeiletrackingMigrationService
            .createRecordId(
                sourceDeviceId,
                capturedAt
            );

    const savedRecord =
        normalizeStoredTrackingRecord({
            ...state.currentRecord,
            MismatchFields: [
                ...state.currentRecord.MismatchFields
            ],
            SavedAt:
                new Date()
                    .toISOString(),
            CapturedAt:
                capturedAt,
            SourceRecordId:
                sourceRecordId,
            SourceDeviceId:
                sourceDeviceId,
            SourceOrigin:
                state.capturedLabelImageDataUrl
                    ? "CAMERA_CAPTURE"
                    : "MANUAL_ENTRY",
            LocalId:
                createLocalRecordId()
        });

    state.savedItems.push(
        savedRecord
    );

    await saveTrackingData();

    refreshTrackingFilterOptions();
    renderSavedItems();
    updateDataStatus();

    checkCurrentInput();
}

function resetForm() {
    state.editingLocalId = null;
    elements.saveButton.textContent = "Lokal speichern";
    elements.derivat.value = "";
    elements.iStufe.value = "";
    elements.labelInput.value = "";
    elements.qrInput.value = "";
    elements.qrPartNumberField.value = "";
    elements.qrCpidField.value = "";
    elements.qrHardwareField.value = "";

    TeiletrackingFeatureService
        .resetAssignmentFields();

    setQrScanResult("");
    removeCapturedLabel();

    if (elements.scannerDiagnostics) {
        elements.scannerDiagnostics.textContent = "";
    }

    elements.resultCard
        .classList.add("hidden");
    elements.saveButton.disabled =
        true;

    clearComparison();

    state.currentRecord = null;
}

async function loadData() {
    try {
        await TeiletrackingDataService
            .initialize(
                "./data-config.json"
            );

        await loadOcrConfig();

        const bootstrap =
            await TeiletrackingDataService
                .loadBootstrapData();

        state.baseMasterData =
            bootstrap.baseMasterData;

        state.localMasterData =
            normalizeLocalMasterData(
                bootstrap.localMasterData
            );

        state.savedItems =
            (
                Array.isArray(
                    bootstrap.trackingRecords
                )
                    ? bootstrap.trackingRecords
                    : []
            ).map(
                normalizeStoredTrackingRecord
            );

        state.initialTrackingData =
            Array.isArray(
                bootstrap.baseTrackingData
            )
                ? bootstrap.baseTrackingData
                : [];

        rebuildMasterData();

        await TeiletrackingFeatureService
            .initialize({
                state,
                getTrackingDisplayItems,
                saveTrackingData,
                normalizeStoredTrackingRecord,
                getAssignmentKey,
                renderSavedItems,
                refreshTrackingFilterOptions,
                updateDataStatus,
                dataService:
                    TeiletrackingDataService,
                migrationService:
                    TeiletrackingMigrationService
            });

        refreshMasterDataUi();
        refreshTrackingFilterOptions();
        renderSavedItems();

        const deviceId =
            TeiletrackingDataService
                .getOrCreateDeviceId();

        const dataConfig =
            TeiletrackingDataService
                .getConfiguration();

        elements.migrationDeviceInfo.textContent =
            `Gerät: ${deviceId} · App: ${dataConfig.Migration.AppVersion} · Schema: ${dataConfig.Migration.SchemaVersion}`;

        elements.dataStatus.classList.remove(
            "error"
        );
    }
    catch (error) {
        elements.dataStatus.textContent =
            error.message;

        elements.dataStatus.classList.add(
            "error"
        );

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

elements.trackingAtsFilter.addEventListener(
    "change",
    renderSavedItems
);

elements.trackingYNummerFilter.addEventListener(
    "change",
    renderSavedItems
);

elements.trackingPartStatusFilter.addEventListener(
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

elements.exportMigrationPackageButton.addEventListener(
    "click",
    exportMigrationPackage
);

elements.exportTrackingJsonButton.addEventListener(
    "click",
    exportTrackingJson
);

elements.exportTrackingCsvButton.addEventListener(
    "click",
    exportTrackingCsv
);

elements.importTrackingJsonButton.addEventListener(
    "click",
    openTrackingImportDialog
);

elements.trackingImportFile.addEventListener(
    "change",
    event => {
        const [file] = event.target.files || [];

        if (file) {
            importTrackingJsonFile(file);
        }
    }
);

elements.openQrScannerButton.addEventListener(
    "click",
    openQrScanner
);

elements.closeQrScannerButton.addEventListener(
    "click",
    closeQrScanner
);

elements.cancelQrScannerButton.addEventListener(
    "click",
    closeQrScanner
);

elements.retryQrScannerButton.addEventListener(
    "click",
    startQrScannerCamera
);

elements.captureLabelButton.addEventListener(
    "click",
    captureLabelPhoto
);

document.addEventListener(
    "teiletracking:qr-detected",
    event => {
        const qrText =
            String(
                event.detail &&
                event.detail.text ||
                ""
            ).trim();

        if (!qrText) {
            return;
        }

        try {
            state.pendingQrText = qrText;
        }
        catch (error) {
            setQrScanResult(error.message, "error");
            return;
        }
        setQrScanResult(
            "QR-/DataMatrix-Code erkannt. Jetzt das Foto aufnehmen; danach werden die Werte übernommen.",
            "success"
        );
    }
);

elements.manualAddAfterScanButton.addEventListener(
    "click",
    openManualEntryAfterScan
);

elements.removeCapturedLabelButton.addEventListener(
    "click",
    removeCapturedLabel
);

elements.qrScannerOverlay.addEventListener(
    "click",
    event => {
        if (
            event.target ===
            elements.qrScannerOverlay
        ) {
            closeQrScanner();
        }
    }
);

document.addEventListener(
    "keydown",
    event => {
        if (
            event.key === "Escape" &&
            !elements.qrScannerOverlay.classList.contains(
                "hidden"
            )
        ) {
            closeQrScanner();
        }
    }
);

document.addEventListener(
    "visibilitychange",
    () => {
        if (
            document.hidden &&
            state.qrScannerRunning
        ) {
            closeQrScanner();
        }
    }
);

elements.applyOcrValuesButton.addEventListener(
    "click",
    applyOcrValuesAndCompare
);

elements.exportOcrInsightButton.addEventListener(
    "click",
    exportAnonymizedOcrInsights
);

for (
    const ocrInput of [
        elements.labelOcrPartNumber,
        elements.labelOcrSerialNumber,
        elements.labelOcrHardware,
        elements.labelOcrSoftware
    ]
) {
    ocrInput.addEventListener(
        "input",
        updateLabelOcrComparisonPreview
    );
}

elements.qrInput.addEventListener(
    "input",
    () => {
        elements.labelInput.value =
            elements.qrInput.value;

        if (
            !elements.labelOcrPanel.classList.contains(
                "hidden"
            )
        ) {
            updateLabelOcrComparisonPreview();
        }
    }
);

for (const qrField of [
    elements.qrPartNumberField,
    elements.qrCpidField,
    elements.qrHardwareField
]) {
    qrField.addEventListener("input", syncQrTextFromFields);
}

window.addEventListener(
    "beforeunload",
    () => {
        stopQrScannerCamera();
        terminateLabelOcrWorker();
    }
);

renderSavedItems();
loadData();

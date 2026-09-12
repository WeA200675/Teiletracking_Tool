"use strict";


const MASTER_DATA_STORAGE_KEY =
    "teiletracking.masterData.v2";

const LEGACY_MASTER_DATA_STORAGE_KEY =
    "teiletracking.masterData.v1";


const state = {
    masterData: null,

    baseMasterData: null,

    localMasterData: {
        Derivate: [],
        IStufen: [],

        AktivOverrides: {
            Derivate: {},
            IStufen: {}
        }
    },

    initialTrackingData: [],

    savedItems: [],

    currentRecord: null
};


const elements = {
    dataStatus:
        document.getElementById(
            "dataStatus"
        ),

    derivat:
        document.getElementById(
            "derivat"
        ),

    iStufe:
        document.getElementById(
            "iStufe"
        ),

    newDerivatCode:
        document.getElementById(
            "newDerivatCode"
        ),

    newDerivatDescription:
        document.getElementById(
            "newDerivatDescription"
        ),

    addDerivatButton:
        document.getElementById(
            "addDerivatButton"
        ),

    newIStufeCode:
        document.getElementById(
            "newIStufeCode"
        ),

    newIStufeDescription:
        document.getElementById(
            "newIStufeDescription"
        ),

    addIStufeButton:
        document.getElementById(
            "addIStufeButton"
        ),

    masterDataMessage:
        document.getElementById(
            "masterDataMessage"
        ),

    derivatCount:
        document.getElementById(
            "derivatCount"
        ),

    iStufeCount:
        document.getElementById(
            "iStufeCount"
        ),

    localMasterDataCount:
        document.getElementById(
            "localMasterDataCount"
        ),

    derivateList:
        document.getElementById(
            "derivateList"
        ),

    iStufenList:
        document.getElementById(
            "iStufenList"
        ),

    labelInput:
        document.getElementById(
            "labelInput"
        ),

    qrInput:
        document.getElementById(
            "qrInput"
        ),

    checkButton:
        document.getElementById(
            "checkButton"
        ),

    saveButton:
        document.getElementById(
            "saveButton"
        ),

    resetButton:
        document.getElementById(
            "resetButton"
        ),

    resultCard:
        document.getElementById(
            "resultCard"
        ),

    resultTitle:
        document.getElementById(
            "resultTitle"
        ),

    resultMessage:
        document.getElementById(
            "resultMessage"
        ),

    statusBadge:
        document.getElementById(
            "statusBadge"
        ),

    comparisonSummary:
        document.getElementById(
            "comparisonSummary"
        ),

    comparisonPartNumber:
        document.getElementById(
            "comparisonPartNumber"
        ),

    comparisonSerialNumber:
        document.getElementById(
            "comparisonSerialNumber"
        ),

    comparisonHardware:
        document.getElementById(
            "comparisonHardware"
        ),

    comparisonSoftware:
        document.getElementById(
            "comparisonSoftware"
        ),

    labelPartNumber:
        document.getElementById(
            "labelPartNumber"
        ),

    qrPartNumber:
        document.getElementById(
            "qrPartNumber"
        ),

    partNumberStatus:
        document.getElementById(
            "partNumberStatus"
        ),

    labelSerialNumber:
        document.getElementById(
            "labelSerialNumber"
        ),

    qrSerialNumber:
        document.getElementById(
            "qrSerialNumber"
        ),

    serialNumberStatus:
        document.getElementById(
            "serialNumberStatus"
        ),

    labelHardware:
        document.getElementById(
            "labelHardware"
        ),

    qrHardware:
        document.getElementById(
            "qrHardware"
        ),

    hardwareStatus:
        document.getElementById(
            "hardwareStatus"
        ),

    labelSoftware:
        document.getElementById(
            "labelSoftware"
        ),

    qrSoftware:
        document.getElementById(
            "qrSoftware"
        ),

    softwareStatus:
        document.getElementById(
            "softwareStatus"
        ),

    resultPartNumber:
        document.getElementById(
            "resultPartNumber"
        ),

    resultSerialNumber:
        document.getElementById(
            "resultSerialNumber"
        ),

    resultDerivat:
        document.getElementById(
            "resultDerivat"
        ),

    resultIStufe:
        document.getElementById(
            "resultIStufe"
        ),

    resultDeviceKey:
        document.getElementById(
            "resultDeviceKey"
        ),

    resultAssignmentKey:
        document.getElementById(
            "resultAssignmentKey"
        ),

    savedItems:
        document.getElementById(
            "savedItems"
        ),

    savedCount:
        document.getElementById(
            "savedCount"
        )
};


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

    return String(value)
        .trim();
}


function displayValue(value) {

    const normalized =
        normalizeText(
            value
        );

    if (!normalized) {
        return "–";
    }

    return normalized;
}


function parseTrackingString(
    inputString
) {

    if (
        !inputString ||
        !inputString.trim()
    ) {
        throw new Error(
            "Tracking-String ist leer"
        );
    }


    const allowedKeys =
        new Set([
            "PN",
            "SN",
            "HW",
            "SW"
        ]);


    const data = {};

    const segments =
        inputString.split(
            ";"
        );


    for (
        const rawSegment
        of segments
    ) {

        const segment =
            rawSegment.trim();

        if (!segment) {
            continue;
        }


        if (
            !segment.includes(
                "="
            )
        ) {
            throw new Error(
                `Ungültiges Segment ohne '=': '${segment}'`
            );
        }


        const separatorIndex =
            segment.indexOf(
                "="
            );


        const key =
            normalizeText(
                segment.slice(
                    0,
                    separatorIndex
                )
            );


        const value =
            normalizeText(
                segment.slice(
                    separatorIndex + 1
                )
            );


        if (!key) {
            throw new Error(
                "Tracking-Schlüssel darf nicht leer sein"
            );
        }


        if (
            !allowedKeys.has(
                key
            )
        ) {
            throw new Error(
                `Unbekannter Tracking-Schlüssel: '${key}'`
            );
        }


        if (
            Object.prototype
                .hasOwnProperty
                .call(
                    data,
                    key
                )
        ) {
            throw new Error(
                `Tracking-Schlüssel '${key}' ist mehrfach vorhanden`
            );
        }


        data[key] =
            value;
    }


    if (
        Object.keys(
            data
        ).length === 0
    ) {
        throw new Error(
            "Tracking-String enthält keine verwertbaren Daten"
        );
    }


    return {
        partNumber:
            normalizeText(
                data.PN
            ),

        serialNumber:
            normalizeText(
                data.SN
            ),

        hardware:
            normalizeText(
                data.HW
            ),

        software:
            normalizeText(
                data.SW
            )
    };
}


function getDeviceKey(
    partNumber,
    serialNumber
) {

    return [
        normalizeText(
            partNumber
        ),

        normalizeText(
            serialNumber
        )
    ].join(
        "|"
    );
}


function getAssignmentKey(
    partNumber,
    serialNumber,
    derivat,
    iStufe
) {

    return [
        normalizeText(
            partNumber
        ),

        normalizeText(
            serialNumber
        ),

        normalizeText(
            derivat
        ),

        normalizeText(
            iStufe
        )
    ].join(
        "|"
    );
}


function getMismatchFields(
    label,
    qr
) {

    const mismatchFields = [];


    if (
        normalizeText(
            label.partNumber
        ) !==
        normalizeText(
            qr.partNumber
        )
    ) {
        mismatchFields.push(
            "PartNumber"
        );
    }


    if (
        normalizeText(
            label.serialNumber
        ) !==
        normalizeText(
            qr.serialNumber
        )
    ) {
        mismatchFields.push(
            "SerialNumber"
        );
    }


    if (
        normalizeText(
            label.hardware
        ) !==
        normalizeText(
            qr.hardware
        )
    ) {
        mismatchFields.push(
            "Hardware"
        );
    }


    if (
        normalizeText(
            label.software
        ) !==
        normalizeText(
            qr.software
        )
    ) {
        mismatchFields.push(
            "Software"
        );
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


    if (
        !label.partNumber
    ) {
        errors.push(
            "PartNumber fehlt"
        );
    }


    if (
        !label.serialNumber
    ) {
        errors.push(
            "SerialNumber fehlt"
        );
    }


    if (
        !qr.partNumber
    ) {
        errors.push(
            "QR PartNumber fehlt"
        );
    }


    if (
        !qr.serialNumber
    ) {
        errors.push(
            "QR SerialNumber fehlt"
        );
    }


    if (!derivat) {
        errors.push(
            "Derivat fehlt"
        );
    }


    if (!iStufe) {
        errors.push(
            "I-Stufe fehlt"
        );
    }


    if (
        errors.length > 0
    ) {
        throw new Error(
            errors.join(
                "; "
            )
        );
    }
}


function getAllTrackingItems() {

    return [
        ...state.initialTrackingData,
        ...state.savedItems
    ];
}


function getDuplicateStatus(
    deviceKey,
    assignmentKey
) {

    const items =
        getAllTrackingItems();


    const assignmentExists =
        items.some(
            item =>
                normalizeText(
                    item.AssignmentKey
                ) ===
                normalizeText(
                    assignmentKey
                )
        );


    if (
        assignmentExists
    ) {
        return "DUPLICATE";
    }


    const deviceExists =
        items.some(
            item =>
                normalizeText(
                    item.DeviceKey
                ) ===
                normalizeText(
                    deviceKey
                )
        );


    if (
        deviceExists
    ) {
        return "DOUBLE_DERIVATIVE";
    }


    return "NEW";
}


function buildRecord(
    label,
    qr,
    derivat,
    iStufe
) {

    const normalizedDerivat =
        normalizeText(
            derivat
        );


    const normalizedIStufe =
        normalizeText(
            iStufe
        );


    const labelPartNumber =
        normalizeText(
            label.partNumber
        );


    const qrPartNumber =
        normalizeText(
            qr.partNumber
        );


    const labelSerialNumber =
        normalizeText(
            label.serialNumber
        );


    const qrSerialNumber =
        normalizeText(
            qr.serialNumber
        );


    const labelHardware =
        normalizeText(
            label.hardware
        );


    const qrHardware =
        normalizeText(
            qr.hardware
        );


    const labelSoftware =
        normalizeText(
            label.software
        );


    const qrSoftware =
        normalizeText(
            qr.software
        );


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
            normalizedIStufe
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


    let validationStatus =
        "OK";


    if (
        mismatchFields.length > 0
    ) {
        validationStatus =
            "LABEL_QR_MISMATCH";
    }
    else if (
        duplicateStatus ===
        "DUPLICATE"
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
        PartNumber:
            labelPartNumber,

        SerialNumber:
            labelSerialNumber,

        LabelPartNumber:
            labelPartNumber,

        QRPartNumber:
            qrPartNumber,

        LabelSerialNumber:
            labelSerialNumber,

        QRSerialNumber:
            qrSerialNumber,

        Derivat:
            normalizedDerivat,

        IStufe:
            normalizedIStufe,

        LabelHardware:
            labelHardware,

        QRHardware:
            qrHardware,

        LabelSoftware:
            labelSoftware,

        QRSoftware:
            qrSoftware,

        DeviceKey:
            deviceKey,

        AssignmentKey:
            assignmentKey,

        DuplicateStatus:
            duplicateStatus,

        ValidationStatus:
            validationStatus,

        DoppelDerivat:
            duplicateStatus ===
            "DOUBLE_DERIVATIVE",

        MismatchFields:
            mismatchFields
    };
}


function getStatusMeta(
    status
) {

    switch (status) {

        case "OK":

            return {
                cssClass:
                    "ok",

                cardClass:
                    "status-ok",

                title:
                    "Teil ist plausibel",

                message:
                    "Label und QR stimmen überein. Die Zuordnung ist neu."
            };


        case "DOUBLE_DERIVATIVE":

            return {
                cssClass:
                    "double",

                cardClass:
                    "status-double",

                title:
                    "Doppelderivat erkannt",

                message:
                    "Das physische Teil ist bereits bekannt, wird aber einer anderen Zuordnung hinzugefügt."
            };


        case "LABEL_QR_MISMATCH":

            return {
                cssClass:
                    "mismatch",

                cardClass:
                    "status-mismatch",

                title:
                    "Label / QR Abweichung",

                message:
                    "Mindestens ein Wert auf Label und QR stimmt nicht überein."
            };


        case "DUPLICATE":

            return {
                cssClass:
                    "duplicate",

                cardClass:
                    "status-duplicate",

                title:
                    "Datensatz bereits vorhanden",

                message:
                    "Diese Kombination aus Teil, Derivat und I-Stufe existiert bereits."
            };


        default:

            return {
                cssClass:
                    "error",

                cardClass:
                    "status-error",

                title:
                    "Fehler",

                message:
                    "Die Eingabe konnte nicht verarbeitet werden."
            };
    }
}


function clearResultClasses() {

    elements.resultCard
        .classList.remove(
            "status-ok",
            "status-double",
            "status-mismatch",
            "status-duplicate",
            "status-error"
        );


    elements.statusBadge
        .classList.remove(
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

    const normalizedLabel =
        normalizeText(
            labelValue
        );


    const normalizedQR =
        normalizeText(
            qrValue
        );


    const matches =
        normalizedLabel ===
        normalizedQR;


    rowElement
        .classList.remove(
            "match",
            "mismatch"
        );


    if (matches) {

        rowElement
            .classList.add(
                "match"
            );

        statusElement.textContent =
            "✓ Gleich";
    }
    else {

        rowElement
            .classList.add(
                "mismatch"
            );

        statusElement.textContent =
            "⚠ Abweichung";
    }


    labelElement.textContent =
        displayValue(
            normalizedLabel
        );


    qrElement.textContent =
        displayValue(
            normalizedQR
        );
}


function renderComparison(
    record
) {

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


    if (
        record.MismatchFields.length === 0
    ) {
        elements
            .comparisonSummary
            .textContent =
            "Alle Werte stimmen überein";
    }
    else {

        elements
            .comparisonSummary
            .textContent =
            `${record.MismatchFields.length} ` +
            (
                record.MismatchFields.length === 1
                    ? "Abweichung"
                    : "Abweichungen"
            );
    }
}


function clearComparison() {

    const rows = [
        elements.comparisonPartNumber,
        elements.comparisonSerialNumber,
        elements.comparisonHardware,
        elements.comparisonSoftware
    ];


    for (
        const row
        of rows
    ) {

        row.classList.remove(
            "match",
            "mismatch"
        );
    }


    elements.labelPartNumber.textContent =
        "–";

    elements.qrPartNumber.textContent =
        "–";

    elements.partNumberStatus.textContent =
        "–";

    elements.labelSerialNumber.textContent =
        "–";

    elements.qrSerialNumber.textContent =
        "–";

    elements.serialNumberStatus.textContent =
        "–";

    elements.labelHardware.textContent =
        "–";

    elements.qrHardware.textContent =
        "–";

    elements.hardwareStatus.textContent =
        "–";

    elements.labelSoftware.textContent =
        "–";

    elements.qrSoftware.textContent =
        "–";

    elements.softwareStatus.textContent =
        "–";

    elements.comparisonSummary.textContent =
        "–";
}


function renderRecord(
    record
) {

    const meta =
        getStatusMeta(
            record.ValidationStatus
        );


    clearResultClasses();


    elements.resultCard
        .classList.remove(
            "hidden"
        );


    elements.resultCard
        .classList.add(
            meta.cardClass
        );


    elements.statusBadge
        .classList.add(
            meta.cssClass
        );


    elements.resultTitle.textContent =
        meta.title;


    if (
        record.ValidationStatus ===
            "LABEL_QR_MISMATCH" &&
        record.MismatchFields.length > 0
    ) {

        elements.resultMessage.textContent =
            `${meta.message} Abweichend: ` +
            `${record.MismatchFields.join(", ")}.`;
    }
    else {

        elements.resultMessage.textContent =
            meta.message;
    }


    elements.statusBadge.textContent =
        record.ValidationStatus;


    renderComparison(
        record
    );


    elements.resultPartNumber.textContent =
        record.PartNumber;

    elements.resultSerialNumber.textContent =
        record.SerialNumber;

    elements.resultDerivat.textContent =
        record.Derivat;

    elements.resultIStufe.textContent =
        record.IStufe;

    elements.resultDeviceKey.textContent =
        record.DeviceKey;

    elements.resultAssignmentKey.textContent =
        record.AssignmentKey;


    elements.saveButton.disabled =
        record.DuplicateStatus ===
        "DUPLICATE";
}


function renderError(
    error
) {

    clearResultClasses();

    clearComparison();


    state.currentRecord =
        null;


    elements.saveButton.disabled =
        true;


    elements.resultCard
        .classList.remove(
            "hidden"
        );


    elements.resultCard
        .classList.add(
            "status-error"
        );


    elements.statusBadge
        .classList.add(
            "error"
        );


    elements.statusBadge.textContent =
        "FEHLER";


    elements.resultTitle.textContent =
        "Eingabe ungültig";


    elements.resultMessage.textContent =
        error.message;


    elements.resultPartNumber.textContent =
        "–";

    elements.resultSerialNumber.textContent =
        "–";

    elements.resultDerivat.textContent =
        "–";

    elements.resultIStufe.textContent =
        "–";

    elements.resultDeviceKey.textContent =
        "–";

    elements.resultAssignmentKey.textContent =
        "–";
}


function renderSavedItems() {

    elements.savedCount.textContent =
        state.savedItems.length;


    if (
        state.savedItems.length === 0
    ) {

        elements.savedItems.className =
            "saved-items empty-state";


        elements.savedItems.textContent =
            "Noch keine Datensätze lokal gespeichert.";


        return;
    }


    elements.savedItems.className =
        "saved-items";


    elements.savedItems.innerHTML =
        "";


    [...state.savedItems]
        .reverse()
        .forEach(
            record => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "saved-item";


                const main =
                    document.createElement(
                        "div"
                    );


                main.className =
                    "saved-item-main";


                const title =
                    document.createElement(
                        "div"
                    );


                title.className =
                    "saved-item-title";


                title.textContent =
                    record.AssignmentKey;


                const subtitle =
                    document.createElement(
                        "p"
                    );


                subtitle.className =
                    "saved-item-subtitle";


                let subtitleText =
                    `DeviceKey: ${record.DeviceKey}`;


                if (
                    record.ValidationStatus ===
                        "LABEL_QR_MISMATCH" &&
                    record.MismatchFields.length > 0
                ) {

                    subtitleText +=
                        " · Abweichend: " +
                        record.MismatchFields.join(
                            ", "
                        );
                }


                subtitle.textContent =
                    subtitleText;


                main.append(
                    title,
                    subtitle
                );


                const meta =
                    getStatusMeta(
                        record.ValidationStatus
                    );


                const badge =
                    document.createElement(
                        "span"
                    );


                badge.className =
                    `status-badge saved-status ${meta.cssClass}`;


                badge.textContent =
                    record.ValidationStatus;


                item.append(
                    main,
                    badge
                );


                elements.savedItems
                    .append(
                        item
                    );
            }
        );
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

        const stored =
            localStorage.getItem(
                MASTER_DATA_STORAGE_KEY
            );


        if (stored) {

            const parsed =
                JSON.parse(
                    stored
                );


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
                        parsed
                            .AktivOverrides
                            ?.Derivate &&
                        typeof parsed
                            .AktivOverrides
                            .Derivate ===
                            "object"
                            ? parsed
                                .AktivOverrides
                                .Derivate
                            : {},

                    IStufen:
                        parsed
                            .AktivOverrides
                            ?.IStufen &&
                        typeof parsed
                            .AktivOverrides
                            .IStufen ===
                            "object"
                            ? parsed
                                .AktivOverrides
                                .IStufen
                            : {}
                }
            };
        }


        const legacyStored =
            localStorage.getItem(
                LEGACY_MASTER_DATA_STORAGE_KEY
            );


        if (
            !legacyStored
        ) {
            return createEmptyLocalMasterData();
        }


        const legacy =
            JSON.parse(
                legacyStored
            );


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


        localStorage.setItem(
            MASTER_DATA_STORAGE_KEY,
            JSON.stringify(
                migrated
            )
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
        JSON.stringify(
            state.localMasterData
        )
    );
}


function getOverrideValue(
    type,
    code
) {

    const normalizedCode =
        normalizeText(
            code
        );


    const overrides =
        state.localMasterData
            .AktivOverrides[
                type
            ];


    if (
        Object.prototype
            .hasOwnProperty
            .call(
                overrides,
                normalizedCode
            )
    ) {

        return Boolean(
            overrides[
                normalizedCode
            ]
        );
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

    const seen =
        new Set();


    for (
        const item
        of [
            ...(baseItems || []),
            ...(localItems || [])
        ]
    ) {

        const value =
            normalizeText(
                item[
                    valueField
                ]
            );


        if (
            !value ||
            seen.has(
                value
            )
        ) {
            continue;
        }


        seen.add(
            value
        );


        const override =
            getOverrideValue(
                type,
                value
            );


        let aktiv =
            item.Aktiv !== false;


        if (
            override !== null
        ) {
            aktiv =
                override;
        }


        merged.push({
            ...item,

            [valueField]:
                value,

            Beschreibung:
                normalizeDescription(
                    item.Beschreibung
                ),

            Aktiv:
                aktiv
        });
    }


    return merged;
}


function rebuildMasterData() {

    state.masterData = {

        Derivate:
            mergeMasterDataItems(
                state.baseMasterData
                    ?.Derivate || [],
                state.localMasterData
                    .Derivate || [],
                "DerivatCode",
                "Derivate"
            ),


        IStufen:
            mergeMasterDataItems(
                state.baseMasterData
                    ?.IStufen || [],
                state.localMasterData
                    .IStufen || [],
                "IStufeCode",
                "IStufen"
            )
    };
}


function fillSelect(
    selectElement,
    items,
    valueField,
    selectedValue = ""
) {

    selectElement.innerHTML =
        "";


    const placeholder =
        document.createElement(
            "option"
        );


    placeholder.value =
        "";


    placeholder.textContent =
        "Bitte wählen";


    selectElement.appendChild(
        placeholder
    );


    const activeItems =
        [...items]
            .filter(
                item =>
                    item.Aktiv !==
                    false
            )
            .sort(
                (a, b) =>
                    normalizeText(
                        a[
                            valueField
                        ]
                    )
                        .localeCompare(
                            normalizeText(
                                b[
                                    valueField
                                ]
                            ),
                            "de"
                        )
            );


    for (
        const item
        of activeItems
    ) {

        const value =
            normalizeText(
                item[
                    valueField
                ]
            );


        const option =
            document.createElement(
                "option"
            );


        option.value =
            value;


        option.textContent =
            value;


        selectElement.appendChild(
            option
        );
    }


    const normalizedSelectedValue =
        normalizeText(
            selectedValue
        );


    if (
        normalizedSelectedValue &&
        [...selectElement.options]
            .some(
                option =>
                    option.value ===
                    normalizedSelectedValue
            )
    ) {

        selectElement.value =
            normalizedSelectedValue;
    }
}


function isLocalMasterDataItem(
    type,
    valueField,
    code
) {

    const normalizedCode =
        normalizeText(
            code
        );


    return state.localMasterData[
        type
    ].some(
        item =>
            normalizeText(
                item[
                    valueField
                ]
            ) ===
            normalizedCode
    );
}


function createMasterDataItem(
    type,
    item,
    valueField
) {

    const code =
        normalizeText(
            item[
                valueField
            ]
        );


    const local =
        isLocalMasterDataItem(
            type,
            valueField,
            code
        );


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "master-data-item";


    if (
        item.Aktiv ===
        false
    ) {

        row.classList.add(
            "inactive"
        );
    }


    const main =
        document.createElement(
            "div"
        );


    main.className =
        "master-data-item-main";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "master-data-item-title";


    const codeElement =
        document.createElement(
            "span"
        );


    codeElement.className =
        "master-data-code";


    codeElement.textContent =
        code;


    const source =
        document.createElement(
            "span"
        );


    source.className =
        local
            ? "master-data-source local"
            : "master-data-source";


    source.textContent =
        local
            ? "Lokal"
            : "Basis";


    title.append(
        codeElement,
        source
    );


    const description =
        document.createElement(
            "p"
        );


    description.className =
        "master-data-description";


    description.textContent =
        item.Beschreibung ||
        (
            item.Aktiv === false
                ? "Inaktiv"
                : "Aktiv"
        );


    main.append(
        title,
        description
    );


    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "master-data-item-actions";


    const toggleButton =
        document.createElement(
            "button"
        );


    toggleButton.type =
        "button";


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


    actions.appendChild(
        toggleButton
    );


    if (local) {

        const deleteButton =
            document.createElement(
                "button"
            );


        deleteButton.type =
            "button";


        deleteButton.className =
            "mini-button delete";


        deleteButton.textContent =
            "Löschen";


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


        actions.appendChild(
            deleteButton
        );
    }


    row.append(
        main,
        actions
    );


    return row;
}


function renderMasterDataList(
    container,
    type,
    items,
    valueField
) {

    container.innerHTML =
        "";


    const sorted =
        [...items]
            .sort(
                (a, b) =>
                    normalizeText(
                        a[
                            valueField
                        ]
                    )
                        .localeCompare(
                            normalizeText(
                                b[
                                    valueField
                                ]
                            ),
                            "de"
                        )
            );


    if (
        sorted.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "master-data-list-empty";


        empty.textContent =
            "Keine Stammdaten vorhanden.";


        container.appendChild(
            empty
        );


        return;
    }


    for (
        const item
        of sorted
    ) {

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
        state.masterData
            .Derivate || [],
        "DerivatCode"
    );


    renderMasterDataList(
        elements.iStufenList,
        "IStufen",
        state.masterData
            .IStufen || [],
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
        state.masterData
            .Derivate || [],
        "DerivatCode",
        currentDerivat
    );


    fillSelect(
        elements.iStufe,
        state.masterData
            .IStufen || [],
        "IStufeCode",
        currentIStufe
    );


    elements.derivatCount.textContent =
        state.masterData
            .Derivate.length;


    elements.iStufeCount.textContent =
        state.masterData
            .IStufen.length;


    elements.localMasterDataCount.textContent =
        (
            state.localMasterData
                .Derivate.length +
            state.localMasterData
                .IStufen.length
        );


    renderMasterDataLists();

    updateDataStatus();
}


function updateDataStatus() {

    if (
        !state.masterData
    ) {
        return;
    }


    const activeDerivate =
        state.masterData
            .Derivate
            .filter(
                item =>
                    item.Aktiv !==
                    false
            )
            .length;


    const activeIStufen =
        state.masterData
            .IStufen
            .filter(
                item =>
                    item.Aktiv !==
                    false
            )
            .length;


    elements.dataStatus.textContent =
        `${activeDerivate} aktive Derivate · ` +
        `${activeIStufen} aktive I-Stufen · ` +
        `${state.initialTrackingData.length} vorhandene Teile`;
}


function showMasterDataMessage(
    message,
    type
) {

    elements.masterDataMessage
        .classList.remove(
            "hidden",
            "success",
            "error"
        );


    elements.masterDataMessage
        .classList.add(
            type
        );


    elements.masterDataMessage.textContent =
        message;
}


function masterDataValueExists(
    items,
    valueField,
    value
) {

    const normalizedValue =
        normalizeText(
            value
        );


    return items.some(
        item =>
            normalizeText(
                item[
                    valueField
                ]
            ) ===
            normalizedValue
    );
}


function findMasterDataItem(
    type,
    valueField,
    code
) {

    const normalizedCode =
        normalizeText(
            code
        );


    return state.masterData[
        type
    ].find(
        item =>
            normalizeText(
                item[
                    valueField
                ]
            ) ===
            normalizedCode
    );
}


function toggleMasterDataStatus(
    type,
    valueField,
    code
) {

    const item =
        findMasterDataItem(
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


    const newStatus =
        item.Aktiv ===
        false;


    state.localMasterData
        .AktivOverrides[
            type
        ][
            normalizeText(
                code
            )
        ] =
        newStatus;


    saveLocalMasterData();

    rebuildMasterData();

    refreshMasterDataUi();


    showMasterDataMessage(
        `'${normalizeText(code)}' wurde ` +
        (
            newStatus
                ? "aktiviert."
                : "deaktiviert."
        ),
        "success"
    );
}


function deleteLocalMasterDataItem(
    type,
    valueField,
    code
) {

    const normalizedCode =
        normalizeText(
            code
        );


    const localExists =
        isLocalMasterDataItem(
            type,
            valueField,
            normalizedCode
        );


    if (
        !localExists
    ) {

        showMasterDataMessage(
            "Nur lokal angelegte Stammdaten können gelöscht werden.",
            "error"
        );

        return;
    }


    state.localMasterData[
        type
    ] =
        state.localMasterData[
            type
        ].filter(
            item =>
                normalizeText(
                    item[
                        valueField
                    ]
                ) !==
                normalizedCode
        );


    delete state.localMasterData
        .AktivOverrides[
            type
        ][
            normalizedCode
        ];


    saveLocalMasterData();

    rebuildMasterData();

    refreshMasterDataUi();


    showMasterDataMessage(
        `'${normalizedCode}' wurde aus den lokalen Stammdaten gelöscht.`,
        "success"
    );
}


function addDerivat() {

    const code =
        normalizeText(
            elements
                .newDerivatCode
                .value
        );


    const description =
        normalizeDescription(
            elements
                .newDerivatDescription
                .value
        );


    if (!code) {

        showMasterDataMessage(
            "Bitte einen Derivat-Code eingeben.",
            "error"
        );


        elements
            .newDerivatCode
            .focus();


        return;
    }


    if (
        masterDataValueExists(
            state.masterData
                .Derivate,
            "DerivatCode",
            code
        )
    ) {

        showMasterDataMessage(
            `Derivat '${code}' ist bereits vorhanden.`,
            "error"
        );


        elements
            .newDerivatCode
            .focus();


        return;
    }


    state.localMasterData
        .Derivate
        .push({
            DerivatCode:
                code,

            Beschreibung:
                description,

            Aktiv:
                true
        });


    saveLocalMasterData();

    rebuildMasterData();

    refreshMasterDataUi(
        code,
        null
    );


    elements
        .newDerivatCode
        .value =
        "";


    elements
        .newDerivatDescription
        .value =
        "";


    showMasterDataMessage(
        `Derivat '${code}' wurde lokal angelegt und ausgewählt.`,
        "success"
    );
}


function addIStufe() {

    const code =
        normalizeText(
            elements
                .newIStufeCode
                .value
        );


    const description =
        normalizeDescription(
            elements
                .newIStufeDescription
                .value
        );


    if (!code) {

        showMasterDataMessage(
            "Bitte eine I-Stufe eingeben.",
            "error"
        );


        elements
            .newIStufeCode
            .focus();


        return;
    }


    if (
        masterDataValueExists(
            state.masterData
                .IStufen,
            "IStufeCode",
            code
        )
    ) {

        showMasterDataMessage(
            `I-Stufe '${code}' ist bereits vorhanden.`,
            "error"
        );


        elements
            .newIStufeCode
            .focus();


        return;
    }


    state.localMasterData
        .IStufen
        .push({
            IStufeCode:
                code,

            Beschreibung:
                description,

            Aktiv:
                true
        });


    saveLocalMasterData();

    rebuildMasterData();

    refreshMasterDataUi(
        null,
        code
    );


    elements
        .newIStufeCode
        .value =
        "";


    elements
        .newIStufeDescription
        .value =
        "";


    showMasterDataMessage(
        `I-Stufe '${code}' wurde lokal angelegt und ausgewählt.`,
        "success"
    );
}


function checkCurrentInput() {

    try {

        const label =
            parseTrackingString(
                elements
                    .labelInput
                    .value
            );


        const qr =
            parseTrackingString(
                elements
                    .qrInput
                    .value
            );


        const derivat =
            normalizeText(
                elements
                    .derivat
                    .value
            );


        const iStufe =
            normalizeText(
                elements
                    .iStufe
                    .value
            );


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
                iStufe
            );


        state.currentRecord =
            record;


        renderRecord(
            record
        );
    }
    catch (error) {

        renderError(
            error
        );
    }
}


function saveCurrentRecord() {

    if (
        !state.currentRecord
    ) {
        return;
    }


    if (
        state.currentRecord
            .DuplicateStatus ===
        "DUPLICATE"
    ) {
        return;
    }


    state.savedItems.push({
        ...state.currentRecord,

        MismatchFields: [
            ...state.currentRecord
                .MismatchFields
        ]
    });


    renderSavedItems();

    checkCurrentInput();
}


function resetForm() {

    elements.derivat.value =
        "";

    elements.iStufe.value =
        "";

    elements.labelInput.value =
        "";

    elements.qrInput.value =
        "";


    elements.resultCard
        .classList.add(
            "hidden"
        );


    elements.saveButton.disabled =
        true;


    clearComparison();


    state.currentRecord =
        null;
}


async function loadData() {

    try {

        const [
            masterResponse,
            trackingResponse
        ] =
            await Promise.all([
                fetch(
                    "../tests/data/MasterData.json"
                ),

                fetch(
                    "../tests/data/TrackingData.json"
                )
            ]);


        if (
            !masterResponse.ok
        ) {
            throw new Error(
                "MasterData.json konnte nicht geladen werden"
            );
        }


        if (
            !trackingResponse.ok
        ) {
            throw new Error(
                "TrackingData.json konnte nicht geladen werden"
            );
        }


        state.baseMasterData =
            await masterResponse
                .json();


        state.localMasterData =
            getLocalMasterData();


        rebuildMasterData();


        const tracking =
            await trackingResponse
                .json();


        state.initialTrackingData =
            tracking.Steuergeraete ||
            [];


        refreshMasterDataUi();


        elements.dataStatus
            .classList.remove(
                "error"
            );
    }
    catch (error) {

        elements.dataStatus.textContent =
            error.message;


        elements.dataStatus
            .classList.add(
                "error"
            );


        elements.checkButton.disabled =
            true;


        elements
            .addDerivatButton
            .disabled =
            true;


        elements
            .addIStufeButton
            .disabled =
            true;


        console.error(
            error
        );
    }
}


elements.checkButton
    .addEventListener(
        "click",
        checkCurrentInput
    );


elements.saveButton
    .addEventListener(
        "click",
        saveCurrentRecord
    );


elements.resetButton
    .addEventListener(
        "click",
        resetForm
    );


elements.addDerivatButton
    .addEventListener(
        "click",
        addDerivat
    );


elements.addIStufeButton
    .addEventListener(
        "click",
        addIStufe
    );


elements.newDerivatCode
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {
                addDerivat();
            }
        }
    );


elements.newIStufeCode
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {
                addIStufe();
            }
        }
    );


renderSavedItems();

loadData();
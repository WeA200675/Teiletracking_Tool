"use strict";

(function initializeFeatureService(global) {
    const STORAGE_KEY =
        "teiletracking.featureMasterData.v1";

    const COLOR_PALETTE = Object.freeze([
        { value: "#107C10", name: "Grün" },
        { value: "#0078D4", name: "Blau" },
        { value: "#A4262C", name: "Rot" },
        { value: "#8764B8", name: "Violett" },
        { value: "#CA5010", name: "Orange" },
        { value: "#038387", name: "Türkis" },
        { value: "#C239B3", name: "Magenta" },
        { value: "#8E8CD8", name: "Lavendel" },
        { value: "#498205", name: "Olivgrün" },
        { value: "#986F0B", name: "Ocker" },
        { value: "#69797E", name: "Grau" },
        { value: "#004E8C", name: "Dunkelblau" }
    ]);

    let context = null;
    let baseData = {
        ATS: [],
        YNummern: [],
        Statuswerte: []
    };
    let localData = createEmptyLocalData();
    let mergedData = {
        ATS: [],
        YNummern: [],
        Statuswerte: []
    };
    let selectedStatuses = new Set();
    let transferSelection = new Set();
    let initialized = false;

    function createEmptyLocalData() {
        return {
            ATS: [],
            YNummern: [],
            Statuswerte: [],
            AktivOverrides: {
                ATS: {},
                YNummern: {},
                Statuswerte: {}
            }
        };
    }

    function normalizeText(value) {
        return String(value || "")
            .trim()
            .toUpperCase();
    }

    function normalizeDescription(value) {
        return String(value || "").trim();
    }

    function normalizeColor(value) {
        const color = String(value || "")
            .trim()
            .toUpperCase();

        return /^#[0-9A-F]{6}$/.test(color)
            ? color
            : "";
    }

    function readLocalData() {
        try {
            const raw =
                global.localStorage.getItem(
                    STORAGE_KEY
                );

            if (!raw) {
                return createEmptyLocalData();
            }

            const parsed = JSON.parse(raw);
            const empty = createEmptyLocalData();

            return {
                ATS:
                    Array.isArray(parsed.ATS)
                        ? parsed.ATS
                        : [],
                YNummern:
                    Array.isArray(parsed.YNummern)
                        ? parsed.YNummern
                        : [],
                Statuswerte:
                    Array.isArray(parsed.Statuswerte)
                        ? parsed.Statuswerte
                        : [],
                AktivOverrides: {
                    ATS:
                        parsed.AktivOverrides &&
                        parsed.AktivOverrides.ATS &&
                        typeof parsed.AktivOverrides.ATS === "object"
                            ? parsed.AktivOverrides.ATS
                            : empty.AktivOverrides.ATS,
                    YNummern:
                        parsed.AktivOverrides &&
                        parsed.AktivOverrides.YNummern &&
                        typeof parsed.AktivOverrides.YNummern === "object"
                            ? parsed.AktivOverrides.YNummern
                            : empty.AktivOverrides.YNummern,
                    Statuswerte:
                        parsed.AktivOverrides &&
                        parsed.AktivOverrides.Statuswerte &&
                        typeof parsed.AktivOverrides.Statuswerte === "object"
                            ? parsed.AktivOverrides.Statuswerte
                            : empty.AktivOverrides.Statuswerte
                }
            };
        }
        catch (error) {
            console.error(
                "Zusätzliche Stammdaten konnten nicht gelesen werden:",
                error
            );

            return createEmptyLocalData();
        }
    }

    function saveLocalData() {
        global.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(localData)
        );
    }

    async function loadBaseData() {
        const response = await fetch(
            "./feature-master-data.json",
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(
                `feature-master-data.json konnte nicht geladen werden (HTTP ${response.status}).`
            );
        }

        const parsed = await response.json();

        baseData = {
            ATS:
                Array.isArray(parsed.ATS)
                    ? parsed.ATS
                    : [],
            YNummern:
                Array.isArray(parsed.YNummern)
                    ? parsed.YNummern
                    : [],
            Statuswerte:
                Array.isArray(parsed.Statuswerte)
                    ? parsed.Statuswerte
                    : []
        };
    }

    function getOverride(type, key) {
        const normalizedKey = normalizeText(key);
        const overrides =
            localData.AktivOverrides[type] || {};

        if (
            Object.prototype.hasOwnProperty.call(
                overrides,
                normalizedKey
            )
        ) {
            return Boolean(
                overrides[normalizedKey]
            );
        }

        return null;
    }

    function mergeItems(
        baseItems,
        localItems,
        valueField,
        type
    ) {
        const result = [];
        const seen = new Set();

        for (const item of [
            ...(baseItems || []),
            ...(localItems || [])
        ]) {
            const value = normalizeText(
                item[valueField]
            );

            if (!value || seen.has(value)) {
                continue;
            }

            seen.add(value);

            const override =
                getOverride(type, value);

            result.push({
                ...item,
                [valueField]: value,
                Beschreibung:
                    normalizeDescription(
                        item.Beschreibung
                    ),
                Aktiv:
                    override !== null
                        ? override
                        : item.Aktiv !== false
            });
        }

        return result;
    }

    function rebuildMergedData() {
        mergedData = {
            ATS: mergeItems(
                baseData.ATS,
                localData.ATS,
                "ATSCode",
                "ATS"
            ),
            YNummern: mergeItems(
                baseData.YNummern,
                localData.YNummern,
                "YNummerCode",
                "YNummern"
            ),
            Statuswerte: mergeItems(
                baseData.Statuswerte,
                localData.Statuswerte,
                "StatusCode",
                "Statuswerte"
            ).map(item => ({
                ...item,
                Anzeigename:
                    normalizeDescription(
                        item.Anzeigename ||
                        item.StatusCode
                    ),
                Farbe:
                    normalizeColor(
                        item.Farbe
                    ) || "#69797E"
            }))
        };
    }

    function isLocalItem(
        type,
        valueField,
        code
    ) {
        const normalizedCode =
            normalizeText(code);

        return localData[type].some(
            item =>
                normalizeText(
                    item[valueField]
                ) === normalizedCode
        );
    }

    function fillSelect(
        element,
        items,
        valueField,
        placeholder,
        selectedValue = "",
        activeOnly = true
    ) {
        if (!element) {
            return;
        }

        const previous =
            normalizeText(
                selectedValue ||
                element.value
            );

        element.innerHTML = "";

        const first =
            document.createElement("option");
        first.value = "";
        first.textContent = placeholder;
        element.appendChild(first);

        const sorted = [...items]
            .filter(item =>
                !activeOnly ||
                item.Aktiv !== false
            )
            .sort((a, b) =>
                normalizeText(
                    a[valueField]
                ).localeCompare(
                    normalizeText(
                        b[valueField]
                    ),
                    "de"
                )
            );

        for (const item of sorted) {
            const value = normalizeText(
                item[valueField]
            );

            if (!value) {
                continue;
            }

            const option =
                document.createElement(
                    "option"
                );
            option.value = value;
            option.textContent = value;
            element.appendChild(option);
        }

        if (
            previous &&
            [...element.options].some(
                option =>
                    option.value === previous
            )
        ) {
            element.value = previous;
        }
    }

    function getTextColor(
        backgroundColor
    ) {
        const hex = normalizeColor(
            backgroundColor
        );

        if (!hex) {
            return "#FFFFFF";
        }

        const red = parseInt(
            hex.slice(1, 3),
            16
        );
        const green = parseInt(
            hex.slice(3, 5),
            16
        );
        const blue = parseInt(
            hex.slice(5, 7),
            16
        );

        const luminance =
            0.299 * red +
            0.587 * green +
            0.114 * blue;

        return luminance > 155
            ? "#202124"
            : "#FFFFFF";
    }

    function getStatusDefinition(code) {
        const normalizedCode =
            normalizeText(code);

        return mergedData.Statuswerte.find(
            item =>
                normalizeText(
                    item.StatusCode
                ) === normalizedCode
        ) || null;
    }

    function createStatusChip(code) {
        const normalizedCode =
            normalizeText(code);
        const definition =
            getStatusDefinition(
                normalizedCode
            );

        const chip =
            document.createElement("span");
        chip.className = "part-status-chip";

        const backgroundColor =
            definition
                ? definition.Farbe
                : "#69797E";

        chip.style.backgroundColor =
            backgroundColor;
        chip.style.color =
            getTextColor(
                backgroundColor
            );

        chip.textContent =
            definition
                ? definition.Anzeigename
                : normalizedCode;

        return chip;
    }

    function createStatusChips(statuses) {
        const wrapper =
            document.createElement("div");
        wrapper.className =
            "part-status-chips";

        const values =
            normalizeStatusArray(
                statuses
            );

        if (values.length === 0) {
            const empty =
                document.createElement(
                    "span"
                );
            empty.className =
                "part-status-empty";
            empty.textContent =
                "Kein Teile-Status";
            wrapper.appendChild(empty);
            return wrapper;
        }

        for (const value of values) {
            wrapper.appendChild(
                createStatusChip(value)
            );
        }

        return wrapper;
    }

    function normalizeStatusArray(value) {
        const values =
            Array.isArray(value)
                ? value
                : String(value || "")
                    .split(/[;,|]/);

        return [
            ...new Set(
                values
                    .map(normalizeText)
                    .filter(Boolean)
            )
        ].sort(
            (left, right) =>
                left.localeCompare(
                    right,
                    "de"
                )
        );
    }

    function getSelectedStatuses() {
        return normalizeStatusArray(
            [...selectedStatuses]
        );
    }

    function getSelectedAts() {
        return normalizeText(
            document.getElementById(
                "ats"
            )?.value
        );
    }

    function getSelectedYNumber() {
        return normalizeText(
            document.getElementById(
                "yNummer"
            )?.value
        );
    }

    function updateSelectedStatusChips() {
        const container =
            document.getElementById(
                "partStatusChips"
            );
        const summary =
            document.getElementById(
                "partStatusSummary"
            );

        if (container) {
            container.innerHTML = "";
            container.appendChild(
                createStatusChips(
                    getSelectedStatuses()
                )
            );
        }

        if (summary) {
            const values =
                getSelectedStatuses();

            summary.textContent =
                values.length === 0
                    ? "Bitte wählen"
                    : `${values.length} ausgewählt`;
        }
    }

    function renderStatusOptions() {
        const container =
            document.getElementById(
                "partStatusOptions"
            );

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const active =
            mergedData.Statuswerte
                .filter(item =>
                    item.Aktiv !== false
                );

        if (active.length === 0) {
            const empty =
                document.createElement(
                    "p"
                );
            empty.className =
                "hint compact";
            empty.textContent =
                "Keine aktiven Statuswerte vorhanden.";
            container.appendChild(empty);
            updateSelectedStatusChips();
            return;
        }

        for (const item of active) {
            const label =
                document.createElement(
                    "label"
                );
            label.className =
                "part-status-option";

            const checkbox =
                document.createElement(
                    "input"
                );
            checkbox.type = "checkbox";
            checkbox.value =
                item.StatusCode;
            checkbox.checked =
                selectedStatuses.has(
                    item.StatusCode
                );

            checkbox.addEventListener(
                "change",
                () => {
                    if (checkbox.checked) {
                        selectedStatuses.add(
                            item.StatusCode
                        );
                    }
                    else {
                        selectedStatuses.delete(
                            item.StatusCode
                        );
                    }

                    updateSelectedStatusChips();
                }
            );

            label.append(
                checkbox,
                createStatusChip(
                    item.StatusCode
                )
            );

            container.appendChild(label);
        }

        updateSelectedStatusChips();
    }

    function renderMasterItem(
        type,
        item,
        valueField,
        container
    ) {
        const code = normalizeText(
            item[valueField]
        );
        const local = isLocalItem(
            type,
            valueField,
            code
        );

        const row =
            document.createElement("div");
        row.className =
            "master-data-item";

        if (item.Aktiv === false) {
            row.classList.add(
                "inactive"
            );
        }

        const main =
            document.createElement("div");
        main.className =
            "master-data-item-main";

        const title =
            document.createElement("div");
        title.className =
            "master-data-item-title";

        const codeElement =
            document.createElement("span");
        codeElement.className =
            "master-data-code";
        codeElement.textContent =
            type === "Statuswerte"
                ? item.Anzeigename
                : code;

        const source =
            document.createElement("span");
        source.className =
            local
                ? "master-data-source local"
                : "master-data-source";
        source.textContent =
            local ? "Lokal" : "Basis";

        title.append(
            codeElement,
            source
        );

        if (type === "Statuswerte") {
            title.insertBefore(
                createStatusChip(code),
                source
            );
        }

        const description =
            document.createElement("p");
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
            document.createElement("div");
        actions.className =
            "master-data-item-actions";

        const toggle =
            document.createElement("button");
        toggle.type = "button";
        toggle.className =
            item.Aktiv === false
                ? "mini-button activate"
                : "mini-button deactivate";
        toggle.textContent =
            item.Aktiv === false
                ? "Aktivieren"
                : "Deaktivieren";
        toggle.addEventListener(
            "click",
            async () => {
                localData
                    .AktivOverrides[type][code] =
                    item.Aktiv === false;
                saveLocalData();
                rebuildMergedData();
                refreshUi();
            }
        );
        actions.appendChild(toggle);

        if (local) {
            const remove =
                document.createElement(
                    "button"
                );
            remove.type = "button";
            remove.className =
                "mini-button delete";
            remove.textContent =
                "Löschen";
            remove.addEventListener(
                "click",
                () => {
                    localData[type] =
                        localData[type].filter(
                            candidate =>
                                normalizeText(
                                    candidate[
                                        valueField
                                    ]
                                ) !== code
                        );

                    delete localData
                        .AktivOverrides[type][code];

                    selectedStatuses.delete(code);
                    saveLocalData();
                    rebuildMergedData();
                    refreshUi();
                }
            );
            actions.appendChild(remove);
        }

        row.append(
            main,
            actions
        );
        container.appendChild(row);
    }

    function renderMasterList(
        containerId,
        type,
        valueField
    ) {
        const container =
            document.getElementById(
                containerId
            );

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const items = [
            ...(mergedData[type] || [])
        ].sort((a, b) =>
            normalizeText(
                a[valueField]
            ).localeCompare(
                normalizeText(
                    b[valueField]
                ),
                "de"
            )
        );

        if (items.length === 0) {
            const empty =
                document.createElement(
                    "div"
                );
            empty.className =
                "master-data-list-empty";
            empty.textContent =
                "Keine Stammdaten vorhanden.";
            container.appendChild(empty);
            return;
        }

        for (const item of items) {
            renderMasterItem(
                type,
                item,
                valueField,
                container
            );
        }
    }

    function updateColorSelect() {
        const select =
            document.getElementById(
                "newStatusColor"
            );

        if (!select) {
            return;
        }

        const current =
            normalizeColor(
                select.value
            );
        const usedColors =
            new Set(
                mergedData.Statuswerte
                    .map(item =>
                        normalizeColor(
                            item.Farbe
                        )
                    )
                    .filter(Boolean)
            );

        select.innerHTML = "";

        const placeholder =
            document.createElement(
                "option"
            );
        placeholder.value = "";
        placeholder.textContent =
            "Farbe wählen";
        select.appendChild(placeholder);

        for (const color of COLOR_PALETTE) {
            const option =
                document.createElement(
                    "option"
                );
            option.value = color.value;
            option.textContent =
                `${color.name} (${color.value})`;
            option.disabled =
                usedColors.has(
                    color.value
                );
            select.appendChild(option);
        }

        if (
            current &&
            !usedColors.has(current)
        ) {
            select.value = current;
        }
    }

    function showFeatureMessage(
        message,
        type = "success"
    ) {
        const element =
            document.getElementById(
                "featureMasterDataMessage"
            );

        if (!element) {
            return;
        }

        element.className =
            `master-data-message ${type}`;
        element.textContent = message;
    }

    function clearFeatureMessage() {
        const element =
            document.getElementById(
                "featureMasterDataMessage"
            );

        if (element) {
            element.className =
                "master-data-message hidden";
            element.textContent = "";
        }
    }

    function addSimpleMasterData(
        type,
        valueField,
        valueInputId,
        descriptionInputId,
        label
    ) {
        clearFeatureMessage();

        const valueInput =
            document.getElementById(
                valueInputId
            );
        const descriptionInput =
            document.getElementById(
                descriptionInputId
            );

        const value = normalizeText(
            valueInput?.value
        );

        if (!value) {
            showFeatureMessage(
                `${label} darf nicht leer sein.`,
                "error"
            );
            return;
        }

        if (
            mergedData[type].some(
                item =>
                    normalizeText(
                        item[valueField]
                    ) === value
            )
        ) {
            showFeatureMessage(
                `${label} '${value}' ist bereits vorhanden.`,
                "error"
            );
            return;
        }

        localData[type].push({
            [valueField]: value,
            Beschreibung:
                normalizeDescription(
                    descriptionInput?.value
                ),
            Aktiv: true
        });

        saveLocalData();
        rebuildMergedData();
        refreshUi();

        if (valueInput) {
            valueInput.value = "";
        }
        if (descriptionInput) {
            descriptionInput.value = "";
        }

        showFeatureMessage(
            `${label} '${value}' wurde hinzugefügt.`,
            "success"
        );
    }

    function addStatusValue() {
        clearFeatureMessage();

        const nameInput =
            document.getElementById(
                "newStatusName"
            );
        const descriptionInput =
            document.getElementById(
                "newStatusDescription"
            );
        const colorInput =
            document.getElementById(
                "newStatusColor"
            );

        const displayName =
            normalizeDescription(
                nameInput?.value
            );
        const statusCode =
            normalizeText(
                displayName
            );
        const color =
            normalizeColor(
                colorInput?.value
            );

        if (!statusCode) {
            showFeatureMessage(
                "Statuswert darf nicht leer sein.",
                "error"
            );
            return;
        }

        if (!color) {
            showFeatureMessage(
                "Bitte eine freie Farbe auswählen.",
                "error"
            );
            return;
        }

        if (
            mergedData.Statuswerte.some(
                item =>
                    normalizeText(
                        item.StatusCode
                    ) === statusCode
            )
        ) {
            showFeatureMessage(
                `Statuswert '${displayName}' ist bereits vorhanden.`,
                "error"
            );
            return;
        }

        if (
            mergedData.Statuswerte.some(
                item =>
                    normalizeColor(
                        item.Farbe
                    ) === color
            )
        ) {
            showFeatureMessage(
                `Die Farbe ${color} ist bereits vergeben und kann nicht doppelt verwendet werden.`,
                "error"
            );
            return;
        }

        localData.Statuswerte.push({
            StatusCode: statusCode,
            Anzeigename: displayName,
            Farbe: color,
            Beschreibung:
                normalizeDescription(
                    descriptionInput?.value
                ),
            Aktiv: true
        });

        saveLocalData();
        rebuildMergedData();
        refreshUi();

        if (nameInput) {
            nameInput.value = "";
        }
        if (descriptionInput) {
            descriptionInput.value = "";
        }

        showFeatureMessage(
            `Statuswert '${displayName}' wurde mit ${color} angelegt.`,
            "success"
        );
    }

    function refreshAssignmentSelects() {
        fillSelect(
            document.getElementById("ats"),
            mergedData.ATS,
            "ATSCode",
            "Bitte wählen"
        );

        fillSelect(
            document.getElementById("yNummer"),
            mergedData.YNummern,
            "YNummerCode",
            "Bitte wählen"
        );

        renderStatusOptions();
    }

    function refreshCountsAndLists() {
        const atsCount =
            document.getElementById(
                "atsCount"
            );
        const yCount =
            document.getElementById(
                "yNummerCount"
            );
        const statusCount =
            document.getElementById(
                "statusValueCount"
            );

        if (atsCount) {
            atsCount.textContent =
                mergedData.ATS.length;
        }
        if (yCount) {
            yCount.textContent =
                mergedData.YNummern.length;
        }
        if (statusCount) {
            statusCount.textContent =
                mergedData.Statuswerte.length;
        }

        renderMasterList(
            "atsList",
            "ATS",
            "ATSCode"
        );
        renderMasterList(
            "yNummernList",
            "YNummern",
            "YNummerCode"
        );
        renderMasterList(
            "statusValuesList",
            "Statuswerte",
            "StatusCode"
        );

        updateColorSelect();
    }

    function refreshTransferSelectors() {
        fillSelect(
            document.getElementById(
                "transferSourceAts"
            ),
            mergedData.ATS,
            "ATSCode",
            "Quell-ATS wählen"
        );

        fillSelect(
            document.getElementById(
                "transferTargetAts"
            ),
            mergedData.ATS,
            "ATSCode",
            "Ziel-ATS wählen"
        );

        const ySelect =
            document.getElementById(
                "transferTargetYNumber"
            );

        if (ySelect) {
            const previous =
                ySelect.value ||
                "__KEEP__";

            ySelect.innerHTML = "";

            const keep =
                document.createElement(
                    "option"
                );
            keep.value = "__KEEP__";
            keep.textContent =
                "Y-Nummer beibehalten";
            ySelect.appendChild(keep);

            for (
                const item of
                mergedData.YNummern
                    .filter(item =>
                        item.Aktiv !== false
                    )
                    .sort((a, b) =>
                        a.YNummerCode.localeCompare(
                            b.YNummerCode,
                            "de"
                        )
                    )
            ) {
                const option =
                    document.createElement(
                        "option"
                    );
                option.value =
                    item.YNummerCode;
                option.textContent =
                    item.YNummerCode;
                ySelect.appendChild(
                    option
                );
            }

            if (
                [...ySelect.options].some(
                    option =>
                        option.value === previous
                )
            ) {
                ySelect.value = previous;
            }
        }
    }

    function refreshUi() {
        refreshAssignmentSelects();
        refreshCountsAndLists();
        refreshTransferSelectors();

        if (context) {
            refreshTrackingFilters(
                context.getTrackingDisplayItems()
            );
            renderTransferCandidates();
        }
    }

    function setSelectedStatuses(
        statuses
    ) {
        selectedStatuses = new Set(
            normalizeStatusArray(statuses)
        );
        renderStatusOptions();
    }

    function resetAssignmentFields() {
        const ats =
            document.getElementById("ats");
        const yNumber =
            document.getElementById(
                "yNummer"
            );

        if (ats) {
            ats.value = "";
        }
        if (yNumber) {
            yNumber.value = "";
        }

        selectedStatuses.clear();
        renderStatusOptions();
    }

    function refreshTrackingFilters(
        displayItems
    ) {
        const atsFilter =
            document.getElementById(
                "trackingAtsFilter"
            );
        const yFilter =
            document.getElementById(
                "trackingYNummerFilter"
            );
        const statusFilter =
            document.getElementById(
                "trackingPartStatusFilter"
            );

        const atsValues = new Map();
        const yValues = new Map();

        for (const item of [
            ...(displayItems || [])
        ]) {
            const ats = normalizeText(
                item.ATS
            );
            const y = normalizeText(
                item.YNummer
            );

            if (ats) {
                atsValues.set(
                    ats,
                    { ATSCode: ats, Aktiv: true }
                );
            }
            if (y) {
                yValues.set(
                    y,
                    { YNummerCode: y, Aktiv: true }
                );
            }
        }

        for (const item of mergedData.ATS) {
            atsValues.set(
                item.ATSCode,
                { ATSCode: item.ATSCode, Aktiv: true }
            );
        }
        for (const item of mergedData.YNummern) {
            yValues.set(
                item.YNummerCode,
                { YNummerCode: item.YNummerCode, Aktiv: true }
            );
        }

        fillSelect(
            atsFilter,
            [...atsValues.values()],
            "ATSCode",
            "Alle ATS",
            atsFilter?.value,
            false
        );
        fillSelect(
            yFilter,
            [...yValues.values()],
            "YNummerCode",
            "Alle Y-Nummern",
            yFilter?.value,
            false
        );

        if (statusFilter) {
            const previous =
                normalizeText(
                    statusFilter.value
                );
            statusFilter.innerHTML = "";

            const all =
                document.createElement(
                    "option"
                );
            all.value = "";
            all.textContent =
                "Alle Teile-Status";
            statusFilter.appendChild(all);

            for (
                const status of
                mergedData.Statuswerte
                    .filter(item =>
                        item.Aktiv !== false
                    )
            ) {
                const option =
                    document.createElement(
                        "option"
                    );
                option.value =
                    status.StatusCode;
                option.textContent =
                    status.Anzeigename;
                statusFilter.appendChild(
                    option
                );
            }

            if (
                [...statusFilter.options].some(
                    option =>
                        option.value === previous
                )
            ) {
                statusFilter.value = previous;
            }
        }
    }

    function getMigrationSnapshot() {
        return {
            ATS:
                mergedData.ATS.map(
                    item => ({
                        ATSCode:
                            normalizeText(
                                item.ATSCode
                            ),
                        Beschreibung:
                            normalizeDescription(
                                item.Beschreibung
                            ),
                        Aktiv:
                            item.Aktiv !== false
                    })
                ),
            YNummern:
                mergedData.YNummern.map(
                    item => ({
                        YNummerCode:
                            normalizeText(
                                item.YNummerCode
                            ),
                        Beschreibung:
                            normalizeDescription(
                                item.Beschreibung
                            ),
                        Aktiv:
                            item.Aktiv !== false
                    })
                ),
            Statuswerte:
                mergedData.Statuswerte.map(
                    item => ({
                        StatusCode:
                            normalizeText(
                                item.StatusCode
                            ),
                        Anzeigename:
                            normalizeDescription(
                                item.Anzeigename ||
                                item.StatusCode
                            ),
                        Farbe:
                            normalizeColor(
                                item.Farbe
                            ),
                        Beschreibung:
                            normalizeDescription(
                                item.Beschreibung
                            ),
                        Aktiv:
                            item.Aktiv !== false
                    })
                )
        };
    }

    function getStats() {
        return {
            activeATS:
                mergedData.ATS.filter(
                    item =>
                        item.Aktiv !== false
                ).length,
            activeYNumbers:
                mergedData.YNummern.filter(
                    item =>
                        item.Aktiv !== false
                ).length,
            activeStatuses:
                mergedData.Statuswerte.filter(
                    item =>
                        item.Aktiv !== false
                ).length
        };
    }

    function getTransferCandidates() {
        if (!context) {
            return [];
        }

        const sourceAts =
            normalizeText(
                document.getElementById(
                    "transferSourceAts"
                )?.value
            );
        const search =
            normalizeText(
                document.getElementById(
                    "transferSearch"
                )?.value
            );

        if (!sourceAts) {
            return [];
        }

        return context
            .getTrackingDisplayItems()
            .filter(record => {
                if (
                    normalizeText(
                        record.ATS
                    ) !== sourceAts
                ) {
                    return false;
                }

                if (!search) {
                    return true;
                }

                const haystack = [
                    record.PartNumber,
                    record.SerialNumber,
                    record.Derivat,
                    record.IStufe,
                    record.ATS,
                    record.YNummer,
                    record.AssignmentKey,
                    ...(normalizeStatusArray(
                        record.PartStatuses ||
                        record.Teilestatus
                    ))
                ]
                    .map(normalizeText)
                    .join(" ");

                return haystack.includes(
                    search
                );
            });
    }

    function renderTransferCandidates() {
        const container =
            document.getElementById(
                "transferCandidateList"
            );
        const info =
            document.getElementById(
                "transferSelectionInfo"
            );

        if (!container) {
            return;
        }

        container.innerHTML = "";
        const candidates =
            getTransferCandidates();
        const visibleIds =
            new Set(
                candidates.map(
                    record =>
                        record.DisplayId
                )
            );

        transferSelection =
            new Set(
                [...transferSelection].filter(
                    id =>
                        visibleIds.has(id)
                )
            );

        if (candidates.length === 0) {
            const empty =
                document.createElement(
                    "div"
                );
            empty.className =
                "master-data-list-empty";
            empty.textContent =
                normalizeText(
                    document.getElementById(
                        "transferSourceAts"
                    )?.value
                )
                    ? "Keine Teile im gewählten Quell-ATS gefunden."
                    : "Bitte zuerst einen Quell-ATS wählen.";
            container.appendChild(empty);
        }
        else {
            for (const record of candidates) {
                const row =
                    document.createElement(
                        "label"
                    );
                row.className =
                    "ats-transfer-item";

                const checkbox =
                    document.createElement(
                        "input"
                    );
                checkbox.type = "checkbox";
                checkbox.checked =
                    transferSelection.has(
                        record.DisplayId
                    );
                checkbox.addEventListener(
                    "change",
                    () => {
                        if (checkbox.checked) {
                            transferSelection.add(
                                record.DisplayId
                            );
                        }
                        else {
                            transferSelection.delete(
                                record.DisplayId
                            );
                        }
                        updateTransferSelectionInfo(
                            candidates.length
                        );
                    }
                );

                const content =
                    document.createElement(
                        "div"
                    );
                content.className =
                    "ats-transfer-item-content";

                const title =
                    document.createElement(
                        "strong"
                    );
                title.textContent =
                    `${normalizeText(record.PartNumber)} · ${normalizeText(record.SerialNumber)}`;

                const meta =
                    document.createElement(
                        "span"
                    );
                meta.textContent =
                    `${normalizeText(record.Derivat)} · ${normalizeText(record.IStufe)} · Y: ${normalizeText(record.YNummer) || "–"}`;

                content.append(
                    title,
                    meta,
                    createStatusChips(
                        record.PartStatuses ||
                        record.Teilestatus
                    )
                );

                row.append(
                    checkbox,
                    content
                );
                container.appendChild(row);
            }
        }

        updateTransferSelectionInfo(
            candidates.length
        );
    }

    function updateTransferSelectionInfo(
        visibleCount
    ) {
        const info =
            document.getElementById(
                "transferSelectionInfo"
            );

        if (info) {
            info.textContent =
                `${transferSelection.size} ausgewählt · ${visibleCount} sichtbar`;
        }
    }

    function showTransferMessage(
        message,
        type = "success"
    ) {
        const element =
            document.getElementById(
                "atsTransferMessage"
            );

        if (!element) {
            return;
        }

        element.className =
            `tracking-transfer-message ${type}`;
        element.textContent = message;
    }

    function createTransferBatchId() {
        const stamp =
            new Date()
                .toISOString()
                .replace(/[-:.]/g, "")
                .replace("Z", "Z");
        const random =
            global.crypto &&
            typeof global.crypto.randomUUID === "function"
                ? global.crypto
                    .randomUUID()
                    .replace(/-/g, "")
                    .slice(0, 8)
                    .toUpperCase()
                : Math.random()
                    .toString(16)
                    .slice(2, 10)
                    .toUpperCase();

        return `ATS-XFER-${stamp}-${random}`;
    }

    async function transferSelectedRecords() {
        if (!context) {
            return;
        }

        const sourceAts =
            normalizeText(
                document.getElementById(
                    "transferSourceAts"
                )?.value
            );
        const targetAts =
            normalizeText(
                document.getElementById(
                    "transferTargetAts"
                )?.value
            );
        const targetYRaw =
            document.getElementById(
                "transferTargetYNumber"
            )?.value || "__KEEP__";

        if (!sourceAts) {
            showTransferMessage(
                "Bitte Quell-ATS auswählen.",
                "error"
            );
            return;
        }

        if (!targetAts) {
            showTransferMessage(
                "Bitte Ziel-ATS auswählen.",
                "error"
            );
            return;
        }

        if (sourceAts === targetAts) {
            showTransferMessage(
                "Quell-ATS und Ziel-ATS müssen unterschiedlich sein.",
                "error"
            );
            return;
        }

        if (transferSelection.size === 0) {
            showTransferMessage(
                "Bitte mindestens ein Teil auswählen.",
                "error"
            );
            return;
        }

        const candidates =
            getTransferCandidates();
        const selectedRecords =
            candidates.filter(record =>
                transferSelection.has(
                    record.DisplayId
                )
            );
        const existingKeys =
            new Set(
                context
                    .getTrackingDisplayItems()
                    .map(record =>
                        normalizeText(
                            record.AssignmentKey
                        )
                    )
                    .filter(Boolean)
            );
        const transferBatchId =
            createTransferBatchId();
        const sourceDeviceId =
            context.dataService
                .getOrCreateDeviceId();

        let created = 0;
        let skipped = 0;
        const imageCopies = [];

        for (const record of selectedRecords) {
            const targetY =
                targetYRaw === "__KEEP__"
                    ? normalizeText(
                        record.YNummer
                    )
                    : normalizeText(
                        targetYRaw
                    );

            const assignmentKey =
                context.getAssignmentKey(
                    record.PartNumber,
                    record.SerialNumber,
                    record.Derivat,
                    record.IStufe,
                    targetAts,
                    targetY
                );

            if (
                existingKeys.has(
                    assignmentKey
                )
            ) {
                skipped += 1;
                continue;
            }

            const now =
                new Date().toISOString();
            const sourceRecordId =
                context.migrationService
                    .createRecordId(
                        sourceDeviceId,
                        now
                    );
            const sourceReference =
                normalizeDescription(
                    record.SourceRecordId ||
                    record.AssignmentKey ||
                    record.DisplayId
                );
            const {
                Source,
                DisplayId,
                LocalId,
                ...recordData
            } = record;

            const clone =
                context.normalizeStoredTrackingRecord({
                    ...recordData,
                    ATS: targetAts,
                    YNummer: targetY,
                    AssignmentKey:
                        assignmentKey,
                    DuplicateStatus:
                        "ATS_TRANSFER",
                    ValidationStatus:
                        normalizeText(
                            record.ValidationStatus
                        ) ===
                        "LABEL_QR_MISMATCH"
                            ? "LABEL_QR_MISMATCH"
                            : "OK",
                    SourceRecordId:
                        sourceRecordId,
                    SourceDeviceId:
                        sourceDeviceId,
                    SourceOrigin:
                        "ATS_TRANSFER",
                    TransferBatchId:
                        transferBatchId,
                    TransferSourceRecordId:
                        sourceReference,
                    SavedAt: now,
                    CapturedAt:
                        record.CapturedAt ||
                        record.SavedAt ||
                        now,
                    LocalId:
                        context.dataService
                            .createLocalRecordId()
                });

            context.state.savedItems.push(
                clone
            );
            existingKeys.add(
                assignmentKey
            );
            created += 1;

            if (record.SourceRecordId) {
                imageCopies.push({
                    from:
                        record.SourceRecordId,
                    to:
                        sourceRecordId
                });
            }
        }

        await context.saveTrackingData();

        for (const imageCopy of imageCopies) {
            try {
                const dataUrl =
                    await context.dataService
                        .getLabelImage(
                            imageCopy.from
                        );

                if (dataUrl) {
                    await context.dataService
                        .saveLabelImage(
                            imageCopy.to,
                            dataUrl
                        );
                }
            }
            catch (error) {
                console.warn(
                    "Labelbild konnte bei ATS-Übernahme nicht kopiert werden:",
                    error
                );
            }
        }

        transferSelection.clear();
        context.refreshTrackingFilterOptions();
        context.renderSavedItems();
        context.updateDataStatus();
        renderTransferCandidates();

        showTransferMessage(
            `${created} Teil(e) wurden in ${targetAts} übernommen. ${skipped} bereits vorhandene Zielzuordnung(en) wurden übersprungen. Transfer: ${transferBatchId}`,
            created > 0
                ? "success"
                : "warning"
        );
    }

    function bindEvents() {
        const bindings = [
            ["addAtsButton", "click", () =>
                addSimpleMasterData(
                    "ATS",
                    "ATSCode",
                    "newAtsCode",
                    "newAtsDescription",
                    "ATS"
                )
            ],
            ["addYNummerButton", "click", () =>
                addSimpleMasterData(
                    "YNummern",
                    "YNummerCode",
                    "newYNummerCode",
                    "newYNummerDescription",
                    "Y-Nummer"
                )
            ],
            ["addStatusValueButton", "click", addStatusValue],
            ["transferSourceAts", "change", () => {
                transferSelection.clear();
                renderTransferCandidates();
            }],
            ["transferTargetAts", "change", renderTransferCandidates],
            ["transferTargetYNumber", "change", renderTransferCandidates],
            ["transferSearch", "input", renderTransferCandidates],
            ["transferSelectedButton", "click", transferSelectedRecords],
            ["transferSelectAllButton", "click", () => {
                for (
                    const record of
                    getTransferCandidates()
                ) {
                    transferSelection.add(
                        record.DisplayId
                    );
                }
                renderTransferCandidates();
            }],
            ["transferClearSelectionButton", "click", () => {
                transferSelection.clear();
                renderTransferCandidates();
            }]
        ];

        for (
            const [id, eventName, handler]
            of bindings
        ) {
            const element =
                document.getElementById(id);
            if (element) {
                element.addEventListener(
                    eventName,
                    handler
                );
            }
        }

        for (const inputId of [
            "newAtsCode",
            "newYNummerCode",
            "newStatusName"
        ]) {
            const input =
                document.getElementById(
                    inputId
                );

            input?.addEventListener(
                "keydown",
                event => {
                    if (event.key !== "Enter") {
                        return;
                    }

                    if (
                        inputId ===
                        "newAtsCode"
                    ) {
                        addSimpleMasterData(
                            "ATS",
                            "ATSCode",
                            "newAtsCode",
                            "newAtsDescription",
                            "ATS"
                        );
                    }
                    else if (
                        inputId ===
                        "newYNummerCode"
                    ) {
                        addSimpleMasterData(
                            "YNummern",
                            "YNummerCode",
                            "newYNummerCode",
                            "newYNummerDescription",
                            "Y-Nummer"
                        );
                    }
                    else {
                        addStatusValue();
                    }
                }
            );
        }
    }

    async function initialize(
        appContext
    ) {
        context = appContext;

        if (!initialized) {
            await loadBaseData();
            localData = readLocalData();
            rebuildMergedData();
            bindEvents();
            initialized = true;
        }

        refreshUi();

        return getStats();
    }

    function notifyTrackingChanged() {
        if (!initialized) {
            return;
        }

        refreshTrackingFilters(
            context.getTrackingDisplayItems()
        );
        renderTransferCandidates();
    }

    global.TeiletrackingFeatureService =
        Object.freeze({
            initialize,
            getSelectedAts,
            getSelectedYNumber,
            getSelectedStatuses,
            setSelectedStatuses,
            resetAssignmentFields,
            createStatusChips,
            normalizeStatusArray,
            refreshTrackingFilters,
            notifyTrackingChanged,
            getStats,
            getMigrationSnapshot,
            getStatusDefinition
        });
})(window);

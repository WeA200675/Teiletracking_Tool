(function initializeOnePhotoLabelWorkflow(global) {
    "use strict";

    const state = {
        busy: false,
        photoUrl: "",
        qrText: "",
        qrVariant: "",
        ocrPasses: [],
        ocrLines: []
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function normalize(value) {
        return String(value || "")
            .trim()
            .toUpperCase();
    }

    function compact(value) {
        return normalize(value)
            .replace(/[^A-Z0-9]/g, "");
    }

    function confusionNormalized(value) {
        return compact(value)
            .replace(/O/g, "0")
            .replace(/[IL]/g, "1")
            .replace(/S/g, "5")
            .replace(/B/g, "8");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function setStatus(message, kind = "") {
        const element = byId("onePhotoStatus");

        if (!element) {
            return;
        }

        element.textContent = message || "";
        element.className = "one-photo-status";

        if (kind) {
            element.classList.add(
                `one-photo-status-${kind}`
            );
        }
    }

    function createPhotoInput() {
        let input = byId("onePhotoInput");

        if (input) {
            return input;
        }

        input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.hidden = true;
        input.id = "onePhotoInput";

        input.setAttribute(
            "capture",
            "environment"
        );

        input.addEventListener(
            "change",
            handlePhoto
        );

        document.body.appendChild(input);

        return input;
    }

    function parseQrTokens(text) {
        const raw = normalize(text);

        if (!raw) {
            return [];
        }

        const parts = raw
            .split(/[_;\n|]+/)
            .map((value) => value.trim())
            .filter(Boolean);

        const unique = [];
        const seen = new Set();

        for (const part of parts) {
            const key = normalize(part);

            if (!key || seen.has(key)) {
                continue;
            }

            seen.add(key);
            unique.push(part);
        }

        return unique;
    }

    function levenshtein(left, right) {
        const a = compact(left);
        const b = compact(right);

        if (!a) {
            return b.length;
        }

        if (!b) {
            return a.length;
        }

        const row = Array.from(
            { length: b.length + 1 },
            (_, index) => index
        );

        for (
            let i = 1;
            i <= a.length;
            i += 1
        ) {
            let previous = row[0];
            row[0] = i;

            for (
                let j = 1;
                j <= b.length;
                j += 1
            ) {
                const old = row[j];

                const cost =
                    a[i - 1] === b[j - 1]
                        ? 0
                        : 1;

                row[j] = Math.min(
                    row[j] + 1,
                    row[j - 1] + 1,
                    previous + cost
                );

                previous = old;
            }
        }

        return row[b.length];
    }

    function getLineCandidates(line) {
        const candidates = [
            normalize(line)
        ];

        const words = normalize(line)
            .split(/[^A-Z0-9._/-]+/)
            .map((value) => value.trim())
            .filter(Boolean);

        candidates.push(...words);

        return Array.from(
            new Set(candidates)
        );
    }

    const OCR_CONFUSION_GROUPS = [
        new Set(["B", "8"]),
        new Set(["O", "0", "Q"]),
        new Set(["I", "L", "1"]),
        new Set(["S", "5"]),
        new Set(["Z", "2"]),
        new Set(["G", "6"])
    ];

    function isKnownOcrConfusion(left, right) {
        const a = normalize(left);
        const b = normalize(right);

        if (
            !a ||
            !b ||
            a === b
        ) {
            return false;
        }

        return OCR_CONFUSION_GROUPS.some(
            (group) =>
                group.has(a) &&
                group.has(b)
        );
    }

    function analyzeQrCorrection(
        ocrValue,
        qrValue
    ) {
        const ocr =
            compact(ocrValue);

        const qr =
            compact(qrValue);

        if (
            !ocr ||
            !qr
        ) {
            return null;
        }

        if (ocr === qr) {
            return {
                exact: true,
                correctable: true,
                correctedValue:
                    qrValue,
                corrections: [],
                unknownDifferences: 0
            };
        }

        if (
            ocr.length !==
            qr.length
        ) {
            return null;
        }

        const corrections = [];
        let unknownDifferences = 0;

        for (
            let index = 0;
            index < qr.length;
            index += 1
        ) {
            const ocrChar =
                ocr[index];

            const qrChar =
                qr[index];

            if (
                ocrChar ===
                qrChar
            ) {
                continue;
            }

            if (
                isKnownOcrConfusion(
                    ocrChar,
                    qrChar
                )
            ) {
                corrections.push({
                    position:
                        index + 1,
                    from:
                        ocrChar,
                    to:
                        qrChar
                });

                continue;
            }

            unknownDifferences += 1;
        }

        return {
            exact: false,
            correctable:
                corrections.length > 0 &&
                unknownDifferences === 0,
            correctedValue:
                qrValue,
            corrections,
            unknownDifferences
        };
    }

    function compareLineWithQr(
        line,
        qrTokens
    ) {
        const candidates =
            getLineCandidates(line);

        let fuzzy = null;

        for (const qrToken of qrTokens) {
            const qrCompact =
                compact(qrToken);

            if (
                !qrCompact ||
                qrCompact.length < 3
            ) {
                continue;
            }

            for (const candidate of candidates) {
                const candidateCompact =
                    compact(candidate);

                if (
                    candidateCompact ===
                    qrCompact
                ) {
                    return {
                        level:
                            "CONFIRMED",
                        qrToken,
                        candidate,
                        correctedValue:
                            qrToken,
                        corrections: [],
                        reason:
                            "Durch QR/DataMatrix exakt bestätigt."
                    };
                }

                if (
                    candidateCompact.length >=
                        qrCompact.length &&
                    candidateCompact.includes(
                        qrCompact
                    )
                ) {
                    return {
                        level:
                            "CONFIRMED",
                        qrToken,
                        candidate,
                        correctedValue:
                            qrToken,
                        corrections: [],
                        reason:
                            "QR-Wert vollständig in der OCR-Zeile enthalten."
                    };
                }

                const correction =
                    analyzeQrCorrection(
                        candidate,
                        qrToken
                    );

                if (
                    correction &&
                    correction.correctable
                ) {
                    return {
                        level:
                            "QR_CORRECTED",
                        qrToken,
                        candidate,
                        correctedValue:
                            qrToken,
                        corrections:
                            correction.corrections,
                        reason:
                            "OCR-Zeichen wurden positionsgenau durch den QR/DataMatrix-Wert korrigiert."
                    };
                }
            }
        }

        for (const qrToken of qrTokens) {
            const qrCompact =
                compact(qrToken);

            if (
                qrCompact.length < 5
            ) {
                continue;
            }

            for (const candidate of candidates) {
                const candidateCompact =
                    compact(candidate);

                if (
                    Math.abs(
                        candidateCompact.length -
                        qrCompact.length
                    ) > 1
                ) {
                    continue;
                }

                const distance =
                    levenshtein(
                        candidate,
                        qrToken
                    );

                if (
                    distance <= 1 &&
                    (
                        !fuzzy ||
                        distance <
                            fuzzy.distance
                    )
                ) {
                    fuzzy = {
                        level:
                            "SIMILAR",
                        qrToken,
                        candidate,
                        correctedValue: "",
                        corrections: [],
                        distance,
                        reason:
                            "Sehr ähnlich zum QR-Wert, aber nicht automatisch korrigiert."
                    };
                }
            }
        }

        if (fuzzy) {
            return fuzzy;
        }

        return {
            level:
                "OCR_ONLY",
            qrToken: "",
            candidate: "",
            correctedValue: "",
            corrections: [],
            reason:
                "OCR-Inhalt ist nicht im QR/DataMatrix-Code enthalten."
        };
    }

    function splitOcrLines(text) {
        return String(text || "")
            .split(/\r?\n/)
            .map((value) =>
                value
                    .replace(/\s+/g, " ")
                    .trim()
            )
            .filter((value) => {
                if (!value) {
                    return false;
                }

                return /[A-Z0-9]/i.test(
                    value
                );
            });
    }

    function mergeOcrLines(passes) {
        const result = [];
        const seen = new Set();

        for (const pass of passes) {
            const lines =
                splitOcrLines(
                    pass.rawText
                );

            for (const line of lines) {
                const key =
                    normalize(line);

                if (
                    !key ||
                    seen.has(key)
                ) {
                    continue;
                }

                seen.add(key);

                result.push({
                    text: line,
                    sources: [
                        pass.variant
                    ]
                });
            }
        }

        return result;
    }

    function extractRawText(result) {
        if (!result) {
            return "";
        }

        if (
            typeof result.rawText ===
            "string"
        ) {
            return result.rawText.trim();
        }

        if (
            typeof result.text ===
            "string"
        ) {
            return result.text.trim();
        }

        if (
            result.data &&
            typeof result.data.text ===
                "string"
        ) {
            return result.data.text.trim();
        }

        return "";
    }

    async function detectCode(
        prepared
    ) {
        const scanner =
            global.TeiletrackingScannerService;

        if (
            !scanner ||
            typeof scanner.detectQr !==
                "function"
        ) {
            throw new Error(
                "QR/DataMatrix-Service ist nicht verfügbar."
            );
        }

        const variants =
            prepared.codeVariants || [];

        for (
            let index = 0;
            index < variants.length;
            index += 1
        ) {
            const variant =
                variants[index];

            setStatus(
                `QR/DataMatrix-Suche ${index + 1}/${variants.length}: ${variant.name}`,
                "working"
            );

            try {
                const context =
                    variant.canvas.getContext(
                        "2d",
                        {
                            willReadFrequently:
                                true
                        }
                    );

                const value =
                    await scanner.detectQr(
                        variant.canvas,
                        context,
                        {
                            ignoreLiveCache:
                                true
                        }
                    );

                if (value) {
                    return {
                        value:
                            String(
                                value
                            ).trim(),
                        variant:
                            variant.name
                    };
                }
            } catch (error) {
                console.warn(
                    `Code-Variante ${variant.name} fehlgeschlagen.`,
                    error
                );
            }
        }

        return {
            value: "",
            variant: ""
        };
    }

    function selectOcrVariants(
        prepared
    ) {
        const variants =
            prepared.ocrVariants || [];

        const preferredNames = [
            "original-0-gray",
            "original-90-gray",
            "original-270-gray",
            "original-0-center-crop",
            "original-90-center-crop",
            "original-270-center-crop"
        ];

        const selected = [];

        for (const name of preferredNames) {
            const found =
                variants.find(
                    (variant) =>
                        variant.name ===
                        name
                );

            if (found) {
                selected.push(found);
            }
        }

        if (!selected.length) {
            return variants.slice(
                0,
                6
            );
        }

        return selected;
    }

    async function readCompleteOcr(
        prepared
    ) {
        const ocr =
            global.TeiletrackingOcrService;

        if (
            !ocr ||
            typeof ocr.recognizeBest !==
                "function"
        ) {
            throw new Error(
                "OCR-Service ist nicht verfügbar."
            );
        }

        const variants =
            selectOcrVariants(
                prepared
            );

        const passes = [];

        for (
            let index = 0;
            index < variants.length;
            index += 1
        ) {
            const variant =
                variants[index];

            setStatus(
                `OCR ${index + 1}/${variants.length}: ${variant.name}`,
                "working"
            );

            try {
                const result =
                    await ocr.recognizeBest(
                        variant.canvas,
                        {},
                        {
                            onProgress:
                                (progress) => {
                                    if (
                                        progress &&
                                        progress.status
                                    ) {
                                        setStatus(
                                            `OCR ${index + 1}/${variants.length}: ${progress.status}`,
                                            "working"
                                        );
                                    }
                                }
                        }
                    );

                const rawText =
                    extractRawText(
                        result
                    );

                if (rawText) {
                    passes.push({
                        variant:
                            variant.name,
                        confidence:
                            Number(
                                result.confidence ||
                                0
                            ),
                        rawText
                    });
                }
            } catch (error) {
                console.warn(
                    `OCR-Pass ${variant.name} fehlgeschlagen.`,
                    error
                );
            }
        }

        if (!passes.length) {
            throw new Error(
                "Aus dem Foto konnte kein OCR-Text gelesen werden."
            );
        }

        return passes;
    }

    function evaluateLines(
        lines,
        qrTokens
    ) {
        return lines.map((line) => {
            const comparison =
                compareLineWithQr(
                    line.text,
                    qrTokens
                );

            return {
                ...line,
                ...comparison
            };
        });
    }

    function evaluateQrTokens(
        qrTokens,
        ocrLines
    ) {
        return qrTokens.map(
            (qrToken) => {
                let best = null;

                for (const line of ocrLines) {
                    const comparison =
                        compareLineWithQr(
                            line.text,
                            [qrToken]
                        );

                    if (
                        comparison.level ===
                        "CONFIRMED"
                    ) {
                        return {
                            token:
                                qrToken,
                            level:
                                "CONFIRMED",
                            ocrLine:
                                line.text,
                            correctedValue:
                                qrToken,
                            corrections: []
                        };
                    }

                    if (
                        comparison.level ===
                        "QR_CORRECTED"
                    ) {
                        return {
                            token:
                                qrToken,
                            level:
                                "QR_CORRECTED",
                            ocrLine:
                                line.text,
                            correctedValue:
                                qrToken,
                            corrections:
                                comparison.corrections || []
                        };
                    }

                    if (
                        comparison.level ===
                            "SIMILAR" &&
                        !best
                    ) {
                        best = {
                            token:
                                qrToken,
                            level:
                                "SIMILAR",
                            ocrLine:
                                line.text,
                            correctedValue: "",
                            corrections: []
                        };
                    }
                }

                return (
                    best || {
                        token:
                            qrToken,
                        level:
                            "NOT_FOUND",
                        ocrLine: "",
                        correctedValue: "",
                        corrections: []
                    }
                );
            }
        );
    }

    function badgeText(level) {
        switch (level) {
            case "CONFIRMED":
                return "✓ QR bestätigt";

            case "QR_CORRECTED":
                return "✓ durch QR korrigiert";

            case "SIMILAR":
                return "? ähnlich";

            case "OCR_ONLY":
                return "○ nur OCR";

            case "NOT_FOUND":
                return "– nicht erkannt";

            default:
                return level;
        }
    }

    function badgeClass(level) {
        switch (level) {
            case "CONFIRMED":
                return "confirmed";

            case "QR_CORRECTED":
                return "corrected";

            case "SIMILAR":
                return "similar";

            case "NOT_FOUND":
                return "missing";

            default:
                return "ocr-only";
        }
    }

    function renderResults() {
        const qrTokens =
            parseQrTokens(
                state.qrText
            );

        const evaluated =
            evaluateLines(
                state.ocrLines,
                qrTokens
            );

        const qrEvaluation =
            evaluateQrTokens(
                qrTokens,
                state.ocrLines
            );

        const qrRaw =
            byId("onePhotoQrRaw");

        const qrVariant =
            byId(
                "onePhotoQrVariant"
            );

        const ocrBody =
            byId(
                "onePhotoOcrLines"
            );

        const qrBody =
            byId(
                "onePhotoQrTokens"
            );

        const raw =
            byId(
                "onePhotoRawOcr"
            );

        const summary =
            byId(
                "onePhotoSummary"
            );

        if (qrRaw) {
            qrRaw.textContent =
                state.qrText ||
                "Kein QR/DataMatrix erkannt";
        }

        if (qrVariant) {
            qrVariant.textContent =
                state.qrVariant || "–";
        }

        if (ocrBody) {
            ocrBody.innerHTML =
                evaluated
                    .map((line) => `
                        <div class="one-photo-line">
                            <div class="one-photo-line-text">
                                ${escapeHtml(line.text)}
                            </div>

                            <div>
                                <span class="one-photo-badge ${badgeClass(line.level)}">
                                    ${escapeHtml(badgeText(line.level))}
                                </span>

                                ${
                                    line.qrToken
                                        ? `
                                            <small>
                                                QR: ${escapeHtml(line.qrToken)}
                                            </small>
                                          `
                                        : ""
                                }

                                ${
                                    line.level === "QR_CORRECTED"
                                        ? `
                                            <small>
                                                Korrigiert: <strong>${escapeHtml(line.correctedValue)}</strong>
                                            </small>
                                            <small>
                                                ${escapeHtml(
                                                    (line.corrections || [])
                                                        .map(
                                                            (item) =>
                                                                `${item.from}→${item.to} an Position ${item.position}`
                                                        )
                                                        .join(", ")
                                                )}
                                            </small>
                                          `
                                        : ""
                                }
                            </div>
                        </div>
                    `)
                    .join("");
        }

        if (qrBody) {
            if (!qrEvaluation.length) {
                qrBody.innerHTML = `
                    <p class="hint">
                        Kein QR/DataMatrix-Code erkannt.
                        OCR-Inhalte bleiben trotzdem erhalten.
                    </p>
                `;
            } else {
                qrBody.innerHTML =
                    qrEvaluation
                        .map((item) => `
                            <div class="one-photo-token-row">
                                <code>${escapeHtml(item.token)}</code>

                                <span class="one-photo-badge ${badgeClass(item.level)}">
                                    ${escapeHtml(badgeText(item.level))}
                                </span>

                                ${
                                    item.ocrLine
                                        ? `
                                            <small>
                                                OCR roh: ${escapeHtml(item.ocrLine)}
                                            </small>
                                          `
                                        : ""
                                }

                                ${
                                    item.level === "QR_CORRECTED"
                                        ? `
                                            <small>
                                                QR-Korrektur: <strong>${escapeHtml(item.correctedValue)}</strong>
                                            </small>
                                          `
                                        : ""
                                }
                            </div>
                        `)
                        .join("");
            }
        }

        if (raw) {
            raw.textContent =
                state.ocrPasses
                    .map(
                        (pass) =>
                            `--- ${pass.variant} ---\n${pass.rawText}`
                    )
                    .join(
                        "\n\n"
                    );
        }

        const confirmed =
            evaluated.filter(
                (line) =>
                    line.level ===
                    "CONFIRMED"
            ).length;

        const corrected =
            evaluated.filter(
                (line) =>
                    line.level ===
                    "QR_CORRECTED"
            ).length;

        const similar =
            evaluated.filter(
                (line) =>
                    line.level ===
                    "SIMILAR"
            ).length;

        const ocrOnly =
            evaluated.filter(
                (line) =>
                    line.level ===
                    "OCR_ONLY"
            ).length;

        if (summary) {
            summary.textContent =
                `${evaluated.length} OCR-Zeilen · ${confirmed} exakt bestätigt · ${corrected} durch QR korrigiert · ${similar} ähnlich · ${ocrOnly} nur im Drucktext`;
        }

        const correctedLabelText =
            evaluated
                .map(
                    (line) =>
                        line.level === "QR_CORRECTED"
                            ? line.correctedValue
                            : line.text
                )
                .join("\n");

        const labelInput =
            byId("labelInput");

        const qrInput =
            byId("qrInput");

        if (labelInput) {
            labelInput.value =
                correctedLabelText;

            labelInput.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles: true
                    }
                )
            );
        }

        if (
            qrInput &&
            state.qrText
        ) {
            qrInput.value =
                state.qrText;

            qrInput.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles: true
                    }
                )
            );
        }

        const panel =
            byId(
                "onePhotoResults"
            );

        if (panel) {
            panel.hidden = false;
        }
    }

    function showPreview(file) {
        if (state.photoUrl) {
            URL.revokeObjectURL(
                state.photoUrl
            );
        }

        state.photoUrl =
            URL.createObjectURL(file);

        const image =
            byId(
                "onePhotoPreviewImage"
            );

        const panel =
            byId(
                "onePhotoPreview"
            );

        const info =
            byId(
                "onePhotoPreviewInfo"
            );

        if (image) {
            image.src =
                state.photoUrl;
        }

        if (info) {
            info.textContent =
                `${file.name || "Smartphone-Foto"} · ${Math.round(file.size / 1024)} KB`;
        }

        if (panel) {
            panel.hidden = false;
        }
    }

    async function handlePhoto(event) {
        const input =
            event.currentTarget;

        const file =
            input.files &&
            input.files[0];

        if (!file) {
            return;
        }

        if (state.busy) {
            return;
        }

        state.busy = true;

        try {
            const vision =
                global.TeiletrackingVisionPreprocessor;

            if (
                !vision ||
                typeof vision.prepareFile !==
                    "function"
            ) {
                throw new Error(
                    "Vision-Preprocessor ist nicht geladen."
                );
            }

            showPreview(file);

            setStatus(
                "Foto wird für QR/DataMatrix und OCR aufbereitet …",
                "working"
            );

            const prepared =
                await vision.prepareFile(
                    file
                );

            const code =
                await detectCode(
                    prepared
                );

            state.qrText =
                code.value;

            state.qrVariant =
                code.variant;

            if (code.value) {
                setStatus(
                    "QR/DataMatrix erkannt. Vollständige OCR läuft …",
                    "working"
                );
            } else {
                setStatus(
                    "Kein QR/DataMatrix erkannt. OCR läuft trotzdem vollständig weiter …",
                    "warning"
                );
            }

            state.ocrPasses =
                await readCompleteOcr(
                    prepared
                );

            state.ocrLines =
                mergeOcrLines(
                    state.ocrPasses
                );

            renderResults();

            setStatus(
                state.qrText
                    ? "Auswertung abgeschlossen: OCR-Inhalte wurden gelesen und mit QR/DataMatrix verglichen."
                    : "OCR abgeschlossen. Kein QR/DataMatrix erkannt; alle OCR-Inhalte bleiben erhalten.",
                state.qrText
                    ? "success"
                    : "warning"
            );
        } catch (error) {
            console.error(error);

            setStatus(
                error?.message ||
                    "Fotoauswertung fehlgeschlagen.",
                "error"
            );
        } finally {
            state.busy = false;
            input.value = "";
        }
    }

    function takePhoto() {
        if (state.busy) {
            return;
        }

        const input =
            createPhotoInput();

        input.click();
    }

    function reset() {
        state.qrText = "";
        state.qrVariant = "";
        state.ocrPasses = [];
        state.ocrLines = [];

        if (state.photoUrl) {
            URL.revokeObjectURL(
                state.photoUrl
            );

            state.photoUrl = "";
        }

        const preview =
            byId(
                "onePhotoPreview"
            );

        const results =
            byId(
                "onePhotoResults"
            );

        if (preview) {
            preview.hidden = true;
        }

        if (results) {
            results.hidden = true;
        }

        setStatus(
            "Bereit für neues Label-Foto."
        );
    }

    function installUi() {
        const old =
            byId(
                "twoStageLabelWorkflow"
            );

        if (old) {
            old.remove();
        }

        if (
            byId(
                "onePhotoLabelWorkflow"
            )
        ) {
            return;
        }

        const qrInput =
            byId("qrInput");

        if (!qrInput) {
            return;
        }

        const container =
            document.createElement(
                "section"
            );

        container.id =
            "onePhotoLabelWorkflow";

        container.className =
            "one-photo-workflow";

        container.innerHTML = `
            <div class="one-photo-header">
                <div>
                    <strong>Intelligente Label-Erfassung</strong>

                    <p>
                        Ein Foto reicht: Das Bild wird automatisch aufbereitet,
                        vollständig per OCR gelesen und QR/DataMatrix dient zur Verifikation.
                    </p>
                </div>

                <button
                    id="onePhotoCaptureButton"
                    type="button"
                    class="button primary"
                >
                    Label fotografieren
                </button>
            </div>

            <div
                id="onePhotoPreview"
                class="one-photo-preview"
                hidden
            >
                <img
                    id="onePhotoPreviewImage"
                    alt="Aufgenommenes Label"
                >

                <p
                    id="onePhotoPreviewInfo"
                    class="hint"
                ></p>
            </div>

            <p
                id="onePhotoStatus"
                class="one-photo-status"
                aria-live="polite"
            >
                Bereit für neues Label-Foto.
            </p>

            <section
                id="onePhotoResults"
                class="one-photo-results"
                hidden
            >
                <div class="one-photo-summary">
                    <strong>Auswertung</strong>

                    <span id="onePhotoSummary"></span>
                </div>

                <div class="one-photo-section">
                    <h3>Vollständiger OCR-Inhalt</h3>

                    <p class="hint">
                        Inhalte bleiben erhalten, auch wenn sie nicht im QR/DataMatrix-Code vorkommen.
                    </p>

                    <div id="onePhotoOcrLines"></div>
                </div>

                <div class="one-photo-section">
                    <h3>QR / DataMatrix-Verifikation</h3>

                    <p>
                        <strong>Code:</strong>
                        <code id="onePhotoQrRaw">–</code>
                    </p>

                    <p class="hint">
                        Bildvariante:
                        <span id="onePhotoQrVariant">–</span>
                    </p>

                    <div id="onePhotoQrTokens"></div>
                </div>

                <details class="one-photo-section">
                    <summary>
                        OCR-Rohdaten aller Durchläufe
                    </summary>

                    <pre id="onePhotoRawOcr"></pre>
                </details>

                <button
                    id="onePhotoResetButton"
                    type="button"
                    class="button secondary"
                >
                    Neues Label erfassen
                </button>
            </section>
        `;

        const qrField =
            qrInput.closest(
                ".field"
            );

        if (
            qrField &&
            qrField.parentNode
        ) {
            qrField.parentNode.insertBefore(
                container,
                qrField.nextSibling
            );
        } else {
            qrInput.parentNode.appendChild(
                container
            );
        }

        byId(
            "onePhotoCaptureButton"
        ).addEventListener(
            "click",
            takePhoto
        );

        byId(
            "onePhotoResetButton"
        ).addEventListener(
            "click",
            reset
        );
    }

    function installStyles() {
        if (
            byId(
                "onePhotoWorkflowStyles"
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "onePhotoWorkflowStyles";

        style.textContent = `
            .one-photo-workflow {
                margin-top: 1rem;
                padding: 1rem;
                border: 1px solid rgba(127,127,127,.25);
                border-radius: .8rem;
                background: rgba(127,127,127,.05);
            }

            .one-photo-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 1rem;
            }

            .one-photo-header p {
                margin: .35rem 0 0;
            }

            .one-photo-preview {
                margin-top: 1rem;
            }

            .one-photo-preview img {
                display: block;
                width: 100%;
                max-height: 24rem;
                object-fit: contain;
                border-radius: .6rem;
                background: #111;
            }

            .one-photo-status {
                margin: 1rem 0 0;
                padding: .7rem;
                border-radius: .5rem;
                background: rgba(127,127,127,.08);
            }

            .one-photo-status-working {
                background: rgba(0,110,220,.12);
            }

            .one-photo-status-success {
                background: rgba(0,150,80,.14);
            }

            .one-photo-status-warning {
                background: rgba(220,150,0,.16);
            }

            .one-photo-status-error {
                background: rgba(220,0,0,.14);
            }

            .one-photo-results {
                margin-top: 1rem;
            }

            .one-photo-summary {
                display: flex;
                justify-content: space-between;
                gap: 1rem;
                padding: .8rem;
                border-radius: .6rem;
                background: rgba(127,127,127,.08);
            }

            .one-photo-section {
                margin-top: 1rem;
                padding: .8rem;
                border: 1px solid rgba(127,127,127,.2);
                border-radius: .6rem;
            }

            .one-photo-line,
            .one-photo-token-row {
                display: grid;
                grid-template-columns:
                    minmax(0,1fr)
                    minmax(9rem,.45fr);
                gap: .7rem;
                align-items: center;
                padding: .6rem;
                margin-top: .4rem;
                border-radius: .5rem;
                background: rgba(127,127,127,.06);
            }

            .one-photo-line-text {
                font-family: ui-monospace,
                    SFMono-Regular,
                    Menlo,
                    Consolas,
                    monospace;
                font-weight: 600;
                overflow-wrap: anywhere;
            }

            .one-photo-badge {
                display: inline-block;
                padding: .25rem .5rem;
                border-radius: 999px;
                font-size: .8rem;
                font-weight: 700;
                white-space: nowrap;
            }

            .one-photo-badge.confirmed {
                background: rgba(0,150,80,.18);
                outline: 1px solid rgba(0,150,80,.5);
            }

            .one-photo-badge.corrected {
                background: rgba(0,150,80,.18);
                outline: 2px solid rgba(0,150,80,.65);
            }

            .one-photo-badge.similar {
                background: rgba(225,155,0,.2);
                outline: 1px solid rgba(200,135,0,.5);
            }

            .one-photo-badge.ocr-only {
                background: rgba(0,110,220,.12);
                outline: 1px solid rgba(0,110,220,.28);
            }

            .one-photo-badge.missing {
                background: rgba(220,0,0,.14);
                outline: 1px solid rgba(220,0,0,.35);
            }

            .one-photo-line small,
            .one-photo-token-row small {
                display: block;
                margin-top: .3rem;
                opacity: .75;
                overflow-wrap: anywhere;
            }

            #onePhotoQrRaw {
                overflow-wrap: anywhere;
            }

            #onePhotoRawOcr {
                max-height: 24rem;
                overflow: auto;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }

            @media (max-width: 720px) {
                .one-photo-header {
                    display: grid;
                    grid-template-columns: 1fr;
                }

                .one-photo-header .button {
                    width: 100%;
                }

                .one-photo-summary {
                    display: grid;
                }

                .one-photo-line,
                .one-photo-token-row {
                    grid-template-columns: 1fr;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function install() {
        installStyles();
        installUi();
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            install
        );
    } else {
        install();
    }

    global.TeiletrackingOnePhotoLabelWorkflow =
        Object.freeze({
            reset,
            parseQrTokens,
            compareLineWithQr
        });
})(
    typeof window !== "undefined"
        ? window
        : globalThis
);

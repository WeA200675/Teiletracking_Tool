(function initializeTwoStageLabelWorkflow(global) {
    "use strict";

    const state = {
        qrText: "",
        qrReference: {
            date: "",
            partNumber: "",
            serialNumber: ""
        },
        photoObjectUrl: "",
        busy: false
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

    function normalizeCommonOcrConfusions(value) {
        return compact(value)
            .replace(/O/g, "0")
            .replace(/[IL]/g, "1")
            .replace(/S/g, "5")
            .replace(/B/g, "8");
    }

    function setStatus(message, kind) {
        const element = byId("twoStageWorkflowStatus");

        if (!element) {
            return;
        }

        element.textContent = message || "";
        element.className = "two-stage-status";

        if (kind) {
            element.classList.add(`two-stage-status-${kind}`);
        }
    }

    function parseQrReference(text) {
        const value = normalize(text);

        const result = {
            raw: value,
            date: "",
            partNumber: "",
            serialNumber: ""
        };

        if (!value) {
            return result;
        }

        const tokens = value
            .split("_")
            .map((item) => item.trim())
            .filter(Boolean);

        if (tokens.length >= 3) {
            if (/^\d{2}\.\d{2}\.\d{4}$/.test(tokens[0])) {
                result.date = tokens[0];
            }

            result.partNumber = tokens[1] || "";
            result.serialNumber = tokens[2] || "";
        }

        return result;
    }

    function updateQrReferenceUi() {
        const raw = byId("twoStageQrRaw");
        const pn = byId("twoStageQrPartNumber");
        const sn = byId("twoStageQrSerialNumber");

        if (raw) {
            raw.textContent = state.qrText || "–";
        }

        if (pn) {
            pn.textContent = state.qrReference.partNumber || "–";
        }

        if (sn) {
            sn.textContent = state.qrReference.serialNumber || "–";
        }
    }

    function setQrValue(text) {
        state.qrText = String(text || "").trim();
        state.qrReference = parseQrReference(state.qrText);

        const qrInput = byId("qrInput");

        if (qrInput) {
            qrInput.value = state.qrText;

            qrInput.dispatchEvent(
                new Event("input", {
                    bubbles: true
                })
            );
        }

        updateQrReferenceUi();
        updateVerificationReferenceUi();
    }

    function readQrFromExistingField() {
        const qrInput = byId("qrInput");

        return qrInput
            ? String(qrInput.value || "").trim()
            : "";
    }

    function triggerExistingQrScanner() {
        const button = byId("openQrScannerButton");

        if (!button) {
            throw new Error(
                "Der vorhandene QR-/DataMatrix-Scanner wurde nicht gefunden."
            );
        }

        button.click();
    }

    async function waitForQrResult(timeoutMs) {
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            const value = readQrFromExistingField();

            if (value) {
                return value;
            }

            const scanner = global.TeiletrackingScannerService;

            if (
                scanner &&
                typeof scanner.getLiveQrText === "function"
            ) {
                const live = String(
                    scanner.getLiveQrText() || ""
                ).trim();

                if (live) {
                    return live;
                }
            }

            await new Promise((resolve) => {
                setTimeout(resolve, 250);
            });
        }

        return "";
    }

    async function scanQrOnly() {
        if (state.busy) {
            return;
        }

        state.busy = true;

        const button = byId("twoStageScanQrButton");

        if (button) {
            button.disabled = true;
        }

        try {
            setStatus(
                "QR / DataMatrix wird gelesen …",
                "working"
            );

            const existing = readQrFromExistingField();

            if (existing) {
                setQrValue(existing);

                setStatus(
                    "Vorhandener QR-Wert übernommen. Jetzt Textfoto aufnehmen.",
                    "success"
                );

                return;
            }

            triggerExistingQrScanner();

            const result = await waitForQrResult(30000);

            if (!result) {
                setStatus(
                    "Kein QR / DataMatrix erkannt. Bitte erneut versuchen.",
                    "warning"
                );

                return;
            }

            setQrValue(result);

            setStatus(
                "QR / DataMatrix erkannt. Jetzt nur den gedruckten Text fotografieren.",
                "success"
            );
        } catch (error) {
            console.error(error);

            setStatus(
                error?.message || "QR-Scan fehlgeschlagen.",
                "error"
            );
        } finally {
            state.busy = false;

            if (button) {
                button.disabled = false;
            }
        }
    }

    function createNativePhotoInput() {
        let input = byId("twoStageNativePhotoInput");

        if (input) {
            return input;
        }

        input = document.createElement("input");

        input.id = "twoStageNativePhotoInput";
        input.type = "file";
        input.accept = "image/*";
        input.hidden = true;

        input.setAttribute(
            "capture",
            "environment"
        );

        input.addEventListener(
            "change",
            handleNativePhoto
        );

        document.body.appendChild(input);

        return input;
    }

    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();

            image.onload = function onLoad() {
                resolve({
                    image,
                    url
                });
            };

            image.onerror = function onError() {
                URL.revokeObjectURL(url);

                reject(
                    new Error(
                        "Das Textfoto konnte nicht geladen werden."
                    )
                );
            };

            image.src = url;
        });
    }

    function drawImageToCanvas(image) {
        const maxSide = 2600;

        let width =
            image.naturalWidth ||
            image.width;

        let height =
            image.naturalHeight ||
            image.height;

        const scale = Math.min(
            1,
            maxSide / Math.max(width, height)
        );

        width = Math.max(
            1,
            Math.round(width * scale)
        );

        height = Math.max(
            1,
            Math.round(height * scale)
        );

        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext(
            "2d",
            {
                alpha: false,
                willReadFrequently: true
            }
        );

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        return canvas;
    }

    function rotateCanvas(source, degrees) {
        const normalized =
            ((degrees % 360) + 360) % 360;

        if (normalized === 0) {
            return source;
        }

        const swap =
            normalized === 90 ||
            normalized === 270;

        const canvas =
            document.createElement("canvas");

        canvas.width =
            swap
                ? source.height
                : source.width;

        canvas.height =
            swap
                ? source.width
                : source.height;

        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: false,
                    willReadFrequently: true
                }
            );

        context.translate(
            canvas.width / 2,
            canvas.height / 2
        );

        context.rotate(
            normalized *
                Math.PI /
                180
        );

        context.drawImage(
            source,
            -source.width / 2,
            -source.height / 2
        );

        return canvas;
    }

    function cropCanvas(
        source,
        xRatio,
        yRatio,
        widthRatio,
        heightRatio
    ) {
        const sx = Math.round(
            source.width * xRatio
        );

        const sy = Math.round(
            source.height * yRatio
        );

        const sw = Math.max(
            1,
            Math.round(
                source.width * widthRatio
            )
        );

        const sh = Math.max(
            1,
            Math.round(
                source.height * heightRatio
            )
        );

        const canvas =
            document.createElement("canvas");

        canvas.width = sw;
        canvas.height = sh;

        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: false,
                    willReadFrequently: true
                }
            );

        context.drawImage(
            source,
            sx,
            sy,
            sw,
            sh,
            0,
            0,
            sw,
            sh
        );

        return canvas;
    }

    function grayscaleContrastCanvas(
        source,
        contrastFactor
    ) {
        const canvas =
            document.createElement("canvas");

        canvas.width = source.width;
        canvas.height = source.height;

        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: false,
                    willReadFrequently: true
                }
            );

        context.drawImage(
            source,
            0,
            0
        );

        const imageData =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

        const data =
            imageData.data;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const gray =
                Math.round(
                    0.299 * data[index] +
                    0.587 * data[index + 1] +
                    0.114 * data[index + 2]
                );

            const adjusted =
                Math.max(
                    0,
                    Math.min(
                        255,
                        Math.round(
                            128 +
                            (gray - 128) *
                                contrastFactor
                        )
                    )
                );

            data[index] = adjusted;
            data[index + 1] = adjusted;
            data[index + 2] = adjusted;
        }

        context.putImageData(
            imageData,
            0,
            0
        );

        return canvas;
    }

    function thresholdCanvas(
        source,
        threshold
    ) {
        const canvas =
            document.createElement("canvas");

        canvas.width = source.width;
        canvas.height = source.height;

        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: false,
                    willReadFrequently: true
                }
            );

        context.drawImage(
            source,
            0,
            0
        );

        const imageData =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

        const data =
            imageData.data;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const gray =
                0.299 * data[index] +
                0.587 * data[index + 1] +
                0.114 * data[index + 2];

            const value =
                gray >= threshold
                    ? 255
                    : 0;

            data[index] = value;
            data[index + 1] = value;
            data[index + 2] = value;
        }

        context.putImageData(
            imageData,
            0,
            0
        );

        return canvas;
    }

    function buildVerificationVariants(source) {
        const rotations = [
            {
                name: "0°",
                canvas: rotateCanvas(source, 0)
            },
            {
                name: "90°",
                canvas: rotateCanvas(source, 90)
            },
            {
                name: "180°",
                canvas: rotateCanvas(source, 180)
            },
            {
                name: "270°",
                canvas: rotateCanvas(source, 270)
            }
        ];

        const variants = [];

        rotations.forEach((rotation) => {
            variants.push({
                name: `Original ${rotation.name}`,
                canvas: rotation.canvas
            });

            const textCrop =
                cropCanvas(
                    rotation.canvas,
                    0.10,
                    0.05,
                    0.85,
                    0.90
                );

            variants.push({
                name: `Text-Crop ${rotation.name}`,
                canvas:
                    grayscaleContrastCanvas(
                        textCrop,
                        1.7
                    )
            });
        });

        const baseGray =
            grayscaleContrastCanvas(
                source,
                1.8
            );

        variants.push({
            name: "Kontrast",
            canvas: baseGray
        });

        variants.push({
            name: "Schwarz/Weiß",
            canvas: thresholdCanvas(
                baseGray,
                155
            )
        });

        return variants;
    }

    function extractOcrText(result) {
        if (!result) {
            return "";
        }

        const candidates = [
            result.text,
            result.rawText,
            result.ocrText,
            result.bestText
        ];

        for (const candidate of candidates) {
            if (
                typeof candidate ===
                    "string" &&
                candidate.trim()
            ) {
                return candidate.trim();
            }
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

    function tokenize(text) {
        return normalize(text)
            .split(
                /[^A-Z0-9._/-]+/
            )
            .map((value) => value.trim())
            .filter(Boolean);
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
            {
                length: b.length + 1
            },
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
                    a[i - 1] ===
                    b[j - 1]
                        ? 0
                        : 1;

                row[j] =
                    Math.min(
                        row[j] + 1,
                        row[j - 1] + 1,
                        previous + cost
                    );

                previous = old;
            }
        }

        return row[b.length];
    }

    function verifyReference(
        reference,
        ocrText
    ) {
        const wanted =
            normalize(reference);

        if (!wanted) {
            return {
                level: "UNKNOWN",
                matchedValue: "",
                reason:
                    "Kein Referenzwert im QR-Code."
            };
        }

        const wantedCompact =
            compact(wanted);

        const wantedConfusion =
            normalizeCommonOcrConfusions(
                wanted
            );

        const tokens =
            tokenize(ocrText);

        for (const token of tokens) {
            if (
                compact(token) ===
                wantedCompact
            ) {
                return {
                    level: "GREEN",
                    matchedValue: token,
                    reason:
                        "Exakt im Drucktext erkannt."
                };
            }
        }

        for (const token of tokens) {
            if (
                normalizeCommonOcrConfusions(
                    token
                ) ===
                wantedConfusion
            ) {
                return {
                    level: "GREEN",
                    matchedValue: token,
                    reason:
                        "Mit typischer OCR-Zeichenverwechslung eindeutig bestätigt."
                };
            }
        }

        let bestToken = "";
        let bestDistance =
            Number.POSITIVE_INFINITY;

        for (const token of tokens) {
            const tokenCompact =
                compact(token);

            if (
                Math.abs(
                    tokenCompact.length -
                    wantedCompact.length
                ) > 2
            ) {
                continue;
            }

            const distance =
                levenshtein(
                    wanted,
                    token
                );

            if (
                distance <
                bestDistance
            ) {
                bestDistance =
                    distance;

                bestToken =
                    token;
            }
        }

        if (
            bestToken &&
            bestDistance <= 1
        ) {
            return {
                level: "YELLOW",
                matchedValue: bestToken,
                reason:
                    "Sehr ähnlich erkannt, aber nicht eindeutig."
            };
        }

        if (
            bestToken &&
            bestDistance === 2 &&
            wantedCompact.length >= 8
        ) {
            return {
                level: "YELLOW",
                matchedValue: bestToken,
                reason:
                    "Ähnlicher OCR-Wert gefunden. Manuelle Sichtprüfung empfohlen."
            };
        }

        return {
            level: "RED",
            matchedValue:
                bestToken,
            reason:
                "QR-Referenz konnte im Drucktext nicht sicher gefunden werden."
        };
    }

    function scoreVerification(
        pn,
        sn
    ) {
        const scoreMap = {
            GREEN: 100,
            YELLOW: 40,
            RED: 0,
            UNKNOWN: 0
        };

        return (
            (scoreMap[pn.level] || 0) +
            (scoreMap[sn.level] || 0)
        );
    }

    async function runVerificationOcr(
        sourceCanvas
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
            buildVerificationVariants(
                sourceCanvas
            );

        let best = null;
        let combinedRawText = [];

        for (
            let index = 0;
            index < variants.length;
            index += 1
        ) {
            const variant =
                variants[index];

            setStatus(
                `Verifikations-OCR: ${variant.name} (${index + 1}/${variants.length})`,
                "working"
            );

            try {
                const result =
                    await ocr.recognizeBest(
                        variant.canvas
                    );

                const text =
                    extractOcrText(
                        result
                    );

                if (text) {
                    combinedRawText.push(
                        `--- ${variant.name} ---\n${text}`
                    );
                }

                const pn =
                    verifyReference(
                        state.qrReference
                            .partNumber,
                        text
                    );

                const sn =
                    verifyReference(
                        state.qrReference
                            .serialNumber,
                        text
                    );

                const score =
                    scoreVerification(
                        pn,
                        sn
                    );

                if (
                    !best ||
                    score > best.score
                ) {
                    best = {
                        name:
                            variant.name,
                        text,
                        pn,
                        sn,
                        score
                    };
                }

                if (
                    pn.level === "GREEN" &&
                    sn.level === "GREEN"
                ) {
                    break;
                }
            } catch (error) {
                console.warn(
                    `OCR-Variante ${variant.name} fehlgeschlagen.`,
                    error
                );
            }
        }

        if (!best) {
            throw new Error(
                "Keine OCR-Variante konnte ausgewertet werden."
            );
        }

        best.allRawText =
            combinedRawText.join(
                "\n\n"
            );

        return best;
    }

    function overallLevel(result) {
        const levels = [
            result.pn.level,
            result.sn.level
        ];

        if (
            levels.every(
                (level) =>
                    level === "GREEN"
            )
        ) {
            return "GREEN";
        }

        if (
            levels.includes("RED")
        ) {
            return "RED";
        }

        return "YELLOW";
    }

    function levelLabel(level) {
        switch (level) {
            case "GREEN":
                return "GRÜN";
            case "YELLOW":
                return "GELB";
            case "RED":
                return "ROT";
            default:
                return "UNBEKANNT";
        }
    }

    function updateVerificationReferenceUi() {
        const pn =
            byId(
                "verificationReferencePartNumber"
            );

        const sn =
            byId(
                "verificationReferenceSerialNumber"
            );

        if (pn) {
            pn.textContent =
                state.qrReference
                    .partNumber ||
                "–";
        }

        if (sn) {
            sn.textContent =
                state.qrReference
                    .serialNumber ||
                "–";
        }
    }

    function updateVerificationRow(
        prefix,
        reference,
        result
    ) {
        const referenceElement =
            byId(
                `${prefix}Reference`
            );

        const detectedElement =
            byId(
                `${prefix}Detected`
            );

        const statusElement =
            byId(
                `${prefix}Status`
            );

        const reasonElement =
            byId(
                `${prefix}Reason`
            );

        if (referenceElement) {
            referenceElement.textContent =
                reference || "–";
        }

        if (detectedElement) {
            detectedElement.textContent =
                result.matchedValue ||
                "–";
        }

        if (statusElement) {
            statusElement.textContent =
                levelLabel(
                    result.level
                );

            statusElement.className =
                `verification-badge verification-${result.level.toLowerCase()}`;
        }

        if (reasonElement) {
            reasonElement.textContent =
                result.reason || "";
        }
    }

    function applyVerificationResult(
        result
    ) {
        const overall =
            overallLevel(result);

        updateVerificationRow(
            "verificationPn",
            state.qrReference
                .partNumber,
            result.pn
        );

        updateVerificationRow(
            "verificationSn",
            state.qrReference
                .serialNumber,
            result.sn
        );

        const overallBadge =
            byId(
                "verificationOverallStatus"
            );

        const variant =
            byId(
                "verificationVariant"
            );

        const raw =
            byId(
                "verificationRawText"
            );

        if (overallBadge) {
            overallBadge.textContent =
                levelLabel(overall);

            overallBadge.className =
                `verification-badge verification-${overall.toLowerCase()}`;
        }

        if (variant) {
            variant.textContent =
                result.name || "–";
        }

        if (raw) {
            raw.textContent =
                result.allRawText ||
                result.text ||
                "";
        }

        const panel =
            byId(
                "verificationResultPanel"
            );

        if (panel) {
            panel.hidden = false;
        }

        if (overall === "GREEN") {
            setStatus(
                "GRÜN: PN und SN wurden im gedruckten Text bestätigt.",
                "success"
            );
        } else if (
            overall === "YELLOW"
        ) {
            setStatus(
                "GELB: OCR ist ähnlich, aber mindestens ein Wert muss kurz geprüft werden.",
                "warning"
            );
        } else {
            setStatus(
                "ROT: Mindestens ein QR-Wert konnte im gedruckten Text nicht bestätigt werden.",
                "error"
            );
        }
    }

    function updatePhotoPreview(
        file,
        url
    ) {
        const preview =
            byId(
                "capturedLabelPreview"
            );

        const image =
            byId(
                "capturedLabelImage"
            );

        const info =
            byId(
                "capturedLabelInfo"
            );

        if (preview) {
            preview.classList.remove(
                "hidden"
            );
        }

        if (image) {
            image.src = url;
        }

        if (info) {
            info.textContent =
                `Separates Textfoto · ${Math.round(file.size / 1024)} KB`;
        }
    }

    async function handleNativePhoto(
        event
    ) {
        const input =
            event.currentTarget;

        const file =
            input.files &&
            input.files[0];

        if (!file) {
            return;
        }

        state.busy = true;

        try {
            if (
                state.photoObjectUrl
            ) {
                URL.revokeObjectURL(
                    state.photoObjectUrl
                );

                state.photoObjectUrl =
                    "";
            }

            setStatus(
                "Textfoto wird vorbereitet …",
                "working"
            );

            const loaded =
                await loadImageFromFile(
                    file
                );

            state.photoObjectUrl =
                loaded.url;

            updatePhotoPreview(
                file,
                loaded.url
            );

            const canvas =
                drawImageToCanvas(
                    loaded.image
                );

            const verification =
                await runVerificationOcr(
                    canvas
                );

            applyVerificationResult(
                verification
            );
        } catch (error) {
            console.error(error);

            setStatus(
                error?.message ||
                    "Verifikations-OCR fehlgeschlagen.",
                "error"
            );
        } finally {
            state.busy = false;
            input.value = "";
        }
    }

    function takeTextPhoto() {
        if (!state.qrText) {
            const existing =
                readQrFromExistingField();

            if (existing) {
                setQrValue(existing);
            }
        }

        if (!state.qrText) {
            setStatus(
                "Bitte zuerst QR / DataMatrix erfassen.",
                "warning"
            );

            return;
        }

        if (
            !state.qrReference
                .partNumber ||
            !state.qrReference
                .serialNumber
        ) {
            setStatus(
                "QR wurde gelesen, aber PN oder SN konnten daraus nicht eindeutig bestimmt werden.",
                "warning"
            );
        }

        const input =
            createNativePhotoInput();

        setStatus(
            "Jetzt nur den gedruckten Textbereich fotografieren.",
            "working"
        );

        input.click();
    }

    function resetVerificationUi() {
        const panel =
            byId(
                "verificationResultPanel"
            );

        if (panel) {
            panel.hidden = true;
        }

        const raw =
            byId(
                "verificationRawText"
            );

        if (raw) {
            raw.textContent = "";
        }
    }

    function resetWorkflow() {
        state.qrText = "";

        state.qrReference = {
            date: "",
            partNumber: "",
            serialNumber: ""
        };

        if (
            state.photoObjectUrl
        ) {
            URL.revokeObjectURL(
                state.photoObjectUrl
            );

            state.photoObjectUrl =
                "";
        }

        updateQrReferenceUi();
        updateVerificationReferenceUi();
        resetVerificationUi();

        setStatus(
            "Bereit für neuen Scan.",
            ""
        );
    }

    function buildWorkflowUi() {
        if (
            byId(
                "twoStageLabelWorkflow"
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
            "twoStageLabelWorkflow";

        container.className =
            "two-stage-label-workflow";

        container.innerHTML = `
            <div class="two-stage-header">
                <strong>QR + Drucktext-Verifikation</strong>
                <p>
                    QR / DataMatrix liefert die Daten.
                    OCR verändert keine Teileinformationen und dient ausschließlich zur Prüfung des gedruckten Textes.
                </p>
            </div>

            <div class="two-stage-steps">
                <div class="two-stage-step">
                    <span class="two-stage-number">1</span>

                    <div>
                        <strong>QR / DataMatrix erfassen</strong>

                        <p>
                            PN und SN werden aus dem Code übernommen.
                        </p>

                        <button
                            type="button"
                            id="twoStageScanQrButton"
                            class="button"
                        >
                            QR / DataMatrix scannen
                        </button>

                        <div class="two-stage-reference">
                            <div>
                                <span>QR roh</span>
                                <strong id="twoStageQrRaw">–</strong>
                            </div>

                            <div>
                                <span>PN aus QR</span>
                                <strong id="twoStageQrPartNumber">–</strong>
                            </div>

                            <div>
                                <span>SN aus QR</span>
                                <strong id="twoStageQrSerialNumber">–</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="two-stage-step">
                    <span class="two-stage-number">2</span>

                    <div>
                        <strong>Drucktext fotografieren</strong>

                        <p>
                            Möglichst nur den gedruckten Text groß und scharf aufnehmen.
                            QR-Code muss nicht mehr im Bild sein.
                        </p>

                        <button
                            type="button"
                            id="twoStageTextPhotoButton"
                            class="button primary"
                        >
                            Textfoto aufnehmen
                        </button>
                    </div>
                </div>
            </div>

            <p
                id="twoStageWorkflowStatus"
                class="two-stage-status"
                aria-live="polite"
            >
                Bereit für QR / DataMatrix.
            </p>

            <section
                id="verificationResultPanel"
                class="verification-result-panel"
                hidden
            >
                <div class="verification-result-header">
                    <div>
                        <strong>OCR-Verifikation</strong>
                        <p>
                            OCR-Werte werden nicht in die Trackingdaten übernommen.
                        </p>
                    </div>

                    <span
                        id="verificationOverallStatus"
                        class="verification-badge"
                    >
                        –
                    </span>
                </div>

                <div class="verification-table">
                    <div class="verification-row verification-heading">
                        <div>Feld</div>
                        <div>QR-Referenz</div>
                        <div>OCR-Kandidat</div>
                        <div>Status</div>
                    </div>

                    <div class="verification-row">
                        <div>PN</div>
                        <div id="verificationPnReference">–</div>
                        <div id="verificationPnDetected">–</div>
                        <div>
                            <span
                                id="verificationPnStatus"
                                class="verification-badge"
                            >
                                –
                            </span>

                            <small id="verificationPnReason"></small>
                        </div>
                    </div>

                    <div class="verification-row">
                        <div>SN</div>
                        <div id="verificationSnReference">–</div>
                        <div id="verificationSnDetected">–</div>
                        <div>
                            <span
                                id="verificationSnStatus"
                                class="verification-badge"
                            >
                                –
                            </span>

                            <small id="verificationSnReason"></small>
                        </div>
                    </div>
                </div>

                <p class="hint">
                    Verwendete Bildvariante:
                    <strong id="verificationVariant">–</strong>
                </p>

                <details>
                    <summary>OCR-Rohtexte anzeigen</summary>
                    <pre id="verificationRawText"></pre>
                </details>
            </section>

            <div class="two-stage-actions">
                <button
                    type="button"
                    id="twoStageResetButton"
                    class="button secondary"
                >
                    Scan zurücksetzen
                </button>
            </div>
        `;

        const qrField =
            qrInput.closest(".field");

        if (
            qrField &&
            qrField.parentNode
        ) {
            qrField.parentNode.insertBefore(
                container,
                qrField.nextSibling
            );
        } else {
            qrInput.parentNode.insertBefore(
                container,
                qrInput.nextSibling
            );
        }

        byId(
            "twoStageScanQrButton"
        ).addEventListener(
            "click",
            scanQrOnly
        );

        byId(
            "twoStageTextPhotoButton"
        ).addEventListener(
            "click",
            takeTextPhoto
        );

        byId(
            "twoStageResetButton"
        ).addEventListener(
            "click",
            resetWorkflow
        );

        const existing =
            readQrFromExistingField();

        if (existing) {
            setQrValue(existing);
        }
    }

    function installStyles() {
        if (
            byId(
                "twoStageVerificationStyles"
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "twoStageVerificationStyles";

        style.textContent = `
            .two-stage-label-workflow {
                margin-top: 1rem;
                padding: 1rem;
                border: 1px solid rgba(127,127,127,.25);
                border-radius: .8rem;
                background: rgba(127,127,127,.05);
            }

            .two-stage-header p,
            .two-stage-step p {
                margin: .35rem 0 .75rem;
            }

            .two-stage-steps {
                display: grid;
                gap: .9rem;
                margin-top: 1rem;
            }

            .two-stage-step {
                display: grid;
                grid-template-columns: 2.2rem 1fr;
                gap: .8rem;
                padding: .85rem;
                border-radius: .7rem;
                background: rgba(127,127,127,.06);
            }

            .two-stage-number {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 2rem;
                height: 2rem;
                border-radius: 50%;
                font-weight: 700;
                background: rgba(0,110,220,.12);
            }

            .two-stage-reference {
                display: grid;
                grid-template-columns: repeat(3,minmax(0,1fr));
                gap: .5rem;
                margin-top: .8rem;
            }

            .two-stage-reference > div {
                padding: .65rem;
                border-radius: .5rem;
                background: rgba(127,127,127,.08);
                overflow-wrap: anywhere;
            }

            .two-stage-reference span {
                display: block;
                font-size: .78rem;
                opacity: .7;
                margin-bottom: .2rem;
            }

            .two-stage-status {
                margin: .9rem 0 0;
                padding: .7rem;
                border-radius: .5rem;
                background: rgba(127,127,127,.08);
            }

            .two-stage-status-success {
                background: rgba(0,150,80,.13);
            }

            .two-stage-status-warning {
                background: rgba(220,150,0,.15);
            }

            .two-stage-status-error {
                background: rgba(220,0,0,.13);
            }

            .two-stage-status-working {
                background: rgba(0,110,220,.11);
            }

            .two-stage-actions {
                margin-top: .8rem;
            }

            .verification-result-panel {
                margin-top: 1rem;
                padding: .9rem;
                border-radius: .7rem;
                border: 1px solid rgba(127,127,127,.25);
            }

            .verification-result-header {
                display: flex;
                justify-content: space-between;
                gap: 1rem;
                align-items: flex-start;
                margin-bottom: .8rem;
            }

            .verification-result-header p {
                margin: .25rem 0 0;
            }

            .verification-table {
                display: grid;
                gap: .4rem;
            }

            .verification-row {
                display: grid;
                grid-template-columns:
                    .45fr
                    1fr
                    1fr
                    1.2fr;
                gap: .5rem;
                align-items: start;
                padding: .55rem;
                border-radius: .45rem;
                background: rgba(127,127,127,.06);
            }

            .verification-heading {
                font-weight: 700;
            }

            .verification-row small {
                display: block;
                margin-top: .3rem;
            }

            .verification-badge {
                display: inline-block;
                min-width: 4.5rem;
                padding: .25rem .5rem;
                border-radius: 999px;
                text-align: center;
                font-weight: 700;
                background: rgba(127,127,127,.12);
            }

            .verification-green {
                background: rgba(0,150,80,.18);
                outline: 1px solid rgba(0,150,80,.45);
            }

            .verification-yellow {
                background: rgba(230,160,0,.20);
                outline: 1px solid rgba(200,135,0,.50);
            }

            .verification-red {
                background: rgba(220,0,0,.17);
                outline: 1px solid rgba(220,0,0,.45);
            }

            #verificationRawText {
                max-height: 18rem;
                overflow: auto;
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }

            @media (max-width: 720px) {
                .two-stage-reference {
                    grid-template-columns: 1fr;
                }

                .two-stage-step .button {
                    width: 100%;
                }

                .verification-row {
                    grid-template-columns: 1fr;
                }

                .verification-heading {
                    display: none;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function install() {
        installStyles();
        buildWorkflowUi();
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

    global.TeiletrackingTwoStageLabelWorkflow =
        Object.freeze({
            reset:
                resetWorkflow,
            setQrValue,
            parseQrReference,
            verifyReference
        });
})(
    typeof window !== "undefined"
        ? window
        : globalThis
);

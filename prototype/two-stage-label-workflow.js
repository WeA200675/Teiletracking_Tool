(function initializeTwoStageLabelWorkflow(global) {
    "use strict";

    const STATE = {
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

    function setStatus(message, kind) {
        const element =
            byId("twoStageWorkflowStatus");

        if (!element) {
            return;
        }

        element.textContent =
            message || "";

        element.className =
            "two-stage-status";

        if (kind) {
            element.classList.add(
                `two-stage-status-${kind}`
            );
        }
    }

    function parseQrReference(text) {
        const value =
            normalize(text);

        const result = {
            raw: value,
            date: "",
            partNumber: "",
            serialNumber: ""
        };

        if (!value) {
            return result;
        }

        const tokens =
            value
                .split("_")
                .map((item) => item.trim())
                .filter(Boolean);

        if (tokens.length >= 3) {
            if (
                /^\d{2}\.\d{2}\.\d{4}$/.test(
                    tokens[0]
                )
            ) {
                result.date =
                    tokens[0];
            }

            result.partNumber =
                tokens[1] || "";

            result.serialNumber =
                tokens[2] || "";
        }

        return result;
    }

    function updateQrReferenceUi() {
        const qrText =
            byId("twoStageQrRaw");

        const qrPn =
            byId("twoStageQrPartNumber");

        const qrSn =
            byId("twoStageQrSerialNumber");

        if (qrText) {
            qrText.textContent =
                STATE.qrText || "–";
        }

        if (qrPn) {
            qrPn.textContent =
                STATE.qrReference.partNumber ||
                "–";
        }

        if (qrSn) {
            qrSn.textContent =
                STATE.qrReference.serialNumber ||
                "–";
        }
    }

    function setQrValue(text) {
        STATE.qrText =
            String(text || "").trim();

        STATE.qrReference =
            parseQrReference(
                STATE.qrText
            );

        const qrInput =
            byId("qrInput");

        if (qrInput) {
            qrInput.value =
                STATE.qrText;

            qrInput.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles: true
                    }
                )
            );
        }

        updateQrReferenceUi();
    }

    function readQrFromExistingField() {
        const qrInput =
            byId("qrInput");

        if (!qrInput) {
            return "";
        }

        return String(
            qrInput.value || ""
        ).trim();
    }

    async function waitForQrResult(
        timeoutMs
    ) {
        const scanner =
            global.TeiletrackingScannerService;

        const started =
            Date.now();

        while (
            Date.now() - started <
            timeoutMs
        ) {
            const fieldValue =
                readQrFromExistingField();

            if (fieldValue) {
                return fieldValue;
            }

            if (
                scanner &&
                typeof scanner.getLiveQrText ===
                    "function"
            ) {
                const liveValue =
                    String(
                        scanner.getLiveQrText() ||
                        ""
                    ).trim();

                if (liveValue) {
                    return liveValue;
                }
            }

            await new Promise(
                (resolve) =>
                    setTimeout(resolve, 250)
            );
        }

        return "";
    }

    function triggerExistingQrScanner() {
        const button =
            byId("openQrScannerButton");

        if (!button) {
            throw new Error(
                "Der vorhandene QR-Scanner-Button wurde nicht gefunden."
            );
        }

        button.click();
    }

    async function scanQrOnly() {
        if (STATE.busy) {
            return;
        }

        STATE.busy = true;

        const button =
            byId("twoStageScanQrButton");

        if (button) {
            button.disabled = true;
        }

        try {
            setStatus(
                "QR / DataMatrix wird gelesen …",
                "working"
            );

            const existing =
                readQrFromExistingField();

            if (existing) {
                setQrValue(existing);

                setStatus(
                    "Vorhandener QR-Wert übernommen.",
                    "success"
                );

                return;
            }

            triggerExistingQrScanner();

            const result =
                await waitForQrResult(
                    30000
                );

            if (!result) {
                setStatus(
                    "Noch kein QR / DataMatrix erkannt. Bitte erneut scannen.",
                    "warning"
                );

                return;
            }

            setQrValue(result);

            setStatus(
                "QR / DataMatrix erkannt. Jetzt den gedruckten Text separat fotografieren.",
                "success"
            );
        } catch (error) {
            console.error(error);

            setStatus(
                error &&
                error.message
                    ? error.message
                    : "QR-Scan fehlgeschlagen.",
                "error"
            );
        } finally {
            STATE.busy = false;

            if (button) {
                button.disabled = false;
            }
        }
    }

    function createNativePhotoInput() {
        let input =
            byId(
                "twoStageNativePhotoInput"
            );

        if (input) {
            return input;
        }

        input =
            document.createElement(
                "input"
            );

        input.type =
            "file";

        input.accept =
            "image/*";

        input.setAttribute(
            "capture",
            "environment"
        );

        input.id =
            "twoStageNativePhotoInput";

        input.hidden =
            true;

        document.body.appendChild(
            input
        );

        input.addEventListener(
            "change",
            handleNativePhoto
        );

        return input;
    }

    function loadImageFromFile(file) {
        return new Promise(
            (resolve, reject) => {
                const url =
                    URL.createObjectURL(
                        file
                    );

                const image =
                    new Image();

                image.onload =
                    function onImageLoad() {
                        resolve({
                            image,
                            url
                        });
                    };

                image.onerror =
                    function onImageError() {
                        URL.revokeObjectURL(
                            url
                        );

                        reject(
                            new Error(
                                "Das Foto konnte nicht geladen werden."
                            )
                        );
                    };

                image.src =
                    url;
            }
        );
    }

    function drawPhotoToCanvas(image) {
        const maxSide =
            2400;

        let width =
            image.naturalWidth ||
            image.width;

        let height =
            image.naturalHeight ||
            image.height;

        const scale =
            Math.min(
                1,
                maxSide /
                    Math.max(
                        width,
                        height
                    )
            );

        width =
            Math.max(
                1,
                Math.round(
                    width * scale
                )
            );

        height =
            Math.max(
                1,
                Math.round(
                    height * scale
                )
            );

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            width;

        canvas.height =
            height;

        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: false,
                    willReadFrequently:
                        true
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

    function createCrop(
        sourceCanvas,
        xRatio,
        yRatio,
        widthRatio,
        heightRatio
    ) {
        const sx =
            Math.round(
                sourceCanvas.width *
                    xRatio
            );

        const sy =
            Math.round(
                sourceCanvas.height *
                    yRatio
            );

        const sw =
            Math.round(
                sourceCanvas.width *
                    widthRatio
            );

        const sh =
            Math.round(
                sourceCanvas.height *
                    heightRatio
            );

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            Math.max(
                1,
                sw
            );

        canvas.height =
            Math.max(
                1,
                sh
            );

        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: false,
                    willReadFrequently:
                        true
                }
            );

        context.drawImage(
            sourceCanvas,
            sx,
            sy,
            sw,
            sh,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return canvas;
    }

    function getPhotoVariants(
        canvas
    ) {
        return [
            {
                name: "Gesamtbild",
                canvas
            },
            {
                name: "Textbereich Mitte",
                canvas: createCrop(
                    canvas,
                    0.15,
                    0.05,
                    0.80,
                    0.90
                )
            },
            {
                name: "Textbereich rechts",
                canvas: createCrop(
                    canvas,
                    0.28,
                    0.04,
                    0.70,
                    0.92
                )
            },
            {
                name: "Textbereich ohne linken QR-Bereich",
                canvas: createCrop(
                    canvas,
                    0.35,
                    0.02,
                    0.63,
                    0.96
                )
            }
        ];
    }

    function levenshteinDistance(
        left,
        right
    ) {
        const a =
            normalize(left);

        const b =
            normalize(right);

        if (!a) {
            return b.length;
        }

        if (!b) {
            return a.length;
        }

        const row =
            Array.from(
                {
                    length:
                        b.length + 1
                },
                (_, index) =>
                    index
            );

        for (
            let i = 1;
            i <= a.length;
            i += 1
        ) {
            let previous =
                row[0];

            row[0] =
                i;

            for (
                let j = 1;
                j <= b.length;
                j += 1
            ) {
                const old =
                    row[j];

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

                previous =
                    old;
            }
        }

        return row[b.length];
    }

    function tokenizeOcrText(
        text
    ) {
        return String(
            text || ""
        )
            .toUpperCase()
            .split(
                /[^A-Z0-9._/-]+/
            )
            .map(
                (item) =>
                    item.trim()
            )
            .filter(Boolean);
    }

    function findReferenceMatch(
        reference,
        text
    ) {
        const wanted =
            normalize(reference);

        if (!wanted) {
            return {
                matched: false,
                value: "",
                distance: null
            };
        }

        const tokens =
            tokenizeOcrText(text);

        if (
            tokens.includes(
                wanted
            )
        ) {
            return {
                matched: true,
                value: wanted,
                distance: 0
            };
        }

        let best =
            null;

        for (
            const token of tokens
        ) {
            if (
                Math.abs(
                    token.length -
                        wanted.length
                ) > 1
            ) {
                continue;
            }

            const distance =
                levenshteinDistance(
                    wanted,
                    token
                );

            if (
                !best ||
                distance <
                    best.distance
            ) {
                best = {
                    matched:
                        distance <= 1,
                    value:
                        token,
                    distance
                };
            }
        }

        return (
            best || {
                matched: false,
                value: "",
                distance: null
            }
        );
    }

    function scoreOcrCandidate(
        result
    ) {
        if (!result) {
            return -1;
        }

        const text =
            String(
                result.text ||
                result.rawText ||
                ""
            );

        let score =
            text.length;

        const pnMatch =
            findReferenceMatch(
                STATE.qrReference
                    .partNumber,
                text
            );

        const snMatch =
            findReferenceMatch(
                STATE.qrReference
                    .serialNumber,
                text
            );

        if (pnMatch.matched) {
            score += 1000;
        }

        if (snMatch.matched) {
            score += 1000;
        }

        return score;
    }

    function extractOcrText(result) {
        if (!result) {
            return "";
        }

        return String(
            result.text ||
            result.rawText ||
            result.ocrText ||
            ""
        ).trim();
    }

    async function recognizeBestPhoto(
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
            getPhotoVariants(
                sourceCanvas
            );

        let best =
            null;

        for (
            let index = 0;
            index <
                variants.length;
            index += 1
        ) {
            const variant =
                variants[index];

            setStatus(
                `OCR läuft: ${variant.name} (${index + 1}/${variants.length}) …`,
                "working"
            );

            try {
                const result =
                    await ocr.recognizeBest(
                        variant.canvas
                    );

                const score =
                    scoreOcrCandidate(
                        result
                    );

                if (
                    !best ||
                    score >
                        best.score
                ) {
                    best = {
                        result,
                        score,
                        name:
                            variant.name
                    };
                }

                const text =
                    extractOcrText(
                        result
                    );

                const pnMatch =
                    findReferenceMatch(
                        STATE.qrReference
                            .partNumber,
                        text
                    );

                const snMatch =
                    findReferenceMatch(
                        STATE.qrReference
                            .serialNumber,
                        text
                    );

                if (
                    pnMatch.matched &&
                    snMatch.matched
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
                "Im Textfoto konnte kein verwertbares OCR-Ergebnis erzeugt werden."
            );
        }

        return best;
    }

    function updateOcrField(
        inputId,
        compareId,
        fieldId,
        reference,
        match
    ) {
        const input =
            byId(inputId);

        const compare =
            byId(compareId);

        const field =
            byId(fieldId);

        if (field) {
            field.classList.remove(
                "match",
                "mismatch",
                "unknown"
            );
        }

        if (
            !reference
        ) {
            if (compare) {
                compare.textContent =
                    "Kein Referenzwert im QR-Code.";
            }

            if (field) {
                field.classList.add(
                    "unknown"
                );
            }

            return;
        }

        if (
            match &&
            match.matched
        ) {
            if (input) {
                input.value =
                    reference;
            }

            if (compare) {
                compare.textContent =
                    match.distance === 0
                        ? "QR-Wert exakt im Drucktext erkannt."
                        : `QR-Wert mit kleiner OCR-Abweichung bestätigt (${match.value}).`;
            }

            if (field) {
                field.classList.add(
                    "match"
                );
            }

            return;
        }

        if (compare) {
            compare.textContent =
                "QR-Wert konnte im Drucktext nicht sicher bestätigt werden.";
        }

        if (field) {
            field.classList.add(
                "mismatch"
            );
        }
    }

    function applyOcrResult(
        best
    ) {
        const result =
            best.result;

        const text =
            extractOcrText(
                result
            );

        const raw =
            byId(
                "labelOcrRawText"
            );

        if (raw) {
            raw.textContent =
                text;
        }

        const panel =
            byId(
                "labelOcrPanel"
            );

        if (panel) {
            panel.classList.remove(
                "hidden"
            );
        }

        const pnMatch =
            findReferenceMatch(
                STATE.qrReference
                    .partNumber,
                text
            );

        const snMatch =
            findReferenceMatch(
                STATE.qrReference
                    .serialNumber,
                text
            );

        updateOcrField(
            "labelOcrPartNumber",
            "labelOcrPartNumberCompare",
            "labelOcrPartNumberField",
            STATE.qrReference
                .partNumber,
            pnMatch
        );

        updateOcrField(
            "labelOcrSerialNumber",
            "labelOcrSerialNumberCompare",
            "labelOcrSerialNumberField",
            STATE.qrReference
                .serialNumber,
            snMatch
        );

        const hardwareCompare =
            byId(
                "labelOcrHardwareCompare"
            );

        const softwareCompare =
            byId(
                "labelOcrSoftwareCompare"
            );

        if (hardwareCompare) {
            hardwareCompare.textContent =
                "Nicht automatisch aus unbekannten QR-Tokens zugeordnet.";
        }

        if (softwareCompare) {
            softwareCompare.textContent =
                "Nicht automatisch aus unbekannten QR-Tokens zugeordnet.";
        }

        const status =
            byId(
                "labelOcrStatus"
            );

        if (status) {
            const both =
                pnMatch.matched &&
                snMatch.matched;

            status.textContent =
                both
                    ? `PN und SN wurden im separaten Textfoto bestätigt. Verwendete OCR-Variante: ${best.name}.`
                    : `OCR abgeschlossen. Mindestens ein QR-Referenzwert konnte nicht sicher im Drucktext bestätigt werden. Verwendete OCR-Variante: ${best.name}.`;
        }

        setStatus(
            pnMatch.matched &&
            snMatch.matched
                ? "Textfoto ausgewertet: PN und SN stimmen mit dem QR-Code überein."
                : "Textfoto ausgewertet. Bitte die nicht bestätigten Werte prüfen.",
            pnMatch.matched &&
            snMatch.matched
                ? "success"
                : "warning"
        );
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
            image.src =
                url;
        }

        if (info) {
            const sizeKb =
                Math.round(
                    file.size / 1024
                );

            info.textContent =
                `Separates OCR-Textfoto · ${sizeKb} KB`;
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

        STATE.busy =
            true;

        try {
            setStatus(
                "Textfoto wird vorbereitet …",
                "working"
            );

            if (
                STATE.photoObjectUrl
            ) {
                URL.revokeObjectURL(
                    STATE.photoObjectUrl
                );

                STATE.photoObjectUrl =
                    "";
            }

            const loaded =
                await loadImageFromFile(
                    file
                );

            STATE.photoObjectUrl =
                loaded.url;

            updatePhotoPreview(
                file,
                loaded.url
            );

            const canvas =
                drawPhotoToCanvas(
                    loaded.image
                );

            const best =
                await recognizeBestPhoto(
                    canvas
                );

            applyOcrResult(
                best
            );
        } catch (error) {
            console.error(error);

            setStatus(
                error &&
                error.message
                    ? error.message
                    : "OCR-Verarbeitung des Textfotos fehlgeschlagen.",
                "error"
            );
        } finally {
            STATE.busy =
                false;

            input.value =
                "";
        }
    }

    function takeTextPhoto() {
        if (
            !STATE.qrText
        ) {
            const existing =
                readQrFromExistingField();

            if (existing) {
                setQrValue(existing);
            }
        }

        if (
            !STATE.qrText
        ) {
            setStatus(
                "Bitte zuerst QR / DataMatrix erfassen.",
                "warning"
            );

            return;
        }

        setStatus(
            "Native Smartphone-Kamera wird für das separate Textfoto geöffnet.",
            "working"
        );

        const input =
            createNativePhotoInput();

        input.click();
    }

    function resetWorkflow() {
        STATE.qrText =
            "";

        STATE.qrReference = {
            date: "",
            partNumber: "",
            serialNumber: ""
        };

        if (
            STATE.photoObjectUrl
        ) {
            URL.revokeObjectURL(
                STATE.photoObjectUrl
            );

            STATE.photoObjectUrl =
                "";
        }

        updateQrReferenceUi();

        setStatus(
            "Bereit für neuen zweistufigen Scan.",
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
                <div>
                    <strong>Zweistufige Label-Erfassung</strong>
                    <p>
                        1. QR / DataMatrix live lesen.
                        2. Gedruckten Text separat mit der nativen Smartphone-Kamera fotografieren.
                    </p>
                </div>
            </div>

            <div class="two-stage-steps">
                <div class="two-stage-step">
                    <span class="two-stage-number">1</span>
                    <div class="two-stage-step-body">
                        <strong>QR / DataMatrix erfassen</strong>
                        <p>
                            Nur den Code lesen. OCR läuft in diesem Schritt nicht.
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
                    <div class="two-stage-step-body">
                        <strong>Gedruckten Text fotografieren</strong>
                        <p>
                            Möglichst nur den Textbereich groß und scharf aufnehmen.
                            QR-Code und Rahmen dürfen außerhalb des Fotos liegen.
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

            <div class="two-stage-actions">
                <button
                    type="button"
                    id="twoStageResetButton"
                    class="button secondary"
                >
                    Zweistufigen Scan zurücksetzen
                </button>
            </div>
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
            qrInput.parentNode.insertBefore(
                container,
                qrInput.nextSibling
            );
        }

        const scanButton =
            byId(
                "twoStageScanQrButton"
            );

        const photoButton =
            byId(
                "twoStageTextPhotoButton"
            );

        const resetButton =
            byId(
                "twoStageResetButton"
            );

        scanButton.addEventListener(
            "click",
            scanQrOnly
        );

        photoButton.addEventListener(
            "click",
            takeTextPhoto
        );

        resetButton.addEventListener(
            "click",
            resetWorkflow
        );

        const existingQr =
            readQrFromExistingField();

        if (existingQr) {
            setQrValue(
                existingQr
            );
        }
    }

    function installStyles() {
        if (
            byId(
                "twoStageLabelWorkflowStyles"
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "twoStageLabelWorkflowStyles";

        style.textContent = `
            .two-stage-label-workflow {
                margin-top: 1rem;
                padding: 1rem;
                border: 1px solid rgba(127, 127, 127, 0.25);
                border-radius: 0.8rem;
                background: rgba(127, 127, 127, 0.05);
            }

            .two-stage-header p,
            .two-stage-step p {
                margin: 0.35rem 0 0.75rem;
            }

            .two-stage-steps {
                display: grid;
                gap: 0.9rem;
                margin-top: 1rem;
            }

            .two-stage-step {
                display: grid;
                grid-template-columns: 2.2rem 1fr;
                gap: 0.8rem;
                align-items: start;
                padding: 0.85rem;
                border-radius: 0.7rem;
                background: rgba(127, 127, 127, 0.06);
            }

            .two-stage-number {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 2rem;
                height: 2rem;
                border-radius: 999px;
                font-weight: 700;
                background: rgba(0, 110, 220, 0.12);
            }

            .two-stage-reference {
                display: grid;
                gap: 0.5rem;
                grid-template-columns:
                    repeat(
                        3,
                        minmax(0, 1fr)
                    );
                margin-top: 0.8rem;
            }

            .two-stage-reference > div {
                padding: 0.65rem;
                border-radius: 0.5rem;
                background: rgba(127, 127, 127, 0.08);
                overflow-wrap: anywhere;
            }

            .two-stage-reference span {
                display: block;
                font-size: 0.78rem;
                opacity: 0.7;
                margin-bottom: 0.2rem;
            }

            .two-stage-status {
                margin: 0.9rem 0 0;
                padding: 0.7rem;
                border-radius: 0.5rem;
                background: rgba(127, 127, 127, 0.08);
            }

            .two-stage-status-success {
                background: rgba(0, 150, 80, 0.12);
            }

            .two-stage-status-warning {
                background: rgba(220, 150, 0, 0.15);
            }

            .two-stage-status-error {
                background: rgba(220, 0, 0, 0.12);
            }

            .two-stage-status-working {
                background: rgba(0, 110, 220, 0.10);
            }

            .two-stage-actions {
                margin-top: 0.75rem;
            }

            .label-ocr-field.match {
                outline: 2px solid rgba(0, 150, 80, 0.55);
                border-radius: 0.5rem;
            }

            .label-ocr-field.mismatch {
                outline: 2px solid rgba(220, 0, 0, 0.55);
                border-radius: 0.5rem;
            }

            .label-ocr-field.unknown {
                outline: 2px solid rgba(180, 140, 0, 0.4);
                border-radius: 0.5rem;
            }

            @media (max-width: 720px) {
                .two-stage-reference {
                    grid-template-columns: 1fr;
                }

                .two-stage-step {
                    grid-template-columns: 2rem 1fr;
                }

                .two-stage-step .button {
                    width: 100%;
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
            parseQrReference
        });
})(
    typeof window !==
        "undefined"
        ? window
        : globalThis
);

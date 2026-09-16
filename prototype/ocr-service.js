"use strict";

(function initializeOcrService(global) {
    const DEFAULT_CONFIG = {
        ProfileName: "Standard-Label",
        Version: 1,
        Fields: {
            PartNumber: {
                Aliases: [
                    "PN",
                    "P N",
                    "P/N",
                    "PART NO",
                    "PART NO.",
                    "PART NUMBER",
                    "PARTNUMBER",
                    "PART NR",
                    "PART NR.",
                    "TEILENUMMER",
                    "TEILE NR",
                    "TEILE NR."
                ],
                Required: true
            },
            SerialNumber: {
                Aliases: [
                    "SN",
                    "S N",
                    "S/N",
                    "SERIAL",
                    "SERIAL NO",
                    "SERIAL NO.",
                    "SERIAL NUMBER",
                    "SERIALNUMBER",
                    "SERIENNUMMER",
                    "SERIEN NR",
                    "SERIEN NR."
                ],
                Required: true
            },
            Hardware: {
                Aliases: [
                    "HW",
                    "H W",
                    "H/W",
                    "HARDWARE",
                    "HARDWARE VERSION",
                    "HW VERSION"
                ],
                Required: false
            },
            Software: {
                Aliases: [
                    "SW",
                    "S W",
                    "S/W",
                    "SOFTWARE",
                    "SOFTWARE VERSION",
                    "SW VERSION"
                ],
                Required: false
            }
        },
        Parsing: {
            AllowValueOnNextLine: true,
            ValuePattern:
                "[A-Z0-9][A-Z0-9._/\\-]*"
        },
        Engine: {
            Primary: "PADDLEOCR",
            Fallback: "TESSERACT",
            PaddleOCR: {
                ModuleUrl:
                    "https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js@0.4.2/+esm",
                OcrVersion: "PP-OCRv6",
                Language: "en",
                Backend: "wasm",
                WasmPaths:
                    "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/",
                NumThreads: 1,
                Simd: true,
                TextDetectionBatchSize: 1,
                TextRecognitionBatchSize: 8,
                TextDetLimitSideLen: 1600,
                TextDetBoxThresh: 0.38,
                TextRecScoreThresh: 0.45,
                MaximumPasses: 4
            }
        }
    };

    let config = cloneDefaultConfig();
    let configSource = "DEFAULT";
    let worker = null;
    let workerPromise = null;
    let paddleOcr = null;
    let paddleOcrPromise = null;
    let paddleModulePromise = null;
    let progressCallback = null;
    let passLabel = "";

    function cloneDefaultConfig() {
        return JSON.parse(
            JSON.stringify(
                DEFAULT_CONFIG
            )
        );
    }

    function normalizeText(value) {
        return String(value || "")
            .trim()
            .toUpperCase();
    }

    function normalizeAliases(
        value,
        fallback
    ) {
        if (!Array.isArray(value)) {
            return [...fallback];
        }

        const aliases =
            value
                .map(item =>
                    String(item || "").trim()
                )
                .filter(Boolean);

        return aliases.length > 0
            ? aliases
            : [...fallback];
    }

    function normalizeConfig(rawConfig) {
        const fallback =
            cloneDefaultConfig();

        if (
            !rawConfig ||
            typeof rawConfig !== "object"
        ) {
            return fallback;
        }

        const normalized =
            cloneDefaultConfig();

        if (
            typeof rawConfig.ProfileName ===
            "string" &&
            rawConfig.ProfileName.trim()
        ) {
            normalized.ProfileName =
                rawConfig.ProfileName.trim();
        }

        if (
            Number.isFinite(
                Number(rawConfig.Version)
            )
        ) {
            normalized.Version =
                Number(rawConfig.Version);
        }

        for (
            const fieldName of [
                "PartNumber",
                "SerialNumber",
                "Hardware",
                "Software"
            ]
        ) {
            const sourceField =
                rawConfig.Fields &&
                rawConfig.Fields[fieldName];

            const fallbackField =
                fallback.Fields[fieldName];

            if (
                sourceField &&
                typeof sourceField === "object"
            ) {
                normalized.Fields[fieldName].Aliases =
                    normalizeAliases(
                        sourceField.Aliases,
                        fallbackField.Aliases
                    );

                if (
                    typeof sourceField.Required ===
                    "boolean"
                ) {
                    normalized.Fields[fieldName].Required =
                        sourceField.Required;
                }
            }
        }

        const parsing =
            rawConfig.Parsing;

        if (
            parsing &&
            typeof parsing === "object"
        ) {
            if (
                typeof parsing.AllowValueOnNextLine ===
                "boolean"
            ) {
                normalized.Parsing.AllowValueOnNextLine =
                    parsing.AllowValueOnNextLine;
            }

            if (
                typeof parsing.ValuePattern ===
                "string" &&
                parsing.ValuePattern.trim()
            ) {
                try {
                    new RegExp(
                        parsing.ValuePattern,
                        "i"
                    );

                    normalized.Parsing.ValuePattern =
                        parsing.ValuePattern;
                }
                catch (error) {
                    console.warn(
                        "Ungültiges OCR-ValuePattern in ocr-config.json. Standardwert wird verwendet.",
                        error
                    );
                }
            }
        }


        const engine =
            rawConfig.Engine;

        if (
            engine &&
            typeof engine === "object"
        ) {
            if (
                typeof engine.Primary ===
                "string" &&
                engine.Primary.trim()
            ) {
                normalized.Engine.Primary =
                    engine.Primary
                        .trim()
                        .toUpperCase();
            }

            if (
                typeof engine.Fallback ===
                "string" &&
                engine.Fallback.trim()
            ) {
                normalized.Engine.Fallback =
                    engine.Fallback
                        .trim()
                        .toUpperCase();
            }

            const paddle =
                engine.PaddleOCR;

            if (
                paddle &&
                typeof paddle === "object"
            ) {
                const stringKeys = [
                    "ModuleUrl",
                    "OcrVersion",
                    "Language",
                    "Backend",
                    "WasmPaths"
                ];

                for (
                    const key of stringKeys
                ) {
                    if (
                        typeof paddle[key] ===
                            "string" &&
                        paddle[key].trim()
                    ) {
                        normalized
                            .Engine
                            .PaddleOCR[key] =
                                paddle[key]
                                    .trim();
                    }
                }

                const numberKeys = [
                    "NumThreads",
                    "TextDetectionBatchSize",
                    "TextRecognitionBatchSize",
                    "TextDetLimitSideLen",
                    "TextDetBoxThresh",
                    "TextRecScoreThresh",
                    "MaximumPasses"
                ];

                for (
                    const key of numberKeys
                ) {
                    if (
                        Number.isFinite(
                            Number(
                                paddle[key]
                            )
                        )
                    ) {
                        normalized
                            .Engine
                            .PaddleOCR[key] =
                                Number(
                                    paddle[key]
                                );
                    }
                }

                if (
                    typeof paddle.Simd ===
                    "boolean"
                ) {
                    normalized
                        .Engine
                        .PaddleOCR
                        .Simd =
                            paddle.Simd;
                }
            }
        }

        return normalized;
    }

    async function loadConfig(
        url = "./ocr-config.json"
    ) {
        config = cloneDefaultConfig();
        configSource = "DEFAULT";

        try {
            const response =
                await fetch(
                    url,
                    { cache: "no-store" }
                );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            config =
                normalizeConfig(
                    await response.json()
                );

            configSource = "FILE";
        }
        catch (error) {
            console.warn(
                "ocr-config.json konnte nicht geladen werden. Das eingebaute Standard-Mapping wird verwendet.",
                error
            );
        }

        return {
            config:
                JSON.parse(
                    JSON.stringify(config)
                ),
            source: configSource
        };
    }

    function getProfileName() {
        return String(
            config &&
            config.ProfileName
                ? config.ProfileName
                : "Standard-Label"
        );
    }

    function getFieldAliases(fieldName) {
        const field =
            config &&
            config.Fields &&
            config.Fields[fieldName];

        if (
            field &&
            Array.isArray(field.Aliases) &&
            field.Aliases.length > 0
        ) {
            return field.Aliases;
        }

        return (
            DEFAULT_CONFIG
                .Fields[fieldName]
                .Aliases
        );
    }

    function escapeRegex(value) {
        return String(value || "")
            .replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );
    }

    function createAliasPattern(alias) {
        const normalized =
            String(alias || "")
                .trim();

        if (!normalized) {
            return "";
        }

        let pattern = "";

        for (const character of normalized) {
            if (/\s/.test(character)) {
                pattern += "\\s*";
                continue;
            }

            if (character === "/") {
                pattern += "\\s*/\\s*";
                continue;
            }

            pattern +=
                escapeRegex(character);
        }

        return pattern.replace(
            /(?:\\s\*){2,}/g,
            "\\s*"
        );
    }

    function getValuePattern() {
        const configuredPattern =
            config &&
            config.Parsing &&
            config.Parsing.ValuePattern;

        if (
            typeof configuredPattern ===
            "string" &&
            configuredPattern.trim()
        ) {
            return configuredPattern;
        }

        return (
            DEFAULT_CONFIG
                .Parsing
                .ValuePattern
        );
    }

    function normalizeOcrLine(value) {
        return String(value || "")
            .replace(/\u00A0/g, " ")
            .replace(/[|]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function cleanFieldValue(value) {
        return normalizeText(
            String(value || "")
                .replace(/^[=:;,\-\s]+/, "")
                .replace(/[;,\s]+$/, "")
        );
    }

    function findFieldValue(
        lines,
        aliases
    ) {
        const aliasPatterns =
            aliases
                .map(createAliasPattern)
                .filter(Boolean);

        if (aliasPatterns.length === 0) {
            return "";
        }

        const aliasPattern =
            aliasPatterns.join("|");

        const valuePattern =
            getValuePattern();

        const sameLineRegex =
            new RegExp(
                `(?:^|\\s)(?:${aliasPattern})\\s*(?::|=|\\-)?\\s*(${valuePattern})`,
                "i"
            );

        const aliasOnlyRegex =
            new RegExp(
                `^\\s*(?:${aliasPattern})\\s*(?::|=|\\-)?\\s*$`,
                "i"
            );

        const nextLineValueRegex =
            new RegExp(
                `^\\s*(${valuePattern})`,
                "i"
            );

        for (
            let index = 0;
            index < lines.length;
            index += 1
        ) {
            const line =
                normalizeOcrLine(
                    lines[index]
                );

            const sameLineMatch =
                line.match(
                    sameLineRegex
                );

            if (
                sameLineMatch &&
                sameLineMatch[1]
            ) {
                return cleanFieldValue(
                    sameLineMatch[1]
                );
            }

            const allowNextLine =
                Boolean(
                    config &&
                    config.Parsing &&
                    config.Parsing
                        .AllowValueOnNextLine
                );

            if (
                allowNextLine &&
                aliasOnlyRegex.test(line) &&
                index + 1 < lines.length
            ) {
                const nextLine =
                    normalizeOcrLine(
                        lines[index + 1]
                    );

                const nextLineMatch =
                    nextLine.match(
                        nextLineValueRegex
                    );

                if (
                    nextLineMatch &&
                    nextLineMatch[1]
                ) {
                    return cleanFieldValue(
                        nextLineMatch[1]
                    );
                }
            }
        }

        return "";
    }

    function containsExactOcrToken(
        rawText,
        value
    ) {
        const normalizedValue =
            normalizeText(value);

        if (!normalizedValue) {
            return false;
        }

        const compactText =
            normalizeText(rawText)
                .replace(/[^A-Z0-9._/\-]+/g, " ");

        const escaped =
            escapeRegex(normalizedValue);

        return new RegExp(
            `(?:^|\\s)${escaped}(?:$|\\s)`,
            "i"
        ).test(compactText);
    }

    function recoverExactQrValuesFromOcr(
        data,
        rawText,
        qrData
    ) {
        if (!qrData) {
            return data;
        }

        const result = {
            ...data
        };

        const mappings = [
            ["partNumber", qrData.partNumber],
            ["serialNumber", qrData.serialNumber],
            ["hardware", qrData.hardware],
            ["software", qrData.software]
        ];

        for (const [fieldName, qrValue] of mappings) {
            if (
                !result[fieldName] &&
                qrValue &&
                containsExactOcrToken(
                    rawText,
                    qrValue
                )
            ) {
                result[fieldName] =
                    normalizeText(qrValue);
            }
        }

        return result;
    }

    function extractTrackingData(
        rawText,
        qrData = null
    ) {
        const normalizedRaw =
            String(rawText || "")
                .replace(/\r/g, "\n");

        const lines =
            normalizedRaw
                .split(/\n+/)
                .map(normalizeOcrLine)
                .filter(Boolean);

        const combinedLines = [
            ...lines,
            normalizeOcrLine(
                lines.join(" ")
            )
        ];

        const extracted = {
            partNumber:
                findFieldValue(
                    combinedLines,
                    getFieldAliases(
                        "PartNumber"
                    )
                ),
            serialNumber:
                findFieldValue(
                    combinedLines,
                    getFieldAliases(
                        "SerialNumber"
                    )
                ),
            hardware:
                findFieldValue(
                    combinedLines,
                    getFieldAliases(
                        "Hardware"
                    )
                ),
            software:
                findFieldValue(
                    combinedLines,
                    getFieldAliases(
                        "Software"
                    )
                )
        };

        return recoverExactQrValuesFromOcr(
            extracted,
            rawText,
            qrData
        );
    }

    function buildTrackingString(data) {
        const segments = [];

        if (data.partNumber) {
            segments.push(
                `PN=${normalizeText(data.partNumber)}`
            );
        }

        if (data.serialNumber) {
            segments.push(
                `SN=${normalizeText(data.serialNumber)}`
            );
        }

        if (data.hardware) {
            segments.push(
                `HW=${normalizeText(data.hardware)}`
            );
        }

        if (data.software) {
            segments.push(
                `SW=${normalizeText(data.software)}`
            );
        }

        return segments.join(";");
    }

    function getMissingFieldsForQr(
        ocrData,
        qrData
    ) {
        const missing = [];

        if (!ocrData.partNumber) {
            missing.push("PN");
        }

        if (!ocrData.serialNumber) {
            missing.push("SN");
        }

        if (
            qrData &&
            qrData.hardware &&
            !ocrData.hardware
        ) {
            missing.push("HW");
        }

        if (
            qrData &&
            qrData.software &&
            !ocrData.software
        ) {
            missing.push("SW");
        }

        return missing;
    }

    function prepareBaseCanvas(sourceCanvas) {
        const targetWidth =
            Math.min(
                2200,
                Math.max(
                    sourceCanvas.width,
                    Math.round(
                        sourceCanvas.width * 1.5
                    )
                )
            );

        const scale =
            targetWidth /
            sourceCanvas.width;

        const targetHeight =
            Math.round(
                sourceCanvas.height *
                scale
            );

        const canvas =
            document.createElement("canvas");

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context =
            canvas.getContext(
                "2d",
                { willReadFrequently: true }
            );

        if (!context) {
            throw new Error(
                "Das Labelbild konnte nicht für OCR vorbereitet werden."
            );
        }

        context.drawImage(
            sourceCanvas,
            0,
            0,
            targetWidth,
            targetHeight
        );

        return canvas;
    }

    function cloneCanvas(sourceCanvas) {
        const canvas =
            document.createElement("canvas");

        canvas.width =
            sourceCanvas.width;

        canvas.height =
            sourceCanvas.height;

        const context =
            canvas.getContext(
                "2d",
                { willReadFrequently: true }
            );

        if (!context) {
            throw new Error(
                "OCR-Bildvariante konnte nicht erstellt werden."
            );
        }

        context.drawImage(
            sourceCanvas,
            0,
            0
        );

        return {
            canvas,
            context
        };
    }

    function createGrayscaleContrastCanvas(
        sourceCanvas
    ) {
        const { canvas, context } =
            cloneCanvas(
                sourceCanvas
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

        const contrast = 1.45;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const luminance =
                (
                    data[index] * 0.299 +
                    data[index + 1] * 0.587 +
                    data[index + 2] * 0.114
                );

            const adjusted =
                Math.max(
                    0,
                    Math.min(
                        255,
                        (
                            luminance - 128
                        ) *
                        contrast +
                        128
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

    function getAutomaticThreshold(imageData) {
        const histogram =
            new Array(256).fill(0);

        const data =
            imageData.data;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const luminance =
                Math.round(
                    data[index] * 0.299 +
                    data[index + 1] * 0.587 +
                    data[index + 2] * 0.114
                );

            histogram[luminance] += 1;
        }

        const totalPixels =
            imageData.width *
            imageData.height;

        let weightedSum = 0;

        for (
            let value = 0;
            value < 256;
            value += 1
        ) {
            weightedSum +=
                value *
                histogram[value];
        }

        let backgroundWeight = 0;
        let backgroundSum = 0;
        let maximumVariance = -1;
        let threshold = 160;

        for (
            let value = 0;
            value < 256;
            value += 1
        ) {
            backgroundWeight +=
                histogram[value];

            if (backgroundWeight === 0) {
                continue;
            }

            const foregroundWeight =
                totalPixels -
                backgroundWeight;

            if (foregroundWeight === 0) {
                break;
            }

            backgroundSum +=
                value *
                histogram[value];

            const backgroundMean =
                backgroundSum /
                backgroundWeight;

            const foregroundMean =
                (
                    weightedSum -
                    backgroundSum
                ) /
                foregroundWeight;

            const variance =
                backgroundWeight *
                foregroundWeight *
                Math.pow(
                    backgroundMean -
                    foregroundMean,
                    2
                );

            if (
                variance >
                maximumVariance
            ) {
                maximumVariance =
                    variance;

                threshold = value;
            }
        }

        return threshold;
    }

    function createThresholdCanvas(
        sourceCanvas
    ) {
        const { canvas, context } =
            cloneCanvas(
                sourceCanvas
            );

        const imageData =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

        const threshold =
            getAutomaticThreshold(
                imageData
            );

        const data =
            imageData.data;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const luminance =
                (
                    data[index] * 0.299 +
                    data[index + 1] * 0.587 +
                    data[index + 2] * 0.114
                );

            const value =
                luminance >= threshold
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

    function createCenterCropCanvas(
        sourceCanvas,
        ratio = 0.9
    ) {
        const cropWidth =
            Math.round(
                sourceCanvas.width * ratio
            );
        const cropHeight =
            Math.round(
                sourceCanvas.height * ratio
            );
        const x =
            Math.round(
                (sourceCanvas.width - cropWidth) / 2
            );
        const y =
            Math.round(
                (sourceCanvas.height - cropHeight) / 2
            );

        const canvas =
            document.createElement("canvas");
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        const context =
            canvas.getContext(
                "2d",
                { willReadFrequently: true }
            );

        if (!context) {
            throw new Error(
                "OCR-Zentralausschnitt konnte nicht erstellt werden."
            );
        }

        context.drawImage(
            sourceCanvas,
            x,
            y,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
        );

        return canvas;
    }

    function createImageVariants(
        sourceCanvas
    ) {
        const baseCanvas =
            prepareBaseCanvas(
                sourceCanvas
            );

        const centerCanvas =
            createCenterCropCanvas(
                baseCanvas,
                0.9
            );

        return [
            {
                name: "Original",
                canvas: baseCanvas
            },
            {
                name: "Graustufe + Kontrast",
                canvas:
                    createGrayscaleContrastCanvas(
                        baseCanvas
                    )
            },
            {
                name: "Schwarz/Weiß",
                canvas:
                    createThresholdCanvas(
                        baseCanvas
                    )
            },
            {
                name: "Zentrum 90% + Kontrast",
                canvas:
                    createGrayscaleContrastCanvas(
                        centerCanvas
                    )
            },
            {
                name: "Zentrum 90% Schwarz/Weiß",
                canvas:
                    createThresholdCanvas(
                        centerCanvas
                    )
            }
        ];
    }

    function getCandidateScore(
        ocrData,
        confidence
    ) {
        let score = 0;

        if (ocrData.partNumber) {
            score += 100;
        }

        if (ocrData.serialNumber) {
            score += 100;
        }

        if (ocrData.hardware) {
            score += 30;
        }

        if (ocrData.software) {
            score += 30;
        }

        const normalizedConfidence =
            Number.isFinite(
                Number(confidence)
            )
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        Number(confidence)
                    )
                )
                : 0;

        score +=
            normalizedConfidence /
            10;

        return score;
    }


    function getPaddleConfig() {
        return (
            config &&
            config.Engine &&
            config.Engine.PaddleOCR
                ? config.Engine.PaddleOCR
                : DEFAULT_CONFIG
                    .Engine
                    .PaddleOCR
        );
    }

    function getPrimaryEngine() {
        return normalizeText(
            config &&
            config.Engine &&
            config.Engine.Primary
                ? config.Engine.Primary
                : "PADDLEOCR"
        );
    }

    function getFallbackEngine() {
        return normalizeText(
            config &&
            config.Engine &&
            config.Engine.Fallback
                ? config.Engine.Fallback
                : "TESSERACT"
        );
    }

    function createRotatedCanvas(
        sourceCanvas,
        degrees
    ) {
        const normalizedDegrees =
            (
                (
                    Number(degrees) % 360
                ) +
                360
            ) % 360;

        if (
            normalizedDegrees === 0
        ) {
            return cloneCanvas(
                sourceCanvas
            ).canvas;
        }

        const swapSides =
            normalizedDegrees === 90 ||
            normalizedDegrees === 270;

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            swapSides
                ? sourceCanvas.height
                : sourceCanvas.width;

        canvas.height =
            swapSides
                ? sourceCanvas.width
                : sourceCanvas.height;

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );

        if (!context) {
            throw new Error(
                "OCR-Bild konnte nicht gedreht werden."
            );
        }

        context.translate(
            canvas.width / 2,
            canvas.height / 2
        );

        context.rotate(
            normalizedDegrees *
            Math.PI /
            180
        );

        context.drawImage(
            sourceCanvas,
            -sourceCanvas.width / 2,
            -sourceCanvas.height / 2
        );

        return canvas;
    }

    function createNeuralImageVariants(
        sourceCanvas
    ) {
        const baseCanvas =
            prepareBaseCanvas(
                sourceCanvas
            );

        return [
            {
                name: "Original",
                canvas: baseCanvas
            },
            {
                name: "90° rechts",
                canvas:
                    createRotatedCanvas(
                        baseCanvas,
                        90
                    )
            },
            {
                name: "90° links",
                canvas:
                    createRotatedCanvas(
                        baseCanvas,
                        270
                    )
            },
            {
                name: "Graustufe + Kontrast",
                canvas:
                    createGrayscaleContrastCanvas(
                        baseCanvas
                    )
            }
        ];
    }

    function getPointY(point) {
        if (
            Array.isArray(point)
        ) {
            return Number(point[1]) || 0;
        }

        if (
            point &&
            typeof point === "object"
        ) {
            return (
                Number(point.y) ||
                Number(point.Y) ||
                0
            );
        }

        return 0;
    }

    function getPointX(point) {
        if (
            Array.isArray(point)
        ) {
            return Number(point[0]) || 0;
        }

        if (
            point &&
            typeof point === "object"
        ) {
            return (
                Number(point.x) ||
                Number(point.X) ||
                0
            );
        }

        return 0;
    }

    function getItemPosition(item) {
        const poly =
            item &&
            Array.isArray(item.poly)
                ? item.poly
                : [];

        if (
            poly.length === 0
        ) {
            return {
                x: 0,
                y: 0
            };
        }

        const x =
            poly.reduce(
                (
                    sum,
                    point
                ) =>
                    sum +
                    getPointX(point),
                0
            ) /
            poly.length;

        const y =
            poly.reduce(
                (
                    sum,
                    point
                ) =>
                    sum +
                    getPointY(point),
                0
            ) /
            poly.length;

        return {
            x,
            y
        };
    }

    function normalizePaddleItems(
        items
    ) {
        if (!Array.isArray(items)) {
            return [];
        }

        return items
            .map(item => {
                const text =
                    String(
                        item &&
                        item.text
                            ? item.text
                            : ""
                    )
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();

                const score =
                    Number(
                        item &&
                        item.score
                    );

                return {
                    ...item,
                    text,
                    score:
                        Number.isFinite(
                            score
                        )
                            ? score
                            : 0,
                    position:
                        getItemPosition(
                            item
                        )
                };
            })
            .filter(
                item =>
                    Boolean(
                        item.text
                    )
            )
            .sort(
                (
                    left,
                    right
                ) => {
                    const yDelta =
                        left.position.y -
                        right.position.y;

                    if (
                        Math.abs(
                            yDelta
                        ) >
                        18
                    ) {
                        return yDelta;
                    }

                    return (
                        left.position.x -
                        right.position.x
                    );
                }
            );
    }

    function getAveragePaddleConfidence(
        items
    ) {
        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return 0;
        }

        let weighted = 0;
        let totalWeight = 0;

        for (const item of items) {
            const length =
                Math.max(
                    1,
                    String(
                        item.text || ""
                    ).length
                );

            weighted +=
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(
                            item.score
                        ) || 0
                    )
                ) *
                length;

            totalWeight +=
                length;
        }

        if (
            totalWeight === 0
        ) {
            return 0;
        }

        return (
            weighted /
            totalWeight *
            100
        );
    }

    function getIndustrialTextQuality(
        rawText
    ) {
        const lines =
            String(
                rawText || ""
            )
                .split(/\n+/)
                .map(
                    normalizeOcrLine
                )
                .filter(Boolean);

        if (
            lines.length === 0
        ) {
            return 0;
        }

        let score = 0;

        for (const line of lines) {
            const compact =
                line
                    .toUpperCase()
                    .replace(
                        /\s+/g,
                        ""
                    );

            if (
                /^[A-Z0-9._/\-]+$/
                    .test(
                        compact
                    )
            ) {
                score += 8;
            }

            if (
                /\d{1,2}\.\d{1,2}\.\d{4}/
                    .test(
                        compact
                    )
            ) {
                score += 12;
            }

            if (
                /[A-Z0-9]+-[A-Z0-9-]+/
                    .test(
                        compact
                    )
            ) {
                score += 10;
            }

            if (
                compact.length >= 6
            ) {
                score += 3;
            }

            const suspicious =
                compact.replace(
                    /[A-Z0-9._/\-]/g,
                    ""
                ).length;

            score -=
                suspicious * 3;
        }

        score +=
            Math.min(
                24,
                lines.length * 4
            );

        return score;
    }

    function buildPaddleCandidate(
        result,
        variant,
        qrData
    ) {
        const items =
            normalizePaddleItems(
                result &&
                result.items
            );

        const rawText =
            items
                .map(
                    item =>
                        item.text
                )
                .join("\n");

        const confidence =
            getAveragePaddleConfidence(
                items
            );

        const ocrData =
            extractTrackingData(
                rawText,
                qrData
            );

        const missingFields =
            getMissingFieldsForQr(
                ocrData,
                qrData
            );

        return {
            engine: "PADDLEOCR",
            variantName:
                `PaddleOCR · ${variant.name}`,
            rawText,
            confidence,
            ocrData,
            missingFields,
            complete:
                missingFields.length === 0,
            score:
                getCandidateScore(
                    ocrData,
                    confidence
                ) +
                getIndustrialTextQuality(
                    rawText
                ),
            lineItems:
                items.map(
                    item => ({
                        text:
                            item.text,
                        score:
                            item.score,
                        poly:
                            item.poly || null
                    })
                ),
            metrics:
                result &&
                result.metrics
                    ? {
                        ...result.metrics
                    }
                    : null
        };
    }

    async function loadPaddleModule() {
        if (
            paddleModulePromise
        ) {
            return paddleModulePromise;
        }

        const paddleConfig =
            getPaddleConfig();

        const moduleUrl =
            String(
                paddleConfig.ModuleUrl ||
                ""
            ).trim();

        if (!moduleUrl) {
            throw new Error(
                "Für PaddleOCR ist keine ModuleUrl konfiguriert."
            );
        }

        passLabel =
            "PaddleOCR-Modul";

        emitProgress({
            stage: "engine",
            status:
                "PaddleOCR wird geladen …",
            progress: 0
        });

        paddleModulePromise =
            import(
                moduleUrl
            );

        try {
            return (
                await paddleModulePromise
            );
        }
        catch (error) {
            paddleModulePromise =
                null;

            throw new Error(
                `PaddleOCR konnte nicht geladen werden: ${
                    error &&
                    error.message
                        ? error.message
                        : error
                }`
            );
        }
    }

    async function getPaddleOcr() {
        if (paddleOcr) {
            return paddleOcr;
        }

        if (
            paddleOcrPromise
        ) {
            return paddleOcrPromise;
        }

        paddleOcrPromise =
            (
                async () => {
                    const module =
                        await loadPaddleModule();

                    if (
                        !module ||
                        typeof module.PaddleOCR !==
                            "function"
                    ) {
                        throw new Error(
                            "Das geladene PaddleOCR-Modul stellt keine PaddleOCR-Klasse bereit."
                        );
                    }

                    const paddleConfig =
                        getPaddleConfig();

                    passLabel =
                        "PaddleOCR-Modell";

                    emitProgress({
                        stage: "engine",
                        status:
                            `PaddleOCR ${paddleConfig.OcrVersion} wird initialisiert …`,
                        progress: 0.03
                    });

                    const instance =
                        await module
                            .PaddleOCR
                            .create({
                                lang:
                                    paddleConfig.Language ||
                                    "en",
                                ocrVersion:
                                    paddleConfig.OcrVersion ||
                                    "PP-OCRv6",
                                worker: false,
                                textDetectionBatchSize:
                                    Math.max(
                                        1,
                                        Math.round(
                                            Number(
                                                paddleConfig
                                                    .TextDetectionBatchSize
                                            ) ||
                                            1
                                        )
                                    ),
                                textRecognitionBatchSize:
                                    Math.max(
                                        1,
                                        Math.round(
                                            Number(
                                                paddleConfig
                                                    .TextRecognitionBatchSize
                                            ) ||
                                            8
                                        )
                                    ),
                                ortOptions: {
                                    backend:
                                        paddleConfig.Backend ||
                                        "wasm",
                                    wasmPaths:
                                        paddleConfig.WasmPaths ||
                                        undefined,
                                    numThreads:
                                        Math.max(
                                            1,
                                            Math.round(
                                                Number(
                                                    paddleConfig
                                                        .NumThreads
                                                ) ||
                                                1
                                            )
                                        ),
                                    simd:
                                        paddleConfig.Simd !==
                                        false
                                }
                            });

                    emitProgress({
                        stage: "engine",
                        status:
                            "PaddleOCR ist bereit.",
                        progress: 0.08
                    });

                    return instance;
                }
            )();

        try {
            paddleOcr =
                await paddleOcrPromise;

            return paddleOcr;
        }
        finally {
            paddleOcrPromise =
                null;
        }
    }

    async function recognizeBestWithPaddle(
        sourceCanvas,
        qrData
    ) {
        const activeOcr =
            await getPaddleOcr();

        const paddleConfig =
            getPaddleConfig();

        const variants =
            createNeuralImageVariants(
                sourceCanvas
            );

        const maximumPasses =
            Math.max(
                1,
                Math.min(
                    variants.length,
                    Math.round(
                        Number(
                            paddleConfig
                                .MaximumPasses
                        ) ||
                        variants.length
                    )
                )
            );

        let bestCandidate = null;

        for (
            let index = 0;
            index < maximumPasses;
            index += 1
        ) {
            const variant =
                variants[index];

            passLabel =
                `PaddleOCR ${index + 1}/${maximumPasses}: ${variant.name}`;

            emitProgress({
                stage: "variant",
                status:
                    `${passLabel} wird mit dem neuronalen OCR-Modell ausgewertet`,
                progress:
                    0.1 +
                    (
                        index /
                        maximumPasses
                    ) *
                    0.82
            });

            const results =
                await activeOcr.predict(
                    variant.canvas,
                    {
                        textDetLimitSideLen:
                            Math.max(
                                640,
                                Math.round(
                                    Number(
                                        paddleConfig
                                            .TextDetLimitSideLen
                                    ) ||
                                    1600
                                )
                            ),
                        textDetLimitType:
                            "max",
                        textDetBoxThresh:
                            Math.max(
                                0.05,
                                Math.min(
                                    0.95,
                                    Number(
                                        paddleConfig
                                            .TextDetBoxThresh
                                    ) ||
                                    0.38
                                )
                            ),
                        textRecScoreThresh:
                            Math.max(
                                0.05,
                                Math.min(
                                    0.95,
                                    Number(
                                        paddleConfig
                                            .TextRecScoreThresh
                                    ) ||
                                    0.45
                                )
                            )
                    }
                );

            const result =
                Array.isArray(
                    results
                )
                    ? results[0]
                    : null;

            const candidate =
                buildPaddleCandidate(
                    result,
                    variant,
                    qrData
                );

            if (
                !bestCandidate ||
                candidate.score >
                bestCandidate.score
            ) {
                bestCandidate =
                    candidate;
            }

            if (
                candidate.complete &&
                candidate.confidence >= 82
            ) {
                bestCandidate =
                    candidate;

                break;
            }
        }

        if (
            !bestCandidate ||
            !bestCandidate.rawText
        ) {
            throw new Error(
                "PaddleOCR konnte auf dem Label keinen verwertbaren Text erkennen."
            );
        }

        return bestCandidate;
    }

    function emitProgress(message) {
        if (
            typeof progressCallback ===
            "function"
        ) {
            progressCallback({
                ...message,
                passLabel
            });
        }
    }

    async function getWorker() {
        if (worker) {
            return worker;
        }

        if (workerPromise) {
            return workerPromise;
        }

        if (
            !global.Tesseract ||
            typeof global.Tesseract.createWorker !==
            "function"
        ) {
            throw new Error(
                "Die OCR-Bibliothek Tesseract.js konnte nicht geladen werden. Bitte Internetverbindung prüfen und die Seite neu laden."
            );
        }

        workerPromise =
            global.Tesseract.createWorker(
                "eng",
                1,
                {
                    logger:
                        emitProgress
                }
            );

        try {
            worker =
                await workerPromise;

            try {
                await worker.setParameters({
                    preserve_interword_spaces: "1",
                    tessedit_pageseg_mode:
                        global.Tesseract.PSM &&
                        global.Tesseract.PSM.SPARSE_TEXT !== undefined
                            ? global.Tesseract.PSM.SPARSE_TEXT
                            : "11"
                });
            }
            catch (error) {
                console.warn(
                    "OCR-Parameter konnten nicht vollständig gesetzt werden.",
                    error
                );
            }

            return worker;
        }
        finally {
            workerPromise = null;
        }
    }

    async function recognizeBestWithTesseract(
        sourceCanvas,
        qrData
    ) {
        const activeWorker =
            await getWorker();

        const variants =
            createImageVariants(
                sourceCanvas
            );

        let bestCandidate = null;

        for (
            let index = 0;
            index < variants.length;
            index += 1
        ) {
            const variant =
                variants[index];

            passLabel =
                `Variante ${index + 1}/${variants.length}: ${variant.name}`;

            emitProgress({
                stage: "variant",
                status:
                    `${passLabel} wird ausgewertet`,
                progress:
                    index /
                    variants.length
            });

            const result =
                await activeWorker.recognize(
                    variant.canvas,
                    {
                        rotateAuto: true
                    }
                );

            const rawText =
                result &&
                result.data &&
                result.data.text
                    ? result.data.text
                    : "";

            const confidence =
                result &&
                result.data &&
                Number.isFinite(
                    Number(
                        result.data.confidence
                    )
                )
                    ? Number(
                        result.data.confidence
                    )
                    : 0;

            const ocrData =
                extractTrackingData(
                    rawText,
                    qrData
                );

            const missingFields =
                getMissingFieldsForQr(
                    ocrData,
                    qrData
                );

            const candidate = {
                engine: "TESSERACT",
                variantName:
                    `Tesseract · ${variant.name}`,
                rawText,
                confidence,
                ocrData,
                missingFields,
                complete:
                    missingFields.length === 0,
                score:
                    getCandidateScore(
                        ocrData,
                        confidence
                    )
            };

            if (
                !bestCandidate ||
                candidate.score >
                bestCandidate.score
            ) {
                bestCandidate =
                    candidate;
            }

            if (candidate.complete) {
                bestCandidate =
                    candidate;

                break;
            }
        }

        passLabel = "";

        if (!bestCandidate) {
            throw new Error(
                "Die sichtbare Label-Beschriftung konnte nicht ausgewertet werden."
            );
        }

        return bestCandidate;
    }


    async function recognizeBest(
        sourceCanvas,
        qrData,
        options = {}
    ) {
        progressCallback =
            typeof options.onProgress ===
            "function"
                ? options.onProgress
                : null;

        passLabel = "";

        const primaryEngine =
            getPrimaryEngine();

        const fallbackEngine =
            getFallbackEngine();

        try {
            if (
                primaryEngine ===
                "PADDLEOCR"
            ) {
                const result =
                    await recognizeBestWithPaddle(
                        sourceCanvas,
                        qrData
                    );

                emitProgress({
                    stage: "complete",
                    status:
                        "PaddleOCR-Auswertung abgeschlossen.",
                    progress: 1
                });

                return result;
            }

            if (
                primaryEngine ===
                "TESSERACT"
            ) {
                return (
                    await recognizeBestWithTesseract(
                        sourceCanvas,
                        qrData
                    )
                );
            }

            throw new Error(
                `Unbekannte primäre OCR-Engine: ${primaryEngine}`
            );
        }
        catch (primaryError) {
            console.error(
                "Primäre OCR-Engine fehlgeschlagen:",
                primaryError
            );

            if (
                fallbackEngine ===
                    "TESSERACT" &&
                primaryEngine !==
                    "TESSERACT"
            ) {
                passLabel =
                    "Fallback: Tesseract";

                emitProgress({
                    stage: "fallback",
                    status:
                        `PaddleOCR konnte nicht ausgeführt werden. Tesseract-Fallback startet: ${
                            primaryError &&
                            primaryError.message
                                ? primaryError.message
                                : primaryError
                        }`,
                    progress: 0
                });

                return (
                    await recognizeBestWithTesseract(
                        sourceCanvas,
                        qrData
                    )
                );
            }

            throw primaryError;
        }
        finally {
            passLabel = "";
            progressCallback = null;
        }
    }

    async function terminate() {
        progressCallback = null;
        passLabel = "";

        if (paddleOcr) {
            const activePaddleOcr =
                paddleOcr;

            paddleOcr = null;
            paddleOcrPromise = null;

            try {
                if (
                    typeof activePaddleOcr.dispose ===
                    "function"
                ) {
                    await activePaddleOcr.dispose();
                }
            }
            catch {
                // Beim Verlassen der Seite ist keine weitere Aktion nötig.
            }
        }

        if (worker) {
            const activeWorker = worker;
            worker = null;

            try {
                await activeWorker.terminate();
            }
            catch {
                // Beim Verlassen der Seite ist keine weitere Aktion nötig.
            }
        }
    }

    global.TeiletrackingOcrService = Object.freeze({
        loadConfig,
        getProfileName,
        recognizeBest,
        buildTrackingString,
        getMissingFieldsForQr,
        getPrimaryEngine,
        getFallbackEngine,
        terminate
    });
})(window);

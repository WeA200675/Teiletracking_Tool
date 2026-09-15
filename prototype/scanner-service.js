"use strict";

(function initializeScannerService(global) {
    let stream = null;
    let detector = null;
    let mode = null;
    let lastDiagnostics = null;

    function delay(milliseconds) {
        return new Promise(resolve => {
            global.setTimeout(resolve, milliseconds);
        });
    }

    function getErrorMessage(error) {
        if (!error) {
            return "Die Kamera konnte nicht gestartet werden.";
        }

        switch (error.name) {
            case "NotAllowedError":
            case "PermissionDeniedError":
                return "Der Kamerazugriff wurde nicht erlaubt. Bitte erlaube den Kamerazugriff im Browser.";

            case "NotFoundError":
            case "DevicesNotFoundError":
                return "Es wurde keine verwendbare Kamera gefunden.";

            case "NotReadableError":
            case "TrackStartError":
                return "Die Kamera ist bereits belegt oder konnte nicht gelesen werden.";

            case "OverconstrainedError":
            case "ConstraintNotSatisfiedError":
                return "Die gewünschte Kameraeinstellung wird von diesem Gerät nicht unterstützt.";

            case "SecurityError":
                return "Der Browser blockiert den Kamerazugriff aus Sicherheitsgründen.";

            default:
                return error.message
                    ? `Kamera-Fehler: ${error.message}`
                    : "Die Kamera konnte nicht gestartet werden.";
        }
    }

    function assertCameraEnvironment() {
        if (
            !global.isSecureContext &&
            global.location.hostname !== "localhost" &&
            global.location.hostname !== "127.0.0.1"
        ) {
            throw new Error(
                "Der Kamerazugriff benötigt HTTPS oder localhost."
            );
        }

        if (
            !global.navigator.mediaDevices ||
            !global.navigator.mediaDevices.getUserMedia
        ) {
            throw new Error(
                "Dieser Browser stellt keinen Kamerazugriff über getUserMedia bereit."
            );
        }
    }

    async function initializeQrEngine() {
        detector = null;
        mode = null;

        if ("BarcodeDetector" in global) {
            try {
                let supportsQr = true;

                if (
                    typeof global.BarcodeDetector.getSupportedFormats ===
                    "function"
                ) {
                    const supportedFormats =
                        await global.BarcodeDetector.getSupportedFormats();

                    supportsQr =
                        supportedFormats.includes("qr_code");
                }

                if (supportsQr) {
                    detector =
                        new global.BarcodeDetector({
                            formats: ["qr_code"]
                        });

                    mode = "BARCODE_DETECTOR";
                    return mode;
                }
            }
            catch (error) {
                console.warn(
                    "Native BarcodeDetector-Erkennung ist nicht verfügbar. jsQR-Fallback wird verwendet.",
                    error
                );
            }
        }

        if (typeof global.jsQR === "function") {
            mode = "JSQR";
            return mode;
        }

        throw new Error(
            "Die QR-Erkennung ist in diesem Browser nicht verfügbar und der jsQR-Fallback konnte nicht geladen werden. Bitte Internetverbindung prüfen und die Seite neu laden."
        );
    }

    async function applyBestCameraConstraints(track) {
        if (!track) {
            return;
        }

        try {
            const capabilities =
                typeof track.getCapabilities === "function"
                    ? track.getCapabilities()
                    : {};

            const advanced = {};

            if (
                Array.isArray(capabilities.focusMode) &&
                capabilities.focusMode.includes("continuous")
            ) {
                advanced.focusMode = "continuous";
            }

            if (
                capabilities.zoom &&
                Number.isFinite(capabilities.zoom.min)
            ) {
                const min = Number(capabilities.zoom.min);
                const max = Number(capabilities.zoom.max);
                const preferred = Math.min(
                    max,
                    Math.max(
                        min,
                        min + (max - min) * 0.12
                    )
                );

                if (Number.isFinite(preferred)) {
                    advanced.zoom = preferred;
                }
            }

            if (Object.keys(advanced).length > 0) {
                await track.applyConstraints({
                    advanced: [advanced]
                });
            }
        }
        catch (error) {
            console.warn(
                "Optimierte Kameraeinstellungen konnten nicht angewendet werden. Standardwerte werden verwendet.",
                error
            );
        }
    }

    async function waitForVideoReady(videoElement) {
        if (
            videoElement.videoWidth &&
            videoElement.videoHeight
        ) {
            await delay(350);
            return;
        }

        await new Promise((resolve, reject) => {
            let finished = false;

            const finish = callback => {
                if (finished) {
                    return;
                }
                finished = true;
                global.clearTimeout(timeoutId);
                videoElement.removeEventListener(
                    "loadedmetadata",
                    onReady
                );
                callback();
            };

            const onReady = () =>
                finish(resolve);

            const timeoutId =
                global.setTimeout(
                    () =>
                        finish(() => reject(
                            new Error(
                                "Die Kamera liefert noch kein stabiles Bild."
                            )
                        )),
                    5000
                );

            videoElement.addEventListener(
                "loadedmetadata",
                onReady,
                { once: true }
            );
        });

        await delay(450);
    }

    async function startCamera(videoElement) {
        stopCamera(videoElement);
        assertCameraEnvironment();
        await initializeQrEngine();

        stream =
            await global.navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: {
                        ideal: "environment"
                    },
                    width: {
                        ideal: 2560,
                        min: 1280
                    },
                    height: {
                        ideal: 1440,
                        min: 720
                    }
                }
            });

        const [track] =
            stream.getVideoTracks();

        await applyBestCameraConstraints(track);

        videoElement.srcObject = stream;
        await videoElement.play();
        await waitForVideoReady(videoElement);

        const settings =
            track &&
            typeof track.getSettings === "function"
                ? track.getSettings()
                : {};

        return {
            mode,
            displayName:
                mode === "BARCODE_DETECTOR"
                    ? "native Browser-Erkennung + jsQR-Mehrfachscan"
                    : "jsQR-Mehrfachscan",
            width:
                settings.width ||
                videoElement.videoWidth,
            height:
                settings.height ||
                videoElement.videoHeight,
            focusMode:
                settings.focusMode ||
                "unbekannt"
        };
    }

    function stopCamera(videoElement) {
        if (stream) {
            for (const track of stream.getTracks()) {
                track.stop();
            }

            stream = null;
        }

        if (videoElement) {
            videoElement.srcObject = null;
        }

        detector = null;
        mode = null;
    }

    function calculateImageQuality(canvas, context) {
        const maxSamples = 140000;
        const totalPixels =
            canvas.width * canvas.height;
        const step = Math.max(
            1,
            Math.ceil(
                Math.sqrt(
                    totalPixels / maxSamples
                )
            )
        );

        const imageData =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );
        const data = imageData.data;
        let brightnessSum = 0;
        let glareCount = 0;
        let darkCount = 0;
        let gradientSum = 0;
        let samples = 0;

        const luminanceAt = (x, y) => {
            const index =
                (y * canvas.width + x) * 4;
            return (
                data[index] * 0.299 +
                data[index + 1] * 0.587 +
                data[index + 2] * 0.114
            );
        };

        for (
            let y = step;
            y < canvas.height - step;
            y += step
        ) {
            for (
                let x = step;
                x < canvas.width - step;
                x += step
            ) {
                const value = luminanceAt(x, y);
                const right = luminanceAt(
                    Math.min(
                        canvas.width - 1,
                        x + step
                    ),
                    y
                );
                const down = luminanceAt(
                    x,
                    Math.min(
                        canvas.height - 1,
                        y + step
                    )
                );

                brightnessSum += value;
                gradientSum +=
                    Math.abs(value - right) +
                    Math.abs(value - down);
                glareCount +=
                    value >= 247 ? 1 : 0;
                darkCount +=
                    value <= 28 ? 1 : 0;
                samples += 1;
            }
        }

        const brightness =
            samples > 0
                ? brightnessSum / samples
                : 0;
        const edgeScore =
            samples > 0
                ? gradientSum / samples
                : 0;
        const glareRatio =
            samples > 0
                ? glareCount / samples
                : 0;
        const darkRatio =
            samples > 0
                ? darkCount / samples
                : 0;
        const warnings = [];

        if (brightness < 65) {
            warnings.push("zu dunkel");
        }
        if (brightness > 220) {
            warnings.push("zu hell");
        }
        if (glareRatio > 0.16) {
            warnings.push("starke Reflexionen");
        }
        if (darkRatio > 0.36) {
            warnings.push("große dunkle Flächen");
        }
        if (edgeScore < 13) {
            warnings.push("möglicherweise unscharf");
        }

        return {
            brightness:
                Math.round(brightness),
            edgeScore:
                Math.round(
                    edgeScore * 10
                ) / 10,
            glarePercent:
                Math.round(
                    glareRatio * 100
                ),
            darkPercent:
                Math.round(
                    darkRatio * 100
                ),
            warnings,
            good:
                warnings.length === 0
        };
    }

    function captureFrame(videoElement) {
        if (
            videoElement.readyState <
            global.HTMLMediaElement.HAVE_CURRENT_DATA ||
            !videoElement.videoWidth ||
            !videoElement.videoHeight
        ) {
            throw new Error(
                "Das Kamerabild ist noch nicht bereit. Bitte kurz warten und erneut auslösen."
            );
        }

        const canvas =
            document.createElement("canvas");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        const context = canvas.getContext(
            "2d",
            { willReadFrequently: true }
        );

        if (!context) {
            throw new Error(
                "Die Label-Aufnahme konnte nicht verarbeitet werden."
            );
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(
            videoElement,
            0,
            0,
            canvas.width,
            canvas.height
        );

        const quality =
            calculateImageQuality(
                canvas,
                context
            );

        lastDiagnostics = {
            resolution:
                `${canvas.width}×${canvas.height}`,
            quality,
            qrAttempts: [],
            qrEngine: mode || "UNKNOWN",
            qrFoundBy: ""
        };

        return {
            canvas,
            context,
            quality,
            dataUrl:
                canvas.toDataURL(
                    "image/jpeg",
                    0.94
                )
        };
    }

    function cloneRegionCanvas(
        sourceCanvas,
        x,
        y,
        width,
        height,
        targetMinWidth = 0
    ) {
        const scale =
            targetMinWidth > 0 &&
            width < targetMinWidth
                ? Math.min(
                    3,
                    targetMinWidth / width
                )
                : 1;

        const canvas =
            document.createElement("canvas");
        canvas.width =
            Math.max(
                1,
                Math.round(width * scale)
            );
        canvas.height =
            Math.max(
                1,
                Math.round(height * scale)
            );

        const context = canvas.getContext(
            "2d",
            { willReadFrequently: true }
        );

        context.imageSmoothingEnabled = false;
        context.drawImage(
            sourceCanvas,
            x,
            y,
            width,
            height,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return {
            canvas,
            context
        };
    }

    function createEnhancedCanvas(
        sourceCanvas,
        modeName
    ) {
        const canvas =
            document.createElement("canvas");
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const context = canvas.getContext(
            "2d",
            { willReadFrequently: true }
        );
        context.drawImage(
            sourceCanvas,
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
        const data = imageData.data;
        let sum = 0;
        let count = 0;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const luminance =
                data[index] * 0.299 +
                data[index + 1] * 0.587 +
                data[index + 2] * 0.114;
            sum += luminance;
            count += 1;
        }

        const mean =
            count > 0
                ? sum / count
                : 128;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const luminance =
                data[index] * 0.299 +
                data[index + 1] * 0.587 +
                data[index + 2] * 0.114;

            let value = luminance;

            if (modeName === "contrast") {
                value =
                    Math.max(
                        0,
                        Math.min(
                            255,
                            (luminance - 128) *
                            1.7 +
                            128
                        )
                    );
            }
            else if (modeName === "threshold") {
                value =
                    luminance >= mean
                        ? 255
                        : 0;
            }

            data[index] = value;
            data[index + 1] = value;
            data[index + 2] = value;
        }

        context.putImageData(
            imageData,
            0,
            0
        );

        return {
            canvas,
            context
        };
    }

    function decodeWithJsQr(
        canvas,
        context,
        label
    ) {
        if (typeof global.jsQR !== "function") {
            return "";
        }

        if (lastDiagnostics) {
            lastDiagnostics.qrAttempts.push(
                label
            );
        }

        const imageData =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

        const result = global.jsQR(
            imageData.data,
            canvas.width,
            canvas.height,
            {
                inversionAttempts:
                    "attemptBoth"
            }
        );

        if (result && result.data) {
            if (lastDiagnostics) {
                lastDiagnostics.qrFoundBy =
                    label;
            }
            return String(
                result.data
            ).trim();
        }

        return "";
    }

    function getTileRegions(canvas) {
        const regions = [];
        const width = canvas.width;
        const height = canvas.height;

        regions.push({
            label: "Zentrum 82%",
            x: Math.round(width * 0.09),
            y: Math.round(height * 0.09),
            width: Math.round(width * 0.82),
            height: Math.round(height * 0.82)
        });

        const tileWidth =
            Math.round(width * 0.62);
        const tileHeight =
            Math.round(height * 0.62);
        const xPositions = [
            0,
            width - tileWidth
        ];
        const yPositions = [
            0,
            height - tileHeight
        ];

        for (
            let yIndex = 0;
            yIndex < yPositions.length;
            yIndex += 1
        ) {
            for (
                let xIndex = 0;
                xIndex < xPositions.length;
                xIndex += 1
            ) {
                regions.push({
                    label:
                        `Teilbild ${yIndex + 1}.${xIndex + 1}`,
                    x:
                        Math.max(
                            0,
                            xPositions[xIndex]
                        ),
                    y:
                        Math.max(
                            0,
                            yPositions[yIndex]
                        ),
                    width:
                        tileWidth,
                    height:
                        tileHeight
                });
            }
        }

        return regions;
    }

    async function detectQr(canvas, context) {
        if (!lastDiagnostics) {
            lastDiagnostics = {
                resolution:
                    `${canvas.width}×${canvas.height}`,
                quality:
                    calculateImageQuality(
                        canvas,
                        context
                    ),
                qrAttempts: [],
                qrEngine:
                    mode || "UNKNOWN",
                qrFoundBy: ""
            };
        }

        if (
            mode === "BARCODE_DETECTOR" &&
            detector
        ) {
            try {
                lastDiagnostics.qrAttempts.push(
                    "BarcodeDetector Vollbild"
                );

                const barcodes =
                    await detector.detect(
                        canvas
                    );

                if (barcodes.length > 0) {
                    const raw = String(
                        barcodes[0].rawValue || ""
                    ).trim();

                    if (raw) {
                        lastDiagnostics.qrFoundBy =
                            "BarcodeDetector Vollbild";
                        return raw;
                    }
                }
            }
            catch (error) {
                console.warn(
                    "BarcodeDetector konnte das Bild nicht auswerten. jsQR wird versucht.",
                    error
                );
            }
        }

        let value = decodeWithJsQr(
            canvas,
            context,
            "jsQR Vollbild"
        );

        if (value) {
            return value;
        }

        for (const enhancement of [
            "contrast",
            "threshold"
        ]) {
            const enhanced =
                createEnhancedCanvas(
                    canvas,
                    enhancement
                );
            value = decodeWithJsQr(
                enhanced.canvas,
                enhanced.context,
                `jsQR Vollbild ${enhancement}`
            );

            if (value) {
                return value;
            }
        }

        for (
            const region of
            getTileRegions(canvas)
        ) {
            const tile =
                cloneRegionCanvas(
                    canvas,
                    region.x,
                    region.y,
                    region.width,
                    region.height,
                    1400
                );

            value = decodeWithJsQr(
                tile.canvas,
                tile.context,
                `jsQR ${region.label}`
            );

            if (value) {
                return value;
            }

            const enhanced =
                createEnhancedCanvas(
                    tile.canvas,
                    "contrast"
                );

            value = decodeWithJsQr(
                enhanced.canvas,
                enhanced.context,
                `jsQR ${region.label} Kontrast`
            );

            if (value) {
                return value;
            }
        }

        return "";
    }

    function getMode() {
        return mode;
    }

    function getLastDiagnostics() {
        if (!lastDiagnostics) {
            return null;
        }

        return JSON.parse(
            JSON.stringify(
                lastDiagnostics
            )
        );
    }

    global.TeiletrackingScannerService =
        Object.freeze({
            startCamera,
            stopCamera,
            captureFrame,
            detectQr,
            getMode,
            getLastDiagnostics,
            getErrorMessage
        });
})(window);

"use strict";

(function initializeScannerService(global) {
    let stream = null;
    let activeTrack = null;
    let detector = null;
    let engineMode = "UNINITIALIZED";
    let lastDiagnostics = null;
    let liveTimer = null;
    let liveBusy = false;
    let lastLiveQrText = "";
    let lastLiveQrAt = null;
    let pendingHighResolutionCapture = null;
    let bypassNextCaptureClick = false;
    let zxingLoadPromise = null;

    const ZXING_SCRIPT_URL =
        "https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.4/dist/iife/reader/index.js";

    const LIVE_SCAN_INTERVAL_MS = 420;
    const LIVE_SCAN_MAX_WIDTH = 960;

    function delay(milliseconds) {
        return new Promise(resolve => {
            global.setTimeout(
                resolve,
                milliseconds
            );
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

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const existing =
                Array.from(
                    document.scripts
                ).find(
                    script => script.src === url
                );

            if (existing) {
                if (
                    global.ZXingWASM &&
                    typeof global.ZXingWASM.readBarcodes ===
                    "function"
                ) {
                    resolve();
                    return;
                }

                existing.addEventListener(
                    "load",
                    resolve,
                    { once: true }
                );
                existing.addEventListener(
                    "error",
                    () => reject(
                        new Error(
                            "ZXing-WASM konnte nicht geladen werden."
                        )
                    ),
                    { once: true }
                );
                return;
            }

            const script =
                document.createElement(
                    "script"
                );

            script.src = url;
            script.async = true;
            script.crossOrigin = "anonymous";

            script.addEventListener(
                "load",
                resolve,
                { once: true }
            );

            script.addEventListener(
                "error",
                () => reject(
                    new Error(
                        "ZXing-WASM konnte nicht geladen werden."
                    )
                ),
                { once: true }
            );

            document.head.appendChild(script);
        });
    }

    async function ensureZxingWasm() {
        if (
            global.ZXingWASM &&
            typeof global.ZXingWASM.readBarcodes ===
            "function"
        ) {
            return true;
        }

        if (!zxingLoadPromise) {
            zxingLoadPromise =
                loadScript(
                    ZXING_SCRIPT_URL
                );
        }

        try {
            await zxingLoadPromise;

            if (
                !global.ZXingWASM ||
                typeof global.ZXingWASM.readBarcodes !==
                "function"
            ) {
                return false;
            }

            if (
                typeof global.ZXingWASM.prepareZXingModule ===
                "function"
            ) {
                try {
                    await global.ZXingWASM
                        .prepareZXingModule({
                            fireImmediately: true
                        });
                }
                catch (error) {
                    console.warn(
                        "ZXing-WASM konnte nicht vorab initialisiert werden. Der Scan versucht es erneut.",
                        error
                    );
                }
            }

            return true;
        }
        catch (error) {
            console.warn(
                "ZXing-WASM konnte nicht geladen werden. Browser-Fallback wird verwendet.",
                error
            );

            zxingLoadPromise = null;
            return false;
        }
    }

    async function initializeQrEngine() {
        detector = null;
        engineMode = "UNAVAILABLE";

        if (await ensureZxingWasm()) {
            engineMode = "ZXING_WASM";
            return engineMode;
        }

        if ("BarcodeDetector" in global) {
            try {
                let supportsQr = true;

                if (
                    typeof global.BarcodeDetector.getSupportedFormats ===
                    "function"
                ) {
                    const supportedFormats =
                        await global.BarcodeDetector
                            .getSupportedFormats();

                    supportsQr =
                        supportedFormats
                            .includes(
                                "qr_code"
                            );
                }

                if (supportsQr) {
                    detector =
                        new global.BarcodeDetector({
                            formats: [
                                "qr_code"
                            ]
                        });

                    engineMode =
                        "BARCODE_DETECTOR";

                    return engineMode;
                }
            }
            catch (error) {
                console.warn(
                    "Native BarcodeDetector-Erkennung ist nicht verfügbar.",
                    error
                );
            }
        }

        if (typeof global.jsQR === "function") {
            engineMode = "JSQR";
            return engineMode;
        }

        throw new Error(
            "Keine QR-Engine verfügbar. ZXing-WASM, BarcodeDetector und jsQR konnten nicht geladen werden."
        );
    }

    async function applyBestCameraConstraints(
        track
    ) {
        if (!track) {
            return;
        }

        try {
            const capabilities =
                typeof track.getCapabilities ===
                "function"
                    ? track.getCapabilities()
                    : {};

            const advanced = {};

            if (
                Array.isArray(
                    capabilities.focusMode
                ) &&
                capabilities.focusMode
                    .includes(
                        "continuous"
                    )
            ) {
                advanced.focusMode =
                    "continuous";
            }

            if (
                capabilities.zoom &&
                Number.isFinite(
                    Number(
                        capabilities.zoom.min
                    )
                )
            ) {
                const min =
                    Number(
                        capabilities.zoom.min
                    );
                const max =
                    Number(
                        capabilities.zoom.max
                    );

                const preferred =
                    Math.min(
                        max,
                        Math.max(
                            min,
                            min +
                            (
                                max - min
                            ) * 0.08
                        )
                    );

                if (
                    Number.isFinite(
                        preferred
                    )
                ) {
                    advanced.zoom =
                        preferred;
                }
            }

            if (
                Object.keys(
                    advanced
                ).length > 0
            ) {
                await track.applyConstraints({
                    advanced: [
                        advanced
                    ]
                });
            }
        }
        catch (error) {
            console.warn(
                "Optimierte Kameraeinstellungen konnten nicht angewendet werden.",
                error
            );
        }
    }

    async function waitForVideoReady(
        videoElement
    ) {
        if (
            videoElement.videoWidth &&
            videoElement.videoHeight
        ) {
            await delay(250);
            return;
        }

        await new Promise(
            (resolve, reject) => {
                const timeoutId =
                    global.setTimeout(
                        () => reject(
                            new Error(
                                "Die Kamera liefert noch kein stabiles Bild."
                            )
                        ),
                        5000
                    );

                videoElement
                    .addEventListener(
                        "loadedmetadata",
                        () => {
                            global.clearTimeout(
                                timeoutId
                            );
                            resolve();
                        },
                        { once: true }
                    );
            }
        );

        await delay(250);
    }

    function calculateImageQuality(
        canvas,
        context
    ) {
        const targetWidth =
            Math.min(
                canvas.width,
                900
            );

        const scale =
            targetWidth /
            canvas.width;

        const targetHeight =
            Math.max(
                1,
                Math.round(
                    canvas.height *
                    scale
                )
            );

        const sample =
            document.createElement(
                "canvas"
            );

        sample.width = targetWidth;
        sample.height = targetHeight;

        const sampleContext =
            sample.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );

        sampleContext.drawImage(
            canvas,
            0,
            0,
            targetWidth,
            targetHeight
        );

        const imageData =
            sampleContext.getImageData(
                0,
                0,
                targetWidth,
                targetHeight
            );

        const data = imageData.data;
        let brightnessSum = 0;
        let glare = 0;
        let dark = 0;
        let gradient = 0;
        let samples = 0;

        const luminanceAt = index =>
            data[index] * 0.299 +
            data[index + 1] * 0.587 +
            data[index + 2] * 0.114;

        for (
            let y = 1;
            y < targetHeight - 1;
            y += 2
        ) {
            for (
                let x = 1;
                x < targetWidth - 1;
                x += 2
            ) {
                const index =
                    (
                        y *
                        targetWidth +
                        x
                    ) * 4;

                const rightIndex =
                    (
                        y *
                        targetWidth +
                        x + 1
                    ) * 4;

                const downIndex =
                    (
                        (
                            y + 1
                        ) *
                        targetWidth +
                        x
                    ) * 4;

                const value =
                    luminanceAt(
                        index
                    );

                brightnessSum += value;
                glare +=
                    value >= 247
                        ? 1
                        : 0;
                dark +=
                    value <= 28
                        ? 1
                        : 0;

                gradient +=
                    Math.abs(
                        value -
                        luminanceAt(
                            rightIndex
                        )
                    ) +
                    Math.abs(
                        value -
                        luminanceAt(
                            downIndex
                        )
                    );

                samples += 1;
            }
        }

        const brightness =
            samples
                ? brightnessSum /
                  samples
                : 0;

        const edgeScore =
            samples
                ? gradient /
                  samples
                : 0;

        const glareRatio =
            samples
                ? glare /
                  samples
                : 0;

        const darkRatio =
            samples
                ? dark /
                  samples
                : 0;

        const warnings = [];

        if (brightness < 58) {
            warnings.push(
                "zu dunkel"
            );
        }

        if (brightness > 225) {
            warnings.push(
                "zu hell"
            );
        }

        if (glareRatio > 0.18) {
            warnings.push(
                "starke Reflexionen"
            );
        }

        if (darkRatio > 0.42) {
            warnings.push(
                "große dunkle Flächen"
            );
        }

        if (edgeScore < 10) {
            warnings.push(
                "möglicherweise unscharf"
            );
        }

        return {
            brightness:
                Math.round(
                    brightness
                ),
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

    function canvasFromVideo(
        videoElement,
        maxWidth = 0
    ) {
        if (
            videoElement.readyState <
            global.HTMLMediaElement
                .HAVE_CURRENT_DATA ||
            !videoElement.videoWidth ||
            !videoElement.videoHeight
        ) {
            throw new Error(
                "Das Kamerabild ist noch nicht bereit. Bitte kurz warten und erneut auslösen."
            );
        }

        const scale =
            maxWidth > 0 &&
            videoElement.videoWidth >
                maxWidth
                ? maxWidth /
                  videoElement.videoWidth
                : 1;

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            Math.max(
                1,
                Math.round(
                    videoElement.videoWidth *
                    scale
                )
            );

        canvas.height =
            Math.max(
                1,
                Math.round(
                    videoElement.videoHeight *
                    scale
                )
            );

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );

        context.imageSmoothingEnabled =
            true;
        context.imageSmoothingQuality =
            "high";

        context.drawImage(
            videoElement,
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

    async function canvasFromBlob(blob) {
        const bitmap =
            await global.createImageBitmap(
                blob
            );

        try {
            const canvas =
                document.createElement(
                    "canvas"
                );

            canvas.width = bitmap.width;
            canvas.height = bitmap.height;

            const context =
                canvas.getContext(
                    "2d",
                    {
                        willReadFrequently:
                            true
                    }
                );

            context.drawImage(
                bitmap,
                0,
                0
            );

            return {
                canvas,
                context
            };
        }
        finally {
            if (
                typeof bitmap.close ===
                "function"
            ) {
                bitmap.close();
            }
        }
    }

    async function captureBestStill(
        videoElement
    ) {
        let captureSource =
            "Videoframe";
        let capture = null;

        if (
            activeTrack &&
            "ImageCapture" in global
        ) {
            try {
                const imageCapture =
                    new global.ImageCapture(
                        activeTrack
                    );

                if (
                    typeof imageCapture.takePhoto ===
                    "function"
                ) {
                    const blob =
                        await imageCapture
                            .takePhoto();

                    capture =
                        await canvasFromBlob(
                            blob
                        );

                    captureSource =
                        "Kamera-Foto";
                }
            }
            catch (error) {
                console.warn(
                    "Hochauflösendes Kamera-Foto nicht verfügbar. Videoframe wird verwendet.",
                    error
                );
            }
        }

        if (!capture) {
            capture =
                canvasFromVideo(
                    videoElement
                );
        }

        const quality =
            calculateImageQuality(
                capture.canvas,
                capture.context
            );

        lastDiagnostics = {
            resolution:
                `${capture.canvas.width}×${capture.canvas.height}`,
            captureSource,
            quality,
            qrAttempts: [],
            qrEngine:
                engineMode,
            qrFoundBy: "",
            liveQrText:
                lastLiveQrText,
            liveQrAt:
                lastLiveQrAt
        };

        return {
            ...capture,
            quality,
            captureSource,
            dataUrl:
                capture.canvas
                    .toDataURL(
                        "image/jpeg",
                        0.94
                    )
        };
    }

    function captureFrame(videoElement) {
        if (
            pendingHighResolutionCapture
        ) {
            const prepared =
                pendingHighResolutionCapture;

            pendingHighResolutionCapture =
                null;

            lastDiagnostics =
                prepared.diagnostics;

            return {
                canvas:
                    prepared.canvas,
                context:
                    prepared.context,
                quality:
                    prepared.quality,
                dataUrl:
                    prepared.dataUrl,
                captureSource:
                    prepared.captureSource
            };
        }

        const capture =
            canvasFromVideo(
                videoElement
            );

        const quality =
            calculateImageQuality(
                capture.canvas,
                capture.context
            );

        lastDiagnostics = {
            resolution:
                `${capture.canvas.width}×${capture.canvas.height}`,
            captureSource:
                "Videoframe",
            quality,
            qrAttempts: [],
            qrEngine:
                engineMode,
            qrFoundBy: "",
            liveQrText:
                lastLiveQrText,
            liveQrAt:
                lastLiveQrAt
        };

        return {
            ...capture,
            quality,
            dataUrl:
                capture.canvas
                    .toDataURL(
                        "image/jpeg",
                        0.94
                    ),
            captureSource:
                "Videoframe"
        };
    }

    function cloneRegionCanvas(
        sourceCanvas,
        x,
        y,
        width,
        height,
        targetWidth = 0
    ) {
        const scale =
            targetWidth > 0 &&
            width > targetWidth
                ? targetWidth /
                  width
                : 1;

        const canvas =
            document.createElement(
                "canvas"
            );

        canvas.width =
            Math.max(
                1,
                Math.round(
                    width * scale
                )
            );

        canvas.height =
            Math.max(
                1,
                Math.round(
                    height * scale
                )
            );

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );

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

    async function decodeWithZxing(
        canvas,
        label
    ) {
        if (
            !global.ZXingWASM ||
            typeof global.ZXingWASM.readBarcodes !==
            "function"
        ) {
            return "";
        }

        if (lastDiagnostics) {
            lastDiagnostics.qrAttempts
                .push(label);
        }

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );

        const imageData =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

        const results =
            await global.ZXingWASM
                .readBarcodes(
                    imageData,
                    {
                        formats: [
                            "QRCode",
                            "DataMatrix"
                        ],
                        tryHarder: true,
                        tryRotate: true,
                        tryInvert: true,
                        tryDownscale: true,
                        tryDenoise: true,
                        maxNumberOfSymbols: 1
                    }
                );

        const result =
            Array.isArray(results)
                ? results.find(
                    item =>
                        item &&
                        item.isValid !==
                            false &&
                        String(
                            item.text ||
                            ""
                        ).trim()
                )
                : null;

        if (!result) {
            return "";
        }

        const text =
            String(
                result.text || ""
            ).trim();

        if (
            text &&
            lastDiagnostics
        ) {
            lastDiagnostics.qrFoundBy =
                label;
        }

        return text;
    }

    async function decodeWithBarcodeDetector(
        canvas,
        label
    ) {
        if (!detector) {
            return "";
        }

        if (lastDiagnostics) {
            lastDiagnostics.qrAttempts
                .push(label);
        }

        try {
            const barcodes =
                await detector.detect(
                    canvas
                );

            const raw =
                barcodes &&
                barcodes[0]
                    ? String(
                        barcodes[0]
                            .rawValue ||
                        ""
                    ).trim()
                    : "";

            if (
                raw &&
                lastDiagnostics
            ) {
                lastDiagnostics.qrFoundBy =
                    label;
            }

            return raw;
        }
        catch {
            return "";
        }
    }

    function decodeWithJsQr(
        canvas,
        label
    ) {
        if (
            typeof global.jsQR !==
            "function"
        ) {
            return "";
        }

        if (lastDiagnostics) {
            lastDiagnostics.qrAttempts
                .push(label);
        }

        const context =
            canvas.getContext(
                "2d",
                {
                    willReadFrequently:
                        true
                }
            );

        const imageData =
            context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

        const result =
            global.jsQR(
                imageData.data,
                canvas.width,
                canvas.height,
                {
                    inversionAttempts:
                        "attemptBoth"
                }
            );

        const text =
            result &&
            result.data
                ? String(
                    result.data
                ).trim()
                : "";

        if (
            text &&
            lastDiagnostics
        ) {
            lastDiagnostics.qrFoundBy =
                label;
        }

        return text;
    }

    async function decodeSingleCanvas(
        canvas,
        label
    ) {
        let value = "";

        if (
            engineMode ===
            "ZXING_WASM"
        ) {
            try {
                value =
                    await decodeWithZxing(
                        canvas,
                        `ZXing ${label}`
                    );
            }
            catch (error) {
                console.warn(
                    "ZXing-WASM Scan fehlgeschlagen. Fallback wird versucht.",
                    error
                );
            }
        }

        if (
            !value &&
            detector
        ) {
            value =
                await decodeWithBarcodeDetector(
                    canvas,
                    `BarcodeDetector ${label}`
                );
        }

        if (!value) {
            value =
                decodeWithJsQr(
                    canvas,
                    `jsQR ${label}`
                );
        }

        return value;
    }

    async function detectQr(
        canvas,
        context,
        options = {}
    ) {
        if (!lastDiagnostics) {
            lastDiagnostics = {
                resolution:
                    `${canvas.width}×${canvas.height}`,
                captureSource:
                    "Bild",
                quality:
                    calculateImageQuality(
                        canvas,
                        context
                    ),
                qrAttempts: [],
                qrEngine:
                    engineMode,
                qrFoundBy: "",
                liveQrText:
                    lastLiveQrText,
                liveQrAt:
                    lastLiveQrAt
            };
        }

        if (
            !options.ignoreLiveCache &&
            lastLiveQrText
        ) {
            lastDiagnostics.qrAttempts
                .push(
                    "Live-Scan Treffer"
                );

            lastDiagnostics.qrFoundBy =
                "ZXing Live-Scan";

            return lastLiveQrText;
        }

        let value =
            await decodeSingleCanvas(
                canvas,
                "Vollbild"
            );

        if (value) {
            return value;
        }

        const width = canvas.width;
        const height = canvas.height;

        const regions = [
            [
                "Zentrum 85%",
                0.075,
                0.075,
                0.85,
                0.85
            ],
            [
                "Mitte links",
                0.0,
                0.12,
                0.68,
                0.76
            ],
            [
                "Mitte rechts",
                0.32,
                0.12,
                0.68,
                0.76
            ],
            [
                "Oben",
                0.08,
                0.0,
                0.84,
                0.68
            ],
            [
                "Unten",
                0.08,
                0.32,
                0.84,
                0.68
            ]
        ];

        for (
            const [
                label,
                rx,
                ry,
                rw,
                rh
            ] of regions
        ) {
            const region =
                cloneRegionCanvas(
                    canvas,
                    Math.round(
                        width * rx
                    ),
                    Math.round(
                        height * ry
                    ),
                    Math.round(
                        width * rw
                    ),
                    Math.round(
                        height * rh
                    ),
                    1800
                );

            value =
                await decodeSingleCanvas(
                    region.canvas,
                    label
                );

            if (value) {
                return value;
            }
        }

        return "";
    }

    async function scanLiveFrame(
        videoElement
    ) {
        if (
            liveBusy ||
            !stream ||
            !videoElement.videoWidth
        ) {
            return;
        }

        liveBusy = true;

        try {
            const { canvas } =
                canvasFromVideo(
                    videoElement,
                    LIVE_SCAN_MAX_WIDTH
                );

            const text =
                await decodeSingleCanvas(
                    canvas,
                    "Live"
                );

            if (text) {
                lastLiveQrText = text;
                lastLiveQrAt =
                    new Date()
                        .toISOString();

                updateLiveUi(
                    text
                );
            }
        }
        catch (error) {
            console.debug(
                "Live-QR-Scan ohne Treffer:",
                error
            );
        }
        finally {
            liveBusy = false;
        }
    }

    function startLiveLoop(
        videoElement
    ) {
        stopLiveLoop();

        liveTimer =
            global.setInterval(
                () => {
                    scanLiveFrame(
                        videoElement
                    );
                },
                LIVE_SCAN_INTERVAL_MS
            );
    }

    function stopLiveLoop() {
        if (liveTimer) {
            global.clearInterval(
                liveTimer
            );

            liveTimer = null;
        }

        liveBusy = false;
    }

    async function startCamera(
        videoElement
    ) {
        stopCamera(
            videoElement
        );

        assertCameraEnvironment();
        await initializeQrEngine();

        lastLiveQrText = "";
        lastLiveQrAt = null;
        pendingHighResolutionCapture =
            null;

        stream =
            await global.navigator
                .mediaDevices
                .getUserMedia({
                    audio: false,
                    video: {
                        facingMode: {
                            ideal:
                                "environment"
                        },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });

        [activeTrack] =
            stream.getVideoTracks();

        await applyBestCameraConstraints(
            activeTrack
        );

        videoElement.srcObject =
            stream;

        await videoElement.play();
        await waitForVideoReady(
            videoElement
        );

        const settings =
            activeTrack &&
            typeof activeTrack.getSettings ===
            "function"
                ? activeTrack.getSettings()
                : {};

        startLiveLoop(
            videoElement
        );

        return {
            mode:
                engineMode,
            displayName:
                engineMode ===
                "ZXING_WASM"
                    ? "ZXing-C++ WebAssembly"
                    : engineMode ===
                      "BARCODE_DETECTOR"
                        ? "Browser BarcodeDetector"
                        : "jsQR Fallback",
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
        stopLiveLoop();

        pendingHighResolutionCapture =
            null;

        if (stream) {
            for (
                const track of
                stream.getTracks()
            ) {
                track.stop();
            }

            stream = null;
        }

        activeTrack = null;

        if (videoElement) {
            videoElement.srcObject =
                null;
        }

        detector = null;
    }

    function updateLiveUi(qrText) {
        const qrInput =
            document.getElementById(
                "qrInput"
            );

        const result =
            document.getElementById(
                "qrScanResult"
            );

        const status =
            document.getElementById(
                "qrScannerStatus"
            );

        const diagnostics =
            document.getElementById(
                "scannerDiagnostics"
            );

        if (qrInput) {
            qrInput.value = qrText;
        }

        if (result) {
            result.textContent =
                "2D-Code live erkannt.";

            result.classList.remove(
                "error"
            );

            result.classList.add(
                "success"
            );
        }

        if (status) {
            status.textContent =
                "QR-/DataMatrix-Code erkannt. Jetzt Foto aufnehmen, damit die sichtbare Beschriftung per OCR geprüft wird.";

            status.classList.remove(
                "error"
            );

            status.classList.add(
                "success"
            );
        }

        if (diagnostics) {
            diagnostics.textContent =
                `2D-Code live erkannt · ${engineMode} · ${new Date(lastLiveQrAt).toLocaleTimeString()}`;

            diagnostics.classList.add(
                "good"
            );
        }
    }

    async function prepareHighResolutionCapture(
        button
    ) {
        const video =
            document.getElementById(
                "qrScannerVideo"
            );

        const status =
            document.getElementById(
                "qrScannerStatus"
            );

        if (
            !video ||
            !stream
        ) {
            return;
        }

        if (status) {
            status.textContent =
                "Hochauflösendes Label-Foto wird aufgenommen …";

            status.classList.remove(
                "error"
            );
        }

        try {
            const capture =
                await captureBestStill(
                    video
                );

            pendingHighResolutionCapture = {
                ...capture,
                diagnostics:
                    JSON.parse(
                        JSON.stringify(
                            lastDiagnostics
                        )
                    )
            };
        }
        catch (error) {
            console.warn(
                "Hochauflösende Aufnahme fehlgeschlagen. Videoframe wird verwendet.",
                error
            );

            pendingHighResolutionCapture =
                null;
        }

        bypassNextCaptureClick = true;
        button.disabled = false;
        button.click();
    }

    function installCompactScannerUi() {
        if (
            document.getElementById(
                "scannerCompactV2Styles"
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "scannerCompactV2Styles";

        style.textContent = `
            .scanner-overlay {
                align-items: center !important;
                padding: 12px !important;
            }

            .scanner-dialog {
                width: min(560px, 100%) !important;
                max-height: calc(100vh - 24px) !important;
                min-height: 0 !important;
                overflow-y: auto !important;
                border-radius: 12px !important;
            }

            .scanner-header {
                align-items: center !important;
                padding: 11px 14px !important;
            }

            .scanner-header h2 {
                margin-bottom: 0 !important;
                font-size: 1.05rem !important;
            }

            .scanner-header .eyebrow {
                margin-bottom: 2px !important;
            }

            .scanner-close-button {
                width: 34px !important;
                height: 34px !important;
                flex: 0 0 34px !important;
                font-size: 1.25rem !important;
            }

            .scanner-content {
                gap: 8px !important;
                padding: 10px 14px 14px !important;
            }

            .scanner-video-shell {
                width: min(100%, 470px) !important;
                max-height: 40vh !important;
                margin: 0 auto !important;
                aspect-ratio: 4 / 3 !important;
                border-radius: 9px !important;
            }

            .scanner-target {
                inset: 15% !important;
                width: auto !important;
                height: auto !important;
            }

            .scanner-target span {
                width: 30px !important;
                height: 30px !important;
            }

            .scanner-status,
            .scanner-diagnostics {
                padding: 7px 9px !important;
                font-size: 0.77rem !important;
                line-height: 1.35 !important;
            }

            .scanner-actions {
                gap: 6px !important;
            }

            .scanner-actions .button {
                min-height: 35px !important;
                padding: 0 11px !important;
                font-size: 0.8rem !important;
            }

            .scanner-trigger-button {
                min-width: 155px !important;
            }

            .scanner-content > .hint {
                margin-top: 1px !important;
                font-size: 0.74rem !important;
                line-height: 1.3 !important;
            }

            @media (max-width: 720px) {
                .scanner-overlay {
                    padding: 8px !important;
                }

                .scanner-dialog {
                    max-height: calc(100vh - 16px) !important;
                    border-radius: 10px !important;
                }

                .scanner-video-shell {
                    max-height: 36vh !important;
                    aspect-ratio: 4 / 3 !important;
                }

                .scanner-actions {
                    display: grid !important;
                    grid-template-columns: 1fr 1fr !important;
                }

                .scanner-actions .scanner-trigger-button {
                    grid-column: 1 / -1 !important;
                }
            }
        `;

        document.head.appendChild(
            style
        );

        const title =
            document.getElementById(
                "qrScannerTitle"
            );

        const captureButton =
            document.getElementById(
                "captureLabelButton"
            );

        if (title) {
            title.textContent =
                "QR / DataMatrix & Label scannen";
        }

        if (captureButton) {
            captureButton.textContent =
                "Foto aufnehmen & prüfen";

            captureButton.addEventListener(
                "click",
                event => {
                    if (
                        bypassNextCaptureClick
                    ) {
                        bypassNextCaptureClick =
                            false;
                        return;
                    }

                    if (
                        !stream ||
                        !activeTrack
                    ) {
                        return;
                    }

                    event.preventDefault();
                    event.stopImmediatePropagation();

                    captureButton.disabled =
                        true;

                    prepareHighResolutionCapture(
                        captureButton
                    );
                },
                true
            );
        }
    }

    function installUiWhenReady() {
        if (
            document.readyState ===
            "loading"
        ) {
            document.addEventListener(
                "DOMContentLoaded",
                installCompactScannerUi,
                { once: true }
            );
            return;
        }

        installCompactScannerUi();
    }

    function getMode() {
        return engineMode;
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

    function getLiveQrText() {
        return lastLiveQrText;
    }

    installUiWhenReady();

    global.TeiletrackingScannerService =
        Object.freeze({
            startCamera,
            stopCamera,
            captureFrame,
            captureBestStill,
            detectQr,
            getMode,
            getLastDiagnostics,
            getLiveQrText,
            getErrorMessage
        });
})(window);

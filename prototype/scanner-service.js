"use strict";

(function initializeScannerService(global) {
    let stream = null;
    let detector = null;
    let mode = null;

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
            "Die QR-Erkennung ist in diesem Browser nicht verfügbar und der jsQR-Fallback konnte nicht geladen werden. Bitte prüfe die Internetverbindung und lade die Seite neu."
        );
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
                        ideal: 1280
                    },
                    height: {
                        ideal: 720
                    }
                }
            });

        videoElement.srcObject = stream;
        await videoElement.play();

        return {
            mode,
            displayName:
                mode === "BARCODE_DETECTOR"
                    ? "native Browser-Erkennung"
                    : "jsQR-Fallback"
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

        const canvas = document.createElement("canvas");
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

        context.drawImage(
            videoElement,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return {
            canvas,
            context,
            dataUrl:
                canvas.toDataURL(
                    "image/jpeg",
                    0.92
                )
        };
    }

    async function detectQr(canvas, context) {
        if (
            mode === "BARCODE_DETECTOR" &&
            detector
        ) {
            const barcodes =
                await detector.detect(canvas);

            if (barcodes.length > 0) {
                return String(
                    barcodes[0].rawValue || ""
                ).trim();
            }
        }

        if (typeof global.jsQR === "function") {
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

            if (result && result.data) {
                return String(
                    result.data
                ).trim();
            }
        }

        return "";
    }

    function getMode() {
        return mode;
    }

    global.TeiletrackingScannerService = Object.freeze({
        startCamera,
        stopCamera,
        captureFrame,
        detectQr,
        getMode,
        getErrorMessage
    });
})(window);

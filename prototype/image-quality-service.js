"use strict";

(function initializeImageQualityService(global) {
    const DEFAULTS = Object.freeze({
        frameCount: 5,
        intervalMs: 160,
        sampleWidth: 640,
        minSharpness: 11,
        minBrightness: 48,
        maxBrightness: 228,
        maxGlarePercent: 20,
        maxMotion: 24
    });

    function delay(milliseconds) {
        return new Promise(resolve =>
            global.setTimeout(resolve, milliseconds)
        );
    }

    function createFrame(video, sampleWidth = DEFAULTS.sampleWidth) {
        if (!video || !video.videoWidth || !video.videoHeight) {
            throw new Error("Die Kamera liefert noch kein auswertbares Bild.");
        }

        const scale = Math.min(1, sampleWidth / video.videoWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return { canvas, context };
    }

    function analyzeImageData(imageData, previousImageData = null) {
        const { data, width, height } = imageData;
        let brightnessSum = 0;
        let gradientSum = 0;
        let glare = 0;
        let dark = 0;
        let motionSum = 0;
        let samples = 0;

        const luminanceAt = index =>
            data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;

        for (let y = 1; y < height - 1; y += 2) {
            for (let x = 1; x < width - 1; x += 2) {
                const index = (y * width + x) * 4;
                const value = luminanceAt(index);
                const right = luminanceAt(index + 4);
                const down = luminanceAt(index + width * 4);
                brightnessSum += value;
                gradientSum += Math.abs(value - right) + Math.abs(value - down);
                glare += value >= 247 ? 1 : 0;
                dark += value <= 28 ? 1 : 0;

                if (
                    previousImageData &&
                    previousImageData.width === width &&
                    previousImageData.height === height
                ) {
                    const previous = previousImageData.data;
                    const previousValue =
                        previous[index] * 0.299 +
                        previous[index + 1] * 0.587 +
                        previous[index + 2] * 0.114;
                    motionSum += Math.abs(value - previousValue);
                }

                samples += 1;
            }
        }

        return {
            brightness: samples ? brightnessSum / samples : 0,
            sharpness: samples ? gradientSum / samples : 0,
            glarePercent: samples ? glare / samples * 100 : 0,
            darkPercent: samples ? dark / samples * 100 : 0,
            motion: previousImageData && samples ? motionSum / samples : 0
        };
    }

    function evaluate(metrics, options = {}) {
        const limits = { ...DEFAULTS, ...options };
        const reasons = [];
        if (metrics.sharpness < limits.minSharpness) reasons.push("UNSHARP");
        if (metrics.brightness < limits.minBrightness) reasons.push("TOO_DARK");
        if (metrics.brightness > limits.maxBrightness) reasons.push("TOO_BRIGHT");
        if (metrics.glarePercent > limits.maxGlarePercent) reasons.push("GLARE");
        if (metrics.motion > limits.maxMotion) reasons.push("MOTION");

        const exposurePenalty = Math.abs(metrics.brightness - 135) / 18;
        const score =
            metrics.sharpness * 3 -
            metrics.motion * 2 -
            metrics.glarePercent * 1.5 -
            exposurePenalty;

        return { accepted: reasons.length === 0, reasons, score };
    }

    async function captureBestFrame(video, options = {}) {
        const settings = { ...DEFAULTS, ...options };
        const frames = [];
        let previousImageData = null;

        for (let index = 0; index < settings.frameCount; index += 1) {
            const frame = createFrame(video, settings.sampleWidth);
            const imageData = frame.context.getImageData(
                0, 0, frame.canvas.width, frame.canvas.height
            );
            const metrics = analyzeImageData(imageData, previousImageData);
            const decision = evaluate(metrics, settings);
            frames.push({ ...frame, metrics, decision, index });
            previousImageData = imageData;
            if (index + 1 < settings.frameCount) await delay(settings.intervalMs);
        }

        frames.sort((left, right) => right.decision.score - left.decision.score);
        const best = frames[0];
        return {
            canvas: best.canvas,
            context: best.context,
            metrics: best.metrics,
            accepted: best.decision.accepted,
            reasons: best.decision.reasons,
            frameCount: settings.frameCount
        };
    }

    const api = Object.freeze({ DEFAULTS, analyzeImageData, evaluate, captureBestFrame });
    global.TeiletrackingImageQualityService = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

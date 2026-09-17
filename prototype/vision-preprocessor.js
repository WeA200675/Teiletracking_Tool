(function initializeVisionPreprocessor(global) {
    "use strict";

    const MAX_SIDE = 2800;

    function createCanvas(width, height) {
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(
            1,
            Math.round(width)
        );

        canvas.height = Math.max(
            1,
            Math.round(height)
        );

        return canvas;
    }

    function getContext(canvas) {
        const context = canvas.getContext(
            "2d",
            {
                alpha: false,
                willReadFrequently: true
            }
        );

        if (!context) {
            throw new Error(
                "Canvas-Kontext konnte nicht erstellt werden."
            );
        }

        return context;
    }

    function cloneCanvas(source) {
        const canvas = createCanvas(
            source.width,
            source.height
        );

        const context = getContext(
            canvas
        );

        context.drawImage(
            source,
            0,
            0
        );

        return canvas;
    }

    async function loadFile(file) {
        if (!file) {
            throw new Error(
                "Kein Bild ausgewählt."
            );
        }

        if (
            !String(file.type || "")
                .startsWith("image/")
        ) {
            throw new Error(
                "Die ausgewählte Datei ist kein Bild."
            );
        }

        if (
            typeof createImageBitmap ===
            "function"
        ) {
            try {
                const bitmap =
                    await createImageBitmap(
                        file,
                        {
                            imageOrientation:
                                "from-image"
                        }
                    );

                return {
                    source: bitmap,
                    width: bitmap.width,
                    height: bitmap.height,
                    close() {
                        if (
                            typeof bitmap.close ===
                            "function"
                        ) {
                            bitmap.close();
                        }
                    }
                };
            } catch (error) {
                console.warn(
                    "createImageBitmap fehlgeschlagen, verwende Image-Fallback.",
                    error
                );
            }
        }

        return new Promise(
            (resolve, reject) => {
                const url =
                    URL.createObjectURL(
                        file
                    );

                const image =
                    new Image();

                image.onload =
                    function onLoad() {
                        resolve({
                            source: image,
                            width:
                                image.naturalWidth ||
                                image.width,
                            height:
                                image.naturalHeight ||
                                image.height,
                            close() {
                                URL.revokeObjectURL(
                                    url
                                );
                            }
                        });
                    };

                image.onerror =
                    function onError() {
                        URL.revokeObjectURL(
                            url
                        );

                        reject(
                            new Error(
                                "Das Foto konnte nicht geladen werden."
                            )
                        );
                    };

                image.src = url;
            }
        );
    }

    function sourceToCanvas(
        source,
        width,
        height
    ) {
        const scale =
            Math.min(
                1,
                MAX_SIDE /
                    Math.max(
                        width,
                        height
                    )
            );

        const targetWidth =
            Math.max(
                1,
                Math.round(
                    width * scale
                )
            );

        const targetHeight =
            Math.max(
                1,
                Math.round(
                    height * scale
                )
            );

        const canvas =
            createCanvas(
                targetWidth,
                targetHeight
            );

        const context =
            getContext(
                canvas
            );

        context.imageSmoothingEnabled =
            true;

        context.imageSmoothingQuality =
            "high";

        context.drawImage(
            source,
            0,
            0,
            width,
            height,
            0,
            0,
            targetWidth,
            targetHeight
        );

        return canvas;
    }

    function rotateCanvas(
        source,
        degrees
    ) {
        const rotation =
            ((degrees % 360) + 360) %
            360;

        if (rotation === 0) {
            return cloneCanvas(
                source
            );
        }

        const swap =
            rotation === 90 ||
            rotation === 270;

        const canvas =
            createCanvas(
                swap
                    ? source.height
                    : source.width,
                swap
                    ? source.width
                    : source.height
            );

        const context =
            getContext(
                canvas
            );

        context.translate(
            canvas.width / 2,
            canvas.height / 2
        );

        context.rotate(
            rotation *
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
        const sx =
            Math.max(
                0,
                Math.round(
                    source.width *
                        xRatio
                )
            );

        const sy =
            Math.max(
                0,
                Math.round(
                    source.height *
                        yRatio
                )
            );

        const sw =
            Math.max(
                1,
                Math.min(
                    source.width - sx,
                    Math.round(
                        source.width *
                            widthRatio
                    )
                )
            );

        const sh =
            Math.max(
                1,
                Math.min(
                    source.height - sy,
                    Math.round(
                        source.height *
                            heightRatio
                    )
                )
            );

        const canvas =
            createCanvas(
                sw,
                sh
            );

        const context =
            getContext(
                canvas
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

    function grayscaleContrast(
        source,
        contrastFactor = 1.6
    ) {
        const canvas =
            cloneCanvas(
                source
            );

        const context =
            getContext(
                canvas
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
                    data[index] *
                        0.299 +
                    data[index + 1] *
                        0.587 +
                    data[index + 2] *
                        0.114
                );

            const adjusted =
                Math.max(
                    0,
                    Math.min(
                        255,
                        Math.round(
                            128 +
                            (
                                gray -
                                128
                            ) *
                            contrastFactor
                        )
                    )
                );

            data[index] =
                adjusted;

            data[index + 1] =
                adjusted;

            data[index + 2] =
                adjusted;
        }

        context.putImageData(
            imageData,
            0,
            0
        );

        return canvas;
    }

    function calculateOtsuThreshold(
        source
    ) {
        const context =
            getContext(
                source
            );

        const imageData =
            context.getImageData(
                0,
                0,
                source.width,
                source.height
            );

        const histogram =
            new Uint32Array(256);

        const data =
            imageData.data;

        let total = 0;
        let sum = 0;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const gray =
                Math.max(
                    0,
                    Math.min(
                        255,
                        Math.round(
                            data[index] *
                                0.299 +
                            data[index + 1] *
                                0.587 +
                            data[index + 2] *
                                0.114
                        )
                    )
                );

            histogram[gray] += 1;
            total += 1;
            sum += gray;
        }

        let backgroundWeight = 0;
        let backgroundSum = 0;
        let bestThreshold = 127;
        let maximumVariance = -1;

        for (
            let threshold = 0;
            threshold < 256;
            threshold += 1
        ) {
            backgroundWeight +=
                histogram[threshold];

            if (
                backgroundWeight === 0
            ) {
                continue;
            }

            const foregroundWeight =
                total -
                backgroundWeight;

            if (
                foregroundWeight === 0
            ) {
                break;
            }

            backgroundSum +=
                threshold *
                histogram[threshold];

            const backgroundMean =
                backgroundSum /
                backgroundWeight;

            const foregroundMean =
                (
                    sum -
                    backgroundSum
                ) /
                foregroundWeight;

            const difference =
                backgroundMean -
                foregroundMean;

            const variance =
                backgroundWeight *
                foregroundWeight *
                difference *
                difference;

            if (
                variance >
                maximumVariance
            ) {
                maximumVariance =
                    variance;

                bestThreshold =
                    threshold;
            }
        }

        return bestThreshold;
    }

    function thresholdCanvas(
        source,
        threshold = null
    ) {
        const gray =
            grayscaleContrast(
                source,
                1.35
            );

        const actualThreshold =
            Number.isFinite(
                threshold
            )
                ? threshold
                : calculateOtsuThreshold(
                    gray
                );

        const context =
            getContext(
                gray
            );

        const imageData =
            context.getImageData(
                0,
                0,
                gray.width,
                gray.height
            );

        const data =
            imageData.data;

        for (
            let index = 0;
            index < data.length;
            index += 4
        ) {
            const value =
                data[index] >=
                actualThreshold
                    ? 255
                    : 0;

            data[index] =
                value;

            data[index + 1] =
                value;

            data[index + 2] =
                value;
        }

        context.putImageData(
            imageData,
            0,
            0
        );

        return gray;
    }

    function sharpenCanvas(
        source
    ) {
        const inputContext =
            getContext(
                source
            );

        const input =
            inputContext.getImageData(
                0,
                0,
                source.width,
                source.height
            );

        const outputCanvas =
            createCanvas(
                source.width,
                source.height
            );

        const outputContext =
            getContext(
                outputCanvas
            );

        const output =
            outputContext.createImageData(
                source.width,
                source.height
            );

        const src =
            input.data;

        const dst =
            output.data;

        const width =
            source.width;

        const height =
            source.height;

        const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];

        for (
            let y = 0;
            y < height;
            y += 1
        ) {
            for (
                let x = 0;
                x < width;
                x += 1
            ) {
                const targetIndex =
                    (
                        y * width +
                        x
                    ) * 4;

                for (
                    let channel = 0;
                    channel < 3;
                    channel += 1
                ) {
                    let value = 0;

                    for (
                        let ky = -1;
                        ky <= 1;
                        ky += 1
                    ) {
                        for (
                            let kx = -1;
                            kx <= 1;
                            kx += 1
                        ) {
                            const px =
                                Math.max(
                                    0,
                                    Math.min(
                                        width - 1,
                                        x + kx
                                    )
                                );

                            const py =
                                Math.max(
                                    0,
                                    Math.min(
                                        height - 1,
                                        y + ky
                                    )
                                );

                            const sourceIndex =
                                (
                                    py *
                                    width +
                                    px
                                ) * 4 +
                                channel;

                            const kernelIndex =
                                (
                                    ky + 1
                                ) * 3 +
                                (
                                    kx + 1
                                );

                            value +=
                                src[
                                    sourceIndex
                                ] *
                                kernel[
                                    kernelIndex
                                ];
                        }
                    }

                    dst[
                        targetIndex +
                        channel
                    ] =
                        Math.max(
                            0,
                            Math.min(
                                255,
                                Math.round(
                                    value
                                )
                            )
                        );
                }

                dst[
                    targetIndex + 3
                ] = 255;
            }
        }

        outputContext.putImageData(
            output,
            0,
            0
        );

        return outputCanvas;
    }

    function buildRotationSet(
        original
    ) {
        return [
            {
                name:
                    "original-0",
                rotation: 0,
                canvas:
                    rotateCanvas(
                        original,
                        0
                    )
            },
            {
                name:
                    "original-90",
                rotation: 90,
                canvas:
                    rotateCanvas(
                        original,
                        90
                    )
            },
            {
                name:
                    "original-180",
                rotation: 180,
                canvas:
                    rotateCanvas(
                        original,
                        180
                    )
            },
            {
                name:
                    "original-270",
                rotation: 270,
                canvas:
                    rotateCanvas(
                        original,
                        270
                    )
            }
        ];
    }

    function buildCodeVariants(
        original
    ) {
        const rotations =
            buildRotationSet(
                original
            );

        const variants = [];

        for (
            const rotation of rotations
        ) {
            variants.push({
                name:
                    rotation.name,
                rotation:
                    rotation.rotation,
                type:
                    "original",
                canvas:
                    rotation.canvas
            });

            variants.push({
                name:
                    `${rotation.name}-contrast`,
                rotation:
                    rotation.rotation,
                type:
                    "contrast",
                canvas:
                    grayscaleContrast(
                        rotation.canvas,
                        1.65
                    )
            });
        }

        return variants;
    }

    function buildOcrVariants(
        original
    ) {
        const rotations =
            buildRotationSet(
                original
            );

        const variants = [];

        for (
            const rotation of rotations
        ) {
            const base =
                rotation.canvas;

            const fullGray =
                grayscaleContrast(
                    base,
                    1.7
                );

            variants.push({
                name:
                    `${rotation.name}-gray`,
                rotation:
                    rotation.rotation,
                region:
                    "full",
                canvas:
                    fullGray
            });

            variants.push({
                name:
                    `${rotation.name}-sharp`,
                rotation:
                    rotation.rotation,
                region:
                    "full",
                canvas:
                    sharpenCanvas(
                        fullGray
                    )
            });

            variants.push({
                name:
                    `${rotation.name}-threshold`,
                rotation:
                    rotation.rotation,
                region:
                    "full",
                canvas:
                    thresholdCanvas(
                        base
                    )
            });

            const centerCrop =
                cropCanvas(
                    base,
                    0.08,
                    0.04,
                    0.88,
                    0.92
                );

            variants.push({
                name:
                    `${rotation.name}-center-crop`,
                rotation:
                    rotation.rotation,
                region:
                    "center",
                canvas:
                    grayscaleContrast(
                        centerCrop,
                        1.75
                    )
            });

            const rightCrop =
                cropCanvas(
                    base,
                    0.25,
                    0.03,
                    0.73,
                    0.94
                );

            variants.push({
                name:
                    `${rotation.name}-right-crop`,
                rotation:
                    rotation.rotation,
                region:
                    "right",
                canvas:
                    grayscaleContrast(
                        rightCrop,
                        1.8
                    )
            });
        }

        return variants;
    }

    async function prepareFile(
        file
    ) {
        const loaded =
            await loadFile(
                file
            );

        try {
            const original =
                sourceToCanvas(
                    loaded.source,
                    loaded.width,
                    loaded.height
                );

            return {
                original,
                width:
                    original.width,
                height:
                    original.height,
                codeVariants:
                    buildCodeVariants(
                        original
                    ),
                ocrVariants:
                    buildOcrVariants(
                        original
                    )
            };
        } finally {
            loaded.close();
        }
    }

    function canvasToBlob(
        canvas,
        type = "image/jpeg",
        quality = 0.92
    ) {
        return new Promise(
            (resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(
                                new Error(
                                    "Bild konnte nicht exportiert werden."
                                )
                            );

                            return;
                        }

                        resolve(
                            blob
                        );
                    },
                    type,
                    quality
                );
            }
        );
    }

    global.TeiletrackingVisionPreprocessor =
        Object.freeze({
            prepareFile,
            cloneCanvas,
            rotateCanvas,
            cropCanvas,
            grayscaleContrast,
            thresholdCanvas,
            sharpenCanvas,
            buildCodeVariants,
            buildOcrVariants,
            canvasToBlob
        });
})(
    typeof window !==
        "undefined"
        ? window
        : globalThis
);

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const prototype = path.join(root, "prototype");
const vendor = path.join(prototype, "vendor");
const indexHtml = fs.readFileSync(path.join(prototype, "index.html"), "utf8");
const trainerHtml = fs.readFileSync(path.join(prototype, "label-trainer.html"), "utf8");
const scannerService = fs.readFileSync(path.join(prototype, "scanner-service.js"), "utf8");

for (const file of ["jsQR-1.4.0.js", "jszip-3.10.1.min.js", "LICENSE-jsQR.txt", "LICENSE-jszip.markdown", "NOTICE.md"]) {
    const absolutePath = path.join(vendor, file);
    assert.ok(fs.existsSync(absolutePath), `Vendored dependency file missing: ${file}`);
    assert.ok(fs.statSync(absolutePath).size > 0, `Vendored dependency file is empty: ${file}`);
}

assert.match(indexHtml, /\.\/vendor\/jsQR-1\.4\.0\.js/);
assert.match(trainerHtml, /\.\/vendor\/jsQR-1\.4\.0\.js/);
assert.match(indexHtml, /\.\/vendor\/jszip-3\.10\.1\.min\.js/);
assert.doesNotMatch(indexHtml + trainerHtml, /https:\/\/cdn\.jsdelivr\.net\/npm\/(?:jsqr|jszip|zxing-wasm)@/i);
assert.doesNotMatch(scannerService, /https?:\/\/|createElement\s*\(\s*["']script["']/i);
assert.match(indexHtml, /https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@7\.0\.0\/dist\/tesseract\.min\.js/);
const externalScriptSources = [...(indexHtml + trainerHtml).matchAll(/<script[^>]+src=["'](https?:[^"']+)["']/gi)]
    .map(match => match[1]);
assert.deepEqual(externalScriptSources, [
    "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js"
]);

console.log("Frontend supply-chain guard passed.");

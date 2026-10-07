"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

async function main() {
    const context = {
        crypto: webcrypto,
        TextEncoder,
        TextDecoder,
        Uint8Array,
        btoa,
        atob
    };
    context.window = context;
    vm.runInNewContext(
        fs.readFileSync("prototype/backup-service.js", "utf8"),
        context,
        { filename: "prototype/backup-service.js" }
    );

    const service = context.TeiletrackingBackupService;
    const source = JSON.stringify({
        formatVersion: 1,
        sha256: "SYNTHETIC",
        payload: Buffer.from('{"records":[{"LocalId":"synthetic"}]}').toString("base64")
    });
    const passphrase = "synthetic-test-passphrase";
    const encrypted = await service.encrypt(source, passphrase);
    assert.equal(service.isEncryptedPackage(encrypted), true);
    assert.equal(await service.decrypt(encrypted, passphrase), source);

    await assert.rejects(
        () => service.decrypt(encrypted, "different-test-passphrase"),
        /Entschlüsselung fehlgeschlagen/
    );

    const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -4) + "AAAA" };
    await assert.rejects(
        () => service.decrypt(tampered, passphrase),
        /Entschlüsselung fehlgeschlagen/
    );

    await assert.rejects(
        () => service.encrypt(source, "short"),
        /mindestens 16 Zeichen/
    );

    const unsupported = { ...encrypted, iterations: 1 };
    await assert.rejects(
        () => service.decrypt(unsupported, passphrase),
        /nicht unterstützt/
    );

    console.log("Database backup encryption tests passed.");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

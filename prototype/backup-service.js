"use strict";

(function initializeDatabaseBackupService(global) {
    const FORMAT = "TeiletrackingEncryptedBackup";
    const VERSION = 1;
    const ITERATIONS = 310000;
    const MAX_CIPHERTEXT_BYTES = 24 * 1024 * 1024;

    function toBase64(bytes) {
        let binary = "";
        const step = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += step) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + step));
        }
        return global.btoa(binary);
    }

    function fromBase64(value, maximumBytes) {
        if (typeof value !== "string" || value.length > Math.ceil(maximumBytes * 4 / 3) + 8) {
            throw new Error("Backupdatei ist ungültig oder zu groß.");
        }
        let binary;
        try {
            binary = global.atob(value);
        }
        catch {
            throw new Error("Backupdatei enthält ungültige Binärdaten.");
        }
        if (binary.length > maximumBytes) {
            throw new Error("Backupdatei überschreitet die zulässige Größe.");
        }
        return Uint8Array.from(binary, character => character.charCodeAt(0));
    }

    async function deriveKey(passphrase, salt, usages) {
        if (!global.crypto || !global.crypto.subtle) {
            throw new Error("Die Browser-Kryptografie wird nicht unterstützt.");
        }
        const material = await global.crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(passphrase),
            "PBKDF2",
            false,
            ["deriveKey"]
        );
        return global.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
            material,
            { name: "AES-GCM", length: 256 },
            false,
            usages
        );
    }

    async function encrypt(plainText, passphrase) {
        if (typeof plainText !== "string" || new TextEncoder().encode(plainText).length > MAX_CIPHERTEXT_BYTES) {
            throw new Error("Datenbank-Backup überschreitet 16 MiB.");
        }
        if (typeof passphrase !== "string" || passphrase.length < 16) {
            throw new Error("Das Backup-Passwort muss mindestens 16 Zeichen haben.");
        }
        const salt = global.crypto.getRandomValues(new Uint8Array(16));
        const iv = global.crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(passphrase, salt, ["encrypt"]);
        const ciphertext = await global.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            new TextEncoder().encode(plainText)
        );
        return {
            format: FORMAT,
            version: VERSION,
            kdf: "PBKDF2-SHA256",
            iterations: ITERATIONS,
            cipher: "AES-256-GCM",
            salt: toBase64(salt),
            iv: toBase64(iv),
            ciphertext: toBase64(new Uint8Array(ciphertext))
        };
    }

    async function decrypt(packageObject, passphrase) {
        if (!packageObject || packageObject.format !== FORMAT ||
            packageObject.version !== VERSION ||
            packageObject.kdf !== "PBKDF2-SHA256" ||
            packageObject.iterations !== ITERATIONS ||
            packageObject.cipher !== "AES-256-GCM") {
            throw new Error("Backupformat oder Kryptografieparameter werden nicht unterstützt.");
        }
        if (typeof passphrase !== "string" || passphrase.length < 16) {
            throw new Error("Das Backup-Passwort muss mindestens 16 Zeichen haben.");
        }
        const salt = fromBase64(packageObject.salt, 16);
        const iv = fromBase64(packageObject.iv, 12);
        const ciphertext = fromBase64(packageObject.ciphertext, MAX_CIPHERTEXT_BYTES);
        if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) {
            throw new Error("Backupdatei ist unvollständig.");
        }
        const key = await deriveKey(passphrase, salt, ["decrypt"]);
        try {
            const plaintext = await global.crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                key,
                ciphertext
            );
            return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
        }
        catch {
            throw new Error("Entschlüsselung fehlgeschlagen. Passwort oder Backupdatei prüfen.");
        }
    }

    global.TeiletrackingBackupService = Object.freeze({
        format: FORMAT,
        encrypt,
        decrypt,
        isEncryptedPackage(value) {
            return Boolean(value && value.format === FORMAT);
        }
    });
})(window);

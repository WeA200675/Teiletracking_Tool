"use strict";

(function initializeTrainer(global) {
    const canvas = document.getElementById("labelCanvas");
    const context = canvas.getContext("2d");
    const image = new Image();
    const regions = {};
    let selectedField = "partNumber";
    let dragStart = null;
    let draftRegion = null;

    const fieldLabels = {
        partNumber: "PartNumber", serialNumber: "CPID",
        hardware: "Hardware"
    };
    const colors = {
        partNumber: "#28b8ff", serialNumber: "#ffb52e",
        hardware: "#63d471"
    };

    function setStatus(message, error = false) {
        const target = document.getElementById("status");
        target.textContent = message;
        target.classList.toggle("error", error);
    }

    function draw() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (image.complete && image.naturalWidth) {
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
        }
        for (const [field, region] of Object.entries({ ...regions, ...(draftRegion ? { [selectedField]: draftRegion } : {}) })) {
            context.strokeStyle = colors[field];
            context.lineWidth = Math.max(2, canvas.width / 250);
            context.strokeRect(region.x * canvas.width, region.y * canvas.height, region.width * canvas.width, region.height * canvas.height);
            context.fillStyle = colors[field];
            context.font = `bold ${Math.max(14, canvas.width / 35)}px system-ui`;
            context.fillText(fieldLabels[field], region.x * canvas.width + 4, region.y * canvas.height + 18);
        }
    }

    function renderRegions() {
        const target = document.getElementById("regionList");
        target.innerHTML = "";
        for (const field of Object.keys(regions)) {
            const item = document.createElement("span");
            item.textContent = `✓ ${fieldLabels[field]}`;
            target.appendChild(item);
        }
    }

    function pointerPosition(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        };
    }

    canvas.addEventListener("pointerdown", event => {
        if (!image.naturalWidth) return;
        canvas.setPointerCapture(event.pointerId);
        dragStart = pointerPosition(event);
    });
    canvas.addEventListener("pointermove", event => {
        if (!dragStart) return;
        const point = pointerPosition(event);
        draftRegion = {
            x: Math.min(dragStart.x, point.x), y: Math.min(dragStart.y, point.y),
            width: Math.abs(point.x - dragStart.x), height: Math.abs(point.y - dragStart.y)
        };
        draw();
    });
    canvas.addEventListener("pointerup", () => {
        if (draftRegion && draftRegion.width >= 0.02 && draftRegion.height >= 0.02) {
            regions[selectedField] = TeiletrackingLabelProfileService.normalizeRegion(draftRegion);
        }
        dragStart = null;
        draftRegion = null;
        draw();
        renderRegions();
    });

    document.querySelectorAll("[data-field]").forEach(button => {
        button.addEventListener("click", () => {
            selectedField = button.dataset.field;
            document.querySelectorAll("[data-field]").forEach(item => item.classList.toggle("selected", item === button));
        });
    });

    document.getElementById("labelImageInput").addEventListener("change", event => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        image.onload = () => {
            const scale = Math.min(1, 1600 / image.naturalWidth);
            canvas.width = Math.round(image.naturalWidth * scale);
            canvas.height = Math.round(image.naturalHeight * scale);
            draw();
            decodeQr();
            URL.revokeObjectURL(url);
        };
        image.src = url;
    });

    function buildProfile() {
        const name = document.getElementById("profileName").value.trim();
        if (!name) throw new Error("Bitte einen Profilnamen eingeben.");
        if (Object.keys(regions).length === 0) throw new Error("Bitte mindestens einen Feldbereich markieren.");
        return {
            schemaVersion: 1, synthetic: true,
            id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `profile-${Date.now()}`,
            name, regions,
            preprocessing: {
                contrast: document.getElementById("contrastOption").checked,
                threshold: document.getElementById("thresholdOption").checked
            },
            insights: []
        };
    }

    function expectedValue(field) {
        return document.querySelector(`[data-expected="${field}"]`).value.trim().toUpperCase();
    }

    function renderQrCandidates(qrText) {
        const target = document.getElementById("qrCandidates");
        target.innerHTML = "";
        const values = String(qrText || "")
            .split(/[|;,\n\r\t]+/)
            .map(value => value.trim())
            .filter(Boolean)
            .map(value => value.includes("=") ? value.slice(value.indexOf("=") + 1).trim() : value);
        const unique = [...new Set(values)];
        if (!unique.length) return;
        const help = document.createElement("p");
        help.textContent = "Feld oben auswählen und dann den passenden QR-Wert antippen:";
        target.appendChild(help);
        for (const value of unique) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = value;
            button.addEventListener("click", () => {
                const input = document.querySelector(`[data-expected="${selectedField}"]`);
                if (input) input.value = value;
                setStatus(`${value} wurde ${fieldLabels[selectedField]} zugeordnet.`);
            });
            target.appendChild(button);
        }
    }

    async function decodeQr() {
        const output = document.getElementById("qrOutput");
        if (!canvas.width || !canvas.height || !global.TeiletrackingScannerService) {
            output.value = "QR-Decoder nicht verfügbar.";
            return;
        }
        output.value = "QR-/DataMatrix-Code wird ausgelesen …";
        setStatus("Code wird mit mehreren Bildausschnitten und Drehungen geprüft.");
        try {
            const text = await global.TeiletrackingScannerService.detectQr(
                canvas,
                context,
                { ignoreLiveCache: true }
            );
            output.value = text || "Kein QR-/DataMatrix-Code erkannt. Bitte den Code größer und scharf fotografieren.";
            renderQrCandidates(text);
            document.getElementById("ocrResults").textContent = text
                ? "QR-Werte erkannt. Feld auswählen und den passenden Wert oben antippen."
                : "Noch keine Werte erkannt.";
            setStatus(text ? "Code gelesen. Werte können jetzt zugeordnet werden." : "Kein Code erkannt.", !text);
        }
        catch (error) {
            output.value = "QR-Auswertung fehlgeschlagen.";
            renderQrCandidates("");
            setStatus(error.message || "QR-Auswertung fehlgeschlagen.", true);
        }
    }

    function renderSavedProfiles() {
        const target = document.getElementById("savedProfiles");
        const active = TeiletrackingLabelProfileService.getActiveProfile();
        target.innerHTML = "";
        for (const profile of TeiletrackingLabelProfileService.loadProfiles()) {
            const row = document.createElement("div"); row.className = "saved-row";
            const name = document.createElement("strong"); name.textContent = `${profile.name}${active && active.id === profile.id ? " · aktiv" : ""}`;
            const activate = document.createElement("button"); activate.type = "button"; activate.textContent = "Aktivieren";
            activate.addEventListener("click", () => { TeiletrackingLabelProfileService.setActiveProfile(profile.id); renderSavedProfiles(); });
            const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Löschen";
            remove.addEventListener("click", () => { TeiletrackingLabelProfileService.deleteProfile(profile.id); renderSavedProfiles(); });
            row.append(name, activate, remove); target.appendChild(row);
        }
        if (!target.children.length) target.textContent = "Noch keine Profile gespeichert.";
    }

    document.getElementById("saveProfileButton").addEventListener("click", () => {
        try {
            const profile = TeiletrackingLabelProfileService.saveProfile(buildProfile());
            TeiletrackingLabelProfileService.setActiveProfile(profile.id);
            setStatus("Profil lokal gespeichert und für die Tracking-App aktiviert.");
            renderSavedProfiles();
        }
        catch (error) { setStatus(error.message, true); }
    });

    document.getElementById("exportProfileButton").addEventListener("click", () => {
        try {
            const profile = TeiletrackingLabelProfileService.exportProfile(buildProfile());
            const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a"); link.href = url; link.download = `${profile.id}.label-profile.json`; link.click();
            URL.revokeObjectURL(url);
            setStatus("Anonymisiertes Profil exportiert. Bitte vor dem Commit nochmals prüfen.");
        }
        catch (error) { setStatus(error.message, true); }
    });

    document.getElementById("profileImportInput").addEventListener("change", async event => {
        const file = event.target.files && event.target.files[0]; if (!file) return;
        try {
            const profile = TeiletrackingLabelProfileService.importProfile(await file.text());
            TeiletrackingLabelProfileService.setActiveProfile(profile.id);
            setStatus("Sicheres Profil importiert und aktiviert."); renderSavedProfiles();
        }
        catch (error) { setStatus(error.message, true); }
    });

    renderSavedProfiles();
})(window);

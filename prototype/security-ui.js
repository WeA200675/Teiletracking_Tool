"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("openCustomStatusButton");
    if (!button) return;

    button.addEventListener("click", () => {
        const details = document.getElementById("masterDataDetails");
        if (details) details.open = true;

        const panel = document.getElementById("statusMasterPanel");
        if (panel) {
            panel.classList.add("master-data-panel-attention");
            setTimeout(() => panel.classList.remove("master-data-panel-attention"), 1800);
        }

        setTimeout(() => {
            const input = document.getElementById("newStatusName");
            if (input) {
                input.scrollIntoView({ behavior: "smooth", block: "center" });
                input.focus();
            }
        }, 0);
    });
});

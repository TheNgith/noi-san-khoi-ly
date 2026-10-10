/**
 * Toolbar module
 * Zoom, fit, page mode, comment visibility, the phone contents button,
 * and the hint that follows the cursor over each control.
 */

import { $, isMobile } from "./dom.js";
import { state } from "./state.js";
import { setZoom, zoomStep, atFitWidth, setDual } from "./reader.js";
import { closeComposer, closeThread, hideTrace, clearPreview } from "./comments.js";
import { openToc, closeToc } from "./toc.js";

let hintFor = null;

// Keep the floating hint in sync when a control's label changes under the cursor
export function refreshHint(btn) {
    if (hintFor === btn) $(".tool-hint").textContent = btn.dataset.hint;
}

function setCommentsVisible(on) {
    state.commentsOn = on;
    closeComposer();
    closeThread();
    hideTrace();
    clearPreview();
    document.body.classList.toggle("cmts-off", !on);
    const btn = $(".cmt_toggle_btn"), label = on ? "Ẩn bình luận" : "Hiện bình luận";
    $(".cmt_icon").src = on ? "assets/icons/cmt_mode_on.svg" : "assets/icons/cmt_mode_off.svg";
    btn.dataset.hint = label;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-pressed", String(on));
    refreshHint(btn);
}

export function initToolbar() {
    $(".zoom_in_btn").addEventListener("click", () => setZoom(zoomStep(1)));
    $(".zoom_out_btn").addEventListener("click", () => setZoom(zoomStep(-1)));
    $(".zoom_percent").addEventListener("click", () => setZoom(1));
    $(".fit_btn").addEventListener("click", () => setZoom(atFitWidth() ? 1 : 99));
    $(".dual_page_toggler").addEventListener("click", () => setDual(!state.dual));
    $(".cmt_toggle_btn").addEventListener("click", () => setCommentsVisible(!state.commentsOn));
    $(".toc_btn").addEventListener("click", (e) => {
        e.stopPropagation();
        document.body.classList.contains("toc-open") ? closeToc() : openToc();
    });

    const hint = $(".tool-hint");
    const move = (e) => { hint.style.left = e.clientX + "px"; hint.style.top = e.clientY + "px"; };
    $(".toolbar_container").querySelectorAll("[data-hint]").forEach((b) => {
        b.addEventListener("pointerenter", (e) => {
            if (e.pointerType !== "mouse" || isMobile()) return;
            hintFor = b;
            hint.textContent = b.dataset.hint;
            hint.classList.add("visible");
            move(e);
        });
        b.addEventListener("pointermove", move);
        b.addEventListener("pointerleave", () => {
            hintFor = null;
            hint.classList.remove("visible");
        });
    });
}

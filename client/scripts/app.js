/**
 * Main application entry point
 * Builds the reader, wires the modules together and handles global input.
 */

import { isMobile, mqMobile } from "./dom.js";
import { state } from "./state.js";
import {
    buildReader, initReader, applyLayout, captureAnchor, setZoom, zoomStep, atFitWidth, setDual,
    updateZoomUI, updateDualUI, updateThreadWidths,
} from "./reader.js";
import {
    initComments, loadComments, closeThread, closeComposer, closeSheet, step, nextFromView,
    openComposer, openComposerAtTrace, traceActive, clickPage, composerHasText,
} from "./comments.js";
import { initScroll, onScroll, routeHash } from "./navigation.js";
import { initToc, closeToc, sizeSpine } from "./toc.js";
import { setStage, playOpening } from "./cover.js";
import { initToolbar } from "./toolbar.js";
import { initEggs } from "./eggs.js";
import { unlocked } from "./gate.js";

// Clicks outside an open thread or form close it. With nothing open, a click
// on a page comments on that line (or opens the thread already on it).
function onDocumentClick(e) {
    if (Date.now() < state.guardUntil) return;
    const t = e.target;
    if (document.body.classList.contains("toc-open") && !t.closest(".toc-spine, .toc_btn")) closeToc();
    if (t.closest(".comment-bubble, .comment-dot, .comment-composer, .comment-sheet, .sheet-scrim, .toolbar_container, .toc-spine, .cover_container, .egg-stage")) return;
    if (state.composer) {
        if (!composerHasText()) closeComposer();
    } else if (state.open) {
        closeThread();
    } else {
        clickPage(e);
    }
}

function onKeydown(e) {
    if (e.key === "Escape") {
        if (state.composer) closeComposer();
        else if (state.open) closeThread();
        else closeToc();
        return;
    }
    if (e.target.closest?.("input, textarea") || e.metaKey || e.ctrlKey || e.altKey || state.stage !== "reading") return;
    const k = e.key.toLowerCase();
    if (state.open && (e.key === "ArrowDown" || k === "j")) { e.preventDefault(); step(1); }
    else if (state.open && (e.key === "ArrowUp" || k === "k")) { e.preventDefault(); step(-1); }
    else if (k === "n") nextFromView();
    else if (k === "c") {
        // Comment on the line under the pointer, or on the reading line
        e.preventDefault();
        if (traceActive()) openComposerAtTrace();
        else if (state.current) {
            const r = state.current.paper.getBoundingClientRect();
            openComposer(state.current, 0.5, Math.min(0.95, Math.max(0.05, (innerHeight * 0.38 - r.top) / r.height)));
        }
    }
    else if (e.key === "+" || e.key === "=") setZoom(zoomStep(1));
    else if (e.key === "-" || e.key === "_") setZoom(zoomStep(-1));
    else if (k === "f") setZoom(atFitWidth() ? 1 : 99); // same toggle as the fit button
    else if (k === "d") setDual(!state.dual);
}

// ⌘/Ctrl + scroll (and trackpad pinch) zooms around the pointer
function onWheel(e) {
    if (!(e.ctrlKey || e.metaKey) || isMobile() || state.stage !== "reading") return;
    e.preventDefault();
    setZoom((state.pageW / state.fitH) * Math.exp(-e.deltaY * 0.0025), captureAnchor(e.clientY));
}

document.addEventListener("DOMContentLoaded", async () => {
    // The book opens only once the visitor is past the gate
    await unlocked;
    const initialHash = decodeURIComponent(location.hash.slice(1));
    try { history.scrollRestoration = "manual"; } catch { /* unsupported */ }

    buildReader();
    initReader();
    initToc();
    initComments();
    initEggs();
    initToolbar();
    initScroll();
    updateThreadWidths();
    updateZoomUI();
    updateDualUI();

    document.addEventListener("click", onDocumentClick);
    addEventListener("keydown", onKeydown);
    addEventListener("wheel", onWheel, { passive: false });
    let resizeTimer = null;
    addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { applyLayout(); sizeSpine(); }, 100);
    });
    mqMobile.addEventListener("change", () => {
        closeComposer(true);
        closeThread(true);
        closeSheet();
        closeToc();
        if (isMobile()) setDual(false);
    });

    // A link to a page or comment goes straight there; otherwise the book opens on its cover
    const deepLink = initialHash.startsWith("c-") || /^trang-\d+$/.test(initialHash);
    if (deepLink) {
        setStage("reading");
        state.stageLockUntil = Date.now() + 1800;
    } else {
        setStage("cover");
        playOpening();
    }
    onScroll(true);

    loadComments().then(() => {
        if (deepLink) requestAnimationFrame(() => routeHash(initialHash));
    });
});

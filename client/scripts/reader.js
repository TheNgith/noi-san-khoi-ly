/**
 * Reader layout module
 * Builds the pages from the book manifest, sizes them (fit-height, fit-width,
 * zoom) and switches between the single column and dual-page spreads.
 */

import { BLOCKS, PAGE_RATIO, years } from "./book.js";
import { $, el, isMobile, reduced } from "./dom.js";
import { state, pages, pageById } from "./state.js";
import { renderAll, closeThread, closeComposer, hideTrace, clearPreview, observeUnrevealed } from "./comments.js";
import { onScroll } from "./navigation.js";
import { closeToc } from "./toc.js";
import { refreshHint } from "./toolbar.js";

const GAP = 15;            // page ↔ margin (single page)
const BUBBLE_MARGIN = 44;  // narrowest margin: bubbles only, threads slide the page aside
const SPREAD_GAP = 10;
const THREAD_W = 300;      // thread width once the page has to slide for it
const THREAD_MAX = 380;
const READER_PAD = 32 + 104; // body gutters + reader padding (spine, toolbar)

// ───────── Build ─────────

/**
 * Every page exists once (its .page-paper) and moves between its single-page
 * row and its slot in a spread. Spreads pair pages as printed: even left, odd right.
 */
export function buildReader() {
    const reader = $("#reader");
    BLOCKS.forEach(({ key: code, kind, name, rgb, pages: blockPages }, b) => {
        const sec = el("section", "chapter-block");
        sec.id = "chapter-" + code;
        sec.style.setProperty("--rgb", rgb);
        const spreads = {};
        blockPages.forEach(({ id, src, n, w, h }, i) => {
            const row = el("div", "page-row");
            row.dataset.page = id;
            const paper = el("div", "page-paper");
            paper.dataset.page = id;
            paper.style.setProperty("--ar", `${w} / ${h}`);
            const img = el("img");
            img.src = src;
            img.width = w;
            img.height = h;
            img.alt = kind === "class" ? `Trang ${n}, phỏng vấn ${name}, niên khoá ${years(code)}` : `Trang ${n}, ${name}`;
            img.loading = b === 0 && i < 2 ? "eager" : "lazy";
            img.decoding = "async";
            img.draggable = false;
            const anchor = el("div", "page-anchor");
            anchor.innerHTML = '<div class="anchor-band glow"></div><div class="anchor-bridge glow"></div>';
            const dots = el("div", "comment-dots");
            paper.append(img, anchor, dots);
            const margin = el("div", "comment-margin");
            row.append(el("div", "row-spacer"), paper, margin);
            sec.append(row);

            const key = Math.floor(n / 2);
            if (!spreads[key]) {
                const sp = el("div", "page-spread");
                sp.innerHTML = '<div class="comment-margin margin-l"></div><div class="page-slot slot-l"></div><div class="page-slot slot-r"></div><div class="comment-margin margin-r"></div>';
                spreads[key] = sp;
            }
            const sp = spreads[key], side = n % 2 === 0 ? "l" : "r";

            const p = {
                id, ch: code, kind, name, rgb, w, h, n, idx: i,
                paper, anchor, dots, margin, box: row,
                single: { row, margin },
                dualSlot: { spread: sp, side, slot: $(".slot-" + side, sp), margin: $(".margin-" + side, sp) },
                clusters: [], revealed: false,
            };
            pages.push(p);
            pageById[id] = p;
        });
        Object.values(spreads).forEach((sp) => sec.append(sp));
        reader.append(sec);
    });
}

// ───────── Size & zoom ─────────

export function measure() {
    const vw = document.documentElement.clientWidth;
    if (isMobile()) { state.pageW = Math.max(200, vw - 32); return; }
    state.fitH = Math.max(240, (innerHeight - 64) * PAGE_RATIO);
    state.maxW = state.dual
        ? Math.max(240, (vw - READER_PAD - 2 * (BUBBLE_MARGIN + SPREAD_GAP) - 8) / 2)
        : Math.max(280, vw - READER_PAD - 2 * (BUBBLE_MARGIN + GAP) - 8);
    state.pageW = Math.min(state.fitH * state.zoom, state.maxW);
}

// Remember which page sits under a screen line so a re-layout can put it back
export function captureAnchor(clientY = innerHeight * 0.4) {
    for (const p of pages) {
        const r = p.paper.getBoundingClientRect();
        if (r.bottom >= clientY) return r.top > clientY ? null : { p, frac: (clientY - r.top) / r.height, clientY };
    }
    return null;
}

function restoreAnchor(a) {
    if (!a) return;
    const r = a.p.paper.getBoundingClientRect();
    window.scrollBy(0, r.top + a.frac * r.height - a.clientY);
}

function setPageWidth() {
    measure();
    document.documentElement.style.setProperty("--page-w", state.pageW + "px");
}

export function applyLayout(anchor) {
    const a = anchor === undefined ? captureAnchor() : anchor;
    setPageWidth();
    restoreAnchor(a);
    renderAll(true);
    updateThreadWidths();
    updateZoomUI();
    onScroll(true);
}

export function setZoom(z, anchor) {
    if (isMobile()) return;
    measure();
    state.zoom = Math.min(Math.max(z, 0.5), state.maxW / state.fitH);
    applyLayout(anchor);
}

// Next 10% step from the current true size
export function zoomStep(dir) {
    const z = state.pageW / state.fitH;
    return dir > 0 ? Math.floor(z * 10 + 1e-6) / 10 + 0.1 : Math.ceil(z * 10 - 1e-6) / 10 - 0.1;
}

export const atFitWidth = () => state.pageW >= state.maxW - 1;

export function updateZoomUI() {
    if (isMobile()) return;
    $(".zoom_percent").textContent = Math.round((state.pageW / state.fitH) * 100) + "%";
    $(".zoom_in_btn").disabled = atFitWidth();
    $(".zoom_out_btn").disabled = state.pageW / state.fitH <= 0.501;
    const w = atFitWidth();
    $(".fit_icon.width").hidden = w;
    $(".fit_icon.height").hidden = !w;
    const label = w ? "Vừa chiều cao (H)" : "Vừa chiều rộng (W)";
    const btn = $(".fit_btn");
    btn.dataset.hint = label;
    btn.setAttribute("aria-label", label);
    refreshHint(btn);
}

// Every row and spread reads --shift from the reader, so all pages slide together.
// Measured as drawn (mid-slide too), so a page's unshifted place is exact.
const shiftOf = (box) => new DOMMatrix(getComputedStyle(box).transform).m41;
const setShift = (px) => $("#reader").style.setProperty("--shift", px + "px");

// Room between a single page's margin (where it sits unshifted) and the toolbar
function marginRoom(p) {
    const tl = $(".toolbar_container").getBoundingClientRect().left;
    return tl - 24 - (p.single.margin.getBoundingClientRect().left - shiftOf(p.single.row));
}

// An open thread may reach as far as the toolbar; where that is too narrow
// it keeps THREAD_W and the page slides left for it (makeRoom)
export function updateThreadWidths() {
    if (isMobile() || state.dual) return;
    pages.forEach((p) => {
        p.single.row.style.setProperty("--thread-w", Math.min(THREAD_MAX, Math.max(THREAD_W, marginRoom(p))) + "px");
    });
}

// ───────── Room for a thread ─────────

// A thread or comment form slides the pages (all of them, so the column
// stays one column) away from that side just enough to fit, so the passage
// stays in view. A page sits centred otherwise, however far it is zoomed.
export function makeRoom(p) {
    if (!state.dual) {
        const room = marginRoom(p), w = Math.min(THREAD_MAX, Math.max(THREAD_W, room));
        p.single.row.style.setProperty("--thread-w", w + "px");
        setShift(-Math.max(0, w - room));
        return;
    }
    const cur = shiftOf(p.dualSlot.spread);
    const m = p.margin.getBoundingClientRect();
    const shift = p.dualSlot.side === "l"
        ? Math.max(0, $(".toc-spine").getBoundingClientRect().right + 20 - (m.right - cur - THREAD_W))
        : -Math.max(0, m.left - cur + THREAD_W - ($(".toolbar_container").getBoundingClientRect().left - 20));
    setShift(shift);
}

export function releaseRoom() {
    setShift(0);
}

// ───────── Dual-page spreads ─────────

export function updateDualUI() {
    const btn = $(".dual_page_toggler");
    const label = state.dual ? "Đọc với trang đơn (D)" : "Đọc với trang đôi (D)";
    $(".page_mode_icon.single").hidden = state.dual;
    $(".page_mode_icon.dual").hidden = !state.dual;
    btn.dataset.hint = label;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-pressed", String(state.dual));
    refreshHint(btn);
}

export function setDual(on) {
    if (on === state.dual || (on && isMobile())) return;
    closeThread(true);
    closeComposer(true);
    hideTrace();
    clearPreview();
    closeToc();

    const vh = innerHeight, before = new Map();
    pages.forEach((p) => {
        const r = p.paper.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) before.set(p, r);
    });
    const anchor = captureAnchor();

    state.dual = on;
    document.body.classList.toggle("dual", on);
    pages.forEach((p) => {
        if (on) {
            p.dualSlot.slot.append(p.paper);
            p.margin = p.dualSlot.margin;
            p.box = p.dualSlot.spread;
        } else {
            p.single.row.insertBefore(p.paper, p.single.margin);
            p.margin = p.single.margin;
            p.box = p.single.row;
        }
        p.paper.classList.toggle("side-l", on && p.dualSlot.side === "l");
    });
    setShift(0);

    setPageWidth();
    restoreAnchor(anchor);
    observeUnrevealed();
    document.body.classList.add("regrouping");
    renderAll(true);
    updateThreadWidths();
    updateZoomUI();
    updateDualUI();
    onScroll(true);

    // Pages glide from where they were to their new places
    if (!reduced) {
        pages.forEach((p) => {
            const b = before.get(p), a = p.paper.getBoundingClientRect();
            if (b) {
                p.paper.classList.add("moving");
                p.paper.animate([
                    { transformOrigin: "0 0", transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width})` },
                    { transformOrigin: "0 0", transform: "none" },
                ], { duration: 640, easing: "cubic-bezier(.22, 1, .36, 1)" }).onfinish = () => p.paper.classList.remove("moving");
            } else if (a.bottom > 0 && a.top < vh) {
                p.paper.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 180, fill: "backwards" });
            }
        });
    }
    setTimeout(() => document.body.classList.remove("regrouping"), reduced ? 0 : 560);
}

export function initReader() {
    setPageWidth();
}

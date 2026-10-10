/**
 * Table of contents module
 * The cover's stripe column, docked at the left edge. Resting the pointer on
 * it slides a black panel out from the edge: the stripes fold away and each
 * hands its colour over to its name, beside where the stripe was.
 */

import { CHAPTERS, COVER_CLASSES, SECTIONS, PAGES } from "./book.js";
import { $, el, isMobile } from "./dom.js";
import { state } from "./state.js";
import { gotoChapter } from "./navigation.js";

const OPEN_DELAY = 170;  // ms the pointer must rest before the names unfold
const CLOSE_DELAY = 240;

const ROWS = [{ label: "Lời nói đầu" }, { label: "Phỏng vấn" }]
    .concat(CHAPTERS.map(([code, rgb]) => ({ key: code, label: code, rgb, live: !!PAGES[code], cohort: COVER_CLASSES.includes(code) })))
    .concat(SECTIONS.map(([label, rgb]) => ({ label, rgb })))
    .concat([{ label: "Lời kết" }]);
const rowByChapter = {};

let spine, rowsEl, openT = null, closeT = null;

export const rowFor = (code) => rowByChapter[code].el;

export function sizeSpine() {
    const pitch = rowsEl.clientHeight / ROWS.length;
    spine.style.setProperty("--toc-font", Math.max(11, Math.min(16, pitch * 0.72)) + "px");
}

function rowIndexAt(y) {
    const r = rowsEl.getBoundingClientRect();
    return Math.max(0, Math.min(ROWS.length - 1, Math.floor((y - r.top) / (r.height / ROWS.length))));
}

export function openToc(origin) {
    clearTimeout(closeT);
    if (spine.classList.contains("open") || state.stage !== "reading") return;
    const o = origin ?? (state.current ? rowByChapter[state.current.ch].i : 0);
    // Names ripple out from the row under the pointer
    ROWS.forEach((r) => r.el.style.setProperty("--d", Math.abs(r.i - o)));
    spine.classList.add("open");
    document.body.classList.add("toc-open");
}

export function closeToc() {
    clearTimeout(openT);
    openT = null;
    if (!spine.classList.contains("open")) return;
    spine.classList.remove("open");
    document.body.classList.remove("toc-open");
}

// The chapter being read: a slightly longer stripe at rest, bold with its glow when open
export function markCurrent(cur) {
    ROWS.forEach((r) => {
        if (r.key) r.el.classList.toggle("current", !!cur && r.key === cur.ch);
    });
}

export function initToc() {
    spine = $(".toc-spine");
    rowsEl = $(".toc-rows", spine);

    ROWS.forEach((r, i) => {
        const a = el("a", "toc-row" + (r.live ? " live" : " off") + (r.cohort ? " cohort" : "") + (r.rgb ? " tinted" : ""));
        a.style.setProperty("--rgb", r.rgb || "250,250,250");
        a.append(el("span", "toc-band glow"), el("span", "toc-label", r.label));
        if (r.live) {
            a.href = "#trang-" + PAGES[r.key][0].n;
            a.addEventListener("click", (e) => { e.preventDefault(); gotoChapter(r.key); closeToc(); });
        } else {
            a.setAttribute("aria-disabled", "true");
            a.tabIndex = -1;
            a.title = "Sắp có";
        }
        r.el = a;
        r.i = i;
        if (r.key) rowByChapter[r.key] = r;
        rowsEl.append(a);
    });

    // Open on intent only: a pointer resting on the stripes, or running along them.
    // One crossing them sideways on its way to the page keeps resetting the timer.
    let pt = null;
    spine.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse" || isMobile()) return;
        clearTimeout(closeT);
        if (spine.classList.contains("open")) return;
        const next = { x: e.clientX, y: e.clientY };
        const sideways = pt && Math.abs(next.x - pt.x) > Math.abs(next.y - pt.y);
        pt = next;
        if (sideways || !openT) {
            clearTimeout(openT);
            openT = setTimeout(() => { openT = null; if (pt) openToc(rowIndexAt(pt.y)); }, OPEN_DELAY);
        }
    });
    spine.addEventListener("pointerleave", (e) => {
        if (e.pointerType !== "mouse" || isMobile()) return;
        clearTimeout(openT);
        openT = null;
        pt = null;
        if (spine.classList.contains("open")) closeT = setTimeout(closeToc, CLOSE_DELAY);
    });
    spine.addEventListener("focusin", () => openToc());
    spine.addEventListener("focusout", (e) => { if (!spine.contains(e.relatedTarget)) closeToc(); });
    $(".toc-veil").addEventListener("click", closeToc);

    sizeSpine();
}

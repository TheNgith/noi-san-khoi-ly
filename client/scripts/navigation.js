/**
 * Navigation module
 * Tracks where the reader is (current page, stage, address bar) and scrolls
 * to pages, lines and links.
 */

import { $, store, isMobile, smooth } from "./dom.js";
import { state, pages } from "./state.js";
import { setStage } from "./cover.js";
import { openById } from "./comments.js";
import { markCurrent } from "./toc.js";

const READING_LINE = 0.38; // fraction of the window height that counts as "where I am"

let lastY = 0;

export function onScroll(force) {
    const nav = $(".navbar");
    const y = scrollY, d = y - lastY;
    if (Math.abs(d) > 8) {
        nav.classList.toggle("curled", d > 0 && y > 40);
        lastY = y;
    }
    // See-through while the cover still reaches below the navbar
    nav.classList.toggle("over-cover", $(".cover-card").getBoundingClientRect().bottom > nav.getBoundingClientRect().bottom);

    // The cover leaving starts the reading; back near the top, the cover returns
    if (Date.now() > state.stageLockUntil) {
        const cr = $(".cover_container").getBoundingClientRect();
        const gone = -cr.top / cr.height;
        if (state.stage === "cover" && gone > 0.3) setStage("reading");
        else if (state.stage === "reading" && gone < 0.12) setStage("cover");
    }

    const probe = innerHeight * READING_LINE;
    let cur = null;
    for (const p of pages) {
        const r = p.box.getBoundingClientRect();
        if (r.top <= probe && r.bottom + 24 >= probe) {
            cur = p;
            break;
        }
    }
    if (!cur && pages[pages.length - 1].box.getBoundingClientRect().bottom < probe) {
        cur = pages[pages.length - 1];
    }

    const changed = cur !== state.current || force === true;
    if (changed) {
        state.current = cur;
        if (cur) store.set("l9622-last", String(cur.n));
        if (!state.open && !state.composer) setHash(cur ? "trang-" + cur.n : "");
        markCurrent(cur);
    }
}

export function initScroll() {
    let ticking = false;
    lastY = scrollY;
    addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; onScroll(); });
    }, { passive: true });
}

// The address follows the reader: #trang-10 for a page, #c-<id> for an open thread
export function setHash(h) {
    if (h === state.hash) return;
    state.hash = h;
    try {
        history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
    } catch { /* sandboxed */ }
}

// Put a line of a page at a fraction of the window height
export function scrollToY(p, y, at) {
    const r = p.paper.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top + y * r.height - innerHeight * at, behavior: smooth });
}

export function scrollToPage(p) {
    const r = p.box.getBoundingClientRect();
    const down = r.top > 0; // going down, the navbar curls away
    scrollTo({ top: scrollY + r.top - (down ? 28 : isMobile() ? 72 : 108), behavior: smooth });
}

export function gotoChapter(code) {
    const p = pages.find((q) => q.ch === code);
    if (p) scrollToPage(p);
}

export function routeHash(h) {
    if (h.startsWith("c-")) return openById(h.slice(2), { scroll: true });
    const m = /^trang-(\d+)$/.exec(h);
    const p = m && pages.find((q) => q.n === +m[1]);
    if (p) { scrollToPage(p); return true; }
    return false;
}

/**
 * Navigation module
 * Tracks where the reader is (current page, stage, address bar) and scrolls
 * to pages, lines and links.
 */

import { $, isMobile, smooth } from "./dom.js";
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
        const hide = d > 0 && y > 40;
        nav.classList.toggle("curled", hide);
        // Phones: the bottom bar steps aside with the navbar (toolbar.css)
        $(".toolbar_container").classList.toggle("curled", hide);
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
    addEventListener("popstate", onPopState);
}

// The address follows the reader: #trang-10 for a page, #c-<id> for an open thread
export function setHash(h) {
    if (h === state.hash) return;
    state.hash = h;
    try {
        history.replaceState(history.state, "", h ? "#" + h : location.pathname + location.search);
    } catch { /* sandboxed */ }
}

function syncHash() {
    state.hash = null;
    setHash(state.open ? "c-" + state.open.g.items[0].id : state.current ? "trang-" + state.current.n : "");
}

// The back button (or an edge swipe) closes the open sheet or phone contents
// instead of leaving the book: opening one adds a history entry, and closing
// it any other way takes that entry off again. One layer at a time; `close`
// both names the layer and is what the back button calls.
let backClose = null, backPending = false;

export function holdBack(close) {
    if (!backClose && !backPending) {
        try { history.pushState({ l9622Layer: true }, ""); } catch { return; }
    }
    backClose = close;
}

export function releaseBack(close) {
    if (!backClose || backClose !== close) return;
    backClose = null;
    if (history.state?.l9622Layer) {
        backPending = true;
        history.back();
    }
}

function onPopState() {
    if (backPending) {
        // Our own step back has landed; a layer opened meanwhile gets its entry now
        backPending = false;
        if (backClose) history.pushState({ l9622Layer: true }, "");
    } else {
        const close = backClose;
        backClose = null;
        close?.();
    }
    syncHash(); // the entry we came back to kept an older address
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

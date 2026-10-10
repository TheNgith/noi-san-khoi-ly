/**
 * Cover module
 * The opening sequence, the cover's stripes as a table of contents, and the
 * flight that carries the stripe column from the cover to the left edge when
 * reading starts (and back when the reader returns to the cover).
 */

import { COVER_CLASSES, PAGES, rgbOf, years } from "./book.js";
import { $, el, store, reduced } from "./dom.js";
import { state, pages } from "./state.js";
import { rowFor, closeToc } from "./toc.js";
import { hideTrace } from "./comments.js";
import { gotoChapter, scrollToPage } from "./navigation.js";

const FLIGHT_MS = 1000;
const OPENING_MS = 2600;

let coverStripes, flyer, flyerRect = null;

// ───────── Stripes on the cover ─────────

function buildCoverStripes() {
    const label = $(".cover-label");
    const clear = () => {
        coverStripes.classList.remove("picking");
        coverStripes.querySelectorAll(".hot").forEach((h) => h.classList.remove("hot"));
        label.classList.remove("on");
    };
    // Cover order: 1821 at the top, 9699 at the bottom
    [...COVER_CLASSES].reverse().forEach((code) => {
        const live = !!PAGES[code];
        const s = el("button", "cover-stripe glow" + (live ? "" : " off"));
        s.type = "button";
        s.style.setProperty("--rgb", rgbOf[code]);
        s.style.setProperty("--k", COVER_CLASSES.indexOf(code)); // draw order, bottom first
        s.setAttribute("aria-label", live ? `Đọc khoá ${code}, ${years(code)}` : `Khoá ${code}, sắp có`);
        if (!live) s.tabIndex = -1;
        const show = () => {
            if (document.body.classList.contains("opening") || state.stage !== "cover") return;
            coverStripes.classList.add("picking");
            coverStripes.querySelectorAll(".hot").forEach((h) => h.classList.remove("hot"));
            s.classList.add("hot");
            const r = s.getBoundingClientRect(), c = $(".cover_container").getBoundingClientRect();
            label.style.top = r.top - c.top + r.height / 2 + "px";
            label.style.setProperty("--rgb", rgbOf[code]);
            $(".cover-label-code", label).textContent = "L" + code;
            $(".cover-label-years", label).textContent = live ? years(code) : years(code) + " · sắp có";
            label.classList.add("on");
        };
        s.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") show(); });
        s.addEventListener("focus", show);
        s.addEventListener("click", () => { if (live) gotoChapter(code); });
        coverStripes.append(s);
    });
    coverStripes.addEventListener("pointerleave", clear);
    coverStripes.addEventListener("focusout", (e) => { if (!coverStripes.contains(e.relatedTarget)) clear(); });
    return clear;
}
let clearPick = () => {};

// ───────── The flight ─────────

function placeFlyer() {
    const first = rowFor(COVER_CLASSES[0]), last = rowFor(COVER_CLASSES[COVER_CLASSES.length - 1]);
    const a = first.getBoundingClientRect(), b = last.getBoundingClientRect();
    flyerRect = { left: a.left, top: a.top, width: $(".toc-band", first).offsetWidth, height: b.bottom - a.top };
    Object.assign(flyer.style, {
        left: flyerRect.left + "px", top: flyerRect.top + "px",
        width: flyerRect.width + "px", height: flyerRect.height + "px",
    });
}

// t: 0 = on the cover, 1 = docked at the edge. Stepped by hand each frame so the
// cover end stays attached while the page scrolls, and a flight can turn back midway.
// (Re-keying a Web Animation every frame stalls it in Chrome.)
const flight = { active: false, t: 0, target: 0, last: 0, raf: 0 };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function drawFlyer(e) {
    const s = coverStripes.getBoundingClientRect(), d = flyerRect;
    const dx = (s.left + s.width / 2 - (d.left + d.width / 2)) * (1 - e);
    const dy = (s.top + s.height / 2 - (d.top + d.height / 2)) * (1 - e);
    const sx = s.width / d.width + (1 - s.width / d.width) * e;
    const sy = s.height / d.height + (1 - s.height / d.height) * e;
    // Turning over on the way puts 9699 at the top, in reading order
    flyer.style.transform = `translate(${dx}px, ${dy}px) perspective(1600px) rotateX(${180 * e}deg) scale(${sx}, ${sy})`;
}

function tick(now) {
    const dt = Math.min(64, now - flight.last);
    flight.last = now;
    const dir = flight.target > flight.t ? 1 : -1;
    flight.t = Math.min(1, Math.max(0, flight.t + dir * dt / FLIGHT_MS));
    drawFlyer(easeInOut(flight.t));
    if (flight.t === flight.target) { endFlight(); return; }
    flight.raf = requestAnimationFrame(tick);
}

function endFlight() {
    cancelAnimationFrame(flight.raf);
    const landed = flight.active && flight.target === 1;
    flight.active = false;
    document.body.classList.remove("flying");
    if (landed) {
        // Docked stripes show at full colour, then settle to read / unread
        document.body.classList.add("landing");
        setTimeout(() => document.body.classList.remove("landing"), 420);
    }
}

function fly(dir) {
    if (reduced) return;
    flight.target = dir > 0 ? 1 : 0;
    if (flight.active) return; // in the air: it simply turns toward the new target
    flight.active = true;
    flight.t = dir > 0 ? 0 : 1;
    placeFlyer();
    drawFlyer(easeInOut(flight.t));
    document.body.classList.add("flying");
    flight.last = performance.now();
    flight.raf = requestAnimationFrame(tick);
}

// ───────── Stages ─────────

export function setStage(s, { instant = false } = {}) {
    if (s === state.stage) return;
    const prev = state.stage;
    state.stage = s;
    document.body.classList.toggle("st-cover", s === "cover");
    document.body.classList.toggle("st-reading", s === "reading");
    if (s === "cover") {
        closeToc();
        hideTrace();
    } else {
        clearPick();
    }
    if (!instant && prev) fly(s === "reading" ? 1 : -1);
}

// Cover rises in, stripes draw from 96 up to 21, then the cue appears
export function playOpening() {
    const body = document.body;
    body.classList.remove("opening");
    void body.offsetWidth;
    if (reduced) return;
    body.classList.add("opening");
    setTimeout(() => body.classList.remove("opening"), OPENING_MS);
}

// ───────── Init ─────────

export function initCover() {
    coverStripes = $(".cover-stripes");
    flyer = $(".stripe-flyer");
    clearPick = buildCoverStripes();

    [...COVER_CLASSES].reverse().forEach((code) => {
        const b = el("span", "glow");
        b.style.setProperty("--rgb", rgbOf[code]);
        flyer.append(b);
    });

    // Returning readers are offered their last page
    const last = pages.find((p) => p.n === +store.get("l9622-last"));
    const resume = last && last !== pages[0] ? last : null;
    if (resume) {
        $(".cue-main-text").textContent = "Đọc tiếp";
        $(".cue-sub").textContent = `trang ${resume.n} · ${resume.name}`;
        $(".cue-alt").hidden = false;
    }
    $(".cue-main").addEventListener("click", () => scrollToPage(resume || pages[0]));
    $(".cue-alt").addEventListener("click", () => scrollToPage(pages[0]));
}

/**
 * Easter eggs module
 * One hidden link per section, on something printed on its pages (a word, a
 * line, a detail in a photo). Hovering it plays a small reaction ("tell");
 * clicking it plays a short exit and goes to the egg's own page. On phones
 * the first tap plays the tell and a second tap within 3s follows the link.
 *
 * Spots come from eggs.gen.js (built by tools/pages/eggs.mjs). Each lives
 * inside its page's .page-paper, positioned in %, so it follows zoom, fit and
 * dual-page mode. The spot is the object's exact box; only its .egg-hit takes
 * the pointer, and grows to a fingertip on touch screens. Add ?eggs=show to
 * the address to outline every spot.
 */

import { EGGS } from "./eggs.gen.js";
import { rgbOf } from "./book.js";
import { el, reduced, store } from "./dom.js";
import { pageById } from "./state.js";

const GO_MS = 420;     // exit before leaving the page
const ARM_MS = 3000;   // phones: a second tap within this follows the link
const FOUND_KEY = "l9622-eggs";

let armed = null, armT = null;

const pct = (v) => `${+(v * 100).toFixed(4)}%`;

function found() {
    try { return JSON.parse(store.get(FOUND_KEY)) || []; } catch { return []; }
}

function markFound(key) {
    const list = found();
    if (!list.includes(key)) store.set(FOUND_KEY, JSON.stringify([...list, key]));
}

// The reader's own class colour ("L1922" → its stripe), for tells that use it
function readerRgb() {
    const code = /(\d{4})/.exec(store.get("l9622-cls") || "")?.[1];
    return rgbOf[code] || "120,120,120";
}

/**
 * A copy of the page cut to the area the tell moves, laid exactly over the
 * printed original, so a tell animates the object itself. `under` is a sheet
 * of paper behind it, shown by tells that move the copy off its place.
 */
function buildLift(src, box, lift = box) {
    const [bx, by, bw, bh] = box, [lx, ly, lw, lh] = lift;
    const place = (node) => Object.assign(node.style, {
        left: pct((lx - bx) / bw), top: pct((ly - by) / bh), width: pct(lw / bw), height: pct(lh / bh),
    });
    const under = el("span", "egg-under");
    const copy = el("span", "egg-lift");
    place(under);
    place(copy);
    Object.assign(copy.style, {
        backgroundImage: `url("${src}")`,
        backgroundSize: `${pct(1 / lw)} ${pct(1 / lh)}`,
        backgroundPosition: `${lw < 1 ? pct(lx / (1 - lw)) : "0"} ${lh < 1 ? pct(ly / (1 - lh)) : "0"}`,
    });
    return [under, copy];
}

// Restart a one-shot animation class
function replay(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
}

function go(egg, spot) {
    markFound(egg.key);
    if (reduced) { location.href = egg.href; return; }
    spot.classList.remove("is-tell");
    spot.classList.add("is-go");
    setTimeout(() => { location.href = egg.href; }, GO_MS);
}

function disarm() {
    clearTimeout(armT);
    armed = null;
}

function buildSpot(egg, s) {
    const p = pageById[s.page];
    if (!p) return;
    const [x, y, w, h] = s.box;
    const spot = el("a", `egg-spot egg-${egg.tell}` + (s.check ? " egg-check" : ""));
    spot.href = egg.href;
    spot.tabIndex = -1;
    spot.setAttribute("aria-label", egg.label);
    spot.draggable = false;
    Object.assign(spot.style, { left: pct(x), top: pct(y), width: pct(w), height: pct(h) });
    spot.append(el("span", "egg-hit"), ...buildLift(p.paper.querySelector("img").src, s.box, s.lift));

    let pointer = "mouse";
    spot.addEventListener("pointerdown", (e) => {
        pointer = e.pointerType;
        e.stopPropagation(); // no long-press comment on an egg
    });
    spot.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "mouse" && !reduced) replay(spot, "is-tell");
    });
    spot.addEventListener("animationend", (e) => {
        if (e.target === spot || spot.contains(e.target)) spot.classList.remove("is-tell");
    });
    spot.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // a click on an egg never comments
        if (pointer !== "mouse" && armed !== spot) {
            disarm();
            armed = spot;
            armT = setTimeout(disarm, ARM_MS);
            if (!reduced) replay(spot, "is-tell");
            return;
        }
        disarm();
        go(egg, spot);
    });
    p.paper.append(spot);
}

export function initEggs() {
    if (new URLSearchParams(location.search).get("eggs") === "show") document.body.classList.add("eggs-show");
    document.documentElement.style.setProperty("--egg-reader-rgb", readerRgb());
    EGGS.forEach((egg) => egg.spots.forEach((s) => buildSpot(egg, s)));
}

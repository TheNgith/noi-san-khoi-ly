/**
 * Easter eggs module
 * One hidden egg per section, on something printed on its pages (a word, a
 * line, a detail in a photo). Hovering it plays a small reaction ("tell").
 * Clicking it plays the egg: an interaction on the page itself that acts out
 * what the object means (scripts/eggs/<key>.js, loaded on first use). Once
 * played, a small link leads on to the egg's own page. On phones the first
 * tap plays the tell and a second tap within 3s plays the egg.
 *
 * An egg's play(ctx) gets a stage over its page (.egg-stage, inside the
 * .page-paper) and helpers to draw in page units, and returns a cleanup.
 * Escape, or a click anywhere off the egg, closes it.
 *
 * Spots come from eggs.gen.js (built by tools/pages/eggs.mjs). Each lives
 * inside its page's .page-paper, positioned in %, so it follows zoom, fit and
 * dual-page mode. The spot is the object's exact box; only its .egg-hit takes
 * the pointer, and grows to a fingertip on touch screens. Add ?eggs=show to
 * the address to outline every spot.
 */

import { EGGS } from "./eggs.gen.js";
import { rgbOf } from "./book.js";
import { PAGE_W, PAGE_H } from "./pages.gen.js";
import { el, reduced, store } from "./dom.js";
import { pageById } from "./state.js";

const GO_MS = 420;     // exit before leaving the page (eggs without a play yet)
const ARM_MS = 3000;   // phones: a second tap within this plays the egg
const CLOSE_MS = 220;
const FOUND_KEY = "l9622-eggs";
const SVG_NS = "http://www.w3.org/2000/svg";

// Page units for drawing: 1000 across, the A5 height down
const UNITS = { W: 1000, H: Math.round((1000 * PAGE_H) / PAGE_W * 10) / 10 };

let armed = null, armT = null, active = null;

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

// Eggs whose play isn't written yet still lead to their page
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
        play(egg, spot, s, p);
    });
    p.paper.append(spot);
}

/* ---------- Playing an egg ---------- */

function makeCtx(egg, spot, s, p, stage) {
    const [bx, by, bw, bh] = s.box;
    const ctx = {
        egg, spot, page: p, stage, reduced, units: UNITS,
        box: { x: bx, y: by, w: bw, h: bh },
        parts: Object.fromEntries((s.parts || []).map(({ name, box: [x, y, w, h] }) => [name, { x, y, w, h }])),
        reader: { name: (store.get("l9622-name") || "").trim(), cls: (store.get("l9622-cls") || "").trim() },
        // An SVG over the whole page, drawn in page units (1000 × UNITS.H)
        svg(cls = "") {
            const svg = document.createElementNS(SVG_NS, "svg");
            svg.setAttribute("viewBox", `0 0 ${UNITS.W} ${UNITS.H}`);
            svg.setAttribute("class", "egg-svg " + cls);
            stage.append(svg);
            return svg;
        },
        // An SVG element with attributes, appended to `parent`
        draw(parent, tag, attrs = {}, text) {
            const node = document.createElementNS(SVG_NS, tag);
            Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
            if (text != null) node.textContent = text;
            parent.append(node);
            return node;
        },
        // Pointer position in page units
        toPage(e, svg) {
            const r = (svg || stage).getBoundingClientRect();
            return { x: ((e.clientX - r.left) / r.width) * UNITS.W, y: ((e.clientY - r.top) / r.height) * UNITS.H };
        },
        // An HTML element placed at page fractions (x, y)
        at(node, x, y) {
            Object.assign(node.style, { left: pct(x), top: pct(y) });
            stage.append(node);
            return node;
        },
        // The egg has been played: offer the way on to its page, in the blank
        // strip above the page's footer
        done() {
            if (stage.querySelector(".egg-door")) return;
            const door = el("a", "egg-door", "Trang bí mật →");
            door.href = egg.href;
            ctx.at(door, 0.5, 0.925);
        },
        close: () => close(),
    };
    return ctx;
}

// The pen eggs write with (Patrick Hand has Vietnamese), fetched on first play only
function ensurePenFont() {
    if (document.getElementById("egg-pen-font")) return;
    const link = el("link");
    link.id = "egg-pen-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap";
    document.head.append(link);
}

async function play(egg, spot, s, p) {
    if (active?.spot === spot) return;
    close(true);
    markFound(egg.key);
    ensurePenFont();
    let mod = null;
    try { mod = await import(`./eggs/${egg.key}.js`); } catch { /* not written yet */ }
    if (!mod?.play) { go(egg, spot); return; }

    const stage = el("div", "egg-stage");
    stage.addEventListener("pointerdown", (e) => {
        e.stopPropagation(); // no long-press comment mid-play
        if (active && e.target.closest(".egg-live")) active.pressedLive = true;
    });
    p.paper.append(stage);
    document.body.classList.add("egg-playing");
    const ctx = makeCtx(egg, spot, s, p, stage);
    active = { spot, stage, cleanup: null, pressedLive: false };
    active.cleanup = mod.play(ctx) || null;
}

function close(instant) {
    if (!active) return;
    const { stage, cleanup } = active;
    active = null;
    document.body.classList.remove("egg-playing");
    try { cleanup?.(); } catch { /* a broken egg must not break the reader */ }
    if (instant || reduced) { stage.remove(); return; }
    stage.classList.add("is-closing");
    setTimeout(() => stage.remove(), CLOSE_MS);
}

// A click off the egg closes it, and does only that (no comment form). A
// drag that began on the egg (the magnet) can end its click anywhere on the
// page; that click is swallowed instead.
function onClickCapture(e) {
    if (!active) return;
    const fromLive = active.pressedLive;
    active.pressedLive = false;
    if (e.target.closest?.(".egg-stage .egg-live, .egg-door, .egg-spot")) return;
    e.stopPropagation();
    e.preventDefault();
    if (!fromLive) close();
}

export function initEggs() {
    if (new URLSearchParams(location.search).get("eggs") === "show") document.body.classList.add("eggs-show");
    document.documentElement.style.setProperty("--egg-reader-rgb", readerRgb());
    EGGS.forEach((egg) => egg.spots.forEach((s) => buildSpot(egg, s)));
    document.addEventListener("click", onClickCapture, true);
    addEventListener("keydown", (e) => { if (e.key === "Escape" && active) close(); });
}

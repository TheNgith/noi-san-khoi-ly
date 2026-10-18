/**
 * Comments module
 * Bubbles placed at the exact line they talk about, the line highlight that
 * ties them together, threads, the pointer line (click a page to comment on
 * it) and the inline comment form,
 * and the phone layout (dots on the page edge, threads in a bottom sheet).
 */

import { $, el, store, isMobile } from "./dom.js";
import { state, pages, pageById, comments } from "./state.js";
import { fetchAllComments, saveComment } from "./api.js";
import { makeRoom, releaseRoom } from "./reader.js";
import { scrollToY, setHash } from "./navigation.js";

const CLUSTER_PX = 34;     // comments closer than this share one bubble
const NEAR_BUBBLE_PX = 22; // pointer this close to a bubble's line previews it; a click opens it
const TRACE_IDLE_MS = 1400; // the pointer line fades once the pointer rests this long
const CLICK_SLOP_PX = 6;    // a press that moves further than this is a drag, not a click
const LONG_PRESS_MS = 480;

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

// ───────── Loading ─────────

function normalise(raw) {
    const p = pageById[raw.imageId];
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!p || !text) return null; // unknown page or empty comment
    return {
        id: String(raw.id || "local-" + Math.random().toString(36).slice(2)),
        page: p.id,
        x: clamp01(raw.xPct),
        y: clamp01(raw.yPct),
        author: String(raw.author || raw.name || "Ẩn danh").trim(),
        cls: typeof raw.cls === "string" ? raw.cls : "",
        chapter: raw.chapter || "",
        text,
        created: Date.parse(raw.createdAt) || Date.now(),
        status: "sent",
    };
}

export async function loadComments() {
    const list = (await fetchAllComments()).map(normalise).filter(Boolean);
    comments.push(...list);
    renderAll(false);
}

// ───────── Clusters & bubbles ─────────

function clustersOf(p) {
    const H = state.pageW * p.h / p.w;
    const list = comments.filter((c) => c.page === p.id).sort((a, b) => a.y - b.y);
    const out = [];
    for (const c of list) {
        const last = out[out.length - 1];
        if (last && (c.y - last.y0) * H < CLUSTER_PX) last.items.push(c);
        else out.push({ y0: c.y, items: [c] });
    }
    out.forEach((g) => {
        g.page = p;
        g.y = g.items.reduce((s, c) => s + c.y, 0) / g.items.length;
        g.items.sort((a, b) => a.created - b.created);
    });
    return out;
}

const allClusters = () => pages.flatMap((p) => p.clusters);

function renderPage(p, calm) {
    p.margin.querySelectorAll(".comment-bubble").forEach((b) => b.remove());
    p.dots.textContent = "";
    p.clusters = clustersOf(p);
    const still = calm && p.revealed;
    p.clusters.forEach((g, i) => {
        g.bubble = makeBubble(g, still, i);
        p.margin.append(g.bubble);
        g.dot = makeDot(g, still, i);
        p.dots.append(g.dot);
    });
}

// Rebuild every page's bubbles (after loading, zoom, resize, mode switch),
// keeping an open thread or comment form where it was.
export function renderAll(calm) {
    const openId = state.open?.g.items[0].id;
    if (state.open) {
        state.open.g.page.box.classList.remove("has-open");
        state.open = null;
        document.body.classList.remove("has-open");
    }
    preview = null;
    pages.forEach((p) => {
        p.anchor.className = "page-anchor";
        renderPage(p, calm);
    });
    if (openId) openById(openId, { scroll: false, instant: true });
    if (state.composer) {
        const c = state.composer;
        showAnchor(c.p, c.x, c.y, "is-on", false);
        markPageEnd(c.p, c.f, c.f.offsetTop);
    }
}

// How far down an open thread or form its page ends; below that it fades
// into the next page (see .comment-thread::before)
function markPageEnd(p, box, top) {
    box.style.setProperty("--below", p.paper.offsetHeight - top + "px");
}

// Bubbles arrive when their page scrolls into view
function reveal(p) {
    if (!p || p.revealed) return;
    p.revealed = true;
    [p.single.margin, p.dualSlot.margin, p.dots].forEach((n) => n.classList.add("revealed"));
}

let io = null;
export function observeUnrevealed() {
    io.disconnect();
    new Set(pages.filter((p) => !p.revealed).map((p) => p.box)).forEach((box) => io.observe(box));
}

function makeBubble(g, calm, i) {
    const n = g.items.length;
    const failed = g.items.some((c) => c.status === "failed");
    const b = el("div", "comment-bubble" + (calm ? " calm" : "") + (failed ? " failed" : ""));
    b.style.top = g.y * 100 + "%";
    if (!calm) b.style.animationDelay = 200 + i * 110 + "ms";
    b.tabIndex = 0;
    b.setAttribute("role", "button");
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-label", `${n} bình luận ở trang ${g.page.n}`);
    b.innerHTML = '<span class="bubble-icon"></span><span class="bubble-count"></span><span class="bubble-underline glow"></span><div class="comment-thread"></div>';
    $(".bubble-count", b).textContent = failed ? "!" : n > 1 ? n : "";
    b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!b.classList.contains("open")) openCluster(g);
    });
    b.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === b) {
            e.preventDefault();
            b.classList.contains("open") ? closeThread() : openCluster(g);
        }
    });
    b.addEventListener("mouseenter", () => { if (!state.open && !state.composer) { hideTrace(); setPreview(g); } });
    b.addEventListener("mouseleave", () => { if (!state.open && !state.composer) clearPreview(); });
    return b;
}

// Phone: a dot on the page's edge instead of a bubble in the margin
function makeDot(g, calm, i) {
    const d = el("button", "comment-dot");
    d.type = "button";
    d.style.top = g.y * 100 + "%";
    if (calm) d.style.animation = "none";
    else d.style.animationDelay = 200 + i * 110 + "ms";
    d.setAttribute("aria-label", `${g.items.length} bình luận`);
    if (g.items.length > 1) d.textContent = g.items.length;
    else d.append(el("span", "dot-icon"));
    d.addEventListener("click", (e) => { e.stopPropagation(); openCluster(g); });
    return d;
}

// ───────── Line highlight ─────────

// Marks only the line (y). x is still stored with each comment but not drawn.
// mode: "is-trace" (line under the pointer), "is-preview" (hovered bubble), "is-on" (open)
function showAnchor(p, x, y, mode, draw = mode === "is-on") {
    pages.forEach((q) => { if (q !== p) q.anchor.className = "page-anchor"; });
    const a = p.anchor;
    a.style.setProperty("--x", x);
    a.style.setProperty("--y", y);
    a.className = "page-anchor " + mode;
    if (draw) {
        void a.offsetWidth; // restart the draw animation
        a.classList.add("is-draw");
    }
}

const hideAnchor = (p) => { p.anchor.className = "page-anchor"; };

let preview = null;
function setPreview(g) {
    if (preview === g) return;
    clearPreview();
    preview = g;
    g.bubble.classList.add("is-preview");
    showAnchor(g.page, g.items[0].x, g.items[0].y, "is-preview");
}

export function clearPreview() {
    if (!preview) return;
    preview.bubble.classList.remove("is-preview");
    if (!state.open && !state.composer) hideAnchor(preview.page);
    preview = null;
}

// ───────── Threads ─────────

// Under a day: relative; older: the exact date
function formatTime(t) {
    const d = Date.now() - t;
    if (d < 60e3) return "Vừa xong";
    if (d < 3600e3) return Math.floor(d / 60e3) + " phút trước";
    if (d < 86400e3) return Math.floor(d / 3600e3) + " giờ trước";
    const x = new Date(t);
    return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}

function fillTime(timeEl, c) {
    timeEl.textContent = "";
    if (c.status === "pending") { timeEl.textContent = "Đang gửi…"; return; }
    if (c.status === "failed") {
        timeEl.append("Chưa gửi được. Kiểm tra kết nối rồi thử lại.");
        const retry = el("button", "", "Thử lại");
        retry.type = "button";
        retry.addEventListener("click", (e) => { e.stopPropagation(); c.status = "pending"; refreshItem(c); send(c); });
        const drop = el("button", "", "Bỏ");
        drop.type = "button";
        drop.addEventListener("click", (e) => {
            e.stopPropagation();
            const i = comments.indexOf(c);
            if (i > -1) comments.splice(i, 1);
            closeThread();
            renderAll(true);
        });
        timeEl.append(retry, drop);
        return;
    }
    timeEl.textContent = formatTime(c.created);
}

function itemEl(c, i, g) {
    const it = el("div", "comment-item" + (c.status !== "sent" ? " " + c.status : ""));
    it.dataset.id = c.id;
    it.style.setProperty("--i", i);
    const meta = el("div", "comment-meta");
    // The underline takes the colour of the section the comment is in
    meta.style.setProperty("--rgb", g.page.rgb);
    const author = el("div", "comment-author", c.author);
    if (c.cls) author.append(el("span", "comment-cls", c.cls));
    meta.append(author, el("div", "author-underline glow"));
    const time = el("div", "comment-time");
    fillTime(time, c);
    it.append(meta, el("div", "comment-text", c.text), time);
    it.addEventListener("mouseenter", () => { if (state.open?.g === g) showAnchor(g.page, c.x, c.y, "is-on"); });
    return it;
}

function buildThread(g, container) {
    container.textContent = "";
    g.items.forEach((c, i) => container.append(itemEl(c, i, g)));
}

export function openCluster(g, { scroll = true, instant = false } = {}) {
    closeComposer(true);
    if (state.open) closeThread(true);
    clearPreview();
    hideTrace();
    reveal(g.page);
    state.open = { g };
    document.body.classList.add("has-open");
    const first = g.items[0];
    if (isMobile()) {
        const wrap = el("div", "comment-thread in-sheet" + (instant ? " instant" : ""));
        buildThread(g, wrap);
        openSheet(wrap, g.page.rgb, `Trang ${g.page.n} · ${g.page.name} · ${g.items.length} bình luận`);
        if (scroll) scrollToY(g.page, g.y, 0.2);
    } else {
        const th = $(".comment-thread", g.bubble);
        th.classList.toggle("instant", instant);
        buildThread(g, th);
        g.bubble.style.top = first.y * 100 + "%"; // the first name sits on the highlighted line
        g.bubble.classList.add("open");
        g.bubble.setAttribute("aria-expanded", "true");
        g.page.box.classList.add("has-open");
        markPageEnd(g.page, th, g.bubble.offsetTop + th.offsetTop);
        makeRoom(g.page);
        if (scroll) {
            const r = g.page.paper.getBoundingClientRect();
            const vy = r.top + g.y * r.height;
            if (vy < innerHeight * 0.15 || vy > innerHeight * 0.62) scrollToY(g.page, g.y, 0.3);
        }
    }
    showAnchor(g.page, first.x, first.y, "is-on", !instant);
    setHash("c-" + first.id);
}

export function closeThread(silent) {
    if (!state.open) return;
    const g = state.open.g;
    g.bubble.classList.remove("open");
    g.bubble.style.top = g.y * 100 + "%";
    g.bubble.setAttribute("aria-expanded", "false");
    g.page.box.classList.remove("has-open");
    releaseRoom();
    hideAnchor(g.page);
    state.open = null;
    document.body.classList.remove("has-open");
    if (isMobile() && !silent) closeSheet();
    if (!silent) setHash(state.current ? "trang-" + state.current.n : "");
}

export function openById(id, opts) {
    for (const g of allClusters()) {
        if (g.items.some((c) => c.id === id)) { openCluster(g, opts); return true; }
    }
    return false;
}

// ↑ / ↓ through every comment in the book
export function step(dir) {
    const list = allClusters();
    if (!list.length) return;
    const i = state.open ? list.indexOf(state.open.g) : -1;
    const next = list[(i + dir + list.length) % list.length];
    openCluster(next, { scroll: false });
    scrollToY(next.page, next.y, isMobile() ? 0.2 : 0.32);
}

// N: the next comment below the reading line
export function nextFromView() {
    if (state.open) return step(1);
    const line = innerHeight * 0.4 + 4;
    const list = allClusters();
    const g = list.find((q) => {
        const r = q.page.paper.getBoundingClientRect();
        return r.top + q.y * r.height > line;
    }) || list[0];
    if (!g) return;
    openCluster(g, { scroll: false });
    scrollToY(g.page, g.y, isMobile() ? 0.2 : 0.32);
}

function refreshItem(c) {
    renderAll(true);
    const it = document.querySelector(`.comment-item[data-id="${CSS.escape(c.id)}"]`);
    if (it && c.status === "sent") it.classList.add("fresh");
}

// ───────── Pointer line: click anywhere on a page to comment on that line ─────────

let trace = null, traceIdle = 0, press = null, lastPointer = "mouse";

export function hideTrace() {
    clearTimeout(traceIdle);
    if (!trace) return;
    if (!state.open && !state.composer && !preview) hideAnchor(trace.p);
    trace = null;
}

export const traceActive = () => trace;
export const openComposerAtTrace = () => openComposer(trace.p, trace.x, trace.y);

const pageOf = (target) => {
    const paper = target.closest?.(".page-paper");
    return paper ? pageById[paper.dataset.page] : null;
};

// Follows the pointer only while it moves over a page; resting, it fades
function onReaderPointerMove(e) {
    if (e.pointerType !== "mouse" || isMobile() || !state.commentsOn || state.open || state.composer || state.stage !== "reading") return hideTrace();
    if (e.target.closest(".comment-bubble, .egg-spot, .egg-stage") || document.body.classList.contains("egg-playing")) return hideTrace();
    const p = pageOf(e.target);
    if (!p) { hideTrace(); clearPreview(); return; }
    const r = p.paper.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    if (y < 0.015 || y > 0.985) { hideTrace(); clearPreview(); return; }
    const near = p.clusters.find((g) => Math.abs(g.y - y) * r.height < NEAR_BUBBLE_PX);
    if (near) { hideTrace(); setPreview(near); return; }
    clearPreview();
    trace = { p, x: clamp01((e.clientX - r.left) / r.width), y };
    showAnchor(p, trace.x, y, "is-trace", false);
    clearTimeout(traceIdle);
    traceIdle = setTimeout(() => {
        if (p.anchor.classList.contains("is-trace")) p.anchor.classList.add("is-idle");
    }, TRACE_IDLE_MS);
}

// A click on a page opens the form at that line, or the thread whose line it is
export function clickPage(e) {
    if (isMobile() || !state.commentsOn || state.stage !== "reading") return;
    const p = pageOf(e.target);
    if (!p) return;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP_PX) return;
    if (preview) return openCluster(preview);
    const r = p.paper.getBoundingClientRect();
    openComposer(p, clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height));
}

// ───────── Comment form ─────────

const textWidth = (() => {
    const ctx = document.createElement("canvas").getContext("2d");
    return (s, font) => { ctx.font = font; return ctx.measureText(s).width; };
})();

export function openComposer(p, x, y) {
    if (!state.commentsOn) return;
    if (state.open) closeThread(true);
    closeComposer(true);
    clearPreview();
    hideTrace();
    const f = el("form", "comment-composer");
    f.noValidate = true;
    f.innerHTML =
        '<div class="composer-who">' +
        '<input id="composer-name" name="name" maxlength="40" autocomplete="name" placeholder="Tên của bạn" aria-label="Tên của bạn">' +
        '<input id="composer-cls" name="cls" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Khóa" aria-label="Khóa">' +
        '</div>' +
        '<div class="composer-underline glow"></div>' +
        '<textarea id="composer-text" name="text" rows="2" maxlength="2000" placeholder="Bình luận" aria-label="Bình luận"></textarea>' +
        '<div class="composer-msg" aria-live="polite"></div>' +
        '<div class="composer-foot"><span class="composer-keys">Enter để gửi · Shift+Enter xuống dòng</span>' +
        '<span class="composer-actions"><button type="button" class="composer-cancel">Huỷ</button><button type="submit" class="composer-send">Gửi</button></span></div>';
    const name = $("#composer-name", f), cls = $("#composer-cls", f), ta = $("#composer-text", f);
    const ul = $(".composer-underline", f), msg = $(".composer-msg", f);
    name.value = store.get("l9622-name") || "";
    cls.value = store.get("l9622-cls") || "";

    // The name's underline follows its width, in the section's colour
    ul.style.setProperty("--rgb", p.rgb);
    const sync = () => {
        const font = `700 ${getComputedStyle(name).fontSize} "Inter Tight", sans-serif`;
        const w = Math.ceil(textWidth(name.value || name.placeholder, font)) + 2;
        name.style.width = w + "px";
        ul.style.width = w + 6 + "px";
    };
    name.addEventListener("input", sync);
    ta.addEventListener("input", () => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
        msg.textContent = "";
    });
    // isComposing keeps Vietnamese IME input (Telex/VNI) from sending mid-word
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit(); }
    });
    [name, cls].forEach((i) => i.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); ta.focus(); }
    }));
    $(".composer-cancel", f).addEventListener("click", (e) => { e.stopPropagation(); closeComposer(); });
    f.addEventListener("click", (e) => e.stopPropagation());
    f.addEventListener("submit", (e) => {
        e.preventDefault();
        const nm = name.value.trim(), text = ta.value.trim();
        if (!nm) { msg.textContent = "Vui lòng nhập tên"; name.focus(); return; }
        if (!text) { msg.textContent = "Viết vài chữ trước khi gửi."; ta.focus(); return; }
        const k = cls.value.trim();
        store.set("l9622-name", nm);
        store.set("l9622-cls", k);
        const c = {
            id: "local-" + Date.now().toString(36), page: p.id, x, y,
            author: nm, cls: k, chapter: p.kind === "class" ? "k" + p.ch : p.ch,
            text, created: Date.now(), status: "pending",
        };
        comments.push(c);
        closeComposer(true);
        renderAll(true);
        openById(c.id, { scroll: false });
        send(c);
    });

    state.composer = { p, x, y, f };
    if (isMobile()) {
        f.classList.add("in-sheet");
        openSheet(f, p.rgb, `Trang ${p.n} · bình luận mới`);
        scrollToY(p, y, 0.2);
    } else {
        f.style.top = y * 100 + "%";
        p.margin.append(f);
        p.box.classList.add("has-open");
        markPageEnd(p, f, f.offsetTop);
        makeRoom(p);
    }
    showAnchor(p, x, y, "is-on");
    sync();
    (name.value ? ta : name).focus({ preventScroll: true });
}

export function closeComposer(silent) {
    const c = state.composer;
    if (!c) return;
    c.f.remove();
    c.p.box.classList.remove("has-open");
    if (!state.open) {
        releaseRoom();
        hideAnchor(c.p);
    }
    state.composer = null;
    if (isMobile() && !silent) closeSheet();
}

export const composerHasText = () => !!state.composer && !!$("#composer-text").value.trim();

async function send(c) {
    try {
        const saved = await saveComment({
            imageId: c.page, xPct: c.x, yPct: c.y, text: c.text,
            author: c.author, cls: c.cls, chapter: c.chapter,
            createdAt: new Date(c.created).toISOString(),
        });
        if (saved?.id) c.id = String(saved.id);
        c.created = Date.parse(saved?.createdAt) || Date.now();
        c.status = "sent";
    } catch (err) {
        console.error(err);
        c.status = "failed";
    }
    refreshItem(c);
}

// ───────── Phone: bottom sheet & long-press ─────────

export function openSheet(node, rgb, head) {
    const sheet = $("#comment-sheet");
    sheet.style.setProperty("--rgb", rgb);
    $(".sheet-body", sheet).replaceChildren(el("div", "sheet-head", head), node);
    sheet.classList.add("on");
    $("#sheet-scrim").classList.add("on");
    sheet.scrollTop = 0;
}

export function closeSheet() {
    $("#comment-sheet").classList.remove("on");
    $("#sheet-scrim").classList.remove("on");
}

function initTouch(reader) {
    let lp = null;
    const cancel = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
    reader.addEventListener("pointerdown", (e) => {
        lastPointer = e.pointerType;
        if (e.pointerType === "mouse" || !state.commentsOn || state.open || state.composer) return;
        const paper = e.target.closest(".page-paper");
        if (!paper || e.target.closest(".comment-dot")) return;
        const p = pageById[paper.dataset.page];
        const sx = e.clientX, sy = e.clientY;
        lp = {
            sx, sy,
            t: setTimeout(() => {
                const r = p.paper.getBoundingClientRect();
                lp = null;
                state.guardUntil = Date.now() + 600; // the finger's release must not close the form
                openComposer(p, (sx - r.left) / r.width, (sy - r.top) / r.height);
            }, LONG_PRESS_MS),
        };
    });
    reader.addEventListener("pointerup", cancel);
    reader.addEventListener("pointercancel", cancel);
    reader.addEventListener("pointermove", (e) => {
        if (lp && Math.hypot(e.clientX - lp.sx, e.clientY - lp.sy) > 10) cancel();
    });
    reader.addEventListener("contextmenu", (e) => {
        if (lastPointer !== "mouse" && e.target.closest(".page-paper")) e.preventDefault();
    });
}

// ───────── Init ─────────

export function initComments() {
    const reader = $("#reader");
    io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            if (!en.isIntersecting) return;
            pages.filter((p) => p.box === en.target).forEach(reveal);
            io.unobserve(en.target);
        });
    }, { threshold: 0.3 });
    pages.forEach((p) => renderPage(p, false));
    observeUnrevealed();

    reader.addEventListener("pointermove", onReaderPointerMove);
    reader.addEventListener("pointerleave", () => {
        hideTrace();
        if (!state.open && !state.composer) clearPreview();
    });
    reader.addEventListener("pointerdown", (e) => { press = { x: e.clientX, y: e.clientY }; });
    initTouch(reader);

    $("#sheet-scrim").addEventListener("click", (e) => {
        e.stopPropagation();
        if (composerHasText()) return;
        closeComposer();
        closeThread();
        closeSheet();
    });
}

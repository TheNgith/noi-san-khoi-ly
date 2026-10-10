/**
 * Thầy Phúc, p. 281: “ra khỏi Bắc vào Nam”, his spell for field lines.
 *
 * A bar magnet appears on the phrase, and its field lines flow out of the
 * north pole and back into the south, the way the spell says. Drag the magnet
 * around the page and the field goes with it; tap it to turn it round, and
 * the lines still leave from Bắc and return to Nam.
 */

const BAR = 150;          // magnet length, page units
const BAR_H = 34;
const LOOPS = [95, 150, 215, 295, 390, 510, 660];  // field line sizes (r = C·sin²θ)
const STEPS = 72;

// One dipole field line, r = C·sin²θ, drawn from the north side (+x) round to the south (−x)
function loop(C, side) {
    const pts = [];
    for (let i = 0; i <= STEPS; i++) {
        const t = 0.04 + (Math.PI - 0.08) * (i / STEPS);
        const r = C * Math.sin(t) ** 2;
        pts.push(`${(r * Math.cos(t)).toFixed(1)} ${(side * r * Math.sin(t)).toFixed(1)}`);
    }
    return "M" + pts.join("L");
}

export function play({ svg, draw, toPage, box, units, done, reduced }) {
    const s = svg("egg-field-svg");
    const pos = { x: (box.x + box.w / 2) * units.W, y: (box.y + box.h / 2) * units.H, turn: 0 };

    const magnet = draw(s, "g", { class: "egg-magnet" });
    const field = draw(magnet, "g", { class: "egg-field-lines" + (reduced ? "" : " is-flowing") });
    LOOPS.forEach((C) => [1, -1].forEach((side) => draw(field, "path", { d: loop(C, side) })));
    // Straight out along the axis from Bắc, and in along it to Nam
    draw(field, "path", { d: `M${BAR / 2} 0H${units.W * 1.5}` });
    draw(field, "path", { d: `M${-units.W * 1.5} 0H${-BAR / 2}` });

    const bar = draw(magnet, "g", { class: "egg-live egg-magnet-bar" });
    // Paths, not <rect>: global.css resizes rects inside inline SVG
    draw(bar, "path", { d: `M${-BAR / 2} ${-BAR_H / 2}h${BAR / 2}v${BAR_H}h${-BAR / 2}z`, class: "pole-s" });
    draw(bar, "path", { d: `M0 ${-BAR_H / 2}h${BAR / 2}v${BAR_H}h${-BAR / 2}z`, class: "pole-n" });
    const labels = [
        draw(bar, "text", { x: -BAR / 4, y: 1, class: "pole-label" }, "Nam"),
        draw(bar, "text", { x: BAR / 4, y: 1, class: "pole-label" }, "Bắc"),
    ];

    const hint = draw(s, "text", { class: "egg-hint" }, "kéo nam châm · chạm để quay");

    const place = () => {
        magnet.setAttribute("transform", `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)}) rotate(${pos.turn})`);
        // keep the pole names upright when the magnet is turned round
        labels.forEach((t) => t.setAttribute("transform", `rotate(${-pos.turn} ${t.getAttribute("x")} 0)`));
        hint.setAttribute("x", pos.x.toFixed(1));
        hint.setAttribute("y", (pos.y + BAR_H + 22).toFixed(1));
    };
    place();

    let drag = null;
    const onDown = (e) => {
        const p = toPage(e, s);
        drag = { dx: p.x - pos.x, dy: p.y - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
        bar.setPointerCapture(e.pointerId);
        magnet.classList.add("is-held");
    };
    const onMove = (e) => {
        if (!drag) return;
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
        const p = toPage(e, s);
        pos.x = Math.max(0, Math.min(units.W, p.x - drag.dx));
        pos.y = Math.max(0, Math.min(units.H, p.y - drag.dy));
        place();
    };
    const onUp = () => {
        if (!drag) return;
        if (!drag.moved) pos.turn = (pos.turn + 180) % 360; // a tap turns it round
        drag = null;
        magnet.classList.remove("is-held");
        hint.classList.add("is-gone");
        place();
        done();
    };
    bar.addEventListener("pointerdown", onDown);
    bar.addEventListener("pointermove", onMove);
    bar.addEventListener("pointerup", onUp);
    bar.addEventListener("pointercancel", onUp);
}

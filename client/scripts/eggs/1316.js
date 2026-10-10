/**
 * 1316, p. 179: the class's last roll-call. “Sĩ số: 27 / Vắng: 27 / Lý do
 * vắng: đã trưởng thành.” Everyone is absent, because everyone grew up.
 *
 * The roll is called once more, for you. Answer “Có mặt” and the absent count
 * is corrected in pen, 27 to 26, with your name written in beside it: one person
 * came back to class. (Name and class come from the comment form, if the
 * reader has used it.)
 */

const PEN = "rgb(30, 60, 160)";

export function play({ svg, draw, at, parts, box, reader, units, done, reduced }) {
    const s = svg("egg-roll-svg");
    const vang = parts.vang;
    const name = reader.name || "";
    const home = /1316/.test(reader.cls);

    const ask = document.createElement("div");
    ask.className = "egg-roll-ask";
    const who = document.createElement("span");
    who.textContent = name ? `${name}?` : "Còn ai không?";
    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "egg-live egg-roll-yes";
    yes.textContent = "Có mặt";
    ask.append(who, yes);
    at(ask, vang.x + vang.w + 0.04, vang.y - 0.006);

    yes.addEventListener("click", () => {
        ask.remove();
        const g = draw(s, "g", { class: "egg-pen" + (reduced ? "" : " is-drawing") });
        const x0 = (vang.x - 0.004) * units.W, x1 = (vang.x + vang.w + 0.004) * units.W;
        const ym = (vang.y + vang.h * 0.42) * units.H; // through the figures, not under them
        draw(g, "path", { d: `M${x0} ${ym + 3}L${x1} ${ym - 4}`, stroke: PEN, pathLength: 1, class: "egg-pen-stroke" });
        draw(g, "text", { x: x1 + 10, y: ym - 12, class: "egg-pen-fix", fill: PEN }, "26");

        // In the blank space after "Lý do vắng: đã trưởng thành", on its line
        const signed = name ? `${name}${reader.cls ? ` (${reader.cls})` : ""}` : "một bạn đọc";
        draw(g, "text", { x: (box.x + box.w + 0.03) * units.W, y: (box.y + box.h * 0.9) * units.H, class: "egg-pen-note egg-pen-left", fill: PEN },
            `Có mặt: ${signed}${home ? " · về lại lớp mình" : ""}`);
        done();
    });
}

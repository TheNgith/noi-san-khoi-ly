/**
 * 9699, p. 23: thầy Khoan's quiz. “Em hãy chọn nước nào nghèo nhất…
 * 1) Mỹ 2) Anh 3) Pháp 4) Việt Nam.”
 *
 * The question becomes yours to answer. Pick an option and thầy grades it in
 * red pen: 10 for Việt Nam, 5 for anything else, because in his class
 * “đúng hết thì được 10, sai hết thì được 5”. Nobody fails. Pick again if
 * you like; the grade follows your answer.
 */

const RED = "rgb(200, 30, 40)";

export function play({ stage, svg, draw, at, parts, units, done, reduced }) {
    const s = svg("egg-quiz-svg");
    let marks = null;

    const grade = (n) => {
        marks?.remove();
        marks = draw(s, "g", { class: "egg-pen" + (reduced ? "" : " is-drawing") });
        const o = parts[n];
        const cx = (o.x + o.w / 2) * units.W, cy = (o.y + o.h / 2) * units.H;
        draw(marks, "ellipse", {
            cx, cy, rx: (o.w / 2) * units.W + 14, ry: (o.h / 2) * units.H + 9,
            transform: `rotate(-3 ${cx} ${cy})`, pathLength: 1, stroke: RED, class: "egg-pen-stroke",
        });

        const right = n === "4";
        const y = (parts["1"].y + parts["1"].h / 2) * units.H;
        // In the empty margin left of the text column (which starts at x ≈ 333)
        draw(marks, "text", { x: 300, y: y + 16, class: "egg-pen-score", fill: RED }, right ? "10" : "5");
        draw(marks, "path", { d: `M${right ? 228 : 262} ${y + 28}q${right ? 36 : 20} 5 ${right ? 74 : 40} -3`, stroke: RED, pathLength: 1, class: "egg-pen-stroke" });
        draw(marks, "text", { x: 310, y: y + 66, class: "egg-pen-note", fill: RED },
            right ? "“đúng hết thì được 10”" : "“sai hết thì cũng được 5”");
        done();
    };

    ["1", "2", "3", "4"].forEach((n) => {
        const o = parts[n];
        const b = document.createElement("button");
        b.className = "egg-live egg-quiz-option";
        b.type = "button";
        b.setAttribute("aria-label", `Chọn đáp án ${n}`);
        Object.assign(b.style, { width: `${(o.w + 0.02) * 100}%`, height: `${(o.h + 0.012) * 100}%` });
        at(b, o.x - 0.01, o.y - 0.006);
        b.addEventListener("click", () => grade(n));
    });
    stage.classList.add("egg-quiz-open");
}

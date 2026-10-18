/**
 * Cover module
 * The opening sequence and the switch between the cover and reading stages.
 * The cover itself is a static picture (page 1 of the PDF).
 */

import { reduced } from "./dom.js";
import { state } from "./state.js";
import { closeToc } from "./toc.js";
import { hideTrace } from "./comments.js";

const OPENING_MS = 1100;

export function setStage(s) {
    if (s === state.stage) return;
    state.stage = s;
    document.body.classList.toggle("st-cover", s === "cover");
    document.body.classList.toggle("st-reading", s === "reading");
    if (s === "cover") {
        closeToc();
        hideTrace();
    }
}

// Cover rises in
export function playOpening() {
    const body = document.body;
    body.classList.remove("opening");
    void body.offsetWidth;
    if (reduced) return;
    body.classList.add("opening");
    setTimeout(() => body.classList.remove("opening"), OPENING_MS);
}

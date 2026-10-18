/**
 * Testing-phase gate: an 8-digit passcode before any page shows.
 * There are no accounts. The passcode is never in this code: Firestore holds
 * a document `passcodes/<code>`, and the gate asks for the one named by the
 * typed digits. firestore.rules lets anyone fetch a passcode by its exact id
 * but never list them, and keeps comments under that document, so the
 * passcode is also the key to reading and writing them.
 *
 * The visitor's own browser remembers the code it got in with, and checks it
 * with the database again on every visit.
 *
 * Every page imports this; `unlocked` resolves to the passcode once in.
 */

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js";
import { db, configured } from "./firebase.js";

const DIGITS = 8;
const KEY = "l9622.passcode";

const remembered = {
    get() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
    clear() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } },
};

// Asks the database; throws if it can't be reached
async function isPasscode(code) {
    if (!new RegExp(`^\\d{${DIGITS}}$`).test(code)) return false;
    return (await getDoc(doc(db, "passcodes", code))).exists();
}

function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
}

// One real input (paste, backspace and phone keyboards just work) laid over
// eight boxes that only display its digits
function showGate(note = "") {
    return new Promise((resolve) => {
        const gate = el("div", "gate");
        gate.setAttribute("role", "dialog");
        gate.setAttribute("aria-labelledby", "gate-title");

        const logo = el("img", "gate-logo");
        logo.src = "assets/icons/logo.svg";
        logo.alt = "L9622, nội san khối Lý";

        const title = el("h1", "gate-title", "Nhập mã truy cập");
        title.id = "gate-title";
        const lead = el("p", "gate-lead", "L9622 đang trong giai đoạn thử nghiệm. Nhập mã 8 số để đọc.");

        const field = el("label", "gate-field");
        const input = el("input", "gate-input");
        Object.assign(input, {
            type: "text", inputMode: "numeric", autocomplete: "one-time-code",
            maxLength: DIGITS, spellcheck: false,
        });
        input.setAttribute("aria-label", "Mã truy cập, 8 số");
        const boxes = Array.from({ length: DIGITS }, () => {
            const box = el("span", "gate-box");
            box.append(el("span", "gate-digit"), el("span", "glow default gate-glow"));
            return box;
        });
        field.append(input, ...boxes);

        const msg = el("p", "gate-msg");
        msg.setAttribute("role", "status");

        gate.append(logo, title, lead, field, msg);
        document.body.append(gate);

        const say = (text, warn = false) => {
            msg.textContent = text;
            msg.classList.toggle("warn", warn);
        };

        const paint = () => {
            const v = input.value;
            boxes.forEach((box, i) => {
                box.firstChild.textContent = v[i] || "";
                box.classList.toggle("filled", i < v.length);
                box.classList.toggle("caret", i === Math.min(v.length, DIGITS - 1) && document.activeElement === input);
            });
        };

        const reject = (text) => {
            say(text, true);
            gate.classList.remove("shake");
            void gate.offsetWidth; // restart the animation
            gate.classList.add("shake");
            input.value = "";
            input.disabled = false;
            paint();
            input.focus();
        };

        async function tryCode(code) {
            input.disabled = true;
            gate.classList.add("busy");
            say("Đang kiểm tra…");
            try {
                if (await isPasscode(code)) {
                    remembered.set(code);
                    gate.classList.add("out");
                    document.body.classList.add("unlocked");
                    setTimeout(() => gate.remove(), 400);
                    resolve(code);
                } else {
                    reject("Mã chưa đúng. Bạn thử lại nhé.");
                }
            } catch (err) {
                console.error(err);
                reject("Không kiểm tra được mã. Kiểm tra mạng rồi thử lại.");
            } finally {
                gate.classList.remove("busy");
            }
        }

        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "").slice(0, DIGITS);
            if (msg.classList.contains("warn")) say("");
            paint();
            if (input.value.length === DIGITS) tryCode(input.value);
        });
        input.addEventListener("focus", paint);
        input.addEventListener("blur", paint);

        if (!configured) {
            input.disabled = true;
            say("Trang chưa được nối với Firebase (scripts/firebase.js).", true);
        } else if (note) {
            say(note, true);
        }
        paint();
        input.focus();
    });
}

async function enter() {
    const saved = remembered.get();
    if (saved && configured) {
        try {
            if (await isPasscode(saved)) {
                document.body.classList.add("unlocked");
                return saved;
            }
            remembered.clear(); // the passcode was changed
        } catch (err) {
            console.error(err);
            return showGate("Không kiểm tra được mã. Kiểm tra mạng rồi thử lại.");
        }
    }
    return showGate();
}

export const unlocked = enter();

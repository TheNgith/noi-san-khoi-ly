/**
 * Small DOM and environment helpers shared by every module
 */

export const $ = (s, r = document) => r.querySelector(s);

export function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
}

// localStorage can be missing or blocked; the reader works without it
export const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

// Phones, upright or on their side: one column, dots, a bottom sheet.
// The CSS media queries for phones use the same condition.
export const mqMobile = matchMedia("(max-width: 760px), (pointer: coarse) and (max-height: 500px)");
export const isMobile = () => mqMobile.matches;
// A touch screen with no hover (phones, tablets): no key hints, Enter starts a new line
export const isTouch = () => matchMedia("(hover: none) and (pointer: coarse)").matches;
export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const smooth = reduced ? "auto" : "smooth";

let toastTimer = null;
export function showToast(text, ms = 2400) {
    const toast = $("#toast");
    toast.textContent = text;
    toast.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("on"), ms);
}

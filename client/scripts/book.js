/**
 * Book manifest: chapter colours, contents order and the pages.
 *
 * The pages come from pages.gen.js, generated from the book PDF by
 * tools/pages/build.mjs. `n` is the printed page number. It decides
 * dual-page pairing (even = left, odd = right, as printed) and the
 * #trang-N links. A page's `id` ("p023") is its comment imageId.
 */

import { BOOK_SECTIONS, BOOK_PAGES, PAGE_W, PAGE_H } from "./pages.gen.js";

// Colours match colors.css (k9699 … k1922)
export const CHAPTERS = [
    ["9699", "237,39,146"], ["9700", "237,22,116"], ["9801", "237,19,91"], ["9902", "237,26,65"],
    ["0003", "237,36,38"], ["0104", "243,105,37"], ["0205", "248,151,40"], ["0306", "254,194,18"],
    ["0407", "255,242,0"], ["0508", "204,221,47"], ["0609", "150,201,78"], ["0710", "56,180,73"],
    ["0811", "0,166,80"], ["0912", "0,171,125"], ["1013", "0,165,157"], ["1114", "0,172,197"],
    ["1215", "0,173,239"], ["1316", "0,143,213"], ["1417", "0,113,188"], ["1518", "0,87,168"],
    ["1619", "63,63,153"], ["1720", "103,46,146"], ["1821", "147,42,144"], ["1922", "189,36,143"],
];

// The 23 stripes printed on the cover, bottom to top: 9699 … 1821
export const COVER_CLASSES = CHAPTERS.slice(0, 23).map((c) => c[0]);

export const SECTIONS = [
    ["Thầy Phúc", "188,79,23"], ["Thầy Ngọc", "0,101,83"], ["Cô Quỳnh Anh", "87,57,98"],
    ["Thầy Hoàng", "91,116,134"], ["Đội tuyển Lý", "0,65,95"], ["Trung Thu", "254,195,17"],
];

// Front matter and Lời kết have no colour of their own
const NEUTRAL = "120,120,120";
const sectionRgb = Object.fromEntries(SECTIONS);
export const rgbOf = Object.fromEntries(CHAPTERS);

/**
 * The book in reading order: one block per section of the PDF (front
 * matter, the 24 classes, the teacher/team sections, Lời kết).
 * `name` is how a page is labelled in the reader ("L9699", "Thầy Phúc").
 */
export const BLOCKS = BOOK_SECTIONS.map(({ key, label, kind }) => ({
    key, label, kind,
    name: kind === "class" ? "L" + key : label,
    rgb: (kind === "class" ? rgbOf[key] : sectionRgb[label]) ?? NEUTRAL,
    pages: BOOK_PAGES.filter((p) => p.sec === key).map(({ id, n, src }) => ({ id, n, src, w: PAGE_W, h: PAGE_H })),
}));

export const PAGE_RATIO = PAGE_W / PAGE_H;

// Pages by section key, e.g. PAGES["9699"]
export const PAGES = Object.fromEntries(BLOCKS.map((b) => [b.key, b.pages]));

// "9699" → "1996–1999"
export function years(code) {
    const a = +code.slice(0, 2);
    const y = a >= 90 ? 1900 + a : 2000 + a;
    return `${y}–${y + 3}`;
}

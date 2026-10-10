/**
 * Book manifest: chapter colours, contents order and the scanned pages.
 *
 * `n` is the printed page number from each page's footer. It decides
 * dual-page pairing (even = left, odd = right, as printed) and the
 * #trang-N links. A page's `src` is also its comment imageId.
 */

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

const SCAN = [1748, 2480];
const page = (src, n, [w, h] = SCAN) => ({ src: `assets/images/chapters/${src}`, n, w, h });
const pair = (code, first) => [page(`${code}/${code}.jpg`, first), page(`${code}/${code}2.jpg`, first + 1)];

export const PAGES = {
    "9699": [1, 2, 3, 4, 5, 6, 7, 8].map((i) => page(`9699/${i}.png`, 7 + i, [720, 1024])),
    "9700": pair("9700", 18),
    "9801": pair("9801", 24),
    "9902": pair("9902", 30),
    "0003": pair("0003", 38),
    "0104": pair("0104", 50),
    "0205": pair("0205", 52),
    "0306": pair("0306", 54),
    "0407": pair("0407", 68),
    "0508": pair("0508", 78),
    "0609": pair("0609", 88),
    "0710": pair("0710", 100),
};

export const rgbOf = Object.fromEntries(CHAPTERS);

// "9699" → "1996–1999"
export function years(code) {
    const a = +code.slice(0, 2);
    const y = a >= 90 ? 1900 + a : 2000 + a;
    return `${y}–${y + 3}`;
}

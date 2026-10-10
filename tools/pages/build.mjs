/**
 * Builds the site's pages from the book PDF.
 *
 *   cd tools && npm run pages                 every page in sections.json
 *   cd tools && npm run pages -- --only 23,101  just these pages
 *   ... -- --pdf path/to/book.pdf             another PDF (default: repo root)
 *
 * For each printed page n it writes:
 *   client/assets/pages/NNN.svg   the page, vector (pdftocairo + svgo)
 *   tools/pages/text/NNN.json     its words with boxes (build cache, not shipped)
 * and then client/scripts/pages.gen.js, the page list both readers import.
 *
 * Needs poppler (pdftocairo, pdftotext): brew install poppler
 */

import { execFile as execFileCb } from "node:child_process";
import { mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { optimize } from "svgo";

const execFile = promisify(execFileCb);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT_SVG = path.join(ROOT, "client/assets/pages");
const OUT_TEXT = path.join(HERE, "text");
const OUT_MANIFEST = path.join(ROOT, "client/scripts/pages.gen.js");

// Page size of the PDF in points (A5, no bleed)
const PAGE_W = 419.528;
const PAGE_H = 595.276;

const args = process.argv.slice(2);
const argValue = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
};
const PDF = path.resolve(ROOT, argValue("--pdf") ?? "all4t10don.pdf");
const ONLY = argValue("--only")?.split(",").map(Number);

const pad = (n) => String(n).padStart(3, "0");

/* ---------- Gradients ---------- */

// cairo samples every PDF shading into 256 gradient stops. Most lie on a
// straight colour ramp, so keep only the stops that change the result by
// more than one colour level (1/255). This shrinks the glow-heavy pages
// (contents, cover-like openers) by roughly ten times.
const TOLERANCE = 1 / 255;

function parseStop(tag) {
    const offset = tag.match(/offset="([\d.e-]+)"/);
    const color = tag.match(/stop-color="rgb\(([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)%\)"/);
    const opacity = tag.match(/stop-opacity="([\d.e-]+)"/);
    if (!offset || !color) return null;
    return {
        tag,
        t: Number(offset[1]),
        v: [color[1], color[2], color[3]].map((c) => Number(c) / 100).concat(opacity ? Number(opacity[1]) : 1),
    };
}

function thinStops(stops) {
    const keep = [stops[0]];
    let a = 0;
    while (a < stops.length - 1) {
        // Extend b as far as every stop between a and b stays on the line a→b
        let b = a + 1;
        for (let next = a + 2; next < stops.length; next++) {
            const s = stops[a];
            const e = stops[next];
            const ok = stops.slice(a + 1, next).every((m) => {
                const k = e.t === s.t ? 0 : (m.t - s.t) / (e.t - s.t);
                return m.v.every((v, i) => Math.abs(s.v[i] + (e.v[i] - s.v[i]) * k - v) <= TOLERANCE);
            });
            if (!ok) break;
            b = next;
        }
        keep.push(stops[b]);
        a = b;
    }
    return keep;
}

function thinGradients(svg) {
    return svg.replace(/(<(linear|radial)Gradient\b[^>]*>)([\s\S]*?)(<\/\2Gradient>)/g, (all, open, _kind, body, close) => {
        const tags = body.match(/<stop\b[^>]*\/>/g) ?? [];
        const stops = tags.map(parseStop);
        if (stops.length < 3 || stops.some((s) => !s)) return all;
        return open + thinStops(stops).map((s) => s.tag).join("") + close;
    });
}

/* ---------- Text ---------- */

const unescape = (s) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

// pdftotext -bbox-layout → lines of [text, x0, y0, x1, y1] in points
function parseWords(xhtml) {
    const lines = [];
    for (const line of xhtml.match(/<line\b[\s\S]*?<\/line>/g) ?? []) {
        const words = [];
        for (const m of line.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/g)) {
            words.push([unescape(m[5]), ...m.slice(1, 5).map((v) => Math.round(Number(v) * 100) / 100)]);
        }
        if (words.length) lines.push(words);
    }
    return lines;
}

// The printed folio: the page number standing alone in the bottom 8%
function folioOf(lines) {
    for (const line of lines) {
        for (const [text, , y0] of line) {
            if (/^\d{1,3}$/.test(text) && y0 > PAGE_H * 0.92) return Number(text);
        }
    }
    return null;
}

/* ---------- One page ---------- */

const SVGO = {
    multipass: true,
    plugins: [{ name: "preset-default" }],
};

async function buildPage(n, tmp) {
    const raw = path.join(tmp, `${pad(n)}.svg`);
    await execFile("pdftocairo", ["-svg", "-f", n, "-l", n, PDF, raw]);
    const cairo = await readFile(raw, "utf8");
    // The PDF's paper is implicit; give the page a white sheet so it doesn't
    // take the reader's background colour
    const paper = thinGradients(cairo).replace(/(<svg\b[^>]*>)/, `$1<rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/>`);
    const svg = optimize(paper, SVGO).data;
    await writeFile(path.join(OUT_SVG, `${pad(n)}.svg`), svg);

    const { stdout } = await execFile("pdftotext", ["-bbox-layout", "-f", n, "-l", n, PDF, "-"], {
        maxBuffer: 64 << 20,
    });
    const lines = parseWords(stdout);
    await writeFile(path.join(OUT_TEXT, `${pad(n)}.json`), JSON.stringify({ n, w: PAGE_W, h: PAGE_H, lines }));

    return { n, raw: cairo.length, size: Buffer.byteLength(svg), folio: folioOf(lines) };
}

/* ---------- Manifest ---------- */

function manifest(sections) {
    const secs = sections.map(({ key, label, kind }) => ({ key, label, kind }));
    const pages = sections.flatMap((s) =>
        Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i).map((n) => `    [${n}, ${JSON.stringify(s.key)}],`)
    );
    return `/**
 * GENERATED by tools/pages/build.mjs from all4t10don.pdf. Don't edit by hand:
 * change tools/pages/sections.json and rebuild.
 *
 * Every page the site shows, in book order. \`n\` is the printed page number;
 * the page's id ("p023") is the key comments are stored under.
 */

export const PAGE_W = ${PAGE_W};
export const PAGE_H = ${PAGE_H};

// kind: "front" | "class" | "section" | "back"
export const BOOK_SECTIONS = ${JSON.stringify(secs, null, 4)};

const PAGE_LIST = [
${pages.join("\n")}
];

export const pageId = (n) => \`p\${String(n).padStart(3, "0")}\`;
export const pageSrc = (n) => \`assets/pages/\${String(n).padStart(3, "0")}.svg\`;

export const BOOK_PAGES = PAGE_LIST.map(([n, sec]) => ({ id: pageId(n), n, sec, src: pageSrc(n) }));
`;
}

/* ---------- Main ---------- */

async function pool(items, size, fn) {
    const results = [];
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: size }, worker));
    return results;
}

async function main() {
    await stat(PDF).catch(() => {
        throw new Error(`PDF not found: ${PDF}`);
    });
    const { sections } = JSON.parse(await readFile(path.join(HERE, "sections.json"), "utf8"));
    const all = sections.flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i));
    const todo = ONLY ? all.filter((n) => ONLY.includes(n)) : all;

    await mkdir(OUT_SVG, { recursive: true });
    await mkdir(OUT_TEXT, { recursive: true });
    const tmp = path.join(tmpdir(), `l9622-pages-${process.pid}`);
    await mkdir(tmp, { recursive: true });

    let done = 0;
    const results = await pool(todo, 8, async (n) => {
        const r = await buildPage(n, tmp);
        if (++done % 25 === 0) console.log(`  ${done}/${todo.length}`);
        return r;
    });
    await rm(tmp, { recursive: true, force: true });
    await writeFile(OUT_MANIFEST, manifest(sections));

    const total = results.reduce((s, r) => s + r.size, 0);
    const kb = (b) => `${Math.round(b / 1024)} KB`;
    console.log(`\n${results.length} pages, ${kb(total)} (${kb(total / results.length)} average)`);
    console.log("Largest:", [...results].sort((a, b) => b.size - a.size).slice(0, 6).map((r) => `p${r.n} ${kb(r.size)}`).join(", "));
    const bad = results.filter((r) => r.folio !== null && r.folio !== r.n);
    if (bad.length) console.warn("Printed folio differs from page index:", bad.map((r) => `${r.n}→${r.folio}`).join(", "));
    console.log(`No folio found on ${results.filter((r) => r.folio === null).length} pages (photo or opener pages)`);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});

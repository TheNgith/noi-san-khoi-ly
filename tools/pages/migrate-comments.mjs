/**
 * Moves comments from the old page images to the PDF pages.
 *
 *   node pages/migrate-comments.mjs [file]           dry run: show what would change
 *   node pages/migrate-comments.mjs [file] --write   rewrite the file
 *
 * `file` defaults to server/data/comments.json. Each comment's imageId
 * (an old image path) becomes the page id ("p023") from legacy-map.json;
 * comments listed under "comments" in the map also get a hand-placed yPct.
 * Comments already on a page id are left alone, so it's safe to run twice.
 * Comments it can't map are reported and kept unchanged, never dropped.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const FILE = path.resolve(args.find((a) => !a.startsWith("--")) ?? path.join(ROOT, "server/data/comments.json"));

const pageId = (n) => `p${String(n).padStart(3, "0")}`;

const map = JSON.parse(await readFile(path.join(HERE, "legacy-map.json"), "utf8"));
const comments = JSON.parse(await readFile(FILE, "utf8"));

let moved = 0;
const unmapped = [];
for (const c of comments) {
    if (/^p\d{3}$/.test(c.imageId)) continue;
    const hand = map.comments[c.id];
    const n = hand?.page ?? map.pages[c.imageId];
    if (!n) {
        unmapped.push(c);
        continue;
    }
    console.log(`${c.id}  ${c.imageId} → ${pageId(n)}${hand ? `  (yPct ${c.yPct.toFixed(3)} → ${hand.yPct})` : ""}`);
    c.imageId = pageId(n);
    if (hand) c.yPct = hand.yPct;
    moved++;
}

console.log(`\n${moved} of ${comments.length} comments moved.`);
if (unmapped.length) console.warn(`Not mapped (kept as they are): ${unmapped.map((c) => `${c.id} ${c.imageId}`).join(", ")}`);
if (WRITE) {
    await writeFile(FILE, JSON.stringify(comments, null, 2));
    console.log(`Wrote ${path.relative(ROOT, FILE)}`);
} else {
    console.log("Dry run. Add --write to save.");
}

/**
 * Page building module
 * Builds the chapter blocks and the sidebar links from the generated page
 * list (pages.gen.js), so the book's pages live in data, not in index.html.
 */

import { BOOK_SECTIONS, BOOK_PAGES, PAGE_W, PAGE_H } from "./pages.gen.js";

// Colour class per section (see colors.css); classes use k<code>
const SECTION_COLOR = {
    "thay-phuc": "thayphuc",
    "thay-ngoc": "thayngoc",
    "co-quynh-anh": "coquynhanh",
    "thay-hoang": "thayhoang",
    "doi-tuyen-ly": "doituyenly",
    "trung-thu": "trungthu",
};

function colorOf(section) {
    if (section.kind === "class") return `k${section.key}`;
    return SECTION_COLOR[section.key] ?? "default";
}

function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}

function buildPage(page, eager) {
    const wrapper = el("div", "page-wrapper");
    const container = el("div", "page-container");
    const img = el("img", "page");
    img.src = page.src;
    img.width = PAGE_W;
    img.height = PAGE_H;
    img.alt = `Trang ${page.n}`;
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    img.dataset.pageId = page.id;
    container.append(img, el("div", "comment-overlay"));
    wrapper.append(container, el("div", "comment-panel"));
    return wrapper;
}

function buildSidebarLink(section) {
    const link = el("a", "link_container");
    link.href = `#chapter-${section.key}`;
    const title = el("div", "link_title");
    title.textContent = section.label;
    link.append(title, el("div", `link_underline ${colorOf(section)}`));
    return link;
}

export function buildPages() {
    const container = document.querySelector(".pages_container");
    const sidebarList = document.querySelector(".sidebar ul");

    BOOK_SECTIONS.forEach((section, i) => {
        const block = el("div", `comment-block ${colorOf(section)}_container`);
        block.id = `chapter-${section.key}`;
        block.dataset.chapter = colorOf(section);
        const column = el("div", "pages-column");
        BOOK_PAGES.filter((p) => p.sec === section.key).forEach((page, j) => {
            column.append(buildPage(page, i === 0 && j < 2));
        });
        block.append(column);
        container.append(block);

        sidebarList?.append(buildSidebarLink(section));
    });
}

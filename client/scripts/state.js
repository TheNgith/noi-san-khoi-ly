/**
 * Shared reader state
 * One plain object every module reads and writes, plus the page list
 * and the comments loaded from the server.
 */

export const state = {
    stage: null,          // "cover" | "reading"
    dual: false,          // dual-page spreads
    zoom: 1,              // page width relative to fit-height
    pageW: 480,           // current page width in px
    fitH: 480,            // page width that fits the window height
    maxW: 900,            // widest page the layout allows
    open: null,           // { g } — the open comment cluster
    composer: null,       // { p, x, y, f } — the open comment form
    commentsOn: true,
    current: null,        // page under the reading line
    hash: null,           // last hash written
    guardUntil: 0,        // ignore document clicks until (long-press release)
    stageLockUntil: 0,    // ignore cover/reading switches until (deep links)
};

export const pages = [];      // every page in reading order
export const pageById = {};   // page src → page
export const comments = [];   // normalised comments (see api.js)

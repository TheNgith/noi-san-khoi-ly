/**
 * Bubble creation and animation module
 * Handles comment bubble DOM creation, state transitions, and y-slice grouping
 */

const CLOSE_FADE_MS = 170; // must match CSS fade duration

// Bubble size is 30px (defined in CSS). Slice height should be at least 2x the bubble size.
// It will dynamically adjust based on zoom level.
const BASE_BUBBLE_SIZE = 30;

// ─────────────────────────────────────
// Open / Close helpers
// ─────────────────────────────────────

export function openBubble(bubble) {
    // Close any other open bubbles across ALL pages
    document.querySelectorAll(".comment-bubble.open").forEach((b) => {
        if (b !== bubble) {
            closeBubble(b);
        }
    });

    bubble.classList.remove("closing");
    bubble.classList.add("open");

    const panel = bubble.closest(".comment-panel");
    if (panel) panel.classList.add("has-active-bubble");

    const wrapper = bubble.closest(".page-wrapper");
    if (wrapper) wrapper.classList.add("has-active-bubble");

    // Global flag: hide bubbles on all other pages
    document.body.classList.add("has-active-bubble");
}

export function closeBubble(bubble) {
    // If already closing, ignore extra clicks
    if (bubble.classList.contains("closing")) return;

    bubble.classList.add("closing");

    // prevent double click during fade-out
    bubble.style.pointerEvents = "none";

    const wrapper = bubble.closest(".page-wrapper");

    setTimeout(() => {
        bubble.classList.remove("open", "closing");
        bubble.style.pointerEvents = "";

        const panel = bubble.closest(".comment-panel");
        if (panel && !panel.querySelector(".comment-bubble.open")) {
            panel.classList.remove("has-active-bubble");
        }

        if (wrapper && !wrapper.querySelector(".comment-bubble.open")) {
            wrapper.classList.remove("has-active-bubble");
        }

        // Clear global flag only if no bubble is open anywhere
        if (!document.querySelector(".comment-bubble.open")) {
            document.body.classList.remove("has-active-bubble");
        }
    }, CLOSE_FADE_MS);
}

// ─────────────────────────────────────
// Elapsed time helper
// ─────────────────────────────────────

function formatElapsedTime(createdAtValue) {
    if (!createdAtValue) return "";

    const created = new Date(createdAtValue);
    if (isNaN(created.getTime())) return "";

    const now = new Date();
    const diffMs = Math.max(0, now - created);

    const hours = Math.floor(diffMs / (1000 * 60 * 60));

    if (hours < 24) return `${hours} giờ trước`;

    const dd = String(created.getDate()).padStart(2, "0");
    const mm = String(created.getMonth() + 1).padStart(2, "0");
    const yyyy = created.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

// ─────────────────────────────────────
// Slice computation (dynamic)
// ─────────────────────────────────────

/**
 * Compute how many slices a panel should have, based on its pixel height.
 * Each slice must be at least twice the height of the comment bubble.
 * The bubble resizes based on the zoom level.
 */
export function computeSliceCount(panelHeightPx) {
    const pagesContainer = document.querySelector(".pages_container");
    const zoomLevel = pagesContainer ? parseFloat(pagesContainer.style.getPropertyValue("--zoom-level")) || 1 : 1;
    const minSlicePx = 2 * (BASE_BUBBLE_SIZE * zoomLevel);

    if (!panelHeightPx || panelHeightPx <= 0) return 10; // fallback
    return Math.max(1, Math.floor(panelHeightPx / minSlicePx));
}

/**
 * Determine which slice index a comment belongs to.
 */
function sliceIndexFor(yPct, sliceCount) {
    const idx = Math.floor(yPct * sliceCount);
    return Math.min(idx, sliceCount - 1); // clamp to last slice
}

/**
 * Group an array of comments into slices.
 * Returns Map<sliceIndex, comment[]>.
 */
export function groupCommentsBySlice(comments, sliceCount) {
    const groups = new Map();
    for (const c of comments) {
        const idx = sliceIndexFor(c.yPct, sliceCount);
        if (!groups.has(idx)) groups.set(idx, []);
        groups.get(idx).push(c);
    }
    return groups;
}

// ─────────────────────────────────────
// Single-comment item (reused inside groups)
// ─────────────────────────────────────

function createCommentItem(comment) {
    const { text, createdAt } = comment;
    const author = (comment.author || comment.name || "Anonymous").trim();
    const chapter = comment.chapter || "default";

    const item = document.createElement("div");
    item.className = "comment-group-item";

    const meta = document.createElement("div");
    meta.className = "comment-meta";

    const authorDiv = document.createElement("div");
    authorDiv.className = "comment-author";
    authorDiv.textContent = author;

    const authorUnderline = document.createElement("div");
    authorUnderline.className = `author-underline ${chapter}`;

    const elapsedDiv = document.createElement("div");
    elapsedDiv.className = "comment-elapsed-time";
    elapsedDiv.textContent = formatElapsedTime(createdAt);

    const textSpan = document.createElement("div");
    textSpan.className = "comment-text";
    textSpan.textContent = text || "";

    meta.appendChild(authorDiv);
    meta.appendChild(authorUnderline);

    item.appendChild(meta);
    item.appendChild(textSpan);
    item.appendChild(elapsedDiv);

    return item;
}

// ─────────────────────────────────────
// Group-bubble element
// ─────────────────────────────────────

/**
 * Create a single bubble representing one y-slice.
 *  - Positioned at the vertical centre of the slice.
 *  - Shows a count badge when the group has > 1 comment.
 *  - Expands into a stacked thread on click.
 */
export function createGroupBubbleElement(sliceIndex, comments, sliceCount) {
    if (!comments.length) return null;

    const chapter = comments[0].chapter || "default";
    const centerPct = ((sliceIndex + 0.5) / sliceCount) * 100;

    const bubble = document.createElement("div");
    bubble.className = "comment-bubble";
    if (comments.length > 1) bubble.classList.add("bubble-stacked");
    bubble.style.top = `${centerPct}%`;
    bubble.dataset.sliceIndex = sliceIndex;

    // Underline decoration (same as original)
    const underline = document.createElement("div");
    underline.className = `bubble-underline ${chapter}`;
    bubble.appendChild(underline);

    // Count text inside the bubble (visible only when stacked)
    const badge = document.createElement("span");
    badge.className = "bubble-count";
    badge.textContent = comments.length;
    bubble.appendChild(badge);

    // Stacked comment list (revealed on open)
    const list = document.createElement("div");
    list.className = "comment-group-list";
    for (const c of comments) {
        list.appendChild(createCommentItem(c));
    }
    bubble.appendChild(list);

    // Click handler – toggle open/close
    bubble.addEventListener("click", (e) => {
        e.stopPropagation();

        // Toggle this one
        if (bubble.classList.contains("open")) {
            closeBubble(bubble);
        } else {
            openBubble(bubble);
        }
    });

    return bubble;
}

// ─────────────────────────────────────
// Render all grouped bubbles for a page
// ─────────────────────────────────────

/**
 * Replace the old per-comment rendering.
 * Groups comments by y-slice, creates one bubble per slice,
 * and animates them in with staggered delays.
 *
 * Also stores the raw comments on the panel element so we can
 * re-render when zoom changes.
 */
export function addGroupedBubblesAnimated(pageState, comments, baseDelay = 150) {
    const { commentPanel } = pageState;
    const panelHeight = commentPanel.offsetHeight || commentPanel.clientHeight;
    const sliceCount = computeSliceCount(panelHeight);

    // Persist comments for later re-render
    if (!commentPanel._comments) {
        commentPanel._comments = [];
    }
    commentPanel._comments = comments.slice();

    const groups = groupCommentsBySlice(comments, sliceCount);

    // Sort groups by slice index for top-to-bottom animation
    const sortedSlices = [...groups.keys()].sort((a, b) => a - b);

    sortedSlices.forEach((sliceIdx, order) => {
        const sliceComments = groups.get(sliceIdx);
        const bubble = createGroupBubbleElement(sliceIdx, sliceComments, sliceCount);
        if (!bubble) return;

        // start hidden / small
        bubble.classList.add("bubble-enter");
        commentPanel.appendChild(bubble);

        const delay = baseDelay + order * 90;
        setTimeout(() => {
            requestAnimationFrame(() => {
                bubble.classList.add("bubble-enter-active");
            });
        }, delay);
    });
}

// ─────────────────────────────────────
// Re-render (zoom-aware regrouping)
// ─────────────────────────────────────

/**
 * Clear all existing bubbles from a panel and re-render them
 * using the current panel height for slice computation.
 * Called after zoom or resize changes.
 */
export function rerenderBubbles(pageState) {
    const { commentPanel } = pageState;
    const comments = commentPanel._comments;
    if (!comments || !comments.length) return;

    // ── Capture open state before destroying bubbles ──
    let openCommentKey = null;
    const currentlyOpen = commentPanel.querySelector(".comment-bubble.open");
    if (currentlyOpen) {
        const openSliceIdx = parseInt(currentlyOpen.dataset.sliceIndex, 10);
        // Use current (old) grouping to find which comments were in that slice
        const oldPanelHeight = commentPanel.offsetHeight || commentPanel.clientHeight;
        const oldSliceCount = computeSliceCount(oldPanelHeight);
        const oldGroups = groupCommentsBySlice(comments, oldSliceCount);
        const openComments = oldGroups.get(openSliceIdx);
        if (openComments && openComments.length) {
            const c = openComments[0];
            openCommentKey = `${c.xPct}-${c.yPct}`;
        }
    }

    // Remove all existing bubbles
    commentPanel.querySelectorAll(".comment-bubble").forEach((b) => b.remove());

    // Re-render with no animation delay (instant regroup)
    const panelHeight = commentPanel.offsetHeight || commentPanel.clientHeight;
    const sliceCount = computeSliceCount(panelHeight);
    const groups = groupCommentsBySlice(comments, sliceCount);

    // Find which new slice the previously-open comment landed in
    let newOpenSliceIdx = null;
    if (openCommentKey) {
        for (const [sliceIdx, sliceComments] of groups) {
            for (const c of sliceComments) {
                if (`${c.xPct}-${c.yPct}` === openCommentKey) {
                    newOpenSliceIdx = sliceIdx;
                    break;
                }
            }
            if (newOpenSliceIdx !== null) break;
        }
    }

    const sortedSlices = [...groups.keys()].sort((a, b) => a - b);
    sortedSlices.forEach((sliceIdx) => {
        const sliceComments = groups.get(sliceIdx);
        const bubble = createGroupBubbleElement(sliceIdx, sliceComments, sliceCount);
        if (!bubble) return;

        // Show immediately (no entrance animation)
        bubble.classList.add("bubble-enter", "bubble-enter-active");
        commentPanel.appendChild(bubble);

        // Restore open state if this slice contains the previously-open comment
        if (sliceIdx === newOpenSliceIdx) {
            openBubble(bubble);
        }
    });
}

// ─────────────────────────────────────
// Add a single new comment (live insertion)
// ─────────────────────────────────────

/**
 * Insert a newly-created comment into the panel.
 * If a group bubble for that slice already exists, append the comment
 * and update the badge. Otherwise create a new group of 1.
 */
export function addBubbleAnimated(pageState, comment, delayMs = 0) {
    const { commentPanel } = pageState;

    // Track this comment for future re-renders
    if (!commentPanel._comments) commentPanel._comments = [];
    commentPanel._comments.push(comment);

    const panelHeight = commentPanel.offsetHeight || commentPanel.clientHeight;
    const sliceCount = computeSliceCount(panelHeight);
    const sliceIdx = sliceIndexFor(comment.yPct, sliceCount);

    // Look for an existing group bubble in the same slice
    const existing = commentPanel.querySelector(
        `.comment-bubble[data-slice-index="${sliceIdx}"]`
    );

    if (existing) {
        // Append comment item to the list
        const list = existing.querySelector(".comment-group-list");
        if (list) {
            list.appendChild(createCommentItem(comment));
        }

        // Update badge and stacked class
        const count = existing.querySelectorAll(".comment-group-item").length;
        const badge = existing.querySelector(".bubble-count");
        if (badge) {
            badge.textContent = count;
        }
        if (count > 1) {
            existing.classList.add("bubble-stacked");
        }
        return;
    }

    // No existing group → create a brand new one
    const bubble = createGroupBubbleElement(sliceIdx, [comment], sliceCount);
    if (!bubble) return;

    bubble.classList.add("bubble-enter");
    commentPanel.appendChild(bubble);

    setTimeout(() => {
        requestAnimationFrame(() => {
            bubble.classList.add("bubble-enter-active");
        });
    }, delayMs);
}

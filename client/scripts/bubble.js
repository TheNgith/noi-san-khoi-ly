/**
 * Bubble creation and animation module
 * Handles comment bubble DOM creation and state transitions
 */

const CLOSE_FADE_MS = 170; // must match CSS fade duration

export function openBubble(bubble) {
    bubble.classList.remove("closing");
    bubble.classList.add("open");

    // Add has-open-comment class to the page-wrapper
    const pageWrapper = bubble.closest(".page-wrapper");
    if (pageWrapper) {
        pageWrapper.classList.add("has-open-comment");
    }
}

export function closeBubble(bubble) {
    // If already closing, ignore extra clicks
    if (bubble.classList.contains("closing")) return;

    bubble.classList.add("closing");

    // prevent double click during fade-out (optional but helps)
    bubble.style.pointerEvents = "none";

    setTimeout(() => {
        bubble.classList.remove("open", "closing");
        bubble.style.pointerEvents = "";

        // Check if any other bubbles are still open in this panel
        const panel = bubble.closest(".comment-panel");
        const pageWrapper = bubble.closest(".page-wrapper");
        if (panel && pageWrapper) {
            const hasOtherOpenBubbles = panel.querySelector(".comment-bubble.open") !== null;
            if (!hasOtherOpenBubbles) {
                pageWrapper.classList.remove("has-open-comment");
            }
        }
    }, CLOSE_FADE_MS);
}

export function createBubbleElement(comment) {
    const { yPct, text, createdAt } = comment;
    if (typeof yPct !== "number") return null;
    const author = (comment.author || comment.name || "Anonymous").trim();
    const chapter = comment.chapter || "default";

    // --- elapsed time helper ---
    const formatElapsedTime = (createdAtValue) => {
        if (!createdAtValue) return "";

        const created = new Date(createdAtValue);
        if (isNaN(created.getTime())) return "";

        const now = new Date();
        const diffMs = Math.max(0, now - created);

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (days >= 1) return `${days} ngay truoc`;
        return `${hours} gio truoc`;
    };

    const bubble = document.createElement("div");
    bubble.className = "comment-bubble";
    bubble.style.top = `${yPct * 100}%`;

    const underline = document.createElement("div");
    underline.className = `bubble-underline ${chapter}`;

    const meta = document.createElement("div");
    meta.className = "comment-meta";

    const authorDiv = document.createElement("div");
    authorDiv.className = "comment-author";
    authorDiv.textContent = author;

    const authorUnderline = document.createElement("div");
    authorUnderline.className = `author-underline ${chapter}`;

    // NEW: elapsed time element
    const elapsedDiv = document.createElement("div");
    elapsedDiv.className = "comment-elapsed-time";
    elapsedDiv.textContent = formatElapsedTime(createdAt);

    const textSpan = document.createElement("div");
    textSpan.className = "comment-text";
    textSpan.textContent = text || "";

    meta.appendChild(authorDiv);
    meta.appendChild(authorUnderline);

    bubble.appendChild(underline);
    bubble.appendChild(meta);
    bubble.appendChild(textSpan);
    bubble.appendChild(elapsedDiv);

    bubble.addEventListener("click", (e) => {
        e.stopPropagation();

        const panel = bubble.closest(".comment-panel") || document;

        // Close all other open bubbles
        panel.querySelectorAll(".comment-bubble.open").forEach((b) => {
            if (b === bubble) return;
            closeBubble(b);
        });

        // Toggle this one
        if (bubble.classList.contains("open")) {
            closeBubble(bubble);
        } else {
            openBubble(bubble);
        }
    });

    return bubble;
}

export function addBubbleAnimated(pageState, comment, delayMs = 0) {
    const { commentPanel } = pageState;
    const bubble = createBubbleElement(comment);
    if (!bubble) return;

    // start hidden / small
    bubble.classList.add("bubble-enter");
    commentPanel.appendChild(bubble);

    setTimeout(() => {
        // trigger transition
        requestAnimationFrame(() => {
            bubble.classList.add("bubble-enter-active");
        });
    }, delayMs);
}

document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggleOverlayBtn");
    const containers = Array.from(document.querySelectorAll(".comment-block"));

    if (!toggleBtn || !containers.length) {
        console.error("Missing toggle button or .comment-block containers.");
        return;
    }

    // Global comment mode flag
    let commentMode = true;

    // ----------- Helpers shared by all blocks -----------

    function updateButtonLabel() {
        if (commentMode) {
            toggleBtn.classList.add("on");
            toggleBtn.textContent = "Comment mode: ON";
        } else {
            toggleBtn.classList.remove("on");
            toggleBtn.textContent = "Comment mode: OFF";
        }
    }

    function applyOverlayState(blockStates) {
        blockStates.forEach(({ overlay }) => {
            if (!overlay) return;
            if (commentMode) {
                overlay.classList.remove("off");
            } else {
                overlay.classList.add("off");
            }
        });
    }

    function syncAllPanelHeights(blockStates) {
        blockStates.forEach(({ pagesColumn, commentPanel }) => {
            if (!pagesColumn || !commentPanel) return;
            const height = pagesColumn.scrollHeight; // full content height
            commentPanel.style.height = height + "px";
        });
    }

    function createBubbleElement(comment) {
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

            if (days >= 1) return `${days} ngày trước`;
            return `${hours} giờ trước`;
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
        bubble.appendChild(elapsedDiv); // add to meta

        bubble.addEventListener("click", (e) => {
            e.stopPropagation();

            const panel = bubble.closest(".comment-panel") || document;

            // Close all other open bubbles
            panel.querySelectorAll(".comment-bubble.open").forEach((b) => {
                if (b === bubble) return;

                // If you're using the fade-out close behavior:
                if (typeof closeBubble === "function") {
                    closeBubble(b);
                } else {
                    b.classList.remove("open");
                }
            });

            // Toggle this one
            if (bubble.classList.contains("open")) {
                if (typeof closeBubble === "function") closeBubble(bubble);
                else bubble.classList.remove("open");
            } else {
                if (typeof openBubble === "function") openBubble(bubble);
                else bubble.classList.add("open");
            }
        });

        return bubble;
    }

    // Animated add
    function addBubbleAnimated(block, comment, delayMs = 0) {
        const { commentPanel } = block;
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

    async function fetchCommentsForImage(imageId) {
        try {
            const res = await fetch(
                `/api/comments?imageId=${encodeURIComponent(imageId)}`,
            );
            if (!res.ok) {
                console.error(
                    "GET /api/comments failed with status",
                    res.status,
                );
                return [];
            }
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error("GET /api/comments error:", err);
            return [];
        }
    }

    // --- helpers (put these near your other helpers) ---
    const CLOSE_FADE_MS = 170; // must match CSS fade duration

    function openBubble(bubble) {
        bubble.classList.remove("closing");
        bubble.classList.add("open");
    }

    function closeBubble(bubble) {
        // If already closing, ignore extra clicks
        if (bubble.classList.contains("closing")) return;

        bubble.classList.add("closing");

        // prevent double click during fade-out (optional but helps)
        bubble.style.pointerEvents = "none";

        setTimeout(() => {
            bubble.classList.remove("open", "closing");
            bubble.style.pointerEvents = "";
        }, CLOSE_FADE_MS);
    }

    async function saveComment(comment) {
        console.log("Saving comment:", JSON.stringify(comment));
        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(comment),
            });

            if (!res.ok) {
                console.error(
                    "POST /api/comments failed with status",
                    res.status,
                );
                return null;
            }

            return await res.json();
        } catch (err) {
            console.error("POST /api/comments error:", err);
            return null;
        }
    }

    // ----------- Setup each block -----------

    const blockStates = containers
        .map((container) => {
            const pagesColumn = container.querySelector(".pages-column");
            const overlay = container.querySelector(".comment-overlay");
            const commentPanel = container.querySelector(".comment-panel");

            if (!pagesColumn || !overlay || !commentPanel) {
                console.error("Missing elements inside a .comment-block");
                return null;
            }

            const imageId = pagesColumn.dataset.imageId || "default-image-id";

            const chapterClass = [...container.classList]
                .find((c) => c.startsWith("k") && c.includes("_"))
                ?.split("_")[0]; // keep only the part before "_"
            console.log(chapterClass);

            // Click handler for this block’s overlay
            overlay.addEventListener("click", async (e) => {
                if (!commentMode) return;

                const rect = pagesColumn.getBoundingClientRect();
                const containerTopPage = rect.top + window.scrollY;

                const clickYPage = e.pageY;
                const clickXPage = e.pageX;

                const height = pagesColumn.scrollHeight;
                const width = rect.width;

                const yPct = (clickYPage - containerTopPage) / height;
                const xPct = (clickXPage - rect.left - window.scrollX) / width;

                const author = prompt("Your name:");
                if (!author || !author.trim()) return;

                const text = prompt("Type your comment:");
                if (!text) return;

                const newComment = {
                    imageId,
                    xPct,
                    yPct,
                    text: text.trim(),
                    author: author.trim(),
                    createdAt: new Date().toISOString(),
                    chapter: chapterClass,
                };

                // Animate new comment too
                addBubbleAnimated(
                    { commentPanel },
                    newComment,
                    0, // no delay for user-created
                );
                await saveComment(newComment);
            });

            return {
                container,
                pagesColumn,
                overlay,
                commentPanel,
                imageId,
            };
        })
        .filter(Boolean);

    // ----------- Wait for images (to stabilize layout) -----------

    function waitForImages(pagesColumn) {
        const imgs = Array.from(pagesColumn.querySelectorAll("img"));
        if (!imgs.length) return Promise.resolve();

        const promises = imgs.map(
            (img) =>
                new Promise((resolve) => {
                    if (img.complete) return resolve();
                    img.addEventListener("load", resolve, { once: true });
                    img.addEventListener("error", resolve, { once: true });
                }),
        );

        // Safety timeout: resolve anyway after 2s
        return Promise.race([
            Promise.all(promises),
            new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
    }

    // ----------- Global button -----------

    toggleBtn.addEventListener("click", () => {
        commentMode = !commentMode;
        updateButtonLabel();
        applyOverlayState(blockStates);
    });

    // ----------- Init -----------

    async function init() {
        // 1) Wait for all images to load so heights are stable
        await Promise.all(blockStates.map((b) => waitForImages(b.pagesColumn)));

        // 2) Sync heights now that images are there
        syncAllPanelHeights(blockStates);
        updateButtonLabel();
        applyOverlayState(blockStates);

        // 3) Fetch and animate comments for each block,
        //    with a small stagger for fun
        for (const block of blockStates) {
            const comments = await fetchCommentsForImage(block.imageId);

            comments
                .slice()
                .sort((a, b) => (a.yPct ?? 0) - (b.yPct ?? 0)) // optional: top to bottom
                .forEach((comment, idx) => {
                    const delay = 150 + idx * 90; // staggered entrance
                    addBubbleAnimated(block, comment, delay);
                });
        }

        // 4) Keep panel heights in sync on resize
        window.addEventListener("resize", () =>
            syncAllPanelHeights(blockStates),
        );
    }

    init();
});

/**
 * Main application entry point
 * Coordinates all modules and handles initialization
 */

import { fetchCommentsForImage, saveComment } from './api.js';
import { addBubbleAnimated } from './bubble.js';
import { syncPanelHeight, waitForImage } from './layout.js';
import { createStateManager } from './state.js';
import { createDualPageManager } from './dualPage.js';
import { createZoomManager } from './zoom.js';

document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("toggleOverlayBtn");
    const dualPageBtn = document.querySelector(".dual_page_toggler");
    const zoomInBtn = document.querySelector(".zoom_in_btn");
    const zoomOutBtn = document.querySelector(".zoom_out_btn");
    const zoomPercentDisplay = document.querySelector(".zoom_percent");
    const pageWrappers = Array.from(document.querySelectorAll(".page-wrapper"));

    if (!toggleBtn || !pageWrappers.length) {
        console.error("Missing toggle button or .page-wrapper elements.");
        return;
    }

    // Initialize state manager
    const stateManager = createStateManager(toggleBtn);

    // Initialize dual page manager
    const dualPageManager = createDualPageManager();

    // Initialize zoom manager
    const zoomManager = createZoomManager(zoomInBtn, zoomOutBtn, zoomPercentDisplay);

    // Helper to sync all panel heights
    const syncAllPanelHeights = () => {
        const allPageWrappers = document.querySelectorAll(".page-wrapper");
        allPageWrappers.forEach((wrapper) => {
            const page = wrapper.querySelector("img.page");
            const commentPanel = wrapper.querySelector(".comment-panel");
            if (page && commentPanel) {
                syncPanelHeight(page, commentPanel);
            }
        });
    };

    // Re-sync panel heights after layout changes
    dualPageManager.onLayoutChange(syncAllPanelHeights);

    // Re-sync panel heights after zoom changes
    zoomManager.onZoomChange(() => {
        // Use requestAnimationFrame to wait for width transition to apply
        requestAnimationFrame(() => {
            setTimeout(syncAllPanelHeights, 300); // Wait for transition
        });
    });

    // ----------- Setup each page -----------

    const pageStates = pageWrappers
        .map((wrapper) => {
            const pageContainer = wrapper.querySelector(".page-container");
            const page = wrapper.querySelector("img.page");
            const overlay = wrapper.querySelector(".comment-overlay");
            const commentPanel = wrapper.querySelector(".comment-panel");

            if (!pageContainer || !page || !overlay || !commentPanel) {
                console.error("Missing elements inside a .page-wrapper");
                return null;
            }

            // Use full image path as unique identifier
            const imageId = page.getAttribute("src");

            // Get chapter class from parent comment-block
            const commentBlock = wrapper.closest(".comment-block");
            const chapterClass = commentBlock
                ? [...commentBlock.classList]
                    .find((c) => c.startsWith("k") && c.includes("_"))
                    ?.split("_")[0]
                : "default";

            // Click handler for this page's overlay
            overlay.addEventListener("click", async (e) => {
                if (!stateManager.getCommentMode()) return;

                const rect = page.getBoundingClientRect();
                const clickX = e.clientX;
                const clickY = e.clientY;

                const xPct = (clickX - rect.left) / rect.width;
                const yPct = (clickY - rect.top) / rect.height;

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

                // Animate new comment
                addBubbleAnimated(
                    { commentPanel },
                    newComment,
                    0,
                );
                await saveComment(newComment);
            });

            return {
                wrapper,
                pageContainer,
                page,
                overlay,
                commentPanel,
                imageId,
            };
        })
        .filter(Boolean);

    // ----------- Global buttons -----------

    toggleBtn.addEventListener("click", () => {
        stateManager.toggle();
        stateManager.updateButtonLabel();
        stateManager.applyOverlayState(pageStates);
    });

    // Disable comment mode when bubbles are hidden in dual-page mode
    zoomManager.onHideBubblesChange((shouldHide) => {
        if (shouldHide && dualPageManager.isDualPage()) {
            stateManager.setCommentMode(false);
            stateManager.updateButtonLabel();
            stateManager.applyOverlayState(pageStates);
        }
    });

    // Dual page mode toggle
    if (dualPageBtn) {
        dualPageBtn.addEventListener("click", () => {
            dualPageManager.toggle();
            dualPageManager.applyLayout();

            // Update button state
            if (dualPageManager.isDualPage()) {
                dualPageBtn.classList.add("active");
            } else {
                dualPageBtn.classList.remove("active");
            }
        });
    }

    // ----------- Init -----------

    async function init() {
        // 1) Wait for all images to load so heights are stable
        await Promise.all(pageStates.map((p) => waitForImage(p.page)));

        // 2) Sync heights for each page's comment panel
        pageStates.forEach((p) => syncPanelHeight(p.page, p.commentPanel));
        stateManager.updateButtonLabel();
        stateManager.applyOverlayState(pageStates);

        // 3) Fetch and animate comments for each page
        for (const pageState of pageStates) {
            const comments = await fetchCommentsForImage(pageState.imageId);

            comments
                .slice()
                .sort((a, b) => (a.yPct ?? 0) - (b.yPct ?? 0))
                .forEach((comment, idx) => {
                    const delay = 150 + idx * 90;
                    addBubbleAnimated(pageState, comment, delay);
                });
        }

        // 4) Keep panel heights in sync on resize
        window.addEventListener("resize", () => {
            pageStates.forEach((p) => syncPanelHeight(p.page, p.commentPanel));
        });
    }

    init();
});

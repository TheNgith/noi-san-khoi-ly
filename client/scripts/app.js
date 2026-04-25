/**
 * Main application entry point
 * Coordinates all modules and handles initialization
 */

import { fetchCommentsForImage, saveComment } from './api.js';
import { addBubbleAnimated, addGroupedBubblesAnimated, rerenderBubbles } from './bubble.js';
import { syncPanelHeight, waitForImage, updateBubbleMaxWidths } from './layout.js';
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

    // ----------- Sidebar slide tied to cover visibility -----------
    const coverEl = document.querySelector(".cover_container");
    if (coverEl) {
        const bodyEl = document.body;
        let restoreTransitionTimer = null;
        const updateSidebarSlide = () => {
            const rect = coverEl.getBoundingClientRect();
            const h = rect.height || 1;
            // 0 when cover fully in view (bottom >= height), 1 when cover fully out (bottom <= 0)
            const progress = Math.min(1, Math.max(0, 1 - rect.bottom / h));
            // Disable transition during scroll so the slide tracks 1:1 (linear).
            // The !important hover rule in CSS still wins over this inline style.
            bodyEl.style.transition = "none";
            bodyEl.style.setProperty("--slide-progress", progress.toFixed(4));
            clearTimeout(restoreTransitionTimer);
            restoreTransitionTimer = setTimeout(() => {
                bodyEl.style.transition = "";
            }, 120);
        };
        updateSidebarSlide();
        window.addEventListener("scroll", updateSidebarSlide, { passive: true });
        window.addEventListener("resize", updateSidebarSlide);
    }

    // ----------- Navbar curl on scroll direction -----------
    const navbarEl = document.querySelector(".navbar");
    if (navbarEl) {
        let lastScrollY = window.scrollY;
        const SCROLL_THRESHOLD = 8; // ignore jitter
        const TOP_OFFSET = 40; // keep uncurled near the very top
        const updateNavbarCurl = () => {
            const currentY = window.scrollY;
            const delta = currentY - lastScrollY;
            if (Math.abs(delta) < SCROLL_THRESHOLD) return;
            if (delta > 0 && currentY > TOP_OFFSET) {
                navbarEl.classList.add("curled");
            } else if (delta < 0) {
                navbarEl.classList.remove("curled");
            }
            lastScrollY = currentY;
        };
        window.addEventListener("scroll", updateNavbarCurl, { passive: true });
    }

    // Initialize state manager
    const stateManager = createStateManager(toggleBtn);

    // Initialize dual page manager
    const dualPageManager = createDualPageManager();

    // Initialize zoom manager
    const zoomManager = createZoomManager(zoomInBtn, zoomOutBtn, zoomPercentDisplay);

    // Helper to sync all panel heights (and re-measure bubble widths, since
    // anything that moves panels also changes the bubble → toolbar gap)
    const syncAllPanelHeights = () => {
        const allPageWrappers = document.querySelectorAll(".page-wrapper");
        allPageWrappers.forEach((wrapper) => {
            const page = wrapper.querySelector("img.page");
            const commentPanel = wrapper.querySelector(".comment-panel");
            if (page && commentPanel) {
                syncPanelHeight(page, commentPanel);
            }
        });
        updateBubbleMaxWidths();
    };

    // Re-sync panel heights after layout changes
    dualPageManager.onLayoutChange(syncAllPanelHeights);

    // Re-sync panel heights and regroup bubbles after zoom changes
    zoomManager.onZoomChange(() => {
        // ── Capture scroll anchor before layout changes ──
        const scrollEl = document.scrollingElement || document.documentElement;
        let anchorWrapper = null;
        let anchorFraction = 0;

        for (const p of pageStates) {
            const rect = p.wrapper.getBoundingClientRect();
            const wrapperMid = rect.top + rect.height / 2;
            if (!anchorWrapper || Math.abs(wrapperMid - window.innerHeight / 2) <
                Math.abs(anchorWrapper.getBoundingClientRect().top + anchorWrapper.getBoundingClientRect().height / 2 - window.innerHeight / 2)) {
                anchorWrapper = p.wrapper;
            }
        }

        if (anchorWrapper) {
            const anchorRect = anchorWrapper.getBoundingClientRect();
            anchorFraction = (window.innerHeight / 2 - anchorRect.top) / anchorRect.height;
        }

        // Use requestAnimationFrame to wait for width transition to apply
        requestAnimationFrame(() => {
            setTimeout(() => {
                syncAllPanelHeights();
                // Re-render bubbles with new slice count (panel height changed)
                pageStates.forEach((p) => rerenderBubbles(p));

                // ── Restore scroll position ──
                if (anchorWrapper) {
                    const newRect = anchorWrapper.getBoundingClientRect();
                    const targetTop = newRect.top + anchorFraction * newRect.height;
                    const scrollCorrection = targetTop - window.innerHeight / 2;
                    scrollEl.scrollTop += scrollCorrection;
                }
            }, 300); // Wait for transition
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
        if (toggleBtn.classList.contains("disabled")) return;
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

    // ----------- Comment-mode hint tooltip (follows cursor) -----------
    const cmtHintEl = document.querySelector(".cmt-hint");
    if (cmtHintEl) {
        const moveHint = (e) => {
            cmtHintEl.style.left = `${e.clientX}px`;
            cmtHintEl.style.top = `${e.clientY}px`;
        };
        toggleBtn.addEventListener("mouseenter", (e) => {
            if (!toggleBtn.classList.contains("disabled")) return;
            cmtHintEl.classList.add("visible");
            moveHint(e);
        });
        toggleBtn.addEventListener("mousemove", (e) => {
            if (!toggleBtn.classList.contains("disabled")) return;
            moveHint(e);
        });
        toggleBtn.addEventListener("mouseleave", () => {
            cmtHintEl.classList.remove("visible");
        });
    }

    // Hide bubbles and disable comment mode when entering dual-page mode;
    // restore when leaving. Kept in a helper so the toggle handler stays terse.
    const pagesContainerEl = document.querySelector(".pages_container");
    const applyDualPageCommentState = () => {
        const dual = dualPageManager.isDualPage();
        if (pagesContainerEl) {
            pagesContainerEl.classList.toggle("dual-page-active", dual);
        }
        if (dual) {
            stateManager.setCommentMode(false);
            toggleBtn.classList.add("disabled");
        } else {
            stateManager.setCommentMode(true);
            toggleBtn.classList.remove("disabled");
            if (cmtHintEl) cmtHintEl.classList.remove("visible");
        }
        stateManager.updateButtonLabel();
        stateManager.applyOverlayState(pageStates);
    };

    // ----------- Page-mode hint tooltip (follows cursor) -----------
    const pageModeHintEl = document.querySelector(".page-mode-hint");
    const updatePageModeHintText = () => {
        if (!pageModeHintEl) return;
        pageModeHintEl.textContent = dualPageManager.isDualPage()
            ? "Đọc với trang đơn"
            : "Đọc với trang đôi";
    };
    updatePageModeHintText();
    if (pageModeHintEl && dualPageBtn) {
        const movePageModeHint = (e) => {
            pageModeHintEl.style.left = `${e.clientX}px`;
            pageModeHintEl.style.top = `${e.clientY}px`;
        };
        dualPageBtn.addEventListener("mouseenter", (e) => {
            pageModeHintEl.classList.add("visible");
            movePageModeHint(e);
        });
        dualPageBtn.addEventListener("mousemove", movePageModeHint);
        dualPageBtn.addEventListener("mouseleave", () => {
            pageModeHintEl.classList.remove("visible");
        });
    }

    // Dual page mode toggle
    if (dualPageBtn) {
        dualPageBtn.addEventListener("click", () => {
            dualPageManager.toggle();
            dualPageManager.applyLayout();
            applyDualPageCommentState();
            updatePageModeHintText();

            // Swap icons
            const singleIcon = dualPageBtn.querySelector('.page_mode_icon.single');
            const dualIcon = dualPageBtn.querySelector('.page_mode_icon.dual');
            if (dualPageManager.isDualPage()) {
                dualPageBtn.classList.add("active");
                if (singleIcon) singleIcon.style.display = 'none';
                if (dualIcon) dualIcon.style.display = '';
            } else {
                dualPageBtn.classList.remove("active");
                if (singleIcon) singleIcon.style.display = '';
                if (dualIcon) dualIcon.style.display = 'none';
            }
        });
    }

    // ----------- Init -----------

    async function init() {
        // 1) Wait for all images to load so heights are stable
        await Promise.all(pageStates.map((p) => waitForImage(p.page)));

        // 2) Sync heights for each page's comment panel
        pageStates.forEach((p) => syncPanelHeight(p.page, p.commentPanel));
        updateBubbleMaxWidths();
        stateManager.updateButtonLabel();
        stateManager.applyOverlayState(pageStates);

        // 3) Fetch and animate comments for each page
        for (const pageState of pageStates) {
            const comments = await fetchCommentsForImage(pageState.imageId);
            addGroupedBubblesAnimated(pageState, comments);
        }

        // 4) Keep panel heights in sync on resize
        window.addEventListener("resize", () => {
            pageStates.forEach((p) => syncPanelHeight(p.page, p.commentPanel));
            // Defer one frame so layout is settled before measuring
            requestAnimationFrame(() => updateBubbleMaxWidths());
        });
    }

    init();
});

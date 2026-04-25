/**
 * Layout synchronization module
 * Handles panel height sync and image loading coordination
 */

export function syncPanelHeight(page, commentPanel) {
    if (!page || !commentPanel) return;
    const height = page.offsetHeight;
    commentPanel.style.height = height + "px";
}

/**
 * Compute how wide an opened comment bubble can be on each .page-wrapper
 * and expose it as a CSS custom property (--bubble-max-width) on that wrapper.
 *
 * The bubble is absolutely positioned inside its .comment-panel, anchored to
 * the panel's left edge (right-facing) or right edge (left-facing, in
 * dual-page left pages). The available horizontal space depends on:
 *   - right-facing: panel.left → toolbar.left
 *   - left-facing:  viewport.left → panel.right
 *
 * Falls back to a sensible CSS calc() if this function never runs.
 */
export function updateBubbleMaxWidths() {
    const toolbar = document.querySelector(".toolbar_container");
    const toolbarLeft = toolbar
        ? toolbar.getBoundingClientRect().left
        : window.innerWidth - 20;

    const BREATHING = 20; // px between bubble edge and nearest obstacle
    const MIN_WIDTH = 260; // never narrower than the base panel width

    document
        .querySelectorAll(".page-wrapper")
        .forEach((wrapper) => {
            const panel = wrapper.querySelector(".comment-panel");
            if (!panel) return;

            const panelRect = panel.getBoundingClientRect();
            const isLeftFacing = wrapper.classList.contains("left-page");

            const rawMax = isLeftFacing
                ? panelRect.right - BREATHING
                : toolbarLeft - panelRect.left - BREATHING;

            const maxWidth = Math.max(MIN_WIDTH, Math.round(rawMax));
            wrapper.style.setProperty("--bubble-max-width", maxWidth + "px");
        });
}

export function waitForImage(img) {
    if (!img) return Promise.resolve();

    return new Promise((resolve) => {
        if (img.complete) return resolve();
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });

        // Safety timeout: resolve anyway after 2s
        setTimeout(resolve, 2000);
    });
}

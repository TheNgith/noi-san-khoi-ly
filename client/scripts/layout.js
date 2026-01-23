/**
 * Layout synchronization module
 * Handles panel height sync and image loading coordination
 */

export function syncPanelHeight(page, commentPanel) {
    if (!page || !commentPanel) return;
    const height = page.offsetHeight;
    commentPanel.style.height = height + "px";
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

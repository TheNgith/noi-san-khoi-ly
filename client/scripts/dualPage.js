/**
 * Dual page mode module
 * Handles toggling between single-page and dual-page layouts
 */

export function createDualPageManager() {
    let isDualPage = false;
    let isTransitioning = false;
    let onLayoutChangeCallback = null;

    return {
        isDualPage: () => isDualPage,

        toggle: () => {
            isDualPage = !isDualPage;
        },

        // Set callback to be called after layout changes
        onLayoutChange: (callback) => {
            onLayoutChangeCallback = callback;
        },

        applyLayout: () => {
            if (isTransitioning) return;
            isTransitioning = true;

            const pagesColumns = document.querySelectorAll(".pages-column");

            // Add transitioning class for fade-out
            pagesColumns.forEach((column) => {
                column.classList.add("layout-transitioning");
            });

            // Wait for fade-out, then apply layout changes
            setTimeout(() => {
                pagesColumns.forEach((column) => {
                    if (isDualPage) {
                        enableDualPageMode(column);
                    } else {
                        disableDualPageMode(column);
                    }
                });

                // Force reflow
                pagesColumns.forEach((column) => {
                    void column.offsetHeight;
                });

                // Use requestAnimationFrame to ensure layout is calculated
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Call the layout change callback to re-sync heights
                        if (onLayoutChangeCallback) {
                            onLayoutChangeCallback();
                        }

                        // Remove transitioning class for fade-in
                        pagesColumns.forEach((column) => {
                            column.classList.remove("layout-transitioning");
                        });
                        isTransitioning = false;
                    });
                });
            }, 150); // Duration of fade-out (ms)
        },
    };
}

function enableDualPageMode(column) {
    // Get all page-wrappers that are direct children (not already in pairs)
    const wrappers = Array.from(column.querySelectorAll(":scope > .page-wrapper"));

    // Group wrappers into pairs
    for (let i = 0; i < wrappers.length; i += 2) {
        const leftWrapper = wrappers[i];
        const rightWrapper = wrappers[i + 1];

        // Create a pair container
        const pair = document.createElement("div");
        pair.className = "page-pair";

        // Mark left and right pages
        leftWrapper.classList.add("left-page");

        // Insert pair before the left wrapper
        column.insertBefore(pair, leftWrapper);

        // Move wrappers into the pair
        pair.appendChild(leftWrapper);

        if (rightWrapper) {
            rightWrapper.classList.add("right-page");
            pair.appendChild(rightWrapper);
        }
    }
}

function disableDualPageMode(column) {
    // Get all page-pairs
    const pairs = Array.from(column.querySelectorAll(".page-pair"));

    pairs.forEach((pair) => {
        // Get wrappers inside the pair
        const wrappers = Array.from(pair.querySelectorAll(".page-wrapper"));

        // Move wrappers back to column (before the pair)
        wrappers.forEach((wrapper) => {
            wrapper.classList.remove("left-page", "right-page");
            column.insertBefore(wrapper, pair);
        });

        // Remove the empty pair container
        pair.remove();
    });
}

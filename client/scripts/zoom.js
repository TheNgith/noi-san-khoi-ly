/**
 * Zoom module
 * Handles page zoom in/out functionality
 */

export function createZoomManager(zoomInBtn, zoomOutBtn, zoomPercentDisplay) {
    const DEFAULT_DISPLAY_ZOOM = 100;
    const MIN_DISPLAY_ZOOM = 20;
    const MAX_DISPLAY_ZOOM = 200;
    const DISPLAY_STEP = 20;
    const ACTUAL_STEP = 10; // Actual size changes by 10% per click

    // Threshold for hiding bubbles in dual-page mode (actual zoom)
    const HIDE_BUBBLES_THRESHOLD = 130;

    let displayZoom = DEFAULT_DISPLAY_ZOOM;
    let onZoomChangeCallback = null;
    let onHideBubblesChangeCallback = null;
    let wasBubblesHidden = false;

    // Convert display zoom to actual zoom
    // Display 100% = Actual 100%, each 20% display step = 10% actual step
    function getActualZoom() {
        const steps = (displayZoom - DEFAULT_DISPLAY_ZOOM) / DISPLAY_STEP;
        return DEFAULT_DISPLAY_ZOOM + (steps * ACTUAL_STEP);
    }

    function updateDisplay() {
        if (zoomPercentDisplay) {
            zoomPercentDisplay.textContent = `${displayZoom}%`;
        }
    }

    function applyZoom() {
        const pagesContainer = document.querySelector(".pages_container");
        const actualZoom = getActualZoom();

        if (pagesContainer) {
            // Set actual zoom level for CSS sizing
            pagesContainer.style.setProperty("--zoom-level", actualZoom / 100);

            // Toggle high-zoom class for hiding bubbles in dual-page mode
            const shouldHideBubbles = actualZoom >= HIDE_BUBBLES_THRESHOLD;
            if (shouldHideBubbles) {
                pagesContainer.classList.add("zoom-hide-bubbles");
            } else {
                pagesContainer.classList.remove("zoom-hide-bubbles");
            }

            // Notify when hide bubbles state changes
            if (shouldHideBubbles !== wasBubblesHidden) {
                wasBubblesHidden = shouldHideBubbles;
                if (onHideBubblesChangeCallback) {
                    onHideBubblesChangeCallback(shouldHideBubbles);
                }
            }
        }

        updateDisplay();

        if (onZoomChangeCallback) {
            onZoomChangeCallback(actualZoom);
        }
    }

    function zoomIn() {
        if (displayZoom < MAX_DISPLAY_ZOOM) {
            displayZoom = Math.min(displayZoom + DISPLAY_STEP, MAX_DISPLAY_ZOOM);
            applyZoom();
        }
    }

    function zoomOut() {
        if (displayZoom > MIN_DISPLAY_ZOOM) {
            displayZoom = Math.max(displayZoom - DISPLAY_STEP, MIN_DISPLAY_ZOOM);
            applyZoom();
        }
    }

    // Set up event listeners
    if (zoomInBtn) {
        zoomInBtn.addEventListener("click", zoomIn);
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener("click", zoomOut);
    }

    // Initialize display
    updateDisplay();
    applyZoom();

    return {
        getDisplayZoom: () => displayZoom,
        getActualZoom,
        zoomIn,
        zoomOut,
        reset: () => {
            displayZoom = DEFAULT_DISPLAY_ZOOM;
            applyZoom();
        },
        onZoomChange: (callback) => {
            onZoomChangeCallback = callback;
        },
        onHideBubblesChange: (callback) => {
            onHideBubblesChangeCallback = callback;
        },
        isBubblesHidden: () => wasBubblesHidden,
    };
}

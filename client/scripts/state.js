/**
 * UI state management module
 * Handles comment mode toggle and overlay state
 */

export function createStateManager(toggleBtn) {
    let commentMode = true;

    return {
        getCommentMode: () => commentMode,

        toggle: () => {
            commentMode = !commentMode;
        },

        setCommentMode: (enabled) => {
            commentMode = enabled;
        },

        updateButtonLabel: () => {
            if (commentMode) {
                toggleBtn.classList.add("on");
                toggleBtn.textContent = "Comment mode: ON";
            } else {
                toggleBtn.classList.remove("on");
                toggleBtn.textContent = "Comment mode: OFF";
            }
        },

        applyOverlayState: (blockStates) => {
            blockStates.forEach(({ overlay }) => {
                if (!overlay) return;
                if (commentMode) {
                    overlay.classList.remove("off");
                } else {
                    overlay.classList.add("off");
                }
            });
        }
    };
}

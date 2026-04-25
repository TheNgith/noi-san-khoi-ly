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
            const img = toggleBtn.querySelector('.cmt_icon');
            if (commentMode) {
                toggleBtn.classList.add("on");
                if (img) img.src = "assets/icons/cmt_mode_on.svg";
            } else {
                toggleBtn.classList.remove("on");
                if (img) img.src = "assets/icons/cmt_mode_off.svg";
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

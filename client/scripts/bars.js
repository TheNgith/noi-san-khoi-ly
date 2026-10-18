/**
 * Giới thiệu and Liên hệ: the navbar and footer slide away while the reader
 * scrolls down and come back on the way up, like the reader's navbar
 * (navigation.js). At the very end both show, so the footer can be reached.
 */

const bars = document.querySelectorAll(".navbar, .site_footer");
let lastY = scrollY;

addEventListener(
    "scroll",
    () => {
        const y = scrollY, d = y - lastY;
        const atEnd = y + innerHeight >= document.documentElement.scrollHeight - 2;
        if (Math.abs(d) > 8 || atEnd) {
            const hide = d > 0 && y > 40 && !atEnd;
            for (const bar of bars) bar.classList.toggle("curled", hide);
            lastY = y;
        }
    },
    { passive: true }
);

/**
 * "Liên hệ" page: sends the form to the server.
 * Without a server (the static GitHub Pages build) the send fails and the
 * message stays in the form, with the error shown, so it can be retried.
 */

import { sendMessage } from "./api.js";

const form = document.getElementById("contact-form");
const msg = document.getElementById("contact-msg");
const send = form.querySelector(".contact_send");

function say(text, warn = false) {
    msg.textContent = text;
    msg.classList.toggle("warn", warn);
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(
        [...new FormData(form)].map(([k, v]) => [k, String(v).trim()])
    );

    if (!data.name || !data.text) {
        say("Vui lòng nhập Tên và Lời nhắn", true);
        (data.name ? form.elements.text : form.elements.name).focus();
        return;
    }
    if (!form.elements.email.checkValidity()) {
        say("Email này có vẻ chưa đúng.", true);
        form.elements.email.focus();
        return;
    }

    send.disabled = true;
    say("Đang gửi…");
    try {
        await sendMessage(data);
        form.reset();
        say("Đã gửi. Cảm ơn bạn!");
    } catch {
        say("Chưa gửi được. Bạn thử lại sau nhé.", true);
    } finally {
        send.disabled = false;
    }
});

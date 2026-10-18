/**
 * API communication module
 * Loads every comment in one request and saves new ones.
 */

// One request for the whole book. Without a server (e.g. the static
// GitHub Pages build) this resolves to an empty list.
export async function fetchAllComments() {
    try {
        const res = await fetch("/api/comments");
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

// Resolves to the stored comment, or throws so the reader can offer a retry
export async function saveComment(comment) {
    const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comment),
    });
    if (!res.ok) throw new Error(`POST /api/comments failed with status ${res.status}`);
    return res.json();
}

// "Liên hệ" form: { name, email?, text }. Throws so the page can say it failed.
export async function sendMessage(message) {
    const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
    });
    if (!res.ok) throw new Error(`POST /api/messages failed with status ${res.status}`);
    return res.json();
}

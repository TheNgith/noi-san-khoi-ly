/**
 * API communication module
 * Handles all fetch/save operations with the backend
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

export async function saveComment(comment) {
    console.log("Saving comment:", JSON.stringify(comment));
    try {
        const res = await fetch("/api/comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(comment),
        });

        if (!res.ok) {
            console.error(
                "POST /api/comments failed with status",
                res.status,
            );
            return null;
        }

        return await res.json();
    } catch (err) {
        console.error("POST /api/comments error:", err);
        return null;
    }
}

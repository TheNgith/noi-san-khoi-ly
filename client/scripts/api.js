/**
 * API communication module
 * Handles all fetch/save operations with the backend
 */

export async function fetchCommentsForImage(imageId) {
    try {
        const res = await fetch(
            `/api/comments?imageId=${encodeURIComponent(imageId)}`,
        );
        if (!res.ok) {
            console.error(
                "GET /api/comments failed with status",
                res.status,
            );
            return [];
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.error("GET /api/comments error:", err);
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

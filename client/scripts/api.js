/**
 * API communication module
 * Comments and "Liên hệ" messages live in Firestore under the passcode the
 * visitor entered (passcodes/<code>/comments, …/messages); see gate.js and
 * firestore.rules, which checks the same limits the old Express API did.
 */

import {
    addDoc, collection, getDocs, orderBy, query, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js";
import { db } from "./firebase.js";
import { unlocked } from "./gate.js";

const under = async (name) => collection(db, "passcodes", await unlocked, name);

// One request for the whole book; an empty list if it fails
export async function fetchAllComments() {
    try {
        const snap = await getDocs(query(await under("comments"), orderBy("createdAt")));
        return snap.docs.map((d) => {
            const c = d.data();
            return { ...c, id: d.id, createdAt: c.createdAt?.toDate().toISOString() };
        });
    } catch (err) {
        console.error(err);
        return [];
    }
}

// Resolves to the stored comment's id and time, or throws so the reader can offer a retry
export async function saveComment(comment) {
    const doc = {
        imageId: comment.imageId,
        xPct: Math.min(1, Math.max(0, comment.xPct)),
        yPct: Math.min(1, Math.max(0, comment.yPct)),
        text: comment.text.trim(),
        author: comment.author.trim(),
        createdAt: serverTimestamp(),
    };
    if (comment.cls?.trim()) doc.cls = comment.cls.trim();
    if (comment.chapter) doc.chapter = String(comment.chapter);
    const ref = await addDoc(await under("comments"), doc);
    return { id: ref.id, createdAt: new Date().toISOString() };
}

// "Liên hệ" form: { name, email?, text }. Throws so the page can say it failed.
// Messages can be written but never read back from the site.
export async function sendMessage(message) {
    const doc = { name: message.name, text: message.text, createdAt: serverTimestamp() };
    if (message.email) doc.email = message.email;
    const ref = await addDoc(await under("messages"), doc);
    return { id: ref.id };
}

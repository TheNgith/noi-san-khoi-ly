/**
 * Firebase: the comments database.
 * These values are not secrets: Firebase web config is public by design, and
 * firestore.rules decides who may read or write.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js";

// From Firebase console › Project settings › Your apps › Web app
const config = {
    apiKey: "AIzaSyDERFf9WI7KmYuz-DCnkbDHdMu5wvK7TJY",
    authDomain: "noisankhoily.firebaseapp.com",
    projectId: "noisankhoily",
    appId: "1:401049593945:web:de7b4dfd4852037f3ea948",
};

export const configured = !Object.values(config).some((v) => v.includes("TODO"));

export const db = getFirestore(initializeApp(config));

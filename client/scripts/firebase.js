/**
 * Firebase: the comments database.
 * These values are not secrets: Firebase web config is public by design, and
 * firestore.rules decides who may read or write.
 *
 * App Check makes each request prove it comes from this site, which makes it
 * much harder for a script holding the config above to hammer the database
 * or guess passcodes.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js";

// From Firebase console › Project settings › Your apps › Web app
const config = {
    apiKey: "AIzaSyDERFf9WI7KmYuz-DCnkbDHdMu5wvK7TJY",
    authDomain: "noisankhoily.firebaseapp.com",
    projectId: "noisankhoily",
    appId: "1:401049593945:web:de7b4dfd4852037f3ea948",
};

// From Google Cloud console › Security › reCAPTCHA (public, like the config).
// App Check stays off until this is filled in.
const recaptchaKey = "6LczyP8tAAAAACrko2IGf0JWQkzVksszyWWaIajW";

export const configured = !Object.values(config).some((v) => v.includes("TODO"));

const app = initializeApp(config);

if (!recaptchaKey.includes("TODO")) {
    // reCAPTCHA only knows the real domain; on this machine the SDK prints a
    // debug token to the console instead, to add in Firebase › App Check
    if (["localhost", "127.0.0.1"].includes(location.hostname)) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
    });
}

export const db = getFirestore(app);

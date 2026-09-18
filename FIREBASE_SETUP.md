# Enabling real user accounts (Firebase)

The site ships in **demo mode**: accounts are stored in the browser's
localStorage with salted SHA-256 password hashes. Great for demos — but
data lives per-device only.

To make accounts **real** (secure, multi-device, Google sign-in), connect
Firebase in ~10 minutes, free:

## 1. Create a Firebase project
1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it (e.g. `care-navigation`), continue, and disable Analytics if you like.

## 2. Register a web app
1. In Project settings → **Your apps**, click the **Web (`</>`)** icon.
2. Register the app and copy the `firebaseConfig` object it shows you.

## 3. Create the local config file
Create `firebase-config.js` next to `index.html` (it is gitignored, so
your keys stay local) with this content, using your real values:

```js
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

The site detects this file automatically — accounts, passwords, profiles
(Gmail, phone) and payment metadata then live in Firebase Auth +
Firestore. No other code changes needed.

## 4. Enable sign-in methods
In the Firebase console: **Authentication → Sign-in method** →
enable **Email/Password** and, if you want the "Continue with Google"
button, **Google**.

## 5. Firestore
**Firestore Database → Create database** (production mode is fine).
Users' profiles are written to the `users` collection automatically.

## Deploying (Render)
Add the same `firebaseConfig` values as environment variables if you
inject configs at build time, or commit a non-secret template the way
`gemini-config.example.js` is handled. Firebase web API keys are safe to
expose (they identify, not authorize, your project) as long as you
restrict domains in Firebase console → Authentication → Settings →
Authorized domains.

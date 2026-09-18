/* ============================================================
   Care Navigation — Accounts (demo mode / Firebase-ready)
   ------------------------------------------------------------
   Demo mode (no Firebase keys present):
     - Accounts are stored in this browser's localStorage.
     - Passwords are hashed with SHA-256 (Web Crypto) + per-user salt.
     - Works instantly for demos; data is per-device only.

   Firebase mode (paste keys in the FIREBASE_CONFIG below or via
   window.FIREBASE_CONFIG set by a config script):
     - Real accounts via Firebase Authentication (email+password,
       Google sign-in) and Firestore for profile data
       (name, Gmail, phone). Firebase handles password hashing
       and security — we never store passwords ourselves.
   ============================================================ */
(function () {
  "use strict";

  var FIREBASE_CONFIG = window.FIREBASE_CONFIG || null;
  // Firebase SDK modules are injected as globals by auth-sdk.js (optional).
  var FB = window.__firebaseSdk || null; // { initializeApp, getAuth, ... }

  var MODE = FIREBASE_CONFIG && FB ? "firebase" : "demo";
  var LS_USERS = "cn_users_v1";
  var LS_SESSION = "cn_session_v1";

  /* ---------- storage helpers (demo mode) ---------- */
  function readUsers() {
    try { return JSON.parse(localStorage.getItem(LS_USERS) || "{}"); }
    catch (e) { return {}; }
  }
  function writeUsers(u) { localStorage.setItem(LS_USERS, JSON.stringify(u)); }

  function sha256(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
      .then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, "0");
        }).join("");
      });
  }
  function randomSalt() {
    var a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function validPhone(p) { return /^[0-9+\-\s()]{7,15}$/.test(p); }

  function publicProfile(rec) {
    return { uid: rec.uid, fullName: rec.fullName, email: rec.email, phone: rec.phone, createdAt: rec.createdAt, provider: rec.provider || "password" };
  }

  /* ---------- demo implementation ---------- */
  var demo = {
    signUp: function (opts) {
      var fullName = (opts.fullName || "").trim();
      var email = (opts.email || "").trim().toLowerCase();
      var phone = (opts.phone || "").trim();
      var password = opts.password || "";
      if (!fullName) return Promise.reject(new Error("Please enter your full name."));
      if (!validEmail(email)) return Promise.reject(new Error("Please enter a valid email (Gmail) address."));
      if (!validPhone(phone)) return Promise.reject(new Error("Please enter a valid phone number."));
      if (password.length < 8) return Promise.reject(new Error("Password must be at least 8 characters."));
      var users = readUsers();
      if (users[email]) return Promise.reject(new Error("An account with this email already exists. Try signing in."));
      var salt = randomSalt();
      return sha256(salt + ":" + password).then(function (hash) {
        users[email] = { uid: "u_" + Date.now().toString(36), fullName: fullName, email: email, phone: phone, salt: salt, hash: hash, createdAt: new Date().toISOString(), provider: "password" };
        writeUsers(users);
        var rec = users[email];
        localStorage.setItem(LS_SESSION, JSON.stringify({ email: email, at: Date.now() }));
        return publicProfile(rec);
      });
    },
    signIn: function (email, password) {
      email = (email || "").trim().toLowerCase();
      var users = readUsers();
      var rec = users[email];
      if (!rec) return Promise.reject(new Error("No account found with this email. Please create one first."));
      return sha256(rec.salt + ":" + password).then(function (hash) {
        if (hash !== rec.hash) return Promise.reject(new Error("Incorrect password. Please try again."));
        localStorage.setItem(LS_SESSION, JSON.stringify({ email: email, at: Date.now() }));
        return publicProfile(rec);
      });
    },
    changePassword: function (email, currentPw, newPw) {
      var users = readUsers();
      var rec = users[email];
      if (!rec) return Promise.reject(new Error("Account not found."));
      return sha256(rec.salt + ":" + currentPw).then(function (h) {
        if (h !== rec.hash) return Promise.reject(new Error("Current password is incorrect."));
        if ((newPw || "").length < 8) return Promise.reject(new Error("New password must be at least 8 characters."));
        var salt = randomSalt();
        return sha256(salt + ":" + newPw).then(function (nh) {
          rec.salt = salt; rec.hash = nh;
          writeUsers(users);
          return true;
        });
      });
    },
    updateProfile: function (email, patch) {
      var users = readUsers();
      var rec = users[email];
      if (!rec) return Promise.reject(new Error("Account not found."));
      if (patch.phone && !validPhone(patch.phone)) return Promise.reject(new Error("Please enter a valid phone number."));
      if (patch.fullName) rec.fullName = patch.fullName.trim();
      if (patch.phone) rec.phone = patch.phone.trim();
      writeUsers(users);
      return Promise.resolve(publicProfile(rec));
    },
    savePaymentMethod: function (email, method) {
      var users = readUsers();
      var rec = users[email];
      if (!rec) return Promise.reject(new Error("Account not found."));
      // Store only safe metadata — never full card numbers.
      rec.paymentMethod = {
        type: method.type || "card",
        label: method.label || "",
        last4: (method.number || "").replace(/\D/g, "").slice(-4),
        holder: method.holder || "",
        expiry: method.expiry || "",
        upiId: method.upiId || ""
      };
      writeUsers(users);
      return Promise.resolve(rec.paymentMethod);
    },
    getCurrentUser: function () {
      try {
        var s = JSON.parse(localStorage.getItem(LS_SESSION) || "null");
        if (!s) return Promise.resolve(null);
        var rec = readUsers()[s.email];
        return Promise.resolve(rec ? publicProfile(rec) : null);
      } catch (e) { return Promise.resolve(null); }
    },
    signOut: function () { localStorage.removeItem(LS_SESSION); return Promise.resolve(); }
  };

  /* ---------- firebase implementation (loaded when keys + SDK present) ---------- */
  var fb = null;
  function getFb() {
    if (fb) return fb;
    var S = window.__firebaseSdk;
    var cfg = window.FIREBASE_CONFIG;
    if (!S || !cfg) return null;
    var app = S.initializeApp(cfg);
    var auth = S.getAuth(app);
    var db = S.getFirestore(app);
    fb = {
      signUp: function (opts) {
        var fullName = (opts.fullName || "").trim();
        var email = (opts.email || "").trim();
        var phone = (opts.phone || "").trim();
        var password = opts.password || "";
        if (!fullName) return Promise.reject(new Error("Please enter your full name."));
        if (!validEmail(email)) return Promise.reject(new Error("Please enter a valid email (Gmail) address."));
        if (!validPhone(phone)) return Promise.reject(new Error("Please enter a valid phone number."));
        if (password.length < 8) return Promise.reject(new Error("Password must be at least 8 characters."));
        return S.createUserWithEmailAndPassword(auth, email, password).then(function (cred) {
          return S.updateProfile(cred.user, { displayName: fullName }).then(function () {
            return S.setDoc(S.doc(db, "users", cred.user.uid), {
              fullName: fullName, email: email, phone: phone, createdAt: new Date().toISOString()
            });
          }).then(function () { return profileOf(cred.user, { phone: phone }); });
        });
      },
      signIn: function (email, password) {
        return S.signInWithEmailAndPassword(auth, email, password)
          .then(function (cred) { return profileOf(cred.user, {}); });
      },
      signInWithGoogle: function () {
        var provider = new S.GoogleAuthProvider();
        return S.signInWithPopup(auth, provider).then(function (res) {
          var u = res.user;
          return S.setDoc(S.doc(db, "users", u.uid), {
            fullName: u.displayName || "", email: u.email || "", phone: u.phoneNumber || "", createdAt: new Date().toISOString()
          }, { merge: true }).then(function () {
            return { uid: u.uid, fullName: u.displayName || "", email: u.email || "", phone: u.phoneNumber || "", provider: "google" };
          });
        });
      },
      changePassword: function (email, currentPw, newPw) {
        var u = auth.currentUser;
        if (!u) return Promise.reject(new Error("You are signed out."));
        var cred = S.EmailAuthProvider.credential(u.email, currentPw);
        return S.reauthenticateWithCredential(u, cred).then(function () {
          return S.updatePassword(u, newPw);
        });
      },
      updateProfile: function (email, patch) {
        var u = auth.currentUser;
        if (!u) return Promise.reject(new Error("You are signed out."));
        var p = S.updateProfile(u, patch.fullName ? { displayName: patch.fullName } : {});
        var d = S.setDoc(S.doc(db, "users", u.uid), patch, { merge: true });
        return Promise.all([p, d]).then(function () {
          return { uid: u.uid, fullName: u.displayName || patch.fullName || "", email: u.email, phone: patch.phone || u.phoneNumber || "" };
        });
      },
      savePaymentMethod: function (email, method) {
        var u = auth.currentUser;
        if (!u) return Promise.reject(new Error("You are signed out."));
        var safe = {
          type: method.type || "card",
          label: method.label || "",
          last4: (method.number || "").replace(/\D/g, "").slice(-4),
          holder: method.holder || "",
          expiry: method.expiry || "",
          upiId: method.upiId || ""
        };
        return S.setDoc(S.doc(db, "users", u.uid), { paymentMethod: safe }, { merge: true }).then(function () { return safe; });
      },
      getCurrentUser: function () {
        return new Promise(function (resolve) {
          S.onAuthStateChanged(auth, function (u) {
            if (!u) return resolve(null);
            S.getDoc(S.doc(db, "users", u.uid)).then(function (snap) {
              var d = snap.exists() ? snap.data() : {};
              resolve({ uid: u.uid, fullName: u.displayName || d.fullName || "", email: u.email || "", phone: d.phone || u.phoneNumber || "", provider: u.providerData[0] ? u.providerData[0].providerId : "password" });
            }).catch(function () { resolve({ uid: u.uid, fullName: u.displayName || "", email: u.email || "", phone: "", provider: "password" }); });
          });
        });
      },
      signOut: function () { return S.signOut(auth); }
    };
    function profileOf(u, extra) {
      return { uid: u.uid, fullName: u.displayName || "", email: u.email || "", phone: extra.phone || u.phoneNumber || "", provider: "password" };
    }
    return fb;
  }

  /* ---------- public API (auto-selects mode) ---------- */
  function impl() { return getFb() || demo; }
  window.CNAccounts = {
    mode: function () { return getFb() ? "firebase" : "demo"; },
    signUp: function (o) { return impl().signUp(o); },
    signIn: function (e, p) { return impl().signIn(e, p); },
    signInWithGoogle: function () {
      var f = getFb();
      if (f && f.signInWithGoogle) return f.signInWithGoogle();
      return Promise.reject(new Error("Google sign-in needs Firebase. Add your Firebase keys to enable it."));
    },
    changePassword: function (e, c, n) { return impl().changePassword(e, c, n); },
    updateProfile: function (e, patch) { return impl().updateProfile(e, patch); },
    savePaymentMethod: function (e, m) { return impl().savePaymentMethod(e, m); },
    getCurrentUser: function () { return impl().getCurrentUser(); },
    signOut: function () { return impl().signOut(); }
  };
})();

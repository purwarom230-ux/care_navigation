/* ============================================================
   Care Navigation — Real bookings (per signed-in user)
   Demo mode: bookings persist in localStorage per account.
   Firebase mode: bookings sync to Firestore "bookings" collection
   (active automatically when Firebase keys + SDK are present).
   ============================================================ */
(function () {
  "use strict";

  var LS = "cn_bookings_v1";

  function readAll() {
    try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; }
  }
  function writeAll(b) { localStorage.setItem(LS, JSON.stringify(b)); }

  function publicBooking(b) {
    return {
      id: b.id, service: b.service, hospital: b.hospital, hospitalAddr: b.hospitalAddr,
      date: b.date, time: b.time, patientName: b.patientName, patientPhone: b.patientPhone,
      notes: b.notes, status: b.status, createdAt: b.createdAt
    };
  }

  var demo = {
    save: function (email, booking) {
      if (!email) return Promise.reject(new Error("Sign in to save your bookings."));
      var req = {
        id: "CN" + Date.now().toString(36).toUpperCase(),
        service: (booking.service || "").trim(),
        hospital: (booking.hospital || "").trim(),
        hospitalAddr: booking.hospitalAddr || "",
        date: booking.date, time: booking.time,
        patientName: (booking.patientName || "").trim(),
        patientPhone: (booking.patientPhone || "").trim(),
        notes: (booking.notes || "").trim(),
        status: "requested", createdAt: new Date().toISOString()
      };
      if (!req.service) return Promise.reject(new Error("Choose a service."));
      if (!req.date) return Promise.reject(new Error("Pick a date."));
      if (!req.time) return Promise.reject(new Error("Pick a time."));
      if (!req.patientName) return Promise.reject(new Error("Enter the patient's name."));
      if (!req.patientPhone) return Promise.reject(new Error("Enter a contact phone number."));
      var all = readAll();
      (all[email] = all[email] || []).unshift(req);
      writeAll(all);
      return Promise.resolve(publicBooking(req));
    },
    list: function (email) {
      if (!email) return Promise.resolve([]);
      return Promise.resolve((readAll()[email] || []).map(publicBooking));
    },
    cancel: function (email, id) {
      var all = readAll();
      var arr = all[email] || [];
      var b = arr.find(function (x) { return x.id === id; });
      if (b) b.status = "cancelled";
      writeAll(all);
      return Promise.resolve(true);
    }
  };

  var fb = null;
  function getFb() {
    var S = window.__firebaseSdk;
    if (!S || !window.FIREBASE_CONFIG) return null;
    if (fb) return fb;
    var app = S.initializeApp(window.FIREBASE_CONFIG);
    var db = S.getFirestore(app);
    fb = {
      save: function (email, booking) {
        var u = S.getAuth(app).currentUser;
        if (!u) return Promise.reject(new Error("Sign in to save your bookings."));
        var ref = S.collection(db, "bookings");
        return S.addDoc(ref, Object.assign({}, booking, { uid: u.uid, email: u.email, status: "requested", createdAt: new Date().toISOString() }))
          .then(function (d) { return Object.assign({}, booking, { id: d.id, status: "requested" }); });
      },
      list: function (email) {
        var u = S.getAuth(app).currentUser;
        if (!u) return Promise.resolve([]);
        return S.getDocs(S.query(S.collection(db, "bookings"), S.where("uid", "==", u.uid)))
          .then(function (snap) { return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); });
      },
      cancel: function (email, id) {
        return S.updateDoc(S.doc(db, "bookings", id), { status: "cancelled" });
      }
    };
    return fb;
  }

  window.CNBookings = {
    save: function (email, b) { var f = getFb(); return (f || demo).save(email, b); },
    list: function (email) { var f = getFb(); return (f || demo).list(email); },
    cancel: function (email, id) { var f = getFb(); return (f || demo).cancel(email, id); }
  };
})();

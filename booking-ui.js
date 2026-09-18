/* ============================================================
   Care Navigation — Booking form overlay
   Captures real user details (service, hospital, date/time,
   patient name, phone) and saves to the signed-in account.
   Requires bookings.js; hospital picker uses hospitals.js.
   ============================================================ */
(function () {
  "use strict";
  var hasHospitals = !!window.CNHospitals;
  if (!window.CNBookings) return;
  var B = window.CNBookings;
  var A = window.CNAccounts;

  var css = document.createElement("style");
  css.textContent = `
.cn-bk-overlay{position:fixed;inset:0;z-index:95;display:flex;align-items:flex-start;justify-content:center;background:rgba(10,20,18,.55);backdrop-filter:blur(4px);padding:1.25rem;overflow:auto}
.cn-bk-card{width:100%;max-width:520px;background:var(--card,#fff);color:var(--card-foreground,#111);border:1px solid var(--border,#e5e5e5);border-radius:1.5rem;padding:1.75rem;box-shadow:0 25px 60px rgba(0,0,0,.25);position:relative;font-family:inherit;margin-top:3vh}
.cn-bk-card h2{font-size:1.35rem;font-weight:700;margin:0 0 .2rem}
.cn-bk-sub{margin:0 0 1.1rem;font-size:.85rem;color:var(--muted-foreground,#666)}
.cn-bk-field{margin-bottom:.85rem}
.cn-bk-field label{display:block;font-size:.78rem;font-weight:600;margin-bottom:.3rem}
.cn-bk-field input,.cn-bk-field select,.cn-bk-field textarea{width:100%;box-sizing:border-box;padding:.6rem .75rem;font-size:.9rem;border:1px solid var(--border,#d4d4d4);border-radius:.7rem;background:var(--background,#fff);color:var(--foreground,#111);outline:none;font-family:inherit}
.cn-bk-field textarea{resize:vertical;min-height:56px}
.cn-bk-field input:focus,.cn-bk-field select:focus{border-color:var(--primary,#0f766e)}
.cn-bk-row{display:flex;gap:.75rem}.cn-bk-row>.cn-bk-field{flex:1}
.cn-bk-btn{width:100%;padding:.7rem;font-size:.92rem;font-weight:600;border:none;border-radius:.75rem;cursor:pointer;background:var(--primary,#0f766e);color:var(--primary-foreground,#fff)}
.cn-bk-btn:disabled{opacity:.6;cursor:wait}
.cn-bk-err{display:none;margin:0 0 .8rem;padding:.55rem .75rem;font-size:.8rem;border-radius:.6rem;background:rgba(220,38,38,.1);color:#b91c1c;border:1px solid rgba(220,38,38,.25)}
.cn-bk-ok{display:none;margin:0 0 .8rem;padding:.55rem .75rem;font-size:.8rem;border-radius:.6rem;background:rgba(22,163,74,.1);color:#15803d;border:1px solid rgba(22,163,74,.25)}
.cn-bk-hint{font-size:.72rem;color:var(--muted-foreground,#666);margin-top:.25rem}
.cn-bk-pick{padding:.5rem .75rem;font-size:.8rem;border-radius:.6rem;border:1px solid var(--border,#d4d4d4);background:var(--secondary,#e6f2f0);color:var(--primary,#0f766e);cursor:pointer;font-weight:600;margin-top:.35rem}
.cn-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--muted-foreground,#666);padding:.25rem}
.cn-bk-list{list-style:none;margin:1rem 0 0;padding:0}
.cn-bk-booking{border:1px solid var(--border,#e5e5e5);border-radius:1rem;padding:.85rem 1rem;margin-bottom:.6rem}
.cn-bk-booking .cn-bk-btitle{font-weight:700;font-size:.9rem;display:flex;justify-content:space-between;gap:.5rem}
.cn-bk-booking .cn-bk-bmeta{font-size:.78rem;color:var(--muted-foreground,#666);margin-top:.25rem}
.cn-bk-status{font-size:.68rem;font-weight:700;padding:.1rem .5rem;border-radius:999px;letter-spacing:.04em}
.cn-bk-status.requested{background:rgba(234,179,8,.15);color:#a16207}
.cn-bk-status.cancelled{background:rgba(220,38,38,.12);color:#b91c1c}
.cn-bk-cancel{background:none;border:none;color:#b91c1c;font-size:.75rem;cursor:pointer;font-weight:600;padding:0;margin-top:.35rem}
  `;
  document.head.appendChild(css);

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }

  function closeOverlay() { document.querySelectorAll(".cn-bk-overlay").forEach(function (o) { o.remove(); }); }

  var SERVICES = [
    "Hospital Visit Companion", "Medicine Pickup", "Paperwork & Admission",
    "Transport Coordination", "Pharmacy Errand", "Wayfinding Support", "Care Coordinator Bundle"
  ];

  function openBooking(preset) {
    closeOverlay();
    if (!window.__cnUser) { if (window.CNOpenAuth) return window.CNOpenAuth("signin"); }
    var overlay = h("div", { class: "cn-bk-overlay" });
    var card = h("div", { class: "cn-bk-card", role: "dialog", "aria-modal": "true" });
    card.appendChild(h("button", { class: "cn-close", "aria-label": "Close", onclick: closeOverlay }, ["✕"]));
    var title = h("h2"); title.textContent = "Book assistance";
    var sub = h("p", { class: "cn-bk-sub" });
    sub.textContent = "Real details, saved to your account. Our team coordinates the rest.";
    card.appendChild(title); card.appendChild(sub);

    var err = h("p", { class: "cn-bk-err" });
    var ok = h("p", { class: "cn-bk-ok" });

    function field(labelText, inputEl) {
      var f = h("div", { class: "cn-bk-field" });
      var l = h("label"); l.textContent = labelText;
      f.appendChild(l); f.appendChild(inputEl);
      return f;
    }

    var serviceS = h("select");
    SERVICES.forEach(function (s) { var o = h("option", { value: s }); o.textContent = s; serviceS.appendChild(o); });
    if (preset && preset.service) serviceS.value = preset.service;

    var hospW = h("div");
    var hospI = h("input", { type: "text", placeholder: "Hospital name", value: (preset && preset.hospital) || "" });
    hospW.appendChild(hospI);
    if (hasHospitals) {
      var pickBtn = h("button", { class: "cn-bk-pick", type: "button" }, ["🔍 Find a real hospital"]);
      pickBtn.addEventListener("click", function () {
        if (!window.CNOpenHospitalFinder) return;
        window.CNOpenHospitalFinder();
        var obs = new MutationObserver(function () {
          var cards = document.querySelectorAll(".cn-hf-item");
          if (!cards.length) return;
          obs.disconnect();
          var note = h("p", { class: "cn-bk-hint" }, ["Tip: click a hospital's name in the finder to copy it here."]);
          hospW.appendChild(note);
          document.querySelectorAll(".cn-hf-item .cn-hf-name").forEach(function (n) {
            n.style.cursor = "pointer"; n.title = "Click to select this hospital";
            n.addEventListener("click", function () {
              var name = n.childNodes[0].textContent.trim();
              hospI.value = name;
              var addr = n.parentElement.querySelector(".cn-hf-addr");
              hospI.dataset.addr = addr ? addr.textContent : "";
              closeOverlaySafe();
            });
          });
          function closeOverlaySafe() {
            var hf = document.querySelector(".cn-hf-overlay"); if (hf) hf.remove();
            note.textContent = "Selected: " + hospI.value;
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
      });
      hospW.appendChild(pickBtn);
    }

    var dateI = h("input", { type: "date" });
    var timeI = h("input", { type: "time" });
    var row = h("div", { class: "cn-bk-row" });
    row.appendChild(field("Date", dateI)); row.appendChild(field("Time", timeI));

    var nameI = h("input", { type: "text", placeholder: "Patient's full name", value: window.__cnUser ? (window.__cnUser.fullName || "") : "" });
    var phoneI = h("input", { type: "tel", placeholder: "Contact phone", value: window.__cnUser ? (window.__cnUser.phone || "") : "" });
    var notesI = h("textarea", { placeholder: "Anything we should know? (wheelchair, documents, language…)" });

    var submit = h("button", { class: "cn-bk-btn", type: "submit" }, ["Request booking"]);

    var form = h("form", { onsubmit: function (ev) {
      ev.preventDefault();
      err.style.display = "none"; ok.style.display = "none";
      submit.disabled = true; submit.textContent = "Saving…";
      B.save(window.__cnUser ? window.__cnUser.email : null, {
        service: serviceS.value,
        hospital: hospI.value,
        hospitalAddr: hospI.dataset.addr || "",
        date: dateI.value, time: timeI.value,
        patientName: nameI.value, patientPhone: phoneI.value,
        notes: notesI.value
      }).then(function (b) {
        ok.textContent = "Booking requested! Your ID is " + b.id + ". We'll confirm shortly.";
        ok.style.display = "block";
        submit.disabled = false; submit.textContent = "Request booking";
        form.reset();
      }).catch(function (ex) {
        err.textContent = ex.message || "Could not save booking.";
        err.style.display = "block";
        submit.disabled = false; submit.textContent = "Request booking";
      });
    } });

    form.appendChild(field("Service", serviceS));
    form.appendChild(field("Hospital", hospW));
    form.appendChild(row);
    form.appendChild(field("Patient's name", nameI));
    form.appendChild(field("Contact phone", phoneI));
    form.appendChild(field("Notes", notesI));
    form.appendChild(err); form.appendChild(ok); form.appendChild(submit);
    card.appendChild(form);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) closeOverlay(); });
    document.body.appendChild(overlay);
  }

  function openMyBookings() {
    closeOverlay();
    if (!window.__cnUser) { if (window.CNOpenAuth) return window.CNOpenAuth("signin"); return; }
    var overlay = h("div", { class: "cn-bk-overlay" });
    var card = h("div", { class: "cn-bk-card", role: "dialog", "aria-modal": "true" });
    card.appendChild(h("button", { class: "cn-close", "aria-label": "Close", onclick: closeOverlay }, ["✕"]));
    var title = h("h2"); title.textContent = "My bookings";
    card.appendChild(title);
    var listEl = h("ul", { class: "cn-bk-list" });
    card.appendChild(listEl);
    var status = h("p", { class: "cn-bk-sub", style: "margin-top:.75rem" });
    status.textContent = "Loading…";
    card.appendChild(status);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) closeOverlay(); });
    document.body.appendChild(overlay);

    B.list(window.__cnUser.email).then(function (bookings) {
      status.style.display = "none";
      listEl.textContent = "";
      if (!bookings.length) {
        var empty = h("li", { class: "cn-bk-sub" }, ["No bookings yet. Book assistance to see it here."]);
        listEl.appendChild(empty);
        return;
      }
      bookings.forEach(function (b) {
        var li = h("li", { class: "cn-bk-booking" });
        var t = h("div", { class: "cn-bk-btitle" });
        var n = h("span"); n.textContent = b.service + (b.hospital ? " · " + b.hospital : "");
        var s = h("span", { class: "cn-bk-status " + (b.status || "requested") }); s.textContent = (b.status || "requested").toUpperCase();
        t.appendChild(n); t.appendChild(s);
        li.appendChild(t);
        li.appendChild(h("div", { class: "cn-bk-bmeta" }, [
          (b.date || "") + " " + (b.time || "") + " · Patient: " + b.patientName + " · ID " + b.id
        ]));
        if (b.status !== "cancelled") {
          var c = h("button", { class: "cn-bk-cancel" }, ["Cancel booking"]);
          c.addEventListener("click", function () {
            B.cancel(window.__cnUser.email, b.id).then(function () { openMyBookings(); });
          });
          li.appendChild(c);
        }
        listEl.appendChild(li);
      });
    });
  }

  /* ---------- expose + hook site links ---------- */
  window.CNOpenBooking = openBooking;
  window.CNOpenMyBookings = openMyBookings;

  function bind() {
    document.querySelectorAll('a[href="/book-assistance"]').forEach(function (a) {
      if (a.dataset.cnBk) return;
      a.dataset.cnBk = "1";
      a.addEventListener("click", function (ev) { ev.preventDefault(); openBooking(); });
    });
    document.querySelectorAll('a[href="/my-bookings"]').forEach(function (a) {
      if (a.dataset.cnBkL) return;
      a.dataset.cnBkL = "1";
      a.addEventListener("click", function (ev) { ev.preventDefault(); openMyBookings(); });
    });
  }
  var mo = new MutationObserver(function () { bind(); });
  function start() { bind(); mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

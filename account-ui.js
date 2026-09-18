/* ============================================================
   Care Navigation — Account UI overlay
   Injects: Sign in button (header, top-right), auth modal
   (login + create account + Google), and the account menu
   (Your account / Login & Security / Contact us / Payment).
   Requires accounts.js (loaded before this file).
   ============================================================ */
(function () {
  "use strict";
  if (!window.CNAccounts) return;
  var A = window.CNAccounts;

  var css = document.createElement("style");
  css.textContent = `
.cn-auth-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(10,20,18,.55);backdrop-filter:blur(4px);padding:1rem}
.cn-auth-card{width:100%;max-width:420px;max-height:92vh;overflow:auto;background:var(--card,#fff);color:var(--card-foreground,#111);border:1px solid var(--border,#e5e5e5);border-radius:1.5rem;padding:1.75rem;box-shadow:0 25px 60px rgba(0,0,0,.25);font-family:inherit}
.cn-auth-card h2{font-size:1.35rem;font-weight:700;margin:0 0 .25rem}
.cn-auth-card p.cn-sub{margin:0 0 1.25rem;font-size:.85rem;color:var(--muted-foreground,#666)}
.cn-field{margin-bottom:.9rem}
.cn-field label{display:block;font-size:.78rem;font-weight:600;margin-bottom:.3rem;color:var(--foreground,#111)}
.cn-field input,.cn-field select{width:100%;box-sizing:border-box;padding:.65rem .8rem;font-size:.9rem;border:1px solid var(--border,#d4d4d4);border-radius:.75rem;background:var(--background,#fff);color:var(--foreground,#111);outline:none}
.cn-field input:focus{border-color:var(--primary,#0f766e)}
.cn-btn{width:100%;padding:.7rem;font-size:.92rem;font-weight:600;border:none;border-radius:.75rem;cursor:pointer;transition:filter .15s}
.cn-btn-primary{background:var(--primary,#0f766e);color:var(--primary-foreground,#fff)}
.cn-btn-primary:hover{filter:brightness(1.08)}
.cn-btn-google{background:var(--background,#fff);color:var(--foreground,#111);border:1px solid var(--border,#d4d4d4);display:flex;align-items:center;justify-content:center;gap:.5rem}
.cn-btn-ghost{background:transparent;color:var(--muted-foreground,#666)}
.cn-auth-error{display:none;margin:0 0 .9rem;padding:.6rem .8rem;font-size:.82rem;border-radius:.6rem;background:rgba(220,38,38,.1);color:#b91c1c;border:1px solid rgba(220,38,38,.25)}
.cn-auth-ok{display:none;margin:0 0 .9rem;padding:.6rem .8rem;font-size:.82rem;border-radius:.6rem;background:rgba(22,163,74,.1);color:#15803d;border:1px solid rgba(22,163,74,.25)}
.cn-auth-switch{text-align:center;font-size:.82rem;margin:.9rem 0 0;color:var(--muted-foreground,#666)}
.cn-auth-switch button{background:none;border:none;color:var(--primary,#0f766e);font-weight:600;cursor:pointer;font-size:.82rem}
.cn-mode-badge{display:inline-block;font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:.15rem .5rem;border-radius:999px;background:var(--secondary,#e6f2f0);color:var(--primary,#0f766e);margin-bottom:.75rem}
.cn-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--muted-foreground,#666);padding:.25rem}
.cn-account-menu{position:fixed;z-index:99;min-width:230px;background:var(--card,#fff);color:var(--card-foreground,#111);border:1px solid var(--border,#e5e5e5);border-radius:1rem;box-shadow:0 20px 50px rgba(0,0,0,.2);overflow:hidden;animation:cn-pop .15s ease-out}
@keyframes cn-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.cn-menu-head{padding:.9rem 1rem;border-bottom:1px solid var(--border,#eee)}
.cn-menu-head .cn-name{font-weight:700;font-size:.9rem}
.cn-menu-head .cn-mail{font-size:.75rem;color:var(--muted-foreground,#666)}
.cn-menu-item{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:.6rem;padding:.65rem 1rem;font-size:.86rem;background:none;border:none;cursor:pointer;text-align:left;color:inherit}
.cn-menu-item:hover{background:var(--muted,#f5f5f5)}
.cn-menu-item.cn-danger{color:#b91c1c}
.cn-signin-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.5rem .95rem;font-size:.85rem;font-weight:600;border-radius:.75rem;background:var(--secondary,#e6f2f0);color:var(--primary,#0f766e);border:none;cursor:pointer;transition:filter .15s}
.cn-signin-btn:hover{filter:brightness(.97)}
.cn-avatar{width:1.75rem;height:1.75rem;border-radius:999px;background:var(--primary,#0f766e);color:var(--primary-foreground,#fff);display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700}
.cn-panel-list{list-style:none;margin:0;padding:0}
.cn-panel-list li{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;border-bottom:1px dashed var(--border,#eee);font-size:.88rem}
.cn-panel-list li span:first-child{color:var(--muted-foreground,#666)}
.cn-panel-list li span:last-child{font-weight:600;text-align:right}
  `;
  document.head.appendChild(css);

  var user = null;
  var btnRef = null;

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
  function showErr(box, msg) { box.textContent = msg; box.style.display = "block"; }
  function hideMsgs(e, o) { if (e) e.style.display = "none"; if (o) o.style.display = "none"; }

  /* ---------- header button ---------- */
  function mountHeaderButton() {
    var host = document.querySelector('header [data-testid="button-toggle-theme"]');
    if (!host || !host.parentElement) { setTimeout(mountHeaderButton, 600); return; }
    var bar = host.parentElement; // contains theme btn + Get assistance + hamburger
    var btn = h("button", { class: "cn-signin-btn", "data-testid": "button-account", "aria-label": "Account" });
    btnRef = btn;
    renderBtn(btn);
    bar.insertBefore(btn, bar.firstChild);
  }
  function renderBtn(btn) {
    btn.textContent = "";
    var nav = document.querySelector('nav[aria-label="Mobile navigation"]');
    if (nav) enhanceMobileNav(nav);
    if (user) {
      var av = h("span", { class: "cn-avatar" });
      av.textContent = (user.fullName || user.email || "?").trim().charAt(0).toUpperCase();
      var name = h("span");
      name.textContent = (user.fullName || user.email || "Account").split(" ")[0];
      btn.appendChild(av); btn.appendChild(name);
      btn.onclick = openAccountMenu;
    } else {
      btn.textContent = "Sign in";
      btn.onclick = function () { openAuth("signin"); };
    }
  }

  /* ---------- auth modal ---------- */
  function openAuth(mode, panel) {
    closeOverlay();
    var err = h("p", { class: "cn-auth-error" });
    var ok = h("p", { class: "cn-auth-ok" });
    var overlay = h("div", { class: "cn-auth-overlay" });
    var card = h("div", { class: "cn-auth-card", role: "dialog", "aria-modal": "true", style: "position:relative" });

    function closeBtn() {
      return h("button", { class: "cn-close", "aria-label": "Close", onclick: closeOverlay }, ["✕"]);
    }

    if (panel === "security") return openSecurity();
    if (panel === "payment") return openPayment();
    if (panel === "account") return openYourAccount();

    var isSignup = mode === "signup";
    var title = h("h2"); title.textContent = isSignup ? "Create your account" : "Welcome back";
    var sub = h("p", { class: "cn-sub" });
    sub.textContent = isSignup
      ? "Save your details for faster bookings and family updates."
      : "Sign in to manage your bookings and account.";

    var modeBadge = h("span", { class: "cn-mode-badge" });
    modeBadge.textContent = A.mode() === "firebase" ? "Secure account" : "Demo mode — stored on this device";

    var nameF = h("div", { class: "cn-field" });
    var nameL = h("label"); nameL.textContent = "Full name";
    var nameI = h("input", { type: "text", autocomplete: "name", placeholder: "e.g. Aarav Sharma" });
    nameF.appendChild(nameL); nameF.appendChild(nameI);

    var emailF = h("div", { class: "cn-field" });
    var emailL = h("label"); emailL.textContent = "Email (Gmail)";
    var emailI = h("input", { type: "email", autocomplete: "email", placeholder: "you@gmail.com" });
    emailF.appendChild(emailL); emailF.appendChild(emailI);

    var phoneF = h("div", { class: "cn-field" });
    var phoneL = h("label"); phoneL.textContent = "Phone number";
    var phoneI = h("input", { type: "tel", autocomplete: "tel", placeholder: "+91 98765 43210" });
    phoneF.appendChild(phoneL); phoneF.appendChild(phoneI);

    var passF = h("div", { class: "cn-field" });
    var passL = h("label"); passL.textContent = "Password";
    var passI = h("input", { type: "password", autocomplete: isSignup ? "new-password" : "current-password", placeholder: isSignup ? "At least 8 characters" : "Your password" });
    passF.appendChild(passL); passF.appendChild(passI);

    var submit = h("button", { class: "cn-btn cn-btn-primary", type: "submit" });
    submit.textContent = isSignup ? "Create account" : "Sign in";

    var form = h("form", { class: "cn-auth-form", onsubmit: function (ev) {
      ev.preventDefault(); hideMsgs(err, ok);
      submit.disabled = true; submit.textContent = isSignup ? "Creating…" : "Signing in…";
      var p = isSignup
        ? A.signUp({ fullName: nameI.value, email: emailI.value, phone: phoneI.value, password: passI.value })
        : A.signIn(emailI.value, passI.value);
      p.then(function (u) {
        user = u; window.__cnUser = u; closeOverlay(); renderBtn(btnRef); announce("Signed in as " + (u.fullName || u.email));
      }).catch(function (ex) {
        showErr(err, ex && ex.message ? ex.message : "Something went wrong.");
        submit.disabled = false; submit.textContent = isSignup ? "Create account" : "Sign in";
      });
    } });

    if (isSignup) form.appendChild(nameF);
    form.appendChild(emailF);
    if (isSignup) form.appendChild(phoneF);
    form.appendChild(passF);
    form.appendChild(err); form.appendChild(ok); form.appendChild(submit);

    var switchLine = h("p", { class: "cn-auth-switch" });
    var swBtn = h("button", { type: "button" });
    swBtn.textContent = isSignup ? "Sign in instead" : "Create an account";
    swBtn.onclick = function () { openAuth(isSignup ? "signin" : "signup"); };
    switchLine.appendChild(document.createTextNode(isSignup ? "Already have an account? " : "New to Care Navigation? "));
    switchLine.appendChild(swBtn);

    var googleBtn = h("button", { class: "cn-btn cn-btn-google", type: "button", onclick: function () {
      hideMsgs(err, ok);
      A.signInWithGoogle().then(function (u) { user = u; window.__cnUser = u; closeOverlay(); renderBtn(btnRef); announce("Signed in as " + (u.fullName || u.email)); })
        .catch(function (ex) { showErr(err, ex && ex.message ? ex.message : "Google sign-in failed."); });
    } });
    var gIcon = h("span", { "aria-hidden": "true" });
    gIcon.innerHTML = '<svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.5c-.3 2.1-1.6 5.2-4.7 7.3l7.6 5.9c4.5-4.2 6.7-10.3 6.7-17.5z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.6l-7.6-5.9c-2 1.4-4.7 2.4-7.7 2.4-6.3 0-11.7-3.7-13.6-9l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
    googleBtn.insertBefore(gIcon, googleBtn.firstChild);
    googleBtn.appendChild(document.createTextNode("Continue with Google"));

    card.appendChild(closeBtn());
    card.appendChild(modeBadge);
    card.appendChild(title); card.appendChild(sub);
    card.appendChild(googleBtn);
    var orDiv = h("p", { class: "cn-auth-switch" }); orDiv.textContent = "or with email";
    card.appendChild(orDiv);
    card.appendChild(form);
    card.appendChild(switchLine);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) closeOverlay(); });
    document.body.appendChild(overlay);
    (isSignup ? nameI : emailI).focus();
  }

  /* ---------- account menu ---------- */
  var menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener("click", outsideClose); } }
  function outsideClose(ev) { if (menuEl && !menuEl.contains(ev.target)) closeMenu(); }
  function openAccountMenu(ev) {
    closeMenu();
    var rect = ev.currentTarget.getBoundingClientRect();
    var m = h("div", { class: "cn-account-menu", role: "menu" });
    var head = h("div", { class: "cn-menu-head" });
    var nm = h("div", { class: "cn-name" }); nm.textContent = user.fullName || "Account";
    var ml = h("div", { class: "cn-mail" }); ml.textContent = user.email || "";
    head.appendChild(nm); head.appendChild(ml);
    m.appendChild(head);

    function item(label, fn, testid, danger) {
      var b = h("button", { class: "cn-menu-item" + (danger ? " cn-danger" : ""), "data-testid": testid, onclick: function () { closeMenu(); fn(); } });
      b.textContent = label; return b;
    }
    m.appendChild(item("👤  Your account", openYourAccount, "menu-your-account"));
    m.appendChild(item("🔐  Login & security", openSecurity, "menu-login-security"));
    m.appendChild(item("💬  Contact us", openContact, "menu-contact-us"));
    m.appendChild(item("💳  Payment options", openPayment, "menu-payment-options"));
    m.appendChild(item("Sign out", function () {
      A.signOut().then(function () { user = null; window.__cnUser = null; renderBtn(btnRef); announce("Signed out"); });
    }, "menu-signout", true));

    document.body.appendChild(m);
    var top = rect.bottom + 8;
    m.style.top = top + "px";
    m.style.right = Math.max(8, window.innerWidth - rect.right) + "px";
    menuEl = m;
    setTimeout(function () { document.addEventListener("click", outsideClose); }, 0);
  }

  /* ---------- panels ---------- */
  function basePanel(titleText) {
    closeOverlay();
    var overlay = h("div", { class: "cn-auth-overlay" });
    var card = h("div", { class: "cn-auth-card", role: "dialog", "aria-modal": "true", style: "position:relative" });
    card.appendChild(h("button", { class: "cn-close", "aria-label": "Close", onclick: closeOverlay }, ["✕"]));
    var badge = h("span", { class: "cn-mode-badge" });
    badge.textContent = A.mode() === "firebase" ? "Secure account" : "Demo mode — stored on this device";
    var t = h("h2"); t.textContent = titleText;
    card.appendChild(badge); card.appendChild(t);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) closeOverlay(); });
    document.body.appendChild(overlay);
    return { overlay: overlay, card: card };
  }
  function listRow(k, v) {
    var li = h("li");
    var a = h("span"); a.textContent = k;
    var b = h("span"); b.textContent = v;
    li.appendChild(a); li.appendChild(b);
    return li;
  }

  function openYourAccount() {
    if (!user) return openAuth("signin");
    var p = basePanel("Your account");
    var ul = h("ul", { class: "cn-panel-list", style: "margin-top:1rem" });
    ul.appendChild(listRow("Name", user.fullName || "—"));
    ul.appendChild(listRow("Email (Gmail)", user.email || "—"));
    ul.appendChild(listRow("Phone", user.phone || "—"));
    ul.appendChild(listRow("Account type", user.provider === "google" ? "Google" : "Email & password"));
    p.card.appendChild(ul);

    var editT = h("button", { class: "cn-btn cn-btn-primary", style: "margin-top:1.25rem" });
    editT.textContent = "Edit details";
    var editWrap = h("div", { style: "display:none;margin-top:1rem" });
    var nF = h("div", { class: "cn-field" }); var nL = h("label"); nL.textContent = "Full name"; var nI = h("input", { type: "text", value: user.fullName || "" });
    nF.appendChild(nL); nF.appendChild(nI);
    var phF = h("div", { class: "cn-field" }); var phL = h("label"); phL.textContent = "Phone"; var phI = h("input", { type: "tel", value: user.phone || "" });
    phF.appendChild(phL); phF.appendChild(phI);
    var eErr = h("p", { class: "cn-auth-error" });
    var eOk = h("p", { class: "cn-auth-ok" });
    var save = h("button", { class: "cn-btn cn-btn-primary" }); save.textContent = "Save changes";
    save.onclick = function () {
      hideMsgs(eErr, eOk);
      A.updateProfile(user.email, { fullName: nI.value, phone: phI.value }).then(function (u) {
        user = u; renderBtn(btnRef); eOk.textContent = "Details updated."; eOk.style.display = "block";
      }).catch(function (ex) { showErr(eErr, ex.message || "Update failed."); });
    };
    editWrap.appendChild(nF); editWrap.appendChild(phF); editWrap.appendChild(eErr); editWrap.appendChild(eOk); editWrap.appendChild(save);
    editT.onclick = function () { editWrap.style.display = editWrap.style.display === "none" ? "block" : "none"; };
    p.card.appendChild(editT); p.card.appendChild(editWrap);
  }

  function openSecurity() {
    if (!user) return openAuth("signin");
    var p = basePanel("Login & security");
    var intro = h("p", { class: "cn-sub" });
    intro.textContent = "Your password is " + (A.mode() === "firebase"
      ? "handled securely by Firebase Authentication — we never see or store it."
      : "stored only on this device as a salted SHA-256 hash — never in plain text.");
    p.card.appendChild(intro);

    var cF = h("div", { class: "cn-field" }); var cL = h("label"); cL.textContent = "Current password"; var cI = h("input", { type: "password", autocomplete: "current-password" });
    cF.appendChild(cL); cF.appendChild(cI);
    var nF = h("div", { class: "cn-field" }); var nL = h("label"); nL.textContent = "New password"; var nI = h("input", { type: "password", autocomplete: "new-password", placeholder: "At least 8 characters" });
    nF.appendChild(nL); nF.appendChild(nI);
    var n2F = h("div", { class: "cn-field" }); var n2L = h("label"); n2L.textContent = "Confirm new password"; var n2I = h("input", { type: "password", autocomplete: "new-password" });
    n2F.appendChild(n2L); n2F.appendChild(n2I);
    var err = h("p", { class: "cn-auth-error" });
    var ok = h("p", { class: "cn-auth-ok" });
    var btn = h("button", { class: "cn-btn cn-btn-primary" }); btn.textContent = "Update password";
    btn.onclick = function () {
      hideMsgs(err, ok);
      if (nI.value !== n2I.value) return showErr(err, "New passwords do not match.");
      btn.disabled = true;
      A.changePassword(user.email, cI.value, nI.value).then(function () {
        ok.textContent = "Password updated successfully."; ok.style.display = "block";
        cI.value = nI.value = n2I.value = ""; btn.disabled = false;
      }).catch(function (ex) { showErr(err, ex.message || "Could not update password."); btn.disabled = false; });
    };
    p.card.appendChild(cF); p.card.appendChild(nF); p.card.appendChild(n2F); p.card.appendChild(err); p.card.appendChild(ok); p.card.appendChild(btn);
    if (user.provider === "google") {
      btn.disabled = true; btn.title = "Google accounts manage passwords with Google.";
      var note = h("p", { class: "cn-sub", style: "margin-top:.75rem" }); note.textContent = "You signed in with Google — manage your password from your Google Account.";
      p.card.appendChild(note);
    }
  }

  function openContact() {
    var p = basePanel("Contact us");
    var ul = h("ul", { class: "cn-panel-list", style: "margin-top:1rem" });
    ul.appendChild(listRow("Support hours", "8 AM – 9 PM, every day"));
    ul.appendChild(listRow("Booking help", "9073922950"));
    ul.appendChild(listRow("Payments help", "8126094222"));
    ul.appendChild(listRow("Email", "support@carenavigation.example"));
    p.card.appendChild(ul);
    var note = h("p", { class: "cn-sub", style: "margin-top:1rem" });
    note.textContent = "These are coordination support contacts — not emergency numbers. In an emergency, call 112 / 108 (India) or your local emergency service.";
    p.card.appendChild(note);
  }

  function openPayment() {
    if (!user) return openAuth("signin");
    var p = basePanel("Payment options");
    var err = h("p", { class: "cn-auth-error" });
    var ok = h("p", { class: "cn-auth-ok" });

    var typeF = h("div", { class: "cn-field" }); var typeL = h("label"); typeL.textContent = "Method";
    var typeS = h("select");
    ["card", "upi"].forEach(function (t) { var o = h("option", { value: t }); o.textContent = t === "card" ? "Card" : "UPI"; typeS.appendChild(o); });
    typeF.appendChild(typeL); typeF.appendChild(typeS);

    var numF = h("div", { class: "cn-field" }); var numL = h("label"); numL.textContent = "Card number"; var numI = h("input", { type: "text", inputmode: "numeric", placeholder: "•••• •••• •••• 4242" });
    numF.appendChild(numL); numF.appendChild(numI);
    var holdF = h("div", { class: "cn-field" }); var holdL = h("label"); holdL.textContent = "Name on card"; var holdI = h("input", { type: "text" });
    holdF.appendChild(holdL); holdF.appendChild(holdI);
    var expF = h("div", { class: "cn-field" }); var expL = h("label"); expL.textContent = "Expiry (MM/YY)"; var expI = h("input", { type: "text", placeholder: "12/28" });
    expF.appendChild(expL); expF.appendChild(expI);
    var upiF = h("div", { class: "cn-field", style: "display:none" }); var upiL = h("label"); upiL.textContent = "UPI ID"; var upiI = h("input", { type: "text", placeholder: "name@upi" });
    upiF.appendChild(upiL); upiF.appendChild(upiI);
    typeS.onchange = function () {
      var upi = typeS.value === "upi";
      upiF.style.display = upi ? "block" : "none";
      [numF, holdF, expF].forEach(function (x) { x.style.display = upi ? "none" : "block"; });
    };

    var note = h("p", { class: "cn-sub" });
    note.textContent = "We never store your full card number — only a label and last 4 digits, saved with your account.";
    var save = h("button", { class: "cn-btn cn-btn-primary" }); save.textContent = "Save payment method";
    save.onclick = function () {
      hideMsgs(err, ok);
      save.disabled = true;
      A.savePaymentMethod(user.email, {
        type: typeS.value, number: numI.value, holder: holdI.value, expiry: expI.value, upiId: upiI.value, label: typeS.value === "card" ? "Card •" + (numI.value || "").replace(/\D/g, "").slice(-4) : "UPI"
      }).then(function (m) {
        ok.textContent = "Saved: " + (m.label || "payment method"); ok.style.display = "block"; save.disabled = false;
      }).catch(function (ex) { showErr(err, ex.message || "Could not save."); save.disabled = false; });
    };
    p.card.appendChild(numF); p.card.appendChild(holdF); p.card.appendChild(expF); p.card.appendChild(upiF);
    p.card.appendChild(typeF); p.card.appendChild(note); p.card.appendChild(err); p.card.appendChild(ok); p.card.appendChild(save);
  }

  /* ---------- misc ---------- */
  function closeOverlay() {
    document.querySelectorAll(".cn-auth-overlay").forEach(function (o) { o.remove(); });
  }
  function announce(msg) {
    var t = h("div", { role: "status", style: "position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);z-index:200;background:var(--primary,#0f766e);color:#fff;padding:.6rem 1.1rem;border-radius:999px;font-size:.85rem;box-shadow:0 10px 30px rgba(0,0,0,.25)" });
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  A.getCurrentUser().then(function (u) { user = u; window.__cnUser = u; mountHeaderButton(); });

  /* ---------- hamburger (three-line) menu items ---------- */
  function closeMobileNav() {
    var t = document.querySelector('[data-testid="button-mobile-menu"]');
    if (t && t.getAttribute("aria-expanded") !== "false") t.click();
  }
  function enhanceMobileNav(nav) {
    var stateKey = user ? (user.email || user.uid) : "anon";
    if (nav.getAttribute("data-cn-user") === stateKey) return;
    nav.setAttribute("data-cn-user", stateKey);
    nav.querySelectorAll(".cn-mobile-item").forEach(function (x) { x.remove(); });
    var div = nav.querySelector(".cn-mobile-sep");
    if (!div) { div = h("div", { class: "cn-mobile-sep", style: "border-top:1px solid var(--border,#e5e5e5);margin:.5rem 0" }); nav.appendChild(div); }
    function addItem(label, fn, testid) {
      var b = h("button", { class: "cn-mobile-item cn-menu-item", style: "width:100%;padding:.7rem .75rem;font-size:.9rem;font-weight:600", "data-testid": testid });
      b.textContent = label;
      b.addEventListener("click", function () { closeMobileNav(); setTimeout(fn, 150); });
      nav.appendChild(b);
    }
    addItem(user ? "👤  Your account" : "Sign in / Create account", function () { openYourAccount(); }, "mobile-your-account");
    addItem("🛏  Book assistance", function () { if (window.CNOpenBooking) window.CNOpenBooking(); }, "mobile-book-assistance");
    addItem("📋  My bookings", function () { if (window.CNOpenMyBookings) window.CNOpenMyBookings(); }, "mobile-my-bookings");
    addItem("🔍  Find real hospitals", function () { if (window.CNOpenHospitalFinder) window.CNOpenHospitalFinder(); }, "mobile-find-hospitals");
    addItem("🔐  Login & security", openSecurity, "mobile-login-security");
    addItem("💬  Contact us", openContact, "mobile-contact-us");
    addItem("💳  Payment options", openPayment, "mobile-payment-options");
    if (user) addItem("Sign out", function () { A.signOut().then(function () { user = null; window.__cnUser = null; renderBtn(btnRef); announce("Signed out"); }); }, "mobile-signout");
  }
  var mo = new MutationObserver(function () {
    var nav = document.querySelector('nav[aria-label="Mobile navigation"]');
    if (nav) enhanceMobileNav(nav);
  });
  document.addEventListener("DOMContentLoaded", function () {
    mo.observe(document.body, { childList: true, subtree: true });
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();

/* ============================================================
   Care Navigation — Assistant (upgraded multi-section chat)
   - Persistent chat history (per browser, per account email)
   - Sidebar with past conversations; new-chat button
   - Tabs: Chat · History · Suggestions
   - Rich suggestion chips incl. hospitals, prices, discounts
   - Gemini-powered replies (window.geminiChat), emergency guard
   ============================================================ */
(function () {
  "use strict";
  if (!window.geminiChat) return;

  var LS_KEY = "cn_chat_threads_v1";
  var OPEN = false;

  var SUGGESTION_GROUPS = [
    { title: "Hospitals & care", items: [
      { label: "🏥 Find a hospital near me", q: "Help me find a good hospital near my location. How do I use the hospital finder?" },
      { label: "🚑 Nearest 24×7 emergency", q: "Which hospitals nearby have 24x7 emergency departments, and how do I find them fast?" },
      { label: "🧭 How do I reach the hospital?", q: "I need help planning transport to a hospital visit. What options does Care Navigation offer?" }
    ]},
    { title: "Prices & discounts", items: [
      { label: "💰 Service price list", q: "List all Care Navigation services with their starting prices in rupees." },
      { label: "🎯 Discounts & offers", q: "Are there any discounts, offers, or cheaper bundles available? How can I save on the assistance fee?" },
      { label: "🧾 What does the fee include?", q: "Explain exactly what the Care Navigation assistance fee includes and what costs extra." },
      { label: "💳 Payment options", q: "What payment methods can I use — UPI, card, or cash? Is payment upfront or after service?" }
    ]},
    { title: "Bookings & account", items: [
      { label: "📖 Step-by-step booking", q: "Walk me through the booking process step by step, from choosing a service to confirmation." },
      { label: "✏️ Change or cancel", q: "How do I change or cancel a booking after it is confirmed?" },
      { label: "👨‍👩‍👧 Book for a family member", q: "Can I book an assistant for my parent or another family member? What details do you need?" },
      { label: "🛡 Safety & verification", q: "How are assistants verified? What safety measures are in place during a hospital visit?" }
    ]}
  ];

  /* ---------- storage ---------- */
  function loadThreads() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveThreads(t) { localStorage.setItem(LS_KEY, JSON.stringify(t)); }
  function currentUserEmail() { return window.__cnUser ? window.__cnUser.email : "guest"; }
  function threadsFor(email) {
    return loadThreads().filter(function (t) { return t.user === email; });
  }
  function newThreadObj() {
    return { id: "t" + Date.now().toString(36), user: currentUserEmail(), title: "New conversation", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }

  function fmtTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function esc(s) {
    return ("" + s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- styles ---------- */
  var css = document.createElement("style");
  css.textContent = `
:root{--cn-card:#ffffff;--cn-bg:#ffffff;--cn-text:#141414;--cn-text-muted:#666666;--cn-border:#e2e5e9;--cn-muted:#f3f4f6;--cn-primary:#0f766e;--cn-primary-text:#ffffff;--cn-secondary:#e6f2f0}
.dark{--cn-card:#192a34;--cn-bg:#101f28;--cn-text:#e8f0f2;--cn-text-muted:#aab7ba;--cn-border:#30444f;--cn-muted:#253e4b;--cn-primary:#55cebc;--cn-primary-text:#101f28;--cn-secondary:#2d4852}
.cn-chat-backdrop{position:fixed;inset:0;z-index:98;background:rgba(8,15,14,0.97);backdrop-filter:blur(3px)}
.cn-chat-shell{position:fixed;z-index:99;inset:auto 12px 12px 12px;top:auto;height:min(620px,calc(100dvh - 24px));display:flex;background:var(--cn-card,#fff);color:var(--cn-text,#111);border:1px solid var(--cn-border,#e5e5e5);border-radius:1.25rem;box-shadow:0 30px 80px rgba(0,0,0,.35);overflow:hidden;font-family:inherit;animation:cnChatUp .18s ease-out}
@media(min-width:640px){.cn-chat-shell{left:20px;right:auto;width:820px;max-width:calc(100vw - 40px)}}
@keyframes cnChatUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.cn-chat-side{width:240px;flex-shrink:0;border-right:1px solid var(--cn-border,#e5e5e5);background:var(--cn-secondary,#eef6f4);display:flex;flex-direction:column}
@media(max-width:639px){.cn-chat-side{display:none}}
.cn-chat-side-head{padding:.9rem;border-bottom:1px solid var(--cn-border,#e5e5e5);display:flex;align-items:center;justify-content:space-between}
.cn-chat-side-head .t{font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--cn-primary,#0f766e)}
.cn-newchat{background:var(--cn-primary,#0f766e);color:var(--cn-primary-text,#fff);border:none;border-radius:.6rem;padding:.35rem .6rem;font-size:.72rem;font-weight:700;cursor:pointer}
.cn-threads{flex:1;overflow:auto;padding:.5rem}
.cn-thread-item{width:100%;text-align:left;background:none;border:none;border-radius:.7rem;padding:.55rem .6rem;cursor:pointer;display:block}
.cn-thread-item:hover{background:var(--cn-muted,#f3f4f6)}
.cn-thread-item.active{background:var(--cn-card,#fff);box-shadow:inset 0 0 0 1px var(--cn-border,#e5e5e5)}
.cn-thread-item .ti{font-size:.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.cn-thread-item .tm{font-size:.68rem;color:var(--cn-text-muted,#666)}
.cn-chat-main{flex:1;display:flex;flex-direction:column;min-width:0}
.cn-chat-top{display:flex;align-items:center;gap:.75rem;padding:.8rem 1rem;border-bottom:1px solid var(--cn-border,#e5e5e5)}
.cn-chat-top .ic{width:2.2rem;height:2.2rem;border-radius:.8rem;background:var(--cn-secondary,#e6f2f0);color:var(--cn-primary,#0f766e);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.cn-chat-top .tt{font-weight:800;font-size:.92rem}
.cn-chat-top .ts{font-size:.7rem;color:var(--cn-text-muted,#666)}
.cn-chat-tabs{display:flex;gap:.25rem;margin-left:auto}
.cn-chat-tab{border:none;background:none;font-size:.75rem;font-weight:700;color:var(--cn-text-muted,#666);padding:.35rem .7rem;border-radius:999px;cursor:pointer}
.cn-chat-tab.active{background:var(--cn-secondary,#e6f2f0);color:var(--cn-primary,#0f766e)}
.cn-chat-x{background:none;border:none;font-size:1rem;cursor:pointer;color:var(--cn-text-muted,#666);padding:.3rem}
.cn-chat-body{flex:1;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem;scroll-behavior:smooth}
.cn-msg{max-width:82%;padding:.6rem .85rem;border-radius:1rem;font-size:.86rem;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
.cn-msg.user{align-self:flex-end;background:var(--cn-primary,#0f766e);color:var(--cn-primary-text,#fff);border-bottom-right-radius:.3rem}
.cn-msg.assistant{align-self:flex-start;background:var(--cn-muted,#f3f4f6);color:var(--cn-text,#111);border-bottom-left-radius:.3rem}
.cn-msg.assistant .cn-msg-time{color:var(--cn-text-muted,#666)}
.cn-msg-time{display:block;font-size:.62rem;opacity:.7;margin-top:.3rem}
.cn-typing{align-self:flex-start;font-size:.8rem;color:var(--cn-text-muted,#666);padding:.4rem .6rem}
.cn-typing i{animation:cnBlink 1.2s infinite;font-style:normal}
.cn-typing i:nth-child(2){animation-delay:.2s}.cn-typing i:nth-child(3){animation-delay:.4s}
@keyframes cnBlink{0%,80%,100%{opacity:.2}40%{opacity:1}}
.cn-chat-quick{display:flex;gap:.4rem;padding:.55rem 1rem;border-top:1px solid var(--cn-border,#e5e5e5);overflow-x:auto;scrollbar-width:none}
.cn-chat-quick::-webkit-scrollbar{display:none}
.cn-chip{flex-shrink:0;border:1px solid var(--cn-border,#e5e5e5);background:var(--cn-bg,#fff);color:var(--cn-text,#111);font-size:.72rem;font-weight:600;padding:.35rem .7rem;border-radius:999px;cursor:pointer}
.cn-chip:hover{background:var(--cn-muted,#f3f4f6)}
.cn-chat-input{display:flex;gap:.5rem;padding:.75rem 1rem;border-top:1px solid var(--cn-border,#e5e5e5)}
.cn-chat-input input{flex:1;min-width:0;padding:.65rem .85rem;font-size:.88rem;border:1px solid var(--cn-border,#e5e5e5);border-radius:.8rem;background:var(--cn-bg,#fff);color:var(--cn-text,#111);outline:none}
.cn-chat-input input:focus{border-color:var(--cn-primary,#0f766e)}
.cn-chat-send{border:none;background:var(--cn-primary,#0f766e);color:var(--cn-primary-text,#fff);border-radius:.8rem;width:2.6rem;cursor:pointer;font-size:1rem;flex-shrink:0}
.cn-chat-foot{padding:.4rem 1rem .6rem;font-size:.62rem;color:var(--cn-text-muted,#666);text-align:center}
/* suggestions + history panels */
.cn-panel{flex:1;overflow:auto;padding:1rem}
.cn-panel h3{font-size:.8rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--cn-primary,#0f766e);margin:0 0 .5rem}
.cn-sug-group{margin-bottom:1.1rem}
.cn-sug-item{display:flex;align-items:center;gap:.6rem;width:100%;text-align:left;background:var(--cn-bg,#fff);border:1px solid var(--cn-border,#e5e5e5);border-radius:.8rem;padding:.6rem .75rem;font-size:.84rem;font-weight:600;cursor:pointer;margin-bottom:.4rem}
.cn-sug-item:hover{border-color:var(--cn-primary,#0f766e);background:var(--cn-secondary,#eef6f4)}
.cn-hist-item{width:100%;text-align:left;background:var(--cn-bg,#fff);border:1px solid var(--cn-border,#e5e5e5);border-radius:.8rem;padding:.65rem .8rem;cursor:pointer;margin-bottom:.5rem}
.cn-hist-item:hover{border-color:var(--cn-primary,#0f766e)}
.cn-hist-item .ti{font-size:.84rem;font-weight:700;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cn-hist-item .tm{font-size:.7rem;color:var(--cn-text-muted,#666);display:block;margin-top:.15rem}
.cn-hist-item .tp{font-size:.72rem;color:var(--cn-text-muted,#666);display:block;margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cn-hist-empty{text-align:center;color:var(--cn-text-muted,#666);font-size:.84rem;padding:2rem 0}
.cn-hist-clear{width:100%;margin-top:.5rem;background:none;border:1px dashed var(--cn-border,#e5e5e5);color:#b91c1c;font-size:.75rem;font-weight:600;padding:.5rem;border-radius:.7rem;cursor:pointer}
.cn-mobile-tabs{display:flex;gap:.25rem;padding:.4rem .75rem 0}
@media(min-width:640px){.cn-mobile-tabs{display:none}}
  `;
  document.head.appendChild(css);

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") el.className = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (k === "html") el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }

  var state = { tab: "chat", thread: null, sending: false };

  function pickThread() {
    var list = threadsFor(currentUserEmail());
    state.thread = list.length ? list[0] : newThreadObj();
    var all = loadThreads();
    if (!all.some(function (t) { return t.id === state.thread.id; })) { all.unshift(state.thread); saveThreads(all); }
  }
  function updateThread() {
    var all = loadThreads();
    var i = all.findIndex(function (t) { return t.id === state.thread.id; });
    if (i >= 0) all[i] = state.thread; else all.unshift(state.thread);
    saveThreads(all);
  }

  /* ---------- open/close ---------- */
  function closeChat() {
    OPEN = false;
    var b = document.querySelector(".cn-chat-backdrop"); if (b) b.remove();
    var s = document.querySelector(".cn-chat-shell"); if (s) s.remove();
  }
  function openChat() {
    if (OPEN) return;
    OPEN = true;
    if (!state.thread || state.thread.user !== currentUserEmail()) pickThread();
    render();
  }
  window.CNOpenAssistant = openChat;
  window.CNCloseAssistant = closeChat;

  /* ---------- send ---------- */
  function send(text) {
    var msg = ("" + text).trim();
    if (!msg || state.sending) return;
    state.sending = true;
    var t = state.thread;
    if (t.messages.length === 0) t.title = msg.slice(0, 42);
    t.messages.push({ role: "user", text: msg, at: new Date().toISOString() });
    updateThread();
    state.tab = "chat";
    render();
    scrollBottom();

    var finish = function (reply) {
      t.messages.push({ role: "assistant", text: reply, at: new Date().toISOString() });
      t.updatedAt = new Date().toISOString();
      updateThread();
      state.sending = false;
      if (OPEN) { state.tab = "chat"; render(); scrollBottom(); }
    };
    if (/emergency|ambulance/i.test(msg)) {
      setTimeout(function () { finish("I cannot help with emergencies. Please use official regional emergency services right away — 112 or 108 (India). You can open Emergency help from the navigation."); }, 300);
      return;
    }
    var typingEl = document.querySelector(".cn-typing-slot");
    var body = document.querySelector(".cn-chat-body");
    var typing = null;
    if (body) {
      typing = h("div", { class: "cn-typing" });
      typing.innerHTML = 'Thinking<i>.</i><i>.</i><i>.</i>';
      body.appendChild(typing); scrollBottom();
    }
    window.geminiChat(t.messages.map(function (m) { return { role: m.role, text: m.text }; }))
      .then(finish)
      .catch(function () {
        finish("Sorry — I could not reach the assistant service just now. Please try again in a moment, or use Customer support for booking help.");
      });
    if (typing && typing.parentNode) typing.remove();
  }
  function scrollBottom() {
    var body = document.querySelector(".cn-chat-body");
    if (body) body.scrollTop = body.scrollHeight;
  }

  /* ---------- render ---------- */
  function render() {
    closeChat();
    OPEN = true;
    var backdrop = h("div", { class: "cn-chat-backdrop" });
    backdrop.addEventListener("click", closeChat);
    var shell = h("div", { class: "cn-chat-shell", role: "dialog", "aria-modal": "true", "aria-label": "Care Navigation Assistant" });

    /* sidebar (desktop) */
    var threads = threadsFor(currentUserEmail()).slice(0, 30);
    var side = h("aside", { class: "cn-chat-side" });
    var sideHead = h("div", { class: "cn-chat-side-head" });
    sideHead.appendChild(h("span", { class: "t" }, ["Conversations"]));
    var newBtn = h("button", { class: "cn-newchat", onclick: function () { state.thread = newThreadObj(); updateThread(); state.tab = "chat"; render(); } }, ["+ New"]);
    sideHead.appendChild(newBtn);
    side.appendChild(sideHead);
    var threadList = h("div", { class: "cn-threads" });
    threads.forEach(function (t) {
      var last = t.messages.length ? t.messages[t.messages.length - 1].text.slice(0, 46) : "Empty conversation";
      var item = h("button", { class: "cn-thread-item" + (state.thread && t.id === state.thread.id ? " active" : ""), onclick: function () { state.thread = t; state.tab = "chat"; render(); } });
      item.appendChild(h("span", { class: "ti" }, [t.title || "Untitled"]));
      item.appendChild(h("span", { class: "tm" }, [fmtTime(t.updatedAt || t.createdAt) + " · " + last]));
      threadList.appendChild(item);
    });
    if (!threads.length) threadList.appendChild(h("p", { class: "cn-hist-empty" }, ["No conversations yet."]));
    side.appendChild(threadList);
    shell.appendChild(side);

    /* main column */
    var main = h("div", { class: "cn-chat-main" });

    var top = h("div", { class: "cn-chat-top" });
    top.appendChild(h("span", { class: "ic" }, ["💬"]));
    var ttWrap = h("div");
    ttWrap.appendChild(h("div", { class: "tt" }, ["Care Navigation Assistant"]));
    ttWrap.appendChild(h("div", { class: "ts" }, [state.thread && state.thread.messages.length ? state.thread.title : "Ask me anything — hospitals, prices, bookings"]));
    top.appendChild(ttWrap);
    var tabs = h("div", { class: "cn-chat-tabs" });
    [["chat", "Chat"], ["history", "History"], ["suggestions", "Suggested"]].forEach(function (pair) {
      var b = h("button", { class: "cn-chat-tab" + (state.tab === pair[0] ? " active" : ""), onclick: function () { state.tab = pair[0]; render(); } }, [pair[1]]);
      tabs.appendChild(b);
    });
    top.appendChild(tabs);
    top.appendChild(h("button", { class: "cn-chat-x", "aria-label": "Close assistant", onclick: closeChat }, ["✕"]));
    main.appendChild(top);

    if (state.tab === "chat") {
      var body = h("div", { class: "cn-chat-body", "data-testid": "cn-chat-body" });
      if (!state.thread.messages.length) {
        var welcome = h("div", { class: "cn-msg assistant" });
        welcome.textContent = "Hello! I can help you find hospitals, understand prices and discounts, or walk you through a booking. What do you need today?";
        body.appendChild(welcome);
      }
      state.thread.messages.forEach(function (m) {
        var b = h("div", { class: "cn-msg " + m.role });
        b.textContent = m.text;
        b.appendChild(h("span", { class: "cn-msg-time" }, [fmtTime(m.at)]));
        body.appendChild(b);
      });
      var quick = h("div", { class: "cn-chat-quick" });
      ["🏥 Hospitals", "💰 Prices", "🎯 Discounts", "📖 How to book", "🚗 Transport"].forEach(function (c) {
        var label = c.slice(2).toLowerCase();
        var q = { hospitals: "Help me find a hospital near me.", prices: "List the service prices.", discounts: "Are there any discounts or offers?", "how to book": "Walk me through the booking process.", transport: "How does transport coordination work?" }[label] || label;
        quick.appendChild(h("button", { class: "cn-chip", onclick: function () { send(q); } }, [c]));
      });
      var inputRow = h("div", { class: "cn-chat-input" });
      var input = h("input", { type: "text", placeholder: "Ask about navigation…", "aria-label": "Ask the assistant", "data-testid": "input-chat-message" });
      input.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); send(input.value); input.value = ""; } });
      var sendB = h("button", { class: "cn-chat-send", "aria-label": "Send message", "data-testid": "button-send-chat", onclick: function () { send(input.value); input.value = ""; } }, ["➤"]);
      inputRow.appendChild(input); inputRow.appendChild(sendB);
      main.appendChild(body); main.appendChild(quick); main.appendChild(inputRow);
      main.appendChild(h("p", { class: "cn-chat-foot" }, ["This assistant cannot diagnose, provide treatment, or replace a doctor."]));
    }

    if (state.tab === "history") {
      var hp = h("div", { class: "cn-panel" });
      hp.appendChild(h("h3", {}, ["Chat history"]));
      var list = threadsFor(currentUserEmail());
      if (!list.length) hp.appendChild(h("p", { class: "cn-hist-empty" }, ["No conversations yet. Start chatting and every conversation will be saved here."]));
      list.forEach(function (t) {
        var item = h("button", { class: "cn-hist-item", onclick: function () { state.thread = t; state.tab = "chat"; render(); } });
        item.appendChild(h("span", { class: "ti" }, [t.title || "Untitled"]));
        item.appendChild(h("span", { class: "tm" }, [fmtTime(t.updatedAt || t.createdAt) + " · " + t.messages.length + " messages"]));
        var lastA = t.messages.length ? t.messages[t.messages.length - 1].text : "";
        if (lastA) item.appendChild(h("span", { class: "tp" }, ["Last: " + lastA.slice(0, 60)]));
        hp.appendChild(item);
      });
      if (list.length) {
        var clr = h("button", { class: "cn-hist-clear", onclick: function () {
          var all = loadThreads().filter(function (t) { return t.user !== currentUserEmail(); });
          saveThreads(all);
          state.thread = newThreadObj(); updateThread(); state.tab = "chat"; render();
        } }, ["Clear all my conversations"]);
        hp.appendChild(clr);
      }
      main.appendChild(hp);
    }

    if (state.tab === "suggestions") {
      var sp = h("div", { class: "cn-panel" });
      SUGGESTION_GROUPS.forEach(function (g) {
        var wrap = h("div", { class: "cn-sug-group" });
        wrap.appendChild(h("h3", {}, [g.title]));
        g.items.forEach(function (s) {
          var b = h("button", { class: "cn-sug-item", onclick: function () { send(s.q); } });
          b.appendChild(h("span", {}, [s.label]));
          wrap.appendChild(b);
        });
        sp.appendChild(wrap);
      });
      main.appendChild(sp);
    }

    shell.appendChild(main);
    document.body.appendChild(backdrop);
    document.body.appendChild(shell);
    scrollBottom();
  }

  /* ---------- wire the old launcher buttons ---------- */
  function bind() {
    document.querySelectorAll('[data-testid="button-open-chat"]').forEach(function (b) {
      if (b.dataset.cnChat) return;
      b.dataset.cnChat = "1";
      b.addEventListener("click", function (ev) { ev.stopImmediatePropagation(); openChat(); }, true);
    });
  }
  var chatMo = new MutationObserver(bind);
  function startChat() { bind(); chatMo.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startChat);
  else startChat();
})();

/* ============================================================
   Care Navigation — Hospital Finder overlay
   Real search over OpenStreetMap: type a location (or use GPS),
   see real nearby hospitals with road distance, drive time,
   contact, and a live map. Requires hospitals.js.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CNHospitals) return;
  var H = window.CNHospitals;

  var css = document.createElement("style");
  css.textContent = `
:root{--cn-card:#ffffff;--cn-bg:#ffffff;--cn-text:#141414;--cn-text-muted:#666666;--cn-border:#e2e5e9;--cn-muted:#f3f4f6;--cn-primary:#0f766e;--cn-primary-text:#ffffff;--cn-secondary:#e6f2f0}
.dark{--cn-card:#192a34;--cn-bg:#101f28;--cn-text:#e8f0f2;--cn-text-muted:#aab7ba;--cn-border:#30444f;--cn-muted:#253e4b;--cn-primary:#55cebc;--cn-primary-text:#101f28;--cn-secondary:#2d4852}
.cn-hf-overlay{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-start;justify-content:center;background:rgba(10,20,18,.55);backdrop-filter:blur(4px);padding:1.25rem;overflow:auto}
.cn-hf-card{width:100%;max-width:760px;background:var(--cn-card,#fff);color:var(--cn-text,#111);border:1px solid var(--cn-border,#e5e5e5);border-radius:1.5rem;padding:1.75rem;box-shadow:0 25px 60px rgba(0,0,0,.25);font-family:inherit;position:relative;margin-top:3vh}
.cn-hf-card h2{font-size:1.4rem;font-weight:700;margin:0 0 .2rem}
.cn-hf-sub{margin:0 0 1.1rem;font-size:.85rem;color:var(--cn-text-muted,#666)}
.cn-hf-search{display:flex;gap:.5rem}
.cn-hf-search input{flex:1;padding:.7rem .85rem;font-size:.92rem;border:1px solid var(--cn-border,#e5e5e5);border-radius:.75rem;background:var(--cn-bg,#fff);color:var(--cn-text,#111);outline:none}
.cn-hf-search input:focus{border-color:var(--cn-primary,#0f766e)}
.cn-hf-btn{padding:.7rem 1rem;font-size:.88rem;font-weight:600;border:none;border-radius:.75rem;cursor:pointer;background:var(--cn-primary,#0f766e);color:var(--cn-primary-text,#fff)}
.cn-hf-btn.cn-ghost{background:var(--cn-secondary,#e6f2f0);color:var(--cn-primary,#0f766e)}
.cn-hf-btn:disabled{opacity:.6;cursor:wait}
.cn-hf-status{margin:.8rem 0 0;font-size:.82rem;color:var(--cn-text-muted,#666)}
.cn-hf-error{margin:.8rem 0 0;font-size:.82rem;color:#b91c1c}
.cn-hf-map{height:300px;border-radius:1rem;margin-top:1rem;border:1px solid var(--cn-border,#e5e5e5);z-index:0}
.cn-hf-list{margin:1rem 0 0;padding:0;list-style:none}
.cn-hf-item{display:flex;justify-content:space-between;gap:1rem;padding:.85rem .5rem;border-bottom:1px solid var(--cn-border,#e5e5e5)}
.cn-hf-item .cn-hf-name{font-weight:700;font-size:.92rem}
.cn-hf-item .cn-hf-addr{font-size:.78rem;color:var(--cn-text-muted,#666);margin-top:.15rem}
.cn-hf-item .cn-hf-meta{font-size:.78rem;margin-top:.3rem;display:flex;gap:.75rem;flex-wrap:wrap}
.cn-hf-badge{display:inline-block;font-size:.65rem;font-weight:700;letter-spacing:.05em;padding:.1rem .45rem;border-radius:999px;background:rgba(220,38,38,.12);color:#b91c1c}
.cn-hf-dist{text-align:right;min-width:110px}
.cn-hf-dist .cn-hf-km{font-weight:700;font-size:.95rem}
.cn-hf-dist .cn-hf-min{font-size:.75rem;color:var(--cn-text-muted,#666)}
.cn-hf-dist a{font-size:.75rem;color:var(--cn-primary,#0f766e);text-decoration:none;font-weight:600}
.cn-hf-empty{padding:1.5rem 0;text-align:center;color:var(--cn-text-muted,#666);font-size:.88rem}
.cn-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--cn-text-muted,#666);padding:.25rem}
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

  function closeOverlay() { document.querySelectorAll(".cn-hf-overlay").forEach(function (o) { o.remove(); }); }

  function openFinder() {
    closeOverlay();
    var overlay = h("div", { class: "cn-hf-overlay" });
    var card = h("div", { class: "cn-hf-card", role: "dialog", "aria-modal": "true" });
    card.appendChild(h("button", { class: "cn-close", "aria-label": "Close", onclick: closeOverlay }, ["✕"]));

    var title = h("h2"); title.textContent = "Find real hospitals near you";
    var sub = h("p", { class: "cn-hf-sub" });
    sub.textContent = "Live data from OpenStreetMap — search any city, area, or landmark to see real hospitals, road distances, and drive times.";

    var input = h("input", { type: "text", placeholder: "Enter a location, e.g. Andheri West, Mumbai or Connaught Place, Delhi", "aria-label": "Location" });
    var searchBtn = h("button", { class: "cn-hf-btn" }, ["Search"]);
    var gpsBtn = h("button", { class: "cn-hf-btn cn-ghost", title: "Use my current location" }, ["📍 GPS"]);
    var searchRow = h("div", { class: "cn-hf-search" });
    searchRow.appendChild(input); searchRow.appendChild(searchBtn); searchRow.appendChild(gpsBtn);

    var status = h("p", { class: "cn-hf-status", style: "display:none" });
    var error = h("p", { class: "cn-hf-error", style: "display:none" });
    var mapDiv = h("div", { class: "cn-hf-map", id: "cn-hf-map", style: "display:none" });
    var list = h("ul", { class: "cn-hf-list" });

    card.appendChild(title); card.appendChild(sub); card.appendChild(searchRow);
    card.appendChild(status); card.appendChild(error); card.appendChild(mapDiv); card.appendChild(list);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) closeOverlay(); });
    document.body.appendChild(overlay);
    input.focus();

    function showStatus(msg) { status.textContent = msg; status.style.display = "block"; error.style.display = "none"; }
    function showError(msg) { error.textContent = msg; error.style.display = "block"; status.style.display = "none"; }

    function renderResults(originLabel, origin, hospitals) {
      status.style.display = "none";
      mapDiv.style.display = "block";
      list.textContent = "";
      H.showMap("cn-hf-map", origin, hospitals.slice(0, 20).map(function (hp) {
        return { lat: hp.lat, lon: hp.lon, name: hp.name, sub: hp.roadKm ? hp.roadKm + " km · " + hp.driveMinutes + " min drive" : hp.distanceKm + " km away" };
      }));
      if (!hospitals.length) {
        list.appendChild(h("li", { class: "cn-hf-empty" }, ["No hospitals found in OpenStreetMap within range. Try a bigger city or widen the search."]));
        return;
      }
      hospitals.slice(0, 12).forEach(function (hp) {
        var li = h("li", { class: "cn-hf-item" });
        var left = h("div");
        var nameRow = h("div", { class: "cn-hf-name" });
        nameRow.textContent = hp.name;
        if (hp.emergency) nameRow.appendChild(h("span", { class: "cn-hf-badge", style: "margin-left:.5rem" }, ["24×7 EMERGENCY"]));
        left.appendChild(nameRow);
        if (hp.address) left.appendChild(h("div", { class: "cn-hf-addr" }, [hp.address]));
        var meta = h("div", { class: "cn-hf-meta" });
        if (hp.phone) meta.appendChild(h("span", {}, ["☎ " + hp.phone]));
        if (hp.beds) meta.appendChild(h("span", {}, ["🛏 " + hp.beds + " beds"]));
        if (hp.specialty) meta.appendChild(h("span", {}, ["hta " + hp.specialty]));
        left.appendChild(meta);

        var right = h("div", { class: "cn-hf-dist" });
        var km = h("div", { class: "cn-hf-km" });
        km.textContent = hp.roadKm != null ? hp.roadKm + " km" : hp.distanceKm + " km";
        right.appendChild(km);
        if (hp.driveMinutes != null) right.appendChild(h("div", { class: "cn-hf-min" }, [hp.driveMinutes + " min drive"]));
        var dirs = h("a", { target: "_blank", rel: "noopener", href: "https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=" + origin.lat + "%2C" + origin.lon + "%3B" + hp.lat + "%2C" + hp.lon });
        dirs.textContent = "Directions ↗";
        right.appendChild(dirs);

        li.appendChild(left); li.appendChild(right);
        list.appendChild(li);
      });
      var credit = h("li", { class: "cn-hf-empty", style: "padding-top:.75rem;font-size:.72rem" });
      credit.textContent = "Hospital data © OpenStreetMap contributors · Distances via OSRM · Verify details before visiting.";
      list.appendChild(credit);
    }

    function runSearch(query) {
      if (!query || !query.trim()) return;
      searchBtn.disabled = true; gpsBtn.disabled = true;
      list.textContent = ""; mapDiv.style.display = "none";
      showStatus("Locating \"" + query.trim() + "\"…");
      H.geocode(query.trim()).then(function (origin) {
        showStatus("Found: " + origin.label + " — fetching nearby hospitals…");
        return H.fetchHospitals(origin.lat, origin.lon, 10).then(function (hospitals) {
          if (!hospitals.length) { searchBtn.disabled = false; gpsBtn.disabled = false; return renderResults(origin.label, origin, hospitals); }
          showStatus("Found " + hospitals.length + " hospitals — calculating road distances…");
          return H.annotateWithRoutes(origin, hospitals.slice(0, 12)).then(function (ann) {
            searchBtn.disabled = false; gpsBtn.disabled = false;
            renderResults(origin.label, origin, ann);
          });
        });
      }).catch(function (ex) {
        searchBtn.disabled = false; gpsBtn.disabled = false;
        showError(ex.message || "Search failed. Please try again.");
      });
    }

    searchBtn.addEventListener("click", function () { runSearch(input.value); });
    input.addEventListener("keydown", function (ev) { if (ev.key === "Enter") runSearch(input.value); });
    gpsBtn.addEventListener("click", function () {
      if (!navigator.geolocation) return showError("Geolocation is not available in this browser.");
      showStatus("Getting your location…");
      navigator.geolocation.getCurrentPosition(function (pos) {
        var origin = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        showStatus("Located you — fetching nearby hospitals…");
        H.fetchHospitals(origin.lat, origin.lon, 10).then(function (hospitals) {
          if (!hospitals.length) { gpsBtn.disabled = false; searchBtn.disabled = false; return renderResults("Your location", origin, hospitals); }
          showStatus("Found " + hospitals.length + " hospitals — calculating road distances…");
          H.reverseGeocode(origin.lat, origin.lon).then(function (label) { input.value = label.split(",").slice(0, 2).join(","); }).catch(function () {});
          return H.annotateWithRoutes(origin, hospitals.slice(0, 12)).then(function (ann) {
            gpsBtn.disabled = false; searchBtn.disabled = false;
            renderResults("Your location", origin, ann);
          });
        }).catch(function (ex) { gpsBtn.disabled = false; searchBtn.disabled = false; showError(ex.message || "Could not fetch hospitals."); });
      }, function (err) {
        gpsBtn.disabled = false; searchBtn.disabled = false;
        showError(err.code === 1 ? "Location permission denied. Search by place name instead." : "Could not get your location.");
      }, { timeout: 10000, enableHighAccuracy: false });
    });
  }

  /* ---------- hook site buttons ---------- */
  function bind() {
    document.querySelectorAll('a[href="/find-hospitals"], a[href="/hospitals"]').forEach(function (a) {
      if (a.dataset.cnHf) return;
      a.dataset.cnHf = "1";
      a.addEventListener("click", function (ev) { ev.preventDefault(); openFinder(); });
    });
  }
  var mo = new MutationObserver(function () { bind(); });
  function start() { bind(); mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.CNOpenHospitalFinder = openFinder;
})();

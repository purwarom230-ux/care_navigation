/* ============================================================
   Care Navigation — Hospital Finder overlay
   Google Maps powered: autocomplete location input, real
   nearby hospitals via Places, real road distance/time via
   Distance Matrix, and an interactive Google map with markers.
   Falls back to OpenStreetMap if Google fails to load.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CNHospitals) return;
  var H = window.CNHospitals;

  var css = document.createElement("style");
  css.textContent = `
:root{--cn-card:#fbf7ee;--cn-bg:#fbf7ee;--cn-text:#1d3440;--cn-text-muted:#5a7280;--cn-border:#e6ddc8;--cn-muted:#f1ead9;--cn-primary:#337a5b;--cn-primary-text:#fbf7ee;--cn-secondary:#f0d9a8}
.dark{--cn-card:#1d3844;--cn-bg:#132730;--cn-text:#f2ede0;--cn-text-muted:#9db4bc;--cn-border:#2e4a56;--cn-muted:#233d49;--cn-primary:#4ade9f;--cn-primary-text:#132730;--cn-secondary:#2b4a56}
.cn-hf-overlay{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-start;justify-content:center;background:rgba(29,42,45,0.96);backdrop-filter:blur(4px);padding:1.25rem;overflow:auto}
.cn-hf-card{width:100%;max-width:760px;background:var(--cn-card,#fff);color:var(--cn-text,#111);border:1px solid var(--cn-border,#e5e5e5);border-radius:1.5rem;padding:1.75rem;box-shadow:0 25px 60px rgba(0,0,0,.25);font-family:inherit;position:relative;margin-top:3vh}
.cn-hf-card h2{font-size:1.4rem;font-weight:700;margin:0 0 .2rem}
.cn-hf-sub{margin:0 0 1.1rem;font-size:.85rem;color:var(--cn-text-muted,#666)}
.cn-hf-search{display:flex;gap:.5rem}
.cn-hf-search input{flex:1;padding:.7rem .85rem;font-size:.92rem;border:1px solid var(--cn-border,#e5e5e5);border-radius:.75rem;background:var(--cn-bg,#fff);color:var(--cn-text,#111);outline:none}
.cn-hf-search input:focus{border-color:var(--cn-primary,#337a5b)}
.cn-hf-btn{padding:.7rem 1rem;font-size:.88rem;font-weight:600;border:none;border-radius:.75rem;cursor:pointer;background:var(--cn-primary,#337a5b);color:var(--cn-primary-text,#fff)}
.cn-hf-btn.cn-ghost{background:var(--cn-secondary,#e6f2f0);color:var(--cn-primary,#337a5b)}
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
.cn-hf-dist a{font-size:.75rem;color:var(--cn-primary,#337a5b);text-decoration:none;font-weight:600}
.cn-hf-empty{padding:1.5rem 0;text-align:center;color:var(--cn-text-muted,#666);font-size:.88rem}
.cn-close{position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--cn-text-muted,#666);padding:.25rem}
/* Google Places autocomplete dropdown — clean styling, hide broken icon glyphs */
.pac-container{background:#fffdf8;border-radius:.75rem;margin-top:.45rem;font-family:inherit;box-shadow:0 12px 34px rgba(20,35,40,.28);z-index:1000!important;border:1px solid #e6ddc8}
.pac-container:empty,.pac-container .pac-icon{display:none!important}
.pac-item{padding:.55rem .85rem;font-size:.88rem;color:#1d3440;cursor:pointer;border-bottom:1px solid #f1ead9}
.pac-item:hover{background:#f1ead9}
.pac-item-query{font-weight:600;color:#1d3440}
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
    sub.textContent = "Powered by Google Maps — start typing a location and pick a suggestion, or tap GPS to see real hospitals with live road distances and drive times.";

    var input = h("input", { type: "text", placeholder: "Enter a location, e.g. Andheri West, Mumbai or Connaught Place, Delhi", "aria-label": "Location", autocomplete: "off" });
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

    /* ---------- Google helpers (with graceful OSM fallback) ---------- */
    var googleOn = !!(window.google && window.google.maps && window.google.maps.places);
    function haversineKm(a, b) {
      var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
      var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return 2 * R * Math.asin(Math.sqrt(s));
    }
    if (googleOn) {
      try {
        var ac = new google.maps.places.Autocomplete(input, { fields: ["geometry", "name", "formatted_address"] });
        ac.addListener("place_changed", function () {
          var p = ac.getPlace();
          if (p && p.geometry && p.geometry.location) {
            input.value = p.formatted_address || p.name;
            input.dataset.lat = p.geometry.location.lat();
            input.dataset.lon = p.geometry.location.lng();
            runSearch(input.value);
          }
        });
      } catch (e) { /* autocomplete unavailable — plain input still works */ }
    }

    function originFromInput(cb) {
      var lat = parseFloat(input.dataset.lat), lon = parseFloat(input.dataset.lon);
      if (!isNaN(lat) && !isNaN(lon)) return cb({ lat: lat, lon: lon, label: input.value });
      var q = input.value.trim();
      if (!q) return showError("Type a location first — or tap GPS.");
      /* Google Geocoding API is not enabled on this key's project — use Nominatim (free, no key) for typed text. */
      H.geocode(q).then(function (o) { cb(o); }).catch(function (ex) { showError(ex.message || "Could not find that place."); });
    }

    function gNearbyHospitals(origin) {
      return new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () { if (!settled) { settled = true; reject(new Error("timeout")); } }, 9000);
        var svc = new google.maps.places.PlacesService(document.createElement("div"));
        svc.nearbySearch({ location: { lat: origin.lat, lng: origin.lon }, radius: 12000, type: "hospital" }, function (results, st) {
          if (settled) return;
          settled = true; clearTimeout(timer);
          if (st !== google.maps.places.PlacesServiceStatus.OK || !results || !results.length) return reject(new Error("No hospitals found nearby."));
          var seen = {}, list = [];
          results.forEach(function (p) {
            var name = p.name; if (!name || seen[name.toLowerCase()]) return; seen[name.toLowerCase()] = 1;
            var open = p.opening_hours ? (p.opening_hours.isOpen ? p.opening_hours.isOpen() : null) : null;
            list.push({
              id: p.place_id, name: name,
              lat: p.geometry.location.lat(), lon: p.geometry.location.lng(),
              address: p.vicinity || null,
              rating: p.rating || null,
              totalRatings: p.user_ratings_total || null,
              distanceKm: Math.round(haversineKm(origin, { lat: p.geometry.location.lat(), lon: p.geometry.location.lng() }) * 10) / 10,
              _place: p
            });
          });
          list.sort(function (a, b) { return a.distanceKm - b.distanceKm; });
          resolve(list);
        });
      });
    }

    function osmNearbyHospitals(origin) {
      return H.fetchHospitals(origin.lat, origin.lon, 10).catch(function () {
        throw new Error("Hospital data services are busy right now — please search again in a few seconds.");
      });
    }

    function annotateDistances(origin, hospitals) {
      /* Google Distance Matrix API is not enabled on this key's project —
         use OSRM (free, real road network) for distance/time instead. */
      return H.annotateWithRoutes(origin, hospitals);
    }

    /* ---------- map rendering: Google first, Leaflet/OSM fallback ---------- */
    var gMap = null, gMarkers = [];
    function renderLeaflet(origin, markers) {
      gMap = null; gMarkers = [];
      mapDiv.innerHTML = "";
      H.showMap("cn-hf-map", origin, markers);
    }
    function renderMap(origin, markers) {
      mapDiv.style.display = "block";
      if (googleOn) {
        try {
          var center = { lat: origin.lat, lng: origin.lon };
          if (!gMap) {
            gMap = new google.maps.Map(mapDiv, { center: center, zoom: 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
          } else { gMap.setCenter(center); }
          gMarkers.forEach(function (mk) { mk.setMap(null); }); gMarkers = [];
          var bounds = new google.maps.LatLngBounds();
          bounds.extend(center);
          gMarkers.push(new google.maps.Marker({ position: center, map: gMap, title: "Your location", zIndex: 999, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#337a5b", fillOpacity: 1, strokeColor: "#fbf7ee", strokeWeight: 3 } }));
          (markers || []).forEach(function (m) {
            var pos = { lat: m.lat, lng: m.lon };
            var mk = new google.maps.Marker({ position: pos, map: gMap, title: m.name, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#b45330", fillOpacity: 1, strokeColor: "#7a2e14", strokeWeight: 2 } });
            var iw = new google.maps.InfoWindow({ content: "<b>" + m.name + "</b>" + (m.sub ? "<br>" + m.sub : "") });
            mk.addListener("click", function () { iw.open({ anchor: mk, map: gMap }); });
            gMarkers.push(mk); bounds.extend(pos);
          });
          gMap.fitBounds(bounds, 50);
          setTimeout(function () { google.maps.event.trigger(gMap, "resize"); }, 80);
          /* The shared demo key's tile quota can be exhausted — if Google shows
             its error box (or no tiles) shortly after, silently switch to free
             OpenStreetMap tiles via Leaflet so the user always gets a map. */
          setTimeout(function () {
            if (mapDiv.querySelector(".gm-err-container") || !mapDiv.querySelector("img")) {
              renderLeaflet(origin, markers);
            }
          }, 2600);
          return;
        } catch (e) { gMap = null; }
      }
      renderLeaflet(origin, markers);
    }

    function renderResults(originLabel, origin, hospitals) {
      status.style.display = "none";
      mapDiv.style.display = "block";
      list.textContent = "";
      renderMap(origin, hospitals.slice(0, 20).map(function (hp) {
        return { lat: hp.lat, lon: hp.lon, name: hp.name, sub: hp.roadKm != null ? hp.roadKm + " km · " + hp.driveMinutes + " min drive" : hp.distanceKm + " km away" };
      }));
      if (!hospitals.length) {
        list.appendChild(h("li", { class: "cn-hf-empty" }, ["No hospitals found within range. Try a bigger city or widen the search."]));
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
        if (hp.rating) meta.appendChild(h("span", {}, ["★ " + hp.rating + (hp.totalRatings ? " (" + hp.totalRatings + ")" : "")]));
        if (hp.phone) meta.appendChild(h("span", {}, ["☎ " + hp.phone]));
        if (hp.beds) meta.appendChild(h("span", {}, ["🛏 " + hp.beds + " beds"]));
        if (hp.specialty) meta.appendChild(h("span", {}, ["⚕ " + hp.specialty]));
        left.appendChild(meta);

        var right = h("div", { class: "cn-hf-dist" });
        var km = h("div", { class: "cn-hf-km" });
        km.textContent = hp.roadKm != null ? hp.roadKm + " km" : hp.distanceKm + " km";
        right.appendChild(km);
        if (hp.driveMinutes != null) right.appendChild(h("div", { class: "cn-hf-min" }, [hp.driveMinutes + " min drive"]));
        var dirs = h("a", { target: "_blank", rel: "noopener", href: "https://www.google.com/maps/dir/?api=1&origin=" + origin.lat + "," + origin.lon + "&destination=" + hp.lat + "," + hp.lon });
        dirs.textContent = "Directions ↗";
        right.appendChild(dirs);

        li.appendChild(left); li.appendChild(right);
        list.appendChild(li);
      });
      var credit = h("li", { class: "cn-hf-empty", style: "padding-top:.75rem;font-size:.72rem" });
      credit.textContent = googleOn ? "Hospital data © Google · Road distances via OSRM · Verify details before visiting." : "Hospital data © OpenStreetMap contributors · Road distances via OSRM · Verify details before visiting.";
      list.appendChild(credit);
    }

    function searchPipeline(origin) {
      showStatus("Fetching nearby hospitals around " + (origin.label || "your location") + "…");
      var fetcher = googleOn ? gNearbyHospitals(origin).catch(function () { return osmNearbyHospitals(origin); }) : osmNearbyHospitals(origin);
      fetcher.then(function (hospitals) {
        if (!hospitals.length) { searchBtn.disabled = false; gpsBtn.disabled = false; return renderResults(origin.label, origin, hospitals); }
        showStatus("Found " + hospitals.length + " hospitals — calculating road distances…");
        return annotateDistances(origin, hospitals.slice(0, 12)).then(function (ann) {
          searchBtn.disabled = false; gpsBtn.disabled = false;
          renderResults(origin.label, origin, ann);
        });
      }).catch(function (ex) {
        searchBtn.disabled = false; gpsBtn.disabled = false;
        showError(ex.message || "Could not fetch hospitals. Please try again.");
      });
    }

    function runSearch(query) {
      if (!query || !query.trim()) return;
      searchBtn.disabled = true; gpsBtn.disabled = true;
      list.textContent = ""; mapDiv.style.display = "none";
      showStatus("Locating \"" + query.trim() + "\"…");
      originFromInput(function (origin) {
        searchPipeline(origin);
      });
    }

    searchBtn.addEventListener("click", function () { runSearch(input.value); });
    input.addEventListener("keydown", function (ev) { if (ev.key === "Enter") runSearch(input.value); });
    gpsBtn.addEventListener("click", function () {
      if (!navigator.geolocation) return showError("Geolocation is not available in this browser.");
      gpsBtn.disabled = true; searchBtn.disabled = true;
      showStatus("Getting your location…");
      navigator.geolocation.getCurrentPosition(function (pos) {
        var origin = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Your location" };
        H.reverseGeocode(origin.lat, origin.lon).then(function (label) {
          input.value = label.split(",").slice(0, 2).join(",");
          origin.label = input.value;
        }).catch(function () {}).then(function () {
          searchPipeline(origin);
        });
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

/* ============================================================
   Care Navigation — Real hospital data (OpenStreetMap)
   ------------------------------------------------------------
   - Nominatim: free geocoding (address/city -> lat,lon)
   - Overpass:  real nearby hospitals from OpenStreetMap
   - OSRM:      real road distances & travel times
   - Map:       OpenStreetMap tiles (Leaflet, no key needed)
   Optional: set window.MAPQL_KEY to use MapQL-styled tiles.
   ============================================================ */
(function () {
  "use strict";

  var NOMINATIM = "https://nominatim.openstreetmap.org";
  var OVERPASS = "https://overpass-api.de/api/interpreter";
  var OSRM = "https://router.project-osrm.org/route/v1/driving/";

  function getJSON(url, opts) {
    opts = opts || {};
    return fetch(url, { headers: opts.headers || {} }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /* ---------- geocoding ---------- */
  function geocode(query) {
    return getJSON(NOMINATIM + "/search?format=jsonv2&limit=1&addressdetails=1&q=" + encodeURIComponent(query), {
      headers: { "Accept-Language": "en" }
    }).then(function (results) {
      if (!results || !results.length) throw new Error("Could not find that place. Try a city or landmark name.");
      var r = results[0];
      return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), label: r.display_name };
    });
  }

  function reverseGeocode(lat, lon) {
    return getJSON(NOMINATIM + "/reverse?format=jsonv2&lat=" + lat + "&lon=" + lon, {
      headers: { "Accept-Language": "en" }
    }).then(function (r) {
      return r && r.display_name ? r.display_name : lat.toFixed(4) + ", " + lon.toFixed(4);
    });
  }

  /* ---------- nearby hospitals (real OSM data) ---------- */
  function haversineKm(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function fetchHospitals(lat, lon, radiusKm) {
    var radius = Math.min(Math.max(radiusKm || 8, 1), 30) * 1000;
    var q = "[out:json][timeout:25];(" +
      "node[amenity=hospital](around:" + radius + "," + lat + "," + lon + ");" +
      "way[amenity=hospital](around:" + radius + "," + lat + "," + lon + ");" +
      ");out center 60;";
    return fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "CareNav-Demo/1.0" },
      body: "data=" + encodeURIComponent(q)
    }).then(function (r) { return r.json(); }).then(function (data) {
      var seen = {};
      var list = (data.elements || []).map(function (el) {
        var c = el.type === "way" ? el.center : el;
        var tags = el.tags || {};
        var name = tags.name || tags["name:en"] || null;
        if (!name) return null;
        var key = name.toLowerCase();
        if (seen[key]) return null; seen[key] = 1;
        var pos = { lat: c.lat, lon: c.lon };
        return {
          id: el.type + "/" + el.id,
          name: name,
          lat: pos.lat, lon: pos.lon,
          distanceKm: Math.round(haversineKm({ lat: lat, lon: lon }, pos) * 10) / 10,
          address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean).join(", ") || null,
          phone: tags.phone || tags["contact:phone"] || null,
          emergency: tags.emergency === "yes",
          website: tags.website || tags["contact:website"] || null,
          beds: tags.beds ? parseInt(tags.beds, 10) : null,
          specialty: tags["healthcare:speciality"] ? tags["healthcare:speciality"].split(";")[0] : null
        };
      }).filter(Boolean);
      list.sort(function (a, b) { return a.distanceKm - b.distanceKm; });
      return list;
    });
  }

  /* ---------- real road distance / time (OSRM) ---------- */
  function route(from, to) {
    var url = OSRM + from.lon + "," + from.lat + ";" + to.lon + "," + to.lat + "?overview=false";
    return getJSON(url).then(function (d) {
      if (d.code !== "Ok" || !d.routes || !d.routes.length) throw new Error("No route found");
      var r = d.routes[0];
      return { km: Math.round(r.distance / 100) / 10, minutes: Math.round(r.duration / 60) };
    });
  }

  /* ---------- distance matrix for the finder list ---------- */
  function annotateWithRoutes(origin, hospitals) {
    var concurrency = 4, idx = 0, out = hospitals.slice();
    function worker() {
      if (idx >= out.length) return Promise.resolve();
      var hp = out[idx++];
      return route(origin, { lat: hp.lat, lon: hp.lon })
        .then(function (r) { hp.roadKm = r.km; hp.driveMinutes = r.minutes; })
        .catch(function () { hp.roadKm = null; hp.driveMinutes = null; })
        .then(worker);
    }
    return Promise.all([worker(), worker(), worker(), worker()]).then(function () { return out; });
  }

  /* ---------- Leaflet map (lazy loaded, no API key) ---------- */
  var leafletState = { css: false, js: false };
  function ensureLeaflet() {
    return new Promise(function (resolve, reject) {
      if (leafletState.js) return resolve();
      if (!leafletState.css) {
        var l = document.createElement("link");
        l.rel = "stylesheet"; l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(l); leafletState.css = true;
      }
      var s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = function () { leafletState.js = true; resolve(); };
      s.onerror = function () { reject(new Error("Could not load map library.")); };
      document.head.appendChild(s);
    });
  }

  var mapInstances = {};
  function showMap(containerId, center, markers) {
    return ensureLeaflet().then(function () {
      var el = document.getElementById(containerId);
      if (!el) return;
      if (mapInstances[containerId]) { mapInstances[containerId].remove(); }
      var tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      var attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
      var map = L.map(containerId, { scrollWheelZoom: false }).setView([center.lat, center.lon], 12);
      L.tileLayer(tileUrl, { attribution: attribution, maxZoom: 19 }).addTo(map);
      L.circleMarker([center.lat, center.lon], { radius: 7, color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 1, weight: 3 })
        .bindPopup("You are here").addTo(map);
      (markers || []).forEach(function (m) {
        L.circleMarker([m.lat, m.lon], { radius: 6, color: "#b91c1c", fillColor: "#ef4444", fillOpacity: .9, weight: 2 })
          .bindPopup("<b>" + m.name + "</b>" + (m.sub ? "<br>" + m.sub : "") +
            '<br><a target="_blank" rel="noopener" href="https://www.openstreetmap.org/directions?from=&to=' + m.lat + "%2C" + m.lon + '">Directions ↗</a>')
          .addTo(map);
      });
      mapInstances[containerId] = map;
      setTimeout(function () { map.invalidateSize(); }, 60);
      return map;
    });
  }

  window.CNHospitals = {
    geocode: geocode,
    reverseGeocode: reverseGeocode,
    fetchHospitals: fetchHospitals,
    route: route,
    annotateWithRoutes: annotateWithRoutes,
    showMap: showMap
  };
})();

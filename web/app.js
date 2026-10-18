(function () {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const view = $("#view");
const GV = { G: 1, P: 0.5, F: 0 };
const GL = { G: "Pass", P: "Partial", F: "Fail", NA: "N/A" };
const TIER = { C: "Critical", I: "Important", X: "Cell-integration" };
const FAMILY = { formal: "Formal standard", hal: "Hardware-abstraction layer", agentic: "Model-facing (MCP)", bespoke: "Bespoke conventions" };
const NA_OK = new Set(window.NA_OK || []);   // criteria allowed to grade N/A (from criteria/*.yml via sync.js)
const CRIT = window.CRITERIA;
const MONTH = 30.44 * 864e5;

/* ---------- persistence ---------- */
const KEY = "sdl-scorecard-v2";
let store = { evals: [], current: null, weights: {}, tools: [] };
try {
  const s = JSON.parse(localStorage.getItem(KEY) || "null");
  if (s && Array.isArray(s.evals)) store = Object.assign(store, s);
  else { const old = JSON.parse(localStorage.getItem("sdl-scorecard-v1") || "null"); if (old?.evals) store.evals = old.evals.map(o => Object.assign(blank(), o)); }
} catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
const uid = () => Math.random().toString(36).slice(2, 9);
const allTools = () => window.TOOLS.concat(store.tools);
const toolById = id => allTools().find(t => t.id === id);

function blank(over = {}) {
  return Object.assign({
    id: uid(), vendor: "New instrument", endpoint: "SiLA 2", arch: "Native endpoint", orch: "", date: new Date().toISOString().slice(0, 10),
    ctx: { cell: false, hazard: false, unattended: false, networked: true, isolated: false, isoAccepted: false, surfaceDoc: false, c20local: false, c21local: false },
    cyber: window.CYBER.map(() => false), grades: {}, notes: {}, remed: {}, remedDate: {}, gap: {}, annot: {}, annotDate: {},
    mit: {}, c15noReconnect: false, c15fixedDefault: false, c21fallback: false, c21aNA: false, c21powerPath: false, c21naVerified: false, reqChecks: {},
    model: "", scorecardVersion: window.SCORECARD_VERSION || "", evidence: window.EVIDENCE.map(() => false)
  }, over);
}
const cur = () => store.evals.find(e => e.id === store.current);
const wOf = c => store.weights[c.n] ?? c.w;

/* ---------- scoring: shared engine in score.js (also used by the API build and by agents) ---------- */
const effectiveGrade = (e, c) => SDLScore.effectiveGrade(e, c);
const evaluate = e => SDLScore.evaluate(e, { criteria: CRIT, weights: store.weights, cyberCount: window.CYBER.length });
const PUBLIC = (window.PUBLIC_SCORECARDS || []).map(p => Object.assign(blank(), p, { pub: true }));
function toolStats(name) {
  const ev = store.evals.filter(e => e.orch === name).concat(PUBLIC.filter(p => p.orch === name));
  const rs = ev.map(evaluate);
  const done = rs.filter(r => !r.unrated && !r.blocked);
  return { n: ev.length, eligible: rs.filter(r => r.cls === "ok" || r.cls === "warn").length,
    best: done.length ? Math.max(...done.map(r => r.pts)) : null, maxStd: done.length ? Math.max(...done.map(r => r.max)) : null,
    mean: done.length ? Math.round(10 * done.reduce((a, r) => a + r.pts, 0) / done.length) / 10 : null, evals: ev.map((e, i) => ({ e, r: rs[i] })) };
}

/* ---------- routing ---------- */
const routes = { map: renderMap, orchestrators: renderOrch, scenarios: renderScen, scorecard: renderScore, compare: renderCompare, team: renderTeam, api: renderApi, about: renderAbout };
let mapState = { selected: null, q: "", fam: "all" };
function parseHash() {
  const raw = (location.hash || "#map").slice(1);
  const [path, qs = ""] = raw.split("?");
  const [name, arg] = path.split("/");
  return { name: routes[name] ? name : "map", arg, params: new URLSearchParams(qs) };
}
function route() {
  const { name, arg, params } = parseHash();
  document.body.dataset.page = name;
  document.querySelectorAll(".mainnav [data-tab]").forEach(a => { const on = a.dataset.tab === name; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
  const inMore = document.querySelector(`.more-menu [data-tab="${name}"]`);
  document.getElementById("more-btn")?.classList.toggle("on", !!inMore);
  const ml = document.getElementById("more-label"); if (ml) ml.textContent = inMore ? inMore.querySelector("b").textContent : "More";
  closeMore();
  if (name === "map" && arg) mapState.selected = arg;
  if (name === "orchestrators") readOrchParams(params);
  routes[name]();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
// Map tiles and marker colours are read from the theme at draw time; redraw when the OS theme flips.
/* "More" dropdown in the header */
function closeMore() { const m = document.getElementById("more-menu"), b = document.getElementById("more-btn"); if (m && !m.hidden) { m.hidden = true; b.setAttribute("aria-expanded", "false"); } }
(() => {
  const b = document.getElementById("more-btn"), m = document.getElementById("more-menu"); if (!b) return;
  const items = () => [...m.querySelectorAll("a")];
  b.onclick = () => { const open = m.hidden; m.hidden = !open; b.setAttribute("aria-expanded", String(open)); };
  b.addEventListener("keydown", ev => { if (ev.key === "ArrowDown") { ev.preventDefault(); m.hidden = false; b.setAttribute("aria-expanded", "true"); items()[0].focus(); } });
  m.addEventListener("keydown", ev => {
    const it = items(), i = it.indexOf(document.activeElement);
    if (ev.key === "Escape") { closeMore(); b.focus(); }
    else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); it[(i + (ev.key === "ArrowDown" ? 1 : it.length - 1)) % it.length].focus(); }
  });
  document.addEventListener("click", ev => { if (!ev.target.closest(".more")) closeMore(); });
})();
const isDark = () => { const t = document.documentElement.dataset.theme; return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
const redrawThemed = () => { if (parseHash().name === "map" && document.getElementById("map")) renderMap(); };
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawThemed);
// Theme switch (header): auto follows the OS; light/dark are remembered in this browser.
function setTheme(mode) {
  if (mode === "light" || mode === "dark") document.documentElement.dataset.theme = mode; else delete document.documentElement.dataset.theme;
  try { mode === "auto" ? localStorage.removeItem("sdl-theme") : localStorage.setItem("sdl-theme", mode); } catch (e) {}
  document.querySelectorAll("[data-theme-set]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.themeSet === mode)));
  redrawThemed();
}
(() => {
  const cur = document.documentElement.dataset.theme || "auto";
  const sw = document.getElementById("theme-switch"); if (!sw) return;
  sw.querySelectorAll("[data-theme-set]").forEach(b => { b.setAttribute("aria-checked", String(b.dataset.themeSet === cur)); b.onclick = () => setTheme(b.dataset.themeSet); });
  sw.addEventListener("keydown", ev => { if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return; const bs = [...sw.querySelectorAll("button")], i = bs.indexOf(document.activeElement); if (i < 0) return; ev.preventDefault(); const n = bs[(i + (ev.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click(); });
})();

const pageHead = (title, lede = "", aside = "") => `<header class="page-head"><div><h1 class="page-title">${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</div>${aside}</header>`;

/* ---------- shared tool rendering ---------- */
const REGION = { USA: "North America", Canada: "North America", Germany: "Europe", UK: "Europe", Netherlands: "Europe", Japan: "Asia", China: "Asia", "Republic of Korea": "Asia", "New Zealand": "Oceania" };
const regionOf = t => REGION[t.country] || "Other";
const stdBase = s => s.replace(/\s*\(.*\)\s*$/, "").trim();
function logoImg(t, size = 48) {
  const initials = esc(t.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map(w => w[0]).join("").slice(0, 3).toUpperCase());
  return `<span class="logo s${size}">${t.logo ? `<img src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.remove()">` : ""}<span class="ini">${initials}</span></span>`;
}
function familyTags(t) {
  return `<span class="tag ${t.family}">${t.family === "formal" ? (t.enforced ? "standard required" : "standard supported") : FAMILY[t.family]}</span>${(t.standards || []).map(s => `<span class="tag">${esc(s)}</span>`).join("")}`;
}
const place = t => [t.city, t.country].filter(Boolean).join(", ");
function link(url, label) { return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : ""; }
function toolDetail(t) {
  const s = toolStats(t.name);
  const links = [link(t.website, "Website"), link(t.repo, "Repository"), link(t.docs, "Docs"), link(t.paper, "Paper")].filter(Boolean).join("");
  return `
    <div class="td-head">${logoImg(t, 48)}
      <div class="td-title"><h2>${esc(t.name)}</h2>
        <p class="meta">${esc(t.org)}</p>${place(t) ? `<p class="meta">${esc(place(t))}</p>` : ""}</div></div>
    ${links ? `<nav class="td-links" aria-label="Links">${links}</nav>` : ""}
    <div class="tags">${familyTags(t)}${t.user ? '<span class="tag">added locally</span>' : ""}</div>
    ${t.verified === false ? `<p class="flag">⚠ ${esc(t.unverified || "Some fields are unverified.")}</p>` : ""}
    <dl class="td-facts">
      <dt>Device integration</dt><dd>${esc(t.mech || "—")}</dd>
      ${t.notes ? `<dt>Notes</dt><dd>${esc(t.notes)}</dd>` : ""}
      <dt>Licence</dt><dd>${esc(t.license || "—")}</dd>
    </dl>
    <section class="scorebox" aria-label="Scorecards">
      <h3>Scorecards targeting ${esc(t.name)}</h3>
      ${s.n ? `<div class="kpis"><div><b>${s.best ?? "—"}</b><span>/ ${s.maxStd ?? "—"} best</span></div><div><b>${s.mean ?? "—"}</b><span>mean</span></div><div><b>${s.eligible}</b><span>/ ${s.n} eligible</span></div></div>
        <ul class="evlist">${s.evals.map(({ e, r }) => `<li>${e.pub ? `<a href="#compare">${esc(e.vendor)}</a> <span class="tag">public</span>` : `<a href="#scorecard" data-open="${e.id}">${esc(e.vendor)}</a>`}<span class="g ${r.cls === "ok" ? "G" : r.cls === "bad" ? "F" : r.cls === "warn" ? "P" : "NA"}">${r.unrated ? "incomplete" : `${r.pts}/${r.max}`}</span></li>`).join("")}</ul>`
        : `<p class="hint">No instrument has been scored for this orchestrator yet. Scorecards rate instruments, not orchestrators — this panel collects the scorecards that name it as their target.</p>`}
      <button class="btn pri block" data-score="${esc(t.id)}">Score an instrument for ${esc(t.name)} →</button>
    </section>`;
}
function wireToolActions(root) {
  root.querySelectorAll("[data-score]").forEach(b => b.onclick = () => {
    const t = toolById(b.dataset.score);
    const e = blank({ orch: t.name, vendor: "New instrument" });
    const st = (t.standards || []).join(" ");
    e.endpoint = /SiLA/.test(st) ? "SiLA 2" : /OPC/.test(st) ? "OPC UA + LADS" : /MCP/.test(st) ? "MCP" : "REST + OpenAPI";
    store.evals.push(e); store.current = e.id; save(); location.hash = "#scorecard";
  });
  root.querySelectorAll("[data-open]").forEach(a => a.onclick = ev => { ev.preventDefault(); store.current = a.dataset.open; save(); location.hash = "#scorecard"; });
}

/* ---------- Map ---------- */
let leafletMap = null;
const FAM_OPTS = [["all", "All"], ["formal", "Formal"], ["hal", "HAL"], ["agentic", "MCP"], ["bespoke", "Bespoke"]];
function mapMatches(t) {
  const q = mapState.q.toLowerCase();
  return (mapState.fam === "all" || t.family === mapState.fam)
    && (!q || [t.name, t.org, t.city, t.country, (t.standards || []).join(" "), FAMILY[t.family]].join(" ").toLowerCase().includes(q));
}
function renderMap() {
  leafletMap = null;
  const tools = allTools().slice().sort((a, b) => a.name.localeCompare(b.name));
  const nCountries = new Set(tools.map(t => t.country)).size;
  view.innerHTML = `
    ${pageHead("Orchestrator map", `${tools.length} open-source SDL orchestrators across ${nCountries} countries. Pick one from the list or the map.`, `<button class="btn" id="addtool">+ Add a tool</button>`)}
    <div class="mapgrid">
      <section class="tlist-pane" aria-label="Orchestrators">
        <div class="tlist-tools">
          <label class="field"><span class="field-label">Search</span>
            <input type="search" id="mq" placeholder="Name, institution, country, standard…" value="${esc(mapState.q)}" autocomplete="off"></label>
          <div class="seg seg-sm" role="group" aria-label="Integration family">${FAM_OPTS.map(([k, l]) => `<button data-mfam="${k}" aria-pressed="${mapState.fam === k}" class="${mapState.fam === k ? "on" : ""}">${l}</button>`).join("")}</div>
          <p class="count" id="mcount" aria-live="polite"></p>
        </div>
        <ul class="tlist" id="tlist" role="list">${tools.map(t => `
          <li data-tid="${esc(t.id)}"><button class="titem" data-sel="${esc(t.id)}" aria-current="${mapState.selected === t.id}">
            ${logoImg(t, 32)}<span class="titem-body"><span class="titem-name">${esc(t.name)}</span><span class="titem-meta">${esc(place(t) || t.org)}</span></span>
            <i class="dot ${t.family}" title="${esc(FAMILY[t.family])}"></i></button></li>`).join("")}
          <li class="tlist-empty" id="tempty" hidden>No orchestrators match. <button class="linkbtn" id="mclear">Clear filters</button></li>
        </ul>
      </section>
      <div class="map-pane">
        <div id="map" role="region" aria-label="World map of orchestrators"></div>
        <div class="legend"><span><i class="dot formal"></i>Formal standard</span><span><i class="dot hal"></i>Hardware-abstraction layer</span><span><i class="dot agentic"></i>Model-facing (MCP)</span><span><i class="dot bespoke"></i>Bespoke</span><span class="legend-note">Marker size grows with your saved scorecards.</span></div>
      </div>
      <aside class="card detail-pane" id="tooldetail" aria-live="polite"></aside>
    </div>
    <div id="addform"></div>`;

  const markers = {};
  let map = null, ring = "#fff", ringSel = "#000";
  const detail = $("#tooldetail");
  const emptyDetail = () => {
    const formal = tools.filter(t => t.family === "formal").length;
    detail.innerHTML = `<div class="empty-detail"><h2>Select an orchestrator</h2><p class="hint">Choose a name in the list or a marker on the map to see its institution, links, device-integration approach and your scorecards for it.</p>
      <div class="kpis"><div><b>${tools.length}</b><span>tools</span></div><div><b>${formal}</b><span>governed standard</span></div><div><b>${nCountries}</b><span>countries</span></div></div></div>`;
  };
  function select(id, { fly = true, scroll = false } = {}) {
    const t = toolById(id); if (!t) return;
    mapState.selected = id;
    detail.innerHTML = toolDetail(t); wireToolActions(detail);
    view.querySelectorAll(".titem").forEach(b => b.setAttribute("aria-current", String(b.dataset.sel === id)));
    const li = view.querySelector(`.tlist [data-tid="${CSS.escape(id)}"]`), ul = $("#tlist");
    if (li && ul) { const top = li.offsetTop - ul.offsetTop; if (top < ul.scrollTop || top + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = top - ul.clientHeight / 2 + li.offsetHeight / 2; }
    Object.entries(markers).forEach(([k, m]) => { const on = k === id; m.setStyle({ weight: on ? 3 : 1.5, color: on ? ringSel : ring }); m.setRadius(m.options.baseR + (on ? 3 : 0)); if (on) m.bringToFront(); });
    if (fly && map && markers[id]) map.flyTo(markers[id].getLatLng(), Math.max(map.getZoom(), 4), { duration: 0.6 });
    if (scroll && matchMedia("(max-width: 899px)").matches) detail.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", "#map/" + id);
  }
  function applyFilter() {
    let n = 0;
    for (const t of tools) {
      const on = mapMatches(t); if (on) n++;
      const li = view.querySelector(`.tlist [data-tid="${CSS.escape(t.id)}"]`); if (li) li.hidden = !on;
      const m = markers[t.id]; if (m && map) { if (on && !map.hasLayer(m)) m.addTo(map); if (!on && map.hasLayer(m)) map.removeLayer(m); }
    }
    $("#mcount").textContent = `${n} of ${tools.length} orchestrators`;
    $("#tempty").hidden = n > 0;
    view.querySelectorAll("[data-mfam]").forEach(b => { const on = b.dataset.mfam === mapState.fam; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  }
  wireToolActions(view);
  $("#mq").oninput = ev => { mapState.q = ev.target.value; applyFilter(); };
  view.querySelectorAll("[data-mfam]").forEach(b => b.onclick = () => { mapState.fam = b.dataset.mfam; applyFilter(); });
  $("#mclear").onclick = () => { mapState.q = ""; mapState.fam = "all"; $("#mq").value = ""; applyFilter(); };
  view.querySelectorAll(".titem").forEach(b => b.onclick = () => select(b.dataset.sel, { scroll: true }));
  $("#tlist").addEventListener("keydown", ev => {
    if (!["ArrowDown", "ArrowUp"].includes(ev.key)) return;
    const items = [...view.querySelectorAll(".tlist li:not([hidden]) .titem")];
    const i = items.indexOf(document.activeElement); if (i < 0) return;
    ev.preventDefault();
    const next = items[Math.max(0, Math.min(items.length - 1, i + (ev.key === "ArrowDown" ? 1 : -1)))];
    next.focus(); select(next.dataset.sel);
  });
  $("#addtool").onclick = () => drawAddForm();

  if (window.L) {
    map = L.map("map", { worldCopyJump: true, minZoom: 1 }).setView([30, 10], 2);
    map.attributionControl.setPrefix(false);   // drop the "Leaflet" credit; tile credits stay (required by Esri/OSM terms)
    leafletMap = map;
    // Simplified gray basemap; labels come from a separate reference layer and are in English.
    const shade = isDark() ? "Dark" : "Light";
    const esri = layer => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${shade}_Gray_${layer}/MapServer/tile/{z}/{y}/{x}`;
    L.tileLayer(esri("Base"), { attribution: "Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors", maxZoom: 16 }).addTo(map);
    const lp = map.createPane("labels"); lp.style.zIndex = 350; lp.style.pointerEvents = "none";   // above base, below markers
    L.tileLayer(esri("Reference"), { maxZoom: 16, pane: "labels" }).addTo(map);
    const css = getComputedStyle(document.documentElement), tok = n => css.getPropertyValue(n).trim();
    const color = { formal: tok("--m-formal"), hal: tok("--m-hal"), agentic: tok("--m-agentic"), bespoke: tok("--m-bespoke") };
    ring = tok("--m-ring"); ringSel = tok("--m-sel");
    const seen = {};   // offset coincident markers slightly so they stay clickable
    for (const t of tools) {
      const k = `${t.lat.toFixed(1)},${t.lng.toFixed(1)}`; const i = seen[k] = (seen[k] || 0) + 1;
      const n = toolStats(t.name).n;
      markers[t.id] = L.circleMarker([t.lat + (i - 1) * 0.35, t.lng + (i - 1) * 0.35], { radius: 7 + Math.min(n, 6) * 1.5, baseR: 7 + Math.min(n, 6) * 1.5, color: ring, weight: 1.5, fillColor: color[t.family] || tok("--m-bespoke"), fillOpacity: 0.95 })
        .bindTooltip(`<b>${esc(t.name)}</b><br>${esc(t.org)}`, { direction: "top" }).addTo(map).on("click", () => select(t.id));
    }
    // Fit to whichever markers are currently shown (respects list search / family filter).
    const fitAll = (animate = false) => {
      const pts = Object.values(markers).filter(m => map.hasLayer(m)).map(m => m.getLatLng());
      if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 5, animate });
      else map.setView([30, 10], 2, { animate });
    };
    fitAll();
    // Home button, stacked under the zoom +/− control.
    const Home = L.Control.extend({ options: { position: "topleft" }, onAdd() {
      const bar = L.DomUtil.create("div", "leaflet-bar leaflet-control map-home");
      const a = L.DomUtil.create("a", "", bar);
      a.href = "#"; a.title = "Show all orchestrators"; a.setAttribute("role", "button"); a.setAttribute("aria-label", "Show all orchestrators");
      a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>';
      L.DomEvent.disableClickPropagation(bar);
      L.DomEvent.on(a, "click", ev => { L.DomEvent.preventDefault(ev); fitAll(true); });
      return bar;
    } });
    map.addControl(new Home());
  } else {
    $("#map").innerHTML = `<p class="hint map-fallback">The map library could not be loaded (offline?). Use the list.</p>`;
  }
  applyFilter();
  if (mapState.selected && toolById(mapState.selected)) select(mapState.selected); else emptyDetail();
}

function drawAddForm(t) {
  t = t || { id: "", name: "", org: "", city: "", country: "", lat: "", lng: "", website: "", repo: "", docs: "", paper: "", logo: "", family: "bespoke", mech: "", standards: [], notes: "", license: "" };
  const f = (k, label, ph = "", type = "text") => `<label class="field"><span class="field-label">${label}</span><input type="${type}" data-k="${k}" value="${esc(t[k])}" placeholder="${esc(ph)}" step="any"></label>`;
  $("#addform").innerHTML = `<fieldset class="panel"><legend>Add a tool</legend>
    <p class="hint">Stored in this browser. Export to JSON and paste into <code>tools.js</code> to make it permanent. Fields marked * are required.</p>
    <div class="formgrid">
      ${f("name", "Name *", "e.g. MyLabOS")}${f("org", "Institution / group *")}${f("city", "City")}${f("country", "Country")}
      ${f("lat", "Latitude *", "e.g. 43.66", "number")}${f("lng", "Longitude *", "e.g. -79.39", "number")}
      ${f("website", "Website", "https://")}${f("repo", "Repository", "https://github.com/…")}${f("docs", "Docs")}${f("paper", "Paper / DOI", "https://doi.org/…")}
      ${f("logo", "Logo URL", "https://github.com/<org>.png")}${f("license", "Licence", "MIT")}
      <label class="field"><span class="field-label">Integration family *</span><select data-k="family">${Object.entries(FAMILY).map(([k, v]) => `<option value="${k}" ${t.family === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      ${f("standards", "Underlying standards (comma-separated)", "SiLA 2, OPC UA")}
      <label class="field span-2"><span class="field-label">Primary device-integration mechanism</span><input type="text" data-k="mech" value="${esc(t.mech)}"></label>
      <label class="field span-all"><span class="field-label">Notes</span><textarea data-k="notes">${esc(t.notes)}</textarea></label>
    </div>
    <div class="actions"><button class="btn pri" id="savetool">Save in this browser</button><button class="btn" id="issuetool">Submit via GitHub issue ↗</button><button class="btn" id="canceltool">Cancel</button><button class="btn" id="exporttools" ${store.tools.length ? "" : "disabled"}>Export my added tools</button></div></fieldset>`;
  $("#addform").querySelector('[data-k="standards"]').value = (t.standards || []).join(", ");
  $("#canceltool").onclick = () => { $("#addform").innerHTML = ""; };
  $("#issuetool").onclick = () => { const o = {}; $("#addform").querySelectorAll("[data-k]").forEach(i => o[i.dataset.k] = i.value.trim()); if (!o.name || !o.org) { alert("Name and institution are required."); return; } openIssue(toolIssue(o)); };
  $("#exporttools").onclick = () => download("my-tools.json", JSON.stringify(store.tools.map(({ user, ...o }) => o), null, 2), "application/json");
  $("#savetool").onclick = () => {
    const o = { user: true, verified: false, unverified: "Added locally; not part of the curated survey." };
    $("#addform").querySelectorAll("[data-k]").forEach(i => o[i.dataset.k] = i.value.trim());
    o.standards = o.standards ? o.standards.split(",").map(s => s.trim()).filter(Boolean) : [];
    o.lat = parseFloat(o.lat); o.lng = parseFloat(o.lng);
    if (!o.name || !o.org || isNaN(o.lat) || isNaN(o.lng)) { alert("Name, institution, latitude and longitude are required."); return; }
    o.id = "user-" + o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (toolById(o.id)) { alert("A tool with that name already exists."); return; }
    store.tools.push(o); save(); mapState.selected = o.id; renderMap();
  };
  $("#addform").scrollIntoView({ behavior: "smooth" });
}

/* ---------- Orchestrators (Table 2) — filter rail in the style of the DIY Biofabrication Atlas explorer ---------- */
const ORCH_FILTERS = [
  { key: "fam", label: "Integration family", all: "All families", options: () => Object.entries(FAMILY), match: (t, v) => t.family === v },
  { key: "std", label: "Underlying standard", all: "Any standard", options: () => uniq(allTools().flatMap(t => (t.standards || []).map(stdBase))).map(s => [s, s]), match: (t, v) => (t.standards || []).some(s => stdBase(s) === v) },
  { key: "region", label: "Region", all: "All regions", options: () => uniq(allTools().map(regionOf)).map(s => [s, s]), match: (t, v) => regionOf(t) === v },
  { key: "lic", label: "Licence", all: "Any licence", options: () => uniq(allTools().map(t => t.license || "Not specified")).map(s => [s, s]), match: (t, v) => (t.license || "Not specified") === v }
];
const ORCH_TOGGLES = [
  { key: "req", label: "Standard required for every driver", match: t => !!t.enforced },
  { key: "repo", label: "Has public repository", match: t => !!t.repo },
  { key: "docs", label: "Has documentation", match: t => !!t.docs },
  { key: "scored", label: "Has your scorecards", match: t => toolStats(t.name).n > 0 },
  { key: "verified", label: "Hide entries with unverified fields", match: t => t.verified !== false }
];
const uniq = a => [...new Set(a)].sort((x, y) => x.localeCompare(y));
const of = { q: "", sel: {}, tog: {}, view: null };   // sel: { key: [values] } — OR within a filter, AND across filters
try { of.view = localStorage.getItem("sdl-orch-view"); } catch (e) {}
function readOrchParams(p) {
  of.q = p.get("q") || "";
  of.sel = {}; for (const f of ORCH_FILTERS) { const v = (p.get(f.key) || "").split(",").map(s => s.trim()).filter(Boolean); if (v.length) of.sel[f.key] = v; }
  of.tog = {}; for (const t of ORCH_TOGGLES) if (p.get(t.key) === "1") of.tog[t.key] = true;
}
function writeOrchParams() {
  const p = new URLSearchParams();
  if (of.q.trim()) p.set("q", of.q.trim());
  for (const f of ORCH_FILTERS) if (of.sel[f.key]?.length) p.set(f.key, of.sel[f.key].join(","));
  for (const [k, v] of Object.entries(of.tog)) if (v) p.set(k, "1");
  const qs = p.toString().replace(/%2C/g, ",");
  history.replaceState(null, "", "#orchestrators" + (qs ? "?" + qs : ""));
}
const selCount = () => ORCH_FILTERS.reduce((n, f) => n + (of.sel[f.key]?.length || 0), 0);
const togCount = () => Object.values(of.tog).filter(Boolean).length;
const orchActive = () => !!of.q.trim() || selCount() > 0 || togCount() > 0;
function orchMatches(o, skipKey) {
  const q = of.q.toLowerCase().trim();
  return ORCH_FILTERS.every(f => f.key === skipKey || !of.sel[f.key]?.length || of.sel[f.key].some(v => f.match(o, v)))
    && ORCH_TOGGLES.every(t => !of.tog[t.key] || t.match(o))
    && (!q || [o.name, o.org, o.mech, o.notes, (o.standards || []).join(" "), o.country, o.city].join(" ").toLowerCase().includes(q));
}
const msSummary = f => {
  const v = of.sel[f.key] || [], lab = Object.fromEntries(f.options());
  return !v.length ? f.all : v.length === 1 ? lab[v[0]] ?? v[0] : `${lab[v[0]] ?? v[0]} +${v.length - 1}`;
};
function renderOrch() {
  const O = allTools();
  const formal = O.filter(o => o.family === "formal").length, enforced = O.filter(o => o.enforced).length;
  const isWide = matchMedia("(min-width: 900px)").matches;
  const viewMode = of.view || (isWide ? "table" : "cards");
  const nAll = selCount() + togCount();
  view.innerHTML = `
  ${pageHead("Orchestrators", "How each open-source SDL orchestrator connects to instruments, based on direct analysis of its source repository.")}
  <div class="stats">
    <div class="stat"><b>${O.length}</b><span>open-source orchestrators</span></div>
    <div class="stat"><b>${formal}</b><span>consume a formally governed standard</span></div>
    <div class="stat"><b>${enforced}</b><span>require one for every driver</span></div>
    <div class="stat"><b>${O.length - formal}</b><span>bespoke, HAL or model-facing</span></div>
  </div>
  <details class="note"><summary>Inclusion criteria and exclusions</summary>
    <p>Included: an open-source licence and public source; an explicit device-integration layer that commands physical instruments; evidence of use in at least one SDL deployment. Classifications rest on code and documentation review, not maintainer interviews.</p>
    <p>Excluded because they do not drive instruments directly: ${window.EXCLUDED.map(x => `<b>${esc(x.name.replace(/\s*\[[^\]]*\]/, ""))}</b> (${esc(x.why.replace(/\.$/, "").toLowerCase())})`).join("; ")}.</p></details>
  <section class="explorer">
    <aside class="filter-rail" aria-label="Filters"><div class="filter-dock">
      <label class="field"><span class="field-label">Search</span><input type="search" id="oq" placeholder="Name, institution, mechanism, notes…" value="${esc(of.q)}" autocomplete="off"></label>
      <button class="btn filter-toggle" id="ofilters" aria-expanded="false" aria-controls="ofilter-body">Filters${nAll ? ` <span class="badge">${nAll}</span>` : ""}</button>
      <div class="filter-body" id="ofilter-body">
      ${ORCH_FILTERS.map(f => `
        <div class="field ms" data-ms="${f.key}">
          <span class="field-label" id="ms-${f.key}-l">${f.label}</span>
          <button type="button" class="ms-trigger" id="ms-${f.key}-t" aria-haspopup="true" aria-expanded="false" aria-controls="ms-${f.key}-p" aria-labelledby="ms-${f.key}-l ms-${f.key}-v">
            <span class="ms-value" id="ms-${f.key}-v">${esc(msSummary(f))}</span><span class="ms-n-sel" ${of.sel[f.key]?.length ? "" : "hidden"}>${of.sel[f.key]?.length || ""}</span>
            <svg class="ms-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          <div class="ms-panel" id="ms-${f.key}-p" role="group" aria-labelledby="ms-${f.key}-l" hidden>
            <div class="ms-opts">${f.options().map(([v, l]) => `<label class="ms-opt"><input type="checkbox" value="${esc(v)}" ${of.sel[f.key]?.includes(v) ? "checked" : ""}><span class="ms-label">${esc(l)}</span><span class="ms-count" data-v="${esc(v)}"></span></label>`).join("")}</div>
            <div class="ms-foot"><button type="button" class="linkbtn" data-ms-clear>Clear</button><button type="button" class="btn sm" data-ms-done>Done</button></div>
          </div>
        </div>`).join("")}
      <details class="filter-expand" ${togCount() ? "open" : ""}><summary><span>More filters${togCount() ? ` <span class="badge">${togCount()}</span>` : ""}</span><span class="plus" aria-hidden="true">+</span></summary>
        <div class="toggles">${ORCH_TOGGLES.map(t => `<label class="toggle"><input type="checkbox" data-otoggle="${t.key}" ${of.tog[t.key] ? "checked" : ""}><span>${t.label}</span></label>`).join("")}</div></details>
      </div>
      <div class="filter-actions"><span class="count" id="ocount" aria-live="polite"></span><button class="linkbtn" id="oclear" ${orchActive() ? "" : "hidden"}>Clear filters</button></div>
    </div></aside>
    <div class="results">
      <div class="results-bar"><div class="active-chips" id="ochips" aria-label="Active filters"></div>
        <span class="field-label">View</span>
        <div class="seg seg-sm" role="group" aria-label="Results view">
          <button data-oview="cards" aria-pressed="${viewMode === "cards"}" class="${viewMode === "cards" ? "on" : ""}">Cards</button>
          <button data-oview="table" aria-pressed="${viewMode === "table"}" class="${viewMode === "table" ? "on" : ""}">Table</button></div></div>
      <div id="oresults"></div>
    </div>
  </section>`;

  const ft = $("#ofilters"), rail = view.querySelector(".filter-rail");
  const syncChrome = () => {
    const n = selCount() + togCount();
    ft.innerHTML = `Filters${n ? ` <span class="badge">${n}</span>` : ""}`;
    view.querySelector(".filter-expand summary > span").innerHTML = `More filters${togCount() ? ` <span class="badge">${togCount()}</span>` : ""}`;
    for (const f of ORCH_FILTERS) {
      const root = view.querySelector(`[data-ms="${f.key}"]`), k = of.sel[f.key]?.length || 0;
      root.querySelector(".ms-value").textContent = msSummary(f);
      const b = root.querySelector(".ms-n-sel"); b.hidden = !k; b.textContent = k || "";
      root.querySelector(".ms-trigger").classList.toggle("has-sel", k > 0);
      // facet counts: how many tools each option would return given every OTHER active filter
      const base = O.filter(o => orchMatches(o, f.key));
      root.querySelectorAll(".ms-opt").forEach(lbl => {
        const cb = lbl.querySelector("input"), c = base.filter(o => f.match(o, cb.value)).length;
        lbl.querySelector(".ms-count").textContent = c;
        lbl.classList.toggle("is-zero", c === 0 && !cb.checked);
        cb.checked = !!of.sel[f.key]?.includes(cb.value);
      });
    }
    const lab = f => Object.fromEntries(f.options());
    $("#ochips").innerHTML = ORCH_FILTERS.flatMap(f => (of.sel[f.key] || []).map(v => `<button class="chip-x" data-unsel="${f.key}" data-v="${esc(v)}" aria-label="Remove ${esc(f.label)}: ${esc(lab(f)[v] ?? v)}"><span class="chip-k">${esc(f.label.split(" ").pop())}</span>${esc(lab(f)[v] ?? v)}<span aria-hidden="true">×</span></button>`))
      .concat(ORCH_TOGGLES.filter(t => of.tog[t.key]).map(t => `<button class="chip-x" data-untog="${t.key}" aria-label="Remove filter: ${esc(t.label)}">${esc(t.label)}<span aria-hidden="true">×</span></button>`)).join("");
    $("#ochips").querySelectorAll("[data-unsel]").forEach(b => b.onclick = () => { const k = b.dataset.unsel; of.sel[k] = (of.sel[k] || []).filter(x => x !== b.dataset.v); if (!of.sel[k].length) delete of.sel[k]; draw(); });
    $("#ochips").querySelectorAll("[data-untog]").forEach(b => b.onclick = () => { delete of.tog[b.dataset.untog]; view.querySelector(`[data-otoggle="${b.dataset.untog}"]`).checked = false; draw(); });
  };
  const draw = () => {
    const list = O.filter(o => orchMatches(o)).sort((a, b) => a.name.localeCompare(b.name));
    $("#ocount").textContent = `${list.length} of ${O.length} orchestrators`;
    $("#oclear").hidden = !orchActive();
    const empty = `<div class="empty"><p>No orchestrators match these filters.</p><button class="btn" data-clear>Clear filters</button></div>`;
    if (!list.length) $("#oresults").innerHTML = empty;
    else if (viewMode === "cards") $("#oresults").innerHTML = `<div class="ogrid">${list.map(o => { const s = toolStats(o.name); return `
      <article class="card ocard">
        <div class="td-head">${logoImg(o, 40)}<div class="td-title"><h3><a href="#map/${esc(o.id)}">${esc(o.name)}</a></h3><p class="meta">${esc(o.org)}</p></div></div>
        <div class="tags">${familyTags(o)}</div>
        <p class="ocard-mech">${esc(o.mech)}</p>
        <div class="ocard-foot"><span class="meta">${esc(o.license || "—")} · ${esc(place(o) || "—")}</span>
          <span class="meta">${s.n ? `${s.n} scorecard${s.n > 1 ? "s" : ""}` : ""}</span><button class="btn sm" data-score="${esc(o.id)}">Score →</button></div>
      </article>`; }).join("")}</div>`;
    else $("#oresults").innerHTML = `<div class="tablewrap"><table class="otable">
      <colgroup><col class="c-proj"><col class="c-mech"><col class="c-std"><col class="c-notes"><col class="c-act"></colgroup>
      <thead><tr><th scope="col">Project</th><th scope="col">Integration mechanism</th><th scope="col">Standards</th><th scope="col">Notes</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${list.map(o => { const s = toolStats(o.name); const long = (o.notes || "").length > 140; return `<tr>
        <td data-label="Project"><div class="cell-tool">${logoImg(o, 32)}<div class="cell-tool-txt"><a href="#map/${esc(o.id)}"><b>${esc(o.name)}</b></a><div class="meta">${esc(o.org)}</div><div class="meta">${esc([o.license || "Licence not specified", place(o)].filter(Boolean).join(" · "))}</div></div></div></td>
        <td data-label="Integration mechanism">${esc(o.mech)}</td>
        <td data-label="Standards"><div class="tags">${familyTags(o)}</div></td>
        <td data-label="Notes" class="meta"><div class="clamp ${long ? "is-long" : ""}">${esc(o.notes || "—")}</div>${long ? `<button class="linkbtn more" aria-expanded="false">More</button>` : ""}</td>
        <td data-label="Scorecards" class="cell-act">${s.n ? `<span class="meta">${s.n} · best ${s.best ?? "—"}/${s.maxStd ?? "—"}</span>` : ""}<button class="btn sm" data-score="${esc(o.id)}">Score →</button></td></tr>`; }).join("")}
    </tbody></table></div>`;
    $("#oresults").querySelectorAll(".more").forEach(b => b.onclick = () => { const c = b.previousElementSibling, open = !c.classList.contains("open"); c.classList.toggle("open", open); b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "Less" : "More"; });
    wireToolActions($("#oresults"));
    $("#oresults").querySelectorAll("[data-clear]").forEach(b => b.onclick = clearAll);
    syncChrome();
    writeOrchParams();
  };
  const clearAll = () => { of.q = ""; of.sel = {}; of.tog = {}; writeOrchParams(); renderOrch(); };

  // multiselect dropdowns: one open at a time; closes on outside click, Escape or "Done"
  const closeAll = except => view.querySelectorAll(".ms").forEach(ms => { if (ms === except) return; ms.querySelector(".ms-panel").hidden = true; ms.querySelector(".ms-trigger").setAttribute("aria-expanded", "false"); ms.classList.remove("open"); });
  view.querySelectorAll(".ms").forEach(ms => {
    const key = ms.dataset.ms, trig = ms.querySelector(".ms-trigger"), panel = ms.querySelector(".ms-panel");
    const open = on => { closeAll(on ? ms : null); panel.hidden = !on; trig.setAttribute("aria-expanded", String(on)); ms.classList.toggle("open", on); if (on) panel.querySelector("input:not(:disabled)")?.focus(); };
    trig.onclick = () => open(panel.hidden);
    panel.querySelectorAll("input[type=checkbox]").forEach(cb => cb.onchange = () => {
      const cur = new Set(of.sel[key] || []); cb.checked ? cur.add(cb.value) : cur.delete(cb.value);
      if (cur.size) of.sel[key] = [...cur]; else delete of.sel[key];
      draw();
    });
    panel.querySelector("[data-ms-clear]").onclick = () => { delete of.sel[key]; draw(); };
    panel.querySelector("[data-ms-done]").onclick = () => { open(false); trig.focus(); };
    ms.addEventListener("keydown", ev => { if (ev.key === "Escape" && !panel.hidden) { ev.stopPropagation(); open(false); trig.focus(); } });
  });
  if (of._outside) document.removeEventListener("click", of._outside, true);
  of._outside = ev => { if (!ev.target.closest(".ms")) closeAll(null); };
  document.addEventListener("click", of._outside, true);

  draw();
  $("#oq").oninput = ev => { of.q = ev.target.value; draw(); };
  view.querySelectorAll("[data-otoggle]").forEach(c => c.onchange = () => { if (c.checked) of.tog[c.dataset.otoggle] = true; else delete of.tog[c.dataset.otoggle]; draw(); });
  $("#oclear").onclick = clearAll;
  if (of.railOpen) { rail.classList.add("open"); ft.setAttribute("aria-expanded", "true"); }
  ft.onclick = () => { of.railOpen = !rail.classList.contains("open"); rail.classList.toggle("open", of.railOpen); ft.setAttribute("aria-expanded", String(of.railOpen)); };
  view.querySelectorAll("[data-oview]").forEach(b => b.onclick = () => { of.view = b.dataset.oview; try { localStorage.setItem("sdl-orch-view", of.view); } catch (e) {} renderOrch(); });
}

/* ---------- Scenarios & standards (Tables 4, 5) ---------- */
const sf = { instruments: "few", regulated: false, robotics: false, multisite: false, picked: null };
// Precedence follows the paper's scenarios: a cross-site layer sits above everything; robots then dominate the
// integration choice; then regulation; otherwise instrument count separates frugal from shared academic labs.
const SCEN_QS = [
  { key: "instruments", q: "How many instruments will the SDL drive?", opts: [["few", "One or two"], ["many", "Several, multi-vendor"]] },
  { key: "regulated", q: "Is it a regulated environment (GMP, audit trails, validated lifecycle)?", opts: [[false, "No"], [true, "Yes"]] },
  { key: "robotics", q: "Do robots, arms or tracks move labware between instruments?", opts: [[false, "No"], [true, "Yes"]] },
  { key: "multisite", q: "Will experiments be federated across several sites or institutions?", opts: [[false, "No"], [true, "Yes"]] }
];
function pickScenario() {
  if (sf.multisite) return { id: "multisite", why: "you federate across sites — the cross-site layer is chosen above any local device-integration choice" };
  if (sf.robotics) return { id: "robotics", why: "robots move labware — robot and instrument concerns should be separated under one orchestrator" };
  if (sf.regulated) return { id: "regulated", why: "the environment is regulated — audit, lifecycle and enterprise integration drive the choice" };
  return sf.instruments === "few"
    ? { id: "frugal", why: "you drive one or two instruments with no regulation, robots or federation" }
    : { id: "shared", why: "you drive several multi-vendor instruments without regulation, robots or federation" };
}
function renderScen() {
  const S = window.SCENARIOS, st = window.STANDARDS;
  const match = pickScenario(), id = sf.picked || match.id, cur = S.find(s => s.id === id), matched = S.find(s => s.id === match.id);
  const browsing = id !== match.id;
  const cell = v => `<span class="g ${v === "Yes" ? "G" : v === "No" ? "F" : "P"}">${esc(v)}</span>`;
  const hi = new Set(cur.stdCols || []);
  view.innerHTML = `
  ${pageHead("Scenarios &amp; standards", "Which device-integration boundary should be the default for this deployment? The useful question is not “which standard is best?” but which one fits your setup. Answer four questions.")}
  <div class="scen-layout">
    <section class="card scen-qs" aria-labelledby="sq-h"><p class="eyebrow" id="sq-h">Your deployment</p>
      ${SCEN_QS.map((q, i) => `<div class="scen-q"><p class="scen-q-text" id="sq${i}"><span class="n">${i + 1}</span>${q.q}</p>
        <div class="seg" role="radiogroup" aria-labelledby="sq${i}">${q.opts.map(([v, l]) => `<button role="radio" data-sq="${q.key}" data-v="${v}" aria-checked="${sf[q.key] === v}" class="${sf[q.key] === v ? "on" : ""}">${l}</button>`).join("")}</div></div>`).join("")}
      <p class="hint">Precedence: multi-site → robotics → regulation → instrument count. The first “Yes” in that order decides the archetype.</p>
      <button class="linkbtn" id="sreset" ${SCEN_QS.every(q => sf[q.key] === q.opts[0][0]) ? "hidden" : ""}>Reset answers</button>
    </section>
    <section class="card scen-rec ${browsing ? "browsing" : ""}" aria-live="polite">
      <p class="eyebrow">${browsing ? "Browsing another archetype" : "Recommended starting point"}</p>
      <h2>${esc(cur.name)}</h2>
      <p class="scen-start">${esc(cur.rec)}</p>
      <dl class="td-facts">
        <dt>Why this archetype</dt><dd>${esc(cur.why)}</dd>
        <dt>Typical profile</dt><dd>${esc(cur.profile)}</dd>
        <dt>Trade-offs &amp; migration path</dt><dd>${esc(cur.tradeoff)}</dd>
      </dl>
      ${browsing ? `<div class="scen-note"><p>Your answers point to <b>${esc(matched.name)}</b> because ${esc(match.why)}.</p><button class="btn sm" id="sback">Back to my match</button></div>`
        : `<p class="scen-because">Matched because ${esc(match.why)}.</p>`}
    </section>
  </div>
  <h2 class="section-title">All archetypes</h2>
  <div class="scen-list" role="radiogroup" aria-label="Archetypes">
    ${S.map(s => `<button class="scen-item ${s.id === id ? "on" : ""}" role="radio" aria-checked="${s.id === id}" data-pick="${s.id}">
      <span class="scen-item-name">${esc(s.name)}</span><span class="meta">${esc(s.rec)}</span>
      ${s.id === match.id ? '<span class="tag formal">your match</span>' : ""}</button>`).join("")}
  </div>
  <h2 class="section-title">Standards compared</h2>
  <p class="hint scen-hl-note">${hi.size ? `Highlighted: the standard${hi.size > 1 ? "s" : ""} the <b>${esc(cur.name)}</b> archetype recommends.` : `The <b>${esc(cur.name)}</b> archetype does not start from one of these four interfaces.`}</p>
  <div class="scroll"><table class="stable"><thead><tr><th>Criterion</th>${st.cols.map((c, i) => `<th class="${hi.has(i) ? "hl" : ""}">${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${st.rows.map(r => `<tr><th scope="row">${esc(r[0])}</th>${r[1].map((v, i) => `<td class="${hi.has(i) ? "hl" : ""}">${cell(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
  <p class="hint">${esc(st.note)}</p>
  <p class="hint">The scorecard is standards-agnostic: it tests interface behaviour, so a well-documented REST API can outscore a shallow SiLA 2 or OPC UA endpoint that carries only the label. A proprietary endpoint should not, however, receive the same portability credit as a standards-aligned one, because its vocabulary must still be mapped into each orchestrator separately.</p>`;
  view.querySelectorAll("[data-sq]").forEach(b => b.onclick = () => {
    const q = SCEN_QS.find(x => x.key === b.dataset.sq), opt = q.opts.find(([v]) => String(v) === b.dataset.v);
    sf[q.key] = opt[0]; sf.picked = null; renderScen();
    view.querySelector(`[data-sq="${q.key}"][data-v="${b.dataset.v}"]`)?.focus();
  });
  view.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { const id2 = b.dataset.pick; sf.picked = id2 === match.id ? null : id2; renderScen(); view.querySelector(`[data-pick="${id2}"]`)?.focus({ preventScroll: true }); });
  const back = $("#sback"); if (back) back.onclick = () => { sf.picked = null; renderScen(); };
  $("#sreset").onclick = () => { Object.assign(sf, { instruments: "few", regulated: false, robotics: false, multisite: false, picked: null }); renderScen(); };
  // arrow keys inside each radiogroup
  view.querySelectorAll('[role="radiogroup"]').forEach(g => g.addEventListener("keydown", ev => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)) return;
    const items = [...g.querySelectorAll('[role="radio"]')], i = items.indexOf(document.activeElement); if (i < 0) return;
    ev.preventDefault(); const n = items[(i + (ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
    n.click();
  }));
}

/* ---------- Scorecard (Table 7 + Note S1) ---------- */
function renderScore() {
  if (!cur()) {
    if (store.evals.length) store.current = store.evals[0].id;
    else { const e = blank(); store.evals.push(e); store.current = e.id; save(); }
  }
  const e = cur();
  view.innerHTML = `
  ${pageHead("Scorecard", "Score one instrument endpoint against the 21 autonomous-readiness criteria. The verdict follows a fixed sequence of gates; the total only ranks vendors that clear them.")}
  <div class="sc">
    <aside class="side" aria-label="Evaluations">
      <h2 class="rail-title">Evaluations</h2>
      <div class="evals">${store.evals.map(v => { const r = evaluate(v); return `<button class="evitem ${v.id === e.id ? "sel" : ""}" data-sel="${v.id}" aria-current="${v.id === e.id}"><span class="evitem-name">${esc(v.vendor)}</span>${v.orch ? `<span class="meta">→ ${esc(v.orch)}</span>` : ""}<span class="evitem-v ${r.cls}">${esc(r.verdict)}</span>${v.scorecardVersion && window.SCORECARD_VERSION && v.scorecardVersion !== window.SCORECARD_VERSION ? `<span class="meta">scored on v${esc(v.scorecardVersion)}; criteria now v${esc(window.SCORECARD_VERSION)}</span>` : ""}</button>`; }).join("")}</div>
      <div class="btn-row"><button class="btn pri" id="new">New</button><button class="btn" id="dup">Duplicate</button><button class="btn" id="del">Delete</button></div>
      <div class="btn-col">
        <button class="btn sm" id="ex">Load Reader X example</button>
        <div class="btn-row"><button class="btn sm" id="exp">Export JSON</button><label class="btn sm">Import<input type="file" id="imp" accept=".json" hidden></label></div>
      </div>
      <p class="hint">Reader X is a worked example: 36/46 standalone, 39/52 cell-integrated, eligible at the margin.</p>
      <div class="note"><p class="meta">Criteria v${esc(window.SCORECARD_VERSION || "?")}${REPO ? ` · <a href="https://github.com/${esc(REPO)}/blob/main/CHANGELOG.md" target="_blank" rel="noopener">changelog ↗</a>` : ""}</p>
        ${REPO ? `<p class="hint">Offline copies: <a href="https://github.com/${esc(REPO)}/blob/main/scorecard.md" target="_blank" rel="noopener">checklist (.md)</a> · <a href="https://github.com/${esc(REPO)}/raw/main/scorecard-template.xlsx">spreadsheet (.xlsx)</a> · <a href="https://github.com/${esc(REPO)}/raw/main/scorecard-template.csv">.csv</a></p>` : ""}</div>
      <details class="note"><summary>Weights <span class="meta">local only</span></summary>
        <p class="hint">Defaults are the framework’s proposed values. A hazardous workcell may weigh C20/C21 higher; a regulated deployment may weigh C17 higher. Custom weights apply only in this browser: published totals (46 / 52) and <code>devices/*.yml</code> scoring always use the default weights.</p>
        <div class="weights">${CRIT.map(c => `<label class="wrow"><span>C${c.n} <span class="meta">(${c.w})</span></span><input type="number" min="0" max="10" step="1" data-w="${c.n}" value="${wOf(c)}" aria-label="Weight for C${c.n}"></label>`).join("")}</div>
        <button class="btn sm" id="wreset">Reset to default weights</button></details>
    </aside>
    <section id="form" aria-label="Evaluation form"></section>
    <aside class="result" id="result" aria-live="polite"></aside>
  </div>
  <a href="#result" class="minibar" id="minibar" aria-label="Jump to result"></a>`;
  drawForm(e); drawResult(e);
  view.querySelectorAll("[data-sel]").forEach(b => b.onclick = () => { store.current = b.dataset.sel; save(); renderScore(); });
  $("#new").onclick = () => { const n = blank(); store.evals.push(n); store.current = n.id; save(); renderScore(); };
  $("#dup").onclick = () => { const n = JSON.parse(JSON.stringify(e)); n.id = uid(); n.vendor += " (copy)"; store.evals.push(n); store.current = n.id; save(); renderScore(); };
  $("#del").onclick = () => { if (!confirm(`Delete “${e.vendor}”?`)) return; store.evals = store.evals.filter(v => v.id !== e.id); store.current = store.evals[0]?.id || null; save(); renderScore(); };
  $("#ex").onclick = () => {
    const X = window.READER_X;
    const n = blank({ vendor: X.vendor, endpoint: X.endpoint, arch: X.arch, orch: X.orch || "", grades: { ...X.grades }, notes: { ...X.notes }, remed: { ...X.remed }, remedDate: { ...(X.remedDate || {}) }, gap: { ...X.gap }, annot: { ...(X.annot || {}) } });
    n.cyber = n.cyber.map(() => true); n.ctx.cell = true; n.stage = STAGES.length - 1; n.visited = STAGES.map(() => true);
    store.evals.push(n); store.current = n.id; save(); renderScore();
  };
  $("#exp").onclick = () => download("sdl-scorecards.json", JSON.stringify({ evals: store.evals, weights: store.weights }, null, 2), "application/json");
  $("#imp").onchange = ev => {
    const f = ev.target.files[0]; if (!f) return;
    f.text().then(t => { const a = JSON.parse(t); const list = Array.isArray(a) ? a : a.evals || [a]; list.forEach(o => { o.id = uid(); store.evals.push(Object.assign(blank(), o)); }); if (a.weights) store.weights = a.weights; save(); renderScore(); }).catch(() => alert("Could not read that file."));
  };
  view.querySelectorAll("[data-w]").forEach(i => i.onchange = () => { const n = +i.dataset.w, v = parseInt(i.value, 10); const c = CRIT.find(c => c.n === n); if (isNaN(v) || v === c.w) delete store.weights[n]; else store.weights[n] = v; save(); drawForm(e); drawResult(e); });
  $("#wreset").onclick = () => { store.weights = {}; save(); renderScore(); };
  $("#minibar").onclick = ev => { ev.preventDefault(); $("#result").scrollIntoView({ behavior: "smooth", block: "start" }); };
}

/* Staged form. Stage order mirrors the paper's sequential decision logic:
   precondition → Critical floor → Important / local floors → cell floor → weighted total. */
const STAGES = [
  { id: "instrument", title: "Instrument", sub: "What is scored" },
  { id: "context", title: "Deployment", sub: "Activates floors" },
  { id: "pre", title: "Precondition", sub: "Cybersecurity / IT" },
  { id: "C", title: "Critical", sub: "C1–C5" },
  { id: "I", title: "Important", sub: "C6–C18" },
  { id: "X", title: "Cell integration", sub: "C19–C21" },
  { id: "review", title: "Review", sub: "Verdict & evidence" }
];
function stageStatus(e, i, r = evaluate(e)) {
  const id = STAGES[i].id, seen = (e.visited || [])[i];
  if (id === "instrument") return { s: seen && e.vendor.trim() ? "done" : "todo" };
  if (id === "context") return { s: seen ? "done" : "todo" };
  if (id === "pre") return r.blocked ? { s: seen ? "issue" : "todo", note: "blocking" } : { s: "done" };
  if (["C", "I", "X"].includes(id)) {
    if (id === "X" && !e.ctx.cell) return { s: "skip", note: "not cell-deployed" };
    const cs = CRIT.filter(c => c.tier === id), rated = cs.filter(c => e.grades[c.n]).length;
    const g = n => effectiveGrade(e, CRIT.find(c => c.n === n));
    let bad = false;
    if (id === "C") bad = cs.some(c => g(c.n) === "F") || cs.filter(c => g(c.n) === "P").length > 1;
    if (id === "I") bad = cs.filter(c => g(c.n) === "F").reduce((a, c) => a + wOf(c), 0) > 4 || (e.ctx.hazard && g(7) === "F") || (e.ctx.hazard && e.ctx.unattended && g(15) === "F" && !e.mit[15]);
    if (id === "X") bad = g(19) === "F" || [20, 21].some(n => e.ctx["c" + n + "local"] && g(n) === "F");
    if (bad) return { s: "issue", note: `${rated}/${cs.length} · floor not met` };
    return rated === cs.length ? { s: "done", note: `${rated}/${cs.length}` } : { s: rated ? "progress" : "todo", note: `${rated}/${cs.length} rated` };
  }
  return { s: STAGES.slice(0, -1).every((_, k) => ["done", "skip"].includes(stageStatus(e, k, r).s)) ? "done" : "todo" };
}
function goStage(e, i, focusId) {
  e.stage = Math.max(0, Math.min(STAGES.length - 1, i));
  e.visited = e.visited || []; e.visited[e.stage] = true; save();
  drawForm(e); drawResult(e);
  const target = focusId ? document.getElementById(focusId) : $("#form");
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#form .stage-title")?.focus({ preventScroll: true });
}

function drawForm(e) {
  const x = e.ctx;
  if (e.stage == null) e.stage = 0;
  e.visited = e.visited || []; e.visited[e.stage] = true;
  const r = evaluate(e), st = STAGES[e.stage];
  const chk = (path, label) => `<label class="chk"><input type="checkbox" data-ctx="${path}" ${x[path] ? "checked" : ""}><span>${label}</span></label>`;
  const tierNote = { C: "Any Fail disqualifies the vendor regardless of total; at most one Critical criterion may be Partial, and only with a dated remediation commitment.", I: "Failed Important criteria may total at most 4 weighted points, and every Fail needs a documented gap-acceptance decision.", X: "Applies only to cell-deployed instruments. C19 must be at least Partial wherever a machine loads or unloads labware." };
  const icon = s => ({ done: "✓", issue: "!", skip: "–" })[s] || "";

  const stepper = `<ol class="stepper" aria-label="Scorecard stages">${STAGES.map((s, i) => { const ss = stageStatus(e, i, r); return `
    <li><button class="step ${ss.s} ${i === e.stage ? "cur" : ""}" data-stage="${i}" ${i === e.stage ? 'aria-current="step"' : ""}>
      <span class="step-dot" aria-hidden="true">${icon(ss.s) || i + 1}</span>
      <span class="step-txt"><span class="step-title">${s.title}</span><span class="step-sub">${esc(ss.note || s.sub)}</span></span>
      <span class="sr-only">${{ done: "complete", issue: "needs attention", skip: "skipped", progress: "in progress", todo: "not started" }[ss.s]}</span></button></li>`; }).join("")}</ol>`;

  let body = "";
  if (st.id === "instrument") body = `
    <div class="formgrid">
      <label class="field"><span class="field-label">Vendor / instrument</span><input type="text" data-f="vendor" value="${esc(e.vendor)}"></label>
      <label class="field"><span class="field-label">Model</span><input type="text" data-f="model" value="${esc(e.model || "")}" placeholder="needed for a devices/*.yml export"></label>
      <label class="field"><span class="field-label">Category</span><input type="text" data-f="instrumentClass" value="${esc(e.instrumentClass || "")}" placeholder="e.g. plate reader, HPLC"></label>
      <label class="field"><span class="field-label">Firmware / software version</span><input type="text" data-f="firmware" value="${esc(e.firmware || "")}"></label>
      <label class="field"><span class="field-label">Evaluator</span><input type="text" data-f="evaluator" value="${esc(e.evaluator || "")}" placeholder="name, org or handle"></label>
      <label class="field"><span class="field-label">Evidence basis</span><select data-f="evidenceBasis">${["vendor-docs", "hands-on-test", "integrator-report"].map(o => `<option ${(e.evidenceBasis || "vendor-docs") === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
      <label class="field span-2"><span class="field-label">Product URL</span><input type="url" data-f="productUrl" value="${esc(e.productUrl || "")}"></label>
      <label class="field"><span class="field-label">Endpoint scored</span><select data-f="endpoint">${["SiLA 2", "OPC UA + LADS", "REST + OpenAPI", "MCP", "Other"].map(o => `<option ${e.endpoint === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
      <label class="field"><span class="field-label">C1 architecture</span><select data-f="arch">${["Native endpoint", "Vendor edge-controller", "Third-party gateway"].map(o => `<option ${e.arch === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
      ${(() => { const names = allTools().map(o => o.name).sort((a, b) => a.localeCompare(b)), isOther = !!e.orch && !names.includes(e.orch) || e.orchOther;
        return `<label class="field"><span class="field-label">Target orchestrator</span><select id="orchsel"><option value="" ${!e.orch && !isOther ? "selected" : ""}>Not decided</option>${names.map(n => `<option ${e.orch === n && !isOther ? "selected" : ""}>${esc(n)}</option>`).join("")}<option value="__other" ${isOther ? "selected" : ""}>Other (enter name)…</option></select></label>
      <label class="field" id="orchother" ${isOther ? "" : "hidden"}><span class="field-label">Orchestrator name</span><input type="text" data-f="orch" value="${isOther ? esc(e.orch) : ""}" placeholder="e.g. in-house scheduler"></label>`; })()}
      <label class="field"><span class="field-label">Evaluation date</span><input type="date" data-f="date" value="${esc(e.date || "")}"></label>
    </div>
    <p class="hint">Score the endpoint your orchestrator will consume in production; compliance on one endpoint does not transfer to another. The C1 architecture is recorded separately from the C1 grade — prefer native endpoints when offerings are otherwise equivalent.</p>`;
  else if (st.id === "context") body = `
    <p class="hint">These answers decide which conditional floors apply. Set them before grading.</p>
    ${chk("cell", "<b>Cell-integrated deployment</b> — adds C19–C21 (maximum 52 instead of 46)")}
    ${chk("hazard", "<b>Hazardous actuation or blocks shared resources</b> — most HPLCs, incubators, NMRs, centrifuges; operations routinely over ~60 s. Activates the C7 floor.")}
    ${chk("unattended", "<b>Runs unattended</b> — together with hazard, activates the C15 floor")}
    ${x.cell ? `<div class="subhead">Buyer-defined local floors</div>` + chk("c20local", "C20 must be at least Partial — inside a robot work envelope or with hazardous motion") + chk("c21local", "C21 must be at least Partial — hazardous motion, thermal, pressure, optical or chemical hazards") : ""}`;
  else if (st.id === "pre") body = `
    <p class="hint">Not scored, but any missing item blocks procurement before grading starts.</p>
    ${chk("networked", "Instrument has a network-accessible control endpoint")}
    ${x.networked ? chk("isolated", "Used only over a physically isolated segment or dedicated point-to-point link (functionally a local bus)") : ""}
    ${x.networked && x.isolated ? chk("isoAccepted", "Isolation and residual risk documented and formally accepted") : ""}
    ${x.networked && !x.isolated ? `<div class="subhead">Vendor deliverables <span class="meta">${e.cyber.filter(Boolean).length} / ${e.cyber.length}</span></div><div class="subchecks">${window.CYBER.map((c, i) => `<label class="chk"><input type="checkbox" data-cy="${i}" ${e.cyber[i] ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div><button class="btn sm" id="cyall">Mark all supplied</button>` : ""}
    ${!x.networked ? chk("surfaceDoc", "Vendor documented the physical / serial / USB control surfaces, command set and host-side software") : ""}`;
  else if (["C", "I", "X"].includes(st.id)) body = (st.id === "X" && !x.cell)
    ? `<div class="empty"><p>Cell-integration criteria apply only to instruments deployed in a multi-instrument workcell.</p><button class="btn" data-stage="1">Change deployment context</button></div>`
    : `<p class="tier-rule t${st.id}">${tierNote[st.id]}</p>` + CRIT.filter(c => c.tier === st.id).map(c => critCard(e, c)).join("");
  else body = reviewBody(e, r);

  const ss = stageStatus(e, e.stage, r);
  const nextI = e.stage + 1 < STAGES.length ? e.stage + 1 : null;
  $("#form").innerHTML = `${stepper}
    <section class="stage panel-like" aria-labelledby="stage-h">
      <header class="stage-head"><p class="eyebrow">Stage ${e.stage + 1} of ${STAGES.length}</p><h2 class="stage-title" id="stage-h" tabindex="-1">${st.title}${st.id === "C" || st.id === "I" || st.id === "X" ? ` criteria` : ""}</h2>${ss.note && ss.s !== "skip" ? `<span class="stage-status ${ss.s}">${esc(ss.note)}</span>` : ""}</header>
      <div class="stage-body">${body}</div>
      <footer class="stage-nav">
        ${e.stage > 0 ? `<button class="btn" data-stage="${e.stage - 1}">← ${STAGES[e.stage - 1].title}</button>` : "<span></span>"}
        ${nextI != null ? `<button class="btn pri" data-stage="${nextI}">${STAGES[nextI].title} →</button>` : `<button class="btn pri" onclick="window.print()">Print / PDF</button>`}
      </footer>
    </section>`;

  const f = $("#form");
  f.querySelectorAll("[data-stage]").forEach(b => b.onclick = () => goStage(e, +b.dataset.stage));
  f.querySelectorAll("[data-jump]").forEach(b => b.onclick = () => { const n = +b.dataset.jump, c = CRIT.find(c => c.n === n); goStage(e, STAGES.findIndex(s => s.id === c.tier), "C" + n); });
  f.querySelectorAll("[data-f]").forEach(i => i.oninput = () => { e[i.dataset.f] = i.value; save(); drawResult(e); refreshStepper(e); });
  f.querySelectorAll("[data-ctx]").forEach(i => i.onchange = () => { x[i.dataset.ctx] = i.checked; save(); keep(() => { drawForm(e); drawResult(e); }); });
  f.querySelectorAll("[data-cy]").forEach(i => i.onchange = () => { e.cyber[+i.dataset.cy] = i.checked; save(); keep(() => { drawForm(e); drawResult(e); }); });
  f.querySelectorAll("[data-ev]").forEach(i => i.onchange = () => { e.evidence[+i.dataset.ev] = i.checked; save(); drawResult(e); const m = f.querySelector(".ev-count"); if (m) m.textContent = `${e.evidence.filter(Boolean).length} / ${window.EVIDENCE.length}`; });
  const all = $("#cyall"); if (all) all.onclick = () => { e.cyber = e.cyber.map(() => true); save(); keep(() => { drawForm(e); drawResult(e); }); };
  f.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { const n = +b.dataset.n; e.grades[n] = e.grades[n] === b.dataset.g ? undefined : b.dataset.g; save(); keep(() => { drawForm(e); drawResult(e); }); });
  f.querySelectorAll("[data-note]").forEach(i => i.oninput = () => { e.notes[i.dataset.note] = i.value; save(); });
  f.querySelectorAll("[data-rem]").forEach(i => i.oninput = () => { e.remed[i.dataset.rem] = i.value; save(); drawResult(e); });
  f.querySelectorAll("[data-remdate]").forEach(i => i.onchange = () => { e.remedDate[i.dataset.remdate] = i.value; save(); drawResult(e); });
  f.querySelectorAll("[data-gap]").forEach(i => i.onchange = () => { e.gap[i.dataset.gap] = i.checked; save(); drawResult(e); });
  f.querySelectorAll("[data-mit]").forEach(i => i.onchange = () => { e.mit[+i.dataset.mit] = i.checked; save(); keep(() => { drawForm(e); drawResult(e); }); });
  f.querySelectorAll("[data-annot]").forEach(i => i.onchange = () => { e.annot[i.dataset.annot] = i.value; save(); keep(() => { drawForm(e); drawResult(e); }); });
  f.querySelectorAll("[data-req]").forEach(i => i.onchange = () => { const [n, k] = i.dataset.req.split(":").map(Number); const R = (e.reqChecks ||= {}); const a = new Set(R[n] || []); i.checked ? a.add(k) : a.delete(k); R[n] = [...a].sort((x, y) => x - y); save(); const m = i.closest("details").querySelector("summary .meta"); const all = i.closest("ul").querySelectorAll("[data-req]"); m.textContent = `${[...all].filter(x => x.checked).length} / ${all.length} MUST/SHOULD ticked`; });
  f.querySelectorAll("[data-annotdate]").forEach(i => i.onchange = () => { (e.annotDate ||= {})[i.dataset.annotdate] = i.value; save(); drawResult(e); });
  f.querySelectorAll("[data-flag]").forEach(i => i.onchange = () => { e[i.dataset.flag] = i.checked; save(); keep(() => { drawForm(e); drawResult(e); }); });
  const os = $("#orchsel"); if (os) os.onchange = () => {
    const other = os.value === "__other"; e.orchOther = other;
    e.orch = other ? "" : os.value; $("#orchother").hidden = !other;
    if (other) { const i = $("#orchother input"); i.value = ""; i.focus(); }
    save(); drawResult(e); refreshStepper(e);
  };
  const sub = $("#submitsc"); if (sub) sub.onclick = () => openIssue(scorecardIssue(e));
  const dy = $("#devyml"); if (dy) dy.onclick = () => { const { name, text, todo } = toDeviceYAML(e); download(name, text, "text/yaml"); if (todo.length) alert(`Exported with ${todo.length} item(s) to fill in before submitting:\n- ${todo.join("\n- ")}`); };
  const csv2 = $("#csv2"); if (csv2) csv2.onclick = () => download(`${e.vendor.replace(/\W+/g, "_")}_scorecard.csv`, toCSV([e]), "text/csv");
}
function refreshStepper(e) {
  const r = evaluate(e);
  document.querySelectorAll(".stepper .step").forEach((b, i) => { const ss = stageStatus(e, i, r); b.className = `step ${ss.s} ${i === e.stage ? "cur" : ""}`; b.querySelector(".step-sub").textContent = ss.note || STAGES[i].sub; });
}
function reviewBody(e, r) {
  const g = c => effectiveGrade(e, c), x = e.ctx;
  const cs = CRIT.filter(c => c.tier === "C"), is = CRIT.filter(c => c.tier === "I");
  const cF = cs.filter(c => g(c) === "F"), cP = cs.filter(c => g(c) === "P"), iF = is.filter(c => g(c) === "F");
  const failPts = iF.reduce((a, c) => a + wOf(c), 0);
  const row = (n, title, ok, detail) => `<li class="dp ${ok === true ? "ok" : ok === false ? "bad" : "inc"}"><span class="dp-n">${n}</span><div><b>${title}</b><p>${detail}</p></div></li>`;
  const allRated = !r.unrated;
  const path = `<ol class="dpath">
    ${row(1, "Cybersecurity / IT precondition", !r.blocked, r.blocked ? "Blocked — supply the missing deliverables before scoring." : "Cleared.")}
    ${row(2, "Critical floor", cF.length || cP.length > 1 ? false : cs.every(c => e.grades[c.n]) ? true : null, cF.length ? `Fail on ${cF.map(c => "C" + c.n).join(", ")} — disqualifying.` : cP.length > 1 ? `${cP.length} Partials (max 1).` : cP.length === 1 ? `One Partial (C${cP[0].n}) — needs a dated remediation commitment.` : cs.every(c => e.grades[c.n]) ? "All Critical criteria pass." : "Not all Critical criteria rated.")}
    ${row(3, "Important & local floors", failPts > 4 ? false : is.every(c => e.grades[c.n]) ? true : null, `${failPts} / 4 failed weighted points${iF.length ? ` (${iF.map(c => "C" + c.n).join(", ")})` : ""}${x.hazard ? " · C7 floor active" : ""}${x.hazard && x.unattended ? " · C15 floor active" : ""}.`)}
    ${x.cell ? row(4, "Cell-integration floor", g(CRIT[18]) === "F" ? false : CRIT.filter(c => c.tier === "X").every(c => e.grades[c.n]) ? true : null, g(CRIT[18]) === "F" ? "C19 Fail — cannot run unattended in a cell." : "C19 at least Partial or N/A.") : ""}
    ${row(x.cell ? 5 : 4, "Weighted total (ranks eligible vendors)", allRated ? true : null, `${r.headline.p} / ${r.headline.m}${x.cell ? " cell-integrated" : " standalone"} — ${esc(r.verdict)}.`)}
  </ol>`;
  const tiers = ["C", "I", "X"].filter(t => t !== "X" || x.cell);
  const grid = tiers.map(t => `<div class="rgrid-tier"><p class="field-label">${TIER[t]}</p><div class="rgrid">${CRIT.filter(c => c.tier === t).map(c => { const gr = g(c); return `<button class="rcell" data-jump="${c.n}" title="C${c.n} ${esc(c.name)}"><span class="n">C${c.n}</span><span class="g ${gr || "U"}">${gr ? GL[gr] : "—"}</span></button>`; }).join("")}</div></div>`).join("");
  const commits = CRIT.filter(c => (e.remed[c.n] || "").trim()).map(c => `<li><b>C${c.n}</b> ${esc(e.remed[c.n])}${e.remedDate[c.n] ? ` <span class="meta">by ${esc(e.remedDate[c.n])}</span>` : ' <span class="meta">— no date</span>'}</li>`).join("");
  const gaps = CRIT.filter(c => e.gap[c.n] && g(c) === "F").map(c => `<li><b>C${c.n}</b> gap accepted</li>`).join("");
  const mits = Object.keys(e.mit || {}).filter(k => e.mit[k]).map(k => `<li><b>C${k}</b> external mitigation recorded</li>`).join("");
  return `
    <div class="review">
      <div class="rv-block"><h3>Decision path</h3><p class="hint">Applied in order; a later step never overrides an earlier one.</p>${path}</div>
      <div class="rv-block"><h3>Grades</h3><p class="hint">Select a criterion to edit it.</p>${grid}</div>
      <div class="rv-block"><h3>Commitments &amp; decisions</h3>${commits || gaps || mits ? `<ul class="rv-list">${commits}${gaps}${mits}</ul>` : `<p class="hint">None recorded.</p>`}</div>
      <div class="rv-block"><h3>RFP evidence pack <span class="meta ev-count">${e.evidence.filter(Boolean).length} / ${window.EVIDENCE.length}</span></h3>
        <p class="hint">Ask for endpoint-specific evidence rather than general statements of API availability.</p>
        <div class="subchecks">${window.EVIDENCE.map((c, i) => `<label class="chk"><input type="checkbox" data-ev="${i}" ${e.evidence[i] ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div></div>
      <div class="rv-block"><h3>Share</h3><p class="hint">Publish this evaluation to the public registry (reviewed via a GitHub issue), or export it.</p>
        <div class="btn-row"><button class="btn pri" id="submitsc">Submit to public registry ↗</button><button class="btn" id="devyml">Export devices/*.yml</button><button class="btn" id="csv2">Export CSV</button></div>
        <p class="hint">The YAML file is the repository's device-evaluation format: add it under <code>devices/</code> in a pull request, or submit through the issue form and a maintainer converts it.</p></div>
    </div>`;
}

function keep(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

function critCard(e, c) {
  const g = window.GRADING[c.n], cur = e.grades[c.n], eff = effectiveGrade(e, c);
  const opts = ["G", "P", "F"].concat(NA_OK.has(c.n) ? ["NA"] : []);
  const wantsRemed = (c.tier === "C" && cur === "P") || (c.tier === "I" && cur === "F") || (c.tier === "X" && (cur === "P" || cur === "F"));
  const mitLabel = { 15: "Control-session loss handled by a documented external mechanism (cell-level watchdog, hardwired interlock, supervisory power cutoff, or orchestrator-side handling)" }[c.n];
  const flag = (k, t) => `<label class="chk"><input type="checkbox" data-flag="${k}" ${e[k] ? "checked" : ""}><span>${t}</span></label>`;
  const annot = c.n === 17 && cur === "P" ? `<label class="field"><span class="field-label">Partial reason code (required)</span><select data-annot="17"><option value="">—</option>${["P-OLD — certification covers an older version", "P-GAP — implementation or test-coverage gap", "P-UNDOC — evidence not tied to shipped firmware / companion depth undocumented"].map(o => `<option ${e.annot[17] === o.slice(0, o.indexOf(" ")) ? "selected" : ""} value="${o.slice(0, o.indexOf(" "))}">${o}</option>`).join("")}</select></label>
      ${e.annot[17] === "P-OLD" ? `<label class="field"><span class="field-label">Re-certification roadmap target date</span><input type="date" data-annotdate="17" value="${esc(e.annotDate?.[17] || "")}"></label>` : ""}`
    : c.n === 15 && cur === "G" ? flag("c15noReconnect", "Reconnect semantics are not explicit — caps the criterion at Partial") + flag("c15fixedDefault", "Vendor safe default cannot be configured or overridden by the orchestrator — caps the criterion at Partial")
    : c.n === 21 && cur === "NA" ? flag("c21naVerified", "No safety-event source confirmed by schematic, safety I/O declaration or integrator (otherwise the N/A is recorded as unverified); evaluate the instrument under C15 and C10")
    : c.n === 6 && cur === "P" ? `<label class="field"><span class="field-label">Which Partial case?</span><select data-annot="6"><option value="">—</option>${[["a-no-b", "Runtime introspection (a) without state-aware availability (b)"], ["static", "Static contract only (OpenAPI / JSON Schema / IDL), no runtime introspection"]].map(([v, l]) => `<option value="${v}" ${e.annot[6] === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>`
    : c.n === 21 && cur && cur !== "NA" ? `<label class="chk"><input type="checkbox" data-flag="c21aNA" ${e.c21aNA ? "checked" : ""}><span>Sub-test (a) is N/A — no external safety-bus input by design (verify with schematic or integrator; provisional if deployment not final)</span></label>
      ${!e.c21aNA ? `<label class="chk"><input type="checkbox" data-flag="c21fallback" ${e.c21fallback ? "checked" : ""}><span>Sub-test (a) verified by fallback evidence only (fixture, simulator, FAT records, reference customer) — caps the criterion at Partial</span></label>
      ${flag("c21powerPath", "Sub-test (a) met through the power-interruption exception path, without latched-state evidence from the cell controller — caps the criterion at Partial")}` : ""}` : "";
  return `<article class="card crit t${c.tier}" id="C${c.n}">
    <header class="crit-head"><h3><span class="n">C${c.n}</span>${esc(c.name)}</h3><span class="wt">${TIER[c.tier]} · w${wOf(c)}${wOf(c) !== c.w ? ` (paper ${c.w})` : ""} · ${g.effort}</span></header>
    <p class="crit-checks">${esc(c.checks)}</p>
    <div class="crit-grade"><div class="seg" role="group" aria-label="Grade for C${c.n}">${opts.map(o => `<button data-n="${c.n}" data-g="${o}" class="${cur === o ? "on " + o : ""}" aria-pressed="${cur === o}">${GL[o]}</button>`).join("")}</div>
      ${eff !== cur ? `<span class="g P">counts as ${GL[eff]}</span>` : ""}</div>
    ${annot}
    ${cur === "F" && c.tier === "I" ? `<label class="chk"><input type="checkbox" data-gap="${c.n}" ${e.gap[c.n] ? "checked" : ""}><span>Documented institutional gap-acceptance decision (identifies the gap, its procurement risk and any compensating control; still counts toward the 4-point ceiling)</span></label>` : ""}
    ${mitLabel && cur === "F" ? `<label class="chk"><input type="checkbox" data-mit="${c.n}" ${e.mit[c.n] ? "checked" : ""}><span>${mitLabel} — recorded as an institutional deployment decision; the grade is unchanged</span></label>` : ""}
    ${wantsRemed ? `<div class="remed"><label class="field"><span class="field-label">Remediation commitment</span><textarea data-rem="${c.n}" placeholder="What will be fixed and the acceptance test that verifies it">${esc(e.remed[c.n] || "")}</textarea></label><label class="field"><span class="field-label">Target date</span><input type="date" data-remdate="${c.n}" value="${esc(e.remedDate[c.n] || "")}"></label></div>` : ""}
    <label class="field"><span class="field-label sr-only">Evidence / notes for C${c.n}</span><textarea data-note="${c.n}" placeholder="Evidence / notes">${esc(e.notes[c.n] || "")}</textarea></label>
    ${c.full?.requirementItems ? (() => { const items = c.full.requirementItems, ticks = (e.reqChecks || {})[c.n] || [], boxed = items.map((it, i) => /^(MUST|SHOULD)/.test(it.m || "") ? i : -1).filter(i => i >= 0);
      return `<details class="reqlist"><summary>Requirement checklist <span class="meta">${boxed.filter(i => ticks.includes(i)).length} / ${boxed.length} MUST/SHOULD ticked</span></summary><ul class="req">${items.map((it, i) => `<li class="${it.sub ? "sub" : ""}">${boxed.includes(i) ? `<label class="chk"><input type="checkbox" data-req="${c.n}:${i}" ${ticks.includes(i) ? "checked" : ""}><span>` : "<span>"}${it.m ? `<b class="modal">${esc(it.m)}</b> ` : ""}${esc(it.t)}</span>${boxed.includes(i) ? "</label>" : ""}</li>`).join("")}</ul><p class="hint">Ticks are notes for the evaluator; they do not change the grade.</p></details>`; })() : ""}
    <details><summary>How to test and grade</summary>
      <p class="hint"><b>How to test:</b> ${esc(c.hint)}</p>
      <p class="rule"><b class="G">Pass</b> ${esc(g.pass)}</p>
      <p class="rule"><b class="P">Partial</b> ${esc(g.partial)}</p>
      <p class="rule"><b class="F">Fail</b> ${esc(g.fail)}</p>
      ${g.note ? `<p class="rule"><b>Note</b> ${esc(g.note)}</p>` : ""}
    </details>
    ${c.full ? `<details><summary>Full criterion text (v${esc(window.SCORECARD_VERSION)})</summary>
      ${[["Requirement", c.full.requirement], ["Applicability", c.full.applicability], ["Grading", c.full.grading], ["Test", c.full.test], ["Rationale", c.full.rationale]].filter(([, t]) => t).map(([h, t]) => `<p class="hint"><b>${h}:</b></p>${String(t).split(/\n\s*\n/).map(p => `<p class="hint">${esc(p)}</p>`).join("")}`).join("")}
      <p class="hint"><a href="https://github.com/${esc(REPO)}/blob/main/criteria/C${c.n}.yml" target="_blank" rel="noopener">criteria/C${c.n}.yml ↗</a></p>
    </details>` : ""}</article>`;
}

function drawResult(e) {
  const r = evaluate(e);
  const pct = m => m.m ? Math.round(100 * m.p / m.m) : 0;
  const hl = r.headline;
  const ev = e.evidence.filter(Boolean).length;
  $("#result").innerHTML = `
    <div class="verdict ${r.cls}">${esc(r.verdict)}</div>
    <div class="card">
      <p class="field-label">${e.ctx.cell ? "Cell-integrated total (C1–C21)" : "Standalone total (C1–C18)"}</p>
      <p class="score">${hl.p}<span> / ${hl.m}</span></p>
      <div class="bar" role="img" aria-label="${pct(hl)} percent"><i style="width:${pct(hl)}%"></i></div>
      <p class="meta">Standalone <b>${r.pts} / ${r.max}</b>${e.ctx.cell ? ` · Cell-integrated <b>${r.ptsCell} / ${r.maxCell}</b>` : ""}</p>
      <ul class="reasons">${r.reasons.map(x => `<li class="${x.lvl}">${esc(x.t)}</li>`).join("")}</ul>
      <p class="hint">Decision order: precondition → Critical floor → local floors → weighted total. N/A criteria leave the denominator.</p>
      <p class="meta">Evidence pack ${ev} / ${window.EVIDENCE.length}${e.orch ? ` · target ${esc(e.orch)}` : ""}</p>
      <div class="btn-row"><button class="btn sm" onclick="window.print()">Print / PDF</button><button class="btn sm" id="csv">Export CSV</button></div>
    </div>`;
  $("#csv").onclick = () => download(`${e.vendor.replace(/\W+/g, "_")}_scorecard.csv`, toCSV([e]), "text/csv");
  const mb = $("#minibar"); if (mb) mb.innerHTML = `<span class="verdict-dot ${r.cls}"></span><span class="mb-v">${esc(r.verdict)}</span><span class="mb-s">${hl.p} / ${hl.m}</span>`;
}

/* ---------- Compare ---------- */
let cmpPublic = true;
function renderCompare() {
  const E = store.evals.concat(cmpPublic ? PUBLIC : []);
  const toggle = `<label class="toggle"><input type="checkbox" id="cmp-pub" ${cmpPublic ? "checked" : ""}><span>Include public registry (${PUBLIC.length})</span></label>`;
  if (!E.length) { view.innerHTML = `${pageHead("Compare vendors", "", toggle)}<div class="empty"><p>No evaluations yet.</p><a class="btn pri" href="#scorecard">Start a scorecard</a></div>`; $("#cmp-pub").onchange = ev => { cmpPublic = ev.target.checked; renderCompare(); }; return; }
  const R = E.map(evaluate);
  view.innerHTML = `
  ${pageHead("Compare vendors", "Eligibility is decided by the gates and floors; the total only ranks vendors that clear them. A vendor that clears every floor with a moderate total may be the right choice.", `<div class="btn-row">${toggle}<button class="btn" id="cc">Export comparison CSV</button></div>`)}
  <div class="scroll"><table class="ctable">
    <thead><tr><th>Criterion</th>${E.map(v => `<th><span class="th-name">${esc(v.vendor)}${v.pub ? ' <span class="tag">public</span>' : ""}</span><span class="meta">${esc(v.endpoint)} · ${esc(v.arch)}${v.orch ? ` · → ${esc(v.orch)}` : ""}</span></th>`).join("")}</tr></thead>
    <tbody>
      <tr class="sum"><th scope="row">Verdict</th>${R.map(r => `<td><span class="g ${r.cls === "ok" ? "G" : r.cls === "bad" ? "F" : r.cls === "warn" ? "P" : "NA"}">${esc(r.verdict)}</span></td>`).join("")}</tr>
      <tr class="sum"><th scope="row">Standalone</th>${R.map(r => `<td class="num">${r.pts} / ${r.max}</td>`).join("")}</tr>
      <tr class="sum"><th scope="row">Repo floors <span class="meta">score_device.py</span></th>${E.map(v => { const f = SDLScore.repoFloors(v, { criteria: CRIT }); return `<td>${f.unrated ? '<span class="meta">incomplete</span>' : `<span class="g ${f.eligible ? "G" : "F"}">${f.eligible ? "eligible" : "not eligible"}</span>`}</td>`; }).join("")}</tr>
      <tr class="sum last"><th scope="row">Cell-integrated</th>${E.map((v, i) => `<td class="num">${v.ctx.cell ? `${R[i].ptsCell} / ${R[i].maxCell}` : '<span class="meta">—</span>'}</td>`).join("")}</tr>
      ${CRIT.map(c => `<tr><th scope="row"><span class="n">C${c.n}</span> ${esc(c.name)} <span class="meta">w${wOf(c)}</span></th>${E.map(v => { if (c.tier === "X" && !v.ctx.cell) return `<td class="meta">—</td>`; const g = effectiveGrade(v, c); return `<td><span class="g ${g || "U"}">${g ? GL[g] : "—"}</span>${c.n === 17 && v.annot[17] ? ` <span class="meta">${esc(v.annot[17])}</span>` : ""}</td>`; }).join("")}</tr>`).join("")}
    </tbody></table></div>
  <p class="hint"><b>Verdict</b> applies the full procedure (precondition, remediation dates, gap decisions, conditional floors). <b>Repo floors</b> is the three-floor check <code>build/score_device.py</code> applies to <code>devices/*.yml</code>.</p>
  ${E.some(v => v.pub) ? `<h2 class="subhead">Public registry entries</h2><div class="reg-grid">${E.filter(v => v.pub).map(registryCard).join("")}</div>` : ""}`;
  $("#cc").onclick = () => download("sdl-scorecard-comparison.csv", toCSV(E), "text/csv");
  $("#cmp-pub").onchange = ev => { cmpPublic = ev.target.checked; renderCompare(); };
}

function registryCard(v) {
  const ver = v.scorecardVersion, cur = window.SCORECARD_VERSION;
  const links = Object.entries(v.evidenceLinks || {}).map(([n, u]) => `<li><b>C${esc(n)}</b> <a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>`).join("");
  return `<article class="card reg">
    <h3>${esc(v.vendor)}${v.verified ? ' <span class="tag">verified</span>' : ""}</h3>
    <p class="meta">${[v.instrumentClass, v.endpoint, v.arch, v.firmware && `firmware ${v.firmware}`].filter(Boolean).map(esc).join(" · ")}</p>
    <dl class="glossary">
      <dt>Evaluator</dt><dd>${esc(v.submittedBy || "—")}${v.date ? ` · ${esc(v.date)}` : ""}</dd>
      <dt>Evidence basis</dt><dd>${esc(v.evidenceBasis || "—")}</dd>
      <dt>Scorecard version</dt><dd>${esc(ver || "—")}${ver && cur && ver !== cur ? ` <span class="g P">scored against ${esc(ver)}, current is ${esc(cur)}</span>` : ""}</dd>
      ${v.source ? `<dt>Source</dt><dd>${REPO && v.source.startsWith("devices/") ? `<a href="https://github.com/${esc(REPO)}/blob/main/${esc(v.source)}" target="_blank" rel="noopener">${esc(v.source)} ↗</a>` : esc(v.source)}</dd>` : ""}
      ${v.productUrl ? `<dt>Product</dt><dd><a href="${esc(v.productUrl)}" target="_blank" rel="noopener">${esc(v.productUrl)}</a></dd>` : ""}
    </dl>
    ${v.cyberAssumed ? `<p class="hint">The device file does not record the cybersecurity precondition; it is treated as cleared.</p>` : ""}
    ${links ? `<details><summary>Evidence links</summary><ul class="rv-list">${links}</ul></details>` : ""}
    ${v.vendorResponse ? `<details><summary>Vendor response</summary><p class="hint">${esc(v.vendorResponse)}</p></details>` : ""}
  </article>`;
}

/* ---------- About ---------- */
function renderAbout() {
  const steps = [
    ["Map", "#map", "See who builds open-source lab orchestration software, where, and how each one talks to instruments."],
    ["Orchestrators", "#orchestrators", "Filter the 16 surveyed tools by integration approach, standard, region or licence."],
    ["Scenarios", "#scenarios", "Answer four questions about your lab and get a recommended default integration standard."],
    ["Scorecard", "#scorecard", "Before buying an instrument, check whether its control interface is ready for autonomous use."],
    ["Compare", "#compare", "Put several scored instruments side by side."]
  ];
  const terms = [
    ["Self-driving lab (SDL)", "A lab where software plans experiments, runs instruments and reads results in a closed loop, with little or no human input per run."],
    ["Orchestrator", "The software that coordinates instruments and robots into a workflow — the “conductor” of the lab."],
    ["Device-integration standard", "A shared way for software to discover an instrument, send it typed commands, watch its state and get results. Examples: SiLA 2, OPC UA with LADS."],
    ["Endpoint", "The specific interface you connect to (e.g. the instrument’s SiLA 2 server). Score the one your orchestrator will actually use."],
    ["Criterion (C1–C21)", "One testable property of that interface, such as “errors are machine-readable” or “results can be fetched without the vendor GUI”."],
    ["Floor", "A minimum the instrument must meet. Missing a floor makes it ineligible, no matter how high its total score."],
    ["Weighted total", "Pass = 1, Partial = ½, Fail = 0, multiplied by each criterion’s weight. Used only to rank instruments that already cleared every floor."],
    ["Cell integration", "Extra criteria (C19–C21) for instruments that share a workcell with robots: loading, access/motion state and safety events."]
  ];
  view.innerHTML = `
  ${pageHead("About", "What this toolkit is for, how the scorecard decides, and what it does not cover.")}
  <div class="about">
    <div class="about-main">
      <section class="about-sec">
        <h2>The problem in one paragraph</h2>
        <p>Automated labs rarely fail because of the AI or the robots. They stall at the software connection to each instrument. Most vendors expose their own command format, so every lab writes and maintains its own drivers, and those drivers do not carry over to other labs or other orchestration software. Shared, well-specified instrument interfaces turn that repeated effort into reusable infrastructure.</p>
      </section>
      <section class="about-sec">
        <h2>What you can do here</h2>
        <ol class="about-steps">${steps.map(([t, h, d]) => `<li><a href="${h}">${t}</a><span>${d}</span></li>`).join("")}</ol>
      </section>
      <section class="about-sec">
        <h2>How the scorecard reaches a verdict</h2>
        <p>The steps are applied in order. A later step can never override an earlier one.</p>
        <ol class="about-order">
          <li><b>Security precondition.</b> The vendor must supply basic network-security information. Without it the instrument cannot be deployed, so nothing else is scored.</li>
          <li><b>Critical criteria (C1–C5).</b> Can software control it, understand its data types and errors, fetch its results, and use the API without contractual restrictions? Any Fail rules the instrument out.</li>
          <li><b>Important criteria and local floors (C6–C18).</b> These raise or lower integration cost. A small number of Fails can be accepted if documented; hazardous or unattended setups add stricter floors.</li>
          <li><b>Weighted total.</b> Only now is a score computed, and only to rank instruments that passed steps 1–3.</li>
        </ol>
      </section>
      <section class="about-sec">
        <h2>What it does not tell you</h2>
        <ul class="about-list">
          <li>Whether the instrument is physically suited to automation (robot-reachable loading, standard form factors, 24/7 operation).</li>
          <li>Whether it is safe to run unattended. Interlocks, emergency stops and hazard response are system-level checks.</li>
          <li>Whether two instruments give scientifically equivalent results. A shared interface makes them easier to connect, not interchangeable.</li>
        </ul>
      </section>
      <section class="about-sec">
        <h2>Sources and caveats</h2>
        <ul class="about-list">
          <li>Orchestrator classifications rest on code and documentation review and will age within months. Grading text is condensed — confirm the full criterion definition before relying on a rule in a real purchase.</li>
          <li>Weights are proposed defaults, not validated constants. Adjust them to your setting on the Scorecard.</li>
          <li>Institutions, locations, links and logos were looked up separately. Entries marked ⚠ have fields that could not be confirmed.</li>
          <li>Your scorecards and added tools stay in this browser only. Use Export to share them.</li>
        </ul>
      </section>
    </div>
    <aside class="about-aside card"><h2>Key terms</h2>
      <dl class="glossary">${terms.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl>
    </aside>
  </div>`;
}

/* ---------- submissions via GitHub issues ---------- */
const REPO = (window.SITE || {}).repo || "";
const SITE_BASE = () => ((window.SITE || {}).siteUrl || location.href.replace(/[#?].*$/, "").replace(/index\.html$/, "")).replace(/\/$/, "");
const FAMILY_LABEL_ISSUE = { formal: "Formal standard", hal: "Hardware-abstraction layer", agentic: "Model-facing (MCP)", bespoke: "Bespoke conventions" };
function toolIssue(o) {
  const id = (o.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const rec = { id, name: o.name, ref: "", paper: o.paper || "", org: o.org, city: o.city || "", country: o.country || "", lat: parseFloat(o.lat) || null, lng: parseFloat(o.lng) || null,
    website: o.website || "", repo: o.repo || "", docs: o.docs || "", logo: o.logo || "", family: o.family || "bespoke", mech: o.mech || "",
    standards: (o.standards || "").split(",").map(s => s.trim()).filter(Boolean), notes: o.notes || "", license: o.license || "", verified: false, unverified: "Submitted via issue; pending review." };
  return { template: "new-orchestrator.yml", title: `[Orchestrator] ${o.name}`, fields: {
    name: o.name, org: o.org, location: [o.city, o.country].filter(Boolean).join(", "), coords: o.lat && o.lng ? `${o.lat}, ${o.lng}` : "",
    family: FAMILY_LABEL_ISSUE[o.family] || "", standards: o.standards || "", mech: o.mech || "", license: o.license || "",
    links: [o.website, o.repo, o.docs, o.paper].filter(Boolean).join(" "), json: JSON.stringify(rec, null, 2) } };
}
const GRADE_WORD = { G: "Pass", P: "Partial", F: "Fail", NA: "N/A" };
const slugify = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const yq = v => v == null || v === "" ? "null" : JSON.stringify(String(v));
// Grades for a devices/*.yml file. Standalone evaluations grade the cell tier N/A where the
// criterion allows it; anything still missing is flagged for the evaluator.
function deviceGrades(e) {
  const todo = [], out = {};
  for (const c of CRIT) {
    let g = e.grades[c.n];
    if (!g && c.tier === "X" && !e.ctx.cell && NA_OK.has(c.n)) g = "NA";
    if (!g) todo.push(`C${c.n} not graded${c.tier === "X" && !NA_OK.has(c.n) ? " (N/A is not permitted for this criterion)" : ""}`);
    out[c.n] = g;
  }
  return { out, todo };
}
function toDeviceYAML(e) {
  const { out, todo } = deviceGrades(e);
  if (!e.model) todo.push("model is empty");
  if (!e.evaluator) todo.push("evaluator is empty");
  if (e.grades[17] === "P" && !e.annot[17]) todo.push("C17 Partial needs a reason code");
  const name = `${slugify(e.vendor)}-${slugify(e.model || "model")}.yml`;
  const pad = n => `C${n}:`.padEnd(4);
  const note = n => [e.grades[n] === "P" && n === 17 && e.annot[17] ? e.annot[17] : "", e.notes[n] || ""].filter(Boolean).join(" — ");
  const lines = [
    `# Exported from the Device Integration Scorecard web tool on ${new Date().toISOString().slice(0, 10)}.`,
    `# Save as devices/${name}, then run:  uv run python build/score_device.py --check`,
    ...(todo.length ? ["# TODO before submitting:", ...todo.map(t => `#   - ${t}`)] : []),
    "", "device:",
    `  vendor: ${yq(e.vendor)}`, `  model: ${yq(e.model || "TODO")}`, `  category: ${yq(e.instrumentClass)}`,
    `  interface: ${yq(e.endpoint)}`, `  architecture: ${yq(e.arch)}`, `  firmware_version: ${yq(e.firmware)}`, `  product_url: ${yq(e.productUrl)}`,
    "", "evaluation:",
    `  evaluator: ${yq(e.evaluator || "TODO")}`, `  date: ${e.date || new Date().toISOString().slice(0, 10)}`,
    `  scorecard_version: ${e.scorecardVersion || window.SCORECARD_VERSION || "1.0.0"}`,
    `  deployment: ${e.ctx.cell ? "cell-integrated" : "standalone"}`, `  evidence_basis: ${e.evidenceBasis || "vendor-docs"}`,
    "", "scores:",
    ...CRIT.map(c => `  ${pad(c.n)} { grade: ${out[c.n] ? yq(GRADE_WORD[out[c.n]]) : '"Fail"  # TODO not graded'}${note(c.n) ? `, note: ${yq(note(c.n))}` : ""} }`)
  ];
  return { name, text: lines.join("\n") + "\n", todo };
}
function scorecardIssue(e) {
  const { out } = deviceGrades(e);
  const scores = CRIT.map(c => `${`C${c.n}`.padEnd(4)}${c.name}: ${out[c.n] ? GRADE_WORD[out[c.n]] : ""}${e.notes[c.n] || (c.n === 17 && e.annot[17]) ? ` (${[c.n === 17 ? e.annot[17] : "", e.notes[c.n] || ""].filter(Boolean).join(" — ")})` : ""}`).join("\n");
  return { template: "device-scorecard.yml", title: `[device]: ${e.vendor} ${e.model || ""}`.trim(), fields: {
    vendor: e.vendor, model: e.model || "", category: e.instrumentClass || "", interface: e.endpoint, architecture: e.arch,
    deployment: e.ctx.cell ? "cell-integrated" : "standalone", evidence_basis: e.evidenceBasis || "vendor-docs",
    scores, evaluator: e.evaluator || "", firmware: e.firmware || "", product_url: e.productUrl || "" } };
}
function openIssue({ template, title, fields }) {
  if (!REPO) { alert("No submission repository is configured (config.js → repo)."); return; }
  const base = `https://github.com/${REPO}/issues/new`;
  const p = new URLSearchParams({ template, title, ...fields });
  let url = `${base}?${p}`;
  if (url.length > 7500 && fields.json) {   // GitHub truncates very long URLs: hand the JSON over via the clipboard
    const { json, ...rest } = fields;
    navigator.clipboard?.writeText(json).catch(() => {});
    url = `${base}?${new URLSearchParams({ template, title, ...rest, json: "Paste the JSON from your clipboard here." })}`;
    alert("The evaluation JSON is long, so it was copied to your clipboard. Paste it into the “Evaluation JSON” field of the issue.");
  }
  window.open(url, "_blank", "noopener");
}

/* ---------- Team ---------- */
function renderTeam() {
  const A = window.AUTHORS || [], AFF = window.AFFILIATIONS || {}, ORGS = window.ORGS || [];
  const orgs = new Set(A.flatMap(a => a.aff)).size, countries = new Set(A.flatMap(a => a.aff.map(i => (AFF[i] || "").split(",").pop().trim()))).size;
  const mine = store.evals;
  view.innerHTML = `
  ${pageHead("Team", "The people and organisations behind this toolkit, and how to contribute orchestrators and scorecards.")}
  <div class="stats">
    <div class="stat"><b>${A.length}</b><span>contributors</span></div>
    <div class="stat"><b>${ORGS.length}</b><span>organisations</span></div>
    <div class="stat"><b>${countries}</b><span>countries</span></div>
    <div class="stat"><b>${PUBLIC.length}</b><span>public scorecard${PUBLIC.length === 1 ? "" : "s"}</span></div>
  </div>
  <section class="team-sec">
    <h2 class="section-title">Organisations</h2>
    <ul class="orgs">${ORGS.map(o => { const n = A.filter(p => p.aff.some(i => o.aff.includes(i))).length;
      const src = o.logo || (o.icon === "g" ? `https://www.google.com/s2/favicons?domain=${o.domain}&sz=128` : o.icon === "d" ? `https://icons.duckduckgo.com/ip3/${o.domain}.ico` : "");
      return `<li><a class="org" href="https://${esc(o.domain)}" target="_blank" rel="noopener" title="${esc(o.name)}">
        <span class="org-logo ${src ? "" : "mono"}">${src ? `<img src="${esc(src)}" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('mono');this.parentNode.textContent='${esc(o.short)}'">` : esc(o.short)}</span>
        <span class="org-txt"><span class="org-name">${esc(o.name)}</span><span class="meta">${n} contributor${n === 1 ? "" : "s"}</span></span></a></li>`; }).join("")}</ul>
  </section>
  <section class="team-sec">
    <h2 class="section-title">People</h2>
    <p class="hint">Contributors and their affiliations. Project leads are marked.</p>
    <ul class="people">${A.map(a => `<li class="person"><span class="avatar" aria-hidden="true">${esc(a.name.split(/\s+/).map(w => w[0]).filter(c => /[A-ZÀ-Ž]/.test(c)).slice(0, 2).join(""))}</span>
      <span class="person-txt"><span class="person-name">${esc(a.name)}${a.corresponding ? ' <span class="tag formal" title="Project lead">Lead</span>' : ""}</span>
      <span class="meta">${a.aff.map(i => esc(AFF[i] || "")).join(" · ")}</span></span></li>`).join("")}</ul>
  </section>
  <section class="team-sec" id="contribute">
    <h2 class="section-title">Contribute</h2>
    <p class="hint">Submissions open a prefilled GitHub issue in <code>${esc(REPO || "—")}</code>. Maintainers review it, then add the record to <code>tools.js</code> or <code>scorecards.js</code> and rebuild the API.</p>
    <div class="grid">
      <article class="card contrib">
        <h3>Propose an orchestrator</h3>
        <p>Open-source, with an explicit layer that commands physical instruments, and used in at least one self-driving lab.</p>
        <div class="btn-row"><a class="btn pri" href="#map" id="propose-tool">Fill in the form</a><a class="btn" href="https://github.com/${esc(REPO)}/issues/new?template=new-orchestrator.yml" target="_blank" rel="noopener">Blank issue ↗</a></div>
      </article>
      <article class="card contrib">
        <h3>Submit a scorecard</h3>
        <p>Share an instrument evaluation you made on the Scorecard page. Only publish what your vendor contract allows.</p>
        ${mine.length ? `<label class="field"><span class="field-label">Your evaluation</span><select id="pick-sc">${mine.map(v => { const r = evaluate(v); return `<option value="${v.id}">${esc(v.vendor)} — ${esc(r.verdict)}</option>`; }).join("")}</select></label>
          <div class="btn-row"><button class="btn pri" id="submit-sc">Submit to public registry ↗</button></div>`
        : `<div class="btn-row"><a class="btn pri" href="#scorecard">Start a scorecard</a></div>`}
      </article>
      <article class="card contrib">
        <h3>Correct a record</h3>
        <p>Spotted a wrong institution, link or classification? Classifications rest on code and documentation review — corrections are welcome.</p>
        <div class="btn-row"><a class="btn" href="https://github.com/${esc(REPO)}/issues/new?title=${encodeURIComponent("[Correction] ")}" target="_blank" rel="noopener">Open an issue ↗</a></div>
      </article>
    </div>
  </section>`;
  $("#propose-tool").onclick = ev => { ev.preventDefault(); location.hash = "#map"; setTimeout(() => drawAddForm(), 50); };
  const s = $("#submit-sc"); if (s) s.onclick = () => openIssue(scorecardIssue(store.evals.find(v => v.id === $("#pick-sc").value)));
}

/* ---------- API & machine-readable interface ---------- */
function renderApi() {
  const base = SITE_BASE(), v = (window.SITE || {}).apiVersion || "v1", api = p => `${base}/api/${v}/${p}`;
  const eps = [
    ["index.json", "Catalogue of every endpoint, counts, URL interface and submission links."],
    ["tools.json", "All orchestrators with location, links, integration mechanism, standards and linked public scorecards."],
    ["tools/{id}.json", "One orchestrator, e.g. tools/chemos2.json."],
    ["criteria.json", "C1–C21: tier, default weight, what it checks, how to test, Pass / Partial / Fail rule."],
    ["rules.json", "Grade values, tiers, maxima, the sequential decision order and floors."],
    ["scorecards.json", "Public instrument scorecards with status and totals computed by score.js."],
    ["scorecards/{id}.json", "One scorecard, e.g. scorecards/reader-x.json."],
    ["scenarios.json", "Deployment archetypes and recommended default standards."],
    ["standards.json", "Standards comparison: SiLA 2, OPC UA + LADS, REST, MCP."],
    ["schema/evaluation.schema.json", "JSON Schema of an evaluation — what score.js and the Import button accept."],
    ["schema/tool.schema.json", "JSON Schema of an orchestrator record."],
    ["openapi.json", "OpenAPI 3.1 description of all endpoints."]
  ];
  const code = s => `<pre class="code"><code>${esc(s)}</code></pre>`;
  view.innerHTML = `
  ${pageHead("API &amp; machine-readable data", "Everything on this site is also published as static JSON, so scripts and AI agents can search, compare and evaluate without scraping pages. Read-only; no key required.", `<a class="btn" href="${esc(base)}/llms.txt" target="_blank" rel="noopener">llms.txt ↗</a>`)}
  <div class="api-layout">
    <div class="api-main">
      <section class="api-sec"><h2 class="section-title">Endpoints</h2>
        <p class="hint">Base URL <code>${esc(base)}/api/${v}/</code> · all <code>GET</code>, <code>application/json</code>. There is no server-side search: fetch a collection and filter it.</p>
        <div class="tablewrap"><table class="eptable"><thead><tr><th scope="col">Path</th><th scope="col">Returns</th></tr></thead><tbody>
          ${eps.map(([p, d]) => `<tr><td><a href="${esc(api(p.replace("{id}", p.startsWith("tools") ? "chemos2" : "reader-x")))}" target="_blank" rel="noopener"><code>${esc(p)}</code></a></td><td>${esc(d)}</td></tr>`).join("")}
          <tr><td><a href="${esc(base)}/score.js" target="_blank" rel="noopener"><code>/score.js</code></a></td><td>The scoring engine itself (works in Node and the browser). Same code the site uses.</td></tr>
        </tbody></table></div>
      </section>
      <section class="api-sec"><h2 class="section-title">Search and compare</h2>
        <p class="hint">Find orchestrators that support SiLA 2 in Europe, then list public scorecards by status and total.</p>
        ${code(`const tools = (await fetch("${api("tools.json")}").then(r => r.json())).items;
const hits = tools.filter(t => t.standardsBase.includes("SiLA 2") && t.region === "Europe");

const cards = (await fetch("${api("scorecards.json")}").then(r => r.json())).items;
const ranked = cards
  .filter(c => ["eligible", "conditionally_eligible"].includes(c.result.status))
  .sort((a, b) => b.result.standalone.points - a.result.standalone.points);`)}
      </section>
      <section class="api-sec"><h2 class="section-title">Evaluate an instrument</h2>
        <p class="hint">Write an evaluation that matches <a href="${esc(api("schema/evaluation.schema.json"))}" target="_blank" rel="noopener">evaluation.schema.json</a> and score it with the same engine the site uses. Grades: <code>G</code> Pass, <code>P</code> Partial, <code>F</code> Fail, <code>NA</code> (${[...NA_OK].map(n => "C" + n).join(", ")} only).</p>
        ${code(`// Node 18+:  curl -O ${base}/score.js
const { evaluate } = require("./score.js");
const criteria = (await fetch("${api("criteria.json")}").then(r => r.json())).items
  .map(c => ({ n: c.n, w: c.weight, tier: { critical: "C", important: "I", cell_integration: "X" }[c.tier] }));

const result = evaluate({
  vendor: "Acme Reader", endpoint: "SiLA 2",
  cyber: Array(10).fill(true),                 // all precondition deliverables supplied
  grades: { 1: "G", 2: "G", 3: "G", 4: "G", 5: "P", /* … C6–C18 … */ },
  remed: { 5: "Expose metadata via API" }, remedDate: { 5: "2027-06-30" }
}, { criteria });
// → { status: "incomplete" | "eligible" | …, pts, max, reasons: [...] }`)}
        <p class="hint">The resulting JSON can be loaded with <b>Import</b> on the Scorecard page, or submitted with the “Submit a scorecard” issue form.</p>
      </section>
      <section class="api-sec"><h2 class="section-title">In-browser interface</h2>
        <p class="hint">Agents that operate a browser on this site can call <code>window.SDL</code> directly instead of clicking through forms.</p>
        ${code(`SDL.tools({ standard: "SiLA 2", region: "Europe" })   // filtered orchestrators
SDL.criteria()                                         // C1–C21 with weights and rules
SDL.evaluate(evaluation)                               // same result object as score.js
SDL.scorecards()                                       // public registry + this browser's evaluations
SDL.importScorecard(evaluation)                        // adds it to the Scorecard page, returns its id`)}
      </section>
      <section class="api-sec"><h2 class="section-title">URL interface</h2>
        <p class="hint">Page state is in the URL, so links can be generated:</p>
        ${code(`${base}/#map/{toolId}
${base}/#orchestrators?std=SiLA 2,OPC UA&region=Europe&fam=formal&repo=1
${base}/#scorecard`)}
      </section>
    </div>
    <aside class="api-aside">
      <div class="card"><h2>Live check</h2><p class="hint">Fetches the published files from this site.</p><dl class="glossary" id="apilive"><dt>Loading…</dt></dl></div>
      <div class="card"><h2>For AI agents</h2><p class="hint"><a href="${esc(base)}/llms.txt" target="_blank" rel="noopener">llms.txt</a> summarises the data, the decision order and how to compare instruments in a few lines of Markdown.</p></div>
      <div class="card"><h2>Keep it in sync</h2><p class="hint">The JSON is generated from the same files the site reads. After editing data, run:</p>${code("node scripts/build-api.mjs")}</div>
    </aside>
  </div>`;
  Promise.all(["index.json", "tools.json", "scorecards.json"].map(p => fetch(api(p)).then(r => r.ok ? r.json() : Promise.reject(r.status)))).then(([idx, t, s]) => {
    const live = $("#apilive"); if (!live) return;
    live.innerHTML = `<dt>Generated</dt><dd>${esc(new Date(idx.generated).toLocaleString())}</dd><dt>Orchestrators</dt><dd>${t.count}</dd><dt>Public scorecards</dt><dd>${s.count} · ${s.items.map(i => `${esc(i.instrument)}: ${esc(i.result.status.replace(/_/g, " "))} ${i.result.standalone.points}/${i.result.standalone.max}`).join("; ")}</dd><dt>Endpoints</dt><dd>${idx.endpoints.length}</dd>`;
  }).catch(err => { const live = $("#apilive"); if (live) live.innerHTML = `<dt>Not reachable</dt><dd>Could not load the API files (${esc(String(err))}). Run <code>node scripts/build-api.mjs</code> and serve the folder over HTTP.</dd>`; });
}

/* ---------- window.SDL — programmatic interface for browser-based agents ---------- */
window.SDL = Object.freeze({
  version: (window.SITE || {}).apiVersion || "v1",
  tools({ q = "", family, standard, region, license } = {}) {
    const ql = q.toLowerCase();
    return allTools().filter(t => (!family || t.family === family) && (!standard || (t.standards || []).some(s => stdBase(s) === standard))
      && (!region || regionOf(t) === region) && (!license || t.license === license)
      && (!ql || [t.name, t.org, t.mech, t.notes, (t.standards || []).join(" ")].join(" ").toLowerCase().includes(ql)))
      .map(t => ({ id: t.id, name: t.name, organisation: t.org, country: t.country, region: regionOf(t), family: t.family, standards: t.standards || [], mechanism: t.mech, license: t.license, links: { website: t.website, repo: t.repo, docs: t.docs, paper: t.paper } }));
  },
  criteria: () => CRIT.map(c => ({ id: `C${c.n}`, n: c.n, name: c.name, tier: c.tier, weight: wOf(c), checks: c.checks, grading: window.GRADING[c.n] })),
  evaluate: ev => evaluate(Object.assign(blank(), ev)),
  scorecards: () => PUBLIC.concat(store.evals).map(e => { const r = evaluate(e); return { id: e.id, public: !!e.pub, instrument: e.vendor, endpoint: e.endpoint, orchestrator: e.orch, status: r.status, verdict: r.verdict, standalone: { points: r.pts, max: r.max }, cellIntegrated: e.ctx.cell ? { points: r.ptsCell, max: r.maxCell } : null }; }),
  importScorecard(ev) { const n = Object.assign(blank(), ev, { id: uid() }); store.evals.push(n); save(); return n.id; }
});

/* ---------- export ---------- */
function toCSV(list) {
  const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [["criterion", "tier", "weight", ...list.map(v => v.vendor)].map(q).join(",")];
  lines.push(["endpoint / architecture", "", "", ...list.map(v => `${v.endpoint} / ${v.arch}`)].map(q).join(","));
  lines.push(["target orchestrator", "", "", ...list.map(v => v.orch)].map(q).join(","));
  lines.push(["verdict", "", "", ...list.map(v => evaluate(v).verdict)].map(q).join(","));
  lines.push(["standalone", "", "", ...list.map(v => { const r = evaluate(v); return `${r.pts}/${r.max}`; })].map(q).join(","));
  lines.push(["cell-integrated", "", "", ...list.map(v => { const r = evaluate(v); return v.ctx.cell ? `${r.ptsCell}/${r.maxCell}` : ""; })].map(q).join(","));
  for (const c of CRIT) lines.push([`C${c.n} ${c.name}`, TIER[c.tier], wOf(c), ...list.map(v => { const g = effectiveGrade(v, c); return (g ? GL[g] : "") + (v.notes[c.n] ? ` — ${v.notes[c.n]}` : ""); })].map(q).join(","));
  return lines.join("\n");
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

window.__sdl = { evaluate, blank, store, toolStats };
route();
})();

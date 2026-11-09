/* SDL Orchestration Hub — core.
   State (evaluations in localStorage), scoring wrappers, pending submissions, routing, header,
   shared rendering helpers and the window.SDL interface. Pages live in pages-*.js and register
   themselves on window.SDLHub.routes; the router starts on DOMContentLoaded, after every page
   module has loaded. */
(function () {
"use strict";
const H = window.SDLHub = {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const view = $("#view");
const SITE_NAME = "SDL Orchestration Hub";
const GL = { G: "Pass", P: "Partial", F: "Fail", NA: "N/A" };
const GICON = { G: "✓", P: "◐", F: "✕", NA: "–" };
const TIER = { C: "Critical", I: "Important", X: "Cell-integration" };
const FAMILY = { formal: "Formal standard", hal: "Hardware-abstraction layer", agentic: "Model-facing (MCP)", bespoke: "Bespoke conventions" };
const NA_OK = new Set(window.NA_OK || []);   // criteria allowed to grade N/A (from criteria/*.yml via sync.js)
const CRIT = window.CRITERIA;
const GROUPS = window.INSTRUMENT_GROUPS || [];
const groupName = id => (GROUPS.find(g => g.id === id) || {}).name || "";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const smooth = () => reduced() ? "auto" : "smooth";

/* ---------- persistence ---------- */
const KEY = "sdl-scorecard-v2";
const store = { evals: [], current: null, weights: {}, tools: [], ui: {} };
function blank(over = {}) {
  return Object.assign({
    id: uid(), vendor: "", model: "", instrumentClass: "", group: "", tasks: [], interfaces: [],
    endpoint: "SiLA 2", arch: "Native endpoint", date: new Date().toISOString().slice(0, 10),
    ctx: { cell: false, hazard: false, unattended: false, networked: true, isolated: false, isoAccepted: false, surfaceDoc: false, c20local: false, c21local: false },
    cyber: window.CYBER.map(() => false), grades: {}, notes: {}, remed: {}, remedDate: {}, gap: {}, annot: {}, annotDate: {},
    mit: {}, c15noReconnect: false, c15fixedDefault: false, c21fallback: false, c21aNA: false, c21powerPath: false, c21naVerified: false, reqChecks: {},
    scorecardVersion: window.SCORECARD_VERSION || "", evidence: window.EVIDENCE.map(() => false), created: new Date().toISOString()
  }, over);
}
try {
  const s = JSON.parse(localStorage.getItem(KEY) || "null");
  if (s && Array.isArray(s.evals)) Object.assign(store, s, { ui: s.ui || {} });
  else { const old = JSON.parse(localStorage.getItem("sdl-scorecard-v1") || "null"); if (old?.evals) store.evals = old.evals.map(o => Object.assign(blank(), o)); }
} catch (e) {}
store.evals = store.evals.map(e => Object.assign(blank(), e, { tasks: e.tasks || [], interfaces: e.interfaces || [] }));
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
function uid() { return Math.random().toString(36).slice(2, 9); }
const allTools = () => window.TOOLS.concat(store.tools);
const toolById = id => allTools().find(t => t.id === id) || PENDING.tools.find(t => t.id === id);
const evalById = id => store.evals.find(e => e.id === id);
// Display name: local evaluations keep vendor and model apart; registry records already join them.
const nameOf = e => { const v = (e.vendor || "").trim(), m = (e.model || "").trim(); return (!m || v.includes(m) ? v : `${v} ${m}`.trim()) || "Untitled instrument"; };
const wOf = c => store.weights[c.n] ?? c.w;

/* ---------- scoring: shared engine in score.js (also used by the API build and by agents) ---------- */
const effectiveGrade = (e, c) => SDLScore.effectiveGrade(e, c);
const evaluate = e => SDLScore.evaluate(e, { criteria: CRIT, weights: store.weights, cyberCount: window.CYBER.length });
const tone = cls => ({ ok: "G", bad: "F", warn: "P" })[cls] || "NA";
const PUBLIC = (window.PUBLIC_SCORECARDS || []).map(p => Object.assign(blank(), p, { pub: true, tasks: p.tasks || [], interfaces: p.interfaces || [] }));
const gradedCount = e => CRIT.filter(c => (c.tier !== "X" || e.ctx.cell) && e.grades[c.n]).length;
const applicableCount = e => CRIT.filter(c => c.tier !== "X" || e.ctx.cell).length;

/* ---------- pending submissions (open issues from the issue forms) ----------
   Live GitHub API first (cached 10 min per tab), then the build-time snapshot api/v1/submissions.json. */
const REPO = (window.SITE || {}).repo || "";
const FORMS = (window.SCORECARD_SOURCE || {}).issueForms || {};
const PENDING = { tools: [], evals: [], items: [], source: "loading", at: null, error: null };
const SUBS_TTL = 10 * 60 * 1000, SUBS_KEY = "sdl-subs-live";
async function fetchLiveIssues() {
  try { const c = JSON.parse(sessionStorage.getItem(SUBS_KEY) || "null"); if (c && Date.now() - c.t < SUBS_TTL) return { issues: c.issues, at: new Date(c.t).toISOString() }; } catch (e) {}
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(res.status === 404 ? "repository not found or private" : res.status === 403 ? "GitHub API rate limit reached" : `GitHub API ${res.status}`);
  const issues = (await res.json()).filter(i => SDLIssues.isSubmission(i, FORMS)).map(SDLIssues.trim);
  try { sessionStorage.setItem(SUBS_KEY, JSON.stringify({ t: Date.now(), issues })); } catch (e) {}
  return { issues, at: new Date().toISOString() };
}
async function loadSubmissions({ force = false } = {}) {
  if (!window.SDLIssues || !REPO) { PENDING.source = "none"; PENDING.error = "issue parser or repository not configured"; return; }
  if (force) try { sessionStorage.removeItem(SUBS_KEY); } catch (e) {}
  let got = null, liveErr = null;
  try { got = Object.assign(await fetchLiveIssues(), { source: "live" }); }
  catch (e) { liveErr = String(e.message || e); }
  if (!got) {
    try {
      const snap = await fetch("api/v1/submissions.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      got = { issues: snap.issues || [], at: snap.generated, source: "snapshot", snapError: snap.error };
    } catch (e) { got = { issues: [], at: null, source: "none" }; }
  }
  const items = got.issues.map(i => SDLIssues.parse(i, { forms: FORMS, criteria: (window.SCORECARD_SOURCE || {}).criteria || [] }));
  const known = new Set(window.TOOLS.map(t => t.id));
  Object.assign(PENDING, {
    items, source: got.source, at: got.at, error: liveErr, snapError: got.snapError || null,
    tools: items.filter(p => p.kind === "orchestrator" && p.record).map(p => Object.assign({}, p.record, {
      id: `pending-${p.number}`, proposedId: p.record.id, pending: { number: p.number, url: p.url, exists: known.has(p.record.id) } })),
    evals: items.filter(p => p.kind === "device" && p.evaluation).map(p => Object.assign(blank(), p.evaluation, {
      pub: true, pending: { number: p.number, url: p.url, errors: p.errors }, cyber: window.CYBER.map(() => true) }))
  });
}
const pendingTag = p => p ? ` <a class="tag pending" href="${esc(p.url)}" target="_blank" rel="noopener" title="Open submission issue">pending #${p.number}</a>` : "";
/* ---------- small rendering helpers ---------- */
const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16"/>', plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  check: '<path d="m5 12 5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16"/>', code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>', slides: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M12 16v4M8 20h8"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>', doc: '<path d="M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6"/>',
  filter: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>', print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/>', flask: '<path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-10V3"/>', scale: '<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7h6zM18 7l-3 7h6z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>', clipboard: '<rect x="5" y="4" width="14" height="17" rx="1"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
  robot: '<rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M3 12v3M21 12v3"/>', users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>'
};
const icon = (name, size = 16) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
const extLink = (url, label, cls = "") => url ? `<a ${cls ? `class="${cls}" ` : ""}href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}<span class="sr-only"> (opens in a new tab)</span></a>` : "";
const gradePill = (g, opts = {}) => g ? `<span class="g ${g}"${opts.title ? ` title="${esc(opts.title)}"` : ""}><span aria-hidden="true">${GICON[g]}</span> ${GL[g]}</span>` : `<span class="g U">—<span class="sr-only">not graded</span></span>`;
const verdictPill = r => `<span class="vpill ${r.cls}">${esc(r.verdict)}</span>`;
function pageHead(title, lede = "", aside = "", eyebrow = "", cls = "") {
  return `<header class="page-head${cls ? " " + cls : ""}"><div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h1 class="page-title" id="page-title" tabindex="-1">${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</div>${aside ? `<div class="page-actions">${aside}</div>` : ""}</header>`;
}
const REGION = { USA: "North America", Canada: "North America", Germany: "Europe", UK: "Europe", Netherlands: "Europe", Japan: "Asia", China: "Asia", "Republic of Korea": "Asia", "New Zealand": "Oceania" };
const regionOf = t => REGION[t.country] || "Other";
const stdBase = s => s.replace(/\s*\(.*\)\s*$/, "").trim();
const uniq = a => [...new Set(a)].sort((x, y) => x.localeCompare(y));
function logoImg(t, size = 48) {
  const initials = esc(t.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map(w => w[0]).join("").slice(0, 3).toUpperCase());
  return `<span class="logo s${size}">${t.logo ? `<img src="${esc(t.logo)}" alt="" width="${size}" height="${size}" loading="lazy" onerror="this.remove()">` : ""}<span class="ini" aria-hidden="true">${initials}</span></span>`;
}
function familyTags(t) {
  return `<span class="tag ${t.family}">${t.family === "formal" ? (t.enforced ? "standard required" : "standard supported") : FAMILY[t.family]}</span>${(t.standards || []).map(s => `<span class="tag">${esc(s)}</span>`).join("")}`;
}
const place = t => [t.city, t.country].filter(Boolean).join(", ");
const toolLinks = t => [extLink(t.website, "Website"), extLink(t.repo, "Repository"), extLink(t.docs, "Docs"), extLink(t.paper, "Paper")].filter(Boolean).join("");
const toolFlag = t => t.pending ? `<p class="flag">Submitted in ${extLink(t.pending.url, `issue #${t.pending.number}`)} and awaiting review; not part of the curated survey yet.${t.pending.exists ? ` Proposes changes to the existing entry <a href="#orchestrators/${esc(t.proposedId)}">${esc(t.proposedId)}</a>.` : ""}</p>`
  : t.verified === false ? `<p class="flag"><span aria-hidden="true">⚠</span> ${esc(t.unverified || "Some fields are unverified.")}</p>` : "";
function toolDetail(t, { headingLevel = 2 } = {}) {
  const h = `h${headingLevel}`, links = toolLinks(t);
  return `
    <div class="td-head">${logoImg(t, 48)}
      <div class="td-title"><${h}>${esc(t.name)}</${h}>
        <p class="meta">${esc(t.org)}</p>${place(t) ? `<p class="meta">${esc(place(t))}</p>` : ""}</div></div>
    ${links ? `<nav class="td-links" aria-label="Links for ${esc(t.name)}">${links}</nav>` : ""}
    <div class="tags">${familyTags(t)}${t.user ? '<span class="tag">added locally</span>' : ""}${pendingTag(t.pending)}</div>
    ${toolFlag(t)}
    <dl class="td-facts">
      <dt>How it talks to instruments</dt><dd>${esc(t.mech || "—")}</dd>
      ${t.notes ? `<dt>Notes</dt><dd>${esc(t.notes)}</dd>` : ""}
      <dt>Licence</dt><dd>${esc(t.license || "—")}</dd>
    </dl>`;
}

/* ---------- dialog (one shared native <dialog>) ---------- */
const dlg = $("#dlg");
let dlgClose = null;
function openDialog({ title, html, wide = false, onClose = null }) {
  if (!dlg) return;
  if (dlg.open) { dlgClose = null; dlg.close(); }
  $("#dlg-title").innerHTML = title;
  $("#dlg-body").innerHTML = html;
  dlg.classList.toggle("wide", wide);
  dlgClose = onClose;
  dlg.showModal();
  $("#dlg-body").scrollTop = 0;
  return $("#dlg-body");
}
const closeDialog = () => { if (dlg?.open) dlg.close(); };
if (dlg) {
  dlg.addEventListener("close", () => { const f = dlgClose; dlgClose = null; if (f) f(); });
  dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });   // backdrop
  $("#dlg-x").onclick = () => dlg.close();
}

/* ---------- toast (polite status messages) ---------- */
let toastT = null;
function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.hidden = false; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove("on"); setTimeout(() => { t.hidden = true; }, 200); }, 3200);
}

/* ---------- routing ---------- */
const routes = {};
const ALIAS = { map: "orchestrators", scenarios: "standards", compare: "instruments" };
function parseHash() {
  const raw = (location.hash || "#home").slice(1) || "home";
  const [path, qs = ""] = raw.split("?");
  let [name, ...rest] = path.split("/").map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  const params = new URLSearchParams(qs);
  if (name === "map" && !params.has("view")) params.set("view", "map");
  if (name === "compare" && !params.has("view")) params.set("view", "compare");
  name = ALIAS[name] || name;
  return { name: routes[name] ? name : "home", arg: rest.join("/") || "", params };
}
let page = null, booted = false;
function route() {
  const { name, arg, params } = parseHash();
  const R = routes[name];
  if (page === name && R.update && R.update(arg, params) !== false) return;
  page = name;
  document.body.dataset.page = name;
  $$(".mainnav [data-tab]").forEach(a => { const on = a.dataset.tab === name || (name === "score" && a.dataset.tab === "scorecard"); a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
  const inMore = $(`.more-menu [data-tab="${name}"]`);
  $("#more-btn")?.classList.toggle("on", !!inMore);
  const ml = $("#more-label"); if (ml) ml.textContent = inMore ? inMore.querySelector("b").textContent : "More";
  closeMore(); closeDialog();
  R.render(arg, params);
  const t = typeof R.title === "function" ? R.title(arg, params) : R.title;
  document.title = t ? `${t} · ${SITE_NAME}` : `${SITE_NAME} — workflow orchestration and device integration for self-driving labs`;
  if (!R.keepScroll) window.scrollTo(0, 0);
  if (booted) $("#page-title")?.focus({ preventScroll: !!R.keepScroll });
  booted = true;
}
const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };
window.addEventListener("hashchange", route);
// The skip link must not change the hash (the hash is the router's).
$(".skiplink")?.addEventListener("click", ev => { ev.preventDefault(); const t = $("#page-title") || view; t.focus(); t.scrollIntoView({ block: "start" }); });

/* "More" dropdown in the header */
function closeMore() { const m = $("#more-menu"), b = $("#more-btn"); if (m && !m.hidden) { m.hidden = true; b.setAttribute("aria-expanded", "false"); } }
(() => {
  const b = $("#more-btn"), m = $("#more-menu"); if (!b) return;
  const items = () => $$("a", m);
  b.onclick = () => { const open = m.hidden; m.hidden = !open; b.setAttribute("aria-expanded", String(open)); };
  b.addEventListener("keydown", ev => { if (ev.key === "ArrowDown") { ev.preventDefault(); m.hidden = false; b.setAttribute("aria-expanded", "true"); items()[0].focus(); } });
  m.addEventListener("keydown", ev => {
    const it = items(), i = it.indexOf(document.activeElement);
    if (ev.key === "Escape") { closeMore(); b.focus(); }
    else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); it[(i + (ev.key === "ArrowDown" ? 1 : it.length - 1)) % it.length].focus(); }
    else if (ev.key === "Tab") closeMore();
  });
  document.addEventListener("click", ev => { if (!ev.target.closest(".more")) closeMore(); });
})();

/* Theme switch (header): auto follows the OS; light/dark are remembered in this browser. */
const themeHooks = [];
const isDark = () => { const t = document.documentElement.dataset.theme; return t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches); };
const onTheme = fn => themeHooks.push(fn);
const fireTheme = () => themeHooks.forEach(f => { try { f(); } catch (e) {} });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", fireTheme);
function setTheme(mode) {
  if (mode === "light" || mode === "dark") document.documentElement.dataset.theme = mode; else delete document.documentElement.dataset.theme;
  try { mode === "auto" ? localStorage.removeItem("sdl-theme") : localStorage.setItem("sdl-theme", mode); } catch (e) {}
  $$("[data-theme-set]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.themeSet === mode)));
  fireTheme();
}
(() => {
  const cur = document.documentElement.dataset.theme || "auto";
  const sw = $("#theme-switch"); if (!sw) return;
  $$("[data-theme-set]", sw).forEach(b => { b.setAttribute("aria-checked", String(b.dataset.themeSet === cur)); b.onclick = () => setTheme(b.dataset.themeSet); });
  sw.addEventListener("keydown", ev => { if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return; const bs = $$("button", sw), i = bs.indexOf(document.activeElement); if (i < 0) return; ev.preventDefault(); const n = bs[(i + (ev.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click(); });
})();

/* ---------- submissions via GitHub issues ---------- */
const SITE_BASE = () => ((window.SITE || {}).siteUrl || location.href.replace(/[#?].*$/, "").replace(/index\.html$/, "")).replace(/\/$/, "");
function toolIssue(o) {
  const id = (o.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const rec = { id, name: o.name, ref: "", paper: o.paper || "", org: o.org, city: o.city || "", country: o.country || "", lat: parseFloat(o.lat) || null, lng: parseFloat(o.lng) || null,
    website: o.website || "", repo: o.repo || "", docs: o.docs || "", logo: o.logo || "", family: o.family || "bespoke", mech: o.mech || "",
    standards: (o.standards || "").split(",").map(s => s.trim()).filter(Boolean), notes: o.notes || "", license: o.license || "", verified: false, unverified: "Submitted via issue; pending review." };
  return { template: "new-orchestrator.yml", title: `[Orchestrator] ${o.name}`, fields: {
    name: o.name, org: o.org, location: [o.city, o.country].filter(Boolean).join(", "), coords: o.lat && o.lng ? `${o.lat}, ${o.lng}` : "",
    family: FAMILY[o.family] || "", standards: o.standards || "", mech: o.mech || "", license: o.license || "",
    links: [o.website, o.repo, o.docs, o.paper].filter(Boolean).join(" "), json: JSON.stringify(rec, null, 2) } };
}
const slugify = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const yq = v => v == null || v === "" ? "null" : JSON.stringify(String(v));
const yl = a => a && a.length ? `[${a.map(v => JSON.stringify(String(v))).join(", ")}]` : "null";
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
  if (!e.vendor) todo.push("vendor is empty");
  if (!e.model) todo.push("model is empty");
  if (!e.evaluator) todo.push("evaluator is empty");
  if (e.grades[17] === "P" && !e.annot[17]) todo.push("C17 Partial needs a reason code");
  const name = `${slugify(e.vendor)}-${slugify(e.model || "model")}.yml`;
  const pad = n => `C${n}:`.padEnd(4);
  const note = n => [e.grades[n] === "P" && n === 17 && e.annot[17] ? e.annot[17] : "", e.notes[n] || ""].filter(Boolean).join(" — ");
  const lines = [
    `# Exported from the ${SITE_NAME} scorecard on ${new Date().toISOString().slice(0, 10)}.`,
    `# Save as devices/${name}, then run:  uv run python build/score_device.py --check`,
    ...(todo.length ? ["# TODO before submitting:", ...todo.map(t => `#   - ${t}`)] : []),
    "", "device:",
    `  vendor: ${yq(e.vendor || "TODO")}`, `  model: ${yq(e.model || "TODO")}`, `  category: ${yq(e.instrumentClass)}`,
    `  group: ${e.group || "null"}`, `  tasks: ${yl(e.tasks)}`,
    `  interface: ${yq(e.endpoint)}`, `  interfaces: ${yl(uniq([e.endpoint, ...(e.interfaces || [])].filter(Boolean)))}`,
    `  architecture: ${yq(e.arch)}`, `  firmware_version: ${yq(e.firmware)}`, `  product_url: ${yq(e.productUrl)}`,
    "", "evaluation:",
    `  evaluator: ${yq(e.evaluator || "TODO")}`, `  date: ${e.date || new Date().toISOString().slice(0, 10)}`,
    `  scorecard_version: ${e.scorecardVersion || window.SCORECARD_VERSION || "1.0.0"}`,
    `  deployment: ${e.ctx.cell ? "cell-integrated" : "standalone"}`, `  evidence_basis: ${e.evidenceBasis || "vendor-docs"}`,
    "", "scores:",
    ...CRIT.map(c => `  ${pad(c.n)} { grade: ${out[c.n] ? yq(GL[out[c.n]]) : '"Fail"  # TODO not graded'}${note(c.n) ? `, note: ${yq(note(c.n))}` : ""} }`)
  ];
  return { name, text: lines.join("\n") + "\n", todo };
}
function scorecardIssue(e) {
  const { out } = deviceGrades(e);
  const scores = CRIT.map(c => `${`C${c.n}`.padEnd(4)}${c.name}: ${out[c.n] ? GL[out[c.n]] : ""}${e.notes[c.n] || (c.n === 17 && e.annot[17]) ? ` (${[c.n === 17 ? e.annot[17] : "", e.notes[c.n] || ""].filter(Boolean).join(" — ")})` : ""}`).join("\n");
  return { template: "device-scorecard.yml", title: `[device]: ${nameOf(e)}`, fields: {
    vendor: e.vendor, model: e.model || "", category: e.instrumentClass || "", group: groupName(e.group), tasks: (e.tasks || []).join(", "),
    interface: e.endpoint, interfaces: (e.interfaces || []).filter(i => i !== e.endpoint).join(", "), architecture: e.arch,
    deployment: e.ctx.cell ? "cell-integrated" : "standalone", evidence_basis: e.evidenceBasis || "vendor-docs",
    scores, evaluator: e.evaluator || "", firmware: e.firmware || "", product_url: e.productUrl || "" } };
}
function openIssue({ template, title, fields }) {
  if (!REPO) { toast("No submission repository is configured (config.js → repo)."); return; }
  const base = `https://github.com/${REPO}/issues/new`;
  const p = new URLSearchParams({ template, title, ...fields });
  let url = `${base}?${p}`;
  if (url.length > 7500 && fields.json) {   // GitHub truncates very long URLs: hand the JSON over via the clipboard
    const { json, ...rest } = fields;
    navigator.clipboard?.writeText(json).catch(() => {});
    url = `${base}?${new URLSearchParams({ template, title, ...rest, json: "Paste the JSON from your clipboard here." })}`;
    toast("The record is long, so it was copied to your clipboard. Paste it into the issue’s JSON field.");
  }
  window.open(url, "_blank", "noopener");
}

/* ---------- export ---------- */
function toCSV(list) {
  const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [["criterion", "tier", "weight", ...list.map(nameOf)].map(q).join(",")];
  lines.push(["instrument type / group", "", "", ...list.map(v => [v.instrumentClass, groupName(v.group)].filter(Boolean).join(" / "))].map(q).join(","));
  lines.push(["endpoint / architecture", "", "", ...list.map(v => `${v.endpoint} / ${v.arch}`)].map(q).join(","));
  lines.push(["verdict", "", "", ...list.map(v => evaluate(v).verdict)].map(q).join(","));
  lines.push(["standalone", "", "", ...list.map(v => { const r = evaluate(v); return `${r.pts}/${r.max}`; })].map(q).join(","));
  lines.push(["cell-integrated", "", "", ...list.map(v => { const r = evaluate(v); return v.ctx.cell ? `${r.ptsCell}/${r.maxCell}` : ""; })].map(q).join(","));
  for (const c of CRIT) lines.push([`C${c.n} ${c.name}`, TIER[c.tier], wOf(c), ...list.map(v => { const g = effectiveGrade(v, c); return (g ? GL[g] : "") + (v.notes[c.n] ? ` — ${v.notes[c.n]}` : ""); })].map(q).join(","));
  return lines.join("\n");
}
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function keep(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

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
  scorecards: () => PUBLIC.concat(store.evals).map(e => { const r = evaluate(e); return { id: e.id, public: !!e.pub, instrument: nameOf(e), instrumentClass: e.instrumentClass || null, group: e.group || null, tasks: e.tasks || [], endpoint: e.endpoint, status: r.status, verdict: r.verdict, standalone: { points: r.pts, max: r.max }, cellIntegrated: e.ctx.cell ? { points: r.ptsCell, max: r.maxCell } : null }; }),
  importScorecard(ev) { const n = Object.assign(blank(), ev, { id: uid() }); store.evals.push(n); save(); return n.id; }
});

Object.assign(H, {
  $, $$, esc, view, SITE_NAME, GL, GICON, TIER, FAMILY, NA_OK, CRIT, GROUPS, groupName, reduced, smooth,
  store, save, uid, blank, allTools, toolById, evalById, nameOf, wOf, effectiveGrade, evaluate, tone, PUBLIC, PENDING, loadSubmissions,
  gradedCount, applicableCount, pendingTag, icon, extLink, gradePill, verdictPill, pageHead, REGION, regionOf, stdBase, uniq,
  logoImg, familyTags, place, toolLinks, toolFlag, toolDetail, openDialog, closeDialog, toast, routes, parseHash, route, go, isDark, onTheme,
  REPO, SITE_BASE, toolIssue, toDeviceYAML, deviceGrades, scorecardIssue, openIssue, slugify, toCSV, download, keep
});
Object.defineProperty(H, "page", { get: () => page, enumerable: true });
window.__sdl = { evaluate, blank, store };

document.addEventListener("DOMContentLoaded", () => {
  route();
  loadSubmissions().then(() => { const R = routes[page]; if (R && R.onSubmissions) R.onSubmissions(); });
});
})();

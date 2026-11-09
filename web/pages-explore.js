/* SDL Orchestration Hub — Home, Orchestrators (map + explorer in one page) and Standards & scenarios. */
(function (H) {
"use strict";
const { $, $$, esc, view, icon, extLink, pageHead, FAMILY, store, save, allTools, toolById, logoImg, familyTags, place,
  toolLinks, toolFlag, toolDetail, regionOf, stdBase, uniq, PENDING, PUBLIC, CRIT, openDialog, closeDialog, toast, openIssue, toolIssue, download, isDark, smooth } = H;

/* =====================================================================
   HOME
   ===================================================================== */
const CITATION = "Gottstein, W. et al. Talking to instruments: device-integration standards for self-driving laboratories. ChemRxiv (2026). https://doi.org/10.26434/chemrxiv.15009990/v2";
function renderHome() {
  const T = window.TOOLS;
  const tasks = [
    ["compass", "Explore orchestrators", "#orchestrators", "Map, compare and filter open-source orchestrators by how they connect to instruments."],
    ["layers", "Pick an integration standard", "#standards", "Four questions about your lab give you the paper’s recommended starting point, with the trade-offs."],
    ["search", "Find an instrument", "#instruments", "Filter evaluated instruments by task, interface and the capabilities your workflow needs."],
    ["clipboard", "Score an instrument", "#score/new", "Check an instrument’s control interface before you buy: 21 criteria, three floors, one verdict."],
    ["book", "Tutorials", "#tutorials", "Hands-on guides to device integration, starting with building a SiLA 2 connector."]
  ];
  view.innerHTML = `
  <section class="hero" aria-labelledby="page-title">
    <p class="eyebrow">Self-driving laboratories</p>
    <h1 class="hero-title" id="page-title" tabindex="-1">Workflow orchestration for self-driving labs, and the instrument interfaces it depends on</h1>
    <p class="hero-lede">Self-driving labs are growing from single-instrument prototypes into multi-instrument, multi-site platforms. Whether they scale is now decided less by algorithms or robots than by the software layer that orchestrates heterogeneous devices. This hub maps the open-source orchestrators, compares the device-integration standards beneath them, and gives you a testable scorecard for buying autonomous-ready instruments.</p>
    <h2 class="sr-only" id="h-tasks">Where to start</h2>
    <ul class="taskgrid" aria-labelledby="h-tasks">${tasks.map(([ic, t, h, d]) => `<li><a class="taskcard" href="${h}"><span class="taskcard-ic">${icon(ic, 22)}</span><span class="taskcard-t">${t}</span><span class="taskcard-d">${d}</span><span class="taskcard-go" aria-hidden="true">${icon("arrow")}</span></a></li>`).join("")}</ul>
  </section>

  <section class="home-sec stack-sec" aria-labelledby="h-stack">
    <p class="eyebrow">The big picture</p>
    <h2 class="section-title" id="h-stack">Orchestration sits on top; device integration holds it up</h2>
    <div class="stack-cols">
      <p>An <b>orchestrator</b> composes device operations into experiments and workflows: it schedules instruments, tracks labware, recovers from failures and keeps the audit trail. It can only be as reliable as what lies beneath it.</p>
      <p><b>Device integration</b> is everything below the orchestrator that lets software discover, control and monitor an instrument. The paper finds the gap sits mainly at the <b>information-exchange layer</b>: most orchestrators wrap each vendor’s command vocabulary in their own code, so drivers are rebuilt lab by lab and do not transfer.</p>
      <p><b>Agentic control</b> does not change this. Whether a program or a language-model agent drives the instrument, it is only as safe as the interface it exposes; MCP is a peer interface at the information-exchange and client layers, not a new layer above orchestration.</p>
    </div>
    <ol class="stack" aria-label="The five-layer model of an SDL software stack, top to bottom">
      ${window.STACK.map(l => `<li class="layer ${l.focus ? "focus" : ""} ${l.n === 5 ? "orch" : ""}">
        <span class="layer-n" aria-hidden="true">L${l.n}</span>
        <p class="layer-name"><span class="sr-only">Layer ${l.n}: </span>${esc(l.name)} <span class="layer-scope">${esc(l.scope)}</span></p>
        <div class="layer-desc"><p class="layer-does">${esc(l.does)}</p><p class="layer-ex">${esc(l.examples)}</p></div>
        ${(l.links || []).length ? `<p class="layer-links">${l.links.map(([h, t]) => `<a href="${h}">${esc(t)} ${icon("arrow", 14)}</a>`).join("")}</p>` : ""}
      </li>`).join("")}
    </ol>
  </section>

  <section class="home-sec paper" aria-labelledby="h-paper">
    <div class="paper-main">
      <p class="eyebrow">Further reading</p>
      <h2 id="h-paper">Talking to instruments: device-integration standards for self-driving laboratories</h2>
      <p class="meta">Willi Gottstein, Lukas Bromig … Sergio Pablo-García et al. · ChemRxiv preprint, 2026</p>
      <p>Maps the device-integration standards landscape onto the open-source orchestrator ecosystem, compares the leading options with scenario-driven guidance, and turns the requirements of autonomous operation into testable criteria and a weighted procurement scorecard. The supplement holds the full criterion cards (Note S1) and a worked scoring example (Note S2), both reproduced on this site.</p>
      <ul class="paper-points">
        <li><b>Integrations don’t transfer.</b> Most orchestrators build device integration on their own conventions instead of a formally governed standard. Integrations do not carry between labs, orchestrators cannot interoperate, and new SDLs rebuild their device-control layer from scratch.</li>
        <li><b>It is tractable.</b> This is an engineering coordination problem, not a fundamental scientific one — which makes it among the most tractable bottlenecks in autonomous science.</li>
        <li><b>Buyers have leverage.</b> Testable criteria and a weighted procurement scorecard define an autonomous-ready control interface and give institutions the leverage to demand it in their next RFP.</li>
      </ul>
      <div class="btn-row">
        <a class="btn pri" href="https://doi.org/10.26434/chemrxiv.15009990/v2" target="_blank" rel="noopener">Read the preprint ${icon("ext", 14)}<span class="sr-only"> (opens in a new tab)</span></a>
        <button class="btn" id="cite">${icon("copy", 14)} Copy citation</button>
      </div>
    </div>
  </section>`;
  $("#cite").onclick = () => { (navigator.clipboard?.writeText(CITATION) || Promise.reject()).then(() => toast("Citation copied to the clipboard."), () => { openDialog({ title: "Citation", html: `<p class="cite-text">${esc(CITATION)}</p>` }); }); };
}
H.routes.home = { render: renderHome, title: "" };

/* =====================================================================
   ORCHESTRATORS — one page: filter rail + Map / Cards / Table views + detail
   ===================================================================== */
const ORCH_FILTERS = [
  { key: "fam", label: "Integration family", all: "All families", options: () => Object.entries(FAMILY), match: (t, v) => t.family === v },
  { key: "std", label: "Underlying standard", all: "Any standard", options: () => uniq(dataset().flatMap(t => (t.standards || []).map(stdBase))).map(s => [s, s]), match: (t, v) => (t.standards || []).some(s => stdBase(s) === v) },
  { key: "region", label: "Region", all: "All regions", options: () => uniq(dataset().map(regionOf)).map(s => [s, s]), match: (t, v) => regionOf(t) === v },
  { key: "lic", label: "Licence", all: "Any licence", options: () => uniq(dataset().map(t => t.license || "Not specified")).map(s => [s, s]), match: (t, v) => (t.license || "Not specified") === v }
];
const ORCH_TOGGLES = [
  { key: "req", label: "Standard required for every driver", match: t => !!t.enforced },
  { key: "repo", label: "Has public repository", match: t => !!t.repo },
  { key: "docs", label: "Has documentation", match: t => !!t.docs },
  { key: "verified", label: "Hide entries with unverified fields", match: t => t.verified !== false },
  { key: "nopend", label: "Hide pending submissions", match: t => !t.pending }
];
const VIEWS = [["cards", "Cards", "grid"], ["map", "Map", "map"], ["table", "Table", "table"]];
const of = { q: "", sel: {}, tog: {}, view: null, selected: null, railOpen: false, qs: null };
const dataset = () => allTools().concat(PENDING.tools).sort((a, b) => a.name.localeCompare(b.name));
const defaultView = () => of.stored || "cards";
function readOrchParams(p) {
  of.q = p.get("q") || "";
  of.sel = {}; for (const f of ORCH_FILTERS) { const v = (p.get(f.key) || "").split(",").map(s => s.trim()).filter(Boolean); if (v.length) of.sel[f.key] = v; }
  of.tog = {}; for (const t of ORCH_TOGGLES) if (p.get(t.key) === "1") of.tog[t.key] = true;
  of.view = VIEWS.some(v => v[0] === p.get("view")) ? p.get("view") : defaultView();
}
function orchQS() {
  const p = new URLSearchParams();
  p.set("view", of.view);
  if (of.q.trim()) p.set("q", of.q.trim());
  for (const f of ORCH_FILTERS) if (of.sel[f.key]?.length) p.set(f.key, of.sel[f.key].join(","));
  for (const [k, v] of Object.entries(of.tog)) if (v) p.set(k, "1");
  return p.toString().replace(/%2C/g, ",");
}
function writeOrchParams() {
  of.qs = orchQS();
  history.replaceState(null, "", "#orchestrators" + (of.selected ? "/" + encodeURIComponent(of.selected) : "") + "?" + of.qs);
}
const selCount = () => ORCH_FILTERS.reduce((n, f) => n + (of.sel[f.key]?.length || 0), 0);
const togCount = () => Object.values(of.tog).filter(Boolean).length;
const orchActive = () => !!of.q.trim() || selCount() > 0 || togCount() > 0;
function orchMatches(o, skipKey) {
  const q = of.q.toLowerCase().trim();
  return ORCH_FILTERS.every(f => f.key === skipKey || !of.sel[f.key]?.length || of.sel[f.key].some(v => f.match(o, v)))
    && ORCH_TOGGLES.every(t => !of.tog[t.key] || t.match(o))
    && (!q || [o.name, o.org, o.mech, o.notes, (o.standards || []).join(" "), o.country, o.city, FAMILY[o.family]].join(" ").toLowerCase().includes(q));
}
const msSummary = f => {
  const v = of.sel[f.key] || [], lab = Object.fromEntries(f.options());
  return !v.length ? f.all : v.length === 1 ? lab[v[0]] ?? v[0] : `${lab[v[0]] ?? v[0]} +${v.length - 1}`;
};

let leaflet = null, markers = {}, ring = "#fff", ringSel = "#000";
function renderOrch(arg, params) {
  readOrchParams(params);
  of.selected = arg || null;
  leaflet = null; markers = {};
  const curated = allTools(), O = dataset();
  view.innerHTML = `
  ${pageHead("Orchestrators", "Explore the open-source orchestrators used in self-driving labs and identify the ones that suit your setup. For each project you see who develops it, how it connects to instruments, which device-integration standards it supports and its licence, with links to its code, documentation and paper. Narrow the list by integration approach, standard, region or licence, and switch between a map, cards and a comparison table.", "", "", "wide")}
  <details class="note"><summary>What is included, and the four families</summary>
    <p>Included: an open-source licence and public source; an explicit device-integration layer that commands physical instruments; evidence of use in at least one SDL. Classifications rest on code and documentation review, not maintainer interviews — ${H.REPO ? extLink(`https://github.com/${H.REPO}/issues/new?title=${encodeURIComponent("[Correction] ")}`, "corrections are welcome") : "corrections are welcome"}.</p>
    <p>Families summarise Table 2’s “primary integration mechanism”: <b>formal standard</b> (SiLA 2 or OPC UA consumed as a driver contract), <b>hardware-abstraction layer</b> (e.g. Ophyd over EPICS), <b>model-facing</b> (MCP tool contracts) and <b>bespoke conventions</b> (the project’s own base classes or plugins).</p>
    <p>Excluded because they do not drive instruments directly: ${window.EXCLUDED.map(x => `<b>${esc(x.name.replace(/\s*\[[^\]]*\]/, ""))}</b> (${esc(x.why.replace(/\.$/, "").toLowerCase())})`).join("; ")}.</p></details>
  <section class="explorer" aria-label="Orchestrator explorer">
    <section class="filter-rail" aria-label="Filters"><div class="filter-dock">
      <label class="field"><span class="field-label">Search</span><input type="search" id="oq" placeholder="Name, institution, mechanism…" value="${esc(of.q)}" autocomplete="off"></label>
      <button class="btn filter-toggle" id="ofilters" aria-expanded="false" aria-controls="ofilter-body">${icon("filter", 14)} Filters</button>
      <div class="filter-body" id="ofilter-body">
      ${ORCH_FILTERS.map(f => `
        <div class="field ms" data-ms="${f.key}">
          <span class="field-label" id="ms-${f.key}-l">${f.label}</span>
          <button type="button" class="ms-trigger" id="ms-${f.key}-t" aria-haspopup="true" aria-expanded="false" aria-controls="ms-${f.key}-p" aria-labelledby="ms-${f.key}-l ms-${f.key}-v">
            <span class="ms-value" id="ms-${f.key}-v"></span><span class="ms-n-sel" hidden></span>
            <svg class="ms-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          <div class="ms-panel" id="ms-${f.key}-p" role="group" aria-labelledby="ms-${f.key}-l" hidden>
            <div class="ms-opts">${f.options().map(([v, l]) => `<label class="ms-opt"><input type="checkbox" value="${esc(v)}"><span class="ms-label">${esc(l)}</span><span class="ms-count" data-v="${esc(v)}"></span></label>`).join("")}</div>
            <div class="ms-foot"><button type="button" class="linkbtn" data-ms-clear>Clear</button><button type="button" class="btn sm" data-ms-done>Done</button></div>
          </div>
        </div>`).join("")}
      <details class="filter-expand" ${togCount() ? "open" : ""}><summary><span>More filters</span><span class="plus" aria-hidden="true">+</span></summary>
        <div class="toggles">${ORCH_TOGGLES.map(t => `<label class="toggle"><input type="checkbox" data-otoggle="${t.key}" ${of.tog[t.key] ? "checked" : ""}><span>${t.label}</span></label>`).join("")}</div></details>
      </div>
      <div class="filter-actions" id="oactions" hidden><button class="linkbtn" id="oclear">Clear filters</button></div>
    </div></section>
    <div class="results">
      <h2 class="sr-only">Results</h2>
      <p class="sr-only" id="ocount" aria-live="polite"></p>
      <div class="results-bar"><div class="active-chips" id="ochips" aria-label="Active filters"></div>
        <div class="seg seg-sm seg-ic" role="group" aria-label="Show results as">
          ${VIEWS.map(([k, l, ic]) => `<button data-oview="${k}" aria-pressed="${of.view === k}" class="${of.view === k ? "on" : ""}">${icon(ic, 14)}${l}</button>`).join("")}</div>
        <button class="btn sm" id="addtool">${icon("plus", 14)} Propose a tool</button></div>
      <div id="oresults"></div>
    </div>
  </section>
  <div id="addform"></div>`;

  const ft = $("#ofilters"), rail = $(".filter-rail", view);
  const syncChrome = () => {
    const n = selCount() + togCount();
    ft.innerHTML = `${icon("filter", 14)} Filters${n ? ` <span class="badge">${n}</span>` : ""}`;
    $(".filter-expand summary > span", view).innerHTML = `More filters${togCount() ? ` <span class="badge">${togCount()}</span>` : ""}`;
    for (const f of ORCH_FILTERS) {
      const root = $(`[data-ms="${f.key}"]`, view), k = of.sel[f.key]?.length || 0;
      $(".ms-value", root).textContent = msSummary(f);
      const b = $(".ms-n-sel", root); b.hidden = !k; b.textContent = k || "";
      $(".ms-trigger", root).classList.toggle("has-sel", k > 0);
      const base = O.filter(o => orchMatches(o, f.key));   // facet counts given every OTHER active filter
      $$(".ms-opt", root).forEach(lbl => {
        const cb = $("input", lbl), c = base.filter(o => f.match(o, cb.value)).length;
        $(".ms-count", lbl).textContent = c;
        lbl.classList.toggle("is-zero", c === 0 && !cb.checked);
        cb.checked = !!of.sel[f.key]?.includes(cb.value);
      });
    }
    const lab = f => Object.fromEntries(f.options());
    $("#ochips").innerHTML = ORCH_FILTERS.flatMap(f => (of.sel[f.key] || []).map(v => `<button class="chip-x" data-unsel="${f.key}" data-v="${esc(v)}" aria-label="Remove filter ${esc(f.label)}: ${esc(lab(f)[v] ?? v)}"><span class="chip-k">${esc(f.label.split(" ").pop())}</span>${esc(lab(f)[v] ?? v)}<span aria-hidden="true">×</span></button>`))
      .concat(ORCH_TOGGLES.filter(t => of.tog[t.key]).map(t => `<button class="chip-x" data-untog="${t.key}" aria-label="Remove filter: ${esc(t.label)}">${esc(t.label)}<span aria-hidden="true">×</span></button>`)).join("");
    $$("[data-unsel]", $("#ochips")).forEach(b => b.onclick = () => { const k = b.dataset.unsel; of.sel[k] = (of.sel[k] || []).filter(x => x !== b.dataset.v); if (!of.sel[k].length) delete of.sel[k]; draw(); });
    $$("[data-untog]", $("#ochips")).forEach(b => b.onclick = () => { delete of.tog[b.dataset.untog]; $(`[data-otoggle="${b.dataset.untog}"]`, view).checked = false; draw(); });
  };

  const draw = () => {
    const list = O.filter(o => orchMatches(o));
    $("#ocount").textContent = `${list.length} of ${O.length} orchestrators`;
    $("#oactions").hidden = !orchActive();
    const res = $("#oresults");
    if (of.view === "map") drawMapView(res, O, list);
    else {
      leaflet = null; markers = {};
      if (!list.length) res.innerHTML = `<div class="empty"><p>No orchestrators match these filters.</p><button class="btn" data-clear>Clear filters</button></div>`;
      else if (of.view === "cards") res.innerHTML = `<ul class="ogrid">${list.map(o => { const links = toolLinks(o), long = (o.notes || "").length > 180; return `
        <li class="card ocard ${of.selected === o.id ? "is-sel" : ""}" id="tool-${esc(o.id)}">
          <div class="td-head">${logoImg(o, 48)}<div class="td-title"><h3>${esc(o.name)}</h3><p class="meta">${esc(o.org)}</p>${place(o) ? `<p class="meta">${esc(place(o))}</p>` : ""}</div></div>
          ${links ? `<nav class="td-links" aria-label="Links for ${esc(o.name)}">${links}</nav>` : ""}
          <div class="tags">${familyTags(o)}${o.user ? '<span class="tag">added locally</span>' : ""}${H.pendingTag(o.pending)}</div>
          ${toolFlag(o)}
          <dl class="td-facts">
            <dt>How it talks to instruments</dt><dd>${esc(o.mech || "—")}</dd>
            ${o.notes ? `<dt>Notes</dt><dd><div class="clamp ${long ? "is-long" : ""}">${esc(o.notes)}</div>${long ? `<button class="linkbtn more" aria-expanded="false">More</button>` : ""}</dd>` : ""}
            <dt>Licence</dt><dd>${esc(o.license || "Not specified")}</dd>
          </dl>
          ${typeof o.lat === "number" ? `<div class="ocard-foot"><button class="linkbtn" data-onmap="${esc(o.id)}">${icon("map", 14)} Show on map<span class="sr-only">: ${esc(o.name)}</span></button></div>` : ""}
        </li>`; }).join("")}</ul>`;
      else res.innerHTML = `<div class="tablewrap"><table class="otable">
        <caption class="sr-only">Orchestrators and their device-integration approach</caption>
        <colgroup><col class="c-proj"><col class="c-mech"><col class="c-std"><col class="c-notes"></colgroup>
        <thead><tr><th scope="col">Project</th><th scope="col">Integration mechanism</th><th scope="col">Standards</th><th scope="col">Notes</th></tr></thead><tbody>
        ${list.map(o => { const links = toolLinks(o), long = (o.notes || "").length > 140; return `<tr id="tool-${esc(o.id)}" class="${of.selected === o.id ? "is-sel" : ""}">
          <td data-label="Project"><div class="cell-tool">${logoImg(o, 32)}<div class="cell-tool-txt"><b class="cell-name">${esc(o.name)}</b><div class="meta">${esc(o.org)}</div><div class="meta">${esc([o.license || "Licence not specified", place(o)].filter(Boolean).join(" · "))}</div>${links ? `<div class="cell-links">${links}</div>` : ""}</div></div></td>
          <td data-label="Integration mechanism">${esc(o.mech)}</td>
          <td data-label="Standards"><div class="tags">${familyTags(o)}${H.pendingTag(o.pending)}</div></td>
          <td data-label="Notes" class="meta"><div class="clamp ${long ? "is-long" : ""}">${esc(o.notes || "—")}</div>${long ? `<button class="linkbtn more" aria-expanded="false">More</button>` : ""}${o.verified === false || o.pending ? `<div class="cell-flag">${toolFlag(o)}</div>` : ""}</td></tr>`; }).join("")}
      </tbody></table></div>`;
      $$(".more", res).forEach(b => b.onclick = () => { const c = b.previousElementSibling, open = !c.classList.contains("open"); c.classList.toggle("open", open); b.setAttribute("aria-expanded", String(open)); b.textContent = open ? "Less" : "More"; });
      $$("[data-clear]", res).forEach(b => b.onclick = clearAll);
    }
    $$("[data-onmap]", res).forEach(b => b.onclick = () => { of.selected = b.dataset.onmap; setView("map", false); window.scrollTo({ top: $(".explorer").offsetTop - 16, behavior: smooth() }); });
    syncChrome();
    writeOrchParams();
  };
  const clearAll = () => { of.q = ""; of.sel = {}; of.tog = {}; $("#oq").value = ""; $$("[data-otoggle]", view).forEach(c => c.checked = false); draw(); };
  of.draw = draw;

  // multiselect dropdowns: one open at a time; closes on outside click, Escape or "Done"
  const closeAll = except => $$(".ms", view).forEach(ms => { if (ms === except) return; $(".ms-panel", ms).hidden = true; $(".ms-trigger", ms).setAttribute("aria-expanded", "false"); ms.classList.remove("open"); });
  $$(".ms", view).forEach(ms => {
    const key = ms.dataset.ms, trig = $(".ms-trigger", ms), panel = $(".ms-panel", ms);
    const open = on => { closeAll(on ? ms : null); panel.hidden = !on; trig.setAttribute("aria-expanded", String(on)); ms.classList.toggle("open", on); if (on) $("input:not(:disabled)", panel)?.focus(); };
    trig.onclick = () => open(panel.hidden);
    $$("input[type=checkbox]", panel).forEach(cb => cb.onchange = () => {
      const cur = new Set(of.sel[key] || []); cb.checked ? cur.add(cb.value) : cur.delete(cb.value);
      if (cur.size) of.sel[key] = [...cur]; else delete of.sel[key];
      draw();
    });
    $("[data-ms-clear]", panel).onclick = () => { delete of.sel[key]; draw(); };
    $("[data-ms-done]", panel).onclick = () => { open(false); trig.focus(); };
    ms.addEventListener("keydown", ev => { if (ev.key === "Escape" && !panel.hidden) { ev.stopPropagation(); open(false); trig.focus(); } });
  });
  if (of._outside) document.removeEventListener("click", of._outside, true);
  of._outside = ev => { if (!ev.target.closest(".ms")) closeAll(null); };
  document.addEventListener("click", of._outside, true);

  draw();
  $("#oq").oninput = ev => { of.q = ev.target.value; draw(); };
  $$("[data-otoggle]", view).forEach(c => c.onchange = () => { if (c.checked) of.tog[c.dataset.otoggle] = true; else delete of.tog[c.dataset.otoggle]; draw(); });
  $("#oclear").onclick = clearAll;
  if (of.railOpen) { rail.classList.add("open"); ft.setAttribute("aria-expanded", "true"); }
  ft.onclick = () => { of.railOpen = !rail.classList.contains("open"); rail.classList.toggle("open", of.railOpen); ft.setAttribute("aria-expanded", String(of.railOpen)); };
  const setView = (v, persist = true) => {
    of.view = v; if (persist) of.stored = v;
    $$("[data-oview]", view).forEach(x => { const on = x.dataset.oview === v; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); });
    draw();
    if (of.selected && v !== "map") selectTool(of.selected, { fromRoute: true });
  };
  $$("[data-oview]", view).forEach(b => b.onclick = () => setView(b.dataset.oview));
  $("#addtool").onclick = () => drawAddForm();
  if (params.get("add") === "1") drawAddForm();
  // after the router has reset the scroll position
  if (of.selected) requestAnimationFrame(() => selectTool(of.selected, { fly: false, fromRoute: true }));
}

// Selecting a tool: the map view shows its detail beside the map; the cards and table views
// already show everything, so the card or row is highlighted and scrolled into view.
function selectTool(id, { fly = true, scroll = false, fromRoute = false, opener = null } = {}) {
  const t = toolById(id); if (!t) return;
  of.selected = id;
  if (of.view === "map" && $("#tooldetail")) {
    const detail = $("#tooldetail");
    detail.innerHTML = toolDetail(t) + `<p><button class="linkbtn" id="tdclose">Clear selection</button></p>`;
    $("#tdclose").onclick = () => { of.selected = null; emptyDetail(); writeOrchParams(); paintSelection(); };
    paintSelection();
    if (fly && leaflet && markers[id]) leaflet.flyTo(markers[id].getLatLng(), Math.max(leaflet.getZoom(), 4), { duration: H.reduced() ? 0 : 0.6 });
    if (scroll && matchMedia("(max-width: 1199px)").matches) detail.scrollIntoView({ behavior: smooth(), block: "start" });
    if (!fromRoute && opener) detail.querySelector("h2")?.setAttribute("tabindex", "-1"), detail.querySelector("h2")?.focus({ preventScroll: true });
  } else {
    $$(".is-sel", view).forEach(x => x.classList.remove("is-sel"));
    const el = document.getElementById("tool-" + id);
    if (el) { el.classList.add("is-sel"); el.setAttribute("tabindex", "-1"); el.scrollIntoView({ behavior: fromRoute ? "auto" : smooth(), block: "center" }); el.focus({ preventScroll: true }); }
  }
  writeOrchParams();
}
function emptyDetail() {
  const d = $("#tooldetail"); if (!d) return;
  d.innerHTML = `<div class="empty-detail"><h2>Select an orchestrator</h2><p class="hint">Choose a marker on the map or a name below it to see its institution, links and how it talks to instruments.</p>
    </div>`;
}
function paintSelection() {
  $$(".mchip", view).forEach(b => b.setAttribute("aria-current", String(b.dataset.sel === of.selected)));
  Object.entries(markers).forEach(([k, m]) => { const on = k === of.selected; m.setStyle({ weight: on ? 3 : 1.5, color: on ? ringSel : ring }); m.setRadius(m.options.baseR + (on ? 3 : 0)); if (on) m.bringToFront(); });
}
function drawMapView(res, O, list) {
  if (!$("#map", res)) {
    res.innerHTML = `<div class="omap">
      <div class="omap-main">
        <div id="map" role="region" aria-label="World map of orchestrators. Use the list of names below the map to select one with the keyboard."></div>
        <div class="legend" aria-hidden="true"><span><i class="dot formal"></i>Formal standard</span><span><i class="dot hal"></i>Hardware-abstraction layer</span><span><i class="dot agentic"></i>Model-facing (MCP)</span><span><i class="dot bespoke"></i>Bespoke</span><span><i class="dot pending-dot"></i>Pending submission</span></div>
        <ul class="mchips" aria-label="Orchestrators on the map">${O.map(t => `<li data-tid="${esc(t.id)}"><button class="mchip" data-sel="${esc(t.id)}" aria-current="false"><i class="dot ${t.family}${t.pending ? " pending-dot" : ""}" aria-hidden="true"></i>${esc(t.name)}<span class="sr-only">, ${esc(FAMILY[t.family])}${t.pending ? ", pending submission" : ""}</span></button></li>`).join("")}
          <li class="mchips-empty" hidden>No orchestrators match. <button class="linkbtn" data-clear>Clear filters</button></li></ul>
      </div>
      <section class="card detail-pane" id="tooldetail" aria-live="polite" aria-label="Selected orchestrator"></section>
    </div>`;
    $$(".mchip", res).forEach(b => b.onclick = () => selectTool(b.dataset.sel, { scroll: true, opener: b }));
    $$("[data-clear]", res).forEach(b => b.onclick = () => { of.q = ""; of.sel = {}; of.tog = {}; $("#oq").value = ""; $$("[data-otoggle]", view).forEach(c => c.checked = false); of.draw(); });
    buildMap(O);
    if (of.selected && toolById(of.selected)) selectTool(of.selected, { fly: false, fromRoute: true }); else emptyDetail();
  }
  const on = new Set(list.map(t => t.id));
  $$(".mchips [data-tid]", res).forEach(li => li.hidden = !on.has(li.dataset.tid));
  $(".mchips-empty", res).hidden = list.length > 0;
  if (leaflet) {
    for (const [id, m] of Object.entries(markers)) { const show = on.has(id); if (show && !leaflet.hasLayer(m)) m.addTo(leaflet); if (!show && leaflet.hasLayer(m)) leaflet.removeLayer(m); }
    fitMap(false);
  }
}
function fitMap(animate) {
  if (!leaflet) return;
  const pts = Object.values(markers).filter(m => leaflet.hasLayer(m)).map(m => m.getLatLng());
  if (pts.length) leaflet.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 5, animate: animate && !H.reduced() });
  else leaflet.setView([30, 10], 2, { animate: false });
}
function buildMap(O) {
  if (!window.L) { $("#map").innerHTML = `<p class="hint map-fallback">The map library could not be loaded (offline?). Use the list below, or switch to Cards or Table.</p>`; return; }
  const map = leaflet = L.map("map", { worldCopyJump: true, minZoom: 1, keyboard: false, zoomAnimation: !H.reduced(), fadeAnimation: !H.reduced() }).setView([30, 10], 2);
  map.attributionControl.setPrefix(false);   // tile credits stay (required by Esri/OSM terms)
  const shade = isDark() ? "Dark" : "Light";
  const esri = layer => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${shade}_Gray_${layer}/MapServer/tile/{z}/{y}/{x}`;
  L.tileLayer(esri("Base"), { attribution: "Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors", maxZoom: 16 }).addTo(map);
  const lp = map.createPane("labels"); lp.style.zIndex = 350; lp.style.pointerEvents = "none";
  L.tileLayer(esri("Reference"), { maxZoom: 16, pane: "labels" }).addTo(map);
  const css = getComputedStyle(document.documentElement), tok = n => css.getPropertyValue(n).trim();
  const color = { formal: tok("--m-formal"), hal: tok("--m-hal"), agentic: tok("--m-agentic"), bespoke: tok("--m-bespoke") };
  ring = tok("--m-ring"); ringSel = tok("--m-sel");
  const seen = {};   // offset coincident markers slightly so they stay clickable
  for (const t of O) {
    if (typeof t.lat !== "number" || typeof t.lng !== "number") continue;
    const k = `${t.lat.toFixed(1)},${t.lng.toFixed(1)}`; const i = seen[k] = (seen[k] || 0) + 1;
    const r = 8;
    markers[t.id] = L.circleMarker([t.lat + (i - 1) * 0.35, t.lng + (i - 1) * 0.35], { radius: r, baseR: r, color: ring, weight: 1.5, fillColor: color[t.family] || tok("--m-bespoke"), fillOpacity: t.pending ? 0.3 : 0.95, dashArray: t.pending ? "3 3" : null })
      .bindTooltip(`<b>${esc(t.name)}</b>${t.pending ? ` (pending #${t.pending.number})` : ""}<br>${esc(t.org)}`, { direction: "top" }).addTo(map).on("click", () => selectTool(t.id));
  }
  const Home = L.Control.extend({ options: { position: "topleft" }, onAdd() {
    const bar = L.DomUtil.create("div", "leaflet-bar leaflet-control map-home");
    const a = L.DomUtil.create("a", "", bar);
    a.href = "#"; a.title = "Show all"; a.setAttribute("role", "button"); a.setAttribute("aria-label", "Zoom to show all orchestrators");
    a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></svg>';
    L.DomEvent.disableClickPropagation(bar);
    L.DomEvent.on(a, "click", ev => { L.DomEvent.preventDefault(ev); fitMap(true); });
    return bar;
  } });
  map.addControl(new Home());
  paintSelection();
}

function drawAddForm(t) {
  t = t || { id: "", name: "", org: "", city: "", country: "", lat: "", lng: "", website: "", repo: "", docs: "", paper: "", logo: "", family: "bespoke", mech: "", standards: [], notes: "", license: "" };
  const f = (k, label, ph = "", type = "text", req = false) => `<label class="field"><span class="field-label">${label}${req ? ' <span class="reqmark" aria-hidden="true">*</span>' : ""}</span><input type="${type}" data-k="${k}" value="${esc(t[k])}" placeholder="${esc(ph)}" step="any" ${req ? 'aria-required="true"' : ""}></label>`;
  const body = openDialog({ title: "Propose an orchestrator", wide: true, html: `
    <p class="hint">Open-source, with an explicit layer that commands physical instruments, and used in at least one self-driving lab. <b>Submit via GitHub</b> opens a prefilled issue for the maintainers; <b>Save in this browser</b> adds it to your own map only. Fields marked <span class="reqmark">*</span> are required.</p>
    <div class="formgrid">
      ${f("name", "Name", "e.g. MyLabOS", "text", true)}${f("org", "Institution / group", "", "text", true)}${f("city", "City")}${f("country", "Country")}
      ${f("lat", "Latitude", "e.g. 43.66", "number", true)}${f("lng", "Longitude", "e.g. -79.39", "number", true)}
      ${f("website", "Website", "https://")}${f("repo", "Repository", "https://github.com/…")}${f("docs", "Docs")}${f("paper", "Paper / DOI", "https://doi.org/…")}
      ${f("logo", "Logo URL", "https://github.com/<org>.png")}${f("license", "Licence", "MIT")}
      <label class="field"><span class="field-label">Integration family <span class="reqmark" aria-hidden="true">*</span></span><select data-k="family">${Object.entries(FAMILY).map(([k, v]) => `<option value="${k}" ${t.family === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      ${f("standards", "Underlying standards (comma-separated)", "SiLA 2, OPC UA")}
      <label class="field span-all"><span class="field-label">Primary device-integration mechanism</span><input type="text" data-k="mech" value="${esc(t.mech)}"></label>
      <label class="field span-all"><span class="field-label">Notes</span><textarea data-k="notes">${esc(t.notes)}</textarea></label>
    </div>
    <p class="form-error" id="tool-err" role="alert" hidden></p>
    <div class="actions"><button class="btn pri" id="issuetool">Submit via GitHub ${icon("ext", 14)}</button><button class="btn" id="savetool">Save in this browser</button>${store.tools.length ? `<button class="btn" id="exporttools">${icon("download", 14)} Export my added tools</button>` : ""}</div>` });
  $('[data-k="standards"]', body).value = (t.standards || []).join(", ");
  const read = () => { const o = {}; $$("[data-k]", body).forEach(i => o[i.dataset.k] = i.value.trim()); return o; };
  const err = msg => { const e = $("#tool-err"); e.textContent = msg; e.hidden = !msg; };
  $("#issuetool").onclick = () => { const o = read(); if (!o.name || !o.org) return err("Name and institution are required."); err(""); openIssue(toolIssue(o)); };
  const ex = $("#exporttools"); if (ex) ex.onclick = () => download("my-tools.json", JSON.stringify(store.tools.map(({ user, ...o }) => o), null, 2), "application/json");
  $("#savetool").onclick = () => {
    const o = Object.assign(read(), { user: true, verified: false, unverified: "Added locally; not part of the curated survey." });
    o.standards = o.standards ? o.standards.split(",").map(s => s.trim()).filter(Boolean) : [];
    o.lat = parseFloat(o.lat); o.lng = parseFloat(o.lng);
    if (!o.name || !o.org || isNaN(o.lat) || isNaN(o.lng)) return err("Name, institution, latitude and longitude are required.");
    o.id = "user-" + o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (toolById(o.id)) return err("A tool with that name already exists.");
    store.tools.push(o); save(); closeDialog(); toast(`${o.name} was added to your map in this browser.`);
    H.go(`#orchestrators/${o.id}?view=map`);
  };
  $('[data-k="name"]', body).focus();
}

H.routes.orchestrators = {
  render: renderOrch,
  title: (arg) => { const t = arg && toolById(arg); return t ? `${t.name} · Orchestrators` : "Orchestrators"; },
  // Hash changes that only select a different tool (same filters/view) keep the page and the map.
  update(arg, params) {
    const p = new URLSearchParams(params); if (!p.has("view")) p.set("view", of.view);
    const same = [...p.keys()].every(k => p.get(k) === new URLSearchParams(of.qs || "").get(k)) && [...new URLSearchParams(of.qs || "").keys()].every(k => p.has(k));
    if (!same || p.get("add") === "1") return false;
    if (arg) selectTool(arg); else { of.selected = null; closeDialog(); emptyDetail(); paintSelection(); }
    return true;
  },
  onSubmissions() { if (PENDING.tools.length) { const { arg, params } = H.parseHash(); renderOrch(arg, params); } }
};
H.onTheme(() => { if (H.page === "orchestrators" && of.view === "map" && $("#map")) { $("#oresults").innerHTML = ""; of.draw?.(); } });

/* =====================================================================
   STANDARDS & SCENARIOS (Tables 4, 5)
   ===================================================================== */
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
  ${pageHead("Standards &amp; scenarios", "Which device-integration boundary should your lab default to? The useful question is not “which standard is best?” but which one fits your setup. Answer four questions to get the paper’s recommended starting point.")}
  <div class="scen-layout">
    <section class="card scen-qs" aria-labelledby="sq-h"><h2 class="eyebrow" id="sq-h">Your deployment</h2>
      ${SCEN_QS.map((q, i) => `<div class="scen-q"><p class="scen-q-text" id="sq${i}"><span class="n" aria-hidden="true">${i + 1}</span>${q.q}</p>
        <div class="seg" role="radiogroup" aria-labelledby="sq${i}">${q.opts.map(([v, l]) => `<button role="radio" data-sq="${q.key}" data-v="${v}" aria-checked="${sf[q.key] === v}" tabindex="${sf[q.key] === v ? 0 : -1}" class="${sf[q.key] === v ? "on" : ""}">${l}</button>`).join("")}</div></div>`).join("")}
      <p class="hint">Precedence: multi-site → robotics → regulation → instrument count. The first “Yes” in that order decides the archetype.</p>
      <button class="linkbtn" id="sreset" ${SCEN_QS.every(q => sf[q.key] === q.opts[0][0]) ? "hidden" : ""}>Reset answers</button>
    </section>
    <section class="card scen-rec ${browsing ? "browsing" : ""}" aria-live="polite" aria-labelledby="scen-name">
      <p class="eyebrow">${browsing ? "Browsing another archetype" : "Recommended starting point"}</p>
      <h2 id="scen-name">${esc(cur.name)}</h2>
      <p class="scen-start">${esc(cur.rec)}</p>
      <dl class="td-facts">
        <dt>Why this archetype</dt><dd>${esc(cur.why)}</dd>
        <dt>Typical profile</dt><dd>${esc(cur.profile)}</dd>
        <dt>Trade-offs &amp; migration path</dt><dd>${esc(cur.tradeoff)}</dd>
      </dl>
      ${browsing ? `<div class="scen-note"><p>Your answers point to <b>${esc(matched.name)}</b> because ${esc(match.why)}.</p><button class="btn sm" id="sback">Back to my match</button></div>`
        : `<p class="scen-because">Matched because ${esc(match.why)}.</p>`}
      <p class="scen-next">Next: <a href="#orchestrators?view=table${hi.has(0) ? "&std=SiLA 2" : ""}">orchestrators${hi.has(0) ? " that support SiLA 2" : ""}</a> · <a href="#instruments">instruments</a> · <a href="#tutorials">build a connector</a></p>
    </section>
  </div>
  <h2 class="section-title">All archetypes</h2>
  <div class="scen-list" role="radiogroup" aria-label="Archetypes">
    ${S.map(s => `<button class="scen-item ${s.id === id ? "on" : ""}" role="radio" aria-checked="${s.id === id}" tabindex="${s.id === id ? 0 : -1}" data-pick="${s.id}">
      <span class="scen-item-name">${esc(s.name)}</span><span class="meta">${esc(s.rec)}</span>
      ${s.id === match.id ? '<span class="tag formal">your match</span>' : ""}</button>`).join("")}
  </div>
  <h2 class="section-title">Standards compared</h2>
  <p class="hint scen-hl-note">${hi.size ? `Highlighted: the standard${hi.size > 1 ? "s" : ""} the <b>${esc(cur.name)}</b> archetype recommends.` : `The <b>${esc(cur.name)}</b> archetype does not start from one of these four interfaces.`}</p>
  <div class="scroll" tabindex="0" role="region" aria-label="Standards comparison table"><table class="stable"><caption class="sr-only">What each interface approach requires (Table 4)</caption><thead><tr><th scope="col">Criterion</th>${st.cols.map((c, i) => `<th scope="col" class="${hi.has(i) ? "hl" : ""}">${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${st.rows.map(r => `<tr><th scope="row">${esc(r[0])}</th>${r[1].map((v, i) => `<td class="${hi.has(i) ? "hl" : ""}">${cell(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
  <p class="hint">${esc(st.note)}</p>
  <p class="hint">The scorecard is standards-agnostic: it tests interface behaviour, so a well-documented REST API can outscore a shallow SiLA 2 or OPC UA endpoint that carries only the label. A proprietary endpoint should not, however, receive the same portability credit as a standards-aligned one, because its vocabulary must still be mapped into each orchestrator separately.</p>`;
  $$("[data-sq]", view).forEach(b => b.onclick = () => {
    const q = SCEN_QS.find(x => x.key === b.dataset.sq), opt = q.opts.find(([v]) => String(v) === b.dataset.v);
    sf[q.key] = opt[0]; sf.picked = null; renderScen();
    $(`[data-sq="${q.key}"][data-v="${b.dataset.v}"]`, view)?.focus();
  });
  $$("[data-pick]", view).forEach(b => b.onclick = () => { const id2 = b.dataset.pick; sf.picked = id2 === match.id ? null : id2; renderScen(); $(`[data-pick="${id2}"]`, view)?.focus({ preventScroll: true }); });
  const back = $("#sback"); if (back) back.onclick = () => { sf.picked = null; renderScen(); };
  $("#sreset").onclick = () => { Object.assign(sf, { instruments: "few", regulated: false, robotics: false, multisite: false, picked: null }); renderScen(); };
  $$('[role="radiogroup"]', view).forEach(g => g.addEventListener("keydown", ev => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)) return;
    const items = $$('[role="radio"]', g), i = items.indexOf(document.activeElement); if (i < 0) return;
    ev.preventDefault(); items[(i + (ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].click();
  }));
}
H.routes.standards = { render: renderScen, title: "Standards & scenarios" };
})(window.SDLHub);

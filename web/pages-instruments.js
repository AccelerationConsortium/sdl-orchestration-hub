/* SDL Orchestration Hub — Instruments: find an instrument for a task by filtering scored
   instruments on what they do, their interface and the criteria that matter to you; then
   compare them side by side. Sources: the public registry (devices/*.yml + the paper's worked
   example), pending submissions, and the evaluations saved in this browser. */
(function (H) {
"use strict";
const { $, $$, esc, view, icon, extLink, pageHead, GL, GICON, TIER, CRIT, GROUPS, groupName, store, PUBLIC, PENDING, nameOf, evaluate, effectiveGrade,
  tone, gradePill, verdictPill, openDialog, toCSV, download, REPO, wOf, smooth } = H;
const RANK = { G: 2, P: 1, F: 0 };
const MIN_LABEL = { P: "Partial or better", G: "Pass" };
const fi = { q: "", grp: [], ifc: [], cell: false, elig: false, ver: false, hands: false, req: {}, src: ["pub", "pend", "mine"], view: "find", pick: [], sort: "best", showOut: false, qs: null };
const IFC_KEY = { "SiLA 2": /sila/i, "OPC UA + LADS": /opc|lads/i, "REST + OpenAPI": /rest|openapi|http/i, "MCP": /\bmcp\b|model context/i, "Vendor SDK": /sdk|dll|library/i, "Other": /./ };
const allTasks = () => H.uniq(GROUPS.flatMap(g => g.tasks.concat(g.types)).concat(items().flatMap(i => (i.e.tasks || []).concat(i.e.instrumentClass || []))).filter(Boolean));

function items() {
  const L = [];
  if (fi.src.includes("pub")) PUBLIC.forEach(e => L.push({ e, src: "pub" }));
  if (fi.src.includes("pend")) PENDING.evals.forEach(e => L.push({ e, src: "pend" }));
  if (fi.src.includes("mine")) store.evals.forEach(e => L.push({ e, src: "mine" }));
  return L.map(i => Object.assign(i, { id: `${i.src}:${i.e.id}`, r: evaluate(i.e) }));
}
const ifcOf = e => H.uniq([e.endpoint, ...(e.interfaces || [])].filter(Boolean));
function check(i) {
  const e = i.e, r = i.r, miss = [];
  const q = fi.q.toLowerCase().trim();
  if (q && ![nameOf(e), e.instrumentClass, groupName(e.group), (e.tasks || []).join(" "), ifcOf(e).join(" ")].join(" ").toLowerCase().includes(q)) miss.push(`does not mention “${fi.q.trim()}”`);
  if (fi.grp.length && !fi.grp.includes(e.group)) miss.push(e.group ? `group is ${groupName(e.group)}` : "instrument group not recorded");
  if (fi.ifc.length && !fi.ifc.some(k => ifcOf(e).some(x => k === "Other" ? !Object.entries(IFC_KEY).some(([kk, re]) => kk !== "Other" && re.test(x)) : IFC_KEY[k].test(x)))) miss.push(`no ${fi.ifc.join(" / ")} interface recorded`);
  if (fi.cell) { if (!e.ctx.cell) miss.push("not evaluated for a robotic workcell"); else if (effectiveGrade(e, CRIT.find(c => c.n === 19)) === "F") miss.push("C19 Fail: a robot cannot load it"); }
  if (fi.elig && !["ok", "warn"].includes(r.cls)) miss.push(r.verdict);
  if (fi.ver && !e.verified) miss.push("not verified by a maintainer");
  if (fi.hands && e.evidenceBasis !== "hands-on-test") miss.push("not hands-on tested");
  for (const [n, min] of Object.entries(fi.req)) {
    const c = CRIT.find(c => c.n === +n), g = effectiveGrade(e, c);
    if (c.tier === "X" && !e.ctx.cell) { miss.push(`C${n} not evaluated (standalone)`); continue; }
    if (!g) miss.push(`C${n} not graded`);
    else if (g !== "NA" && RANK[g] < RANK[min]) miss.push(`C${n} ${GL[g]} (needs ${MIN_LABEL[min]})`);
  }
  return miss;
}
const ORDER = { ok: 0, warn: 1, inc: 2, bad: 3 };
const pct = h => h.m ? h.p / h.m : 0;
const sorter = (a, b) => fi.sort === "name" ? nameOf(a.e).localeCompare(nameOf(b.e)) : (ORDER[a.r.cls] - ORDER[b.r.cls]) || (pct(b.r.headline) - pct(a.r.headline)) || nameOf(a.e).localeCompare(nameOf(b.e));

/* ---------- URL state ---------- */
function readParams(p) {
  const list = k => (p.get(k) || "").split(",").map(s => s.trim()).filter(Boolean);
  fi.q = p.get("q") || ""; fi.grp = list("grp"); fi.ifc = list("ifc");
  fi.cell = p.get("cell") === "1"; fi.elig = p.get("elig") === "1"; fi.ver = p.get("ver") === "1"; fi.hands = p.get("hands") === "1";
  fi.req = {}; for (const t of list("req")) { const m = /^C?(\d{1,2}):(G|P)$/i.exec(t); if (m && CRIT.some(c => c.n === +m[1])) fi.req[+m[1]] = m[2].toUpperCase(); }
  fi.src = p.has("src") ? list("src") : ["pub", "pend", "mine"];
  fi.view = p.get("view") === "compare" ? "compare" : "find";
  if (p.has("pick")) fi.pick = list("pick");
  fi.sort = p.get("sort") === "name" ? "name" : "best";
}
function writeParams() {
  const p = new URLSearchParams();
  if (fi.view === "compare") p.set("view", "compare");
  if (fi.q.trim()) p.set("q", fi.q.trim());
  if (fi.grp.length) p.set("grp", fi.grp.join(","));
  if (fi.ifc.length) p.set("ifc", fi.ifc.join(","));
  for (const k of ["cell", "elig", "ver", "hands"]) if (fi[k]) p.set(k, "1");
  const req = Object.entries(fi.req).map(([n, m]) => `C${n}:${m}`); if (req.length) p.set("req", req.join(","));
  if (fi.src.length !== 3) p.set("src", fi.src.join(","));
  if (fi.pick.length) p.set("pick", fi.pick.join(","));
  if (fi.sort !== "best") p.set("sort", fi.sort);
  fi.qs = p.toString().replace(/%2C/g, ",").replace(/%3A/g, ":");
  history.replaceState(null, "", "#instruments" + (fi.qs ? "?" + fi.qs : ""));
}
const activeCount = () => (fi.q.trim() ? 1 : 0) + fi.grp.length + fi.ifc.length + ["cell", "elig", "ver", "hands"].filter(k => fi[k]).length + Object.keys(fi.req).length;

/* ---------- page ---------- */
function renderInstruments(arg, params) {
  readParams(params);
  const all = items();
  const nPub = PUBLIC.length, nPend = PENDING.evals.length, nMine = store.evals.length;
  view.innerHTML = `
  ${pageHead("Instruments", "Find an instrument for a task. Filter scored instruments by what they do, the interface they expose and the criteria that matter for your workflow — then compare the shortlist side by side.",
    `<a class="btn" href="#score/new">${icon("plus", 14)} Score an instrument</a>`)}
  <div class="seg view-tabs" role="tablist" aria-label="Instruments view">
    <button role="tab" id="tab-find" aria-controls="ipanel" aria-selected="${fi.view === "find"}" class="${fi.view === "find" ? "on" : ""}" data-iview="find">${icon("search", 14)} Find</button>
    <button role="tab" id="tab-compare" aria-controls="ipanel" aria-selected="${fi.view === "compare"}" class="${fi.view === "compare" ? "on" : ""}" data-iview="compare">${icon("table", 14)} Compare <span class="badge" id="pickn" ${fi.pick.length ? "" : "hidden"}>${fi.pick.length}</span></button>
  </div>
  <div id="ipanel" role="tabpanel" aria-labelledby="${fi.view === "find" ? "tab-find" : "tab-compare"}"></div>`;
  $$("[data-iview]", view).forEach(b => b.onclick = () => { fi.view = b.dataset.iview; renderInstruments("", new URLSearchParams(qsNow())); $(`[data-iview="${fi.view}"]`, view).focus(); });
  $$("[data-iview]", view).forEach(b => b.addEventListener("keydown", ev => { if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") { ev.preventDefault(); const o = $$("[data-iview]", view).find(x => x !== b); o.click(); } }));
  if (fi.view === "compare") drawCompare(all); else drawFind(all, { nPub, nPend, nMine });
  writeParams();
}
const qsNow = () => { writeParams(); return fi.qs; };

function drawFind(all, counts) {
  const panel = $("#ipanel");
  const grpCount = id => all.filter(i => i.e.group === id).length;
  panel.innerHTML = `
  <section class="explorer finder">
    <section class="filter-rail" aria-label="Requirements"><div class="filter-dock">
      <label class="field"><span class="field-label">What do you need to do?</span><input type="search" id="iq" list="tasks-dl" placeholder="Task or type, e.g. fluorescence, HPLC" value="${esc(fi.q)}" autocomplete="off"></label>
      <datalist id="tasks-dl">${allTasks().map(t => `<option value="${esc(t)}"></option>`).join("")}</datalist>
      <button class="btn filter-toggle" id="ifilters" aria-expanded="false" aria-controls="ifilter-body">${icon("filter", 14)} Requirements</button>
      <div class="filter-body" id="ifilter-body">
        <fieldset class="fgroup"><legend class="field-label">Instrument group</legend>
          ${GROUPS.map(g => `<label class="chk"><input type="checkbox" data-grp="${g.id}" ${fi.grp.includes(g.id) ? "checked" : ""}><span>${esc(g.name)} <span class="meta">${grpCount(g.id)}</span></span></label>`).join("")}</fieldset>
        <fieldset class="fgroup"><legend class="field-label">Interface</legend>
          <div class="toggles">${window.INTERFACES.map(k => `<label class="toggle"><input type="checkbox" data-ifc="${esc(k)}" ${fi.ifc.includes(k) ? "checked" : ""}><span>${esc(k)}</span></label>`).join("")}</div></fieldset>
        <fieldset class="fgroup"><legend class="field-label">Deployment and eligibility</legend>
          <label class="chk"><input type="checkbox" data-flag="cell" ${fi.cell ? "checked" : ""}><span>Must work in a robotic workcell</span></label>
          <label class="chk"><input type="checkbox" data-flag="elig" ${fi.elig ? "checked" : ""}><span>Clears every floor (eligible)</span></label>
          <label class="chk"><input type="checkbox" data-flag="hands" ${fi.hands ? "checked" : ""}><span>Hands-on tested</span></label>
          <label class="chk"><input type="checkbox" data-flag="ver" ${fi.ver ? "checked" : ""}><span>Verified by a maintainer</span></label></fieldset>
        <fieldset class="fgroup"><legend class="field-label">Must-have capabilities</legend>
          <div class="presets">${window.REQ_PRESETS.map(p => `<button class="preset" data-preset="${p.id}" title="${esc(p.why)}">${esc(p.name)}</button>`).join("")}</div>
          <ul class="reqchips" id="reqchips" aria-label="Active requirements"></ul>
          <details class="reqall" ${Object.keys(fi.req).length ? "" : ""}><summary>Choose from all ${CRIT.length} criteria</summary>
            ${["C", "I", "X"].map(t => `<p class="field-label reqtier">${TIER[t]}</p>${CRIT.filter(c => c.tier === t).map(c => `<div class="reqrow"><span class="reqrow-l" id="rq${c.n}-l"><span class="n">C${c.n}</span> ${esc(window.REQ_LABELS[c.n] || c.name)}</span>
              <span class="seg seg-xs" role="radiogroup" aria-labelledby="rq${c.n}-l">${[["", "Any"], ["P", "Partial+"], ["G", "Pass"]].map(([v, l]) => `<button role="radio" data-req="${c.n}" data-min="${v}" aria-checked="${(fi.req[c.n] || "") === v}" tabindex="${(fi.req[c.n] || "") === v ? 0 : -1}" class="${(fi.req[c.n] || "") === v ? "on" : ""}">${l}</button>`).join("")}</span></div>`).join("")}`).join("")}
          </details></fieldset>
        <fieldset class="fgroup"><legend class="field-label">Include</legend>
          <label class="chk"><input type="checkbox" data-src="pub" ${fi.src.includes("pub") ? "checked" : ""}><span>Public registry <span class="meta">${counts.nPub}</span></span></label>
          <label class="chk"><input type="checkbox" data-src="pend" ${fi.src.includes("pend") ? "checked" : ""}><span>Pending submissions <span class="meta">${counts.nPend}</span></span></label>
          <label class="chk"><input type="checkbox" data-src="mine" ${fi.src.includes("mine") ? "checked" : ""}><span>My evaluations <span class="meta">${counts.nMine}</span></span></label></fieldset>
      </div>
      <div class="filter-actions"><span class="count" id="icount" aria-live="polite"></span><button class="linkbtn" id="iclear" hidden>Clear all</button></div>
    </div></section>
    <div class="results">
      <h2 class="sr-only">Matching instruments</h2>
      <div class="results-bar"><div class="active-chips" id="ichips" aria-label="Active requirements"></div>
        <label class="sortsel"><span class="field-label">Sort</span><select id="isort"><option value="best" ${fi.sort === "best" ? "selected" : ""}>Best first</option><option value="name" ${fi.sort === "name" ? "selected" : ""}>Name</option></select></label></div>
      <div id="iresults"></div>
    </div>
  </section>`;

  const draw = () => {
    const list = items().map(i => Object.assign(i, { miss: check(i) }));
    const hit = list.filter(i => !i.miss.length).sort(sorter), out = list.filter(i => i.miss.length).sort(sorter);
    $("#icount").textContent = `${hit.length} of ${list.length} instruments match`;
    $("#iclear").hidden = !activeCount();
    // active chips
    const chips = [];
    if (fi.q.trim()) chips.push([`“${fi.q.trim()}”`, () => { fi.q = ""; $("#iq").value = ""; }]);
    fi.grp.forEach(g => chips.push([groupName(g), () => { fi.grp = fi.grp.filter(x => x !== g); $(`[data-grp="${g}"]`).checked = false; }]));
    fi.ifc.forEach(k => chips.push([k, () => { fi.ifc = fi.ifc.filter(x => x !== k); $(`[data-ifc="${CSS.escape(k)}"]`).checked = false; }]));
    [["cell", "Robotic workcell"], ["elig", "Eligible"], ["hands", "Hands-on tested"], ["ver", "Verified"]].forEach(([k, l]) => fi[k] && chips.push([l, () => { fi[k] = false; $(`[data-flag="${k}"]`).checked = false; }]));
    Object.entries(fi.req).forEach(([n, m]) => chips.push([`C${n} ${m === "G" ? "Pass" : "≥ Partial"}`, () => { delete fi.req[n]; syncReq(); }]));
    $("#ichips").innerHTML = chips.map(([l], k) => `<button class="chip-x" data-chip="${k}" aria-label="Remove filter ${esc(l)}">${esc(l)}<span aria-hidden="true">×</span></button>`).join("");
    $$("[data-chip]", $("#ichips")).forEach(b => b.onclick = () => { chips[+b.dataset.chip][1](); draw(); ($("#ichips button") || $("#iq")).focus(); });
    $("#reqchips").innerHTML = Object.entries(fi.req).map(([n, m]) => `<li><span class="n">C${n}</span> ${esc(window.REQ_LABELS[n] || "")} <b>${m === "G" ? "Pass" : "≥ Partial"}</b> <button class="linkbtn" data-unreq="${n}" aria-label="Remove requirement C${n}">${icon("x", 12)}</button></li>`).join("");
    $$("[data-unreq]", $("#reqchips")).forEach(b => b.onclick = () => { delete fi.req[b.dataset.unreq]; syncReq(); draw(); });

    const res = $("#iresults");
    const registryNote = PUBLIC.length <= 1 ? `<div class="note-card"><p><b>The public registry is just starting.</b> So far it holds the paper’s anonymised worked example (Reader X). Instruments you score appear here in your browser only; <a href="#scorecard">submit them</a> to grow the shared registry for everyone.</p></div>` : "";
    res.innerHTML = `${registryNote}
      ${hit.length ? `<ul class="igrid">${hit.map(i => card(i)).join("")}</ul>` : `<div class="empty"><p>No instrument meets every requirement.${list.length ? " Loosen a requirement, or look at the near misses below." : " No scored instruments are included — tick a source on the left, or score one."}</p><div class="btn-row">${activeCount() ? `<button class="btn" id="iclear2">Clear requirements</button>` : ""}<a class="btn pri" href="#score/new">Score an instrument</a></div></div>`}
      ${out.length ? `<details class="outs" ${fi.showOut || !hit.length ? "open" : ""}><summary>${out.length} instrument${out.length === 1 ? " doesn’t" : "s don’t"} meet your requirements</summary><ul class="igrid muted">${out.map(i => card(i)).join("")}</ul></details>` : ""}`;
    H.highlight(res, fi.q);
    const c2 = $("#iclear2"); if (c2) c2.onclick = clearAll;
    const od = $("details.outs", res); if (od) od.addEventListener("toggle", () => { fi.showOut = od.open; });
    wireCards(res);
    writeParams();
  };
  const syncReq = () => $$("[data-req]", panel).forEach(b => { const on = (fi.req[b.dataset.req] || "") === b.dataset.min; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; });
  const clearAll = () => { Object.assign(fi, { q: "", grp: [], ifc: [], cell: false, elig: false, ver: false, hands: false, req: {} }); $("#iq").value = ""; $$("[data-grp],[data-ifc],[data-flag]", panel).forEach(c => c.checked = false); syncReq(); draw(); };
  $("#iq").oninput = ev => { fi.q = ev.target.value; draw(); };
  $$("[data-grp]", panel).forEach(c => c.onchange = () => { fi.grp = $$("[data-grp]", panel).filter(x => x.checked).map(x => x.dataset.grp); draw(); });
  $$("[data-ifc]", panel).forEach(c => c.onchange = () => { fi.ifc = $$("[data-ifc]", panel).filter(x => x.checked).map(x => x.dataset.ifc); draw(); });
  $$("[data-flag]", panel).forEach(c => c.onchange = () => { fi[c.dataset.flag] = c.checked; draw(); });
  $$("[data-src]", panel).forEach(c => c.onchange = () => { fi.src = $$("[data-src]", panel).filter(x => x.checked).map(x => x.dataset.src); draw(); });
  $$("[data-req]", panel).forEach(b => b.onclick = () => { const n = b.dataset.req; if (b.dataset.min) fi.req[n] = b.dataset.min; else delete fi.req[n]; syncReq(); draw(); });
  $$(".reqrow [role=radiogroup]", panel).forEach(g => g.addEventListener("keydown", ev => {
    if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
    const it = $$("[role=radio]", g), i = it.indexOf(document.activeElement); if (i < 0) return;
    ev.preventDefault(); const n = it[(i + (ev.key === "ArrowRight" ? 1 : it.length - 1)) % it.length]; n.click(); n.focus();
  }));
  $$("[data-preset]", panel).forEach(b => b.onclick = () => { const p = window.REQ_PRESETS.find(x => x.id === b.dataset.preset); Object.assign(fi.req, p.req); if (p.cell) { fi.cell = true; $('[data-flag="cell"]', panel).checked = true; } syncReq(); draw(); H.toast(`Added “${p.name}”: ${Object.entries(p.req).map(([n, m]) => `C${n} ${m === "G" ? "Pass" : "≥ Partial"}`).join(", ")}.`); });
  $("#iclear").onclick = clearAll;
  $("#isort").onchange = ev => { fi.sort = ev.target.value; draw(); };
  const rail = $(".filter-rail", panel), ft = $("#ifilters");
  ft.onclick = () => { const open = !rail.classList.contains("open"); rail.classList.toggle("open", open); ft.setAttribute("aria-expanded", String(open)); };
  draw();
}

function gstrip(e, reqs = {}) {
  const cs = CRIT.filter(c => c.tier !== "X" || e.ctx.cell);
  const n = k => cs.filter(c => effectiveGrade(e, c) === k).length;
  return `<div class="gstrip" role="img" aria-label="Grades: ${n("G")} Pass, ${n("P")} Partial, ${n("F")} Fail${n("NA") ? `, ${n("NA")} N/A` : ""}${cs.length - n("G") - n("P") - n("F") - n("NA") ? `, ${cs.length - n("G") - n("P") - n("F") - n("NA")} not graded` : ""}">${cs.map(c => { const g = effectiveGrade(e, c); return `<span class="gs-c ${g || "U"} ${reqs[c.n] ? "req" : ""}" title="C${c.n} ${esc(c.name)}: ${g ? GL[g] : "not graded"}">${c.n}</span>`; }).join("")}</div>`;
}
const srcTag = i => i.src === "mine" ? '<span class="tag mine">my evaluation</span>' : i.src === "pend" ? H.pendingTag(i.e.pending) : `<span class="tag">public</span>${i.e.verified ? ' <span class="tag formal">verified</span>' : ""}`;
function card(i) {
  const e = i.e, r = i.r, picked = fi.pick.includes(i.id);
  const type = [e.instrumentClass, groupName(e.group)].filter(Boolean).join(" · ");
  return `<li class="card icard ${picked ? "picked" : ""}">
    <div class="icard-head"><div class="icard-title"><h3><button class="linkbtn title-btn" data-detail="${esc(i.id)}">${esc(nameOf(e))}</button></h3><p class="meta">${esc(type || "Type not recorded")}</p></div>${verdictPill(r)}</div>
    <div class="tags">${ifcOf(e).map(x => `<span class="tag ${x === e.endpoint ? "hal" : ""}" ${x === e.endpoint ? 'title="Interface scored"' : ""}>${esc(x)}</span>`).join("")}${srcTag(i)}</div>
    ${(e.tasks || []).length ? `<p class="icard-tasks"><span class="sr-only">Tasks: </span>${e.tasks.map(t => `<span class="task">${esc(t)}</span>`).join("")}</p>` : ""}
    <div class="icard-scores">
      <div><p class="field-label">Standalone</p><p class="sc-n"><b>${r.pts}</b> / ${r.max}</p><div class="bar" aria-hidden="true"><i style="width:${Math.round(100 * pct({ p: r.pts, m: r.max }))}%"></i></div></div>
      ${e.ctx.cell ? `<div><p class="field-label">Cell-integrated</p><p class="sc-n"><b>${r.ptsCell}</b> / ${r.maxCell}</p><div class="bar" aria-hidden="true"><i style="width:${Math.round(100 * pct({ p: r.ptsCell, m: r.maxCell }))}%"></i></div></div>` : ""}
    </div>
    ${gstrip(e, fi.req)}
    ${i.miss?.length ? `<ul class="misses">${i.miss.slice(0, 3).map(m => `<li>${esc(m)}</li>`).join("")}${i.miss.length > 3 ? `<li>+${i.miss.length - 3} more</li>` : ""}</ul>` : ""}
    <div class="icard-foot"><label class="chk cmp"><input type="checkbox" data-pick="${esc(i.id)}" ${picked ? "checked" : ""}><span>Compare</span></label>
      <button class="btn sm" data-detail="${esc(i.id)}">Details</button>${i.src === "mine" ? `<a class="btn sm" href="#score/${esc(e.id)}">Edit</a>` : ""}</div>
  </li>`;
}
function wireCards(root) {
  $$("[data-pick]", root).forEach(c => c.onchange = () => {
    const id = c.dataset.pick; fi.pick = c.checked ? H.uniq(fi.pick.concat(id)) : fi.pick.filter(x => x !== id);
    c.closest(".icard").classList.toggle("picked", c.checked);
    const b = $("#pickn"); b.hidden = !fi.pick.length; b.textContent = fi.pick.length;
    writeParams();
    if (c.checked && fi.pick.length >= 2) H.toast(`${fi.pick.length} instruments selected — open the Compare tab to see them side by side.`);
  });
  $$("[data-detail]", root).forEach(b => b.onclick = () => showDetail(b.dataset.detail, b));
}
function showDetail(id, opener) {
  const i = items().find(x => x.id === id); if (!i) return;
  const e = i.e, r = i.r;
  const links = e.evidenceLinks || {};
  const body = openDialog({ title: esc(nameOf(e)), wide: true, onClose: () => opener?.focus?.(), html: `
    <div class="dd-top">${verdictPill(r)}<span class="meta">${esc([e.instrumentClass, groupName(e.group)].filter(Boolean).join(" · "))}</span></div>
    <dl class="glossary cols2">
      <dt>Interface scored</dt><dd>${esc(e.endpoint || "—")} · ${esc(e.arch || "")}</dd>
      ${(e.interfaces || []).length ? `<dt>Interfaces offered</dt><dd>${esc(ifcOf(e).join(", "))}</dd>` : ""}
      ${(e.tasks || []).length ? `<dt>Tasks</dt><dd>${esc(e.tasks.join(", "))}</dd>` : ""}
      <dt>Totals</dt><dd>Standalone ${r.pts} / ${r.max}${e.ctx.cell ? ` · cell-integrated ${r.ptsCell} / ${r.maxCell}` : ""}</dd>
      <dt>Evaluator</dt><dd>${esc(e.submittedBy || e.evaluator || (i.src === "mine" ? "You" : "—"))}${e.date ? ` · ${esc(e.date)}` : ""}</dd>
      <dt>Evidence basis</dt><dd>${esc(e.evidenceBasis || "—")}</dd>
      <dt>Criteria version</dt><dd>${esc(e.scorecardVersion || "—")}${e.scorecardVersion && window.SCORECARD_VERSION && e.scorecardVersion !== window.SCORECARD_VERSION ? ` <span class="g P">current is ${esc(window.SCORECARD_VERSION)}</span>` : ""}</dd>
      ${e.pending ? `<dt>Source</dt><dd>${extLink(e.pending.url, `issue #${e.pending.number}`)} · awaiting review</dd>` : e.source ? `<dt>Source</dt><dd>${REPO && e.source.startsWith("devices/") ? extLink(`https://github.com/${REPO}/blob/main/${e.source}`, e.source) : esc(e.source)}</dd>` : ""}
      ${e.productUrl ? `<dt>Product</dt><dd>${extLink(e.productUrl, e.productUrl)}</dd>` : ""}
    </dl>
    ${e.cyberAssumed ? `<p class="hint">The ${e.pending ? "issue form" : "device file"} does not record the security precondition; it is treated as cleared.</p>` : ""}
    ${e.pending?.errors?.length ? `<p class="flag">⚠ ${e.pending.errors.map(esc).join("; ")}</p>` : ""}
    <details class="sub" open><summary>Why this verdict</summary><ul class="reasons">${r.reasons.map(x => `<li class="${x.lvl}">${esc(x.t)}</li>`).join("")}</ul></details>
    <div class="tablewrap"><table class="gtable" role="table"><caption class="sr-only">Grades by criterion</caption><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Criterion</th><th scope="col" role="columnheader">Grade</th><th scope="col" role="columnheader">Note</th></tr></thead><tbody role="rowgroup">
      ${CRIT.filter(c => c.tier !== "X" || e.ctx.cell).map(c => `<tr role="row" class="${fi.req[c.n] ? "is-req" : ""}"><th scope="row" role="rowheader"><span class="n">C${c.n}</span> ${esc(c.name)}</th><td role="cell">${gradePill(effectiveGrade(e, c))}</td><td role="cell" class="meta">${esc((e.notes || {})[c.n] || "")}${links[c.n] ? ` ${extLink(links[c.n], "evidence")}` : ""}</td></tr>`).join("")}
    </tbody></table></div>
    ${e.vendorResponse ? `<details class="sub"><summary>Vendor response</summary><p class="hint">${esc(e.vendorResponse)}</p></details>` : ""}
    <div class="actions">${i.src === "mine" ? `<a class="btn pri" href="#score/${esc(e.id)}">Open in the scorecard</a>` : ""}<button class="btn" id="dd-pick">${fi.pick.includes(id) ? "Remove from comparison" : "Add to comparison"}</button></div>` });
  $("#dd-pick", body).onclick = () => { fi.pick = fi.pick.includes(id) ? fi.pick.filter(x => x !== id) : fi.pick.concat(id); H.closeDialog(); renderInstruments("", new URLSearchParams(qsNow())); };
  $$("a[href^='#score/']", body).forEach(a => a.addEventListener("click", () => H.closeDialog()));
}

/* ---------- compare ---------- */
function drawCompare(all) {
  const panel = $("#ipanel");
  let E = fi.pick.map(id => all.find(i => i.id === id)).filter(Boolean);
  const auto = !E.length;
  if (auto) E = all.map(i => Object.assign(i, { miss: check(i) })).filter(i => !i.miss.length).sort(sorter);
  if (!E.length) {
    panel.innerHTML = `<div class="empty"><p>Nothing to compare yet. Tick <b>Compare</b> on instruments in the Find tab, or score some instruments first.</p><div class="btn-row"><button class="btn" data-goto="find">Find instruments</button><a class="btn pri" href="#score/new">Score an instrument</a></div></div>`;
    $("[data-goto]", panel).onclick = () => $('[data-iview="find"]').click();
    return;
  }
  const reqs = fi.req;
  panel.innerHTML = `
    <div class="cmp-bar"><p class="hint">${auto ? `Showing every instrument that meets your current requirements (${E.length}). Tick <b>Compare</b> in Find to choose a shortlist.` : `Your shortlist of ${E.length}.`} Eligibility is decided by the floors; the total only ranks instruments that clear them.</p>
      <div class="btn-row">${!auto ? `<button class="btn sm" id="cmp-clear">Clear shortlist</button>` : ""}<button class="btn sm" id="cmp-csv">${icon("download", 14)} Export CSV</button></div></div>
    <div class="scroll" tabindex="0" role="region" aria-label="Comparison table"><table class="ctable">
      <caption class="sr-only">Instrument comparison</caption>
      <thead><tr><th scope="col">Criterion</th>${E.map(i => `<th scope="col"><span class="th-name">${esc(nameOf(i.e))}</span><span class="meta">${esc([i.e.instrumentClass, i.e.endpoint].filter(Boolean).join(" · "))}</span><span class="th-tags">${srcTag(i)}</span>${!auto ? `<button class="linkbtn" data-unpick="${esc(i.id)}" aria-label="Remove ${esc(nameOf(i.e))} from the comparison">Remove</button>` : ""}</th>`).join("")}</tr></thead>
      <tbody>
        <tr class="sum"><th scope="row">Verdict</th>${E.map(i => `<td>${verdictPill(i.r)}</td>`).join("")}</tr>
        <tr class="sum"><th scope="row">Standalone</th>${E.map(i => `<td class="num">${i.r.pts} / ${i.r.max}</td>`).join("")}</tr>
        <tr class="sum"><th scope="row">Cell-integrated</th>${E.map(i => `<td class="num">${i.e.ctx.cell ? `${i.r.ptsCell} / ${i.r.maxCell}` : '<span class="meta">—</span>'}</td>`).join("")}</tr>
        <tr class="sum last"><th scope="row">Repository floors <span class="meta">score_device.py</span></th>${E.map(i => { const f = SDLScore.repoFloors(i.e, { criteria: CRIT }); return `<td>${f.unrated ? '<span class="meta">incomplete</span>' : `<span class="g ${f.eligible ? "G" : "F"}">${f.eligible ? "eligible" : "not eligible"}</span>`}</td>`; }).join("")}</tr>
        ${CRIT.map(c => `<tr class="${reqs[c.n] ? "is-req" : ""}"><th scope="row"><span class="n">C${c.n}</span> ${esc(c.name)} <span class="meta">w${wOf(c)}</span>${reqs[c.n] ? ` <span class="tag formal">required ${reqs[c.n] === "G" ? "Pass" : "≥ Partial"}</span>` : ""}</th>${E.map(i => { if (c.tier === "X" && !i.e.ctx.cell) return `<td class="meta">—</td>`; return `<td>${gradePill(effectiveGrade(i.e, c))}${c.n === 17 && i.e.annot?.[17] ? ` <span class="meta">${esc(i.e.annot[17])}</span>` : ""}</td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div>
    <p class="hint"><b>Verdict</b> applies the full procedure (precondition, remediation dates, gap decisions, conditional floors). <b>Repository floors</b> is the three-floor check that <code>build/score_device.py</code> applies to <code>devices/*.yml</code>.</p>`;
  $("#cmp-csv").onclick = () => download("sdl-instrument-comparison.csv", toCSV(E.map(i => i.e)), "text/csv");
  const cc = $("#cmp-clear"); if (cc) cc.onclick = () => { fi.pick = []; renderInstruments("", new URLSearchParams(qsNow())); };
  $$("[data-unpick]", panel).forEach(b => b.onclick = () => { fi.pick = fi.pick.filter(x => x !== b.dataset.unpick); renderInstruments("", new URLSearchParams(qsNow())); $('[data-iview="compare"]')?.focus(); });
}

H.routes.instruments = {
  render: renderInstruments,
  title: (arg, p) => p && p.get("view") === "compare" ? "Compare instruments" : "Instruments",
  update(arg, params) { const p = new URLSearchParams(params); return p.toString().replace(/%2C/g, ",").replace(/%3A/g, ":") === fi.qs ? true : false; },
  onSubmissions() { if (PENDING.evals.length) { const { params } = H.parseHash(); renderInstruments("", params); } }
};
})(window.SDLHub);

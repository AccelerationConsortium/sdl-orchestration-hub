/* SDL Orchestration Hub — Scorecard: the criteria (browsable), your evaluations, and the
   step-by-step evaluation wizard (#score/<id>). Stage order mirrors the paper's sequential
   decision logic: precondition → Critical floor → Important / local floors → cell floor → total. */
(function (H) {
"use strict";
const { $, $$, esc, view, icon, extLink, pageHead, GL, GICON, TIER, NA_OK, CRIT, GROUPS, groupName, store, save, uid, blank, evalById, nameOf, wOf,
  effectiveGrade, evaluate, tone, gradePill, verdictPill, gradedCount, applicableCount, allTools, openDialog, closeDialog, toast, openIssue,
  scorecardIssue, toDeviceYAML, toCSV, download, keep, smooth, REPO } = H;
const TIER_Q = {
  C: "Can the instrument be controlled programmatically and contractually at all?",
  I: "Does the interface support robust autonomous operation? Absence raises integration and operating cost, but can be overcome.",
  X: "Can the instrument take part in a robotic workcell?"
};
const TIER_RULE = {
  C: "Any Fail disqualifies the instrument regardless of its total. At most one Critical criterion may be Partial, and only with a dated remediation commitment (12-month ceiling recommended).",
  I: "Failed Important criteria may total at most 4 weighted points, and every Fail needs a documented gap-acceptance decision. Hazardous or unattended deployments add the C7 and C15 floors.",
  X: "Only for instruments in a robotic workcell. C19 must be at least Partial wherever a machine loads or unloads labware; you may make C20 and C21 local floors."
};
const ENDPOINTS = ["SiLA 2", "OPC UA + LADS", "REST + OpenAPI", "MCP", "Other"];
const ARCH = [["Native endpoint", "The instrument itself serves the interface."], ["Vendor edge-controller", "A vendor-supported PC or appliance serves it (common for HPLC, GC, MS, NMR)."], ["Third-party gateway", "Someone else’s gateway: counts as an external mitigation, not vendor compliance."]];
const tierCrit = t => CRIT.filter(c => c.tier === t);
const REPO_FILE = f => REPO ? `https://github.com/${REPO}/blob/main/${f}` : "";
const REPO_RAW = f => REPO ? `https://github.com/${REPO}/raw/main/${f}` : "";

/* =====================================================================
   OVERVIEW — #scorecard and #scorecard/C7
   ===================================================================== */
const cv = { q: "", tier: "all" };
function renderOverview(arg) {
  const total = t => tierCrit(t).reduce((a, c) => a + c.w, 0);
  const mine = store.evals.slice().sort((a, b) => String(b.updated || b.created || "").localeCompare(String(a.updated || a.created || "")));
  view.innerHTML = `
  ${pageHead("Instrument scorecard", `Before you buy an instrument for a self-driving lab, check whether its control interface is ready for autonomous use. ${CRIT.length} testable criteria in three tiers; floors decide eligibility, and the weighted total only ranks instruments that clear them.`,
    `<a class="btn pri" href="#score/new">${icon("plus", 14)} Score an instrument</a><button class="btn" id="ex">Open the worked example</button>`, "Autonomous-readiness criteria")}

  <section class="sc-sec" aria-labelledby="h-mine">
    <div class="sec-head"><h2 class="section-title" id="h-mine">Your evaluations <span class="count-pill">${mine.length}</span></h2>
      <div class="btn-row"><label class="btn sm">${icon("upload", 14)} Import JSON<input type="file" id="imp" accept=".json,application/json" class="sr-only"></label>${mine.length ? `<button class="btn sm" id="expall">${icon("download", 14)} Export all</button>` : ""}</div></div>
    ${mine.length ? `<ul class="evgrid">${mine.map(evalCard).join("")}</ul>`
      : `<div class="empty empty-row"><p>You have not scored an instrument yet. Evaluations are saved in this browser only — nothing is uploaded unless you submit it.</p><a class="btn pri" href="#score/new">Start your first evaluation</a></div>`}
  </section>

  <section class="sc-sec" aria-labelledby="h-flow">
    <h2 class="section-title" id="h-flow">How an instrument is judged</h2>
    <ol class="flow">
      <li><span class="flow-n">1</span><b>Security precondition</b><span>The vendor supplies ${window.CYBER.length} IT and security deliverables. Anything missing blocks procurement before grading starts.</span></li>
      <li><span class="flow-n">2</span><b>Critical floor</b><span>C1–C5. Any Fail disqualifies; at most one Partial, with a dated remediation commitment.</span></li>
      <li><span class="flow-n">3</span><b>Important floor</b><span>C6–C18. Fails may total at most 4 weighted points, each with a documented gap acceptance.</span></li>
      <li><span class="flow-n">4</span><b>Cell-integration floor</b><span>C19–C21, workcells only. C19 at least Partial where a machine loads labware.</span></li>
      <li class="flow-last"><span class="flow-n">5</span><b>Weighted total</b><span>Pass = 1, Partial = ½, Fail = 0, times the weight. Ranks instruments that cleared every floor.</span></li>
    </ol>
    <p class="hint">Applied in order: a later step never overrides an earlier one. A vendor that clears every floor with a moderate total may be the right choice.</p>
  </section>

  <section class="sc-sec" aria-labelledby="h-crit" id="criteria">
    <div class="sec-head"><h2 class="section-title" id="h-crit">The ${CRIT.length} criteria</h2>
      <div class="btn-row">${REPO ? `<a class="btn sm" href="${REPO_FILE("scorecard.md")}" target="_blank" rel="noopener">${icon("doc", 14)} Checklist (.md)</a><a class="btn sm" href="${REPO_RAW("scorecard-template.xlsx")}">${icon("download", 14)} Spreadsheet (.xlsx)</a><a class="btn sm" href="${REPO_RAW("scorecard-template.csv")}">.csv</a>` : ""}</div></div>
    <div class="tiercards">${["C", "I", "X"].map(t => `<button class="tiercard t${t} ${cv.tier === t ? "on" : ""}" data-tierpick="${t}" aria-pressed="${cv.tier === t}">
        <span class="tc-name">${TIER[t]} <span class="meta">C${tierCrit(t)[0].n}–C${tierCrit(t).slice(-1)[0].n}</span></span>
        <span class="tc-q">${esc(TIER_Q[t])}</span>
        <span class="tc-n"><b>${tierCrit(t).length}</b> criteria · <b>${total(t)}</b> weighted points</span></button>`).join("")}</div>
    <div class="crit-tools">
      <label class="field crit-search"><span class="sr-only">Search criteria</span><input type="search" id="cq" placeholder="Search criteria, e.g. simulator, errors, locking" value="${esc(cv.q)}" autocomplete="off"></label>
      <div class="seg seg-sm" role="group" aria-label="Tier">${[["all", "All"], ["C", "Critical"], ["I", "Important"], ["X", "Cell"]].map(([k, l]) => `<button data-tier="${k}" aria-pressed="${cv.tier === k}" class="${cv.tier === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <button class="linkbtn" id="cexpand">Expand all</button>
      <span class="count" id="ccount" aria-live="polite"></span>
    </div>
    <div id="clist"></div>
    <details class="note weights-note"><summary>Adjust weights <span class="meta">this browser only</span></summary>
      <p class="hint">Defaults are the paper’s proposed values, not validated constants. A hazardous workcell may weigh C20/C21 higher; a regulated deployment may weigh C17 higher. Custom weights apply only here: published totals (46 / 52) and <code>devices/*.yml</code> scoring always use the defaults.</p>
      <div class="weights">${CRIT.map(c => `<label class="wrow"><span>C${c.n} <span class="meta">(${c.w})</span></span><input type="number" min="0" max="10" step="1" data-w="${c.n}" value="${wOf(c)}" aria-label="Weight for C${c.n}, default ${c.w}"></label>`).join("")}</div>
      <button class="btn sm" id="wreset">Reset to default weights</button></details>
  </section>

  <section class="sc-sec grid2" aria-label="Before you score">
    <div class="card"><h2 class="card-title">Ask the vendor for — security precondition</h2><ul class="ticklist">${window.CYBER.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>
    <div class="card"><h2 class="card-title">RFP evidence pack</h2><p class="hint">Ask for endpoint-specific evidence rather than general statements of API availability.</p><ul class="ticklist">${window.EVIDENCE.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>
  </section>
  <p class="meta">Criteria v${esc(window.SCORECARD_VERSION || "?")}${REPO ? ` · ${extLink(REPO_FILE("CHANGELOG.md"), "changelog")} · ${extLink(`https://github.com/${REPO}/tree/main/criteria`, "criteria source (YAML)")}` : ""}</p>`;

  const drawList = () => {
    const q = cv.q.toLowerCase().trim();
    const hit = c => (cv.tier === "all" || c.tier === cv.tier) && (!q || [`c${c.n}`, c.name, c.checks, c.hint, window.REQ_LABELS?.[c.n], c.full?.requirement].join(" ").toLowerCase().includes(q));
    const tiers = ["C", "I", "X"].filter(t => tierCrit(t).some(hit));
    const n = CRIT.filter(hit).length;
    $("#ccount").textContent = `${n} of ${CRIT.length} criteria`;
    $("#clist").innerHTML = n ? tiers.map(t => `<div class="ctier t${t}"><h3 class="ctier-h">${TIER[t]}</h3>${tierCrit(t).filter(hit).map(critRow).join("")}</div>`).join("")
      : `<div class="empty"><p>No criteria match “${esc(cv.q)}”.</p><button class="btn" id="cclear">Clear search</button></div>`;
    const cc = $("#cclear"); if (cc) cc.onclick = () => { cv.q = ""; $("#cq").value = ""; drawList(); };
    $$("details.crow-d", $("#clist")).forEach(d => d.addEventListener("toggle", () => { if (d.open) history.replaceState(null, "", `#scorecard/${d.id}`); }));
  };
  const setTier = t => { cv.tier = t; $$("[data-tier]", view).forEach(b => { const on = b.dataset.tier === t; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }); $$("[data-tierpick]", view).forEach(b => { const on = b.dataset.tierpick === t; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }); drawList(); };
  drawList();
  $("#cq").oninput = ev => { cv.q = ev.target.value; drawList(); };
  $$("[data-tier]", view).forEach(b => b.onclick = () => setTier(b.dataset.tier));
  $$("[data-tierpick]", view).forEach(b => b.onclick = () => setTier(cv.tier === b.dataset.tierpick ? "all" : b.dataset.tierpick));
  $("#cexpand").onclick = () => { const ds = $$("details.crow-d", $("#clist")), open = ds.some(d => !d.open); ds.forEach(d => d.open = open); $("#cexpand").textContent = open ? "Collapse all" : "Expand all"; };
  $("#ex").onclick = () => { const id = loadExample(); H.go(`#score/${id}`); };
  wireEvalCards(view, () => renderOverview());
  $("#imp").onchange = ev => {
    const f = ev.target.files[0]; if (!f) return;
    f.text().then(t => { const a = JSON.parse(t); const list = Array.isArray(a) ? a : a.evals || [a]; list.forEach(o => { store.evals.push(Object.assign(blank(), o, { id: uid() })); }); if (a.weights) store.weights = a.weights; save(); toast(`Imported ${list.length} evaluation${list.length === 1 ? "" : "s"}.`); renderOverview(); })
      .catch(() => toast("Could not read that file. Expected JSON exported from this site."));
  };
  const ea = $("#expall"); if (ea) ea.onclick = () => download("sdl-scorecards.json", JSON.stringify({ evals: store.evals, weights: store.weights }, null, 2), "application/json");
  $$("[data-w]", view).forEach(i => i.onchange = () => { const n = +i.dataset.w, v = parseInt(i.value, 10); const c = CRIT.find(c => c.n === n); if (isNaN(v) || v === c.w) delete store.weights[n]; else store.weights[n] = v; save(); toast(`C${n} weight set to ${isNaN(v) ? c.w : v} in this browser.`); });
  $("#wreset").onclick = () => { store.weights = {}; save(); $$("[data-w]", view).forEach(i => { i.value = CRIT.find(c => c.n === +i.dataset.w).w; }); toast("Weights reset to the paper’s defaults."); };
  // deep link to one criterion
  const m = /^C(\d{1,2})$/i.exec(arg || "");
  if (m) { const d = $(`#C${+m[1]}`); if (d) { d.open = true; requestAnimationFrame(() => d.scrollIntoView({ block: "start" })); } }
}
function critRow(c) {
  const g = window.GRADING[c.n] || {}, items = c.full?.requirementItems || [];
  return `<details class="crow-d t${c.tier}" id="C${c.n}">
    <summary><span class="n">C${c.n}</span><span class="crow-name">${esc(c.name)}</span><span class="crow-meta"><span class="wt" title="Weight">w${wOf(c)}</span><span class="wt" title="Evaluation effort: S ≤ 2 h, M ≤ 1 day, L multi-day">${esc(g.effort || "")}</span>${NA_OK.has(c.n) ? '<span class="wt">N/A allowed</span>' : ""}</span></summary>
    <div class="crow-body">
      <p class="crit-checks">${esc(c.checks)}</p>
      <div class="crow-cols">
        <div><p class="field-label">How to test</p><p class="hint">${esc(c.hint)}</p>${window.REQ_LABELS?.[c.n] ? `<p class="field-label">In plain words</p><p class="hint">${esc(window.REQ_LABELS[c.n])}</p>` : ""}</div>
        <div><p class="field-label">Grading</p>
          <p class="rule"><b class="G">Pass</b> ${esc(g.pass)}</p><p class="rule"><b class="P">Partial</b> ${esc(g.partial)}</p><p class="rule"><b class="F">Fail</b> ${esc(g.fail)}</p>${g.note ? `<p class="rule"><b>Note</b> ${esc(g.note)}</p>` : ""}</div>
      </div>
      ${items.length ? `<details class="sub"><summary>Requirement, item by item</summary><ul class="req">${items.map(it => `<li class="${it.sub ? "sub" : ""}">${it.m ? `<b class="modal">${esc(it.m)}</b> ` : ""}${esc(it.t)}</li>`).join("")}</ul></details>` : ""}
      ${c.full ? `<details class="sub"><summary>Applicability and rationale</summary>${[["Applicability", c.full.applicability], ["Rationale", c.full.rationale]].filter(([, t]) => t).map(([h, t]) => `<p class="field-label">${h}</p>${String(t).split(/\n\s*\n/).map(p => `<p class="hint">${esc(p)}</p>`).join("")}`).join("")}
        ${REPO ? `<p class="hint">${extLink(REPO_FILE(`criteria/C${c.n}.yml`), `criteria/C${c.n}.yml`)}</p>` : ""}</details>` : ""}
    </div></details>`;
}
function evalCard(e) {
  const r = evaluate(e), done = gradedCount(e), of = applicableCount(e), pct = Math.round(100 * done / of);
  return `<li class="card evcard">
    <div class="evcard-head"><h3><a href="#score/${esc(e.id)}">${esc(nameOf(e))}</a></h3>${verdictPill(r)}</div>
    <p class="meta">${esc([e.instrumentClass || groupName(e.group), e.endpoint].filter(Boolean).join(" · ") || "No details yet")}</p>
    <div class="evcard-prog"><div class="bar" role="progressbar" aria-label="Criteria graded" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${of}"><i style="width:${pct}%"></i></div><span class="meta">${done} / ${of} graded</span></div>
    <p class="evcard-score"><b>${r.headline.p}</b><span> / ${r.headline.m} ${e.ctx.cell ? "cell-integrated" : "standalone"}</span></p>
    ${e.scorecardVersion && window.SCORECARD_VERSION && e.scorecardVersion !== window.SCORECARD_VERSION ? `<p class="flag">Scored on criteria v${esc(e.scorecardVersion)}; current is v${esc(window.SCORECARD_VERSION)}.</p>` : ""}
    <div class="evcard-foot"><a class="btn sm pri" href="#score/${esc(e.id)}">${done < of ? "Continue" : "Open"}</a>
      <button class="btn sm icon-btn" data-dup="${esc(e.id)}" aria-label="Duplicate ${esc(nameOf(e))}" title="Duplicate">${icon("copy", 14)}</button>
      <button class="btn sm icon-btn" data-exp="${esc(e.id)}" aria-label="Export ${esc(nameOf(e))} as JSON" title="Export JSON">${icon("download", 14)}</button>
      <button class="btn sm icon-btn danger" data-del="${esc(e.id)}" aria-label="Delete ${esc(nameOf(e))}" title="Delete">${icon("trash", 14)}</button></div>
  </li>`;
}
function wireEvalCards(root, redraw) {
  $$("[data-dup]", root).forEach(b => b.onclick = () => { const e = evalById(b.dataset.dup); const n = JSON.parse(JSON.stringify(e)); n.id = uid(); n.vendor = (n.vendor || "Untitled") + " (copy)"; n.created = new Date().toISOString(); store.evals.push(n); save(); toast(`Duplicated as “${nameOf(n)}”.`); redraw(); });
  $$("[data-exp]", root).forEach(b => b.onclick = () => { const e = evalById(b.dataset.exp); download(`${H.slugify(nameOf(e)) || "evaluation"}.json`, JSON.stringify(e, null, 2), "application/json"); });
  $$("[data-del]", root).forEach(b => b.onclick = () => {
    const e = evalById(b.dataset.del);
    const body = openDialog({ title: "Delete evaluation?", html: `<p>“${esc(nameOf(e))}” will be removed from this browser. Export it first if you may need it again.</p><div class="actions"><button class="btn danger-fill" id="really">Delete</button><button class="btn" id="keepit">Keep it</button></div>` });
    $("#keepit", body).onclick = closeDialog;
    $("#really", body).onclick = () => { store.evals = store.evals.filter(v => v.id !== e.id); save(); closeDialog(); toast(`Deleted “${nameOf(e)}”.`); redraw(); };
    $("#keepit", body).focus();
  });
}
function loadExample() {
  const X = window.READER_X;
  const n = blank({ vendor: X.vendor, endpoint: X.endpoint, arch: X.arch, instrumentClass: "Fluorescence plate reader", group: "measurement", tasks: ["fluorescence"], interfaces: ["SiLA 2"],
    grades: { ...X.grades }, notes: { ...X.notes }, remed: { ...X.remed }, remedDate: { ...(X.remedDate || {}) }, gap: { ...X.gap }, annot: { ...(X.annot || {}) } });
  n.cyber = n.cyber.map(() => true); n.ctx.cell = true; n.stage = STAGES.length - 1; n.visited = STAGES.map(() => true);
  store.evals.push(n); save();
  return n.id;
}
H.routes.scorecard = {
  render: renderOverview,
  title: arg => { const m = /^C(\d{1,2})$/i.exec(arg || ""); const c = m && CRIT.find(c => c.n === +m[1]); return c ? `C${c.n} ${c.name} · Scorecard` : "Instrument scorecard"; },
  update(arg) { const m = /^C(\d{1,2})$/i.exec(arg || ""); if (!m) return false; const d = $(`#C${+m[1]}`); if (!d) return false; d.open = true; d.scrollIntoView({ behavior: smooth(), block: "start" }); $("summary", d).focus({ preventScroll: true }); return true; }
};

/* =====================================================================
   WIZARD — #score/<id>, #score/new
   ===================================================================== */
const STAGES = [
  { id: "instrument", title: "Instrument", sub: "What you are scoring" },
  { id: "context", title: "Deployment", sub: "Which floors apply" },
  { id: "pre", title: "Security", sub: "IT precondition" },
  { id: "C", title: "Critical", sub: "C1–C5" },
  { id: "I", title: "Important", sub: "C6–C18" },
  { id: "X", title: "Cell integration", sub: "C19–C21" },
  { id: "review", title: "Review & share", sub: "Verdict and evidence" }
];
let W = null;   // the evaluation open in the wizard
const mode = () => store.ui.mode === "list" ? "list" : "one";
function stageStatus(e, i, r = evaluate(e)) {
  const id = STAGES[i].id, seen = (e.visited || [])[i];
  if (id === "instrument") return { s: (e.vendor || "").trim() ? "done" : seen ? "progress" : "todo" };
  if (id === "context") return { s: seen ? "done" : "todo" };
  if (id === "pre") return r.blocked ? { s: seen ? "issue" : "todo", note: seen ? "blocking" : "" } : { s: "done" };
  if (["C", "I", "X"].includes(id)) {
    if (id === "X" && !e.ctx.cell) return { s: "skip", note: "not in a workcell" };
    const cs = tierCrit(id), rated = cs.filter(c => e.grades[c.n]).length;
    const g = n => effectiveGrade(e, CRIT.find(c => c.n === n));
    let bad = false;
    if (id === "C") bad = cs.some(c => g(c.n) === "F") || cs.filter(c => g(c.n) === "P").length > 1;
    if (id === "I") bad = cs.filter(c => g(c.n) === "F").reduce((a, c) => a + wOf(c), 0) > 4 || (e.ctx.hazard && g(7) === "F") || (e.ctx.hazard && e.ctx.unattended && g(15) === "F" && !e.mit[15]);
    if (id === "X") bad = g(19) === "F" || [20, 21].some(n => e.ctx["c" + n + "local"] && g(n) === "F");
    if (bad) return { s: "issue", note: `${rated}/${cs.length} · floor not met` };
    return rated === cs.length ? { s: "done", note: `${rated}/${cs.length} graded` } : { s: rated ? "progress" : "todo", note: `${rated}/${cs.length} graded` };
  }
  return { s: STAGES.slice(0, -1).every((_, k) => ["done", "skip"].includes(stageStatus(e, k, r).s)) ? "done" : "todo" };
}
const STATUS_WORD = { done: "complete", issue: "needs attention", skip: "not applicable", progress: "in progress", todo: "not started" };
const touch = e => { e.updated = new Date().toISOString(); save(); const s = $("#saved"); if (s) { s.textContent = "Saved"; clearTimeout(touch.t); touch.t = setTimeout(() => { if ($("#saved")) $("#saved").textContent = "Saved in this browser"; }, 1200); } };

function renderWizard(arg, params) {
  if (arg === "new") {
    const e = blank();
    store.evals.push(e); save();
    history.replaceState(null, "", `#score/${e.id}`);
    arg = e.id;
  }
  const e = evalById(arg);
  if (!e) {
    W = null;
    view.innerHTML = `${pageHead("Evaluation not found", "It may have been deleted, or it was saved in a different browser. Evaluations live in the browser where they were made — use Export / Import to move them.")}<div class="btn-row"><a class="btn pri" href="#score/new">Start a new evaluation</a><a class="btn" href="#scorecard">All evaluations</a></div>`;
    return;
  }
  W = e; store.current = e.id;
  if (e.stage == null) e.stage = 0;
  view.innerHTML = `
  <div class="wiz">
    <div class="wiz-bar">
      <a class="btn sm ghost" href="#scorecard">${icon("back", 14)} All evaluations</a>
      <div class="wiz-title"><p class="eyebrow">Instrument scorecard</p><h1 id="page-title" tabindex="-1">${esc(nameOf(e))}</h1></div>
      <span class="saved meta" id="saved" aria-live="polite">Saved in this browser</span>
    </div>
    <div class="wiz-grid">
      <nav class="wiz-nav" id="wiz-nav" aria-label="Evaluation steps"></nav>
      <section class="wiz-main" id="wiz-main" aria-labelledby="stage-h"></section>
      <section class="wiz-side" id="wiz-side" aria-label="Live result"></section>
    </div>
    <button class="minibar" id="minibar" aria-controls="wiz-side"></button>
  </div>`;
  drawAll(e);
  $("#minibar").onclick = () => { $("#wiz-side").scrollIntoView({ behavior: smooth(), block: "start" }); $("#wiz-side h2")?.focus({ preventScroll: true }); };
}
function drawAll(e, { focus = false } = {}) {
  e.visited = e.visited || []; e.visited[e.stage] = true;
  drawNav(e); drawMain(e); drawSide(e);
  if (focus) { $("#stage-h")?.focus({ preventScroll: true }); $("#wiz-main").scrollIntoView({ behavior: smooth(), block: "start" }); }
}
function refresh(e) { drawNav(e); drawSide(e); const t = $("#page-title"); if (t) t.textContent = nameOf(e); const sc = $("#stage-count"); if (sc) sc.textContent = stageCount(e); drawStrip(e); }
function goStage(e, i, { crit = null } = {}) {
  e.stage = Math.max(0, Math.min(STAGES.length - 1, i));
  const st = STAGES[e.stage];
  if (["C", "I", "X"].includes(st.id)) {
    const cs = tierCrit(st.id);
    e.cur = crit && cs.some(c => c.n === crit) ? crit : cs.some(c => c.n === e.cur) ? e.cur : (cs.find(c => !e.grades[c.n]) || cs[0]).n;
  }
  touch(e); drawAll(e, { focus: true });
  if (crit && mode() === "list") $(`#C${crit}`)?.scrollIntoView({ behavior: smooth(), block: "center" });
}

function drawNav(e) {
  const r = evaluate(e);
  $("#wiz-nav").innerHTML = `<ol class="wsteps">${STAGES.map((s, i) => { const ss = stageStatus(e, i, r); return `
    <li><button class="wstep ${ss.s} ${i === e.stage ? "cur" : ""}" data-stage="${i}" ${i === e.stage ? 'aria-current="step"' : ""}>
      <span class="wstep-dot" aria-hidden="true">${({ done: "✓", issue: "!", skip: "–" })[ss.s] || i + 1}</span>
      <span class="wstep-txt"><span class="wstep-title">${esc(s.title)}</span><span class="wstep-sub">${esc(ss.note || s.sub)}</span></span>
      <span class="sr-only">, ${STATUS_WORD[ss.s]}</span></button></li>`; }).join("")}</ol>`;
  $$("[data-stage]", $("#wiz-nav")).forEach(b => b.onclick = () => goStage(e, +b.dataset.stage));
}

function drawSide(e) {
  const r = evaluate(e), hl = r.headline, pct = hl.m ? Math.round(100 * hl.p / hl.m) : 0;
  const tierBar = t => { const cs = tierCrit(t), n = cs.filter(c => e.grades[c.n]).length; return `<div class="tprog t${t}"><span class="tprog-l">${TIER[t]}</span><span class="tprog-bar" aria-hidden="true"><i style="width:${Math.round(100 * n / cs.length)}%"></i></span><span class="meta">${n}/${cs.length}</span></div>`; };
  $("#wiz-side").innerHTML = `
    <div class="resbox card">
      <h2 class="res-h" tabindex="-1">Result so far</h2>
      <div class="verdict ${r.cls}">${esc(r.verdict)}</div>
      <div><p class="field-label">${e.ctx.cell ? "Cell-integrated total (C1–C21)" : "Standalone total (C1–C18)"}</p>
        <p class="score">${hl.p}<span> / ${hl.m}</span></p>
        <div class="bar" role="img" aria-label="${pct} percent of the maximum"><i style="width:${pct}%"></i></div>
        ${e.ctx.cell ? `<p class="meta">Standalone ${r.pts} / ${r.max}</p>` : ""}</div>
      <div class="tprogs">${["C", "I"].concat(e.ctx.cell ? ["X"] : []).map(tierBar).join("")}</div>
      <div class="minigrid" aria-label="Grades by criterion">${CRIT.filter(c => c.tier !== "X" || e.ctx.cell).map(c => { const g = effectiveGrade(e, c); return `<button class="mg ${g || "U"} ${c.n === e.cur && ["C", "I", "X"].includes(STAGES[e.stage].id) ? "cur" : ""}" data-jump="${c.n}" title="C${c.n} ${esc(c.name)}: ${g ? GL[g] : "not graded"}"><span aria-hidden="true">${c.n}</span><span class="sr-only">C${c.n} ${esc(c.name)}: ${g ? GL[g] : "not graded"}</span></button>`; }).join("")}</div>
      <details class="reasons-d" ${r.reasons.some(x => x.lvl === "bad") ? "open" : ""}><summary>Why: ${r.reasons.length} check${r.reasons.length === 1 ? "" : "s"}</summary><ul class="reasons">${r.reasons.map(x => `<li class="${x.lvl}"><span class="sr-only">${({ bad: "Problem", warn: "Warning", ok: "OK" })[x.lvl]}: </span>${esc(x.t)}</li>`).join("")}</ul></details>
      ${e.stage !== STAGES.length - 1 ? `<button class="btn block" data-stage="${STAGES.length - 1}">Review &amp; share ${icon("arrow", 14)}</button>` : ""}
    </div>`;
  $$("[data-jump]", $("#wiz-side")).forEach(b => b.onclick = () => { const c = CRIT.find(c => c.n === +b.dataset.jump); goStage(e, STAGES.findIndex(s => s.id === c.tier), { crit: c.n }); });
  $$("[data-stage]", $("#wiz-side")).forEach(b => b.onclick = () => goStage(e, +b.dataset.stage));
  const mb = $("#minibar"); if (mb) mb.innerHTML = `<span class="verdict-dot ${r.cls}" aria-hidden="true"></span><span class="mb-v">${esc(r.verdict)}</span><span class="mb-s">${hl.p} / ${hl.m}</span>`;
}

const stageCount = e => { const st = STAGES[e.stage]; if (!["C", "I", "X"].includes(st.id)) return ""; const cs = tierCrit(st.id); return `${cs.filter(c => e.grades[c.n]).length} of ${cs.length} graded`; };
function drawMain(e) {
  const st = STAGES[e.stage], x = e.ctx, isTier = ["C", "I", "X"].includes(st.id);
  const head = `<header class="stage-head"><p class="eyebrow">Step ${e.stage + 1} of ${STAGES.length}</p>
    <h2 class="stage-title" id="stage-h" tabindex="-1">${isTier ? `${esc(st.title)} criteria` : esc(st.title)}</h2>
    ${isTier && !(st.id === "X" && !x.cell) ? `<span class="stage-count" id="stage-count">${stageCount(e)}</span>
      <div class="seg seg-sm mode-seg" role="group" aria-label="Layout"><button data-mode="one" aria-pressed="${mode() === "one"}" class="${mode() === "one" ? "on" : ""}">One at a time</button><button data-mode="list" aria-pressed="${mode() === "list"}" class="${mode() === "list" ? "on" : ""}">All on one page</button></div>` : ""}</header>`;
  let body = "";
  if (st.id === "instrument") body = instrumentStage(e);
  else if (st.id === "context") body = contextStage(e);
  else if (st.id === "pre") body = preStage(e);
  else if (isTier) {
    if (st.id === "X" && !x.cell) body = `<div class="empty"><p>Cell-integration criteria apply only to instruments that robots load and unload inside a workcell. You marked this deployment as standalone, so C19–C21 are not scored.</p><button class="btn" data-stage="1">Change the deployment</button></div>`;
    else body = `<p class="tier-rule t${st.id}"><b>${esc(TIER_Q[st.id])}</b> ${esc(TIER_RULE[st.id])}</p>` +
      (mode() === "one" ? `<div class="cstrip" id="cstrip" role="group" aria-label="Criteria in this tier"></div><div id="cpanel"></div>` : `<div class="clist">${tierCrit(st.id).map(c => critRowEdit(e, c)).join("")}</div>`);
  } else body = reviewStage(e);

  const prev = navTarget(e, -1), next = navTarget(e, +1);
  $("#wiz-main").innerHTML = `<div class="stage">${head}<div class="stage-body">${body}</div>
    <footer class="stage-nav">
      ${prev ? `<button class="btn" id="nav-prev">${icon("back", 14)} <span>${esc(prev.label)}</span></button>` : "<span></span>"}
      ${isTier && mode() === "one" && !(st.id === "X" && !x.cell) ? `<span class="kbd-hint" aria-hidden="true"><kbd>1</kbd>–<kbd>${NA_OK.size ? 4 : 3}</kbd> grade · <kbd>←</kbd> <kbd>→</kbd> move</span>` : ""}
      ${next ? `<button class="btn pri" id="nav-next"><span>${esc(next.label)}</span> ${icon("arrow", 14)}</button>` : `<button class="btn pri" id="nav-print">${icon("print", 14)} Print / save as PDF</button>`}
    </footer></div>`;
  const m = $("#wiz-main");
  $$("[data-mode]", m).forEach(b => b.onclick = () => { store.ui.mode = b.dataset.mode; save(); drawMain(e); $(`[data-mode="${b.dataset.mode}"]`, m)?.focus(); });
  $$("[data-stage]", m).forEach(b => b.onclick = () => goStage(e, +b.dataset.stage));
  if ($("#nav-prev")) $("#nav-prev").onclick = () => move(e, -1);
  if ($("#nav-next")) $("#nav-next").onclick = () => move(e, +1);
  if ($("#nav-print")) $("#nav-print").onclick = () => window.print();
  if (st.id === "instrument") wireInstrument(e);
  else if (st.id === "context" || st.id === "pre") wireContext(e);
  else if (isTier && !(st.id === "X" && !x.cell)) { if (mode() === "one") { drawStrip(e); drawPanel(e); } else wireCritRows(e, m); }
  else if (st.id === "review") wireReview(e);
}
// Previous / next: criterion by criterion inside a tier (one-at-a-time layout), otherwise stage by stage.
function navTarget(e, d) {
  const st = STAGES[e.stage];
  if (["C", "I", "X"].includes(st.id) && mode() === "one" && !(st.id === "X" && !e.ctx.cell)) {
    const cs = tierCrit(st.id), i = cs.findIndex(c => c.n === e.cur), j = i + d;
    if (j >= 0 && j < cs.length) return { crit: cs[j].n, label: `C${cs[j].n} ${cs[j].name}` };
  }
  const k = e.stage + d;
  if (k < 0 || k >= STAGES.length) return null;
  const ns = STAGES[k];
  if (["C", "I", "X"].includes(ns.id) && mode() === "one" && !(ns.id === "X" && !e.ctx.cell)) {
    const cs = tierCrit(ns.id), c = d > 0 ? cs[0] : cs[cs.length - 1];
    return { stage: k, crit: c.n, label: d > 0 ? `${ns.title}: C${c.n} ${c.name}` : `C${c.n} ${c.name}` };
  }
  return { stage: k, label: ns.title };
}
function move(e, d) {
  const t = navTarget(e, d); if (!t) return;
  if (t.stage == null) { e.cur = t.crit; touch(e); drawMain(e); drawNav(e); drawSide(e); $("#cp-h")?.focus({ preventScroll: true }); $("#wiz-main").scrollIntoView({ behavior: smooth(), block: "start" }); }
  else goStage(e, t.stage, { crit: t.crit });
}

/* ---------- stage: instrument ---------- */
function instrumentStage(e) {
  const g = GROUPS.find(x => x.id === e.group);
  const sugg = g ? g.tasks : [];
  const other = (e.tasks || []).filter(t => !sugg.includes(t));
  return `
  <p class="stage-intro">Describe the instrument and the interface you will score. Score the endpoint your orchestrator will use in production — compliance on one endpoint does not transfer to another.</p>
  <fieldset class="fs"><legend>Instrument</legend>
    <div class="formgrid">
      <label class="field"><span class="field-label">Vendor</span><input type="text" data-f="vendor" value="${esc(e.vendor)}" placeholder="e.g. Acme Instruments" autocomplete="off"></label>
      <label class="field"><span class="field-label">Model</span><input type="text" data-f="model" value="${esc(e.model || "")}" placeholder="e.g. Reader 9" autocomplete="off"></label>
      <label class="field"><span class="field-label">Instrument group</span><select id="grp"><option value="">Choose…</option>${GROUPS.map(x => `<option value="${x.id}" ${e.group === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label class="field"><span class="field-label">Instrument type</span><input type="text" data-f="instrumentClass" value="${esc(e.instrumentClass || "")}" list="types-dl" placeholder="${g ? esc(g.types[0]) : "e.g. plate reader, HPLC"}" autocomplete="off"></label>
    </div>
    <datalist id="types-dl">${(g ? g.types : GROUPS.flatMap(x => x.types)).map(t => `<option value="${esc(t)}"></option>`).join("")}</datalist>
    <div class="field"><span class="field-label" id="tasks-l">Tasks it is used for <span class="meta">(helps others find it in the instrument finder)</span></span>
      ${g ? `<div class="toggles" role="group" aria-labelledby="tasks-l">${sugg.map(t => `<label class="toggle"><input type="checkbox" data-task="${esc(t)}" ${(e.tasks || []).includes(t) ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>` : `<p class="hint">Choose an instrument group above to see suggested tasks, or type them here.</p>`}
      <label class="field other-tasks"><span class="sr-only">${g ? "Other tasks" : "Tasks"}</span><input type="text" id="tasks-other" value="${esc(other.join(", "))}" placeholder="${g ? "Other tasks, comma-separated" : "e.g. fluorescence, kinetic reads"}"></label></div>
  </fieldset>
  <fieldset class="fs"><legend>Interface</legend>
    <div class="field"><span class="field-label" id="ep-l">Interface you are scoring</span>
      <div class="pills" role="radiogroup" aria-labelledby="ep-l">${ENDPOINTS.map(o => `<label class="pill"><input type="radio" name="ep" value="${esc(o)}" ${e.endpoint === o ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div></div>
    <div class="field"><span class="field-label" id="if-l">Other interfaces the vendor offers <span class="meta">(optional)</span></span>
      <div class="toggles" role="group" aria-labelledby="if-l">${window.INTERFACES.filter(i => i !== e.endpoint).map(i => `<label class="toggle"><input type="checkbox" data-ifc="${esc(i)}" ${(e.interfaces || []).includes(i) ? "checked" : ""}><span>${esc(i)}</span></label>`).join("")}</div></div>
    <div class="formgrid">
      <label class="field span-2"><span class="field-label">Who serves the endpoint? <span class="meta">(C1 architecture)</span></span><select data-f="arch">${ARCH.map(([o, d]) => `<option value="${esc(o)}" ${e.arch === o ? "selected" : ""}>${esc(o)} — ${esc(d)}</option>`).join("")}</select></label>
    </div>
  </fieldset>
  <details class="fs-more" ${e.evaluator || e.firmware || e.productUrl ? "open" : ""}><summary>Evaluation details <span class="meta">needed if you publish it</span></summary>
    <div class="formgrid">
      <label class="field"><span class="field-label">Evaluator</span><input type="text" data-f="evaluator" value="${esc(e.evaluator || "")}" placeholder="name, organisation or handle"></label>
      <label class="field"><span class="field-label">Evidence basis</span><select data-f="evidenceBasis">${[["vendor-docs", "Vendor documentation"], ["hands-on-test", "Hands-on test"], ["integrator-report", "Integrator report"]].map(([v, l]) => `<option value="${v}" ${(e.evidenceBasis || "vendor-docs") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span class="field-label">Evaluation date</span><input type="date" data-f="date" value="${esc(e.date || "")}"></label>
      <label class="field"><span class="field-label">Firmware / software version</span><input type="text" data-f="firmware" value="${esc(e.firmware || "")}"></label>
      <label class="field span-2"><span class="field-label">Product URL</span><input type="url" data-f="productUrl" value="${esc(e.productUrl || "")}" placeholder="https://"></label>
    </div></details>`;
}
function wireInstrument(e) {
  const m = $("#wiz-main");
  $$("[data-f]", m).forEach(i => { const ev = i.tagName === "SELECT" ? "onchange" : "oninput"; i[ev] = () => { e[i.dataset.f] = i.value; touch(e); refresh(e); }; });
  $("#grp").onchange = ev => { e.group = ev.target.value; touch(e); keep(() => drawMain(e)); refresh(e); $("#grp").focus(); };
  const readTasks = () => { const sel = $$("[data-task]", m).filter(c => c.checked).map(c => c.dataset.task); const oth = $("#tasks-other").value.split(",").map(s => s.trim()).filter(Boolean); e.tasks = H.uniq(sel.concat(oth)); touch(e); };
  $$("[data-task]", m).forEach(c => c.onchange = readTasks);
  $("#tasks-other").oninput = readTasks;
  $$('input[name="ep"]', m).forEach(r => r.onchange = () => { e.endpoint = r.value; e.interfaces = (e.interfaces || []).filter(i => i !== r.value); touch(e); keep(() => drawMain(e)); refresh(e); $(`input[name="ep"][value="${CSS.escape(r.value)}"]`, $("#wiz-main"))?.focus(); });
  $$("[data-ifc]", m).forEach(c => c.onchange = () => { const s = new Set(e.interfaces || []); c.checked ? s.add(c.dataset.ifc) : s.delete(c.dataset.ifc); e.interfaces = [...s]; touch(e); });
}

/* ---------- stages: deployment and security ---------- */
const sw = (path, title, desc, x) => `<label class="switchcard"><input type="checkbox" data-ctx="${path}" ${x[path] ? "checked" : ""}><span class="sw" aria-hidden="true"></span><span class="sc-body"><b>${title}</b><span>${desc}</span></span></label>`;
function contextStage(e) {
  const x = e.ctx;
  return `<p class="stage-intro">These answers decide which conditional floors apply. Set them before grading — you can change them later.</p>
  <div class="switches">
    ${sw("cell", "In a robotic workcell", "Robots or a track load and unload the instrument. Adds the cell-integration criteria C19–C21 (maximum 52 instead of 46).", x)}
    ${sw("hazard", "Hazardous, or blocks a shared resource", "Hazardous actuation, or long operations (over ~60 s) that block others — most HPLCs, incubators, NMRs and centrifuges. Activates the C7 floor.", x)}
    ${sw("unattended", "Runs unattended", "Nobody is present while it runs. Together with the hazard above, activates the C15 floor.", x)}
  </div>
  ${x.cell ? `<h3 class="subhead">Buyer-defined local floors <span class="meta">optional</span></h3><div class="switches">
    ${sw("c20local", "C20 must be at least Partial", "The instrument sits inside a robot work envelope or has hazardous motion.", x)}
    ${sw("c21local", "C21 must be at least Partial", "Hazardous motion, thermal, pressure, optical or chemical hazards.", x)}</div>` : ""}`;
}
function preStage(e) {
  const x = e.ctx, how = !x.networked ? "local" : x.isolated ? "iso" : "net", n = e.cyber.filter(Boolean).length;
  const opt = (v, t, d) => `<label class="radiocard"><input type="radio" name="how" value="${v}" ${how === v ? "checked" : ""}><span><b>${t}</b><span>${d}</span></span></label>`;
  return `<p class="stage-intro">Not scored, but a missing item blocks procurement before any grading. Ask the vendor for these documents up front.</p>
  <fieldset class="fs"><legend>How will your orchestrator reach the instrument?</legend><div class="radiocards">
    ${opt("net", "Over a network", "Ethernet or Wi-Fi on a shared network.")}
    ${opt("iso", "Over an isolated link", "A physically isolated segment or a dedicated point-to-point cable — functionally a local bus.")}
    ${opt("local", "Only over serial or USB", "No network-accessible control endpoint.")}</div></fieldset>
  ${how === "net" ? `<fieldset class="fs"><legend>Vendor deliverables <span class="meta" id="cy-n">${n} / ${e.cyber.length} supplied</span></legend>
      <div class="subchecks">${window.CYBER.map((c, i) => `<label class="chk"><input type="checkbox" data-cy="${i}" ${e.cyber[i] ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div>
      <div class="btn-row"><button class="btn sm" id="cyall">Mark all supplied</button><button class="btn sm" id="cynone">Clear</button></div></fieldset>`
    : how === "iso" ? `<div class="switches">${sw("isoAccepted", "Isolation and residual risk are documented and formally accepted", "Required to treat the link as a local bus. C1 is then evaluated as a non-network endpoint.", x)}</div>`
    : `<div class="switches">${sw("surfaceDoc", "The vendor documented the control surfaces", "Physical, serial or USB control surfaces, the command set and the host-side software. Without a network endpoint, C1 normally fails unless a supported software gateway is supplied.", x)}</div>`}`;
}
function wireContext(e) {
  const m = $("#wiz-main");
  $$("[data-ctx]", m).forEach(i => i.onchange = () => { e.ctx[i.dataset.ctx] = i.checked; touch(e); keep(() => drawMain(e)); refresh(e); $(`[data-ctx="${i.dataset.ctx}"]`, $("#wiz-main"))?.focus(); });
  $$('input[name="how"]', m).forEach(r => r.onchange = () => { e.ctx.networked = r.value !== "local"; e.ctx.isolated = r.value === "iso"; touch(e); keep(() => drawMain(e)); refresh(e); $(`input[name="how"][value="${r.value}"]`, $("#wiz-main"))?.focus(); });
  $$("[data-cy]", m).forEach(i => i.onchange = () => { e.cyber[+i.dataset.cy] = i.checked; touch(e); $("#cy-n").textContent = `${e.cyber.filter(Boolean).length} / ${e.cyber.length} supplied`; refresh(e); });
  const all = $("#cyall"); if (all) all.onclick = () => { e.cyber = e.cyber.map(() => true); touch(e); keep(() => drawMain(e)); refresh(e); toast("All deliverables marked as supplied."); };
  const none = $("#cynone"); if (none) none.onclick = () => { e.cyber = e.cyber.map(() => false); touch(e); keep(() => drawMain(e)); refresh(e); };
}

/* ---------- criteria: one at a time ---------- */
function drawStrip(e) {
  const s = $("#cstrip"); if (!s) return;
  const st = STAGES[e.stage];
  s.innerHTML = tierCrit(st.id).map(c => { const g = effectiveGrade(e, c); return `<button class="cs ${g || "U"} ${c.n === e.cur ? "cur" : ""}" data-cur="${c.n}" ${c.n === e.cur ? 'aria-current="true"' : ""} title="C${c.n} ${esc(c.name)}"><span class="cs-n">C${c.n}</span><span class="cs-g" aria-hidden="true">${g ? GICON[g] : ""}</span><span class="sr-only">${esc(c.name)}: ${g ? GL[g] : "not graded"}</span></button>`; }).join("");
  $$("[data-cur]", s).forEach(b => b.onclick = () => { e.cur = +b.dataset.cur; touch(e); drawMain(e); drawSide(e); $(`[data-cur="${e.cur}"]`, $("#cstrip"))?.focus(); });
}
function gradeOptions(c) {
  const g = window.GRADING[c.n] || {};
  const naText = c.full?.applicability ? String(c.full.applicability).split(/\n\s*\n/)[0] : "This criterion does not apply to the instrument.";
  return [["G", g.pass], ["P", g.partial], ["F", g.fail]].concat(NA_OK.has(c.n) ? [["NA", naText]] : []);
}
function drawPanel(e) {
  const c = CRIT.find(c => c.n === e.cur), g = window.GRADING[c.n] || {}, cs = tierCrit(c.tier), i = cs.indexOf(c);
  const cur = e.grades[c.n];
  $("#cpanel").innerHTML = `<article class="cpanel t${c.tier}" id="C${c.n}" aria-labelledby="cp-h">
    <header class="cp-head"><p class="eyebrow">C${c.n} · ${TIER[c.tier]} · weight ${wOf(c)}${wOf(c) !== c.w ? ` (paper ${c.w})` : ""} · effort ${esc(g.effort || "")} <span class="cp-pos">${i + 1} of ${cs.length}</span></p>
      <h3 id="cp-h" tabindex="-1">${esc(c.name)}</h3></header>
    <p class="cp-checks">${esc(c.checks)}</p>
    <div class="cp-test"><p class="field-label">${icon("flask", 14)} How to test</p><p>${esc(c.hint)}</p></div>
    <fieldset class="gradeset"><legend>Which description fits? <span class="meta">Pick one</span></legend>
      ${gradeOptions(c).map(([k, d], j) => `<label class="gopt ${k}"><input type="radio" name="g-${c.n}" value="${k}" ${cur === k ? "checked" : ""}>
        <span class="gopt-h"><span class="gopt-ic" aria-hidden="true">${GICON[k]}</span>${GL[k]}<kbd aria-hidden="true">${j + 1}</kbd></span><span class="gopt-d">${esc(d)}</span></label>`).join("")}
      ${cur ? `<button class="linkbtn" id="gclear">Clear grade</button>` : ""}
    </fieldset>
    ${g.note ? `<p class="cp-note"><b>Note</b> ${esc(g.note)}</p>` : ""}
    <div id="cp-follow" class="cp-follow">${followups(e, c)}</div>
    <label class="field"><span class="field-label">Evidence and notes</span><textarea data-note="${c.n}" rows="3" placeholder="What you tested, document references, links…">${esc(e.notes[c.n] || "")}</textarea></label>
    ${reqChecklist(e, c)}
    ${c.full ? `<details class="sub"><summary>Full criterion text</summary>${[["Requirement", c.full.requirement], ["Applicability", c.full.applicability], ["Grading", c.full.grading], ["Test", c.full.test], ["Rationale", c.full.rationale]].filter(([, t]) => t).map(([h, t]) => `<p class="field-label">${h}</p>${String(t).split(/\n\s*\n/).map(p => `<p class="hint">${esc(p)}</p>`).join("")}`).join("")}</details>` : ""}
  </article>`;
  wirePanel(e, c, $("#cpanel"));
}
function wirePanel(e, c, root) {
  $$(`input[name="g-${c.n}"]`, root).forEach(r => r.onchange = () => setGrade(e, c.n, r.value, root));
  const gc = $("#gclear", root); if (gc) gc.onclick = () => { setGrade(e, c.n, undefined, root); drawPanel(e); $(`input[name="g-${c.n}"]`, $("#cpanel"))?.focus(); };
  wireNotes(e, root);
}
function setGrade(e, n, v, root) {
  if (v) e.grades[n] = v; else delete e.grades[n];
  touch(e);
  const c = CRIT.find(c => c.n === n);
  const f = root.querySelector(`[data-follow="${n}"]`) || $("#cp-follow", root);
  if (f) { f.innerHTML = followups(e, c); wireNotes(e, f); }
  if (v && !$("#gclear", root) && $("#cpanel")) { const fs = $(".gradeset", root); fs.insertAdjacentHTML("beforeend", `<button class="linkbtn" id="gclear">Clear grade</button>`); $("#gclear", root).onclick = () => { setGrade(e, n, undefined, root); drawPanel(e); }; }
  refresh(e);
}
function reqChecklist(e, c) {
  const items = c.full?.requirementItems; if (!items) return "";
  const ticks = (e.reqChecks || {})[c.n] || [], boxed = items.map((it, i) => /^(MUST|SHOULD)/.test(it.m || "") ? i : -1).filter(i => i >= 0);
  return `<details class="sub reqlist"><summary>Requirement checklist <span class="meta" data-reqn="${c.n}">${boxed.filter(i => ticks.includes(i)).length} / ${boxed.length} MUST/SHOULD ticked</span></summary><ul class="req">${items.map((it, i) => `<li class="${it.sub ? "sub" : ""}">${boxed.includes(i) ? `<label class="chk"><input type="checkbox" data-req="${c.n}:${i}" ${ticks.includes(i) ? "checked" : ""}><span>` : "<span>"}${it.m ? `<b class="modal">${esc(it.m)}</b> ` : ""}${esc(it.t)}</span>${boxed.includes(i) ? "</label>" : ""}</li>`).join("")}</ul><p class="hint">Ticks are notes for you; they do not change the grade.</p></details>`;
}
// Follow-up fields a grade triggers (remediation, gap acceptance, reason codes, caps).
function followups(e, c) {
  const cur = e.grades[c.n];
  const flag = (k, t) => `<label class="chk"><input type="checkbox" data-flag="${k}" ${e[k] ? "checked" : ""}><span>${t}</span></label>`;
  const out = [];
  const wantsRemed = (c.tier === "C" && cur === "P") || (c.tier === "I" && cur === "F") || (c.tier === "X" && (cur === "P" || cur === "F"));
  if (c.tier === "C" && cur === "F") out.push(`<p class="fu-msg bad">A Critical Fail disqualifies the instrument, whatever its total.</p>`);
  if (c.tier === "C" && cur === "P") out.push(`<p class="fu-msg warn">A Critical Partial is accepted only with a written remediation commitment and a target date (12-month ceiling recommended), and at most one per instrument.</p>`);
  if (c.n === 17 && cur === "P") out.push(`<label class="field"><span class="field-label">Partial reason code (required)</span><select data-annot="17"><option value="">Choose…</option>${["P-OLD — certification covers an older version", "P-GAP — implementation or test-coverage gap", "P-UNDOC — evidence not tied to shipped firmware / companion depth undocumented"].map(o => { const v = o.slice(0, o.indexOf(" ")); return `<option value="${v}" ${e.annot[17] === v ? "selected" : ""}>${o}</option>`; }).join("")}</select></label>
      ${e.annot[17] === "P-OLD" ? `<label class="field"><span class="field-label">Re-certification roadmap target date</span><input type="date" data-annotdate="17" value="${esc(e.annotDate?.[17] || "")}"></label>` : ""}`);
  if (c.n === 15 && cur === "G") out.push(flag("c15noReconnect", "Reconnect semantics are not explicit — caps C15 at Partial") + flag("c15fixedDefault", "The vendor’s safe default cannot be configured or overridden by the orchestrator — caps C15 at Partial"));
  if (c.n === 21 && cur === "NA") out.push(flag("c21naVerified", "No safety-event source, confirmed by schematic, safety I/O declaration or integrator (otherwise the N/A is recorded as unverified); evaluate the instrument under C15 and C10"));
  if (c.n === 6 && cur === "P") out.push(`<label class="field"><span class="field-label">Which Partial case?</span><select data-annot="6"><option value="">Choose…</option>${[["a-no-b", "Runtime introspection (a) without state-aware availability (b)"], ["static", "Static contract only (OpenAPI / JSON Schema / IDL), no runtime introspection"]].map(([v, l]) => `<option value="${v}" ${e.annot[6] === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>`);
  if (c.n === 21 && cur && cur !== "NA") out.push(flag("c21aNA", "Sub-test (a) is N/A — no external safety-bus input by design (verify with schematic or integrator; provisional if deployment not final)")
    + (!e.c21aNA ? flag("c21fallback", "Sub-test (a) verified by fallback evidence only (fixture, simulator, FAT records, reference customer) — caps C21 at Partial") + flag("c21powerPath", "Sub-test (a) met through the power-interruption exception path, without latched-state evidence from the cell controller — caps C21 at Partial") : ""));
  if (cur === "F" && c.tier === "I") out.push(`<label class="chk"><input type="checkbox" data-gap="${c.n}" ${e.gap[c.n] ? "checked" : ""}><span>Documented institutional gap-acceptance decision (names the gap, its procurement risk and any compensating control; still counts toward the 4-point ceiling)</span></label>`);
  if (c.n === 15 && cur === "F") out.push(`<label class="chk"><input type="checkbox" data-mit="15" ${e.mit[15] ? "checked" : ""}><span>Control-session loss is handled by a documented external mechanism (cell-level watchdog, hardwired interlock, supervisory power cutoff, or orchestrator-side handling) — recorded as a deployment decision; the grade is unchanged</span></label>`);
  if (wantsRemed) out.push(`<div class="remed"><label class="field"><span class="field-label">Remediation commitment</span><textarea data-rem="${c.n}" rows="2" placeholder="What the vendor will fix, and the acceptance test that verifies it">${esc(e.remed[c.n] || "")}</textarea></label><label class="field"><span class="field-label">Target date</span><input type="date" data-remdate="${c.n}" value="${esc(e.remedDate[c.n] || "")}"></label></div>`);
  return out.join("");
}
function wireNotes(e, root) {
  const re = () => { refresh(e); };
  $$("[data-note]", root).forEach(i => i.oninput = () => { e.notes[i.dataset.note] = i.value; touch(e); });
  $$("[data-rem]", root).forEach(i => i.oninput = () => { e.remed[i.dataset.rem] = i.value; touch(e); re(); });
  $$("[data-remdate]", root).forEach(i => i.onchange = () => { e.remedDate[i.dataset.remdate] = i.value; touch(e); re(); });
  $$("[data-gap]", root).forEach(i => i.onchange = () => { e.gap[i.dataset.gap] = i.checked; touch(e); re(); });
  $$("[data-mit]", root).forEach(i => i.onchange = () => { e.mit[+i.dataset.mit] = i.checked; touch(e); re(); });
  $$("[data-annot]", root).forEach(i => i.onchange = () => { e.annot[i.dataset.annot] = i.value; touch(e); const c = CRIT.find(c => c.n === +i.dataset.annot); const f = i.closest("[data-follow], #cp-follow"); if (f) { f.innerHTML = followups(e, c); wireNotes(e, f); $(`[data-annot="${c.n}"]`, f)?.focus(); } re(); });
  $$("[data-annotdate]", root).forEach(i => i.onchange = () => { (e.annotDate ||= {})[i.dataset.annotdate] = i.value; touch(e); re(); });
  $$("[data-flag]", root).forEach(i => i.onchange = () => { e[i.dataset.flag] = i.checked; touch(e); if (i.dataset.flag === "c21aNA") { const f = i.closest("[data-follow], #cp-follow"); const c = CRIT.find(c => c.n === 21); if (f) { f.innerHTML = followups(e, c); wireNotes(e, f); $('[data-flag="c21aNA"]', f)?.focus(); } } re(); });
  $$("[data-req]", root).forEach(i => i.onchange = () => { const [n, k] = i.dataset.req.split(":").map(Number); const R = (e.reqChecks ||= {}); const a = new Set(R[n] || []); i.checked ? a.add(k) : a.delete(k); R[n] = [...a].sort((x, y) => x - y); touch(e); const m = $(`[data-reqn="${n}"]`); const all = $$("[data-req]", i.closest("ul")); if (m) m.textContent = `${all.filter(x => x.checked).length} / ${all.length} MUST/SHOULD ticked`; });
}

/* ---------- criteria: all on one page ---------- */
function critRowEdit(e, c) {
  const g = window.GRADING[c.n] || {}, cur = e.grades[c.n];
  return `<article class="cedit t${c.tier}" id="C${c.n}">
    <div class="cedit-head"><div class="cedit-title"><h3><span class="n">C${c.n}</span> ${esc(c.name)}</h3><p class="meta">${esc(c.checks)}</p></div>
      <fieldset class="gseg"><legend class="sr-only">Grade for C${c.n} ${esc(c.name)}</legend>${gradeOptions(c).map(([k]) => `<label class="gs ${k}"><input type="radio" name="g-${c.n}" value="${k}" ${cur === k ? "checked" : ""}><span><span aria-hidden="true">${GICON[k]}</span> ${GL[k]}</span></label>`).join("")}</fieldset></div>
    <div class="cp-follow" data-follow="${c.n}">${followups(e, c)}</div>
    <details class="sub"><summary>Test, grading rules and notes</summary>
      <p class="hint"><b>How to test:</b> ${esc(c.hint)}</p>
      <p class="rule"><b class="G">Pass</b> ${esc(g.pass)}</p><p class="rule"><b class="P">Partial</b> ${esc(g.partial)}</p><p class="rule"><b class="F">Fail</b> ${esc(g.fail)}</p>${g.note ? `<p class="rule"><b>Note</b> ${esc(g.note)}</p>` : ""}
      <label class="field"><span class="field-label">Evidence and notes</span><textarea data-note="${c.n}" rows="2">${esc(e.notes[c.n] || "")}</textarea></label>
      ${reqChecklist(e, c)}
    </details></article>`;
}
function wireCritRows(e, m) {
  $$(".cedit", m).forEach(row => {
    const n = +row.id.slice(1);
    $$(`input[name="g-${n}"]`, row).forEach(r => {
      r.onchange = () => setGrade(e, n, r.value, row);
      r.onclick = () => { if (r.dataset.was === "1") { r.checked = false; setGrade(e, n, undefined, row); } };   // click a chosen grade again to clear it
      r.onmousedown = () => { r.dataset.was = r.checked ? "1" : "0"; };
    });
    wireNotes(e, row);
  });
}

/* ---------- stage: review ---------- */
function reviewStage(e) {
  const r = evaluate(e), g = c => effectiveGrade(e, c), x = e.ctx;
  const cs = tierCrit("C"), is = tierCrit("I");
  const cF = cs.filter(c => g(c) === "F"), cP = cs.filter(c => g(c) === "P"), iF = is.filter(c => g(c) === "F");
  const failPts = iF.reduce((a, c) => a + wOf(c), 0);
  const row = (n, title, ok, detail) => `<li class="dp ${ok === true ? "ok" : ok === false ? "bad" : "inc"}"><span class="dp-n" aria-hidden="true">${n}</span><div><b>${title}</b> <span class="sr-only">${ok === true ? "met" : ok === false ? "not met" : "incomplete"}</span><p>${detail}</p></div></li>`;
  const c19 = CRIT.find(c => c.n === 19);
  const path = `<ol class="dpath">
    ${row(1, "Security precondition", !r.blocked, r.blocked ? "Blocked — the vendor must supply the missing deliverables before scoring." : "Cleared.")}
    ${row(2, "Critical floor", cF.length || cP.length > 1 ? false : cs.every(c => e.grades[c.n]) && !(cP.length === 1 && !(e.remed[cP[0].n] || "").trim()) ? true : null, cF.length ? `Fail on ${cF.map(c => "C" + c.n).join(", ")} — disqualifying.` : cP.length > 1 ? `${cP.length} Partials (at most 1).` : cP.length === 1 ? `One Partial (C${cP[0].n}) — needs a dated remediation commitment.` : cs.every(c => e.grades[c.n]) ? "All Critical criteria pass." : "Not all Critical criteria graded.")}
    ${row(3, "Important and local floors", failPts > 4 ? false : is.every(c => e.grades[c.n]) && iF.every(c => e.gap[c.n]) ? true : null, `${failPts} / 4 failed weighted points${iF.length ? ` (${iF.map(c => "C" + c.n).join(", ")})` : ""}${iF.some(c => !e.gap[c.n]) ? " — each Fail needs a documented gap-acceptance decision" : ""}${x.hazard ? " · C7 floor active" : ""}${x.hazard && x.unattended ? " · C15 floor active" : ""}.`)}
    ${x.cell ? row(4, "Cell-integration floor", g(c19) === "F" ? false : tierCrit("X").every(c => e.grades[c.n]) ? true : null, g(c19) === "F" ? "C19 Fail — a machine cannot load or unload it." : "C19 at least Partial or N/A.") : ""}
    ${row(x.cell ? 5 : 4, "Weighted total", !r.unrated ? true : null, `${r.headline.p} / ${r.headline.m}${x.cell ? " cell-integrated" : " standalone"} — ${esc(r.verdict)}. Ranks instruments that cleared the floors.`)}
  </ol>`;
  const tiers = ["C", "I", "X"].filter(t => t !== "X" || x.cell);
  const grid = tiers.map(t => `<div class="rgrid-tier"><p class="field-label">${TIER[t]}</p><div class="rgrid">${tierCrit(t).map(c => { const gr = g(c); return `<button class="rcell" data-jump="${c.n}" title="Edit C${c.n} ${esc(c.name)}"><span class="n">C${c.n}</span>${gradePill(gr)}</button>`; }).join("")}</div></div>`).join("");
  const commits = CRIT.filter(c => (e.remed[c.n] || "").trim()).map(c => `<li><b>C${c.n}</b> ${esc(e.remed[c.n])}${e.remedDate[c.n] ? ` <span class="meta">by ${esc(e.remedDate[c.n])}</span>` : ' <span class="meta">— no date</span>'}</li>`).join("");
  const gaps = CRIT.filter(c => e.gap[c.n] && g(c) === "F").map(c => `<li><b>C${c.n}</b> gap accepted</li>`).join("");
  const mits = Object.keys(e.mit || {}).filter(k => e.mit[k]).map(k => `<li><b>C${k}</b> external mitigation recorded</li>`).join("");
  const missing = CRIT.filter(c => (c.tier !== "X" || x.cell) && !e.grades[c.n]);
  return `
    <div class="review">
      ${missing.length ? `<p class="flag">${missing.length} criteri${missing.length === 1 ? "on is" : "a are"} not graded yet: ${missing.slice(0, 8).map(c => `<button class="linkbtn inline" data-jump="${c.n}">C${c.n}</button>`).join(" ")}${missing.length > 8 ? " …" : ""}</p>` : ""}
      <div class="rv-block"><h3>Decision path</h3><p class="hint">Applied in order; a later step never overrides an earlier one.</p>${path}</div>
      <div class="rv-block"><h3>Grades</h3><p class="hint">Select a criterion to change it.</p>${grid}</div>
      <div class="rv-block"><h3>Commitments and decisions</h3>${commits || gaps || mits ? `<ul class="rv-list">${commits}${gaps}${mits}</ul>` : `<p class="hint">None recorded.</p>`}</div>
      <div class="rv-block"><h3>RFP evidence pack <span class="meta ev-count">${e.evidence.filter(Boolean).length} / ${window.EVIDENCE.length}</span></h3>
        <p class="hint">Tick what the vendor has supplied. Ask for endpoint-specific evidence, not general statements of API availability.</p>
        <div class="subchecks">${window.EVIDENCE.map((c, i) => `<label class="chk"><input type="checkbox" data-ev="${i}" ${e.evidence[i] ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div></div>
      <div class="rv-block share"><h3>Share or export</h3>
        <p class="hint"><b>Submit to the public registry</b> opens a prefilled GitHub issue that maintainers review; publish only what your vendor contract allows. The YAML file is the repository’s <code>devices/</code> format for a pull request.</p>
        <div class="btn-row"><button class="btn pri" id="submitsc">Submit to public registry ${icon("ext", 14)}</button><button class="btn" id="devyml">${icon("download", 14)} devices/*.yml</button><button class="btn" id="json1">${icon("download", 14)} JSON</button><button class="btn" id="csv2">${icon("download", 14)} CSV</button><button class="btn" id="print2">${icon("print", 14)} Print / PDF</button></div>
        <p class="hint"><a href="#instruments?view=compare">Compare it with other instruments</a></p></div>
    </div>`;
}
function wireReview(e) {
  const m = $("#wiz-main");
  $$("[data-jump]", m).forEach(b => b.onclick = () => { const c = CRIT.find(c => c.n === +b.dataset.jump); goStage(e, STAGES.findIndex(s => s.id === c.tier), { crit: c.n }); });
  $$("[data-ev]", m).forEach(i => i.onchange = () => { e.evidence[+i.dataset.ev] = i.checked; touch(e); $(".ev-count", m).textContent = `${e.evidence.filter(Boolean).length} / ${window.EVIDENCE.length}`; });
  $("#submitsc").onclick = () => openIssue(scorecardIssue(e));
  $("#devyml").onclick = () => { const { name, text, todo } = toDeviceYAML(e); download(name, text, "text/yaml"); if (todo.length) openDialog({ title: "Exported — a few things to fill in", html: `<p>${esc(name)} was downloaded. Before submitting it, fill in:</p><ul class="rv-list">${todo.map(t => `<li>${esc(t)}</li>`).join("")}</ul><p class="hint">Then run <code>uv run python build/score_device.py --check</code>.</p>` }); };
  $("#json1").onclick = () => download(`${H.slugify(nameOf(e)) || "evaluation"}.json`, JSON.stringify(e, null, 2), "application/json");
  $("#csv2").onclick = () => download(`${H.slugify(nameOf(e)) || "evaluation"}_scorecard.csv`, toCSV([e]), "text/csv");
  $("#print2").onclick = () => window.print();
}

/* Keyboard shortcuts in the one-at-a-time layout: 1–4 grade, ←/→ previous/next. */
document.addEventListener("keydown", ev => {
  if (H.page !== "score" || !W || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const t = ev.target, tag = t.tagName;
  if (document.querySelector("dialog[open]")) return;
  if (tag === "TEXTAREA" || tag === "SELECT" || (tag === "INPUT" && !["radio", "checkbox"].includes(t.type)) || t.isContentEditable) return;
  const st = STAGES[W.stage];
  if (!["C", "I", "X"].includes(st.id) || mode() !== "one" || !$("#cpanel")) return;
  if (/^[1-4]$/.test(ev.key)) {
    const c = CRIT.find(c => c.n === W.cur), opts = gradeOptions(c), o = opts[+ev.key - 1]; if (!o) return;
    ev.preventDefault();
    const r = $(`input[name="g-${c.n}"][value="${o[0]}"]`, $("#cpanel")); if (r) { r.checked = true; setGrade(W, c.n, o[0], $("#cpanel")); }
  } else if ((ev.key === "ArrowRight" || ev.key === "ArrowLeft") && t.type !== "radio") {
    ev.preventDefault(); move(W, ev.key === "ArrowRight" ? 1 : -1);
  }
});

H.routes.score = { render: renderWizard, title: (arg) => { const e = evalById(arg); return e ? `${nameOf(e)} · Scorecard` : "Score an instrument"; } };
})(window.SDLHub);

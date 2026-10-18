/* SDL autonomous-readiness scoring engine (Table 7, Fig. 5 and Supplementary Note S1).
   One implementation shared by the web app (window.SDLScore), the API build script (Node)
   and any agent that loads this file. No DOM access.

   evaluate(evaluation, { criteria, weights, cyberCount }) → {
     verdict, cls, pts, max, ptsCell, maxCell, headline, unrated, blocked, inelig, cond, reasons[] }
   Decision order: precondition → Critical floor → Important / conditional floors → cell floor → weighted total. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SDLScore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const GV = { G: 1, P: 0.5, F: 0 };
  const MONTH = 30.44 * 864e5;
  const CTX_DEFAULT = { cell: false, hazard: false, unattended: false, networked: true, isolated: false, isoAccepted: false, surfaceDoc: false, c20local: false, c21local: false };

  // Fill missing fields so partial evaluations (e.g. written by an agent) can be scored.
  function normalize(e, cyberCount = 10, evidenceCount = 10) {
    const o = Object.assign({ vendor: "", endpoint: "", arch: "Native endpoint", orch: "", date: "", grades: {}, notes: {}, remed: {}, remedDate: {}, gap: {}, annot: {}, annotDate: {}, mit: {}, c15noReconnect: false, c15fixedDefault: false, c21fallback: false, c21aNA: false, c21powerPath: false, c21naVerified: false }, e || {});
    o.ctx = Object.assign({}, CTX_DEFAULT, o.ctx || {});
    o.cyber = Array.isArray(o.cyber) ? o.cyber.slice(0, cyberCount).concat(Array(Math.max(0, cyberCount - o.cyber.length)).fill(false)) : Array(cyberCount).fill(false);
    o.evidence = Array.isArray(o.evidence) ? o.evidence : Array(evidenceCount).fill(false);
    return o;
  }
  function effectiveGrade(e, c) {
    let g = e.grades[c.n];
    if (c.n === 21 && g === "G" && e.c21fallback && !e.c21aNA) g = "P";   // fallback evidence caps C21 at Partial
    if (c.n === 21 && g === "G" && e.c21powerPath && !e.c21aNA) g = "P";  // power-interruption exception path without cell-controller latched-state evidence
    if (c.n === 15 && g === "G" && (e.c15noReconnect || e.c15fixedDefault)) g = "P";   // C15 Pass needs explicit reconnect semantics and an overridable safe default
    return g;
  }
  function evaluate(raw, { criteria, weights = {}, cyberCount = 10 } = {}) {
    const CRIT = criteria, e = normalize(raw, cyberCount);
    const wOf = c => weights[c.n] ?? c.w;
    const g = n => effectiveGrade(e, CRIT.find(c => c.n === n));
    let pts = 0, max = 0, ptsCell = 0, maxCell = 0, unrated = 0;
    for (const c of CRIT) {
      if (c.tier === "X" && !e.ctx.cell) continue;
      const gr = effectiveGrade(e, c);
      if (gr === "NA") continue;
      if (!gr) unrated++;
      const v = (GV[gr] ?? 0) * wOf(c);
      if (c.tier !== "X") { pts += v; max += wOf(c); }
      ptsCell += v; maxCell += wOf(c);
    }
    const c17missing = e.grades[17] === "P" && !e.annot[17];   // a C17 Partial MUST carry a reason code
    if (c17missing) unrated++;
    const out = { pts, max, ptsCell, maxCell, unrated, reasons: [], blocked: false, inelig: false, cond: false };
    const R = (lvl, t) => out.reasons.push({ lvl, t });
    if (c17missing) R("warn", "C17 Partial needs a reason code (P-OLD, P-GAP or P-UNDOC).");
    if (e.grades[17] === "P" && e.annot[17] === "P-OLD" && !e.annotDate[17]) { out.cond = true; R("warn", "C17 P-OLD: needs a published re-certification roadmap with a target date."); }
    const x = e.ctx;

    // Step 1 — cybersecurity / IT deployment precondition (unscored)
    if (x.networked && !x.isolated) {
      const miss = e.cyber.filter(v => !v).length;
      if (miss) { out.blocked = true; R("bad", `Cybersecurity/IT precondition: ${miss} of ${cyberCount} deliverables missing — procurement-blocking.`); }
      else R("ok", "Cybersecurity/IT precondition cleared.");
    } else if (x.networked && x.isolated) {
      if (!x.isoAccepted) { out.blocked = true; R("bad", "Isolated point-to-point link: isolation and residual risk must be documented and formally accepted."); }
      else R("ok", "Isolated link accepted; C1 evaluated as a non-network-accessible endpoint.");
    } else if (!x.surfaceDoc) { out.blocked = true; R("bad", "No network endpoint: vendor must document the physical/serial/USB control surfaces, command set and host software."); }
    else R("warn", "No network endpoint: normally fails C1 unless a supported software gateway is supplied.");

    if (e.arch === "Third-party gateway" && g(1) === "G") R("warn", "C1 scored Pass through a third-party gateway: this counts as an accepted external mitigation, not vendor compliance, unless the vendor supports, documents and validates the gateway.");

    // Step 2 — Critical floor
    const cs = CRIT.filter(c => c.tier === "C");
    const cF = cs.filter(c => g(c.n) === "F"), cP = cs.filter(c => g(c.n) === "P");
    if (cF.length) { out.inelig = true; R("bad", `Critical Fail on ${cF.map(c => "C" + c.n).join(", ")} — disqualifying regardless of total.`); }
    if (cP.length > 1) { out.inelig = true; R("bad", `Critical floor: ${cP.length} Partials (${cP.map(c => "C" + c.n).join(", ")}); at most one is allowed.`); }
    if (cP.length === 1) {
      const n = cP[0].n, txt = (e.remed[n] || "").trim(), d = e.remedDate[n];
      if (!txt) { out.cond = true; R("warn", `Critical Partial on C${n}: needs a written remediation commitment with an acceptance test and target date.`); }
      else if (!d) { out.cond = true; R("warn", `Critical Partial on C${n}: remediation recorded but no target date (12-month ceiling recommended).`); }
      else if (new Date(d) - new Date(e.date || Date.now()) > 12 * MONTH) { out.cond = true; R("warn", `Critical Partial on C${n}: target date is more than 12 months out — the vendor effectively passes without compliance.`); }
      else R("ok", `Critical Partial on C${n} accepted with a dated remediation commitment.`);
    }
    if (!cF.length && cP.length <= 1) R("ok", "Critical floor met.");

    if (e.grades[15] === "G" && (e.c15noReconnect || e.c15fixedDefault)) R("warn", "C15 capped at Partial: reconnect semantics not explicit, or the safe default cannot be configured or overridden by the orchestrator.");

    // Step 3 — Important floor and conditional floors
    const iF = CRIT.filter(c => c.tier === "I" && g(c.n) === "F");
    const failPts = iF.reduce((a, c) => a + wOf(c), 0);
    if (failPts > 4) { out.inelig = true; R("bad", `Important floor: failed criteria total ${failPts} weighted points (ceiling 4).`); }
    else R("ok", `Important floor met (${failPts} / 4 failed weighted points).`);
    const noGap = iF.filter(c => !e.gap[c.n]);
    if (noGap.length) { out.cond = true; R("warn", `Documented institutional gap-acceptance decision needed for Important Fail on ${noGap.map(c => "C" + c.n).join(", ")}.`); }
    if (x.hazard && x.unattended && g(15) === "F" && !e.mit[15]) { out.inelig = true; R("bad", "C15 floor: unattended hazardous instrument with unobservable control-session loss and no documented external mechanism."); }
    if (x.hazard && g(7) === "F") { out.inelig = true; R("bad", "C7 conditional floor: hazardous actuation / shared-resource blocking requires at least Partial."); }

    // Step 4 — cell-integration floor and buyer-defined local floors
    if (x.cell) {
      if (g(19) === "F") { out.inelig = true; R("bad", "C19 Fail: a machine cannot load/unload the instrument — disqualified from cell deployment."); }
      for (const n of [20, 21]) if (x["c" + n + "local"] && g(n) === "F") { out.inelig = true; R("bad", `Local floor: C${n} must be at least Partial.`); }
      if (g(19) !== "F") R("ok", "Cell-integration floor met.");
      if (e.c21fallback && !e.c21aNA && e.grades[21] === "G") R("warn", "C21 capped at Partial: sub-test (a) was verified with fallback evidence, not by asserting the hardware safety signal.");
      if (e.c21powerPath && !e.c21aNA && e.grades[21] === "G") R("warn", "C21 capped at Partial: power-interruption exception path without latched-state evidence from the cell controller.");
      if (e.grades[21] === "NA" && !e.c21naVerified) R("warn", "C21 N/A is unverified: confirm no safety-event source with a schematic, safety I/O declaration or integrator; evaluate the instrument under C15 and C10.");
    }

    out.headline = x.cell ? { p: ptsCell, m: maxCell } : { p: pts, m: max };
    if (out.blocked) { out.verdict = "Blocked — precondition not met"; out.cls = "bad"; }
    else if (out.inelig) { out.verdict = "Not eligible"; out.cls = "bad"; }
    else if (unrated) { out.verdict = `Incomplete — ${unrated} criteri${unrated === 1 ? "on" : "a"} unrated`; out.cls = "inc"; }
    else if (out.cond) { out.verdict = "Conditionally eligible"; out.cls = "warn"; }
    else { out.verdict = "Eligible"; out.cls = "ok"; }
    out.status = { bad: out.blocked ? "blocked" : "not_eligible", inc: "incomplete", warn: "conditionally_eligible", ok: "eligible" }[out.cls];
    return out;
  }
  // The three floors exactly as build/score_device.py checks them for devices/*.yml (no
  // precondition, remediation dates or gap decisions). Cell floor applies when any
  // Cell-integration criterion is graded other than N/A.
  function repoFloors(raw, { criteria } = {}) {
    const e = normalize(raw), CRIT = criteria, g = n => e.grades[n];
    const ofTier = t => CRIT.filter(c => c.tier === t);
    const cg = ofTier("C").map(c => g(c.n));
    const critical = !cg.includes("F") && cg.filter(x => x === "P").length <= 1;
    const impFail = ofTier("I").filter(c => g(c.n) === "F").reduce((a, c) => a + c.w, 0);
    const cellIds = ofTier("X").map(c => c.n);
    const cellApplies = cellIds.some(n => g(n) && g(n) !== "NA");
    const floors = { critical, important: impFail <= 4 };
    if (cellApplies) floors.cell = g(cellIds[0]) !== "F";
    return { floors, cellApplies, eligible: Object.values(floors).every(Boolean), unrated: CRIT.some(c => !g(c.n)) };
  }
  return { evaluate, effectiveGrade, normalize, repoFloors, GRADE_VALUE: GV };
});

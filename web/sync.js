/* Aligns the site with the repository's source of truth (window.SCORECARD_SOURCE, generated
   from criteria/*.yml, meta.yml and devices/*.yml by build/build_web.py). Loaded after
   data.js, grading.js and scorecards.js, before score.js and app.js.
   - Criterion name, tier, weight, effort, permitted grades and the "What it checks" line
     (YAML summary = paper Table 7) come from the YAML files. The site's short test hints and
     Pass-Partial-Fail paraphrases stay; the full YAML text is attached as c.full for display.
   - devices/*.yml evaluations are added to the public scorecards. */
(function () {
  "use strict";
  const S = window.SCORECARD_SOURCE;
  if (!S) return;
  window.SCORECARD_VERSION = S.version;

  const byN = new Map(S.criteria.map(c => [c.n, c]));
  for (const c of window.CRITERIA) {
    const src = byN.get(c.n);
    if (!src) continue;
    Object.assign(c, { name: src.name, tier: src.tier, w: src.w, full: src });
    if (src.summary) c.checks = String(src.summary).trim().replace(/\.?$/, ".");
    if (window.GRADING[c.n]) window.GRADING[c.n].effort = src.effort;
  }
  window.NA_OK = S.criteria.filter(c => c.gradeOptions.includes("NA")).map(c => c.n);

  // The paper's worked example already ships in scorecards.js with its remediation dates
  // and annotations, which the YAML file does not record; keep that richer copy.
  const SKIP = new Set(["example-reader-x"]);
  const cyberCount = (window.CYBER || []).length || 10;
  for (const d of S.devices) {
    if (SKIP.has(d.slug)) continue;
    const cellIds = S.criteria.filter(c => c.tier === "X").map(c => String(c.n));
    window.PUBLIC_SCORECARDS.push({
      id: d.slug,
      vendor: `${d.vendor} ${d.model}`,
      model: d.model,
      endpoint: d.interface || "",
      arch: d.architecture || "Native endpoint",
      instrumentClass: d.category || "",
      group: d.group || "",
      tasks: d.tasks || [],
      interfaces: d.interfaces || [],
      firmware: d.firmwareVersion || "",
      productUrl: d.productUrl || "",
      source: `devices/${d.slug}.yml`,
      submittedBy: d.evaluator,
      date: d.date,
      verified: d.verified,
      scorecardVersion: d.scorecardVersion,
      evidenceBasis: d.evidenceBasis,
      vendorResponse: d.vendorResponse || "",
      grades: d.grades,
      notes: d.notes,
      evidenceLinks: d.evidence,
      // Same rule as build/score_device.py: the cell tier applies when any of its criteria
      // is graded other than N/A (the deployment field is informational).
      ctx: { cell: cellIds.some(n => d.grades[n] && d.grades[n] !== "NA") },
      // Device files do not record the cybersecurity precondition (it is a deployment
      // precondition, not a scored criterion), so it is treated as cleared here.
      cyber: Array(cyberCount).fill(true),
      cyberAssumed: true
    });
  }
})();

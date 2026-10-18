/* Public scorecard registry — instrument evaluations that have been reviewed and accepted
   (via the "Submit a scorecard" GitHub issue form). Each entry uses the same shape as an
   exported evaluation (see api/v1/schema/evaluation.schema.json) plus provenance fields.
   Verdicts and totals are never stored here: they are computed by score.js. */
window.PUBLIC_SCORECARDS = [
  Object.assign({}, window.READER_X, {
    id: "reader-x",
    vendor: "Reader X (worked example)",
    instrumentClass: "Fluorescence plate reader",
    source: "Worked example",
    submittedBy: "Toolkit maintainers",
    date: "2026-09-16",
    ctx: { cell: true, hazard: false, unattended: false, networked: true, isolated: false, isoAccepted: false, surfaceDoc: false, c20local: false, c21local: false },
    cyber: Array(10).fill(true),
    evidence: Array(10).fill(false)
  })
];

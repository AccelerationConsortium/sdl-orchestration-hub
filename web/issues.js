/* Parses GitHub issues created from the submission issue forms (.github/ISSUE_TEMPLATE/) into
   pending orchestrator records and pending evaluations. Works the same for issues opened from
   the web tool (prefilled) and issues filed directly on GitHub, because both are rendered by
   GitHub as "### <field label>" sections. Field labels come from window.SCORECARD_SOURCE.issueForms
   (generated from the templates by build/build_web.py).

   One implementation shared by the web app (window.SDLIssues) and the snapshot script (Node).
   No DOM access. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SDLIssues = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const GRADE = { pass: "G", partial: "P", fail: "F", "n/a": "NA", na: "NA" };
  const GROUP = { "measurement and analysis": "measurement", "reaction hardware": "reaction", "sample handling and preparation": "sample-handling", "process sensing and control": "process-control", "labware-moving robots": "labware-robot" };
  const list = t => String(t || "").split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  const FAMILY = { "formal standard": "formal", "hardware-abstraction layer": "hal", "model-facing (mcp)": "agentic", "bespoke conventions": "bespoke" };
  const slug = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const labelsOf = issue => (issue.labels || []).map(l => typeof l === "string" ? l : l.name);

  // "### Label\n\nvalue" sections → { label: value }. GitHub writes "_No response_" for empty fields.
  function sections(body) {
    const out = {};
    const parts = String(body || "").replace(/\r\n/g, "\n").split(/^###[ \t]+/m).slice(1);
    for (const p of parts) {
      const nl = p.indexOf("\n");
      const label = (nl < 0 ? p : p.slice(0, nl)).trim();
      let value = nl < 0 ? "" : p.slice(nl + 1).trim();
      if (value === "_No response_") value = "";
      out[label] = value;
    }
    return out;
  }

  function kindOf(issue, forms) {
    const labels = labelsOf(issue), title = issue.title || "";
    for (const [kind, f] of Object.entries(forms || {})) {
      if (labels.includes(kind)) return kind;
      if (f.titlePrefix && title.toLowerCase().startsWith(f.titlePrefix.toLowerCase())) return kind;
    }
    return null;
  }

  function fieldsOf(issue, form) {
    const sec = sections(issue.body), out = {};
    for (const [label, id] of Object.entries(form.fields || {})) if (label in sec) out[id] = sec[label];
    return out;
  }

  // Scores block: one line per criterion, e.g.  "C17 Conformance and certification: Partial (P-GAP — note) https://…"
  function parseScores(text, errors) {
    const grades = {}, notes = {}, links = {};
    for (const line of String(text || "").split("\n")) {
      const m = line.match(/^\s*C(\d{1,2})\b[^:]*:\s*(.*)$/i);
      if (!m) continue;
      const n = m[1];
      let rest = m[2].trim();
      const url = rest.match(/https?:\/\/\S+/);
      if (url) { links[n] = url[0].replace(/[).,]+$/, ""); rest = rest.replace(url[0], "").trim(); }
      const g = rest.match(/^(pass|partial|fail|n\/a|na)\b/i);
      if (!g) { if (rest) errors.push(`C${n}: unrecognised grade "${rest.slice(0, 30)}"`); continue; }
      grades[n] = GRADE[g[1].toLowerCase()];
      const note = rest.slice(g[0].length).trim().replace(/^[-–—:]\s*/, "").replace(/^\((.*)\)$/s, "$1").trim();
      if (note) notes[n] = note;
    }
    return { grades, notes, links };
  }

  function stripFence(t) {
    const m = String(t || "").match(/```[a-z]*\n?([\s\S]*?)```/i);
    return (m ? m[1] : t || "").trim();
  }

  function deviceEval(issue, f, { criteria } = {}) {
    const errors = [];
    const { grades, notes, links } = parseScores(f.scores, errors);
    const cellIds = (criteria || []).filter(c => c.tier === "X").map(c => String(c.n));
    const annot = {};
    if (grades[17] === "P") { const code = (notes[17] || "").match(/\bP-(OLD|GAP|UNDOC)\b/); if (code) annot[17] = code[0]; }
    const missing = (criteria || []).filter(c => !grades[c.n]).map(c => "C" + c.n);
    if (missing.length) errors.push(`not graded: ${missing.join(", ")}`);
    const arch = /^(Native endpoint|Vendor edge-controller|Third-party gateway)$/.test(f.architecture || "") ? f.architecture : "Native endpoint";
    return {
      errors,
      evaluation: {
        id: `issue-${issue.number}`,
        vendor: [f.vendor, f.model].filter(Boolean).join(" ") || issue.title,
        model: f.model || "", endpoint: f.interface || "", arch,
        instrumentClass: f.category || "", firmware: f.firmware || "", productUrl: f.product_url || "",
        group: GROUP[String(f.group || "").toLowerCase()] || "", tasks: list(f.tasks), interfaces: list(f.interfaces),
        evidenceBasis: f.evidence_basis || "", deployment: f.deployment || "",
        submittedBy: f.evaluator || (issue.user && issue.user.login) || "",
        date: String(issue.created_at || "").slice(0, 10),
        grades, notes, evidenceLinks: links, annot,
        ctx: { cell: cellIds.some(n => grades[n] && grades[n] !== "NA") },
        // Issue forms do not ask for the cybersecurity precondition; treated as cleared, as for devices/*.yml.
        cyber: null, cyberAssumed: true,
        source: `issue #${issue.number}`
      }
    };
  }

  function orchestratorRecord(issue, f) {
    const errors = [];
    let rec = null;
    const json = stripFence(f.json);
    if (json && /^[{[]/.test(json)) { try { rec = JSON.parse(json); } catch (e) { errors.push("machine-readable record is not valid JSON; used the form fields"); } }
    if (!rec || typeof rec !== "object") {
      const [lat, lng] = String(f.coords || "").split(/[,;\s]+/).filter(Boolean).map(Number);
      const loc = String(f.location || "").split(",").map(s => s.trim()).filter(Boolean);
      const urls = String(f.links || "").match(/https?:\/\/\S+/g) || [];
      rec = {
        id: slug(f.name), name: f.name || "", org: f.org || "",
        city: loc.slice(0, -1).join(", "), country: loc.slice(-1)[0] || "",
        lat, lng, family: FAMILY[String(f.family || "").toLowerCase()] || "bespoke",
        mech: f.mech || "", standards: String(f.standards || "").split(",").map(s => s.trim()).filter(Boolean),
        license: f.license || "", notes: "",
        website: urls.find(u => !/github\.com|gitlab\.com|doi\.org|arxiv\.org/.test(u)) || urls[0] || "",
        repo: urls.find(u => /github\.com|gitlab\.com/.test(u)) || "",
        docs: "", paper: urls.find(u => /doi\.org|arxiv\.org/.test(u)) || "", logo: ""
      };
    }
    rec = Object.assign({ standards: [], links: undefined }, rec);
    delete rec.links;
    if (!rec.id) rec.id = slug(rec.name);
    if (typeof rec.lat !== "number" || typeof rec.lng !== "number" || isNaN(rec.lat) || isNaN(rec.lng)) { errors.push("no usable latitude/longitude; not placed on the map"); rec.lat = rec.lng = null; }
    rec.verified = false;
    rec.unverified = `Pending review in issue #${issue.number}; not part of the curated survey.`;
    return { errors, record: rec };
  }

  // issue (GitHub REST shape, or the snapshot's trimmed copy) → parsed submission
  function parse(issue, { forms, criteria } = {}) {
    const kind = kindOf(issue, forms);
    const base = {
      number: issue.number, title: issue.title, url: issue.html_url, kind,
      author: issue.user && issue.user.login, created: issue.created_at, updated: issue.updated_at,
      labels: labelsOf(issue)
    };
    if (!kind) return Object.assign(base, { errors: ["not a submission form issue"] });
    const f = fieldsOf(issue, forms[kind]);
    const r = kind === "device" ? deviceEval(issue, f, { criteria }) : orchestratorRecord(issue, f);
    return Object.assign(base, r, { fields: f });
  }

  // Keep open, non-PR issues that are submissions (by label or by form title prefix).
  function isSubmission(issue, forms) {
    if (issue.pull_request) return false;
    if (issue.state && issue.state !== "open") return false;
    return labelsOf(issue).includes("submission") || !!kindOf(issue, forms);
  }

  // Trimmed copy for the snapshot file (no tokens, avatars or reactions).
  const trim = i => ({ number: i.number, title: i.title, html_url: i.html_url, state: i.state, user: i.user ? { login: i.user.login } : null,
    created_at: i.created_at, updated_at: i.updated_at, labels: labelsOf(i), body: i.body || "" });

  return { parse, isSubmission, sections, parseScores, kindOf, trim };
});

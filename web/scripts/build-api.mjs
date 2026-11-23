#!/usr/bin/env node
/* Generates the static, machine-readable API in api/v1/ (plus llms.txt) from the same data
   files the website uses. Run after build/build_web.py, or after editing data.js, grading.js or scorecards.js:

     node scripts/build-api.mjs

   Everything is plain JSON served as static files — no server is required. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "api", "v1");
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["config.js", "tools.js", "data.js", "grading.js", "scorecards.js", "scorecard-data.js", "sync.js", "score.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
}
const { SITE, TOOLS, EXCLUDED, STANDARDS, SCENARIOS, CYBER, CRITERIA, EVIDENCE, GRADING, PUBLIC_SCORECARDS, SDLScore, INSTRUMENT_GROUPS, TUTORIALS } = ctx;
const VERSION = SITE.apiVersion || "v1";
const BASE = (SITE.siteUrl || "").replace(/\/$/, "");
const href = p => `${BASE}/api/${VERSION}/${p}`;
const generated = new Date().toISOString();
const write = (rel, data) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return rel;
};
const meta = extra => Object.assign({ api: `sdl-device-integration/${VERSION}`, generated, framework: "Autonomous-readiness criteria for SDL instrument interfaces" }, extra);

const FAMILY = { formal: "Formal standard", hal: "Hardware-abstraction layer", agentic: "Model-facing (MCP)", bespoke: "Bespoke conventions" };
const TIER = { C: "critical", I: "important", X: "cell_integration" };
const REGION = { USA: "North America", Canada: "North America", Germany: "Europe", UK: "Europe", Netherlands: "Europe", Switzerland: "Europe", Japan: "Asia", China: "Asia", "Republic of Korea": "Asia", "New Zealand": "Oceania" };
const stdBase = s => s.replace(/\s*\(.*\)\s*$/, "").trim();
const NA_OK = new Set(ctx.NA_OK || []);

/* ---------- scorecards (computed with the shared engine) ---------- */
const scorecards = PUBLIC_SCORECARDS.map(sc => {
  const r = SDLScore.evaluate(sc, { criteria: CRITERIA, cyberCount: CYBER.length });
  return {
    id: sc.id, instrument: sc.vendor, instrumentClass: sc.instrumentClass || null, group: sc.group || null, tasks: sc.tasks || [],
    endpoint: sc.endpoint, interfaces: sc.interfaces || [], architecture: sc.arch,
    date: sc.date || null, source: sc.source || null, submittedBy: sc.submittedBy || null,
    deployment: sc.ctx,
    grades: Object.fromEntries(CRITERIA.map(c => [`C${c.n}`, sc.grades[c.n] ?? null])),
    notes: Object.fromEntries(Object.entries(sc.notes || {}).map(([k, v]) => [`C${k}`, v])),
    remediation: Object.fromEntries(Object.entries(sc.remed || {}).map(([k, v]) => [`C${k}`, { commitment: v, targetDate: (sc.remedDate || {})[k] || null }])),
    result: {
      status: r.status, verdict: r.verdict,
      standalone: { points: r.pts, max: r.max }, cellIntegrated: sc.ctx.cell ? { points: r.ptsCell, max: r.maxCell } : null,
      unrated: r.unrated, reasons: r.reasons.map(x => ({ level: x.lvl, text: x.t }))
    },
    evaluation: sc   // raw evaluation object: importable into the web app and re-scorable with score.js
  };
});

/* ---------- tools ---------- */
// Every curated orchestrator's country must map to a region (the map/explorer filter and
// tools.json use it); keep this list in sync with REGION in app.js.
const unmapped = [...new Set(TOOLS.map(t => t.country).filter(c => c && !REGION[c]))];
if (unmapped.length) { console.error(`REGION has no entry for: ${unmapped.join(", ")} (add them here and in app.js)`); process.exit(1); }
const tools = TOOLS.map(t => {
  return {
    id: t.id, name: t.name,
    organisation: t.org, city: t.city || null, country: t.country || null, region: REGION[t.country] || "Other",
    location: { lat: t.lat, lng: t.lng },
    family: t.family, familyLabel: FAMILY[t.family], standardRequired: !!t.enforced,
    integrationMechanism: t.mech, standards: t.standards || [], standardsBase: [...new Set((t.standards || []).map(stdBase))],
    notes: t.notes || null, license: t.license || null,
    links: { website: t.website || null, repository: t.repo || null, docs: t.docs || null, paper: t.paper || null, logo: t.logo || null },
    verified: t.verified !== false, unverifiedFields: t.verified === false ? t.unverified || null : null,
    href: href(`tools/${t.id}.json`), webUrl: `${BASE}/#orchestrators/${t.id}`
  };
});

/* ---------- criteria & rules ---------- */
const criteria = CRITERIA.map(c => {
  const g = GRADING[c.n];
  return {
    id: `C${c.n}`, n: c.n, name: c.name, tier: TIER[c.tier], weight: c.w, naAllowed: NA_OK.has(c.n),
    checks: c.checks, test: c.hint, effort: g.effort,
    grading: { pass: g.pass, partial: g.partial, fail: g.fail, note: g.note || null }
  };
});
const rules = {
  grades: { G: { label: "Pass", value: 1 }, P: { label: "Partial", value: 0.5 }, F: { label: "Fail", value: 0 }, NA: { label: "N/A", value: null, note: `Excluded from the denominator. Allowed only for ${(ctx.NA_OK || []).map(n => "C" + n).join(", ")}.` } },
  tiers: {
    critical: { criteria: CRITERIA.filter(c => c.tier === "C").map(c => `C${c.n}`), question: "Can the instrument be controlled programmatically and contractually at all?" },
    important: { criteria: CRITERIA.filter(c => c.tier === "I").map(c => `C${c.n}`), question: "Does the interface support robust autonomous operation?" },
    cell_integration: { criteria: CRITERIA.filter(c => c.tier === "X").map(c => `C${c.n}`), question: "Can the instrument participate in robotic workcells? (cell-deployed only)" }
  },
  maxima: { standalone: CRITERIA.filter(c => c.tier !== "X").reduce((a, c) => a + c.w, 0), cellIntegrated: CRITERIA.reduce((a, c) => a + c.w, 0) },
  decisionOrder: [
    { step: 1, name: "precondition", rule: "All cybersecurity/IT deliverables supplied (or isolated link formally accepted, or local control surfaces documented). Otherwise status = blocked." },
    { step: 2, name: "critical_floor", rule: "No Critical criterion may Fail; at most one may be Partial, and only with a written remediation commitment and a target date ≤ 12 months." },
    { step: 3, name: "important_floor", rule: "Failed Important criteria may total at most 4 weighted points; each Important Fail needs a documented gap-acceptance decision. Conditional floors: C7 ≥ Partial for hazardous/resource-blocking instruments; C15 ≠ Fail for unattended hazardous instruments unless a documented external mechanism (cell-level watchdog, hardwired interlock, supervisory power cutoff, orchestrator-side handling) is recorded. C17 Partial requires a reason code." },
    { step: 4, name: "cell_floor", rule: "Cell-deployed only: C19 ≥ Partial where a machine loads labware (a Fail disqualifies; no mitigation exception); optional buyer-defined local floors on C20/C21." },
    { step: 5, name: "weighted_total", rule: "Σ grade × weight over applicable criteria. Used only to rank instruments that cleared steps 1–4." }
  ],
  statuses: { blocked: "Precondition not met", not_eligible: "A floor is not met", incomplete: "Some criteria unrated", conditionally_eligible: "Floors met, but a commitment or gap-acceptance is missing", eligible: "All gates and floors cleared" },
  special: [
    "C21: if sub-test (a) is verified only by fallback evidence (and is not N/A), a Pass counts as Partial.",
    "C1: a Pass via a third-party gateway is an accepted mitigation, not vendor compliance.",
    "Weights are proposed defaults; deployments may tune them. The API reports default-weight results."
  ],
  preconditionDeliverables: CYBER,
  rfpEvidencePack: EVIDENCE
};

/* ---------- schemas ---------- */
const gradeEnum = { enum: ["G", "P", "F", "NA"] };
const evaluationSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: href("schema/evaluation.schema.json"),
  title: "Instrument scorecard evaluation", description: "One instrument endpoint scored against criteria C1–C21. Same shape the web app exports/imports and score.js evaluates. Grades are keyed by criterion number.",
  type: "object", required: ["vendor", "grades"],
  properties: {
    vendor: { type: "string", description: "Instrument / vendor name" },
    endpoint: { enum: ["SiLA 2", "OPC UA + LADS", "REST + OpenAPI", "MCP", "Other"] },
    arch: { enum: ["Native endpoint", "Vendor edge-controller", "Third-party gateway"] },
    date: { type: "string", format: "date" },
    ctx: { type: "object", properties: Object.fromEntries(["cell", "hazard", "unattended", "networked", "isolated", "isoAccepted", "surfaceDoc", "c20local", "c21local"].map(k => [k, { type: "boolean" }])), additionalProperties: false },
    cyber: { type: "array", items: { type: "boolean" }, minItems: CYBER.length, maxItems: CYBER.length, description: "Precondition deliverables, in the order of rules.json preconditionDeliverables" },
    grades: { type: "object", propertyNames: { pattern: "^([1-9]|1[0-9]|2[01])$" }, additionalProperties: gradeEnum },
    notes: { type: "object", additionalProperties: { type: "string" } },
    remed: { type: "object", additionalProperties: { type: "string" }, description: "Remediation commitment text per criterion" },
    remedDate: { type: "object", additionalProperties: { type: "string", format: "date" } },
    gap: { type: "object", additionalProperties: { type: "boolean" }, description: "Documented gap acceptance for Important Fails" },
    mit: { type: "object", additionalProperties: { type: "boolean" }, description: "Documented external mechanism for C15 control-session loss" },
    annot: { type: "object", additionalProperties: { type: "string" }, description: "C6 partial case; C17 reason code (P-OLD, P-GAP, P-UNDOC)" },
    annotDate: { type: "object", additionalProperties: { type: "string", format: "date" }, description: "C17 P-OLD re-certification roadmap target date" },
    c15fixedDefault: { type: "boolean", description: "C15 vendor safe default cannot be disabled or overridden by the orchestrator (caps C15 at Partial)" },
    c21fallback: { type: "boolean" }, c21aNA: { type: "boolean" },
    c21powerPath: { type: "boolean", description: "C21 sub-test (a) via power-interruption exception path without cell-controller evidence (caps C21 at Partial)" },
    c21naVerified: { type: "boolean", description: "C21 N/A verified by schematic, safety I/O declaration or integrator" },
    model: { type: "string" }, instrumentClass: { type: "string", description: "Instrument type, e.g. plate reader" },
    group: { enum: ["", ...INSTRUMENT_GROUPS.map(g => g.id)], description: "Instrument group (see instrument-groups.json)" },
    tasks: { type: "array", items: { type: "string" }, description: "What the instrument is used for" },
    interfaces: { type: "array", items: { type: "string" }, description: "Every control interface the vendor offers" },
    scorecardVersion: { type: "string", description: "Criteria-set version the evaluation was scored against" },
    reqChecks: { type: "object", description: "Ticked MUST/SHOULD requirement items per criterion" },
    evidence: { type: "array", items: { type: "boolean" } }
  }
};
const toolSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: href("schema/tool.schema.json"),
  title: "Orchestrator record", type: "object",
  required: ["id", "name", "organisation", "family", "location"],
  properties: {
    id: { type: "string", pattern: "^[a-z0-9-]+$" }, name: { type: "string" },
    organisation: { type: "string" }, city: { type: ["string", "null"] }, country: { type: ["string", "null"] }, region: { type: "string" },
    location: { type: "object", required: ["lat", "lng"], properties: { lat: { type: "number" }, lng: { type: "number" } } },
    family: { enum: Object.keys(FAMILY) }, familyLabel: { type: "string" }, standardRequired: { type: "boolean" },
    integrationMechanism: { type: "string" }, standards: { type: "array", items: { type: "string" } }, standardsBase: { type: "array", items: { type: "string" } },
    notes: { type: ["string", "null"] }, license: { type: ["string", "null"] },
    links: { type: "object", additionalProperties: { type: ["string", "null"] } },
    verified: { type: "boolean" }, unverifiedFields: { type: ["string", "null"] },
    href: { type: "string" }, webUrl: { type: "string" }
  }
};

/* ---------- write ---------- */
// Clear generated output, but keep the submissions snapshot (written by fetch-submissions.mjs).
const SNAP = path.join(OUT, "submissions.json");
const snap = fs.existsSync(SNAP) ? fs.readFileSync(SNAP) : null;
fs.rmSync(OUT, { recursive: true, force: true });
if (snap) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(SNAP, snap); }
const endpoints = [];
const add = (rel, data, description, schema) => { write(rel, data); endpoints.push({ path: `/api/${VERSION}/${rel}`, href: href(rel), description, schema: schema || null }); };
add("tools.json", meta({ count: tools.length, items: tools, excluded: EXCLUDED.map(x => ({ name: x.name.replace(/\s*\[[^\]]*\]/, ""), why: x.why })) }), "All surveyed orchestrators with location, links, integration mechanism and standards.", href("schema/tool.schema.json"));
for (const t of tools) write(`tools/${t.id}.json`, meta({ item: t }));
endpoints.push({ path: `/api/${VERSION}/tools/{id}.json`, href: href("tools/{id}.json"), description: "One orchestrator by id.", schema: href("schema/tool.schema.json") });
add("criteria.json", meta({ count: criteria.length, items: criteria }), "Criteria C1–C21: tier, default weight, what each checks, how to test it, and the Pass/Partial/Fail rule.");
add("rules.json", meta(rules), "Scoring rules: grade values, tiers, maxima, the sequential decision order and floors, precondition deliverables, RFP evidence pack.");
add("scorecards.json", meta({ count: scorecards.length, items: scorecards }), "Public instrument scorecards with results computed by score.js.", href("schema/evaluation.schema.json"));
for (const s of scorecards) write(`scorecards/${s.id}.json`, meta({ item: s }));
endpoints.push({ path: `/api/${VERSION}/scorecards/{id}.json`, href: href("scorecards/{id}.json"), description: "One public scorecard by id." });
add("scenarios.json", meta({ count: SCENARIOS.length, items: SCENARIOS.map(s => ({ id: s.id, name: s.name, profile: s.profile, recommendation: s.rec, why: s.why, tradeoffs: s.tradeoff, recommendedStandards: (s.stdCols || []).map(i => STANDARDS.cols[i]) })), precedence: ["multisite", "robotics", "regulated", "instrument count (few → frugal, many → shared)"] }), "Deployment archetypes with recommended default integration boundary.");
add("instrument-groups.json", meta({ items: INSTRUMENT_GROUPS }), "Instrument groups (from the paper's scope statement) with suggested types and tasks, used to tag scorecards.");
add("tutorials.json", meta(TUTORIALS), "Learning path for building device connectors with SiLA 2 in Python (2026 Device Integration Hackathon), other implementations and standards such as OPC UA LADS, and the paper's advice for connector authors.");
add("standards.json", meta({ interfaces: STANDARDS.cols, criteria: STANDARDS.rows.map(([name, vals]) => ({ criterion: name, ratings: Object.fromEntries(STANDARDS.cols.map((c, i) => [c, vals[i]])) })), note: STANDARDS.note }), "Standards comparison: SiLA 2, OPC UA + LADS, typical REST, MCP.");
write("schema/evaluation.schema.json", evaluationSchema);
write("schema/tool.schema.json", toolSchema);
endpoints.push({ path: `/api/${VERSION}/schema/evaluation.schema.json`, href: href("schema/evaluation.schema.json"), description: "JSON Schema for an instrument evaluation (input to score.js and the web app's Import)." });
endpoints.push({ path: `/api/${VERSION}/schema/tool.schema.json`, href: href("schema/tool.schema.json"), description: "JSON Schema for an orchestrator record." });
endpoints.push({ path: `/api/${VERSION}/submissions.json`, href: href("submissions.json"), description: "Snapshot of open submission issues (orchestrators and device evaluations from the issue forms), raw and parsed. Refreshed by the Pages workflow; the site prefers the live GitHub API." });
endpoints.push({ path: "/issues.js", href: `${BASE}/issues.js`, description: "Issue-form parser (UMD). Node: require('./issues.js').parse(issue, { forms, criteria }). Browser: window.SDLIssues." });
endpoints.push({ path: "/score.js", href: `${BASE}/score.js`, description: "Scoring engine (UMD). Node: require('./score.js').evaluate(evaluation, { criteria }). Browser: window.SDLScore." });

/* OpenAPI 3.1 for the static GET endpoints */
const openapi = {
  openapi: "3.1.0",
  info: { title: "SDL Orchestration Hub API", version: VERSION, description: "Static, read-only JSON describing open-source SDL orchestrators, the autonomous-readiness criteria and public instrument scorecards. All endpoints are plain files; filter client-side." },
  servers: [{ url: BASE || "/" }],
  paths: Object.fromEntries(endpoints.filter(e => e.path.startsWith("/api/")).map(e => [e.path, { get: {
    summary: e.description, operationId: e.path.replace(/^\/api\/v\d+\//, "").replace(/[{}]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/_json$/, ""),
    ...(e.path.includes("{id}") ? { parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] } : {}),
    responses: { 200: { description: "OK", content: { "application/json": { schema: e.schema ? { $ref: e.schema } : { type: "object" } } } } }
  } }]))
};
write("openapi.json", openapi);
endpoints.push({ path: `/api/${VERSION}/openapi.json`, href: href("openapi.json"), description: "OpenAPI 3.1 description of these endpoints." });

write("index.json", meta({
  name: "SDL Orchestration Hub API", version: VERSION, docs: `${BASE}/#api`, llms: `${BASE}/llms.txt`,
  counts: { tools: tools.length, criteria: criteria.length, scorecards: scorecards.length, scenarios: SCENARIOS.length },
  endpoints,
  urlInterface: {
    orchestrator: `${BASE}/#orchestrators/{toolId}`,
    orchestrators: `${BASE}/#orchestrators?view={map,cards,table}&q={text}&fam={formal,hal,agentic,bespoke}&std={standard,...}&region={region,...}&lic={licence,...}&req=1&repo=1&docs=1&verified=1&nopend=1`,
    instruments: `${BASE}/#instruments?q={task or type}&grp={group,...}&ifc={interface,...}&elig=1&cell=1&req={C7:P,C14:G,...}`,
    scorecard: `${BASE}/#scorecard`,
    criterion: `${BASE}/#scorecard/C{n}`
  },
  submit: SITE.repo ? { newOrchestrator: `https://github.com/${SITE.repo}/issues/new?template=new-orchestrator.yml`, newScorecard: `https://github.com/${SITE.repo}/issues/new?template=device-scorecard.yml` } : null
}));

/* llms.txt — concise guide for language-model agents */
const llms = `# SDL Orchestration Hub

> Machine-readable companion to the SDL Orchestration Hub (workflow orchestration and device integration for self-driving labs). It lists open-source SDL orchestrators, defines 21 testable criteria for autonomous-ready instrument interfaces, and publishes instrument scorecards. All data is static JSON; there is no server-side search — fetch and filter.

## Start here
- [API index](${href("index.json")}): every endpoint, counts, URL interface, submission links
- [OpenAPI](${href("openapi.json")})

## Data
- [Orchestrators](${href("tools.json")}): ${tools.length} records; filter on family, standardsBase, region, license, standardRequired
- [Criteria C1–C21](${href("criteria.json")}): weights, tiers, test procedure, Pass/Partial/Fail rules
- [Scoring rules](${href("rules.json")}): decision order and floors — apply in order; a later step never overrides an earlier one
- [Public scorecards](${href("scorecards.json")}): instrument evaluations with computed status and totals
- [Scenarios](${href("scenarios.json")}) and [standards comparison](${href("standards.json")})
- [Instrument groups](${href("instrument-groups.json")}): the group ids, types and tasks used to tag scorecards
- [Tutorials](${href("tutorials.json")}): learning path for building device connectors

## Evaluate an instrument
1. Build an object matching [evaluation.schema.json](${href("schema/evaluation.schema.json")}). Grades: "G" Pass, "P" Partial, "F" Fail, "NA" (${(ctx.NA_OK || []).map(n => "C" + n).join(", ")} only), keyed by criterion number.
2. Score it with [score.js](${BASE}/score.js): \`require("./score.js").evaluate(evaluation, { criteria })\` where \`criteria\` is criteria.json items mapped to \`{ n, tier: "C"|"I"|"X", w: weight }\`.
3. Status is one of blocked, not_eligible, incomplete, conditionally_eligible, eligible. Rank only eligible / conditionally eligible instruments by total.

## Compare
- Compare instruments by result.status first, then result.standalone.points (or cellIntegrated for workcells).
- An instrument’s score belongs to the endpoint scored (SiLA 2, OPC UA + LADS, REST, MCP); it does not transfer to other endpoints.

## Contribute
${SITE.repo ? `- New orchestrator: https://github.com/${SITE.repo}/issues/new?template=new-orchestrator.yml\n- New scorecard: https://github.com/${SITE.repo}/issues/new?template=device-scorecard.yml` : "- Submission repository not configured."}

## Caveats
- Grading text is condensed; confirm the full criterion definition before relying on it. Weights are proposed defaults.
- Locations, links and logos were compiled separately and may be incomplete; check \`verified\` on each tool.
`;
fs.writeFileSync(path.join(ROOT, "llms.txt"), llms);

/* sanity: Reader X must reproduce Table S1 */
const rx = scorecards.find(s => s.id === "reader-x");
if (rx && (rx.result.standalone.points !== 36 || rx.result.cellIntegrated.points !== 39)) { console.error("Reader X worked-example check failed (expected 36/46, 39/52)", rx.result); process.exit(1); }
console.log(`API ${VERSION}: ${tools.length} tools, ${criteria.length} criteria, ${scorecards.length} scorecards → ${path.relative(ROOT, OUT)}/ (+ llms.txt)`);

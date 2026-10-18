/* Checks web/issues.js against issue bodies shaped the way GitHub renders the submission forms,
   for issues opened from the web tool (prefilled) and filed by hand on GitHub. Run from the
   repository root after build/build_web.py:  node web/scripts/test-issues.mjs */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WEB, "scorecard-data.js"), "utf8"), ctx);
const S = ctx.SCORECARD_SOURCE;
const { parse, isSubmission } = createRequire(import.meta.url)(path.join(WEB, "issues.js"));
const opts = { forms: S.issueForms, criteria: S.criteria };

// Render a form the way GitHub does: "### <label>\n\n<value>" per field, "_No response_" if empty.
const render = (kind, values) => Object.entries(S.issueForms[kind].fields)
  .map(([label, id]) => `### ${label}\n\n${values[id] ?? "_No response_"}`).join("\n\n");
const scores = grades => S.criteria.map(c => `C${c.n} ${c.name}: ${grades[c.n] ?? ""}`).join("\n");

// 1. Device evaluation prefilled by the web tool
const allPass = Object.fromEntries(S.criteria.map(c => [c.n, "Pass"]));
const dev = parse({ number: 7, title: "[device]: Acme Reader 9", html_url: "https://github.com/x/y/issues/7", user: { login: "alice" },
  created_at: "2026-10-01T10:00:00Z", labels: [{ name: "submission" }, { name: "device" }],
  body: render("device", { vendor: "Acme", model: "Reader 9", interface: "SiLA 2", architecture: "Vendor edge-controller", deployment: "standalone",
    evidence_basis: "hands-on-test", evaluator: "Alice Lab",
    scores: scores({ ...allPass, 12: "Fail (no calibration state)", 17: "Partial (P-GAP — partial test coverage) https://example.org/cert", 19: "N/A", 20: "Pass", 21: "N/A" }) }) }, opts);
assert.equal(dev.kind, "device");
assert.deepEqual(dev.errors, []);
const e = dev.evaluation;
assert.equal(e.vendor, "Acme Reader 9");
assert.equal(e.arch, "Vendor edge-controller");
assert.equal(e.grades[12], "F");
assert.equal(e.notes[12], "no calibration state");
assert.equal(e.grades[17], "P");
assert.equal(e.annot[17], "P-GAP");
assert.equal(e.evidenceLinks[17], "https://example.org/cert");
assert.equal(e.grades[19], "NA");
assert.equal(e.ctx.cell, true, "C20 graded → cell tier applies, as in score_device.py");
assert.equal(e.submittedBy, "Alice Lab");

// 2. Device evaluation typed by hand on GitHub: lower case, missing grades, no labels (title prefix only)
const hand = parse({ number: 8, title: "[device]: Foo HPLC", html_url: "u", user: { login: "bob" }, labels: [],
  body: render("device", { vendor: "Foo", model: "HPLC", interface: "REST", evaluator: "bob",
    scores: "C1  Orchestrator-reachable programmatic control: partial - best effort reconnect\nC2 Strong typing: pass\nC3: maybe" }) }, opts);
assert.equal(hand.kind, "device");
assert.equal(hand.evaluation.grades[1], "P");
assert.equal(hand.evaluation.notes[1], "best effort reconnect");
assert.equal(hand.evaluation.grades[2], "G");
assert.ok(hand.errors.some(x => x.startsWith("C3: unrecognised grade")));
assert.ok(hand.errors.some(x => x.startsWith("not graded:")));
assert.equal(hand.evaluation.ctx.cell, false);

// 3. Orchestrator from the web tool (machine-readable JSON block)
const rec = { id: "mylabos", name: "MyLabOS", org: "Lab", city: "Toronto", country: "Canada", lat: 43.66, lng: -79.39, family: "formal", standards: ["SiLA 2"], mech: "SiLA 2 clients", license: "MIT", verified: false };
const o1 = parse({ number: 9, title: "[Orchestrator] MyLabOS", html_url: "u", labels: ["submission", "orchestrator"],
  body: render("orchestrator", { name: "MyLabOS", org: "Lab", coords: "43.66, -79.39", family: "Formal standard", mech: "x", links: "https://a.b", json: "```json\n" + JSON.stringify(rec, null, 2) + "\n```" }) }, opts);
assert.equal(o1.kind, "orchestrator");
assert.deepEqual(o1.errors, []);
assert.equal(o1.record.id, "mylabos");
assert.equal(o1.record.lat, 43.66);
assert.equal(o1.record.verified, false);

// 4. Orchestrator filed by hand (no JSON) — built from the form fields
const o2 = parse({ number: 10, title: "[Orchestrator] Robo Hub", html_url: "u", labels: [],
  body: render("orchestrator", { name: "Robo Hub", org: "Uni X", location: "Basel, Switzerland", coords: "47.56, 7.59", family: "Bespoke conventions",
    standards: "OPC UA, SiLA 2 (optional)", mech: "Plugins", links: "https://robohub.org https://github.com/robo/hub https://doi.org/10.1/x", license: "Apache-2.0" }) }, opts);
assert.deepEqual(o2.errors, []);
assert.equal(o2.record.id, "robo-hub");
assert.equal(o2.record.country, "Switzerland");
assert.equal(o2.record.city, "Basel");
assert.deepEqual([o2.record.lat, o2.record.lng], [47.56, 7.59]);
assert.equal(o2.record.family, "bespoke");
assert.deepEqual(o2.record.standards, ["OPC UA", "SiLA 2 (optional)"]);
assert.equal(o2.record.repo, "https://github.com/robo/hub");
assert.equal(o2.record.paper, "https://doi.org/10.1/x");
assert.equal(o2.record.website, "https://robohub.org");

// 5. Filtering: PRs, closed issues and unrelated issues are not submissions
assert.equal(isSubmission({ title: "[device]: x", pull_request: {}, labels: [] }, S.issueForms), false);
assert.equal(isSubmission({ title: "[device]: x", state: "closed", labels: [] }, S.issueForms), false);
assert.equal(isSubmission({ title: "Typo in README", state: "open", labels: [] }, S.issueForms), false);
assert.equal(isSubmission({ title: "anything", state: "open", labels: ["submission"] }, S.issueForms), true);

console.log("issue parser: 5 scenarios OK");

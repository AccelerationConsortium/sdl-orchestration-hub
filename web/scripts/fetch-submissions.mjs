/* Writes web/api/v1/submissions.json: a snapshot of open submission issues (orchestrators and
   device evaluations filed through the issue forms, from the web tool or directly on GitHub).
   The site reads it when the live GitHub API is unavailable (private repository, rate limit,
   offline). Uses GITHUB_TOKEN when set (needed while the repository is private).

   Run from the repository root after build/build_web.py:
     GITHUB_TOKEN=... node web/scripts/fetch-submissions.mjs
   Without network access or permission it writes an empty snapshot that says why. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(WEB, "api", "v1", "submissions.json");
const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ["config.js", "scorecard-data.js"]) vm.runInContext(fs.readFileSync(path.join(WEB, f), "utf8"), ctx, { filename: f });
const { SITE, SCORECARD_SOURCE: S } = ctx;
const { parse, isSubmission, trim } = createRequire(import.meta.url)(path.join(WEB, "issues.js"));

async function fetchOpenIssues(repo) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "sdl-orchestration-hub-web" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

let items = [], error = null;
try {
  if (!SITE.repo) throw new Error("config.js has no repo");
  items = (await fetchOpenIssues(SITE.repo)).filter(i => isSubmission(i, S.issueForms)).map(trim);
} catch (e) {
  error = String(e.message || e);
}
const parsed = items.map(i => parse(i, { forms: S.issueForms, criteria: S.criteria }));
const snapshot = {
  generated: new Date().toISOString(),
  repo: SITE.repo,
  error,
  counts: { orchestrator: parsed.filter(p => p.kind === "orchestrator").length, device: parsed.filter(p => p.kind === "device").length },
  issues: items,
  parsed: parsed.map(({ fields, ...p }) => p)
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");
console.log(error ? `submissions snapshot: empty (${error})` : `submissions snapshot: ${items.length} open submission issue(s) → ${path.relative(process.cwd(), OUT)}`);

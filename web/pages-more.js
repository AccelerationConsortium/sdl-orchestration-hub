/* SDL Orchestration Hub — Tutorials, Submissions, API, About. */
(function (H) {
"use strict";
const { $, $$, esc, view, icon, extLink, pageHead, store, evaluate, nameOf, PUBLIC, PENDING, loadSubmissions, tone, openIssue, scorecardIssue, REPO, SITE_BASE, NA_OK, CRIT } = H;

/* =====================================================================
   TUTORIALS
   ===================================================================== */
const KIND_ICON = { "Docs": "book", "Google Doc": "doc", "Slides": "slides", "Tool": "tool", "Code (GitLab)": "code" };
function renderTutorials() {
  const T = window.TUTORIALS;
  view.innerHTML = `
  ${pageHead("Tutorials", "Learn to build a device connector: the piece of software that exposes an instrument to any orchestrator through a standard interface. The learning path below covers one route, SiLA 2 in Python with the open-source Connector Development Kit (CDK) from UniteLabs, and collects the resources from the 2026 Device Integration Hackathon. Other implementations and standards are listed under Other options.",
    `${extLink(T.source.url, "Hackathon website", "btn")}`)}
  <section class="tut-intro">
    <div class="card fit">
      <h2 class="card-title">Where a connector fits</h2>
      <ol class="ministack" aria-label="Simplified stack">
        <li><b>Orchestrator</b><span>schedules experiments, tracks labware</span></li>
        <li class="hl"><b>Standard interface</b><span>here SiLA 2 Features: typed commands, properties, errors</span></li>
        <li class="hl"><b>Your connector</b><span>maps the standard onto the vendor’s commands</span></li>
        <li><b>Instrument</b><span>vendor protocol over serial, USB or network</span></li>
      </ol>
      <p class="hint">Write the connector once and every SiLA 2-capable orchestrator can use the instrument. See the <a href="#home">five-layer model</a> for the full picture.</p>
    </div>
    <div class="card">
      <h2 class="card-title">Before you start</h2>
      <ul class="ticklist">
        <li>Python and Git on your machine (the installation guide covers the rest).</li>
        <li>The instrument’s manual or command reference — you will turn it into SiLA Features.</li>
        <li>Ideally a simulator or a spare instrument to test against.</li>
      </ul>
      <p class="hint">No instrument at hand? The tutorial connector runs without hardware.</p>
    </div>
  </section>

  <h2 class="section-title">Learning path: SiLA 2 in Python</h2>
  <p class="note-card scope-note"><b>One route of several.</b> This path uses the UniteLabs Connector Development Kit, a Python implementation of SiLA 2. You can also build a SiLA 2 connector with another implementation, such as the SiLA Consortium’s own Python package or its C# library, or use a different standard such as OPC UA LADS. <a href="#other-options">See other options</a>.</p>
  <ol class="path">${T.path.map((s, i) => `
    <li class="path-step">
      <div class="path-head"><span class="path-n" aria-hidden="true">${i + 1}</span><div><p class="eyebrow">${esc(s.step)}</p><h3>${esc(s.title)}</h3></div></div>
      <ul class="res-list">${s.items.map(r => `
        <li class="res">
          <span class="res-ic" aria-hidden="true">${icon(KIND_ICON[r.kind] || "doc", 18)}</span>
          <div class="res-body">
            <p class="res-t"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}<span class="sr-only"> (${esc(r.kind)}, opens in a new tab)</span></a> ${icon("ext", 12)}</p>
            <p class="res-d">${esc(r.desc)}${r.note ? ` <b>${esc(r.note)}</b>` : ""}${r.extra ? ` ${extLink(r.extra.url, r.extra.title)}.` : ""}</p>
          </div></li>`).join("")}</ul>
    </li>`).join("")}
  </ol>

  <h2 class="section-title">Advice from the paper for connector authors</h2>
  <ul class="tips">${T.tips.map(([t, d]) => `<li class="tip"><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join("")}</ul>

  <section class="other-opts" id="other-options" aria-labelledby="h-other" tabindex="-1">
    <h2 class="section-title" id="h-other">Other options</h2>
    <p class="hint">Not covered by the learning path above. Which standard suits your lab is a separate question: see <a href="#standards">Standards</a>.</p>
    <div class="opt-grid">${T.others.map(g => `
      <div class="card"><h3 class="card-title">${esc(g.title)}</h3><p class="hint">${esc(g.desc)}</p>
        <ul class="plain-links">${g.links.map(r => `<li>${extLink(r.url, r.title)}<span class="meta"> — ${esc(r.desc)}</span></li>`).join("")}</ul></div>`).join("")}
    </div>
  </section>
  <p class="hint disclosure">Several resources are maintained by UniteLabs, which develops open-source connector frameworks. One of the paper’s co-authors co-founded UniteLabs; see the competing-interests statement in the paper. Listing a resource is not an endorsement, and connectors can be built with any SiLA 2 implementation or another standard.</p>`;
}
H.routes.tutorials = { render: renderTutorials, title: "Tutorials" };
// "See other options" scrolls within the page; the router uses the hash for pages, so handle it here.
document.addEventListener("click", ev => {
  const a = ev.target.closest?.('a[href="#other-options"]'); if (!a) return;
  const t = document.getElementById("other-options"); if (!t) return;
  ev.preventDefault(); t.scrollIntoView({ behavior: H.smooth(), block: "start" }); t.focus({ preventScroll: true });
});

/* =====================================================================
   SUBMISSIONS
   ===================================================================== */
function renderSubmissions() {
  const P = PENDING, when = t => t ? new Date(t).toLocaleString() : "";
  const src = P.source === "loading" ? "Loading open issues…"
    : P.source === "live" ? `Live from GitHub (open issues, fetched ${when(P.at)}).`
    : P.source === "snapshot" ? `Snapshot built ${when(P.at)}${P.snapError ? ` (build note: ${esc(P.snapError)})` : ""}. The live GitHub API was not available${P.error ? `: ${esc(P.error)}` : ""}.`
    : `No submission data available${P.error ? ` (live API: ${esc(P.error)})` : ""}.`;
  const kindLabel = { device: "Instrument", orchestrator: "Orchestrator" };
  const row = p => {
    const target = p.kind === "orchestrator" && p.record ? (typeof p.record.lat === "number" ? `<a href="#orchestrators/pending-${p.number}?view=map">On the map</a>` : '<span class="meta">no coordinates</span>')
      : p.kind === "device" ? `<a href="#instruments?src=pend">In Instruments</a>` : "";
    const score = p.kind === "device" && p.evaluation ? (() => { const e = PENDING.evals.find(x => x.pending.number === p.number); const r = e && evaluate(e); return r ? `<span class="g ${tone(r.cls)}">${r.unrated ? "incomplete" : `${r.headline.p} / ${r.headline.m}`}</span>` : ""; })() : "";
    return `<tr><td class="num">${extLink(p.url, `#${p.number}`)}</td><td><span class="tag">${kindLabel[p.kind] || "Other"}</span></td>
      <td>${esc(p.title)}${p.errors?.length ? `<div class="meta">⚠ ${p.errors.map(esc).join("; ")}</div>` : ""}</td><td>${esc(p.author || "")}</td><td class="meta">${esc(String(p.created || "").slice(0, 10))}</td><td>${score}</td><td>${target}</td></tr>`;
  };
  view.innerHTML = `
  ${pageHead("Submissions", "Open contributions filed through the issue forms — from this site or directly on GitHub. They appear here, on the map and in Instruments as pending until a maintainer reviews them and adds them to the repository.", `<button class="btn" id="subs-refresh">Refresh</button>${REPO ? extLink(`https://github.com/${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3Asubmission`, "Open on GitHub", "btn") : ""}`)}
  <p class="meta" aria-live="polite">${src}</p>
  ${P.items.length ? `<div class="scroll" tabindex="0" role="region" aria-label="Open submissions"><table class="ctable subs"><thead><tr><th scope="col">Issue</th><th scope="col">Type</th><th scope="col">Title</th><th scope="col">By</th><th scope="col">Opened</th><th scope="col">Score</th><th scope="col"><span class="sr-only">Where</span></th></tr></thead><tbody>${P.items.map(row).join("")}</tbody></table></div>`
    : P.source === "loading" ? "" : `<div class="empty"><p>No open submissions.</p></div>`}
  <div class="grid2">
    <div class="card"><h2 class="card-title">Submit from this site</h2><p class="hint">Score an instrument and use <b>Submit to public registry</b> on the last step, or <a href="#orchestrators?add=1">propose an orchestrator</a>. Both open the GitHub issue form prefilled; you review and submit it on GitHub.</p></div>
    <div class="card"><h2 class="card-title">Submit on GitHub</h2><p class="hint">${REPO ? `Use the ${extLink(`https://github.com/${REPO}/issues/new?template=device-scorecard.yml`, "device evaluation")} or ${extLink(`https://github.com/${REPO}/issues/new?template=new-orchestrator.yml`, "orchestrator")} form directly.` : "No repository configured."} Issues from either path are labelled <code>submission</code> and read the same way here.</p></div>
  </div>`;
  $("#subs-refresh").onclick = async () => { PENDING.source = "loading"; renderSubmissions(); await loadSubmissions({ force: true }); renderSubmissions(); H.toast("Submissions refreshed."); };
}
H.routes.submissions = { render: renderSubmissions, title: "Submissions", onSubmissions: renderSubmissions };

/* =====================================================================
   API
   ===================================================================== */
function renderApi() {
  const base = SITE_BASE(), v = (window.SITE || {}).apiVersion || "v1", api = p => `${base}/api/${v}/${p}`;
  const eps = [
    ["index.json", "Catalogue of every endpoint, counts, URL interface and submission links."],
    ["tools.json", "All orchestrators with location, links, integration mechanism and standards."],
    ["tools/{id}.json", "One orchestrator, e.g. tools/chemos2.json."],
    ["criteria.json", "C1–C21: tier, default weight, what it checks, how to test, Pass / Partial / Fail rule."],
    ["rules.json", "Grade values, tiers, maxima, the sequential decision order and floors."],
    ["scorecards.json", "Public instrument scorecards (with group, tasks and interfaces) and totals computed by score.js."],
    ["scorecards/{id}.json", "One scorecard, e.g. scorecards/reader-x.json."],
    ["instrument-groups.json", "Instrument groups with suggested types and tasks, used to tag scorecards."],
    ["tutorials.json", "Learning path for building device connectors, and the paper’s advice for connector authors."],
    ["scenarios.json", "Deployment archetypes and recommended default standards."],
    ["standards.json", "Standards comparison: SiLA 2, OPC UA + LADS, REST, MCP."],
    ["schema/evaluation.schema.json", "JSON Schema of an evaluation — what score.js and Import accept."],
    ["schema/tool.schema.json", "JSON Schema of an orchestrator record."],
    ["openapi.json", "OpenAPI 3.1 description of all endpoints."]
  ];
  const code = s => `<pre class="code" tabindex="0"><code>${esc(s)}</code></pre>`;
  view.innerHTML = `
  ${pageHead("API &amp; machine-readable data", "Everything on this site is also published as static JSON, so scripts and AI agents can search, compare and evaluate without scraping pages. Read-only; no key required.", extLink(`${base}/llms.txt`, "llms.txt", "btn"))}
  <div class="api-layout">
    <div class="api-main">
      <section class="api-sec"><h2 class="section-title">Endpoints</h2>
        <p class="hint">Base URL <code>${esc(base)}/api/${v}/</code> · all <code>GET</code>, <code>application/json</code>. There is no server-side search: fetch a collection and filter it.</p>
        <div class="tablewrap"><table class="eptable"><thead><tr><th scope="col">Path</th><th scope="col">Returns</th></tr></thead><tbody>
          ${eps.map(([p, d]) => `<tr><td><a href="${esc(api(p.replace("{id}", p.startsWith("tools") ? "chemos2" : "reader-x")))}" target="_blank" rel="noopener"><code>${esc(p)}</code></a></td><td>${esc(d)}</td></tr>`).join("")}
          <tr><td><a href="${esc(base)}/score.js" target="_blank" rel="noopener"><code>/score.js</code></a></td><td>The scoring engine itself (Node and browser). Same code the site uses.</td></tr>
        </tbody></table></div>
      </section>
      <section class="api-sec"><h2 class="section-title">Search and compare</h2>
        <p class="hint">Find orchestrators that support SiLA 2 in Europe, then list eligible plate readers by total.</p>
        ${code(`const tools = (await fetch("${api("tools.json")}").then(r => r.json())).items;
const hits = tools.filter(t => t.standardsBase.includes("SiLA 2") && t.region === "Europe");

const cards = (await fetch("${api("scorecards.json")}").then(r => r.json())).items;
const readers = cards
  .filter(c => c.group === "measurement" && /plate reader/i.test(c.instrumentClass || ""))
  .filter(c => ["eligible", "conditionally_eligible"].includes(c.result.status))
  .sort((a, b) => b.result.standalone.points - a.result.standalone.points);`)}
      </section>
      <section class="api-sec"><h2 class="section-title">Evaluate an instrument</h2>
        <p class="hint">Write an evaluation that matches ${extLink(api("schema/evaluation.schema.json"), "evaluation.schema.json")} and score it with the same engine the site uses. Grades: <code>G</code> Pass, <code>P</code> Partial, <code>F</code> Fail, <code>NA</code> (${[...NA_OK].map(n => "C" + n).join(", ")} only).</p>
        ${code(`// Node 18+:  curl -O ${base}/score.js
const { evaluate } = require("./score.js");
const criteria = (await fetch("${api("criteria.json")}").then(r => r.json())).items
  .map(c => ({ n: c.n, w: c.weight, tier: { critical: "C", important: "I", cell_integration: "X" }[c.tier] }));

const result = evaluate({
  vendor: "Acme Reader", endpoint: "SiLA 2",
  cyber: Array(10).fill(true),                 // all precondition deliverables supplied
  grades: { 1: "G", 2: "G", 3: "G", 4: "G", 5: "P", /* … C6–C18 … */ },
  remed: { 5: "Expose metadata via API" }, remedDate: { 5: "2027-06-30" }
}, { criteria });
// → { status: "incomplete" | "eligible" | …, pts, max, reasons: [...] }`)}
        <p class="hint">The resulting JSON can be loaded with <b>Import JSON</b> on the Scorecard page, or submitted with the device-evaluation issue form.</p>
      </section>
      <section class="api-sec"><h2 class="section-title">In-browser interface</h2>
        <p class="hint">Agents that operate a browser on this site can call <code>window.SDL</code> directly instead of clicking through forms.</p>
        ${code(`SDL.tools({ standard: "SiLA 2", region: "Europe" })   // filtered orchestrators
SDL.criteria()                                         // C1–C21 with weights and rules
SDL.evaluate(evaluation)                               // same result object as score.js
SDL.scorecards()                                       // public registry + this browser's evaluations
SDL.importScorecard(evaluation)                        // adds it to the Scorecard page, returns its id`)}
      </section>
      <section class="api-sec"><h2 class="section-title">URL interface</h2>
        <p class="hint">Page state is in the URL, so links can be generated:</p>
        ${code(`${base}/#orchestrators/{toolId}
${base}/#orchestrators?view=table&std=SiLA 2,OPC UA&region=Europe&fam=formal&repo=1
${base}/#instruments?q=fluorescence&ifc=SiLA 2&elig=1&req=C7:P,C14:G
${base}/#instruments?view=compare&pick=pub:reader-x
${base}/#scorecard/C7
${base}/#score/new`)}
      </section>
    </div>
    <aside class="api-aside">
      <div class="card"><h2 class="card-title">Live check</h2><p class="hint">Fetches the published files from this site.</p><dl class="glossary" id="apilive"><dt>Loading…</dt></dl></div>
      <div class="card"><h2 class="card-title">For AI agents</h2><p class="hint">${extLink(`${base}/llms.txt`, "llms.txt")} summarises the data, the decision order and how to compare instruments in a few lines of Markdown.</p></div>
      <div class="card"><h2 class="card-title">Keep it in sync</h2><p class="hint">The JSON is generated from the same files the site reads. After editing data, run:</p>${code("node web/scripts/build-api.mjs")}</div>
    </aside>
  </div>`;
  Promise.all(["index.json", "tools.json", "scorecards.json"].map(p => fetch(api(p)).then(r => r.ok ? r.json() : Promise.reject(r.status)))).then(([idx, t, s]) => {
    const live = $("#apilive"); if (!live) return;
    live.innerHTML = `<dt>Generated</dt><dd>${esc(new Date(idx.generated).toLocaleString())}</dd><dt>Orchestrators</dt><dd>${t.count}</dd><dt>Public scorecards</dt><dd>${s.count} · ${s.items.map(i => `${esc(i.instrument)}: ${esc(i.result.status.replace(/_/g, " "))} ${i.result.standalone.points}/${i.result.standalone.max}`).join("; ")}</dd><dt>Endpoints</dt><dd>${idx.endpoints.length}</dd>`;
  }).catch(err => { const live = $("#apilive"); if (live) live.innerHTML = `<dt>Not reachable</dt><dd>Could not load the API files (${esc(String(err))}). Run <code>node web/scripts/build-api.mjs</code> and serve the folder over HTTP.</dd>`; });
}
H.routes.api = { render: renderApi, title: "API" };

/* =====================================================================
   ABOUT
   ===================================================================== */
function renderAbout() {
  const steps = [
    ["Orchestrators", "#orchestrators", `See who builds open-source lab orchestration software, where, and how each of the ${window.TOOLS.length} surveyed tools talks to instruments — on a map, as cards or as a table.`],
    ["Standards", "#standards", "Answer four questions about your lab and get a recommended default integration standard, with trade-offs."],
    ["Instruments", "#instruments", "Find instruments for a task by filtering on interface and the criteria that matter to you; compare a shortlist."],
    ["Scorecard", "#scorecard", "Browse the 21 criteria, then check an instrument’s control interface step by step before you buy it."],
    ["Tutorials", "#tutorials", "Build a device connector: a learning path for SiLA 2 in Python from the 2026 Device Integration Hackathon, plus other implementations and standards."]
  ];
  const terms = [
    ["Self-driving lab (SDL)", "A lab where software plans experiments, runs instruments and reads results in a closed loop, with little or no human input per run."],
    ["Orchestrator", "The software that composes instrument and robot operations into experiments and workflows — the conductor of the lab."],
    ["Device integration", "Everything beneath the orchestrator that lets software discover, control and monitor an instrument: transport, protocol, client and information-exchange layers."],
    ["Information-exchange layer", "Defines what messages carry: typed commands, properties, state, events and errors in a shared vocabulary. Where the paper locates the main gap."],
    ["Device-integration standard", "A shared, governed way to describe and control instruments. Examples: SiLA 2, OPC UA with the LADS companion specification."],
    ["Connector", "Software that exposes one instrument through a standard interface (for example a SiLA 2 server wrapping the vendor’s commands)."],
    ["MCP", "Model Context Protocol: a model-facing tool protocol. A peer interface at the information-exchange and client layers, not a layer above orchestration."],
    ["Endpoint", "The specific interface you connect to (e.g. the instrument’s SiLA 2 server). Score the one your orchestrator will actually use."],
    ["Criterion (C1–C21)", "One testable property of that interface, such as “errors are machine-readable” or “results can be fetched without the vendor GUI”."],
    ["Floor", "A minimum the instrument must meet. Missing a floor makes it ineligible, no matter how high its total score."],
    ["Weighted total", "Pass = 1, Partial = ½, Fail = 0, multiplied by each criterion’s weight. Used only to rank instruments that already cleared every floor."],
    ["Cell integration", "Extra criteria (C19–C21) for instruments that share a workcell with robots: loading, access/motion state and safety events."]
  ];
  view.innerHTML = `
  ${pageHead("About", "What this hub is for, how the scorecard decides, and what it does not cover.")}
  <div class="about">
    <div class="about-main">
      <section class="about-sec">
        <h2>The problem in one paragraph</h2>
        <p>Automated labs rarely stall because of the AI or the robots. They stall at the software that connects the orchestrator to each instrument. Most vendors expose their own command format, so every lab writes and maintains its own drivers, and those drivers do not carry over to other labs or other orchestration software. Shared, well-specified instrument interfaces turn that repeated effort into reusable infrastructure.</p>
      </section>
      <section class="about-sec">
        <h2>What you can do here</h2>
        <ol class="about-steps">${steps.map(([t, h, d]) => `<li><a href="${h}">${t}</a><span>${d}</span></li>`).join("")}</ol>
      </section>
      <section class="about-sec">
        <h2>How the scorecard reaches a verdict</h2>
        <p>The steps are applied in order. A later step can never override an earlier one.</p>
        <ol class="about-order">
          <li><b>Security precondition.</b> The vendor must supply basic network-security information. Without it the instrument cannot be deployed, so nothing else is scored.</li>
          <li><b>Critical criteria (C1–C5).</b> Can software control it, understand its data types and errors, fetch its results, and use the API without contractual restrictions? Any Fail rules the instrument out.</li>
          <li><b>Important criteria and local floors (C6–C18).</b> These raise or lower integration cost. A small number of Fails can be accepted if documented; hazardous or unattended setups add stricter floors.</li>
          <li><b>Cell integration (C19–C21).</b> Only for instruments in a robotic workcell.</li>
          <li><b>Weighted total.</b> Only now is a score computed, and only to rank instruments that passed the steps above.</li>
        </ol>
      </section>
      <section class="about-sec">
        <h2>What it does not tell you</h2>
        <ul class="about-list">
          <li>Whether the instrument is physically suited to automation (robot-reachable loading, standard form factors, 24/7 operation).</li>
          <li>Whether it is safe to run unattended. Interlocks, emergency stops and hazard response are system-level checks.</li>
          <li>Whether two instruments give scientifically equivalent results. A shared interface makes them easier to connect, not interchangeable.</li>
          <li>Orchestration-layer duties such as scheduling, global locks and labware state, or regulatory compliance (e.g. 21 CFR Part 11) of the controlling software.</li>
        </ul>
      </section>
      <section class="about-sec">
        <h2>Sources and caveats</h2>
        <ul class="about-list">
          <li>Orchestrator classifications rest on code and documentation review and will age within months. Grading text is condensed — confirm the full criterion definition before relying on a rule in a real purchase.</li>
          <li>Weights are proposed defaults, not validated constants. Adjust them on the Scorecard page.</li>
          <li>Institutions, locations, links and logos were looked up separately. Entries marked ⚠ have fields that could not be confirmed.</li>
          <li>Your scorecards and added tools stay in this browser only. Use Export to share them.</li>
        </ul>
      </section>
      <section class="about-sec">
        <h2>Accessibility</h2>
        <p>The site follows WCAG 2.2 AA practice: every page works with the keyboard alone (the map has a list of names as an alternative), grades are shown with text and symbols as well as colour, the colour theme follows your system or can be set in the header, and motion is reduced when your system asks for it. Please ${REPO ? extLink(`https://github.com/${REPO}/issues/new?title=${encodeURIComponent("[Accessibility] ")}`, "tell us") : "tell us"} about anything that gets in your way.</p>
      </section>
    </div>
    <aside class="about-aside card"><h2>Key terms</h2>
      <dl class="glossary">${terms.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl>
    </aside>
  </div>`;
}
H.routes.about = { render: renderAbout, title: "About" };
})(window.SDLHub);

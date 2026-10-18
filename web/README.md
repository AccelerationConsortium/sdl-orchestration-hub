# SDL Device Integration Toolkit

Static web tool (no build step, no framework) based on *"Talking to instruments: device-integration
standards for self-driving laboratories"* (Gottstein, Pablo-García et al., draft of 16 Sep 2026) and its
Supplementary Note S1 / Table S1.

## Source of truth

Criterion names, tiers, weights, effort, permitted grades (incl. which criteria allow N/A) and
the full criterion text come from the repository's `criteria/*.yml` and `meta.yml`; contributed
evaluations come from `devices/*.yml`. `build/build_web.py` exports them to `scorecard-data.js`
(generated, do not edit) and `sync.js` applies them on load, over the paper-derived defaults in
`data.js` / `grading.js`. The short "checks", test hints and Pass/Partial/Fail paraphrases in
those files remain the site's condensed wording; each criterion card links the full YAML text.

After changing criteria or device files, from the repository root:

```bash
uv run python build/build_web.py      # refresh web/scorecard-data.js
node web/scripts/build-api.mjs        # refresh web/api/v1/ and web/llms.txt
```

CI fails if `scorecard-data.js` is stale or if Reader X stops reproducing Table S1.

Run (from the repository root):

```bash
python3 -m http.server 4377 --directory web
```

then open http://localhost:4377. (Opening `index.html` directly also works; the map needs internet
access for the Leaflet library and CARTO/OpenStreetMap tiles.)

## Tabs

| Tab | What it is | Source in the paper |
|---|---|---|
| **Map** | Scrollable, searchable list of orchestrators (filter by family, arrow keys to step through) beside a world map; selecting either shows logo, links, integration mechanism and your scorecards for it. "+ Add a tool" stores new entries locally. | Table 2 + external lookup |
| **Orchestrators** | Explorer in the DIY Biofabrication Atlas style: filter rail (search, family, standard, region, licence, "More filters" toggles), live count, Clear filters, Cards/Table view; filters are kept in the URL (e.g. `#orchestrators?std=SiLA%202&region=Europe`). | Table 2 |
| **Scenarios & standards** | Picks one of five deployment archetypes and shows the standards comparison. | Tables 4, 5 |
| **Scorecard** | Cybersecurity precondition → 21 criteria → floors → weighted total; remediation commitments with dates, gap acceptance, external mitigations, C6/C17 annotations, C21 fallback cap, tunable weights, RFP evidence pack. | Tables 6, 7; Fig. 5; Note S1 |
| **Compare** | Side-by-side grades, CSV export. | — |
| **Team** | Paper authors and affiliations; **Contribute** forms that open prefilled GitHub issues (new orchestrator, new scorecard, correction). | Title page |
| **API** | Endpoint list, code samples for search / compare / evaluate, `window.SDL` browser interface, URL interface, live check. | — |
| **About** | Plain-language overview, verdict logic, glossary, limitations. | "What this scorecard does not cover" |

Built-in check: loading the *Reader X* example reproduces Table S1 — 36/46 standalone, 39/52 cell-integrated.

## Machine-readable API

Static JSON in `api/v1/`, generated from the same data files the site reads:

```bash
node scripts/build-api.mjs
```

Re-run it after `build/build_web.py`, or after editing `data.js`, `grading.js` or `scorecards.js`. The build fails if Reader X no longer reproduces Table S1 (36/46, 39/52).

| Endpoint | Contents |
|---|---|
| `api/v1/index.json` | Catalogue of endpoints, counts, URL interface, submission links |
| `api/v1/tools.json`, `tools/{id}.json` | Orchestrators |
| `api/v1/criteria.json` | C1–C21 with weights, tests and grading rules |
| `api/v1/rules.json` | Decision order, floors, grade values, maxima |
| `api/v1/scorecards.json`, `scorecards/{id}.json` | Public scorecards with computed results |
| `api/v1/scenarios.json`, `standards.json` | Tables 5 and 4 |
| `api/v1/schema/*.schema.json` | JSON Schemas (evaluation, tool) |
| `api/v1/openapi.json` | OpenAPI 3.1 |
| `llms.txt` | Short guide for AI agents |
| `score.js` | The scoring engine (UMD: Node `require`, browser `window.SDLScore`) |

Set `siteUrl` in `config.js` to the public URL before building if the site is served from a sub-path (e.g. GitHub Pages `https://<org>.github.io/<repo>`); otherwise links in the JSON are root-relative.

## Submissions

Contributions arrive as GitHub issues from two forms in `.github/ISSUE_TEMPLATE/`:
`new-orchestrator.yml` (labels `submission`, `orchestrator`) and `device-scorecard.yml` (labels
`submission`, `device`). Contributors can open them from the site (prefilled) or directly on GitHub;
GitHub renders both the same way, so `issues.js` parses either into a pending entry. The field labels
it looks for are exported from the templates by `build/build_web.py`, so editing a form label does
not break parsing.

Open submission issues show up as **pending**: in the **Submissions** tab, as faded markers on the
map (orchestrators with coordinates) and as a separate group in Compare (scorecards). The site reads
them live from the GitHub API (cached for 10 minutes per tab; anonymous requests are limited to 60 an
hour per visitor) and falls back to `api/v1/submissions.json`, a snapshot the Pages workflow writes on
every push, on every issue change and every six hours. While the repository is private, only the
snapshot works, because the live API needs a token. Closing an issue removes it from the pending set;
merging the corresponding `orchestrators/*.yml` or `devices/*.yml` makes it a regular entry.

```bash
GITHUB_TOKEN=$(gh auth token) node web/scripts/fetch-submissions.mjs   # refresh the snapshot locally
node web/scripts/test-issues.mjs                                       # parser tests (also run in CI)
```

`config.js → repo` names the GitHub repository. The site opens prefilled issues using the forms in `.github/ISSUE_TEMPLATE/` (`new-orchestrator.yml` for orchestrators, the repository's `device-scorecard.yml` for evaluations). Accepted orchestrators go into `orchestrators/<id>.yml`; accepted evaluations go into `devices/<vendor>-<model>.yml` (see the repository README) so they are scored by `build/score_device.py` as well; `scorecards.js` only keeps the Reader X worked example with its remediation dates.

## Files

| File | Contents |
|---|---|
| `tools.js` | **Generated** orchestrator registry, from `orchestrators/*.yml` (see below). |
| `scorecards.js` | Public scorecard registry (seeded with Reader X). |
| `team.js` | Authors and affiliations from the manuscript. |
| `score.js` | Shared scoring engine (site, API build, agents). |
| `config.js` | Submission repository, public URL, API version. |
| `scripts/build-api.mjs` | Generates `api/v1/` and `llms.txt`. |
| `data.js` | Standards comparison, scenarios, cybersecurity deliverables, criteria (Table 7), RFP evidence list. |
| `grading.js` | Pass / Partial / Fail rules per criterion (paraphrased from Note S1) and the Reader X example. |
| `scorecard-data.js` | **Generated** by `build/build_web.py` from `criteria/*.yml`, `meta.yml`, `devices/*.yml`. |
| `issues.js` | Parses submission issues (either form, either path) into pending orchestrators and evaluations. |
| `scripts/fetch-submissions.mjs` | Writes the `api/v1/submissions.json` snapshot. |
| `scripts/test-issues.mjs` | Parser tests. |
| `sync.js` | Applies `scorecard-data.js` over the defaults and adds device evaluations to the public scorecards. |
| `app.js`, `styles.css`, `index.html` | The app. |

Evaluations, weight overrides and locally added tools are kept in the browser's `localStorage`
(key `sdl-scorecard-v2`). Use *Export JSON* / *Import* on the Scorecard tab to move them between machines.

## Adding a tool

Orchestrators live in the repository's `orchestrators/<id>.yml`, one file per tool, validated
against `schema/orchestrator.schema.json`. `web/tools.js` is **generated** from them by
`build/build_web.py`; do not edit it. To add a tool, create `orchestrators/<id>.yml` (or use
**+ Add a tool** on the Map tab and submit the issue form), then run `uv run python build/build_web.py`.

```yaml
id: mytool                        # required, unique, URL-safe; must match the file name
name: MyLabOS                     # required
ref: "52"                         # reference number in the paper, if any
paper: https://doi.org/…          # paper or preprint
org: Group, Institution           # required
city: City, Region
country: Country
lat: 43.66                        # required — marker position
lng: -79.39
website: ""                       # links (any may be "")
repo: ""
docs: ""
logo: https://github.com/<org>.png?size=96   # any image URL; GitHub org avatars work well
family: bespoke                   # required: formal | hal | agentic | bespoke
enforced: false                   # formal only: standard required for every driver (ChemOS 2.0)
optional: false                   # formal only: standard is an optional path (EOS, MADSci, HELAO)
mech: Primary integration mechanism (Table 2 column 2)
standards: [SiLA 2 (optional)]    # Table 2 column 3; [] if none
notes: Table 2 notes
license: MIT
verified: true                    # required; false → the UI shows a ⚠ with `unverified`
unverified: which fields are uncertain
```

Projects the paper excludes are listed in `orchestrators/_excluded.yml`. The Orchestrators tab, the
map, the scorecard's orchestrator autocomplete and the per-tool score panel all read from this data.

## Provenance of locations and links

Table 2 gives mechanism, standards, notes and licence but no institution or URL. Those were looked up
from the cited papers and public repositories (Oct 2026). Three entries are flagged in the UI:

- **Chemios** — institution inferred from the lead contributor; not stated by the project.
- **MINERVA-OS** — no public repository found; the ACS Nano paper says the components are published with it.
- **OChRA** — the project publishes no affiliation; placed at the host of its 2025 AIchemy workshop.

## Caveats

- Weights are the paper's "proposed expert defaults", explicitly not validated constants; the Weights
  panel lets you tune them and shows the paper value alongside.
- Grading text is paraphrased from Note S1; read the criterion card in the supplement before relying on
  a rule in a real RFP.
- The paper scores instruments, not orchestrators. The "score" shown for an orchestrator is an aggregate
  of *your* saved instrument scorecards that name it as the target.

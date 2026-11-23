# SDL Orchestration Hub

An open resource for choosing and connecting the software and instruments of a **self-driving
laboratory (SDL)**. It covers **workflow orchestration**, the software that composes instrument and
robot operations into experiments, and beneath it **device integration**, the way that software
talks to each instrument.

Use it to:

- **find orchestration software** that suits your lab,
- **choose a device-integration standard** for your setting,
- **find and evaluate instruments** whose control interface is ready for autonomous use, and
- **build a connector** for an instrument that does not have one yet.

**Website:** <https://accelerationconsortium.github.io/sdl-orchestration-hub/>, published from this
repository. To run it on your own computer, see [Run the website locally](#run-the-website-locally).

The hub is the companion to the paper
[*Talking to instruments: device-integration standards for self-driving laboratories*](https://doi.org/10.26434/chemrxiv.15009990/v2)
(ChemRxiv preprint, 2026). The paper and its supplement are a frozen snapshot; this repository is
the living version, where the scorecard criteria and the orchestrator data are maintained.

## The big picture

Self-driving labs are growing from single-instrument prototypes into multi-instrument, multi-site
platforms. Whether they scale is now decided less by algorithms or robots than by the software layer
that orchestrates many different devices.

The paper describes device integration as a five-layer model. The hub concentrates on the top
three layers:

| Layer | What it does | Examples | In the hub |
|---|---|---|---|
| 5 · Orchestration | Composes device operations into experiments and workflows: scheduling, labware state, recovery, audit | ChemOS 2.0, Bluesky, MADSci, AlabOS … | Orchestrator survey |
| 4 · Information exchange | Defines what messages carry: typed commands, properties, state, events and errors | SiLA 2, OPC UA + LADS, REST + OpenAPI, MCP tool contracts | Standards guidance and the scorecard |
| 3 · Consumer / client | Turns workflow intent into concrete device calls | SiLA / OPC UA clients, vendor SDKs, PyLabRobot backends, connectors | Tutorials |
| 2 · Communication protocol | Message framing, addressing and request/response semantics | gRPC, HTTP, Modbus, OPC UA binary | Precondition |
| 1 · Transport | Moves bytes between two endpoints | USB, RS-232/485, Ethernet, TCP/IP | Precondition |

## What you can do with it

### Find orchestration software

A survey of **17 open-source orchestrators** used in self-driving labs. For each one you see who
develops it and where, how it connects to instruments, which device-integration standards it
supports, its licence, and links to its code, documentation and paper where available. The
orchestrators fall into
four families by how they talk to instruments: a formal standard, a hardware-abstraction layer, a
model-facing interface (MCP), or bespoke conventions. Filter by family, standard, region or licence,
and browse them as cards, on a map or in a comparison table.

### Choose an integration standard

Answer four questions about your lab and get one of five typical deployment settings, each with the
paper's recommended starting point and its trade-offs:

- frugal or single-group academic SDL
- multi-instrument shared academic SDL
- regulated industrial or pharma lab
- robotics-heavy SDL
- multi-site or cross-institutional SDL

A side-by-side comparison of SiLA 2, OPC UA + LADS, typical vendor REST APIs and MCP shows how they
differ in discoverability, semantics, typing, introspection and composability.

### Find suitable instruments

The instrument finder lists instruments that have been scored. Filter by the task you need to do
(for example fluorescence), the kind of instrument, the interface it offers, whether it has to work
inside a robotic workcell, and the minimum grade you require on the criteria that matter to you.
Compare a shortlist side by side.

### Evaluate an instrument before you buy it

The **Device Integration Scorecard** checks whether an instrument's control interface is ready for
autonomous, orchestrated use. It has **21 criteria (C1–C21)** in three tiers:

- **Critical:** can the instrument be controlled programmatically and contractually at all?
- **Important:** does the interface support robust autonomous operation? Gaps here raise
  integration and operating cost but can be overcome.
- **Cell integration:** can the instrument take part in a robotic workcell? Scored only for
  cell-integrated deployments.

Each criterion is graded **Pass, Partial or Fail**, and a few can also be **N/A**. A cybersecurity
and IT baseline is a deployment precondition: it is not scored, but missing it blocks procurement.
**Floors decide eligibility:** any Critical Fail, more than one Critical Partial, or more than four
weighted points of failed Important criteria disqualify the instrument, whatever its total. For
cell-integrated use, automated load and unload (C19) must also reach at least Partial wherever a
machine loads the instrument. The weighted total, out of 46 for a standalone instrument and 52 for
a cell-integrated one, only ranks instruments that clear the floors.

You can score an instrument step by step in the website's wizard, or offline with
[`scorecard.md`](scorecard.md), the fillable [`scorecard-template.xlsx`](scorecard-template.xlsx)
or [`scorecard-template.csv`](scorecard-template.csv). The full rules are in
[`scorecard.md`](scorecard.md).

### Learn to build a device connector

A learning path for building a SiLA 2 connector in Python, based on the 2026 Device Integration
Hackathon, with pointers to other SiLA 2 implementations, OPC UA LADS and other approaches, and
the paper's advice for connector authors.

### Use the data in your own tools

The website's data (orchestrators, standards, deployment settings, criteria, scorecards and
tutorials) is also available as static JSON (`api/v1/` on the site) and as an `llms.txt` guide,
for scripts and AI agents. See [`web/README.md`](web/README.md).

## Contributing

You do not need Git for most contributions.

- **Add an orchestrator.** Use **Propose a tool** on the website's Orchestrators page, or open a
  [new orchestrator issue](../../issues/new?template=new-orchestrator.yml). The paper's inclusion
  criteria apply: an open-source licence with public source, a device-integration layer that
  commands physical instruments, and use in at least one self-driving-lab deployment. To correct an
  existing entry, open an issue.
- **Share an instrument evaluation.** Score the instrument in the website's wizard and choose
  **Submit to public registry**, or open a
  [device evaluation issue](../../issues/new?template=device-scorecard.yml). Open submissions
  appear on the website as *pending* until a maintainer reviews and merges them.
  Evaluations are contributor assessments, not endorsements; vendors have a right of reply.
- **Propose a change to the criteria.** Open an issue describing the change, or a pull request
  following the steps in [For developers and maintainers](#for-developers-and-maintainers).

## How to cite

If you use the hub or the scorecard, please cite the paper:

> Gottstein, W., Bromig, L., et al., Pablo-García, S. *Talking to instruments: device-integration
> standards for self-driving laboratories.* ChemRxiv (2026).
> [doi:10.26434/chemrxiv.15009990/v2](https://doi.org/10.26434/chemrxiv.15009990/v2)

```bibtex
@article{gottstein_talking_2026,
  title   = {Talking to instruments: device-integration standards for self-driving laboratories},
  author  = {Gottstein, Willi and Bromig, Lukas and others and Pablo-Garc{\'i}a, Sergio},
  journal = {ChemRxiv},
  year    = {2026},
  doi     = {10.26434/chemrxiv.15009990/v2},
  url     = {https://doi.org/10.26434/chemrxiv.15009990/v2}
}
```

---

## For developers and maintainers

The rest of this file covers how the repository is organised and how changes are checked.

### Repository layout

Each kind of content has **one source of truth**; everything else is generated from it. Editing a
generated file by hand is overwritten on the next build, and CI fails.

```
criteria/C1.yml … C21.yml     # SOURCE: one file per criterion
meta.yml                      # SOURCE: tiers, totals/maxima, pass floors
devices/*.yml                 # SOURCE: contributed instrument evaluations (devices/_template.yml to start)
orchestrators/*.yml           # SOURCE: orchestrator registry (orchestrators/_excluded.yml: projects the paper excludes)
schema/                       # JSON schemas for criteria, devices and orchestrators

build/validate.py             # schema-validates every criterion file
build/generate.py             # criteria + meta.yml  ->  scorecard.md, scorecard-template.csv/.xlsx
build/score_device.py         # devices/*.yml       ->  devices/<slug>.md, devices/README.md
build/build_web.py            # criteria, meta.yml, devices  ->  web/scorecard-data.js
                              # orchestrators/*.yml          ->  web/tools.js
build/check_changelog.py      # CI helper: require a CHANGELOG entry when criteria change

scorecard.md                  # GENERATED
scorecard-template.csv/.xlsx  # GENERATED
devices/*.md                  # GENERATED (per-device cards and index)
web/scorecard-data.js         # GENERATED
web/tools.js                  # GENERATED
web/api/v1/, web/llms.txt     # GENERATED by web/scripts/build-api.mjs

web/                          # the website (static, no build step; see web/README.md)
CHANGELOG.md                  # human-maintained history of the criteria set
.github/ISSUE_TEMPLATE/       # issue forms for orchestrators and device evaluations
.github/workflows/ci.yml      # checks on pull requests and pushes to main
.github/workflows/pages.yml   # publishes web/ to GitHub Pages
```

### Setup

This project uses [uv](https://docs.astral.sh/uv/); no manual pip installs:

```bash
uv sync      # creates .venv from pyproject.toml + uv.lock (pyyaml, jsonschema, openpyxl)
```

Run commands with `uv run` (for example `uv run python build/generate.py`), or activate the
environment once with `source .venv/bin/activate` and run them directly. The website's API build
and tests also need [Node.js](https://nodejs.org/).

### Run the website locally

```bash
python3 -m http.server 4377 --directory web
```

Then open http://localhost:4377. The map needs internet access for its library and map tiles.
Page-by-page documentation, the API and the file structure of the site are in
[`web/README.md`](web/README.md).

### Editing an existing criterion

1. Edit the relevant `criteria/CXX.yml` (fix wording, tighten a requirement, adjust grading …).
2. Add a line under **`## Unreleased`** in `CHANGELOG.md` describing the change.
3. Regenerate and self-check:
   ```bash
   uv run python build/validate.py               # schema
   uv run python build/generate.py               # rewrites scorecard.md + templates
   uv run python build/generate.py --check       # confirms nothing is stale
   uv run python build/generate.py --invariants
   uv run python build/build_web.py              # refreshes web/scorecard-data.js
   ```
4. Commit **both** the edited `criteria/CXX.yml` **and** the regenerated `scorecard.md` /
   `scorecard-template.*` / `web/scorecard-data.js`, and open a pull request.

### Adding a new criterion

1. Create `criteria/C22.yml` (next free number) following the schema. Template:
   ```yaml
   id: C22
   name: Short criterion name
   tier: Important            # Critical | Important | Cell-integration
   weight: 2                  # integer
   effort: S                  # S (<=2h) | M (<=1 day) | L (multi-day); spans like S/M allowed
   summary: null              # optional one-line "what it checks"
   applicability: null        # optional; prose describing when it applies / is N/A
   requirement: |
     One or more sentences. Use the words MUST / MUST NOT / SHOULD / MAY explicitly —
     the generator turns MUST/SHOULD clauses into checkboxes automatically.
   grade_options: [Pass, Partial, Fail]   # add N/A if the criterion can be N/A
   grading: |
     Pass requires … Partial covers … Fail covers …
   test: |
     How an evaluator verifies it.
   rationale: |
     Why a buyer should care.
   ```
2. **If the new criterion changes the totals**, update `meta.yml`: add its weight to the relevant
   `totals.*.max` and, if it introduces a new tier or floor, update `tiers` / `floors`.
   CI checks that the criterion weights add up to the declared maxima, so a mismatch fails the build.
3. Add a **`## Unreleased`** entry in `CHANGELOG.md` (a new criterion is at least a *minor* bump).
4. Regenerate and self-check (same commands as above), commit the new source file, the updated
   `meta.yml` and the regenerated outputs, and open a pull request.

Removing or renumbering a criterion works the same way: change the source, update the `meta.yml`
maxima, regenerate. Ids must stay contiguous `C1..Cn` (CI checks this).

### Adding a device evaluation by pull request

Evaluations submitted through the issue form are converted by a maintainer. To add one directly:

1. Copy `devices/_template.yml` to `devices/<vendor>-<model>.yml` (lowercase, hyphenated). Fill in
   the optional `group`, `tasks` and `interfaces` fields too: the instrument finder filters on them.
2. Grade each criterion **Pass / Partial / Fail** (or **N/A** where the criterion's
   `grade_options` allow it). Add a short `note` and an `evidence` link wherever you can.
3. Record who you are (`evaluator`, may be a pseudonym), the `date`, the `scorecard_version`
   you scored against, the `deployment` (standalone or cell-integrated) and the `evidence_basis`.
4. Regenerate and self-check:
   ```bash
   uv run python build/score_device.py            # writes devices/<slug>.md + devices/README.md
   uv run python build/score_device.py --check    # confirms nothing is stale
   uv run python build/build_web.py               # adds the device to the website
   ```
5. Commit **both** your `devices/<vendor>-<model>.yml` and the regenerated `devices/*.md` /
   `web/scorecard-data.js`, and open a pull request. CI validates the file (schema, and every
   criterion graded with a permitted grade) and recomputes the totals and floors.

You assign the grades; the tooling computes the weighted totals and floor checks. A
`verified: true` mark is set only by a maintainer who independently confirmed the evaluation, and
the optional `vendor_response` field gives vendors a right of reply. Each evaluation is pinned to
the `scorecard_version` it was scored against, since criteria evolve. Device evaluations do not
need a `CHANGELOG.md` entry; the changelog tracks the criteria set, not contributed data.

### Adding or updating an orchestrator by pull request

Create or edit `orchestrators/<id>.yml` (one file per tool, validated against
`schema/orchestrator.schema.json`), then run `uv run python build/build_web.py` to refresh
`web/tools.js`. The fields are described in [`web/README.md`](web/README.md#adding-a-tool).

### Submissions on the website

Open issues from either form carry the `submission` label. The website shows them on its
**Submissions** page, on the map and in the instrument finder as *pending* until they are merged
and the issue is closed. The Pages workflow also refreshes a snapshot of open submissions when an
issue changes and every 6 hours.

### What CI checks

Every pull request and every push to `main` runs `.github/workflows/ci.yml`:

- **Schema:** every `criteria/*.yml` validates against `schema/criterion.schema.json`, and its `id`
  matches its file name.
- **Invariants:** criterion weights add up to the declared standalone and cell-integrated maxima,
  and ids are contiguous.
- **No stale outputs:** `scorecard.md` and `scorecard-template.csv` match what the generator
  produces from the current source (`generate.py --check`).
- **Device evaluations:** every `devices/*.yml` validates and its generated card is up to date
  (`score_device.py --check`).
- **Website in sync:** `web/scorecard-data.js` and `web/tools.js` match the criteria, device and
  orchestrator files, every `orchestrators/*.yml` validates (`build_web.py --check`), and the API
  build reproduces the paper's Reader X example totals.
- **Issue parser:** `web/scripts/test-issues.mjs` checks that issues from both submission forms
  parse into pending entries.
- **Changelog:** on pull requests, if any criterion or `meta.yml` changed, `CHANGELOG.md` must have
  an entry.

### Publishing the website

Pushes to `main` publish `web/` to GitHub Pages through `.github/workflows/pages.yml`. Pages must be
enabled once in the repository settings, with **GitHub Actions** as the source.

### Versioning and releases

Versions describe the **criteria set** (see `CHANGELOG.md` for the bump rules). To cut a release,
move the `## Unreleased` entries under a new version heading, tag it, and optionally archive the
tag to Zenodo for a citable DOI.

## License

Content (criteria, scoring model, generated checklists): **CC BY 4.0**. Code under `build/`:
**MIT**. See [`LICENSE`](LICENSE).

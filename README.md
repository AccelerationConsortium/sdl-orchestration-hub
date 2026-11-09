# Device Integration Scorecard

A procurement checklist for evaluating whether a laboratory instrument's **control interface**
is ready for autonomous (self-driving-lab) integration. It turns the criteria from the
accompanying paper into a usable, fillable tool: 21 criteria (C1–C21), each graded
**Fail / Partial / Pass** (some also **N/A**), weighted, and gated by three pass floors.

> This is the **living** version of the scorecard. The paper's supplement is a frozen snapshot;
> this repository is where the criteria evolve. *(Add paper/DOI link here.)*

## Using the scorecard

Pick whichever fits your workflow:

- **[`scorecard.md`](scorecard.md)** — the full checklist. Each criterion lists its requirements
  as **MUST / SHOULD / MAY** bullets with checkboxes, followed by a **Grade** block
  (Fail / Partial / Pass / N/A) and the grading rubric. Copy it per vendor and tick the boxes.
- **[`scorecard-template.xlsx`](scorecard-template.xlsx)** — a fillable sheet: choose a grade
  from a dropdown and it computes the weighted **standalone** (C1–C18) and **cell-integrated**
  (C1–C21) totals and flags whether each floor is met.
- **[`scorecard-template.csv`](scorecard-template.csv)** — a plain-text equivalent.

**How scoring works.** Grade × weight is summed. But the number is only a *ranking* figure
among vendors that already clear the floors — **eligibility is decided by the floors**
(Critical, Important, cell-integration), not by the total. See `scorecard.md` for the exact
floor rules.

- **[`web/`](web/)** — the **SDL Orchestration Hub** website: a landing page on workflow orchestration
  and device integration, an orchestrator explorer (map, cards, table), deployment scenarios and
  standards, an instrument finder with side-by-side comparison, the browsable criteria with a
  step-by-step scoring wizard, tutorials for building device connectors, and a static JSON API.
  Run it with `python3 -m http.server 4377 --directory web` and open http://localhost:4377.
  See [`web/README.md`](web/README.md). Pushes to `main` publish it to GitHub Pages
  (`.github/workflows/pages.yml`; enable Pages with source "GitHub Actions" in the repository settings).

## How it's built (why you don't edit the checklist directly)

There is **one source of truth** and everything else is generated from it:

```
criteria/C01.yml … C20.yml   # SOURCE OF TRUTH: one file per criterion
meta.yml                     # SOURCE OF TRUTH: tiers, totals/maxima, pass floors
schema/criterion.schema.json # the contract each criterion file must satisfy
build/generate.py            # criteria/*.yml + meta.yml  ->  the files below
build/validate.py            # schema-validates every criterion file
build/check_changelog.py     # CI helper: require a CHANGELOG entry on criteria changes
scorecard.md                 # GENERATED — do not edit by hand
scorecard-template.csv       # GENERATED — do not edit by hand
scorecard-template.xlsx      # GENERATED — do not edit by hand
orchestrators/*.yml          # orchestrator registry shown on the web tool's map (schema/orchestrator.schema.json)
build/build_web.py           # criteria/*.yml + meta.yml + devices/*.yml  ->  web/scorecard-data.js
                             # orchestrators/*.yml                        ->  web/tools.js
web/scorecard-data.js        # GENERATED — do not edit by hand
web/tools.js                 # GENERATED — do not edit by hand
web/                         # interactive web tool (static; see web/README.md)
CHANGELOG.md                 # human-maintained history
.github/workflows/ci.yml     # CI: validate + invariants + regenerate-check + changelog
```

Editing `scorecard.md` (or the templates) directly will be **overwritten** and CI will fail.
Edit the `criteria/*.yml` source and regenerate.

## Contributing

All changes go through a pull request. CI checks every PR (see below), so if the checks pass,
the change is consistent by construction.

### One-time setup

This project uses [uv](https://docs.astral.sh/uv/). No manual pip installs:

```bash
uv sync      # creates .venv from pyproject.toml + uv.lock (pyyaml, jsonschema, openpyxl)
```

Run commands with `uv run` (e.g. `uv run python build/generate.py`), or activate the
environment once with `source .venv/bin/activate` and run them directly.

### Editing an existing criterion

1. Edit the relevant `criteria/CXX.yml` (fix wording, tighten a requirement, adjust grading …).
2. Add a line under **`## Unreleased`** in `CHANGELOG.md` describing the change.
3. Regenerate and self-check:
   ```bash
   uv run python build/validate.py            # schema
   uv run python build/generate.py            # rewrites scorecard.md + templates
   uv run python build/generate.py --check    # confirms nothing is stale
   uv run python build/generate.py --invariants
   uv run python build/build_web.py            # refreshes web/scorecard-data.js
   ```
4. Commit **both** the edited `criteria/CXX.yml` **and** the regenerated `scorecard.md` /
   `scorecard-template.*` / `web/scorecard-data.js`, and open a PR.

### Adding a new criterion (a novel `Cxy`)

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
   CI enforces that the sum of criterion weights equals the declared maxima, so this step is
   not optional — a mismatch fails the build.
3. Add a **`## Unreleased`** entry in `CHANGELOG.md` (a new criterion is at least a *minor* bump).
4. Regenerate and self-check (same commands as above), commit the new source file, the updated
   `meta.yml`, and the regenerated outputs, and open a PR.

Removing or renumbering a criterion works the same way: change the source, update `meta.yml`
maxima, regenerate. Ids must stay contiguous `C1..Cn` (an invariant CI checks).

### Contributing a device evaluation

Beyond the criteria themselves, you can contribute a filled-in scorecard for an instrument you
have evaluated. These live under `devices/` and are separate from the criteria source of truth.
You assign grades; the tooling computes the weighted totals and floor checks, so the numbers are
correct by construction.

```
devices/_template.yml     # copy this to start
devices/<vendor>-<model>.yml   # your evaluation (source)
devices/<slug>.md         # GENERATED per-device card — do not edit
devices/README.md         # GENERATED index of all contributed devices — do not edit
```

1. Copy `devices/_template.yml` to `devices/<vendor>-<model>.yml` (lowercase, hyphenated). Fill in the
   optional `group`, `tasks` and `interfaces` fields too: the website's instrument finder filters on them.
2. Grade each criterion **Pass / Partial / Fail** (or **N/A** where the criterion's
   `grade_options` allow it). Add a short `note` and an `evidence` link wherever you can.
3. Record who you are (`evaluator`, may be a pseudonym), the `date`, the `scorecard_version`
   you scored against, the `deployment` (standalone or cell-integrated), and the `evidence_basis`.
4. Regenerate and self-check:
   ```bash
   uv run python build/score_device.py            # writes devices/<slug>.md + devices/README.md
   uv run python build/score_device.py --check     # confirms nothing is stale
   uv run python build/build_web.py                # adds the device to the web tool
   ```
5. Commit **both** your `devices/<vendor>-<model>.yml` and the regenerated `devices/*.md` /
   `web/scorecard-data.js`, and
   open a PR. CI validates the file (schema + every criterion graded with a permitted grade) and
   recomputes the totals and floors.

No Git? Open a **[device evaluation issue](../../issues/new?template=device-scorecard.yml)** (or use
**Submit to public registry** in the web tool, which opens the same form prefilled) and a maintainer
will convert it into a `devices/*.yml` file. Open submission issues, labelled `submission`, appear in
the website's **Submissions** page, on the map and in the instrument finder as *pending* until they are merged and
the issue is closed.

Notes: evaluations are **contributor assessments, not endorsements**; a `verified: true` mark is
set only by a maintainer who independently confirmed the evaluation, and the optional
`vendor_response` field gives vendors a right of reply. Each evaluation is pinned to the
`scorecard_version` it was scored against, since criteria evolve over time. Device evaluations do
not require a `CHANGELOG.md` entry (the changelog tracks the criteria set, not contributed data).

### What CI enforces on every PR

- **Schema** — every `criteria/*.yml` validates against `schema/criterion.schema.json`
  (and its `id` matches its filename).
- **Invariants** — criterion weights sum to the declared standalone/cell-integrated maxima,
  and ids are contiguous.
- **No stale outputs** — `scorecard.md` and `scorecard-template.csv` match what the generator
  produces from the current source (`generate.py --check`).
- **Issue parser** — `web/scripts/test-issues.mjs` checks that issues from both submission forms
  (prefilled by the web tool or filed directly on GitHub) parse into pending entries.
- **Web tool in sync** — `web/scorecard-data.js` and `web/tools.js` match the criteria, device and
  orchestrator files, every `orchestrators/*.yml` validates (`build_web.py --check`), and the web
  API build reproduces the paper's Reader X totals.
- **Changelog** — if any criterion or `meta.yml` changed, `CHANGELOG.md` must have an entry.

## Versioning and releases

Versions describe the **criteria set** (see `CHANGELOG.md` for the bump rules). To cut a release,
move the `## Unreleased` entries under a new version heading, tag it, and (optionally) archive the
tag to Zenodo for a citable DOI.

## License

Content (criteria, scoring model, generated checklists): **CC BY 4.0**. Code under `build/`:
**MIT**. See [`LICENSE`](LICENSE). If you use the scorecard, please cite the accompanying paper.

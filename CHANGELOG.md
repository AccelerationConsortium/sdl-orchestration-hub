# Changelog

All notable changes to the scorecard criteria and scoring model are recorded here.
Each pull request that changes a `criteria/*.yml` file or `meta.yml` must add a line
under **Unreleased**. On release, the Unreleased entries are moved under a version heading.

The version reflects the *criteria set*, not the tooling: bump the **major** version for a
change that alters what a Pass/Partial/Fail means or changes weights/floors/totals; **minor**
for a new criterion or a materially strengthened requirement; **patch** for clarifications and
wording.

## Unreleased

Synchronized the criteria set with the preprint's Supplementary Note S1 (criterion cards),
main-text Table 7 and Supplementary Table S1. This alters what Pass/Partial/Fail means for
several criteria, so it warrants a **major** bump on release.

- All criteria (C1–C21): requirement, test, grading and rationale text updated to the preprint
  wording. Largest rewrites: C2 (test), C3 (requirement, grading), C7 (requirement, grading),
  C8 (grading, test), C10 (requirement), C15 (grading), C18 (grading), C19 and C20 (requirement,
  grading, rationale), C21 (applicability, requirement, rationale).
- All criteria: `summary` populated with the one-line "What it checks" entry from Table 7.
- C5: N/A removed from the grade options; the criterion now always applies (it grades the
  operation outcome, which every instrument produces) and handles status-only outcomes through
  field-level applicability.
- C7: N/A added for instruments with no long-running commands and no observable sensor-like
  properties.
- C20: N/A added for instruments with no access, motion or presence states to report.
- C8: renamed from "Reference client implementation provided" to "Reference client
  implementation".
- Robotics sense of "cell" now reads "workcell" throughout (the tier name stays
  "Cell-integration").
- `meta.yml`: floor texts aligned with the preprint (Critical remediation-contract terms;
  Important floor C15/C7 conditions and gap-acceptance rule; C19 N/A and C20/C21 local-floor
  guidance in the Cell-integration floor). Weights, tiers and maxima unchanged (46 / 52).
- Citations are now rendered as author–year references instead of being dropped.
- Worked example `devices/example-reader-x.yml`: notes updated to Supplementary Table S1
  (totals still reproduce 36/46 and 39/52).
- Tooling: `build/generate.py` no longer hard-codes stale totals (C1–C17/44, C1–C20/50) in
  `scorecard.md` and the CSV; they now come from `meta.yml`. Nested requirement lists render
  with indentation. `devices/_template.yml` fixed (C18 is Important; C21 was missing).
- README: linked the preprint (doi:10.26434/chemrxiv.15009990/v2) and added a citation block.

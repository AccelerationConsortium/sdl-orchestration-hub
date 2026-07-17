#!/usr/bin/env python3
"""Score contributed device evaluations against the criteria set.

Reads  devices/*.yml  (contributor evaluations),  criteria/*.yml  and  meta.yml
(the source of truth), and writes:
  - devices/<slug>.md   a rendered scorecard per device
  - devices/README.md    an index/leaderboard of all contributed devices

It validates each device file (schema + semantic checks), then computes the
weighted standalone (C1-C17) and cell-integrated (C1-C20) totals and the pass
floors. Contributors only assign grades; totals and floors are computed here so
they cannot be entered wrong.

Run:          python build/score_device.py
Check only:   python build/score_device.py --check      (fails if outputs are stale)
Validate:     python build/score_device.py --validate   (schema + semantic checks only)

Files starting with "_" (e.g. devices/_template.yml) are ignored.
"""
import os, re, sys, glob, io, json, datetime
import yaml

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRIT = os.path.join(REPO, "criteria")
DEV = os.path.join(REPO, "devices")


def load_meta_and_criteria():
    crits = []
    for path in glob.glob(os.path.join(CRIT, "C*.yml")):
        with open(path, encoding="utf-8") as f:
            crits.append(yaml.safe_load(f))
    crits.sort(key=lambda c: int(c["id"][1:]))
    with open(os.path.join(REPO, "meta.yml"), encoding="utf-8") as f:
        meta = yaml.safe_load(f)
    return crits, meta


def device_files():
    return sorted(p for p in glob.glob(os.path.join(DEV, "*.yml"))
                  if not os.path.basename(p).startswith("_"))


def slug(path):
    return os.path.splitext(os.path.basename(path))[0]


def validate(dev, crits, meta, path):
    """Schema validation plus semantic checks. Returns a list of error strings."""
    errs = []
    try:
        import jsonschema
        with open(os.path.join(REPO, "schema", "device.schema.json"), encoding="utf-8") as f:
            schema = json.load(f)
        v = jsonschema.Draft202012Validator(schema)
        for e in sorted(v.iter_errors(dev), key=lambda e: e.path):
            errs.append("schema: " + e.message)
        if errs:
            return errs
    except ImportError:
        pass  # CI installs jsonschema; local runs still get the semantic checks below

    by_id = {c["id"]: c for c in crits}
    scores = dev.get("scores", {})

    # every criterion must be graded, and grade must be allowed for that criterion
    for c in crits:
        cid = c["id"]
        if cid not in scores:
            errs.append(f"missing grade for {cid}")
            continue
        g = scores[cid]["grade"]
        allowed = list(c["grade_options"])
        if g == "N/A" and "N/A" not in allowed:
            errs.append(f"{cid}: N/A not permitted for this criterion")
        elif g != "N/A" and g not in allowed:
            errs.append(f"{cid}: grade {g!r} not in {allowed}")
    # no unknown criteria
    for cid in scores:
        if cid not in by_id:
            errs.append(f"unknown criterion {cid}")
    return errs


def score(dev, crits, meta):
    gv = meta["grade_values"]
    scores = dev["scores"]
    weight = {c["id"]: c["weight"] for c in crits}

    def ids_of(*tiers):
        return [c["id"] for c in crits if c["tier"] in tiers]

    def total(ids):
        achieved = 0.0
        appmax = 0
        for cid in ids:
            g = scores[cid]["grade"]
            if g == "N/A":
                continue
            achieved += gv[g] * weight[cid]
            appmax += weight[cid]
        return achieved, appmax

    crit_ids = ids_of("Critical")
    imp_ids = ids_of("Important")
    cellonly_ids = ids_of("Cell-integration")
    standalone = total(crit_ids + imp_ids)
    cell = total(crit_ids + imp_ids + cellonly_ids)

    # floors
    crit_grades = [scores[cid]["grade"] for cid in crit_ids]
    critical_ok = crit_grades.count("Fail") == 0 and crit_grades.count("Partial") <= 1
    imp_fail_pts = sum(weight[cid] for cid in imp_ids if scores[cid]["grade"] == "Fail")
    important_ok = imp_fail_pts <= 4
    # the cell-integration floor applies to the lowest-id cell criterion (automated load/unload)
    floor_id = cellonly_ids[0] if cellonly_ids else None
    cell_ok = floor_id is None or scores[floor_id]["grade"] in ("Pass", "Partial", "N/A")

    cell_applies = any(scores[cid]["grade"] != "N/A" for cid in cellonly_ids)
    floors = {"Critical floor": critical_ok, "Important floor": important_ok}
    if cell_applies:
        floors["Cell-integration floor"] = cell_ok
    eligible = all(floors.values())
    return {
        "standalone": standalone, "cell": cell, "cell_applies": cell_applies,
        "floors": floors, "eligible": eligible, "imp_fail_pts": imp_fail_pts,
        "std_last": (crit_ids + imp_ids)[-1],
        "cell_last": (crit_ids + imp_ids + cellonly_ids)[-1],
    }


def fmt_total(t):
    achieved, appmax = t
    a = int(achieved) if achieved == int(achieved) else round(achieved, 1)
    return f"{a} / {appmax}"


def render_device_md(dev, res, crits):
    o = io.StringIO(); w = o.write
    d = dev["device"]; e = dev["evaluation"]
    title = f"{d['vendor']} — {d['model']}"
    w(f"# {title}\n\n")
    w("> **Generated** by `build/score_device.py` from `devices/*.yml`. Do not edit by hand.\n")
    w("> Grades are a contributor assessment, not an endorsement.\n\n")
    meta_bits = [f"Interface: {d.get('interface') or 'n/a'}",
                 f"Category: {d.get('category') or 'n/a'}",
                 f"Deployment: {e['deployment']}",
                 f"Evidence: {e['evidence_basis']}",
                 f"Evaluator: {e['evaluator']}",
                 f"Date: {e['date']}",
                 f"Scorecard version: {e['scorecard_version']}",
                 f"Verified: {'yes' if e.get('verified') else 'no'}"]
    w(" · ".join(meta_bits) + "\n\n")
    w(f"- **Standalone total (C1–{res['std_last']}):** {fmt_total(res['standalone'])}\n")
    if res["cell_applies"]:
        w(f"- **Cell-integrated total (C1–{res['cell_last']}):** {fmt_total(res['cell'])}\n")
    verdict = "eligible" if res["eligible"] else "**not eligible**"
    w(f"- **Floors:** " + ", ".join(f"{k} {'✓' if v else '✗'}" for k, v in res["floors"].items())
      + f" → {verdict} (totals rank eligible devices; floors decide eligibility)\n\n")
    w("| # | Criterion | Tier | Weight | Grade | Notes |\n|---|---|---|---|---|---|\n")
    by_id = {c["id"]: c for c in crits}
    for c in crits:
        s = dev["scores"][c["id"]]
        note = (s.get("note") or "").replace("|", "\\|")
        ev = s.get("evidence")
        if ev:
            note = (note + f" ([evidence]({ev}))").strip()
        w(f"| {c['id']} | {c['name']} | {c['tier']} | {c['weight']} | {s['grade']} | {note} |\n")
    if dev.get("vendor_response"):
        w("\n**Vendor response.** " + dev["vendor_response"].replace("\n", " ") + "\n")
    w("\n")
    return o.getvalue()


def render_index(rows):
    o = io.StringIO(); w = o.write
    w("# Contributed device evaluations\n\n")
    w("> **Generated** by `build/score_device.py`. Do not edit by hand — add a "
      "`devices/<vendor>-<model>.yml` file and regenerate.\n\n")
    w("Each row is a contributor's evaluation of one instrument's control interface against the "
      "criteria set. Totals **rank** devices that already clear the floors; **eligibility is set "
      "by the floors**, not the total. Entries are contributor assessments, not endorsements; a "
      "`verified` mark means a maintainer independently confirmed the evaluation.\n\n")
    if not rows:
        w("_No device evaluations yet. See the repo README for how to contribute one._\n")
        return o.getvalue()
    w("| Device | Interface | Deploy | Standalone | Cell-int. | Eligible | Basis | Verified | Eval | v |\n")
    w("|---|---|---|---|---|---|---|---|---|---|\n")
    for r in rows:
        cell = fmt_total(r["res"]["cell"]) if r["res"]["cell_applies"] else "—"
        w(f"| [{r['device']['vendor']} {r['device']['model']}]({r['slug']}.md) "
          f"| {r['device'].get('interface') or '—'} "
          f"| {r['eval']['deployment']} "
          f"| {fmt_total(r['res']['standalone'])} "
          f"| {cell} "
          f"| {'yes' if r['res']['eligible'] else 'no'} "
          f"| {r['eval']['evidence_basis']} "
          f"| {'yes' if r['eval'].get('verified') else 'no'} "
          f"| {r['eval']['evaluator']} "
          f"| {r['eval']['scorecard_version']} |\n")
    return o.getvalue()


def main():
    crits, meta = load_meta_and_criteria()
    paths = device_files()

    all_errs = {}
    loaded = []
    for p in paths:
        with open(p, encoding="utf-8") as f:
            dev = yaml.safe_load(f)
        # YAML parses unquoted ISO dates into date objects; normalize to strings
        ev = dev.get("evaluation") if isinstance(dev, dict) else None
        if isinstance(ev, dict) and isinstance(ev.get("date"), datetime.date):
            ev["date"] = ev["date"].isoformat()
        errs = validate(dev, crits, meta, p)
        if errs:
            all_errs[os.path.basename(p)] = errs
        else:
            loaded.append((p, dev))
    if all_errs:
        print("DEVICE VALIDATION FAILURES:", file=sys.stderr)
        for name, errs in all_errs.items():
            print(f"  {name}:", file=sys.stderr)
            for e in errs:
                print(f"    - {e}", file=sys.stderr)
        sys.exit(1)

    if "--validate" in sys.argv:
        print(f"validated {len(loaded)} device file(s)")
        return

    rows = []
    targets = {}
    for p, dev in loaded:
        res = score(dev, crits, meta)
        s = slug(p)
        targets[os.path.join(DEV, s + ".md")] = render_device_md(dev, res, crits)
        rows.append({"slug": s, "device": dev["device"], "eval": dev["evaluation"], "res": res})
    rows.sort(key=lambda r: (-r["res"]["standalone"][0], r["device"]["vendor"]))
    targets[os.path.join(DEV, "README.md")] = render_index(rows)

    if "--check" in sys.argv:
        stale = [p for p, content in targets.items()
                 if (not os.path.exists(p)) or open(p, encoding="utf-8").read() != content]
        # also flag orphaned generated .md files with no source .yml
        sources = {slug(p) for p in paths}
        for md in glob.glob(os.path.join(DEV, "*.md")):
            base = os.path.splitext(os.path.basename(md))[0]
            if base != "README" and base not in sources:
                stale.append(md)
        if stale:
            print("STALE device outputs (run `python build/score_device.py`):\n  " +
                  "\n  ".join(os.path.basename(p) for p in stale), file=sys.stderr)
            sys.exit(1)
        print("device outputs are up to date")
        return

    for p, content in targets.items():
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
    print(f"wrote {len(rows)} device card(s) + devices/README.md")


if __name__ == "__main__":
    main()

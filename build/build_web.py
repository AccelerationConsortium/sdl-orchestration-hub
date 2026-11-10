#!/usr/bin/env python3
"""Export the criteria set and contributed device evaluations to the web tool.

Reads  criteria/*.yml,  meta.yml,  devices/*.yml  and the submission issue forms in
.github/ISSUE_TEMPLATE/ (the source of truth) and writes
web/scorecard-data.js. Also writes web/tools.js (the orchestrator map and explorer) from
orchestrators/*.yml, validated against schema/orchestrator.schema.json.

The site loads web/scorecard-data.js after its own data files; web/sync.js then
overrides the site's criterion names, tiers, weights, effort and N/A options with these
values and adds the device evaluations to the public scorecard list, so the web tool
cannot drift from the criteria files.

Run:          python build/build_web.py
Check only:   python build/build_web.py --check      (fails if web/scorecard-data.js or web/tools.js is stale)
"""
import os, sys, glob, json
import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate import sentences, modal   # same MUST/SHOULD split as scorecard.md

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "web", "scorecard-data.js")
TOOLS_OUT = os.path.join(REPO, "web", "tools.js")
TIER = {"Critical": "C", "Important": "I", "Cell-integration": "X"}
GRADE = {"Pass": "G", "Partial": "P", "Fail": "F", "N/A": "NA"}


def load_yaml(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def requirement_items(text):
    """Requirement text as checklist items, split exactly as generate.py does for scorecard.md.
    m is the modal keyword (MUST, SHOULD, ...) or None for context sentences."""
    items = []
    for seg in text.split("\n"):
        seg = seg.strip()
        if not seg:
            continue
        sub = seg.startswith("- ")
        if sub:
            seg = seg[2:].strip()
        for s in ([seg] if sub else sentences(seg)):
            items.append({"m": modal(s), "t": s, "sub": sub})
    return items


def criteria():
    crits = [load_yaml(p) for p in glob.glob(os.path.join(REPO, "criteria", "C*.yml"))]
    crits.sort(key=lambda c: int(c["id"][1:]))
    return [{
        "n": int(c["id"][1:]),
        "id": c["id"],
        "name": c["name"],
        "tier": TIER[c["tier"]],
        "w": c["weight"],
        "effort": c["effort"],
        "gradeOptions": [GRADE[g] for g in c["grade_options"]],
        "summary": c.get("summary"),
        "applicability": c.get("applicability"),
        "requirement": c["requirement"],
        "requirementItems": requirement_items(c["requirement"]),
        "grading": c["grading"],
        "test": c["test"],
        "rationale": c["rationale"],
    } for c in crits]


def devices():
    out = []
    for path in sorted(glob.glob(os.path.join(REPO, "devices", "*.yml"))):
        slug = os.path.splitext(os.path.basename(path))[0]
        if slug.startswith("_"):
            continue
        d = load_yaml(path)
        dev, ev, scores = d["device"], d["evaluation"], d["scores"]
        out.append({
            "slug": slug,
            "vendor": dev["vendor"],
            "model": dev["model"],
            "category": dev.get("category"),
            "group": dev.get("group"),
            "tasks": dev.get("tasks") or [],
            "interfaces": dev.get("interfaces") or [],
            "interface": dev.get("interface"),
            "architecture": dev.get("architecture"),
            "firmwareVersion": dev.get("firmware_version"),
            "productUrl": dev.get("product_url"),
            "evaluator": ev["evaluator"],
            "date": str(ev["date"]),
            "scorecardVersion": str(ev["scorecard_version"]),
            "deployment": ev["deployment"],
            "evidenceBasis": ev["evidence_basis"],
            "verified": bool(ev.get("verified", False)),
            "grades": {k[1:]: GRADE[v["grade"]] for k, v in scores.items()},
            "notes": {k[1:]: v["note"] for k, v in scores.items() if v.get("note")},
            "evidence": {k[1:]: v["evidence"] for k, v in scores.items() if v.get("evidence")},
            "vendorResponse": d.get("vendor_response"),
        })
    return out


def issue_forms():
    """Field label -> id maps for the submission issue forms, so the web tool can parse issues
    created either from the site (prefilled) or directly on GitHub. GitHub renders a form issue
    as "### <label>" sections in field order."""
    forms = {}
    for path in sorted(glob.glob(os.path.join(REPO, ".github", "ISSUE_TEMPLATE", "*.yml"))):
        t = load_yaml(path)
        if not isinstance(t, dict) or "body" not in t:
            continue
        labels = t.get("labels") or []
        kind = "device" if "device" in labels else "orchestrator" if "orchestrator" in labels else None
        if not kind:
            continue
        title = t.get("title", "")
        forms[kind] = {
            "template": os.path.basename(path),
            "titlePrefix": title.split("<")[0].strip(),
            "labels": labels,
            "fields": {f["attributes"]["label"]: f["id"] for f in t["body"]
                       if f.get("type") != "markdown" and "id" in f},
        }
    return forms


def render():
    meta = load_yaml(os.path.join(REPO, "meta.yml"))
    with open(os.path.join(REPO, "pyproject.toml"), encoding="utf-8") as f:
        version = next(l.split("=", 1)[1].strip().strip('"') for l in f if l.startswith("version"))
    data = {
        "version": version,
        "totals": meta["totals"],
        "floors": meta["floors"],
        "criteria": criteria(),
        "devices": devices(),
        "issueForms": issue_forms(),
    }
    body = json.dumps(data, indent=1, ensure_ascii=False, default=str)
    return ("/* GENERATED by build/build_web.py from criteria/*.yml, meta.yml and devices/*.yml.\n"
            "   Do not edit by hand: edit the YAML source and regenerate. */\n"
            f"window.SCORECARD_SOURCE = {body};\n")


def orchestrators():
    """orchestrators/*.yml -> (tools, excluded, errors). Each file is schema-validated and its
    id must match the file name."""
    import jsonschema
    with open(os.path.join(REPO, "schema", "orchestrator.schema.json"), encoding="utf-8") as f:
        validator = jsonschema.Draft202012Validator(json.load(f))
    tools, errs = [], []
    for path in sorted(glob.glob(os.path.join(REPO, "orchestrators", "*.yml"))):
        name = os.path.splitext(os.path.basename(path))[0]
        if name.startswith("_"):
            continue
        t = load_yaml(path)
        errs += [f"orchestrators/{name}.yml: {e.message}" for e in validator.iter_errors(t)]
        if isinstance(t, dict) and t.get("id") != name:
            errs.append(f"orchestrators/{name}.yml: id {t.get('id')!r} does not match the file name")
        tools.append(t)
    tools.sort(key=lambda t: str(t.get("name", "")).lower())
    excluded = load_yaml(os.path.join(REPO, "orchestrators", "_excluded.yml")) or []
    return tools, excluded, errs


def render_tools(tools, excluded):
    dump = lambda v: json.dumps(v, indent=1, ensure_ascii=False)
    return ("/* GENERATED by build/build_web.py from orchestrators/*.yml (schema: schema/orchestrator.schema.json).\n"
            "   Do not edit by hand: add or edit orchestrators/<id>.yml and regenerate. */\n"
            f"window.TOOLS = {dump(tools)};\n\n"
            "/* Projects the paper deliberately excludes (orchestrators/_excluded.yml). */\n"
            f"window.EXCLUDED = {dump(excluded)};\n")


def main():
    tools, excluded, errs = orchestrators()
    if errs:
        sys.exit("ORCHESTRATOR VALIDATION FAILURES:\n  " + "\n  ".join(errs))
    targets = {OUT: render(), TOOLS_OUT: render_tools(tools, excluded)}
    if "--check" in sys.argv:
        stale = [p for p, text in targets.items()
                 if not os.path.exists(p) or open(p, encoding="utf-8").read() != text]
        if stale:
            sys.exit("stale web data (run  uv run python build/build_web.py): "
                     + ", ".join(os.path.relpath(p, REPO) for p in stale))
        print(f"web data is up to date ({len(tools)} orchestrators)")
        return
    for p, text in targets.items():
        with open(p, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {os.path.relpath(p, REPO)}")


if __name__ == "__main__":
    main()

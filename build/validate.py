#!/usr/bin/env python3
"""Validate every criteria/*.yml against schema/criterion.schema.json."""
import glob, os, sys, json
import yaml
try:
    from jsonschema import Draft202012Validator
except ImportError:
    sys.exit("pip install jsonschema")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
schema = json.load(open(os.path.join(REPO, "schema", "criterion.schema.json"), encoding="utf-8"))
validator = Draft202012Validator(schema)

paths = sorted(glob.glob(os.path.join(REPO, "criteria", "C*.yml")))
errs = []
for p in paths:
    data = yaml.safe_load(open(p, encoding="utf-8"))
    fname = os.path.basename(p)
    if data.get("id") != os.path.splitext(fname)[0]:
        errs.append(f"{fname}: id '{data.get('id')}' does not match filename")
    for e in validator.iter_errors(data):
        errs.append(f"{fname}: {e.message} (at {'/'.join(map(str, e.path)) or '<root>'})")

if errs:
    print("SCHEMA VALIDATION FAILURES:\n  " + "\n  ".join(errs), file=sys.stderr)
    sys.exit(1)
print(f"validated {len(paths)} criterion files against the schema")

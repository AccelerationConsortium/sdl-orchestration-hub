#!/usr/bin/env python3
"""Fail a PR that changes a criterion or meta.yml without a CHANGELOG.md entry.
Usage: python build/check_changelog.py <base-sha>"""
import sys, subprocess

if len(sys.argv) < 2:
    sys.exit("usage: check_changelog.py <base-sha>")
base = sys.argv[1]
changed = subprocess.check_output(
    ["git", "diff", "--name-only", f"{base}...HEAD"], text=True).split()

source_changed = any(c.startswith("criteria/") or c == "meta.yml" for c in changed)
changelog_changed = "CHANGELOG.md" in changed

if source_changed and not changelog_changed:
    sys.exit("Criteria or meta.yml changed but CHANGELOG.md was not updated. "
             "Add a line under the '## Unreleased' heading describing the change.")
print("changelog check OK")

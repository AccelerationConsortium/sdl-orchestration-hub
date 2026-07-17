#!/usr/bin/env python3
"""Generate the scorecard artifacts from the criterion source files.

Reads  criteria/*.yml  and  meta.yml  (the single source of truth) and writes:
  - scorecard.md              the human checklist (MUST/SHOULD/MAY bullets + grade checkboxes)
  - scorecard-template.csv    a plain fillable scoring sheet
  - scorecard-template.xlsx   a fillable sheet with grade dropdowns, auto totals, floor checks

Run:            python build/generate.py
Check only:     python build/generate.py --check     (fails if outputs are stale)
Invariants:     python build/generate.py --invariants (weights vs. declared maxima)

Contributors edit only  criteria/*.yml  and  meta.yml ; never edit the files above by hand.
"""
import os, re, sys, csv, glob, io
import yaml

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRIT = os.path.join(REPO, "criteria")


def load():
    crits = []
    for path in glob.glob(os.path.join(CRIT, "C*.yml")):
        with open(path, encoding="utf-8") as f:
            crits.append(yaml.safe_load(f))
    crits.sort(key=lambda c: int(c["id"][1:]))
    with open(os.path.join(REPO, "meta.yml"), encoding="utf-8") as f:
        meta = yaml.safe_load(f)
    return crits, meta


# ---- text helpers ---------------------------------------------------------
_ABBR = ["e.g.", "i.e.", "etc.", "vs.", "approx.", "Inc.", "Ltd.", "cf.", "al.", "No."]


def sentences(text):
    prot = text
    for a in _ABBR:
        prot = prot.replace(a, a.replace(".", "\x00"))
    parts = re.split(r'(?<=[.!?;])\s+(?=[A-Z("\d])', prot)
    return [p.replace("\x00", ".").strip() for p in parts if p.strip()]


def modal(s):
    for m in ("MUST NOT", "MUST", "SHOULD NOT", "SHOULD", "MAY"):
        if re.search(r'\b' + re.escape(m) + r'\b', s):
            return m
    return None


def render_requirements(text):
    """Render a requirement block as a bulleted checklist: MUST/SHOULD/MAY
    clauses become tagged bullets (MUST/SHOULD get a checkbox); context
    sentences stay as plain bullets. No text is dropped."""
    lines = []
    for seg in text.split("\n"):
        seg = seg.strip()
        if not seg:
            continue
        sub = seg.startswith("- ")
        if sub:
            seg = seg[2:].strip()
        chunks = [seg] if sub else sentences(seg)
        for s in chunks:
            m = modal(s)
            disp = s
            if m:
                disp = re.sub(r'\b' + re.escape(m) + r'\b', f"**{m}**", disp, count=1)
            box = "[ ] " if m in ("MUST", "MUST NOT", "SHOULD", "SHOULD NOT") else ""
            indent = "  " if sub else ""
            lines.append(f"{indent}- {box}{disp}")
    return "\n".join(lines)


def quote(text):
    return "\n".join("> " + ln if ln else ">" for ln in text.split("\n"))


# ---- scorecard.md ---------------------------------------------------------
def build_markdown(crits, meta):
    o = io.StringIO()
    w = o.write
    w(f"# {meta['title']}\n\n")
    w("A procurement checklist for evaluating whether a laboratory instrument's control "
      "interface is ready for autonomous (self-driving-lab) integration. Each criterion is "
      "graded **Fail / Partial / Pass** (some also **N/A**); the grade is multiplied by the "
      "criterion weight. This file is **generated** from `criteria/*.yml` and `meta.yml` — do "
      "not edit it by hand (see `README.md`).\n\n")

    # scoring + floors
    gv = meta["grade_values"]
    w("## Scoring\n\n")
    w(f"Grade values: Pass = {gv['Pass']}, Partial = {gv['Partial']}, Fail = {gv['Fail']}, "
      "N/A = excluded from the applicable maximum.\n\n")
    w(f"- **Standalone total** over {meta['totals']['standalone']['criteria']}: "
      f"max **{meta['totals']['standalone']['max']}**.\n")
    w(f"- **Cell-integrated total** over {meta['totals']['cell_integrated']['criteria']}: "
      f"max **{meta['totals']['cell_integrated']['max']}**.\n\n")
    w("The weighted total is a *ranking* figure among vendors that already clear the floors; "
      "eligibility is decided by the floors below, not by the number.\n\n")
    w("### Pass floors\n\n")
    for fl in meta["floors"]:
        w(f"- **{fl['name']}.** {fl['text']}\n")
    w("\n")

    # summary table
    w("## Summary\n\n")
    w("| # | Criterion | Tier | Weight | Grade |\n|---|---|---|---|---|\n")
    for c in crits:
        opts = " ".join(f"☐ {g}" for g in c["grade_options"])
        w(f"| {c['id']} | {c['name']} | {c['tier']} | {c['weight']} | {opts} |\n")
    w(f"| | **Standalone max (C1–C17)** | | **{meta['totals']['standalone']['max']}** | |\n")
    w(f"| | **Cell-integrated max (C1–C20)** | | **{meta['totals']['cell_integrated']['max']}** | |\n\n")

    # per-criterion cards
    w("## Criteria\n\n")
    for c in crits:
        w(f"### {c['id']} — {c['name']}\n")
        w(f"*{c['tier']} · weight {c['weight']} · effort {c['effort']}*\n\n")
        if c.get("summary"):
            w(f"{c['summary']}\n\n")
        if c.get("applicability"):
            w("**Applicability**\n\n")
            w(quote(c["applicability"]) + "\n\n")
        w("**Requirements**\n\n")
        w(render_requirements(c["requirement"]) + "\n\n")
        w("**Grade** (check one)\n\n")
        for g in c["grade_options"]:
            w(f"- [ ] **{g}**\n")
        w("\n" + quote(c["grading"]) + "\n\n")
        w("**Test.** " + c["test"].replace("\n", " ") + "\n\n")
        w("**Rationale.** " + c["rationale"].replace("\n", " ") + "\n\n")
        w("---\n\n")
    return o.getvalue()


# ---- CSV template ---------------------------------------------------------
def build_csv(crits, meta):
    o = io.StringIO()
    wr = csv.writer(o, lineterminator="\n")
    wr.writerow(["ID", "Criterion", "Tier", "Weight", "Grade (Pass/Partial/Fail/N/A)",
                 "Weighted points", "Notes"])
    for c in crits:
        wr.writerow([c["id"], c["name"], c["tier"], c["weight"], "", "", ""])
    wr.writerow([])
    wr.writerow(["", "Standalone total (C1-C17)", "", "", "", "", "max 44"])
    wr.writerow(["", "Cell-integrated total (C1-C20)", "", "", "", "", "max 50"])
    return o.getvalue()


# ---- XLSX template --------------------------------------------------------
def build_xlsx(crits, meta, path):
    from openpyxl import Workbook
    from openpyxl.worksheet.datavalidation import DataValidation
    from openpyxl.styles import Font, PatternFill, Alignment
    wb = Workbook()
    ws = wb.active
    ws.title = "Scorecard"
    hdr = ["ID", "Criterion", "Tier", "Weight", "Grade", "Weighted", "Notes"]
    ws.append(hdr)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="DDDDDD")
    dv = DataValidation(type="list", formula1='"Pass,Partial,Fail,N/A"', allow_blank=True)
    ws.add_data_validation(dv)
    first = 2
    for i, c in enumerate(crits):
        r = first + i
        ws.append([c["id"], c["name"], c["tier"], c["weight"], "", None, ""])
        dv.add(ws.cell(r, 5))
        ws.cell(r, 6).value = (
            f'=IF(E{r}="","",IF(E{r}="Pass",D{r},IF(E{r}="Partial",0.5*D{r},'
            f'IF(E{r}="Fail",0,""))))')
    n_crit = sum(1 for c in crits if c["tier"] == "Critical")
    n_std = sum(1 for c in crits if c["tier"] != "Cell-integration")
    last = first + len(crits) - 1                      # last criterion row
    std_end = first + n_std - 1                         # last standalone row
    imp_start = first + n_crit                          # first Important row
    cell_first = first + n_std                          # first cell row (load/unload floor)
    std_lbl = crits[n_std - 1]["id"]
    cell_lbl = crits[-1]["id"]
    floor_id = crits[n_std]["id"]
    # totals
    r = last + 2
    ws.cell(r, 2, f"Standalone total (C1-{std_lbl})").font = Font(bold=True)
    ws.cell(r, 6).value = f"=SUM(F{first}:F{std_end})"
    ws.cell(r, 7).value = f'=SUMPRODUCT((E{first}:E{std_end}<>"N/A")*(D{first}:D{std_end}))'
    ws.cell(r + 1, 2, f"Cell-integrated total (C1-{cell_lbl})").font = Font(bold=True)
    ws.cell(r + 1, 6).value = f"=SUM(F{first}:F{last})"
    ws.cell(r + 1, 7).value = f'=SUMPRODUCT((E{first}:E{last}<>"N/A")*(D{first}:D{last}))'
    ws.cell(r, 5, "achieved"); ws.cell(r, 5).font = Font(italic=True)
    ws.cell(r - 1, 6, "achieved").font = Font(italic=True)
    ws.cell(r - 1, 7, "applicable max").font = Font(italic=True)
    # floor checks
    fr = r + 3
    ws.cell(fr, 2, "Floor checks").font = Font(bold=True)
    crit_rows = f"E{first}:E{first + n_crit - 1}"       # Critical criteria
    imp_w = f"D{imp_start}:D{std_end}"; imp_g = f"E{imp_start}:E{std_end}"
    checks = [
        ("Critical: <=1 Partial, 0 Fail",
         f'=IF(AND(COUNTIF({crit_rows},"Fail")=0,COUNTIF({crit_rows},"Partial")<=1),"OK","FAIL")'),
        ("Important: failed weighted points <= 4",
         f'=IF(SUMPRODUCT(({imp_g}="Fail")*({imp_w}))<=4,"OK","FAIL")'),
        (f"Cell-integration: {floor_id} >= Partial",
         f'=IF(OR(E{cell_first}="Pass",E{cell_first}="Partial",E{cell_first}="N/A"),"OK","FAIL")'),
    ]
    for k, (label, formula) in enumerate(checks):
        ws.cell(fr + 1 + k, 2, label)
        ws.cell(fr + 1 + k, 6).value = formula
    # widths
    for col, wdt in zip("ABCDEFG", (6, 42, 16, 8, 10, 10, 30)):
        ws.column_dimensions[col].width = wdt
    for row in ws.iter_rows():
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=(cell.column == 2))
    wb.save(path)


# ---- invariants (used by CI) ---------------------------------------------
def invariants(crits, meta):
    errs = []
    sw = sum(c["weight"] for c in crits if c["tier"] != "Cell-integration")
    cw = sum(c["weight"] for c in crits)
    if sw != meta["totals"]["standalone"]["max"]:
        errs.append(f"standalone weight sum {sw} != declared max {meta['totals']['standalone']['max']}")
    if cw != meta["totals"]["cell_integrated"]["max"]:
        errs.append(f"cell-integrated weight sum {cw} != declared max {meta['totals']['cell_integrated']['max']}")
    ids = [c["id"] for c in crits]
    if ids != [f"C{i}" for i in range(1, len(crits) + 1)]:
        errs.append(f"criteria ids not contiguous C1..C{len(crits)}: {ids}")
    for c in crits:
        for fld in ("name", "tier", "weight", "effort", "requirement", "grading", "test", "rationale"):
            if not c.get(fld) and c.get(fld) != 0:
                errs.append(f"{c['id']} missing field: {fld}")
        if c["tier"] not in meta["tiers"]:
            errs.append(f"{c['id']} unknown tier {c['tier']}")
    return errs


def main():
    crits, meta = load()
    errs = invariants(crits, meta)
    if errs:
        print("INVARIANT FAILURES:\n  " + "\n  ".join(errs), file=sys.stderr)
        sys.exit(1)
    if "--invariants" in sys.argv:
        print("invariants OK")
        return
    targets = {
        os.path.join(REPO, "scorecard.md"): build_markdown(crits, meta),
        os.path.join(REPO, "scorecard-template.csv"): build_csv(crits, meta),
    }
    if "--check" in sys.argv:
        stale = [p for p, content in targets.items()
                 if (not os.path.exists(p)) or open(p, encoding="utf-8").read() != content]
        if stale:
            print("STALE (regenerate with `python build/generate.py`):\n  " +
                  "\n  ".join(os.path.basename(p) for p in stale), file=sys.stderr)
            sys.exit(1)
        print("generated files are up to date")
        return
    for p, content in targets.items():
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
    build_xlsx(crits, meta, os.path.join(REPO, "scorecard-template.xlsx"))
    print(f"wrote scorecard.md, scorecard-template.csv, scorecard-template.xlsx "
          f"({len(crits)} criteria)")


if __name__ == "__main__":
    main()

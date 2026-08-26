#!/usr/bin/env python3
"""
Applicability eval scorer.

Reads evals/golden-set.csv, compares a model's drafted label (`model_label`)
against Josh's corrected label (`human_label`), and reports agreement only for
rows that have both. A human-labeled case with no independent model draft is a
useful fixture, not a model disagreement.

Ground truth = `human_label`. Rows with an empty human_label are treated as
UNLABELED and skipped (they're still waiting for Josh to correct/confirm).

Usage:  python3 evals/score.py
Writes: evals/report.md  (and prints a summary)

Stdlib only — no dependencies.
"""
import csv
import os
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "golden-set.csv")
REPORT_PATH = os.path.join(HERE, "report.md")

CLASSES = ["pass", "reject", "needs review"]


def norm(label: str) -> str:
    if label is None:
        return ""
    s = label.strip().lower()
    aliases = {
        "pass": "pass", "p": "pass",
        "reject": "reject", "rejected": "reject", "r": "reject", "no": "reject",
        "needs review": "needs review", "review": "needs review",
        "needs-review": "needs review", "maybe": "needs review", "nr": "needs review",
    }
    return aliases.get(s, s)


def load_rows():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def prf(tp, fp, fn):
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return precision, recall, f1


def main():
    rows = load_rows()
    scoreable, awaiting_model, awaiting_human, unstarted = [], [], [], []
    for r in rows:
        h = norm(r.get("human_label", ""))
        m = norm(r.get("model_label", ""))
        if h and m:
            scoreable.append((r, m, h))
        elif h:
            awaiting_model.append(r)
        elif m:
            awaiting_human.append(r)
        else:
            unstarted.append(r)

    n = len(scoreable)
    out = []
    out.append("# Applicability Eval Report\n")
    out.append(f"Golden set: `{os.path.basename(CSV_PATH)}` — {len(rows)} roles.\n")
    out.append("\n## Coverage\n")
    out.append(f"- **Comparable (model draft + Josh label): {n}**\n")
    out.append(f"- Human-labeled, awaiting independent model draft: {len(awaiting_model)}\n")
    out.append(f"- Model-drafted, awaiting Josh's label: {len(awaiting_human)}\n")
    out.append(f"- Not yet drafted or labeled: {len(unstarted)}\n")

    versions = Counter((r.get("rubric_version") or "unknown").strip() for r, _, _ in scoreable)
    if versions:
        out.append("- Comparable rows by rubric version: " + ", ".join(
            f"`{version}`: {count}" for version, count in sorted(versions.items())
        ) + "\n")
    current_version = "v4"
    current_count = versions.get(current_version, 0)
    if current_count == 0:
        out.append("- **Current-rubric warning:** no independently drafted `v4` rows exist yet; "
                   "the agreement metric below is historical and is not a v4 accuracy claim.\n")

    if n == 0:
        out.append("\n_No comparable rows yet. Draft labels without reading `human_label`, then re-run._\n")
        _write(out)
        print("".join(out))
        return

    # Confusion matrix + accuracy
    correct = sum(1 for _, m, h in scoreable if m == h)
    acc = correct / n
    confusion = defaultdict(Counter)  # confusion[human][model]
    for _, m, h in scoreable:
        confusion[h][m] += 1

    heading = "Headline" if current_count else "Historical headline (not a v4 metric)"
    out.append(f"\n## {heading}\n")
    out.append(f"- **Agreement (accuracy): {correct}/{n} = {acc:.0%}**\n")

    # Per-class precision/recall/F1 (one-vs-rest, from the model's perspective)
    out.append("\n## Per-class (model vs. your labels)\n")
    out.append("| Class | Precision | Recall | F1 | Support |\n|---|---|---|---|---|\n")
    for c in CLASSES:
        tp = sum(1 for _, m, h in scoreable if m == c and h == c)
        fp = sum(1 for _, m, h in scoreable if m == c and h != c)
        fn = sum(1 for _, m, h in scoreable if m != c and h == c)
        support = sum(1 for _, m, h in scoreable if h == c)
        p, rc, f1 = prf(tp, fp, fn)
        out.append(f"| {c} | {p:.0%} | {rc:.0%} | {f1:.2f} | {support} |\n")

    # Confusion matrix
    out.append("\n## Confusion matrix (rows = your label, cols = model)\n")
    out.append("| your ↓ / model → | " + " | ".join(CLASSES) + " |\n")
    out.append("|---" * (len(CLASSES) + 1) + "|\n")
    for h in CLASSES:
        cells = " | ".join(str(confusion[h][m]) for m in CLASSES)
        out.append(f"| **{h}** | {cells} |\n")

    # Needs-review calibration
    model_nr = [(r, h) for r, m, h in scoreable if m == "needs review"]
    out.append("\n## Abstention (needs review) calibration\n")
    if model_nr:
        out.append(f"- Model abstained on {len(model_nr)} labeled role(s). "
                   "Your calls on those:\n")
        for r, h in model_nr:
            out.append(f"  - {r['company']} — {r['role']}: you said **{h}**\n")
        out.append("  - _Healthy if these were genuinely borderline; if you had a "
                   "confident call, the rubric was too timid._\n")
    else:
        out.append("- Model did not abstain on any labeled role.\n")

    # Disagreements — the important part
    disagreements = [(r, m, h) for r, m, h in scoreable if m != h]
    out.append("\n## Disagreements (fix the rubric here)\n")
    if not disagreements:
        out.append("- None on the labeled set. \n")
    else:
        for r, m, h in disagreements:
            out.append(f"- **{r['company']} — {r['role']}**: model **{m}** vs you **{h}**. "
                       f"{r.get('human_notes') or r.get('model_rationale','')}\n")

    # False positives are the costly ones (model Pass, you Reject)
    fps = [(r, h) for r, m, h in scoreable if m == "pass" and h == "reject"]
    if fps:
        out.append("\n**Costly false positives** (model said Pass, you said Reject — "
                   "these waste your review time):\n")
        for r, h in fps:
            out.append(f"- {r['company']} — {r['role']}\n")

    _write(out)
    print("".join(out))
    print(f"\nWrote {REPORT_PATH}")


def _write(lines):
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("".join(lines))


if __name__ == "__main__":
    main()

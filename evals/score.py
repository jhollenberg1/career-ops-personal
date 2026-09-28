#!/usr/bin/env python3
"""Score role-evaluation reviews with default-range outlier reporting."""
import csv
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
PATHS = {"candidates": "candidates.csv", "model": "model-predictions.csv", "human": "human-reviews.csv"}
DEFAULT_RANGES = {
    "role_shape": (-1.0, 0.5),
    "qualification": (-2.0, 0.3),
    "company": (-1.2, 1.3),
    "salary": (-1.0, 0.6),
}


def load(name):
    with open(os.path.join(HERE, PATHS[name]), newline="", encoding="utf-8") as handle:
        return {row["id"]: row for row in csv.DictReader(handle)}


def gate(value, source, row_id):
    normalized = (value or "").strip().lower()
    if normalized not in {"pass", "reject"}:
        raise ValueError(f"{source}: {row_id} hard gate must be Pass or Reject")
    return normalized


def adjustment(value, kind, source, row_id, allow_blank=False):
    if not (value or "").strip() and allow_blank:
        return 0.0
    try:
        parsed = round(float(value), 1)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{source}: {row_id} {kind} adjustment is required") from exc
    return parsed


def total(base, hard_gate, adjustments):
    return 0.0 if hard_gate == "reject" else round(max(0.0, min(10.0, base + sum(adjustments.values()))), 1)


def band(value):
    return "Pass" if value >= 8.0 else "Needs review" if value >= 6.0 else "Reject"


def scored(row, prefix, base, source):
    hard_gate = gate(row.get(f"{prefix}_hard_gate"), source, row["id"])
    adjustments = {kind: adjustment(row.get(f"{prefix}_{kind}_adjustment"), kind, source, row["id"], hard_gate == "reject") for kind in DEFAULT_RANGES}
    expected = total(base, hard_gate, adjustments)
    raw_total = (row.get(f"{prefix}_total") or "").strip()
    if hard_gate == "reject" and not raw_total:
        entered = 0.0
    else:
        try:
            entered = round(float(raw_total), 1)
        except ValueError as exc:
            raise ValueError(f"{source}: {row['id']} total is required") from exc
    if entered != expected:
        raise ValueError(f"{source}: {row['id']} total {entered:.1f} must equal {expected:.1f}")
    return hard_gate, adjustments, entered


def main():
    candidates, models, humans = load("candidates"), load("model"), load("human")
    comparable = []
    for row_id, candidate in candidates.items():
        if row_id not in models or row_id not in humans:
            continue
        base = float(humans[row_id]["title_base"])
        model = scored(models[row_id], "model", base, "model-predictions.csv")
        human = scored(humans[row_id], "human", base, "human-reviews.csv")
        comparable.append((candidate, model, human))
    out = ["# Role-Eval Report\n", "\n## Coverage\n", f"- Test cases: **{len(candidates)}**\n", f"- Comparable: **{len(comparable)}**\n"]
    if not comparable:
        out.append("\n_No comparable reviews yet. Fill every adjustment and the calculated total in both files._\n")
        write(out); print("".join(out)); return
    out.append("\n## Agreement\n")
    for kind in DEFAULT_RANGES:
        mae = sum(abs(model[1][kind] - human[1][kind]) for _, model, human in comparable) / len(comparable)
        out.append(f"- {kind.replace('_', ' ').title()} adjustment MAE: **{mae:.2f}**\n")
    total_mae = sum(abs(model[2] - human[2]) for _, model, human in comparable) / len(comparable)
    gate_agreement = sum(model[0] == human[0] for _, model, human in comparable)
    out += [f"- Total-score MAE: **{total_mae:.2f}**\n", f"- Hard-gate agreement: **{gate_agreement}/{len(comparable)}**\n"]
    out.append("\n## Adjustment outliers (review, not errors)\n")
    for source_name, prefix, rows in [("Model", "model", models), ("Joshua", "human", humans)]:
        outliers = []
        for row_id, row in rows.items():
            if row_id not in candidates or not (row.get(f"{prefix}_hard_gate") or "").strip():
                continue
            if gate(row.get(f"{prefix}_hard_gate"), source_name, row_id) == "reject":
                continue
            for kind, (lower, upper) in DEFAULT_RANGES.items():
                value = adjustment(row.get(f"{prefix}_{kind}_adjustment"), kind, source_name, row_id)
                if value < lower or value > upper:
                    outliers.append(f"- {source_name}: {row_id} {kind} {value:+.1f} (default {lower:+.1f} to {upper:+.1f})\n")
        out.extend(outliers or [f"- {source_name}: none.\n"])
    matrix = defaultdict(Counter)
    for _, model, human in comparable:
        matrix[band(human[2])][band(model[2])] += 1
    labels = ["Pass", "Needs review", "Reject"]
    out += ["\n## Total routing matrix\n", "| Joshua ↓ / model → | " + " | ".join(labels) + " |\n", "|---|---|---|---|\n"]
    for human_label in labels:
        out.append("| **" + human_label + "** | " + " | ".join(str(matrix[human_label][model_label]) for model_label in labels) + " |\n")
    write(out); print("".join(out))


def write(lines):
    with open(os.path.join(HERE, "report.md"), "w", encoding="utf-8") as handle:
        handle.write("".join(lines))


if __name__ == "__main__":
    main()

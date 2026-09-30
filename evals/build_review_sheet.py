#!/usr/bin/env python3
"""Create or refresh Joshua's review sheet without losing entered reviews."""
import csv
from pathlib import Path
from title_bases import title_base_for

HERE = Path(__file__).resolve().parent
CANDIDATES, REVIEWS = HERE / "candidates.csv", HERE / "human-reviews.csv"
FIELDS = ["id", "company", "role", "location", "comp", "stated_yoe", "required_qualifications", "company_description", "role_description", "source_snapshot", "title_base", "human_hard_gate", "human_role_shape_adjustment", "human_qualification_adjustment", "human_company_adjustment", "human_salary_adjustment", "human_total", "human_justification", "human_notes"]


def main():
    existing = {}
    if REVIEWS.exists():
        with REVIEWS.open(newline="", encoding="utf-8") as handle:
            # Accept the original reviewer-friendly headers as well as the
            # machine-friendly headers this script writes. This lets a sheet
            # be refreshed without discarding Joshua's manual judgments.
            existing = {
                row.get("id") or row.get("Role_id"): row
                for row in csv.DictReader(handle)
                if row.get("id") or row.get("Role_id")
            }
    with CANDIDATES.open(newline="", encoding="utf-8") as handle:
        candidates = list(csv.DictReader(handle))
    with REVIEWS.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for candidate in candidates:
            prior = existing.get(candidate["id"], {})
            def prior_value(field, legacy_field):
                return prior.get(field, prior.get(legacy_field, ""))
            writer.writerow({
                "id": candidate["id"], "company": candidate["company"], "role": candidate["role"],
                "location": candidate["location"], "comp": candidate["comp"],
                "stated_yoe": candidate["stated_yoe"], "required_qualifications": candidate["required_qualifications"],
                "company_description": candidate["company_description"], "role_description": candidate["role_description"],
                "source_snapshot": candidate["source_snapshot"],
                "title_base": f"{title_base_for(candidate['role']):.1f}",
                "human_hard_gate": prior_value("human_hard_gate", "Human Hard Gate"),
                "human_role_shape_adjustment": prior_value("human_role_shape_adjustment", "Human Role Shape Adjustment"),
                "human_qualification_adjustment": prior_value("human_qualification_adjustment", "Human Qualification Adjustment"),
                "human_company_adjustment": prior_value("human_company_adjustment", "Human Company Adjustment"),
                "human_salary_adjustment": prior_value("human_salary_adjustment", "Human Salary Adjustment"),
                "human_total": prior_value("human_total", "Human Total"),
                "human_justification": prior_value("human_justification", "Human Justification"),
                "human_notes": prior_value("human_notes", "Human Notes"),
            })
    print(f"Wrote {len(candidates)} review rows to {REVIEWS}")


if __name__ == "__main__":
    main()

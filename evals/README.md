# Role-eval harness

`rubric.md` is the current classifier specification. `golden-set.csv` is the
canonical dataset; each row has two deliberately independent fields:

- `model_*`: a draft made from the rubric before reading Josh's answer.
- `human_*`: Josh's ground truth and score notes.

`score.py` measures only rows containing both fields. A row with a human label
and a blank model label is a calibration fixture awaiting an independent draft,
not a model error. It also reports the model-drafted rows awaiting Josh's call
and rows that have not begun either step.

## Dataset history

- `R1–R7` are historical live-posting comparisons drafted under `v1`.
- `C1–C12` were imported from `calibration-set-v3.md`. They preserve Josh's
  synthetic-case scores and labels, but intentionally have blank `model_*`
  fields: their answer key was known during migration.

Do not use either group as a claimed v4 accuracy result. To measure v4, add
fresh, unseen postings under `rubric_version: v4`, draft their `model_*` fields
first, then obtain Josh's `human_*` calls. Aim for at least 25 comparable v4
rows before treating the metric as stable.

## Routine

1. Add a live role with blank `human_*` fields.
2. Draft `model_label`, confidence, and rationale from `rubric.md` without
   viewing the answer key.
3. Record Josh's label and notes.
4. Run `python3 evals/score.py`.

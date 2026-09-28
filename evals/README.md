# Role-eval rubric test suite

Each row has a fixed `title_base`. Mark the hard gate first. If it passes, enter
any one-decimal adjustment and calculate the total.

| Field | Default range — guidance, not a limit |
|---|---|
| `role_shape_adjustment` | `-1.0` to `+0.5` |
| `qualification_adjustment` | `-2.0` to `+0.3` |
| `company_adjustment` | `-1.2` to `+1.3` |
| `salary_adjustment` | `-1.0` to `+0.6` |

```text
total = 0.0                                  if hard gate = Reject
total = clamp(title base + all adjustments)  otherwise
```

Those ranges are normal defaults, not constraints. Use a larger adjustment when
the evidence warrants it and explain it in the justification. `score.py` flags
outliers for review but accepts them, while still verifying every entered total.

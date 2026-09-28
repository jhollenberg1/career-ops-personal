# Applicability Rubric — v6.3

This rubric produces one auditable `total_score`. Do not create a separate
role-fit or offer-likelihood score: both would double-count title base and the
qualification adjustment.

```text
total_score = 0.0                                      when hard gate = Reject
total_score = clamp(title_base + role_shape + qualification + company + salary, 0.0, 10.0)
                                                       otherwise
```

Round the total to one decimal. The title base is the approved starting score
in `evals/title_bases.py`; it is not a free-form input.

## 1. Hard gates — always assess first

Reject without scoring a role that is closed, outside NYC or US-remote/NY-
eligible, entirely below $80k, in an excluded sector/function, or requires
work authorization, a license, clearance, or another essential qualification
Joshua clearly lacks.

Reject Staff, Principal, Director, Head, and VP scope. Treat Senior, Lead,
Manager, and Architect as a seniority check, not an automatic rejection: reject
when the JD requires people management, an executive remit, or scope Joshua
cannot credibly claim.

For each core functional experience requirement, count only directly comparable
experience. Data engineering does not by itself count as implementation,
technical project delivery, enterprise go-live ownership, or people management.
A role requiring two or more years beyond Joshua's directly comparable
experience is a hard rejection unless the JD explicitly permits an evidenced
adjacent background. A required five or more years in a core function that
Joshua clearly has not performed is likewise a hard rejection. Do not use total
data/analytics career tenure to close those gaps.

Poor employee-review evidence alone is not a hard gate: it affects company fit
and should prompt verification. Reserve company hard gates for excluded sectors,
verified ethical conflicts, or objectively incompatible operating conditions.

## 2. Requirements and qualification adjustment

Before assigning a gate or adjustment, make a short evidence ledger for each
mandatory or material qualification:

| JD requirement | Direct candidate evidence | Closest transferable evidence | Counted relevant YOE | Gap |
|---|---|---|---:|---:|

State the bridge explicitly before crediting transferable experience. Do not
invent production, customer, implementation, or management depth from a
generic technical or stakeholder claim.

Classify requirements before judging gaps:

1. **Mandatory:** legal/eligibility requirements; explicit `must`, `required`,
   or `minimum qualification` language; and requirements at the top of a JD's
   requirement list.
2. **Material:** `significant`, `substantial`, or `proven` experience; a named
   field/domain such as enterprise sales, public procurement, or clinical
   implementation; and later required qualifications.
3. **Flexible:** named technologies, `knowledge of`, `familiarity with`,
   preferred/bonus skills, or values language—unless the JD makes them clearly
   mandatory.

Fields/domains matter more than named tools. Missing Airflow is usually
learnable; missing required enterprise-sales experience is generally material.
Use only actual JD requirements and candidate evidence in `cv.md`,
`article-digest.md`, and `resume/skills-inventory.md`.

Use `qualification_adjustment` as a continuous one-decimal value. Its normal
range is `-2.0` to `+0.3`, but it is not a limit: exceed it with a concise,
evidence-based justification. A no-gap or directly evidenced case can receive a
small positive adjustment; a reasonable transferable gap should be modestly
negative; multiple material gaps can be much lower. A truly impossible gap is a
hard gate, not a large negative adjustment.

## 3. Role-shape adjustment

The title base already represents baseline interest. Use
`role_shape_adjustment` only for an explicit day-to-day working condition that
makes this specific role better or worse than its title base: technical
discovery, implementation ownership, stakeholder facilitation, and customer
delivery can raise it; reactive support, quota pressure, excessive travel,
architecture ownership, deep on-call work, or an undesirable work shape can
lower it. Do not infer a role-shape adjustment merely from a requirement or
from missing customer exposure. Do not penalize the same fact here and in the
qualification adjustment. Normal range: `-1.0` to `+0.5`; larger adjustments
are allowed with a specific rationale.

## 4. Company adjustment

Score the employer independently, using these internal components before
recording one combined `company_adjustment`:

- Mission/product interest: `-0.5` to `+0.7`
- Culture/work-model evidence: `-0.6` to `+0.4`
- Stability/career platform: `-0.2` to `+0.2`

Excellent mission, product, and culture evidence together may add up to `+1.3`.
A healthy but uninteresting commercial company can be neutral or slightly
negative; missing evidence is exactly `0.0`. Strong negative culture evidence
can be strongly negative, but is not by itself a hard gate. Normal range is
`-1.2` to `+1.3`; larger adjustments require a specific rationale.
For production company-target routing, also record a separate `company_fit`
from 1.0–5.0; it does not enter the total calculation.

## 5. Salary adjustment

Entirely below $80k is a hard gate. Otherwise use salary as a meaningful but
non-dominant adjustment: `$80–99k` normally `-1.0`, `$100–129k` around `-0.2`,
`$130–159k` around `+0.2`, `$160–180k` around `+0.5`, and above $180k around
`+0.6`. Missing salary is `0.0`, not a penalty. Normal range: `-1.0` to `+0.6`;
larger adjustments are allowed with a rationale.

## Routing

- `8.0–10.0`: surface
- `6.0–7.9`: fallback only
- `0.0–5.9`: do not surface

## Calibration

For every test case, record hard-gate result, the four adjustments, calculated
total, and a concise justification. Joshua's review is ground truth. Compare
hard-gate agreement, each adjustment's error, and total-score routing. Change
this rubric only after the same discrepancy appears in multiple cases.

### Changelog

- **v6.3 (2026-09-28):** Added direct-functional-experience accounting and an
  evidence ledger; clarified company-review evidence is not a hard gate; added
  anchored company components; and prohibited requirement/role-shape double
  counting.
- **v6.2 (2026-09-28):** Replaced overlapping role-fit and offer-likelihood
  scores with title base plus four transparent adjustments. Default adjustment
  ranges are advisory rather than fixed buckets.

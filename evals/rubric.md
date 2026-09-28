# Applicability Rubric — v5.2

This is the authoritative scan rubric for Joshua Hollenberg. It deliberately separates two decisions:

1. `company_fit` (1–5): whether Joshua should maintain a relationship with this company, even when it has no suitable role today.
2. `match_score` (1–10): whether this specific live role should be surfaced to the Job Applications board.

Josh's corrections in `golden-set.csv` remain the ground truth for calibration.

## Output

For every evaluated company-role pair, return `company_fit` (1–5), `company_disposition` (`Save`, `Monitor`, or `Do not target`), `match_score` (1–10), `role_disposition` (`Pass`, `Needs review`, or `Reject`), confidence, a one-sentence `company_rationale`, and a one-sentence `role_rationale` with its main caveat.

### Routing

| Condition | Action |
|---|---|
| Hard exclusion | Do not save the company or surface the role. |
| `company_fit` 4–5 | Create or update a Company Targets card. |
| `company_fit` 3 | Save only with a strong current role or a concrete networking reason. |
| `company_fit` 1–2 | Do not target unless Joshua explicitly opts in. |
| `match_score` 8–10 | Surface the role to the Job Applications board. |
| `match_score` 6–7 | Surface only when a scan has no 8–10 roles. |
| `match_score` 1–5 | Do not surface the role; retain the company only if it qualifies independently. |

## Gate first: role eligibility

Reject a role that is dead, outside NYC or US-remote/NY-eligible, entirely below $80k, entry-level (0–1 YOE), Staff/Principal/Director/Head/VP scope, requires 7+ years, or belongs to defense, mass surveillance, DoD/IC-first, marketing, quota-carrying AE, finance/accounting, or admin.

`Senior` and `Lead` are not automatic rejects. Score the stated scope: 4–6 YOE and an individual-contributor remit can be viable; management scope or a 7+ YOE requirement is not.

## Evidence and requirement discipline

Assess the candidate against the actual JD, not against an imagined version of
the role.

- Use `cv.md`, `article-digest.md`, and `resume/skills-inventory.md` as the
  evidence set for role scoring. The skills inventory contains
  candidate-confirmed capabilities that may not yet appear in a submitted
  resume.
- Score only requirements stated in the JD. A role title and its usual market
  expectations establish the lane's starting score, but do not create an
  unstated gap. For example, do not penalize a Solutions Engineer candidate
  for prior pre-sales tenure, demos, discovery, or production API ownership
  unless the JD asks for it.
- Distinguish `required`, `preferred/bonus`, and `contextual` language.
  A missing preferred skill is a caveat, not a hard gap; values language such
  as ownership, curiosity, or willingness to learn should be assessed from
  transferable evidence and should not be treated as a credential requirement.
- Give credit for a directly confirmed general skill only at the level it is
  documented. Do not expand generic HTML/CSS/JavaScript or API experience into
  a claim of a named framework, API protocol, architectural ownership, or
  production depth without evidence.
- Keep scoring evidence separate from resume evidence:
  `resume/bullet-library.md` remains the exclusive source for claims inserted
  into a tailored resume.

## Company fit (1–5)

Assess the company independently of the current opening.

| Dimension | What to assess |
|---|---|
| Mission and ethics | Mission alignment is a positive signal; its absence is neutral. Require no excluded or ethically disqualifying business model. |
| Product clarity and interest | Can the product and its customer impact be explained plainly? Is the problem worth spending years on? |
| Culture and working model | Evidence of sustainable workload, respectful leadership, and NYC/remote compatibility. |
| Career platform | Likelihood of meaningful client-facing technical, implementation, TPM, or adjacent paths over the next 12–24 months. |
| Economic plausibility | Reasonable likelihood of meeting the compensation floor and a stable-enough operating model. |

| Score | Meaning |
|---:|---|
| 5 | Priority target: proactively network and monitor. |
| 4 | Strong target: monitor roles and pursue warm introductions. |
| 3 | Conditional target: act only with an unusually strong role, contact, or new evidence. |
| 2 | Weak target: product, culture, ethics, location, or career path is materially unattractive. |
| 1 | Do not target: hard ethical conflict, incompatible work model, or no meaningful interest. |

Mission alignment can raise `company_fit`, but lack of a social mission must not lower it or cap an otherwise viable role. Unknown culture, compensation, or stability lowers confidence rather than automatically lowering `company_fit`; affirmative negative evidence does lower it. For companies outside Joshua's target sectors, assess culture from employee-review rating, meaningful review volume and recency, and recurring themes—not a rating alone. Insufficient culture evidence produces `Needs review`; repeated credible evidence of an extreme working model, punitive leadership, or bait-and-switch expectations lowers `company_fit`.

## Role match score (1–10)

Start from the strongest applicable lane, then apply explicitly stated
attainability requirements, relationship intensity, technical burden, workload,
and company context.

| Lane | Default | Guidance |
|---|---:|---|
| Solutions Engineer | 9 | Top-priority lane. Lower for a hard quota, required prior pre-sales tenure (only when the JD states it), or deep-specialist technical requirements. |
| Implementation / Solutions (other than Solutions Engineer) / Integration / Professional Services / Technical Consultant | 8 | Core bridge: technical credibility applied to client outcomes. |
| TPM / Technical Project or Program Management | 7 | Raise when scope is stakeholder-heavy and requirements are attainable. |
| Sales Engineer / consultative pre-sales | 7 | Keep if discovery and technical credibility matter; dock for a hard sales-history requirement or quota pressure. |
| FDE / Deployment | 7 | Core lane alongside implementation and solutions work. Raise for client deployment and broad problem-solving; lower for heavy systems design, travel, on-call, or startup intensity. |
| Data strategy / Data strategist | 7 | Keep when the work turns data into stakeholder or customer decisions, adoption, or implementation. Lower for reporting-only, internal analytics, or a deep-specialist requirement without a credible bridge. |
| Technical product / Data product | 6 | Raise for hands-on technical delivery, data integrations, and strong cross-functional ownership. Lower for product-leadership scope, a pure PM background requirement, or weak technical proximity. |
| Mission-aligned consulting | 6 | Raise only with credible hours/staffing and junior-to-mid scope. |
| Data / software engineering | 5 | Raise only for a compelling, understandable product plus integration, customer, or real-world problem work. Deep infrastructure, SRE, systems design, or on-call-heavy work caps at 6. |
| RevOps / GTM Ops / partnerships / BizOps | 4 | Adjacent but weakly attainable; do not surface without an unusually direct bridge. |

Raise for client discovery, implementation ownership, facilitation, stakeholder alignment, translation, clear communication, and a credible 4–6 YOE bridge. Lower for explicitly required deep specialization, architecture interviews, systems design, on-call, quota pressure, or 50%+ travel.

Workload is a signal, not a role gate. Early-stage, lean-team, fast-paced,
high-output, or “work hard” language should be reported as a caveat and may
modestly reduce confidence, but must not by itself reduce the match score or
cap a role. Apply a material score reduction only for credible, role-specific
evidence of an extreme model (for example 996, sustained 70+ hour expectations,
or repeated corroborated reports of chronic overwork or punitive leadership).
Unknown workload is a flag for Joshua to investigate, not a penalty.

`company_fit` is supporting context only:

- A company fit of 4–5 can raise an already viable role by at most 1 point.
- A company fit of 1–2 caps a role at 5 only when it results from affirmative negative evidence (ethics, culture, work model, product, or stability), not from a lack of mission alignment or missing culture data.
- Company mission, culture, or compensation never overrides a hard role gate.

## Calibration rules

- A role needs a credible role-shape and attainability case to reach 8+.
- A company can receive `company_fit` 4–5 without any current role receiving a passing score.
- Reserve 9–10 for a highly attainable core role at a clear, compelling company with reasonable workload signals.
- Exception: Solutions Engineer roles start at 9 by default. They still have to pass the role-eligibility gate and can drop below 9 on JD evidence, but they don't need company context to earn the 9.
- Record company fit separately from role fit in every future labeled example.
- Review saved high-fit companies quarterly; downgrade or archive when evidence changes.

### Changelog

- **v5.2 (2026-09-28):** Split Solutions Engineer out of the Implementation/Solutions lane and raised its default from 8 to 9, per Joshua.
- **v5.1 (2026-09-21):** Added a candidate-confirmed skills inventory for JD
  scoring; prohibited inferred title-based gaps; clarified that preferred
  skills and values language are not hard requirements; and made workload a
  proportional signal rather than an automatic score cap.
- **v5 (2026-08-20):** Added independent company-fit scoring, Company Targets routing, and a strict limit on how much company quality can affect a live-role score. The 1–10 score is now explicitly a role-surfacing score.
- **v4 (2026-08-20):** Replaced the prior mission/culture-heavy v3 rubric with a role-shape and lifestyle model: added TPM, technical consulting, Professional Services, selective Sales Engineer, company-clarity, technical-burden, and workload criteria; demoted generic operations; clarified 4–6 YOE and Senior/Lead handling.

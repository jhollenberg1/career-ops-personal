# Mode: populate-notion — Card surfaced roles into Notion

Takes the rubric-scored, surfaced roles produced by `modes/role-scan.md` (step 18 hand-off)
and upserts them into the Notion **"Job Search"** data source. This mode owns all
Notion field mapping and dedup — no carding logic lives outside the repo.

> **Never create a page for an unvalidated role.** A handoff must have passed the rubric
> surfacing gate and include `official_careers_url`, `detail_url`, and an `active`
> validation result with `finalUrl` and `checkedAt`. Excluded, closed, and unverified roles
> are recorded locally and never carded.

## Target
- Data source: **Job Search** — `collection://deaa8821-6086-4758-ac3f-f9037f7800c7`
- Create pages with the **notion-create-pages** tool against that data source.

## Dedup (do this FIRST)
1. Read `data/seen-postings.jsonl`; any posting with `status: "carded"` for this URL → **skip**.
2. Query the data source by `Link` (the `url` column is UNIQUE) — if a page already has this
   JD URL, **skip** (do not create a duplicate). Optionally refresh `Fit score` if it changed.

## Field mapping (per new role)
| Notion property | Value |
|---|---|
| `Company` (title) | company name |
| `Role` (text) | job title |
| `Link` (url) | JD URL |
| `Type` (select) | `Role` |
| `Stage` (select) | `Researching` |
| `Applicability` (select) | 8–10 → `Pass`; 4–7 → `Needs review` (1–3 are never carded) |
| `Fit score` (number) | the v4 `match_score` (1–10) |
| `Role fit` (number) | optional `job_fit` sub-signal (1–5), else blank |
| `Company fit` (number) | optional `mission_fit` sub-signal (1–5), else blank |
| `Comp band` (select) | from salary: <80k `Under 80k reject` · 80–100k `80-100k workable` · 100–130k `100-130k fair` · 130–180k `130-180k target` · 180k+ `180k+ ideal` · none `Not listed` |
| `Interest` (select) | optional purpose/interest read: `High` / `Medium` / `Low`, else blank |

Page body: one-line **justification** (the rubric rationale), then the JD summary
(`job_description`), location/work-model, comp if stated, `glassdoor` rating if found, and
`Verified: {verification.checkedAt} — {verification.finalUrl}`.
Leave `Recruiter*`, `Gap notes`, and `Next step` blank — Phase B (`apply-prep`) fills those.

## After carding
Append one line per carded role to `data/seen-postings.jsonl`:
`{date_seen, company, role, url, status:"carded", sector, last_checked}` (append only, never rewrite).

## Guardrails
- Never overwrite a human-edited `Stage`, `Applicability`, or notes on an existing page.
- Never create a page for a role that failed the surfacing gate or hit a hard exclusion.
- One page per JD URL — the `Link` uniqueness check is the source of truth for dedup.

# Architecture

Career-Ops has two supported paths. They share your CV and profile, but they answer
different questions and use different scores.

```
Find roles:  portals.yml → scanner/search → role-scan → board
Assess a role: job URL or JD → auto-pipeline → report + tailored CV → applications tracker
```

`docs/SYSTEM_MAP.md` is the operational reference for the role-discovery path. This
page explains the boundaries so that optional tooling is not mistaken for required setup.

## Core components

| Component | Responsibility | Source of truth |
|---|---|---|
| Candidate profile | Your experience, preferences, and targeting context | `cv.md`, `config/profile.yml`, `modes/_profile.md` |
| Discovery scanner | Fetches configured ATS listings and emits verified candidates for score-before-card processing | `scanner/`, `portals.yml` |
| Role assessment | Applies the role-scan rubric before a role is surfaced | `modes/role-scan.md`, `evals/rubric.md` |
| Application assessment | Evaluates a specific role and creates a report/CV plan | `modes/auto-pipeline.md`, `modes/oferta.md` |
| Application tracker | Records roles once they become applications | `data/applications.md` |

The discovery `match_score` (1–10) and application `application_score` (1–5) are
intentionally separate. Do not compare or average them.

## Application assessment flow

1. **Input**: User pastes JD text or URL
2. **Extract**: Playwright/WebFetch extracts JD from URL
3. **Classify**: Detect archetype (1 of 6 types)
4. **Evaluate**: 6 blocks (A-F):
   - A: Role summary
   - B: CV match (gaps + mitigation)
   - C: Level strategy
   - D: Comp research (WebSearch)
   - E: CV personalization plan
   - F: Interview prep (STAR stories)
5. **Score**: Weighted average across 10 dimensions (1-5)
6. **Report**: Save as `reports/{num}-{company}-{date}.md`
7. **PDF**: Generate ATS-optimized CV (`generate-pdf.mjs`)
8. **Track**: Write a TSV addition to `data/tracker-additions/`; merge it with `npm run merge`

## Shared inputs

```
cv.md                    →  Evaluation context
article-digest.md        →  Proof points for matching
config/profile.yml       →  Candidate identity
portals.yml              →  Scanner configuration
templates/states.yml     →  Canonical status values
templates/cv-template.html → PDF generation template
```

## Output conventions

- Reports: `{###}-{company-slug}-{YYYY-MM-DD}.md` (3-digit zero-padded)
- PDFs: `cv-candidate-{company-slug}-{YYYY-MM-DD}.pdf`
- Tracker TSVs: `data/tracker-additions/{id}.tsv`

## Tracker integrity

Scripts maintain data consistency:

| Script | Purpose |
|--------|---------|
| `merge-tracker.mjs` | Merges pending TSV additions into applications.md |
| `verify-pipeline.mjs` | Health check: statuses, duplicates, links |
| `dedup-tracker.mjs` | Removes duplicate entries by company+role |
| `normalize-statuses.mjs` | Maps status aliases to canonical values |
| `cv-sync-check.mjs` | Validates setup consistency |

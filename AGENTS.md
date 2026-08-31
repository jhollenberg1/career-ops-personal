# Joshua's Career Search Operating System

This is a personal fork. It has no upstream update process and no public-project, multi-runtime, localization, batch, or LaTeX support.

## Data boundaries

Never overwrite personal data during workflow changes:

- `cv.md`, `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, `portals.yml`
- `data/*`, `reports/*`, `output/*`, `interview-prep/*`, `jds/*`

Put Joshua-specific targets, narrative, location policy, compensation preferences, and scoring preferences in `config/profile.yml` or `modes/_profile.md`, not `modes/_shared.md`.

## Active architecture

- Daily: scan tracked companies for newly posted roles, validate the JD, score the role, and create a Trello card only when it clears the threshold.
- Every three days, alternating: broad untracked role discovery; broad company discovery.
- `data/seen-companies.jsonl` prevents rediscovery. Rejected companies are skipped.
- `data/tracker-additions/` holds pending application-tracker TSVs. Run `node merge-tracker.mjs` after an evaluation creates one.

## Targeting

Prioritize forward-deployed, implementation, solutions architecture, technical consulting, technical program/project management, data strategy, and data strategist roles. Explore adjacent technical/data product, customer engineering, technical account/customer success engineering, consulting, selective software/data/analytics/platform roles.

Exclude generic operations, GTM, RevOps, partnerships, business development, sales, and seniority above the intended level (Staff, Principal, Director, Head, VP). Prioritize mission-driven technology and tangible-purpose companies; exclude defense, military, mass-surveillance, and DoD/intelligence-first work.

## Safety and quality

- Never submit an application without Joshua's explicit review and approval.
- Verify live postings with Playwright before recommending or carding them. A visible title, description, and apply action indicate an active role; navigation/footer text alone does not.
- Use cheap title, level, location, and eligibility filtering first. Then use the JD to assess fit and experience gaps. Surface only roles that clear the configured threshold.
- Do not add duplicate application entries. Use canonical states from `templates/states.yml`.

## Useful commands

- `npm run discover -- --no-queue` — scan tracked ATS sources without adding raw results to the pipeline.
- `npm run validate-postings -- URL...` — validate public job-detail URLs.
- `npm run merge` — merge pending application tracker TSVs.
- `npm run verify` — check application tracker integrity.
- `npm run pdf` — render an HTML resume to PDF.

## Mode routing

Read `modes/_shared.md` plus the applicable mode for `auto-pipeline`, `oferta`, `ofertas`, `pdf`, `contacto`, `apply`, `pipeline`, or `role-scan`. Other modes are standalone.

Core discovery modes: `role-scan`, `company-discovery`, and `populate-company-trello`. Application modes: `auto-pipeline`, `oferta`, `apply`, `pipeline`, `tracker`, and `pdf`.

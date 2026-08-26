# Mode: company-discovery — Find and score company prospects (weekly)

Finds promising employers and maintains the **🆕 New Targets** queue on the Company Targets
Trello board. It does not edit `portals.yml`, scan roles, or create Job Applications cards.
Moving a New Targets card to **📚 All Tracked** is Joshua's explicit approval to monitor that
company; `role-scan.md` owns importing approved cards into `portals.yml`.

## Inputs
- `portals.yml` → `discovery` (`stages_in_scope`, `funding_sources`, `discovery_queries`),
  `priority_policy`, and `tracked_companies` (dedupe only). Do not hardcode a different list.
- `config/profile.yml` → `narrative.target_sectors`, `narrative.excluded_sectors`, `narrative.excluded_companies`.
- `evals/rubric.md` → the authoritative company-fit rubric (1–5).
- The **Company Targets** Trello board (see `modes/populate-company-trello.md`) → dedupe
  against cards already in 🆕 New Targets and 📚 All Tracked.

## 1. Find candidate companies (cast wide — all sizes/stages)
Run `discovery.discovery_queries` plus your own variations via WebSearch, and skim
`aggregator_sources`, to find employers HIRING or newly funded in the target sectors. Include
every stage in `discovery.stages_in_scope`: newly-funded Series A–C startups AND established/large
companies, nonprofits, public-benefit corps, government-services firms. Aim for ~15–25 raw
candidates, weighted toward `priority_policy.high_priority_sectors`. Good signals: a recent funding
round in a target sector; a company already posting Implementation/Solutions/Deployment/Integration/
RevOps/Strategy&Ops/Partnerships roles; mission language matching `profile.yml` `target_sectors`.

## 2. Vet and score each candidate
- **Sector fit:** clearly in a target sector (HIGH or LOW priority both qualify; bias new adds toward HIGH-priority).
- **Exclusions:** NOT in `narrative.excluded_companies` and NOT in an `excluded_sectors` category (defense, military, mass surveillance, primarily DoD/IC revenue). When in doubt, exclude.
- **Location plausibility:** hires in NYC or hires remote (US). Skip strictly single-location-elsewhere with no remote.
- **Role plausibility:** plausibly hires 2–4yr client-facing/technical or ops/GTM roles.
- **Not already tracked or queued:** not already in `tracked_companies` or on either Company
  Targets list (case-insensitive normalized-name match).

Score every remaining candidate's `company_fit` using `evals/rubric.md`. Create or update a New
Targets card only for `company_fit` 4–5. Do not card hard exclusions or companies scoring 1–3.

## 3. Resolve each kept company's careers source (best effort — does not gate the card)
Find the live careers page / ATS board and record the provider so the sweep can fetch it:
- **Greenhouse** → `careers_url: https://job-boards.greenhouse.io/{token}` + `api: https://boards-api.greenhouse.io/v1/boards/{token}/jobs`
- **Lever** → `careers_url: https://jobs.lever.co/{token}`
- **Ashby** → `careers_url: https://jobs.ashbyhq.com/{token}` + `scan_method: ats_api`
- **Own site / unknown ATS** → `careers_url: <careers page>` + `scan_method: careers_page`

A `company_fit` of 4–5 is decided on the company itself, not on whether its careers page
resolves today. If you can confirm a working careers source, mark it `verified`. If you cannot
(dead link, no discoverable page, gated/unknown ATS), still keep the company: record the best
URL you found (or leave it blank) and mark it `needs resolution`. Do not drop a 4–5 company for
this reason — `role-scan.md`'s import step re-verifies the careers source anyway before it ever
reaches `portals.yml`.

## 4. Create or update New Targets

Pass every company scoring 4–5 to `modes/populate-company-trello.md` as a **New Target**,
whether or not its careers page verified in step 3. Include the company-fit score, rationale,
discovery summary, careers URL (or blank), the `verified` / `needs resolution` status, careers-page
check date, and source URL. This is the same card-creation path used by role-scan prospecting;
dedupe by normalized company name and preserve user notes.

Never add a New Targets company to `portals.yml`, move it to All Tracked, or create a Job
Applications card. Joshua alone promotes a candidate by manually moving its card to All Tracked.

## Report

Report in plain text (6–10 lines): raw candidates found; how many scored 4–5 and were added or
updated in New Targets (and how many of those are `needs resolution` on careers page); names +
sectors + company-fit scores; how many rejected and why (excluded sector, already tracked, hard
exclusion, fit below 4); and any overflow deferred to next week. No preamble.

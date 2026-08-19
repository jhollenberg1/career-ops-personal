# Mode: company-discovery — Grow the tracked-company universe (weekly)

GROWS the set of companies the role scan watches, so `modes/role-scan.md` stops depending on
a static list. This mode does **NOT** create Notion/Trello cards — it only expands
`tracked_companies` in `portals.yml` and then runs the zero-token board sweep. Carding is
`modes/role-scan.md` + `modes/populate-*.md`.

> **Discovery engine:** the cheap, zero-token board sweep is **`discover.mjs`** (`npm run discover`).
> This mode owns it: after new companies are added, it runs `discover.mjs` to pull their
> currently-open roles into `data/pipeline.md` for `role-scan.md` to score. `discover.mjs`
> never scores or cards — it only finds candidate roles at tracked companies.

## Inputs
- `portals.yml` → `discovery` (`stages_in_scope`, `funding_sources`, `discovery_queries`, `append_to`),
  `priority_policy` (`high_priority_sectors`, `low_priority_sectors`, `tier1_titles`, `tier2_titles`),
  `tracked_companies`, `aggregator_sources`. **These are the source of truth for tiering — do not hardcode a different list.**
- `config/profile.yml` → `narrative.target_sectors`, `narrative.excluded_sectors`, `narrative.excluded_companies`.

## 1. Find candidate companies (cast wide — all sizes/stages)
Run `discovery.discovery_queries` plus your own variations via WebSearch, and skim
`aggregator_sources`, to find employers HIRING or newly funded in the target sectors. Include
every stage in `discovery.stages_in_scope`: newly-funded Series A–C startups AND established/large
companies, nonprofits, public-benefit corps, government-services firms. Aim for ~15–25 raw
candidates, weighted toward `priority_policy.high_priority_sectors`. Good signals: a recent funding
round in a target sector; a company already posting Implementation/Solutions/Deployment/Integration/
RevOps/Strategy&Ops/Partnerships roles; mission language matching `profile.yml` `target_sectors`.

## 2. Vet each candidate (keep only if ALL hold)
- **Sector fit:** clearly in a target sector (HIGH or LOW priority both qualify; bias new adds toward HIGH-priority).
- **Exclusions:** NOT in `narrative.excluded_companies` and NOT in an `excluded_sectors` category (defense, military, mass surveillance, primarily DoD/IC revenue). When in doubt, exclude.
- **Location plausibility:** hires in NYC or hires remote (US). Skip strictly single-location-elsewhere with no remote.
- **Role plausibility:** plausibly hires 2–4yr client-facing/technical or ops/GTM roles.
- **Not already tracked:** not already in `tracked_companies` (case-insensitive name match).

## 3. Resolve each kept company's careers source
Find the live careers page / ATS board and record the provider so the sweep can fetch it:
- **Greenhouse** → `careers_url: https://job-boards.greenhouse.io/{token}` + `api: https://boards-api.greenhouse.io/v1/boards/{token}/jobs`
- **Lever** → `careers_url: https://jobs.lever.co/{token}`
- **Ashby** → `careers_url: https://jobs.ashbyhq.com/{token}` + `scan_method: websearch`
- **Own site / unknown ATS** → `careers_url: <careers page>` + `scan_method: websearch` + `scan_query: "{Company}" jobs "Implementation" OR "Solutions" OR "Operations" OR "Partnerships"`

Only keep a company if you can confirm a working careers source (no dead links).

## 4. Append to tracked_companies (edit portals.yml — safely)
Read `portals.yml`, **make a backup first** (`portals.yml.bak`), then insert new entries at the END
of the `tracked_companies:` block (before `aggregator_sources:`). Each entry: `name`, `careers_url`,
`api` (if Greenhouse), `scan_method: websearch` (if not a direct API), `scan_query` (if websearch),
`notes` (one line: sector + priority tier + stage + why it fits + "auto-discovered {today}"),
`enabled: true`. **Cap at 10 new companies per run**; note extras for next week. Preserve everything
else exactly (do NOT touch `title_filter`, `location_filter`, `priority_policy`, `search_queries`,
`aggregator_sources`, `discovery`, or existing companies). Re-read and confirm it still parses as
valid YAML; if not, restore from the backup and report the failure.

## 5. Sweep the boards (zero-token) — this is where discover.mjs is handled
Run `npm run discover` (`discover.mjs`). It reads the now-expanded `tracked_companies`, hits the
Greenhouse/Ashby/Lever APIs directly (zero Claude tokens), title-filters, dedups against
`data/scan-history.tsv`, and appends newly-open roles to `data/pipeline.md`. This seeds the pipeline
so the next `modes/role-scan.md` run scores the new companies' roles against the rubric. Companies
added with `scan_method: websearch` aren't covered by the API sweep — `role-scan.md`'s Playwright/
WebSearch levels pick those up.

## 6. Report (plain text, 6–10 lines)
Raw candidates found; how many passed vetting; names + sectors + priority tiers + stages of companies
added; how many rejected and why (excluded sector, already tracked, no working careers page); overflow
deferred to next week; and the `discover.mjs` sweep result (new roles appended to pipeline). No preamble.

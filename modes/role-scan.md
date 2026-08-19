# Mode: role-scan — Rubric-Scored Open-Role Scan

Scans configured job portals, filters by title relevance, scores each offer on job fit and mission fit, and adds new opportunities to the pipeline.

> **Note (v1.5+):** The default scanner (`discover.mjs` / `npm run discover`) is **zero-token** and queries Greenhouse, Ashby, and Lever public APIs directly. The Playwright/WebSearch levels described below are the **agent** flow (run by Claude/Codex), not what `discover.mjs` does. If a company has no Greenhouse/Ashby/Lever API, `discover.mjs` will skip it — the agent must cover those via Level 1 (Playwright) or Level 3 (WebSearch).

> **Inputs (authoritative — this mode MUST read all of them):**
> - `portals.yml` — tracked companies, title filters, search queries, seen-ledger config
> - `config/profile.yml` → `narrative.excluded_sectors` / `excluded_companies` — hard exclusions
> - `modes/_profile.md` → `## Scoring Models` / `## Your Values` — archetypes + mission filter
> - `evals/rubric.md` — the **authoritative scoring rubric** (v3.3, 1–10 bands)
>
> Every candidate surfaced by discovery is scored against `evals/rubric.md` **before** it is carded. Do not card a role that has not been scored. Cheap discovery (`discover.mjs`, board API sweep) only *finds* candidates; this mode *judges and surfaces* them.

## Recommended execution

Launch as a subagent to avoid consuming main context:

```
Agent(
    subagent_type="general-purpose",
    prompt="[content of this file + specific data]",
    run_in_background=True
)
```

## Configuration

Read `portals.yml` which contains:
- `search_queries`: WebSearch queries with `site:` filters per portal (broad discovery)
- `tracked_companies`: Specific companies with `careers_url` for direct navigation
- `title_filter`: positive/negative/seniority_boost keywords for title filtering

## Discovery strategy (3 levels)

### Level 1 — Direct Playwright (PRIMARY)

**For each company in `tracked_companies`:** Navigate to its `careers_url` with Playwright (`browser_navigate` + `browser_snapshot`), read ALL visible job listings, and extract the title + URL of each. This is the most reliable method because:
- Sees the page in real time (no Google-cached results)
- Works with SPAs (Ashby, Lever, Workday)
- Detects new offers immediately
- Does not depend on Google indexing

**Every company MUST have `careers_url` in portals.yml.** If missing, find it once, save it, and use it in future scans.

### Level 2 — ATS APIs / Feeds (SUPPLEMENTARY)

For companies with a public API or structured feed, use the JSON/XML response as a fast complement to Level 1. Faster than Playwright and avoids visual scraping errors.

**Supported platforms (variables in `{}`):**
- **Greenhouse**: `https://boards-api.greenhouse.io/v1/boards/{company}/jobs`
- **Ashby**: `https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams`
- **BambooHR**: list `https://{company}.bamboohr.com/careers/list`; detail `https://{company}.bamboohr.com/careers/{id}/detail`
- **Lever**: `https://api.lever.co/v0/postings/{company}?mode=json`
- **Teamtailor**: `https://{company}.teamtailor.com/jobs.rss`
- **Workday**: `https://{company}.{shard}.myworkdayjobs.com/wday/cxs/{company}/{site}/jobs`

**Parsing conventions by provider:**
- `greenhouse`: `jobs[]` → `title`, `absolute_url`
- `ashby`: GraphQL `ApiJobBoardWithTeams` with `organizationHostedJobsPageName={company}` → `jobBoard.jobPostings[]` (`title`, `id`; construct public URL if not in payload)
- `bamboohr`: list `result[]` → `jobOpeningName`, `id`; construct detail URL; for full JD, GET detail and use `result.jobOpening` fields (`jobOpeningName`, `description`, `compensation`, `jobOpeningShareUrl`)
- `lever`: root array `[]` → `text`, `hostedUrl` (fallback: `applyUrl`)
- `teamtailor`: RSS items → `title`, `link`
- `workday`: `jobPostings[]` → `title`, `externalPath` or URL constructed from host

### Level 3 — WebSearch queries (BROAD DISCOVERY)

`search_queries` with `site:` filters cover portals broadly (all Ashby, all Greenhouse, etc.). Useful for discovering NEW companies not yet in `tracked_companies`, but results may be stale.

**Execution priority:**
1. Level 1: Playwright → all `tracked_companies` with `careers_url`
2. Level 2: API → all `tracked_companies` with `api:`
3. Level 3: WebSearch → all `search_queries` with `enabled: true`

Levels are additive — run all, merge results, then deduplicate.

## Workflow

1. **Read configuration**: `portals.yml`
2. **Read history**: `data/scan-history.tsv` → already-seen URLs
3. **Read dedup sources**: `data/applications.md` + `data/pipeline.md`
4. **Read scoring rubrics**: `modes/_profile.md` → `## Scoring Models`

5. **Level 1 — Playwright scan** (parallel in batches of 3–5):
   For each company in `tracked_companies` with `enabled: true` and a defined `careers_url`:
   a. `browser_navigate` to `careers_url`
   b. `browser_snapshot` to read all job listings
   c. If the page has department filters, navigate relevant sections
   d. Extract from each listing: `{title, url, company}`
   e. If results are paginated, navigate additional pages
   f. Accumulate in candidate list
   g. If `careers_url` fails (404, redirect), try `scan_query` as fallback and note for URL update

6. **Level 2 — ATS APIs / feeds** (parallel):
   For each company in `tracked_companies` with `api:` defined and `enabled: true`:
   a. WebFetch the API/feed URL
   b. If `api_provider` is defined, use its parser; otherwise infer from domain
   c. For **Ashby**, send POST with:
      - `operationName: ApiJobBoardWithTeams`
      - `variables.organizationHostedJobsPageName: {company}`
      - GraphQL query for `jobBoardWithTeams` + `jobPostings { id title locationName employmentType compensationTierSummary }`
   d. For **BambooHR**, the list only has basic metadata. For each relevant item, GET the detail URL and extract the full JD from `result.jobOpening`. Use `jobOpeningShareUrl` as public URL if available.
   e. For **Workday**, POST `{"appliedFacets":{},"limit":20,"offset":0,"searchText":""}` and paginate by `offset` until exhausted
   f. Extract and normalize: `{title, url, company}`
   g. Accumulate in candidate list (dedup with Level 1)

7. **Level 3 — WebSearch queries** (parallel where possible):
   For each query in `search_queries` with `enabled: true`:
   a. Run WebSearch with the defined `query`
   b. From each result extract: `{title, url, company}`
      - **title**: from the result title (before " @ " or " | ")
      - **url**: result URL
      - **company**: after " @ " in the title, or extract from domain/path
   c. Accumulate in candidate list (dedup with Level 1+2)

8. **Filter by title** using `title_filter` from `portals.yml`:
   - At least 1 `positive` keyword must appear in the title (case-insensitive)
   - 0 `negative` keywords must appear
   - `seniority_boost` keywords raise priority but are not required

9. **Deduplicate** against 3 sources:
   - `scan-history.tsv` → exact URL already seen
   - `applications.md` → company + normalized role already evaluated
   - `pipeline.md` → exact URL already in pending or processed

10. **Verify liveness of Level 3 results** — BEFORE adding to pipeline:

    WebSearch results may be stale (Google caches for weeks or months). Verify with Playwright each new URL from Level 3. Levels 1 and 2 are real-time and do not need this check.

    For each new Level 3 URL (sequential — NEVER Playwright in parallel):
    a. `browser_navigate` to the URL
    b. `browser_snapshot` to read content
    c. Classify:
       - **Active**: job title visible + role description + Apply/Submit control in main content. Do not count generic header/navbar/footer text.
       - **Expired** (any of these signals):
         - Final URL contains `?error=true` (Greenhouse redirects closed offers this way)
         - Page contains: "job no longer available" / "no longer open" / "position has been filled" / "this job has expired" / "page not found"
         - Only navbar and footer visible, no JD content (content < ~300 chars)
    d. If expired: record in `scan-history.tsv` with status `skipped_expired` and discard
    e. If active: continue to step 11

    **Do not abort the scan if one URL fails.** On timeout, 403, or error: mark `skipped_expired` and continue.

11. **For each new verified offer**:

    a. **Enrich** (if the page was not already visited via Playwright in steps 5 or 10):
       - `browser_navigate` + `browser_snapshot` to the job URL
       - Extract:
         - **salary**: visible salary range ("$120k–$160k") or blank if not listed
         - **level**: seniority from title or JD (Senior / Lead / Manager / Mid / Associate / Junior)
         - **location**: remote / hybrid / on-site + city if listed
         - **job_description**: 1–2 sentence summary of what the person does day-to-day
         - **company_description**: 1-sentence company mission or description from the About section
         - **recruiter_contact**: name + email or LinkedIn if visible; blank if not
         - **years_experience_required**: minimum years required (e.g. "2", "5+", "0-2") — infer from JD
         - **tech_component**: degree of technical/data work required (high / medium / low)
         - **relationship_component**: degree of client or external stakeholder relationship work (high / medium / low)
         - **hard_requirements**: requirements the candidate genuinely does NOT meet (certs, licenses, domain expertise). Blank if none.
         - **sector_classification**: company sector for purpose/mission scoring
         - **glassdoor_rating**: the company's Glassdoor overall rating (fetch via web search; blank if unavailable) — the v3.3 culture signal

    b. **Score (v3.3)** using `modes/_profile.md` → `## Scoring Models` (authoritative source `evals/rubric.md`):

       Produce a single **match_score (1–10)** + a one-line **justification**. Bands: 1–3 reject · 4–7 needs review · 8–10 pass. Priority of levers: purpose/interest (biggest; "boring" is a real negative) > role fit (Tier-1a/mixed > strict SWE > adjacent) > attainability (dock PM ~2, dock pure-ops RevOps/GTM hard) > culture (Glassdoor: ≥4.0 lifts, <3.0 at non-mission abstains) > location preference > comp (secondary, interacts with mission; weak/no mission + low comp = pass). To score ≥6 a role must strongly match purpose/interest OR role fit.

       If the role hits a hard rule (excluded sector/company, non-NY on-site, comp entirely <$80k, YOE 6+/0-1, off-target function): score 1–3, record in scan-history with status `skipped_values` (for excluded companies) or `skipped_title`/etc as appropriate, and **do not add** to pipeline or CSV.

    c. **Surfacing gate (v3.3):** add to `pipeline.md` under "## Pending" only if it will be surfaced — surface EVERY role scoring **8–10**; if this run produced **zero** 8–10 roles, fall back to surfacing the **6–7** roles. Never surface ≤5 (record them in scan-history but do not add to Pending). Line format: `- [ ] {url} | {company} | {title} | score {n}/10 | GD {glassdoor}`
    d. Record in `scan-history.tsv`: `{url}\t{date}\t{query_name}\t{title}\t{company}\tadded` (use status `skipped_lowscore` for scored-but-≤5 roles so they're deduped next run)

12. **Title-filtered offers**: record in `scan-history.tsv` with status `skipped_title`
13. **Duplicate offers**: record with status `skipped_dup`
14. **Expired offers (Level 3)**: record with status `skipped_expired`
15. **Excluded offers (values)**: record with status `skipped_values`

16. **Export CSV** — write `output/scan-{YYYY-MM-DD}.csv` (create `output/` if it doesn't exist):

    Columns in this order (v3.3 — `glassdoor` and `justification` appended so existing positional readers still work):
    ```
    job_title,company,salary,level,location,job_description,company_description,recruiter_contact,job_link,job_fit,mission_fit,combined,glassdoor,justification
    ```

    - `combined`: the **v3.3 match_score (1–10 integer)** — this is the primary rank key now.
    - `job_fit`: optional role-fit sub-signal (1–5); `mission_fit`: optional purpose/interest sub-signal (1–5). Fill if useful, else leave blank — they no longer drive `combined`.
    - `glassdoor`: company Glassdoor overall rating (blank if unavailable).
    - `justification`: the one-line reason for the score.
    - Sort rows by `combined` descending.
    - Excluded / hard-rule offers (score 1–3) do NOT appear.

    Formatting:
    - First row: header
    - Fields with commas/quotes/newlines: wrap in double quotes, escape `"` as `""`
    - Blank if data not available — never "N/A" or "Unknown"
    - UTF-8 encoding

17. **Watchlist** — Companies with mission_fit = 5 but no currently matching open role:
    - Append a separate section at the end of the CSV: `company,mission_fit,notes,careers_url`
    - Include in the output summary under "WATCHLIST — High mission, no current match"

## Extracting title and company from WebSearch results

Results come in the format: `"Job Title @ Company"` or `"Job Title | Company"` or `"Job Title — Company"`.

Extraction patterns by portal:
- **Ashby**: `"Senior AI PM (Remote) @ EverAI"` → title: `Senior AI PM`, company: `EverAI`
- **Greenhouse**: `"AI Engineer at Anthropic"` → title: `AI Engineer`, company: `Anthropic`
- **Lever**: `"Product Manager - AI @ Temporal"` → title: `Product Manager - AI`, company: `Temporal`

Generic regex: `(.+?)(?:\s*[@|—–-]\s*|\s+at\s+)(.+?)$`

## Private URLs

If a URL is not publicly accessible:
1. Save the JD to `jds/{company}-{role-slug}.md`
2. Add to pipeline.md as: `- [ ] local:jds/{company}-{role-slug}.md | {company} | {title}`

## Scan History

`data/scan-history.tsv` tracks ALL seen URLs:

```
url	first_seen	portal	title	company	status
https://...	2026-02-10	Ashby — RevOps	RevOps Analyst	Acme	added
https://...	2026-02-10	Greenhouse — GTM	Junior Dev	BigCo	skipped_title
https://...	2026-02-10	Ashby — RevOps	RevOps Analyst	OldCo	skipped_dup
https://...	2026-02-10	WebSearch — GTM	Ops Manager	ClosedCo	skipped_expired
https://...	2026-02-10	Lever — Impl	Impl Engineer	DefenseCo	skipped_values
```

## Output summary

```
Portal Scan — {YYYY-MM-DD}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Queries run:               N
Offers found:              N total
Filtered by title:         N removed
Duplicates:                N skipped
Excluded (values):         N skipped
Expired:                   N skipped
New offers added:          N

Ranked Offers (v3.3 — 1–10 match score)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 #   Company                Role                          Score  GD    Why
 1   {company}              {title}                         9   4.2   {justification}
 2   {company}              {title}                         8   4.0   {justification}
 ...
Fallback day? {yes/no — only 6–7 surfaced because nothing scored 8–10}

WATCHLIST — High mission, no current match
  {company}  (mission: 5/5)  {careers_url}
  ...

CSV: output/scan-{YYYY-MM-DD}.csv
→ /career-ops pipeline to evaluate new offers.
```

## Managing careers_url

Every company in `tracked_companies` should have `careers_url` — the direct URL to its jobs page.

**RULE: Always use the company's own careers page; fall back to the ATS endpoint only if no corporate page exists.**

Using the direct ATS URL when a corporate page exists can cause false 410 errors because job IDs differ.

| ✅ Correct (corporate) | ❌ Incorrect as first choice (direct ATS) |
|---|---|
| `https://careers.mastercard.com` | `https://mastercard.wd1.myworkdayjobs.com` |
| `https://openai.com/careers` | `https://job-boards.greenhouse.io/openai` |
| `https://stripe.com/jobs` | `https://jobs.lever.co/stripe` |

**Known platform patterns:**
- **Ashby:** `https://jobs.ashbyhq.com/{slug}`
- **Greenhouse:** `https://job-boards.greenhouse.io/{slug}` or `https://job-boards.eu.greenhouse.io/{slug}`
- **Lever:** `https://jobs.lever.co/{slug}`
- **BambooHR:** list `https://{company}.bamboohr.com/careers/list`; detail `https://{company}.bamboohr.com/careers/{id}/detail`
- **Teamtailor:** `https://{company}.teamtailor.com/jobs`
- **Workday:** `https://{company}.{shard}.myworkdayjobs.com/{site}`

**Known API/feed patterns:**
- **Ashby API:** `https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams`
- **BambooHR API:** list then detail (`result.jobOpening`)
- **Lever API:** `https://api.lever.co/v0/postings/{company}?mode=json`
- **Teamtailor RSS:** `https://{company}.teamtailor.com/jobs.rss`
- **Workday API:** `https://{company}.{shard}.myworkdayjobs.com/wday/cxs/{company}/{site}/jobs`

**If `careers_url` is missing:**
1. Try the known platform pattern
2. If that fails, WebSearch `"{company}" careers jobs`
3. Confirm with Playwright
4. **Save the URL in portals.yml**

**If `careers_url` returns 404 or redirects:**
1. Note it in the output summary
2. Try `scan_query` as fallback
3. Flag for manual update

## Maintaining portals.yml

- **Always save `careers_url`** when adding a new company
- Add queries as new portals or target roles are discovered
- Disable noisy queries with `enabled: false`
- Adjust title keywords as target roles evolve
- Add companies to `tracked_companies` when you want to monitor them closely
- Periodically verify `careers_url` — companies change ATS platforms


## 18. Hand off to populate (card the surfaced roles)

This mode produces the ranked, rubric-scored roles (the 8–10 set, or the 6–7 fallback) and the CSV. It does **not** talk to Notion or Trello directly. After surfacing:

- Pass the surfaced roles to **`modes/populate-trello.md`** to create/update cards on the job-search board.
- If dual-writing, also pass them to **`modes/populate-notion.md`**.

Only roles that passed the surfacing gate (step 11c) are handed off. Excluded / low-score roles are recorded in the ledger and never carded. The populate mode owns all board-specific field mapping and dedup-against-board logic, so no carding logic lives outside the repo.

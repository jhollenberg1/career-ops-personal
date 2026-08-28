# Mode: role-scan — Rubric-Scored Open-Role Scan

Scans configured job portals, filters by title relevance, applies the v5 rubric, and hands surfaced opportunities to the board-population modes.

> **Note (v1.5+):** The default scanner (`discover.mjs` / `npm run discover`) is **zero-token** and queries Greenhouse, Ashby, and Lever public APIs directly. The Playwright/WebSearch levels described below are the **agent** flow (run by Claude/Codex), not what `discover.mjs` does. If a company has no supported API, the agent reads its official careers page in Level 1. WebSearch also has a prospecting lane for live roles at untracked companies; it must validate the official role page before it can surface a role.

> **Inputs (authoritative — this mode MUST read all of them):**
> - `portals.yml` — tracked companies, title filters, search queries, seen-ledger config
> - `config/profile.yml` → `narrative.excluded_sectors` / `excluded_companies` — hard exclusions
> - `modes/_profile.md` → `## Your Target Roles` / `## Your Values` — user context only
> - `evals/rubric.md` — the **authoritative scoring rubric** (v5: company fit 1–5 and role match 1–10)
> - `data/seen-postings.jsonl` — the authoritative posting-level dedupe ledger
> - Company Targets Trello board → **📚 All Tracked** is the approval queue for additions to
>   `portals.yml`; **🆕 New Targets** is not scanned
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
- `search_queries`: WebSearch queries for prospecting roles outside the tracked-company watchlist
- `tracked_companies`: Specific companies with `careers_url` for direct navigation
- `title_filter`: positive/negative/seniority_boost keywords for title filtering

## Discovery strategy (3 levels)

### Level 1 — Direct Playwright (PRIMARY)

**For each company in the active watchlist:** Navigate to its `careers_url` with Playwright (`browser_navigate` + `browser_snapshot`), read visible job listings, and extract the title + URL of each. Use the rotation/full list only in a weekly run or when discovery is thin. This is the most reliable method because:
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

### Level 3 — WebSearch prospecting (UNTRACKED COMPANIES)

WebSearch finds promising roles outside the watchlist. Search-result snippets, Reddit,
LinkedIn, and aggregators are leads only: resolve each lead to the employer's official careers
page and exact public job-detail URL before treating it as a candidate.

**Execution priority:**
1. Level 1: Playwright → all `tracked_companies` with `careers_url`
2. Level 2: API → all `tracked_companies` with `api:`
3. Level 3: WebSearch → promising roles at untracked companies, then official-page validation

Levels are additive — run all, merge results, then deduplicate.

## Workflow

1. **Import approved targets**: Read every card in Company Targets **📚 All Tracked**. For each
   normalized company name not already enabled in `portals.yml`, validate the card's official
   `Careers:` URL with Playwright. If it works, add one enabled `tracked_companies` entry with
   `name`, `careers_url`, inferred API/`scan_method`, and a concise `notes` value copied from
   the card; validate the YAML after editing. If it does not work, leave the card in All Tracked,
   mark its careers source `needs resolution`, and report it—do not add a guessed URL. Never
   import 🆕 New Targets: moving a card into All Tracked is the user's approval signal.
2. **Read configuration**: `portals.yml`
3. **Read the candidate queue**: `data/pipeline.md` → every unprocessed pending URL is an input candidate to score, not a duplicate to discard. Seed the candidate list with these entries before running new discovery.
4. **Read the dedupe ledger**: `data/seen-postings.jsonl` → use the latest record for each URL (and secondarily company + normalized role). This is the authoritative posting-level dedupe source; apply its re-check windows from `portals.yml`.
5. **Read evaluated applications**: `data/applications.md` → do not re-evaluate a company + normalized role that has already reached an application decision.
6. **Read scoring rubric**: `evals/rubric.md`. Use `_profile.md` only for narrative context not already captured by the rubric.

7. **Level 1 — Playwright scan** (sequential):
   For each enabled active-watchlist company with a defined `careers_url`:
   a. `browser_navigate` to `careers_url`
   b. `browser_snapshot` to read all job listings
   c. If the page has department filters, navigate relevant sections
   d. Extract from each listing: `{title, detail_url, company, official_careers_url}`
   e. If results are paginated, navigate additional pages
   f. Accumulate in candidate list
   g. If `careers_url` fails (404, redirect), use WebSearch only to locate a replacement
      official careers page, then note the source for a `portals.yml` update. Do not use it
      to enumerate roles.

8. **Level 2 — ATS APIs / feeds** (parallel):
   For each company in `tracked_companies` with a configured API or recognized official
   ATS board, and `enabled: true`:
   a. WebFetch the API/feed URL
   b. If `api_provider` is defined, use its parser; otherwise infer from domain
   c. For **Ashby**, send POST with:
      - `operationName: ApiJobBoardWithTeams`
      - `variables.organizationHostedJobsPageName: {company}`
      - GraphQL query for `jobBoardWithTeams` + `jobPostings { id title locationName employmentType compensationTierSummary }`
   d. For **BambooHR**, the list only has basic metadata. For each relevant item, GET the detail URL and extract the full JD from `result.jobOpening`. Use `jobOpeningShareUrl` as public URL if available.
   e. For **Workday**, POST `{"appliedFacets":{},"limit":20,"offset":0,"searchText":""}` and paginate by `offset` until exhausted
   f. Extract and normalize: `{title, detail_url, company, official_careers_url}`
   g. Accumulate in candidate list (dedup with Level 1)

9. **Level 3 — WebSearch prospecting** (parallel where possible):
   For each query in `search_queries` with `enabled: true`:
   a. Run WebSearch with the defined `query`.
   b. Extract a prospective role, company, and the exact official job-detail URL. Resolve the
      employer's official careers page or ATS board. Do not use Reddit, LinkedIn, job
      aggregators, or a search snippet as a careers or job source.
   c. Add the role to the candidate list only with both an official careers URL and exact public
      job-detail URL. Keep the search-result URL only as provenance.
   d. Process it through the same title filter, dedupe, exact-detail validation, enrichment, and
      rubric scoring as tracked-company roles. The company is still untracked: do not add it to
      `portals.yml` or move its Company Targets card to All Tracked.

10. **Filter by title** using `title_filter` from `portals.yml`:
   - At least 1 `positive` keyword must appear in the title (case-insensitive)
   - 0 `negative` keywords must appear
   - `seniority_boost` keywords raise priority but are not required

11. **Deduplicate and merge candidates**:
   - `seen-postings.jsonl` is authoritative. Skip `carded` URLs always; skip `closed` and `rejected-guardrail` URLs only while within their configured re-check window; skip `dedup` URLs while the matching board record remains present.
   - Skip company + normalized-role matches that are already evaluated in `applications.md`.
   - An unprocessed URL already in `pipeline.md` is **not** a duplicate: it is an input candidate. If the same URL appears again from a board/API/search level, merge its metadata into one candidate and score it once.
   - `scan-history.tsv` is observability only. Never use an `added` history row by itself to suppress a candidate that has not yet been scored and resolved in the ledger.

12. **Validate every role candidate** — immediately before scoring:

    APIs, saved pipeline entries, and direct careers boards are discovery sources, not
    proof that a particular requisition remains open. Run the exact public job-detail URLs
    through the shared validator in one batch:

    ```bash
    npm run validate-postings -- <url-1> <url-2> ...
    ```

    A role may continue only when its JSON result is `"result": "active"`. Set `detail_url`
    to the validator's `finalUrl`, and retain `official_careers_url`, `finalUrl`, and
    `checkedAt` in the handoff. For `expired`, `uncertain`, timeout,
    or error results, append a `closed` record to `data/seen-postings.jsonl` and do not
    score, enrich, or card the role.

13. **For each validated offer**:

    a. **Enrich** (if the page was not already visited via Playwright in steps 7 or 12):
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
         - **sector_classification**: company sector for mission-bonus and ethics assessment
         - **culture_evidence**: employee-review rating if readily available, plus review volume, review recency, and recurring themes about leadership, workload, and psychological safety. Record the source(s) and whether the evidence is positive, negative, or insufficient.
         - **glassdoor_rating**: company rating if readily available; blank if unavailable. It is supporting context, not a gate by itself.

    b. **Score using `evals/rubric.md` v5 (the sole scoring specification):** produce
       `company_fit` (1–5), company disposition and rationale, plus `match_score` (1–10),
       role rationale, and a `fit_summary`: one plain-English sentence explaining why this
       role earned its score and naming its main caveat. The `fit_summary` is required in
       the Trello handoff for every surfaced role. Do not use the legacy blended `job_fit`/`mission_fit` model,
       `scan-history.tsv`, or `modes/_profile.md` as scoring specifications.
       Mission alignment is a positive signal, not a requirement: do not cap a viable role because a company is commercial or outside the target sectors. For an outside-sector company, include the culture-evidence conclusion in the company rationale. If culture evidence is insufficient, set the role disposition to `Needs review` rather than rejecting it solely for that reason; affirmative negative culture evidence lowers company fit and may prevent surfacing.

    c. **Apply the v5 routing rules.** For an untracked company from Level 3 with `company_fit`
       4–5, hand it to the Company Targets workflow as a **New Target** even if the role does
       not pass, and even if the company's own careers page could not be confirmed (card it
       `needs resolution` in that case — see `modes/populate-company-trello.md`). This is
       independent of the role gate below: a validated role always still needs its own verified
       official careers page before it can be carded to Job Applications. Include the validated
       role as the Current-role signal and reuse the company-discovery card fields: company-fit
       score and rationale, discovery summary, careers URL (or `needs resolution`), review date,
       and provenance. For an already tracked company, update its existing All Tracked card instead.
       Apply the role surfacing gate independently: an active role scoring 8–10, or 6–7 only on a
       fallback day, is handed to Job Applications even though its company remains a New Target.
       `pipeline.md` is the candidate queue, not the dedupe
       authority and not a second board: do not append a duplicate line for a queued role.
    d. Record the resolution in `data/seen-postings.jsonl`: `carded` after the board handoff; `closed` for expired postings; `rejected-guardrail` for hard-rule failures; and `rejected-lowscore` for scored-but-unsurfaced candidates. Append only; latest record wins. Also retain `scan-history.tsv` as a lightweight audit log.

14. **Title-filtered offers**: record in `scan-history.tsv` with status `skipped_title`
15. **Duplicate offers**: record with status `skipped_dup`
16. **Expired offers (Level 3)**: record with status `skipped_expired`
17. **Excluded offers (values)**: record with status `skipped_values`

18. **Export CSV** — write `output/scan-{YYYY-MM-DD}.csv` (create `output/` if it doesn't exist):

    Columns in this order:
    ```
    job_title,company,salary,level,location,job_description,company_description,recruiter_contact,job_link,job_fit,mission_fit,combined,glassdoor,justification
    ```

    - `combined`: the v5 **match_score (1–10 integer)** — the primary rank key.
    - `job_fit` and `mission_fit`: legacy columns retained only for CSV compatibility; leave blank.
    - `glassdoor`: company Glassdoor overall rating (blank if unavailable).
    - `justification`: the one-line role rationale. Company fit is reported in the scan summary and Company Targets handoff.
    - Sort rows by `combined` descending.
    - Excluded / hard-rule offers (score 1–3) do NOT appear.

    Formatting:
    - First row: header
    - Fields with commas/quotes/newlines: wrap in double quotes, escape `"` as `""`
    - Blank if data not available — never "N/A" or "Unknown"
    - UTF-8 encoding

19. **Company Targets handoff** — untracked companies with `company_fit` 4–5:
    - Pass them to `modes/populate-company-trello.md` as **New Targets**, whether or not a
      current role passes and whether or not their careers page could be confirmed (card
      `needs resolution` rather than skipping). Never automatically promote them to All Tracked
      or add them to `portals.yml`. For tracked companies, update the existing All Tracked card only.
    - Include them in the output summary under "COMPANY TARGETS — high company fit".

## Handling WebSearch prospecting results

Use a search result only as a lead. Resolve it to the company's official careers page and exact
public job-detail URL before validation. If the detail URL validates `active`, score and route the
role normally; a surfaced role may create a Job Applications card and a separate New Targets card.
If validation is `expired`, `uncertain`, times out, or errors, append a `closed` record to
`data/seen-postings.jsonl`; do not score, enrich, create either card, or use the search snippet as
evidence. Private URLs are `unverified` and are likewise not eligible for automated carding.

## Private URLs

If a URL is not publicly accessible, record it as `unverified` and do not score or card it.
The user may supply the JD directly for a separate, manual evaluation, but it is not eligible
for automated role surfacing.

## Scan History

`data/scan-history.tsv` is an optional audit log; it is not a dedupe or decision source.

```
url	first_seen	portal	title	company	status
https://...	2026-02-10	Ashby — Implementation	Implementation Engineer	Acme	card-candidate
https://...	2026-02-10	Greenhouse — Technical PM	Junior Engineer	BigCo	skipped_title
https://...	2026-02-10	Careers page	Technical Consultant	ClosedCo	closed
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

Ranked Offers (v5 — 1–10 role match score)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 #   Company                Role                          Score  GD    Why
 1   {company}              {title}                         9   4.2   {justification}
 2   {company}              {title}                         8   4.0   {justification}
 ...
Fallback day? {yes/no — only 6–7 surfaced because nothing scored 8–10}

COMPANY TARGETS — high company fit
  {company}  Company fit {1–5}  {careers_url}  {company_rationale}
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
2. If that fails, WebSearch `"{company}" careers` to locate the official page
3. Confirm with Playwright
4. **Save the URL in portals.yml**

**If `careers_url` returns 404 or redirects:**
1. Note it in the output summary
2. Flag for manual update; do not use search results to enumerate roles

## Maintaining portals.yml

- **Always save `careers_url`** when adding a new company
- Add web-search queries only for company and official-careers-page discovery
- Disable noisy company-discovery queries with `enabled: false`
- Adjust title keywords as target roles evolve
- Add companies to `tracked_companies` when you want to monitor them closely
- Periodically verify `careers_url` — companies change ATS platforms


## 18. Hand off to populate (card the surfaced roles)

This mode produces the ranked, rubric-scored roles (the 8–10 set, or the 6–7 fallback) and the CSV. It does **not** talk to Notion or Trello directly. After surfacing:

- Pass the surfaced roles, including `match_score` and required `fit_summary`, to
  **`modes/populate-trello.md`** to create/update cards on the job-search board.
- Pass untracked prospecting companies with `company_fit` 4–5 to
  **`modes/populate-company-trello.md`** as New Targets; update existing All Tracked cards for
  tracked companies.
- If dual-writing, also pass them to **`modes/populate-notion.md`**.

Only roles with an `active` validation result and that passed the surfacing gate are handed
off. Excluded, closed, unverified, and low-score roles are recorded in the ledger and never
carded. The populate mode owns all board-specific field mapping and dedup-against-board logic,
so no carding logic lives outside the repo.

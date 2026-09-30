# Mode: role-scan — Rubric-Scored Open-Role Scan

Scans configured job portals, filters by title relevance, applies the v6 rubric, and hands surfaced opportunities to the board-population modes.

> **Note (v1.5+):** The default scanner (`discover.mjs` / `npm run discover`) is **zero-token** and queries Greenhouse, Ashby, and Lever public APIs directly. The Playwright/WebSearch levels described below are the **agent** flow (run by Claude/Codex), not what `discover.mjs` does. If a company has no supported API, the agent reads its official careers page in Level 1. WebSearch also has a prospecting lane for live roles at untracked companies; it must validate the official role page before it can surface a role.

> **Inputs (authoritative — this mode MUST read all of them):**
> - `portals.yml` — tracked companies, Core/Explore title filters, search queries, seen-ledger config
> - `config/profile.yml` → `narrative.excluded_sectors` / `excluded_companies` — hard exclusions
> - `modes/_profile.md` → `## Your Target Roles` / `## Your Values` — user context only
> - `resume/skills-inventory.md` — candidate-confirmed capabilities for JD scoring only; not resume-rewrite evidence
> - `evals/rubric.md` — the **authoritative scoring rubric** (v6.3: title base plus four adjustments)
> - `evals/title-bases.json` — approved title bases, applied by `scanner/route.mjs`
> - `data/seen-postings.jsonl` — the authoritative posting-level dedupe ledger
> - Company Targets Trello board → **📚 All Tracked** is the approval queue for additions to
>   `portals.yml`; **🆕 New Targets** is not scanned. **🚫 Rejected / Do Not Track** is the
>   company-level exclusion list for untracked-role prospecting; **🗄️ Archived** is not.
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

## Capability-aware execution — required for scheduled runs

This mode is an **agent** workflow. It must run Level 1, Level 2, and Level 3; a zero-token
CLI scan alone is never a complete role scan because it cannot perform WebSearch prospecting.

1. First try the repo scripts when Bash has outbound network access: `npm run discover` for a
   daily watchlist scan, or `npm run discover:all` for an explicitly requested full sweep; use
   `npm run validate-postings -- <url-1> ...` for exact URL validation.
2. If Bash reports DNS, domain, sandbox, or outbound-network failure, **continue rather than
   stopping**. Use the agent's real network-capable browser, WebSearch, and official ATS API
   tools for Levels 1–3 and exact public-detail validation. This is the required path for a
   restricted scheduled-agent shell; it is not permission to invent results or skip the ledger,
   title filter, location filter, dedupe, or rubric.
3. Record the execution path in the summary: `Bash scripts`, `tool-backed fallback`, or `mixed`.
   State any source that could not be reached. Never claim the CLI scanner or validator ran if
   it did not.

For a full role scan, the agent must run every enabled `search_queries` entry even if the CLI
scanner is unavailable. Those queries are the untracked-company lane and are additive to the
watchlist/API results.

## Configuration

Read `portals.yml` which contains:
- `search_queries`: WebSearch queries for prospecting roles outside the tracked-company watchlist
- `tracked_companies`: Specific companies with `careers_url` for direct navigation
- `title_filter`: positive/negative/seniority_boost keywords for title filtering

## Discovery strategy (3 levels)

### Level 1 — Direct Playwright (PRIMARY for non-API sources)

**Respect `scan_method`:** `ats_api` sources are scanned cheaply through their verified
structured endpoint; `careers_page` sources are navigated with Playwright; `websearch`
sources use their `scan_query` only as a lead. A scan-query result must still resolve to an
official careers or job-detail page. Never infer an API from an ATS-looking URL when the record
has a different `scan_method`.

For daily tracked monitoring, scan every enabled `ats_api` source and a rotating, recorded slice
of `careers_page` sources. For the longer tracked sweep, navigate every enabled `careers_page`
source and run every enabled tracked-company `scan_query`. This is the most reliable method because:
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
1. Level 1: Playwright → `careers_page` sources (daily rotation or full sweep)
2. Level 2: API → every enabled `ats_api` source
3. Level 3: WebSearch → promising roles at untracked companies, then official-page validation

Levels are additive — run all, merge results, then deduplicate.

## Workflow

1. **Reconcile the company watchlist and import approved targets**: Read every card in Company
   Targets **📚 All Tracked**, **🗄️ Archived**, and **🚫 Rejected / Do Not Track**. Disable
   any `portals.yml` `tracked_companies` entry whose normalized company is no longer in All
   Tracked; this stops monitoring after Joshua archives or rejects a company. Synchronize the
   normalized name/domain of every Rejected card to `data/seen-companies.jsonl` with
   `status: "rejected"`. Do not use Archived as a role-prospecting exclusion. For each
   normalized All Tracked company not already enabled in `portals.yml`, validate the card's
   official `Careers:` URL with Playwright. If it works, add one enabled `tracked_companies`
   entry with `name`, `careers_url`, inferred API/`scan_method`, and a concise `notes` value
   copied from the card; validate the YAML after editing. If it does not work, leave the card in
   All Tracked, mark its careers source `needs resolution`, and report it—do not add a guessed
   URL. Never import 🆕 New Targets: moving a card into All Tracked is the user's approval signal.
2. **Read configuration**: `portals.yml`
3. **Synchronize user-resolved Trello roles before discovery:** Read the Job Applications
   board's **🗄️ Archived / No Apply** and **🚫 Rejected / Closed** lists and search the same
   board for legacy archived cards (`is:archived`). Save every card as
   `{list, name, desc, archived}` in one JSON array and run:

   ```bash
   npm run scan:record -- user-resolved <cards.json>
   ```

   The script maps the lists to `not-applying-user`, `rejected-user`, and `archived-user`,
   takes the JD URL from `Link:` or `Job link:`, records a company + role suppression for a card
   with no link, ignores instruction cards, and skips cards already recorded. These are permanent
   suppressions unless Joshua restores the card. Report any unlinked cards it lists so they can
   be repaired.
4. **Read scoring rubric**: `evals/rubric.md` and `evals/title-bases.json`. Use `_profile.md`
   only for narrative context not already captured by the rubric.

5. **Level 1 — careers-page scan** (sequential):
   For each selected enabled `careers_page` company with a defined `careers_url`:
   a. `browser_navigate` to `careers_url`
   b. `browser_snapshot` to read all job listings
   c. If the page has department filters, navigate relevant sections
   d. Extract from each listing: `{title, url, company, official_careers_url, location}`
   e. If results are paginated, navigate additional pages
   f. Append each listing to `output/scans/leads-{YYYY-MM-DD}.json` with `source: "careers_page"`
   g. If `careers_url` fails (404, redirect), use WebSearch only to locate a replacement
      official careers page, then note the source for a `portals.yml` update. Do not use it
      to enumerate roles.

6. **Level 2 — ATS APIs**: `npm run discover -- --no-queue` reads every enabled `ats_api`
   source and writes a scan report to `output/scans/`. Only when Bash has no network, read the
   same endpoints with WebFetch (see "Known API/feed patterns" below) and append the postings to
   the leads file with `source: "ats-api"`.

7. **Level 3 — WebSearch** (parallel where possible):
   First run every selected tracked-company `scan_query` for enabled `websearch` sources.
   Then run every `search_queries` entry with `enabled: true`.
   a. Run WebSearch with the defined `query`.
   b. Extract a prospective role, company, and the exact official job-detail URL. Resolve the
      employer's official careers page or ATS board. Do not use Reddit, LinkedIn, job
      aggregators, or a search snippet as a careers or job source.
   c. Append `{title, company, url, official_careers_url, location, domain, provenance_url,
      source: "websearch"}` to the leads file. Keep the search-result URL only as
      `provenance_url`. The company stays untracked: do not add it to `portals.yml` or move its
      Company Targets card to All Tracked.

8. **Screen candidates** with one command. Do not filter, dedupe, or validate by hand:

   ```bash
   npm run scan:candidates -- --leads output/scans/leads-{YYYY-MM-DD}.json \
     --scan-report output/scans/{discover-report}.json --pipeline
   ```

   The script applies company exclusions (`rejected` in `data/seen-companies.jsonl` and
   `excluded_companies` in `config/profile.yml`; `archived` companies stay eligible), the
   `title_filter` (not applied to user-supplied `pipeline.md` URLs), the `location_filter`, the
   `seen-postings.jsonl` ledger with its re-check windows, and earlier decisions on the same
   role at the same company. For earlier decisions it compares the core role with seniority,
   location, and posting noise removed: a role Joshua rejected, marked no-apply, or archived
   suppresses the same role at equal or higher seniority, and a less senior posting continues
   with a `related` note; a carded or `applications.md` role suppresses only an identical
   repost. It merges duplicate URLs across levels, requires
   an official careers URL for every non-pipeline lead, validates the rest with the shared
   Playwright validator, appends `closed` for failed validation, and logs skips to
   `scan-history.tsv`. Only its `active` list continues. When Bash has no network, pass
   `--no-verify`, validate each URL with the browser tool, and say so in the summary.

9. **Match the title, then enrich and score each active candidate.** This is the only model
   judgment in the scan. Start from the candidate object in the `active` list.

   a. **Title match first.** Read the JD's day-to-day responsibilities and set
      `title_base_match` to one exact name from `evals/title-bases.json`, or `null`. Decide
      this before assessing Joshua's fit, and without regard to the score it would lead to.
      - `null` is the expected result. Most roles are not one of these jobs, and a rejection
        here costs Joshua nothing because he reviews only surfaced roles.
      - Match only when the primary work is the same as that title's usual work: the same
        kind of deliverable for the same kind of customer or stakeholder. Shared words in the
        title are not evidence. A role that is mostly something else with some of that work is
        not a match. For example, a Software Engineer on an integrations team who builds
        internal connectors is not an Integration Engineer, and a Customer Support Engineer
        answering tickets is not a Customer Engineer.
      - A different title for the same job is a match: a "Forward Deployed Software Engineer"
        whose job is embedding with customers to deploy the product is a Forward Deployed
        Engineer.
      - When unsure, choose `null`. When two entries fit, choose the one whose work matches
        most closely, not the one with the higher base.
      - A posting title that already contains an approved title is matched in code, and this
        field is ignored.

      If `title_base_match` is `null`, stop. Record only `title_base_match` and, for an
      untracked company, `company_fit` and `company_rationale`, since company routing still
      needs them. The route rejects the role.

   b. **Enrich** from the JD page: `salary`, `level`, `location`, `job_description` (1–2
      sentences on day-to-day work), `company_description`, `recruiter_contact`, `glassdoor`,
      `sector`, and culture evidence (rating, review volume and recency, recurring themes,
      sources).

   c. **Score** from `evals/rubric.md`: `hard_gate` (`Pass` or `Reject`) with
      `hard_gate_reason`; `adjustments` `{role_shape, qualification, company, salary}` at one
      decimal; `adjustment_rationale` when any value is outside its default range;
      `company_fit` (1.0–5.0) and `company_rationale`; `fit_summary`, one plain-English sentence
      on why the role earned its score naming its main caveat; and `justification` naming
      material gaps. When the candidate has a `related` note, weigh the earlier decision
      it describes.

   Build the evidence ledger before assigning gates or adjustments. Compare only stated
      requirements with `cv.md`, `article-digest.md`, and `resume/skills-inventory.md`; separate
   credible transferable experience from hard gaps; and never infer an unstated requirement from
   the title. Mission alignment is a positive signal, not a requirement. Assess mission
   relatability and practical human benefit; apply the configured `-0.2` to `-1.0`
   low-relatability deduction to both `company` and `company_fit` only when a deeply technical,
   compliance, security, or internal-administration product lacks a concrete human, customer, or
   public benefit that a nontechnical person could understand. Explain it in
   `company_rationale`. Insufficient culture evidence is `0.0`, not a penalty. Do not assign a
   base value or a total: the route step
   computes both. Write the array to `output/scans/scored-{YYYY-MM-DD}.json`.

10. **Route** with one command. Run it with `--dry-run` first, since a real run appends to the
    ledgers:

    ```bash
    npm run scan:route -- output/scans/scored-{YYYY-MM-DD}.json
    ```

    The script takes the title base from the posting title or `title_base_match`, rejects a role
    with neither, applies the salary-floor and rejected-company hard gates,
    calculates `total_score`, and surfaces 8.0+ roles, or 6.0–7.9 roles when nothing scored 8.0+.
    It enforces the populate-trello handoff contract (active validation no more than 10 minutes
    old, `finalUrl`, official careers URL, `fit_summary`) and routes companies: untracked
    `company_fit` 4.0+ becomes a New Target, a tracked company gets an All Tracked update, and an
    archived or rejected company gets no company card. It appends `closed`, `unverified`,
    `rejected-guardrail`, and `rejected-lowscore` records, writes `output/scan-{YYYY-MM-DD}.csv`,
    prints the ranked summary, and writes `output/scans/handoff-*.json` with prebuilt Trello card
    text. Act on its report:
    - **Needs revalidation:** rerun step 8 on those URLs, then route only those roles.
    - **Warnings:** fix the scored file (for example, a missing `adjustment_rationale`) and rerun
      only the affected roles.

11. **Hand off to the boards.** Pass the handoff `roles` to `modes/populate-trello.md` and use
    each `card.name`, `card.description`, and `card.label` as written. Pass the handoff
    `companies` to `modes/populate-company-trello.md`. Never promote a New Target to All
    Tracked or add it to `portals.yml`. After the cards exist, record them:

    ```bash
    npm run scan:record -- carded output/scans/handoff-{timestamp}.json [url ...]
    ```

    List URLs only when some cards were not created.

## Private URLs

A URL that is not publicly accessible fails validation in step 8 and is never scored or carded.
The user may supply the JD directly for a separate, manual evaluation, but it is not eligible
for automated role surfacing.

## Scan History

`data/scan-history.tsv` is an audit log written by the scripts. It is not a dedupe or decision
source.

## Output summary

Combine the printed summaries of `discover`, `scan:candidates`, and `scan:route`. Add the
execution path (`Bash scripts`, `tool-backed fallback`, or `mixed`), the number of WebSearch
queries run, any source that could not be reached, and the paths of the CSV and handoff file.

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

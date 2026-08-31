# Career-Ops System Map

## Default job-search path

```text
Company discovery → company novelty/rejection ledger → Company Targets: New Targets (company fit 4–5)
  → Joshua manually moves a target to All Tracked → role scan verifies careers page → portals.yml
  → discover.mjs (daily watchlist / weekly --all)
  → exact job-detail validation → modes/role-scan.md (rubric)
  → modes/populate-trello.md
  → data/seen-postings.jsonl (posting resolution ledger)

WebSearch prospecting in role scan may also find an untracked live role. After exact official-page
validation it can surface the role to Job Applications and create a separate New Targets company
card; only Joshua's later move to All Tracked adds that company to the watchlist.

`modes/populate-notion.md` is an optional dual-write integration, not part of the default scan
handoff.
```

### State ownership

| File | Role |
|---|---|
| `data/pipeline.md` | User-supplied or explicitly deferred candidate queue; never a dedupe authority. |
| `data/seen-postings.jsonl` | Authoritative posting-level resolution and recheck state. |
| `data/seen-companies.jsonl` | Company-level `new_target`, `tracked`, and `rejected` status ledger. |
| `data/scan-history.tsv` | Optional discovery audit log only. |
| `data/applications.md` | Application-stage tracker after a candidate becomes an application. |

### Scores

| Score | Used for |
|---|---|
| `match_score` (1–10) | Role discovery and board surfacing. Defined by `evals/rubric.md`. |
| `application_score` (1–5) | Detailed offer/application evaluation reports and the legacy tracker. |

Do not compare or average these scores. They answer different questions.

## Scan scopes

- `npm run discover` scans enabled `ats_api` tracked sources only. Add `--no-queue` for an automated score-before-card run.
- `npm run discover:all` performs the broader weekly API sweep.
- Every role path must validate the exact public detail URL immediately before scoring;
  web search discovers companies and official careers pages only.

## Optional subsystems

The system is intentionally limited to the personal search workflows described here.
are optional. They are not part of the default role-discovery path.

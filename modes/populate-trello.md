# Mode: populate-trello — Card surfaced roles onto the Trello board

Takes the rubric-scored, surfaced roles produced by `modes/role-scan.md` (step 11 hand-off file from `npm run scan:route`)
and creates cards on the Trello **Job Applications** board. This mode owns all Trello
mapping and dedup — no carding logic lives outside the repo.

> **Never card an unvalidated role.** A handoff is eligible only when it passed the
> rubric surfacing gate and contains all of: `official_careers_url`, `detail_url`,
> `verification.result: active`, `verification.finalUrl`, and `verification.checkedAt`.
> Search snippets, Reddit, LinkedIn, and aggregators never satisfy this contract.

## Target
- Board: **Job Applications** — https://trello.com/b/HEf5JOOd/job-applications
  `ari:cloud:trello::board/workspace/6a85c8ee0ee07516146ce0e8/6a85cbea32b291772ff2bd13`
- New roles go to the **📥 Backlog** list. Create it immediately before
  **🔍 Researching** if it does not exist. `🔍 Researching` is reserved for
  roles Joshua has deliberately pulled from the backlog to investigate.
- Create cards with the **trelloWriteCard** tool.

(List map: 🗄️ Archived / No Apply · 📥 Backlog · 🔍 Researching · 📝 To Apply ·
📮 Applied · 💬 Interviewing · 🏁 Final Round · 🎉 Offer · 🚫 Rejected / Closed.)

Create **🗄️ Archived / No Apply** as the first (leftmost) list if it does not exist.
It is Joshua's destination for a surfaced role he has reviewed and does not want to
pursue. Do not move cards into it automatically. **🚫 Rejected / Closed** remains for
applications closed by the employer or roles Joshua explicitly rejects.

## One-time migration

When adding the Backlog list, move every existing card in `🔍 Researching` to
`📥 Backlog`. Do not move cards from any other list. Thereafter, scans create
cards only in Backlog; Joshua manually moves a card to Researching when ready.

## Dedup (do this FIRST)
1. Read `data/seen-postings.jsonl`; any posting with `status: "carded"`, `"rejected-user"`, `"not-applying-user"`, or `"archived-user"` for this URL → **skip**. The latter three are durable user decisions from the rejected/closed list, the Archived / No Apply list, or legacy archived Trello cards.
2. Search the board (trelloSearch `search_cards` scoped to this board) for the JD URL or for a
   card named `{Company} — {Role}`. If found on any list, **skip** — do not create a duplicate.

## Card creation (per new role)
A role-scan handoff carries a prebuilt `card` `{name, description, label}` from
`scanner/route.mjs`. Use it as written. The fields below define that format and apply only
to a role that arrives without one.

- **Name:** `{Company} — {Role}`
- **List:** 📥 Backlog
- **Description:**
  - `Link:` the JD URL
  - `Fit score:` `{match_score}/10`
  - `Why this fits:` `{fit_summary}` — the one-sentence, plain-English role-fit
    rationale supplied by `role-scan.md`; include the main caveat where applicable.
  - `Comp:` salary if the JD stated it, else `Not listed`
  - `Location:` remote / hybrid / on-site + city
  - `Glassdoor:` rating if found
  - `JD:` 1–2 sentence `job_description`
  - `Verified:` `{verification.checkedAt}` — `{verification.finalUrl}`
- **Label (optional):** score-band color — 8.0–10.0 green, 6.0–7.9 yellow (labels on this board are
  color-only; use the existing green/yellow labels).

## After carding
After the board is updated, record the carded roles so re-runs skip them:

```bash
npm run scan:record -- carded <handoff.json> [url ...]
```

List URLs only when some cards were not created. The script appends
`{date_seen, company, role, url, status:"carded", reason, sector, last_checked}` and skips
roles already recorded as carded.

## Guardrails
- Never move or edit a card the human has already advanced past 📥 Backlog.
- Never card a role that failed the surfacing gate or hit a hard exclusion.
- Reject a handoff with missing, stale (over 10 minutes old), failed, or uncertain
  validation. Record it as `closed` or `unverified` in the local ledger instead.
- One card per JD URL per board.
- Never leave `Why this fits` blank. If an older handoff has only `justification`, use it
  as the `fit_summary`; do not invent a new rationale at card-creation time.

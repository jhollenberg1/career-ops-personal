# Mode: populate-trello — Card surfaced roles onto the Trello board

Takes the rubric-scored, surfaced roles produced by `modes/role-scan.md` (step 18 hand-off)
and creates cards on the Trello **Job Applications** board. This mode owns all Trello
mapping and dedup — no carding logic lives outside the repo.

> **Never card a role that was not scored by `evals/rubric.md`.** Only roles that passed
> the surfacing gate in `modes/role-scan.md` step 11c (match_score 8–10, or the 6–7 fallback
> set) are eligible.

## Target
- Board: **Job Applications** — https://trello.com/b/HEf5JOOd/job-applications
  `ari:cloud:trello::board/workspace/6a85c8ee0ee07516146ce0e8/6a85cbea32b291772ff2bd13`
- New roles go to the **🔍 Researching** list —
  `ari:cloud:trello::list/workspace/6a85c8ee0ee07516146ce0e8/6a85cc4f54d2b26aa029ec76`
- Create cards with the **trelloWriteCard** tool.

(List map, mirrors Notion `Stage`: 🔍 Researching · 📝 To Apply · 📮 Applied ·
💬 Interviewing · 🏁 Final Round · 🎉 Offer · 🚫 Rejected / Closed.)

## Dedup (do this FIRST)
1. Read `data/seen-postings.jsonl`; any posting with `status: "carded"` for this URL → **skip**.
2. Search the board (trelloSearch `search_cards` scoped to this board) for the JD URL or for a
   card named `{Company} — {Role}`. If found on any list, **skip** — do not create a duplicate.

## Card creation (per new role)
- **Name:** `{Company} — {Role}`
- **List:** 🔍 Researching
- **Description:**
  - `Link:` the JD URL
  - `Score:` `{match_score}/10` — `{justification}` (the rubric rationale)
  - `Comp:` salary if the JD stated it, else `Not listed`
  - `Location:` remote / hybrid / on-site + city
  - `Glassdoor:` rating if found
  - `JD:` 1–2 sentence `job_description`
- **Label (optional):** score-band color — 8–10 green, 6–7 yellow (labels on this board are
  color-only; use the existing green/yellow labels).

## After carding
Append one line per carded role to `data/seen-postings.jsonl`:
`{date_seen, company, role, url, status:"carded", sector, last_checked}` (append only).
If dual-writing with `modes/populate-notion.md`, both write the same `"carded"` ledger line —
write it once, after the last board is updated, so re-runs skip the posting everywhere.

## Guardrails
- Never move or edit a card the human has already advanced past 🔍 Researching.
- Never card a role that failed the surfacing gate or hit a hard exclusion.
- One card per JD URL per board.

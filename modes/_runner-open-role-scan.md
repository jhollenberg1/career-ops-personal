# Runner: "career ops open role scan" scheduled task

This is the exact prompt the scheduled task should contain. It holds **no logic** — the
procedure lives entirely in the repo. Keeping it here means even the task's pointer is
version-controlled.

---

Run the career-ops open-role scan from the repo at `~/Projects/career-ops`. Follow the repo
files as the single source of truth; do not improvise a scan.

1. Read and follow `modes/_shared.md` + `modes/role-scan.md` end to end. First import any
   manually approved Company Targets **📚 All Tracked** cards missing from `portals.yml`, after
   verifying their official careers URLs. Then scan tracked companies and run the untracked-company
   WebSearch prospecting lane. Score every candidate against `evals/rubric.md` (v5) before
   surfacing. Do not card any role it did not surface.
2. For the surfaced set, follow `modes/populate-trello.md` to card onto the Trello
   "Job Applications" board, then `modes/populate-notion.md` to card into the Notion
   "Job Search" data source (dual-write).
3. Report: counts scanned / surfaced / carded / skipped-dup, and the ranked surfaced roles.

Use `discover.mjs` (`npm run discover`) only as the cheap discovery feeder — it finds
candidates; `modes/role-scan.md` judges and cards them.

# Runner: "career ops company discovery" scheduled task

Exact prompt for the weekly scheduled task. Holds **no logic** — the procedure lives in the repo.

---

Run the weekly career-ops company-discovery step from the repo at `~/Projects/career-ops`. Follow
the repo files as the single source of truth; do not improvise.

Read and follow `modes/company-discovery.md` end to end. It reads `portals.yml`
(`discovery`, `priority_policy`, `tracked_companies`, `aggregator_sources`) and `config/profile.yml`
(`target_sectors`, `excluded_sectors`, `excluded_companies`), finds and vets new companies in the
target sectors, appends up to 10 to `tracked_companies` in `portals.yml` (backup + YAML-validate
first), then runs `npm run discover` (`discover.mjs`) to sweep the boards into `data/pipeline.md`.
It does NOT create Notion/Trello cards. End with the plain-text report described in the mode file.

# Runner: "career ops company discovery" scheduled task

Exact prompt for the weekly scheduled task. Holds **no logic** — the procedure lives in the repo.

---

Run the weekly career-ops company-discovery step from the repo at `~/Projects/career-ops`. Follow
the repo files as the single source of truth; do not improvise.

Read and follow `modes/company-discovery.md` end to end. It reads `portals.yml`
(`discovery`, `priority_policy`, `tracked_companies`, `aggregator_sources`) and `config/profile.yml`
(`target_sectors`, `excluded_sectors`, `excluded_companies`), finds, vets, and scores companies in
the target sectors, then creates or updates only qualifying (company fit 4–5) cards in the
Company Targets board's **🆕 New Targets** list. It does NOT edit `portals.yml`, scan roles, or
create Notion/Job Applications cards. End with the plain-text report described in the mode file.

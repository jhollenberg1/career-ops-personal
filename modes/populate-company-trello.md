# Mode: populate-company-trello — Maintain an easy-to-scan Company Targets board

The Company Targets board is the working view of the company universe. It is separate
from the Job Applications board: discovering a company never implies discovering a live role.

## Target

Create only these lists, in order: `🆕 New Targets`, `📚 All Tracked`, and `🗄️ Archived`.

- **New Targets** contains companies scoring `company_fit` 4–5, found by company discovery or
  role-scan prospecting, that Joshua has not approved for monitoring.
- **All Tracked** contains companies Joshua has manually approved by moving their cards from
  New Targets. `role-scan.md` imports any missing card into `portals.yml` on its next run.
- **Archived** contains excluded, invalid, or intentionally stopped targets.

Use labels for `Priority 5`, `Priority 4`, `Networking`, and source-health issues instead
of more lists. This keeps the board digestible without hiding tracked companies.

## Synchronization and priority

At the start of each board-population run, ensure every enabled `tracked_companies` entry has
exactly one card in **All Tracked**. This keeps legacy or manually edited `portals.yml` entries
visible, but never moves a New Targets card: only Joshua promotes it to All Tracked. `portals.yml`
is the scanner configuration after role-scan imports approved cards; All Tracked is the approval
queue for new additions. Do not move an existing tracked card out of All Tracked; record priority
and networking status with labels/fields.
For every synced card, upsert the machine-owned `About`, `Careers`, and `Tracking` lines
from that company’s `notes`, `careers_url`, and `enabled` fields. Preserve any text below
`User notes:` exactly as written.

For each company-discovery or role-scan-prospecting handoff, create or update a **New Targets**
card whenever `company_fit` is 4–5 — whether or not its careers page could be confirmed. Set
**Careers** to `verified` when confirmed, or `needs resolution` (with the best URL found, or blank)
when not; an unresolved careers page is never a reason to withhold the card. Preserve the original
search-result URL as provenance, but do not treat it as a role or careers source. Never move the
card to All Tracked automatically.

Give every saved company an explicit `Priority score` and `Priority rank`. This
is the ordering Joshua should use when choosing a company to research or
network with.

```
Priority score = (company_fit × 15) + 15 if a current role scores 8–10 + 10 if a warm introduction or named connection exists
```

The range is 60–100. Rank cards in descending `Priority score`, breaking ties
by `company_fit`, then by strength of the current role. Put the rank in the
card description as `Priority: #01 of {saved-company-count} ({score}/100)` and
keep the top-ranked cards first in `📚 All Tracked`. Recompute ranks
after every scan; do not overwrite a manually entered networking note.

## Dedup

Before creating a card, search this board for the normalized company name. Update an existing card's assessment but preserve human-written networking notes, contacts, last-outreach date, and manually advanced list position.

## Card fields

- **Name:** `{Company}`
- **Company fit:** `{company_fit}/5` — `{company_disposition}`
- **Priority:** `#{rank} of {saved-company-count} ({priority_score}/100)`
- **About:** one short, plain-language description. For tracked companies, use the
  concise `notes` value from `portals.yml`; for New Targets, write the discovery summary.
- **Careers:** `{careers_url}` as a clickable link — `verified` or `needs resolution`
- **Current-role signal:** `{role title} — {match_score}/10`, or `No viable role currently`
- **Networking target:** blank unless a named contact exists
- **Last outreach:** blank unless known
- **Next action:** `Research connections` for a new card
- **Source / reviewed:** discovery date, search-result URL (if any), and careers-page check date

Use a green label for 5 and yellow label for 4 if available.

## Guardrails

- Never create a Company Targets card for a hard exclusion or `company_fit` below 4.
- Never use a weak current role to downgrade a 4–5 company fit; record it as a current-role signal instead.
- Never withhold a New Targets card for `company_fit` 4–5 because the careers page is unresolved —
  card it as `needs resolution` instead. (A validated role from role-scan prospecting still needs a
  verified careers page of its own — see `modes/populate-trello.md` — but that is a separate,
  stricter gate that applies to the *role* card, not this company card.)
- Do not create duplicates because multiple roles were found.
- A New Targets card is not a watchlist entry. It becomes one only when Joshua moves it to
  All Tracked and the following role scan verifies its careers source and saves it in `portals.yml`.
- A validated, surfaced role from role-scan prospecting may create both a Job Applications card
  and a New Targets card; the role card does not imply automatic company approval.

Use this description template for tracked-company cards:

```markdown
About: {notes}
Careers: {careers_url}
Tracking: enabled
Source: portals.yml

User notes:
```

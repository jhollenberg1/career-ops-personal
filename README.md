# Joshua's Career Search Operating System

This workspace finds, scores, and organizes roles and companies worth pursuing.
It is built for a focused search: broad discovery, strict evidence-based filtering,
and no automated applications.

## Search goal

I am a data engineer moving toward technical, client-facing ownership: translating
messy data and technical systems into outcomes for customers and stakeholders.

### Core role hypotheses

- Implementation, deployment, integration, and forward-deployed engineering
- Solutions engineering and solutions architecture
- Technical consulting and professional services
- Technical program/project management
- Data strategy and data strategist roles

### Explore role hypotheses

- Technical or data product management
- Customer engineering, technical account management, and customer-success engineering
- Delivery, strategy, public-sector, social-impact, and management consulting
- Selective software, data, analytics, and platform engineering

Generic Ops, GTM, RevOps, partnerships, BizOps, business development, and quota-carrying
AE roles are out of scope. Staff, Principal, Director, Head, VP, and other clearly
out-of-level roles are filtered before JD review.

### Company preferences

Mission-driven companies are preferred, especially in criminal justice and individual
rights, education and economic access, financial inclusion, climate, civic tech, and
nonprofit infrastructure. Mission is a positive signal, not a requirement: a commercial
company can qualify when it has a tangible purpose, healthy culture, and relevant work.

Defense, military technology, mass surveillance, and DoD/IC-first companies are excluded.
NYC hybrid and US-remote roles are in scope.

## Architecture

```text
Company discovery                         Role discovery                         Application work
─────────────────                         ──────────────                         ────────────────
Funding, sponsors, portfolios,            Tracked companies + broad search       A role I choose to pursue
associations, and networks                         │                                      │
          │                                          ▼                                      ▼
          ▼                              Core/Explore title + level filter       Detailed A–F evaluation
Company-fit score (1–5)                            │                                      │
          │                                          ▼                                      ▼
          ▼                               Live JD + experience-gap score          Report + tailored CV + tracker
Company Targets board                               │
                                                     ▼
                                       Job Applications card, or rejection ledger
```

### The role funnel

1. A cheap filter admits titles in the **Core** or **Explore** categories and removes
   clear seniority/function mismatches.
2. The system validates the exact official job page.
3. It reads the JD and compares responsibilities, hard requirements, years of experience,
   IC/management scope, location, workload, technical depth, and client ownership with my CV.
4. It assigns a `match_score` from 1–10.
5. Only a verified role that clears the surfacing threshold creates a Job Applications card.
   Lower-fit, closed, duplicate, or ineligible roles are recorded and skipped.

`data/pipeline.md` is only for roles I add myself or explicitly defer. Automated scans
do not put unscored roles there.

## Boards and states

### Company Targets

| List | Meaning | System behavior |
|---|---|---|
| **🆕 New Targets** | High-fit company awaiting my approval. | Research saved; not monitored yet. |
| **📚 All Tracked** | I approved the company. | Careers source is verified and monitored. |
| **🚫 Rejected / Do Not Track** | I do not want the company resurfaced. | Added to the company ledger and skipped in future discovery. |
| **🗄️ Archived** | Historical storage. | Not automatically treated as a rejection. |

Move a company from **New Targets** to **All Tracked** to approve ongoing monitoring.
Move a company I never want to revisit to **Rejected / Do Not Track**.

### Job Applications

```text
📥 Backlog → 🔍 Researching → 📝 To Apply → ✉️ Ready to Send → 📮 Applied
                                                           → 💬 Interviewing → 🏁 Final Round → 🎉 Offer
                                                           → 🚫 Rejected / Closed
```

The system may research and prepare materials, but it never submits an application.

## Scheduled work

| Cadence | Task | Scope | Output |
|---|---|---|---|
| Daily, 2:10 AM | **Scored tracked-role scan** | All approved tracked companies: ATS APIs, careers pages, and company-specific search sources. No broad untracked queries. | A Job Applications card only for a verified, score-eligible role; all other outcomes go to the posting ledger. |
| Every 3 days, starting Sep 1 at 3:10 AM | **Untracked role discovery** | Broad role queries, ATS searches, and sector boards. | Eligible role cards; high-fit untracked employers can also become New Targets. |
| Every 3 days, starting Sep 2 at 3:10 AM | **Broad company discovery** | Funding, conference sponsors/exhibitors, VC and accelerator portfolios, mission-company registries, associations, consulting networks, and aggregators. | New Target cards for companies scoring 4–5. No role cards. |
| Daily, 4:10 AM | **Application prep** | Up to five cards in **📝 To Apply**. | JD analysis, recruiter research, honest gaps, and recommended resume-bullet order; completed cards move to **✉️ Ready to Send**. |

The two every-three-day tasks are offset so the expensive role and company discovery
runs do not land on the same day.

## Scores and ledgers

| Item | Meaning | Source of truth |
|---|---|---|
| `company_fit` (1–5) | Whether a company is worth tracking. | Company Targets + `data/seen-companies.jsonl` |
| `match_score` (1–10) | Whether a live role should be surfaced. | Job Applications + `data/seen-postings.jsonl` |
| `application_score` (1–5) | Whether to pursue a role after full application evaluation. | Reports + application tracker |

Do not compare or average these scores. A strong company can have no current role,
and a strong-looking role can still fail the JD match.

## What I do manually

- Move approved companies from **New Targets** to **All Tracked**.
- Move unwanted companies to **Rejected / Do Not Track**.
- Pull interesting roles from **Backlog** to **Researching**.
- Move roles to **To Apply** when I want application prep.
- Review all materials and submit applications myself.
- Correct bad scores or missed context so the profile and rubric can improve.

## Useful commands

| Need | Command |
|---|---|
| Evaluate a pasted JD or job URL | `/career-ops {JD or URL}` |
| Run a complete scored role scan now | `/career-ops role-scan` |
| Run broad company discovery now | `/career-ops company-discovery` |
| Process a role I explicitly added to the queue | `/career-ops pipeline` |
| Research a company | `/career-ops deep` |
| Prepare an application form without submitting | `/career-ops apply` |
| See application status | `/career-ops tracker` |
| Check scanner behavior | `npm run scan:test` |

## Files that matter

| File | Purpose |
|---|---|
| `cv.md` | Canonical CV. |
| `config/profile.yml` | Background, target roles, location, compensation, values, and exclusions. |
| `portals.yml` | Title categories, tracked companies, search queries, and company-discovery sources. |
| `evals/rubric.md` | Company and role scoring rules. |
| `data/seen-postings.jsonl` | Posting outcome/deduplication ledger. |
| `data/seen-companies.jsonl` | Company `new_target`, `tracked`, and `rejected` ledger. |
| `data/pipeline.md` | My manually added or deferred roles. |

## Guardrails

- No application is submitted automatically.
- A search result is only a lead; a role must have a verified official public JD.
- Titles determine review priority, not final fit.
- JDs, hard requirements, experience gap, workload, ethics, and location decide whether a role is surfaced.

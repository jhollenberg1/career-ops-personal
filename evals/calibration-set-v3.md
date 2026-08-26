# Historical Calibration Source — Rubric v3.1

The twelve human-scored cases below were imported as `C1–C12` in
`golden-set.csv`. This file is retained as readable source material; it is not
the active v4 specification or a separate dataset to score.

Twelve synthetic postings built to probe v3 decisions: Software Engineer roles,
culture-as-mission-substitute, and the Glassdoor factor. They're fake but realistic.

> Historical answer-key warning: do not draft v4 `model_*` labels for these
> cases. Josh's calls and the old v3 model calls are visible below, so they are
> not independent v4 evaluation examples.

**How to use it:** For each posting, fill in a **score 1–10** and a short **justification**. The justification is what teaches the model — say *why* (e.g. "great culture but the product bores me," "senior title but I'd stretch," "comp too low even though I love the mission").

**Scale**
- **1–5 = Reject** (dead, breaks a hard rule, or wrong function)
- **6–7 = Needs review** (decent-to-middling; 6–7 = worth a look, 4–5 = weak/abstain)
- **8–10 = Pass** (high match — this is what the daily runner surfaces)

**The runner will surface every 8–10 role each day; on a day with none, it falls back to the 6–7 roles.** So where you draw the 7-vs-8 line literally sets what lands on your board. Don't peek at my draft scores (bottom) until you've done your own.

---

## 1. Backend Engineer — Ledgerline
**Company:** Ledgerline — B2B accounts-payable automation SaaS. Not mission-aligned; just a solid, profitable fintech-ops tool.
**Glassdoor:** 4.4 (191 reviews) · "great managers, real work-life balance, ships fast"
**Location:** Remote (US, NY-eligible) · **Comp:** $135k–$155k · **YOE:** 3+
**JD:** Own services in a TypeScript/Node + Postgres stack; build integrations against messy third-party financial APIs; partner with implementation team on customer data migrations.

> **YOUR SCORE (1–10):** 5
> **Justification:** Accounts payable automation is super boring, comp is low for 0 mission fit, strict engineering role not ideal. Also ideal location is NY office presence with remote optional rather than full remote. High reviews and reasonable comp are benefits.

---

## 2. Full-Stack Engineer — Admesh
**Company:** Admesh — programmatic ad-targeting platform. Non-mission.
**Glassdoor:** 2.8 (240 reviews) · "burnout culture, high turnover, unrealistic on-call"
**Location:** Remote (US) · **Comp:** $150k–$170k · **YOE:** 3+
**JD:** React/Go, high-scale bidding systems. Fast-paced, "wear many hats," frequent crunch before launches.

> **YOUR SCORE (1–10):** 3
> **Justification:** ad-targeting is boring, bad culture is a huge issue. Comp is higher but that is not a top priority, especially if it is not dramatically high

---

## 3. Data Engineer — Verdant Grid
**Company:** Verdant Grid — grid-decarbonization analytics for utilities (climate, target sector).
**Glassdoor:** 3.6 (54 reviews) · "mission-driven, some growing pains"
**Location:** New York, NY (hybrid) · **Comp:** $130k–$150k · **YOE:** 3+
**JD:** Build pipelines that ingest and standardize messy meter/sensor data; Python + Spark + dbt; work directly with utility clients on data onboarding.

> **YOUR SCORE (1–10):** 10
> **Justification:** Target sector, high comp, hybrid work is fine, yoe fits, role fits. Mediocre culture reviews are not gospel

---

## 4. Senior Software Engineer — Cartwheel
**Company:** Cartwheel — scheduling/logistics software for home-services businesses. Non-mission but well-liked product.
**Glassdoor:** 4.1 (88 reviews) · "smart team, autonomy, good comp"
**Location:** Remote (US, NY-eligible) · **Comp:** $150k–$175k · **YOE:** "4+ years"
**JD:** "Senior" in title. Own a full domain end-to-end; TypeScript + React + Node; mentor one junior. Bar reads mid-to-upper-mid, not staff.

> **YOUR SCORE (1–10):** 7
> **Justification:** Mission fit is more about purpose than necessarily mission. This is totally fine. I just want to feel like I am helping people. Higher comp, good culture signals. Engineering is not as ideal as fde or something more mixed but and it is not strictly mission but this is very good

---

## 5. Staff Software Engineer — Northwind Systems
**Company:** Northwind Systems — infrastructure monitoring. Non-mission.
**Glassdoor:** 4.0 · **Location:** Remote (US) · **Comp:** $200k–$240k · **YOE:** "8+ years, deep distributed-systems expertise"
**JD:** Set technical direction across teams; architect multi-region systems; lead design reviews for the org.

> **YOUR SCORE (1–10):** 0
> **Justification:** I will never get a role asking 8 yoe

---

## 6. Implementation Engineer — CivicStack
**Company:** CivicStack — permitting & licensing software for city governments (GovTech, target sector).
**Glassdoor:** 3.9 (61 reviews) · "meaningful work, bureaucratic clients"
**Location:** New York, NY (hybrid) · **Comp:** $120k–$140k · **YOE:** 2–4
**JD:** Configure and deploy the platform for municipal clients; map their messy legacy data into the system; SQL + light scripting + heavy client contact.

> **YOUR SCORE (1–10):** 10
> **Justification:** Target sector, target role, comp is within the band

---

## 7. Backend Engineer — Parcelly
**Company:** Parcelly — internal tooling for a mid-size logistics broker. Non-mission, fairly ordinary CRUD product.
**Glassdoor:** 3.5 (120 reviews) · "fine place, nothing special, stable"
**Location:** Remote (US) · **Comp:** $115k–$130k · **YOE:** 3+
**JD:** Maintain internal Java services and REST APIs; ticket-driven work; limited external stakeholder contact.

> **YOUR SCORE (1–10):** 4
> **Justification:** Engineer is not perfect role fit, company is not a mission fit, comp is low. A role needs at least one area match to be considered

---

## 8. Site Reliability Engineer — Cartwheel
**Company:** Cartwheel (same as #4) — good culture, non-mission.
**Glassdoor:** 4.2 · **Location:** Remote (US) · **Comp:** $140k–$160k · **YOE:** 3+
**JD:** Pure infra/SRE: Kubernetes, Terraform, on-call rotation, reliability + observability. No product or client-facing component.

> **YOUR SCORE (1–10):** 5
> **Justification:** Same justification as 4 but reliability is more boring

---

## 9. Data Engineer — Bright Futures Fund
**Company:** Bright Futures Fund — nonprofit expanding college access for low-income students (econ mobility, target sector).
**Glassdoor:** 4.0 (33 reviews) · "people genuinely care"
**Location:** New York, NY · **Comp:** $75k–$95k · **YOE:** 2–4
**JD:** Stand up the org's first real data pipeline; consolidate student-outcomes data across partners; Python + Airflow.

> **YOUR SCORE (1–10):** 8
> **Justification:** High mission fit, good role fit. Comp is low but 80 is the hard floor

---

## 10. Software Engineer — Foundry Robotics
**Company:** Foundry Robotics — warehouse automation. Non-mission.
**Glassdoor:** 4.3 · **Location:** On-site, Austin TX (no remote) · **Comp:** $150k–$175k · **YOE:** 3+
**JD:** Backend for fleet-coordination systems; interesting hard problems; strong team.

> **YOUR SCORE (1–10):** 0
> **Justification:** Hard reject- I'm not moving to texas

---

## 11. Machine Learning Engineer — Loam Labs
**Company:** Loam Labs — computer-vision for autonomous inspection drones. Non-mission, but genuinely novel technical work.
**Glassdoor:** 4.0 (72 reviews) · "hard problems, brilliant people, ships real products"
**Location:** Remote (US, NY-eligible) · **Comp:** $160k–$185k · **YOE:** 3–5
**JD:** Train and deploy CV models; own data pipelines feeding them; Python/PyTorch; some customer-facing deployment work.

> **YOUR SCORE (1–10):** 6
> **Justification:** Interest is more important than specifically sociall beneficial and this is interesting. I don't think I have enough ML experience to get this role though

---

## 12. Product Manager — Verdant Grid
**Company:** Verdant Grid (same as #3) — climate, target sector, well-regarded.
**Glassdoor:** 4.5 · **Location:** Remote (US) · **Comp:** $140k–$160k · **YOE:** 3+
**JD:** Own product roadmap; write specs; coordinate eng + design. No hands-on data/eng work; not a client-deployment role.

> **YOUR SCORE (1–10):** 7
> **Justification:** This role has everything I would want but I don't have specific product experience so it is a more indirect role fit

---
---

## Historical v3.1 model draft scores (answer key)

Wherever your number differs from mine — especially across the 7/8 line — that's what I'll tune.

1. **Ledgerline (Backend)** — **9.** Tier-1b SWE; non-mission but Glassdoor 4.4 + real integration/data work → core widen-the-net high match.
2. **Admesh (Full-Stack)** — **4.** Role/comp/location all fine, but non-mission + poor culture (2.8) → abstain, don't surface.
3. **Verdant Grid (Data Eng)** — **9.** Target sector (climate) + Tier-1b + client-facing data work.
4. **Cartwheel (Senior SWE)** — **8.** "Senior" title but 4+ yr bar clears the ceiling; good culture (4.1) + interesting product. Deliberate 7/8-line edge.
5. **Northwind (Staff)** — **2.** Ceiling: 8+ yrs, staff scope → reject.
6. **CivicStack (Impl Eng)** — **9.** Classic Tier-1a at a target sector.
7. **Parcelly (Backend)** — **5.** Non-mission + average culture (3.5) + dull product → weak needs-review.
8. **Cartwheel (SRE)** — **6.** Good culture but pure infra (Tier-2), no product/client angle → decent, not high.
9. **Bright Futures (Data Eng)** — **6.** Mission + good culture, but comp straddles the floor → capped. (You may push higher if mission outweighs comp for you — key calibration input.)
10. **Foundry Robotics (SWE)** — **1.** Location: on-site Austin only → reject.
11. **Loam Labs (ML Eng)** — **8.** Tier-1b + Glassdoor 4.0 + genuinely novel product. Decide if "interesting non-mission tech" clears your 8 bar.
12. **Verdant Grid (PM)** — **2.** Off-target function — PM rejects even at a great mission + culture company. Confirms the function gate held.

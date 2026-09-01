# Data Contract

This document separates Joshua's personal search data from reusable workflow logic.

## User Layer (personal data)

These files contain your personal data, customizations, and work product.

| File | Purpose |
|------|---------|
| `cv.md` | Your CV in markdown |
| `config/profile.yml` | Your identity, targets, comp range |
| `modes/_profile.md` | Your archetypes, narrative, negotiation scripts |
| `article-digest.md` | Your proof points from portfolio |
| `interview-prep/story-bank.md` | Your accumulated STAR+R stories |
| `portals.yml` | Your customized company list |
| `data/applications.md` | Your application tracker |
| `data/pipeline.md` | Your URL inbox |
| `data/scan-history.tsv` | Your scan history |
| `data/seen-postings.jsonl` | Your posting-resolution ledger |
| `evals/golden-set.csv` | Your labeled classifier examples |
| `evals/report.md` | Your generated classifier evaluation report |
| `resume/*` | Your personal resume evidence, bullet library, and resume variants |
| `data/follow-ups.md` | Your follow-up history |
| `writing-samples/*` | Your personal writing samples for style calibration |
| `reports/*` | Your evaluation reports |
| `output/*` | Your generated PDFs |
| `jds/*` | Your saved job descriptions |

## Workflow Layer

These files contain the local workflow logic, scripts, templates, and instructions.

| File | Purpose |
|------|---------|
| `modes/_shared.md` | Scoring system, global rules, tools |
| `modes/oferta.md` | Evaluation mode instructions |
| `modes/pdf.md` | PDF generation instructions |
| `modes/role-scan.md` | Portal scanner instructions |
| `evals/rubric.md` | Scan match-score policy |
| `evals/score.py` | Deterministic rubric-evaluation scorer |
| `modes/apply.md` | Application assistant instructions |
| `modes/resume-prep.md` | Independent resume screening and grounded rewrite instructions |
| `modes/auto-pipeline.md` | Auto-pipeline instructions |
| `modes/contacto.md` | LinkedIn outreach instructions |
| `modes/deep.md` | Research prompt instructions |
| `modes/ofertas.md` | Comparison instructions |
| `modes/pipeline.md` | Pipeline processing instructions |
| `modes/project.md` | Project evaluation instructions |
| `modes/tracker.md` | Tracker instructions |
| `modes/training.md` | Training evaluation instructions |
| `modes/patterns.md` | Pattern analysis instructions |
| `modes/followup.md` | Follow-up cadence instructions |
| `CLAUDE.md` | Agent instructions |
| `AGENTS.md` | Codex instructions |
| `*.mjs` | Utility scripts |
| `templates/*` | Base templates |
| `fonts/*` | Self-hosted fonts |
| `.claude/skills/*` | Skill definitions |
| `DATA_CONTRACT.md` | This file |

## The Rule

**Do not overwrite a User Layer file during workflow changes.**

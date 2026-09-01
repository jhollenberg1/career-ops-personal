# ATS Screen Report

Use this exact structure. The evaluator may see the JD, submitted resume, and
application answers only. It must not see the bullet library or rewrite plan.

```yaml
role:
  company: ""
  title: ""
  posting_url: ""
resume_reviewed: ""
verdict: likely_pass | borderline | likely_fail
hard_knockout_risks:
  - requirement: ""
    jd_evidence: ""
    resume_evidence: "exact section and text, or no evidence in submitted resume"
    severity: high | medium | low
ats_evidence_gaps:
  - requirement: ""
    jd_evidence: ""
    resume_evidence: "exact section and text, or no evidence in submitted resume"
    severity: high | medium | low
recruiter_scan:
  verdict: strong | adequate | weak
  evidence: "what is or is not visible in the top third of page one"
parse_safety:
  verdict: pass | review
  findings: []
recommended_repairs:
  - "specific, evidence-oriented repair"
unfixable_without_new_evidence: []
```

The report is a decision aid, not a claim about an employer's actual ATS. A
`likely_fail` verdict must identify a JD requirement and a citation to the
submitted resume. A `likely_pass` verdict must still list any unresolved hard
requirements.

# Mode: resume-prep — Independent Screen and Grounded Rewrite

Prepare one reviewable, role-specific resume variant. This mode is for a role
Joshua has chosen to pursue. It does not submit an application and it never
changes a canonical resume or `resume/bullet-library.md`.

## Sources of truth

- **Experience evidence:** `resume/bullet-library.md`. This is the complete
  list of pre-approved claims that may be used in a rewrite.
- **Base resume:** the Google Doc Joshua explicitly selects for this role.
  Different role-focused base resumes are valid and do not need to have the
  same summary, title, or ordering.
- **Job description:** a live, readable official posting or pasted JD text.
- **Employment dates:** do not infer a current role from an older resume.
  If a source conflicts with the candidate's confirmed employment dates,
  report the conflict and leave the date unchanged pending review.

## Context isolation

The screen and rewrite pass must be separate contexts.

```text
JD + submitted base resume + application answers
  -> independent screen -> immutable screening report

JD + selected base resume + bullet library + screening report
  -> grounded rewrite -> suggested edits
```

The screen never receives `resume/bullet-library.md`, earlier drafts, or
rewrite reasoning. The rewrite pass receives only the completed screening
report, not the screen prompt, chain of reasoning, or intermediate analysis.

## Step 1 — Ground the inputs

1. Confirm the live JD, company, role, location, and any application-form
   knockout questions.
2. Confirm the specific Google Docs base resume and copy it into the role's
   Drive application package. Never edit the selected base document.
3. Read `resume/bullet-library.md` and identify the available, approved
   evidence. Do not supplement it with plausible but unverified experience.
4. Record source links and their modification timestamps in the Trello card.

## Step 2 — Independent screen

Give the screening pass only the JD, application answers, and plain-text base
resume. Its report must use `templates/ats-screen-report.md`.

The screen assesses four distinct risks:

1. Hard knockouts, including work authorization, location, required years,
   required credentials, and explicitly required technologies.
2. ATS evidence, whether a requirement is stated clearly enough to be parsed
   and matched in the submitted resume.
3. Recruiter scan, whether the fit is visible in the top third of page one.
4. Parse safety, including a plain-text extraction check and unsupported
   layout or file-format risks.

Every finding must cite JD text and an exact resume section or say `no
evidence in submitted resume`. The screen must not invent hidden ATS behavior,
recommend keyword stuffing, or look at the bullet library.

## Step 3 — Grounded rewrite

Give the rewrite pass the JD, the selected base resume, the bullet library,
and the final screening report. It must use
`templates/resume-rewrite-plan.md` before making edits.

Allowed changes:

- reorder or replace bullets with approved bullet-library evidence;
- update the summary, headline, and skills line with JD vocabulary backed by
  the library;
- make real scope, tools, outcomes, and stakeholder work easier to find;
- mark a requirement as unresolved when the library does not support it.

Forbidden changes:

- adding a metric, tool, title, credential, responsibility, or date that is
  not confirmed by Joshua or the bullet library;
- changing the canonical base resume;
- treating a hard experience gap as a phrasing problem.

Use Google Docs suggestions when the connected runtime exposes suggestion-mode
writes. If it does not, apply edits only to the dedicated role-specific copy,
label it `Draft — direct edits`, and state that limitation on the Trello card.
Joshua reviews the draft or its suggestions; do not alter the selected base
document or accept suggestions on his behalf.

## Step 4 — Re-screen and hand off

Run the independent screen again with the revised copy only. Save the
before/after verdicts and unresolved hard gaps in the Trello card using
`templates/ats-screen-report.md`.

The card must include:

- link to the suggested-edits Google Doc;
- selected base-resume link;
- `ATS screen: <before> -> <after>`;
- unresolved hard requirements;
- `Review state: Suggested edits awaiting Joshua`.

Move the card to `Ready to Send` only when the revised copy has been screened,
the card discloses whether it contains suggestions or direct edits, and Joshua
has the review link. Never submit the application.

## Functional-currency rule

Resume variants are not required to match each other. They are functionally
current when their dates, title, skills, and claims are intentional and
supported by the bullet library. Flag only meaningful conflicts, especially
employment end dates, unsupported claims, and contradictory credentials.

## Report

End with the selected base resume, the copied variant, before/after verdict,
unresolved requirements, and any date conflict that requires Joshua's review.

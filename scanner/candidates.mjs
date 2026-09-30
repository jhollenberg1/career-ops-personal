#!/usr/bin/env node
/**
 * Role-scan steps 3 and 9c–12: turn raw leads into validated candidates ready
 * for JD enrichment and rubric scoring. No model judgment happens here.
 *
 * Usage:
 *   node scanner/candidates.mjs [--leads leads.json] [--scan-report output/scans/<ts>.json]
 *                               [--pipeline] [--no-verify] [--dry-run]
 *
 * leads.json is an array of {title, company, url, official_careers_url?, location?,
 * salary?, domain?, source?, provenance_url?} gathered by the agent from careers pages
 * (Level 1) and WebSearch (Level 3). Tracked companies get their careers URL from
 * portals.yml when the lead omits it.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { validatePostings } from '../validate-postings.mjs';
import { companyStatus, excludedCompanyNames, loadCompanyLedger, normalizeCompany } from './companies.mjs';
import { loadConfig } from './config.mjs';
import { buildLocationFilter, buildTitleFilter } from './filters.mjs';
import { appendLedger, familyKey, isSuppressed, ledgerRecord, loadLatestLedger, loadRoleHistory, USER_STATUSES } from './ledger.mjs';
import { canonicalUrl } from './normalize.mjs';
import { parseTitle } from './titles.mjs';
import { loadTrackerRows } from './tracker.mjs';

const HISTORY_PATH = 'data/scan-history.tsv';

export function readPipelineLeads(path = 'data/pipeline.md') {
  if (!existsSync(path)) return [];
  return [...readFileSync(path, 'utf8').matchAll(/^- \[ \] (https?:\/\/\S+)(.*)$/gm)].map(([, url, rest]) => {
    const [, company = '', title = ''] = rest.split('|').map(part => part.trim());
    return { url, company, title, source: 'pipeline' };
  });
}

export function readScanReportLeads(path) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  return (report.candidates || [])
    .filter(candidate => candidate.state === 'verified_open')
    .map(({ verification, state, ...lead }) => ({ ...lead, source: lead.source || 'ats-api' }));
}

const STATUS_LABELS = {
  'rejected-user': 'rejected by you', 'not-applying-user': 'marked no-apply', 'archived-user': 'archived by you',
  carded: 'carded', evaluated: 'evaluated', 'rejected-lowscore': 'scored below the line', 'rejected-guardrail': 'hard-gated',
};

// Compare a lead with earlier decisions on the same core role at the same company.
// A user rejection covers the same role at equal or higher seniority; a less senior
// posting is re-scored with the earlier decision attached as context. A carded or
// evaluated role blocks only an identical repost (same seniority and specialty).
export function priorDecision(lead, history) {
  const parsed = parseTitle(lead.title);
  const related = [];
  for (const prior of history.get(familyKey(lead.company, parsed)) || []) {
    if (prior.url && prior.url === lead.url) continue;
    if (!(prior.status in STATUS_LABELS)) continue;
    const sameSpecialty = prior.specialty === parsed.specialty;
    const note = `"${prior.title}" ${STATUS_LABELS[prior.status]} ${prior.date}`.trim();
    if (USER_STATUSES.has(prior.status) && sameSpecialty && parsed.seniority >= prior.seniority) return { skip: `${note}; this posting is the same role at equal or higher seniority` };
    if ((prior.status === 'carded' || prior.status === 'evaluated') && sameSpecialty && parsed.seniority === prior.seniority) return { skip: `same role as ${note}` };
    related.push(note);
  }
  return { related: related.slice(0, 3) };
}

// Pure screening step, separated from I/O so the rules are testable.
export function screenLeads(leads, ctx) {
  const { config, companyLedger, excluded, ledger, history, now = Date.now() } = ctx;
  const titleFilter = buildTitleFilter(config.title_filter);
  const locationFilter = buildLocationFilter(config.location_filter);
  const careersByCompany = new Map((config.tracked_companies || []).map(entry => [normalizeCompany(entry.name), entry.careers_url]));
  const kept = new Map();
  const skipped = [];
  const skip = (lead, status, reason) => skipped.push({ ...lead, status, reason });

  for (const raw of leads) {
    const lead = { ...raw, url: canonicalUrl(raw.url || ''), title: String(raw.title || '').trim(), company: String(raw.company || '').trim() };
    lead.official_careers_url ||= careersByCompany.get(normalizeCompany(lead.company)) || '';
    if (!/^https?:\/\//.test(lead.url)) { skip(lead, 'invalid', 'no exact job-detail URL'); continue; }
    const status = companyStatus(companyLedger, lead);
    if (status === 'rejected' || excluded.has(normalizeCompany(lead.company))) { skip(lead, 'skipped_values', 'rejected or excluded company'); continue; }
    // Pipeline URLs are user-chosen, so the cheap title gate does not apply to them.
    if (lead.source !== 'pipeline' && !titleFilter(lead.title)) { skip(lead, 'skipped_title', 'title filter'); continue; }
    if (lead.location && !locationFilter(lead.location)) { skip(lead, 'skipped_location', 'location filter'); continue; }
    if (isSuppressed(lead, ledger, config.seen_ledger, now)) { skip(lead, 'skipped_dup', `ledger: ${ledger.get(lead.url)?.status}`); continue; }
    if (lead.title) {
      const prior = priorDecision(lead, history);
      if (prior.skip) { skip(lead, 'skipped_dup', prior.skip); continue; }
      if (prior.related.length) lead.related = prior.related;
    }
    // The same URL from several levels is one candidate: keep first-seen values, fill blanks.
    const merged = { ...kept.get(lead.url) };
    for (const [field, value] of Object.entries(lead)) if (!merged[field] && value) merged[field] = value;
    kept.set(lead.url, merged);
  }
  // Pipeline URLs are user-supplied; every other lead needs an official careers source.
  const ready = [];
  for (const lead of kept.values()) {
    if (lead.source !== 'pipeline' && !lead.official_careers_url) skip(lead, 'invalid', 'no official careers URL');
    else ready.push(lead);
  }
  return { kept: ready, skipped };
}

function appendHistory(rows, date) {
  if (!rows.length) return;
  if (!existsSync(HISTORY_PATH)) writeFileSync(HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n', 'utf8');
  const clean = value => String(value || '').replace(/[\t\n]/g, ' ');
  appendFileSync(HISTORY_PATH, `${rows.map(row => [row.url, date, row.source, row.title, row.company, row.status].map(clean).join('\t')).join('\n')}\n`, 'utf8');
}

function parseArgs(args) {
  const value = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  return { leads: value('--leads'), scanReport: value('--scan-report'), pipeline: args.includes('--pipeline'), verify: !args.includes('--no-verify'), dryRun: args.includes('--dry-run') };
}

export async function runCandidates(options, { createVerifier } = {}) {
  const config = loadConfig();
  const profile = existsSync('config/profile.yml') ? yaml.load(readFileSync('config/profile.yml', 'utf8')) || {} : {};
  const ledgerPath = config.seen_ledger?.file || 'data/seen-postings.jsonl';
  const leads = [
    ...(options.leads ? JSON.parse(readFileSync(options.leads, 'utf8')) : []),
    ...(options.scanReport ? readScanReportLeads(options.scanReport) : []),
    ...(options.pipeline ? readPipelineLeads() : []),
  ];
  const { kept, skipped } = screenLeads(leads, {
    config,
    companyLedger: loadCompanyLedger(config.discovery?.company_ledger),
    excluded: excludedCompanyNames(profile),
    ledger: loadLatestLedger(ledgerPath),
    history: loadRoleHistory(ledgerPath, loadTrackerRows()),
  });

  const date = new Date().toISOString().slice(0, 10);
  const active = [];
  const closed = [];
  if (options.verify && kept.length) {
    const results = await validatePostings(kept.map(lead => lead.url), createVerifier ? { createVerifier } : {});
    kept.forEach((lead, index) => {
      const { url, ...verification } = results[index];
      if (verification.result === 'active') active.push({ ...lead, detail_url: canonicalUrl(verification.finalUrl || lead.url), verification });
      else closed.push({ ...lead, status: 'closed', reason: `validation ${verification.result}: ${verification.reason || ''}`.trim(), verification });
    });
  } else {
    active.push(...kept.map(lead => ({ ...lead, detail_url: lead.url, verification: { result: 'unverified', reason: 'verification disabled' } })));
  }

  const output = { createdAt: new Date().toISOString(), counts: { leads: leads.length, skipped: skipped.length, validated: kept.length, active: active.length, closed: closed.length }, active, closed, skipped };
  if (!options.dryRun) {
    appendLedger(closed.map(lead => ledgerRecord({ company: lead.company, role: lead.title, url: lead.url, status: 'closed', reason: lead.reason }, date)), ledgerPath);
    appendHistory([...skipped.filter(lead => lead.status !== 'invalid'), ...closed], date);
    mkdirSync('output/scans', { recursive: true });
    output.path = `output/scans/candidates-${output.createdAt.replace(/[:.]/g, '-')}.json`;
    writeFileSync(output.path, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  }
  return output;
}

function printSummary(output) {
  const bySkip = output.skipped.reduce((counts, lead) => ({ ...counts, [lead.status]: (counts[lead.status] || 0) + 1 }), {});
  console.log(`Candidates — ${output.createdAt.slice(0, 10)}`);
  console.log(`Leads in:            ${output.counts.leads}`);
  for (const [status, count] of Object.entries(bySkip)) console.log(`  ${status.padEnd(18)} ${count}`);
  console.log(`Validated:           ${output.counts.validated}`);
  console.log(`Closed on validation:${output.counts.closed}`);
  console.log(`Active, ready to score: ${output.counts.active}`);
  for (const lead of output.skipped.filter(item => item.status === 'invalid')) console.log(`  invalid: ${lead.company} — ${lead.title} (${lead.reason})`);
  if (output.path) console.log(`Output: ${output.path}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2));
  if (!options.leads && !options.scanReport && !options.pipeline) {
    console.error('Usage: node scanner/candidates.mjs [--leads file] [--scan-report file] [--pipeline] [--no-verify] [--dry-run]');
    process.exitCode = 1;
  } else {
    runCandidates(options).then(printSummary).catch(error => { console.error(`Candidates failed: ${error.message}`); process.exitCode = 1; });
  }
}

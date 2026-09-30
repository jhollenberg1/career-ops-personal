#!/usr/bin/env node
/**
 * Role-scan steps 13b–19: compute v6.3 totals from the model's judgments, apply
 * routing, write ledger/history records for unsurfaced roles, export the scan
 * CSV, and write the Trello handoff for populate-trello / populate-company-trello.
 *
 * Usage: node scanner/route.mjs scored.json [--max-age-minutes 10] [--dry-run]
 *
 * scored.json is an array. Each role carries the candidate fields from
 * scanner/candidates.mjs plus the model's judgments:
 *   title_base_match (an exact title-bases.json name, or null), used only when the
 *   posting title contains no approved title; null rejects the role,
 *   hard_gate ("Pass" | "Reject"), hard_gate_reason,
 *   adjustments {role_shape, qualification, company, salary}, adjustment_rationale,
 *   company_fit (1.0–5.0), company_rationale, fit_summary, justification,
 *   and enrichment: salary, level, location, job_description, company_description,
 *   recruiter_contact, glassdoor, sector.
 * The model does not supply the base value or the total; any total it sends is
 * checked against the calculated one and reported on mismatch.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { companyStatus, excludedCompanyNames, loadCompanyLedger, normalizeCompany, trackedCompanyNames } from './companies.mjs';
import { loadConfig } from './config.mjs';
import { appendLedger, ledgerRecord } from './ledger.mjs';
import { canonicalUrl } from './normalize.mjs';
import { adjustmentOutliers, band, computeTotal, isBelowSalaryFloor, loadTitleBases, parseSalaryRange, salaryDefault, resolveTitleBase } from './rubric.mjs';

const HISTORY_PATH = 'data/scan-history.tsv';
const CSV_COLUMNS = ['job_title', 'company', 'salary', 'level', 'location', 'job_description', 'company_description', 'recruiter_contact', 'job_link', 'job_fit', 'mission_fit', 'combined', 'glassdoor', 'justification'];

const blank = value => value === undefined || value === null || String(value).trim() === '';

export function roleCard(role) {
  const lines = [
    `Link: ${role.detail_url}`,
    `Fit score: ${role.total.toFixed(1)}/10`,
    `Why this fits: ${role.fit_summary}`,
    `Comp: ${blank(role.salary) ? 'Not listed' : role.salary}`,
    blank(role.location) ? null : `Location: ${role.location}`,
    blank(role.glassdoor) ? null : `Glassdoor: ${role.glassdoor}`,
    blank(role.job_description) ? null : `JD: ${role.job_description}`,
    role.related?.length ? `Related: ${role.related.join('; ')}` : null,
    `Verified: ${role.verification.checkedAt} — ${role.verification.finalUrl}`,
  ];
  return { name: `${role.company} — ${role.title}`, description: lines.filter(Boolean).join('\n'), label: role.total >= 8.0 ? 'green' : 'yellow' };
}

// Pure routing step. Returns every decision; the CLI decides what to write.
export function routeRoles(roles, ctx) {
  const { bases, companyLedger, tracked, excluded, now = Date.now(), maxAgeMinutes = 10 } = ctx;
  const out = { scored: [], surfaced: [], lowScore: [], gated: [], closed: [], revalidate: [], unverified: [], invalid: [], companies: new Map(), warnings: [] };

  for (const input of roles) {
    const role = { ...input, url: canonicalUrl(input.url || input.detail_url || ''), detail_url: canonicalUrl(input.detail_url || input.verification?.finalUrl || input.url || '') };
    const label = `${role.company} — ${role.title}`;
    if (!role.url || !role.company || !role.title) { out.invalid.push({ ...role, reason: 'missing url, company, or title' }); continue; }
    if (role.verification?.result !== 'active') { out.closed.push({ ...role, reason: `validation ${role.verification?.result || 'missing'}` }); continue; }

    const status = companyStatus(companyLedger, role);
    const companyKey = normalizeCompany(role.company);
    const salaryRange = parseSalaryRange(role.salary);

    // Company routing is independent of the role result (rubric: company_fit does not enter the total).
    if (status !== 'rejected' && status !== 'archived' && !excluded.has(companyKey)) {
      const isTracked = tracked.has(companyKey);
      const fit = Number(role.company_fit);
      if (!isTracked && !Number.isFinite(fit)) out.warnings.push(`${label}: untracked company has no company_fit`);
      if (isTracked || fit >= 4.0) {
        const prior = out.companies.get(companyKey);
        const entry = prior || { company: role.company, action: isTracked ? 'update-all-tracked' : 'new-target', company_fit: fit, company_rationale: role.company_rationale || '', careers_url: role.official_careers_url || '', careers_status: role.official_careers_url ? 'verified' : 'needs resolution', provenance_url: role.provenance_url || '', roles: [] };
        if (fit > entry.company_fit) Object.assign(entry, { company_fit: fit, company_rationale: role.company_rationale || entry.company_rationale });
        out.companies.set(companyKey, entry);
        role.companyEntry = entry;
      }
    }

    // Deterministic gates first; the model's hard gate is only read for a role that has a base.
    const titleBase = resolveTitleBase(role.title, role.title_base_match, bases);
    let gateReason = null;
    if (status === 'rejected' || excluded.has(companyKey)) gateReason = 'company is rejected or excluded';
    else if (isBelowSalaryFloor(salaryRange)) gateReason = `salary entirely below $80k (${role.salary})`;
    else if (!titleBase) gateReason = 'role does not match an approved title base';
    else {
      const gate = String(role.hard_gate || '').toLowerCase();
      if (gate !== 'pass' && gate !== 'reject') { out.invalid.push({ ...role, reason: 'hard_gate must be Pass or Reject' }); continue; }
      if (gate === 'reject') gateReason = role.hard_gate_reason || 'hard gate';
    }
    if (gateReason) { out.gated.push({ ...role, total: 0.0, reason: gateReason }); continue; }

    const total = computeTotal(titleBase.base, 'pass', role.adjustments);
    const supplied = role.total ?? role.match_score;
    if (!blank(supplied) && Math.round(Number(supplied) * 10) / 10 !== total) out.warnings.push(`${label}: model total ${supplied} replaced by calculated ${total.toFixed(1)}`);
    const outliers = adjustmentOutliers(role.adjustments);
    if (outliers.length && blank(role.adjustment_rationale)) out.warnings.push(`${label}: outside default range without adjustment_rationale: ${outliers.join('; ')}`);
    if (blank(role.fit_summary) && !blank(role.justification)) { role.fit_summary = role.justification; out.warnings.push(`${label}: fit_summary missing, used justification`); }

    const scored = { ...role, title_base: titleBase.title, title_base_source: titleBase.source, base: titleBase.base, total, disposition: band(total), salary_default: salaryDefault(salaryRange), outliers };
    out.scored.push(scored);
    role.companyEntry?.roles.push(scored);
  }

  const fallbackDay = !out.scored.some(role => role.total >= 8.0);
  const ageMinutes = role => (now - Date.parse(role.verification.checkedAt || '')) / 60_000;
  for (const role of out.scored) {
    const eligible = role.total >= 8.0 || (fallbackDay && role.total >= 6.0);
    if (!eligible) { out.lowScore.push(role); continue; }
    // populate-trello handoff contract.
    if (blank(role.official_careers_url) || blank(role.verification.finalUrl) || blank(role.fit_summary)) {
      out.unverified.push({ ...role, reason: 'missing official_careers_url, verification.finalUrl, or fit_summary' });
    } else if (!(ageMinutes(role) <= maxAgeMinutes)) {
      out.revalidate.push({ ...role, reason: `validation older than ${maxAgeMinutes} minutes` });
    } else {
      out.surfaced.push({ ...role, card: roleCard(role) });
    }
  }
  out.surfaced.sort((a, b) => b.total - a.total);
  out.fallbackDay = fallbackDay;
  return out;
}

function csvCell(value) {
  const text = blank(value) ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function scanCsv(scored) {
  const rows = [...scored].sort((a, b) => b.total - a.total).map(role => [
    role.title, role.company, role.salary, role.level, role.location, role.job_description, role.company_description,
    role.recruiter_contact, role.detail_url, '', '', role.total.toFixed(1), role.glassdoor, role.justification || role.fit_summary,
  ].map(csvCell).join(','));
  return `${[CSV_COLUMNS.join(','), ...rows].join('\n')}\n`;
}

function companyHandoff(entry, date) {
  const best = [...entry.roles].sort((a, b) => b.total - a.total)[0];
  const { roles, ...rest } = entry;
  return { ...rest, current_role_signal: best ? `${best.title} — ${best.total.toFixed(1)}/10` : 'No viable role currently', reviewed: date };
}

function printSummary(result, date, paths) {
  const pad = (value, width) => String(value ?? '').slice(0, width).padEnd(width);
  console.log(`Role Route — ${date}`);
  console.log('━'.repeat(56));
  console.log(`Scored:                ${result.scored.length}`);
  console.log(`Hard-gated:            ${result.gated.length}`);
  console.log(`Closed on validation:  ${result.closed.length}`);
  console.log(`Below surfacing line:  ${result.lowScore.length}`);
  console.log(`Surfaced:              ${result.surfaced.length}`);
  console.log(`\nRanked Offers (v6.3 — 0.0–10.0 total_score)`);
  console.log('━'.repeat(56));
  [...result.scored].sort((a, b) => b.total - a.total).forEach((role, index) => {
    console.log(` ${pad(index + 1, 3)} ${pad(role.company, 22)} ${pad(role.title, 30)} ${role.total.toFixed(1).padStart(4)}  ${pad(role.glassdoor, 4)}  ${role.justification || role.fit_summary || ''}`);
  });
  console.log(`Fallback day? ${result.fallbackDay ? 'yes — only 6.0–7.9 surfaced because nothing scored 8.0+' : 'no'}`);
  const targets = result.companies.filter(company => company.action === 'new-target');
  if (targets.length) {
    console.log('\nCOMPANY TARGETS — high company fit');
    for (const company of targets) console.log(`  ${company.company}  Company fit ${company.company_fit.toFixed(1)}  ${company.careers_url || '(needs resolution)'}  ${company.company_rationale}`);
  }
  for (const [labelText, list] of [['Needs revalidation (stale)', result.revalidate], ['Not cardable (contract)', result.unverified], ['Invalid input', result.invalid]]) {
    if (list.length) console.log(`\n${labelText}:\n${list.map(role => `  ${role.company} — ${role.title}: ${role.reason}`).join('\n')}`);
  }
  if (result.warnings.length) console.log(`\nWarnings:\n${result.warnings.map(warning => `  ${warning}`).join('\n')}`);
  if (paths) console.log(`\nCSV: ${paths.csv}\nHandoff: ${paths.handoff}`);
}

function appendHistory(rows, date) {
  if (!rows.length) return;
  if (!existsSync(HISTORY_PATH)) writeFileSync(HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n', 'utf8');
  const clean = value => String(value || '').replace(/[\t\n]/g, ' ');
  appendFileSync(HISTORY_PATH, `${rows.map(row => [row.url, date, row.source, row.title, row.company, row.status].map(clean).join('\t')).join('\n')}\n`, 'utf8');
}

export function main(args = process.argv.slice(2)) {
  const file = args.find(arg => !arg.startsWith('--') && args[args.indexOf(arg) - 1] !== '--max-age-minutes');
  if (!file) { console.error('Usage: node scanner/route.mjs scored.json [--max-age-minutes 10] [--dry-run]'); process.exitCode = 1; return; }
  const ageIndex = args.indexOf('--max-age-minutes');
  const dryRun = args.includes('--dry-run');
  const config = loadConfig();
  const profile = existsSync('config/profile.yml') ? yaml.load(readFileSync('config/profile.yml', 'utf8')) || {} : {};
  const input = JSON.parse(readFileSync(file, 'utf8'));
  const result = routeRoles(Array.isArray(input) ? input : input.roles || input.active || [], {
    bases: loadTitleBases(),
    companyLedger: loadCompanyLedger(config.discovery?.company_ledger),
    tracked: trackedCompanyNames(config),
    excluded: excludedCompanyNames(profile),
    maxAgeMinutes: ageIndex >= 0 ? Number(args[ageIndex + 1]) : 10,
  });
  const date = new Date().toISOString().slice(0, 10);
  result.companies = [...result.companies.values()].map(entry => companyHandoff(entry, date));

  let paths = null;
  if (!dryRun) {
    const ledgerPath = config.seen_ledger?.file || 'data/seen-postings.jsonl';
    const records = [
      ...result.closed.map(role => ({ ...role, status: 'closed' })),
      ...result.unverified.map(role => ({ ...role, status: 'unverified' })),
      ...result.gated.map(role => ({ ...role, status: 'rejected-guardrail' })),
      ...result.lowScore.map(role => ({ ...role, status: 'rejected-lowscore', reason: `${role.total.toFixed(1)}/10 — ${role.justification || role.fit_summary || ''}`.trim() })),
    ];
    // Surfaced roles are written as `carded` by scanner/record.mjs after the board update.
    appendLedger(records.map(role => ledgerRecord({ company: role.company, role: role.title, url: role.url, status: role.status, reason: role.reason, sector: role.sector }, date)), ledgerPath);
    appendHistory(records.map(role => ({ ...role, status: role.status === 'rejected-guardrail' ? 'skipped_values' : role.status === 'closed' ? 'skipped_expired' : role.status })), date);
    mkdirSync('output/scans', { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    paths = { csv: `output/scan-${date}.csv`, handoff: `output/scans/handoff-${stamp}.json` };
    writeFileSync(paths.csv, scanCsv(result.scored), 'utf8');
    const handoff = {
      createdAt: new Date().toISOString(),
      fallbackDay: result.fallbackDay,
      roles: result.surfaced.map(({ companyEntry, ...role }) => role),
      companies: result.companies,
      revalidate: result.revalidate.map(role => role.url),
      warnings: result.warnings,
    };
    writeFileSync(paths.handoff, `${JSON.stringify(handoff, null, 2)}\n`, 'utf8');
  }
  printSummary(result, date, paths);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) { console.error(`Route failed: ${error.message}`); process.exitCode = 1; }
}

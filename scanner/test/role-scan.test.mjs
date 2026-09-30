import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { priorDecision, screenLeads } from '../candidates.mjs';
import { companyStatus, loadCompanyLedger, normalizeCompany, trackedCompanyNames } from '../companies.mjs';
import { loadLatestLedger, loadRoleExclusions, loadRoleHistory, roleKey } from '../ledger.mjs';
import { buildTitleFilter } from '../filters.mjs';
import { canonicalUrl } from '../normalize.mjs';
import { switchToAtsApi } from '../probe-sources.mjs';
import { parseCard, userResolvedRecords } from '../record.mjs';
import { routeRoles, scanCsv } from '../route.mjs';
import { computeTotal, isBelowSalaryFloor, loadTitleBases, parseSalaryRange, resolveTitleBase, salaryDefault, titleBaseFor } from '../rubric.mjs';
import { parseTitle } from '../titles.mjs';
import { loadTrackerRows } from '../tracker.mjs';

const dir = mkdtempSync(join(tmpdir(), 'role-scan-test-'));
const file = (name, content) => { const path = join(dir, name); writeFileSync(path, content); return path; };

// -- rubric math ----------------------------------------------------------
const bases = loadTitleBases();
assert.deepEqual(titleBaseFor('Senior Customer Solutions Engineer', bases), { title: 'Customer Solutions Engineer', base: 8.5 });
assert.deepEqual(titleBaseFor('Forward-Deployed Engineer (NYC)', bases), { title: 'Forward Deployed Engineer', base: 8.0 });
assert.deepEqual(titleBaseFor('Lead Implementation Engineer', bases), { title: 'Lead Implementation Engineer', base: 8.0 });
assert.equal(titleBaseFor('Solutions Architect', bases), null, 'titles without an approved base are not guessed');
assert.equal(titleBaseFor('Presolutions Engineering', bases), null, 'matches whole words only');
assert.deepEqual(titleBaseFor('Integrations Specialist', { 'Integration Engineer': { base: 8.0, aliases: ['Integrations Specialist'] } }), { title: 'Integration Engineer', base: 8.0 }, 'approved aliases inherit the base');
assert.deepEqual(resolveTitleBase('Forward Deployed Software Engineer', 'Forward Deployed Engineer', bases), { title: 'Forward Deployed Engineer', base: 8.0, source: 'model' });
assert.deepEqual(resolveTitleBase('Senior Solutions Engineer', null, bases), { title: 'Solutions Engineer', base: 8.5, source: 'title' }, 'a code match wins over the model');
assert.equal(resolveTitleBase('Software Engineer', null, bases), null);
assert.equal(resolveTitleBase('Software Engineer', 'Software Engineer', bases), null, 'the model may only name an approved entry');

// -- title parsing -----------------------------------------------------------
const parsed = title => { const { core, seniority, specialty } = parseTitle(title); return [core, seniority, specialty]; };
assert.deepEqual(parsed('Implementation Engineer'), ['implementation engineer', 2, '']);
assert.deepEqual(parsed('Sr. Implementation Engineer - Remote'), ['implementation engineer', 3, '']);
assert.deepEqual(parsed('Implementation Lead (12-month contract)'), ['implementation lead', 2, '']);
assert.deepEqual(parsed('Senior Manager of Implementation Success — NYC Metro'), ['manager of implementation success', 3, '']);
assert.deepEqual(parsed('Associate Consultant, Fundraising'), ['consultant', 1, 'fundraising']);
assert.deepEqual(parsed('Senior/Software Engineer II, Backend'), ['software engineer', 2, 'backend'], 'a range keeps its lower end');
assert.deepEqual(parsed('Solutions Engineer, Mid-Market East (Pre-Sales)'), ['solutions engineer', 2, 'pre sales mid market east']);
assert.deepEqual(parsed('Product Manager (New Grad)'), ['product manager', 0, '']);
assert.deepEqual(parsed('Associate Director of Implementation'), ['implementation', 7, '']);
assert.deepEqual(parsed('Solutions Engineer (Staff)'), ['solutions engineer', 5, '']);

// -- fixed bugs --------------------------------------------------------------
const negatives = buildTitleFilter({ core: ['Engineer'], negative: ['Intern', 'CRO', 'SAP', 'Staff ', 'VP '] });
assert.equal(negatives('Implementation Engineer, Internal Tools'), true, 'negative terms match whole words');
assert.equal(negatives('Integration Engineer, Microservices'), true);
assert.equal(negatives('Engineering Intern'), false);
assert.equal(negatives('Solutions Engineer (Staff)'), false, 'a trailing-space term still matches at the end');
assert.equal(negatives('SAP Integration Engineer'), false);
assert.notEqual(canonicalUrl('https://acme.com/careers/job?gh_jid=1'), canonicalUrl('https://acme.com/careers/job?gh_jid=2'), 'gh_jid identifies the job');
assert.equal(canonicalUrl('https://acme.com/careers/job?gh_jid=1&gh_src=abc'), 'https://acme.com/careers/job?gh_jid=1');

assert.deepEqual(parseSalaryRange('$145k-$165k'), { min: 145_000, max: 165_000 });
assert.deepEqual(parseSalaryRange('$120,000 - $160,000 USD'), { min: 120_000, max: 160_000 });
assert.deepEqual(parseSalaryRange('$145-165K'), { min: 145_000, max: 165_000 });
assert.deepEqual(parseSalaryRange('$30/hr'), { min: 62_400, max: 62_400 });
assert.equal(parseSalaryRange('Not listed'), null);
assert.equal(isBelowSalaryFloor(parseSalaryRange('$53-62k')), true);
assert.equal(isBelowSalaryFloor(parseSalaryRange('$75-110k')), false, 'only a range entirely below $80k is gated');
assert.equal(salaryDefault(parseSalaryRange('$145k-$165k')), 0.2);
assert.equal(salaryDefault(null), 0.0);

// TC01 from evals/human-reviews.csv: 8.0 + 0.0 - 0.3 + 0.6 + 0.3 = 8.6.
assert.equal(computeTotal(8.0, 'Pass', { role_shape: 0, qualification: -0.3, company: 0.6, salary: 0.3 }), 8.6);
assert.equal(computeTotal(8.0, 'Reject', { company: 1.0 }), 0.0);
assert.equal(computeTotal(8.5, 'Pass', { role_shape: 1.5, company: 1.3 }), 10.0, 'total is clamped');

// -- ledgers ---------------------------------------------------------------
const companyLedger = loadCompanyLedger(file('companies.jsonl', [
  JSON.stringify({ company: 'Smarsh', domain: 'smarsh.com', status: 'rejected' }),
  JSON.stringify({ name: 'Archco', domain: '', status: 'archived' }),
  JSON.stringify({ name: 'Flipco', domain: '', status: 'rejected' }),
  JSON.stringify({ name: 'Flipco', domain: '', status: 'tracked' }),
].join('\n')));
assert.equal(companyStatus(companyLedger, { company: 'Smarsh, Inc.' }), 'rejected');
assert.equal(companyStatus(companyLedger, { company: 'Other', domain: 'https://www.smarsh.com/careers' }), 'rejected');
assert.equal(companyStatus(companyLedger, { company: 'Flipco' }), 'tracked', 'latest record wins');
assert.equal(normalizeCompany('Untapped Solutions (ConConnect)'), 'untapped solutions');

const postingsPath = file('postings.jsonl', [
  JSON.stringify({ company: 'OldCo', role: 'Implementation Engineer', url: '', status: 'rejected-user' }),
  JSON.stringify({ company: 'Undo', role: 'Solutions Engineer', url: '', status: 'rejected-user' }),
  JSON.stringify({ company: 'Undo', role: 'Solutions Engineer', url: '', status: 'carded' }),
  JSON.stringify({ company: 'Seen', role: 'Implementation Engineer', url: 'https://jobs.example.com/seen', status: 'carded' }),
].join('\n'));
const roleExclusions = loadRoleExclusions(postingsPath);
assert.equal(roleExclusions.has(roleKey('OldCo Inc', 'Implementation  Engineer')), true);
assert.equal(roleExclusions.has(roleKey('Undo', 'Solutions Engineer')), false, 'a later non-user status lifts the exclusion');

const trackerRows = loadTrackerRows(file('applications.md', [
  '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
  '|---|------|---------|------|-------|--------|-----|--------|-------|',
  '| 1 | 2026-05-07 | Headway | Revenue Operations Associate | 3.2/5 | Evaluated | ❌ | [001](reports/001.md) | note |',
].join('\n')));
assert.deepEqual(trackerRows, [{ company: 'Headway', role: 'Revenue Operations Associate', status: 'evaluated', date_seen: '2026-05-07', url: '' }]);
const history = loadRoleHistory(postingsPath, trackerRows);

// Point 4: a user rejection covers equal or higher seniority; a less senior posting is re-scored.
const prior = title => priorDecision({ company: 'OldCo', title, url: 'https://jobs.example.com/new' }, history);
assert.match(prior('Implementation Engineer (Remote)').skip, /equal or higher seniority/);
assert.match(prior('Senior Implementation Engineer').skip, /equal or higher seniority/);
assert.deepEqual(prior('Associate Implementation Engineer'), { related: ['"Implementation Engineer" rejected by you'] });
assert.deepEqual(prior('Senior Implementation Engineer, Payments'), { related: ['"Implementation Engineer" rejected by you'] }, 'a different specialty is related, not a duplicate');
assert.match(priorDecision({ company: 'Seen', title: 'Implementation Engineer - NYC', url: 'https://jobs.example.com/repost' }, history).skip, /^same role as "Implementation Engineer" carded/);
assert.deepEqual(priorDecision({ company: 'Seen', title: 'Senior Implementation Engineer', url: 'https://jobs.example.com/repost' }, history), { related: ['"Implementation Engineer" carded'] }, 'a carded role does not suppress other seniorities');

// -- candidate screen ------------------------------------------------------
const config = {
  title_filter: { core: ['Implementation Engineer', 'Solutions Engineer'], negative: ['Director'] },
  location_filter: { remote_ok: true, allowed: ['new york'] },
  seen_ledger: { recheck_days_closed: 30 },
  tracked_companies: [{ name: 'Tracked Co', careers_url: 'https://tracked.example.com/careers' }],
};
const lead = (overrides) => ({ title: 'Implementation Engineer', company: 'Acme', url: 'https://jobs.example.com/1', official_careers_url: 'https://acme.example.com/careers', location: 'Remote', ...overrides });
const screened = screenLeads([
  lead({}),
  lead({ salary: '$150k', official_careers_url: '' }),
  lead({ url: 'https://jobs.example.com/2', company: 'Smarsh' }),
  lead({ url: 'https://jobs.example.com/3', title: 'Director of Implementation Engineering' }),
  lead({ url: 'https://jobs.example.com/4', location: 'London' }),
  lead({ url: 'https://jobs.example.com/seen', company: 'Seen' }),
  lead({ url: 'https://jobs.example.com/5', company: 'OldCo' }),
  lead({ url: 'https://jobs.example.com/6', company: 'Headway', title: 'Revenue Operations Associate', source: 'pipeline' }),
  lead({ url: 'https://jobs.example.com/7', company: 'Tracked Co', official_careers_url: '' }),
  lead({ url: 'https://jobs.example.com/8', company: 'Palantir' }),
  lead({ url: 'https://jobs.example.com/9', title: 'Account Manager', source: 'pipeline' }),
  lead({ url: 'https://jobs.example.com/10', company: 'Nowhere', official_careers_url: '' }),
  lead({ url: 'https://jobs.example.com/11', company: 'OldCo', title: 'Senior Implementation Engineer' }),
  lead({ url: 'https://jobs.example.com/12', company: 'OldCo', title: 'Associate Implementation Engineer' }),
], { config, companyLedger, excluded: new Set(['palantir']), ledger: loadLatestLedger(postingsPath), history });
assert.deepEqual(screened.kept.map(item => item.url), ['https://jobs.example.com/1', 'https://jobs.example.com/7', 'https://jobs.example.com/9', 'https://jobs.example.com/12']);
assert.deepEqual(screened.kept[3].related, ['"Implementation Engineer" rejected by you']);
assert.equal(screened.kept[0].salary, '$150k', 'duplicate leads merge blank fields');
assert.equal(screened.kept[1].official_careers_url, 'https://tracked.example.com/careers', 'tracked companies inherit careers_url');
assert.deepEqual(Object.fromEntries(screened.skipped.map(item => [item.url.split('/').pop(), item.status])), {
  2: 'skipped_values', 3: 'skipped_title', 4: 'skipped_location', seen: 'skipped_dup', 5: 'skipped_dup', 6: 'skipped_dup', 8: 'skipped_values', 10: 'invalid', 11: 'skipped_dup',
});

// -- routing ---------------------------------------------------------------
const now = Date.parse('2026-09-28T12:00:00Z');
const fresh = { result: 'active', finalUrl: 'https://jobs.example.com/final', checkedAt: '2026-09-28T11:55:00Z' };
const role = (overrides) => ({
  company: 'Acme', title: 'Solutions Engineer', url: 'https://jobs.example.com/a', official_careers_url: 'https://acme.example.com/careers',
  verification: fresh, hard_gate: 'Pass', adjustments: { role_shape: 0, qualification: -0.3, company: 0.2, salary: 0 },
  company_fit: 3.5, fit_summary: 'Customer-facing integration work; main caveat is domain depth.', justification: 'Strong shape.', ...overrides,
});
const ctx = { bases, companyLedger, tracked: trackedCompanyNames({ tracked_companies: [{ name: 'Tracked Co' }] }), excluded: new Set(), now };
const routed = routeRoles([
  role({ total: 9.9 }),
  role({ url: 'https://jobs.example.com/b', title: 'Implementation Engineer', adjustments: { qualification: -1.5 }, company: 'Beta', company_fit: 4.2, company_rationale: 'Mission fit.' }),
  role({ url: 'https://jobs.example.com/c', salary: '$55k-$70k' }),
  role({ url: 'https://jobs.example.com/d', company: 'Smarsh' }),
  role({ url: 'https://jobs.example.com/e', company: 'Archco', company_fit: 5 }),
  role({ url: 'https://jobs.example.com/f', company: 'Tracked Co' }),
  role({ url: 'https://jobs.example.com/g', title: 'Solutions Architect' }),
  role({ url: 'https://jobs.example.com/h', verification: { ...fresh, checkedAt: '2026-09-28T10:00:00Z' } }),
  role({ url: 'https://jobs.example.com/i', verification: { result: 'expired' } }),
  role({ url: 'https://jobs.example.com/j', hard_gate: 'Reject', hard_gate_reason: 'Requires 7+ years in implementation.', company: 'Gamma', company_fit: 4.5 }),
  role({ url: 'https://jobs.example.com/k', title: 'Forward Deployed Software Engineer', title_base_match: 'Forward Deployed Engineer', adjustments: { company: 0.5 }, related: ['"Forward Deployed Engineer" rejected by you'] }),
  role({ url: 'https://jobs.example.com/l', title: 'Software Engineer', title_base_match: null, hard_gate: undefined, adjustments: undefined }),
], ctx);
assert.equal(routed.fallbackDay, false);
assert.deepEqual(routed.surfaced.map(item => item.url), ['https://jobs.example.com/k', 'https://jobs.example.com/a', 'https://jobs.example.com/e', 'https://jobs.example.com/f']);
const [modelMatched, acme] = routed.surfaced;
assert.equal(modelMatched.title_base_source, 'model');
assert.match(modelMatched.card.description, /\nRelated: "Forward Deployed Engineer" rejected by you\n/);
assert.equal(acme.total, 8.4, 'the calculated total replaces the model total');
assert.ok(routed.warnings.some(warning => warning.includes('model total 9.9 replaced by calculated 8.4')));
assert.equal(acme.card.name, 'Acme — Solutions Engineer');
assert.match(acme.card.description, /^Link: https:\/\/jobs\.example\.com\/final\nFit score: 8\.4\/10\nWhy this fits: .+\nComp: Not listed\nVerified: /);
assert.equal(acme.card.label, 'green');
assert.deepEqual(routed.lowScore.map(item => item.url), ['https://jobs.example.com/b'], '6.5 is not surfaced on a non-fallback day');
assert.deepEqual(routed.gated.map(item => [item.url.split('/').pop(), item.reason]), [
  ['c', 'salary entirely below $80k ($55k-$70k)'], ['d', 'company is rejected or excluded'], ['g', 'role does not match an approved title base'],
  ['j', 'Requires 7+ years in implementation.'], ['l', 'role does not match an approved title base'],
], 'no title base rejects the role without needing a hard gate or adjustments');
assert.deepEqual(routed.invalid, []);
assert.deepEqual(routed.revalidate.map(item => item.url), ['https://jobs.example.com/h']);
assert.deepEqual(routed.closed.map(item => item.url), ['https://jobs.example.com/i']);
assert.deepEqual([...routed.companies.values()].map(entry => [entry.company, entry.action]), [
  ['Beta', 'new-target'], ['Tracked Co', 'update-all-tracked'], ['Gamma', 'new-target'],
], 'archived and rejected employers never get a company card; a gated role does not block a 4–5 company');

const fallback = routeRoles([role({ adjustments: { qualification: -1.0 } }), role({ url: 'https://jobs.example.com/z', adjustments: { qualification: -3.0 } })], ctx);
assert.equal(fallback.fallbackDay, true);
assert.deepEqual(fallback.surfaced.map(item => [item.total, item.card.label]), [[7.5, 'yellow']]);
assert.deepEqual(fallback.lowScore.map(item => item.total), [5.5]);
assert.ok(fallback.warnings.some(warning => warning.includes('without adjustment_rationale')));

const csv = scanCsv([{ title: 'Engineer, "Data"', company: 'Acme', total: 8.46, detail_url: 'https://x', justification: 'a,b' }]);
assert.equal(csv.split('\n')[1], '"Engineer, ""Data""",Acme,,,,,,,https://x,,,8.5,,"a,b"');

// -- Trello resolution records ---------------------------------------------
assert.deepEqual(parseCard({ list: '🗄️ Archived / No Apply', name: 'Acme — Solutions Engineer - Payments', desc: 'Fit score: 8/10\nLink: https://jobs.example.com/p?utm_source=x' }), {
  url: 'https://jobs.example.com/p', company: 'Acme', role: 'Solutions Engineer - Payments', status: 'not-applying-user',
});
const resolved = userResolvedRecords([
  { list: '🚫 Rejected / Closed', name: 'Seen — Implementation Engineer', desc: 'Link: https://jobs.example.com/seen' },
  { list: '🚫 Rejected / Closed', name: 'OldCo — Implementation Engineer', desc: '' },
  { list: 'any', archived: true, name: 'NewCo — Implementation Engineer', desc: 'Job link: https://jobs.example.com/new' },
  { list: '🚫 Rejected / Closed', name: 'How to use this list', desc: 'Move cards here.' },
], loadLatestLedger(postingsPath), roleExclusions, '2026-09-28');
assert.deepEqual(resolved.records.map(record => [record.company, record.url, record.status]), [
  ['Seen', 'https://jobs.example.com/seen', 'rejected-user'],
  ['NewCo', 'https://jobs.example.com/new', 'archived-user'],
]);
assert.deepEqual(resolved.report, { recorded: 2, alreadyRecorded: 1, unlinked: [], ignored: ['How to use this list'] });

// -- source probe ----------------------------------------------------------
const portals = '  - name: "Garner Health"\n    careers_url: https://jobs.ashbyhq.com/garnerhealth\n    scan_method: websearch # note\n\n  - name: Other\n    scan_method: websearch\n';
assert.equal(switchToAtsApi(portals, new Set(['Garner Health'])), portals.replace('scan_method: websearch # note', 'scan_method: ats_api # note'));

console.log('role-scan script tests passed');

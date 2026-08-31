import assert from 'node:assert/strict';
import { selectCompanies } from '../config.mjs';
import { buildLocationFilter } from '../filters.mjs';
import { isSuppressed } from '../ledger.mjs';
import { canonicalUrl, normalizePosting, postingKey } from '../normalize.mjs';
import { fetchAts, getAtsSource } from '../sources/ats.mjs';
import { classifyLiveness } from '../../liveness-core.mjs';

const config = {
  scan_scope: { active_watchlist: ['Alpha'] },
  tracked_companies: [
    { name: 'Alpha', careers_url: 'https://jobs.lever.co/alpha' },
    { name: 'Beta', careers_url: 'https://jobs.ashbyhq.com/beta' },
  ],
};
assert.deepEqual(selectCompanies(config).map(company => company.name), ['Alpha']);
assert.deepEqual(selectCompanies(config, { full: true }).map(company => company.name), ['Alpha', 'Beta']);
assert.deepEqual(selectCompanies({
  tracked_companies: [
    { name: 'API', scan_method: 'ats_api', careers_url: 'https://jobs.lever.co/api' },
    { name: 'Search', scan_method: 'websearch', careers_url: 'https://example.com/careers' },
  ],
}).map(company => company.name), ['API']);

assert.equal(canonicalUrl('https://example.com/job/1/?utm_source=x&ref=a#section'), 'https://example.com/job/1');
assert.equal(postingKey(normalizePosting({ company: 'Acme, Inc.', title: 'Implementation  Engineer', location: 'New York, NY' })), 'acme inc::implementation engineer::new york ny');

const locationFilter = buildLocationFilter({ remote_ok: true, remote_us_only: true, remote_excluded: ['canada'], allowed: ['new york'], allowed_abbrev: ['ny'] });
assert.equal(locationFilter('Remote — United States'), true);
assert.equal(locationFilter('Remote — Canada'), false);
assert.equal(locationFilter('New York, NY'), true);

const posting = { url: 'https://jobs.example.com/1' };
const ledger = new Map([[posting.url, { status: 'closed', last_checked: '2026-08-19' }]]);
assert.equal(isSuppressed(posting, ledger, { recheck_days_closed: 30 }, Date.parse('2026-08-20')), true);
assert.equal(isSuppressed(posting, ledger, { recheck_days_closed: 30 }, Date.parse('2026-10-20')), false);

assert.deepEqual(getAtsSource({ careers_url: 'https://jobs.ashbyhq.com/acme' }), {
  type: 'ashby', url: 'https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true',
});
assert.deepEqual(getAtsSource({ scan_method: 'websearch', careers_url: 'https://jobs.ashbyhq.com/acme' }), {
  type: 'websearch', status: 'deferred', reason: 'configured for web search',
});
assert.deepEqual(getAtsSource({ scan_method: 'careers_page', careers_url: 'https://jobs.lever.co/acme' }), {
  type: 'careers_page', status: 'deferred', reason: 'configured for careers-page scan',
});
const mockFetch = async () => ({ ok: true, json: async () => [{ text: 'Solutions Engineer', hostedUrl: 'https://jobs.lever.co/acme/1', categories: { location: 'Remote US' } }] });
const result = await fetchAts({ name: 'Acme', careers_url: 'https://jobs.lever.co/acme' }, { fetchImpl: mockFetch });
assert.equal(result.status, 'success');
assert.deepEqual(result.postings[0], { title: 'Solutions Engineer', url: 'https://jobs.lever.co/acme/1', location: 'Remote US', company: 'Acme', source: 'lever-api' });
const deferred = await fetchAts({ name: 'Search Only', scan_method: 'websearch', careers_url: 'https://jobs.lever.co/search-only' });
assert.equal(deferred.status, 'deferred');
assert.equal(deferred.source, 'websearch');
const networkFailure = await fetchAts(
  { name: 'Offline', careers_url: 'https://jobs.lever.co/offline' },
  { fetchImpl: async () => { const error = new Error('fetch failed'); error.cause = { code: 'ENOTFOUND' }; throw error; } },
);
assert.equal(networkFailure.failureKind, 'network');

assert.deepEqual(
  classifyLiveness({
    status: 200,
    bodyText: 'Job not found. The job you requested was not found. View all open positions.',
    applyControls: [],
  }),
  { result: 'expired', reason: 'pattern matched: job (listing )?not found' },
);

console.log('scanner core tests passed');

#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { loadConfig, selectCompanies } from './config.mjs';
import { buildLocationFilter, buildTitleFilter } from './filters.mjs';
import { isSuppressed, loadLatestLedger } from './ledger.mjs';
import { normalizePosting, postingKey } from './normalize.mjs';
import { printSummary, writeScanReport } from './report.mjs';
import { fetchAts } from './sources/ats.mjs';
import { PostingVerifier } from './verify.mjs';

const PIPELINE_PATH = 'data/pipeline.md';
const HISTORY_PATH = 'data/scan-history.tsv';
const HEALTH_PATH = 'data/source-health.json';

function parseArgs(args) {
  const index = args.indexOf('--company');
  return { dryRun: args.includes('--dry-run'), full: args.includes('--all') || args.includes('--full'), company: index >= 0 ? args[index + 1] : undefined, verify: !args.includes('--no-verify') };
}

function loadQueuedUrls() {
  if (!existsSync(PIPELINE_PATH)) return new Set();
  return new Set([...readFileSync(PIPELINE_PATH, 'utf8').matchAll(/- \[[ x]\] (https?:\/\/\S+)/g)].map(match => match[1]));
}

function appendQueue(postings) {
  if (!postings.length) return;
  let pipeline = existsSync(PIPELINE_PATH) ? readFileSync(PIPELINE_PATH, 'utf8') : '# Job Pipeline — Inbox\n\n## Pendientes\n\n';
  const marker = '## Pendientes';
  const start = pipeline.indexOf(marker);
  const next = start < 0 ? -1 : pipeline.indexOf('\n## ', start + marker.length);
  const at = start < 0 ? pipeline.length : (next < 0 ? pipeline.length : next);
  const lines = postings.map(posting => `- [ ] ${posting.url} | ${posting.company} | ${posting.title} | verified ${posting.verification.checkedAt.slice(0, 10)}`).join('\n');
  pipeline = start < 0 ? `${pipeline}\n## Pendientes\n\n${lines}\n` : `${pipeline.slice(0, at)}\n${lines}\n${pipeline.slice(at)}`;
  writeFileSync(PIPELINE_PATH, pipeline, 'utf8');
}

function appendHistory(postings) {
  if (!postings.length) return;
  if (!existsSync(HISTORY_PATH)) writeFileSync(HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n', 'utf8');
  const date = new Date().toISOString().slice(0, 10);
  appendFileSync(HISTORY_PATH, `${postings.map(posting => `${posting.url}\t${date}\t${posting.source}\t${posting.title}\t${posting.company}\tverified_open`).join('\n')}\n`, 'utf8');
}

function updateHealth(results, startedAt) {
  const previous = existsSync(HEALTH_PATH) ? JSON.parse(readFileSync(HEALTH_PATH, 'utf8')) : { sources: {} };
  for (const result of results) {
    const prior = previous.sources[result.company] || {};
    previous.sources[result.company] = {
      source: result.source,
      lastAttempt: startedAt,
      lastSuccess: result.status === 'success' ? startedAt : prior.lastSuccess || null,
      lastFailure: result.status === 'failed' ? startedAt : prior.lastFailure || null,
      consecutiveFailures: result.status === 'failed' ? (prior.consecutiveFailures || 0) + 1 : 0,
      lastJobCount: result.postings.length,
      status: result.status,
      error: result.error || null,
    };
  }
  writeFileSync(HEALTH_PATH, `${JSON.stringify(previous, null, 2)}\n`, 'utf8');
}

export async function runScan(options = {}) {
  const config = loadConfig();
  const companies = selectCompanies(config, options);
  const startedAt = new Date().toISOString();
  const report = {
    schemaVersion: 1,
    startedAt,
    scope: options.full ? 'full' : 'watchlist',
    companies: [],
    candidates: [],
    counts: { companiesAttempted: companies.length, sourcesSucceeded: 0, sourcesFailed: 0, sourcesUnavailable: 0, discovered: 0, filtered: 0, suppressed: 0, verifiedOpen: 0, verificationFailed: 0, queued: 0 },
    complete: true,
  };
  const results = await Promise.all(companies.map(company => fetchAts(company)));
  const titleFilter = buildTitleFilter(config.title_filter);
  const locationFilter = buildLocationFilter(config.location_filter);
  const ledger = loadLatestLedger(config.seen_ledger?.file);
  const queuedUrls = loadQueuedUrls();
  const unique = new Map();

  for (const result of results) {
    report.companies.push({ company: result.company, source: result.source, status: result.status, error: result.error || null, discovered: result.postings.length });
    if (result.status === 'success') report.counts.sourcesSucceeded++;
    if (result.status === 'failed') { report.counts.sourcesFailed++; report.complete = false; }
    if (result.status === 'unavailable') { report.counts.sourcesUnavailable++; report.complete = false; }
    for (const raw of result.postings) {
      const posting = normalizePosting(raw);
      report.counts.discovered++;
      const candidate = { ...posting, state: 'discovered' };
      if (!posting.url || !titleFilter(posting.title) || !locationFilter(posting.location)) {
        candidate.state = 'filtered'; report.counts.filtered++; report.candidates.push(candidate); continue;
      }
      if (isSuppressed(posting, ledger, config.seen_ledger) || queuedUrls.has(posting.url)) {
        candidate.state = 'suppressed'; report.counts.suppressed++; report.candidates.push(candidate); continue;
      }
      const key = posting.url || postingKey(posting);
      unique.set(key, posting);
    }
  }

  const verifier = options.verify === false ? null : new PostingVerifier();
  const queue = [];
  for (const posting of unique.values()) {
    const verification = verifier
      ? await verifier.verify(posting.url)
      : { result: 'unverified', reason: 'verification disabled', checkedAt: startedAt, finalUrl: posting.url };
    const candidate = { ...posting, verification, state: verification.result === 'active' ? 'verified_open' : verification.result };
    report.candidates.push(candidate);
    if (verification.result === 'active') { report.counts.verifiedOpen++; queue.push(candidate); }
    else report.counts.verificationFailed++;
  }
  await verifier?.close();

  report.counts.queued = queue.length;
  report.finishedAt = new Date().toISOString();
  if (!options.dryRun) {
    appendQueue(queue);
    appendHistory(queue);
    updateHealth(results, startedAt);
    report.reportPath = writeScanReport(report);
  }
  return report;
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runScan(options);
  printSummary(report);
  if (report.reportPath) console.log(`Report: ${report.reportPath}`);
  if (!report.complete) process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => { console.error(`Scanner failed: ${error.message}`); process.exitCode = 1; });
}

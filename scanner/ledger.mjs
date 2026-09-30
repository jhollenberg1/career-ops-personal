import { appendFileSync, existsSync, readFileSync } from 'fs';
import { normalizeCompany } from './companies.mjs';
import { canonicalUrl, normalizeText } from './normalize.mjs';
import { parseTitle } from './titles.mjs';

// A user decision in Trello is durable. Unlike automated low-score or
// guardrail results, it must never age back into discovery on its own.
export const DURABLE_STATUSES = new Set(['carded', 'dedup', 'rejected-user', 'not-applying-user', 'archived-user']);
export const USER_STATUSES = new Set(['rejected-user', 'not-applying-user', 'archived-user']);

export function roleKey(company, role) {
  return `${normalizeCompany(company)}::${normalizeText(role)}`;
}

function readEntries(path) {
  if (!existsSync(path)) return [];
  const entries = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* A corrupt append must not disable a scan. */ }
  }
  return entries;
}

export function loadLatestLedger(path = 'data/seen-postings.jsonl') {
  const latest = new Map();
  for (const entry of readEntries(path)) {
    if (entry.url) latest.set(canonicalUrl(entry.url), entry);
  }
  return latest;
}

// Company + normalized-role suppressions from user-resolved Trello cards. This
// covers old cards that never had a JD URL, which the URL index cannot see.
export function loadRoleExclusions(path = 'data/seen-postings.jsonl') {
  const latest = new Map();
  for (const entry of readEntries(path)) {
    if (entry.company && entry.role) latest.set(roleKey(entry.company, entry.role), entry.status);
  }
  return new Set([...latest].filter(([, status]) => USER_STATUSES.has(status)).map(([key]) => key));
}

export function familyKey(company, parsedTitle) {
  return `${normalizeCompany(company)}::${parsedTitle.core}`;
}

// Prior decisions grouped by company + parsed core role, so a new posting can be
// compared with earlier ones that differ only in seniority, specialty, or noise.
// Latest record wins per URL (or per company + title for URL-less user records).
// `extra` adds non-ledger decisions such as data/applications.md rows.
export function loadRoleHistory(path = 'data/seen-postings.jsonl', extra = []) {
  const latest = new Map();
  for (const entry of [...readEntries(path), ...extra]) {
    if (!entry.company || !entry.role) continue;
    latest.set(entry.url ? canonicalUrl(entry.url) : roleKey(entry.company, entry.role), entry);
  }
  const history = new Map();
  for (const entry of latest.values()) {
    const parsed = parseTitle(entry.role);
    const key = familyKey(entry.company, parsed);
    if (!history.has(key)) history.set(key, []);
    history.get(key).push({
      title: entry.role,
      status: entry.status,
      date: entry.last_checked || entry.date_seen || '',
      url: entry.url ? canonicalUrl(entry.url) : '',
      seniority: parsed.seniority,
      specialty: parsed.specialty,
    });
  }
  return history;
}

export function isSuppressed(posting, ledger, policy = {}, now = Date.now()) {
  const entry = ledger.get(canonicalUrl(posting.url));
  if (!entry) return false;
  if (DURABLE_STATUSES.has(entry.status)) return true;
  const checked = Date.parse(entry.last_checked || entry.date_seen || '');
  const age = Number.isFinite(checked) ? (now - checked) / 86_400_000 : Infinity;
  if (entry.status === 'closed') return age < (policy.recheck_days_closed ?? 30);
  if (/^rejected-/.test(entry.status || '')) return age < (policy.recheck_days_rejected ?? 30);
  return false;
}

export function appendLedger(records, path = 'data/seen-postings.jsonl') {
  if (!records.length) return;
  appendFileSync(path, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8');
}

export function ledgerRecord({ company, role, url, status, reason, sector }, date = new Date().toISOString().slice(0, 10)) {
  return { date_seen: date, company, role, url: url || '', status, reason, ...(sector ? { sector } : {}), last_checked: date };
}

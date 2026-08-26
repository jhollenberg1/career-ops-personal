import { existsSync, readFileSync } from 'fs';
import { canonicalUrl } from './normalize.mjs';

export function loadLatestLedger(path = 'data/seen-postings.jsonl') {
  const latest = new Map();
  if (!existsSync(path)) return latest;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.url) latest.set(canonicalUrl(entry.url), entry);
    } catch { /* A corrupt append must not disable a scan. */ }
  }
  return latest;
}

export function isSuppressed(posting, ledger, policy = {}, now = Date.now()) {
  const entry = ledger.get(canonicalUrl(posting.url));
  if (!entry) return false;
  if (entry.status === 'carded' || entry.status === 'dedup') return true;
  const checked = Date.parse(entry.last_checked || entry.date_seen || '');
  const age = Number.isFinite(checked) ? (now - checked) / 86_400_000 : Infinity;
  if (entry.status === 'closed') return age < (policy.recheck_days_closed ?? 30);
  if (/^rejected-/.test(entry.status || '')) return age < (policy.recheck_days_rejected ?? 30);
  return false;
}

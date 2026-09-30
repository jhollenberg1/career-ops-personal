import { existsSync, readFileSync } from 'fs';
import { normalizeText } from './normalize.mjs';

const LEGAL_SUFFIX = /\b(inc|llc|ltd|corp|corporation|co|company|pbc|plc|gmbh)\b/g;

export function normalizeCompany(name = '') {
  return normalizeText(String(name).replace(/\(.*?\)/g, ' ')).replace(LEGAL_SUFFIX, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeDomain(domain = '') {
  return String(domain).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].trim();
}

// seen-companies.jsonl holds both `{name, domain, status}` and older
// `{company, domain, status, ...}` records. Latest record per name or domain wins.
export function loadCompanyLedger(path = 'data/seen-companies.jsonl') {
  const byName = new Map();
  const byDomain = new Map();
  if (!existsSync(path)) return { byName, byDomain };
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const name = normalizeCompany(entry.name || entry.company || '');
      const domain = normalizeDomain(entry.domain || '');
      if (name) byName.set(name, entry);
      if (domain) byDomain.set(domain, entry);
    } catch { /* A corrupt append must not disable a scan. */ }
  }
  return { byName, byDomain };
}

export function companyStatus(ledger, { company, domain } = {}) {
  const entry = ledger.byName.get(normalizeCompany(company)) || ledger.byDomain.get(normalizeDomain(domain));
  return entry?.status || null;
}

export function trackedCompanyNames(config = {}) {
  return new Set((config.tracked_companies || [])
    .filter(entry => entry.enabled !== false)
    .map(entry => normalizeCompany(entry.name)));
}

export function excludedCompanyNames(profile = {}) {
  return new Set((profile.narrative?.excluded_companies || []).map(normalizeCompany));
}

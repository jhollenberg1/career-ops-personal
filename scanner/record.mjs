#!/usr/bin/env node
/**
 * Ledger writes that follow a Trello read or write.
 *
 *   node scanner/record.mjs carded <handoff.json> [url...]
 *     After populate-trello creates cards, append `carded` for every handoff role,
 *     or only for the listed URLs when some cards were not created.
 *
 *   node scanner/record.mjs user-resolved <cards.json>
 *     Role-scan step 5. cards.json is an array of {list, name, desc, archived?} read
 *     from the Job Applications board (Archived / No Apply, Rejected / Closed, and
 *     `is:archived` search results). Appends latest-wins user statuses.
 */
import { readFileSync } from 'fs';
import { loadConfig } from './config.mjs';
import { appendLedger, ledgerRecord, loadLatestLedger, loadRoleExclusions, roleKey } from './ledger.mjs';
import { canonicalUrl } from './normalize.mjs';

const REASON = 'User-resolved Trello role';

export function userStatusFor(card) {
  const list = String(card.list || '').toLowerCase();
  if (list.includes('no apply')) return 'not-applying-user';
  if (list.includes('rejected') || list.includes('closed')) return 'rejected-user';
  if (card.archived || list.includes('archived')) return 'archived-user';
  return null;
}

// Card names follow populate-trello's `{Company} — {Role}`. A card without that
// shape and without a JD link is a board instruction/template card.
export function parseCard(card) {
  const url = String(card.desc || '').match(/(?:Job link|Link):\s*<?(https?:\/\/[^\s>)]+)/i)?.[1] || '';
  const [company, ...rest] = String(card.name || '').split(/\s+[—–-]\s+/);
  const role = rest.join(' - ').trim();
  return { url: url && canonicalUrl(url), company: role ? company.trim() : '', role, status: userStatusFor(card) };
}

export function userResolvedRecords(cards, ledger, roleExclusions, date) {
  const records = [];
  const report = { recorded: 0, alreadyRecorded: 0, unlinked: [], ignored: [] };
  for (const card of cards) {
    const parsed = parseCard(card);
    if (!parsed.status || (!parsed.url && !parsed.role)) { report.ignored.push(card.name); continue; }
    const current = parsed.url ? ledger.get(parsed.url)?.status : roleExclusions.has(roleKey(parsed.company, parsed.role)) && parsed.status;
    if (current === parsed.status) { report.alreadyRecorded++; continue; }
    if (!parsed.url) report.unlinked.push(card.name);
    records.push(ledgerRecord({ company: parsed.company, role: parsed.role, url: parsed.url, status: parsed.status, reason: REASON }, date));
    report.recorded++;
  }
  return { records, report };
}

function main([command, file, ...urls]) {
  const config = loadConfig();
  const ledgerPath = config.seen_ledger?.file || 'data/seen-postings.jsonl';
  const date = new Date().toISOString().slice(0, 10);
  const ledger = loadLatestLedger(ledgerPath);

  if (command === 'carded' && file) {
    const handoff = JSON.parse(readFileSync(file, 'utf8'));
    const only = new Set(urls.map(canonicalUrl));
    const roles = (handoff.roles || []).filter(role => (!only.size || only.has(role.url)) && ledger.get(role.url)?.status !== 'carded');
    appendLedger(roles.map(role => ledgerRecord({ company: role.company, role: role.title, url: role.url, status: 'carded', reason: `${role.total.toFixed(1)}/10 — ${role.fit_summary}`, sector: role.sector }, date)), ledgerPath);
    console.log(`Recorded ${roles.length} carded role(s).`);
    return;
  }
  if (command === 'user-resolved' && file) {
    const { records, report } = userResolvedRecords(JSON.parse(readFileSync(file, 'utf8')), ledger, loadRoleExclusions(ledgerPath), date);
    appendLedger(records, ledgerPath);
    console.log(`Recorded ${report.recorded}, already recorded ${report.alreadyRecorded}, ignored ${report.ignored.length} instruction card(s).`);
    if (report.unlinked.length) console.log(`Cards with no JD link (suppressed by company + role; add a Link: to repair):\n${report.unlinked.map(name => `  ${name}`).join('\n')}`);
    return;
  }
  console.error('Usage: node scanner/record.mjs carded <handoff.json> [url...] | user-resolved <cards.json>');
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));

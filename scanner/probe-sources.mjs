#!/usr/bin/env node
/**
 * Find tracked companies configured for `websearch` or `careers_page` whose
 * careers URL is a Greenhouse, Lever, or Ashby board the scanner can read for
 * free, and test the API. With --write, switch working ones to `ats_api` in
 * portals.yml (line edit, so comments and ordering are preserved).
 *
 * Usage: node scanner/probe-sources.mjs [--write]
 */
import { readFileSync, writeFileSync } from 'fs';
import { loadConfig } from './config.mjs';
import { fetchAts, getAtsSource } from './sources/ats.mjs';

export function probeTargets(config) {
  return (config.tracked_companies || []).filter(entry =>
    entry.enabled !== false &&
    (entry.scan_method === 'websearch' || entry.scan_method === 'careers_page') &&
    getAtsSource({ ...entry, scan_method: 'ats_api' }));
}

export function switchToAtsApi(portalsText, names) {
  let current = null;
  return portalsText.split('\n').map(line => {
    const name = line.match(/^\s*- name:\s*["']?(.*?)["']?\s*$/);
    if (name) current = name[1];
    return names.has(current) ? line.replace(/^(\s*scan_method:\s*)(websearch|careers_page)\b/, '$1ats_api') : line;
  }).join('\n');
}

async function main(args) {
  const config = loadConfig();
  const targets = probeTargets(config);
  const results = await Promise.all(targets.map(entry => fetchAts({ ...entry, scan_method: 'ats_api' })));
  const working = results.filter(result => result.status === 'success');
  for (const result of results) {
    console.log(`${result.status === 'success' ? 'OK  ' : 'FAIL'} ${result.company.padEnd(32)} ${result.source.padEnd(10)} ${result.status === 'success' ? `${result.postings.length} jobs` : result.error}`);
  }
  console.log(`\n${working.length}/${targets.length} websearch/careers_page sources have a working ATS API.`);
  if (results.some(result => result.failureKind === 'network')) console.log('Some probes hit network errors; rerun with outbound network before trusting failures.');
  if (args.includes('--write') && working.length) {
    writeFileSync('portals.yml', switchToAtsApi(readFileSync('portals.yml', 'utf8'), new Set(working.map(result => result.company))), 'utf8');
    console.log(`Switched ${working.length} source(s) to scan_method: ats_api in portals.yml.`);
  } else if (working.length) {
    console.log('Dry run. Rerun with --write to switch them to ats_api.');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch(error => { console.error(`Probe failed: ${error.message}`); process.exitCode = 1; });
}

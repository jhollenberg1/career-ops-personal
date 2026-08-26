#!/usr/bin/env node
/**
 * lookup-companies.mjs — Company roster enricher
 *
 * Reads data/companies.csv, discovers each company's ATS (Greenhouse/Ashby/Lever),
 * fetches open roles, scores them against the profile scoring model, and writes
 * output/companies-lookup-{date}.csv ranked by combined score.
 *
 * Companies with matching roles → ranked by combined = (role_fit × 0.55) + (company_fit × 0.45)
 * Companies with no matching roles → ranked by company_fit, marked WATCHLIST
 * Companies where no ATS is detected → listed at end, marked MANUAL CHECK
 *
 * Zero LLM tokens — pure HTTP + JSON + keyword scoring.
 *
 * Usage:
 *   node lookup-companies.mjs              # full lookup
 *   node lookup-companies.mjs --dry-run   # preview, no output file written
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import yaml from 'js-yaml';

const COMPANIES_CSV = 'data/companies.csv';
const PORTALS_PATH = 'portals.yml';
const CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 12_000;

// ── CSV ─────────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cell += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      cells.push(cell);
      cell = '';
    } else {
      cell += c;
    }
  }
  cells.push(cell);
  return cells;
}

function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] ?? '').trim()]));
  });
}

function escapeCsv(val) {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

// ── ATS slug generation ─────────────────────────────────────────────

function generateSlugs(name) {
  const clean = name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|the|&)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const hyphenated = clean.replace(/\s+/g, '-');
  const nospaces = clean.replace(/\s+/g, '');
  const firstWord = clean.split(' ')[0];

  return [...new Set([hyphenated, nospaces, firstWord])].filter(Boolean);
}

// ── Fetch ───────────────────────────────────────────────────────────

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── ATS parsers ─────────────────────────────────────────────────────

function parseGreenhouse(json, company) {
  return (json.jobs || []).map(j => ({
    title: j.title || '',
    url: j.absolute_url || '',
    company,
    location: j.location?.name || '',
  }));
}

function parseAshby(json, company) {
  return (json.jobs || []).map(j => ({
    title: j.title || '',
    url: j.jobUrl || '',
    company,
    location: j.location || '',
    salary: j.compensationTierSummary || '',
  }));
}

function parseLever(json, company) {
  if (!Array.isArray(json)) return [];
  return json.map(j => ({
    title: j.text || '',
    url: j.hostedUrl || '',
    company,
    location: j.categories?.location || '',
  }));
}

// ── ATS discovery ───────────────────────────────────────────────────
// Tries all slug × ATS combos in parallel. Returns first valid hit.
// A hit is valid if the response has the expected shape (even if 0 jobs).

async function discoverAts(companyName) {
  const slugs = generateSlugs(companyName);

  const attempts = slugs.flatMap(slug => [
    { type: 'greenhouse', slug, url: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs` },
    { type: 'ashby',      slug, url: `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true` },
    { type: 'lever',      slug, url: `https://api.lever.co/v0/postings/${slug}` },
  ]);

  const tried = await Promise.all(
    attempts.map(async ({ type, slug, url }) => {
      const json = await fetchJson(url);
      if (!json) return null;

      let valid = false;
      let jobs = [];

      if (type === 'greenhouse' && Array.isArray(json.jobs)) {
        valid = true;
        jobs = parseGreenhouse(json, companyName);
      } else if (type === 'ashby' && Array.isArray(json.jobs)) {
        valid = true;
        jobs = parseAshby(json, companyName);
      } else if (type === 'lever' && Array.isArray(json)) {
        valid = true;
        jobs = parseLever(json, companyName);
      }

      return valid ? { type, slug, jobs } : null;
    })
  );

  // Prefer a hit with jobs; fall back to any valid board.
  const withJobs = tried.find(r => r && r.jobs.length > 0);
  const anyValid = tried.find(r => r !== null);
  return withJobs || anyValid || null;
}

// ── Title filter ────────────────────────────────────────────────────

function buildTitleFilter(titleFilter) {
  const positive = (titleFilter?.positive || []).map(k => k.toLowerCase());
  const negative = (titleFilter?.negative || []).map(k => k.toLowerCase());
  return title => {
    const lower = title.toLowerCase();
    const hasPos = positive.length === 0 || positive.some(k => lower.includes(k));
    const hasNeg = negative.some(k => lower.includes(k));
    return hasPos && !hasNeg;
  };
}

// ── Scoring ─────────────────────────────────────────────────────────

function scoreMissionFit(category, mission) {
  const t = `${category} ${mission}`.toLowerCase();
  if (/defense|military|surveillance|palantir|anduril/.test(t)) return 0;
  if (
    /criminal justice|incarcerat/.test(t) ||             // criminal justice reform
    /civic|govtech|government service/.test(t) ||        // civic/govtech (catches "civic infrastructure")
    /economic mobility/.test(t) ||                       // economic mobility
    /climate|emission|electrif/.test(t) ||               // climate & electrification
    /clean[\s-]energy|cleanenergy/.test(t) ||            // clean energy (with or without hyphen)
    /distributed energy|renewable|energy.*transit|cleaner grid|demand.side/.test(t) ||  // energy transition signals
    /food waste|circular economy/.test(t) ||             // food/waste reduction
    /humanitarian|poverty/.test(t) ||                    // global poverty/humanitarian
    /\beducation\b/.test(t) ||                           // education (primary mission)
    /voting|democracy/.test(t) ||                        // civic democracy
    /reproductive|maternal/.test(t) ||                   // reproductive health
    /mental health|healthcare access/.test(t)            // healthcare access
  ) return 5;
  if (/financial inclusion|affordable|social impact|environmental|energy/.test(t)) return 4;
  if (/consumer|small business/.test(t)) return 3;
  return 2;
}

function scoreJobFit(title) {
  const t = title.toLowerCase();

  // A. Role shape (0–2): does role combine tech depth with relationship work?
  const hasTech = /implement|solutions|integrat|technical|deploy|forward deployed|field engineer|pre.?sales/.test(t);
  const hasRel  = /implement|solutions|partner|business development|customer|account|revenue|ops|operat|strategy|chief of staff|biz dev|gtm/.test(t);
  const roleShape = (hasTech && hasRel) ? 2 : (hasTech || hasRel) ? 1 : 0.5;

  // B. Qualification fit (0–2): level proxy from title
  const qualFit = /director|vp |vice president/.test(t) ? 1
    : /senior|lead|principal/.test(t) ? 1.5
    : 2;

  // C. Archetype alignment (0–1): matches target archetypes?
  const archetype =
    /implementation engineer|solutions engineer|forward deployed|deployment engineer|technical implementation|integration engineer|pre.?sales/.test(t) ? 1
    : /revenue operations|revops|gtm|sales ops|business operations|bizops|partnerships|business development|strategy.*ops|chief of staff/.test(t) ? 1
    : /customer success|technical account/.test(t) ? 0.5
    : 0;

  return Math.min(5, Math.max(1, roleShape + qualFit + archetype));
}

// ── Concurrency ─────────────────────────────────────────────────────

async function parallelFetch(tasks, limit) {
  const results = new Array(tasks.length);
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (!existsSync(COMPANIES_CSV)) {
    console.error(`Error: ${COMPANIES_CSV} not found.`);
    process.exit(1);
  }
  if (!existsSync(PORTALS_PATH)) {
    console.error(`Error: ${PORTALS_PATH} not found.`);
    process.exit(1);
  }

  const config = yaml.load(readFileSync(PORTALS_PATH, 'utf-8'));
  const titleFilter = buildTitleFilter(config.title_filter);
  const companies = parseCsv(readFileSync(COMPANIES_CSV, 'utf-8'));

  console.log(`Loaded ${companies.length} companies from ${COMPANIES_CSV}`);
  console.log(`Discovering job boards...\n`);

  const tasks = companies.map(company => async () => {
    const label = company.Company.padEnd(24);
    const companyFit = scoreMissionFit(company.Category, company.Mission);

    const ats = await discoverAts(company.Company);

    if (!ats) {
      process.stdout.write(`  ${label} no ATS detected\n`);
      return { ...company, _atsFound: false, _hasRoles: false, _atsMissing: true, company_fit: companyFit, combined: companyFit };
    }

    const matching = ats.jobs.filter(j => titleFilter(j.title));
    process.stdout.write(`  ${label} ${ats.type}/${ats.slug} — ${matching.length}/${ats.jobs.length} matching\n`);

    if (matching.length === 0) {
      return {
        ...company,
        _atsFound: true, _hasRoles: false, _atsMissing: false,
        ats: ats.type, ats_slug: ats.slug,
        open_roles: 0, best_role: '', best_role_url: '', all_matching_roles: '',
        role_fit: '', company_fit: companyFit, combined: companyFit,
      };
    }

    const scored = matching
      .map(j => ({ ...j, role_fit: scoreJobFit(j.title), combined: scoreJobFit(j.title) * 0.55 + companyFit * 0.45 }))
      .sort((a, b) => b.combined - a.combined);

    const best = scored[0];
    const allRoles = scored.map(j => `${j.title} [${j.combined.toFixed(1)}]`).join(' | ');

    return {
      ...company,
      _atsFound: true, _hasRoles: true, _atsMissing: false,
      ats: ats.type, ats_slug: ats.slug,
      open_roles: matching.length,
      best_role: best.title,
      best_role_url: best.url,
      all_matching_roles: allRoles,
      role_fit: best.role_fit.toFixed(1),
      company_fit: companyFit,
      combined: best.combined.toFixed(2),
    };
  });

  const enriched = await parallelFetch(tasks, CONCURRENCY);

  // Sort: roles found → by combined desc; no roles but ATS found → by company_fit; no ATS → last
  enriched.sort((a, b) => {
    if (a._hasRoles !== b._hasRoles) return a._hasRoles ? -1 : 1;
    if (a._atsMissing !== b._atsMissing) return a._atsMissing ? 1 : -1;
    return parseFloat(b.combined) - parseFloat(a.combined);
  });

  enriched.forEach((r, i) => { r.rank = i + 1; });

  // ── Summary ─────────────────────────────────────────────────────

  const withRoles  = enriched.filter(r => r._hasRoles);
  const watchlist  = enriched.filter(r => !r._hasRoles && !r._atsMissing);
  const noAts      = enriched.filter(r => r._atsMissing);
  const date       = new Date().toISOString().slice(0, 10);

  console.log(`\n${'━'.repeat(60)}`);
  console.log(`Company Lookup — ${date}`);
  console.log(`${'━'.repeat(60)}`);
  console.log(`Companies checked:       ${enriched.length}`);
  console.log(`With matching roles:     ${withRoles.length}`);
  console.log(`ATS found, no matches:   ${watchlist.length}`);
  console.log(`No ATS detected:         ${noAts.length}  ← verify manually`);

  if (withRoles.length > 0) {
    console.log('\nRanked roles:');
    withRoles.forEach((r, i) => {
      const role = r.best_role.length > 38 ? r.best_role.slice(0, 35) + '...' : r.best_role;
      console.log(`  ${String(i + 1).padStart(2)}. ${r.Company.padEnd(22)} ${role.padEnd(40)} JF:${r.role_fit}  MF:${r.company_fit}  →  ${r.combined}`);
    });
  }

  if (watchlist.length > 0) {
    console.log('\nWATCHLIST — ATS found, no current role match:');
    watchlist.forEach(r => console.log(`       ${r.Company.padEnd(22)} (${r.ats}/${r.ats_slug})`));
  }

  if (noAts.length > 0) {
    console.log('\nMANUAL CHECK — no standard ATS detected:');
    noAts.forEach(r => console.log(`       ${r.Company}`));
  }

  if (dryRun) {
    console.log('\n(dry run — run without --dry-run to write output file)');
    return;
  }

  // ── Write output CSV ─────────────────────────────────────────────

  mkdirSync('output', { recursive: true });
  const outPath = `output/companies-lookup-${date}.csv`;

  const outHeaders = [
    'rank', 'status', 'Company', 'Category', 'Mission', 'Pros', 'Cons',
    'ats', 'ats_slug', 'open_roles',
    'best_role', 'best_role_url', 'all_matching_roles',
    'role_fit', 'company_fit', 'combined',
  ];

  const rows = enriched.map(r => {
    const status = r._hasRoles ? 'roles_found' : r._atsMissing ? 'no_ats' : 'watchlist';
    return outHeaders.map(h => {
      if (h === 'status') return status;
      return r[h] ?? '';
    });
  });

  const csv = [outHeaders, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n') + '\n';
  writeFileSync(outPath, csv, 'utf-8');

  console.log(`\nSaved: ${outPath}`);
  console.log(`Open in Excel / Google Sheets for the ranked view.`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

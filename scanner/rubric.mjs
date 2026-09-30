import { readFileSync } from 'fs';
import { normalizeText } from './normalize.mjs';

// Deterministic parts of evals/rubric.md (v6.3). The model supplies the hard-gate
// judgment and the four adjustments; everything arithmetic lives here.

export const TITLE_BASES_PATH = 'evals/title-bases.json';

// Advisory ranges from the rubric. Values outside them are allowed, but only
// with a written rationale, so they are reported rather than rejected.
export const ADJUSTMENT_RANGES = {
  role_shape: [-1.0, 0.5],
  qualification: [-2.0, 0.3],
  company: [-1.2, 1.3],
  salary: [-1.0, 0.6],
};

export const SALARY_FLOOR = 80_000;

export function loadTitleBases(path = TITLE_BASES_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Each entry in title-bases.json is either a number or {base, aliases}. Aliases are
// Joshua-approved alternate titles for the same role and inherit its base.
function titlePhrases(bases) {
  return Object.entries(bases).flatMap(([name, value]) => {
    const base = typeof value === 'number' ? value : value.base;
    const aliases = typeof value === 'number' ? [] : value.aliases || [];
    return [name, ...aliases].map(phrase => ({ phrase: normalizeText(phrase), title: name, base }));
  });
}

// The longest approved phrase contained in the posting title wins, so "Senior
// Customer Solutions Engineer" resolves to Customer Solutions Engineer rather than
// Solutions Engineer. No fuzzy matching: other titles go to the model's judgment.
export function titleBaseFor(title, bases) {
  const value = ` ${normalizeText(title)} `;
  let best = null;
  for (const entry of titlePhrases(bases)) {
    if (value.includes(` ${entry.phrase} `) && (!best || entry.phrase.length > best.phrase.length)) best = entry;
  }
  return best && { title: best.title, base: best.base };
}

// A code match wins. Otherwise the model's `title_base_match` is accepted only when
// it names an approved entry exactly; null or anything else means no base.
export function resolveTitleBase(title, modelMatch, bases) {
  const matched = titleBaseFor(title, bases);
  if (matched) return { ...matched, source: 'title' };
  const entry = typeof modelMatch === 'string' ? bases[modelMatch.trim()] : undefined;
  if (entry === undefined) return null;
  return { title: modelMatch.trim(), base: typeof entry === 'number' ? entry : entry.base, source: 'model' };
}

export function parseSalaryRange(text = '') {
  const value = String(text).toLowerCase().replace(/,/g, '');
  const hourly = /\/\s*h(ou)?r|per hour|hourly/.test(value);
  const thousands = /\d\s*k\b/.test(value);
  const numbers = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(k)?/g)]
    .map(([, amount, suffix]) => {
      let parsed = Number(amount);
      if (suffix || (thousands && parsed < 1000 && !hourly)) parsed *= 1000;
      if (hourly) parsed *= 2080;
      return parsed;
    })
    .filter(amount => amount >= 10_000);
  if (!numbers.length) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

// Rubric section 5 default for a stated range, keyed on its midpoint. It is a
// reference point for auditing the model's salary adjustment, not a rule.
export function salaryDefault(range) {
  if (!range) return 0.0;
  const mid = (range.min + range.max) / 2;
  if (mid < 100_000) return -1.0;
  if (mid < 130_000) return -0.2;
  if (mid < 160_000) return 0.2;
  if (mid <= 180_000) return 0.5;
  return 0.6;
}

export function isBelowSalaryFloor(range) {
  return Boolean(range) && range.max < SALARY_FLOOR;
}

const round1 = value => Math.round(value * 10) / 10;

export function computeTotal(base, hardGate, adjustments = {}) {
  if (String(hardGate).toLowerCase() === 'reject') return 0.0;
  const sum = Object.keys(ADJUSTMENT_RANGES).reduce((total, kind) => total + round1(Number(adjustments[kind] || 0)), 0);
  return round1(Math.max(0, Math.min(10, base + sum)));
}

export function band(total) {
  return total >= 8.0 ? 'Pass' : total >= 6.0 ? 'Needs review' : 'Reject';
}

export function adjustmentOutliers(adjustments = {}) {
  return Object.entries(ADJUSTMENT_RANGES)
    .filter(([kind, [lower, upper]]) => {
      const value = round1(Number(adjustments[kind] || 0));
      return value < lower || value > upper;
    })
    .map(([kind, [lower, upper]]) => `${kind} ${Number(adjustments[kind]).toFixed(1)} (default ${lower} to ${upper})`);
}

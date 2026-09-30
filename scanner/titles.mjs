import { normalizeText } from './normalize.mjs';

// Split a posting title into seniority, core role, specialty, and noise, so that
// "Sr. Implementation Engineer - Remote" and "Implementation Engineer (NYC)" share a
// core role and differ only in seniority. This is used to compare a posting with
// earlier decisions at the same company. It does not decide whether two different
// titles are the same job; the scoring model makes that call against title-bases.json.

// Ordinal seniority. A title with no recognized modifier is level 2 (mid).
const LEADING_LEVELS = {
  intern: 0, internship: 0, apprentice: 0, 'new grad': 0,
  junior: 1, jr: 1, entry: 1, 'entry level': 1, associate: 1,
  'mid level': 2,
  senior: 3, sr: 3,
  lead: 4,
  staff: 5,
  principal: 6, 'associate principal': 6, distinguished: 6, fellow: 6,
  director: 7, 'associate director': 7, head: 7, 'head of': 7, vp: 7, svp: 7, evp: 7, 'vice president': 7, chief: 7,
};
const TRAILING_LEVELS = { i: 1, 1: 1, ii: 2, 2: 2, iii: 3, 3: 3, iv: 5, 4: 5 };
export const DEFAULT_SENIORITY = 2;

// A segment made only of these tokens is location, arrangement, or posting noise.
// An unknown city becomes a specialty instead, which only makes two titles look
// related rather than identical: the safe direction for dedupe.
const NOISE_TOKENS = new Set([
  'remote', 'hybrid', 'onsite', 'on', 'site', 'in', 'office', 'first', 'only', 'based', 'friendly',
  'contract', 'contractor', 'temporary', 'temp', 'part', 'full', 'time', 'month', 'months', 'year',
  'new', 'grad', 'graduate', 'start', 'date', 'standing', 'interest', 'pool', 'general', 'evergreen',
  'us', 'usa', 'u', 's', 'united', 'states', 'america', 'north', 'south', 'east', 'west', 'central',
  'region', 'metro', 'area', 'city', 'nyc', 'york', 'ny', 'nj', 'boston', 'sf', 'san', 'francisco',
  'bay', 'chicago', 'seattle', 'austin', 'denver', 'dc', 'washington', 'la', 'los', 'angeles',
  'emea', 'apac', 'americas', 'canada', 'uk', 'london', 'anywhere', 'and', 'or', 'the', 'of', 'a',
]);

function isNoise(normalized) {
  const tokens = normalized.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every(token => NOISE_TOKENS.has(token) || /^\d+$/.test(token));
}

// Remove leading seniority words, never consuming the whole title ("Associate" or
// "Associate Principal" alone stays the role, with its level recorded).
function takeLeading(tokens, levels) {
  while (tokens.length > 1) {
    const two = `${tokens[0]} ${tokens[1]}`;
    if (two in LEADING_LEVELS) {
      levels.push(LEADING_LEVELS[two]);
      if (tokens.length === 2) break;
      tokens.splice(0, 2);
      continue;
    }
    if (tokens[0] in LEADING_LEVELS) { levels.push(LEADING_LEVELS[tokens.shift()]); continue; }
    break;
  }
  // "Director of Implementation" leaves "of implementation".
  if (tokens.length > 1 && tokens[0] === 'of') tokens.shift();
  return tokens;
}

export function parseTitle(title = '') {
  const levels = [];
  const noise = [];
  const specialty = [];

  const classify = segment => {
    const value = normalizeText(segment);
    if (!value) return;
    if (value in LEADING_LEVELS) { levels.push(LEADING_LEVELS[value]); return; }
    if (isNoise(value)) { noise.push(value); return; }
    const rest = takeLeading(value.split(' '), levels).join(' ');
    if (rest in LEADING_LEVELS) levels.push(LEADING_LEVELS[rest]);
    else specialty.push(rest);
  };

  let raw = String(title).replace(/\s+/g, ' ').trim();
  raw = raw.replace(/\(([^)]*)\)/g, (_, inner) => { classify(inner); return ' '; });
  // "Senior/Software Engineer II" is a range; keep the lower end so a rejection of
  // the senior version never suppresses the junior one.
  raw = raw.replace(/^([A-Za-z.]+)\/(?=[A-Za-z])/, (match, word) => (normalizeText(word) in LEADING_LEVELS ? '' : match));

  const parts = raw.split(/\s+[-–—|]\s+|\s*[,:;]\s*|\s+\/\s+/).map(part => part.trim()).filter(Boolean);
  const headIndex = parts.findIndex(part => {
    const value = normalizeText(part);
    return value && !isNoise(value);
  });
  parts.forEach((part, index) => { if (index !== headIndex) classify(part); });

  const tokens = takeLeading(normalizeText(parts[headIndex] || '').split(' ').filter(Boolean), levels);
  if (tokens.length > 1 && tokens[tokens.length - 1] in TRAILING_LEVELS) levels.push(TRAILING_LEVELS[tokens.pop()]);

  return {
    core: tokens.join(' '),
    seniority: levels.length ? Math.max(...levels) : DEFAULT_SENIORITY,
    specialty: specialty.join(' '),
    noise,
  };
}

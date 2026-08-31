import { readFileSync } from 'fs';
import yaml from 'js-yaml';

export function loadConfig(path = 'portals.yml') {
  return yaml.load(readFileSync(path, 'utf8')) || {};
}

export function selectCompanies(config, { full = false, company } = {}) {
  const watchlist = new Set((config.scan_scope?.active_watchlist || []).map(name => name.toLowerCase()));
  const query = company?.toLowerCase();
  const enabled = (config.tracked_companies || []).filter(entry =>
    entry.enabled !== false &&
    (!query || entry.name.toLowerCase().includes(query))
  );
  if (query || full) return enabled;

  // A daily scan covers every explicitly verified API source. Retain the
  // legacy watchlist only for older configs that have not yet adopted source
  // methods, rather than silently narrowing a health-aware configuration.
  const apiSources = enabled.filter(entry => entry.scan_method === 'ats_api');
  if (apiSources.length) return apiSources;
  return watchlist.size ? enabled.filter(entry => watchlist.has(entry.name.toLowerCase())) : enabled;
}

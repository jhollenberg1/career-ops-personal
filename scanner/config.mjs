import { readFileSync } from 'fs';
import yaml from 'js-yaml';

export function loadConfig(path = 'portals.yml') {
  return yaml.load(readFileSync(path, 'utf8')) || {};
}

export function selectCompanies(config, { full = false, company } = {}) {
  const watchlist = new Set((config.scan_scope?.active_watchlist || []).map(name => name.toLowerCase()));
  const query = company?.toLowerCase();
  return (config.tracked_companies || []).filter(entry =>
    entry.enabled !== false &&
    (!query || entry.name.toLowerCase().includes(query)) &&
    (query || full || watchlist.size === 0 || watchlist.has(entry.name.toLowerCase()))
  );
}

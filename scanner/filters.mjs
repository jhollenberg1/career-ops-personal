export function buildTitleFilter(titleFilter = {}) {
  // `positive` is retained for backward-compatible user configurations. Newer
  // profiles separate high-confidence Core titles from JD-led Explore titles.
  const positive = [
    ...(titleFilter.positive || []),
    ...(titleFilter.core || []),
    ...(titleFilter.explore || []),
  ].map(value => value.toLowerCase());
  const negative = (titleFilter.negative || []).map(value => value.toLowerCase());
  return title => {
    const value = title.toLowerCase();
    return (positive.length === 0 || positive.some(term => value.includes(term))) &&
      !negative.some(term => value.includes(term));
  };
}

export function buildLocationFilter(locationFilter = {}) {
  if (locationFilter.enabled === false) return () => true;
  const remoteKeywords = (locationFilter.remote_keywords || ['remote', 'anywhere', 'distributed'])
    .map(value => value.toLowerCase());
  const allowed = (locationFilter.allowed || []).map(value => value.toLowerCase());
  const abbreviations = (locationFilter.allowed_abbrev || []).map(value => value.toLowerCase());
  const nonUsRemote = (locationFilter.remote_excluded || []).map(value => value.toLowerCase());
  const remoteUsOnly = locationFilter.remote_us_only === true;
  const keepUnknown = locationFilter.keep_unknown !== false;
  const abbreviation = abbreviations.length
    ? new RegExp(`\\b(${abbreviations.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i')
    : null;

  return location => {
    const value = String(location || '').trim().toLowerCase();
    if (!value) return keepUnknown;
    const remote = remoteKeywords.some(term => value.includes(term));
    if (locationFilter.remote_ok !== false && remote) {
      const nonUs = nonUsRemote.some(term => value.includes(term));
      const us = /\b(us|u\.s\.?|usa|united states)\b/.test(value);
      if (!remoteUsOnly || !nonUs || us) return true;
    }
    return allowed.some(term => value.includes(term)) || Boolean(abbreviation?.test(value));
  };
}

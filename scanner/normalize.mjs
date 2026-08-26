const TRACKING_PARAM = /^(utm_|gh_|source$|ref$|referrer$|lever-source$)/i;

export function normalizeText(value = '') {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function canonicalUrl(value = '') {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function postingKey(posting) {
  return `${normalizeText(posting.company)}::${normalizeText(posting.title)}::${normalizeText(posting.location)}`;
}

export function normalizePosting(posting) {
  return {
    ...posting,
    title: String(posting.title || '').replace(/\s+/g, ' ').trim(),
    company: String(posting.company || '').replace(/\s+/g, ' ').trim(),
    location: String(posting.location || '').replace(/\s+/g, ' ').trim(),
    url: canonicalUrl(posting.url || ''),
  };
}

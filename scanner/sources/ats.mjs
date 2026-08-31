function inferAtsSource(company) {
  const careersUrl = company.careers_url || '';
  if (company.api?.includes('greenhouse')) return { type: 'greenhouse', url: company.api };
  if (company.api?.includes('ashby')) return { type: 'ashby', url: company.api };
  if (company.api?.includes('lever')) return { type: 'lever', url: company.api };
  const ashby = careersUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (ashby) return { type: 'ashby', url: `https://api.ashbyhq.com/posting-api/job-board/${ashby[1]}?includeCompensation=true` };
  const lever = careersUrl.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (lever) return { type: 'lever', url: `https://api.lever.co/v0/postings/${lever[1]}` };
  const greenhouse = careersUrl.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  if (greenhouse) return { type: 'greenhouse', url: `https://boards-api.greenhouse.io/v1/boards/${greenhouse[1]}/jobs` };
  return null;
}

function sourceFromCompany(company) {
  // `scan_method` is the source-of-truth policy. Do not derive an ATS endpoint
  // from a URL when the record says that it needs browser or search coverage.
  if (company.scan_method === 'websearch') {
    return { type: 'websearch', status: 'deferred', reason: 'configured for web search' };
  }
  if (company.scan_method === 'careers_page') {
    return { type: 'careers_page', status: 'deferred', reason: 'configured for careers-page scan' };
  }
  return inferAtsSource(company);
}

function parse(type, body, company) {
  if (type === 'greenhouse') return (body.jobs || []).map(job => ({ title: job.title, url: job.absolute_url, location: job.location?.name }));
  if (type === 'ashby') return (body.jobs || []).map(job => ({ title: job.title, url: job.jobUrl, location: job.location, salary: job.compensationTierSummary }));
  if (type === 'lever') return (Array.isArray(body) ? body : []).map(job => ({ title: job.text, url: job.hostedUrl || job.applyUrl, location: job.categories?.location }));
  return [];
}

function failureKind(error) {
  const code = error?.cause?.code || error?.code;
  if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code) || error?.name === 'AbortError') return 'network';
  return 'source';
}

export function getAtsSource(company) {
  return sourceFromCompany(company);
}

export async function fetchAts(company, { timeoutMs = 25_000, fetchImpl = fetch } = {}) {
  const source = sourceFromCompany(company);
  if (!source) return { company: company.name, source: 'none', status: 'unavailable', postings: [] };
  if (source.status === 'deferred') {
    return { company: company.name, source: source.type, status: 'deferred', error: source.reason, postings: [] };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(source.url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    return {
      company: company.name,
      source: source.type,
      status: 'success',
      postings: parse(source.type, body, company.name).map(posting => ({ ...posting, company: company.name, source: `${source.type}-api` })),
    };
  } catch (error) {
    return { company: company.name, source: source.type, status: 'failed', failureKind: failureKind(error), error: error.message, postings: [] };
  } finally {
    clearTimeout(timer);
  }
}

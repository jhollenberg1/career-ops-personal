function sourceFromCompany(company) {
  const careersUrl = company.careers_url || '';
  if (company.api?.includes('greenhouse')) return { type: 'greenhouse', url: company.api };
  const ashby = careersUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (ashby) return { type: 'ashby', url: `https://api.ashbyhq.com/posting-api/job-board/${ashby[1]}?includeCompensation=true` };
  const lever = careersUrl.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (lever) return { type: 'lever', url: `https://api.lever.co/v0/postings/${lever[1]}` };
  const greenhouse = careersUrl.match(/job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  if (greenhouse) return { type: 'greenhouse', url: `https://boards-api.greenhouse.io/v1/boards/${greenhouse[1]}/jobs` };
  return null;
}

function parse(type, body, company) {
  if (type === 'greenhouse') return (body.jobs || []).map(job => ({ title: job.title, url: job.absolute_url, location: job.location?.name }));
  if (type === 'ashby') return (body.jobs || []).map(job => ({ title: job.title, url: job.jobUrl, location: job.location, salary: job.compensationTierSummary }));
  if (type === 'lever') return (Array.isArray(body) ? body : []).map(job => ({ title: job.text, url: job.hostedUrl || job.applyUrl, location: job.categories?.location }));
  return [];
}

export function getAtsSource(company) {
  return sourceFromCompany(company);
}

export async function fetchAts(company, { timeoutMs = 25_000, fetchImpl = fetch } = {}) {
  const source = sourceFromCompany(company);
  if (!source) return { company: company.name, source: 'none', status: 'unavailable', postings: [] };
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
    return { company: company.name, source: source.type, status: 'failed', error: error.message, postings: [] };
  } finally {
    clearTimeout(timer);
  }
}

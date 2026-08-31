#!/usr/bin/env node

/**
 * Validate public job-detail URLs immediately before scoring or carding them.
 * Discovery sources are leads; only an `active` result is eligible for a board.
 *
 * Usage: node validate-postings.mjs <url> [url...]
 */
import { PostingVerifier } from './scanner/verify.mjs';

export async function validatePostings(urls, { createVerifier = () => new PostingVerifier() } = {}) {
  const verifier = createVerifier();
  try {
    // PostingVerifier owns one Playwright page. Navigate it serially so one posting's
    // redirect or body cannot be read as another posting's result.
    const results = [];
    for (const url of urls) results.push({ url, ...(await verifier.verify(url)) });
    return results;
  } finally {
    await verifier.close();
  }
}

async function main() {
  const urls = process.argv.slice(2).filter(value => /^https?:\/\//.test(value));
  if (!urls.length) {
    console.error('Usage: node validate-postings.mjs <url> [url...]');
    process.exitCode = 1;
    return;
  }
  const results = await validatePostings(urls);
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (results.some(result => result.result !== 'active')) process.exitCode = 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`Validation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

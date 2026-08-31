import assert from 'node:assert/strict';
import { validatePostings } from '../../validate-postings.mjs';

let inFlight = 0;
let maxInFlight = 0;
let closed = false;
const verifier = {
  async verify(url) {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, 5));
    inFlight -= 1;
    return { result: 'active', finalUrl: `${url}/final` };
  },
  async close() { closed = true; },
};

const urls = ['https://example.test/one', 'https://example.test/two'];
const results = await validatePostings(urls, { createVerifier: () => verifier });

assert.equal(maxInFlight, 1, 'a single verifier page must not navigate concurrently');
assert.equal(closed, true);
assert.deepEqual(results, [
  { url: urls[0], result: 'active', finalUrl: `${urls[0]}/final` },
  { url: urls[1], result: 'active', finalUrl: `${urls[1]}/final` },
]);

console.log('validate-postings tests passed');

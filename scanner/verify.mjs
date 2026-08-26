import { chromium } from 'playwright';
import { classifyLiveness } from '../liveness-core.mjs';

export class PostingVerifier {
  #browser;
  #page;

  async verify(url) {
    this.#browser ??= await chromium.launch({ headless: true });
    this.#page ??= await this.#browser.newPage();
    try {
      const response = await this.#page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await this.#page.waitForTimeout(1_500);
      const bodyText = await this.#page.evaluate(() => document.body?.innerText || '');
      const applyControls = await this.#page.evaluate(() => Array.from(document.querySelectorAll('a,button,input[type="submit"],[role="button"]'))
        .filter(node => !node.closest('nav,header,footer,[aria-hidden="true"]') && node.getClientRects().length)
        .map(node => [node.innerText, node.value, node.getAttribute('aria-label'), node.getAttribute('title')].filter(Boolean).join(' ').trim())
        .filter(Boolean));
      return { ...classifyLiveness({ status: response?.status() || 0, finalUrl: this.#page.url(), bodyText, applyControls }), checkedAt: new Date().toISOString(), finalUrl: this.#page.url() };
    } catch (error) {
      return { result: 'expired', reason: `navigation error: ${error.message.split('\n')[0]}`, checkedAt: new Date().toISOString(), finalUrl: url };
    }
  }

  async close() {
    await this.#browser?.close();
  }
}

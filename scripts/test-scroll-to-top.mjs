import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = new URL(process.env.SCROLL_TO_TOP_BASE_URL || 'http://127.0.0.1:4321');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
  const button = page.locator('[data-scroll-to-top]');
  assert.equal(await button.isVisible(), false, 'scroll-to-top button starts hidden');
  await page.evaluate(() => window.scrollTo(0, 1200));
  await button.waitFor({ state: 'visible' });
  assert.equal(await button.getAttribute('aria-label'), 'Scroll to top');
  await button.click();
  await page.waitForFunction(() => window.scrollY === 0);
  assert.equal(await button.isVisible(), false, 'button hides again at the top');
  await context.close();
  console.log('Scroll-to-top checks passed: hidden initially, shown after scrolling, accessible label, reduced-motion return, and hidden at top.');
} finally {
  await browser.close();
}

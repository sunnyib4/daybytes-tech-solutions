import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = new URL(process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:4321');
const widths = [320, 375, 390, 768, 1280];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const indexResponse = await page.goto(new URL('/sitemap-index.xml', baseUrl).href, { waitUntil: 'domcontentloaded' });
  assert.equal(indexResponse?.status(), 200, 'sitemap index must return 200');
  const indexXml = await page.locator('body').innerText();
  const sitemapPath = indexXml.match(/<loc>(.*?)<\/loc>/)?.[1];
  assert.ok(sitemapPath, 'sitemap index must contain a sitemap location');

  const sitemapResponse = await page.goto(new URL(new URL(sitemapPath).pathname, baseUrl).href, { waitUntil: 'domcontentloaded' });
  assert.equal(sitemapResponse?.status(), 200, 'sitemap shard must return 200');
  const sitemapXml = await page.locator('body').innerText();
  const routes = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  assert.ok(routes.length > 0, 'sitemap shard must contain pages');

  const failures = [];
  for (const route of routes) {
    const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'domcontentloaded' });
    if (response?.status() !== 200) failures.push(`${route}: HTTP ${response?.status() ?? 'no response'}`);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const measurement = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        activeProblem: document.querySelector('[data-slide][data-active] [data-typed]')?.textContent,
        offenders: [...document.querySelectorAll('body *')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              id: element.id,
              className: typeof element.className === 'string' ? element.className : '',
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            };
          })
          .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.right > innerWidth + 1)
          .sort((left, right) => (right.scrollWidth - right.clientWidth) - (left.scrollWidth - left.clientWidth))
          .slice(0, 10),
      }));
      if (measurement.scroll > measurement.viewport) {
        failures.push(`${route} at ${width}px: ${JSON.stringify(measurement)}`);
      }
    }
  }

  const touchContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(new URL('/', baseUrl).href, { waitUntil: 'domcontentloaded' });
  const menuButton = touchPage.locator('#menu-button');
  await menuButton.waitFor();
  await touchPage.waitForTimeout(150);
  await menuButton.tap();
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'true', 'touch tap should open menu');
  await menuButton.focus();
  await touchPage.keyboard.press('Enter');
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'false', 'Enter should toggle menu closed');
  await touchPage.keyboard.press('Enter');
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'true', 'Enter should toggle menu open');
  await touchPage.keyboard.press('Escape');
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'false', 'Escape should close menu');
  await touchContext.close();

  console.log(`Responsive checks: ${routes.length} sitemap pages x ${widths.length} widths (${routes.length * widths.length} checks).`);
  console.log('Mobile menu checks: touch tap, Enter open/close, Escape close passed.');
  if (failures.length) {
    console.error(`Responsive failures (${failures.length}):\n${failures.join('\n')}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = new URL(process.env.VERIFICATION_BASE_URL || 'http://127.0.0.1:4321');
const slug = '3gzc55rgaz';
const certificateNumber = 'DBT-FE-2026-001';
const axeResponse = await fetch('https://unpkg.com/axe-core@4.14.0/axe.min.js');
assert.equal(axeResponse.status, 200, `axe-core download failed: HTTP ${axeResponse.status}`);
const axeSource = await axeResponse.text();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('verification-theme-initialized')) return;
    localStorage.setItem('theme', 'light');
    sessionStorage.setItem('verification-theme-initialized', 'true');
  });
  const pageResponse = await page.goto(new URL(`/verify/${slug}`, baseUrl).href, { waitUntil: 'networkidle' });
  assert.equal(pageResponse?.status(), 200, 'published graduate route must return 200');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow, noarchive');
  assert.equal(await page.locator('meta[name="referrer"]').getAttribute('content'), 'no-referrer');
  await page.getByText('Certificate verified', { exact: true }).waitFor();
  await page.getByText('Ajomale Isaac Oloruntoba', { exact: true }).waitFor();
  await page.getByText('Front-End Developer training programme', { exact: true }).waitFor();
  await page.getByText(certificateNumber, { exact: true }).waitFor();
  await page.getByText('Issued by Daybytes Tech Solutions, Lagos, Nigeria', { exact: true }).waitFor();
  const themeToggle = page.getByRole('button', { name: 'Switch to dark mode' });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await themeToggle.click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await page.getByRole('button', { name: 'Switch to light mode' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'dark');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'dark theme should restore from storage');
  assert.equal(await page.getByRole('button', { name: 'Switch to light mode' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'light');

  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.viewport, `320px horizontal overflow: ${JSON.stringify(dimensions)}`);
  assert.equal(await page.locator('header, nav, footer').count(), 0, 'private page must not include site navigation or footer');
  assert.equal(await page.locator('script[src]').count(), 0, 'private page must not load third-party or external scripts');
  assert.equal(await page.locator('script[type="application/ld+json"]').count(), 0, 'private page must not include structured data');

  for (const [label, href] of [
    ['View portfolio', 'https://dripsic.github.io/my-portfolio/'],
    ['GitHub profile', 'https://github.com/dripsic'],
  ]) {
    const link = page.getByRole('link', { name: label });
    assert.equal(await link.getAttribute('href'), href);
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  }
  const email = await page.getByRole('link', { name: 'Email Daybytes' }).getAttribute('href');
  assert.ok(email.includes(`subject=${encodeURIComponent(certificateNumber)}`));
  const whatsapp = await page.getByRole('link', { name: 'WhatsApp Daybytes' }).getAttribute('href');
  assert.ok(whatsapp.includes(encodeURIComponent(certificateNumber)));

  const sitemapResponse = await page.goto(new URL('/sitemap-0.xml', baseUrl).href, { waitUntil: 'domcontentloaded' });
  assert.equal(sitemapResponse?.status(), 200);
  assert.doesNotMatch(await page.locator('body').innerText(), /\/verify\//, 'private route must not appear in sitemap');
  const llmsResponse = await page.goto(new URL('/llms.txt', baseUrl).href, { waitUntil: 'domcontentloaded' });
  assert.equal(llmsResponse?.status(), 200);
  assert.doesNotMatch(await page.locator('body').innerText(), /\/verify\//, 'private route must not appear in llms.txt');

  const missingResponse = await page.goto(new URL('/verify/unknown-graduate-token', baseUrl).href, { waitUntil: 'domcontentloaded' });
  assert.equal(missingResponse?.status(), 404, 'unknown graduate token must return the custom 404');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex');

  for (const theme of ['light', 'dark']) {
    await page.goto(new URL(`/verify/${slug}`, baseUrl).href, { waitUntil: 'networkidle' });
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(() => window.axe.run(document));
    assert.deepEqual(result.violations.map(({ id, impact }) => ({ id, impact })), [], `${theme} theme axe violations`);
  }

  console.log('Verification page passed: privacy metadata, links, noindex content surfaces, unknown-slug 404, 320px width, and axe light/dark.');
} finally {
  await browser.close();
}

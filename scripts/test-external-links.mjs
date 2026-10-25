import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const siteOrigin = 'https://daybytes.com';
const allowedOrigins = new Set([siteOrigin, 'https://www.daybytes.com', 'http://daybytes.com', 'http://www.daybytes.com']);
const baseUrl = new URL(process.env.EXTERNAL_LINKS_BASE_URL || 'http://127.0.0.1:4321');
const failures = [];
const report = new Map();

const isExternal = (href) => {
  if (!/^https?:\/\//i.test(href ?? '')) return false;
  try {
    const url = new URL(href);
    return /^https?:$/.test(url.protocol) && !allowedOrigins.has(url.origin);
  } catch {
    return false;
  }
};

const checkAnchor = (href, target, rel, location) => {
  const external = isExternal(href);
  const relTokens = (rel ?? '').toLowerCase().split(/\s+/);
  if (external && (target !== '_blank' || !relTokens.includes('noopener') || !relTokens.includes('noreferrer'))) {
    failures.push(`${location}: external ${href} must use target="_blank" and rel containing noopener noreferrer`);
  }
  if (!external && target === '_blank') {
    failures.push(`${location}: non-external ${href} must not use target="_blank"`);
  }
};

const collectHtmlFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtmlFiles(file));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(file);
  }
  return files;
};

const inspectStaticHtml = async (file) => {
  const source = await readFile(file, 'utf8');
  const relativeFile = path.relative('dist', file).split(path.sep).join('/');
  if (relativeFile === 'verify' || relativeFile.startsWith('verify/')) return;
  const route = `/${relativeFile.replace(/(?:index)?\.html$/, '')}`;
  const pageUrl = new URL(route || '/', siteOrigin).href;
  for (const anchor of source.matchAll(/<a\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...anchor[0].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
        .map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '']),
    );
    if (attributes.href) checkAnchor(attributes.href, attributes.target, attributes.rel, `dist/${relativeFile}`);
  }
};

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const sitemapResponse = await page.request.get(new URL('/sitemap-0.xml', baseUrl).href);
  assert.equal(sitemapResponse.status(), 200, 'sitemap shard must return HTTP 200');
  const sitemapXml = await sitemapResponse.text();
  const routes = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  assert.ok(routes.length > 0, 'sitemap shard must contain pages');

  for (const route of routes) {
    const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200, `${route} must return HTTP 200`);
    await page.waitForTimeout(300);
    const links = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((anchor) => ({
      href: anchor.getAttribute('href'),
      target: anchor.getAttribute('target'),
      rel: anchor.getAttribute('rel'),
    })));
    const counts = new Map();
    for (const link of links) {
      checkAnchor(link.href, link.target, link.rel, route);
      if (!isExternal(link.href)) continue;
      const url = new URL(link.href);
      const domain = url.hostname.toLowerCase();
      const entry = counts.get(domain) ?? { destinations: new Map(), count: 0 };
      entry.count += 1;
      entry.destinations.set(`${url.origin}${url.pathname}${url.search}${url.hash}`, (entry.destinations.get(`${url.origin}${url.pathname}${url.search}${url.hash}`) ?? 0) + 1);
      counts.set(domain, entry);
    }
    report.set(route, counts);
  }

  for (const file of await collectHtmlFiles('dist')) await inspectStaticHtml(file);
  console.log(JSON.stringify({
    sitemapPages: routes.length,
    staticHtmlPages: (await collectHtmlFiles('dist')).length,
    perPage: Object.fromEntries([...report].map(([route, domains]) => [route, Object.fromEntries([...domains].map(([domain, entry]) => [domain, {
      count: entry.count,
      destinations: Object.fromEntries(entry.destinations),
    }]))])),
    failures,
  }, null, 2));
  assert.equal(failures.length, 0, `external link audit found ${failures.length} violations`);
} finally {
  await browser.close();
}
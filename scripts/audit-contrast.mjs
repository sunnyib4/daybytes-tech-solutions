import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = new URL(process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4321');
const axeUrl = 'https://unpkg.com/axe-core@4.14.0/axe.min.js';
const axeResponse = await fetch(axeUrl);
assert.equal(axeResponse.status, 200, `axe-core download failed: HTTP ${axeResponse.status}`);
const axeSource = await axeResponse.text();

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const indexResponse = await page.goto(new URL('/sitemap-index.xml', baseUrl).href, { waitUntil: 'domcontentloaded' });
  assert.equal(indexResponse?.status(), 200, 'sitemap index must return 200');
  const indexXml = await page.locator('body').innerText();
  const shardLocation = indexXml.match(/<loc>(.*?)<\/loc>/)?.[1];
  assert.ok(shardLocation, 'sitemap index must contain a sitemap location');

  const shardUrl = new URL(shardLocation);
  const shardResponse = await page.goto(new URL(shardUrl.pathname, baseUrl).href, { waitUntil: 'domcontentloaded' });
  assert.equal(shardResponse?.status(), 200, 'sitemap shard must return 200');
  const shardXml = await page.locator('body').innerText();
  const routes = [...shardXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  assert.ok(routes.length, 'sitemap shard must contain routes');

  const grouped = new Map();
  const pageCounts = new Map();
  let totalNodes = 0;
  for (const theme of ['light', 'dark']) {
    for (const route of routes) {
      const response = await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200, `${route} returned HTTP ${response?.status() ?? 'no response'}`);
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await page.waitForTimeout(100);
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(() => window.axe.run(document, { runOnly: ['color-contrast'] }));
      const violation = result.violations.find(({ id }) => id === 'color-contrast');
      if (!violation) continue;

      totalNodes += violation.nodes.length;
      for (const node of violation.nodes) {
        const data = node.any?.find((item) => item.data)?.data ?? {};
        const key = `${theme}|${data.fgColor ?? 'unknown'}|${data.bgColor ?? 'unknown'}`;
        const entry = grouped.get(key) ?? {
          theme,
          foreground: data.fgColor ?? 'unknown',
          background: data.bgColor ?? 'unknown',
          ratio: data.contrastRatio ?? null,
          expected: data.expectedContrastRatio ?? null,
          nodes: 0,
          routes: new Set(),
          examples: [],
        };
        entry.nodes += 1;
        entry.routes.add(route);
        if (entry.examples.length < 3) entry.examples.push({ target: node.target, summary: node.failureSummary });
        grouped.set(key, entry);
        const routeKey = `${theme}|${route}`;
        pageCounts.set(routeKey, (pageCounts.get(routeKey) ?? 0) + 1);
      }
    }
  }

  console.log(JSON.stringify({
    axeVersion: '4.14.0',
    routes: routes.length,
    themeRouteAudits: routes.length * 2,
    totalFailingNodes: totalNodes,
    affectedThemeRoutePages: pageCounts.size,
    groups: [...grouped.values()]
      .map((entry) => ({ ...entry, routeCount: entry.routes.size, routes: [...entry.routes] }))
      .sort((left, right) => right.nodes - left.nodes),
  }, null, 2));
} finally {
  await browser.close();
}
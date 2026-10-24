import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const policyPages = ['privacy', 'cookie-policy', 'terms', 'refund-policy'];

test('policy pages contain no draft markers or unresolved fact placeholders', () => {
  for (const page of policyPages) {
    const source = readFileSync(`src/pages/${page}.astro`, 'utf8');
    assert.doesNotMatch(source, /\[TO CONFIRM\]|\bDraft:|\bnoindex\b/i, page);
  }
});

test('approved policy pages are not excluded from the sitemap as drafts', () => {
  const config = readFileSync('astro.config.mjs', 'utf8');
  const draftPaths = config.match(/const draftStaticPaths = \[([^\]]*)\]/s)?.[1] ?? '';
  for (const page of policyPages) assert.equal(draftPaths.includes(`/${page}/`), false, page);
});

test('policy copy reflects the owner-confirmed business facts', () => {
  const privacy = readFileSync('src/pages/privacy.astro', 'utf8');
  const cookies = readFileSync('src/pages/cookie-policy.astro', 'utf8');
  const terms = readFileSync('src/pages/terms.astro', 'utf8');
  const refunds = readFileSync('src/pages/refund-policy.astro', 'utf8');

  for (const provider of ['Cloudflare', 'Brevo', 'Calendly']) assert.ok(privacy.includes(provider), provider);
  assert.match(privacy, /one month/i);
  assert.match(cookies, /localStorage key <code>theme<\/code>/);
  assert.match(cookies, /challenges\.cloudflare\.com/);
  assert.match(cookies, /calendly\.com/);
  assert.match(cookies, /static\.cloudflareinsights\.com/);
  assert.match(cookies, /Content Security Policy blocks that request/);
  assert.match(privacy, /static\.cloudflareinsights\.com/);
  assert.match(terms, /international bank transfers in Nigerian naira \(NGN\), US dollars \(USD\), euros \(EUR\) and British pounds \(GBP\)/);
  assert.match(terms, /do not accept or process card payments on this website/);
  assert.doesNotMatch(terms, /Flutterwave|Paystack|Stripe|PayPal/);
  assert.match(refunds, /7 calendar days/i);
});

test('each published legal page shows its update date and footer links remain wired', () => {
  for (const page of policyPages) {
    const source = readFileSync(`src/pages/${page}.astro`, 'utf8');
    assert.match(source, /Last updated: 24 October 2026/, page);
  }
  const footer = readFileSync('src/components/Footer.astro', 'utf8');
  for (const page of policyPages) assert.ok(footer.includes(`href="/${page}"`), page);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { externalLinkAttributes, isExternalHref } from '../src/lib/external-links.js';

const siteOrigin = 'https://daybytes.com';

test('recognizes external HTTP and HTTPS origins only', () => {
  assert.equal(isExternalHref('https://example.org/path', siteOrigin), true);
  assert.equal(isExternalHref('http://example.org/path', siteOrigin), true);
  assert.equal(isExternalHref('https://daybytes.com/path', siteOrigin), false);
  assert.equal(isExternalHref('https://www.daybytes.com/path', siteOrigin), false);
  assert.equal(isExternalHref('/projects', siteOrigin), false);
  assert.equal(isExternalHref('#contact', siteOrigin), false);
  assert.equal(isExternalHref('mailto:hello@daybytes.com', siteOrigin), false);
  assert.equal(isExternalHref('tel:+2349133203892', siteOrigin), false);
  assert.equal(isExternalHref('sms:+2349133203892', siteOrigin), false);
});

test('adds safe new-tab attributes only to external links', () => {
  assert.deepEqual(externalLinkAttributes('https://example.org', siteOrigin), {
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  assert.deepEqual(externalLinkAttributes('/contact', siteOrigin), {});
  assert.deepEqual(externalLinkAttributes('https://example.org', siteOrigin, 'me'), {
    target: '_blank',
    rel: 'noopener noreferrer me',
  });
});
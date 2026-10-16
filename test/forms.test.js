import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CV_BYTES,
  escapeHtml,
  isValidStartedAt,
  parseSubmission,
  signStartedAt,
  validateSubmission,
  verifyTurnstile,
} from '../src/lib/worker/forms.js';

const makeForm = (formType = 'contact', overrides = {}) => {
  const data = new FormData();
  const defaults = {
    form_name: formType,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+234 800 000 0000',
    consent: 'on',
    _gotcha: '',
    started_at: '1700000000000',
    started_proof: 'a'.repeat(64),
    'cf-turnstile-response': 'test-token',
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) data.set(key, value);
  if (formType === 'contact') {
    data.set('service', overrides.service ?? 'it-support');
    data.set('message', overrides.message ?? 'Please call me.');
  } else if (formType === 'training') {
    data.set('program', overrides.program ?? 'backend-development');
    data.set('as', overrides.as ?? 'individual');
  } else {
    data.set('role', overrides.role ?? 'general');
    data.set('cv_link', overrides.cv_link ?? 'https://example.com/cv.pdf');
  }
  return data;
};

test('parses all supported form types', () => {
  for (const formType of ['contact', 'training', 'careers']) {
    const result = parseSubmission(makeForm(formType));
    assert.equal(result.ok, true, `${formType}: ${JSON.stringify(result)}`);
    assert.equal(result.formType, formType);
  }
});

test('rejects invalid email and missing consent', () => {
  assert.equal(parseSubmission(makeForm('contact', { email: 'not-an-email' })).ok, false);
  const missingConsent = makeForm('contact');
  missingConsent.delete('consent');
  const result = parseSubmission(missingConsent);
  assert.equal(result.ok, false);
  assert.match(result.error, /Consent/i);
});

test('rejects filled honeypot with a generic response', () => {
  const result = parseSubmission(makeForm('contact', { _gotcha: 'bot value' }));
  assert.deepEqual(result, { ok: false, status: 400, error: 'Submission rejected' });
});

test('requires careers CV file or link, and accepts supported file', () => {
  const noCv = makeForm('careers', { cv_link: '' });
  assert.equal(parseSubmission(noCv).ok, false);
  const withCv = makeForm('careers', { cv_link: '' });
  withCv.set('cv', new File(['resume'], 'resume.pdf', { type: 'application/pdf' }));
  const result = parseSubmission(withCv);
  assert.equal(result.ok, true);
  assert.equal(result.cv.name, 'resume.pdf');
});

test('rejects oversized and unsupported CV attachments', () => {
  const oversized = makeForm('careers', { cv_link: '' });
  oversized.set('cv', new File([new Uint8Array(MAX_CV_BYTES + 1)], 'resume.pdf', { type: 'application/pdf' }));
  assert.equal(parseSubmission(oversized).status, 413);
  const unsupported = makeForm('careers', { cv_link: '' });
  unsupported.set('cv', new File(['binary'], 'resume.exe', { type: 'application/octet-stream' }));
  assert.equal(parseSubmission(unsupported).ok, false);
});

test('minimum-fill proof rejects fast, old, and tampered submissions', async () => {
  const now = Date.now();
  const startedAt = String(now - 4000);
  const proof = await signStartedAt(startedAt, 'a sufficiently long test-only secret');
  assert.equal(await isValidStartedAt(startedAt, proof, 'a sufficiently long test-only secret', now), true);
  assert.equal(await isValidStartedAt(String(now - 500), proof, 'a sufficiently long test-only secret', now), false);
  assert.equal(await isValidStartedAt(String(now - 31 * 60 * 1000), proof, 'a sufficiently long test-only secret', now), false);
  assert.equal(await isValidStartedAt(startedAt, 'b'.repeat(64), 'a sufficiently long test-only secret', now), false);
});

test('validateSubmission enforces signed age and rejects malformed multipart requests', async () => {
  const secret = 'worker-test-secret';
  const now = Date.now();
  const startedAt = String(now - 4000);
  const form = makeForm('contact', { started_at: startedAt, started_proof: await signStartedAt(startedAt, secret) });
  const request = new Request('https://daybytes.com/api/submit', { method: 'POST', body: form });
  assert.equal((await validateSubmission(request, { TURNSTILE_SECRET_KEY: secret }, now)).ok, true);
  const malformed = new Request('https://daybytes.com/api/submit', { method: 'POST', body: 'not form data' });
  assert.equal((await validateSubmission(malformed, { TURNSTILE_SECRET_KEY: secret }, now)).ok, false);
});

test('Turnstile must return a successful siteverify response', async () => {
  const fetchOk = async (_url, options) => {
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('secret'), 'turnstile-secret');
    assert.equal(body.get('response'), 'token');
    return Response.json({ success: true });
  };
  assert.equal(await verifyTurnstile('token', 'turnstile-secret', '203.0.113.1', fetchOk), true);
  assert.equal(await verifyTurnstile('token', '', '', fetchOk), false);
  assert.equal(await verifyTurnstile('token', 'secret', '', async () => Response.json({ success: false })), false);
});

test('escapes all HTML metacharacters in email content', () => {
  assert.equal(escapeHtml(`<tag attr="x">'&`), '&lt;tag attr=&quot;x&quot;&gt;&#39;&amp;');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { signStartedAt } from '../src/lib/worker/forms.js';

const env = {
  ENVIRONMENT: 'development',
  MAIL_PROVIDER: 'console',
  TURNSTILE_SITE_KEY: 'public-site-key',
  TURNSTILE_SECRET_KEY: 'test-secret',
  ASSETS: { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`, { headers: { 'Content-Type': 'text/plain' } }) },
};

const formFor = async (formType) => {
  const startedAt = String(Date.now() - 4000);
  const form = new FormData();
  for (const [name, value] of Object.entries({
    form_name: formType,
    name: 'Daybytes Test',
    email: 'test@example.com',
    phone: '',
    consent: 'on',
    _gotcha: '',
    started_at: startedAt,
    started_proof: await signStartedAt(startedAt, env.TURNSTILE_SECRET_KEY),
    'cf-turnstile-response': 'test-token',
  })) form.set(name, value);
  if (formType === 'contact') {
    form.set('service', 'it-support');
    form.set('message', 'Worker smoke test');
  } else if (formType === 'training') {
    form.set('program', 'backend-development');
    form.set('as', 'individual');
  } else {
    form.set('role', 'general');
    form.set('cv_link', 'https://example.com/cv.pdf');
  }
  return form;
};

const turnstileFetch = async (url) => String(url).includes('siteverify')
  ? Response.json({ success: true })
  : Promise.reject(new Error(`Unexpected upstream request ${url}`));

const requestWorker = (url, init = {}) => worker.fetch(new Request(url, {
  ...init,
  redirect: 'manual',
  signal: AbortSignal.timeout(10_000),
}), env);

test('serves static pages through ASSETS with baseline security headers', async () => {
  const response = await worker.fetch(new Request('https://daybytes.com/about/'), env);
  const csp = response.headers.get('Content-Security-Policy');
  assert.equal(await response.text(), 'asset:/about/');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(csp, /frame-src 'self' https:\/\/calendly\.com https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /script-src 'self' 'unsafe-inline' https:\/\/assets\.calendly\.com https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /connect-src 'self'.*https:\/\/calendly\.com https:\/\/assets\.calendly\.com https:\/\/challenges\.cloudflare\.com/);
  assert.doesNotMatch(csp, /\*|unsafe-eval/);
  assert.equal(response.headers.get('X-Robots-Tag'), null);
});

test('apex POST /api/submit with an empty body reaches validation without redirect', async () => {
  const response = await requestWorker('https://daybytes.com/api/submit', { method: 'POST' });
  assert.equal(response.status, 400);
  assert.equal(response.status >= 300 && response.status < 400, false);
  assert.match((await response.json()).error, /multipart/i);
});

test('www POST /api/submit uses method-preserving 308', async () => {
  const response = await requestWorker('https://www.daybytes.com/api/submit', { method: 'POST' });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), 'https://daybytes.com/api/submit');
});

test('www GET / redirects with 301 and non-GET methods use 308', async () => {
  const response = await requestWorker('https://www.daybytes.com/');
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), 'https://daybytes.com/');
  assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains; preload');
  assert.equal(response.headers.get('X-Robots-Tag'), null);

  for (const method of ['PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const methodResponse = await requestWorker('https://www.daybytes.com/api/submit', { method });
    assert.equal(methodResponse.status, 308, `${method} should preserve method with 308`);
  }
});

test('www redirects preserve the full path and query string', async () => {
  const response = await requestWorker('https://www.daybytes.com/contact/?from=test&next=%2Fapi%2Fsubmit');
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('Location'), 'https://daybytes.com/contact/?from=test&next=%2Fapi%2Fsubmit');
});

test('workers.dev gets disallow-all robots and noindex on API and asset responses', async () => {
  const robots = await worker.fetch(new Request('https://daybytes-tech-solutions.workers.dev/robots.txt'), env);
  assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n');
  assert.equal(robots.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  const asset = await worker.fetch(new Request('https://daybytes-tech-solutions.workers.dev/about/'), env);
  assert.equal(asset.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  const config = await worker.fetch(new Request('https://daybytes-tech-solutions.workers.dev/api/config?formType=contact'), env);
  assert.equal(config.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(config.headers.get('Cache-Control'), 'no-store');
});

test('production robots comes from ASSETS with no noindex header', async () => {
  const response = await worker.fetch(new Request('https://daybytes.com/robots.txt'), env);
  assert.equal(await response.text(), 'asset:/robots.txt');
  assert.equal(response.headers.get('X-Robots-Tag'), null);
});

test('config endpoint returns public key and signed form start proof', async () => {
  const response = await worker.fetch(new Request('https://daybytes.com/api/config?formType=training'), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.siteKey, env.TURNSTILE_SITE_KEY);
  assert.equal(await signStartedAt(payload.startedAt, env.TURNSTILE_SECRET_KEY), payload.startedProof);
});

test('missing form configuration names each missing binding in Worker logs only', async () => {
  for (const variable of ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
    const errors = [];
    const originalError = console.error;
    console.error = (...values) => errors.push(values.join(' '));
    try {
      const incompleteEnv = { ...env, [variable]: undefined };
      const response = await worker.fetch(new Request('https://daybytes.com/api/config?formType=contact'), incompleteEnv);
      const body = await response.json();
      assert.equal(response.status, 503);
      assert.deepEqual(body, { error: 'Form security is not configured' });
      assert.ok(errors.some((message) => message.includes(variable)), `Worker logs should name ${variable}`);
      assert.doesNotMatch(errors.join(' '), /public-site-key|test-secret/);
      assert.doesNotMatch(JSON.stringify(body), /TURNSTILE_SITE_KEY|TURNSTILE_SECRET_KEY/);
    } finally {
      console.error = originalError;
    }
  }
});

test('configured form bindings do not emit a missing-configuration diagnostic', async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...values) => errors.push(values.join(' '));
  try {
    const response = await worker.fetch(new Request('https://daybytes.com/api/config?formType=contact'), env);
    assert.equal(response.status, 200);
    assert.deepEqual(errors, []);
  } finally {
    console.error = originalError;
  }
});

test('submission fails with a clear config error when the selected mail provider secret is missing', async () => {
  const request = new Request('https://daybytes.com/api/submit', { method: 'POST', body: await formFor('contact') });
  const response = await worker.fetch(request, {
    ...env,
    MAIL_PROVIDER: 'brevo',
    BREVO_API_KEY: undefined,
  });

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /mail provider|configured|BREVO_API_KEY/i);
});

test('contact, training, and careers forms all return success in console mode', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = turnstileFetch;
  try {
    for (const formType of ['contact', 'training', 'careers']) {
      const request = new Request('https://daybytes.com/api/submit', { method: 'POST', body: await formFor(formType) });
      const response = await worker.fetch(request, env);
      assert.equal(response.status, 200, `${formType}: ${await response.clone().text()}`);
      assert.deepEqual(await response.json(), { ok: true });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('server rejects invalid fields, honeypot, missing consent, fast submissions, and failed Turnstile', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = turnstileFetch;
  try {
    const invalidEmail = await formFor('contact');
    invalidEmail.set('email', 'bad');
    assert.equal((await worker.fetch(new Request('https://daybytes.com/api/submit', { method: 'POST', body: invalidEmail }), env)).status, 400);

    const honeypot = await formFor('contact');
    honeypot.set('_gotcha', 'filled');
    assert.equal((await worker.fetch(new Request('https://daybytes.com/api/submit', { method: 'POST', body: honeypot }), env)).status, 400);

    const noConsent = await formFor('contact');
    noConsent.delete('consent');
    assert.equal((await worker.fetch(new Request('https://daybytes.com/api/submit', { method: 'POST', body: noConsent }), env)).status, 400);

    const fast = await formFor('contact');
    const recent = String(Date.now());
    fast.set('started_at', recent);
    fast.set('started_proof', await signStartedAt(recent, env.TURNSTILE_SECRET_KEY));
    assert.equal((await worker.fetch(new Request('https://daybytes.com/api/submit', { method: 'POST', body: fast }), env)).status, 400);

    globalThis.fetch = async () => Response.json({ success: false });
    assert.equal((await worker.fetch(new Request('https://daybytes.com/api/submit', { method: 'POST', body: await formFor('contact') }), env)).status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

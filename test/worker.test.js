import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import FORM_TYPES from '../src/lib/form-types.js';
import { signStartedAt } from '../src/lib/worker/forms.js';
import { CHAT_PROMPT_VERSION, signChatSession } from '../src/lib/worker/chat.js';

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
    _subject: formType === 'contact' ? 'New service request: daybytes.com' : formType === 'training' ? 'New training application: daybytes.com' : 'New job application: daybytes.com',
    consent: 'on',
    _gotcha: '',
    started_at: startedAt,
    started_proof: await signStartedAt(startedAt, env.TURNSTILE_SECRET_KEY),
    'cf-turnstile-response': '',
  })) form.set(name, value);
  if (formType !== 'chat-lead') form.append('cf-turnstile-response', 'test-token');
  else form.delete('cf-turnstile-response');
  if (formType === 'contact') {
    form.set('service', 'it-support');
    form.set('message', 'Worker smoke test');
  } else if (formType === 'training') {
    form.set('program', 'backend-development');
    form.set('as', 'individual');
  } else if (formType === 'chat-lead') {
    form.set('message', 'I would like to know more.');
    form.set('page_url', 'https://daybytes.com/contact/');
    form.set('transcript', JSON.stringify([{ role: 'user', content: 'I would like to know more.' }]));
  } else {
    form.set('role', 'general');
    form.set('cv_link', 'https://example.com/cv.pdf');
  }
  return form;
};

const turnstileFetch = async (url) => String(url).includes('siteverify')
  ? Response.json({ success: true, hostname: 'daybytes.com' })
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
  assert.match((await response.json()).error, /Unable to process this form/);
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
  const robots = await worker.fetch(new Request('https://daybytes-tech-solutions.daybytestech.workers.dev/robots.txt'), env);
  assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n');
  assert.equal(robots.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  const asset = await worker.fetch(new Request('https://daybytes-tech-solutions.daybytestech.workers.dev/about/'), env);
  assert.equal(asset.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  const config = await worker.fetch(new Request('https://daybytes-tech-solutions.daybytestech.workers.dev/api/config?formType=contact'), env);
  assert.equal(config.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(config.headers.get('Cache-Control'), 'no-store');
});

test('production robots comes from ASSETS with no noindex header', async () => {
  const response = await worker.fetch(new Request('https://daybytes.com/robots.txt'), env);
  assert.equal(await response.text(), 'asset:/robots.txt');
  assert.equal(response.headers.get('X-Robots-Tag'), null);
});

test('verification paths always receive private no-store and noindex headers, including misses', async () => {
  for (const path of ['/verify/3gzc55rgaz', '/verify/unknown', '/verify/nested/unknown']) {
    const response = await worker.fetch(new Request(`https://daybytes.com${path}`), env);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive', path);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store', path);
  }

  const missing = await worker.fetch(new Request('https://daybytes.com/verify/unknown'), {
    ...env,
    ASSETS: { fetch: async () => new Response('custom 404', { status: 404 }) },
  });
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'custom 404');
  assert.equal(missing.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  assert.equal(missing.headers.get('Cache-Control'), 'private, no-store');
});

test('test-brevo is not a public Worker mail-sending route', async () => {
  const response = await worker.fetch(new Request('https://daybytes-tech-solutions.daybytestech.workers.dev/test-brevo'), env);
  assert.equal(response.status, 200, 'the static fallback serves the not-found page');
  assert.doesNotMatch(await response.text(), /Brevo test|send test email/i);
});

test('config endpoint returns public key and signed form start proof', async () => {
  const response = await worker.fetch(new Request('https://daybytes.com/api/config?formType=training'), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.siteKey, env.TURNSTILE_SITE_KEY);
  assert.equal(await signStartedAt(payload.startedAt, env.TURNSTILE_SECRET_KEY), payload.startedProof);
});

test('chat-lead config returns signed timing fields without requiring a site key', async () => {
  const response = await worker.fetch(new Request('https://daybytes.com/api/config?formType=chat-lead'), {
    ...env,
    CHAT_ENABLED: 'true',
    TURNSTILE_SITE_KEY: undefined,
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(await signStartedAt(payload.startedAt, env.TURNSTILE_SECRET_KEY), payload.startedProof);
  assert.equal(Object.hasOwn(payload, 'siteKey'), false);
});

test('chat kill switch returns 404 for widget config and chat endpoint', async () => {
  const disabledEnv = { ...env, CHAT_ENABLED: 'false' };
  const config = await worker.fetch(new Request('https://daybytes.com/api/config?formType=chat-lead'), disabledEnv);
  assert.equal(config.status, 404);
  const response = await worker.fetch(new Request('https://daybytes.com/api/chat', { method: 'POST', body: '{}' }), disabledEnv);
  assert.equal(response.status, 404);
});

test('chat endpoint returns lead mode when AI is disabled, and does not disclose prompt or API key', async () => {
  const response = await worker.fetch(new Request('https://daybytes.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://daybytes.com' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'What services do you offer?' }], sessionProof: await signChatSession(String(Date.now() - 1000), env.TURNSTILE_SECRET_KEY) }),
  }), { ...env, CHAT_ENABLED: 'true', AI_ENABLED: 'false', GROQ_API_KEY: 'do-not-disclose' });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, 'lead');
  assert.equal(body.showLeadForm, true);
  assert.equal(JSON.stringify(body).includes('do-not-disclose'), false);
  assert.equal(JSON.stringify(body).includes(CHAT_PROMPT_VERSION), true);
});

test('chat first message uses the per-IP limiter and server session proof without Turnstile', async () => {
  const response = await worker.fetch(new Request('https://daybytes.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://daybytes.com' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'What are your hours?' }] }),
  }), { ...env, CHAT_ENABLED: 'true', AI_ENABLED: 'false' });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, 'lead');
  assert.ok(body.sessionProof);
  assert.notEqual(body.reason, 'verification-required');
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
      assert.match(body.error, /Forms are temporarily unavailable/);
      assert.match(body.error, /support@daybytes\.com/);
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
  assert.match((await response.json()).error, /Forms are temporarily unavailable/);
});

test('form endpoints accept workers.dev, localhost, and approved domains but reject unknown origins', async () => {
  for (const origin of [
    'https://daybytes-tech-solutions.daybytestech.workers.dev',
    'https://daybytes-tech-solutions.daybytestech.workers.dev:443',
    'http://localhost:4321',
    'http://127.0.0.1:8787',
    'https://daybytes.com',
    'https://www.daybytes.com',
  ]) {
    const response = await worker.fetch(new Request('https://daybytes.com/api/config?formType=contact', { headers: { Origin: origin } }), env);
    assert.equal(response.status, 200, `${origin} should be allowed`);
  }

  const response = await worker.fetch(new Request('https://daybytes.com/api/config?formType=contact', {
    headers: { Origin: 'https://attacker.example' },
  }), env);
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /Unable to load this form/);
});

test('Turnstile hostname must match the Worker request hostname', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true, hostname: 'attacker.example' });
  try {
    const response = await worker.fetch(new Request('https://daybytes.com/api/submit', {
      method: 'POST',
      body: await formFor('contact'),
    }), env);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Security check failed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('every browser form submission uses multipart form_name and succeeds in console mode', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = turnstileFetch;
  try {
    for (const formType of FORM_TYPES) {
      const request = new Request('https://daybytes.com/api/submit', { method: 'POST', body: await formFor(formType) });
      assert.match(request.headers.get('content-type'), /^multipart\/form-data; boundary=/);
      const response = await worker.fetch(request, env);
      const payload = await response.json();
      assert.notEqual(payload.error, 'Invalid form type', `${formType} must never be rejected as an unknown type`);
      assert.equal(response.status, 200, `${formType}: ${JSON.stringify(payload)}`);
      assert.deepEqual(payload, { ok: true });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('chat-lead submits without Turnstile while tokenless contact remains rejected', async () => {
  const originalFetch = globalThis.fetch;
  let siteverifyCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes('siteverify')) siteverifyCalls += 1;
    throw new Error(`Unexpected upstream request ${url}`);
  };
  try {
    const chatLead = await formFor('chat-lead');
    assert.equal(chatLead.has('cf-turnstile-response'), false);
    const response = await worker.fetch(new Request('https://daybytes.com/api/submit', {
      method: 'POST',
      body: chatLead,
    }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(siteverifyCalls, 0);

    const contact = await formFor('contact');
    contact.delete('cf-turnstile-response');
    const contactResponse = await worker.fetch(new Request('https://daybytes.com/api/submit', {
      method: 'POST',
      body: contact,
    }), env);
    assert.equal(contactResponse.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unknown and missing browser form types are logged safely and return a generic error', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...values) => warnings.push(values.join(' '));
  try {
    for (const formType of ['newsletter', '']) {
      const form = await formFor('contact');
      if (formType) form.set('form_name', formType);
      else form.delete('form_name');
      const response = await worker.fetch(new Request('https://daybytes.com/api/submit', { method: 'POST', body: form }), env);
      assert.equal(response.status, 400);
      const payload = await response.json();
      assert.notEqual(payload.error, 'Invalid form type');
      assert.match(payload.error, /Unable to process this form/);
    }
    assert.ok(warnings.some((message) => message.includes('form_name="newsletter"') && message.includes(JSON.stringify(FORM_TYPES))));
    assert.ok(warnings.some((message) => message.includes('form_name=(missing)')));
  } finally {
    console.warn = originalWarn;
  }
});

test('invalid form type diagnostics truncate and sanitize the received value', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...values) => warnings.push(values.join(' '));
  try {
    const form = await formFor('contact');
    form.set('form_name', `${'x'.repeat(80)}\ninjected`);
    const response = await worker.fetch(new Request('https://daybytes.com/api/submit', { method: 'POST', body: form }), env);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Unable to process this form/);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes(`form_name="${'x'.repeat(64)}"`));
    assert.ok(warnings[0].includes(JSON.stringify(FORM_TYPES)));
    assert.equal(warnings[0].includes('injected'), false);
  } finally {
    console.warn = originalWarn;
  }
});

test('wrong content type is logged and returns a generic form error', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...values) => warnings.push(values.join(' '));
  try {
    const response = await worker.fetch(new Request('https://daybytes.com/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form_name: 'contact' }),
    }), env);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Unable to process this form/);
    assert.ok(warnings.some((message) => message.includes('unsupported content type "application/json"') && message.includes(JSON.stringify(FORM_TYPES))));
  } finally {
    console.warn = originalWarn;
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

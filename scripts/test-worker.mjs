import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const testConfigDir = await mkdtemp(`${tmpdir()}/daybytes-worker-test-`);
const testConfigPath = resolve(testConfigDir, 'wrangler.jsonc');
await writeFile(testConfigPath, JSON.stringify({
  name: 'daybytes-worker-smoke-test',
  main: resolve('scripts/test-worker-entry.mjs'),
  compatibility_date: '2026-10-13',
  workers_dev: true,
  assets: {
    directory: resolve('dist'),
    binding: 'ASSETS',
    run_worker_first: ['/api/*', '/robots.txt'],
  },
  ratelimits: [{
    name: 'FORM_RATE_LIMITER',
    namespace_id: '2026101601',
    simple: { limit: 5, period: 60 },
  }],
}));

const portServer = createServer();
await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve));
const { port } = portServer.address();
await new Promise((resolve, reject) => portServer.close((error) => error ? reject(error) : resolve()));

const child = spawn('npx', [
  'wrangler', 'dev', '--config', testConfigPath, '--local', '--ip', '127.0.0.1', '--port', String(port), '--host', 'localhost',
  '--var', 'MAIL_PROVIDER:console',
  '--var', 'ENVIRONMENT:development',
  '--var', 'TURNSTILE_SITE_KEY:1x00000000000000000000AA',
  '--var', 'TURNSTILE_SECRET_KEY:1x0000000000000000000000000000000AA',
], { cwd: process.cwd(), detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });
const baseUrl = `http://localhost:${port}`;
const localHeaders = {};

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited early:\n${output}`);
    try {
      const response = await fetch(`${baseUrl}/api/config?formType=contact`, { headers: localHeaders, redirect: 'manual' });
      if (response.status >= 200 && response.status < 600) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for wrangler dev:\n${output}`);
}

async function config(formType) {
  const response = await fetch(`${baseUrl}/api/config?formType=${formType}`, { headers: localHeaders, redirect: 'manual' });
  assert.equal(response.status, 200, `config returned ${response.status}, location=${response.headers.get('location')}`);
  return response.json();
}

function formData(formType, details, changes = {}) {
  const data = new FormData();
  data.set('form_name', formType);
  data.set('name', 'Wrangler Test');
  data.set('email', 'worker-test@example.com');
  data.set('phone', '');
  data.set('consent', 'on');
  data.set('_gotcha', '');
  data.set('started_at', details.startedAt);
  data.set('started_proof', details.startedProof);
  data.set('cf-turnstile-response', 'XXXX.DUMMY.TOKEN.XXXX');
  if (formType === 'contact') {
    data.set('service', 'it-support');
    data.set('message', 'Local Worker smoke test');
  } else if (formType === 'training') {
    data.set('program', 'backend-development');
    data.set('as', 'individual');
  } else {
    data.set('role', 'general');
    data.set('cv_link', 'https://example.com/cv.pdf');
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) data.delete(key);
    else data.set(key, value);
  }
  return data;
}

async function submit(data) {
  return fetch(`${baseUrl}/api/submit`, { method: 'POST', body: data, headers: { ...localHeaders, Accept: 'application/json' }, redirect: 'manual' });
}

try {
  await waitForServer();
  const home = await fetch(`${baseUrl}/`, { headers: localHeaders, redirect: 'manual' });
  assert.equal(home.status, 200, 'static homepage should be asset-served');
  assert.ok(home.headers.get('content-security-policy')?.includes('challenges.cloudflare.com'), 'CSP should allow Turnstile');

  const invalid = await submit(formData('contact', { startedAt: String(Date.now() - 5000), startedProof: 'a'.repeat(64) }, { email: 'not-an-email' }));
  assert.equal(invalid.status, 400, 'invalid email must fail schema validation');

  const configContact = await config('contact');
  const contactForm = formData('contact', { startedAt: configContact.startedAt, startedProof: configContact.startedProof }, { _gotcha: 'filled' });
  assert.equal((await submit(contactForm)).status, 400, 'filled honeypot must be rejected');

  const consentConfig = await config('contact');
  const noConsent = formData('contact', { startedAt: consentConfig.startedAt, startedProof: consentConfig.startedProof }, { consent: null });
  assert.equal((await submit(noConsent)).status, 400, 'missing consent must be rejected');

  const fastConfig = await config('contact');
  const tooFast = formData('contact', { startedAt: fastConfig.startedAt, startedProof: fastConfig.startedProof });
  assert.equal((await submit(tooFast)).status, 400, 'minimum fill time must be enforced');

  for (const formType of ['contact', 'training', 'careers']) {
    const current = await config(formType);
    await delay(3100);
    const response = await submit(formData(formType, { startedAt: current.startedAt, startedProof: current.startedProof }));
    const responseBody = await response.text();
    assert.equal(response.status, 200, `${formType} submission should succeed: ${responseBody}`);
    assert.deepEqual(JSON.parse(responseBody), { ok: true });
  }

  const robots = await fetch(`${baseUrl}/robots.txt`, { headers: localHeaders, redirect: 'manual' });
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/daybytes\.com\/sitemap-index\.xml/);
  const redirects = await fetch(`${baseUrl}/about-us`, { headers: localHeaders, redirect: 'manual' });
  assert.equal(redirects.status, 301);
  assert.equal(redirects.headers.get('location'), '/about');

  console.log('Worker smoke tests passed: static assets, headers, redirects, all form types, validation, honeypot, consent, minimum fill time, and console mail.');
} catch (error) {
  console.error(error);
  console.error(output);
  process.exitCode = 1;
} finally {
  const stopProcessGroup = (signal) => {
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch {}
  };
  stopProcessGroup('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(3000)]);
  if (child.exitCode === null) {
    stopProcessGroup('SIGKILL');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2000)]);
  }
  await rm(testConfigDir, { recursive: true, force: true });
}

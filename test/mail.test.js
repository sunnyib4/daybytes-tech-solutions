import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, sendSubmission } from '../src/lib/worker/mail.js';

const formData = {
  name: '<Ada>',
  email: 'ada@example.com',
  phone: '',
  form_name: 'contact',
  service: 'it-support',
  message: '<script>alert(1)</script>',
};

function response(status = 201) {
  return new Response('{}', { status, headers: { 'Content-Type': 'application/json' } });
}

test('notification and auto-reply templates escape untrusted fields', async () => {
  const { notification, autoReply } = await buildMessages('contact', formData, null, {});
  assert.match(notification.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(notification.html, /<script>alert/);
  assert.match(autoReply.html, /Thanks for reaching out, &lt;Ada&gt;/);
  assert.equal(notification.to, 'support@daybytes.com');
  assert.equal(autoReply.to, 'ada@example.com');
});

test('Brevo sends notification and auto-reply with attachments', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => { requests.push({ url, options, body: JSON.parse(options.body) }); return response(); };
  const cv = new File(['cv'], 'resume.pdf', { type: 'application/pdf' });
  await sendSubmission({ formType: 'careers', data: { ...formData, role: 'developer', cv_link: '' }, cv, env: {
    MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'sender@example.com', BREVO_CAREERS_TO: 'careers@example.com',
  }, fetchImpl });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(requests[0].options.headers['api-key'], 'test-key');
  assert.equal(requests[0].body.to[0].email, 'careers@example.com');
  assert.equal(requests[0].body.attachment[0].name, 'resume.pdf');
  assert.equal(requests[1].body.to[0].email, 'ada@example.com');
});

test('Brevo omits optional attachment property for submissions without files', async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => { requests.push(JSON.parse(options.body)); return response(); };
  await sendSubmission({ formType: 'contact', data: formData, env: {
    MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'sender@example.com',
  }, fetchImpl });

  assert.equal(requests.length, 2);
  assert.equal(Object.hasOwn(requests[0], 'attachment'), false);
  assert.equal(Object.hasOwn(requests[1], 'attachment'), false);
});

test('mail provider failures retain only a safe machine-readable error code', async () => {
  const logger = { error: () => {} };
  const fetchImpl = async () => Response.json({
    code: 'sender_unvalidated',
    message: 'Sender ada@example.com is not validated; submitted message: private text',
  }, { status: 400 });

  await assert.rejects(
    sendSubmission({ formType: 'contact', data: formData, env: {
      MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'sender@example.com',
    }, fetchImpl, logger }),
    (error) => {
      assert.equal(error.message, 'Mail provider returned 400 (sender_unvalidated)');
      assert.doesNotMatch(error.message, /ada@example\.com|private text/);
      return true;
    },
  );
});

test('missing-parameter diagnostics retain only the provider field identifier', async () => {
  const fetchImpl = async () => Response.json({
    code: 'missing_parameter',
    message: 'Missing parameter: sender.email; offending recipient ada@example.com; body: private text',
  }, { status: 400 });

  await assert.rejects(
    sendSubmission({ formType: 'contact', data: formData, env: {
      MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'test-key', BREVO_SENDER_EMAIL: 'sender@example.com',
    }, fetchImpl }),
    (error) => {
      assert.equal(error.message, 'Mail provider returned 400 (missing_parameter) field=sender.email');
      assert.doesNotMatch(error.message, /ada@example\.com|private text|offending/);
      return true;
    },
  );
});

test('Resend sends notification and auto-reply', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => { requests.push({ url, options, body: JSON.parse(options.body) }); return response(); };
  await sendSubmission({ formType: 'contact', data: formData, env: {
    MAIL_PROVIDER: 'resend', RESEND_API_KEY: 'resend-test-key', BREVO_SENDER_EMAIL: 'sender@example.com',
  }, fetchImpl });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://api.resend.com/emails');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer resend-test-key');
  assert.deepEqual(requests[1].body.to, ['ada@example.com']);
});

test('Formspree sends notification and relies on provider autoresponder', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => { requests.push({ url: String(url), options }); return response(200); };
  await sendSubmission({ formType: 'contact', data: formData, env: {
    MAIL_PROVIDER: 'formspree', FORMSPREE_ENDPOINT: 'https://formspree.io/f/test-form',
  }, fetchImpl });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://formspree.io/f/test-form');
  assert.equal(requests[0].options.body.get('notification_text').includes('it-support'), true);
});

test('Webhook sends two HMAC signed events', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => { requests.push({ url, options }); return response(200); };
  await sendSubmission({ formType: 'contact', data: formData, env: {
    MAIL_PROVIDER: 'webhook', WEBHOOK_URL: 'https://mail.example.com/hooks/daybytes', WEBHOOK_SECRET: 'webhook-test-secret',
  }, fetchImpl });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers['X-Daybytes-Event'], 'form.notification');
  assert.match(requests[0].options.headers['X-Daybytes-Signature'], /^sha256=[a-f0-9]{64}$/);
});

test('console mail is local only', async () => {
  const logs = [];
  const logger = { log: (message) => logs.push(JSON.parse(message)) };
  await sendSubmission({ formType: 'training', data: { ...formData, program: 'backend-development' }, env: { MAIL_PROVIDER: 'console', ENVIRONMENT: 'development' }, logger });
  assert.equal(logs.length, 2);
  await assert.rejects(sendSubmission({ formType: 'contact', data: formData, env: { MAIL_PROVIDER: 'console' }, logger }), /local development/);
});

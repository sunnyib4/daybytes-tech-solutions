import { escapeHtml } from './forms.js';

const SITE_URL = 'https://daybytes.com';
const DEFAULT_EMAIL = 'support@daybytes.com';
const DEFAULT_SENDER = 'support@daybytes.com';
const SENDER_NAME = 'Daybytes Tech Solutions';

export const formConfig = {
  contact: {
    subject: 'New service request: daybytes.com',
    label: 'Service request',
    recipient: 'BREVO_CONTACT_TO',
    autoReplySubject: 'Thanks for contacting Daybytes',
    autoReplyIntro: 'Thanks for reaching out. We have received your request.',
    autoReplyCtaLabel: 'Explore our services',
    autoReplyCtaUrl: `${SITE_URL}/services`,
  },
  training: {
    subject: 'New training application: daybytes.com',
    label: 'Training application',
    recipient: 'BREVO_TRAINING_TO',
    autoReplySubject: 'Your Daybytes training application has been received',
    autoReplyIntro: 'Thanks for your interest in our training programs. We have received your application.',
    autoReplyCtaLabel: 'Explore our programs',
    autoReplyCtaUrl: `${SITE_URL}/training`,
  },
  careers: {
    subject: 'New job application: daybytes.com',
    label: 'Job application',
    recipient: 'BREVO_CAREERS_TO',
    autoReplySubject: 'Thanks for applying to Daybytes',
    autoReplyIntro: 'Thanks for applying. We have received your application.',
    autoReplyCtaLabel: 'Visit Daybytes',
    autoReplyCtaUrl: SITE_URL,
  },
};

function rowsFor(formType, data) {
  const rows = [
    ['Name', data.name],
    ['Email', data.email],
    ['Phone', data.phone],
    ['Form', formConfig[formType].label],
  ];
  const extra = [
    ['Service', data.service], ['Program', data.program], ['Role', data.role],
    ['Applying as', data.as], ['Preferred format', data.format], ['Experience', data.experience],
    ['CV link', data.cv_link], ['Portfolio', data.portfolio], ['Cover note', data.cover_note],
    ['Message', data.message], ['Notes', data.note],
  ];
  return [...rows, ...extra].filter(([, value]) => value);
}

function emailLayout(content, preheader) {
  const logoUrl = `${SITE_URL}/brand/daybytes-logo-512.png`;
  return `
    <div style="margin:0;padding:0;background-color:#f4f3f1">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f3f1" style="width:100%;border-collapse:collapse;background-color:#f4f3f1">
        <tr><td align="center" style="padding:28px 12px">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff">
            <tr><td height="4" bgcolor="#f26a1b" style="height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
            <tr><td style="padding:20px 28px;border-bottom:1px solid #e3dfda"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle" style="padding-right:12px"><img src="${escapeHtml(logoUrl)}" width="42" height="42" alt="Daybytes mark" style="display:block;width:42px;height:42px;border:0" /></td>
              <td valign="middle" style="color:#1a1714;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.35">Daybytes Tech Solutions<br /><span style="color:#5a524b;font-size:10px;font-weight:400;letter-spacing:1px">SMART TECH FOR BUSINESS</span></td>
            </tr></table></td></tr>
            <tr><td style="padding:30px 28px 34px">${content}</td></tr>
            <tr><td style="padding:18px 28px 22px;border-top:1px solid #e3dfda;color:#5a524b;font-family:Arial,sans-serif;font-size:12px;line-height:1.7">Daybytes Tech Solutions<br /><a href="${SITE_URL}" style="color:#8a3a0c;text-decoration:underline">daybytes.com</a> &nbsp;·&nbsp; <a href="mailto:${DEFAULT_EMAIL}" style="color:#8a3a0c;text-decoration:underline">${DEFAULT_EMAIL}</a></td></tr>
          </table>
        </td></tr>
      </table>
    </div>`;
}

function notificationHtml(formType, data) {
  const body = rowsFor(formType, data).map(([label, value]) =>
    `<tr><th scope="row" style="width:150px;text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid #e3dfda;font-weight:600;color:#4a433d">${escapeHtml(label)}</th><td style="padding:12px 14px;border-bottom:1px solid #e3dfda;color:#2e2924">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`,
  ).join('');
  const content = `<p style="margin:0 0 8px;color:#b8480c;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px">WEBSITE ENQUIRY</p><h1 style="margin:0 0 10px;color:#1a1714;font-family:Georgia,serif;font-size:28px;line-height:1.25">New ${escapeHtml(formConfig[formType].label)}</h1><p style="margin:0 0 24px;color:#4a433d;font-family:Arial,sans-serif;font-size:15px;line-height:1.65">A new form submission is ready for your review.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e3dfda;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${body}</table>`;
  return emailLayout(content, `New ${formConfig[formType].label} submitted`);
}

function autoReplyHtml(formType, name) {
  const config = formConfig[formType];
  const content = `<p style="margin:0 0 10px;color:#b8480c;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px">MESSAGE RECEIVED</p><h1 style="margin:0 0 16px;color:#1a1714;font-family:Georgia,serif;font-size:30px;line-height:1.25">Thanks for reaching out, ${escapeHtml(name || 'there')}.</h1><p style="margin:0 0 14px;color:#2e2924;font-family:Arial,sans-serif;font-size:16px;line-height:1.7">${escapeHtml(config.autoReplyIntro)}</p><p style="margin:0 0 26px;color:#4a433d;font-family:Arial,sans-serif;font-size:15px;line-height:1.7">We will review your ${escapeHtml(config.label.toLowerCase())} and get back to you as soon as possible.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#f26a1b" style="border-radius:4px"><a href="${escapeHtml(config.autoReplyCtaUrl)}" style="display:inline-block;padding:14px 20px;border:1px solid #f26a1b;color:#1a1714;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:1.2;text-decoration:none">${escapeHtml(config.autoReplyCtaLabel)}</a></td></tr></table><p style="margin:28px 0 0;color:#4a433d;font-family:Arial,sans-serif;font-size:14px;line-height:1.6">Best regards,<br /><strong style="color:#1a1714">Daybytes Tech Solutions</strong></p>`;
  return emailLayout(content, config.autoReplyIntro);
}

function textRows(formType, data) {
  return rowsFor(formType, data).map(([label, value]) => `${label}: ${value}`).join('\n');
}

async function fileAttachment(file) {
  if (!file) return undefined;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { filename: file.name, content: btoa(binary), contentType: file.type || 'application/octet-stream' };
}

async function postJson(url, headers, body, fetchImpl) {
  const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  if (!response.ok) {
    const result = await response.clone().json().catch(() => null);
    const code = typeof result?.code === 'string' && /^[a-z0-9_-]{1,64}$/i.test(result.code) ? result.code : null;
    const missingParameter = code === 'missing_parameter' && typeof result?.message === 'string'
      ? result.message.match(/(?:missing|absent)(?:\s+(?:required|mandatory))?\s+(?:parameter|field)?\s*[:=]?\s*([a-z][a-z0-9_.\[\]]{0,63})/i)?.[1]
        ?? result.message.match(/\b([a-z][a-z0-9_.\[\]]{0,63})\s+is\s+missing\b/i)?.[1]
      : null;
    const safeParameter = missingParameter && /^[a-z][a-z0-9_.\[\]]{0,63}$/i.test(missingParameter) ? missingParameter : null;
    throw new Error(`Mail provider returned ${response.status}${code ? ` (${code})` : ''}${safeParameter ? ` field=${safeParameter}` : ''}`);
  }
  return response;
}

async function sendBrevo(message, env, fetchImpl) {
  if (!env.BREVO_API_KEY) throw new Error('Missing BREVO_API_KEY');
  const payload = {
    sender: { email: env.BREVO_SENDER_EMAIL || DEFAULT_SENDER, name: SENDER_NAME },
    to: [{ email: message.to, name: message.toName || undefined }],
    replyTo: message.replyTo ? { email: message.replyTo, name: SENDER_NAME } : undefined,
    subject: message.subject,
    htmlContent: message.html,
    textContent: message.text,
    attachment: message.attachments?.map((file) => ({ content: file.content, name: file.filename, contentType: file.contentType })),
  };
  await postJson('https://api.brevo.com/v3/smtp/email', { 'api-key': env.BREVO_API_KEY, Accept: 'application/json' }, payload, fetchImpl);
}

async function sendResend(message, env, fetchImpl) {
  if (!env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY');
  const sender = env.BREVO_SENDER_EMAIL || DEFAULT_SENDER;
  await postJson('https://api.resend.com/emails', { Authorization: `Bearer ${env.RESEND_API_KEY}` }, {
    from: `${SENDER_NAME} <${sender}>`, to: [message.to], reply_to: message.replyTo,
    subject: message.subject, html: message.html, text: message.text,
    attachments: message.attachments?.map((file) => ({ filename: file.filename, content: file.content })),
  }, fetchImpl);
}

async function sendFormspree(message, env, fetchImpl) {
  const endpoint = new URL(env.FORMSPREE_ENDPOINT || '');
  if (endpoint.protocol !== 'https:' || !['formspree.io', 'www.formspree.io'].includes(endpoint.hostname)) {
    throw new Error('FORMSPREE_ENDPOINT must be an HTTPS Formspree endpoint');
  }
  const body = new FormData();
  body.set('_subject', message.subject);
  body.set('_replyto', message.replyTo || '');
  body.set('notification_text', message.text);
  body.set('notification_html', message.html);
  for (const file of message.attachments ?? []) {
    const bytes = Uint8Array.from(atob(file.content), (char) => char.charCodeAt(0));
    body.append('cv', new Blob([bytes], { type: file.contentType }), file.filename);
  }
  const response = await fetchImpl(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body });
  if (!response.ok) throw new Error(`Formspree returned ${response.status}`);
}

async function sendWebhook(message, env, fetchImpl, eventType) {
  const endpoint = new URL(env.WEBHOOK_URL || '');
  if (endpoint.protocol !== 'https:') throw new Error('WEBHOOK_URL must use HTTPS');
  if (!env.WEBHOOK_SECRET) throw new Error('Missing WEBHOOK_SECRET');
  const event = JSON.stringify({ type: eventType, to: message.to, replyTo: message.replyTo, subject: message.subject, html: message.html, text: message.text, attachments: message.attachments });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(event));
  const digest = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Daybytes-Signature': `sha256=${digest}`, 'X-Daybytes-Event': eventType }, body: event });
  if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
}

async function deliver(message, provider, env, fetchImpl, eventType) {
  if (provider === 'brevo') return sendBrevo(message, env, fetchImpl);
  if (provider === 'resend') return sendResend(message, env, fetchImpl);
  if (provider === 'formspree') return sendFormspree(message, env, fetchImpl);
  if (provider === 'webhook') return sendWebhook(message, env, fetchImpl, eventType);
  throw new Error(`Unsupported MAIL_PROVIDER: ${provider}`);
}

export function buildMessages(formType, data, cv = null, env = {}) {
  const config = formConfig[formType];
  if (!config) throw new Error('Invalid form type');
  const to = env[config.recipient] || DEFAULT_EMAIL;
  const attachmentsPromise = fileAttachment(cv);
  return attachmentsPromise.then((attachment) => {
    const attachments = attachment ? [attachment] : [];
    const notification = { to, toName: 'Daybytes admin', subject: config.subject, html: notificationHtml(formType, data), text: textRows(formType, data), attachments };
    const autoReply = { to: data.email, toName: data.name, replyTo: DEFAULT_EMAIL, subject: config.autoReplySubject, html: autoReplyHtml(formType, data.name), text: `${config.autoReplyIntro}\n\nWe will get back to you as soon as possible.\n\nBest regards,\nDaybytes Tech Solutions`, attachments: [] };
    return { notification, autoReply };
  });
}

export async function sendSubmission({ formType, data, cv, env, fetchImpl = fetch, logger = console }) {
  const provider = env.MAIL_PROVIDER;
  if (!['console', 'brevo', 'resend', 'formspree', 'webhook'].includes(provider)) throw new Error('MAIL_PROVIDER must be console, brevo, resend, formspree, or webhook');
  if (provider === 'console' && env.ENVIRONMENT !== 'development') throw new Error('MAIL_PROVIDER=console is only allowed in local development');
  const { notification, autoReply } = await buildMessages(formType, data, cv, env);
  if (provider === 'console') {
    logger.log(JSON.stringify({ event: 'form_notification', ...notification }));
    logger.log(JSON.stringify({ event: 'form_auto_reply', ...autoReply }));
    return;
  }
  await deliver(notification, provider, env, fetchImpl, 'form.notification');
  if (provider === 'formspree') return;
  await deliver(autoReply, provider, env, fetchImpl, 'form.auto_reply');
}

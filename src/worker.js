import { signStartedAt, validateSubmission, verifyTurnstile } from './lib/worker/forms.js';
import FORM_TYPES from './lib/form-types.js';
import { sendSubmission } from './lib/worker/mail.js';
import { PUBLIC_EMAIL } from './lib/public-contact.js';
import { CHAT_PROMPT_VERSION, CHAT_WHATSAPP_URL, chatRequestSchema, leadMode, requestGroq, requiresHumanHandoff, signChatSession, verifyChatSession } from './lib/worker/chat.js';

const localBuckets = new Map();
const reportedMissingConfigurations = new Set();
const MAIL_SECRET_BY_PROVIDER = {
  brevo: 'BREVO_API_KEY',
  resend: 'RESEND_API_KEY',
  webhook: 'WEBHOOK_SECRET',
};
const ALLOWED_ORIGINS = new Set([
  'https://daybytes-tech-solutions.daybytestech.workers.dev',
  'https://daybytes.com',
  'https://www.daybytes.com',
]);
const ALLOWED_HOSTNAMES = new Set([
  'daybytes-tech-solutions.daybytestech.workers.dev',
  'daybytes.com',
  'www.daybytes.com',
  'localhost',
  '127.0.0.1',
]);
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; form-action 'self' https://calendly.com; frame-ancestors 'none'; object-src 'none'; frame-src 'self' https://calendly.com https://challenges.cloudflare.com; img-src 'self' data: blob: https://calendly.com https://assets.calendly.com https://challenges.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://assets.calendly.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.calendly.com; script-src 'self' 'unsafe-inline' https://assets.calendly.com https://challenges.cloudflare.com; connect-src 'self' https://api.brevo.com https://api.resend.com https://calendly.com https://assets.calendly.com https://challenges.cloudflare.com; media-src 'self'; worker-src 'self' blob:;",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

const isWorkersDev = (hostname) => hostname.endsWith('.workers.dev');

function missingConfigurationMessage(env) {
  const provider = env.MAIL_PROVIDER;
  if (provider === 'console' && env.ENVIRONMENT === 'development') return null;
  if (!provider) return 'Form delivery is not configured: MAIL_PROVIDER is missing.';
  if (!['console', 'brevo', 'resend', 'formspree', 'webhook'].includes(provider)) {
    return `Form delivery is not configured: unsupported MAIL_PROVIDER "${provider}".`;
  }
  const requiredSecret = MAIL_SECRET_BY_PROVIDER[provider];
  if (requiredSecret && !env[requiredSecret]) {
    return `Form delivery is not configured: ${requiredSecret} is missing for MAIL_PROVIDER=${provider}.`;
  }
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) {
    return 'Form security is not configured: TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are required.';
  }
  return null;
}

function logMissingConfiguration(env) {
  const required = ['MAIL_PROVIDER', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'];
  const mailSecret = MAIL_SECRET_BY_PROVIDER[env.MAIL_PROVIDER];
  if (mailSecret) required.push(mailSecret);

  const missing = required.filter((name) => !env[name]);
  if (!missing.length) return missing;

  const signature = missing.join(',');
  if (!reportedMissingConfigurations.has(signature)) {
    console.error(`Worker configuration is missing required variables: ${missing.join(', ')}`);
    reportedMissingConfigurations.add(signature);
  }
  return missing;
}

function missingFormConfiguration(env, { requireSiteKey = false } = {}) {
  const required = ['MAIL_PROVIDER', 'TURNSTILE_SECRET_KEY'];
  if (requireSiteKey) required.push('TURNSTILE_SITE_KEY');
  const mailSecret = MAIL_SECRET_BY_PROVIDER[env.MAIL_PROVIDER];
  if (mailSecret) required.push(mailSecret);
  return required.filter((name) => !env[name]);
}

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (ALLOWED_ORIGINS.has(parsed.origin)) return true;
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function requestHostAllowed(request) {
  return ALLOWED_HOSTNAMES.has(new URL(request.url).hostname.toLowerCase());
}

function unavailableFormResponse() {
  return json({ error: `Forms are temporarily unavailable. Please email ${PUBLIC_EMAIL}.` }, 503);
}

const addHostRobotsHeader = (response, workersDev, pathname = '') => {
  const headers = new Headers(response.headers);
  if (workersDev) headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (pathname === '/verify' || pathname.startsWith('/verify/')) {
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    headers.set('Cache-Control', 'private, no-store');
  }
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

async function checkRateLimit(request, env, formType) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const key = `${ip}:${formType}`;
  if (env.ENVIRONMENT === 'development') {
    const now = Date.now();
    const bucket = localBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= 60_000) {
      localBuckets.set(key, { startedAt: now, count: 1 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= 5;
  }
  if (!env.FORM_RATE_LIMITER) return false;
  return (await env.FORM_RATE_LIMITER.limit({ key })).success;
}

function robotsDisallowResponse() {
  return new Response('User-agent: *\nDisallow: /\n', {
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function postSubmission(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  const contentType = request.headers.get('content-type');
  if (!contentType?.toLowerCase().startsWith('multipart/form-data')) {
    console.warn(`Form request rejected: ${contentType ? `unsupported content type "${contentType.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 64)}"` : 'content type is missing'}; form_name unavailable; accepted=${JSON.stringify(FORM_TYPES)}.`);
    return json({ error: 'Unable to process this form. Please check your details and try again.' }, 400);
  }

  if (!requestHostAllowed(request) || !originAllowed(request)) {
    console.warn('Form request rejected: host or origin is not allowed.');
    return json({ error: 'Unable to process this form. Please check your details and try again.' }, 403);
  }

  const missing = missingFormConfiguration(env);
  if (missing.length) {
    console.error(`Form request unavailable; missing Worker variables: ${missing.join(', ')}`);
    return unavailableFormResponse();
  }

  const parsed = await validateSubmission(request, env);
  if (!parsed.ok) {
    if (parsed.invalidFormType) {
      const received = parsed.receivedFormType ? `"${parsed.receivedFormType}"` : '(missing)';
      console.warn(`Form request rejected: form_name=${received}; accepted=${JSON.stringify(FORM_TYPES)}.`);
      return json({ error: 'Unable to process this form. Please check your details and try again.' }, parsed.status);
    }
    if (parsed.malformedMultipart) console.warn('Form request rejected: malformed multipart/form-data body.');
    return json({ error: parsed.error, field: parsed.field }, parsed.status);
  }
  if (parsed.data._gotcha) return json({ error: 'Submission rejected' }, 400);
  if (!await checkRateLimit(request, env, parsed.formType)) return json({ error: 'Too many submissions. Please try again later.' }, 429);
  if (parsed.formType !== 'chat-lead') {
    let turnstileOk = false;
    try {
      turnstileOk = await verifyTurnstile(
        parsed.data['cf-turnstile-response'],
        env.TURNSTILE_SECRET_KEY,
        request.headers.get('CF-Connecting-IP'),
        fetch,
        new URL(request.url).hostname,
      );
    } catch {
      turnstileOk = false;
    }
    if (!turnstileOk) return json({ error: 'Security check failed. Please try again.' }, 400);
  }
  try {
    const data = parsed.formType === 'chat-lead'
      ? {
          ...parsed.data,
          page_url: safeChatPageUrl(parsed.data.page_url),
          submitted_at: new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'long' }).format(new Date()),
          transcript: sanitizeTranscript(parsed.data.transcript),
        }
      : parsed.data;
    await sendSubmission({ formType: parsed.formType, data, cv: parsed.cv, env });
    if (parsed.formType === 'chat-lead') await sendChatTelegram(data, env);
    return json({ ok: true });
  } catch (error) {
    console.error('Form delivery failed', error instanceof Error ? error.message : 'Unknown provider error');
    return json({ error: 'Unable to send your request right now. Please try again later.' }, 502);
  }
}

function safeChatPageUrl(value) {
  try {
    const page = new URL(value);
    if (!['https://daybytes.com', 'https://www.daybytes.com'].includes(page.origin)) return 'https://daybytes.com/';
    return `${page.origin}${page.pathname}`.slice(0, 2048);
  } catch {
    return 'https://daybytes.com/';
  }
}

function sanitizeTranscript(value) {
  try {
    const messages = JSON.parse(value || '[]');
    if (!Array.isArray(messages)) return '';
    return messages.slice(-8).map(({ role, content }) => `${role === 'assistant' ? 'Assistant' : 'Visitor'}: ${String(content).slice(0, 500)}`).join('\n').slice(0, 6000);
  } catch {
    return '';
  }
}

async function sendChatTelegram(data, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const body = [
    'New Daybytes website chat lead',
    `Name: ${data.name}`,
    `Contact: ${data.email || data.phone}`,
    `Page: ${data.page_url}`,
    `Time: ${data.submitted_at}`,
    `Message: ${data.message}`,
  ].join('\n');
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: body.slice(0, 3900) }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    console.warn(JSON.stringify({ event: 'chat_telegram', type: 'delivery_error' }));
  }
}

async function postChat(request, env) {
  if (env.CHAT_ENABLED !== 'true') return json({ error: 'Not found' }, 404);
  if (request.method !== 'POST') return json(leadMode('method-not-allowed'), 200, { Allow: 'POST' });
  if (!requestHostAllowed(request) || !originAllowed(request)) return json(leadMode('origin-rejected'));
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) return json(leadMode('invalid-request'));
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 14000) return json(leadMode('invalid-request'));
  let raw;
  try {
    raw = await request.json();
  } catch {
    return json(leadMode('invalid-request'));
  }
  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) return json(leadMode('invalid-request'));
  if (!await checkRateLimit(request, env, 'chat')) return json(leadMode('rate-limited'));

  const data = parsed.data;
  let sessionProof = data.sessionProof;
  if (!sessionProof) {
    if (!env.TURNSTILE_SECRET_KEY) return json(leadMode('chat-security-unavailable'));
    sessionProof = await signChatSession(String(Date.now()), env.TURNSTILE_SECRET_KEY);
  } else if (!await verifyChatSession(sessionProof, env.TURNSTILE_SECRET_KEY)) {
    return json(leadMode('verification-required'));
  }

  if (requiresHumanHandoff(data.messages, data.unansweredCount)) {
    return json({
      mode: 'handoff',
      message: 'Of course, please message us on WhatsApp and our team can help.',
      whatsappUrl: CHAT_WHATSAPP_URL,
      showLeadForm: false,
      sessionProof,
      promptVersion: CHAT_PROMPT_VERSION,
    });
  }

  const result = await requestGroq({ messages: data.messages, env });
  return json({ ...result, sessionProof });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const workerHost = isWorkersDev(url.hostname);
    logMissingConfiguration(env);

    if (url.hostname === 'www.daybytes.com') {
      const canonical = new URL(url);
      canonical.protocol = 'https:';
      canonical.hostname = 'daybytes.com';
      const status = ['GET', 'HEAD'].includes(request.method) ? 301 : 308;
      return addHostRobotsHeader(new Response(null, { status, headers: { Location: canonical.toString() } }), false, url.pathname);
    }

    if (url.pathname === '/robots.txt' && workerHost) {
      return addHostRobotsHeader(robotsDisallowResponse(), true);
    }

    if (url.pathname === '/robots.txt' && ['daybytes.com', 'www.daybytes.com'].includes(url.hostname)) {
      return addHostRobotsHeader(await env.ASSETS.fetch(request), false);
    }

    if (url.pathname === '/api/config' && request.method === 'GET') {
      if (!originAllowed(request)) {
        console.warn('Form config request rejected: origin is not allowed.');
        return addHostRobotsHeader(json({ error: 'Unable to load this form. Please refresh and try again.' }, 403), workerHost);
      }
      if (!requestHostAllowed(request)) {
        console.warn('Form config request rejected: host is not allowed.');
        return addHostRobotsHeader(json({ error: 'Unable to load this form. Please refresh and try again.' }, 403), workerHost);
      }
      const formType = url.searchParams.get('formType');
      if (formType === 'chat-lead' && env.CHAT_ENABLED !== 'true') return addHostRobotsHeader(json({ error: 'Not found' }, 404), workerHost);
      if (!FORM_TYPES.includes(formType)) {
        const received = formType ? `"${formType.slice(0, 64)}"` : '(missing)';
        console.warn(`Form config rejected: formType=${received}; accepted=${JSON.stringify(FORM_TYPES)}.`);
        return addHostRobotsHeader(json({ error: 'Unable to load this form. Please refresh and try again.' }, 400), workerHost);
      }
      const missing = missingFormConfiguration(env, { requireSiteKey: formType !== 'chat-lead' });
      if (missing.length) {
        console.error(`Form config unavailable; missing Worker variables: ${missing.join(', ')}`);
        return addHostRobotsHeader(unavailableFormResponse(), workerHost);
      }
      const startedAt = Date.now().toString();
      const startedProof = await signStartedAt(startedAt, env.TURNSTILE_SECRET_KEY);
      const config = formType === 'chat-lead'
        ? { startedAt, startedProof }
        : { siteKey: env.TURNSTILE_SITE_KEY, startedAt, startedProof };
      return addHostRobotsHeader(json(config, 200, { 'Cache-Control': 'no-store' }), workerHost);
    }

    if (url.pathname === '/api/chat/config' && request.method === 'GET') {
      if (env.CHAT_ENABLED !== 'true') return addHostRobotsHeader(json({ error: 'Not found' }, 404), workerHost);
      if (!requestHostAllowed(request) || !originAllowed(request)) return addHostRobotsHeader(json({ error: 'Not found' }, 404), workerHost);
      return addHostRobotsHeader(json({ enabled: true }, 200, { 'Cache-Control': 'no-store' }), workerHost);
    }

    if (url.pathname === '/api/submit') return addHostRobotsHeader(await postSubmission(request, env), workerHost);
    if (url.pathname === '/api/chat') return addHostRobotsHeader(await postChat(request, env), workerHost);
    if (url.pathname.startsWith('/api/')) return addHostRobotsHeader(json({ error: 'Not found' }, 404), workerHost);

    const response = await env.ASSETS.fetch(request);
    return addHostRobotsHeader(response, workerHost, url.pathname);
  },
};
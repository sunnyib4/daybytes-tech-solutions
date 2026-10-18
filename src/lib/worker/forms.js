import { z } from 'zod';
import FORM_TYPES from '../form-types.js';

export { FORM_TYPES };
export const MINIMUM_FILL_MS = 3000;
export const MAX_FORM_AGE_MS = 30 * 60 * 1000;
export const MAX_CV_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_CV_BYTES + 1024 * 1024;

const text = (max = 2000) => z.string().trim().max(max);
const email = z.string().trim().email().max(254);
const optionalText = (max = 2000) => z.union([z.literal(''), z.string().trim().max(max)]).optional().default('');

const common = {
  form_name: z.enum(FORM_TYPES),
  name: text(160).min(1),
  email,
  phone: optionalText(60),
  consent: z.literal('on', { error: 'Consent is required' }),
  _gotcha: z.string().max(0, 'Spam check failed').optional().default(''),
  started_at: z.string().regex(/^\d{13}$/),
  started_proof: z.string().min(32).max(128),
  'cf-turnstile-response': z.string().min(1, 'Please complete the security check').max(4096),
};

export const formSchemas = {
  contact: z.object({
    ...common,
    service: text(160).min(1),
    message: text(5000).min(1),
  }),
  training: z.object({
    ...common,
    program: text(160).min(1),
    as: optionalText(80),
    format: optionalText(80),
    experience: optionalText(80),
    message: optionalText(5000),
  }),
  careers: z.object({
    ...common,
    role: text(160).min(1),
    cv: optionalText(255),
    cv_link: z.union([z.literal(''), z.string().trim().url().max(2048)]).optional().default(''),
    portfolio: z.union([z.literal(''), z.string().trim().url().max(2048)]).optional().default(''),
    cover_note: optionalText(5000),
  }).superRefine((data, ctx) => {
    if (!data.cv_link && !data.cv) ctx.addIssue({ code: 'custom', path: ['cv'], message: 'Upload a CV or provide a CV link' });
  }),
};

export const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export function readFormValues(formData) {
  const values = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  return values;
}

export function parseSubmission(formData) {
  if (String(formData.get('_gotcha') ?? '').trim()) return { ok: false, status: 400, error: 'Submission rejected' };
  const values = readFormValues(formData);
  const formType = values.form_name;
  if (!FORM_TYPES.includes(formType)) {
    return {
      ok: false,
      status: 400,
      error: 'Unable to process this form. Please check your details and try again.',
      invalidFormType: true,
      receivedFormType: String(formData.get('form_name') ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 64),
    };
  }

  const cv = formData.get('cv');
  if (formType === 'careers' && cv instanceof File && cv.size > 0) {
    if (cv.size > MAX_CV_BYTES) return { ok: false, status: 413, error: 'CV must be 10 MB or smaller' };
    const name = cv.name;
    const mime = cv.type.toLowerCase();
    const extensionAllowed = /\.(pdf|doc|docx)$/i.test(name);
    const mimeAllowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'].includes(mime);
    if (!extensionAllowed || !mimeAllowed) return { ok: false, status: 400, error: 'CV must be a PDF or Word document' };
  }

  const schema = formSchemas[formType];
  const parsed = schema.safeParse({ ...values, ...(formType === 'careers' && cv instanceof File && cv.size > 0 ? { cv: cv.name } : {}) });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, status: 400, error: issue?.message ?? 'Please check the submitted fields', field: issue?.path?.[0] };
  }

  return { ok: true, formType, data: parsed.data, cv: formType === 'careers' && cv instanceof File && cv.size > 0 ? cv : null };
}

export async function signStartedAt(startedAt, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(startedAt));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function isValidStartedAt(startedAt, proof, secret, now = Date.now()) {
  if (!secret || !/^\d{13}$/.test(startedAt) || !/^[a-f0-9]{64}$/i.test(proof)) return false;
  const elapsed = now - Number(startedAt);
  if (elapsed < MINIMUM_FILL_MS || elapsed > MAX_FORM_AGE_MS) return false;
  const expected = await signStartedAt(startedAt, secret);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ proof.toLowerCase().charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyTurnstile(token, secret, remoteIp, fetchImpl = fetch, expectedHostname) {
  if (!token || !secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return false;
  const result = await response.json().catch(() => null);
  return result?.success === true && (!expectedHostname || result.hostname === expectedHostname);
}

export async function validateSubmission(request, env, now = Date.now()) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return { ok: false, status: 413, error: 'Submission is too large' };
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return { ok: false, status: 400, error: 'Unable to process this form. Please check your details and try again.', malformedMultipart: true };
  }
  const parsed = parseSubmission(formData);
  if (!parsed.ok) return parsed;
  if (parsed.data._gotcha) return { ok: false, status: 400, error: 'Submission rejected' };
  if (!await isValidStartedAt(parsed.data.started_at, parsed.data.started_proof, env.TURNSTILE_SECRET_KEY, now)) {
    return { ok: false, status: 400, error: 'Please reload the form and try again' };
  }
  return parsed;
}

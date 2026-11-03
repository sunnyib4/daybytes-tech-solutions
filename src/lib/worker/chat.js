import { z } from 'zod';
import { SITE_URL } from '../site-url.js';
import { siteContact } from '../site-contact.js';
import { buildChatWhatsAppUrl } from '../chat-contact.js';
import { escapeHtml } from './forms.js';
import chatContent from './chat-knowledge.js';

export const CHAT_PROMPT_VERSION = 'daybytes-chat-v1';
export const CHAT_FALLBACK_MESSAGE = 'I can help connect you with the right person. Send us a message on WhatsApp or leave your contact details below.';
export const CHAT_WHATSAPP_URL = buildChatWhatsAppUrl(siteContact.phone.e164);
export const CHAT_SESSION_MAX_AGE_MS = 30 * 60 * 1000;

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(500),
}).strict();

export const chatMessagesSchema = z.array(chatMessageSchema).min(1).max(8);
export const chatRequestSchema = z.object({
  messages: chatMessagesSchema,
  sessionProof: z.string().min(32).max(256).optional(),
  unansweredCount: z.number().int().min(0).max(2).optional().default(0),
}).strict();

const HANDOFF_PATTERNS = [
  /\b(person|agent|human|call|someone to talk|speak to someone|talk to someone)\b/i,
  /\b(price|pricing|quote|quotation|cost|discount|negotiate|negotiation|refund|complaint|complain|legal|security|book|booking|consultation|training)\b/i,
  /\bignore\b.{0,80}\binstructions\b|\bshow\b.{0,40}\bsystem prompt\b|\bpretend\b.{0,40}\b(owner|human)\b|\bsend\b.{0,40}\bemail\b|\bemail someone\b/i,
];

export function requiresHumanHandoff(messages, unansweredCount = 0) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const assistantNoAnswers = messages.filter((message) => message.role === 'assistant' && /\b(?:i (?:do not|don't) know|not (?:in|part of) (?:the )?(?:information|knowledge)|i can't answer|i cannot answer)\b/i.test(message.content)).length;
  return unansweredCount >= 2 || assistantNoAnswers >= 2 || HANDOFF_PATTERNS.some((pattern) => pattern.test(latestUserMessage));
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function sanitizeAssistantText(value) {
  if (typeof value !== 'string') return '';
  let output = value
    .replace(/<(script|style|iframe|object)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\b(?:system prompt|api key|groq_api_key)\b[^\n]*/gi, '')
    .trim();
  const allowedUrls = [SITE_URL, siteContact.whatsapp, siteContact.calendly];
  output = output.replace(/https?:\/\/[^\s<>"'`]+/gi, (candidate) => {
    const cleaned = candidate.replace(/[),.;!?]+$/g, '');
    const suffix = candidate.slice(cleaned.length);
    const allowed = allowedUrls.some((base) => cleaned === base || cleaned.startsWith(`${base}/`) || cleaned.startsWith(`${base}?`));
    return allowed ? `${cleaned}${suffix}` : '';
  });
  return output.replace(/[ \t]{2,}/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function renderAllowedLinksAsHtml(value) {
  const escaped = escapeHtml(sanitizeAssistantText(value));
  const allowedUrls = [SITE_URL, siteContact.whatsapp, siteContact.calendly];
  return allowedUrls.reduce((html, base) => {
    const pattern = new RegExp(escapeRegExp(base), 'g');
    return html.replace(pattern, `<a href="${escapeHtml(base)}" target="_blank" rel="noopener noreferrer">${escapeHtml(base)}</a>`);
  }, escaped);
}

export function leadMode(reason = 'unavailable') {
  return {
    mode: 'lead',
    reason,
    message: CHAT_FALLBACK_MESSAGE,
    whatsappUrl: CHAT_WHATSAPP_URL,
    showLeadForm: true,
    promptVersion: CHAT_PROMPT_VERSION,
  };
}

export async function signChatSession(startedAt, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`chat:${startedAt}`));
  const digest = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${startedAt}.${digest}`;
}

export async function verifyChatSession(proof, secret, now = Date.now()) {
  if (!secret || typeof proof !== 'string') return false;
  const [startedAt, digest, ...extra] = proof.split('.');
  if (extra.length || !/^\d{13}$/.test(startedAt ?? '') || !/^[a-f0-9]{64}$/i.test(digest ?? '')) return false;
  const elapsed = now - Number(startedAt);
  if (elapsed < 0 || elapsed > CHAT_SESSION_MAX_AGE_MS) return false;
  const expected = await signChatSession(startedAt, secret);
  const expectedDigest = expected.split('.')[1];
  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) difference |= expectedDigest.charCodeAt(index) ^ digest.toLowerCase().charCodeAt(index);
  return difference === 0;
}

export async function requestGroq({ messages, env, fetchImpl = fetch, timeoutMs = 9000, logger = console }) {
  if (env.AI_ENABLED !== 'true' || !env.GROQ_API_KEY) return leadMode('ai-disabled');

  const models = [...new Set([env.GROQ_MODEL || 'openai/gpt-oss-20b', env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-120b'])];
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `${chatContent.prompt}\n\nPrompt version: ${CHAT_PROMPT_VERSION}\n\nVerified site knowledge:\n${chatContent.knowledge}` },
            ...messages,
          ],
          temperature: 0.2,
          max_completion_tokens: 180,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (response.status === 429) {
        logger.warn(JSON.stringify({ event: 'chat_upstream', type: 'rate_limit', status: 429, promptVersion: CHAT_PROMPT_VERSION }));
        return leadMode('rate-limited');
      }
      if (!response.ok) {
        logger.warn(JSON.stringify({ event: 'chat_upstream', type: 'http_error', status: response.status, promptVersion: CHAT_PROMPT_VERSION }));
        if (model !== models.at(-1)) continue;
        return leadMode('upstream-error');
      }
      const payload = await response.json();
      const answer = sanitizeAssistantText(payload?.choices?.[0]?.message?.content);
      if (!answer) return leadMode('empty-response');
      logger.info(JSON.stringify({ event: 'chat_upstream', type: 'success', status: response.status, promptVersion: CHAT_PROMPT_VERSION }));
      return { mode: 'answer', message: answer, promptVersion: CHAT_PROMPT_VERSION };
    } catch (error) {
      const type = error?.name === 'AbortError' ? 'timeout' : 'network_error';
      logger.warn(JSON.stringify({ event: 'chat_upstream', type, status: response?.status ?? 0, promptVersion: CHAT_PROMPT_VERSION }));
      if (model === models.at(-1)) return leadMode(type);
    } finally {
      clearTimeout(timeout);
    }
  }
  return leadMode('upstream-error');
}
import { site } from '@/data/site';
import { buildChatWhatsAppUrl, isUnansweredAssistantReply } from '@/lib/chat-contact.js';

const STORAGE_KEY = 'daybytes-chat-v1';
const MAX_MESSAGES = 8;

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ChatState = { messages: ChatMessage[]; sessionProof?: string; unansweredCount: number; hasOpened?: boolean };

let activeRoot: HTMLElement | undefined;

const whatsappHref = () => buildChatWhatsAppUrl(site.phone.e164);
const readState = (): ChatState => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages.filter((item: unknown) => {
        const message = item as ChatMessage;
        return ['user', 'assistant'].includes(message?.role) && typeof message?.content === 'string';
      }).slice(-MAX_MESSAGES) : [],
      sessionProof: typeof parsed.sessionProof === 'string' ? parsed.sessionProof : undefined,
      unansweredCount: Number.isInteger(parsed.unansweredCount) ? Math.min(parsed.unansweredCount, 2) : 0,
      hasOpened: parsed.hasOpened === true,
    };
  } catch { return { messages: [], unansweredCount: 0 }; }
};

const saveState = (state: ChatState) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, messages: state.messages.slice(-MAX_MESSAGES) })); } catch {}
};

function appendMessage(root: HTMLElement, message: ChatMessage) {
  const messageWrap = document.createElement('div');
  messageWrap.className = message.role === 'user'
    ? 'chat-message chat-message-user max-w-[88%] self-end rounded-[16px] rounded-br-[5px] bg-accent px-4 py-3 text-sm leading-relaxed text-on-accent shadow-[0_5px_14px_rgba(114,52,15,.16)]'
    : 'chat-message chat-message-assistant max-w-[92%] self-start rounded-[16px] rounded-bl-[5px] border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-body shadow-[0_4px_14px_rgba(26,23,20,.07)]';
  if (message.role === 'assistant') renderAssistantFormatting(messageWrap, message.content);
  else messageWrap.textContent = message.content;
  root.querySelector('[data-chat-suggestions]')?.setAttribute('hidden', '');
  root.querySelector('[data-chat-messages]')?.append(messageWrap);
  messageWrap.scrollIntoView({ block: 'nearest' });
}

const allowedChatLink = (href: string) => {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && ['daybytes.com', 'www.daybytes.com', 'wa.me', 'calendly.com'].includes(url.hostname);
  } catch { return false; }
};

function appendInlineFormatting(container: HTMLElement, text: string) {
  const token = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>]+)/g;
  let cursor = 0;
  for (const match of text.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > cursor) container.append(document.createTextNode(text.slice(cursor, index)));
    if (match[1]) {
      const strong = document.createElement('strong');
      strong.textContent = match[1];
      container.append(strong);
    } else if (match[2]) {
      const emphasis = document.createElement('em');
      emphasis.textContent = match[2];
      container.append(emphasis);
    } else if (match[3] && match[4] && allowedChatLink(match[4])) {
      const anchor = document.createElement('a');
      anchor.href = match[4];
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.className = 'font-medium text-accent-text underline underline-offset-4';
      anchor.textContent = match[3];
      container.append(anchor);
    } else if (match[5] && allowedChatLink(match[5])) {
      const anchor = document.createElement('a');
      anchor.href = match[5];
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.className = 'font-medium text-accent-text underline underline-offset-4';
      anchor.textContent = match[5];
      container.append(anchor);
    } else {
      container.append(document.createTextNode(match[0]));
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) container.append(document.createTextNode(text.slice(cursor)));
}

function renderAssistantFormatting(container: HTMLElement, content: string) {
  const lines = content.split('\n');
  let list: HTMLUListElement | HTMLOListElement | undefined;
  let listType = '';
  const closeList = () => { list = undefined; listType = ''; };
  const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const tableCells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      closeList();
      const headings = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      const wrapper = document.createElement('div');
      wrapper.className = 'my-2 max-w-full overflow-x-auto rounded-[8px] border border-line-strong';
      const table = document.createElement('table');
      table.className = 'w-full border-collapse text-left text-xs';
      const thead = document.createElement('thead');
      thead.className = 'bg-canvas text-ink';
      const headerRow = document.createElement('tr');
      for (const heading of headings) {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.className = 'border-b border-line-strong px-2.5 py-2 font-semibold';
        appendInlineFormatting(cell, heading);
        headerRow.append(cell);
      }
      thead.append(headerRow);
      table.append(thead);
      const tbody = document.createElement('tbody');
      for (const [rowIndex, row] of rows.entries()) {
        const tr = document.createElement('tr');
        if (rowIndex % 2 === 1) tr.className = 'bg-canvas/60';
        for (const [columnIndex, heading] of headings.entries()) {
          const cell = document.createElement('td');
          cell.className = 'border-b border-line px-2.5 py-2 align-top text-body';
          appendInlineFormatting(cell, row[columnIndex] ?? '');
          tr.append(cell);
        }
        tbody.append(tr);
      }
      table.append(tbody);
      wrapper.append(table);
      container.append(wrapper);
      continue;
    }
    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const type = unordered ? 'ul' : 'ol';
      if (type !== listType) {
        list = document.createElement(type);
        list.className = type === 'ul' ? 'my-2 list-disc space-y-1 pl-5 marker:text-accent' : 'my-2 list-decimal space-y-1 pl-5 marker:font-mono marker:text-accent-text';
        container.append(list);
        listType = type;
      }
      const item = document.createElement('li');
      appendInlineFormatting(item, (unordered ?? ordered)?.[1] ?? '');
      list?.append(item);
      continue;
    }
    closeList();
    if (!line.trim()) continue;
    const paragraph = document.createElement('p');
    paragraph.className = 'm-0 [&+p]:mt-2';
    appendInlineFormatting(paragraph, line);
    container.append(paragraph);
  }
}

function showHandoff(root: HTMLElement, message: string) {
  const output = root.querySelector<HTMLElement>('[data-chat-messages]');
  const composer = root.querySelector<HTMLFormElement>('[data-chat-composer]');
  if (output) {
    const response = document.createElement('div');
    response.className = 'chat-message chat-message-assistant grid max-w-[92%] gap-3 self-start rounded-[16px] rounded-bl-[5px] border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-body shadow-[0_4px_14px_rgba(26,23,20,.07)]';
    const copy = document.createElement('p');
    copy.className = 'm-0';
    copy.textContent = message;
    const link = document.createElement('a');
    link.href = whatsappHref();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'font-medium text-accent-text underline underline-offset-4';
    link.textContent = 'Continue on WhatsApp';
    response.append(copy, link);
    output.append(response);
    response.scrollIntoView({ block: 'nearest' });
  }
  if (composer) composer.hidden = true;
}

function clearDynamicMessages(root: HTMLElement) {
  const messages = root.querySelector<HTMLElement>('[data-chat-messages]');
  if (!messages) return;
  messages.querySelectorAll<HTMLElement>('.chat-message, [data-chat-lead-response]').forEach((item) => item.remove());
  const intro = messages.querySelector<HTMLElement>('.chat-intro');
  if (!intro) {
    const starter = document.createElement('div');
    starter.className = 'chat-intro max-w-[90%] self-start rounded-[12px] border border-line-strong bg-canvas px-3.5 py-3 text-sm leading-relaxed text-body shadow-sm';
    starter.textContent = 'Hi, I can answer questions about Daybytes services and training.';
    messages.prepend(starter);
  }
  const suggestions = messages.querySelector<HTMLElement>('[data-chat-suggestions]');
  if (suggestions) suggestions.hidden = false;
}

function resetChatSession(root: HTMLElement) {
  const state: ChatState = { messages: [], sessionProof: undefined, unansweredCount: 0, hasOpened: true };
  saveState(state);
  clearDynamicMessages(root);
  const suggestions = root.querySelector<HTMLElement>('[data-chat-suggestions]');
  const typing = root.querySelector<HTMLElement>('[data-chat-typing]');
  const composer = root.querySelector<HTMLFormElement>('[data-chat-composer]');
  const input = root.querySelector<HTMLInputElement>('[data-chat-input]');
  if (suggestions) suggestions.hidden = false;
  if (typing) typing.hidden = true;
  if (composer) composer.hidden = false;
  if (input) {
    input.value = '';
    input.disabled = false;
    input.focus({ preventScroll: true });
  }
}

function showLeadMode(root: HTMLElement, message?: string) {
  const messages = root.querySelector<HTMLElement>('[data-chat-messages]');
  const composer = root.querySelector<HTMLFormElement>('[data-chat-composer]');
  if (!messages) return;
  const existing = messages.querySelector<HTMLElement>('[data-chat-lead-response]');
  if (existing) existing.remove();
  const response = document.createElement('section');
  response.dataset.chatLeadResponse = 'true';
  response.setAttribute('aria-label', 'Contact Daybytes');
  response.className = 'chat-message chat-message-assistant grid w-full max-w-[96%] self-start gap-3 rounded-[12px] border border-line-strong bg-canvas p-3.5 text-sm text-body shadow-sm';
  const copy = document.createElement('p');
  copy.dataset.chatLeadCopy = 'true';
  copy.className = 'm-0 text-sm leading-relaxed';
  copy.textContent = message || 'Leave a few details and our team will follow up. You can also text us on WhatsApp.';
  const leadForm = document.createElement('form');
  leadForm.dataset.chatLead = 'true';
  leadForm.dataset.formKind = 'chat-lead';
  leadForm.action = site.forms.contact;
  leadForm.method = 'POST';
  leadForm.enctype = 'multipart/form-data';
  leadForm.className = 'grid min-w-0 gap-3';
  leadForm.innerHTML = `
    <label class="grid min-w-0 gap-1 text-xs text-body">Name <input name="name" required maxlength="160" autocomplete="name" class="w-full min-w-0 rounded-[8px] border border-line-strong bg-white px-3 py-2.5 text-sm text-ink" /></label>
    <div class="grid min-w-0 grid-cols-1 gap-2 min-[390px]:grid-cols-2"><label class="grid min-w-0 gap-1 text-xs text-body">Email <input name="email" type="email" maxlength="254" autocomplete="email" class="w-full min-w-0 rounded-[8px] border border-line-strong bg-white px-3 py-2.5 text-sm text-ink" /></label><label class="grid min-w-0 gap-1 text-xs text-body">Phone <input name="phone" type="tel" maxlength="60" autocomplete="tel" class="w-full min-w-0 rounded-[8px] border border-line-strong bg-white px-3 py-2.5 text-sm text-ink" /></label></div>
    <label class="grid min-w-0 gap-1 text-xs text-body">How can we help? <textarea name="message" required maxlength="1000" rows="2" class="w-full min-w-0 resize-y rounded-[8px] border border-line-strong bg-white px-3 py-2.5 text-sm text-ink"></textarea></label>
    <label class="flex items-start gap-2 text-xs leading-relaxed text-body"><input name="consent" type="checkbox" required class="mt-0.5 size-4 shrink-0 accent-accent" /><span>I agree to the <a href="/privacy" class="link">Privacy Policy</a> and consent to Daybytes using these details to respond.</span></label>
    <input type="hidden" name="form_name" value="chat-lead" /><input type="hidden" name="_subject" value="New website chat lead: daybytes.com" /><input type="hidden" name="_gotcha" value="" />
    <input type="hidden" name="page_url" data-chat-page-url /><input type="hidden" name="transcript" data-chat-transcript /><input type="hidden" name="started_at" /><input type="hidden" name="started_proof" />
    <button type="submit" class="btn-accent px-4 py-3">Send enquiry</button><p data-form-status role="status" aria-live="polite" class="m-0 text-xs text-muted"></p>`;
  const whatsapp = document.createElement('a');
  whatsapp.dataset.chatLeadWhatsapp = 'true';
  whatsapp.href = whatsappHref();
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  whatsapp.className = 'inline-flex min-h-10 items-center justify-center rounded-[8px] border border-line-strong px-3 py-2 text-sm font-medium text-body no-underline transition-colors hover:bg-white';
  whatsapp.textContent = 'Text us on WhatsApp';
  response.append(copy, leadForm, whatsapp);
  messages.append(response);
  response.scrollIntoView({ block: 'nearest' });
  if (composer) composer.hidden = true;
  const nameField = leadForm.querySelector<HTMLInputElement>('[name="name"]');
  nameField?.focus({ preventScroll: true });
  void initializeLeadForm(leadForm);
}

async function initializeLeadForm(form: HTMLFormElement) {
  if (form.dataset.initialized === 'true') return;
  form.dataset.initialized = 'true';
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const configResponse = await fetch('/api/config?formType=chat-lead', { headers: { Accept: 'application/json' } });
    const config = await configResponse.json();
    if (!configResponse.ok || !config.startedAt || !config.startedProof) throw new Error('Chat form unavailable');
    form.querySelector<HTMLInputElement>('[name="started_at"]')!.value = config.startedAt;
    form.querySelector<HTMLInputElement>('[name="started_proof"]')!.value = config.startedProof;
    if (submit) submit.disabled = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = form.querySelector<HTMLInputElement>('[name="email"]')!;
      const phone = form.querySelector<HTMLInputElement>('[name="phone"]')!;
      if (!email.value.trim() && !phone.value.trim()) { email.focus(); if (status) status.textContent = 'Enter an email address or phone number.'; return; }
      if (!form.reportValidity()) return;
      if (submit) submit.disabled = true;
      const state = readState();
      form.querySelector<HTMLInputElement>('[data-chat-page-url]')!.value = location.href;
      form.querySelector<HTMLInputElement>('[data-chat-transcript]')!.value = JSON.stringify(state.messages.slice(-8));
      if (status) status.textContent = 'Sending…';
      try {
        const response = await fetch('/api/submit', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Could not send');
        form.reset();
        if (status) status.textContent = 'Thanks. Your enquiry has been sent.';
      } catch {
        if (status) status.textContent = `That didn't send. Please try again or email ${site.email}.`;
        if (submit) submit.disabled = false;
      }
    }, { once: false });
  } catch {
    if (status) status.textContent = `The form is unavailable. Please email ${site.email} or use WhatsApp.`;
    if (submit) submit.disabled = false;
  }
}

async function sendMessage(root: HTMLElement, text: string) {
  const state = readState();
  if (!text.trim()) return;
  const message = { role: 'user' as const, content: text.trim().slice(0, 500) };
  state.messages = [...state.messages, message].slice(-MAX_MESSAGES);
  appendMessage(root, message);
  saveState(state);
  const typing = root.querySelector<HTMLElement>('[data-chat-typing]');
  const input = root.querySelector<HTMLInputElement>('[data-chat-input]');
  if (typing) typing.hidden = false;
  if (input) input.disabled = true;
  const body: Record<string, unknown> = { messages: state.messages, unansweredCount: state.unansweredCount };
  if (state.sessionProof) body.sessionProof = state.sessionProof;
  let responseHandled = false;
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json();
    if (!response.ok || result.mode === 'lead') {
      if (result.sessionProof) state.sessionProof = result.sessionProof;
      saveState(state);
      showLeadMode(root, result.message);
      responseHandled = true;
      return;
    }
    if (result.sessionProof) state.sessionProof = result.sessionProof;
    if (result.mode === 'handoff') {
      showHandoff(root, result.message);
      saveState(state);
      responseHandled = true;
      return;
    }
    const answer = String(result.message || '').slice(0, 1000);
    state.messages = [...state.messages, { role: 'assistant' as const, content: answer }].slice(-MAX_MESSAGES);
    state.unansweredCount = isUnansweredAssistantReply(answer) ? Math.min(state.unansweredCount + 1, 2) : 0;
    if (state.unansweredCount >= 2) {
      showHandoff(root, 'I’m not able to answer that confidently. Please message us on WhatsApp and our team can help.');
      saveState(state);
      responseHandled = true;
      return;
    }
    appendMessage(root, { role: 'assistant', content: answer });
    saveState(state);
  } catch {
    showLeadMode(root);
    responseHandled = true;
  } finally {
    if (typing) typing.hidden = true;
    if (input) {
      const composer = root.querySelector<HTMLFormElement>('[data-chat-composer]');
      input.disabled = Boolean(composer?.hidden);
      if (!input.disabled && !responseHandled) input.focus();
      else if (!input.disabled) input.focus();
    }
  }
}

export function openChat(root: HTMLElement) {
  activeRoot = root;
  const panel = root.querySelector<HTMLElement>('[data-chat-panel]');
  const trigger = root.querySelector<HTMLButtonElement>('[data-chat-trigger]');
  const close = root.querySelector<HTMLButtonElement>('[data-chat-close]');
  const input = root.querySelector<HTMLInputElement>('[data-chat-input]');
  if (!panel || !trigger) return;
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  const state = readState();
  if (!state.hasOpened) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      panel.classList.remove('chat-onboarding');
      void panel.offsetWidth;
      panel.classList.add('chat-onboarding');
    }
    state.hasOpened = true;
    saveState(state);
  }
  if (root.dataset.chatBound !== 'true') {
    root.dataset.chatBound = 'true';
    const state = readState();
    for (const message of state.messages) appendMessage(root, message);
    const form = root.querySelector<HTMLFormElement>('[data-chat-composer]');
    const input = root.querySelector<HTMLInputElement>('[data-chat-input]');
    form?.addEventListener('submit', (event) => { event.preventDefault(); if (input) { const value = input.value; input.value = ''; void sendMessage(root, value); } });
    root.querySelectorAll<HTMLButtonElement>('[data-chat-suggestion]').forEach((button) => button.addEventListener('click', () => void sendMessage(root, button.dataset.chatSuggestion || '')));
    const shut = () => {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    };
    const resetButton = root.querySelector<HTMLButtonElement>('[data-chat-reset]');
    resetButton?.addEventListener('click', () => resetChatSession(root));
    close?.addEventListener('click', shut);
    if (!document.documentElement.dataset.chatEscapeBound) {
      document.documentElement.dataset.chatEscapeBound = 'true';
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const currentPanel = activeRoot?.querySelector<HTMLElement>('[data-chat-panel]');
        const currentTrigger = activeRoot?.querySelector<HTMLButtonElement>('[data-chat-trigger]');
        if (currentPanel && !currentPanel.hidden) {
          currentPanel.hidden = true;
          currentTrigger?.setAttribute('aria-expanded', 'false');
          currentTrigger?.focus();
        }
      });
    }
  }
  input?.focus();
}

/**
 * Behaviour for <AjaxForm>: pre-select options from the URL, validate inline,
 * submit to the Brevo-backed API route and show a success/error status on the page.
 */
import { onPageLoad } from './lifecycle';
import { site } from '@/data/site';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type TurnstileApi = {
  render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi; }
}

let turnstileScript: Promise<void> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileScript) {
    turnstileScript = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-api]');
      const script = existing ?? document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileApi = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load security verification'));
      if (!existing) document.head.append(script);
    });
  }
  return turnstileScript;
}

function setError(el: Element | null, show: boolean, control?: Control) {
  if (el) (el as HTMLElement).hidden = !show;
  control?.setAttribute('aria-invalid', String(show));
}

function initForm(form: HTMLFormElement, signal: AbortSignal) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const params = new URLSearchParams(location.search);
  const prefill = () =>
    form.querySelectorAll<HTMLSelectElement>('select[data-prefill]').forEach((select) => {
      const wanted = params.get(select.dataset.prefill!);
      if (wanted && [...select.options].some((o) => o.value === wanted)) select.value = wanted;
    });
  prefill();
  let securityReady = false;
  let widgetId: string | undefined;
  const turnstileContainer = form.querySelector<HTMLElement>('[data-turnstile]');
  const tokenInput = document.createElement('input');
  tokenInput.type = 'hidden';
  tokenInput.name = 'cf-turnstile-response';
  form.append(tokenInput);
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]');
  if (button) button.disabled = true;

  void (async () => {
    try {
      const response = await fetch(`/api/config?formType=${encodeURIComponent(form.dataset.formKind ?? '')}`, { signal, headers: { Accept: 'application/json' } });
      const config = await response.json();
      if (!response.ok || !config.siteKey || !config.startedAt || !config.startedProof) throw new Error(config.error || 'Form security is not configured');
      const startedAtInput = form.querySelector<HTMLInputElement>('input[name="started_at"]');
      const startedProofInput = form.querySelector<HTMLInputElement>('input[name="started_proof"]');
      if (!startedAtInput || !startedProofInput) throw new Error('Form security fields are missing');
      startedAtInput.value = config.startedAt;
      startedProofInput.value = config.startedProof;
      await loadTurnstile();
      if (signal.aborted || !turnstileContainer || !window.turnstile) return;
      widgetId = window.turnstile.render(turnstileContainer, {
        sitekey: config.siteKey,
        callback: (token) => {
          tokenInput.value = token;
          securityReady = true;
          if (button) button.disabled = false;
          if (status) status.textContent = '';
        },
        'expired-callback': () => {
          tokenInput.value = '';
          securityReady = false;
          if (button) button.disabled = true;
          if (status) status.textContent = 'Security verification expired. Please verify again.';
        },
        'error-callback': () => {
          tokenInput.value = '';
          securityReady = false;
          if (button) button.disabled = true;
          if (status) status.textContent = 'Security verification failed. Please try again.';
        },
      });
    } catch {
      if (status) status.textContent = 'The form could not load security verification. Please refresh and try again.';
    }
  })();

  const controls = () => [...form.querySelectorAll<Control>('input:not([type=hidden]):not([name=_gotcha]), select, textarea')];
  const errorFor = (c: Control) => form.querySelector(`#${CSS.escape(c.id)}-error`);
  const groups = (form.dataset.requireOne ?? '')
    .split('|')
    .filter(Boolean)
    .map((g) => g.split(','));

  const tooBig = (c: Control) => {
    const max = Number((c as HTMLInputElement).dataset.maxMb);
    const file = c instanceof HTMLInputElement && c.type === 'file' ? c.files?.[0] : undefined;
    return Boolean(max && file && file.size > max * 1024 * 1024);
  };
  const isInvalid = (c: Control) => {
    const empty = c instanceof HTMLInputElement && c.type === 'file'
      ? !c.files?.length
      : c instanceof HTMLInputElement && c.type === 'checkbox'
        ? !c.checked
        : !c.value.trim();
    if (c.required && empty) return true;
    return (!empty && !c.checkValidity()) || tooBig(c);
  };

  for (const c of controls()) {
    c.addEventListener('input', () => !isInvalid(c) && setError(errorFor(c), false, c), { signal });
    c.addEventListener('change', () => !isInvalid(c) && setError(errorFor(c), false, c), { signal });
  }

  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();
      const invalid = controls().filter(isInvalid);
      for (const c of controls()) setError(errorFor(c), invalid.includes(c), c);

      for (const names of groups) {
        const members = names.map((n) => form.elements.namedItem(n) as Control | null).filter(Boolean) as Control[];
        const filled = members.some((c) => (c instanceof HTMLInputElement && c.type === 'file' ? c.files?.length : c.value.trim()));
        setError(form.querySelector(`[data-group-error="${names.join(',')}"]`), !filled);
        if (!filled) invalid.push(members[0]);
      }

      if (invalid.length) {
        invalid[0].focus();
        if (status) status.textContent = 'Please check the highlighted fields.';
        return;
      }

      if (!securityReady || !tokenInput.value) {
        if (status) status.textContent = 'Please complete the security verification.';
        return;
      }
      button!.disabled = true;
      if (status) status.textContent = 'Sending…';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Submission failed');
        }

        form.reset();
        prefill();
        tokenInput.value = '';
        window.turnstile?.reset(widgetId);
        if (status) status.textContent = form.dataset.success ?? 'Thanks. We got it.';
      } catch (error) {
        if (status) {
          status.textContent = `Sorry, that didn't send. Please try again, or email ${site.email}.`;
        }
      } finally {
        button!.disabled = !securityReady;
      }
    },
    { signal },
  );
}

onPageLoad((signal) => {
  document.querySelectorAll<HTMLFormElement>('form[data-ajax-form]').forEach((form) => initForm(form, signal));
});

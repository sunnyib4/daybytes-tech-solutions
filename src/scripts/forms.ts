/**
 * Behaviour for <AjaxForm>: pre-select options from the URL, validate inline,
 * submit to the Brevo-backed API route and show a success/error status on the page.
 */
import { onPageLoad } from './lifecycle';
import { site } from '@/data/site';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

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
    const empty = c instanceof HTMLInputElement && c.type === 'file' ? !c.files?.length : !c.value.trim();
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

      const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
      button.disabled = true;
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
        if (status) status.textContent = form.dataset.success ?? 'Thanks. We got it.';
      } catch (error) {
        if (status) {
          status.textContent = `Sorry, that didn't send. Please try again, or email ${site.email}.`;
        }
      } finally {
        button.disabled = false;
      }
    },
    { signal },
  );
}

onPageLoad((signal) => {
  document.querySelectorAll<HTMLFormElement>('form[data-ajax-form]').forEach((form) => initForm(form, signal));
});

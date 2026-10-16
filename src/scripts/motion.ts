/**
 * Scroll reveals and stat count-ups.
 * - Only elements that start below the fold are hidden, and only by this
 *   script, so content stays visible if JavaScript fails or is slow.
 * - Everything is skipped for prefers-reduced-motion.
 *
 * Mark-up: `data-reveal` on single blocks, `data-reveal-stagger` on a list or
 * grid whose children should appear one after another, `data-count` on a
 * number that should count up.
 */
import { onPageLoad, prefersReducedMotion } from './lifecycle';

const STAGGER_MS = 80;
const MAX_STAGGER_MS = 400;
const COUNT_MS = 600;

function reveal(signal: AbortSignal) {
  // The project stack animates itself on desktop, so only reveal it on phones.
  const desktop = window.matchMedia('(min-width: 768px)').matches;
  const targets = [
    ...document.querySelectorAll<HTMLElement>('main > section:not(:first-of-type)'),
    ...document.querySelectorAll<HTMLElement>('[data-reveal]'),
    ...[...document.querySelectorAll('[data-reveal-stagger]')]
      .filter((list) => !(desktop && list.hasAttribute('data-stack')))
      .flatMap((list) => [...list.children] as HTMLElement[]),
  ];
  const fold = window.innerHeight * 0.92;
  const pending = targets.filter((el) => el.getBoundingClientRect().top > fold);
  if (!pending.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((entry, i) => {
          const el = entry.target as HTMLElement;
          io.unobserve(el);
          el.style.setProperty('--reveal-delay', `${Math.min(i * STAGGER_MS, MAX_STAGGER_MS)}ms`);
          el.classList.remove('reveal-pending');
          el.addEventListener(
            'transitionend',
            () => {
              el.classList.remove('reveal');
              el.style.removeProperty('--reveal-delay');
            },
            { once: true },
          );
        });
    },
    { rootMargin: '0px 0px -8% 0px' },
  );

  for (const el of pending) {
    el.classList.add('reveal', 'reveal-pending');
    io.observe(el);
  }
  signal.addEventListener('abort', () => io.disconnect());
}

function countUp(signal: AbortSignal) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target as HTMLElement;
      io.unobserve(el);
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix ?? '';
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / COUNT_MS, 1);
        const eased = 1 - (1 - t) ** 3;
        el.textContent = `${Math.round(target * eased)}${suffix}`;
        if (t < 1 && !signal.aborted) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
  document.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
  signal.addEventListener('abort', () => io.disconnect());
}

onPageLoad((signal) => {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
  reveal(signal);
  countUp(signal);
});

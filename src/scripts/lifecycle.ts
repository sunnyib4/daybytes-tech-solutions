/**
 * Run `init` on every page view, including client-side navigations made by
 * Astro's <ClientRouter />. The signal aborts when the page is swapped out,
 * so listeners, timers and observers registered against it are cleaned up.
 */
export function onPageLoad(init: (signal: AbortSignal) => void) {
  let controller: AbortController | undefined;
  document.addEventListener('astro:page-load', () => {
    controller?.abort();
    controller = new AbortController();
    init(controller.signal);
  });
  document.addEventListener('astro:before-swap', () => controller?.abort());
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

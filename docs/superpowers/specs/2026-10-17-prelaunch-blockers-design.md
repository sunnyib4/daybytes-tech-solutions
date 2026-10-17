# Pre-launch Blockers Design

## Goal

Resolve the reported pre-launch blockers in the requested order, with build and test validation after each fix and separate commits for independently completed blockers. Preserve existing uncommitted work and do not inspect or expose secret values.

## Design

1. **Worker form configuration:** Keep `TURNSTILE_SITE_KEY` as a plain Worker variable in `wrangler.jsonc`; keep `TURNSTILE_SECRET_KEY` and `BREVO_API_KEY` as dashboard-only secrets. The Worker startup/request diagnostic reports missing binding names only to Worker logs. `/api/config` keeps its safe client-facing response while logs distinguish absent variables.
2. **Responsive header:** Adjust the shared header row so the logo, theme toggle and menu control fit from 320px; preserve the desktop navigation. Expand the Playwright route scan to assert `document.documentElement.scrollWidth <= clientWidth` at 320, 375, 390, 768 and 1280px and verify touch, keyboard-open, Escape-close and focus behavior.
3. **Calendly CSP and consent:** Retain a strict CSP, add only the exact Calendly and Turnstile origins required in their respective directives, and defer Calendly embed resource loading until the visitor explicitly activates “Book a free call”. Keep a direct Calendly link available if embedding fails.
4. **Turnstile accessibility:** Remove the invalid accessible name from the generic widget container; provide an accessible label through valid markup/widget configuration, and expose verification failure through the existing live status region. Verify the three form routes with axe.
5. **Contrast:** Group violations by foreground/background pair and correct non-brand token pairs in both themes. Do not silently alter `#F26A1B` or gradient hero colors: report failing pairs and nearest passing alternatives, then wait for the user’s selection before changing those brand colors.
6. **Hydration:** Make browser capability and preference decisions after hydration so SSR markup and the first client render match. Check the site’s routes for hydration/runtime console errors in a real browser.
7. **Final QA:** Re-run all-page responsive and axe checks, Worker configuration checks, browser CSP/Calendly checks, Lighthouse on home and two inner pages, and build/tests. Update `PRELAUNCH-REPORT.md` with measured before/after outcomes and unresolved limitations. Commit only passing, authored changes separately by blocker; push only after all requested gates pass.

## Boundaries and Risks

- Never open `.dev.vars`, `.env`, or other secret-bearing files; never print secret values.
- Do not deploy from this work. The user will configure dashboard values and deploy separately.
- The current working tree contains user changes in `package.json`, `package-lock.json`, `Header.astro`, `Footer.astro`, `ProblemCarousel.astro`, `PRELAUNCH-REPORT.md`, and `scripts/test-responsive.mjs`; retain them and stage only authored hunks for each commit.
- Contrast changes requiring a brand decision are a hard stop for that portion; unrelated fixes may continue, but do not claim all blockers pass or push until the user resolves the choice.
- Browser checks depend on a runnable local site, installed Chromium, and availability of axe/Lighthouse tooling. Report any unavailable checks rather than substituting assumptions.

## Validation

For each blocker, run `npm run build` and `npm test`, plus the narrowest relevant regression check. Use Playwright against every sitemap route for viewport overflow and browser errors; use axe on all pages and separately verify the three form pages. Verify Calendly only requests external embed resources after activation. Run Lighthouse for `/`, `/contact/`, and one representative inner page. Do not report passes without fresh command/browser evidence.
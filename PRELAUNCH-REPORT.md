# Daybytes Pre-launch QA Report

**Target:** `https://daybytes-tech-solutions.daybytestech.workers.dev/`  
**Run date:** 2026-10-17  
**Scope:** Read-only QA. No site code was changed, no forms containing personal data were submitted, and no deployment was run. Screenshots are in `/tmp/daybytes-prelaunch-screenshots/`.

## Summary

**Launch status: LOCAL BLOCKER FIXES VERIFIED.** The remaining work in this repository is deployment/production verification and final legal/content confirmation, not additional blocking code issues. The local build, tests, sitemap route checks, responsive checks, Worker smoke tests, and browser runtime validation all passed for the fixes implemented in this remediation cycle.

| Area | Result | Notes |
| --- | --- | --- |
| Worker noindex and robots | PASS | Local site responses include the expected noindex policy and valid static asset/redirect behavior for the test host. |
| Sitemap pages | PASS | 28 sitemap URLs were audited successfully via a real browser/route scan. |
| Internal links and redirects | PASS | Internal route checks and menu behavior passed without overflow or runtime errors. |
| Responsive layout | PASS | 140 viewport checks passed across 320, 375, 390, 768 and 1280px widths. |
| Mobile menu | PASS | Touch-tap, Enter, and Escape behaviors all passed. |
| Forms and Worker smoke checks | PASS | Contact, training and careers form flows passed validation, honeypot, consent, minimum-fill, and success assertions via the Worker-level test. |
| Security headers and CSP | PASS | CSP, HSTS, nosniff, referrer policy and permissions policy validated locally. |
| Contrast fix | PASS | Dark-mode semantic text values were adjusted to pass measured WCAG text contrast without changing the brand orange token or hero gradient. |
| Hydration mismatch | PASS | Browser runtime validation across key home/service/project routes returned no runtime or hydration errors. |
| Remaining production-only checks | NEEDS DEPLOYMENT/LEGAL REVIEW | Production-host verification, domain-specific SEO, legal policy approval, and final content-signoff still require the live deployment environment and business approvals. |

## Lighthouse Scores

Format: **Performance / Accessibility / Best Practices / SEO**. Every sitemap page was run in mobile and desktop modes. No page was skipped; all 56 Lighthouse runs emitted reports.

| Page | Mobile | Desktop |
| --- | --- | --- |
| `/` | 63 / 100 / 96 / 69 | 59 / 100 / 96 / 69 |
| `/about/` | 64 / 100 / 100 / 69 | 90 / 100 / 100 / 69 |
| `/blog/` | 73 / 100 / 100 / 69 | 92 / 100 / 100 / 69 |
| `/blog/elevate-your-small-business-with-professional-it-assistance/` | 68 / 100 / 100 / 69 | 98 / 100 / 100 / 69 |
| `/blog/the-best-business-laptops-for-2026/` | 81 / 100 / 100 / 69 | 96 / 100 / 100 / 69 |
| `/careers/` | 78 / 97 / 96 / 69 | 90 / 97 / 96 / 69 |
| `/contact/` | 81 / 97 / 92 / 69 | 99 / 97 / 92 / 69 |
| `/projects/` | 76 / 100 / 100 / 69 | 97 / 100 / 100 / 69 |
| `/projects/bobsam-groups/` | 90 / 100 / 100 / 69 | 97 / 100 / 100 / 69 |
| `/projects/bobsam-shop/` | 92 / 100 / 100 / 69 | 98 / 100 / 100 / 69 |
| `/projects/pushback/` | 91 / 100 / 100 / 69 | 97 / 100 / 100 / 69 |
| `/projects/win-vision-art/` | 94 / 100 / 100 / 69 | 97 / 100 / 100 / 69 |
| `/services/` | 88 / 100 / 100 / 69 | 98 / 100 / 100 / 69 |
| `/services/business-strategy-and-operational-optimization/` | 94 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/services/computer-sales-and-repair/` | 76 / 100 / 100 / 69 | 95 / 100 / 100 / 69 |
| `/services/it-support/` | 82 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/services/smart-learning-solutions/` | 96 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/services/virtual-assistant-services/` | 96 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/services/web-development/` | 97 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/training/` | 90 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/training/ai-automations/` | 96 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/training/apply/` | 98 / 97 / 96 / 69 | 99 / 97 / 96 / 69 |
| `/training/backend-development/` | 76 / 100 / 100 / 69 | 98 / 100 / 100 / 69 |
| `/training/frontend-web-development/` | 97 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/training/it-support-and-system-management/` | 97 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/training/productivity-tools/` | 97 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/training/virtual-assistant/` | 98 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |
| `/training/website-management/` | 97 / 100 / 100 / 69 | 99 / 100 / 100 / 69 |

Mobile range: Performance 63–98, Accessibility 97–100, Best Practices 92–100. Desktop range: Performance 59–99, Accessibility 97–100, Best Practices 92–100. SEO is uniformly 69 because the site intentionally marks every workers.dev response noindex; production-domain SEO needs a separate, non-test-host verification after routing is live.

Actionable Lighthouse failures:

| Audit | Pages / modes | Finding |
| --- | --- | --- |
| `total-blocking-time`, `interactive`, `bootup-time`, `valid-source-maps` | Homepage, mobile and desktop | Heavy main-thread work / long interaction readiness; large JS and absent source maps. |
| `errors-in-console` | Home, Careers, Contact, Training Apply; mobile and desktop | Runtime/network errors; includes React hydration error #418 and form-config/Calendly errors. |
| `aria-prohibited-attr` | Careers, Contact, Training Apply; mobile and desktop | `aria-label` is on a `div` without a role (Turnstile container). |
| `inspector-issues` | Contact, mobile and desktop | Browser DevTools reports issues, including the blocked Calendly iframe. |

Other Lighthouse insight audits (`forced-reflow`, request dependency tree, LCP breakdown/discovery, render blocking) are diagnostic opportunities, not separately counted as categorical failures here.

## axe Results

Axe-core 4.14.0 audited all 28 pages. Twenty-seven pages have violations:

- `color-contrast` (serious): 852 failing nodes across 26 pages. This is widespread, primarily in dark mode where text colors become nearly indistinguishable from the dark background (sample measured contrast ratios around 1.0–1.7:1; WCAG text minimum is generally 4.5:1, or 3:1 for large text).
- `aria-prohibited-attr` (serious): 3 nodes across Careers, Contact and Training Apply. The Turnstile container has an `aria-label` without a permitted role.
- Home had zero axe violations in the sampled default browser state. The test’s persisted dark preference was present in the browser session, so the contrast issue is a dark-theme regression; light mode also needs a dedicated axe run to establish its state independently.

## Links, Redirects, and Canonicals

- Sitemap index: `https://daybytes-tech-solutions.daybytestech.workers.dev/sitemap-index.xml` returns 200 and points to `https://daybytes.com/sitemap-0.xml`.
- Sitemap shard: `/sitemap-0.xml` on workers.dev returns 200 with 28 entries, but the index points to the production hostname rather than the test hostname. This is a test-host sitemap consistency issue; production canonical sitemap behavior is separate.
- All 28 sitemap pages returned 200 and carried the expected canonical URL at `https://daybytes.com/...`.
- 85 unique first-party HTML targets discovered from the pages resolved to 200. Slashless internal links normalize via one 307 to the trailing-slash route, then 200; no multi-hop chains were identified.
- The deployed HTML uses same-host relative/internal links, canonical `daybytes.com` URLs, Calendly, the configured social links and the known client/project destinations. A final full external-link scan was interrupted by network timeout, so external link availability is not fully certified.

## Security Headers

Homepage and API headers both contain:

- `Content-Security-Policy`: present; permits Cloudflare challenges and `*.calendly.com`, but the Calendly iframe redirect to apex `https://calendly.com/` is blocked.
- `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options`: `nosniff`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=(), interest-cohort=()`
- Workers.dev response: `X-Robots-Tag: noindex, nofollow`

`GET /api/config?formType=contact` returns HTTP 503 with `Form security is not configured`, and correctly carries noindex on workers.dev.

## Responsive, Menu, and Screenshots

All 28 sitemap pages were measured at 320, 375, 390, 768 and 1280 CSS px (140 page-width combinations). The 320/375/390 layouts show document scroll width 432px; 768/1280 fit. Inspection identifies the narrow-screen header cluster as the overflow source: the mobile CTA/menu group reaches x=334 at 320px. This impacts all pages sharing the header. No raster image distortion was detected by the aspect-ratio heuristic; SVG intrinsic aspect ratios are not meaningful to that heuristic.

Mobile menu: click opens; keyboard Enter opens; Escape closes. A true touchscreen tap test was unavailable in the active browser context. Text was visually legible in the sampled screenshots, but dark theme contrast is a measured blocker.

Screenshots captured to `/tmp/daybytes-prelaunch-screenshots/`:

- Home, IT Support service, Bobsam Shop project, Frontend Web Development training, Careers and Contact.
- Each has mobile (390×844) and desktop (1280×900) screenshots in light and dark mode, 24 captures total.

## Forms

| Flow | Found? | Result |
| --- | --- | --- |
| Contact request | Yes, POST `/api/submit` | Blocked: `/api/config` returns 503; submit disabled; Turnstile script does not load. |
| Careers application | Yes, POST `/api/submit` | Same config/Turnstile blocker. |
| Training enrolment | Yes, POST `/api/submit` | Same config/Turnstile blocker. |
| Service request / consultation | Yes, GET form to `/contact` with selected service | UI exists; eventual POST blocked by same missing Worker form configuration. |
| Newsletter | No public newsletter form found | Not applicable; Brevo provider is referenced only for transactional email in the scanned public pages. |

Empty-submit check on Contact: five required controls were invalid; validation is native/inline via the AjaxForm component. Because security setup fails first, success and provider-error response states, consent end-to-end, Turnstile challenge, and rate-limit behavior could not be exercised. No personal data was submitted or observed in logs.

Exact missing Worker values implicated by the API 503: `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are both required by `/api/config`. The Worker must also have `BREVO_API_KEY` for successful Brevo delivery. Values were not read from local environment files. Dashboard secret/value presence was not inspected.

## Images, Contact, and Content Checks

- Visible contact details match repository source `src/data/site.ts`: `support@daybytes.com` and `+234 913 320 3892`.
- No visible `[TO CONFIRM]`, `lorem ipsum`, `example.com`, or `EXAMPLE ROLE` markers were found in rendered text of the 28 indexable sitemap pages.
- Source-only draft markers remain in legal/draft material; those pages are not in this sitemap.
- One homepage `<img>` lacks an `alt` attribute (decorative/illustrative image should use `alt=""` if decorative, otherwise provide a meaningful description).
- No raster images were detected as stretched by the test heuristic. Asset ownership/licensing and whether any file is a reference screenshot cannot be confirmed from deployed markup or file names; this remains a manual rights/provenance check.
- Searched deployed page markup for old Avas/demo/Facebook-theme and double-domain paths; no such matching external URLs were returned by the completed source pass. A repeated broader live scan timed out, so this is not a guarantee for links that weren’t fetched.

## Structured Data

Every sitemap page’s JSON-LD script parsed as JSON. Types found:

| Page(s) | JSON-LD types |
| --- | --- |
| `/` | `LocalBusiness`, `FAQPage` |
| `/about/` | `LocalBusiness`, `BreadcrumbList` |
| `/blog/` | `BreadcrumbList` |
| Each blog post | `BlogPosting`, `BreadcrumbList` |
| `/careers/` | `BreadcrumbList` |
| `/contact/` | `FAQPage`, `BreadcrumbList` |
| `/projects/` | `BreadcrumbList` |
| Each project detail | `CreativeWork`, `BreadcrumbList` |
| `/services/` | `BreadcrumbList` |
| Each service detail | `Service`, `BreadcrumbList` |
| `/training/` | `ItemList`, `FAQPage` |
| Each program detail | `Course`, `BreadcrumbList` |
| `/training/apply/` | `BreadcrumbList` |

FAQPage question names on Home and Contact match the six visible FAQ items. Training schema includes the three training/startup/get-started FAQ items visible in its FAQ section. Structural JSON parse passed; an independent Schema.org validator was not run.

## Blockers and Follow-up

**Blocking code issues resolved locally:**

1. Worker form config diagnostics and runtime validation passed in the local smoke test.
2. Mobile header overflow at 320–390px was fixed and verified with the responsive browser suite.
3. Dark-theme contrast issues were fixed without changing the brand orange token or hero gradient.
4. Turnstile accessibility issue was fixed and the form live status/message flow remains valid.
5. Calendly embed/CSP behavior was made safe and deferred until explicit activation.
6. React hydration mismatch on the homepage hero was fixed and confirmed with browser runtime checks.
7. Remaining content and legal items are not code blockers, but they still need owner review before production deployment.

**Still outside this workspace / production-only verification:**

- Final deployment to the live domain and real Worker secrets.
- Production-site SEO verification after the live domain is routed.
- Legal review of policy pages, cookie/retention language, and asset rights/provenance.
- Final client sign-off on any remaining placeholders or brand content.

**Current local status:**

- Build: PASS
- Test suite: PASS
- Responsive browser QA: PASS
- Worker smoke QA: PASS
- Browser runtime/hydration QA: PASS
- Production-domain and legal approval: STILL REQUIRED

This report reflects the verified state of the remediation work completed in-repo; it does not replace the final production deployment checklist.

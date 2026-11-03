# Daybytes Live Production Audit

**Audit date:** 2026-10-20  
**Target:** `https://daybytes.com`  
**Scope:** Read-only public HTTP, sitemap, headers, crawler User-Agent simulation, DNS, TLS, safe invalid-form probes, and browser audits using temporary tools installed outside the repository. No application, Cloudflare, DNS, registrar settings, or project dependencies were changed. Production form submissions that could send mail were not made.

## Pass / Fail / Not Tested

| Check | Result | Evidence / limitation |
|---|---|---|
| Homepage availability | PASS | `GET https://daybytes.com/` returned HTTP 200; `text/html`; 93,349 bytes. |
| Robots file | PASS | HTTP 200, `text/plain`, 1,178 bytes. Exact byte comparison with `public/robots.txt` passed; no extra top lines or Bot Preference Sync insertion. Full contents are in the repository file. |
| Sitemap index and shard | PASS | `/sitemap-index.xml`: HTTP 200, `application/xml`, 183 bytes. `/sitemap-0.xml`: HTTP 200, `application/xml`, 2,216 bytes, 28 URLs. Every URL is `https://daybytes.com` and returned HTTP 200 in zero redirects. No workers.dev, www, or non-HTTPS URLs found. |
| `/llms.txt` | PASS | HTTP 200, `text/plain`, 637 bytes. |
| `/favicon.ico` | FAIL | HTTP 404. The deployed site has `/favicon.svg` and `/favicon-32.png`; `/favicon.ico` is not present at the requested path. |
| Configured favicon paths | PASS | The HTML links `/favicon.svg` and `/favicon-32.png`; both configured assets are present in the repository. |
| Apple touch icon | PASS | `/apple-touch-icon.png`: HTTP 200, `image/png`, 3,153 bytes. |
| Web manifest | PASS | `/manifest.webmanifest`: HTTP 200, `application/manifest+json`, 391 bytes. |
| Email logo | PASS | `/brand/email-logo.png`: HTTP 200, `image/png`, 9,555 bytes. |
| Default OG image | PASS | Correct URL is `/og/default.png` (not `/og/daybytes-og.png`); HTTP 200, `image/png`, 313,836 bytes. |
| Images referenced by sitemap pages | PASS | All discovered image/OG file URLs fetched successfully with HTTP 200 and zero redirects. This includes OG, project images, logos, sphere fallback, and generated blog/service images. Extensionless internal anchors are not counted as images. |
| Robots byte comparison | PASS | `cmp public/robots.txt /tmp/live-robots.txt` matched. Difference output was empty. |
| Page status, canonical, metadata | PASS | 28/28 sitemap pages HTTP 200; all canonical URLs exactly matched each sitemap URL. Titles and descriptions present and unique in the checked set. Every sitemap URL completed in zero redirects. |
| Structured-data JSON syntax | PASS | 28/28 pages’ JSON-LD blocks parsed; no parse failures. Required-type sample data was inspected; some fields noted below. |
| Page image alt attributes | PASS | 28/28 sitemap pages had no `<img>` without an `alt` attribute in source HTML. |
| Mixed-content references | PASS | No `http://` values in `src` or `href` attributes on the 28 sitemap pages. |
| Content marker scan | PASS | No `[TO CONFIRM]`, lorem ipsum, workers.dev, avas.live, example.com, or old WordPress/theme-demo markers found in the 28 pages. Only public email found: `support@daybytes.com`. Human-readable phone found: `+234 913 320 3892`; other digit matches were SVG path data. |
| Homepage / inner / API security headers | PASS | Homepage, About, and `/api/config?formType=contact` returned 200 with HSTS, CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. No `X-Robots-Tag` on daybytes.com responses. |
| workers.dev noindex | PASS | `https://daybytes-tech-solutions.daybytestech.workers.dev/` returned HTTP 200 with `X-Robots-Tag: noindex, nofollow`. |
| `http://daybytes.com/` redirect | FAIL | Returned HTTP 200 over HTTP, not an HTTPS redirect. HTTPS delivery still included HSTS, but clients’ initial HTTP request was not redirected in this test. |
| `http://www.daybytes.com/` redirect | NOT TESTED | Connection timed out at 15 seconds with no response. |
| HTTPS www redirects | PARTIAL | `https://www.daybytes.com/` returned one-hop 301 to `https://daybytes.com/`. Full follow: `/about?ref=test` on www → one-hop 301 to `https://daybytes.com/about?ref=test` → second canonical-slash redirect to `https://daybytes.com/about/?ref=test`. Thus www rule itself preserves path/query, but final landing takes two total hops. |
| TLS certificate | PASS | Google Trust Services WE1; valid 2026-10-19 23:10:56 GMT through 2027-01-18 00:10:54 GMT; SANs `daybytes.com` and `*.daybytes.com`. Hostname check for `www.daybytes.com` passed. |
| Empty `POST /api/submit` | PASS | HTTP 400 generic validation error; no redirect. |
| `/api/config?formType=contact` | PASS | HTTP 200 with public site key and signed form-start values. No secrets returned. |
| Non-existent page | PARTIAL | Unique unknown path returned actual HTTP 404. Custom 404 body was not tested: the bounded `curl -f` invocation suppressed the body on 404. |
| `/test-brevo` | PASS | HTTP 404; no public test-mail page. |
| WordPress probes | PASS | `/wp-admin`, `/xmlrpc.php`, `/wp-content/` returned HTTP 404; `/wp-login.php` redirected to `/`. No WordPress content was served. |
| Missing-consent form submissions | PASS | Contact, training, careers each returned HTTP 400 with `Consent is required`; no mail delivery. |
| Honeypot form submissions | PASS | Contact, training, careers each returned HTTP 400 `Submission rejected`; no mail delivery. |
| Redirect-map audit | NOT TESTED | `REDIRECT-MAP.md`, `scripts/check-redirects.mjs`, and `npm run check:redirects` are absent from this workspace. Old URL list and “needs a decision” cases cannot be enumerated. |
| Lighthouse mobile/desktop on every page | PASS (56/56 runs) | Chromium + Lighthouse installed under `/tmp/daybytes-live-audit`; every one of the 28 sitemap pages completed in mobile and desktop modes. Score matrix and ranges below. No stalls or retries were needed. |
| Axe light/dark on every page | PASS (56/56 audits) | axe-core audited all 28 pages independently in light and dark themes; zero violations in either theme. |
| Per-page browser console, hydration, CSP, and failed requests | PARTIAL | All 28 pages loaded in Chromium and were observed. No React hydration #418 or uncaught page exception. Every page logs a CSP-blocked Cloudflare Insights beacon; exact page-specific exceptions are listed below. Cloudflare challenge requests on Contact and Training Apply were blocked/unreachable from this audit network. |
| 320/375/390 px horizontal overflow on production | FAIL at 320; PASS at 375/390 | All 28 pages share the same result: document scroll width is 334px at a 320px viewport (14px horizontal scroll), and fits exactly at 375px and 390px. Body `scrollWidth` was not used as the pass/fail measure because it reports a 432px content width even when the root document and visible elements fit. |
| Production mobile menu | PASS (28/28 pages) | `#menu-button` opened the mobile navigation and closed it again on every sitemap page. |
| Production form success / Turnstile / mailbox delivery | NOT TESTED | No valid production submission was attempted: these send real email, and Turnstile was not bypassed. Owner should manually perform one labeled submission per form. |
| Googlebot/Bingbot/GPTBot/ClaudeBot/PerplexityBot simulation | PASS (UA simulation only) | All five User-Agent strings got HTTP 200 for homepage, robots, sitemap index, About, and IT Support. SHA-256 body hashes matched a normal-browser UA for all 25 UA/resource combinations. This tests strings from this network only and does not prove real crawler IPs are allowed. |

### Browser Audit Results

Audit runner: Playwright with system Chromium, axe-core, and Lighthouse, all temporary under `/tmp/daybytes-live-audit`; no Kane CLI used. Live sitemap was re-fetched at run time and contained 28 URLs. Each page completed two Lighthouse runs and two axe scans. Lighthouse tuple is **Performance / Accessibility / Best Practices / SEO**. “Overflow” is root-document horizontal scrolling: all pages overflow by 14px at 320px and fit at 375px and 390px. Menu open/close passed on all pages. Axe counts are violations in light/dark mode.

| Sitemap page | Lighthouse mobile | Lighthouse desktop | Axe light/dark | Overflow 320/375/390 | Menu | Runtime diagnostics |
|---|---:|---:|---:|---|---|---|
| `/` | 62/100/92/100 | 82/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/about/` | 88/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/blog/` | 59/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/blog/elevate-your-small-business-with-professional-it-assistance/` | 84/100/92/100 | 91/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/blog/the-best-business-laptops-for-2026/` | 66/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/careers/` | 92/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/contact/` | 92/100/92/100 | 96/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block; Turnstile network failures; extra console `NaN` message |
| `/projects/` | 85/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/projects/bobsam-groups/` | 93/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/projects/bobsam-shop/` | 90/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/projects/pushback/` | 93/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/projects/win-vision-art/` | 92/100/92/100 | 95/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/services/` | 92/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/services/business-strategy-and-operational-optimization/` | 93/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/services/computer-sales-and-repair/` | 93/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/services/it-support/` | 94/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/services/smart-learning-solutions/` | 93/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/services/virtual-assistant-services/` | 95/100/92/100 | 100/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/services/web-development/` | 93/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/training/` | 86/100/92/100 | 96/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/training/ai-automations/` | 92/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/training/apply/` | 94/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block; Turnstile request unreachable |
| `/training/backend-development/` | 90/100/92/100 | 98/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/training/frontend-web-development/` | 92/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/training/it-support-and-system-management/` | 92/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/training/productivity-tools/` | 92/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/training/virtual-assistant/` | 93/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |
| `/training/website-management/` | 71/100/92/100 | 99/100/92/100 | 0/0 | FAIL/PASS/PASS | PASS | Common CSP block |

**Shared browser findings:** Every page emitted a browser console CSP error and a failed request for `https://static.cloudflareinsights.com/beacon.min.js/...`; the active `script-src` permits self, inline scripts, Calendly assets, and Cloudflare challenges, but not this Cloudflare Insights hostname. One CSP violation was recorded per page. No page emitted React hydration error #418 or an uncaught page exception. Lighthouse reported `errors-in-console` and `inspector-issues` in both modes on all 28 pages; these console/inspector findings are consistent with the blocked beacon and should be rechecked after its intended policy is decided.

**Additional page-specific browser findings:** On `/contact/`, one Turnstile challenge request to `challenges.cloudflare.com` returned HTTP 401 and a related `brunhild.challenges.cloudflare.com` request failed with `net::ERR_ADDRESS_UNREACHABLE`; Chromium also logged `%c%d font-size:0;color:transparent NaN`. On `/training/apply/`, the related `brunhild.challenges.cloudflare.com` challenge request failed with `net::ERR_ADDRESS_UNREACHABLE`. These challenge failures are network/browser-session observations and do not establish that normal visitors are blocked. No other failed requests or HTTP errors were recorded.

### Difference From Prelaunch

- `PRELAUNCH-REPORT.md` latest verification describes a local preview. Its 32-route × five-width suite passed, but live production still has a shared 320px overflow on all 28 sitemap pages: root document width 334px at 320px; 375px and 390px fit. The local and live results are not interchangeable.
- The latest local axe statement reports no violations in 64 route/theme audits. This production audit independently found zero violations in 56 audits (28 routes × two themes), consistent with the latest local result. The older prelaunch section that reports 852 dark-mode contrast nodes and three Turnstile `aria-prohibited-attr` nodes is superseded by that report’s newer verification and was not reproduced live.
- Lighthouse local-preview examples in the latest prelaunch section were Home 55, Contact 99, About 86 for Performance; the corresponding live mobile results are 62, 92, and 88, and live desktop results are 82, 96, and 99. Test conditions and environment differ; these are reference comparisons, not controlled regressions. Across production, mobile Performance ranges 59–95, desktop 82–100, Accessibility is 100, Best Practices 92, and SEO 100 on every page. Prelaunch's older full table lists SEO 69 on workers.dev, which does not match the production-domain SEO scores.
- Prelaunch's latest local runtime check found no hydration #418. Production likewise had no #418; instead, the browser audit exposed the Cloudflare Insights CSP block on all 28 pages and challenge-network errors on Contact and Training Apply.
- Prelaunch records the local responsive suite and mobile menu as passing. The production menu also passed open/close on all 28 pages, but the 320px layout differs as noted above.

### Proposed Fixes (Not Applied)

1. Inspect the rendered header/layout at 320px and reduce or reflow the element that extends the root document to 334px; preserve the passing 375px and 390px layouts. Re-run all 28 production routes after deployment.
2. Decide whether Cloudflare Insights is intended to run. If yes, review the narrowly scoped CSP source needed for its beacon; if not, remove/disable the injected beacon. Do not broaden CSP with a wildcard. Re-run the browser console and Lighthouse checks after the policy decision.
3. Recheck Turnstile on Contact and Training Apply from a normal browser/network where challenge endpoints are reachable. Treat the 401/unreachable results as inconclusive until reproduced from an ordinary client network.
4. Review Lighthouse opportunities for `/blog/` (mobile Performance 59), `/` (62), `/blog/the-best-business-laptops-for-2026/` (66), and `/training/website-management/` (71), prioritizing LCP/image delivery and main-thread work shown in their saved reports.
5. Consider resolving the repeated Lighthouse Best Practices score of 92 and browser `inspector-issues` after separating site defects from the blocked analytics beacon.

The complete Lighthouse JSON, per-page browser results, and temporary runner are in `/tmp/daybytes-live-audit/results/` and `/tmp/daybytes-live-audit/run-audit.cjs`; they are outside the repository.

## Needs Fixing

1. **Blocker:** Plain HTTP apex returned HTTP 200 instead of redirecting to HTTPS. Review the Cloudflare redirect/Always Use HTTPS configuration. No setting was changed during this audit.
2. **Important:** `http://www.daybytes.com/` timed out in this network. Verify HTTP www redirect behavior from another network and review the Cloudflare rule/zone coverage.
3. **Minor:** `/favicon.ico` returns 404. The site advertises SVG and PNG favicons, so this is only a fix if legacy clients or external checkers require `.ico`.
4. **Important:** All 28 sitemap pages have a 14px horizontal overflow at 320px (root document scroll width 334px). The same pages fit at 375px and 390px. Inspect and reflow the shared narrow-screen layout.
5. **Important:** All 28 pages block the Cloudflare Insights beacon under CSP `script-src`, producing a console error and failed request on every page. Decide whether the beacon should run and make only a narrowly scoped CSP or beacon configuration change.
6. **Important, needs normal-network confirmation:** Turnstile challenge requests were unreachable on Contact and Training Apply, with an additional HTTP 401 on Contact. Confirm these paths from a normal visitor network before changing challenge or CSP settings.
7. **Important, audit not completed:** Old URL redirects could not be compared because the redirect inventory/checker files are absent. Supply `REDIRECT-MAP.md` or restore the checker before evaluating obsolete URLs.

## Needs Owner To Check Manually

- Submit one clearly labeled “TEST - ignore” request to Contact/service request, training application, and Careers, complete Turnstile normally, and confirm the page success state. Do not submit consultation as a distinct form: it routes to Contact; no public newsletter form was found.
- Production form success, Turnstile completion under a normal visitor session, and mailbox notification/auto-reply delivery remain NOT TESTED. They were intentionally not exercised because valid submissions can send real email.
- In the owner’s mailbox, check each notification and auto-reply, confirm the logo is visible after remote images are enabled, and use Gmail “Show original” to verify `dkim=pass` and `dmarc=pass`.
- Confirm registrar lock and auto-renew; set an expiration reminder before 11 February 2027.
- In Cloudflare Security → Settings → Configure AI bot policies, confirm Search and Agent are not blocked; choose Training policy; decide whether Bot Preference Sync remains on. Keep Bot Fight Mode off until Security → Events has been reviewed. Configure available security email notifications and verify both custom domains remain under Worker Domains & Routes after the next deploy.
- Confirm Turnstile hostname allowlist includes `daybytes.com` and `www.daybytes.com`.
- Submit `https://daybytes.com/sitemap-index.xml` in Google Search Console and Bing Webmaster Tools, then request homepage indexing. The existing `google-site-verification` TXT value is published and is suitable for DNS-based Google verification; complete the ownership flow in Search Console to confirm it is accepted.
- Update Google Business Profile, social profiles, email signatures, and old links to `https://daybytes.com`.
- Optional: keep `r.mail.daybytes.com` and `img.mail.daybytes.com` Brevo branded-tracking records (both currently resolve); review whether to remove the leftover demo DNS record; clean old WordPress files only after a stable week or two, retaining mailboxes, mail directories, and hosting plan.
- Schedule a two-week re-check: indexing status, Cloudflare Security → Events for blocked crawlers, one fresh form test, and Lighthouse.

## DNS And Email

Read-only results from Google Public DNS (8.8.8.8) and Cloudflare authoritative nameserver `cecelia.ns.cloudflare.com`. Cloudflare proxying means authoritative A/AAAA answers are proxy origin/edge configuration values while recursive public answers are Cloudflare anycast addresses; they are intentionally listed separately.

| Record | 8.8.8.8 recursive answer | Authoritative answer |
|---|---|
| NS | `cecelia.ns.cloudflare.com`, `tadeo.ns.cloudflare.com` | Same; TTL 86400 |
| Apex A | `188.114.97.5`, `188.114.96.5` | `188.114.96.0`, `188.114.97.0` |
| Apex AAAA | `2a06:98c1:3121::5`, `2a06:98c1:3120::5` | `2a06:98c1:3120::`, `2a06:98c1:3121::` |
| www A | `188.114.97.2`, `188.114.96.2` | `188.114.96.0`, `188.114.97.0` |
| www AAAA | `2a06:98c1:3121::5`, `2a06:98c1:3120::5` | `2a06:98c1:3121::`, `2a06:98c1:3120::` |
| MX | Priority 0 `mx.daybytes.com`; MX target A `188.165.52.14` | Same |
| SPF | Exactly one apex TXT SPF: `v=spf1 a mx include:_spf.truehostcloud.com include:spf.brevo.com ~all` | Same |
| Brevo DKIM | `brevo1._domainkey` → `b1.daybytes-com.dkim.brevo.com`; `brevo2._domainkey` → `b2.daybytes-com.dkim.brevo.com` | Same CNAMEs |
| DMARC | `v=DMARC1;p=quarantine;sp=quarantine;adkim=r;aspf=s;pct=100;fo=0;rf=afrf;ri=86400;rua=mailto:dmarc-reports@truehostcloud.com;ruf=mailto:dmarc-reports@truehostcloud.com` | Same |
| Brevo code TXT | Present at apex (`brevo-code` record) | Same |
| Branded tracking | Optional `r.mail` and `img.mail` CNAME records both present and resolve through Brevo. | Same |
| DNSSEC | No DS/DNSKEY answer; appears unsigned. | No DS answer |
| CAA | No CAA answers. | Not queried |

MX, SPF, both DKIM selectors, and DMARC are present. This does not prove message authentication at delivery; verify with Gmail “Show original.”

## Structured Data And Metadata

| Page type | Observed JSON-LD | Notes |
|---|---|---|
| Home | `LocalBusiness`, `FAQPage` | Required business identity, canonical URL, logo/image, phone/email, address, hours and social links were populated. FAQ answer contains literal Markdown link notation `[contact page](/contact)` instead of plain prose; this is a minor structured-data content issue. |
| About | `LocalBusiness`, `BreadcrumbList` | URLs use `https://daybytes.com`. |
| Service | `Service`, `BreadcrumbList` | Name, description, service type, URL, provider and area served populated. |
| Project | `CreativeWork`, `BreadcrumbList` | Name, description, image, URL, creator, publisher and keywords populated. |
| Training program | `Course`, `BreadcrumbList` | Name, description, URL, provider, education level and teaches populated. No price, duration, or start date published. |
| Blog post | `BlogPosting`, `BreadcrumbList` | Headline, description, image, date, author, publisher and main page populated. |
| Careers | `BreadcrumbList` | No open role; no JobPosting block expected for the current page. |
| Contact | `FAQPage`, `BreadcrumbList` | FAQ and breadcrumbs present. |

The eight representative page samples (home, about, service, project, program, blog, careers, contact) had canonical and `og:url` values on `https://daybytes.com`; their JSON-LD first-party URL values also use that origin. `https://schema.org` is the schema vocabulary and social/client URLs are intentional external values. No `hreflang` tags were observed. Across all 28 fetched sitemap pages, title and description were present and unique. Careers has breadcrumb data only because no role is open. The requested complete printed JSON-LD blocks were inspected from production, but are not reproduced in this report; the live schema values and required fields are summarized above.

## Robots File (Full)

The response was byte-identical to `public/robots.txt` (1,178 bytes). Exact live content:

```text
User-agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: GPTBot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: ChatGPT-User
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: OAI-SearchBot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: ClaudeBot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: Claude-Web
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: anthropic-ai
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: PerplexityBot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: CCBot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: Google-Extended
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: Applebot-Extended
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /preview/

Sitemap: https://daybytes.com/sitemap-index.xml
```

No top-prepended content, including Cloudflare Bot Preference Sync text, was found. The file contains named groups for Googlebot, Bingbot, GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, CCBot, Google-Extended, Applebot-Extended, and `*`; all allow `/` and disallow `/api/`, `/admin/`, and `/preview/`.

## Representative JSON-LD Blocks

These are the exact JSON-LD blocks fetched from production on 2026-10-20. Multiple blocks are listed where present.

### Home (`/`)

```json
{"@context":"https://schema.org","@type":"LocalBusiness","@id":"https://daybytes.com/#business","name":"Daybytes Tech Solutions","url":"https://daybytes.com","logo":"https://daybytes.com/brand/daybytes-logo-512.png","image":"https://daybytes.com/og/default.png","description":"Daybytes Tech Solutions is an IT solutions company in Lagos, Nigeria. IT support, web development, computer repair, training and business optimization for businesses and individuals.","telephone":"+2349133203892","email":"support@daybytes.com","address":{"@type":"PostalAddress","addressLocality":"Lagos","addressRegion":"Nigeria","addressCountry":"NG"},"areaServed":["Lagos","Nigeria","Worldwide"],"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"08:00","closes":"18:00"}],"sameAs":["https://www.linkedin.com/company/daybytes-tech-solutions/","https://x.com/daybytes_tech","https://www.tiktok.com/@daybytes_tech","https://t.me/Daybyte_support"]}
```

```json
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What services does Daybytes Tech Solutions provide?","acceptedAnswer":{"@type":"Answer","text":"Daybytes Tech Solutions offers web development, IT support, computer repair, data recovery, consulting, eCommerce setup, and IT training for businesses and individuals."}},{"@type":"Question","name":"How can Daybytes Tech Solutions improve my online presence?","acceptedAnswer":{"@type":"Answer","text":"We optimize websites, social media ads, and workflow automations to increase visibility, engagement, and brand credibility."}},{"@type":"Question","name":"Do you provide IT support and system maintenance?","acceptedAnswer":{"@type":"Answer","text":"Absolutely. We handle troubleshooting, software installations, network support, and ongoing system maintenance to keep your operations running smoothly."}},{"@type":"Question","name":"Do you offer training or skill development?","acceptedAnswer":{"@type":"Answer","text":"Yes. Our Smart Learning programs cover frontend and backend web development, AI automations, virtual assistance, website management, IT support and system management, and everyday productivity tools for individuals and teams. See all programs on our training page."}},{"@type":"Question","name":"Do you work with startups or only established businesses?","acceptedAnswer":{"@type":"Answer","text":"Both. Our solutions are tailored for startups, SMEs, and individuals, as well as larger businesses."}},{"@type":"Question","name":"How do I get started?","acceptedAnswer":{"@type":"Answer","text":"Book a free call, or use the phone, WhatsApp, and email details on our [contact page](/contact) to speak with an expert."}}]}
```

### About (`/about/`)

```json
{"@context":"https://schema.org","@type":"LocalBusiness","@id":"https://daybytes.com/#business","name":"Daybytes Tech Solutions","url":"https://daybytes.com","logo":"https://daybytes.com/brand/daybytes-logo-512.png","image":"https://daybytes.com/og/default.png","description":"Daybytes Tech Solutions is an IT solutions company in Lagos, Nigeria. IT support, web development, computer repair, training and business optimization for businesses and individuals.","telephone":"+2349133203892","email":"support@daybytes.com","address":{"@type":"PostalAddress","addressLocality":"Lagos","addressRegion":"Nigeria","addressCountry":"NG"},"areaServed":["Lagos","Nigeria","Worldwide"],"openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"08:00","closes":"18:00"}],"sameAs":["https://www.linkedin.com/company/daybytes-tech-solutions/","https://x.com/daybytes_tech","https://www.tiktok.com/@daybytes_tech","https://t.me/Daybyte_support"]}
```

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://daybytes.com/"},{"@type":"ListItem","position":2,"name":"About","item":"https://daybytes.com/about"}]}
```

### Service (`/services/it-support/`)

```json
{"@context":"https://schema.org","@type":"Service","name":"IT Support","description":"IT support in Lagos for businesses and individuals, including troubleshooting, software installation, network support and ongoing system maintenance.","serviceType":"IT Support","url":"https://daybytes.com/services/it-support","provider":{"@id":"https://daybytes.com/#business"},"areaServed":["Lagos","Nigeria","Worldwide"]}
```

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://daybytes.com/"},{"@type":"ListItem","position":2,"name":"Services","item":"https://daybytes.com/services"},{"@type":"ListItem","position":3,"name":"IT Support","item":"https://daybytes.com/services/it-support"}]}
```

### Project (`/projects/bobsam-shop/`)

```json
{"@context":"https://schema.org","@type":"CreativeWork","name":"Bobsam Shop","description":"The retail arm of Bobsam Groups: an online store for furniture, lighting, interior decor and electronics, with prices in naira, sale discounts and a blog.","image":"https://daybytes.com/projects/bobsam-shop.png","url":"https://daybytes.com/projects/bobsam-shop","creator":{"@type":"Organization","name":"Daybytes Tech Solutions","url":"https://daybytes.com"},"publisher":{"@type":"Organization","name":"Daybytes Tech Solutions","url":"https://daybytes.com"},"keywords":"Next.js, React, Tailwind CSS, Stripe"}
```

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://daybytes.com/"},{"@type":"ListItem","position":2,"name":"Projects","item":"https://daybytes.com/projects"},{"@type":"ListItem","position":3,"name":"Bobsam Shop","item":"https://daybytes.com/projects/bobsam-shop"}]}
```

### Training Program (`/training/backend-development/`)

```json
{"@context":"https://schema.org","@type":"Course","name":"Backend Development","description":"Build the server side of web apps, including APIs, databases and authentication, and learn how to deploy and maintain them.","url":"https://daybytes.com/training/backend-development","provider":{"@type":"Organization","name":"Daybytes Tech Solutions","sameAs":"https://daybytes.com"},"educationalLevel":"Beginner to intermediate","teaches":["Build REST APIs with a framework such as Node.js and Express","Design and query relational databases with SQL","Add secure user registration, login and permissions","Validate input, handle errors and write basic tests","Deploy an application and manage environment settings"]}
```

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://daybytes.com/"},{"@type":"ListItem","position":2,"name":"Training","item":"https://daybytes.com/training"},{"@type":"ListItem","position":3,"name":"Backend Development","item":"https://daybytes.com/training/backend-development"}]}
```

### Blog (`/blog/the-best-business-laptops-for-2026/`)

```json
{"@context":"https://schema.org","@type":"BlogPosting","headline":"The Best Business Laptops for 2026","description":"Our pick of the best business laptops for 2026, comparing Dell, Lenovo, HP, Apple, Microsoft and ASUS on performance, battery life, security and value.","image":"https://daybytes.com/_astro/best-business-laptops-2026.DmHPm22V_Z2cAxdH.jpg","datePublished":"2026-03-01T00:00:00.000Z","author":{"@type":"Organization","name":"Daybytes Tech Solutions","url":"https://daybytes.com"},"publisher":{"@id":"https://daybytes.com/#business"},"mainEntityOfPage":"https://daybytes.com/blog/the-best-business-laptops-for-2026"}
```

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://daybytes.com/"},{"@type":"ListItem","position":2,"name":"Blog","item":"https://daybytes.com/blog"},{"@type":"ListItem","position":3,"name":"The Best Business Laptops for 2026","item":"https://daybytes.com/blog/the-best-business-laptops-for-2026"}]}
```

### Careers (`/careers/`)

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://daybytes.com/"},{"@type":"ListItem","position":2,"name":"Careers","item":"https://daybytes.com/careers"}]}
```

### Contact (`/contact/`)

The `FAQPage` block is identical to the Home FAQ block above. The contact breadcrumb block is:

```json
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://daybytes.com/"},{"@type":"ListItem","position":2,"name":"Contact","item":"https://daybytes.com/contact"}]}
```

## Launch Recommendation

**Problems to fix now:** confirm and correct the HTTP-to-HTTPS apex behavior, then re-test both HTTP apex and HTTP www redirects. The rest of the curl/DNS/metadata sample is generally sound, but interactive browser checks and the legacy redirect inventory remain incomplete, so this audit cannot certify all launch criteria.

**Proposed changes for owner approval (not performed):**

1. Adjust Cloudflare’s HTTPS redirect behavior so `http://daybytes.com/*` reaches the identical HTTPS URL in one hop; investigate the timed-out HTTP www entry separately.
2. Add a favicon.ico only if required by target clients/checkers; current SVG and PNG icons work at their advertised URLs.
3. Restore/provide the redirect map and checker, then run the complete old-URL comparison.
4. Re-run Lighthouse, axe, browser console/hydration/CSP, and mobile overflow tests after browser-runner authentication is restored.
5. Consider editing the FAQ structured answer to remove markdown link syntax from JSON-LD text.
# Policy Pages Design

**Goal:** Replace unresolved draft policy text with the owner-confirmed, counsel-approved facts and make the four policy routes eligible for public indexing.

**Architecture:** Keep policy copy in the existing Astro page files and preserve the existing site layout/components. Remove each policy page's draft/noindex treatment and remove the four legal routes from the sitemap draft exclusion list; do not introduce a CMS, consent manager, or new dependency.

**Tech Stack:** Astro pages, shared `BaseLayout`, existing sitemap integration, Node test/build scripts.

## Confirmed Policy Facts

- Processors/services receiving or processing site/form data: Cloudflare, Brevo, and Calendly only. No additional analytics, CRM, file-storage, or advertising-pixel service is used.
- Daybytes retains enquiries, job applications/CVs, training records, and security logs for one month.
- The one-month period is not confirmed for provider-side records. Policy language must limit the promise to data under Daybytes' control and say provider-side records are governed by each provider's own terms and retention practices.
- The site stores the user's theme choice in localStorage. Calendly is used for booking and Turnstile for form security. Do not claim analytics or advertising cookies are used.
- Flutterwave is the enabled card provider; international card payments are enabled. Bank transfer is also accepted; the existing Visa, Verve, and Mastercard payment options remain.
- A 50% project deposit is current. Rescheduling a free consultation with at least 48 hours' notice is free; any later cancellation/no-show fee must be disclosed before booking.
- The existing service and training refund schedules in `refund-policy.astro` are confirmed as current policy, subject to applicable law and the existing stated exceptions.
- The owner confirms counsel approved the exact final wording using these facts.

## Scope

- Update `src/pages/privacy.astro` with the confirmed processors, purposes, retention boundary, and accurate international-processing disclosure; remove unresolved placeholders.
- Update `src/pages/cookie-policy.astro` to describe current local storage and third-party services accurately; remove unresolved placeholders and avoid implying an analytics or advertising system exists.
- Update `src/pages/terms.astro` with confirmed payment and appointment terms; remove unresolved placeholders.
- Review `src/pages/refund-policy.astro` for consistency with the confirmed current schedule and remove draft framing.
- Remove `noindex` and draft notices from all four pages.
- Remove `/privacy/`, `/cookie-policy/`, `/terms/`, and `/refund-policy/` from `draftStaticPaths` in `astro.config.mjs` so the sitemap can include these pages.
- Update `TODO-FACTS.md` so resolved legal facts are no longer listed as unanswered.

## Non-Goals

- Do not change the site's data collection, form handling, analytics, cookie behavior, provider configuration, or email authentication.
- Do not add cookie-consent UI, new processors, or retention automation.
- Do not claim provider-side one-month deletion, guaranteed security safeguards, or legal rights beyond the approved copy and applicable law.
- Do not change unrelated site content or existing user modifications.

## Acceptance Criteria

- No unresolved business-fact placeholders remain in the four public policy pages.
- Each policy page no longer carries a draft notice or `noindex` directive.
- The sitemap configuration no longer excludes the four approved policy routes.
- Privacy copy limits the one-month promise to Daybytes-controlled records and distinguishes third-party retention.
- Cookie copy does not claim analytics or ad tracking is active.
- Terms and refund statements match the confirmed facts above.
- Production build and test suite pass; generated sitemap contains all four policy routes.

## Self-Review

- All owner-provided facts are explicit above; provider-side retention remains carefully qualified.
- Publication behavior is consistent across page metadata and sitemap filtering.
- No new runtime behavior, dependencies, or external integrations are introduced.
# Mail and Form Setup

The site submits contact, training, and careers forms to `POST /api/submit`. Configure runtime values in Workers Settings → Variables and Secrets. The Worker reads values only from its `env` binding. Never place secrets in source code, `.env.example`, `.dev.vars.example`, or Cloudflare Build variables.

## Runtime Variables

All application values below are read at Worker runtime. None are read at build time.

| Name | Type | Requirement | Provider / purpose |
| --- | --- | --- |
| `MAIL_PROVIDER` | Plain variable | Required | Selects `console`, `brevo`, `resend`, `formspree`, or `webhook`; console is local development only |
| `ENVIRONMENT` | Plain variable | Optional | Runtime development-mode switch for local console mail and local rate limiting; do not set to `development` in production |
| `TURNSTILE_SITE_KEY` | Plain variable | Required | Public Turnstile site key returned by `GET /api/config`; there is no `PUBLIC_TURNSTILE_SITE_KEY` lookup |
| `TURNSTILE_SECRET_KEY` | Secret | Required | Signs form-start proofs and verifies Turnstile submissions for all providers |
| `BREVO_API_KEY` | Secret | Required for Brevo | Brevo API authentication when `MAIL_PROVIDER=brevo` |
| `RESEND_API_KEY` | Secret | Required for Resend | Resend API authentication when `MAIL_PROVIDER=resend` |
| `FORMSPREE_ENDPOINT` | Plain variable | Required for Formspree | HTTPS Formspree endpoint when `MAIL_PROVIDER=formspree`; notifications/autoresponder are configured in Formspree |
| `WEBHOOK_URL` | Plain variable | Required for webhook | HTTPS endpoint when `MAIL_PROVIDER=webhook` |
| `WEBHOOK_SECRET` | Secret | Required for webhook | HMAC SHA-256 signing key when `MAIL_PROVIDER=webhook` |
| `BREVO_SENDER_EMAIL` | Plain variable | Optional | From address for Brevo and Resend; falls back to `support@daybytes.com` |
| `BREVO_CONTACT_TO` | Plain variable | Optional | Contact notification recipient for Brevo, Resend, and webhook delivery; falls back to `support@daybytes.com` (Formspree recipient configuration is managed in Formspree) |
| `BREVO_TRAINING_TO` | Plain variable | Optional | Training notification recipient; falls back to `support@daybytes.com` |
| `BREVO_CAREERS_TO` | Plain variable | Optional | Careers notification recipient; falls back to `support@daybytes.com` |

`ASSETS` and `FORM_RATE_LIMITER` are Cloudflare Worker bindings, not application variables. `ASSETS` is required to serve static files. `FORM_RATE_LIMITER` is configured by `wrangler.jsonc` and is required for production submissions; local development uses the in-memory limiter instead.

## Cloudflare Dashboard

In Workers & Pages → `daybytes-tech-solutions` → Settings → Variables and Secrets:

- Public values go in Settings → Variables and Secrets as plain variables.
- Private values (API keys, `TURNSTILE_SECRET_KEY`, `WEBHOOK_SECRET`) go in as secrets. Secrets must never go in Cloudflare "Build variables".
- Add only the secret for the selected mail provider, plus the Turnstile secret. Do not add real credentials to any repository file.
- Set `MAIL_PROVIDER` to the selected provider. Do not set production `ENVIRONMENT=development`.
- Add the Turnstile hostname for `daybytes.com` in Cloudflare Turnstile; include `www.daybytes.com` if it is configured as a Turnstile hostname.

## Provider Behavior

- **Brevo:** Sends the existing notification and customer auto-reply email templates. Configure `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and optional recipient variables.
- **Resend:** Sends both notification and auto-reply through Resend. Configure `RESEND_API_KEY`, `BREVO_SENDER_EMAIL`, and optional recipient variables.
- **Formspree:** Sends the notification to `FORMSPREE_ENDPOINT`. Enable and configure the auto-responder in the Formspree dashboard; the Worker does not send a second customer reply for this provider.
- **Webhook:** Sends separate notification and auto-reply events to `WEBHOOK_URL`. Each request includes `X-Daybytes-Event` and `X-Daybytes-Signature: sha256=...`. Verify the signature against the raw request body with `WEBHOOK_SECRET`.
- **Console:** Logs notification and auto-reply payloads for local development only. The Worker rejects this provider unless `ENVIRONMENT=development`.

## Local Development

Copy `.dev.vars.example` to `.dev.vars`, add local Turnstile test keys, and use `MAIL_PROVIDER=console` plus `ENVIRONMENT=development`. `.dev.vars` is ignored by Git. Wrangler's local rate limiter uses an in-memory equivalent with the same threshold; production uses the configured Cloudflare Rate Limit binding.

## Workers Builds Settings

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Build variables: none for application secrets or runtime mail configuration
- Static assets directory: `./dist` (configured in `wrangler.jsonc`)
- Worker entry: `src/worker.js` (configured in `wrangler.jsonc`)
- Custom route: `www.daybytes.com/*` redirects to `https://daybytes.com/*`; GET and HEAD use 301, while other methods use 308. Attach `daybytes.com` as the Worker custom domain for the apex site.

This repository migration has not been deployed by the development agent.

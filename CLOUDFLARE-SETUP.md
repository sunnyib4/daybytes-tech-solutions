# Cloudflare Workers Setup

## Current deployment

The active `wrangler.jsonc` intentionally has no `routes`, `custom_domain`, or `zone_name` entries for `daybytes.com` or `www.daybytes.com`. Workers Builds therefore deploys the Worker to its `workers.dev` address only while the domain remains on external DNS.

## Worker variables and secrets

Wrangler treats the configuration file as the source of truth for plain-text variables. By default, a deploy reconciles dashboard variables to the config, so dashboard-created plain variables that are absent from `vars` can be removed or overwritten on the next deploy. `keep_vars: true` opts out of that cleanup and preserves dashboard-set plain variables. The trade-off is that dashboard variables remain a second source of truth and can persist even when no longer wanted.

These non-secret values are committed under `vars` in `wrangler.jsonc`:

- `MAIL_PROVIDER=brevo`
- `TURNSTILE_SITE_KEY` (public Turnstile site key)
- `BREVO_SENDER_EMAIL=support@daybytes.com`
- `BREVO_CONTACT_TO=info@daybytes.com`
- `BREVO_TRAINING_TO=info@daybytes.com`
- `BREVO_CAREERS_TO=info@daybytes.com`

The public `TURNSTILE_SITE_KEY` is committed under `vars`. `keep_vars: true` remains temporarily to preserve any other dashboard-defined plain variables; remove it when dashboard settings have been reconciled into this configuration.

On the first request in each Worker isolate, the Worker checks required runtime configuration and logs the names of missing variables only. It never logs their values. The `/api/config` response remains generic and safe.

Keep `TURNSTILE_SECRET_KEY` and `BREVO_API_KEY` as encrypted Worker secrets in Settings → Variables and Secrets. They must not be put in `wrangler.jsonc`, other repository files, or Cloudflare Build variables. Wrangler deploys do not delete encrypted secrets.

The Worker keeps returning `X-Robots-Tag: noindex, nofollow` and a Disallow-all `robots.txt` on `*.workers.dev`. Built pages keep their canonical URLs pointed at `https://daybytes.com/`; production-host responses do not get the workers.dev noindex header. The Worker also retains its `www.daybytes.com` to apex redirect logic, ready for the www hostname to be routed to it.

## Add the production routes after moving DNS

1. Move the domain's nameservers to Cloudflare and wait until the zone is **Active**.
2. Review the imported DNS records. Ensure `daybytes.com` and `www.daybytes.com` have Cloudflare-proxied DNS records; a Worker Route requires the hostname's traffic to pass through Cloudflare.
3. Add this `routes` property to the top level of `wrangler.jsonc`:

```jsonc
"routes": [
  {
    "pattern": "daybytes.com/*",
    "zone_name": "daybytes.com"
  },
  {
    "pattern": "www.daybytes.com/*",
    "zone_name": "daybytes.com"
  }
],
```

4. Save the config and let Workers Builds deploy it. The apex route serves the site; the Worker redirects `www` to `https://daybytes.com`.
5. Verify `https://daybytes.com/` serves the site without `X-Robots-Tag`, `https://www.daybytes.com/` redirects to the apex, and the workers.dev preview remains `noindex, nofollow` with a Disallow-all robots response.

Do not add `custom_domain` or `zone_name` configuration before the `daybytes.com` zone exists and is active in this Cloudflare account.
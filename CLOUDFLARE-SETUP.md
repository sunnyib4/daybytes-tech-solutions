# Cloudflare Workers Setup

## Current deployment

The active `wrangler.jsonc` intentionally has no `routes`, `custom_domain`, or `zone_name` entries for `daybytes.com` or `www.daybytes.com`. Workers Builds therefore deploys the Worker to its `workers.dev` address only while the domain remains on external DNS.

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
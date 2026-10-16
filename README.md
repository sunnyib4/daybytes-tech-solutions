# Daybytes Tech Solutions — website

Astro + TypeScript + Tailwind CSS 4, with a React Three Fiber island for the hero sphere. Static assets and form APIs are served by a Cloudflare Worker.

## Develop

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # type-checks, then builds to dist/
npm run preview   # serve the production build
```

## Where things live

| What | Where |
| --- | --- |
| Phone, email, socials, hours, stats, Calendly, and form endpoints | `src/data/site.ts` |
| Logo files (mark, white mark, icons) | `public/brand/`, `public/favicon.svg`, `public/apple-touch-icon.png`, `src/components/Logo.astro` |
| Training programs | `src/content/programs/` |
| Job openings (only `open: true` are published) | `src/content/jobs/` |
| Services, testimonials, FAQs, team, blog posts (Markdown) | `src/content/<collection>/` |
| Collection schemas | `src/content.config.ts` |
| Design tokens (light + dark) | `src/styles/global.css` |
| Hero sphere: network engine / WebGL (desktop) / 2D canvas (phones) / static (reduced motion) | `src/scripts/network.ts`, `src/components/home/HeroSphere.tsx`, `src/scripts/sphere2d.ts`, `public/images/sphere-fallback.svg` |
| Rotating hero problems | `src/content/problems.yaml` |
| Projects | `src/content/projects/` |
| Old WordPress URL redirects | `public/_redirects` |
| Worker form handler and provider adapters | `src/worker.js`, `src/lib/worker/` |
| Worker deployment and static asset routing | `wrangler.jsonc` |
| Mail and Turnstile environment configuration | `MAIL-SETUP.md` |

## Before launch

- **Forms:** configure mail provider variables and Turnstile keys as described in `MAIL-SETUP.md`.
- **Logo:** the site uses the "D" mark from daybytes.com. To use the full logo, add it to `public/brand/` and update the paths in `src/components/Logo.astro` (dark version for light backgrounds, white version for dark).
- **Training:** fill in duration, price, start date and format for each program in `src/content/programs/`.
- **Careers:** confirm the [TO CONFIRM] lines on `/careers`; add roles in `src/content/jobs/` (copy the example and set `open: true`).
- **Photos:** the About and Approach sections use labelled placeholders (`ImagePlaceholder`). Swap in real photos with `astro:assets` `<Image>` and descriptive `alt` text.
- **Team:** `src/content/team/founder.md` is a draft placeholder; the current site lists no team members.
- **Facebook / YouTube:** add to `site.socials` once real URLs exist.

## Deploy (Cloudflare Workers Builds)

Connect the repo in Workers Builds, with:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Static asset directory: `./dist` (configured in `wrangler.jsonc`)
- Worker entry: `src/worker.js` (configured in `wrangler.jsonc`)

For local Worker development, copy `.dev.vars.example` to `.dev.vars`. Do not put real credentials in `.env.example` or `.dev.vars.example`, and never commit `.dev.vars`.

`public/_redirects` and `public/_headers` are included in `dist` and consumed by Workers Static Assets. The Worker handles `/api/*`, hostname-specific robots behavior, and the `www` canonical redirect. See `MAIL-SETUP.md` for variable and secret setup.

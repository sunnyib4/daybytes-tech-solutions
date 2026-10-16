# Daybytes Tech Solutions — website

Astro + TypeScript + Tailwind CSS 4, with a React Three Fiber island for the hero sphere. Static output, deployed to Cloudflare Pages.

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
| Phone, email, socials, hours, stats, Calendly, Formspree form IDs | `src/data/site.ts` |
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

## Before launch

- **Formspree:** set the three IDs in `site.forms` (`contact`, `training`, `careers`) in `src/data/site.ts`. CV uploads need a Formspree plan that allows file uploads; the CV-link field works on any plan.
- **Logo:** the site uses the "D" mark from daybytes.com. To use the full logo, add it to `public/brand/` and update the paths in `src/components/Logo.astro` (dark version for light backgrounds, white version for dark).
- **Training:** fill in duration, price, start date and format for each program in `src/content/programs/`.
- **Careers:** confirm the [TO CONFIRM] lines on `/careers`; add roles in `src/content/jobs/` (copy the example and set `open: true`).
- **Photos:** the About and Approach sections use labelled placeholders (`ImagePlaceholder`). Swap in real photos with `astro:assets` `<Image>` and descriptive `alt` text.
- **Team:** `src/content/team/founder.md` is a draft placeholder; the current site lists no team members.
- **Facebook / YouTube:** add to `site.socials` once real URLs exist.

## Deploy (Cloudflare Pages)

Connect the repo in the Cloudflare dashboard → Pages, with:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `NODE_VERSION=22` (or newer)
- Add `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` as Cloudflare Pages secrets under Settings → Variables and Secrets. Add `BREVO_CONTACT_TO`, `BREVO_TRAINING_TO`, and `BREVO_CAREERS_TO` there too if you need custom recipients, then redeploy.

For local form testing with `npm run dev`, create a root `.env` file with the same Brevo variables. For Cloudflare local worker/dev runtime, use `.dev.vars` instead. Do not put real credentials in `.env.example` or commit `.dev.vars`.

`public/_redirects` and `public/_headers` are picked up automatically by Pages.

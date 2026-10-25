// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { isExternalHref } from './src/lib/external-links.js';
import { SITE_URL } from './src/lib/site-url.js';

/** @type {(tree: any) => void} */
const transformExternalLinks = (tree) => {
  /** @param {any} node */
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'element' && node.tagName === 'a') {
      const href = node.properties?.href;
      if (isExternalHref(href, SITE_URL)) {
        node.properties = { ...node.properties, target: '_blank', rel: ['noopener', 'noreferrer'] };
        node.children ??= [];
        node.children.push({
          type: 'element',
          tagName: 'span',
          properties: { className: ['sr-only'] },
          children: [{ type: 'text', value: ' (opens in a new tab)' }],
        });
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
};
const rehypeExternalLinks = () => transformExternalLinks;

/** @param {string} path */
const readFrontmatter = (path) => {
  const source = readFileSync(path, 'utf8');
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/);
  return match ? parse(match[1]) : {};
};

const contentDates = new Map();
for (const [directory, dateField, routePrefix] of [
  ['./src/content/blog', 'updatedDate', '/blog/'],
]) {
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.md'))) {
    const frontmatter = readFrontmatter(`${directory}/${file}`);
    const date = frontmatter[dateField];
    if (date instanceof Date && !Number.isNaN(date.valueOf())) {
      contentDates.set(`${routePrefix}${file.replace(/\.md$/, '')}`, date);
    }
  }
}

// Project case studies that still contain [TO CONFIRM] placeholders are kept
// out of the sitemap (their pages are also marked noindex).
const draftProjects = readdirSync('./src/content/projects')
  .filter((f) => f.endsWith('.md') && readFileSync(`./src/content/projects/${f}`, 'utf8').includes('[TO CONFIRM'))
  .map((f) => `/projects/${f.replace(/\.md$/, '')}/`);
/** @type {string[]} */
const legalPolicyPaths = ['/privacy/', '/cookie-policy/', '/terms/', '/refund-policy/'];
const draftStaticPaths = legalPolicyPaths.filter((path) => {
  const page = path.replace(/^\//, '').replace(/\/$/, '');
  return readFileSync(`./src/pages/${page}.astro`, 'utf8').includes('[TO CONFIRM]');
});

export default defineConfig({
  site: 'https://daybytes.com',
  output: 'static',
  trailingSlash: 'ignore',
  markdown: {
    processor: unified({ rehypePlugins: [rehypeExternalLinks] }),
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const url = new URL(page);
        const path = url.pathname;
        return (
          !draftProjects.some((draft) => path.endsWith(draft)) &&
          !draftStaticPaths.includes(path) &&
          !/^\/(?:404|api|admin|preview|test-brevo)(?:\/|$)/.test(path)
        );
      },
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/\/$/, '');
        const lastmod = contentDates.get(path);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Prevent the dev server from trying to optimize @react-three/fiber into a stale
    // SSR path. The React Three Fiber bundle is browser-only and should be handled by
    // Astro's normal client transform instead of Vite's pre-bundling step.
    //
    // Excluding @react-three/fiber also stops Vite from crawling its dependencies, so the
    // two CommonJS-only leaves below (scheduler, use-sync-external-store) would be served
    // as raw source. The Cloudflare dev runtime is ESM-only, so `module.exports` there
    // throws "module is not defined" and the homepage 500s. Forcing them through the
    // optimizer converts them to ESM; their ESM siblings are already fine as-is.
    optimizeDeps: {
      exclude: ['@react-three/fiber'],
      include: ['three', 'react', 'react-dom', 'react-dom/client', 'scheduler', 'use-sync-external-store/shim/with-selector.js'],
    },
  },
});

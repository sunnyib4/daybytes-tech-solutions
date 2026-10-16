import type { APIRoute } from 'astro';
import { site } from '@/data/site';

export const prerender = true;

const llmsText = [
  `# ${site.name}`,
  '',
  `${site.name} provides IT support, web development, computer sales and repair, virtual assistant services, business operations support, and practical technology training. The business is based in ${site.address.locality}, ${site.address.region}, and serves clients locally and worldwide.`,
  '',
  '## Main pages',
  `- Home: ${site.url}/`,
  `- About: ${site.url}/about`,
  `- Services: ${site.url}/services`,
  `- Projects: ${site.url}/projects`,
  `- Training: ${site.url}/training`,
  `- Blog: ${site.url}/blog`,
  `- Contact: ${site.url}/contact`,
  '',
  '## Contact',
  `Email: ${site.email}`,
  `Phone: ${site.phone.display}`,
].join('\n');

export const GET: APIRoute = () =>
  new Response(`${llmsText}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
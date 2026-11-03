import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { SITE_URL } from '../src/lib/site-url.js';
import { siteContact } from '../src/lib/site-contact.js';

const loadMarkdownCollection = async (directory) => Promise.all((await readdir(directory))
  .filter((name) => name.endsWith('.md'))
  .map(async (name) => {
    const source = await readFile(`${directory}/${name}`, 'utf8');
    const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    const data = frontmatter ? parse(frontmatter[1]) : {};
    const body = source.slice(frontmatter?.[0].length ?? 0).trim()
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`#>-]/g, '')
      .replace(/\n{2,}/g, '\n');
    return { id: name.replace(/\.md$/, ''), data, body };
  }));

const [services, programs, faqs] = await Promise.all([
  loadMarkdownCollection('src/content/services'),
  loadMarkdownCollection('src/content/programs'),
  loadMarkdownCollection('src/content/faqs'),
]);
const serviceRows = services.map(({ data, body }) => ({ title: data.title, summary: data.summary, description: data.description, details: body }));
const programRows = programs.map(({ id, data }) => ({ id, title: data.title, summary: data.summary, audience: data.audience, outcomes: data.outcomes, format: data.format, level: data.level }));
const faqRows = faqs.map(({ data, body }) => ({ question: data.question, answer: body }));

const knowledge = {
  version: 1,
  services: serviceRows,
  programs: programRows,
  faqs: faqRows,
  business: {
    name: 'Daybytes Tech Solutions',
    description: 'IT solutions in Lagos for businesses and individuals: IT support, web development, computer repair, training, and business optimization.',
    email: siteContact.email,
    phone: siteContact.phone.display,
    whatsapp: siteContact.whatsapp,
    calendly: siteContact.calendly,
    address: 'Lagos, Nigeria',
    hours: ['Monday to Friday: 08:00 to 18:00', 'Saturday and Sunday: by appointment'],
    payments: 'International bank transfer is accepted in USD, EUR, and GBP. Pricing is quoted per client. No card payments are accepted on this website.',
    contactForm: `${SITE_URL}/contact/`,
  },
};

const serialized = JSON.stringify(knowledge);
const prompt = (await readFile('src/lib/worker/chat-prompt.md', 'utf8')).trim();
if (Buffer.byteLength(serialized) + Buffer.byteLength(prompt) > 24000) throw new Error('Chat prompt and knowledge exceed 24 KB budget');
await mkdir('src/lib/worker', { recursive: true });
await writeFile('src/lib/worker/chat-knowledge.js', `export default ${JSON.stringify({ prompt, knowledge: serialized })};\n`);
console.log(`Generated private chat prompt and knowledge: ${Buffer.byteLength(serialized) + Buffer.byteLength(prompt)} bytes.`);
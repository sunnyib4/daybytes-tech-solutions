import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const placeholderPattern = /\[TO CONFIRM\]|\[Team member name\]|\[Role\]|EXAMPLE ROLE|not public while `open: false`/gi;
const findings = [];
const failures = [];

async function readDirectory(relativePath) {
  const entries = await readdir(path.join(root, relativePath), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...(await readDirectory(child)));
    else files.push(child);
  }
  return files;
}

function countMatches(source) {
  return [...source.matchAll(placeholderPattern)].length;
}

function frontmatter(source) {
  return source.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '';
}

for (const file of await readDirectory('src/content')) {
  if (!file.endsWith('.md')) continue;
  const source = await readFile(path.join(root, file), 'utf8');
  const count = countMatches(source);
  if (!count) continue;

  const meta = frontmatter(source);
  const isTeamDraft = file.startsWith('src/content/team/') && /^draft:\s*true\s*$/m.test(meta);
  const isClosedJob = file.startsWith('src/content/jobs/') && /^open:\s*false\s*$/m.test(meta);
  const isBlogDraft = file.startsWith('src/content/blog/') && /^draft:\s*true\s*$/m.test(meta);
  const isProjectHeld = file.startsWith('src/content/projects/');
  const isHeld = isTeamDraft || isClosedJob || isBlogDraft || isProjectHeld;
  const collection = file.split('/')[2];
  const slug = path.basename(file, '.md');
  const route = collection === 'team' ? '/about' : collection === 'jobs' ? `/careers/${slug}` : `/${collection}/${slug}`;
  findings.push({ route, file, count, held: isHeld });
  if (!isHeld) failures.push(`${route} (${file})`);
}

for (const file of await readDirectory('src/pages')) {
  if (!file.endsWith('.astro')) continue;
  const source = await readFile(path.join(root, file), 'utf8');
  const markup = source.split('---').slice(2).join('---');
  const count = countMatches(markup);
  if (!count) continue;
  const noindex = /<BaseLayout[\s\S]*?\bnoindex(?:\s|=|>)/.test(markup) || /<meta\s+name="robots"\s+content="noindex"/.test(markup);
  const route = file.replace(/^src\/pages/, '').replace(/\/index\.astro$/, '').replace(/\.astro$/, '').replace(/\[slug\]/g, ':slug') || '/';
  findings.push({ route, file, count, held: noindex });
  if (!noindex) failures.push(`${route} (${file})`);
}

if (failures.length) {
  console.error('Placeholder safety check failed: placeholders occur on indexable page source:');
  console.error(failures.join('\n'));
  process.exit(1);
}

if (findings.length) {
  console.warn('WARNING: unresolved placeholders remain on draft/noindex or closed content pages:');
  for (const finding of findings) {
    console.warn(`- ${finding.route}: ${finding.count} placeholder(s) in ${finding.file}`);
  }
} else {
  console.log('Placeholder safety check passed: no page content contains unresolved placeholders.');
}

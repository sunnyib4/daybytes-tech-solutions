import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const siteSource = await readFile(path.join(root, 'src/data/site.ts'), 'utf8');
const publicEmail = siteSource.match(/\bemail:\s*'([^']+)'/)?.[1];

if (!publicEmail) {
  console.error('Contact check failed: site.email could not be read from src/data/site.ts.');
  process.exit(1);
}

const mailSystemAllowlist = new Set(['noreply@daybytes.com']);
const scanRoots = ['src', 'public'];
const rootFiles = ['README.md', 'AUDIT-REPORT.md', 'SEO-REPORT.md', '.env.example'];
const textExtensions = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.md', '.mdx', '.txt', '.json', '.yaml', '.yml', '.html', '.example']);
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const violations = [];

async function collectFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  let entries;
  try {
    entries = await readdir(absolutePath, { withFileTypes: true });
  } catch {
    return [relativePath];
  }

  const files = [];
  for (const entry of entries) {
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(child)));
    else files.push(child);
  }
  return files;
}

const files = [...rootFiles];
for (const scanRoot of scanRoots) files.push(...(await collectFiles(scanRoot)));

for (const file of files) {
  if (!textExtensions.has(path.extname(file)) && !rootFiles.includes(file)) continue;
  let source;
  try {
    source = await readFile(path.join(root, file), 'utf8');
  } catch {
    continue;
  }

  for (const [index, line] of source.split('\n').entries()) {
    for (const address of line.match(emailPattern) ?? []) {
      const isAllowedMailSystemAddress = mailSystemAllowlist.has(address.toLowerCase()) && /BREVO_SENDER_EMAIL|senderEmail|noreply/i.test(line);
      if (address.toLowerCase() !== publicEmail.toLowerCase() && !isAllowedMailSystemAddress) {
        violations.push(`${file}:${index + 1}: ${address}`);
      }
    }
  }
}

if (violations.length) {
  console.error(`Public email check failed. Use site.email (${publicEmail}) for public contact, or an explicitly allowed mail-system sender.`);
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log(`Public email check passed: ${publicEmail} is the only public contact address.`);
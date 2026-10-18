import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import FORM_TYPES from '../src/lib/form-types.js';
import { formSchemas } from '../src/lib/worker/forms.js';
import { formConfig } from '../src/lib/worker/mail.js';

const readAstroFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? readAstroFiles(path) : path.endsWith('.astro') ? [path] : [];
});

test('worker schemas and every AjaxForm caller use the shared form type list', () => {
  assert.deepEqual(Object.keys(formSchemas), [...FORM_TYPES]);
  assert.deepEqual(Object.keys(formConfig), [...FORM_TYPES]);

  const callers = [...readAstroFiles('src/pages'), ...readAstroFiles('src/components')]
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => source.includes('<AjaxForm'));
  const sentTypes = callers.flatMap(({ source }) => [...source.matchAll(/\bform="([^"]+)"/g)].map((match) => match[1]));

  assert.deepEqual([...new Set(sentTypes)].sort(), [...FORM_TYPES].sort());
  for (const formType of sentTypes) assert.ok(FORM_TYPES.includes(formType), `${formType} is not a supported form type`);
});

test('the shared AjaxForm submits form_name as multipart FormData', () => {
  const source = readFileSync('src/components/forms/AjaxForm.astro', 'utf8');
  const client = readFileSync('src/scripts/forms.ts', 'utf8');

  assert.match(source, /method="POST"/);
  assert.match(source, /enctype="multipart\/form-data"/);
  assert.match(source, /data-form-kind=\{form\}/);
  assert.match(source, /name="form_name" value=\{form\}/);
  assert.match(client, /new FormData\(form\)/);
  assert.match(client, /fetch\(form\.action/);
});

test('no public test-brevo page exists in Astro page sources', () => {
  const routes = readAstroFiles('src/pages');
  assert.equal(routes.some((path) => /(^|\/)test-brevo(?:\/|\.)/.test(path)), false);
});

test('test-brevo is not listed as a public site form', () => {
  const source = readFileSync('src/data/site.ts', 'utf8');
  assert.doesNotMatch(source, /test-brevo/);
});
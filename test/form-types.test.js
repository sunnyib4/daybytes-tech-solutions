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

test('named site journeys map to the shared submission types or stay outside the Worker', () => {
  const contact = readFileSync('src/pages/contact.astro', 'utf8');
  const trainingApply = readFileSync('src/pages/training/apply.astro', 'utf8');
  const trainingDetail = readFileSync('src/pages/training/[slug].astro', 'utf8');
  const careers = readFileSync('src/components/careers/ApplicationForm.astro', 'utf8');
  const consultation = readFileSync('src/components/ui/ConsultCard.astro', 'utf8');

  assert.match(contact, /<AjaxForm[^>]*form="contact"/s, 'service request must use contact');
  assert.match(trainingApply, /form="training"/, 'training application must use training');
  assert.match(trainingDetail, /\/training\/apply\?program=\$\{program\.id\}/, 'training enrolment must lead to the training form');
  assert.match(careers, /form="careers"/, 'careers applications must use careers');
  assert.match(consultation, /<form action="\/contact" method="get"/);
  assert.doesNotMatch(consultation, /\/api\/submit|data-ajax-form/);
  assert.equal(readAstroFiles('src/pages').some((path) => /newsletter/i.test(path)), false);
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
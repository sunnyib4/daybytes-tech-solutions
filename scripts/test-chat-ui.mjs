import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = new URL(process.env.CHAT_TEST_BASE_URL || 'http://127.0.0.1:4321');
const screenshotDir = process.env.CHAT_TEST_SCREENSHOT_DIR || 'screenshots/chat-assistant';
await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const checks = [];
const turnstileRequests = new WeakMap();
const submitCalls = new WeakMap();

async function mockChat(page, mode) {
  turnstileRequests.set(page, []);
  submitCalls.set(page, 0);
  page.on('request', (request) => {
    if (request.url().includes('challenges.cloudflare.com')) turnstileRequests.get(page).push(request.url());
  });
  await page.route('**/api/chat/config', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true }) }));
  await page.route('**/api/config?formType=chat-lead', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ startedAt: String(Date.now() - 4000), startedProof: 'a'.repeat(64) }) }));
  await page.route('**/api/chat', async (route) => {
    const request = route.request().postDataJSON();
    if (mode === 'handoff') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'handoff', message: 'Please message us on WhatsApp and our team can help.', whatsappUrl: 'https://wa.me/2349133203892?text=fixture', showLeadForm: false, sessionProof: 'fixture-session-proof-012345678901234567890123456789' }) });
    if (mode === 'error') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'lead', reason: 'upstream-error', message: 'Please leave your details or use WhatsApp.', showLeadForm: true }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'answer', message: `Here is **IT support** for: ${request.messages.at(-1).content}\n\n- Network help\n- Website support\n\nVisit https://evil.example`, sessionProof: 'fixture-session-proof-012345678901234567890123456789' }) });
  });
  await page.route('**/api/submit', (route) => {
    submitCalls.set(page, submitCalls.get(page) + 1);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

function assertNoTurnstileRequest(page) {
  assert.deepEqual(turnstileRequests.get(page), [], 'chat makes no request to challenges.cloudflare.com');
}

async function open(page) {
  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
  const trigger = page.locator('[data-chat-trigger]');
  await trigger.waitFor({ state: 'visible' });
  await page.keyboard.press('Tab');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const panel = page.locator('[data-chat-panel]');
  await panel.waitFor({ state: 'visible' });
  return { trigger, panel };
}

try {
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await mockChat(page, 'answer');
    await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
    const trigger = page.locator('[data-chat-trigger]');
    await trigger.waitFor({ state: 'visible' });
    const panel = page.locator('[data-chat-panel]');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await panel.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('daybytes-chat-v1') || '{}').hasOpened), true, 'first open is recorded for one-time onboarding');
    assert.equal(await panel.evaluate((element) => getComputedStyle(element).animationName), 'chat-panel-enter', 'first-open panel animation is applied');
    await page.screenshot({ path: `${screenshotDir}/1280-first-open.png` });
    await page.locator('[data-chat-close]').click();
    await trigger.click();
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('daybytes-chat-v1') || '{}').hasOpened), true, 'onboarding remains marked after reopening');
    await context.close();
  }

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await mockChat(page, 'answer');
    await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle' });
    const trigger = page.locator('[data-chat-trigger]');
    assert.equal(await trigger.isVisible(), true, 'chat appears only after runtime config says enabled');
    await page.screenshot({ path: `${screenshotDir}/${viewport.width}-closed.png` });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const panel = page.locator('[data-chat-panel]');
    await panel.waitFor({ state: 'visible' });
    assert.equal(await panel.evaluate((element) => element.classList.contains('chat-onboarding')), false, 'reduced motion skips the onboarding animation');
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('daybytes-chat-v1') || '{}').hasOpened), true, 'first-open state is stored in the existing session key');
    assert.equal(await page.locator('#daybytes-chat-input').evaluate((el) => el === document.activeElement), true, 'opening focuses input');
    await page.screenshot({ path: `${screenshotDir}/${viewport.width}-open.png` });
    const input = page.locator('[data-chat-input]');
    await input.fill('What services do you offer?');
    await input.press('Enter');
    await page.locator('[data-chat-messages] strong').getByText('IT support').waitFor();
    assertNoTurnstileRequest(page);
    assert.equal(await page.locator('[data-chat-messages] li').count(), 2, 'assistant Markdown lists render as list items');
    assert.equal(await page.locator('[data-chat-messages] a[href*="evil.example"]').count(), 0, 'unapproved links are not made clickable');
    assertNoTurnstileRequest(page);
    await page.keyboard.press('Escape');
    assert.equal(await panel.isVisible(), false, 'Escape closes dialog');
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true, 'close restores trigger focus');
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.client, `no horizontal overflow: ${JSON.stringify(dimensions)}`);
    await page.evaluate(() => window.scrollTo(0, 900));
    const scrollTop = page.locator('[data-scroll-to-top]');
    await scrollTop.waitFor({ state: 'visible' });
    const [chatBox, topBox] = await Promise.all([trigger.boundingBox(), scrollTop.boundingBox()]);
    assert.ok(chatBox && topBox && (chatBox.y + chatBox.height <= topBox.y || topBox.y + topBox.height <= chatBox.y), 'chat launcher and scroll-to-top button do not overlap');
    await trigger.click();
    const [openChatBox, openTopBox] = await Promise.all([trigger.boundingBox(), scrollTop.boundingBox()]);
    assert.ok(openChatBox && openTopBox && (openChatBox.y + openChatBox.height <= openTopBox.y || openTopBox.y + openTopBox.height <= openChatBox.y), 'chat launcher and scroll-to-top remain separate while chat is open');
    checks.push(`answer-flow-${viewport.width}`);
    await context.close();
  }

  for (const mode of ['handoff', 'error']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await mockChat(page, mode);
    await open(page);
    await page.locator('[data-chat-input]').fill(mode === 'handoff' ? 'I want to speak to a person' : 'Tell me about an unknown service');
    await page.locator('[data-chat-input]').press('Enter');
    if (mode === 'handoff') {
      const handoff = page.locator('[data-chat-messages] .chat-message-assistant:visible').last();
      await handoff.getByRole('link', { name: 'Continue on WhatsApp' }).waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-chat-lead]').isVisible(), false, 'human handoff must not open a lead form');
    }
    else {
      const lead = page.locator('[data-chat-lead]');
      await lead.waitFor({ state: 'visible' });
      const messages = page.locator('[data-chat-messages]');
      const response = messages.locator('[data-chat-lead-response]');
      assert.equal(await response.count(), 1, 'lead UI is one response inside the message stream');
      assert.equal(await response.evaluate((element) => element.classList.contains('chat-message-assistant')), true, 'lead response uses assistant message styling');
      assert.match(await response.locator('[data-chat-lead-copy]').textContent(), /leave your details or use WhatsApp/i, 'assistant response explains the enquiry form');
      assert.equal(await response.locator('[data-chat-lead]').count(), 1, 'lead form is inside the assistant response');
      assert.equal(await response.locator('[data-chat-lead-whatsapp]').count(), 1, 'WhatsApp action is inside the same assistant response');
      assert.equal(await response.locator('[name="consent"]').count(), 1, 'privacy consent is inside the assistant response');
      assert.equal(await response.locator('[data-form-status]').count(), 1, 'submit status is inside the assistant response');
      assert.equal(await response.locator('button[type="submit"]').count(), 1, 'submit action is inside the assistant response');
      const whatsappUrl = new URL(await response.locator('[data-chat-lead-whatsapp]').getAttribute('href'));
      assert.equal(whatsappUrl.hostname, 'wa.me', 'lead response preserves the WhatsApp destination');
      assert.ok(whatsappUrl.searchParams.get('text'), 'lead response preserves the prefilled WhatsApp text');
      await page.screenshot({ path: `${screenshotDir}/375-lead-mode.png` });
      await page.locator('[data-chat-lead] button[type="submit"]').waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('[data-chat-lead] button[type="submit"]')?.disabled);
      assert.equal(await page.locator('[name="name"]').evaluate((el) => el === document.activeElement), true, 'lead transition focuses the first enquiry field');
      assert.equal(await page.locator('[name="consent"]').isChecked(), false, 'consent starts unticked');
      await page.locator('[name="name"]').fill('Amina Example');
      await page.locator('[name="message"]').fill('Please contact me about your services.');
      await page.locator('[name="consent"]').check();
      await page.locator('[data-chat-lead] button[type="submit"]').click();
      assert.match(await page.locator('[data-form-status]').textContent(), /email address or phone number/i, 'email or phone is required');
      await page.locator('[name="email"]').fill('amina@example.com');
      await page.screenshot({ path: `${screenshotDir}/375-lead-form.png` });
      await page.locator('[data-chat-lead] button[type="submit"]').click();
      await page.getByText('Thanks. Your enquiry has been sent.').waitFor();
      assert.equal(submitCalls.get(page), 1, 'complete lead form submits to /api/submit');
      assert.equal(await page.locator('[data-form-status]').textContent(), 'Thanks. Your enquiry has been sent.', 'successful submission status is shown');
      const resetButton = page.locator('[data-chat-reset]');
      await resetButton.waitFor({ state: 'visible' });
      await resetButton.click();
      assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('daybytes-chat-v1') || '{}')), { hasOpened: true, messages: [], unansweredCount: 0 }, 'new chat clears stored transcript and proof state');
      assert.equal(await page.locator('[data-chat-messages] .chat-message').count(), 0, 'new chat clears the saved conversation view');
      assert.equal(await page.locator('[data-chat-suggestions]').isVisible(), true, 'new chat restores the starter suggestions');
      assertNoTurnstileRequest(page);
    }
    assertNoTurnstileRequest(page);
    await page.screenshot({ path: `${screenshotDir}/375-${mode}-handoff.png` });
    checks.push(mode);
    await context.close();
  }

  console.log(`Chat UI checks passed: ${checks.join(', ')}. Screenshots: ${screenshotDir}/`);
} finally {
  await browser.close();
}

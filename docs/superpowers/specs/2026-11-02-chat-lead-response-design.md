# Chat Lead Response Presentation

## Goal

Make the chat assistant's human-follow-up path feel like a natural assistant response, with the enquiry form and WhatsApp option together in the conversation. Chat enquiries must not display or invoke a Cloudflare Turnstile checkbox.

## Verified Starting Point

- `ChatWidget.astro` renders the lead form and WhatsApp handoff in separate fixed footer sections beneath the chat history.
- `showLeadMode()` reveals both sections after appending the assistant's lead message.
- `initializeLeadForm()` loads and executes Turnstile immediately when the lead form opens, which can display a Cloudflare challenge before the visitor submits.
- The shared form validator and Worker currently require Turnstile for all form types. Chat leads already receive signed form-start validation, honeypot validation, host/origin checks, and per-form rate limiting.
- Contact, training, and careers forms use the shared form protection and are outside this change.

## Design

Render the human-follow-up response as one assistant-styled item in the chat history. It contains the assistant's short explanation, the existing chat enquiry fields, and a WhatsApp text action as an alternative contact route. The form retains required name, message, and privacy consent fields; visitors provide at least one of email or phone. The form and WhatsApp action should share the same response treatment and scroll with the conversation, rather than appearing as detached panel footers. Preserve the existing WhatsApp destination and prefilled message.

Remove Turnstile loading, rendering, UI, and token handling from the chat-lead path. Permit a missing Turnstile token only for `chat-lead` submissions. Continue enforcing the signed form-start proof and minimum fill time, honeypot, schema validation, host/origin checks, body size limit, and chat-lead rate limit before delivery. All other form types continue to require Turnstile exactly as before. Do not change AI answers, handoff decisions, mail delivery, transcript handling, or chat-session proof behavior.

## Validation

- Worker tests prove a valid chat-lead submission succeeds without a Turnstile token while contact, training, and careers submissions still reject missing/invalid Turnstile tokens.
- Chat UI tests prove the lead form and WhatsApp action appear within the assistant response in desktop and mobile layouts, and that chat lead mode does not load Turnstile or expose a Cloudflare verification control.
- The chat-lead form still submits successfully in the browser fixture, including consent and contact validation.
- Run the focused chat/Worker tests and production build. Preserve unrelated worktree changes and do not deploy.
import worker from '../src/worker.js';

const upstreamFetch = globalThis.fetch.bind(globalThis);
let requestHostname = 'localhost';

globalThis.fetch = async (input, init) => {
  if (String(input).includes('/turnstile/v0/siteverify')) {
    const body = new URLSearchParams(init?.body);
    if (
      body.get('secret') === '1x0000000000000000000000000000000AA' &&
      body.get('response') === 'XXXX.DUMMY.TOKEN.XXXX'
    ) {
      return Response.json({ success: true, hostname: requestHostname, 'error-codes': [] });
    }
  }

  return upstreamFetch(input, init);
};

export default {
  fetch(request, env, ctx) {
    requestHostname = new URL(request.url).hostname;
    return worker.fetch(request, env, ctx);
  },
};

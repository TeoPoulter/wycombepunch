// No real requests: exercise the public adapter with a simulated Turnstile API
// and fetch responses. Payloads are test-only data and never leave this process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, randomUUID } from 'node:crypto';
import vm from 'node:vm';

const source = readFileSync(new URL('../docs/assets/enquiry-delivery.js', import.meta.url), 'utf8');
const endpoint = 'https://wycombe-punch-enquiries.example.workers.dev/enquiry';
const fields = () => new URLSearchParams({ 'form-name': 'wycombe-punch-enquiry', name: 'Adapter test', email: 'adapter-test@example.invalid', phone: '+44 7700900123', 'event-type': 'Eid celebration', 'event-date': '2026-10-25', venue: 'High Wycombe — test only', duration: '3–5 hours', message: 'Test only. No booking.', '_gotcha': '' });
const reply = (status, json, type = 'application/json; charset=utf-8') => ({ status, headers: new Headers({ 'content-type': type }), text: async () => typeof json === 'string' ? json : JSON.stringify(json) });
function fixture({ stored = new Map(), noStorage = false, noAPI = false, scriptFailure = false, challenge = 'pass', response, clock = Date.now(), timers = {} } = {}) {
  const requests = [], renders = [], removed = [], scripts = [], mounts = [];
  let currentChallenge = challenge;
  let currentResponse = response;
  let timestamp = clock;
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.parentNode = null; }
    append(node) { this.children.push(node); node.parentNode = this; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  }
  const container = new Node('div');
  const document = { createElement: tag => { const node = new Node(tag); if (tag === 'div') mounts.push(node); return node; }, head: new Node('head') };
  const callbacks = new Map();
  const api = {
    render(node, options) { const id = `widget-${renders.length}`; renders.push(options); callbacks.set(id, options); return id; },
    execute(id) {
      const options = callbacks.get(id);
      if (currentChallenge === 'wait') return;
      queueMicrotask(() => {
        if (currentChallenge === 'error') options['error-callback']('provider-error-code');
        else if (currentChallenge === 'expired') options['expired-callback']();
        else if (currentChallenge === 'timeout') options['timeout-callback']();
        else options.callback(`fresh-token-${renders.length}`);
      });
    },
    remove(id) { removed.push(id); callbacks.delete(id); }
  };
  const window = { crypto: { subtle: webcrypto.subtle, randomUUID }, turnstile: noAPI ? undefined : api };
  Object.defineProperty(window, 'sessionStorage', { get() {
    if (noStorage) throw new Error('Storage denied');
    return { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  } });
  const originalAppend = document.head.append.bind(document.head);
  document.head.append = script => {
    originalAppend(script); scripts.push(script);
    queueMicrotask(() => { if (scriptFailure) script.onerror(); else { window.turnstile = api; script.onload(); } });
  };
  const fetch = async (url, options) => {
    requests.push({ url, ...options });
    if (currentResponse) return currentResponse(url, options, requests.length);
    return reply(200, { accepted: true, requestId: options.headers['Idempotency-Key'], receipt: 'queued' });
  };
  class ClockDate extends Date { static now() { return timestamp; } }
  vm.runInNewContext(source, { window, document, fetch, URL, URLSearchParams, TextEncoder, Uint8Array, AbortController, Date: ClockDate, setTimeout: (fn, delay) => setTimeout(fn, timers[delay] ?? delay), clearTimeout });
  return {
    requests, renders, removed, scripts, mounts, stored, container, window,
    send: (data = fields(), options = {}) => window.WP_ENQUIRY_DELIVERY.send(data, { endpoint, siteKey: 'site-key-test-only', container, ...options }),
    challenge: value => { currentChallenge = value; }, response: value => { currentResponse = value; },
    now: value => { timestamp = value; },
    saved: () => JSON.parse([...stored.values()][0] || 'null')
  };
}
async function errorCode(promise, code) {
  await assert.rejects(promise, error => {
    assert.equal(error.name, 'EnquiryDeliveryError');
    assert.equal(error.code, code);
    assert.equal(typeof error.userMessage, 'string');
    assert.ok(error.userMessage.length > 10);
    return true;
  });
}

test('send preserves all form fields, validates the receipt, and stores only non-PII retry metadata', async () => {
  const client = fixture();
  const receipt = await client.send();
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.receipt, 'queued');
  assert.equal(client.requests.length, 1);
  const request = client.requests[0];
  const payload = new URLSearchParams(request.body);
  for (const [key, value] of fields()) assert.equal(payload.get(key), value);
  assert.equal(payload.get('cf-turnstile-response'), 'fresh-token-1');
  assert.equal(request.credentials, 'omit');
  assert.equal(request.redirect, 'error');
  assert.match(request.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
  assert.equal(receipt.requestId, request.headers['Idempotency-Key']);
  assert.deepEqual(Object.keys(client.saved()).sort(), ['createdAt', 'fingerprint', 'key', 'state']);
  const persisted = [...client.stored.values()].join('');
  for (const secret of ['adapter-test@', 'Adapter test', 'High Wycombe', '7700900123', 'fresh-token']) assert.ok(!persisted.includes(secret));
  assert.equal(client.saved().fingerprint.length, 64);
  assert.equal(client.removed.length, 1);
  assert.equal(client.container.children.length, 0);
});

test('Turnstile loads on demand from its official URL and uses an explicit fresh managed challenge', async () => {
  const client = fixture({ noAPI: true });
  assert.equal(client.scripts.length, 0);
  await client.send();
  assert.equal(client.scripts[0].src, 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  const config = client.renders[0];
  assert.equal(config.action, 'enquiry'); assert.equal(config.theme, 'dark');
  assert.equal(config.execution, 'execute'); assert.equal(config.appearance, 'interaction-only');
  assert.equal(config.retry, 'never'); assert.equal(config['response-field'], false);
  assert.equal(config['refresh-expired'], 'manual'); assert.equal(config['refresh-timeout'], 'manual');
});

test('accepted unchanged enquiries are not posted again, including after a reload', async () => {
  const client = fixture();
  const first = await client.send();
  const second = await client.send();
  assert.equal(second.requestId, first.requestId); assert.equal(second.cached, true);
  assert.equal(client.requests.length, 1); assert.equal(client.renders.length, 1);
  const reload = fixture({ stored: client.stored });
  assert.equal((await reload.send()).requestId, first.requestId);
  assert.equal(reload.requests.length, 0); assert.equal(reload.renders.length, 0);
});

test('an ambiguous network result retries unchanged answers using the same key and a fresh token', async () => {
  const client = fixture({ response: async () => { throw new TypeError('Network failed'); } });
  await errorCode(client.send(), 'receipt_unknown');
  const firstKey = client.requests[0].headers['Idempotency-Key'];
  assert.equal(client.saved().state, 'unknown');
  client.response(undefined);
  const receipt = await client.send();
  assert.equal(receipt.requestId, firstKey);
  assert.equal(client.requests[1].headers['Idempotency-Key'], firstKey);
  assert.equal(new URLSearchParams(client.requests[1].body).get('cf-turnstile-response'), 'fresh-token-2');
  assert.equal(client.requests.length, 2);
});

test('edited answers after unknown receipt are blocked before verification or another post', async () => {
  const client = fixture({ response: async () => { throw new Error('Connection lost'); } });
  await errorCode(client.send(), 'receipt_unknown');
  const edited = fields(); edited.set('email', 'edited@example.invalid');
  await errorCode(client.send(edited), 'manual_check_required');
  assert.equal(client.requests.length, 1); assert.equal(client.renders.length, 1);
  const reload = fixture({ stored: client.stored });
  await errorCode(reload.send(edited), 'manual_check_required');
  assert.equal(reload.requests.length, 0);
});

test('field order and a previous challenge token do not change the retry fingerprint', async () => {
  const client = fixture({ response: async () => { throw new Error('Unknown receipt'); } });
  await errorCode(client.send(), 'receipt_unknown');
  const reordered = new URLSearchParams([...fields()].reverse()); reordered.set('cf-turnstile-response', 'stale-token');
  client.response(undefined);
  await client.send(reordered);
  assert.equal(client.requests[0].headers['Idempotency-Key'], client.requests[1].headers['Idempotency-Key']);
  assert.equal(new URLSearchParams(client.requests[1].body).getAll('cf-turnstile-response').length, 1);
});

test('pending retry protection survives reloads without retaining answers', async () => {
  const original = fixture({ response: async () => { throw new Error('Lost response'); } });
  await errorCode(original.send(), 'receipt_unknown');
  const retry = fixture({ stored: original.stored });
  const receipt = await retry.send();
  assert.equal(receipt.requestId, original.requests[0].headers['Idempotency-Key']);
  assert.equal(retry.requests.length, 1);
});

test('interactive verification fits narrow phone form cards', async () => {
  const client = fixture();
  client.container.getBoundingClientRect = () => ({ width: 252 });
  await client.send();
  assert.equal(client.renders[0].size, 'compact');
});

test('only a definite upstream rejection permits a fresh key on the next explicit send', async () => {
  const client = fixture({ response: async () => reply(422, { accepted: false, code: 'upstream_rejected', retryWithNewKey: true }) });
  await errorCode(client.send(), 'upstream_rejected');
  assert.equal(client.requests.length, 1, 'no automatic posting retry');
  client.response(undefined);
  await client.send();
  assert.notEqual(client.requests[0].headers['Idempotency-Key'], client.requests[1].headers['Idempotency-Key']);
});

test('pending uses the same key; manual checks and idempotency conflicts prevent further sends', async () => {
  const pending = fixture({ response: async () => reply(409, { accepted: false, code: 'enquiry_pending' }) });
  await errorCode(pending.send(), 'enquiry_pending');
  pending.response(undefined); await pending.send();
  assert.equal(pending.requests[0].headers['Idempotency-Key'], pending.requests[1].headers['Idempotency-Key']);
  for (const code of ['manual_check_required', 'idempotency_conflict']) {
    const client = fixture({ response: async () => reply(409, { accepted: false, code }) });
    await errorCode(client.send(), 'manual_check_required');
    await errorCode(client.send(), 'manual_check_required');
    assert.equal(client.requests.length, 1); assert.equal(client.renders.length, 1);
  }
});

test('known pre-delivery errors allow an explicit retry with the same key and fresh verification', async () => {
  for (const [status, code] of [[403, 'challenge_failed'], [429, 'rate_limited'], [503, 'challenge_unavailable'], [503, 'service_unavailable']]) {
    const client = fixture({ response: async () => reply(status, { accepted: false, code }) });
    await errorCode(client.send(), code);
    assert.equal(client.saved().state, 'ready');
    client.response(undefined); await client.send();
    assert.equal(client.requests[0].headers['Idempotency-Key'], client.requests[1].headers['Idempotency-Key']);
    assert.equal(client.renders.length, 2);
  }
});

test('a later service outage cannot clear an earlier unknown-delivery guard', async () => {
  const client = fixture({ response: async () => { throw new Error('Unknown receipt'); } });
  await errorCode(client.send(), 'receipt_unknown');
  client.response(async () => reply(503, { accepted: false, code: 'service_unavailable' }));
  await errorCode(client.send(), 'service_unavailable');
  const edited = fields(); edited.set('venue', 'Different venue');
  await errorCode(client.send(edited), 'manual_check_required');
  assert.equal(client.requests.length, 2);
});

test('HTML 200, malformed JSON, wrong receipt IDs and other success statuses never count as accepted', async () => {
  for (const response of [
    async () => reply(200, '<html>Thanks!</html>', 'text/html'),
    async () => reply(200, '{not json'),
    async () => reply(200, { accepted: true, requestId: randomUUID() }),
    async () => reply(200, { success: true }),
    async (_, options) => reply(201, { accepted: true, requestId: options.headers['Idempotency-Key'] })
  ]) {
    const client = fixture({ response });
    await errorCode(client.send(), 'receipt_unknown');
    assert.equal(client.saved().state, 'unknown');
  }
});

test('untrusted server error messages never appear in user-facing text', async () => {
  const client = fixture({ response: async () => reply(400, { accepted: false, code: 'invalid_payload', message: '<script>secret-customer-data</script>' }) });
  await assert.rejects(client.send(), error => !error.userMessage.includes('secret') && !error.userMessage.includes('<script>'));
});

test('challenge errors, expiry, timeout, and script failure produce no enquiry request and clean up', async () => {
  for (const challenge of ['error', 'expired', 'timeout']) {
    const client = fixture({ challenge });
    await errorCode(client.send(), 'challenge_failed');
    assert.equal(client.requests.length, 0); assert.equal(client.container.children.length, 0);
    client.challenge('pass'); await client.send();
    assert.equal(client.requests.length, 1);
  }
  const failure = fixture({ noAPI: true, scriptFailure: true });
  await errorCode(failure.send(), 'challenge_unavailable');
  assert.equal(failure.requests.length, 0); assert.equal(failure.renders.length, 0);
  const timeout = fixture({ challenge: 'wait', timers: { 120000: 5 } });
  await errorCode(timeout.send(), 'challenge_failed');
  assert.equal(timeout.requests.length, 0); assert.equal(timeout.container.children.length, 0);
});

test('abort before send or during verification prevents fetch; overlapping calls cannot post twice', async () => {
  const aborted = new AbortController(); aborted.abort();
  const first = fixture(); await errorCode(first.send(fields(), { signal: aborted.signal }), 'cancelled');
  assert.equal(first.renders.length, 0); assert.equal(first.requests.length, 0);
  const second = fixture({ challenge: 'wait' });
  const controller = new AbortController();
  const waiting = second.send(fields(), { signal: controller.signal });
  await errorCode(second.send(), 'busy');
  await new Promise(resolve => setTimeout(resolve, 10));
  controller.abort();
  await errorCode(waiting, 'cancelled');
  assert.equal(second.requests.length, 0); assert.equal(second.container.children.length, 0);
});

test('abort or timeout after fetch begins keeps the unknown-delivery key for retry', async () => {
  for (const trigger of ['abort', 'timeout']) {
    const client = fixture({ timers: trigger === 'timeout' ? { 30000: 5 } : {}, response: async (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) });
    const controller = new AbortController();
    const request = client.send(fields(), { signal: controller.signal });
    if (trigger === 'abort') { await new Promise(resolve => setTimeout(resolve, 10)); controller.abort(); }
    await errorCode(request, 'receipt_unknown');
    const key = client.saved().key;
    client.response(undefined); await client.send();
    assert.equal(client.requests[1].headers['Idempotency-Key'], key);
  }
});

test('storage-denied browsers still protect ambiguous retries in memory', async () => {
  const client = fixture({ noStorage: true, response: async () => { throw new Error('No receipt'); } });
  await errorCode(client.send(), 'receipt_unknown');
  const changed = fields(); changed.set('name', 'Changed');
  await errorCode(client.send(changed), 'manual_check_required');
  client.response(undefined); await client.send();
  assert.equal(client.requests[0].headers['Idempotency-Key'], client.requests[1].headers['Idempotency-Key']);
  await client.send(); assert.equal(client.requests.length, 2);
});

test('expired ambiguous keys stop for a manual check; definite or accepted records expire after 24 hours', async () => {
  const client = fixture({ response: async () => { throw new Error('No receipt'); } });
  await errorCode(client.send(), 'receipt_unknown');
  client.now(client.saved().createdAt + 86400000);
  await errorCode(client.send(), 'manual_check_required');
  assert.equal(client.requests.length, 1);
  const accepted = fixture(); await accepted.send();
  accepted.now(accepted.saved().createdAt + 86400000); await accepted.send();
  assert.notEqual(accepted.requests[0].headers['Idempotency-Key'], accepted.requests[1].headers['Idempotency-Key']);
});

test('missing configuration or file fields never load verification or transmit answers', async () => {
  for (const options of [{ siteKey: '' }, { endpoint: 'http://example.workers.dev/enquiry' }, { endpoint: 'https://example.invalid/enquiry' }, { endpoint: endpoint + '?redirect=somewhere' }, { container: null }]) {
    const client = fixture(); await errorCode(client.send(fields(), options), 'configuration');
    assert.equal(client.renders.length, 0); assert.equal(client.requests.length, 0);
  }
  const client = fixture(); const data = new FormData(); data.append('attachment', new Blob(['private file']), 'file.txt');
  await errorCode(client.send(data), 'invalid_payload'); assert.equal(client.requests.length, 0);
});

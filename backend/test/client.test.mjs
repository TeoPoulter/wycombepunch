import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const code = readFileSync(new URL('../../docs/assets/daily-score.js', import.meta.url), 'utf8');
const settled = () => new Promise(resolve => setImmediate(resolve));
function record(highScore, mode = 'precision') {
  return { version: '2', mode, highScore, day: '2026-09-15', timeZone: 'Europe/London', resetAt: new Date(Date.now() + 3600000).toISOString() };
}
function setup(fetch, endpoint = 'https://score.example/daily-score') {
  const value = { textContent: '' };
  const status = { textContent: '' };
  const panel = { hidden: true, dataset: {}, querySelector: name => name.includes('-value') ? value : status };
  const document = new EventTarget();
  document.hidden = false;
  document.querySelector = () => panel;
  const window = new EventTarget();
  window.WP_CONFIG = { dailyScore: { endpoint } };
  window.WP = { reducedMotion: false };
  const timers = new Map();
  let timerId = 0;
  const context = { document, window, location: { hostname: 'wycombepunch.com' }, URL, AbortController, fetch,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(code, context);
  return { document, window, panel, value, status, timers };
}

test('unconfigured feature stays hidden and never sends a request', () => {
  let requests = 0;
  const { panel } = setup(() => { requests++; }, '');
  assert.equal(panel.hidden, true);
  assert.equal(requests, 0);
});

test('no scores and a genuine zero are distinguished', async () => {
  const empty = setup(async () => Response.json(record(null)));
  const zero = setup(async () => Response.json(record(0)));
  await settled();
  assert.equal(empty.value.textContent, '—');
  assert.match(empty.status.textContent, /Be the first/);
  assert.equal(zero.value.textContent, '000');
  assert.match(zero.status.textContent, /Across all players/);
});

test('failed or malformed API response cannot masquerade as a high score', async () => {
  for (const reply of [() => Promise.reject(new Error('offline')), async () => new Response('unavailable', { status: 503 }),
    async () => Response.json({ ...record(999), version: '1' })]) {
    const state = setup(reply);
    await settled();
    assert.equal(state.value.textContent, '—');
    assert.equal(state.panel.dataset.state, 'unavailable');
    assert.match(state.status.textContent, /unavailable/);
  }
});

test('only complete valid runs submit anonymous scoring fields', async () => {
  const calls = [];
  const state = setup(async (url, options) => { calls.push({ url, options }); return Response.json(record(777)); });
  await settled();
  state.document.dispatchEvent(new CustomEvent('wp:game-complete', { detail: { score: 999, hitScores: [1], version: '2', mode: 'precision' } }));
  assert.equal(calls.length, 1);
  state.document.dispatchEvent(new CustomEvent('wp:game-complete', { detail: { score: 777, hitScores: [333, 222, 222], version: '2', mode: 'precision', runId: 'local-only', bestCombo: 3 } }));
  await settled();
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1].options.body), { version: '2', mode: 'precision', score: 777, hitScores: [333, 222, 222] });
  assert.equal(calls[1].options.credentials, 'omit');
  assert.equal(state.value.textContent, '777');
});

test('late response from another mode never overwrites the selected mode', async () => {
  const pending = [];
  const state = setup(() => new Promise(resolve => pending.push(resolve)));
  state.window.WP.reducedMotion = true;
  state.document.dispatchEvent(new Event('wp:motion'));
  pending[1](Response.json(record(300, 'motion-free')));
  await settled();
  pending[0](Response.json(record(999, 'precision')));
  await settled();
  assert.equal(state.value.textContent, '300');
  assert.match(state.status.textContent, /Motion-free mode/);
});

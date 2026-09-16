import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const code = readFileSync(new URL('../../docs/assets/daily-score.js', import.meta.url), 'utf8');
const settled = () => new Promise(resolve => setImmediate(resolve));
function record(highScore, mode = 'precision') {
  return { version: '3', mode, highScore, day: '2026-09-15', timeZone: 'Europe/London', resetAt: new Date(Date.now() + 3600000).toISOString() };
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
  for (const detail of [
    { score: 999, hitScores: [333, 333, 333], version: '2', mode: 'precision' },
    { score: -1, version: '3', mode: 'precision' },
    { score: 1000, version: '3', mode: 'precision' },
    { score: 998.5, version: '3', mode: 'precision' },
    { score: '999', version: '3', mode: 'precision' },
    { score: 999, version: '3', mode: 'unknown' }
  ]) state.document.dispatchEvent(new CustomEvent('wp:game-complete', { detail }));
  assert.equal(calls.length, 1);
  state.document.dispatchEvent(new CustomEvent('wp:game-complete', { detail: { score: 777, version: '3', mode: 'precision', runId: 'local-only' } }));
  await settled();
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1].options.body), { version: '3', mode: 'precision', score: 777 });
  assert.equal(calls[1].url.searchParams.get('version'), '3');
  assert.equal(calls[1].options.credentials, 'omit');
  assert.equal(state.value.textContent, '777');
});

test('submitted zero and 999 work without per-hit fields', async () => {
  for (const score of [0, 999]) {
    const state = setup(async () => Response.json(record(score)));
    await settled();
    state.document.dispatchEvent(new CustomEvent('wp:game-complete', {
      detail: { runId: `run-${score}`, score, version: '3', mode: 'precision' }
    }));
    await settled();
    assert.equal(state.value.textContent, String(score).padStart(3, '0'));
    assert.equal(state.panel.dataset.state, 'ready');
    assert.match(state.status.textContent, /Your score is in/);
  }
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

test('concurrent same-mode score replies retain the confirmed maximum in either response order', async () => {
  for (const order of [[2, 1], [1, 2]]) {
    const pending = [];
    const state = setup(() => new Promise(resolve => pending.push(resolve)));
    pending[0](Response.json(record(null)));
    await settled();
    for (const score of [999, 800]) state.document.dispatchEvent(new CustomEvent('wp:game-complete', {
      detail: { version: '3', mode: 'precision', score }
    }));
    for (const index of order) {
      pending[index](Response.json(record(index === 1 ? 999 : 800)));
      await settled();
    }
    assert.equal(state.value.textContent, '999');
    assert.equal(state.panel.dataset.state, 'ready');
    assert.equal(state.timers.size, 1, 'only one midnight refresh should remain');
  }
});

test('a fresh UK day starts empty and a late prior-day record cannot restore its high score', async () => {
  const pending = [];
  const state = setup(() => new Promise(resolve => pending.push(resolve)));
  pending[0](Response.json(record(999)));
  await settled();
  state.document.dispatchEvent(new CustomEvent('wp:game-complete', {
    detail: { version: '3', mode: 'precision', score: 800 }
  }));
  const resumed = new Event('pageshow'); resumed.persisted = true;
  state.window.dispatchEvent(resumed);
  pending[2](Response.json({ ...record(null), day: '2026-09-16' }));
  await settled();
  assert.equal(state.value.textContent, '—');
  assert.match(state.status.textContent, /Be the first/);
  pending[1](Response.json(record(999)));
  await settled();
  assert.equal(state.value.textContent, '—');
  assert.match(state.status.textContent, /Be the first/);
});

test('mode changes keep independent confirmed maxima when returning to a prior mode', async () => {
  const pending = [];
  const state = setup(() => new Promise(resolve => pending.push(resolve)));
  pending[0](Response.json(record(999)));
  await settled();
  state.window.WP.reducedMotion = true;
  state.document.dispatchEvent(new Event('wp:motion'));
  pending[1](Response.json(record(300, 'motion-free')));
  await settled();
  assert.equal(state.value.textContent, '300');
  state.window.WP.reducedMotion = false;
  state.document.dispatchEvent(new Event('wp:motion'));
  pending[2](Response.json(record(800)));
  await settled();
  assert.equal(state.value.textContent, '999');
  assert.match(state.status.textContent, /Precision mode/);
});

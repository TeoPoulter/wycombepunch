import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { dayInLondon, nextLondonMidnight, handleRequest, validateGame } from '../worker.mjs';

const origin = 'https://wycombepunch.com';
const instant = '2026-09-15T14:00:00.000Z';
const clock = () => new Date(instant);

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const env = {
    ALLOWED_ORIGINS: origin,
    SCORE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: { prepare: sql => ({ bind: (...args) => ({
      // Yield to interleave requests, then execute the real SQLite statement.
      first: async () => { await Promise.resolve(); return db.prepare(sql).get(...args) || null; }
    }) }) }
  };
  return { db, env };
}

function request(method = 'GET', body, extra = {}) {
  return new Request('https://score.example/daily-score?version=2&mode=precision', {
    method,
    headers: { Origin: origin, 'CF-Connecting-IP': '192.0.2.1',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
  });
}
const run = (hits, mode = 'precision') => ({ version: '2', mode, hitScores: hits, score: hits.reduce((a, b) => a + b, 0) });

test('UK dates reset at local midnight on ordinary days and clock-change days', () => {
  const examples = [
    ['2026-01-05T23:59:59Z', '2026-01-05', '2026-01-06T00:00:00.000Z'],
    ['2026-07-05T22:59:59Z', '2026-07-05', '2026-07-05T23:00:00.000Z'],
    ['2026-07-05T23:00:00Z', '2026-07-06', '2026-07-06T23:00:00.000Z'],
    ['2026-03-29T00:00:00Z', '2026-03-29', '2026-03-29T23:00:00.000Z'],
    ['2026-10-24T23:00:00Z', '2026-10-25', '2026-10-26T00:00:00.000Z'],
    ['2026-12-31T23:59:59Z', '2026-12-31', '2027-01-01T00:00:00.000Z']
  ];
  for (const [now, day, reset] of examples) {
    assert.equal(dayInLondon(new Date(now)), day);
    assert.equal(nextLondonMidnight(new Date(now)), reset);
  }
});

test('empty day is null; a played zero is a real zero', async () => {
  const { db, env } = setup();
  try {
    const initial = await handleRequest(request(), env, clock);
    assert.equal((await initial.json()).highScore, null);
    const submitted = await handleRequest(request('POST', run([0, 0, 0])), env, clock);
    assert.equal(submitted.status, 200);
    assert.equal((await submitted.json()).highScore, 0);
  } finally { db.close(); }
});

test('simultaneous submissions preserve maximum using real SQLite upsert', async () => {
  const { db, env } = setup();
  try {
    const submissions = [[200, 300, 250], [333, 333, 332], [1, 2, 3], [330, 330, 330], [0, 0, 0]];
    const responses = await Promise.all(submissions.map(hits => handleRequest(request('POST', run(hits)), env, clock)));
    assert.ok(responses.every(response => response.status === 200));
    const stored = await handleRequest(request(), env, clock);
    assert.equal((await stored.json()).highScore, 998);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_scores').get().n, 1);
  } finally { db.close(); }
});

test('new UK day and different motion mode have separate records', async () => {
  const { db, env } = setup();
  try {
    await handleRequest(request('POST', run([333, 333, 333])), env, () => new Date('2026-07-05T22:59:59Z'));
    const midnight = await handleRequest(request(), env, () => new Date('2026-07-05T23:00:00Z'));
    assert.equal((await midnight.json()).highScore, null);
    const differentMode = await handleRequest(request('POST', run([100, 200, 300], 'motion-free')), env, () => new Date('2026-07-05T22:59:59Z'));
    assert.equal((await differentMode.json()).highScore, 600);
    const precision = await handleRequest(request(), env, () => new Date('2026-07-05T22:59:59Z'));
    assert.equal((await precision.json()).highScore, 999);
  } finally { db.close(); }
});

test('scores, modes and game versions are checked before storage', async () => {
  const invalid = [null, [], {}, run([333, 333]), { ...run([1, 2, 3]), score: 999 },
    run([-1, 0, 0]), run([334, 1, 1]), run([1.1, 2, 3]), run([1, 2, 3], 'other'),
    { ...run([1, 2, 3]), version: '1' }, { ...run([1, 2, 3]), score: '6' }];
  const { db, env } = setup();
  try {
    for (const payload of invalid) {
      assert.throws(() => validateGame(payload));
      assert.equal((await handleRequest(request('POST', payload), env, clock)).status, 400);
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_scores').get().n, 0);
  } finally { db.close(); }
});

test('origin, method, body size, JSON, rate and service failures are explicit', async () => {
  const { db, env } = setup();
  try {
    const denied = await handleRequest(request('GET', undefined, { Origin: 'https://unrelated.example' }), env, clock);
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal((await handleRequest(request('OPTIONS'), env, clock)).status, 204);
    assert.equal((await handleRequest(request('PUT', run([1, 2, 3])), env, clock)).status, 405);
    assert.equal((await handleRequest(request('POST', 'x'.repeat(1025)), env, clock)).status, 413);
    assert.equal((await handleRequest(request('POST', '{'), env, clock)).status, 400);
    assert.equal((await handleRequest(request('POST', '{}', { 'Content-Type': 'text/plain' }), env, clock)).status, 415);
    const limited = { ...env, SCORE_RATE_LIMITER: { limit: async () => ({ success: false }) } };
    assert.equal((await handleRequest(request(), limited, clock)).status, 429);
    const failed = { ...env, DB: { prepare() { throw new Error('private database error'); } } };
    const failure = await handleRequest(request(), failed, clock);
    assert.equal(failure.status, 503);
    assert.equal((await failure.json()).error, 'Daily high score is temporarily unavailable.');
    assert.equal((await handleRequest(request(), { ...env, SCORE_RATE_LIMITER: null }, clock)).status, 503);
  } finally { db.close(); }
});

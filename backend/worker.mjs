/** Anonymous, casual daily record. Scores are client-reported, not cheat-proof. */
export const GAME_VERSION = '2';
export const MAX_BODY_BYTES = 1024;
const MODES = new Set(['precision', 'motion-free']);
const londonDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
});
const londonHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23'
});

export function dayInLondon(now) {
  const parts = Object.fromEntries(londonDate.formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function nextLondonMidnight(now) {
  const [year, month, day] = dayInLondon(now).split('-').map(Number);
  const nextUtcMidnight = Date.UTC(year, month - 1, day + 1);
  // At 00:00 UTC London is 00:00 GMT or 01:00 BST. UK clock changes are at
  // 01:00 UTC, so this offset is also the offset at that local midnight.
  const offsetHours = Number(londonHour.format(nextUtcMidnight));
  return new Date(nextUtcMidnight - offsetHours * 3600000).toISOString();
}

export const UPSERT_SCORE = `
  INSERT INTO daily_scores (day, version, mode, score, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (day, version, mode) DO UPDATE SET
    score = MAX(daily_scores.score, excluded.score),
    updated_at = CASE WHEN excluded.score > daily_scores.score
      THEN excluded.updated_at ELSE daily_scores.updated_at END
  RETURNING score
`;
const READ_SCORE = 'SELECT score FROM daily_scores WHERE day = ? AND version = ? AND mode = ?';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validateGame(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Invalid score.');
  }
  if (value.version !== GAME_VERSION || !MODES.has(value.mode)) {
    throw new HttpError(400, 'Unsupported game version or mode.');
  }
  const hits = value.hitScores;
  if (!Array.isArray(hits) || hits.length !== 3 ||
      !hits.every(score => Number.isInteger(score) && score >= 0 && score <= 333) ||
      !Number.isInteger(value.score) || value.score !== hits.reduce((a, b) => a + b, 0)) {
    throw new HttpError(400, 'Invalid score.');
  }
  return { version: GAME_VERSION, mode: value.mode, score: value.score };
}

async function readScoreBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Use application/json.');
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Score request too large.');
  }
  if (!request.body) throw new HttpError(400, 'Missing score.');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, 'Score request too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
  catch (_) { throw new HttpError(400, 'Invalid JSON.'); }
}

function json(body, status, origin, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      ...extra
    }
  });
}

export async function handleRequest(request, env, clock = () => new Date()) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return json({ error: 'Origin not allowed.' }, 403, null);
  const url = new URL(request.url);
  if (url.pathname !== '/daily-score') return json({ error: 'Not found.' }, 404, origin);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin'
    }});
  }
  if (!['GET', 'POST'].includes(request.method)) {
    return json({ error: 'Method not allowed.' }, 405, origin, { Allow: 'GET, POST, OPTIONS' });
  }
  try {
    if (!env.DB || !env.SCORE_RATE_LIMITER) throw new Error('Service not configured');
    // A generous per-network burst limit allows shared event Wi-Fi. Cloudflare
    // supplies this header. It is not written to D1 or application logs.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { success } = await env.SCORE_RATE_LIMITER.limit({ key: ip });
    if (!success) return json({ error: 'Please try again shortly.' }, 429, origin, { 'Retry-After': '60' });

    let game;
    if (request.method === 'POST') game = validateGame(await readScoreBody(request));
    else {
      game = { version: url.searchParams.get('version'), mode: url.searchParams.get('mode') };
      if (game.version !== GAME_VERSION || !MODES.has(game.mode)) {
        throw new HttpError(400, 'Unsupported game version or mode.');
      }
    }
    // The server assigns the day after receiving the complete request body.
    const now = clock();
    const day = dayInLondon(now);
    const statement = request.method === 'POST'
      ? env.DB.prepare(UPSERT_SCORE).bind(day, game.version, game.mode, game.score, now.toISOString())
      : env.DB.prepare(READ_SCORE).bind(day, game.version, game.mode);
    const row = await statement.first();
    if (row && (!Number.isInteger(row.score) || row.score < 0 || row.score > 999)) {
      throw new Error('Invalid stored score');
    }
    return json({
      day, timeZone: 'Europe/London', resetAt: nextLondonMidnight(now),
      version: game.version, mode: game.mode, highScore: row?.score ?? null
    }, 200, origin);
  } catch (error) {
    return json({ error: error instanceof HttpError ? error.message : 'Daily high score is temporarily unavailable.' },
      error instanceof HttpError ? error.status : 503, origin);
  }
}

export default { fetch: (request, env) => handleRequest(request, env) };

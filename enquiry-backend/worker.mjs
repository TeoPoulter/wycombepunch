import { receiptTemplate } from './receipt-template.mjs';

const ORIGINS = new Set(['https://wycombepunch.com', 'https://www.wycombepunch.com']);
const FORMSPREE = 'https://formspree.io/f/xppwapkw';
const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND = 'https://api.resend.com/emails';
const DAY = 86400000, MAX_BODY = 16384, MAX_ATTEMPTS = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s<>@,;:\r\n]+@[^\s<>@,;:\r\n]+\.[^\s<>@,;:\r\n]+$/;
const TYPES = new Set(['Weddings & walimas','Family gathering','Community event','Eid celebration','Football event','School or team event','Something else']);
const DURATIONS = new Set(['3–5 hours','Full day','Something else']);
const LIMITS = {'form-name':60, '_gotcha':100, 'event-type':60, 'event-date':10, venue:300, duration:30, 'duration-detail':200, message:1500, name:120, phone:40, email:254, 'cf-turnstile-response':2048};
const depsDefault = { fetch: (...args) => fetch(...args), now: () => Date.now() };
const sql = (env, query, ...values) => env.DB.prepare(query).bind(...values);
const read = (env, key) => sql(env, 'SELECT * FROM enquiries WHERE request_id = ?', key).first();

function reply(origin, status, data, extras = {}) {
  return new Response(JSON.stringify(data), {status, headers: {
    'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Vary':'Origin', 'Access-Control-Expose-Headers':'Retry-After',
    ...(ORIGINS.has(origin) ? {'Access-Control-Allow-Origin':origin} : {}), ...extras
  }});
}
function fail(code, status = 400) { const error = new Error(code); error.status = status; throw error; }
async function limitedText(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) fail('payload_too_large', 413);
  if (!request.body) fail('invalid_payload');
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); fail('payload_too_large', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
export function validatePayload(params, now) {
  const values = {};
  for (const [key,value] of params) {
    if (!Object.hasOwn(LIMITS, key) || Object.hasOwn(values, key)) fail('invalid_payload');
    if (value.length > LIMITS[key] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail('invalid_payload');
    if (key !== 'message' && /[\r\n]/.test(value)) fail('invalid_payload');
    values[key] = value.trim();
  }
  if (values['form-name'] !== 'wycombe-punch-enquiry' || values._gotcha) fail('invalid_payload');
  if (!TYPES.has(values['event-type']) || !DURATIONS.has(values.duration)) fail('invalid_payload');
  for (const field of ['name','venue','phone','email']) if (!values[field]) fail('invalid_payload');
  if (!EMAIL.test(values.email) || !/^\+[1-9]\d{0,2} [0-9]{4,14}$/.test(values.phone) || values.phone.replace(/\D/g,'').length > 15 || values.phone.replace(/\D/g,'').length < 7) fail('invalid_payload');
  if (values.duration === 'Something else' && !values['duration-detail']) fail('invalid_payload');
  const date = values['event-date'] || '';
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) fail('invalid_payload');
  }
  const token = values['cf-turnstile-response'] || '';
  // Canonical, ordered fields: refreshed challenge tokens never change a request's identity.
  const payload = {'form-name':'wycombe-punch-enquiry', 'event-type':values['event-type'], 'event-date':date, venue:values.venue, duration:values.duration};
  if (values.duration === 'Something else') payload['duration-detail'] = values['duration-detail'];
  Object.assign(payload, {message:values.message || '', name:values.name, phone:values.phone, email:values.email});
  return {payload, token};
}
async function digest(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...bytes].map(n => n.toString(16).padStart(2,'0')).join('');
}
async function upstream(fetcher, url, options, timeout = 10000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(url, {...options, redirect:'manual', signal:controller.signal});
    const body = await response.json().catch(() => null);
    return {response,body};
  }
  finally { clearTimeout(timer); }
}
function receiptBody(env, email) {
  return JSON.stringify({from:env.FROM_EMAIL, to:[email], ...(env.REPLY_TO_EMAIL ? {reply_to:env.REPLY_TO_EMAIL} : {}), ...receiptTemplate});
}
function configured(env) {
  return env.DB && env.ENQUIRY_RATE_LIMITER?.limit && env.TURNSTILE_SECRET_KEY && env.RESEND_API_KEY &&
    /^Wycombe Punch <[^\s<>@,;:\r\n]+@(?:[a-z0-9-]+\.)?wycombepunch\.com>$/i.test(env.FROM_EMAIL || '') && (!env.REPLY_TO_EMAIL || (EMAIL.test(env.REPLY_TO_EMAIL) && /@(?:[a-z0-9-]+\.)?wycombepunch\.com$/i.test(env.REPLY_TO_EMAIL)));
}
function existingResponse(origin, row, hash) {
  if (row.payload_hash !== hash) return reply(origin,409,{accepted:false,code:'idempotency_conflict',requestId:row.request_id});
  if (row.state === 'accepted') return reply(origin,200,{accepted:true,requestId:row.request_id,receipt:row.receipt_state === 'sent' ? 'sent' : row.receipt_state === 'dead' ? 'unavailable' : 'queued'});
  if (row.state === 'rejected') return reply(origin,422,{accepted:false,code:'upstream_rejected',requestId:row.request_id,retryWithNewKey:true});
  return reply(origin,409,{accepted:false,code:row.state === 'pending' ? 'enquiry_pending' : 'manual_check_required',requestId:row.request_id}, row.state === 'pending' ? {'Retry-After':'3'} : {});
}
export async function handleRequest(request, env, ctx, dependencies = {}) {
  const deps = {...depsDefault,...dependencies}; const origin = request.headers.get('Origin') || '';
  if (!ORIGINS.has(origin)) return reply(origin,403,{accepted:false,code:'origin_not_allowed'});
  if (new URL(request.url).pathname !== '/enquiry') return reply(origin,404,{accepted:false,code:'not_found'});
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Idempotency-Key','Access-Control-Max-Age':'600'}});
  if (request.method !== 'POST') return reply(origin,405,{accepted:false,code:'method_not_allowed'},{Allow:'POST, OPTIONS'});
  if (!configured(env)) return reply(origin,503,{accepted:false,code:'service_unavailable'});
  let key = '', claimed = false;
  try {
    const allowed = await env.ENQUIRY_RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP') || 'unknown'});
    if (!allowed.success) return reply(origin,429,{accepted:false,code:'rate_limited'},{'Retry-After':'60'});
    key = request.headers.get('Idempotency-Key') || '';
    if (!UUID.test(key)) fail('invalid_idempotency_key');
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') fail('unsupported_media_type',415);
    const {payload,token} = validatePayload(new URLSearchParams(await limitedText(request)), deps.now());
    const hash = await digest(JSON.stringify(payload));
    let row = await read(env,key);
    if (row) {
      if (row.state === 'pending' && row.updated_at < deps.now()-120000) {
        await sql(env,"UPDATE enquiries SET state='uncertain', updated_at=?, last_error='upstream_unconfirmed' WHERE request_id=? AND state='pending'",deps.now(),key).run();
        row = await read(env,key);
      }
      return existingResponse(origin,row,hash);
    }
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(deps.now()));
    if (payload['event-date'] && payload['event-date'] < today) fail('invalid_payload');
    if (!token) fail('challenge_failed',403);
    let verified;
    try {
      const result = await upstream(deps.fetch,TURNSTILE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP') || undefined})},8000);
      verified = result.response.ok && result.body;
    } catch (_) { return reply(origin,503,{accepted:false,code:'challenge_unavailable'}); }
    if (verified?.success !== true || verified.hostname !== new URL(origin).hostname || verified.action !== 'enquiry') fail('challenge_failed',403);
    const now = deps.now();
    const insert = await sql(env,"INSERT INTO enquiries (request_id,payload_hash,state,created_at,updated_at,receipt_body) VALUES (?,?,'pending',?,?,?) ON CONFLICT(request_id) DO NOTHING",key,hash,now,now,receiptBody(env,payload.email)).run();
    if (!insert.meta.changes) return existingResponse(origin,await read(env,key),hash);
    claimed = true;
    let response, body;
    try {
      ({response,body} = await upstream(deps.fetch,FORMSPREE,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({...payload,_wp_request_id:key}).toString()},15000));
    } catch (_) { /* Pending claim is never automatically forwarded a second time. */ }
    if (response?.ok && body?.ok === true) {
      const accepted = await sql(env,"UPDATE enquiries SET state='accepted',receipt_state='queued',expires_at=?,next_attempt_at=?,updated_at=?,upstream_status=? WHERE request_id=? AND state='pending'",deps.now()+23*3600000,deps.now(),deps.now(),response.status,key).run();
      if (accepted.meta.changes !== 1) return reply(origin,409,{accepted:false,code:'manual_check_required',requestId:key});
      // Receipt errors cannot change the accepted lead into a failed submission.
      try { ctx.waitUntil(sendReceipt(env,key,deps).catch(() => {})); } catch (_) { /* Cron will pick up the durable outbox. */ }
      return reply(origin,200,{accepted:true,requestId:key,receipt:'queued'});
    }
    const rejected = response && ((response.status >= 400 && response.status < 500 && response.status !== 408) || (response.ok && body?.ok === false));
    await sql(env,"UPDATE enquiries SET state=?,receipt_state='dead',receipt_body=CASE WHEN ? THEN NULL ELSE receipt_body END,upstream_status=?,updated_at=?,last_error=? WHERE request_id=? AND state='pending'",rejected?'rejected':'uncertain',rejected?1:0,response?.status || null,deps.now(),rejected?'upstream_rejected':'upstream_unconfirmed',key).run();
    return existingResponse(origin,await read(env,key),hash);
  } catch (error) {
    if (claimed) return reply(origin,409,{accepted:false,code:'manual_check_required',requestId:key});
    return reply(origin,error.status || 503,{accepted:false,code:error.status ? error.message : 'service_unavailable'});
  }
}

export async function sendReceipt(env, key, dependencies = {}) {
  const deps = {...depsDefault,...dependencies}; const now = deps.now();
  await sql(env,"UPDATE enquiries SET receipt_state='dead', last_error='retry_window_expired', updated_at=? WHERE request_id=? AND state='accepted' AND (receipt_state='queued' OR (receipt_state='sending' AND lease_until<=?)) AND (expires_at <= ? OR attempts >= ?)",now,key,now,now,MAX_ATTEMPTS).run();
  const row = await sql(env,"UPDATE enquiries SET receipt_state='sending',lease_until=?,attempts=attempts+1,updated_at=? WHERE request_id=? AND state='accepted' AND receipt_body IS NOT NULL AND expires_at>? AND attempts<? AND ((receipt_state='queued' AND next_attempt_at<=?) OR (receipt_state='sending' AND lease_until<=?)) RETURNING *",now+60000,now,key,now,MAX_ATTEMPTS,now,now).first();
  if (!row) return;
  let response, result;
  try {
    ({response,body:result} = await upstream(deps.fetch,RESEND,{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`wp-enquiry/${key}`},body:row.receipt_body}));
  } catch (_) { /* Same key and exact stored body make retries safe within the bounded window. */ }
  if (response?.ok && typeof result?.id === 'string') {
    await sql(env,"UPDATE enquiries SET receipt_state='sent',message_id=?,sent_at=?,updated_at=?,lease_until=0,last_error=NULL WHERE request_id=? AND receipt_state='sending' AND attempts=?",result.id,deps.now(),deps.now(),key,row.attempts).run();
    return;
  }
  const permanent = [400,401,403,404,422].includes(response?.status) || result?.name === 'invalid_idempotent_request';
  const pause = [60000,300000,900000,3600000,7200000,14400000,14400000,14400000][row.attempts-1];
  const next = deps.now()+pause;
  const dead = permanent || row.attempts >= MAX_ATTEMPTS || next >= row.expires_at;
  await sql(env,"UPDATE enquiries SET receipt_state=?,next_attempt_at=?,lease_until=0,updated_at=?,last_error=? WHERE request_id=? AND receipt_state='sending' AND attempts=?",dead?'dead':'queued',next,deps.now(),permanent?'receipt_rejected':dead?'retry_window_expired':'receipt_retry',key,row.attempts).run();
}
export async function runScheduled(env, dependencies = {}) {
  if (!configured(env)) throw new Error('service_unavailable');
  const deps = {...depsDefault,...dependencies}; const now = deps.now();
  // A crash while forwarding must never result in an automatic second enquiry.
  await sql(env,"UPDATE enquiries SET state='uncertain',receipt_state='dead',last_error='upstream_unconfirmed',updated_at=? WHERE state='pending' AND updated_at<?",now,now-120000).run();
  await sql(env,"UPDATE enquiries SET receipt_state='dead',last_error='retry_window_expired',updated_at=? WHERE state='accepted' AND (receipt_state='queued' OR (receipt_state='sending' AND lease_until<=?)) AND (expires_at<=? OR attempts>=?)",now,now,now,MAX_ATTEMPTS).run();
  const due = await sql(env,"SELECT request_id FROM enquiries WHERE state='accepted' AND ((receipt_state='queued' AND next_attempt_at<=?) OR (receipt_state='sending' AND lease_until<=?)) ORDER BY next_attempt_at LIMIT 10",now,now).all();
  for (const row of due.results) await sendReceipt(env,row.request_id,deps);
  // Remove recipient addresses and receipt copies 24h after provider acceptance.
  await sql(env,"UPDATE enquiries SET receipt_body=NULL WHERE receipt_state='sent' AND sent_at<? AND receipt_body IS NOT NULL",now-DAY).run();
  // Failed/uncertain records retain minimal recovery data for at most 30 days.
  await sql(env,'DELETE FROM enquiries WHERE created_at<?',now-30*DAY).run();
}
export default {
  fetch: (request,env,ctx) => handleRequest(request,env,ctx),
  scheduled: (_event,env,ctx) => ctx.waitUntil(runScheduled(env))
};

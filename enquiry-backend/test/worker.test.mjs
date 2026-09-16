import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleRequest, runScheduled, sendReceipt } from '../worker.mjs';
import { receiptTemplate } from '../receipt-template.mjs';

const ORIGIN = 'https://wycombepunch.com';
const KEY = '86909bc9-2f85-4e97-aec1-41c336056d90';
const OTHER_KEY = '333d2265-cad0-4112-b180-fe99fbd87a56';
const SAMPLE = {'form-name':'wycombe-punch-enquiry',_gotcha:'','event-type':'Eid celebration','event-date':'2026-09-25',venue:'High Wycombe',duration:'3–5 hours',message:'Website test only',name:'Test Guest',phone:'+44 7700900123',email:'guest@example.com','cf-turnstile-response':'fake-valid-token'};
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function setup(overrides={}) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
  const env = {
    FROM_EMAIL:'Wycombe Punch <no-reply@wycombepunch.com>',RESEND_API_KEY:'test-only-server-key',TURNSTILE_SECRET_KEY:'test-only-challenge-key',
    ENQUIRY_RATE_LIMITER:{limit:async()=>({success:true})},
    DB:{prepare:query=>({bind:(...values)=>({
      async first() { await Promise.resolve(); return db.prepare(query).get(...values) || null; },
      async all() { await Promise.resolve(); return {results:db.prepare(query).all(...values)}; },
      async run() { await Promise.resolve(); const result=db.prepare(query).run(...values); return {meta:{changes:Number(result.changes)}}; }
    })})}
  };
  let now=Date.parse('2026-09-16T12:00:00Z');
  const calls={challenge:[],form:[],email:[]}, jobs=[];
  const ctx={waitUntil:promise=>jobs.push(promise)};
  const deps={now:()=>now,fetch:async(url,options)=>{
    const kind=url.includes('/siteverify')?'challenge':url==='https://formspree.io/f/xppwapkw'?'form':url==='https://api.resend.com/emails'?'email':null;
    assert.ok(kind,'No unexpected outbound service');calls[kind].push(options);
    if(overrides[kind]) return overrides[kind](options,calls[kind].length);
    return json(kind==='challenge'?{success:true,hostname:'wycombepunch.com',action:'enquiry'}:kind==='form'?{ok:true}:{id:'receipt-test-id'});
  }};
  return {db,env,ctx,deps,calls,advance:ms=>{now+=ms;},now:()=>now,
    async settle(){while(jobs.length)await Promise.all(jobs.splice(0));},
    row:key=>db.prepare('SELECT * FROM enquiries WHERE request_id=?').get(key || KEY),
    async post(data={},headers={},key=KEY){
      const response=await handleRequest(new Request('https://enquiries.example/enquiry',{method:'POST',headers:{Origin:ORIGIN,'CF-Connecting-IP':'192.0.2.1','Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':key,...headers},body:new URLSearchParams({...SAMPLE,...data})}),env,ctx,deps);
      return {response,status:response.status,body:await response.json()};
    }
  };
}

test('confirmed Formspree acceptance queues exactly the branded receipt to the submitted address',async()=>{
  const f=setup();const result=await f.post();await f.settle();assert.equal(result.status,200);assert.deepEqual(result.body,{accepted:true,requestId:KEY,receipt:'queued'});
  assert.equal(f.calls.form.length,1);const forwarded=Object.fromEntries(new URLSearchParams(f.calls.form[0].body));
  assert.equal(forwarded._wp_request_id,KEY);assert.equal(forwarded.email,SAMPLE.email);assert.equal(forwarded.phone,SAMPLE.phone);assert.ok(!('cf-turnstile-response' in forwarded));
  const email=JSON.parse(f.calls.email[0].body);assert.deepEqual(email.to,['guest@example.com']);assert.equal(email.from,'Wycombe Punch <no-reply@wycombepunch.com>');assert.ok(!('reply_to' in email));
  assert.equal(email.html,receiptTemplate.html);assert.match(email.html,/https:\/\/www\.instagram\.com\/wycombepunchmachine\//);assert.doesNotMatch(email.html,/(?:sms:|tel:|raw\.githubusercontent\.com)/);assert.match(email.html,/https:\/\/wycombepunch\.com\/assets\/email-logo\.png/);assert.equal(f.row().receipt_state,'sent');assert.equal(f.row().state,'accepted');
  assert.equal(f.calls.email[0].headers['Idempotency-Key'],`wp-enquiry/${KEY}`);f.db.close();
});
test('same key and answers recover acceptance without forwarding, challenging or emailing again',async()=>{
  const f=setup();await f.post();await f.settle();const again=await f.post({'cf-turnstile-response':'fresh-token'});await f.settle();
  assert.equal(again.status,200);assert.equal(again.body.receipt,'sent');assert.equal(f.calls.form.length,1);assert.equal(f.calls.challenge.length,1);assert.equal(f.calls.email.length,1);
  const changed=await f.post({venue:'Marlow'});assert.equal(changed.status,409);assert.equal(changed.body.code,'idempotency_conflict');assert.equal(f.calls.form.length,1);f.db.close();
});
test('concurrent claims use a real SQLite primary key and forward once',async()=>{
  const f=setup();const results=await Promise.all([f.post(),f.post()]);await f.settle();assert.ok(results.some(r=>r.status===200));assert.ok(results.every(r=>[200,409].includes(r.status)));
  assert.equal(f.calls.form.length,1);assert.equal(f.calls.email.length,1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM enquiries').get().n,1);f.db.close();
});
test('receipt failure never changes a saved enquiry into a failed lead; scheduled retry uses exact stored body',async()=>{
  const f=setup({email:(_options,n)=>n===1?json({message:'busy'},429):json({id:'receipt-after-retry'})});
  const first=await f.post();await f.settle();assert.equal(first.status,200);assert.equal(f.row().state,'accepted');assert.equal(f.row().receipt_state,'queued');
  f.env.FROM_EMAIL='Wycombe Punch <other@wycombepunch.com>';f.advance(300000);await runScheduled(f.env,f.deps);
  assert.equal(f.calls.form.length,1);assert.equal(f.calls.email.length,2);assert.equal(f.calls.email[0].body,f.calls.email[1].body);assert.equal(f.calls.email[0].headers['Idempotency-Key'],f.calls.email[1].headers['Idempotency-Key']);assert.equal(f.row().receipt_state,'sent');f.db.close();
});
test('an ambiguous Formspree timeout or 5xx is never automatically retried or given a receipt',async()=>{
  for (const form of [()=>{throw Error('timeout');},()=>json({error:'upstream failure'},503),()=>new Response('unexpected html',{status:200})]) {
    const f=setup({form});const first=await f.post();assert.equal(first.status,409);assert.equal(first.body.code,'manual_check_required');assert.equal(f.row().state,'uncertain');
    await f.post();f.advance(300000);await runScheduled(f.env,f.deps);assert.equal(f.calls.form.length,1);assert.equal(f.calls.email.length,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM delivery_issues').get().n,1);f.db.close();
  }
});
test('definite rejection keeps a tombstone; only an explicit new key can create another forwarding attempt',async()=>{
  const f=setup({form:()=>json({error:'rejected'},422)});const result=await f.post();assert.equal(result.status,422);assert.equal(result.body.retryWithNewKey,true);assert.equal(f.row().receipt_body,null);
  await f.post();assert.equal(f.calls.form.length,1);await f.post({}, {}, OTHER_KEY);assert.equal(f.calls.form.length,2);assert.equal(f.calls.email.length,0);f.db.close();
});
test('preexisting in-flight claim returns pending; abandoned claims become uncertain without forwarding',async()=>{
  const f=setup();await f.post();await f.settle();f.db.prepare("UPDATE enquiries SET state='pending',receipt_state='waiting',updated_at=?").run(f.now());
  const pending=await f.post();assert.equal(pending.status,409);assert.equal(pending.body.code,'enquiry_pending');assert.equal(pending.response.headers.get('Retry-After'),'3');
  f.advance(120001);const abandoned=await f.post();assert.equal(abandoned.body.code,'manual_check_required');assert.equal(f.calls.form.length,1);f.db.close();
});
test('accepted retries remain recoverable after their event date has passed',async()=>{
  const f=setup();await f.post();await f.settle();f.advance(12*86400000);const again=await f.post();assert.equal(again.status,200);assert.equal(f.calls.form.length,1);
  const newPast=await f.post({}, {}, OTHER_KEY);assert.equal(newPast.body.code,'invalid_payload');assert.equal(f.calls.form.length,1);f.db.close();
});
test('Turnstile success must match both page hostname and enquiry action',async()=>{
  for (const challenge of [()=>json({success:false}),()=>json({success:true,hostname:'evil.example',action:'enquiry'}),()=>json({success:true,hostname:'wycombepunch.com',action:'other'})]) {
    const f=setup({challenge});const result=await f.post();assert.equal(result.status,403);assert.equal(result.body.code,'challenge_failed');assert.equal(f.calls.form.length,0);assert.equal(f.row(),undefined);f.db.close();
  }
  const f=setup({challenge:()=>{throw Error('offline');}});assert.equal((await f.post()).body.code,'challenge_unavailable');assert.equal(f.calls.form.length,0);f.db.close();
});
test('rate-limit failure and missing production bindings fail closed before external calls',async()=>{
  const f=setup();f.env.ENQUIRY_RATE_LIMITER.limit=async()=>({success:false});const result=await f.post();assert.equal(result.status,429);assert.equal(result.response.headers.get('Retry-After'),'60');assert.equal(f.calls.challenge.length,0);
  for (const field of ['DB','ENQUIRY_RATE_LIMITER','TURNSTILE_SECRET_KEY','RESEND_API_KEY','FROM_EMAIL']) {const g=setup();delete g.env[field];assert.equal((await g.post()).status,503);assert.equal(g.calls.form.length,0);g.db.close();}f.db.close();
});
test('unknown fields, oversized input, header injection, invalid dates and missing required data are rejected',async()=>{
  const bad=[{html:'<b>override</b>'},{to:'victim@example.com'},{email:'a@example.com\r\nBcc:other@example.com'},{email:'a@example.com,b@example.com'},{message:'x'.repeat(1501)},{name:''},{phone:'+44 123'},{phone:'07700 900123'},{'event-date':'2026-02-31'},{'event-date':'2026-09-01'},{duration:'Something else','duration-detail':''},{'event-type':'Invented'},{_gotcha:'spam'},{'form-name':'other'},{'cf-turnstile-response':''}];
  for(const payload of bad) {const f=setup();const result=await f.post(payload);assert.ok([400,403].includes(result.status),JSON.stringify(payload));assert.equal(f.calls.form.length,0);assert.equal(f.row(),undefined);f.db.close();}
  const f=setup();assert.equal((await f.post({}, {'Content-Length':'20000'})).status,413);assert.equal((await f.post({}, {}, 'not-uuid')).status,400);assert.equal((await f.post({}, {'Content-Type':'text/plain'})).status,415);f.db.close();
});
test('only canonical fields reach Formspree and no visitor text can customise receipt content',async()=>{
  const f=setup();await f.post({name:'<script>fake</script>',message:'<img src=x onerror=evil()>',duration:'Something else','duration-detail':'Two hours'});await f.settle();
  const email=JSON.parse(f.calls.email[0].body);assert.ok(!email.html.includes('onerror=evil'));assert.ok(!email.html.includes('<script>fake'));assert.equal(email.subject,receiptTemplate.subject);assert.equal(new URLSearchParams(f.calls.form[0].body).get('duration-detail'),'Two hours');f.db.close();
});
test('Resend ambiguous success can retry with stable key; concurrent receipt claims send once',async()=>{
  const f=setup({email:(_options,n)=>{if(n===1)throw Error('lost response');return json({id:'already-sent'});}});await f.post();await f.settle();f.advance(300000);
  await Promise.all([sendReceipt(f.env,KEY,f.deps),sendReceipt(f.env,KEY,f.deps)]);assert.equal(f.calls.email.length,2);assert.equal(f.row().receipt_state,'sent');assert.equal(f.calls.email[0].body,f.calls.email[1].body);f.db.close();
});
test('a crashed receipt lease retries safely inside the Resend window, but never after 23 hours',async()=>{
  const f=setup();await f.post();await f.settle();f.db.prepare("UPDATE enquiries SET receipt_state='sending',lease_until=?,sent_at=NULL").run(f.now()+60000);
  await runScheduled(f.env,f.deps);assert.equal(f.calls.email.length,1);f.advance(60001);await runScheduled(f.env,f.deps);assert.equal(f.calls.email.length,2);
  f.db.prepare("UPDATE enquiries SET receipt_state='queued',next_attempt_at=0").run();f.advance(23*3600000);await runScheduled(f.env,f.deps);assert.equal(f.calls.email.length,2);assert.equal(f.row().receipt_state,'dead');assert.equal(f.row().last_error,'retry_window_expired');f.db.close();
});
test('permanent receipt rejection is visible; cron bounds retry attempts and clears retained personal data',async()=>{
  const f=setup({email:()=>json({name:'validation_error'},422)});await f.post();await f.settle();assert.equal(f.row().receipt_state,'dead');assert.equal(f.db.prepare('SELECT last_error FROM delivery_issues').get().last_error,'receipt_rejected');f.db.close();
  const g=setup();await g.post();await g.settle();g.advance(86400001);await runScheduled(g.env,g.deps);assert.equal(g.row().receipt_body,null);assert.equal((await g.post()).status,200);assert.equal(g.calls.email.length,1);
  g.advance(30*86400000);await runScheduled(g.env,g.deps);assert.equal(g.row(),undefined);g.db.close();
  const h=setup({email:()=>json({},503)});await h.post();await h.settle();h.db.prepare('UPDATE enquiries SET attempts=8').run();await runScheduled(h.env,h.deps);assert.equal(h.calls.email.length,1);assert.equal(h.row().receipt_state,'dead');h.db.close();
});
test('CORS allows only exact HTTPS production origins and has no public admin or status route',async()=>{
  const f=setup();for(const origin of ['', 'https://evil.example','http://wycombepunch.com'])assert.equal((await f.post({}, {Origin:origin})).status,403);
  const options=await handleRequest(new Request('https://enquiries.example/enquiry',{method:'OPTIONS',headers:{Origin:ORIGIN}}),f.env,f.ctx,f.deps);assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),ORIGIN);assert.match(options.headers.get('Access-Control-Allow-Headers'),/Idempotency-Key/);
  for(const path of ['/admin','/enquiry/status']) assert.equal((await handleRequest(new Request('https://enquiries.example'+path,{headers:{Origin:ORIGIN}}),f.env,f.ctx,f.deps)).status,404);f.db.close();
});
test('receipt copies match source files and deployment config contains no private credential values',()=>{
  assert.equal(receiptTemplate.html,readFileSync(new URL('../../emails/enquiry-confirmation.html',import.meta.url),'utf8'));
  const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.deepEqual(Object.keys(config.vars),['FROM_EMAIL']);assert.match(config.vars.FROM_EMAIL,/no-reply@wycombepunch\.com/);
  assert.equal(config.observability.enabled,false);assert.equal(config.ratelimits[0].name,'ENQUIRY_RATE_LIMITER');assert.equal(config.triggers.crons[0],'*/5 * * * *');
  const worker=readFileSync(new URL('../worker.mjs',import.meta.url),'utf8');assert.ok(!worker.includes('console.log'));
});


test('a database failure after upstream acceptance returns uncertainty and never forwards again',async()=>{
  const f=setup();const prepare=f.env.DB.prepare;
  f.env.DB.prepare=query=>query.startsWith("UPDATE enquiries SET state='accepted'")?{bind:()=>({run:async()=>{throw Error('database unavailable');}})}:prepare(query);
  const lost=await f.post();assert.equal(lost.body.code,'manual_check_required');assert.equal(f.row().state,'pending');assert.equal(f.calls.email.length,0);
  f.env.DB.prepare=prepare;f.advance(120001);const recovery=await f.post();assert.equal(recovery.body.code,'manual_check_required');assert.equal(f.calls.form.length,1);assert.equal(f.row().state,'uncertain');f.db.close();
});
test('request streaming limit and repeated form keys cannot bypass validation',async()=>{
  const f=setup();
  for(const body of ['message='+ 'x'.repeat(17000),new URLSearchParams(SAMPLE).toString()+'&email=other@example.com']) {
    const response=await handleRequest(new Request('https://enquiries.example/enquiry',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':KEY},body}),f.env,f.ctx,f.deps);
    assert.ok([400,413].includes(response.status));assert.equal(f.calls.form.length,0);
  }
  f.db.close();
});
test('www uses its own verified hostname and a configured reply address stays server-side',async()=>{
  const f=setup({challenge:()=>json({success:true,hostname:'www.wycombepunch.com',action:'enquiry'})});f.env.REPLY_TO_EMAIL='hello@wycombepunch.com';
  const result=await f.post({}, {Origin:'https://www.wycombepunch.com'});await f.settle();assert.equal(result.status,200);assert.equal(result.response.headers.get('Access-Control-Allow-Origin'),'https://www.wycombepunch.com');
  assert.equal(JSON.parse(f.calls.email[0].body).reply_to,'hello@wycombepunch.com');assert.ok(!JSON.stringify(result.body).includes('hello@wycombepunch.com'));f.db.close();
});


test('overlapping cleanup preserves an active eighth receipt attempt until its success is recorded',async()=>{
  let entered, release;const started=new Promise(resolve=>{entered=resolve;});
  const f=setup({email:(_options,n)=>n===1?json({id:'initial'}):new Promise(resolve=>{release=resolve;entered();})});
  await f.post();await f.settle();f.db.prepare("UPDATE enquiries SET attempts=7,receipt_state='queued',next_attempt_at=0,sent_at=NULL").run();
  const attempt=sendReceipt(f.env,KEY,f.deps);await started;
  assert.equal(f.row().attempts,8);assert.equal(f.row().receipt_state,'sending');
  await runScheduled(f.env,f.deps);await sendReceipt(f.env,KEY,f.deps);
  assert.equal(f.row().receipt_state,'sending');assert.equal(f.calls.email.length,2);
  release(json({id:'eighth-accepted'}));await attempt;
  assert.equal(f.row().receipt_state,'sent');assert.equal(f.row().message_id,'eighth-accepted');f.db.close();
});

test('personal or unrelated reply addresses fail closed before sending an enquiry',async()=>{
  const f=setup();f.env.REPLY_TO_EMAIL='personal@example.com';
  const result=await f.post();await f.settle();
  assert.equal(result.status,503);assert.equal(result.body.accepted,false);
  assert.equal(f.calls.form.length,0);assert.equal(f.calls.email.length,0);f.db.close();
});

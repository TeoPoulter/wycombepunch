// Dependency-free regression tests for the actual form HTML and controller scripts.
// A small DOM model covers successful controls, disabled fieldsets, native validity,
// bubbling events and reset timing; visual/browser behaviour is checked separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('docs/index.html', root), 'utf8');
const widgetSource = readFileSync(new URL('docs/assets/enquiry-widgets.js', root), 'utf8');
const app = readFileSync(new URL('docs/assets/app.js', root), 'utf8');
const controller = app.slice(app.indexOf('  // Enquiry builder'), app.indexOf("  $$('[data-copy]')"));
assert.ok(controller.includes('new FormData(form)'), 'The real enquiry controller must be loaded');
const decode = s => s.replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, x => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '}[x]));
class Element {
  constructor(tagName, attrs = {}, doc) {
    this.tagName = tagName.toUpperCase(); this.attrs = attrs; this.ownerDocument = doc;
    this.children = []; this.parentNode = null; this.listeners = {}; this.dataset = {};
    this.style = { setProperty() {} }; this.textContent = ''; this.value = attrs.value || '';
    this.defaultValue = this.value; this.disabled = 'disabled' in attrs; this.required = 'required' in attrs;
    this.hidden = 'hidden' in attrs; this.type = attrs.type || (tagName === 'button' ? 'submit' : 'text');
    this.id = attrs.id || ''; this.name = attrs.name || ''; this.tabIndex = Number(attrs.tabindex ?? (tagName === 'button' ? 0 : -1));
    for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    this.classList = {
      contains: name => (this.attrs.class || '').split(/\s+/).includes(name),
      add: (...names) => { this.attrs.class = [...new Set([...(this.attrs.class || '').split(/\s+/), ...names])].join(' '); },
      remove: (...names) => { this.attrs.class = (this.attrs.class || '').split(/\s+/).filter(name=>!names.includes(name)).join(' '); }
    };
  }
  get effectivelyDisabled() { return this.disabled || !!this.parentNode?.closest('fieldset')?.disabled; }
  append(node) { node.parentNode = this; this.children.push(node); }
  replaceChildren(...nodes) { this.children.forEach(n => { n.parentNode = null; }); this.children = []; nodes.forEach(n => this.append(n)); }
  matches(selector) {
    const s = selector.trim();
    if (s.includes(',')) return s.split(',').some(part=>this.matches(part));
    if (s.includes(':not(:disabled)')) return !this.effectivelyDisabled && this.matches(s.replace(':not(:disabled)', ''));
    if (s === ':disabled') return this.effectivelyDisabled;
    if (s.startsWith('#')) return this.id === s.slice(1);
    if (s.startsWith('.')) return this.classList.contains(s.slice(1));
    const a = s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (a) return a[1].startsWith('data-')
      ? (a[2] === undefined ? Object.hasOwn(this.dataset, a[1].slice(5).replace(/-([a-z])/g, (_,c)=>c.toUpperCase())) : this.dataset[a[1].slice(5).replace(/-([a-z])/g, (_,c)=>c.toUpperCase())] === a[2])
      : a[2] === undefined ? Object.hasOwn(this.attrs, a[1]) : this.attrs[a[1]] === a[2];
    return this.tagName.toLowerCase() === s;
  }
  closest(selector) { for (let n = this; n; n = n.parentNode) if (n.matches(selector)) return n; return null; }
  querySelectorAll(selector) {
    const result = [];
    const selectors = selector.split(',').map(s=>s.trim());
    const match = (node,s) => {
      const parts=s.split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      if (parts.length===1) return node.matches(s);
      if (!node.matches(parts.pop())) return false;
      return !!node.parentNode?.closest(parts.join(' '));
    };
    const visit = node => { for (const child of node.children) { if (selectors.some(s=>match(child,s))) result.push(child); visit(child); } };
    visit(this); return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatchEvent(event) {
    event.target ||= this;
    for (const listener of this.listeners[event.type] || []) {
      const pending = listener(event);
      if (pending?.then) this.ownerDocument.pending.push(pending);
    }
    if (event.bubbles) this.parentNode?.dispatchEvent(event);
  }
  click() { if (!this.effectivelyDisabled) this.dispatchEvent(new TestEvent('click', { bubbles: true })); }
  focus() { this.ownerDocument.activeElement = this; }
  getBoundingClientRect() { return { top:150,bottom:200,left:20,right:300,width:280,height:50 }; }
  scrollIntoView() { this.scrolled = true; }
  setAttribute(name,value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  hasAttribute(name) { return Object.hasOwn(this.attrs,name); }
  setCustomValidity(message) { this.customValidity = message; }
  checkValidity() {
    if (this.effectivelyDisabled || this.type === 'hidden') return true;
    if (this.customValidity || this.required && !this.value) return false;
    if (this.type === 'email' && this.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)) return false;
    return !this.attrs.maxlength || this.value.length <= Number(this.attrs.maxlength);
  }
  select() { this.selectedText = true; }
  reset() {
    this.dispatchEvent(new TestEvent('reset'));
    this.querySelectorAll('input,textarea,select').forEach(node => { node.value = node.defaultValue; });
  }
}
class TestEvent {
  constructor(type,options={}) { this.type=type; this.defaultPrevented=false; Object.assign(this,options); }
  preventDefault() { this.defaultPrevented=true; }
}
function parse() {
  const doc=new Element('document',{},null); doc.ownerDocument=doc; doc.pending=[];
  doc.getElementById=id=>doc.querySelector('#'+id); doc.createElement=tag=>new Element(tag,{},doc);
  const stack=[doc]; const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr','path']);
  for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    if(token.startsWith('<!--')||/^<!/.test(token))continue;
    if(token.startsWith('</')) {const tag=token.slice(2).match(/^\w[\w-]*/)?.[0];for(let i=stack.length-1;i>0;i--)if(stack[i].tagName.toLowerCase()===tag){stack.length=i;break;}continue;}
    if(token.startsWith('<')) {
      const tag=token.match(/^<([\w-]+)/)?.[1]; if(!tag)continue;
      const attrs={}; const raw=token.slice(tag.length+1,-1);
      for(const m of raw.matchAll(/([^=\s/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[m[1]]=decode(m[2]??m[3]??m[4]??'');
      const node=new Element(tag,attrs,doc);stack.at(-1).append(node);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(node);
    } else stack.at(-1).textContent+=decode(token);
  }
  return doc;
}
class FixedDate extends Date {
  constructor(...args) { super(...(args.length?args:[2026,8,15,12])); }
  static now() { return new FixedDate().getTime(); }
}
function fixture({local=false,storageDenied=false,response={ok:true,status:200},deferred=false,reduced=true}={}) {
  let now=0, timerId=0; const timers=new Map();
  const schedule=(fn,delay=0)=>{const id=++timerId;timers.set(id,{fn,at:now+delay});return id;};
  const tick=ms=>{const end=now+ms;let count=0;while(true){const job=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!job)break;if(++count>500)throw Error('Timer loop');now=job[1].at;timers.delete(job[0]);job[1].fn();}now=end;};
  const document=parse(); const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>r.querySelectorAll(s);
  const fetches=[], redirects=[], receipts=[], toasts=[]; let release;
  const location={protocol:'https:',hostname:local?'localhost':'wycombepunch.com',assign:url=>redirects.push(url)};
  const formConfig={provider:'formspree',endpoint:'https://formspree.io/f/xppwapkw',timeoutMs:15000};
  class FormDataModel extends Map {
    constructor(form) {super();for(const input of form.querySelectorAll('input,textarea,select')) if(input.name&&!input.effectivelyDisabled)this.set(input.name,input.value);}
  }
  const context=vm.createContext({document,window:new Element('window',{},document),$, $$,location,formConfig,config:{enquiriesEnabled:true},identityReady:true,reduced,innerHeight:900,
    business:{},contact:{},emailValid:v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),toast:message=>toasts.push(message),
    navigator:{clipboard:{writeText:async text=>{context.copied=text;}}},
    sessionStorage:{setItem:(key,value)=>{if(storageDenied)throw Error('Denied');receipts.push({key,value});}},
    FormData:FormDataModel,URL,URLSearchParams,AbortController,Date:FixedDate,Event:TestEvent,CustomEvent:TestEvent,queueMicrotask,setTimeout:schedule,clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>schedule(fn,16),
    fetch:async(url,options)=>{fetches.push({url,options,data:Object.fromEntries(new URLSearchParams(options.body))});if(deferred)return new Promise(resolve=>{release=resolve;});if(response instanceof Error)throw response;return response;}});
  vm.runInContext(widgetSource,context);
  vm.runInContext(`(()=>{${controller}})()`,context);
  const form=$('#enquiry-form');
  return {$,$$,document,context,fetches,redirects,receipts,toasts,form,tick,
    set(id,value){const el=$('#'+id);el.value=value;el.dispatchEvent(new TestEvent('input',{bubbles:true}));el.dispatchEvent(new TestEvent('change',{bubbles:true}));},
    choose(group,value){const button=$$('[data-choice]', $(`[data-choice-group="${group}"]`)).find(b=>b.dataset.choice===value);assert.ok(button,`${group} has ${value}`);button.click();},
    go(index){document.dispatchEvent(new TestEvent('wp:form-step',{detail:index}));},
    next(){ $('#form-next').click();tick(500); },step(){return Number(form.dataset.step);},
    key(target,key,options={}){const event=new TestEvent('keydown',{key,bubbles:true,...options});target.dispatchEvent(event);return event.defaultPrevented;},
    async submit(explicit=true){form.dispatchEvent(new TestEvent('submit',{submitter:explicit?$('#submit-enquiry'):undefined}));await Promise.resolve();},
    async settle(){await Promise.resolve();tick(1000);await Promise.all(document.pending.splice(0));await Promise.resolve();},
    resolve(value=response){release(value);},
    fillValid(){this.choose('event-type','Eid celebration');$('#date-undecided').click();this.set('venue',' High Wycombe ');this.choose('duration','3–5 hours');this.set('name',' Test Guest ');this.set('phone-national',' 07700 900123 ');this.set('email','guest@example.com');this.go(8);}
  };
}

test('custom occasion and duration are required, and Next cannot skip either question',()=>{
  const f=fixture();f.next();assert.equal(f.step(),0);assert.equal(f.$('#question-error-0').hidden,false);
  f.choose('event-type','Eid celebration');f.next();assert.equal(f.step(),1);
  f.next();assert.equal(f.step(),1);f.$('#date-undecided').click();f.next();assert.equal(f.step(),2);
  f.set('venue','   ');f.next();assert.equal(f.step(),2);f.set('venue','High Wycombe');f.next();assert.equal(f.step(),3);
  f.next();assert.equal(f.step(),3);f.choose('duration','Full day');f.next();assert.equal(f.step(),4);
  assert.equal(f.$('#next-label').textContent,'Skip for now');
});
test('required phone and email return to their own visible questions on final validation',async()=>{
  const f=fixture();f.fillValid();f.set('phone-national','   ');await f.submit();assert.equal(f.step(),6);assert.equal(f.document.activeElement,f.$('#phone-national'));assert.equal(f.fetches.length,0);
  f.set('phone-national','not a phone');f.next();assert.equal(f.step(),6);
  f.set('phone-national','+44 (0) 1494 123456');f.next();assert.equal(f.step(),7);f.set('email','wrong@');f.next();assert.equal(f.step(),7);
  f.set('email','guest@example.com');f.next();assert.equal(f.step(),8);assert.equal(f.fetches.length,0);
});
test('custom duration is required only when selected and excluded after switching away',async()=>{
  const f=fixture();f.fillValid();f.choose('duration','Something else');await f.submit();assert.equal(f.step(),3);assert.equal(f.$('#duration-detail').disabled,false);
  f.set('duration-detail',' 2 hours from 6pm ');f.choose('duration','Full day');assert.equal(f.$('#duration-detail').disabled,true);assert.equal(f.$('#duration-detail').required,false);
  f.go(8);await f.submit();await f.settle();assert.equal(f.fetches.length,1);assert.equal(f.fetches[0].data.duration,'Full day');assert.ok(!Object.hasOwn(f.fetches[0].data,'duration-detail'));
});
test('exact payload retains hidden-step answers and trims contact values before disabling controls',async()=>{
  const f=fixture();f.fillValid();f.choose('duration','Something else');f.set('duration-detail',' 2 hours from 6pm ');f.set('message','Bring it downstairs.');await f.submit();await f.settle();
  assert.equal(f.fetches.length,1);assert.equal(f.fetches[0].url,'https://formspree.io/f/xppwapkw');
  assert.deepEqual(f.fetches[0].data,{'form-name':'wycombe-punch-enquiry',_gotcha:'','event-type':'Eid celebration','event-date':'',venue:'High Wycombe',duration:'Something else','duration-detail':'2 hours from 6pm',message:'Bring it downstairs.',name:'Test Guest',phone:'+44 7700900123',email:'guest@example.com'});
  assert.deepEqual(f.redirects,['thank-you.html']);assert.equal(f.receipts.length,1);
});
test('double submission is locked until response; all answers survive a failed request',async()=>{
  const f=fixture({deferred:true});f.fillValid();await f.submit();await f.submit();assert.equal(f.fetches.length,1);assert.equal(f.$('#enquiry-fields').disabled,true);
  f.resolve({ok:false,status:429});await f.settle();assert.equal(f.$('#enquiry-fields').disabled,false);assert.equal(f.$('#name').value,' Test Guest ');assert.equal(f.$('#phone').value,'+44 7700900123');
  assert.equal(f.redirects.length,0);assert.equal(f.receipts.length,0);assert.match(f.$('#form-result-text').textContent,/too many requests/);
});
test('network failure never claims success or redirects, and copying stays neutral',async()=>{
  const f=fixture({response:new Error('Network disconnected')});f.fillValid();await f.submit();await f.settle();assert.equal(f.redirects.length,0);assert.equal(f.receipts.length,0);assert.match(f.$('#form-result-text').textContent,/could not confirm delivery/);
  f.$('#copy-enquiry').click();await f.settle();assert.equal(f.toasts.at(-1),'Enquiry details copied.');assert.match(f.context.copied,/Phone: \+44 7700900123/);
});
test('local preview submits nothing; storage-denied live success stays explicitly sent',async()=>{
  const local=fixture({local:true});local.fillValid();await local.submit();await local.settle();assert.equal(local.fetches.length,0);assert.match(local.$('#form-result-title').textContent,/not sent/);
  const denied=fixture({storageDenied:true});denied.fillValid();await denied.submit();await denied.settle();assert.equal(denied.fetches.length,1);assert.equal(denied.redirects.length,0);assert.equal(denied.$('#form-result-title').textContent,'Enquiry sent');assert.equal(denied.$('#copy-enquiry').hidden,true);
  assert.equal(denied.$('#event-date').dataset.chosen,'');assert.ok(denied.$$('[data-choice]').every(b=>b.getAttribute('aria-checked')==='false'));
});
test('calendar rejects past days, supports unknown dates and clears a previous selection',()=>{
  const f=fixture();const days=f.$('#calendar-days');assert.equal(days.querySelector('[data-date="2026-09-14"]').disabled,true);
  days.querySelector('[data-date="2026-09-20"]').click();assert.equal(f.$('#event-date').value,'2026-09-20');assert.equal(f.$('#event-date').dataset.chosen,'true');
  f.$('#date-undecided').click();assert.equal(f.$('#event-date').value,'');assert.equal(f.$('#date-undecided').getAttribute('aria-pressed'),'true');assert.equal(days.querySelector('[aria-pressed="true"]'),null);
});
test('calendar keyboard navigation crosses month boundaries and clamps to today without choosing a date',()=>{
  const f=fixture();const days=f.$('#calendar-days');const sep30=days.querySelector('[data-date="2026-09-30"]');sep30.focus();assert.equal(f.key(sep30,'ArrowRight'),true);
  assert.equal(f.document.activeElement.dataset.date,'2026-10-01');assert.equal(f.$('#event-date').value,'');
  f.key(f.document.activeElement,'PageUp');assert.equal(f.document.activeElement.dataset.date,'2026-09-15');
  f.key(f.document.activeElement,'ArrowLeft');assert.equal(f.document.activeElement.dataset.date,'2026-09-15');
});
test('choice groups have one tab stop and arrow-key changes reach the actual payload field',()=>{
  const f=fixture();const group=f.$('[data-choice-group="event-type"]');const buttons=group.querySelectorAll('[data-choice]');buttons[0].focus();assert.equal(f.key(buttons[0],'ArrowRight'),true);
  assert.equal(f.$('#event-type').value,'Family gathering');assert.equal(buttons.filter(b=>b.tabIndex===0).length,1);assert.equal(buttons[1].getAttribute('aria-checked'),'true');
});
test('calendar starts with one enabled tab stop despite the initial disabled fieldset',()=>{
  const f=fixture();const days=f.$('#calendar-days').querySelectorAll('button:not(:disabled)');assert.equal(days.filter(b=>b.tabIndex===0).length,1);
});

test('explicitly unknown dates are valid, but a stale past date fails again at submission',async()=>{
  const f=fixture();f.fillValid();f.$('#event-date').value='2026-09-14';f.$('#event-date').dataset.chosen='true';await f.submit();assert.equal(f.step(),1);assert.equal(f.fetches.length,0);
  f.$('#date-undecided').click();f.go(8);await f.submit();await f.settle();assert.equal(f.fetches[0].data['event-date'],'');
});
test('Enter-style form submission advances questions but cannot send before the explicit review',async()=>{
  const f=fixture();f.choose('event-type','Family gathering');await f.submit();assert.equal(f.step(),1);assert.equal(f.fetches.length,0);f.tick(500);
  f.$('#date-undecided').click();await f.submit();assert.equal(f.step(),2);assert.equal(f.fetches.length,0);
});
test('honeypot content blocks submissions without creating a success receipt',async()=>{
  const f=fixture();f.fillValid();f.form.querySelector('[name="_gotcha"]').value='bot';await f.submit();await f.settle();assert.equal(f.fetches.length,0);assert.equal(f.redirects.length,0);assert.equal(f.receipts.length,0);
});
test('calendar PageDown handles short months, and reset clears its chosen date and radio state',async()=>{
  const f=fixture();f.$('[data-calendar-next]').click();const oct31=f.$('#calendar-days').querySelector('[data-date="2026-10-31"]');oct31.focus();f.key(oct31,'PageDown');assert.equal(f.document.activeElement.dataset.date,'2026-11-30');
  f.document.activeElement.click();f.choose('duration','Full day');f.form.reset();await Promise.resolve();assert.equal(f.$('#event-date').value,'');assert.equal(f.$('#event-date').dataset.chosen,'');assert.match(f.$('#calendar-month').textContent,/September 2026/);assert.equal(f.$('#date-selection').textContent,'');assert.ok(f.$$('[data-choice]').every(b=>b.getAttribute('aria-checked')==='false'));
});

test('committed choices show brief feedback, advance once, and prevent rapid double navigation in both motion modes',()=>{
  for(const reduced of [true,false]) {
    const f=fixture({reduced});f.$('#date-undecided').click(); // Pre-existing answer on the next question.
    f.choose('event-type','Family gathering');f.choose('event-type','Family gathering');
    f.tick(reduced?139:279);assert.equal(f.step(),0);
    f.tick(1);assert.equal(f.form.dataset.transitioning,'true');
    f.$('#form-next').click();f.$('#form-next').click();
    f.tick(500);assert.equal(f.step(),1);assert.equal(f.form.dataset.transitioning,'false');
    f.$('#form-next').click();f.$('#form-next').click();f.tick(500);assert.equal(f.step(),2);
  }
});
test('arrow-key choice browsing does not advance until explicitly committed',()=>{
  const f=fixture();const buttons=f.$$('[data-choice]',f.$('[data-choice-group="event-type"]'));
  buttons[0].focus();f.key(buttons[0],'ArrowRight');f.tick(1000);assert.equal(f.step(),0);
  buttons[1].click();f.tick(140);assert.equal(f.step(),1);f.tick(500);assert.equal(f.step(),1);
});
test('calendar navigation stays on the date question; choosing a day or undecided advances',()=>{
  const f=fixture();f.go(1);f.$('[data-calendar-next]').click();f.tick(1000);assert.equal(f.step(),1);
  const day=f.$('[data-date="2026-10-15"]');day.focus();f.key(day,'ArrowRight');f.tick(1000);assert.equal(f.step(),1);assert.equal(f.$('#event-date').value,'');
  f.document.activeElement.click();f.tick(500);assert.equal(f.step(),2);assert.equal(f.$('#event-date').value,'2026-10-16');
  f.go(1);f.$('#date-undecided').click();f.tick(500);assert.equal(f.step(),2);assert.equal(f.$('#event-date').value,'');
});
test('Something else stays for its detail; committed standard duration advances',()=>{
  const f=fixture();f.go(3);f.choose('duration','Something else');f.tick(1000);assert.equal(f.step(),3);assert.equal(f.document.activeElement,f.$('#duration-detail'));
  f.key(f.$('#duration-detail'),'Enter');assert.equal(f.step(),3);
  f.set('duration-detail','Two hours');f.key(f.$('#duration-detail'),'Enter');f.tick(500);assert.equal(f.step(),4);
  f.go(3);f.choose('duration','3–5 hours');f.tick(500);assert.equal(f.step(),4);
});
test('changes and Back cancel stale choice timers, and forced navigation cancels stale transition callbacks',()=>{
  const f=fixture({reduced:false});f.choose('event-type','Family gathering');f.tick(100);
  f.set('event-type','Eid celebration');f.tick(1000);assert.equal(f.step(),0);
  f.go(1);f.$('#date-undecided').click();f.$('#form-back').click();f.tick(1000);assert.equal(f.step(),0);
  f.choose('event-type','Family gathering');f.tick(300);assert.equal(f.form.dataset.transitioning,'true');
  f.go(5);f.tick(1000);assert.equal(f.step(),5);assert.equal(f.form.dataset.transitioning,'false');assert.equal(f.$('#question-stage').inert,false);assert.equal(f.$('#question-stage').style.height,'');
});
test('Enter validates plain answers, held Enter cannot skip questions after a transition, and notes preserve Shift+Enter',()=>{
  const f=fixture({reduced:false});f.go(2);
  assert.equal(f.key(f.$('#venue'),'Enter'),true);assert.equal(f.step(),2);
  f.set('venue','High Wycombe');f.choose('duration','Full day');
  f.key(f.$('#venue'),'Enter');f.key(f.$('#venue'),'Enter',{repeat:true});f.tick(1000);assert.equal(f.step(),3);
  f.key(f.$('#question-3'),'Enter',{repeat:true});f.tick(1000);assert.equal(f.step(),3);
  f.key(f.$('#question-3'),'Enter');f.tick(1000);assert.equal(f.step(),4);
  assert.equal(f.key(f.$('#message'),'Enter',{shiftKey:true}),false);assert.equal(f.step(),4);
  assert.equal(f.key(f.$('#message'),'Enter'),true);f.tick(1000);assert.equal(f.step(),5);
});
test('Enter preserves buttons, links, modifiers and composition; final review requires explicit Send',async()=>{
  const f=fixture();f.fillValid();
  for(const button of [f.$('#form-back'),f.$('[data-review-step]'),f.$('#submit-enquiry')]) assert.equal(f.key(button,'Enter'),false);
  const link=f.$('a',f.form);assert.ok(link);assert.equal(f.key(link,'Enter'),false);
  for(const modifier of ['ctrlKey','metaKey','altKey','isComposing']) assert.equal(f.key(f.$('#question-8'),'Enter',{[modifier]:true}),false);
  assert.equal(f.key(f.$('#question-8'),'Enter'),true);await f.submit(false);await f.settle();assert.equal(f.step(),8);assert.equal(f.fetches.length,0);
  assert.equal(f.key(f.$('#submit-enquiry'),'Enter',{repeat:true}),true);
  await f.submit();await f.settle();assert.equal(f.fetches.length,1);
});
test('phone defaults to UK and combines one existing payload field; pasted international and Italian zero survive',async()=>{
  const f=fixture({response:new Error('offline')});assert.equal(f.$('#phone-country').value,'+44');f.fillValid();
  assert.equal(f.$('#phone').value,'+44 7700900123');assert.equal(f.$('[data-summary="phone"]').textContent,'+44 7700900123');
  const pasted=new TestEvent('paste',{bubbles:true,clipboardData:{getData:()=>'+39 06 1234 5678'}});f.$('#phone-national').dispatchEvent(pasted);
  assert.equal(pasted.defaultPrevented,true);assert.equal(f.$('#phone-country').value,'+39');assert.equal(f.$('#phone-national').value,'0612345678');assert.equal(f.$('#phone').value,'+39 0612345678');
  await f.submit();await f.settle();assert.equal(f.fetches[0].data.phone,'+39 0612345678');assert.ok(!Object.hasOwn(f.fetches[0].data,'phone-country'));assert.ok(!Object.hasOwn(f.fetches[0].data,'phone-national'));
  f.$('#copy-enquiry').click();await f.settle();assert.match(f.context.copied,/Phone: \+39 0612345678/);
  f.set('phone-national','0044 (0) 7700 900123');assert.equal(f.$('#phone-country').value,'+44');assert.equal(f.$('#phone').value,'+44 7700900123');
  f.set('phone-national','+1 (202) 555-0123');assert.equal(f.$('#phone-country').value,'+1');assert.equal(f.$('#phone').value,'+1 2025550123');
  f.set('phone-country','+33');f.set('phone-national','0123456789');assert.equal(f.$('#phone').value,'+33 0123456789');
});
test('country code alone cannot satisfy phone requirement and malformed or overlong numbers cannot submit',async()=>{
  const f=fixture();f.fillValid();f.set('phone-national','');await f.submit();assert.equal(f.step(),6);assert.equal(f.fetches.length,0);
  f.set('phone-national','07700 900123');f.set('phone-country','+000');f.next();assert.equal(f.step(),6);assert.equal(f.document.activeElement,f.$('#phone-country'));
  f.set('phone-country','44');assert.equal(f.$('#phone-country').value,'+44');f.set('phone-national','123456789012345');f.next();assert.equal(f.step(),6);
  f.set('phone-national','letters 123456789');f.next();assert.equal(f.step(),6);
  f.set('phone-national','7700900123');f.next();assert.equal(f.step(),7);
});
test('success exit starts only after acceptance, then redirects after its animation; failed requests retain the form',async()=>{
  const f=fixture({reduced:false,deferred:true});f.fillValid();await f.submit();assert.equal(f.redirects.length,0);assert.equal(f.$('.enquiry-form-card').classList.contains('is-sent'),false);
  f.tick(500);assert.equal(f.redirects.length,0);f.resolve({ok:true,status:200});for(let i=0;i<6;i++)await Promise.resolve();
  assert.equal(f.$('.enquiry-form-card').classList.contains('is-sent'),true);assert.equal(f.receipts.length,1);assert.equal(f.redirects.length,0);
  f.tick(259);assert.equal(f.redirects.length,0);f.tick(1);await f.settle();assert.deepEqual(f.redirects,['thank-you.html']);
  const failed=fixture({reduced:false,response:{ok:false,status:503}});failed.fillValid();await failed.submit();await failed.settle();assert.equal(failed.$('.enquiry-form-card').classList.contains('is-sent'),false);assert.equal(failed.form.hidden,false);assert.equal(failed.$('#phone-national').value,' 07700 900123 ');
});


test('calendar months always reserve six rows without making blank cells interactive',()=>{
  const f=fixture();const days=f.$('#calendar-days');
  for(let i=0;i<12;i++) {
    assert.equal(days.children.length,42);
    assert.ok(days.children.filter(cell=>cell.tagName==='SPAN').every(cell=>cell.getAttribute('aria-hidden')==='true'));
    assert.equal(days.querySelectorAll('button:not(:disabled)').filter(button=>button.tabIndex===0).length,1);
    f.$('[data-calendar-next]').click();
  }
});

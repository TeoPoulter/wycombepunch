// Run with: node --test tests/test_game.mjs
// Controlled clocks exercise the browser game's state transitions without a server.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../docs/assets/game.js', import.meta.url), 'utf8');

class Element {
  constructor() {
    this.textContent = '';
    this.hidden = false;
    this.style = {};
    this.dataset = {};
    this.attrs = {};
    this.listeners = {};
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name), remove: name => classes.delete(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
    };
  }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatchEvent(event) { for (const callback of this.listeners[event.type] || []) callback(event); }
  click() { this.dispatchEvent({ type: 'click' }); }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  scrollIntoView() {}
}

function fixture(reduced = false) {
  const nodes = new Map();
  const $ = (selector, root) => {
    if (root?.score && selector === '[data-round-score]') return root.score;
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  const cells = Array.from({ length: 3 }, () => Object.assign(new Element(), { score: new Element() }));
  let now = 0;
  let timerId = 0;
  const scheduled = new Map();
  const schedule = (callback, delay, frame = false) => {
    const id = ++timerId;
    scheduled.set(id, { callback, at: now + delay, frame });
    return id;
  };
  function advance(milliseconds) {
    const target = now + milliseconds;
    while (scheduled.size) {
      const next = [...scheduled].sort((a, b) => a[1].at - b[1].at)[0];
      if (next[1].at > target) break;
      scheduled.delete(next[0]);
      now = next[1].at;
      next[1].callback(next[1].frame ? now : undefined);
    }
    now = target;
  }
  const document = Object.assign(new Element(), { hidden: false });
  const window = new Element();
  window.WP = {
    $, $$: selector => selector === '.round-cell' ? cells : [], reducedMotion: reduced,
    countTo: (element, value) => { element.textContent = String(value).padStart(3, '0'); },
    hitMachine() {}, clearMachine() {}, toast() {}
  };
  const events = [];
  document.addEventListener('wp:game-complete', event => events.push(event.detail));
  const context = vm.createContext({
    window, document, navigator: {}, performance: { now: () => now },
    requestAnimationFrame: callback => schedule(callback, 16, true),
    cancelAnimationFrame: id => scheduled.delete(id),
    setTimeout: (callback, delay) => schedule(callback, delay),
    clearTimeout: id => scheduled.delete(id),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  });
  vm.runInContext(source, context);
  return {
    $, cells, document, window, events, advance,
    hit: () => $('#game-button').click(),
    state: () => $('#game-arena').dataset.state,
    scores: () => cells.map(cell => cell.score.textContent),
    hide: () => { document.hidden = true; document.dispatchEvent({ type: 'visibilitychange' }); },
    show: () => { document.hidden = false; document.dispatchEvent({ type: 'visibilitychange' }); }
  };
}

test('three clean centre hits make exactly 999, with one completion event', () => {
  const game = fixture();
  assert.equal(game.state(), 'idle');
  game.hit(); game.advance(550); game.hit();
  assert.equal(game.state(), 'scored');
  assert.equal(game.$('#game-score').textContent, '333');
  game.hit(); // A double press during feedback must not start or score a hit.
  assert.deepEqual(game.scores(), ['333', '—', '—']);
  game.advance(1100);
  assert.equal(game.state(), 'aiming');
  game.advance(460); game.hit();
  game.advance(1100); game.advance(380); game.hit();
  assert.equal(game.state(), 'complete');
  assert.deepEqual(game.scores(), ['333', '333', '333']);
  assert.equal(game.$('#final-score').textContent, '999');
  assert.equal(game.$('#session-best').textContent, '999');
  assert.equal(game.events.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(game.events[0].hitScores)), [333, 333, 333]);
  assert.equal(game.events[0].score, 999);
  assert.equal(game.events[0].bestCombo, 3);
  assert.equal(game.events[0].version, '2');
  assert.equal(game.events[0].mode, 'precision');
  assert.ok(game.events[0].runId);
  game.advance(20000);
  assert.equal(game.events.length, 1);
});

test('all hits contribute; an early hit cannot be discarded as a best-round game', () => {
  const game = fixture(true);
  for (const delay of [0, 1000, 500]) { game.hit(); game.advance(delay); game.hit(); }
  const scores = game.scores().map(Number);
  assert.equal(scores[0], 0);
  assert.equal(scores[1], 333);
  assert.ok(scores[2] > 0 && scores[2] < 333);
  assert.equal(Number(game.$('#final-score').textContent), scores.reduce((a, b) => a + b));
  assert.equal(game.events[0].mode, 'motion-free');
  game.$('#game-reset').click();
  assert.deepEqual(game.scores(), ['—', '—', '—']);
  assert.equal(Number(game.$('#session-best').textContent), scores.reduce((a, b) => a + b));
});

test('motion-free mode waits for an explicit start between hits', () => {
  const game = fixture(true);
  assert.equal(game.$('#timing-meter').hidden, true);
  game.hit(); game.advance(1000); game.hit();
  game.advance(10000);
  assert.equal(game.state(), 'scored');
  assert.deepEqual(game.scores(), ['333', '—', '—']);
  assert.equal(game.$('#game-button').getAttribute('aria-disabled'), 'false');
});

test('hiding while aiming or between hits pauses without losing completed hits', () => {
  const game = fixture();
  game.hit(); game.advance(550); game.hit();
  game.hide(); game.advance(20000);
  assert.equal(game.state(), 'paused');
  assert.deepEqual(game.scores(), ['333', '—', '—']);
  game.show(); game.hit(); game.advance(200); game.hide(); game.advance(20000);
  assert.equal(game.state(), 'paused');
  assert.deepEqual(game.scores(), ['333', '—', '—']);
  game.show(); game.hit(); game.advance(460); game.hit();
  assert.deepEqual(game.scores(), ['333', '333', '—']);
});

test('timeout gives only the current hit zero and reset cancels the chain', () => {
  const game = fixture();
  game.hit(); game.advance(8010);
  assert.deepEqual(game.scores(), ['000', '—', '—']);
  assert.equal(game.state(), 'scored');
  game.$('#game-reset').click(); game.advance(20000);
  assert.equal(game.state(), 'idle');
  assert.deepEqual(game.scores(), ['—', '—', '—']);
  assert.equal(game.events.length, 0);
});

test('changing motion settings clears an unfinished run and queued hit', () => {
  const game = fixture();
  game.hit(); game.advance(550); game.hit();
  game.window.WP.reducedMotion = true;
  game.document.dispatchEvent({ type: 'wp:motion' });
  game.advance(10000);
  assert.equal(game.state(), 'idle');
  assert.deepEqual(game.scores(), ['—', '—', '—']);
  assert.equal(game.$('#timing-meter').hidden, true);
});

test('scoring has an attainable bullseye, symmetry and safe bounds', () => {
  const math = fixture().window.WP_GAME_MATH;
  assert.deepEqual([0, .5, 1].map(math.scoreForPosition), [0, 333, 0]);
  assert.deepEqual([0, 1000, 2000].map(math.scoreForElapsed), [0, 333, 0]);
  assert.equal(math.scoreForPosition(.49), 333);
  assert.equal(math.scoreForPosition(.51), 333);
  for (let i = -100; i <= 200; i++) {
    const score = math.scoreForPosition(i / 100);
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 333);
    assert.ok(Math.abs(score - math.scoreForPosition(1 - i / 100)) <= 1);
  }
  assert.equal(math.scoreForPosition(NaN), 0);
  assert.equal(math.scoreForPosition(Infinity), 0);
  assert.equal(math.runScore([333, 333, 333, 333]), 999);
  assert.equal(math.runScore([0, 333, 200]), 533);
});

test('score-copy fallback uses the complete run and held keys do not repeat', async () => {
  const game = fixture(true);
  let prevented = false;
  game.$('#game-button').dispatchEvent({ type: 'keydown', key: ' ', repeat: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  for (let i = 0; i < 3; i++) { game.hit(); game.advance(1000); game.hit(); }
  game.$('#share-score').click();
  await Promise.resolve();
  assert.equal(game.$('#score-share-fallback').hidden, false);
  assert.match(game.$('#score-share-fallback').value, /999\/999/);
  assert.equal(game.$('#score-share-fallback').selected, true);
});

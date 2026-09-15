// Run with: node --test tests/test_game.mjs
// Controlled clocks test actual button interactions, interruptions and records.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../docs/assets/game.js', import.meta.url), 'utf8');
class Element {
  constructor() { this.textContent = ''; this.hidden = false; this.style = {}; this.dataset = {}; this.attrs = {}; this.listeners = {}; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatchEvent(event) { for (const callback of this.listeners[event.type] || []) callback(event); }
  click() { this.dispatchEvent({ type: 'click' }); }
}
function fixture(reduced = false) {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  let now = 0;
  let frameId = 0;
  const scheduled = new Map();
  function advance(milliseconds) {
    const target = now + milliseconds;
    while (scheduled.size) {
      const next = [...scheduled].sort((a, b) => a[1].at - b[1].at)[0];
      if (next[1].at > target) break;
      scheduled.delete(next[0]); now = next[1].at; next[1].callback(now);
    }
    now = target;
  }
  const document = Object.assign(new Element(), { hidden: false });
  const window = new Element();
  window.WP = { $, reducedMotion: reduced };
  const events = [];
  document.addEventListener('wp:game-complete', event => events.push(event.detail));
  vm.runInContext(source, vm.createContext({
    window, document, performance: { now: () => now },
    requestAnimationFrame: callback => { const id = ++frameId; scheduled.set(id, { callback, at: now + 16 }); return id; },
    cancelAnimationFrame: id => scheduled.delete(id),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  }));
  return {
    $, document, window, events, advance,
    hit: () => $('#game-button').click(),
    state: () => $('#game-arena').dataset.state,
    key: (key, repeat = false) => {
      let prevented = false;
      $('#game-button').dispatchEvent({ type: 'keydown', key, repeat, preventDefault() { prevented = true; } });
      return prevented;
    },
    hide: () => { document.hidden = true; document.dispatchEvent({ type: 'visibilitychange' }); },
    show: () => { document.hidden = false; document.dispatchEvent({ type: 'visibilitychange' }); }
  };
}

test('one centre hit scores 999 and emits one version-3 completion', () => {
  const game = fixture();
  assert.equal(game.state(), 'idle');
  assert.equal(game.$('#game-button').disabled, false);
  game.hit(); game.advance(450); game.hit();
  assert.equal(game.state(), 'complete');
  assert.equal(game.$('#game-score').textContent, '999');
  assert.equal(game.$('#session-best').textContent, '999');
  assert.equal(game.$('#game-button-label').textContent, 'Go again');
  assert.equal(game.events.length, 1);
  assert.deepEqual(Object.keys(game.events[0]).sort(), ['mode', 'runId', 'score', 'version']);
  assert.equal(game.events[0].score, 999);
  assert.equal(game.events[0].mode, 'precision');
  assert.equal(game.events[0].version, '3');
  assert.ok(game.events[0].runId);
  game.advance(20000);
  assert.equal(game.events.length, 1);
});

test('replay starts immediately and a lower result preserves the best this visit', () => {
  const game = fixture();
  game.hit(); game.advance(450); game.hit();
  game.hit();
  assert.equal(game.state(), 'aiming');
  assert.equal(game.$('#game-score').textContent, '000');
  game.advance(225); game.hit();
  assert.ok(game.events[1].score > 0 && game.events[1].score < 999);
  assert.equal(game.$('#session-best').textContent, '999');
  assert.notEqual(game.events[0].runId, game.events[1].runId);
});

test('motion-free mode scores a one-second attempt without displaying a moving meter', () => {
  const game = fixture(true);
  assert.equal(game.$('#timing-meter').hidden, true);
  assert.equal(game.$('#reduced-game-instructions').hidden, false);
  game.hit(); game.advance(1000); game.hit();
  assert.equal(game.events[0].score, 999);
  assert.equal(game.events[0].mode, 'motion-free');
  assert.equal(game.$('#session-best').textContent, '999');
});

test('keyboard starts and punches on press, while held keys cannot auto-play', () => {
  const game = fixture();
  assert.equal(game.key(' '), true);
  assert.equal(game.state(), 'aiming');
  game.advance(200);
  assert.equal(game.key(' ', true), true);
  assert.equal(game.state(), 'aiming');
  game.advance(250);
  assert.equal(game.key('Enter'), true);
  assert.equal(game.$('#game-score').textContent, '999');
  assert.equal(game.key('Enter', true), true);
  assert.equal(game.state(), 'complete');
  assert.equal(game.key('Tab'), false);
});

test('switching tabs or losing focus abandons the attempt without posting a score', () => {
  const game = fixture();
  game.hit(); game.advance(300); game.hide(); game.advance(5000);
  assert.equal(game.state(), 'idle');
  assert.equal(game.events.length, 0);
  game.hit();
  assert.equal(game.state(), 'idle');
  game.show(); game.hit(); game.advance(450); game.hit();
  assert.equal(game.events.length, 1);
  assert.equal(game.events[0].score, 999);
  game.hit(); game.advance(300); game.window.dispatchEvent({ type: 'blur' });
  assert.equal(game.state(), 'idle');
  assert.equal(game.$('#session-best').textContent, '999');
  assert.equal(game.events.length, 1);
});

test('abandoned or overlong attempts never submit stale scores', () => {
  const game = fixture();
  game.hit(); game.advance(8010);
  assert.equal(game.state(), 'idle');
  assert.equal(game.events.length, 0);
  game.hit(); game.advance(450); game.hit();
  assert.equal(game.events[0].score, 999);
});

test('changing timing mode cancels play and keeps each mode’s best separate', () => {
  const game = fixture();
  game.hit(); game.advance(450); game.hit();
  game.hit(); game.advance(200);
  game.window.WP.reducedMotion = true;
  game.document.dispatchEvent({ type: 'wp:motion' });
  game.advance(10000);
  assert.equal(game.state(), 'idle');
  assert.equal(game.$('#timing-meter').hidden, true);
  assert.equal(game.$('#session-best').textContent, '000');
  assert.equal(game.events.length, 1);
  game.window.WP.reducedMotion = false;
  game.document.dispatchEvent({ type: 'wp:motion' });
  assert.equal(game.$('#session-best').textContent, '999');
});

test('the target is attainable, symmetric and bounded with no random scoring', () => {
  const math = fixture().window.WP_GAME_MATH;
  assert.deepEqual([0, .5, 1].map(math.scoreForPosition), [0, 999, 0]);
  assert.deepEqual([0, 1000, 2000].map(math.scoreForElapsed), [0, 999, 0]);
  assert.equal(math.scoreForPosition(.49), 999);
  assert.equal(math.scoreForPosition(.51), 999);
  assert.deepEqual([0, 450, 900, 1350, 1800].map(math.positionAt), [0, .5, 1, .5, 0]);
  for (let i = -100; i <= 200; i++) {
    const score = math.scoreForPosition(i / 100);
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 999);
    assert.ok(Math.abs(score - math.scoreForPosition(1 - i / 100)) <= 1);
  }
  assert.equal(math.scoreForPosition(NaN), 0);
  assert.equal(math.scoreForPosition(Infinity), 0);
  assert.equal(math.positionAt(NaN), 0);
});

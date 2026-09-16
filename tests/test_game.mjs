// Run with: node --test tests/test_game.mjs
// Controlled clocks test actual button interactions, interruptions and records.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../docs/assets/game.js', import.meta.url), 'utf8');
class Element {
  constructor(tagName = 'DIV') {
    this.tagName = tagName; this.textContent = ''; this.hidden = false; this.style = {};
    this.dataset = {}; this.attrs = {}; this.listeners = {}; this.parentNode = null; this.children = [];
    this.bounds = { width: 220, height: 180, top: 300, bottom: 480, left: 40, right: 260 };
  }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  append(node) { node.parentNode = this; this.children.push(node); }
  before(node) { node.parentNode = this.parentNode; this.parentNode.children.splice(Math.max(0, this.parentNode.children.indexOf(this)), 0, node); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatchEvent(event) {
    event.target ||= this;
    for (const callback of this.listeners[event.type] || []) callback(event);
    if (event.bubbles !== false) this.parentNode?.dispatchEvent(event);
  }
  // Model browsers where a pointer click does not automatically focus a button.
  click() { this.dispatchEvent({ type: 'click', detail: 1 }); }
  focus(options) { this.ownerDocument.activeElement = this; this.focusOptions = options; }
  contains(target) { for (let node = target; node; node = node.parentNode) if (node === this) return true; return false; }
  getBoundingClientRect() { return this.bounds; }
  closest(selector) {
    for (let node = this; node; node = node.parentNode) {
      const matches = selector.split(',').some(part => {
        const value = part.trim();
        const attribute = value.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);
        if (attribute) return attribute[2] ? node.attrs[attribute[1]] === attribute[2] : attribute[1] in node.attrs;
        return node.tagName.toLowerCase() === value;
      });
      if (matches) return node;
    }
    return null;
  }
}
function fixture(reduced = false, canvasAvailable = true) {
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) {
      const node = new Element(selector === '#game-button' ? 'BUTTON' : 'DIV');
      node.ownerDocument = document;
      node.parentNode = selector === '#game-arena' ? document.body : $('#game-arena');
      nodes.set(selector, node);
    }
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
  const document = Object.assign(new Element('DOCUMENT'), { hidden: false });
  document.documentElement = Object.assign(new Element('HTML'), { parentNode: document, ownerDocument: document });
  document.body = Object.assign(new Element('BODY'), { parentNode: document.documentElement, ownerDocument: document });
  document.activeElement = document.body;
  const canvasDraws = [];
  document.createElement = tag => {
    const node = Object.assign(new Element(tag.toUpperCase()), { ownerDocument: document });
    if (tag === 'canvas') node.getContext = () => canvasAvailable ? Object.fromEntries(
      ['setTransform', 'clearRect', 'save', 'translate', 'rotate', 'scale', 'fillRect', 'restore'].map(method => [method, (...args) => { if (method === 'fillRect') canvasDraws.push(args); }])
    ) : null;
    return node;
  };
  const window = Object.assign(new Element('WINDOW'), { innerWidth: 800, innerHeight: 900 });
  window.WP = { $, reducedMotion: reduced };
  const events = [];
  document.addEventListener('wp:game-complete', event => events.push(event.detail));
  vm.runInContext(source, vm.createContext({
    window, document, performance: { now: () => now },
    requestAnimationFrame: callback => { const id = ++frameId; scheduled.set(id, { callback, at: now + 16 }); return id; },
    cancelAnimationFrame: id => scheduled.delete(id),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  }));
  function keyAt(target, key, options = {}) {
    const event = { type: 'keydown', key, repeat: false, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...options };
    target.dispatchEvent(event);
    // Model the default button activation after an uncancelled key press.
    if (options.nativeDefault && !event.defaultPrevented && target === $('#game-button') && [' ', 'Enter'].includes(key)) target.click();
    return event.defaultPrevented;
  }
  return {
    $, document, window, events, advance, keyAt, canvasDraws,
    confetti: () => document.body.children.find(node => node.className === 'hit-confetti'),
    perfectBadge: () => $('#game-arena').children.find(node => node.className === 'hit-perfect-badge'),
    pendingFrames: () => scheduled.size,
    element: (tagName, attrs = {}, parent = $('#game-arena')) => Object.assign(new Element(tagName), { attrs, ownerDocument: document, parentNode: parent }),
    hit: () => $('#game-button').click(),
    state: () => $('#game-arena').dataset.state,
    key: (key, repeat = false) => keyAt($('#game-button'), key, { repeat, nativeDefault: true }),
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

test('an exact 999 creates a finite decorative celebration; 998 does not', () => {
  const game = fixture();
  game.hit(); game.advance(461.25); game.hit();
  assert.equal(game.events[0].score, 998);
  assert.equal(game.confetti(), undefined);
  assert.equal(game.perfectBadge().hidden, true);
  assert.equal(game.$('#game-arena').dataset.perfect, undefined);
  game.hit(); game.advance(450); game.hit();
  assert.equal(game.events[1].score, 999);
  assert.equal(game.confetti().getAttribute('aria-hidden'), 'true');
  assert.equal(game.$('#game-arena').dataset.perfect, 'true');
  assert.equal(game.perfectBadge().hidden, false);
  game.advance(600);
  assert.ok(game.canvasDraws.length > 0);
  game.advance(4300);
  assert.equal(game.confetti(), undefined);
  assert.equal(game.pendingFrames(), 0);
  assert.equal(game.perfectBadge().hidden, false, 'the result stays after the confetti finishes');
  assert.equal(game.events.length, 2, 'decorative randomness must not post scores');
});

test('replay removes the previous celebration and another perfect hit celebrates again', () => {
  const game = fixture();
  game.hit(); game.advance(450); game.hit();
  const firstCanvas = game.confetti();
  game.advance(120);
  game.hit();
  assert.equal(firstCanvas.parentNode, null);
  assert.equal(game.confetti(), undefined);
  assert.equal(game.perfectBadge().hidden, true);
  assert.equal(game.$('#game-arena').dataset.perfect, undefined);
  game.advance(450); game.hit();
  assert.ok(game.confetti());
  assert.notEqual(game.confetti(), firstCanvas);
  assert.equal(game.events.length, 2);
});

test('reduced-motion and unavailable canvas retain a static perfect result', () => {
  for (const reduced of [false, true]) {
    const game = fixture(reduced, false);
    game.hit(); game.advance(reduced ? 1000 : 450); game.hit();
    assert.equal(game.$('#game-score').textContent, '999');
    assert.equal(game.$('#game-arena').dataset.perfect, 'true');
    assert.equal(game.perfectBadge().hidden, false);
    assert.equal(game.confetti(), undefined);
    assert.equal(game.pendingFrames(), 0);
  }
  const reducedGame = fixture(true);
  reducedGame.hit(); reducedGame.advance(1000); reducedGame.hit();
  assert.equal(reducedGame.confetti(), undefined);
  assert.equal(reducedGame.pendingFrames(), 0);
});

test('leaving the page or changing motion preference cleans up active confetti', () => {
  for (const interruption of ['hide', 'blur', 'pagehide', 'resize', 'motion']) {
    const game = fixture();
    game.hit(); game.advance(450); game.hit();
    assert.ok(game.confetti());
    if (interruption === 'hide') game.hide();
    else if (interruption === 'motion') {
      game.window.WP.reducedMotion = true;
      game.document.dispatchEvent({ type: 'wp:motion' });
    } else game.window.dispatchEvent({ type: interruption });
    assert.equal(game.confetti(), undefined, interruption);
    assert.equal(game.pendingFrames(), 0, interruption);
    assert.equal(game.events.length, 1);
  }
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

test('a pointer-started attempt accepts Space or Enter without a second native activation', () => {
  for (const key of [' ', 'Enter']) {
    const game = fixture();
    game.hit();
    assert.equal(game.document.activeElement, game.$('#game-button'));
    assert.equal(game.$('#game-button').focusOptions.preventScroll, true);
    game.advance(450);
    assert.equal(game.keyAt(game.document.activeElement, key, { nativeDefault: true }), true);
    assert.equal(game.state(), 'complete');
    assert.equal(game.events.length, 1);
    assert.equal(game.events[0].score, 999);
    assert.equal(game.$('#game-button').focusOptions.preventScroll, true);
  }
});

test('Space or Enter still punches if a pointer-started game leaves focus on the page', () => {
  for (const key of [' ', 'Enter']) {
    const game = fixture();
    game.hit(); game.advance(450);
    game.document.activeElement = game.document.body;
    assert.equal(game.keyAt(game.document.body, key), true, 'default page scrolling must be cancelled');
    assert.equal(game.state(), 'complete');
    assert.equal(game.events[0].score, 999);
    assert.equal(game.document.activeElement, game.$('#game-button'));
  }
});

test('page shortcuts stay normal before play, outside the game, and when the game is offscreen', () => {
  const game = fixture();
  assert.equal(game.keyAt(game.document.body, ' '), false);
  assert.equal(game.state(), 'idle');
  game.hit();
  const outsideParagraph = game.element('P', {}, game.document.body);
  assert.equal(game.keyAt(outsideParagraph, ' '), false);
  game.$('#game-button').bounds.top = -200;
  game.$('#game-button').bounds.bottom = -20;
  assert.equal(game.keyAt(game.document.body, ' '), false);
  assert.equal(game.state(), 'aiming');
  assert.equal(game.events.length, 0);
});

test('editable elements and unrelated controls keep their keys even within the game area', () => {
  const game = fixture();
  game.hit(); game.advance(450);
  const controls = ['INPUT', 'TEXTAREA', 'SELECT', 'A', 'BUTTON', 'SUMMARY'].map(tag => game.element(tag));
  controls.push(game.element('DIV', { contenteditable: '' }));
  controls.push(game.element('DIV', { role: 'textbox' }));
  controls.push(game.element('DIV', { role: 'slider' }));
  controls.push(game.element('DIV', { tabindex: '0' }));
  const editableParent = game.element('DIV', { contenteditable: 'true' });
  controls.push(game.element('SPAN', {}, editableParent));
  controls.push(Object.assign(game.element('SPAN'), { isContentEditable: true }));
  for (const control of controls) {
    for (const key of [' ', 'Enter']) assert.equal(game.keyAt(control, key), false, control.tagName);
  }
  assert.equal(game.state(), 'aiming');
  assert.equal(game.events.length, 0);
});

test('modifiers, composition and already-handled keys cannot trigger game actions', () => {
  const game = fixture();
  game.hit(); game.advance(450);
  for (const option of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing']) {
    for (const key of [' ', 'Enter']) assert.equal(game.keyAt(game.$('#game-button'), key, { [option]: true }), false);
  }
  game.keyAt(game.$('#game-button'), ' ', { defaultPrevented: true });
  assert.equal(game.state(), 'aiming');
  assert.equal(game.events.length, 0);
});

test('a held page key cannot finish or restart attempts, and the game surface works once per press', () => {
  const game = fixture();
  const gameCaption = game.element('P');
  assert.equal(game.keyAt(gameCaption, ' '), true);
  game.advance(450);
  assert.equal(game.keyAt(game.document.body, ' ', { repeat: true }), true);
  assert.equal(game.state(), 'aiming');
  assert.equal(game.keyAt(gameCaption, 'Enter'), true);
  assert.equal(game.state(), 'complete');
  assert.equal(game.events.length, 1);
  assert.equal(game.key(' ', true), true);
  assert.equal(game.state(), 'complete');
});

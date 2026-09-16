import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../docs/assets/video.js', import.meta.url), 'utf8');
const settled = () => new Promise(resolve => setImmediate(resolve));
const closed = () => new Promise(resolve => setTimeout(resolve, 200));

class Element extends EventTarget {
  attributes = {};
  dataset = {};
  style = {};
  children = [];
  hidden = false;
  inert = false;
  textContent = '';
  innerHTML = '';
  parentElement = null;
  box = { left: 800, top: 100, bottom: 720, height: 620, width: 350 };
  constructor(tag = 'div', document) {
    super(); this.tagName = tag.toUpperCase(); this.document = document;
    const classes = new Set();
    this.classList = { add: (...items) => items.forEach(item => classes.add(item)), remove: (...items) => items.forEach(item => classes.delete(item)), contains: item => classes.has(item) };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  getBoundingClientRect() { return this.box; }
  animate(frames, options) {
    let finish, reject;
    const animation = { element: this, frames, options, cancelled: false,
      finished: new Promise((resolve, fail) => { finish = resolve; reject = fail; }),
      finish: () => finish(), cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
    this.document.animations.push(animation);
    if (!this.document.manualAnimations) queueMicrotask(animation.finish);
    return animation;
  }
  focus() {
    this.document.activeElement = this;
    const event = new Event('focusin');
    Object.defineProperty(event, 'target', { value: this });
    this.document.dispatchEvent(event);
  }
  click() { this.focus(); this.dispatchEvent(new Event('click')); }
  detach() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }
  append(...nodes) { for (const node of nodes) { node.detach(); this.children.push(node); node.parentElement = this; } }
  before(node) {
    node.detach();
    const parent = this.parentElement;
    parent.children.splice(parent.children.indexOf(this), 0, node); node.parentElement = parent;
  }
  replaceWith(node) {
    node.detach();
    const parent = this.parentElement;
    parent.children.splice(parent.children.indexOf(this), 1, node); node.parentElement = parent; this.parentElement = null;
  }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  querySelectorAll(selector) {
    const tags = selector.split(',').map(tag => tag.trim().toUpperCase());
    return this.children.flatMap(child => [...(tags.includes(child.tagName) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
}
function setup({ reducedMotion = false, saveData = false, deferPlay = false, manualAnimations = false } = {}) {
  const document = new Element();
  document.animations = [];
  document.manualAnimations = manualAnimations;
  const create = tag => new Element(tag, document);
  document.hidden = false;
  document.createElement = create;
  document.body = create('body');
  document.documentElement = create('html');
  const main = create('main');
  const alreadyInert = create('aside'); alreadyInert.inert = true;
  document.body.append(main, alreadyInert);
  const video = create('video');
  Object.assign(video, { paused: true, ended: false, muted: false, currentTime: 0, duration: 38.334, controls: true, playCount: 0 });
  let resolvePlay;
  video.play = function () {
    this.paused = false; this.playCount++; this.dispatchEvent(new Event('play'));
    return deferPlay ? new Promise(resolve => { resolvePlay = resolve; }) : Promise.resolve();
  };
  video.pause = function () { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')); } };
  const parts = { controls: create('div'), play: create('button'), mute: create('button'), seek: create('input'), fullscreen: create('button'), status: create('p') };
  const player = create('div');
  player.getBoundingClientRect = () => player.classList.contains('is-expanded')
    ? { left: 400, top: 20, bottom: 888, height: 868, width: 490 } : player.box;
  parts.controls.append(parts.seek, parts.play, parts.mute, parts.fullscreen);
  player.append(video, parts.controls, parts.status); main.append(player);
  player.querySelector = selector => selector === 'video' ? video : parts[selector.match(/data-video-(\w+)/)[1]];
  document.querySelectorAll = () => [player];
  const motion = create('div'); motion.matches = reducedMotion;
  const connection = create('div'); connection.saveData = saveData;
  const window = create('div'); window.innerHeight = 900; window.matchMedia = () => motion;
  let observer;
  class IntersectionObserver { constructor(callback) { observer = callback; } observe() {} }
  window.IntersectionObserver = IntersectionObserver;
  vm.runInNewContext(code, { document, window, navigator: { connection }, IntersectionObserver,
    getComputedStyle: () => ({ backgroundColor: 'rgba(5, 5, 8, 0.93)', backdropFilter: 'blur(14px)' }) });
  const overlay = document.body.children.at(-1);
  return { video, parts, player, document, motion, connection, main, alreadyInert, overlay, close: overlay.children[0],
    view: yes => observer([{ isIntersecting: yes, intersectionRatio: yes ? 0.8 : 0 }]),
    resolvePlay: () => resolvePlay?.() };
}
function key(document, name, shiftKey = false) {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperties(event, { key: { value: name }, shiftKey: { value: shiftKey } });
  document.dispatchEvent(event); return event;
}

test('muted autoplay starts in view and pauses offscreen, with labelled icon controls', async () => {
  const s = setup();
  assert.equal(s.video.playCount, 0);
  assert.equal(s.video.muted, true);
  assert.equal(s.video.defaultMuted, true);
  assert.equal(s.video.controls, false);
  assert.equal(s.parts.controls.hidden, false);
  s.view(true); await settled();
  assert.equal(s.video.playCount, 1);
  assert.equal(s.video.muted, true);
  assert.equal(s.parts.play.attributes['aria-label'], 'Pause video');
  assert.equal(s.parts.play.dataset.icon, 'pause');
  assert.match(s.parts.play.innerHTML, /aria-hidden="true"/);
  s.view(false); assert.equal(s.video.paused, true);
});

test('manual pause stays paused after leaving and returning', async () => {
  const s = setup(); s.view(true); await settled(); s.parts.play.click();
  assert.equal(s.video.paused, true);
  s.view(false); s.view(true); await settled(); assert.equal(s.video.playCount, 1);
  s.parts.play.click(); await settled(); assert.equal(s.video.playCount, 2);
});

test('reduced motion and data saver prevent autoplay but allow Play', async () => {
  for (const preferences of [{ reducedMotion: true }, { saveData: true }]) {
    const s = setup(preferences); s.view(true); await settled();
    assert.equal(s.video.playCount, 0);
    s.parts.play.click(); await settled(); assert.equal(s.video.playCount, 1);
  }
});

test('a delayed play cannot continue after scrolling away', async () => {
  const s = setup({ deferPlay: true }); s.view(true); s.view(false); s.resolvePlay(); await settled();
  assert.equal(s.video.paused, true);
});

test('seek and sound remain accessible without a visible timer', () => {
  const s = setup(); s.video.muted = true; s.parts.mute.click();
  assert.equal(s.video.muted, false); assert.equal(s.parts.mute.attributes['aria-label'], 'Mute video');
  assert.equal(s.parts.mute.dataset.icon, 'sound');
  s.parts.seek.value = '10'; s.parts.seek.dispatchEvent(new Event('input'));
  assert.equal(s.video.currentTime, 10); assert.equal(s.parts.seek.attributes['aria-valuetext'], '0:10 of 0:38');
});

test('unmute restarts at the beginning and plays audibly; muting never rewinds', async () => {
  const s = setup();
  s.video.currentTime = 24;
  s.parts.mute.click(); await settled();
  assert.equal(s.video.currentTime, 0);
  assert.equal(s.video.muted, false);
  assert.equal(s.video.paused, false);
  assert.equal(s.video.playCount, 1);
  s.video.currentTime = 12;
  s.parts.mute.click(); await settled();
  assert.equal(s.video.muted, true);
  assert.equal(s.video.currentTime, 12);
  assert.equal(s.video.playCount, 1);
});

test('scroll and visibility resumes retain chosen sound and playback position', async () => {
  const s = setup(); s.view(true); await settled();
  s.parts.mute.click(); await settled(); s.video.currentTime = 18;
  s.view(false); assert.equal(s.video.paused, true);
  s.view(true); await settled();
  assert.equal(s.video.muted, false); assert.equal(s.video.currentTime, 18);
  assert.equal(s.video.paused, false);
  s.document.hidden = true; s.document.dispatchEvent(new Event('visibilitychange'));
  s.document.hidden = false; s.document.dispatchEvent(new Event('visibilitychange')); await settled();
  assert.equal(s.video.muted, false); assert.equal(s.video.currentTime, 18);
  s.parts.mute.click(); s.video.currentTime = 21; s.view(false); s.view(true); await settled();
  assert.equal(s.video.muted, true); assert.equal(s.video.currentTime, 21);
});

test('fullscreen animates from the inline rectangle and reverses before restoring it', async () => {
  const s = setup({ manualAnimations: true });
  s.parts.fullscreen.click();
  const entrance = s.document.animations.slice();
  assert.equal(entrance.length, 3);
  assert.equal(entrance[0].element, s.player);
  assert.match(entrance[0].frames[0].transform, /^translate\(400px, 80px\) scale\(0\.714/);
  assert.equal(entrance[0].frames[1].transform, 'translate(0px, 0px) scale(1, 1)');
  assert.ok(entrance[0].options.duration >= 300);
  entrance.forEach(animation => animation.finish()); await settled();
  s.close.click();
  const exit = s.document.animations.slice(3);
  assert.equal(exit.length, 3);
  assert.equal(s.overlay.hidden, false);
  assert.equal(s.player.parentElement, s.overlay.children[1]);
  assert.match(exit[0].frames[1].transform, /^translate\(400px, 80px\) scale\(0\.714/);
  exit.forEach(animation => animation.finish()); await settled();
  assert.equal(s.overlay.hidden, true);
  assert.equal(s.player.parentElement, s.main);
  assert.equal(s.document.activeElement, s.parts.fullscreen);
});

test('Escape during entrance cancels the old animation and waits for the reverse', async () => {
  const s = setup({ manualAnimations: true }); s.parts.fullscreen.click();
  const entrance = s.document.animations.slice();
  key(s.document, 'Escape');
  assert.ok(entrance.every(animation => animation.cancelled));
  entrance.forEach(animation => animation.finish()); await settled();
  assert.equal(s.overlay.hidden, false);
  s.document.animations.slice(3).forEach(animation => animation.finish()); await settled();
  assert.equal(s.overlay.hidden, true);
});

test('fullscreen overlay works without the native fullscreen API and restores focus/background', async () => {
  const s = setup(); s.document.documentElement.style.overflow = 'clip';
  s.parts.fullscreen.click(); await settled();
  assert.equal(s.overlay.hidden, false); assert.equal(s.overlay.attributes.role, 'dialog');
  assert.equal(s.overlay.attributes['aria-modal'], 'true');
  assert.equal(s.main.inert, true); assert.equal(s.alreadyInert.inert, true);
  assert.equal(s.document.activeElement, s.close);
  assert.equal(s.parts.fullscreen.attributes['aria-label'], 'Exit fullscreen video');
  assert.equal(s.player.parentElement, s.overlay.children[1]);
  s.view(false); assert.equal(s.video.playCount, 0);
  key(s.document, 'Escape'); await closed();
  assert.equal(s.overlay.hidden, true); assert.equal(s.player.parentElement, s.main);
  assert.equal(s.document.activeElement, s.parts.fullscreen); assert.equal(s.main.inert, false);
  assert.equal(s.alreadyInert.inert, true); assert.equal(s.document.documentElement.style.overflow, 'clip');
});

test('fullscreen focus cycles both ways and cannot leave the modal', async () => {
  const s = setup(); s.parts.fullscreen.click(); await settled();
  assert.equal(key(s.document, 'Tab', true).defaultPrevented, true);
  assert.equal(s.document.activeElement, s.parts.fullscreen);
  assert.equal(key(s.document, 'Tab').defaultPrevented, true);
  assert.equal(s.document.activeElement, s.close);
  s.main.focus(); assert.equal(s.document.activeElement, s.close);
  s.close.click(); await closed();
});

test('overlay keeps playing state and user pause across expansion', async () => {
  const s = setup(); s.view(true); await settled(); s.parts.fullscreen.click(); await settled();
  s.view(false); assert.equal(s.video.paused, false);
  s.parts.play.click(); assert.equal(s.video.paused, true);
  s.close.click(); await closed(); s.view(false); s.view(true); await settled();
  assert.equal(s.video.paused, true);
});

test('reduced-motion close is immediate; ended video needs an explicit replay', async () => {
  const s = setup({ reducedMotion: true }); s.parts.fullscreen.click(); await settled();
  assert.equal(s.document.animations.length, 0);
  s.close.click(); assert.equal(s.overlay.hidden, true);
  s.video.ended = true; s.video.dispatchEvent(new Event('ended'));
  assert.equal(s.parts.play.attributes['aria-label'], 'Replay video');
  s.view(true); assert.equal(s.video.playCount, 0);
  s.parts.play.click(); await settled(); assert.equal(s.video.currentTime, 0); assert.equal(s.video.playCount, 1);
});

test('hidden pages pause and playback error restores native controls', async () => {
  const s = setup(); s.view(true); await settled();
  s.document.hidden = true; s.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(s.video.paused, true);
  s.video.dispatchEvent(new Event('error')); assert.equal(s.video.controls, true);
  assert.equal(s.parts.status.textContent, 'Video unavailable. Please try again later.');
});

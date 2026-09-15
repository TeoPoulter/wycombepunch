import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../docs/assets/video.js', import.meta.url), 'utf8');
const settled = () => new Promise(resolve => setImmediate(resolve));

class Element extends EventTarget {
  attributes = {};
  dataset = {};
  hidden = false;
  textContent = '';
  setAttribute(name, value) { this.attributes[name] = value; }
  click() { this.dispatchEvent(new Event('click')); }
}
function setup({ reducedMotion = false, saveData = false, deferPlay = false } = {}) {
  const video = new Element();
  Object.assign(video, { paused: true, ended: false, muted: false, currentTime: 0, duration: 38.334, controls: true, playCount: 0 });
  let resolvePlay;
  video.play = function () {
    this.paused = false;
    this.playCount++;
    this.dispatchEvent(new Event('play'));
    return deferPlay ? new Promise(resolve => { resolvePlay = resolve; }) : Promise.resolve();
  };
  video.pause = function () {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  };
  const parts = Object.fromEntries(['controls', 'play', 'mute', 'seek', 'time', 'fullscreen', 'status'].map(key => [key, new Element()]));
  const player = new Element();
  player.querySelector = selector => selector === 'video' ? video : parts[selector.match(/data-video-(\w+)/)[1]];
  player.requestFullscreen = async () => { document.fullscreenElement = player; document.dispatchEvent(new Event('fullscreenchange')); };
  const document = new Element();
  document.hidden = false;
  document.querySelectorAll = () => [player];
  document.exitFullscreen = async () => { document.fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); };
  const motion = new Element();
  motion.matches = reducedMotion;
  const connection = new Element();
  connection.saveData = saveData;
  const window = new Element();
  window.matchMedia = () => motion;
  let observer;
  class IntersectionObserver { constructor(callback) { observer = callback; } observe() {} }
  window.IntersectionObserver = IntersectionObserver;
  vm.runInNewContext(code, { document, window, navigator: { connection }, IntersectionObserver });
  return { video, parts, player, document, motion, connection,
    view: yes => observer([{ isIntersecting: yes, intersectionRatio: yes ? 0.8 : 0 }]),
    resolvePlay: () => resolvePlay?.() };
}

test('autoplay is muted, starts in view, and pauses off screen', async () => {
  const s = setup();
  assert.equal(s.video.playCount, 0);
  assert.equal(s.video.controls, false);
  assert.equal(s.parts.controls.hidden, false);
  s.view(true);
  await settled();
  assert.equal(s.video.playCount, 1);
  assert.equal(s.video.muted, true);
  assert.equal(s.parts.play.textContent, 'Pause');
  s.view(false);
  assert.equal(s.video.paused, true);
});

test('manual pause is remembered after leaving and returning', async () => {
  const s = setup();
  s.view(true);
  await settled();
  s.parts.play.click();
  assert.equal(s.video.paused, true);
  s.view(false);
  s.view(true);
  await settled();
  assert.equal(s.video.playCount, 1);
  s.parts.play.click();
  await settled();
  assert.equal(s.video.playCount, 2);
});

test('reduced motion and data saver prevent autoplay but allow Play', async () => {
  for (const preferences of [{ reducedMotion: true }, { saveData: true }]) {
    const s = setup(preferences);
    s.view(true);
    await settled();
    assert.equal(s.video.playCount, 0);
    s.parts.play.click();
    await settled();
    assert.equal(s.video.playCount, 1);
  }
});

test('a delayed play cannot continue after scrolling away', async () => {
  const s = setup({ deferPlay: true });
  s.view(true);
  s.view(false);
  s.resolvePlay();
  await settled();
  assert.equal(s.video.paused, true);
});

test('seek, sound, fullscreen and finished replay controls work', async () => {
  const s = setup();
  s.video.muted = true;
  s.parts.mute.click();
  assert.equal(s.video.muted, false);
  assert.equal(s.parts.mute.attributes['aria-label'], 'Mute video');
  s.parts.seek.value = '10';
  s.parts.seek.dispatchEvent(new Event('input'));
  assert.equal(s.video.currentTime, 10);
  assert.equal(s.parts.seek.attributes['aria-valuetext'], '0:10 of 0:38');
  s.parts.fullscreen.click();
  await settled();
  assert.equal(s.document.fullscreenElement, s.player);
  assert.equal(s.parts.fullscreen.textContent, 'Exit full screen');
  s.parts.fullscreen.click();
  await settled();
  assert.equal(s.document.fullscreenElement, null);
  s.video.ended = true;
  s.video.dispatchEvent(new Event('ended'));
  assert.equal(s.parts.play.textContent, 'Replay');
  s.view(true);
  assert.equal(s.video.playCount, 0);
  s.parts.play.click();
  await settled();
  assert.equal(s.video.currentTime, 0);
  assert.equal(s.video.playCount, 1);
});

test('hidden pages pause and a playback error restores native controls', async () => {
  const s = setup();
  s.view(true);
  await settled();
  s.document.hidden = true;
  s.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(s.video.paused, true);
  s.video.dispatchEvent(new Event('error'));
  assert.equal(s.video.controls, true);
  assert.match(s.parts.status.textContent, /unavailable/);
});

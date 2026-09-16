/* Hit 999: one button, one timed hit, one score. No random scoring or storage.
 * A configured daily-score adapter can listen for wp:game-complete.
 */
(() => {
  'use strict';
  const WP = window.WP;
  if (!WP) return;
  const { $ } = WP;
  const arena = $('#game-arena');
  if (!arena) return;
  const button = $('#game-button');
  const buttonLabel = $('#game-button-label');
  const scoreElement = $('#game-score');
  const feedback = $('#game-feedback');
  const marker = $('#meter-cursor');
  const gameVersion = '3';
  const halfCycleMs = 900;
  const maxAttemptMs = 8000;
  const bestByMode = { precision: 0, 'motion-free': 0 };
  let state = 'idle';
  let startedAt = 0;
  let frame = 0;
  let runId = '';
  let celebrationFrame = 0;
  let celebrationCanvas = null;
  const perfectBadge = document.createElement('p');
  perfectBadge.className = 'hit-perfect-badge';
  perfectBadge.textContent = 'Perfect hit';
  // The existing live feedback announces the result; this is visual emphasis.
  perfectBadge.setAttribute('aria-hidden', 'true');
  perfectBadge.hidden = true;
  feedback.before(perfectBadge);
  const mode = () => WP.reducedMotion ? 'motion-free' : 'precision';
  const clamp = value => Math.max(0, Math.min(1, value));

  function stopCelebration(clearResult = false) {
    cancelAnimationFrame(celebrationFrame);
    celebrationFrame = 0;
    celebrationCanvas?.remove();
    celebrationCanvas = null;
    if (clearResult) {
      delete arena.dataset.perfect;
      perfectBadge.hidden = true;
    }
  }
  function celebratePerfect() {
    stopCelebration();
    arena.dataset.perfect = 'true';
    perfectBadge.hidden = false;
    if (WP.reducedMotion || document.hidden) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hit-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    // The winning treatment remains if a browser cannot create a canvas.
    if (!context) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    document.body.append(canvas);
    celebrationCanvas = canvas;

    const colours = ['#ff2848', '#f5f3ef', '#e2bc70'];
    const started = performance.now();
    const particleCount = width < 600 ? 170 : 250;
    const particles = Array.from({ length: particleCount }, (_, i) => {
      const fromLeft = i % 2 === 0;
      // Two broad corner bursts, followed by a smaller second volley. Random
      // variation is decorative only and never contributes to a game score.
      return {
        x: fromLeft ? width * .08 : width * .92,
        y: height * .82,
        vx: (fromLeft ? 1 : -1) * (width * .12 + Math.random() * width * .34),
        vy: -(height * .7 + Math.random() * height * .55),
        delay: i >= particleCount * .7 ? .32 + Math.random() * .2 : Math.random() * .18,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - .5) * 9,
        size: 5 + Math.random() * 5,
        colour: colours[i % colours.length],
        ribbon: i % 6 === 0
      };
    });
    function draw(now) {
      if (WP.reducedMotion || document.hidden || celebrationCanvas !== canvas) {
        stopCelebration();
        return;
      }
      const elapsed = (now - started) / 1000;
      // One finite celebration. No loops, flashing, input blocking or timers
      // left behind after replay/navigation.
      if (elapsed >= 4.8) { stopCelebration(); return; }
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        const age = elapsed - particle.delay;
        if (age < 0) continue;
        const drag = (1 - Math.exp(-age * .65)) / .65;
        const x = particle.x + particle.vx * drag + Math.sin(age * 3 + particle.angle) * 12;
        const y = particle.y + particle.vy * age + height * .27 * age * age;
        if (y > height + 30) continue;
        context.save();
        context.globalAlpha = Math.min(1, (4.8 - elapsed) / .8);
        context.translate(x, y);
        context.rotate(particle.angle + particle.spin * age);
        context.scale(1, .3 + Math.abs(Math.cos(age * 6 + particle.angle)) * .7);
        context.fillStyle = particle.colour;
        context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * (particle.ribbon ? 2.7 : .65));
        context.restore();
      }
      celebrationFrame = requestAnimationFrame(draw);
    }
    celebrationFrame = requestAnimationFrame(draw);
  }

  function scoreForPosition(position) {
    if (!Number.isFinite(position)) return 0;
    // The narrow centre zone is a real, attainable 999. Beyond it, accuracy
    // falls smoothly to zero at either end; early and late hits score equally.
    const distance = Math.abs(clamp(position) - .5);
    return Math.round(999 * clamp(1 - Math.max(0, distance - .012) / .488));
  }
  function scoreForElapsed(elapsedMs) {
    return scoreForPosition(elapsedMs / 2000);
  }
  function positionAt(elapsedMs) {
    if (!Number.isFinite(elapsedMs)) return 0;
    const progress = (Math.max(0, elapsedMs) / halfCycleMs) % 2;
    return progress <= 1 ? progress : 2 - progress;
  }
  window.WP_GAME_MATH = Object.freeze({ scoreForPosition, scoreForElapsed, positionAt });

  function setState(next) {
    state = next;
    arena.dataset.state = next;
  }
  function stopClock() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function showMode() {
    $('#timing-meter').hidden = WP.reducedMotion;
    $('#meter-hint').hidden = WP.reducedMotion;
    $('#reduced-game-instructions').hidden = !WP.reducedMotion;
    $('#game-instructions').textContent = WP.reducedMotion
      ? 'Start. Count one second. Punch.'
      : 'Start. Watch the line. Hit the centre.';
    $('#session-best').textContent = String(bestByMode[mode()]).padStart(3, '0');
  }
  function reset(message) {
    stopClock();
    stopCelebration(true);
    setState('idle');
    runId = '';
    marker.style.left = '0%';
    buttonLabel.textContent = 'Start';
    button.setAttribute('aria-label', 'Start your attempt');
    scoreElement.textContent = '000';
    feedback.textContent = message || 'How close can you get?';
    showMode();
  }
  function interrupt() {
    stopCelebration();
    if (state !== 'aiming') return;
    reset('Ready when you are. Tap Start for a fresh attempt.');
  }
  function animate(now) {
    if (state !== 'aiming') return;
    const elapsed = now - startedAt;
    if (elapsed >= maxAttemptMs) {
      reset('Missed that one. Tap Start and have another go.');
      return;
    }
    if (!WP.reducedMotion) marker.style.left = `${positionAt(elapsed) * 100}%`;
    frame = requestAnimationFrame(animate);
  }
  function startAttempt() {
    if (document.hidden) return;
    stopClock();
    stopCelebration(true);
    runId = window.crypto?.randomUUID?.() || `hit-${Date.now()}-${performance.now()}`;
    startedAt = performance.now();
    setState('aiming');
    scoreElement.textContent = '000';
    marker.style.left = '0%';
    buttonLabel.textContent = 'Punch';
    button.setAttribute('aria-label', WP.reducedMotion ? 'Punch at one second' : 'Punch when the line reaches the centre');
    feedback.textContent = WP.reducedMotion ? 'Count one second…' : 'Hit the centre.';
    frame = requestAnimationFrame(animate);
  }
  function finishAttempt() {
    if (state !== 'aiming') return;
    if (document.hidden) { interrupt(); return; }
    const elapsed = performance.now() - startedAt;
    if (elapsed >= maxAttemptMs) { reset('Missed that one. Tap Start and have another go.'); return; }
    stopClock();
    const position = positionAt(elapsed);
    marker.style.left = `${position * 100}%`;
    const score = WP.reducedMotion ? scoreForElapsed(elapsed) : scoreForPosition(position);
    const previousBest = bestByMode[mode()];
    bestByMode[mode()] = Math.max(previousBest, score);
    scoreElement.textContent = String(score).padStart(3, '0');
    $('#session-best').textContent = String(bestByMode[mode()]).padStart(3, '0');
    setState('complete');
    buttonLabel.textContent = 'Go again';
    button.setAttribute('aria-label', 'Start another attempt');
    const reaction = score === 999 ? 'Perfect. Can you do it again?'
      : score >= 950 ? 'So close. One more go?'
      : score >= 800 ? 'Nearly there. Try again.'
      : 'Try again. You can do better.';
    feedback.textContent = `${reaction}${score > previousBest && previousBest > 0 ? ' New best this visit.' : ''}`;
    if (score === 999) celebratePerfect();
    document.dispatchEvent(new CustomEvent('wp:game-complete', { detail: Object.freeze({
      runId, score, mode: mode(), version: gameVersion
    }) }));
  }
  function act() {
    if (state === 'aiming') finishAttempt();
    else startAttempt();
  }
  button.addEventListener('click', () => {
    // Some browsers do not focus buttons after a mouse/touch click. Keep mixed
    // pointer/keyboard play working without moving the page to the button.
    button.focus({ preventScroll: true });
    act();
  });
  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key) || event.defaultPrevented ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        event.isComposing || document.hidden || button.disabled) return;
    const target = event.target;
    const fromButton = target === button || button.contains(target);
    const control = target?.closest?.('a, button, input, textarea, select, summary, [contenteditable], [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="slider"], [role="spinbutton"], [tabindex]');
    if (!fromButton && (target?.isContentEditable || control)) return;
    const fromArena = arena.contains(target);
    const bounds = button.getBoundingClientRect();
    const buttonVisible = bounds.width > 0 && bounds.height > 0 &&
      bounds.bottom > 0 && bounds.top < window.innerHeight &&
      bounds.right > 0 && bounds.left < window.innerWidth;
    // If a pointer-started attempt leaves focus on the page, accept its next
    // punch while the game is visible. Ordinary page keys remain untouched.
    const fromActivePage = state === 'aiming' && buttonVisible &&
      (target === document.body || target === document.documentElement);
    if (!fromButton && !fromArena && !fromActivePage) return;
    // One document handler handles both routes. Cancel the browser's scroll /
    // synthetic button click, and never let a held key play another attempt.
    event.preventDefault();
    if (!event.repeat) {
      button.focus({ preventScroll: true });
      act();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
  document.addEventListener('wp:motion', () => reset('Ready. The timing mode has changed.'));
  window.addEventListener('blur', interrupt);
  window.addEventListener('pagehide', interrupt);
  window.addEventListener('resize', () => stopCelebration());
  reset();
  button.disabled = false;
})();

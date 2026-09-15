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
  const mode = () => WP.reducedMotion ? 'motion-free' : 'precision';
  const clamp = value => Math.max(0, Math.min(1, value));

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
    document.dispatchEvent(new CustomEvent('wp:game-complete', { detail: Object.freeze({
      runId, score, mode: mode(), version: gameVersion
    }) }));
  }
  function act() {
    if (state === 'aiming') finishAttempt();
    else startAttempt();
  }
  button.addEventListener('click', act);
  button.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    // Handle press rather than release, and suppress the native extra click.
    event.preventDefault();
    if (!event.repeat) act();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
  document.addEventListener('wp:motion', () => reset('Ready. The timing mode has changed.'));
  window.addEventListener('blur', interrupt);
  window.addEventListener('pagehide', interrupt);
  reset();
  button.disabled = false;
})();

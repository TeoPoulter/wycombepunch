/* Three-hit timing arcade. Every hit contributes to one score out of 999.
 * Scores stay in page memory. A separate, explicitly configured leaderboard
 * adapter may listen for wp:game-complete; this file makes no network requests.
 */
(() => {
  'use strict';
  const WP = window.WP;
  if (!WP) return;
  const { $, $$, toast, countTo, hitMachine, clearMachine } = WP;
  const arena = $('#game-arena');
  if (!arena) return;
  const mainButton = $('#game-button');
  const buttonLabel = $('#game-button-label');
  const scoreElement = $('#game-score');
  const feedback = $('#game-feedback');
  const marker = $('#meter-cursor');
  const cabinet = $('[data-machine-svg]', $('[data-game-machine-stage]'));
  const result = $('#game-result');
  const hitNames = ['Jab', 'Cross', 'Hook'];
  const halfCycles = [1100, 920, 760];
  const maxHitMs = 8000;
  const nextHitDelayMs = 1100;
  const gameVersion = '2';
  let state = 'idle';
  let scores = [];
  let sessionBest = 0;
  let combo = 0;
  let bestCombo = 0;
  let start = 0;
  let frame = 0;
  let nextHitTimer = 0;
  let runId = '';

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function scoreForPosition(position) {
    if (!Number.isFinite(position)) return 0;
    const distance = Math.abs(clamp(position, 0, 1) - .5);
    // A small, attainable bullseye; precision outside it falls off smoothly.
    const accuracy = clamp(1 - Math.max(0, distance - .01) / .49, 0, 1);
    return Math.round(333 * accuracy);
  }
  function scoreForElapsed(elapsedMs) {
    return scoreForPosition(elapsedMs / 2000);
  }
  function positionAt(elapsedMs, hitIndex) {
    const index = clamp(Math.trunc(hitIndex) || 0, 0, 2);
    const t = (Math.max(0, elapsedMs) / halfCycles[index]) % 2;
    const position = t <= 1 ? t : 2 - t;
    return index % 2 === 0 ? position : 1 - position;
  }
  function runScore(hits) {
    return hits.slice(0, 3).reduce((total, score) => total + clamp(Math.round(Number(score) || 0), 0, 333), 0);
  }
  window.WP_GAME_MATH = Object.freeze({ scoreForPosition, scoreForElapsed, positionAt, runScore });

  function setState(value) {
    state = value;
    arena.dataset.state = value;
  }
  function stopTimers() {
    cancelAnimationFrame(frame);
    clearTimeout(nextHitTimer);
    frame = 0;
    nextHitTimer = 0;
  }
  function setAction(label, locked = false) {
    buttonLabel.textContent = label;
    // Retain keyboard focus between linked hits while ignoring extra presses.
    mainButton.setAttribute('aria-disabled', String(locked));
  }
  function updateRoundDisplay() {
    $$('.round-cell').forEach((cell, index) => {
      cell.classList.toggle('current', index === scores.length && scores.length < 3);
      cell.classList.toggle('done', scores[index] !== undefined);
      cell.dataset.quality = scores[index] === 333 ? 'perfect' : scores[index] >= 300 ? 'sharp' : '';
      $('[data-round-score]', cell).textContent = scores[index] === undefined ? '—' : String(scores[index]).padStart(3, '0');
      cell.setAttribute('aria-label', `${hitNames[index]}: ${scores[index] === undefined ? 'not played' : `${scores[index]} out of 333`}`);
    });
    $('#round-indicator').textContent = scores.length < 3 ? `${hitNames[scores.length].toUpperCase()} · ${scores.length + 1} / 3` : 'RUN COMPLETE';
    const comboLabel = $('#game-combo');
    if (comboLabel) comboLabel.textContent = combo > 1 ? `${combo} HIT COMBO` : combo === 1 ? 'SHARP HIT' : 'BUILD YOUR COMBO';
    const progress = $('#game-progress');
    if (progress) progress.textContent = `${scores.length} of 3 hits · ${runScore(scores)} / 999`;
    arena.dataset.combo = String(combo);
  }
  function showMode() {
    const reduced = WP.reducedMotion;
    $('#game-mode-label').textContent = reduced ? 'ONE-SECOND MODE' : 'THREE-HIT COMBO';
    $('#timing-meter').hidden = reduced;
    $('.meter-axis').hidden = reduced;
    $('.timing-labels > span:first-child').textContent = reduced ? 'COUNT ONE SECOND' : 'HIT THE CENTRE';
    $('#reduced-game-instructions').hidden = !reduced;
  }
  function resetSet(message) {
    stopTimers();
    scores = [];
    combo = 0;
    bestCombo = 0;
    runId = '';
    setState('idle');
    countTo(scoreElement, 0, cabinet, 0);
    clearMachine(cabinet);
    marker.style.left = '0%';
    setAction('Start your run');
    mainButton.classList.remove('is-aiming');
    feedback.textContent = message || (WP.reducedMotion ? 'Three hits. Start each one, count a second, then punch. Every hit adds to your total.' : 'Jab. Cross. Hook. Land three centre hits as the pace rises. Every hit counts.');
    result.hidden = true;
    $('#score-share-fallback').hidden = true;
    updateRoundDisplay();
    showMode();
  }
  function pauseRun(reason) {
    if (state !== 'aiming' && state !== 'scored') return;
    stopTimers();
    setState('paused');
    mainButton.classList.remove('is-aiming');
    setAction(`Resume · ${hitNames[scores.length]}`);
    feedback.textContent = reason;
  }
  function animate(now) {
    if (state !== 'aiming') return;
    const elapsed = now - start;
    if (elapsed >= maxHitMs) { finishHit(true); return; }
    if (!WP.reducedMotion) marker.style.left = `${positionAt(elapsed, scores.length) * 100}%`;
    frame = requestAnimationFrame(animate);
  }
  function startHit() {
    if (document.hidden) return;
    stopTimers();
    if (scores.length >= 3) resetSet();
    if (!runId) runId = window.crypto?.randomUUID?.() || `run-${Date.now()}-${performance.now()}`;
    result.hidden = true;
    setState('aiming');
    start = performance.now();
    marker.style.left = `${positionAt(0, scores.length) * 100}%`;
    setAction(WP.reducedMotion ? `${hitNames[scores.length]} · punch at 1 second` : `${hitNames[scores.length]} · punch!`);
    mainButton.classList.add('is-aiming');
    feedback.textContent = WP.reducedMotion ? `Count one second, then punch. ${333 * (3 - scores.length)} points still to play for.` : scores.length === 0 ? 'Hit the bright centre line. The next two hits follow automatically.' : `${hitNames[scores.length]} is faster. Aim for the centre${combo ? ' and keep your combo going' : ''}.`;
    updateRoundDisplay();
    frame = requestAnimationFrame(animate);
  }
  function finishHit(timedOut = false) {
    if (state !== 'aiming') return;
    if (document.hidden) { pauseRun('Paused while you were away. Your completed hits are saved; resume when you’re ready.'); return; }
    const elapsed = performance.now() - start;
    stopTimers();
    const hitIndex = scores.length;
    const position = positionAt(elapsed, hitIndex);
    if (!WP.reducedMotion) marker.style.left = `${position * 100}%`;
    const score = timedOut ? 0 : WP.reducedMotion ? scoreForElapsed(elapsed) : scoreForPosition(position);
    scores.push(score);
    combo = score >= 300 ? combo + 1 : 0;
    bestCombo = Math.max(bestCombo, combo);
    const total = runScore(scores);
    countTo(scoreElement, total, cabinet, 350);
    if (!timedOut) hitMachine(cabinet);
    mainButton.classList.remove('is-aiming');
    updateRoundDisplay();
    const grade = score === 333 ? 'Bullseye!' : score >= 300 ? 'Sharp hit!' : score >= 250 ? 'Clean hit.' : score >= 160 ? 'A glancing hit.' : 'Off centre — find your rhythm.';
    const hitFeedback = timedOut ? `${hitNames[hitIndex]} timed out. +0.` : `${grade} +${score}${combo > 1 ? ` · ${combo}-hit combo!` : '.'}`;
    if (scores.length === 3) {
      setState('complete');
      const previousBest = sessionBest;
      sessionBest = Math.max(sessionBest, total);
      $('#session-best').textContent = String(sessionBest).padStart(3, '0');
      feedback.textContent = `${hitFeedback} ${total} / 999.${total > previousBest && previousBest > 0 ? ' New best this visit!' : ''}`;
      setAction('Beat that · play again');
      $('#final-score').textContent = String(total).padStart(3, '0');
      $('#final-message').textContent = total === 999 ? 'Three bullseyes. A perfect run. Can you do it twice?' : total >= 900 ? `That’s sharp. Just ${999 - total} points from a perfect run.` : total >= 700 ? 'You’ve found your rhythm. Now put three sharp hits together.' : 'One more go. Watch the centre, trust your timing, and make every hit count.';
      result.hidden = false;
      // An adapter can submit this completed run only after a backend is configured.
      document.dispatchEvent(new CustomEvent('wp:game-complete', { detail: Object.freeze({
        runId, score: total, hitScores: Object.freeze([...scores]), bestCombo,
        mode: WP.reducedMotion ? 'motion-free' : 'precision', version: gameVersion
      }) }));
    } else {
      setState('scored');
      if (WP.reducedMotion) {
        feedback.textContent = `${hitFeedback} ${total} / 999 so far. Start ${hitNames[scores.length].toLowerCase()} when ready.`;
        setAction(`Start ${hitNames[scores.length].toLowerCase()}`);
      } else {
        feedback.textContent = `${hitFeedback} ${hitNames[scores.length]} is next. Get ready…`;
        setAction(`${hitNames[scores.length]} coming up…`, true);
        nextHitTimer = setTimeout(startHit, nextHitDelayMs);
      }
    }
  }
  mainButton.addEventListener('click', () => {
    if (mainButton.getAttribute('aria-disabled') === 'true') return;
    if (state === 'aiming') finishHit();
    else startHit();
  });
  mainButton.addEventListener('keydown', event => {
    if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault();
  });
  $('#game-reset').addEventListener('click', () => {
    resetSet('Fresh run. Your best completed score this visit is kept.');
    mainButton.focus({ preventScroll: true });
  });
  $('#play-again').addEventListener('click', () => {
    resetSet();
    mainButton.scrollIntoView({ behavior: WP.reducedMotion ? 'auto' : 'smooth', block: 'center' });
    mainButton.focus({ preventScroll: true });
  });
  $('#share-score').addEventListener('click', async () => {
    if (scores.length !== 3) return;
    const text = `Jab. Cross. Hook. I scored ${runScore(scores)}/999 on Wycombe Punch. Three hits — can you beat it? https://wycombepunch.com/play.html`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast('Score copied. Your move — challenge someone.');
    } catch (_) {
      const fallback = $('#score-share-fallback');
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      toast('Select and copy your score message below.');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseRun('Paused while you were away. Your completed hits are saved; resume when you’re ready.');
  });
  document.addEventListener('wp:motion', () => {
    resetSet(WP.reducedMotion ? 'One-second mode. Start each hit, count one second, then punch.' : 'Three-hit combo mode. Hit the centre as the pace rises.');
  });
  window.addEventListener('pagehide', () => pauseRun('Your run is paused. Resume when you’re ready.'));
  resetSet();
  mainButton.disabled = false;
  $('#game-reset').disabled = false;
})();

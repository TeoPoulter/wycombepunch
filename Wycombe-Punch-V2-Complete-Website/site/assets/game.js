/* THE 999 CHALLENGE — free, local, timing-based play.
 * No gambling, payment, audio, telemetry, accounts or public leaderboard.
 * Round scores live in page memory only. Only a requested score-copy writes to clipboard.
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
  let state = 'idle';
  let scores = [];
  let sessionBest = 0;
  let start = 0;
  let frame = 0;
  const maxRoundMs = 12000;
  const halfCycles = [1450, 1200, 1000];

  // Pure scoring helpers are exported for local tests; no data is transmitted.
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function scoreForPosition(position) { return clamp(Math.round(999 * (1 - Math.abs(clamp(position,0,1) - .5) * 2)),0,999); }
  function scoreForElapsed(elapsedMs) { return clamp(Math.round(999 * (1 - Math.abs(elapsedMs - 1000) / 1000)),0,999); }
  function positionAt(elapsedMs, roundIndex) {
    const t = (Math.max(0,elapsedMs) / halfCycles[clamp(roundIndex,0,2)]) % 2;
    return t <= 1 ? t : 2-t;
  }
  window.WP_GAME_MATH = Object.freeze({ scoreForPosition, scoreForElapsed, positionAt });
  function setState(value) { state = value; arena.dataset.state = value; }
  function stopFrame() { cancelAnimationFrame(frame); frame = 0; }
  function updateRoundDisplay() {
    $$('.round-cell').forEach((cell,i) => {
      cell.classList.toggle('current', i === scores.length && scores.length < 3);
      cell.classList.toggle('done', scores[i] !== undefined);
      $('[data-round-score]',cell).textContent = scores[i] === undefined ? '—' : String(scores[i]).padStart(3,'0');
    });
    $('#round-indicator').textContent = scores.length < 3 ? `ROUND ${scores.length+1} / 3` : 'SET COMPLETE';
  }
  function showMode() {
    const reduced = WP.reducedMotion;
    $('#game-mode-label').textContent = reduced ? 'MOTION-FREE MODE' : 'PRECISION MODE';
    $('#timing-meter').hidden = reduced;
    $('.meter-axis').hidden = reduced;
    $('.timing-labels > span:first-child').textContent = reduced ? 'AIM FOR EXACTLY ONE SECOND' : 'STOP AT THE CENTRE';
    $('#reduced-game-instructions').hidden = !reduced;
  }
  function resetSet(message) {
    stopFrame();
    scores = [];
    setState('idle');
    countTo(scoreElement,0,cabinet,0);
    clearMachine(cabinet);
    marker.style.left = '0%';
    buttonLabel.textContent = 'Start round 1';
    mainButton.classList.remove('is-aiming');
    feedback.textContent = message || (WP.reducedMotion ? 'Motion-free timing: start, count one second, then stop. No moving meter.' : 'Ready? Start the meter, then stop it as close to the centre as you can.');
    result.hidden = true;
    $('#score-share-fallback').hidden = true;
    updateRoundDisplay();
    showMode();
  }
  function pauseRound(reason) {
    if (state !== 'aiming') return;
    stopFrame();
    setState('paused');
    mainButton.classList.remove('is-aiming');
    buttonLabel.textContent = `Restart round ${scores.length+1}`;
    feedback.textContent = reason;
  }
  function animate(now) {
    if (state !== 'aiming') return;
    const elapsed = now - start;
    if (elapsed >= maxRoundMs) { finishRound(true); return; }
    if (!WP.reducedMotion) marker.style.left = `${positionAt(elapsed,scores.length)*100}%`;
    frame = requestAnimationFrame(animate);
  }
  function startRound() {
    if (scores.length >= 3) resetSet();
    result.hidden = true;
    setState('aiming');
    start = performance.now();
    countTo(scoreElement,0,cabinet,0);
    marker.style.left = '0%';
    buttonLabel.textContent = WP.reducedMotion ? 'Stop after one second' : 'Stop the marker';
    mainButton.classList.add('is-aiming');
    feedback.textContent = WP.reducedMotion ? 'Count one second from pressing Start. Press Stop when you think it has passed.' : 'Aim for the centre line. The closer you stop, the higher your score.';
    updateRoundDisplay();
    frame = requestAnimationFrame(animate);
  }
  function finishRound(timedOut = false) {
    if (state !== 'aiming') return;
    const elapsed = performance.now() - start;
    stopFrame();
    const position = positionAt(elapsed,scores.length);
    if (!WP.reducedMotion) marker.style.left = `${position*100}%`;
    const score = timedOut ? 0 : WP.reducedMotion ? scoreForElapsed(elapsed) : scoreForPosition(position);
    scores.push(score);
    sessionBest = Math.max(sessionBest, score);
    $('#session-best').textContent = String(sessionBest).padStart(3,'0');
    countTo(scoreElement,score,cabinet,650);
    hitMachine(cabinet);
    mainButton.classList.remove('is-aiming');
    updateRoundDisplay();
    const praise = score === 999 ? 'Perfect timing. 999!' : score >= 950 ? 'Pinpoint timing. A brilliant score.' : score >= 850 ? 'A score worth chasing.' : score >= 600 ? 'A solid start. The centre is the key.' : 'Finding your rhythm? Give the timing another go.';
    const prefix = timedOut ? 'Time’s up: 0 points for this round.' : `${score} out of 999. ${praise}`;
    if (scores.length === 3) {
      setState('complete');
      const best = Math.max(...scores);
      feedback.textContent = `${prefix} Set complete. Your best round was ${best}.`;
      buttonLabel.textContent = 'Play another set';
      $('#final-score').textContent = String(best).padStart(3,'0');
      $('#final-message').textContent = best >= 950 ? 'Precision like that deserves a friendly rematch.' : best >= 750 ? 'That’s your score to beat. Who’s taking the next turn?' : 'Three rounds down. A fresh set is another chance to improve.';
      result.hidden = false;
    } else {
      setState('scored');
      feedback.textContent = `${prefix} Ready for round ${scores.length+1}?`;
      buttonLabel.textContent = `Start round ${scores.length+1}`;
    }
  }
  mainButton.addEventListener('click', () => {
    if (state === 'aiming') finishRound();
    else startRound();
  });
  mainButton.addEventListener('keydown', event => {
    if (event.repeat && ['Enter',' '].includes(event.key)) event.preventDefault();
  });
  $('#game-reset').addEventListener('click', () => { resetSet('Fresh set. Your best score this visit is kept.'); mainButton.focus({ preventScroll:true }); });
  $('#play-again').addEventListener('click', () => {
    resetSet();
    mainButton.scrollIntoView({ behavior: WP.reducedMotion ? 'auto' : 'smooth', block:'center' });
    mainButton.focus({ preventScroll:true });
  });
  $('#share-score').addEventListener('click', async () => {
    if (scores.length !== 3) return;
    const best = Math.max(...scores);
    const text = `I scored ${best}/999 on the free Wycombe Punch timing challenge. Can you beat it? https://wycombepunch.com/play.html`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast('Score copied. Share it wherever you choose.');
    } catch (_) {
      const fallback = $('#score-share-fallback');
      fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select();
      toast('Select and copy your score message below.');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseRound('Round paused while you were away. Restart when you’re ready; no attempt has been used.');
  });
  document.addEventListener('wp:motion', () => {
    resetSet(WP.reducedMotion ? 'Motion-free mode selected. Start, count one second, then stop.' : 'Precision mode selected. Start the marker and stop at the centre.');
  });
  window.addEventListener('pagehide', stopFrame);
  resetSet();
  mainButton.disabled = false;
  $('#game-reset').disabled = false;
})();

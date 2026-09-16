/* Optional shared daily record. A blank endpoint leaves the feature hidden.
 * No names, cookies or browser storage. The server decides the UK calendar day.
 */
(() => {
  'use strict';
  const panel = document.querySelector('[data-daily-score]');
  const endpointSetting = window.WP_CONFIG?.dailyScore?.endpoint?.trim();
  if (!panel || !endpointSetting) return;
  const value = panel.querySelector('[data-daily-score-value]');
  const status = panel.querySelector('[data-daily-score-status]');
  if (!value || !status) return;
  let endpoint;
  try {
    endpoint = new URL(endpointSetting);
    const localDevelopment = ['localhost', '127.0.0.1'].includes(location.hostname) &&
      ['localhost', '127.0.0.1'].includes(endpoint.hostname);
    if (endpoint.protocol !== 'https:' && !(localDevelopment && endpoint.protocol === 'http:')) return;
    if (endpoint.username || endpoint.password) return;
  } catch (_) { return; }

  const version = '3';
  const currentMode = () => window.WP?.reducedMotion ? 'motion-free' : 'precision';
  let revision = 0;
  let resetTimer;
  let lastRequestAt = 0;
  // Server-confirmed maxima only, kept separate by mode and UK day.
  const confirmedByMode = new Map();
  panel.hidden = false;

  function unavailable() {
    value.textContent = '—';
    status.textContent = 'Daily high score unavailable. You can still play.';
    panel.dataset.state = 'unavailable';
  }

  function validRun(run) {
    return run?.version === version && ['precision', 'motion-free'].includes(run.mode) &&
      Number.isInteger(run.score) && run.score >= 0 && run.score <= 999;
  }

  async function refresh(run) {
    const requestRevision = ++revision;
    const mode = run?.mode || currentMode();
    clearTimeout(resetTimer);
    lastRequestAt = Date.now();
    value.textContent = '—';
    status.textContent = run ? 'Updating today’s high score…' : 'Loading today’s high score…';
    panel.dataset.state = 'loading';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL(endpoint);
      url.searchParams.set('version', version);
      url.searchParams.set('mode', mode);
      const response = await fetch(url, {
        method: run ? 'POST' : 'GET',
        mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
        signal: controller.signal,
        ...(run ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version, mode, score: run.score })
        } : {})
      });
      if (!response.ok) throw new Error('Daily score unavailable');
      const record = await response.json();
      const resetAt = Date.parse(record.resetAt);
      if (record.version !== version || record.mode !== mode || record.timeZone !== 'Europe/London' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(record.day) || !Number.isFinite(resetAt) ||
          resetAt <= Date.now() || resetAt > Date.now() + 26 * 3600000 ||
          !(record.highScore === null || (Number.isInteger(record.highScore) && record.highScore >= 0 && record.highScore <= 999)) ||
          (run && (record.highScore === null || record.highScore < run.score))) {
        throw new Error('Invalid daily score response');
      }
      const previous = confirmedByMode.get(mode);
      if (previous && record.day < previous.day) return;
      const highScore = previous?.day === record.day && previous.highScore !== null
        ? Math.max(previous.highScore, record.highScore ?? 0) : record.highScore;
      confirmedByMode.set(mode, { day: record.day, highScore });
      if (mode !== currentMode()) return;
      value.textContent = highScore === null ? '—' : String(highScore).padStart(3, '0');
      const modeLabel = mode === 'motion-free' ? 'Motion-free mode' : 'Precision mode';
      status.textContent = highScore === null
        ? `Be the first today. ${modeLabel} · resets at midnight UK time.`
        : `${run && requestRevision === revision ? 'Your score is in. ' : ''}Across all players · ${modeLabel} · resets at midnight UK time.`;
      panel.dataset.state = 'ready';
      // Refresh automatically at the server's next UK midnight, including DST.
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => refresh(), Math.max(1000, resetAt - Date.now() + 250));
    } catch (_) {
      if (requestRevision === revision && mode === currentMode()) unavailable();
    } finally { clearTimeout(timeout); }
  }

  document.addEventListener('wp:game-complete', event => {
    if (validRun(event.detail)) refresh(event.detail);
  });
  document.addEventListener('wp:motion', () => refresh());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastRequestAt > 30000) refresh();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  window.addEventListener('pagehide', () => clearTimeout(resetTimer));
  refresh();
})();

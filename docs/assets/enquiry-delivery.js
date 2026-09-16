/* Explicit-send delivery adapter. No personal answers or challenge tokens are
 * stored. Cloudflare widget API: https://developers.cloudflare.com/turnstile/
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'wp:enquiry-delivery:v1';
  const RETRY_WINDOW = 24 * 60 * 60 * 1000;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const messages = {
    configuration: 'The enquiry service is not ready. Please message us on Instagram while we reconnect it.',
    invalid_payload: 'Please check your answers before sending your enquiry.',
    busy: 'Your enquiry is already being checked. Please wait a moment.',
    cancelled: 'Sending was cancelled before your enquiry was sent. Your answers are still here.',
    challenge_failed: 'The security check could not finish. Please try again; your answers are still here.',
    challenge_unavailable: 'The security check could not load. Please try again, or message us on Instagram.',
    rate_limited: 'Please wait a minute before trying again. Your answers are still here.',
    service_unavailable: 'The enquiry service is temporarily unavailable. Please try again with the same answers.',
    enquiry_pending: 'Your enquiry is still being processed. Wait a moment, then try Send again with the same answers.',
    receipt_unknown: 'We could not confirm receipt. Keep your answers unchanged and try Send again, or message us on Instagram to check.',
    manual_check_required: 'Your earlier enquiry may already have reached us. Please check with us on Instagram before sending another enquiry.',
    upstream_rejected: 'The enquiry service did not accept your enquiry. Your answers are still here; please check them and try Send again.',
    payload_too_large: 'Your enquiry is too long. Please shorten the extra details and try again.'
  };
  class DeliveryError extends Error {
    constructor(code, retryable = false) {
      super(code);
      this.name = 'EnquiryDeliveryError';
      this.code = code;
      this.userMessage = messages[code] || messages.receipt_unknown;
      this.retryable = retryable;
    }
  }
  const fail = (code, retryable = false) => new DeliveryError(code, retryable);
  let record;
  let loadedRecord = false;
  let sending = false;
  let scriptPromise;

  function remember(value) {
    record = value;
    loadedRecord = true;
    try {
      if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) { /* The in-memory guard still protects retries in this page. */ }
  }
  function previousRecord() {
    if (!loadedRecord) {
      loadedRecord = true;
      try {
        const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY));
        if (parsed && UUID.test(parsed.key) && /^[0-9a-f]{64}$/.test(parsed.fingerprint) &&
            Number.isFinite(parsed.createdAt) && parsed.createdAt <= Date.now() &&
            ['ready', 'unknown', 'accepted', 'rejected', 'manual'].includes(parsed.state)) {
          // Copy only the permitted metadata; never retain arbitrary stored data.
          record = { key: parsed.key, fingerprint: parsed.fingerprint, createdAt: parsed.createdAt, state: parsed.state };
        }
      } catch (_) { /* Storage can be unavailable without disabling enquiries. */ }
    }
    if (record && Date.now() - record.createdAt >= RETRY_WINDOW) {
      if (['unknown', 'manual'].includes(record.state)) {
        // The 24-hour retry key has expired. Retain a non-PII safety tombstone
        // for this tab instead of silently creating a duplicate enquiry.
        remember({ ...record, state: 'manual' });
      } else remember(null);
    }
    return record;
  }
  function checkAbort(signal) { if (signal?.aborted) throw fail('cancelled'); }
  function waitWithSignal(promise, signal) {
    if (!signal) return promise;
    checkAbort(signal);
    return new Promise((resolve, reject) => {
      const abort = () => { signal.removeEventListener('abort', abort); reject(fail('cancelled')); };
      signal.addEventListener('abort', abort, { once: true });
      promise.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => {
        signal.removeEventListener('abort', abort); reject(error);
      });
      if (signal.aborted) abort();
    });
  }
  function loadTurnstile() {
    if (window.turnstile?.render && window.turnstile?.execute) return Promise.resolve(window.turnstile);
    if (scriptPromise) return scriptPromise;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    scriptPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(false), 15000);
      let finished = false;
      function finish(ok) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (ok && window.turnstile?.render && window.turnstile?.execute) resolve(window.turnstile);
        else { script.remove(); reject(fail('challenge_unavailable', true)); }
      }
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      document.head.append(script);
    });
    scriptPromise.catch(() => { scriptPromise = undefined; });
    return scriptPromise;
  }
  async function freshToken(siteKey, container, signal) {
    checkAbort(signal);
    const api = await waitWithSignal(loadTurnstile(), signal);
    checkAbort(signal);
    return new Promise((resolve, reject) => {
      let widget;
      let settled = false;
      const mount = document.createElement('div');
      mount.className = 'enquiry-challenge';
      container.append(mount);
      const timer = setTimeout(() => finish(fail('challenge_failed', true)), 120000);
      const abort = () => finish(fail('cancelled'));
      function cleanup() {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (widget !== undefined) { try { api.remove(widget); } catch (_) {} }
        mount.remove();
      }
      function finish(error, token) {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(token);
      }
      signal?.addEventListener('abort', abort, { once: true });
      try {
        checkAbort(signal);
        widget = api.render(mount, {
          sitekey: siteKey, action: 'enquiry', theme: 'dark',
          // Flexible widgets have a 300px minimum; compact fits a phone's card.
          size: (container.getBoundingClientRect?.().width || 300) < 300 ? 'compact' : 'flexible',
          appearance: 'interaction-only', execution: 'execute', retry: 'never',
          'refresh-expired': 'manual', 'refresh-timeout': 'manual', 'response-field': false,
          callback: token => typeof token === 'string' && token.length > 0 && token.length <= 2048
            ? finish(null, token) : finish(fail('challenge_failed', true)),
          'error-callback': () => { finish(fail('challenge_failed', true)); return true; },
          'expired-callback': () => finish(fail('challenge_failed', true)),
          'timeout-callback': () => finish(fail('challenge_failed', true))
        });
        if (settled) cleanup();
        else api.execute(widget);
      } catch (error) {
        finish(error instanceof DeliveryError ? error : fail('challenge_failed', true));
      }
    });
  }
  async function fingerprintOf(data, endpoint) {
    const entries = [];
    if (!data?.entries) throw fail('invalid_payload');
    for (const [name, value] of data.entries()) {
      if (name === 'cf-turnstile-response') continue;
      if (typeof value !== 'string') throw fail('invalid_payload');
      entries.push([name, value]);
    }
    const canonical = entries.slice().sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0);
    const bytes = new TextEncoder().encode(JSON.stringify([endpoint, canonical]));
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return { body: new URLSearchParams(entries), fingerprint: [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
  }
  async function send(data, { endpoint, siteKey, container, signal } = {}) {
    if (sending) throw fail('busy', true);
    sending = true;
    try {
      checkAbort(signal);
      let url;
      try {
        url = new URL(endpoint);
        if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/i.test(url.hostname) ||
            url.pathname !== '/enquiry' || url.search || url.hash || url.username || url.password || url.port ||
            typeof siteKey !== 'string' || !/^[A-Za-z0-9_-]{10,100}$/.test(siteKey) || !container?.append ||
            !window.crypto?.randomUUID || !window.crypto?.subtle) throw new Error();
      } catch (_) { throw fail('configuration'); }
      const { body, fingerprint } = await fingerprintOf(data, url.href);
      checkAbort(signal);
      const previous = previousRecord();
      if (previous?.state === 'manual' || (previous?.state === 'unknown' && previous.fingerprint !== fingerprint)) {
        throw fail('manual_check_required');
      }
      if (previous?.state === 'accepted' && previous.fingerprint === fingerprint) {
        return { accepted: true, requestId: previous.key, cached: true };
      }
      if (!previous || previous.fingerprint !== fingerprint || previous.state === 'rejected') {
        remember({ key: window.crypto.randomUUID(), fingerprint, createdAt: Date.now(), state: 'ready' });
      }
      const current = record;
      const wasUnknown = current.state === 'unknown';
      const token = await freshToken(siteKey, container, signal);
      checkAbort(signal);
      body.set('cf-turnstile-response', token);
      // Persist before sending: a lost response or page closure must reuse the
      // same key, and edited answers cannot accidentally create a second lead.
      remember({ ...current, state: 'unknown' });
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 30000);
      let response, result;
      try {
        if (signal?.aborted) { remember(current); throw fail('cancelled'); }
        response = await fetch(url.href, {
          method: 'POST', credentials: 'omit', redirect: 'error',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'Idempotency-Key': current.key },
          body: body.toString(), signal: controller.signal
        });
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();
        if (!/^application\/json(?:\s*;|$)/i.test(contentType) || text.length > 8192) throw fail('receipt_unknown', true);
        try { result = JSON.parse(text); } catch (_) { throw fail('receipt_unknown', true); }
      } catch (error) {
        if (error instanceof DeliveryError) throw error;
        throw fail('receipt_unknown', true);
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
      }
      if (response.status === 200 && result?.accepted === true && result.requestId === current.key) {
        remember({ ...current, state: 'accepted' });
        return { accepted: true, requestId: current.key, ...(['queued', 'sent', 'unavailable'].includes(result.receipt) ? { receipt: result.receipt } : {}) };
      }
      const code = result?.accepted === false ? result.code : '';
      if (response.status === 409 && ['manual_check_required', 'idempotency_conflict'].includes(code)) {
        remember({ ...current, state: 'manual' });
        throw fail('manual_check_required');
      }
      if (response.status === 409 && code === 'enquiry_pending') throw fail('enquiry_pending', true);
      if (response.status === 422 && code === 'upstream_rejected' && result.retryWithNewKey === true) {
        remember({ ...current, state: 'rejected' });
        throw fail('upstream_rejected', true);
      }
      const knownBeforeDelivery = {
        400: ['invalid_payload', 'invalid_idempotency_key'], 403: ['challenge_failed'],
        413: ['payload_too_large'], 429: ['rate_limited'], 503: ['challenge_unavailable', 'service_unavailable']
      };
      if (knownBeforeDelivery[response.status]?.includes(code)) {
        remember({ ...current, state: wasUnknown ? 'unknown' : 'ready' });
        throw fail(code === 'invalid_idempotency_key' ? 'configuration' : code, code !== 'invalid_idempotency_key');
      }
      throw fail('receipt_unknown', true);
    } catch (error) {
      if (error instanceof DeliveryError) throw error;
      throw fail(record?.state === 'unknown' ? 'receipt_unknown' : 'configuration', record?.state === 'unknown');
    } finally { sending = false; }
  }
  window.WP_ENQUIRY_DELIVERY = Object.freeze({ send });
})();

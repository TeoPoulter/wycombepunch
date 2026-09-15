/* WYCOMBE PUNCH — shared interactions / version 2.
 * No framework, analytics, audio, payment code or background data collection.
 * Visitor-supplied text is only inserted with textContent (never innerHTML).
 */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const config = window.WP_CONFIG || {};
  const business = config.business || {};
  const contact = config.contact || {};
  const formConfig = config.form || {};
  const root = document.documentElement;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const emailValid = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
  root.classList.add('js');

  let storedReduced = false;
  try { storedReduced = sessionStorage.getItem('wp-motion') === 'reduced'; } catch (_) { /* Privacy modes may deny storage. */ }
  let reduced = motionQuery.matches || storedReduced;
  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = message;
    el.classList.add('is-visible');
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 4000);
  }
  function applyMotion() {
    const previous = root.classList.contains('motion-reduced');
    reduced = motionQuery.matches || storedReduced;
    root.classList.toggle('motion-reduced', reduced);
    $$('[data-motion-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(reduced));
      button.setAttribute('aria-label', reduced ? 'Reduced motion is on. Toggle animation preference.' : 'Reduce animations and use the motion-free game mode');
      button.title = motionQuery.matches ? 'Your device requests reduced motion. That preference is respected.' : (reduced ? 'Enable animated effects' : 'Reduce animated effects');
      const label = $('[data-motion-label]', button);
      if (label) label.textContent = reduced ? 'Motion off' : 'Motion on';
    });
    if (previous !== reduced) document.dispatchEvent(new CustomEvent('wp:motion', { detail: { reduced } }));
  }
  applyMotion();
  $$('[data-motion-toggle]').forEach(button => button.addEventListener('click', () => {
    if (motionQuery.matches) { toast('Your device requests reduced motion. We’re respecting that setting.'); return; }
    storedReduced = !reduced;
    try { sessionStorage.setItem('wp-motion', storedReduced ? 'reduced' : 'full'); } catch (_) { /* Keep the in-memory preference. */ }
    applyMotion();
    toast(reduced ? 'Background motion off. The game uses motion-free timing.' : 'Animated effects on.');
  }));
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', applyMotion);
  else motionQuery.addListener(applyMotion);

  // Shared LED segments, count-up and bag interaction.
  const digitSegments = ['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
  const animationFrames = new WeakMap();
  const hitTimers = new WeakMap();
  function setLed(svg, value) {
    if (!svg) return;
    const digits = String(Math.max(0, Math.min(999, Math.round(Number(value) || 0)))).padStart(3, '0');
    svg.dataset.score = digits;
    $$('[data-digit]', svg).forEach((group, index) => {
      const lit = digitSegments[Number(digits[index])];
      $$('[data-segment]', group).forEach(segment => segment.classList.toggle('lit', lit.includes(segment.dataset.segment)));
    });
  }
  function countTo(element, value, svg = null, duration = 640) {
    if (!element) return;
    cancelAnimationFrame(animationFrames.get(element));
    const target = Math.max(0, Math.min(999, Math.round(Number(value) || 0)));
    const initial = Number(element.textContent) || 0;
    const render = v => { element.textContent = String(v).padStart(3, '0'); if (svg) setLed(svg, v); };
    if (reduced || duration === 0) { render(target); return; }
    const start = performance.now();
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const next = Math.round(initial + (target - initial) * (1 - Math.pow(1 - progress, 3)));
      render(next);
      if (progress < 1) animationFrames.set(element, requestAnimationFrame(frame));
    }
    animationFrames.set(element, requestAnimationFrame(frame));
  }
  function hitMachine(svg) {
    if (!svg) return;
    clearTimeout(hitTimers.get(svg));
    svg.classList.remove('is-hit');
    if (reduced) return;
    void svg.getBoundingClientRect(); // Restart the finite CSS strike on repeated interaction.
    svg.classList.add('is-hit');
    hitTimers.set(svg, setTimeout(() => svg.classList.remove('is-hit'), 1120));
  }
  function clearMachine(svg) {
    if (!svg) return;
    clearTimeout(hitTimers.get(svg));
    svg.classList.remove('is-hit');
    setLed(svg, 0);
  }
  window.WP = Object.freeze({ $, $$, toast, setLed, countTo, hitMachine, clearMachine, get reducedMotion() { return reduced; } });

  // Real contact settings only. Blank values never become fabricated links.
  $$('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
  if (emailValid(contact.email)) $$('[data-contact-email]').forEach(a => { a.href = `mailto:${contact.email}`; a.hidden = false; });
  const instagram = String(contact.instagramUsername || '').trim().replace(/^@/, '');
  if (/^[A-Za-z0-9_.]{1,30}$/.test(instagram)) $$('[data-instagram]').forEach(a => {
    a.href = `https://www.instagram.com/${encodeURIComponent(instagram)}/`; a.hidden = false;
  });
  if (nonEmpty(business.operatorName)) $$('[data-operator-name]').forEach(el => { el.textContent = business.operatorName.trim(); });
  if (emailValid(business.privacyEmail)) $$('[data-privacy-email]').forEach(a => { a.href = `mailto:${business.privacyEmail}`; a.textContent = business.privacyEmail; });
  if (nonEmpty(business.contactAddress)) $$('[data-operator-address]').forEach(el => { el.textContent = `Contact address: ${business.contactAddress.trim()}`; el.hidden = false; });
  const identityReady = nonEmpty(business.operatorName) && (emailValid(business.privacyEmail) || /^[A-Za-z0-9_.]{1,30}$/.test(instagram));
  if (identityReady && config.enquiriesEnabled === true) $$('[data-legal-preview]').forEach(el => { el.hidden = true; });
  const providerNames = { netlify: 'Netlify Forms', formspree: 'Formspree', email: 'your chosen email application (draft only)' };
  $$('[data-form-provider]').forEach(el => { el.textContent = config.enquiriesEnabled === true ? (providerNames[formConfig.provider] || 'not configured') : 'not enabled for submissions'; });
  const providerPrivacy = { netlify: ['Netlify’s privacy information', 'https://www.netlify.com/privacy/'], formspree: ['Formspree’s privacy information', 'https://formspree.io/legal/privacy-policy/'] }[formConfig.provider];
  if (providerPrivacy && config.enquiriesEnabled === true) $$('[data-provider-notice]').forEach(el => {
    const link = document.createElement('a'); link.textContent = providerPrivacy[0]; link.href = providerPrivacy[1]; link.target = '_blank'; link.rel = 'noopener noreferrer'; el.replaceChildren(link); el.hidden = false;
  });
  const retention = Number(config.privacy?.enquiryRetentionMonths);
  if (Number.isInteger(retention) && retention > 0 && retention <= 120) $$('[data-retention-months]').forEach(el => { el.textContent = String(retention); });
  const receiptMessage = $('[data-submission-message]');
  if (receiptMessage) {
    let sentAt = 0;
    try { sentAt = Number(sessionStorage.getItem('wp:enquiry-sent')); } catch (_) { /* Neutral direct-visit copy remains. */ }
    if (sentAt > 0 && Date.now() >= sentAt && Date.now() - sentAt < 600000) {
      $('[data-submission-eyebrow]').textContent = 'ENQUIRY SENT';
      receiptMessage.textContent = 'Thanks — your enquiry has been sent. We’ll get back to you with availability and a quote.';
    }
  }
  const guide = Number(config.pricing?.guidePriceGBP);
  if (config.pricing?.showGuidePrice === true && Number.isFinite(guide) && guide > 0) {
    $$('[data-price-guide]').forEach(el => { el.hidden = false; });
    $$('[data-price]').forEach(el => { el.textContent = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(guide); });
  }

  // Mobile navigation: focus trap, Escape, inert content and breakpoint reset.
  const menuToggle = $('.menu-toggle');
  const nav = $('#main-nav');
  let menuOpen = false;
  function setMenu(open, returnFocus = false) {
    if (!nav || !menuToggle) return;
    menuOpen = open;
    nav.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.classList.toggle('menu-open', open);
    [$('main'), $('.site-footer'), $('.mobile-dock')].filter(Boolean).forEach(el => { el.inert = open; });
    if (returnFocus) menuToggle.focus({ preventScroll: true });
  }
  menuToggle?.addEventListener('click', () => setMenu(!menuOpen));
  if (nav) $$('a', nav).forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuOpen) { setMenu(false, true); return; }
    if (event.key !== 'Tab' || !menuOpen) return;
    const focusable = $$('a[href],button:not(:disabled)', $('.header-inner')).filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener('click', event => { if (menuOpen && !$('.site-header')?.contains(event.target)) setMenu(false); });
  window.matchMedia('(min-width: 801px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
  let scrollScheduled = false;
  function updateScroll() {
    scrollScheduled = false;
    $('#site-header')?.classList.toggle('is-scrolled', window.scrollY > 8);
    const total = root.scrollHeight - window.innerHeight;
    root.style.setProperty('--scroll', String(total > 0 ? Math.min(1, window.scrollY / total) : 0));
  }
  window.addEventListener('scroll', () => { if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  updateScroll();

  // Scroll reveals and mobile CTA suppression while the enquiry is on screen.
  if ('IntersectionObserver' in window) {
    root.classList.add('reveal-ready');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
    }), { threshold: .07, rootMargin: '0px 0px -18px 0px' });
    $$('.reveal').forEach(el => observer.observe(el));
    const dock = $('.mobile-dock'), enquiry = $('#enquire');
    if (dock && enquiry) new IntersectionObserver(entries => {
      dock.classList.toggle('is-hidden', entries[0].isIntersecting);
      dock.inert = entries[0].isIntersecting || menuOpen;
    }, { threshold: 0 }).observe(enquiry);
  }

  // Homepage cabinet: deterministic sample scores, explicitly not a strength test.
  const hero = $('#hero-machine');
  if (hero) {
    const svg = $('[data-machine-svg]', hero);
    const samples = [847, 912, 886, 963, 925, 978];
    let index = 0, busy = false;
    hero.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      const score = samples[index++ % samples.length];
      hero.setAttribute('aria-disabled', 'true');
      hitMachine(svg);
      countTo($('#hero-score'), score, svg, 720);
      $('.score-caption').textContent = score >= 950 ? 'Now do it again.' : 'You can beat that.';
      $('#hero-demo-note').textContent = score >= 950 ? 'That’s more like it. Got another one in you?' : 'Try again. You’ve got a higher score in you.';
      $('#hero-live').textContent = `${score}. Have another go, or play Hit 999 to test your timing.`;
      setTimeout(() => { busy = false; hero.removeAttribute('aria-disabled'); }, reduced ? 200 : 1120);
    });
    hero.disabled = false;
    // Modest pointer tilt, only on fine mouse pointers. Touch and reduced-motion stay still.
    const stage = $('[data-tilt-stage]');
    let tiltFrame;
    stage?.addEventListener('pointermove', event => {
      if (reduced || event.pointerType !== 'mouse' || !matchMedia('(hover: hover)').matches) return;
      cancelAnimationFrame(tiltFrame);
      tiltFrame = requestAnimationFrame(() => {
        const r = stage.getBoundingClientRect();
        stage.style.setProperty('--tilt-x', `${((event.clientX - r.left) / r.width - .5) * 7}deg`);
        stage.style.setProperty('--tilt-y', `${-((event.clientY - r.top) / r.height - .5) * 5}deg`);
      });
    }, { passive: true });
    stage?.addEventListener('pointerleave', () => { cancelAnimationFrame(tiltFrame); stage.style.setProperty('--tilt-x', '0deg'); stage.style.setProperty('--tilt-y', '0deg'); });
  }

  // Cards and coverage buttons actually feed the enquiry, rather than being decorative.
  $$('[data-event]').forEach(button => button.addEventListener('click', () => {
    const field = $('#event-type');
    if (field) { field.value = button.dataset.event; field.dispatchEvent(new Event('change', { bubbles: true })); }
    document.dispatchEvent(new CustomEvent('wp:form-step', { detail: 0 }));
    $('#enquire')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    toast(`${button.dataset.event} selected for your enquiry.`);
  }));
  $$('[data-town]').forEach(button => button.addEventListener('click', () => {
    $$('[data-town]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    const field = $('#venue');
    if (field) { field.value = button.dataset.town; field.dispatchEvent(new Event('input', { bubbles: true })); }
    const response = $('#coverage-response');
    if (response) response.textContent = `${button.dataset.town} added to your enquiry. We’ll quote transport for your exact venue.`;
  }));

  // Enquiry builder with validation, fail-closed preview and explicit email draft fallback.
  const form = $('#enquiry-form');
  if (form) {
    const steps = $$('.form-step', form);
    const fields = $('#enquiry-fields');
    const next = $('#form-next'), back = $('#form-back'), submit = $('#submit-enquiry');
    const submitLabel = $('#submit-label'), result = $('#form-result');
    const date = $('#event-date'), eventType = $('#event-type'), venue = $('#venue'), message = $('#message');
    const duration = $('#duration'), durationOther = $('#duration-other'), durationDetail = $('#duration-detail');
    function syncDuration() {
      if (!durationOther || !durationDetail) return;
      const custom = duration.value === 'Something else';
      durationOther.hidden = !custom;
      durationDetail.disabled = !custom;
      durationDetail.required = custom;
      if (!custom) durationDetail.setCustomValidity('');
    }
    duration.addEventListener('change', syncDuration);
    syncDuration();
    let current = 0, submitting = false, lastDraft = '';
    const isLocal = location.protocol === 'file:' || ['', 'localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(location.hostname);
    const ready = config.enquiriesEnabled === true && identityReady && !isLocal;
    const todayString = () => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    };
    date.min = todayString();
    const normalSubmitLabel = ready ? (formConfig.provider === 'email' ? 'Open my email enquiry' : 'Send my enquiry') : 'Prepare enquiry';
    submitLabel.textContent = normalSubmitLabel;
    if (ready) $('#preview-notice').hidden = true;
    else if (isLocal && config.enquiriesEnabled === true) $('#preview-notice').textContent = 'Local preview: submissions are deliberately disabled here. Test the live connection on your deployed site.';

    function updateSummary() {
      const values = {
        event: eventType.value || 'Not selected',
        date: date.value ? new Date(`${date.value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'To be confirmed',
        venue: venue.value.trim() || 'To be confirmed',
        duration: duration.value === 'Something else' && durationDetail?.value.trim() ? durationDetail.value.trim() : duration.value
      };
      $$('[data-summary]').forEach(el => { el.textContent = values[el.dataset.summary] || ''; });
      $('#message-count').textContent = String(message.value.length);
    }
    function showStep(index, focus = false) {
      current = Math.max(0, Math.min(steps.length - 1, index));
      steps.forEach((step, i) => { step.hidden = i !== current; });
      back.hidden = current === 0;
      next.hidden = current === steps.length - 1;
      submit.hidden = current !== steps.length - 1;
      $('#step-indicator').textContent = `0${current+1} / 03`;
      $('.enquiry-form-card').style.setProperty('--form-progress', `${(current+1)/3*100}%`);
      form.dataset.step = String(current);
      const text = current === 0 ? 'Next: the details' : 'Next: your contact details';
      next.firstChild.textContent = `${text} `;
      updateSummary();
      if (focus) $('h3', steps[current]).focus({ preventScroll: true });
    }
    function validateStep(index) {
      date.min = todayString();
      for (const input of $$('input,select,textarea', steps[index])) {
        input.setCustomValidity('');
        if (input.required && typeof input.value === 'string' && !input.value.trim()) input.setCustomValidity('Please complete this field.');
        if (input === date && date.value && date.value < date.min) input.setCustomValidity('Please choose today or a future date, or leave the date blank.');
        if (!input.checkValidity()) { showStep(index); input.reportValidity(); return false; }
      }
      return true;
    }
    form.addEventListener('input', event => { if (event.target.setCustomValidity) event.target.setCustomValidity(''); updateSummary(); });
    form.addEventListener('change', updateSummary);
    next.addEventListener('click', () => { if (validateStep(current)) showStep(current + 1, true); });
    back.addEventListener('click', () => showStep(current - 1, true));
    document.addEventListener('wp:form-step', event => { if (!submitting) showStep(Number(event.detail) || 0); });
    function showResult(title, messageText, sent = false) {
      $('#form-result-title').textContent = title;
      $('#form-result-text').textContent = messageText;
      $('#copy-enquiry').hidden = sent;
      result.hidden = false;
      result.focus({ preventScroll: true });
      result.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    }
    function createDraft(data) {
      const value = (key, fallback='Not provided') => String(data.get(key) || '').trim() || fallback;
      const requestedDuration = value('duration') === 'Something else' ? value('duration-detail') : value('duration');
      return ['WYCOMBE PUNCH — EVENT ENQUIRY','',`Name: ${value('name')}`,`Email: ${value('email')}`,`Phone: ${value('phone')}`,`Occasion: ${value('event-type')}`,`Date: ${value('event-date','Not confirmed yet')}`,`Hire duration: ${requestedDuration}`,`Venue / town / postcode: ${value('venue')}`,'','Extra details:',value('message','None'),'','This is an enquiry, not a confirmed booking.'].join('\n');
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting) return;
      if (current < 2) { if (validateStep(current)) showStep(current + 1, true); return; }
      for (let i = 0; i < steps.length; i++) if (!validateStep(i)) return;
      const data = new FormData(form);
      if (String(data.get('_gotcha') || data.get('bot-field') || '').trim()) return;
      for (const key of ['name','email','venue']) data.set(key, String(data.get(key) || '').trim());
      lastDraft = createDraft(data);
      $('#copy-fallback').hidden = true;
      if (!ready) {
        showResult('Enquiry prepared — not sent', 'Copy your event details below and send them to @wycombepunchmachine on Instagram. Nothing has been sent yet.');
        return;
      }
      if (formConfig.provider === 'email') {
        const address = emailValid(contact.email) ? contact.email : business.privacyEmail;
        if (!emailValid(address)) { showResult('Email is not configured', 'Nothing has been sent. Copy your details and use an established contact method.'); return; }
        location.href = `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent('Event hire enquiry — Wycombe Punch')}&body=${encodeURIComponent(lastDraft)}`;
        showResult('Finish in your email app', 'The website requested an email draft. Nothing has been sent automatically. Review the message and press Send in your email app, or copy the details below.');
        return;
      }
      let endpoint = '/';
      if (formConfig.provider === 'netlify') {
        // A plain static host returning 200 must not be mistaken for a processed Netlify form.
        if (form.hasAttribute('data-netlify') || form.hasAttribute('netlify')) {
          showResult('The form service is not connected', 'This page has not been processed by Netlify Forms. Nothing has been sent. Enable form detection and redeploy, or configure another supported provider.');
          return;
        }
      } else if (formConfig.provider === 'formspree') {
        try {
          const url = new URL(formConfig.endpoint);
          if (url.protocol !== 'https:' || url.hostname !== 'formspree.io' || !/^\/f\/[A-Za-z0-9]+$/.test(url.pathname) || url.username || url.password) throw new Error('Invalid endpoint');
          endpoint = url.href;
        } catch (_) { showResult('The enquiry endpoint is not configured', 'Nothing has been sent. Copy your enquiry while the owner connects a valid Formspree endpoint.'); return; }
      } else { showResult('No enquiry service is configured', 'Nothing has been sent. Copy your details and use an established contact method.'); return; }
      submitting = true;
      fields.disabled = true;
      submit.setAttribute('aria-busy','true');
      submitLabel.textContent = 'Sending your enquiry…';
      result.hidden = true;
      const controller = new AbortController();
      const timeoutMs = Math.max(1000, Math.min(60000, Number(formConfig.timeoutMs) || 15000));
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded', 'Accept': formConfig.provider === 'formspree' ? 'application/json' : 'text/html' }, body: new URLSearchParams(data).toString(), credentials: formConfig.provider === 'netlify' ? 'same-origin' : 'omit', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 429 ? 'rate-limit' : `HTTP ${response.status}`);
        let receiptStored = false;
        try { sessionStorage.setItem('wp:enquiry-sent', String(Date.now())); receiptStored = true; } catch (_) { /* Show the receipt here if storage is unavailable. */ }
        form.reset();
        syncDuration();
        updateSummary();
        if (receiptStored) location.assign('thank-you.html');
        else showResult('Enquiry sent', 'Thanks — your enquiry has been sent. We’ll get back to you with availability and a quote.', true);
      } catch (error) {
        showResult('We could not confirm receipt', error.message === 'rate-limit' ? 'The form service is receiving too many requests. Please wait before retrying. Your details are still available to copy.' : 'Your details are still here. We could not confirm delivery; please check before retrying to avoid duplicate messages, or copy the enquiry and contact us another way. Nothing has been booked.');
      } finally {
        clearTimeout(timeout);
        submitting = false;
        fields.disabled = false;
        submit.removeAttribute('aria-busy');
        submitLabel.textContent = normalSubmitLabel;
      }
    });
    $('#copy-enquiry').addEventListener('click', async () => {
      if (!lastDraft) return;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(lastDraft);
        toast('Enquiry details copied.');
      } catch (_) {
        const fallback = $('#copy-fallback');
        fallback.value = lastDraft; fallback.hidden = false; fallback.focus(); fallback.select();
        toast('Select and copy the enquiry text below.');
      }
    });
    showStep(0);
    fields.disabled = false; // Listeners are installed before the form becomes interactive.
  }
  $$('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(button.dataset.copy); toast(`${button.dataset.copy} copied`); }
    catch (_) { toast(`Colour: ${button.dataset.copy}`); }
  }));
})();

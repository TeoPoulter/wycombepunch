/* Progressive enhancement: the source video keeps native controls without JS. */
(() => {
  'use strict';
  document.querySelectorAll('[data-punch-video]').forEach(player => {
    const video = player.querySelector('video');
    const controls = player.querySelector('[data-video-controls]');
    const play = player.querySelector('[data-video-play]');
    const mute = player.querySelector('[data-video-mute]');
    const seek = player.querySelector('[data-video-seek]');
    const fullscreen = player.querySelector('[data-video-fullscreen]');
    const status = player.querySelector('[data-video-status]');
    const punchline = player.closest('.watch-layout')?.querySelector('[data-video-punchline]');
    if (!video || !controls || !play || !mute || !seek || !fullscreen || !status) return;

    const icons = {
      play: '<path d="m9 5 11 7-11 7Z"/>',
      pause: '<path d="M8 5v14M16 5v14"/>',
      replay: '<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>',
      sound: '<path d="M11 4 6 8H3v8h3l5 4ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
      muted: '<path d="M11 4 6 8H3v8h3l5 4Zm5 5 6 6m0-6-6 6"/>',
      expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
      collapse: '<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
      close: '<path d="m6 6 12 12M6 18 18 6"/>'
    };
    function setIcon(button, icon, label) {
      if (button.dataset.icon !== icon) {
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[icon]}</svg>`;
        button.dataset.icon = icon;
      }
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    }

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    let inView = false;
    let userPaused = false;
    let internalPause = false;
    let playRevision = 0;
    let autoplayBlocked = false;
    let expanded = false;
    let closing = false;
    let placeholder;
    let returnFocus;
    let restoredBackground = [];
    let previousOverflow;
    let transitionAnimations = [];
    let transitionRevision = 0;
    let inlineExtraHeight = 0;
    let inlineRatio = 9 / 16;
    const overlay = document.createElement('div');
    overlay.className = 'punch-video-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Video fullscreen');
    const overlayClose = document.createElement('button');
    overlayClose.type = 'button';
    overlayClose.className = 'punch-video-close';
    setIcon(overlayClose, 'close', 'Close fullscreen video');
    const overlayStage = document.createElement('div');
    overlayStage.className = 'punch-video-overlay-stage';
    overlay.append(overlayClose, overlayStage);
    document.body.append(overlay);
    const reducedMotion = () => motion.matches || window.WP?.reducedMotion;
    const canAutoplay = () => !reducedMotion() && !connection?.saveData;
    const visible = () => expanded || inView;
    const duration = () => Number.isFinite(video.duration) ? video.duration : 0;
    const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

    function update() {
      const paused = video.paused || video.ended;
      setIcon(play, video.ended ? 'replay' : paused ? 'play' : 'pause', video.ended ? 'Replay video' : paused ? 'Play video' : 'Pause video');
      setIcon(mute, video.muted ? 'muted' : 'sound', video.muted ? 'Unmute video' : 'Mute video');
      mute.setAttribute('aria-pressed', String(!video.muted));
      setIcon(fullscreen, expanded ? 'collapse' : 'expand', expanded ? 'Exit fullscreen video' : 'Full screen');
      fullscreen.setAttribute('aria-expanded', String(expanded));
      seek.disabled = !duration();
      seek.max = String(duration() || 1);
      seek.value = String(Math.min(video.currentTime || 0, duration()));
      seek.setAttribute('aria-valuetext', `${formatTime(video.currentTime || 0)} of ${formatTime(duration())}`);
      player.dataset.playing = String(!paused);
      if (punchline) {
        const ready = video.currentTime >= 15;
        punchline.classList.toggle('is-revealed', ready);
        punchline.setAttribute('aria-hidden', String(!ready));
      }
    }

    function pauseAutomatically() {
      playRevision++;
      if (!video.paused) {
        internalPause = true;
        video.pause();
      }
    }

    async function start(manual) {
      if (!manual && (!visible() || document.hidden || userPaused || autoplayBlocked || !canAutoplay())) return;
      const revision = ++playRevision;
      if (manual) {
        userPaused = false;
        autoplayBlocked = false;
        if (video.ended) video.currentTime = 0;
      }
      status.textContent = '';
      try {
        await video.play();
        // The video can leave view while the browser is still starting it.
        if (revision !== playRevision || document.hidden || (!manual && (!visible() || !canAutoplay()))) {
          pauseAutomatically();
        }
      } catch (_) {
        if (revision !== playRevision) return;
        autoplayBlocked = true;
        if (manual) status.textContent = 'Tap Play to try again.';
      }
      update();
    }

    function togglePlay() {
      if (video.paused || video.ended) start(true);
      else {
        userPaused = true;
        pauseAutomatically();
        update();
      }
    }

    function toggleMute() {
      if (video.muted) {
        // The first audible sentence should be the start of the clip.
        video.muted = false;
        video.currentTime = 0;
        start(true);
      } else video.muted = true;
      update();
    }

    function cancelTransition() {
      transitionRevision++;
      for (const animation of transitionAnimations) animation.cancel();
      transitionAnimations = [];
    }

    function rectTransform(rect, base) {
      return `translate(${rect.left - base.left}px, ${rect.top - base.top}px) scale(${rect.width / base.width}, ${rect.height / base.height})`;
    }

    function animateTransition(from, to, leaving, backdrop) {
      const base = player.getBoundingClientRect();
      if (reducedMotion() || !player.animate || !base.width || !base.height) {
        if (leaving) finishClose();
        return;
      }
      const revision = ++transitionRevision;
      const timing = { duration: leaving ? 360 : 440, easing: 'cubic-bezier(.22,.72,.18,1)', fill: 'both' };
      transitionAnimations = [
        player.animate([
          { transform: rectTransform(from, base), transformOrigin: '0 0', borderRadius: leaving ? '12px' : '16px' },
          { transform: rectTransform(to, base), transformOrigin: '0 0', borderRadius: leaving ? '16px' : '12px' }
        ], timing),
        // Fade the backdrop independently, so the moving video stays visible.
        overlay.animate([
          { backgroundColor: backdrop.backgroundColor, backdropFilter: backdrop.backdropFilter },
          { backgroundColor: leaving ? 'rgba(5, 5, 8, 0)' : 'rgba(5, 5, 8, 0.93)', backdropFilter: leaving ? 'blur(0px)' : 'blur(14px)' }
        ], timing),
        overlayClose.animate([{ opacity: leaving ? 1 : 0 }, { opacity: leaving ? 0 : 1 }], timing)
      ];
      Promise.all(transitionAnimations.map(animation => animation.finished.catch(() => {}))).then(() => {
        if (revision !== transitionRevision) return;
        if (leaving) finishClose();
        else cancelTransition();
      });
    }

    function finishClose() {
      if (!expanded) return;
      cancelTransition();
      placeholder.replaceWith(player);
      placeholder = null;
      player.classList.remove('is-expanded');
      overlay.hidden = true;
      overlay.classList.remove('is-open');
      expanded = false;
      closing = false;
      for (const [element, inert] of restoredBackground) element.inert = inert;
      restoredBackground = [];
      document.documentElement.style.overflow = previousOverflow;
      update();
      returnFocus?.focus({ preventScroll: true });
      // A close can return to a part of the page outside the viewport.
      const bounds = video.getBoundingClientRect();
      inView = bounds.bottom > 0 && bounds.top < window.innerHeight &&
        Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0) >= bounds.height * 0.4;
      if (!inView) pauseAutomatically();
    }

    function closeFullscreen() {
      if (!expanded || closing) return;
      closing = true;
      // Capture the current on-screen frame before cancelling an entrance that
      // may still be running. A quick Escape reverses from where the player is.
      const from = player.getBoundingClientRect();
      const backdrop = getComputedStyle(overlay);
      const backdropFrame = { backgroundColor: backdrop.backgroundColor, backdropFilter: backdrop.backdropFilter };
      cancelTransition();
      // Recompute the inline height if the viewport changed while expanded.
      placeholder.style.height = `${placeholder.getBoundingClientRect().width / inlineRatio + inlineExtraHeight}px`;
      const target = placeholder.getBoundingClientRect();
      animateTransition(from, target, true, backdropFrame);
    }

    function toggleFullscreen() {
      if (expanded) { closeFullscreen(); return; }
      returnFocus = document.activeElement;
      const bounds = player.getBoundingClientRect();
      const videoBounds = video.getBoundingClientRect();
      inlineRatio = videoBounds.width / videoBounds.height || 9 / 16;
      inlineExtraHeight = bounds.height - bounds.width / inlineRatio;
      placeholder = document.createElement('div');
      placeholder.className = 'punch-video-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.height = `${bounds.height}px`;
      player.before(placeholder);
      const wasPlaying = !video.paused && !video.ended;
      expanded = true;
      player.classList.add('is-expanded');
      overlayStage.append(player);
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      restoredBackground = [...document.body.children].filter(element => element !== overlay).map(element => [element, element.inert]);
      for (const [element] of restoredBackground) element.inert = true;
      overlay.hidden = false;
      overlay.classList.add('is-open');
      update();
      overlayClose.focus({ preventScroll: true });
      // Measuring after reparenting gives the final layout before the browser
      // paints. Web Animations starts at the old rectangle without a flash.
      animateTransition(bounds, player.getBoundingClientRect(), false, {
        backgroundColor: 'rgba(5, 5, 8, 0)', backdropFilter: 'blur(0px)'
      });
      // Some browsers pause a media element when it changes parent.
      if (wasPlaying && video.paused) start(true);
    }

    overlayClose.addEventListener('click', closeFullscreen);
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target === overlayStage) closeFullscreen();
    });
    document.addEventListener('keydown', event => {
      if (!expanded) return;
      if (event.key === 'Escape') { event.preventDefault(); closeFullscreen(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...overlay.querySelectorAll('button, input, video')].filter(element => !element.disabled && !element.hidden);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
    document.addEventListener('focusin', event => {
      if (expanded && !overlay.contains(event.target)) overlayClose.focus({ preventScroll: true });
    });

    play.addEventListener('click', togglePlay);
    mute.addEventListener('click', toggleMute);
    fullscreen.addEventListener('click', toggleFullscreen);
    video.addEventListener('click', togglePlay);
    video.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if ([' ', 'k', 'm', 'f', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
      if (key === ' ' || key === 'k') togglePlay();
      if (key === 'm') toggleMute();
      if (key === 'f') toggleFullscreen();
      if (duration() && ['arrowleft', 'arrowright'].includes(key)) {
        video.currentTime = Math.max(0, Math.min(duration(), video.currentTime + (key === 'arrowleft' ? -5 : 5)));
        update();
      }
    });
    seek.addEventListener('input', () => {
      if (duration()) video.currentTime = Number(seek.value);
      update();
    });
    ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'volumechange', 'seeked', 'emptied'].forEach(name => video.addEventListener(name, update));
    video.addEventListener('pause', () => {
      if (!internalPause && !video.ended) userPaused = true;
      internalPause = false;
      update();
    });
    video.addEventListener('ended', () => {
      userPaused = true;
      update();
    });
    video.addEventListener('error', () => {
      autoplayBlocked = true;
      status.textContent = 'Video unavailable. Please try again later.';
      // Restore the browser's own controls if enhancement encounters an error.
      video.controls = true;
    });
    const preferenceChanged = () => {
      if (reducedMotion()) {
        if (closing) finishClose();
        else cancelTransition();
      }
      if (!canAutoplay()) pauseAutomatically();
      else if (visible()) start(false);
    };
    motion.addEventListener?.('change', preferenceChanged);
    connection?.addEventListener?.('change', preferenceChanged);
    document.addEventListener('wp:motion', preferenceChanged);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseAutomatically();
      else if (visible()) start(false);
    });
    window.addEventListener('pagehide', () => { if (expanded) finishClose(); pauseAutomatically(); });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          inView = entry.isIntersecting && entry.intersectionRatio >= 0.4;
          if (expanded) continue;
          if (inView) start(false);
          else pauseAutomatically();
        }
      }, { threshold: [0, 0.4] });
      observer.observe(video);
    }
    controls.hidden = false;
    // A new page load always starts quietly; later resumes keep the choice
    // made by the visitor instead of muting an audible video again.
    video.defaultMuted = true;
    video.muted = true;
    video.controls = false;
    video.tabIndex = 0;
    player.dataset.enhanced = 'true';
    update();
  });
})();

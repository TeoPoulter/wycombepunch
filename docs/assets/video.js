/* Progressive enhancement: the source video keeps native controls without JS. */
(() => {
  'use strict';
  document.querySelectorAll('[data-punch-video]').forEach(player => {
    const video = player.querySelector('video');
    const controls = player.querySelector('[data-video-controls]');
    const play = player.querySelector('[data-video-play]');
    const mute = player.querySelector('[data-video-mute]');
    const seek = player.querySelector('[data-video-seek]');
    const time = player.querySelector('[data-video-time]');
    const fullscreen = player.querySelector('[data-video-fullscreen]');
    const status = player.querySelector('[data-video-status]');
    if (!video || !controls || !play || !mute || !seek || !time || !fullscreen || !status) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    let inView = false;
    let userPaused = false;
    let internalPause = false;
    let playRevision = 0;
    let autoplayBlocked = false;
    const canAutoplay = () => !motion.matches && !window.WP?.reducedMotion && !connection?.saveData;
    const duration = () => Number.isFinite(video.duration) ? video.duration : 0;
    const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

    function update() {
      const paused = video.paused || video.ended;
      play.textContent = video.ended ? 'Replay' : paused ? 'Play' : 'Pause';
      play.setAttribute('aria-label', `${play.textContent} video`);
      mute.textContent = video.muted ? 'Sound on' : 'Mute';
      mute.setAttribute('aria-label', video.muted ? 'Unmute video' : 'Mute video');
      mute.setAttribute('aria-pressed', String(!video.muted));
      seek.disabled = !duration();
      seek.max = String(duration() || 1);
      seek.value = String(Math.min(video.currentTime || 0, duration()));
      seek.setAttribute('aria-valuetext', `${formatTime(video.currentTime || 0)} of ${formatTime(duration())}`);
      time.textContent = `${formatTime(video.currentTime || 0)} / ${duration() ? formatTime(duration()) : '0:38'}`;
      player.dataset.playing = String(!paused);
    }

    function pauseAutomatically() {
      playRevision++;
      if (!video.paused) {
        internalPause = true;
        video.pause();
      }
    }

    async function start(manual) {
      if (!manual && (!inView || document.hidden || userPaused || autoplayBlocked || !canAutoplay())) return;
      const revision = ++playRevision;
      if (manual) {
        userPaused = false;
        autoplayBlocked = false;
        if (video.ended) video.currentTime = 0;
      } else video.muted = true;
      status.textContent = '';
      try {
        await video.play();
        // The video can leave view while the browser is still starting it.
        if (revision !== playRevision || document.hidden || (!manual && (!inView || !canAutoplay()))) {
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
      video.muted = !video.muted;
      update();
    }

    async function toggleFullscreen() {
      try {
        if (document.fullscreenElement === player) await document.exitFullscreen();
        else if (player.requestFullscreen) await player.requestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      } catch (_) { status.textContent = 'Fullscreen is unavailable in this browser.'; }
    }

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
    ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'volumechange', 'seeked'].forEach(name => video.addEventListener(name, update));
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
      status.textContent = 'Video unavailable. Use the link below to open it.';
      // Restore the browser's own controls if enhancement encounters an error.
      video.controls = true;
    });
    document.addEventListener('fullscreenchange', () => {
      fullscreen.textContent = document.fullscreenElement === player ? 'Exit full screen' : 'Full screen';
      fullscreen.setAttribute('aria-label', fullscreen.textContent);
    });
    const preferenceChanged = () => {
      if (!canAutoplay()) pauseAutomatically();
      else if (inView) start(false);
    };
    motion.addEventListener?.('change', preferenceChanged);
    connection?.addEventListener?.('change', preferenceChanged);
    document.addEventListener('wp:motion', preferenceChanged);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseAutomatically();
      else if (inView) start(false);
    });
    window.addEventListener('pagehide', pauseAutomatically);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          inView = entry.isIntersecting && entry.intersectionRatio >= 0.4;
          if (inView) start(false);
          else pauseAutomatically();
        }
      }, { threshold: [0, 0.4] });
      observer.observe(video);
    }
    fullscreen.hidden = !player.requestFullscreen && !video.webkitEnterFullscreen;
    controls.hidden = false;
    video.controls = false;
    video.tabIndex = 0;
    player.dataset.enhanced = 'true';
    update();
  });
})();

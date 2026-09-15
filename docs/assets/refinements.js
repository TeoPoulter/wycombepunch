(() => {
  'use strict';
  const motionOff = () => document.documentElement.classList.contains('motion-reduced') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const activeAnimations = new Set();
  let pendingNavigation = null;
  let navigationTimer = null;
  let veil = null;

  function animate(element, frames, options) {
    if (motionOff() || !element?.animate) return;
    const animation = element.animate(frames, options);
    activeAnimations.add(animation);
    animation.finished.then(() => activeAnimations.delete(animation), () => activeAnimations.delete(animation));
  }
  function navigate() {
    const destination = pendingNavigation;
    pendingNavigation = null;
    clearTimeout(navigationTimer);
    if (destination) window.location.assign(destination);
  }
  function resetTransition() {
    clearTimeout(navigationTimer);
    pendingNavigation = null;
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
    veil?.remove();
    veil = null;
  }

  document.querySelectorAll('[data-game-link]').forEach(link => link.addEventListener('click', event => {
    // Preserve the real link for new tabs, downloads, reduced motion and no-JS use.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        link.hasAttribute('download') || (link.target && link.target !== '_self') || motionOff() || pendingNavigation) return;
    event.preventDefault();
    pendingNavigation = link.href;
    // Schedule navigation before the optional animation so visual failures cannot trap the click.
    navigationTimer = window.setTimeout(navigate, 240);
    try {
      veil = document.createElement('div');
      veil.className = 'game-transition-veil';
      veil.setAttribute('aria-hidden', 'true');
      document.body.append(veil);
      animate(link, [{ transform: 'scale(1)' }, { transform: 'scale(.97)', offset: .35 }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
      animate(veil, [{ opacity: 0 }, { opacity: .65 }], { duration: 230, easing: 'ease-in', fill: 'forwards' });
    } catch (_) { navigate(); }
  }));

  document.querySelectorAll('[data-town]').forEach(button => button.addEventListener('click', () => {
    // app.js owns the selected town and the form value; this only presents its confirmation.
    const response = document.getElementById('coverage-response');
    if (!response || button.getAttribute('aria-pressed') !== 'true') return;
    const title = document.createElement('strong');
    title.textContent = button.dataset.town;
    const detail = document.createElement('span');
    detail.textContent = 'Selected for your enquiry';
    response.replaceChildren(title, detail);
    response.classList.add('is-selected');
    if (!motionOff()) {
      response.getAnimations?.().forEach(animation => animation.cancel());
      animate(response, [{ opacity: .25, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
      animate(button, [{ transform: 'scale(.98)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
    }
  }));
  document.addEventListener('wp:motion', () => {
    if (!motionOff()) return;
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
    if (pendingNavigation) navigate();
  });
  window.addEventListener('pageshow', resetTransition);
})();

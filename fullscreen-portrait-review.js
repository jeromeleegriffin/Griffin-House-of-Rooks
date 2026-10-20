/* Isolated review: source-image rail coordinates are provisional and need owner approval. */
(() => {
  const qs = new URLSearchParams(location.search);
  if (qs.get('railReview') === '0') return;
  const ref = { width: 875, height: 1797, holderY: 1430 };
  const installed = () =>
    Boolean(
      window.HORFullscreen831?.fitModeActive?.() ||
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        navigator.standalone === true ||
        ['fullscreen', 'standalone', 'minimal-ui'].some(
          (mode) => matchMedia('(display-mode: ' + mode + ')').matches
        )
    );
  let lastDelta = 0,
    queued = false,
    observer;
  function sync() {
    const root = document.body;
    const portrait = matchMedia('(orientation:portrait)').matches;
    const bg = document.getElementById('hor-room-bg');
    const hand = document.querySelector('body.in-game .game-room > .hand-area');
    if (!portrait || !bg || !hand) {
      root.classList.remove('hor-rail-review');
      root.style.removeProperty('--hor-rail-review-dy');
      lastDelta = 0;
      return;
    }
    const scene = bg.getBoundingClientRect();
    const holder = hand.getBoundingClientRect();
    if (!scene.height || !holder.height) return;
    const cover = Math.max(scene.width / ref.width, scene.height / ref.height);
    const desired = scene.top + ref.holderY * cover;
    const baseline = holder.top - lastDelta;
    const gap = baseline - desired;
    // Chrome layouts that already match the artwork must remain unchanged.
    const active = installed() || qs.get('railReview') === '1';
    const newDelta =
      active && gap > 25 ? Math.max(-Math.floor(scene.height * 0.4), -Math.round(gap)) : 0;
    lastDelta = newDelta;
    root.style.setProperty('--hor-rail-review-dy', newDelta + 'px');
    root.classList.toggle('hor-rail-review', newDelta !== 0);
    root.dataset.railReviewDelta = String(newDelta);
    root.dataset.railReviewGap = gap.toFixed(1);
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }
  // Expose the existing alignment pass for install-mode review and dependent UI placement.
  window.HORRailReview1020 = {
    sync: () => {
      sync();
      return true;
    },
    schedule,
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('click', schedule, true);
  function start() {
    schedule();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

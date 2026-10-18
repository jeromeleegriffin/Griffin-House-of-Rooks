/* Repeats the existing bid click handler. No bidding/scoring/persistence ownership. */
(function () {
  'use strict';
  let active = null,
    timer = 0,
    cleanup = () => {};
  function stop() {
    clearTimeout(timer);
    timer = 0;
    active = null;
  }
  window.addEventListener('blur', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  function bind(...args) {
    cleanup();
    stop();
    const valid = args.pop(),
      buttons = args.filter(Boolean),
      controller = new AbortController(),
      signal = controller.signal;
    cleanup = () => controller.abort();
    buttons.forEach((button) => {
      let repeated = false;
      const allowed = () => button.isConnected && !button.disabled && valid() && !document.hidden;
      button.addEventListener(
        'pointerdown',
        (e) => {
          if (!e.isPrimary || e.button !== 0 || !allowed()) return;
          stop();
          repeated = false;
          active = { button, id: e.pointerId, start: performance.now() };
          button.setPointerCapture(e.pointerId);
          const repeat = () => {
            if (!active || active.button !== button || !allowed()) {
              stop();
              return;
            }
            repeated = true;
            button.click();
            if (!active || active.button !== button || !allowed()) {
              stop();
              return;
            }
            const elapsed = performance.now() - active.start;
            timer = setTimeout(repeat, elapsed > 1400 ? 55 : elapsed > 800 ? 90 : 150);
          };
          timer = setTimeout(repeat, 350);
        },
        { signal }
      );
      button.addEventListener(
        'click',
        (e) => {
          // Ignore the release-generated click after a hold. Keyboard/programmatic clicks remain normal.
          if (repeated && e.detail > 0) {
            e.preventDefault();
            e.stopImmediatePropagation();
            repeated = false;
          }
        },
        { capture: true, signal }
      );
      const end = (e) => {
        if (active?.id === e.pointerId) stop();
      };
      button.addEventListener('pointerup', end, { signal });
      button.addEventListener('pointercancel', end, { signal });
      button.addEventListener('lostpointercapture', end, { signal });
      button.addEventListener(
        'pointermove',
        (e) => {
          if (active?.button === button) {
            const r = button.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              stop();
          }
        },
        { signal }
      );
      button.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    });
  }
  window.HORBidHold795 = { bind, cancel: stop };
})();

/* Presentation only: no gameplay, controls, card sizing, or timers changed. */
(function () {
  function init() {
    const area = document.querySelector('.game-room > .hand-area');
    const dock = document.getElementById('decisionConsole');
    const hand = document.getElementById('myHand');
    if (!area || !dock || !hand) return;
    const rear = document.createElement('div');
    rear.className = 'holder004-backrest';
    rear.setAttribute('aria-hidden', 'true');
    area.insertBefore(rear, hand);
    let frame = 0;
    function register() {
      frame = 0;
      if (!matchMedia('(orientation:portrait)').matches) return;
      const surface = dock.querySelector('.approved-bid-surface');
      if (
        !surface ||
        dock.classList.contains('hidden') ||
        !dock.classList.contains('decision-mode-bid')
      )
        return;
      const a = area.getBoundingClientRect(),
        b = surface.getBoundingClientRect();
      if (!a.width || !b.width) return;
      const scale = a.width / area.offsetWidth;
      // Overlap the solid lower beam, not its transparent shadow fringe.
      const top = b.top + b.height * (258 / 290);
      const bottom = rear.getBoundingClientRect().top + 7 * scale;
      const values = {
        left: (b.left + b.width * 0.015 - a.left) / scale,
        width: (b.width * 0.97) / scale,
        top: (top - a.top) / scale,
        height: Math.max(0, (bottom - top) / scale),
      };
      for (const [key, value] of Object.entries(values)) {
        const v = value.toFixed(3) + 'px';
        if (area.style.getPropertyValue('--holder004-' + key) !== v)
          area.style.setProperty('--holder004-' + key, v);
      }
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(register);
    }
    new MutationObserver(schedule).observe(dock, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'style'],
    });
    new ResizeObserver(schedule).observe(area);
    new ResizeObserver(schedule).observe(hand);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    schedule();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

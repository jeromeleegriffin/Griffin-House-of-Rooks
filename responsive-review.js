/* DOM geometry only. Never reads/writes game, players, rules or persistence. */
(() => {
  function init() {
    const area = document.querySelector('.game-room>.hand-area'),
      hand = document.getElementById('myHand'),
      dock = document.getElementById('decisionConsole'),
      pot = document.getElementById('trickPtsBar');
    if (!area || !hand || !dock || !pot) return;
    let pending = 0;
    const set = (el, k, n) => {
      const v = n.toFixed(3) + 'px';
      if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v);
    };
    function register() {
      pending = 0;
      if (!matchMedia('(orientation:portrait) and (min-width:429px)').matches) return;
      const a = area.getBoundingClientRect(),
        h = hand.getBoundingClientRect(),
        d = dock.getBoundingClientRect();
      if (!a.width || !h.width) return;
      if (d.width) {
        set(dock, '--responsive-dock-left', a.left + a.width / 2 - d.width / 2);
        set(dock, '--responsive-dock-bottom', innerHeight - h.top + 32 + 8);
      }
      const scale = a.width / area.offsetWidth;
      set(
        pot,
        '--responsive-pot-top',
        (h.top - a.top - pot.getBoundingClientRect().height - 6) / scale
      );
    }
    function schedule() {
      if (!pending) pending = requestAnimationFrame(register);
    }
    const ro = new ResizeObserver(schedule);
    [area, hand, dock, pot].forEach((e) => ro.observe(e));
    new MutationObserver(schedule).observe(hand, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
    new MutationObserver(schedule).observe(dock, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    schedule();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

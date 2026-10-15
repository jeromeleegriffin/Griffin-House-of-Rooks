/* Visual fire stays visible independently of audio mute or ambience volume.
   Event-driven only: no polling and no per-frame audio analysis. */
(() => {
  'use strict';
  const active = () => {
    const body = document.body;
    const game = document.getElementById('game');
    const toggle = document.getElementById('opt-cabin-ambience');
    const slider = document.getElementById('opt-cabin-volume');
    let storedEnabled = null, storedVolume = null, muted = false;
    try {
      storedEnabled = localStorage.getItem('rookCabinAmbience041');
      storedVolume = localStorage.getItem('rookCabinVolume041');
      muted = localStorage.getItem('rookMuted') === '1';
    } catch (_) {}
    const enabled = toggle ? toggle.checked : storedEnabled !== '0';
    const volume = slider ? Number(slider.value) : (storedVolume === null ? 30 : Number(storedVolume));
    const visible = !document.hidden && (!game || !game.classList.contains('hidden'));
    body.classList.toggle('cabin-fire-active041', body.classList.contains('in-game') && visible);
  };
  const schedule = () => setTimeout(active, 0);
  document.addEventListener('DOMContentLoaded', active, { once: true });
  document.addEventListener('change', active);
  document.addEventListener('input', active);
  document.addEventListener('click', schedule, true);
  document.addEventListener('visibilitychange', active);
  window.addEventListener('focus', active);
  window.addEventListener('pageshow', active);
  const observer = new MutationObserver(active);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const game = document.getElementById('game');
  if (game) observer.observe(game, { attributes: true, attributeFilter: ['class'] });
  active();
})();

/* Room fit: native fullscreen, clear empty seats, and one next-step action. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id),
    wide = () => matchMedia('(orientation:landscape)').matches;
  const buttons = [];
  let messageTimer;
  function fullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function paint() {
    for (const b of buttons) {
      const label = fullscreen() ? 'Exit full screen' : 'Full screen';
      b.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5"/></svg><span></span>';
      b.querySelector('span').textContent = label;
      b.setAttribute('aria-label', label);
      b.setAttribute('aria-pressed', String(fullscreen()));
    }
  }
  async function toggle() {
    const was = fullscreen();
    window.HORManualFullscreen831 = !was;
    try {
      if (was) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (!exit) throw Error();
        await exit.call(document);
      } else {
        const el = document.documentElement,
          request = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!request) throw Error();
        await request.call(el);
      }
      paint();
    } catch (_) {
      window.HORManualFullscreen831 = was;
      for (const b of buttons) b.textContent = 'Full screen unavailable';
      clearTimeout(messageTimer);
      messageTimer = setTimeout(paint, 3500);
    }
  }
  window.HORFullscreen831 = { toggle };
  for (const id of ['lobby', 'waiting']) {
    const host = $(id);
    if (!host) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'room-fullscreen831';
    b.onclick = toggle;
    host.append(b);
    buttons.push(b);
  }
  for (const event of ['fullscreenchange', 'webkitfullscreenchange'])
    document.addEventListener(event, () => {
      window.HORManualFullscreen831 = fullscreen();
      paint();
    });
  paint();
  const hero = $('roomWelcome830'),
    partner = $('landingPartner783'),
    label = $('roomPartnerLabel830');
  const row = document.createElement('div');
  row.id = 'roomPartnerRow831';
  hero.prepend(row);
  const homes = [partner, label].map((n) => {
    const marker = document.createComment('original partner home');
    n.before(marker);
    return [n, marker];
  });
  function fit() {
    for (const [n, marker] of homes) {
      if (wide()) {
        if (n.parentNode !== row) row.append(n);
      } else if (n.parentNode !== marker.parentNode) marker.after(n);
    }
    const waiting = $('waiting');
    if (waiting && !waiting.classList.contains('hidden')) {
      const open = seatedCount() < 4;
      if (waiting.classList.contains('room-has-open831') !== open)
        waiting.classList.toggle('room-has-open831', open);
      const canFill = isHost && seatedCount() < 4;
      const actions = $('friendsActions803'),
        fill = wide() && canFill;
      if (actions && actions.classList.contains('room-fill-next831') !== fill)
        actions.classList.toggle('room-fill-next831', fill);
      for (const seat of waiting.querySelectorAll('.wait-seat.friends-empty')) {
        const position = seat.dataset.position,
          choice = seat.querySelector('.friends-seat-choice804');
        const text = position === 'top' ? '+ Choose partner' : isHost ? '+ Choose bot' : 'Sit here';
        if (choice && choice.textContent !== text) choice.textContent = text;
      }
    }
  }
  const waiting = $('waiting');
  if (waiting)
    new MutationObserver(fit).observe(waiting, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
  addEventListener('resize', fit);
  document.addEventListener('DOMContentLoaded', fit);
  fit();
})();

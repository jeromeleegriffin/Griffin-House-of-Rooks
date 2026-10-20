/* Room fit: native fullscreen, clear empty seats, and one next-step action. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id),
    wide = () => matchMedia('(orientation:landscape)').matches;
  const buttons = [];
  let messageTimer;
  let changing = false;
  const safeAndroid =
    /Android/i.test(navigator.userAgent) || navigator.userAgentData?.platform === 'Android';
  function fullscreen() {
    return !!nativeOwner();
  }
  function nativeOwner() {
    let view = window;
    try {
      while (view) {
        if (view.document.fullscreenElement || view.document.webkitFullscreenElement)
          return view.document;
        if (view === view.parent) break;
        view = view.parent;
      }
    } catch (_) {}
    return null;
  }
  function fitModeActive() {
    return document.body.classList.contains('page-fit');
  }
  function fullscreenLabel() {
    return fullscreen() ? 'Exit full screen' : 'Full screen';
  }
  async function exitNativeForFit() {
    const owner = nativeOwner();
    if (owner) {
      const exit = owner.exitFullscreen || owner.webkitExitFullscreen;
      if (exit) await exit.call(owner);
    }
  }
  function paint() {
    for (const b of buttons) {
      const text = fullscreenLabel();
      b.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5"/></svg><span></span>';
      b.querySelector('span').textContent = text;
      b.setAttribute('aria-label', text);
      b.setAttribute('aria-pressed', String(fullscreen()));
    }
  }
  async function toggle() {
    if (changing) return;
    changing = true;
    const was = fullscreen();
    try {
      if (was) {
        const owner = nativeOwner();
        const exit = owner?.exitFullscreen || owner?.webkitExitFullscreen;
        if (!exit) throw Error();
        await exit.call(owner);
      } else {
        const el = document.documentElement,
          request = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!request) throw Error();
        await request.call(el);
      }
      window.HORManualFullscreen831 = fullscreen();
      clearTimeout(messageTimer);
      if (!was) {
        try {
          screen.orientation?.unlock?.();
        } catch (_) {}
      }
      paint();
    } catch (_) {
      window.HORManualFullscreen831 = fullscreen();
      for (const b of buttons) b.textContent = 'Full screen unavailable';
      clearTimeout(messageTimer);
      messageTimer = setTimeout(paint, 3500);
    } finally {
      changing = false;
    }
  }
  async function fitScreen() {
    if (changing) return;
    changing = true;
    try {
      await exitNativeForFit();
      document.body.classList.add('page-fit');
      window.HORManualFullscreen831 = false;
      window.syncBrowserFitBtn?.();
      paint();
    } finally {
      changing = false;
    }
  }
  window.HORFullscreen831 = {
    toggle,
    fitScreen,
    fitModeActive: () => safeAndroid && fitModeActive(),
    label: fullscreenLabel,
  };
  if (safeAndroid) document.body.classList.add('page-fit');
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

/*835: compose existing live room controls around one finished brand asset. */
(() => {
  'use strict';
  const hero = document.getElementById('roomWelcome830'),
    lobby = document.getElementById('lobby'),
    waiting = document.getElementById('waiting');
  if (!hero) return;
  const brand = lobby.querySelector('.room-brand830'),
    edit = document.getElementById('roomEditPlayer830'),
    partner = document.getElementById('landingPartner783'),
    row = document.getElementById('roomPartnerRow831');
  const controls = document.createElement('div');
  controls.id = 'roomWelcomeControls835';
  controls.append(edit, row);
  hero.prepend(brand);
  hero.append(controls);
  const center = document.getElementById('friendsCenter804'),
    waitBrand = waiting?.querySelector('.room-brand830');
  if (center && waitBrand) center.prepend(waitBrand);
  function sync() {
    const wide = matchMedia('(orientation:landscape)').matches;
    if (!wide) return;
    const p = window.HORLanding783?.inspect().roster?.[1],
      favorite = favoritePartner042(),
      conflict = favorite?.avatar === ensurePreferredAvatar();
    const text = conflict
      ? '↻ ' + favorite.name + ' unavailable · Change'
      : '↻ ' + (p?.name || 'Partner') + ' · Change partner';
    if (partner.textContent !== text) partner.textContent = text;
    partner.setAttribute(
      'aria-label',
      conflict
        ? 'Change partner. ' + favorite.name + ' portrait is already in use.'
        : 'Change partner. Current partner ' + (p?.name || 'random')
    );
    edit.setAttribute(
      'aria-label',
      'Edit player ' + (document.getElementById('hor-player-name').value || 'You')
    );
  }
  document.getElementById('opt-favorite-partner').addEventListener('change', sync);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }).observe(hero, { childList: true, subtree: true, characterData: true });
  addEventListener('resize', sync);
  document.addEventListener('DOMContentLoaded', sync);
  sync();
  document.addEventListener(
    'keydown',
    (e) => {
      const history = document.getElementById('historyModal');
      if (e.key === 'Escape' && history && !history.classList.contains('hidden')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeHandHistory();
      }
    },
    true
  );
})();

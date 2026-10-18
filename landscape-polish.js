/* Landscape UI presentation. Existing partner storage, seat actions and game rules own state. */
(() => {
  'use strict';
  const landscape = () => matchMedia('(orientation:landscape)').matches;
  const picker = document.getElementById('landingPartners783'),
    select = document.getElementById('opt-favorite-partner');
  if (picker && select) {
    const grid = document.createElement('div');
    grid.className = 'partner-photo-grid';
    grid.setAttribute('aria-label', 'Partner photographs');
    const nav = document.createElement('div');
    nav.className = 'partner-photo-nav';
    const prev = document.createElement('button'),
      next = document.createElement('button'),
      label = document.createElement('span');
    prev.type = next.type = 'button';
    prev.textContent = 'Previous';
    next.textContent = 'Next';
    nav.append(prev, label, next);
    picker.querySelector('[data-partner-control]').after(grid, nav);
    const selectionStatus = document.createElement('p');
    selectionStatus.className = 'partner-selection-status833';
    selectionStatus.setAttribute('role', 'status');
    selectionStatus.setAttribute('aria-live', 'polite');
    const explanation = picker.querySelector(':scope>p');
    explanation.after(selectionStatus);
    explanation.hidden = true;
    function selectionFeedback() {
      const name = select.value,
        human = ensurePreferredAvatar(),
        chosen = BOT_PERSONAS.find((p) => p.name === name),
        conflict = !!chosen && chosen.avatar === human;
      for (const option of select.options) {
        const p = BOT_PERSONAS.find((p) => p.name === option.value);
        if (!option.dataset.baseLabel835) option.dataset.baseLabel835 = option.textContent;
        option.disabled = !!p && p.avatar === human;
        option.textContent =
          option.dataset.baseLabel835 + (option.disabled ? ' · Your portrait is in use' : '');
      }
      selectionStatus.textContent = conflict
        ? name +
          ' is unavailable because you are using that portrait. Choose another partner or random.'
        : name
          ? 'Selected partner: ' + name
          : 'Random partner selected';
      const done = picker.querySelector('[data-done]');
      done.disabled = conflict;
      done.textContent = conflict
        ? 'Choose another partner'
        : name
          ? 'Use ' + name
          : 'Use random partner';
    }
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'choice-search836';
    search.placeholder = 'Search partners by name or style';
    search.setAttribute('aria-label', 'Search partners');
    grid.before(search);
    let page = 0;
    search.oninput = () => {
      page = 0;
      grid.scrollTop = 0;
      paint();
    };
    function scrollStatus839() {
      const q = HORChoiceRows841.status(grid);
      prev.disabled = !q.previous;
      next.disabled = !q.next;
      label.textContent = q.current + ' / ' + q.total;
    }
    grid.addEventListener('scroll', scrollStatus839, { passive: true });
    function paint() {
      if (!picker.open) return;
      const oldScroll839 = grid.scrollTop;
      selectionFeedback();
      const query = search.value.trim().toLowerCase();
      const entries = [
        { name: '', label: 'Choose normally', blurb: 'Random partner each game' },
        ...BOT_PERSONAS.map((p) => ({ ...p, label: p.name })),
      ].filter(
        (p) =>
          !query ||
          [p.label, p.style, STYLE_TITLES[p.style], p.blurb].join(' ').toLowerCase().includes(query)
      );
      const size = landscape() ? (innerHeight < 340 ? 3 : 6) : 8,
        pages = Math.max(1, Math.ceil(entries.length / size));
      page = Math.max(0, Math.min(page, pages - 1));
      grid.replaceChildren();
      if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'choice-empty836';
        empty.textContent = 'No matching partners. Try another name or style.';
        grid.append(empty);
      }
      for (const p of entries) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'partner-photo';
        b.dataset.partner = p.name;
        b.disabled = !!p.avatar && p.avatar === ensurePreferredAvatar();
        b.setAttribute(
          'aria-label',
          p.name ? 'Choose ' + p.name + ' as partner' : 'Choose a random partner'
        );
        b.setAttribute('aria-pressed', String(select.value === p.name));
        if (p.avatar) {
          const image = document.createElement('img');
          image.src = avatarSrc(p.avatar);
          image.alt = p.label;
          b.append(image);
        } else {
          const icon = document.createElement('span');
          icon.className = 'partner-random';
          icon.textContent = '♧';
          b.append(icon);
        }
        const check = document.createElement('span');
        check.className = 'partner-choice-check833';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';
        b.append(check);
        const copy = document.createElement('span'),
          name = document.createElement('strong'),
          style = document.createElement('small');
        name.textContent = p.label;
        style.textContent = b.disabled
          ? 'Your portrait is already in use'
          : p.style
            ? STYLE_TITLES[p.style] || p.blurb || p.style
            : p.blurb;
        copy.append(name, style);
        b.append(copy);
        b.onclick = () => {
          select.value = p.name;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          paint();
        };
        grid.append(b);
      }
      grid.scrollTop = oldScroll839;
      requestAnimationFrame(scrollStatus839);
    }
    prev.onclick = () => HORChoiceRows841.move(grid, -1);
    next.onclick = () => HORChoiceRows841.move(grid, 1);
    select.addEventListener('change', () => {
      if (picker.open) paint();
    });
    new MutationObserver(() => {
      if (picker.open) {
        search.value = '';
        const size = landscape() ? (innerHeight < 340 ? 3 : 6) : 8;
        page = Math.floor(
          Math.max(
            0,
            [...select.options].findIndex((o) => o.value === select.value)
          ) / size
        );
        paint();
      }
    }).observe(picker, { attributes: true, attributeFilter: ['open'] });
    addEventListener('resize', paint);
  }
  const waiting = document.getElementById('waiting');
  if (waiting) {
    const actions = new Map();
    let last = '';
    function refresh() {
      if (!landscape() || waiting.classList.contains('hidden')) return;
      const key = JSON.stringify([
        isHost,
        players.map((p) => [p.id, p.seat, p.name]),
        innerWidth,
        innerHeight,
      ]);
      if (key === last) return;
      last = key;
      for (let seat = 0; seat < 4; seat++) {
        const main = document.getElementById('waitSeat' + seat),
          p = playerAtSeat(seat);
        if (!main) continue;
        let remove = actions.get(seat);
        if (!remove) {
          remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'waiting-remove-bot';
          remove.dataset.seat = seat;
          waiting.append(remove);
          actions.set(seat, remove);
          remove.onclick = (e) => {
            e.stopPropagation();
            const occupant = playerAtSeat(seat);
            if (isHost && occupant?.isBot) openBotPicker(seat, true);
          };
        }
        remove.hidden = !(isHost && p?.isBot);
        remove.dataset.position = main.dataset.position || ['me', 'left', 'top', 'right'][seat];
        remove.textContent = 'Change';
        remove.setAttribute('aria-label', 'Change ' + (p?.name || 'bot'));
        if (p) {
          const hint = main.querySelector('small');
          if (hint && hint.textContent !== '') hint.textContent = '';
          main.setAttribute('aria-label', p.name + ', view player');
        }
      }
    }
    waiting.addEventListener(
      'click',
      (e) => {
        if (!landscape()) return;
        const main = e.target.closest('[id^="waitSeat"]');
        if (!main || !/^waitSeat[0-3]$/.test(main.id)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const seat = Number(main.id.slice(-1)),
          p = playerAtSeat(seat);
        if (p) horShowCareerForPlayer(p);
        else onWaitSeatClick(seat);
      },
      true
    );
    new MutationObserver(refresh).observe(waiting, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    addEventListener('resize', () => {
      last = '';
      refresh();
    });
    refresh();
  }
  // The nest is positioned in viewport coordinates; keep its original parent for portrait.
  const nest = document.getElementById('nestArea'),
    home = nest?.parentNode,
    next = nest?.nextSibling;
  function moveNest() {
    if (!nest) return;
    if (window.HORAngleC?.active()) {
      const target = document.getElementById('landscapeTheater');
      if (target && nest.parentNode !== target) target.append(nest);
    } else if (nest.parentNode !== home)
      home.insertBefore(nest, next?.parentNode === home ? next : null);
  }
  new MutationObserver(moveNest).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
  addEventListener('resize', moveNest);
  moveNest();
})();

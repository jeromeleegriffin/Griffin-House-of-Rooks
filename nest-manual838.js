/* Owner-approved hand/Nest trays, powered by the game's existing discard Set and submit path. */
(() => {
  'use strict';
  let s = null,
    root = null,
    drag = null,
    fitFrame = 0;
  const label = (c) =>
    isRookCard(c)
      ? 'Blackbird'
      : includeRed2 && isRed2(c)
        ? 'Red Two'
        : isRed1(c)
          ? 'Special Red 1'
          : c.color + ' ' + c.rank;
  const src = (c) =>
    isRookCard(c)
      ? 'assets/images/RookPremium.png'
      : includeRed2 && isRed2(c)
        ? 'assets/images/Red2-card.webp'
        : 'assets/cards/numbered/' + c.color + '-' + c.rank + '.png';
  const get = (id) => root?.querySelector('#' + id),
    by = (id) => s?.hand.find((c) => String(c.id) === String(id));
  function status(text) {
    const e = get('nest838Status');
    if (e) e.textContent = text;
  }
  function reset() {
    detach();
    s = null;
  }
  function detach() {
    cancel();
    root?.classList.remove('manual-nest838');
    cancelAnimationFrame(fitFrame);
    root = null;
  }
  function show(ctx) {
    cancel();
    root = ctx.ov;
    root.classList.add('manual-nest838');
    root.classList.remove('hidden', 'gh-kitty-page', 'gh-discard-page');
    root.setAttribute('aria-hidden', 'false');
    root.style.cssText = '';
    if (!s || s.key !== ctx.flowKey) {
      s = {
        key: ctx.flowKey,
        ids: HORHandOrder838.ordered(ctx.hand).map((c) => String(c.id)),
        staged: new Set(ctx.kitty.map((c) => String(c.id))),
        hand: ctx.hand,
      };
    }
    s.ctx = ctx;
    s.hand = ctx.hand;
    s.selected = window.selectedForDiscard;
    document.querySelector('.hand-area')?.classList.add('hidden');
    paint();
    return true;
  }
  function cards(ids) {
    return ids.map(by).filter(Boolean);
  }
  function button(c, zone) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nest838-card discard-pick';
    b.dataset.id = String(c.id);
    b.dataset.card = String(c.id);
    b.setAttribute(
      'aria-label',
      (zone === 'nest' ? 'Return ' : 'Discard ') + label(c) + '. Drag to arrange.'
    );
    const im = document.createElement('img');
    im.src = src(c);
    im.alt = label(c);
    im.draggable = false;
    b.append(im);
    b.onclick = () => {
      if (window._discardSubmitting) return;
      place(String(c.id), zone === 'nest' ? 'hand' : 'nest', null);
    };
    b.onpointerdown = (e) => start(e, b);
    b.onkeydown = (e) => {
      if (!e.altKey || !['ArrowLeft', 'ArrowRight'].includes(e.key) || s.selected.has(String(c.id)))
        return;
      e.preventDefault();
      const kept = s.ids.filter((id) => !s.selected.has(id)),
        i = kept.indexOf(String(c.id)),
        next = i + (e.key === 'ArrowLeft' ? -1 : 1);
      if (next < 0 || next >= kept.length) return;
      place(String(c.id), 'hand', e.key === 'ArrowLeft' ? kept[next] : kept[next + 1] || null);
      get('nest838Hand')
        ?.querySelector('[data-id="' + c.id + '"]')
        ?.focus({ preventScroll: true });
    };
    return b;
  }
  function place(id, zone, before) {
    if (!s || window._discardSubmitting || !by(id) || before === id) return;
    if (zone === 'nest' && !s.selected.has(id) && s.selected.size >= s.ctx.count) {
      status('The Nest is full. Return a card before adding another.');
      return;
    }
    // 840: discarding vacates a slot; only deliberate hand arrangement moves other cards.
    const wasSelected = s.selected.has(id);
    if (zone !== 'nest' && (!wasSelected || before)) {
      s.ids = s.ids.filter((x) => x !== id);
      const i = before ? s.ids.indexOf(before) : -1;
      s.ids.splice(i < 0 ? s.ids.length : i, 0, id);
    }
    if (zone === 'nest') {
      const selected = [...s.selected].filter((x) => x !== id),
        j = before ? selected.indexOf(before) : -1;
      selected.splice(j < 0 ? selected.length : j, 0, id);
      s.selected.clear();
      selected.forEach((x) => s.selected.add(x));
      s.staged.delete(id);
    } else {
      s.selected.delete(id);
      if (zone === 'kitty') s.staged.add(id);
      else s.staged.delete(id);
    }
    paint();
    status(
      s.selected.size === s.ctx.count
        ? 'Arrange your ten kept cards, then lock your hand.'
        : zone === 'nest'
          ? 'Moved to the Nest. Choose ' + (s.ctx.count - s.selected.size) + ' more.'
          : 'Card returned. Slide left or right to place it.'
    );
  }
  function paint() {
    if (!root || !s) return;
    const focus841 = root.contains(document.activeElement)
      ? { id: document.activeElement.dataset.id, control: document.activeElement.id }
      : null;
    s.selected = window.selectedForDiscard;
    const kept = s.ids.filter((id) => !s.selected.has(id)),
      choosing840 = s.selected.size < s.ctx.count,
      fallback = false,
      upper = choosing840 ? s.ids : kept,
      incoming = [];
    root.innerHTML =
      '<section class="nest838-sheet" role="dialog" aria-modal="true" aria-labelledby="discardTitle"><header><div><small>GRIFFIN HOUSE OF ROOKS · THE NEST</small><h2 id="discardTitle">Choose ' +
      s.ctx.count +
      ' for the Nest</h2><p>Drag down to discard, up to return, and sideways to arrange.</p></div><strong id="discardCountLabel" aria-live="polite">' +
      s.selected.size +
      ' / ' +
      s.ctx.count +
      '</strong></header><div class="nest838-board' +
      (choosing840 ? ' two-rows839' : '') +
      '"><section class="nest838-keep"><h3>KEEP <span>' +
      kept.length +
      ' cards' +
      (incoming.length ? ' + ' + incoming.length + ' below' : '') +
      '</span></h3><div id="nest838Hand" class="nest838-zone" data-zone="hand"></div></section>' +
      (fallback
        ? '<section class="nest838-kitty"><h3>DRAWN CARDS <span>' +
          incoming.length +
          ' to place</span></h3><div id="nest838Kitty" class="nest838-zone" data-zone="kitty"></div></section>'
        : '') +
      '<section class="nest838-nest"><h3>NEST <span>' +
      s.selected.size +
      ' / ' +
      s.ctx.count +
      ' discards · tap to return</span></h3><div id="nest838Nest" class="nest838-zone" data-zone="nest"></div></section></div><footer><button type="button" id="nest838Reset">Reset</button><p id="nest838Status" role="status" aria-live="polite">' +
      (s.selected.size === s.ctx.count
        ? 'Your hand will stay in this order in both orientations.'
        : 'Blackbird, Red Two, then largest color groups · 1 high') +
      '</p><button type="button" id="confirmDiscard" ' +
      (s.selected.size !== s.ctx.count || window._discardSubmitting ? 'disabled' : '') +
      '>' +
      (window._discardSubmitting
        ? 'Discarding…'
        : s.selected.size === s.ctx.count
          ? 'Lock hand & confirm'
          : 'Choose ' + (s.ctx.count - s.selected.size) + ' more') +
      '</button></footer></section>';
    for (const c of cards(upper)) {
      if (choosing840 && s.selected.has(String(c.id))) {
        const hole = document.createElement('span');
        hole.className = 'nest838-hole840';
        hole.dataset.emptyFor = String(c.id);
        hole.setAttribute('aria-hidden', 'true');
        get('nest838Hand').append(hole);
      } else get('nest838Hand').append(button(c, 'hand'));
    }
    for (const c of cards(incoming)) get('nest838Kitty')?.append(button(c, 'kitty'));
    for (const c of cards([...s.selected])) get('nest838Nest').append(button(c, 'nest'));
    for (let i = s.selected.size; i < s.ctx.count; i++) {
      const e = document.createElement('span');
      e.className = 'nest838-slot';
      e.textContent = i + 1;
      get('nest838Nest').append(e);
    }
    get('nest838Reset').onclick = () => {
      if (window._discardSubmitting) return;
      s.ids = HORHandOrder838.preset(s.hand).map((c) => String(c.id));
      s.selected.clear();
      s.staged = new Set(s.ctx.kitty.map((c) => String(c.id)));
      paint();
    };
    get('confirmDiscard').onclick = () => {
      if (!window._discardSubmitting && s.selected.size === s.ctx.count)
        s.ctx.confirm(
          [...s.selected],
          s.ids.filter((id) => !s.selected.has(id))
        );
    };
    get('nest838Hand').style.setProperty(
      '--n',
      Math.max(1, choosing840 ? Math.ceil(s.hand.length / 2) : upper.length)
    );
    get('nest838Hand').dataset.rows = choosing840 ? '2' : '1';
    if (get('nest838Kitty'))
      get('nest838Kitty').style.setProperty('--n', Math.max(1, incoming.length));
    get('nest838Nest').style.setProperty('--n', s.ctx.count);
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(fit);
    if (focus841) {
      const target = focus841.id
        ? [...root.querySelectorAll('.nest838-card')].find((e) => e.dataset.id === focus841.id)
        : get(focus841.control);
      target?.focus({ preventScroll: true });
    }
  }
  function fit() {
    if (!root || drag?.active) return;
    for (const zone of root.querySelectorAll('.nest838-zone')) {
      const rows =
          Number(zone.dataset.rows) ||
          (zone.id === 'nest838Nest' && root.querySelector('.two-rows839')
            ? innerHeight <= 320
              ? 2
              : 3
            : 1),
        count = Math.max(1, Math.ceil(zone.children.length / rows)),
        r = zone.getBoundingClientRect(),
        h = Math.max(
          16,
          Math.min(
            (r.height - 8 - (rows - 1) * 8) / rows,
            (((r.width - 12 - (count - 1) * 8) / count) * 840) / 580,
            210
          )
        );
      zone.style.setProperty('--h', h + 'px');
      zone.style.setProperty('--w', (h * 580) / 840 + 'px');
    }
  }
  function start(e, b) {
    if (e.button !== 0 || window._discardSubmitting || drag) return;
    const r = b.getBoundingClientRect();
    drag = {
      id: b.dataset.id,
      source: b,
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      r,
      active: false,
    };
    try {
      b.setPointerCapture(e.pointerId);
    } catch {}
  }
  function target(x, y) {
    const zones = [...root.querySelectorAll('.nest838-zone')];
    let el = zones.find((e) => {
      const r = e.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    if (!el) {
      const near = zones
        .map((e) => {
          const r = e.getBoundingClientRect();
          return {
            e,
            d: Math.hypot(
              Math.max(r.left - x, 0, x - r.right),
              Math.max(r.top - y, 0, y - r.bottom)
            ),
          };
        })
        .sort((a, b) => a.d - b.d)[0];
      if (near?.d < 18) el = near.e;
    }
    if (!el) return null;
    const nodes = [...el.querySelectorAll('.nest838-card')].filter((e) => e.dataset.id !== drag.id);
    let row = nodes;
    if (el.dataset.rows === '2' && nodes.length) {
      const closest = nodes.reduce((best, e) =>
        Math.abs(e.getBoundingClientRect().y + e.getBoundingClientRect().height / 2 - y) <
        Math.abs(best.getBoundingClientRect().y + best.getBoundingClientRect().height / 2 - y)
          ? e
          : best
      );
      const rowY = closest.getBoundingClientRect().y;
      row = nodes.filter((e) => Math.abs(e.getBoundingClientRect().y - rowY) < 3);
    }
    const before =
      row.find((e) => {
        const r = e.getBoundingClientRect();
        return x < r.left + r.width / 2;
      }) ||
      (el.dataset.rows === '2' && row.length && nodes.indexOf(row.at(-1)) < nodes.length - 1
        ? nodes[nodes.indexOf(row.at(-1)) + 1]
        : null);
    return {
      el,
      zone: el.dataset.zone,
      before: before?.dataset.id || null,
      node: before || row.at(-1),
      isBefore: !!before,
    };
  }
  function cancel() {
    if (!drag) return;
    drag.ghost?.remove();
    drag.marker?.remove();
    drag.source.classList.remove('nest838-drag-source');
    root?.querySelectorAll('.nest838-target').forEach((e) => e.classList.remove('nest838-target'));
    try {
      drag.source.releasePointerCapture(drag.pointer);
    } catch {}
    drag = null;
  }
  addEventListener(
    'pointermove',
    (e) => {
      if (!drag || e.pointerId !== drag.pointer || !root) return;
      if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      e.preventDefault();
      if (!drag.active) {
        drag.active = true;
        drag.ghost = drag.source.cloneNode(true);
        drag.ghost.className = 'nest838-ghost';
        drag.ghost.removeAttribute('data-id');
        drag.ghost.setAttribute('aria-hidden', 'true');
        Object.assign(drag.ghost.style, {
          width: drag.r.width + 'px',
          height: drag.r.height + 'px',
        });
        document.body.append(drag.ghost);
        drag.source.classList.add('nest838-drag-source');
        drag.marker = document.createElement('div');
        drag.marker.className = 'nest838-marker';
        document.body.append(drag.marker);
      }
      Object.assign(drag.ghost.style, {
        left: e.clientX - drag.dx + 'px',
        top: e.clientY - drag.dy + 'px',
      });
      root
        .querySelectorAll('.nest838-target')
        .forEach((el) => el.classList.remove('nest838-target'));
      const t = target(e.clientX, e.clientY);
      drag.marker.hidden = !t;
      if (t) {
        t.el.classList.add('nest838-target');
        const r = t.node?.getBoundingClientRect() || t.el.getBoundingClientRect();
        Object.assign(drag.marker.style, {
          left: (t.node ? (t.isBefore ? r.left - 3 : r.right + 1) : r.left + 3) + 'px',
          top: r.top + 'px',
          height: r.height + 'px',
        });
      }
    },
    { passive: false }
  );
  addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (!drag.active) {
      cancel();
      return;
    }
    e.preventDefault();
    const id = drag.id,
      t = target(e.clientX, e.clientY);
    cancel();
    if (t) place(id, t.zone, t.before);
    else status('Card returned to its starting place.');
  });
  addEventListener('pointercancel', cancel);
  addEventListener('blur', cancel);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancel();
  });
  addEventListener('resize', () => {
    cancel();
    if (root) {
      if (!matchMedia('(orientation: landscape)').matches) detach();
      else paint();
    }
  });
  window.HORManualNest838 = {
    show,
    detach,
    reset,
    refresh: () => {
      if (root) paint();
    },
    orderFor: (hand) => {
      const ids = new Set(hand.map((c) => String(c.id)));
      return s && s.ids.length === hand.length && s.ids.every((id) => ids.has(id))
        ? [...s.ids]
        : HORHandOrder838.ordered(hand).map((c) => String(c.id));
    },
    inspect: () =>
      s ? { ids: [...s.ids], selected: [...s.selected], staged: [...s.staged] } : null,
  };
})();

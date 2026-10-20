/* House of Rooks premium asset UI, portrait review candidate.
   Finished approved photographic PNGs supply all physical material surfaces.
   Original buttons/handlers are moved, never duplicated or replaced. */
(() => {
  'use strict';
  const gid = (id) => document.getElementById(id);
  const header = gid('matchHeader706'),
    speed = gid('scoreSpeed701'),
    last = gid('portraitLastTrickButton');
  const bar = document.querySelector('.in-game-leave');
  if (!header || !speed || !last || !bar) return;
  // Preserve the original scene/container ownership for landscape and lobby return.
  const speedHome = speed.parentElement,
    lastHome = last.parentElement,
    barHome = bar.parentElement;
  const scoreA = gid('scoreA'),
    scoreB = gid('scoreB');
  const make = (tag, id, cl, html = '') => {
    const e = document.createElement(tag);
    e.id = id;
    e.className = cl;
    if (html) e.innerHTML = html;
    return e;
  };
  const root = 'assets/house-premium-console/';
  const ui = make('div', 'housePremiumHud1020', 'house-premium-hud');
  ui.hidden = true;
  const plaque = make('div', 'housePremiumMatch1020', 'house-premium-match');
  plaque.innerHTML = `<img src="${root}top-match-plaque.png" alt="" aria-hidden="true" /><span class="house-score-number house-score-a" id="houseMatchScoreA1020"></span><span class="house-score-number house-score-b" id="houseMatchScoreB1020"></span>`;
  ui.appendChild(plaque);
  document.body.appendChild(ui);
  const clockConsole = make(
    'div',
    'housePremiumConsole1020',
    'house-premium-console',
    `<img class="house-premium-wood" src="${root}walnut-console-live-fields.png" alt="" aria-hidden="true"><time class="house-clock-zone" id="houseClock1020" aria-label="Phone local time"></time><div class="house-goal-zone" id="houseGoal1020" aria-label="Current hand objective"></div><div class="house-console-controls-holder" id="houseBottomSpeedStage1020"></div>`
  );
  clockConsole.hidden = true;
  document.body.appendChild(clockConsole);
  const connector = make(
    'img',
    'houseHolderConsoleConnector1020',
    'house-holder-console-connector'
  );
  connector.src = root + 'holder-console-walnut-connector.png';
  connector.alt = '';
  connector.setAttribute('aria-hidden', 'true');
  connector.hidden = true;
  connector.style.cssText = 'position:fixed;z-index:147;pointer-events:none;';
  document.body.appendChild(connector);
  const topStage = make('div', 'houseTopSpeedStage1020', 'house-pace-stage');
  document.body.appendChild(topStage);
  const bottomStage = make('div', 'houseBottomSpeedFrame1020', 'house-pace-stage');
  clockConsole.appendChild(bottomStage);
  const clock = gid('houseClock1020'),
    goal = gid('houseGoal1020');
  const scoreOutA = gid('houseMatchScoreA1020'),
    scoreOutB = gid('houseMatchScoreB1020');
  // Source controls have already been bound by game060.js. Reparenting preserves listeners.
  speed.classList.add('house-premium-speed');
  last.classList.add('house-premium-last');
  let fs = gid('horRailFullscreenReview');
  if (!fs) {
    fs = document.createElement('button');
    fs.type = 'button';
    fs.id = 'horRailFullscreenReview';
    bar.insertBefore(fs, bar.firstChild);
    fs.addEventListener('click', () => {
      if (window.HORFullscreen831?.toggle) return window.HORFullscreen831.toggle();
      if (document.fullscreenElement && document.exitFullscreen)
        return document.exitFullscreen().catch(() => {});
      if (document.documentElement.requestFullscreen)
        return document.documentElement.requestFullscreen().catch(() => {});
    });
  }
  // Keep the original menu and Back/Leave button handlers. Only change visual art/labels.
  const menu = gid('btnToggleTopOpts'),
    back = gid('leaveReplaceBtn');
  const originalMenu = menu?.innerHTML || '',
    originalBack = back?.innerHTML || '';
  fs.textContent = '';
  fs.setAttribute('aria-label', 'Full screen');
  if (menu) {
    menu.textContent = '';
    menu.setAttribute('aria-label', 'Game menu');
  }
  if (back) {
    back.textContent = '';
    back.setAttribute('aria-label', 'Back / leave table');
  }
  const vv = window.visualViewport;
  const installed = () =>
    Boolean(
      window.HORFullscreen831?.fitModeActive?.() ||
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        navigator.standalone === true ||
        ['fullscreen', 'standalone', 'minimal-ui'].some(
          (x) => matchMedia(`(display-mode: ${x})`).matches
        )
    );
  const set = (node, prop, val) => node?.style.setProperty(prop, val, 'important');
  const viewport = () => {
    const style = getComputedStyle(ui);
    const top = parseFloat(style.paddingTop) || 0,
      right = parseFloat(style.paddingRight) || 0,
      bottom = parseFloat(style.paddingBottom) || 0,
      left = parseFloat(style.paddingLeft) || 0;
    return {
      x: (vv?.offsetLeft || 0) + left,
      y: (vv?.offsetTop || 0) + top,
      w: (vv?.width || innerWidth) - left - right,
      h: (vv?.height || innerHeight) - top - bottom,
    };
  };
  const status = () => {
    try {
      const g = typeof game === 'object' && game ? game : null;
      if (!g) return ['Ready', 'to play'];
      const phase = String(g.phase || '');
      if (['bidding', 'deal', 'dealing'].includes(phase)) return ['Bidding', 'in progress'];
      const bid = Number(g.bid) || 0,
        bidder = Number(g.bidder);
      if (bid <= 0 || !Number.isInteger(bidder) || bidder < 0) return ['Next', 'hand'];
      if (phase === 'score' || phase === 'finished' || phase === 'gameover')
        return ['Hand', 'complete'];
      const team = bidder % 2,
        mine = (typeof myIndex === 'number' && myIndex >= 0 ? myIndex : 0) % 2;
      const pointsFor = (side) =>
        Array.isArray(g.tricksTaken?.[side]) && typeof cardPoints === 'function'
          ? g.tricksTaken[side].reduce((s, c) => s + (Number(cardPoints(c)) || 0), 0)
          : Number(g.handPoints?.[side]);
      const teamPts = pointsFor(team);
      if (mine === team) {
        if (!Number.isFinite(teamPts)) return ['Bid ' + bid, 'in progress'];
        const needed = Math.max(0, Math.ceil(bid - teamPts));
        return needed ? ['Need ' + needed, 'to make bid'] : ['Bid made', ''];
      }
      // To mathematically SET the bidding team we must capture enough counters
      // that their maximum possible score falls short of their bid.
      // The deck counter total varies with Red Two / Red One / ones toggles.
      const ownPts = pointsFor(mine);
      const total = typeof totalCountersInDeck === 'function' ? totalCountersInDeck() : NaN;
      if (!Number.isFinite(ownPts) || !Number.isFinite(total)) return ['Set them', 'Bid ' + bid];
      // Current rules award counters in multiples of five. Show the next
      // achievable counter total, rather than an impossible value such as 21.
      const toSet = Math.max(0, (Math.floor((total - bid - ownPts) / 5) + 1) * 5);
      return toSet ? ['Need ' + toSet, 'to set them'] : ['Opponents', 'set'];
    } catch (e) {
      return ['Hand', 'in progress'];
    }
  };
  function fitText(node) {
    node.style.removeProperty('font-size');
    const available = node.getBoundingClientRect().width - 4;
    if (available <= 0 || !node.textContent) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const width = range.getBoundingClientRect().width;
    if (width > available) {
      const size = parseFloat(getComputedStyle(node).fontSize);
      node.style.fontSize = ((size * available) / width).toFixed(2) + 'px';
    }
    range.detach();
  }
  const refresh = () => {
    const a = scoreA?.textContent.trim() || '0',
      b = scoreB?.textContent.trim() || '0';
    if (scoreOutA.textContent !== a) {
      scoreOutA.textContent = a;
      fitText(scoreOutA);
    }
    if (scoreOutB.textContent !== b) {
      scoreOutB.textContent = b;
      fitText(scoreOutB);
    }
    const now = new Date();
    const display = now.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    if (clock.textContent !== display) {
      clock.textContent = display;
      clock.dateTime = now.toISOString();
      fitText(clock);
    }
    const lines = status(),
      key = lines.join('|');
    if (goal.dataset.key !== key) {
      goal.dataset.key = key;
      goal.replaceChildren(
        ...lines.filter(Boolean).map((x) => {
          const s = document.createElement('span');
          s.textContent = x;
          return s;
        })
      );
    }
  };
  let premiumOwnsControls = false;
  function restoreOriginalControls() {
    // A game may launch directly in landscape before portrait ever owned it.
    // Restore native labels/hidden state even on that first inactive pass.
    fs.hidden = true;
    if (menu && menu.innerHTML !== originalMenu) menu.innerHTML = originalMenu;
    if (back && back.innerHTML !== originalBack) back.innerHTML = originalBack;
    // Release once at the ownership boundary. Repeated inactive layout calls
    // must not fight the existing landscape coordinator's viewport parent.
    if (!premiumOwnsControls) return;
    premiumOwnsControls = false;
    if (speed.parentElement !== speedHome) speedHome?.appendChild(speed);
    if (last.parentElement !== lastHome) lastHome?.appendChild(last);
    for (const prop of ['left', 'right', 'top', 'bottom', 'transform', 'translate'])
      bar.style.removeProperty(prop);
    if (document.body.classList.contains('in-game')) {
      // Native/maintained landscape code chooses its own parent and placement.
      window.positionRailControls035?.(bar);
    } else if (bar.parentElement !== barHome) barHome?.appendChild(bar);
  }
  function moveSpeed(host) {
    if (speed.parentNode !== host) host.appendChild(speed);
    if (last.parentNode !== host) host.appendChild(last);
  }
  function layout() {
    const active =
      document.body.classList.contains('in-game') &&
      matchMedia('(orientation:portrait)').matches &&
      !gid('game')?.classList.contains('hidden');
    ui.hidden = !active;
    connector.hidden = true;
    if (!active) {
      clockConsole.hidden = true;
      topStage.style.display = 'none';
      bottomStage.style.display = 'none';
      bar.classList.remove('house-utility-group');
      restoreOriginalControls();
      return;
    }
    premiumOwnsControls = true;
    fs.hidden = false;
    if (menu && menu.textContent) menu.textContent = '';
    if (back && back.textContent) back.textContent = '';
    bar.classList.add('house-utility-group');
    if (bar.parentNode !== document.body) document.body.appendChild(bar);
    const { x, y, w, h } = viewport(),
      full = installed();
    const hr = document.querySelector('.game-room > .hand-area')?.getBoundingClientRect();
    const free = hr ? y + h - hr.bottom : 0;
    const panelW = Math.floor(w - 2),
      panelH = Math.round((panelW * 192) / 941);
    const allowPanel = Boolean(full && hr && free >= panelH + 5 && w >= 320);
    const ico = Math.max(27, Math.min(34, Math.floor(w * 0.075))),
      gap = Math.max(3, Math.floor(w * 0.012));
    const iw = ico * 3 + gap * 2,
      paceW = Math.max(136, Math.min(176, w * 0.44));
    const stepH = Math.round((paceW * 109) / 415);
    // Owner correction: the plaque and utility buttons share one exact height/row.
    // Register the visible 619x93 silhouette; its transparent canvas margins do not count as artwork.
    const headerH = ico,
      headerW = (headerH * 619) / 93;
    const xScore = Math.round(x + 7),
      yScore = Math.round(y + 4);
    plaque.style.left = xScore + 'px';
    plaque.style.top = yScore + 'px';
    plaque.style.width = headerW + 'px';
    plaque.style.height = headerH.toFixed(2) + 'px';
    set(bar, '--house-tool-size', ico + 'px');
    set(bar, '--house-tool-gap', gap + 'px');
    set(bar, 'left', Math.round(full ? x + w - iw - 8 : x + w - iw - 8) + 'px');
    set(bar, 'right', 'auto');
    set(bar, 'top', yScore + 'px');
    set(bar, 'bottom', 'auto');
    set(ui, 'height', Math.round(allowPanel ? headerH + 8 : headerH + stepH + 13) + 'px');
    clockConsole.hidden = !allowPanel;
    if (allowPanel) {
      const top = Math.max(hr.bottom + 3, y + h - panelH - 2);
      set(clockConsole, 'left', Math.round(x + (w - panelW) / 2) + 'px');
      set(clockConsole, 'top', Math.round(top) + 'px');
      set(clockConsole, 'width', panelW + 'px');
      set(clockConsole, 'height', panelH + 'px');
      // Opaque finished walnut asset joins the existing holder to the console.
      // No CSS material or transparent photographic background between them.
      const joinTop = Math.floor(hr.bottom) - 1;
      connector.hidden = false;
      set(connector, 'left', Math.round(x + (w - panelW) / 2) + 'px');
      set(connector, 'top', joinTop + 'px');
      set(connector, 'width', panelW + 'px');
      set(connector, 'height', Math.ceil(top + (panelH * 20) / 192 - joinTop + 1) + 'px');
      // The 3 balanced photographic recesses are fixed in the physical asset.
      bottomStage.style.display = 'flex';
      topStage.style.display = 'none';
      bottomStage.style.position = 'absolute';
      bottomStage.style.left = (265 / 941) * 100 + '%';
      bottomStage.style.width = (415 / 941) * 100 + '%';
      bottomStage.style.top = (56 / 192) * 100 + '%';
      bottomStage.style.height = (109 / 192) * 100 + '%';
      // Console already contains the same complete physical frame.
      bottomStage.classList.add('house-console-pace');
      moveSpeed(bottomStage);
    } else {
      clockConsole.hidden = true;
      bottomStage.style.display = 'none';
      topStage.style.display = 'flex';
      set(topStage, 'left', Math.round(x + w - paceW - 7) + 'px');
      set(topStage, 'top', Math.round(yScore + headerH + 5) + 'px');
      set(topStage, 'width', Math.round(paceW) + 'px');
      set(topStage, 'height', Math.round(stepH) + 'px');
      moveSpeed(topStage);
    }
    fs.title = window.HORFullscreen831?.label?.() || (full ? 'Exit full screen' : 'Full screen');
    fs.setAttribute('aria-label', fs.title);
    document.body.dataset.housePremiumLayout = allowPanel ? 'installed-console' : 'browser-top';
    refresh();
    [scoreOutA, scoreOutB, clock].forEach(fitText);
    const noticeTop = Math.ceil(
      Math.max(
        plaque.getBoundingClientRect().bottom,
        bar.getBoundingClientRect().bottom,
        allowPanel ? 0 : topStage.getBoundingClientRect().bottom
      ) + 8
    );
    document.body.style.setProperty('--house-premium-notice-top', noticeTop + 'px');
  }
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      layout();
    });
  };
  for (const n of [
    'resize',
    'orientationchange',
    'pageshow',
    'fullscreenchange',
    'webkitfullscreenchange',
  ])
    addEventListener(n, schedule);
  vv?.addEventListener('resize', schedule);
  vv?.addEventListener('scroll', schedule);
  const scoreObserver = new MutationObserver(() => {
    refresh();
  });
  for (const e of [scoreA, scoreB])
    if (e) scoreObserver.observe(e, { characterData: true, childList: true, subtree: true });
  new MutationObserver(schedule).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
  if (typeof ResizeObserver === 'function') {
    const hr = document.querySelector('.game-room > .hand-area');
    if (hr) new ResizeObserver(schedule).observe(hr);
  }
  // Native gameplay calls positionRailControls035() on phase/turn updates.
  // It explicitly supports this hook.  Prevent the old scene-rail coordinator
  // from moving the owner-approved asset utility buttons onto the table.
  const previousRailCoordinator = window.HORRailControlsReview;
  window.HORRailControlsReview = {
    position(controls) {
      if (
        controls === bar &&
        document.body.classList.contains('in-game') &&
        matchMedia('(orientation:portrait)').matches &&
        !gid('game')?.classList.contains('hidden')
      ) {
        // Native positionRailControls035 runs during card animations.  It only
        // needs to defer to the already-positioned asset controls here.
        // Re-scheduling layout from this callback caused reentrant redraw work.
        return true;
      }
      return previousRailCoordinator?.position?.(controls) === true;
    },
  };
  setInterval(() => {
    if (document.body.classList.contains('in-game')) refresh();
  }, 750);
  if (document.readyState === 'loading')
    addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
  window.HORPremiumUI1020 = {
    refresh,
    layout,
    fitText,
    noticeLimit: () =>
      document.body.classList.contains('in-game') && matchMedia('(orientation:portrait)').matches
        ? 1
        : undefined,
  };
})();

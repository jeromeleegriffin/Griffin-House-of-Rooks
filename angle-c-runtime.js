/* Isolated integration: presentation only; existing game nodes retain handlers. */
(() => {
  const active = () =>
    document.body.classList.contains('in-game') && matchMedia('(orientation:landscape)').matches;
  const frame = () => {
    const w = innerWidth,
      h = innerHeight,
      s = Math.max(w / 1844, h / 853);
    return { scale: s, left: (w - 1844 * s) / 2, top: Math.max(0, (h - 853 * s) / 2) };
  };
  const point = (x, y) => {
    const g = frame();
    return { x: g.left + x * g.scale, y: g.top + y * g.scale };
  };
  const packetPoints = {
    'slot-me': [1060, 560],
    'slot-partner': [922, 315],
    'slot-left': [475, 430],
    'slot-right': [1369, 430],
  };
  function dealPacket() {
    return point(
      ...(packetPoints[seatSlotIdForIndex(game?.dealer ?? 0)] || packetPoints['slot-me'])
    );
  }
  function dealTarget(player) {
    const g = frame(),
      targets = {
        'slot-me': [922, 730],
        'slot-partner': [922, 330],
        'slot-left': [475, 430],
        'slot-right': [1369, 430],
      };
    if (player === 'nest') {
      const n = Number(window.__dealNest036?.count) || 0,
        landing = nestLanding037(n);
      return {
        x: innerWidth / 2 + landing.x * g.scale,
        y: (window.HORLowerLayout?.nestY ?? point(922, 440).y) + landing.y * g.scale,
      };
    }
    if (player === myIndex) {
      const l = window.HORLowerLayout;
      return { x: innerWidth / 2, y: l?.handBottom ?? point(922, 730).y };
    }
    return point(...(targets[seatSlotIdForIndex(player)] || targets['slot-me']));
  }
  window.HORAngleC = { active, frame, dealPacket, dealTarget };
  document.body.classList.add('angle-c-runtime');

  window.HORLandscapeTrumpGeometry = {
    active,
    frame,
    origin(direction) {
      const g = frame(),
        p = { top: [922, 285], left: [420, 425], right: [1424, 425] }[direction];
      return { x: g.left + p[0] * g.scale, y: g.top + p[1] * g.scale };
    },
    geometry() {
      const g = frame(),
        t = trickLayout();
      return { ...g, x: t.cx, y: t.cy };
    },
    position(root) {
      const g = frame(),
        w = Math.min(560 * g.scale, innerWidth * 0.72, innerHeight * 1.18);
      root.style.width = w + 'px';
      root.style.left = innerWidth / 2 + 'px';
      root.style.top =
        Math.max(44, (window.HORLowerLayout?.handY ?? innerHeight * 0.72) - w / 2.86 - 10) + 'px';
    },
    paint(ctx, image) {
      const g = this.geometry(),
        w = 264 * g.scale,
        h = w * 0.48;
      ctx.drawImage(image, g.x - w / 2, g.y - h / 2, w, h);
    },
  };
  function trickLayout() {
    const g = frame(),
      l = window.HORLowerLayout,
      s = g.scale,
      far = g.top + 292 * s,
      near = (l?.handY ?? innerHeight * 0.72) - 8 * s,
      space = near - far,
      compact = space < 230 * s;
    return {
      cx: innerWidth / 2,
      cy: compact ? (far + near) / 2 : Math.min(g.top + 425 * s, near - 132 * s),
      compact,
      width: compact ? Math.max(32, Math.min(126 * s, ((space - 6) * 580) / 840 / 0.65)) : 126 * s,
    };
  }
  function placePlays() {
    if (!active()) return;
    const g = frame(),
      t = trickLayout(),
      { cy, cx } = t;
    const seats = t.compact
      ? {
          'slot-me': [-55, 0, -10],
          'slot-left': [-180, 0, 100],
          'slot-partner': [55, 0, 175],
          'slot-right': [180, 0, -75],
        }
      : {
          'slot-me': [0, 72, -10],
          'slot-left': [-140, 0, 100],
          'slot-partner': [0, -36, 175],
          'slot-right': [140, 0, -75],
        };
    for (const el of document.querySelectorAll('#ltPlays .lt-play')) {
      const seat = seats[el.dataset.cSeat];
      if (!seat) continue;
      let hash = 2166136261;
      for (const ch of el.dataset.cPlay || '')
        hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
      const x = cx + (seat[0] + ((hash & 255) / 255 - 0.5) * 10) * g.scale,
        y = cy + (seat[1] + (((hash >>> 8) & 255) / 255 - 0.5) * 8) * g.scale;
      el.style.setProperty('--c-toss-x', x + 'px');
      el.style.setProperty('--c-toss-y', y + 'px');
      el.style.setProperty('--c-toss-angle', seat[2] + 'deg');
    }
  }
  function fit() {
    if (!active()) return;
    const g = frame(),
      n = document.querySelectorAll('#ltHand>.card-face').length || 10,
      s = g.scale;
    const gutter = Math.min(126, Math.max(106, innerWidth * 0.12)),
      holderW = Math.min(1320 * s, innerWidth - 2 * gutter),
      holderX = (innerWidth - holderW) / 2;
    const slotY = Math.min(g.top + 753 * s, innerHeight - (holderW * 117) / 2179 - 12),
      bottom = slotY + 18 * s;
    const usable = Math.min(1110 * s, holderW * 0.82),
      growth = innerHeight >= 740 * s ? Math.max(0, 10 - n) * 4 : 0,
      cw = Math.min(150, 114 + growth) * s,
      ch = (cw * 840) / 580;
    const gap = n > 1 ? Math.min(2 * s, (usable - n * cw) / (n - 1)) : 0,
      hw = n * cw + Math.max(0, n - 1) * gap,
      y = bottom - ch;
    const bh = Math.min(225 * s, innerHeight * 0.3),
      bw = (bh * 701) / 290,
      bidY = Math.max(44, y - bh - 5),
      bidX = innerHeight < 740 * s ? innerWidth * 0.3 : innerWidth / 2;
    document.body.style.setProperty('--polish-scale', s);
    document.body.style.setProperty('--polish-claim-scale', Math.min(1.45, s * 1.45));
    window.HORLowerLayout = {
      handY: y,
      handBottom: bottom,
      holderW,
      holderX,
      slotY,
      bidY,
      nestY: Math.max(g.top + 345 * s, Math.min(g.top + 440 * s, y - 60 * s)),
      holderY: slotY - (holderW * 353) / 2179,
      holderH: (holderW * 722) / 2179,
      scale: s,
      bidX,
      bidW: bw,
      bidH: bh,
    };
    const play = trickLayout();
    const vars = {
      'hand-x': innerWidth / 2 - hw / 2,
      'hand-y': y,
      'hand-w': hw,
      'card-w': cw,
      'card-h': ch,
      'card-gap': gap,
      'nest-y': window.HORLowerLayout.nestY,
      'scene-scale': s,
      'bid-x': bidX,
      'bid-y': bidY,
      'bid-w': bw,
      'bid-h': bh,
      'play-w': play.width,
      'play-h': (play.width * 840) / 580,
      'wide-scene-w': 1844 * s,
      'wide-scene-h': 853 * s,
      'scene-left': g.left,
      'scene-top': g.top,
      'header-x': 10,
      'header-w': Math.max(86, holderX - 20),
    };
    for (const [k, v] of Object.entries(vars))
      document.body.style.setProperty('--c-' + k, v + 'px');
    placePlays();
    window.HORAngleCCharacters?.sync();
    const nav = document.querySelector('.in-game-leave');
    if (nav) window.positionRailControls035?.(nav);
  }
  window.HORLowerFit = fit;
  const plays = document.getElementById('ltPlays');
  if (plays) new MutationObserver(placePlays).observe(plays, { childList: true });
  const hand = document.getElementById('ltHand');
  if (hand) new MutationObserver(fit).observe(hand, { childList: true });
  new MutationObserver(fit).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
  const consoleNode = document.getElementById('decisionConsole');
  if (consoleNode) {
    let queued = false;
    new MutationObserver(() => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          fit();
        });
      }
    }).observe(consoleNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'class'],
    });
  }
  const originalRail = window.positionRailControls035;
  if (originalRail)
    window.positionRailControls035 = function (controls) {
      if (!active()) return originalRail(controls);
      if (!controls._railHome035) controls._railHome035 = controls.parentNode;
      if (controls.parentNode !== document.body) document.body.append(controls);
      for (const [k, v] of Object.entries({
        left: 'auto',
        right: 'max(10px, env(safe-area-inset-right))',
        top: 'auto',
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        transform: 'none',
        translate: 'none',
      }))
        controls.style.setProperty(k, v, 'important');
    };
  addEventListener('resize', fit);
  fit();
})();

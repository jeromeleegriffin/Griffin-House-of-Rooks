/* House of Rooks — table polish layer
 * Author: Jerome Griffin
 * Copyright (c) 2026 Jerome Griffin / Griffin House
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const PREF_KEY = 'horPrefs';

  const EXP_KEY = 'horTestingTab';
  const EXP_IDS = [
    'netSequencing',
    'netReconnect',
    'netBackoff',
    'netHeartbeat',
    'netDelta',
    'netAuthoritative',
    'netTimerSync',
    'netDuplicateGuard',
    'netTurnGuard',
    'netConnectionUI',
    'netTurnHandoff',
    'netOwnTurnRecovery',
    'netDiagnostics',
    'netGraceRecovery',
    'netSameIdResync',
    'netNameReclaim',
    'netActionQueue',
    'netIceWatch',
    'netResyncOnReclaim',
    'netHoldTimerOnDisconnect',
    'netSilentDropDetect',
    'tableAtmosphere',
    'rookAnimation',
    'cardJuice',
    'avatarPersonality',
    'statusIndicators',
    'matchProgress',
    'lobbyReconnect',
    'friendlyErrors',
    'renderOptimization',
    'debugPanel',
    'customTurnServers',
    'hostMigration',
    'seatPips',
    'thinkingPulse',
    'confirmPlay',
    'lagSandbox',
    'webpRookArt',
    'waitingQrAuto',
    'turnAlert',
    'coachOverlay',
    'careerStats',
    'shareHandCard',
    'tournamentLock',
    'spectatorLateJoin',
    'hostKickMute',
    'partnerChatAfterNest',
    'rulesSelfTest',
    'botStrengthLabels',
    'landscapeDock',
    'waitForMe',
    'rematchSameFour',
    'hostHonorHands',
    'pwaInstallSheet',
    'localPeerOnly',
    'extraTableThemes',
    'highlightReelTools',
    'syncedTrickAnim',
    'tvTableDisplay',
    'devModuleMap',
  ];
  const NET_ALWAYS_ON = [
    'netSequencing',
    'netReconnect',
    'netBackoff',
    'netHeartbeat',
    'netDelta',
    'netAuthoritative',
    'netTimerSync',
    'netDuplicateGuard',
    'netTurnGuard',
    'netConnectionUI',
    'netTurnHandoff',
    'netOwnTurnRecovery',
    'netDiagnostics',
    'netGraceRecovery',
    'netSameIdResync',
    'netNameReclaim',
    'netActionQueue',
    'netIceWatch',
    'netResyncOnReclaim',
    'netHoldTimerOnDisconnect',
    'netSilentDropDetect',
    'lobbyReconnect',
  ];
  const FEATURE_ALWAYS_ON = [
    'customTurnServers',
    'thinkingPulse',
    'spectatorLateJoin',
    'partnerChatAfterNest',
    'waitForMe',
    'hostHonorHands',
    'avatarPersonality',
    'renderOptimization',
  ];
  function forceNetAlwaysOn(o) {
    const next = o || {};
    NET_ALWAYS_ON.forEach((id) => {
      next[id] = true;
    });
    FEATURE_ALWAYS_ON.forEach((id) => {
      next[id] = true;
    });
    return next;
  }
  function defaultExperimental() {
    const o = {};
    EXP_IDS.forEach((id) => (o[id] = false));
    return forceNetAlwaysOn(o);
  }
  function loadExperimental() {
    return defaultExperimental();
  }
  function saveExperimental(next) {
    const clean = forceNetAlwaysOn(Object.assign(defaultExperimental(), next || {}));
    delete clean.cacheRefresh;
    try {
      localStorage.setItem(EXP_KEY, JSON.stringify(clean));
    } catch (e) {}
    window.horExperimental = clean;
    return clean;
  }
  function applyExperimental() {
    const source = defaultExperimental();
    const exp = (window.horExperimental = forceNetAlwaysOn(
      Object.assign(defaultExperimental(), source || {})
    ));
    window.__horExpInitialized = true;
    EXP_IDS.forEach((id) => document.body.classList.toggle('exp-' + id, !!exp[id]));
    const inputs = document.querySelectorAll('[data-exp]');
    inputs.forEach((i) => {
      i.checked = !!exp[i.getAttribute('data-exp')];
    });
    updateExperimentalUI();
    try {
      if (typeof horStartHeartbeat === 'function') horStartHeartbeat();
    } catch (e) {}
    if (exp.netConnectionUI || exp.netDiagnostics) ensureConnectionBadge();
    else removeConnectionBadge();
    try {
      applyTestingFeatures(exp);
    } catch (e) {
      console.error('applyTestingFeatures', e);
    }
    try {
      const box = $('reconnectBox');
      if (box) {
        let show = false;
        if (exp.lobbyReconnect) {
          const raw = sessionStorage.getItem('rookSession');
          show = !!(raw && JSON.parse(raw).roomCode);
        }
        box.classList.toggle('hidden', !show);
      }
    } catch (e) {}
  }
  function updateExperimentalUI() {
    document.querySelectorAll('[data-exp]').forEach((input) => {
      const id = input.getAttribute('data-exp');
      input.checked = !!(window.horExperimental && window.horExperimental[id]);
    });
  }
  function wireExperimentalOptions() {
    window.horExperimental = defaultExperimental();
    window.__horExpInitialized = true;
  }
  window.applyHorExperimental = applyExperimental;
  window.loadHorExperimental = loadExperimental;
  window.saveHorExperimental = saveExperimental;
  const nativeAlert = window.alert.bind(window);
  if (!window.__horAlertWrapped) {
    window.alert = function (msg) {
      if (window.horExperimental && window.horExperimental.friendlyErrors) {
        horToast(String(msg || ''));
      } else nativeAlert(msg);
    };
    window.__horAlertWrapped = true;
  }

  function ensureConnectionBadge() {
    const offline =
      (typeof isSoloPractice !== 'undefined' && isSoloPractice) ||
      (typeof roomCode !== 'undefined' && roomCode === 'OFFLINE');
    if (offline) {
      removeConnectionBadge();
      return;
    }
    let b = $('horConnectionBadge');
    if (!b) {
      b = document.createElement('span');
      b.id = 'horConnectionBadge';
      b.className = 'hor-connection-badge';
      b.textContent = '● Connected';
      const row = $('phaseRow') || document.querySelector('.phase-row');
      if (row) row.appendChild(b);
      else {
        const phase = $('phaseLabel');
        if (phase && phase.parentNode) phase.parentNode.insertBefore(b, phase.nextSibling);
        else document.body.appendChild(b);
      }
    }
    // For the host, actually check the Peer's live connection to the
    // signaling server (peer.open && !peer.disconnected) rather than just
    // the isHost flag — isHost stays true even if the underlying socket to
    // 0.peerjs.com has silently dropped in the background, which used to
    // make this badge claim "Connected" when it wasn't.
    const online = isHost
      ? typeof peer !== 'undefined' && !!peer && !!peer.open && !peer.disconnected
      : typeof hostConnection !== 'undefined' && hostConnection && hostConnection.open;
    const ping = Number(window.horLastPingMs);
    b.textContent = online
      ? '● Connected' +
        (window.horExperimental.netDiagnostics && Number.isFinite(ping)
          ? ' · ' + Math.round(ping) + ' ms'
          : '')
      : '● Reconnecting…';
    b.classList.toggle('bad', !online);
    b.classList.remove('hidden');
  }
  function removeConnectionBadge() {
    const b = $('horConnectionBadge');
    if (b) b.remove();
  }

  function experimentalTick() {
    if (window.horExperimental.netConnectionUI || window.horExperimental.netDiagnostics)
      ensureConnectionBadge();
    if (
      (window.horExperimental.netTurnHandoff || window.horExperimental.netOwnTurnRecovery) &&
      typeof game !== 'undefined' &&
      game &&
      !game.paused &&
      game.currentPlayer === myIndex
    ) {
      try {
        if (typeof renderUI === 'function') renderUI();
      } catch (e) {}
    }
    try {
      tickTestingFeatures();
    } catch (e) {}
  }
  setInterval(experimentalTick, 1200);

  window.handsPlayedSession = window.handsPlayedSession || 0;
  window.coachForcedOff = true;

  function seatElForIndex(idx) {
    if (typeof seatSlotIdForIndex === 'function') return $(seatSlotIdForIndex(idx));
    return null;
  }

  function applyTestingFeatures() {
    window.coachForcedOff = true;
    document.body.classList.add('hor-honor-hands');
    const xfer = $('btnTransferHost');
    if (xfer && isHost && !isSoloPractice) xfer.classList.remove('hidden');
    ensureWaitForMeBtn();
    wrapTestingHooks();
  }
  function tickTestingFeatures() {
    paintThinkingPulse();
    ensureWaitForMeBtn();
    stripHostPeek();
  }
  function paintThinkingPulse() {
    document
      .querySelectorAll('.player-slot')
      .forEach((n) => n.classList.remove('hor-thinking-pulse'));
    if (typeof game === 'undefined' || !game || game.paused || game.resolvingTrick) return;
    let idx = -1;
    if (game.phase === 'play' || game.phase === 'bidding') idx = game.currentPlayer;
    else if (game.phase === 'discard' || game.phase === 'trump') idx = game.bidder;
    const el = seatElForIndex(idx);
    if (el) el.classList.add('hor-thinking-pulse');
  }

  function ensureWaitForMeBtn() {
    let b = $('horWaitForMeBtn');
    if (!b) {
      b = document.createElement('button');
      b.id = 'horWaitForMeBtn';
      b.type = 'button';
      b.className = 'icon-btn';
      b.title = 'Wait for me';
      b.textContent = '✋';
      const bar = $('topToolbar') || document.body;
      bar.appendChild(b);
      b.onclick = () => {
        if (typeof game === 'undefined' || !game) return;
        try {
          if (typeof isHost !== 'undefined' && isHost && typeof hostTogglePause === 'function') {
            if (game.paused) {
              hostTogglePause();
              horToast('Resumed');
              return;
            }
            if (game._waitUsed) {
              horToast('Already used Wait for me this hand');
              return;
            }
            game._waitUsed = true;
            hostTogglePause();
            horToast('Table paused — Wait for me');
            return;
          }
          if (game._waitUsed) {
            horToast('Already used Wait for me this hand');
            return;
          }
          game._waitUsed = true;
          if (typeof hostConnection !== 'undefined' && hostConnection && hostConnection.open)
            hostConnection.send({ type: 'buyTableMsg', text: 'Wait for me — please pause' });
          horToast('Wait for me sent');
        } catch (e) {}
      };
    }
    if (
      typeof game !== 'undefined' &&
      game &&
      game.paused &&
      typeof isHost !== 'undefined' &&
      isHost
    ) {
      b.textContent = '▶';
      b.title = 'Resume table';
    } else {
      b.textContent = '✋';
      b.title = 'Wait for me';
    }
  }

  function stripHostPeek() {
    if (typeof isHost === 'undefined' || !isHost) return;
    document
      .querySelectorAll(
        '.player-slot:not(#slot-me) .mini-hand, .player-slot:not(#slot-me) .peek-hand'
      )
      .forEach((n) => n.remove());
  }

  function wrapTestingHooks() {
    if (window.__horTestWrapped) return;
    window.__horTestWrapped = true;
    if (typeof peerOptions === 'function') {
      const origPeer = peerOptions;
      window.peerOptions = function () {
        const o = origPeer();
        if (horExpOn('customTurnServers')) {
          o.config = o.config || {};
          o.config.iceServers = (o.config.iceServers || []).concat([
            { urls: 'stun:stun2.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:80?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject',
            },
          ]);
        }
        return o;
      };
    }
  }

  function asText(v, fallback) {
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s || s === '[object Object]') return fallback;
      return s;
    }
    if (v && typeof v === 'object' && typeof v.value === 'string') {
      const s = v.value.trim();
      return s && s !== '[object Object]' ? s : fallback;
    }
    return fallback;
  }

  let houseTeamA = 'Griffin';
  let houseTeamB = 'Raven';

  function teamLabel(i) {
    return Number(i) === 1 ? houseTeamB : houseTeamA;
  }
  window.teamLabel = teamLabel;
  function paintTeamChrome() {
    const a = teamLabel(0);
    const b = teamLabel(1);
    const set = (id, v) => {
      const el = $(id);
      if (el) el.textContent = v;
    };
    set('ltTeamNameA', a);
    set('ltTeamNameB', b);
    set('scoreTeamNameA', a);
    set('scoreTeamNameB', b);
    set('waitTeamLabelA', a);
    set('waitTeamLabelB', b);
  }
  window.paintTeamChrome = paintTeamChrome;

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }
  function savePrefs(patch) {
    const cur = Object.assign(loadPrefs(), patch || {});
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(cur));
    } catch (e) {}
    return cur;
  }
  window.horSavePrefs = savePrefs;
  window.horLoadPrefs = loadPrefs;

  const ROOM_THEMES = {
    house: 'Griffin House — green felt, oak rail.',
    midnight: 'Midnight Club — navy felt, silver rail.',
    riverboat: 'Riverboat — crimson felt, gold rail.',
    cabin: 'Pine Cabin — moss felt, raw timber.',
    speakeasy: 'Speakeasy — black felt, brass lamp light.',
    slate: 'Slate Room — pewter felt, steel rail.',
    burgundy: 'Burgundy Hall — wine felt, copper rail.',
    ember: 'Ember Den — charcoal felt, copper glow.',
    harbor: 'Harbor House — teal felt, weathered brass.',
    sandbar: 'Sandbar — desert felt, bone rail.',
    ivy: 'Ivy Loft — forest felt, antique gold.',
    frost: 'Frost Parlor — ice felt, chrome rail.',
    cocoa: 'Cocoa Club — chocolate felt, bronze rail.',
    plum: 'Plum Study — violet felt, pale gold.',
    ink: 'Ink Vault — indigo felt, gunsteel rail.',
  };
  function applyRoomTheme(id, persist) {
    const theme = ROOM_THEMES[id] ? id : 'midnight';
    Object.keys(ROOM_THEMES).forEach((k) => document.body.classList.remove('room-theme-' + k));
    document.body.classList.add('room-theme-' + theme);
    if (persist !== false) savePrefs({ roomTheme: theme });
    /* room theme class only */
  }
  window.applyRoomTheme = applyRoomTheme;
  window.horRoomThemeIds = Object.keys(ROOM_THEMES);

  const GFX_KEEP = [
    'feltTexture',
    'woodRail',
    'roomBackdrop',
    'richFaces',
    'winnerBurst',
    'trumpBanner',
    'seatPlaques',
    'paintedAvatars',
    'tavernScore',
    'handBanner',
    'matchTrophy',
    'brassUI',
    'waitingProps',
    'hapticsHeavy',
  ];
  const GFX_DROP = [
    'themeBacks',
    'dealArc',
    'playFly',
    'trickFan',
    'bidChips',
    'nestSeal',
    'laydownSlam',
    'lightContrast',
  ];
  function defaultGfx() {
    const o = {};
    GFX_KEEP.forEach((id) => {
      o[id] = true;
    });
    GFX_DROP.forEach((id) => {
      o[id] = false;
    });
    return o;
  }
  function loadGfx() {
    return defaultGfx();
  }
  function gfxOn(id) {
    return GFX_KEEP.indexOf(id) >= 0;
  }
  window.gfxOn = gfxOn;
  function applyGfx() {
    const gfx = defaultGfx();
    window.horGfx = gfx;
    GFX_KEEP.forEach((id) => document.body.classList.add('gfx-' + id));
    GFX_DROP.forEach((id) => document.body.classList.remove('gfx-' + id));
  }
  window.applyGfx = applyGfx;

  function persistPlayer() {
    const name = asText(
      ($('hor-player-name') && $('hor-player-name').value) ||
        (typeof myName === 'string' ? myName : ''),
      ''
    );
    savePrefs({
      name,
      avatar:
        (typeof playerAvatars !== 'undefined' && playerAvatars[myPeerId]) || loadPrefs().avatar,
      botDifficulty,
      ruleVariant,
      includeOnes,
      includeRed2,
      includeRed1,
      includeRook,
      rookLowest,
      red2Points,
      minBid,
      targetScore,
      specialsAnytime,
      mustTrumpWhenVoid,
      bidOnlyScoring,
      nestGoesTo,
      leadOrder,
      misdealOnNoCounters,
      screwTheDealer,
      comebackSpecialChance,
      openWidow,
      revealTopNest,
      shootMoonEnabled,
      teamNameA: houseTeamA,
      teamNameB: houseTeamB,
      roomTheme: loadPrefs().roomTheme || 'midnight',
      gfx: loadGfx(),
      gfxRev: 2,
      experimental: loadExperimental(),
      sawRules: loadPrefs().sawRules || false,
    });
  }

  function applyPrefsToEngine() {
    const p = loadPrefs();
    if (p.botDifficulty) botDifficulty = p.botDifficulty;
    else botDifficulty = 'extreme';
    if (p.ruleVariant) ruleVariant = p.ruleVariant;
    if (typeof p.includeOnes === 'boolean') includeOnes = p.includeOnes;
    if (typeof p.includeRed2 === 'boolean') includeRed2 = p.includeRed2;
    if (typeof p.includeRed1 === 'boolean') includeRed1 = p.includeRed1;
    if (typeof p.includeRook === 'boolean') includeRook = p.includeRook;
    if (typeof p.rookLowest === 'boolean') rookLowest = p.rookLowest;
    if (p.red2Points) red2Points = p.red2Points;
    if (p.minBid) minBid = p.minBid;
    if (p.targetScore) targetScore = normalizeTargetScore(p.targetScore);
    if (typeof p.specialsAnytime === 'boolean') specialsAnytime = p.specialsAnytime;
    if (typeof p.mustTrumpWhenVoid === 'boolean') mustTrumpWhenVoid = p.mustTrumpWhenVoid;
    if (typeof p.bidOnlyScoring === 'boolean') bidOnlyScoring = p.bidOnlyScoring;
    if (p.nestGoesTo) nestGoesTo = p.nestGoesTo;
    if (p.leadOrder) leadOrder = p.leadOrder;
    if (typeof p.misdealOnNoCounters === 'boolean') misdealOnNoCounters = p.misdealOnNoCounters;
    if (typeof p.screwTheDealer === 'boolean') screwTheDealer = p.screwTheDealer;
    if (typeof p.comebackSpecialChance === 'boolean')
      comebackSpecialChance = p.comebackSpecialChance;
    if (typeof p.openWidow === 'boolean') openWidow = p.openWidow;
    if (typeof p.revealTopNest === 'boolean') revealTopNest = p.revealTopNest;
    if (typeof p.shootMoonEnabled === 'boolean') shootMoonEnabled = p.shootMoonEnabled;
    houseTeamA = asText(p.teamNameA, 'Griffin');
    houseTeamB = asText(p.teamNameB, 'Raven');
    try {
      if (typeof recomputeHandAndNest === 'function') recomputeHandAndNest();
    } catch (e) {}
    try {
      if (typeof syncOptionsUI === 'function') syncOptionsUI();
    } catch (e) {}
    applyRoomTheme(p.roomTheme || 'midnight', false);
    applyGfx(p.gfx || loadGfx());
    window.horExperimental = loadExperimental();
    applyExperimental();
  }

  function applyPreset(id) {
    // Only the Griffin House ruleset exists now — Tournament and Kitchen
    // Table were removed as presets.
    if (typeof applyGriffinDefaults === 'function')
      applyGriffinDefaults({ broadcastChange: false });
    ruleVariant = 'griffin';
    try {
      recomputeHandAndNest();
    } catch (e) {}
    try {
      syncOptionsUI();
    } catch (e) {}
    document.querySelectorAll('.preset-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-preset') === ruleVariant);
    });
    const lab = $('rulesetLabel');
    if (lab) lab.textContent = 'Griffin House';
    persistPlayer();
    try {
      if (isHost && typeof broadcastPlaySettings === 'function') broadcastPlaySettings();
    } catch (e) {}
    updateNestDestChip();
    showVariantRules();
  }
  window.applyHousePreset = applyPreset;

  function speakCode(code) {
    const letters = {
      A: 'A as in Able',
      B: 'B as in Baker',
      C: 'C as in Charlie',
      D: 'D as in Delta',
      E: 'E as in Eagle',
      F: 'F as in Fox',
      G: 'G as in Griffin',
      H: 'H as in House',
      J: 'J as in Jackal',
      K: 'K as in King',
      L: 'L as in Lark',
      M: 'M as in Maple',
      N: 'N as in Nest',
      P: 'P as in Partner',
      Q: 'Q as in Queen',
      R: 'R as in Raven',
      S: 'S as in Seat',
      T: 'T as in Trump',
      U: 'U as in Under',
      V: 'V as in Void',
      W: 'W as in Widow',
      X: 'X as in Extra',
      Y: 'Y as in Yellow',
      Z: 'Z as in Zest',
      '2': 'two',
      '3': 'three',
      '4': 'four',
      '5': 'five',
      '6': 'six',
      '7': 'seven',
      '8': 'eight',
      '9': 'nine',
    };
    const parts = String(code || '')
      .toUpperCase()
      .split('')
      .map((ch) => letters[ch] || ch);
    const line = $('speakCodeLine');
    if (line && code && code !== 'OFFLINE') line.textContent = parts.join(' · ');
    return parts.join(', ');
  }

  function updateNestDestChip() {
    const el = $('nestGoesBadge');
    if (!el) return;
    el.textContent = nestGoesTo === 'bidder' ? 'Nest → makers' : 'Nest → last trick';
    el.classList.remove('hidden');
  }

  function setTurnBanner(text, mine) {
    const el = $('turnBanner');
    if (!el) return;
    if (!text) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.textContent = text;
    el.classList.toggle('mine', !!mine);
    el.classList.remove('hidden');
  }

  function refreshTurnBanner() {
    setTurnBanner('');
  }

  function colorLabel(c) {
    try {
      if (typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES && COLOR_NAMES[c])
        return COLOR_NAMES[c];
    } catch (e) {}
    return c || 'that color';
  }
  function illegalReason(card) {
    if (!card) return 'Not a legal play';
    if (!game) return 'Hand is not in play yet';
    if (game.phase && game.phase !== 'play') {
      if (game.phase === 'bidding') return 'Bidding is still going — cards cannot be played yet';
      if (game.phase === 'discard') return 'Nest discard first — not a play card right now';
      if (game.phase === 'trump') return 'Trump is being named — wait to play';
      return 'Not a play turn';
    }
    if (game.paused) return 'Play is paused';
    if (game.resolvingTrick) return 'Trick is finishing';
    if (typeof myIndex === 'number' && game.currentPlayer !== myIndex) return 'Not your turn';
    const hand = game.myHand || [];
    const led = game.ledColor;
    const trump = game.trump;
    try {
      if (typeof canPlay === 'function' && canPlay(card, hand, led, trump)) return '';
    } catch (e) {}
    if (!led) return 'Not a legal play right now';

    let hasLed = false;
    try {
      hasLed = hand.some((c) =>
        typeof followsLedSuit === 'function' ? followsLedSuit(c, led, trump) : c && c.color === led
      );
    } catch (e) {
      hasLed = hand.some((c) => c && c.color === led);
    }
    if (hasLed) {
      return 'Must follow ' + colorLabel(led);
    }
    if (mustTrumpWhenVoid) {
      return 'You have no ' + colorLabel(led) + ' — must play trump';
    }
    return 'Not a legal play';
  }

  function tapHaptic(ok) {
    if (reduceMotion) return;
    try {
      if (!ok) return;
      if (navigator.vibrate) navigator.vibrate(12);
    } catch (e) {}
  }

  function showWhy(text, x, y) {
    const tip = $('illegalWhy');
    if (!tip || !text) return;
    tip.textContent = text;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - 180, x - 70)) + 'px';
    tip.style.top = Math.max(8, y - 48) + 'px';
    tip.classList.remove('hidden');
    clearTimeout(window._whyTimer);
    window._whyTimer = setTimeout(() => tip.classList.add('hidden'), 2600);
  }

  function houseConfirm({ title, body, danger }) {
    return new Promise((resolve) => {
      const sheet = $('confirmSheet');
      if (!sheet) {
        resolve(window.confirm(body || title));
        return;
      }
      $('confirmTitle').textContent = title || 'Please confirm';
      $('confirmBody').textContent = body || '';
      sheet.classList.toggle('leave-table-confirm', /^Leave this table\?$/i.test(title || ''));
      const ok = $('confirmOk');
      ok.classList.toggle('danger', danger !== false);
      sheet.classList.remove('hidden');
      if (!sheet.open) sheet.showModal();
      const done = (val) => {
        sheet.close();
        sheet.classList.add('hidden');
        sheet.classList.remove('leave-table-confirm');
        ok.onclick = null;
        $('confirmCancel').onclick = null;
        sheet.oncancel = null;
        resolve(val);
      };
      sheet.oncancel = (e) => {
        e.preventDefault();
        done(false);
      };
      ok.onclick = () => done(true);
      $('confirmCancel').onclick = () => done(false);
    });
  }
  window.houseConfirm = houseConfirm;

  const PLAY_TIPS = {
    lobby: {
      title: 'New at this table',
      html: '<p>Use the <b>gold play button</b> to start a game with bots. You can edit your name, portrait or voice before playing. Tips pop up as the hand happens — bid, nest, trump, tricks, then scoring.</p><p>Friends tables work the same way. Skip anytime if you already know it.</p>',
    },
    sit: {
      title: 'Partners sit across',
      html: '<p>You and the chair facing you are one team. The two beside you are the other. First team to the table target wins the match.</p>',
    },
    bidding: {
      title: 'The auction is on',
      html: () =>
        '<p>A bid is the number of points your team promises to capture this hand. The minimum is ' +
        minBid +
        '. Raise to an amount divisible by five above the current bid, or pass. Passing takes you out of this auction. The last bidder remaining wins the nest (also called the kitty).</p><p>Point cards: 5s = 5; 10s and 14s = 10. ' +
        (includeOnes ? '1s = 15. ' : '') +
        (includeRook ? 'Blackbird = 20. ' : '') +
        (includeRed2 ? 'Red Two = ' + red2Points + '. ' : '') +
        (includeRed1 ? 'Special Red One = 30. ' : '') +
        'Other cards are worth no points.</p>',
    },
    myBid: {
      title: 'Your bid',
      html: '<p>Tap or hold +5 / −5 to choose an amount, then tap Bid. Or tap Pass to leave this auction. Bid only as many points as you think your team can capture. If your team misses its bid, it loses that many points.</p>',
    },
    nest: {
      title: 'Choosing your hand',
      html: () => {
        const count =
          game?.phase === 'discard'
            ? game.discardCount ||
              game.kittyTaken?.length ||
              game.nestPreview?.length ||
              nestSizeDefault
            : nestSizeDefault;
        return (
          '<p>If you win the bid, the ' +
          count +
          ' nest cards are added to your hand. Put ' +
          count +
          ' cards into the nest so that you keep ' +
          handSize +
          '. Tap a card to move it; tap it in the nest to return it. Then lock your hand and choose trump.</p><p>Tip: try to keep several cards in the color you plan to make trump, along with strong cards and cards worth points.</p>'
        );
      },
    },
    nestWait: {
      title: 'Waiting on the nest',
      html: '<p>The bidder is sorting the nest. You will play after they name a trump color.</p>',
    },
    trump: {
      title: 'Stamp trump',
      html: function () {
        let line = 'Trump is the color that beats other colors. Choose a color, then confirm it. ';
        if (includeRed1) line += 'Special Red One is the highest trump. ';
        if (includeRook && !rookLowest)
          line += 'Blackbird beats ' + (includeRed2 ? 'Red Two and ' : '') + 'ordinary trump. ';
        if (includeRed2) line += 'Red Two is always trump and beats ordinary trump. ';
        if (includeRook && rookLowest) line += 'Blackbird is the lowest trump at this table. ';
        line +=
          includeOnes && onesHigh
            ? '1 is highest within each color.'
            : '14 is highest within each color.';
        return '<p>' + line + '</p>';
      },
    },
    trumpWait: {
      title: 'Trump coming',
      html: '<p>The bidder names trump next. Remember the color. Follow the led color when you can.</p>',
    },
    lead: {
      title: 'Lead a card',
      html: '<p>The player leading starts the trick by playing any card. When it is your turn, gold-rim cards are legal: tap one to play it. Tap a dim card to see why it cannot be played.</p>',
    },
    follow: {
      title: 'Follow color',
      html: () =>
        '<p>The first card sets the led color. Play that color if you have it. ' +
        (specialsAnytime ? 'Included special trump cards may be played at any time. ' : '') +
        (mustTrumpWhenVoid
          ? 'If you have none of the led color, you must play trump if you have one; otherwise play any card. '
          : 'If you have none of the led color, you may play any card. ') +
        'The highest trump wins; if no trump is played, the highest card of the led color wins. The winner leads the next trick.</p>',
    },
    score: {
      title: 'Hand is in',
      html: () =>
        '<p>The bidding team must capture at least its bid in points, including any nest points it receives. Make it: score ' +
        (bidOnlyScoring ? 'the bid amount' : 'all points captured') +
        '. Miss it: lose the bid amount. Opponents score their captured points.</p><p>Nest points go to ' +
        (nestGoesTo === 'bidder' ? 'the bidding team' : 'the team taking the last trick') +
        ' at this table. Open Hand Details on the scoreboard to see the calculation.</p>',
    },
  };
  const PLAY_TIP_ORDER = [
    'lobby',
    'sit',
    'bidding',
    'myBid',
    'nest',
    'nestWait',
    'trump',
    'trumpWait',
    'lead',
    'follow',
    'score',
  ];

  let tourActive = false;
  let currentTipId = '';
  let manualTour = false;
  window.horTourBlocking = false;
  window.horTourResumeBot = false;

  function currentPlayerName() {
    return (
      asText(
        ($('hor-player-name') && $('hor-player-name').value) ||
          (typeof myName === 'string' ? myName : ''),
        ''
      ) || 'You'
    );
  }
  function currentPlayerKey() {
    const n = currentPlayerName().trim().toLowerCase();
    return n || '__device__';
  }
  function loadNewMap() {
    const p = loadPrefs();
    return p && p.newPlayerMap && typeof p.newPlayerMap === 'object' ? p.newPlayerMap : {};
  }
  function saveNewMap(map) {
    savePrefs({ newPlayerMap: map || {} });
  }
  function playerRecord(key) {
    const map = loadNewMap();
    const k = key || currentPlayerKey();
    if (!map[k]) {
      map[k] = { name: currentPlayerName(), veteran: false, seen: {} };
      saveNewMap(map);
    }
    return map[k];
  }
  function isNewPlayer(name) {
    const key = name ? String(name).trim().toLowerCase() || '__device__' : currentPlayerKey();
    const map = loadNewMap();
    const rec = map[key];
    if (rec && rec.veteran) return false;
    return true;
  }
  function markPlayerVeteran(name) {
    const key = name ? String(name).trim().toLowerCase() || '__device__' : currentPlayerKey();
    const map = loadNewMap();
    const rec = map[key] || { name: name || currentPlayerName(), seen: {} };
    rec.veteran = true;
    rec.name = rec.name || name || currentPlayerName();
    map[key] = rec;
    saveNewMap(map);
    if (key === currentPlayerKey()) savePrefs({ sawTutorial: true });
    renderNewPlayerLists();
  }
  function markPlayerNew(name) {
    const key = name ? String(name).trim().toLowerCase() || '__device__' : currentPlayerKey();
    const map = loadNewMap();
    map[key] = { name: name || currentPlayerName(), veteran: false, seen: {} };
    saveNewMap(map);
    if (key === currentPlayerKey()) savePrefs({ sawTutorial: false });
    renderNewPlayerLists();
  }
  function deleteNewMark(name) {
    markPlayerVeteran(name);
  }
  function seenTip(id) {
    const rec = playerRecord();
    return !!(rec.seen && rec.seen[id]);
  }
  function markTipSeen(id) {
    const map = loadNewMap();
    const key = currentPlayerKey();
    const rec = map[key] || { name: currentPlayerName(), veteran: false, seen: {} };
    rec.seen = rec.seen || {};
    rec.seen[id] = true;
    rec.name = currentPlayerName();
    map[key] = rec;
    const all = PLAY_TIP_ORDER.every(
      (sid) => rec.seen[sid] || sid === 'lobby' || sid === 'nestWait' || sid === 'trumpWait'
    );
    if (all) rec.veteran = true;
    saveNewMap(map);
    if (rec.veteran) savePrefs({ sawTutorial: true });
  }
  function renderNewPlayerLists() {
    const map = loadNewMap();
    const keys = Object.keys(map);
    if (!keys.length) playerRecord();
    const html =
      Object.keys(loadNewMap())
        .map((key) => {
          const rec = loadNewMap()[key];
          const label = rec.name || key;
          const neu = !rec.veteran;
          return (
            '<div class="new-player-row">' +
            '<span><b>' +
            asText(label, key) +
            '</b> · ' +
            (neu ? 'New' : 'Experienced') +
            '</span>' +
            (neu
              ? '<button type="button" class="btn" data-clear-new="' +
                key +
                '">Remove new mark</button>'
              : '<button type="button" class="btn" data-mark-new="' +
                key +
                '">Mark new again</button>') +
            '</div>'
          );
        })
        .join('') ||
      '<p class="option-hint">No names stored yet. Sit down once and the name appears here.</p>';
    ['newPlayerList', 'newPlayerListLobby'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.innerHTML = html;
      el.querySelectorAll('[data-clear-new]').forEach((btn) => {
        btn.onclick = () => deleteNewMark(btn.getAttribute('data-clear-new'));
      });
      el.querySelectorAll('[data-mark-new]').forEach((btn) => {
        btn.onclick = () => markPlayerNew(btn.getAttribute('data-mark-new'));
      });
    });
  }
  window.renderNewPlayerLists = renderNewPlayerLists;

  function hideTourCard(force) {
    if (window.horPinTip && !force) return;
    const ov = $('tutorialOverlay');
    if (ov) {
      if (ov.open) ov.close();
      ov.classList.add('hidden');
      ov.classList.remove('lobby-placed');
      ov.setAttribute('aria-hidden', 'true');
      const card = ov.querySelector('.tutorial-card');
      if (card) card.style.marginTop = '';
    }
    tourActive = false;
    currentTipId = '';
    window.horTourBlocking = false;
    window.horPinTip = false;
  }

  function resumeAfterTip() {
    window.horTourBlocking = false;
    setTimeout(maybeTutorial, 80);
    if (window.horTourResumeBot) {
      window.horTourResumeBot = false;
      try {
        if (typeof scheduleBot === 'function') scheduleBot();
      } catch (e) {}
    }
  }

  function showPlayTip(id, opts) {
    const step = PLAY_TIPS[id];
    if (!step) return;
    if (!manualTour && !isNewPlayer()) return;
    if (!manualTour && seenTip(id) && !(opts && opts.force)) return;
    if (tourActive && currentTipId === id) return;
    // Re-evaluate the actual phase after dismissal instead of queuing stale turns.
    if (tourActive && currentTipId && currentTipId !== id) return;
    const ov = $('tutorialOverlay');
    const tx = $('tutorialText');
    const title = $('tutorialTitle');
    const kick = $('tutorialKicker');
    const next = $('tutorialNext');
    const back = $('tutorialBack');
    if (!ov || !tx) return;
    currentTipId = id;
    tourActive = true;
    window.horTourBlocking = true;
    window.horTourResumeBot = true;
    try {
      if (typeof botTimer !== 'undefined' && botTimer) {
        clearTimeout(botTimer);
        botTimer = null;
      }
    } catch (e) {}
    try {
      if (typeof setBotThinking === 'function') setBotThinking(false);
    } catch (e) {}
    if (kick) kick.textContent = manualTour ? 'House tour' : 'As you play';
    if (title) title.textContent = step.title;
    tx.innerHTML = typeof step.html === 'function' ? step.html() : step.html;
    window.horPinTip = true;
    const idx = PLAY_TIP_ORDER.indexOf(id);
    if (next)
      next.textContent = manualTour
        ? idx === PLAY_TIP_ORDER.length - 1
          ? 'Done'
          : 'Next'
        : 'Got it';
    if (back) {
      back.classList.toggle('hidden', !manualTour);
      back.disabled = idx === 0;
    }
    const bar = $('tutorialProgress');
    if (bar) {
      bar.setAttribute('aria-hidden', 'false');
      bar.setAttribute('role', 'img');
      bar.setAttribute(
        'aria-label',
        manualTour
          ? 'Topic ' + (idx + 1) + ' of ' + PLAY_TIP_ORDER.length + ': ' + step.title
          : step.title
      );
      bar.innerHTML = PLAY_TIP_ORDER.map((_, i) => {
        const cls = i === idx ? 'on' : i < idx ? 'done' : '';
        return '<span aria-hidden="true" class="tutorial-dot ' + cls + '"></span>';
      }).join('');
    }
    ov.classList.remove('hidden');
    ov.setAttribute('aria-hidden', 'false');
    placeLobbyTipCard();
    if (!ov.open) ov.showModal();
  }

  function placeLobbyTipCard() {
    const ov = $('tutorialOverlay'),
      card = ov?.querySelector('.tutorial-card');
    if (!ov || !card) return;
    ov.classList.remove('lobby-placed');
    ov.classList.add('tour-bounded835');
    card.style.marginTop = '';
  }
  window.addEventListener('resize', function () {
    if (currentTipId === 'lobby') placeLobbyTipCard();
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(placeLobbyTipCard, 80);
  });

  function startHouseTour() {
    manualTour = true;
    markPlayerNew(currentPlayerName());
    showPlayTip('lobby', { force: true });
  }
  window.startHouseTour = startHouseTour;

  function finishHouseTour(markSeen) {
    if (currentTipId && !markSeen) markTipSeen(currentTipId);
    if (markSeen) markPlayerVeteran(currentPlayerName());
    window.horPinTip = false;
    hideTourCard(true);
    manualTour = false;
    window.horTourBlocking = false;
    if (window.horTourResumeBot) {
      window.horTourResumeBot = false;
      try {
        if (typeof scheduleBot === 'function') scheduleBot();
      } catch (e) {}
    }
    try {
      if (typeof window.flushAfterTour === 'function') window.flushAfterTour();
    } catch (e) {}
  }

  function maybeTutorial() {
    if (tourActive) return;
    if (isSpectator) return;
    const lobby = $('lobby');
    const onLobby = lobby && !lobby.classList.contains('hidden');
    if (onLobby) {
      // Locked entrance already explains entry. Keep manual tour and in-game tips.
      if (document.querySelector('link[href^="landing783.css"]') && !manualTour) return;
      if (!isNewPlayer()) return;
      if (window.__horLobbyTipShown) return;
      window.__horLobbyTipShown = true;
      showPlayTip('lobby');
      return;
    }
    if (!game) return;
    if (!isNewPlayer() && !manualTour) return;
    if (game.phase === 'bidding' || game.phase === 'dealing') {
      if (!seenTip('sit')) {
        showPlayTip('sit');
        return;
      }
      if (typeof myIndex === 'number' && game.currentPlayer === myIndex && game.phase === 'bidding')
        showPlayTip('myBid');
      else showPlayTip('bidding');
    } else if (game.phase === 'discard') {
      if (game.bidder === myIndex) showPlayTip('nest');
      else showPlayTip('nestWait');
    } else if (game.phase === 'trump') {
      if (game.bidder === myIndex) showPlayTip('trump');
      else showPlayTip('trumpWait');
    } else if (game.phase === 'play') {
      const led = !!(game.ledColor || (game.trick && game.trick.length));
      showPlayTip(led ? 'follow' : 'lead');
    } else if (game.phase === 'score' || game.phase === 'scoring') {
      showPlayTip('score');
    }
  }

  function markPartnerSeat() {
    // A Rook 006: portrait partner relationship remains game state; the visible
    // "YOUR PARTNER" presentation is intentionally removed. Clean up any
    // legacy chip that may survive a hot reload without touching seat/name data.
    const el = $('slot-partner');
    if (!el) return;
    const chip = el.querySelector('.partner-chip');
    if (chip) chip.remove();
  }

  function updateSpectatorChrome() {
    const badge = $('spectatorBadge');
    if (isSpectator) {
      if (badge) {
        const t = typeof myIndex === 'number' && myIndex >= 0 ? '' : teamLabel(0);
        badge.textContent = 'Watching' + (t ? ' — ' + t : '');
        badge.classList.remove('hidden');
      }
      const panel = $('actionPanel');
      if (panel) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
      }
      document.body.classList.add('is-spectator');
    } else {
      document.body.classList.remove('is-spectator');
    }
  }

  function scoringSentence(summary) {
    if (!summary) return '';
    const makers = teamLabel(summary.bidderTeam);
    const taken = summary.bidderTeam === 0 ? summary.pointsA : summary.pointsB;
    if (summary.shotMoonResult === 'made')
      return makers + ' captured every point and shot the Moon — wins the entire game!';
    if (summary.shotMoonResult === 'failed')
      return (
        makers + ' missed the Moon: −' + summary.bid + '. Opponents score their captured points.'
      );
    if (summary.made) {
      if (bidOnlyScoring)
        return (
          makers + ' bid ' + summary.bid + ', took ' + taken + ' → +' + summary.bid + ' (bid only).'
        );
      return makers + ' bid ' + summary.bid + ', took ' + taken + ' → +' + taken + '.';
    }
    return makers + ' bid ' + summary.bid + ', took ' + taken + ' → set, −' + summary.bid + '.';
  }
  window.scoringSentence = scoringSentence;

  function nightRecap(winner, scores) {
    const box = $('celeRecap');
    if (!box) return;
    const made = (matchStats.madeA || 0) + (matchStats.madeB || 0);
    const sets = (matchStats.setsA || 0) + (matchStats.setsB || 0);
    let capture = 'No completed tricks recorded';
    try {
      const pool = (matchTricks || []).slice();
      pool.sort((a, b) => (b.points || 0) - (a.points || 0));
      if (pool[0])
        capture = Number(pool[0].points || 0) + ' points · ' + asText(pool[0].winnerName, 'Player');
    } catch (e) {}
    const mvpSeat = (function () {
      try {
        const names = (game && game.players) || players || [];
        return (names[0] && names[0].name) || 'Table';
      } catch (e) {
        return 'Table';
      }
    })();
    box.innerHTML =
      '<div class="recap-grid">' +
      '<div><span>Final</span><b>' +
      teamLabel(0) +
      ' ' +
      scores[0] +
      ' · ' +
      teamLabel(1) +
      ' ' +
      scores[1] +
      '</b></div>' +
      '<div><span>Hands</span><b>' +
      made +
      ' made · ' +
      sets +
      ' set</b></div>' +
      '<div><span>Biggest capture</span><b>' +
      capture +
      '</b></div>' +
      '<div><span>First chair</span><b>' +
      mvpSeat +
      '</b></div>' +
      '</div>';
  }

  function wireLobby() {
    const name = $('hor-player-name');
    const p = loadPrefs();
    if (name) name.value = asText(p.name, '');
    const ta = $('hor-team-a');
    const tb = $('hor-team-b');
    if (ta) ta.value = houseTeamA;
    if (tb) tb.value = houseTeamB;
    try {
      paintTeamChrome();
    } catch (e) {}
    const friendsBtn = $('friendsToggleBtn');

    if (friendsBtn) {
      friendsBtn.onclick = () => {
        try {
          isSpectator = false;
          if (typeof createRoom === 'function') createRoom();
        } catch (e) {
          const status = $('lobbyStatus');
          if (status) status.textContent = 'Could not start multiplayer: ' + (e.message || e);
        }
      };
    }
    document.querySelectorAll('.preset-btn').forEach((b) => {
      b.onclick = () => applyPreset(b.getAttribute('data-preset'));
    });
    document.querySelectorAll('.opt-tab').forEach((tab) => {
      tab.onclick = () => {
        document
          .querySelectorAll('.opt-tab')
          .forEach((t) => t.classList.toggle('active', t === tab));
        const which = tab.getAttribute('data-opt-tab');
        const rules = $('optPaneRules');
        const table = $('optPaneTable');
        const playersPane = $('optPanePlayers');
        const settingsPane = $('optPaneSettings');
        if (rules) rules.classList.toggle('hidden', which !== 'rules');
        if (table) table.classList.toggle('hidden', which !== 'table');
        if (playersPane) playersPane.classList.toggle('hidden', which !== 'players');
        if (settingsPane) settingsPane.classList.toggle('hidden', which !== 'settings');
        if (which === 'players') renderNewPlayerLists();
        if (which === 'settings') {
          try {
            applyPlaqueColors();
          } catch (e) {}
        }
      };
    });
    const tn = $('tutorialNext');
    const tourSkip = $('tutorialSkip');
    $('tutorialOverlay').addEventListener('cancel', (e) => {
      e.preventDefault();
      tn?.click();
    });
    if (tn)
      tn.onclick = () => {
        if (manualTour) {
          const idx = PLAY_TIP_ORDER.indexOf(currentTipId);
          hideTourCard(true);
          if (idx < PLAY_TIP_ORDER.length - 1)
            showPlayTip(PLAY_TIP_ORDER[idx + 1], { force: true });
          else finishHouseTour(false);
          return;
        }
        if (currentTipId) markTipSeen(currentTipId);
        window.horPinTip = false;
        hideTourCard(true);
        manualTour = false;
        resumeAfterTip();
        try {
          if (typeof window.flushAfterTour === 'function' && !window.horTourBlocking)
            window.flushAfterTour();
        } catch (e) {}
      };
    $('tutorialBack').onclick = () => {
      const idx = PLAY_TIP_ORDER.indexOf(currentTipId);
      if (!manualTour || idx <= 0) return;
      hideTourCard(true);
      showPlayTip(PLAY_TIP_ORDER[idx - 1], { force: true });
    };
    if (tourSkip) tourSkip.onclick = () => finishHouseTour(true);
    const replay = $('replayTutorialBtn');
    if (replay) replay.onclick = () => startHouseTour();
    const npLobby = $('newPlayersLobbyBtn');
    const npModal = $('newPlayersModal');
    if (npLobby && npModal)
      npLobby.onclick = () => {
        renderNewPlayerLists();
        npModal.classList.remove('hidden');
      };
    const npClose = $('closeNewPlayersBtn');
    if (npClose && npModal) npClose.onclick = () => npModal.classList.add('hidden');
    ['markMeExperiencedBtn', 'markMeExperiencedLobbyBtn'].forEach((id) => {
      const el = $(id);
      if (el) el.onclick = () => markPlayerVeteran(currentPlayerName());
    });
    ['markMeNewBtn', 'markMeNewLobbyBtn'].forEach((id) => {
      const el = $(id);
      if (el) el.onclick = () => markPlayerNew(currentPlayerName());
    });
    renderNewPlayerLists();
    try {
      applyPlaqueColors();
    } catch (e) {}
    maybeTutorial();
    applyRoomTheme((p && p.roomTheme) || 'midnight', false);
    applyGfx((p && p.gfx) || loadGfx());
    document.querySelectorAll('a.cash-app-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var url = 'https://cash.app/$JeromeLeeGriffin';
        var standalone = false;
        try {
          standalone =
            !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
            navigator.standalone === true;
        } catch (err) {}
        if (!standalone) return;
        e.preventDefault();
        var opened = null;
        try {
          opened = window.open(url, '_blank');
        } catch (err) {}
        if (opened) return;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText)
            navigator.clipboard.writeText('$JeromeLeeGriffin');
        } catch (err) {}
        var st = $('lobbyStatus');
        if (st)
          st.textContent =
            'Cashtag copied: $JeromeLeeGriffin — open Cash App and send there. This page stays put so the table does not reload.';
      });
    });
    if (name) name.addEventListener('change', persistPlayer);
    if (ta)
      ta.addEventListener('change', () => {
        houseTeamA = asText(ta.value, 'Griffin');
        persistPlayer();
        try {
          paintTeamChrome();
        } catch (e) {}
      });
    if (tb)
      tb.addEventListener('change', () => {
        houseTeamB = asText(tb.value, 'Raven');
        persistPlayer();
        try {
          paintTeamChrome();
        } catch (e) {}
      });
    if (ta)
      ta.addEventListener('input', () => {
        houseTeamA = asText(ta.value, 'Griffin');
        try {
          paintTeamChrome();
        } catch (e) {}
      });
    if (tb)
      tb.addEventListener('input', () => {
        houseTeamB = asText(tb.value, 'Raven');
        try {
          paintTeamChrome();
        } catch (e) {}
      });
    // Rejoin first if session exists
    try {
      const sess = JSON.parse(sessionStorage.getItem('rookSession') || 'null');
      if (sess && sess.roomCode && sess.roomCode !== 'OFFLINE') {
        const box = $('reconnectBox');
        if (box) box.classList.remove('hidden');
        const rc = $('reconnectCode');
        if (rc) rc.textContent = sess.roomCode;
        if ($('hor-room-code')) $('hor-room-code').value = sess.roomCode;
      }
    } catch (e) {}
  }

  // ---- wrap existing functions ----
  window.addEventListener('hor-table-ready', (e) => {
    speakCode(e.detail && e.detail.code);
  });
  const _createRoom = window.createRoom;
  window.createRoom = function () {
    persistPlayer();
    hideTourCard();
    myName =
      (($('hor-player-name') && $('hor-player-name').value) || '').trim() ||
      loadPrefs().name ||
      'Host';
    const r = _createRoom.apply(this, arguments);
    return r;
  };

  const _joinRoom = window.joinRoom;
  window.joinRoom = function () {
    persistPlayer();
    hideTourCard();
    myName =
      (($('hor-player-name') && $('hor-player-name').value) || '').trim() ||
      loadPrefs().name ||
      'Player';
    return _joinRoom.apply(this, arguments);
  };

  const _startSolo = window.startSoloPractice;
  window.startSoloPractice = function () {
    persistPlayer();
    hideTourCard();
    applyPrefsToEngine();
    const name =
      (($('hor-player-name') && $('hor-player-name').value) || '').trim() ||
      loadPrefs().name ||
      'You';
    const ret = _startSolo.apply(this, arguments);
    try {
      myName = name;
      if (players[0]) players[0].name = name;
    } catch (e) {}
    setTimeout(maybeTutorial, 700);
    return ret;
  };

  const _showGame = window.showGame;
  window.showGame = function () {
    _showGame.apply(this, arguments);
    updateSpectatorChrome();
    updateNestDestChip();
    markPartnerSeat();
    refreshTurnBanner();
    persistPlayer();
  };

  const _renderUI = window.renderUI;
  window.renderUI = function () {
    _renderUI.apply(this, arguments);
    try {
      ['partner', 'left', 'right'].forEach((slot) => {
        const el = $('slot-' + slot);
        const nameEl = el && el.querySelector('.name');
        if (!nameEl) return;
        nameEl.innerHTML = nameEl.innerHTML
          .replace(' (A)', ' · ' + teamLabel(0))
          .replace(' (B)', ' · ' + teamLabel(1));
      });
      const meNameEl = $('slot-me') && $('slot-me').querySelector('.name');
      if (meNameEl) {
        meNameEl.innerHTML = meNameEl.innerHTML
          .replace(' (A)', ' · ' + teamLabel(0))
          .replace(' (B)', ' · ' + teamLabel(1));
      }
    } catch (e) {}
    maybeTutorial();
  };

  // 743: measure only the portrait Scoreboard, including text/font/chrome changes.
  // The compact mode recovers padding and ornament, never crops/shrinks card art.
  let scoreFitKey743 = '',
    scoreFitFrame743 = 0,
    scoreFitObserver743;
  function fitScoreboard743(reset = false) {
    if (reset) scoreFitKey743 = '';
    if (scoreFitFrame743) return;
    scoreFitFrame743 = requestAnimationFrame(() => {
      scoreFitFrame743 = 0;
      const modal = $('scoreModal'),
        panel = modal?.querySelector('.scoreboard-modal');
      const body = $('scoreModalBody'),
        board = body?.querySelector('.gh-approved-scoreboard');
      const active =
        modal &&
        board &&
        !modal.classList.contains('hidden') &&
        !modal.classList.contains('showing-remaining') &&
        innerWidth <= 520 &&
        window.matchMedia('(orientation: portrait)').matches;
      if (!active) {
        modal?.classList.remove('score-compact743');
        scoreFitKey743 = '';
        return;
      }
      const measurementKey = () =>
        [
          innerWidth,
          innerHeight,
          panel.clientWidth,
          panel.clientHeight,
          body.clientHeight,
          board.getBoundingClientRect().height,
          getComputedStyle(document.documentElement).fontSize,
          board.textContent,
          modal.querySelector('.score-modal-actions')?.textContent,
        ].join('|');
      if (measurementKey() === scoreFitKey743) return;
      modal.classList.remove('score-compact743');
      if (
        board.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom + 1 ||
        body.scrollHeight > body.clientHeight + 1
      )
        modal.classList.add('score-compact743');
      // Cache final geometry so compact-mode resize notifications cannot oscillate.
      scoreFitKey743 = measurementKey();
    });
  }
  window.addEventListener('resize', () => fitScoreboard743(true));
  window.visualViewport?.addEventListener('resize', () => fitScoreboard743(true));

  const _showScore = window.showScoreModal;
  window.showScoreModal = function (summary) {
    const firstBeginnerScore = isNewPlayer() && !seenTip('score');
    _showScore.apply(this, arguments);
    if (firstBeginnerScore)
      $('scoreModalBody')?.querySelector('.ghsb-hand-details')?.setAttribute('open', '');
    window.handsPlayedSession = (window.handsPlayedSession || 0) + 1;
    try {
      showPlayTip('score');
    } catch (e) {}
    try {
      const body = $('scoreModalBody');
      if (body && summary) {
        const teach = document.createElement('p');
        teach.className = 'score-teach';
        const owned = body.querySelector('.ghsb-result-line');
        const ownsScoreExplanation835 = !!owned;
        const nestLine =
          summary.nestPts || ownsScoreExplanation835
            ? ' Nest ' +
              (summary.nestPts || 0) +
              ' to ' +
              (summary.nestWinnerName ||
                (ownsScoreExplanation835
                  ? 'Winner'
                  : nestGoesTo === 'bidder'
                    ? 'makers'
                    : 'last trick')) +
              '.'
            : '';
        teach.textContent =
          scoringSentence(summary) +
          nestLine +
          ' Running total: ' +
          teamLabel(0) +
          ' ' +
          summary.scores[0] +
          ' · ' +
          teamLabel(1) +
          ' ' +
          summary.scores[1] +
          ' (to ' +
          (game?.targetScore || targetScore) +
          ').';
        const banner = body.querySelector('.score-banner');
        // The two summaries describe the same hand. Keep the existing scoring
        // narrator's full explanation in the approved renderer's single region.
        // This retains set/bid-only scoring wording without a second copy.
        if (ownsScoreExplanation835) {
          owned.textContent = teach.textContent;
        } else if (banner && banner.parentNode) {
          banner.parentNode.insertBefore(teach, banner.nextSibling);
        }
        body.querySelectorAll('.sb-label').forEach((el, i) => {
          el.textContent = teamLabel(i);
        });
        if (!scoreFitObserver743 && window.ResizeObserver) {
          scoreFitObserver743 = new ResizeObserver(() => fitScoreboard743());
        }
        if (scoreFitObserver743) {
          const board = body.querySelector('.gh-approved-scoreboard');
          if (board) {
            scoreFitObserver743.disconnect();
            scoreFitObserver743.observe(body);
            scoreFitObserver743.observe(body.closest('.scoreboard-modal'));
            scoreFitObserver743.observe(board);
          }
        }
        fitScoreboard743(true);
      }
    } catch (e) {}
  };

  const _showWin = window.showWinCelebration;
  window.showWinCelebration = function (winner, scores) {
    let label = winner;
    if (winner === 'Team A') label = teamLabel(0);
    if (winner === 'Team B') label = teamLabel(1);
    // Keep canonical team IDs in recap state and network messages; localize only the title.
    _showWin.call(this, winner, scores);
    const title = $('winTitle');
    if (title) title.textContent = winner === 'Tie' ? "It's a Tie!" : `${label} Wins!`;
    const sub = $('winSub');
    if (sub && scores)
      sub.textContent =
        'Final: ' + teamLabel(0) + ' ' + scores[0] + ' – ' + teamLabel(1) + ' ' + scores[1];
  };

  const _startCele = window.startMatchCelebration;
  window.startMatchCelebration = function () {
    _startCele.apply(this, arguments);
    const data = pendingCele || {};
    const title = $('celeTitle');
    const team = winningTeamIndex(data.winner);
    if (title && team !== null) title.textContent = `${teamLabel(team)} Wins!`;
    nightRecap(data.winner, data.scores || [0, 0]);
  };

  const _showBid = window.showBidUI;
  window.showBidUI = function () {
    _showBid.apply(this, arguments);
    refreshTurnBanner();
    maybeTutorial();
  };

  // Rook560: showTrumpUI is owned only by game.js.

  const _finishBid = window.finishBidding;
  window.finishBidding = function () {
    const nestCards = game && game.nest ? game.nest.map((c) => Object.assign({}, c)) : [];
    const pts = nestCards.reduce(
      (s, c) => s + (typeof cardPoints === 'function' ? cardPoints(c) : 0),
      0
    );
    const r = _finishBid.apply(this, arguments);
    if (game && game.bidder === myIndex && nestCards.length) {
      const ov = $('discardOverlay');
      const msg = $('messageArea');
      if (msg)
        msg.textContent = 'Nest: ' + pts + ' points — pick ' + nestCards.length + ' to throw back.';
      if (ov && !reduceMotion) ov.classList.add('nest-beat');
    }
    maybeTutorial();
    return r;
  };

  const boundHandRoots = new WeakSet();
  function bindWhyOnCards(root) {
    if (!root || boundHandRoots.has(root)) return;
    boundHandRoots.add(root);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Your hand');
    const cardFor = (el) => game?.myHand?.find((c) => String(c.id) === String(el.dataset.id));
    const explain = (el, ev) => {
      const reason = illegalReason(cardFor(el));
      if (!reason) return;
      const rect = el.getBoundingClientRect();
      showWhy(reason, ev?.clientX ?? rect.left + 24, ev?.clientY ?? rect.top);
    };
    const annotate = () =>
      root.querySelectorAll('.card-face').forEach((el) => {
        const card = cardFor(el);
        if (!card) return;
        const reason = illegalReason(card);
        const name = isRookCard(card)
          ? 'Blackbird'
          : isRed1(card)
            ? 'Special Red One'
            : includeRed2 && isRed2(card)
              ? 'Red Two'
              : colorLabel(card.color) + ' ' + card.rank;
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.setAttribute('aria-label', name + (reason ? '. ' + reason : '. Play card'));
        el.setAttribute('aria-disabled', String(!!reason));
      });
    // Delegate to the stable hand container. Landscape repaints/clones replace
    // card nodes, so per-card markers cannot be used as listener ownership.
    let holdTimer = 0;
    const cancelHold = () => clearTimeout(holdTimer);
    root.addEventListener('pointerdown', (ev) => {
      const el = ev.target.closest('.card-face');
      if (!el || !root.contains(el)) return;
      cancelHold();
      if (el.classList.contains('playable')) tapHaptic(true);
      else holdTimer = setTimeout(() => explain(el, ev), 420);
    });
    root.addEventListener('pointerup', cancelHold);
    root.addEventListener('pointercancel', cancelHold);
    root.addEventListener(
      'click',
      (ev) => {
        const el = ev.target.closest('.card-face');
        if (el && illegalReason(cardFor(el))) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          explain(el, ev);
        }
      },
      true
    );
    root.addEventListener('keydown', (ev) => {
      const el = ev.target.closest('.card-face');
      if (!el || !['Enter', ' '].includes(ev.key)) return;
      ev.preventDefault();
      if (ev.repeat) return;
      if (illegalReason(cardFor(el))) explain(el);
      else el.click();
    });
    root.addEventListener('contextmenu', (ev) => {
      const el = ev.target.closest('.card-face');
      if (!el) return;
      ev.preventDefault();
      explain(el, ev);
    });
    new MutationObserver(annotate).observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    annotate();
  }
  bindWhyOnCards($('myHand'));
  bindWhyOnCards($('ltHand'));
  const _renderHand = window.renderHand;
  window.renderHand = function (discardMode, opts) {
    _renderHand.apply(this, arguments);
    bindWhyOnCards($('myHand'));
    bindWhyOnCards($('ltHand'));
  };

  // Rook582: setBotThinking is owned exclusively by game.js.

  window.clientLeaveReplace = async function () {
    const offline = isSoloPractice || roomCode === 'OFFLINE';
    const ok = await houseConfirm({
      title: offline || isHost ? 'Leave this table?' : 'Leave and seat a bot?',
      body: offline
        ? 'Return to the lobby from this offline game.'
        : isHost
          ? 'You are the host. Leaving ends the room for everyone.'
          : 'A bot will take your chair for the rest of the night.',
      danger: true,
    });
    if (!ok) return;
    leaveTableAfterConfirmation043();
  };

  const _pauseBtn = document.getElementById('btnPause');
  if (_pauseBtn) {
    const old = _pauseBtn.onclick;
    _pauseBtn.onclick = async function (e) {
      if (game && !game.paused) {
        const ok = await houseConfirm({
          title: 'Pause the table?',
          body: 'Everyone waits until you resume.',
          danger: false,
        });
        if (!ok) return;
      }
      if (typeof old === 'function') old.call(this, e);
      else if (typeof hostTogglePause === 'function') hostTogglePause();
    };
  }

  const _xfer = window.hostTransferHost;
  window.hostTransferHost = async function () {
    const ok = await houseConfirm({
      title: 'Hand off the host?',
      body: 'Friends will get a new room code and must rejoin.',
      danger: true,
    });
    if (!ok) return;
    return _xfer.apply(this, arguments);
  };

  const _syncOpts = window.syncOptionsUI;
  window.syncOptionsUI = function () {
    _syncOpts.apply(this, arguments);
    const hint = $('variantHint');
    const names = { griffin: 'Griffin House' };
    if (hint)
      hint.textContent =
        (names[ruleVariant] || 'Griffin House') +
        ' · Nest ' +
        nestSizeDefault +
        ' · min bid ' +
        minBid +
        ' · to ' +
        targetScore;
    const lab = $('rulesetLabel');
    if (lab) lab.textContent = names[ruleVariant] || 'Griffin House';
    document.querySelectorAll('.preset-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-preset') === (ruleVariant || 'griffin'));
    });
    updateNestDestChip();
  };

  // Keep the active bird artwork and a readable identity until decoding completes.
  function birdFaceLoading(stack, imageClass, src, alt, label) {
    return `<div class="c-stack ${stack}"><img class="${imageClass}" src="${src}" alt="${alt}" draggable="false" onload="this.style.display='block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="asset-bird-fallback772">${label}</span></div>`;
  }
  // card art: preserve the existing selected premium/original URLs
  const _inner = window.cardInnerHTML;
  window.cardInnerHTML = function (card) {
    const premium = !document.documentElement.classList.contains('hor-original-cards');
    if (card && (card.color === 'rook' || card.id === 'rook')) {
      if (premium)
        return birdFaceLoading(
          'rook-stack premium-raven',
          'rook-bird-img',
          'assets/images/RookPremium.png?v=632',
          'Black Raven',
          'BLACK BIRD'
        );
      return birdFaceLoading(
        'rook-stack',
        'rook-bird-img',
        'assets/images/Rook.webp',
        'Black Raven',
        'BLACK BIRD'
      );
    }
    if (card && typeof isRed2 === 'function' && isRed2(card) && includeRed2) {
      if (premium)
        return birdFaceLoading(
          'red2-stack premium-raven',
          'red2-img',
          'assets/images/Red2Premium.png?v=632',
          'Red 2',
          'RED 2'
        );
      return birdFaceLoading(
        'red2-stack',
        'red2-img',
        'assets/images/Red2-card.webp',
        'Red 2',
        'RED 2'
      );
    }
    const html = _inner.apply(this, arguments);
    return html;
  };

  function flashGfxBanner(id, text, cls) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = (cls || el.className.replace('hidden', '')).trim();
    el.classList.remove('hidden');
    setTimeout(() => {
      try {
        el.classList.add('hidden');
      } catch (e) {}
    }, 2200);
  }
  // Rook560: hostProcessTrump / Trump announcement lifecycle is owned only by game.js.
  const _score = window.showScoreModal;
  if (typeof _score === 'function') {
    window.showScoreModal = function (summary) {
      try {
        if (typeof clearTrumpBanners === 'function') clearTrumpBanners();
        else {
          ['trumpBanner', 'ltTrumpStamp'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
              el.classList.add('hidden');
              el.textContent = '';
              delete el.dataset.trumpStamped;
            }
          });
        }
      } catch (e) {}
      const r = _score.apply(this, arguments);
      if (gfxOn('handBanner') && summary) {
        const made = !!summary.made;
        flashGfxBanner(
          'handWinBanner',
          made ? 'BID MADE' : 'SET',
          'hand-win-banner ' + (made ? 'made' : 'set')
        );
      }
      return r;
    };
  }
  const _sfx = window.playSfx;
  if (typeof _sfx === 'function') {
    window.playSfx = function () {
      const r = _sfx.apply(this, arguments);
      if (
        gfxOn('hapticsHeavy') &&
        navigator.vibrate &&
        !(window.HORHolderCues789 && arguments[0] === 'turn')
      ) {
        try {
          navigator.vibrate(12);
        } catch (e) {}
      }
      return r;
    };
  }

  document.addEventListener(
    'click',
    (e) => {
      // Career viewing/export/recovery must not rewrite unrelated saved preferences.
      if (
        window.__horCareerDismissGesture ||
        e.target?.closest?.(
          '#horActivationPanel,#horPublicCareerCard,#horCareerBackdrop,#horCareerGuide,[data-hor-career-export]'
        )
      )
        return;
      persistPlayer();
    },
    true
  );

  document.addEventListener('DOMContentLoaded', () => {});
  applyPrefsToEngine();
  try {
    paintTeamChrome();
  } catch (e) {}
  wireLobby();
  wireExperimentalOptions();
  updateMuteButtons();
  updateNestDestChip();
  showVariantRules();

  function formatNightScores() {
    const a = teamLabel(0);
    const b = teamLabel(1);
    const hist =
      typeof handHistory !== 'undefined' && Array.isArray(handHistory) ? handHistory : [];
    const scores =
      game && game.scores ? game.scores : hist.length ? hist[hist.length - 1].scores : [0, 0];
    const goal = (game && game.targetScore) || targetScore || 500;
    const when = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const lines = [];
    lines.push('House of Rooks — ' + when);
    lines.push(a + ' ' + scores[0] + '   ' + b + ' ' + scores[1] + '   (play to ' + goal + ')');
    lines.push('');
    if (!hist.length) {
      lines.push('No hands posted yet.');
    } else {
      hist.forEach((h, i) => {
        const makers = teamLabel(h.bidderTeam);
        const verb = h.made ? 'made' : 'SET';
        const da = (h.scoreDeltaA >= 0 ? '+' : '') + h.scoreDeltaA;
        const db = (h.scoreDeltaB >= 0 ? '+' : '') + h.scoreDeltaB;
        const trump =
          typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES[h.trump]
            ? COLOR_NAMES[h.trump]
            : h.trump || '—';
        lines.push(
          i +
            1 +
            '. ' +
            makers +
            ' bid ' +
            h.bid +
            ' ' +
            verb +
            '  (' +
            a +
            ' ' +
            da +
            ' / ' +
            b +
            ' ' +
            db +
            ')' +
            '  trump ' +
            trump +
            '  → ' +
            a +
            ' ' +
            h.scores[0] +
            '–' +
            b +
            ' ' +
            h.scores[1]
        );
      });
    }
    lines.push('');
    const ms = typeof matchStats !== 'undefined' && matchStats ? matchStats : {};
    lines.push(a + ' made ' + (ms.madeA || 0) + ' / set ' + (ms.setsA || 0));
    lines.push(b + ' made ' + (ms.madeB || 0) + ' / set ' + (ms.setsB || 0));
    if (ms.highBid) lines.push('High bid ' + ms.highBid);
    return lines.join('\n');
  }
  window.formatNightScores = formatNightScores;

  async function copyNightScores(btn) {
    const text = formatNightScores();
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) {}
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {}
    }
    if (!ok) {
      window.alert(text);
      return;
    }
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.textContent = prev;
      }, 1600);
    }
  }
  window.copyNightScores = copyNightScores;

  function wireScoreCopyButtons() {
    ['scoreModalCopy', 'statsCopy', 'historyCopy', 'celeCopyScores'].forEach((id) => {
      const el = $(id);
      if (el && el.dataset.copyWired !== '1') {
        el.dataset.copyWired = '1';
        el.addEventListener('click', () => copyNightScores(el));
      }
    });
  }
  wireScoreCopyButtons();

  const _showStats = window.showStatsModal;
  if (typeof _showStats === 'function') {
    window.showStatsModal = function () {
      _showStats.apply(this, arguments);
      try {
        const body = $('statsBody');
        if (body) {
          body.innerHTML = body.innerHTML
            .replace(/Team A/g, teamLabel(0))
            .replace(/Team B/g, teamLabel(1));
        }
      } catch (e) {}
      wireScoreCopyButtons();
    };
  }

  window.unlockHouseAudio = function () {
    try {
      ensureAudio();
    } catch (e) {}
  };
  ['createBtn', 'soloPracticeBtn', 'friendsToggleBtn', 'joinConfirmBtn'].forEach((id) => {
    const el = $(id);
    if (el)
      el.addEventListener(
        'pointerdown',
        () => {
          try {
            ensureAudio();
          } catch (e) {}
        },
        { passive: true }
      );
  });
})();

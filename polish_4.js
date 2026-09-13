/* House of Rooks — table polish layer
 * Author: Jerome Griffin
 * Copyright (c) 2026 Jerome Griffin / Griffin House
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const PREF_KEY = 'horPrefs';

  const EXP_KEY = 'horTestingTab';
  const EXP_IDS = [
    'netSequencing','netReconnect','netBackoff','netHeartbeat','netDelta','netAuthoritative','netTimerSync',
    'netDuplicateGuard','netTurnGuard','netConnectionUI','netTurnHandoff','netOwnTurnRecovery','netDiagnostics','netGraceRecovery',
    'netSameIdResync','netNameReclaim','netActionQueue','netIceWatch','netResyncOnReclaim','netHoldTimerOnDisconnect','netSilentDropDetect',
    'tableAtmosphere','rookAnimation','cardJuice','avatarPersonality','statusIndicators','matchProgress','lobbyReconnect','cacheRefresh',
    'friendlyErrors','renderOptimization','debugPanel',
    'customTurnServers','hostMigration','seatPips','thinkingPulse','confirmPlay','lagSandbox','webpRookArt','waitingQrAuto',
    'turnAlert','coachOverlay','careerStats','shareHandCard','tournamentLock','spectatorLateJoin','hostKickMute',
    'partnerChatAfterNest','rulesSelfTest','botStrengthLabels','landscapeDock','waitForMe','rematchSameFour',
    'hostHonorHands','pwaInstallSheet','localPeerOnly','extraTableThemes','highlightReelTools','syncedTrickAnim',
    'tvTableDisplay','devModuleMap'
  ];
  const NET_ALWAYS_ON = [
    'netSequencing','netReconnect','netBackoff','netHeartbeat','netDelta','netAuthoritative','netTimerSync',
    'netDuplicateGuard','netTurnGuard','netConnectionUI','netTurnHandoff','netOwnTurnRecovery','netDiagnostics',
    'netGraceRecovery','netSameIdResync','netNameReclaim','netActionQueue','netIceWatch','netResyncOnReclaim',
    'netHoldTimerOnDisconnect','netSilentDropDetect','lobbyReconnect'
  ];
  const FEATURE_ALWAYS_ON = [
    'customTurnServers','thinkingPulse','spectatorLateJoin',
    'partnerChatAfterNest','waitForMe','hostHonorHands','avatarPersonality','renderOptimization'
  ];
  function forceNetAlwaysOn(o) {
    const next = o || {};
    NET_ALWAYS_ON.forEach(id => { next[id] = true; });
    FEATURE_ALWAYS_ON.forEach(id => { next[id] = true; });
    return next;
  }
  function defaultExperimental() {
    const o = {};
    EXP_IDS.forEach(id => o[id] = false);
    return forceNetAlwaysOn(o);
  }
  function loadExperimental() {
    try {
      const raw = localStorage.getItem(EXP_KEY);
      if (!raw) return defaultExperimental();
      return forceNetAlwaysOn(Object.assign(defaultExperimental(), JSON.parse(raw)));
    } catch(e) { return defaultExperimental(); }
  }
  function saveExperimental(next) {
    const clean = forceNetAlwaysOn(Object.assign(defaultExperimental(), next || {}));
    try { localStorage.setItem(EXP_KEY, JSON.stringify(clean)); } catch(e) {}
    window.horExperimental = clean;
    return clean;
  }
  function applyExperimental() {
    const source = window.__horExpInitialized ? window.horExperimental : loadExperimental();
    const exp = window.horExperimental = forceNetAlwaysOn(Object.assign(defaultExperimental(), source || {}));
    window.__horExpInitialized = true;
    EXP_IDS.forEach(id => document.body.classList.toggle('exp-' + id, !!exp[id]));
    const inputs = document.querySelectorAll('[data-exp]');
    inputs.forEach(i => { i.checked = !!exp[i.getAttribute('data-exp')]; });
    updateExperimentalUI();
    try { if (typeof horStartHeartbeat === 'function') horStartHeartbeat(); } catch(e) {}
    if (exp.matchProgress) ensureMatchProgress(); else removeMatchProgress();
    if (exp.netConnectionUI || exp.netDiagnostics) ensureConnectionBadge(); else removeConnectionBadge();
    if (exp.debugPanel) { if (typeof horEnsureDebugUI === 'function') horEnsureDebugUI(); }
    else { if (typeof horRemoveDebugUI === 'function') horRemoveDebugUI(); }
    try { applyTestingFeatures(exp); } catch (e) { console.error('applyTestingFeatures', e); }
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
    document.querySelectorAll('[data-exp]').forEach(input => {
      const id = input.getAttribute('data-exp');
      input.checked = !!(window.horExperimental && window.horExperimental[id]);
    });
  }
  function wireExperimentalOptions() {
    window.horExperimental = loadExperimental();
    window.__horExpInitialized = true;
    document.querySelectorAll('[data-exp]').forEach(input => {
      input.onchange = () => {
        const x=loadExperimental(); x[input.getAttribute('data-exp')]=!!input.checked; saveExperimental(x); applyExperimental();
        try { if (isHost && typeof broadcastPlaySettings === 'function') broadcastPlaySettings(); } catch(e) {}
      };
    });
    const all = (v) => { const x=loadExperimental(); EXP_IDS.forEach(id=>x[id]=v); saveExperimental(x); applyExperimental(); try{if(isHost&&typeof broadcastPlaySettings==='function')broadcastPlaySettings();}catch(e){} };
    const ea=$('expEnableAll'), ed=$('expDisableAll'), er=$('expResetAll');
    if(ea) ea.onclick=()=>all(true); if(ed) ed.onclick=()=>all(false); if(er) er.onclick=()=>{ try{localStorage.removeItem(EXP_KEY);}catch(e){} window.horExperimental=defaultExperimental(); window.__horExpInitialized=true; applyExperimental(); try{if(isHost&&typeof broadcastPlaySettings==='function')broadcastPlaySettings();}catch(e){} };
    updateExperimentalUI();
  }
  window.applyHorExperimental = applyExperimental;
  window.loadHorExperimental = loadExperimental;
  window.saveHorExperimental = saveExperimental;
  const nativeAlert = window.alert.bind(window);
  if (!window.__horAlertWrapped) {
    window.alert = function(msg) {
      if (window.horExperimental && window.horExperimental.friendlyErrors) { horToast(String(msg || '')); }
      else nativeAlert(msg);
    };
    window.__horAlertWrapped = true;
  }


  function ensureConnectionBadge() {
    const offline = (typeof isSoloPractice !== 'undefined' && isSoloPractice) || (typeof roomCode !== 'undefined' && roomCode === 'OFFLINE');
    if (offline) { removeConnectionBadge(); return; }
    let b=$('horConnectionBadge');
    if(!b){
      b=document.createElement('span');
      b.id='horConnectionBadge';
      b.className='hor-connection-badge';
      b.textContent='● Connected';
      const row=$('phaseRow') || document.querySelector('.phase-row');
      if(row) row.appendChild(b);
      else {
        const phase=$('phaseLabel');
        if(phase && phase.parentNode) phase.parentNode.insertBefore(b, phase.nextSibling);
        else document.body.appendChild(b);
      }
    }
    // For the host, actually check the Peer's live connection to the
    // signaling server (peer.open && !peer.disconnected) rather than just
    // the isHost flag — isHost stays true even if the underlying socket to
    // 0.peerjs.com has silently dropped in the background, which used to
    // make this badge claim "Connected" when it wasn't.
    const online = isHost
      ? (typeof peer !== 'undefined' && !!peer && !!peer.open && !peer.disconnected)
      : (typeof hostConnection !== 'undefined' && hostConnection && hostConnection.open);
    const ping = Number(window.horLastPingMs);
    b.textContent = online ? ('● Connected' + ((window.horExperimental.netDiagnostics && Number.isFinite(ping)) ? ' · ' + Math.round(ping) + ' ms' : '')) : '● Reconnecting…';
    b.classList.toggle('bad', !online);
    b.classList.remove('hidden');
  }
  function removeConnectionBadge(){ const b=$('horConnectionBadge'); if(b) b.remove(); }
  function ensureMatchProgress(){
    let p=$('horMatchProgress'); if(!p){ p=document.createElement('div'); p.id='horMatchProgress'; p.className='hor-match-progress'; p.innerHTML='<div class="labels"><span id="horProgA">Griffin 0</span> · <span id="horProgB">Raven 0</span></div><div class="bar"><div class="fill" id="horProgFill"></div></div>'; const anchor=document.querySelector('.game-room')||document.getElementById('game'); if(anchor) anchor.prepend(p); }
    const scores=(game&&game.scores)||[0,0], goal=(game&&game.targetScore)||targetScore||500;
    const a=teamLabel(0), b=teamLabel(1); const A=$('horProgA'),B=$('horProgB'),F=$('horProgFill');
    if(A)A.textContent=a+' '+(scores[0]||0); if(B)B.textContent=b+' '+(scores[1]||0); if(F)F.style.width=Math.min(100,Math.max(0,Math.max(scores[0]||0,scores[1]||0)/goal*100))+'%';
  }
  function removeMatchProgress(){ const p=$('horMatchProgress'); if(p)p.remove(); }
  function experimentalTick(){ if(window.horExperimental.matchProgress)ensureMatchProgress(); if(window.horExperimental.netConnectionUI||window.horExperimental.netDiagnostics)ensureConnectionBadge(); if((window.horExperimental.netTurnHandoff||window.horExperimental.netOwnTurnRecovery) && typeof game!=='undefined' && game && !game.paused && game.currentPlayer===myIndex){ try{ if(typeof renderUI==='function') renderUI(); }catch(e){} } if(window.horExperimental.cacheRefresh && navigator.serviceWorker){ navigator.serviceWorker.getRegistration().then(r=>{if(r&&r.update)r.update()}).catch(()=>{}); } try { tickTestingFeatures(); } catch(e) {} }
  setInterval(experimentalTick,1200);

  window.handsPlayedSession = window.handsPlayedSession || 0;
  window.coachForcedOff = true;

  function seatElForIndex(idx) {
    if (typeof seatSlotIdForIndex === 'function') return $(seatSlotIdForIndex(idx));
    return null;
  }
  function ensureTestBox(id, html, cls) {
    let el = $(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = cls || 'hor-test-box';
      document.body.appendChild(el);
    }
    if (html != null) el.innerHTML = html;
    return el;
  }
  function removeEl(id) { const el = $(id); if (el) el.remove(); }

  function applyTestingFeatures(exp) {
    window.coachForcedOff = !exp.coachOverlay;
    document.body.classList.toggle('hor-webp-rook', !!exp.webpRookArt);
    document.body.classList.toggle('hor-landscape-dock', !!exp.landscapeDock);
    document.body.classList.toggle('hor-tv-display', !!exp.tvTableDisplay);
    document.body.classList.toggle('hor-honor-hands', !!exp.hostHonorHands);
    document.body.classList.toggle('hor-theme-cycle', !!exp.extraTableThemes);
    if (exp.extraTableThemes) {
      const themes = ['hor-felt-pub', 'hor-felt-kitchen', 'hor-felt-night'];
      themes.forEach(t => document.body.classList.remove(t));
      document.body.classList.add(themes[Math.floor(Date.now() / 60000) % themes.length]);
    } else {
      ['hor-felt-pub', 'hor-felt-kitchen', 'hor-felt-night'].forEach(t => document.body.classList.remove(t));
    }
    const xfer = $('btnTransferHost');
    if (xfer && typeof isHost !== 'undefined' && isHost && !isSoloPractice) {
      xfer.classList.remove('hidden');
    }
    if (exp.waitingQrAuto && typeof showQr === 'function' && typeof roomCode !== 'undefined' && roomCode && roomCode !== 'OFFLINE') {
      try { showQr(); } catch (e) {}
    }
    removeEl('horPwaSheet');
    if (exp.careerStats) ensureCareerSheet(); else removeEl('horCareerSheet');
    if (exp.devModuleMap) ensureModuleMap(); else removeEl('horModuleMap');
    ensureWaitForMeBtn();
    if (exp.rulesSelfTest) runRulesSelfTestOnce();
    else _rulesTestRan = false;
    if (exp.localPeerOnly && typeof Peer === 'undefined') {
      try { horToast('PeerJS vendor file missing — local copy required'); } catch (e) {}
    }
    if (exp.rematchSameFour) ensureRematchCard(); else removeEl('horRematchCard');
    wrapTestingHooks();
  }

  function tickTestingFeatures() {
    const exp = window.horExperimental || {};
    if (exp.seatPips) paintSeatPips(); else document.querySelectorAll('.hor-seat-pip').forEach(n => n.remove());
    paintThinkingPulse();
    if (exp.botStrengthLabels) paintBotLabels(); else document.querySelectorAll('.hor-bot-label').forEach(n => n.remove());
    if (window.horHostKickMute || exp.hostKickMute) paintKickMute();
    else document.querySelectorAll('.hor-kick-mute').forEach(n => n.remove());
    ensureWaitForMeBtn();
    if (exp.shareHandCard) ensureShareHandBtn();
    if (exp.highlightReelTools) ensureHighlightTools();
    if (exp.careerStats) updateCareerSheet();
    if (exp.tournamentLock && typeof game !== 'undefined' && game && game.phase && game.phase !== 'lobby' && game.phase !== 'waiting') {
      document.querySelectorAll('#optPaneRules input, #optPaneRules select').forEach(el => { el.disabled = true; });
    } else {
      document.querySelectorAll('#optPaneRules input, #optPaneRules select').forEach(el => { el.disabled = false; });
    }
    if (exp.turnAlert) maybeTurnAlert();
    stripHostPeek();
  }

  function paintSeatPips() {
    if (typeof players === 'undefined' || !players) return;
    const now = Date.now();
    players.forEach((p, i) => {
      const seat = seatElForIndex(i);
      if (!seat || !p || p.isBot) { if (seat) { const old = seat.querySelector('.hor-seat-pip'); if (old) old.remove(); } return; }
      let pip = seat.querySelector('.hor-seat-pip');
      if (!pip) { pip = document.createElement('span'); pip.className = 'hor-seat-pip'; seat.appendChild(pip); }
      const seen = (typeof horPeerLastSeen !== 'undefined' && horPeerLastSeen[p.id]) || 0;
      const age = seen ? now - seen : 99999;
      const open = (typeof isHost !== 'undefined' && isHost)
        ? (p.isHost || (typeof connMap !== 'undefined' && connMap[p.id] && connMap[p.id].open))
        : (p.id === myPeerId || (typeof hostConnection !== 'undefined' && hostConnection && hostConnection.open));
      pip.className = 'hor-seat-pip ' + (p.disconnected || !open ? 'pip-red' : age > 8000 ? 'pip-yellow' : 'pip-green');
      pip.title = p.disconnected ? 'Disconnected' : (open ? 'Connected' : 'Unknown');
    });
  }

  function paintThinkingPulse() {
    document.querySelectorAll('.player-slot').forEach(n => n.classList.remove('hor-thinking-pulse'));
    if (typeof game === 'undefined' || !game || game.paused || game.resolvingTrick) return;
    let idx = -1;
    if (game.phase === 'play' || game.phase === 'bidding') idx = game.currentPlayer;
    else if (game.phase === 'discard' || game.phase === 'trump') idx = game.bidder;
    const el = seatElForIndex(idx);
    if (el) el.classList.add('hor-thinking-pulse');
  }

  function paintBotLabels() {
    if (typeof players === 'undefined' || !players) return;
    const diff = (typeof botDifficulty !== 'undefined' && botDifficulty) || 'extreme';
    players.forEach((p, i) => {
      const seat = seatElForIndex(i);
      if (!seat) return;
      let lab = seat.querySelector('.hor-bot-label');
      if (!p || !p.isBot) { if (lab) lab.remove(); return; }
      if (!lab) { lab = document.createElement('div'); lab.className = 'hor-bot-label'; seat.appendChild(lab); }
      const bits = [String(diff).replace(/^./, c => c.toUpperCase())];
      if (typeof partnerNeverKill !== 'undefined' && partnerNeverKill) bits.push('won’t kill');
      if (typeof partnerFeedLast !== 'undefined' && partnerFeedLast) bits.push('feeds last');
      lab.textContent = bits.join(' · ');
    });
  }

  function paintKickMute() {
    if (typeof isHost === 'undefined' || !isHost) { document.querySelectorAll('.hor-kick-mute').forEach(n => n.remove()); return; }
    if (typeof players === 'undefined') return;
    players.forEach((p, i) => {
      const seat = seatElForIndex(i);
      if (!seat || !p || p.isBot || p.isHost || p.id === myPeerId) {
        if (seat) { const old = seat.querySelector('.hor-kick-mute'); if (old) old.remove(); }
        return;
      }
      let box = seat.querySelector('.hor-kick-mute');
      if (!box) {
        box = document.createElement('div');
        box.className = 'hor-kick-mute';
        box.innerHTML = '<button type="button" data-act="mute">Mute</button><button type="button" data-act="kick">Kick</button>';
        seat.appendChild(box);
        box.addEventListener('click', (ev) => {
          const act = ev.target && ev.target.getAttribute('data-act');
          if (act === 'mute') {
            p.muted = !p.muted;
            try { horToast((p.name || 'Player') + (p.muted ? ' muted' : ' unmuted')); } catch (e) {}
            try { broadcast({ type: 'message', text: (p.name || 'Player') + (p.muted ? ' was muted' : ' was unmuted') }); } catch (e) {}
          }
          if (act === 'kick' && typeof hostReplaceWithBot === 'function') {
            if (!confirm('Kick ' + (p.name || 'player') + ' and sit a bot?')) return;
            hostReplaceWithBot(p.id, p.name, false);
          }
        });
      }
    });
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
            if (game.paused) { hostTogglePause(); horToast('Resumed'); return; }
            if (game._waitUsed) { horToast('Already used Wait for me this hand'); return; }
            game._waitUsed = true;
            hostTogglePause();
            horToast('Table paused — Wait for me');
            return;
          }
          if (game._waitUsed) { horToast('Already used Wait for me this hand'); return; }
          game._waitUsed = true;
          if (typeof hostConnection !== 'undefined' && hostConnection && hostConnection.open) hostConnection.send({ type: 'buyTableMsg', text: 'Wait for me — please pause' });
          horToast('Wait for me sent');
        } catch (e) {}
      };
    }
    if (typeof game !== 'undefined' && game && game.paused && typeof isHost !== 'undefined' && isHost) {
      b.textContent = '▶';
      b.title = 'Resume table';
    } else {
      b.textContent = '✋';
      b.title = 'Wait for me';
    }
  }

  function ensureShareHandBtn() {
    const modal = $('scoreModal');
    if (!modal || modal.classList.contains('hidden')) return;
    if ($('horShareHandBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'horShareHandBtn';
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Share hand';
    btn.onclick = () => {
      const s = landscapeLastSummary || {};
      const text = 'House of Rooks — ' + (s.made ? 'MADE' : 'SET') + ' bid ' + (s.bid || '?') +
        ' trump ' + ((typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES[s.trump]) || s.trump || '—') +
        '  A ' + ((s.scores && s.scores[0]) || 0) + '–B ' + ((s.scores && s.scores[1]) || 0);
      if (navigator.share) navigator.share({ text: text }).catch(() => { try { navigator.clipboard.writeText(text); horToast('Copied'); } catch (e) {} });
      else { try { navigator.clipboard.writeText(text); horToast('Copied hand result'); } catch (e) { alert(text); } }
    };
    const actions = modal.querySelector('.modal-actions') || modal;
    actions.appendChild(btn);
  }

  function ensureHighlightTools() {
    const cele = document.getElementById('celePage') || document.getElementById('winModal') || $('ltEndGame');
    if (!cele || cele.classList.contains('hidden')) return;
    if ($('horReelTools')) return;
    const box = document.createElement('div');
    box.id = 'horReelTools';
    box.className = 'hor-reel-tools';
    box.innerHTML = '<button type="button" class="btn" id="horReelSkip">Skip reel</button><button type="button" class="btn" id="horReelShare">Share reel</button>';
    cele.appendChild(box);
    const skip = $('horReelSkip');
    if (skip) skip.onclick = () => { try { if (typeof hideCelePage === 'function') hideCelePage(); cele.classList.add('hidden'); } catch (e) {} };
    const share = $('horReelShare');
    if (share) share.onclick = () => {
      const text = 'House of Rooks highlight — ' + ((game && game.scores) ? game.scores.join('–') : '');
      if (navigator.share) navigator.share({ text: text }).catch(() => {});
      else try { navigator.clipboard.writeText(text); horToast('Copied'); } catch (e) {}
    };
  }

  function careerRead() {
    try { return JSON.parse(localStorage.getItem('horCareer') || '{}'); } catch (e) { return {}; }
  }
  function careerWrite(x) { try { localStorage.setItem('horCareer', JSON.stringify(x)); } catch (e) {} }
  function ensureCareerSheet() {
    const c = careerRead();
    ensureTestBox('horCareerSheet',
      '<b>Career</b><div>Hands ' + (c.hands || 0) + '</div><div>Made ' + (c.made || 0) + ' · Set ' + (c.set || 0) + '</div><div>High bid ' + (c.highBid || 0) + '</div>',
      'hor-test-box hor-career-sheet');
  }
  function updateCareerSheet() {
    if (!$('horCareerSheet')) ensureCareerSheet();
    else ensureCareerSheet();
    if (typeof handHistory !== 'undefined' && handHistory && handHistory.length) {
      const c = careerRead();
      c.hands = Math.max(c.hands || 0, handHistory.length);
      c.made = handHistory.filter(h => h.made).length;
      c.set = handHistory.filter(h => !h.made).length;
      c.highBid = Math.max(c.highBid || 0, ...handHistory.map(h => Number(h.bid) || 0));
      careerWrite(c);
    }
  }

  function ensureModuleMap() {
    ensureTestBox('horModuleMap',
      '<b>Module map</b><div>net — PeerJS, reconnect, grace</div><div>rules — deck, canPlay, scoring</div><div>bots — bid / play AI</div><div>ui — renderUI, landscape</div><div>polish.js — options, coach, themes</div>',
      'hor-test-box');
  }

  function ensureRematchCard() {
    try {
      if (typeof players !== 'undefined' && players && players.length) {
        localStorage.setItem('horLastFour', JSON.stringify(players.map(p => ({ name: p.name, isBot: !!p.isBot }))));
      }
    } catch (e) {}
    const lobby = $('lobby');
    if (!lobby || !lobby.offsetParent && lobby.classList.contains('hidden')) return;
    let last = [];
    try { last = JSON.parse(localStorage.getItem('horLastFour') || '[]'); } catch (e) {}
    if (!last.length) return;
    const box = ensureTestBox('horRematchCard',
      '<b>Same four?</b><div>' + last.map(p => (p.name || 'Player') + (p.isBot ? ' (bot)' : '')).join(', ') + '</div>',
      'hor-test-box');
    if (lobby && !lobby.contains(box)) lobby.appendChild(box);
  }

  let _rulesTestRan = false;
  function runRulesSelfTestOnce() {
    if (_rulesTestRan) return;
    _rulesTestRan = true;
    const fails = [];
    try {
      const rook = { color: 'rook', rank: 99, id: 'rook' };
      const r14 = { color: 'red', rank: 14, id: 'red-14' };
      const r10 = { color: 'red', rank: 10, id: 'red-10' };
      const g5 = { color: 'green', rank: 5, id: 'green-5' };
      if (typeof canPlay === 'function') {
        if (!canPlay(r10, [r10, g5], 'red', 'green')) fails.push('must follow red');
        if (canPlay(g5, [r10, g5], 'red', 'green')) fails.push('cannot slough while holding led');
      }
      if (typeof compareCards === 'function') {
        if (!(compareCards(r14, r10, 'red', 'green') > 0)) fails.push('14 beats 10');
      }
      if (typeof isRed2 === 'function' && !isRed2({ id: 'red-2', color: 'red', rank: 2 })) fails.push('isRed2');
    } catch (e) { fails.push(String(e && e.message)); }
    try { horToast(fails.length ? ('Rules test FAIL: ' + fails.join(', ')) : 'Rules self-test passed'); } catch (e) {}
  }

  function maybeTurnAlert() {
    if (typeof game === 'undefined' || !game || typeof myIndex !== 'number') return;
    const mine = (game.phase === 'play' || game.phase === 'bidding') && game.currentPlayer === myIndex
      || ((game.phase === 'discard' || game.phase === 'trump') && game.bidder === myIndex);
    if (!mine) { window._horTurnAlerted = false; return; }
    if (window._horTurnAlerted) return;
    window._horTurnAlerted = true;
    try { if (typeof playSfx === 'function') playSfx('turn', { broadcastNet: false }); } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([40, 40, 40]); } catch (e) {}
  }

  function stripHostPeek() {
    if (typeof isHost === 'undefined' || !isHost) return;
    document.querySelectorAll('.player-slot:not(#slot-me) .mini-hand, .player-slot:not(#slot-me) .peek-hand').forEach(n => n.remove());
  }

  function wrapTestingHooks() {
    if (window.__horTestWrapped) return;
    window.__horTestWrapped = true;
    if (typeof submitPlay === 'function') {
      const orig = submitPlay;
      window.submitPlay = function (cardId) {
        if (horExpOn('confirmPlay')) {
          if (window._horArmPlay !== cardId) {
            window._horArmPlay = cardId;
            try { horToast('Tap again to play'); } catch (e) {}
            return;
          }
          window._horArmPlay = null;
        }
        return orig.apply(this, arguments);
      };
    }
    if (typeof horNetSendRaw === 'function') {
      const origSend = horNetSendRaw;
      window.horNetSendRaw = function (conn, msg) {
        if (horExpOn('lagSandbox')) {
          setTimeout(() => origSend(conn, msg), 400);
          return true;
        }
        return origSend(conn, msg);
      };
    }
    if (typeof peerOptions === 'function') {
      const origPeer = peerOptions;
      window.peerOptions = function () {
        const o = origPeer();
        if (horExpOn('customTurnServers')) {
          o.config = o.config || {};
          o.config.iceServers = (o.config.iceServers || []).concat([
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
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

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {};
    } catch (e) { return {}; }
  }
  function savePrefs(patch) {
    const cur = Object.assign(loadPrefs(), patch || {});
    try { localStorage.setItem(PREF_KEY, JSON.stringify(cur)); } catch (e) {}
    return cur;
  }
  window.horSavePrefs = savePrefs;
  window.horLoadPrefs = loadPrefs;

  const ROOM_THEMES = {
    house: 'Griffin House — green felt, oak rail.',
    midnight: 'Midnight Club — navy felt, silver rail.',
    riverboat: 'Riverboat — crimson felt, gold rail.',
    cabin: 'Pine Cabin — moss felt, raw timber.',
    speakeasy: 'Speakeasy — black felt, brass lamp light.'
  };
  function applyRoomTheme(id, persist) {
    const theme = ROOM_THEMES[id] ? id : 'house';
    document.body.classList.remove('room-theme-house', 'room-theme-midnight', 'room-theme-riverboat', 'room-theme-cabin', 'room-theme-speakeasy');
    document.body.classList.add('room-theme-' + theme);
    document.querySelectorAll('.room-theme-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-theme') === theme);
    });
    const hint = $('roomThemeHint');
    if (hint) hint.textContent = ROOM_THEMES[theme];
    if (persist !== false) savePrefs({ roomTheme: theme });
    /* room theme class only */
  }
  window.applyRoomTheme = applyRoomTheme;

  const GFX_KEEP = [
    'feltTexture','woodRail','roomBackdrop','richFaces',
    'winnerBurst','trumpBanner','seatPlaques','paintedAvatars','tavernScore',
    'handBanner','matchTrophy','brassUI','waitingProps','hapticsHeavy'
  ];
  const GFX_DROP = ['themeBacks','dealArc','playFly','trickFan','bidChips','nestSeal','laydownSlam','lightContrast'];
  function defaultGfx() {
    const o = {};
    GFX_KEEP.forEach((id) => { o[id] = true; });
    GFX_DROP.forEach((id) => { o[id] = false; });
    return o;
  }
  function loadGfx() { return defaultGfx(); }
  function gfxOn(id) { return GFX_KEEP.indexOf(id) >= 0; }
  window.gfxOn = gfxOn;
  function applyGfx() {
    const gfx = defaultGfx();
    window.horGfx = gfx;
    GFX_KEEP.forEach((id) => document.body.classList.add('gfx-' + id));
    GFX_DROP.forEach((id) => document.body.classList.remove('gfx-' + id));
  }
  window.applyGfx = applyGfx;

  function persistPlayer() {
    const name = asText(($('hor-player-name') && $('hor-player-name').value) || (typeof myName === 'string' ? myName : ''), '');
    savePrefs({
      name,
      avatar: (typeof playerAvatars !== 'undefined' && playerAvatars[myPeerId]) || loadPrefs().avatar,
      botDifficulty,
      ruleVariant,
      includeOnes, includeRed2, includeRed1, includeRook, rookLowest,
      red2Points, minBid, targetScore, specialsAnytime, mustTrumpWhenVoid,
      bidOnlyScoring, sandbagging, nestGoesTo, leadOrder,
      misdealOnNoCounters, screwTheDealer, openWidow, shootMoonEnabled,
      teamNameA: houseTeamA,
      teamNameB: houseTeamB,
      luckySpecialsEnabled, luckySpecialsMode, luckySpecialsBoost,
      experimentalHandOpt,
      buyBeerBots,
      whisperHumans,
      roomTheme: loadPrefs().roomTheme || 'house',
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
    if (p.targetScore) targetScore = p.targetScore;
    if (typeof p.specialsAnytime === 'boolean') specialsAnytime = p.specialsAnytime;
    if (typeof p.mustTrumpWhenVoid === 'boolean') mustTrumpWhenVoid = p.mustTrumpWhenVoid;
    if (typeof p.bidOnlyScoring === 'boolean') bidOnlyScoring = p.bidOnlyScoring;
    if (typeof p.sandbagging === 'boolean') sandbagging = p.sandbagging;
    if (p.nestGoesTo) nestGoesTo = p.nestGoesTo;
    if (p.leadOrder) leadOrder = p.leadOrder;
    if (typeof p.misdealOnNoCounters === 'boolean') misdealOnNoCounters = p.misdealOnNoCounters;
    if (typeof p.screwTheDealer === 'boolean') screwTheDealer = p.screwTheDealer;
    if (typeof p.openWidow === 'boolean') openWidow = p.openWidow;
    if (typeof p.shootMoonEnabled === 'boolean') shootMoonEnabled = p.shootMoonEnabled;
    if (typeof p.luckySpecialsEnabled === 'boolean') luckySpecialsEnabled = p.luckySpecialsEnabled;
    if (p.luckySpecialsMode === 'spinner' || p.luckySpecialsMode === 'fixed') luckySpecialsMode = p.luckySpecialsMode;
    if (typeof p.luckySpecialsBoost === 'number') luckySpecialsBoost = p.luckySpecialsBoost;
    if (typeof p.experimentalHandOpt === 'boolean') experimentalHandOpt = p.experimentalHandOpt;
    if (typeof p.buyBeerBots === 'boolean') {
      buyBeerBots = p.buyBeerBots;
      document.body.classList.toggle('buy-beer-on', !!buyBeerBots);
    }
    if (typeof p.whisperHumans === 'boolean') {
      whisperHumans = p.whisperHumans;
      document.body.classList.toggle('whisper-on', !!whisperHumans);
    }
    houseTeamA = asText(p.teamNameA, 'Griffin');
    houseTeamB = asText(p.teamNameB, 'Raven');
    try { if (typeof recomputeHandAndNest === 'function') recomputeHandAndNest(); } catch (e) {}
    try { if (typeof syncOptionsUI === 'function') syncOptionsUI(); } catch (e) {}
    applyRoomTheme(p.roomTheme || 'house', false);
    applyGfx(p.gfx || loadGfx());
    window.horExperimental = loadExperimental();
    applyExperimental();
  }

  function applyPreset(id) {
    // Only the Griffin House ruleset exists now — Tournament and Kitchen
    // Table were removed as presets.
    if (typeof applyGriffinDefaults === 'function') applyGriffinDefaults({ broadcastChange: false });
    ruleVariant = 'griffin';
    try { recomputeHandAndNest(); } catch (e) {}
    try { syncOptionsUI(); } catch (e) {}
    document.querySelectorAll('.preset-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-preset') === ruleVariant);
    });
    const lab = $('rulesetLabel');
    if (lab) lab.textContent = 'Griffin House';
    persistPlayer();
    try { if (isHost && typeof broadcastPlaySettings === 'function') broadcastPlaySettings(); } catch (e) {}
    updateNestDestChip();
    refreshLiveRules();
  }
  window.applyHousePreset = applyPreset;

  function speakCode(code) {
    const letters = {
      A:'A as in Able', B:'B as in Baker', C:'C as in Charlie', D:'D as in Delta',
      E:'E as in Eagle', F:'F as in Fox', G:'G as in Griffin', H:'H as in House',
      J:'J as in Jackal', K:'K as in King', L:'L as in Lark', M:'M as in Maple',
      N:'N as in Nest', P:'P as in Partner', Q:'Q as in Queen', R:'R as in Raven',
      S:'S as in Seat', T:'T as in Trump', U:'U as in Under', V:'V as in Void',
      W:'W as in Widow', X:'X as in Extra', Y:'Y as in Yellow', Z:'Z as in Zest',
      '2':'two', '3':'three', '4':'four', '5':'five', '6':'six', '7':'seven', '8':'eight', '9':'nine'
    };
    const parts = String(code || '').toUpperCase().split('').map((ch) => letters[ch] || ch);
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
    if (!text) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.textContent = text;
    el.classList.toggle('mine', !!mine);
    el.classList.remove('hidden');
  }

  function refreshTurnBanner() {
    setTurnBanner('');
    return;
    if (!game || isSpectator) { setTurnBanner(''); return; }
    const led = game.ledColor ? (COLOR_NAMES[game.ledColor] || game.ledColor) : null;
    if (game.phase === 'bidding' && game.currentPlayer === myIndex) {
      setTurnBanner('Your bid — min ' + ((game.highestBid || (minBid - 5)) + 5), true);
    } else if (game.phase === 'play' && game.currentPlayer === myIndex) {
      setTurnBanner(led ? ('Your play — follow ' + led) : 'Your lead', true);
    } else if ((game.phase === 'discard' || game.phase === 'trump') && game.bidder === myIndex) {
      setTurnBanner(game.phase === 'trump' ? 'Name trump' : 'Discard down to hand size', true);
    } else {
      setTurnBanner('');
    }
  }

  function colorLabel(c) {
    try {
      if (typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES && COLOR_NAMES[c]) return COLOR_NAMES[c];
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
    const special = (typeof isSpecialCard === 'function')
      ? (c) => { try { return isSpecialCard(c); } catch (e) { return false; } }
      : (c) => !!(c && (c.color === 'rook' || c.id === 'rook'));
    let hasLed = false;
    try {
      hasLed = hand.some((c) => typeof followsLedSuit === 'function'
        ? followsLedSuit(c, led, trump)
        : (c && c.color === led));
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
      if (!sheet) { resolve(window.confirm(body || title)); return; }
      $('confirmTitle').textContent = title || 'Please confirm';
      $('confirmBody').textContent = body || '';
      const ok = $('confirmOk');
      ok.classList.toggle('danger', danger !== false);
      sheet.classList.remove('hidden');
      const done = (val) => {
        sheet.classList.add('hidden');
        ok.onclick = null;
        $('confirmCancel').onclick = null;
        resolve(val);
      };
      ok.onclick = () => done(true);
      $('confirmCancel').onclick = () => done(false);
    });
  }
  window.houseConfirm = houseConfirm;

  function refreshLiveRules() {
    const intro = $('liveRulesIntro');
    if (!intro) return;
    const bird = includeRook ? (rookLowest ? 'the Bird is lowest trump' : 'the Bird is highest trump') : 'no Bird card';
    const r2 = includeRed2 ? ('Red 2 is in, ' + red2Points + ' pts') : 'no Red 2';
    const ones = includeOnes ? '1s are high in color (15 pts)' : 'no 1s';
    const nest = nestGoesTo === 'bidder' ? 'nest counters go to the makers' : 'nest counters go to last trick';
    const score = bidOnlyScoring ? 'makers score the bid only' : (sandbagging ? 'sandbagging penalty is on' : 'makers score counters taken');
    intro.innerHTML =
      '<p><b>This table:</b> Griffin House' +
      ' · nest ' + nestSizeDefault + ' · min bid ' + minBid + ' · play to ' + targetScore + '.</p>' +
      '<p>' + bird + '. ' + r2 + '. ' + ones + '.</p>' +
      '<p>Follow color if you can. ' + nest + '. ' + score + '.</p>' +
      '<p>Gold cards are legal on your turn. Long-press a dim card to see why.</p>';
  }

  const PLAY_TIPS = {
    lobby: {
      title: 'New at this table',
      html: '<p>Type your name, then tap <b>Play offline</b>. Tips pop up as the hand happens — bid, nest, trump, tricks, money, then messages.</p><p>Friends tables work the same way. Skip anytime if you already know it.</p>'
    },
    sit: {
      title: 'Partners sit across',
      html: '<p>You and the chair facing you are one team. The two beside you are the other. First team to the table target wins the match.</p>'
    },
    bidding: {
      title: 'The auction is on',
      html: '<p>Someone is bidding. Raise by fives or pass. Three passes and the high bidder buys the nest.</p><p>Counters that score: 5s, 10s, 14s, 1s (15), the Bird (20), Red 2 (20 when it is in).</p>'
    },
    myBid: {
      title: 'Your bid',
      html: '<p>Use +5 / −5, then Bid, or Pass. Only bid what this hand plus a fair nest can make. A set costs you the bid.</p>'
    },
    nest: {
      title: 'You bought the nest',
      html: '<p>Those extra cards are now in your hand. Throw the same number back. Keep trump length and counters. Then you name trump.</p>'
    },
    nestWait: {
      title: 'Waiting on the nest',
      html: '<p>The bidder is sorting the nest. You will play after they name a trump color.</p>'
    },
    trump: {
      title: 'Stamp trump',
      html: function () {
        let line = 'Pick the color you want as trump. That color — and the Bird — beat everything else.';
        if (typeof includeRed2 !== 'undefined' && includeRed2) {
          line += ' Red 2 is the second-highest trump, under the Bird.';
        }
        return '<p>' + line + '</p>';
      }
    },
    trumpWait: {
      title: 'Trump coming',
      html: '<p>The bidder names trump next. Remember the color. Follow the led color when you can.</p>'
    },
    lead: {
      title: 'Lead a card',
      html: '<p>Gold-rim cards are legal. Tap one to play it. Long-press a dim card to see why it will not play.</p>'
    },
    follow: {
      title: 'Follow color',
      html: '<p>Play the color that was led if you have it. If you are void you may trump or dump off-color. Highest trump, else highest of the led color, wins the trick.</p>'
    },
    bank: {
      title: 'That trick paid you',
      html: '<p>Counters you personally take become <b>dollars on your chair</b>. That bank is not the team score. A 10 and a 5 in your trick is $15 in your pocket.</p>'
    },
    message: {
      title: 'Buy a table message',
      html: '<p>When your bank hits <b>$100</b>, tap your gold bank or ✉ Message · $100. Type a short shout and Send. Hold keeps the draft if you are still short. The $100 leaves your chair when it posts.</p>'
    },
    score: {
      title: 'Hand is in',
      html: '<p>Makers need at least the bid in counters. Miss it and they are set. Nest counters usually go to last trick.</p><p>Keep capturing — that is how you earn the $100 message. This tour will stay quiet unless you mark this name new again.</p>'
    }
  };
  const PLAY_TIP_ORDER = ['lobby','sit','bidding','myBid','nest','nestWait','trump','trumpWait','lead','follow','bank','message','score'];

  let tourActive = false;
  let currentTipId = '';
  let manualTour = false;
  let pendingTips = [];
  window.horTourBlocking = false;
  window.horTourResumeBot = false;

  function currentPlayerName() {
    return asText(($('hor-player-name') && $('hor-player-name').value) || (typeof myName === 'string' ? myName : ''), '') || 'You';
  }
  function currentPlayerKey() {
    const n = currentPlayerName().trim().toLowerCase();
    return n || '__device__';
  }
  function loadNewMap() {
    const p = loadPrefs();
    return (p && p.newPlayerMap && typeof p.newPlayerMap === 'object') ? p.newPlayerMap : {};
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
    const all = PLAY_TIP_ORDER.every((sid) => rec.seen[sid] || sid === 'lobby' || sid === 'nestWait' || sid === 'trumpWait');
    if (all) rec.veteran = true;
    saveNewMap(map);
    if (rec.veteran) savePrefs({ sawTutorial: true });
  }
  function renderNewPlayerLists() {
    const map = loadNewMap();
    const keys = Object.keys(map);
    if (!keys.length) playerRecord();
    const html = Object.keys(loadNewMap()).map((key) => {
      const rec = loadNewMap()[key];
      const label = rec.name || key;
      const neu = !rec.veteran;
      return '<div class="new-player-row">'
        + '<span><b>' + asText(label, key) + '</b> · ' + (neu ? 'New' : 'Experienced') + '</span>'
        + (neu
          ? '<button type="button" class="btn" data-clear-new="' + key + '">Remove new mark</button>'
          : '<button type="button" class="btn" data-mark-new="' + key + '">Mark new again</button>')
        + '</div>';
    }).join('') || '<p class="option-hint">No names stored yet. Sit down once and the name appears here.</p>';
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
    if (pendingTips.length) {
      const next = pendingTips.shift();
      showPlayTip(next, { force: true });
      return;
    }
    setTimeout(maybeTutorial, 80);
    if (window.horTourResumeBot) {
      window.horTourResumeBot = false;
      try { if (typeof scheduleBot === 'function') scheduleBot(); } catch (e) {}
    }
  }

  function showPlayTip(id, opts) {
    const step = PLAY_TIPS[id];
    if (!step) return;
    if (!manualTour && !isNewPlayer()) return;
    if (!manualTour && seenTip(id) && !(opts && opts.force)) return;
    if (tourActive && currentTipId === id) return;
    if (tourActive && currentTipId && currentTipId !== id) {
      if (pendingTips.indexOf(id) < 0) pendingTips.push(id);
      return;
    }
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
    try { if (typeof botTimer !== 'undefined' && botTimer) { clearTimeout(botTimer); botTimer = null; } } catch (e) {}
    try { if (typeof setBotThinking === 'function') setBotThinking(false); } catch (e) {}
    if (kick) kick.textContent = manualTour ? 'House tour' : 'As you play';
    if (title) title.textContent = step.title;
    tx.innerHTML = (typeof step.html === 'function') ? step.html() : step.html;
    window.horPinTip = true;
    if (next) next.textContent = 'Got it';
    if (back) back.classList.add('hidden');
    const bar = $('tutorialProgress');
    if (bar) {
      const idx = PLAY_TIP_ORDER.indexOf(id);
      bar.innerHTML = PLAY_TIP_ORDER.map((_, i) => {
        const cls = i === idx ? 'on' : (i < idx ? 'done' : '');
        return '<span class="tutorial-dot ' + cls + '"></span>';
      }).join('');
    }
    ov.classList.remove('hidden');
    ov.setAttribute('aria-hidden', 'false');
    placeLobbyTipCard();
  }

  function placeLobbyTipCard() {
    const ov = $('tutorialOverlay');
    const card = ov && ov.querySelector('.tutorial-card');
    const join = $('joinBtn');
    if (!ov || !card) return;
    if (currentTipId === 'lobby') {
      ov.classList.add('lobby-placed');
      let top = 12;
      if (join) {
        const r = join.getBoundingClientRect();
        top = Math.max(8, Math.round(r.bottom + 10));
      }
      card.style.marginTop = top + 'px';
    } else {
      ov.classList.remove('lobby-placed');
      card.style.marginTop = '';
    }
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
    pendingTips = [];
    window.horTourBlocking = false;
    if (window.horTourResumeBot) {
      window.horTourResumeBot = false;
      try { if (typeof scheduleBot === 'function') scheduleBot(); } catch (e) {}
    }
    try { if (typeof window.flushAfterTour === 'function') window.flushAfterTour(); } catch (e) {}
  }

  function maybeTutorial() {
    if (tourActive) return;
    if (isSpectator) return;
    const lobby = $('lobby');
    const onLobby = lobby && !lobby.classList.contains('hidden');
    if (onLobby) {
      if (!isNewPlayer()) return;
      if (window.__horLobbyTipShown) return;
      window.__horLobbyTipShown = true;
      showPlayTip('lobby');
      return;
    }
    if (!game) return;
    if (!isNewPlayer() && !manualTour) return;
    if (game.phase === 'bidding' || game.phase === 'dealing') {
      if (!seenTip('sit')) { showPlayTip('sit'); return; }
      if (typeof myIndex === 'number' && game.currentPlayer === myIndex && game.phase === 'bidding') showPlayTip('myBid');
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
  function dismissTutorial(done) {
    finishHouseTour(!!done);
  }

  function markPartnerSeat() {
    const el = $('slot-partner');
    if (!el) return;
    let chip = el.querySelector('.partner-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 'partner-chip';
      el.appendChild(chip);
    }
    const show = game && (game.phase === 'bidding' || game.phase === 'dealing' || game.phase === 'discard');
    chip.textContent = 'your partner';
    chip.classList.toggle('hidden', !show);
  }

  function shouldShowCoach() {
    return false;
    if (landscapeBidHints === false) return false;
    if (window.coachForcedOff) return false;
    if (botDifficulty === 'extreme' && !isSoloPractice) return false;
    if (!isSoloPractice && typeof humanPlayerCount === 'function' && humanPlayerCount() >= 4) return false;
    if ((matchStats && matchStats.hands >= 3) || window.handsPlayedSession >= 3) {
      if (botDifficulty === 'easy' || isSoloPractice) return landscapeBidHints;
      return false;
    }
    return botDifficulty === 'easy' || isSoloPractice || landscapeBidHints;
  }

  function updateSpectatorChrome() {
    const badge = $('spectatorBadge');
    if (isSpectator) {
      if (badge) {
        const t = (typeof myIndex === 'number' && myIndex >= 0) ? '' : teamLabel(0);
        badge.textContent = 'Watching' + (t ? ' — ' + t : '');
        badge.classList.remove('hidden');
      }
      const panel = $('actionPanel');
      if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
      document.body.classList.add('is-spectator');
    } else {
      document.body.classList.remove('is-spectator');
    }
  }

  function scoringSentence(summary) {
    if (!summary) return '';
    const makers = teamLabel(summary.bidderTeam);
    const taken = summary.bidderTeam === 0 ? summary.pointsA : summary.pointsB;
    if (summary.made) {
      if (bidOnlyScoring) return makers + ' bid ' + summary.bid + ', took ' + taken + ' → +' + summary.bid + ' (bid only).';
      if (sandbagging && taken > summary.bid) {
        const over = taken - summary.bid;
        return makers + ' bid ' + summary.bid + ', took ' + taken + ' → +' + (summary.bid - over) + ' after sandbag.';
      }
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
    let capture = '—';
    try {
      const pool = (matchTricks || []).slice();
      const hit = pool.find((t) => t && t.plays && t.plays.some((p) => p.card && (p.card.color === 'rook' || p.card.id === 'rook'))
        && t.plays.some((p) => p.card && ((typeof isRed2 === 'function' && isRed2(p.card)) || p.card.id === 'red-2')));
      if (hit) capture = 'Bird took Red 2';
    } catch (e) {}
    const mvpSeat = (function () {
      try {
        const names = (game && game.players) || players || [];
        return (names[0] && names[0].name) || 'Table';
      } catch (e) { return 'Table'; }
    })();
    box.innerHTML = '<div class="recap-grid">' +
      '<div><span>Final</span><b>' + teamLabel(0) + ' ' + scores[0] + ' · ' + teamLabel(1) + ' ' + scores[1] + '</b></div>' +
      '<div><span>Hands</span><b>' + made + ' made · ' + sets + ' set</b></div>' +
      '<div><span>Biggest capture</span><b>' + capture + '</b></div>' +
      '<div><span>First chair</span><b>' + mvpSeat + '</b></div>' +
      '</div>';
  }

  function wireLobby() {
    const name = $('hor-player-name');
    const p = loadPrefs();
    if (name) name.value = asText(p.name, '');
    const ta = $('hor-team-a'); const tb = $('hor-team-b');
    if (ta) ta.value = houseTeamA;
    if (tb) tb.value = houseTeamB;
    const friendsBtn = $('friendsToggleBtn');
    const panel = $('friendsPanel');
    if (friendsBtn) {
      friendsBtn.onclick = () => {
        try {
          isSpectator = false;
          if (typeof createRoom === 'function') createRoom();
        } catch (e) {}
      };
    }
    document.querySelectorAll('.preset-btn').forEach((b) => {
      b.onclick = () => applyPreset(b.getAttribute('data-preset'));
    });
    document.querySelectorAll('.opt-tab').forEach((tab) => {
      tab.onclick = () => {
        document.querySelectorAll('.opt-tab').forEach((t) => t.classList.toggle('active', t === tab));
        const which = tab.getAttribute('data-opt-tab');
        const rules = $('optPaneRules'); const table = $('optPaneTable');
        const playersPane = $('optPanePlayers');
        const settingsPane = $('optPaneSettings');
        if (rules) rules.classList.toggle('hidden', which !== 'rules');
        if (table) table.classList.toggle('hidden', which !== 'table');
        if (playersPane) playersPane.classList.toggle('hidden', which !== 'players');
        if (settingsPane) settingsPane.classList.toggle('hidden', which !== 'settings');
        if (which === 'players') renderNewPlayerLists();
        if (which === 'settings') { try { applyPlaqueColors(); } catch (e) {} }
      };
    });
    const tn = $('tutorialNext');
    const tourSkip = $('tutorialSkip');
    if (tn) tn.onclick = () => {
      if (currentTipId) markTipSeen(currentTipId);
      window.horPinTip = false;
      hideTourCard(true);
      manualTour = false;
      resumeAfterTip();
      try { if (typeof window.flushAfterTour === 'function' && !window.horTourBlocking) window.flushAfterTour(); } catch (e) {}
    };
    if (tourSkip) tourSkip.onclick = () => finishHouseTour(true);
    const replay = $('replayTutorialBtn');
    if (replay) replay.onclick = () => startHouseTour();
    const npLobby = $('newPlayersLobbyBtn');
    const npModal = $('newPlayersModal');
    if (npLobby && npModal) npLobby.onclick = () => { renderNewPlayerLists(); npModal.classList.remove('hidden'); };
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
    try { applyPlaqueColors(); } catch (e) {}
    maybeTutorial();
    document.querySelectorAll('.room-theme-btn').forEach((b) => {
      b.onclick = () => applyRoomTheme(b.getAttribute('data-theme'), true);
    });
    applyRoomTheme((p && p.roomTheme) || 'house', false);
    applyGfx((p && p.gfx) || loadGfx());
    document.querySelectorAll('a.cash-app-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var url = 'https://cash.app/$heargodtalk';
        var standalone = false;
        try {
          standalone = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
        } catch (err) {}
        if (!standalone) return;
        e.preventDefault();
        var opened = null;
        try { opened = window.open(url, '_blank'); } catch (err) {}
        if (opened) return;
        try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText('$heargodtalk'); } catch (err) {}
        var st = $('lobbyStatus');
        if (st) st.textContent = 'Cashtag copied: $heargodtalk — open Cash App and send there. This page stays put so the table does not reload.';
      });
    });
    if (name) name.addEventListener('change', persistPlayer);
    if (ta) ta.addEventListener('change', () => { houseTeamA = asText(ta.value, 'Griffin'); persistPlayer(); });
    if (tb) tb.addEventListener('change', () => { houseTeamB = asText(tb.value, 'Raven'); persistPlayer(); });
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
  const _createRoom = window.createRoom;
  window.createRoom = function () {
    persistPlayer();
    hideTourCard();
    myName = ($('hor-player-name') && $('hor-player-name').value || '').trim() || loadPrefs().name || 'Host';
    const r = _createRoom.apply(this, arguments);
    setTimeout(() => speakCode(roomCode), 400);
    return r;
  };

  const _joinRoom = window.joinRoom;
  window.joinRoom = function () {
    persistPlayer();
    hideTourCard();
    myName = ($('hor-player-name') && $('hor-player-name').value || '').trim() || loadPrefs().name || 'Player';
    return _joinRoom.apply(this, arguments);
  };

  const _startSolo = window.startSoloPractice;
  window.startSoloPractice = function () {
    persistPlayer();
    hideTourCard();
    applyPrefsToEngine();
    const name = ($('hor-player-name') && $('hor-player-name').value || '').trim() || loadPrefs().name || 'You';
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
    try {
      const base = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
      const map = { me: base, left: (base + 1) % 4, partner: (base + 2) % 4, right: (base + 3) % 4 };
      Object.keys(map).forEach((slot) => {
        const el = $('slot-' + slot);
        if (!el) return;
        const p = (game && game.players && game.players[map[slot]]) || players[map[slot]];
        const team = (p && typeof p.team === 'number') ? p.team : (map[slot] % 2);
        el.setAttribute('data-plaque-team', String(team));
        const nameEl = el.querySelector('.name');
        if (nameEl) nameEl.setAttribute('data-plaque-team', String(team));
      });
      applyPlaqueColors();
    } catch (e) {}
    markPartnerSeat();
    refreshTurnBanner();
    updateNestDestChip();
    updateSpectatorChrome();
    try {
      const base = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
      const map = { me: base, left: (base + 1) % 4, partner: (base + 2) % 4, right: (base + 3) % 4 };
      Object.keys(map).forEach((slot) => {
        const el = $('slot-' + slot);
        if (!el) return;
        let btn = el.querySelector('.buy-beer-btn');
        const idx = map[slot];
        const p = players[idx];
        let rack = el.querySelector('.seat-top-rack');
        if (!rack) {
          rack = document.createElement('div');
          rack.className = 'seat-top-rack';
          el.insertBefore(rack, el.firstChild);
        }
        if (buyBeerBots && p && p.isBot && slot !== 'me') {
          if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'buy-beer-btn btn';
            rack.appendChild(btn);
          }
          const buzzed = typeof isBuzzed === 'function' && isBuzzed(idx);
          btn.textContent = buzzed ? '🍺 Buzzed' : '🍺 $150';
          btn.onclick = (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            if (buzzed) return;
            if (typeof buyBotBeer === 'function') buyBotBeer(idx);
          };
          btn.oncontextmenu = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
          let holdT = 0;
          btn.onpointerdown = (ev) => {
            holdT = setTimeout(() => {
              const msg = (typeof formatBuzzLeft === 'function') ? formatBuzzLeft(idx) : 'Buzzed';
              try { showWhy(msg, ev.clientX || 80, ev.clientY || 40); } catch (e) {}
            }, 380);
          };
          btn.onpointerup = btn.onpointercancel = btn.onpointerleave = () => clearTimeout(holdT);
        } else if (btn) btn.remove();
        let wbtn = el.querySelector('.whisper-btn');
        if (whisperHumans && p && !p.isBot && slot !== 'me') {
          if (!wbtn) {
            wbtn = document.createElement('button');
            wbtn.type = 'button';
            wbtn.className = 'whisper-btn btn';
            rack.appendChild(wbtn);
          }
          wbtn.textContent = '✉ $200';
          wbtn.onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); if (typeof openWhisperBuy === 'function') openWhisperBuy(idx); };
        } else if (wbtn) wbtn.remove();
      });
    } catch (e) {}
    maybeTutorial();
  };

  const _showScore = window.showScoreModal;
  window.showScoreModal = function (summary) {
    _showScore.apply(this, arguments);
    window.handsPlayedSession = (window.handsPlayedSession || 0) + 1;
    try { showPlayTip('score'); } catch (e) {}
    try {
      const body = $('scoreModalBody');
      if (body && summary) {
        const teach = document.createElement('p');
        teach.className = 'score-teach';
        const nestLine = summary.nestPts
          ? (' Nest ' + summary.nestPts + ' to ' + (summary.nestWinnerName || (nestGoesTo === 'bidder' ? 'makers' : 'last trick')) + '.')
          : '';
        teach.textContent = scoringSentence(summary) + nestLine +
          ' Running total: ' + teamLabel(0) + ' ' + summary.scores[0] + ' · ' + teamLabel(1) + ' ' + summary.scores[1] +
          ' (to ' + (game?.targetScore || targetScore) + ').';
        const banner = body.querySelector('.score-banner');
        if (banner && banner.parentNode) banner.parentNode.insertBefore(teach, banner.nextSibling);
        body.querySelectorAll('.sb-label').forEach((el, i) => { el.textContent = teamLabel(i); });
      }
    } catch (e) {}
  };

  const _showWin = window.showWinCelebration;
  window.showWinCelebration = function (winner, scores) {
    let label = winner;
    if (winner === 'Team A') label = teamLabel(0);
    if (winner === 'Team B') label = teamLabel(1);
    _showWin.call(this, label, scores);
    const sub = $('winSub');
    if (sub && scores) sub.textContent = 'Final: ' + teamLabel(0) + ' ' + scores[0] + ' – ' + teamLabel(1) + ' ' + scores[1];
  };

  const _startCele = window.startMatchCelebration;
  window.startMatchCelebration = function () {
    _startCele.apply(this, arguments);
    const data = pendingCele || {};
    nightRecap(data.winner, data.scores || [0, 0]);
  };

  const _showBid = window.showBidUI;
  window.showBidUI = function () {
    _showBid.apply(this, arguments);
    refreshTurnBanner();
    maybeTutorial();
  };

  const _showTrump = window.showTrumpUI;
  window.showTrumpUI = function () {
    const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
    if (landscape) return _showTrump.apply(this, arguments);
    const panel = $('actionPanel');
    if (!panel) return _showTrump.apply(this, arguments);
    panel.classList.remove('hidden');
    panel.classList.add('trump-showdown');
    let html = '<h3>Stamp the trump</h3><div class="trump-showdown-grid">';
    COLORS.forEach((c) => {
      html += '<button type="button" class="trump-tile ' + c + '" data-trump="' + c + '"><span class="trump-swatch"></span>' + COLOR_NAMES[c] + '</button>';
    });
    html += '</div><p class="option-hint">' + (includeRook ? (rookLowest ? 'The Bird stays lowest trump.' : 'The Bird stays highest trump.') : '') + '</p>';
    panel.innerHTML = html;
    panel.querySelectorAll('[data-trump]').forEach((btn) => {
      btn.onclick = () => submitTrump(btn.getAttribute('data-trump'));
    });
  };

  const _finishBid = window.finishBidding;
  window.finishBidding = function () {
    const nestCards = (game && game.nest) ? game.nest.map((c) => Object.assign({}, c)) : [];
    const pts = nestCards.reduce((s, c) => s + ((typeof cardPoints === 'function') ? cardPoints(c) : 0), 0);
    const r = _finishBid.apply(this, arguments);
    if (game && game.bidder === myIndex && nestCards.length) {
      const ov = $('discardOverlay');
      const msg = $('messageArea');
      if (msg) msg.textContent = 'Nest: ' + pts + ' points — pick ' + nestCards.length + ' to throw back.';
      if (ov && !reduceMotion) ov.classList.add('nest-beat');
    }
    maybeTutorial();
    return r;
  };

  function bindWhyOnCards(root) {
    if (!root) return;
    root.querySelectorAll('.card-face').forEach((el) => {
      if (el.dataset.whyBound === '1') return;
      el.dataset.whyBound = '1';
      let holdTimer = 0;
      const explain = (ev) => {
        const id = String(el.dataset.id);
        const card = (game && game.myHand || []).find((c) => String(c.id) === id);
        const reason = card ? illegalReason(card) : 'Not a legal play right now';
        const x = (ev && ev.clientX) || (el.getBoundingClientRect().left + 24);
        const y = (ev && ev.clientY) || el.getBoundingClientRect().top;
        showWhy(reason, x, y);
      };
      el.addEventListener('pointerdown', (ev) => {
        if (el.classList.contains('playable')) tapHaptic(true);
        clearTimeout(holdTimer);
        // Dim cards only explain on a true hold so a tap never plays them.
        holdTimer = setTimeout(() => explain(ev), 420);
      });
      const cancelHold = () => { clearTimeout(holdTimer); };
      el.addEventListener('pointerup', cancelHold);
      el.addEventListener('pointercancel', cancelHold);
      // Do not cancel on pointerleave — a slight finger wobble was killing the hold.
      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        explain(ev);
      });
    });
  }
  const _renderHand = window.renderHand;
  window.renderHand = function (discardMode, opts) {
    _renderHand.apply(this, arguments);
    bindWhyOnCards($('myHand'));
    bindWhyOnCards($('ltHand'));
  };

  const _setBot = window.setBotThinking;
  window.setBotThinking = function (on) {
    _setBot.apply(this, arguments);
    const el = $('botThinking');
    if (!el || !on || !game) return;
    const seat = players[game.currentPlayer] || players[game.bidder];
    const av = seat && (playerAvatars[seat.id] || seat.avatar);
    const label = seat ? seat.name : 'Bot';
    el.innerHTML = (av ? '<span class="seat-avatar">' + avatarHTML(av) + '</span> ' : '') + label + ' is thinking…';
  };

  const _hostUndo = window.hostUndoLastPlay;
  window.hostUndoLastPlay = function () {
    if (!lastPlaySnapshot) return;
    if (lastPlaySnapshot.fromHuman) return;
    return _hostUndo.apply(this, arguments);
  };

  const _promptPlay = window.hostPromptPlay;
  if (typeof _promptPlay === 'function') {
    // snapshot tagging happens in hostProcessPlay wrap
  }

  const _hostProcessPlay = window.hostProcessPlay;
  if (typeof _hostProcessPlay === 'function') {
    window.hostProcessPlay = function (data) {
      const seat = data && data.player;
      const human = seat >= 0 && players[seat] && !players[seat].isBot;
      const r = _hostProcessPlay.apply(this, arguments);
      if (lastPlaySnapshot) lastPlaySnapshot.fromHuman = !!human;
      const btn = $('btnUndo');
      if (btn) {
        btn.title = lastPlaySnapshot && !lastPlaySnapshot.fromHuman ? 'Take back last bot play' : 'Take back last bot play';
        btn.classList.toggle('disabled', !lastPlaySnapshot || !!lastPlaySnapshot.fromHuman);
      }
      return r;
    };
  }

  const _clientLeave = window.clientLeaveReplace;
  window.clientLeaveReplace = async function () {
    const ok = await houseConfirm({
      title: isHost ? 'Leave this table?' : 'Leave and seat a bot?',
      body: isHost ? 'You are the host. Leaving ends the room for everyone.' : 'A bot will take your chair for the rest of the night.',
      danger: true,
    });
    if (!ok) return;
    if (isHost) {
      try { broadcast({ type: 'error', message: 'Host left the game.' }); } catch (e) {}
      location.reload();
      return;
    }
    try {
      if (hostConnection && hostConnection.open) {
        hostConnection.send({ type: 'leaveReplace', playerId: myPeerId, name: myName });
      }
    } catch (e) {}
    setTimeout(() => location.reload(), 300);
  };

  const _redeal = window.hostRedeal;
  window.hostRedeal = async function () {
    const ok = await houseConfirm({ title: 'Redeal this hand?', body: 'Bids and this deal will be wiped.', danger: true });
    if (!ok) return;
    return _redeal.apply(this, arguments);
  };

  const _pauseBtn = document.getElementById('btnPause');
  if (_pauseBtn) {
    const old = _pauseBtn.onclick;
    _pauseBtn.onclick = async function (e) {
      if (game && !game.paused) {
        const ok = await houseConfirm({ title: 'Pause the table?', body: 'Everyone waits until you resume.', danger: false });
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

  const _showRulesFn = window.showVariantRules;
  window.showVariantRules = function () {
    _showRulesFn.apply(this, arguments);
    refreshLiveRules();
  };

  const _syncOpts = window.syncOptionsUI;
  window.syncOptionsUI = function () {
    _syncOpts.apply(this, arguments);
    const hint = $('variantHint');
    const names = { griffin: 'Griffin House' };
    if (hint) hint.textContent = (names[ruleVariant] || 'Griffin House') + ' · Nest ' + nestSizeDefault + ' · min bid ' + minBid + ' · to ' + targetScore;
    const lab = $('rulesetLabel');
    if (lab) lab.textContent = names[ruleVariant] || 'Griffin House';
    document.querySelectorAll('.preset-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-preset') === (ruleVariant || 'griffin'));
    });
    updateNestDestChip();
  };

  const _coach = window.coachBidAdvice;
  if (typeof _coach === 'function') {
    window.coachBidAdvice = function () {
      if (!shouldShowCoach()) return { text: '', cards: [] };
      return _coach.apply(this, arguments);
    };
  }

  // card art: prefer compact webp
  const _inner = window.cardInnerHTML;
  window.cardInnerHTML = function (card) {
    if (card && (card.color === 'rook' || card.id === 'rook')) {
      return '<div class="c-stack rook-stack"><img class="rook-bird-img" src="Rook.webp" alt="Bird" draggable="false" onerror="this.src=\'Rook.png\'"></div>';
    }
    if (card && typeof isRed2 === 'function' && isRed2(card) && includeRed2) {
      return '<div class="c-stack red2-stack"><img class="red2-img" src="Red2-card.webp" alt="Red 2" draggable="false" onerror="this.src=\'Red2.png\'"></div>';
    }
    const html = _inner.apply(this, arguments);
    return html;
  };

  // color-blind pips on bars via CSS class already; add data-pip
  function flashGfxBanner(id, text, cls) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = (cls || el.className.replace('hidden', '')).trim();
    el.classList.remove('hidden');
    setTimeout(() => { try { el.classList.add('hidden'); } catch (e) {} }, 2200);
  }
  const _trump = window.hostProcessTrump;
  if (typeof _trump === 'function') {
    window.hostProcessTrump = function (data) {
      const r = _trump.apply(this, arguments);
      if (gfxOn('trumpBanner') && data && data.color) {
        const name = (typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES[data.color]) || data.color;
        const line = 'TRUMP  ·  ' + String(name).toUpperCase();
        ['trumpBanner', 'ltTrumpStamp'].forEach((id) => {
          const el = $(id);
          if (!el) return;
          el.textContent = line;
          // NOTE: rebuild only the color/hidden classes here — do NOT overwrite
          // className wholesale. game.js's renderUI() already added the
          // 'trump-stamp-anim' class on this same element (this handler runs
          // right after it, via the wrapped hostProcessTrump), and a full
          // className reset here would wipe that class before the browser
          // ever paints a frame with it, silently killing the animation.
          (typeof COLORS !== 'undefined' ? COLORS : ['red', 'green', 'yellow', 'black']).forEach((c) => el.classList.remove('trump-' + c));
          el.classList.add('trump-banner', 'trump-' + data.color);
          el.classList.remove('hidden');
        });
      }
      return r;
    };
  }
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
        flashGfxBanner('handWinBanner', made ? 'BID MADE' : 'SET', 'hand-win-banner ' + (made ? 'made' : 'set'));
      }
      return r;
    };
  }
  const _sfx = window.playSfx;
  if (typeof _sfx === 'function') {
    window.playSfx = function () {
      const r = _sfx.apply(this, arguments);
      if (gfxOn('hapticsHeavy') && navigator.vibrate) {
        try { navigator.vibrate(12); } catch (e) {}
      }
      return r;
    };
  }

  document.addEventListener('click', persistPlayer, true);

  document.addEventListener('DOMContentLoaded', () => {});
  applyPrefsToEngine();
  wireLobby();
  wireExperimentalOptions();
  updateMuteButtons();
  updateNestDestChip();
  refreshLiveRules();

  function formatNightScores() {
    const a = teamLabel(0);
    const b = teamLabel(1);
    const hist = (typeof handHistory !== 'undefined' && Array.isArray(handHistory)) ? handHistory : [];
    const scores = (game && game.scores) ? game.scores : (hist.length ? hist[hist.length - 1].scores : [0, 0]);
    const goal = (game && game.targetScore) || targetScore || 500;
    const when = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
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
        const trump = (typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES[h.trump]) ? COLOR_NAMES[h.trump] : (h.trump || '—');
        lines.push((i + 1) + '. ' + makers + ' bid ' + h.bid + ' ' + verb +
          '  (' + a + ' ' + da + ' / ' + b + ' ' + db + ')' +
          '  trump ' + trump +
          '  → ' + a + ' ' + h.scores[0] + '–' + b + ' ' + h.scores[1]);
      });
    }
    lines.push('');
    const ms = (typeof matchStats !== 'undefined' && matchStats) ? matchStats : {};
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
      setTimeout(() => { btn.textContent = prev; }, 1600);
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

  const origEnsure = window.ensureAudio;
  window.unlockHouseAudio = function () { try { ensureAudio(); } catch (e) {} };
  ['createBtn', 'soloPracticeBtn', 'friendsToggleBtn', 'joinConfirmBtn'].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener('pointerdown', () => { try { ensureAudio(); } catch (e) {} }, { passive: true });
  });

  if (typeof creditCapture === 'function') {
    const _credit = creditCapture;
    creditCapture = function (idx, pts) {
      const r = _credit.apply(this, arguments);
      try {
        if (idx === myIndex && pts > 0) {
          showPlayTip('bank');
          const bank = (typeof bankOfSeat === 'function') ? bankOfSeat(idx) : 0;
          if (bank >= 100) showPlayTip('message');
        }
      } catch (e) {}
      return r;
    };
  }
})();

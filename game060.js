/* Pre-play selection build 2026-09-11 */
// House of Rooks — host-from-phone multiplayer (PeerJS)
// Author: Jerome Griffin
// Copyright (c) 2026 Jerome Griffin / Griffin House

// Bump this alongside the game.js?v= / sw.js CACHE version on every deploy.
// It's exchanged during the join handshake so a stale host or joiner (e.g.
// one still running old cached JS) gets caught and auto-updated instead of
// silently failing or behaving unpredictably against a mismatched peer.
const APP_VERSION = '810';
window.HOR_SCRIPT_BUILD = APP_VERSION;

function horThisIndex() {
  try {
    // Keep meaningful navigation state (especially ?room=XXXX) across a
    // forced refresh. Only the cache-busting parameters are replaced.
    const u = new URL(location.href);
    u.pathname = u.pathname.replace(/[^/]*$/, 'index.html');
    u.searchParams.delete('fresh');
    u.searchParams.delete('v');
    u.hash = '';
    return u.href;
  } catch (e) {
    return 'index.html';
  }
}

/** Numeric compare for APP_VERSION strings, so we can tell which side of a
 * mismatch is actually the stale one instead of assuming it's always the
 * joiner. Non-numeric/garbled versions fall back to 0 (treated as oldest). */
function horVersionNum(v) {
  // Candidate suffixes may contain digits (for example "796").
  // Compare the build number only; a suffix must not turn build 795 into 7952.
  const match = String(v == null ? '' : v).trim().match(/^(?:rook|v|r)?(\d+)/i);
  const n = match ? parseInt(match[1], 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

const COLORS = ['green', 'red', 'yellow', 'black'];
const COLOR_NAMES = { green: 'Green', red: 'Red', yellow: 'Yellow', black: 'Black' };
const RANKS = [5,6,7,8,9,10,11,12,13,14]; // after removing 1-4

const POINT_VALUES = { 5: 5, 10: 10, 14: 10, rook: 20 };


let peer = null;
let connMap = {}; // peerId -> DataConnection (host only)
let hostConnection = null; // for clients: the DataConnection to host
let myPeerId = null;
let isHost = false;
let myName = '';
let roomCode = '';
let players = []; // {id, name, team, isHost}
let myIndex = -1;
let game = null; // full game state (only host mutates)
// Griffin House Rules defaults (other variations available as individual options, off by default)
let includeRed2 = true;
let red2Points = 20;
let includeRed1 = false;
let includeOnes = true;    // 1 of each color (15 pts, high in suit)
let includeRook = true;
let onesHigh = true;       // 1 ranks above 14 in its color
let rookLowest = false;    // Rook is lowest trump instead of highest
/** Rook / Red 1 / Red 2 may be played even when you could follow suit */
let specialsAnytime = false;
/** When void of led color, must play a trump if you have one (off by default) */
let mustTrumpWhenVoid = false;
/** CrowsNest-style: if made, score only the bid amount (not full counters taken) */
let bidOnlyScoring = false;
/** Nest counters go to 'lastTrick' (default partnership) or 'bidder' */
let nestGoesTo = 'lastTrick';
/** Who leads the first trick of play, relative to the bid winner:
 * 'bidder' (default — bid winner leads), 'leftOfBidder', or 'rightOfBidder' */
let leadOrder = 'bidder';
/** Alternate rules seen in other Rook groups online — all off by default:
 * misdeal & redeal if any hand has zero counter cards */
let misdealOnNoCounters = true;
/** Known, opt-in comeback assist. OFF by default. */
let comebackSpecialChance = false;
/** 'Screw the dealer': if everyone passes, the dealer must bid the
 * minimum instead of the hand being redealt */
let screwTheDealer = false;
/** Open widow: reveal the nest to everyone (not just the bidder) the
 * moment it's picked up, before the bidder discards */
let openWidow = false;
/** Face-up top nest card during the auction */
let revealTopNest = true;
/** Test hook: '' | 'rook' | 'red2' — force that card onto the nest reveal */
let forceNestReveal = '';
/** Shoot the Moon: bidding every counter in the deck is an all-or-nothing
 * bid — make it and win the game outright, miss it and go set as usual */
let shootMoonEnabled = true;
/** Bot delay: blitz | normal | slow */
let botSpeed = 'normal';
let horGamePace = (() => { try { const n=Number(localStorage.getItem('horGamePace')); return [1,3,99].includes(n)?n:([2,4].includes(n)?3:1); } catch(e){ return 1; } })();
function horPaintGamePace(){
  document.querySelectorAll('#scoreSpeed701 [data-score-pace]').forEach(b=>{
    const active=Number(b.dataset.scorePace)===horGamePace;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',String(active));
  });
}
function horSetGamePace(v){
  const n=Number(v);
  horGamePace=[1,3,99].includes(n)?n:1;
  try{localStorage.setItem('horGamePace',String(horGamePace));}catch(e){}
  document.body.dataset.gamePace=horGamePace===99?'max':String(horGamePace);
  document.body.style.setProperty('--hor-pace-factor',String(1/(horGamePace===99?20:horGamePace)));
  horPaintGamePace();
  try{if(botTimer && isBotTurn()){clearTimeout(botTimer);botTimer=null;scheduleBot();}}catch(e){}
  return horGamePace;
}
window.__ghSetGamePace630=horSetGamePace;
window.__ghGetGamePace630=()=>horGamePace;
window.__ghSetBotSpeed623 = function(v){
  if (v !== 'blitz' && v !== 'normal' && v !== 'slow') return botSpeed;
  botSpeed = v;
  try {
    const bs = document.getElementById('opt-bot-speed');
    if (bs) bs.value = botSpeed;
    if (typeof broadcastPlaySettings === 'function') broadcastPlaySettings();
  } catch(e) {}
  return botSpeed;
};
window.__ghGetBotSpeed623 = function(){ return botSpeed; };

// Rook593 — diagnostic SOL-seat bot takeover. This is deliberately session-only.
// It reuses the existing bot AI and changes control only at a hand boundary.
let horSolBotRequested = false;
let horSolBotActive = false;
window.HOR_SOL_BOT_ACTIVE = false;
function horSolBotPaint(){
  const b = document.getElementById('btnSolBot');
  if (!b) return;
  if (horSolBotRequested !== horSolBotActive) b.textContent = horSolBotRequested ? 'BOT NEXT HAND' : 'SOL NEXT HAND';
  else b.textContent = horSolBotActive ? 'BOT ACTIVE' : 'SOL SEAT';
  b.dataset.active = horSolBotActive ? '1' : '0';
  b.dataset.pending = horSolBotRequested !== horSolBotActive ? '1' : '0';
  b.setAttribute('aria-pressed', horSolBotRequested ? 'true' : 'false');
}
function horSetSolBotRequested(on){
  if (!isHost || myIndex < 0) return false;
  horSolBotRequested = !!on;
  horSolBotPaint();
  try { if (window.HORSolDiagnostics) window.HORSolDiagnostics.snap('sol-bot-request',{requested:horSolBotRequested,active:horSolBotActive}); } catch(e){}
  return true;
}
function horToggleSolBot(){ return horSetSolBotRequested(!horSolBotRequested); }
function horApplySolBotAtHandBoundary(){
  if (!isHost || myIndex < 0 || !players || !players[myIndex]) return;
  const p = players[myIndex];
  if (horSolBotRequested === horSolBotActive) { horSolBotPaint(); return; }
  horSolBotActive = horSolBotRequested;
  window.HOR_SOL_BOT_ACTIVE = horSolBotActive;
  if (horSolBotActive) {
    p._horSolWasBot = !!p.isBot;
    p._horSolOldBotStyle = p.botStyle || '';
    p.isBot = true;
    p.isDiagnosticSolBot = true;
    p.botStyle = p.botStyle || 'balanced';
  } else {
    p.isBot = !!p._horSolWasBot;
    p.botStyle = p._horSolOldBotStyle || '';
    delete p.isDiagnosticSolBot;
    delete p._horSolWasBot;
    delete p._horSolOldBotStyle;
  }
  try { hideActionPanel(); hideDiscardOverlay(); } catch(e){}
  try { renderUI(); } catch(e){}
  try { if (window.HORSolDiagnostics) window.HORSolDiagnostics.snap('sol-bot-applied',{active:horSolBotActive}); } catch(e){}
  horSolBotPaint();
}
function horSolSeatIsBot(){ return !!horSolBotActive; }
window.horToggleSolBot = horToggleSolBot;
window.horSolBotPaint = horSolBotPaint;
// Rook592 — SOL diagnostic presentation-speed governor.
// This never changes rules/AI/card order; it only scales selected safe waits.
function solSpeedMultiplier(){
  const n = Number(window.HOR_SOL_SPEED || 1);
  return (n === 2 || n === 3 || n === 4) ? n : 1;
}
function solScaledDelay(ms, floorMs){
  const diagnostic = solSpeedMultiplier();
  const production = horGamePace === 99 ? 20 : Math.max(1, Number(horGamePace)||1);
  const speed = Math.max(diagnostic, production);
  if (speed <= 1) return Math.max(0, Math.round(ms));
  const requestedFloor = Math.max(0, Number(floorMs == null ? 90 : floorMs));
  const floor = requestedFloor === 0 ? 0 : (horGamePace === 99 ? Math.min(requestedFloor, 35) : Math.max(45, Math.round(requestedFloor / production)));
  return Math.max(floor, Math.round(Number(ms || 0) / speed));
}
window.horSolDiagnosticState = function(){
  try {
    if (!game) return null;
    return {phase:game.phase,currentPlayer:game.currentPlayer,bidder:game.bidder,currentBid:game.currentBid,trump:game.trump,dealer:game.dealer,scores:Array.isArray(game.scores)?game.scores.slice():null,trickCount:Array.isArray(game.trick)?game.trick.length:null,resolvingTrick:!!game.resolvingTrick};
  } catch (e) { return null; }
};

/** Partner discipline + coach (default ON) */
let partnerNeverKill = true;
let partnerFeedLast = true;
let dontStealPartnerBid = true;
let landscapeBidHints = false;
let nestLastTrickAnim = true;
let layDownWinningCards = true;
let minBid = 100;
let handSize = 10;
let nestSizeDefault = 6;
let turnTimeSec = 0; // 0 = off (default), 15/30/45
/** On timeout: auto | lowest | skipLowest | botHand */
let timeoutPolicy = 'auto';
/** Seats under temp-bot-for-hand after timeout policy botHand */
let timeoutBotUntilHandEnd = {}; // seatIdx -> true
let soundCard = true, soundTurn = localStorage.getItem('rookSoundTurn') !== '0', soundRook = true, soundTick = true;
let horCardStyle = localStorage.getItem('horCardStyle') || 'premium';
document.documentElement.classList.toggle('hor-original-cards', horCardStyle === 'original');
let turnSoundChoice = Math.max(1, Math.min(20, parseInt(localStorage.getItem('rookTurnSoundChoice') || '20', 10) || 20));
let playLockUntil = 0;
let knownVoids = [{}, {}, {}, {}]; // extreme bot: playerIdx -> {color: true}
let matchStats = { hands: 0, highBid: 0, setsA: 0, setsB: 0, madeA: 0, madeB: 0, bidSum: 0, bidCount: 0 };
// Per-seat stats for the current match — tracked for every seat, human or bot,
// so the stats page can show a real breakdown instead of just team totals.
function freshPlayerStat() {
  return {
    hands: 0, bidsWon: 0, highBid: 0, bidSum: 0, bidsMade: 0, bidsSet: 0,
    points: 0, tricksWon: 0, trickPtsSum: 0,
    rookCaptures: 0, red2Captures: 0, bigTricks: 0,
    nestWins: 0, nestPts: 0, moonAttempts: 0, moonMade: 0, bags: 0,
    gamesPlayed: 0, gamesWon: 0,
  };
}
let playerStats = [freshPlayerStat(), freshPlayerStat(), freshPlayerStat(), freshPlayerStat()];
function resetPlayerStats() { playerStats = [freshPlayerStat(), freshPlayerStat(), freshPlayerStat(), freshPlayerStat()]; }
function ps(idx) {
  if (idx == null || idx < 0 || idx > 3) return freshPlayerStat();
  if (!playerStats[idx]) playerStats[idx] = freshPlayerStat();
  return playerStats[idx];
}
// Legacy statistics remain preserved; the display reads canonical careers after migration.
function lifetimeStatsKey() { return 'rookLifetimeStats'; }
function loadLifetimeStats() {
  try {const s=window.HORProgression?.core?.read();if(s){const rows={};for(const r of Object.values(s.records)){const key=Object.hasOwn(rows,r.displayName)?r.displayName+(r.isBot?' (bot)':' (you)'):r.displayName;rows[key]={...r.stats,isBot:r.isBot,avatar:r.avatar};}return rows;}}catch(e){console.error('[Career display]',e.message);}
  try { return JSON.parse(localStorage.getItem(lifetimeStatsKey())) || {}; } catch (e) { return {}; }
}
function saveLifetimeStats(obj) {
  try { localStorage.setItem(lifetimeStatsKey(), JSON.stringify(obj)); } catch (e) {}
}
function horCareerModeOn(){try{return !!(window.HORProgression&&HORProgression.localCareer&&HORProgression.localCareer.mode&&HORProgression.localCareer.mode()==='local');}catch(e){return false;}}
function horMyCareerProfile(){try{return horCareerModeOn()&&HORProgression.localCareer.publicProfile?HORProgression.localCareer.publicProfile():null;}catch(e){return null;}}
function horCareerProfileForPlayer(p){
  if(!p)return null;

  // Remote/shared profile wins when it is already attached to this replicated player.
  if(p.careerPublic&&p.careerPublic.enabled)return p.careerPublic;

  // Local human: do not depend on whichever players/game.players snapshot happens to
  // be current. Resolve directly from the Career service at render time.
  if(!p.isBot){
    const isLocal=(p.id&&myPeerId&&p.id===myPeerId)
      || (Number.isInteger(myIndex) && game && Array.isArray(game.players) && game.players[myIndex]===p)
      || (Number.isInteger(myIndex) && Array.isArray(players) && players[myIndex]===p);
    if(isLocal){
      const mine=horMyCareerProfile();
      if(mine&&mine.enabled){
        p.careerPublic=mine;
        return mine;
      }
    }
    return null;
  }

  // Bots are owned by the local/host Career ledger. Resolve directly instead of
  // requiring careerPublic to survive every network/state clone.
  if(horCareerModeOn()){
    try{
      if(window.HORProgression&&HORProgression.localCareer&&HORProgression.localCareer.botPublicProfile){
        const bp=HORProgression.localCareer.botPublicProfile(p.name);
        if(bp&&bp.enabled){
          p.careerPublic=bp;
          return bp;
        }
      }
    }catch(e){console.error('[Career bot profile]',e);}
  }
  return null;
}

function horShowCareerForPlayer(p){
  const prof=horCareerProfileForPlayer(p);
  if(prof&&window.HORProgression&&HORProgression.localCareer&&HORProgression.localCareer.showCareerCard){
    const view=Object.assign({},prof);
    try{
      if(p&&p.isBot){
        const bp=personaByName(p.name);
        view.personaTitle=bp ? ((typeof STYLE_TITLES!=='undefined'&&STYLE_TITLES[bp.style])||bp.style||'House Player') : 'House Player';
        view.personaHabit=bp ? ((typeof STYLE_HABIT!=='undefined'&&STYLE_HABIT[bp.style])||bp.blurb||'') : '';
        view.personaHow=bp ? (STYLE_HOWTO[bp.style]||bp.blurb||'') : '';
      }else if(p){
        const hp=humanPersonaCard(p.name);
        view.personaTitle=hp.title||'House Player';
        view.personaHabit=hp.habit||'';
        view.personaHow=hp.how||hp.blurb||'';
      }
    }catch(e){}
    HORProgression.localCareer.showCareerCard(view);
    return true;
  }
  return false;
}

function horCareerBadgeHtml(p){
  const prof=horCareerProfileForPlayer(p);
  if(!prof||!prof.enabled){
    try{
      if(horCareerModeOn())console.warn('[Career badge missing profile]',{
        name:p&&p.name,id:p&&p.id,isBot:!!(p&&p.isBot),myPeerId,myIndex,
        hasCareerPublic:!!(p&&p.careerPublic),
        localCareerReady:!!(window.HORProgression&&HORProgression.localCareer)
      });
    }catch(e){}
    // Career mode is ON, so keep the public level chip present while the
    // ledger/profile is still hydrating. A brand-new Career is Level 1.
    if(horCareerModeOn()){
      const isLocalHuman=!!(p&&!p.isBot&&p.id&&myPeerId&&p.id===myPeerId);
      if(p&&p.isBot || isLocalHuman){
        const who=escapeHtmlSafe((p&&p.id)||('bot-'+String((p&&p.name)||'bot')));
        return ` <span class="hor-career-badge hor-career-badge-pending" role="button" tabindex="0" data-career-peer="${who}" data-career-name="${escapeHtmlSafe((p&&p.name)||'')}" title="Career loading" aria-label="Career loading">★…</span>`;
      }
    }
    return '';
  }
  const level=Math.max(1,Number(prof.level)||1);
  const who=escapeHtmlSafe(p.id||('bot-'+String(p.name||'bot')));
  return ` <span class="hor-career-badge" role="button" tabindex="0" data-career-peer="${who}" data-career-name="${escapeHtmlSafe(p.name||'')}" title="View Career: Level ${level}" aria-label="Career level ${level}">★${level}</span>`;
}


/* Rook479: progression.js loads after game.js. Rehydrate Careers when progression is actually ready. */
window.addEventListener('hor-career-ready', function(){
  try{
    const mine=horMyCareerProfile();
    [players,(game&&game.players)].forEach(pool=>{
      if(!Array.isArray(pool))return;
      pool.forEach(pl=>{
        if(!pl)return;
        if(!pl.isBot&&pl.id===myPeerId&&mine&&mine.enabled)pl.careerPublic=mine;
        if(pl.isBot&&horCareerModeOn()&&window.HORProgression&&HORProgression.localCareer&&HORProgression.localCareer.botPublicProfile){
          const bp=HORProgression.localCareer.botPublicProfile(pl.name);
          if(bp&&bp.enabled)pl.careerPublic=bp;
        }
      });
    });
    horRefreshBotCareerProfiles();
    if(typeof renderUI==='function')renderUI();
  }catch(e){console.error('[Career ready]',e);}
});

function horResolveCareerPlayer(id,name){
  const pools=[];
  if(game&&Array.isArray(game.players))pools.push(game.players);
  if(Array.isArray(players))pools.push(players);
  for(const pool of pools){
    let pl=pool.find(x=>x&&id&&x.id===id);
    if(pl)return pl;
  }
  for(const pool of pools){
    let pl=pool.find(x=>x&&name&&String(x.name||'')===String(name));
    if(pl)return pl;
  }
  if(id&&myPeerId&&id===myPeerId)return {id:myPeerId,name:myName||name||'You',isBot:false,careerPublic:horMyCareerProfile()};
  return null;
}
function horBindCareerBadges(root){try{(root||document).querySelectorAll('.hor-career-badge').forEach(b=>{if(b.__horCareerBound)return;b.__horCareerBound=true;const open=e=>{e.preventDefault();e.stopPropagation();const id=b.getAttribute('data-career-peer')||'';const name=b.getAttribute('data-career-name')||'';const pl=horResolveCareerPlayer(id,name);if(pl){horShowCareerForPlayer(pl);return;}const mine=horMyCareerProfile();if(mine&&mine.enabled&&((id&&id===myPeerId)||(name&&name===myName)))HORProgression.localCareer.showCareerCard(mine);};b.addEventListener('pointerdown',e=>{e.stopPropagation();});b.addEventListener('touchstart',e=>{e.stopPropagation();},{passive:true});b.addEventListener('click',open);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ' )open(e);});});}catch(e){console.error('[Career badge bind]',e);}}
function horShowMyCareer(){
  try{
    const prof=horMyCareerProfile();
    if(prof&&prof.enabled&&window.HORProgression&&HORProgression.localCareer&&HORProgression.localCareer.showCareerCard){HORProgression.localCareer.showCareerCard(prof);return true;}
    if(window.HORHouseMenu805?.openCareer){HORHouseMenu805.openCareer();return false;}
    if(window.HORHouseMenu805?.ownerToolsAvailable()&&window.HORProgression&&HORProgression.localCareer?.showActivationPanel){HORProgression.localCareer.showActivationPanel();return false;}
  }catch(e){console.error('[My Career]',e);}
  return false;
}
window.horShowMyCareer=horShowMyCareer;
function horWireMyCareerButtons(){document.querySelectorAll('[data-hor-my-career]').forEach(btn=>{if(btn.__horCareerOwnBound)return;btn.__horCareerOwnBound=true;btn.addEventListener('click',e=>{e.preventDefault();horShowMyCareer();});});}
document.addEventListener('DOMContentLoaded',horWireMyCareerButtons);
window.addEventListener('hor-career-ready',horWireMyCareerButtons);
function horBroadcastCareerProfile(){const profile=horMyCareerProfile();if(isHost){const me=(players||[]).find(p=>p&&!p.isBot&&p.id===myPeerId);if(me)me.careerPublic=profile;broadcast({type:'careerProfile',id:myPeerId,profile});}else if(hostConnection&&hostConnection.open){hostConnection.send({type:'careerProfile',id:myPeerId,profile});}}
function horCareerAnnouncement(ev){/* Remote awards remain stored by their owner; never produce local pop-ups. */}
window.horCareerLocalAnnouncement=function(ev){try{if(!horCareerModeOn()||!ev)return;if(isHost)broadcast({type:'careerAnnouncement',from:myPeerId,event:ev});else if(hostConnection&&hostConnection.open)hostConnection.send({type:'careerAnnouncement',from:myPeerId,event:ev});}catch(e){}};
window.horCareerModeChanged=function(){try{horRefreshBotCareerProfiles();horBroadcastCareerProfile();renderUI();}catch(e){}};
function horRefreshBotCareerProfiles(){
  try{
    if(!isHost||!horCareerModeOn()||!window.HORProgression||!HORProgression.localCareer||!HORProgression.localCareer.botPublicProfile)return;
    (players||[]).forEach(function(p){
      if(p&&p.isBot)p.careerPublic=HORProgression.localCareer.botPublicProfile(p.name);
    });
    if(game&&Array.isArray(game.players))game.players.forEach(function(p){
      if(p&&p.isBot)p.careerPublic=HORProgression.localCareer.botPublicProfile(p.name);
    });
  }catch(e){}
}

function horRecordCareerHand(event){
  if(window.HOR_SOL_BOT_ACTIVE||isSpectator||!window.HORProgression?.core)return;
  try{
    let result;
    // Replay missed completed hands after reconnect, mid-match activation, or a failed save.
    const history=(handHistory||[]).map(h=>h.careerEvent).filter(e=>e&&e.matchId===event.matchId&&e.hand<=event.hand);
    if(!history.some(e=>e.hand===event.hand))history.push(event);
    for(const e of history.sort((a,b)=>a.hand-b.hand))result=HORProgression.core.recordHand({...e,localPeerId:myPeerId,isHost:!!isHost});
    window.__horCareerSaveError=null;horBroadcastCareerProfile();return result;
  }catch(e){window.__horCareerSaveError=e.message;console.error('[Career save]',e.message);const el=document.getElementById('messageArea');if(el)el.textContent='Career save needs attention: '+e.message;return {ok:false,error:e.message};}
}

function mergeLifetimeStats(winnerLabel) {
  if (window.HORProgression?.core && (horCareerModeOn()||HORProgression.core.read())) return; // already committed once per hand
  if (window.HOR_SOL_BOT_ACTIVE) return; // diagnostic bot matches never touch persistent careers/stats
  try {
    const store = loadLifetimeStats();
    for (let i = 0; i < 4; i++) {
      const p = players[i];
      if (!p || !p.name) continue;
      // Career ownership: each device records only its own human. The host also owns official bot careers.
      if (!p.isBot && p.id !== myPeerId) continue;
      if (p.isBot && !isHost) continue;
      const cur = store[p.name] || freshPlayerStat();
      const add = ps(i);
      Object.keys(add).forEach((k) => {
        if (k === 'highBid') cur.highBid = Math.max(cur.highBid || 0, add.highBid || 0);
        else if (k !== 'gamesPlayed' && k !== 'gamesWon') cur[k] = (cur[k] || 0) + (add[k] || 0);
      });
      cur.isBot = !!p.isBot;
      cur.avatar = p.avatar || cur.avatar || null;
      cur.botStyle = p.botStyle || cur.botStyle || null;
      cur.gamesPlayed = (cur.gamesPlayed || 0) + 1;
      const won = (winnerLabel === 'Team A' && p.team === 0) || (winnerLabel === 'Team B' && p.team === 1);
      cur.gamesWon = (cur.gamesWon || 0) + (won ? 1 : 0);
      store[p.name] = cur;
    }
    saveLifetimeStats(store);
    // RookGame454: local progression mirrors the authoritative lifetime totals.
    // Preview mode is inert; local mode updates human + official bot careers and celebrations.
    try {
      if (window.HORProgression && HORProgression.localCareer) {
        const owned={};for(const [nm,rec] of Object.entries(store)){if(rec&&rec.isBot){if(isHost)owned[nm]=rec;}else if((players||[]).some(p=>p&&!p.isBot&&p.id===myPeerId&&p.name===nm))owned[nm]=rec;}
        const syncResult=HORProgression.localCareer.syncFromLifetime(owned, { celebrate: true });
        HORProgression.localCareer.recordRelationships(players, winnerLabel);
        try { horBroadcastCareerProfile(); } catch (e) {}

      }
    } catch (e) {}
  } catch (e) {}
}

/* Rook491: local Career/Stats only. Remove obsolete remote-stat storage keys from older builds. */
// Historical identity/storage keys are retained as evidence; local careers do not use remote endpoints.


const HUMAN_STYLE_MIN_HANDS = 12;
function playMemoryKey() { return 'horPlayMemory'; }
function loadPlayMemoryStore() {
  try { return JSON.parse(localStorage.getItem(playMemoryKey()) || '{}') || {}; } catch (e) { return {}; }
}
function savePlayMemoryStore(obj) {
  try { localStorage.setItem(playMemoryKey(), JSON.stringify(obj)); } catch (e) {}
}
function playMemoryNameKey(name) {
  return String(name || '').trim().toLowerCase() || '__device__';
}
function blankPlayMemory(name) {
  return {
    name: name || 'You',
    hands: 0, bids: 0, passes: 0, wonBids: 0, made: 0, sets: 0,
    highBids: 0, thinBids: 0, moons: 0, points: 0,
    style: 'newPlayer', updatedAt: Date.now()
  };
}
function getPlayMemory(name) {
  const store = loadPlayMemoryStore();
  const k = playMemoryNameKey(name);
  return store[k] || blankPlayMemory(name);
}
function putPlayMemory(name, mem) {
  const store = loadPlayMemoryStore();
  const k = playMemoryNameKey(name);
  mem = mem || blankPlayMemory(name);
  mem.updatedAt = Date.now();
  store[k] = mem;
  savePlayMemoryStore(store);
  return mem;
}
function inferHumanStyle(mem) {
  const hands = mem.hands || 0;
  if (hands < HUMAN_STYLE_MIN_HANDS) {
    return { style: 'housePlayer', title: 'House Player', habit: 'House Player', how: 'Griffin House player.' };
  }
  const bidRate = (mem.bids || 0) / hands;
  const passRate = (mem.passes || 0) / hands;
  const moonRate = (mem.moons || 0) / hands;
  const thinRate = (mem.thinBids || 0) / Math.max(1, mem.wonBids || 0);
  const highRate = (mem.highBids || 0) / Math.max(1, mem.wonBids || 0);
  const setRate = (mem.sets || 0) / Math.max(1, mem.wonBids || 0);
  let style = 'scoreHawk';
  if (moonRate >= 0.12) style = 'moonDreamer';
  else if (thinRate >= 0.45 && (mem.wonBids || 0) >= 3) style = 'widowFiend';
  else if (highRate >= 0.4) style = 'aggressive';
  else if (setRate >= 0.45 && (mem.wonBids || 0) >= 3) style = 'setDog';
  else if (passRate >= 0.55 && bidRate <= 0.35) style = 'safe';
  else if (bidRate >= 0.7) style = 'bidHappy';
  else if ((mem.made || 0) > (mem.sets || 0) * 1.4) style = 'partnerFirst';
  const title = (style === 'housePlayer') ? 'House Player' : ((typeof STYLE_TITLES !== 'undefined' && STYLE_TITLES[style]) || style);
  const habit = (typeof STYLE_HABIT !== 'undefined' && STYLE_HABIT[style]) || title;
  const how = (typeof STYLE_HOWTO !== 'undefined' && STYLE_HOWTO[style]) || ('Read from ' + hands + ' hands on this device.');
  return { style, title, habit, how };
}
function refreshHumanPersona(p) {
  if (!p || p.isBot) return p;
  const mem = getPlayMemory(p.name);
  const inf = inferHumanStyle(mem);
  p.humanHands = mem.hands || 0;
  p.humanStyle = inf.style;
  p.humanHabit = inf.habit;
  p.humanHow = inf.how;
  p.humanTitle = inf.title;
  return p;
}
function noteHumanAuction(idx, kind, value) {
  try {
    const p = players[idx];
    if (!p || p.isBot) return;
    const mem = getPlayMemory(p.name);
    if (kind === 'pass') mem.passes = (mem.passes || 0) + 1;
    if (kind === 'bid') {
      mem.bids = (mem.bids || 0) + 1;
      if (value && value >= 130) mem.highBids = (mem.highBids || 0) + 1;
      if (value && value <= 110) mem.thinBids = (mem.thinBids || 0) + 1;
      if (value && typeof maxBid === 'function' && value >= maxBid()) mem.moons = (mem.moons || 0) + 1;
    }
    putPlayMemory(p.name, mem);
    refreshHumanPersona(p);
  } catch (e) {}
}
function noteHumanHandEnd() {
  if (window.HOR_SOL_BOT_ACTIVE) return; // diagnostic bot matches never touch human play memory
  try {
    for (let i = 0; i < 4; i++) {
      const p = players[i];
      if (!p || p.isBot) continue;
      const mem = getPlayMemory(p.name);
      mem.hands = (mem.hands || 0) + 1;
      if (game && game.bidder === i) {
        mem.wonBids = (mem.wonBids || 0) + 1;
        const made = !!(game && game.lastMade);
        // lastMade may not exist; infer from summary later if needed
      }
      putPlayMemory(p.name, mem);
      refreshHumanPersona(p);
    }
  } catch (e) {}
}
function humanPersonaCard(name) {
  const p = (players || []).find(x => x && !x.isBot && x.name === name);
  const mem = getPlayMemory(name);
  const inf = inferHumanStyle(mem);
  return {
    name: name,
    style: inf.style,
    blurb: inf.how,
    habit: inf.habit,
    title: inf.title,
    hands: mem.hands || 0,
    isHuman: true
  };
}

const AVATARS = [
  'rookling','fox','badger','owl','cardshark','greenie','bluejay','grumpy','goldfinch',
  'jackal','wolf','raven','lynx','cobra','stag',
  'quill','bramble','moss','emberlyn','cinder','gable','thistle','marrow','pebble',
  'rookery','sable','finch','dagger','willow','hearth','grit','copper','moth','brandy',
  'flint','ivy','shade','barrel','spark','nettle','cobalt','ash','harrier',
  'crow','blaze','nix','titan','pike','drift','dice','anchor','wager','hollow',
  'ember','vex','frost','fang','halo','jerome','jerome_founder',...Object.keys(window.HORHumanAvatars||{})
];
const AVATAR_LABELS = {
  ...Object.fromEntries(Object.entries(window.HORHumanAvatars||{}).map(([id,c])=>[id,c.name])),
  jerome_founder:'Jerome', jerome:'Jerome', rookling:'Rookling', fox:'Fox', badger:'Badger', owl:'Owl', cardshark:'Card Shark',
  greenie:'Greenie', bluejay:'Bluejay', grumpy:'Grumpy', goldfinch:'Goldfinch',
  jackal:'Jackal', wolf:'Wolf', raven:'Raven', lynx:'Lynx', cobra:'Cobra', stag:'Stag',
  quill:'Quill', bramble:'Bramble', moss:'Moss', emberlyn:'Emberlyn', cinder:'Cinder',
  gable:'Gable', thistle:'Thistle', marrow:'Marrow', pebble:'Pebble', rookery:'Rookery',
  sable:'Sable', finch:'Finch', dagger:'Dagger', willow:'Willow', hearth:'Hearth',
  grit:'Grit', copper:'Copper', moth:'Moth', brandy:'Brandy', flint:'Flint', ivy:'Ivy',
  shade:'Shade', barrel:'Barrel', spark:'Spark', nettle:'Nettle', cobalt:'Cobalt',
  ash:'Ash', harrier:'Harrier',
  crow:'Crow', blaze:'Blaze', nix:'Nix', titan:'Titan', pike:'Pike', drift:'Drift',
  dice:'Dice', anchor:'Anchor', wager:'Wager', hollow:'Hollow', ember:'Ember',
  vex:'Vex', frost:'Frost', fang:'Fang', halo:'Halo'
};
/* Production cinematic portraits shipped as avatar-<id>.png. Legacy player
 * picker animals stay on SVG. Unknown ids fall back to rookling.svg. */
const AVATAR_PNG_IDS = {
  grit:1, nix:1, copper:1, crow:1, blaze:1, titan:1, pike:1, drift:1, dice:1,
  anchor:1, wager:1, hollow:1, ember:1, vex:1, frost:1, fang:1, halo:1,
  quill:1, bramble:1, moss:1, emberlyn:1, cinder:1, gable:1, thistle:1, marrow:1,
  pebble:1, rookery:1, sable:1, finch:1, dagger:1, willow:1, hearth:1, moth:1,
  brandy:1, flint:1, ivy:1, shade:1, barrel:1, spark:1, nettle:1, cobalt:1,
  ash:1, harrier:1
};
function avatarKey(id) {
  return String(id == null ? '' : id).toLowerCase().replace(/[^a-z0-9_]/g, '');
}
function avatarSrc(id) {
  const key = avatarKey(id);
  if (window.HORHumanAvatars?.[key]) return 'assets/characters077/human/'+key+'-portrait.webp';
  if (key === 'jerome_founder') return 'assets/characters077/jerome_founder-portrait.webp';
  if (key === 'jerome') return 'assets/images/avatar-jerome.png';
  if (key && AVATAR_PNG_IDS[key]) return 'assets/images/avatar-' + key + '.webp';
  if (AVATARS.includes(key)) return 'assets/images/avatar-' + key + '.svg';
  return 'assets/images/avatar-' + AVATARS[0] + '.svg';
}
function avatarHTML(id) { return `<img class="seat-avatar-img" src="${avatarSrc(id)}" alt="${AVATAR_LABELS[id] || 'Avatar'}">`; }
let playerAvatars = {}; // peerId -> avatar id
const PLAYER_AVATAR_KEY = 'griffinHousePlayerAvatar';
function humanAvatarAllowed783(id) { return !!window.HORHumanAvatars?.[id] || id==='jerome_founder'; }
function loadPreferredAvatar() {
  try {
    const id = avatarKey(localStorage.getItem(PLAYER_AVATAR_KEY) || '');
    return humanAvatarAllowed783(id) ? id : '';
  } catch (e) { return ''; }
}
function savePreferredAvatar(id) {
  const key = avatarKey(id);
  if (!humanAvatarAllowed783(key)) return;
  try { localStorage.setItem(PLAYER_AVATAR_KEY, key); } catch (e) {}
}
// Rook549: first-time humans get a random persistent avatar instead of AVATARS[0].
// Existing/manual selections are never overwritten. Bots keep their existing assignment path.
function validHumanVoice(value) {return ['avatar','male','female','silent'].includes(value)?value:'avatar';}
function loadPreferredVoice() {try{if(window.HORFounderDev?.enabled&&localStorage.getItem(PLAYER_AVATAR_KEY)==='jerome_founder')return localStorage.getItem('horFounderVoiceV1')==='silent'?'silent':'male';const v=localStorage.getItem('griffinHousePlayerVoice');return ['male','female','silent'].includes(v)?v:'avatar';}catch(_){return 'silent';}}
function savePreferredVoice(value) {try{if(window.HORFounderDev?.enabled&&localStorage.getItem(PLAYER_AVATAR_KEY)==='jerome_founder'){localStorage.setItem('horFounderVoiceV1',value==='silent'?'silent':'male');return;}localStorage.setItem('griffinHousePlayerVoice',validHumanVoice(value));}catch(_){}}
function ensurePreferredAvatar() {
  const existing = loadPreferredAvatar();
  if (existing) return existing;
  let pool = AVATARS.filter(id=>id!=='jerome_founder');
  try { const humans=Object.keys(window.HORHumanAvatars||{}).filter(id=>AVATARS.includes(id)); if(humans.length)pool=humans; } catch(_) {}
  if (!pool.length) return '';
  let idx = 0;
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    idx = a[0] % pool.length;
  } catch (e) {
    idx = Math.floor(Math.random() * pool.length);
  }
  const chosen = pool[idx] || pool[0];
  // Preserve the prior legacy/bot preference for rollback; only human appearances are selectable now.
  try { const old=localStorage.getItem(PLAYER_AVATAR_KEY);if(old&&!humanAvatarAllowed783(old)&&!localStorage.getItem('horLegacyAvatarBefore783'))localStorage.setItem('horLegacyAvatarBefore783',old); } catch(_) {}
  savePreferredAvatar(chosen);
  return chosen;
}
function applyPreferredAvatarToMe() {
  const id = ensurePreferredAvatar();
  if (!id) return '';
  if (myPeerId) playerAvatars[myPeerId] = id;
  const me = (players || []).find(p => p && p.id === myPeerId);
  if (me) { me.avatar = id; if(id==='jerome_founder')me.name='Jerome'; }
  if(id==='jerome_founder') { myName='Jerome'; window.HORFounderProfile785?.syncName(); }
  return id;
}
let reduceMotion = localStorage.getItem('rookReduceMotion') === '1';
let highContrast = localStorage.getItem('rookHighContrast') === '1';

const DISCONNECT_GRACE_MS = 30000;
let turnTimer = null;
let turnTimerEndsAt = 0;
let turnTimerInterval = null;
let disconnectTimers = {}; // peerId -> timeout id


let lastTrickLen = 0;
/** Last finished trick for landscape theater: [{player, card}, ...] */
let lastCompletedTrick = null;
let lastCompletedTrickWinner = null;
/** Last up to 5 finished tricks this hand: {plays, winner, ledColor, trump} */
let recentTricks = [];
/** All finished tricks this match (for end-game highlight reel) */
let matchTricks = [];
let celeTimers = [];
let pendingCele = null;
let landscapeLastSummary = null;
let lastTurnIndex = -1;
let soundMuted = localStorage.getItem('rookMuted') === '1';
try {
  window.horAvatarMotion = localStorage.getItem('horAvatarMotion') !== '0';
  window.horTvDisplay = localStorage.getItem('horTvDisplay') === '1';
  window.horHostKickMute = localStorage.getItem('horHostKickMute') === '1';
  document.body.classList.toggle('no-avatar-motion', window.horAvatarMotion === false);
  document.body.classList.toggle('hor-tv-display', !!window.horTvDisplay);
} catch (e) {}
let targetScore = 500;

/**
 * A match ends only when a team reaches the positive target or the opposing
 * team reaches the matching negative target. For example, a 500-point match
 * may be won at +500 or lost at -500; scores between those bounds are still
 * live.
 */
function getMatchResult(scores, goal) {
  const a = Number(scores?.[0] || 0);
  const b = Number(scores?.[1] || 0);
  const g = Number(goal || 500);
  if (!(g > 0)) return null;
  // Positive target takes precedence if both thresholds are crossed in the
  // same hand; otherwise a team loses only at or below -goal.
  if (a >= g || b >= g) {
    if (a >= g && b >= g) return a === b ? 'Tie' : (a > b ? 'Team A' : 'Team B');
    return a >= g ? 'Team A' : 'Team B';
  }
  if (a <= -g || b <= -g) {
    if (a <= -g && b <= -g) return a === b ? 'Tie' : (a > b ? 'Team A' : 'Team B');
    return a <= -g ? 'Team B' : 'Team A';
  }
  return null;
}

function isMatchOver(scores, goal) {
  return !!getMatchResult(scores, goal);
}


// Experimental polish features are deliberately OFF by default. They can be
// enabled one at a time from the Experimental Polish tab in Game Options.
const HOR_NET_ALWAYS_ON = {
  netSequencing: true, netReconnect: true, netBackoff: true,
  netHeartbeat: true, netDelta: true, netAuthoritative: true, netTimerSync: true,
  netDuplicateGuard: true, netTurnGuard: true, netConnectionUI: true,
  netTurnHandoff: true, netOwnTurnRecovery: true, netDiagnostics: true,
  netGraceRecovery: true, netSameIdResync: true, netNameReclaim: true,
  netActionQueue: true, netIceWatch: true, netResyncOnReclaim: true,
  netHoldTimerOnDisconnect: true, netSilentDropDetect: true,
  lobbyReconnect: true
};
const HOR_FEATURE_ALWAYS_ON = {
  customTurnServers: true,
  thinkingPulse: true,
  spectatorLateJoin: true,
  partnerChatAfterNest: true,
  waitForMe: true,
  hostHonorHands: true,
  avatarPersonality: true,
  renderOptimization: true
};
const HOR_EXP_DEFAULTS = Object.assign({
  tableAtmosphere: false, rookAnimation: false,
  cardJuice: false, avatarPersonality: true, statusIndicators: false,
  matchProgress: false, cacheRefresh: false,
  friendlyErrors: false, renderOptimization: true, debugPanel: false
}, HOR_NET_ALWAYS_ON, HOR_FEATURE_ALWAYS_ON);
function horExpOn(id) {
  try {
    if (HOR_NET_ALWAYS_ON[id] || HOR_FEATURE_ALWAYS_ON[id]) return true;
    return !!(window.horExperimental && window.horExperimental[id]);
  } catch (e) { return !!(HOR_NET_ALWAYS_ON[id] || HOR_FEATURE_ALWAYS_ON[id]); }
}
window.horExpOn = horExpOn;
window.horExperimental = Object.assign({}, HOR_EXP_DEFAULTS);
let horNetSeq = 0;           // host-assigned state sequence
let horLastAppliedSeq = 0;   // last public state seq applied on this client
let horOutbox = [];          // client actions waiting for an open host connection
let horPeerLastSeen = {};    // peerId -> timestamp (host)
let joinInProgress = false;
let horLastHostSeenAt = 0;
let horHeartbeatTimer = null;
let horReconnectTimer = null;
let horReconnectAttempt = 0;
let horReconnectActive = false;
let horLastPingMs = 0;
let horPingSentAt = 0;
let horJoinConn = null;      // latest in-flight join DataConnection
window.horLastPingMs = 0;

function pickBotTalkLine(kind, seat, ctx) {
  const me = (players[seat] && players[seat].name) || 'Bot';
  const other = (ctx && ctx.name) || 'them';
  const color = (ctx && ctx.color) || 'trump';
  const pts = (ctx && ctx.pts) != null ? ctx.pts : '';
  const pool = {
    trickWin: [
      'That’s ours.',
      'I’ll take that one.',
      pts ? ('Nice pile — ' + pts + ' on the felt.') : 'Counters coming home.',
      'Sit down. That trick is mine.',
      'Trick’s closed. Don’t wait up.',
      'Followed, ruffed, counted. Next.',
      'That’s a book for this side of the table.',
      'Keep tossing. I’ll keep stacking.',
      'Felt’s getting heavy over here.',
      'You led it. I finished it.',
      'Partner, that one’s in the wagon.',
      'Low card, high pile. I like that trade.',
      'Ruff city. Enjoy the view.',
      'Color’s dead. Trump’s alive.',
      'That’s how you sweep a four-card mess.',
      pts ? (pts + ' walking home with me.') : 'Points in the pocket.',
      'Don’t clap. Just deal the next lead.',
      'I had that trick from the second card.',
      'Your 14 looked cute until mine showed up.',
      'Nest can wait. This pile can’t.'
    ],
    trickLose: [
      'Fine. You can have that one.',
      'We’ll get the next stack.',
      'Don’t get comfortable.',
      other + ' got lucky there.',
      'Take the crumbs. Leave the bird.',
      'That trick was skinny anyway.',
      'Go on, count it. Still short.',
      'You won the trick. Not the hand.',
      'I ducked it on purpose. Relax.',
      'Dump and run. Classic.',
      'Keep the 5. I wanted the next lead.',
      other + ' can have the dust.',
      'Not every pile is worth a fight.',
      'Alright. Your book. My memory.',
      'We’ll see who owns the last trick.',
      'Throw me a counter next time. I dare you.',
      'That ruff was loud for so few points.',
      'Enjoy it. Trump’s getting thin over there.',
      'Lost the trick, kept the count cards.',
      'Fine. Lead again. I’m listening.'
    ],
    bid: [
      'I’ll buy this hand.',
      'Raise it. I like these cards.',
      'We’re going to the nest.',
      'Someone has to bid. Might as well be me.',
      'Auction’s open. Let’s play.',
      'I didn’t come here to pass pretty.',
      'Bump it. The nest looks hungry.',
      'This hand has a number on it.',
      'Y’all can fold. I’ll name trump later.',
      'That’s my bid. Write it in ink.',
      'If you’re scared of 120, say so.',
      'Climb with me or get off the ladder.',
      'Nest first, excuses later.',
      'I see trump. I hear a bid.',
      'Don’t make me bid against myself.',
      'Table’s quiet. I’ll make some noise.',
      'Partner, hold on. We’re buying this.',
      'That’s not a bid. That’s a warning.',
      'Raise. I’ve got colors for days.',
      'If the bird’s in the nest, it’s mine anyway.'
    ],
    pass: [
      'Too rich for me.',
      'Y’all can fight over it.',
      'I’m sitting this auction out.',
      'Pass. Let’s see the play.',
      'Not my nest tonight.',
      'Cards are polite. Bid isn’t.',
      'I’ll defend. Somebody else can name it.',
      'Pass. Save the set for them.',
      'Auction’s getting spicy. I’m out.',
      'No thank you. I like my scorecard clean.',
      'That’s a bidder’s problem now.',
      'Fold the auction. Open the felt.',
      'Pass loud so nobody gets ideas.',
      'I came to ruff, not to buy.',
      'Let the hungry seat take it.',
      'My hand said walk. I walked.',
      'I’ll wait for a cheaper bird.',
      'Not climbing that ladder in these shoes.',
      'Pass and pray they name the wrong color.',
      'Somebody else can feed the nest.'
    ],
    trump: [
      color + ' is trump. Let’s go.',
      'I named it. Follow or ruff.',
      'Trump’s on the table. Play honest.',
      'That’s the color. Don’t act surprised.',
      color + ' walks. Everything else crawls.',
      'Trump named. Voids incoming.',
      'I picked ' + color + '. Live with it.',
      'That’s the hammer color.',
      'Follow ' + color + ' or start inventing stories.',
      'Trump’s short at some seats. Not mine.',
      'Name’s on the felt. Color’s locked.',
      color + ' until the nest sings.',
      'I didn’t name trump to be shy about it.',
      'Ruff early, ruff often, ruff ' + color + '.',
      'If you were void, you should’ve bid.',
      'Trump lead incoming. Hide the counters.',
      color + ' is the law of this hand.',
      'Pretty color. Mean rules.',
      'Don’t bury a 14 in ' + color + ' unless you mean it.',
      'Trump’s named. Bird’s nervous.'
    ],
    nest: [
      pts ? ('Nest pays ' + pts + '.') : 'I’ll take the nest too.',
      'Last trick, last pennies.',
      'Those nest counters are mine.',
      'Kitty’s open. Hands off.',
      'Last pile pays the rent.',
      pts ? ('Nest dropped ' + pts + ' in the wagon.') : 'Nest came home with us.',
      'That’s why you save a trump.',
      'Last trick isn’t a suggestion.',
      'Nest thought it was hiding. Cute.',
      'Count the kitty. Then count again.',
      'I didn’t forget the sixth card.',
      'Partnership rule: last trick eats.',
      'That’s the nest tax. Pay it.',
      pts ? ('+' + pts + ' for staying awake.') : 'Stay for the last trick next time.',
      'Bird, two, fives — nest had a party.',
      'You fought all hand and missed the kitty.',
      'Last trick. First thing I planned.',
      'Nest counters don’t walk themselves.',
      'That’s the quiet pile that wins matches.',
      'Thank the nest. Blame the bid.'
    ],
    rook: [
      'Bird’s down. Thank you.',
      'That’s the rook. Count it.',
      'Pretty bird. Ugly for you.',
      'Twenty points with feathers.',
      'The Bird landed on my side of the table.',
      'Rook’s not a pet. It’s a paycheck.',
      'There it is. The whole reason we deal.',
      'Clip the wings. Bank the twenty.',
      'You hid it in a skinny trick. Bold.',
      'Bird called. I answered.',
      'That’s the black-and-white tax.',
      'Rook takes the trick and the argument.',
      'Don’t look at me. Look at the Bird.',
      'Highest trump, loudest silence.',
      'I came for the nest. Stayed for the Rook.',
      'Twenty walks. Pride stays.',
      'You fed the Bird. I carved it.',
      'Rook’s in the book. Hand just got honest.',
      'That’s not a card. That’s a verdict.',
      'Tweet tweet. Count twenty.'
    ],
    red2: [
      'Red two rides with me.',
      'Special’s in the pile.',
      'I’ll take that painted two.',
      'Little red liar. Big points.',
      'Painted two thought it was sneaky.',
      'Red 2’s not low when it pays.',
      'That’s the extra bird without feathers.',
      'You tossed a twenty and called it a two.',
      'House rules: the painted two comes home.',
      'Red 2 in the wagon. Thank the variant.',
      'Specials anytime? Anytime’s now.',
      'Cute rank. Mean value.',
      'I hunt the Bird and its cousin.',
      'That’s a counter wearing work clothes.',
      'Don’t bury the two in a nothing trick.',
      'Painted and counted.',
      'Red 2, meet the scorepad.',
      'Low card, high drama.',
      'I’ll take the art and the points.',
      'Two of red, twenty of trouble.'
    ],
    highPts: [
      pts ? ('Fat trick. ' + pts + ' points.') : 'That one was loaded.',
      'Leave the counters. I’ll carry them.',
      pts ? (pts + ' in one pile. Somebody got sloppy.') : 'That trick had a whole nest in it.',
      'Fives, tens, a 14 — grocery run.',
      'Don’t feed a fat trick unless you own it.',
      'That’s a scorepad event.',
      pts ? ('Count it slow. ' + pts + ' tastes better.') : 'Heavy felt. Light opposition.',
      'You threw count into a woodchipper.',
      'Loaded trick. Unloaded seats.',
      'I like my piles with a little gravy.',
      'That was not a safe dump.',
      pts ? ('+' + pts + '. Bid just got easier.') : 'Counters migrating my direction.',
      'Who puts that much meat on one trick?',
      'Thank you for the 10. And the other 10.',
      'Fat pile. Thin excuses.',
      'That’s how hands get made in one book.',
      'Keep the small cards. Send the points.',
      'I heard the scoreboard flinch.',
      pts ? ('Write ' + pts + ' before you forget.') : 'That trick paid like a nest.',
      'Point hunt complete. For now.'
    ],
    made: [
      'Bid’s good. Pay up.',
      'Told you we had it.',
      'Hand made. Next deal.',
      'Contract filled. Nest included.',
      'That’s how you buy a hand and keep it.',
      'Set? No. Made. Sit down.',
      'Partner played it straight. Bid survived.',
      'Count it. Then add the nest.',
      'We named trump and meant it.',
      'Auction talked. Play walked.',
      'Not even close to a set.',
      'Write it on the pad in ink.',
      'Makers eat. Defenders take notes.',
      'That’s a clean make. Deal again.',
      'Bird, counters, last trick — all home.',
      'You can stop watching the bid now.',
      'We had the color. You had hope.',
      'Made it the ugly way. Still made it.',
      'Scoreboard likes this side tonight.',
      'Bid stood up. Next victim.'
    ],
    set: [
      'That’s a set. Rough night.',
      'Bid went down. Happens.',
      'They didn’t have it.',
      'Auction got brave. Play got honest.',
      'Set like a folding chair.',
      'Should’ve passed at that number.',
      'Nest couldn’t save that bid.',
      'Trump ran out two tricks early.',
      'That’s a hole in the scorepad.',
      'Makers met a void they didn’t plan.',
      'Bird hid. Bid didn’t.',
      'Defense ate well tonight.',
      'Too much bid, not enough color.',
      'They bought the nest and still starved.',
      'Set. Deal the medicine.',
      'That’s what overconfidence names trump.',
      'Count short. Pride long.',
      'The pad does not negotiate.',
      'You can hear the bid hitting the floor.',
      'Next time bid the cards, not the vibe.'
    ],
    winningTaunt: [
      'Scoreboard’s ugly for you. Get used to it.',
      'We’re not just winning, we’re renting this table.',
      'Keep dealing. I like these cards.',
      'This isn’t a comeback story. It’s a eulogy.',
      'You’re not losing, you’re spectating.',
      'I’d say good game, but it hasn’t been one — for you.',
      'Enjoy the view from second place.',
      'We’ve lapped you and you’re still counting your cards.',
      'This is what a beatdown looks like in cardboard.',
      'Keep bidding. I love watching you dig.',
      'You brought a nest egg. We brought a shovel.',
      'At this rate the scorepad needs a new page just for us.',
      'Y’all are playing checkers. We’re playing chess with feathers.',
      'I’ve seen closer games at a coronation.',
      'Don’t worry, participation trophies are in the mail.',
      'We’re up so much I forgot what losing feels like.',
      'Keep swinging. It’s cute.',
      'Feel free to concede. I won’t tell anyone.',
      'This lead’s got its own zip code.',
      'You’re chasing ghosts and we’re the ghosts.',
      'Nice try. Try again in another life.',
      'We’re beating you so bad the Bird feels sorry for you.',
      'Scoreboard says story time’s over.',
      'I’d slow down, but why?',
      'This game’s basically over. Somebody tell the nest.',
      'You call that a fight? I call it a warm-up.',
      'We’re up big enough to start tipping the dealer.',
      'Keep chasing. The finish line moved.',
      'Losing gracefully is still losing.',
      'Bid all you want. Math already won.',
      'Take notes. This is how it’s done.',
      'We’re not sweating. You should be.'
    ],
    losingTaunt: [
      'Enjoy the lead. Leases expire.',
      'Big talk for a team that hasn’t won the game yet.',
      'We’re not behind, we’re setting a trap.',
      'This ain’t over till the last nest is counted.',
      'Keep smiling. It’ll make the comeback sweeter.',
      'You’re up now. Ask me again after the next hand.',
      'Scoreboards don’t win games. Bids do.',
      'We’re just getting the boring part out of the way.',
      'Save the victory lap. You’ll need the energy.',
      'This lead’s rented, not owned.',
      'Talk’s cheap. So is your lead, apparently.',
      'We like our comebacks dramatic.',
      'Keep counting. We’re not done dealing.',
      'You peaked early. We peak on time.',
      'This is just the trailer. Wait for the movie.',
      'Ahead now, worried later.',
      'We’ve been down before. Ask the scorepad.',
      'Ninth-inning energy, and we haven’t even started.',
      'Cute lead. Won’t last past the next Bird.',
      'Every big lead has a bigger nest waiting.',
      'You’re loud for a team that hasn’t finished the job.',
      'We’re not panicking. We’re plotting.',
      'The math isn’t done. Neither are we.',
      'Enjoy it now. Regret it at the finish line.',
      'That lead’s got a short memory.',
      'We don’t fold under pressure. Ask us later.',
      'Talk to me after the nest flips.',
      'Comebacks don’t RSVP. They just show up.',
      'You’ll remember this lead. We’ll erase it.',
      'We’re patient. Revenge is a slow-played hand.',
      'Hold that pose. It won’t last.',
      'Big lead, small hand left to prove it.'
    ]
  };
  const lines = pool[kind];
  if (!lines || !lines.length) return '';
  return lines[Math.floor(Math.random() * lines.length)];
}
function botMaybeTableTalk() {}
function botMaybeStandingsTaunt() {}
function seatSlotIdForIndex(idx) {
  const base = (myIndex >= 0) ? myIndex : 0;
  if (idx === base) return 'slot-me';
  if (idx === (base + 1) % 4) return 'slot-left';
  if (idx === (base + 2) % 4) return 'slot-partner';
  if (idx === (base + 3) % 4) return 'slot-right';
  return 'slot-me';
}
function showTableMsgPopup(name, text) {
  if(window.HORRavenFight741?.deferCelebration(()=>showTableMsgPopup(name,text)))return;
  const el = $('tableMsgPopup');
  if (!el) return;
  el.innerHTML = '<div class="table-msg-box"><div class="table-msg-from">' +
    escapeHtmlSafe(name || 'Player') + '</div><div class="table-msg-body">' +
    escapeHtmlSafe(text || '') + '</div>' +
    '<button type="button" class="btn table-msg-close" id="tableMsgClose">Close</button></div>';
  el.classList.remove('hidden', 'fade');
  el.style.pointerEvents = 'auto';
  if (el._t) clearTimeout(el._t);
  if (el._t2) clearTimeout(el._t2);
  el._t = null;
  el._t2 = null;
  const close = () => {
    el.classList.add('hidden');
    el.style.pointerEvents = '';
  };
  const btn = $('tableMsgClose');
  if (btn) btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); close(); };
  el.onclick = (e) => { if (e.target === el) close(); };
}
function normalizeTargetScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(2000, Math.trunc(n))) : 500;
}
function readTargetScoreFromUI() {
  const ts = $('opt-target-score');
  const custom = $('opt-target-score-custom');
  if (!ts) return targetScore || 500;
  if (ts.value === 'custom') {
    const raw = custom ? String(custom.value || '').replace(/[^\d]/g, '') : '';
    let v = parseInt(raw, 10);
    if (!Number.isFinite(v) || v < 1) v = targetScore >= 1 ? targetScore : 500;
    if (v > 2000) v = 2000;
    return v;
  }
  return normalizeTargetScore(ts.value);
}

function setCustomScoreVisible(show) {
  const wrap = $('opt-target-score-custom-wrap');
  const custom = $('opt-target-score-custom');
  if (wrap) wrap.classList.toggle('hidden', !show);
  if (custom) {
    custom.classList.toggle('hidden', !show);
    custom.disabled = !show;
    custom.readOnly = false;
    if (show) {
      custom.removeAttribute('readonly');
      custom.style.pointerEvents = 'auto';
    }
  }
}

function syncTargetScoreUI() {
  const ts = $('opt-target-score');
  const custom = $('opt-target-score-custom');
  if (!ts) return;
  const presets = ['100', '500', '1000'];
  const cur = String(targetScore || 500);
  if (presets.includes(cur)) {
    ts.value = cur;
    setCustomScoreVisible(false);
    if (custom) custom.value = cur;
  } else {
    ts.value = 'custom';
    setCustomScoreVisible(true);
    if (custom) custom.value = cur;
  }
}

function wireTargetScoreUI() {
  const ts = $('opt-target-score');
  const custom = $('opt-target-score-custom');
  if (!ts) return;
  if (ts.dataset.wired === '1') {
    syncTargetScoreUI();
    return;
  }
  ts.dataset.wired = '1';

  const apply = () => {
    targetScore = readTargetScoreFromUI();
    try {
      const td = $('targetDisplay');
      if (td) td.textContent = String(targetScore);
      const hint = $('variantHint');
      if (hint) {
        // light refresh of "to N" in hint if present
        hint.textContent = (hint.textContent || '').replace(/to \d+/, 'to ' + targetScore);
      }
    } catch (e) {}
    try { if (typeof recomputeHandAndNest === 'function') recomputeHandAndNest(); } catch (e) {}
    try { if (typeof broadcastPlaySettings === 'function') broadcastPlaySettings(); } catch (e) {}
  };

  ts.addEventListener('change', () => {
    if (ts.value === 'custom') {
      setCustomScoreVisible(true);
      if (custom) {
        if (!custom.value) custom.value = String(targetScore || 500);
        // Focus after layout so mobile keyboard can open
        setTimeout(() => {
          try {
            custom.focus();
            custom.select();
          } catch (e) {}
        }, 50);
      }
    } else {
      setCustomScoreVisible(false);
    }
    apply();
  });

  if (custom) {
    custom.disabled = false;
    custom.readOnly = false;
    const confirmBtn = $('opt-target-score-custom-confirm');
    const confirmCustomScore = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const v = parseInt(String(custom.value || '').replace(/[^\d]/g, ''), 10);
      if (!Number.isFinite(v) || v < 1) {
        custom.focus();
        custom.select();
        return;
      }
      targetScore = normalizeTargetScore(v);
      custom.value = String(targetScore);
      apply();
      try { custom.blur(); } catch (err) {}
    };
    if (confirmBtn && confirmBtn.dataset.wired !== '1') {
      confirmBtn.dataset.wired = '1';
      confirmBtn.addEventListener('click', confirmCustomScore);
    }
    // Digits only while typing
    custom.addEventListener('input', () => {
      const digits = String(custom.value || '').replace(/[^\d]/g, '').slice(0, 4);
      if (custom.value !== digits) custom.value = digits;
      const v = parseInt(digits, 10);
      if (Number.isFinite(v) && v >= 1) {
        targetScore = normalizeTargetScore(v);
        const td = $('targetDisplay');
        if (td) td.textContent = String(targetScore);
      }
    });
    custom.addEventListener('change', apply);
    custom.addEventListener('blur', apply);
    // Stop modal/sheet handlers from eating keystrokes
    custom.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') confirmCustomScore(e);
    });
    custom.addEventListener('keyup', (e) => { e.stopPropagation(); });
    custom.addEventListener('click', (e) => { e.stopPropagation(); try { custom.focus(); } catch (err) {} });
  }
  syncTargetScoreUI();
}

let botDifficulty = 'extreme';
let handHistory = [];
let handSortMode = (function () {
  try {
    const v = localStorage.getItem('horHandSortMode');
    if (v === 'suit' || v === 'color-high') return 'color-high';
    if (v === 'color-low' || v === 'rank' || v === 'counters') return v;
    if (v === 'points') return 'counters';
  } catch (e) {}
  return 'color-high';
})();
let isSpectator = false;
let isSoloPractice = false;
/** Extra chance (0–50) the solo host is dealt Rook / Red 2 after a fair shuffle */
let luckySpecialsBoost = 0;
let luckySpecialsEnabled = false;
/** 'fixed' | 'spinner' */
let luckySpecialsMode = 'fixed';
let luckySpinning = false;
/** When host is the only human, allow the 🧪 experimental / perfect test deal */
let experimentalHandOpt = false;
const PLAQUE_STYLES = {
  ink: { bg: '#111111', fg: '#ffffff', label: 'Black / white' },
  paper: { bg: '#f5f5f5', fg: '#111111', label: 'White / black' },
  gold: { bg: '#3d2a14', fg: '#ffe9a8', label: 'Oak / gold' },
  forest: { bg: '#0d3b1e', fg: '#e8f5e9', label: 'Forest / mint' },
  wine: { bg: '#4a1020', fg: '#fce4ec', label: 'Wine / rose' },
  navy: { bg: '#0d1b3d', fg: '#e3f2fd', label: 'Navy / ice' },
  rust: { bg: '#5c2e0a', fg: '#fff3e0', label: 'Rust / cream' },
  slate: { bg: '#263238', fg: '#eceff1', label: 'Slate / silver' }
};
let plaqueA = 'wine';
let plaqueB = 'navy';
try {
  plaqueA = normalizePlaque(localStorage.getItem('horPlaqueA'), 'wine');
  plaqueB = normalizePlaque(localStorage.getItem('horPlaqueB'), 'navy');
} catch (e) {}
function normalizePlaque(id, fallback) {
  return PLAQUE_STYLES[id] ? id : fallback;
}
function paintNamePlaque(el, team) {
  if (!el) return;
  const style = PLAQUE_STYLES[team === 1 ? plaqueB : plaqueA] || PLAQUE_STYLES.ink;
  el.setAttribute('data-plaque-team', String(team === 1 ? 1 : 0));
  el.classList.toggle('plaque-team-a', team !== 1);
  el.classList.toggle('plaque-team-b', team === 1);

  // Rook515: team identity stays in game metadata, but the live table no longer
  // paints the old rectangular team plaque behind a portrait/name.
  const liveSeat = !!el.closest('.player-slot');
  if (liveSeat) {
    el.style.setProperty('background', 'transparent', 'important');
    el.style.setProperty('background-color', 'transparent', 'important');
    el.style.setProperty('background-image', 'none', 'important');
    el.style.setProperty('border', '0', 'important');
    el.style.setProperty('outline', '0', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    el.style.setProperty('border-radius', '0', 'important');
    el.style.setProperty('padding', '0.02rem 0.10rem', 'important');
    el.style.removeProperty('color');
    return;
  }
  el.style.setProperty('background', style.bg, 'important');
  el.style.setProperty('color', style.fg, 'important');
  el.style.setProperty('border-radius', '8px', 'important');
  el.style.setProperty('padding', '0.12rem 0.38rem', 'important');
}
function applyPlaqueColors() {
  plaqueA = normalizePlaque(plaqueA, 'wine');
  plaqueB = normalizePlaque(plaqueB, 'navy');
  const a = PLAQUE_STYLES[plaqueA];
  const b = PLAQUE_STYLES[plaqueB];
  const root = document.documentElement;
  if (a) { root.style.setProperty('--plaque-a-bg', a.bg); root.style.setProperty('--plaque-a-fg', a.fg); }
  if (b) { root.style.setProperty('--plaque-b-bg', b.bg); root.style.setProperty('--plaque-b-fg', b.fg); }
  const base = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
  const map = { me: base, left: (base + 1) % 4, partner: (base + 2) % 4, right: (base + 3) % 4 };
  Object.keys(map).forEach((slot) => {
    const seatEl = $('slot-' + slot);
    const idx = map[slot];
    const p = (game && game.players && game.players[idx]) || players[idx];
    const team = (p && typeof p.team === 'number') ? p.team : (idx % 2);
    if (seatEl) seatEl.setAttribute('data-plaque-team', String(team));
    paintNamePlaque(seatEl && seatEl.querySelector('.name'), team);
  });
  for (let s = 0; s < 4; s++) {
    const wait = $('waitSeat' + s);
    if (!wait) continue;
    const p = typeof playerAtSeat === 'function' ? playerAtSeat(s) : players[s];
    const team = (p && typeof p.team === 'number') ? p.team : (s % 2);
    paintNamePlaque(wait.querySelector('.wait-seat-name'), team);
  }
}
window.applyPlaqueColors = applyPlaqueColors;
let whisperTargetIdx = -1;
let beerSeats = [];
let lastPlaySnapshot = null;
let themeIndex = 0;
let ruleVariant = 'griffin';
const THEMES = ['theme-classic', 'theme-felt', 'theme-night'];

const CARD_BACKS = [
  { id: 'griffin', name: 'Griffin Crest', hint: 'House seal' },
  { id: 'classic', name: 'White Bird', hint: 'Ivory rook' },
  { id: 'felt', name: 'Nest Watch', hint: 'Cards in the nest' },
  { id: 'faceoff', name: 'Face Off', hint: 'Black vs red' },
  { id: 'clash', name: 'Beak War', hint: 'Mid-fight' },
  { id: 'aerial', name: 'Air Duel', hint: 'Wings up' },
  { id: 'dive', name: 'Red Dive', hint: 'Stooping strike' },
  { id: 'aftermath', name: 'After the Trick', hint: 'Feathers down' },
];
const CARD_BACK_CLASSES = CARD_BACKS.map(b => 'cardback-' + b.id);
let cardBackId = 'griffin';

/**
 * Griffin House Rules is the single base rule set.
 * Other common variations are exposed as individual options (default off).
 */
function recomputeHandAndNest() {
  // Build deck size from current flags
  let total = COLORS.length * RANKS.length; // 40
  if (includeOnes) total += 4;
  if (includeRed2) total += 1;
  if (includeRed1) total += 1;
  if (includeRook) total += 1;
  // Prefer nest 5–7 depending on extras; hand 9–11
  let nest = 5;
  if (includeOnes || includeRed2 || includeRed1) nest = 6;
  if (includeRed1 && includeRed2) nest = 7;
  if (!includeRook) nest = Math.max(4, nest - 1);
  let hand = Math.floor((total - nest) / 4);
  if (hand < 8) hand = 8;
  if (hand > 11) hand = 11;
  nest = total - hand * 4;
  if (nest < 3) { nest = 3; hand = Math.floor((total - nest) / 4); nest = total - hand * 4; }
  handSize = hand;
  nestSizeDefault = nest;
}

function applyGriffinDefaults({ broadcastChange = false } = {}) {
  ruleVariant = 'griffin';
  includeRook = true;
  includeOnes = true;
  onesHigh = true;
  includeRed1 = false;
  includeRed2 = true;
  rookLowest = false;
  red2Points = 20;
  minBid = 100;
  targetScore = 500;
  specialsAnytime = false;
  mustTrumpWhenVoid = false;
  leadOrder = 'bidder';
  misdealOnNoCounters = true;
  shootMoonEnabled = true;
  recomputeHandAndNest();
  syncOptionsUI();
  if (broadcastChange && isHost) {
    try { broadcastPlaySettings(); } catch (e) {}
  }
}

function syncOptionsUI() {
  try { syncFavoritePartner042(); } catch (_) {}
  const saEl = $('opt-specials-anytime');
  if (saEl) saEl.checked = !!specialsAnytime;
  const mtvEl = $('opt-must-trump');
  if (mtvEl) mtvEl.checked = !!mustTrumpWhenVoid;
  const bos = $('opt-bid-only');
  if (bos) bos.checked = !!bidOnlyScoring;
  const ng = $('opt-nest-goes-to');
  if (ng) ng.value = nestGoesTo;
  const lo = $('opt-lead-order');
  if (lo) lo.value = leadOrder;
  const mdc = $('opt-misdeal-no-counters');
  if (mdc) mdc.checked = !!misdealOnNoCounters;
  const std = $('opt-screw-dealer');
  if (std) std.checked = !!screwTheDealer;
  const cbComeback = $('opt-comeback-special-chance');
  if (cbComeback) cbComeback.checked = !!comebackSpecialChance;
  const rtn = $('opt-reveal-top-nest');
  if (rtn) rtn.checked = !!revealTopNest;
  const fnr = $('opt-force-nest-reveal');
  if (fnr) fnr.value = forceNestReveal || '';
  const ow = $('opt-open-widow');
  if (ow) ow.checked = !!openWidow;
  const stm = $('opt-shoot-moon');
  if (stm) stm.checked = !!shootMoonEnabled;
  const bdg = $('opt-bot-difficulty-ingame');
  if (bdg) bdg.value = botDifficulty || 'extreme';
  const bs = $('opt-bot-speed');
  if (bs) bs.value = botSpeed;
  const pnk = $('opt-partner-never-kill');
  if (pnk) pnk.checked = partnerNeverKill !== false;
  const pfl = $('opt-partner-feed-last');
  if (pfl) pfl.checked = partnerFeedLast !== false;
  const dsp = $('opt-dont-steal-bid');
  if (dsp) dsp.checked = dontStealPartnerBid !== false;
  const lbh = $('opt-landscape-hints');
  if (lbh) lbh.checked = landscapeBidHints !== false;
  const nla = $('opt-nest-anim');
  if (nla) nla.checked = nestLastTrickAnim !== false;
  const ldw = $('opt-lay-down');
  if (ldw) ldw.checked = layDownWinningCards !== false;
  document.body.classList.toggle('no-avatar-motion', window.horAvatarMotion === false);
  document.body.classList.toggle('hor-tv-display', !!window.horTvDisplay);
  const hsm = $('opt-hand-sort');
  if (hsm) hsm.value = normalizeHandSortMode(handSortMode);
  try { syncTargetScoreUI(); } catch (e) {
    const ts = $('opt-target-score');
    if (ts) ts.value = String(targetScore);
  }
  const mb = $('opt-min-bid');
  if (mb) mb.value = String(minBid);
  const cb2 = $('opt-include-red2');
  if (cb2) cb2.checked = includeRed2;
  const ptsBox = $('opt-red2-points');
  if (ptsBox) ptsBox.style.display = includeRed2 ? 'block' : 'none';
  const cbOnes = $('opt-include-ones');
  if (cbOnes) cbOnes.checked = includeOnes;
  const cbR1 = $('opt-include-red1');
  if (cbR1) cbR1.checked = includeRed1;
  const cbRook = $('opt-include-rook');
  if (cbRook) cbRook.checked = includeRook;
  const cbLow = $('opt-rook-lowest');
  if (cbLow) cbLow.checked = rookLowest;
  const luckySel = $('opt-lucky-boost');
  if (luckySel) luckySel.value = String(luckySpecialsBoost || 0);
  const luckyOn = $('opt-lucky-on');
  if (luckyOn) luckyOn.checked = !!luckySpecialsEnabled;
  const modeFixed = $('opt-lucky-fixed');
  const modeSpin = $('opt-lucky-spinner');
  if (modeFixed) modeFixed.checked = luckySpecialsMode !== 'spinner';
  if (modeSpin) modeSpin.checked = luckySpecialsMode === 'spinner';
  const expOpt = $('opt-experimental-hand');
  if (expOpt) expOpt.checked = !!experimentalHandOpt;
  try { syncSoloHostExtrasUI(); } catch (e) {}
  const td = $('targetDisplay');
  if (td) td.textContent = String(targetScore);
  const hint = $('variantHint');
  if (hint) {
    hint.textContent = `Griffin House · Nest ${nestSizeDefault} · min bid ${minBid} · to ${targetScore}`;
  }
  updateSpecialsAnytimeLabel();
}

function updateSpecialsAnytimeLabel() {
  const text = $('opt-specials-anytime-text');
  if (!text) return;
  const parts = [];
  if (includeRook) parts.push('Rook');
  if (includeRed1) parts.push('Red 1');
  if (includeRed2) parts.push('Red 2');
  text.textContent = parts.length
    ? (parts.join(' / ') + ' anytime')
    : 'Specials anytime';
}

function broadcastPlaySettings() {
  if (!isHost) return;
  broadcast({
    type: 'settings',
    includeRed2, red2Points, includeRed1, includeOnes, onesHigh, includeRook, rookLowest,
    specialsAnytime, mustTrumpWhenVoid, turnTimeSec,
    bidOnlyScoring, nestGoesTo, leadOrder, misdealOnNoCounters, screwTheDealer, comebackSpecialChance, openWidow, revealTopNest, forceNestReveal, shootMoonEnabled, botSpeed, handSortMode, timeoutPolicy,
    partnerNeverKill, partnerFeedLast, dontStealPartnerBid, landscapeBidHints, nestLastTrickAnim, layDownWinningCards,
    minBid, targetScore, handSize, nestSizeDefault, ruleVariant, botDifficulty,
    luckySpecialsBoost, luckySpecialsEnabled, luckySpecialsMode, experimentalHandOpt,
    experimental: window.horExperimental || {},
  });
}

function humanPlayerCount() {
  return (players || []).filter(p => p && !p.isBot).length;
}

function isHostOnlyHuman() {
  if (isSoloPractice) return true;
  return !!(isHost && humanPlayerCount() <= 1);
}

function syncSoloHostExtrasUI() {
  const box = $('soloHostExtras');
  const solo = isHostOnlyHuman();
  if (box) box.classList.toggle('hidden', !solo);
  if (!solo) {
    experimentalHandOpt = false;
    luckySpecialsEnabled = false;
    const expOpt = $('opt-experimental-hand');
    if (expOpt) expOpt.checked = false;
    const luckyOn = $('opt-lucky-on');
    if (luckyOn) luckyOn.checked = false;
  }
  const controls = $('opt-lucky-controls');
  if (controls) controls.classList.toggle('hidden', !solo || !luckySpecialsEnabled);
  if (box && solo) box.open = true;
  const fixedWrap = $('opt-lucky-fixed-wrap');
  if (fixedWrap) fixedWrap.classList.toggle('hidden', luckySpecialsMode === 'spinner');
  const inGame = document.body.classList.contains('in-game');
  const gameOptsBtn = $('btnGameOptions');
  if (gameOptsBtn) gameOptsBtn.classList.toggle('hidden', !inGame);
  const perfectBtn = $('btnPerfectDeal');
  if (perfectBtn) {
    const show = inGame && isHost && solo && experimentalHandOpt;
    perfectBtn.classList.toggle('hidden', !show);
  }
}



function isRed1(card) {
  // Only the optional *special* Red 1 trump — not the normal ones-high red 1 (id "red-1")
  return card && (card.id === 'red1-special' || card.specialRed1 === true);
}


// ========== Sounds (Web Audio API — no external files) ==========
let audioCtx = null;

function ensureAudio() {
  if (soundMuted) return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Audio not available', e);
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Run after AudioContext is actually running. First-hand nest SFX was silent
 *  because resume() is async and oscillators scheduled while suspended never play. */
function whenAudioReady(fn) {
  if (soundMuted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const run = () => { try { fn(ctx); } catch (e) {} };
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => run()).catch(() => {});
    return;
  }
  run();
}

function applyA11y() {
  document.body.classList.toggle('high-contrast', !!highContrast);
  document.body.classList.toggle('reduce-motion', !!reduceMotion);
}
function updateMuteButtons() {
  const label = soundMuted ? '🔇 Sound off' : '🔊 Sound on';
  const icon = soundMuted ? '🔇' : '🔊';
  const lobbyBtn = $('toggleMuteLobby');
  const gameBtn = $('btnMute');
  if (lobbyBtn) lobbyBtn.textContent = label;
  if (gameBtn) gameBtn.textContent = icon;
}

function toggleMute() {
  soundMuted = !soundMuted;
  window.HORAudioMixer?.setMuted(soundMuted);
  if(soundMuted&&window.HORShuffle732)window.HORShuffle732.silence();
  if(soundMuted)window.HORTrumpVoice?.stop('mute-control');
  if(soundMuted)window.HORBidVoice801?.stop();
  localStorage.setItem('rookMuted', soundMuted ? '1' : '0');
  updateMuteButtons();
  if (!soundMuted) ensureAudio();
  if(window.CabinAmbience041)window.CabinAmbience041.sync();
}

const CARD_LANDING_SAMPLE_URLS058 = [1, 2, 3, 4, 5].map(i => `assets/audio/card-play/card-land-${String(i).padStart(2, '0')}.wav`);
let cardLandingBuffers058 = [];
let cardLandingLoad058 = null;
let lastCardLandingIndex058 = -1;
const CARD_WASH_SAMPLE_URLS059 = {
  '1x': 'assets/audio/card-wash-cc0.wav',
  '3x': 'assets/audio/card-wash-3x-cc0.wav',
  'max': 'assets/audio/card-wash-max-cc0.wav'
};
const cardWashBuffers059 = Object.create(null);
const cardWashLoads059 = Object.create(null);

function preloadCardWashSound059(pace) {
  if (soundMuted || !soundCard) return Promise.resolve(null);
  if (cardWashBuffers059[pace]) return Promise.resolve(cardWashBuffers059[pace]);
  if (cardWashLoads059[pace]) return cardWashLoads059[pace];
  const ctx = ensureAudio();
  if (!ctx) return Promise.resolve(null);
  const url = CARD_WASH_SAMPLE_URLS059[pace];
  if (!url) return Promise.resolve(null);
  cardWashLoads059[pace] = fetch(url, { cache: 'force-cache' })
    .then(response => {
      if (!response.ok) throw new Error(`Card wash sample load failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then(bytes => ctx.decodeAudioData(bytes))
    .then(buffer => (cardWashBuffers059[pace] = buffer))
    .catch(error => {
      delete cardWashLoads059[pace];
      console.warn('[Card wash sound]', error);
      return null;
    });
  return cardWashLoads059[pace];
}

function preloadCardLandingSounds058() {
  if (soundMuted || !soundCard) return Promise.resolve([]);
  const ctx = ensureAudio();
  if (!ctx) return Promise.resolve([]);
  if (cardLandingBuffers058.length === CARD_LANDING_SAMPLE_URLS058.length) return Promise.resolve(cardLandingBuffers058);
  if (cardLandingLoad058) return cardLandingLoad058;
  cardLandingLoad058 = Promise.all(CARD_LANDING_SAMPLE_URLS058.map(async url => {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Card landing sample load failed: ${response.status}`);
    return ctx.decodeAudioData(await response.arrayBuffer());
  })).then(buffers => {
    cardLandingBuffers058 = buffers;
    return buffers;
  }).catch(error => {
    cardLandingLoad058 = null;
    console.warn('[Card landing sounds]', error);
    return [];
  });
  return cardLandingLoad058;
}

/** Soft filtered paper movement for the lift and travel; the sampled impact
 * remains a separate event so it lands at the end of the visible flight. */
// 063: recorded effects, decoded once. No immediate repeat within each family.
const naturalCounts063 = {"smoothcard736down": 1, "smoothcard735": 1, "bidup735": 1, "biddown735": 1, "paper": 4, "gather": 3, "click": 4, "wood": 4, "clink": 4, "stamp": 1, "tick": 1, "wings": 1, "applause": 1};
const naturalBuffers063 = new Map(), naturalLoads063 = new Map(), naturalLast063 = new Map();
let naturalContext063 = null, naturalAwardAt063 = 0;
function loadNatural063(kind, index) {
 const ctx=ensureAudio(); if(!ctx)return Promise.resolve(null);
 if(naturalContext063!==ctx){naturalContext063=ctx;naturalBuffers063.clear();naturalLoads063.clear();}
 const key=kind+'-'+String(index).padStart(2,'0');
 if(naturalBuffers063.has(key))return Promise.resolve(naturalBuffers063.get(key));
 if(!naturalLoads063.has(key))naturalLoads063.set(key,fetch('assets/audio/natural063/'+key+'.wav').then(r=>{if(!r.ok)throw Error(key);return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).then(b=>{naturalBuffers063.set(key,b);return b;}).catch(()=>{naturalLoads063.delete(key);return null;}));
 return naturalLoads063.get(key);
}
function preloadNatural063(){
 if(soundMuted)return;
 for(const [kind,count] of Object.entries(naturalCounts063))for(let i=1;i<=count;i++)loadNatural063(kind,i);
}
const naturalBags063=new Map();
const naturalPreferencesKey='horNaturalSoundPreferencesV1';
let naturalPreferences063={};
const naturalLevels063={};try{const saved=JSON.parse(localStorage.getItem('horNaturalLevelsV1')||'{}');for(const key of Object.keys(naturalCounts063))if(Number.isFinite(saved[key]))naturalLevels063[key]=Math.max(0,Math.min(100,saved[key]));}catch(_){}
function setNaturalLevel063(kind,value){naturalLevels063[kind]=Math.max(0,Math.min(100,Number(value)||0));try{localStorage.setItem('horNaturalLevelsV1',JSON.stringify(naturalLevels063));}catch(_){horToast('Sound volume could not be saved.');}}
try { const saved=JSON.parse(localStorage.getItem(naturalPreferencesKey)||'{}');
 for(const [kind,count] of Object.entries(naturalCounts063)){
  const value=saved[kind];
  if(value==='rotate'||(Number.isInteger(value)&&value>=1&&value<=count))naturalPreferences063[kind]=value;
 }
} catch (_) {}
function setNaturalPreference063(kind,value){
 const count=naturalCounts063[kind];
 if(!count||!(value==='rotate'||(Number.isInteger(value)&&value>=1&&value<=count)))return false;
 naturalPreferences063[kind]=value;naturalBags063.delete(kind);
 try {localStorage.setItem(naturalPreferencesKey,JSON.stringify(naturalPreferences063));return true;} catch(_){horToast('Sound choice works now, but this browser could not save it.');return false;}
}
function nextNaturalIndex063(kind,count){
 let bag=naturalBags063.get(kind);
 const last=naturalLast063.get(kind);
 if(!bag||!bag.length){
  bag=Array.from({length:count},(_,i)=>i+1);
  for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=bag[i];bag[i]=bag[j];bag[j]=t;}
  if(count>1&&bag[0]===last){bag.push(bag.shift());}
  naturalBags063.set(kind,bag);
 }
 const index=bag.shift();
 naturalLast063.set(kind,index);
 return index;
}
function playNatural063(kind, volume=1, delayMs=0, category='card', previewIndex=null) {
 const allowed=()=>!soundMuted && !document.hidden && (category==='turn'?soundTurn:category==='tick'?soundTick:category==='preview'?true:soundCard);
 if(!allowed()||!naturalCounts063[kind])return null;
 const count=naturalCounts063[kind];
 const choice=category==='preview'?previewIndex:naturalPreferences063[kind];
 const index=Number.isInteger(choice)&&choice>=1&&choice<=count?choice:nextNaturalIndex063(kind,count);
 const requested=Date.now(),target=requested+Math.max(0,delayMs);
 loadNatural063(kind,index).then(buffer=>{
  if(!buffer||!allowed()||Date.now()>target+250)return; // Never emit a stale cue after a slow load/resume.
  whenAudioReady(ctx=>{
   if(!allowed()||Date.now()>target+250)return;
   const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffer;gain.gain.value=Math.max(0,Math.min(1,volume))*(naturalLevels063[kind]??100)/100;if(kind==="paper"||kind==="gather")src.playbackRate.value=0.97+Math.random()*0.06;
   src.connect(gain);gain.connect(window.HORAudioMixer.output(ctx,category));presentationSounds035.add(src);if(category==="preview"&&window.he064Track)window.he064Track(src);
   src.onended=()=>{presentationSounds035.delete(src);src.disconnect();gain.disconnect();};
   src.start(ctx.currentTime+Math.max(0,target-Date.now())/1000);
  });
 });
}
window.horPlayNatural063=playNatural063;
function playAwardApplause063(){
 if(soundMuted||!soundCard||Date.now()-naturalAwardAt063<4500)return false;
 naturalAwardAt063=Date.now();playNatural063('applause',.8);return true;
}
document.addEventListener('pointerdown',preloadNatural063,{once:true,passive:true});

function playCardMotionSound059(ctx, flightMs) {
  playNatural063('paper',.09);
  playNatural063('paper',.035,Math.min(90,flightMs*.25));
}

/** Play a soft peel/flight plus one of five cleaned impacts at card arrival. */
function playCardSound() {
  if (soundMuted || !soundCard) return;
  const flightMs = solScaledDelay(480, 100);
  try { playCardMotionSound059(ensureAudio(), flightMs); } catch (e) {}
  const impactLeadMs = 35;
  const delay = Math.max(0, flightMs - impactLeadMs);
  setTimeout(() => {
    if (soundMuted || !soundCard) return;
    const ctx = ensureAudio();
    if (!ctx || cardLandingBuffers058.length !== CARD_LANDING_SAMPLE_URLS058.length) return;
    const options = cardLandingBuffers058.map((_, i) => i).filter(i => i !== lastCardLandingIndex058);
    const index = options[Math.floor(Math.random() * options.length)];
    lastCardLandingIndex058 = index;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = cardLandingBuffers058[index];
    gain.gain.setValueAtTime(0.72, ctx.currentTime);
    source.connect(gain);
    gain.connect(window.HORAudioMixer.output(ctx,'gameplay'));
    source.start(ctx.currentTime + 0.004);
    source.onended = () => { try { source.disconnect(); gain.disconnect(); } catch (_) {} };
  }, delay);
}

/** Subtle selectable cue when it becomes your turn. */
function playTurnSound(forcePreview = false) {
  if(turnSoundChoice===20){if(!soundMuted&&(soundTurn||forcePreview))playNatural063('wood',.7,0,forcePreview?'card':'turn');return;}
  if (soundMuted || (!soundTurn && !forcePreview)) return;

  // Mobile browsers can leave Web Audio suspended until a user gesture.
  // Schedule the cue only after the context is actually running; this fixes
  // silent My Turn cues and makes selector previews reliable.
  whenAudioReady((ctx) => {
    const t = ctx.currentTime + 0.01;
    const presets = [
      ['triangle',230,120,.080,.060], ['sine',420,300,.095,.045], ['sine',520,390,.100,.040],
      ['triangle',310,190,.090,.050], ['sine',660,500,.085,.035], ['triangle',180,105,.105,.055],
      ['sine',760,610,.075,.030], ['triangle',275,165,.115,.045], ['sine',350,265,.120,.040],
      ['triangle',460,280,.085,.038], ['sine',590,455,.110,.034], ['triangle',205,145,.125,.050],
      ['sine',700,546,.090,.028], ['triangle',390,235,.100,.040], ['sine',485,365,.115,.034],
      ['triangle',250,155,.095,.048], ['sine',615,470,.105,.030], ['triangle',335,205,.120,.038],
      ['sine',555,410,.090,.033]
    ];
    const p = presets[Math.max(0, Math.min(18, (turnSoundChoice || 1) - 1))];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = p[0];
    osc.frequency.setValueAtTime(p[1], t);
    osc.frequency.exponentialRampToValueAtTime(p[2], t + p[3] * .72);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(p[4], t + .012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + p[3]);
    osc.connect(gain);
    gain.connect(window.HORAudioMixer.output(ctx,'gameplay'));
    osc.start(t);
    osc.stop(t + p[3] + .015);
  });
}

// A recorded crow-family call is used instead of the old synthetic caw.
// It is deliberately played quietly; the black Rook gets two calls.
const RAVEN_CAW_SAMPLE_URL060 = 'assets/audio/card-play/raven-caw-recorded.wav';
let ravenCawBuffer060 = null;
let ravenCawLoad060 = null;
function preloadRavenCaw060() {
  if (ravenCawBuffer060 || ravenCawLoad060) return ravenCawLoad060;
  try {
    const ctx = ensureAudio();
    if (!ctx) return null;
    ravenCawLoad060 = fetch(RAVEN_CAW_SAMPLE_URL060)
      .then(r => { if (!r.ok) throw new Error('raven audio unavailable'); return r.arrayBuffer(); })
      .then(b => ctx.decodeAudioData(b))
      .then(b => { ravenCawBuffer060 = b; return b; })
      .catch(() => null);
    return ravenCawLoad060;
  } catch (_) { return null; }
}
function playRavenCalls060(count) {
  if (soundMuted || !soundRook) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const play = (buffer) => {
    if (!buffer || soundMuted || !soundRook) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    source.connect(gain); gain.connect(window.HORAudioMixer.output(ctx,'gameplay'));
    source.onended = () => { try { source.disconnect(); gain.disconnect(); } catch (_) {} };
    source.start(ctx.currentTime + 0.01);
  };
  const buffer = ravenCawBuffer060;
  if (buffer) {
    play(buffer);
    if (count > 1) setTimeout(() => play(buffer), 720);
  } else {
    preloadRavenCaw060()?.then(loaded => {
      if (!loaded || soundMuted || !soundRook) return;
      play(loaded);
      if (count > 1) setTimeout(() => play(loaded), 720);
    });
  }
}
document.addEventListener('pointerdown', preloadRavenCaw060, { once: true, passive: true });
function playRookSound() { playRavenCalls060(2); }
function playRed2Sound() { playRavenCalls060(1); }

function playTickSound() {
  playNatural063('tick',.5,0,'tick');
}

/** Soft UI click (buttons, selects) */
function playDiscardPickSound(step) {
  playNatural063('smoothcard735',.35);
}

function playDiscardToggleSfx(removing) {
  if (window._discardPickStep == null) window._discardPickStep = 0;
  if (removing) {
    playDiscardUnpickSound();
    window._discardPickStep = Math.max(0, window._discardPickStep - 1);
  } else {
    playDiscardPickSound(window._discardPickStep);
    window._discardPickStep += 1;
  }
}

function playDiscardUnpickSound() {
  playNatural063('smoothcard736down',.35);
}

function playClickSound() {
  playNatural063('click',.65);
}

/** Fixed soft rising cue; no rotating mechanical button samples. */
function playBidUpSound() {
  playNatural063('bidup735',.4);
}

/** Fixed soft falling cue. */
function playBidDownSound() {
  playNatural063('biddown735',.4);
}

/** Low lobby seat-selection cue (the original "doooop" feel).
 * Kept separate from playSitSound(), which is the bot/player seating cue. */
function playLobbySeatClickSound() {
  playNatural063('click',.4);
}

function playSitSound() {
  /* Quiet until the requested chair recording is supplied. */
}

/** Bid placed — short rising blip (like casino chip / bid) */
function playBidSound() {
  playNatural063('bidup735',.4);
}

/** Pass — soft descending tone */
function playPassSound() {
  /* Visual pass feedback is sufficient. */
}

/** Auction won / nest taken */
function playWinBidSound() {
  playNatural063('click',.45);
}

/** Discard / nest shuffle — multiple soft card taps */
function playDiscardSound() {
  playNatural063('gather',.4);
}

/** Trump named — bright fanfare blip */
function playTrumpSound() {
  /* Contact is sounded by the stamp animation. */
}

/** Trick won — short success chime */
function playTrickWinSound() {
  playNatural063('gather',.32);
}

/** Hand made */
function playMadeSound() {
  /* Result display carries this information. */
}

/** Hand set — low warning */
function playSetSound() {
  /* No punishment buzzer. */
}

/** Longer shuffle — ~1.5s of layered card-riffle noise */
function playRiffleShuffleSound034() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  // Dense riffle bursts over ~1.5 seconds
  for (let i = 0; i < 28; i++) {
    const bufferSize = Math.floor(ctx.sampleRate * (0.028 + Math.random() * 0.025));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.32));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + (i % 5) * 180 + Math.random() * 120;
    bp.Q.value = 0.85;
    const g = ctx.createGain();
    const s = t + i * 0.052 + Math.random() * 0.012;
    const peak = 0.12 + (i % 3) * 0.03;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(peak, s + 0.008);
    g.gain.exponentialRampToValueAtTime(0.008, s + 0.04);
    noise.connect(bp);
    bp.connect(g);
    g.connect(window.HORAudioMixer.output(ctx,'gameplay'));
    noise.start(s);
    noise.stop(s + 0.06);
  }
  // Soft low thumps (deck packing)
  for (let k = 0; k < 4; k++) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 90 + k * 15;
    const s = t + 0.2 + k * 0.35;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.08, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.12);
    osc.connect(g);
    g.connect(window.HORAudioMixer.output(ctx,'gameplay'));
    osc.start(s);
    osc.stop(s + 0.14);
  }
}

/** Bidding intro popup removed — jump straight to the auction. */
let biddingIntroTimer = null;
function showBiddingIntro(onDone, minBidOverride) {
  try {
    const el = $('biddingIntro');
    if (el) el.classList.add('hidden');
  } catch (e) {}
  if (typeof nestAuctionLocked === 'function' && nestAuctionLocked()) {
    window._horPendingBidIntro = { onDone, minBidOverride };
    return;
  }
  if (typeof onDone === 'function') {
    try { onDone(); } catch (e) {}
  }
}

/** Fanfare when Rook captures Red 2 or a trump 1 is taken */
function playCaptureFanfare(kind) {
  playAwardApplause063();
}

let captureOverlayTimer = null;
let captureCelebrationQueue = [];
let captureCelebrationRunning = false;
function showRookRed2Duel(done) {
  // The resolved-trick observer now owns the actual raven encounter. This
  // historical celebration hook must not replay a second card-face duel.
  window._birdFightArmed064 = false;
  if (typeof done === 'function') done();
}

/**
 * kind: 'rook-red2' | 'trump1' | 'high-points'
 * winnerName: display name
 * amount: point value of the trick (used for high-points)
 */
function captureSubject793(name, winnerId) {
  const localId=typeof myIndex==='number'&&myIndex>=0&&!isSpectator?game?.players?.[myIndex]?.id:null;
  const you=!!(winnerId&&localId&&winnerId===localId);
  return {name:you?'You':(name||'Player'),take:you?' take':' takes',steal:you?' steal':' steals',win:you?' win':' wins'};
}
function showCaptureCelebration(kind, winnerName, amount, winnerId) {
  const ov = $('captureOverlay');
  if (!ov) return;
  const title = $('captureTitle');
  const sub = $('captureSub');
  const emoji = $('captureEmoji');
  const subject=captureSubject793(winnerName,winnerId),name=subject.name;
  ov.classList.remove('hidden', 'capture-rook', 'capture-one', 'capture-big');
  if (kind === 'rook-red2') {
    ov.classList.add('capture-rook');
    if (emoji) emoji.innerHTML = '<img class="rook-cele-bird" src="assets/images/cardback-raven.jpg" alt="Black Rook">';
    if (title) title.textContent = 'THE BIRD TAKES RED 2!';
    if (sub) sub.textContent = name + subject.steal + ' the 2nd-highest trump';
  } else if (kind === 'high-points') {
    // Rook589: presentation-only branch proven on-device in Rook588.
    // Keep the existing capture queue/timing engine; isolate only Big Trick visuals.
    ov.classList.add('hidden');
    ov.setAttribute('aria-hidden', 'true');
    showBigTrickCelebration(winnerName, Number(amount) || 0, winnerId);
    return;
  } else {
    ov.classList.add('capture-one');
    if (emoji) emoji.textContent = '★';
    if (title) title.textContent = 'TRUMP 1 CAPTURED!';
    if (sub) sub.textContent = name + subject.take + ' the high 1';
  }
  ov.setAttribute('aria-hidden', 'false');
  try {
    ov.style.animation = 'none';
    ov.offsetHeight;
    ov.style.animation = '';
  } catch (e) {}
  try { playCaptureFanfare(kind === 'rook-red2' ? 'rook-red2' : 'trump1'); } catch (e) {}
  if (captureOverlayTimer) (window.HORRavenFight741?.stopClock||clearTimeout)(captureOverlayTimer);
  captureOverlayTimer = (window.HORRavenFight741?.later||setTimeout)(() => {
    ov.classList.add('hidden');
    ov.setAttribute('aria-hidden', 'true');
    captureOverlayTimer = null;
    captureCelebrationRunning = false;
    playNextCaptureCelebration();
  }, solScaledDelay(2400, horGamePace === 99 ? 180 : 500));
}


function showBigTrickCelebration(name, amount, winnerId) {
  const subject=captureSubject793(name,winnerId);
  let ov = document.getElementById('bigTrickOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bigTrickOverlay';
    ov.className = 'big-trick-approved hidden';
    ov.setAttribute('aria-hidden','true');
    ov.innerHTML = '<div class="big-trick-plaque"><div class="big-trick-kicker">GRIFFIN HOUSE</div><div class="big-trick-title">BIG TRICK!</div><div class="big-trick-points"></div><div class="big-trick-sub"></div></div>';
    document.body.appendChild(ov);
  }
  const pts = ov.querySelector('.big-trick-points');
  const sub = ov.querySelector('.big-trick-sub');
  if (pts) pts.textContent = String(amount) + ' POINTS';
  if (sub) sub.textContent = subject.name + subject.take + ' the trick';
  ov.classList.remove('hidden');
  ov.setAttribute('aria-hidden','false');
  void ov.offsetWidth;
  ov.classList.add('is-showing');
  try { playCaptureFanfare('trump1'); } catch (e) {}
  if (captureOverlayTimer) (window.HORRavenFight741?.stopClock||clearTimeout)(captureOverlayTimer);
  captureOverlayTimer = (window.HORRavenFight741?.later||setTimeout)(() => {
    ov.classList.remove('is-showing');
    ov.classList.add('hidden');
    ov.setAttribute('aria-hidden','true');
    captureOverlayTimer = null;
    captureCelebrationRunning = false;
    playNextCaptureCelebration();
  }, solScaledDelay(2400, horGamePace === 99 ? 180 : 500));
}

function captureEventPresentation(entry) {
  const kind = entry && entry.kind;
  const subject=captureSubject793(entry?.winnerName,entry?.winnerId),name=subject.name;
  if (kind === 'rook-red2') return { icon:'♜', title:'THE BIRD TAKES RED 2!', sub:name + subject.steal + ' the 2nd-highest trump' };
  if (kind === 'high-points') return { icon:'💰', title:'BIG TRICK!', sub:name + subject.take + ' ' + (Number(entry.amount)||0) + ' points!' };
  return { icon:'★', title:'TRUMP 1 CAPTURED!', sub:name + subject.take + ' the high 1' };
}

function showCombinedCaptureCelebration(entries) {
  const ov = $('captureOverlay');
  if (!ov || !entries || entries.length < 2) return false;
  const title = $('captureTitle');
  const sub = $('captureSub');
  const emoji = $('captureEmoji');
  ov.classList.remove('hidden','capture-rook','capture-one');
  ov.classList.add('capture-rook','capture-combined');
  if (emoji) emoji.textContent = '★';
  if (title) title.textContent = entries.length + ' SPECIAL CAPTURES!';
  if (sub) {
    sub.innerHTML = entries.map((e) => {
      const p = captureEventPresentation(e);
      return '<div class="capture-combo-row"><span class="capture-combo-icon">'+p.icon+'</span><span><b>'+p.title+'</b><small>'+p.sub+'</small></span></div>';
    }).join('');
  }
  ov.setAttribute('aria-hidden','false');
  try { ov.style.animation='none'; ov.offsetHeight; ov.style.animation=''; } catch(e) {}
  try { playCaptureFanfare(entries.some(e=>e.kind==='rook-red2') ? 'rook-red2' : 'trump1'); } catch(e) {}
  if (captureOverlayTimer) (window.HORRavenFight741?.stopClock||clearTimeout)(captureOverlayTimer);
  captureOverlayTimer=(window.HORRavenFight741?.later||setTimeout)(()=>{
    ov.classList.add('hidden'); ov.classList.remove('capture-combined'); ov.setAttribute('aria-hidden','true');
    captureOverlayTimer=null; captureCelebrationRunning=false; playNextCaptureCelebration();
  }, solScaledDelay(Math.min(4400, 2600 + entries.length*450), horGamePace === 99 ? 220 : 650));
  return true;
}

function queueCaptureCelebrations(items, winnerName) {
  if (!Array.isArray(items)) items = items ? [items] : [];
  items = items.filter(item => (typeof item === 'string' ? item : item?.kind) !== 'rook-red2' || !window.HORRavenFight741?.replacesBirdMessage());
  if (!items.length) return;
  if (window.HORRavenFight741?.deferCelebration(() => queueCaptureCelebrations(items, winnerName))) return;
  const normalized = items.map(item => {
    const entry = (typeof item === 'string') ? { kind:item } : (item || {});
    if (!entry.kind) return null;
    return { kind:entry.kind, winnerName:entry.winnerName || winnerName || 'Player', winnerId:entry.winnerId || null, amount:Number(entry.amount)||0 };
  }).filter(Boolean);
  // One trick = one interruption. If the same resolved trick earns multiple
  // specials, celebrate them together instead of serial full-screen popups.
  if (normalized.length > 1 && !captureCelebrationRunning && !captureCelebrationQueue.length) {
    captureCelebrationRunning = true;
    const combined = () => showCombinedCaptureCelebration(normalized);
    if (normalized.some(entry => entry.kind === 'rook-red2')) showRookRed2Duel(combined);
    else combined();
    return;
  }
  normalized.forEach(entry => captureCelebrationQueue.push(entry));
  playNextCaptureCelebration();
}

function playNextCaptureCelebration() {
  if (captureCelebrationRunning || !captureCelebrationQueue.length) return;
  const next = captureCelebrationQueue.shift();
  captureCelebrationRunning = true;
  if (next.kind === 'rook-red2') showRookRed2Duel(() => showCaptureCelebration(next.kind, next.winnerName, next.amount, next.winnerId));
  else showCaptureCelebration(next.kind, next.winnerName, next.amount, next.winnerId);
}

/** Inspect a finished trick for all special captures, in card order. */
function detectSpecialCaptures(trick, winnerPlay) {
  if (!trick || !trick.length || !winnerPlay) return [];
  const cards = trick.map(t => t.card).filter(Boolean);
  const hasRook = cards.some(c => c.color === 'rook' || c.id === 'rook');
  const hasRed2 = cards.some(c => isRed2(c));
  const winCard = winnerPlay.card;
  const winIsRook = winCard && (winCard.color === 'rook' || winCard.id === 'rook');

  // When the Rook wins, celebrate EACH valuable special card it captured.
  // This deliberately returns one event per Red 2 / trump 1, so a trick
  // containing three such cards produces three celebrations instead of one.
  if (winIsRook) {
    const captures = [];
    if (hasRed2) captures.push('rook-red2');
    const trump = (game && game.trump) || null;
    const isTrumpOne = (c) => {
      if (!c) return false;
      if (isRed1(c)) return true;
      return !!(includeOnes && (c.rank === 1 || c.rank === '1') && trump && c.color === trump);
    };
    cards.forEach(c => {
      if (isTrumpOne(c) && c !== winCard) captures.push('trump1');
    });
    if (captures.length) return captures;
  }

  // No other card captures trigger a celebration.
  return [];
}

/** Short single-card deal snap */

/** Nest reveal — paper whoosh, lift chime, slap when the face lands */
function playNestRevealSequence() {
  playNatural063('gather',.4);
}
function playNestFlipSound() { if(isPortraitViewport()){playRecordedCard035('reveal');playBirdNestReaction041();}else playNestRevealSequence(); }
function playNestLandSound() { /* land is part of playNestRevealSequence */ }

function playLegacyDealCardSound035() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let j = 0; j < bufferSize; j++) {
    data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.22));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400 + Math.random() * 400;
  bp.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
  noise.connect(bp);
  bp.connect(g);
  g.connect(window.HORAudioMixer.output(ctx,'gameplay'));
  noise.start(t);
  noise.stop(t + 0.05);
}

/** Legacy short deal sound → full shuffle */
function playDealSound() {
  playShuffleSound();
}

/** Shuffle overlay + deal cards into hand one-by-one */
let dealAnimToken = 0;
const SHUFFLE_ANIM_MS = 5600; // Existing landscape/explicit legacy duration preserved.
function shuffleAnimDuration762(){return isPortraitViewport()&&new URLSearchParams(location.search).get('shuffle')!=='legacy'?5033:SHUFFLE_ANIM_MS;} // Only the asset opening omits its stationary corner hold.
const CARD_DEAL_MS = 115;

function ensureShuffleOverlay() {
  let ov = $('shuffleOverlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'shuffleOverlay';
  ov.className = 'shuffle-overlay hidden';
  ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML = `
    <div class="shuffle-stage">
      <div class="shuffle-deck" aria-hidden="true"><div class="shuffle-plane033">
        <div class="shuffle-card sc1"></div>
        <div class="shuffle-card sc2"></div>
        <div class="shuffle-card sc3"></div>
        <div class="shuffle-card sc4"></div>
        <div class="shuffle-card sc5"></div>
        <div class="shuffle-card wash-extra sc6"></div>
        <div class="shuffle-card wash-extra sc7"></div>
        <div class="shuffle-card wash-extra sc8"></div>
        <div class="shuffle-card wash-extra sc9"></div>
        <div class="shuffle-card wash-extra sc10"></div>
        <div class="shuffle-card wash-extra sc11"></div>
        <div class="shuffle-card wash-extra sc12"></div>
      </div></div>
      <p class="shuffle-label">Shuffling…</p>
    </div>`;
  document.body.appendChild(ov);
  return ov;
}

function showShuffleOverlay() {
  const ov = ensureShuffleOverlay();
  if (ov.parentNode !== document.body) document.body.appendChild(ov);
  ov.style.zIndex = '180000';
  ov.classList.remove('hidden');
  ov.setAttribute('aria-hidden', 'false');
  ov.style.setProperty('--rook033-wash-duration', solScaledDelay(shuffleAnimDuration762(), 80) + 'ms');
  ov.classList.add('shuffling');
  positionShuffleWash033();
  if(window.HORShuffle732)window.HORShuffle732.start(ov,solScaledDelay(shuffleAnimDuration762(),80));
}

function hideShuffleOverlay() {
  if(window.HORShuffle732)window.HORShuffle732.stop();
  const ov = $('shuffleOverlay');
  if (!ov) return;
  ov.classList.remove('shuffling');
  ov.classList.add('hidden');
  ov.setAttribute('aria-hidden', 'true');
}

/**
 * Present deal: shuffle anim → cards fly into hand one at a time → sort.
 * fullHand: array of card objects. onDone optional.
 */
function runLegacyDealPresentation035(fullHand, onDone) {
  const hand = (fullHand || []).map(c => ({ ...c }));
  const token = ++dealAnimToken;
  try { showGame(); } catch (e) {}
  if (!game) game = {};
  game.myHand = [];
  try {
    const handEl = $('myHand');
    if (handEl) handEl.innerHTML = '';
    const ltHand = $('ltHand');
    if (ltHand) ltHand.innerHTML = '';
    const ltPlays = $('ltPlays');
    if (ltPlays) ltPlays.innerHTML = '';
  } catch (e) {}

  // Load the five varied card landing recordings while the shuffle plays so
  // dealing can use the same natural paper sounds instead of the old click.
  preloadCardLandingSounds058();
  showShuffleOverlay();
  try { playShuffleSound(); } catch (e) {}
  try { renderTopNestPeek(); } catch (e) {}

  setTimeout(() => {
    if (token !== dealAnimToken) return;
    hideShuffleOverlay();
    let i = 0;
    const step = () => {
      if (token !== dealAnimToken) return;
      if (i >= hand.length) {
        game.myHand = hand.slice();
        try { sortMyHandInPlace(); } catch (e) {}
        try { renderHand(false); } catch (e) {}
        if (typeof onDone === 'function') onDone();
        return;
      }
      game.myHand = hand.slice(0, i + 1);
      try { renderHand(false, { skipSort: true, dealIn: true }); } catch (e) {}
      try { playDealCardSound(); } catch (e) {}
      i += 1;
      setTimeout(step, solScaledDelay(CARD_DEAL_MS, 18));
    };
    step();
  }, solScaledDelay(shuffleAnimDuration762(), 80));
}

/** Dispatch named SFX (local + optional network) */
function playSfx(name, { broadcastNet = false } = {}) {
  if (!name) return;
  switch (name) {
    case 'rook': playRookSound(); break;
    case 'red2': playRed2Sound(); break;
    case 'card': playCardSound(); break;
    case 'turn': playTurnSound(); break;
    case 'tick': playTickSound(); break;
    case 'click': playClickSound(); break;
    case 'bidUp': playBidUpSound(); break;
    case 'bidDown': playBidDownSound(); break;
    case 'sit': playSitSound(); break;
    case 'bid': playBidSound(); break;
    case 'pass': playPassSound(); break;
    case 'winBid': playWinBidSound(); break;
    case 'discard': playDiscardSound(); break;
    case 'trump': playTrumpSound(); break;
    case 'trick': playTrickWinSound(); break;
    case 'made': playMadeSound(); break;
    case 'set': playSetSound(); break;
    case 'deal': playDealSound(); break;
    case 'shuffle': playShuffleSound(); break;
    case 'dealCard': playDealCardSound(); break;
    case 'nestFlip': playNestFlipSound(); break;
    case 'nestLand': playNestLandSound(); break;
    default: break;
  }
  if (broadcastNet && isHost) {
    try { broadcast({ type: 'sfx', name }); } catch (e) {}
  }
}

function birdFightCaptureConfirmed064(card){
  if(!card||!game||!Array.isArray(game.trick))return false;
  const isRook=card.color==='rook'||card.id==='rook';
  const isR2=typeof isRed2==='function'?isRed2(card):card.id==='red-2';
  if(!isRook&&!isR2)return false;
  const plays=game.trick.map(p=>({card:(p&&p.card)||p})).filter(p=>p.card);
  if(!plays.some(p=>p.card===card||p.card.id===card.id))plays.push({card});
  const cards=plays.map(p=>p.card);
  const hasRook=cards.some(c=>c.color==='rook'||c.id==='rook');
  const hasRed2=cards.some(c=>typeof isRed2==='function'?isRed2(c):c.id==='red-2');
  if(!hasRook||!hasRed2)return false;
  const earlier=cards.filter(c=>c!==card);
  const second=isRook?earlier.some(c=>typeof isRed2==='function'?isRed2(c):c.id==='red-2'):earlier.some(c=>c.color==='rook'||c.id==='rook');
  if(!second)return false;
  const rookPlay=plays.find(p=>p.card&&(p.card.color==='rook'||p.card.id==='rook'));
  if(!rookPlay)return false;
  try{return detectSpecialCaptures(plays,rookPlay).includes('rook-red2');}catch(e){return false;}
}
function notifyCardPlayed(card) {
  const isRook = card && (card.color === 'rook' || card.id === 'rook');
  const isR2 = card && (typeof isRed2 === 'function' ? isRed2(card) : card.id === 'red-2');
  const name = isRook ? 'rook' : (isR2 ? 'red2' : 'card');
  window._lastPlayedCardSfxAt = Date.now();
  if (isRook || isR2) playSfx('card', { broadcastNet: true });
  const suppressBird=birdFightCaptureConfirmed064(card);
  if(suppressBird){window._birdFightArmed064=true;}
  else playSfx(name, { broadcastNet: true });
  if (isRook) markRookJustPlayed();
}

function markRookJustPlayed() {
  window._rookPlayPulseUntil = Date.now() + 520;
  window._rookPlayPulseArmed = true;
  try {
    requestAnimationFrame(() => applyRookPlayPulse());
    setTimeout(() => applyRookPlayPulse(), 40);
  } catch (e) {}
}

function rookPlayPulseActive(card) {
  if (!card || (card.color !== 'rook' && card.id !== 'rook')) return false;
  return Date.now() < (window._rookPlayPulseUntil || 0);
}

function applyRookPlayPulse() {
  try {
    if (Date.now() >= (window._rookPlayPulseUntil || 0)) return;
    const nodes = document.querySelectorAll(
      '.trick-card-wrap.latest .card-face.rook, .lt-play.latest .card-face.rook, .trick-flight-card .card-face.rook'
    );
    nodes.forEach((el) => {
      const wrap = el.closest('.trick-card-wrap, .lt-play, .trick-flight-card') || el;
      if (wrap.classList.contains('rook-play-pulse')) return;
      wrap.classList.add('rook-play-pulse');
      el.classList.add('rook-play-pulse');
    });
  } catch (e) {}
}



/** Until this timestamp, keep re-applying the turn flash after every renderUI */
let turnFlashUntil = 0;

function isFirstHandOfMatch() {
  try {
    if (matchStats && matchStats.hands) return false;
    if (game && Array.isArray(game.scores) && (game.scores[0] || game.scores[1])) return false;
    const tricks = game && game.tricksTaken;
    if (tricks && ((tricks[0] && tricks[0].length) || (tricks[1] && tricks[1].length))) return false;
    return true;
  } catch (e) {
    return true;
  }
}
function applyFirstHandChrome() {
  try {
    document.body.classList.toggle('hor-first-hand', isFirstHandOfMatch());
  } catch (e) {}
}
function pulseTurnFlash() { try { window.HORHolderCues789?.notifyTurn(); } catch (_) {} }

function turnOpportunityKey() {
  if (!game || isSpectator) return '';
  if (game.paused || game.claimAnimating || game.resolvingTrick) return '';
  if (game.phase === 'play' && game.currentPlayer === myIndex)
    return 'play:' + myIndex + ':' + ((game.trick && game.trick.length) || 0);
  if (game.phase === 'bidding' && game.currentPlayer === myIndex)
    return 'bid:' + myIndex + ':' + (game.highestBid || 0);
  if (game.phase === 'trump' && game.bidder === myIndex)
    return 'trump:' + myIndex;
  if (game.phase === 'discard' && game.bidder === myIndex)
    return 'discard:' + myIndex;
  return '';
}
function maybeRemindTurn() {
  const key = turnOpportunityKey();
  if (!key) {
    window._turnOppKey = '';
    return;
  }
  if (window._turnOppKey === key) return;
  window._turnOppKey = key;
  try { notifyYourTurn(); } catch (e) {}
}
const YOUR_TURN_NOTIFY_DELAY_MS = 180;
const YOUR_TURN_AFTER_CARD_GAP_MS = 450;
let yourTurnNotifyTimer = null;

function notifyYourTurn() {
  const opportunityKey = turnOpportunityKey();
  try {
    const key = game
      ? `${game.phase}:${game.currentPlayer}:${(game.trick && game.trick.length) || 0}`
      : String(Date.now());
    const now = Date.now();
    if (window._lastTurnBeepKey === key && now - (window._lastTurnBeepAt || 0) < 2500) {
      return;
    }
    window._lastTurnBeepKey = key;
    window._lastTurnBeepAt = now;
  } catch (e) {}

  // Rook505: guarantee separation from the actual previous card-play SFX.
  // Other turn transitions retain the short baseline hesitation.
  const sinceCardSfx = Date.now() - (window._lastPlayedCardSfxAt || 0);
  const cardGapRemaining = Math.max(0, YOUR_TURN_AFTER_CARD_GAP_MS - sinceCardSfx);
  const notifyDelay = Math.max(YOUR_TURN_NOTIFY_DELAY_MS, cardGapRemaining);
  if (yourTurnNotifyTimer) clearTimeout(yourTurnNotifyTimer);
  yourTurnNotifyTimer = setTimeout(() => {
    yourTurnNotifyTimer = null;

    // Do not fire a delayed cue if this turn opportunity disappeared/changed.
    try {
      if (!opportunityKey || turnOpportunityKey() !== opportunityKey) return;
    } catch (e) {}

    try {
      const ctx = ensureAudio();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {}

    // Sound every new local turn except the opening bidding turn when the
    // Turn Over Top Nest Card reveal is enabled. That reveal owns the audio
    // during the first-hand animation; with the option OFF, the turn cue plays.
    try {
      const suppressForOpeningNestReveal = !!(
        game && game.phase === 'bidding' && revealTopNest && isFirstHandOfMatch()
      );
      if (game && game.phase === 'bidding') game._firstBidTurnSounded = true;
      if (!suppressForOpeningNestReveal) playTurnSound();
    } catch (e) {}

    // Preserve the existing sound delay; the holder cue owns synchronized visual/haptic timing.
    try { pulseTurnFlash(); } catch (e) {}
    turnFlashUntil = 0;
  }, notifyDelay);
}

function totalCountersInDeck() {
  // Baseline: four 5s (20) + four 10s (40) + four 14s (40) = 100
  // + Rook 20 → 120 without extras
  // + Red 2 (20 or 30) → 140 or 150
  // + Red 1 (30) → +30
  // + four 1s at 15 → +60 (e.g. Rook+Red2+1s = 200 when Red2=20)
  let t = 100;
  if (includeRook) t += 20;
  const r2 = includeRed2 ? (parseInt(red2Points, 10) || 20) : 0;
  if (includeRed2) t += r2;
  if (includeRed1) t += 30;
  if (includeOnes) t += 15 * 4;
  return t;
}

function maxBid() {
  return totalCountersInDeck();
}

function isShootMoonBid(n) {
  const v = parseInt(n, 10);
  return !!(shootMoonEnabled && Number.isFinite(v) && v === maxBid());
}

function teamScoreForSeat(seat) {
  const i = Number(seat);
  const team = (players[i] && typeof players[i].team === 'number')
    ? players[i].team
    : (Number.isFinite(i) ? i % 2 : 0);
  const scores = (game && game.scores) || [0, 0];
  return Number(scores[team] || 0);
}

function moonBidAllowed(seat) {
  // A negative score does not restrict Moon bids. getMatchResult owns the losing threshold.
  return !!shootMoonEnabled;
}

function bidCeilingFor(seat) {
  const cap = maxBid();
  if (shootMoonEnabled && !moonBidAllowed(seat)) return Math.max((minBid || 70), cap - 5);
  return cap;
}

/** Label used in the bidding UI when Shoot the Moon is on and the amount
 *  is every counter in the deck (often 200). */
function formatBidAmount(n, opts) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return String(n == null ? '' : n);
  if (isShootMoonBid(v)) {
    if (opts && opts.short) return 'Moon ' + v;
    return 'Shoot the moon ' + v;
  }
  return String(v);
}

function auctionHigh() {
  const raw = game && game.highestBid != null ? game.highestBid : (game && game.bid);
  const n = parseInt(raw, 10);
  if (Number.isFinite(n)) return n;
  return (parseInt(minBid, 10) || 100) - 5;
}

function auctionNextMin() {
  return auctionHigh() + 5;
}

// highestBid begins at minBid - 5 as an auction threshold. Only a selected
// bidder makes that sentinel a real, displayable high bid.
function hasActualHighBid() {
  return !!(game && game.bidder >= 0 && Number(game.highestBid) > 0);
}


function saveSession() {
  if (isSoloPractice || roomCode === 'OFFLINE') {
    try { sessionStorage.removeItem('rookSession'); } catch (e) {}
    return;
  }
  if (window._horIntentionalLeave) return;
  try {
    sessionStorage.setItem('rookSession', JSON.stringify({
      roomCode, myName, isHost, isSpectator, myPeerId
    }));
  } catch (e) {}
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem('rookSession');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}



// UI elements
const $ = id => document.getElementById(id);



const lobby = $('lobby');
const waiting = $('waiting');
const welcome = $('welcome');
const gameScreen = $('game');

let pendingWelcomeSeat = null;
let joinedFromWelcome = false;
let pendingPreviewJoin = false;

function welcomeVisible() {
  return !!(welcome && !welcome.classList.contains('hidden'));
}

// Keep an active table view stable across transient PeerJS reconnects.
// A reconnect can deliver a fresh `welcome` packet before the authoritative
// `state` packet; that packet must never send an already-playing client back
// to the welcome/lobby UI.
function horMarkActiveTable(active) {
  try {
    if (active) sessionStorage.setItem('rookActiveTable', '1');
    else sessionStorage.removeItem('rookActiveTable');
  } catch (e) {}
}
function horHasActiveTable() {
  try { return sessionStorage.getItem('rookActiveTable') === '1'; } catch (e) { return false; }
}
function horClientIsPlaying() {
  if (document.body && document.body.classList.contains('in-game')) return true;
  return !!(game && game.phase && !['lobby','waiting',''].includes(game.phase));
}


function hideWelcomeScreen() {
  if (welcome) {
    welcome.classList.add('hidden');
    welcome.classList.remove('seated', 'watching');
  }
  try { document.body.classList.remove('at-welcome'); } catch (e) {}
}

function phoneLooksOffline() {
  try { return typeof navigator !== 'undefined' && navigator.onLine === false; } catch (e) { return false; }
}
function noServiceJoinMessage() {
  return 'This phone is offline (no cell data and no working Wi‑Fi). Turn on Wi‑Fi or data to join. The first handshake needs a little internet, even when both phones are in the same house.';
}
function stopNetworkRetries() {
  // Cancel only retry timers. Do NOT destroy an existing Peer/DataConnection here.
  // Mobile browsers can briefly report navigator.onLine=false while WebRTC is
  // still usable or recovering; tearing the Peer down made that transient state
  // destructive. Explicit leave/offline-practice paths own connection teardown.
  window._horNoServiceStop = true;
  try {
    (window._horNetRetryTimers || []).forEach((t) => clearTimeout(t));
  } catch (e) {}
  window._horNetRetryTimers = [];
}
function hideNoServiceModal() {
  const el = $('noServiceModal');
  if (!el) return;
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
}
function offerOfflinePlay(detail) {
  stopNetworkRetries();
  const msg = noServiceJoinMessage();
  try { setJoinStatus(msg); } catch (e) {}
  const el = $('noServiceModal');
  const text = $('noServiceText');
  if (text) text.textContent = detail || msg;
  if (el) {
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  } else if (confirm(msg + '\n\nPlay offline against three bots?')) {
    try { startSoloPractice(); } catch (e2) {}
  }
}
function bindNoServiceModal() {
  const go = $('noServiceOfflineBtn');
  const stay = $('noServiceStayBtn');
  if (go && !go.dataset.bound) {
    go.dataset.bound = '1';
    go.onclick = () => {
      hideNoServiceModal();
      try { startSoloPractice(); } catch (e) {}
    };
  }
  if (stay && !stay.dataset.bound) {
    stay.dataset.bound = '1';
    stay.onclick = () => hideNoServiceModal();
  }
}
function scheduleNetRetry(fn, ms) {
  if (phoneLooksOffline() || window._horNoServiceStop) {
    offerOfflinePlay();
    return;
  }
  const id = setTimeout(() => {
    if (phoneLooksOffline()) { offerOfflinePlay(); return; }
    try { fn(); } catch (e) {}
  }, ms);
  window._horNetRetryTimers = (window._horNetRetryTimers || []).concat([id]);
}
function brokerRetryMessage() {
  if (phoneLooksOffline()) return noServiceJoinMessage();
  return 'Can’t reach the table directory right now. Checking another path… Use Wi‑Fi or cell data if this phone has neither.';
}

function setJoinStatus(msg) {
  const text = String(msg || '');
  const lobbyS = $('lobbyStatus');
  if (lobbyS) lobbyS.textContent = text;
  const welcomeS = $('welcomeStatus');
  if (welcomeS) welcomeS.textContent = text;
}

let horSplashTimer = null;
function hideInviteSplash() {
  const el = $('horSplash');
  if (!el) return;
  el.classList.add('is-out');
  setTimeout(() => {
    el.classList.add('hidden');
    el.classList.remove('is-out');
    el.setAttribute('aria-hidden', 'true');
  }, 380);
  if (horSplashTimer) { clearTimeout(horSplashTimer); horSplashTimer = null; }
}
function showInviteSplash() {
  const el = $('horSplash');
  if (!el) return;
  el.classList.remove('hidden', 'is-out');
  el.setAttribute('aria-hidden', 'false');
  const btn = $('horSplashBtn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.onclick = () => {
      try { playClickSound(); } catch (e) {}
      hideInviteSplash();
    };
  }
  if (horSplashTimer) clearTimeout(horSplashTimer);
  horSplashTimer = setTimeout(hideInviteSplash, 2800);
}
function welcomeHowText() {
  return 'Type your name, then tap a chair. You can sit in any open seat, or replace a bot — that bot moves to the chair you left (or any other open seat). You cannot take a seat that already has a person in it.';
}

function showWelcomeScreen(code) {
  if (window._horStayInGame || isSoloPractice || horClientIsPlaying() || horHasActiveTable()) {
    horDebugLog('skip showWelcomeScreen — table is live');
    return;
  }
  setLobbyPortraitOrientation();
  try { hideCelePage(); } catch (e) {}
  if (lobby) lobby.classList.add('hidden');
  if (waiting) waiting.classList.add('hidden');
  if (gameScreen) gameScreen.classList.add('hidden');
  if (welcome) welcome.classList.remove('hidden');
  try {
    document.body.classList.remove('in-game');
    document.body.classList.add('at-table', 'at-welcome');
    setTimeout(syncLandscapeFullscreen, 50);
  } catch (e) {}
  const c = String(code || roomCode || '').trim().toUpperCase();
  const codeEl = $('welcomeCode');
  if (codeEl) codeEl.textContent = c;
  const lead = $('welcomeLead');
  if (lead) lead.textContent = c ? ('A friend invited you to table ' + c + '.') : 'A friend shared this table with you.';
  const how = $('welcomeHow');
  if (how && !welcome.classList.contains('seated') && !welcome.classList.contains('watching')) {
    how.textContent = welcomeHowText();
  }
  const feltSt = $('welcomeFeltStatus');
  if (feltSt && !playerAtSeat(0) && !playerAtSeat(1) && !playerAtSeat(2) && !playerAtSeat(3)) {
    feltSt.textContent = 'Loading who is already seated…';
  }
  const nameIn = $('welcome-player-name');
  const lobbyName = $('hor-player-name');
  if (nameIn && lobbyName && lobbyName.value && !nameIn.value) nameIn.value = lobbyName.value;
  if (nameIn && !isSpectator && myIndex < 0) {
    try { nameIn.focus(); } catch (e) {}
  }
  const st = $('welcomeStatus');
  if (st && !st.textContent) st.textContent = 'Enter your name, then tap a chair.';
  try { updateWelcomeSeats(); } catch (e) {}
  try { requestTablePreview(); } catch (e) {}
}

function requestTablePreview() {
  if (isHost) {
    try { updateWelcomeSeats(); } catch (e) {}
    return;
  }
  const code = String(roomCode || (($('hor-room-code') && $('hor-room-code').value) || '')).trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return;
  roomCode = code;
  const codeInput = $('hor-room-code');
  if (codeInput && !codeInput.value) codeInput.value = code;
  joinedFromWelcome = true;
  if (hostConnection && hostConnection.open) {
    try { hostConnection.send({ type: 'peekTable', id: myPeerId }); } catch (e) {}
    setJoinStatus('Table connected. Seats below are live — type your name, then tap a chair.');
    try { updateWelcomeSeats(); } catch (e) {}
    return;
  }
  if (joinInProgress || peer) return;
  pendingPreviewJoin = true;
  isSpectator = true;
  setJoinStatus('Connecting to see who is already seated…');
  try { joinRoom(); } catch (e) {
    setJoinStatus('Could not load seats yet. You can still type your name and tap a chair.');
  }
}

function updateWelcomeSeats() {
  if (!welcomeVisible()) return;
  const teamA = (typeof teamLabel === 'function') ? teamLabel(0) : 'Griffin';
  const teamB = (typeof teamLabel === 'function') ? teamLabel(1) : 'Raven';
  const labels = ['Bottom', 'Left', 'Top', 'Right'];
  let mySeat = -1;
  for (let s = 0; s < 4; s++) {
    const el = $('welcomeSeat' + s);
    if (!el) continue;
    const p = playerAtSeat(s);
    if (p && !p.isBot) try { refreshHumanPersona(p); } catch (e) {}
    el.classList.toggle('occupied', !!p);
    el.classList.toggle('is-me', !!(p && p.id === myPeerId));
    el.classList.toggle('is-bot', !!(p && p.isBot));
    if (p && p.isBot && p.name) el.setAttribute('data-botname', p.name); else el.removeAttribute('data-botname');
    if (p && p.id === myPeerId) mySeat = s;
    if (p) {
      const tag = p.isHost ? 'Host' : (p.isBot ? 'Bot' : (p.id === myPeerId ? 'You' : 'Sat'));
      const face = p.avatar ? '<img class="wait-seat-av" src="' + avatarSrc(p.avatar) + '" alt="">' : '';
      let extra = tag + ' · ' + (s % 2 === 0 ? teamA : teamB);
      if (p.isBot && !isSpectator && !(p.id === myPeerId)) extra = 'Bot · tap to replace (bot moves)';
      el.innerHTML = face
        + '<span class="wait-seat-name"><span class="wait-seat-name-text">' + escapeHtmlSafe(p.name) + '</span>' + horCareerBadgeHtml(p) + '</span>'
        + '<span class="wait-seat-tag">' + extra + '</span>';
      try { horBindCareerBadges(el); } catch (e) {}
    } else if (isSpectator) {
      el.innerHTML = '<span class="wait-seat-name">Open</span><span class="wait-seat-tag">Empty seat</span>';
    } else if (myPeerId && players.some(pl => pl && pl.id === myPeerId && pl.seat >= 0)) {
      el.innerHTML = '<span class="wait-seat-name">Open</span><span class="wait-seat-tag">Tap to move here</span>';
    } else {
      el.innerHTML = '<span class="wait-seat-name">' + labels[s] + '</span><span class="wait-seat-tag">Tap to sit here</span>';
    }
  }
  const how = $('welcomeHow');
  const feltSt = $('welcomeFeltStatus');
  if (isSpectator) {
    if (welcome) {
      welcome.classList.add('watching');
      welcome.classList.remove('seated');
    }
    if (how) how.textContent = 'You are watching this table. You are now waiting on the host to start the game.';
    if (feltSt) feltSt.textContent = 'Watching — seats fill as friends sit';
  } else if (mySeat >= 0) {
    if (welcome) {
      welcome.classList.add('seated');
      welcome.classList.remove('watching');
    }
    if (how) how.textContent = 'You are in the ' + labels[mySeat].toLowerCase() + ' chair. You can tap a different empty seat to move. You are now waiting on the host to start the game.';
    if (feltSt) feltSt.textContent = 'Waiting on the host to start';
  } else {
    if (welcome) welcome.classList.remove('seated', 'watching');
    if (how) how.textContent = welcomeHowText();
    if (feltSt) feltSt.textContent = 'Tap an empty seat to sit';
  }
}

function dismissJoinKeyboard() {
  try {
    const ids = ['welcome-player-name', 'hor-player-name', 'hor-room-code'];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      try { el.blur(); } catch (e) {}
    });
    const ae = document.activeElement;
    if (ae && ae.blur && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      try { ae.blur(); } catch (e) {}
    }
    if (document.body) {
      document.body.setAttribute('tabindex', '-1');
      try { document.body.focus(); } catch (e) {}
    }
    try { window.scrollTo(0, 0); } catch (e) {}
  } catch (e) {}
}

function welcomeJoin(asSpectator, seat) {
  joinedFromWelcome = true;
  if (asSpectator) {
    pendingWelcomeSeat = null;
    isSpectator = true;
    const nameEl = $('welcome-player-name');
    const name = ((nameEl && nameEl.value) || '').trim();
    const lobbyName = $('hor-player-name');
    if (lobbyName) lobbyName.value = name || 'Watcher';
    dismissJoinKeyboard();
    const codeInput = $('hor-room-code');
    if (codeInput && roomCode && !codeInput.value) codeInput.value = roomCode;
    if (hostConnection && hostConnection.open) {
      setJoinStatus('Already at the table — watching.');
      try { updateWelcomeSeats(); } catch (e) {}
      return;
    }
    try {
      joinRoom();
      saveSession();
    } catch (e) {
      console.error(e);
      setJoinStatus('Error: ' + (e && e.message ? e.message : e));
    }
    return;
  }

  const nameEl = $('welcome-player-name');
  const name = ((nameEl && nameEl.value) || '').trim();
  if (!name) {
    if (nameEl) { try { nameEl.focus(); } catch (e) {} }
    setJoinStatus('Type your name first, then tap the seat you want.');
    return;
  }
  if (typeof seat === 'number') {
    const occ = playerAtSeat(seat);
    if (occ && occ.id === myPeerId) {
      setJoinStatus('You are already in that seat.');
      return;
    }
    if (occ && !occ.isBot) {
      setJoinStatus('That chair is taken. Tap an open seat or a bot.');
      return;
    }
    pendingWelcomeSeat = seat;
    try { playClickSound(); } catch (e) {}
  }
  const lobbyName = $('hor-player-name');
  if (lobbyName) lobbyName.value = name;
  dismissJoinKeyboard();
  const codeInput = $('hor-room-code');
  if (codeInput && roomCode && !codeInput.value) codeInput.value = roomCode;
  isSpectator = false;

  if (hostConnection && hostConnection.open && myPeerId && typeof pendingWelcomeSeat === 'number') {
    pendingPreviewJoin = false;
    isSpectator = false;
    try { hostConnection.send({ type: 'claimSeat', seat: pendingWelcomeSeat, id: myPeerId, name: name }); } catch (e) {}
    setJoinStatus('Moving to that seat…');
    return;
  }
  try {
    joinRoom();
    saveSession();
  } catch (e) {
    console.error(e);
    setJoinStatus('Error: ' + (e && e.message ? e.message : e));
  }
}
const rulesModal = $('rulesModal');

// ========== Utility ==========
function shortCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Page URL of this uploaded copy (origin + path). Used so Share/QR send friends here. */
function isHostedHttp() {
  try {
    const p = location.protocol || '';
    return p === 'http:' || p === 'https:';
  } catch (e) { return false; }
}

/** QR/share-link only works on a public https site. Local Wi‑Fi / file / LAN IPs encode a URL the other phone cannot open. */
function isPrivateOrLocalHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[[^\]]+\]$/, (m) => m.slice(1, -1));
  if (!h || h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(h)) return true;
  return false;
}

function canShareJoinQr() {
  try {
    if ((location.protocol || '') !== 'https:') return false;
    return !isPrivateOrLocalHost(location.hostname);
  } catch (e) {
    return false;
  }
}

function applyWaitingShareMode() {
  const qrOk = canShareJoinQr();
  const qrBtn = $('showQrBtn');
  const qrBox = $('qrBox');
  const hint = $('nearbyHintWaiting');
  const speak = $('speakCodeLine');
  const copyBtn = $('copyCodeBtn');
  const shareBtn = $('shareBtn');
  document.body.classList.toggle('wifi-join-only', !qrOk);
  if (qrBtn) {
    qrBtn.classList.toggle('hidden', !qrOk);
    qrBtn.setAttribute('aria-hidden', qrOk ? 'false' : 'true');
  }
  if (qrBox && !qrOk) {
    qrBox.classList.add('hidden');
    try { document.body.classList.remove('qr-open'); } catch (e) {}
  }
  if (copyBtn) {
    copyBtn.classList.toggle('hidden', qrOk);
    copyBtn.setAttribute('aria-hidden', qrOk ? 'true' : 'false');
    copyBtn.tabIndex = qrOk ? -1 : 0;
    if (!qrOk) copyBtn.textContent = 'Copy code';
  }
  if (shareBtn) shareBtn.textContent = qrOk ? 'Invite friends' : 'Share code';
  if (speak) {
    speak.textContent = qrOk
      ? 'Share this code or QR. Friends tap an open seat to sit.'
      : 'Read this code out loud. Friends open House of Rooks on their own phone and join with the code.';
  }
  if (hint) {
    hint.textContent = qrOk
      ? 'Same website + this table code. Keep this tab open.'
      : 'QR will not work here — it would send a phone-only link the other person cannot open. Guest: Join with a code → type the 4 letters → Take Your Seat.';
  }
}

function gamePageUrl() {
  try {
    if (!canShareJoinQr()) return '';
    const u = new URL(location.href);
    u.hash = '';
    u.search = '';
    let href = u.origin + u.pathname;
    if (!href || href === 'null' || href.indexOf('file:') === 0) return '';
    return href;
  } catch (e) {
    const raw = String(location.href || '').split('?')[0].split('#')[0];
    return /^https?:/i.test(raw) ? raw : '';
  }
}

function joinLink(code) {
  const c = String(code || roomCode || '').trim().toUpperCase();
  const base = gamePageUrl();
  if (!c) return base;
  const sep = base.indexOf('?') >= 0 ? '&' : '?';
  return base + sep + 'room=' + encodeURIComponent(c);
}

/** PeerJS cloud id — namespaced so short table codes don't collide with other apps. */
function peerRoomId(code) {
  const c = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c ? ('hor' + c) : '';
}

// ========== Peer / Networking ==========
// Forcibly clears any cached copy of the app and reloads fresh. Used when
// a version mismatch is detected against a connected peer (host or joiner
// running older cached code), so that side self-corrects instead of the
// person needing to know to manually clear their browser data.
// ========== Debug logging panel (toggle in Options > Experimental Polish) ==========
// Kept fully inert unless explicitly enabled — see the 'debugPanel' entry in
// polish.js's experimental flags. Useful for diagnosing multiplayer/connection
// issues on a device without access to browser devtools (e.g. some mobile
// browsers).
let horDebugEntries = [];
function horDebugLog(msg) {
  if (!(window.horExperimental && window.horExperimental.debugPanel)) return;
  try {
    const d = new Date();
    const ts = d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    const line = ts + '  ' + msg;
    console.log('[HOR DEBUG]', line);
    horDebugEntries.push(line);
    if (horDebugEntries.length > 400) horDebugEntries.shift();
    horEnsureDebugUI();
    horRenderDebugPanel();
  } catch (e) {}
}
function horRenderDebugPanel() {
  const panel = document.getElementById('horDebugPanel');
  if (!panel) return;
  panel.textContent = horDebugEntries.join('\n');
  panel.scrollTop = panel.scrollHeight;
}
function horEnsureDebugUI() {
  if (document.getElementById('horDebugToggle')) return;
  const style = document.createElement('style');
  style.id = 'horDebugStyle';
  style.textContent = `
    #horDebugToggle { position:fixed; bottom:8px; left:8px; z-index:999999; width:36px; height:36px; border-radius:50%;
      background:rgba(0,0,0,0.65); color:#3f3; font-size:17px; display:flex; align-items:center; justify-content:center;
      border:1px solid #3f3; cursor:pointer; }
    #horDebugPanel { position:fixed; bottom:52px; left:8px; right:8px; max-height:42vh; overflow-y:auto;
      background:rgba(0,0,0,0.92); color:#3f3; font:11px/1.45 monospace; padding:8px; border-radius:6px;
      z-index:999999; white-space:pre-wrap; display:none; }
    #horDebugPanel.show { display:block; }
    #horDebugClear { position:fixed; bottom:8px; left:52px; z-index:999999; background:rgba(0,0,0,0.65); color:#3f3;
      border:1px solid #3f3; border-radius:6px; padding:8px 12px; font-size:12px; display:none; cursor:pointer; }
    #horDebugClear.show { display:block; }
  `;
  document.head.appendChild(style);
  const toggle = document.createElement('div');
  toggle.id = 'horDebugToggle';
  toggle.textContent = '\u{1F41E}';
  document.body.appendChild(toggle);
  const panel = document.createElement('div');
  panel.id = 'horDebugPanel';
  document.body.appendChild(panel);
  const clearBtn = document.createElement('div');
  clearBtn.id = 'horDebugClear';
  clearBtn.textContent = 'Clear';
  document.body.appendChild(clearBtn);
  toggle.addEventListener('click', () => {
    panel.classList.toggle('show');
    clearBtn.classList.toggle('show');
  });
  clearBtn.addEventListener('click', () => { horDebugEntries = []; horRenderDebugPanel(); });
  horRenderDebugPanel();
}
function horRemoveDebugUI() {
  ['horDebugToggle', 'horDebugPanel', 'horDebugClear', 'horDebugStyle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}
window.horEnsureDebugUI = horEnsureDebugUI;
window.horRemoveDebugUI = horRemoveDebugUI;

function horForceUpdate() {
  window.__horUpdating = true;
  // Preserve the exact viewport position so tapping Force Refresh does not
  // make the page appear to jump before/after the cache refresh.
  try {
    sessionStorage.setItem('horForceRefreshView', JSON.stringify({
      x: window.scrollX || 0,
      y: window.scrollY || 0,
      room: new URL(location.href).searchParams.get('room') || ''
    }));
  } catch (e) {}
  let dest = 'index.html?fresh=' + Date.now() + '&v=' + APP_VERSION;
  try {
    const url = new URL(horThisIndex());
    url.searchParams.set('fresh', String(Date.now()));
    url.searchParams.set('v', APP_VERSION);
    dest = url.toString();
  } catch (e) {}
  const reloadFresh = () => {
    try { window.location.replace(dest); } catch (e) { window.location.href = dest; }
  };
  const tasks = [];
  if ('caches' in window) {
    tasks.push(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
  if ('serviceWorker' in navigator) {
    tasks.push(navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))));
  }
  const timer = setTimeout(reloadFresh, 1200);
  Promise.all(tasks).catch(() => {}).then(() => {
    clearTimeout(timer);
    reloadFresh();
  });
}
window.horForceUpdate = horForceUpdate;

// Restore the viewport after a manual Force Refresh. Use two animation frames
// so mobile browsers finish their first layout before the position is applied.
(function horRestoreForceRefreshView() {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem('horForceRefreshView') || 'null');
    sessionStorage.removeItem('horForceRefreshView');
  } catch (e) {}
  if (!saved) return;
  const restore = () => {
    try { window.scrollTo(saved.x || 0, saved.y || 0); } catch (e) {}
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => requestAnimationFrame(restore)), { once: true });
  } else {
    requestAnimationFrame(() => requestAnimationFrame(restore));
  }
})();

const PEER_BROKERS = [
  // Rook520: restore the exact signaling endpoint used by the known-good
  // Rook386 multiplayer path.  The default PeerJS constructor path introduced
  // later could open a guest peer while the named host id was not discoverable.
  { host: '0.peerjs.com', port: 443, path: '/', secure: true, label: 'PeerJS Cloud' }
];
let horPeerBrokerIndex = 0;
let horHostCreateInProgress = false;
let horHostCreateWatchdog = null;
// A single lobby operation owns pending callbacks; leaving cancels that ownership.
let horLobbyOperation043 = 0;
let horLobbyCancel043 = null;
function horCancelLobbyOperation043() {
  ++horLobbyOperation043;
  try { if (horLobbyCancel043) horLobbyCancel043(); } catch (_) {}
  horLobbyCancel043 = null;
  horClearHostCreateWatchdog(); horSetHostCreateBusy(false);
  joinInProgress = false;
}


function horSetHostCreateBusy(busy, message) {
  horHostCreateInProgress = !!busy;
  const status = $('lobbyStatus');
  if (status && message != null) status.textContent = message;
  ['friendsToggleBtn', 'createBtn'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.disabled = !!busy;
    el.setAttribute('aria-busy', busy ? 'true' : 'false');
  });
}

function horClearHostCreateWatchdog() {
  if (horHostCreateWatchdog) clearTimeout(horHostCreateWatchdog);
  horHostCreateWatchdog = null;
}

let horForceRelayIce = false;

function horIceConfig() {
  // Keep the connection configuration conservative.  The old build forced
  // retries through third-party TURN credentials that are not controlled by
  // Griffin House; when those relays reject a request the join can never
  // recover.  PeerJS Cloud signaling + standard STUN is the stable baseline.
  return {
    iceCandidatePoolSize: 4,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };
}

function peerOptions(broker, forceRelay) {
  const b = broker || PEER_BROKERS[0];
  return {
    host: b.host,
    port: b.port,
    path: b.path || '/',
    secure: b.secure !== false,
    debug: 1,
    pingInterval: 4000,
    config: horIceConfig(forceRelay)
  };
}

function horNextBroker() {
  return PEER_BROKERS[0];
}


let horPeerLoadPromise = null;
function horEnsurePeerJS() {
  if (typeof Peer !== 'undefined') return Promise.resolve(true);
  if (horPeerLoadPromise) return horPeerLoadPromise;
  const sources = [
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js'
  ];
  horPeerLoadPromise = new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (typeof Peer !== 'undefined') { resolve(true); return; }
      if (i >= sources.length) {
        horPeerLoadPromise = null;
        reject(new Error('PeerJS could not be loaded from either multiplayer source.'));
        return;
      }
      const s = document.createElement('script');
      s.src = sources[i++] + '?hor=' + APP_VERSION;
      s.async = true;
      let settled = false;
      const complete = () => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        if (typeof Peer !== 'undefined') resolve(true);
        else { try { s.remove(); } catch (_) {} next(); }
      };
      const timeout = setTimeout(complete, 6000);
      s.onload = complete; s.onerror = complete;
      document.head.appendChild(s);
    };
    next();
  });
  return horPeerLoadPromise;
}

function createRoom(retryCount = 0) {
  if (horHostCreateInProgress || joinInProgress) return;
  if (isHost && peer && peer.open && !peer.destroyed && !window._horHandoffSnapshot) { showWaiting(); return; }
  window._horIntentionalLeave = false;
  window._horNoServiceStop = false;
  isSoloPractice = false;
  // A saved activity flag is not a live table. An explicit host action from
  // the lobby must recover even from sessions left behind by older builds.
  if (!horClientIsPlaying()) {
    horMarkActiveTable(false);
    window._horStayInGame = false;
  }
  const token = ++horLobbyOperation043;
  const active = () => token === horLobbyOperation043 && !window._horIntentionalLeave && !isSoloPractice;
  horSetHostCreateBusy(true, 'Creating table…');
  myName = ($('hor-player-name').value || '').trim() || 'Host';
  if (typeof Peer === 'undefined') {
    $('lobbyStatus').textContent = 'Loading multiplayer…';
    horEnsurePeerJS().then(() => {
      if (!active()) return;
      horSetHostCreateBusy(false); createRoom(retryCount);
    }).catch(e => {
      if (!active()) return;
      horSetHostCreateBusy(false, 'Could not load multiplayer. Please try again. ' + e.message);
    });
    return;
  }
  roomCode = shortCode();
  isHost = true;
  $('lobbyStatus').textContent = 'Creating table…';
  let hostPeer;
  try {
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    const opts = peerOptions();
    horDebugLog('HOST: creating peer on broker ' + opts.host + ' code=' + roomCode);
    peer = hostPeer = new Peer(peerRoomId(roomCode), opts);
  } catch (e) {
    console.error(e);
    horSetHostCreateBusy(false, 'Could not create table: ' + e.message);
    isHost = false; return;
  }

  const current = () => active() && peer === hostPeer;
  const cleanup = () => {
    try { hostPeer.destroy(); } catch (_) {}
    if (peer === hostPeer) peer = null;
  };
  horLobbyCancel043 = cleanup;
  horClearHostCreateWatchdog();
  horHostCreateWatchdog = setTimeout(() => {
    if (!current() || hostPeer.open) return;
    cleanup(); isHost = false; horLobbyCancel043 = null;
    horSetHostCreateBusy(false, 'Multiplayer did not respond. Check your connection and try again.');
  }, 12000);
  let opened = false;
  hostPeer.on('open', id => {
    if (!current() || opened) return;
    opened = true;
    horClearHostCreateWatchdog(); horSetHostCreateBusy(false); horLobbyCancel043 = null;
    horDebugLog('HOST: peer open, id=' + id + ', room code=' + roomCode);
    myPeerId = id;
    if (window._horHandoffSnapshot) {
      try { finishHostHandoff(id); } catch (e) { console.error(e); }
      return;
    }
    players = [{ id, name: myName, team: 0, isHost: true, isBot: false, seat: 0, avatar: ensurePreferredAvatar() || AVATARS[0], voice: loadPreferredVoice(), careerPublic: horMyCareerProfile() }];
    applyPreferredAvatarToMe();
    myIndex = 0;
    beerSeats = pickBeerSeats();
    showWaiting();
    saveSession();
    try { window.dispatchEvent(new CustomEvent('hor-table-ready', {detail:{code:roomCode}})); } catch (_) {}
    if ($('lobbyStatus')) $('lobbyStatus').textContent = '';
    if ($('waitingStatus')) {
      $('waitingStatus').textContent = canShareJoinQr()
        ? 'Table is live. Friends open this website and join with the code.'
        : 'Table is live. Friends join with this code on their own phone.';
    }
    // Give the public broker a moment to actually register the id
    // before guests start connecting — a common PeerJS race.
    try { peer.socket && peer.socket.send && peer.socket.send({ type: 'HEARTBEAT' }); } catch (e) {}
  });


  hostPeer.on('connection', conn => {
    if (!current()) { try { conn.close(); } catch (_) {} return; }
    horDebugLog('HOST: incoming connection event, remote peer=' + conn.peer);
    setupConn(conn);
  });

  // The Peer's connection to the signaling server can drop in the
  // background (mobile browsers throttling long-lived sockets, brief
  // network blips) without the Peer object itself being destroyed.
  // PeerJS exposes this via the 'disconnected' event and a matching
  // reconnect() method — without this, the room would silently stop
  // being joinable while the UI still showed the host screen normally.
  hostPeer.on('disconnected', () => {
    if (!current()) return;
    console.warn('Host peer disconnected from signaling server, attempting reconnect…');
    horDebugLog('HOST: peer disconnected from signaling server, attempting reconnect…');
    try { hostPeer.reconnect(); } catch (e) {}
  });

  hostPeer.on('error', err => {
    if (!current()) return;
    const type = err && err.type;
    horClearHostCreateWatchdog();
    // Once this peer opened, the local table already owns its game. Mobile
    // background suspension can set peer.open=false while signaling recovers.
    // Creation retries must never recreate that table or demote its host.
    if (opened) {
      horDebugLog('HOST: established table keeps local authority after signaling error: ' + type);
      horSetHostCreateBusy(false);
      try { if (hostPeer.disconnected && !hostPeer.destroyed) hostPeer.reconnect(); } catch (_) {}
      return;
    }
    if (!hostPeer.open && retryCount < 2 && ['unavailable-id','network','server-error','socket-error','socket-closed'].includes(type)) {
      cleanup();
      horSetHostCreateBusy(true, 'Retrying table connection…');
      horHostCreateWatchdog = setTimeout(() => {
        if (!active()) return;
        horSetHostCreateBusy(false); createRoom(retryCount + 1);
      }, 350);
    } else {
      if (!hostPeer.open) { cleanup(); isHost = false; horLobbyCancel043 = null; }
      horSetHostCreateBusy(false, 'Multiplayer error: ' + ((err && (err.type || err.message)) || 'unknown') + '. Please try again.');
    }
  });
}


function joinRoom() {
  // One tap owns this handshake; another tap must not tear it down.
  if (joinInProgress) return;
  if (horHostCreateInProgress) { setJoinStatus('Creating your table…'); return; }
  const code = ($('hor-room-code').value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return alert('Enter a room code');
  if (phoneLooksOffline()) { setJoinStatus(noServiceJoinMessage()); return; }
  if (!isHost && hostConnection && hostConnection.open && roomCode === code) {
    setJoinStatus('Already connected to table ' + code + '.'); return;
  }
  window._horIntentionalLeave = false;
  window._horNoServiceStop = false;
  isSoloPractice = false;
  myName = ($('hor-player-name').value || '').trim() || 'Player';
  roomCode = code; isHost = false; joinInProgress = true;
  const token = ++horLobbyOperation043;
  const active = () => token === horLobbyOperation043 && !window._horIntentionalLeave && !isSoloPractice;
  setJoinStatus('Connecting to table ' + code + '…');
  if (typeof Peer === 'undefined') {
    horEnsurePeerJS().then(() => {
      if (!active()) return;
      joinInProgress = false; joinRoom();
    }).catch(e => {
      if (!active()) return;
      joinInProgress = false; setJoinStatus('Could not load multiplayer. Please try again. ' + e.message);
    });
    return;
  }
  let joinPeer;
  try {
    if (peer) { try { peer.destroy(); } catch (_) {} }
    peer = joinPeer = new Peer(undefined, peerOptions());
  } catch (e) {
    joinInProgress = false; setJoinStatus('Could not start multiplayer: ' + e.message); return;
  }
  let finished = false, joined = false, joinTimer = null, retryTimer = null;
  let joinTries = 0;
  const maxJoinTries = 3;
  const current = () => active() && peer === joinPeer;
  const clearTimers = () => { clearTimeout(joinTimer); clearTimeout(retryTimer); };
  const finishFailure = message => {
    if (finished || !current()) return;
    finished = true; clearTimers();
    // Close while initial join still owns the transport, so it cannot trigger
    // the established-table reconnect loop on this failed attempt.
    try { if (horJoinConn) horJoinConn.close(); } catch (_) {}
    horJoinConn = null; hostConnection = null;
    try { joinPeer.destroy(); } catch (_) {}
    if (peer === joinPeer) peer = null;
    joinInProgress = false; setJoinStatus(message);
  };
  horLobbyCancel043 = () => {
    finished = true; clearTimers();
    try { if (horJoinConn) horJoinConn.close(); } catch (_) {}
    horJoinConn = null; hostConnection = null;
    try { joinPeer.destroy(); } catch (_) {}
    if (peer === joinPeer) peer = null;
  };
  const queueRetry = () => {
    if (finished || !current() || retryTimer) return;
    clearTimeout(joinTimer);
    if (joinTries >= maxJoinTries) {
      finishFailure('Could not link to table ' + code + '. Check the code, keep the host screen open, and try again. If the network blocks direct connections, try a different Wi-Fi or cell-data connection.'); return;
    }
    const previous = horJoinConn;
    horJoinConn = null; if (hostConnection === previous) hostConnection = null;
    try { if (previous) previous.close(); } catch (_) {}
    setJoinStatus('Still connecting to table ' + code + '… retrying (' + (joinTries + 1) + '/' + maxJoinTries + ').');
    retryTimer = setTimeout(() => { retryTimer = null; tryConnect(); }, 350);
  };
  const tryConnect = () => {
    if (finished || !current()) return;
    clearTimeout(joinTimer); joinTries++;
    setJoinStatus('Linking to table ' + code + '… (' + joinTries + '/' + maxJoinTries + ')');
    let conn;
    try {
      conn = joinPeer.connect(peerRoomId(code), {
        reliable:true, serialization:'json', label:'hor-table', metadata:{app:'hor',v:APP_VERSION}
      });
      horJoinConn = conn; hostConnection = conn; setupConn(conn);
    } catch (e) { queueRetry(); return; }
    const currentConnection = () => !finished && current() && horJoinConn === conn;
    conn.on('open', () => {
      if (!currentConnection()) return;
      const joinMsg = {type:'join',name:myName,id:myPeerId,spectator:!!isSpectator,avatar:ensurePreferredAvatar()||AVATARS[0],voice:loadPreferredVoice(),appVersion:APP_VERSION,reconnect:true};
      if (pendingPreviewJoin) joinMsg.preview = true;
      if (!isSpectator && typeof pendingWelcomeSeat === 'number' && pendingWelcomeSeat >= 0 && pendingWelcomeSeat <= 3) joinMsg.preferredSeat = pendingWelcomeSeat;
      if (!horNetSendRaw(conn, joinMsg)) {
        finishFailure('Connection opened but the join message could not be sent. Please try again.'); return;
      }
      joined = finished = true; clearTimers(); joinInProgress = false;
      horLobbyCancel043 = null;
      setJoinStatus('Connected. Waiting for the host…');
    });
    conn.on('error', () => { if (currentConnection()) queueRetry(); });
    conn.on('close', () => { if (currentConnection()) queueRetry(); });
    joinTimer = setTimeout(() => { if (currentConnection()) queueRetry(); }, 8000);
  };
  // Signaling can fail to emit either open or error. Bound that silent wait too.
  joinTimer = setTimeout(() => finishFailure('Multiplayer did not respond. Check your connection and try again.'), 12000);
  joinPeer.on('open', id => {
    if (!current() || finished) return;
    clearTimeout(joinTimer); myPeerId = id;
    // The host is already registered; no mandatory 700 ms delay before linking.
    tryConnect();
  });
  joinPeer.on('disconnected', () => {
    if (!current() || (finished && !joined)) return;
    try { joinPeer.reconnect(); } catch (_) {}
  });
  joinPeer.on('error', err => {
    if (!current() || finished) return;
    if (err && err.type === 'peer-unavailable') queueRetry();
    else finishFailure('Multiplayer error: ' + ((err && (err.type || err.message)) || 'unknown') + '. Please try again.');
  });
}

function horNetSendRaw(conn, msg) {
  if (!conn || !conn.open) return false;
  try {
    // IMPORTANT: call the ORIGINAL, unwrapped send here — not conn.send.
    // setupConn() replaces conn.send with a wrapper that routes through
    // horNetSend -> horNetSendRaw. Calling conn.send from in here would
    // recurse infinitely (swallowed by this try/catch) and never transmit.
    const rawSend = conn.__horRawSend || conn.send.bind(conn);
    rawSend(msg);
    return true;
  } catch (e) {
    horDebugLog('horNetSendRaw failed: ' + (e && e.message));
    return false;
  }
}

function horNetSend(conn, msg) {
  if (!msg || typeof msg !== 'object') return horNetSendRaw(conn, msg);
  if (!msg._sentAt) msg._sentAt = Date.now();
  return horNetSendRaw(conn, msg);
}

function horNewActionId(kind) {
  return String(kind || 'act') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function horRememberAction(data) {
  if (!horExpOn('netTurnGuard') && !horExpOn('netDuplicateGuard') && !horExpOn('netAuthoritative')) return false;
  if (!game || !data) return false;
  const aid = data.actionId;
  if (!aid) return false;
  game.__seenActions = game.__seenActions || {};
  const sig = aid + '|' + String(data.player) + '|' + String(game.phase) + '|' + String(game.currentPlayer) + '|' + String(data.cardId || data.value || data.color || '');
  if (game.__seenActions[sig]) return true;
  game.__seenActions[sig] = Date.now();
  const keys = Object.keys(game.__seenActions);
  if (keys.length > 80) {
    keys.slice(0, keys.length - 60).forEach((k) => { delete game.__seenActions[k]; });
  }
  return false;
}

function horQueueClientAction(msg) {
  if (!msg || typeof msg !== 'object') return false;
  if (horExpOn('netTurnGuard') || horExpOn('netDuplicateGuard') || horExpOn('netActionQueue') || horExpOn('netAuthoritative')) {
    if (!msg.actionId) msg.actionId = horNewActionId(msg.type || 'act');
  }
  if (!horExpOn('netActionQueue')) {
    if (hostConnection && hostConnection.open) return !!horNetSend(hostConnection, msg);
    return false;
  }
  horOutbox = horOutbox.filter((m) => m.type !== msg.type);
  horOutbox.push(msg);
  if (horOutbox.length > 12) horOutbox = horOutbox.slice(-12);
  return horFlushOutbox();
}

function horFlushOutbox() {
  if (isHost || !hostConnection || !hostConnection.open) return false;
  let sent = 0;
  const leftover = [];
  horOutbox.forEach((msg) => {
    if (horNetSend(hostConnection, msg)) sent += 1;
    else leftover.push(msg);
  });
  horOutbox = leftover;
  return sent > 0;
}

function horWatchIce(conn, onBad) {
  try {
    const pc = conn && conn.peerConnection;
    if (!pc || pc.__horIceWatch) return;
    pc.__horIceWatch = true;
    const check = () => {
      const ice = pc.iceConnectionState || '';
      const cs = pc.connectionState || '';
      horDebugLog('ICE ' + ice + ' / pc ' + cs + ' peer=' + (conn && conn.peer));
      if (ice === 'failed' || ice === 'disconnected' || cs === 'failed' || cs === 'disconnected') {
        if (typeof onBad === 'function') onBad(ice || cs);
      }
    };
    pc.addEventListener('iceconnectionstatechange', check);
    pc.addEventListener('connectionstatechange', check);
  } catch (e) {}
}

function setupConn(conn) {
  if (!conn) return;
  if (conn.__horWrapped) {
    if (isHost && conn.peer) connMap[conn.peer] = conn;
    if (!isHost) hostConnection = conn;
    return;
  }
  horDebugLog((isHost ? 'HOST' : 'CLIENT') + ': setupConn() wiring up connection, remote peer=' + (conn && conn.peer));
  conn.__horWrapped = true;
  conn.__horRawSend = conn.send.bind(conn);
  conn.send = function(msg) { return horNetSend(conn, msg); };
  conn.on('data', data => {
    horDebugLog((isHost ? 'HOST' : 'CLIENT') + ': data received, type=' + (data && data.type));
    horLastHostSeenAt = Date.now();
    if (conn && conn.peer) horPeerLastSeen[conn.peer] = Date.now();
    try {
      handleMessage(data, conn);
    } catch (e) {
      console.error('handleMessage threw:', e);
      horDebugLog('!!! EXCEPTION in handleMessage: ' + (e && e.message));
    }
  });
  conn.on('error', err => {
    console.error('Data connection error:', err);
    horDebugLog((isHost ? 'HOST' : 'CLIENT') + ': data connection error: ' + (err && (err.type || err.message)));
    if (!isHost && joinInProgress) {
      const s = $('lobbyStatus');
      if (s) s.textContent = 'Connection error: ' + (err && (err.type || err.message) || 'unknown');
    } else if (!isHost && !joinInProgress && horExpOn('netReconnect')) {
      horToast('Connection hiccup — holding your seat…');
      horBeginClientReconnect();
    }
  });
  conn.on('close', () => {
    horDebugLog((isHost ? 'HOST' : 'CLIENT') + ': connection closed, remote peer=' + (conn && conn.peer));
    if (isHost) {
      const peerId = conn.peer;
      if (connMap[peerId] === conn) delete connMap[peerId];
      const seated = players.find(p => p && p.id === peerId && !p.isBot);
      if (seated && game && game.phase && game.phase !== 'lobby' && game.phase !== 'waiting') {
        hostStartDisconnectGrace(peerId);
      } else if (seated && (!game || game.phase === 'lobby' || game.phase === 'waiting')) {
        players = players.filter(p => p.id !== peerId);
        broadcast({ type: 'players', players: publicPlayersSnapshot() });
        updateWaitingUI();
      }
    } else {
      if (joinInProgress) return;
      if (hostConnection === conn) hostConnection = null;
      if (horExpOn('netReconnect')) {
        horToast('Connection lost — reconnecting…');
        horBeginClientReconnect();
      } else {
        try { alert('Disconnected from host'); } catch (e) {}
      }
    }
  });
  if (horExpOn('netIceWatch')) {
    horWatchIce(conn, () => {
      if (isHost) return;
      if (joinInProgress) return;
      if (hostConnection && hostConnection.open) return;
      if (horExpOn('netReconnect')) horBeginClientReconnect();
    });
  }
  if (isHost && conn.peer) connMap[conn.peer] = conn;
  if (!isHost) hostConnection = conn;
}

function sendTo(peerId, msg) {
  const c = connMap[peerId];
  if (c && c.open) return c.send(msg);
  return false;
}
function broadcast(msg, exceptId = null) {
  for (const [id, c] of Object.entries(connMap)) {
    if (id !== exceptId && c && c.open) c.send(msg);
  }
}
function horToast(text) {
  if(window.HORRavenFight741?.deferCelebration(()=>horToast(text)))return;
  let el = document.getElementById('horNetworkToast');
  if (!el) {
    el = document.createElement('div'); el.id = 'horNetworkToast'; el.className = 'hor-network-toast';
    document.body.appendChild(el);
  }
  el.classList.toggle('bid-guidance805',/bid.*(?:viewing|details)|details.*bidding/i.test(text));
  if(el.classList.contains('bid-guidance805')){
    const dock=document.getElementById('decisionConsole');
    const r=dock?.getBoundingClientRect();
    el.style.setProperty('--bid-guidance-bottom',r&&r.height?Math.max(12,innerHeight-r.top+10)+'px':'28vh');
  }
  el.textContent = text; el.classList.add('show');
  (window.HORRavenFight741?.stopClock||clearTimeout)(el.__t); el.__t = (window.HORRavenFight741?.later||setTimeout)(() => el.classList.remove('show'), 2600);
}
function horBeginClientReconnect() {
  if (!horExpOn('netReconnect')) return;
  if (isHost || isSoloPractice || !roomCode || roomCode === 'OFFLINE') return;
  if (hostConnection && hostConnection.open) {
    horReconnectActive = false;
    return;
  }
  if (horReconnectActive) return;
  horReconnectActive = true;
  horReconnectAttempt = 0;
  const step = () => {
    if (isHost || isSoloPractice || roomCode === 'OFFLINE') { horReconnectActive = false; return; }
    if (hostConnection && hostConnection.open) { horReconnectActive = false; horReconnectAttempt = 0; return; }
    horReconnectAttempt++;
    if (horReconnectAttempt > 20) {
      horReconnectActive = false;
      horToast('Still disconnected. Use Rejoin with the table code.');
      return;
    }
    horToast('Reconnecting… attempt ' + horReconnectAttempt);
    const delay = horExpOn('netBackoff')
      ? Math.min(20000, 800 * Math.pow(1.7, Math.max(0, horReconnectAttempt - 1)))
      : 1500;
    clearTimeout(horReconnectTimer);
    horReconnectTimer = setTimeout(() => {
      try {
        if (hostConnection && hostConnection.open) { horReconnectActive = false; return; }
        if (phoneLooksOffline() || window._horNoServiceStop) {
          horReconnectActive = false;
          offerOfflinePlay();
          return;
        }
        if (!peer || !peer.open) {
          try { if (peer && peer.disconnected) peer.reconnect(); } catch (e) {}
          setTimeout(step, 1500);
          return;
        }
        const c = peer.connect(peerRoomId(roomCode), { reliable: true, serialization: 'json' });
        if (!c) { step(); return; }
        setupConn(c);
        hostConnection = c;
        c.on('open', () => {
          horReconnectActive = false;
          horReconnectAttempt = 0;
          horLastHostSeenAt = Date.now();
          horNetSend(c, {
            type: 'join',
            name: myName,
            id: myPeerId,
            spectator: !!isSpectator,
            avatar: ensurePreferredAvatar(),
            voice: loadPreferredVoice(),
            reconnect: true,
            appVersion: APP_VERSION,
            lastSeq: horLastAppliedSeq
          });
          horFlushOutbox();
          horToast('Reconnected to the table ✓');
        });
        setTimeout(() => { if (!c.open && horReconnectActive) step(); }, 7000);
      } catch (e) { step(); }
    }, delay);
  };
  step();
}
function horStartHeartbeat() {
  clearInterval(horHeartbeatTimer);
  if (!horExpOn('netHeartbeat') && !horExpOn('netSilentDropDetect') && !horExpOn('netReconnect')) return;
  horHeartbeatTimer = setInterval(() => {
    horPingSentAt = Date.now();
    window.horLastPingMs = horLastPingMs;
    if (isSoloPractice || roomCode === 'OFFLINE') return;
    if (isHost) {
      if (horExpOn('netHeartbeat')) broadcast({ type: '__hor_ping', at: horPingSentAt });
      if (horExpOn('netSilentDropDetect')) {
        try {
          players.forEach((p) => {
            if (!p || p.isBot || p.isHost || p.disconnected) return;
            const c = connMap[p.id];
            const seen = horPeerLastSeen[p.id] || 0;
            if (c && c.open && seen && Date.now() - seen > 20000) {
              horDebugLog('HOST: peer silent 20s ' + p.id);
            }
            if ((!c || !c.open) && game && game.phase && game.phase !== 'lobby' && game.phase !== 'waiting') {
              hostStartDisconnectGrace(p.id);
            }
          });
        } catch (e) {}
      }
      try {
        if (phoneLooksOffline() || window._horNoServiceStop || isSoloPractice) {
          /* do not keep pinging the broker with no service */
        } else if (peer && peer.disconnected) peer.reconnect();
      } catch (e) {}
    } else if (horExpOn('netHeartbeat') && hostConnection && hostConnection.open) {
      hostConnection.send({ type: '__hor_ping', at: horPingSentAt });
    }
    if (horExpOn('netReconnect') && !isHost && horLastHostSeenAt && Date.now() - horLastHostSeenAt > 8000) {
      if (!hostConnection || !hostConnection.open) horBeginClientReconnect();
    }
  }, 3000);
}
horStartHeartbeat();

// ========== Message handling ==========
function handleMessage(data, conn) {
  if (data && data.type === '__hor_ping') { try { conn && conn.send({ type:'__hor_pong', at:data.at }); } catch(e) {} return; }
  if (data && data.type === '__hor_pong') { horLastHostSeenAt = Date.now(); if (data.at) horLastPingMs = Math.max(0, Date.now() - Number(data.at)); return; }
  if (isHost) {
    switch (data.type) {
      case 'join':
        horDebugLog('HOST: processing join from name=' + data.name + ' id=' + data.id + ' spectator=' + !!data.spectator + ' appVersion=' + data.appVersion);
        // If we know the joiner's version and it doesn't match ours, tell
        // them plainly and don't seat them — this catches a stale cached
        // copy on either side instead of it failing in some more confusing
        // way further into the handshake. Whichever side has the LOWER
        // version number is the stale one and should be the one to
        // self-update — it used to always be the joiner that got told to
        // refresh, even when the host itself was the outdated copy, which
        // just bounced a fully up-to-date joiner in an endless loop while
        // the actual stale host sat untouched.
        if (data.appVersion && data.appVersion !== APP_VERSION) {
          const hostIsStale = horVersionNum(APP_VERSION) < horVersionNum(data.appVersion);
          conn.send({ type: 'versionMismatch', hostVersion: APP_VERSION, yourVersion: data.appVersion, hostIsStale });
          horDebugLog('HOST: version mismatch (host=' + APP_VERSION + ' joiner=' + data.appVersion + '), hostIsStale=' + hostIsStale);
          if (hostIsStale) {
            // We're the one running old code — update ourselves instead of
            // making the up-to-date joiner reload forever against us.
            setTimeout(horForceUpdate, 1500);
          }
          return;
        }
        // Same PeerJS id coming back (reconnect during grace). Refresh the
        // DataConnection and resync instead of dropping the join on the floor.
        const already = players.find(p => p && p.id === data.id);
        if (already && !data.spectator && horExpOn('netSameIdResync')) {
          already.disconnected = false;
          already.name = data.name || already.name;
          hostCancelDisconnectGrace(data.id);
          connMap[data.id] = conn;
          horPeerLastSeen[data.id] = Date.now();
          hostResyncClient(conn, data.id);
          break;
        }
        if (data.preview || data.peek) {
          connMap[data.id || conn.peer] = conn;
          conn.send({
            type: 'welcome',
            players: publicPlayersSnapshot(),
            yourId: data.id,
            spectator: true,
            preview: true,
            beerSeats,
            hostVersion: APP_VERSION,
            settings: { includeRed2, red2Points, targetScore, botDifficulty, layDownWinningCards, revealTopNest, experimental: window.horExperimental || {} },
          });
          try { conn.send({ type: 'players', players: publicPlayersSnapshot(), beerSeats }); } catch (e) {}
          break;
        }
        if (data.spectator) {
          // Spectator: watch only, do not take a seat
          conn.send({
            type: 'welcome',
            players: publicPlayersSnapshot(),
            yourId: data.id,
            spectator: true,
            hostVersion: APP_VERSION,
            settings: { includeRed2, red2Points, targetScore, botDifficulty, layDownWinningCards, revealTopNest, experimental: window.horExperimental || {} },
          });
          if (game) {
            // send current public state if mid-game
            conn.send({
              type: 'state',
              phase: game.phase,
              scores: game.scores,
              bid: game.bid,
              bidder: game.bidder,
              trump: game.trump,
              trumpVoiceEvent790: game.trumpVoiceEvent790 || null, trumpVoiceRestore790: true,
              currentPlayer: game.currentPlayer,
              trick: game.trick,
              ledColor: game.ledColor,
              players: players.map(p => ({ name: p.name, team: p.team, id: p.id, isBot: !!p.isBot, avatar: p.avatar || playerAvatars[p.id] || '', voice: p.isBot ? 'avatar' : validHumanVoice(p.voice), careerPublic: p.careerPublic || null })),
              dealer: game.dealer,
              nestCount: game.nest?.length || 0,
              handsCount: game.hands.map(h => h.length),
              targetScore: game.targetScore || targetScore,
            });
          }
          break;
        }
        // Reclaim temp-bot seat after disconnect/leave
        if (game && hostTryReclaimSeat(conn, data)) {
          break;
        }
        if (seatedCount() >= 4) {
          if (hostTryReclaimSeat(conn, data)) break;
          if (!game || game.phase === 'lobby' || game.phase === 'waiting') {
            const want = parseInt(data.preferredSeat, 10);
            const occ = (!isNaN(want) && want >= 0 && want <= 3) ? playerAtSeat(want) : null;
            // Full table: only a bot seat can be taken. Relocate that bot if
            // another chair opens during claim; otherwise the bot leaves.
            if (!(occ && occ.isBot) && !players.some(p => p && p.isBot)) {
              if (horExpOn('spectatorLateJoin')) {
                data.spectator = true;
              } else {
                conn.send({ type: 'error', message: 'Room full — join as spectator instead' });
                return;
              }
            }
          } else if (horExpOn('spectatorLateJoin')) {
            data.spectator = true;
          } else {
            conn.send({ type: 'error', message: 'Room full — join as spectator instead' });
            return;
          }
        }
        if (data.spectator) {
          conn.send({
            type: 'welcome',
            players: publicPlayersSnapshot(),
            yourId: data.id,
            spectator: true,
            hostVersion: APP_VERSION,
            settings: { includeRed2, red2Points, targetScore, botDifficulty, layDownWinningCards, revealTopNest, experimental: window.horExperimental || {} }
          });
          break;
        }
        if (players.find(p => p.id === data.id)) {
          return;
        }
        players.push({ id: data.id, name: data.name, team: 0, isHost: false, isBot: false, seat: -1, avatar: humanAvatarAllowed783(avatarKey(data.avatar)) ? avatarKey(data.avatar) : AVATARS[0], voice: validHumanVoice(data.voice), careerPublic: null });
        if (data.id) playerAvatars[data.id] = humanAvatarAllowed783(avatarKey(data.avatar)) ? avatarKey(data.avatar) : AVATARS[0];
        const wantSeat = parseInt(data.preferredSeat, 10);
        let seatedOk = false;
        if (!isNaN(wantSeat) && wantSeat >= 0 && wantSeat <= 3) {
          seatedOk = hostClaimSeat(wantSeat, data.id);
        }
        if (!seatedOk) {
          // Stay standing until they pick an open chair or a bot. Do not
          // auto-assign a seat — already seated humans must keep showing
          // in the chairs they claimed.
          broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats });
          updateWaitingUI();
        }
        conn.send({
          type: 'welcome',
          players: publicPlayersSnapshot(),
          yourId: data.id,
          beerSeats,
          hostVersion: APP_VERSION,
          settings: { includeRed2, red2Points, targetScore, botDifficulty, revealTopNest, experimental: window.horExperimental || {} },
        });
        try { conn.send({ type: 'players', players: publicPlayersSnapshot(), beerSeats }); } catch (e) {}
        break;


      case 'careerProfile': {
        const p=(players||[]).find(x=>x&&x.id===data.id);
        if(p&&!p.isBot){p.careerPublic=data.profile&&data.profile.enabled?data.profile:null;broadcast({type:'careerProfile',id:p.id,profile:p.careerPublic},p.id);broadcast({type:'players',players:publicPlayersSnapshot(),beerSeats});}
        break;
      }
      case 'careerAnnouncement':
        if(data.event){broadcast({type:'careerAnnouncement',from:data.from,event:data.event},data.from);horCareerAnnouncement(data.event);}
        break;

      case 'bid':
        if (game && game.phase === 'bidding') hostProcessBid(data);
        break;
      case 'discard':
        if (game && game.phase === 'discard') hostProcessDiscard(data);
        break;
      case 'requestDiscardState':
        if (game && game.phase === 'discard') hostSendDiscardStart(data.player, data.peerId);
        break;
      case 'trump':
        if (game && game.phase === 'trump') hostProcessTrump(data);
        break;
      case 'play':
        if (game && game.phase === 'play') hostProcessPlay(data);
        break;
      case 'claimAllTrumps':
        if (game && game.phase === 'play') hostProcessAllTrumpsClaim(data);
        break;
      case 'declineClaim':
        if (game && game.phase === 'play') hostDeclineClaim(data.player);
        break;
      case 'avatar': {
        const sender = conn && conn.peer;
        if (sender && data.id === sender && changeHumanAvatar777(sender, data.avatar || data.emoji || AVATARS[0], data.voice, data.name)) {
          publishAvatarIdentities777();
        } else if (conn && conn.send) {
          conn.send({type:'error',message:'That avatar is unavailable. Please choose another.'});
        }
        break;
      }
      case 'leaveReplace':
        hostReplaceWithBot(data.playerId || conn.peer, data.name);
        break;
      case 'readyNext':
        if (game && game.phase === 'score') hostStartNextHand();
        break;
      case 'requestRematch':
        hostStartRematch();
        break;
      case 'requestWaiting':
        hostReturnToWaiting();
        break;
      case 'claimSeat':
        hostAdmitAndClaim(data.seat, data.id || (conn && conn.peer), data.name);
        break;
      case 'peekTable':
        try {
          conn.send({ type: 'players', players: publicPlayersSnapshot(), beerSeats });
        } catch (e) {}
        break;
      case 'newHostReady':
        broadcast({ type: 'switchHost', roomCode: data.roomCode, hostName: data.hostName });
        setTimeout(() => { try { horFollowNewHost(data.roomCode); } catch (e) {} }, 500);
        break;
    }
  } else {
    // Client receives state from host
    switch (data.type) {
      case 'players':
        applyPlayersSnapshot(data.players);
        // Seat order can change when the host packs the table.  Never keep
        // the old array index on a client: the human may have moved from
        // join-order index 1 to table seat/index 2 (the host's partner seat).
        // Recompute our index from the stable peer id so bidding/action turns
        // continue to target the correct human player.
        if (!isSpectator && myPeerId) {
          const nextMyIndex = players.findIndex(p => p && p.id === myPeerId);
          if (nextMyIndex >= 0) myIndex = nextMyIndex;
        }
        if (Array.isArray(data.beerSeats)) beerSeats = data.beerSeats;
        updateWaitingUI();
        break;
      case 'whisper':
        if (data.toId === myPeerId || data.fromId === myPeerId || data.to === myIndex || data.from === myIndex) {
          showTableMsgPopup((data.name || 'Player') + (data.to === myIndex ? ' (private)' : ' → you'), data.text);
        }
        break;
      case 'welcome':
        horDebugLog('CLIENT: welcome received, yourId=' + data.yourId + ', players=' + (data.players ? data.players.length : 0) + ', hostVersion=' + data.hostVersion);
        if (data.hostVersion && data.hostVersion !== APP_VERSION) {
          const s = $('lobbyStatus');
          const weAreStale = horVersionNum(APP_VERSION) < horVersionNum(data.hostVersion);
          if (weAreStale) {
            if (horClientIsPlaying() || horHasActiveTable()) {
              if (s) s.textContent = 'Update available; staying at the table until this hand is finished.';
            } else {
              if (s) s.textContent = 'This device is running an outdated version. Updating automatically…';
              setTimeout(horForceUpdate, 1500);
            }
          } else if (s) {
            s.textContent = 'The host appears to be on an older version. Ask them to reopen the app, then try again.';
          }
          break;
        }
        applyPlayersSnapshot(data.players);
        if (Array.isArray(data.beerSeats)) beerSeats = data.beerSeats;
        pendingPreviewJoin = !!(pendingPreviewJoin || data.preview);
        if (data.preview) {
          // Preview keeps the joiner standing so occupied chairs can render
          // while they type a name. Do not lock them into spectator mode.
          if (typeof pendingWelcomeSeat !== 'number') isSpectator = false;
        }
        if (data.spectator && !data.preview) {
          isSpectator = true;
          myIndex = -1;
        } else {
          myIndex = players.findIndex(p => p.id === data.yourId);
        }
        if (data.settings) {
          includeRed2 = !!data.settings.includeRed2;
          if (data.settings.red2Points) red2Points = data.settings.red2Points;
          if (data.settings.targetScore) targetScore = normalizeTargetScore(data.settings.targetScore);
          if (typeof data.settings.layDownWinningCards === 'boolean') layDownWinningCards = data.settings.layDownWinningCards;
          if (typeof data.settings.revealTopNest === 'boolean') revealTopNest = data.settings.revealTopNest;
          if (typeof data.settings.comebackSpecialChance === 'boolean') comebackSpecialChance = data.settings.comebackSpecialChance;
        }
        // Never navigate an already-playing client back to the welcome/lobby
        // screen just because PeerJS delivered a reconnect `welcome` packet.
        // The authoritative `state` packet will follow and refresh the table.
        const activeTable = horClientIsPlaying() || horHasActiveTable();
        if (!activeTable && (!horExpOn('netResyncOnReclaim') || !data.reclaimed || !game || game.phase === 'lobby' || game.phase === 'waiting')) {
          if (joinedFromWelcome || welcomeVisible() || data.preview || pendingPreviewJoin) {
            showWelcomeScreen(roomCode);
            try { updateWelcomeSeats(); } catch (e) {}
            const seatedN = seatedCount();
            setJoinStatus(seatedN
              ? (seatedN + ' seated. Type your name, then tap an open seat or a bot.')
              : 'Table is empty. Type your name, then tap a chair.');
          } else {
            showWaiting();
          }
        }
        saveSession();
        try { horFlushOutbox(); } catch (e) {}
        break;

      case 'versionMismatch': {
        const s = $('lobbyStatus');
        // Only refresh ourselves if we're actually the stale side. If the
        // host already told us it's the one that's outdated (hostIsStale),
        // it is already reloading itself — refreshing here too would just
        // race it and loop. Wait and let the host come back.
        if (data.hostIsStale) {
          if (s) s.textContent = 'The host is on an older version and is updating now — retrying the join…';
          joinInProgress = false;
          setTimeout(() => { try { joinRoom(); } catch (e) {} }, 4000);
        } else {
          if (s) s.textContent = 'This device is running an outdated version. Updating automatically…';
          setTimeout(horForceUpdate, 1500);
        }
        break;
      }

      case 'error':
        alert(data.message);
        break;
      case 'gameStart':
      case 'state':
        applyState(data);
        break;
      case 'privateHand':
        if (game) {
          if (data.animateDeal && Array.isArray(data.hand) && data.hand.length) {
            runDealPresentation(data.hand, () => {
              game.myHand = data.hand;
              try { renderHand(false); } catch (e) {}
              try { scheduleTopNestFlip(); } catch (e) {}
              if (game.phase === 'bidding' && game.currentPlayer === myIndex && !nestAuctionLocked()) showBidUI();
              else if (game.phase === 'trump' && game.bidder === myIndex) showTrumpUI();
            });
            break;
          }
          game.myHand = data.hand;
          const discarding = game.phase === 'discard' && game.bidder === myIndex;
          renderHand(discarding);
          if (discarding) {
            // Don't flash kitty again or wipe selection — only ensure panel + confirm exist
            showDiscardUI(false);
            fitHandToScreen();
          } else if (game.phase === 'bidding' && game.currentPlayer === myIndex) showBidUI();
          else if (game.phase === 'trump' && game.bidder === myIndex) showTrumpUI();
        }
        break;
      case 'discardStart':
        if (!game) game = {};
        game.phase = 'discard';
        if (typeof data.bidder === 'number') game.bidder = data.bidder;
        if (typeof data.discardCount === 'number') game.discardCount = data.discardCount;
        if (Array.isArray(data.nestPreview)) {
          game.nestPreview = data.nestPreview.map((c) => {
            try { return (typeof hydrateNestCard === 'function') ? hydrateNestCard(c) : { ...c }; }
            catch (e) { return { ...c }; }
          }).filter(Boolean);
          game.kittyTaken = game.nestPreview.map((c) => ({ ...c }));
        }
        if (data.topNestCard) game.topNestCard = { ...data.topNestCard };
        if (Array.isArray(data.hand) && data.hand.length) game.myHand = data.hand.map(c => ({ ...c }));
        if (game.bidder === myIndex || data.peerId === myPeerId) {
          const flowKey = discardFlowIdentity(game.myHand || [], game.bidder);
          const sameFlow = window._discardFlowKey === flowKey;
          if (!sameFlow) {
            window._discardFlowKey = flowKey;
            window._discardPage = data.showKitty && (game.kittyTaken || []).length ? 'kitty' : 'select';
            window._discardKittyShown = false;
            window._discardSubmitting = false;
            window._discardStartReceived = false;
            window.selectedForDiscard = new Set();
            window._discardPickStep = 0;
          } else if (!window._discardStartReceived && data.showKitty && (game.kittyTaken || []).length) {
            // A private-hand packet can arrive just before discardStart.
            // The first discardStart still owns the Kitty → selection order.
            window._discardPage = 'kitty';
            window._discardKittyShown = false;
            window._discardSubmitting = false;
            window.selectedForDiscard = new Set();
            window._discardPickStep = 0;
          }
          window._discardStartReceived = true;
          showDiscardUI(window._discardPage === 'kitty');
          try { renderHand(true); } catch (e) {}
          fitHandToScreen();
        }
        break;
      case 'discardRejected': {
        window._discardSubmitting = false;
        const needed = (data && data.needed) || (game && game.discardCount) || 5;
        const btn = $('confirmDiscard');
        if (btn) {
          const selected = window.selectedForDiscard?.size || 0;
          btn.disabled = selected !== needed;
          btn.textContent = document.querySelector('#discardOverlay.gh-discard-page')
            ? 'Confirm Discard'
            : `Confirm Discard (${selected}/${needed})`;
        }
        const ma = $('messageArea');
        if (ma) ma.textContent = (data && data.message) || `Select exactly ${needed} cards to discard`;
        if (Array.isArray(data.hand) && data.hand.length && game) {
          game.myHand = data.hand.map(c => ({ ...c }));
          try { showDiscardUI(false); } catch (e) {}
        }
        break;
      }
      case 'discardOk':
        try { clearTimeout(window._discardAckTimer); } catch (e) {}
        hideDiscardOverlay();
        if (game && Array.isArray(data.hand)) game.myHand = data.hand.map(c => ({ ...c }));
        break;

      case 'tableToast':
        playTableToast();
        break;
      case 'message': {
        const subject=data.event==='trick-winner'?captureSubject793(data.winnerName,data.winnerId):null;
        $('messageArea').textContent = subject?'🏆 '+subject.name+subject.win+' the trick!':data.text;
        break;
      }
      case 'tableMsg':
        showTableMsgPopup(data.name, data.text);
        break;
      case 'specialCapture':
        try {
          // Remote players receive the same short viewing pause before the
          // celebration, keeping all screens consistent.
          setTimeout(() => {
            try { queueCaptureCelebrations(data.kinds || data.kind || [], data.winnerName || ''); } catch (e) {}
          }, 850);
        } catch (e) {}
        break;
      case 'biddingIntro':
        try { showBiddingIntro(null, data.minBid); } catch (e) {}
        break;
      case 'settings':
        if (data.experimental && window.horExperimental) {
          // Testing tab flags stay local so each device can isolate a switch.
          const incomingExp = Object.assign({}, data.experimental);
          Object.keys(incomingExp).forEach((k) => {
            if (k.indexOf('net') === 0 || k === 'lobbyReconnect' || k === 'debugPanel') delete incomingExp[k];
          });
          window.horExperimental = Object.assign({}, window.horExperimental, incomingExp);
          try { window.applyHorExperimental && window.applyHorExperimental(); } catch(e) {}
        }
        includeRed2 = !!data.includeRed2;
        if (data.red2Points) red2Points = data.red2Points;
        if (typeof data.includeRed1 === 'boolean') includeRed1 = data.includeRed1;
        if (typeof data.includeOnes === 'boolean') includeOnes = data.includeOnes;
        if (typeof data.onesHigh === 'boolean') onesHigh = data.onesHigh;
        if (typeof data.includeRook === 'boolean') includeRook = data.includeRook;
        if (typeof data.rookLowest === 'boolean') rookLowest = data.rookLowest;
        if (typeof data.specialsAnytime === 'boolean') specialsAnytime = data.specialsAnytime;
        if (typeof data.mustTrumpWhenVoid === 'boolean') mustTrumpWhenVoid = data.mustTrumpWhenVoid;
        if (typeof data.bidOnlyScoring === 'boolean') bidOnlyScoring = data.bidOnlyScoring;
        if (data.nestGoesTo) nestGoesTo = data.nestGoesTo;
        if (data.leadOrder) leadOrder = data.leadOrder;
        if (typeof data.misdealOnNoCounters === 'boolean') misdealOnNoCounters = data.misdealOnNoCounters;
        if (typeof data.screwTheDealer === 'boolean') screwTheDealer = data.screwTheDealer;
        if (typeof data.comebackSpecialChance === 'boolean') comebackSpecialChance = data.comebackSpecialChance;
        if (typeof data.openWidow === 'boolean') openWidow = data.openWidow;
        if (typeof data.revealTopNest === 'boolean') revealTopNest = data.revealTopNest;
        if (typeof data.forceNestReveal === 'string') forceNestReveal = data.forceNestReveal;
        if (typeof data.shootMoonEnabled === 'boolean') shootMoonEnabled = data.shootMoonEnabled;
        if (data.botSpeed) botSpeed = data.botSpeed;
        if (typeof data.partnerNeverKill === 'boolean') partnerNeverKill = data.partnerNeverKill;
        if (typeof data.partnerFeedLast === 'boolean') partnerFeedLast = data.partnerFeedLast;
        if (typeof data.dontStealPartnerBid === 'boolean') dontStealPartnerBid = data.dontStealPartnerBid;
        if (typeof data.landscapeBidHints === 'boolean') landscapeBidHints = data.landscapeBidHints;
        if (typeof data.nestLastTrickAnim === 'boolean') nestLastTrickAnim = data.nestLastTrickAnim;
        if (typeof data.layDownWinningCards === 'boolean') layDownWinningCards = data.layDownWinningCards;
        if (data.handSortMode) handSortMode = normalizeHandSortMode(data.handSortMode);
        if (data.timeoutPolicy) timeoutPolicy = data.timeoutPolicy;
        if (typeof data.turnTimeSec === 'number') turnTimeSec = data.turnTimeSec;
        if (data.minBid) minBid = data.minBid;

        if (data.handSize) handSize = data.handSize;
        if (data.nestSizeDefault) nestSizeDefault = data.nestSizeDefault;
        if (data.targetScore) {
          targetScore = normalizeTargetScore(data.targetScore);
          const td = $('targetDisplay');
          if (td) td.textContent = String(targetScore);
        }
        if (data.botDifficulty) botDifficulty = data.botDifficulty;
        try { recomputeHandAndNest(); } catch (e) {}
        try { syncOptionsUI(); } catch (e) {}
        break;

      case 'careerProfile': {
        const p=(players||[]).find(x=>x&&x.id===data.id);if(p)p.careerPublic=data.profile&&data.profile.enabled?data.profile:null;
        if(game&&Array.isArray(game.players)){const gp=game.players.find(x=>x&&x.id===data.id);if(gp)gp.careerPublic=data.profile&&data.profile.enabled?data.profile:null;}
        try{renderUI();}catch(e){}
        break;
      }
      case 'careerAnnouncement':
        if(data.event)horCareerAnnouncement(data.event);
        break;

      case 'avatar':
        if (data.id) playerAvatars[data.id] = data.avatar || data.emoji || AVATARS[0];
        try { renderUI(); } catch (e) {}
        break;
      case 'hostHandoff':
        if (data.snapshot) acceptHostHandoff(data.snapshot);
        break;
      case 'switchHost':
        if (data.roomCode) setTimeout(() => { try { horFollowNewHost(data.roomCode); } catch (e) {} }, 400);
        break;
      case 'pause':
        if (game) game.paused = !!data.paused;
        setPauseUI(!!data.paused);
        if (data.paused) {
          if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }
          const bar = $('turnTimerBar');
          if (bar) bar.classList.add('hidden');
        }
        break;
      case 'turnTimer':
        if (horExpOn('netTimerSync') && data.serverNow) window.horServerOffset = Number(data.serverNow) - Date.now();
        turnTimerEndsAt = data.endsAt || (Date.now() + (data.seconds || 30) * 1000);
        {
          const bar = $('turnTimerBar');
          if (bar) bar.classList.remove('hidden');
          if (turnTimerInterval) clearInterval(turnTimerInterval);
          turnTimerInterval = setInterval(updateTurnTimerUI, 250);
          updateTurnTimerUI();
        }
        break;
      case 'bidVoice801':
        window.HORBidVoice801?.receive(data);
        break;
      case 'moonHowl':
        window.HORMoonHowl?.play(data.id);
        break;
      case 'sfx':
        playSfx(data.name, { broadcastNet: false });
        break;

      case 'nestCapture':
        try {
          showNestCaptureAnimation(
            data.winnerName || 'Winner',
            data.cards || [],
            data.pts || 0
          );
        } catch (e) {}
        break;
      case 'handResult':
        if (data.history) handHistory = data.history;
        if (Array.isArray(data.matchTricks)) matchTricks = data.matchTricks;
        if (data.matchStats) matchStats = data.matchStats;
        if (Array.isArray(data.playerStats)) playerStats = data.playerStats;
        if (data.summary) {
          if(data.summary.careerEvent)horRecordCareerHand(data.summary.careerEvent);
          // Host already held the nest overlay; clients may still be watching it
          const stillNest = document.getElementById('ghNestAnim');
          if (stillNest) {
            setTimeout(() => {
              try { stillNest.classList.add('out'); } catch (e) {}
              setTimeout(() => { try { stillNest.remove(); } catch (e) {} }, 400);
              showScoreModal(data.summary);
            }, 200);
          } else {
            showScoreModal(data.summary);
          }
          const goal = (game && game.targetScore) || targetScore || 500;
          const finalScores = data.summary.scores || (game && game.scores) || [0, 0];
          const matchResult = getMatchResult(finalScores, goal);
          if (matchResult) {
            const winner = matchResult;
            try { mergeLifetimeStats(winner); } catch (e) {}
            showWinCelebration(winner, [...finalScores]);
          }
        }
        break;
      case 'hostGone':
        horMarkActiveTable(false);
        alert(data.message || 'Host disconnected. Game ended.');
        try { sessionStorage.removeItem('rookSession'); } catch (e) {}
        location.reload();
        break;
      case 'matchRematch':
        try { hideCelePage(); } catch (e) {}
        break;
      case 'returnWaiting':
        horMarkActiveTable(false);
        try { applyReturnToWaiting(); } catch (e) {}
        break;
      case 'matchHighlights':
        try {
          if (Array.isArray(data.matchTricks)) matchTricks = data.matchTricks;
          pendingCele = {
            winner: data.winner,
            scores: data.scores || [0, 0],
            highlights: data.highlights || null,
          };
        } catch (e) {}
        break;
    }
  }
}




// ========== UI Navigation ==========
function fadeSeatMugs(hide) {
  document.querySelectorAll('.seat-glass').forEach((el) => {
    el.classList.toggle('fade-out', !!hide);
  });
}

function showWaiting() {
  if (window._horStayInGame || (isSoloPractice && game && game.phase && game.phase !== 'waiting')) {
    horDebugLog('skip showWaiting — stay in game');
    return;
  }
  if (horClientIsPlaying() || horHasActiveTable()) {
    horDebugLog('skip showWaiting — table is live phase=' + (game && game.phase));
    return;
  }
  horDebugLog((isHost ? 'HOST' : 'CLIENT') + ': showWaiting() called, myIndex=' + myIndex + ', isSpectator=' + !!isSpectator);
  setLobbyPortraitOrientation();
  try { hideCelePage(); } catch (e) {}
  hideWelcomeScreen();
  lobby.classList.add('hidden');
  waiting.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  try { document.body.classList.remove('in-game'); document.body.classList.add('at-table'); } catch (e) {}
  setTimeout(syncLandscapeFullscreen, 50);
  const codeEl = $('displayCode');
  if (codeEl) codeEl.textContent = roomCode;
  try { applyWaitingShareMode(); } catch (e) {}
  fadeSeatMugs(false);
  updateWaitingUI();
  if (isHost) {
    const startBtn = $('startBtn');
    const hostOpts = $('hostOptions');
    if (startBtn) {
      startBtn.classList.remove('hidden');
      startBtn.disabled = seatedCount() !== 4;
    }
    const optBtn = $('openHostOptionsBtn');
    if (optBtn) optBtn.classList.remove('hidden');
    if (hostOpts) hostOpts.classList.remove('hidden');

    // Sync Red 2 options
    const cb = $('opt-include-red2');
    const ptsBox = $('opt-red2-points');
    if (cb) {
      cb.checked = includeRed2;
      if (ptsBox) ptsBox.style.display = includeRed2 ? 'block' : 'none';
      cb.onchange = () => {
        includeRed2 = cb.checked;
        if (ptsBox) ptsBox.style.display = includeRed2 ? 'block' : 'none';
        try { broadcast({ type: 'settings', includeRed2, red2Points }); } catch (e) {}
      };
    }
    document.querySelectorAll('input[name="red2pts"]').forEach(r => {
      r.checked = (parseInt(r.value, 10) === red2Points);
      r.onchange = () => {
        if (r.checked) {
          red2Points = parseInt(r.value, 10);
          try { broadcastPlaySettings(); } catch (e) {}
        }
      };
    });

    const bs = $('opt-bot-speed');
    if (bs) {
      bs.value = botSpeed;
      bs.onchange = () => {
        botSpeed = bs.value || 'normal';
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const bindCoach = (id, getter, apply) => {
      const el = $(id);
      if (!el) return;
      el.checked = !!getter();
      el.onchange = () => {
        apply(!!el.checked);
        try { broadcastPlaySettings(); } catch (e) {}
      };
    };
    bindCoach('opt-partner-never-kill', () => partnerNeverKill, v => { partnerNeverKill = v; });
    bindCoach('opt-partner-feed-last', () => partnerFeedLast, v => { partnerFeedLast = v; });
    bindCoach('opt-dont-steal-bid', () => dontStealPartnerBid, v => { dontStealPartnerBid = v; });
    bindCoach('opt-landscape-hints', () => landscapeBidHints, v => { landscapeBidHints = v; });
    bindCoach('opt-nest-anim', () => nestLastTrickAnim, v => { nestLastTrickAnim = v; });
    bindCoach('opt-lay-down', () => layDownWinningCards, v => { layDownWinningCards = v; });
    const hsm = $('opt-hand-sort');
    if (hsm) {
      hsm.value = normalizeHandSortMode(handSortMode);
      hsm.onchange = () => {
        handSortMode = normalizeHandSortMode(hsm.value);
        persistHandSortMode();
        try { if (game && game.myHand) renderHand(game.phase === 'discard' && game.bidder === myIndex); } catch (e) {}
      };
    }
    const mtv = $('opt-must-trump');
    if (mtv) {
      mtv.checked = !!mustTrumpWhenVoid;
      mtv.onchange = () => {
        mustTrumpWhenVoid = mtv.checked;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }

    
    const bdg = $('opt-bot-difficulty-ingame');
    if (bdg) {
      bdg.value = botDifficulty || 'extreme';
      bdg.onchange = () => {
        botDifficulty = bdg.value || 'extreme';
        if (botDifficulty === 'extreme') hideBotStyleTip();
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }

    const tts = $('opt-turn-time');
    if (tts) {
      tts.value = String(turnTimeSec);
      tts.onchange = () => {
        turnTimeSec = parseInt(tts.value, 10) || 0;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const top = $('opt-timeout-policy');
    if (top) {
      top.value = timeoutPolicy || 'auto';
      top.onchange = () => {
        timeoutPolicy = top.value || 'auto';
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const sc = $('opt-sound-card'); if (sc) { sc.checked = soundCard; sc.onchange = () => { soundCard = sc.checked; if(!soundCard){} }; }
    const st = $('opt-sound-turn'); if (st) { st.checked = soundTurn; st.onchange = () => { soundTurn = st.checked; try { localStorage.setItem('rookSoundTurn', soundTurn ? '1' : '0'); } catch (e) {} if (soundTurn) { try { playTurnSound(true); } catch (e) {} } }; }
    const sts = $('opt-turn-sound-choice');
    if (sts) {
      sts.value = String(turnSoundChoice);
      sts.onchange = () => {
        turnSoundChoice = Math.max(1, Math.min(20, parseInt(sts.value, 10) || 20));
        try { localStorage.setItem('rookTurnSoundChoice', String(turnSoundChoice)); } catch (e) {}
        try { playTurnSound(true); } catch (e) {}
      };
    }
    const sr = $('opt-sound-rook'); if (sr) { sr.checked = soundRook; sr.onchange = () => { soundRook = sr.checked; }; }
    const sk = $('opt-sound-tick'); if (sk) { sk.checked = soundTick; sk.onchange = () => { soundTick = sk.checked; }; }
    const avatarGrid = $('avatarGrid');
    if (avatarGrid) {
      avatarGrid.innerHTML = ['jerome_founder',...Object.keys(window.HORHumanAvatars||{})].map((id, i) => `<button type="button" class="avatar-choice" data-avatar="${id}" title="${AVATAR_LABELS[id]}"><img loading="lazy" src="${avatarSrc(id)}" alt="${AVATAR_LABELS[id]}"><span>${AVATAR_LABELS[id]}</span></button>`).join('');
      avatarGrid.querySelectorAll('.avatar-choice').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-avatar');
          if (!id) return;
          if (players.some(p=>p&&!p.isBot&&p.id!==myPeerId&&(playerAvatars[p.id]||p.avatar)===id)) {
            horToast('That avatar is already chosen by another player.');return;
          }
          if (isHost) {
            window.HORFounderProfile785.select(id);
            if (!changeHumanAvatar777(myPeerId,id,loadPreferredVoice(),myName)) return;
            publishAvatarIdentities777();
          } else if (hostConnection && hostConnection.open) {
            // Wait for the host's canonical snapshot; no duplicate-frame optimistic swap.
            window.HORFounderProfile785.select(id);
            hostConnection.send({type:'avatar',id:myPeerId,avatar:id,voice:loadPreferredVoice(),name:myName});
          } else if (!game) {
            window.HORFounderProfile785.select(id);if(myPeerId)playerAvatars[myPeerId]=id;
          } else { horToast('Reconnect before changing your avatar.');return; }
          avatarGrid.querySelectorAll('.avatar-choice').forEach(b => b.classList.toggle('selected', b === btn));
        };
      });
      const current = ensurePreferredAvatar() || playerAvatars[myPeerId] || (players.find(p => p.id === myPeerId) || {}).avatar || AVATARS[0];
      avatarGrid.querySelectorAll('.avatar-choice').forEach(b => b.classList.toggle('selected', b.getAttribute('data-avatar') === current));
    }

    syncOptionsUI(); // Keep the host's selected setup when opening the waiting room.
    ensureBotDifficultyOptions();
    wireRuleOptionControls();
    wireHostOptionsModal();


    const botSel = $('botCountSelect');
    if (botSel) {
      botSel.onchange = () => {
        try {
          setBotCount(botSel.value);
          botSel.blur();
        } catch (e) {
          console.error(e);
          alert('Bot error: ' + e.message);
        }
      };
    }
    const fillBtn = $('fillSeatsBtn');
    if (fillBtn) {
      fillBtn.onclick = (e) => {
        e.preventDefault();
        try {
          const humans = players.filter(p => !p.isBot).length;
          const need = Math.max(0, 4 - humans);
          setBotCount(need);
        } catch (err) {
          console.error(err);
          alert('Bot error: ' + err.message);
        }
      };
    }
    updateBotButtons();

  } else {
    const hostOpts = $('hostOptions');
    if (hostOpts) hostOpts.classList.add('hidden');
    const optBtn = $('openHostOptionsBtn');
    if (optBtn) optBtn.classList.add('hidden');
  }
}


function openHostOptionsModal() {
  const m = $('hostOptionsModal');
  if (!m) return;
  // The same full options sheet is used in the waiting room and Offline Practice.
  // Re-wire it every time it opens so an in-game/practice session cannot retain
  // stale handlers from the lobby.
  // Rook595: menu owns the viewport, never the scaled table/HUD tree.
  if (m.parentNode !== document.body) document.body.appendChild(m);
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  try { syncSoloHostExtrasUI(); } catch (e) {}
  try { syncOptionsUI(); } catch (e) {}
  try { wireRuleOptionControls(); } catch (e) {}
  try { wireTargetScoreUI(); } catch (e) {}
  try { syncTargetScoreUI(); } catch (e) {}
  try { syncQuickMenuSound(); } catch (e) {}
  // Rook685: Layout + Speed live in the upper menu's Display pane.
  // Make that pane the default whenever the menu opens so the existing
  // controls are immediately visible; closing the menu hides them again.
  try {
    const settingsTab = m.querySelector('.opt-tab[data-opt-tab="settings"]');
    if (settingsTab) settingsTab.click();
  } catch (e) {}
}

function closeHostOptionsModal() {
  const m = $('hostOptionsModal');
  if (!m) return;
  m.classList.add('hidden');
  m.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}
function wireHostOptionsModal() {
  const openBtn = $('openHostOptionsBtn');
  const closeBtn = $('closeHostOptionsBtn');
  const modal = $('hostOptionsModal');
  if (openBtn) {
    openBtn.onclick = (e) => {
      e.preventDefault();
      openHostOptionsModal();
    };
  }
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.preventDefault();
      closeHostOptionsModal();
    };
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeHostOptionsModal();
    };
  }
}

function wireRuleOptionControls() {
  // Individual variation toggles (Griffin base; extras default off)
  const bindCheck = (id, getter, setter) => {
    const el = $(id);
    if (!el) return;
    el.checked = !!getter();
    el.onchange = () => {
      setter(el.checked);
      recomputeHandAndNest();
      syncOptionsUI();
      try { broadcastPlaySettings(); } catch (e) {}
    };
  };
  bindCheck('opt-specials-anytime', () => specialsAnytime, v => { specialsAnytime=v; });
  bindCheck('opt-must-trump', () => mustTrumpWhenVoid, v => { mustTrumpWhenVoid=v; });
  bindCheck('opt-bid-only', () => bidOnlyScoring, v => { bidOnlyScoring=v; });
  bindCheck('opt-screw-dealer', () => screwTheDealer, v => { screwTheDealer=v; });
  bindCheck('opt-misdeal-no-counters', () => misdealOnNoCounters, v => { misdealOnNoCounters=v; });
  bindCheck('opt-comeback-special-chance', () => comebackSpecialChance, v => { comebackSpecialChance=v; });
  bindCheck('opt-open-widow', () => openWidow, v => { openWidow=v; });
  bindCheck('opt-shoot-moon', () => shootMoonEnabled, v => { shootMoonEnabled=v; });
  const bindChoice=(id,read,write)=>{const el=$(id);if(!el)return;el.value=read();el.onchange=()=>{write(el.value);syncOptionsUI();broadcastPlaySettings();};};
  bindChoice('opt-force-nest-reveal',()=>forceNestReveal,v=>{forceNestReveal=v;});
  bindChoice('opt-nest-goes-to',()=>nestGoesTo,v=>{if(['lastTrick','bidder'].includes(v))nestGoesTo=v;});
  bindChoice('opt-lead-order',()=>leadOrder,v=>{if(['bidder','leftOfBidder','rightOfBidder'].includes(v))leadOrder=v;});
  bindCheck('opt-reveal-top-nest', () => revealTopNest, v => { revealTopNest = v; try { renderTopNestPeek(); } catch(e) {} });
  bindCheck('opt-include-ones', () => includeOnes, v => { includeOnes = v; onesHigh = v; });
  bindCheck('opt-include-red2', () => includeRed2, v => {
    includeRed2 = v;
    const ptsBox = $('opt-red2-points');
    if (ptsBox) ptsBox.style.display = v ? 'block' : 'none';
  });
  bindCheck('opt-include-red1', () => includeRed1, v => { includeRed1 = v; });
  bindCheck('opt-include-rook', () => includeRook, v => { includeRook = v; });
  bindCheck('opt-rook-lowest', () => rookLowest, v => { rookLowest = v; });
  bindCheck('opt-experimental-hand', () => experimentalHandOpt, v => {
    experimentalHandOpt = !!v && isHostOnlyHuman();
    try { syncSoloHostExtrasUI(); } catch (e) {}
  });
  const luckyOn = $('opt-lucky-on');
  if (luckyOn) {
    luckyOn.checked = !!luckySpecialsEnabled;
    luckyOn.onchange = () => {
      luckySpecialsEnabled = !!luckyOn.checked && isHostOnlyHuman();
      try { syncSoloHostExtrasUI(); } catch (e) {}
      try { broadcastPlaySettings(); } catch (e) {}
    };
  }
  const setLuckyMode = (mode) => {
    luckySpecialsMode = mode === 'spinner' ? 'spinner' : 'fixed';
    try { syncSoloHostExtrasUI(); } catch (e) {}
    try { broadcastPlaySettings(); } catch (e) {}
  };
  const modeFixed = $('opt-lucky-fixed');
  const modeSpin = $('opt-lucky-spinner');
  if (modeFixed) modeFixed.onchange = () => { if (modeFixed.checked) setLuckyMode('fixed'); };
  if (modeSpin) modeSpin.onchange = () => { if (modeSpin.checked) setLuckyMode('spinner'); };
  const luckySel = $('opt-lucky-boost');
  if (luckySel) {
    luckySel.value = String(luckySpecialsBoost || 0);
    luckySel.onchange = () => {
      luckySpecialsBoost = isHostOnlyHuman() ? (parseInt(luckySel.value, 10) || 0) : 0;
      try { broadcastPlaySettings(); } catch (e) {}
    };
  }

  document.querySelectorAll('input[name="red2pts"]').forEach(r => {
    r.checked = (parseInt(r.value, 10) === red2Points);
    r.onchange = () => {
      if (r.checked) {
        red2Points = parseInt(r.value, 10);
        try { broadcastPlaySettings(); } catch (e) {}
      }
    };
  });

  const mb = $('opt-min-bid');
  if (mb) {
    mb.value = String(minBid);
    mb.onchange = () => {
      minBid = parseInt(mb.value, 10) || 100;
      try { broadcastPlaySettings(); } catch (e) {}
      syncOptionsUI();
    };
  }
  wireTargetScoreUI();

}







function botCount() {
  return players.filter(p => p.isBot).length;
}

/**
 * Seat players so each team gets a mix of humans and bots when possible.
 * Teams = seat index % 2 (seats 0&2 = Team A, 1&3 = Team B).
 * Humans first, then bots → with 2H+2B seats become [H, H, B, B]
 * which gives Team A: H+B and Team B: H+B.
 */
function pickBeerSeats() {
  const pool = [0, 1, 2, 3];
  const n = Math.random() < 0.45 ? 1 : 2;
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
function playerAtSeat(seat) {
  return (players || []).find(p => p && p.seat === seat) || null;
}
function firstEmptySeat() {
  for (let s = 0; s < 4; s++) if (!playerAtSeat(s)) return s;
  return -1;
}
function firstEmptySeatExcept(avoidSeat) {
  for (let s = 0; s < 4; s++) {
    if (s === avoidSeat) continue;
    if (!playerAtSeat(s)) return s;
  }
  return -1;
}
function hostRelocateBot(bot, avoidSeat) {
  if (!bot || !bot.isBot) return false;
  const dest = firstEmptySeatExcept(avoidSeat);
  if (dest >= 0) {
    bot.seat = dest;
    bot.team = dest % 2;
    return true;
  }
  players = (players || []).filter(p => p !== bot);
  return false;
}
function seatedCount() {
  return [0, 1, 2, 3].filter(s => !!playerAtSeat(s)).length;
}
function packPlayersBySeat() {
  const packed = [];
  for (let s = 0; s < 4; s++) {
    const p = playerAtSeat(s);
    if (p) {
      p.team = s % 2;
      packed.push(p);
    }
  }
  players = packed.concat((players || []).filter(p => p && (typeof p.seat !== 'number' || p.seat < 0)));
  if (myPeerId) {
    const idx = players.findIndex(p => p.id === myPeerId);
    if (idx >= 0) myIndex = idx;
  }
}

function ensurePlayerSeats(list) {
  const out = Array.isArray(list) ? list : [];
  const used = new Set();
  out.forEach((p) => {
    if (!p) return;
    if (typeof p.seat === 'number' && p.seat >= 0 && p.seat <= 3 && !used.has(p.seat)) {
      used.add(p.seat);
    }
  });
  out.forEach((p, i) => {
    if (!p) return;
    if (typeof p.seat === 'number' && p.seat >= 0 && p.seat <= 3) return;
    // Humans pick a chair (open or bot). Never invent a seat for them —
    // that would hide or shuffle players already seated.
    if (!p.isBot) {
      p.seat = -1;
      return;
    }
    let seat = (i <= 3 && !used.has(i)) ? i : -1;
    if (seat < 0) {
      for (let s = 0; s < 4; s++) {
        if (!used.has(s)) { seat = s; break; }
      }
    }
    if (seat >= 0) {
      p.seat = seat;
      p.team = seat % 2;
      used.add(seat);
    }
  });
  return out;
}

// Host owns table identities. A human claim replaces the conflicting bot PERSONA,
// keeping the same player id, seat, team, cards, score, turn and reconnect fields.
function reconcileAvatarIdentities777() {
  if (!isHost || !Array.isArray(players)) return false;
  let changed = false;
  const patch = (p, values) => {
    for (const pool of [players, (typeof game !== 'undefined' && game && game.players) || []])
      for (const q of pool) if (q && q.id === p.id) Object.assign(q, values);
    if (values.avatar) playerAvatars[p.id] = values.avatar;
    changed = true;
  };
  const used = new Set(), names = new Set(players.filter(p=>p&&p.isBot).map(p=>p.name));
  const freeAvatar = () => Object.keys(window.HORHumanAvatars||{}).find(a=>!used.has(a));
  for (const p of players.filter(p=>p&&!p.isBot)) {
    let a = playerAvatars[p.id] || p.avatar || AVATARS[0];
    if (!humanAvatarAllowed783(a) || used.has(a)) a = freeAvatar();
    if (a && (p.avatar !== a || playerAvatars[p.id] !== a)) patch(p,{avatar:a});
    if (a) used.add(a);
  }
  for (const p of players.filter(p=>p&&p.isBot)) {
    let persona = BOT_PERSONAS.find(b=>b.name===p.name);
    let a = persona?.avatar || playerAvatars[p.id] || p.avatar;
    if (!a || used.has(a)) {
      persona = BOT_PERSONAS.find(b=>!used.has(b.avatar)&&!names.has(b.name));
      if (!persona) continue;
      names.delete(p.name); names.add(persona.name);
      a = persona.avatar;
      patch(p,{name:persona.name,avatar:a,botStyle:persona.style,
        careerPublic:(horCareerModeOn()&&window.HORProgression?.localCareer?.botPublicProfile)
          ? HORProgression.localCareer.botPublicProfile(persona.name):null});
    } else if (p.avatar !== a || playerAvatars[p.id] !== a) patch(p,{avatar:a});
    used.add(a);
  }
  return changed;
}
function changeHumanAvatar777(id, avatar, voice, name) {
  if (!isHost || !humanAvatarAllowed783(avatar)) return false;
  const p = players.find(p=>p&&p.id===id&&!p.isBot);
  if (!p || players.some(q=>q&&!q.isBot&&q.id!==id&&(playerAvatars[q.id]||q.avatar)===avatar)) return false;
  if(avatar==='jerome_founder'&&p.avatar!==avatar){p.nameBeforeJerome787=p.name;p.name='Jerome';p.voice='male';}
  else if(avatar!=='jerome_founder'&&p.avatar==='jerome_founder'&&p.nameBeforeJerome787){p.name=p.nameBeforeJerome787;delete p.nameBeforeJerome787;}
  if(avatar!=='jerome_founder'&&typeof name==='string'&&name.trim())p.name=name.trim();
  if(voice!==undefined)p.voice=validHumanVoice(voice);
  p.avatar=avatar;playerAvatars[id]=avatar;
  if (game?.players) { const q=game.players.find(q=>q&&q.id===id);if(q){q.avatar=avatar;q.name=p.name;q.voice=p.voice;} }
  reconcileAvatarIdentities777();
  return true;
}
function publishAvatarIdentities777() {
  if (!isHost) return;
  broadcast({type:'players',players:publicPlayersSnapshot(),beerSeats});
  if (game) broadcastState();
  try { updateWaitingUI();renderUI(); } catch (_) {}
}

function publicPlayersSnapshot() {
  reconcileAvatarIdentities777();
  ensurePlayerSeats(players);
  try { const me=(players||[]).find(p=>p&&!p.isBot&&p.id===myPeerId); if(me) me.careerPublic=horMyCareerProfile(); } catch(e) {}
  return (players || []).filter(Boolean).map((p) => ({
    id: p.id,
    name: p.name,
    team: typeof p.team === 'number' ? p.team : ((p.seat || 0) % 2),
    isHost: !!p.isHost,
    isBot: !!p.isBot,
    seat: (typeof p.seat === 'number' ? p.seat : -1),
    avatar: p.avatar || playerAvatars[p.id] || '',
    voice: p.isBot ? 'avatar' : validHumanVoice(p.voice),
    botStyle: p.botStyle || '',
    isTempBot: !!p.isTempBot,
    humanStyle: p.humanStyle || '',
    humanTitle: p.humanTitle || '',
    humanHabit: p.humanHabit || '',
    humanHow: p.humanHow || '',
    humanHands: p.humanHands || 0,
    careerPublic: p.careerPublic || null
  }));
}

function applyPlayersSnapshot(list) {
  players = ensurePlayerSeats(Array.isArray(list) ? list.map((p) => Object.assign({}, p)) : []);
  players.forEach((p) => {
    if (p && p.id && p.avatar) playerAvatars[p.id] = p.avatar;
    if (p && !p.isBot) refreshHumanPersona(p);
  });
}
function balanceTeams() {
  if (!isHost || players.length === 0) return;
  (players || []).forEach((p) => {
    if (p && typeof p.seat === 'number' && p.seat >= 0) p.team = p.seat % 2;
  });
  packPlayersBySeat();
}

function updateBotButtons() {
  // Sync the bot-count dropdown with current bots
  const sel = $('botCountSelect');
  if (sel) {
    const humans = players.filter(p => !p.isBot).length;
    const maxBots = Math.max(0, 4 - humans);
    Array.from(sel.options).forEach(opt => {
      const n = parseInt(opt.value, 10);
      opt.disabled = n > maxBots;
      // Clarify what each choice does
      if (n === 0) opt.textContent = '0 bots';
      else if (n > maxBots) opt.textContent = n + ' bots (need fewer people)';
      else if (humans + n === 4) opt.textContent = n + ' bot' + (n === 1 ? '' : 's') + ' (fill table)';
      else opt.textContent = n + ' bot' + (n === 1 ? '' : 's');
    });
    const bots = botCount();
    const clamped = Math.min(bots, maxBots);
    if (parseInt(sel.value, 10) !== clamped) sel.value = String(clamped);
  }
  const fillBtn = $('fillSeatsBtn');
  if (fillBtn) {
    const empty = Math.max(0, 4 - seatedCount());
    fillBtn.disabled = empty <= 0;
    fillBtn.classList.toggle('hidden', empty <= 0);
    fillBtn.textContent = empty > 0 ? 'Fill seats' : '';
  }
}

const BOT_PERSONAS = [
  { name: 'Crow', style: 'safe', avatar: 'crow', blurb: 'Folds early. Rarely overbids.' },
  { name: 'Blaze', style: 'aggressive', avatar: 'blaze', blurb: 'Pushes bids and leads hot.' },
  { name: 'Nix', style: 'tricky', avatar: 'nix', blurb: 'Sneaky leads. Hides counters.' },
  { name: 'Titan', style: 'trumpHeavy', avatar: 'titan', blurb: 'Pulls trump early and often.' },
  { name: 'Pike', style: 'pointHungry', avatar: 'pike', blurb: 'Hunts every counter on the felt.' },
  { name: 'Drift', style: 'passive', avatar: 'drift', blurb: 'Ducks tricks. Lets others fight.' },
  { name: 'Dice', style: 'randomish', avatar: 'dice', blurb: 'Chaos seat. Unpredictable plays.' },
  { name: 'Anchor', style: 'partnerFirst', avatar: 'anchor', blurb: 'Feeds partner. Protects the bid.' },
  { name: 'Wager', style: 'bidHappy', avatar: 'wager', blurb: 'Loves the auction. Climbs bids.' },
  { name: 'Hollow', style: 'voidMaker', avatar: 'hollow', blurb: 'Strips a color to ruff later.' },
  { name: 'Ember', style: 'balanced', avatar: 'ember', blurb: 'Steady book. No wild swings.' },
  { name: 'Vex', style: 'ruffHappy', avatar: 'vex', blurb: 'Ruffs the first chance it gets.' },
  { name: 'Frost', style: 'scoreHawk', avatar: 'frost', blurb: 'Only buys when the score says so.' },
  { name: 'Fang', style: 'setDog', avatar: 'fang', blurb: 'Lives to set the other team.' },
  { name: 'Halo', style: 'partnerSignal', avatar: 'halo', blurb: 'Leads the color partner is void.' },
  { name: 'Quill', style: 'countSaver', avatar: 'quill', blurb: 'Hides counters until the trick is safe.' },
  { name: 'Bramble', style: 'leadLong', avatar: 'bramble', blurb: 'Leads the long color and stays there.' },
  { name: 'Moss', style: 'trumpShy', avatar: 'moss', blurb: 'Has trump. Refuses to lead it.' },
  { name: 'Emberlyn', style: 'showboat', avatar: 'emberlyn', blurb: 'Flashes high cards just to be seen.' },
  { name: 'Cinder', style: 'rookHunter', avatar: 'cinder', blurb: 'Hunts the Bird and the painted two.' },
  { name: 'Gable', style: 'lastTrick', avatar: 'gable', blurb: 'Saves trump for the last pile.' },
  { name: 'Thistle', style: 'sandbag', avatar: 'thistle', blurb: 'Underbids, then plays tight defense.' },
  { name: 'Marrow', style: 'fourteenHold', avatar: 'marrow', blurb: 'Sits on 14s until the pile is fat.' },
  { name: 'Pebble', style: 'secondHandLow', avatar: 'pebble', blurb: 'Second to play, plays low.' },
  { name: 'Rookery', style: 'trumpDown', avatar: 'rookery', blurb: 'Leads cheap trump, not the ace.' },
  { name: 'Sable', style: 'shortLead', avatar: 'sable', blurb: 'Leads the shortest off color.' },
  { name: 'Finch', style: 'climbOnly', avatar: 'finch', blurb: 'Never opens. Only overcalls.' },
  { name: 'Dagger', style: 'trumpUp', avatar: 'dagger', blurb: 'Leads the highest trump it holds.' },
  { name: 'Willow', style: 'eggSitter', avatar: 'willow', blurb: 'Will not lead a counter.' },
  { name: 'Hearth', style: 'passFirst', avatar: 'hearth', blurb: 'Always passes the first chair.' },
  { name: 'Grit', style: 'nestDump', avatar: 'grit', blurb: 'Parks nest counters if the last trick looks lost.' },
  { name: 'Copper', style: 'fiveHunter', avatar: 'copper', blurb: 'Scoops every 5 that hits the felt.' },
  { name: 'Moth', style: 'thirdHandHigh', avatar: 'moth', blurb: 'Third to play, plays high.' },
  { name: 'Brandy', style: 'widowFiend', avatar: 'brandy', blurb: 'Buys a thin 100 just to see the nest.' },
  { name: 'Flint', style: 'honorCash', avatar: 'flint', blurb: 'Cashes a 1 the first chance it gets.' },
  { name: 'Ivy', style: 'bidOnce', avatar: 'ivy', blurb: 'Opens, then sits. Will not climb.' },
  { name: 'Shade', style: 'midRank', avatar: 'shade', blurb: 'Leads a middle card and waits.' },
  { name: 'Barrel', style: 'quietDealer', avatar: 'barrel', blurb: 'Tight when dealing. Loose left of dealer.' },
  { name: 'Spark', style: 'moonDreamer', avatar: 'spark', blurb: 'Looks for Shoot the Moon more than the book.' },
  { name: 'Nettle', style: 'colorStubborn', avatar: 'nettle', blurb: 'Names its pet color even when another is longer.' },
  { name: 'Cobalt', style: 'leftHandVoid', avatar: 'cobalt', blurb: 'Leads through LHO’s known void.' },
  { name: 'Ash', style: 'lastBidder', avatar: 'ash', blurb: 'Speaks last. Rarely opens early.' },
  { name: 'Harrier', style: 'antiMoon', avatar: 'harrier', blurb: 'Will not climb near 200.' },
];
const STYLE_TITLES = {
  newPlayer: 'New player',
  safe: 'Safe',
  aggressive: 'Aggressive',
  tricky: 'Tricky',
  trumpHeavy: 'Trump heavy',
  pointHungry: 'Point hunter',
  passive: 'Passive',
  randomish: 'Chaos',
  partnerFirst: 'Partner first',
  bidHappy: 'Bid happy',
  voidMaker: 'Void maker',
  balanced: 'Balanced',
  countSaver: 'Count saver',
  leadLong: 'Long color',
  showboat: 'Showboat',
  rookHunter: 'Bird hunter',
  lastTrick: 'Last trick',
  sandbag: 'Sandbag',
  widowFiend: 'Widow fiend',
  trumpShy: 'Trump shy',
  setDog: 'Set dog',
  scoreHawk: 'Score hawk',
  colorStubborn: 'Stubborn color',
  quietDealer: 'Quiet dealer',
  nestDump: 'Nest dumper',
  ruffHappy: 'Ruff happy',
  honorCash: 'Cashes honors',
  secondHandLow: 'Second-hand low',
  thirdHandHigh: 'Third-hand high',
  eggSitter: 'Egg sitter',
  bidOnce: 'Bids once',
  climbOnly: 'Climb only',
  moonDreamer: 'Moon dreamer',
  antiMoon: 'No moon',
  leftHandVoid: 'Through the void',
  partnerSignal: 'Partner’s void',
  shortLead: 'Short lead',
  midRank: 'Mid rank',
  fiveHunter: 'Five hunter',
  fourteenHold: 'Holds the 14',
  trumpUp: 'Trump up',
  trumpDown: 'Trump down',
  passFirst: 'Passes first',
  lastBidder: 'Last bidder',
};
const STYLE_HABIT = {
  newPlayer: 'New player',
  safe: 'tight auction',
  aggressive: 'opens more 100s',
  tricky: 'off-speed leads',
  trumpHeavy: 'pulls trump early',
  pointHungry: 'fights every 10',
  passive: 'ducks the thin ones',
  randomish: 'chaos seat',
  partnerFirst: 'never contests partner',
  bidHappy: 'climbs the auction',
  voidMaker: 'strips a color in the nest',
  balanced: 'straight book',
  countSaver: 'hides counters',
  leadLong: 'pounds the long color',
  showboat: 'flashes high cards',
  rookHunter: 'hunts the Bird',
  lastTrick: 'saves trump for the nest',
  sandbag: 'underbids, plays tight',
  widowFiend: 'buys the nest',
  trumpShy: 'will not lead trump',
  setDog: 'hunts the set',
  scoreHawk: 'bids the scoreboard',
  colorStubborn: 'names a pet color',
  quietDealer: 'tight in the deal seat',
  nestDump: 'parks nest points',
  ruffHappy: 'ruffs early',
  honorCash: 'cashes a 1',
  secondHandLow: 'second hand low',
  thirdHandHigh: 'third hand high',
  eggSitter: 'never leads a counter',
  bidOnce: 'opens and sits',
  climbOnly: 'only overcalls',
  moonDreamer: 'eyes the moon',
  antiMoon: 'won’t climb to 200',
  leftHandVoid: 'leads through LHO',
  partnerSignal: 'leads partner’s void',
  shortLead: 'leads the short color',
  midRank: 'leads a middle card',
  fiveHunter: 'scoops the fives',
  fourteenHold: 'holds the 14',
  trumpUp: 'leads high trump',
  trumpDown: 'leads low trump',
  passFirst: 'passes first chair',
  lastBidder: 'waits to speak last',
};
const STYLE_HOWTO = {
  newPlayer: 'Not enough hands yet to read a habit.',
  safe: 'Shy auction. Leads low. Only fights fat tricks.',
  aggressive: 'Climbs the bid. Leads strong. Takes the trick.',
  tricky: 'Odd mid leads. Sometimes snaps. Feeds partner last.',
  trumpHeavy: 'Names a long trump and leads it early.',
  pointHungry: 'Goes after every counter on the felt.',
  passive: 'Passes a lot. Ducks tricks. Plays low.',
  randomish: 'Picks a legal card and bid at random.',
  partnerFirst: 'Will not kill partner. Feeds last to play.',
  bidHappy: 'Opens the auction and climbs it.',
  voidMaker: 'Strips a short color to ruff later.',
  balanced: 'Steady book. No wild swings.',
  countSaver: 'Hides counters unless the trick is already won.',
  leadLong: 'Leads the longest color and stays on it.',
  showboat: 'Flashes high cards. Plays loud.',
  rookHunter: 'Goes looking for the Bird and Red 2.',
  lastTrick: 'Saves trump to fight the last pile.',
  sandbag: 'Underbids, then plays defense.',
  widowFiend: 'Opens a thin 100 to see the nest.',
  trumpShy: 'Same book. Will not lead trump.',
  setDog: 'Throws winners at their bid to set them.',
  scoreHawk: 'Buys when behind. Passes when ahead.',
  colorStubborn: 'Names a favorite color even if another is longer.',
  quietDealer: 'Tight when dealing. Looser left of the dealer.',
  nestDump: 'Buries nest counters if the last trick looks lost.',
  ruffHappy: 'Ruffs the first off-suit chance.',
  honorCash: 'Cashes a 1 as soon as the lead is safe.',
  secondHandLow: 'If second to play, ducks.',
  thirdHandHigh: 'If third to play, plays high.',
  eggSitter: 'Leads only non-counters.',
  bidOnce: 'Opens the floor, then never climbs.',
  climbOnly: 'Passes the open. Overcalls later.',
  moonDreamer: 'Will shoot the moon on a big book.',
  antiMoon: 'Stops short of 200.',
  leftHandVoid: 'Leads a color LHO already showed void.',
  partnerSignal: 'Leads a color partner is void in.',
  shortLead: 'Leads the shortest off color.',
  midRank: 'Leads an 8–11, not the top or bottom.',
  fiveHunter: 'Beats a 5 whenever it can.',
  fourteenHold: 'Keeps 14s unless the pile is fat.',
  trumpUp: 'Leads the highest plain trump.',
  trumpDown: 'Leads the cheapest plain trump.',
  passFirst: 'Always passes if first to speak.',
  lastBidder: 'Rarely opens unless last to speak.',
};
function personaByName(name) {
  return BOT_PERSONAS.find(p => p.name === name) || null;
}
function botHowToHTML(p) {
  if (!p) return '';
  const title = STYLE_TITLES[p.style] || p.style;
  const habit = (typeof STYLE_HABIT !== 'undefined' && STYLE_HABIT[p.style]) || title;
  const how = STYLE_HOWTO[p.style] || p.blurb || '';
  return '<b>' + escapeHtmlSafe(p.name) + '</b> · ' + escapeHtmlSafe(habit)
    + '<span>' + escapeHtmlSafe(how) + '</span>';
}
function hideBotStyleTip() {
  const tip = $('botStyleTip');
  if (tip) tip.classList.add('hidden');
}
function showBotStyleTip(name, ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  if(window.HORBidRepair737?.required()){horToast('Finish your bid before viewing a player.');return false;}
  hideBotStyleTip();
  const p=horResolveCareerPlayer('',name) || (players||[]).find(p=>p&&p.name===name);
  return p ? horShowCareerForPlayer(p) : false;
}

function botNameAttr(p) {
  if (!p || !p.name) return '';
  return ' data-botname="' + escapeHtmlSafe(p.name) + '"';
}
function applyBotNameAttr(el, p) {
  if (!el) return;
  if (p && p.name) el.setAttribute('data-botname', p.name);
  else el.removeAttribute('data-botname');
}

function availableBotPersonas() {
  const used = new Set((players || []).filter(p => p && p.isBot).map(p => p.name));
  let list = BOT_PERSONAS.filter(p => !used.has(p.name));
  const d = (typeof botDifficulty === 'string') ? botDifficulty : '';
  if (d === 'extreme' || d === 'hard') {
    list = list.filter(p => p.style !== 'randomish' && p.style !== 'showboat');
  }
  return list;
}

function addBot(seat, personaPick) {
  if (!isHost) return;
  if (seatedCount() >= 4) return;
  const target = (typeof seat === 'number' && seat >= 0 && !playerAtSeat(seat)) ? seat : firstEmptySeat();
  if (target < 0) return;
  let pool = availableBotPersonas();
  const favorite = (isSoloPractice || roomCode === 'OFFLINE') ? favoritePartner042() : null;
  const partnerSeat = favoritePartnerSeat042();
  // Reserve the favorite for our partner rather than randomly seat them opposite us.
  if (!personaPick && favorite) {
    if (target === partnerSeat && !(players || []).some(p => p && p.isBot && p.name === favorite.name)) personaPick = favorite.name;
    else pool = pool.filter(p => p.name !== favorite.name);
  }
  // Character Studio changes only the default offline cast pool; existing seat/random/favorite rules stay in control.
  if (!personaPick && (isSoloPractice || roomCode === 'OFFLINE')) pool = window.HORCharacterStudio077?.castPool(pool) || pool;
  let persona = null;
  if (personaPick) {
    persona = pool.find(p => p.name === personaPick || p.name === (personaPick && personaPick.name))
      || BOT_PERSONAS.find(p => p.name === personaPick || p.name === (personaPick && personaPick.name));
  }
  if (!persona) persona = pool[Math.floor(Math.random() * pool.length)] || BOT_PERSONAS[botCount() % BOT_PERSONAS.length];
  if ((players || []).some(p => p && p.isBot && p.name === persona.name)) return;
  // Human avatar priority: choose another whole persona, never dress a fixed bot as somebody else.
  const occupiedAvatars = new Set((players || []).filter(Boolean).map(p => playerAvatars[p.id] || p.avatar));
  if (occupiedAvatars.has(persona.avatar)) {
    persona = pool.find(p => !occupiedAvatars.has(p.avatar) && !(players || []).some(x => x && x.isBot && x.name === p.name))
      || availableBotPersonas().find(p => !occupiedAvatars.has(p.avatar));
    if (!persona) return;
  }
  const id = 'bot-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  players.push({
    id,
    name: persona.name,
    team: target % 2,
    isHost: false,
    isBot: true,
    botStyle: persona.style,
    avatar: persona.avatar || AVATARS[botCount() % AVATARS.length],
    seat: target,
    careerPublic: (horCareerModeOn() && window.HORProgression && HORProgression.localCareer && HORProgression.localCareer.botPublicProfile)
      ? HORProgression.localCareer.botPublicProfile(persona.name) : null,
  });
  playerAvatars[id] = players[players.length - 1].avatar;
  balanceTeams();
  try { broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats }); } catch (e) {}
  updateWaitingUI();
  updateBotButtons();
  // Bot taking a lobby seat has its own seating cue. Keep this separate
  // from the selectable My Turn notification sounds.
  try { playSitSound(); } catch (e) {}
}

function closeBotPicker() {
  const m = $('botPickerModal');
  if (m) m.classList.add('hidden');
}

function rankedBotPartners(pool){
 const record=p=>{try{const rel=window.HORProgression?.localCareer?.relationshipRead?.(p.name);const games=Math.max(0,Number(rel?.partnerGames)||0);return {games,wins:Math.max(0,Math.min(games,Number(rel?.partnerWins)||0))};}catch(_){return {games:0,wins:0};}};
 const rows=pool.map((p,index)=>({p,index,...record(p)})),adjusted=r=>(r.wins+3)/(r.games+6);
 rows.sort((a,b)=>!!a.games!==!!b.games?(a.games?-1:1):a.games?(adjusted(b)-adjusted(a)||b.games-a.games||a.index-b.index):(Number(b.p.style==='partnerFirst')-Number(a.p.style==='partnerFirst')||a.index-b.index));
 return rows;
}
function openBotPicker(seat) {
  const m = $('botPickerModal');
  const grid = $('botPickerGrid');
  if (!m || !grid) {
    addBot(seat);
    return;
  }
  const pool = rankedBotPartners(availableBotPersonas());
  if (!pool.length) {
    addBot(seat);
    return;
  }
  grid.innerHTML = pool.map(({p,games,wins}) =>
    '<button type="button" class="bot-pick" data-bot="' + p.name + '">'
    + '<img src="' + avatarSrc(p.avatar) + '" alt="">'
    + '<b>' + p.name + '</b>'
    + '<i>' + (STYLE_TITLES[p.style] || p.style) + '</i>'
    + '<span>' + (games ? (wins+' wins · '+games+' games · '+Math.round(100*wins/games)+'% together') : 'Not yet partnered · '+(STYLE_HOWTO[p.style] || p.blurb || '')) + '</span>'
    + '</button>'
  ).join('');
  grid.querySelectorAll('.bot-pick').forEach(btn => {
    btn.onclick = () => {
      addBot(seat, btn.getAttribute('data-bot'));
      closeBotPicker();
    };
  });
  m.classList.remove('hidden');
}

function removeBot(seat) {
  if (!isHost) return;
  if (typeof seat === 'number') {
    const occ = playerAtSeat(seat);
    if (occ && occ.isBot) {
      players = players.filter(p => p !== occ);
    }
  } else {
    for (let i = players.length - 1; i >= 0; i--) {
      if (players[i].isBot) {
        players.splice(i, 1);
        break;
      }
    }
  }
  balanceTeams();
  try { broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats }); } catch (e) {}
  updateWaitingUI();
  updateBotButtons();
}

function hostAdmitAndClaim(seat, playerId, nameHint) {
  if (!isHost || !playerId) return false;
  let who = (players || []).find(p => p && p.id === playerId);
  const existed = !!who;
  if (!who) {
    who = {
      id: playerId,
      name: String(nameHint || 'Player').trim().slice(0, 18) || 'Player',
      team: 0,
      isHost: false,
      isBot: false,
      seat: -1,
      };
    players.push(who);
  } else if (nameHint && !who.isBot) {
    who.name = String(nameHint).trim().slice(0, 18) || who.name;
  }
  const ok = hostClaimSeat(seat, playerId);
  if (!ok && !existed) {
    players = (players || []).filter(p => p && p.id !== playerId);
    try { broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats }); } catch (e) {}
    try { updateWaitingUI(); } catch (e) {}
  }
  return ok;
}

function hostClaimSeat(seat, playerId) {
  if (!isHost) return false;
  seat = parseInt(seat, 10);
  if (seat < 0 || seat > 3) return false;
  const who = (players || []).find(p => p && p.id === playerId);
  if (!who || who.isBot) return false;
  const occ = playerAtSeat(seat);
  if (occ && occ.id === who.id) return true;
  if (occ && !occ.isBot) return false;
  // Free the chair this human is leaving first. Otherwise a second
  // "replace this bot" tap finds no empty seat and the bot is dropped.
  const fromSeat = (typeof who.seat === 'number') ? who.seat : -1;
  if (fromSeat >= 0 && fromSeat !== seat) who.seat = -1;
  if (occ && occ.isBot) hostRelocateBot(occ, seat);
  const moved = fromSeat !== seat;
  who.seat = seat;
  who.team = seat % 2;
  if (who.id === myPeerId) myIndex = players.findIndex(p => p && p.id === who.id);
  balanceTeams();
  try { broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats }); } catch (e) {}
  updateWaitingUI();
  if (moved && who.id !== myPeerId) {
    try { playSitSound(); } catch (e) {}
    try {
      const toastName = who.name || 'A player';
      horToast(occ && occ.isBot
        ? (toastName + ' sat — ' + (occ.name || 'bot') + ' moved')
        : (toastName + ' sat down'));
    } catch (e) {}
  }
  return true;
}

function onWaitSeatClick(seat) {
  seat = parseInt(seat, 10);
  if (seat < 0 || seat > 3) return;
  const occ = playerAtSeat(seat);
  if (isHost) {
    if (!occ) {
      // Rook502: host selecting an empty waiting-room seat gets the original
      // low "doooop" cue before the bot picker opens.
      try { playLobbySeatClickSound(); } catch (e) {}
      openBotPicker(seat);
      return;
    }
    if (occ.isBot) {
      removeBot(seat);
      return;
    }
    return;
  }
  if (occ && !occ.isBot) return;
  if (hostConnection && hostConnection.open) {
    const nm = (myName || ($('welcome-player-name') && $('welcome-player-name').value) || ($('hor-player-name') && $('hor-player-name').value) || '').trim();
    hostConnection.send({ type: 'claimSeat', seat, id: myPeerId, name: nm });
  }
}

/** Set exact number of bots (0–3), filling remaining seats up to 4 total. */
function setBotCount(desired) {
  if (!isHost) return;
  desired = Math.max(0, Math.min(3, parseInt(desired, 10) || 0));
  const humans = players.filter(p => !p.isBot).length;
  const maxBots = Math.max(0, 4 - humans);
  desired = Math.min(desired, maxBots);

  let bots = botCount();
  while (bots > desired) {
    removeBot();
    bots = botCount();
  }
  while (bots < desired) {
    addBot();
    bots = botCount();
  }
  updateBotButtons();
}







function collectDealtHandIds() {
  const ids = new Set();
  const add = (c) => { if (c && c.id) ids.add(c.id); };
  (game && game.hands || []).forEach((h) => (h || []).forEach(add));
  (game && game.myHand || []).forEach(add);
  return ids;
}
function freezeTopNestCard() {
  if (!game) return null;
  const nest = Array.isArray(game.nest) ? game.nest : [];
  const handIds = collectDealtHandIds();
  let card = null;
  for (let i = nest.length - 1; i >= 0; i--) {
    const c = nest[i];
    if (c && c.id && !handIds.has(c.id)) { card = c; break; }
  }
  if (card && handIds.has(card.id)) card = null;
  game.topNestCard = card ? hydrateNestCard(card) : null;
  return game.topNestCard;
}
function applyForcedNestReveal() {
  const want = (typeof window !== 'undefined' && window.horForceNest) || forceNestReveal || '';
  if (!game || !revealTopNest || !want) return null;
  const nest = game.nest = Array.isArray(game.nest) ? game.nest : [];
  const isBird = (c) => c && (c.id === 'rook' || c.color === 'rook');
  const isR2 = (c) => c && (c.id === 'red-2' || (typeof isRed2 === 'function' && isRed2(c)));
  const wantBird = (want === 'rook' || want === 'bird');
  const pred = wantBird ? isBird : isR2;
  const fallback = wantBird
    ? { color: 'rook', rank: 99, id: 'rook' }
    : { color: 'red', rank: 2, id: 'red-2' };
  let card = null;
  let idx = nest.findIndex(pred);
  if (idx >= 0) card = nest.splice(idx, 1)[0];
  if (!card && Array.isArray(game.hands)) {
    for (let i = 0; i < game.hands.length; i++) {
      const h = game.hands[i];
      if (!Array.isArray(h)) continue;
      idx = h.findIndex(pred);
      if (idx < 0) continue;
      card = h.splice(idx, 1)[0];
      if (nest.length) h.push(nest.shift());
      break;
    }
  }
  if (!card) card = fallback;
  nest.push(card);
  return pinNestRevealFace(card);
}

function nestCountOnTable() {
  if (!game) return 0;
  if (isPortraitViewport() && window.__dealNest036 && window.__dealNest036.token === dealAnimToken) return window.__dealNest036.count;
  if (game.nest && game.nest.length) return game.nest.length;
  if (typeof game.nestCount === 'number' && game.nestCount > 0) return game.nestCount;
  return (typeof nestSizeDefault === 'number' && nestSizeDefault) || 6;
}

function nestPileSignature() {
  const n = nestCountOnTable();
  const face = (revealTopNest) ? (game && game.topNestCard) : null;
  const stage = (game && game.nestFlipStage) || 0;
  return [n, face && face.id, stage, !!(game && game.phase)].join('|');
}
function hydrateNestCard(card) {
  if (!card) return null;
  let color = card.color;
  let rank = card.rank;
  let id = card.id;
  if ((!color || rank == null || rank === '') && id) {
    if (id === 'rook') { color = 'rook'; rank = 99; }
    else if (id === 'red-2') { color = 'red'; rank = 2; }
    else if (id === 'red1-special') { color = 'red'; rank = 1; }
    else {
      const m = String(id).match(/^([a-z]+)-(\d+)$/i);
      if (m) { color = m[1].toLowerCase(); rank = parseInt(m[2], 10); }
    }
  }
  if (!id && color && rank != null) id = color === 'rook' ? 'rook' : (color + '-' + rank);
  return {
    color: color || 'black',
    rank: rank != null ? rank : '?',
    id: id || ((color || 'x') + '-' + rank),
    specialRed1: !!(card.specialRed1 || id === 'red1-special')
  };
}
function nestCardClass(card) {
  const c = hydrateNestCard(card);
  if (!c) return 'black';
  if (typeof isRed1 === 'function' && isRed1(c)) return 'red1';
  if (typeof isRed2 === 'function' && isRed2(c)) return 'red2';
  if (c.color === 'rook' || c.id === 'rook') return 'rook';
  return c.color || 'black';
}
function pinNestRevealFace(card) {
  const copy = hydrateNestCard(card);
  if (!copy) return null;
  window._horPinnedNestFace = copy;
  if (game) game.topNestCard = copy;
  return copy;
}
function pinnedNestRevealFace() {
  return hydrateNestCard((game && game.topNestCard) || window._horPinnedNestFace || null);
}
function nestFaceMarkup(face) {
  const card = hydrateNestCard(face);
  if (!card) return '';
  try {
    if (typeof renderCardHTML === 'function') {
      const html = renderCardHTML(card, true);
      if (html && String(html).trim()) {
        return html.replace('class="card-face ', 'class="card-face nest-face-up nest-stay-face ');
      }
    }
  } catch (e) {}
  // Emergency fallback only. Normal Nest faces are owned by renderCardHTML().
  const cls = nestCardClass(card);
  const inner = (typeof cardInnerHTML === 'function') ? cardInnerHTML(card) : '';
  return '<div class="card-face nest-face-up nest-stay-face ' + cls + ' small">' + inner + '</div>';
}

function renderTopNestPeek() {
  try { return renderTopNestPeekContent033(); }
  finally { applyNestScatter037(); restoreNestPlacement039(); scheduleNestAlignment033(); }
}
function renderTopNestPeekContent033() {
  const bar = $('topNestPeek');
  if (bar) { bar.classList.add('hidden'); bar.innerHTML = ''; }
  const el = $('nestArea');
  if (!el) return;
  const phaseOk = !!(game && (game.phase === 'bidding' || game.phase === 'dealing'));
  const n = nestCountOnTable();
  // Rook584: after the reveal has completed and the auction is open, the Nest
  // must stay off the felt. This guard prevents later renders from resurrecting it.
  const revealFinished = !!(game && revealTopNest && game.nestAuctionOpen && (game.nestFlipped || (game.nestFlipStage || 0) >= 2));
  if (!phaseOk || n < 1) {
    el.classList.add('hidden');
    el.innerHTML = '';
    window._horNestPileSig = '';
    try { document.body.classList.remove('nest-on-felt'); } catch (e) {}
    return;
  }
  let face = revealTopNest ? pinnedNestRevealFace() : null;
  const stage = (game && game.nestFlipStage) || 0;
  if (revealTopNest && !face) {
    face = freezeTopNestCard();
  }
  if (face) pinNestRevealFace(face);
  const auctionLive = !!(game && (game.nestAuctionOpen || game.bidder >= 0 || (game.bid && game.bid > 0)));
  const showFace = !!(face && revealTopNest);
  const faceUp = !!(showFace && (game.nestFlipped || stage >= 2));
  const flipping = !!(showFace && stage === 1 && !faceUp);
  el.classList.remove('hidden');
  try { document.body.classList.add('nest-on-felt'); } catch (e) {}

  if (faceUp) {
    const staySig = 'stay:' + (face && face.id) + ':' + n;
    const stayEl = el.querySelector('.nest-stay-face');
    if (window._horNestPileSig === staySig && stayEl && stayEl.querySelector('.c-num, .rook-bird-img, .red2-img, .c-stack')) return;
    window._horNestPileSig = staySig;
    const backs = revealFinished ? 0 : Math.max(0, n - 1);
    let html = '<div class="table-nest-pile" aria-label="Nest">';
    for (let i = 0; i < backs; i++) {
      html += '<div class="card-back table-nest-under" style="--nest-i:' + i + '"></div>';
    }
    html += nestFaceMarkup(face) + '</div>';
    el.innerHTML = html;
    return;
  }

  const sig = nestPileSignature() + ':' + (flipping ? 'flip' : 'dn') + ':' + (face && face.id);
  if (window._horNestPileSig === sig && el.querySelector('.table-nest-flip, .table-nest-pile')) {
    if (flipping) {
      const flip = el.querySelector('.table-nest-flip');
      if (flip && !flip.classList.contains('is-turning')) {
        requestAnimationFrame(() => { try { flip.classList.add('is-turning', 'is-reveal'); } catch (e) {} });
      }
    }
    return;
  }
  window._horNestPileSig = sig;
  const backs = Math.max(0, n - 1);
  let html = '<div class="table-nest-pile" aria-label="Nest">';
  for (let i = 0; i < backs; i++) {
    html += '<div class="card-back table-nest-under" style="--nest-i:' + i + '"></div>';
  }
  if (flipping) {
    html += '<div class="table-nest-flip">'
      + '<div class="table-nest-flip-inner">'
      + '<div class="card-back table-nest-flip-back"></div>'
      + nestFaceMarkup(face).replace(' nest-stay-face', ' table-nest-flip-face')
      + '</div></div>';
  } else {
    html += '<div class="card-back table-nest-top"></div>';
  }
  html += '</div>';
  el.innerHTML = html;
  if (flipping) {
    const flip = el.querySelector('.table-nest-flip');
    if (flip) {
      void flip.offsetWidth;
      requestAnimationFrame(() => {
        try { flip.classList.add('is-turning', 'is-reveal'); } catch (e) {}
      });
      // Rook542: make the face state explicit after the physical turn crosses halfway.
      // This avoids a browser/WebView leaving the back visually on top for the full reveal.
      setTimeout(() => {
        try {
          if (flip && flip.isConnected && game && game.nestFlipStage === 1) flip.classList.add('is-face');
        } catch (e) {}
      }, 480);
    }
  }
}



function renderWidowSpread() {
  const el = $('widowSpread');
  if (!el) return;
  const phaseOk = !!(game && (game.phase === 'discard' || game.phase === 'trump'));
  const cards = (openWidow && game && Array.isArray(game.widowSpread)) ? game.widowSpread : [];
  if (!phaseOk || !cards.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  const faces = cards.map((c) => {
    const cls = (typeof cardClass === 'function') ? cardClass(c) : '';
    const inner = (typeof cardInnerHTML === 'function') ? cardInnerHTML(c) : ((c.rank || c.id) || '?');
    return '<div class="card-face ' + cls + ' widow-card">' + inner + '</div>';
  }).join('');
  el.classList.remove('hidden');
  el.innerHTML = '<span class="widow-spread-label">Widow</span><div class="widow-spread-row">' + faces + '</div>';
}


const HOR_VISUAL_THEMES = ['classic','royal','modern','coin','low','signature'];
const HOR_TRUMP_FX = ['hard','flash','spin','punch','slide','crest','bounce'];
let horDiagnosticPreviewIndex = null;
function horCurrentHandVisualIndex() {
  return Math.max(0, Array.isArray(handHistory) ? handHistory.length : Number((matchStats && matchStats.hands) || 0));
}
function horVisualIndex(){ return Number.isInteger(horDiagnosticPreviewIndex) ? horDiagnosticPreviewIndex : horCurrentHandVisualIndex(); }
function horSetThemeIndex(idx, preview){
  idx=((Number(idx)||0)%42+42)%42;
  if(preview) horDiagnosticPreviewIndex=idx;
  const theme=HOR_VISUAL_THEMES[idx%HOR_VISUAL_THEMES.length], fx=HOR_TRUMP_FX[idx%HOR_TRUMP_FX.length];
  HOR_VISUAL_THEMES.forEach(t=>document.body.classList.toggle('hor-bid-theme-'+t,t===theme));
  document.body.dataset.horHandTheme=theme; document.body.dataset.horTrumpFx=fx;
  return {idx,theme,fx};
}
function horApplyHandTheme() {
  // A real new hand always restores live-hand authority; manual diagnostic previews never change game state.
  horDiagnosticPreviewIndex=null;
  return horSetThemeIndex(horCurrentHandVisualIndex(),false);
}
function horUpdateDiagnostic(){
  // Rook574: player-visible theme diagnostics retired.
}
function horEnsureDiagnosticConsole(){
  // Rook574: remove stale diagnostic DOM from older cached builds; never recreate it.
  try {
    document.getElementById('horThemeDiagnostic')?.remove();
    document.getElementById('horDiagnosticPreview')?.remove();
  } catch (e) {}
}

function openNestAuction() {
  if (!game) return;

  // Rook561: authoritative per-hand visual owner. Legacy/default is never a rotation entry.
  try { horApplyHandTheme(); } catch (e) {}
  if (game.nestAuctionOpen && !nestAuctionLocked()) {
    try { if (isHost) hostPromptBid(); } catch (e) {}
    return;
  }
  game.nestAuctionOpen = true;
  if (revealTopNest) {
    game.nestFlipStage = 2;
    game.nestFlipped = true;
    window._horNestPileSig = '';
    // Rook585: once bidding opens, keep ONLY the revealed top Nest card.
    // The other five visual backs disappear; underlying Nest state is untouched.
    try { renderTopNestPeek(); } catch (e) {}
  }
  try { broadcastState(); } catch (e) {}
  try {
    if (isHost) {
      showBiddingIntro(() => { try { hostPromptBid(); } catch (e) {} });
      broadcast({ type: 'biddingIntro', minBid: minBid || 100 });
    } else if (game.phase === 'bidding' && game.currentPlayer === myIndex) {
      showBidUI();
    }
  } catch (e) {}
}

function nestAuctionLocked() {
  return !!(typeof revealTopNest !== 'undefined' && revealTopNest && game && !game.nestAuctionOpen);
}
function scheduleTopNestFlip() {
  if (!game) return;
  // Rook544 dedicated reveal path. The host owns the sequence; clients only render
  // the host's broadcast state. This deliberately does not alter bidding rules.
  if (!isHost) {
    try { renderTopNestPeek(); } catch (e) {}
    return;
  }
  if (!revealTopNest) {
    game.nestAuctionOpen = true;
    game.nestFlipStage = 0;
    game.nestFlipped = false;
    try { renderTopNestPeek(); } catch (e) {}
    return;
  }

  // Freeze a real card from the actual nest before any reveal UI is drawn.
  let face = pinnedNestRevealFace();
  if (!face) face = freezeTopNestCard();
  if (!face && Array.isArray(game.nest) && game.nest.length) {
    face = pinNestRevealFace(game.nest[game.nest.length - 1]);
  }
  if (!face) {
    // No invented card: leave the auction locked rather than pretending a reveal occurred.
    console.error('[Nest reveal] No top nest card available to reveal.');
    return;
  }
  pinNestRevealFace(face);

  const handKey = String(game.handNumber || 0) + ':' + String(game.dealer) + ':' + String(face.id || '');
  if (window._horNestFlipHand === handKey && (game.nestFlipStage || 0) > 0) return;
  window._horNestFlipHand = handKey;
  const tok = (window._horNestFlipTok = (window._horNestFlipTok || 0) + 1);

  game.nestAuctionOpen = false;
  game.nestFlipStage = 0;
  game.nestFlipped = false;
  window._horNestPileSig = '';
  try { ensureAudio(); } catch (e) {}
  try { renderTopNestPeek(); } catch (e) {}
  try { broadcastState(); } catch (e) {}

  // Give the face-down nest a short readable beat, then perform the actual turn.
  setTimeout(() => {
    if (tok !== window._horNestFlipTok || !game) return;
    if (game.phase !== 'bidding' && game.phase !== 'dealing') return;
    game.nestFlipStage = 1;
    game.nestFlipped = false;
    window._horNestPileSig = '';
    try { renderTopNestPeek(); } catch (e) {}
    try { broadcastState(); } catch (e) {}
    try { playNestRevealSequence(); } catch (e) {}

    // The CSS reveal is 1.8 s. Do not replace the animated card with the stationary
    // face until that complete interval has elapsed.
    setTimeout(() => {
      if (tok !== window._horNestFlipTok || !game) return;
      game.nestFlipStage = 2;
      game.nestFlipped = true;
      window._horNestPileSig = '';
      try { renderTopNestPeek(); } catch (e) {}
      try { broadcastState(); } catch (e) {}
    }, solScaledDelay(1800, 0));

    setTimeout(() => {
      if (tok !== window._horNestFlipTok || !game) return;
      try { openNestAuction(); } catch (e) {}
    }, solScaledDelay(1900, 0));
  }, solScaledDelay(420, 0));
}


function updateWaitingUI() {
  const list = $('playersList');
  if (list) list.innerHTML = '';
  const teamA = (typeof teamLabel === 'function') ? teamLabel(0) : 'Griffin';
  const teamB = (typeof teamLabel === 'function') ? teamLabel(1) : 'Raven';
  for (let s = 0; s < 4; s++) {
    const el = $('waitSeat' + s);
    if (!el) continue;
    const p = playerAtSeat(s);
    if (p && !p.isBot) try { refreshHumanPersona(p); } catch (e) {}
    el.classList.toggle('occupied', !!p);
    el.classList.toggle('is-me', !!(p && p.id === myPeerId));
    el.classList.toggle('is-bot', !!(p && p.isBot));
    if (p && p.isBot && p.name) el.setAttribute('data-botname', p.name); else el.removeAttribute('data-botname');
    if (p) {
      const tag = p.isHost ? 'Host' : (p.isBot ? 'Bot' : 'Sat');
      const face = p.avatar ? '<img class="wait-seat-av" src="' + avatarSrc(p.avatar) + '" alt="">' : '';
      const seatTag = (p.isBot && !isHost)
        ? 'Bot · tap to replace'
        : (tag + ' · ' + (s % 2 === 0 ? teamA : teamB));
      el.innerHTML = face
        + '<span class="wait-seat-name"' + botNameAttr(p) + '><span class="wait-seat-name-text">' + escapeHtmlSafe(p.name) + '</span>' + horCareerBadgeHtml(p) + '</span>'
        + '<span class="wait-seat-tag">' + seatTag + '</span>';
    } else if (isHost) {
      el.innerHTML = '<span class="wait-seat-name">Open</span>'
        + '<span class="wait-seat-tag">Tap to seat a bot</span>';
    } else {
      el.innerHTML = '<span class="wait-seat-name">Sit</span>'
        + '<span class="wait-seat-tag">Tap to take this chair</span>';
    }
    try { horBindCareerBadges(el); } catch (e) {}
    el.onclick = (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-botname]') && e._botStyleHeld) return;
      onWaitSeatClick(s);
    };
  }
  try { applyPlaqueColors(); } catch (e) {}
  try { updateWelcomeSeats(); } catch (e) {}
  const humans = players.filter(p => p && !p.isBot && p.seat >= 0).length;
  const bots = players.filter(p => p && p.isBot).length;
  const empty = Math.max(0, 4 - seatedCount());
  const status = $('waitingStatus');
  if (status) {
    if (seatedCount() >= 4) {
      status.innerHTML = `✅ Table full (${humans} player${humans === 1 ? '' : 's'}${bots ? `, ${bots} bot${bots === 1 ? '' : 's'}` : ''}). Host can start.`;
    } else if (isHost) {
      status.innerHTML = `<b>${seatedCount()}/4</b> seated · ${empty} open`;
    } else {
      status.textContent = `Waiting for host… (${seatedCount()}/4 seats filled)`;
    }
  }
  const startBtn = $('startBtn');
  const tableFull = seatedCount() >= 4;
  const waitingRoot = $('waiting');
  if (waitingRoot) waitingRoot.classList.toggle('table-full', tableFull);
  if (startBtn) {
    if (isHost) {
      startBtn.disabled = !tableFull;
      startBtn.classList.remove('hidden');
      startBtn.classList.toggle('table-ready', tableFull);
      startBtn.classList.toggle('table-waiting', !tableFull);
      startBtn.style.display = '';
      startBtn.setAttribute('aria-live', 'polite');
      startBtn.textContent = 'Start Game';

    } else {
      startBtn.classList.add('hidden');
      startBtn.classList.remove('table-ready', 'table-waiting');
    }
  }
  const fillHint = $('fillSeatsHint');
  if (fillHint) {
    fillHint.textContent = empty > 0
      ? `Need ${empty} more seat${empty === 1 ? '' : 's'}: invite friends or set Bots to ${bots + empty}.`
      : '';
    fillHint.classList.toggle('hidden', empty <= 0);
  }
  if (isHost) updateBotButtons();
  try { syncSoloHostExtrasUI(); } catch (e) {}
  window.HORFriends803?.refresh();
}



function setLobbyPortraitOrientation() {
  // Do not lock orientation on the lobby — Android lock/unlock resizes
  // the viewport and makes the lobby photo stretch then snap back.
}

function releaseGameOrientationLock() {
  try {
    if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock();
    }
  } catch (e) {}
}

function showGame() {
  try { horMarkActiveTable(true); } catch (e) {}
  try { document.body.classList.add('in-game'); document.body.classList.remove('at-table', 'at-welcome'); } catch (e) {}
  hideWelcomeScreen();
  if (lobby) lobby.classList.add('hidden');
  if (waiting) waiting.classList.add('hidden');
  if (game && game.phase && game.phase !== 'score') {
    try { hideCelePage(); } catch (e) {}
  }
  if (gameScreen) gameScreen.classList.remove('hidden');
  releaseGameOrientationLock();
  setTimeout(syncLandscapeFullscreen, 80);
  try { syncPortraitLast3Button(); } catch (e) {}
  try { requestAnimationFrame(() => { try { positionPortraitLast3Btn(); } catch (e) {} }); } catch (e) {}
  try { setTimeout(() => { try { positionPortraitLast3Btn(); } catch (e) {} }, 250); } catch (e) {}
  setTimeout(() => fadeSeatMugs(true), 1100);
  try { updatePracticeBadge(); } catch (e) {}
  // Spectator badge (#12)
  let badge = $('spectatorBadge');
  if (isSpectator) {
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'spectatorBadge';
      badge.className = 'spectator-badge';
      badge.textContent = 'WATCHING';
      const bar = $('topBar') || gameScreen;
      if (bar) bar.insertBefore(badge, bar.firstChild);
    }
    badge.classList.remove('hidden');
  } else if (badge) {
    badge.classList.add('hidden');
  }
}

function showVariantRules() {
  const body = document.querySelector('#rulesModal .rules-text');
  if (!body) return;
  const total = totalCountersInDeck(), goal = game?.targetScore || targetScore;
  const line = (title,text) => '<p><b>'+title+'</b> '+text+'</p>';
  body.innerHTML = [
    line('Teams & winning.', 'Four players, partners opposite. Reach '+goal+' points to win. A team at or below −'+goal+' loses; a team reaching the positive target takes precedence. If both reach a target in the same hand, the higher score wins; equal scores tie.'),
    line('Deal & bidding.', 'Each player receives '+handSize+' cards, with '+nestSizeDefault+' in the nest. Minimum bid: '+minBid+'. Bid any amount divisible by five above the current bid, or pass. You may raise by 5, 10, 15, 20, 25 or more. Tap or hold +5 and −5 to choose the amount, then confirm your bid. The highest bidder takes the nest, discards back to '+handSize+' cards, and chooses trump.'),
    line('First lead.', ({bidder:'The bid winner',leftOfBidder:'The player to the left of the bid winner',rightOfBidder:'The player to the right of the bid winner'}[leadOrder]||'The bid winner')+' leads the first trick. Each trick winner leads next.'),
    line('Following color.', 'Follow the led color when you can. '+(specialsAnytime?'The included special cards may be played at any time.':'Included special cards follow the same legal-play rules as the other cards.')+' '+(mustTrumpWhenVoid?'If you cannot follow color, you must play trump when you have one.':'If you cannot follow color, you may play another legal card.')),
    line('Winning tricks.', 'The highest trump wins a trick containing trump; otherwise the highest card of the led color wins. '+(includeOnes?(onesHigh?'1 is highest in its color.':'1 is low in its color.'):'1s are not included.')+' '+(includeRook?('The Bird is '+(rookLowest?'lowest':'above ordinary')+' trump.'):'The Bird is not included.')),
    line('Special trump order.', (includeRed1?'Special Red One is highest. ':'')+(includeRook&&!rookLowest?'The Bird beats Red Two and ordinary trump. ':'')+(includeRed2?'Red Two is permanent trump and beats ordinary trump. ':'')+(includeRook&&rookLowest?'The Bird is lowest trump. ':'')),
    line('Card points.', '5s score 5; 10s and 14s score 10. '+(includeOnes?'Each 1 scores 15. ':'')+(includeRook?'The Bird scores 20. ':'')+(includeRed2?'Red Two is ON and scores '+red2Points+'. ':'Red Two is OFF. ')+(includeRed1?'Special Red One scores 30. ':'')+'Total available: '+total+' points.'),
    line('Nest & reveal.', 'Nest points go to '+(nestGoesTo==='bidder'?'the bidding team.':'the team taking the last trick.')+' Show Top Nest Card is '+(revealTopNest?'ON: everyone sees the top nest card during bidding.':'OFF: no top nest card is shown during bidding.')+' '+(openWidow?'The full nest is revealed to everyone when picked up.':'The full nest is not shown to opponents when picked up.')),
    line('Scoring a bid.', 'Capture at least the bid in points. Make it: your team scores '+(bidOnlyScoring?'the bid amount only.':'all points it captured.')+' Miss it: your team loses the bid amount. Opponents score the points they captured.'),
    line('Shoot the Moon.', shootMoonEnabled?('Bid all '+total+' available points. Your team must capture every point; losing a zero-point trick is allowed. Make it: your team wins the entire game immediately. Miss it: your team loses '+total+' points and opponents score only the points they captured.'):'Shoot the Moon is OFF at this table.'),
    line('Other table rules.', (screwTheDealer?'If everyone passes, the dealer must bid the minimum.':'If everyone passes, the hand is redealt.')+' '+(misdealOnNoCounters?'A hand with no point cards causes a redeal.':'A hand with no point cards does not force a redeal.')+' '+(comebackSpecialChance?'The selected comeback special-card assist is ON.':'Comeback special-card assist is OFF.')+' '+(layDownWinningCards?'A player may use the existing lay-down action when the remaining tricks are guaranteed.':''))
  ].join('');
}

function playToastClink() {
  playNatural063('clink',.65);
}

function playTableToast(done) {
  const waitingOn = waiting && !waiting.classList.contains('hidden');
  const felt = waitingOn ? $('waitingFelt') : document.querySelector('#gameScreen .table-felt');
  if (felt) {
    felt.classList.remove('toasting');
    void felt.offsetWidth;
    felt.classList.add('toasting');
  }
  try { playToastClink(); } catch (e) {}
  setTimeout(() => {
    if (felt) felt.classList.remove('toasting');
    if (typeof done === 'function') done();
  }, 1000);
}

function startGameWithToast() {
  if (!isHost) return;
  if (typeof seatedCount === 'function' && seatedCount() !== 4) {
    hostStartGame();
    return;
  }
  try { broadcast({ type: 'tableToast' }); } catch (e) {}
  playTableToast(() => {
    try { hostStartGame(); } catch (e) {
      console.error(e);
      alert('Start game error: ' + e.message);
    }
  });
}

/** Seats from the host: 0 bottom, 1 left, 2 partner, 3 right.
 *  "To the right" of a seat is -1 (0→3→2→1→0). */
function rotateDealerRight(seat) {
  const s = Number(seat);
  return (Number.isFinite(s) ? s + 3 : 0) % 4;
}
/** First to bid is the seat left of the dealer (standard Rook). */
function firstActorSeat(dealer) {
  const d = Number(dealer);
  return (Number.isFinite(d) ? d + 1 : 0) % 4;
}

function validateRuleSetup(){
  if(minBid>maxBid()){
    const message='Minimum bid '+minBid+' exceeds the '+maxBid()+' points in this deck. Lower the minimum bid or include more point cards in Game Setup.';
    const out=$('messageArea');if(out)out.textContent=message;
    alert(message);return false;
  }
  return true;
}
function hostStartGame() {
  window.HORBidVoice801?.stop();
  window.HORMoonHowl?.stop();
  if (!isHost) return;
  if (tourCardOpen()) {
    afterTourCard(() => hostStartGame());
    return;
  }
  if (seatedCount() !== 4) {
    if (isSoloPractice || roomCode === 'OFFLINE') {
      while (seatedCount() < 4) addBot();
    }
  }
  if (seatedCount() !== 4) {
    const need = 4 - seatedCount();
    alert(`Need 4 players at the table (currently ${seatedCount()} seated).\n\nFriends tap an open seat, or tap an empty chair to seat a bot.`);
    return;
  }

  if(!validateRuleSetup())return;
  // Apply only at a new game boundary; never replace a human or mutate a live hand.
  applyFavoritePartner042();
  // Seat order is the table: 0 bottom host side, 1 left, 2 partner, 3 right
  packPlayersBySeat();
  players = players.filter(p => p && p.seat >= 0).slice(0, 4);
  players.forEach((p, i) => { p.team = i % 2; });
  broadcast({ type: 'players', players: publicPlayersSnapshot() });

  try { targetScore = readTargetScoreFromUI(); } catch (e) {
    const tsEl = $('opt-target-score');
    if (tsEl) targetScore = normalizeTargetScore(parseInt(tsEl.value, 10) || 500);
  }
  const bdEl = $('opt-bot-difficulty');
  if (bdEl) botDifficulty = bdEl.value || 'extreme';
  // Sync coach options from UI at deal time
  try {
    const pnk = $('opt-partner-never-kill'); if (pnk) partnerNeverKill = !!pnk.checked;
    const pfl = $('opt-partner-feed-last'); if (pfl) partnerFeedLast = !!pfl.checked;
    const dsp = $('opt-dont-steal-bid'); if (dsp) dontStealPartnerBid = !!dsp.checked;
    const lbh = $('opt-landscape-hints'); if (lbh) landscapeBidHints = !!lbh.checked;
    const nla = $('opt-nest-anim'); if (nla) nestLastTrickAnim = !!nla.checked;
    const ldw = $('opt-lay-down'); if (ldw) layDownWinningCards = ldw.checked !== false;
  } catch (e) {}
  handHistory = [];
  resetPlayerStats();
  recentTricks = [];
  matchTricks = [];
  lastCompletedTrick = null;
  lastCompletedTrickWinner = null;
  try { hideCelePage(); } catch (e) {}

  try { horMarkActiveTable(true); } catch (e) {}
  window._horStayInGame = true;
  game = {
    phase: 'deal',
    careerMatchId: crypto.randomUUID(),
    careerExtras: [{},{},{},{}],
    players: publicPlayersSnapshot(), // ROOK041: identities exist before first shuffle/deal render
    dealer: Math.floor(Math.random() * 4), // first hand of a match: random dealer / first-to-act
    scores: [0, 0], // team A, team B

    hands: [[], [], [], []],
    nest: [],
    bid: 0,
    bidder: -1,
    trump: null,
    currentPlayer: 0,
    trick: [], // {player, card}
    ledColor: null,
    tricksTaken: [[], []], // cards won by team
    nestCards: [],
    nestRevealCards: [],
    myHand: null,
    passCount: 0,
    highestBid: 65,
    resolvingTrick: false,
    paused: false,
    targetScore,
    botDifficulty,
  };

  broadcast({ type: 'settings', includeRed2, red2Points, targetScore, botDifficulty });
  const td = $('targetDisplay');
  if (td) td.textContent = String(targetScore);
  showHostGameTools(true);
  hostDeal();
}

function horDeveloperToolsEnabled() {
  try {
    const q = new URLSearchParams(location.search);
    const enteredName = String(myName || (($('hor-player-name') && $('hor-player-name').value) || '')).trim().toUpperCase();
    // SOL is Jerome's intentionally quiet, offline developer identity. It is convenience, not security.
    // Offline practice intentionally uses roomCode='OFFLINE', so roomCode emptiness is NOT a valid offline test.
    // Rook529: SOL must unlock reliably in the actual local/offline table.
    const solOffline = enteredName === 'SOL' && (isSoloPractice === true || roomCode === 'OFFLINE' || document.body.classList.contains('offline-play'));
    return solOffline || q.get('dev') === '1' || localStorage.getItem('horDeveloperTools') === '1';
  } catch (e) { return false; }
}

function showHostGameTools(on) {
  const devTools = horDeveloperToolsEnabled();
  document.querySelectorAll('.host-only').forEach(el => {
    if (el.classList.contains('developer-only')) {
      let showDev = !!(on && isHost && devTools);
      if (el.id === 'btnPerfectDeal') showDev = showDev && isHostOnlyHuman() && experimentalHandOpt;
      el.classList.toggle('hidden', !showDev);
      return;
    }
    if (el.id === 'btnPerfectDeal') {
      const showExp = on && isHost && isHostOnlyHuman() && experimentalHandOpt && devTools;
      el.classList.toggle('hidden', !showExp);
      return;
    }
    if (el.id === 'btnGameOptions') {
      el.classList.toggle('hidden', !on);
      return;
    }
    if (on && isHost) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}


const LUCKY_SPIN_VALUES = [0, 10, 20, 30, 40, 50];

function shouldSpinLuckySpecials() {
  return !!(luckySpecialsEnabled && luckySpecialsMode === 'spinner' && isHostOnlyHuman());
}

function currentLuckyBoost() {
  if (!luckySpecialsEnabled || !isHostOnlyHuman()) return 0;
  return Math.max(0, Math.min(50, parseInt(luckySpecialsBoost, 10) || 0));
}

function clearTableForShuffle() {
  try {
    window._ltShowRemaining = false;
    landscapeLastSummary = null;
    recentTricks = [];
    lastCompletedTrick = null;
    lastCompletedTrickWinner = null;
  } catch (e) {}
  const wipe = (id) => { const el = $(id); if (el) el.innerHTML = ''; };
  try {
    wipe('myHand');
    wipe('ltHand');
    wipe('ltPlays');
    wipe('ltMeta');
    wipe('ltFooter');
    wipe('ltLast5Body');
    wipe('ltEndGame');
    const endEl = $('ltEndGame');
    if (endEl) endEl.classList.add('hidden');
    const trick = document.querySelector('.trick-stack');
    if (trick) trick.innerHTML = '';
    const scatter = document.querySelector('.trick-scatter');
    if (scatter) scatter.innerHTML = '';
    document.querySelectorAll('.player-slot .played-card, .player-slot .trick-card-wrap').forEach(n => {
      try { n.remove(); } catch (e) {}
    });
    if (game) {
      game.myHand = [];
      game.trick = [];
      game.trump = null;
      if (game.phase === 'score') game.phase = 'dealing';
  game._firstBidTurnSounded = false;
    }
    try { clearTrumpBanners(); } catch (e) {}
    try { updateLandscapeTheater(); } catch (e) {}
  try { window.HORCharacterStudio077?.sync(); } catch (e) { console.warn('Character presentation:', e); }
  } catch (e) {}
}

function ensureLuckySpinner() {
  let ov = $('luckySpinnerOverlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'luckySpinnerOverlay';
  ov.className = 'lucky-spinner-overlay hidden';
  ov.innerHTML = `
    <div class="lucky-spinner-sheet" role="dialog" aria-label="Lucky specials spinner">
      <div class="lucky-spinner-title">Lucky specials</div>
      <div class="lucky-spinner-sub">Extra chance for Rook &amp; Red 2</div>
      <div class="lucky-wheel-wrap">
        <div class="lucky-wheel-pointer"></div>
        <div class="lucky-wheel" id="luckyWheel">
          <span class="lucky-seg s0">0%</span>
          <span class="lucky-seg s1">10%</span>
          <span class="lucky-seg s2">20%</span>
          <span class="lucky-seg s3">30%</span>
          <span class="lucky-seg s4">40%</span>
          <span class="lucky-seg s5">50%</span>
        </div>
      </div>
      <div class="lucky-spinner-result" id="luckySpinnerResult">Spinning…</div>
    </div>`;
  document.body.appendChild(ov);
  return ov;
}

function runLuckySpinner() {
  return new Promise((resolve) => {
    const ov = ensureLuckySpinner();
    if (ov.parentNode !== document.body) document.body.appendChild(ov);
    ov.classList.remove('hidden');
    const wheel = $('luckyWheel');
    const resultEl = $('luckySpinnerResult');
    const idx = Math.floor(Math.random() * LUCKY_SPIN_VALUES.length);
    const value = LUCKY_SPIN_VALUES[idx];
    const slice = 360 / LUCKY_SPIN_VALUES.length;
    // Labels start at top and go clockwise: 0,10,20,30,40,50
    const target = 360 * 5 + (360 - idx * slice);
    if (wheel) {
      wheel.style.transition = 'none';
      wheel.style.transform = 'rotate(0deg)';
      void wheel.offsetWidth;
      wheel.style.transition = `transform ${solScaledDelay(2400, 0)}ms cubic-bezier(0.12, 0.7, 0.12, 1)`;
      wheel.style.transform = 'rotate(' + target + 'deg)';
    }
    if (resultEl) resultEl.textContent = 'Spinning…';
    setTimeout(() => {
      if (resultEl) resultEl.textContent = value === 0 ? '0% — fair deal' : ('+' + value + '% extra chance');
      setTimeout(() => {
        ov.classList.add('hidden');
        resolve(value);
      }, solScaledDelay(650, 0));
    }, solScaledDelay(2500, 0));
  });
}

function applyLuckySpecialsToHostHand() {
  if (!game || !Array.isArray(game.hands)) return;
  if (!isHostOnlyHuman()) return;
  const boost = currentLuckyBoost();
  if (!boost) return;
  const hostSeat = (typeof myIndex === 'number' && myIndex >= 0)
    ? myIndex
    : Math.max(0, players.findIndex(p => p && p.isHost));
  if (hostSeat < 0) return;
  const hostHand = game.hands[hostSeat];
  if (!hostHand || !hostHand.length) return;

  const pulled = [];
  const pullSpecial = (pred, label) => {
    if (hostHand.some(pred)) {
      pulled.push(label + ' already dealt');
      return false;
    }
    if (Math.random() * 100 >= boost) return false;
    const pools = [];
    if (Array.isArray(game.nest)) pools.push(game.nest);
    game.hands.forEach((h, i) => { if (i !== hostSeat && Array.isArray(h)) pools.push(h); });
    let from = null;
    let idx = -1;
    for (const pool of pools) {
      idx = pool.findIndex(pred);
      if (idx >= 0) { from = pool; break; }
    }
    if (!from || idx < 0) return false;
    const give = from.splice(idx, 1)[0];
    const dumpIdx = Math.floor(Math.random() * hostHand.length);
    from.push(hostHand[dumpIdx]);
    hostHand[dumpIdx] = give;
    pulled.push(label);
    return true;
  };

  if (includeRook) pullSpecial(c => c && (c.id === 'rook' || c.color === 'rook'), 'Bird');
  if (includeRed2) pullSpecial(c => c && (typeof isRed2 === 'function' ? isRed2(c) : c.id === 'red-2'), 'Red 2');
  const ma = $('messageArea');
  if (ma && pulled.length) {
    const got = pulled.filter(s => s === 'Bird' || s === 'Red 2');
    ma.textContent = got.length
      ? ('Lucky specials: ' + got.join(' + ') + ' in your hand (+' + boost + '%)')
      : ('Lucky specials +' + boost + '% — no extra pull this hand');
  }
}

function hostDeal() {
  if (luckySpinning) return;
  try { clearTableForShuffle(); } catch (e) {}
  if (shouldSpinLuckySpecials()) {
    luckySpinning = true;
    runLuckySpinner().then((pct) => {
      luckySpecialsBoost = pct;
      luckySpinning = false;
      hostDealNow();
    }).catch(() => {
      luckySpinning = false;
      hostDealNow();
    });
    return;
  }
  hostDealNow();
}

/**
 * Quiet comeback dealing: when a team is more than 75% of the match target
 * behind, increase that team's normal odds of receiving each included special
 * card by an additional 25% of those normal odds. This is deliberately hidden
 * from the UI and applies independently to the Bird, Red 2, and special Red 1.
 */
function applyComebackSpecialChance() {
  if (!comebackSpecialChance) return;
  if (!game || !Array.isArray(game.hands) || !Array.isArray(players)) return;
  const goal = Number(game.targetScore || targetScore || 500);
  const scores = Array.isArray(game.scores) ? game.scores : [0, 0];
  if (!(goal > 0) || scores.length < 2) return;

  const high = Math.max(Number(scores[0] || 0), Number(scores[1] || 0));
  const low = Math.min(Number(scores[0] || 0), Number(scores[1] || 0));
  if ((high - low) <= goal * 0.75) return;

  const losingTeam = Number(scores[0] || 0) < Number(scores[1] || 0) ? 0 : 1;
  const losingSeats = players.map((p, i) => {
    const team = (p && typeof p.team === 'number') ? p.team : (i % 2);
    return team === losingTeam ? i : -1;
  }).filter(i => i >= 0 && Array.isArray(game.hands[i]));
  if (!losingSeats.length) return;

  const specials = [];
  if (includeRook) specials.push(c => c && (c.id === 'rook' || c.color === 'rook'));
  if (includeRed2) specials.push(c => c && (typeof isRed2 === 'function' ? isRed2(c) : c.id === 'red-2'));
  if (includeRed1) specials.push(c => c && (c.id === 'red1-special' || c.specialRed1 === true));

  // A normal deal gives each included special the same chance of landing in
  // either partnership's player hands. Boost that existing probability by 25%
  // rather than replacing it with a flat 25% roll.
  const totalPlayerCards = game.hands.reduce((n, h) => n + (Array.isArray(h) ? h.length : 0), 0);
  const losingPlayerCards = losingSeats.reduce((n, i) => n + game.hands[i].length, 0);
  const normalOdds = totalPlayerCards > 0 ? (losingPlayerCards / totalPlayerCards) : 0;
  const boostedOdds = Math.min(1, normalOdds * 1.25);
  if (!(boostedOdds > 0)) return;

  const moveSpecialToLosingTeam = (predicate) => {
    const alreadyThere = losingSeats.some(i => game.hands[i].some(predicate));
    if (alreadyThere) return;

    // Only use the hidden boost when the normal deal did not already give it
    // to the losing team. The conditional probability below makes the final
    // chance equal to normalOdds * 1.25, not a separate 25% chance.
    const correction = (boostedOdds - normalOdds) / Math.max(0.000001, 1 - normalOdds);
    if (Math.random() >= correction) return;

    let source = null, sourceIndex = -1;
    for (let i = 0; i < game.hands.length; i++) {
      if (losingSeats.includes(i)) continue;
      const hand = game.hands[i];
      if (!Array.isArray(hand)) continue;
      const idx = hand.findIndex(predicate);
      if (idx >= 0) { source = hand; sourceIndex = idx; break; }
    }
    if (!source || sourceIndex < 0) {
      const nest = Array.isArray(game.nest) ? game.nest : [];
      const idx = nest.findIndex(predicate);
      if (idx >= 0) { source = nest; sourceIndex = idx; }
    }
    if (!source || sourceIndex < 0) return;

    const recipient = losingSeats[Math.floor(Math.random() * losingSeats.length)];
    const hand = game.hands[recipient];
    const special = source.splice(sourceIndex, 1)[0];
    if (!hand.length) { hand.push(special); return; }
    const dumpIndex = Math.floor(Math.random() * hand.length);
    source.push(hand[dumpIndex]);
    hand[dumpIndex] = special;
  };

  specials.forEach(moveSpecialToLosingTeam);
}

function hostDealNow() {
  window.HORBidVoice801?.stop();
  recentTricks = [];
  lastCompletedTrick = null;
  lastCompletedTrickWinner = null;
  landscapeLastSummary = null;
  window._ltShowRemaining = false;
  try {
    const endEl = $('ltEndGame');
    if (endEl) { endEl.classList.add('hidden'); endEl.innerHTML = ''; }
  } catch (e) {}
  if (game) { game.topNestCard = null; game.nestFlipStage = 0; game.nestFlipped = false; }
  window._horPinnedNestFace = null;
  window._horNestPileSig = '';
  window._horNestFlipHand = '';
  window._horNestFlipTok = (window._horNestFlipTok || 0) + 1;
  const deck = shuffle(makeDeck());
  const hs = handSize || 9;
  const needed = hs * 4;
  // Nest gets the rest, preferring preset nest size
  let nestCount = Math.max(0, deck.length - needed);
  if (nestCount < 1 && deck.length > needed) nestCount = deck.length - needed;
  // Prefer nestSizeDefault when deck allows
  if (deck.length >= needed + nestSizeDefault) {
    nestCount = nestSizeDefault;
  }
  game.nest = deck.splice(0, nestCount);
  // Any leftover cards beyond 4 hands go into nest
  while (deck.length > needed) {
    game.nest.push(deck.pop());
  }
  for (let i = 0; i < 4; i++) {
    game.hands[i] = deck.splice(0, hs);
  }
  try { applyLuckySpecialsToHostHand(); } catch (e) {}
  try { applyComebackSpecialChance(); } catch (e) {}
  for (let i = 0; i < 4; i++) {
    sortCardsDisplay(game.hands[i]);
  }
  try { freezeTopNestCard(); } catch (e) { game.topNestCard = null; }
  try { applyForcedNestReveal(); } catch (e) {}
  // House rule: misdeal & redeal if any hand has zero counter cards (no)
  // 5/10/14/one/Rook/Red 1/Red 2 at all) — nobody could bid meaningfully.
  // Bounded retry count so a pathological deck config can't loop forever.
  if (misdealOnNoCounters) {
    const anyHandLacksCounters = game.hands.some(h => !h.some(c => cardPoints(c) > 0));
    if (anyHandLacksCounters) {
      window._horMisdealRetries = (window._horMisdealRetries || 0) + 1;
      if (window._horMisdealRetries < 12) {
        hostDealNow();
        return;
      }
      window._horMisdealRetries = 0; // give up — deal stands rather than loop forever
    } else {
      window._horMisdealRetries = 0;
    }
  }
  knownVoids = [{}, {}, {}, {}];
  lastTurnIndex = -1;
  window._turnOppKey = '';
  window._lastTurnBeepKey = '';
  lastTrickLen = 0;

  game.currentPlayer = firstActorSeat(game.dealer);
  game.passCount = 0;
  game.highestBid = (minBid || 70) - 5;
  game.bidder = -1;
  game.bid = 0;
  game.shotTheMoon = false;
  // A new hand starts with no called trump.  Clear the previous hand's
  // trump before dealing/rendering so old trump highlights do not leak
  // into the new bidding phase.
  game.trump = null;
  try { clearTrumpBanners(); } catch (e) {}
  game.bidStatus = [null, null, null, null]; // null | 'pass' | number
  game.phase = 'dealing';
  game.players = publicPlayersSnapshot(); // Refresh seats before dealing, rather than after it.
  game.myHand = [];
  game.claimDeclined = false;
  game.claimAnimation = null;
  game.claimAnimating = false;
  game.revealedHands = null;
  game.trumpClaimPlayer = null;
  game.claimRevealHands = null;
  try { clearClaimOverlays(); } catch (e) {
    window._claimAnimPlaying = false;
    try {
      const lay = $('claimLaydownLayer');
      if (lay && lay.parentNode) lay.parentNode.removeChild(lay);
    } catch (e2) {}
  }

  try { showGame(); } catch (e) {}
  // Shuffle SFX is played inside runDealPresentation for each human seat

  // Public "dealing" state so clients show table (no bidding yet)
  try {
    broadcast({
      type: 'state',
      phase: 'dealing',
      scores: game.scores,
      bid: 0,
      highestBid: (minBid || 100) - 5,
      minBid: minBid || 100,
      bidder: -1,
      trump: null,
      currentPlayer: game.currentPlayer,
      trick: [],
      ledColor: null,
      players: publicPlayersSnapshot(),
      dealer: game.dealer,
      nestCount: game.nest.length,
      topNestCard: game.topNestCard ? { ...game.topNestCard } : null,
      handsCount: [0, 0, 0, 0],
      targetScore: game.targetScore || targetScore,
      bidStatus: game.bidStatus,
    });
  } catch (e) {}

  // Personalized deal animation for each human; host waits for own presentation
  const myHandCopy = (game.hands[myIndex] || []).map(c => ({ ...c }));
  players.forEach((p, i) => {
    if (p.isBot) return;
    if (p.id === myPeerId) return;
    const handCopy = (game.hands[i] || []).map(c => ({ ...c }));
    sendTo(p.id, { type: 'privateHand', hand: handCopy, animateDeal: true });
  });

  const finishDeal = () => {
    if (!game) return;
    game.phase = 'bidding';
    game.myHand = (game.hands[myIndex] || []).map(c => ({ ...c }));
    try { applyFirstHandChrome(); } catch (e) {}
    try { renderTopNestPeek(); } catch (e) {}
    broadcastState();
    try { scheduleTopNestFlip(); } catch (e) {}
    setTimeout(() => {
      try {
        if (game && game.phase === 'bidding' && !game.nestAuctionOpen) openNestAuction();
      } catch (e) {}
    }, solScaledDelay(2800, 120));
    if (revealTopNest) return;
    try {
      showBiddingIntro(() => {
        try { hostPromptBid(); } catch (e) { console.error(e); }
      });
      broadcast({ type: 'biddingIntro', minBid: minBid || 100 });
    } catch (e) {
      try { hostPromptBid(); } catch (e2) {}
    }
  };

  if (myIndex >= 0 && myHandCopy.length) {
    runDealPresentation(myHandCopy, finishDeal);
  } else {
    // Spectator host edge case — still wait shuffle length then continue
    setTimeout(finishDeal, solScaledDelay(shuffleAnimDuration762() + (hs * (isPortraitViewport() ? 122 * 4 : CARD_DEAL_MS)) + 200, 120));
  }
}



/** True if this seat passed in the *current auction only* (reset each deal; never skips play) */
function hasPassedBid(idx) {
  if (!game || game.phase !== 'bidding') return false;
  return !!(game.bidStatus && game.bidStatus[idx] === 'pass');
}

/** Advance currentPlayer to next seat that has not passed; return false if none left to act */
function nextActiveBidder() {
  if (!game) return false;
  if (!game.bidStatus) game.bidStatus = [null, null, null, null];
  for (let step = 0; step < 4; step++) {
    game.currentPlayer = (game.currentPlayer + 1) % 4;
    if (!hasPassedBid(game.currentPlayer)) return true;
  }
  return false;
}

function countPassedBids() {
  if (!game || !game.bidStatus) return 0;
  return game.bidStatus.filter(s => s === 'pass').length;
}

// Shared "everyone passed" handler: normally redeals, but with the "Screw
// the Dealer" house rule the dealer is forced to take the bid at the
// minimum instead, so the hand keeps moving instead of reshuffling.
function hostHandleAllPassed() {
  if (screwTheDealer) {
    const d = game.dealer;
    const dname = (players[d] && players[d].name) || ('P' + (d + 1));
    const forcedBid = minBid || 100;
    if (!game.bidStatus) game.bidStatus = [null, null, null, null];
    game.bidder = d;
    game.bid = forcedBid;
    game.highestBid = forcedBid;
    game.bidStatus[d] = forcedBid;
    const msg = `Everyone passed — ${dname} is screwed and must bid ${forcedBid}.`;
    const ma = $('messageArea');
    if (ma) ma.textContent = msg;
    broadcast({ type: 'message', text: msg });
    try { playSfx('bid', { broadcastNet: true }); } catch (e) {}
    finishBidding();
  } else {
    $('messageArea').textContent = 'All passed – redealing…';
    broadcast({ type: 'message', text: 'All passed – redealing…' });
    setTimeout(() => hostDeal(), 1500);
  }
}

function hostPromptBid() {
  try { renderTopNestPeek(); } catch (e) {}
  if (!game || game.paused) return;
  if (nestAuctionLocked()) {
    const msg = 'Watch the nest…';
    try { const ma = $('messageArea'); if (ma) ma.textContent = msg; } catch (e) {}
    return;
  }
  // Auction already decided — don't re-prompt
  if (game.bidder >= 0 && countPassedBids() >= 3) {
    finishBidding();
    return;
  }
  // Skip anyone who already passed (safety if pointer lands on them)
  if (hasPassedBid(game.currentPlayer)) {
    if (!nextActiveBidder()) {
      if (game.bidder >= 0) finishBidding();
      else hostHandleAllPassed();
      return;
    }
  }
  // Only the high bidder left active → end (don't ask them to bid again)
  if (game.bidder >= 0) {
    let onlyBidderLeft = true;
    for (let i = 0; i < 4; i++) {
      if (i === game.bidder) continue;
      if (!hasPassedBid(i)) { onlyBidderLeft = false; break; }
    }
    if (onlyBidderLeft) {
      finishBidding();
      return;
    }
  }
  const p = players[game.currentPlayer];
  const msg = `${p.name}'s turn to bid (min ${auctionNextMin()})`;
  $('messageArea').textContent = msg;
  broadcast({ type: 'message', text: msg });

  if (game.currentPlayer === myIndex && !horSolSeatIsBot()) {
    showBidUI();
    try { maybeRemindTurn(); } catch (e) {}
  } else {
    hideActionPanel();
    window._turnOppKey = '';
  }
  startTurnTimer();
  scheduleBot();
}


/** Float action panel above landscape theater (outside #app which is visibility:hidden). */
function ensureActionPanelOnTop() {
  const panel = $('actionPanel');
  if (!panel) return null;
  // Re-parent to body so landscape #app { visibility:hidden } cannot block it
  if (panel.parentElement !== document.body) {
    panel.dataset.homeParent = panel.parentElement ? panel.parentElement.id || '' : '';
    document.body.appendChild(panel);
  }
  panel.classList.add('lt-floating-panel');
  return panel;
}

function restoreActionPanelHome() {
  const panel = $('actionPanel');
  if (!panel) return;
  panel.classList.remove('lt-floating-panel');
  // Prefer original game-room slot
  const home = document.querySelector('.game-room') || $('app') || document.body;
  if (panel.parentElement !== home && home) {
    home.appendChild(panel);
  }
}

function liftOverlayToBody(el, extraClass) {
  if (!el) return;
  try {
    if (el.parentElement !== document.body) document.body.appendChild(el);
    if (extraClass) el.classList.add(extraClass);
  } catch (e) {}
}

function syncLandscapeClaimBar() {
  const bar = $('ltClaimBar');
  if (bar) bar.classList.add('hidden');
}

/** Landscape-native trump controls. Kept inside the theater so they remain visible
 * while #app is hidden in landscape. */
function syncLandscapeTrumpBar() {
  const bar = $('ltTrumpBar');
  const buttons = $('ltTrumpButtons');
  if (!bar || !buttons) return;
  const show = !!(game && game.phase === 'trump' && game.bidder === myIndex && !isSpectator);
  if (!show) {
    bar.classList.add('hidden');
    buttons.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');
  if (!buttons.children.length) {
    buttons.innerHTML = COLORS.map(c =>
      `<button type="button" class="btn trump-btn ${c}" data-trump="${c}">${COLOR_NAMES[c]}</button>`
    ).join('');
    buttons.querySelectorAll('[data-trump]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!game || game.phase !== 'trump' || game.bidder !== myIndex) return;
        submitTrump(btn.dataset.trump);
      };
    });
  }
}

/** Suggested bid amount shared by portrait panel + landscape bar */
let _ltBidSuggested = 0;

function placeActionPanelAboveSeat() {
  const panel = $('actionPanel');
  if (!panel || panel.classList.contains('hidden')) return;
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  const seat = landscape
    ? ($('ltHandWrap') || $('ltHand') || document.querySelector('.lt-hand-wrap'))
    : $('slot-me');
  if (!seat) return;
  const r = seat.getBoundingClientRect();
  const h = panel.offsetHeight || 110;
  let top = Math.round(r.top - h - 8);
  if (top < 6) top = 6;
  panel.style.position = 'fixed';
  panel.style.left = '50%';
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
  panel.style.top = top + 'px';
  panel.style.transform = 'translateX(-50%)';
  panel.style.zIndex = '140000';
  if (panel.classList.contains('bid-panel')) {
    panel.style.width = '300px';
    panel.style.maxWidth = '92vw';
    panel.style.height = 'auto';
    panel.style.minHeight = '0';
    panel.style.padding = '6px 8px';
  }
}
// R706: the approved decisionConsole is the only bidding component.
// Historical callers remain compatible; no landscape bidder is created or wired.
function refreshLandscapeFeltBid() {}
function syncLandscapeBidBar() {}
function waitBannerCopy(phase, name) {
  if (phase === 'discard') {
    return {
      kicker: 'The nest is open',
      title: name + ' is burying cards',
      sub: 'Sorting the kitty · your hand stays put'
    };
  }
  return {
    kicker: 'Trump is being named',
    title: name + ' won the bid',
    sub: 'Choosing the color · hold the line'
  };
}

function syncWaitBanners() {
  // Rook584: retire the two large portrait/landscape waiting rectangles.
  // The existing seat-owned transient pill is the single status owner.
  try {
    const pt = $('ptWaitBanner'); if (pt) pt.classList.add('hidden');
    const lt = $('ltKittyWait'); if (lt) lt.classList.add('hidden');
    document.body.classList.remove('pt-wait-open', 'lt-wait-open');
  } catch (e) {}

  try {
    const el = $('botThinking');
    const phase = game && game.phase;
    const waiting = !!(game && (phase === 'discard' || phase === 'trump') && game.bidder !== myIndex && !isSpectator);
    if (!el) return;
    if (!waiting) {
      // Do not hide a normal play-phase Thinking… pill owned by setBotThinking().
      if (phase === 'discard' || phase === 'trump') el.classList.add('hidden');
      return;
    }
    el.textContent = phase === 'discard' ? 'Sorting…' : 'Picking trump…';
    el.classList.remove('hidden');
    requestAnimationFrame(positionBotThinkingAtSeat);
  } catch (e) {}
}

// Legacy wait-banner entry points remain callable by old refresh paths, but they
// now delegate to the single compact status owner instead of drawing rectangles.
function syncPortraitWaitBanner() { syncWaitBanners(); }
function syncLandscapeKittyWait() { syncWaitBanners(); }

function showBidUI() {
  try { if(window.HORBidRepair737?.required()){const tip=$('botStyleTip');if(tip&&!tip.classList.contains('hidden')){hideBotStyleTip();horToast('Your bid is due. Player details are available after bidding.');}} } catch (e) {}
  if (nestAuctionLocked()) return;
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  const nextMin = auctionNextMin();
  const ceiling = bidCeilingFor(myIndex) || 180;
  let suggested = Math.min(ceiling, Math.max(nextMin, parseInt(minBid, 10) || 100));
  if (!Number.isFinite(suggested)) suggested = nextMin;
  _ltBidSuggested = suggested;
  const highNum = auctionHigh();
  const high = highNum > 0 ? highNum : '—';
  const bidderName = (players[myIndex] && players[myIndex].name) || myName || 'Player';
  const html = `<div class="bid-console-title"><img class="bid-title-griffin-left" src="assets/images/griffin-icon.png?v=635" alt=""><span>PLACE YOUR BID</span><img class="bid-title-griffin-right" src="assets/images/griffin-icon.png?v=635" alt=""></div>
      <div class="felt-bid-name">${bidderName}</div>
      <div class="bid-meta" aria-hidden="true"></div>
      <div class="bid-stepper">
        <button type="button" class="btn" id="bidMinus" aria-label="Lower bid">−5</button>
        <span id="bidValue" aria-live="polite" aria-label="Selected bid" class="bid-value${isShootMoonBid(suggested) ? ' is-moon' : ''}">${suggested}</span>
        <button type="button" class="btn" id="bidPlus" aria-label="Raise bid">+5</button>
      </div>
      <div class="bid-buttons">
        <button class="btn primary${isShootMoonBid(suggested) ? ' bid-shoot-moon' : ''}" id="bidConfirm">${isShootMoonBid(suggested) ? '<img class="moon-approved-button795" src="assets/images/shoot-moon-crescent-approved.png" alt="Shoot the Moon">' : ('Bid <span id="bidConfirmVal">' + suggested + '</span>')}</button>
        <button class="btn danger" id="bidPassBtn">Pass</button>
      </div>`;
  const dock = $('decisionConsole');
  if (dock) { dock.classList.remove('decision-mode-trump'); dock.classList.add('decision-mode-bid'); dock.style.left=''; dock.style.top=''; dock.style.transform=''; }
  const panel = $('actionPanel');
  try { hideActionPanel(); } catch (e) {}
  try { const oldBar=$('ltBidBar'); if(oldBar) oldBar.classList.add('hidden'); } catch(e){}
  if (panel) { panel.classList.add('hidden'); panel.classList.remove('trump-showdown'); panel.innerHTML=''; }
  if (dock) {
    dock.innerHTML = html;
    dock.classList.remove('hidden');
  }
  {
    const valEl = $('bidValue');
    const confBtn = $('bidConfirm');
    const sync = () => {
      if (valEl) {
        valEl.textContent = String(suggested);
        valEl.classList.toggle('is-moon', isShootMoonBid(suggested));
      }
      if (confBtn) {
        confBtn.disabled = !Number.isSafeInteger(suggested) || suggested % 5 !== 0 || suggested < nextMin || suggested > ceiling;
        confBtn.setAttribute('data-live-bid', Number.isSafeInteger(suggested)?String(suggested):'');
        if (!Number.isSafeInteger(suggested) || suggested % 5 !== 0){confBtn.textContent='Use multiples of 5';confBtn.classList.remove('bid-shoot-moon');}
        else if (isShootMoonBid(suggested)) {
          confBtn.innerHTML = '<img class="moon-approved-button795" src="assets/images/shoot-moon-crescent-approved.png" alt="Shoot the Moon">';
          confBtn.classList.add('bid-shoot-moon');
        } else {
          confBtn.classList.remove('bid-shoot-moon');
          confBtn.innerHTML = 'Bid <span id="bidConfirmVal">' + suggested + '</span>';
        }
      }
      _ltBidSuggested = suggested;
      try { syncLandscapeBidBar(); } catch (e) {}
    };
    if (confBtn) confBtn.disabled = !Number.isSafeInteger(suggested) || suggested % 5 !== 0 || suggested < nextMin || suggested > ceiling;
    const minus = $('bidMinus');
    const plus = $('bidPlus');
    const conf = $('bidConfirm');
    const pass = $('bidPassBtn');
    if (conf) conf.setAttribute('data-live-bid', String(suggested));
    if (minus) minus.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      try { playSfx('bidDown'); } catch (err) {}
      suggested = Math.max(nextMin, (Number.isSafeInteger(suggested)&&suggested%5===0?suggested:nextMin)-5); sync();
    };
    if (plus) plus.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      try { playSfx('bidUp'); } catch (err) {}
      suggested = Math.min(ceiling, (Number.isSafeInteger(suggested)&&suggested%5===0?suggested:nextMin)+5); sync();
    };
    // Hold repeats the same legal +/-5 click operation; the auction remains authoritative.
    window.HORBidHold795?.bind(minus, plus, () => game?.phase==='bidding' && game.currentPlayer===myIndex && !game.paused && !isSpectator);
    if (conf) conf.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      try { playSfx('bidUp'); } catch (err) {}
      if (isShootMoonBid(suggested)) {
        showApprovedMoonDeclaration(suggested, () => {
          // Rook653: BACK DOWN is not Pass; resume ordinary bidding at 195.
          suggested = maxBid() - 5;
          sync();
        });
      } else {
        submitBid(suggested);
      }
    };
    if (pass) pass.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      try { playSfx('bidDown'); } catch (err) {}
      submitBid(0);
    };
  }
  try {
    const bar = $('ltBidBar');
    if (bar) bar.classList.add('hidden');
  } catch (e) {}
  requestAnimationFrame(() => {
    try { placeActionPanelAboveSeat(); } catch (e) {}
    setTimeout(() => { try { placeActionPanelAboveSeat(); } catch (e) {} }, 80);
  });
  try { maybeRemindTurn(); } catch (e) {}
}


// Rook648: restore the previously approved dedicated Shoot-the-Moon presentation.
// This is a decision gate only: it never owns bidding, discard, trump, or scoring.
function closeApprovedMoonDeclaration() {
  const old = document.querySelector('.moon-approved-overlay');
  if (old) old.remove();
}
function showApprovedMoonDeclaration(value, onBackDown) {
  closeApprovedMoonDeclaration();
  if (!shootMoonEnabled || !isShootMoonBid(value) || !moonBidAllowed(myIndex)) return false;
  // Warm the confirmed cue while the player reviews the declaration so the
  // wolf starts immediately on the second confirmation.
  try { window.HORMoonHowl?.preload(); } catch (e) {}
  const ov = document.createElement('div');
  ov.className = 'moon-approved-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Shoot the Moon confirmation');
  ov.innerHTML = '<div class="moon-approved-card">' +
    '<img class="moon-approved-art" src="assets/images/shoot-the-moon-approved.jpg" alt="Gold griffin under a full moon" aria-hidden="true">' +
    '<div class="moon-live-points">' + value + ' POINTS</div>' +
    '<div class="moon-live-rules"><span>Capture all ' + value + ' points. Zero-point tricks may be lost.</span><strong>MAKE IT: Win the entire game.</strong><span>MISS IT: Your team loses ' + value + ' points. Opponents score captured points.</span></div>' +
    '<div class="moon-approved-actions">' +
      '<button type="button" data-moon-confirm aria-label="Shoot the Moon">SHOOT THE MOON</button>' +
      '<button type="button" data-moon-back aria-label="Back Down">BACK DOWN</button>' +
    '</div></div>';
  document.body.appendChild(ov);
  const confirm = ov.querySelector('[data-moon-confirm]');
  const back = ov.querySelector('[data-moon-back]');
  if (confirm) confirm.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    closeApprovedMoonDeclaration();
    submitBid(value, { moonConfirmed: true });
  };
  if (back) {
    let backHandled = false;
    const doBackDown = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (backHandled) return;
      backHandled = true;
      closeApprovedMoonDeclaration();
      _ltBidSuggested = maxBid() - 5;
      if (typeof onBackDown === 'function') {
        onBackDown();
      } else {
        try {
          if (game && game.phase === 'bidding' && game.currentPlayer === myIndex && !isSpectator) showBidUI();
        } catch (err) {}
      }
    };
    back.addEventListener('pointerup', doBackDown);
    back.addEventListener('click', doBackDown);
  }
  return true;
}
function positionSeatLeadTags() {
  try {
    document.querySelectorAll('.player-slot').forEach(slot=>{
      const tag=slot.querySelector(':scope > .seat-lead-tag');
      if(!tag || tag.classList.contains('hidden')) return;
      if (window.HORCharacterStudio077?.positionLead(tag)) return;
      const av=slot.querySelector('.seat-avatar,.seat-avatar-side');
      if(!av) return;
      const sr=slot.getBoundingClientRect(), ar=av.getBoundingClientRect();
      tag.style.setProperty('left',(ar.left-sr.left+ar.width/2)+'px','important');
      tag.style.setProperty('right','auto','important');
      tag.style.setProperty('top',(ar.top-sr.top+Math.max(1,ar.height*.04))+'px','important');
      tag.style.setProperty('bottom','auto','important');
      tag.style.setProperty('transform','translate(-50%,-35%)','important');
    });
  } catch(e) {}
}

function horPlaceSeatAttachment(el, slot, side, gapPx) {
  if (!el || !slot) return;
  const av = slot.querySelector('.seat-avatar,.seat-avatar-side');
  if (!av) return;
  const sr=slot.getBoundingClientRect(), ar=av.getBoundingClientRect();
  const sx=sr.width/Math.max(1,slot.offsetWidth||sr.width), sy=sr.height/Math.max(1,slot.offsetHeight||sr.height);
  const cx=(ar.left+ar.width/2-sr.left)/Math.max(.01,sx), cy=(ar.top+ar.height/2-sr.top)/Math.max(.01,sy);
  const aw=ar.width/Math.max(.01,sx), ah=ar.height/Math.max(.01,sy), gap=(gapPx||5);
  el.style.cssText=''; el.style.setProperty('position','absolute','important'); el.style.setProperty('margin','0','important'); el.style.setProperty('z-index','120','important');
  el.style.setProperty('right','auto','important'); el.style.setProperty('bottom','auto','important');
  // Rook626: side-seat bid pills live BELOW the avatar, centered on the avatar.
  // The previous inward left/right anchors pushed 72px-wide pills into the card-play lane.
  if(side==='left'||side==='right'){el.style.setProperty('left',cx+'px','important');el.style.setProperty('top',(cy+ah/2+gap)+'px','important');el.style.setProperty('transform','translateX(-50%)','important');}
  else if(side==='top'){el.style.setProperty('left',cx+'px','important');el.style.setProperty('top',(cy+ah/2+gap)+'px','important');el.style.setProperty('transform','translateX(-50%)','important');}
  else {el.style.setProperty('left',cx+'px','important');el.style.setProperty('top',(cy-ah/2-gap)+'px','important');el.style.setProperty('transform','translate(-50%,-100%)','important');}
}
function positionSeatBidBadges() {
  if (game?.phase === 'bidding' && window.HORUnifiedBidding752) { window.HORUnifiedBidding752.position(); return; }
  try {
    const sides={'slot-left':'left','slot-right':'right','slot-partner':'top','slot-me':'bottom'};
    Object.entries(sides).forEach(([sid,side])=>{const slot=$(sid);if(!slot)return;const bb=slot.querySelector(':scope > .bid-badge:not(.hidden)');if(bb)horPlaceSeatAttachment(bb,slot,side,5);});
  } catch(e) {}
}

function positionMoonBidBadge() {
  // Rook591: compatibility entry point only. Bid badges have one positioning owner.
  try { positionSeatBidBadges(); } catch (e) {}
}


function submitBid(val, opts) {
  let value = val === 0 || val === '0' ? 0 : parseInt(val, 10);
  if (value !== 0 && !Number.isFinite(value)) {
    try { showBidUI(); } catch (e) {}
    const ma = $('messageArea');
    if (ma) ma.textContent = 'Bid did not go through — pick an amount and tap Bid again.';
    return;
  }
  if (value !== 0 && isShootMoonBid(value) && !moonBidAllowed(myIndex)) {
    const ma = $('messageArea');
    if (ma) ma.textContent = 'Shoot the Moon is turned off for this game.';
    return;
  }
  // Rook648: a human Moon bid must pass through the approved declaration gate.
  if (value !== 0 && isShootMoonBid(value) && !(opts && opts.moonConfirmed)) {
    showApprovedMoonDeclaration(value, () => {
      try {
        _ltBidSuggested = maxBid() - 5;
        showBidUI();
        const v = $('bidValue');
        const b = $('bidConfirm');
        if (v) { v.textContent = String(maxBid() - 5); v.classList.remove('is-moon'); }
        if (b) {
          b.classList.remove('bid-shoot-moon');
          b.setAttribute('data-live-bid', String(maxBid() - 5));
          b.innerHTML = 'Bid <span id="bidConfirmVal">' + (maxBid() - 5) + '</span>';
        }
      } catch (e) {}
    });
    return;
  }
  if (isHost) {
    hostProcessBid({ player: myIndex, value, voiceLine: true, actionId: horNewActionId('bid') });
  } else {
    const sent = horQueueClientAction({ type: 'bid', player: myIndex, value, voiceLine: true });
    if (!sent) {
      const ma = $('messageArea');
      if (ma) ma.textContent = 'Bid saved — sending when the table reconnects…';
      horBeginClientReconnect();
    }
  }
  // Host validation is synchronous. A rejected bid leaves this same human
  // turn active; do not clear the decision controls in that case.
  const stillRequired = isHost && game && game.phase === 'bidding'
    && game.currentPlayer === myIndex && !game.paused && !hasPassedBid(myIndex);
  if (!stillRequired) hideActionPanel();
  try {
    const bar = $('ltBidBar');
    if (bar) bar.classList.add('hidden');
  } catch (e) {}
}


function hostProcessBid(data) {
  if (!game || game.phase !== 'bidding' || game.paused) return;
  if (nestAuctionLocked()) return;
  if (!data || data.player !== game.currentPlayer) return;
  if (players[data.player] && players[data.player].disconnected) return;
  if (horRememberAction(data)) return;
  if (data.value !== 0) {
    if (!['number','string'].includes(typeof data.value) || String(data.value).trim()==='') return;
    data.value = Number(data.value);
    if (!Number.isSafeInteger(data.value)) return;
  }
  // Once you pass, you are out of this auction — ignore further bids from you
  if (hasPassedBid(data.player) && data.value !== 0) return;
  if (hasPassedBid(data.player) && data.value === 0) {
    // already passed; skip ahead
    if (!nextActiveBidder()) {
      if (game.bidder >= 0) finishBidding();
      else hostHandleAllPassed();
      return;
    }
    broadcastState();
    hostPromptBid();
    return;
  }
  if(data.value!==0 && (data.value % 5 !== 0 || data.value < (Number(minBid)||100) || data.value<=auctionHigh() || data.value>maxBid() || (isShootMoonBid(data.value)&&!moonBidAllowed(data.player)))) return;
  clearTurnTimer();
  if (!game.bidStatus) game.bidStatus = [null, null, null, null];
  const pname = (players[data.player] && players[data.player].name) || ('P' + (data.player + 1));

  if (data.value === 0) {
    game.bidStatus[data.player] = 'pass';
    game.passCount = countPassedBids();
    const passMsg = `${pname} passes`;
    const ma = $('messageArea');
    if (ma) ma.textContent = passMsg;
    broadcast({ type: 'message', text: passMsg });
    try { playSfx('pass', { broadcastNet: true }); } catch (e) {}
    if (data.voiceLine === true || players[data.player]?.isBot) window.HORBidVoice801?.announce(data.player, 'pass', 0);
    try { botMaybeTableTalk('pass', { name: pname, prefer: data.player }); } catch (e) {}
    try { noteHumanAuction(data.player, 'pass', 0); } catch (e) {}

    // Only high bidder left active, or everyone else passed → end auction
    const activeLeft = game.bidStatus.filter(s => s !== 'pass').length;
    // If someone has the high bid and every other seat has passed, finish
    if (game.bidder >= 0 && countPassedBids() >= 3) {
      finishBidding();
      return;
    }
    // All four passed with no bid → redeal (or Screw the Dealer)
    if (countPassedBids() >= 4) {
      hostHandleAllPassed();
      return;
    }
    // If high bidder is the only one not passed, end even mid-round
    if (game.bidder >= 0) {
      let onlyBidderLeft = true;
      for (let i = 0; i < 4; i++) {
        if (i === game.bidder) continue;
        if (!hasPassedBid(i)) { onlyBidderLeft = false; break; }
      }
      if (onlyBidderLeft) {
        finishBidding();
        return;
      }
    }
  } else {
    const high = auctionHigh();
    if (data.value <= high || data.value > maxBid()) return;
    if (isShootMoonBid(data.value) && !moonBidAllowed(data.player)) return;
    game.highestBid = data.value;
    game.bid = data.value;
    game.bidder = data.player;
    // House rule: Shoot the Moon — bidding every counter in the deck is an
    // all-or-nothing bid, flagged here and resolved at scoring time.
    game.shotTheMoon = !!(shootMoonEnabled && data.value === maxBid());
    if (game.shotTheMoon) {
      const howlId=(game.careerMatchId||(game.careerMatchId=crypto.randomUUID()))+':'+handHistory.length+':moon:'+data.player;
      // The declaration screen preloads this clip; start it before bid UI/SFX
      // work so the cue lands directly on the confirmed 200 bid.
      window.HORMoonHowl?.play(howlId);
      broadcast({type:'moonHowl',id:howlId});
    }
    // Note: passCount is count of permanent passes, not reset — passers stay out
    game.bidStatus[data.player] = data.value;
    const bidMsg = game.shotTheMoon
      ? `${pname} is shooting the moon at ${data.value}!`
      : `${pname} bids ${data.value}`;
    const ma = $('messageArea');
    if (ma) ma.textContent = bidMsg;
    broadcast({ type: 'message', text: bidMsg });
    try { playSfx('bid', { broadcastNet: true }); } catch (e) {}
    if (data.voiceLine === true || players[data.player]?.isBot) window.HORBidVoice801?.announce(data.player, game.shotTheMoon ? 'shootMoon' : 'bid', data.value);
    try { botMaybeTableTalk('bid', { name: pname, prefer: data.player }); } catch (e) {}
    try { noteHumanAuction(data.player, 'bid', data.value); } catch (e) {}
    if (game.shotTheMoon) {
      finishBidding();
      return;
    }
  }

  // Auction ends as soon as 3 seats have passed and there is a high bidder
  // (covers: open at min and everyone else passes; or last remaining seat bids)
  if (game.bidder >= 0 && countPassedBids() >= 3) {
    finishBidding();
    return;
  }

  // Next player who has not passed
  if (!nextActiveBidder()) {
    if (game.bidder >= 0) finishBidding();
    else hostHandleAllPassed();
    return;
  }

  // Safety: if the only non-passer left is already the high bidder, end auction
  // (prevents infinite re-prompt when nextActiveBidder lands back on the winner)
  if (game.bidder >= 0) {
    let onlyBidderLeft = true;
    for (let i = 0; i < 4; i++) {
      if (i === game.bidder) continue;
      if (!hasPassedBid(i)) { onlyBidderLeft = false; break; }
    }
    if (onlyBidderLeft) {
      finishBidding();
      return;
    }
  }

  broadcastState();
  hostPromptBid();
}


/** Plain-text card name, used for the Open Widow reveal message. */
function nestCardsToText(cards) {
  return (cards || []).map(c => {
    if (!c) return '';
    if (c.color === 'rook' || c.id === 'rook') return 'the Rook';
    if (isRed1(c)) return 'Red 1';
    if (isRed2(c) || c.id === 'red-2') return 'Red 2';
    const name = COLOR_NAMES[c.color] || c.color || '';
    return (name + ' ' + c.rank).trim();
  }).filter(Boolean).join(', ');
}

function finishBidding() {
  game.phase = 'discard';
  // Rook648: bidding/Moon and discard are mutually exclusive visual states.
  try { closeApprovedMoonDeclaration(); } catch (e) {}
  try {
    const d = $('decisionConsole');
    if (d) { d.classList.add('hidden'); d.classList.remove('decision-mode-trump'); d.innerHTML = ''; }
  } catch (e) {}
  try { const b = $('ltFeltBid'); if (b) b.classList.add('hidden'); } catch (e) {}
  try { const b = $('ltBidBar'); if (b) b.classList.add('hidden'); } catch (e) {}
  try {
    const bs = ps(game.bidder);
    bs.bidsWon++;
    bs.bidSum += (game.bid || 0);
    if ((game.bid || 0) > (bs.highBid || 0)) bs.highBid = game.bid;
  } catch (e) {}
  try { playSfx('winBid', { broadcastNet: true }); } catch (e) {}
  // Pass-out only applied during the auction — restore full seats for discard/play
  document.querySelectorAll('.player-slot.is-passed, #slot-me.is-passed').forEach(el => {
    el.classList.remove('is-passed');
  });
  // bidder takes nest — keep preview copy for UI
  const nestSize = game.nest.length;
  game.nestPreview = (game.nest || []).map((c) => {
    try { return (typeof hydrateNestCard === 'function') ? hydrateNestCard(c) : { ...c }; }
    catch (e) { return { ...c }; }
  }).filter(Boolean);
  game.kittyTaken = game.nestPreview.map((c) => ({ ...c }));
  // House rule: Open Widow — show everyone what was in the nest the moment
  // it's picked up, instead of only the bidder ever seeing it before the
  // final hand-end reveal.
  game.topNestCard = null;
  game.widowSpread = openWidow ? game.nestPreview.map(c => ({ ...c })) : [];
  try { renderTopNestPeek(); } catch (e) {}
  try { renderWidowSpread(); } catch (e) {}
  if (openWidow) {
    const bname = (players[game.bidder] && players[game.bidder].name) || ('P' + (game.bidder + 1));
    const widowMsg = `Widow revealed — ${bname} picked up: ${nestCardsToText(game.nestPreview)}`;
    try {
      const ma = $('messageArea');
      if (ma) ma.textContent = widowMsg;
      broadcast({ type: 'message', text: widowMsg });
    } catch (e) {}
  }
  // Merge nest into bidder hand — preserve every card (Rook, Red 2, Red 1, counters, etc.)
  const beforeCount = game.hands[game.bidder].length;
  const hadRook = game.hands[game.bidder].some(c => c.color === 'rook' || c.id === 'rook')
    || game.nestPreview.some(c => c.color === 'rook' || c.id === 'rook');
  const hadRed2 = game.hands[game.bidder].some(c => isRed2(c))
    || game.nestPreview.some(c => isRed2(c));
  const hadRed1 = game.hands[game.bidder].some(c => isRed1(c))
    || game.nestPreview.some(c => isRed1(c));

  game.hands[game.bidder] = game.hands[game.bidder].concat(game.nest);
  game.nest = [];

  // Same display order as the rest of the game (default: by color, high → low).
  sortCardsDisplay(game.hands[game.bidder]);

  // Sanity: hand size and specials must still be present
  if (game.hands[game.bidder].length !== beforeCount + nestSize) {
    console.warn('Hand size after nest mismatch', beforeCount, nestSize, game.hands[game.bidder].length);
  }
  if (hadRook && !game.hands[game.bidder].some(c => c.color === 'rook' || c.id === 'rook')) {
    console.error('Rook missing after nest merge — restoring from preview if possible');
    const r = game.nestPreview.find(c => c.color === 'rook' || c.id === 'rook');
    if (r) game.hands[game.bidder].push({ ...r });
  }
  if (hadRed2 && !game.hands[game.bidder].some(c => isRed2(c))) {
    console.error('Red 2 missing after nest merge — restoring from preview if possible');
    const r = game.nestPreview.find(c => isRed2(c));
    if (r) game.hands[game.bidder].push({ ...r });
  }
  if (hadRed1 && !game.hands[game.bidder].some(c => isRed1(c))) {
    console.error('Red 1 missing after nest merge — restoring');
    const r = game.nestPreview.find(c => isRed1(c));
    if (r) game.hands[game.bidder].push({ ...r });
  }

  game.currentPlayer = game.bidder;
  game.discardCount = nestSize; // normally 5, now 6 because of red 2

  broadcastState();
  const msg = `${players[game.bidder].name} won bid at ${game.bid}. Discard ${nestSize} cards.`;
  $('messageArea').textContent = msg;
  broadcast({ type: 'message', text: msg });
  // Website / remote human bidders must get the merged hand + nest preview
  // in one dedicated packet. Public state does not include the cards, and a
  // dropped privateHand left them discarding from the old 9-card hand.
  hostSendDiscardStart(game.bidder, players[game.bidder] && players[game.bidder].id, true);
  // Show nest cards to bidder (kitty preview ~3s, then full hand to discard)
  if (game.bidder === myIndex && !horSolSeatIsBot()) {
    // Use the same array the host game uses so Rook cannot be dropped
    game.myHand = game.hands[game.bidder].slice();
    window.selectedForDiscard = new Set();
    window._discardPickStep = 0;
    window._discardFlowKey = discardFlowIdentity(game.myHand, game.bidder);
    window._discardPage = 'kitty';
    window._discardKittyShown = false;
    window._discardSubmitting = false;
    window._discardStartReceived = true;
    showDiscardUI(true);
    fitHandToScreen();
    setTimeout(fitHandToScreen, 100);
    setTimeout(fitHandToScreen, 3100); // after kitty fades
  } else if (players[game.bidder]?.isBot) {
    startTurnTimer();
    scheduleBot();
  } else {
    startTurnTimer();
    // Re-send a moment later in case the first packet raced the state apply
    setTimeout(() => {
      try { if (game && game.phase === 'discard') hostSendDiscardStart(game.bidder, players[game.bidder] && players[game.bidder].id, false); } catch (e) {}
    }, 400);
  }
}

function hostSendDiscardStart(playerIdx, peerId, showKitty) {
  if (!isHost || !game || game.phase !== 'discard') return;
  const idx = (typeof playerIdx === 'number' && playerIdx >= 0) ? playerIdx : game.bidder;
  if (idx !== game.bidder) return;
  const p = players[idx];
  const pid = peerId || (p && p.id);
  if (!pid || pid === myPeerId) return;
  const hand = (game.hands[idx] || []).map(c => ({ ...c }));
  sendTo(pid, {
    type: 'discardStart',
    player: idx,
    bidder: game.bidder,
    peerId: pid,
    discardCount: game.discardCount || hand.length && (hand.length - (handSize || 9)),
    hand,
    nestPreview: (game.kittyTaken || game.nestPreview || []).map(c => ({ ...c })),
    topNestCard: game.topNestCard ? { ...game.topNestCard } : null,
    showKitty: !!showKitty,
  });
}


function isLandscapeNow() {
  try {
    if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) return true;
  } catch (e) {}
  return (window.innerWidth || 0) > (window.innerHeight || 1);
}

function hideDiscardOverlay() {
  if (window._discardKittyTimer) {
    try { clearTimeout(window._discardKittyTimer); } catch (e) {}
    window._discardKittyTimer = null;
  }
  window._discardKittyShown = false;
  window._discardFlowKey = null;
  window._discardPage = null;
  window._discardSubmitting = false;
  window._discardStartReceived = false;
  const ov = $('discardOverlay');
  if (ov) {
    ov.classList.add('hidden');
    ov.classList.remove('landscape-discard-overlay', 'portrait-discard-overlay', 'gh-kitty-page', 'gh-discard-page');
    ov.style.removeProperty('--discard-top');
    ov.style.removeProperty('--kitty-hand-clearance749');
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '';
  }
  try {
    const handArea = document.querySelector('.hand-area');
    if (handArea) handArea.classList.remove('hidden');
  } catch (e) {}
}

function discardFlowIdentity(hand, bidder) {
  const ids = (Array.isArray(hand) ? hand : []).map(c => String(c && c.id || '')).sort();
  return `${Number.isFinite(Number(bidder)) ? Number(bidder) : 'unknown'}|${ids.join('|')}`;
}

function positionDiscardOverlay(overlay, landscape) {
  if (!overlay) return;
  if (landscape) {
    overlay.classList.remove('portrait-discard-overlay');
    overlay.style.removeProperty('--discard-top');
    return;
  }
  overlay.classList.add('portrait-discard-overlay');
  const header = $('matchHeader706');
  const table = document.querySelector('.table-wrap');
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const tableTop = table ? table.getBoundingClientRect().top : 0;
  const top = Math.max(0, Math.ceil(Math.max(headerBottom + 7, tableTop)));
  overlay.style.setProperty('--discard-top', `${top}px`);
  if (overlay.classList.contains('gh-kitty-page')) {
    const hand=document.querySelector('.hand-area');
    const hr=hand?.getBoundingClientRect();
    const faces=[...document.querySelectorAll('#myHand .card-face')].map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);
    const boundary=Math.min(hr&&hr.height?hr.top:innerHeight,...faces.map(r=>r.top));
    const lower=overlay.getBoundingClientRect().bottom;
    overlay.style.setProperty('--kitty-hand-clearance749',Math.max(8,lower-boundary+10)+'px');
  } else overlay.style.removeProperty('--kitty-hand-clearance749');
}

function showDiscardUI(showKitty) {
  // Rook648: discard owns the screen; retire all bid/Moon presentation first.
  try { closeApprovedMoonDeclaration(); } catch (e) {}
  try {
    const d = $('decisionConsole');
    if (d) { d.classList.add('hidden'); d.classList.remove('decision-mode-trump'); d.innerHTML = ''; }
  } catch (e) {}
  try { const b = $('ltFeltBid'); if (b) b.classList.add('hidden'); } catch (e) {}
  try { const b = $('ltBidBar'); if (b) b.classList.add('hidden'); } catch (e) {}
  try { ['actionPanel', 'ltTrumpBar'].forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); }); } catch (e) {}
  if (!game || !game.myHand) return;
  const count = game.discardCount || 5;
  if (!window.selectedForDiscard) window.selectedForDiscard = new Set();

  const flowKey = discardFlowIdentity(game.myHand, game.bidder);
  if (window._discardFlowKey !== flowKey) {
    window._discardFlowKey = flowKey;
    window._discardPage = showKitty ? 'kitty' : 'select';
    window._discardKittyShown = false;
    window._discardSubmitting = false;
    window._discardStartReceived = false;
    window.selectedForDiscard = new Set();
  } else if (showKitty && !window._discardKittyShown && window._discardPage !== 'select') {
    window._discardPage = 'kitty';
  }

  // Hide bottom action panel; use full-screen overlay instead
  const panel = $('actionPanel');
  if (panel) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
  }

  const ov = $('discardOverlay');
  if (!ov) return;

  // Landscape mode hides #app behind the landscape theater. Move the discard
  // picker to <body> so the bidder can actually see and tap the cards there
  // in both orientations (including Android APK WebView).
  try {
    if (ov.parentElement !== document.body) document.body.appendChild(ov);
    ov.classList.toggle('landscape-discard-overlay', isLandscapeNow());
    positionDiscardOverlay(ov, isLandscapeNow());
  } catch (e) {}

  // Specials row only for true permanent trumps (not normal ones-high red 1)
  const specialParts = [];
  if (includeRook) specialParts.push('Rook');
  if (includeRed2) specialParts.push('Red 2');
  if (includeRed1) specialParts.push('Red 1'); // special Red 1 trump only
  const specialLabel = specialParts.length ? specialParts.join(' · ') : 'Specials';

  const groups = [
    { key: 'special', label: specialLabel, color: 'rook' },
    { key: 'green', label: 'Green', color: 'green' },
    { key: 'red', label: 'Red', color: 'red' },
    { key: 'yellow', label: 'Yellow', color: 'yellow' },
    { key: 'black', label: 'Black', color: 'black' },
  ];

  const cardClass = (card) => {
    if (typeof nestCardClass === 'function') return nestCardClass(card);
    if (isRed1(card)) return 'red1';
    if (isRed2(card)) return 'red2';
    if (card.color === 'rook' || card.id === 'rook') return 'rook';
    return card.color;
  };
  const cardLabel = (card) => {
    if (typeof isRookCard === 'function' && isRookCard(card)) return 'Blackbird';
    if (isRed2(card)) return 'Red Two';
    if (isRed1(card)) return 'Red 1';
    const color = COLOR_NAMES[card && card.color] || String(card && card.color || 'card');
    return `${card && card.rank != null ? card.rank : ''} ${color}`.trim();
  };
  const kittyList = (() => {
    const raw = (game.kittyTaken && game.kittyTaken.length)
      ? game.kittyTaken
      : (game.nestPreview || []);
    return raw.map((c) => {
      try { return (typeof hydrateNestCard === 'function') ? hydrateNestCard(c) : c; }
      catch (e) { return c; }
    }).filter(Boolean);
  })();
  const kittyCardHtml = (card, small) => {
    const c = (typeof hydrateNestCard === 'function') ? (hydrateNestCard(card) || card) : card;
    try {
      if (typeof renderCardHTML === 'function') {
        const html = renderCardHTML(c, !!small);
        if (html && String(html).trim()) {
          return html.replace('class="card-face ', 'class="card-face kitty-flash-card ');
        }
      }
    } catch (e) {}
    const cls = cardClass(c) || '';
    const inner = (typeof cardInnerHTML === 'function') ? cardInnerHTML(c) : '';
    return '<div class="card-face kitty-flash-card ' + cls + (small ? ' small' : '') + '">' + inner + '</div>';
  };

  const groupFor = (card) => {
    // Only Rook + special Red 1 + Red 2 — NEVER normal ones-high red-1 (id "red-1")
    if (card.color === 'rook' || card.id === 'rook') return 'special';
    if (isRed2(card)) return 'special';
    if (isRed1(card)) return 'special'; // red1-special only
    // Normal red 1 stays in the Red color group
    return card.color;
  };

  const renderOverlay = (includeKittyFlash) => {
    const nSel = window.selectedForDiscard.size;
    // Hide bottom hand so it never flashes with the kitty
    try {
      const handEl = $('myHand');
      if (handEl) handEl.innerHTML = '';
      const handArea = document.querySelector('.hand-area');
      if (handArea) handArea.classList.add('hidden');
    } catch (e) {}

    // Both portrait and landscape show the kitty AND the discard picker at
    // the same time so the bidder can start choosing immediately after
    // winning the nest — rotating the phone never blocks selection.
    const landscape = isLandscapeNow();
    let kittyBlock = '';
    if (includeKittyFlash && kittyList.length) {
      const kittyCards = kittyList.slice().sort(compareCardsDisplay).map(c => kittyCardHtml(c, true)).join('');
      kittyBlock = `
        <div class="discard-kitty kitty-flashing${landscape ? ' landscape-kitty-banner' : ''}" id="kittyFlash">
          <div class="kitty-label">Kitty added to your hand</div>
          <div class="kitty-cards">${kittyCards}</div>
          <p class="kitty-hint">Pick ${count} cards to discard — kitty is already in this hand</p>
        </div>`;
    }

    // Landscape keeps the established combined Kitty banner and picker.
    // Portrait receives the owner-approved Kitty-then-discard screens.
    if (includeKittyFlash && kittyList.length && !landscape) {
      const kittyCards = kittyList.slice().sort(compareCardsDisplay).map(c => {
        const html = renderCardHTML(c, false);
        return html.replace('class="card-face ', 'class="card-face gh-kitty-card ');
      }).join('');
      ov.innerHTML = `
        <section class="discard-sheet gh-kitty-page" role="dialog" aria-modal="true" aria-labelledby="kittyReceivedTitle">
          <header class="gh-kitty-head">
            <h2 id="kittyReceivedTitle">KITTY RECEIVED</h2>
            <p>${kittyList.length} cards have been added to your hand.</p>
          </header>
          <div class="gh-kitty-cards" role="group" aria-label="The ${kittyList.length} received Kitty cards">${kittyCards}</div>
          <button type="button" class="gh-kitty-continue" id="kittyContinueBtn">Continue</button>
        </section>`;
      ov.classList.remove('hidden', 'gh-discard-page');
      ov.classList.add('gh-kitty-page');
      ov.setAttribute('aria-hidden', 'false');
      // Compact reveal keeps the player's real hand in the normal cardholder.
      // The authoritative sixteen-card state is unchanged; Continue opens
      // the separate, full-face discard selection view for these same cards.
      try { document.querySelector('.hand-area')?.classList.remove('hidden'); renderHand(false); } catch (e) {}
      window._discardKittyShown = true;
      positionDiscardOverlay(ov, false);
      const cont = $('kittyContinueBtn');
      if (cont) {
        cont.focus({preventScroll:true});
        cont.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();cont.focus({preventScroll:true});}};
      }
      if (cont) cont.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!game || game.phase !== 'discard' || discardFlowIdentity(game.myHand, game.bidder) !== window._discardFlowKey) return;
        window._discardPage = 'select';
        window._discardPickStep = 1;
        renderOverlay(false);
        ov.querySelector('.discard-pick')?.focus({preventScroll:true});
      };
      return;
    }

    const portrait = !landscape;
    const portraitGroups = [
      { key: 'birds', label: 'BIRD CARDS' },
      { key: 'green', label: 'GREEN' },
      { key: 'red', label: 'RED' },
      { key: 'yellow', label: 'YELLOW' },
      { key: 'black', label: 'BLACK' },
    ];
    const portraitGroupFor = (card) => {
      if ((typeof isRookCard === 'function' && isRookCard(card)) || isRed2(card)) return 'birds';
      return card && card.color;
    };
    const selectionButton = (card) => {
      const id = String(card.id);
      const selected = window.selectedForDiscard.has(id);
      const aria = `${cardLabel(card)}${selected ? ', selected' : ''}`;
      return `<button type="button" aria-label="${aria}" aria-pressed="${selected}" class="discard-slot discard-pick ${selected ? 'selected' : ''}" data-id="${id}" data-selected="${selected}"><span class="card-face ${cardClass(card)} discard-card-art" aria-hidden="true">${cardInnerHTML(card)}</span><span class="gh-card-check" aria-hidden="true">✓</span></button>`;
    };
    const rows = (portrait ? portraitGroups : groups).map(g => {
      const groupKey = portrait ? g.key : g.key;
      const cards = game.myHand.filter(c => (portrait ? portraitGroupFor(c) : groupFor(c)) === groupKey)
        .sort(compareCardsDisplay);
      if (!cards.length) return '';
      if (portrait) return `<section class="discard-color-row discard-color-${g.key}" data-discard-group="${g.key}">
        <h3 class="discard-color-label">${g.label}</h3>
        <div class="discard-color-cards">${cards.map(selectionButton).join('')}</div>
      </section>`;
      return `<div class="discard-color-row discard-color-${g.key}">
        <div class="discard-color-label">${g.label}</div>
        <div class="discard-color-cards">${cards.map(c => {
          const id = String(c.id);
          const sel = window.selectedForDiscard.has(id) ? 'selected' : '';
          return `<div class="card-face ${cardClass(c)} ${sel} discard-pick" data-id="${id}">${cardInnerHTML(c)}</div>`;
        }).join('')}</div>
      </div>`;
    }).join('');

    if (portrait) {
      const countText = `${nSel} / ${count} selected`;
      ov.innerHTML = `
        <section class="discard-sheet gh-discard-page" aria-labelledby="discardTitle">
          <header class="gh-discard-head">
            <h2 class="discard-title" id="discardTitle">SELECT ${count} TO DISCARD</h2>
            <p class="gh-discard-instruction">Choose ${count} cards for the Nest.</p>
            <p class="gh-discard-count" id="discardCountLabel" aria-live="polite">${countText}</p>
          </header>
          <div class="gh-discard-felt">
            <div class="discard-groups">${rows}</div>
          </div>
          <div class="discard-actions">
            <button type="button" class="gh-confirm-discard" id="confirmDiscard" ${nSel !== count ? 'disabled' : ''}>Confirm Discard</button>
          </div>
        </section>`;
      ov.classList.remove('hidden', 'gh-kitty-page');
      ov.classList.add('gh-discard-page');
    } else {
      ov.innerHTML = `
        <div class="discard-sheet">
          ${kittyBlock}
          <div class="gh-discard-head">
            <div><h2 class="discard-title">SELECT ${count} TO DISCARD</h2><p class="gh-discard-instruction">Choose ${count} cards from your ${game.myHand.length}-card hand to put in the kitty</p></div>
            <div class="gh-discard-count"><strong id="discardCountLabel">${nSel} / ${count}</strong><span>Selected</span></div>
          </div>
          <div class="discard-groups">${rows}</div>
          <div class="discard-actions">
            <button type="button" class="btn primary" id="confirmDiscard" ${nSel !== count ? 'disabled' : ''}>Confirm Discard (${nSel}/${count})</button>
          </div>
        </div>`;
      ov.classList.remove('hidden', 'gh-kitty-page', 'gh-discard-page');
    }
    ov.classList.remove('hidden');
    ov.setAttribute('aria-hidden', 'false');

    // Size cards to fit viewport
    if (portrait) fitDiscardOverlayCards();

    // iPhone/iPad Safari: use pointerup as the primary tap path.  Safari can
    // occasionally delay/drop a synthetic click when a fixed, scrollable
    // overlay is being reflowed.  Keep click as a fallback for older WebViews.
    const toggleDiscardCard = (el, e) => {
      if (!el || !el.dataset.id) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const id = String(el.dataset.id);
      if (window._discardSubmitting) return;
      if (window.selectedForDiscard.has(id)) {
        window.selectedForDiscard.delete(id);
        el.classList.remove('selected');
        try { playDiscardToggleSfx(true); } catch (err) {}
      } else if (window.selectedForDiscard.size < count) {
        window.selectedForDiscard.add(id);
        el.classList.add('selected');
        try { playDiscardToggleSfx(false); } catch (err) {}
      }
      const n = window.selectedForDiscard.size;
      const lab = $('discardCountLabel');
      if (lab) lab.textContent = portrait ? `${n} / ${count} selected` : `${n} / ${count}`;
      el.setAttribute('aria-pressed', String(window.selectedForDiscard.has(id)));
      const slot = el.closest('.discard-slot');
      if (slot) slot.dataset.selected = String(window.selectedForDiscard.has(id));
      const btn = $('confirmDiscard');
      if (btn) {
        if (!portrait) btn.textContent = `Confirm Discard (${n}/${count})`;
        const validIds = new Set((game.myHand || []).map(c => String(c.id)));
        const validCount = [...window.selectedForDiscard].filter(value => validIds.has(String(value))).length;
        btn.disabled = n !== count || validCount !== count;
      }
    };

    ov.querySelectorAll('.discard-pick').forEach(el => {
      // One browser-recognized activation owns each gesture. A native click
      // already excludes cancelled/dragged touches and supports rapid taps;
      // pointerup plus a timed click veto dropped independent activations.
      el.addEventListener('click',e=>toggleDiscardCard(el,e));
      // Portrait uses native buttons (Enter/Space generate one click). Keep
      // the existing keyboard fallback only for landscape's legacy divs.
      if(el.tagName!=='BUTTON')el.addEventListener('keydown',e=>{
        if(e.repeat||(e.key!=='Enter'&&e.key!==' '))return;
        e.preventDefault();toggleDiscardCard(el,e);
      });
    });

    const btn = $('confirmDiscard');
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window._discardSubmitting || window.selectedForDiscard.size !== count) return;
        const ids = Array.from(window.selectedForDiscard).map(String);
        // Prefer host hand as source of truth when host is bidder
        const source = (isHost && game.hands && game.hands[game.bidder])
          ? game.hands[game.bidder]
          : game.myHand;
        const valid = ids.filter(id => source.some(c => String(c.id) === id));
        if (ids.length !== count || valid.length !== count || new Set(valid).size !== count) {
          const ma = $('messageArea');
          if (ma) ma.textContent = `Select exactly ${count} cards to discard`;
          btn.disabled = true;
          return;
        }
        window._discardSubmitting = true;
        btn.disabled = true;
        btn.textContent = portrait ? 'Discarding…' : 'Discarding…';
        submitDiscard(valid);
      };
    }
  };

  const wantKitty = !!(window._discardPage === 'kitty' && kittyList.length);
  renderOverlay(wantKitty);
  if (wantKitty) {
    window._discardKittyShown = true;
    if (window._discardKittyTimer) { try { clearTimeout(window._discardKittyTimer); } catch (e) {} window._discardKittyTimer = null; }
    // Rook632 approved flow: human Continue button owns the transition.
  }
}

function fitDiscardOverlayCards() {
  const ov = $('discardOverlay');
  if (!ov || ov.classList.contains('hidden')) return;
  if(ov.classList.contains('gh-kitty-page')&&!isLandscapeNow())positionDiscardOverlay(ov,false);
  const sheet = ov.querySelector('.discard-sheet');
  const groups = ov.querySelector('.discard-groups');
  if (!sheet || !groups) return;
  const cards = ov.querySelectorAll('.discard-pick');
  if (!cards.length) return;

  const vw = Math.min(window.innerWidth || 360, sheet.clientWidth || 360);
  const vh = window.innerHeight || 640;
  const legacyUsableH = Math.max(160, vh - 190 - (ov.querySelector('#kittyFlash') ? 78 : 0));
  const landscape = isLandscapeNow();
  if (landscape) {
    // Size from the actual column so a long color row can wrap without
    // clipping faces — especially in the Android APK WebView.
    let maxInRow = 1;
    ov.querySelectorAll('.discard-color-cards').forEach(row => {
      maxInRow = Math.max(maxInRow, row.children.length);
    });
    const colW = Math.max(140, Math.floor((vw - 24) / 2));
    const wrapCols = Math.max(3, Math.min(maxInRow, Math.floor(colW / 44)));
    let cardW = Math.max(36, Math.min(52, Math.floor((colW - 16) / wrapCols) - 3));
    let cardH = Math.round(cardW * (84 / 58));
    const maxH = Math.min(76, Math.max(52, Math.floor((legacyUsableH / 3) - 18)));
    if (cardH > maxH) {
      cardH = maxH;
      cardW = Math.max(32, Math.round(cardH * (58 / 84)));
    }
    ov.style.setProperty('--discard-card-w', cardW + 'px');
    ov.style.setProperty('--discard-card-h', cardH + 'px');
    return;
  }
  // Portrait size depends only on the available viewport, never on how many
  // cards happen to be in a color group. The 6-row worst case is budgeted up
  // front; every distribution in this viewport uses the same face dimensions.
  const usableH = ov.clientHeight || vh;
  // Reserve the measured header, labels, felt inset, and action-control
  // clearance before sizing against the worst-case six physical card rows.
  const heightBudget = Math.max(0, usableH - 196);
  const groupsWidth = groups.clientWidth || sheet.clientWidth || vw;
  const columns = groupsWidth >= 264 ? 6 : groupsWidth >= 220 ? 5 : 4;
  const columnGap = columns > 1
    ? Math.max(0, Math.min(6, (groupsWidth - columns * 44) / (columns - 1)))
    : 0;
  const maxRows = 1 + Math.ceil(11 / columns) + 3;
  const byHeight = heightBudget / maxRows;
  groups.style.setProperty('--discard-columns', columns);
  groups.style.setProperty('--discard-col-gap', `${columnGap}px`);
  // The approved 44 × 63.7 face is maintained on the reference viewport;
  // small viewports scale every card together, never by suit length.
  const byWidth = Math.min(44, (groupsWidth - columnGap * (columns - 1)) / columns);
  const cardH = Math.max(36, Math.min(840 / 580 * byWidth, byHeight));
  const cardW = cardH * (580 / 840);
  ov.style.setProperty('--discard-card-w', cardW + 'px');
  ov.style.setProperty('--discard-card-h', cardH + 'px');
}


function rejectDiscardLocal(needed, message) {
  window._discardSubmitting = false;
  const btn = $('confirmDiscard');
  if (btn) {
    const selected = window.selectedForDiscard?.size || 0;
    btn.disabled = selected !== needed;
    if (!document.querySelector('#discardOverlay.gh-discard-page')) {
      btn.textContent = `Confirm Discard (${selected}/${needed})`;
    } else {
      btn.textContent = 'Confirm Discard';
    }
  }
  const ma = $('messageArea');
  if (ma && message) ma.textContent = message;
}

function submitDiscard(ids) {
  if (!ids || !ids.length) return;
  ids = ids.map(String);
  const needed = game?.discardCount || ids.length || 5;
  if (isHost) {
    hostProcessDiscard({ player: myIndex, peerId: myPeerId, cardIds: ids, actionId: horNewActionId('discard') });
    return;
  }
  const queued = { type: 'discard', player: myIndex, peerId: myPeerId, cardIds: ids };
  const sent = horQueueClientAction(queued);
  clearTimeout(window._discardAckTimer);
  window._discardAckTimer = setTimeout(() => {
    if (game && game.phase === 'discard') {
      window._discardSubmitting = false;
      rejectDiscardLocal(needed, 'Discard did not reach the host — tap Confirm again');
      try {
        if (hostConnection && hostConnection.open) {
          hostConnection.send({ type: 'requestDiscardState', player: myIndex, peerId: myPeerId });
        } else {
          horBeginClientReconnect();
        }
      } catch (e) {}
    }
  }, 3500);
  if (!sent) {
    rejectDiscardLocal(needed, 'Not connected — holding discard and reconnecting…');
    horBeginClientReconnect();
  }
}


function hostProcessDiscard(data) {
  if (!game || game.phase !== 'discard' || game.paused) return; // already processed or paused
  if (horRememberAction(data)) return;
  const bidderId = players[game.bidder] && players[game.bidder].id;
  const byPeer = data && data.peerId && bidderId && String(data.peerId) === String(bidderId);
  const bySeat = data && typeof data.player === 'number' && data.player === game.bidder;
  if (!byPeer && !bySeat) {
    const pid = data && data.peerId;
    if (pid) sendTo(pid, { type: 'discardRejected', needed: game.discardCount || 5, message: 'It is not your discard' });
    return;
  }
  const needed = game.discardCount || 5;
  const hand = game.hands[game.bidder];
  if (!hand || !data.cardIds) return;
  const wanted = [];
  const seen = new Set();
  data.cardIds.forEach(id => {
    const sid = String(id);
    if (seen.has(sid)) return;
    seen.add(sid);
    wanted.push(sid);
  });
  const discard = [];
  const remaining = [];
  hand.forEach(c => {
    const sid = String(c.id);
    const w = wanted.indexOf(sid);
    if (w >= 0) {
      discard.push(c);
      wanted[w] = null;
    } else {
      remaining.push(c);
    }
  });
  if (discard.length !== needed) {
    console.warn('Discard rejected: expected', needed, 'got', discard.length, data.cardIds);
    // Never mutate the host hand on a rejected attempt — that is what
    // left website bidders with a short hand and a stuck Confirm button.
    const payload = {
      type: 'discardRejected',
      needed,
      message: `Select exactly ${needed} cards to discard`,
      hand: hand.map(c => ({ ...c })),
    };
    if (game.bidder === myIndex) {
      rejectDiscardLocal(needed, payload.message);
    } else if (bidderId) {
      sendTo(bidderId, payload);
    }
    return;
  }
  game.hands[game.bidder] = remaining;
  // Replace the old nest state with a clean, immutable reveal snapshot.
  // The scoreboard uses this snapshot so later trick/score mutations cannot hide the nest.
  game.nestCards = discard.map(c => ({ ...c }));
  game.nestRevealCards = game.nestCards.map(c => ({ ...c }));
  game.nestDiscardCount = discard.length;
  game.phase = 'trump';
  window.selectedForDiscard = new Set();
  try { playSfx('discard', { broadcastNet: true }); } catch (e) {}
  hideDiscardOverlay();
  if (game.hands[game.bidder] && game.bidder === myIndex) {
    game.myHand = game.hands[game.bidder].slice();
  }
  if (bidderId && bidderId !== myPeerId) {
    sendTo(bidderId, { type: 'discardOk', hand: game.hands[game.bidder].map(c => ({ ...c })) });
  }
  broadcastState();
  const msg = `${players[game.bidder].name} chooses Trump`;
  $('messageArea').textContent = msg;
  broadcast({ type: 'message', text: msg });
  if (game.bidder === myIndex && !horSolSeatIsBot()) {
    hideDiscardOverlay();
    showTrumpUI();
    renderHand(false);
    fitHandToScreen();
  } else if (players[game.bidder]?.isBot) {
    startTurnTimer();
    scheduleBot();
  } else {
    startTurnTimer();
  }
  try { syncDiscardReturn040(); } catch(e) {}
}


function showTrumpUI() {
  try { horApplyHandTheme(); } catch (e) {}
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  try { clearTrumpBanners(); } catch (e) {}
  try { const bar=$('ltTrumpBar'); if(bar){bar.classList.add('hidden'); const b=$('ltTrumpButtons'); if(b)b.innerHTML='';} } catch(e){}
  const panel = $('actionPanel');
  if (panel) { panel.classList.add('hidden'); panel.classList.remove('trump-showdown'); panel.innerHTML=''; }
  const dock = $('decisionConsole');
  if (!dock) return;
  if (landscape) {
    // Landscape keeps the same functional owner but centers the compact console safely.
    dock.style.left='50%'; dock.style.top='50%'; dock.style.transform='translate(-50%,-50%)';
  } else {
    dock.style.left=''; dock.style.top=''; dock.style.transform='';
  }
  if (!landscape && window.HORTrump714 && window.HORTrump714.choose(dock, submitTrump, game)) return;
  dock.classList.remove('decision-mode-bid');
    dock.classList.add('decision-mode-trump');
  let html = '<div class="decision-console-title">STAMP THE TRUMP</div><div class="stamp-trump-grid">';
  COLORS.forEach((c) => {
    html += '<button type="button" class="stamp-trump-choice ' + c + '" data-trump="' + c + '">' + COLOR_NAMES[c] + '</button>';
  });
  html += '</div><p class="stamp-trump-note">' + (includeRook ? (rookLowest ? 'The Bird stays lowest trump.' : 'The Bird stays highest trump.') : '') + '</p>';
  dock.innerHTML = html;
  dock.classList.remove('hidden');
  if (window.HORTrump714) window.HORTrump714.chooseFallback(dock, submitTrump, game);
}

function submitTrump(color) {
  if (isHost) {
    hostProcessTrump({ player: myIndex, color, actionId: horNewActionId('trump') });
  } else {
    const sent = horQueueClientAction({ type: 'trump', player: myIndex, color });
    if (!sent) horBeginClientReconnect();
  }
}


function announceTrumpSelection(color) {
  if (!color) return;
  if (window.HORTrump714 && window.HORTrump714.ownsPortrait()) return;
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  const id = landscape ? 'ltTrumpStamp' : 'trumpBanner';
  const otherId = landscape ? 'trumpBanner' : 'ltTrumpStamp';
  const other = $(otherId);
  if (other) {
    other.classList.add('hidden');
    other.innerHTML = '';
    delete other.dataset.trumpStamped;
    delete other.dataset.trumpColor;
  }
  const el = $(id);
  if (!el) return;
  delete el.dataset.trumpStamped;
  paintTrumpMarker(el, color);
}


function hostProcessTrump(data) {
  if (!game || game.phase !== 'trump' || game.paused || !data || !COLORS.includes(data.color)) return;
  if (data.player !== game.bidder) return;
  if (horRememberAction(data)) return;
  game.trump = data.color;
  game.phase = 'play';
  //790: public presentation event identity; never a bid/trick input.
  game.trumpVoiceEvent790 = horNewActionId('trump-voice');
  try { window.HORTrumpVoice?.chosen(game, playerAvatars); } catch(e) { console.warn('Trump voice:',e); }
  try { announceTrumpSelection(data.color); } catch (e) {}
  try { hideActionPanel(); } catch (e) {}
  try { const d=$('decisionConsole'); if(d){d.classList.add('hidden');d.classList.remove('decision-mode-trump');d.innerHTML='';} } catch(e){}
  try {
    const bar = $('ltTrumpBar');
    if (bar) bar.classList.add('hidden');
  } catch (e) {}
  // Who leads the first trick, relative to the bid winner (house rule option).
  if (leadOrder === 'bidder') {
    game.currentPlayer = game.bidder;
  } else if (leadOrder === 'rightOfBidder') {
    game.currentPlayer = (game.bidder + 3) % 4; // one seat right (counter-clockwise)
  } else {
    game.currentPlayer = (game.bidder + 1) % 4; // left of bidder
  }
  game.trick = [];
  game.ledColor = null;
  game.widowSpread = [];
  try { renderWidowSpread(); } catch (e) {}
  game.tricksTaken = [[], []];
  try { playSfx('trump', { broadcastNet: true }); } catch (e) {}
  try {
    const color = (typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES[data.color]) || data.color || 'trump';
    botMaybeTableTalk('trump', { color, prefer: data.player });
  } catch (e) {}
  broadcastState();
  hostPromptPlay();
}



function setPauseUI(on) {
  const ov = $('pauseOverlay');
  if (ov) {
    if (on) ov.classList.remove('hidden');
    else ov.classList.add('hidden');
  }
  const btn = $('btnPause');
  if (btn) {
    btn.textContent = on ? '▶' : '⏸';
    btn.title = on ? 'Resume' : 'Pause';
  }
  const resume = $('btnResumePause');
  if (resume) {
    if (on && isHost) resume.classList.remove('hidden');
    else resume.classList.add('hidden');
  }
  const sub = $('pauseSub');
  if (sub) sub.textContent = on ? (isHost ? 'Tap Resume when ready' : 'Waiting for host to resume') : '';
}


/** Host transfer: new host opens room with same code is impossible on PeerJS;
 *  we create a handoff: new host gets a new room code; others must rejoin.
 *  Snapshot is sent so they can continue after reconnect. */
function hostTransferHost() {
  if (!isHost || !game) return;
  const humans = players.filter(p => !p.isBot && p.id !== myPeerId);
  if (!humans.length) {
    alert('No other human player to transfer to.');
    return;
  }
  const names = humans.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const pick = prompt('Transfer host to which player?\n' + names + '\nEnter number:');
  const n = parseInt(pick, 10);
  if (!n || n < 1 || n > humans.length) return;
  const target = humans[n - 1];
  const snapshot = {
    game: JSON.parse(JSON.stringify({
      phase: game.phase, dealer: game.dealer, scores: game.scores,
      careerMatchId: game.careerMatchId, careerExtras: game.careerExtras,
      hands: game.hands, nest: game.nest, bid: game.bid, bidder: game.bidder,
      trumpVoiceEvent790: game.trumpVoiceEvent790 || null, trumpVoiceRestore790: true,
      trump: game.trump, currentPlayer: game.currentPlayer, trick: game.trick,
      ledColor: game.ledColor, tricksTaken: game.tricksTaken, nestCards: game.nestCards,
      passCount: game.passCount, highestBid: game.highestBid, discardCount: game.discardCount,
      nestDiscardCount: game.nestDiscardCount, targetScore: game.targetScore,
      nestPreview: game.nestPreview, topNestCard: game.topNestCard || null, nestRevealCards: game.nestRevealCards, paused: false,
    })),
    players: players.map(p => ({ ...p })),
    settings: { includeRed2, red2Points, includeRed1, includeOnes, onesHigh, includeRook, rookLowest,
      specialsAnytime, mustTrumpWhenVoid, minBid, targetScore, handSize, nestSizeDefault, ruleVariant,
      botDifficulty, turnTimeSec, revealTopNest },
    matchStats: { ...matchStats },
    playerStats: playerStats.map(s => ({ ...s })),
    handHistory: handHistory.slice(),
  };
  window._horHandoffFrom = myPeerId;
  sendTo(target.id, { type: 'hostHandoff', snapshot });
  broadcast({ type: 'message', text: 'Host transferring to ' + target.name + '… stay in this tab.' });
  try { horToast('Handing the table to ' + target.name + '…'); } catch (e) {}
}

function acceptHostHandoff(snapshot) {
  if (!snapshot || !snapshot.game) return;
  window._horHandoffSnapshot = snapshot;
  window._horOldHostConn = hostConnection;
  isHost = true;
  try { horToast('Taking the host seat…'); } catch (e) {}
  createRoom();
}

function finishHostHandoff(newId) {
  const snapshot = window._horHandoffSnapshot;
  window._horHandoffSnapshot = null;
  if (!snapshot) return;
  const s = snapshot.settings || {};
  if (s.turnTimeSec != null) turnTimeSec = s.turnTimeSec;
  if (s.botDifficulty) botDifficulty = s.botDifficulty;
  if (s.targetScore) targetScore = normalizeTargetScore(s.targetScore);
  if (typeof s.includeRed2 === 'boolean') includeRed2 = s.includeRed2;
  if (s.red2Points) red2Points = s.red2Points;
  matchStats = snapshot.matchStats || matchStats;
  playerStats = snapshot.playerStats || playerStats;
  handHistory = snapshot.handHistory || [];
  const oldPlayers = snapshot.players || [];
  players = oldPlayers.map(p => {
    if (p.id === newId || (p.name === myName && !p.isBot)) {
      return Object.assign({}, p, { id: newId, isHost: true, isBot: false, isTempBot: false });
    }
    if (!p.isBot) {
      return Object.assign({}, p, {
        isBot: true, isTempBot: true, replacedHumanName: p.name,
        id: p.id || ('bot-fill-' + Math.random().toString(36).slice(2, 8))
      });
    }
    return Object.assign({}, p, { isHost: false });
  });
  myIndex = players.findIndex(p => p && p.id === newId);
  if (myIndex < 0) myIndex = 0;
  game = snapshot.game;
  if (game) game.paused = false;
  try { balanceTeams(); } catch (e) {}
  const codeEl = $('displayCode');
  if (codeEl) codeEl.textContent = roomCode;
  const old = window._horOldHostConn;
  window._horOldHostConn = null;
  try {
    if (old && old.open) old.send({ type: 'newHostReady', roomCode: roomCode, hostName: myName });
  } catch (e) {}
  try { showGame(); renderUI(); } catch (e) {}
  try { horToast('You are host. Others will follow this table.'); } catch (e) {}
  if (game && game.phase === 'play') hostPromptPlay();
  else if (game && game.phase === 'bidding') hostPromptBid();
}

function horFollowNewHost(code) {
  if (!code) return;
  isHost = false;
  try {
    if ($('hor-room-code')) $('hor-room-code').value = String(code);
  } catch (e) {}
  roomCode = String(code).toUpperCase();
  try { horToast('Following the new host…'); } catch (e) {}
  try { joinRoom(); } catch (e) { console.error(e); }
}

function hostTogglePause() {
  if (!isHost || !game) return;
  if (game.phase === 'score' || game.phase === 'deal') return;
  game.paused = !game.paused;
  if (game.paused) {
    clearTurnTimer();
    if (botTimer) { clearTimeout(botTimer); botTimer = null; }
    setBotThinking(false);
    const ma = $('messageArea');
    if (ma) ma.textContent = '⏸ Game paused';
    broadcast({ type: 'message', text: '⏸ Game paused by host' });
    broadcast({ type: 'pause', paused: true });
    broadcastState();
    setPauseUI(true);
  } else {
    broadcast({ type: 'message', text: '▶ Game resumed' });
    broadcast({ type: 'pause', paused: false });
    broadcastState();
    setPauseUI(false);
    if (typeof game._resumeTrick === 'function') {
      const resumeTrick = game._resumeTrick;
      delete game._resumeTrick;
      resumeTrick();
      return;
    }
    // Resume current phase prompts
    if (game.phase === 'play') hostPromptPlay();
    else if (game.phase === 'bidding') hostPromptBid();
    else if (game.phase === 'discard') {
      if (game.bidder === myIndex && !horSolSeatIsBot()) showDiscardUI();
      else if (players[game.bidder]?.isBot) scheduleBot();
      else hostSendDiscardStart(game.bidder, players[game.bidder] && players[game.bidder].id, false);
    } else if (game.phase === 'trump') {
      if (game.bidder === myIndex && !horSolSeatIsBot()) showTrumpUI();
      else if (players[game.bidder]?.isBot) scheduleBot();
    }
  }
}

// ========== Turn timer & disconnect / leave-replace ==========
function clearTurnTimer() {
  if (turnTimer) { clearTimeout(turnTimer); turnTimer = null; }
  if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }
  turnTimerEndsAt = 0;
  const bar = $('turnTimerBar');
  if (bar) bar.classList.add('hidden');
}

function updateTurnTimerUI() {
  const bar = $('turnTimerBar');
  const secEl = $('turnTimerSec');
  const fill = $('turnTimerFill');
  const nameEl = $('turnTimerName');
  if (!bar || !game) return;
  const nowForTimer = horExpOn('netTimerSync') ? Date.now() + (Number(window.horServerOffset) || 0) : Date.now();
  const left = Math.max(0, Math.ceil((turnTimerEndsAt - nowForTimer) / 1000));
  if (secEl) secEl.textContent = String(left);
  if (fill) fill.style.width = (100 * left / Math.max(1, turnTimeSec || 30)) + '%';
  if (left <= 5) {
    bar.classList.add('urgent');
    if (left > 0 && left !== updateTurnTimerUI._lastTick) {
      updateTurnTimerUI._lastTick = left;
      playTickSound();
    }
  } else {
    bar.classList.remove('urgent');
    updateTurnTimerUI._lastTick = null;
  }
  const idx = (game.phase === 'play' || game.phase === 'bidding') ? game.currentPlayer
    : (game.phase === 'discard' || game.phase === 'trump') ? game.bidder : -1;
  if (nameEl && idx >= 0 && players[idx]) nameEl.textContent = players[idx].name;
}

function startTurnTimer() {
  if (!isHost || !game) return;
  if (game.paused) return;
  if (!turnTimeSec || turnTimeSec <= 0) {
    clearTurnTimer();
    return;
  }
  clearTurnTimer();
  // Only time human (non-bot) players
  let idx = -1;
  if (game.phase === 'play' || game.phase === 'bidding') idx = game.currentPlayer;
  else if (game.phase === 'discard' || game.phase === 'trump') idx = game.bidder;
  if (idx < 0 || !players[idx] || players[idx].isBot) return;
  if (horExpOn('netHoldTimerOnDisconnect') && players[idx].disconnected) return;

  turnTimerEndsAt = Date.now() + Math.max(1, turnTimeSec || 30) * 1000;
  const bar = $('turnTimerBar');
  if (bar) bar.classList.remove('hidden');
  updateTurnTimerUI();
  broadcast({ type: 'turnTimer', endsAt: turnTimerEndsAt, player: idx, seconds: turnTimeSec, serverNow: Date.now() });

  turnTimerInterval = setInterval(updateTurnTimerUI, 250);
  turnTimer = setTimeout(() => {
    turnTimer = null;
    onTurnTimeout();
  }, Math.max(1, turnTimeSec || 30) * 1000);
}

function pickLowestLegalCard(idx) {
  const hand = game.hands[idx] || [];
  let legal = hand.filter(c => canPlay(c, hand, game.ledColor, game.trump));
  if (!legal.length) legal = hand.slice();
  legal.sort((a, b) => cardPoints(a) - cardPoints(b) || (a.rank || 0) - (b.rank || 0));
  // Prefer non-specials when points equal
  const nonSpecial = legal.filter(c => c.color !== 'rook' && !isRed2(c) && !isRed1(c));
  const pool = nonSpecial.length ? nonSpecial : legal;
  pool.sort((a, b) => cardPoints(a) - cardPoints(b) || (a.rank || 0) - (b.rank || 0));
  return pool[0] || legal[0] || hand[0];
}

function onTurnTimeout() {
  if (!isHost || !game || game.resolvingTrick) return;
  clearTurnTimer();
  const idx = (game.phase === 'play') ? game.currentPlayer
    : (game.phase === 'bidding') ? game.currentPlayer
    : (game.phase === 'discard' || game.phase === 'trump') ? game.bidder : -1;
  if (idx < 0 || !players[idx]) return;
  if (horExpOn('netHoldTimerOnDisconnect') && players[idx].disconnected) return;
  // Bots never "time out" as policy targets
  if (players[idx].isBot && !players[idx].isTempBot) return;

  const policy = timeoutPolicy || 'auto';
  const name = players[idx].name || 'Player';

  // Policy 4: replace with bot for rest of this hand
  if (policy === 'botHand') {
    timeoutBotUntilHandEnd[idx] = true;
    players[idx].isBot = true;
    players[idx].isTempBot = true;
    players[idx].timeoutBotHand = true;
    const msg = `⏱ Time's up for ${name} — bot plays the rest of this hand`;
    const ma = $('messageArea');
    if (ma) ma.textContent = msg;
    broadcast({ type: 'message', text: msg });
    try { showDisconnectBanner(msg); } catch (e) {}
    try {
      if (game.phase === 'play') botPlay();
      else if (game.phase === 'bidding') botBid();
      else if (game.phase === 'discard') botDiscard();
      else if (game.phase === 'trump') botChooseTrump();
    } catch (e) { console.error('timeout botHand', e); }
    return;
  }

  // Policy 2: pass on bid; lowest legal on play
  if (policy === 'lowest') {
    if (game.phase === 'bidding') {
      const msg = `⏱ Time's up for ${name} — auto-pass`;
      const ma = $('messageArea');
      if (ma) ma.textContent = msg;
      broadcast({ type: 'message', text: msg });
      try { hostProcessBid({ player: idx, value: 0 }); } catch (e) { console.error(e); }
      return;
    }
    if (game.phase === 'play') {
      const card = pickLowestLegalCard(idx);
      const msg = `⏱ Time's up for ${name} — auto lowest card`;
      const ma = $('messageArea');
      if (ma) ma.textContent = msg;
      broadcast({ type: 'message', text: msg });
      if (card) try { hostProcessPlay({ player: idx, cardId: card.id }); } catch (e) { console.error(e); }
      return;
    }
    // discard / trump: fall through to safe auto
  }

  // Policy 3: skip — same mechanical as lowest, labeled as skip
  if (policy === 'skipLowest') {
    if (game.phase === 'bidding') {
      const msg = `⏱ ${name} skipped — pass`;
      const ma = $('messageArea');
      if (ma) ma.textContent = msg;
      broadcast({ type: 'message', text: msg });
      try { hostProcessBid({ player: idx, value: 0 }); } catch (e) { console.error(e); }
      return;
    }
    if (game.phase === 'play') {
      const card = pickLowestLegalCard(idx);
      const msg = `⏱ ${name} skipped — lowest legal card`;
      const ma = $('messageArea');
      if (ma) ma.textContent = msg;
      broadcast({ type: 'message', text: msg });
      if (card) try { hostProcessPlay({ player: idx, cardId: card.id }); } catch (e) { console.error(e); }
      return;
    }
  }

  // Policy 1 (default): smart auto-play via bot AI for one action
  const msg = `⏱ Time's up for ${name} — auto-playing`;
  const ma = $('messageArea');
  if (ma) ma.textContent = msg;
  broadcast({ type: 'message', text: msg });
  const wasBot = !!players[idx].isBot;
  players[idx].isBot = true;
  try {
    if (game.phase === 'play') botPlay();
    else if (game.phase === 'bidding') botBid();
    else if (game.phase === 'discard') botDiscard();
    else if (game.phase === 'trump') botChooseTrump();
  } catch (e) {
    console.error('timeout auto-play', e);
  }
  if (players[idx] && !wasBot && !players[idx].timeoutBotHand) {
    players[idx].isBot = false;
  }
}

function clearTimeoutBotsAfterHand() {
  for (let i = 0; i < players.length; i++) {
    if (players[i] && players[i].timeoutBotHand) {
      players[i].isBot = false;
      players[i].isTempBot = false;
      players[i].timeoutBotHand = false;
      delete timeoutBotUntilHandEnd[i];
    }
  }
}

function showDisconnectBanner(text) {
  let el = $('disconnectBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'disconnectBanner';
    el.className = 'disconnect-banner';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(showDisconnectBanner._t);
  showDisconnectBanner._t = setTimeout(() => el.classList.add('hidden'), 6000);
}

function hostResyncClient(conn, playerId) {
  if (!conn) return;
  try {
    conn.send({
      type: 'welcome',
      players: publicPlayersSnapshot(),
      yourId: playerId,
      beerSeats,
      hostVersion: APP_VERSION,
      reclaimed: true,
      settings: { includeRed2, red2Points, targetScore, botDifficulty, layDownWinningCards, revealTopNest }
    });
  } catch (e) {}
  if (!game) return;
  try {
    const idx = players.findIndex(p => p && p.id === playerId);
    sendTo(playerId, Object.assign({}, {
      type: 'state', trumpVoiceRestore790: true,
      seq: horNetSeq,
      phase: game.phase,
      scores: game.scores,
      bid: game.bid,
      highestBid: game.highestBid,
      minBid: minBid,
      passCount: game.passCount || 0,
      bidStatus: game.bidStatus,
      bidder: game.bidder,
      trump: game.trump,
    trumpVoiceEvent790: game.trumpVoiceEvent790 || null,
      currentPlayer: game.currentPlayer,
      trick: game.trick,
      ledColor: game.ledColor,
      players: players.map(p => ({ name: p.name, team: p.team, id: p.id, isBot: !!p.isBot, disconnected: !!p.disconnected, avatar: p.avatar || playerAvatars[p.id] || '', voice: p.isBot ? 'avatar' : validHumanVoice(p.voice) })),
      dealer: game.dealer,
      nestCount: game.nest?.length || 0,
      handsCount: (game.hands || []).map(h => (h ? h.length : 0)),
      targetScore: game.targetScore || targetScore,
      paused: !!game.paused,
      discardCount: game.discardCount || 0
    }));
    if (idx >= 0 && game.hands && game.hands[idx]) {
      sendTo(playerId, { type: 'privateHand', hand: game.hands[idx].map(c => ({ ...c })) });
    }
    if (game.phase === 'discard' && idx === game.bidder) {
      sendTo(playerId, {
        type: 'discardStart',
        player: idx,
        bidder: game.bidder,
        peerId: playerId,
        discardCount: game.discardCount || 0,
        hand: (game.hands[idx] || []).map(c => ({ ...c })),
        nestPreview: (game.nestPreview || []).map(c => ({ ...c })),
        topNestCard: game.topNestCard ? { ...game.topNestCard } : null,
        showKitty: false
      });
    }
  } catch (e) {
    horDebugLog('hostResyncClient failed: ' + (e && e.message));
  }
}

function hostStartDisconnectGrace(peerId) {
  const p = players.find(x => x.id === peerId);
  if (!p || p.isBot) return;
  if (p.disconnected && disconnectTimers[peerId]) return;
  if (disconnectTimers[peerId]) clearTimeout(disconnectTimers[peerId]);
  p.disconnected = true;
  const graceMs = horExpOn('netGraceRecovery') ? 45000 : DISCONNECT_GRACE_MS;
  const msg = `${p.name} disconnected — ${graceMs / 1000}s to reconnect`;
  showDisconnectBanner(msg);
  broadcast({ type: 'message', text: msg });
  const ma = $('messageArea');
  if (ma) ma.textContent = msg;
  broadcastState();

  disconnectTimers[peerId] = setTimeout(() => {
    delete disconnectTimers[peerId];
    hostReplaceWithBot(peerId, p.name, true);
  }, graceMs);
}

function hostCancelDisconnectGrace(peerId) {
  if (disconnectTimers[peerId]) {
    clearTimeout(disconnectTimers[peerId]);
    delete disconnectTimers[peerId];
  }
  const p = players.find(x => x && x.id === peerId);
  if (p) p.disconnected = false;
}

/** Replace a human seat with a bot (leave or long disconnect). */
function hostReplaceWithBot(peerId, nameHint, fromDisconnect = false) {
  if (!isHost) return;
  const idx = players.findIndex(p => p.id === peerId);
  if (idx < 0) return;
  if (players[idx].isBot && players[idx].isTempBot) return;

  const oldName = players[idx].name || nameHint || 'Player';
  hostCancelDisconnectGrace(peerId);
  try {
    const c = connMap[peerId];
    if (c) { try { c.close(); } catch (e) {} delete connMap[peerId]; }
  } catch (e) {}

  const botId = 'bot-fill-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  players[idx] = {
    id: botId,
    name: (oldName.replace(/\s*\(bot\)$/i, '') + ' (bot)').slice(0, 18),
    team: players[idx].team,
    isHost: false,
    isBot: true,
    isTempBot: true,
    replacedHumanName: oldName,
  };
  const msg = fromDisconnect
    ? `🤖 ${oldName} replaced by a bot (can rejoin later)`
    : `🤖 ${oldName} left — replaced by a bot`;
  try { showDisconnectBanner(msg); } catch (e) {}
  const ma = $('messageArea');
  if (ma) ma.textContent = msg;
  broadcast({ type: 'message', text: msg });
  broadcast({ type: 'players', players: publicPlayersSnapshot() });
  broadcastState();

  // If it was their turn, let the bot act
  if (game && !game.resolvingTrick) {
    if ((game.phase === 'play' || game.phase === 'bidding') && game.currentPlayer === idx) {
      scheduleBot();
    } else if ((game.phase === 'discard' || game.phase === 'trump') && game.bidder === idx) {
      scheduleBot();
    }
  }
}

/** Rejoining player takes back a temp bot seat if name matches or free bot seat. */
function hostTryReclaimSeat(conn, data) {
  const name = (data.name || '').trim();
  const nameKey = name.toLowerCase();
  let idx = -1;
  if (horExpOn('netNameReclaim')) {
    idx = players.findIndex(p => p && p.disconnected && !p.isBot && (p.id === data.id || (nameKey && String(p.name || '').trim().toLowerCase() === nameKey)));
    if (idx < 0) idx = players.findIndex(p => p && p.isTempBot && nameKey && String(p.replacedHumanName || '').trim().toLowerCase() === nameKey);
    if (idx < 0 && nameKey) idx = players.findIndex(p => p && p.isTempBot && String(p.name || '').replace(/\s*\(bot\)$/i, '').trim().toLowerCase() === nameKey);
    if (idx < 0 && data.reconnect) idx = players.findIndex(p => p && p.isTempBot);
  } else {
    idx = players.findIndex(p => p && p.isTempBot && p.replacedHumanName === name);
    if (idx < 0) idx = players.findIndex(p => p && p.isTempBot);
  }
  if (idx < 0) return false;

  const team = players[idx].team;
  players[idx] = {
    id: data.id,
    name: name || players[idx].replacedHumanName || players[idx].name || 'Player',
    avatar: humanAvatarAllowed783(avatarKey(data.avatar)) ? avatarKey(data.avatar) : AVATARS[0],
    voice: validHumanVoice(data.voice),
    team,
    isHost: false,
    isBot: false,
    isTempBot: false,
    disconnected: false,
  };
  hostCancelDisconnectGrace(data.id);
  connMap[data.id] = conn;
  horPeerLastSeen[data.id] = Date.now();
  const msg = `✅ ${players[idx].name} reconnected`;
  try { showDisconnectBanner(msg); } catch (e) {}
  broadcast({ type: 'message', text: msg });
  broadcast({ type: 'players', players: publicPlayersSnapshot() });
  broadcastState();
  hostResyncClient(conn, data.id);
  return true;
}

function clientLeaveReplace() {
  const offline = isSoloPractice || roomCode === 'OFFLINE';
  const message = offline ? 'Leave this offline table?' : isHost
    ? 'You are the host. Leaving will end the room for everyone. Continue?'
    : 'Leave and let a bot take your seat?';
  if (!confirm(message)) return;
  leaveTableAfterConfirmation043();
}

// Both the rail arrow and the lobby Leave control release the same state.
function forgetRoomSession043() {
  try { sessionStorage.removeItem('rookSession'); } catch (e) {}
  horMarkActiveTable(false);
  try {
    ['rejoinBtn', 'reconnectBox'].forEach(id => {
      const el = $(id);
      if (el) el.classList.add('hidden');
    });
    const input = $('hor-room-code');
    if (input) input.value = '';
  } catch (e) {}
  try {
    const url = new URL(location.href);
    url.searchParams.delete('room');
    url.searchParams.delete('code');
    history.replaceState(history.state, '', url.href);
  } catch (e) {}
}

function leaveTableAfterConfirmation043() {
  const offline = isSoloPractice || roomCode === 'OFFLINE';
  // Mark leaving before notification, so close/error callbacks cannot rejoin.
  window._horIntentionalLeave = true;
  window._horNoServiceStop = true;
  if (!offline && isHost) {
    try { broadcast({ type: 'error', message: 'Host left the game.' }); } catch (e) {}
  } else if (!offline) {
    try {
      if (hostConnection && hostConnection.open) {
        hostConnection.send({ type: 'leaveReplace', playerId: myPeerId, name: myName });
      }
    } catch (e) {}
  }
  // Allow a guest's replacement request to leave the channel before closing it.
  if (!offline && !isHost) {
    horCancelLobbyOperation043();
    forgetRoomSession043();
    setTimeout(leaveTableToLobby043, 300);
  } else leaveTableToLobby043();
}

function leaveTableToLobby043() {
  forgetRoomSession043();
  try { teardownMultiplayerBeforeLobby(); } catch (e) { console.error(e); }
  forgetRoomSession043();
  location.reload();
}

/** Sole holder of every remaining trump, or null. */
function getAllTrumpsHolder() {
  if (!game || game.phase !== 'play' || !game.hands) return null;
  if (game.claimDeclined) return null;
  const holders = [];
  let totalTrumps = 0;
  for (let i = 0; i < game.hands.length; i++) {
    const n = (game.hands[i] || []).filter(c => isTrumpCard(c, game.trump)).length;
    if (n > 0) holders.push(i);
    totalTrumps += n;
  }
  return totalTrumps > 0 && holders.length === 1 ? holders[0] : null;
}

/** Remaining cards across all hands (current trick not counted). */
function remainingCardsInHands() {
  if (!game || !game.hands) return 0;
  return game.hands.reduce((s, h) => s + ((h && h.length) || 0), 0);
}

/**
 * A card is a definite winner only if, when led, no opponent can legally
 * answer with a card that beats it. This is intentionally stricter than
 * merely proving the player can eventually take every remaining trick.
 */
function handHasFollowColor(hand, color, trump) {
  if (!hand || !color) return false;
  return hand.some(c => {
    if (typeof followsLedSuit === 'function') return followsLedSuit(c, color, trump);
    return c && c.color === color;
  });
}

function cardIsDefiniteWinner(card, seat) {
  if (!game || !game.hands || !card) return false;
  const trump = game.trump;
  const ledColor = isTrumpCard(card, trump) ? (trump || card.color) : card.color;
  if (!ledColor) return false;

  for (let i = 0; i < 4; i++) {
    if (i === seat) continue;
    const oppHand = game.hands[i] || [];
    const mustFollow = handHasFollowColor(oppHand, ledColor, trump);
    for (const opp of oppHand) {
      if (!opp) continue;
      if (isTrumpCard(card, trump)) {
        if (isTrumpCard(opp, trump) && compareCards(opp, card, trump, trump) > 0) return false;
        continue;
      }
      if (opp.color === card.color && compareCards(opp, card, card.color, trump) > 0) return false;
      if ((!mustFollow || (specialsAnytime && isSpecialCard(opp))) && isTrumpCard(opp, trump)) return false;
    }
  }
  return true;
}

function allRemainingCardsAreDefiniteWinners(seat) {
  const hand = (game && game.hands && game.hands[seat]) || [];
  return hand.length > 0 && hand.every(c => cardIsDefiniteWinner(c, seat));
}

/** Only lay down when every leftover card is a stone-cold winner. */
function playerCanForceRest(seat) {
  if (!game || !game.hands) return false;
  const my = game.hands[seat] || [];
  if (!my.length) return false;
  let opp = 0;
  for (let i = 0; i < 4; i++) {
    if (i !== seat) opp += (game.hands[i] || []).length;
  }
  if (!opp) return true;
  return allRemainingCardsAreDefiniteWinners(seat);
}

/**
 * Returns { seat, reason: 'trumps'|'rest' } when one player may claim the rest,
 * or null. Respects claimDeclined for the current hand.
 */
function getRestClaimInfo() {
  if (layDownWinningCards === false) return null;
  if (!game || game.phase !== 'play' || !game.hands) return null;
  if (game.claimDeclined) return null;
  if (game.claimAnimation || game.claimAnimating) return null;
  if (game.resolvingTrick) return null;
  // Mid-trick: wait until the trick resolves
  if (game.trick && game.trick.length > 0 && game.trick.length < 4) return null;
  const left = remainingCardsInHands();
  if (left < 2) return null;
  // Last trick (one card each) — just play it out. No lay-down.
  let maxLeft = 0;
  for (let i = 0; i < 4; i++) maxLeft = Math.max(maxLeft, ((game.hands[i] || []).length));
  if (maxLeft <= 1) return null;

  const force = [];
  for (let i = 0; i < 4; i++) {
    if (playerCanForceRest(i)) force.push(i);
  }
  if (force.length === 1) {
    const seat = force[0];
    return { seat, reason: (getAllTrumpsHolder() === seat) ? 'trumps' : 'rest' };
  }

  const trumpHolder = getAllTrumpsHolder();
  if (trumpHolder != null && playerCanForceRest(trumpHolder)) {
    return { seat: trumpHolder, reason: 'trumps' };
  }
  return null;
}

function getRestClaimHolder() {
  const info = getRestClaimInfo();
  return info ? info.seat : null;
}

function showAllTrumpsClaimUI() {
  if (isSpectator || !game || game.phase !== 'play') return;
  const info = getRestClaimInfo();
  if (!info || info.seat !== myIndex) return;
  // Only when it is the claimer's turn to play
  if (game.currentPlayer !== myIndex) return;

  const panel = ensureActionPanelOnTop() || $('actionPanel');
  if (!panel) return;

  const name = players?.[myIndex]?.name || 'You';
  const reasonText = info.reason === 'trumps'
    ? 'controls every remaining winning card'
    : 'can take the rest of the tricks';

  panel.className = 'action-panel trump-claim-panel lt-floating-panel';
  panel.classList.remove('hidden', 'bid-panel');
  panel.innerHTML = `
    <span><strong>${name}</strong> ${reasonText}.</span>
    <button type="button" id="layDownClaimBtn" class="btn primary">Lay Down &amp; End Hand</button>
    <button type="button" id="continueClaimBtn" class="btn">Continue Playing</button>`;

  const layBtn = $('layDownClaimBtn');
  if (layBtn) layBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHost) hostProcessAllTrumpsClaim({ player: myIndex });
    else if (hostConnection && hostConnection.open) hostConnection.send({ type: 'claimAllTrumps', player: myIndex });
  };
  const contBtn = $('continueClaimBtn');
  if (contBtn) contBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHost) hostDeclineClaim(myIndex);
    else if (hostConnection && hostConnection.open) hostConnection.send({ type: 'declineClaim', player: myIndex });
    hideActionPanel();
  };
}

function hostDeclineClaim(player) {
  if (!isHost || !game || game.phase !== 'play') return;
  const info = getRestClaimInfo();
  if (!info || info.seat !== player) return;
  game.claimDeclined = true;
  game.trumpClaimPlayer = null;
  hideActionPanel();
  broadcast({ type: 'message', text: `${players[player]?.name || 'Player'} continues playing.` });
  broadcastState();
  // Re-prompt so the current player can act (panel is gone)
  hostPromptPlay();
}

function hostProcessAllTrumpsClaim(data) {
  if (!isHost || !game || game.phase !== 'play' || game.paused || !data || data.player !== game.currentPlayer) return;
  if (game.resolvingTrick || game.claimAnimating) return;
  const info = getRestClaimInfo();
  if (!info || data.player !== info.seat) return;
  const holder = info.seat;

  // Snapshot every player's remaining cards before the claim clears all hands.
  game.claimRevealHands = (game.hands || []).map((hand, i) => ({
    player: i,
    name: (players[i] && players[i].name) || `Player ${i + 1}`,
    team: players[i] ? players[i].team : (i % 2),
    laidDown: i === holder,
    cards: (hand || []).map(c => ({ ...c })),
  }));
  // Snapshot holder's cards for the lay-down animation (only their hand)
  const holderCards = (game.hands[holder] || []).map(c => ({ ...c }));

  // Award every remaining card (trick + all hands) to the claimer's team
  const claimCards = (game.trick || []).map(t => ({ ...t.card }));
  for (let i = 0; i < 4; i++) {
    for (const c of (game.hands[i] || [])) claimCards.push({ ...c });
  }
  game.earlyClaimTeam = players[holder].team;
  if (!game.tricksTaken) game.tricksTaken = [[], []];
  game.tricksTaken[game.earlyClaimTeam].push(...claimCards);

  // A winning lay-down represents one won trick for every remaining card
  // laid down. Example: laying down 6 cards = 6 additional won tricks.
  // Points are credited to the claimer and, for leaderboard/stat purposes,
  // to the claimer's partner just like a normally won trick.
  try {
    const laidDownTricks = holderCards.length;
    const laidDownPoints = claimCards.reduce((sum, c) => sum + cardPoints(c), 0);
    const holderStat = ps(holder);
    holderStat.tricksWon += laidDownTricks;
    holderStat.points += laidDownPoints;
    holderStat.trickPtsSum += laidDownPoints;
    // Captured special cards in a legal claim remain real captures.
    if(claimCards.some(isRed2))holderStat.red2Captures++;
    if(claimCards.some(c=>c.color==='rook'||c.id==='rook'))holderStat.rookCaptures++;
    if(!game.careerExtras)game.careerExtras=[{},{},{},{}];
    if((game.trick||[]).some(t=>isRed2(t.card)&&players[t.player].team!==players[holder].team)||(game.hands||[]).some((h,i)=>players[i].team!==players[holder].team&&h.some(isRed2)))game.careerExtras[holder].red2Rescues=(game.careerExtras[holder].red2Rescues||0)+1;
    const partnerSeat = (holder + 2) % 4;
    if (players[partnerSeat]) {
      const partnerStat = ps(partnerSeat);
      partnerStat.points += laidDownPoints;
      partnerStat.trickPtsSum += laidDownPoints;
    }
  } catch (e) {}

  // Clear table / hands
  game.trick = [];
  game.ledColor = null;
  game.currentPlayer = holder;
  game.hands = [[], [], [], []];
  game.myHand = (holder === myIndex) ? [] : (game.myHand || []);
  game.resolvingTrick = true;
  game.claimAnimating = true;
  game.trumpClaimPlayer = holder;
  game.laidDownBy = holder;
  game.laidDownName = (players[holder] && players[holder].name) || ('Player ' + (holder + 1));
  game.claimLastTricks = (typeof recentTricks !== 'undefined' && recentTricks)
    ? recentTricks.slice(0, 3).map(tr => ({
        winner: tr.winner,
        plays: (tr.plays || []).map(t => ({ player: t.player, card: t.card ? { ...t.card } : t.card })),
        trump: tr.trump,
        ledColor: tr.ledColor,
      }))
    : [];
  game.claimAnimation = {
    player: holder,
    cards: holderCards,
    reason: info.reason,
  };
  game.revealedHands = null; // no longer use the all-hands modal

  const reasonMsg = info.reason === 'trumps'
    ? 'lays down all remaining winning cards and ends the hand'
    : 'lays down the rest of the tricks and ends the hand';
  try { clearTurnTimer(); } catch (e) {}
  try { hideActionPanel(); } catch (e) {}
  broadcast({ type: 'message', text: `🃏 ${players[holder].name} ${reasonMsg}.` });
  broadcastState();

  // Animation: land ~1.2s + hold 2s + fade 0.8s ≈ 4s total
  const claimingGame = game, claimingAnimation = game.claimAnimation;
  const finishClaim = () => {
    if (game !== claimingGame || game.phase !== 'play' || game.claimAnimation !== claimingAnimation || !game.claimAnimating) return;
    if (game.paused) { game._resumeTrick = finishClaim; return; }
    delete game._resumeTrick;
    game.claimAnimation = null;
    game.claimAnimating = false;
    game.resolvingTrick = false;
    hostEndHand();
  };
  setTimeout(finishClaim, solScaledDelay(4000, 180));
}

function relocateClaimLaydownLayer() {
  const layer = $('claimLaydownLayer');
  if (!layer) return;
  if (layer.parentElement !== document.body) document.body.appendChild(layer);
  layer.classList.add('lt-claim-layer');
}

function playClaimLaydownAnimation(holder, cards, reason) {
  if (!cards || !cards.length) return;
  if (window._claimAnimPlaying) {
    relocateClaimLaydownLayer();
    return;
  }
  window._claimAnimPlaying = true;

  // Hide the old showdown modal if it somehow appears
  const oldModal = $('trumpShowdownModal');
  if (oldModal) oldModal.classList.add('hidden');

  const felt = document.body;

  let layer = $('claimLaydownLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'claimLaydownLayer';
    layer.className = 'claim-laydown-layer lt-claim-layer';
    felt.appendChild(layer);
  } else if (layer.parentElement !== felt) {
    felt.appendChild(layer);
  }
  layer.classList.add('lt-claim-layer');
  layer.innerHTML = '';
  layer.classList.remove('fade-out', 'hidden');
  layer.style.opacity = '1';

  // Message banner
  const banner = document.createElement('div');
  banner.className = 'claim-laydown-banner';
  const holderName = (players && players[holder] && players[holder].name) || 'Player';
  banner.textContent = reason === 'trumps'
    ? `${holderName} lays down the remaining winning cards`
    : `${holderName} lays down the rest of the tricks`;
  layer.appendChild(banner);

  // Origin direction relative to local view
  const seatBase = (myIndex >= 0) ? myIndex : 0;
  let fromX = 0, fromY = 90, fromRot = 0;
  if (holder === seatBase) {
    fromX = 0; fromY = 140; fromRot = 8;
  } else if (holder === (seatBase + 2) % 4) {
    fromX = 0; fromY = -140; fromRot = -8;
  } else if (holder === (seatBase + 1) % 4) {
    fromX = -160; fromY = 20; fromRot = -18;
  } else {
    fromX = 160; fromY = 20; fromRot = 18;
  }

  // Scatter cards in a natural hand-laid pile (not a neat row)
  const n = cards.length;
  cards.forEach((card, i) => {
    let cls = card.color === 'rook' ? 'rook' : card.color;
    if (isRed2(card) && includeRed2) cls = 'red2 red2-art';
    else if (isRed2(card)) cls = 'red';
    if (isRed1(card)) cls = 'red1';
    if (isTrumpCard(card, game && game.trump)) cls += ' is-trump';

    const el = document.createElement('div');
    el.className = `card-face claim-laid-card ${cls}`;
    el.innerHTML = cardInnerHTML(card);

    const plane = document.createElement('div');
    plane.className = 'claim-plane-wrapper';
    const claimScale = 0.85 * Math.max(innerWidth / 875, innerHeight / 1797) / (915 / 1797);
    plane.style.setProperty('--claim-plane-scale', String(claimScale));
    plane.appendChild(el);

    // Pseudo-random but stable-looking scatter
    const seed = (i * 17 + n * 3) % 100;
    const angle = (i / Math.max(n, 1)) * Math.PI * 1.6 - 0.7 + (seed - 50) * 0.004;
    const radius = 18 + (seed % 40) + Math.min(i, 6) * 6;
    const tx = Math.cos(angle) * radius + (seed % 13) - 6;
    const ty = Math.sin(angle) * radius * 0.55 + (i % 3) * 4 - 8;
    const rot = ((seed * 7) % 51) - 25; // -25° .. +25°

    el.style.setProperty('--tx', `${tx}px`);
    el.style.setProperty('--ty', `${ty}px`);
    el.style.setProperty('--rot', `${rot}deg`);
    el.style.setProperty('--fromX', `${fromX + (i - n / 2) * 12}px`);
    el.style.setProperty('--fromY', `${fromY}px`);
    el.style.setProperty('--fromRot', `${fromRot + (i - n / 2) * 4}deg`);
    el.style.setProperty('--delay', `${solScaledDelay(60 * i, 0)}ms`);
    plane.style.zIndex = String(10 + i);

    layer.appendChild(plane);
  });

  // Clear local hand display if we are the holder
  if (holder === myIndex && game) {
    game.myHand = [];
    try { renderHand(false); } catch (e) {}
  }
  try { renderUI(); } catch (e) {}

  // Land time ≈ 0.06*n + 0.7s; then hold 2s; then fade 0.8s
  const landMs = Math.min(1200, 80 + n * 60 + 700);
  if (window._claimAnimFadeTimer) clearTimeout(window._claimAnimFadeTimer);
  if (window._claimAnimRemoveTimer) clearTimeout(window._claimAnimRemoveTimer);
  window._claimAnimFadeTimer = setTimeout(() => {
    if (!layer || !layer.parentNode) {
      window._claimAnimPlaying = false;
      return;
    }
    layer.classList.add('fade-out');
    window._claimAnimRemoveTimer = setTimeout(() => {
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      window._claimAnimPlaying = false;
    }, solScaledDelay(850, 0));
  }, solScaledDelay(landMs + 2000, 0));
}

/** Legacy no-op — claim no longer uses the all-hands modal box. */
function showTrumpShowdown() {
  const modal = $('trumpShowdownModal');
  if (modal) modal.classList.add('hidden');
}

function hostPromptPlay() {
  if (!game || game.phase !== 'play') return;
  if (game.resolvingTrick || game.claimAnimating) return;
  if (game.paused) return;
  try {
    const panel = $('actionPanel');
    if (panel && (panel.classList.contains('trump-showdown') || /stamp the trump|choose trump/i.test(panel.textContent || ''))) {
      hideActionPanel();
    }
  } catch (e) {}

  const claimInfo = getRestClaimInfo();
  game.trumpClaimPlayer = claimInfo ? claimInfo.seat : null;
  // Bot auto-claim only when it is that bot's turn (never block the human)
  if (claimInfo
      && players[claimInfo.seat]
      && players[claimInfo.seat].isBot
      && game.currentPlayer === claimInfo.seat) {
    hideActionPanel();
    setTimeout(() => {
      if (!game || game.phase !== 'play' || game.claimAnimating) return;
      const again = getRestClaimInfo();
      if (again && again.seat === claimInfo.seat && game.currentPlayer === claimInfo.seat) {
        hostProcessAllTrumpsClaim({ player: claimInfo.seat });
      }
    }, solScaledDelay(450, 0));
    return;
  }
  // Pre-selecting a card ahead of your turn has been removed (it caused a
  // render-thrashing freeze when rapidly re-tapped) — plays only submit
  // when it's actually the player's turn now, so nothing to check here.

  const p = players[game.currentPlayer];
  const name = (p && p.name) || 'Player';
  const msg = game.currentPlayer === myIndex
    ? `${name} to play — tap a gold-highlighted card`
    : `${name} to play`;
  $('messageArea').textContent = msg;
  broadcast({ type: 'message', text: msg });
  if (game.currentPlayer === myIndex && !horSolSeatIsBot()) {
    lastTurnIndex = myIndex;
    renderHand();
    try { renderUI(); } catch (e) {}
    try { maybeRemindTurn(); } catch (e) {}
    if (game.trumpClaimPlayer === myIndex) showAllTrumpsClaimUI();
  } else {
    lastTurnIndex = game.currentPlayer;
    // Don't hide claim panel if we just showed it for the holder
    if (game.trumpClaimPlayer !== myIndex) hideActionPanel();
    renderHand();
  }
  startTurnTimer();
  scheduleBot();
}








// Card taps only submit a play when it is actually the player's turn right
// now. There used to be an option to "pre-click" a card before your turn so
// it would auto-play the moment your turn arrived — removed because rapid
// repeated taps each triggered a full hand re-render + layout pass, and
// spamming it could stack up enough of those to freeze the tab.
function playCardIfMyTurn(cardId) {
  if (!game || game.phase !== 'play' || myIndex < 0 || isSpectator || horSolSeatIsBot()) return false;
  const id = String(cardId);
  if (game.currentPlayer !== myIndex || game.resolvingTrick || game.paused) {
    const msg = $('messageArea');
    if (msg) msg.textContent = 'Wait for your turn to play a card.';
    return false;
  }
  const hand = game.myHand || [];
  const card = hand.find(c => String(c.id) === id);
  if (!card) return false;
  if (!canPlay(card, hand, game.ledColor, game.trump)) {
    const msg = $('messageArea');
    if (msg) msg.textContent = 'That card cannot be played for this trick.';
    return false;
  }
  rememberOwnPlayOrigin041(id);
  submitPlay(id);
  return true;
}

function submitPlay(cardId) {
  if (Date.now() < playLockUntil) return;
  playLockUntil = Date.now() + 450;
  if (isHost) {
    hostProcessPlay({ player: myIndex, cardId, actionId: horNewActionId('play') });
  } else {
    const sent = horQueueClientAction({ type: 'play', player: myIndex, cardId });
    if (!sent) horBeginClientReconnect();
  }
}


function hostProcessPlay(data) {
  if (!game || game.phase !== 'play') return;
  if (game.resolvingTrick) return;
  if (game.paused) return;
  if (data.player !== game.currentPlayer) return;
  if (players[data.player] && players[data.player].disconnected) return;
  if (horRememberAction(data)) return;
  const hand = game.hands[data.player];
  if (!hand) return;
  const idx = hand.findIndex(c => c.id === data.cardId);
  if (idx < 0) return;
  const card = hand[idx];
  if (!canPlay(card, hand, game.ledColor, game.trump)) return;

  // Snapshot for undo (practice with bots)
  if (players.every(p => p.isBot || p.id === myPeerId)) {
    lastPlaySnapshot = {
      hands: game.hands.map(h => h.map(c => ({ ...c }))),
      trick: game.trick.map(t => ({ player: t.player, card: { ...t.card } })),
      ledColor: game.ledColor,
      currentPlayer: game.currentPlayer,
      fromHuman: !!(players[data.player] && !players[data.player].isBot),
      tricksTaken: [
        game.tricksTaken[0].map(c => ({ ...c })),
        game.tricksTaken[1].map(c => ({ ...c })),
      ],
    };
  } else {
    lastPlaySnapshot = null;
  }

  hand.splice(idx, 1);
  if (!game.ledColor) {
    game.ledColor = (card.color === 'rook' || isRed2(card) || isRed1(card)) ? game.trump : card.color;
  } else if (game.ledColor && typeof followsLedSuit === 'function' && !followsLedSuit(card, game.ledColor, game.trump)) {
    // Failed to follow — mark void for extreme AI. Playing a special on a
    // color lead also proves the void unless specials-anytime is on.
    const specialEscape = !!(typeof specialsAnytime !== 'undefined' && specialsAnytime && isSpecialCard(card));
    if (!specialEscape) {
      if (!knownVoids[data.player]) knownVoids[data.player] = {};
      knownVoids[data.player][game.ledColor] = true;
    }
  }

  game.trick.push({ player: data.player, card });
  clearTurnTimer();
  notifyCardPlayed(card);


  if (game.trick.length === 4) {
    game.resolvingTrick = true;
    game.resolvingTrickPoints = game.trick.reduce((sum, t) => sum + cardPoints(t.card), 0);
    let winner = game.trick[0];
    for (let i = 1; i < 4; i++) {
      if (compareCards(game.trick[i].card, winner.card, game.ledColor, game.trump) > 0) {
        winner = game.trick[i];
      }
    }
    const team = players[winner.player].team;
    const trickPoints = game.trick.reduce((sum, t) => sum + cardPoints(t.card), 0);
    game.tricksTaken[team].push(...game.trick.map(t => t.card));
    try {
      const wStat = ps(winner.player);
      wStat.tricksWon++;
      wStat.points += trickPoints;
      wStat.trickPtsSum += trickPoints;
      // Partnership scoring: a player's partner receives the same point credit
      // for leaderboard/stats purposes. The actual team score is still counted once.
      const partnerSeat = (winner.player + 2) % 4;
      if (players[partnerSeat]) {
        const partnerStat = ps(partnerSeat);
        partnerStat.points += trickPoints;
        partnerStat.trickPtsSum += trickPoints;
      }
      if (trickPoints >= 30) wStat.bigTricks++;
      if(!game.careerExtras)game.careerExtras=[{},{},{},{}];
      const ce=game.careerExtras[winner.player];
      ce.bestTrickPoints=Math.max(ce.bestTrickPoints||0,trickPoints);
      if(game.trick.some(t=>t.card&&isRed2(t.card)&&players[t.player].team!==team))ce.red2Rescues=(ce.red2Rescues||0)+1;
      if (game.trick.some(t => t.card && (t.card.color === 'rook' || t.card.id === 'rook'))) wStat.rookCaptures++;
      if (game.trick.some(t => t.card && isRed2(t.card))) wStat.red2Captures++;
    } catch (e) {}
    try {
      const wName = (players[winner.player] && players[winner.player].name) || 'Player';
      const rookTaken = game.trick.some(t => t.card && (t.card.color === 'rook' || t.card.id === 'rook'));
      const red2Taken = game.trick.some(t => t.card && isRed2(t.card));
      if (rookTaken) botMaybeTableTalk('rook', { name: wName, prefer: winner.player });
      else if (red2Taken) botMaybeTableTalk('red2', { name: wName, prefer: winner.player });
      else if (trickPoints >= 30) botMaybeTableTalk('highPts', { name: wName, pts: trickPoints, prefer: winner.player });
      else if (players[winner.player] && players[winner.player].isBot) {
        botMaybeTableTalk('trickWin', { name: wName, pts: trickPoints, prefer: winner.player });
      } else {
        botMaybeTableTalk('trickLose', { name: wName, pts: trickPoints });
      }
    } catch (e) {}
    const msg = `🏆 ${players[winner.player].name} wins the trick!`;
    const subject=captureSubject793(players[winner.player].name,players[winner.player].id);
    $('messageArea').textContent = '🏆 '+subject.name+subject.win+' the trick!';
    broadcast({ type: 'message', text: msg, event:'trick-winner', winnerName:players[winner.player].name, winnerId:players[winner.player].id });
    // The individual card landing SFX already plays for each card. Avoid an
    // extra synthetic chime immediately after the fourth card completes a trick.
    // Highlight winner card in trick. The trick is broadcast/rendered first so
    // everyone can clearly see the played cards before any celebration appears.
    const pendingCaptureEvents = (() => {
      try {
        const caps = detectSpecialCaptures(game.trick, winner);
        const wName = (players[winner.player] && players[winner.player].name) || 'Player';
        const events = [];
        if (caps && caps.length) {
          caps.forEach(kind => events.push({ kind, winnerName: wName, winnerId:players[winner.player]?.id }));
        }
        // The Raven capture owns this trick's celebration; accounting above stays intact.
        if (trickPoints >= 30 && !caps.includes('rook-red2')) {
          events.push({ kind: 'high-points', amount: trickPoints, winnerName: wName, winnerId:players[winner.player]?.id });
        }
        return { events, winnerName: wName };
      } catch (e) {
        console.error(e);
        return { events: [], winnerName: 'Player' };
      }
    })();
    // Highlight winner card in trick
    game.lastTrickWinner = winner.player;
    broadcastState();
    lastPlaySnapshot = null; // can't undo after trick resolves

    // Give players a short, deliberate pause to see the winning trick before
    // the celebration overlay/fanfare starts.
    const resolvingGame = game, resolvingCards = game.trick;
    const ownsResolution = () => game === resolvingGame && game.trick === resolvingCards && game.phase === 'play' && game.resolvingTrick;
    if (pendingCaptureEvents.events.length) {
      setTimeout(() => {
        if (!ownsResolution()) return;
        try {
          queueCaptureCelebrations(pendingCaptureEvents.events, pendingCaptureEvents.winnerName);
          broadcast({ type: 'specialCapture', kinds: pendingCaptureEvents.events, winnerName: pendingCaptureEvents.winnerName });
        } catch (e) {}
      }, solScaledDelay(850, 45));
    }

    const finishTrick = () => {
      if (!ownsResolution()) return;
      if (game.paused) { game._resumeTrick = finishTrick; return; }
      delete game._resumeTrick;
      try {
        lastCompletedTrick = game.trick.map(t => ({ player: t.player, card: { ...t.card } }));
        lastCompletedTrickWinner = winner.player;
        const entry = {
          plays: lastCompletedTrick,
          winner: winner.player,
          ledColor: game.ledColor,
          trump: game.trump,
          points: trickPoints,
          team: team,
          winnerName: (players[winner.player] && players[winner.player].name) || 'Player',
          hand: (handHistory && handHistory.length) ? handHistory.length + 1 : 1,
        };
        recentTricks = [entry].concat(recentTricks || []).slice(0, 3);
        refreshPortraitLastTrick029();
        try { recordMatchTrick(entry); } catch (e) {}
      } catch (e) {}
      game.trick = [];
      game.ledColor = null;
      game.lastTrickWinner = null;
      game.currentPlayer = winner.player;
      game.resolvingTrick = false;
      game.resolvingTrickPoints = 0;
      // A Rook 007: the previous-trick target/hint must be evaluated only after
      // resolvingTrick is cleared; canUsePortraitPreviousTrick() intentionally
      // rejects the center while a trick is still resolving.
      try { syncPortraitPreviousTrickTarget(); maybeShowPortraitLastTrickHint(); } catch (e) {}
      window._trickCapturing = false;
      window._trickFlightKey = '';
      window._trickTakenRel = -1;
      try { clearTrickFlightLayers(); } catch (e) {}
      try { clearBottomTookMark(); } catch (e) {}
      try { updateLandscapeTheater(); } catch (e) {}
  try { window.HORCharacterStudio077?.sync(); } catch (e) { console.warn('Character presentation:', e); }
      if (game.hands.every(h => h.length === 0)) {
        hostEndHand();
      } else {
        broadcastState();
        hostPromptPlay();
      }
    };
    setTimeout(finishTrick, solScaledDelay(2800, 700));
  } else {
    game.currentPlayer = (game.currentPlayer + 1) % 4;
    broadcastState();
    hostPromptPlay();
  }
}

function hostUndoLastPlay() {
  if (!isHost || !lastPlaySnapshot || !game || game.phase !== 'play' || game.resolvingTrick) return;
  game.hands = lastPlaySnapshot.hands;
  game.trick = lastPlaySnapshot.trick;
  game.ledColor = lastPlaySnapshot.ledColor;
  game.currentPlayer = lastPlaySnapshot.currentPlayer;
  game.tricksTaken = lastPlaySnapshot.tricksTaken;
  lastPlaySnapshot = null;
  broadcastState();
  hostPromptPlay();
}



function nestCardMarkup(card) {
  try {
    if (typeof renderCardHTML === 'function') return renderCardHTML(card, true);
  } catch (e) {}
  try {
    let cls = (card && card.color === 'rook') ? 'rook' : (card && card.color) || '';
    if (typeof isRed2 === 'function' && isRed2(card) && includeRed2) cls = 'red2 red2-art';
    else if (typeof isRed2 === 'function' && isRed2(card)) cls = 'red';
    if (typeof isRed1 === 'function' && isRed1(card)) cls = 'red1';
    const inner = (typeof cardInnerHTML === 'function') ? cardInnerHTML(card) : ((card && (card.rank || card.id)) || '?');
    return '<div class="card-face ' + cls + ' small">' + inner + '</div>';
  } catch (e) {
    return '<div class="card-face">' + ((card && (card.rank || card.id)) || '?') + '</div>';
  }
}

/** Show nest capture overlay for ~3s, then fade. Returns hold time in ms (0 if skipped). */
function showNestCaptureAnimation(winnerName, nestCards, pts) {
  if (nestLastTrickAnim === false) return 0;
  const cards = Array.isArray(nestCards) ? nestCards.filter(Boolean) : [];
  const HOLD_MS = solScaledDelay(3200, 0);
  const FADE_MS = solScaledDelay(500, 0);
  try {
    let layer = document.getElementById('ghNestAnim');
    if (layer) layer.remove();
    if (!cards.length) return 0;
    layer = document.createElement('div');
    layer.id = 'ghNestAnim';
    layer.className = 'gh-nest-table-drop';
    layer.setAttribute('aria-hidden', 'true');
    const table = document.querySelector('.table-felt') || document.querySelector('.table') || document.body;
    const rect = table.getBoundingClientRect();
    layer.style.left = Math.round(rect.left + rect.width * 0.5) + 'px';
    layer.style.top = Math.round(rect.top + rect.height * 0.53) + 'px';
    const cardW = Math.max(58, Math.min(92, Math.round(Math.min(rect.width || window.innerWidth, window.height) * 0.17)));
    const cardH = Math.round(cardW * (84 / 58));
    const rotations = [-11, 7, 13, -5, 10, -8, 4];
    layer.style.setProperty('--nest-w', cardW + 'px');
    layer.style.setProperty('--nest-h', cardH + 'px');
    layer.style.setProperty('--nest-fly-ms', solScaledDelay(520, 100) + 'ms');
    document.body.appendChild(layer);
    cards.forEach((card, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'gh-nest-card';
      const offsetX = Math.round((i - (cards.length - 1) / 2) * Math.min(14, cardW * 0.17));
      const offsetY = Math.round(Math.abs(i - (cards.length - 1) / 2) * 2.5);
      wrap.style.setProperty('--nest-x', offsetX + 'px');
      wrap.style.setProperty('--nest-y', offsetY + 'px');
      wrap.style.setProperty('--nest-rot', rotations[i % rotations.length] + 'deg');
      wrap.style.setProperty('--nest-delay', solScaledDelay(i * 65, 0) + 'ms');
      const inner = document.createElement('div');
      inner.className = 'gh-nest-card-inner';
      const back = document.createElement('div');
      back.className = 'gh-nest-card-back';
      back.setAttribute('aria-hidden', 'true');
      const front = document.createElement('div');
      front.className = 'gh-nest-card-front';
      front.innerHTML = nestCardMarkup(card);
      inner.appendChild(back);
      inner.appendChild(front);
      wrap.appendChild(inner);
      layer.appendChild(wrap);
      setTimeout(() => { try { inner.classList.add('revealed'); } catch (_) {} }, solScaledDelay(650 + i * 65, 100));
      setTimeout(() => { try { if (typeof playCardSound === 'function') playCardSound(); } catch (_) {} }, solScaledDelay(i * 65, 0));
    });
    setTimeout(() => { try { layer.classList.add('out'); } catch (_) {} }, HOLD_MS);
    setTimeout(() => { try { layer.remove(); } catch (_) {} }, HOLD_MS + FADE_MS);
    return HOLD_MS;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

function escapeHtmlSafe(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hostEndHand() {
  try { clearTimeoutBotsAfterHand(); } catch (e) {}
  try { clearClaimOverlays(); } catch (e) {}

  const lastTeam = players[game.currentPlayer].team;
  const bidderTeam = players[game.bidder].team;
  let nestHoldMs = 0;
  let nestWinnerName = '';
  let nestPtsShown = 0;
  // Nest counters: last-trick winner (default) or always bidder team
  // Freeze a completely independent copy before moving nest cards into tricks.
  // Nothing below this point is allowed to mutate what the scoreboard will display.
  const nestSnapshot = (
    (Array.isArray(game.nestRevealCards) && game.nestRevealCards.length && game.nestRevealCards)
    || (Array.isArray(game.nestCards) && game.nestCards.length && game.nestCards)
    || []
  ).map(c => ({ ...c }));
  game.nestRevealCards = nestSnapshot.map(c => ({ ...c }));
  if (nestSnapshot.length) {
    const nestTeam = (nestGoesTo === 'bidder') ? bidderTeam : lastTeam;
    try {
      nestPtsShown = nestSnapshot.reduce((s, c) => s + cardPoints(c), 0);
      if (nestGoesTo === 'bidder' && game.bidder != null) {
        nestWinnerName = (players[game.bidder] && players[game.bidder].name) || 'Bidder';
      } else {
        const wSeat = game.currentPlayer;
        nestWinnerName = (players[wSeat] && players[wSeat].name) || 'Winner';
      }
      broadcast({
        type: 'nestCapture',
        winnerName: nestWinnerName,
        cards: nestSnapshot.map(c => ({ ...c })),
        pts: nestPtsShown,
      });
      nestHoldMs = showNestCaptureAnimation(nestWinnerName, nestSnapshot, nestPtsShown) || 0;
    } catch (e) { console.error('Nest reveal error:', e); }
    game.tricksTaken[nestTeam].push(...nestSnapshot.map(c => ({ ...c })));
    try {
      const nestSeat = (nestGoesTo === 'bidder' && game.bidder != null) ? game.bidder : game.currentPlayer;
      try {
        const nStat = ps(nestSeat);
        nStat.nestWins++;
        if(nestSnapshot.some(isRed2))nStat.red2Captures++;
        if(nestSnapshot.some(c=>c.color==='rook'||c.id==='rook'))nStat.rookCaptures++;
        nStat.nestPts += nestPtsShown;
        nStat.points += nestPtsShown; // both partners receive their captured nest points
        // Partnership scoring: nest points count for the winner and their partner.
        const nestPartnerSeat = (nestSeat + 2) % 4;
        if (players[nestPartnerSeat]) {
          const partnerNestStat = ps(nestPartnerSeat);
          partnerNestStat.points += nestPtsShown;
          partnerNestStat.nestPts += nestPtsShown;
        }
      } catch (e) {}
      try { botMaybeTableTalk('nest', { name: nestWinnerName, pts: nestPtsShown, prefer: nestSeat }); } catch (e) {}
    } catch (e) {}
  }

  let pointsA = 0, pointsB = 0;
  (game.tricksTaken[0] || []).forEach(c => { pointsA += cardPoints(c); });
  (game.tricksTaken[1] || []).forEach(c => { pointsB += cardPoints(c); });

  // Every counter in the deck must land on a team — fix drift (missing nest, bad ids, etc.)
  const expected = totalCountersInDeck();
  const got = pointsA + pointsB;
  if (got !== expected) {
    console.warn('Counter total mismatch:', got, 'expected', expected, '— adjusting last-trick team');
    const diff = expected - got;
    if (lastTeam === 0) pointsA += diff;
    else pointsB += diff;
  }

  let made = false;
  let scoreDeltaA = 0, scoreDeltaB = 0;
  // A made bid scores captured counters (or the selected bid-only amount). A set loses the bid.
  const applyMakerScore = (team, pts) => {
    const bid = game.bid;
    if (pts < bid) {
      const delta = -bid;
      if (team === 0) { scoreDeltaA = delta; game.scores[0] += delta; }
      else { scoreDeltaB = delta; game.scores[1] += delta; }
      return false;
    }
    let delta = pts;
    if (bidOnlyScoring) {
      delta = bid;
    }
    const finalDelta = delta;
    if (team === 0) { scoreDeltaA = finalDelta; game.scores[0] += finalDelta; }
    else { scoreDeltaB = finalDelta; game.scores[1] += finalDelta; }
    return true;
  };
  if (bidderTeam === 0) {
    made = applyMakerScore(0, pointsA);
    scoreDeltaB = pointsB;
    game.scores[1] += pointsB;
  } else {
    made = applyMakerScore(1, pointsB);
    scoreDeltaA = pointsA;
    game.scores[0] += pointsA;
  }

  // House rule: Shoot the Moon — bid every counter in the deck and, if made,
  // win the game outright on the spot. A miss is already the ordinary
  // (large, since the bid itself was huge) set penalty above — no separate
  // failure handling needed.
  let shotMoonResult = null;
  if (game.shotTheMoon) {
    if (made) {
      shotMoonResult = 'made';
      const target = game.targetScore || targetScore || 500;
      const bonus = Math.max(0, target - game.scores[bidderTeam]);
      if (bonus > 0) {
        game.scores[bidderTeam] += bonus;
        if (bidderTeam === 0) scoreDeltaA += bonus; else scoreDeltaB += bonus;
      }
    } else {
      shotMoonResult = 'failed';
    }
  }

  try { botMaybeTableTalk(made ? 'made' : 'set', { prefer: game.bidder }); } catch (e) {}
  try { botMaybeStandingsTaunt(); } catch (e) {}

  game.phase = 'score';
  // Clear the relocated pot as soon as the completed hand leaves play.
  if ($('holderPlayerName784')) renderTrickPot784();
  try { clearTrumpBanners(); } catch (e) {}
  try { playSfx(made ? 'made' : 'set', { broadcastNet: true }); } catch (e) {}
  try {
    if (shotMoonResult) {
      const bidderName = (players[game.bidder] && players[game.bidder].name) || ('P' + (game.bidder + 1));
      const moonMsg = shotMoonResult === 'made'
        ? `${bidderName} shot the moon and wins the game!`
        : `${bidderName} tried to shoot the moon and missed.`;
      const ma = $('messageArea');
      if (ma) ma.textContent = moonMsg;
      broadcast({ type: 'message', text: moonMsg });
    }
  } catch (e) {}

  const summary = {
    pointsA, pointsB, bid: game.bid, bidderTeam, made,
    trump: game.trump, scores: [...game.scores],
    scoreDeltaA, scoreDeltaB,
    shotTheMoon: !!game.shotTheMoon,
    shotMoonResult,

    nestWinnerName,
    nestPts: nestPtsShown,
    nestCards: nestSnapshot.map(c => ({ ...c })),
    nestWinnerName: nestWinnerName || null,
    nestPts: nestPtsShown || 0,
    claimRevealHands: Array.isArray(game.claimRevealHands) ? game.claimRevealHands.map(h => ({
      player: h.player, name: h.name, team: h.team,
      cards: (h.cards || []).map(c => ({ ...c }))
    })) : null,
    claimer: (typeof game.laidDownBy === 'number')
      ? game.laidDownBy
      : ((typeof game.trumpClaimPlayer === 'number') ? game.trumpClaimPlayer : null),
    claimerName: game.laidDownName || null,
    claimReason: (game.claimAnimation && game.claimAnimation.reason) || null,
    lastTricks: (Array.isArray(game.claimLastTricks) && game.claimLastTricks.length
      ? game.claimLastTricks
      : ((typeof recentTricks !== 'undefined' && recentTricks) ? recentTricks : [])
    ).slice(0, 3).map(tr => ({
      winner: tr.winner,
      plays: (tr.plays || []).map(t => ({ player: t.player, card: t.card ? { ...t.card } : t.card })),
      trump: tr.trump,
      ledColor: tr.ledColor,
    })),
  };
  handHistory.push(summary);
  matchStats.hands = (matchStats.hands || 0) + 1;
  matchStats.bidSum = (matchStats.bidSum || 0) + (game.bid || 0);
  matchStats.bidCount = (matchStats.bidCount || 0) + 1;
  if (game.bid > (matchStats.highBid || 0)) matchStats.highBid = game.bid;
  if (made) {
    if (bidderTeam === 0) matchStats.madeA = (matchStats.madeA || 0) + 1;
    else matchStats.madeB = (matchStats.madeB || 0) + 1;
  } else {
    if (bidderTeam === 0) matchStats.setsA = (matchStats.setsA || 0) + 1;
    else matchStats.setsB = (matchStats.setsB || 0) + 1;
  }
  try {
    for (let i = 0; i < 4; i++) { if (players[i]) ps(i).hands++; }
    try {
      for (let i = 0; i < 4; i++) {
        const hp = players[i];
        if (!hp || hp.isBot) continue;
        const mem = getPlayMemory(hp.name);
        mem.hands = (mem.hands || 0) + 1;
        if (game.bidder === i) {
          mem.wonBids = (mem.wonBids || 0) + 1;
          if (made) mem.made = (mem.made || 0) + 1;
          else mem.sets = (mem.sets || 0) + 1;
        }
        putPlayMemory(hp.name, mem);
        refreshHumanPersona(hp);
      }
    } catch (e) {}
    const bStat = ps(game.bidder);
    if (made) bStat.bidsMade++; else bStat.bidsSet++;
    if (game.shotTheMoon) {
      bStat.moonAttempts++;
      if (shotMoonResult === 'made') bStat.moonMade++;
    }
  } catch (e) {}

  summary.careerEvent={matchId:game.careerMatchId||(game.careerMatchId=crypto.randomUUID()),hand:handHistory.length,
    players:players.map(p=>({id:p.id,name:p.name,isBot:!!p.isBot,team:p.team,avatar:p.avatar||null})),
    stats:playerStats.map(s=>({...s})),extras:JSON.parse(JSON.stringify(game.careerExtras||[{},{},{},{}])),
    bidder:game.bidder,tricksPerHand:handSize,completed:!!getMatchResult(game.scores,game.targetScore||targetScore||300),
    winnerTeam:getMatchResult(game.scores,game.targetScore||targetScore||300)==='Team A'?0:getMatchResult(game.scores,game.targetScore||targetScore||300)==='Team B'?1:null,
    summary:{pointsA,pointsB,bid:game.bid,made,trump:game.trump,scores:[...game.scores]}};
  horRecordCareerHand(summary.careerEvent);
  const finishToScore = () => {
    broadcast({
      type: 'handResult', summary, history: handHistory, matchTricks: matchTricks || [],
      matchStats: { ...matchStats }, playerStats: playerStats.map(s => ({ ...s })),
    });
    broadcastState();
    showScoreModal(summary);
    const goal = game.targetScore || targetScore || 300;
    const matchResult = getMatchResult(game.scores, goal);
    if (matchResult) {
      const winner = matchResult;
      try { mergeLifetimeStats(winner); } catch (e) {}
      showWinCelebration(winner, [...game.scores]);
    }
  };

  // Nest overlay holds 3s, then fade into the score page
  if (nestHoldMs > 0) {
    setTimeout(finishToScore, nestHoldMs);
  } else {
    finishToScore();
  }
}

function isLaidDownWinnerSeat(h, summary) {
  if (!h) return false;
  if (h.laidDown) return true;
  if (summary && typeof summary.claimer === 'number') return Number(h.player) === Number(summary.claimer);
  return false;
}
function remainingHandCardHTML(card) {
  if (!card) return '';
  // Use the same full face markup as in-play cards (not the "small" face).
  // Landscape remaining-card clipping was caused by .small + 2.35rem ranks
  // inside a 32px box. Full faces + CSS variables keep the art intact.
  let cls = (card.color === 'rook' || card.id === 'rook') ? 'rook' : (card.color || '');
  if (typeof isRed2 === 'function' && isRed2(card) && includeRed2) cls = 'red2 red2-art';
  else if (typeof isRed2 === 'function' && isRed2(card)) cls = 'red';
  if (typeof isRed1 === 'function' && isRed1(card)) cls = 'red1';
  const inner = (typeof cardInnerHTML === 'function') ? cardInnerHTML(card) : '';
  const id = (typeof escapeHtmlSafe === 'function') ? escapeHtmlSafe(card.id || '') : (card.id || '');
  return `<div class="card-face claim-remaining-card ${cls}" data-id="${id}">${inner}</div>`;
}

function showClaimRemainingHands(summary) {
  const modal = $('scoreModal');
  const body = $('scoreModalBody');
  const hands = Array.isArray(summary && summary.claimRevealHands) ? summary.claimRevealHands : [];
  if (!modal || !body || !hands.length) return;
  modal.classList.add('showing-remaining');
  try { document.body.classList.add('remaining-open'); } catch (e) {}
  const section = document.createElement('section');
  section.id = 'claimRemainingHands';
  section.className = 'claim-remaining-hands';
  const cardsHtml = hands.map((h) => {
    const laid = isLaidDownWinnerSeat(h, summary);
    const cls = 'claim-remaining-player' + (laid ? ' is-laid-winner' : '');
    const tag = laid ? '<em class="winner-tag">Laid down</em>' : '';
    const teamName = (typeof teamLabel === 'function')
      ? teamLabel(h.team)
      : (h.team === 0 ? 'Griffin' : 'Raven');
    const cards = (h.cards || []).length
      ? h.cards.map(c => remainingHandCardHTML(c)).join('')
      : '<span class="claim-remaining-none">No cards left</span>';
    const nCards = (h.cards || []).length;
    return '<div class="' + cls + '" data-team="' + (h.team === 0 ? 'griffin' : 'raven') + '">'
      + '<div class="claim-remaining-player-title"><span class="cr-name"><b>'
      + escapeHtmlSafe(h.name) + '</b>' + tag + '</span><span class="cr-team">' + teamName + '</span></div>'
      + '<div class="claim-remaining-cards" data-count="' + nCards + '">' + cards + '</div></div>';
  }).join('');
  const claimerHand = hands.find(h => h.laidDown)
    || hands.find(h => typeof summary.claimer === 'number' && Number(h.player) === Number(summary.claimer));
  const claimerName = summary.claimerName
    || (claimerHand && claimerHand.name)
    || (players[summary.claimer] && players[summary.claimer].name)
    || (typeof summary.claimer === 'number' ? ('Player ' + (summary.claimer + 1)) : '');
  const trumpName = (typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES[summary.trump])
    ? COLOR_NAMES[summary.trump]
    : (summary.trump || '—');
  const whoLine = claimerName
    ? ('<b>' + escapeHtmlSafe(claimerName) + '</b> laid down · Trump <b>' + escapeHtmlSafe(String(trumpName)) + '</b>')
    : ('Trump <b>' + escapeHtmlSafe(String(trumpName)) + '</b>');
  section.innerHTML = '<div class="claim-remaining-meta">' + whoLine + '</div>'
    + '<div class="claim-remaining-grid">' + cardsHtml + '</div>';
  body.innerHTML = '';
  body.appendChild(section);
  try { body.scrollTop = 0; } catch (e) {}
  try { wireScoreModalActions(summary); } catch (e) {}
  try { fitClaimRemainingCards(); } catch (e) {}
  requestAnimationFrame(() => { try { fitClaimRemainingCards(); } catch (e) {} });
  setTimeout(() => { try { fitClaimRemainingCards(); } catch (e) {} }, 60);
}

/** Pack leftover cards into a grid that fills the player panel without clipping. */
function fitClaimRemainingCards() {
  const boxes = document.querySelectorAll('#scoreModal.showing-remaining .claim-remaining-cards');
  if (!boxes.length) return;
  const ratio = 58 / 84;
  const modal = document.querySelector('#scoreModal.showing-remaining .modal-content');
  const modalH = (modal && modal.clientHeight) || window.innerHeight;
  boxes.forEach((box) => {
    const cards = box.querySelectorAll('.claim-remaining-card');
    const n = cards.length;
    if (!n) return;
    let w = box.clientWidth;
    let h = box.clientHeight;
    // Portrait Laid Down: fit fractional grid content dimensions, excluding padding.
    // Keep the frozen landscape fitter unchanged.
    const portraitLaydown = window.matchMedia('(orientation: portrait)').matches;
    if (portraitLaydown) {
      const cs = getComputedStyle(box);
      w = parseFloat(cs.width) || w;
      h = parseFloat(cs.height) || h;
      if (cs.boxSizing === 'border-box') {
        w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
          + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
        h -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
          + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      }
    }
    if (w < 20) w = Math.max(80, Math.floor(((modal && modal.clientWidth) || window.innerWidth) * 0.42));
    if (h < 40) h = Math.max(90, Math.floor(modalH * 0.28) - 40);
    const gap = n >= 10 ? 2 : (n >= 7 ? 3 : 4);
    let best = { cols: Math.min(3, n), rows: Math.ceil(n / Math.min(3, n)), area: -1, cw: 20, ch: 29 };
    const maxCols = Math.min(n, 7);
    for (let cols = 1; cols <= maxCols; cols++) {
      if (portraitLaydown && n === 4 && cols !== 2) continue;
      const rows = Math.ceil(n / cols);
      const cellW = (w - gap * (cols - 1)) / cols;
      const cellH = (h - gap * (rows - 1)) / rows;
      if (cellW < 12 || cellH < 16) continue;
      let ch = Math.min(cellH, cellW / ratio);
      let cw = ch * ratio;
      if (cw > cellW) { cw = cellW; ch = cw / ratio; }
      const area = cw * ch;
      if (area > best.area) best = { cols, rows, area, cw, ch };
    }
    box.style.setProperty('--remain-gap', gap + 'px');
    box.style.setProperty('--remain-cols', String(best.cols));
    box.style.setProperty('--remain-rows', String(best.rows));
    box.style.setProperty('--remain-card-w', best.cw.toFixed(2) + 'px');
    box.style.setProperty('--remain-card-h', best.ch.toFixed(2) + 'px');
  });
}

if (typeof window !== 'undefined' && !window._horRemainFitBound) {
  window._horRemainFitBound = true;
  const rerun = () => { try { fitClaimRemainingCards(); } catch (e) {} };
  window.addEventListener('resize', rerun);
  window.addEventListener('orientationchange', () => setTimeout(rerun, 80));
}

function statMadePct(s) {
  const total = (s.bidsMade || 0) + (s.bidsSet || 0);
  return total ? Math.round((s.bidsMade / total) * 100) : 0;
}
function statAvgBid(s) { return s.bidsWon ? Math.round(s.bidSum / s.bidsWon) : 0; }
function statTeamClass(team) { return team === 0 ? 'team-a' : 'team-b'; }
function statTeamName(team) {
  return (typeof teamLabel === 'function') ? teamLabel(team) : (team === 0 ? 'Griffin' : 'Raven');
}
function esc(t) { return (typeof escapeHtmlSafe === 'function') ? escapeHtmlSafe(String(t == null ? '' : t)) : String(t == null ? '' : t); }

function renderStatChips(s) {
  const chips = [];
  if (s.rookCaptures) chips.push(`<span class="stat-chip chip-rook" title="Rook captures">ROOK ${s.rookCaptures}</span>`);
  if (s.red2Captures) chips.push(`<span class="stat-chip chip-red2" title="Red 2 captures">🔴 ${s.red2Captures}</span>`);
  if (s.bigTricks) chips.push(`<span class="stat-chip chip-big" title="30+ point tricks">💥 ${s.bigTricks}</span>`);
  if (s.nestWins) chips.push(`<span class="stat-chip chip-nest" title="Nest captures">🪺 ${s.nestWins}</span>`);
  if (s.moonAttempts) chips.push(`<span class="stat-chip chip-moon" title="Shoot the Moon attempts / made">🌙 ${s.moonMade || 0}/${s.moonAttempts}</span>`);
  if (s.bags) chips.push(`<span class="stat-chip chip-bag" title="Historical bag record">👝 ${s.bags}</span>`);
  return chips.length ? `<div class="stat-chips">${chips.join('')}</div>` : '';
}

function renderPlayerStatCard(i, topScorerIdx) {
  const p = players[i];
  if (!p) return '';
  const s = ps(i);
  const pct = statMadePct(s);
  const avgBid = statAvgBid(s);
  const isLeader = (i === topScorerIdx && (s.points || 0) > 0);
  const roleTag = p.isBot
    ? `Bot · ${(typeof STYLE_TITLES !== 'undefined' && STYLE_TITLES[p.botStyle]) || 'Bot'}`
    : (p.id === myPeerId ? 'You' : 'Player');
  const avatarHtml = (typeof avatarHTML === 'function') ? avatarHTML(p.avatar || 'rookling') : '';
  return `
    <div class="stat-player-card ${statTeamClass(p.team)}${isLeader ? ' is-leader' : ''}">
      ${isLeader ? '<div class="stat-crown" title="Top points this match">👑</div>' : ''}
      <div class="stat-card-head">
        <div class="stat-avatar">${avatarHtml}</div>
        <div class="stat-name-block">
          <div class="stat-player-name">${esc(p.name || 'Player')}</div>
          <div class="stat-role-tag">${esc(roleTag)} <span class="stat-team-pill">${esc(statTeamName(p.team))}</span></div>
        </div>
      </div>
      <div class="stat-metric-row">
        <div class="stat-metric"><span class="stat-metric-num">${s.points || 0}</span><span class="stat-metric-label">Points</span></div>
        <div class="stat-metric"><span class="stat-metric-num">${s.tricksWon || 0}</span><span class="stat-metric-label">Tricks</span></div>
        <div class="stat-metric"><span class="stat-metric-num">${s.hands || 0}</span><span class="stat-metric-label">Hands</span></div>
      </div>
      <div class="stat-bid-line">
        <div class="stat-bidbar-label">Bid record <b>${s.bidsMade || 0}-${s.bidsSet || 0}</b>${s.bidsWon ? ` (${pct}%)` : ''}${s.highBid ? ` · High ${s.highBid}` : ''}${avgBid ? ` · Avg ${avgBid}` : ''}</div>
        <div class="stat-bidbar"><div class="stat-bidbar-fill" style="width:${pct}%"></div></div>
      </div>
      ${renderStatChips(s)}
    </div>`;
}

// v378: remove the old simulated 25-match record-book seed.
// This migration only removes the known synthetic bot records; real records
// created under other player names are preserved.
const LEGACY_SIMULATED_BOT_NAMES = [
  'Blaze','Fang','Wager','Moss','Quill','Halo','Gable','Titan','Crow','Drift',
  'Hollow','Vex','Marrow','Pike','Thistle','Frost','Bramble','Ember','Emberlyn',
  'Pebble','Dice','Nix','Anchor','Cinder'
];
function purgeLegacySimulatedBotStats() {
  // Names cannot prove that a record is synthetic. Preserve every saved bot career.
  return {preserved:true};
}

function renderAllTimeLeaders() {
  const store = loadLifetimeStats();
  const names = Object.keys(store);
  if (!names.length) return '<div class="stats-empty">No all-time stats yet — finish a full game to start the record book.</div>';
  const rows = names.map(n => ({ name: n, ...store[n] })).sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 8);
  const medals = ['🥇', '🥈', '🥉'];
  return `<div class="alltime-list">` + rows.map((r, idx) => `
    <div class="alltime-row">
      <span class="alltime-rank">${medals[idx] || ('#' + (idx + 1))}</span>
      <span class="alltime-name">${esc(r.name)}${r.isBot ? ' <em class="alltime-bot-tag">bot</em>' : ''}</span>
      <span class="alltime-pts">${r.points || 0} pts</span>
      <span class="alltime-games">${r.gamesWon || 0}/${r.gamesPlayed || 0} games</span>
    </div>`).join('') + '</div>';
}

function wireStatsAllTimeToggle() {
  const btn = $('statsAllTimeBtn');
  const box = $('statsAllTimeBody');
  if (!btn || !box) return;
  btn.onclick = () => {
    const showing = !box.classList.contains('hidden');
    if (showing) { box.classList.add('hidden'); btn.textContent = '🏆 All-time leaders'; return; }
    box.innerHTML = renderAllTimeLeaders();
    box.classList.remove('hidden');
    btn.textContent = 'Hide all-time leaders';
  };
}

function showStatsModal() {
  const modal = $('statsModal');
  const body = $('statsBody');
  if (!modal || !body) return;
  const avg = matchStats.bidCount ? Math.round(matchStats.bidSum / matchStats.bidCount) : 0;
  const seats = [0, 1, 2, 3].filter(i => players[i]);
  let topScorerIdx = -1, topPts = -1;
  seats.forEach((i) => {
    const pts = ps(i).points || 0;
    if (pts > topPts) { topPts = pts; topScorerIdx = i; }
  });
  // Player points are partnership-attributed, so each teammate carries the
  // same team total. Average the two seats here to keep the team comparison
  // from displaying a doubled total.
  const teamAPointsSeats = seats.filter(i => players[i].team === 0);
  const teamBPointsSeats = seats.filter(i => players[i].team === 1);
  const teamAPts = teamAPointsSeats.length
    ? teamAPointsSeats.reduce((sum, i) => sum + (ps(i).points || 0), 0) / teamAPointsSeats.length
    : 0;
  const teamBPts = teamBPointsSeats.length
    ? teamBPointsSeats.reduce((sum, i) => sum + (ps(i).points || 0), 0) / teamBPointsSeats.length
    : 0;
  const maxTeamPts = Math.max(teamAPts, teamBPts, 1);
  const teamAName = statTeamName(0), teamBName = statTeamName(1);
  const scores = (game && Array.isArray(game.scores)) ? game.scores : [0, 0];
  const cardsHtml = seats.map(i => renderPlayerStatCard(i, topScorerIdx)).join('');

  body.innerHTML = `
    <div class="stats-fancy">
      <div class="stats-hero">
        <div class="stats-hero-title">Table Stats</div>
        <div class="stats-hero-sub">${matchStats.hands || 0} hand${matchStats.hands === 1 ? '' : 's'} played · avg bid ${avg} · high bid ${matchStats.highBid || 0}</div>
      </div>
      <div class="team-compare">
        <div class="team-compare-row">
          <span class="team-compare-name team-a-text">${esc(teamAName)}</span>
          <span class="team-compare-score">${scores[0] || 0}</span>
        </div>
        <div class="team-compare-bar"><div class="team-compare-fill fill-a" style="width:${Math.round((teamAPts / maxTeamPts) * 100)}%"></div></div>
        <div class="team-compare-row">
          <span class="team-compare-name team-b-text">${esc(teamBName)}</span>
          <span class="team-compare-score">${scores[1] || 0}</span>
        </div>
        <div class="team-compare-bar"><div class="team-compare-fill fill-b" style="width:${Math.round((teamBPts / maxTeamPts) * 100)}%"></div></div>
        <div class="team-compare-meta">Made/Set — ${esc(teamAName)} ${matchStats.madeA || 0}/${matchStats.setsA || 0} &nbsp;·&nbsp; ${esc(teamBName)} ${matchStats.madeB || 0}/${matchStats.setsB || 0}</div>
      </div>
      <div class="stat-player-grid">${cardsHtml}</div>
      <div class="stats-alltime-toggle"><button id="statsAllTimeBtn" class="btn" type="button">🏆 All-time leaders</button></div>
      <div id="statsAllTimeBody" class="stats-alltime hidden"></div>
    </div>
  `;
  modal.classList.remove('hidden');
  try { wireStatsAllTimeToggle(); } catch (e) {}
}

function wireScoreModalActions(summary) {
  const modal = $('scoreModal');
  if (!modal || !summary) return;
  const goal = game?.targetScore || targetScore || 300;
  const gameOver = isMatchOver(summary.scores, goal);
  const revealBtn = $('scoreModalRevealHands');
  const last3Btn = $('scoreModalLast3');
  const histBtn = $('scoreModalHistory');
  const nextBtn = $('scoreModalNext');

  if (revealBtn) {
    const hasReveal = Array.isArray(summary.claimRevealHands) && summary.claimRevealHands.some(h => Array.isArray(h.cards));
    revealBtn.classList.toggle('hidden', !hasReveal);
    const actions = modal.querySelector('.score-modal-actions');
    if (actions) actions.classList.toggle('has-reveal', hasReveal);
    const showing = modal.classList.contains('showing-remaining');
    revealBtn.textContent = showing ? 'Scoreboard' : 'Show remaining';
    revealBtn.onclick = () => {
      if (modal.classList.contains('showing-remaining')) {
        modal.classList.remove('showing-remaining');
        window._ltShowRemaining = false;
        try { document.body.classList.remove('remaining-open'); } catch (e) {}
        showScoreModal(summary);
        return;
      }
      modal.classList.add('showing-remaining');
      window._ltShowRemaining = true;
      showClaimRemainingHands(summary);
      const title = $('scoreModalTitle');
      if (title) title.textContent = 'Remaining Cards';
      revealBtn.textContent = 'Scoreboard';
      if (last3Btn) last3Btn.classList.remove('hidden');
      if (histBtn) histBtn.classList.remove('hidden');
      if (nextBtn) {
        nextBtn.classList.remove('hidden');
        nextBtn.textContent = gameOver ? 'OK' : (isHost ? 'Next Hand' : 'OK');
      }
      try { updateLandscapeTheater(); } catch (e) {}
  try { window.HORCharacterStudio077?.sync(); } catch (e) { console.warn('Character presentation:', e); }
    };
  }

  if (last3Btn) {
    const showing = modal.classList.contains('showing-remaining');
    const hasTricks = Array.isArray(summary.lastTricks) && summary.lastTricks.length;
    last3Btn.classList.toggle('hidden', !showing);
    last3Btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window._scoreLastTricks = Array.isArray(summary.lastTricks) ? summary.lastTricks : [];
      try { openPortraitLast3(); } catch (err) { console.error(err); }
    };
  }

  if (histBtn) {
    histBtn.classList.remove('hidden');
    histBtn.onclick = () => {
      modal.classList.add('hidden');
      openHandHistory({ fromScoreboard: true });
    };
  }

  if (nextBtn) {
    nextBtn.classList.remove('hidden');
    nextBtn.textContent = gameOver ? 'OK' : (isHost ? 'Next Hand' : 'OK');
    nextBtn.onclick = () => {
      modal.classList.add('hidden');
      modal.classList.remove('showing-remaining');
      window._ltShowRemaining = false;
      if (isHost && !gameOver) {
        hostStartNextHand();
      }
    };
  }
}

function showScoreModal(summary) {
  try { document.body.classList.remove('remaining-open'); } catch (e) {}
  landscapeLastSummary = summary ? { ...summary, scores: Array.isArray(summary.scores) ? [...summary.scores] : summary.scores } : null;
  const modal = $('scoreModal');
  const body = $('scoreModalBody');
  if (!modal || !body || !summary) return;
  try {
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    modal.classList.add('score-modal-top');
  } catch (e) {}
  modal.classList.remove('showing-remaining');
  const goal = game?.targetScore || targetScore || 300;
  const teamName = summary.bidderTeam === 0 ? 'A' : 'B';
  const da = summary.scoreDeltaA ?? 0;
  const db = summary.scoreDeltaB ?? 0;
  const title = $('scoreModalTitle');
  if (title) title.textContent = 'Scoreboard';

  // The approved scoreboard is a real renderer, not a CSS skin over the legacy DOM.
  // Scoring data and all action wiring remain unchanged.
  const nest = Array.isArray(summary.nestCards) && summary.nestCards.length
    ? summary.nestCards.map(c => ({ ...c }))
    : ((game && Array.isArray(game.nestRevealCards) && game.nestRevealCards.length)
        ? game.nestRevealCards.map(c => ({ ...c }))
        : ((game && Array.isArray(game.nestCards) && game.nestCards.length)
            ? game.nestCards.map(c => ({ ...c })) : []));
  const nestWinner = summary.nestWinnerName || 'Winner';
  const nestPts = Number(summary.nestPts || 0);
  const trumpName = COLOR_NAMES[summary.trump] || summary.trump || '—';
  const trumpClass = String(summary.trump || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const totalTaken = Number(summary.pointsA || 0) + Number(summary.pointsB || 0);
  const deckTotal = typeof totalCountersInDeck === 'function' ? totalCountersInDeck() : '—';
  const griffinIcon = 'assets/images/griffin-icon.png?v=635';
  const ravenIcon = 'assets/images/avatar-raven-approved.jpg';
  const labelA = (typeof teamLabel === 'function') ? teamLabel(0) : 'Griffin';
  const labelB = (typeof teamLabel === 'function') ? teamLabel(1) : 'Raven';
  const bidderLabel = summary.bidderTeam === 0 ? labelA : labelB;
  const took = summary.bidderTeam === 0 ? Number(summary.pointsA || 0) : Number(summary.pointsB || 0);
  const bidderDelta = summary.bidderTeam === 0 ? da : db;
  const resultLine = `${bidderLabel} bid ${formatBidAmount(summary.bid)}, took ${took} → ${bidderDelta >= 0 ? '+' : ''}${bidderDelta}. Nest ${nestPts} to ${nestWinner}. Running total: ${labelA} ${summary.scores[0]} · ${labelB} ${summary.scores[1]} (to ${goal}).`;

  const nestMarkup = `
    <details class="ghsb-nest" aria-label="Nest cards">
      <summary class="ghsb-nest-title">Nest: ${escapeHtmlSafe(nestWinner)} · ${nestPts} points</summary>
      <div class="ghsb-nest-cards">
        ${nest.length ? nest.map(c => {
          const html = typeof nestCardMarkup === 'function' ? nestCardMarkup(c) : '';
          return `<div class="ghsb-nest-card">${html}</div>`;
        }).join('') : '<div class="ghsb-nest-empty">No nest cards recorded</div>'}
      </div>
    </details>`;

  body.innerHTML = `
    <div class="scoreboard gh-approved-scoreboard ${summary.made ? 'made-hand' : 'set-hand'}">
      <div class="score-banner ghsb-contract ${summary.made ? 'banner-made' : 'banner-set'}">
        <span>${escapeHtmlSafe(bidderLabel)} ${summary.made ? 'made the bid' : 'was set'}</span>
      </div>



      <div class="ghsb-matchup">
        <div class="scoreboard-team ghsb-team ghsb-team-a ${summary.scores[0] >= summary.scores[1] ? 'leading' : ''}">
          <img class="ghsb-team-icon ghsb-griffin" src="${griffinIcon}" alt="" draggable="false">
          <div class="ghsb-team-copy">
            <div class="sb-label">${labelA}</div>
            <div class="sb-total">${summary.scores[0]}</div>
            <div class="sb-delta">${da >= 0 ? '+' : ''}${da} this hand</div>
          </div>
        </div>
        <div class="scoreboard-vs ghsb-vs"><span>VS</span></div>
        <div class="scoreboard-team ghsb-team ghsb-team-b ${summary.scores[1] >= summary.scores[0] ? 'leading' : ''}">
          <div class="ghsb-team-copy">
            <div class="sb-label">${labelB}</div>
            <div class="sb-total">${summary.scores[1]}</div>
            <div class="sb-delta">${db >= 0 ? '+' : ''}${db} this hand</div>
          </div>
          <img class="ghsb-team-icon ghsb-raven" src="${ravenIcon}" alt="" draggable="false">
        </div>
      </div>

      <div class="scoreboard-goal ghsb-goal"><span>First to <b>${goal}</b></span></div>
      <div class="ghsb-summary">Bid ${formatBidAmount(summary.bid)} · <span class="ghsb-trump ghsb-trump-${trumpClass}">${trumpName}</span> trump · Hand ${handHistory.length || 1}</div>
      ${nestMarkup}
      <details class="ghsb-hand-details"><summary>Hand details</summary><div class="scoreboard-detail ghsb-details">
        <div><b>Bid:</b> ${formatBidAmount(summary.bid)} by ${escapeHtmlSafe(bidderLabel)} <span class="ghsb-made-chip ${summary.made ? 'is-made' : 'is-set'}">${summary.made ? '✓ Made' : '× Set'}</span></div>
        <div><b>Trump:</b> <span class="ghsb-trump ghsb-trump-${trumpClass}">${trumpName}</span></div>
        <div><b>Counters taken:</b> ${escapeHtmlSafe(labelA)} ${summary.pointsA} · ${escapeHtmlSafe(labelB)} ${summary.pointsB} · total ${totalTaken} / ${deckTotal}</div>
        <div><b>Hands played:</b> ${handHistory.length || 1}</div>
        <div class="ghsb-result-line">${escapeHtmlSafe(resultLine)}</div>
        <button type="button" id="scoreDetailsRemaining805" class="btn">Show remaining cards</button>
      </div></details>
    </div>`;

  modal.classList.remove('hidden');
  wireScoreModalActions(summary);
  const remaining=$('scoreDetailsRemaining805'),original=$('scoreModalRevealHands');
  if(remaining){remaining.hidden=!original||original.classList.contains('hidden');remaining.onclick=()=>original?.click();}
  $('scoreModalHistory').textContent='History';$('scoreModalCopy').textContent='Copy scores';
}



function showWinCelebration(winner, scores) {
  const ov = $('winOverlay');
  if (!ov) return;
  liftOverlayToBody(ov, 'overlay-top');
  liftOverlayToBody($('celePage'), 'overlay-top');
  pendingCele = { winner, scores: Array.isArray(scores) ? [...scores] : [0, 0] };
  $('winTitle').textContent = winner === 'Tie' ? "It's a Tie!" : `${winner} Wins!`;
  $('winSub').textContent = `Final: A ${scores[0]} – B ${scores[1]}`;
  ov.classList.remove('hidden');
  // simple confetti dots
  const conf = $('confetti');
  if (conf) {
    conf.innerHTML = '';
    for (let i = 0; i < 40; i++) {
      const d = document.createElement('span');
      d.className = 'confetti-piece';
      d.style.left = Math.random() * 100 + '%';
      d.style.animationDelay = Math.random() * 1.5 + 's';
      d.style.background = ['#c9a227', '#e53935', '#43a047', '#1e88e5', '#fdd835'][i % 5];
      conf.appendChild(d);
    }
  }
  if (isHost) {
    try {
      broadcast({
        type: 'matchHighlights',
        winner,
        scores: pendingCele.scores,
        matchTricks: matchTricks || [],
        highlights: pickHighlightTricks(winner),
      });
    } catch (e) {}
  }
  clearCeleTimers();
  const auto = setTimeout(() => {
    try { startMatchCelebration(); } catch (e) { console.error(e); }
  }, reduceMotion ? 900 : 2800);
  celeTimers.push(auto);
}

function tourCardOpen() {
  if (window.horTourBlocking || window.horPinTip) return true;
  const ov = $('tutorialOverlay');
  return !!(ov && !ov.classList.contains('hidden'));
}
function afterTourCard(fn) {
  if (typeof fn !== 'function') return;
  if (!tourCardOpen()) { fn(); return; }
  window.horAfterTour = window.horAfterTour || [];
  window.horAfterTour.push(fn);
}
window.tourCardOpen = tourCardOpen;
window.afterTourCard = afterTourCard;
window.flushAfterTour = function () {
  const q = (window.horAfterTour || []).slice();
  window.horAfterTour = [];
  q.forEach((fn) => { try { fn(); } catch (e) {} });
};

function hostStartNextHand() {
  if (tourCardOpen()) {
    afterTourCard(() => hostStartNextHand());
    return;
  }
  const modal = $('scoreModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('showing-remaining');
  }
  window._ltShowRemaining = false;
  landscapeLastSummary = null;
  // Rook593: SOL/BOT control ownership changes only here, between hands.
  try { horApplySolBotAtHandBoundary(); } catch (e) { console.error('[SOL bot boundary]', e); }
  try { clearTableForShuffle(); } catch (e) {}
  if (game) game.dealer = rotateDealerRight(game.dealer);
  hostDeal();
}

function recordMatchTrick(entry) {
  if (!entry || !Array.isArray(entry.plays)) return;
  const copy = {
    plays: entry.plays.map(t => ({ player: t.player, card: t.card ? { ...t.card } : t.card })),
    winner: entry.winner,
    winnerName: entry.winnerName || playerNameAt(entry.winner),
    ledColor: entry.ledColor || null,
    trump: entry.trump || null,
    points: Number(entry.points != null ? entry.points : (entry.plays || []).reduce((s, t) => s + cardPoints(t.card), 0)) || 0,
    team: (entry.team != null) ? entry.team : teamOfSeat(entry.winner),
    hand: entry.hand || ((handHistory && handHistory.length) ? handHistory.length + 1 : 1),
    trickNum: (matchTricks || []).filter(t => t.hand === (entry.hand || 1)).length + 1,
  };
  matchTricks = (matchTricks || []).concat([copy]);
}

function playerNameAt(idx) {
  const plist = (game && game.players) || players || [];
  if (plist[idx] && plist[idx].name) return plist[idx].name;
  if (typeof myIndex === 'number' && idx === myIndex && myName) return myName;
  return 'Player ' + ((idx | 0) + 1);
}

function teamOfSeat(idx) {
  const plist = (game && game.players) || players || [];
  if (plist[idx] && typeof plist[idx].team === 'number') return plist[idx].team;
  return (idx | 0) % 2;
}

function winningTeamIndex(winnerLabel) {
  if (winnerLabel === 'Team B') return 1;
  if (winnerLabel === 'Team A') return 0;
  return null;
}

function pickHighlightTricks(winnerLabel) {
  const team = winningTeamIndex(winnerLabel);
  let pool = (matchTricks || []).slice();
  if (team === 0 || team === 1) {
    const fromWinners = pool.filter(t => t.team === team);
    if (fromWinners.length) pool = fromWinners;
  }
  pool.sort((a, b) => {
    const pd = (b.points || 0) - (a.points || 0);
    if (pd) return pd;
    const aw = (a.plays || []).find(p => p.player === a.winner);
    const bw = (b.plays || []).find(p => p.player === b.winner);
    return cardPoints(bw && bw.card) - cardPoints(aw && aw.card);
  });
  // The finale deliberately plays the second-biggest trick first and the
  // biggest trick last so the strongest moment is the closing reveal.
  return pool.slice(0, 2).reverse();
}

function clearCeleTimers() {
  (celeTimers || []).forEach(id => { try { clearTimeout(id); } catch (e) {} });
  celeTimers = [];
}

function hideCelePage() {
  clearCeleTimers();
  const page = $('celePage');
  if (page) {
    page.classList.add('hidden');
    page.setAttribute('aria-hidden', 'true');
  }
  const acts = $('celeActions');
  if (acts) acts.classList.add('hidden');
  const stage = $('celeStage');
  if (stage) stage.innerHTML = '';
}

function startMatchCelebration() {
  clearCeleTimers();
  const ov = $('winOverlay');
  if (ov) ov.classList.add('hidden');
  const score = $('scoreModal');
  if (score) score.classList.add('hidden');
  const ltEnd = $('ltEndGame');
  if (ltEnd) ltEnd.classList.add('hidden');
  liftOverlayToBody($('celePage'), 'overlay-top');
  liftOverlayToBody($('winOverlay'), 'overlay-top');

  const data = pendingCele || {};
  const winner = data.winner || 'Tie';
  const scores = data.scores || ((game && game.scores) ? game.scores : [0, 0]);
  const highlights = (data.highlights && data.highlights.length)
    ? data.highlights
    : pickHighlightTricks(winner);

  const page = $('celePage');
  if (!page) return;
  const title = $('celeTitle');
  const sub = $('celeSub');
  if (title) title.textContent = winner === 'Tie' ? "It's a Tie!" : `${winner} Wins!`;
  if (sub) {
    const scoreTxt = `Final A ${scores[0]} – B ${scores[1]}`;
    sub.textContent = highlights.length
      ? `${scoreTxt} · ${highlights.length === 1 ? 'Biggest trick' : 'Two biggest tricks'} from the winning side`
      : scoreTxt;
  }
  page.classList.remove('hidden');
  page.setAttribute('aria-hidden', 'false');

  const conf = $('celeConfetti');
  if (conf) {
    conf.innerHTML = '';
    const colors = ['#c9a227', '#e53935', '#43a047', '#1e88e5', '#fdd835', '#ce93d8', '#fff'];
    for (let i = 0; i < 48; i++) {
      const d = document.createElement('span');
      d.style.left = Math.random() * 100 + '%';
      d.style.animationDelay = (Math.random() * 1.8) + 's';
      d.style.background = colors[i % colors.length];
      d.style.width = (6 + Math.random() * 6) + 'px';
      d.style.height = (10 + Math.random() * 8) + 'px';
      conf.appendChild(d);
    }
  }

  try { playSfx('made', { broadcastNet: false }); } catch (e) {}
  playHighlightReel(highlights);
}

function playHighlightReel(highlights) {
  const stage = $('celeStage');
  const actions = $('celeActions');
  if (actions) actions.classList.add('hidden');
  if (!stage) {
    revealCeleActions();
    return;
  }
  if (!highlights || !highlights.length) {
    stage.innerHTML = '<div class="cele-trick cele-empty">No highlight tricks recorded this match.</div>';
    revealCeleActions();
    return;
  }
  const instant = !!reduceMotion;
  let i = 0;
  const showNext = () => {
    if (i >= highlights.length) {
      revealCeleActions();
      return;
    }
    const trick = highlights[i];
    const isHighest = (i === highlights.length - 1);
    const label = highlights.length === 1
      ? 'Biggest trick'
      : (isHighest ? 'Biggest trick' : 'Second biggest');
    renderCeleTrick(stage, trick, label, i, instant, isHighest);
    try { playSfx('trick', { broadcastNet: false }); } catch (e) {}
    const plays = (trick.plays || []).length || 4;
    const hold = instant ? 50 : (720 + plays * 420 + 1600);
    i += 1;
    const t = setTimeout(() => {
      const card = stage.querySelector('.cele-trick');
      if (card && !instant && i < highlights.length) card.classList.add('out');
      const t2 = setTimeout(showNext, instant || i >= highlights.length ? 0 : 280);
      celeTimers.push(t2);
    }, hold);
    celeTimers.push(t);
  };
  showNext();
}

function renderCeleTrick(stage, trick, label, idx, instant, isHighest) {
  const plays = Array.isArray(trick.plays) ? trick.plays : [];
  const taker = trick.winnerName || playerNameAt(trick.winner);
  const pts = trick.points || plays.reduce((s, t) => s + cardPoints(t.card), 0);
  const trump = trick.trump ? (COLOR_NAMES[trick.trump] || trick.trump) : '—';
  const led = trick.ledColor ? (COLOR_NAMES[trick.ledColor] || trick.ledColor) : '—';
  const handTxt = trick.hand ? `Hand ${trick.hand}` : '';
  stage.innerHTML = `
    <article class="cele-trick${isHighest ? ' highest-trick' : ''}" data-idx="${idx}">
      <div class="cele-trick-head">
        <div class="cele-trick-label">${label} · ${pts} pts</div>
        <div class="cele-trick-taker">Taken by <em>${taker}</em></div>
        <div class="cele-trick-meta">${handTxt}${handTxt ? ' · ' : ''}Trump ${trump} · Led ${led}</div>
      </div>
      <div class="cele-plays">
        ${plays.map((t, pi) => {
          const isW = t.player === trick.winner;
          const name = playerNameAt(t.player);
          const html = (typeof renderCardHTML === 'function') ? renderCardHTML(t.card, true) : '';
          return `<div class="cele-play${isW ? ' winner' : ''}" data-pi="${pi}" data-winner="${isW ? '1' : '0'}">
            ${isW ? '<div class="cele-crown">👑</div>' : '<div class="cele-crown" style="visibility:hidden">👑</div>'}
            ${html}
            <div class="cele-play-name">${name}</div>
          </div>`;
        }).join('')}
      </div>
    </article>`;
  const nodes = stage.querySelectorAll('.cele-play');
  nodes.forEach((el, pi) => {
    if (instant) {
      el.classList.add('in');
      return;
    }
    const t = setTimeout(() => el.classList.add('in'), 180 + pi * 420);
    celeTimers.push(t);
  });
}

function revealCeleActions() {
  const actions = $('celeActions');
  if (actions) actions.classList.remove('hidden');
}

function hostStartRematch() {
  if (!isHost) return;
  if (tourCardOpen()) {
    afterTourCard(() => hostStartRematch());
    return;
  }
  try { hideCelePage(); } catch (e) {}
  try { broadcast({ type: 'matchRematch' }); } catch (e) {}
  const ov = $('winOverlay');
  if (ov) ov.classList.add('hidden');
  const score = $('scoreModal');
  if (score) score.classList.add('hidden');
  if (isSoloPractice) {
    try { restartSoloPractice(); return; } catch (e) {}
  }
  hostStartGame();
}

function requestRematch() {
  try { hideCelePage(); } catch (e) {}
  if (isHost) {
    hostStartRematch();
    return;
  }
  if (hostConnection && hostConnection.open) {
    hostConnection.send({ type: 'requestRematch' });
    const note = $('messageArea');
    if (note) note.textContent = 'Rematch requested…';
  }
}

function hostReturnToWaiting() {
  if (!isHost) return;
  try { broadcast({ type: 'returnWaiting' }); } catch (e) {}
  applyReturnToWaiting();
}

function requestWaitingRoom() {
  if (isHost || isSoloPractice) {
    hostReturnToWaiting();
    return;
  }
  if (hostConnection && hostConnection.open) {
    hostConnection.send({ type: 'requestWaiting' });
  } else {
    applyReturnToWaiting();
  }
}

function applyReturnToWaiting() {
  window._horStayInGame = false;
  try { horMarkActiveTable(false); } catch (e) {}
  try { document.body.classList.remove('in-game'); } catch (e) {}
  if (game) {
    game.phase = 'waiting';
    game.paused = false;
  }
  try { hideCelePage(); } catch (e) {}
  const ov = $('winOverlay');
  if (ov) ov.classList.add('hidden');
  const score = $('scoreModal');
  if (score) score.classList.add('hidden');
  const hist = $('historyModal');
  if (hist) hist.classList.add('hidden');
  const ltEnd = $('ltEndGame');
  if (ltEnd) ltEnd.classList.add('hidden');
  try { showHostGameTools(false); } catch (e) {}
  if (game) {
    game.phase = 'waiting';
    game.paused = false;
  }
  try { document.body.classList.remove('in-game'); } catch (e) {}
  showWaiting();
}


// ========== State broadcast & client apply ==========
function broadcastState() {
  // Public state
  // Live counters taken this hand (for bid progress UI)
  let handPtsA = 0, handPtsB = 0;
  try {
    (game.tricksTaken[0] || []).forEach(c => { handPtsA += cardPoints(c); });
    (game.tricksTaken[1] || []).forEach(c => { handPtsB += cardPoints(c); });
  } catch (e) {}

  horNetSeq += 1;
  const publicState = {
    type: 'state',
    seq: horNetSeq,
    phase: game.phase,
    scores: game.scores,

    bid: game.bid,
    highestBid: Number.isFinite(Number(game.highestBid)) ? game.highestBid : auctionHigh(),
    minBid: minBid,
    passCount: game.passCount || 0,
    bidder: game.bidder,
    trump: game.trump,
    trumpVoiceEvent790: game.trumpVoiceEvent790 || null,
    currentPlayer: game.currentPlayer,
    trick: game.trick,
    ledColor: game.ledColor,
    players: publicPlayersSnapshot(),
    dealer: game.dealer,
    nestCount: game.nest.length,
    handsCount: game.hands.map(h => h.length),
    targetScore: game.targetScore || targetScore,
    lastTrickWinner: (game.lastTrickWinner != null ? game.lastTrickWinner : null),
    resolvingTrick: !!game.resolvingTrick,
    paused: !!game.paused,
    bidStatus: game.bidStatus || [null, null, null, null],
    discardCount: game.discardCount || 0,
    nestAuctionOpen: !!game.nestAuctionOpen,
    revealTopNest: !!revealTopNest,
    nestFlipped: !!game.nestFlipped,
    topNestCard: game.topNestCard ? { ...game.topNestCard } : null,
    nestFlipStage: game.nestFlipStage || 0,
    widowSpread: Array.isArray(game.widowSpread) ? game.widowSpread.map(c => ({ ...c })) : [],
    handPoints: [handPtsA, handPtsB],
    recentTricks: (typeof recentTricks !== 'undefined' && recentTricks) ? (horExpOn('netDelta') ? recentTricks.slice(-3) : recentTricks) : [],
    matchTricks: (typeof matchTricks !== 'undefined' && matchTricks) ? (horExpOn('netDelta') ? matchTricks.slice(-8) : matchTricks) : [],
    trumpClaimPlayer: getRestClaimHolder(),
    revealedHands: null,
    claimDeclined: !!game.claimDeclined,
    claimAnimation: game.claimAnimation || null,
    claimAnimating: !!game.claimAnimating,
    resolvingTrickPoints: game.resolvingTrickPoints || 0,
  };
  try {
    if (horCareerModeOn() && publicState.players && publicState.players.some(p => p && !p.careerPublic)) {
      console.warn('[Career] public state contains player(s) without Career profile');
    }
  } catch (e) {}
  broadcast(publicState);


  // Private hands — send a copy so clients always get every card (incl. Rook after nest)
  players.forEach((p, i) => {
    const handCopy = (game.hands[i] || []).map(c => ({ ...c }));
    if (p.id === myPeerId) {
      game.myHand = handCopy;
      // Keep host authoritative array in sync for later discard/play
      game.hands[i] = handCopy;
    } else {
      sendTo(p.id, { type: 'privateHand', hand: handCopy });
      if (game.phase === 'discard' && i === game.bidder) {
        sendTo(p.id, {
          type: 'discardStart',
          player: i,
          bidder: game.bidder,
          peerId: p.id,
          discardCount: game.discardCount || 0,
          hand: handCopy,
          nestPreview: (game.nestPreview || []).map(c => ({ ...c })),
        topNestCard: game.topNestCard ? { ...game.topNestCard } : null,
          showKitty: false,
        });
      }
    }
  });

  // Host renders own view
  applyState(publicState);
  const discarding = game.phase === 'discard' && game.bidder === myIndex;
  renderHand(discarding);
  if (discarding) fitHandToScreen();
}

function showBottomTrickWinnerNotice() { try { window.HORHolderCues789?.sync(game, myIndex, isSpectator); } catch (_) {} }

function showLegacyLandscapeTrickNotice752() {
  try {
    if (!game || !game.resolvingTrick || game.lastTrickWinner == null) return;
    const winner = Number(game.lastTrickWinner);
    const me = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
    const rel = ((winner - me) % 4 + 4) % 4;
    if (rel !== 0) return; // only the bottom/local player gets this notice
    const trick = Array.isArray(game.trick) ? game.trick : [];
    if (trick.length !== 4) return;
    const sig = trick.map(t => t && t.card ? String(t.card.id) : '').join('|');
    const key = 'bottom-win:' + winner + ':' + sig;
    if (window._bottomTrickWinnerNoticeKey === key) return;
    window._bottomTrickWinnerNoticeKey = key;
    const show = () => {

    let el = document.getElementById('bottomTrickWinnerNotice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bottomTrickWinnerNotice';
      el.className = 'bottom-trick-winner-notice';
      el.setAttribute('aria-live', 'assertive');
      el.setAttribute('role', 'status');
      el.innerHTML = '<div class="btwn-trophy">🏆</div><div class="btwn-title">YOU WON THE TRICK!</div><div class="btwn-sub">Those cards are yours</div>';
      document.body.appendChild(el);
    }
    el.classList.remove('btwn-show');
    el.classList.remove('btwn-landscape');
    void el.offsetWidth;
    el.classList.add('btwn-show');
    if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) el.classList.add('btwn-landscape');
    (window.HORRavenFight741?.stopClock||clearTimeout)(window._bottomTrickWinnerNoticeTimer);
    window._bottomTrickWinnerNoticeTimer = (window.HORRavenFight741?.later||setTimeout)(() => {
      try { el.classList.remove('btwn-show'); } catch (e) {}
    }, 2200);
    };
    if(window.HORRavenFight741?.deferCelebration(show))return;
    show();
  } catch (e) { console.error('bottom trick winner notice', e); }
}

function applyState(data) {
  if(data?.phase==='dealing'&&game?.phase!=='dealing')window.HORBidVoice801?.stop();
  if (typeof data.revealTopNest === 'boolean') revealTopNest = data.revealTopNest;
  if (!game) game = {};
  if (!isHost && horExpOn('netSequencing') && data && Number.isFinite(Number(data.seq))) {
    const seq = Number(data.seq);
    if (seq && horLastAppliedSeq && seq < horLastAppliedSeq) {
      horDebugLog('Ignoring stale state seq=' + seq + ' last=' + horLastAppliedSeq);
      return;
    }
    horLastAppliedSeq = seq;
  }
  Object.assign(game, {
    phase: data.phase,
    scores: data.scores,

    bid: data.bid,
    highestBid: (function () {
      const h = parseInt(data.highestBid, 10);
      if (Number.isFinite(h)) return h;
      const b = parseInt(data.bid, 10);
      if (Number.isFinite(b) && b > 0) return b;
      return (parseInt(data.minBid, 10) || parseInt(minBid, 10) || 100) - 5;
    })(),
    passCount: data.passCount != null ? data.passCount : (game.passCount || 0),
    bidder: data.bidder,
    trump: data.trump,
    trumpVoiceEvent790: data.trumpVoiceEvent790 || null,
    trumpVoiceRestore790: !!data.trumpVoiceRestore790,
    currentPlayer: data.currentPlayer,
    trick: data.trick || [],
    ledColor: data.ledColor,
    players: data.players,
    dealer: data.dealer,
    handsCount: data.handsCount,
    targetScore: normalizeTargetScore(data.targetScore || game.targetScore || targetScore),
    lastTrickWinner: (data.lastTrickWinner != null ? data.lastTrickWinner : null),
    resolvingTrick: !!data.resolvingTrick,
    paused: !!data.paused,
    bidStatus: data.bidStatus || game.bidStatus || [null, null, null, null],
    discardCount: data.discardCount != null ? data.discardCount : (game.discardCount || 0),
    nestAuctionOpen: data.nestAuctionOpen != null ? !!data.nestAuctionOpen : !!game.nestAuctionOpen,
    nestFlipped: data.nestFlipped != null ? !!data.nestFlipped : !!game.nestFlipped,
    topNestCard: (data.topNestCard !== undefined) ? (data.topNestCard ? { ...data.topNestCard } : null) : (game.topNestCard || null),
    nestFlipStage: data.nestFlipStage != null ? data.nestFlipStage : (game.nestFlipStage || 0),
    widowSpread: Array.isArray(data.widowSpread) ? data.widowSpread.map(c => ({ ...c })) : (game.widowSpread || []),
    handPoints: data.handPoints || game.handPoints || [0, 0],
    trumpClaimPlayer: data.trumpClaimPlayer != null ? data.trumpClaimPlayer : null,
    revealedHands: null,
    claimDeclined: !!data.claimDeclined,
    claimAnimation: data.claimAnimation || null,
    claimAnimating: !!data.claimAnimating,
    resolvingTrickPoints: Number(data.resolvingTrickPoints || 0),
    nestRevealCards: Array.isArray(data.nestRevealCards) ? data.nestRevealCards.map(c => ({ ...c })) : (game.nestRevealCards || []),
  });
  try { renderTopNestPeek(); } catch (e) {}
  if (data.phase && !['lobby','waiting'].includes(data.phase)) horMarkActiveTable(true);
  else if (data.phase === 'lobby' || data.phase === 'waiting') horMarkActiveTable(false);
  if (Array.isArray(data.players)) {
    // Public state is authoritative about table order. Keep the local
    // human index synchronized by stable peer id; this is especially
    // important for the host's partner at seat 2.
    if (!isSpectator && myPeerId) {
      const stateMyIndex = data.players.findIndex(p => p && p.id === myPeerId);
      if (stateMyIndex >= 0) myIndex = stateMyIndex;
    }
    data.players.forEach((sp, i) => {
      let lp=null;
      if (players[i] && players[i].id === sp.id) lp=players[i];
      else lp=players.find(p => p && p.id === sp.id) || null;
      if(lp){
        if(sp.careerPublic&&sp.careerPublic.enabled)lp.careerPublic=sp.careerPublic;
        else if(!sp.isBot && sp.id!==myPeerId)lp.careerPublic=null;
      }
    });
  }
  if (data.recentTricks) recentTricks = data.recentTricks;
  if (data.matchTricks) matchTricks = data.matchTricks;
  if (data.targetScore) targetScore = normalizeTargetScore(data.targetScore);
  if (data.minBid) minBid = parseInt(data.minBid, 10) || minBid;
  showGame();
  renderUI();
  try { showBottomTrickWinnerNotice(); } catch (e) {}
  setPauseUI(!!game.paused);

  // Lay-down animation when someone claims the rest of the tricks
  if (game.claimAnimation && game.claimAnimation.cards && game.claimAnimation.cards.length) {
    try {
      playClaimLaydownAnimation(
        game.claimAnimation.player,
        game.claimAnimation.cards,
        game.claimAnimation.reason
      );
    } catch (e) { console.error(e); }
  } else {
    // Ensure any leftover showdown modal stays hidden
    try { showTrumpShowdown(); } catch (e) {}
  }

  // Spectators never get action UI
  if (isSpectator) {
    hideActionPanel();
    return;
  }

  if (game.paused) {
    hideActionPanel();
    return;
  }

  if (game.phase === 'bidding' || game.phase === 'dealing' || game.phase === 'score') {
    try {
      const lay = $('claimLaydownLayer');
      if (lay && lay.parentNode) lay.parentNode.removeChild(lay);
      window._claimAnimPlaying = false;
    } catch (e) {}
    const panel = $('actionPanel');
    if (panel && panel.classList.contains('trump-claim-panel')) hideActionPanel();
  }

  if (game.phase !== 'discard') hideDiscardOverlay();

  if (!isHost) {
    if (game.phase === 'bidding' && game.currentPlayer === myIndex) {
      showBidUI();
    } else if (game.phase === 'discard' && game.bidder === myIndex) {
      const needLen = (Array.isArray(data.handsCount) && data.handsCount[myIndex]) || 0;
      if (game.myHand && game.myHand.length && (!needLen || game.myHand.length >= needLen)) {
        showDiscardUI(false);
      } else if (hostConnection && hostConnection.open) {
        try { hostConnection.send({ type: 'requestDiscardState', player: myIndex, peerId: myPeerId }); } catch (e) {}
      }
    } else if (game.phase === 'trump' && game.bidder === myIndex) {
      hideDiscardOverlay();
      showTrumpUI();
    } else if (game.phase === 'play' && game.currentPlayer === myIndex && !game.claimAnimating) {
      lastTurnIndex = myIndex;
      hideActionPanel();
      try { renderHand(); } catch (e) {}
      if (game.trumpClaimPlayer === myIndex) showAllTrumpsClaimUI();
      try { maybeRemindTurn(); } catch (e) {}
    } else {
      if (game.phase === 'play') lastTurnIndex = game.currentPlayer;
      // Never show lay-down popup when it is not your turn
      hideActionPanel();
    }
  } else if (game.claimAnimating) {
    hideActionPanel();
  }
}




// Compact top-bar bid progress: Bid · Made · Need
function updateBidProgress() {
  const el = $('bidProgress');
  if (!el || !game) return;
  const bid = game.bid || 0;
  const bidder = game.bidder;
  const phase = game.phase;
  const show = bid > 0 && bidder >= 0 && (phase === 'discard' || phase === 'trump' || phase === 'play' || phase === 'score');
  const felt = $('feltBidNeed');
  if (!show) {
    el.classList.add('hidden');
    el.textContent = '';
    if (felt) { felt.classList.add('hidden'); felt.textContent = ''; }
    return;
  }
  let ptsA = 0, ptsB = 0;
  if (Array.isArray(game.handPoints)) {
    ptsA = game.handPoints[0] || 0;
    ptsB = game.handPoints[1] || 0;
  } else if (game.tricksTaken) {
    try {
      (game.tricksTaken[0] || []).forEach(c => { ptsA += cardPoints(c); });
      (game.tricksTaken[1] || []).forEach(c => { ptsB += cardPoints(c); });
    } catch (e) {}
  }
  const bidderTeam = (players[bidder] && typeof players[bidder].team === 'number')
    ? players[bidder].team
    : (bidder % 2);
  const made = bidderTeam === 0 ? ptsA : ptsB;
  const need = Math.max(0, bid - made);
  const us = typeof teamLabel === 'function' ? teamLabel(bidderTeam) : (bidderTeam === 1 ? 'Raven' : 'Griffin');
  el.classList.remove('hidden', 'made', 'short');
  el.classList.add(need === 0 ? 'made' : 'short');
  const line = `${us} ${made} of ${bid} · ${need === 0 ? 'Bid made' : `Need ${need} more`}`;
  el.textContent = line;
  el.title = line;
  if (felt) {
    felt.textContent = need === 0 ? `${us} made the bid` : `Need ${need} more`;
    felt.className = 'felt-badge bid-need' + (need === 0 ? ' made' : ' short');
    felt.classList.remove('hidden');
  }
}


function clearTrumpBanners() {
  ['trumpBanner', 'ltTrumpStamp'].forEach((id) => {
    const el = typeof $ === 'function' ? $(id) : document.getElementById(id);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('trump-stamp-anim', 'trump-react', 'trump-rook-react');
    el.innerHTML = '';
    delete el.dataset.trumpStamped;
    delete el.dataset.trumpColor;
  });
  window.__horTrumpReactionKey = '';
  const tb = typeof $ === 'function' ? $('trumpBadge') : document.getElementById('trumpBadge');
  if (tb) tb.classList.add('hidden');
}

function trumpMarkerMarkup(color) {
  const safe = COLORS.includes(color) ? color : 'black';
  const name = String((COLOR_NAMES && COLOR_NAMES[safe]) || safe).toUpperCase();
  return '<span class="trump-impact-copy" aria-hidden="true">' +
      '<span class="trump-impact-color">' + name + '</span>' +
    '</span>' +
    '<span class="trump-medallion" aria-hidden="true">' +
      '<span class="trump-medallion-edge">' +
        '<span class="trump-medallion-face">' +
          '<span class="trump-enamel"><span class="trump-stamp-word">' + name + '</span></span>' +
        '</span>' +
      '</span>' +
    '</span>' +
    '<span class="sr-only">' + name + ' is trump</span>';
}

function paintTrumpMarker(el, color) {
  if (!el || !color) return;
  const isNew = el.dataset.trumpStamped !== color;
  if (el.dataset.trumpColor !== color || !el.querySelector('.trump-medallion')) {
    el.innerHTML = trumpMarkerMarkup(color);
    el.dataset.trumpColor = color;
  }
  COLORS.forEach((c) => el.classList.remove('trump-' + c));
  el.classList.add('trump-banner', 'trump-signature', 'trump-' + color);
  // Rook554: trump is an announcement, not persistent table furniture.
  // Re-renders must not bring it back after the one-shot bounce/fade completes.
  if (isNew) {
    el.dataset.trumpStamped = color;
    el.classList.remove('hidden');
    playTrumpStampFx(el);
  }
}

// ========== Griffin House signature trump FX ==========
function playTrumpSpinSound() {
  playNatural063('stamp',.6);
}

function playTrumpStampFx(el) {
  if (!el) return;
  if (el.__horTrumpFxTimer) window.clearTimeout(el.__horTrumpFxTimer);
  // Rook589: do not replace Trump selection/DOM/orientation ownership.
  // Attach the approved #4 presentation only at Rook585's proven final FX hook.
  HOR_TRUMP_FX.forEach(k => el.classList.remove('trump-fx-' + k));
  el.classList.remove('trump-stamp-anim', 'trump-react', 'trump-rook-react', 'trump-spinup-approved');
  void el.offsetWidth;
  el.classList.add('trump-spinup-approved');
  try { playTrumpSpinSound(); } catch(e) {}
  el.__horTrumpFxTimer = window.setTimeout(() => {
    try { el.classList.remove('trump-spinup-approved'); el.classList.add('hidden'); } catch(e) {}
  }, solScaledDelay(2850, 0));
}

function reactTrumpMarker(isRook) {
  ['trumpBanner', 'ltTrumpStamp'].forEach((id) => {
    const el = typeof $ === 'function' ? $(id) : document.getElementById(id);
    if (!el || el.classList.contains('hidden')) return;
    el.classList.remove('trump-react', 'trump-rook-react');
    void el.offsetWidth;
    el.classList.add(isRook ? 'trump-rook-react' : 'trump-react');
    window.setTimeout(() => {
      try { el.classList.remove('trump-react', 'trump-rook-react'); } catch (e) {}
    }, isRook ? 620 : 430);
  });
}

function maybeReactTrumpPlay() {
  if (!game || game.phase !== 'play' || !game.trump || !Array.isArray(game.trick) || !game.trick.length) return;
  const play = game.trick[game.trick.length - 1];
  const card = play && (play.card || play);
  if (!card) return;
  const key = [game.trump, game.trick.length, play && play.player, card.id || (card.color + '-' + card.rank)].join('|');
  if (window.__horTrumpReactionKey === key) return;
  window.__horTrumpReactionKey = key;
  let isTrump = false;
  try { isTrump = typeof isTrumpCard === 'function' ? isTrumpCard(card, game.trump) : card.color === game.trump; } catch (e) {}
  if (!isTrump) return;
  const isRook = card.color === 'rook' || card.id === 'rook';
  window.requestAnimationFrame(() => reactTrumpMarker(isRook));
}

// ========== Rendering ==========
// Same established pot renderer, shared with the portrait score transition.
function renderTrickPot784() {
  const ptsBar = $('trickPtsBar');
  if (ptsBar) {
    const tlen = (game.trick && game.trick.length) || 0;
    if (game.phase === 'play' && tlen > 0) {
      let pts = 0;
      try { pts = (typeof trickPointsSoFar === 'function') ? trickPointsSoFar() : 0; } catch (e) { pts = 0; }
      if (game.resolvingTrick && Number(game.resolvingTrickPoints) >= 0) {
        pts = Number(game.resolvingTrickPoints) || pts;
      }
      ptsBar.textContent = 'POT • ' + pts;
      ptsBar.classList.remove('hidden');
    } else {
      ptsBar.textContent = '';
      ptsBar.classList.add('hidden');
    }
  }
}

function renderUI() {
  try { window.HORHolderIdentity784?.sync(); } catch(e) {}
  try { window.HORUnifiedBidding752?.sync(game, myIndex, isSpectator); } catch(e) {}
  try { window.HORHolderCues789?.sync(game, myIndex, isSpectator); } catch(e) {}
  if (!game || game.phase!=='play' || !game.resolvingTrick) { try { window.HORRavenFight741?.sync(game); } catch(_) {} }
  try { window.HORBidRepair737?.sync(); } catch(e) {}
  try { window.HORTrumpVoice?.sync(game, playerAvatars); } catch(e) { console.warn('Trump voice:',e); }
  try { if (window.HORTrump714) window.HORTrump714.sync(game, myIndex, {spectator:isSpectator, scaled:solScaledDelay}); } catch(e) { console.warn('Trump presentation:',e); }
  try {
    const mine=horMyCareerProfile();
    [players,(game&&game.players)].forEach(pool=>{
      if(!Array.isArray(pool))return;
      if(mine&&mine.enabled){
        let me=pool.find(x=>x&&!x.isBot&&x.id===myPeerId);
        if(!me&&Number.isInteger(myIndex))me=pool[myIndex];
        if(me&&!me.isBot)me.careerPublic=mine;
      }
      if(horCareerModeOn()&&window.HORProgression&&HORProgression.localCareer&&HORProgression.localCareer.botPublicProfile){
        pool.forEach(x=>{
          if(x&&x.isBot){
            const bp=HORProgression.localCareer.botPublicProfile(x.name);
            if(bp&&bp.enabled)x.careerPublic=bp;
          }
        });
      }
    });
  } catch(e) {}

  try { renderTopNestPeek(); } catch (e) {}
  try { renderWidowSpread(); } catch (e) {}

  if (!game) return;
  if (horExpOn('renderOptimization')) {
    const handIds = (game.myHand || []).map(c => c && c.id).join(',');
    const trickIds = ((game.trick && game.trick.cards) || []).map(c => (c && (c.id || (c.card && c.card.id))) || '').join(',');
    const sig = [game.resolvingTrick ? [game.handNumber,game.lastTrickWinner,(game.trick||[]).map(p=>p.card?.id).join(',')].join(':') : '',game.phase, game.currentPlayer, game.bidder, game.trump, game.bid, (game.scores||[]).join('/'), handIds, trickIds, myIndex, game.paused ? 1 : 0].join('|');
    const now = Date.now();
    if (sig === window.__horUiSig && now - (window.__horUiAt || 0) < 80) return;
    window.__horUiSig = sig;
    window.__horUiAt = now;
  }
  try { applyFirstHandChrome(); } catch (e) {}
  if ($('scoreA')) $('scoreA').textContent = game.scores[0];
  if ($('scoreB')) $('scoreB').textContent = game.scores[1];
  if ($('targetDisplay')) $('targetDisplay').textContent = String(game.targetScore || targetScore || 500);
  const ltA = $('ltScoreA'), ltB = $('ltScoreB'), ltT = $('ltTarget');
  if (ltA) ltA.textContent = game.scores[0];
  if (ltB) ltB.textContent = game.scores[1];
  try { if (typeof paintTeamChrome === 'function') paintTeamChrome(); } catch (e) {}
  if (ltT) ltT.textContent = String(game.targetScore || targetScore || 500);
  if ($('phaseLabel')) $('phaseLabel').textContent = {
    dealing: 'Dealing',
    bidding: 'Bidding',
    discard: 'Discard',
    trump: 'Choose Trump',
    play: 'Playing',
    score: 'Hand Score'
  }[game.phase] || game.phase;

  // Rook560: Trump announcement is event-owned by hostProcessTrump. renderUI must
  // never recreate/restart it from persistent game state.
  if ($('trumpDisplay')) $('trumpDisplay').textContent = (game.phase === 'play') ? '' : (game.bid ? `Bid: ${formatBidAmount(game.bid, { short: true })}` : '');
  const tb = $('trumpBadge');
  if (tb) tb.classList.add('hidden');
  if (game.phase === 'play') {
    try { maybeReactTrumpPlay(); } catch (e) {}
  } else if (game.phase !== 'trump') {
    try { clearTrumpBanners(); } catch (e) {}
  }

  updateBidProgress();
  const roomImpact = document.querySelector('.game-room');
  if (roomImpact) {
    roomImpact.classList.toggle('big-trick-impact', !!(game.resolvingTrick && Number(game.resolvingTrickPoints || 0) >= 30));
    roomImpact.classList.toggle('rook-capture-impact', !!(game.resolvingTrick && game.trick && game.trick.some(t => (t.card && (t.card.color === 'rook' || t.card.id === 'rook')))));
  }

  const lb = $('ledBadge');
  if (lb) {
    if (game.phase === 'play' && game.ledColor) {
      lb.textContent = `Led: ${COLOR_NAMES[game.ledColor] || game.ledColor}`;
      lb.className = 'felt-badge led led-' + game.ledColor;
      lb.classList.remove('hidden');
    } else {
      lb.classList.add('hidden');
    }
  }

  // Play order is +1 (clockwise). From your seat, next player is on your LEFT.
  const seatBase = (myIndex >= 0) ? myIndex : 0;
  const seatMap = {
    partner: (seatBase + 2) % 4,
    left: (seatBase + 1) % 4,   // next clockwise
    right: (seatBase + 3) % 4,  // previous (counterclockwise)
    me: seatBase
  };


  const whoseTurn = (game.phase === 'play' || game.phase === 'bidding')
    ? game.currentPlayer
    : (game.phase === 'discard' || game.phase === 'trump')
      ? game.bidder
      : -1;

  let trickLeadIdx = -1;
  try {
    if (game.phase === 'play' && game.trick && game.trick.length) {
      if (game.resolvingTrick && game.lastTrickWinner != null) trickLeadIdx = game.lastTrickWinner;
      else {
        const w = (typeof currentTrickWinner === 'function') ? currentTrickWinner() : null;
        if (w && w.player != null) trickLeadIdx = w.player;
      }
    }
  } catch (e) { trickLeadIdx = -1; }

  renderTrickPot784();

  ['partner', 'left', 'right'].forEach(slot => {
    const idx = seatMap[slot];
    const el = $(`slot-${slot}`);
    if (!el) return;
    if (game.players && game.players[idx]) {
      const av = playerAvatars[game.players[idx].id] || game.players[idx].avatar || AVATARS[idx % AVATARS.length];
      const nameEl = el.querySelector('.name');
      if (nameEl) {
        const team = game.players[idx].team === 0 ? 0 : 1;
        const playerName = escapeHtmlSafe(game.players[idx].name || 'Player');
        // Side-seat avatars live outside the name element so the full name can stay on one line.
        if (el.classList.contains('left') || el.classList.contains('right')) {
          let avatarEl = el.querySelector(':scope > .seat-avatar-side');
          if (!avatarEl) {
            avatarEl = document.createElement('span');
            avatarEl.className = 'seat-avatar-side';
            el.insertBefore(avatarEl, nameEl);
          }
          avatarEl.innerHTML = avatarHTML(av);
          // Side-seat avatar is outside .name, so carry the same persona identity
          // onto the avatar container for long-press/persona handling.
          applyBotNameAttr(avatarEl, game.players[idx]);
          nameEl.innerHTML = `<span class="seat-identity-copy"><span class="player-name-text">${playerName}</span>${horCareerBadgeHtml(game.players[idx])}</span>`;
        } else {
          nameEl.innerHTML = `<span class="seat-avatar">${avatarHTML(av)}</span><span class="seat-identity-copy"><span class="player-name-text">${playerName}</span>${horCareerBadgeHtml(game.players[idx])}</span>`;
        }
        applyBotNameAttr(nameEl, game.players[idx]);
        try { horBindCareerBadges(el); } catch (e) {}
      }
      const cc = el.querySelector('.cards-count');
      if (cc) cc.textContent = '';
      window.HORUnifiedBidding752.renderSeat(el, game, idx, myIndex, isSpectator);
    }
    const quietSeats = isFirstHandOfMatch();
    el.classList.toggle('is-turn', !quietSeats && idx === whoseTurn && !game.resolvingTrick);
    el.classList.toggle('is-trick-lead', !quietSeats && idx === trickLeadIdx);
    el.classList.toggle('is-hand-winner', !!(game.claimAnimating && game.trumpClaimPlayer === idx));
    let leadTag = el.querySelector(':scope > .seat-lead-tag');
    if (!leadTag) {
      leadTag = document.createElement('div');
      leadTag.className = 'seat-lead-tag';
      el.appendChild(leadTag);
    }
    if (idx === trickLeadIdx && !quietSeats) {
      leadTag.textContent = 'LEAD';
      leadTag.classList.remove('hidden');
    } else {
      leadTag.textContent = '';
      leadTag.classList.add('hidden');
    }
    el.classList.toggle('is-passed', !!(game.phase === 'bidding' && game.bidStatus && game.bidStatus[idx] === 'pass'));
    // Played cards only appear in the center trick (not on each seat)
    const pc = el.querySelector('.played-card');
    if (pc) pc.innerHTML = '';
  });

  const meSlot = $('slot-me');
  if (meSlot) {
    const pc = meSlot.querySelector('.played-card');
    if (pc) pc.innerHTML = '';
    // Show this player's real name (not "You")
    const meNameEl = $('holderPlayerName784') || meSlot.querySelector('.name');
    if (meNameEl) {
      const meP = (game.players && game.players[seatBase])
        || (players && players[seatBase])
        || null;
      const meName = (meP && meP.name) || myName || 'Player';
      const meId = (meP && meP.id) || myPeerId;
      const av = playerAvatars[meId] || (meP && meP.avatar) || AVATARS[seatBase % AVATARS.length];
      meNameEl.innerHTML = `<span class="seat-avatar">${avatarHTML(av)}</span><span class="seat-identity-copy"><span class="player-name-text">${escapeHtmlSafe(meName)}</span>${meP?horCareerBadgeHtml(meP):''}</span>`;
      applyBotNameAttr(meNameEl, meP);
      try { horBindCareerBadges(meNameEl); } catch (e) { console.error('[Career badge bind]', e); }
    }
    const quietMe = isFirstHandOfMatch();
    meSlot.classList.toggle('is-turn', !quietMe && seatBase === whoseTurn && !game.resolvingTrick);
    meSlot.classList.toggle('is-trick-lead', !quietMe && seatBase === trickLeadIdx);
    meSlot.classList.toggle('is-hand-winner', !!(game.claimAnimating && game.trumpClaimPlayer === seatBase));
    let meLead = meSlot.querySelector(':scope > .seat-lead-tag');
    if (!meLead) {
      meLead = document.createElement('div');
      meLead.className = 'seat-lead-tag';
      meSlot.appendChild(meLead);
    }
    if (seatBase === trickLeadIdx && !quietMe) {
      meLead.textContent = 'LEAD';
      meLead.classList.remove('hidden');
    } else {
      meLead.textContent = '';
      meLead.classList.add('hidden');
    }
    meSlot.classList.toggle('is-passed', !!(game.phase === 'bidding' && game.bidStatus && game.bidStatus[seatBase] === 'pass'));
    window.HORUnifiedBidding752.renderSeat(meSlot, game, seatBase, myIndex, isSpectator);
  }


  try { window.HORHolderIdentity784?.sync(); } catch(e) {}
  try { scheduleBottomAvatar029(); refreshPortraitLastTrick029(); } catch (e) {}
  try { positionSeatLeadTags(); positionSeatBidBadges(); } catch (e) {}


  // Nest face-down count during play
  const nestBadge = $('nestDiscardBadge');
  if (nestBadge) {
    const n = game.nestDiscardCount || (game.nestCards && game.nestCards.length) || 0;
    if (game.phase === 'play' && n > 0) {
      nestBadge.classList.remove('hidden');
      nestBadge.textContent = `Nest ${n}`;
    } else {
      nestBadge.classList.add('hidden');
    }
  }

  const trickArea = $('trickArea');
  if (!trickArea) return;
  const trick = game.trick || [];
  if (!trick.length) {
    // Leave a live flight alone. After the host clears the trick, drop layers
    // and flags so the next deal starts clean.
    if (window._trickCapturing) {
      return;
    }
    window._trickFlightKey = '';
    window._trickTakenRel = -1;
    try { clearTrickFlightLayers(); } catch (e) {}
    try { clearBottomTookMark(); } catch (e) {}
    trickArea.innerHTML = '';
    delete trickArea.dataset.poseKey041;
    window.__playedTravelSeen041 = [];
    try {
      const room = document.querySelector('.game-room');
      if (room) room.classList.remove('trick-resolving');
    } catch (e) {}
  } else {
    // Real-life stack in the middle: top card fully visible, lower cards peek underneath.
    // Small offsets + slight rotation; deterministic by play order for all clients.
    const stack = [
      { rot: -6, x: -7, y:  5 },
      { rot:  4, x:  6, y: -3 },
      { rot: -3, x: -3, y:  4 },
      { rot:  5, x:  5, y: -2 },
    ];
    const last = trick[trick.length - 1];
    const lastName = (game.players && game.players[last.player])
      ? game.players[last.player].name
      : (players[last.player] ? players[last.player].name : `P${last.player + 1}`);
    const winnerName = (game.resolvingTrick && game.lastTrickWinner != null)
      ? ((game.players && game.players[game.lastTrickWinner])
          ? game.players[game.lastTrickWinner].name
          : (players[game.lastTrickWinner] ? players[game.lastTrickWinner].name : ''))
      : '';
    // Winner seat relative to viewer → swipe direction (never swipe-me)
    let swipeDir = '';
    let winnerRel = -1;
    if (game.resolvingTrick && game.lastTrickWinner != null) {
      const me = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
      const w = game.lastTrickWinner;
      winnerRel = (w - me + 4) % 4; // 0=me(bottom), 1=left, 2=partner(top), 3=right
      swipeDir = ['', 'swipe-left', 'swipe-top', 'swipe-right'][winnerRel] || '';
    }
    // ROOK027: reproduce the reviewed TABLE-003 scene coordinates and matrices.
    const portraitPlane = matchMedia('(orientation: portrait)').matches;
    const reviewedPlane = [{"anchor": [141, 386], "matrix": "matrix3d(1, 0, 0, 0, -0.1058, 0.7, 0, -0.00115, 0, 0, 1, 0, 0, 0, 0, 1)", "rotation": "rotate(100deg)"}, {"anchor": [211, 342], "matrix": "matrix3d(0.888286, 0, 0, 0, 0, 0.552336, 0, -0.0010215, 0, 0, 1, 0, 0, 0, 0, 1)", "rotation": "rotate(175deg)"}, {"anchor": [286, 400], "matrix": "matrix3d(1, 0, 0, 0, 0.1058, 0.7, 0, -0.00115, 0, 0, 1, 0, 0, 0, 0, 1)", "rotation": "rotate(-98deg)"}, {"anchor": [202, 424], "matrix": "matrix3d(1.11171, 0, 0, 0, 0, 0.865136, 0, -0.0012784, 0, 0, 1, 0, 0, 0, 0, 1)", "rotation": "rotate(9deg)"}];
    const referenceCover = 915 / 1797;
    const sceneCover = Math.max(innerWidth / 875, innerHeight / 1797);
    const planeScale = sceneCover / referenceCover;
    const cardsHtml = trick.map((t, i) => {
      const isWinner = !!(game.resolvingTrick && game.lastTrickWinner === t.player);
      const isLatest = i === trick.length - 1;
      if (isLatest && t.card && (t.card.color === 'rook' || t.card.id === 'rook')) {
        const pulseSig = trick.length + ':' + t.player + ':' + (t.card.id || 'rook');
        if (window._rookSeenPlaySig !== pulseSig) {
          window._rookSeenPlaySig = pulseSig;
          markRookJustPlayed();
        }
      }
      const isRookPulse = !!(isLatest && t.card && rookPlayPulseActive(t.card));
      const s = stack[i % stack.length];
      // Use CSS vars for stack pose so swipe keyframes can own `transform`
      let style = `--sx:${s.x}px;--sy:${s.y}px;--srot:${s.rot}deg;z-index:${i + 1};--card-i:${i};`;
      const relativeSeat = (t.player - ((typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0) + 4) % 4;
      const reviewed = reviewedPlane[({1:0, 2:1, 3:2, 0:3})[relativeSeat]];
      if (portraitPlane) {
        const x = innerWidth / 2 + (reviewed.anchor[0] - 206) * planeScale;
        const y = reviewed.anchor[1] * planeScale;
        style += `--rook027-scale:${planeScale};left:${x - 44 * planeScale}px!important;top:${y - 63 * planeScale}px!important;width:${88 * planeScale}px!important;height:${126 * planeScale}px!important;`;
      }
      const face = renderCardHTML(t.card, false);
      const presentedFace = portraitPlane ? `<div class="played-scene"><div class="played-plane" style="transform:${reviewed.matrix}"><div class="played-orientation" style="transform:${reviewed.rotation}"><div class="played-size">${face}</div></div></div></div>` : face;
      const who = (game.players && game.players[t.player] && game.players[t.player].name)
        || (players[t.player] && players[t.player].name)
        || ('P' + (t.player + 1));
      return `<div class="trick-card-wrap ${portraitPlane ? 'table003-played' : ''} ${isLatest ? 'latest' : ''} ${isWinner ? 'winner' : ''} ${isRookPulse ? 'rook-play-pulse' : ''}" data-plane-x="${reviewed.anchor[0]}" data-plane-y="${reviewed.anchor[1]}" style="${style}">
        ${presentedFace}
        <div class="trick-card-name">${escapeHtmlSafe(who)}</div>
      </div>`;
    }).join('');
    const caption = ''; // Rook516: center-table TRICK/status wording intentionally removed
    const resolveKey = trickResolveKey(game.lastTrickWinner, trick);
    const alreadyTaken = !!(game.resolvingTrick && window._trickFlightKey && window._trickFlightKey === resolveKey);
    const poseKey041 = JSON.stringify([game.handNumber, myIndex, portraitPlane, trick.map(t=>[t.player,t.card&&t.card.id]), game.resolvingTrick, game.lastTrickWinner]);
    if (!window._trickCapturing && !alreadyTaken && (!portraitPlane || trickArea.dataset.poseKey041 !== poseKey041)) {
      trickArea.dataset.poseKey041 = poseKey041;
      trickArea.dataset.needsPosition041 = '1';
      trickArea.innerHTML = `
        <div class="trick-stack${(typeof gfxOn === 'function' && gfxOn('trickFan')) ? ' trick-fan' : ''}">
          ${cardsHtml}
        </div>
      `;
    } else {
      const cap = trickArea.querySelector('.trick-caption');
      if (cap) cap.textContent = caption;
    }
    if (portraitPlane && !window._trickCapturing && !alreadyTaken) {if(trickArea.dataset.needsPosition041==='1'){positionPlayedPlane027();delete trickArea.dataset.needsPosition041;}animatePlayedTravel041(trickArea, trick);}
    try { applyRookPlayPulse(); } catch (e) {}
    const room = document.querySelector('.game-room');
    if (window._trickCapturing || alreadyTaken) {
      // One capture per resolved trick. Do not rebuild or replay.
    } else if (game.resolvingTrick && game.lastTrickWinner != null) {
      if (room) room.classList.add('trick-resolving');
      // DELIBERATE REVEAL PAUSE: leave all four cards fully visible first.
      // This is intentionally longer than a render frame so the fourth/last
      // card can be seen before ANY capture motion begins on phones or APKs.
      clearTimeout(window._trickResolveTimer);
      window._trickResolveTimer = setTimeout(() => {
        window._trickResolveTimer = null;
        if (!game || !game.resolvingTrick || game.lastTrickWinner == null) return;
        if (window._trickFlightKey === resolveKey || window._trickCapturing) return;
        const currentKey = trickResolveKey(game.lastTrickWinner, game.trick || []);
        if (currentKey !== resolveKey) return;
        // Mark this exact resolved trick as ready only after the deliberate
        // reveal pause. Landscape's renderer is also called by resize/orientation
        // updates, so it must not be allowed to bypass this timer.
        window._trickRevealReadyKey = resolveKey;
        const land = !!(typeof isLandscapeNow === 'function' && isLandscapeNow()
          && document.body.classList.contains('in-game'));
        if (land) {
          try {
            updateLandscapeTheater();
            requestAnimationFrame(() => {
              try { animateLandscapeTrickCapture(game.lastTrickWinner); } catch (e) {}
            });
          } catch (e) {}
        } else {
          const liveStack = trickArea.querySelector('.trick-stack');
          if (liveStack && liveStack.isConnected) {
            liveStack.classList.remove('trick-swipe', 'swipe-me', 'swipe-top', 'swipe-right');
            animateTrickCaptureRobust(liveStack, game.lastTrickWinner);
          }
        }
      }, solScaledDelay(1100, 70));
    } else if (room) {
      room.classList.remove('trick-resolving');
    }
  }
  try { syncHumanTurnStatus(); } catch (e) {}
  try { positionSeatLeadTags(); } catch (e) {}
  try { if (!$('botThinking')?.classList.contains('hidden')) requestAnimationFrame(positionBotThinkingAtSeat); } catch (e) {}
  try { updateLandscapeTheater(); } catch (e) {}
  try { window.HORCharacterStudio077?.sync(); } catch (e) { console.warn('Character presentation:', e); }
  try { window.HORRavenFight741?.sync(game, {scaled:solScaledDelay, reduced:reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches, pace:horGamePace}); } catch(e) { console.warn('Raven presentation:',e); }
}



function isCurrentTrump(card) {
  if (!card) return false;
  const trump = (game && game.trump) || null;
  try {
    if (typeof isTrumpCard === 'function') return isTrumpCard(card, trump);
  } catch (e) {}
  if (card.color === 'rook' || isRed2(card) || isRed1(card)) return true;
  return !!(trump && card.color === trump);
}

function clearTrickFlightLayers() {
  try { clearTimeout(window._trickResolveTimer); window._trickResolveTimer = null; } catch (e) {}
  document.querySelectorAll('.trick-capture-flight-layer').forEach((el) => {
    try { el.remove(); } catch (e) {}
  });
}

function trickResolveKey(winnerIdx, trick) {
  const list = trick || (game && game.trick) || [];
  const sig = list.map(t => (t && t.card && t.card.id) || '').join('|');
  return 'trick:' + String(winnerIdx) + ':' + sig;
}

function winnerRelFor(winnerIdx) {
  const me = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
  return ((Number(winnerIdx) - me) % 4 + 4) % 4;
}

function clearBottomTookMark() {
  document.querySelectorAll('.took-this-trick').forEach((el) => {
    el.classList.remove('took-this-trick');
  });
  document.querySelectorAll('.you-took-chip').forEach((el) => {
    try { el.remove(); } catch (e) {}
  });
}

function markBottomTookTrick() {
  // Retire the duplicate floating GRIFFIN HOUSE / TRICK WON chip.
  showBottomTrickWinnerNotice();
}

function captureTargetForWinner(winnerIdx) {
  const rel = winnerRelFor(winnerIdx);
  let el = null;
  if (rel === 1) el = document.getElementById('slot-left');
  else if (rel === 2) el = document.getElementById('slot-partner');
  else if (rel === 3) el = document.getElementById('slot-right');
  else el = document.getElementById('slot-me');

  const r = el ? el.getBoundingClientRect() : {
    left: window.innerWidth / 2,
    top: 80,
    width: 0,
    height: 0
  };
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, rel };
}

// 794: notify the holder at the visible collection endpoint, not trick resolution.
// A transition event normally supplies arrival; the existing flight cleanup is
// the fallback for reduced motion/throttled or missing transition events.
function watchTrickArrival794(layer, winnerIdx, trick) {
  const arrive=window.HORHolderCues789?.captureWaiter(winnerIdx,trick);
  let done=false;const landed=new Set();
  const finish=()=>{
    if(done)return;done=true;layer.removeEventListener('transitionend',onEnd);
    if(layer.isConnected)arrive?.();
  };
  const onEnd=e=>{
    if(e.propertyName!=='transform'||e.target.parentNode!==layer||!e.target.classList.contains('trick-flight-card'))return;
    landed.add(e.target);
    if(landed.size>=layer.querySelectorAll(':scope > .trick-flight-card').length)finish();
  };
  layer.addEventListener('transitionend',onEnd);
  return finish;
}

function animateTrickCaptureRobust(stackEl, winnerIdx) {
  if (window.HORRavenFight741?.ownsCapture(game)) return;
  if (!stackEl || !stackEl.isConnected) return;
  const flightKey = trickResolveKey(winnerIdx, game && game.trick);
  if (window._trickCapturing || window._trickFlightKey === flightKey) return;

  window._trickCapturing = true;
  window._trickFlightKey = flightKey;
  clearTrickFlightLayers();

  const dest = captureTargetForWinner(winnerIdx);
  window._trickTakenRel = dest.rel;

  // Bottom player needs a real flight path too. The old code only faded the
  // center stack here, which is why portrait showed the winner message but
  // appeared to do nothing. Target the actual hand when it is available.
  let targetX = dest.x;
  let targetY = dest.y;
  if (dest.rel === 0) {
    try { markBottomTookTrick(); } catch (e) {}
    const hand = document.getElementById('myHand');
    const hr = hand ? hand.getBoundingClientRect() : null;
    if (hr && hr.width > 20 && hr.height > 20) {
      // Aim into the upper/center portion of the hand so the cards visibly
      // travel DOWN toward the player's cards instead of vanishing at the
      // seat label.
      targetX = hr.left + hr.width / 2;
      targetY = hr.top + Math.min(36, hr.height * 0.22);
    } else {
      targetX = window.innerWidth / 2;
      targetY = window.innerHeight - Math.max(70, window.innerHeight * 0.12);
    }
  }

  const layer = document.createElement('div');
  layer.className = 'trick-capture-flight-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText =
    'position:fixed;left:0;top:0;width:100vw;height:100vh;' +
    'pointer-events:none;z-index:8999;overflow:visible;';
  document.body.appendChild(layer);

  stackEl.style.visibility = 'hidden';
  stackEl.style.animation = 'none';

  const cards = Array.from(stackEl.querySelectorAll('.trick-card-wrap'));
  let flightCount = 0;

  cards.forEach((card, i) => {
    const r = card.getBoundingClientRect();
    if (!r.width || !r.height) return;

    const clone = card.cloneNode(true);
    clone.className = 'trick-flight-card';
    clone.style.cssText =
      '--rook027-scale:' + (card.style.getPropertyValue('--rook027-scale') || '1') + ';position:fixed!important;left:' + r.left + 'px;top:' + r.top + 'px;' +
      'width:' + r.width + 'px;height:' + r.height + 'px;margin:0!important;' +
      'z-index:' + (2147483001 + i) + ';pointer-events:none;' +
      'transform-origin:center center;will-change:transform,opacity;' +
      'opacity:1;visibility:visible;animation:none!important;';

    layer.appendChild(clone);
    card.style.visibility = 'hidden';
    flightCount++;

    const dx = Math.round(targetX - (r.left + r.width / 2));
    const dy = Math.round(targetY - (r.top + r.height / 2));
    const spin = (i % 2 ? 14 : -14);
    const delay = solScaledDelay(i * 55, 0);
    const startTransform = 'translate3d(0,0,0) rotate(0deg) scale(1)';
    let endTransform;
    if (dest.rel === 0) {
      // Portrait bottom-player path: first dip downward, then gather into
      // the hand. The lateral offsets make all four cards independently
      // visible rather than looking like a single fade.
      const fanX = (i - 1.5) * 18;
      const fanY = 28 + (i % 2) * 10;
      endTransform =
        'translate3d(' + (dx + fanX) + 'px,' + (dy + fanY) + 'px,0) rotate(' +
        spin + 'deg) scale(.34)';
    } else {
      endTransform =
        'translate3d(' + dx + 'px,' + dy + 'px,0) rotate(' +
        spin + 'deg) scale(.38)';
    }

    clone.style.transform = startTransform;

    setTimeout(() => {
      if (!clone.isConnected) return;
      clone.style.transition =
        `transform ${solScaledDelay(780, 45)}ms cubic-bezier(.18,.78,.18,1), opacity ${solScaledDelay(780, 45)}ms ease-out`;
      void clone.offsetWidth;
      requestAnimationFrame(() => {
        if (!clone.isConnected) return;
        clone.style.transform = endTransform;
        clone.style.opacity = '0';
      });
    }, delay);
  });

  const arrivalDone794=watchTrickArrival794(layer,winnerIdx,game.trick);
  const cleanupMs = solScaledDelay(1150 + Math.max(0, flightCount - 1) * 55, 80);
  setTimeout(() => {
    arrivalDone794();
    try { layer.remove(); } catch (e) {}
    window._trickCapturing = false;
  }, cleanupMs);
}

function animateLandscapeTrickCapture(winnerIdx) {
  if (window.HORRavenFight741?.ownsCapture(game)) return;
  // Only animate the live four-card resolution. Resize/render callbacks must
  // never replay a completed trick.
  if (!game || !game.resolvingTrick || !game.trick || game.trick.length !== 4) return;
  const plays = $('ltPlays');
  if (!plays || winnerIdx == null) return;
  const faces = Array.from(plays.querySelectorAll('.lt-play .card-face'));
  if (!faces.length) return;
  const key = trickResolveKey(winnerIdx, game.trick);
  if (window._trickCapturing || window._trickFlightKey === key) return;
  window._trickCapturing = true;
  window._trickFlightKey = key;
  window._trickRevealReadyKey = key;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      const rel = winnerRelFor(winnerIdx);
      const bottomWinner = rel === 0;
      const winnerPlay = plays.querySelector('.lt-play.winner');
      const dest = winnerPlay && (winnerPlay.querySelector('.card-face') || winnerPlay);
      const dr = dest ? dest.getBoundingClientRect() : null;
      if (!dr || !dr.width) throw new Error('winner target not painted');
      const targetX = dr.left + dr.width / 2;
      const targetY = dr.top + dr.height / 2;

      plays.classList.add('lt-capturing');
      if (winnerPlay) winnerPlay.classList.add('lt-win-burst');
      const layer = document.createElement('div');
      layer.className = 'trick-capture-flight-layer lt-flight';
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:8999;overflow:visible;';
      document.body.appendChild(layer);

      if (bottomWinner) {
        const badge = document.createElement('div');
        badge.className = 'landscape-bottom-take-badge';
        badge.textContent = '🏆  YOU TAKE THE TRICK!';
        badge.style.left = Math.round(targetX) + 'px';
        badge.style.top = Math.round(targetY) + 'px';
        layer.appendChild(badge);
        requestAnimationFrame(() => badge.classList.add('show'));
      }

      faces.forEach((face, i) => {
        const r = face.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const clone = face.cloneNode(true);
        clone.className = 'trick-flight-card landscape-flight-card';
        clone.style.cssText = `position:fixed!important;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0!important;z-index:${2147483001+i};pointer-events:none;transform-origin:center center;will-change:transform,opacity;opacity:1;visibility:visible;animation:none!important;transition:none;`;
        layer.appendChild(clone);
        face.style.visibility = 'hidden';
        const dx = Math.round(targetX - (r.left + r.width / 2));
        const dy = Math.round(targetY - (r.top + r.height / 2));
        const spin = i % 2 ? 16 : -16;
        clone.style.transform = 'translate3d(0,0,0) rotate(0deg) scale(1)';
        setTimeout(() => {
          if (!clone.isConnected) return;
          clone.style.transition = `transform ${solScaledDelay(720, 45)}ms cubic-bezier(.16,.82,.2,1), opacity ${solScaledDelay(720, 45)}ms ease-in`;
          void clone.offsetWidth;
          requestAnimationFrame(() => {
            if (!clone.isConnected) return;
            clone.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${spin}deg) scale(.34)`;
            clone.style.opacity = '0';
          });
        }, solScaledDelay(i * 50, 0));
      });

      const arrivalDone794=watchTrickArrival794(layer,winnerIdx,game.trick);
      const cleanup = solScaledDelay(920 + Math.max(0, faces.length - 1) * 50, 70);
      setTimeout(() => {
        arrivalDone794();
        try { layer.remove(); } catch (e) {}
        try { plays.classList.remove('lt-capturing'); } catch (e) {}
        window._trickCapturing = false;
      }, cleanup);
    } catch (e) {
      window._trickCapturing = false;
    }
  }));
}

function renderCardHTML(card, small = false) {
  if (!card) return '';
  let cls = card.color === 'rook' ? 'rook' : card.color;
  // Special art + red2 class only when Red 2 is permanent trump in the rules
  if (isRed2(card) && includeRed2) cls = 'red2 red2-art';
  else if (isRed2(card)) cls = 'red';
  if (isRed1(card)) cls = 'red1';
  const size = small ? 'small' : '';
  const trump = isCurrentTrump(card);
  if (trump) cls += ' is-trump';
  // Hide gold star on full-bleed art cards (art already shows trump)
  const hideStar = (isRed2(card) && includeRed2) || (card.color === 'rook' || card.id === 'rook');
  const tag = (trump && !hideStar) ? '<span class="c-trump-tag" aria-label="trump">★</span>' : '';
  return `<div class="card-face ${cls} ${size}" data-id="${card.id}">${cardInnerHTML(card)}${tag}</div>`;
}




function fitHandToScreen() {
  const handEl = $('myHand');
  const area = handEl && handEl.parentElement;
  if (!handEl || !area || !game || !game.myHand) return;
  const n = handEl.querySelectorAll(':scope > .card-face').length;
  if (n <= 0) return;
  handEl.dataset.handCount=String(n);

  // Portrait-only layout
  const vh = window.innerHeight || 400;
  const vw = window.innerWidth || 360;

  // Measure real content box; fall back to viewport. Subtract padding + safety margin
  // so 9–10 card hands never clip on narrow phones.
  let rawW = area.clientWidth;
  if (!rawW || rawW < 80) rawW = handEl.clientWidth || vw;
  const style = window.getComputedStyle(area);
  const padL = parseFloat(style.paddingLeft) || 0;
  const padR = parseFloat(style.paddingRight) || 0;
  const safety = 8; // borders, subpixel, scrollbars
  // 055: reserve the visible curved holder walls in portrait only.
  const holderPortrait055 = isPortraitViewport() && document.body.classList.contains('in-game');
  const containerAvailable = rawW - padL - padR - safety;
  const available = Math.max(140, holderPortrait055
    ? Math.min(containerAvailable, rawW * 0.88 - 4)
    : containerAvailable);

  const maxHByViewport = Math.max(42, Math.min(88, Math.floor(vh * 0.20)));
  const maxW = 60;
  // Shrink earlier so 9–10 cards fit cleanly on ~320–390px screens
  const minW = n >= 15 ? 16 : n >= 13 ? 18 : n >= 11 ? 20 : n >= 9 ? 22 : 26;

  // Prefer zero/near-zero gap when many cards so everything stays on-screen
  let gap = n >= 9 ? 0 : n >= 7 ? 2 : 3;
  let cardW = Math.floor((available - gap * (n - 1)) / n);
  cardW = Math.min(maxW, cardW);
  while (cardW * n + gap * (n - 1) > available && gap > 0) {
    gap--;
    cardW = Math.floor((available - gap * (n - 1)) / n);
  }
  if (cardW * n + gap * (n - 1) > available) {
    gap = 0;
    cardW = Math.floor(available / n);
  }
  // Never force wider than available — allow going below minW rather than clip
  cardW = Math.min(maxW, Math.max(14, cardW));
  if (cardW * n + gap * (n - 1) > available) {
    gap = 0;
    cardW = Math.max(14, Math.floor(available / n));
  }

  let cardH = Math.round(cardW * (84 / 58));
  if (cardH > maxHByViewport) {
    cardH = maxHByViewport;
    cardW = Math.max(14, Math.round(cardH * (58 / 84)));
    if (cardW * n + gap * (n - 1) > available) {
      gap = 0;
      cardW = Math.max(14, Math.floor(available / n));
      cardH = Math.min(maxHByViewport, Math.round(cardW * (84 / 58)));
    }
  }

  if (area) {
    area.style.minHeight = '';
    // Portrait-only: leave max-height to CSS
  }

  handEl.style.setProperty('--hand-card-w', cardW + 'px');
  handEl.style.setProperty('--hand-card-h', cardH + 'px');
  handEl.style.setProperty('--hand-gap', gap + 'px');
  handEl.style.flexWrap = 'nowrap';
  handEl.style.justifyContent = 'center';
  handEl.style.overflowX = 'auto';
  // Ensure the area itself can scroll horizontally if anything still overflows
  area.style.overflowX = 'auto';
  area.style.overflowY = 'hidden';
}


/** Relative strength among trump cards (higher = stronger). Matches compareCards order. */
function trumpDefendStrength(card, trump) {
  if (!card) return -1;
  if (rookLowest) {
    if (isRed1(card)) return 1000;
    if (isRed2(card)) return 900;
    if (card.color === 'rook' || card.id === 'rook') return 0; // lowest
    if (trump && card.color === trump) return effectiveRank(card);
    return -1;
  }
  // Rook high (default): Red1 > Rook > Red2 > normal trump by rank
  if (isRed1(card)) return 1000;
  if (card.color === 'rook' || card.id === 'rook') return 950;
  if (isRed2(card)) return 900;
  if (trump && card.color === trump) return effectiveRank(card);
  return -1;
}

function normalizeHandSortMode(mode) {
  if (mode === 'suit' || mode === 'color-high' || !mode) return 'color-high';
  if (mode === 'points') return 'counters';
  if (mode === 'color-low' || mode === 'rank' || mode === 'counters') return mode;
  return 'color-high';
}

function persistHandSortMode() {
  try { localStorage.setItem('horHandSortMode', handSortMode); } catch (e) {}
}

function isRookCard(card) {
  return !!(card && (card.color === 'rook' || card.id === 'rook'));
}

/** Color bucket for display. Permanent trumps are handled separately. */
function displayColorGroup(card) {
  if (!card) return 99;
  const i = COLORS.indexOf(card.color);
  return i >= 0 ? i : 5;
}

/**
 * Hand order for the high-trump cluster (left side of the hand):
 *   Rook, then the red bird (Red 2), then special Red 1, then called trump high→low.
 */
function displayHighTrumpScore(card) {
  if (!card) return -1;
  const rookLow = (typeof rookLowest !== 'undefined' && rookLowest);
  if (isRookCard(card)) return rookLow ? -1 : 400;
  if (typeof isRed2 === 'function' ? isRed2(card) : card.id === 'red-2') return 300;
  if (typeof isRed1 === 'function' && isRed1(card)) return 200;
  const trump = (game && game.trump) || null;
  if (trump && card.color === trump) return effectiveRank(card);
  return -1;
}

/**
 * One comparator for every visible pile (hand, nest merge, discard rows, kitty flash).
 * Rook then red bird on the left. Other cards by color, high → low.
 */
function compareCardsDisplay(a, b) {
  const sa = displayHighTrumpScore(a);
  const sb = displayHighTrumpScore(b);
  const aHigh = sa >= 0;
  const bHigh = sb >= 0;
  if (aHigh !== bHigh) return aHigh ? -1 : 1;
  if (aHigh && bHigh && sa !== sb) return sb - sa;

  const mode = normalizeHandSortMode(handSortMode);
  if (mode === 'rank') {
    const d = effectiveRank(b) - effectiveRank(a);
    if (d) return d;
    return displayColorGroup(a) - displayColorGroup(b);
  }
  if (mode === 'counters') {
    const d = cardPoints(b) - cardPoints(a);
    if (d) return d;
  }

  const ca = displayColorGroup(a);
  const cb = displayColorGroup(b);
  if (ca !== cb) return ca - cb;
  const ra = effectiveRank(a);
  const rb = effectiveRank(b);
  return mode === 'color-low' ? (ra - rb) : (rb - ra);
}

function sortCardsDisplay(arr) {
  if (!arr || !arr.sort) return arr;
  arr.sort(compareCardsDisplay);
  return arr;
}

function sortMyHandInPlace() {
  if (!game || !game.myHand) return;
  sortCardsDisplay(game.myHand);
}

function cardLegalClass(card, hand) {
  if (!game || !card) return '';
  try {
    return canPlay(card, hand || game.myHand || [], game.ledColor, game.trump) ? 'playable' : 'disabled';
  } catch (e) {
    return '';
  }
}

function renderHand(discardMode = false, opts = {}) {
  const handEl = $('myHand');
  if (!game || !game.myHand) {
    if (handEl) handEl.innerHTML = '';
    return;
  }
  const skipSort = !!(opts && opts.skipSort);
  const dealIn = !!(opts && opts.dealIn);
  if (!discardMode && !skipSort) sortMyHandInPlace();
  const isMyTurn = game.phase === 'play' && game.currentPlayer === myIndex;
  // Reveal presentation only: retain the original dealt hand beneath the six
  // Kitty cards. The authoritative merged hand remains intact for discard.
  const reveal = isPortraitViewport() && game.phase === 'discard'
    && $('discardOverlay')?.classList.contains('gh-kitty-page')
    && !$('discardOverlay')?.classList.contains('hidden');
  const kittyIds = new Set((game.kittyTaken || game.nestPreview || []).map(c => String(c.id)));
  const displayedHand = reveal ? game.myHand.filter(c => !kittyIds.has(String(c.id))) : game.myHand;
  const n = displayedHand.length;
  const markedHand739 = !discardMode && isPortraitViewport() && game.phase === 'play';
  const boundary739 = markedHand739 ? window.HORTrumpHand739?.boundary(displayedHand) ?? -1 : -1;
  const handMarkup041 = displayedHand.map((card, idx) => {
    let extra = '';
    if (discardMode) {
      const sid = String(card.id);
      extra = window.selectedForDiscard?.has(sid) ? 'selected' : 'playable';
    } else if (isMyTurn) {
      extra = cardLegalClass(card, game.myHand);
    }
    if (dealIn && idx === n - 1) extra = (extra + ' deal-in').trim();
    let cls = card.color === 'rook' ? 'rook' : card.color;
    if (isRed2(card) && includeRed2) cls = 'red2 red2-art';
    else if (isRed2(card)) cls = 'red';
    if (isRed1(card)) cls = 'red1';
    const trump = isCurrentTrump(card);
    if (trump) cls += ' is-trump';
    const hideStar = (isRed2(card) && includeRed2) || (card.color === 'rook' || card.id === 'rook');
    const marking739 = markedHand739 ? window.HORTrumpHand739?.markup(card) || '' : '';
    if (marking739) cls += ' trump-mark739';
    if (idx === boundary739) cls += ' trump-boundary739';
    const tag = markedHand739 ? marking739 : (trump && !hideStar) ? '<span class="c-trump-tag" aria-label="trump">★</span>' : '';
    return `<div class="card-face ${cls} ${extra}" data-id="${card.id}">${cardInnerHTML(card)}${tag}</div>`;
  }).join('');
  if (isPortraitViewport() && !discardMode) reconcileHand041(handEl, handMarkup041);
  else handEl.innerHTML = handMarkup041;

  try {
    const lt = $('ltHand');
    if (lt) {
      lt.innerHTML = handEl.innerHTML;
      if (discardMode) {
        lt.querySelectorAll('.card-face').forEach(el => {
          el.onclick = (ev) => {
            ev.preventDefault();
            const id = String(el.dataset.id);
            if (!window.selectedForDiscard) window.selectedForDiscard = new Set();
            const needed = game.discardCount || 5;
            if (window.selectedForDiscard.has(id)) {
              window.selectedForDiscard.delete(id);
              el.classList.remove('selected');
              try { playDiscardToggleSfx(true); } catch (err) {}
            } else if (window.selectedForDiscard.size < needed) {
              window.selectedForDiscard.add(id);
              el.classList.add('selected');
              try { playDiscardToggleSfx(false); } catch (err) {}
            }
            try { showDiscardUI(false); } catch (e) {}
          };
        });
      }
    }
  } catch (e) {}

  // Fit immediately, then again after layout so clientWidth is accurate
  fitHandToScreen();
  requestAnimationFrame(() => {
    fitHandToScreen();
    setTimeout(fitHandToScreen, 50);
  });

  // click handlers
  handEl.querySelectorAll('.card-face').forEach(el => {
    el.onclick = (ev) => {
      ev.preventDefault();
      const id = String(el.dataset.id);
      if (discardMode) {
        if (!window.selectedForDiscard) window.selectedForDiscard = new Set();
        const needed = game.discardCount || 5;
        // Normalize set to strings
        if (window.selectedForDiscard.has(id)) {
          window.selectedForDiscard.delete(id);
          el.classList.remove('selected');
          try { playDiscardToggleSfx(true); } catch (err) {}
        } else if (window.selectedForDiscard.size < needed) {
          window.selectedForDiscard.add(id);
          el.classList.add('selected');
          try { playDiscardToggleSfx(false); } catch (err) {}
        }
        const btn = $('confirmDiscard');
        if (btn) {
          btn.textContent = `Confirm Discard (${window.selectedForDiscard.size}/${needed})`;
          btn.disabled = window.selectedForDiscard.size !== needed;
        }
      } else if (game.phase === 'play' && !isSpectator) {
        // Only plays the card if it's actually this player's turn.
        playCardIfMyTurn(id);
      }
    };
  });
}

// Keep hand fitted on rotate / resize
function onViewportChange() {
  try {
    fitHandToScreen();
    const ov = $('discardOverlay');
    if (ov && !ov.classList.contains('hidden') && game && game.phase === 'discard' && game.bidder === myIndex) {
      ov.classList.toggle('landscape-discard-overlay', isLandscapeNow());
      // Re-layout the same picker in the new orientation. Do not replay kitty.
      try { showDiscardUI(false); } catch (e) {}
    }
    if (typeof fitDiscardOverlayCards === 'function') fitDiscardOverlayCards();
    try { relocateClaimLaydownLayer(); } catch (e) {}
    try { placeActionPanelAboveSeat(); } catch (e) {}
    try {
      if (game && game.phase === 'trump' && game.bidder === myIndex && !isSpectator) showTrumpUI();
      else if (game && game.phase === 'bidding' && game.currentPlayer === myIndex && !isSpectator && typeof showBidUI === 'function') showBidUI();
      else if (game && game.phase === 'play' && game.trumpClaimPlayer === myIndex && typeof showAllTrumpsClaimUI === 'function') showAllTrumpsClaimUI();
    } catch (e) {}
    setTimeout(() => {
      try {
        fitHandToScreen();
        if (typeof fitDiscardOverlayCards === 'function') fitDiscardOverlayCards();
        relocateClaimLaydownLayer();
        if (game && game.phase === 'trump' && game.bidder === myIndex && !isSpectator) showTrumpUI();
        else if (game && game.phase === 'bidding' && game.currentPlayer === myIndex && !isSpectator && typeof showBidUI === 'function') showBidUI();
        else if (game && game.phase === 'play' && game.trumpClaimPlayer === myIndex && typeof showAllTrumpsClaimUI === 'function') showAllTrumpsClaimUI();
      } catch (e) {}
    }, 200);
  } catch (e) {}
}
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);
window.addEventListener('orientationchange', () => { setTimeout(syncLandscapeFullscreen, 120); });
window.addEventListener('resize', () => { setTimeout(syncLandscapeFullscreen, 120); });
document.addEventListener('pointerdown', () => {
  if (wantLandscapeFullscreen()) enterLandscapeFullscreen();
}, { passive: true });
document.addEventListener('fullscreenchange', syncBrowserFitBtn);


function hideActionPanel() {
  const panel = $('actionPanel');
  if (panel) {
    panel.classList.add('hidden');
    panel.classList.remove('bid-panel', 'trump-claim-panel', 'lt-floating-panel');
    panel.innerHTML = '';
    try { restoreActionPanelHome(); } catch (e) {}
  }
  const dock = $('decisionConsole');
  if (dock) {
    dock.classList.add('hidden');
    dock.innerHTML = '';
  }
  const bar = $('ltBidBar');
  if (bar) bar.classList.add('hidden');
  const felt = $('ltFeltBid');
  if (felt) felt.classList.add('hidden');
}

function clearClaimOverlays() {
  try { hideActionPanel(); } catch (e) {}
  window._claimAnimPlaying = false;
  if (window._claimAnimFadeTimer) {
    try { clearTimeout(window._claimAnimFadeTimer); } catch (e) {}
    window._claimAnimFadeTimer = null;
  }
  if (window._claimAnimRemoveTimer) {
    try { clearTimeout(window._claimAnimRemoveTimer); } catch (e) {}
    window._claimAnimRemoveTimer = null;
  }
  try {
    const lay = $('claimLaydownLayer');
    if (lay && lay.parentNode) lay.parentNode.removeChild(lay);
  } catch (e) {}
  try {
    const modal = $('trumpShowdownModal');
    if (modal) modal.classList.add('hidden');
  } catch (e) {}
}

// ========== Bot AI ==========
function isBotTurn() {
  if (!isHost || !game) return false;
  if (game.resolvingTrick) return false;
  if (game.paused) return false;
  if (game.phase === 'bidding' || game.phase === 'play') {
    return !!players[game.currentPlayer]?.isBot;
  }
  if (game.phase === 'discard' || game.phase === 'trump') {
    return !!players[game.bidder]?.isBot;
  }
  return false;
}

let botTimer = null;
let botDue063 = 0;
function positionBotThinkingAtSeat(statusElement, statusIndex){
  try{
    const el=statusElement instanceof HTMLElement?statusElement:$('botThinking'); if(!el||el.classList.contains('hidden')||!game)return;
    if (positionBidTurn034(el)) return;
    if (window.HORCharacterStudio077?.positionStatus(el, statusIndex)) return;
    const idx=Number.isInteger(statusIndex)?statusIndex:((game.phase==='discard'||game.phase==='trump')?game.bidder:game.currentPlayer);
    const sid=typeof seatSlotIdForIndex==='function'?seatSlotIdForIndex(idx):null, slot=sid?$(sid):null;
    if(!slot)return;
    const av=slot.querySelector('.seat-avatar,.seat-avatar-side'); if(!av)return;
    if(el.parentNode!==slot) slot.appendChild(el);
    el.dataset.side=sid||'';
    const sr=slot.getBoundingClientRect(), ar=av.getBoundingClientRect();
    const sx=sr.width/Math.max(1,slot.offsetWidth||sr.width), sy=sr.height/Math.max(1,slot.offsetHeight||sr.height);
    const cx=(ar.left+ar.width/2-sr.left)/Math.max(.01,sx);
    let top=(ar.top-sr.top)/Math.max(.01,sy)-4;
    const lead=slot.querySelector(':scope > .seat-lead-tag:not(.hidden)');
    if(lead){
      const lr=lead.getBoundingClientRect();
      if(lr.width>0&&lr.height>0) top=Math.min(top,(lr.top-sr.top)/Math.max(.01,sy)-4);
    }
    el.style.cssText='';
    el.style.setProperty('position','absolute','important');
    el.style.setProperty('left',cx+'px','important');
    el.style.setProperty('right','auto','important');
    el.style.setProperty('top',top+'px','important');
    el.style.setProperty('bottom','auto','important');
    el.style.setProperty('transform','translate(-50%,-100%)','important');
    el.style.setProperty('margin','0','important');
    el.style.setProperty('z-index','300','important');
    el.style.setProperty('pointer-events','none','important');
  }catch(e){}
}
function syncHumanTurnStatus(){
  const el=$('botThinking');
  if(el?.dataset.humanTurn==='1'){el.dataset.humanTurn='0';el.classList.add('hidden');}
  try { window.HORHolderCues789?.sync(game,myIndex,isSpectator); } catch (_) {}
}

function setBotThinking(on) {
  if(game?.phase==='bidding'&&isPortraitViewport()&&window.HORUnifiedBidding752){window.HORUnifiedBidding752.position();return;}
  const el = $('botThinking');
  if (!el) return;
  const waitPhase = !!(game && (game.phase === 'discard' || game.phase === 'trump') && game.bidder !== myIndex);
  if (waitPhase) {
    el.textContent = game.phase === 'discard' ? 'Sorting…' : 'Picking trump…';
    el.classList.remove('hidden');
    requestAnimationFrame(positionBotThinkingAtSeat);
    setTimeout(positionBotThinkingAtSeat, 80);
    setTimeout(positionBotThinkingAtSeat, 220);
    return;
  }
  if (on) {
    el.textContent = 'Thinking…';
    el.classList.remove('hidden');
    requestAnimationFrame(positionBotThinkingAtSeat);
    setTimeout(positionBotThinkingAtSeat, 80);
    setTimeout(positionBotThinkingAtSeat, 220);
  } else {
    el.classList.add('hidden');
    el.dataset.humanTurn='0';
    syncHumanTurnStatus();
  }
}
/** Human-like thinking delay (ms). Longer on hard decisions / harder difficulty. */
function humanThinkDelay() {
  const phase = game?.phase || 'play';
  // Base range by difficulty
  let lo, hi;
  if (botDifficulty === 'easy') { lo = 600; hi = 1600; }
  else if (botDifficulty === 'hard') { lo = 1100; hi = 2800; }
  else if (botDifficulty === 'extreme') { lo = 900; hi = 2600; }
  else { lo = 800; hi = 2200; } // normal

  // Bidding: a little extra thought
  if (phase === 'bidding') { lo += 200; hi += 600; }

  // Nest + trump: they just picked up extra cards. Sit with the hand.
  if (phase === 'discard') {
    lo = 2800; hi = 7200;
    if (botDifficulty === 'easy') { lo = 1800; hi = 4800; }
    if (botDifficulty === 'hard' || botDifficulty === 'extreme') { lo = 3200; hi = 8600; }
  }
  if (phase === 'trump') {
    lo = 1600; hi = 4800;
    if (botDifficulty === 'easy') { lo = 1100; hi = 3200; }
    if (botDifficulty === 'hard' || botDifficulty === 'extreme') { lo = 2000; hi = 5600; }
  }

  // Sometimes "hesitate" longer (human pause)
  let delay = lo + Math.random() * (hi - lo);
  if (phase === 'discard' || phase === 'trump') {
    if (Math.random() < 0.28) delay += 700 + Math.random() * 1800;
    if (Math.random() < 0.08) delay += 1200 + Math.random() * 2200;
  } else {
    if (Math.random() < 0.18) delay += 400 + Math.random() * 900;
    if (Math.random() < 0.06) delay += 800 + Math.random() * 1200;
  }

  // Speed setting (#18)
  const mult = botSpeed === 'blitz' ? 0.35 : botSpeed === 'slow' ? 1.85 : 1;
  const cap=phase==='discard'?4500:phase==='trump'?3000:phase==='bidding'?2500:3200;
  return solScaledDelay(Math.max(120, Math.min(cap,Math.round(delay * mult))), 140);
}

function scheduleBot() {
  if (!isBotTurn()) return;
  if (window.horTourBlocking) {
    window.horTourResumeBot = true;
    return;
  }
  if (botTimer) {
    clearTimeout(botTimer);
    botTimer = null;
  }
  setBotThinking(true);
  const delay = humanThinkDelay();
  botDue063=Date.now()+delay;

  botTimer = setTimeout(() => {
    botTimer = null;
    setBotThinking(false);
    if (!isBotTurn()) return;
    try {
      runBotAction();
    } catch (e) {
      console.error('Bot error:', e);
      setTimeout(() => {
        if (isBotTurn()) {
          try { runBotAction(); } catch (e2) { console.error('Bot retry failed:', e2); }
        }
      }, 1200);
    }
  }, delay);
}

// Mobile browsers can suspend a background page for long periods. If its
// one-shot bot timer was already consumed while the turn remained current,
// re-arm only that missing timer when the page returns to the foreground.
function horRecoverForegroundBotTurn() {
  try {
    if (document.hidden || !game || !isHost || game.paused || game.resolvingTrick) return;
    if (window.horTourBlocking) return;
    if (isBotTurn() && (!botTimer || Date.now()>botDue063+1000)) scheduleBot();
  } catch (e) {
    console.warn('Could not restore the active bot turn after resume:', e);
  }
}

let horForegroundRecoveryQueued = false;
function queueHorForegroundBotRecovery() {
  if (horForegroundRecoveryQueued) return;
  horForegroundRecoveryQueued = true;
  setTimeout(() => {
    horForegroundRecoveryQueued = false;
    horRecoverForegroundBotTurn();
  }, 0);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) queueHorForegroundBotRecovery();
});
window.addEventListener('pageshow', queueHorForegroundBotRecovery);
window.addEventListener('focus', queueHorForegroundBotRecovery);
window.addEventListener('orientationchange', () => {
  setTimeout(queueHorForegroundBotRecovery, 150);
});

// 071: orientation-independent bidding bot-timer recovery.
// The existing recovery was only triggered by foreground/orientation events.
// During a visible, hosted bot bidding turn, check for a missing/overdue
// timer without changing bidding rules or directly placing a bid.
// A normal pending timer is never disturbed before its due time + 4s.
setInterval(() => {
  try {
    if (document.hidden || !game || !isHost || game.phase !== 'bidding' ||
        game.paused || game.resolvingTrick || window.horTourBlocking) return;
    if (!isBotTurn()) return;
    if (botTimer && Date.now() <= botDue063 + 4000) return;
    console.warn('[071] Recovering stalled bidding bot timer', {
      currentPlayer: game.currentPlayer, hadTimer: !!botTimer
    });
    horRecoverForegroundBotTurn();
  } catch (e) { console.warn('[071] Bidding watchdog error', e); }
}, 2000);



function runBotAction() {
  if (!game || !isHost || game.resolvingTrick || game.claimAnimating) return;
  if (window.horTourBlocking) {
    window.horTourResumeBot = true;
    return;
  }
  const actor = (game.phase === 'discard' || game.phase === 'trump') ? game.bidder : game.currentPlayer;
  const prevDiff = botDifficulty;
  try {

  if (game.phase === 'bidding' && players[game.currentPlayer]?.isBot) {
    botBid();
  } else if (game.phase === 'discard' && players[game.bidder]?.isBot) {
    botDiscard();
  } else if (game.phase === 'trump' && players[game.bidder]?.isBot) {
    botChooseTrump();
  } else if (game.phase === 'play' && players[game.currentPlayer]?.isBot) {
    const claim = getRestClaimInfo();
    if (claim && claim.seat === game.currentPlayer) {
      hostProcessAllTrumpsClaim({ player: claim.seat });
      return;
    }
    botPlay();
  }
  } finally {
    botDifficulty = prevDiff;
  }
}


/** Analyze suit distribution — length, high cards, voids (Rook strategy). */
function analyzeHand(hand) {
  const byColor = { green: [], red: [], yellow: [], black: [] };
  let rook = null, red1 = null, red2 = null;
  hand.forEach(c => {
    if (c.color === 'rook') rook = c;
    else if (isRed1(c)) red1 = c;
    else if (isRed2(c)) red2 = c;
    else if (byColor[c.color]) byColor[c.color].push(c);
  });
  const suitScores = {};
  COLORS.forEach(col => {
    const cards = byColor[col];
    let score = cards.length * 12;
    cards.forEach(c => {
      if (c.rank === 1 || (onesHigh && c.rank === 1)) score += 28;
      else if (c.rank === 14) score += 22;
      else if (c.rank === 13) score += 12;
      else if (c.rank === 12) score += 8;
      else if (c.rank === 10) score += 14;
      else if (c.rank === 5) score += 6;
      else score += Math.max(0, c.rank - 8);
    });
    suitScores[col] = score;
  });
  const voids = COLORS.filter(c => byColor[c].length === 0).length;
  const shorts = COLORS.filter(c => byColor[c].length <= 1).length;
  return { byColor, suitScores, rook, red1, red2, voids, shorts };
}

function bestTrumpColor(hand) {
  const a = analyzeHand(hand);
  let best = COLORS[0], bestScore = -1;
  COLORS.forEach(col => {
    if (a.suitScores[col] > bestScore) {
      bestScore = a.suitScores[col];
      best = col;
    }
  });
  return best;
}

/** Estimate counters this hand can capture if it names best trump. */
function estimateHandValue(hand) {
  const a = analyzeHand(hand);
  const trump = bestTrumpColor(hand);
  let val = 0;
  if (a.rook) val += rookLowest ? 12 : 22;
  if (a.red1) val += 28;
  if (a.red2) val += 18;
  const trumpCards = a.byColor[trump] || [];
  val += trumpCards.length * 6;
  trumpCards.forEach(c => {
    if (c.rank >= 12) val += 8;
    if (c.rank === 10 || c.rank === 14 || c.rank === 5 || c.rank === 1) val += cardPoints(c) * 0.6;
  });
  // Voids = ruffing power
  val += a.voids * 8 + Math.max(0, a.shorts - 1) * 4;
  // Off-suit counters (defensive value)
  COLORS.filter(c => c !== trump).forEach(col => {
    (a.byColor[col] || []).forEach(c => {
      const p = cardPoints(c);
      if (p) val += p * 0.35;
    });
  });
  return { value: val, trump, analysis: a };
}

function botPersonaStyle(idx) {
  return (players[idx] && players[idx].botStyle) || 'balanced';
}

function applyStyleToBid(style, value, bid, floor, ceiling, nextMin, highest) {
  if (style === 'randomish') {
    if (Math.random() < 0.22) return 0;
    if (highest < floor && Math.random() < 0.7) return floor;
    return nextMin <= ceiling && Math.random() < 0.35 ? nextMin : 0;
  }
  if (style === 'passive') {
    if (highest >= floor + 20) return 0;
    return value >= floor - 5 ? (highest < floor ? floor : nextMin <= ceiling ? nextMin : 0) : 0;
  }
  if (style === 'safe') {
    if (bid > 0 && value < highest + 8) return 0;
    if (bid > floor && bid > value + 5) return 0;
    return bid;
  }
  if (style === 'bidHappy') {
    if (highest < floor) return floor;
    if (nextMin <= ceiling && value + 25 >= nextMin) return nextMin;
    return bid;
  }
  if (style === 'aggressive') {
    if (highest < floor && value >= floor - 30) return floor;
    if (nextMin <= ceiling && value + 18 >= nextMin) return Math.min(ceiling, nextMin + (value >= 80 ? 10 : 0));
    return bid;
  }
  if (style === 'partnerFirst') {
    return bid;
  }
  if (style === 'pointHungry' || style === 'trumpHeavy' || style === 'rookHunter' || style === 'showboat') {
    if (highest < floor && value >= floor - 25) return floor;
    return bid;
  }
  if (style === 'sandbag') {
    if (highest >= floor) return 0;
    return value >= floor + 30 ? floor : 0;
  }
  if (style === 'countSaver' || style === 'lastTrick' || style === 'leadLong') {
    if (bid > 0 && value < highest + 15) return 0;
    return bid;
  }
  return bid;
}

function styleTrumpColor(hand, style) {
  const counts = {};
  COLORS.forEach(c => { counts[c] = 0; });
  (hand || []).forEach(c => {
    if (c && counts[c.color] != null) counts[c.color] += 1 + (c.rank >= 12 ? 1 : 0);
  });
  const ranked = COLORS.slice().sort((a, b) => counts[b] - counts[a]);
  if (style === 'tricky' && ranked[1] && counts[ranked[1]] >= 2 && Math.random() < 0.4) return ranked[1];
  if (style === 'voidMaker' && ranked[0]) return ranked[0];
  return ranked[0] || bestTrumpColor(hand);
}

function pickStyledCard(idx, legal) {
  const style = botPersonaStyle(idx);
  if (!legal || !legal.length || style === 'balanced') return null;
  const partnerIdx = (idx + 2) % 4;
  const winner = currentTrickWinner();
  const partnerWinning = !!(winner && winner.player === partnerIdx);
  const pts = trickPointsSoFar();
  const trump = game.trump;
  const leading = !game.ledColor;
  const beaters = winner
    ? legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) > 0)
    : [];
  const low = (arr) => {
    const a = (arr && arr.length) ? arr : legal;
    return a.slice().sort((x, y) => cardPoints(x) - cardPoints(y) || effectiveRank(x) - effectiveRank(y))[0];
  };
  const high = (arr) => {
    const a = (arr && arr.length) ? arr : legal;
    return a.slice().sort((x, y) => cardPoints(y) - cardPoints(x) || effectiveRank(y) - effectiveRank(x))[0];
  };
  const noPts = legal.filter(c => !cardPoints(c));
  const trumps = legal.filter(c => c.color === trump || (typeof isPermanentTrump === 'function' && isPermanentTrump(c)));
  const off = legal.filter(c => c.color !== trump && !(typeof isPermanentTrump === 'function' && isPermanentTrump(c)));

  if (style === 'randomish') return legal[Math.floor(Math.random() * legal.length)];

  if (style === 'partnerFirst') {
    if (partnerWinning && winner) {
      const safe = legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) <= 0);
      const pool = safe.length ? safe : legal;
      if (game.trick.length === 3) return pool.slice().sort((a, b) => cardPoints(b) - cardPoints(a))[0];
      return low(pool.filter(c => !cardPoints(c)).length ? pool.filter(c => !cardPoints(c)) : pool);
    }
    if (leading) return low(noPts.length ? noPts : off.length ? off : legal);
    if (beaters.length && pts >= 10) return low(beaters);
    return low(noPts.length ? noPts : legal);
  }

  if (style === 'passive' || style === 'safe') {
    if (leading) return low(noPts.length ? noPts : legal);
    if (partnerWinning) return low(noPts.length ? noPts : legal);
    const need = style === 'safe' ? 15 : 20;
    if (pts >= need && beaters.length) return low(beaters);
    return low(noPts.length ? noPts : legal);
  }

  if (style === 'aggressive') {
    if (leading) return high(trumps.length && Math.random() < 0.6 ? trumps : legal);
    if (beaters.length) return high(beaters);
    return high(legal);
  }

  if (style === 'bidHappy') {
    if (!leading && beaters.length && pts >= 5) return low(beaters);
    if (leading) return high(off.length ? off : legal);
    return low(noPts.length ? noPts : legal);
  }

  if (style === 'pointHungry') {
    if (!leading && beaters.length && pts >= 5) return high(beaters);
    if (leading) {
      const fat = legal.filter(c => cardPoints(c) >= 10);
      if (fat.length) return high(fat);
    }
    if (!leading && !beaters.length) return low(noPts.length ? noPts : legal);
    return high(legal);
  }

  if (style === 'trumpHeavy') {
    if (leading && trumps.length) {
      const plain = trumps.filter(c => c.color === trump && c.color !== 'rook');
      return high(plain.length ? plain : trumps);
    }
    if (!leading && beaters.length) {
      const tBeat = beaters.filter(c => c.color === trump || (typeof isPermanentTrump === 'function' && isPermanentTrump(c)));
      if (tBeat.length && pts >= 5) return low(tBeat);
      if (pts >= 10) return low(beaters);
    }
    return low(noPts.length ? noPts : legal);
  }

  if (style === 'voidMaker') {
    const groups = COLORS.map(col => legal.filter(c => c.color === col)).filter(g => g.length);
    groups.sort((a, b) => a.length - b.length);
    if (leading && groups[0] && groups[0][0].color !== trump) return low(groups[0]);
    if (!leading && !beaters.length) {
      const short = groups[0] || legal;
      return low(short);
    }
    return null;
  }

  if (style === 'countSaver') {
    if (partnerWinning) return high(legal.filter(c => cardPoints(c)).length && game.trick.length === 3 ? legal.filter(c => cardPoints(c)) : noPts.length ? noPts : legal);
    if (!leading && !beaters.length) return low(noPts.length ? noPts : legal);
    if (!leading && beaters.length && pts >= 10) return low(beaters);
    return low(noPts.length ? noPts : legal);
  }
  if (style === 'leadLong') {
    const groups = COLORS.map(col => legal.filter(c => c.color === col)).filter(g => g.length);
    groups.sort((a, b) => b.length - a.length);
    if (leading && groups[0]) return high(groups[0]);
    return null;
  }
  if (style === 'showboat') {
    if (leading) return high(legal);
    if (beaters.length) return high(beaters);
    return high(legal);
  }
  if (style === 'rookHunter') {
    const bird = legal.filter(c => c.color === 'rook' || (c.special && String(c.special).indexOf('rook') >= 0) || c.rank === 'rook');
    const specials = legal.filter(c => (typeof isRed2 === 'function' && isRed2(c)) || (typeof isRed1 === 'function' && isRed1(c)) || c.color === 'rook');
    if (!leading && beaters.length && (specials.length || pts >= 15)) return high(specials.length ? specials : beaters);
    if (leading && specials.length && Math.random() < 0.45) return specials[0];
    return null;
  }
  if (style === 'lastTrick') {
    const left = (game.hands || []).reduce((n, h) => n + ((h && h.length) || 0), 0);
    if (left <= 8 && trumps.length) return leading ? high(trumps) : (beaters.length ? high(beaters.filter(c => c.color === trump).length ? beaters.filter(c => c.color === trump) : beaters) : low(noPts.length ? noPts : legal));
    if (leading) return low(off.length ? off : legal);
    return low(noPts.length ? noPts : legal);
  }
  if (style === 'sandbag') {
    if (leading) return low(noPts.length ? noPts : legal);
    if (pts >= 15 && beaters.length) return low(beaters);
    return low(noPts.length ? noPts : legal);
  }

  if (style === 'tricky') {
    if (leading) {
      const mid = legal.filter(c => !cardPoints(c) && effectiveRank(c) >= 8);
      if (mid.length) return mid[Math.floor(Math.random() * mid.length)];
      return legal[Math.min(legal.length - 1, Math.floor(legal.length / 2))];
    }
    if (partnerWinning && pts >= 10 && game.trick.length === 3 && winner) {
      const feed = legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) <= 0);
      if (feed.length) return feed.sort((a, b) => cardPoints(b) - cardPoints(a))[0];
    }
    if (!partnerWinning && beaters.length && Math.random() < 0.5) return low(beaters);
    return null;
  }

  return null;
}



function cycleHandSort() {
  const order = ['color-high', 'color-low', 'rank', 'counters'];
  const cur = normalizeHandSortMode(handSortMode);
  handSortMode = order[(order.indexOf(cur) + 1) % order.length];
  persistHandSortMode();
  const hsm = $('opt-hand-sort');
  if (hsm) hsm.value = handSortMode;
  if (!game || !game.myHand) return;
  sortMyHand();
  renderHand(game.phase === 'discard' && game.bidder === myIndex);
  const labels = {
    'color-high': 'color, high to low',
    'color-low': 'color, low to high',
    'rank': 'rank',
    'counters': 'counters first'
  };
  const msg = $('messageArea');
  if (msg) msg.textContent = `Hand sorted by ${labels[handSortMode] || handSortMode}`;
}

function sortMyHand() {
  if (!game || !game.myHand) return;
  sortMyHandInPlace();
  if (isHost && myIndex >= 0) game.hands[myIndex] = game.myHand;
}

function drawQr(code) {
  const link = joinLink(code);
  const line = $('joinLinkLine');
  if (line) {
    if (link && /^https?:/i.test(link)) {
      line.innerHTML = '<a class="join-site-link" href="' + escapeHtmlSafe(link) +
        '" target="_blank" rel="noopener">' + escapeHtmlSafe(link) + '</a>';
    } else {
      line.textContent = link || '';
    }
  }
  const img = $('qrImg');
  const canvas = $('qrCanvas');
  if (img && link && /^https?:/i.test(link)) {
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=4&color=000000&bgcolor=ffffff&data=' + encodeURIComponent(link);
    img.classList.remove('hidden');
    if (canvas) canvas.style.display = 'none';
    img.onerror = () => {
      img.classList.add('hidden');
      if (canvas) canvas.style.display = '';
    };
  } else if (img) {
    img.classList.add('hidden');
    if (canvas) canvas.style.display = '';
  }
  if (!canvas || typeof code !== 'string') return;
  // Fallback mark if the real QR image cannot load
  const ctx = canvas.getContext('2d');
  const size = 160;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1a120b';
  ctx.fillRect(8, 8, size - 16, 8);
  ctx.fillRect(8, size - 16, size - 16, 8);
  ctx.fillRect(8, 8, 8, size - 16);
  ctx.fillRect(size - 16, 8, 8, size - 16);
  [[16, 16], [size - 48, 16], [16, size - 48]].forEach(([x, y]) => {
    ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y + 6, 20, 20);
    ctx.fillStyle = '#1a120b';
    ctx.fillRect(x + 11, y + 11, 10, 10);
  });
  ctx.font = 'bold 22px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText(code, size / 2, size / 2 + 8);
}

function copyRoomCode() {
  const code = roomCode || ($('displayCode') && $('displayCode').textContent);
  if (!code) return;
  const hosted = canShareJoinQr();
  const text = hosted ? joinLink(code) : String(code);
  const done = () => {
    const st = $('waitingStatus');
    if (st) st.textContent = hosted ? 'Join link copied!' : 'Code copied!';
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      fallbackCopy(text);
      done();
    });
  } else {
    fallbackCopy(text);
    done();
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

function shareRoomText(code, url) {
  const site = String(url || '').trim();
  return 'Sit at my House of Rooks table.\nCode: ' + String(code || '') +
    (site ? ('\n\n' + site) : '');
}

function shareRoom() {
  const code = roomCode || '';
  const url = canShareJoinQr() ? joinLink(code) : '';
  const text = url
    ? shareRoomText(code, url)
    : ('Sit at my House of Rooks table.\nCode: ' + code + '\n\nOpen House of Rooks on your phone, tap Join with a code, type that code. Do not open a file link.');
  const canShare = typeof navigator.share === 'function';
  const go = () => {
    fallbackCopy(text);
    const st = $('waitingStatus');
    if (st) st.textContent = url
      ? 'Join link copied — paste it so the website is tappable.'
      : 'Code copied. Guest opens House of Rooks on their phone and types this code. Do not send a file link.';
  };
  if (canShare) {
    const payload = { title: 'House of Rooks', text };
    // Keep url in the payload for apps that use it, but the raw https
    // line in `text` is what SMS/Messages/WhatsApp turn into a tap target.
    if (/^https?:/i.test(url)) payload.url = url;
    navigator.share(payload).catch((err) => {
      if (err && err.name === 'AbortError') return;
      go();
    });
  } else {
    go();
  }
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
}

function wantLandscapeFullscreen() {
  try {
    if (!document.body || !document.body.classList.contains('in-game')) return false;
    if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) return true;
  } catch (e) {}
  return false;
}

function enterLandscapeFullscreen() {
  if (!wantLandscapeFullscreen()) return;
  try {
    if (!fullscreenElement()) {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen || el.msRequestFullscreen;
      if (req) {
        const p = req.call(el);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    }
  } catch (e) {}
  try {
    if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock();
    }
  } catch (e) {}
}

function exitLandscapeFullscreen() {
  if (wantLandscapeFullscreen()) return;
  try {
    if (fullscreenElement()) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (ex) {
        const p = ex.call(document);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    }
  } catch (e) {}
}

function syncLandscapeFullscreen() {
  if (wantLandscapeFullscreen()) enterLandscapeFullscreen();
  else exitLandscapeFullscreen();
}

function syncBrowserFitBtn() {
  const bar = document.getElementById('btnFullscreen');
  const on = !!(fullscreenElement() || (document.body && document.body.classList.contains('page-fit')));
  document.querySelectorAll('.browser-fit-btn').forEach((btn) => {
    btn.classList.remove('hidden');
    btn.textContent = on ? '↙' : '⛶';
    btn.title = on ? 'Minimize screen' : 'Full size';
    btn.setAttribute('aria-label', on ? 'Minimize screen' : 'Full size');
    btn.classList.toggle('is-full', on);
  });
  if (bar) {
    bar.title = on ? 'Minimize screen' : 'Full size';
    bar.textContent = on ? '↙' : '⛶';
  }
  try { document.body.classList.toggle('is-fullscreen', on); } catch (e) {}
}

function toggleFullscreen() {
  try { document.body.classList.toggle('page-fit'); } catch (e) {}
  syncBrowserFitBtn();
}

function hostDealPerfectHand() {
  if (!isHost || !game) return;
  if (!isHostOnlyHuman() || !experimentalHandOpt) {
    alert('Experimental hand is only available when you are the only human player and the option is enabled.');
    return;
  }
  if (game.phase === 'play' && game.trick && game.trick.length) {
    alert('Finish the current trick first');
    return;
  }
  if (!confirm('Deal an experimental testing hand to the host? It always includes the Bird plus one full color (and Red 2 if that card is on).')) return;

  // Fresh deck, then force-seed the Bird so it cannot be dropped by option flags.
  includeRook = true;
  try { const cbRook = $('opt-include-rook'); if (cbRook) cbRook.checked = true; } catch (e) {}
  const deck = makeDeck().slice();
  let rookCard = deck.find(c => c && (c.id === 'rook' || c.color === 'rook'));
  if (!rookCard) {
    rookCard = { color: 'rook', rank: 99, id: 'rook' };
    deck.push(rookCard);
  }
  const red2Card = includeRed2
    ? deck.find(c => c && (c.id === 'red-2' || (typeof isRed2 === 'function' && isRed2(c))))
    : null;

  const used = new Set();
  const specialCards = [];
  specialCards.push(rookCard);
  used.add(rookCard.id);
  if (red2Card && !used.has(red2Card.id)) {
    specialCards.push(red2Card);
    used.add(red2Card.id);
  }

  const testColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const colorCards = deck.filter(c => c && c.color === testColor && !used.has(c.id) && c.id !== 'red-2');
  const extra = includeRed2 && red2Card ? ', Rook + Red 2' : ', Rook';
  const normalHandSize = handSize || 10;
  const colorSlots = Math.max(0, normalHandSize - specialCards.length);
  if (colorCards.length < colorSlots) {
    alert('Experimental hand could not be created with the current deck settings.');
    return;
  }

  shuffle(colorCards);
  const perfect = shuffle(specialCards.concat(colorCards.slice(0, colorSlots)));
  if (!perfect.some(c => c && (c.id === 'rook' || c.color === 'rook'))) {
    if (perfect.length) perfect[perfect.length - 1] = rookCard;
    else perfect.push(rookCard);
  }
  const perfectIds = new Set(perfect.map(c => c.id));
  const rest = deck.filter(c => !perfectIds.has(c.id));

  recentTricks = [];
  lastCompletedTrick = null;
  lastCompletedTrickWinner = null;
  game.nest = [];
  game.hands = [[], [], [], []];
  const hostSeat = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
  game.hands[hostSeat] = perfect.slice();
  for (let i = 0; i < 4; i++) {
    if (i === hostSeat) continue;
    game.hands[i] = rest.splice(0, normalHandSize);
  }
  game.nest = rest.slice();
  game.hands.forEach(h => sortCardsDisplay(h));
  try { freezeTopNestCard(); } catch (e) { game.topNestCard = null; }
  try { applyForcedNestReveal(); } catch (e) {}
  knownVoids = [{}, {}, {}, {}];
  lastTurnIndex = -1;
  window._turnOppKey = '';
  window._lastTurnBeepKey = '';
  lastTrickLen = 0;
  game.currentPlayer = firstActorSeat(game.dealer);
  game.passCount = 0;
  game.highestBid = (minBid || 70) - 5;
  game.bidder = -1;
  game.bid = 0;
  game.shotTheMoon = false;
  game.trump = null;
  game.bidStatus = [null, null, null, null];
  game.phase = 'dealing';
  game.players = publicPlayersSnapshot(); // Refresh seats before dealing, rather than after it.
  game.myHand = (myIndex === 0) ? game.hands[0].slice() : (game.hands[myIndex] || []).slice();
  game.claimDeclined = false;
  game.claimAnimation = null;
  game.claimAnimating = false;
  game.trumpClaimPlayer = null;
  game.claimRevealHands = null;
  try { clearClaimOverlays(); } catch (e) {}
  showGame();
  broadcast({ type: 'message', text: `🧪 Experimental hand: ${testColor}${extra}.` });
  broadcastState();
  const presented = (game.hands[myIndex] || []).map(c => ({ ...c }));
  runDealPresentation(presented, () => {
    if (!game) return;
    game.phase = 'bidding';
    game.myHand = (game.hands[myIndex] || []).slice();
    broadcastState();
    try { hostPromptBid(); } catch (e) {}
  });
}

function hostRedeal() {
  if (!isHost || !game) return;
  if (game.phase === 'play' && game.trick && game.trick.length) {
    alert('Finish the current trick first');
    return;
  }
  if (!confirm('Redeal this hand?')) return;
  hostDeal();
}



// Hook bot into the prompt / phase-change functions
// (hostPromptPlay already calls scheduleBot itself)
const _origPromptBid = hostPromptBid;
hostPromptBid = function() {
  _origPromptBid();
  scheduleBot();
};

const _origFinishBidding = finishBidding;
finishBidding = function() {
  _origFinishBidding();
  scheduleBot();
};

const _origProcessTrump = hostProcessTrump;
hostProcessTrump = function(data) {
  _origProcessTrump(data);
  // hostProcessTrump ends with hostPromptPlay which schedules bots
};

const _origProcessDiscard = hostProcessDiscard;
hostProcessDiscard = function(data) {
  _origProcessDiscard(data);
  scheduleBot();
};



// ========== Event listeners ==========
function bindClick(id, fn) {
  const el = $(id);
  if (el) el.onclick = fn;
}

document.addEventListener('pointerdown', () => { ensureAudio(); }, { once: false });

bindClick('createBtn', () => {
  try {
    ensureAudio();
    isSpectator = false;
    createRoom();
    saveSession();
  } catch (e) {
    console.error(e);
    const s = $('lobbyStatus');
    if (s) s.textContent = 'Error: ' + e.message;
  }
});

bindClick('rejoinBtn', () => {
  const name = ($('hor-player-name') && $('hor-player-name').value || '').trim();
  if (!name) { alert('Enter the same name you used before'); return; }
  myName = name;
  try {
    const sess = loadSession();
    const codeEl = $('hor-room-code');
    if (codeEl && !(codeEl.value || '').trim() && sess && sess.roomCode) codeEl.value = sess.roomCode;
  } catch (e) {}
  joinRoom();
});
function setLobbyJoining(on) {
  const lobbyEl = $('lobby');
  const f = $('joinForm');
  if (lobbyEl) lobbyEl.classList.toggle('joining', !!on);
  if (f) f.classList.toggle('hidden', !on);
  if (on) {
    const input = $('hor-room-code');
    if (input) {
      try {
        input.focus({ preventScroll: true });
        input.select();
        // The fixed entrance already fits the viewport; scrolling shifts its scene.
        if (!lobbyEl?.classList.contains('landing783')) input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (e) {
        try { input.focus(); } catch (e2) {}
      }
    }
  }
}
bindClick('joinBtn', () => {
  setLobbyJoining(true);
});
bindClick('joinCancelBtn', () => {
  if (joinInProgress) horCancelLobbyOperation043();
  setLobbyJoining(false);
  const st = $('lobbyStatus');
  if (st && /table|connecting|join/i.test(st.textContent || '')) st.textContent = '';
});
bindClick('joinConfirmBtn', () => {
  try {
    isSpectator = false;
    joinRoom();
    saveSession();
  } catch (e) {
    console.error(e);
    setJoinStatus('Error: ' + e.message);
  }
});
bindClick('spectateBtn', () => {
  try {
    isSpectator = true;
    joinRoom();
    saveSession();
  } catch (e) {
    console.error(e);
  }
});
bindClick('welcomeWatchBtn', () => welcomeJoin(true));
bindClick('welcomeLobbyBtn', () => {
  if (peer || hostConnection) {
    try { sessionStorage.removeItem('rookSession'); } catch (e) {}
    location.reload();
    return;
  }
  hideWelcomeScreen();
  if (lobby) lobby.classList.remove('hidden');
  try { document.body.classList.remove('at-table'); } catch (e) {}
  const form = $('joinForm');
  if (form) form.classList.remove('hidden');
  const nameIn = $('welcome-player-name');
  const lobbyName = $('hor-player-name');
  if (nameIn && lobbyName && nameIn.value) lobbyName.value = nameIn.value;
});
(function bindWelcomeSeats() {
  for (let s = 0; s < 4; s++) {
    const el = $('welcomeSeat' + s);
    if (!el) continue;
    el.onclick = ((seat) => () => {
      // Human selecting an empty lobby seat gets the low "doooop" cue.
      // Bot seating continues to use playSitSound() separately.
      try { playLobbySeatClickSound(); } catch (e) {}
      welcomeJoin(false, seat);
    })(s);
  }
  const nameIn = $('welcome-player-name');
  if (nameIn) {
    nameIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Go' || e.key === 'Done') {
        e.preventDefault();
        const name = (nameIn.value || '').trim();
        dismissJoinKeyboard();
        setJoinStatus(name
          ? 'Name saved. Now tap the empty seat you want.'
          : 'Type your name, then tap an empty seat.');
      }
    });
  }
})();
bindClick('startBtn', () => {
  try {
    if (isHost) startGameWithToast();
  } catch (e) {
    console.error(e);
    alert('Start game error: ' + e.message);
  }
});

/** Offline practice: local host + 3 bots, no PeerJS / room code required */
function startSoloPractice() {
  if(!validateRuleSetup())return false;
  horCancelLobbyOperation043();
  teardownMultiplayerBeforeLobby();
  forgetRoomSession043();
  window._horIntentionalLeave = false;
  try {
    // Rook506: Offline owns the transition. Cancel any stale multiplayer retry
    // activity before creating the local table so the first press is decisive.
    window._horNoServiceStop = true;
    try {
      (window._horNetRetryTimers || []).forEach((t) => clearTimeout(t));
    } catch (e) {}
    window._horNetRetryTimers = [];
    joinInProgress = false;

    ensureAudio();
    isSpectator = false;
    isSoloPractice = true;
    window._horStayInGame = true;
    try { document.body.classList.add('offline-play', 'in-game'); } catch (e) {}
    isHost = true;
    try { if (peer && peer.destroy) peer.destroy(); } catch (e) {}
    peer = null;
    hostConnection = null;
    try { if (typeof connMap === 'object') Object.keys(connMap).forEach(k => delete connMap[k]); } catch (e) {}

    myName = (($('hor-player-name') && $('hor-player-name').value) || '').trim() || myName || 'You';
    myPeerId = 'solo-' + Math.random().toString(36).slice(2, 9);
    roomCode = 'OFFLINE';
    players = [{ id: myPeerId, name: myName, team: 0, isHost: true, isBot: false, seat: 0, avatar: ensurePreferredAvatar() || AVATARS[0], voice: loadPreferredVoice(), careerPublic: horMyCareerProfile() }];
    applyPreferredAvatarToMe();

    // 3 named persona bots (no network)
    while (players.length < 4) { const seat=firstEmptySeat(); addBot(seat, window.HORLanding783?.rosterForStart()?.[seat-1]?.name); }
    balanceTeams();
    myIndex = players.findIndex(p => p.id === myPeerId);
    if (myIndex < 0) myIndex = 0;

    try { if (typeof recomputeHandAndNest === 'function') recomputeHandAndNest(); } catch (e) {}

    // Hide lobby/waiting, show game
    try { lobby && lobby.classList.add('hidden'); } catch (e) {}
    try { waiting && waiting.classList.add('hidden'); } catch (e) {}
    try { hideWelcomeScreen(); } catch (e) {}
    showGame();
    updatePracticeBadge();

    // Seat bots on 1/2/3 explicitly so the deal cannot abort.
    try {
      [1, 2, 3].forEach((s) => {
        if (!playerAtSeat(s)) addBot(s);
      });
    } catch (e) {}

    try { hostStartGame(); } catch (e) { console.error(e); }
    try { lobby && lobby.classList.add('hidden'); } catch (e) {}
    try { showGame(); } catch (e) {}

    const note = $('messageArea');
    if (note) note.textContent = 'Offline practice — you vs 3 bots. Bots only use public info.';
    try { syncSoloHostExtrasUI(); } catch (e) {}
  } catch (e) {
    console.error(e);
    alert('Offline practice error: ' + e.message);
  }
}

function updatePracticeBadge() {
  const rb = $('restartPracticeBtn');
  if (rb) {
    if (isSoloPractice) rb.classList.remove('hidden');
    else rb.classList.add('hidden');
  }
}

/** Start another offline hand/match without returning to lobby */
function restartSoloPractice() {
  if (!isSoloPractice) return startSoloPractice();
  try {
    // Keep same seat / bots / rules
    myIndex = players.findIndex(p => p.id === myPeerId);
    if (myIndex < 0) myIndex = 0;
    hostStartGame();
    const note = $('messageArea');
    if (note) note.textContent = 'New offline practice game started.';
  } catch (e) {
    console.error(e);
    startSoloPractice();
  }
}

bindClick('soloPracticeBtn', startSoloPractice);
bindClick('restartPracticeBtn', restartSoloPractice);
try { bindNoServiceModal(); } catch (e) {}
window.addEventListener('offline', () => {
  try {
    if (isSoloPractice || roomCode === 'OFFLINE') return;
    // A browser "offline" event is advisory on mobile. Never tear down or
    // replace a live/recovering multiplayer table because of it.
    if (horClientIsPlaying() || (hostConnection && hostConnection.open)) return;
    if (!isHost && (!game || !game.phase || ['lobby','waiting',''].includes(game.phase))) offerOfflinePlay();
  } catch (e) {}
});
window.addEventListener('online', () => {
  window._horNoServiceStop = false;
});
bindClick('leaveReplaceBtn', () => { try { clientLeaveReplace(); } catch (e) { console.error(e); } });
(function wireBotStyleLongPress() {
  let timer=0,armedName='',shown=false,startX=0,startY=0;
  const cancel=()=>{if(timer){clearTimeout(timer);timer=0;}armedName='';};
  const sourceName=(el)=>{
    // Career stars own their gesture completely. Never let a tap/hold on ★ fall
    // through to the persona long-press handler.
    if(el&&el.closest&&el.closest('.hor-career-badge'))return '';
    const tagged=el&&el.closest&&el.closest('[data-botname]');
    return tagged?(tagged.getAttribute('data-botname')||''):'';
  };
  const arm=(target,x,y)=>{const name=sourceName(target);shown=false;if(!name){cancel();return;}cancel();armedName=name;startX=Number(x)||0;startY=Number(y)||0;timer=setTimeout(()=>{timer=0;shown=true;showBotStyleTip(armedName,{clientX:startX||24,clientY:startY||24,preventDefault(){},stopPropagation(){}});},480);};
  document.addEventListener('pointerdown',(e)=>arm(e.target,e.clientX,e.clientY),{passive:true});
  document.addEventListener('pointerup',cancel,{passive:true});
  document.addEventListener('pointercancel',cancel,{passive:true});
  document.addEventListener('pointermove',(e)=>{if(timer&&(Math.abs((Number(e.clientX)||0)-startX)+Math.abs((Number(e.clientY)||0)-startY)>14))cancel();},{passive:true});
  document.addEventListener('touchstart',(e)=>{const t=e.touches&&e.touches[0];if(t)arm(e.target,t.clientX,t.clientY);},{passive:true});
  document.addEventListener('touchend',cancel,{passive:true});
  document.addEventListener('touchcancel',cancel,{passive:true});
  document.addEventListener('touchmove',(e)=>{if(!timer)return;const t=e.touches&&e.touches[0];if(t&&(Math.abs(t.clientX-startX)+Math.abs(t.clientY-startY)>14))cancel();},{passive:true});
  document.addEventListener('contextmenu',(e)=>{const tagged=e.target&&e.target.closest&&e.target.closest('[data-botname]');if(!tagged)return;e.preventDefault();e.stopPropagation();const name=tagged.getAttribute('data-botname')||'';if(name)showBotStyleTip(name,e);},true);
  document.addEventListener('pointerdown',(e)=>{if(e.target&&e.target.closest&&e.target.closest('.bot-style-tip-close')){e.preventDefault();hideBotStyleTip();return;}const tip=$('botStyleTip');if(tip&&!tip.classList.contains('hidden')&&!(e.target&&e.target.closest&&e.target.closest('#botStyleTip'))&&!sourceName(e.target))hideBotStyleTip();},true);
  document.addEventListener('click',(e)=>{if(shown){e.preventDefault();e.stopPropagation();shown=false;}},true);
})();;
bindClick('botPickerClose', closeBotPicker);
const _botPickModal = $('botPickerModal');
if (_botPickModal) _botPickModal.addEventListener('click', (e) => { if (e.target === _botPickModal) closeBotPicker(); });
function teardownMultiplayerBeforeLobby() {
  window.HORBidVoice801?.stop();
  horCancelLobbyOperation043();
  // Rook520: an intentional Leave is final.  Mark it before closing PeerJS so
  // disconnect/error callbacks cannot recreate a session while teardown runs.
  window._horIntentionalLeave = true;
  // Rook506: Leave must fully release the old room before the lobby reloads.
  // This prevents a stale/reconnecting PeerJS session from racing the next
  // Play Offline press.
  window._horNoServiceStop = true;
  window._horStayInGame = false;
  horMarkActiveTable(false);
  try {
    (window._horNetRetryTimers || []).forEach((t) => clearTimeout(t));
  } catch (e) {}
  window._horNetRetryTimers = [];

  try {
    if (hostConnection) {
      try { hostConnection.close(); } catch (e) {}
    }
  } catch (e) {}
  hostConnection = null;

  try {
    if (typeof connMap === 'object' && connMap) {
      Object.keys(connMap).forEach((k) => {
        try { if (connMap[k] && connMap[k].close) connMap[k].close(); } catch (e) {}
        try { delete connMap[k]; } catch (e) {}
      });
    }
  } catch (e) {}

  try {
    if (peer) {
      try { if (peer.disconnect) peer.disconnect(); } catch (e) {}
      try { if (peer.destroy) peer.destroy(); } catch (e) {}
    }
  } catch (e) {}
  peer = null;

  isHost = false;
  isSpectator = false;
  isSoloPractice = false;
  joinInProgress = false;
  myPeerId = null;
  myIndex = -1;
  roomCode = '';
  players = [];
  game = null;
}

bindClick('leaveBtn', leaveTableToLobby043);
bindClick('showRules', () => {
  try { showVariantRules(); } catch (e) {}
  if (rulesModal) rulesModal.classList.remove('hidden');
});
bindClick('closeRules', () => { if (rulesModal) rulesModal.classList.add('hidden'); });
bindClick('btnRulesInGame', () => {
  try { showVariantRules(); } catch (e) {}
  if (rulesModal) rulesModal.classList.remove('hidden');
});
bindClick('toggleMuteLobby', toggleMute);
(function showAppVersionTag() {
  const el = $('appVersionTag');
  if (el) el.textContent = 'v' + APP_VERSION;
})();
bindClick('btnForceRefreshLobby', () => {
  // Manual escape hatch: clears this device's cached app files/service
  // worker (not names, career progress, or table settings) and reloads the latest
  // deployed version. For when a device is stuck on stale cached code that
  // the automatic version-mismatch check hasn't caught yet.
  const ok = window.confirm('This will clear this app\'s cached files on this device and reload. Your name, career progress, and settings are kept. Continue?');
  if (ok) horForceUpdate();
});
bindClick('btnMute', toggleMute);
bindClick('btnStats', showStatsModal);
try { wireTargetScoreUI(); } catch (e) {}
bindClick('ltTabTrick', () => setLandscapeTab(false));
bindClick('ltTabLast5', () => setLandscapeTab(true));


bindClick('closeStats', () => { const m = $('statsModal'); if (m) m.classList.add('hidden'); });
bindClick('btnTransferHost', hostTransferHost);
applyA11y();

// Always bind the in-game Game Options Done button from the global event-listener setup.
// Do not rely on the waiting-room renderer to wire this control: Offline Practice and
// active games can use the modal after the waiting screen has been hidden.
bindClick('closeHostOptionsBtn', (e) => {
  if (e) e.preventDefault();
  closeHostOptionsModal();
});

function syncQuickMenuSound(){
  const st=$('menuSoundQuickState'); if(st) st.textContent = soundMuted ? 'Muted' : 'On';
  const b=$('menuSoundQuick'); if(b) b.classList.toggle('is-muted',!!soundMuted);
}
bindClick('menuSoundQuick',()=>{ const b=$('btnMute'); if(b)b.click(); setTimeout(syncQuickMenuSound,0); });
bindClick('menuStatsQuick',()=>{ closeHostOptionsModal(); const b=$('btnStats'); if(b)b.click(); });
bindClick('menuRulesQuick',()=>{ closeHostOptionsModal(); const b=$('btnRulesInGame'); if(b)b.click(); });

bindClick('btnGameOptions', () => {
  try {
    const modal = $('hostOptionsModal');
    if (!modal) { console.error('Game options modal missing from DOM'); return; }
    openHostOptionsModal();
  } catch (e) { console.error('Game options open failed:', e); }
});

// Build 461: add Game options to the first-page utility row while preserving
// every existing Game options entrance elsewhere.
(function addLobbyGameOptionsButton() {
  const lobby = $('lobby');
  if (!lobby || $('btnGameOptionsLobby')) return;
  const row = lobby.querySelector('.rules-link');
  if (!row) return;
  const btn = document.createElement('button');
  btn.id = 'btnGameOptionsLobby';
  btn.type = 'button';
  btn.className = 'btn link';
  btn.textContent = '⚙️ Game options';
  // Keep the first page compact: reuse its existing wrapping utility row.
  const sound = $('toggleMuteLobby');
  if (sound && sound.parentNode === row) row.insertBefore(btn, sound);
  else row.appendChild(btn);
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    try { openHostOptionsModal(); }
    catch (err) { console.error('Lobby game options open failed:', err); }
  });
})();

bindClick('btnToggleTopOpts', () => {
  // Portrait: the collapsed top bar is hidden; use the existing menu owner.
  // Keep the inherited landscape toggle path exactly as it was in R710.
  if (window.matchMedia('(orientation: portrait)').matches) {
    const menu = $('hostOptionsModal');
    if (menu && !menu.classList.contains('hidden')) closeHostOptionsModal();
    else openHostOptionsModal();
    return;
  }
  const bar = $('topBar');
  const btn = $('btnToggleTopOpts');
  if (!bar) return;
  const collapsed = bar.classList.toggle('opts-collapsed');
  if (btn) {
    btn.textContent = collapsed ? '☰' : '✕';
    btn.title = collapsed ? 'Show options' : 'Hide options';
  }
  try { localStorage.setItem('rookTopOptsCollapsed', collapsed ? '1' : '0'); } catch (e) {}
});
(function restoreTopOpts() {
  try {
    if (localStorage.getItem('rookTopOptsCollapsed') === '1') {
      const bar = $('topBar');
      const btn = $('btnToggleTopOpts');
      if (bar) bar.classList.add('opts-collapsed');
      if (btn) { btn.textContent = '☰'; btn.title = 'Show options'; }
    }
  } catch (e) {}
})();
bindClick('btnSort', cycleHandSort);

bindClick('btnFullscreen', toggleFullscreen);
bindClick('browserFitBtn', toggleFullscreen);
bindClick('browserFitBtn2', toggleFullscreen);
['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'].forEach((ev) => {
  document.addEventListener(ev, syncBrowserFitBtn);
});
syncBrowserFitBtn();
setTimeout(syncBrowserFitBtn, 300);
bindClick('btnPause', () => {
  if (typeof houseConfirm === 'function' && game && !game.paused) {
    houseConfirm({ title: 'Pause the table?', body: 'Everyone waits until you resume.', danger: false }).then((ok) => {
      if (ok) hostTogglePause();
    });
    return;
  }
  hostTogglePause();
});
bindClick('btnResumePause', () => { if (isHost && game && game.paused) hostTogglePause(); });
bindClick('btnRedeal', hostRedeal);
bindClick('btnPerfectDeal', hostDealPerfectHand);
bindClick('btnUndo', () => {
  if (lastPlaySnapshot && lastPlaySnapshot.fromHuman) return;
  hostUndoLastPlay();
});
bindClick('copyCodeBtn', copyRoomCode);
bindClick('shareBtn', shareRoom);
function setQrOpen(open) {
  const box = $('qrBox');
  const btn = $('showQrBtn');
  if (!box) return;
  if (open) {
    try { document.body.appendChild(box); } catch (e) {}
    box.classList.remove('hidden');
    document.body.classList.add('qr-open');
    if (btn) btn.textContent = 'Close QR';
    drawQr(roomCode);
  } else {
    box.classList.add('hidden');
    document.body.classList.remove('qr-open');
    if (btn) btn.textContent = 'QR';
  }
}
bindClick('showQrBtn', () => {
  if (!canShareJoinQr()) {
    try { applyWaitingShareMode(); } catch (e) {}
    const st = $('waitingStatus');
    if (st) st.textContent = 'QR is off on Wi‑Fi. Friends join with the 4-letter code on their own phone.';
    return;
  }
  const box = $('qrBox');
  if (!box) return;
  setQrOpen(box.classList.contains('hidden'));
});
bindClick('closeQrBtn', () => setQrOpen(false));
function openHandHistory(opts) {
  if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) return;
  const fromScore = !!(opts && opts.fromScoreboard);
  const modal = $('historyModal');
  const body = $('historyBody');
  if (!modal || !body) return;
  try { document.body.appendChild(modal); } catch (e) {}
  modal.classList.toggle('from-scoreboard', fromScore);
  if (!handHistory.length) {
    body.innerHTML = '<p class="option-hint">No hands played yet.</p>';
  } else {
    const teamAName = statTeamName(0), teamBName = statTeamName(1);
    body.innerHTML = handHistory.map((h, i) => `
      <article class="history-item">
        <div class="history-hand-head"><span class="history-hand-no">Hand ${i + 1}</span><span class="history-result ${h.made ? 'made' : 'set'}">${h.made ? 'Bid made' : 'Bid set'}</span></div>
        <div class="history-grid">
          <div class="history-field"><span>Bid</span><b>${h.bid}</b></div>
          <div class="history-field"><span>Bidder team</span><b>${esc(h.bidderTeam === 0 ? teamAName : teamBName)}</b></div>
          <div class="history-field"><span>Trump</span><b>${COLOR_NAMES[h.trump] || h.trump || '—'}</b></div>
          <div class="history-field"><span>Hand score</span><b>${esc(teamAName)} ${h.pointsA} · ${esc(teamBName)} ${h.pointsB}</b></div>
          <div class="history-running"><span>Match score</span><span>${esc(teamAName)} ${h.scores[0]} · ${esc(teamBName)} ${h.scores[1]}</span></div>
        </div>
      </article>
    `).join('');
  }
  modal.classList.remove('hidden');
}
function closeHandHistory() {
  const hm = $('historyModal');
  if (!hm) return;
  const fromScore = hm.classList.contains('from-scoreboard');
  hm.classList.add('hidden');
  hm.classList.remove('from-scoreboard');
  if (fromScore) {
    const score = $('scoreModal');
    const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
    if (!landscape && score) score.classList.remove('hidden');
  }
}
bindClick('btnHistory', () => openHandHistory());
bindClick('closeHistory', () => closeHandHistory());
bindClick('winOk', () => { try { startMatchCelebration(); } catch (e) { console.error(e); } });
bindClick('celeRematch', () => { try { requestRematch(); } catch (e) { console.error(e); } });
bindClick('celeWaiting', () => { try { requestWaitingRoom(); } catch (e) { console.error(e); } });

// Rook594 — unattended diagnostic navigation for SOL BOT mode.
// Captures each continuation screen before advancing it. It never chooses bids/trump/cards here.
let horDiagNavSeen='';
function horDiagBotNavigate(){
  if(!horSolBotActive || !isHost) return;
  const visible=id=>{const e=$(id);return e&&!e.classList.contains('hidden')&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';};
  let key='', btn=null;
  if(visible('winOverlay')){ key='match-win'; btn=$('winOk'); }
  else if(visible('celePage') && $('celeActions') && !$('celeActions').classList.contains('hidden')){ key='match-celebration'; btn=(typeof window.__ghAutoTestShouldRematch==='function'&&!window.__ghAutoTestShouldRematch())?null:$('celeRematch'); }
  else if(visible('scoreModal')){ key='hand-score'; btn=$('scoreModalNext'); }
  else if(visible('trumpShowdown')){ key='trump-showdown'; btn=$('trumpShowdownClose'); }
  if(key && key!==horDiagNavSeen){
    horDiagNavSeen=key;
    try{ if(window.HORSolDiagnostics) window.HORSolDiagnostics.snap('bot-screen-before-click',{screen:key}); }catch(e){}
    setTimeout(()=>{ try{ if(horSolBotActive && btn && !btn.disabled) btn.click(); }catch(e){} },solScaledDelay(650,120));
    return;
  }
  if(!key) horDiagNavSeen='';
  // Surface unknown blocking overlays instead of hanging silently.
  const blockers=[...document.querySelectorAll('.modal:not(.hidden), .overlay:not(.hidden), [role="dialog"]:not(.hidden)')]
    .filter(e=>!['scoreModal','winOverlay','hostOptionsModal','historyModal'].includes(e.id));
  if(blockers.length){ const u='unknown:'+blockers.map(e=>e.id||e.className).join('|'); if(u!==horDiagNavSeen){horDiagNavSeen=u;try{if(window.HORSolDiagnostics)window.HORSolDiagnostics.snap('UNHANDLED SCREEN',{screen:u});}catch(e){}} }
}
setInterval(horDiagBotNavigate,900);

(function initFromUrl() {
  try {
    const warn = $('localCopyWarn');
    if (warn) warn.classList.toggle('hidden', isHostedHttp());
    const params = new URLSearchParams(location.search);
    const r = (params.get('room') || params.get('code') || '').trim().toUpperCase();
    if (r) {
      const input = $('hor-room-code');
      if (input) input.value = r;
      roomCode = r;
      setLobbyJoining(true);
      const status = $('lobbyStatus');
      if (status) status.textContent = 'Table ' + r + ' — enter your name and tap Take Your Seat.';
      try {
        const sess = loadSession();
        if (sess && sess.myName) {
          const lobbyName = $('hor-player-name');
          if (lobbyName && !lobbyName.value) lobbyName.value = sess.myName;
          const welcomeName = $('welcome-player-name');
          if (welcomeName && !welcomeName.value) welcomeName.value = sess.myName;
        }
      } catch (e2) {}
      // Only the hosted website can safely open the invite welcome.
      // A file/Files-app link is what guests were seeing as a "broken page".
      if (isHostedHttp()) {
        showWelcomeScreen(r);
        showInviteSplash();
      }
    }
  } catch (e) {}
})();

(function initReconnect() {
  const sess = loadSession();
  const rejoin = $('rejoinBtn');
  const hasRejoin = !!(sess && sess.roomCode && sess.roomCode !== 'OFFLINE');
  if (rejoin) rejoin.classList.toggle('hidden', !hasRejoin);
  if (hasRejoin && horExpOn('lobbyReconnect')) {
    const box = $('reconnectBox');
    if (box) {
      box.classList.remove('hidden');
      const c = $('reconnectCode');
      if (c) c.textContent = sess.roomCode;
    }
    bindClick('reconnectBtn', () => {
      const nameInput = $('hor-player-name');
      if (nameInput && sess.myName) nameInput.value = sess.myName;
      const codeInput = $('hor-room-code');
      if (codeInput) codeInput.value = sess.roomCode;
      isSpectator = !!sess.isSpectator;
      const form = $('joinForm');
      if (form) form.classList.remove('hidden');
      joinRoom();
    });
  }
})();

function normalizeCardBackId(id) {
  return CARD_BACKS.some(b => b.id === id) ? id : 'griffin';
}

function applyCardBack(id, persist) {
  cardBackId = normalizeCardBackId(id);
  document.body.classList.remove(...CARD_BACK_CLASSES);
  document.body.classList.add('cardback-' + cardBackId);
  if (persist !== false) {
    try { localStorage.setItem('rookCardBack', cardBackId); } catch (e) {}
  }

}

(function initPrefs() {
  const t = parseInt(localStorage.getItem('rookTheme') || '0', 10);
  themeIndex = isNaN(t) ? 0 : t % THEMES.length;
  document.body.classList.remove(...THEMES);
  document.body.classList.add(THEMES[themeIndex]);
  try { cardBackId = normalizeCardBackId(localStorage.getItem('rookCardBack') || 'griffin'); } catch (e) { cardBackId = 'griffin'; }
  applyCardBack(cardBackId, false);
  updateMuteButtons();
})();

window.submitBid = submitBid;
window.submitTrump = submitTrump;
window.submitDiscard = submitDiscard;
window.submitPlay = submitPlay;
window.hideDiscardOverlay = hideDiscardOverlay;

/** Guarantee difficulty options include Extreme (fixes stale DOM / cache). */
function ensureBotDifficultyOptions() {
  const wanted = [
    ['easy', 'Easy'],
    ['normal', 'Normal'],
    ['hard', 'Hard'],
    ['extreme', 'Extreme'],
  ];
  ['opt-bot-difficulty', 'opt-bot-difficulty-ingame'].forEach((id) => {
    const bd = $(id);
    if (!bd) return;
    const have = new Set(Array.from(bd.options).map(o => o.value));
    wanted.forEach(([val, label]) => {
      let opt = Array.from(bd.options).find(o => o.value === val);
      if (!opt && !have.has(val)) {
        opt = document.createElement('option');
        opt.value = val;
        bd.appendChild(opt);
      }
      if (opt) opt.textContent = label;
    });
  });
}
ensureBotDifficultyOptions();
setTimeout(ensureBotDifficultyOptions, 200);
setTimeout(ensureBotDifficultyOptions, 1000);


// PWA install lives in index.html so the lobby button works even if game.js is cached stale.
// Service worker registration lives in index.html (single source of truth —
// having it here too caused duplicate/conflicting registrations).

// Landscape theater: nest reveal and table view

// Landscape theater: show who played what when phone is rotated
/** Coach tip + card ids that justify the tip (for landscape highlight). */
function coachBidAdvice(hand, g) {
  const empty = { text: 'Wait for the deal.', highlightIds: [] };
  if (!hand || !hand.length) return empty;
  try {
    const a = analyzeHand(hand);
    const trump = bestTrumpColor(hand);
    const trumpCards = (a.byColor && a.byColor[trump]) || [];
    const len = trumpCards.length;
    const markers = [a.rook, a.red1, a.red2, len >= 5, a.voids >= 1].filter(Boolean).length;
    const partnerSeat = (typeof myIndex === 'number' && myIndex >= 0) ? ((myIndex + 2) % 4) : -1;
    const partnerHasBid = g && g.bidder === partnerSeat && g.highestBid > 0;
    const bid = (g && g.highestBid) || 0;

    const ids = new Set();
    const mark = (c) => { if (c && c.id != null) ids.add(String(c.id)); };
    // Always surface permanent specials + trump length when relevant
    hand.forEach((c) => {
      if (c.color === 'rook' || c.id === 'rook') mark(c);
      if (typeof isRed1 === 'function' && isRed1(c)) mark(c);
      if (typeof isRed2 === 'function' && isRed2(c)) mark(c);
    });
    // High trump: 1, 14, 13, 12, 10, 5
    trumpCards.forEach((c) => {
      const r = c.rank;
      if (r === 1 || r === 14 || r === 13 || r === 12 || r === 10 || r === 5) mark(c);
    });
    // If long trump is the story, highlight the whole trump suit
    if (len >= 5) trumpCards.forEach(mark);

    let text;
    if (partnerHasBid && dontStealPartnerBid !== false) {
      text = (len >= 6 && a.rook)
        ? 'Power hand — only raise partner if you can take over trump.'
        : 'Partner owns the auction. Pass and support.';
      if (!(len >= 6 && a.rook)) {
        // Soft hand under partner: only highlight specials, not weak trump
        ids.clear();
        hand.forEach((c) => {
          if (c.color === 'rook' || c.id === 'rook') mark(c);
          if (typeof isRed1 === 'function' && isRed1(c)) mark(c);
          if (typeof isRed2 === 'function' && isRed2(c)) mark(c);
        });
      }
    } else if (len >= 6 && (a.rook || a.red1)) {
      text = 'Long trump + tops. Open or raise; 110–125 is live.';
    } else if (markers >= 3) {
      text = '3+ strength markers. Contest from the floor; don’t sell cheap.';
    } else if (bid >= 120 && len < 5) {
      text = 'Auction is rich. Pass unless you have length.';
      ids.clear();
      hand.forEach((c) => {
        if (c.color === 'rook' || c.id === 'rook') mark(c);
        if (typeof isRed1 === 'function' && isRed1(c)) mark(c);
        if (typeof isRed2 === 'function' && isRed2(c)) mark(c);
      });
    } else if (len >= 5 && a.voids) {
      text = 'Shape is real. A 100–110 probe is reasonable.';
    } else if (a.rook && (a.red2 || a.red1)) {
      text = 'Rook plus a high special — you can open near 100.';
    } else if (len <= 3 && !a.rook) {
      text = 'Flat hand. Pass and defend.';
      ids.clear();
    } else {
      text = 'Stay disciplined: raise only with length or two tops.';
    }
    return { text, highlightIds: Array.from(ids) };
  } catch (e) {
    return { text: 'Stay disciplined at the table.', highlightIds: [] };
  }
}

function updateLandscapeBidHint() {
  let el = document.getElementById('ghBidHint');
  if (el) el.remove();
  return null;
}

function updateLandscapeTheater() {
  const endEl = $('ltEndGame');
  const endSummary = landscapeLastSummary;
  const isLandscape = window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
  if (endEl) {
    const goal = (game && game.targetScore) || targetScore || 500;
    const isScore = !!(game && game.phase === 'score');
    const scores = endSummary && Array.isArray(endSummary.scores)
      ? endSummary.scores
      : (game && game.scores ? game.scores : [0, 0]);
    const isGameOver = isMatchOver(scores, goal);
    if (isLandscape && isScore && endSummary) {
      const winnerTeam = scores[0] === scores[1] ? 'Tie' : (scores[0] > scores[1] ? 'Team A' : 'Team B');
      const nestCards = Array.isArray(endSummary.nestCards) ? endSummary.nestCards : [];
      const revealHands = Array.isArray(endSummary.claimRevealHands) ? endSummary.claimRevealHands : [];
      const hasReveal = revealHands.some(h => Array.isArray(h.cards));
      const showRemain = !!(window._ltShowRemaining && hasReveal);
      if (showRemain) {
        endEl.classList.add('hidden');
        endEl.innerHTML = '';
      } else {
        endEl.innerHTML = `
          <div class="lt-endgame-banner ${endSummary.made ? 'made' : 'set'}">
            <div class="lt-endgame-title">${isGameOver ? '🏆 FINAL SCORE' : (endSummary.made ? '✅ BID MADE!' : '❌ SET!')}</div>
            <div class="lt-endgame-scores">
              <div class="${endSummary.made ? (endSummary.bidderTeam === 0 ? 'lt-hand-winner' : '') : (endSummary.bidderTeam === 1 ? 'lt-hand-winner' : '')}"><span>Team A</span><b>${scores[0]}</b><small>${endSummary.scoreDeltaA >= 0 ? '+' : ''}${endSummary.scoreDeltaA || 0} this hand</small></div>
              <div class="lt-endgame-vs">${winnerTeam === 'Tie' ? 'TIE' : 'VS'}</div>
              <div class="${endSummary.made ? (endSummary.bidderTeam === 1 ? 'lt-hand-winner' : '') : (endSummary.bidderTeam === 0 ? 'lt-hand-winner' : '')}"><span>Team B</span><b>${scores[1]}</b><small>${endSummary.scoreDeltaB >= 0 ? '+' : ''}${endSummary.scoreDeltaB || 0} this hand</small></div>
            </div>
            <div class="lt-hand-winner-banner">${endSummary.made
              ? `Team ${endSummary.bidderTeam === 0 ? 'A' : 'B'} wins the hand — bid made`
              : `Team ${endSummary.bidderTeam === 0 ? 'B' : 'A'} wins the hand — bid set`}</div>
            <div class="lt-endgame-detail">Bid ${endSummary.bid} · Trump ${COLOR_NAMES[endSummary.trump] || endSummary.trump || '—'} · A ${endSummary.pointsA} pts · B ${endSummary.pointsB} pts</div>
            ${nestCards.length ? `<div class="lt-endgame-nest"><span>Nest — ${endSummary.nestWinnerName || 'Winner'}${endSummary.nestPts ? ' · ' + endSummary.nestPts + ' pts' : ''}</span><div>${nestCards.map(c => `<span class="lt-endgame-nest-card">${nestCardMarkup(c)}</span>`).join('')}</div></div>` : ''}
            <div class="lt-endgame-actions">
              <span>${isGameOver ? 'Game complete' : 'Hand complete'}</span>
              ${hasReveal ? `<button type="button" id="ltScoreReveal" class="btn">Show remaining cards</button>` : ''}
              ${isGameOver ? '' : `<button type="button" id="ltScoreNext" class="btn primary">Next Hand</button>`}
            </div>
          </div>`;
      }
      if (!showRemain) endEl.classList.remove('hidden');
      const next = $('ltScoreNext');
      if (next) {
        next.onclick = () => {
          if (isHost) {
            try { hostStartNextHand(); } catch (e) { console.error(e); }
          } else {
            next.disabled = true;
            next.textContent = 'Waiting for host…';
          }
        };
      }
      const reveal = $('ltScoreReveal');
      if (reveal) {
        reveal.onclick = () => {
          window._ltShowRemaining = true;
          try { updateLandscapeTheater(); } catch (e) {}
  try { window.HORCharacterStudio077?.sync(); } catch (e) { console.warn('Character presentation:', e); }
          const scoreModal = $('scoreModal');
          if (scoreModal && endSummary) {
            scoreModal.classList.add('showing-remaining');
            try { showClaimRemainingHands(endSummary); } catch (e) {}
            const title = $('scoreModalTitle');
            if (title) title.textContent = 'Remaining Cards';
          }
        };
      }
      const last3Lt = $('ltScoreLast3');
      if (last3Lt) {
        last3Lt.onclick = () => {
          if (endSummary && Array.isArray(endSummary.lastTricks)) window._scoreLastTricks = endSummary.lastTricks;
          try { openPortraitLast3(); } catch (e) {}
        };
      }
      const back = $('ltScoreBack');
      if (back) {
        back.onclick = () => {
          window._ltShowRemaining = false;
          try { updateLandscapeTheater(); } catch (e) {}
  try { window.HORCharacterStudio077?.sync(); } catch (e) { console.warn('Character presentation:', e); }
          const scoreModal = $('scoreModal');
          if (scoreModal && endSummary && !isLandscapeNow()) {
            try { showScoreModal(endSummary); } catch (e) {}
          } else if (scoreModal) {
            scoreModal.classList.remove('showing-remaining');
          }
        };
      }
    } else {
      endEl.classList.add('hidden');
      endEl.innerHTML = '';
    }
  }
  let bidAdvice = null;
  try { bidAdvice = updateLandscapeBidHint(); } catch (e) {}
  try { syncLandscapeBidBar(); syncLandscapeTrumpBar(); syncLandscapeClaimBar(); syncWaitBanners(); } catch (e) {}
  if (ltShowLast5) { try { renderLandscapeLast5(); } catch (e) {} }
  const playsEl = $('ltPlays');
  const metaEl = $('ltMeta');
  const footerEl = $('ltFooter');
  if (!playsEl) return;
  if (window._trickCapturing && game && game.resolvingTrick) {
    // Keep hand/meta fresh, but do not rebuild the four plays mid-flight.
    return;
  }

  const plist = (game && game.players) || players || [];
  const nameOf = (idx) => {
    if (plist[idx] && plist[idx].name) return plist[idx].name;
    if (typeof isSoloPractice !== 'undefined' && isSoloPractice
        && typeof myIndex === 'number' && idx === myIndex) {
      return myName || 'Host';
    }
    if (typeof myIndex === 'number' && idx === myIndex && myName) return myName;
    return 'Player ' + (idx + 1);
  };
  const teamOf = (idx) => {
    if (plist[idx] && typeof plist[idx].team === 'number') return plist[idx].team;
    return idx % 2;
  };
  let mySeat = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : -1;
  const myTeam = mySeat >= 0 ? teamOf(mySeat) : -1;
  const partnerSeat = mySeat >= 0 ? ((mySeat + 2) % 4) : -1;
  const isBidding = !!(game && game.phase === 'bidding');
  const isTrumpChoice = !!(game && game.phase === 'trump' && game.bidder === myIndex && !isSpectator);

  if (isTrumpChoice) {
    playsEl.innerHTML = '<div class="lt-trump-prompt">Pick the trump suit below. Your full hand stays visible.</div>';
    if (footerEl) footerEl.textContent = '';
  }

  let trick = (game && game.trick && game.trick.length) ? game.trick : null;
  let winnerIdx = (game && game.resolvingTrick) ? game.lastTrickWinner : null;
  let showingLast = false;
  // Do not reuse the previous completed trick during normal play. That stale
  // fallback was causing cards to pop back onto the table after capture.
  if ((!trick || !trick.length) && game && game.resolvingTrick &&
      lastCompletedTrick && lastCompletedTrick.length && !isBidding) {
    trick = lastCompletedTrick;
    winnerIdx = lastCompletedTrickWinner;
    showingLast = true;
  }

  let leadingIdx = null;
  if (trick && trick.length && winnerIdx == null) {
    leadingIdx = trick[0].player;
    let best = trick[0].card;
    const ledC = (game && game.ledColor) || (trick[0].card && trick[0].card.color);
    const trumpC = game && game.trump;
    for (let i = 1; i < trick.length; i++) {
      try {
        if (compareCards(trick[i].card, best, ledC, trumpC) > 0) {
          best = trick[i].card;
          leadingIdx = trick[i].player;
        }
      } catch (e) {}
    }
  }

  const trump = game && game.trump ? (COLOR_NAMES[game.trump] || game.trump) : null;
  const led = game && game.ledColor ? (COLOR_NAMES[game.ledColor] || game.ledColor) : null;
  if (metaEl) {
    const parts = [];
    if (isBidding) {
      const turnName = nameOf(game.currentPlayer);
      parts.push(turnName + ' to bid');
      if (hasActualHighBid()) parts.push('High: ' + formatBidAmount(game.highestBid, { short: true }));
    } else if (isTrumpChoice) {
      parts.push('Bid won: ' + (game.bid ? formatBidAmount(game.bid, { short: true }) : ''));
      parts.push('Choose your trump');
      if (game.bidder != null) parts.push(nameOf(game.bidder));
    } else {
      if (trump) parts.push('Trump: ' + trump);
      if (led) parts.push('Led: ' + led);
      if (partnerSeat >= 0) parts.push('Partner: ' + nameOf(partnerSeat));
      if (showingLast) parts.push('Last trick');
      else if (trick && trick.length) parts.push(trick.length + ' / 4 played');
    }
    metaEl.textContent = parts.join(' · ');
  }

  if (isBidding) {
    // Auction board instead of trick plays
    const status = (game.bidStatus || []);
    const turnIdx = game.currentPlayer;
    playsEl.innerHTML = '<div class="lt-bid-board">' +
      [0, 1, 2, 3].map((i) => {
        const st = status[i];
        const high = game.bidder === i;
        const me = mySeat === i;
        const toAct = turnIdx === i;
        const partner = partnerSeat === i;
        const p = plist[i] || players[i] || {};
        const av = p.avatar || (p.id && playerAvatars[p.id]) || AVATARS[0];
        const cls = [
          'lt-bid-seat',
          (!isFirstHandOfMatch() && high) ? 'high' : '',
          st === 'pass' ? 'passed' : '',
          me ? 'me' : '',
          partner ? 'partner' : '',
          (!isFirstHandOfMatch() && toAct) ? 'to-act' : '',
        ].filter(Boolean).join(' ');
        const unified = window.HORUnifiedBidding752.state(game, i, myIndex, isSpectator);
        const line = unified.label || 'waiting';
        const tag = unified.previous ? '<div class="lt-bid-high">' + unified.previous + '</div>' : '';
        return '<div class="' + cls + '">' +
          '<img class="lt-bid-av" src="' + avatarSrc(av) + '" alt="">' +
          '<div class="lt-bid-copy">' +
          '<div class="lt-bid-name">' + nameOf(i) + (me ? ' (you)' : '') + (partner ? ' · partner' : '') + '</div>' +
          '<div class="lt-bid-val">' + line + '</div>' + tag +
          '</div></div>';
      }).join('') +
      '</div>';
    if (footerEl) {
      const waiter = nameOf(turnIdx);
      footerEl.textContent = (turnIdx === mySeat ? 'Your bid' : ('Waiting on ' + waiter))
        + (hasActualHighBid() ? (' · high ' + formatBidAmount(game.highestBid, { short: true })) : '');
    }
  } else if (game && (game.claimAnimating || game.claimAnimation)) {
    const holder = (game.claimAnimation && game.claimAnimation.player != null)
      ? game.claimAnimation.player
      : game.trumpClaimPlayer;
    const holderName = (holder != null) ? nameOf(holder) : 'Player';
    playsEl.innerHTML = `<div class="lt-empty lt-claim-msg">${holderName} is laying down the rest of the hand…</div>`;
    if (footerEl) footerEl.textContent = 'Winning cards on the felt';
  } else if (!trick || !trick.length) {
    playsEl.innerHTML = '<div class="lt-empty">Waiting for the next play…</div>';
    if (footerEl) {
      footerEl.textContent = partnerSeat >= 0
        ? ('Your partner: ' + nameOf(partnerSeat))
        : '';
    }
  } else {
    playsEl.innerHTML = trick.map((t, i) => {
      const isFinalWinner = winnerIdx != null && winnerIdx === t.player;
      const isLeading = !isFinalWinner && leadingIdx != null && leadingIdx === t.player;
      const isMe = mySeat >= 0 && t.player === mySeat;
      const isPartner = partnerSeat >= 0 && t.player === partnerSeat;
      const isLatest = !showingLast && i === trick.length - 1;
      if (isLatest && t.card && (t.card.color === 'rook' || t.card.id === 'rook')) {
        const pulseSig = trick.length + ':' + t.player + ':' + (t.card.id || 'rook');
        if (window._rookSeenPlaySig !== pulseSig) {
          window._rookSeenPlaySig = pulseSig;
          markRookJustPlayed();
        }
      }
      const isRookPulse = !!(isLatest && t.card && rookPlayPulseActive(t.card));
      const ord = ['1st', '2nd', '3rd', '4th'][i] || (i + 1);
      const roleBits = [];
      if (isPartner) roleBits.push('<span class="lt-badge lt-partner">Partner</span>');
      if (isFinalWinner) roleBits.push('<span class="lt-badge lt-wins">Wins</span>');
      else if (isLeading) roleBits.push('<span class="lt-badge lt-leading">Leading</span>');
      if (isMe && !isFinalWinner && !isLeading) {
        roleBits.push('<span class="lt-badge lt-you">Me</span>');
      }
      const teamCls = teamOf(t.player) === 0 ? 'team-a' : 'team-b';
      return `<div class="lt-play ${teamCls} ${isFinalWinner ? 'winner' : ''} ${isLeading ? 'leading' : ''} ${isPartner ? 'partner' : ''} ${isMe ? 'you' : ''} ${isLatest ? 'latest' : ''} ${isRookPulse ? 'rook-play-pulse' : ''}">
      <div class="lt-order">${ord}</div>
      ${isFinalWinner ? '<div class="lt-win-stamp">WINS</div>' : ''}
      ${typeof renderCardHTML === 'function' ? renderCardHTML(t.card, false) : ''}
      <div class="lt-name">${nameOf(t.player)}</div>
      <div class="lt-roles">${roleBits.join(' ')}</div>
    </div>`;
    }).join('');

    if (footerEl) {
      if (winnerIdx != null) {
        const wPartner = partnerSeat >= 0 && winnerIdx === partnerSeat;
        const wName = nameOf(winnerIdx);
        footerEl.textContent = '🏆 ' + wName + ' wins the trick'
          + (wPartner ? ' (your partner)' : '');
      } else if (leadingIdx != null) {
        const lPartner = partnerSeat >= 0 && leadingIdx === partnerSeat;
        const lName = nameOf(leadingIdx);
        footerEl.textContent = '👑 ' + lName + ' is winning so far'
          + (lPartner ? ' (partner)' : '');
      } else {
        footerEl.textContent = '';
      }
    }
  }

  if (isTrumpChoice) {
    // Do not render trick cards while the trump chooser is active; reclaim that
    // space for the four suit buttons and the player's complete hand.
    playsEl.innerHTML = '<div class="lt-trump-prompt">Pick the trump suit below.</div>';
    if (metaEl) metaEl.textContent = 'Bid won · choose your trump';
    if (footerEl) footerEl.textContent = '';
  }

  // --- Your hand in landscape (playable on turn; coach-highlighted while bidding) ---
  const handEl = $('ltHand');
  const handLabel = $('ltHandLabel');
  if (handLabel) {
    handLabel.textContent = 'Your hand';
  }
  if (handEl) {
    const dealing = !!(game && game.phase === 'dealing');
    const hand = (game && Array.isArray(game.myHand))
      ? game.myHand
      : ((!dealing && typeof myIndex === 'number' && myIndex >= 0 && game && game.hands)
          ? (game.hands[myIndex] || [])
          : []);
    const isMyTurn = !!(game && game.phase === 'play' && game.currentPlayer === myIndex
      && !game.resolvingTrick && !game.paused && !isSpectator && !game.claimAnimating);
    try { maybeRemindTurn(); } catch (e) {}
    const highlightSet = new Set(
      (isBidding && bidAdvice && bidAdvice.highlightIds) ? bidAdvice.highlightIds.map(String) : []
    );
    if (handLabel) {
      if (isBidding) {
        handLabel.textContent = highlightSet.size
          ? 'Your hand — gold cards match the coach tip'
          : (hand.length ? ('Your hand · ' + hand.length + (hand.length === 1 ? ' card' : ' cards')) : 'Your hand');
      } else if (isMyTurn) {
        handLabel.textContent = highlightSet.size
          ? ('Play a gold card · ' + hand.length + (hand.length === 1 ? ' card' : ' cards'))
          : (hand.length ? ('Your hand · ' + hand.length + (hand.length === 1 ? ' card' : ' cards')) : 'Your hand');
      } else {
        handLabel.textContent = hand.length ? ('Your hand · ' + hand.length + (hand.length === 1 ? ' card' : ' cards')) : 'Your hand';
      }
    }
    if (!hand.length) {
      handEl.innerHTML = '';
    } else {
      handEl.innerHTML = hand.map(card => {
        let extra = 'lt-waiting';
        if (isMyTurn) {
          extra = cardLegalClass(card, hand);
        } else if (isBidding && highlightSet.has(String(card.id))) {
          extra = 'playable';
        }
        const html = renderCardHTML(card, true);
        return html.replace('class="card-face ', 'class="card-face ' + extra + ' ');
      }).join('');
      handEl.querySelectorAll('.card-face').forEach(el => {
        el.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!game || game.phase !== 'play' || isSpectator) return;
          const id = String(el.dataset.id);
          try { playCardIfMyTurn(id); } catch (e) { console.error(e); }
        };
      });
    }
  }

  // Android/WebView can repaint the theater without passing through the
  // portrait renderer. Launch the guarded landscape flight after the cards
  // have actually been painted. The internal key/lock guarantees one flight.
  if (isLandscape && game && game.resolvingTrick && game.trick && game.trick.length === 4
      && game.lastTrickWinner != null) {
    const k = trickResolveKey(game.lastTrickWinner, game.trick);
    // IMPORTANT: do not let landscape render/resize callbacks swipe the trick
    // away early. The capture is unlocked only by the 1.1s reveal timer above.
    if (window._trickRevealReadyKey === k && window._trickFlightKey !== k && !window._trickCapturing) {
      requestAnimationFrame(() => {
        try { animateLandscapeTrickCapture(game.lastTrickWinner); } catch (e) {}
      });
    }
  }
}

try {
  if (document.body && !document.body.classList.contains('in-game')) {
    setLobbyPortraitOrientation();
  }
} catch (e) {}

window.addEventListener('orientationchange', () => {
  setTimeout(() => { try { updateLandscapeTheater(); } catch (e) {}
  try { window.HORCharacterStudio077?.sync(); } catch (e) { console.warn('Character presentation:', e); } }, 150);
});
window.addEventListener('resize', () => {
  try { updateLandscapeTheater(); } catch (e) {}
  try { window.HORCharacterStudio077?.sync(); } catch (e) { console.warn('Character presentation:', e); }
});


// ========== Landscape: This trick / Last 3 tabs ==========
let ltShowLast5 = false;

function setLandscapeTab(showLast5) {
  ltShowLast5 = !!showLast5;
  const tabTrick = $('ltTabTrick');
  const tabLast = $('ltTabLast5');
  const viewTrick = $('ltViewTrick');
  const viewLast = $('ltViewLast5');
  if (tabTrick) tabTrick.classList.toggle('active', !ltShowLast5);
  if (tabLast) tabLast.classList.toggle('active', !!ltShowLast5);
  if (viewTrick) viewTrick.classList.toggle('hidden', !!ltShowLast5);
  if (viewLast) viewLast.classList.toggle('hidden', !ltShowLast5);
  if (ltShowLast5) {
    try { renderLandscapeLast5(); } catch (e) { console.error(e); }
  }
}

function renderLandscapeLast5() {
  const body = $('ltLast5Body');
  if (!body) return;
  const list = ((typeof recentTricks !== 'undefined' && recentTricks) ? recentTricks : []).slice(0, 3);
  const plist = (game && game.players) || players || [];
  const nameOf = (idx) => {
    if (plist[idx] && plist[idx].name) return plist[idx].name;
    if (typeof isSoloPractice !== 'undefined' && isSoloPractice
        && typeof myIndex === 'number' && idx === myIndex) return myName || 'Host';
    if (typeof myIndex === 'number' && idx === myIndex && myName) return myName;
    return 'Player ' + ((idx|0) + 1);
  };
  let mySeat = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : -1;
  const partnerSeat = mySeat >= 0 ? ((mySeat + 2) % 4) : -1;
  if (!list.length) {
    body.innerHTML = '<div class="lt-last5-empty">No tricks yet this hand</div>';
    return;
  }
  body.innerHTML = list.map((tr, i) => {
    const label = i === 0 ? 'Latest' : (i === 1 ? 'Prev' : '#' + (i + 1));
    const trump = tr.trump ? (COLOR_NAMES[tr.trump] || tr.trump) : '—';
    const led = tr.ledColor ? (COLOR_NAMES[tr.ledColor] || tr.ledColor) : '—';
    const wName = nameOf(tr.winner);
    const wPartner = partnerSeat >= 0 && tr.winner === partnerSeat;
    const wMe = mySeat >= 0 && tr.winner === mySeat;
    const winNote = wPartner ? ' · partner' : (wMe ? ' · you' : '');
    const plays = (tr.plays || []).map((t) => {
      const isW = t.player === tr.winner;
      const isPartner = partnerSeat >= 0 && t.player === partnerSeat;
      const isMe = mySeat >= 0 && t.player === mySeat;
      const role = '';
      return `<div class="lt-th-play ${isW ? 'winner' : ''} ${isPartner ? 'partner' : ''} ${isMe ? 'you' : ''}">
        ${typeof renderCardHTML === 'function' ? renderCardHTML(t.card, true) : ''}
        <div class="lt-th-name">${nameOf(t.player)}</div>
        ${role}
      </div>`;
    }).join('');
    return `<article class="lt-th-card">
      <div class="lt-th-head">${label} · <span class="lt-th-win">🏆 ${wName}${winNote}</span>
        <div class="lt-th-meta">Trump ${trump} · Led ${led}</div>
      </div>
      <div class="lt-th-plays">${plays}</div>
    </article>`;
  }).join('');
}



// ========== ROOK012 portrait Last Trick header popover ==========
function isPortraitViewport() {
  try { return !(window.matchMedia && window.matchMedia('(orientation: landscape)').matches); }
  catch (e) { return window.innerHeight >= window.innerWidth; }
}
function getPortraitPreviousTrick() {
  const latest = (typeof recentTricks !== 'undefined' && Array.isArray(recentTricks)) ? recentTricks[0] : null;
  if (latest && Array.isArray(latest.plays) && latest.plays.length === 4) return latest;
  if (Array.isArray(lastCompletedTrick) && lastCompletedTrick.length === 4) return { plays:lastCompletedTrick, winner:lastCompletedTrickWinner };
  // Per-hand history is cleared at shuffle; the match archive survives the deal.
  if (typeof matchTricks !== 'undefined' && Array.isArray(matchTricks)) {
    for (let i = matchTricks.length - 1; i >= 0; i--) {
      const tr = matchTricks[i];
      if (tr && Array.isArray(tr.plays) && tr.plays.length === 4) return tr;
    }
  }
  return null;
}
function portraitLastTrickMiniHTML(tr) {
  const base = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
  const seatClass = {2:'north',1:'west',3:'east',0:'south'};
  function simpleFace(card){
    if (!card) return '';
    const relColor = (card.color === 'rook' || card.id === 'rook') ? 'black' : (card.color || 'black');
    const value = (card.color === 'rook' || card.id === 'rook') ? 'R' : (card.rank != null ? card.rank : '');
    return `<div class="portrait-last-simple-face ${relColor}"><span>${value}</span></div>`;
  }
  return tr.plays.map(t=>{
    const rel=((Number(t.player)-base)%4+4)%4;
    return `<div class="portrait-last-trick-mini-card seat-${seatClass[rel]}">${simpleFace(t.card)}</div>`;
  }).join('');
}
function closePortraitLastTrickPopover(){
  const pop=$('portraitLastTrickPopover'), btn=$('portraitLastTrickButton');
  if(pop) pop.classList.add('hidden');
  const close = $('portraitLastTrickClose');
  if (close) close.style.setProperty('display','none','important');
  const status = $('portraitLastTrickStatus031');
  if (status) status.classList.add('hidden');
  if(btn) btn.setAttribute('aria-expanded','false');
}
function refreshPortraitLastTrick029() {
  const pop = $('portraitLastTrickPopover'), cards = $('portraitLastTrickCards');
  if (!pop || !cards || pop.classList.contains('hidden') || !isPortraitViewport()) return;
  const tr = getPortraitPreviousTrick();
  if (!tr) return;
  const signature = JSON.stringify(tr.plays.map(t => [t.player,t.card.id,t.card.color,t.card.rank]));
  if (cards.dataset.completedTrick029 === signature) return;
  const status = $('portraitLastTrickStatus031');
  if (status) status.classList.add('hidden');
  cards.innerHTML = portraitLastTrickMiniHTML(tr);
  cards.dataset.completedTrick029 = signature;
  positionPortraitLastTrick025();
}
function openPortraitLastTrickPopover(){
  if(!isPortraitViewport()) return;
  const tr=getPortraitPreviousTrick(), pop=$('portraitLastTrickPopover'), cards=$('portraitLastTrickCards'), btn=$('portraitLastTrickButton');
  if(!pop || !cards) return;
  const status = $('portraitLastTrickStatus031');
  if (status) status.classList.toggle('hidden', !!tr);
  cards.innerHTML=tr ? portraitLastTrickMiniHTML(tr) : '';
  cards.dataset.completedTrick029 = tr ? JSON.stringify(tr.plays.map(t => [t.player,t.card.id,t.card.color,t.card.rank])) : '';
  pop.classList.remove('hidden');
  positionPortraitLastTrick025();
  if(btn) btn.setAttribute('aria-expanded','true');
}
// ROOK025: viewport-owned review, outside every table/player transform.
function positionPortraitLastTrick025(){
  const pop=$('portraitLastTrickPopover'), group=$('portraitLastTrickGroup'), cards=$('portraitLastTrickCards');
  if(!pop || !group || !cards || !isPortraitViewport()) return;
  if(pop.parentNode!==document.body) document.body.appendChild(pop);
  group.style.setProperty('left','68px','important');
  group.style.setProperty('top','389px','important');
  cards.style.setProperty('translate','0px 0px','important');
  // Center the actual projected four-card bounds, not merely an empty shell.
  const boxes=Array.from(cards.children).map(c=>c.getBoundingClientRect());
  if(boxes.length!==4) { positionPortraitLastTrickClose030(); return; }
  const cx=(Math.min(...boxes.map(r=>r.left))+Math.max(...boxes.map(r=>r.right)))/2;
  const cy=(Math.min(...boxes.map(r=>r.top))+Math.max(...boxes.map(r=>r.bottom)))/2;
  cards.style.setProperty('translate',`${68-cx}px ${389-cy}px`,'important');
  positionPortraitLastTrickClose030();
}
window.addEventListener('resize',()=>{const p=$('portraitLastTrickPopover');if(p&&!p.classList.contains('hidden'))positionPortraitLastTrick025();});
// Delegate at the document so header updates cannot discard the LAST handler.
(function wirePortraitLastTrickPopover(){
  document.addEventListener('click', e => {
    const control = e.target && e.target.closest && e.target.closest('#portraitLastTrickButton, #portraitLastTrickClose');
    if (!control) return;
    e.preventDefault(); e.stopPropagation();
    if (control.id === 'portraitLastTrickClose') { closePortraitLastTrickPopover(); return; }
    const pop = $('portraitLastTrickPopover');
    if (pop && !pop.classList.contains('hidden')) closePortraitLastTrickPopover();
    else openPortraitLastTrickPopover();
  }, true);
  window.addEventListener('orientationchange',closePortraitLastTrickPopover);
})();

// Keep mobile keyboard stable: don't let landscape overlay steal focus while typing
(function wireInputFocusGuard() {
  const setFocused = (on) => {
    try { document.body.classList.toggle('input-focused', !!on); } catch (e) {}
  };
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
      setFocused(true);
    }
  }, true);
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      const a = document.activeElement;
      const still = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
      setFocused(!!still);
    }, 50);
  }, true);
})();

/* Build 467 Career badge */


// Rook468 — restore Career Test / Activation entrance.
(function wireCareerTestEntrance(){
  function bind(){
    const b=document.getElementById('horCareerTestBtn');
    if(!b || b.__horBound) return;
    b.__horBound=true;
    b.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation();
      try{
        if(window.HORProgression && HORProgression.localCareer &&
           typeof HORProgression.localCareer.showActivationPanel==='function'){
          HORProgression.localCareer.showActivationPanel();
        }
      }catch(err){console.error(err);}
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);
  else bind();
})();






/* Rook530 — SOL Visual Layout Studio 2
 * The editor is an overlay, not a second layout engine. It never polls/reapplies geometry.
 * Pick virtually any live table/UI element, move it, size it, lock it, save it, and export later.
 */
(function horInstallVisualStudio(){
  const KEY='horSolVisualStudioV1', PANEL_KEY='horSolStudioPanelV3';
  const DEFAULT_PORTRAIT={"#slot-me .seat-avatar":{"x":29,"y":-17,"w":null,"h":null,"scale":1.4,"font":null,"z":null,"hidden":false,"locked":false},"#slot-partner .seat-avatar":{"x":0,"y":0,"w":null,"h":null,"scale":1.2,"font":null,"z":null,"hidden":false,"locked":false},"#slot-left .seat-avatar-side":{"x":14,"y":-11,"w":null,"h":null,"scale":1.2,"font":1,"z":null,"hidden":false,"locked":false},"#slot-right .seat-avatar-side":{"x":-6,"y":-18,"w":null,"h":null,"scale":1.2,"font":null,"z":null,"hidden":false,"locked":false},"#actionPanel":{"x":-13,"y":-30,"w":null,"h":null,"scale":0.87,"font":null,"z":null,"hidden":false,"locked":false},"#slot-me .bid-badge":{"x":0,"y":0,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false},"#slot-left .name":{"x":-12,"y":9,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false},"#slot-left .bid-badge":{"x":0,"y":10,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false},"#slot-partner .name":{"x":-57,"y":-2,"w":null,"h":null,"scale":1.2,"font":null,"z":null,"hidden":false,"locked":false},"#slot-right .name":{"x":19,"y":1,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false},"#slot-me .name":{"x":35,"y":-8,"w":null,"h":null,"scale":1.2,"font":null,"z":null,"hidden":false,"locked":false},"#slot-right .bid-badge":{"x":0,"y":0,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false},"#trickArea":{"x":14,"y":-109,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false},"#slot-right":{"x":-8,"y":-7,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false},"#btnToggleTopOpts":{"x":-15,"y":95,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false},"#leaveReplaceBtn":{"x":-15,"y":18,"w":null,"h":null,"scale":1,"font":null,"z":null,"hidden":false,"locked":false}};
  // Rook647: these elements now have authoritative source geometry from the live-phone capture.
  // Do not let an empty/fresh browser resurrect older SOL default offsets for them.
  ['#slot-me .seat-avatar','#slot-partner .seat-avatar','#slot-left .seat-avatar-side','#slot-right .seat-avatar-side'].forEach(k=>{ delete DEFAULT_PORTRAIT[k]; });
  let editing=false,picking=false,target=null,targetKey='',drag=null,panelDrag=null,history=[],future=[],grid=1,aspect=true;
  const orientation=()=>innerWidth>innerHeight?'landscape':'portrait';
  const q=s=>document.querySelector(s);
  const safeNum=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  function readAll(){try{const a=JSON.parse(localStorage.getItem(KEY)||'{}')||{};if(!a.portrait||!Object.keys(a.portrait).length){a.portrait=JSON.parse(JSON.stringify(DEFAULT_PORTRAIT));localStorage.setItem(KEY,JSON.stringify(a));}return a;}catch(_){return {portrait:JSON.parse(JSON.stringify(DEFAULT_PORTRAIT))};}}
  function writeAll(v){localStorage.setItem(KEY,JSON.stringify(v));}
  // Rook540: migrate only the five approved portrait visual corrections from the 531 baseline.
  // This is intentionally one-shot so later manual edits remain possible.
  (function rook540SurgicalPortraitMigration(){
    const mk='horRook540SurgicalVisualMigration';
    if(localStorage.getItem(mk)==='1') return;
    try{
      const a=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
      a.portrait=a.portrait||{};
      const patch={
        '#slot-me .bid-badge':{x:0,y:0},
        '#slot-right .name':{x:19,y:1},
        '#slot-left .bid-badge':{x:0,y:10}
      };
      Object.keys(patch).forEach(k=>{
        const prior=a.portrait[k]||{};
        a.portrait[k]=Object.assign({x:0,y:0,w:null,h:null,scale:1,font:null,z:null,hidden:false,locked:false},prior,patch[k]);
      });
      // Rook541: old SOL exports could contain direct/fragile selectors for the hand
      // and for generated played-card descendants. Those elements are dynamically
      // rendered and must remain under the game's native card CSS, not saved SOL
      // width/height/scale/translation. Keep #trickArea itself because its approved
      // 531 position is structural; remove only card-presentation descendants.
      Object.keys(a.portrait).forEach(k=>{
        const cardPresentation =
          k==='#myHand' || k.startsWith('#myHand ') || k.startsWith('#myHand>') ||
          k.includes('#trickArea ') || k.includes('#trickArea>') ||
          k.includes('.trick-stack');
        if(cardPresentation) delete a.portrait[k];
      });
      localStorage.setItem(KEY,JSON.stringify(a));
      localStorage.setItem(mk,'1');
    }catch(_){}
  })();
  (function rook541CardPresentationRecovery(){
    const mk='horRook541CardPresentationRecovery';
    if(localStorage.getItem(mk)==='1') return;
    try{
      const a=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
      const p=a.portrait||{};
      Object.keys(p).forEach(k=>{
        const cardPresentation =
          k==='#myHand' || k.startsWith('#myHand ') || k.startsWith('#myHand>') ||
          k.includes('#trickArea ') || k.includes('#trickArea>') ||
          k.includes('.trick-stack');
        if(cardPresentation) delete p[k];
      });
      a.portrait=p;
      localStorage.setItem(KEY,JSON.stringify(a));
      localStorage.setItem(mk,'1');
    }catch(_){}
  })();
    // Rook597: approved bid console is not owned by SOL Visual Studio. Purge every saved legacy bid-dock transform.
  (function rook597PurgeLegacyBidDockOwnership(){
    try{
      const a=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
      ['portrait','landscape'].forEach(o=>{if(a[o]&&a[o]['#decisionConsole']) delete a[o]['#decisionConsole'];});
      localStorage.setItem(KEY,JSON.stringify(a));
    }catch(_){}
  })();

  function readPanel(){try{return JSON.parse(localStorage.getItem(PANEL_KEY)||'{}')||{};}catch(_){return {};}}
  function writePanel(v){localStorage.setItem(PANEL_KEY,JSON.stringify(v));}
  function keyFor(el){
    if(!el)return''; if(el.id)return'#'+CSS.escape(el.id);
    const seat=el.closest&&el.closest('.player-slot');
    if(seat&&seat.id){if(el===seat)return'#'+CSS.escape(seat.id);const cls=[...el.classList].find(c=>!c.startsWith('sol-')&&c!=='hidden');if(cls)return'#'+CSS.escape(seat.id)+' .'+CSS.escape(cls);}
    let cur=el,path=[];while(cur&&cur!==document.body&&path.length<6){let part=cur.tagName.toLowerCase();const cls=[...cur.classList].find(c=>!c.startsWith('sol-')&&c!=='hidden');if(cls)part+='.'+CSS.escape(cls);const par=cur.parentElement;if(par){const same=[...par.children].filter(x=>x.tagName===cur.tagName);if(same.length>1)part+=`:nth-of-type(${same.indexOf(cur)+1})`;}path.unshift(part);cur=par;}return path.join('>');
  }
  function recFor(key=targetKey){const a=readAll(),o=orientation();return Object.assign({x:0,y:0,w:null,h:null,scale:1,font:null,z:null,hidden:false,locked:false},a[o]&&a[o][key]||{});}
  function saveRec(r,key=targetKey){if(!key)return;const a=readAll(),o=orientation();a[o]=a[o]||{};a[o][key]=r;writeAll(a);}
  function applyRec(el,key){if(!el||!key)return;const r=recFor(key);el.classList.add('sol-studio-managed');el.style.setProperty('--sol-vs-x',safeNum(r.x)+'px');el.style.setProperty('--sol-vs-y',safeNum(r.y)+'px');el.style.setProperty('--sol-vs-scale',safeNum(r.scale,1));el.style.width=r.w==null?'':safeNum(r.w)+'px';el.style.height=r.h==null?'':safeNum(r.h)+'px';el.style.fontSize=r.font==null?'':safeNum(r.font)+'px';el.style.zIndex=r.z==null?'':String(Math.round(safeNum(r.z)));el.classList.toggle('sol-studio-hidden',!!r.hidden);el.classList.toggle('sol-studio-locked',!!r.locked);}
  function rook550AuthoritativeKey(k){return k==='#decisionConsole'||k==='#slot-me .name'||k==='#slot-partner .name'||k==='#slot-left .name'||k==='#slot-right .name';}
  function applySavedOnce(){const a=readAll(),o=orientation(),m=a[o]||{};Object.keys(m).forEach(k=>{if(rook550AuthoritativeKey(k))return;try{const el=q(k);if(el)applyRec(el,k);}catch(_){}});}
  function snap(v){return grid>1?Math.round(v/grid)*grid:Math.round(v);}
  function pushHistory(){if(!targetKey)return;history.push({o:orientation(),key:targetKey,r:recFor()});if(history.length>80)history.shift();future=[];}
  function restore(h){if(!h)return;const a=readAll();a[h.o]=a[h.o]||{};a[h.o][h.key]=h.r;writeAll(a);if(h.o===orientation()){const el=q(h.key);if(el)applyRec(el,h.key);}paint();}
  function undo(){if(!history.length)return;future.push({o:orientation(),key:targetKey,r:recFor()});restore(history.pop());}
  function redo(){if(!future.length)return;history.push({o:orientation(),key:targetKey,r:recFor()});restore(future.pop());}
  function normalizeTarget(el){
    if(!el)return el;
    const av=el.closest&&el.closest('.seat-avatar,.seat-avatar-side'); if(av)return av;
    const nm=el.closest&&el.closest('.player-slot .name'); if(nm)return nm;
    return el;
  }
  function setTarget(el){el=normalizeTarget(el);if(!el||el.closest('#solStudioPanel'))return;target=el;targetKey=keyFor(el);document.querySelectorAll('.sol-studio-target').forEach(x=>x.classList.remove('sol-studio-target'));target.classList.add('sol-studio-target');picking=false;document.documentElement.classList.remove('sol-studio-picking');applyRec(target,targetKey);paint();}
  function field(id){return q('#'+id);}
  function restorePanelPosition(){const p=q('#solStudioPanel');if(!p)return;const all=readPanel(),r=all[orientation()]||{};p.classList.toggle('collapsed',!!r.collapsed);p.style.left=r.left!=null?r.left+'px':'';p.style.top=r.top!=null?r.top+'px':'';p.style.right=r.left!=null?'auto':'';p.style.bottom=r.top!=null?'auto':'';if(r.width)p.style.width=r.width+'px';if(r.height)p.style.height=r.height+'px';}
  function savePanelPosition(){const p=q('#solStudioPanel');if(!p)return;const all=readPanel(),o=orientation(),box=p.getBoundingClientRect();all[o]={left:Math.round(box.left),top:Math.round(box.top),width:Math.round(box.width),height:p.classList.contains('collapsed')?null:Math.round(box.height),collapsed:p.classList.contains('collapsed')};writePanel(all);}
  function dockPanel(side){const p=q('#solStudioPanel');if(!p)return;const box=p.getBoundingClientRect(),pad=6;let left=box.left,top=box.top;if(side==='left'){left=pad;top=Math.max(pad,Math.min(innerHeight-box.height-pad,top));}if(side==='right'){left=Math.max(pad,innerWidth-box.width-pad);top=Math.max(pad,Math.min(innerHeight-box.height-pad,top));}if(side==='top'){top=pad;left=Math.max(pad,Math.min(innerWidth-box.width-pad,left));}if(side==='bottom'){top=Math.max(pad,innerHeight-box.height-pad);left=Math.max(pad,Math.min(innerWidth-box.width-pad,left));}p.style.left=left+'px';p.style.top=top+'px';p.style.right='auto';p.style.bottom='auto';savePanelPosition();}
  function ensurePanel(){let p=q('#solStudioPanel');if(p)return p;p=document.createElement('div');p.id='solStudioPanel';p.className='sol-studio-panel hidden';p.innerHTML=`
   <div class="sol-studio-head" id="solVsHandle"><b>SOL VISUAL STUDIO</b><span id="solVsOrient"></span><button id="solVsCollapse" title="Collapse">—</button><button id="solVsDone">DONE</button></div>
   <div class="sol-studio-body">
   <div class="sol-studio-row"><button id="solVsPick">PICK ANYTHING</button><button id="solVsParent">PARENT</button><button id="solVsChild">CHILD</button><span id="solVsTarget">Nothing selected</span></div><div id="solVsSafety" class="sol-studio-safety"></div>
   <div class="sol-studio-row sol-studio-avatar-quick"><button data-sol-pick="#slot-me .seat-avatar">BOTTOM AVATAR</button><button data-sol-pick="#slot-partner .seat-avatar">TOP AVATAR</button><button data-sol-pick=".player-slot.left .seat-avatar-side">LEFT AVATAR</button><button data-sol-pick=".player-slot.right .seat-avatar-side">RIGHT AVATAR</button></div>
   <div class="sol-studio-row"><button data-sol-pick="#slot-me .name">BOTTOM NAME</button><button data-sol-pick="#slot-partner .name">TOP NAME</button><button data-sol-pick=".player-slot.left .name">LEFT NAME</button><button data-sol-pick=".player-slot.right .name">RIGHT NAME</button></div>
   <div class="sol-studio-row"><button data-sol-find="bid">BID BOX / CONTROLS</button><button data-sol-find="trump">TRUMP UI</button><button data-sol-find="nest">NEST UI</button><button data-sol-find="last">LAST 3</button></div>
   <div class="sol-studio-grid">
    <label>X<input id="solVsX" type="number" step="1"></label><label>Y<input id="solVsY" type="number" step="1"></label>
    <label>W<input id="solVsW" type="number" step="1" placeholder="auto"></label><label>H<input id="solVsH" type="number" step="1" placeholder="auto"></label>
    <label>SCALE<input id="solVsScale" type="number" step="0.01" min="0.1" max="5"></label><label>FONT<input id="solVsFont" type="number" step="1" placeholder="auto"></label>
    <label>Z<input id="solVsZ" type="number" step="1" placeholder="auto"></label><label>GRID<select id="solVsGrid"><option>1</option><option>2</option><option>5</option><option>10</option></select></label>
   </div>
   <div class="sol-studio-row"><button id="solVsSmaller">− SIZE</button><button id="solVsLarger">+ SIZE</button><button id="solVsAspect">🔗 ASPECT ON</button><button id="solVsHide">HIDE</button><button id="solVsLock">LOCK</button><button id="solVsReset">RESET ITEM</button></div>
   <div class="sol-studio-row"><button id="solVsUndo">↶ UNDO</button><button id="solVsRedo">↷ REDO</button><button id="solVsGuides">GUIDES + SAFE AREA</button><button id="solVsBoxes">BOXES</button></div><div class="sol-studio-row"><button id="solVsLockAll">LOCK ALL</button><button id="solVsUnlockAll">UNLOCK ALL</button><button id="solVsUnhideAll">UNHIDE ALL</button><button id="solVsHidden">HIDDEN ITEMS</button></div><div id="solVsHiddenList" class="sol-hidden-list hidden"></div><div class="sol-studio-row"><button id="solVsThinking">PREVIEW THINKING</button><button id="solVsImport">IMPORT LAYOUT</button></div>
   <div class="sol-studio-row"><button id="solVsCopy">COPY VALUES</button><button id="solVsPaste">PASTE VALUES</button><button id="solVsExport">FINALIZE / EXPORT</button><button id="solVsResetOri">RESET ORIENTATION</button></div>
   <div class="sol-studio-row sol-studio-dock"><span>MOVE EDITOR:</span><button data-sol-dock="left">◀</button><button data-sol-dock="top">▲</button><button data-sol-dock="bottom">▼</button><button data-sol-dock="right">▶</button></div>
   <textarea id="solVsExportBox" class="hidden"></textarea><div class="sol-studio-viewport" id="solVsViewport"></div><div class="sol-studio-resize" id="solVsResize" title="Resize editor">↘</div>
   <div class="sol-studio-help">Drag title bar to move editor • PICK ANYTHING then tap a live UI object • drag selected object • arrows 1px • Shift+arrows 10px • LOCK protects candidate</div>
   </div>`;document.body.appendChild(p);
   q('#solVsDone').onclick=()=>setEditing(false);q('#solVsPick').onclick=()=>{picking=true;document.documentElement.classList.add('sol-studio-picking');};
   q('#solVsParent').onclick=()=>{if(target&&target.parentElement&&!target.parentElement.closest('#solStudioPanel'))setTarget(target.parentElement);};q('#solVsChild').onclick=()=>{if(target&&target.firstElementChild)setTarget(target.firstElementChild);};
   p.querySelectorAll('[data-sol-pick]').forEach(b=>b.onclick=()=>{const el=q(b.getAttribute('data-sol-pick'));if(el)setTarget(el);});
   p.querySelectorAll('[data-sol-find]').forEach(b=>b.onclick=()=>{const kind=b.getAttribute('data-sol-find');const sels={bid:['#bidPanel','.bid-panel','.bidding-panel','.bid-controls','#bidControls'],trump:['#actionPanel','#ltTrumpBar','#trumpBanner','#trumpPanel','.trump-panel','.trump-showdown'],nest:['#nestArea','.nest-area','.kitty-area'],last:['#btnLast3','.last-three','.last3']}[kind]||[];const el=sels.map(x=>q(x)).find(Boolean);if(el)setTarget(el);});
   ['X','Y','W','H','Scale','Font','Z'].forEach(n=>field('solVs'+n).addEventListener('change',applyFields));q('#solVsGrid').onchange=e=>grid=safeNum(e.target.value,1);
   q('#solVsSmaller').onclick=()=>mut(r=>r.scale=Math.max(.1,safeNum(r.scale,1)-.05));q('#solVsLarger').onclick=()=>mut(r=>r.scale=Math.min(5,safeNum(r.scale,1)+.05));
   q('#solVsAspect').onclick=()=>{aspect=!aspect;paint();};q('#solVsHide').onclick=()=>mut(r=>r.hidden=!r.hidden);q('#solVsLock').onclick=()=>mut(r=>r.locked=!r.locked);q('#solVsReset').onclick=resetItem;
   q('#solVsUndo').onclick=undo;q('#solVsRedo').onclick=redo;q('#solVsGuides').onclick=()=>document.documentElement.classList.toggle('sol-studio-guides');q('#solVsBoxes').onclick=()=>document.documentElement.classList.toggle('sol-studio-boxes');
   q('#solVsCopy').onclick=()=>{if(targetKey)sessionStorage.setItem('horSolVsClipboard',JSON.stringify(recFor()));};q('#solVsPaste').onclick=()=>{try{const r=JSON.parse(sessionStorage.getItem('horSolVsClipboard')||'null');if(r){pushHistory();saveRec(r);applyRec(target,targetKey);paint();}}catch(_){}};
   q('#solVsExport').onclick=exportLayout;q('#solVsResetOri').onclick=resetOrientation;
   q('#solVsLockAll').onclick=()=>bulkFlag('locked',true);q('#solVsUnlockAll').onclick=()=>bulkFlag('locked',false);q('#solVsUnhideAll').onclick=()=>bulkFlag('hidden',false);q('#solVsHidden').onclick=showHidden;q('#solVsThinking').onclick=previewThinking;q('#solVsImport').onclick=importLayout;
   q('#solVsCollapse').onclick=e=>{e.stopPropagation();p.classList.toggle('collapsed');savePanelPosition();};
   p.querySelectorAll('[data-sol-dock]').forEach(b=>b.onclick=()=>dockPanel(b.getAttribute('data-sol-dock')));
   const h=q('#solVsHandle');h.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const box=p.getBoundingClientRect();panelDrag={id:e.pointerId,dx:e.clientX-box.left,dy:e.clientY-box.top};h.setPointerCapture&&h.setPointerCapture(e.pointerId);e.preventDefault();});
   h.addEventListener('pointermove',e=>{if(!panelDrag||e.pointerId!==panelDrag.id)return;const box=p.getBoundingClientRect();const left=Math.max(0,Math.min(innerWidth-box.width,e.clientX-panelDrag.dx));const top=Math.max(0,Math.min(innerHeight-box.height,e.clientY-panelDrag.dy));p.style.left=left+'px';p.style.top=top+'px';p.style.right='auto';p.style.bottom='auto';e.preventDefault();});
   h.addEventListener('pointerup',e=>{if(!panelDrag||e.pointerId!==panelDrag.id)return;panelDrag=null;savePanelPosition();});
   let panelResize=null;const rh=q('#solVsResize');rh.addEventListener('pointerdown',e=>{const b=p.getBoundingClientRect();panelResize={id:e.pointerId,sx:e.clientX,sy:e.clientY,w:b.width,h:b.height};rh.setPointerCapture&&rh.setPointerCapture(e.pointerId);e.preventDefault();e.stopPropagation();});rh.addEventListener('pointermove',e=>{if(!panelResize||e.pointerId!==panelResize.id)return;p.style.width=Math.max(280,panelResize.w+e.clientX-panelResize.sx)+'px';p.style.height=Math.max(180,panelResize.h+e.clientY-panelResize.sy)+'px';e.preventDefault();});rh.addEventListener('pointerup',e=>{if(panelResize&&e.pointerId===panelResize.id){panelResize=null;savePanelPosition();}});
   restorePanelPosition();return p;
  }
  function bulkFlag(prop,val){const a=readAll(),o=orientation(),m=a[o]||{};Object.keys(m).forEach(k=>m[k][prop]=val);writeAll(a);Object.keys(m).forEach(k=>{try{const el=q(k);if(el)applyRec(el,k);}catch(_){}});paint();}
  function showHidden(){const box=q('#solVsHiddenList'),m=readAll()[orientation()]||{};box.innerHTML='';Object.keys(m).filter(k=>m[k].hidden).forEach(k=>{const b=document.createElement('button');b.textContent='SHOW '+k;b.onclick=()=>{m[k].hidden=false;const a=readAll();a[orientation()]=m;writeAll(a);const el=q(k);if(el)applyRec(el,k);showHidden();};box.appendChild(b);});if(!box.children.length)box.textContent='No SOL-hidden items.';box.classList.toggle('hidden',false);}
  function previewThinking(){const el=q('#botThinking');if(!el)return;el.classList.toggle('hidden');if(!el.classList.contains('hidden')){el.textContent='Player is thinking…';setTarget(el);}}
  function importLayout(){const box=q('#solVsExportBox');box.classList.remove('hidden');box.readOnly=false;box.placeholder='Paste exported SOL JSON here, then press IMPORT LAYOUT again';const raw=box.value.trim();if(!raw){box.focus();return;}try{const data=JSON.parse(raw),a=readAll(),o=data.orientation||orientation();a[o]=Object.assign(a[o]||{},data.layout||data[o]||{});writeAll(a);applySavedOnce();box.value='Imported '+Object.keys(data.layout||data[o]||{}).length+' items into '+o+'.';}catch(e){box.value='IMPORT ERROR: '+e.message;}}
  function structuralLabel(){if(!target)return'';if(target.id==='trickArea'||target.classList.contains('center-area')||target.classList.contains('trick-stack'))return '⚠ PROTECTED STRUCTURE — contains/positions played cards. Move carefully; do not hide/delete.';if(target.id==='botThinking')return 'THINKING BOX — independent transient UI.';if(target.id==='actionPanel'||target.id==='ltTrumpBar')return 'TRUMP/ACTION UI — separate from TRICK.';return '';}
  function mut(fn){if(!targetKey)return;pushHistory();const r=recFor();fn(r);saveRec(r);applyRec(target,targetKey);paint();}
  function applyFields(){if(!targetKey)return;pushHistory();const r=recFor();r.x=snap(safeNum(field('solVsX').value));r.y=snap(safeNum(field('solVsY').value));r.w=field('solVsW').value===''?null:Math.max(1,safeNum(field('solVsW').value));r.h=field('solVsH').value===''?null:Math.max(1,safeNum(field('solVsH').value));r.scale=Math.max(.1,Math.min(5,safeNum(field('solVsScale').value,1)));r.font=field('solVsFont').value===''?null:Math.max(1,safeNum(field('solVsFont').value));r.z=field('solVsZ').value===''?null:safeNum(field('solVsZ').value);saveRec(r);applyRec(target,targetKey);paint();}
  function resetItem(){if(!targetKey)return;pushHistory();const a=readAll(),o=orientation();if(a[o])delete a[o][targetKey];writeAll(a);if(target){target.classList.remove('sol-studio-managed','sol-studio-hidden','sol-studio-locked');['--sol-vs-x','--sol-vs-y','--sol-vs-scale'].forEach(x=>target.style.removeProperty(x));['width','height','font-size','z-index'].forEach(x=>target.style.removeProperty(x));}paint();}
  function resetOrientation(){if(!confirm('Reset every SOL override for '+orientation()+'?'))return;const a=readAll();delete a[orientation()];writeAll(a);location.reload();}
  function exportLayout(){const box=q('#solVsExportBox');box.value=JSON.stringify({build:531,orientation:orientation(),layout:readAll()[orientation()]||{}},null,2);box.classList.remove('hidden');box.select();try{navigator.clipboard&&navigator.clipboard.writeText(box.value);}catch(_){} }
  function paint(){ensurePanel();const r=recFor();q('#solVsOrient').textContent=orientation().toUpperCase();q('#solVsTarget').textContent=targetKey||'Nothing selected';q('#solVsSafety').textContent=structuralLabel();q('#solVsViewport').textContent=innerWidth+'×'+innerHeight+' '+orientation();if(!targetKey)return;field('solVsX').value=Math.round(r.x);field('solVsY').value=Math.round(r.y);field('solVsW').value=r.w==null?'':Math.round(r.w);field('solVsH').value=r.h==null?'':Math.round(r.h);field('solVsScale').value=safeNum(r.scale,1).toFixed(2);field('solVsFont').value=r.font==null?'':Math.round(r.font);field('solVsZ').value=r.z==null?'':Math.round(r.z);q('#solVsAspect').textContent=aspect?'🔗 ASPECT ON':'⛓ ASPECT OFF';q('#solVsHide').classList.toggle('active',!!r.hidden);q('#solVsLock').classList.toggle('active',!!r.locked);}
  function setEditing(on){if(!horDeveloperToolsEnabled())on=false;editing=!!on;document.documentElement.classList.toggle('sol-studio-editing',editing);ensurePanel().classList.toggle('hidden',!editing);if(editing)restorePanelPosition();if(!editing){picking=false;document.documentElement.classList.remove('sol-studio-picking');document.querySelectorAll('.sol-studio-target').forEach(x=>x.classList.remove('sol-studio-target'));}}
  function toggle(){setEditing(!editing);}
  function ensureButton(){const toolbar=q('#topToolbar')||q('.toolbar');if(!toolbar||q('#btnSolStudio'))return;const old=q('#btnSolLayout');if(old)old.remove();const b=document.createElement('button');b.type='button';b.id='btnSolStudio';b.className='icon-btn developer-only hidden sol-studio-launch';b.title='SOL Visual Layout Studio';b.innerHTML='✥ <span>SOL Studio</span>';b.onclick=e=>{e.preventDefault();toggle();};const more=toolbar.querySelector('.game-more');toolbar.insertBefore(b,more||null);}
  document.addEventListener('pointerdown',e=>{if(!editing||e.target.closest('#solStudioPanel'))return;if(picking){e.preventDefault();e.stopPropagation();setTarget(e.target);return;}if(!target||!target.contains(e.target))return;const r=recFor();if(r.locked)return;e.preventDefault();e.stopPropagation();pushHistory();drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,x:r.x,y:r.y};try{target.setPointerCapture(e.pointerId)}catch(_){}target.classList.add('sol-studio-dragging');},true);
  document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();const r=recFor();r.x=snap(drag.x+e.clientX-drag.sx);r.y=snap(drag.y+e.clientY-drag.sy);saveRec(r);applyRec(target,targetKey);paint();},true);
  document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;target&&target.classList.remove('sol-studio-dragging');drag=null;},true);
  document.addEventListener('keydown',e=>{if(!editing||!targetKey||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement&&document.activeElement.tagName))return;if(e.ctrlKey&&e.key.toLowerCase()==='z'){e.preventDefault();return e.shiftKey?redo():undo();}if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();return redo();}const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d)return;e.preventDefault();const step=(e.shiftKey?10:1)*grid;mut(r=>{if(!r.locked){r.x=snap(r.x+d[0]*step);r.y=snap(r.y+d[1]*step);}});},true);
  addEventListener('resize',()=>{restorePanelPosition();paint();});
  document.addEventListener('DOMContentLoaded',()=>{try{document.getElementById('btnSolStudio')?.remove();document.getElementById('solStudioPanel')?.remove();}catch(_){} applySavedOnce();});
  window.HORSolVisualStudio={apply:applySavedOnce,export:()=>JSON.stringify(readAll(),null,2)};
})();;


// Rook574 live theme bootstrap (diagnostic UI retired)
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{try{horSetThemeIndex(horCurrentHandVisualIndex(),false);}catch(e){}});else{try{horSetThemeIndex(horCurrentHandVisualIndex(),false);}catch(e){}}


/* Rook596: collapsible top match board. Presentation only. */
(function(){
  function initR596ScoreCollapse(){
    const bar=document.getElementById('topBar'), btn=document.getElementById('btnScoreCollapse');
    if(!bar||!btn||btn.__r596Bound)return; btn.__r596Bound=true;
    const paint=()=>{const c=bar.classList.contains('score-collapsed');btn.setAttribute('aria-expanded',String(!c));btn.title=c?'Expand match scoreboard':'Collapse match scoreboard';};
    btn.addEventListener('click',()=>{bar.classList.toggle('score-collapsed');paint();}); paint();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initR596ScoreCollapse,{once:true});else initR596ScoreCollapse();
})();


/* Rook626 — POSITION EVIDENCE + RELIABLE DIAGNOSTICS
   Clean evolution of Rook623. Diagnostic-only; gameplay rules/AI decisions are untouched. */
(function(){
 if(window.__gh626)return; window.__gh626=1;
 const $q=s=>bar.querySelector(s)||document.querySelector(s);
 const qs=e=>e?(e.id?'#'+CSS.escape(e.id):e.tagName.toLowerCase()+([...e.classList].slice(0,3).map(x=>'.'+CSS.escape(x)).join(''))):'';
 const isTool=e=>e&&e.closest&&e.closest('#gh624bar,#gh624finder,#gh624outline,#gh625sync,#gh626mini');
 const visible=e=>{if(!e||isTool(e))return false;let r=e.getBoundingClientRect(),c=getComputedStyle(e);return (r.width||r.height)&&c.display!=='none'&&c.visibility!=='hidden'&&+c.opacity!==0};
 const rect=e=>{let r=e.getBoundingClientRect();return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1)}};
 const timeline=[], deep=[], mutations=[], uniqueStates={}; const fpIndex=new Map();
 let seq=0,timer=0,stateSeq=0,drag=null;
 const test={active:false,gamesDone:0,target:5,startedAt:0,oldSpeed:'normal',oldSolSpeed:1,lastWinSig:'',stopping:false};
 const syncEvents=[]; let syncSeq=0,syncTicker=0,syncFlashTimer=0;

 function kind(){
  // Rook626: classify only production UI that is ACTUALLY visible. Generic
  // '*menu*' matching mislabeled gameplay because persistent menu descendants
  // can exist while their overlay is hidden. Record the exact evidence selector.
  const tests=[
   ['BID',['#decisionConsole']],
   ['TRUMP',['#actionPanel.trump-showdown']],
   ['DISCARD',['#discardOverlay','[id*=\"discard\" i]','[class*=\"discard\" i]']],
   ['RESULTS',['#winOverlay','#celePage']],
   ['MENU',['#hostOptionsModal']],
   ['POPUP',['[role=\"dialog\"]','.modal','[class*=\"popup\" i]']]
  ];
  for(const [name,sels] of tests) for(const sel of sels) try{
    const hit=[...document.querySelectorAll(sel)].find(e=>visible(e));
    if(hit) return {name,evidence:qs(hit)};
  }catch(e){}
  return {name:'GAME',evidence:'production-table'};
 }
 function lite(){
  return [...document.querySelectorAll('body *')].filter(visible).map(e=>{let r=rect(e),c=getComputedStyle(e);return {s:qs(e),p:qs(e.parentElement),...r,z:c.zIndex,cls:(typeof e.className==='string'?e.className:'').slice(0,120)};});
 }
 function fp(k,list){return k+'|'+list.map(x=>[x.s,x.p,Math.round(x.x),Math.round(x.y),Math.round(x.w),Math.round(x.h),x.cls].join(':')).join('|')}
 function deepCapture(k,n){
   const cand=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&(/bid|trump|discard|menu|modal|popup|action|spinner|spin|stamp|moon|anim/i.test((e.id||'')+' '+e.className+' '+(e.getAttribute('data-state')||'')))).slice(0,45);
   deep.push({n,state:k,items:cand.map(e=>{let c=getComputedStyle(e),r=rect(e);return {s:qs(e),p:qs(e.parentElement),...r,cls:e.className||'',text:(e.innerText||'').trim().replace(/\s+/g,' ').slice(0,100),css:{position:c.position,left:c.left,top:c.top,right:c.right,bottom:c.bottom,transform:c.transform,z:c.zIndex,display:c.display,visibility:c.visibility,overflow:c.overflow,animation:c.animation,transition:c.transition},before:{content:getComputedStyle(e,'::before').content,animation:getComputedStyle(e,'::before').animation,transform:getComputedStyle(e,'::before').transform},after:{content:getComputedStyle(e,'::after').content,animation:getComputedStyle(e,'::after').animation,transform:getComputedStyle(e,'::after').transform}};})});
   if(deep.length>180)deep.shift();
 }
 function capture(reason,force=false){
  const els=lite(),ks=kind(),k=ks.name,f=fp(k,els); let id=fpIndex.get(f),isNew=!id;
  if(isNew){id='S'+(++stateSeq);fpIndex.set(f,id);uniqueStates[id]={id,state:k,firstSeen:Date.now(),occurrences:0,viewport:[innerWidth,innerHeight,devicePixelRatio],elements:els};}
  uniqueStates[id].occurrences++;
  const important=(isNew||force)&&/BID|TRUMP|DISCARD|MENU|POPUP/.test(k);const syncId=(test.active&&important)?syncMark('state',k+' '+id,true):null;
  timeline.push({n:++seq,t:Date.now(),state:k,stateEvidence:ks.evidence,reason,stateRef:id,newState:isNew,syncId,elapsedMs:test.startedAt?Date.now()-test.startedAt:null});
  if(timeline.length>2400)timeline.shift();
  if(important)deepCapture(k,seq);
  paintStatus();
 }
 function schedule(r){clearTimeout(timer);timer=setTimeout(()=>capture(r),180)}
 function paintStatus(extra){
   if(!status)return;
   status.textContent=extra||(test.active?`AUTO TEST • GAME ${Math.min(test.gamesDone+1,test.target)}/${test.target} • RECORDING`:`AUTO MAP • ${Object.keys(uniqueStates).length} UNIQUE • ${kind().name}`);
 }
 const mo=new MutationObserver(ms=>{let meaningful=false;for(const m of ms){if(isTool(m.target))continue;mutations.push({t:Date.now(),type:m.type,target:qs(m.target),attr:m.attributeName||''});if(/class|style|hidden|aria-hidden/.test(m.attributeName||'')||m.addedNodes.length||m.removedNodes.length)meaningful=true;}if(mutations.length>3000)mutations.splice(0,500);if(meaningful)schedule('ui-change');});
 mo.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
 addEventListener('resize',()=>capture('resize',true),{passive:true});

 const bar=document.createElement('div');bar.id='gh624bar';
 bar.innerHTML='<b id="gh624drag" title="Drag mapper">AUTO MAP ↕</b><span id="gh624status">STARTING</span><button id="gh624test">AUTO TEST ×5</button><button id="gh624stop" disabled>STOP TEST</button><button id="gh626collapse">COLLAPSE</button><span>BOT:</span><button data-sp="blitz">BLITZ</button><button data-sp="normal">NORMAL</button><button data-sp="slow">SLOW</button><button id="gh624find">FIND ELEMENT</button><button id="gh624flag">FLAG</button><button id="gh624export">EXPORT</button>';
 Object.assign(bar.style,{position:'fixed',left:'2px',bottom:'2px',zIndex:'2147483647',display:'flex',gap:'4px',alignItems:'center',flexWrap:'wrap',padding:'4px 6px',background:'#050505',color:'#fff',border:'1px solid #ffd65a',borderRadius:'6px',font:'700 10px Arial',maxWidth:'calc(100vw - 4px)',touchAction:'none'});
 /* Rook687: keep legacy mapper code available internally, but do not expose its production UI. */
 const status=bar.querySelector('#gh624status');
 const sync=document.createElement('div');sync.id='gh625sync';sync.hidden=true;
 sync.innerHTML='<div id="gh625syncMain">VIDEO SYNC</div><div id="gh625syncSub">READY</div>';
 Object.assign(sync.style,{position:'fixed',left:'50%',top:'8px',transform:'translateX(-50%)',zIndex:'2147483645',pointerEvents:'none',minWidth:'230px',padding:'8px 12px',background:'rgba(0,0,0,.92)',color:'#fff',border:'3px solid #ffd65a',borderRadius:'8px',textAlign:'center',font:'900 16px Arial',letterSpacing:'.5px',boxShadow:'0 0 0 2px #000'});document.body.appendChild(sync);
 const mini=document.createElement('button');mini.id='gh626mini';mini.hidden=true;mini.textContent='AUTO TEST';Object.assign(mini.style,{position:'fixed',right:'4px',bottom:'4px',zIndex:'2147483647',padding:'7px 9px',background:'#050505',color:'#ffd65a',border:'1px solid #ffd65a',borderRadius:'6px',font:'800 10px Arial'}); /* Rook687: intentionally not mounted in normal gameplay. */
 function setCollapsed(on){const collapsed=!!on;bar.hidden=collapsed;bar.style.setProperty('display',collapsed?'none':'flex','important');mini.hidden=!collapsed;mini.style.setProperty('display',collapsed?'block':'none','important');mini.textContent=test.active?('TEST '+Math.min(test.gamesDone+1,test.target)+'/'+test.target+' • '+elapsed()):'AUTO MAP';}
 mini.onclick=()=>setCollapsed(false);
 function elapsed(){const ms=Math.max(0,Date.now()-(test.startedAt||Date.now())),sec=Math.floor(ms/1000);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
 function syncPaint(main,sub){sync.hidden=false;sync.style.setProperty('display','block','important');$q('#gh625syncMain').textContent=main;$q('#gh625syncSub').textContent=sub||'';}
 function syncMark(type,label,flash=true){const id='SYNC-'+String(++syncSeq).padStart(4,'0'),ev={id,n:syncSeq,t:Date.now(),elapsedMs:test.startedAt?Date.now()-test.startedAt:0,game:test.active?Math.min(test.gamesDone+1,test.target):test.gamesDone,type,label:label||type};syncEvents.push(ev);if(syncEvents.length>1200)syncEvents.shift();if(flash){clearTimeout(syncFlashTimer);syncPaint(id+' • '+(label||type),test.active?('GAME '+Math.min(test.gamesDone+1,test.target)+'/'+test.target+' • '+elapsed()):'VIDEO MARK');sync.style.background='rgba(110,0,0,.96)';syncFlashTimer=setTimeout(()=>{sync.style.background='rgba(0,0,0,.92)'},900)}return id}
 function startSyncTicker(){clearInterval(syncTicker);syncTicker=setInterval(()=>{if(test.active){syncPaint('VIDEO SYNC • '+elapsed(),'GAME '+Math.min(test.gamesDone+1,test.target)+'/'+test.target+' • LAST '+(syncEvents.length?syncEvents[syncEvents.length-1].id:'—'));if(!mini.hidden)mini.textContent='TEST '+Math.min(test.gamesDone+1,test.target)+'/'+test.target+' • '+elapsed();}},250)}
 function stopSyncTicker(){clearInterval(syncTicker);syncTicker=0}
 function countdown(done){let n=3;syncPaint('VIDEO SYNC • 3','AUTO TEST STARTING');const iv=setInterval(()=>{n--;if(n>0){syncPaint('VIDEO SYNC • '+n,'AUTO TEST STARTING');return}clearInterval(iv);syncPaint('VIDEO SYNC • GO','GAME 1/'+test.target);syncMark('test-start','AUTO TEST START',false);setTimeout(done,350)},850)}
 bar.querySelectorAll('button').forEach(b=>Object.assign(b.style,{padding:'4px 6px',font:'700 10px Arial'}));
 const handle=$q('#gh624drag');handle.style.cursor='move';
 function dragStart(ev){if(ev.target!==handle)return;const r=bar.getBoundingClientRect();drag={dx:ev.clientX-r.left,dy:ev.clientY-r.top};bar.style.right='auto';bar.style.bottom='auto';handle.setPointerCapture?.(ev.pointerId);ev.preventDefault();}
 function dragMove(ev){if(!drag)return;const x=Math.max(0,Math.min(innerWidth-bar.offsetWidth,ev.clientX-drag.dx)),y=Math.max(0,Math.min(innerHeight-bar.offsetHeight,ev.clientY-drag.dy));bar.style.left=x+'px';bar.style.top=y+'px';}
 function dragEnd(){drag=null;}
 handle.addEventListener('pointerdown',dragStart);handle.addEventListener('pointermove',dragMove);handle.addEventListener('pointerup',dragEnd);handle.addEventListener('pointercancel',dragEnd);

 function paintSpeed(){bar.querySelectorAll('[data-sp]').forEach(b=>{b.style.outline=(b.dataset.sp===(typeof window.__ghGetBotSpeed623==='function'?window.__ghGetBotSpeed623():'normal')?'2px solid #ffd65a':'none')});}
 bar.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{if(typeof window.__ghSetBotSpeed623==='function')window.__ghSetBotSpeed623(b.dataset.sp);paintSpeed();capture('bot-speed-'+b.dataset.sp,true);});
 $q('#gh626collapse').onclick=()=>setCollapsed(true);

 const finder=document.createElement('div');finder.id='gh624finder';finder.hidden=true;
 finder.innerHTML='<div><b>FIND / SELECT ELEMENT</b> <button id="gh624close">X</button></div><input id="gh624search" placeholder="spinner, spin, stamp, moon, bid, trump…" style="width:96%;margin:5px 0"><div id="gh624results" style="max-height:42vh;overflow:auto"></div>';
 Object.assign(finder.style,{position:'fixed',left:'6px',right:'6px',top:'6px',zIndex:'2147483647',padding:'8px',background:'#080808',color:'#fff',border:'2px solid #ffd65a',font:'12px Arial'});document.body.appendChild(finder);
 const outline=document.createElement('div');outline.id='gh624outline';outline.hidden=true;Object.assign(outline.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483646',border:'3px solid #ff3b30',boxSizing:'border-box'});document.body.appendChild(outline);
 function highlight(e){let r=e.getBoundingClientRect();Object.assign(outline.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});outline.hidden=false;paintStatus(`SELECTED ${qs(e)} X${Math.round(r.x)} Y${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}`);capture('selected-'+qs(e),true);}
 function search(){let q=$q('#gh624search').value.trim().toLowerCase(),all=[...document.querySelectorAll('body *')].filter(visible);let a=all.filter(e=>{let s=((e.id||'')+' '+(typeof e.className==='string'?e.className:'')+' '+(e.innerText||'')).toLowerCase();return !q||s.includes(q)}).slice(0,80);$q('#gh624results').innerHTML='';a.forEach(e=>{let r=rect(e),b=document.createElement('button');b.textContent=`${qs(e)}  X${r.x} Y${r.y} ${r.w}×${r.h}`;Object.assign(b.style,{display:'block',width:'100%',textAlign:'left',margin:'2px 0',padding:'5px'});b.onclick=()=>highlight(e);$q('#gh624results').appendChild(b)});}
 $q('#gh624find').onclick=()=>{finder.hidden=false;$q('#gh624search').value='spin';search();$q('#gh624search').focus()};$q('#gh624close').onclick=()=>finder.hidden=true;$q('#gh624search').oninput=search;$q('#gh624flag').onclick=()=>capture('manual-flag',true);

 function stopTest(reason){if(!test.active||test.stopping)return;test.stopping=true;syncMark('test-stop',reason==='complete'?'AUTO TEST COMPLETE':'AUTO TEST STOPPED',true);capture('auto-test-stop-'+reason,true);test.active=false;stopSyncTicker();try{horSetSolBotRequested(false);horApplySolBotAtHandBoundary();}catch(e){}try{window.HOR_SOL_SPEED=test.oldSolSpeed||1;document.body.classList.remove('hor-auto-test-fast');}catch(e){}try{if(typeof window.__ghSetBotSpeed623==='function')window.__ghSetBotSpeed623(test.oldSpeed||'normal');}catch(e){}$q('#gh624test').disabled=false;$q('#gh624stop').disabled=true;paintSpeed();paintStatus(reason==='complete'?`AUTO TEST COMPLETE • ${test.gamesDone}/${test.target} GAMES • READY TO EXPORT`:`AUTO TEST STOPPED • ${test.gamesDone}/${test.target} COMPLETE • READY TO EXPORT`);setTimeout(()=>{sync.hidden=true;sync.style.display='none';},2200);setCollapsed(false);test.stopping=false;}
 function startTest(){if(test.active)return;if(!isHost||myIndex<0){paintStatus('AUTO TEST REQUIRES HOST SEAT');return;}test.active=true;test.gamesDone=0;test.startedAt=Date.now();test.lastWinSig='';syncEvents.length=0;syncSeq=0;test.oldSpeed=typeof window.__ghGetBotSpeed623==='function'?window.__ghGetBotSpeed623():'normal';test.oldSolSpeed=window.HOR_SOL_SPEED||1;window.HOR_SOL_SPEED=4;document.body.classList.add('hor-auto-test-fast');if(typeof window.__ghSetBotSpeed623==='function')window.__ghSetBotSpeed623('blitz');try{horSetSolBotRequested(true);horApplySolBotAtHandBoundary();}catch(e){}$q('#gh624test').disabled=true;$q('#gh624stop').disabled=false;paintSpeed();paintStatus();countdown(()=>{if(!test.active)return;startSyncTicker();setCollapsed(true);capture('auto-test-start',true);try{hostStartGame();}catch(e){console.error('[AUTO TEST start]',e);stopTest('start-error');}})}
 $q('#gh624test').onclick=startTest;$q('#gh624stop').onclick=()=>stopTest('manual');
 window.__ghAutoTestActive=()=>test.active;
 window.__ghAutoTestShouldRematch=()=>test.active&&test.gamesDone<test.target;
 window.__ghAutoTestState=()=>({...test});
 setInterval(()=>{if(!test.active)return;try{const ov=document.getElementById('winOverlay');const vis=ov&&!ov.classList.contains('hidden')&&getComputedStyle(ov).display!=='none';if(vis){const sig=JSON.stringify((game&&game.scores)||[])+'|'+((handHistory&&handHistory.length)||0);if(sig!==test.lastWinSig){test.lastWinSig=sig;test.gamesDone++;syncMark('game-complete','GAME '+test.gamesDone+'/'+test.target+' COMPLETE',true);capture('auto-test-game-'+test.gamesDone+'-complete',true);if(test.gamesDone>=test.target){stopTest('complete');return;}if(test.gamesDone===4){window.HOR_SOL_SPEED=1;document.body.classList.remove('hor-auto-test-fast');if(typeof window.__ghSetBotSpeed623==='function')window.__ghSetBotSpeed623('normal');syncMark('speed','GAME 5 NORMAL SPEED',true);capture('game-5-normal-speed',true);}paintStatus();}}}catch(e){}},250);

 $q('#gh624export').onclick=()=>{capture('export',true);const data={tool:'Rook626 Position Repair + Reliable Auto Map + Video Sync',build:626,botSpeed:(typeof window.__ghGetBotSpeed623==='function'?window.__ghGetBotSpeed623():'unknown'),autoTest:{active:test.active,gamesDone:test.gamesDone,target:test.target,startedAt:test.startedAt},videoSync:{format:'SYNC-####',events:syncEvents},summary:{uniqueStates:Object.keys(uniqueStates).length,timelineEvents:timeline.length,deepCaptures:deep.length,mutations:mutations.length},uniqueStates,timeline,deep,mutations};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ROOK626_AUTO_GAME_MAP.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);paintStatus(`EXPORTED ${Object.keys(uniqueStates).length} UNIQUE STATES`);};
 setTimeout(()=>{capture('startup',true);paintSpeed()},250);
})();


/* R706: permanent header, visible layout-tool owner and shared decision portal.
   This code only owns presentation. R705's pace governor/timers are unchanged. */
(function initR706TablePresentation(){
  function init(){
    const row=document.getElementById('scoreSpeed701');
    if(!row || row.__r706Bound)return;
    row.__r706Bound=true;
    row.querySelectorAll('[data-score-pace]').forEach(b=>b.addEventListener('click',e=>{
      e.preventDefault();horSetGamePace(b.dataset.scorePace);
    }));
    // The app is visibility:hidden in landscape. These permanent owners must
    // not inherit that state; no orientation handler clones or reparents them.
    const bar=document.getElementById('topBar');
    const portal=document.getElementById('bidOverlayHost');
    const clearance=document.createElement('div');clearance.id='headerClearance706';clearance.setAttribute('aria-hidden','true');bar.before(clearance);
    document.body.append(bar,portal);
    const clearHeader=()=>{const size=bar.classList.contains('score-collapsed')?42:Math.ceil(bar.getBoundingClientRect().bottom+8);clearance.style.height=size+'px';clearance.style.minHeight=size+'px';clearance.style.flexBasis=size+'px';};
    new MutationObserver(clearHeader).observe(bar,{attributes:true,attributeFilter:['class']});
    new ResizeObserver(clearHeader).observe(bar);clearHeader();
    const layout=document.getElementById('ghTopLayout693');
    if(layout)layout.addEventListener('click',()=>window.HORCompactLayout?.toggle());
    horSetGamePace(horGamePace);
    const dock=document.getElementById('decisionConsole');
    const sync=()=>{
      const bidding=dock.classList.contains('decision-mode-bid')&&!dock.classList.contains('hidden');
      document.body.classList.toggle('r706-bid-open',bidding);
      if(bidding){
        const seat=document.getElementById('slot-me');
        const box=dock.getBoundingClientRect();
        // Portrait bidding never owns the locked human seat position.
        // Preserve the inherited landscape measurement path.
        if(!matchMedia('(orientation:portrait)').matches){
          // Containment and translated avatar/name descendants extend beyond
          // the slot's box. Measure their visual bottom in the containing block.
          document.body.style.setProperty('--r706-human-top','0px');
          const parts=seat?[seat,...seat.querySelectorAll('.seat-avatar,.name,.bid-badge')]:[];
          const bottom=Math.max(0,...parts.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect().bottom));
          document.body.style.setProperty('--r706-human-top',(box.top-bottom-8)+'px');
        }
        try{positionSeatBidBadges();positionSeatLeadTags();positionBotThinkingAtSeat();}catch(e){}
        document.body.style.setProperty('--r706-nest-rise','0px');
        document.body.style.setProperty('--r706-nest-scale','1');
        if(matchMedia('(orientation:portrait)').matches){
          const face=document.querySelector('#nestArea .nest-stay-face,#nestArea .table-nest-flip');
          const avatar=seat?.querySelector('.seat-avatar');
          const partner=document.querySelector('#slot-partner .seat-avatar');
          if(face&&avatar&&partner){
            const tag=seat.querySelector('.seat-lead-tag:not(.hidden)');
            const ceiling=partner.getBoundingClientRect().bottom+8;
            const thinking=seat.querySelector('#botThinking:not(.hidden)');
            const floor=Math.min(avatar.getBoundingClientRect().top,tag?.getBoundingClientRect().top||Infinity,thinking?.getBoundingClientRect().top||Infinity)-8;
            const n=face.getBoundingClientRect();
            if(n.bottom>floor){
              const fit=Math.min(1,Math.max(.4,(floor-ceiling)/Math.max(1,n.height)));
              document.body.style.setProperty('--r706-nest-scale',String(fit));
              document.body.style.setProperty('--r706-nest-rise',(floor-face.getBoundingClientRect().bottom)+'px');
            }
          }
        }
        try{positionSeatBidBadges();positionSeatLeadTags();scheduleNestAlignment033();}catch(e){}

      }
    };
    new MutationObserver(sync).observe(dock,{attributes:true,childList:true,attributeFilter:['class']});
    new ResizeObserver(sync).observe(dock);
    new ResizeObserver(sync).observe(clearance);
    addEventListener('resize',sync);
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

// Keep the approved composition attached to the background's cover scale.
function positionPlayedPlane027() {
  if (!matchMedia('(orientation: portrait)').matches || window._trickCapturing) return;
  const scale = Math.max(innerWidth / 875, innerHeight / 1797) / (915 / 1797);
  document.querySelectorAll('#trickArea .table003-played').forEach(w => {
    w.style.setProperty('--rook027-scale', scale);
    w.style.setProperty('width', (88 * scale) + 'px', 'important');
    w.style.setProperty('height', (126 * scale) + 'px', 'important');
    const x = innerWidth / 2 + (Number(w.dataset.planeX) - 206) * scale - 44 * scale;
    const y = Number(w.dataset.planeY) * scale - 63 * scale;
    const r = w.getBoundingClientRect();
    w.style.setProperty('left', (parseFloat(w.style.left) + x - r.left) + 'px', 'important');
    w.style.setProperty('top', (parseFloat(w.style.top) + y - r.top) + 'px', 'important');
  });
}
window.addEventListener('resize', positionPlayedPlane027);

// ROOK029: settle after renderer wrappers and saved layout restoration.
let bottomAvatarFrame029 = 0;
function scheduleBottomAvatar029() {
  if (bottomAvatarFrame029) return;
  bottomAvatarFrame029 = requestAnimationFrame(() => {
    bottomAvatarFrame029 = 0;
    positionBottomAvatar029();
  });
}
function positionBottomAvatar029() {
  const slot = document.getElementById('slot-me');
  if (!isPortraitViewport()) {
    if (slot && slot.__rook029PriorTranslate) {
      const prior = slot.__rook029PriorTranslate;
      if (prior.value) slot.style.setProperty('translate', prior.value, prior.priority);
      else slot.style.removeProperty('translate');
      delete slot.__rook029PriorTranslate;
    }
    return;
  }
  if (!document.body.classList.contains('in-game')) return;
  const avatar = slot && slot.querySelector('.seat-avatar');
  if (!avatar) return;
  const r = avatar.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const delta = innerWidth / 2 - (r.left + r.width / 2);
  if (Math.abs(delta) < .25) return;
  const parent = slot.parentElement;
  const parentScale = parent && parent.offsetWidth ? parent.getBoundingClientRect().width / parent.offsetWidth : 1;
  if (!slot.__rook029PriorTranslate) slot.__rook029PriorTranslate = {value:slot.style.getPropertyValue('translate'),priority:slot.style.getPropertyPriority('translate')};
  const translation = getComputedStyle(slot).translate;
  const parts = translation === 'none' ? ['0px','0px'] : translation.split(/\s+/);
  const x = parseFloat(parts[0]) || 0;
  const y = parts[1] || '0px';
  // Direct inline ownership defeats an older mapper's inline !important rule.
  slot.style.setProperty('translate', `${x + delta / Math.max(.01, parentScale)}px ${y}`, 'important');
  try { positionSeatLeadTags(); positionSeatBidBadges(); positionBotThinkingAtSeat(); } catch (e) {}
}
window.addEventListener('resize', scheduleBottomAvatar029);
window.addEventListener('orientationchange', scheduleBottomAvatar029);

// An independent viewport control avoids inherited zero-size/popover clipping.
function positionPortraitLastTrickClose030() {
  const close = $('portraitLastTrickClose'), pop = $('portraitLastTrickPopover'), cards = $('portraitLastTrickCards');
  if (!close || !pop || !cards) return;
  if (pop.classList.contains('hidden') || !isPortraitViewport()) {
    close.style.setProperty('display','none','important');
    return;
  }
  if (close.parentNode !== document.body) document.body.appendChild(close);
  const boxes = Array.from(cards.children).map(c => c.getBoundingClientRect());
  const left = boxes.length === 4 ? Math.min(...boxes.map(r => r.left)) : 28;
  const centerY = boxes.length === 4 ? (Math.min(...boxes.map(r => r.top)) + Math.max(...boxes.map(r => r.bottom))) / 2 : 389;
  close.style.cssText = `position:fixed!important;left:${Math.min(innerWidth-32,Math.max(0,left-32))}px!important;top:${Math.max(0,centerY-14)}px!important;right:auto!important;bottom:auto!important;width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;z-index:2147483647!important;padding:0!important;margin:0!important;transform:none!important;translate:none!important;scale:1!important;align-items:center!important;justify-content:center!important;color:#f3e4b5!important;background:#121b14!important;border:1px solid #b89249!important;border-radius:50%!important;font:700 20px/1 system-ui,sans-serif!important;`;
}

// Match the visible Nest bottom to the head in the actual TABLE-003 background.
function scheduleNestAlignment033() {
  if (window.__nestAlignmentFrame033) return;
  window.__nestAlignmentFrame033 = requestAnimationFrame(() => {
    window.__nestAlignmentFrame033 = 0;
    positionNestAlignment033();
  });
}
function tableSceneAnchor033(imageY) {
  const bg = $('hor-room-bg');
  const r = bg ? bg.getBoundingClientRect() : {top:0,width:innerWidth,height:innerHeight};
  return r.top + imageY * Math.max(r.width / 875, r.height / 1797);
}
function positionNestAlignment033() {
  const area = $('nestArea');
  const pile = area && area.querySelector('.table-nest-pile');
  if (!pile) return;
  if (!isPortraitViewport()) { pile.style.removeProperty('translate'); return; }
  if (area.classList.contains('hidden')) return;
  if (restoreNestPlacement039()) return;
  const face = pile.querySelector('.nest-stay-face, .table-nest-flip, .table-nest-top');
  if (!face) return;
  const rect = face.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  // Approximate top edge of the Griffin's head on the 875 x 1797 source artwork.
  const targetBottom = tableSceneAnchor033(800);
  const parentScale = area.offsetWidth ? area.getBoundingClientRect().width / area.offsetWidth : 1;
  const current = getComputedStyle(pile).translate;
  const parts = current === 'none' ? ['0px','0px'] : current.split(/\s+/);
  const y = parseFloat(parts[1]) || 0;
  const delta = targetBottom - rect.bottom;
  if (Math.abs(delta) > .25) pile.style.setProperty('translate', `${parts[0] || '0px'} ${y + delta / Math.max(.01,parentScale)}px`, 'important');
  window.__nestPlacement039={key:nestPlacementKey039(),translate:getComputedStyle(pile).translate};
}
function positionShuffleWash033() {
  const ov = $('shuffleOverlay');
  if (!ov || !isPortraitViewport()) return;
  const scale = Math.max(innerWidth / 875, innerHeight / 1797) / (915 / 1797);
  ov.style.setProperty('--rook033-wash-scale', String(scale));
  ov.style.setProperty('--rook033-wash-x', (innerWidth / 2) + 'px');
  ov.style.setProperty('--rook033-wash-y', tableSceneAnchor033(840) + 'px');
}
window.addEventListener('resize', () => { scheduleNestAlignment033(); positionShuffleWash033(); });
window.addEventListener('orientationchange', scheduleNestAlignment033);

function activeBidSurface034() {
  const dock = $('decisionConsole');
  if (!isPortraitViewport() || !dock || dock.classList.contains('hidden') || !dock.classList.contains('decision-mode-bid')) return null;
  return dock.querySelector('.approved-bid-surface') || dock;
}
function positionBidTurn034(el) {
  const surface = activeBidSurface034();
  if (!surface || !el || el.dataset.humanTurn !== '1' || el.classList.contains('hidden')) return false;
  const box = surface.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  if (el.parentNode !== document.body) document.body.appendChild(el);
  el.style.cssText = `position:fixed!important;left:${box.left+box.width/2}px!important;top:${box.top-9}px!important;right:auto!important;bottom:auto!important;transform:translate(-50%,-100%)!important;translate:none!important;scale:1!important;margin:0!important;z-index:2147483601!important;pointer-events:none!important;`;
  return true;
}
function syncPresentation034() {
  const surface = activeBidSurface034();
  const controls = document.querySelector('.in-game-leave');
  if (controls) positionRailControls035(controls);
  positionBidTurn034($('botThinking'));
  syncQuietFire034();
}
function syncQuietFire034() {
  const bg = $('hor-room-bg');
  if (!bg) return;
  let patch = $('quietFire034');
  if (!patch) {
    patch = document.createElement('div'); patch.id='quietFire034'; patch.setAttribute('aria-hidden','true');
    patch.innerHTML='<div class="quiet-fire-sample034"></div>'; bg.appendChild(patch);
  }
  let glow = $('fireGlow059');
  if (!glow) {
    glow = document.createElement('div'); glow.id='fireGlow059'; glow.setAttribute('aria-hidden','true');
    glow.innerHTML='<div class="fire-glow-pulse059"></div>'; bg.appendChild(glow);
  }
  const r = bg.getBoundingClientRect();
  const scale = Math.max(r.width/875,r.height/1797);
  patch.style.setProperty('left',(r.left+(r.width-875*scale)/2+610*scale)+'px');
  patch.style.setProperty('top',(r.top+390*scale)+'px');
  patch.style.setProperty('transform',`scale(${scale})`);
  glow.style.setProperty('left',(r.left+(r.width-875*scale)/2+610*scale)+'px');
  glow.style.setProperty('top',(r.top+390*scale)+'px');
  glow.style.setProperty('transform',`scale(${scale})`);
}
(function initPresentation034() {
  function init() {
    const dock = $('decisionConsole');
    let frame=0;
    const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;syncPresentation034();});};
    if(dock) {
      new MutationObserver(schedule).observe(dock,{attributes:true,childList:true,subtree:true,attributeFilter:['class']});
      new ResizeObserver(schedule).observe(dock);
    }
    window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

// ROOK035: approved recordings with pitch-preserving edits for each pace.
const recordedPCM035 = {"wash-1x":"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Tv9P/1P/Vf9X/1z/Zf9u/3H/cP9y/3n/gv+M/5n/pv+s/67/tP+8/7//wf/D/8f/0f/d/+j/7v/y//b//P8AAAMACQALAA4AFQAZABkAGwAeACIAIgAlACoAMgA6AD8AQgBGAEsATwBRAFEAVwBeAGMAZQBmAGoAbwB4AIAAhgCLAI8AkQCVAJUAkgCNAIsAjgCSAJcAmACVAI8AjQCUAJ4AqACuALEAswC4AMAAyADRANQA0wDPAMsAzADRANMA0ADQANIA2gDfAN4A3QDdAN0A3QDhAOMA4gDiAOYA7gDzAPEA8ADuAOoA5gDmAOoA7QDwAPAA6wDpAOsA7ADqAOcA6gD2AP8A9wDmAN8A3wDgAOAA4gDpAO0A7ADkANsA2QDcAOMA7AD0APEA5gDbANUA1ADZANwA2gDUANQA2wDkAOcA4QDWAMwAxQDEAMUAxADAALgArQCmAKIAngCdAKAAowCfAJYAjwCNAJIAmQCaAJQAkACSAJEAiwCDAHwAdgBwAGwAawBqAGoAZQBfAFcATABFAD4ANwA0ADIAKwAiABYABwD6//P/6v/f/9b/zv/D/7v/tv+z/67/o/+c/57/of+e/5j/kv+N/4n/if+J/4b/f/91/3L/cP9n/1z/Uv9M/0n/RP87/zP/Lf8m/yD/Gf8W/xb/Ff8U/xT/Fv8W/xb/Ff8T/xP/Fv8W/xT/FP8X/xj/F/8V/xT/Ff8Y/x7/I/8o/yv/Kv8o/yb/Kf8r/yz/LP8r/yv/LP8s/yr/JP8c/xf/Gf8d/x7/Gv8e/yf/MP82/zf/Of88/z7/Qf9G/0n/TP9S/1j/Wv9b/1r/Vf9W/1j/V/9W/1n/Zf9y/3n/ff9+/37/gf+G/4j/iP+F/4b/i/+U/53/n/+g/6P/p/+q/6n/qP+r/67/rf+s/63/r/+x/7f/wv/Q/9n/3f/h/+f/6//r/+r/8P/6//7/+P/z//X//v8GAA0ADQAIAAYACwATAB8ALAA0ADUANwA5ADkAPAA+AD8AQQBAAD4APwA+AEQATwBWAFcAVgBWAFsAYwBoAGsAcAB2AHgAfACHAJIAmACbAJsAmwCfAKEAoACiAKYArACxALMAtgC4ALsAvAC+AMUAzgDUANMAywDGAMUAwQDAAMMAxQDCAL8AwQDIAM0AzADIAMUAxgDKAM8A0wDXANUA1QDaANwA3QDeAOEA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8P/x//H/8v/5//7//P/5//f/8//z/+7/4P/V/9D/1P/f/+r/8P/y//f/9v/o/+X/7f/t//L/9v/y//b/9v/1//v/+P/y//n/+/8BABcALQA1ADEAJQAbABgAGAAhAC0ALgAvAD0ASABDAD0AOAA3ADoAPABDAEsAUgBUAEwARgBFAEIAQwBMAFoAaABnAFgAUgBRAFUAVgBQAE8AUQBLAEEANwA2ADwARABLAEgAPwA5ADMANAA/AEkASQBGAD8ANAAtACUAGwAXABsAHwAhACAAIAAgABkAEwASAA0ACwASABcAIAAnACkALAAmABMABwAFAAcACwALAAsADgAPAA8AEQAXACQAKwAmABkAEAAUABoAHAAWAAsACwAWABUACQACAAMABQALAA8ABgD+//z/AAAHAAwACQALAAcAAQD//wAACQAKAPz/7v/q/+z/+f8AAP7//P/8//r//v8AAAAAAAAAAAAAAAAEAAoACAD+//T/6f/f/9n/3v/q//P/8//x//P/8P/v//j//f8AAAAA8v/p/+z/8//+//3/7//m/+T/5//n/+H/4v/n/+T/3P/c/+L/6v/u//D/8v/v/+//+f8AAAAA+//w/+7/5//Z/9r/4v/r//L/7P/s//b/7//h/93/3v/o//j/AAAAAAEA/P/3//L/7f/1/wAAAADy/97/z//N/83/0v/Z/9H/yf/E/8L/yv/X/+f/9f/4//H/7v/2/wAAAgD8//P/8v/6////AAABAAAA+//3//z/AAAAAAMAAAAAAAUACAAEAAQACwATAA0A///+/wcADwARAA4ABgAAAPr/+v8QACgAJAASAAsACgAKABgALgA1ACQADwAGAAsAIQA4ADUAJAAUAP//8v/7/woAFgABAOH/4//6/xMANwA2AP7/3P/d/9//+/8jACsACgDt/97/uv+9/wUAEgDm/+j//v8AABwARABCADMAGADe/8//EwBXAE4AGQD1/+L/3P/m//L/9f/q/9b/zP/e/wAAFAARAPz/6v/u/wMAKgA/ADUAHwAHAP3/+//t/9v/4v/9/w8ADAABAAEACQANAAMA+P/y//L/8P/1/wAAAADz/9r/uf+1/9X//v8RAAUA//8DAA0AFgAPAPf/5P/s/wIADgAIAAAA+//2/+j/3P/l//r/BQD4/9v/3v/y/+7/3f/i//D/6v/g/93/5f/8/wIA6P/M/9H/7f8AAAAA8f/o/+T/0v/R/+j/7f/j/9f/yf/P/9//4f/b/9P/yP+1/7T/4v8MAPT/v//A/8//2//s/93/2P/+/xUAHAA5AF8AeQB7AHEAgACpAMkA1wDXANsA4gDOALEApgCbAIgAaABHAD0AKgAEAOn/zP+z/6r/of+U/4r/hf+S/6r/tP+0/7L/rf+s/6z/sf/A/8n/vP+v/7H/tv+9/7//vf++/7v/tv+6/8f/2P/l/+T/2P/c/+7///8JAAsADwAcACAAGwARAAoACwAKAAYAAAD3//T/7//l/+X/5P/X/8v/yP/R/9//8v8AAAAA9v/z//j/AgASAB4AHwAnAEEATwBLAEwAUwBXAE4ARQBGAEUARwBSAFUATABJAEIAOwA5AC8AKQA0AEYARAAsABwAFQAEAPz/BAARABIADQALABEAGQAWABQAGAAYABEACAAGABAAGQALAPP/5v/h/9z/5f/r/97/0f/Q/9n/7P/y/+P/2v/e/+b/7v/u/+f/4//f/+H/7f/v/+n/4f/V/9b/3//h/+X/5v/a/9L/2P/l//P/+f/1/+//9P///wIABgAMABUAGwAUAA4AFAAbABsAFQAPABEAFwAWAA4ADQAWABsAHQAbABUAFQAfACoALQApACMAHwAeACIAJwAlACEAIgAhABoAFwAXABwAIwAjABcACQAJABUAGQAUAA0AAgD6//v/AwAHAAIA9//w/+//8f/1//P/7f/s/+v/6//w//D/8P/1//L/7P/s/+z/7//0/+7/5v/p/+v/6v/q/+j/5f/l/+n/6f/m/+X/6P/t/+//6v/j/+L/6P/u/+//7P/u/+3/6//v//X/+P/2//P/8v/3//v//f///wAAAAD+//r//v8DAAQAAwAEAAMAAgABAAMACAALAAkABAAEAAYABwAJAAsACgAHAAQABQAIAAsACwAHAAUABQAFAAYACAAIAAcABwAHAAYABAADAAUABgAFAAQABAAGAAUAAwACAAMABQADAAIAAwADAAIAAwAEAAMAAgAAAAEAAgACAAEAAAAAAAEAAQAAAAAAAAD/////AAAAAAAA/v/+//7///8AAAAAAAAAAP////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////wAAAAAAAP/////////////////////+//7///////////////7//v///////v/+//7///8AAAAAAAAAAAAA/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAgACAAIAAgACAAIAAgABAAAAAAAAAAAAAAD///////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","wash-3x":"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qf+t/67/v//H/7X/jf9+/5T/uv/a//H/9P/a/7f/qP+h/6T/qv+z/9D/CABPAFwAIgDg/7b/sf/Q/+j/8v8OAEMAUAAlAPj/7f8FADoAdgCQAHQAUABEAGEAigCVAKQAuQCzAL4A4QDoANEArwCOAIUAcQBGAEAAWQBkAFMAKQANADgAfwCVAIwAeABqAHkAlACuALoAqQCJAGwAbQCZAM8A7wDoANYAywDMANcA4gDtAOsA1gDGANAA9AAVARIBDgEVAQUB4gDFAKwApgDEAOsA/QAAAfAA0AC7ALQApgCiAMYA9gAiAU8BhQGuAbEBlgFsAT8BFwH+AAIBIAEmAfsA0wDhABgBNAEsASAB/ADBAKcA0wAQARIB5ADOAOEA+wD7APIA9QD+ABwBOgFJAUEB/wCpAHAASQARAPP/+/8LACUATQBwAHAAVgBMAFUAdACZAKQAowCVAFwACgDR/77/uv+x/5H/e/+O/6n/x//i/8z/k/9k/07/Vv93/4r/lP+V/3z/Yv9k/3z/iP+J/53/yv/e/8X/ov+C/3D/aP9W/0z/Wv+C/7//9f8IAP//6P+6/37/Yf9w/4L/gv9+/4D/iP+T/4b/YP9H/1z/i/+0/9r/7//q/+f/3v/G/7T/rf+y/73/yf/S/9n/1//Z/8z/rP+T/5D/nf+v/7n/tv+i/4D/XP9D/yz/Fv8W/zj/cf+d/6j/sv/T/9r/z//B/53/b/9h/23/jf+6/97/+P/+/+3/x/+t/63/tP+z/6//m/9o/yv/FP8m/zb/Ff/i/sr+wf67/s/++v4c/zn/UP9p/4//lP9+/3f/c/9n/2b/i//L//r/EAAlADMADADR/6P/l/+V/3//c/+Z/97//P/l/7z/nf+I/3f/df98/4H/mP/E/9z/wv+Y/4f/hv+e/8n/5//4/xUATgC0ABQBIgHfAIoAXAA/AAAA0v/d//P/8v/l/+v/CAACAMz/p/+l/7P/1P/5/zoAkADGALIAcgBdAHQAjgCNAEgA7//D/83/7P8SAEEAXgBjAGgAfADAABgBUgGPAdQBEQJaApcCsQKfAkcCvgExAckAoAB9AB8Atf9r/zf/Ef/y/tD+m/5z/n7+xP5G/6T/z/8BACoAXwCcAKEAiACCAHYAdwCHAJ0AvwDQALQAewCDAA0B4gGJAsoC0wLNAuwCWAPdAykEEwS5AzoD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","wash-max":"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","deal-1x":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAQABAAEAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAwADAAIAAgABAAEAAQACAAIAAQABAAAAAAAAAAEAAgABAAEAAQAAAP/////+//7//////wAAAgADAAMABAADAAMAAgACAAAAAAABAAIAAQABAAEAAQACAAIAAgACAAIAAgAEAAYABgAHAAYABgAGAAYABQAEAAQABAAEAAMAAgADAAQABAADAAMAAgAEAAQABQAGAAUABAADAAMABQAGAAUABAADAAMAAwACAAIAAgABAAEAAAD///////////7//f/8//r/+P/5//v//P/9//z//P/6//j/+P/4//j/9//2//f/+P/5//r/+//8//3//P/8//3//v/+////AQD///7/AAABAAEAAQABAAAA/////////v/+///////+//7//v/+//7///8BAAMAAgABAAEAAgABAAAAAAAAAAEAAQABAP///P/6//j/+P/7//z/+//6//r/+f/4//j/+v/9//7//v/9//z/+//7//r/+P/6//z//P/6//r/+v/6//r/+f/3//f/9//5//z//f/8//v/+//8//z//f/+//3/+//8//z/+v/4//f/+P/5//r//P/8//v/+v/6//v//f///wAAAAAAAP///v/+////AAABAAEA///9//z//v/+//3//f/8//v//P///wEAAgABAAAAAAAAAAAAAAAAAAAAAAAAAP////////////////7//f/9//z//f/+//7//f/8//z//P/7//n/+P/4//n/+//+/wEAAgADAAMAAQAAAAMABQAHAAYAAwADAAEAAAAAAAEAAQAAAAEAAwADAAIAAQADAAUABgAGAAcABwAIAAgACwAKAAgABwAIAAkACAAFAAQABgAHAAYABgAGAAYABgAHAAgACQAKAAwADAAKAAsACgAKAAsACgAJAAoACwALAAoACQAJAAoACgAIAAgACAAIAAgABgAEAAQABAAEAAUABAAEAAQABAAFAAYAAwACAAMABAAEAAMAAAD//wAAAQABAAIAAgACAAMAAwADAAIAAwACAAIAAgACAAMAAwACAAIAAgADAAIAAQABAAIAAgABAAIABAACAAEAAAABAAIAAgADAAMAAgAAAAAAAAAAAP7//f/9//z/+//7//v/+v/5//r/+//8//z//P/9//v/+v/8//7///8AAP////8AAP///f/7//n/+v/7//z//f/9//z//f/8//r/+//8//3///8BAAEAAAD+//z/+//6//j/+P/5//v//f/9//v/+v/6//r/+//8//z//P/8//z//P/8//3//P/6//r/+//8//7//v/9//3//v/+////AQAEAAUABQAFAAQAAgABAAIAAgACAAMAAgACAAMAAgACAAMABAAFAAUABQAGAAUAAwADAAQABAADAAEAAgADAAUABgAEAAIAAQAAAAEAAAD+//7///////7//v/+//7//f/7//z//f/+//////8AAAEA///+//7//v8AAAEAAAAAAP//////////AAACAAMAAgABAP///P/7//v/+//8//3//f/9////AAD///7/+//5//n/+f/5//v//f////7//f/9//z/+//8//z//P/8//v/+//8//z/+v/5//r/+v/8//3//f/+/////v/+//3//v/+//7/AAABAAEAAwAEAAIAAwAFAAUABQAFAAQABAAEAAQABAADAAIAAQACAAIAAQACAAMAAwADAAMABQAHAAYABQADAAIAAwACAAMABAAFAAUAAwACAAMAAgABAAIAAgACAAQAAwADAAYABgAFAAYABwAHAAYABAADAAIAAgADAAQAAwACAAEAAQABAAIAAgABAAEAAAABAAMAAgADAAIAAAD///7//P/8//z/+//9///////9//z//P/8//7/AAAAAAMABAADAAEAAAAAAP//AAAAAAEAAgABAAEA//////////8AAAEAAAABAAAA//8AAAEAAQABAAEAAAD//wAAAAD9//z//v/+//7//v/+//7//f/+/wEAAQAAAAEAAAABAAMABAAFAAUABAADAAIAAAAAAAQABQAFAAYABgAFAAQABAAEAAUAAwADAAQAAgABAAEAAAD///7//f/8//v/+v/7//v/+f/3//j/+P/4//j/+f/6//r/+//6//v//f////////8AAP///v/+//7//v/+//7//v/9//v/+v/6//r/+//+//////8BAAIAAQACAAIAAAABAAIAAQAAAAAAAAACAAMAAAD//wAAAAD///7//f/9//3//v/+//3//v///wAAAAAAAAAAAQABAAAAAQAAAAAAAAAAAAIAAgABAAEAAgACAAEAAAABAAIAAQAAAAEAAQAAAP//AAAAAAEAAQD//wAAAAABAAIAAQAAAAEAAgADAAQAAgAAAAEAAQACAAIAAQACAAMAAQD///3/+//9////AAABAAIAAQABAAAA/v/+/////////wAAAgABAP////8AAAAAAQACAAEAAQACAAMAAgACAAMABAAEAAMAAgACAAIAAQAAAAEAAgACAAAAAAAAAAAA///9//3//f/8//v//P/8//7//////wEAAAD///////8AAAAA/f/9//3//f/+///////+//z/+//7//v/+//9//7///8AAAAA///+//3//v/+//z/+//8//3//f/8//z//P/+//3//f/+////AAAAAAAAAQAAAP//AAAAAP/////9//z//P/9////AAD+//7//f/+//7//P/6//3///////////8AAAAAAAAAAAAAAQACAAMAAgACAAIAAQD///////8BAAIAAwADAAMAAgAAAAAAAAABAAMABAAEAAUABwAGAAMAAQABAAEAAAABAAEAAQAAAP///v///wAAAQD///7/AAAAAP///v/////////+//7///8BAAEAAAD/////AQACAAEAAgADAAQABQAGAAQAAwADAAEAAAABAAEA///+/wAAAAAAAP///v/9//3//f/9//3//P/8//7/AAAAAAAAAAABAAEAAgAEAAUABwAGAAMAAwAHAAcABgAGAAUABAAFAAUABAADAAIAAgACAAIABAAEAAMAAwADAAMAAwACAAAA//////z/+//9/////f/6//n//P/9//3//v///////v/+//7//v///wAAAgACAAMAAwADAAMABAAFAAcACAAHAAcABwAGAAYABAAEAAUABgAHAAcACAAHAAUAAgADAAUABgAGAAYABQAEAAMABAAFAAMAAAAAAAEAAwAEAAMAAQAAAAAAAQADAAQABAACAAEAAwADAAEA////////AAABAAIAAQAAAAEAAgADAAQABgAHAAgACAAHAAcABgAEAAUABQAGAAcABgAHAAgABgADAAEAAgAEAAUABwAGAAUABAADAAIAAgABAAMABAADAAEA//////////8BAAIAAQABAAAAAAABAAEA/v/9//z/+//6//v//P/8//z//P/7//r/+//+//7//f/+//7//f/7//v//P/7//r/+v/7//r/+v/6//n/+f/2//P/8f/w//L/9f/0//P/8//0//b/9f/y/+//7//x//L/8f/w/+//7//v/+//7//v//L/9f/x/+z/7P/t/+//8f/y//H/8v/1//P/8//3//r/+P/3//f/+P/4//j/9//2//b/+P/5//j/+P/5//j/9//4//n/+P/4//r//P/7//r/+v/8//3//f///wAA/f/6//j/+f/8/wEABAAEAAMAAwACAP///v8AAAUABwAEAAEA/P/2//X/9//6//z//P/8//v/+P/4//r/+v/8/////v/9/wEABAAIAAoABwAHAAoACAAHAA4AEQAOAA4ADAADAAEACgANAA0ADwAPAA4ADgAMAAgAAwAHAA8ACwAHAAsACgALABEAEAAJAAoAEAAQAA0ADAAOABAADQANAA8ADQAMABAAEAAJAAwAEgAQAAwACgAMAAsABgAHAA0ADwASABUAFQAUABAADwARAAsABgAFAAYADAAPABIAGwAcABAAEgAUAAYABQAKAAEAEwAtABcA///7//j/9/8FABQAEQAQABAA+v/z/wgABwD+/wQAAQAJABkAFAAEAPr/AQAFAPH/6v////7/7f/9//j/3v/w/wEA8f/0//z/8v/1//P/5P/v//n/+f8CAP7/9v/9//r/+/8DAAAADAAOAOv/6/8PAAgA+P8MAB4AHwAhABYACQAUAB4AGQAfACcAEgABABQAGgAbADMAKQAaAEQARwAgACYAJAAXADAAIAD3/wMADQAIADYAUQAbAAAAFQD//9X/6f8cABwADQAnAB4A9/8PAEkAZQB7AHoAPQD7/+T/BgAYABIANQBdAFMASQBIACQAAgAPABUA8P/5/xkADAAHACQAMAAzAD0AOAA4AFkAYwAxACgAWwBpADgAPQBJAGEAaQB6AiMGAAP3/OP8Tfsr+Vj+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AwAAAP7/+//3//v/+f/y//b//P/4//b/+//3/+//8v/2//X/8P/o/+b/5//i/93/4//l/+T/5//j/97/3f/j/+j/4P/a/9f/0f/W/9j/2P/X/9H/0f/X/9f/1P/Y/9n/2f/b/9r/2f/f/93/0//R/9X/1v/V/9H/y//H/8j/zP/P/87/zP/O/8j/w//D/8L/wP/E/8X/wP/B/8n/zP/N/83/yv/F/8f/xv/E/8n/yf/C/8L/xf/D/8L/x//J/8P/xf/L/8r/zP/Q/8z/yf/N/9H/1f/T/9D/zf/O/9X/2f/X/9X/2P/d/+L/5f/k/+b/7P/x//L/7f/r/+3/7v/w//X/9//z/+//8f/0//f/9//0//T/9v/2//P/9f/3//T/8P/w/+//8f/2//P/8f/z//D/7//v//D/9P/y/+z/7f/0//b/8P/r/+j/6//t/+7/9f/0//L/9f/2//n/+//3//j//P/7//r/+v/9/wMABAD+//j/+/8CAAUAAAD+/wAAAAAAAAEAAwAFAAIABQAKAAwACAAHAAsACgAHAAgADAAPAA8ADwANAA0AEQAUABIAEQATABQAFQAWABoAHwAfAB4AIAAiACQAJAAmACcAJgAnACwALQApACoALQApACYAKgAsACoAKwAvAC4AKQAsADAAMAA1ADUAMgA1ADUAMgAwADAAMQAwADEAMgAuACwALQArACgAKAApACgAJwAmACUAJAAlACcAJgAiACAAIgAfABwAHAAcABsAGQAaAB0AHAAaABkAGgAZABcAFgATABMAFAAUABAADAAMAAwACwALAAwACQAHAAgACwAJAAcABwAIAAkACQAHAAUABQAGAAYAAwABAAEAAAACAAIAAAAAAAIAAAAAAAAAAgACAAIAAwACAAEAAgACAAEAAAAAAAIAAgAAAP//AAAAAAAAAQABAAAAAgAEAAIAAAAAAAAAAgACAAIAAAAAAAEAAAABAAAA//8AAP///f/8//v//f////3/+v/4//n/+v/3//X/9v/1//T/8v/y//L/8v/y//D/7P/s/+7/7v/t/+r/6P/n/+n/6v/o/+f/5v/k/+b/6P/o/+f/5//q/+v/6P/n/+n/7f/t/+3/7f/s/+//8v/x/+//7v/u//H/8f/x//L/8P/u//D/8P/w//H/8f/w//H/8//y/+7/7v/v/+//8P/z//L/8P/w//H/8v/y//P/9P/z//H/8v/y//L/8//0//L/8v/0//T/9P/1//X/9f/1//T/8//1//f/+P/4//f/9//4//n/+v/6//n/+f/6//z//v////////8AAAAAAAAAAAAAAQABAAEAAgABAAEAAwAFAAQABAAEAAUABAAFAAUABQAFAAUABgAGAAYABgAHAAcABgAGAAUABAAFAAYABgAFAAQABQAGAAUABQAEAAQABQAFAAUABgAGAAYABgAHAAgABwAGAAYABwAIAAgABwAIAAkABwAHAAgACAAIAAcABwAHAAcABwAIAAgABwAHAAgACAAHAAgACAAHAAcABwAIAAkACgAJAAkACAAHAAYABgAHAAYABQAFAAYABgAFAAQABAAEAAUABgAFAAQABAAEAAUABQAFAAQABAAEAAMAAwADAAMAAwADAAMAAwADAAQABAAEAAMABAAEAAQAAwADAAQABAAEAAUABQAFAAQABAADAAMAAwADAAMAAwADAAQABAAEAAQAAwAEAAQABQAEAAMAAwAEAAQABAAEAAQABAAEAAQABQAFAAQABAAEAAMAAwAEAAMABAAEAAQAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAIAAgACAAIAAQACAAEAAQABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AAAAAAAA///////////+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//f/9//3//v/+//7//v/9//3//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","deal-3x":"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9f/5//j/+//+//v/+P/4//P/8f/3//j/7f/X/9P/4f/l/+n/5f/d/9L/zf/K/9P/3f/k/+f/1//T/+X/5P/h/+j/4v/i/+//6f/Y/9T/6P/u/+L/1//N/83/3v/t/+7/6//e/9D/1P/Y/9v/6f/p/+f/6f/d/97/5f/g/9P/0v/O/8L/xv/L/8T/vP+2/8D/v/+w/7j/vf+z/7v/y//H/77/yP/K/7f/uP/G/8r/v/+y/8L/0P++/73/y//K/8T/yf/U/9n/2v/l/+n/4v/p/+3/6//y//P/8//0//H/8//1/+r/5f/q//P/9//1//T/8f/t//X/9//x/+7/8P/4//n/+/////v/+f/8//z/+//4//P/9v///wAA+f/x//P/9//2//j/+v/3//z/AAD8//r/AwADAP//AAAGAAYAAAAEAAoACQALAA0ADgAVABIAEwAUABIAFQAXABYAGQAaABcAFgAUABsAIQAgABwAHAAfACAAHgAgACQAIgAjACYAIQAgACcAKQAkACEAJAAlACcAKgAuADEAMAAvAC4ALQAzADQAMQAzADQAMgAxADAALwAuADAAMAAqACkALAApACgAKwAsACoAJQAkACQAIwAkACUAIgAfACIAIgAbABkAGAAZABkAFQAVABYAFQAUABQAEQAOAA8ADgAMAAoACwAKAAkABwAGAAYAAgACAAMAAgACAAMAAwACAAAAAAACAAIAAgACAAEAAQADAAIAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////////////AAAAAP//AAAAAAAA/////wAAAAAAAP///////////////////v///////v/+//7//v////7//v/9//3//f/8//z//f/8//z/+//7//v/+//7//v/+v/6//r/+v/6//n/+f/5//n/+v/5//n/+f/5//n/+v/6//n/+f/6//r/+v/6//r/+//7//z//P/7//z//P/9//3//P/8//3//f/9//3//f/9//3//f/9//3//v/9//7//v/+//3//f/9//3//v/+//7//v/+//7//v/+//////////7//v////////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","deal-max":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAwAEAAUAAgAAAAAAAAAAAAAAAgAEAAQAAwADAAEAAAAAAAAAAAAAAAAAAAAAAAEAAgADAAQAAwAEAAcACAAEAAIACAAKAAUABQAHAAoACgBKAL4AXgCg/5r/ZP8Z/8j/TgD7/8//9P9t//j+T/+8//f/r/9Z/27/cP9j/73/DgC+/27/qP+u/7P/SAAwAKT/xP/3/7L/VP+H/wAADwBHAOUAMwEOAYoAg/9M/nX+AACWAOP/Sf+//rD+8P+VAKb/CP/i/3AAWABoABj/4P3X/24CswEy/6X/TwJ8AsQBfQFq/1/+rP+IAF4Ahf8IAPoBAAFF//f/Of9P/lIADQGi/wH/oP+fAFkAcf+D/3QABALbAvUB+ACCAHMAjgETAuYAfgF4BIUFMgQpA0QCUwEHAAcACAAFAAIABQAJAAgACgALAAMAAAAEAAYABwAQAA0ABgAWABcACQAKAAoABgAPAAgAAAAAAAEAAAAQABoABwAAAAUAAAD0//v/BwAGAAEACgAHAP//AgAXACAAJwAnABIAAAD4/wAABgADABAAHgAaABYAFgAJAAAAAgAEAP3/AAAGAAIAAAAJAAwADQAQAA4ADwAYABsADAAJABgAHAAOAA4AEgAYABoApwCcAcYAOP81/9P+Uf6Z/4kA9v+w/+v/H/98/gX/of/y/5j/NP9U/17/Vf+6/w8AwP96/7L/u//B/zYAIgDA/9j/+v/S/6H/wf8AAAcAHQBZAG4AWQApAN3/k/+o/wAAGQD8/+r/4v/p/wAAAwA="};
let recordedContext035 = null;
const recordedBuffers035 = new Map();
const presentationSounds035 = new Set();
function stopPresentationSounds035() {
  if(window.HORShuffle732)window.HORShuffle732.stop();
  for (const s of presentationSounds035) { try { s.stop(); } catch (_) {} }
  presentationSounds035.clear();
}
function playRecordedCard035(kind, delayMs = 0) {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio(); if (!ctx) return;
  if (recordedContext035 !== ctx) { recordedBuffers035.clear(); recordedContext035 = ctx; }
  const step = solScaledDelay(CARD_DEAL_MS,18);
  const pace = step <= 18 ? 'max' : step < 80 ? '3x' : '1x';
  const key = (kind==='reveal'?'deal':kind) + '-' + pace;
  if (!recordedBuffers035.has(key)) {
    const bytes = atob(recordedPCM035[key]);
    const b = ctx.createBuffer(1,bytes.length/2,22050), data=b.getChannelData(0);
    for(let i=0;i<data.length;i++) { let n=bytes.charCodeAt(i*2)|(bytes.charCodeAt(i*2+1)<<8);if(n>=32768)n-=65536;data[i]=n/32768; }
    recordedBuffers035.set(key,b);
  }
  const src=ctx.createBufferSource(), gain=ctx.createGain();
  src.buffer=recordedBuffers035.get(key);
  if(kind==='wash') src.playbackRate.value=src.buffer.duration/(solScaledDelay(shuffleAnimDuration762(),80)/1000);
  gain.gain.value=kind==='reveal'?.5:1;
  let filter=null;
  if(kind==='reveal'){filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2500;filter.Q.value=.5;src.connect(filter);filter.connect(gain);}else src.connect(gain);
  gain.connect(window.HORAudioMixer.output(ctx,'gameplay'));presentationSounds035.add(src);
  src.onended=()=>{presentationSounds035.delete(src);src.disconnect();if(filter)filter.disconnect();gain.disconnect();};
  src.start(ctx.currentTime + Math.max(0,delayMs)/1000);
}
function playShuffleSound() {
  if(window.HORShuffle732)return window.HORShuffle732.sound();
  if (soundMuted || !soundCard) return;
  const step = solScaledDelay(CARD_DEAL_MS, 18);
  const pace = step <= 18 ? 'max' : step < 80 ? '3x' : '1x';
  preloadCardWashSound059(pace).then(buffer => {
    if (!buffer || soundMuted || !soundCard) return;
    whenAudioReady(ctx => {
      if (soundMuted || !soundCard) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0.58, ctx.currentTime);
      source.connect(gain);
      gain.connect(window.HORAudioMixer.output(ctx,'gameplay'));
      source.onended = () => { try { source.disconnect(); gain.disconnect(); } catch (_) {} };
      source.start(ctx.currentTime + 0.01);
    });
  });
}
function playDealCardSound(delayMs = 0) {
  preloadCardLandingSounds058();
  if (soundMuted || !soundCard) return;
  setTimeout(() => {
    if (soundMuted || !soundCard || cardLandingBuffers058.length !== CARD_LANDING_SAMPLE_URLS058.length) return;
    const options = cardLandingBuffers058.map((_, i) => i).filter(i => i !== lastCardLandingIndex058);
    const index = options[Math.floor(Math.random() * options.length)];
    lastCardLandingIndex058 = index;
    const ctx = ensureAudio();
    if (!ctx) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = cardLandingBuffers058[index];
    // Dealt cards are close together; keep each familiar paper landing quiet.
    gain.gain.setValueAtTime(0.34, ctx.currentTime);
    source.connect(gain);
    gain.connect(window.HORAudioMixer.output(ctx,'gameplay'));
    source.start(ctx.currentTime + 0.004);
    source.onended = () => { try { source.disconnect(); gain.disconnect(); } catch (_) {} };
  }, Math.max(0, Number(delayMs) || 0));
}
function positionRailControls035(controls) {
  // Tablet room scaling creates a containing block for fixed descendants.
  // Keep the existing buttons/handlers in viewport space on larger viewports.
  if (!controls._railHome035) controls._railHome035 = controls.parentNode;
  const viewportNavigation = innerWidth >= 521;
  const home = viewportNavigation ? document.body : controls._railHome035;
  if (controls.parentNode !== home) home.appendChild(controls);
  if (viewportNavigation) {
    controls.style.setProperty('left','auto','important');
    controls.style.setProperty('right','max(12px, env(safe-area-inset-right))','important');
    controls.style.setProperty('top','auto','important');
    controls.style.setProperty('bottom','max(104px, 18dvh, env(safe-area-inset-bottom))','important');
    controls.style.setProperty('transform','none','important');
    controls.style.setProperty('translate','none','important');
    return;
  }
  if (!isPortraitViewport()) {
    ['left','top','right','bottom','transform','translate'].forEach(k=>controls.style.removeProperty(k));return;
  }
  const bg=$('hor-room-bg');
  const r=bg?bg.getBoundingClientRect():{left:0,top:0,width:innerWidth,height:innerHeight};
  const scale=Math.max(r.width/875,r.height/1797);
  const x=r.left+(r.width-875*scale)/2+812*scale;
  const centerY=r.top+1130*scale;
  controls.style.setProperty('left',(Math.max(27,Math.min(innerWidth-32,x-13))-22)+'px','important');
  // 069: Keep fittings anchored to table projection through bidding.
  controls.style.setProperty('top',Math.max(80,centerY-44)+'px','important');
  controls.style.setProperty('right','auto','important');controls.style.setProperty('bottom','auto','important');
  controls.style.setProperty('transform','none','important');controls.style.setProperty('translate','none','important');
}
function dealFlight035(player,duration) {
  if (!isPortraitViewport() || document.body.classList.contains('reduce-motion')) return;
  const bg=$('hor-room-bg'),r=bg?bg.getBoundingClientRect():{left:0,top:0,width:innerWidth,height:innerHeight};
  const cover=Math.max(r.width/875,r.height/1797),offsetX=r.left+(r.width-875*cover)/2;
  const project=(x,y)=>({x:offsetX+x*cover,y:r.top+y*cover});
  const center=project(437.5,850);
  // Deal from a lifted packet above the rear felt, then descend onto the
  // table plane. Portrait centers are not physical card landing positions.
  const dealerSlot=seatSlotIdForIndex(Number.isInteger(game.dealer)?game.dealer:0);
  // A packet on the dealer's side of the felt, clear of portraits and rail.
  const packets747={'slot-me':[610,1000],'slot-partner':[437.5,720],
    'slot-left':[235,880],'slot-right':[640,880]};
  const start=project(...packets747[dealerSlot]);
  const sid=seatSlotIdForIndex(player==='nest'?myIndex:player);
  const feltTargets={'slot-partner':[437.5,690],'slot-left':[195,850],'slot-right':[680,850],'slot-me':[437.5,1090]};
  let end=project(...(feltTargets[sid]||feltTargets['slot-me']));
  if(sid==='slot-me' && player!=='nest') {
    const holder=document.querySelector('.hand-area');const hr=holder&&holder.getBoundingClientRect();
    if(hr&&hr.width&&hr.height) end={x:hr.left+hr.width/2,y:hr.top+Math.min(hr.height*.45,30)};
  }
  if(player==='nest') {
    const landing=nestLanding037(Number(window.__dealNest036&&window.__dealNest036.count)||0);
    const pile=$('nestArea')&&$('nestArea').querySelector('.table-nest-pile');
    const pr=pile&&pile.getBoundingClientRect();
    end=pr&&pr.width?{x:pr.left+pr.width/2+landing.x*cover,y:pr.top+pr.height/2+landing.y*cover}:project(437.5+landing.x,800+landing.y);
  }
  // Visible flight reaches the player; middle cards land on the real Nest pile.
  const scale=cover/(915/1797);
  const carrier=document.createElement('div');carrier.className='deal-moving036';carrier.setAttribute('aria-hidden','true');
  carrier.dataset.dealer=String(game.dealer);carrier.dataset.dealerSlot=dealerSlot;carrier.dataset.player=String(player);carrier.dataset.startX=String(start.x);carrier.dataset.startY=String(start.y);carrier.dataset.endX=String(end.x);carrier.dataset.endY=String(end.y);
  carrier.style.cssText=`position:fixed!important;left:${start.x-25*scale}px!important;top:${start.y-27*scale}px!important;width:${50*scale}px!important;height:${54*scale}px!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:none!important;z-index:2147483500!important;`;
  const card=document.createElement('div');card.className='deal-flight035';card.style.cssText='position:absolute!important;left:0!important;top:0!important;display:block!important;visibility:visible!important;opacity:1!important;';
  const nestFlightCount=Number(window.__dealNest036&&window.__dealNest036.count)||0;
  const nestTotal=Array.isArray(game.nest)?game.nest.length:(Number(game.nestCount)||6);
  if(player==='nest'&&revealTopNest&&nestFlightCount===nestTotal-1){
    const face=pinnedNestRevealFace()||freezeTopNestCard();
    if(face){card.classList.add('face-up-flight040');card.innerHTML=renderCardHTML(face,true);}
  }
  card.style.setProperty('--deal-scale035',scale);carrier.appendChild(card);document.body.appendChild(carrier);
  const flights=window.__dealFlights036||(window.__dealFlights036=new Set());
  let frame=0,deadline=0,origin=performance.now(),stopped=false;
  const flight={stop(){if(stopped)return;stopped=true;cancelAnimationFrame(frame);clearTimeout(deadline);carrier.remove();flights.delete(flight);}};flights.add(flight);
  const move=time=>{
    if(stopped)return;
    if(!isPortraitViewport()||!document.body.classList.contains('in-game')||document.hidden){flight.stop();return;}
    const t=Math.min(1,(time-origin)/Math.max(1,duration)),ease=1-Math.pow(1-t,2);
    // No sinusoidal upward hop: height steadily settles toward the felt.
    const height=18*cover*(1-ease);
    // Bottom receiving path skirts the portrait before entering the holder.
    const bend=project(850,1260),u=1-ease;
    const point=(sid==='slot-me'&&player!=='nest')
      ?{x:u*u*start.x+2*u*ease*bend.x+ease*ease*end.x,
        y:u*u*start.y+2*u*ease*bend.y+ease*ease*end.y}
      :{x:start.x+(end.x-start.x)*ease,y:start.y+(end.y-start.y)*ease};
    carrier.style.setProperty('transform',`translate3d(${point.x-start.x}px,${point.y-start.y-height}px,0)`,'important');
    card.style.opacity=String(1-.16*ease);
    carrier.dataset.dealProgress=String(t);
    if(t<1)frame=requestAnimationFrame(move);else setTimeout(()=>flight.stop(),duration>80?12:0);
  };
  carrier.style.setProperty('transform',`translate3d(0,${-18*cover}px,0)`,'important');
  frame=requestAnimationFrame(move);deadline=setTimeout(()=>flight.stop(),duration+120);
}
function stopDealFlights036() {
  for(const flight of window.__dealFlights036||[])flight.stop();
}
function dealSoundDelay036(flightMs) {
  const paceStep=solScaledDelay(CARD_DEAL_MS,18);
  const impact=paceStep<=18?5:paceStep<80?27:80;
  return Math.max(0,flightMs-impact);
}
function buildDealOrder036(handLength,nestCount,dealer) {
  const first=((Number.isInteger(dealer)?dealer:0)+1)%4,order=[];
  for(let round=0;round<Math.max(handLength,nestCount);round++) {
    if(round<handLength)for(let seat=0;seat<4;seat++)order.push((first+seat)%4);
    if(round<nestCount)order.push('nest');
  }
  return order;
}
function flipDealtNest036(token,onDone) {
  if(token!==dealAnimToken||!game)return;
  if(!revealTopNest){onDone();return;}
  const face=pinnedNestRevealFace()||freezeTopNestCard();
  if(!face){onDone();return;}
  pinNestRevealFace(face);
  window._horNestFlipHand=String(game.handNumber||0)+':'+String(game.dealer)+':'+String(face.id||'');
  window._horNestFlipTok=(window._horNestFlipTok||0)+1;
  // Already face up in the flight: land directly, without a second flip/lift.
  game.nestFlipStage=2;game.nestFlipped=true;window._horNestPileSig='';
  // The flight already has its regular deal sound; no delayed second card cue.
  try{renderTopNestPeek();playBirdNestReaction041();}catch(_){}
  onDone();
}
function runDealPresentation(fullHand,onDone) {
  if(!isPortraitViewport()){runLegacyDealPresentation035(fullHand,onDone);return;}
  const hand=(fullHand||[]).map(c=>({...c})),token=++dealAnimToken;
  stopPresentationSounds035();stopDealFlights036();document.body.classList.remove('dealing035');
  try{showGame();}catch(_){}if(!game)game={};game.myHand=[];
  const nestTotal=Array.isArray(game.nest)?game.nest.length:(Number(game.nestCount)||6);
  window.__nestPlacement039=null;window.__birdNestReaction041=null;
  window.__dealNest036={token,count:0};
  const order=buildDealOrder036(hand.length,nestTotal,game.dealer);
  for(const id of ['myHand','ltHand','ltPlays']){const el=$(id);if(el)el.innerHTML='';}
  try{renderUI();}catch(_){}
  preloadCardLandingSounds058();
  showShuffleOverlay();try{playShuffleSound();renderTopNestPeek();}catch(_){}
  setTimeout(()=>{
    if(token!==dealAnimToken)return;
    hideShuffleOverlay();document.body.classList.add('dealing035');
    let index=0,mine=0;
    const step=()=>{
      if(token!==dealAnimToken){stopDealFlights036();document.body.classList.remove('dealing035');return;}
      if(index>=order.length){
        window.__dealNest036=null;stopDealFlights036();document.body.classList.remove('dealing035');game.myHand=hand.slice();
        try{sortMyHandInPlace();renderHand(false);renderTopNestPeek();}catch(_){}
        if(typeof onDone==='function')onDone();return;
      }
      const player=order[index++],interval=solScaledDelay(122,25),flight=Math.max(18,interval-25);
      try{dealFlight035(player,flight);}catch(_){}
      // Keep every card, including the face-up sixth Nest card, on one audio cadence.
      try{playDealCardSound(dealSoundDelay036(flight));}catch(_){}
      setTimeout(()=>{
        if(token!==dealAnimToken){stopDealFlights036();document.body.classList.remove('dealing035');return;}
        if(player==='nest'){
          window.__dealNest036.count++;window._horNestPileSig='';
          try{renderTopNestPeek();}catch(_){}
          if(window.__dealNest036.count===nestTotal){flipDealtNest036(token,step);return;}
        } else if(player===myIndex){mine++;game.myHand=hand.slice(0,mine);try{renderHand(false,{skipSort:true});}catch(_){}}
        step();
      },interval);
    };step();
  },solScaledDelay(shuffleAnimDuration762(),80));
}

// ROOK037: stable, compact natural landings; a render never reshuffles the pile.
function nestLanding037(index) {
  const seed=(Number(game&&game.handNumber)||0)*19+(Number(game&&game.dealer)||0)*7;
  const noise=salt=>{const v=Math.sin((seed+index*13+salt)*12.9898)*43758.5453;return v-Math.floor(v);};
  return {x:(noise(3)-.5)*12,y:(noise(9)-.5)*9,angle:(noise(17)-.5)*12};
}
function applyNestScatter037() {
  if(!isPortraitViewport())return;
  const area=$('nestArea'),pile=area&&area.querySelector('.table-nest-pile');
  if(!pile)return;
  const cards=pile.querySelectorAll(':scope > .table-nest-under, :scope > .table-nest-top, :scope > .table-nest-flip, :scope > .nest-stay-face');
  cards.forEach((card,i)=>{
    const top=card.classList.contains('nest-stay-face')||card.classList.contains('table-nest-flip')||card.classList.contains('table-nest-top');
    const p=nestLanding037(top?Math.max(0,nestCountOnTable()-1):i);
    card.style.setProperty('left',p.x+'px','important');
    card.style.setProperty('top',p.y+'px','important');
    card.style.setProperty('translate','0px 0px','important');
    card.style.setProperty('rotate',p.angle+'deg','important');
    if(card.classList.contains('table-nest-under'))card.style.setProperty('transform','none','important');
    card.style.setProperty('z-index',i+1,'important');
  });
}

// Keep the physical pile origin through flip/auction renders; resize can re-anchor.
function nestPlacementKey039() {
  const bg=$('hor-room-bg'),r=bg&&bg.getBoundingClientRect();
  return [game&&game.handNumber,game&&game.dealer,innerWidth,innerHeight,r&&r.top,r&&r.width,r&&r.height].join(':');
}
function restoreNestPlacement039() {
  if(!isPortraitViewport())return false;
  const saved=window.__nestPlacement039;
  if(!saved||saved.key!==nestPlacementKey039())return false;
  const area=$('nestArea'),pile=area&&area.querySelector('.table-nest-pile');
  if(!pile)return false;
  pile.style.setProperty('translate',saved.translate==='none'?'0px 0px':saved.translate,'important');
  return true;
}

// ROOK040: accepted discards toss face down to center, then clear with a fade.
const originalRenderUI040=renderUI;
renderUI=function(...args) {
  const result=originalRenderUI040.apply(this,args);
  try { syncDiscardReturn040(); } catch(e) {}
  return result;
};
function discardReturnKey040() {return [game&&game.handNumber,game&&game.dealer,game&&game.bidder].join(':');}
function stopDiscardReturn040() {
  const state=window.__discardReturn040;
  if(state){state.stopped=true;cancelAnimationFrame(state.frame);state.group.remove();}
  window.__discardReturn040=null;
}
function syncDiscardReturn040() {
  if(!game||!isPortraitViewport()||!['trump','play'].includes(game.phase)) {stopDiscardReturn040();return;}
  const count=Number(game.nestDiscardCount)||0;
  if(count<1)return;
  const key=discardReturnKey040();
  if(window.__discardReturn040&&window.__discardReturn040.key===key)return;
  stopDiscardReturn040();
  if(window.__discardReturnSeen040===key)return;
  window.__discardReturnSeen040=key;
  const bg=$('hor-room-bg'),br=bg?bg.getBoundingClientRect():{left:0,top:0,width:innerWidth,height:innerHeight};
  const cover=Math.max(br.width/875,br.height/1797),scale=cover/(915/1797);
  const target={x:br.left+(br.width-875*cover)/2+437.5*cover,y:br.top+875*cover};
  const group=document.createElement('div');group.className='discard-return-group040';group.setAttribute('aria-hidden','true');
  group.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483500;';document.body.appendChild(group);
  const state={key,group,frame:0,stopped:false};window.__discardReturn040=state;
  const seat=$(seatSlotIdForIndex(game.bidder)),avatar=seat&&seat.querySelector('.seat-avatar,.seat-avatar-side');
  const r=avatar&&avatar.getBoundingClientRect();
  const start=r&&r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:{x:innerWidth/2,y:innerHeight*.85};
  const reduced=document.body.classList.contains('reduce-motion');
  const duration=reduced?0:solScaledDelay(330,70),stagger=reduced?0:solScaledDelay(45,12);
  const hold=solScaledDelay(100,25),fade=solScaledDelay(240,60),started=performance.now();
  const fadeAt=duration+(count-1)*stagger+hold,finishAt=fadeAt+fade;
  const cards=Array.from({length:count},(_,i)=>{
    const node=document.createElement('div');node.style.cssText='position:fixed;pointer-events:none;display:none;';
    const back=document.createElement('div');back.className='discard-return-card040';
    back.style.cssText=`width:${50*scale}px;height:${72*scale}px;transform:matrix3d(1,0,0,0,0,0.7,0,-0.00115,0,0,1,0,0,0,0,1) rotate(${(i%3-1)*5}deg);`;
    node.appendChild(back);group.appendChild(node);
    return {node,delay:i*stagger,x:(i%3-1)*4*scale,y:(i%2?1:-1)*3*scale};
  });
  const tick=time=>{
    if(state.stopped)return;
    if(!game||discardReturnKey040()!==key||!['trump','play'].includes(game.phase)||!isPortraitViewport()){stopDiscardReturn040();return;}
    const elapsed=time-started;
    for(const c of cards){
      if(elapsed<c.delay)continue;
      const t=duration?Math.min(1,(elapsed-c.delay)/duration):1,ease=1-Math.pow(1-t,2);
      c.node.style.display='block';
      c.node.style.left=(start.x+(target.x+c.x-start.x)*ease-25*scale)+'px';
      c.node.style.top=(start.y+(target.y+c.y-start.y)*ease-26*scale)+'px';
    }
    group.style.opacity=String(elapsed<fadeAt?1:Math.max(0,1-(elapsed-fadeAt)/fade));
    if(elapsed>=finishAt){stopDiscardReturn040();return;}
    state.frame=requestAnimationFrame(tick);
  };
  state.frame=requestAnimationFrame(tick);
}

// ROOK041 candidate: subdued bird reaction, steady hand, real seat-to-table travel.
const birdCrowdPCM041 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAEAAQABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///////////////////////////////////////wAAAAAAAAEAAQACAAIAAgADAAMAAwADAAMAAgACAAIAAgABAAEAAAAAAAAAAAAAAP///////////////////v/+//7//v/9//3//f/9//3//f/+//7//v//////AAAAAAEAAQABAAEAAQACAAIAAgACAAIAAgADAAIAAgACAAIAAgACAAIAAgACAAEAAQAAAAAAAAD//////v/9//3//P/8//z//P/8//3//f/+////AAAAAAEAAgADAAMAAwADAAMAAwADAAIAAgACAAEAAQAAAAAAAAAAAAEAAQACAAIAAwAEAAQABAAEAAMAAgABAP///v/9//z//P/8//z//P/8//3//f/9//7//v/9//z/+//6//r/+f/5//r/+v/7//z//v///wEAAwAEAAUABgAGAAYABwAHAAYABgAGAAUABQAEAAMAAwACAAEAAQABAAAAAAD///7//P/7//r/+v/5//n/+P/4//n/+v/7//z//f/+////AQACAAIAAwADAAQABQAGAAYABwAIAAkACQAKAAoACgAKAAkACQAIAAcABQADAAEAAAD+//3//f/8//v/+v/5//j/+P/3//b/9f/1//X/9f/1//b/9v/3//j/+v/8//3//////wAAAQACAAMABAAEAAMAAwADAAMABAAFAAUABgAGAAcACAAIAAcABgAFAAQAAwABAAAA/v/8//v/+v/6//r/+v/6//v//P/9//3//v/+//7//v/+//3//f/9//3//f/+////AQAEAAYACAAKAAwADgAPABAAEAAQAA8ADgANAAsACQAHAAUABAACAAEA///9//v/+f/4//b/8//x/+//7f/s/+z/7P/s/+7/8P/y//X/9//5//v//f///wEAAgAEAAQABQAGAAcACQALAA0ADwARABEAEgARAA8ADQAKAAcABAABAP7//P/5//f/9v/1//X/9v/2//f/9//4//n/+//8//7///////////8AAAEAAQABAAIAAwAEAAYACAAJAAoACwAMAA4ADgAPABAAEAAPAA8ADQAMAAoACAAFAAMAAQD///3/+//4//b/9P/z//H/8P/u/+7/7f/t/+3/7v/v/+//8P/w//D/8v/0//b/+P/7//7/AQAEAAcACQALAA0AEAASABMAEwASABEAEAAOAAsACQAHAAUAAgD///3/+//6//n/+f/4//f/9//3//b/9v/2//b/9//4//n/+//8//7/AAACAAUACAALAA4AEQASABQAFQAVABUAFAARAA4ACwAJAAcABAACAAAA//8AAAAAAQACAAIAAgAAAP///f/7//j/9f/y//D/7v/t/+z/6//r/+z/7v/w//H/8v/z//X/+P/6//z//f/8//v/+v/6//v//P/+/wEABAAHAAsADgARABMAFAAWABcAFwAWABMADgAJAAUAAgAAAP3/+v/3//T/8v/x//L/8//0//X/9f/2//f/+f/6//r/+//9/wAABQAJAAwADwASABYAGwAfACIAIwAjACIAIQAeABoAFQARAAwABwADAP//+v/2//L/7//t/+v/6f/n/+X/4//h/+D/4P/h/+L/4v/h/+H/4//m/+r/7v/y//b//P8AAAQABgAIAAkACwAOABAAEgASABIAEAAPABAAEQASABIAEAAOAAwACgAIAAYAAwABAP7//P/6//j/9v/0//P/8v/y//P/9P/1//b/9//5//v//v8CAAYACQANABEAFAAYABsAHQAfACAAIAAgACAAIAAeABsAFwAUABEADgAKAAUAAAD7//b/8v/t/+n/5v/k/+L/3//d/9z/3P/d/97/3v/f/9//4f/j/+b/6v/v//P/9//7////AwAFAAcACQAMABAAEgAUABQAFAATABIAEQARABAADgANAAsACAAGAAQAAwACAAEAAAD//////f/8//r/+v/7//v//P/9//3//////wAAAAACAAQABwAJAAoACwAMAA0ADgAQABIAFgAaAB0AHwAfAB0AGwAZABcAEgAMAAYAAAD7//f/8//w/+7/7f/s/+z/6//p/+j/5v/k/+L/3//c/9j/1P/S/9L/1P/Y/93/4//p/+//9P/6/wAABgALAA8AEgAUABYAFgAWABUAFgAWABYAFgAVABQAEwASABAADgANAAwACgAHAAIA/v/6//n/+f/6//r/+v/5//n/+v/6//v/+//9/wAAAwAGAAgACgANABAAEwAWABoAHwAjACQAIwAgAB0AHAAaABcAEgALAAUAAQD+//v/+P/0//L/8P/u/+r/5f/h/9//3//e/9z/2f/V/9L/0P/Q/9H/1P/Y/9z/3//j/+n/7v/0//r///8FAAsAEAASABMAEwAUABYAFwAYABgAFwAWABUAFAAUABYAGAAYABcAFAARAA4ADAAIAAMA/v/7//j/9v/1//T/9P/1//j//P///wIABQAKAA4AEQAUABYAGQAcAB8AIQAjACMAIwAiACAAHwAdABoAFQAPAAkAAwD///v/9v/x/+7/6//p/+X/4P/c/9n/1//W/9P/z//M/8r/yv/M/87/0f/V/9n/3f/g/+X/7P/1//7/BQAJAA0AEQAUABcAGAAYABkAGQAZABgAFQAQAAwACQAIAAYABQAEAAMAAQAAAAEAAwAEAAUABQAEAAQABgAHAAYAAwACAAMABQAHAAkACQALAA0AEQAVABoAIAAlACgAKQAoACUAIwAgAB4AGwAXABIADAAGAP//+f/z/+//6//p/+b/4v/e/9r/2f/a/9z/3P/Z/9X/0v/P/8//0P/S/9T/1P/T/9T/1f/X/93/5P/r//P/+P/8/wAABwAUACIAKQAnACIAIQAmACkAJwAdABEADAAOABEAEgANAAcAAwD/////AQAEAAUAAQD6//H/6f/n/+r/8P/0//b/+/8GABMAIAAqADAAMgAzAC8AKQAqADcATABWAE4APQA0ADwATgBQADsAGAD4/+r/7P/q/9//z/+//7X/tP+6/8f/2P/i/97/0f/D/7z/wf/G/8P/uf+t/6v/t//L/97/7f/4//7/BgATACMAMAAzACMACQD0/+//9v8DAAoACAACAAIABgAOABwALAAwACQACwDx/+j/8P/4//X/6P/b/93/7f8EABkAJAAiABwAGQAZABsAFwALAPv/8P/v//z/EwAqADgAPwBBAEQASwBSAFIARwAwABUA/v/u/+3/+f8CAAEA+f/w//D//P8FAAAA8f/f/9T/1f/U/8z/wf+7/7z/w//M/9f/4v/l/9//0//E/77/xv/Q/9X/0//O/83/2P/u/wcAGgAhABwAGAAZABgAEgAJAP//+v8BABMAJgAxADMAKwAnADAA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y//e//H/BQAbADAASQBsAJoA0QAKATsBXwF0AXkBcQFcATkBDgHdAK0AgABYADQAEgDz/9n/w/+w/5//j/+B/3P/ZP9W/03/SP9E/0H/Pv8//0T/Tv9b/2v/fP+J/5L/l/+d/6j/uv/Q/+r/CwA1AGcAngDXAAgBLQE/AT4BLQEQAe0AxgCdAHUAUQA2ACIAEAD//+3/2f/E/63/kv91/1f/O/8o/x//IP8p/zn/S/9b/2r/dv9//4X/hP99/3X/df+C/53/w//t/xkARgB1AKIAygDrAAQBFAEaAREB/QDmANEAvQCnAIwAbwBWAEAALAAaAAoA/P/v/97/yv+1/6P/k/+F/3r/dP90/3v/hf+M/5D/jf+D/3P/X/9L/zr/Mv82/0n/av+Y/87/BwA8AGgAhwCcAKcAqgCmAJwAjQCCAH0AgACKAJYAoACnAKoAqAChAJcAiQB0AFYAMwAPAOr/w/+b/3f/W/9K/0L/QP9B/0f/Uf9c/2T/Z/9k/17/W/9e/2z/h/+s/9X//v8kAEgAaACDAJYAnwCjAKUAqQCwALwAywDcAOwA9QD0AOYAzQCrAIEAUwAiAPP/yf+n/4r/cP9Y/0j/P/89/zz/O/85/zr/P/9F/0v/UP9Y/2D/av93/4r/o/+//9r/8/8NACwAUgB3AJgAsQDEANAA1ADQAMcAugCrAJwAjAB+AHAAYQBPADwAKQAXAAUA8P/Y/8D/q/+c/5T/kf+R/5H/kv+T/5j/nv+i/6P/pf+o/6//uP/C/83/2f/m//H/+P///woAGwAxAEoAYgB3AIYAigCHAIEAfAB4AHEAZwBcAFUAUQBOAEgAOwAmAAwA7//S/7j/oP+L/3z/dP93/4L/kf+g/6r/sP+v/6z/pf+b/5L/iv+H/4z/mf+q/7z/y//Y/+b/9/8KAB4ANQBLAGAAbwB7AIgAmACpALgAwgDGAMMAuQCnAI8AdABXADkAHAAAAOj/1v/G/7n/r/+o/6X/of+b/5X/kP+M/4j/gv98/3j/df91/3f/f/+M/53/sP/F/93/+f8ZADsAXgB/AJsAsQC9AMQAyQDMAMsAxAC3AKkAmACCAGcARwAjAP//3P+5/5n/ff9m/1X/Sv9G/0f/Tv9Y/2P/b/9//5H/pP+4/8n/1//j/+7//P8MABsAJwAxADwATABiAH4AnAC4AM4A3ADgANwAzwC5AJwAegBWADQAFAD1/9j/v/+p/5X/gf9w/2P/XP9Z/1r/X/9u/4P/mv+t/7j/vf/A/8D/vf+4/7P/s/+6/8v/5P8DACMAPQBSAGEAbgB5AIEAhgCJAIsAjACNAIoAhgCAAHYAaABTADkAHQAAAOP/y/+9/7f/tv+2/7T/sP+s/6f/oP+Z/5L/i/+G/4H/f/+D/43/mf+k/6//uP/C/8v/1f/h/+3/+f8EABEAIQA1AE4AZwB+AJEAngClAKUAowChAJ8AnACXAJAAhgB5AGcAUgA5AB8ABADq/9H/vf+v/6P/mP+Q/43/jf+N/4v/iP+G/4P/f/93/3D/bP9s/3D/eP+G/53/uf/Z//z/IABFAGsAjwCvAMoA2gDgANwA0gDHAL0AtACqAJ8AlACJAH0AbgBaAD4AHAD0/8j/nP90/1H/N/8o/yL/I/8q/zT/P/9J/1H/Vv9Z/1z/Yf9q/3f/jP+r/9L/+/8iAEQAZACDAJ8AtADFANIA3wDqAPAA8ADrAOMA1wDFAKsAigBlAD0AFADt/8z/sv+c/4j/dP9i/1T/SP89/zX/M/83/0D/TP9b/2//h/+f/7X/x//X/+f/9/8HABcAKAA8AFMAbACGAJ0AsQDAAMoAzwDPAMgAuwCqAJgAhQBxAF0ARwAwABYA+//h/8r/tv+j/5T/if+D/4D/fP93/3H/a/9n/2X/Z/9u/3j/g/+P/57/sv/J/93/6P/p/+n/6//v//P/9f/5/wQAFwAxAFAAcACNAKMArwCzALAAqACdAJEAggBxAGEAUgBGAD0ANQAsAB8ADwD+/+3/2//I/7X/pf+a/5T/kP+M/4f/gf99/3v/ef93/3T/c/92/33/i/+f/7n/1f/w/wkAIwA/AF0AegCTAKcAtQDCAM0A1QDXANIAxQCyAJwAggBlAEcAKwASAP3/6//Z/8f/s/+c/4T/bf9a/0r/PP8v/yX/If8l/zD/QP9U/2v/hP+d/7T/zv/t/w0ALABGAF4AdwCRAKkAuwDFAMoAygDFAL0AswCrAKUAoACZAI0AfABoAFAANQAWAPX/1P+2/53/iv98/3D/Z/9k/2b/bP90/3v/gP+G/47/mP+l/7P/wf/O/9r/6f/5/woAGAAjAC0AOQBHAFUAYgBuAHgAfgB8AHMAZwBcAFAARAA1ACcAGQALAP7/8//p/+D/2P/M/77/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4f/m/+v/8P/0//n//P8AAAQACwASABsAJQAvADkAQABEAEUAQwBAADsAMwAqACAAFwAQAAsABgACAP///v/+//z/+P/z/+3/6f/l/+D/2v/V/9H/0f/S/9P/1v/Z/9z/4P/k/+j/7P/x//f//f8DAAcADAARABcAHgAlACsALwAyADMANAA1ADYANgA0ADAAKgAjABwAFQANAAMA+f/v/+f/3//X/9H/zP/K/8n/yv/L/8v/zP/N/87/zv/P/9D/0v/U/9f/3P/j/+3/9/8BAAsAFgAfACcALQAxADQANgA2ADMALwArACkAKQApACgAJgAjACIAIQAeABkAEQAJAAEA+//2/+//6f/k/+D/3f/b/9j/1v/V/9b/2f/c/+H/5v/s//H/9//7/wAABAAGAAcABgAGAAcACAAKAA0AEAAVABkAHQAgACAAHwAeABwAGwAZABUAEQANAAoABgADAP//+//4//T/8P/t/+r/6P/m/+b/5v/n/+j/6f/r/+3/8P/y//P/8//y//H/8f/y//P/9v/5//7/AgAGAAsAEAAWABsAIAAjACQAJAAiACAAHQAbABgAFAAQAAwACQAGAAMAAAD8//j/9f/x/+7/6//m/+D/2//X/9T/0v/Q/9D/0v/X/93/5P/q/+//9f/6////BAAHAAoADAAOAA8AEAATABcAHQAjACgAKwAtAC4AMAAxADAALgAqACUAHwAZABMADgAIAAEA+v/0/+//6//o/+T/4f/d/9v/2v/Z/9j/2P/Y/9v/3f/f/+H/4v/l/+n/7//3////BwAPABcAHgAlACkAKwArACoAKAAmACMAHgAaABcAFgAVABUAFAASABAADgAMAAgAAgD6//P/7P/m/+D/2//W/9T/1P/V/9f/2f/b/97/4v/k/+b/5//o/+n/6//u//H/9f/6////BAAKAA8AFAAaACAAJgAsADAAMwAzADIALwArACcAIgAdABYAEQAMAAkABgADAAAA/f/7//r/+P/1//D/7P/o/+T/4f/f/9z/2//c/97/4f/l/+n/7v/y//b/+v/8////AQACAAQABAAFAAYACAAKAA4AEQATABQAFAATABMAFAATABIADwANAAoACAAHAAYABAACAAAA/v/9//z/+v/4//X/8v/v/+7/7v/v//D/8v/0//b/+P/6//v//P/9////AAABAAEAAQABAAIAAgADAAMABAAGAAkACwANAA4ADgAPAA8ADwAPAA8ADgAOAA0ADAAKAAgABQADAAAA/v/7//r/+P/3//X/9P/0//P/8//x/+//7f/r/+r/6v/q/+v/7P/t//D/8//2//n//f8AAAIABAAGAAgACwAOAA8AEQASABMAFAAWABcAGAAYABcAFgAUABIADgAKAAUAAQD9//r/9//0//L/8P/w//D/8f/x//L/8//0//X/9f/1//X/9f/0//P/8v/y//P/9f/3//r//v8CAAcADAAQABQAFwAZABoAGgAYABYAFAASABAADgAMAAkACAAGAAUABAACAAEA///+//v/+P/1//H/7v/s/+r/6P/m/+b/5v/o/+n/6//u//D/8//2//n//P///wIABAAGAAcACAAJAAsADAAOAA8AEQATABQAFAAVABUAFQAUABIAEAAOAAwACgAHAAQAAgAAAP7/+//5//f/9v/1//P/8v/x//H/8f/x//H/8f/y//P/9P/1//b/9//5//r/+//9//7/AAACAAQABgAHAAkACwANAA8ADwAOAA0ADAAKAAkABwAFAAMAAQAAAP///f/8//v/+v/6//r/+v/5//n/+f/4//j/+P/4//j/+f/5//r/+//8//3//v///wAAAQACAAMABAAFAAYABgAHAAcABwAHAAgACAAJAAkACAAIAAgACAAIAAgABwAHAAYABQADAAIAAAD+//3/+//6//j/9//2//X/9P/1//X/9v/3//j/+f/6//v//P/9//3//f/9//3//v/+////AAABAAIABAAEAAUABgAHAAgACAAIAAcABwAGAAYABQAFAAQABAADAAMAAgACAAEAAAAAAP///v/9//3//P/8//v/+//7//v/+//7//v/+//7//z//P/9//7//v///wAAAAABAAIAAgACAAMAAwADAAMAAwAEAAQABAAEAAQABAADAAMAAwACAAIAAQABAAEAAAAAAP///v/+//7//f/9//3//f/9//3//f/+//7//v/+//7//v/+//////////////8AAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
let birdCrowdBuffer041=null, birdCrowdContext041=null;
function playBirdNestReaction041() {
  if (!revealTopNest || !game || soundMuted || !soundCard) return;
  const card=pinnedNestRevealFace() || freezeTopNestCard();
  if (!card || !(isRookCard(card) || (includeRed2 && isRed2(card)))) return;
  const key=String(game.handNumber)+':'+String(game.dealer)+':'+String(card.id);
  if(window.__birdNestReaction041===key)return;
  const ctx=ensureAudio();if(!ctx)return;
  window.__birdNestReaction041=key;
  if(birdCrowdContext041!==ctx){
    birdCrowdContext041=ctx;
    const bytes=atob(birdCrowdPCM041);
    birdCrowdBuffer041=ctx.createBuffer(1,bytes.length/2,22050);
    const out=birdCrowdBuffer041.getChannelData(0);
    for(let i=0;i<out.length;i++){let v=bytes.charCodeAt(i*2)|(bytes.charCodeAt(i*2+1)<<8);if(v>=32768)v-=65536;out[i]=v/32768;}
  }
  const source=ctx.createBufferSource();source.buffer=birdCrowdBuffer041;
  source.connect(window.HORAudioMixer.output(ctx,'gameplay'));presentationSounds035.add(source);
  source.onended=()=>{presentationSounds035.delete(source);source.disconnect();};
  source.start(ctx.currentTime+.04);
}
let awardCrowdLastPlayed041 = 0;
window.horPlayAwardCrowd041 = playAwardApplause063;

function reconcileHand041(hand, markup) {
  const template=document.createElement('template');template.innerHTML=markup;
  const old=new Map(Array.from(hand.children).map(el=>[String(el.dataset.id),el]));
  const keep=new Set();
  Array.from(template.content.children).forEach((fresh,index)=>{
    const id=String(fresh.dataset.id),el=old.get(id)||fresh;keep.add(el);
    if(el!==fresh){if(el.className!==fresh.className)el.className=fresh.className;if(el.innerHTML!==fresh.innerHTML)el.innerHTML=fresh.innerHTML;}
    const at=hand.children[index];if(at!==el)hand.insertBefore(el,at||null);
  });
  Array.from(hand.children).forEach(el=>{if(!keep.has(el))el.remove();});
}
function rememberOwnPlayOrigin041(id) {
  const hand=$('myHand');
  const el=hand&&Array.from(hand.querySelectorAll('.card-face')).find(el=>String(el.dataset.id)===String(id));
  const r=el&&el.getBoundingClientRect();
  if(r&&r.width)window.__ownPlayOrigin041={id:String(id),hand:game.handNumber,x:r.left+r.width/2,y:r.top+r.height/2};
}
function animatePlayedTravel041(area,trick) {
  if(!isPortraitViewport() || !trick.length)return;
  const signatures=trick.map(t=>String(game.handNumber)+':'+t.player+':'+t.card.id);
  const seen=window.__playedTravelSeen041||[];
  window.__playedTravelSeen041=signatures;
  // Animate the new live play only; snapshots and routine re-renders never replay older cards.
  const index=trick.length-1;if(seen.includes(signatures[index]))return;
  if(document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const t=trick[index],wrap=area.querySelectorAll('.trick-card-wrap')[index];
  if(!wrap || !wrap.animate)return;
  const face=wrap.querySelector('.card-face'),end=(face||wrap).getBoundingClientRect();
  const slot=$(seatSlotIdForIndex(t.player));
  const avatar=slot&&slot.querySelector('.seat-avatar,.seat-avatar-side');
  let from=avatar&&avatar.getBoundingClientRect();
  const own=window.__ownPlayOrigin041;
  let x,y;
  if(t.player===myIndex && own && own.hand===game.handNumber && own.id===String(t.card.id)){x=own.x;y=own.y;window.__ownPlayOrigin041=null;}
  else {if(t.player===myIndex)from=$('myHand')&&$('myHand').getBoundingClientRect();if(!from || !from.width)return;x=from.left+from.width/2;y=from.top+from.height/2;}
  const dx=x-(end.left+end.width/2),dy=y-(end.top+end.height/2);
  const scene=wrap.querySelector('.played-scene');if(!scene || !scene.animate)return;
  const base=getComputedStyle(scene).transform;
  const pose=base==='none'?'':base;
  scene.animate([{transform:`translate3d(${dx}px,${dy}px,0) ${pose}`,opacity:1},{transform:`translate3d(0,0,0) ${pose}`,opacity:1}],{duration:solScaledDelay(480,100),easing:'cubic-bezier(.22,.65,.3,1)'});
}

// ROOK042 candidate: a remembered owner choice; no AI matching or ranking.
function favoritePartnerOwner042() {
  const input = $('hor-player-name');
  return playMemoryNameKey(myName || (input && input.value) || 'You');
}
function favoritePartnerStore042() {
  try {
    const value = JSON.parse(localStorage.getItem('horFavoritePartnersV1') || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (_) { return {}; }
}
function favoritePartner042() {
  const store = favoritePartnerStore042();
  const name = Object.prototype.hasOwnProperty.call(store, favoritePartnerOwner042())
    ? store[favoritePartnerOwner042()] : '';
  return BOT_PERSONAS.find(p => p.name === name) || null;
}
function favoritePartnerSeat042() {
  const me = (players || []).find(p => p && !p.isBot && p.id === myPeerId);
  return me && Number.isInteger(me.seat) && me.seat >= 0 && me.seat < 4
    ? (me.seat + 2) % 4 : -1;
}
function saveFavoritePartner042(name) {
  const persona = BOT_PERSONAS.find(p => p.name === name);
  if (name && !persona) return false;
  const store = favoritePartnerStore042();
  // defineProperty also handles names such as __proto__ without changing prototypes.
  Object.defineProperty(store, favoritePartnerOwner042(), {
    value: persona ? persona.name : '', writable:true, enumerable:true, configurable:true
  });
  try { localStorage.setItem('horFavoritePartnersV1', JSON.stringify(store)); }
  catch (_) {
    const hint = $('favoritePartnerHint');
    if (hint) hint.textContent = 'Could not save your favorite. Please try again.';
    return false;
  }
  syncFavoritePartner042();
  return true;
}
function syncFavoritePartner042() {
  const select = $('opt-favorite-partner');
  if (!select) return;
  if (!select.dataset.favoriteReady) {
    select.innerHTML = '<option value="">No favorite · choose normally</option>'
      + BOT_PERSONAS.map(p => '<option value="' + escapeHtmlSafe(p.name) + '">'
        + escapeHtmlSafe(p.name) + ' · ' + escapeHtmlSafe(STYLE_TITLES[p.style] || p.style)
        + '</option>').join('');
    select.dataset.favoriteReady = '1';
    select.onchange = () => { if (!saveFavoritePartner042(select.value)) select.value = (favoritePartner042() || {}).name || ''; };
  }
  const favorite = favoritePartner042();
  select.value = favorite ? favorite.name : '';
  const hint = $('favoritePartnerHint');
  if (hint) hint.textContent = favorite
    ? favorite.name + ' is your offline partner until you change it. Changes apply to your next offline game. Saved on this device.'
    : 'Keep your favorite for offline play against three bots. Changes apply to your next offline game. Saved on this device.';
}
function applyFavoritePartner042() {
  if (!isHost || isSpectator || !(isSoloPractice || roomCode === 'OFFLINE')) return false;
  const favorite = favoritePartner042(), seat = favoritePartnerSeat042();
  if (!favorite || seat < 0) return false;
  if ((players || []).some(p => p && !p.isBot && (playerAvatars[p.id] || p.avatar) === favorite.avatar)) return false;
  const current = playerAtSeat(seat);
  // A human partner always keeps their seat; their host cannot be changed here.
  if (!current || !current.isBot || current.name === favorite.name) return false;
  const existing = (players || []).find(p => p && p.isBot && p.name === favorite.name);
  if (existing) {
    const oldSeat = existing.seat;
    existing.seat = seat; existing.team = seat % 2;
    current.seat = oldSeat; current.team = oldSeat % 2;
  } else {
    current.name = favorite.name; current.botStyle = favorite.style;
    current.avatar = favorite.avatar || AVATARS[0];
    current.careerPublic = (horCareerModeOn() && window.HORProgression && HORProgression.localCareer && HORProgression.localCareer.botPublicProfile)
      ? HORProgression.localCareer.botPublicProfile(favorite.name) : null;
    playerAvatars[current.id] = current.avatar;
  }
  return true;
}
try { syncFavoritePartner042(); } catch (_) {}

(function(){
 const FAMILIES={smoothcard735:'Card lift',smoothcard736down:'Card set down',bidup735:'Bid increase',biddown735:'Bid decrease',paper:'Card movement',gather:'Gather cards',click:'Button',wood:'Wood tap',clink:'Glass clink',stamp:'Trump stamp',tick:'Clock tick',wings:'Wing flaps',applause:'Award applause'};
 const previewSources=new Set();
 window.he064Gain=category=>window.HORAudioMixer?.level(category==='preview'?'gameplay':category==='character'||category==='atmosphere'?category:'gameplay')??1;
 function stopPreviewAudio(){
  previewSources.forEach(src=>{try{src.stop();}catch(e){}});
  previewSources.clear();
 }
 function track(src){if(src)previewSources.add(src);return src;}
 window.he064Track=track;
 function openMenu(){
  const root=document.getElementById('houseEffects064');
  if(!root)return;
  root.hidden=false;
  root.setAttribute('aria-hidden','false');
  document.body.classList.add('he064-open');
  const done=root.querySelector('#he064Done');if(done)done.focus({preventScroll:true});
 }
 function closeMenu(){
  stopPreviewAudio();
  const root=document.getElementById('houseEffects064');
  if(root){root.hidden=true;root.setAttribute('aria-hidden','true');}
  document.body.classList.remove('he064-open');
  const opener=document.getElementById('openHouseEffects064');if(opener)opener.focus({preventScroll:true});
 }
 async function playFamily(kind,index){
  stopPreviewAudio();
  if(soundMuted)return;
  await loadNatural063(kind,index);
  track(playNatural063(kind,.65,0,'preview',index));
 }
 function init(){
  const host=document.querySelector('.gh-menu-sound .gh-sound-panel');if(!host||document.getElementById('houseEffects064'))return;
  const launch=document.createElement('button');
  launch.type='button';launch.id='openHouseEffects064';launch.textContent='Sound variations & effects';
  launch.onclick=(e)=>{e.preventDefault();e.stopPropagation();openMenu();};
  host.appendChild(launch);
  const root=document.createElement('div');
  root.id='houseEffects064';root.hidden=true;root.setAttribute('aria-hidden','true');
  root.innerHTML='<div class="he064-shell" role="dialog" aria-label="House Effects"><header class="he064-head"><div><b>House Effects</b><small>Sound choices save automatically</small></div></header><div class="he064-body"></div><footer class="he064-foot"><button type="button" id="he064Done">Done</button></footer></div>';
  document.body.appendChild(root);
  const body=root.querySelector('.he064-body');
  const sounds=document.createElement('section');sounds.dataset.hePane='sounds';
  const vols=document.createElement('div');vols.className='he064-vols';
  vols.textContent='Volumes and voice mute are in Sounds & Atmosphere → Volume Controls.';
  sounds.appendChild(vols);
  Object.entries(FAMILIES).forEach(([kind,title])=>{
   const row=document.createElement('div');row.className='he064-row';
   const count=naturalCounts063[kind]||1;
   const sel=document.createElement('select');
   for(let i=1;i<=count;i++){const o=document.createElement('option');o.value=String(i);o.textContent='Variation '+i;sel.appendChild(o);}
   if(count>1){const o=document.createElement('option');o.value='rotate';o.textContent='Rotation';sel.appendChild(o);}
   sel.value=String(naturalPreferences063[kind]??(count>1?'rotate':1));
   sel.setAttribute('aria-label',title+' variation');sel.dataset.soundFamily=kind;
   sel.onchange=()=>{stopPreviewAudio();setNaturalPreference063(kind,sel.value==='rotate'?'rotate':Number(sel.value));};
   const play=document.createElement('button');play.type='button';play.textContent='Play';
   const stop=document.createElement('button');stop.type='button';stop.textContent='Stop';
   play.onclick=async()=>{if(sel.value==='rotate'){stopPreviewAudio();for(let n=0;n<count;n++){await loadNatural063(kind,n+1);track(playNatural063(kind,.65,n*380,'preview',n+1));}}else playFamily(kind,Number(sel.value));};
   stop.onclick=stopPreviewAudio;
   row.append(document.createTextNode(title+' '),sel,play,stop);
   const label=document.createElement('label');label.className='he-volume';label.textContent='Volume ';const output=document.createElement('output'),slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value=String(naturalLevels063[kind]??100);slider.setAttribute('aria-label',title+' volume');output.textContent=slider.value+'%';slider.oninput=()=>{stopPreviewAudio();setNaturalLevel063(kind,slider.value);output.textContent=slider.value+'%';};label.append(output,slider);row.append(label);
   sounds.appendChild(row);
  });
  body.append(sounds);
  root.querySelector('#he064Done').onclick=closeMenu;
  root.addEventListener('pointerdown',(e)=>e.stopPropagation());
  root.addEventListener('click',(e)=>e.stopPropagation());
  root.addEventListener('keydown',(e)=>{if(e.key==='Escape'){e.preventDefault();closeMenu();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 let rareTimer=0;
 function armRareRaven(){
  const wait=(8+Math.random()*7)*60*1000;
  rareTimer=setTimeout(()=>{
   const critical=document.body.classList.contains('he064-open')||document.body.classList.contains('bidding')||document.getElementById('discardModal');
   if(!critical&&!soundMuted&&soundRook)playRavenCalls060(1);
   armRareRaven();
  },wait);
 }
 armRareRaven();
})();

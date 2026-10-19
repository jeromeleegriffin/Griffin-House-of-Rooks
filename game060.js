/* Pre-play selection build 2026-09-11 */
// House of Rooks — host-from-phone multiplayer (PeerJS)
// Author: Jerome Griffin
// Copyright (c) 2026 Jerome Griffin / Griffin House

// Bump this alongside the game.js?v= / sw.js CACHE version on every deploy.
// It's exchanged during the join handshake so a stale host or joiner (e.g.
// one still running old cached JS) gets caught and auto-updated instead of
// silently failing or behaving unpredictably against a mismatched peer.
const APP_VERSION = '846-complete-repairs-20261019';
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
  const match = String(v == null ? '' : v)
    .trim()
    .match(/^(?:rook|v|r)?(\d+)/i);
  const n = match ? parseInt(match[1], 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

const COLORS = ['green', 'red', 'yellow', 'black'];
const COLOR_NAMES = { green: 'Green', red: 'Red', yellow: 'Yellow', black: 'Black' };
const RANKS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // after removing 1-4

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
let includeOnes = true; // 1 of each color (15 pts, high in suit)
let includeRook = true;
let onesHigh = true; // 1 ranks above 14 in its color
let rookLowest = false; // Rook is lowest trump instead of highest
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
/** Shoot the Moon: bidding every counter in the deck is an all-or-nothing
 * bid — make it and win the game outright, miss it and go set as usual */
let shootMoonEnabled = true;
/** Bot delay: blitz | normal | slow */
let botSpeed = 'normal';
let horGamePace = (() => {
  try {
    const n = Number(localStorage.getItem('horGamePace'));
    return [1, 3, 99].includes(n) ? n : [2, 4].includes(n) ? 3 : 1;
  } catch (e) {
    return 1;
  }
})();
function horPaintGamePace() {
  document.querySelectorAll('#scoreSpeed701 [data-score-pace]').forEach((b) => {
    const active = Number(b.dataset.scorePace) === horGamePace;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}
function horSetGamePace(v) {
  const n = Number(v);
  horGamePace = [1, 3, 99].includes(n) ? n : 1;
  try {
    localStorage.setItem('horGamePace', String(horGamePace));
  } catch (e) {}
  document.body.dataset.gamePace = horGamePace === 99 ? 'max' : String(horGamePace);
  document.body.style.setProperty(
    '--hor-pace-factor',
    String(1 / (horGamePace === 99 ? 20 : horGamePace))
  );
  horPaintGamePace();
  try {
    if (botTimer && isBotTurn()) {
      clearTimeout(botTimer);
      botTimer = null;
      scheduleBot();
    }
  } catch (e) {}
  return horGamePace;
}
window.__ghSetGamePace630 = horSetGamePace;
window.__ghGetGamePace630 = () => horGamePace;
window.__ghSetBotSpeed623 = function (v) {
  if (v !== 'blitz' && v !== 'normal' && v !== 'slow') return botSpeed;
  botSpeed = v;
  try {
    const bs = document.getElementById('opt-bot-speed');
    if (bs) bs.value = botSpeed;
    if (typeof broadcastPlaySettings === 'function') broadcastPlaySettings();
  } catch (e) {}
  return botSpeed;
};
window.__ghGetBotSpeed623 = function () {
  return botSpeed;
};

// Player pace control (1x, 3x, MAX); retired diagnostic multiplier removed.
function solScaledDelay(ms, floorMs) {
  const production = horGamePace === 99 ? 20 : Math.max(1, Number(horGamePace) || 1);
  const speed = production;
  if (speed <= 1) return Math.max(0, Math.round(ms));
  const requestedFloor = Math.max(0, Number(floorMs == null ? 90 : floorMs));
  const floor =
    requestedFloor === 0
      ? 0
      : horGamePace === 99
        ? Math.min(requestedFloor, 35)
        : Math.max(45, Math.round(requestedFloor / production));
  return Math.max(floor, Math.round(Number(ms || 0) / speed));
}
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
let soundCard = true,
  soundTurn = localStorage.getItem('rookSoundTurn') !== '0',
  soundRook = true,
  soundTick = true;
let horCardStyle = localStorage.getItem('horCardStyle') || 'premium';
document.documentElement.classList.toggle('hor-original-cards', horCardStyle === 'original');
let turnSoundChoice = Math.max(
  1,
  Math.min(20, parseInt(localStorage.getItem('rookTurnSoundChoice') || '20', 10) || 20)
);
let playLockUntil = 0;
let knownVoids = [{}, {}, {}, {}]; // extreme bot: playerIdx -> {color: true}
function freshMatchStats() {
  return {
    hands: 0,
    highBid: 0,
    setsA: 0,
    setsB: 0,
    madeA: 0,
    madeB: 0,
    bidSum: 0,
    bidCount: 0,
  };
}
let matchStats = freshMatchStats();
// Per-seat stats for the current match — tracked for every seat, human or bot,
// so the stats page can show a real breakdown instead of just team totals.
function freshPlayerStat() {
  return {
    hands: 0,
    bidsWon: 0,
    highBid: 0,
    bidSum: 0,
    bidsMade: 0,
    bidsSet: 0,
    points: 0,
    tricksWon: 0,
    trickPtsSum: 0,
    rookCaptures: 0,
    red2Captures: 0,
    bigTricks: 0,
    nestWins: 0,
    nestPts: 0,
    moonAttempts: 0,
    moonMade: 0,
    bags: 0,
    gamesPlayed: 0,
    gamesWon: 0,
  };
}
let playerStats = [freshPlayerStat(), freshPlayerStat(), freshPlayerStat(), freshPlayerStat()];
function resetPlayerStats() {
  playerStats = [freshPlayerStat(), freshPlayerStat(), freshPlayerStat(), freshPlayerStat()];
}
function ps(idx) {
  if (idx == null || idx < 0 || idx > 3) return freshPlayerStat();
  if (!playerStats[idx]) playerStats[idx] = freshPlayerStat();
  return playerStats[idx];
}
// Legacy statistics remain preserved; the display reads canonical careers after migration.
function lifetimeStatsKey() {
  return 'rookLifetimeStats';
}
function loadLifetimeStats() {
  try {
    const s = window.HORProgression?.core?.read();
    if (s) {
      const rows = {};
      for (const r of Object.values(s.records)) {
        const key = Object.hasOwn(rows, r.displayName)
          ? r.displayName + (r.isBot ? ' (bot)' : ' (you)')
          : r.displayName;
        rows[key] = { ...r.stats, isBot: r.isBot, avatar: r.avatar };
      }
      return rows;
    }
  } catch (e) {
    console.error('[Career display]', e.message);
  }
  try {
    return JSON.parse(localStorage.getItem(lifetimeStatsKey())) || {};
  } catch (e) {
    return {};
  }
}
function saveLifetimeStats(obj) {
  try {
    localStorage.setItem(lifetimeStatsKey(), JSON.stringify(obj));
  } catch (e) {}
}
function horCareerModeOn() {
  try {
    return !!(
      window.HORProgression &&
      HORProgression.localCareer &&
      HORProgression.localCareer.mode &&
      HORProgression.localCareer.mode() === 'local'
    );
  } catch (e) {
    return false;
  }
}
function horMyCareerProfile() {
  try {
    return horCareerModeOn() && HORProgression.localCareer.publicProfile
      ? HORProgression.localCareer.publicProfile()
      : null;
  } catch (e) {
    return null;
  }
}
function horCareerProfileForPlayer(p) {
  if (!p) return null;

  // Remote/shared profile wins when it is already attached to this replicated player.
  if (p.careerPublic && p.careerPublic.enabled) return p.careerPublic;

  // Local human: do not depend on whichever players/game.players snapshot happens to
  // be current. Resolve directly from the Career service at render time.
  if (!p.isBot) {
    const isLocal =
      (p.id && myPeerId && p.id === myPeerId) ||
      (Number.isInteger(myIndex) &&
        game &&
        Array.isArray(game.players) &&
        game.players[myIndex] === p) ||
      (Number.isInteger(myIndex) && Array.isArray(players) && players[myIndex] === p);
    if (isLocal) {
      const mine = horMyCareerProfile();
      if (mine && mine.enabled) {
        p.careerPublic = mine;
        return mine;
      }
    }
    return null;
  }

  // Bots are owned by the local/host Career ledger. Resolve directly instead of
  // requiring careerPublic to survive every network/state clone.
  if (horCareerModeOn()) {
    try {
      if (
        window.HORProgression &&
        HORProgression.localCareer &&
        HORProgression.localCareer.botPublicProfile
      ) {
        const bp = HORProgression.localCareer.botPublicProfile(p.name);
        if (bp && bp.enabled) {
          p.careerPublic = bp;
          return bp;
        }
      }
    } catch (e) {
      console.error('[Career bot profile]', e);
    }
  }
  return null;
}

function horShowCareerForPlayer(p) {
  const prof = horCareerProfileForPlayer(p);
  if (
    prof &&
    window.HORProgression &&
    HORProgression.localCareer &&
    HORProgression.localCareer.showCareerCard
  ) {
    const view = Object.assign({}, prof);
    try {
      if (p && p.isBot) {
        const bp = personaByName(p.name);
        view.personaTitle = bp
          ? (typeof STYLE_TITLES !== 'undefined' && STYLE_TITLES[bp.style]) ||
            bp.style ||
            'House Player'
          : 'House Player';
        view.personaHabit = bp
          ? (typeof STYLE_HABIT !== 'undefined' && STYLE_HABIT[bp.style]) || bp.blurb || ''
          : '';
        view.personaHow = bp ? STYLE_HOWTO[bp.style] || bp.blurb || '' : '';
      } else if (p) {
        const hp = humanPersonaCard(p.name);
        view.personaTitle = hp.title || 'House Player';
        view.personaHabit = hp.habit || '';
        view.personaHow = hp.how || hp.blurb || '';
      }
    } catch (e) {}
    HORProgression.localCareer.showCareerCard(view);
    return true;
  }
  return false;
}

function horCareerBadgeHtml(p) {
  const prof = horCareerProfileForPlayer(p);
  if (!prof || !prof.enabled) {
    try {
      if (horCareerModeOn())
        console.warn('[Career badge missing profile]', {
          name: p && p.name,
          id: p && p.id,
          isBot: !!(p && p.isBot),
          myPeerId,
          myIndex,
          hasCareerPublic: !!(p && p.careerPublic),
          localCareerReady: !!(window.HORProgression && HORProgression.localCareer),
        });
    } catch (e) {}
    // Career mode is ON, so keep the public level chip present while the
    // ledger/profile is still hydrating. A brand-new Career is Level 1.
    if (horCareerModeOn()) {
      const isLocalHuman = !!(p && !p.isBot && p.id && myPeerId && p.id === myPeerId);
      if ((p && p.isBot) || isLocalHuman) {
        const who = escapeHtmlSafe((p && p.id) || 'bot-' + String((p && p.name) || 'bot'));
        return ` <span class="hor-career-badge hor-career-badge-pending" role="button" tabindex="0" data-career-peer="${who}" data-career-name="${escapeHtmlSafe((p && p.name) || '')}" title="Career loading" aria-label="Career loading">★…</span>`;
      }
    }
    return '';
  }
  const level = Math.max(1, Number(prof.level) || 1);
  const who = escapeHtmlSafe(p.id || 'bot-' + String(p.name || 'bot'));
  return ` <span class="hor-career-badge" role="button" tabindex="0" data-career-peer="${who}" data-career-name="${escapeHtmlSafe(p.name || '')}" title="View Career: Level ${level}" aria-label="Career level ${level}">★${level}</span>`;
}

/* Rook479: progression.js loads after game.js. Rehydrate Careers when progression is actually ready. */
window.addEventListener('hor-career-ready', function () {
  try {
    const mine = horMyCareerProfile();
    [players, game && game.players].forEach((pool) => {
      if (!Array.isArray(pool)) return;
      pool.forEach((pl) => {
        if (!pl) return;
        if (!pl.isBot && pl.id === myPeerId && mine && mine.enabled) pl.careerPublic = mine;
        if (
          pl.isBot &&
          horCareerModeOn() &&
          window.HORProgression &&
          HORProgression.localCareer &&
          HORProgression.localCareer.botPublicProfile
        ) {
          const bp = HORProgression.localCareer.botPublicProfile(pl.name);
          if (bp && bp.enabled) pl.careerPublic = bp;
        }
      });
    });
    horRefreshBotCareerProfiles();
    if (typeof renderUI === 'function') renderUI();
  } catch (e) {
    console.error('[Career ready]', e);
  }
});

function horResolveCareerPlayer(id, name) {
  const pools = [];
  if (game && Array.isArray(game.players)) pools.push(game.players);
  if (Array.isArray(players)) pools.push(players);
  for (const pool of pools) {
    let pl = pool.find((x) => x && id && x.id === id);
    if (pl) return pl;
  }
  for (const pool of pools) {
    let pl = pool.find((x) => x && name && String(x.name || '') === String(name));
    if (pl) return pl;
  }
  if (id && myPeerId && id === myPeerId)
    return {
      id: myPeerId,
      name: myName || name || 'You',
      isBot: false,
      careerPublic: horMyCareerProfile(),
    };
  return null;
}
function horBindCareerBadges(root) {
  try {
    (root || document).querySelectorAll('.hor-career-badge').forEach((b) => {
      if (b.__horCareerBound) return;
      b.__horCareerBound = true;
      const open = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = b.getAttribute('data-career-peer') || '';
        const name = b.getAttribute('data-career-name') || '';
        const pl = horResolveCareerPlayer(id, name);
        if (pl) {
          horShowCareerForPlayer(pl);
          return;
        }
        const mine = horMyCareerProfile();
        if (mine && mine.enabled && ((id && id === myPeerId) || (name && name === myName)))
          HORProgression.localCareer.showCareerCard(mine);
      };
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      b.addEventListener(
        'touchstart',
        (e) => {
          e.stopPropagation();
        },
        { passive: true }
      );
      b.addEventListener('click', open);
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') open(e);
      });
    });
  } catch (e) {
    console.error('[Career badge bind]', e);
  }
}
function horShowMyCareer() {
  try {
    const prof = horMyCareerProfile();
    if (
      prof &&
      prof.enabled &&
      window.HORProgression &&
      HORProgression.localCareer &&
      HORProgression.localCareer.showCareerCard
    ) {
      HORProgression.localCareer.showCareerCard(prof);
      return true;
    }
    if (window.HORHouseMenu805?.openCareer) {
      HORHouseMenu805.openCareer();
      return false;
    }
    if (
      window.HORHouseMenu805?.ownerToolsAvailable() &&
      window.HORProgression &&
      HORProgression.localCareer?.showActivationPanel
    ) {
      HORProgression.localCareer.showActivationPanel();
      return false;
    }
  } catch (e) {
    console.error('[My Career]', e);
  }
  return false;
}
window.horShowMyCareer = horShowMyCareer;
function horWireMyCareerButtons() {
  document.querySelectorAll('[data-hor-my-career]').forEach((btn) => {
    if (btn.__horCareerOwnBound) return;
    btn.__horCareerOwnBound = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      horShowMyCareer();
    });
  });
}
document.addEventListener('DOMContentLoaded', horWireMyCareerButtons);
window.addEventListener('hor-career-ready', horWireMyCareerButtons);
function horBroadcastCareerProfile() {
  const profile = horMyCareerProfile();
  if (isHost) {
    const me = (players || []).find((p) => p && !p.isBot && p.id === myPeerId);
    if (me) me.careerPublic = profile;
    broadcast({ type: 'careerProfile', id: myPeerId, profile });
  } else if (hostConnection && hostConnection.open) {
    hostConnection.send({ type: 'careerProfile', id: myPeerId, profile });
  }
}
function horCareerAnnouncement(ev) {
  /* Remote awards remain stored by their owner; never produce local pop-ups. */
}
window.horCareerLocalAnnouncement = function (ev) {
  try {
    if (!horCareerModeOn() || !ev) return;
    if (isHost) broadcast({ type: 'careerAnnouncement', from: myPeerId, event: ev });
    else if (hostConnection && hostConnection.open)
      hostConnection.send({ type: 'careerAnnouncement', from: myPeerId, event: ev });
  } catch (e) {}
};
window.horCareerModeChanged = function () {
  try {
    horRefreshBotCareerProfiles();
    horBroadcastCareerProfile();
    renderUI();
  } catch (e) {}
};
function horRefreshBotCareerProfiles() {
  try {
    if (
      !isHost ||
      !horCareerModeOn() ||
      !window.HORProgression ||
      !HORProgression.localCareer ||
      !HORProgression.localCareer.botPublicProfile
    )
      return;
    (players || []).forEach(function (p) {
      if (p && p.isBot) p.careerPublic = HORProgression.localCareer.botPublicProfile(p.name);
    });
    if (game && Array.isArray(game.players))
      game.players.forEach(function (p) {
        if (p && p.isBot) p.careerPublic = HORProgression.localCareer.botPublicProfile(p.name);
      });
  } catch (e) {}
}

function horRecordCareerHand(event) {
  if (isSpectator || !window.HORProgression?.core) return;
  try {
    let result;
    // Replay missed completed hands after reconnect, mid-match activation, or a failed save.
    const history = (handHistory || [])
      .map((h) => h.careerEvent)
      .filter((e) => e && e.matchId === event.matchId && e.hand <= event.hand);
    if (!history.some((e) => e.hand === event.hand)) history.push(event);
    for (const e of history.sort((a, b) => a.hand - b.hand))
      result = HORProgression.core.recordHand({ ...e, localPeerId: myPeerId, isHost: !!isHost });
    window.__horCareerSaveError = null;
    horBroadcastCareerProfile();
    return result;
  } catch (e) {
    window.__horCareerSaveError = e.message;
    console.error('[Career save]', e.message);
    const el = document.getElementById('messageArea');
    if (el) el.textContent = 'Career save needs attention: ' + e.message;
    return { ok: false, error: e.message };
  }
}

function mergeLifetimeStats(winnerLabel) {
  if (window.HORProgression?.core && (horCareerModeOn() || HORProgression.core.read())) return; // already committed once per hand
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
      const won =
        (winnerLabel === 'Team A' && p.team === 0) || (winnerLabel === 'Team B' && p.team === 1);
      cur.gamesWon = (cur.gamesWon || 0) + (won ? 1 : 0);
      store[p.name] = cur;
    }
    saveLifetimeStats(store);
    // RookGame454: local progression mirrors the authoritative lifetime totals.
    // Preview mode is inert; local mode updates human + official bot careers and celebrations.
    try {
      if (window.HORProgression && HORProgression.localCareer) {
        const owned = {};
        for (const [nm, rec] of Object.entries(store)) {
          if (rec && rec.isBot) {
            if (isHost) owned[nm] = rec;
          } else if (
            (players || []).some((p) => p && !p.isBot && p.id === myPeerId && p.name === nm)
          )
            owned[nm] = rec;
        }
        HORProgression.localCareer.syncFromLifetime(owned, { celebrate: true });
        HORProgression.localCareer.recordRelationships(players, winnerLabel);
        try {
          horBroadcastCareerProfile();
        } catch (e) {}
      }
    } catch (e) {}
  } catch (e) {}
}

/* Rook491: local Career/Stats only. Remove obsolete remote-stat storage keys from older builds. */
// Historical identity/storage keys are retained as evidence; local careers do not use remote endpoints.

const HUMAN_STYLE_MIN_HANDS = 12;
function playMemoryKey() {
  return 'horPlayMemory';
}
function loadPlayMemoryStore() {
  try {
    return JSON.parse(localStorage.getItem(playMemoryKey()) || '{}') || {};
  } catch (e) {
    return {};
  }
}
function savePlayMemoryStore(obj) {
  try {
    localStorage.setItem(playMemoryKey(), JSON.stringify(obj));
  } catch (e) {}
}
function playMemoryNameKey(name) {
  return (
    String(name || '')
      .trim()
      .toLowerCase() || '__device__'
  );
}
function blankPlayMemory(name) {
  return {
    name: name || 'You',
    hands: 0,
    bids: 0,
    passes: 0,
    wonBids: 0,
    made: 0,
    sets: 0,
    highBids: 0,
    thinBids: 0,
    moons: 0,
    points: 0,
    style: 'newPlayer',
    updatedAt: Date.now(),
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
    return {
      style: 'housePlayer',
      title: 'House Player',
      habit: 'House Player',
      how: 'Griffin House player.',
    };
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
  const title =
    style === 'housePlayer'
      ? 'House Player'
      : (typeof STYLE_TITLES !== 'undefined' && STYLE_TITLES[style]) || style;
  const habit = (typeof STYLE_HABIT !== 'undefined' && STYLE_HABIT[style]) || title;
  const how =
    (typeof STYLE_HOWTO !== 'undefined' && STYLE_HOWTO[style]) ||
    'Read from ' + hands + ' hands on this device.';
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
      if (value && typeof maxBid === 'function' && value >= maxBid())
        mem.moons = (mem.moons || 0) + 1;
    }
    putPlayMemory(p.name, mem);
    refreshHumanPersona(p);
  } catch (e) {}
}

function humanPersonaCard(name) {
  const mem = getPlayMemory(name);
  const inf = inferHumanStyle(mem);
  return {
    name: name,
    style: inf.style,
    blurb: inf.how,
    habit: inf.habit,
    title: inf.title,
    hands: mem.hands || 0,
    isHuman: true,
  };
}

const AVATARS = [
  'rookling',
  'fox',
  'badger',
  'owl',
  'cardshark',
  'greenie',
  'bluejay',
  'grumpy',
  'goldfinch',
  'jackal',
  'wolf',
  'raven',
  'lynx',
  'cobra',
  'stag',
  'quill',
  'bramble',
  'moss',
  'emberlyn',
  'cinder',
  'gable',
  'thistle',
  'marrow',
  'pebble',
  'rookery',
  'sable',
  'finch',
  'dagger',
  'willow',
  'hearth',
  'grit',
  'copper',
  'moth',
  'brandy',
  'flint',
  'ivy',
  'shade',
  'barrel',
  'spark',
  'nettle',
  'cobalt',
  'ash',
  'harrier',
  'crow',
  'blaze',
  'nix',
  'titan',
  'pike',
  'drift',
  'dice',
  'anchor',
  'wager',
  'hollow',
  'ember',
  'vex',
  'frost',
  'fang',
  'halo',
  'jerome',
  'jerome_founder',
  ...Object.keys(window.HORHumanAvatars || {}),
];
const AVATAR_LABELS = {
  ...Object.fromEntries(
    Object.entries(window.HORHumanAvatars || {}).map(([id, c]) => [id, c.name])
  ),
  jerome_founder: 'Jerome',
  jerome: 'Jerome',
  rookling: 'Rookling',
  fox: 'Fox',
  badger: 'Badger',
  owl: 'Owl',
  cardshark: 'Card Shark',
  greenie: 'Greenie',
  bluejay: 'Bluejay',
  grumpy: 'Grumpy',
  goldfinch: 'Goldfinch',
  jackal: 'Jackal',
  wolf: 'Wolf',
  raven: 'Raven',
  lynx: 'Lynx',
  cobra: 'Cobra',
  stag: 'Stag',
  quill: 'Quill',
  bramble: 'Bramble',
  moss: 'Moss',
  emberlyn: 'Emberlyn',
  cinder: 'Cinder',
  gable: 'Gable',
  thistle: 'Thistle',
  marrow: 'Marrow',
  pebble: 'Pebble',
  rookery: 'Rookery',
  sable: 'Sable',
  finch: 'Finch',
  dagger: 'Dagger',
  willow: 'Willow',
  hearth: 'Hearth',
  grit: 'Grit',
  copper: 'Copper',
  moth: 'Moth',
  brandy: 'Brandy',
  flint: 'Flint',
  ivy: 'Ivy',
  shade: 'Shade',
  barrel: 'Barrel',
  spark: 'Spark',
  nettle: 'Nettle',
  cobalt: 'Cobalt',
  ash: 'Ash',
  harrier: 'Harrier',
  crow: 'Crow',
  blaze: 'Blaze',
  nix: 'Nix',
  titan: 'Titan',
  pike: 'Pike',
  drift: 'Drift',
  dice: 'Dice',
  anchor: 'Anchor',
  wager: 'Wager',
  hollow: 'Hollow',
  ember: 'Ember',
  vex: 'Vex',
  frost: 'Frost',
  fang: 'Fang',
  halo: 'Halo',
};
/* Production cinematic portraits shipped as avatar-<id>.png. Legacy player
 * picker animals stay on SVG. Unknown ids fall back to rookling.svg. */
const AVATAR_PNG_IDS = {
  grit: 1,
  nix: 1,
  copper: 1,
  crow: 1,
  blaze: 1,
  titan: 1,
  pike: 1,
  drift: 1,
  dice: 1,
  anchor: 1,
  wager: 1,
  hollow: 1,
  ember: 1,
  vex: 1,
  frost: 1,
  fang: 1,
  halo: 1,
  quill: 1,
  bramble: 1,
  moss: 1,
  emberlyn: 1,
  cinder: 1,
  gable: 1,
  thistle: 1,
  marrow: 1,
  pebble: 1,
  rookery: 1,
  sable: 1,
  finch: 1,
  dagger: 1,
  willow: 1,
  hearth: 1,
  moth: 1,
  brandy: 1,
  flint: 1,
  ivy: 1,
  shade: 1,
  barrel: 1,
  spark: 1,
  nettle: 1,
  cobalt: 1,
  ash: 1,
  harrier: 1,
};
function avatarKey(id) {
  return String(id == null ? '' : id)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}
function avatarSrc(id) {
  const key = avatarKey(id);
  if (window.HORHumanAvatars?.[key]) return 'assets/characters077/human/' + key + '-portrait.webp';
  if (key === 'jerome_founder') return 'assets/characters077/jerome_founder-portrait.webp';
  if (key === 'jerome') return 'assets/images/avatar-jerome.png';
  if (key && AVATAR_PNG_IDS[key]) return 'assets/images/avatar-' + key + '.webp';
  if (AVATARS.includes(key)) return 'assets/images/avatar-' + key + '.svg';
  return 'assets/images/avatar-' + AVATARS[0] + '.svg';
}
function avatarHTML(id) {
  return `<img class="seat-avatar-img" src="${avatarSrc(id)}" alt="${AVATAR_LABELS[id] || 'Avatar'}">`;
}
let playerAvatars = {}; // peerId -> avatar id
const PLAYER_AVATAR_KEY = 'griffinHousePlayerAvatar';
function humanAvatarAllowed783(id) {
  return !!window.HORHumanAvatars?.[id] || id === 'jerome_founder';
}
function loadPreferredAvatar() {
  try {
    const id = avatarKey(localStorage.getItem(PLAYER_AVATAR_KEY) || '');
    return humanAvatarAllowed783(id) ? id : '';
  } catch (e) {
    return '';
  }
}
function savePreferredAvatar(id) {
  const key = avatarKey(id);
  if (!humanAvatarAllowed783(key)) return;
  try {
    localStorage.setItem(PLAYER_AVATAR_KEY, key);
  } catch (e) {}
}
// Rook549: first-time humans get a random persistent avatar instead of AVATARS[0].
// Existing/manual selections are never overwritten. Bots keep their existing assignment path.
function validHumanVoice(value) {
  return ['avatar', 'male', 'female', 'silent'].includes(value) ? value : 'avatar';
}
function loadPreferredVoice() {
  try {
    if (
      window.HORFounderDev?.enabled &&
      localStorage.getItem(PLAYER_AVATAR_KEY) === 'jerome_founder'
    )
      return localStorage.getItem('horFounderVoiceV1') === 'silent' ? 'silent' : 'male';
    const v = localStorage.getItem('griffinHousePlayerVoice');
    return ['male', 'female', 'silent'].includes(v) ? v : 'avatar';
  } catch (_) {
    return 'silent';
  }
}
function savePreferredVoice(value) {
  try {
    if (
      window.HORFounderDev?.enabled &&
      localStorage.getItem(PLAYER_AVATAR_KEY) === 'jerome_founder'
    ) {
      localStorage.setItem('horFounderVoiceV1', value === 'silent' ? 'silent' : 'male');
      return;
    }
    localStorage.setItem('griffinHousePlayerVoice', validHumanVoice(value));
  } catch (_) {}
}
function ensurePreferredAvatar() {
  const existing = loadPreferredAvatar();
  if (existing) return existing;
  let pool = AVATARS.filter((id) => id !== 'jerome_founder');
  try {
    const humans = Object.keys(window.HORHumanAvatars || {}).filter((id) => AVATARS.includes(id));
    if (humans.length) pool = humans;
  } catch (_) {}
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
  try {
    const old = localStorage.getItem(PLAYER_AVATAR_KEY);
    if (old && !humanAvatarAllowed783(old) && !localStorage.getItem('horLegacyAvatarBefore783'))
      localStorage.setItem('horLegacyAvatarBefore783', old);
  } catch (_) {}
  savePreferredAvatar(chosen);
  return chosen;
}
function applyPreferredAvatarToMe() {
  const id = ensurePreferredAvatar();
  if (!id) return '';
  if (myPeerId) playerAvatars[myPeerId] = id;
  const me = (players || []).find((p) => p && p.id === myPeerId);
  if (me) {
    me.avatar = id;
    if (id === 'jerome_founder') me.name = 'Jerome';
  }
  if (id === 'jerome_founder') {
    myName = 'Jerome';
    window.HORFounderProfile785?.syncName();
  }
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
    if (a >= g && b >= g) return a === b ? 'Tie' : a > b ? 'Team A' : 'Team B';
    return a >= g ? 'Team A' : 'Team B';
  }
  if (a <= -g || b <= -g) {
    if (a <= -g && b <= -g) return a === b ? 'Tie' : a > b ? 'Team A' : 'Team B';
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
  netSequencing: true,
  netReconnect: true,
  netBackoff: true,
  netHeartbeat: true,
  netDelta: true,
  netAuthoritative: true,
  netTimerSync: true,
  netDuplicateGuard: true,
  netTurnGuard: true,
  netConnectionUI: true,
  netTurnHandoff: true,
  netOwnTurnRecovery: true,
  netDiagnostics: true,
  netGraceRecovery: true,
  netSameIdResync: true,
  netNameReclaim: true,
  netActionQueue: true,
  netIceWatch: true,
  netResyncOnReclaim: true,
  netHoldTimerOnDisconnect: true,
  netSilentDropDetect: true,
  lobbyReconnect: true,
};
const HOR_FEATURE_ALWAYS_ON = {
  customTurnServers: true,
  thinkingPulse: true,
  spectatorLateJoin: true,
  partnerChatAfterNest: true,
  waitForMe: true,
  hostHonorHands: true,
  avatarPersonality: true,
  renderOptimization: true,
};
const HOR_EXP_DEFAULTS = Object.assign(
  {
    tableAtmosphere: false,
    rookAnimation: false,
    cardJuice: false,
    avatarPersonality: true,
    statusIndicators: false,
    matchProgress: false,
    cacheRefresh: false,
    friendlyErrors: false,
    renderOptimization: true,
    debugPanel: false,
  },
  HOR_NET_ALWAYS_ON,
  HOR_FEATURE_ALWAYS_ON
);
function horExpOn(id) {
  try {
    if (HOR_NET_ALWAYS_ON[id] || HOR_FEATURE_ALWAYS_ON[id]) return true;
    return !!(window.horExperimental && window.horExperimental[id]);
  } catch (e) {
    return !!(HOR_NET_ALWAYS_ON[id] || HOR_FEATURE_ALWAYS_ON[id]);
  }
}
window.horExpOn = horExpOn;
window.horExperimental = Object.assign({}, HOR_EXP_DEFAULTS);
let horNetSeq = 0; // host-assigned state sequence
let horLastAppliedSeq = 0; // last public state seq applied on this client
let horOutbox = []; // client actions waiting for an open host connection
let horPeerLastSeen = {}; // peerId -> timestamp (host)
let joinInProgress = false;
let horLastHostSeenAt = 0;
let horHeartbeatTimer = null;
let horReconnectTimer = null;
let horReconnectAttempt = 0;
let horReconnectActive = false;
let horLastPingMs = 0;
let horPingSentAt = 0;
let horJoinConn = null; // latest in-flight join DataConnection
window.horLastPingMs = 0;

function botMaybeTableTalk() {}
function botMaybeStandingsTaunt() {}
function seatSlotIdForIndex(idx) {
  const base = myIndex >= 0 ? myIndex : 0;
  if (idx === base) return 'slot-me';
  if (idx === (base + 1) % 4) return 'slot-left';
  if (idx === (base + 2) % 4) return 'slot-partner';
  if (idx === (base + 3) % 4) return 'slot-right';
  return 'slot-me';
}
function showTableMsgPopup(name, text) {
  if (window.HORRavenFight741?.deferCelebration(() => showTableMsgPopup(name, text))) return;
  const el = $('tableMsgPopup');
  if (!el) return;
  el.innerHTML =
    '<div class="table-msg-box"><div class="table-msg-from">' +
    escapeHtmlSafe(name || 'Player') +
    '</div><div class="table-msg-body">' +
    escapeHtmlSafe(text || '') +
    '</div>' +
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
  if (btn)
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    };
  el.onclick = (e) => {
    if (e.target === el) close();
  };
}
function normalizeTargetScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(2000, Math.trunc(n))) : 500;
}
function readTargetScoreFromUI() {
  const ts = $('opt-target-score');

  if (!ts) return targetScore || 500;
  if (ts.value === 'custom') return normalizeTargetScore(targetScore || 500);

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
  // Programmatic resets/reopens must refresh validation as well as the value.
  if (custom) custom.dispatchEvent(new Event('input', { bubbles: true }));
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
    try {
      if (typeof recomputeHandAndNest === 'function') recomputeHandAndNest();
    } catch (e) {}
    try {
      if (typeof broadcastPlaySettings === 'function') broadcastPlaySettings();
    } catch (e) {}
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
    if (ts.value !== 'custom') apply();
  });

  if (custom) {
    custom.disabled = false;
    custom.readOnly = false;
    const confirmBtn = $('opt-target-score-custom-confirm');
    const feedback = document.createElement('p');
    feedback.id = 'customScoreFeedback836';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    custom.closest('.target-score-custom-wrap').append(feedback);
    custom.setAttribute('aria-describedby', feedback.id);
    const valid = () =>
      /^\d+$/.test(custom.value) && Number(custom.value) >= 1 && Number(custom.value) <= 2000;
    const paint = () => {
      const ok = valid();
      confirmBtn.disabled = !ok;
      custom.setAttribute('aria-invalid', String(!ok));
      feedback.textContent =
        (ok
          ? 'Ready to save ' + Number(custom.value).toLocaleString() + '. '
          : 'Enter a whole number from 1–2,000. ') +
        'Current target: ' +
        Number(targetScore || 500).toLocaleString() +
        '.';
    };
    const commit = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!valid()) {
        paint();
        return;
      }
      targetScore = Number(custom.value);
      custom.value = String(targetScore);
      apply();
      paint();
      feedback.textContent = 'Saved target: ' + Number(targetScore).toLocaleString() + '.';
      custom.blur();
    };
    confirmBtn.addEventListener('click', commit);
    custom.addEventListener('input', paint);
    custom.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') commit(e);
    });
    custom.addEventListener('keyup', (e) => e.stopPropagation());
    custom.addEventListener('click', (e) => e.stopPropagation());
    ts.addEventListener('change', paint);
    paint();
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
const PLAQUE_STYLES = {
  ink: { bg: '#111111', fg: '#ffffff', label: 'Black / white' },
  paper: { bg: '#f5f5f5', fg: '#111111', label: 'White / black' },
  gold: { bg: '#3d2a14', fg: '#ffe9a8', label: 'Oak / gold' },
  forest: { bg: '#0d3b1e', fg: '#e8f5e9', label: 'Forest / mint' },
  wine: { bg: '#4a1020', fg: '#fce4ec', label: 'Wine / rose' },
  navy: { bg: '#0d1b3d', fg: '#e3f2fd', label: 'Navy / ice' },
  rust: { bg: '#5c2e0a', fg: '#fff3e0', label: 'Rust / cream' },
  slate: { bg: '#263238', fg: '#eceff1', label: 'Slate / silver' },
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
  if (a) {
    root.style.setProperty('--plaque-a-bg', a.bg);
    root.style.setProperty('--plaque-a-fg', a.fg);
  }
  if (b) {
    root.style.setProperty('--plaque-b-bg', b.bg);
    root.style.setProperty('--plaque-b-fg', b.fg);
  }
  const base = typeof myIndex === 'number' && myIndex >= 0 ? myIndex : 0;
  const map = { me: base, left: (base + 1) % 4, partner: (base + 2) % 4, right: (base + 3) % 4 };
  Object.keys(map).forEach((slot) => {
    const seatEl = $('slot-' + slot);
    const idx = map[slot];
    const p = (game && game.players && game.players[idx]) || players[idx];
    const team = p && typeof p.team === 'number' ? p.team : idx % 2;
    if (seatEl) seatEl.setAttribute('data-plaque-team', String(team));
    paintNamePlaque(seatEl && seatEl.querySelector('.name'), team);
  });
  for (let s = 0; s < 4; s++) {
    const wait = $('waitSeat' + s);
    if (!wait) continue;
    const p = typeof playerAtSeat === 'function' ? playerAtSeat(s) : players[s];
    const team = p && typeof p.team === 'number' ? p.team : s % 2;
    paintNamePlaque(wait.querySelector('.wait-seat-name'), team);
  }
}
window.applyPlaqueColors = applyPlaqueColors;
let whisperTargetIdx = -1;
let beerSeats = [];
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
const CARD_BACK_CLASSES = CARD_BACKS.map((b) => 'cardback-' + b.id);
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
  if (nest < 3) {
    nest = 3;
    hand = Math.floor((total - nest) / 4);
    nest = total - hand * 4;
  }
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
    try {
      broadcastPlaySettings();
    } catch (e) {}
  }
}

function syncOptionsUI() {
  try {
    syncFavoritePartner042();
  } catch (_) {}
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
  try {
    syncTargetScoreUI();
  } catch (e) {
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
  text.textContent = parts.length ? parts.join(' / ') + ' anytime' : 'Specials anytime';
}

function broadcastPlaySettings() {
  if (!isHost) return;
  broadcast({
    type: 'settings',
    includeRed2,
    red2Points,
    includeRed1,
    includeOnes,
    onesHigh,
    includeRook,
    rookLowest,
    specialsAnytime,
    mustTrumpWhenVoid,
    turnTimeSec,
    bidOnlyScoring,
    nestGoesTo,
    leadOrder,
    misdealOnNoCounters,
    screwTheDealer,
    comebackSpecialChance,
    openWidow,
    revealTopNest,
    shootMoonEnabled,
    botSpeed,
    handSortMode,
    timeoutPolicy,
    partnerNeverKill,
    partnerFeedLast,
    dontStealPartnerBid,
    landscapeBidHints,
    nestLastTrickAnim,
    layDownWinningCards,
    minBid,
    targetScore,
    handSize,
    nestSizeDefault,
    ruleVariant,
    botDifficulty,
    experimental: window.horExperimental || {},
  });
}

function humanPlayerCount() {
  return (players || []).filter((p) => p && !p.isBot).length;
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
  const run = () => {
    try {
      fn(ctx);
    } catch (e) {}
  };
  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => run())
      .catch(() => {});
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
  if (soundMuted && window.HORShuffle732) window.HORShuffle732.silence();
  if (soundMuted) window.HORTrumpVoice?.stop('mute-control');
  if (soundMuted) window.HORBidVoice801?.stop();
  localStorage.setItem('rookMuted', soundMuted ? '1' : '0');
  updateMuteButtons();
  if (!soundMuted) ensureAudio();
  if (window.CabinAmbience041) window.CabinAmbience041.sync();
}

const CARD_LANDING_SAMPLE_URLS058 = [1, 2, 3, 4, 5].map(
  (i) => `assets/audio/card-play/card-land-${String(i).padStart(2, '0')}.wav`
);
let cardLandingBuffers058 = [];
let cardLandingLoad058 = null;
let lastCardLandingIndex058 = -1;
const CARD_WASH_SAMPLE_URLS059 = {
  '1x': 'assets/audio/card-wash-cc0.wav',
  '3x': 'assets/audio/card-wash-3x-cc0.wav',
  'max': 'assets/audio/card-wash-max-cc0.wav',
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
    .then((response) => {
      if (!response.ok) throw new Error(`Card wash sample load failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((buffer) => (cardWashBuffers059[pace] = buffer))
    .catch((error) => {
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
  if (cardLandingBuffers058.length === CARD_LANDING_SAMPLE_URLS058.length)
    return Promise.resolve(cardLandingBuffers058);
  if (cardLandingLoad058) return cardLandingLoad058;
  cardLandingLoad058 = Promise.all(
    CARD_LANDING_SAMPLE_URLS058.map(async (url) => {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Card landing sample load failed: ${response.status}`);
      return ctx.decodeAudioData(await response.arrayBuffer());
    })
  )
    .then((buffers) => {
      cardLandingBuffers058 = buffers;
      return buffers;
    })
    .catch((error) => {
      cardLandingLoad058 = null;
      console.warn('[Card landing sounds]', error);
      return [];
    });
  return cardLandingLoad058;
}

/** Soft filtered paper movement for the lift and travel; the sampled impact
 * remains a separate event so it lands at the end of the visible flight. */
// 063: recorded effects, decoded once. No immediate repeat within each family.
const naturalCounts063 = {
  'smoothcard736down': 1,
  'smoothcard735': 1,
  'bidup735': 1,
  'biddown735': 1,
  'paper': 4,
  'gather': 3,
  'click': 4,
  'wood': 4,
  'clink': 4,
  'stamp': 1,
  'tick': 1,
  'wings': 1,
  'applause': 1,
};
const naturalBuffers063 = new Map(),
  naturalLoads063 = new Map(),
  naturalLast063 = new Map();
let naturalContext063 = null,
  naturalAwardAt063 = 0;
function loadNatural063(kind, index) {
  const ctx = ensureAudio();
  if (!ctx) return Promise.resolve(null);
  if (naturalContext063 !== ctx) {
    naturalContext063 = ctx;
    naturalBuffers063.clear();
    naturalLoads063.clear();
  }
  const key = kind + '-' + String(index).padStart(2, '0');
  if (naturalBuffers063.has(key)) return Promise.resolve(naturalBuffers063.get(key));
  if (!naturalLoads063.has(key))
    naturalLoads063.set(
      key,
      fetch('assets/audio/natural063/' + key + '.wav')
        .then((r) => {
          if (!r.ok) throw Error(key);
          return r.arrayBuffer();
        })
        .then((b) => ctx.decodeAudioData(b))
        .then((b) => {
          naturalBuffers063.set(key, b);
          return b;
        })
        .catch(() => {
          naturalLoads063.delete(key);
          return null;
        })
    );
  return naturalLoads063.get(key);
}
function preloadNatural063() {
  if (soundMuted) return;
  for (const [kind, count] of Object.entries(naturalCounts063))
    for (let i = 1; i <= count; i++) loadNatural063(kind, i);
}
const naturalBags063 = new Map();
const naturalPreferencesKey = 'horNaturalSoundPreferencesV1';
let naturalPreferences063 = {};
const naturalLevels063 = {};
try {
  const saved = JSON.parse(localStorage.getItem('horNaturalLevelsV1') || '{}');
  for (const key of Object.keys(naturalCounts063))
    if (Number.isFinite(saved[key])) naturalLevels063[key] = Math.max(0, Math.min(100, saved[key]));
} catch (_) {}
function setNaturalLevel063(kind, value) {
  naturalLevels063[kind] = Math.max(0, Math.min(100, Number(value) || 0));
  try {
    localStorage.setItem('horNaturalLevelsV1', JSON.stringify(naturalLevels063));
  } catch (_) {
    horToast('Sound volume could not be saved.');
  }
}
try {
  const saved = JSON.parse(localStorage.getItem(naturalPreferencesKey) || '{}');
  for (const [kind, count] of Object.entries(naturalCounts063)) {
    const value = saved[kind];
    if (value === 'rotate' || (Number.isInteger(value) && value >= 1 && value <= count))
      naturalPreferences063[kind] = value;
  }
} catch (_) {}
function setNaturalPreference063(kind, value) {
  const count = naturalCounts063[kind];
  if (!count || !(value === 'rotate' || (Number.isInteger(value) && value >= 1 && value <= count)))
    return false;
  naturalPreferences063[kind] = value;
  naturalBags063.delete(kind);
  try {
    localStorage.setItem(naturalPreferencesKey, JSON.stringify(naturalPreferences063));
    return true;
  } catch (_) {
    horToast('Sound choice works now, but this browser could not save it.');
    return false;
  }
}
function nextNaturalIndex063(kind, count) {
  let bag = naturalBags063.get(kind);
  const last = naturalLast063.get(kind);
  if (!bag || !bag.length) {
    bag = Array.from({ length: count }, (_, i) => i + 1);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = bag[i];
      bag[i] = bag[j];
      bag[j] = t;
    }
    if (count > 1 && bag[0] === last) {
      bag.push(bag.shift());
    }
    naturalBags063.set(kind, bag);
  }
  const index = bag.shift();
  naturalLast063.set(kind, index);
  return index;
}
function playNatural063(kind, volume = 1, delayMs = 0, category = 'card', previewIndex = null) {
  const allowed = () =>
    !soundMuted &&
    !document.hidden &&
    (category === 'turn'
      ? soundTurn
      : category === 'tick'
        ? soundTick
        : category === 'preview'
          ? true
          : soundCard);
  if (!allowed() || !naturalCounts063[kind]) return null;
  const count = naturalCounts063[kind];
  const choice =
    category === 'preview' || category === 'result' ? previewIndex : naturalPreferences063[kind];
  const index =
    Number.isInteger(choice) && choice >= 1 && choice <= count
      ? choice
      : nextNaturalIndex063(kind, count);
  const requested = Date.now(),
    target = requested + Math.max(0, delayMs);
  loadNatural063(kind, index).then((buffer) => {
    if (!buffer || !allowed() || Date.now() > target + 250) return; // Never emit a stale cue after a slow load/resume.
    whenAudioReady((ctx) => {
      if (!allowed() || Date.now() > target + 250) return;
      const src = ctx.createBufferSource(),
        gain = ctx.createGain();
      src.buffer = buffer;
      gain.gain.value = (Math.max(0, Math.min(1, volume)) * (naturalLevels063[kind] ?? 100)) / 100;
      if (kind === 'paper' || kind === 'gather')
        src.playbackRate.value = 0.97 + Math.random() * 0.06;
      src.connect(gain);
      gain.connect(window.HORAudioMixer.output(ctx, category));
      presentationSounds035.add(src);
      if (category === 'preview' && window.he064Track) window.he064Track(src);
      src.onended = () => {
        presentationSounds035.delete(src);
        src.disconnect();
        gain.disconnect();
      };
      src.start(ctx.currentTime + Math.max(0, target - Date.now()) / 1000);
    });
  });
}
window.horPlayNatural063 = playNatural063;
function playAwardApplause063() {
  if (soundMuted || !soundCard || Date.now() - naturalAwardAt063 < 4500) return false;
  naturalAwardAt063 = Date.now();
  playNatural063('applause', 0.8);
  return true;
}
document.addEventListener('pointerdown', preloadNatural063, { once: true, passive: true });

function playCardMotionSound059(ctx, flightMs) {
  playNatural063('paper', 0.09);
  playNatural063('paper', 0.035, Math.min(90, flightMs * 0.25));
}

/** Play a soft peel/flight plus one of five cleaned impacts at card arrival. */
function playCardSound() {
  if (soundMuted || !soundCard) return;
  const flightMs = solScaledDelay(480, 100);
  try {
    playCardMotionSound059(ensureAudio(), flightMs);
  } catch (e) {}
  const impactLeadMs = 35;
  const delay = Math.max(0, flightMs - impactLeadMs);
  setTimeout(() => {
    if (soundMuted || !soundCard) return;
    const ctx = ensureAudio();
    if (!ctx || cardLandingBuffers058.length !== CARD_LANDING_SAMPLE_URLS058.length) return;
    const options = cardLandingBuffers058
      .map((_, i) => i)
      .filter((i) => i !== lastCardLandingIndex058);
    const index = options[Math.floor(Math.random() * options.length)];
    lastCardLandingIndex058 = index;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = cardLandingBuffers058[index];
    gain.gain.setValueAtTime(0.72, ctx.currentTime);
    source.connect(gain);
    gain.connect(window.HORAudioMixer.output(ctx, 'gameplay'));
    source.start(ctx.currentTime + 0.004);
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch (_) {}
    };
  }, delay);
}

/** Subtle selectable cue when it becomes your turn. */
function playTurnSound(forcePreview = false) {
  if (turnSoundChoice === 20) {
    if (!soundMuted && (soundTurn || forcePreview))
      playNatural063('wood', 0.7, 0, forcePreview ? 'card' : 'turn');
    return;
  }
  if (soundMuted || (!soundTurn && !forcePreview)) return;

  // Mobile browsers can leave Web Audio suspended until a user gesture.
  // Schedule the cue only after the context is actually running; this fixes
  // silent My Turn cues and makes selector previews reliable.
  whenAudioReady((ctx) => {
    const t = ctx.currentTime + 0.01;
    const presets = [
      ['triangle', 230, 120, 0.08, 0.06],
      ['sine', 420, 300, 0.095, 0.045],
      ['sine', 520, 390, 0.1, 0.04],
      ['triangle', 310, 190, 0.09, 0.05],
      ['sine', 660, 500, 0.085, 0.035],
      ['triangle', 180, 105, 0.105, 0.055],
      ['sine', 760, 610, 0.075, 0.03],
      ['triangle', 275, 165, 0.115, 0.045],
      ['sine', 350, 265, 0.12, 0.04],
      ['triangle', 460, 280, 0.085, 0.038],
      ['sine', 590, 455, 0.11, 0.034],
      ['triangle', 205, 145, 0.125, 0.05],
      ['sine', 700, 546, 0.09, 0.028],
      ['triangle', 390, 235, 0.1, 0.04],
      ['sine', 485, 365, 0.115, 0.034],
      ['triangle', 250, 155, 0.095, 0.048],
      ['sine', 615, 470, 0.105, 0.03],
      ['triangle', 335, 205, 0.12, 0.038],
      ['sine', 555, 410, 0.09, 0.033],
    ];
    const p = presets[Math.max(0, Math.min(18, (turnSoundChoice || 1) - 1))];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = p[0];
    osc.frequency.setValueAtTime(p[1], t);
    osc.frequency.exponentialRampToValueAtTime(p[2], t + p[3] * 0.72);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(p[4], t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + p[3]);
    osc.connect(gain);
    gain.connect(window.HORAudioMixer.output(ctx, 'gameplay'));
    osc.start(t);
    osc.stop(t + p[3] + 0.015);
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
      .then((r) => {
        if (!r.ok) throw new Error('raven audio unavailable');
        return r.arrayBuffer();
      })
      .then((b) => ctx.decodeAudioData(b))
      .then((b) => {
        ravenCawBuffer060 = b;
        return b;
      })
      .catch(() => null);
    return ravenCawLoad060;
  } catch (_) {
    return null;
  }
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
    source.connect(gain);
    gain.connect(window.HORAudioMixer.output(ctx, 'gameplay'));
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch (_) {}
    };
    source.start(ctx.currentTime + 0.01);
  };
  const buffer = ravenCawBuffer060;
  if (buffer) {
    play(buffer);
    if (count > 1) setTimeout(() => play(buffer), 720);
  } else {
    preloadRavenCaw060()?.then((loaded) => {
      if (!loaded || soundMuted || !soundRook) return;
      play(loaded);
      if (count > 1) setTimeout(() => play(loaded), 720);
    });
  }
}
document.addEventListener('pointerdown', preloadRavenCaw060, { once: true, passive: true });
function playRookSound() {
  playRavenCalls060(2);
}
function playRed2Sound() {
  playRavenCalls060(1);
}

function playTickSound() {
  playNatural063('tick', 0.5, 0, 'tick');
}

/** Soft UI click (buttons, selects) */
function playDiscardPickSound(step) {
  playNatural063('smoothcard735', 0.35);
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
  playNatural063('smoothcard736down', 0.35);
}

function playClickSound() {
  playNatural063('click', 0.65);
}

/** Fixed soft rising cue; no rotating mechanical button samples. */
function playBidUpSound() {
  playNatural063('bidup735', 0.4);
}

/** Fixed soft falling cue. */
function playBidDownSound() {
  playNatural063('biddown735', 0.4);
}

/** Low lobby seat-selection cue (the original "doooop" feel).
 * Kept separate from playSitSound(), which is the bot/player seating cue. */
function playLobbySeatClickSound() {
  playNatural063('click', 0.4);
}

function playSitSound() {
  /* Quiet until the requested chair recording is supplied. */
}

/** Bid placed — short rising blip (like casino chip / bid) */
function playBidSound() {
  playNatural063('bidup735', 0.4);
}

/** Pass — soft descending tone */
function playPassSound() {
  /* Visual pass feedback is sufficient. */
}

/** Auction won / nest taken */
function playWinBidSound() {
  playNatural063('click', 0.45);
}

/** Discard / nest shuffle — multiple soft card taps */
function playDiscardSound() {
  playNatural063('gather', 0.4);
}

/** Trump named — bright fanfare blip */
function playTrumpSound() {
  /* Contact is sounded by the stamp animation. */
}

/** Trick won — short success chime */
function playTrickWinSound() {
  playNatural063('gather', 0.32);
}

/** Hand made */
function playMadeSound() {
  /* Result display carries this information. */
}

/** Hand set — low warning */
function playSetSound() {
  /* No punishment buzzer. */
}

// A quiet room toast closes a hand; the full match gets one audience finish.
// Score/history reopening and rotation must not replay either cue.
const resultSoundReceipts843 = new Set();
const resultGameIds844 = new WeakMap();
function playResultFinish843(summary, match = false) {
  if (!summary || (!match && (game?.phase !== 'score' || window.HOREndHandEffectsV12))) return;
  const ev = summary.careerEvent;
  if (game && !resultGameIds844.has(game)) resultGameIds844.set(game, crypto.randomUUID());
  const key =
    (match ? 'match:' : 'hand:') +
    (ev?.matchId || summary.matchId || game?.careerMatchId || resultGameIds844.get(game) || '') +
    ':' +
    (match ? '' : (ev?.hand ?? handHistory?.length ?? 0)) +
    ':' +
    (summary.scores || []).join(',');
  if (resultSoundReceipts843.has(key)) return;
  resultSoundReceipts843.add(key);
  if (resultSoundReceipts843.size > 128)
    resultSoundReceipts843.delete(resultSoundReceipts843.values().next().value);
  if (match) {
    naturalAwardAt063 = Date.now(); // Keep award toasts from piling applause onto the finish.
    playNatural063('applause', 0.65, 0, 'result', 1);
  } else if (!getMatchResult(summary.scores, game?.targetScore || targetScore || 500)) {
    playNatural063('clink', 0.32, 0, 'result', 1);
  }
}

/** Longer shuffle — ~1.5s of layered card-riffle noise */

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
    try {
      onDone();
    } catch (e) {}
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
  const localId =
    typeof myIndex === 'number' && myIndex >= 0 && !isSpectator
      ? game?.players?.[myIndex]?.id
      : null;
  const you = !!(winnerId && localId && winnerId === localId);
  return {
    name: you ? 'You' : name || 'Player',
    take: you ? ' take' : ' takes',
    steal: you ? ' steal' : ' steals',
    win: you ? ' win' : ' wins',
  };
}
function showCaptureCelebration(kind, winnerName, amount, winnerId) {
  const ov = $('captureOverlay');
  if (!ov) return;
  const title = $('captureTitle');
  const sub = $('captureSub');
  const emoji = $('captureEmoji');
  const subject = captureSubject793(winnerName, winnerId),
    name = subject.name;
  ov.classList.remove('hidden', 'capture-rook', 'capture-one', 'capture-big');
  if (kind === 'rook-red2') {
    ov.classList.add('capture-rook');
    if (emoji)
      emoji.innerHTML =
        '<img class="rook-cele-bird" src="assets/images/cardback-raven.jpg" alt="Black Rook">';
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
  try {
    playCaptureFanfare(kind === 'rook-red2' ? 'rook-red2' : 'trump1');
  } catch (e) {}
  if (captureOverlayTimer)
    (window.HORRavenFight741?.stopClock || clearTimeout)(captureOverlayTimer);
  captureOverlayTimer = (window.HORRavenFight741?.later || setTimeout)(
    () => {
      ov.classList.add('hidden');
      ov.setAttribute('aria-hidden', 'true');
      captureOverlayTimer = null;
      captureCelebrationRunning = false;
      playNextCaptureCelebration();
    },
    solScaledDelay(2400, horGamePace === 99 ? 180 : 500)
  );
}

function showBigTrickCelebration(name, amount, winnerId) {
  const subject = captureSubject793(name, winnerId);
  let ov = document.getElementById('bigTrickOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bigTrickOverlay';
    ov.className = 'big-trick-approved hidden';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML =
      '<div class="big-trick-plaque"><div class="big-trick-kicker">GRIFFIN HOUSE</div><div class="big-trick-title">BIG TRICK!</div><div class="big-trick-points"></div><div class="big-trick-sub"></div></div>';
    document.body.appendChild(ov);
  }
  const pts = ov.querySelector('.big-trick-points');
  const sub = ov.querySelector('.big-trick-sub');
  if (pts) pts.textContent = String(amount) + ' POINTS';
  if (sub) sub.textContent = subject.name + subject.take + ' the trick';
  ov.classList.remove('hidden');
  ov.setAttribute('aria-hidden', 'false');
  void ov.offsetWidth;
  ov.classList.add('is-showing');
  try {
    playCaptureFanfare('trump1');
  } catch (e) {}
  if (captureOverlayTimer)
    (window.HORRavenFight741?.stopClock || clearTimeout)(captureOverlayTimer);
  captureOverlayTimer = (window.HORRavenFight741?.later || setTimeout)(
    () => {
      ov.classList.remove('is-showing');
      ov.classList.add('hidden');
      ov.setAttribute('aria-hidden', 'true');
      captureOverlayTimer = null;
      captureCelebrationRunning = false;
      playNextCaptureCelebration();
    },
    solScaledDelay(2400, horGamePace === 99 ? 180 : 500)
  );
}

function captureEventPresentation(entry) {
  const kind = entry && entry.kind;
  const subject = captureSubject793(entry?.winnerName, entry?.winnerId),
    name = subject.name;
  if (kind === 'rook-red2')
    return {
      icon: '♜',
      title: 'THE BIRD TAKES RED 2!',
      sub: name + subject.steal + ' the 2nd-highest trump',
    };
  if (kind === 'high-points')
    return {
      icon: '💰',
      title: 'BIG TRICK!',
      sub: name + subject.take + ' ' + (Number(entry.amount) || 0) + ' points!',
    };
  return { icon: '★', title: 'TRUMP 1 CAPTURED!', sub: name + subject.take + ' the high 1' };
}

function showCombinedCaptureCelebration(entries) {
  const ov = $('captureOverlay');
  if (!ov || !entries || entries.length < 2) return false;
  const title = $('captureTitle');
  const sub = $('captureSub');
  const emoji = $('captureEmoji');
  ov.classList.remove('hidden', 'capture-rook', 'capture-one');
  ov.classList.add('capture-rook', 'capture-combined');
  if (emoji) emoji.textContent = '★';
  if (title) title.textContent = entries.length + ' SPECIAL CAPTURES!';
  if (sub) {
    sub.innerHTML = entries
      .map((e) => {
        const p = captureEventPresentation(e);
        return (
          '<div class="capture-combo-row"><span class="capture-combo-icon">' +
          p.icon +
          '</span><span><b>' +
          p.title +
          '</b><small>' +
          p.sub +
          '</small></span></div>'
        );
      })
      .join('');
  }
  ov.setAttribute('aria-hidden', 'false');
  try {
    ov.style.animation = 'none';
    ov.offsetHeight;
    ov.style.animation = '';
  } catch (e) {}
  try {
    playCaptureFanfare(entries.some((e) => e.kind === 'rook-red2') ? 'rook-red2' : 'trump1');
  } catch (e) {}
  if (captureOverlayTimer)
    (window.HORRavenFight741?.stopClock || clearTimeout)(captureOverlayTimer);
  captureOverlayTimer = (window.HORRavenFight741?.later || setTimeout)(
    () => {
      ov.classList.add('hidden');
      ov.classList.remove('capture-combined');
      ov.setAttribute('aria-hidden', 'true');
      captureOverlayTimer = null;
      captureCelebrationRunning = false;
      playNextCaptureCelebration();
    },
    solScaledDelay(Math.min(4400, 2600 + entries.length * 450), horGamePace === 99 ? 220 : 650)
  );
  return true;
}

function queueCaptureCelebrations(items, winnerName) {
  if (!Array.isArray(items)) items = items ? [items] : [];
  items = items.filter(
    (item) =>
      (typeof item === 'string' ? item : item?.kind) !== 'rook-red2' ||
      !window.HORRavenFight741?.replacesBirdMessage()
  );
  if (!items.length) return;
  if (window.HORRavenFight741?.deferCelebration(() => queueCaptureCelebrations(items, winnerName)))
    return;
  const normalized = items
    .map((item) => {
      const entry = typeof item === 'string' ? { kind: item } : item || {};
      if (!entry.kind) return null;
      return {
        kind: entry.kind,
        winnerName: entry.winnerName || winnerName || 'Player',
        winnerId: entry.winnerId || null,
        amount: Number(entry.amount) || 0,
      };
    })
    .filter(Boolean);
  // One trick = one interruption. If the same resolved trick earns multiple
  // specials, celebrate them together instead of serial full-screen popups.
  if (normalized.length > 1 && !captureCelebrationRunning && !captureCelebrationQueue.length) {
    captureCelebrationRunning = true;
    const combined = () => showCombinedCaptureCelebration(normalized);
    if (normalized.some((entry) => entry.kind === 'rook-red2')) showRookRed2Duel(combined);
    else combined();
    return;
  }
  normalized.forEach((entry) => captureCelebrationQueue.push(entry));
  playNextCaptureCelebration();
}

function playNextCaptureCelebration() {
  if (captureCelebrationRunning || !captureCelebrationQueue.length) return;
  const next = captureCelebrationQueue.shift();
  captureCelebrationRunning = true;
  if (next.kind === 'rook-red2')
    showRookRed2Duel(() =>
      showCaptureCelebration(next.kind, next.winnerName, next.amount, next.winnerId)
    );
  else showCaptureCelebration(next.kind, next.winnerName, next.amount, next.winnerId);
}

/** Inspect a finished trick for all special captures, in card order. */
function detectSpecialCaptures(trick, winnerPlay) {
  if (!trick || !trick.length || !winnerPlay) return [];
  const cards = trick.map((t) => t.card).filter(Boolean);

  const hasRed2 = cards.some((c) => isRed2(c));
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
    cards.forEach((c) => {
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
  playNatural063('gather', 0.4);
}
function playNestFlipSound() {
  if (isPortraitViewport()) {
    playRecordedCard035('reveal');
    playBirdNestReaction041();
  } else playNestRevealSequence();
}
function playNestLandSound() {
  /* land is part of playNestRevealSequence */
}

/** Legacy short deal sound → full shuffle */
function playDealSound() {
  playShuffleSound();
}

/** Shuffle overlay + deal cards into hand one-by-one */
let dealAnimToken = 0;
function shuffleAnimDuration762() {
  return 5033;
} // Only the asset opening omits its stationary corner hold.
const CARD_DEAL_MS = 115;

function ensureShuffleOverlay() {
  let ov = $('shuffleOverlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'shuffleOverlay';
  ov.className = 'shuffle-overlay hidden';
  ov.setAttribute('aria-hidden', 'true');
  // The approved asset adapter supplies the sole visual surface.
  document.body.appendChild(ov);
  return ov;
}

function showShuffleOverlay() {
  const ov = ensureShuffleOverlay();
  if (ov.parentNode !== document.body) document.body.appendChild(ov);
  ov.style.zIndex = '180000';
  ov.classList.remove('hidden');
  ov.setAttribute('aria-hidden', 'false');
  ov.style.setProperty(
    '--rook033-wash-duration',
    solScaledDelay(shuffleAnimDuration762(), 80) + 'ms'
  );
  ov.classList.add('shuffling');
  positionShuffleWash033();
  if (window.HORShuffle732)
    window.HORShuffle732.start(ov, solScaledDelay(shuffleAnimDuration762(), 80));
}

function hideShuffleOverlay() {
  if (window.HORShuffle732) window.HORShuffle732.stop();
  const ov = $('shuffleOverlay');
  if (!ov) return;
  ov.classList.remove('shuffling');
  ov.classList.add('hidden');
  ov.setAttribute('aria-hidden', 'true');
}

/** Dispatch named SFX (local + optional network) */
function playSfx(name, { broadcastNet = false } = {}) {
  if (!name) return;
  switch (name) {
    case 'rook':
      playRookSound();
      break;
    case 'red2':
      playRed2Sound();
      break;
    case 'card':
      playCardSound();
      break;
    case 'turn':
      playTurnSound();
      break;
    case 'tick':
      playTickSound();
      break;
    case 'click':
      playClickSound();
      break;
    case 'bidUp':
      playBidUpSound();
      break;
    case 'bidDown':
      playBidDownSound();
      break;
    case 'sit':
      playSitSound();
      break;
    case 'bid':
      playBidSound();
      break;
    case 'pass':
      playPassSound();
      break;
    case 'winBid':
      playWinBidSound();
      break;
    case 'discard':
      playDiscardSound();
      break;
    case 'trump':
      playTrumpSound();
      break;
    case 'trick':
      playTrickWinSound();
      break;
    case 'made':
      playMadeSound();
      break;
    case 'set':
      playSetSound();
      break;
    case 'deal':
      playDealSound();
      break;
    case 'shuffle':
      playShuffleSound();
      break;
    case 'dealCard':
      playDealCardSound();
      break;
    case 'nestFlip':
      playNestFlipSound();
      break;
    case 'nestLand':
      playNestLandSound();
      break;
    default:
      break;
  }
  if (broadcastNet && isHost) {
    try {
      broadcast({ type: 'sfx', name });
    } catch (e) {}
  }
}

function birdFightCaptureConfirmed064(card) {
  if (!card || !game || !Array.isArray(game.trick)) return false;
  const isRook = card.color === 'rook' || card.id === 'rook';
  const isR2 = typeof isRed2 === 'function' ? isRed2(card) : card.id === 'red-2';
  if (!isRook && !isR2) return false;
  const plays = game.trick.map((p) => ({ card: (p && p.card) || p })).filter((p) => p.card);
  if (!plays.some((p) => p.card === card || p.card.id === card.id)) plays.push({ card });
  const cards = plays.map((p) => p.card);
  const hasRook = cards.some((c) => c.color === 'rook' || c.id === 'rook');
  const hasRed2 = cards.some((c) => (typeof isRed2 === 'function' ? isRed2(c) : c.id === 'red-2'));
  if (!hasRook || !hasRed2) return false;
  const earlier = cards.filter((c) => c !== card);
  const second = isRook
    ? earlier.some((c) => (typeof isRed2 === 'function' ? isRed2(c) : c.id === 'red-2'))
    : earlier.some((c) => c.color === 'rook' || c.id === 'rook');
  if (!second) return false;
  const rookPlay = plays.find((p) => p.card && (p.card.color === 'rook' || p.card.id === 'rook'));
  if (!rookPlay) return false;
  try {
    return detectSpecialCaptures(plays, rookPlay).includes('rook-red2');
  } catch (e) {
    return false;
  }
}
function notifyCardPlayed(card) {
  const isRook = card && (card.color === 'rook' || card.id === 'rook');
  const isR2 = card && (typeof isRed2 === 'function' ? isRed2(card) : card.id === 'red-2');
  const name = isRook ? 'rook' : isR2 ? 'red2' : 'card';
  window._lastPlayedCardSfxAt = Date.now();
  if (isRook || isR2) playSfx('card', { broadcastNet: true });
  const suppressBird = birdFightCaptureConfirmed064(card);
  if (suppressBird) {
    window._birdFightArmed064 = true;
  } else playSfx(name, { broadcastNet: true });
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
    if (tricks && ((tricks[0] && tricks[0].length) || (tricks[1] && tricks[1].length)))
      return false;
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
function pulseTurnFlash() {
  try {
    window.HORHolderCues789?.notifyTurn();
  } catch (_) {}
}

function turnOpportunityKey() {
  if (!game || isSpectator) return '';
  if (game.paused || game.claimAnimating || game.resolvingTrick) return '';
  if (game.phase === 'play' && game.currentPlayer === myIndex)
    return 'play:' + myIndex + ':' + ((game.trick && game.trick.length) || 0);
  if (game.phase === 'bidding' && game.currentPlayer === myIndex)
    return 'bid:' + myIndex + ':' + (game.highestBid || 0);
  if (game.phase === 'trump' && game.bidder === myIndex) return 'trump:' + myIndex;
  if (game.phase === 'discard' && game.bidder === myIndex) return 'discard:' + myIndex;
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
  try {
    notifyYourTurn();
  } catch (e) {}
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
        game &&
        game.phase === 'bidding' &&
        revealTopNest &&
        isFirstHandOfMatch()
      );
      if (game && game.phase === 'bidding') game._firstBidTurnSounded = true;
      if (!suppressForOpeningNestReveal) playTurnSound();
    } catch (e) {}

    // Preserve the existing sound delay; the holder cue owns synchronized visual/haptic timing.
    try {
      pulseTurnFlash();
    } catch (e) {}
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
  const r2 = includeRed2 ? parseInt(red2Points, 10) || 20 : 0;
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

function moonBidAllowed(seat) {
  // A negative score does not restrict Moon bids. getMatchResult owns the losing threshold.
  return !!shootMoonEnabled;
}

function bidCeilingFor(seat) {
  const cap = maxBid();
  if (shootMoonEnabled && !moonBidAllowed(seat)) return Math.max(minBid || 70, cap - 5);
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
  const raw = game && game.highestBid != null ? game.highestBid : game && game.bid;
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
    try {
      sessionStorage.removeItem('rookSession');
    } catch (e) {}
    return;
  }
  if (window._horIntentionalLeave) return;
  try {
    sessionStorage.setItem(
      'rookSession',
      JSON.stringify({
        roomCode,
        myName,
        isHost,
        isSpectator,
        myPeerId,
      })
    );
  } catch (e) {}
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem('rookSession');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// UI elements
const $ = (id) => document.getElementById(id);

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
  try {
    return sessionStorage.getItem('rookActiveTable') === '1';
  } catch (e) {
    return false;
  }
}
function horClientIsPlaying() {
  if (document.body && document.body.classList.contains('in-game')) return true;
  return !!(game && game.phase && !['lobby', 'waiting', ''].includes(game.phase));
}

function hideWelcomeScreen() {
  if (welcome) {
    welcome.classList.add('hidden');
    welcome.classList.remove('seated', 'watching');
  }
  try {
    document.body.classList.remove('at-welcome');
  } catch (e) {}
}

function phoneLooksOffline() {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  } catch (e) {
    return false;
  }
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
  try {
    setJoinStatus(msg);
  } catch (e) {}
  const el = $('noServiceModal');
  const text = $('noServiceText');
  if (text) text.textContent = detail || msg;
  if (el) {
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  } else if (confirm(msg + '\n\nPlay offline against three bots?')) {
    try {
      startSoloPractice();
    } catch (e2) {}
  }
}
function bindNoServiceModal() {
  const go = $('noServiceOfflineBtn');
  const stay = $('noServiceStayBtn');
  if (go && !go.dataset.bound) {
    go.dataset.bound = '1';
    go.onclick = () => {
      hideNoServiceModal();
      try {
        startSoloPractice();
      } catch (e) {}
    };
  }
  if (stay && !stay.dataset.bound) {
    stay.dataset.bound = '1';
    stay.onclick = () => hideNoServiceModal();
  }
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
  if (horSplashTimer) {
    clearTimeout(horSplashTimer);
    horSplashTimer = null;
  }
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
      try {
        playClickSound();
      } catch (e) {}
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
  try {
    hideCelePage();
  } catch (e) {}
  if (lobby) lobby.classList.add('hidden');
  if (waiting) waiting.classList.add('hidden');
  if (gameScreen) gameScreen.classList.add('hidden');
  if (welcome) welcome.classList.remove('hidden');
  try {
    document.body.classList.remove('in-game');
    document.body.classList.add('at-table', 'at-welcome');
    setTimeout(syncLandscapeFullscreen, 50);
  } catch (e) {}
  const c = String(code || roomCode || '')
    .trim()
    .toUpperCase();
  const codeEl = $('welcomeCode');
  if (codeEl) codeEl.textContent = c;
  const lead = $('welcomeLead');
  if (lead)
    lead.textContent = c
      ? 'A friend invited you to table ' + c + '.'
      : 'A friend shared this table with you.';
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
    try {
      nameIn.focus();
    } catch (e) {}
  }
  const st = $('welcomeStatus');
  if (st && !st.textContent) st.textContent = 'Enter your name, then tap a chair.';
  try {
    updateWelcomeSeats();
  } catch (e) {}
  try {
    requestTablePreview();
  } catch (e) {}
}

function requestTablePreview() {
  if (isHost) {
    try {
      updateWelcomeSeats();
    } catch (e) {}
    return;
  }
  const code = String(roomCode || ($('hor-room-code') && $('hor-room-code').value) || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!code) return;
  roomCode = code;
  const codeInput = $('hor-room-code');
  if (codeInput && !codeInput.value) codeInput.value = code;
  joinedFromWelcome = true;
  if (hostConnection && hostConnection.open) {
    try {
      hostConnection.send({ type: 'peekTable', id: myPeerId });
    } catch (e) {}
    setJoinStatus('Table connected. Seats below are live — type your name, then tap a chair.');
    try {
      updateWelcomeSeats();
    } catch (e) {}
    return;
  }
  if (joinInProgress || peer) return;
  pendingPreviewJoin = true;
  isSpectator = true;
  setJoinStatus('Connecting to see who is already seated…');
  try {
    joinRoom();
  } catch (e) {
    setJoinStatus('Could not load seats yet. You can still type your name and tap a chair.');
  }
}

function updateWelcomeSeats() {
  if (!welcomeVisible()) return;
  const teamA = typeof teamLabel === 'function' ? teamLabel(0) : 'Griffin';
  const teamB = typeof teamLabel === 'function' ? teamLabel(1) : 'Raven';
  const labels = ['Bottom', 'Left', 'Top', 'Right'];
  let mySeat = -1;
  for (let s = 0; s < 4; s++) {
    const el = $('welcomeSeat' + s);
    if (!el) continue;
    const p = playerAtSeat(s);
    if (p && !p.isBot)
      try {
        refreshHumanPersona(p);
      } catch (e) {}
    el.classList.toggle('occupied', !!p);
    el.classList.toggle('is-me', !!(p && p.id === myPeerId));
    el.classList.toggle('is-bot', !!(p && p.isBot));
    if (p && p.isBot && p.name) el.setAttribute('data-botname', p.name);
    else el.removeAttribute('data-botname');
    if (p && p.id === myPeerId) mySeat = s;
    if (p) {
      const tag = p.isHost ? 'Host' : p.isBot ? 'Bot' : p.id === myPeerId ? 'You' : 'Sat';
      const face = p.avatar
        ? '<img class="wait-seat-av" src="' + avatarSrc(p.avatar) + '" alt="">'
        : '';
      let extra = tag + ' · ' + (s % 2 === 0 ? teamA : teamB);
      if (p.isBot && !isSpectator && !(p.id === myPeerId))
        extra = 'Bot · tap to replace (bot moves)';
      el.innerHTML =
        face +
        '<span class="wait-seat-name"><span class="wait-seat-name-text">' +
        escapeHtmlSafe(p.name) +
        '</span>' +
        horCareerBadgeHtml(p) +
        '</span>' +
        '<span class="wait-seat-tag">' +
        extra +
        '</span>';
      try {
        horBindCareerBadges(el);
      } catch (e) {}
    } else if (isSpectator) {
      el.innerHTML =
        '<span class="wait-seat-name">Open</span><span class="wait-seat-tag">Empty seat</span>';
    } else if (myPeerId && players.some((pl) => pl && pl.id === myPeerId && pl.seat >= 0)) {
      el.innerHTML =
        '<span class="wait-seat-name">Open</span><span class="wait-seat-tag">Tap to move here</span>';
    } else {
      el.innerHTML =
        '<span class="wait-seat-name">' +
        labels[s] +
        '</span><span class="wait-seat-tag">Tap to sit here</span>';
    }
  }
  const how = $('welcomeHow');
  const feltSt = $('welcomeFeltStatus');
  if (isSpectator) {
    if (welcome) {
      welcome.classList.add('watching');
      welcome.classList.remove('seated');
    }
    if (how)
      how.textContent =
        'You are watching this table. You are now waiting on the host to start the game.';
    if (feltSt) feltSt.textContent = 'Watching — seats fill as friends sit';
  } else if (mySeat >= 0) {
    if (welcome) {
      welcome.classList.add('seated');
      welcome.classList.remove('watching');
    }
    if (how)
      how.textContent =
        'You are in the ' +
        labels[mySeat].toLowerCase() +
        ' chair. You can tap a different empty seat to move. You are now waiting on the host to start the game.';
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
      try {
        el.blur();
      } catch (e) {}
    });
    const ae = document.activeElement;
    if (ae && ae.blur && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      try {
        ae.blur();
      } catch (e) {}
    }
    if (document.body) {
      document.body.setAttribute('tabindex', '-1');
      try {
        document.body.focus();
      } catch (e) {}
    }
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
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
      try {
        updateWelcomeSeats();
      } catch (e) {}
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
    if (nameEl) {
      try {
        nameEl.focus();
      } catch (e) {}
    }
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
    try {
      playClickSound();
    } catch (e) {}
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
    try {
      hostConnection.send({
        type: 'claimSeat',
        seat: pendingWelcomeSeat,
        id: myPeerId,
        name: name,
      });
    } catch (e) {}
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
  } catch (e) {
    return false;
  }
}

/** QR/share-link only works on a public https site. Local Wi‑Fi / file / LAN IPs encode a URL the other phone cannot open. */
function isPrivateOrLocalHost(host) {
  const h = String(host || '')
    .toLowerCase()
    .replace(/^\[[^\]]+\]$/, (m) => m.slice(1, -1));
  if (!h || h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(h)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(h)) return true;
  return false;
}

function canShareJoinQr() {
  try {
    if (isSoloPractice || roomCode === 'OFFLINE') return false;
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
  const offline = isSoloPractice || roomCode === 'OFFLINE';
  for (const button of [qrBtn, copyBtn, shareBtn]) {
    if (!button) continue;
    button.disabled = offline;
    button.toggleAttribute('data-offline-invitation', offline);
  }
  document.body.classList.toggle('wifi-join-only', !qrOk);
  if (qrBtn) {
    qrBtn.classList.toggle('hidden', !qrOk);
    qrBtn.setAttribute('aria-hidden', qrOk ? 'false' : 'true');
  }
  if (qrBox && !qrOk) {
    qrBox.classList.add('hidden');
    try {
      document.body.classList.remove('qr-open');
    } catch (e) {}
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
    const raw = String(location.href || '')
      .split('?')[0]
      .split('#')[0];
    return /^https?:/i.test(raw) ? raw : '';
  }
}

function joinLink(code) {
  const c = String(code || roomCode || '')
    .trim()
    .toUpperCase();
  const base = gamePageUrl();
  if (!c) return base;
  const sep = base.indexOf('?') >= 0 ? '&' : '?';
  return base + sep + 'room=' + encodeURIComponent(c);
}

/** PeerJS cloud id — namespaced so short table codes don't collide with other apps. */
function peerRoomId(code) {
  const c = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return c ? 'hor' + c : '';
}

// ========== Peer / Networking ==========
// Forcibly clears any cached copy of the app and reloads fresh. Used when
// a version mismatch is detected against a connected peer (host or joiner
// running older cached code), so that side self-corrects instead of the
// person needing to know to manually clear their browser data.
// Internal networking calls retain a no-op logging shim; no debug UI exists.
function horDebugLog() {}

function horForceUpdate() {
  window.__horUpdating = true;
  // Preserve the exact viewport position so tapping Force Refresh does not
  // make the page appear to jump before/after the cache refresh.
  try {
    sessionStorage.setItem(
      'horForceRefreshView',
      JSON.stringify({
        x: window.scrollX || 0,
        y: window.scrollY || 0,
        room: new URL(location.href).searchParams.get('room') || '',
      })
    );
  } catch (e) {}
  let dest = 'index.html?fresh=' + Date.now() + '&v=' + APP_VERSION;
  try {
    const url = new URL(horThisIndex());
    url.searchParams.set('fresh', String(Date.now()));
    url.searchParams.set('v', APP_VERSION);
    dest = url.toString();
  } catch (e) {}
  const reloadFresh = () => {
    try {
      window.location.replace(dest);
    } catch (e) {
      window.location.href = dest;
    }
  };
  const tasks = [];
  if ('caches' in window) {
    tasks.push(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    );
  }
  const timer = setTimeout(reloadFresh, 1200);
  Promise.all(tasks)
    .catch(() => {})
    .then(() => {
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
    try {
      window.scrollTo(saved.x || 0, saved.y || 0);
    } catch (e) {}
  };
  if (document.readyState === 'loading') {
    window.addEventListener(
      'DOMContentLoaded',
      () => requestAnimationFrame(() => requestAnimationFrame(restore)),
      { once: true }
    );
  } else {
    requestAnimationFrame(() => requestAnimationFrame(restore));
  }
})();

const PEER_BROKERS = [
  // Rook520: restore the exact signaling endpoint used by the known-good
  // Rook386 multiplayer path.  The default PeerJS constructor path introduced
  // later could open a guest peer while the named host id was not discoverable.
  { host: '0.peerjs.com', port: 443, path: '/', secure: true, label: 'PeerJS Cloud' },
];
let horPeerBrokerIndex = 0;
let horHostCreateInProgress = false;
let horHostCreateWatchdog = null;
// A single lobby operation owns pending callbacks; leaving cancels that ownership.
let horLobbyOperation043 = 0;
let horLobbyCancel043 = null;
function horCancelLobbyOperation043() {
  ++horLobbyOperation043;
  try {
    if (horLobbyCancel043) horLobbyCancel043();
  } catch (_) {}
  horLobbyCancel043 = null;
  horClearHostCreateWatchdog();
  horSetHostCreateBusy(false);
  joinInProgress = false;
}

function horSetHostCreateBusy(busy, message) {
  horHostCreateInProgress = !!busy;
  const status = $('lobbyStatus');
  if (status && message != null) status.textContent = message;
  ['friendsToggleBtn', 'createBtn'].forEach((id) => {
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
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
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
    config: horIceConfig(forceRelay),
  };
}

let horPeerLoadPromise = null;
function horEnsurePeerJS() {
  if (typeof Peer !== 'undefined') return Promise.resolve(true);
  if (horPeerLoadPromise) return horPeerLoadPromise;
  const sources = [
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js',
  ];
  horPeerLoadPromise = new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (typeof Peer !== 'undefined') {
        resolve(true);
        return;
      }
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
        settled = true;
        clearTimeout(timeout);
        if (typeof Peer !== 'undefined') resolve(true);
        else {
          try {
            s.remove();
          } catch (_) {}
          next();
        }
      };
      const timeout = setTimeout(complete, 6000);
      s.onload = complete;
      s.onerror = complete;
      document.head.appendChild(s);
    };
    next();
  });
  return horPeerLoadPromise;
}

function createRoom(retryCount = 0) {
  if (horHostCreateInProgress || joinInProgress) return;
  if (isHost && peer && peer.open && !peer.destroyed && !window._horHandoffSnapshot) {
    showWaiting();
    return;
  }
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
  const active = () =>
    token === horLobbyOperation043 && !window._horIntentionalLeave && !isSoloPractice;
  horSetHostCreateBusy(true, 'Creating table…');
  myName = ($('hor-player-name').value || '').trim() || 'Host';
  if (typeof Peer === 'undefined') {
    $('lobbyStatus').textContent = 'Loading multiplayer…';
    horEnsurePeerJS()
      .then(() => {
        if (!active()) return;
        horSetHostCreateBusy(false);
        createRoom(retryCount);
      })
      .catch((e) => {
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
      try {
        peer.destroy();
      } catch (e) {}
      peer = null;
    }
    const opts = peerOptions();
    horDebugLog('HOST: creating peer on broker ' + opts.host + ' code=' + roomCode);
    peer = hostPeer = new Peer(peerRoomId(roomCode), opts);
  } catch (e) {
    console.error(e);
    horSetHostCreateBusy(false, 'Could not create table: ' + e.message);
    isHost = false;
    return;
  }

  const current = () => active() && peer === hostPeer;
  const cleanup = () => {
    try {
      hostPeer.destroy();
    } catch (_) {}
    if (peer === hostPeer) peer = null;
  };
  horLobbyCancel043 = cleanup;
  horClearHostCreateWatchdog();
  horHostCreateWatchdog = setTimeout(() => {
    if (!current() || hostPeer.open) return;
    cleanup();
    isHost = false;
    horLobbyCancel043 = null;
    horSetHostCreateBusy(
      false,
      'Multiplayer did not respond. Check your connection and try again.'
    );
  }, 12000);
  let opened = false;
  hostPeer.on('open', (id) => {
    if (!current() || opened) return;
    opened = true;
    horClearHostCreateWatchdog();
    horSetHostCreateBusy(false);
    horLobbyCancel043 = null;
    horDebugLog('HOST: peer open, id=' + id + ', room code=' + roomCode);
    myPeerId = id;
    if (window._horHandoffSnapshot) {
      try {
        finishHostHandoff(id);
      } catch (e) {
        console.error(e);
      }
      return;
    }
    players = [
      {
        id,
        name: myName,
        team: 0,
        isHost: true,
        isBot: false,
        seat: 0,
        avatar: ensurePreferredAvatar() || AVATARS[0],
        voice: loadPreferredVoice(),
        careerPublic: horMyCareerProfile(),
      },
    ];
    applyPreferredAvatarToMe();
    myIndex = 0;
    beerSeats = pickBeerSeats();
    showWaiting();
    saveSession();
    try {
      window.dispatchEvent(new CustomEvent('hor-table-ready', { detail: { code: roomCode } }));
    } catch (_) {}
    if ($('lobbyStatus')) $('lobbyStatus').textContent = '';
    if ($('waitingStatus')) {
      $('waitingStatus').textContent = canShareJoinQr()
        ? 'Table is live. Friends open this website and join with the code.'
        : 'Table is live. Friends join with this code on their own phone.';
    }
    // Give the public broker a moment to actually register the id
    // before guests start connecting — a common PeerJS race.
    try {
      peer.socket && peer.socket.send && peer.socket.send({ type: 'HEARTBEAT' });
    } catch (e) {}
  });

  hostPeer.on('connection', (conn) => {
    if (!current()) {
      try {
        conn.close();
      } catch (_) {}
      return;
    }
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
    try {
      hostPeer.reconnect();
    } catch (e) {}
  });

  hostPeer.on('error', (err) => {
    if (!current()) return;
    const type = err && err.type;
    horClearHostCreateWatchdog();
    // Once this peer opened, the local table already owns its game. Mobile
    // background suspension can set peer.open=false while signaling recovers.
    // Creation retries must never recreate that table or demote its host.
    if (opened) {
      horDebugLog('HOST: established table keeps local authority after signaling error: ' + type);
      horSetHostCreateBusy(false);
      try {
        if (hostPeer.disconnected && !hostPeer.destroyed) hostPeer.reconnect();
      } catch (_) {}
      return;
    }
    if (
      !hostPeer.open &&
      retryCount < 2 &&
      ['unavailable-id', 'network', 'server-error', 'socket-error', 'socket-closed'].includes(type)
    ) {
      cleanup();
      horSetHostCreateBusy(true, 'Retrying table connection…');
      horHostCreateWatchdog = setTimeout(() => {
        if (!active()) return;
        horSetHostCreateBusy(false);
        createRoom(retryCount + 1);
      }, 350);
    } else {
      if (!hostPeer.open) {
        cleanup();
        isHost = false;
        horLobbyCancel043 = null;
      }
      horSetHostCreateBusy(
        false,
        'Multiplayer error: ' +
          ((err && (err.type || err.message)) || 'unknown') +
          '. Please try again.'
      );
    }
  });
}

function joinRoom() {
  // One tap owns this handshake; another tap must not tear it down.
  if (joinInProgress) return;
  if (horHostCreateInProgress) {
    setJoinStatus('Creating your table…');
    return;
  }
  const code = ($('hor-room-code').value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) {
    setJoinStatus('Enter a room code.');
    $('joinFeedback841').hidden = false;
    $('joinFeedback841').textContent = 'Enter a room code.';
    $('hor-room-code').setAttribute('aria-invalid', 'true');
    $('hor-room-code').focus();
    return;
  }
  $('hor-room-code').removeAttribute('aria-invalid');
  $('joinFeedback841').hidden = true;
  if (phoneLooksOffline()) {
    setJoinStatus(noServiceJoinMessage());
    return;
  }
  if (!isHost && hostConnection && hostConnection.open && roomCode === code) {
    setJoinStatus('Already connected to table ' + code + '.');
    return;
  }
  window._horIntentionalLeave = false;
  window._horNoServiceStop = false;
  isSoloPractice = false;
  myName = ($('hor-player-name').value || '').trim() || 'Player';
  // An explicit lobby join starts a new handshake. A saved flag from an
  // earlier table must not hide the seating UI; live reconnects keep it.
  if (!horClientIsPlaying()) {
    horMarkActiveTable(false);
    window._horStayInGame = false;
  }
  roomCode = code;
  isHost = false;
  joinInProgress = true;
  const token = ++horLobbyOperation043;
  const active = () =>
    token === horLobbyOperation043 && !window._horIntentionalLeave && !isSoloPractice;
  setJoinStatus('Connecting to table ' + code + '…');
  if (typeof Peer === 'undefined') {
    horEnsurePeerJS()
      .then(() => {
        if (!active()) return;
        joinInProgress = false;
        joinRoom();
      })
      .catch((e) => {
        if (!active()) return;
        joinInProgress = false;
        setJoinStatus('Could not load multiplayer. Please try again. ' + e.message);
      });
    return;
  }
  let joinPeer;
  try {
    if (peer) {
      try {
        peer.destroy();
      } catch (_) {}
    }
    peer = joinPeer = new Peer(undefined, peerOptions());
  } catch (e) {
    joinInProgress = false;
    setJoinStatus('Could not start multiplayer: ' + e.message);
    return;
  }
  let finished = false,
    joined = false,
    joinTimer = null,
    retryTimer = null;
  let joinTries = 0;
  const maxJoinTries = 3;
  const current = () => active() && peer === joinPeer;
  const clearTimers = () => {
    clearTimeout(joinTimer);
    clearTimeout(retryTimer);
  };
  const finishFailure = (message) => {
    if (finished || !current()) return;
    finished = true;
    clearTimers();
    // Close while initial join still owns the transport, so it cannot trigger
    // the established-table reconnect loop on this failed attempt.
    try {
      if (horJoinConn) horJoinConn.close();
    } catch (_) {}
    horJoinConn = null;
    hostConnection = null;
    try {
      joinPeer.destroy();
    } catch (_) {}
    if (peer === joinPeer) peer = null;
    joinInProgress = false;
    horLobbyCancel043 = null;
    setJoinStatus(message);
  };
  horLobbyCancel043 = () => {
    finished = true;
    clearTimers();
    try {
      if (horJoinConn) horJoinConn.close();
    } catch (_) {}
    horJoinConn = null;
    hostConnection = null;
    try {
      joinPeer.destroy();
    } catch (_) {}
    if (peer === joinPeer) peer = null;
  };
  const queueRetry = () => {
    if (finished || !current() || retryTimer) return;
    clearTimeout(joinTimer);
    if (joinTries >= maxJoinTries) {
      finishFailure(
        'Could not link to table ' +
          code +
          '. Check the code, keep the host screen open, and try again. If the network blocks direct connections, try a different Wi-Fi or cell-data connection.'
      );
      return;
    }
    const previous = horJoinConn;
    horJoinConn = null;
    if (hostConnection === previous) hostConnection = null;
    try {
      if (previous) previous.close();
    } catch (_) {}
    setJoinStatus(
      'Still connecting to table ' +
        code +
        '… retrying (' +
        (joinTries + 1) +
        '/' +
        maxJoinTries +
        ').'
    );
    retryTimer = setTimeout(() => {
      retryTimer = null;
      tryConnect();
    }, 350);
  };
  const tryConnect = () => {
    if (finished || !current()) return;
    clearTimeout(joinTimer);
    joinTries++;
    setJoinStatus('Linking to table ' + code + '… (' + joinTries + '/' + maxJoinTries + ')');
    let conn;
    try {
      conn = joinPeer.connect(peerRoomId(code), {
        reliable: true,
        serialization: 'json',
        label: 'hor-table',
        metadata: { app: 'hor', v: APP_VERSION },
      });
      horJoinConn = conn;
      hostConnection = conn;
      conn.__horJoinAccepted844 = () => {
        if (!currentConnection()) return;
        joined = finished = true;
        clearTimers();
        joinInProgress = false;
        horLobbyCancel043 = null;
      };
      conn.__horJoinRejected844 = (message) => {
        if (currentConnection()) finishFailure(message);
      };
      setupConn(conn);
    } catch (e) {
      queueRetry();
      return;
    }
    const currentConnection = () => !finished && current() && horJoinConn === conn;
    conn.on('open', () => {
      if (!currentConnection()) return;
      const joinMsg = {
        type: 'join',
        name: myName,
        id: myPeerId,
        spectator: !!isSpectator,
        avatar: ensurePreferredAvatar() || AVATARS[0],
        voice: loadPreferredVoice(),
        appVersion: APP_VERSION,
        reconnect: true,
      };
      if (pendingPreviewJoin) joinMsg.preview = true;
      if (
        !isSpectator &&
        typeof pendingWelcomeSeat === 'number' &&
        pendingWelcomeSeat >= 0 &&
        pendingWelcomeSeat <= 3
      )
        joinMsg.preferredSeat = pendingWelcomeSeat;
      // Use the normal envelope, including this room's saved resume credential.
      if (!horNetSend(conn, joinMsg)) {
        finishFailure(
          'Connection opened but the join message could not be sent. Please try again.'
        );
        return;
      }
      // A data channel is not host admission. Keep ownership and a bounded
      // wait until handleMessage successfully applies the matching welcome.
      if (!currentConnection()) return;
      setJoinStatus('Connected. Confirming your place at the table…');
      clearTimeout(joinTimer);
      joinTimer = setTimeout(() => {
        if (currentConnection())
          finishFailure(
            'The host did not confirm your join. Keep the host screen open and try again.'
          );
      }, 10000);
    });
    conn.on('error', () => {
      if (currentConnection()) queueRetry();
    });
    conn.on('close', () => {
      if (currentConnection()) queueRetry();
    });
    joinTimer = setTimeout(() => {
      if (currentConnection()) queueRetry();
    }, 8000);
  };
  // Signaling can fail to emit either open or error. Bound that silent wait too.
  joinTimer = setTimeout(
    () => finishFailure('Multiplayer did not respond. Check your connection and try again.'),
    12000
  );
  joinPeer.on('open', (id) => {
    if (!current() || finished) return;
    clearTimeout(joinTimer);
    myPeerId = id;
    // The host is already registered; no mandatory 700 ms delay before linking.
    tryConnect();
  });
  joinPeer.on('disconnected', () => {
    if (!current() || (finished && !joined)) return;
    try {
      joinPeer.reconnect();
    } catch (_) {}
  });
  joinPeer.on('error', (err) => {
    if (!current() || finished) return;
    if (err && err.type === 'peer-unavailable') queueRetry();
    else
      finishFailure(
        'Multiplayer error: ' +
          ((err && (err.type || err.message)) || 'unknown') +
          '. Please try again.'
      );
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
  if (!isHost && msg.type === 'join') msg.reconnectToken844 = horResumeToken844();
  if (!isHost && horTurnActions844.has(msg.type) && !msg.actionContext844)
    msg.actionContext844 = game?.actionContext844;
  if (isHost && msg.type === 'welcome' && !msg.spectator && !msg.preview) {
    const p = players.find((p) => p && !p.isBot && p.id === msg.yourId && p.id === conn?.peer);
    if (p) msg.reconnectToken844 = horEnsureResume844(p);
  }
  if (!msg._sentAt) msg._sentAt = Date.now();
  return horNetSendRaw(conn, msg);
}

// Private, host-issued resume credentials never enter public player snapshots.
function horResumeToken844() {
  try {
    return sessionStorage.getItem('horResume844:' + roomCode) || '';
  } catch (_) {
    return '';
  }
}
function horEnsureResume844(player) {
  if (!player.reconnectToken844) player.reconnectToken844 = crypto.randomUUID();
  return player.reconnectToken844;
}
const horTurnActions844 = new Set([
  'bid',
  'discard',
  'trump',
  'play',
  'claimAllTrumps',
  'declineClaim',
]);
let horAwaitingResync844 = false;
function horSyncActionContext844() {
  if (!isHost || !game) return;
  const signature = JSON.stringify([
    game.networkHand844,
    game.phase,
    game.currentPlayer,
    game.bidder,
    game.highestBid,
    game.trump,
    game.trick?.map((p) => [p.player, p.card?.id]),
    game.hands?.map((h) => h.length),
  ]);
  if (game.actionSignature844 !== signature) {
    game.actionSignature844 = signature;
    game.actionContext844 = [game.careerMatchId, game.networkHand844, crypto.randomUUID()].join(
      ':'
    );
  }
}
function horAuthorizeIncoming844(data, conn) {
  if (!data || typeof data.type !== 'string' || !conn?.peer) return false;
  const sender = conn.peer;
  if (data.type === 'join') return data.id === sender && sender !== myPeerId;
  if (data.type === 'peekTable') return true;
  const idx = players.findIndex((p) => p && !p.isBot && p.id === sender);
  if (idx < 0) return false;
  if (['careerProfile', 'avatar', 'claimSeat'].includes(data.type) && data.id !== sender)
    return false;
  if (data.type === 'careerAnnouncement' && data.from !== sender) return false;
  if (data.type === 'leaveReplace' && data.playerId && data.playerId !== sender) return false;
  if (data.type === 'requestDiscardState')
    return idx === game?.bidder && data.player === idx && (!data.peerId || data.peerId === sender);
  if (horTurnActions844.has(data.type)) {
    horSyncActionContext844();
    return (
      data.player === idx &&
      !!game?.actionContext844 &&
      data.actionContext844 === game.actionContext844
    );
  }
  if (data.type === 'newHostReady')
    return (
      window._horHandoffTarget844 === sender && /^[A-Z0-9]{4}$/.test(String(data.roomCode || ''))
    );
  if (['readyNext', 'requestRematch', 'requestWaiting'].includes(data.type))
    return players[idx].seat >= 0 && game?.phase === 'score';
  return true;
}

function horNewActionId(kind) {
  return String(kind || 'act') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function horRememberAction(data) {
  if (!horExpOn('netTurnGuard') && !horExpOn('netDuplicateGuard') && !horExpOn('netAuthoritative'))
    return false;
  if (!game || !data) return false;
  const aid = data.actionId;
  if (!aid) return false;
  game.__seenActions = game.__seenActions || {};
  const sig =
    aid +
    '|' +
    String(data.player) +
    '|' +
    String(game.phase) +
    '|' +
    String(game.currentPlayer) +
    '|' +
    String(data.cardId || data.value || data.color || '');
  if (game.__seenActions[sig]) return true;
  game.__seenActions[sig] = Date.now();
  const keys = Object.keys(game.__seenActions);
  if (keys.length > 80) {
    keys.slice(0, keys.length - 60).forEach((k) => {
      delete game.__seenActions[k];
    });
  }
  return false;
}

function horQueueClientAction(msg) {
  if (!msg || typeof msg !== 'object') return false;
  if (horTurnActions844.has(msg.type)) {
    if (!game?.actionContext844) return false;
    msg.actionContext844 = game.actionContext844;
  }
  if (
    horExpOn('netTurnGuard') ||
    horExpOn('netDuplicateGuard') ||
    horExpOn('netActionQueue') ||
    horExpOn('netAuthoritative')
  ) {
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
  if (isHost || horAwaitingResync844 || !hostConnection || !hostConnection.open) return false;
  let sent = 0;
  const leftover = [];
  horOutbox.forEach((msg) => {
    if (horTurnActions844.has(msg.type) && msg.actionContext844 !== game?.actionContext844) return;
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
  horDebugLog(
    (isHost ? 'HOST' : 'CLIENT') +
      ': setupConn() wiring up connection, remote peer=' +
      (conn && conn.peer)
  );
  conn.__horWrapped = true;
  conn.__horRawSend = conn.send.bind(conn);
  conn.send = function (msg) {
    return horNetSend(conn, msg);
  };
  conn.on('data', (data) => {
    // Late packets from an abandoned attempt must not navigate or overwrite
    // the replacement connection's table.
    if (!isHost && hostConnection !== conn) return;
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
  conn.on('error', (err) => {
    if (!isHost && hostConnection !== conn) return;
    console.error('Data connection error:', err);
    horDebugLog(
      (isHost ? 'HOST' : 'CLIENT') +
        ': data connection error: ' +
        (err && (err.type || err.message))
    );
    if (!isHost && joinInProgress) {
      const s = $('lobbyStatus');
      if (s)
        s.textContent = 'Connection error: ' + ((err && (err.type || err.message)) || 'unknown');
    } else if (!isHost && !joinInProgress && horExpOn('netReconnect')) {
      horToast('Connection hiccup — holding your seat…');
      horBeginClientReconnect();
    }
  });
  conn.on('close', () => {
    if (!isHost && hostConnection !== conn) return;
    horDebugLog(
      (isHost ? 'HOST' : 'CLIENT') + ': connection closed, remote peer=' + (conn && conn.peer)
    );
    if (isHost) {
      const peerId = conn.peer;
      if (connMap[peerId] && connMap[peerId] !== conn) return; // Old transport cannot disconnect its replacement.
      if (connMap[peerId] === conn) delete connMap[peerId];
      const seated = players.find((p) => p && p.id === peerId && !p.isBot);
      if (seated && game && game.phase && game.phase !== 'lobby' && game.phase !== 'waiting') {
        hostStartDisconnectGrace(peerId);
      } else if (seated && (!game || game.phase === 'lobby' || game.phase === 'waiting')) {
        players = players.filter((p) => p.id !== peerId);
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
        try {
          alert('Disconnected from host');
        } catch (e) {}
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
  if (window.HORRavenFight741?.deferCelebration(() => horToast(text))) return;
  let el = document.getElementById('horNetworkToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'horNetworkToast';
    el.className = 'hor-network-toast';
    document.body.appendChild(el);
  }
  el.classList.toggle('bid-guidance805', /bid.*(?:viewing|details)|details.*bidding/i.test(text));
  if (el.classList.contains('bid-guidance805')) {
    const dock = document.getElementById('decisionConsole');
    const r = dock?.getBoundingClientRect();
    el.style.setProperty(
      '--bid-guidance-bottom',
      r && r.height ? Math.max(12, innerHeight - r.top + 10) + 'px' : '28vh'
    );
  }
  el.textContent = text;
  el.classList.add('show');
  (window.HORRavenFight741?.stopClock || clearTimeout)(el.__t);
  el.__t = (window.HORRavenFight741?.later || setTimeout)(() => el.classList.remove('show'), 2600);
}
function horBeginClientReconnect() {
  if (!horExpOn('netReconnect')) return;
  if (isHost || isSoloPractice || !roomCode || roomCode === 'OFFLINE') return;
  if (hostConnection && hostConnection.open) {
    horReconnectActive = false;
    return;
  }
  if (horReconnectActive) return;
  horAwaitingResync844 = true;
  horReconnectActive = true;
  horReconnectAttempt = 0;
  const step = () => {
    if (isHost || isSoloPractice || roomCode === 'OFFLINE') {
      horReconnectActive = false;
      return;
    }
    if (hostConnection && hostConnection.open) {
      horReconnectActive = false;
      horReconnectAttempt = 0;
      return;
    }
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
        if (hostConnection && hostConnection.open) {
          horReconnectActive = false;
          return;
        }
        if (phoneLooksOffline() || window._horNoServiceStop) {
          horReconnectActive = false;
          offerOfflinePlay();
          return;
        }
        if (!peer || !peer.open) {
          try {
            if (peer && peer.disconnected) peer.reconnect();
          } catch (e) {}
          setTimeout(step, 1500);
          return;
        }
        const c = peer.connect(peerRoomId(roomCode), { reliable: true, serialization: 'json' });
        if (!c) {
          step();
          return;
        }
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
            lastSeq: horLastAppliedSeq,
          });
          horFlushOutbox();
          horToast('Reconnected to the table ✓');
        });
        setTimeout(() => {
          if (!c.open && horReconnectActive) step();
        }, 7000);
      } catch (e) {
        step();
      }
    }, delay);
  };
  step();
}
function horStartHeartbeat() {
  clearInterval(horHeartbeatTimer);
  if (!horExpOn('netHeartbeat') && !horExpOn('netSilentDropDetect') && !horExpOn('netReconnect'))
    return;
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
            if (
              (!c || !c.open) &&
              game &&
              game.phase &&
              game.phase !== 'lobby' &&
              game.phase !== 'waiting'
            ) {
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
    if (
      horExpOn('netReconnect') &&
      !isHost &&
      horLastHostSeenAt &&
      Date.now() - horLastHostSeenAt > 8000
    ) {
      if (!hostConnection || !hostConnection.open) horBeginClientReconnect();
    }
  }, 3000);
}
horStartHeartbeat();

// ========== Message handling ==========
function handleMessage(data, conn) {
  if (!data || typeof data !== 'object') return;
  if (data && data.type === '__hor_ping') {
    try {
      conn && conn.send({ type: '__hor_pong', at: data.at });
    } catch (e) {}
    return;
  }
  if (data && data.type === '__hor_pong') {
    horLastHostSeenAt = Date.now();
    if (data.at) horLastPingMs = Math.max(0, Date.now() - Number(data.at));
    return;
  }
  if (isHost) {
    if (!horAuthorizeIncoming844(data, conn)) return;
    switch (data.type) {
      case 'join':
        horDebugLog(
          'HOST: processing join from name=' +
            data.name +
            ' id=' +
            data.id +
            ' spectator=' +
            !!data.spectator +
            ' appVersion=' +
            data.appVersion
        );
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
          conn.send({
            type: 'versionMismatch',
            hostVersion: APP_VERSION,
            yourVersion: data.appVersion,
            hostIsStale,
          });
          horDebugLog(
            'HOST: version mismatch (host=' +
              APP_VERSION +
              ' joiner=' +
              data.appVersion +
              '), hostIsStale=' +
              hostIsStale
          );
          if (hostIsStale) {
            // We're the one running old code — update ourselves instead of
            // making the up-to-date joiner reload forever against us.
            setTimeout(horForceUpdate, 1500);
          }
          return;
        }
        // Same PeerJS id coming back (reconnect during grace). Refresh the
        // DataConnection and resync instead of dropping the join on the floor.
        const already = players.find((p) => p && p.id === data.id);
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
            settings: {
              includeRed2,
              red2Points,
              targetScore,
              botDifficulty,
              layDownWinningCards,
              revealTopNest,
              experimental: window.horExperimental || {},
            },
          });
          try {
            conn.send({
              type: 'players',
              players: publicPlayersSnapshot(),
              beerSeats,
            });
          } catch (e) {}
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
            settings: {
              includeRed2,
              red2Points,
              targetScore,
              botDifficulty,
              layDownWinningCards,
              revealTopNest,
              experimental: window.horExperimental || {},
            },
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
              trumpVoiceEvent790: game.trumpVoiceEvent790 || null,
              trumpPresentation833: !!game.trumpPresentation833,
              trumpPresentationMs833: game.trumpPresentationMs833 || 0,
              trumpVoiceRestore790: true,
              currentPlayer: game.currentPlayer,
              trick: game.trick,
              ledColor: game.ledColor,
              players: players.map((p) => ({
                name: p.name,
                team: p.team,
                id: p.id,
                isBot: !!p.isBot,
                avatar: p.avatar || playerAvatars[p.id] || '',
                voice: p.isBot ? 'avatar' : validHumanVoice(p.voice),
                careerPublic: p.careerPublic || null,
              })),
              dealer: game.dealer,
              nestCount: game.nest?.length || 0,
              handsCount: game.hands.map((h) => h.length),
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
            const occ = !isNaN(want) && want >= 0 && want <= 3 ? playerAtSeat(want) : null;
            // Full table: only a bot seat can be taken. Relocate that bot if
            // another chair opens during claim; otherwise the bot leaves.
            if (!(occ && occ.isBot) && !players.some((p) => p && p.isBot)) {
              if (horExpOn('spectatorLateJoin')) {
                data.spectator = true;
              } else {
                conn.send({
                  type: 'error',
                  message: 'Room full — join as spectator instead',
                });
                return;
              }
            }
          } else if (horExpOn('spectatorLateJoin')) {
            data.spectator = true;
          } else {
            conn.send({
              type: 'error',
              message: 'Room full — join as spectator instead',
            });
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
            settings: {
              includeRed2,
              red2Points,
              targetScore,
              botDifficulty,
              layDownWinningCards,
              revealTopNest,
              experimental: window.horExperimental || {},
            },
          });
          break;
        }
        if (players.find((p) => p.id === data.id)) {
          return;
        }
        players.push({
          id: data.id,
          name: data.name,
          team: 0,
          isHost: false,
          isBot: false,
          seat: -1,
          avatar: humanAvatarAllowed783(avatarKey(data.avatar))
            ? avatarKey(data.avatar)
            : AVATARS[0],
          voice: validHumanVoice(data.voice),
          careerPublic: null,
        });
        if (data.id)
          playerAvatars[data.id] = humanAvatarAllowed783(avatarKey(data.avatar))
            ? avatarKey(data.avatar)
            : AVATARS[0];
        const wantSeat = parseInt(data.preferredSeat, 10);
        let seatedOk = false;
        if (!isNaN(wantSeat) && wantSeat >= 0 && wantSeat <= 3) {
          seatedOk = hostClaimSeat(wantSeat, data.id);
        }
        if (!seatedOk) {
          // Stay standing until they pick an open chair or a bot. Do not
          // auto-assign a seat — already seated humans must keep showing
          // in the chairs they claimed.
          broadcast({
            type: 'players',
            players: publicPlayersSnapshot(),
            beerSeats,
          });
          updateWaitingUI();
        }
        conn.send({
          type: 'welcome',
          players: publicPlayersSnapshot(),
          yourId: data.id,
          beerSeats,
          hostVersion: APP_VERSION,
          settings: {
            includeRed2,
            red2Points,
            targetScore,
            botDifficulty,
            revealTopNest,
            experimental: window.horExperimental || {},
          },
        });
        try {
          conn.send({
            type: 'players',
            players: publicPlayersSnapshot(),
            beerSeats,
          });
        } catch (e) {}
        break;

      case 'careerProfile': {
        const p = (players || []).find((x) => x && x.id === data.id);
        if (p && !p.isBot) {
          p.careerPublic = data.profile && data.profile.enabled ? data.profile : null;
          broadcast({ type: 'careerProfile', id: p.id, profile: p.careerPublic }, p.id);
          broadcast({
            type: 'players',
            players: publicPlayersSnapshot(),
            beerSeats,
          });
        }
        break;
      }
      case 'careerAnnouncement':
        if (data.event) {
          broadcast({ type: 'careerAnnouncement', from: data.from, event: data.event }, data.from);
          horCareerAnnouncement(data.event);
        }
        break;

      case 'bid':
        if (game && game.phase === 'bidding') hostProcessBid(data);
        break;
      case 'discard':
        if (game && game.phase === 'discard') hostProcessDiscard(data);
        break;
      case 'requestDiscardState':
        if (game && game.phase === 'discard') hostSendDiscardStart(data.player, conn.peer);
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
        if (
          sender &&
          data.id === sender &&
          changeHumanAvatar777(
            sender,
            data.avatar || data.emoji || AVATARS[0],
            data.voice,
            data.name
          )
        ) {
          publishAvatarIdentities777();
        } else if (conn && conn.send) {
          conn.send({
            type: 'error',
            message: 'That avatar is unavailable. Please choose another.',
          });
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
          conn.send({
            type: 'players',
            players: publicPlayersSnapshot(),
            beerSeats,
          });
        } catch (e) {}
        break;
      case 'newHostReady':
        window._horHandoffTarget844 = null;
        broadcast({
          type: 'switchHost',
          roomCode: data.roomCode,
          hostName: data.hostName,
        });
        setTimeout(() => {
          try {
            horFollowNewHost(data.roomCode);
          } catch (e) {}
        }, 500);
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
          const nextMyIndex = players.findIndex((p) => p && p.id === myPeerId);
          if (nextMyIndex >= 0) myIndex = nextMyIndex;
        }
        if (Array.isArray(data.beerSeats)) beerSeats = data.beerSeats;
        updateWaitingUI();
        break;
      case 'whisper':
        if (
          data.toId === myPeerId ||
          data.fromId === myPeerId ||
          data.to === myIndex ||
          data.from === myIndex
        ) {
          showTableMsgPopup(
            (data.name || 'Player') + (data.to === myIndex ? ' (private)' : ' → you'),
            data.text
          );
        }
        break;
      case 'welcome':
        if (data.yourId !== myPeerId) return;
        horDebugLog(
          'CLIENT: welcome received, yourId=' +
            data.yourId +
            ', players=' +
            (data.players ? data.players.length : 0) +
            ', hostVersion=' +
            data.hostVersion
        );
        if (data.hostVersion && data.hostVersion !== APP_VERSION) {
          if (conn && conn.__horJoinRejected844)
            conn.__horJoinRejected844(
              'The two devices are running different game versions. Reopen both sites and try again.'
            );
          const s = $('lobbyStatus');
          const weAreStale = horVersionNum(APP_VERSION) < horVersionNum(data.hostVersion);
          if (weAreStale) {
            if (horClientIsPlaying() || horHasActiveTable()) {
              if (s)
                s.textContent =
                  'Update available; staying at the table until this hand is finished.';
            } else {
              if (s)
                s.textContent =
                  'This device is running an outdated version. Updating automatically…';
              setTimeout(horForceUpdate, 1500);
            }
          } else if (s) {
            s.textContent =
              'The host appears to be on an older version. Ask them to reopen the app, then try again.';
          }
          break;
        }
        if (data.reconnectToken844 && data.yourId === myPeerId) {
          try {
            sessionStorage.setItem('horResume844:' + roomCode, data.reconnectToken844);
          } catch (_) {}
        }
        horAwaitingResync844 = true;
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
          myIndex = players.findIndex((p) => p.id === data.yourId);
        }
        if (data.settings) {
          includeRed2 = !!data.settings.includeRed2;
          if (data.settings.red2Points) red2Points = data.settings.red2Points;
          if (data.settings.targetScore)
            targetScore = normalizeTargetScore(data.settings.targetScore);
          if (typeof data.settings.layDownWinningCards === 'boolean')
            layDownWinningCards = data.settings.layDownWinningCards;
          if (typeof data.settings.revealTopNest === 'boolean')
            revealTopNest = data.settings.revealTopNest;
          if (typeof data.settings.comebackSpecialChance === 'boolean')
            comebackSpecialChance = data.settings.comebackSpecialChance;
        }
        // Never navigate an already-playing client back to the welcome/lobby
        // screen just because PeerJS delivered a reconnect `welcome` packet.
        // The authoritative `state` packet will follow and refresh the table.
        const activeTable = horClientIsPlaying() || horHasActiveTable();
        if (
          !activeTable &&
          (!horExpOn('netResyncOnReclaim') ||
            !data.reclaimed ||
            !game ||
            game.phase === 'lobby' ||
            game.phase === 'waiting')
        ) {
          if (joinedFromWelcome || welcomeVisible() || data.preview || pendingPreviewJoin) {
            showWelcomeScreen(roomCode);
            try {
              updateWelcomeSeats();
            } catch (e) {}
            const seatedN = seatedCount();
            setJoinStatus(
              seatedN
                ? seatedN + ' seated. Type your name, then tap an open seat or a bot.'
                : 'Table is empty. Type your name, then tap a chair.'
            );
          } else {
            showWaiting();
          }
        }
        saveSession();
        try {
          horFlushOutbox();
        } catch (e) {}
        if (conn && conn.__horJoinAccepted844) conn.__horJoinAccepted844();
        break;

      case 'versionMismatch': {
        if (conn && conn.__horJoinRejected844)
          conn.__horJoinRejected844(
            'The two devices are running different game versions. Reopen both sites and try again.'
          );
        const s = $('lobbyStatus');
        // Only refresh ourselves if we're actually the stale side. If the
        // host already told us it's the one that's outdated (hostIsStale),
        // it is already reloading itself — refreshing here too would just
        // race it and loop. Wait and let the host come back.
        if (data.hostIsStale) {
          if (s)
            s.textContent =
              'The host is on an older version and is updating now — retrying the join…';
          joinInProgress = false;
          setTimeout(() => {
            try {
              joinRoom();
            } catch (e) {}
          }, 4000);
        } else {
          if (s)
            s.textContent = 'This device is running an outdated version. Updating automatically…';
          setTimeout(horForceUpdate, 1500);
        }
        break;
      }

      case 'error':
        if (conn && conn.__horJoinRejected844)
          conn.__horJoinRejected844(
            data.message || 'The host could not accept your join. Please try again.'
          );
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
              try {
                renderHand(false);
              } catch (e) {}
              try {
                scheduleTopNestFlip();
              } catch (e) {}
              if (
                game.phase === 'bidding' &&
                game.currentPlayer === myIndex &&
                !nestAuctionLocked()
              )
                showBidUI();
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
          game.nestPreview = data.nestPreview
            .map((c) => {
              try {
                return typeof hydrateNestCard === 'function' ? hydrateNestCard(c) : { ...c };
              } catch (e) {
                return { ...c };
              }
            })
            .filter(Boolean);
          game.kittyTaken = game.nestPreview.map((c) => ({ ...c }));
        }
        if (data.topNestCard) game.topNestCard = { ...data.topNestCard };
        if (Array.isArray(data.hand) && data.hand.length)
          game.myHand = data.hand.map((c) => ({ ...c }));
        if (game.bidder === myIndex || data.peerId === myPeerId) {
          const flowKey = discardFlowIdentity(game.myHand || [], game.bidder);
          const sameFlow = window._discardFlowKey === flowKey;
          if (!sameFlow) {
            window._discardFlowKey = flowKey;
            window._discardPage =
              data.showKitty && (game.kittyTaken || []).length ? 'kitty' : 'select';
            window._discardKittyShown = false;
            window._discardSubmitting = false;
            window._discardStartReceived = false;
            window.selectedForDiscard = new Set();
            window._discardPickStep = 0;
          } else if (
            !window._discardStartReceived &&
            data.showKitty &&
            (game.kittyTaken || []).length
          ) {
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
          try {
            renderHand(true);
          } catch (e) {}
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
        if (ma)
          ma.textContent = (data && data.message) || `Select exactly ${needed} cards to discard`;
        if (Array.isArray(data.hand) && data.hand.length && game) {
          game.myHand = data.hand.map((c) => ({ ...c }));
          try {
            showDiscardUI(false);
          } catch (e) {}
        }
        break;
      }
      case 'discardOk':
        try {
          clearTimeout(window._discardAckTimer);
        } catch (e) {}
        hideDiscardOverlay();
        if (game && Array.isArray(data.hand)) game.myHand = data.hand.map((c) => ({ ...c }));
        break;

      case 'tableToast':
        playTableToast();
        break;
      case 'message': {
        const subject =
          data.event === 'trick-winner' ? captureSubject793(data.winnerName, data.winnerId) : null;
        $('messageArea').textContent = subject
          ? '🏆 ' + subject.name + subject.win + ' the trick!'
          : data.text;
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
            try {
              queueCaptureCelebrations(data.kinds || data.kind || [], data.winnerName || '');
            } catch (e) {}
          }, 850);
        } catch (e) {}
        break;
      case 'biddingIntro':
        try {
          showBiddingIntro(null, data.minBid);
        } catch (e) {}
        break;
      case 'settings':
        if (data.experimental && window.horExperimental) {
          // Testing tab flags stay local so each device can isolate a switch.
          const incomingExp = Object.assign({}, data.experimental);
          Object.keys(incomingExp).forEach((k) => {
            if (k.indexOf('net') === 0 || k === 'lobbyReconnect' || k === 'debugPanel')
              delete incomingExp[k];
          });
          window.horExperimental = Object.assign({}, window.horExperimental, incomingExp);
          try {
            window.applyHorExperimental && window.applyHorExperimental();
          } catch (e) {}
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
        if (typeof data.misdealOnNoCounters === 'boolean')
          misdealOnNoCounters = data.misdealOnNoCounters;
        if (typeof data.screwTheDealer === 'boolean') screwTheDealer = data.screwTheDealer;
        if (typeof data.comebackSpecialChance === 'boolean')
          comebackSpecialChance = data.comebackSpecialChance;
        if (typeof data.openWidow === 'boolean') openWidow = data.openWidow;
        if (typeof data.revealTopNest === 'boolean') revealTopNest = data.revealTopNest;
        if (typeof data.shootMoonEnabled === 'boolean') shootMoonEnabled = data.shootMoonEnabled;
        if (data.botSpeed) botSpeed = data.botSpeed;
        if (typeof data.partnerNeverKill === 'boolean') partnerNeverKill = data.partnerNeverKill;
        if (typeof data.partnerFeedLast === 'boolean') partnerFeedLast = data.partnerFeedLast;
        if (typeof data.dontStealPartnerBid === 'boolean')
          dontStealPartnerBid = data.dontStealPartnerBid;
        if (typeof data.landscapeBidHints === 'boolean') landscapeBidHints = data.landscapeBidHints;
        if (typeof data.nestLastTrickAnim === 'boolean') nestLastTrickAnim = data.nestLastTrickAnim;
        if (typeof data.layDownWinningCards === 'boolean')
          layDownWinningCards = data.layDownWinningCards;
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
        try {
          recomputeHandAndNest();
        } catch (e) {}
        try {
          syncOptionsUI();
        } catch (e) {}
        break;

      case 'careerProfile': {
        const p = (players || []).find((x) => x && x.id === data.id);
        if (p) p.careerPublic = data.profile && data.profile.enabled ? data.profile : null;
        if (game && Array.isArray(game.players)) {
          const gp = game.players.find((x) => x && x.id === data.id);
          if (gp) gp.careerPublic = data.profile && data.profile.enabled ? data.profile : null;
        }
        try {
          renderUI();
        } catch (e) {}
        break;
      }
      case 'careerAnnouncement':
        if (data.event) horCareerAnnouncement(data.event);
        break;

      case 'avatar':
        if (data.id) playerAvatars[data.id] = data.avatar || data.emoji || AVATARS[0];
        try {
          renderUI();
        } catch (e) {}
        break;
      case 'hostHandoff':
        if (data.snapshot) acceptHostHandoff(data.snapshot);
        break;
      case 'switchHost':
        if (data.roomCode)
          setTimeout(() => {
            try {
              horFollowNewHost(data.roomCode);
            } catch (e) {}
          }, 400);
        break;
      case 'pause':
        if (game) game.paused = !!data.paused;
        setPauseUI(!!data.paused);
        if (data.paused) {
          if (turnTimerInterval) {
            clearInterval(turnTimerInterval);
            turnTimerInterval = null;
          }
          const bar = $('turnTimerBar');
          if (bar) bar.classList.add('hidden');
        }
        break;
      case 'turnTimer':
        if (horExpOn('netTimerSync') && data.serverNow)
          window.horServerOffset = Number(data.serverNow) - Date.now();
        turnTimerEndsAt = data.endsAt || Date.now() + (data.seconds || 30) * 1000;
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
          showNestCaptureAnimation(data.winnerName || 'Winner', data.cards || [], data.pts || 0);
        } catch (e) {}
        break;
      case 'handResult':
        if (data.history) handHistory = data.history;
        if (Array.isArray(data.matchTricks)) matchTricks = data.matchTricks;
        if (data.matchStats) matchStats = data.matchStats;
        if (Array.isArray(data.playerStats)) playerStats = data.playerStats;
        if (data.summary) {
          if (game && data.summary.careerEvent?.matchId)
            game.careerMatchId = data.summary.careerEvent.matchId;
          window.HOREndHandEffectsV12?.prepare();
          if (data.summary.careerEvent) horRecordCareerHand(data.summary.careerEvent);
          // Clients may still be watching the bounded nest capture.
          const stillNest = document.getElementById('ghNestAnim');
          if (stillNest) {
            setTimeout(() => {
              stillNest.remove();
              presentCompletedHandV12(data.summary);
            }, 200);
          } else presentCompletedHandV12(data.summary);
        }
        break;
      case 'hostGone':
        horMarkActiveTable(false);
        alert(data.message || 'Host disconnected. Game ended.');
        try {
          sessionStorage.removeItem('rookSession');
        } catch (e) {}
        location.reload();
        break;
      case 'matchRematch':
        try {
          hideCelePage();
        } catch (e) {}
        break;
      case 'returnWaiting':
        horMarkActiveTable(false);
        try {
          applyReturnToWaiting();
        } catch (e) {}
        break;
      case 'matchHighlights':
        try {
          if (Array.isArray(data.matchTricks)) matchTricks = data.matchTricks;
          pendingCele = {
            matchId: data.matchId || game?.careerMatchId,
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
  horDebugLog(
    (isHost ? 'HOST' : 'CLIENT') +
      ': showWaiting() called, myIndex=' +
      myIndex +
      ', isSpectator=' +
      !!isSpectator
  );
  setLobbyPortraitOrientation();
  try {
    hideCelePage();
  } catch (e) {}
  hideWelcomeScreen();
  lobby.classList.add('hidden');
  waiting.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  try {
    document.body.classList.remove('in-game');
    document.body.classList.add('at-table');
  } catch (e) {}
  setTimeout(syncLandscapeFullscreen, 50);
  const codeEl = $('displayCode');
  if (codeEl) codeEl.textContent = roomCode;
  try {
    applyWaitingShareMode();
  } catch (e) {}
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
        try {
          broadcast({ type: 'settings', includeRed2, red2Points });
        } catch (e) {}
      };
    }
    document.querySelectorAll('input[name="red2pts"]').forEach((r) => {
      r.checked = parseInt(r.value, 10) === red2Points;
      r.onchange = () => {
        if (r.checked) {
          red2Points = parseInt(r.value, 10);
          try {
            broadcastPlaySettings();
          } catch (e) {}
        }
      };
    });

    const bs = $('opt-bot-speed');
    if (bs) {
      bs.value = botSpeed;
      bs.onchange = () => {
        botSpeed = bs.value || 'normal';
        try {
          broadcastPlaySettings();
        } catch (e) {}
      };
    }
    const bindCoach = (id, getter, apply) => {
      const el = $(id);
      if (!el) return;
      el.checked = !!getter();
      el.onchange = () => {
        apply(!!el.checked);
        try {
          broadcastPlaySettings();
        } catch (e) {}
      };
    };
    bindCoach(
      'opt-partner-never-kill',
      () => partnerNeverKill,
      (v) => {
        partnerNeverKill = v;
      }
    );
    bindCoach(
      'opt-partner-feed-last',
      () => partnerFeedLast,
      (v) => {
        partnerFeedLast = v;
      }
    );
    bindCoach(
      'opt-dont-steal-bid',
      () => dontStealPartnerBid,
      (v) => {
        dontStealPartnerBid = v;
      }
    );
    bindCoach(
      'opt-landscape-hints',
      () => landscapeBidHints,
      (v) => {
        landscapeBidHints = v;
      }
    );
    bindCoach(
      'opt-nest-anim',
      () => nestLastTrickAnim,
      (v) => {
        nestLastTrickAnim = v;
      }
    );
    bindCoach(
      'opt-lay-down',
      () => layDownWinningCards,
      (v) => {
        layDownWinningCards = v;
      }
    );
    const hsm = $('opt-hand-sort');
    if (hsm) {
      hsm.value = normalizeHandSortMode(handSortMode);
      hsm.onchange = () => {
        handSortMode = normalizeHandSortMode(hsm.value);
        persistHandSortMode();
        try {
          if (game && game.myHand) renderHand(game.phase === 'discard' && game.bidder === myIndex);
        } catch (e) {}
      };
    }
    const mtv = $('opt-must-trump');
    if (mtv) {
      mtv.checked = !!mustTrumpWhenVoid;
      mtv.onchange = () => {
        mustTrumpWhenVoid = mtv.checked;
        try {
          broadcastPlaySettings();
        } catch (e) {}
      };
    }

    const bdg = $('opt-bot-difficulty-ingame');
    if (bdg) {
      bdg.value = botDifficulty || 'extreme';
      bdg.onchange = () => {
        botDifficulty = bdg.value || 'extreme';
        if (botDifficulty === 'extreme') hideBotStyleTip();
        try {
          broadcastPlaySettings();
        } catch (e) {}
      };
    }

    const tts = $('opt-turn-time');
    if (tts) {
      tts.value = String(turnTimeSec);
      tts.onchange = () => {
        turnTimeSec = parseInt(tts.value, 10) || 0;
        try {
          broadcastPlaySettings();
        } catch (e) {}
      };
    }
    const top = $('opt-timeout-policy');
    if (top) {
      top.value = timeoutPolicy || 'auto';
      top.onchange = () => {
        timeoutPolicy = top.value || 'auto';
        try {
          broadcastPlaySettings();
        } catch (e) {}
      };
    }
    const sc = $('opt-sound-card');
    if (sc) {
      sc.checked = soundCard;
      sc.onchange = () => {
        soundCard = sc.checked;
        if (!soundCard) {
        }
      };
    }
    const st = $('opt-sound-turn');
    if (st) {
      st.checked = soundTurn;
      st.onchange = () => {
        soundTurn = st.checked;
        try {
          localStorage.setItem('rookSoundTurn', soundTurn ? '1' : '0');
        } catch (e) {}
        if (soundTurn) {
          try {
            playTurnSound(true);
          } catch (e) {}
        }
      };
    }
    const sts = $('opt-turn-sound-choice');
    if (sts) {
      sts.value = String(turnSoundChoice);
      sts.onchange = () => {
        turnSoundChoice = Math.max(1, Math.min(20, parseInt(sts.value, 10) || 20));
        try {
          localStorage.setItem('rookTurnSoundChoice', String(turnSoundChoice));
        } catch (e) {}
        try {
          playTurnSound(true);
        } catch (e) {}
      };
    }
    const sr = $('opt-sound-rook');
    if (sr) {
      sr.checked = soundRook;
      sr.onchange = () => {
        soundRook = sr.checked;
      };
    }
    const sk = $('opt-sound-tick');
    if (sk) {
      sk.checked = soundTick;
      sk.onchange = () => {
        soundTick = sk.checked;
      };
    }
    const avatarGrid = $('avatarGrid');
    if (avatarGrid) {
      avatarGrid.innerHTML = ['jerome_founder', ...Object.keys(window.HORHumanAvatars || {})]
        .map(
          (id, i) =>
            `<button type="button" class="avatar-choice" data-avatar="${id}" title="${AVATAR_LABELS[id]}"><img loading="lazy" src="${avatarSrc(id)}" alt="${AVATAR_LABELS[id]}"><span>${AVATAR_LABELS[id]}</span></button>`
        )
        .join('');
      avatarGrid.querySelectorAll('.avatar-choice').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-avatar');
          if (!id) return;
          if (
            players.some(
              (p) => p && !p.isBot && p.id !== myPeerId && (playerAvatars[p.id] || p.avatar) === id
            )
          ) {
            horToast('That avatar is already chosen by another player.');
            return;
          }
          if (isHost) {
            window.HORFounderProfile785.select(id);
            if (!changeHumanAvatar777(myPeerId, id, loadPreferredVoice(), myName)) return;
            publishAvatarIdentities777();
          } else if (hostConnection && hostConnection.open) {
            // Wait for the host's canonical snapshot; no duplicate-frame optimistic swap.
            window.HORFounderProfile785.select(id);
            hostConnection.send({
              type: 'avatar',
              id: myPeerId,
              avatar: id,
              voice: loadPreferredVoice(),
              name: myName,
            });
          } else if (!game) {
            window.HORFounderProfile785.select(id);
            if (myPeerId) playerAvatars[myPeerId] = id;
          } else {
            horToast('Reconnect before changing your avatar.');
            return;
          }
          avatarGrid
            .querySelectorAll('.avatar-choice')
            .forEach((b) => b.classList.toggle('selected', b === btn));
        };
      });
      const current =
        ensurePreferredAvatar() ||
        playerAvatars[myPeerId] ||
        (players.find((p) => p.id === myPeerId) || {}).avatar ||
        AVATARS[0];
      avatarGrid
        .querySelectorAll('.avatar-choice')
        .forEach((b) => b.classList.toggle('selected', b.getAttribute('data-avatar') === current));
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
          const humans = players.filter((p) => !p.isBot).length;
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
  window.HORHouseMenu805?.open();
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
      try {
        broadcastPlaySettings();
      } catch (e) {}
    };
  };
  bindCheck(
    'opt-specials-anytime',
    () => specialsAnytime,
    (v) => {
      specialsAnytime = v;
    }
  );
  bindCheck(
    'opt-must-trump',
    () => mustTrumpWhenVoid,
    (v) => {
      mustTrumpWhenVoid = v;
    }
  );
  bindCheck(
    'opt-bid-only',
    () => bidOnlyScoring,
    (v) => {
      bidOnlyScoring = v;
    }
  );
  bindCheck(
    'opt-screw-dealer',
    () => screwTheDealer,
    (v) => {
      screwTheDealer = v;
    }
  );
  bindCheck(
    'opt-misdeal-no-counters',
    () => misdealOnNoCounters,
    (v) => {
      misdealOnNoCounters = v;
    }
  );
  bindCheck(
    'opt-comeback-special-chance',
    () => comebackSpecialChance,
    (v) => {
      comebackSpecialChance = v;
    }
  );
  bindCheck(
    'opt-open-widow',
    () => openWidow,
    (v) => {
      openWidow = v;
    }
  );
  bindCheck(
    'opt-shoot-moon',
    () => shootMoonEnabled,
    (v) => {
      shootMoonEnabled = v;
    }
  );
  const bindChoice = (id, read, write) => {
    const el = $(id);
    if (!el) return;
    el.value = read();
    el.onchange = () => {
      write(el.value);
      syncOptionsUI();
      broadcastPlaySettings();
    };
  };
  bindChoice(
    'opt-nest-goes-to',
    () => nestGoesTo,
    (v) => {
      if (['lastTrick', 'bidder'].includes(v)) nestGoesTo = v;
    }
  );
  bindChoice(
    'opt-lead-order',
    () => leadOrder,
    (v) => {
      if (['bidder', 'leftOfBidder', 'rightOfBidder'].includes(v)) leadOrder = v;
    }
  );
  bindCheck(
    'opt-reveal-top-nest',
    () => revealTopNest,
    (v) => {
      revealTopNest = v;
      try {
        renderTopNestPeek();
      } catch (e) {}
    }
  );
  bindCheck(
    'opt-include-ones',
    () => includeOnes,
    (v) => {
      includeOnes = v;
      onesHigh = v;
    }
  );
  bindCheck(
    'opt-include-red2',
    () => includeRed2,
    (v) => {
      includeRed2 = v;
      const ptsBox = $('opt-red2-points');
      if (ptsBox) ptsBox.style.display = v ? 'block' : 'none';
    }
  );
  bindCheck(
    'opt-include-red1',
    () => includeRed1,
    (v) => {
      includeRed1 = v;
    }
  );
  bindCheck(
    'opt-include-rook',
    () => includeRook,
    (v) => {
      includeRook = v;
    }
  );
  bindCheck(
    'opt-rook-lowest',
    () => rookLowest,
    (v) => {
      rookLowest = v;
    }
  );
  document.querySelectorAll('input[name="red2pts"]').forEach((r) => {
    r.checked = parseInt(r.value, 10) === red2Points;
    r.onchange = () => {
      if (r.checked) {
        red2Points = parseInt(r.value, 10);
        try {
          broadcastPlaySettings();
        } catch (e) {}
      }
    };
  });

  const mb = $('opt-min-bid');
  if (mb) {
    mb.value = String(minBid);
    mb.onchange = () => {
      minBid = parseInt(mb.value, 10) || 100;
      try {
        broadcastPlaySettings();
      } catch (e) {}
      syncOptionsUI();
    };
  }
  wireTargetScoreUI();
}

function botCount() {
  return players.filter((p) => p.isBot).length;
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
  return (players || []).find((p) => p && p.seat === seat) || null;
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
  players = (players || []).filter((p) => p !== bot);
  return false;
}
function seatedCount() {
  return [0, 1, 2, 3].filter((s) => !!playerAtSeat(s)).length;
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
  players = packed.concat(
    (players || []).filter((p) => p && (typeof p.seat !== 'number' || p.seat < 0))
  );
  if (myPeerId) {
    const idx = players.findIndex((p) => p.id === myPeerId);
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
    let seat = i <= 3 && !used.has(i) ? i : -1;
    if (seat < 0) {
      for (let s = 0; s < 4; s++) {
        if (!used.has(s)) {
          seat = s;
          break;
        }
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
  const used = new Set(),
    names = new Set(players.filter((p) => p && p.isBot).map((p) => p.name));
  const freeAvatar = () => Object.keys(window.HORHumanAvatars || {}).find((a) => !used.has(a));
  for (const p of players.filter((p) => p && !p.isBot)) {
    let a = playerAvatars[p.id] || p.avatar || AVATARS[0];
    if (!humanAvatarAllowed783(a) || used.has(a)) a = freeAvatar();
    if (a && (p.avatar !== a || playerAvatars[p.id] !== a)) patch(p, { avatar: a });
    if (a) used.add(a);
  }
  for (const p of players.filter((p) => p && p.isBot)) {
    let persona = BOT_PERSONAS.find((b) => b.name === p.name);
    let a = persona?.avatar || playerAvatars[p.id] || p.avatar;
    if (!a || used.has(a)) {
      persona = BOT_PERSONAS.find((b) => !used.has(b.avatar) && !names.has(b.name));
      if (!persona) continue;
      names.delete(p.name);
      names.add(persona.name);
      a = persona.avatar;
      patch(p, {
        name: persona.name,
        avatar: a,
        botStyle: persona.style,
        careerPublic:
          horCareerModeOn() && window.HORProgression?.localCareer?.botPublicProfile
            ? HORProgression.localCareer.botPublicProfile(persona.name)
            : null,
      });
    } else if (p.avatar !== a || playerAvatars[p.id] !== a) patch(p, { avatar: a });
    used.add(a);
  }
  return changed;
}
function changeHumanAvatar777(id, avatar, voice, name) {
  if (!isHost || !humanAvatarAllowed783(avatar)) return false;
  const p = players.find((p) => p && p.id === id && !p.isBot);
  if (
    !p ||
    players.some(
      (q) => q && !q.isBot && q.id !== id && (playerAvatars[q.id] || q.avatar) === avatar
    )
  )
    return false;
  if (avatar === 'jerome_founder' && p.avatar !== avatar) {
    p.nameBeforeJerome787 = p.name;
    p.name = 'Jerome';
    p.voice = 'male';
  } else if (
    avatar !== 'jerome_founder' &&
    p.avatar === 'jerome_founder' &&
    p.nameBeforeJerome787
  ) {
    p.name = p.nameBeforeJerome787;
    delete p.nameBeforeJerome787;
  }
  if (avatar !== 'jerome_founder' && typeof name === 'string' && name.trim()) p.name = name.trim();
  if (voice !== undefined) p.voice = validHumanVoice(voice);
  p.avatar = avatar;
  playerAvatars[id] = avatar;
  if (game?.players) {
    const q = game.players.find((q) => q && q.id === id);
    if (q) {
      q.avatar = avatar;
      q.name = p.name;
      q.voice = p.voice;
    }
  }
  reconcileAvatarIdentities777();
  return true;
}
function publishAvatarIdentities777() {
  if (!isHost) return;
  broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats });
  if (game) broadcastState();
  try {
    updateWaitingUI();
    renderUI();
  } catch (_) {}
}

function publicPlayersSnapshot() {
  reconcileAvatarIdentities777();
  ensurePlayerSeats(players);
  try {
    const me = (players || []).find((p) => p && !p.isBot && p.id === myPeerId);
    if (me) me.careerPublic = horMyCareerProfile();
  } catch (e) {}
  return (players || []).filter(Boolean).map((p) => ({
    id: p.id,
    name: p.name,
    team: typeof p.team === 'number' ? p.team : (p.seat || 0) % 2,
    isHost: !!p.isHost,
    isBot: !!p.isBot,
    seat: typeof p.seat === 'number' ? p.seat : -1,
    avatar: p.avatar || playerAvatars[p.id] || '',
    voice: p.isBot ? 'avatar' : validHumanVoice(p.voice),
    botStyle: p.botStyle || '',
    isTempBot: !!p.isTempBot,
    humanStyle: p.humanStyle || '',
    humanTitle: p.humanTitle || '',
    humanHabit: p.humanHabit || '',
    humanHow: p.humanHow || '',
    humanHands: p.humanHands || 0,
    careerPublic: p.careerPublic || null,
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
    const humans = players.filter((p) => !p.isBot).length;
    const maxBots = Math.max(0, 4 - humans);
    Array.from(sel.options).forEach((opt) => {
      const n = parseInt(opt.value, 10);
      opt.disabled = n > maxBots;
      // Clarify what each choice does
      if (n === 0) opt.textContent = '0 bots';
      else if (n > maxBots) opt.textContent = n + ' bots (need fewer people)';
      else if (humans + n === 4)
        opt.textContent = n + ' bot' + (n === 1 ? '' : 's') + ' (fill table)';
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
  {
    name: 'Anchor',
    style: 'partnerFirst',
    avatar: 'anchor',
    blurb: 'Feeds partner. Protects the bid.',
  },
  { name: 'Wager', style: 'bidHappy', avatar: 'wager', blurb: 'Loves the auction. Climbs bids.' },
  { name: 'Hollow', style: 'voidMaker', avatar: 'hollow', blurb: 'Strips a color to ruff later.' },
  { name: 'Ember', style: 'balanced', avatar: 'ember', blurb: 'Steady book. No wild swings.' },
  { name: 'Vex', style: 'ruffHappy', avatar: 'vex', blurb: 'Ruffs the first chance it gets.' },
  {
    name: 'Frost',
    style: 'scoreHawk',
    avatar: 'frost',
    blurb: 'Only buys when the score says so.',
  },
  { name: 'Fang', style: 'setDog', avatar: 'fang', blurb: 'Lives to set the other team.' },
  {
    name: 'Halo',
    style: 'partnerSignal',
    avatar: 'halo',
    blurb: 'Leads the color partner is void.',
  },
  {
    name: 'Quill',
    style: 'countSaver',
    avatar: 'quill',
    blurb: 'Hides counters until the trick is safe.',
  },
  {
    name: 'Bramble',
    style: 'leadLong',
    avatar: 'bramble',
    blurb: 'Leads the long color and stays there.',
  },
  { name: 'Moss', style: 'trumpShy', avatar: 'moss', blurb: 'Has trump. Refuses to lead it.' },
  {
    name: 'Emberlyn',
    style: 'showboat',
    avatar: 'emberlyn',
    blurb: 'Flashes high cards just to be seen.',
  },
  {
    name: 'Cinder',
    style: 'rookHunter',
    avatar: 'cinder',
    blurb: 'Hunts the Bird and the painted two.',
  },
  { name: 'Gable', style: 'lastTrick', avatar: 'gable', blurb: 'Saves trump for the last pile.' },
  {
    name: 'Thistle',
    style: 'sandbag',
    avatar: 'thistle',
    blurb: 'Underbids, then plays tight defense.',
  },
  {
    name: 'Marrow',
    style: 'fourteenHold',
    avatar: 'marrow',
    blurb: 'Sits on 14s until the pile is fat.',
  },
  { name: 'Pebble', style: 'secondHandLow', avatar: 'pebble', blurb: 'Second to play, plays low.' },
  {
    name: 'Rookery',
    style: 'trumpDown',
    avatar: 'rookery',
    blurb: 'Leads cheap trump, not the ace.',
  },
  { name: 'Sable', style: 'shortLead', avatar: 'sable', blurb: 'Leads the shortest off color.' },
  { name: 'Finch', style: 'climbOnly', avatar: 'finch', blurb: 'Never opens. Only overcalls.' },
  {
    name: 'Dagger',
    style: 'trumpUp',
    avatar: 'dagger',
    blurb: 'Leads the highest trump it holds.',
  },
  { name: 'Willow', style: 'eggSitter', avatar: 'willow', blurb: 'Will not lead a counter.' },
  { name: 'Hearth', style: 'passFirst', avatar: 'hearth', blurb: 'Always passes the first chair.' },
  {
    name: 'Grit',
    style: 'nestDump',
    avatar: 'grit',
    blurb: 'Parks nest counters if the last trick looks lost.',
  },
  {
    name: 'Copper',
    style: 'fiveHunter',
    avatar: 'copper',
    blurb: 'Scoops every 5 that hits the felt.',
  },
  { name: 'Moth', style: 'thirdHandHigh', avatar: 'moth', blurb: 'Third to play, plays high.' },
  {
    name: 'Brandy',
    style: 'widowFiend',
    avatar: 'brandy',
    blurb: 'Buys a thin 100 just to see the nest.',
  },
  {
    name: 'Flint',
    style: 'honorCash',
    avatar: 'flint',
    blurb: 'Cashes a 1 the first chance it gets.',
  },
  { name: 'Ivy', style: 'bidOnce', avatar: 'ivy', blurb: 'Opens, then sits. Will not climb.' },
  { name: 'Shade', style: 'midRank', avatar: 'shade', blurb: 'Leads a middle card and waits.' },
  {
    name: 'Barrel',
    style: 'quietDealer',
    avatar: 'barrel',
    blurb: 'Tight when dealing. Loose left of dealer.',
  },
  {
    name: 'Spark',
    style: 'moonDreamer',
    avatar: 'spark',
    blurb: 'Looks for Shoot the Moon more than the book.',
  },
  {
    name: 'Nettle',
    style: 'colorStubborn',
    avatar: 'nettle',
    blurb: 'Names its pet color even when another is longer.',
  },
  {
    name: 'Cobalt',
    style: 'leftHandVoid',
    avatar: 'cobalt',
    blurb: 'Leads through LHO’s known void.',
  },
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
  return BOT_PERSONAS.find((p) => p.name === name) || null;
}

function hideBotStyleTip() {
  const tip = $('botStyleTip');
  if (tip) tip.classList.add('hidden');
}
function showBotStyleTip(name, ev) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  if (window.HORBidRepair737?.required()) {
    horToast('Finish your bid before viewing a player.');
    return false;
  }
  hideBotStyleTip();
  const p = horResolveCareerPlayer('', name) || (players || []).find((p) => p && p.name === name);
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
  const used = new Set((players || []).filter((p) => p && p.isBot).map((p) => p.name));
  let list = BOT_PERSONAS.filter((p) => !used.has(p.name));
  const d = typeof botDifficulty === 'string' ? botDifficulty : '';
  if (d === 'extreme' || d === 'hard') {
    list = list.filter((p) => p.style !== 'randomish' && p.style !== 'showboat');
  }
  return list;
}

function addBot(seat, personaPick, options835 = {}) {
  if (!isHost) return;
  if (seatedCount() >= 4) return;
  const target =
    typeof seat === 'number' && seat >= 0 && !playerAtSeat(seat) ? seat : firstEmptySeat();
  if (target < 0) return;
  let pool = availableBotPersonas();
  const favorite = isSoloPractice || roomCode === 'OFFLINE' ? favoritePartner042() : null;
  const partnerSeat = favoritePartnerSeat042();
  // Reserve the favorite for our partner rather than randomly seat them opposite us.
  if (!personaPick && favorite) {
    if (
      target === partnerSeat &&
      !(players || []).some((p) => p && p.isBot && p.name === favorite.name)
    )
      personaPick = favorite.name;
    else pool = pool.filter((p) => p.name !== favorite.name);
  }
  // Character Studio changes only the default offline cast pool; existing seat/random/favorite rules stay in control.
  if (!personaPick && (isSoloPractice || roomCode === 'OFFLINE'))
    pool = window.HORCharacterStudio077?.castPool(pool) || pool;
  let persona = null;
  if (personaPick) {
    persona =
      pool.find((p) => p.name === personaPick || p.name === (personaPick && personaPick.name)) ||
      BOT_PERSONAS.find(
        (p) => p.name === personaPick || p.name === (personaPick && personaPick.name)
      );
  }
  if (!persona)
    persona =
      pool[Math.floor(Math.random() * pool.length)] ||
      BOT_PERSONAS[botCount() % BOT_PERSONAS.length];
  if ((players || []).some((p) => p && p.isBot && p.name === persona.name)) return;
  // Human avatar priority: choose another whole persona, never dress a fixed bot as somebody else.
  const occupiedAvatars = new Set(
    (players || []).filter(Boolean).map((p) => playerAvatars[p.id] || p.avatar)
  );
  if (occupiedAvatars.has(persona.avatar)) {
    if (options835.strictChoice) {
      horToast(persona.name + ' is unavailable: that portrait is already seated.');
      return;
    }
    persona =
      pool.find(
        (p) =>
          !occupiedAvatars.has(p.avatar) &&
          !(players || []).some((x) => x && x.isBot && x.name === p.name)
      ) || availableBotPersonas().find((p) => !occupiedAvatars.has(p.avatar));
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
    careerPublic:
      horCareerModeOn() &&
      window.HORProgression &&
      HORProgression.localCareer &&
      HORProgression.localCareer.botPublicProfile
        ? HORProgression.localCareer.botPublicProfile(persona.name)
        : null,
  });
  playerAvatars[id] = players[players.length - 1].avatar;
  balanceTeams();
  try {
    broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats });
  } catch (e) {}
  updateWaitingUI();
  updateBotButtons();
  // Bot taking a lobby seat has its own seating cue. Keep this separate
  // from the selectable My Turn notification sounds.
  try {
    playSitSound();
  } catch (e) {}
}

function closeBotPicker() {
  const m = $('botPickerModal');
  if (m) m.classList.add('hidden');
}

function rankedBotPartners(pool) {
  const record = (p) => {
    try {
      const rel = window.HORProgression?.localCareer?.relationshipRead?.(p.name);
      const games = Math.max(0, Number(rel?.partnerGames) || 0);
      return { games, wins: Math.max(0, Math.min(games, Number(rel?.partnerWins) || 0)) };
    } catch (_) {
      return { games: 0, wins: 0 };
    }
  };
  const rows = pool.map((p, index) => ({ p, index, ...record(p) })),
    adjusted = (r) => (r.wins + 3) / (r.games + 6);
  rows.sort((a, b) =>
    !!a.games !== !!b.games
      ? a.games
        ? -1
        : 1
      : a.games
        ? adjusted(b) - adjusted(a) || b.games - a.games || a.index - b.index
        : Number(b.p.style === 'partnerFirst') - Number(a.p.style === 'partnerFirst') ||
          a.index - b.index
  );
  return rows;
}
function openBotPicker(seat, replaceBot = false) {
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
  grid.innerHTML = pool
    .map(({ p, games, wins }) => {
      const owner = players.find(
        (person) =>
          person && person.seat !== seat && (playerAvatars[person.id] || person.avatar) === p.avatar
      );
      const reason = owner ? 'Portrait already used by ' + (owner.name || 'a seated player') : '';
      return (
        '<button type="button" class="bot-pick' +
        (owner ? ' bot-unavailable835' : '') +
        '" data-bot="' +
        p.name +
        '"' +
        (owner ? ' disabled aria-disabled="true"' : '') +
        '>' +
        '<img src="' +
        avatarSrc(p.avatar) +
        '" alt="">' +
        '<b>' +
        p.name +
        '</b>' +
        '<i>' +
        (STYLE_TITLES[p.style] || p.style) +
        '</i>' +
        '<span>' +
        (reason
          ? escapeHtmlSafe(reason)
          : games
            ? wins +
              ' wins · ' +
              games +
              ' games · ' +
              Math.round((100 * wins) / games) +
              '% together'
            : 'Not yet partnered · ' + (STYLE_HOWTO[p.style] || p.blurb || '')) +
        '</span></button>'
      );
    })
    .join('');
  grid.querySelectorAll('.bot-pick').forEach((btn) => {
    btn.onclick = () => {
      const previous = replaceBot ? playerAtSeat(seat) : null;
      if (previous) {
        if (!isHost || !previous.isBot) return;
        players = players.filter((p) => p !== previous);
      }
      addBot(seat, btn.getAttribute('data-bot'), { strictChoice: true });
      if (previous && !playerAtSeat(seat)) {
        players.push(previous);
        updateWaitingUI();
      }
      closeBotPicker();
    };
  });
  const sheet = m.querySelector('.bot-picker-sheet');
  sheet?.classList.toggle('replacing-bot830', !!replaceBot);
  let remove = $('botPickerRemove830');
  if (!remove) {
    remove = document.createElement('button');
    remove.type = 'button';
    remove.id = 'botPickerRemove830';
    remove.textContent = 'Remove bot';
    sheet?.append(remove);
  }
  remove.hidden = !replaceBot;
  remove.onclick = () => {
    if (isHost && playerAtSeat(seat)?.isBot) removeBot(seat);
    closeBotPicker();
  };
  m.classList.remove('hidden');
}

function removeBot(seat) {
  if (!isHost) return;
  if (typeof seat === 'number') {
    const occ = playerAtSeat(seat);
    if (occ && occ.isBot) {
      players = players.filter((p) => p !== occ);
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
  try {
    broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats });
  } catch (e) {}
  updateWaitingUI();
  updateBotButtons();
}

function hostAdmitAndClaim(seat, playerId, nameHint) {
  if (!isHost || !playerId) return false;
  let who = (players || []).find((p) => p && p.id === playerId);
  const existed = !!who;
  if (!who) {
    who = {
      id: playerId,
      name:
        String(nameHint || 'Player')
          .trim()
          .slice(0, 18) || 'Player',
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
    players = (players || []).filter((p) => p && p.id !== playerId);
    try {
      broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats });
    } catch (e) {}
    try {
      updateWaitingUI();
    } catch (e) {}
  }
  return ok;
}

function hostClaimSeat(seat, playerId) {
  if (!isHost) return false;
  seat = parseInt(seat, 10);
  if (seat < 0 || seat > 3) return false;
  const who = (players || []).find((p) => p && p.id === playerId);
  if (!who || who.isBot) return false;
  const occ = playerAtSeat(seat);
  if (occ && occ.id === who.id) return true;
  if (occ && !occ.isBot) return false;
  // Free the chair this human is leaving first. Otherwise a second
  // "replace this bot" tap finds no empty seat and the bot is dropped.
  const fromSeat = typeof who.seat === 'number' ? who.seat : -1;
  if (fromSeat >= 0 && fromSeat !== seat) who.seat = -1;
  if (occ && occ.isBot) hostRelocateBot(occ, seat);
  const moved = fromSeat !== seat;
  who.seat = seat;
  who.team = seat % 2;
  if (who.id === myPeerId) myIndex = players.findIndex((p) => p && p.id === who.id);
  balanceTeams();
  try {
    broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats });
  } catch (e) {}
  updateWaitingUI();
  if (moved && who.id !== myPeerId) {
    try {
      playSitSound();
    } catch (e) {}
    try {
      const toastName = who.name || 'A player';
      horToast(
        occ && occ.isBot
          ? toastName + ' sat — ' + (occ.name || 'bot') + ' moved'
          : toastName + ' sat down'
      );
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
      try {
        playLobbySeatClickSound();
      } catch (e) {}
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
    const nm = (
      myName ||
      ($('welcome-player-name') && $('welcome-player-name').value) ||
      ($('hor-player-name') && $('hor-player-name').value) ||
      ''
    ).trim();
    hostConnection.send({ type: 'claimSeat', seat, id: myPeerId, name: nm });
  }
}

/** Set exact number of bots (0–3), filling remaining seats up to 4 total. */
function setBotCount(desired) {
  if (!isHost) return;
  desired = Math.max(0, Math.min(3, parseInt(desired, 10) || 0));
  const humans = players.filter((p) => !p.isBot).length;
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
  const add = (c) => {
    if (c && c.id) ids.add(c.id);
  };
  ((game && game.hands) || []).forEach((h) => (h || []).forEach(add));
  ((game && game.myHand) || []).forEach(add);
  return ids;
}
function freezeTopNestCard() {
  if (!game) return null;
  const nest = Array.isArray(game.nest) ? game.nest : [];
  const handIds = collectDealtHandIds();
  let card = null;
  for (let i = nest.length - 1; i >= 0; i--) {
    const c = nest[i];
    if (c && c.id && !handIds.has(c.id)) {
      card = c;
      break;
    }
  }
  if (card && handIds.has(card.id)) card = null;
  game.topNestCard = card ? hydrateNestCard(card) : null;
  return game.topNestCard;
}

function nestCountOnTable() {
  if (!game) return 0;
  if (
    (isPortraitViewport() || window.HORAngleC?.active()) &&
    window.__dealNest036 &&
    window.__dealNest036.token === dealAnimToken
  )
    return window.__dealNest036.count;
  if (game.nest && game.nest.length) return game.nest.length;
  if (typeof game.nestCount === 'number' && game.nestCount > 0) return game.nestCount;
  return (typeof nestSizeDefault === 'number' && nestSizeDefault) || 6;
}

function nestPileSignature() {
  const n = nestCountOnTable();
  const face = revealTopNest ? game && game.topNestCard : null;
  const stage = (game && game.nestFlipStage) || 0;
  return [n, face && face.id, stage, !!(game && game.phase)].join('|');
}
function hydrateNestCard(card) {
  if (!card) return null;
  let color = card.color;
  let rank = card.rank;
  let id = card.id;
  if ((!color || rank == null || rank === '') && id) {
    if (id === 'rook') {
      color = 'rook';
      rank = 99;
    } else if (id === 'red-2') {
      color = 'red';
      rank = 2;
    } else if (id === 'red1-special') {
      color = 'red';
      rank = 1;
    } else {
      const m = String(id).match(/^([a-z]+)-(\d+)$/i);
      if (m) {
        color = m[1].toLowerCase();
        rank = parseInt(m[2], 10);
      }
    }
  }
  if (!id && color && rank != null) id = color === 'rook' ? 'rook' : color + '-' + rank;
  return {
    color: color || 'black',
    rank: rank != null ? rank : '?',
    id: id || (color || 'x') + '-' + rank,
    specialRed1: !!(card.specialRed1 || id === 'red1-special'),
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
  const inner = typeof cardInnerHTML === 'function' ? cardInnerHTML(card) : '';
  return '<div class="card-face nest-face-up nest-stay-face ' + cls + ' small">' + inner + '</div>';
}

function renderTopNestPeek() {
  try {
    return renderTopNestPeekContent033();
  } finally {
    applyNestScatter037();
    restoreNestPlacement039();
    scheduleNestAlignment033();
    window.HORNestReveal838?.sync();
  }
}
function renderTopNestPeekContent033() {
  const bar = $('topNestPeek');
  if (bar) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
  }
  const el = $('nestArea');
  if (!el) return;
  const phaseOk = !!(game && (game.phase === 'bidding' || game.phase === 'dealing'));
  const n = nestCountOnTable();
  // Rook584: after the reveal has completed and the auction is open, the Nest
  // must stay off the felt. This guard prevents later renders from resurrecting it.
  const revealFinished = !!(
    game &&
    revealTopNest &&
    game.nestAuctionOpen &&
    (game.nestFlipped || (game.nestFlipStage || 0) >= 2)
  );
  if (!phaseOk || n < 1) {
    el.classList.add('hidden');
    el.innerHTML = '';
    window._horNestPileSig = '';
    try {
      document.body.classList.remove('nest-on-felt');
    } catch (e) {}
    return;
  }
  let face = revealTopNest ? pinnedNestRevealFace() : null;
  const stage = (game && game.nestFlipStage) || 0;
  if (revealTopNest && !face) {
    face = freezeTopNestCard();
  }
  if (face) pinNestRevealFace(face);

  const showFace = !!(face && revealTopNest);
  const faceUp = !!(showFace && (game.nestFlipped || stage >= 2));
  const flipping = !!(showFace && stage === 1 && !faceUp);
  el.classList.remove('hidden');
  try {
    document.body.classList.add('nest-on-felt');
  } catch (e) {}

  if (faceUp) {
    const staySig = 'stay:' + (face && face.id) + ':' + n;
    const stayEl = el.querySelector('.nest-stay-face');
    if (
      window._horNestPileSig === staySig &&
      stayEl &&
      stayEl.querySelector('.c-num, .rook-bird-img, .red2-img, .c-stack')
    )
      return;
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
        requestAnimationFrame(() => {
          try {
            flip.classList.add('is-turning', 'is-reveal');
          } catch (e) {}
        });
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
    html +=
      '<div class="table-nest-flip">' +
      '<div class="table-nest-flip-inner">' +
      '<div class="card-back table-nest-flip-back"></div>' +
      nestFaceMarkup(face).replace(' nest-stay-face', ' table-nest-flip-face') +
      '</div></div>';
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
        try {
          flip.classList.add('is-turning', 'is-reveal');
        } catch (e) {}
      });
      // Rook542: make the face state explicit after the physical turn crosses halfway.
      // This avoids a browser/WebView leaving the back visually on top for the full reveal.
      setTimeout(() => {
        try {
          if (flip && flip.isConnected && game && game.nestFlipStage === 1)
            flip.classList.add('is-face');
        } catch (e) {}
      }, 480);
    }
  }
}

function renderWidowSpread() {
  const el = $('widowSpread');
  if (!el) return;
  const phaseOk = !!(game && (game.phase === 'discard' || game.phase === 'trump'));
  const cards = openWidow && game && Array.isArray(game.widowSpread) ? game.widowSpread : [];
  if (!phaseOk || !cards.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  const faces = cards
    .map((c) => {
      const cls = typeof cardClass === 'function' ? cardClass(c) : '';
      const inner = typeof cardInnerHTML === 'function' ? cardInnerHTML(c) : c.rank || c.id || '?';
      return '<div class="card-face ' + cls + ' widow-card">' + inner + '</div>';
    })
    .join('');
  el.classList.remove('hidden');
  el.innerHTML =
    '<span class="widow-spread-label">Widow</span><div class="widow-spread-row">' +
    faces +
    '</div>';
}

const HOR_VISUAL_THEMES = ['classic', 'royal', 'modern', 'coin', 'low', 'signature'];
const HOR_TRUMP_FX = ['hard', 'flash', 'spin', 'punch', 'slide', 'crest', 'bounce'];
let horDiagnosticPreviewIndex = null;
function horCurrentHandVisualIndex() {
  return Math.max(
    0,
    Array.isArray(handHistory) ? handHistory.length : Number((matchStats && matchStats.hands) || 0)
  );
}

function horSetThemeIndex(idx, preview) {
  idx = (((Number(idx) || 0) % 42) + 42) % 42;
  if (preview) horDiagnosticPreviewIndex = idx;
  const theme = HOR_VISUAL_THEMES[idx % HOR_VISUAL_THEMES.length],
    fx = HOR_TRUMP_FX[idx % HOR_TRUMP_FX.length];
  HOR_VISUAL_THEMES.forEach((t) =>
    document.body.classList.toggle('hor-bid-theme-' + t, t === theme)
  );
  document.body.dataset.horHandTheme = theme;
  document.body.dataset.horTrumpFx = fx;
  return { idx, theme, fx };
}
function horApplyHandTheme() {
  // A real new hand always restores live-hand authority; manual diagnostic previews never change game state.
  horDiagnosticPreviewIndex = null;
  return horSetThemeIndex(horCurrentHandVisualIndex(), false);
}

function openNestAuction() {
  if (!game) return;

  // Rook561: authoritative per-hand visual owner. Legacy/default is never a rotation entry.
  try {
    horApplyHandTheme();
  } catch (e) {}
  if (game.nestAuctionOpen && !nestAuctionLocked()) {
    try {
      if (isHost) hostPromptBid();
    } catch (e) {}
    return;
  }
  game.nestAuctionOpen = true;
  if (revealTopNest) {
    game.nestFlipStage = 2;
    game.nestFlipped = true;
    window._horNestPileSig = '';
    // Rook585: once bidding opens, keep ONLY the revealed top Nest card.
    // The other five visual backs disappear; underlying Nest state is untouched.
    try {
      renderTopNestPeek();
    } catch (e) {}
  }
  try {
    broadcastState();
  } catch (e) {}
  try {
    if (isHost) {
      showBiddingIntro(() => {
        try {
          hostPromptBid();
        } catch (e) {}
      });
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
    try {
      renderTopNestPeek();
    } catch (e) {}
    return;
  }
  if (!revealTopNest) {
    game.nestAuctionOpen = true;
    game.nestFlipStage = 0;
    game.nestFlipped = false;
    try {
      renderTopNestPeek();
    } catch (e) {}
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

  const handKey =
    String(game.handNumber || 0) + ':' + String(game.dealer) + ':' + String(face.id || '');
  if (window._horNestFlipHand === handKey && (game.nestFlipStage || 0) > 0) return;
  window._horNestFlipHand = handKey;
  const tok = (window._horNestFlipTok = (window._horNestFlipTok || 0) + 1);

  game.nestAuctionOpen = false;
  game.nestFlipStage = 0;
  game.nestFlipped = false;
  window._horNestPileSig = '';
  try {
    ensureAudio();
  } catch (e) {}
  try {
    renderTopNestPeek();
  } catch (e) {}
  try {
    broadcastState();
  } catch (e) {}

  // Give the face-down nest a short readable beat, then perform the actual turn.
  setTimeout(
    () => {
      if (tok !== window._horNestFlipTok || !game) return;
      if (game.phase !== 'bidding' && game.phase !== 'dealing') return;
      game.nestFlipStage = 1;
      game.nestFlipped = false;
      window._horNestPileSig = '';
      try {
        renderTopNestPeek();
      } catch (e) {}
      try {
        broadcastState();
      } catch (e) {}
      try {
        playNestRevealSequence();
      } catch (e) {}

      // The CSS reveal is 1.8 s. Do not replace the animated card with the stationary
      // face until that complete interval has elapsed.
      setTimeout(
        () => {
          if (tok !== window._horNestFlipTok || !game) return;
          game.nestFlipStage = 2;
          game.nestFlipped = true;
          window._horNestPileSig = '';
          try {
            renderTopNestPeek();
          } catch (e) {}
          try {
            broadcastState();
          } catch (e) {}
        },
        solScaledDelay(1800, 0)
      );

      setTimeout(
        () => {
          if (tok !== window._horNestFlipTok || !game) return;
          try {
            openNestAuction();
          } catch (e) {}
        },
        solScaledDelay(1900, 0)
      );
    },
    solScaledDelay(420, 0)
  );
}

function updateWaitingUI() {
  const list = $('playersList');
  if (list) list.innerHTML = '';
  const teamA = typeof teamLabel === 'function' ? teamLabel(0) : 'Griffin';
  const teamB = typeof teamLabel === 'function' ? teamLabel(1) : 'Raven';
  for (let s = 0; s < 4; s++) {
    const el = $('waitSeat' + s);
    if (!el) continue;
    const p = playerAtSeat(s);
    if (p && !p.isBot)
      try {
        refreshHumanPersona(p);
      } catch (e) {}
    el.classList.toggle('occupied', !!p);
    el.classList.toggle('is-me', !!(p && p.id === myPeerId));
    el.classList.toggle('is-bot', !!(p && p.isBot));
    if (p && p.isBot && p.name) el.setAttribute('data-botname', p.name);
    else el.removeAttribute('data-botname');
    if (p) {
      const tag = p.isHost ? 'Host' : p.isBot ? 'Bot' : 'Sat';
      const face = p.avatar
        ? '<img class="wait-seat-av" src="' + avatarSrc(p.avatar) + '" alt="">'
        : '';
      const seatTag =
        p.isBot && !isHost ? 'Bot · tap to replace' : tag + ' · ' + (s % 2 === 0 ? teamA : teamB);
      el.innerHTML =
        face +
        '<span class="wait-seat-name"' +
        botNameAttr(p) +
        '><span class="wait-seat-name-text">' +
        escapeHtmlSafe(p.name) +
        '</span>' +
        horCareerBadgeHtml(p) +
        '</span>' +
        '<span class="wait-seat-tag">' +
        seatTag +
        '</span>';
    } else if (isHost) {
      el.innerHTML =
        '<span class="wait-seat-name">Open</span>' +
        '<span class="wait-seat-tag">Tap to seat a bot</span>';
    } else {
      el.innerHTML =
        '<span class="wait-seat-name">Sit</span>' +
        '<span class="wait-seat-tag">Tap to take this chair</span>';
    }
    try {
      horBindCareerBadges(el);
    } catch (e) {}
    el.onclick = (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-botname]') && e._botStyleHeld)
        return;
      onWaitSeatClick(s);
    };
  }
  try {
    applyPlaqueColors();
  } catch (e) {}
  try {
    updateWelcomeSeats();
  } catch (e) {}
  const humans = players.filter((p) => p && !p.isBot && p.seat >= 0).length;
  const bots = players.filter((p) => p && p.isBot).length;
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
    fillHint.textContent =
      empty > 0
        ? `Need ${empty} more seat${empty === 1 ? '' : 's'}: invite friends or set Bots to ${bots + empty}.`
        : '';
    fillHint.classList.toggle('hidden', empty <= 0);
  }
  if (isHost) updateBotButtons();

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
  try {
    horMarkActiveTable(true);
  } catch (e) {}
  try {
    document.body.classList.add('in-game');
    document.body.classList.remove('at-table', 'at-welcome');
  } catch (e) {}
  hideWelcomeScreen();
  if (lobby) lobby.classList.add('hidden');
  if (waiting) waiting.classList.add('hidden');
  if (game && game.phase && game.phase !== 'score') {
    try {
      hideCelePage();
    } catch (e) {}
  }
  if (gameScreen) gameScreen.classList.remove('hidden');
  releaseGameOrientationLock();
  setTimeout(syncLandscapeFullscreen, 80);
  try {
    syncPortraitLast3Button();
  } catch (e) {}
  try {
    requestAnimationFrame(() => {
      try {
        positionPortraitLast3Btn();
      } catch (e) {}
    });
  } catch (e) {}
  try {
    setTimeout(() => {
      try {
        positionPortraitLast3Btn();
      } catch (e) {}
    }, 250);
  } catch (e) {}
  setTimeout(() => fadeSeatMugs(true), 1100);
  try {
    updatePracticeBadge();
  } catch (e) {}
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
  const total = totalCountersInDeck(),
    goal = game?.targetScore || targetScore;
  const line = (title, text) => '<p><b>' + title + '</b> ' + text + '</p>';
  body.innerHTML = [
    line(
      'Teams & winning.',
      'Four players, partners opposite. Reach ' +
        goal +
        ' points to win. A team at or below −' +
        goal +
        ' loses; a team reaching the positive target takes precedence. If both reach a target in the same hand, the higher score wins; equal scores tie.'
    ),
    line(
      'Deal & bidding.',
      'Each player receives ' +
        handSize +
        ' cards, with ' +
        nestSizeDefault +
        ' in the nest. Minimum bid: ' +
        minBid +
        '. Bid any amount divisible by five above the current bid, or pass. You may raise by 5, 10, 15, 20, 25 or more. Tap or hold +5 and −5 to choose the amount, then confirm your bid. The highest bidder takes the nest, discards back to ' +
        handSize +
        ' cards, and chooses trump.'
    ),
    line(
      'First lead.',
      ({
        bidder: 'The bid winner',
        leftOfBidder: 'The player to the left of the bid winner',
        rightOfBidder: 'The player to the right of the bid winner',
      }[leadOrder] || 'The bid winner') + ' leads the first trick. Each trick winner leads next.'
    ),
    line(
      'Following color.',
      'Follow the led color when you can. ' +
        (specialsAnytime
          ? 'The included special cards may be played at any time.'
          : 'Included special cards follow the same legal-play rules as the other cards.') +
        ' ' +
        (mustTrumpWhenVoid
          ? 'If you cannot follow color, you must play trump when you have one.'
          : 'If you cannot follow color, you may play another legal card.')
    ),
    line(
      'Winning tricks.',
      'The highest trump wins a trick containing trump; otherwise the highest card of the led color wins. ' +
        (includeOnes
          ? onesHigh
            ? '1 is highest in its color.'
            : '1 is low in its color.'
          : '1s are not included.') +
        ' ' +
        (includeRook
          ? 'The Bird is ' + (rookLowest ? 'lowest' : 'above ordinary') + ' trump.'
          : 'The Bird is not included.')
    ),
    line(
      'Special trump order.',
      (includeRed1 ? 'Special Red One is highest. ' : '') +
        (includeRook && !rookLowest ? 'The Bird beats Red Two and ordinary trump. ' : '') +
        (includeRed2 ? 'Red Two is permanent trump and beats ordinary trump. ' : '') +
        (includeRook && rookLowest ? 'The Bird is lowest trump. ' : '')
    ),
    line(
      'Card points.',
      '5s score 5; 10s and 14s score 10. ' +
        (includeOnes ? 'Each 1 scores 15. ' : '') +
        (includeRook ? 'The Bird scores 20. ' : '') +
        (includeRed2 ? 'Red Two is ON and scores ' + red2Points + '. ' : 'Red Two is OFF. ') +
        (includeRed1 ? 'Special Red One scores 30. ' : '') +
        'Total available: ' +
        total +
        ' points.'
    ),
    line(
      'Nest & reveal.',
      'Nest points go to ' +
        (nestGoesTo === 'bidder' ? 'the bidding team.' : 'the team taking the last trick.') +
        ' Show Top Nest Card is ' +
        (revealTopNest
          ? 'ON: everyone sees the top nest card during bidding.'
          : 'OFF: no top nest card is shown during bidding.') +
        ' ' +
        (openWidow
          ? 'The full nest is revealed to everyone when picked up.'
          : 'The full nest is not shown to opponents when picked up.')
    ),
    line(
      'Scoring a bid.',
      'Capture at least the bid in points. Make it: your team scores ' +
        (bidOnlyScoring ? 'the bid amount only.' : 'all points it captured.') +
        ' Miss it: your team loses the bid amount. Opponents score the points they captured.'
    ),
    line(
      'Shoot the Moon.',
      shootMoonEnabled
        ? 'Bid all ' +
            total +
            ' available points. Your team must capture every point; losing a zero-point trick is allowed. Make it: your team wins the entire game immediately. Miss it: your team loses ' +
            total +
            ' points and opponents score only the points they captured.'
        : 'Shoot the Moon is OFF at this table.'
    ),
    line(
      'Other table rules.',
      (screwTheDealer
        ? 'If everyone passes, the dealer must bid the minimum.'
        : 'If everyone passes, the hand is redealt.') +
        ' ' +
        (misdealOnNoCounters
          ? 'A hand with no point cards causes a redeal.'
          : 'A hand with no point cards does not force a redeal.') +
        ' ' +
        (comebackSpecialChance
          ? 'The selected comeback special-card assist is ON.'
          : 'Comeback special-card assist is OFF.') +
        ' ' +
        (layDownWinningCards
          ? 'A player may use the existing lay-down action when the remaining tricks are guaranteed.'
          : '')
    ),
  ].join('');
}

function playToastClink() {
  playNatural063('clink', 0.65);
}

function playTableToast(done) {
  const waitingOn = waiting && !waiting.classList.contains('hidden');
  const felt = waitingOn ? $('waitingFelt') : document.querySelector('#gameScreen .table-felt');
  if (felt) {
    felt.classList.remove('toasting');
    void felt.offsetWidth;
    felt.classList.add('toasting');
  }
  try {
    playToastClink();
  } catch (e) {}
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
  try {
    broadcast({ type: 'tableToast' });
  } catch (e) {}
  playTableToast(() => {
    try {
      hostStartGame();
    } catch (e) {
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

function validateRuleSetup() {
  if (minBid > maxBid()) {
    const message =
      'Minimum bid ' +
      minBid +
      ' exceeds the ' +
      maxBid() +
      ' points in this deck. Lower the minimum bid or include more point cards in Game Setup.';
    const out = $('messageArea');
    if (out) out.textContent = message;
    alert(message);
    return false;
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
    alert(
      `Need 4 players at the table (currently ${seatedCount()} seated).\n\nFriends tap an open seat, or tap an empty chair to seat a bot.`
    );
    return;
  }

  if (!validateRuleSetup()) return;
  // Apply only at a new game boundary; never replace a human or mutate a live hand.
  applyFavoritePartner042();
  // Seat order is the table: 0 bottom host side, 1 left, 2 partner, 3 right
  packPlayersBySeat();
  players = players.filter((p) => p && p.seat >= 0).slice(0, 4);
  players.forEach((p, i) => {
    p.team = i % 2;
  });
  broadcast({ type: 'players', players: publicPlayersSnapshot() });

  try {
    targetScore = readTargetScoreFromUI();
  } catch (e) {
    const tsEl = $('opt-target-score');
    if (tsEl) targetScore = normalizeTargetScore(parseInt(tsEl.value, 10) || 500);
  }
  const bdEl = $('opt-bot-difficulty');
  if (bdEl) botDifficulty = bdEl.value || 'extreme';
  // Sync coach options from UI at deal time
  try {
    const pnk = $('opt-partner-never-kill');
    if (pnk) partnerNeverKill = !!pnk.checked;
    const pfl = $('opt-partner-feed-last');
    if (pfl) partnerFeedLast = !!pfl.checked;
    const dsp = $('opt-dont-steal-bid');
    if (dsp) dontStealPartnerBid = !!dsp.checked;
    const lbh = $('opt-landscape-hints');
    if (lbh) landscapeBidHints = !!lbh.checked;
    const nla = $('opt-nest-anim');
    if (nla) nestLastTrickAnim = !!nla.checked;
    const ldw = $('opt-lay-down');
    if (ldw) layDownWinningCards = ldw.checked !== false;
  } catch (e) {}
  handHistory = [];
  matchStats = freshMatchStats();
  resetPlayerStats();
  pendingCele = null;
  recentTricks = [];
  matchTricks = [];
  lastCompletedTrick = null;
  lastCompletedTrickWinner = null;
  try {
    hideCelePage();
  } catch (e) {}

  try {
    horMarkActiveTable(true);
  } catch (e) {}
  window._horStayInGame = true;
  game = {
    phase: 'deal',
    careerMatchId: crypto.randomUUID(),
    careerExtras: [{}, {}, {}, {}],
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
  return false;
}

function showHostGameTools(on) {
  document
    .querySelectorAll('.host-only')
    .forEach((el) => el.classList.toggle('hidden', !(on && isHost)));
}

function clearTableForShuffle() {
  try {
    window._ltShowRemaining = false;
    landscapeLastSummary = null;
    recentTricks = [];
    lastCompletedTrick = null;
    lastCompletedTrickWinner = null;
  } catch (e) {}
  const wipe = (id) => {
    const el = $(id);
    if (el) el.innerHTML = '';
  };
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
    document
      .querySelectorAll('.player-slot .played-card, .player-slot .trick-card-wrap')
      .forEach((n) => {
        try {
          n.remove();
        } catch (e) {}
      });
    if (game) {
      game.myHand = [];
      game.trick = [];
      game.trump = null;
      if (game.phase === 'score') game.phase = 'dealing';
      game._firstBidTurnSounded = false;
    }
    try {
      clearTrumpBanners();
    } catch (e) {}
    try {
      updateLandscapeTheater();
    } catch (e) {}
    try {
      window.HORCharacterStudio077?.sync();
    } catch (e) {
      console.warn('Character presentation:', e);
    }
  } catch (e) {}
}

function hostDeal() {
  try {
    clearTableForShuffle();
  } catch (e) {}
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
  if (high - low <= goal * 0.75) return;

  const losingTeam = Number(scores[0] || 0) < Number(scores[1] || 0) ? 0 : 1;
  const losingSeats = players
    .map((p, i) => {
      const team = p && typeof p.team === 'number' ? p.team : i % 2;
      return team === losingTeam ? i : -1;
    })
    .filter((i) => i >= 0 && Array.isArray(game.hands[i]));
  if (!losingSeats.length) return;

  const specials = [];
  if (includeRook) specials.push((c) => c && (c.id === 'rook' || c.color === 'rook'));
  if (includeRed2)
    specials.push((c) => c && (typeof isRed2 === 'function' ? isRed2(c) : c.id === 'red-2'));
  if (includeRed1) specials.push((c) => c && (c.id === 'red1-special' || c.specialRed1 === true));

  // A normal deal gives each included special the same chance of landing in
  // either partnership's player hands. Boost that existing probability by 25%
  // rather than replacing it with a flat 25% roll.
  const totalPlayerCards = game.hands.reduce((n, h) => n + (Array.isArray(h) ? h.length : 0), 0);
  const losingPlayerCards = losingSeats.reduce((n, i) => n + game.hands[i].length, 0);
  const normalOdds = totalPlayerCards > 0 ? losingPlayerCards / totalPlayerCards : 0;
  const boostedOdds = Math.min(1, normalOdds * 1.25);
  if (!(boostedOdds > 0)) return;

  const moveSpecialToLosingTeam = (predicate) => {
    const alreadyThere = losingSeats.some((i) => game.hands[i].some(predicate));
    if (alreadyThere) return;

    // Only use the hidden boost when the normal deal did not already give it
    // to the losing team. The conditional probability below makes the final
    // chance equal to normalOdds * 1.25, not a separate 25% chance.
    const correction = (boostedOdds - normalOdds) / Math.max(0.000001, 1 - normalOdds);
    if (Math.random() >= correction) return;

    let source = null,
      sourceIndex = -1;
    for (let i = 0; i < game.hands.length; i++) {
      if (losingSeats.includes(i)) continue;
      const hand = game.hands[i];
      if (!Array.isArray(hand)) continue;
      const idx = hand.findIndex(predicate);
      if (idx >= 0) {
        source = hand;
        sourceIndex = idx;
        break;
      }
    }
    if (!source || sourceIndex < 0) {
      const nest = Array.isArray(game.nest) ? game.nest : [];
      const idx = nest.findIndex(predicate);
      if (idx >= 0) {
        source = nest;
        sourceIndex = idx;
      }
    }
    if (!source || sourceIndex < 0) return;

    const recipient = losingSeats[Math.floor(Math.random() * losingSeats.length)];
    const hand = game.hands[recipient];
    const special = source.splice(sourceIndex, 1)[0];
    if (!hand.length) {
      hand.push(special);
      return;
    }
    const dumpIndex = Math.floor(Math.random() * hand.length);
    source.push(hand[dumpIndex]);
    hand[dumpIndex] = special;
  };

  specials.forEach(moveSpecialToLosingTeam);
}

function hostDealNow() {
  if (game) game.networkHand844 = crypto.randomUUID();
  window.HORBidVoice801?.stop();
  recentTricks = [];
  lastCompletedTrick = null;
  lastCompletedTrickWinner = null;
  landscapeLastSummary = null;
  window._ltShowRemaining = false;
  try {
    const endEl = $('ltEndGame');
    if (endEl) {
      endEl.classList.add('hidden');
      endEl.innerHTML = '';
    }
  } catch (e) {}
  if (game) {
    game.topNestCard = null;
    game.nestFlipStage = 0;
    game.nestFlipped = false;
  }
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

  try {
    applyComebackSpecialChance();
  } catch (e) {}
  for (let i = 0; i < 4; i++) {
    sortCardsDisplay(game.hands[i]);
  }
  try {
    freezeTopNestCard();
  } catch (e) {
    game.topNestCard = null;
  }

  // House rule: misdeal & redeal if any hand has zero counter cards (no)
  // 5/10/14/one/Rook/Red 1/Red 2 at all) — nobody could bid meaningfully.
  // Bounded retry count so a pathological deck config can't loop forever.
  if (misdealOnNoCounters) {
    const anyHandLacksCounters = game.hands.some((h) => !h.some((c) => cardPoints(c) > 0));
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
  try {
    clearTrumpBanners();
  } catch (e) {}
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
  try {
    clearClaimOverlays();
  } catch (e) {
    window._claimAnimPlaying = false;
    try {
      const lay = $('claimLaydownLayer');
      if (lay && lay.parentNode) lay.parentNode.removeChild(lay);
    } catch (e2) {}
  }

  try {
    showGame();
  } catch (e) {}
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
  const myHandCopy = (game.hands[myIndex] || []).map((c) => ({ ...c }));
  players.forEach((p, i) => {
    if (p.isBot) return;
    if (p.id === myPeerId) return;
    const handCopy = (game.hands[i] || []).map((c) => ({ ...c }));
    sendTo(p.id, { type: 'privateHand', hand: handCopy, animateDeal: true });
  });

  const finishDeal = () => {
    if (!game) return;
    game.phase = 'bidding';
    game.myHand = (game.hands[myIndex] || []).map((c) => ({ ...c }));
    try {
      applyFirstHandChrome();
    } catch (e) {}
    try {
      renderTopNestPeek();
    } catch (e) {}
    broadcastState();
    try {
      scheduleTopNestFlip();
    } catch (e) {}
    setTimeout(
      () => {
        try {
          if (game && game.phase === 'bidding' && !game.nestAuctionOpen) openNestAuction();
        } catch (e) {}
      },
      solScaledDelay(2800, 120)
    );
    if (revealTopNest) return;
    try {
      showBiddingIntro(() => {
        try {
          hostPromptBid();
        } catch (e) {
          console.error(e);
        }
      });
      broadcast({ type: 'biddingIntro', minBid: minBid || 100 });
    } catch (e) {
      try {
        hostPromptBid();
      } catch (e2) {}
    }
  };

  if (myIndex >= 0 && myHandCopy.length) {
    runDealPresentation(myHandCopy, finishDeal);
  } else {
    // Spectator host edge case — still wait shuffle length then continue
    setTimeout(
      finishDeal,
      solScaledDelay(
        shuffleAnimDuration762() + hs * (isPortraitViewport() ? 122 * 4 : CARD_DEAL_MS) + 200,
        120
      )
    );
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
  return game.bidStatus.filter((s) => s === 'pass').length;
}

// Shared "everyone passed" handler: normally redeals, but with the "Screw
// the Dealer" house rule the dealer is forced to take the bid at the
// minimum instead, so the hand keeps moving instead of reshuffling.
function hostHandleAllPassed() {
  if (screwTheDealer) {
    const d = game.dealer;
    const dname = (players[d] && players[d].name) || 'P' + (d + 1);
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
    try {
      playSfx('bid', { broadcastNet: true });
    } catch (e) {}
    finishBidding();
  } else {
    $('messageArea').textContent = 'All passed – redealing…';
    broadcast({ type: 'message', text: 'All passed – redealing…' });
    setTimeout(() => hostDeal(), 1500);
  }
}

function hostPromptBid() {
  try {
    renderTopNestPeek();
  } catch (e) {}
  if (!game || game.paused) return;
  if (nestAuctionLocked()) {
    const msg = 'Watch the nest…';
    try {
      const ma = $('messageArea');
      if (ma) ma.textContent = msg;
    } catch (e) {}
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
      if (!hasPassedBid(i)) {
        onlyBidderLeft = false;
        break;
      }
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

  if (game.currentPlayer === myIndex) {
    showBidUI();
    try {
      maybeRemindTurn();
    } catch (e) {}
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
    buttons.innerHTML = COLORS.map(
      (c) =>
        `<button type="button" class="btn trump-btn ${c}" data-trump="${c}">${COLOR_NAMES[c]}</button>`
    ).join('');
    buttons.querySelectorAll('[data-trump]').forEach((btn) => {
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
    ? $('ltHandWrap') || $('ltHand') || document.querySelector('.lt-hand-wrap')
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

function syncLandscapeBidBar() {}

function syncWaitBanners() {
  // Rook584: retire the two large portrait/landscape waiting rectangles.
  // The existing seat-owned transient pill is the single status owner.
  try {
    const pt = $('ptWaitBanner');
    if (pt) pt.classList.add('hidden');
    const lt = $('ltKittyWait');
    if (lt) lt.classList.add('hidden');
    document.body.classList.remove('pt-wait-open', 'lt-wait-open');
  } catch (e) {}

  try {
    const el = $('botThinking');
    const phase = game && game.phase;
    const waiting = !!(
      game &&
      (phase === 'discard' || phase === 'trump') &&
      game.bidder !== myIndex &&
      !isSpectator
    );
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

let bidDraft839 = null;
function showBidUI(options = {}) {
  const draftKey839 = [
    roomCode,
    myIndex,
    game?.dealer,
    auctionHigh(),
    discardFlowIdentity(game?.myHand, myIndex),
  ].join('~');
  const retainedSelection832 = bidDraft839?.key === draftKey839 ? bidDraft839.value : NaN;
  try {
    if (window.HORBidRepair737?.required()) {
      const tip = $('botStyleTip');
      if (tip && !tip.classList.contains('hidden')) {
        hideBotStyleTip();
        horToast('Your bid is due. Player details are available after bidding.');
      }
    }
  } catch (e) {}
  if (nestAuctionLocked()) return;

  const nextMin = auctionNextMin();
  const ceiling = bidCeilingFor(myIndex) || 180;
  let suggested = Math.min(ceiling, Math.max(nextMin, parseInt(minBid, 10) || 100));
  if (!Number.isFinite(suggested)) suggested = nextMin;
  if (
    Number.isSafeInteger(retainedSelection832) &&
    retainedSelection832 % 5 === 0 &&
    retainedSelection832 >= nextMin &&
    retainedSelection832 <= ceiling
  )
    suggested = retainedSelection832;
  _ltBidSuggested = suggested;

  const bidderName = (players[myIndex] && players[myIndex].name) || myName || 'Player';
  const html = `<div class="moon-bid-plaque" id="moonBidPlaque" hidden role="note"><img src="assets/moon-plaque/concept-a.png" alt="" aria-hidden="true" draggable="false"><div class="moon-bid-copy"><strong id="moonBidPoints"></strong><span>Win the game</span><span id="moonBidLoss"></span></div><div class="moon-bid-mount moon-bid-mount-left" aria-hidden="true"><img src="assets/bidbox-moon-review/gold-connector.png" alt="" draggable="false"></div><div class="moon-bid-mount moon-bid-mount-right" aria-hidden="true"><img src="assets/bidbox-moon-review/gold-connector.png" alt="" draggable="false"></div></div><div class="bid-console-title"><img class="bid-title-griffin-left" src="assets/images/griffin-icon.png?v=635" alt=""><span>PLACE YOUR BID</span><img class="bid-title-griffin-right" src="assets/images/griffin-icon.png?v=635" alt=""></div>
      <div class="felt-bid-name">${bidderName}</div>
      <div class="bid-meta" aria-hidden="true"></div>
      <div class="bid-stepper">
        <button type="button" class="btn" id="bidMinus" aria-label="Lower bid">−5</button>
        <span id="bidValue" aria-live="polite" aria-label="Selected bid" class="bid-value${isShootMoonBid(suggested) ? ' is-moon' : ''}">${suggested}</span>
        <button type="button" class="btn" id="bidPlus" aria-label="Raise bid">+5</button>
      </div>
      <div class="bid-buttons">
        <button class="btn primary${isShootMoonBid(suggested) ? ' bid-shoot-moon' : ''}" id="bidConfirm">${isShootMoonBid(suggested) ? '<img class="moon-approved-button795" src="assets/images/shoot-moon-crescent-approved.png" alt="Shoot the Moon">' : 'Bid <span id="bidConfirmVal">' + suggested + '</span>'}</button>
        <button class="btn danger" id="bidPassBtn">Pass</button>
      </div>`;
  const dock = $('decisionConsole');
  if (dock) {
    dock.classList.remove('decision-mode-trump');
    dock.classList.add('decision-mode-bid');
    dock.style.left = '';
    dock.style.top = '';
    dock.style.transform = '';
  }
  const panel = $('actionPanel');
  try {
    hideActionPanel();
  } catch (e) {}
  try {
    const oldBar = $('ltBidBar');
    if (oldBar) oldBar.classList.add('hidden');
  } catch (e) {}
  if (panel) {
    panel.classList.add('hidden');
    panel.classList.remove('trump-showdown');
    panel.innerHTML = '';
  }
  if (dock) {
    dock.innerHTML = html;
    dock.classList.remove('hidden');
  }
  {
    const valEl = $('bidValue');
    const confBtn = $('bidConfirm');
    const sync = () => {
      // Keep the fixed slot, but remove an unavailable raise action at the ceiling.
      if (plus) {
        const atCeiling = suggested >= ceiling;
        plus.disabled = atCeiling;
        plus.style.setProperty('visibility', atCeiling ? 'hidden' : 'visible', 'important');
        plus.setAttribute('aria-hidden', String(atCeiling));
      }
      if (valEl) {
        valEl.textContent = String(suggested);
        valEl.classList.toggle('is-moon', isShootMoonBid(suggested));
      }
      if (confBtn) {
        confBtn.disabled =
          !Number.isSafeInteger(suggested) ||
          suggested % 5 !== 0 ||
          suggested < nextMin ||
          suggested > ceiling;
        confBtn.setAttribute(
          'data-live-bid',
          Number.isSafeInteger(suggested) ? String(suggested) : ''
        );
        if (!Number.isSafeInteger(suggested) || suggested % 5 !== 0) {
          confBtn.textContent = 'Use multiples of 5';
          confBtn.classList.remove('bid-shoot-moon');
        } else if (isShootMoonBid(suggested)) {
          confBtn.innerHTML =
            '<img class="moon-approved-button795" src="assets/images/shoot-moon-crescent-approved.png" alt="Shoot the Moon">';
          confBtn.classList.add('bid-shoot-moon');
        } else {
          confBtn.classList.remove('bid-shoot-moon');
          confBtn.innerHTML = 'Bid <span id="bidConfirmVal">' + suggested + '</span>';
        }
      }
      _ltBidSuggested = suggested;
      bidDraft839 = { key: draftKey839, value: suggested };
      syncMoonBidPlaque(suggested);
      try {
        syncLandscapeBidBar();
      } catch (e) {}
    };
    if (confBtn)
      confBtn.disabled =
        !Number.isSafeInteger(suggested) ||
        suggested % 5 !== 0 ||
        suggested < nextMin ||
        suggested > ceiling;
    const minus = $('bidMinus');
    const plus = $('bidPlus');
    const conf = $('bidConfirm');
    const pass = $('bidPassBtn');
    if (conf) conf.setAttribute('data-live-bid', String(suggested));
    if (minus)
      minus.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          playSfx('bidDown');
        } catch (err) {}
        suggested = Math.max(
          nextMin,
          (Number.isSafeInteger(suggested) && suggested % 5 === 0 ? suggested : nextMin) - 5
        );
        sync();
      };
    if (plus)
      plus.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (suggested >= ceiling) return;
        try {
          playSfx('bidUp');
        } catch (err) {}
        suggested = Math.min(
          ceiling,
          (Number.isSafeInteger(suggested) && suggested % 5 === 0 ? suggested : nextMin) + 5
        );
        sync();
      };
    // Hold repeats the same legal +/-5 click operation; the auction remains authoritative.
    window.HORBidHold795?.bind(
      minus,
      plus,
      () =>
        game?.phase === 'bidding' && game.currentPlayer === myIndex && !game.paused && !isSpectator
    );
    if (conf)
      conf.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          playSfx('bidUp');
        } catch (err) {}
        if (
          !game ||
          game.phase !== 'bidding' ||
          game.currentPlayer !== myIndex ||
          game.paused ||
          isSpectator
        )
          return;
        // The displayed plaque is the declaration. Only this intentional tap submits.
        submitBid(suggested, { moonConfirmed: isShootMoonBid(suggested) });
      };
    sync();
    if (pass)
      pass.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          playSfx('bidDown');
        } catch (err) {}
        submitBid(0);
      };
  }
  try {
    const bar = $('ltBidBar');
    if (bar) bar.classList.add('hidden');
  } catch (e) {}
  requestAnimationFrame(() => {
    try {
      placeActionPanelAboveSeat();
    } catch (e) {}
    setTimeout(() => {
      try {
        placeActionPanelAboveSeat();
      } catch (e) {}
    }, 80);
  });
  try {
    maybeRemindTurn();
  } catch (e) {}
}

// Owner-approved Concept A: artwork and live stakes attached to the existing Bid Box.
// Presentation never submits a bid or dispatches speech/howl.
function syncMoonBidPlaque(value) {
  const plaque = $('moonBidPlaque');
  if (!plaque) return;
  const active = !!(
    game &&
    game.phase === 'bidding' &&
    game.currentPlayer === myIndex &&
    !game.paused &&
    !isSpectator &&
    shootMoonEnabled &&
    isShootMoonBid(value) &&
    moonBidAllowed(myIndex)
  );
  plaque.hidden = !active;
  if (!active) {
    $('bidConfirm')?.removeAttribute('aria-describedby');
    return;
  }
  $('moonBidPoints').textContent = value + ' POINTS';
  $('moonBidLoss').textContent = 'or lose ' + value;
  plaque.setAttribute(
    'aria-label',
    'Shoot the Moon: capture all ' +
      value +
      ' points to win the game. Zero-point tricks may be lost. If you miss, your team loses ' +
      value +
      ' points; opponents score captured points.'
  );
  const confirm = $('bidConfirm');
  if (confirm) confirm.setAttribute('aria-describedby', 'moonBidPlaque');
  try {
    window.HORMoonHowl?.preload();
  } catch (e) {}
}
function closeMoonBidPlaque() {
  const plaque = $('moonBidPlaque');
  if (plaque) plaque.hidden = true;
}
function positionSeatLeadTags() {
  try {
    document.querySelectorAll('.player-slot').forEach((slot) => {
      const tag = slot.querySelector(':scope > .seat-lead-tag');
      if (!tag || tag.classList.contains('hidden')) return;
      if (window.HORCharacterStudio077?.positionLead(tag)) return;
      const av = slot.querySelector('.seat-avatar,.seat-avatar-side');
      if (!av) return;
      const sr = slot.getBoundingClientRect(),
        ar = av.getBoundingClientRect();
      tag.style.setProperty('left', ar.left - sr.left + ar.width / 2 + 'px', 'important');
      tag.style.setProperty('right', 'auto', 'important');
      tag.style.setProperty(
        'top',
        ar.top - sr.top + Math.max(1, ar.height * 0.04) + 'px',
        'important'
      );
      tag.style.setProperty('bottom', 'auto', 'important');
      tag.style.setProperty('transform', 'translate(-50%,-35%)', 'important');
    });
  } catch (e) {}
}

function horPlaceSeatAttachment(el, slot, side, gapPx) {
  if (!el || !slot) return;
  const av = slot.querySelector('.seat-avatar,.seat-avatar-side');
  if (!av) return;
  const sr = slot.getBoundingClientRect(),
    ar = av.getBoundingClientRect();
  const sx = sr.width / Math.max(1, slot.offsetWidth || sr.width),
    sy = sr.height / Math.max(1, slot.offsetHeight || sr.height);
  const cx = (ar.left + ar.width / 2 - sr.left) / Math.max(0.01, sx),
    cy = (ar.top + ar.height / 2 - sr.top) / Math.max(0.01, sy);
  const ah = ar.height / Math.max(0.01, sy),
    gap = gapPx || 5;
  el.style.cssText = '';
  el.style.setProperty('position', 'absolute', 'important');
  el.style.setProperty('margin', '0', 'important');
  el.style.setProperty('z-index', '120', 'important');
  el.style.setProperty('right', 'auto', 'important');
  el.style.setProperty('bottom', 'auto', 'important');
  // Rook626: side-seat bid pills live BELOW the avatar, centered on the avatar.
  // The previous inward left/right anchors pushed 72px-wide pills into the card-play lane.
  if (side === 'left' || side === 'right') {
    el.style.setProperty('left', cx + 'px', 'important');
    el.style.setProperty('top', cy + ah / 2 + gap + 'px', 'important');
    el.style.setProperty('transform', 'translateX(-50%)', 'important');
  } else if (side === 'top') {
    el.style.setProperty('left', cx + 'px', 'important');
    el.style.setProperty('top', cy + ah / 2 + gap + 'px', 'important');
    el.style.setProperty('transform', 'translateX(-50%)', 'important');
  } else {
    el.style.setProperty('left', cx + 'px', 'important');
    el.style.setProperty('top', cy - ah / 2 - gap + 'px', 'important');
    el.style.setProperty('transform', 'translate(-50%,-100%)', 'important');
  }
}
function positionSeatBidBadges() {
  if (game?.phase === 'bidding' && window.HORUnifiedBidding752) {
    window.HORUnifiedBidding752.position();
    return;
  }
  try {
    const sides = {
      'slot-left': 'left',
      'slot-right': 'right',
      'slot-partner': 'top',
      'slot-me': 'bottom',
    };
    Object.entries(sides).forEach(([sid, side]) => {
      const slot = $(sid);
      if (!slot) return;
      const bb = slot.querySelector(':scope > .bid-badge:not(.hidden)');
      if (bb) horPlaceSeatAttachment(bb, slot, side, 5);
    });
  } catch (e) {}
}

function submitBid(val, opts) {
  let value = val === 0 || val === '0' ? 0 : parseInt(val, 10);
  if (value !== 0 && !Number.isFinite(value)) {
    try {
      showBidUI();
    } catch (e) {}
    const ma = $('messageArea');
    if (ma) ma.textContent = 'Bid did not go through — pick an amount and tap Bid again.';
    return;
  }
  if (value !== 0 && isShootMoonBid(value) && !moonBidAllowed(myIndex)) {
    const ma = $('messageArea');
    if (ma) ma.textContent = 'Shoot the Moon is turned off for this game.';
    return;
  }
  // Selecting the ceiling is not confirmation; callers must represent an intentional tap.
  if (value !== 0 && isShootMoonBid(value) && !(opts && opts.moonConfirmed)) return;
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
  const stillRequired =
    isHost &&
    game &&
    game.phase === 'bidding' &&
    game.currentPlayer === myIndex &&
    !game.paused &&
    !hasPassedBid(myIndex);
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
    if (!['number', 'string'].includes(typeof data.value) || String(data.value).trim() === '')
      return;
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
  if (
    data.value !== 0 &&
    (data.value % 5 !== 0 ||
      data.value < (Number(minBid) || 100) ||
      data.value <= auctionHigh() ||
      data.value > maxBid() ||
      (isShootMoonBid(data.value) && !moonBidAllowed(data.player)))
  )
    return;
  clearTurnTimer();
  if (!game.bidStatus) game.bidStatus = [null, null, null, null];
  const pname = (players[data.player] && players[data.player].name) || 'P' + (data.player + 1);

  if (data.value === 0) {
    game.bidStatus[data.player] = 'pass';
    game.passCount = countPassedBids();
    const passMsg = `${pname} passes`;
    const ma = $('messageArea');
    if (ma) ma.textContent = passMsg;
    broadcast({ type: 'message', text: passMsg });
    try {
      playSfx('pass', { broadcastNet: true });
    } catch (e) {}
    if (data.voiceLine === true || players[data.player]?.isBot)
      window.HORBidVoice801?.announce(data.player, 'pass', 0);
    try {
      botMaybeTableTalk('pass', { name: pname, prefer: data.player });
    } catch (e) {}
    try {
      noteHumanAuction(data.player, 'pass', 0);
    } catch (e) {}

    // Only high bidder left active, or everyone else passed → end auction

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
        if (!hasPassedBid(i)) {
          onlyBidderLeft = false;
          break;
        }
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
      const howlId =
        (game.careerMatchId || (game.careerMatchId = crypto.randomUUID())) +
        ':' +
        handHistory.length +
        ':moon:' +
        data.player;
      // The in-place plaque preloads this clip; start it before bid UI/SFX
      // work so the cue lands directly on the confirmed 200 bid.
      window.HORMoonHowl?.play(howlId);
      broadcast({ type: 'moonHowl', id: howlId });
    }
    // Note: passCount is count of permanent passes, not reset — passers stay out
    game.bidStatus[data.player] = data.value;
    const bidMsg = game.shotTheMoon
      ? `${pname} is shooting the moon at ${data.value}!`
      : `${pname} bids ${data.value}`;
    const ma = $('messageArea');
    if (ma) ma.textContent = bidMsg;
    broadcast({ type: 'message', text: bidMsg });
    try {
      playSfx('bid', { broadcastNet: true });
    } catch (e) {}
    if (data.voiceLine === true || players[data.player]?.isBot)
      window.HORBidVoice801?.announce(
        data.player,
        game.shotTheMoon ? 'shootMoon' : 'bid',
        data.value
      );
    try {
      botMaybeTableTalk('bid', { name: pname, prefer: data.player });
    } catch (e) {}
    try {
      noteHumanAuction(data.player, 'bid', data.value);
    } catch (e) {}
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
      if (!hasPassedBid(i)) {
        onlyBidderLeft = false;
        break;
      }
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
  return (cards || [])
    .map((c) => {
      if (!c) return '';
      if (c.color === 'rook' || c.id === 'rook') return 'the Rook';
      if (isRed1(c)) return 'Red 1';
      if (isRed2(c) || c.id === 'red-2') return 'Red 2';
      const name = COLOR_NAMES[c.color] || c.color || '';
      return (name + ' ' + c.rank).trim();
    })
    .filter(Boolean)
    .join(', ');
}

function finishBidding() {
  game.phase = 'discard';
  // Rook648: bidding/Moon and discard are mutually exclusive visual states.
  try {
    closeMoonBidPlaque();
  } catch (e) {}
  try {
    const d = $('decisionConsole');
    if (d) {
      d.classList.add('hidden');
      d.classList.remove('decision-mode-trump');
      d.innerHTML = '';
    }
  } catch (e) {}
  try {
    const b = $('ltFeltBid');
    if (b) b.classList.add('hidden');
  } catch (e) {}
  try {
    const b = $('ltBidBar');
    if (b) b.classList.add('hidden');
  } catch (e) {}
  try {
    const bs = ps(game.bidder);
    bs.bidsWon++;
    bs.bidSum += game.bid || 0;
    if ((game.bid || 0) > (bs.highBid || 0)) bs.highBid = game.bid;
  } catch (e) {}
  try {
    playSfx('winBid', { broadcastNet: true });
  } catch (e) {}
  // Pass-out only applied during the auction — restore full seats for discard/play
  document.querySelectorAll('.player-slot.is-passed, #slot-me.is-passed').forEach((el) => {
    el.classList.remove('is-passed');
  });
  // bidder takes nest — keep preview copy for UI
  const nestSize = game.nest.length;
  game.nestPreview = (game.nest || [])
    .map((c) => {
      try {
        return typeof hydrateNestCard === 'function' ? hydrateNestCard(c) : { ...c };
      } catch (e) {
        return { ...c };
      }
    })
    .filter(Boolean);
  game.kittyTaken = game.nestPreview.map((c) => ({ ...c }));
  // House rule: Open Widow — show everyone what was in the nest the moment
  // it's picked up, instead of only the bidder ever seeing it before the
  // final hand-end reveal.
  game.topNestCard = null;
  game.widowSpread = openWidow ? game.nestPreview.map((c) => ({ ...c })) : [];
  try {
    renderTopNestPeek();
  } catch (e) {}
  try {
    renderWidowSpread();
  } catch (e) {}
  if (openWidow) {
    const bname = (players[game.bidder] && players[game.bidder].name) || 'P' + (game.bidder + 1);
    const widowMsg = `Widow revealed — ${bname} picked up: ${nestCardsToText(game.nestPreview)}`;
    try {
      const ma = $('messageArea');
      if (ma) ma.textContent = widowMsg;
      broadcast({ type: 'message', text: widowMsg });
    } catch (e) {}
  }
  // Merge nest into bidder hand — preserve every card (Rook, Red 2, Red 1, counters, etc.)
  const beforeCount = game.hands[game.bidder].length;
  const hadRook =
    game.hands[game.bidder].some((c) => c.color === 'rook' || c.id === 'rook') ||
    game.nestPreview.some((c) => c.color === 'rook' || c.id === 'rook');
  const hadRed2 =
    game.hands[game.bidder].some((c) => isRed2(c)) || game.nestPreview.some((c) => isRed2(c));
  const hadRed1 =
    game.hands[game.bidder].some((c) => isRed1(c)) || game.nestPreview.some((c) => isRed1(c));

  game.hands[game.bidder] = game.hands[game.bidder].concat(game.nest);
  game.nest = [];

  // Same display order as the rest of the game (default: by color, high → low).
  sortCardsDisplay(game.hands[game.bidder]);

  // Sanity: hand size and specials must still be present
  if (game.hands[game.bidder].length !== beforeCount + nestSize) {
    console.warn(
      'Hand size after nest mismatch',
      beforeCount,
      nestSize,
      game.hands[game.bidder].length
    );
  }
  if (hadRook && !game.hands[game.bidder].some((c) => c.color === 'rook' || c.id === 'rook')) {
    console.error('Rook missing after nest merge — restoring from preview if possible');
    const r = game.nestPreview.find((c) => c.color === 'rook' || c.id === 'rook');
    if (r) game.hands[game.bidder].push({ ...r });
  }
  if (hadRed2 && !game.hands[game.bidder].some((c) => isRed2(c))) {
    console.error('Red 2 missing after nest merge — restoring from preview if possible');
    const r = game.nestPreview.find((c) => isRed2(c));
    if (r) game.hands[game.bidder].push({ ...r });
  }
  if (hadRed1 && !game.hands[game.bidder].some((c) => isRed1(c))) {
    console.error('Red 1 missing after nest merge — restoring');
    const r = game.nestPreview.find((c) => isRed1(c));
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
  if (game.bidder === myIndex) {
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
      try {
        if (game && game.phase === 'discard')
          hostSendDiscardStart(game.bidder, players[game.bidder] && players[game.bidder].id, false);
      } catch (e) {}
    }, 400);
  }
}

function hostSendDiscardStart(playerIdx, peerId, showKitty) {
  if (!isHost || !game || game.phase !== 'discard') return;
  const idx = typeof playerIdx === 'number' && playerIdx >= 0 ? playerIdx : game.bidder;
  if (idx !== game.bidder) return;
  const p = players[idx];
  const pid = p && p.id;
  if (!pid || (peerId && peerId !== pid) || pid === myPeerId) return;
  const hand = (game.hands[idx] || []).map((c) => ({ ...c }));
  sendTo(pid, {
    type: 'discardStart',
    player: idx,
    bidder: game.bidder,
    peerId: pid,
    discardCount: game.discardCount || (hand.length && hand.length - (handSize || 9)),
    hand,
    nestPreview: (game.kittyTaken || game.nestPreview || []).map((c) => ({ ...c })),
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
  window.HORManualNest838?.detach();
  if (window._discardKittyTimer) {
    try {
      clearTimeout(window._discardKittyTimer);
    } catch (e) {}
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
    ov.classList.remove(
      'landscape-discard-overlay',
      'portrait-discard-overlay',
      'gh-kitty-page',
      'gh-discard-page'
    );
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
  const ids = (Array.isArray(hand) ? hand : []).map((c) => String((c && c.id) || '')).sort();
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
    const hand = document.querySelector('.hand-area');
    const hr = hand?.getBoundingClientRect();
    const faces = [...document.querySelectorAll('#myHand .card-face')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width && r.height);
    const boundary = Math.min(hr && hr.height ? hr.top : innerHeight, ...faces.map((r) => r.top));
    const lower = overlay.getBoundingClientRect().bottom;
    overlay.style.setProperty(
      '--kitty-hand-clearance749',
      Math.max(8, lower - boundary + 10) + 'px'
    );
  } else overlay.style.removeProperty('--kitty-hand-clearance749');
}

function showDiscardUI(showKitty) {
  // Rook648: discard owns the screen; retire all bid/Moon presentation first.
  try {
    closeMoonBidPlaque();
  } catch (e) {}
  try {
    const d = $('decisionConsole');
    if (d) {
      d.classList.add('hidden');
      d.classList.remove('decision-mode-trump');
      d.innerHTML = '';
    }
  } catch (e) {}
  try {
    const b = $('ltFeltBid');
    if (b) b.classList.add('hidden');
  } catch (e) {}
  try {
    const b = $('ltBidBar');
    if (b) b.classList.add('hidden');
  } catch (e) {}
  try {
    ['actionPanel', 'ltTrumpBar'].forEach((id) => {
      const el = $(id);
      if (el) el.classList.add('hidden');
    });
  } catch (e) {}
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

  if (isLandscapeNow() && window.HORManualNest838 && window._discardPage !== 'kitty') {
    window._discardPage = 'select';
    window._discardKittyShown = true;
    HORManualNest838.show({
      ov,
      hand: game.myHand,
      count,
      flowKey,
      kitty: game.kittyTaken || game.nestPreview || [],
      confirm: (ids, keep) => {
        if (
          window._discardSubmitting ||
          !game ||
          game.phase !== 'discard' ||
          discardFlowIdentity(game.myHand, game.bidder) !== flowKey
        )
          return;
        const source = (isHost && game.hands?.[game.bidder]) || game.myHand,
          valid = new Set(source.map((c) => String(c.id)));
        if (
          ids.length !== count ||
          new Set(ids).size !== count ||
          ids.some((id) => !valid.has(id)) ||
          !HORHandOrder838.lock(source, keep, ids)
        )
          return;
        window._discardSubmitting = true;
        HORManualNest838.refresh();
        submitDiscard(ids);
      },
    });
    return;
  }
  window.HORManualNest838?.detach();

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
    const color = COLOR_NAMES[card && card.color] || String((card && card.color) || 'card');
    return `${card && card.rank != null ? card.rank : ''} ${color}`.trim();
  };
  const kittyList = (() => {
    const raw =
      game.kittyTaken && game.kittyTaken.length ? game.kittyTaken : game.nestPreview || [];
    return raw
      .map((c) => {
        try {
          return typeof hydrateNestCard === 'function' ? hydrateNestCard(c) : c;
        } catch (e) {
          return c;
        }
      })
      .filter(Boolean);
  })();
  const kittyCardHtml = (card, small) => {
    const c = typeof hydrateNestCard === 'function' ? hydrateNestCard(card) || card : card;
    try {
      if (typeof renderCardHTML === 'function') {
        const html = renderCardHTML(c, !!small);
        if (html && String(html).trim()) {
          return html.replace('class="card-face ', 'class="card-face kitty-flash-card ');
        }
      }
    } catch (e) {}
    const cls = cardClass(c) || '';
    const inner = typeof cardInnerHTML === 'function' ? cardInnerHTML(c) : '';
    return (
      '<div class="card-face kitty-flash-card ' +
      cls +
      (small ? ' small' : '') +
      '">' +
      inner +
      '</div>'
    );
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
      const kittyCards = kittyList
        .slice()
        .sort(compareCardsDisplay)
        .map((c) => kittyCardHtml(c, true))
        .join('');
      kittyBlock = `
        <div class="discard-kitty kitty-flashing${landscape ? ' landscape-kitty-banner' : ''}" id="kittyFlash">
          <div class="kitty-label">Kitty added to your hand</div>
          <div class="kitty-cards">${kittyCards}</div>
          <p class="kitty-hint">Pick ${count} cards to discard — kitty is already in this hand</p>
        </div>`;
    }

    // Landscape keeps the established combined Kitty banner and picker.
    // Portrait receives the owner-approved Kitty-then-discard screens.
    if (includeKittyFlash && kittyList.length) {
      const kittyCards = kittyList
        .slice()
        .sort(compareCardsDisplay)
        .map((c) => {
          const html = renderCardHTML(c, false);
          return html.replace('class="card-face ', 'class="card-face gh-kitty-card ');
        })
        .join('');
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
      try {
        document.querySelector('.hand-area')?.classList.remove('hidden');
        renderHand(false);
      } catch (e) {}
      window._discardKittyShown = true;
      positionDiscardOverlay(ov, landscape);
      const cont = $('kittyContinueBtn');
      if (cont) {
        cont.focus({ preventScroll: true });
        cont.onkeydown = (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            cont.focus({ preventScroll: true });
          }
        };
      }
      if (cont)
        cont.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (
            !game ||
            game.phase !== 'discard' ||
            discardFlowIdentity(game.myHand, game.bidder) !== window._discardFlowKey
          )
            return;
          window._discardPage = 'select';
          window._discardPickStep = 1;
          if (isLandscapeNow()) {
            showDiscardUI(false);
            return;
          }
          renderOverlay(false);
          ov.querySelector('.discard-pick')?.focus({ preventScroll: true });
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
      // Portrait retains its original selected check; landscape numbers the
      // six Nest selections so player can see what moved to the discard tray.
      const nestOrder = selected ? Array.from(window.selectedForDiscard).indexOf(id) + 1 : 0;
      return `<button type="button" aria-label="${aria}" aria-pressed="${selected}" class="discard-slot discard-pick ${selected ? 'selected' : ''}" data-id="${id}" data-selected="${selected}"><span class="card-face ${cardClass(card)} discard-card-art" aria-hidden="true">${cardInnerHTML(card)}</span><span class="gh-card-check" aria-hidden="true">${landscape && nestOrder ? nestOrder : '✓'}</span></button>`;
    };
    // Preview only. These small cards are mirrors of the six selected from the
    // authoritative 16-card hand, never another discard state or a second hand.
    const nestSlotMarkup = () => {
      const selected = Array.from(window.selectedForDiscard || []).slice(0, count);
      return Array.from({ length: count }, (_, i) => {
        const id = selected[i];
        const card =
          id == null ? null : (game.myHand || []).find((c) => String(c.id) === String(id));
        if (!card)
          return `<span class="gh-813-well" aria-label="Nest slot ${i + 1} empty"><span class="gh-813-well-no">${i + 1}</span></span>`;
        return `<span class="gh-813-well filled" aria-label="Nest slot ${i + 1}: ${cardLabel(card)}"><span class="card-face ${cardClass(card)} gh-813-mini-face" aria-hidden="true">${cardInnerHTML(card)}</span></span>`;
      }).join('');
    };
    const rows = (portrait ? portraitGroups : groups)
      .map((g) => {
        const groupKey = portrait ? g.key : g.key;
        const cards = game.myHand
          .filter((c) => (portrait ? portraitGroupFor(c) : groupFor(c)) === groupKey)
          .sort(compareCardsDisplay);
        if (!cards.length) return '';
        if (portrait)
          return `<section class="discard-color-row discard-color-${g.key}" data-discard-group="${g.key}">
        <h3 class="discard-color-label">${g.label}</h3>
        <div class="discard-color-cards">${cards.map(selectionButton).join('')}</div>
      </section>`;
        // Match the complete, accessible portrait card component. In the
        // previous landscape markup these were clickable DIV card faces with
        // no explicit selection control, which made the sixteen-card screen
        // visually confusing and inaccessible by keyboard or assistive tech.
        return `<div class="discard-color-row discard-color-${g.key}" data-discard-group="${g.key}">
        <div class="discard-color-label">${g.label}</div>
        <div class="discard-color-cards">${cards.map(selectionButton).join('')}</div>
      </div>`;
      })
      .join('');

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
        <section class="discard-sheet gh-landscape-discard gh-landscape-discard-813" role="dialog" aria-modal="true" aria-labelledby="discardTitle">
          <header class="gh-discard-head gh-813-head">
            <div class="gh-discard-directions"><div class="gh-813-overline">GRIFFIN HOUSE OF ROOKS <span>·</span> THE NEST</div><h2 class="discard-title" id="discardTitle">Choose ${count} for the Nest</h2><p class="gh-discard-instruction">The ${count} chosen cards are discarded. Your other ${game.myHand.length - count} stay in your hand.</p></div>
            <div class="gh-discard-count"><span class="gh-813-count-n" id="discardCountLabel" aria-live="polite">${nSel} of ${count}</span><span class="gh-813-count-label">selected for the Nest</span></div>
          </header>
          <div class="gh-813-trays">
            <div class="gh-813-received">${kittyBlock || `<div class="gh-813-received-summary"><strong>Kitty received</strong><small>All ${game.myHand.length} cards are ready to choose from</small></div>`}</div>
            <div class="gh-813-nest" role="group" aria-label="Cards selected to discard into the Nest">
              <div class="gh-813-nest-title"><span>NEST</span><small>Cards you are discarding</small></div>
              <div class="gh-813-wells" id="nestDiscardWells">${nestSlotMarkup()}</div>
            </div>
          </div>
          <div class="gh-landscape-discard-felt gh-813-hand">
            <div class="gh-813-hand-caption"><strong>YOUR HAND</strong><span>Tap a card to move it to the Nest. Tap again to put it back.</span></div>
            <div class="discard-groups" role="group" aria-label="Choose exactly ${count} cards to discard">${rows}</div>
          </div>
          <footer class="discard-actions gh-813-actions">
            <span class="gh-813-keep"><strong>${game.myHand.length - count}</strong> cards kept in your hand</span>
            <button type="button" class="btn primary" id="confirmDiscard" ${nSel !== count ? 'disabled' : ''}>${nSel === count ? `Confirm ${count} for the Nest` : `Choose ${count - nSel} more`}</button>
          </footer>
        </section>`;
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
        try {
          playDiscardToggleSfx(true);
        } catch (err) {}
      } else if (window.selectedForDiscard.size < count) {
        window.selectedForDiscard.add(id);
        el.classList.add('selected');
        try {
          playDiscardToggleSfx(false);
        } catch (err) {}
      }
      const n = window.selectedForDiscard.size;
      const lab = $('discardCountLabel');
      if (lab) lab.textContent = portrait ? `${n} / ${count} selected` : `${n} of ${count}`;
      // Landscape's receiving tray updates in place without changing any
      // hand, card IDs, turn state, discard handler, or the portrait workflow.
      if (!portrait && ov.querySelector('.gh-landscape-discard-813')) {
        const wells = ov.querySelector('#nestDiscardWells');
        if (wells) wells.innerHTML = nestSlotMarkup();
        const ids = Array.from(window.selectedForDiscard);
        ov.querySelectorAll('.discard-pick').forEach((pick) => {
          const order = ids.indexOf(String(pick.dataset.id));
          const number = pick.querySelector('.gh-card-check');
          if (number) number.textContent = order >= 0 ? String(order + 1) : '✓';
        });
      }
      el.setAttribute('aria-pressed', String(window.selectedForDiscard.has(id)));
      const slot = el.closest('.discard-slot');
      if (slot) slot.dataset.selected = String(window.selectedForDiscard.has(id));
      const btn = $('confirmDiscard');
      if (btn) {
        if (!portrait)
          btn.textContent =
            n === count ? `Confirm ${count} for the Nest` : `Choose ${count - n} more`;
        const validIds = new Set((game.myHand || []).map((c) => String(c.id)));
        const validCount = [...window.selectedForDiscard].filter((value) =>
          validIds.has(String(value))
        ).length;
        btn.disabled = n !== count || validCount !== count;
      }
    };

    ov.querySelectorAll('.discard-pick').forEach((el) => {
      // One browser-recognized activation owns each gesture. A native click
      // already excludes cancelled/dragged touches and supports rapid taps;
      // pointerup plus a timed click veto dropped independent activations.
      el.addEventListener('click', (e) => toggleDiscardCard(el, e));
      // Native buttons in both orientations already provide Enter/Space
      // activation. Keep the legacy keyboard fallback defensively only if
      // an old non-button pick is ever rendered by a separate template.
      if (el.tagName !== 'BUTTON')
        el.addEventListener('keydown', (e) => {
          if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          toggleDiscardCard(el, e);
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
        const source =
          isHost && game.hands && game.hands[game.bidder] ? game.hands[game.bidder] : game.myHand;
        const valid = ids.filter((id) => source.some((c) => String(c.id) === id));
        if (ids.length !== count || valid.length !== count || new Set(valid).size !== count) {
          const ma = $('messageArea');
          if (ma) ma.textContent = `Select exactly ${count} cards to discard`;
          btn.disabled = true;
          return;
        }
        if (window.HORHandOrder838) {
          const full =
            window.HORManualNest838?.orderFor(source) ||
            HORHandOrder838.ordered(source).map((c) => String(c.id));
          if (
            !HORHandOrder838.lock(
              source,
              full.filter((id) => !valid.includes(id)),
              valid
            )
          )
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
    if (window._discardKittyTimer) {
      try {
        clearTimeout(window._discardKittyTimer);
      } catch (e) {}
      window._discardKittyTimer = null;
    }
    // Rook632 approved flow: human Continue button owns the transition.
  }
}

function fitDiscardOverlayCards() {
  const ov = $('discardOverlay');
  if (!ov || ov.classList.contains('hidden')) return;
  if (ov.classList.contains('gh-kitty-page') && !isLandscapeNow())
    positionDiscardOverlay(ov, false);
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
    ov.querySelectorAll('.discard-color-cards').forEach((row) => {
      maxInRow = Math.max(maxInRow, row.children.length);
    });
    const colW = Math.max(140, Math.floor((vw - 24) / 2));
    const wrapCols = Math.max(3, Math.min(maxInRow, Math.floor(colW / 44)));
    let cardW = Math.max(36, Math.min(52, Math.floor((colW - 16) / wrapCols) - 3));
    let cardH = Math.round(cardW * (84 / 58));
    const maxH = Math.min(76, Math.max(52, Math.floor(legacyUsableH / 3 - 18)));
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
  const columnGap =
    columns > 1 ? Math.max(0, Math.min(6, (groupsWidth - columns * 44) / (columns - 1))) : 0;
  const maxRows = 1 + Math.ceil(11 / columns) + 3;
  const byHeight = heightBudget / maxRows;
  groups.style.setProperty('--discard-columns', columns);
  groups.style.setProperty('--discard-col-gap', `${columnGap}px`);
  // The approved 44 × 63.7 face is maintained on the reference viewport;
  // small viewports scale every card together, never by suit length.
  const byWidth = Math.min(44, (groupsWidth - columnGap * (columns - 1)) / columns);
  const cardH = Math.max(36, Math.min((840 / 580) * byWidth, byHeight));
  const cardW = cardH * (580 / 840);
  ov.style.setProperty('--discard-card-w', cardW + 'px');
  ov.style.setProperty('--discard-card-h', cardH + 'px');
}

function rejectDiscardLocal(needed, message) {
  setTimeout(() => window.HORManualNest838?.refresh(), 0);
  window._discardSubmitting = false;
  const btn = $('confirmDiscard');
  if (btn) {
    const selected = window.selectedForDiscard?.size || 0;
    btn.disabled = selected !== needed;
    if (!document.querySelector('#discardOverlay.gh-discard-page')) {
      btn.textContent = document.querySelector('#discardOverlay .gh-landscape-discard-813')
        ? selected === needed
          ? `Confirm ${needed} for the Nest`
          : `Choose ${needed - selected} more`
        : `Confirm Discard (${selected}/${needed})`;
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
    hostProcessDiscard({
      player: myIndex,
      peerId: myPeerId,
      cardIds: ids,
      actionId: horNewActionId('discard'),
    });
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
    if (pid)
      sendTo(pid, {
        type: 'discardRejected',
        needed: game.discardCount || 5,
        message: 'It is not your discard',
      });
    return;
  }
  const needed = game.discardCount || 5;
  const hand = game.hands[game.bidder];
  if (!hand || !data.cardIds) return;
  const wanted = [];
  const seen = new Set();
  data.cardIds.forEach((id) => {
    const sid = String(id);
    if (seen.has(sid)) return;
    seen.add(sid);
    wanted.push(sid);
  });
  const discard = [];
  const remaining = [];
  hand.forEach((c) => {
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
      hand: hand.map((c) => ({ ...c })),
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
  game.nestCards = discard.map((c) => ({ ...c }));
  game.nestRevealCards = game.nestCards.map((c) => ({ ...c }));
  game.nestDiscardCount = discard.length;
  game.phase = 'trump';
  window.selectedForDiscard = new Set();
  try {
    playSfx('discard', { broadcastNet: true });
  } catch (e) {}
  hideDiscardOverlay();
  if (game.hands[game.bidder] && game.bidder === myIndex) {
    game.myHand = game.hands[game.bidder].slice();
  }
  if (bidderId && bidderId !== myPeerId) {
    sendTo(bidderId, { type: 'discardOk', hand: game.hands[game.bidder].map((c) => ({ ...c })) });
  }
  broadcastState();
  const msg = `${players[game.bidder].name} chooses Trump`;
  $('messageArea').textContent = msg;
  broadcast({ type: 'message', text: msg });
  if (game.bidder === myIndex) {
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
  try {
    syncDiscardReturn040();
  } catch (e) {}
}

function showTrumpUI() {
  try {
    horApplyHandTheme();
  } catch (e) {}
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  try {
    clearTrumpBanners();
  } catch (e) {}
  try {
    const bar = $('ltTrumpBar');
    if (bar) {
      bar.classList.add('hidden');
      const b = $('ltTrumpButtons');
      if (b) b.innerHTML = '';
    }
  } catch (e) {}
  const panel = $('actionPanel');
  if (panel) {
    panel.classList.add('hidden');
    panel.classList.remove('trump-showdown');
    panel.innerHTML = '';
  }
  const dock = $('decisionConsole');
  if (!dock) return;
  if (landscape) {
    // Landscape keeps the same functional owner but centers the compact console safely.
    dock.style.left = '50%';
    dock.style.top = '50%';
    dock.style.transform = 'translate(-50%,-50%)';
  } else {
    dock.style.left = '';
    dock.style.top = '';
    dock.style.transform = '';
  }
  if (
    (!landscape || window.HORAngleC?.active()) &&
    window.HORTrump714 &&
    window.HORTrump714.choose(dock, submitTrump, game)
  )
    return;
  dock.classList.remove('decision-mode-bid');
  dock.classList.add('decision-mode-trump');
  let html =
    '<div class="decision-console-title">STAMP THE TRUMP</div><div class="stamp-trump-grid">';
  COLORS.forEach((c) => {
    html +=
      '<button type="button" class="stamp-trump-choice ' +
      c +
      '" data-trump="' +
      c +
      '">' +
      COLOR_NAMES[c] +
      '</button>';
  });
  html +=
    '</div><p class="stamp-trump-note">' +
    (includeRook
      ? rookLowest
        ? 'The Bird stays lowest trump.'
        : 'The Bird stays highest trump.'
      : '') +
    '</p>';
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
  if (!game || game.phase !== 'trump' || game.paused || !data || !COLORS.includes(data.color))
    return;
  if (data.player !== game.bidder) return;
  if (horRememberAction(data)) return;
  game.trump = data.color;
  game.phase = 'play';
  // Keep the first trick behind the shared physical stamp, including MAX pace.
  const stampHold = window.HORTrump714?.ownsPortrait() ? window.HORTrump714.duration(false) : 0;
  game.trumpPresentationMs833 = stampHold;
  game.trumpPresentation833 = stampHold > 0;
  if (stampHold > 0) {
    const stampedGame = game;
    setTimeout(() => {
      if (game !== stampedGame) return;
      game.trumpPresentation833 = false;
      broadcastState();
      if (game.phase === 'play' && !game.paused) hostPromptPlay();
    }, stampHold + 120);
  }

  //790: public presentation event identity; never a bid/trick input.
  game.trumpVoiceEvent790 = horNewActionId('trump-voice');
  try {
    window.HORTrumpVoice?.chosen(game, playerAvatars);
  } catch (e) {
    console.warn('Trump voice:', e);
  }
  try {
    announceTrumpSelection(data.color);
  } catch (e) {}
  try {
    hideActionPanel();
  } catch (e) {}
  try {
    const d = $('decisionConsole');
    if (d) {
      d.classList.add('hidden');
      d.classList.remove('decision-mode-trump');
      d.innerHTML = '';
    }
  } catch (e) {}
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
  try {
    renderWidowSpread();
  } catch (e) {}
  game.tricksTaken = [[], []];
  try {
    playSfx('trump', { broadcastNet: true });
  } catch (e) {}
  try {
    const color =
      (typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES[data.color]) || data.color || 'trump';
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
  if (sub)
    sub.textContent = on ? (isHost ? 'Tap Resume when ready' : 'Waiting for host to resume') : '';
}

/** Host transfer: new host opens room with same code is impossible on PeerJS;
 *  we create a handoff: new host gets a new room code; others must rejoin.
 *  Snapshot is sent so they can continue after reconnect. */
function hostTransferHost() {
  if (!isHost || !game) return;
  const humans = players.filter((p) => !p.isBot && p.id !== myPeerId);
  if (!humans.length) {
    alert('No other human player to transfer to.');
    return;
  }
  const names = humans.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const pick = prompt('Transfer host to which player?\n' + names + '\nEnter number:');
  const n = parseInt(pick, 10);
  if (!n || n < 1 || n > humans.length) return;
  const target = humans[n - 1];
  players.filter((p) => !p.isBot).forEach(horEnsureResume844);
  try {
    sessionStorage.setItem(
      'horResume844:' + roomCode,
      horEnsureResume844(players.find((p) => p.id === myPeerId))
    );
  } catch (_) {}
  const snapshot = {
    game: JSON.parse(
      JSON.stringify({
        phase: game.phase,
        dealer: game.dealer,
        scores: game.scores,
        careerMatchId: game.careerMatchId,
        careerExtras: game.careerExtras,
        networkHand844: game.networkHand844,
        hands: game.hands,
        nest: game.nest,
        bid: game.bid,
        bidder: game.bidder,
        trumpVoiceEvent790: game.trumpVoiceEvent790 || null,
        trumpPresentation833: !!game.trumpPresentation833,
        trumpPresentationMs833: game.trumpPresentationMs833 || 0,
        trumpVoiceRestore790: true,
        trump: game.trump,
        currentPlayer: game.currentPlayer,
        trick: game.trick,
        ledColor: game.ledColor,
        tricksTaken: game.tricksTaken,
        nestCards: game.nestCards,
        passCount: game.passCount,
        highestBid: game.highestBid,
        discardCount: game.discardCount,
        nestDiscardCount: game.nestDiscardCount,
        targetScore: game.targetScore,
        nestPreview: game.nestPreview,
        topNestCard: game.topNestCard || null,
        nestRevealCards: game.nestRevealCards,
        paused: false,
      })
    ),
    players: players.map((p) => ({ ...p })),
    settings: {
      includeRed2,
      red2Points,
      includeRed1,
      includeOnes,
      onesHigh,
      includeRook,
      rookLowest,
      specialsAnytime,
      mustTrumpWhenVoid,
      minBid,
      targetScore,
      handSize,
      nestSizeDefault,
      ruleVariant,
      botDifficulty,
      turnTimeSec,
      revealTopNest,
    },
    matchStats: { ...matchStats },
    playerStats: playerStats.map((s) => ({ ...s })),
    handHistory: handHistory.slice(),
  };
  window._horHandoffFrom = myPeerId;
  window._horHandoffTarget844 = target.id;
  sendTo(target.id, { type: 'hostHandoff', snapshot });
  broadcast({
    type: 'message',
    text: 'Host transferring to ' + target.name + '… stay in this tab.',
  });
  try {
    horToast('Handing the table to ' + target.name + '…');
  } catch (e) {}
}

function acceptHostHandoff(snapshot) {
  if (!snapshot || !snapshot.game) return;
  window._horHandoffSnapshot = snapshot;
  window._horOldHostConn = hostConnection;
  isHost = true;
  try {
    horToast('Taking the host seat…');
  } catch (e) {}
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
  players = oldPlayers.map((p) => {
    if (p.id === newId || (p.name === myName && !p.isBot)) {
      return Object.assign({}, p, { id: newId, isHost: true, isBot: false, isTempBot: false });
    }
    if (!p.isBot) {
      return Object.assign({}, p, {
        isBot: true,
        isTempBot: true,
        replacedHumanName: p.name,
        id: p.id || 'bot-fill-' + Math.random().toString(36).slice(2, 8),
      });
    }
    return Object.assign({}, p, { isHost: false });
  });
  myIndex = players.findIndex((p) => p && p.id === newId);
  if (myIndex < 0) myIndex = 0;
  game = snapshot.game;
  if (game) game.paused = false;
  try {
    balanceTeams();
  } catch (e) {}
  const codeEl = $('displayCode');
  if (codeEl) codeEl.textContent = roomCode;
  const old = window._horOldHostConn;
  window._horOldHostConn = null;
  try {
    if (old && old.open) old.send({ type: 'newHostReady', roomCode: roomCode, hostName: myName });
  } catch (e) {}
  try {
    showGame();
    renderUI();
  } catch (e) {}
  try {
    horToast('You are host. Others will follow this table.');
  } catch (e) {}
  if (game && game.phase === 'play') hostPromptPlay();
  else if (game && game.phase === 'bidding') hostPromptBid();
}

function horFollowNewHost(code) {
  if (!code) return;
  const token844 = horResumeToken844();
  if (token844) {
    try {
      sessionStorage.setItem('horResume844:' + String(code).toUpperCase(), token844);
    } catch (_) {}
  }
  isHost = false;
  try {
    if ($('hor-room-code')) $('hor-room-code').value = String(code);
  } catch (e) {}
  roomCode = String(code).toUpperCase();
  try {
    horToast('Following the new host…');
  } catch (e) {}
  try {
    joinRoom();
  } catch (e) {
    console.error(e);
  }
}

function hostTogglePause() {
  if (!isHost || !game) return;
  if (game.phase === 'score' || game.phase === 'deal') return;
  game.paused = !game.paused;
  if (game.paused) {
    clearTurnTimer();
    if (botTimer) {
      clearTimeout(botTimer);
      botTimer = null;
    }
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
      if (game.bidder === myIndex) showDiscardUI();
      else if (players[game.bidder]?.isBot) scheduleBot();
      else
        hostSendDiscardStart(game.bidder, players[game.bidder] && players[game.bidder].id, false);
    } else if (game.phase === 'trump') {
      if (game.bidder === myIndex) showTrumpUI();
      else if (players[game.bidder]?.isBot) scheduleBot();
    }
  }
}

// ========== Turn timer & disconnect / leave-replace ==========
function clearTurnTimer() {
  if (turnTimer) {
    clearTimeout(turnTimer);
    turnTimer = null;
  }
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
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
  const nowForTimer = horExpOn('netTimerSync')
    ? Date.now() + (Number(window.horServerOffset) || 0)
    : Date.now();
  const left = Math.max(0, Math.ceil((turnTimerEndsAt - nowForTimer) / 1000));
  if (secEl) secEl.textContent = String(left);
  if (fill) fill.style.width = (100 * left) / Math.max(1, turnTimeSec || 30) + '%';
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
  const idx =
    game.phase === 'play' || game.phase === 'bidding'
      ? game.currentPlayer
      : game.phase === 'discard' || game.phase === 'trump'
        ? game.bidder
        : -1;
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
  broadcast({
    type: 'turnTimer',
    endsAt: turnTimerEndsAt,
    player: idx,
    seconds: turnTimeSec,
    serverNow: Date.now(),
  });

  turnTimerInterval = setInterval(updateTurnTimerUI, 250);
  turnTimer = setTimeout(
    () => {
      turnTimer = null;
      onTurnTimeout();
    },
    Math.max(1, turnTimeSec || 30) * 1000
  );
}

function pickLowestLegalCard(idx) {
  const hand = game.hands[idx] || [];
  let legal = hand.filter((c) => canPlay(c, hand, game.ledColor, game.trump));
  if (!legal.length) legal = hand.slice();
  legal.sort((a, b) => cardPoints(a) - cardPoints(b) || (a.rank || 0) - (b.rank || 0));
  // Prefer non-specials when points equal
  const nonSpecial = legal.filter((c) => c.color !== 'rook' && !isRed2(c) && !isRed1(c));
  const pool = nonSpecial.length ? nonSpecial : legal;
  pool.sort((a, b) => cardPoints(a) - cardPoints(b) || (a.rank || 0) - (b.rank || 0));
  return pool[0] || legal[0] || hand[0];
}

function onTurnTimeout() {
  if (!isHost || !game || game.resolvingTrick) return;
  clearTurnTimer();
  const idx =
    game.phase === 'play'
      ? game.currentPlayer
      : game.phase === 'bidding'
        ? game.currentPlayer
        : game.phase === 'discard' || game.phase === 'trump'
          ? game.bidder
          : -1;
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
    try {
      showDisconnectBanner(msg);
    } catch (e) {}
    try {
      if (game.phase === 'play') botPlay();
      else if (game.phase === 'bidding') botBid();
      else if (game.phase === 'discard') botDiscard();
      else if (game.phase === 'trump') botChooseTrump();
    } catch (e) {
      console.error('timeout botHand', e);
    }
    return;
  }

  // Policy 2: pass on bid; lowest legal on play
  if (policy === 'lowest') {
    if (game.phase === 'bidding') {
      const msg = `⏱ Time's up for ${name} — auto-pass`;
      const ma = $('messageArea');
      if (ma) ma.textContent = msg;
      broadcast({ type: 'message', text: msg });
      try {
        hostProcessBid({ player: idx, value: 0 });
      } catch (e) {
        console.error(e);
      }
      return;
    }
    if (game.phase === 'play') {
      const card = pickLowestLegalCard(idx);
      const msg = `⏱ Time's up for ${name} — auto lowest card`;
      const ma = $('messageArea');
      if (ma) ma.textContent = msg;
      broadcast({ type: 'message', text: msg });
      if (card)
        try {
          hostProcessPlay({ player: idx, cardId: card.id });
        } catch (e) {
          console.error(e);
        }
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
      try {
        hostProcessBid({ player: idx, value: 0 });
      } catch (e) {
        console.error(e);
      }
      return;
    }
    if (game.phase === 'play') {
      const card = pickLowestLegalCard(idx);
      const msg = `⏱ ${name} skipped — lowest legal card`;
      const ma = $('messageArea');
      if (ma) ma.textContent = msg;
      broadcast({ type: 'message', text: msg });
      if (card)
        try {
          hostProcessPlay({ player: idx, cardId: card.id });
        } catch (e) {
          console.error(e);
        }
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
  if (!conn || conn.peer !== playerId) return;
  horSyncActionContext844();
  try {
    conn.send({
      type: 'welcome',
      players: publicPlayersSnapshot(),
      yourId: playerId,
      beerSeats,
      hostVersion: APP_VERSION,
      reclaimed: true,
      settings: {
        includeRed2,
        red2Points,
        targetScore,
        botDifficulty,
        layDownWinningCards,
        revealTopNest,
      },
    });
  } catch (e) {}
  if (!game) return;
  try {
    const idx = players.findIndex((p) => p && p.id === playerId);
    sendTo(
      playerId,
      Object.assign(
        {},
        {
          type: 'state',
          trumpVoiceRestore790: true,
          seq: horNetSeq,
          phase: game.phase,
          careerMatchId: game.careerMatchId,
          networkHand844: game.networkHand844,
          actionContext844: game.actionContext844,
          scores: game.scores,
          bid: game.bid,
          highestBid: game.highestBid,
          minBid: minBid,
          passCount: game.passCount || 0,
          bidStatus: game.bidStatus,
          bidder: game.bidder,
          trump: game.trump,
          trumpVoiceEvent790: game.trumpVoiceEvent790 || null,
          trumpPresentation833: !!game.trumpPresentation833,
          trumpPresentationMs833: game.trumpPresentationMs833 || 0,
          currentPlayer: game.currentPlayer,
          trick: game.trick,
          ledColor: game.ledColor,
          players: players.map((p) => ({
            name: p.name,
            team: p.team,
            id: p.id,
            isBot: !!p.isBot,
            disconnected: !!p.disconnected,
            avatar: p.avatar || playerAvatars[p.id] || '',
            voice: p.isBot ? 'avatar' : validHumanVoice(p.voice),
          })),
          dealer: game.dealer,
          nestCount: game.nest?.length || 0,
          handsCount: (game.hands || []).map((h) => (h ? h.length : 0)),
          targetScore: game.targetScore || targetScore,
          paused: !!game.paused,
          discardCount: game.discardCount || 0,
        }
      )
    );
    if (idx >= 0 && game.hands && game.hands[idx]) {
      sendTo(playerId, { type: 'privateHand', hand: game.hands[idx].map((c) => ({ ...c })) });
    }
    if (game.phase === 'discard' && idx === game.bidder) {
      sendTo(playerId, {
        type: 'discardStart',
        player: idx,
        bidder: game.bidder,
        peerId: playerId,
        discardCount: game.discardCount || 0,
        hand: (game.hands[idx] || []).map((c) => ({ ...c })),
        nestPreview: (game.nestPreview || []).map((c) => ({ ...c })),
        topNestCard: game.topNestCard ? { ...game.topNestCard } : null,
        showKitty: false,
      });
    }
  } catch (e) {
    horDebugLog('hostResyncClient failed: ' + (e && e.message));
  }
}

function hostStartDisconnectGrace(peerId) {
  const p = players.find((x) => x.id === peerId);
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
  const p = players.find((x) => x && x.id === peerId);
  if (p) p.disconnected = false;
}

/** Replace a human seat with a bot (leave or long disconnect). */
function hostReplaceWithBot(peerId, nameHint, fromDisconnect = false) {
  if (!isHost) return;
  const idx = players.findIndex((p) => p.id === peerId);
  if (idx < 0) return;
  if (players[idx].isBot && players[idx].isTempBot) return;

  const oldName = players[idx].name || nameHint || 'Player';
  hostCancelDisconnectGrace(peerId);
  try {
    const c = connMap[peerId];
    if (c) {
      try {
        c.close();
      } catch (e) {}
      delete connMap[peerId];
    }
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
    reconnectToken844: horEnsureResume844(players[idx]),
    seat: players[idx].seat,
  };
  const msg = fromDisconnect
    ? `🤖 ${oldName} replaced by a bot (can rejoin later)`
    : `🤖 ${oldName} left — replaced by a bot`;
  try {
    showDisconnectBanner(msg);
  } catch (e) {}
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

/** A returning transport reclaims only its authenticated human seat. */
function hostTryReclaimSeat(conn, data) {
  const name = (data.name || '').trim();
  const token = typeof data.reconnectToken844 === 'string' ? data.reconnectToken844 : '';
  const idx = players.findIndex(
    (p) =>
      p &&
      (!p.isBot || p.isTempBot) &&
      ((p.disconnected && p.id === conn.peer && data.id === conn.peer) ||
        (token && p.reconnectToken844 === token))
  );
  if (idx < 0) return false;

  const team = players[idx].team;
  const seat = players[idx].seat;
  const reconnectToken844 = horEnsureResume844(players[idx]);
  const oldId844 = players[idx].id;
  const oldConn844 = connMap[oldId844];
  if (oldConn844 && oldConn844 !== conn) {
    delete connMap[oldId844];
    try {
      oldConn844.close();
    } catch (_) {}
  }
  hostCancelDisconnectGrace(oldId844);
  players[idx] = {
    id: data.id,
    name: name || players[idx].replacedHumanName || players[idx].name || 'Player',
    avatar: humanAvatarAllowed783(avatarKey(data.avatar)) ? avatarKey(data.avatar) : AVATARS[0],
    voice: validHumanVoice(data.voice),
    team,
    seat,
    reconnectToken844,
    isHost: false,
    isBot: false,
    isTempBot: false,
    disconnected: false,
  };
  hostCancelDisconnectGrace(data.id);
  connMap[data.id] = conn;
  horPeerLastSeen[data.id] = Date.now();
  const msg = `✅ ${players[idx].name} reconnected`;
  try {
    showDisconnectBanner(msg);
  } catch (e) {}
  broadcast({ type: 'message', text: msg });
  broadcast({ type: 'players', players: publicPlayersSnapshot() });
  broadcastState();
  hostResyncClient(conn, data.id);
  return true;
}

function clientLeaveReplace() {
  const offline = isSoloPractice || roomCode === 'OFFLINE';
  const message = offline
    ? 'Leave this offline table?'
    : isHost
      ? 'You are the host. Leaving will end the room for everyone. Continue?'
      : 'Leave and let a bot take your seat?';
  if (!confirm(message)) return;
  leaveTableAfterConfirmation043();
}

// Both the rail arrow and the lobby Leave control release the same state.
function forgetRoomSession043() {
  try {
    sessionStorage.removeItem('rookSession');
  } catch (e) {}
  horMarkActiveTable(false);
  try {
    ['rejoinBtn', 'reconnectBox'].forEach((id) => {
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
    try {
      broadcast({ type: 'error', message: 'Host left the game.' });
    } catch (e) {}
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
  try {
    teardownMultiplayerBeforeLobby();
  } catch (e) {
    console.error(e);
  }
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
    const n = (game.hands[i] || []).filter((c) => isTrumpCard(c, game.trump)).length;
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
  return hand.some((c) => {
    if (typeof followsLedSuit === 'function') return followsLedSuit(c, color, trump);
    return c && c.color === color;
  });
}

function cardIsDefiniteWinner(card, seat) {
  if (!game || !game.hands || !card) return false;
  const trump = game.trump;
  const ledColor = isTrumpCard(card, trump) ? trump || card.color : card.color;
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
      if ((!mustFollow || (specialsAnytime && isSpecialCard(opp))) && isTrumpCard(opp, trump))
        return false;
    }
  }
  return true;
}

function allRemainingCardsAreDefiniteWinners(seat) {
  const hand = (game && game.hands && game.hands[seat]) || [];
  return hand.length > 0 && hand.every((c) => cardIsDefiniteWinner(c, seat));
}

/** Prove a winning sequence against every legal response, without changing play. */
function proveRestByLeading(seat) {
  const hands = game.hands.map((h) => [...h]);
  if (!game.trump || hands.some((h) => h.length > 16)) return false;
  const masks = hands.map((h) => (1 << h.length) - 1);
  const responders = [0, 1, 2, 3].filter((i) => i !== seat);
  const memo = new Map();
  let budget = 12000;
  const cards = (i, mask) => hands[i].filter((c, j) => mask & (1 << j));
  function win(state) {
    if (--budget < 0) return false; // An uncompleted proof never authorizes a claim.
    if (!state[seat]) return state.every((m) => m === 0);
    const key = state.join(',');
    if (memo.has(key)) return memo.get(key);
    const available = state.map((m, i) => cards(i, m));
    for (let j = 0; j < hands[seat].length; j++) {
      if (!(state[seat] & (1 << j))) continue;
      const lead = hands[seat][j];
      const led = isTrumpCard(lead, game.trump) ? game.trump : lead.color;
      const replies = responders.map((i) =>
        hands[i]
          .map((card, n) => ({ card, n }))
          .filter(
            ({ card, n }) => state[i] & (1 << n) && canPlay(card, available[i], led, game.trump)
          )
      );
      if (
        replies.some(
          (choices) =>
            !choices.length ||
            choices.some(({ card }) => compareCards(card, lead, led, game.trump) > 0)
        )
      )
        continue;
      const next = [...state];
      next[seat] &= ~(1 << j);
      function everyReply(k) {
        if (--budget < 0) return false;
        if (k === responders.length) return win(next);
        const i = responders[k];
        for (const { n } of replies[k]) {
          next[i] = state[i] & ~(1 << n);
          if (!everyReply(k + 1)) return false;
        }
        return true;
      }
      if (everyReply(0)) {
        memo.set(key, true);
        return true;
      }
      if (budget < 0) break;
    }
    memo.set(key, false);
    return false;
  }
  return win(masks);
}

/** Fast certificate: draw every opposing trump, then cash only unbeatable cards. */
function canDrawTrumpAndCashWinners(seat) {
  const hands = game.hands;
  const own = hands[seat];
  if (!game.trump || hands.some((h) => h.length !== own.length)) return false;
  const trumps = own
    .filter((c) => isTrumpCard(c, game.trump))
    .sort((a, b) => compareCards(b, a, game.trump, game.trump));
  const others = hands.filter((h, i) => i !== seat);
  const opposingTrumps = others.map((h) => h.filter((c) => isTrumpCard(c, game.trump)));
  const draws = Math.max(...opposingTrumps.map((h) => h.length));
  if (trumps.length < draws) return false;
  for (let n = 0; n < draws; n++) {
    if (
      opposingTrumps.some(
        (h) => h.length > n && h.some((c) => compareCards(c, trumps[n], game.trump, game.trump) > 0)
      )
    )
      return false;
  }
  return own
    .filter((c) => !isTrumpCard(c, game.trump))
    .every((c) =>
      others.every((h) =>
        h.every(
          (reply) =>
            isTrumpCard(reply, game.trump) ||
            reply.color !== c.color ||
            compareCards(reply, c, c.color, game.trump) <= 0
        )
      )
    );
}

/** A claim needs either independent winners or a fully proved lead sequence. */
function playerCanForceRest(seat) {
  if (!game || !game.hands) return false;
  const my = game.hands[seat] || [];
  if (!my.length) return false;
  let opp = 0;
  for (let i = 0; i < 4; i++) {
    if (i !== seat) opp += (game.hands[i] || []).length;
  }
  if (!opp) return true;
  const onlyTrumps = my.every((c) => isTrumpCard(c, game.trump));
  const otherTrumps = game.hands.some(
    (h, i) => i !== seat && h.some((c) => isTrumpCard(c, game.trump))
  );
  // An opponent can follow once, become void, then trump the next winner.
  // The old independent-card shortcut is safe only without that future ruff.
  if ((onlyTrumps || !otherTrumps) && allRemainingCardsAreDefiniteWinners(seat)) return true;
  if (canDrawTrumpAndCashWinners(seat)) return true;
  const key = JSON.stringify([
    seat,
    game.trump,
    specialsAnytime,
    mustTrumpWhenVoid,
    onesHigh,
    rookLowest,
    includeRook,
    includeRed1,
    includeRed2,
    game.hands.map((h) => h.map((c) => [c.id, c.color, c.rank])),
  ]);
  if (playerCanForceRest.proofCache?.key === key) return playerCanForceRest.proofCache.result;
  const result = proveRestByLeading(seat);
  playerCanForceRest.proofCache = { key, result };
  return result;
}

/**
 * Returns { seat, reason: 'trumps'|'rest' } when one player may claim the rest,
 * or null. Continue Playing dismisses the current opportunity until a card is played.
 */
function getRestClaimInfo() {
  if (layDownWinningCards === false) return null;
  if (!game || game.phase !== 'play' || !game.hands) return null;
  if (game.claimDeclined) return null;
  if (game.paused) return null;
  if (game.claimAnimation || game.claimAnimating) return null;
  if (game.resolvingTrick) return null;
  // Mid-trick: wait until the trick resolves
  if (game.trick && game.trick.length > 0) return null;
  const left = remainingCardsInHands();
  if (left < 2) return null;
  // Last trick (one card each) — just play it out. No lay-down.
  let maxLeft = 0;
  for (let i = 0; i < 4; i++) maxLeft = Math.max(maxLeft, (game.hands[i] || []).length);
  if (maxLeft <= 1) return null;

  const seat = game.currentPlayer;
  if (Number.isInteger(seat) && seat >= 0 && seat < 4 && playerCanForceRest(seat)) {
    return { seat, reason: getAllTrumpsHolder() === seat ? 'trumps' : 'rest' };
  }
  return null;
}

function getRestClaimHolder() {
  const info = getRestClaimInfo();
  return info ? info.seat : null;
}

function showAllTrumpsClaimUI() {
  if (isSpectator || !game || game.phase !== 'play') return;
  if (game.paused || game.resolvingTrick || game.claimAnimating || game.claimDeclined) return;
  if (game.trick?.length) return;
  // Guests have no opponents' hands. Only the host can prove eligibility;
  // guests display its public authorization, and the host rechecks on submit.
  const info = isHost
    ? getRestClaimInfo()
    : Number.isInteger(game.trumpClaimPlayer)
      ? { seat: game.trumpClaimPlayer, reason: game.trumpClaimReason || 'rest' }
      : null;
  if (!info || info.seat !== myIndex) return;
  // Only when it is the claimer's turn to play
  if (game.currentPlayer !== myIndex) return;

  const panel = ensureActionPanelOnTop() || $('actionPanel');
  if (!panel) return;

  const name = players?.[myIndex]?.name || 'You';
  const reasonText =
    info.reason === 'trumps'
      ? 'controls every remaining winning card'
      : 'can take the rest of the tricks';

  panel.className = 'action-panel trump-claim-panel lt-floating-panel';
  panel.classList.remove('hidden', 'bid-panel');
  panel.innerHTML = `
    <span><strong>${name}</strong> ${reasonText}.</span>
    <button type="button" id="layDownClaimBtn" class="btn primary">Lay Down &amp; End Hand</button>
    <button type="button" id="continueClaimBtn" class="btn">Continue Playing</button>`;

  const layBtn = $('layDownClaimBtn');
  if (layBtn)
    layBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isHost) hostProcessAllTrumpsClaim({ player: myIndex });
      else if (hostConnection && hostConnection.open)
        hostConnection.send({ type: 'claimAllTrumps', player: myIndex });
    };
  const contBtn = $('continueClaimBtn');
  if (contBtn)
    contBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isHost) hostDeclineClaim(myIndex);
      else if (hostConnection && hostConnection.open)
        hostConnection.send({ type: 'declineClaim', player: myIndex });
      hideActionPanel();
    };
}

function hostDeclineClaim(player) {
  if (!isHost || !game || game.phase !== 'play') return;
  if (player !== game.currentPlayer) return;
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
  if (
    !isHost ||
    !game ||
    game.phase !== 'play' ||
    game.paused ||
    !data ||
    data.player !== game.currentPlayer
  )
    return;
  if (game.resolvingTrick || game.claimAnimating) return;
  const info = getRestClaimInfo();
  if (!info || data.player !== info.seat) return;
  const holder = info.seat;

  // Snapshot every player's remaining cards before the claim clears all hands.
  game.claimRevealHands = (game.hands || []).map((hand, i) => ({
    player: i,
    name: (players[i] && players[i].name) || `Player ${i + 1}`,
    team: players[i] ? players[i].team : i % 2,
    laidDown: i === holder,
    cards: (hand || []).map((c) => ({ ...c })),
  }));
  // Snapshot holder's cards for the lay-down animation (only their hand)
  const holderCards = (game.hands[holder] || []).map((c) => ({ ...c }));

  // Award every remaining card (trick + all hands) to the claimer's team
  const claimCards = (game.trick || []).map((t) => ({ ...t.card }));
  for (let i = 0; i < 4; i++) {
    for (const c of game.hands[i] || []) claimCards.push({ ...c });
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
    if (claimCards.some(isRed2)) holderStat.red2Captures++;
    if (claimCards.some((c) => c.color === 'rook' || c.id === 'rook')) holderStat.rookCaptures++;
    if (!game.careerExtras) game.careerExtras = [{}, {}, {}, {}];
    if (
      (game.trick || []).some(
        (t) => isRed2(t.card) && players[t.player].team !== players[holder].team
      ) ||
      (game.hands || []).some((h, i) => players[i].team !== players[holder].team && h.some(isRed2))
    )
      game.careerExtras[holder].red2Rescues = (game.careerExtras[holder].red2Rescues || 0) + 1;
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
  game.myHand = holder === myIndex ? [] : game.myHand || [];
  game.resolvingTrick = true;
  game.claimAnimating = true;
  game.trumpClaimPlayer = holder;
  game.laidDownBy = holder;
  game.laidDownName = (players[holder] && players[holder].name) || 'Player ' + (holder + 1);
  game.claimLastTricks =
    typeof recentTricks !== 'undefined' && recentTricks
      ? recentTricks.slice(0, 3).map((tr) => ({
          winner: tr.winner,
          plays: (tr.plays || []).map((t) => ({
            player: t.player,
            card: t.card ? { ...t.card } : t.card,
          })),
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

  const reasonMsg =
    info.reason === 'trumps'
      ? 'lays down all remaining winning cards and ends the hand'
      : 'lays down the rest of the tricks and ends the hand';
  try {
    clearTurnTimer();
  } catch (e) {}
  try {
    hideActionPanel();
  } catch (e) {}
  broadcast({ type: 'message', text: `🃏 ${players[holder].name} ${reasonMsg}.` });
  broadcastState();

  // Animation: land ~1.2s + hold 2s + fade 0.8s ≈ 4s total
  const claimingGame = game,
    claimingAnimation = game.claimAnimation;
  const finishClaim = () => {
    if (
      game !== claimingGame ||
      game.phase !== 'play' ||
      game.claimAnimation !== claimingAnimation ||
      !game.claimAnimating
    )
      return;
    if (game.paused) {
      game._resumeTrick = finishClaim;
      return;
    }
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
  banner.textContent =
    reason === 'trumps'
      ? `${holderName} lays down the remaining winning cards`
      : `${holderName} lays down the rest of the tricks`;
  layer.appendChild(banner);

  // Origin direction relative to local view
  const seatBase = myIndex >= 0 ? myIndex : 0;
  let fromX = 0,
    fromY = 90,
    fromRot = 0;
  if (holder === seatBase) {
    fromX = 0;
    fromY = 140;
    fromRot = 8;
  } else if (holder === (seatBase + 2) % 4) {
    fromX = 0;
    fromY = -140;
    fromRot = -8;
  } else if (holder === (seatBase + 1) % 4) {
    fromX = -160;
    fromY = 20;
    fromRot = -18;
  } else {
    fromX = 160;
    fromY = 20;
    fromRot = 18;
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
    const claimScale = (0.85 * Math.max(innerWidth / 875, innerHeight / 1797)) / (915 / 1797);
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
    try {
      renderHand(false);
    } catch (e) {}
  }
  try {
    renderUI();
  } catch (e) {}

  // Land time ≈ 0.06*n + 0.7s; then hold 2s; then fade 0.8s
  const landMs = Math.min(1200, 80 + n * 60 + 700);
  if (window._claimAnimFadeTimer) clearTimeout(window._claimAnimFadeTimer);
  if (window._claimAnimRemoveTimer) clearTimeout(window._claimAnimRemoveTimer);
  window._claimAnimFadeTimer = setTimeout(
    () => {
      if (!layer || !layer.parentNode) {
        window._claimAnimPlaying = false;
        return;
      }
      layer.classList.add('fade-out');
      window._claimAnimRemoveTimer = setTimeout(
        () => {
          if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
          window._claimAnimPlaying = false;
        },
        solScaledDelay(850, 0)
      );
    },
    solScaledDelay(landMs + 2000, 0)
  );
}

/** Legacy no-op — claim no longer uses the all-hands modal box. */
function showTrumpShowdown() {
  const modal = $('trumpShowdownModal');
  if (modal) modal.classList.add('hidden');
}

function hostPromptPlay() {
  if (!game || game.phase !== 'play' || game.trumpPresentation833) return;
  if (game.resolvingTrick || game.claimAnimating) return;
  if (game.paused) return;
  try {
    const panel = $('actionPanel');
    if (
      panel &&
      (panel.classList.contains('trump-showdown') ||
        /stamp the trump|choose trump/i.test(panel.textContent || ''))
    ) {
      hideActionPanel();
    }
  } catch (e) {}

  const claimInfo = getRestClaimInfo();
  game.trumpClaimPlayer = claimInfo ? claimInfo.seat : null;
  // Bot auto-claim only when it is that bot's turn (never block the human)
  if (
    claimInfo &&
    players[claimInfo.seat] &&
    players[claimInfo.seat].isBot &&
    game.currentPlayer === claimInfo.seat
  ) {
    hideActionPanel();
    setTimeout(
      () => {
        if (!game || game.phase !== 'play' || game.claimAnimating) return;
        const again = getRestClaimInfo();
        if (again && again.seat === claimInfo.seat && game.currentPlayer === claimInfo.seat) {
          hostProcessAllTrumpsClaim({ player: claimInfo.seat });
        }
      },
      solScaledDelay(450, 0)
    );
    return;
  }
  // Pre-selecting a card ahead of your turn has been removed (it caused a
  // render-thrashing freeze when rapidly re-tapped) — plays only submit
  // when it's actually the player's turn now, so nothing to check here.

  const p = players[game.currentPlayer];
  const name = (p && p.name) || 'Player';
  const msg =
    game.currentPlayer === myIndex
      ? `${name} to play — tap a gold-highlighted card`
      : `${name} to play`;
  $('messageArea').textContent = msg;
  broadcast({ type: 'message', text: msg });
  if (game.currentPlayer === myIndex) {
    lastTurnIndex = myIndex;
    renderHand();
    try {
      renderUI();
    } catch (e) {}
    try {
      maybeRemindTurn();
    } catch (e) {}
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
  if (!game || game.phase !== 'play' || game.trumpPresentation833 || myIndex < 0 || isSpectator)
    return false;
  const id = String(cardId);
  if (game.currentPlayer !== myIndex || game.resolvingTrick || game.paused) {
    const msg = $('messageArea');
    if (msg) msg.textContent = 'Wait for your turn to play a card.';
    return false;
  }
  const hand = game.myHand || [];
  const card = hand.find((c) => String(c.id) === id);
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
  if (!game || game.phase !== 'play' || game.trumpPresentation833) return;
  if (game.resolvingTrick) return;
  if (game.paused) return;
  if (data.player !== game.currentPlayer) return;
  if (players[data.player] && players[data.player].disconnected) return;
  if (horRememberAction(data)) return;
  const hand = game.hands[data.player];
  if (!hand) return;
  const idx = hand.findIndex((c) => c.id === data.cardId);
  if (idx < 0) return;
  const card = hand[idx];
  if (!canPlay(card, hand, game.ledColor, game.trump)) return;

  // Continue Playing dismisses this opportunity, not every later lead.
  game.claimDeclined = false;
  hand.splice(idx, 1);
  if (!game.ledColor) {
    game.ledColor = card.color === 'rook' || isRed2(card) || isRed1(card) ? game.trump : card.color;
  } else if (
    game.ledColor &&
    typeof followsLedSuit === 'function' &&
    !followsLedSuit(card, game.ledColor, game.trump)
  ) {
    // Failed to follow — mark void for extreme AI. Playing a special on a
    // color lead also proves the void unless specials-anytime is on.
    const specialEscape = !!(
      typeof specialsAnytime !== 'undefined' &&
      specialsAnytime &&
      isSpecialCard(card)
    );
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
    game.tricksTaken[team].push(...game.trick.map((t) => t.card));
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
      if (!game.careerExtras) game.careerExtras = [{}, {}, {}, {}];
      const ce = game.careerExtras[winner.player];
      ce.bestTrickPoints = Math.max(ce.bestTrickPoints || 0, trickPoints);
      if (game.trick.some((t) => t.card && isRed2(t.card) && players[t.player].team !== team))
        ce.red2Rescues = (ce.red2Rescues || 0) + 1;
      if (game.trick.some((t) => t.card && (t.card.color === 'rook' || t.card.id === 'rook')))
        wStat.rookCaptures++;
      if (game.trick.some((t) => t.card && isRed2(t.card))) wStat.red2Captures++;
    } catch (e) {}
    try {
      const wName = (players[winner.player] && players[winner.player].name) || 'Player';
      const rookTaken = game.trick.some(
        (t) => t.card && (t.card.color === 'rook' || t.card.id === 'rook')
      );
      const red2Taken = game.trick.some((t) => t.card && isRed2(t.card));
      if (rookTaken) botMaybeTableTalk('rook', { name: wName, prefer: winner.player });
      else if (red2Taken) botMaybeTableTalk('red2', { name: wName, prefer: winner.player });
      else if (trickPoints >= 30)
        botMaybeTableTalk('highPts', { name: wName, pts: trickPoints, prefer: winner.player });
      else if (players[winner.player] && players[winner.player].isBot) {
        botMaybeTableTalk('trickWin', { name: wName, pts: trickPoints, prefer: winner.player });
      } else {
        botMaybeTableTalk('trickLose', { name: wName, pts: trickPoints });
      }
    } catch (e) {}
    const msg = `🏆 ${players[winner.player].name} wins the trick!`;
    const subject = captureSubject793(players[winner.player].name, players[winner.player].id);
    $('messageArea').textContent = '🏆 ' + subject.name + subject.win + ' the trick!';
    broadcast({
      type: 'message',
      text: msg,
      event: 'trick-winner',
      winnerName: players[winner.player].name,
      winnerId: players[winner.player].id,
    });
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
          caps.forEach((kind) =>
            events.push({ kind, winnerName: wName, winnerId: players[winner.player]?.id })
          );
        }
        // The Raven capture owns this trick's celebration; accounting above stays intact.
        if (trickPoints >= 30 && !caps.includes('rook-red2')) {
          events.push({
            kind: 'high-points',
            amount: trickPoints,
            winnerName: wName,
            winnerId: players[winner.player]?.id,
          });
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

    // Give players a short, deliberate pause to see the winning trick before
    // the celebration overlay/fanfare starts.
    const resolvingGame = game,
      resolvingCards = game.trick;
    const ownsResolution = () =>
      game === resolvingGame &&
      game.trick === resolvingCards &&
      game.phase === 'play' &&
      game.resolvingTrick;
    if (pendingCaptureEvents.events.length) {
      setTimeout(
        () => {
          if (!ownsResolution()) return;
          try {
            queueCaptureCelebrations(pendingCaptureEvents.events, pendingCaptureEvents.winnerName);
            broadcast({
              type: 'specialCapture',
              kinds: pendingCaptureEvents.events,
              winnerName: pendingCaptureEvents.winnerName,
            });
          } catch (e) {}
        },
        solScaledDelay(850, 45)
      );
    }

    const finishTrick = () => {
      if (!ownsResolution()) return;
      if (game.paused) {
        game._resumeTrick = finishTrick;
        return;
      }
      delete game._resumeTrick;
      try {
        lastCompletedTrick = game.trick.map((t) => ({ player: t.player, card: { ...t.card } }));
        lastCompletedTrickWinner = winner.player;
        const entry = {
          plays: lastCompletedTrick,
          winner: winner.player,
          ledColor: game.ledColor,
          trump: game.trump,
          points: trickPoints,
          team: team,
          winnerName: (players[winner.player] && players[winner.player].name) || 'Player',
          hand: handHistory && handHistory.length ? handHistory.length + 1 : 1,
        };
        recentTricks = [entry].concat(recentTricks || []).slice(0, 3);
        refreshPortraitLastTrick029();
        try {
          recordMatchTrick(entry);
        } catch (e) {}
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
      try {
        syncPortraitPreviousTrickTarget();
        maybeShowPortraitLastTrickHint();
      } catch (e) {}
      window._trickCapturing = false;
      window._trickFlightKey = '';
      window._trickTakenRel = -1;
      try {
        clearTrickFlightLayers();
      } catch (e) {}
      try {
        clearBottomTookMark();
      } catch (e) {}
      try {
        updateLandscapeTheater();
      } catch (e) {}
      try {
        window.HORCharacterStudio077?.sync();
      } catch (e) {
        console.warn('Character presentation:', e);
      }
      if (game.hands.every((h) => h.length === 0)) {
        hostEndHand();
      } else {
        broadcastState();
        hostPromptPlay();
      }
    };
    // Landscape presentation has a bounded, pace-aware collection budget.
    // Existing resolution identity guard also protects cancellation/new hands.
    const fightHold837 =
      window.HORRavenFight741?.collectionDelay(
        game,
        horGamePace,
        reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
        !isSoloPractice
      ) || 0;
    setTimeout(finishTrick, Math.max(solScaledDelay(2800, 700), fightHold837));
  } else {
    game.currentPlayer = (game.currentPlayer + 1) % 4;
    broadcastState();
    hostPromptPlay();
  }
}

function nestCardMarkup(card) {
  try {
    if (typeof renderCardHTML === 'function') return renderCardHTML(card, true);
  } catch (e) {}
  try {
    let cls = card && card.color === 'rook' ? 'rook' : (card && card.color) || '';
    if (typeof isRed2 === 'function' && isRed2(card) && includeRed2) cls = 'red2 red2-art';
    else if (typeof isRed2 === 'function' && isRed2(card)) cls = 'red';
    if (typeof isRed1 === 'function' && isRed1(card)) cls = 'red1';
    const inner =
      typeof cardInnerHTML === 'function'
        ? cardInnerHTML(card)
        : (card && (card.rank || card.id)) || '?';
    return '<div class="card-face ' + cls + ' small">' + inner + '</div>';
  } catch (e) {
    return '<div class="card-face">' + ((card && (card.rank || card.id)) || '?') + '</div>';
  }
}

/** Show nest capture overlay for ~3s, then fade. Returns hold time in ms (0 if skipped). */
function showNestCaptureAnimation(winnerName, nestCards, pts) {
  // The House effect replaces the legacy nest overlay and its blocking hold.
  // Actual nest cards and points remain available on the scoreboard.
  if (nestLastTrickAnim === false || window.HOREndHandEffectsV12) return 0;
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
    const table =
      document.querySelector('.table-felt') || document.querySelector('.table') || document.body;
    const rect = table.getBoundingClientRect();
    layer.style.left = Math.round(rect.left + rect.width * 0.5) + 'px';
    layer.style.top = Math.round(rect.top + rect.height * 0.53) + 'px';
    const cardW = Math.max(
      58,
      Math.min(92, Math.round(Math.min(rect.width || window.innerWidth, window.height) * 0.17))
    );
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
      setTimeout(
        () => {
          try {
            inner.classList.add('revealed');
          } catch (_) {}
        },
        solScaledDelay(650 + i * 65, 100)
      );
      // Silent end-of-hand nest reveal: stacking six ordinary card cues made a burst.
    });
    setTimeout(() => {
      try {
        layer.classList.add('out');
      } catch (_) {}
    }, HOLD_MS);
    setTimeout(() => {
      try {
        layer.remove();
      } catch (_) {}
    }, HOLD_MS + FADE_MS);
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
  try {
    clearTimeoutBotsAfterHand();
  } catch (e) {}
  try {
    clearClaimOverlays();
  } catch (e) {}

  const lastTeam = players[game.currentPlayer].team;
  const bidderTeam = players[game.bidder].team;
  let nestHoldMs = 0;
  let nestWinnerName = '';
  let nestPtsShown = 0;
  // Nest counters: last-trick winner (default) or always bidder team
  // Freeze a completely independent copy before moving nest cards into tricks.
  // Nothing below this point is allowed to mutate what the scoreboard will display.
  const nestSnapshot = (
    (Array.isArray(game.nestRevealCards) && game.nestRevealCards.length && game.nestRevealCards) ||
    (Array.isArray(game.nestCards) && game.nestCards.length && game.nestCards) ||
    []
  ).map((c) => ({ ...c }));
  game.nestRevealCards = nestSnapshot.map((c) => ({ ...c }));
  if (nestSnapshot.length) {
    const nestTeam = nestGoesTo === 'bidder' ? bidderTeam : lastTeam;
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
        cards: nestSnapshot.map((c) => ({ ...c })),
        pts: nestPtsShown,
      });
      nestHoldMs = showNestCaptureAnimation(nestWinnerName, nestSnapshot, nestPtsShown) || 0;
    } catch (e) {
      console.error('Nest reveal error:', e);
    }
    game.tricksTaken[nestTeam].push(...nestSnapshot.map((c) => ({ ...c })));
    try {
      const nestSeat =
        nestGoesTo === 'bidder' && game.bidder != null ? game.bidder : game.currentPlayer;
      try {
        const nStat = ps(nestSeat);
        nStat.nestWins++;
        if (nestSnapshot.some(isRed2)) nStat.red2Captures++;
        if (nestSnapshot.some((c) => c.color === 'rook' || c.id === 'rook')) nStat.rookCaptures++;
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
      try {
        botMaybeTableTalk('nest', { name: nestWinnerName, pts: nestPtsShown, prefer: nestSeat });
      } catch (e) {}
    } catch (e) {}
  }

  let pointsA = 0,
    pointsB = 0;
  (game.tricksTaken[0] || []).forEach((c) => {
    pointsA += cardPoints(c);
  });
  (game.tricksTaken[1] || []).forEach((c) => {
    pointsB += cardPoints(c);
  });

  // Every counter in the deck must land on a team — fix drift (missing nest, bad ids, etc.)
  const expected = totalCountersInDeck();
  const got = pointsA + pointsB;
  if (got !== expected) {
    console.warn(
      'Counter total mismatch:',
      got,
      'expected',
      expected,
      '— adjusting last-trick team'
    );
    const diff = expected - got;
    if (lastTeam === 0) pointsA += diff;
    else pointsB += diff;
  }

  let made = false;
  let scoreDeltaA = 0,
    scoreDeltaB = 0;
  // A made bid scores captured counters (or the selected bid-only amount). A set loses the bid.
  const applyMakerScore = (team, pts) => {
    const bid = game.bid;
    if (pts < bid) {
      const delta = -bid;
      if (team === 0) {
        scoreDeltaA = delta;
        game.scores[0] += delta;
      } else {
        scoreDeltaB = delta;
        game.scores[1] += delta;
      }
      return false;
    }
    let delta = pts;
    if (bidOnlyScoring) {
      delta = bid;
    }
    const finalDelta = delta;
    if (team === 0) {
      scoreDeltaA = finalDelta;
      game.scores[0] += finalDelta;
    } else {
      scoreDeltaB = finalDelta;
      game.scores[1] += finalDelta;
    }
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
        if (bidderTeam === 0) scoreDeltaA += bonus;
        else scoreDeltaB += bonus;
      }
    } else {
      shotMoonResult = 'failed';
    }
  }

  try {
    botMaybeTableTalk(made ? 'made' : 'set', { prefer: game.bidder });
  } catch (e) {}
  try {
    botMaybeStandingsTaunt();
  } catch (e) {}

  game.phase = 'score';
  // Clear the relocated pot as soon as the completed hand leaves play.
  if ($('holderPlayerName784')) renderTrickPot784();
  try {
    clearTrumpBanners();
  } catch (e) {}
  try {
    playSfx(made ? 'made' : 'set', { broadcastNet: true });
  } catch (e) {}
  try {
    if (shotMoonResult) {
      const bidderName =
        (players[game.bidder] && players[game.bidder].name) || 'P' + (game.bidder + 1);
      const moonMsg =
        shotMoonResult === 'made'
          ? `${bidderName} shot the moon and wins the game!`
          : `${bidderName} tried to shoot the moon and missed.`;
      const ma = $('messageArea');
      if (ma) ma.textContent = moonMsg;
      broadcast({ type: 'message', text: moonMsg });
    }
  } catch (e) {}

  const summary = {
    pointsA,
    pointsB,
    bid: game.bid,
    bidderTeam,
    made,
    trump: game.trump,
    scores: [...game.scores],
    scoreDeltaA,
    scoreDeltaB,
    shotTheMoon: !!game.shotTheMoon,
    shotMoonResult,

    nestWinnerName,
    nestPts: nestPtsShown,
    nestCards: nestSnapshot.map((c) => ({ ...c })),
    nestWinnerName: nestWinnerName || null,
    nestPts: nestPtsShown || 0,
    claimRevealHands: Array.isArray(game.claimRevealHands)
      ? game.claimRevealHands.map((h) => ({
          player: h.player,
          name: h.name,
          team: h.team,
          cards: (h.cards || []).map((c) => ({ ...c })),
        }))
      : null,
    claimer:
      typeof game.laidDownBy === 'number'
        ? game.laidDownBy
        : typeof game.trumpClaimPlayer === 'number'
          ? game.trumpClaimPlayer
          : null,
    claimerName: game.laidDownName || null,
    claimReason: (game.claimAnimation && game.claimAnimation.reason) || null,
    lastTricks: (Array.isArray(game.claimLastTricks) && game.claimLastTricks.length
      ? game.claimLastTricks
      : typeof recentTricks !== 'undefined' && recentTricks
        ? recentTricks
        : []
    )
      .slice(0, 3)
      .map((tr) => ({
        winner: tr.winner,
        plays: (tr.plays || []).map((t) => ({
          player: t.player,
          card: t.card ? { ...t.card } : t.card,
        })),
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
    for (let i = 0; i < 4; i++) {
      if (players[i]) ps(i).hands++;
    }
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
    if (made) bStat.bidsMade++;
    else bStat.bidsSet++;
    if (game.shotTheMoon) {
      bStat.moonAttempts++;
      if (shotMoonResult === 'made') bStat.moonMade++;
    }
  } catch (e) {}

  summary.careerEvent = {
    matchId: game.careerMatchId || (game.careerMatchId = crypto.randomUUID()),
    hand: handHistory.length,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      team: p.team,
      avatar: p.avatar || null,
    })),
    stats: playerStats.map((s) => ({ ...s })),
    extras: JSON.parse(JSON.stringify(game.careerExtras || [{}, {}, {}, {}])),
    bidder: game.bidder,
    tricksPerHand: handSize,
    completed: !!getMatchResult(game.scores, game.targetScore || targetScore || 300),
    winnerTeam:
      getMatchResult(game.scores, game.targetScore || targetScore || 300) === 'Team A'
        ? 0
        : getMatchResult(game.scores, game.targetScore || targetScore || 300) === 'Team B'
          ? 1
          : null,
    summary: { pointsA, pointsB, bid: game.bid, made, trump: game.trump, scores: [...game.scores] },
  };
  window.HOREndHandEffectsV12?.prepare();
  horRecordCareerHand(summary.careerEvent);
  const finishToScore = () => {
    broadcast({
      type: 'handResult',
      summary,
      history: handHistory,
      matchTricks: matchTricks || [],
      matchStats: { ...matchStats },
      playerStats: playerStats.map((s) => ({ ...s })),
    });
    broadcastState();
    presentCompletedHandV12(summary);
  };

  // Nest overlay holds 3s, then fade into the score page
  if (nestHoldMs > 0) {
    setTimeout(finishToScore, nestHoldMs);
  } else {
    finishToScore();
  }
}

// Presentation owns no points, hands or career state. Reopening scores bypasses it.
function presentCompletedHandV12(summary) {
  const owner = game;
  const current = () => game === owner && game?.phase === 'score';
  const reveal = () => {
    if (current()) showScoreModal(summary);
  };
  const complete = () => {
    if (!current()) return;
    try {
      window.HORJeromeVoiceLines?.result(summary);
    } catch (e) {}
    const finalScores = summary.scores || game.scores;
    const winner = getMatchResult(finalScores, game.targetScore || targetScore || 500);
    if (winner) {
      try {
        mergeLifetimeStats(winner);
      } catch (e) {}
      showWinCelebration(winner, [...finalScores]);
    }
  };
  const event = summary.careerEvent;
  const key = [
    event?.matchId || game?.careerMatchId,
    event?.hand || handHistory.length,
    ...(summary.scores || []),
  ].join(':');
  if (window.HOREndHandEffectsV12) {
    try {
      window.HOREndHandEffectsV12.play({
        key,
        onReveal: reveal,
        onComplete: complete,
        reduced: reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
    } catch (error) {
      console.error('End-hand presentation:', error);
      reveal();
      complete();
    }
  } else {
    reveal();
    complete();
  }
}

function isLaidDownWinnerSeat(h, summary) {
  if (!h) return false;
  if (h.laidDown) return true;
  if (summary && typeof summary.claimer === 'number')
    return Number(h.player) === Number(summary.claimer);
  return false;
}
function remainingHandCardHTML(card) {
  if (!card) return '';
  // Use the same full face markup as in-play cards (not the "small" face).
  // Landscape remaining-card clipping was caused by .small + 2.35rem ranks
  // inside a 32px box. Full faces + CSS variables keep the art intact.
  let cls = card.color === 'rook' || card.id === 'rook' ? 'rook' : card.color || '';
  if (typeof isRed2 === 'function' && isRed2(card) && includeRed2) cls = 'red2 red2-art';
  else if (typeof isRed2 === 'function' && isRed2(card)) cls = 'red';
  if (typeof isRed1 === 'function' && isRed1(card)) cls = 'red1';
  const inner = typeof cardInnerHTML === 'function' ? cardInnerHTML(card) : '';
  const id = typeof escapeHtmlSafe === 'function' ? escapeHtmlSafe(card.id || '') : card.id || '';
  return `<div class="card-face claim-remaining-card ${cls}" data-id="${id}">${inner}</div>`;
}

function showClaimRemainingHands(summary) {
  const modal = $('scoreModal');
  const body = $('scoreModalBody');
  const hands = Array.isArray(summary && summary.claimRevealHands) ? summary.claimRevealHands : [];
  if (!modal || !body || !hands.length) return;
  modal.classList.add('showing-remaining');
  try {
    document.body.classList.add('remaining-open');
  } catch (e) {}
  const section = document.createElement('section');
  section.id = 'claimRemainingHands';
  section.className = 'claim-remaining-hands';
  const cardsHtml = hands
    .map((h) => {
      const laid = isLaidDownWinnerSeat(h, summary);
      const cls = 'claim-remaining-player' + (laid ? ' is-laid-winner' : '');
      const tag = laid ? '<em class="winner-tag">Laid down</em>' : '';
      const teamName =
        typeof teamLabel === 'function' ? teamLabel(h.team) : h.team === 0 ? 'Griffin' : 'Raven';
      const cards = (h.cards || []).length
        ? h.cards.map((c) => remainingHandCardHTML(c)).join('')
        : '<span class="claim-remaining-none">No cards left</span>';
      const nCards = (h.cards || []).length;
      return (
        '<div class="' +
        cls +
        '" data-team="' +
        (h.team === 0 ? 'griffin' : 'raven') +
        '">' +
        '<div class="claim-remaining-player-title"><span class="cr-name"><b>' +
        escapeHtmlSafe(h.name) +
        '</b>' +
        tag +
        '</span><span class="cr-team">' +
        teamName +
        '</span></div>' +
        '<div class="claim-remaining-cards" data-count="' +
        nCards +
        '">' +
        cards +
        '</div></div>'
      );
    })
    .join('');
  const claimerHand =
    hands.find((h) => h.laidDown) ||
    hands.find(
      (h) => typeof summary.claimer === 'number' && Number(h.player) === Number(summary.claimer)
    );
  const claimerName =
    summary.claimerName ||
    (claimerHand && claimerHand.name) ||
    (players[summary.claimer] && players[summary.claimer].name) ||
    (typeof summary.claimer === 'number' ? 'Player ' + (summary.claimer + 1) : '');
  const trumpName =
    typeof COLOR_NAMES !== 'undefined' && COLOR_NAMES[summary.trump]
      ? COLOR_NAMES[summary.trump]
      : summary.trump || '—';
  const whoLine = claimerName
    ? '<b>' +
      escapeHtmlSafe(claimerName) +
      '</b> laid down · Trump <b>' +
      escapeHtmlSafe(String(trumpName)) +
      '</b>'
    : 'Trump <b>' + escapeHtmlSafe(String(trumpName)) + '</b>';
  section.innerHTML =
    '<div class="claim-remaining-meta">' +
    whoLine +
    '</div>' +
    '<div class="claim-remaining-grid">' +
    cardsHtml +
    '</div>';
  body.innerHTML = '';
  body.appendChild(section);
  try {
    body.scrollTop = 0;
  } catch (e) {}
  try {
    wireScoreModalActions(summary);
  } catch (e) {}
  try {
    fitClaimRemainingCards();
  } catch (e) {}
  requestAnimationFrame(() => {
    try {
      fitClaimRemainingCards();
    } catch (e) {}
  });
  setTimeout(() => {
    try {
      fitClaimRemainingCards();
    } catch (e) {}
  }, 60);
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
        w -=
          (parseFloat(cs.paddingLeft) || 0) +
          (parseFloat(cs.paddingRight) || 0) +
          (parseFloat(cs.borderLeftWidth) || 0) +
          (parseFloat(cs.borderRightWidth) || 0);
        h -=
          (parseFloat(cs.paddingTop) || 0) +
          (parseFloat(cs.paddingBottom) || 0) +
          (parseFloat(cs.borderTopWidth) || 0) +
          (parseFloat(cs.borderBottomWidth) || 0);
      }
    }
    if (w < 20)
      w = Math.max(80, Math.floor(((modal && modal.clientWidth) || window.innerWidth) * 0.42));
    if (h < 40) h = Math.max(90, Math.floor(modalH * 0.28) - 40);
    const gap = n >= 10 ? 2 : n >= 7 ? 3 : 4;
    let best = {
      cols: Math.min(3, n),
      rows: Math.ceil(n / Math.min(3, n)),
      area: -1,
      cw: 20,
      ch: 29,
    };
    const maxCols = Math.min(n, 7);
    for (let cols = 1; cols <= maxCols; cols++) {
      if (portraitLaydown && n === 4 && cols !== 2) continue;
      const rows = Math.ceil(n / cols);
      const cellW = (w - gap * (cols - 1)) / cols;
      const cellH = (h - gap * (rows - 1)) / rows;
      if (cellW < 12 || cellH < 16) continue;
      let ch = Math.min(cellH, cellW / ratio);
      let cw = ch * ratio;
      if (cw > cellW) {
        cw = cellW;
        ch = cw / ratio;
      }
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
  const rerun = () => {
    try {
      fitClaimRemainingCards();
    } catch (e) {}
  };
  window.addEventListener('resize', rerun);
  window.addEventListener('orientationchange', () => setTimeout(rerun, 80));
}

function statMadePct(s) {
  const total = (s.bidsMade || 0) + (s.bidsSet || 0);
  return total ? Math.round((s.bidsMade / total) * 100) : 0;
}
function statAvgBid(s) {
  return s.bidsWon ? Math.round(s.bidSum / s.bidsWon) : 0;
}
function statTeamClass(team) {
  return team === 0 ? 'team-a' : 'team-b';
}
function statTeamName(team) {
  return typeof teamLabel === 'function' ? teamLabel(team) : team === 0 ? 'Griffin' : 'Raven';
}
function esc(t) {
  return typeof escapeHtmlSafe === 'function'
    ? escapeHtmlSafe(String(t == null ? '' : t))
    : String(t == null ? '' : t);
}

function renderStatChips(s) {
  const chips = [];
  if (s.rookCaptures)
    chips.push(
      `<span class="stat-chip chip-rook" title="Rook captures">ROOK ${s.rookCaptures}</span>`
    );
  if (s.red2Captures)
    chips.push(
      `<span class="stat-chip chip-red2" title="Red 2 captures">🔴 ${s.red2Captures}</span>`
    );
  if (s.bigTricks)
    chips.push(
      `<span class="stat-chip chip-big" title="30+ point tricks">💥 ${s.bigTricks}</span>`
    );
  if (s.nestWins)
    chips.push(`<span class="stat-chip chip-nest" title="Nest captures">🪺 ${s.nestWins}</span>`);
  if (s.moonAttempts)
    chips.push(
      `<span class="stat-chip chip-moon" title="Shoot the Moon attempts / made">🌙 ${s.moonMade || 0}/${s.moonAttempts}</span>`
    );
  if (s.bags)
    chips.push(
      `<span class="stat-chip chip-bag" title="Historical bag record">👝 ${s.bags}</span>`
    );
  return chips.length ? `<div class="stat-chips">${chips.join('')}</div>` : '';
}

function renderPlayerStatCard(i, topScorerIdx) {
  const p = players[i];
  if (!p) return '';
  const s = ps(i);
  const pct = statMadePct(s);
  const avgBid = statAvgBid(s);
  const isLeader = i === topScorerIdx && (s.points || 0) > 0;
  const roleTag = p.isBot
    ? `Bot · ${(typeof STYLE_TITLES !== 'undefined' && STYLE_TITLES[p.botStyle]) || 'Bot'}`
    : p.id === myPeerId
      ? 'You'
      : 'Player';
  const avatarHtml = typeof avatarHTML === 'function' ? avatarHTML(p.avatar || 'rookling') : '';
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
  'Blaze',
  'Fang',
  'Wager',
  'Moss',
  'Quill',
  'Halo',
  'Gable',
  'Titan',
  'Crow',
  'Drift',
  'Hollow',
  'Vex',
  'Marrow',
  'Pike',
  'Thistle',
  'Frost',
  'Bramble',
  'Ember',
  'Emberlyn',
  'Pebble',
  'Dice',
  'Nix',
  'Anchor',
  'Cinder',
];

function renderAllTimeLeaders() {
  const store = loadLifetimeStats();
  const names = Object.keys(store);
  if (!names.length)
    return '<div class="stats-empty">No all-time stats yet — finish a full game to start the record book.</div>';
  const rows = names
    .map((n) => ({ name: n, ...store[n] }))
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 8);
  const medals = ['🥇', '🥈', '🥉'];
  return (
    `<div class="alltime-list">` +
    rows
      .map(
        (r, idx) => `
    <div class="alltime-row">
      <span class="alltime-rank">${medals[idx] || '#' + (idx + 1)}</span>
      <span class="alltime-name">${esc(r.name)}${r.isBot ? ' <em class="alltime-bot-tag">bot</em>' : ''}</span>
      <span class="alltime-pts">${r.points || 0} pts</span>
      <span class="alltime-games">${r.gamesWon || 0}/${r.gamesPlayed || 0} games</span>
    </div>`
      )
      .join('') +
    '</div>'
  );
}

function wireStatsAllTimeToggle() {
  const btn = $('statsAllTimeBtn');
  const box = $('statsAllTimeBody');
  if (!btn || !box) return;
  btn.onclick = () => {
    const showing = !box.classList.contains('hidden');
    if (showing) {
      box.classList.add('hidden');
      btn.textContent = '🏆 All-time leaders';
      return;
    }
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
  const seats = [0, 1, 2, 3].filter((i) => players[i]);
  let topScorerIdx = -1,
    topPts = -1;
  seats.forEach((i) => {
    const pts = ps(i).points || 0;
    if (pts > topPts) {
      topPts = pts;
      topScorerIdx = i;
    }
  });
  // Player points are partnership-attributed, so each teammate carries the
  // same team total. Average the two seats here to keep the team comparison
  // from displaying a doubled total.
  const teamAPointsSeats = seats.filter((i) => players[i].team === 0);
  const teamBPointsSeats = seats.filter((i) => players[i].team === 1);
  const teamAPts = teamAPointsSeats.length
    ? teamAPointsSeats.reduce((sum, i) => sum + (ps(i).points || 0), 0) / teamAPointsSeats.length
    : 0;
  const teamBPts = teamBPointsSeats.length
    ? teamBPointsSeats.reduce((sum, i) => sum + (ps(i).points || 0), 0) / teamBPointsSeats.length
    : 0;
  const maxTeamPts = Math.max(teamAPts, teamBPts, 1);
  const teamAName = statTeamName(0),
    teamBName = statTeamName(1);
  const scores = game && Array.isArray(game.scores) ? game.scores : [0, 0];
  const cardsHtml = seats.map((i) => renderPlayerStatCard(i, topScorerIdx)).join('');

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
  try {
    wireStatsAllTimeToggle();
  } catch (e) {}
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
    const hasReveal =
      Array.isArray(summary.claimRevealHands) &&
      summary.claimRevealHands.some((h) => Array.isArray(h.cards));
    revealBtn.classList.toggle('hidden', !hasReveal);
    const actions = modal.querySelector('.score-modal-actions');
    if (actions) actions.classList.toggle('has-reveal', hasReveal);
    const showing = modal.classList.contains('showing-remaining');
    revealBtn.textContent = showing ? 'Scoreboard' : 'Show remaining';
    revealBtn.onclick = () => {
      if (modal.classList.contains('showing-remaining')) {
        modal.classList.remove('showing-remaining');
        window._ltShowRemaining = false;
        try {
          document.body.classList.remove('remaining-open');
        } catch (e) {}
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
        nextBtn.textContent = gameOver ? 'OK' : isHost ? 'Next Hand' : 'OK';
      }
      try {
        updateLandscapeTheater();
      } catch (e) {}
      try {
        window.HORCharacterStudio077?.sync();
      } catch (e) {
        console.warn('Character presentation:', e);
      }
    };
  }

  if (last3Btn) {
    const showing = modal.classList.contains('showing-remaining');

    last3Btn.classList.toggle('hidden', !showing);
    last3Btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window._scoreLastTricks = Array.isArray(summary.lastTricks) ? summary.lastTricks : [];
      try {
        openPortraitLast3();
      } catch (err) {
        console.error(err);
      }
    };
  }

  if (histBtn) {
    histBtn.classList.remove('hidden');
    histBtn.onclick = () => {
      openHandHistory({ fromScoreboard: true });
    };
  }

  if (nextBtn) {
    nextBtn.classList.remove('hidden');
    nextBtn.textContent = gameOver ? 'OK' : isHost ? 'Next Hand' : 'OK';
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
  try {
    document.body.classList.remove('remaining-open');
  } catch (e) {}
  landscapeLastSummary = summary
    ? { ...summary, scores: Array.isArray(summary.scores) ? [...summary.scores] : summary.scores }
    : null;
  const modal = $('scoreModal');
  const body = $('scoreModalBody');
  if (!modal || !body || !summary) return;
  try {
    playResultFinish843(summary);
  } catch (e) {}
  try {
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    modal.classList.add('score-modal-top');
  } catch (e) {}
  modal.classList.remove('showing-remaining');
  const goal = game?.targetScore || targetScore || 300;

  const da = summary.scoreDeltaA ?? 0;
  const db = summary.scoreDeltaB ?? 0;
  const title = $('scoreModalTitle');
  if (title) title.textContent = 'Scoreboard';

  // The approved scoreboard is a real renderer, not a CSS skin over the legacy DOM.
  // Scoring data and all action wiring remain unchanged.
  const nest =
    Array.isArray(summary.nestCards) && summary.nestCards.length
      ? summary.nestCards.map((c) => ({ ...c }))
      : game && Array.isArray(game.nestRevealCards) && game.nestRevealCards.length
        ? game.nestRevealCards.map((c) => ({ ...c }))
        : game && Array.isArray(game.nestCards) && game.nestCards.length
          ? game.nestCards.map((c) => ({ ...c }))
          : [];
  const nestWinner = summary.nestWinnerName || 'Winner';
  const nestPts = Number(summary.nestPts || 0);
  const trumpName = COLOR_NAMES[summary.trump] || summary.trump || '—';
  const trumpClass = String(summary.trump || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  const totalTaken = Number(summary.pointsA || 0) + Number(summary.pointsB || 0);
  const deckTotal = typeof totalCountersInDeck === 'function' ? totalCountersInDeck() : '—';
  const griffinIcon = 'assets/images/griffin-icon.png?v=635';
  const ravenIcon = 'assets/images/avatar-raven-approved.jpg';
  const labelA = typeof teamLabel === 'function' ? teamLabel(0) : 'Griffin';
  const labelB = typeof teamLabel === 'function' ? teamLabel(1) : 'Raven';
  const bidderLabel = summary.bidderTeam === 0 ? labelA : labelB;
  const took =
    summary.bidderTeam === 0 ? Number(summary.pointsA || 0) : Number(summary.pointsB || 0);
  const bidderDelta = summary.bidderTeam === 0 ? da : db;
  const resultLine = `${bidderLabel} bid ${formatBidAmount(summary.bid)}, took ${took} → ${bidderDelta >= 0 ? '+' : ''}${bidderDelta}. Nest ${nestPts} to ${nestWinner}. Running total: ${labelA} ${summary.scores[0]} · ${labelB} ${summary.scores[1]} (to ${goal}).`;

  const nestMarkup = `
    <details class="ghsb-nest" aria-label="Nest cards">
      <summary class="ghsb-nest-title">Nest: ${escapeHtmlSafe(nestWinner)} · ${nestPts} points</summary>
      <div class="ghsb-nest-cards">
        ${
          nest.length
            ? nest
                .map((c) => {
                  const html = typeof nestCardMarkup === 'function' ? nestCardMarkup(c) : '';
                  return `<div class="ghsb-nest-card">${html}</div>`;
                })
                .join('')
            : '<div class="ghsb-nest-empty">No nest cards recorded</div>'
        }
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
  const remaining = $('scoreDetailsRemaining805'),
    original = $('scoreModalRevealHands');
  if (remaining) {
    remaining.hidden = !original || original.classList.contains('hidden');
    remaining.onclick = () => original?.click();
  }
  $('scoreModalHistory').textContent = 'History';
  $('scoreModalCopy').textContent = 'Copy scores';
}

function showWinCelebration(winner, scores) {
  const ov = $('winOverlay');
  if (!ov) return;
  liftOverlayToBody(ov, 'overlay-top');
  liftOverlayToBody($('celePage'), 'overlay-top');
  pendingCele = {
    matchId: game?.careerMatchId,
    winner,
    scores: Array.isArray(scores) ? [...scores] : [0, 0],
  };
  try {
    playResultFinish843(pendingCele, true);
  } catch (e) {}
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
        matchId: game?.careerMatchId,
        winner,
        scores: pendingCele.scores,
        matchTricks: matchTricks || [],
        highlights: pickHighlightTricks(winner),
      });
    } catch (e) {}
  }
  clearCeleTimers();
  const auto = setTimeout(
    () => {
      try {
        startMatchCelebration();
      } catch (e) {
        console.error(e);
      }
    },
    reduceMotion ? 900 : 2800
  );
  celeTimers.push(auto);
}

function tourCardOpen() {
  if (window.horTourBlocking || window.horPinTip) return true;
  const ov = $('tutorialOverlay');
  return !!(ov && !ov.classList.contains('hidden'));
}
function afterTourCard(fn) {
  if (typeof fn !== 'function') return;
  if (!tourCardOpen()) {
    fn();
    return;
  }
  window.horAfterTour = window.horAfterTour || [];
  window.horAfterTour.push(fn);
}
window.tourCardOpen = tourCardOpen;
window.afterTourCard = afterTourCard;
window.flushAfterTour = function () {
  const q = (window.horAfterTour || []).slice();
  window.horAfterTour = [];
  q.forEach((fn) => {
    try {
      fn();
    } catch (e) {}
  });
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

  try {
    clearTableForShuffle();
  } catch (e) {}
  if (game) game.dealer = rotateDealerRight(game.dealer);
  hostDeal();
}

function recordMatchTrick(entry) {
  if (!entry || !Array.isArray(entry.plays)) return;
  const copy = {
    plays: entry.plays.map((t) => ({ player: t.player, card: t.card ? { ...t.card } : t.card })),
    winner: entry.winner,
    winnerName: entry.winnerName || playerNameAt(entry.winner),
    ledColor: entry.ledColor || null,
    trump: entry.trump || null,
    points:
      Number(
        entry.points != null
          ? entry.points
          : (entry.plays || []).reduce((s, t) => s + cardPoints(t.card), 0)
      ) || 0,
    team: entry.team != null ? entry.team : teamOfSeat(entry.winner),
    hand: entry.hand || (handHistory && handHistory.length ? handHistory.length + 1 : 1),
    trickNum: (matchTricks || []).filter((t) => t.hand === (entry.hand || 1)).length + 1,
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
    pool = pool.filter((t) => t.team === team);
  }
  pool.sort((a, b) => {
    const pd = (b.points || 0) - (a.points || 0);
    if (pd) return pd;
    const aw = (a.plays || []).find((p) => p.player === a.winner);
    const bw = (b.plays || []).find((p) => p.player === b.winner);
    return cardPoints(bw && bw.card) - cardPoints(aw && aw.card);
  });
  // The finale deliberately plays the second-biggest trick first and the
  // biggest trick last so the strongest moment is the closing reveal.
  return pool.slice(0, 2).reverse();
}

function clearCeleTimers() {
  (celeTimers || []).forEach((id) => {
    try {
      clearTimeout(id);
    } catch (e) {}
  });
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
  const scores = data.scores || (game && game.scores ? game.scores : [0, 0]);
  const highlights =
    data.highlights && data.highlights.length ? data.highlights : pickHighlightTricks(winner);

  const page = $('celePage');
  if (!page) return;
  const title = $('celeTitle');
  const sub = $('celeSub');
  if (title) title.textContent = winner === 'Tie' ? "It's a Tie!" : `${winner} Wins!`;
  if (sub) {
    const scoreTxt = `Final A ${scores[0]} – B ${scores[1]}`;
    sub.textContent = highlights.length
      ? `${scoreTxt} · ${highlights.length === 1 ? 'Biggest trick' : 'Two biggest tricks'} ${winner === 'Tie' ? 'of the match' : 'from the winning side'}`
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
      d.style.animationDelay = Math.random() * 1.8 + 's';
      d.style.background = colors[i % colors.length];
      d.style.width = 6 + Math.random() * 6 + 'px';
      d.style.height = 10 + Math.random() * 8 + 'px';
      conf.appendChild(d);
    }
  }

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
    stage.innerHTML =
      '<div class="cele-trick cele-empty">No highlight tricks recorded this match.</div>';
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
    const isHighest = i === highlights.length - 1;
    const label =
      highlights.length === 1 ? 'Biggest trick' : isHighest ? 'Biggest trick' : 'Second biggest';
    renderCeleTrick(stage, trick, label, i, instant, isHighest);
    // The match applause owns this finish; recap cards do not replay trick sounds.
    const plays = (trick.plays || []).length || 4;
    const hold = instant ? 50 : 720 + plays * 420 + 1600;
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
  const trump = trick.trump ? COLOR_NAMES[trick.trump] || trick.trump : '—';
  const led = trick.ledColor ? COLOR_NAMES[trick.ledColor] || trick.ledColor : '—';
  const handTxt = trick.hand ? `Hand ${trick.hand}` : '';
  stage.innerHTML = `
    <article class="cele-trick${isHighest ? ' highest-trick' : ''}" data-idx="${idx}">
      <div class="cele-trick-head">
        <div class="cele-trick-label">${label} · ${pts} pts</div>
        <div class="cele-trick-taker">Taken by <em>${taker}</em></div>
        <div class="cele-trick-meta">${handTxt}${handTxt ? ' · ' : ''}Trump ${trump} · Led ${led}</div>
      </div>
      <div class="cele-plays">
        ${plays
          .map((t, pi) => {
            const isW = t.player === trick.winner;
            const name = playerNameAt(t.player);
            const html = typeof renderCardHTML === 'function' ? renderCardHTML(t.card, true) : '';
            return `<div class="cele-play${isW ? ' winner' : ''}" data-pi="${pi}" data-winner="${isW ? '1' : '0'}">
            ${isW ? '<div class="cele-crown"><img src="assets/images/winner-crown841.svg" alt="Winning card"></div>' : '<div class="cele-crown" style="visibility:hidden"><img src="assets/images/winner-crown841.svg" alt=""></div>'}
            ${html}
            <div class="cele-play-name">${name}</div>
          </div>`;
          })
          .join('')}
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
  try {
    hideCelePage();
  } catch (e) {}
  try {
    broadcast({ type: 'matchRematch' });
  } catch (e) {}
  const ov = $('winOverlay');
  if (ov) ov.classList.add('hidden');
  const score = $('scoreModal');
  if (score) score.classList.add('hidden');
  if (isSoloPractice) {
    try {
      restartSoloPractice();
      return;
    } catch (e) {}
  }
  hostStartGame();
}

function requestRematch() {
  try {
    hideCelePage();
  } catch (e) {}
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
  try {
    broadcast({ type: 'returnWaiting' });
  } catch (e) {}
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
  try {
    horMarkActiveTable(false);
  } catch (e) {}
  try {
    document.body.classList.remove('in-game');
  } catch (e) {}
  if (game) {
    game.phase = 'waiting';
    game.paused = false;
  }
  try {
    hideCelePage();
  } catch (e) {}
  const ov = $('winOverlay');
  if (ov) ov.classList.add('hidden');
  const score = $('scoreModal');
  if (score) score.classList.add('hidden');
  const hist = $('historyModal');
  if (hist) hist.classList.add('hidden');
  const ltEnd = $('ltEndGame');
  if (ltEnd) ltEnd.classList.add('hidden');
  try {
    showHostGameTools(false);
  } catch (e) {}
  if (game) {
    game.phase = 'waiting';
    game.paused = false;
  }
  try {
    document.body.classList.remove('in-game');
  } catch (e) {}
  showWaiting();
}

// ========== State broadcast & client apply ==========
function broadcastState() {
  horSyncActionContext844();
  // Public state
  // Live counters taken this hand (for bid progress UI)
  let handPtsA = 0,
    handPtsB = 0;
  try {
    (game.tricksTaken[0] || []).forEach((c) => {
      handPtsA += cardPoints(c);
    });
    (game.tricksTaken[1] || []).forEach((c) => {
      handPtsB += cardPoints(c);
    });
  } catch (e) {}

  horNetSeq += 1;
  const publicState = {
    type: 'state',
    seq: horNetSeq,
    phase: game.phase,
    careerMatchId: game.careerMatchId,
    networkHand844: game.networkHand844,
    actionContext844: game.actionContext844,
    scores: game.scores,

    bid: game.bid,
    highestBid: Number.isFinite(Number(game.highestBid)) ? game.highestBid : auctionHigh(),
    minBid: minBid,
    passCount: game.passCount || 0,
    bidder: game.bidder,
    trump: game.trump,
    trumpVoiceEvent790: game.trumpVoiceEvent790 || null,
    trumpPresentation833: !!game.trumpPresentation833,
    trumpPresentationMs833: game.trumpPresentationMs833 || 0,
    currentPlayer: game.currentPlayer,
    trick: game.trick,
    ledColor: game.ledColor,
    players: publicPlayersSnapshot(),
    dealer: game.dealer,
    nestCount: game.nest.length,
    handsCount: game.hands.map((h) => h.length),
    targetScore: game.targetScore || targetScore,
    lastTrickWinner: game.lastTrickWinner != null ? game.lastTrickWinner : null,
    resolvingTrick: !!game.resolvingTrick,
    paused: !!game.paused,
    bidStatus: game.bidStatus || [null, null, null, null],
    discardCount: game.discardCount || 0,
    nestAuctionOpen: !!game.nestAuctionOpen,
    revealTopNest: !!revealTopNest,
    nestFlipped: !!game.nestFlipped,
    topNestCard: game.topNestCard ? { ...game.topNestCard } : null,
    nestFlipStage: game.nestFlipStage || 0,
    widowSpread: Array.isArray(game.widowSpread) ? game.widowSpread.map((c) => ({ ...c })) : [],
    handPoints: [handPtsA, handPtsB],
    recentTricks:
      typeof recentTricks !== 'undefined' && recentTricks
        ? horExpOn('netDelta')
          ? recentTricks.slice(-3)
          : recentTricks
        : [],
    matchTricks:
      typeof matchTricks !== 'undefined' && matchTricks
        ? horExpOn('netDelta')
          ? matchTricks.slice(-8)
          : matchTricks
        : [],
    trumpClaimPlayer: getRestClaimHolder(),
    trumpClaimReason: getRestClaimInfo()?.reason || null,
    revealedHands: null,
    claimDeclined: !!game.claimDeclined,
    claimAnimation: game.claimAnimation || null,
    claimAnimating: !!game.claimAnimating,
    resolvingTrickPoints: game.resolvingTrickPoints || 0,
  };
  try {
    if (
      horCareerModeOn() &&
      publicState.players &&
      publicState.players.some((p) => p && !p.careerPublic)
    ) {
      console.warn('[Career] public state contains player(s) without Career profile');
    }
  } catch (e) {}
  broadcast(publicState);

  // Private hands — send a copy so clients always get every card (incl. Rook after nest)
  players.forEach((p, i) => {
    const handCopy = (game.hands[i] || []).map((c) => ({ ...c }));
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
          nestPreview: (game.nestPreview || []).map((c) => ({ ...c })),
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

function showBottomTrickWinnerNotice() {
  try {
    window.HORHolderCues789?.sync(game, myIndex, isSpectator);
  } catch (_) {}
}

function applyState(data) {
  if (data?.phase === 'dealing' && game?.phase !== 'dealing') window.HORBidVoice801?.stop();
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
    careerMatchId: data.careerMatchId || game.careerMatchId,
    networkHand844: data.networkHand844 || game.networkHand844,
    actionContext844: data.actionContext844 || null,
    scores: data.scores,

    bid: data.bid,
    highestBid: (function () {
      const h = parseInt(data.highestBid, 10);
      if (Number.isFinite(h)) return h;
      const b = parseInt(data.bid, 10);
      if (Number.isFinite(b) && b > 0) return b;
      return (parseInt(data.minBid, 10) || parseInt(minBid, 10) || 100) - 5;
    })(),
    passCount: data.passCount != null ? data.passCount : game.passCount || 0,
    bidder: data.bidder,
    trump: data.trump,
    trumpVoiceEvent790: data.trumpVoiceEvent790 || null,
    trumpPresentation833: !!data.trumpPresentation833,
    trumpPresentationMs833: data.trumpPresentationMs833 || 0,
    trumpVoiceRestore790: !!data.trumpVoiceRestore790,
    currentPlayer: data.currentPlayer,
    trick: data.trick || [],
    ledColor: data.ledColor,
    players: data.players,
    dealer: data.dealer,
    handsCount: data.handsCount,
    targetScore: normalizeTargetScore(data.targetScore || game.targetScore || targetScore),
    lastTrickWinner: data.lastTrickWinner != null ? data.lastTrickWinner : null,
    resolvingTrick: !!data.resolvingTrick,
    paused: !!data.paused,
    bidStatus: data.bidStatus || game.bidStatus || [null, null, null, null],
    discardCount: data.discardCount != null ? data.discardCount : game.discardCount || 0,
    nestAuctionOpen: data.nestAuctionOpen != null ? !!data.nestAuctionOpen : !!game.nestAuctionOpen,
    nestFlipped: data.nestFlipped != null ? !!data.nestFlipped : !!game.nestFlipped,
    topNestCard:
      data.topNestCard !== undefined
        ? data.topNestCard
          ? { ...data.topNestCard }
          : null
        : game.topNestCard || null,
    nestFlipStage: data.nestFlipStage != null ? data.nestFlipStage : game.nestFlipStage || 0,
    widowSpread: Array.isArray(data.widowSpread)
      ? data.widowSpread.map((c) => ({ ...c }))
      : game.widowSpread || [],
    handPoints: data.handPoints || game.handPoints || [0, 0],
    trumpClaimPlayer: data.trumpClaimPlayer != null ? data.trumpClaimPlayer : null,
    trumpClaimReason: data.trumpClaimReason || null,
    revealedHands: null,
    claimDeclined: !!data.claimDeclined,
    claimAnimation: data.claimAnimation || null,
    claimAnimating: !!data.claimAnimating,
    resolvingTrickPoints: Number(data.resolvingTrickPoints || 0),
    nestRevealCards: Array.isArray(data.nestRevealCards)
      ? data.nestRevealCards.map((c) => ({ ...c }))
      : game.nestRevealCards || [],
  });
  try {
    renderTopNestPeek();
  } catch (e) {}
  if (data.phase && !['lobby', 'waiting'].includes(data.phase)) horMarkActiveTable(true);
  else if (data.phase === 'lobby' || data.phase === 'waiting') horMarkActiveTable(false);
  if (Array.isArray(data.players)) {
    // Public state is authoritative about table order. Keep the local
    // human index synchronized by stable peer id; this is especially
    // important for the host's partner at seat 2.
    if (!isSpectator && myPeerId) {
      const stateMyIndex = data.players.findIndex((p) => p && p.id === myPeerId);
      if (stateMyIndex >= 0) myIndex = stateMyIndex;
    }
    data.players.forEach((sp, i) => {
      let lp = null;
      if (players[i] && players[i].id === sp.id) lp = players[i];
      else lp = players.find((p) => p && p.id === sp.id) || null;
      if (lp) {
        if (sp.careerPublic && sp.careerPublic.enabled) lp.careerPublic = sp.careerPublic;
        else if (!sp.isBot && sp.id !== myPeerId) lp.careerPublic = null;
      }
    });
  }
  if (data.recentTricks) recentTricks = data.recentTricks;
  if (data.matchTricks) matchTricks = data.matchTricks;
  if (data.targetScore) targetScore = normalizeTargetScore(data.targetScore);
  if (data.minBid) minBid = parseInt(data.minBid, 10) || minBid;
  showGame();
  renderUI();
  try {
    showBottomTrickWinnerNotice();
  } catch (e) {}
  setPauseUI(!!game.paused);

  // Lay-down animation when someone claims the rest of the tricks
  if (game.claimAnimation && game.claimAnimation.cards && game.claimAnimation.cards.length) {
    try {
      playClaimLaydownAnimation(
        game.claimAnimation.player,
        game.claimAnimation.cards,
        game.claimAnimation.reason
      );
    } catch (e) {
      console.error(e);
    }
  } else {
    // Ensure any leftover showdown modal stays hidden
    try {
      showTrumpShowdown();
    } catch (e) {}
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
        try {
          hostConnection.send({ type: 'requestDiscardState', player: myIndex, peerId: myPeerId });
        } catch (e) {}
      }
    } else if (game.phase === 'trump' && game.bidder === myIndex) {
      hideDiscardOverlay();
      showTrumpUI();
    } else if (game.phase === 'play' && game.currentPlayer === myIndex && !game.claimAnimating) {
      lastTurnIndex = myIndex;
      hideActionPanel();
      try {
        renderHand();
      } catch (e) {}
      if (game.trumpClaimPlayer === myIndex) showAllTrumpsClaimUI();
      try {
        maybeRemindTurn();
      } catch (e) {}
    } else {
      if (game.phase === 'play') lastTurnIndex = game.currentPlayer;
      // Never show lay-down popup when it is not your turn
      hideActionPanel();
    }
  } else if (game.claimAnimating) {
    hideActionPanel();
  }
  if (!isHost && data.actionContext844) {
    horAwaitingResync844 = false;
    horFlushOutbox();
  }
}

// Compact top-bar bid progress: Bid · Made · Need
function updateBidProgress() {
  const el = $('bidProgress');
  if (!el || !game) return;
  const bid = game.bid || 0;
  const bidder = game.bidder;
  const phase = game.phase;
  const show =
    bid > 0 &&
    bidder >= 0 &&
    (phase === 'discard' || phase === 'trump' || phase === 'play' || phase === 'score');
  const felt = $('feltBidNeed');
  if (!show) {
    el.classList.add('hidden');
    el.textContent = '';
    if (felt) {
      felt.classList.add('hidden');
      felt.textContent = '';
    }
    return;
  }
  let ptsA = 0,
    ptsB = 0;
  if (Array.isArray(game.handPoints)) {
    ptsA = game.handPoints[0] || 0;
    ptsB = game.handPoints[1] || 0;
  } else if (game.tricksTaken) {
    try {
      (game.tricksTaken[0] || []).forEach((c) => {
        ptsA += cardPoints(c);
      });
      (game.tricksTaken[1] || []).forEach((c) => {
        ptsB += cardPoints(c);
      });
    } catch (e) {}
  }
  const bidderTeam =
    players[bidder] && typeof players[bidder].team === 'number' ? players[bidder].team : bidder % 2;
  const made = bidderTeam === 0 ? ptsA : ptsB;
  const need = Math.max(0, bid - made);
  const us =
    typeof teamLabel === 'function'
      ? teamLabel(bidderTeam)
      : bidderTeam === 1
        ? 'Raven'
        : 'Griffin';
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
  return (
    '<span class="trump-impact-copy" aria-hidden="true">' +
    '<span class="trump-impact-color">' +
    name +
    '</span>' +
    '</span>' +
    '<span class="trump-medallion" aria-hidden="true">' +
    '<span class="trump-medallion-edge">' +
    '<span class="trump-medallion-face">' +
    '<span class="trump-enamel"><span class="trump-stamp-word">' +
    name +
    '</span></span>' +
    '</span>' +
    '</span>' +
    '</span>' +
    '<span class="sr-only">' +
    name +
    ' is trump</span>'
  );
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
  playNatural063('stamp', 0.6);
}

function playTrumpStampFx(el) {
  if (!el) return;
  if (el.__horTrumpFxTimer) window.clearTimeout(el.__horTrumpFxTimer);
  // Rook589: do not replace Trump selection/DOM/orientation ownership.
  // Attach the approved #4 presentation only at Rook585's proven final FX hook.
  HOR_TRUMP_FX.forEach((k) => el.classList.remove('trump-fx-' + k));
  el.classList.remove(
    'trump-stamp-anim',
    'trump-react',
    'trump-rook-react',
    'trump-spinup-approved'
  );
  void el.offsetWidth;
  el.classList.add('trump-spinup-approved');
  try {
    playTrumpSpinSound();
  } catch (e) {}
  el.__horTrumpFxTimer = window.setTimeout(
    () => {
      try {
        el.classList.remove('trump-spinup-approved');
        el.classList.add('hidden');
      } catch (e) {}
    },
    solScaledDelay(2850, 0)
  );
}

function reactTrumpMarker(isRook) {
  ['trumpBanner', 'ltTrumpStamp'].forEach((id) => {
    const el = typeof $ === 'function' ? $(id) : document.getElementById(id);
    if (!el || el.classList.contains('hidden')) return;
    el.classList.remove('trump-react', 'trump-rook-react');
    void el.offsetWidth;
    el.classList.add(isRook ? 'trump-rook-react' : 'trump-react');
    window.setTimeout(
      () => {
        try {
          el.classList.remove('trump-react', 'trump-rook-react');
        } catch (e) {}
      },
      isRook ? 620 : 430
    );
  });
}

function maybeReactTrumpPlay() {
  if (
    !game ||
    game.phase !== 'play' ||
    !game.trump ||
    !Array.isArray(game.trick) ||
    !game.trick.length
  )
    return;
  const play = game.trick[game.trick.length - 1];
  const card = play && (play.card || play);
  if (!card) return;
  const key = [
    game.trump,
    game.trick.length,
    play && play.player,
    card.id || card.color + '-' + card.rank,
  ].join('|');
  if (window.__horTrumpReactionKey === key) return;
  window.__horTrumpReactionKey = key;
  let isTrump = false;
  try {
    isTrump =
      typeof isTrumpCard === 'function' ? isTrumpCard(card, game.trump) : card.color === game.trump;
  } catch (e) {}
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
      try {
        pts = typeof trickPointsSoFar === 'function' ? trickPointsSoFar() : 0;
      } catch (e) {
        pts = 0;
      }
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
  try {
    window.HORHolderIdentity784?.sync();
  } catch (e) {}
  try {
    window.HORUnifiedBidding752?.sync(game, myIndex, isSpectator);
  } catch (e) {}
  try {
    window.HORHolderCues789?.sync(game, myIndex, isSpectator);
  } catch (e) {}
  if (!game || game.phase !== 'play' || !game.resolvingTrick) {
    try {
      window.HORRavenFight741?.sync(game);
    } catch (_) {}
  }
  try {
    window.HORBidRepair737?.sync();
  } catch (e) {}
  try {
    window.HORTrumpVoice?.sync(game, playerAvatars);
  } catch (e) {
    console.warn('Trump voice:', e);
  }
  try {
    if (window.HORTrump714)
      window.HORTrump714.sync(game, myIndex, { spectator: isSpectator, scaled: solScaledDelay });
  } catch (e) {
    console.warn('Trump presentation:', e);
  }
  try {
    const mine = horMyCareerProfile();
    [players, game && game.players].forEach((pool) => {
      if (!Array.isArray(pool)) return;
      if (mine && mine.enabled) {
        let me = pool.find((x) => x && !x.isBot && x.id === myPeerId);
        if (!me && Number.isInteger(myIndex)) me = pool[myIndex];
        if (me && !me.isBot) me.careerPublic = mine;
      }
      if (
        horCareerModeOn() &&
        window.HORProgression &&
        HORProgression.localCareer &&
        HORProgression.localCareer.botPublicProfile
      ) {
        pool.forEach((x) => {
          if (x && x.isBot) {
            const bp = HORProgression.localCareer.botPublicProfile(x.name);
            if (bp && bp.enabled) x.careerPublic = bp;
          }
        });
      }
    });
  } catch (e) {}

  try {
    renderTopNestPeek();
  } catch (e) {}
  try {
    renderWidowSpread();
  } catch (e) {}

  if (!game) return;
  if (horExpOn('renderOptimization')) {
    const handIds = (game.myHand || []).map((c) => c && c.id).join(',');
    const trickIds = ((game.trick && game.trick.cards) || [])
      .map((c) => (c && (c.id || (c.card && c.card.id))) || '')
      .join(',');
    const sig = [
      game.resolvingTrick
        ? [
            game.handNumber,
            game.lastTrickWinner,
            (game.trick || []).map((p) => p.card?.id).join(','),
          ].join(':')
        : '',
      game.phase,
      game.currentPlayer,
      game.bidder,
      game.trump,
      game.bid,
      (game.scores || []).join('/'),
      handIds,
      trickIds,
      myIndex,
      game.paused ? 1 : 0,
    ].join('|');
    const now = Date.now();
    if (sig === window.__horUiSig && now - (window.__horUiAt || 0) < 80) return;
    window.__horUiSig = sig;
    window.__horUiAt = now;
  }
  try {
    applyFirstHandChrome();
  } catch (e) {}
  if ($('scoreA')) $('scoreA').textContent = game.scores[0];
  if ($('scoreB')) $('scoreB').textContent = game.scores[1];
  if ($('targetDisplay'))
    $('targetDisplay').textContent = String(game.targetScore || targetScore || 500);
  const ltA = $('ltScoreA'),
    ltB = $('ltScoreB'),
    ltT = $('ltTarget');
  if (ltA) ltA.textContent = game.scores[0];
  if (ltB) ltB.textContent = game.scores[1];
  try {
    if (typeof paintTeamChrome === 'function') paintTeamChrome();
  } catch (e) {}
  if (ltT) ltT.textContent = String(game.targetScore || targetScore || 500);
  if ($('phaseLabel'))
    $('phaseLabel').textContent =
      {
        dealing: 'Dealing',
        bidding: 'Bidding',
        discard: 'Discard',
        trump: 'Choose Trump',
        play: 'Playing',
        score: 'Hand Score',
      }[game.phase] || game.phase;

  // Rook560: Trump announcement is event-owned by hostProcessTrump. renderUI must
  // never recreate/restart it from persistent game state.
  if ($('trumpDisplay'))
    $('trumpDisplay').textContent =
      game.phase === 'play'
        ? ''
        : game.bid
          ? `Bid: ${formatBidAmount(game.bid, { short: true })}`
          : '';
  const tb = $('trumpBadge');
  if (tb) tb.classList.add('hidden');
  if (game.phase === 'play') {
    try {
      maybeReactTrumpPlay();
    } catch (e) {}
  } else if (game.phase !== 'trump') {
    try {
      clearTrumpBanners();
    } catch (e) {}
  }

  updateBidProgress();
  const roomImpact = document.querySelector('.game-room');
  if (roomImpact) {
    roomImpact.classList.toggle(
      'big-trick-impact',
      !!(game.resolvingTrick && Number(game.resolvingTrickPoints || 0) >= 30)
    );
    roomImpact.classList.toggle(
      'rook-capture-impact',
      !!(
        game.resolvingTrick &&
        game.trick &&
        game.trick.some((t) => t.card && (t.card.color === 'rook' || t.card.id === 'rook'))
      )
    );
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
  const seatBase = myIndex >= 0 ? myIndex : 0;
  const seatMap = {
    partner: (seatBase + 2) % 4,
    left: (seatBase + 1) % 4, // next clockwise
    right: (seatBase + 3) % 4, // previous (counterclockwise)
    me: seatBase,
  };

  const whoseTurn =
    game.phase === 'play' || game.phase === 'bidding'
      ? game.currentPlayer
      : game.phase === 'discard' || game.phase === 'trump'
        ? game.bidder
        : -1;

  let trickLeadIdx = -1;
  try {
    if (game.phase === 'play' && game.trick && game.trick.length) {
      if (game.resolvingTrick && game.lastTrickWinner != null) trickLeadIdx = game.lastTrickWinner;
      else {
        const w = typeof currentTrickWinner === 'function' ? currentTrickWinner() : null;
        if (w && w.player != null) trickLeadIdx = w.player;
      }
    }
  } catch (e) {
    trickLeadIdx = -1;
  }

  renderTrickPot784();

  ['partner', 'left', 'right'].forEach((slot) => {
    const idx = seatMap[slot];
    const el = $(`slot-${slot}`);
    if (!el) return;
    if (game.players && game.players[idx]) {
      const av =
        playerAvatars[game.players[idx].id] ||
        game.players[idx].avatar ||
        AVATARS[idx % AVATARS.length];
      const nameEl = el.querySelector('.name');
      if (nameEl) {
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
        try {
          horBindCareerBadges(el);
        } catch (e) {}
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
    el.classList.toggle(
      'is-passed',
      !!(game.phase === 'bidding' && game.bidStatus && game.bidStatus[idx] === 'pass')
    );
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
      const meP =
        (game.players && game.players[seatBase]) || (players && players[seatBase]) || null;
      const meName = (meP && meP.name) || myName || 'Player';
      const meId = (meP && meP.id) || myPeerId;
      const av = playerAvatars[meId] || (meP && meP.avatar) || AVATARS[seatBase % AVATARS.length];
      meNameEl.innerHTML = `<span class="seat-avatar">${avatarHTML(av)}</span><span class="seat-identity-copy"><span class="player-name-text">${escapeHtmlSafe(meName)}</span>${meP ? horCareerBadgeHtml(meP) : ''}</span>`;
      applyBotNameAttr(meNameEl, meP);
      try {
        horBindCareerBadges(meNameEl);
      } catch (e) {
        console.error('[Career badge bind]', e);
      }
    }
    const quietMe = isFirstHandOfMatch();
    meSlot.classList.toggle('is-turn', !quietMe && seatBase === whoseTurn && !game.resolvingTrick);
    meSlot.classList.toggle('is-trick-lead', !quietMe && seatBase === trickLeadIdx);
    meSlot.classList.toggle(
      'is-hand-winner',
      !!(game.claimAnimating && game.trumpClaimPlayer === seatBase)
    );
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
    meSlot.classList.toggle(
      'is-passed',
      !!(game.phase === 'bidding' && game.bidStatus && game.bidStatus[seatBase] === 'pass')
    );
    window.HORUnifiedBidding752.renderSeat(meSlot, game, seatBase, myIndex, isSpectator);
  }

  try {
    window.HORHolderIdentity784?.sync();
  } catch (e) {}
  try {
    scheduleBottomAvatar029();
    refreshPortraitLastTrick029();
  } catch (e) {}
  try {
    positionSeatLeadTags();
    positionSeatBidBadges();
  } catch (e) {}

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
    try {
      clearTrickFlightLayers();
    } catch (e) {}
    try {
      clearBottomTookMark();
    } catch (e) {}
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
      { rot: -6, x: -7, y: 5 },
      { rot: 4, x: 6, y: -3 },
      { rot: -3, x: -3, y: 4 },
      { rot: 5, x: 5, y: -2 },
    ];

    // ROOK027: reproduce the reviewed TABLE-003 scene coordinates and matrices.
    const portraitPlane = matchMedia('(orientation: portrait)').matches;
    const reviewedPlane = [
      {
        'anchor': [141, 386],
        'matrix': 'matrix3d(1, 0, 0, 0, -0.1058, 0.7, 0, -0.00115, 0, 0, 1, 0, 0, 0, 0, 1)',
        'rotation': 'rotate(100deg)',
      },
      {
        'anchor': [211, 342],
        'matrix': 'matrix3d(0.888286, 0, 0, 0, 0, 0.552336, 0, -0.0010215, 0, 0, 1, 0, 0, 0, 0, 1)',
        'rotation': 'rotate(175deg)',
      },
      {
        'anchor': [286, 400],
        'matrix': 'matrix3d(1, 0, 0, 0, 0.1058, 0.7, 0, -0.00115, 0, 0, 1, 0, 0, 0, 0, 1)',
        'rotation': 'rotate(-98deg)',
      },
      {
        'anchor': [202, 424],
        'matrix': 'matrix3d(1.11171, 0, 0, 0, 0, 0.865136, 0, -0.0012784, 0, 0, 1, 0, 0, 0, 0, 1)',
        'rotation': 'rotate(9deg)',
      },
    ];
    const referenceCover = 915 / 1797;
    const sceneCover = Math.max(innerWidth / 875, innerHeight / 1797);
    const planeScale = sceneCover / referenceCover;
    const cardsHtml = trick
      .map((t, i) => {
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
        const relativeSeat =
          (t.player - (typeof myIndex === 'number' && myIndex >= 0 ? myIndex : 0) + 4) % 4;
        const reviewed = reviewedPlane[{ 1: 0, 2: 1, 3: 2, 0: 3 }[relativeSeat]];
        if (portraitPlane) {
          const x = innerWidth / 2 + (reviewed.anchor[0] - 206) * planeScale;
          const y = reviewed.anchor[1] * planeScale;
          style += `--rook027-scale:${planeScale};left:${x - 44 * planeScale}px!important;top:${y - 63 * planeScale}px!important;width:${88 * planeScale}px!important;height:${126 * planeScale}px!important;`;
        }
        const face = renderCardHTML(t.card, false);
        const presentedFace = portraitPlane
          ? `<div class="played-scene"><div class="played-plane" style="transform:${reviewed.matrix}"><div class="played-orientation" style="transform:${reviewed.rotation}"><div class="played-size">${face}</div></div></div></div>`
          : face;
        const who =
          (game.players && game.players[t.player] && game.players[t.player].name) ||
          (players[t.player] && players[t.player].name) ||
          'P' + (t.player + 1);
        return `<div class="trick-card-wrap ${portraitPlane ? 'table003-played' : ''} ${isLatest ? 'latest' : ''} ${isWinner ? 'winner' : ''} ${isRookPulse ? 'rook-play-pulse' : ''}" data-plane-x="${reviewed.anchor[0]}" data-plane-y="${reviewed.anchor[1]}" style="${style}">
        ${presentedFace}
        <div class="trick-card-name">${escapeHtmlSafe(who)}</div>
      </div>`;
      })
      .join('');
    const caption = ''; // Rook516: center-table TRICK/status wording intentionally removed
    const resolveKey = trickResolveKey(game.lastTrickWinner, trick);
    const alreadyTaken = !!(
      game.resolvingTrick &&
      window._trickFlightKey &&
      window._trickFlightKey === resolveKey
    );
    const poseKey041 = JSON.stringify([
      game.handNumber,
      myIndex,
      portraitPlane,
      trick.map((t) => [t.player, t.card && t.card.id]),
      game.resolvingTrick,
      game.lastTrickWinner,
    ]);
    if (
      !window._trickCapturing &&
      !alreadyTaken &&
      (!portraitPlane || trickArea.dataset.poseKey041 !== poseKey041)
    ) {
      trickArea.dataset.poseKey041 = poseKey041;
      trickArea.dataset.needsPosition041 = '1';
      trickArea.innerHTML = `
        <div class="trick-stack${typeof gfxOn === 'function' && gfxOn('trickFan') ? ' trick-fan' : ''}">
          ${cardsHtml}
        </div>
      `;
    } else {
      const cap = trickArea.querySelector('.trick-caption');
      if (cap) cap.textContent = caption;
    }
    if (portraitPlane && !window._trickCapturing && !alreadyTaken) {
      if (trickArea.dataset.needsPosition041 === '1') {
        positionPlayedPlane027();
        delete trickArea.dataset.needsPosition041;
      }
      animatePlayedTravel041(trickArea, trick);
    }
    try {
      applyRookPlayPulse();
    } catch (e) {}
    const room = document.querySelector('.game-room');
    if (window._trickCapturing || alreadyTaken) {
      // One capture per resolved trick. Do not rebuild or replay.
    } else if (game.resolvingTrick && game.lastTrickWinner != null) {
      if (room) room.classList.add('trick-resolving');
      // DELIBERATE REVEAL PAUSE: leave all four cards fully visible first.
      // This is intentionally longer than a render frame so the fourth/last
      // card can be seen before ANY capture motion begins on phones or APKs.
      clearTimeout(window._trickResolveTimer);
      window._trickResolveTimer = setTimeout(
        () => {
          window._trickResolveTimer = null;
          if (!game || !game.resolvingTrick || game.lastTrickWinner == null) return;
          if (window._trickFlightKey === resolveKey || window._trickCapturing) return;
          const currentKey = trickResolveKey(game.lastTrickWinner, game.trick || []);
          if (currentKey !== resolveKey) return;
          // Mark this exact resolved trick as ready only after the deliberate
          // reveal pause. Landscape's renderer is also called by resize/orientation
          // updates, so it must not be allowed to bypass this timer.
          window._trickRevealReadyKey = resolveKey;
          const land = !!(
            typeof isLandscapeNow === 'function' &&
            isLandscapeNow() &&
            document.body.classList.contains('in-game')
          );
          if (land) {
            try {
              updateLandscapeTheater();
              requestAnimationFrame(() => {
                try {
                  animateLandscapeTrickCapture(game.lastTrickWinner);
                } catch (e) {}
              });
            } catch (e) {}
          } else {
            const liveStack = trickArea.querySelector('.trick-stack');
            if (liveStack && liveStack.isConnected) {
              liveStack.classList.remove('trick-swipe', 'swipe-me', 'swipe-top', 'swipe-right');
              animateTrickCaptureRobust(liveStack, game.lastTrickWinner);
            }
          }
        },
        solScaledDelay(1100, 70)
      );
    } else if (room) {
      room.classList.remove('trick-resolving');
    }
  }
  try {
    syncHumanTurnStatus();
  } catch (e) {}
  try {
    positionSeatLeadTags();
  } catch (e) {}
  try {
    if (!$('botThinking')?.classList.contains('hidden'))
      requestAnimationFrame(positionBotThinkingAtSeat);
  } catch (e) {}
  try {
    updateLandscapeTheater();
  } catch (e) {}
  try {
    window.HORCharacterStudio077?.sync();
  } catch (e) {
    console.warn('Character presentation:', e);
  }
  try {
    window.HORRavenFight741?.sync(game, {
      scaled: solScaledDelay,
      reduced: reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
      pace: horGamePace,
    });
  } catch (e) {
    console.warn('Raven presentation:', e);
  }
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
  try {
    clearTimeout(window._trickResolveTimer);
    window._trickResolveTimer = null;
  } catch (e) {}
  document.querySelectorAll('.trick-capture-flight-layer').forEach((el) => {
    try {
      el.remove();
    } catch (e) {}
  });
}

function trickResolveKey(winnerIdx, trick) {
  const list = trick || (game && game.trick) || [];
  const sig = list.map((t) => (t && t.card && t.card.id) || '').join('|');
  return 'trick:' + String(winnerIdx) + ':' + sig;
}

function winnerRelFor(winnerIdx) {
  const me = typeof myIndex === 'number' && myIndex >= 0 ? myIndex : 0;
  return (((Number(winnerIdx) - me) % 4) + 4) % 4;
}

function clearBottomTookMark() {
  document.querySelectorAll('.took-this-trick').forEach((el) => {
    el.classList.remove('took-this-trick');
  });
  document.querySelectorAll('.you-took-chip').forEach((el) => {
    try {
      el.remove();
    } catch (e) {}
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

  const r = el
    ? el.getBoundingClientRect()
    : {
        left: window.innerWidth / 2,
        top: 80,
        width: 0,
        height: 0,
      };
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, rel };
}

// 794: notify the holder at the visible collection endpoint, not trick resolution.
// A transition event normally supplies arrival; the existing flight cleanup is
// the fallback for reduced motion/throttled or missing transition events.
function watchTrickArrival794(layer, winnerIdx, trick) {
  const arrive = window.HORHolderCues789?.captureWaiter(winnerIdx, trick);
  let done = false;
  const landed = new Set();
  const finish = () => {
    if (done) return;
    done = true;
    layer.removeEventListener('transitionend', onEnd);
    if (layer.isConnected) arrive?.();
  };
  const onEnd = (e) => {
    if (
      e.propertyName !== 'transform' ||
      e.target.parentNode !== layer ||
      !e.target.classList.contains('trick-flight-card')
    )
      return;
    landed.add(e.target);
    if (landed.size >= layer.querySelectorAll(':scope > .trick-flight-card').length) finish();
  };
  layer.addEventListener('transitionend', onEnd);
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
    try {
      markBottomTookTrick();
    } catch (e) {}
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
      '--rook027-scale:' +
      (card.style.getPropertyValue('--rook027-scale') || '1') +
      ';position:fixed!important;left:' +
      r.left +
      'px;top:' +
      r.top +
      'px;' +
      'width:' +
      r.width +
      'px;height:' +
      r.height +
      'px;margin:0!important;' +
      'z-index:' +
      (2147483001 + i) +
      ';pointer-events:none;' +
      'transform-origin:center center;will-change:transform,opacity;' +
      'opacity:1;visibility:visible;animation:none!important;';

    layer.appendChild(clone);
    card.style.visibility = 'hidden';
    flightCount++;

    const dx = Math.round(targetX - (r.left + r.width / 2));
    const dy = Math.round(targetY - (r.top + r.height / 2));
    const spin = i % 2 ? 14 : -14;
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
        'translate3d(' +
        (dx + fanX) +
        'px,' +
        (dy + fanY) +
        'px,0) rotate(' +
        spin +
        'deg) scale(.34)';
    } else {
      endTransform = 'translate3d(' + dx + 'px,' + dy + 'px,0) rotate(' + spin + 'deg) scale(.38)';
    }

    clone.style.transform = startTransform;

    setTimeout(() => {
      if (!clone.isConnected) return;
      clone.style.transition = `transform ${solScaledDelay(780, 45)}ms cubic-bezier(.18,.78,.18,1), opacity ${solScaledDelay(780, 45)}ms ease-out`;
      void clone.offsetWidth;
      requestAnimationFrame(() => {
        if (!clone.isConnected) return;
        clone.style.transform = endTransform;
        clone.style.opacity = '0';
      });
    }, delay);
  });

  const arrivalDone794 = watchTrickArrival794(layer, winnerIdx, game.trick);
  const cleanupMs = solScaledDelay(1150 + Math.max(0, flightCount - 1) * 55, 80);
  setTimeout(() => {
    arrivalDone794();
    try {
      layer.remove();
    } catch (e) {}
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

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
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
        layer.style.cssText =
          'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:8999;overflow:visible;';
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
          clone.style.cssText = `position:fixed!important;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0!important;z-index:${2147483001 + i};pointer-events:none;transform-origin:center center;will-change:transform,opacity;opacity:1;visibility:visible;animation:none!important;transition:none;`;
          layer.appendChild(clone);
          face.style.visibility = 'hidden';
          const dx = Math.round(targetX - (r.left + r.width / 2));
          const dy = Math.round(targetY - (r.top + r.height / 2));
          const spin = i % 2 ? 16 : -16;
          clone.style.transform = 'translate3d(0,0,0) rotate(0deg) scale(1)';
          setTimeout(
            () => {
              if (!clone.isConnected) return;
              clone.style.transition = `transform ${solScaledDelay(720, 45)}ms cubic-bezier(.16,.82,.2,1), opacity ${solScaledDelay(720, 45)}ms ease-in`;
              void clone.offsetWidth;
              requestAnimationFrame(() => {
                if (!clone.isConnected) return;
                clone.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${spin}deg) scale(.34)`;
                clone.style.opacity = '0';
              });
            },
            solScaledDelay(i * 50, 0)
          );
        });

        const arrivalDone794 = watchTrickArrival794(layer, winnerIdx, game.trick);
        const cleanup = solScaledDelay(920 + Math.max(0, faces.length - 1) * 50, 70);
        setTimeout(() => {
          arrivalDone794();
          try {
            layer.remove();
          } catch (e) {}
          try {
            plays.classList.remove('lt-capturing');
          } catch (e) {}
          window._trickCapturing = false;
        }, cleanup);
      } catch (e) {
        window._trickCapturing = false;
      }
    })
  );
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
  const hideStar = (isRed2(card) && includeRed2) || card.color === 'rook' || card.id === 'rook';
  const tag = trump && !hideStar ? '<span class="c-trump-tag" aria-label="trump">★</span>' : '';
  return `<div class="card-face ${cls} ${size}" data-id="${card.id}">${cardInnerHTML(card)}${tag}</div>`;
}

function fitHandToScreen() {
  const handEl = $('myHand');
  const area = handEl && handEl.parentElement;
  if (!handEl || !area || !game || !game.myHand) return;
  const n = handEl.querySelectorAll(':scope > .card-face').length;
  if (n <= 0) return;
  handEl.dataset.handCount = String(n);

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
  const available = Math.max(
    140,
    holderPortrait055 ? Math.min(containerAvailable, rawW * 0.88 - 4) : containerAvailable
  );

  const maxHByViewport = Math.max(42, Math.min(88, Math.floor(vh * 0.2)));
  const maxW = 60;
  // Shrink earlier so 9–10 cards fit cleanly on ~320–390px screens

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

function normalizeHandSortMode(mode) {
  if (mode === 'suit' || mode === 'color-high' || !mode) return 'color-high';
  if (mode === 'points') return 'counters';
  if (mode === 'color-low' || mode === 'rank' || mode === 'counters') return mode;
  return 'color-high';
}

function persistHandSortMode() {
  try {
    localStorage.setItem('horHandSortMode', handSortMode);
  } catch (e) {}
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
  const rookLow = typeof rookLowest !== 'undefined' && rookLowest;
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
  return mode === 'color-low' ? ra - rb : rb - ra;
}

function sortCardsDisplay(arr) {
  if (!arr || !arr.sort) return arr;
  arr.sort(compareCardsDisplay);
  return arr;
}

function sortMyHandInPlace() {
  if (game?.myHand && window.HORHandOrder838) {
    HORHandOrder838.apply(game.myHand);
    return;
  }
  if (!game || !game.myHand) return;
  if (game.phase === 'trump') {
    // Both orientations: show special birds, then the longest color groups.
    const special = (c) => (isRookCard(c) ? 0 : includeRed2 && isRed2(c) ? 1 : 2);
    const counts = Object.create(null);
    for (const c of game.myHand) if (special(c) === 2) counts[c.color] = (counts[c.color] || 0) + 1;
    game.myHand.sort(
      (a, b) =>
        special(a) - special(b) ||
        (special(a) < 2
          ? 0
          : (counts[b.color] || 0) - (counts[a.color] || 0) ||
            displayColorGroup(a) - displayColorGroup(b) ||
            compareCardsDisplay(a, b))
    );
  } else sortCardsDisplay(game.myHand);
}

function cardLegalClass(card, hand) {
  if (!game || !card) return '';
  try {
    return canPlay(card, hand || game.myHand || [], game.ledColor, game.trump)
      ? 'playable'
      : 'disabled';
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
  const reveal =
    isPortraitViewport() &&
    game.phase === 'discard' &&
    $('discardOverlay')?.classList.contains('gh-kitty-page') &&
    !$('discardOverlay')?.classList.contains('hidden');
  const kittyIds = new Set((game.kittyTaken || game.nestPreview || []).map((c) => String(c.id)));
  const displayedHand = reveal
    ? game.myHand.filter((c) => !kittyIds.has(String(c.id)))
    : game.myHand;
  const n = displayedHand.length;
  const markedHand739 = !discardMode && isPortraitViewport() && game.phase === 'play';
  const boundary739 = markedHand739 ? (window.HORTrumpHand739?.boundary(displayedHand) ?? -1) : -1;
  const handMarkup041 = displayedHand
    .map((card, idx) => {
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
      const hideStar = (isRed2(card) && includeRed2) || card.color === 'rook' || card.id === 'rook';
      const marking739 = markedHand739 ? window.HORTrumpHand739?.markup(card) || '' : '';
      if (marking739) cls += ' trump-mark739';
      if (idx === boundary739) cls += ' trump-boundary739';
      const tag = markedHand739
        ? marking739
        : trump && !hideStar
          ? '<span class="c-trump-tag" aria-label="trump">★</span>'
          : '';
      return `<div class="card-face ${cls} ${extra}" data-id="${card.id}">${cardInnerHTML(card)}${tag}</div>`;
    })
    .join('');
  if (isPortraitViewport() && !discardMode) reconcileHand041(handEl, handMarkup041);
  else handEl.innerHTML = handMarkup041;

  try {
    const lt = $('ltHand');
    if (lt) {
      lt.innerHTML = handEl.innerHTML;
      if (discardMode) {
        lt.querySelectorAll('.card-face').forEach((el) => {
          el.onclick = (ev) => {
            ev.preventDefault();
            const id = String(el.dataset.id);
            if (!window.selectedForDiscard) window.selectedForDiscard = new Set();
            const needed = game.discardCount || 5;
            if (window.selectedForDiscard.has(id)) {
              window.selectedForDiscard.delete(id);
              el.classList.remove('selected');
              try {
                playDiscardToggleSfx(true);
              } catch (err) {}
            } else if (window.selectedForDiscard.size < needed) {
              window.selectedForDiscard.add(id);
              el.classList.add('selected');
              try {
                playDiscardToggleSfx(false);
              } catch (err) {}
            }
            try {
              showDiscardUI(false);
            } catch (e) {}
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
  handEl.querySelectorAll('.card-face').forEach((el) => {
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
          try {
            playDiscardToggleSfx(true);
          } catch (err) {}
        } else if (window.selectedForDiscard.size < needed) {
          window.selectedForDiscard.add(id);
          el.classList.add('selected');
          try {
            playDiscardToggleSfx(false);
          } catch (err) {}
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
    if (
      ov &&
      !ov.classList.contains('hidden') &&
      game &&
      game.phase === 'discard' &&
      game.bidder === myIndex
    ) {
      ov.classList.toggle('landscape-discard-overlay', isLandscapeNow());
      // Re-layout the same picker in the new orientation. Do not replay kitty.
      try {
        showDiscardUI(false);
      } catch (e) {}
    }
    if (typeof fitDiscardOverlayCards === 'function') fitDiscardOverlayCards();
    try {
      relocateClaimLaydownLayer();
    } catch (e) {}
    try {
      placeActionPanelAboveSeat();
    } catch (e) {}
    try {
      if (game && game.phase === 'trump' && game.bidder === myIndex && !isSpectator) showTrumpUI();
      else if (
        game &&
        game.phase === 'bidding' &&
        game.currentPlayer === myIndex &&
        !isSpectator &&
        typeof showBidUI === 'function'
      )
        showBidUI({ preserveSelection: !!window.HORAngleC?.active() });
      else if (
        game &&
        game.phase === 'play' &&
        game.trumpClaimPlayer === myIndex &&
        typeof showAllTrumpsClaimUI === 'function'
      )
        showAllTrumpsClaimUI();
    } catch (e) {}
    setTimeout(() => {
      try {
        fitHandToScreen();
        if (typeof fitDiscardOverlayCards === 'function') fitDiscardOverlayCards();
        relocateClaimLaydownLayer();
        if (game && game.phase === 'trump' && game.bidder === myIndex && !isSpectator)
          showTrumpUI();
        else if (
          game &&
          game.phase === 'bidding' &&
          game.currentPlayer === myIndex &&
          !isSpectator &&
          typeof showBidUI === 'function'
        )
          showBidUI({ preserveSelection: !!window.HORAngleC?.active() });
        else if (
          game &&
          game.phase === 'play' &&
          game.trumpClaimPlayer === myIndex &&
          typeof showAllTrumpsClaimUI === 'function'
        )
          showAllTrumpsClaimUI();
      } catch (e) {}
    }, 200);
  } catch (e) {}
}
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);
window.addEventListener('orientationchange', () => {
  setTimeout(syncLandscapeFullscreen, 120);
});
window.addEventListener('resize', () => {
  setTimeout(syncLandscapeFullscreen, 120);
});
document.addEventListener(
  'pointerdown',
  () => {
    if (wantLandscapeFullscreen()) enterLandscapeFullscreen();
  },
  { passive: true }
);
document.addEventListener('fullscreenchange', syncBrowserFitBtn);

function hideActionPanel() {
  const panel = $('actionPanel');
  if (panel) {
    panel.classList.add('hidden');
    panel.classList.remove('bid-panel', 'trump-claim-panel', 'lt-floating-panel');
    panel.innerHTML = '';
    try {
      restoreActionPanelHome();
    } catch (e) {}
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
  try {
    hideActionPanel();
  } catch (e) {}
  window._claimAnimPlaying = false;
  if (window._claimAnimFadeTimer) {
    try {
      clearTimeout(window._claimAnimFadeTimer);
    } catch (e) {}
    window._claimAnimFadeTimer = null;
  }
  if (window._claimAnimRemoveTimer) {
    try {
      clearTimeout(window._claimAnimRemoveTimer);
    } catch (e) {}
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
  if (!isHost || !game || game.trumpPresentation833) return false;
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
function positionBotThinkingAtSeat(statusElement, statusIndex) {
  try {
    const el = statusElement instanceof HTMLElement ? statusElement : $('botThinking');
    if (!el || el.classList.contains('hidden') || !game) return;
    if (positionBidTurn034(el)) return;
    if (window.HORCharacterStudio077?.positionStatus(el, statusIndex)) return;
    const idx = Number.isInteger(statusIndex)
      ? statusIndex
      : game.phase === 'discard' || game.phase === 'trump'
        ? game.bidder
        : game.currentPlayer;
    const sid = typeof seatSlotIdForIndex === 'function' ? seatSlotIdForIndex(idx) : null,
      slot = sid ? $(sid) : null;
    if (!slot) return;
    const av = slot.querySelector('.seat-avatar,.seat-avatar-side');
    if (!av) return;
    if (el.parentNode !== slot) slot.appendChild(el);
    el.dataset.side = sid || '';
    const sr = slot.getBoundingClientRect(),
      ar = av.getBoundingClientRect();
    const sx = sr.width / Math.max(1, slot.offsetWidth || sr.width),
      sy = sr.height / Math.max(1, slot.offsetHeight || sr.height);
    const cx = (ar.left + ar.width / 2 - sr.left) / Math.max(0.01, sx);
    let top = (ar.top - sr.top) / Math.max(0.01, sy) - 4;
    const lead = slot.querySelector(':scope > .seat-lead-tag:not(.hidden)');
    if (lead) {
      const lr = lead.getBoundingClientRect();
      if (lr.width > 0 && lr.height > 0)
        top = Math.min(top, (lr.top - sr.top) / Math.max(0.01, sy) - 4);
    }
    el.style.cssText = '';
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('left', cx + 'px', 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('top', top + 'px', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
    el.style.setProperty('transform', 'translate(-50%,-100%)', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('z-index', '300', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  } catch (e) {}
}
function syncHumanTurnStatus() {
  const el = $('botThinking');
  if (el?.dataset.humanTurn === '1') {
    el.dataset.humanTurn = '0';
    el.classList.add('hidden');
  }
  try {
    window.HORHolderCues789?.sync(game, myIndex, isSpectator);
  } catch (_) {}
}

function setBotThinking(on) {
  if (game?.phase === 'bidding' && isPortraitViewport() && window.HORUnifiedBidding752) {
    window.HORUnifiedBidding752.position();
    return;
  }
  const el = $('botThinking');
  if (!el) return;
  const waitPhase = !!(
    game &&
    (game.phase === 'discard' || game.phase === 'trump') &&
    game.bidder !== myIndex
  );
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
    el.dataset.humanTurn = '0';
    syncHumanTurnStatus();
  }
}
/** Human-like thinking delay (ms). Longer on hard decisions / harder difficulty. */
function humanThinkDelay() {
  const phase = game?.phase || 'play';
  // Base range by difficulty
  let lo, hi;
  if (botDifficulty === 'easy') {
    lo = 600;
    hi = 1600;
  } else if (botDifficulty === 'hard') {
    lo = 1100;
    hi = 2800;
  } else if (botDifficulty === 'extreme') {
    lo = 900;
    hi = 2600;
  } else {
    lo = 800;
    hi = 2200;
  } // normal

  // Bidding: a little extra thought
  if (phase === 'bidding') {
    lo += 200;
    hi += 600;
  }

  // Nest + trump: they just picked up extra cards. Sit with the hand.
  if (phase === 'discard') {
    lo = 2800;
    hi = 7200;
    if (botDifficulty === 'easy') {
      lo = 1800;
      hi = 4800;
    }
    if (botDifficulty === 'hard' || botDifficulty === 'extreme') {
      lo = 3200;
      hi = 8600;
    }
  }
  if (phase === 'trump') {
    lo = 1600;
    hi = 4800;
    if (botDifficulty === 'easy') {
      lo = 1100;
      hi = 3200;
    }
    if (botDifficulty === 'hard' || botDifficulty === 'extreme') {
      lo = 2000;
      hi = 5600;
    }
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
  const cap =
    phase === 'discard' ? 4500 : phase === 'trump' ? 3000 : phase === 'bidding' ? 2500 : 3200;
  return solScaledDelay(Math.max(120, Math.min(cap, Math.round(delay * mult))), 140);
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
  botDue063 = Date.now() + delay;

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
          try {
            runBotAction();
          } catch (e2) {
            console.error('Bot retry failed:', e2);
          }
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
    if (isBotTurn() && (!botTimer || Date.now() > botDue063 + 1000)) scheduleBot();
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
    if (
      document.hidden ||
      !game ||
      !isHost ||
      game.phase !== 'bidding' ||
      game.paused ||
      game.resolvingTrick ||
      window.horTourBlocking
    )
      return;
    if (!isBotTurn()) return;
    if (botTimer && Date.now() <= botDue063 + 4000) return;
    console.warn('[071] Recovering stalled bidding bot timer', {
      currentPlayer: game.currentPlayer,
      hadTimer: !!botTimer,
    });
    horRecoverForegroundBotTurn();
  } catch (e) {
    console.warn('[071] Bidding watchdog error', e);
  }
}, 2000);

function runBotAction() {
  if (!game || !isHost || game.resolvingTrick || game.claimAnimating) return;
  if (window.horTourBlocking) {
    window.horTourResumeBot = true;
    return;
  }

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
  let rook = null,
    red1 = null,
    red2 = null;
  hand.forEach((c) => {
    if (c.color === 'rook') rook = c;
    else if (isRed1(c)) red1 = c;
    else if (isRed2(c)) red2 = c;
    else if (byColor[c.color]) byColor[c.color].push(c);
  });
  const suitScores = {};
  COLORS.forEach((col) => {
    const cards = byColor[col];
    let score = cards.length * 12;
    cards.forEach((c) => {
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
  const voids = COLORS.filter((c) => byColor[c].length === 0).length;
  const shorts = COLORS.filter((c) => byColor[c].length <= 1).length;
  return { byColor, suitScores, rook, red1, red2, voids, shorts };
}

function bestTrumpColor(hand) {
  const a = analyzeHand(hand);
  let best = COLORS[0],
    bestScore = -1;
  COLORS.forEach((col) => {
    if (a.suitScores[col] > bestScore) {
      bestScore = a.suitScores[col];
      best = col;
    }
  });
  return best;
}

/** Estimate counters this hand can capture if it names best trump. */

function botPersonaStyle(idx) {
  return (players[idx] && players[idx].botStyle) || 'balanced';
}

function styleTrumpColor(hand, style) {
  const counts = {};
  COLORS.forEach((c) => {
    counts[c] = 0;
  });
  (hand || []).forEach((c) => {
    if (c && counts[c.color] != null) counts[c.color] += 1 + (c.rank >= 12 ? 1 : 0);
  });
  const ranked = COLORS.slice().sort((a, b) => counts[b] - counts[a]);
  if (style === 'tricky' && ranked[1] && counts[ranked[1]] >= 2 && Math.random() < 0.4)
    return ranked[1];
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
    ? legal.filter((c) => compareCards(c, winner.card, game.ledColor, trump) > 0)
    : [];
  const low = (arr) => {
    const a = arr && arr.length ? arr : legal;
    return a
      .slice()
      .sort((x, y) => cardPoints(x) - cardPoints(y) || effectiveRank(x) - effectiveRank(y))[0];
  };
  const high = (arr) => {
    const a = arr && arr.length ? arr : legal;
    return a
      .slice()
      .sort((x, y) => cardPoints(y) - cardPoints(x) || effectiveRank(y) - effectiveRank(x))[0];
  };
  const noPts = legal.filter((c) => !cardPoints(c));
  const trumps = legal.filter(
    (c) => c.color === trump || (typeof isPermanentTrump === 'function' && isPermanentTrump(c))
  );
  const off = legal.filter(
    (c) => c.color !== trump && !(typeof isPermanentTrump === 'function' && isPermanentTrump(c))
  );

  if (style === 'randomish') return legal[Math.floor(Math.random() * legal.length)];

  if (style === 'partnerFirst') {
    if (partnerWinning && winner) {
      const safe = legal.filter((c) => compareCards(c, winner.card, game.ledColor, trump) <= 0);
      const pool = safe.length ? safe : legal;
      if (game.trick.length === 3)
        return pool.slice().sort((a, b) => cardPoints(b) - cardPoints(a))[0];
      return low(
        pool.filter((c) => !cardPoints(c)).length ? pool.filter((c) => !cardPoints(c)) : pool
      );
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
      const fat = legal.filter((c) => cardPoints(c) >= 10);
      if (fat.length) return high(fat);
    }
    if (!leading && !beaters.length) return low(noPts.length ? noPts : legal);
    return high(legal);
  }

  if (style === 'trumpHeavy') {
    if (leading && trumps.length) {
      const plain = trumps.filter((c) => c.color === trump && c.color !== 'rook');
      return high(plain.length ? plain : trumps);
    }
    if (!leading && beaters.length) {
      const tBeat = beaters.filter(
        (c) => c.color === trump || (typeof isPermanentTrump === 'function' && isPermanentTrump(c))
      );
      if (tBeat.length && pts >= 5) return low(tBeat);
      if (pts >= 10) return low(beaters);
    }
    return low(noPts.length ? noPts : legal);
  }

  if (style === 'voidMaker') {
    const groups = COLORS.map((col) => legal.filter((c) => c.color === col)).filter(
      (g) => g.length
    );
    groups.sort((a, b) => a.length - b.length);
    if (leading && groups[0] && groups[0][0].color !== trump) return low(groups[0]);
    if (!leading && !beaters.length) {
      const short = groups[0] || legal;
      return low(short);
    }
    return null;
  }

  if (style === 'countSaver') {
    if (partnerWinning)
      return high(
        legal.filter((c) => cardPoints(c)).length && game.trick.length === 3
          ? legal.filter((c) => cardPoints(c))
          : noPts.length
            ? noPts
            : legal
      );
    if (!leading && !beaters.length) return low(noPts.length ? noPts : legal);
    if (!leading && beaters.length && pts >= 10) return low(beaters);
    return low(noPts.length ? noPts : legal);
  }
  if (style === 'leadLong') {
    const groups = COLORS.map((col) => legal.filter((c) => c.color === col)).filter(
      (g) => g.length
    );
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
    const specials = legal.filter(
      (c) =>
        (typeof isRed2 === 'function' && isRed2(c)) ||
        (typeof isRed1 === 'function' && isRed1(c)) ||
        c.color === 'rook'
    );
    if (!leading && beaters.length && (specials.length || pts >= 15))
      return high(specials.length ? specials : beaters);
    if (leading && specials.length && Math.random() < 0.45) return specials[0];
    return null;
  }
  if (style === 'lastTrick') {
    const left = (game.hands || []).reduce((n, h) => n + ((h && h.length) || 0), 0);
    if (left <= 8 && trumps.length)
      return leading
        ? high(trumps)
        : beaters.length
          ? high(
              beaters.filter((c) => c.color === trump).length
                ? beaters.filter((c) => c.color === trump)
                : beaters
            )
          : low(noPts.length ? noPts : legal);
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
      const mid = legal.filter((c) => !cardPoints(c) && effectiveRank(c) >= 8);
      if (mid.length) return mid[Math.floor(Math.random() * mid.length)];
      return legal[Math.min(legal.length - 1, Math.floor(legal.length / 2))];
    }
    if (partnerWinning && pts >= 10 && game.trick.length === 3 && winner) {
      const feed = legal.filter((c) => compareCards(c, winner.card, game.ledColor, trump) <= 0);
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
    'counters': 'counters first',
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
  if (isSoloPractice || roomCode === 'OFFLINE' || code === 'OFFLINE') {
    setQrOpen(false);
    return;
  }
  const link = joinLink(code),
    line = $('joinLinkLine'),
    graphic = $('qrGraphic845');
  if (line) {
    line.replaceChildren();
    if (/^https?:/i.test(link)) {
      const a = document.createElement('a');
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Open table ' + String(code || roomCode || '');
      line.appendChild(a);
    }
  }
  const label = $('qrTable845');
  if (label) label.textContent = 'TABLE ' + String(code || roomCode || '');
  if (!graphic) return;
  graphic.replaceChildren();
  try {
    if (!/^https?:/i.test(link)) throw Error('No hosted join link');
    const source = document.createElement('div');
    const qr = new QRCode(source, {
      text: link,
      width: 512,
      height: 512,
      correctLevel: QRCode.CorrectLevel.M,
    });
    const model = qr._oQRCode,
      count = model.getModuleCount(),
      unit = 8;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = (count + 8) * unit;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let y = 0; y < count; y++)
      for (let x = 0; x < count; x++)
        if (model.isDark(y, x)) ctx.fillRect((x + 4) * unit, (y + 4) * unit, unit, unit);
    graphic.appendChild(canvas);
    graphic.setAttribute('aria-label', 'Scan to join table ' + String(code || roomCode || ''));
  } catch (e) {
    graphic.textContent = 'QR unavailable. Use the table code or join link.';
  }
}

// A same-origin ZIP player owns the browser's top-level share identity.
// Brand that document too; never read or modify an unrelated cross-origin parent.
function horSyncShareBrand845() {
  const icon =
    document.querySelector('link[rel~="icon"]')?.href ||
    new URL('assets/images/house-of-rooks-192.png?v=845', location.href).href;
  for (const doc of [
    document,
    (() => {
      try {
        return window.top.document;
      } catch (e) {
        return null;
      }
    })(),
  ]) {
    if (!doc) continue;
    doc.title = 'House of Rooks';
    for (const old of doc.querySelectorAll('link[rel~="icon"]')) old.remove();
    const mark = doc.createElement('link');
    mark.rel = 'icon';
    mark.type = 'image/png';
    mark.sizes = '192x192';
    mark.href = icon;
    doc.head.appendChild(mark);
  }
}
horSyncShareBrand845();

function copyRoomCode() {
  if (isSoloPractice || roomCode === 'OFFLINE') return;
  const code = roomCode || ($('displayCode') && $('displayCode').textContent);
  if (!code) return;
  const hosted = canShareJoinQr();
  const text = hosted ? joinLink(code) : String(code);
  const done = () => {
    const st = $('waitingStatus');
    if (st) st.textContent = hosted ? 'Join link copied!' : 'Code copied!';
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(done)
      .catch(() => {
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
  try {
    document.execCommand('copy');
  } catch (e) {}
  document.body.removeChild(ta);
}

function shareRoomText(code, url) {
  const site = String(url || '').trim();
  return (
    'Sit at my House of Rooks table.\nCode: ' + String(code || '') + (site ? '\n\n' + site : '')
  );
}

function shareRoom() {
  if (isSoloPractice || roomCode === 'OFFLINE') return;
  horSyncShareBrand845();
  const code = roomCode || '';
  const url = canShareJoinQr() ? joinLink(code) : '';
  const text = url
    ? shareRoomText(code, url)
    : 'Sit at my House of Rooks table.\nCode: ' +
      code +
      '\n\nOpen House of Rooks on your phone, tap Join with a code, type that code. Do not open a file link.';
  const canShare = typeof navigator.share === 'function';
  const go = () => {
    fallbackCopy(text);
    const st = $('waitingStatus');
    if (st)
      st.textContent = url
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
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

function wantLandscapeFullscreen() {
  // 839: fullscreen is a user choice, independent of phone orientation.
  return typeof window.HORManualFullscreen831 === 'boolean'
    ? window.HORManualFullscreen831
    : !!fullscreenElement();
}

function enterLandscapeFullscreen() {
  if (!wantLandscapeFullscreen()) return;
  try {
    if (!fullscreenElement()) {
      const el = document.documentElement;
      const req =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.webkitRequestFullScreen ||
        el.msRequestFullscreen;
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
      const ex =
        document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
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
  const on = !!(
    fullscreenElement() ||
    (document.body && document.body.classList.contains('page-fit'))
  );
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
  try {
    document.body.classList.toggle('is-fullscreen', on);
  } catch (e) {}
}

function toggleFullscreen() {
  try {
    document.body.classList.toggle('page-fit');
  } catch (e) {}
  syncBrowserFitBtn();
}

// Hook bot into the prompt / phase-change functions
// (hostPromptPlay already calls scheduleBot itself)
const _origPromptBid = hostPromptBid;
hostPromptBid = function () {
  _origPromptBid();
  scheduleBot();
};

const _origFinishBidding = finishBidding;
finishBidding = function () {
  _origFinishBidding();
  scheduleBot();
};

const _origProcessTrump = hostProcessTrump;
hostProcessTrump = function (data) {
  _origProcessTrump(data);
  // hostProcessTrump ends with hostPromptPlay which schedules bots
};

const _origProcessDiscard = hostProcessDiscard;
hostProcessDiscard = function (data) {
  _origProcessDiscard(data);
  scheduleBot();
};

// ========== Event listeners ==========
function bindClick(id, fn) {
  const el = $(id);
  if (el) el.onclick = fn;
}

document.addEventListener(
  'pointerdown',
  () => {
    ensureAudio();
  },
  { once: false }
);

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
  const name = (($('hor-player-name') && $('hor-player-name').value) || '').trim();
  if (!name) {
    alert('Enter the same name you used before');
    return;
  }
  myName = name;
  try {
    const sess = loadSession();
    const codeEl = $('hor-room-code');
    if (codeEl && !(codeEl.value || '').trim() && sess && sess.roomCode)
      codeEl.value = sess.roomCode;
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
        if (!lobbyEl?.classList.contains('landing783'))
          input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (e) {
        try {
          input.focus();
        } catch (e2) {}
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
    try {
      sessionStorage.removeItem('rookSession');
    } catch (e) {}
    location.reload();
    return;
  }
  hideWelcomeScreen();
  if (lobby) lobby.classList.remove('hidden');
  try {
    document.body.classList.remove('at-table');
  } catch (e) {}
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
      try {
        playLobbySeatClickSound();
      } catch (e) {}
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
        setJoinStatus(
          name
            ? 'Name saved. Now tap the empty seat you want.'
            : 'Type your name, then tap an empty seat.'
        );
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
  if (!validateRuleSetup()) return false;
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
    try {
      document.body.classList.add('offline-play', 'in-game');
    } catch (e) {}
    isHost = true;
    try {
      if (peer && peer.destroy) peer.destroy();
    } catch (e) {}
    peer = null;
    hostConnection = null;
    try {
      if (typeof connMap === 'object') Object.keys(connMap).forEach((k) => delete connMap[k]);
    } catch (e) {}

    myName = (($('hor-player-name') && $('hor-player-name').value) || '').trim() || myName || 'You';
    myPeerId = 'solo-' + Math.random().toString(36).slice(2, 9);
    roomCode = 'OFFLINE';
    players = [
      {
        id: myPeerId,
        name: myName,
        team: 0,
        isHost: true,
        isBot: false,
        seat: 0,
        avatar: ensurePreferredAvatar() || AVATARS[0],
        voice: loadPreferredVoice(),
        careerPublic: horMyCareerProfile(),
      },
    ];
    applyPreferredAvatarToMe();

    // 3 named persona bots (no network)
    while (players.length < 4) {
      const seat = firstEmptySeat();
      addBot(seat, window.HORLanding783?.rosterForStart()?.[seat - 1]?.name);
    }
    balanceTeams();
    myIndex = players.findIndex((p) => p.id === myPeerId);
    if (myIndex < 0) myIndex = 0;

    try {
      if (typeof recomputeHandAndNest === 'function') recomputeHandAndNest();
    } catch (e) {}

    // Hide lobby/waiting, show game
    try {
      lobby && lobby.classList.add('hidden');
    } catch (e) {}
    try {
      waiting && waiting.classList.add('hidden');
    } catch (e) {}
    try {
      hideWelcomeScreen();
    } catch (e) {}
    showGame();
    updatePracticeBadge();

    // Seat bots on 1/2/3 explicitly so the deal cannot abort.
    try {
      [1, 2, 3].forEach((s) => {
        if (!playerAtSeat(s)) addBot(s);
      });
    } catch (e) {}

    try {
      hostStartGame();
    } catch (e) {
      console.error(e);
    }
    try {
      lobby && lobby.classList.add('hidden');
    } catch (e) {}
    try {
      showGame();
    } catch (e) {}

    const note = $('messageArea');
    if (note) note.textContent = 'Offline practice — you vs 3 bots. Bots only use public info.';
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
    myIndex = players.findIndex((p) => p.id === myPeerId);
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
try {
  bindNoServiceModal();
} catch (e) {}
window.addEventListener('offline', () => {
  try {
    if (isSoloPractice || roomCode === 'OFFLINE') return;
    // A browser "offline" event is advisory on mobile. Never tear down or
    // replace a live/recovering multiplayer table because of it.
    if (horClientIsPlaying() || (hostConnection && hostConnection.open)) return;
    if (!isHost && (!game || !game.phase || ['lobby', 'waiting', ''].includes(game.phase)))
      offerOfflinePlay();
  } catch (e) {}
});
window.addEventListener('online', () => {
  window._horNoServiceStop = false;
});
bindClick('leaveReplaceBtn', () => {
  try {
    clientLeaveReplace();
  } catch (e) {
    console.error(e);
  }
});
(function wireBotStyleLongPress() {
  let timer = 0,
    armedName = '',
    shown = false,
    startX = 0,
    startY = 0;
  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    armedName = '';
  };
  const sourceName = (el) => {
    // Career stars own their gesture completely. Never let a tap/hold on ★ fall
    // through to the persona long-press handler.
    if (el && el.closest && el.closest('.hor-career-badge')) return '';
    const tagged = el && el.closest && el.closest('[data-botname]');
    return tagged ? tagged.getAttribute('data-botname') || '' : '';
  };
  const arm = (target, x, y) => {
    const name = sourceName(target);
    shown = false;
    if (!name) {
      cancel();
      return;
    }
    cancel();
    armedName = name;
    startX = Number(x) || 0;
    startY = Number(y) || 0;
    timer = setTimeout(() => {
      timer = 0;
      shown = true;
      showBotStyleTip(armedName, {
        clientX: startX || 24,
        clientY: startY || 24,
        preventDefault() {},
        stopPropagation() {},
      });
    }, 480);
  };
  document.addEventListener('pointerdown', (e) => arm(e.target, e.clientX, e.clientY), {
    passive: true,
  });
  document.addEventListener('pointerup', cancel, { passive: true });
  document.addEventListener('pointercancel', cancel, { passive: true });
  document.addEventListener(
    'pointermove',
    (e) => {
      if (
        timer &&
        Math.abs((Number(e.clientX) || 0) - startX) + Math.abs((Number(e.clientY) || 0) - startY) >
          14
      )
        cancel();
    },
    { passive: true }
  );
  document.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches && e.touches[0];
      if (t) arm(e.target, t.clientX, t.clientY);
    },
    { passive: true }
  );
  document.addEventListener('touchend', cancel, { passive: true });
  document.addEventListener('touchcancel', cancel, { passive: true });
  document.addEventListener(
    'touchmove',
    (e) => {
      if (!timer) return;
      const t = e.touches && e.touches[0];
      if (t && Math.abs(t.clientX - startX) + Math.abs(t.clientY - startY) > 14) cancel();
    },
    { passive: true }
  );
  document.addEventListener(
    'contextmenu',
    (e) => {
      const tagged = e.target && e.target.closest && e.target.closest('[data-botname]');
      if (!tagged) return;
      e.preventDefault();
      e.stopPropagation();
      const name = tagged.getAttribute('data-botname') || '';
      if (name) showBotStyleTip(name, e);
    },
    true
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target && e.target.closest && e.target.closest('.bot-style-tip-close')) {
        e.preventDefault();
        hideBotStyleTip();
        return;
      }
      const tip = $('botStyleTip');
      if (
        tip &&
        !tip.classList.contains('hidden') &&
        !(e.target && e.target.closest && e.target.closest('#botStyleTip')) &&
        !sourceName(e.target)
      )
        hideBotStyleTip();
    },
    true
  );
  document.addEventListener(
    'click',
    (e) => {
      if (shown) {
        e.preventDefault();
        e.stopPropagation();
        shown = false;
      }
    },
    true
  );
})();
bindClick('botPickerClose', closeBotPicker);
const _botPickModal = $('botPickerModal');
if (_botPickModal)
  _botPickModal.addEventListener('click', (e) => {
    if (e.target === _botPickModal) closeBotPicker();
  });
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
      try {
        hostConnection.close();
      } catch (e) {}
    }
  } catch (e) {}
  hostConnection = null;

  try {
    if (typeof connMap === 'object' && connMap) {
      Object.keys(connMap).forEach((k) => {
        try {
          if (connMap[k] && connMap[k].close) connMap[k].close();
        } catch (e) {}
        try {
          delete connMap[k];
        } catch (e) {}
      });
    }
  } catch (e) {}

  try {
    if (peer) {
      try {
        if (peer.disconnect) peer.disconnect();
      } catch (e) {}
      try {
        if (peer.destroy) peer.destroy();
      } catch (e) {}
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
  try {
    showVariantRules();
  } catch (e) {}
  if (rulesModal) rulesModal.classList.remove('hidden');
});
bindClick('closeRules', () => {
  if (rulesModal) rulesModal.classList.add('hidden');
});
bindClick('btnRulesInGame', () => {
  try {
    showVariantRules();
  } catch (e) {}
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
  const ok = window.confirm(
    "This will clear this app's cached files on this device and reload. Your name, career progress, and settings are kept. Continue?"
  );
  if (ok) horForceUpdate();
});
bindClick('btnMute', toggleMute);
bindClick('btnStats', showStatsModal);
try {
  wireTargetScoreUI();
} catch (e) {}
bindClick('ltTabTrick', () => setLandscapeTab(false));
bindClick('ltTabLast5', () => setLandscapeTab(true));

bindClick('closeStats', () => {
  const m = $('statsModal');
  if (m) m.classList.add('hidden');
});
bindClick('btnTransferHost', hostTransferHost);
applyA11y();

// Always bind the in-game Game Options Done button from the global event-listener setup.
// Do not rely on the waiting-room renderer to wire this control: Offline Practice and
// active games can use the modal after the waiting screen has been hidden.
bindClick('closeHostOptionsBtn', (e) => {
  if (e) e.preventDefault();
  closeHostOptionsModal();
});

function syncQuickMenuSound() {
  const st = $('menuSoundQuickState');
  if (st) st.textContent = soundMuted ? 'Muted' : 'On';
  const b = $('menuSoundQuick');
  if (b) b.classList.toggle('is-muted', !!soundMuted);
}
bindClick('menuSoundQuick', () => {
  const b = $('btnMute');
  if (b) b.click();
  setTimeout(syncQuickMenuSound, 0);
});
bindClick('menuStatsQuick', () => {
  closeHostOptionsModal();
  const b = $('btnStats');
  if (b) b.click();
});
bindClick('menuRulesQuick', () => {
  closeHostOptionsModal();
  const b = $('btnRulesInGame');
  if (b) b.click();
});

bindClick('btnGameOptions', () => {
  try {
    const modal = $('hostOptionsModal');
    if (!modal) {
      console.error('Game options modal missing from DOM');
      return;
    }
    openHostOptionsModal();
  } catch (e) {
    console.error('Game options open failed:', e);
  }
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
    try {
      openHostOptionsModal();
    } catch (err) {
      console.error('Lobby game options open failed:', err);
    }
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
  try {
    localStorage.setItem('rookTopOptsCollapsed', collapsed ? '1' : '0');
  } catch (e) {}
});
(function restoreTopOpts() {
  try {
    if (localStorage.getItem('rookTopOptsCollapsed') === '1') {
      const bar = $('topBar');
      const btn = $('btnToggleTopOpts');
      if (bar) bar.classList.add('opts-collapsed');
      if (btn) {
        btn.textContent = '☰';
        btn.title = 'Show options';
      }
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
    houseConfirm({
      title: 'Pause the table?',
      body: 'Everyone waits until you resume.',
      danger: false,
    }).then((ok) => {
      if (ok) hostTogglePause();
    });
    return;
  }
  hostTogglePause();
});
bindClick('btnResumePause', () => {
  if (isHost && game && game.paused) hostTogglePause();
});

bindClick('copyCodeBtn', copyRoomCode);
bindClick('shareBtn', shareRoom);
function setQrOpen(open) {
  if (isSoloPractice || roomCode === 'OFFLINE') open = false;
  const box = $('qrBox');
  const btn = $('showQrBtn');
  if (!box) return;
  if (open) {
    try {
      document.body.appendChild(box);
    } catch (e) {}
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
    try {
      applyWaitingShareMode();
    } catch (e) {}
    const st = $('waitingStatus');
    if (st)
      st.textContent =
        'QR is off on Wi‑Fi. Friends join with the 4-letter code on their own phone.';
    return;
  }
  const box = $('qrBox');
  if (!box) return;
  setQrOpen(box.classList.contains('hidden'));
});
bindClick('closeQrBtn', () => setQrOpen(false));
function openHandHistory(opts) {
  const fromScore = !!(opts && opts.fromScoreboard);
  const modal = $('historyModal');
  const body = $('historyBody');
  if (!modal || !body) return;
  try {
    document.body.appendChild(modal);
  } catch (e) {}
  modal.classList.toggle('from-scoreboard', fromScore);
  if (!handHistory.length) {
    body.innerHTML = '<p class="option-hint">No hands played yet.</p>';
  } else {
    const teamAName = statTeamName(0),
      teamBName = statTeamName(1);
    body.innerHTML = handHistory
      .map(
        (h, i) => `
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
    `
      )
      .join('');
  }
  modal.classList.remove('hidden');
  const close = $('closeHistory');
  if (close) {
    close.textContent = fromScore ? 'Back to Scoreboard' : 'Close';
    close.focus({ preventScroll: true });
  }
}
function closeHandHistory() {
  const hm = $('historyModal');
  if (!hm) return;
  const fromScore = hm.classList.contains('from-scoreboard');
  hm.classList.add('hidden');
  hm.classList.remove('from-scoreboard');
  if (fromScore) {
    const score = $('scoreModal');
    if (score) score.classList.remove('hidden');
    $('scoreModalHistory')?.focus({ preventScroll: true });
  }
}
bindClick('btnHistory', () => openHandHistory());
bindClick('closeHistory', () => closeHandHistory());
bindClick('winOk', () => {
  try {
    startMatchCelebration();
  } catch (e) {
    console.error(e);
  }
});
bindClick('celeRematch', () => {
  try {
    requestRematch();
  } catch (e) {
    console.error(e);
  }
});
bindClick('celeWaiting', () => {
  try {
    requestWaitingRoom();
  } catch (e) {
    console.error(e);
  }
});

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
  return CARD_BACKS.some((b) => b.id === id) ? id : 'griffin';
}

function applyCardBack(id, persist) {
  cardBackId = normalizeCardBackId(id);
  document.body.classList.remove(...CARD_BACK_CLASSES);
  document.body.classList.add('cardback-' + cardBackId);
  if (persist !== false) {
    try {
      localStorage.setItem('rookCardBack', cardBackId);
    } catch (e) {}
  }
}

(function initPrefs() {
  const t = parseInt(localStorage.getItem('rookTheme') || '0', 10);
  themeIndex = isNaN(t) ? 0 : t % THEMES.length;
  document.body.classList.remove(...THEMES);
  document.body.classList.add(THEMES[themeIndex]);
  try {
    cardBackId = normalizeCardBackId(localStorage.getItem('rookCardBack') || 'griffin');
  } catch (e) {
    cardBackId = 'griffin';
  }
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
    const have = new Set(Array.from(bd.options).map((o) => o.value));
    wanted.forEach(([val, label]) => {
      let opt = Array.from(bd.options).find((o) => o.value === val);
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

function updateLandscapeTheater() {
  const endEl = $('ltEndGame');
  const endSummary = landscapeLastSummary;
  const isLandscape = window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
  $('landscapeTheater')?.setAttribute('aria-hidden', String(!isLandscape));
  if (endEl) {
    const goal = (game && game.targetScore) || targetScore || 500;
    const isScore = !!(game && game.phase === 'score');
    const scores =
      endSummary && Array.isArray(endSummary.scores)
        ? endSummary.scores
        : game && game.scores
          ? game.scores
          : [0, 0];
    const isGameOver = isMatchOver(scores, goal);
    if (isLandscape && isScore && endSummary) {
      const winnerTeam =
        scores[0] === scores[1] ? 'Tie' : scores[0] > scores[1] ? 'Team A' : 'Team B';
      const nestCards = Array.isArray(endSummary.nestCards) ? endSummary.nestCards : [];
      const revealHands = Array.isArray(endSummary.claimRevealHands)
        ? endSummary.claimRevealHands
        : [];
      const hasReveal = revealHands.some((h) => Array.isArray(h.cards));
      const showRemain = !!(window._ltShowRemaining && hasReveal);
      if (showRemain) {
        endEl.classList.add('hidden');
        endEl.innerHTML = '';
      } else {
        endEl.innerHTML = `
          <div class="lt-endgame-banner ${endSummary.made ? 'made' : 'set'}">
            <div class="lt-endgame-title">${isGameOver ? '🏆 FINAL SCORE' : endSummary.made ? '✅ BID MADE!' : '❌ SET!'}</div>
            <div class="lt-endgame-scores">
              <div class="${endSummary.made ? (endSummary.bidderTeam === 0 ? 'lt-hand-winner' : '') : endSummary.bidderTeam === 1 ? 'lt-hand-winner' : ''}"><span>Team A</span><b>${scores[0]}</b><small>${endSummary.scoreDeltaA >= 0 ? '+' : ''}${endSummary.scoreDeltaA || 0} this hand</small></div>
              <div class="lt-endgame-vs">${winnerTeam === 'Tie' ? 'TIE' : 'VS'}</div>
              <div class="${endSummary.made ? (endSummary.bidderTeam === 1 ? 'lt-hand-winner' : '') : endSummary.bidderTeam === 0 ? 'lt-hand-winner' : ''}"><span>Team B</span><b>${scores[1]}</b><small>${endSummary.scoreDeltaB >= 0 ? '+' : ''}${endSummary.scoreDeltaB || 0} this hand</small></div>
            </div>
            <div class="lt-hand-winner-banner">${
              endSummary.made
                ? `Team ${endSummary.bidderTeam === 0 ? 'A' : 'B'} wins the hand — bid made`
                : `Team ${endSummary.bidderTeam === 0 ? 'B' : 'A'} wins the hand — bid set`
            }</div>
            <div class="lt-endgame-detail">Bid ${endSummary.bid} · Trump ${COLOR_NAMES[endSummary.trump] || endSummary.trump || '—'} · A ${endSummary.pointsA} pts · B ${endSummary.pointsB} pts</div>
            ${nestCards.length ? `<div class="lt-endgame-nest"><span>Nest — ${endSummary.nestWinnerName || 'Winner'}${endSummary.nestPts ? ' · ' + endSummary.nestPts + ' pts' : ''}</span><div>${nestCards.map((c) => `<span class="lt-endgame-nest-card">${nestCardMarkup(c)}</span>`).join('')}</div></div>` : ''}
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
            try {
              hostStartNextHand();
            } catch (e) {
              console.error(e);
            }
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
          try {
            updateLandscapeTheater();
          } catch (e) {}
          try {
            window.HORCharacterStudio077?.sync();
          } catch (e) {
            console.warn('Character presentation:', e);
          }
          const scoreModal = $('scoreModal');
          if (scoreModal && endSummary) {
            scoreModal.classList.add('showing-remaining');
            try {
              showClaimRemainingHands(endSummary);
            } catch (e) {}
            const title = $('scoreModalTitle');
            if (title) title.textContent = 'Remaining Cards';
          }
        };
      }
      const last3Lt = $('ltScoreLast3');
      if (last3Lt) {
        last3Lt.onclick = () => {
          if (endSummary && Array.isArray(endSummary.lastTricks))
            window._scoreLastTricks = endSummary.lastTricks;
          try {
            openPortraitLast3();
          } catch (e) {}
        };
      }
      const back = $('ltScoreBack');
      if (back) {
        back.onclick = () => {
          window._ltShowRemaining = false;
          try {
            updateLandscapeTheater();
          } catch (e) {}
          try {
            window.HORCharacterStudio077?.sync();
          } catch (e) {
            console.warn('Character presentation:', e);
          }
          const scoreModal = $('scoreModal');
          if (scoreModal && endSummary && !isLandscapeNow()) {
            try {
              showScoreModal(endSummary);
            } catch (e) {}
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
  try {
    syncLandscapeBidBar();
    syncLandscapeTrumpBar();
    syncLandscapeClaimBar();
    syncWaitBanners();
  } catch (e) {}
  if (ltShowLast5) {
    try {
      renderLandscapeLast5();
    } catch (e) {}
  }
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
    if (
      typeof isSoloPractice !== 'undefined' &&
      isSoloPractice &&
      typeof myIndex === 'number' &&
      idx === myIndex
    ) {
      return myName || 'Host';
    }
    if (typeof myIndex === 'number' && idx === myIndex && myName) return myName;
    return 'Player ' + (idx + 1);
  };
  const teamOf = (idx) => {
    if (plist[idx] && typeof plist[idx].team === 'number') return plist[idx].team;
    return idx % 2;
  };
  let mySeat = typeof myIndex === 'number' && myIndex >= 0 ? myIndex : -1;

  const partnerSeat = mySeat >= 0 ? (mySeat + 2) % 4 : -1;
  const isBidding = !!(game && game.phase === 'bidding');
  const isTrumpChoice = !!(
    game &&
    game.phase === 'trump' &&
    game.bidder === myIndex &&
    !isSpectator
  );

  if (isTrumpChoice) {
    playsEl.innerHTML =
      '<div class="lt-trump-prompt">Pick the trump suit below. Your full hand stays visible.</div>';
    if (footerEl) footerEl.textContent = '';
  }

  let trick = game && game.trick && game.trick.length ? game.trick : null;
  let winnerIdx = game && game.resolvingTrick ? game.lastTrickWinner : null;
  let showingLast = false;
  // Do not reuse the previous completed trick during normal play. That stale
  // fallback was causing cards to pop back onto the table after capture.
  if (
    (!trick || !trick.length) &&
    game &&
    game.resolvingTrick &&
    lastCompletedTrick &&
    lastCompletedTrick.length &&
    !isBidding
  ) {
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

  const trump = game && game.trump ? COLOR_NAMES[game.trump] || game.trump : null;
  const led = game && game.ledColor ? COLOR_NAMES[game.ledColor] || game.ledColor : null;
  if (metaEl) {
    const parts = [];
    if (isBidding) {
      const turnName = nameOf(game.currentPlayer);
      parts.push(turnName + ' to bid');
      if (hasActualHighBid())
        parts.push('High: ' + formatBidAmount(game.highestBid, { short: true }));
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
    const status = game.bidStatus || [];
    const turnIdx = game.currentPlayer;
    playsEl.innerHTML =
      '<div class="lt-bid-board">' +
      [0, 1, 2, 3]
        .map((i) => {
          const st = status[i];
          const high = game.bidder === i;
          const me = mySeat === i;
          const toAct = turnIdx === i;
          const partner = partnerSeat === i;
          const p = plist[i] || players[i] || {};
          const av = p.avatar || (p.id && playerAvatars[p.id]) || AVATARS[0];
          const cls = [
            'lt-bid-seat',
            !isFirstHandOfMatch() && high ? 'high' : '',
            st === 'pass' ? 'passed' : '',
            me ? 'me' : '',
            partner ? 'partner' : '',
            !isFirstHandOfMatch() && toAct ? 'to-act' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const unified = window.HORUnifiedBidding752.state(game, i, myIndex, isSpectator);
          const line = unified.label || 'waiting';
          const tag = unified.previous
            ? '<div class="lt-bid-high">' + unified.previous + '</div>'
            : '';
          return (
            '<div class="' +
            cls +
            '">' +
            '<img class="lt-bid-av" src="' +
            avatarSrc(av) +
            '" alt="">' +
            '<div class="lt-bid-copy">' +
            '<div class="lt-bid-name">' +
            nameOf(i) +
            (me ? ' (you)' : '') +
            (partner ? ' · partner' : '') +
            '</div>' +
            '<div class="lt-bid-val">' +
            line +
            '</div>' +
            tag +
            '</div></div>'
          );
        })
        .join('') +
      '</div>';
    if (footerEl) {
      const waiter = nameOf(turnIdx);
      footerEl.textContent =
        (turnIdx === mySeat ? 'Your bid' : 'Waiting on ' + waiter) +
        (hasActualHighBid() ? ' · high ' + formatBidAmount(game.highestBid, { short: true }) : '');
    }
  } else if (game && (game.claimAnimating || game.claimAnimation)) {
    const holder =
      game.claimAnimation && game.claimAnimation.player != null
        ? game.claimAnimation.player
        : game.trumpClaimPlayer;
    const holderName = holder != null ? nameOf(holder) : 'Player';
    playsEl.innerHTML = `<div class="lt-empty lt-claim-msg">${holderName} is laying down the rest of the hand…</div>`;
    if (footerEl) footerEl.textContent = 'Winning cards on the felt';
  } else if (!trick || !trick.length) {
    playsEl.innerHTML = '<div class="lt-empty">Waiting for the next play…</div>';
    if (footerEl) {
      footerEl.textContent = partnerSeat >= 0 ? 'Your partner: ' + nameOf(partnerSeat) : '';
    }
  } else {
    playsEl.innerHTML = trick
      .map((t, i) => {
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
        const ord = ['1st', '2nd', '3rd', '4th'][i] || i + 1;
        const roleBits = [];
        if (isPartner) roleBits.push('<span class="lt-badge lt-partner">Partner</span>');
        if (isFinalWinner) roleBits.push('<span class="lt-badge lt-wins">Wins</span>');
        else if (isLeading) roleBits.push('<span class="lt-badge lt-leading">Leading</span>');
        if (isMe && !isFinalWinner && !isLeading) {
          roleBits.push('<span class="lt-badge lt-you">Me</span>');
        }
        const teamCls = teamOf(t.player) === 0 ? 'team-a' : 'team-b';
        return `<div data-c-seat="${seatSlotIdForIndex(t.player)}" data-c-play="${horCurrentHandVisualIndex()}:${t.player}:${t.card.id}" class="lt-play ${teamCls} ${isFinalWinner ? 'winner' : ''} ${isLeading ? 'leading' : ''} ${isPartner ? 'partner' : ''} ${isMe ? 'you' : ''} ${isLatest ? 'latest' : ''} ${isRookPulse ? 'rook-play-pulse' : ''}">
      <div class="lt-order">${ord}</div>
      ${isFinalWinner ? '<div class="lt-win-stamp">WINS</div>' : ''}
      ${typeof renderCardHTML === 'function' ? renderCardHTML(t.card, false) : ''}
      <div class="lt-name">${nameOf(t.player)}</div>
      <div class="lt-roles">${roleBits.join(' ')}</div>
    </div>`;
      })
      .join('');

    if (footerEl) {
      if (winnerIdx != null) {
        const wPartner = partnerSeat >= 0 && winnerIdx === partnerSeat;
        const wName = nameOf(winnerIdx);
        footerEl.textContent =
          '🏆 ' + wName + ' wins the trick' + (wPartner ? ' (your partner)' : '');
      } else if (leadingIdx != null) {
        const lPartner = partnerSeat >= 0 && leadingIdx === partnerSeat;
        const lName = nameOf(leadingIdx);
        footerEl.textContent =
          '👑 ' + lName + ' is winning so far' + (lPartner ? ' (partner)' : '');
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

  if (game?.myHand && game.phase !== 'dealing') window.HORHandOrder838?.apply(game.myHand);
  // --- Your hand in landscape (playable on turn; coach-highlighted while bidding) ---
  const handEl = $('ltHand');
  const handLabel = $('ltHandLabel');
  if (handLabel) {
    handLabel.textContent = 'Your hand';
  }
  if (handEl) {
    const dealing = !!(game && game.phase === 'dealing');
    const hand =
      game && Array.isArray(game.myHand)
        ? game.myHand
        : !dealing && typeof myIndex === 'number' && myIndex >= 0 && game && game.hands
          ? game.hands[myIndex] || []
          : [];
    const isMyTurn = !!(
      game &&
      game.phase === 'play' &&
      game.currentPlayer === myIndex &&
      !game.resolvingTrick &&
      !game.paused &&
      !isSpectator &&
      !game.claimAnimating &&
      !game.trumpPresentation833
    );
    try {
      maybeRemindTurn();
    } catch (e) {}
    if (handLabel) {
      handLabel.textContent = hand.length
        ? 'Your hand · ' + hand.length + (hand.length === 1 ? ' card' : ' cards')
        : 'Your hand';
    }
    if (!hand.length) {
      handEl.innerHTML = '';
    } else {
      handEl.innerHTML = hand
        .map((card) => {
          let extra = 'lt-waiting';
          if (isMyTurn) {
            extra = cardLegalClass(card, hand);
          }
          const html = renderCardHTML(card, true);
          return html.replace('class="card-face ', 'class="card-face ' + extra + ' ');
        })
        .join('');
      handEl.querySelectorAll('.card-face').forEach((el) => {
        el.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!game || game.phase !== 'play' || isSpectator) return;
          const id = String(el.dataset.id);
          try {
            playCardIfMyTurn(id);
          } catch (e) {
            console.error(e);
          }
        };
      });
    }
  }

  // Android/WebView can repaint the theater without passing through the
  // portrait renderer. Launch the guarded landscape flight after the cards
  // have actually been painted. The internal key/lock guarantees one flight.
  if (
    isLandscape &&
    game &&
    game.resolvingTrick &&
    game.trick &&
    game.trick.length === 4 &&
    game.lastTrickWinner != null
  ) {
    const k = trickResolveKey(game.lastTrickWinner, game.trick);
    // IMPORTANT: do not let landscape render/resize callbacks swipe the trick
    // away early. The capture is unlocked only by the 1.1s reveal timer above.
    if (
      window._trickRevealReadyKey === k &&
      window._trickFlightKey !== k &&
      !window._trickCapturing
    ) {
      requestAnimationFrame(() => {
        try {
          animateLandscapeTrickCapture(game.lastTrickWinner);
        } catch (e) {}
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
  setTimeout(() => {
    try {
      updateLandscapeTheater();
    } catch (e) {}
    try {
      window.HORCharacterStudio077?.sync();
    } catch (e) {
      console.warn('Character presentation:', e);
    }
  }, 150);
});
window.addEventListener('resize', () => {
  try {
    updateLandscapeTheater();
  } catch (e) {}
  try {
    window.HORCharacterStudio077?.sync();
  } catch (e) {
    console.warn('Character presentation:', e);
  }
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
    try {
      renderLandscapeLast5();
    } catch (e) {
      console.error(e);
    }
  }
}

function renderLandscapeLast5() {
  const body = $('ltLast5Body');
  if (!body) return;
  const list = (typeof recentTricks !== 'undefined' && recentTricks ? recentTricks : []).slice(
    0,
    3
  );
  const plist = (game && game.players) || players || [];
  const nameOf = (idx) => {
    if (plist[idx] && plist[idx].name) return plist[idx].name;
    if (
      typeof isSoloPractice !== 'undefined' &&
      isSoloPractice &&
      typeof myIndex === 'number' &&
      idx === myIndex
    )
      return myName || 'Host';
    if (typeof myIndex === 'number' && idx === myIndex && myName) return myName;
    return 'Player ' + ((idx | 0) + 1);
  };
  let mySeat = typeof myIndex === 'number' && myIndex >= 0 ? myIndex : -1;
  const partnerSeat = mySeat >= 0 ? (mySeat + 2) % 4 : -1;
  if (!list.length) {
    body.innerHTML = '<div class="lt-last5-empty">No tricks yet this hand</div>';
    return;
  }
  body.innerHTML = list
    .map((tr, i) => {
      const label = i === 0 ? 'Latest' : i === 1 ? 'Prev' : '#' + (i + 1);
      const trump = tr.trump ? COLOR_NAMES[tr.trump] || tr.trump : '—';
      const led = tr.ledColor ? COLOR_NAMES[tr.ledColor] || tr.ledColor : '—';
      const wName = nameOf(tr.winner);
      const wPartner = partnerSeat >= 0 && tr.winner === partnerSeat;
      const wMe = mySeat >= 0 && tr.winner === mySeat;
      const winNote = wPartner ? ' · partner' : wMe ? ' · you' : '';
      const plays = (tr.plays || [])
        .map((t) => {
          const isW = t.player === tr.winner;
          const isPartner = partnerSeat >= 0 && t.player === partnerSeat;
          const isMe = mySeat >= 0 && t.player === mySeat;
          const role = '';
          return `<div class="lt-th-play ${isW ? 'winner' : ''} ${isPartner ? 'partner' : ''} ${isMe ? 'you' : ''}">
        ${typeof renderCardHTML === 'function' ? renderCardHTML(t.card, true) : ''}
        <div class="lt-th-name">${nameOf(t.player)}</div>
        ${role}
      </div>`;
        })
        .join('');
      return `<article class="lt-th-card">
      <div class="lt-th-head">${label} · <span class="lt-th-win">🏆 ${wName}${winNote}</span>
        <div class="lt-th-meta">Trump ${trump} · Led ${led}</div>
      </div>
      <div class="lt-th-plays">${plays}</div>
    </article>`;
    })
    .join('');
}

// ========== ROOK012 portrait Last Trick header popover ==========
function isPortraitViewport() {
  try {
    return !(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  } catch (e) {
    return window.innerHeight >= window.innerWidth;
  }
}
function getPortraitPreviousTrick() {
  const latest =
    typeof recentTricks !== 'undefined' && Array.isArray(recentTricks) ? recentTricks[0] : null;
  if (latest && Array.isArray(latest.plays) && latest.plays.length === 4) return latest;
  if (Array.isArray(lastCompletedTrick) && lastCompletedTrick.length === 4)
    return { plays: lastCompletedTrick, winner: lastCompletedTrickWinner };
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
  const base = typeof myIndex === 'number' && myIndex >= 0 ? myIndex : 0;
  const seatClass = { 2: 'north', 1: 'west', 3: 'east', 0: 'south' };
  function simpleFace(card) {
    if (!card) return '';
    const relColor = card.color === 'rook' || card.id === 'rook' ? 'black' : card.color || 'black';
    const value =
      card.color === 'rook' || card.id === 'rook' ? 'R' : card.rank != null ? card.rank : '';
    return `<div class="portrait-last-simple-face ${relColor}"><span>${value}</span></div>`;
  }
  return tr.plays
    .map((t) => {
      const rel = (((Number(t.player) - base) % 4) + 4) % 4;
      return `<div class="portrait-last-trick-mini-card seat-${seatClass[rel]}">${simpleFace(t.card)}</div>`;
    })
    .join('');
}
function closePortraitLastTrickPopover() {
  const pop = $('portraitLastTrickPopover'),
    btn = $('portraitLastTrickButton');
  if (pop) pop.classList.add('hidden');
  const close = $('portraitLastTrickClose');
  if (close) close.style.setProperty('display', 'none', 'important');
  const status = $('portraitLastTrickStatus031');
  if (status) status.classList.add('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
function refreshPortraitLastTrick029() {
  const pop = $('portraitLastTrickPopover'),
    cards = $('portraitLastTrickCards');
  if (!pop || !cards || pop.classList.contains('hidden') || !isPortraitViewport()) return;
  const tr = getPortraitPreviousTrick();
  if (!tr) return;
  const signature = JSON.stringify(
    tr.plays.map((t) => [t.player, t.card.id, t.card.color, t.card.rank])
  );
  if (cards.dataset.completedTrick029 === signature) return;
  const status = $('portraitLastTrickStatus031');
  if (status) status.classList.add('hidden');
  cards.innerHTML = portraitLastTrickMiniHTML(tr);
  cards.dataset.completedTrick029 = signature;
  positionPortraitLastTrick025();
}
function openPortraitLastTrickPopover() {
  if (!isPortraitViewport()) return;
  const tr = getPortraitPreviousTrick(),
    pop = $('portraitLastTrickPopover'),
    cards = $('portraitLastTrickCards'),
    btn = $('portraitLastTrickButton');
  if (!pop || !cards) return;
  const status = $('portraitLastTrickStatus031');
  if (status) status.classList.toggle('hidden', !!tr);
  cards.innerHTML = tr ? portraitLastTrickMiniHTML(tr) : '';
  cards.dataset.completedTrick029 = tr
    ? JSON.stringify(tr.plays.map((t) => [t.player, t.card.id, t.card.color, t.card.rank]))
    : '';
  pop.classList.remove('hidden');
  positionPortraitLastTrick025();
  if (btn) btn.setAttribute('aria-expanded', 'true');
}
// ROOK025: viewport-owned review, outside every table/player transform.
function positionPortraitLastTrick025() {
  const pop = $('portraitLastTrickPopover'),
    group = $('portraitLastTrickGroup'),
    cards = $('portraitLastTrickCards');
  if (!pop || !group || !cards || !isPortraitViewport()) return;
  if (pop.parentNode !== document.body) document.body.appendChild(pop);
  group.style.setProperty('left', '68px', 'important');
  group.style.setProperty('top', '389px', 'important');
  cards.style.setProperty('translate', '0px 0px', 'important');
  // Center the actual projected four-card bounds, not merely an empty shell.
  const boxes = Array.from(cards.children).map((c) => c.getBoundingClientRect());
  if (boxes.length !== 4) {
    positionPortraitLastTrickClose030();
    return;
  }
  const cx = (Math.min(...boxes.map((r) => r.left)) + Math.max(...boxes.map((r) => r.right))) / 2;
  const cy = (Math.min(...boxes.map((r) => r.top)) + Math.max(...boxes.map((r) => r.bottom))) / 2;
  cards.style.setProperty('translate', `${68 - cx}px ${389 - cy}px`, 'important');
  positionPortraitLastTrickClose030();
}
window.addEventListener('resize', () => {
  const p = $('portraitLastTrickPopover');
  if (p && !p.classList.contains('hidden')) positionPortraitLastTrick025();
});
// Delegate at the document so header updates cannot discard the LAST handler.
(function wirePortraitLastTrickPopover() {
  document.addEventListener(
    'click',
    (e) => {
      const control =
        e.target &&
        e.target.closest &&
        e.target.closest('#portraitLastTrickButton, #portraitLastTrickClose');
      if (!control) return;
      e.preventDefault();
      e.stopPropagation();
      if (control.id === 'portraitLastTrickClose') {
        closePortraitLastTrickPopover();
        return;
      }
      const pop = $('portraitLastTrickPopover');
      if (pop && !pop.classList.contains('hidden')) closePortraitLastTrickPopover();
      else openPortraitLastTrickPopover();
    },
    true
  );
  window.addEventListener('orientationchange', closePortraitLastTrickPopover);
})();

// Keep mobile keyboard stable: don't let landscape overlay steal focus while typing
(function wireInputFocusGuard() {
  const setFocused = (on) => {
    try {
      document.body.classList.toggle('input-focused', !!on);
    } catch (e) {}
  };
  document.addEventListener(
    'focusin',
    (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
        setFocused(true);
      }
    },
    true
  );
  document.addEventListener(
    'focusout',
    () => {
      setTimeout(() => {
        const a = document.activeElement;
        const still =
          a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
        setFocused(!!still);
      }, 50);
    },
    true
  );
})();

/* Build 467 Career badge */

// 842: retired layout editor removed; fixed source geometry remains.
// Rook574 live theme bootstrap (diagnostic UI retired)
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', () => {
    try {
      horSetThemeIndex(horCurrentHandVisualIndex(), false);
    } catch (e) {}
  });
else {
  try {
    horSetThemeIndex(horCurrentHandVisualIndex(), false);
  } catch (e) {}
}

/* Rook596: collapsible top match board. Presentation only. */
(function () {
  function initR596ScoreCollapse() {
    const bar = document.getElementById('topBar'),
      btn = document.getElementById('btnScoreCollapse');
    if (!bar || !btn || btn.__r596Bound) return;
    btn.__r596Bound = true;
    const paint = () => {
      const c = bar.classList.contains('score-collapsed');
      btn.setAttribute('aria-expanded', String(!c));
      btn.title = c ? 'Expand match scoreboard' : 'Collapse match scoreboard';
    };
    btn.addEventListener('click', () => {
      bar.classList.toggle('score-collapsed');
      paint();
    });
    paint();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initR596ScoreCollapse, { once: true });
  else initR596ScoreCollapse();
})();

// 842: retired diagnostic recorder/auto-test control bar removed.
/* R706: permanent header, visible layout-tool owner and shared decision portal.
   This code only owns presentation. R705's pace governor/timers are unchanged. */
(function initR706TablePresentation() {
  function init() {
    const row = document.getElementById('scoreSpeed701');
    if (!row || row.__r706Bound) return;
    row.__r706Bound = true;
    row.querySelectorAll('[data-score-pace]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.preventDefault();
        horSetGamePace(b.dataset.scorePace);
      })
    );
    // The app is visibility:hidden in landscape. These permanent owners must
    // not inherit that state; no orientation handler clones or reparents them.
    const bar = document.getElementById('topBar');
    const portal = document.getElementById('bidOverlayHost');
    const clearance = document.createElement('div');
    clearance.id = 'headerClearance706';
    clearance.setAttribute('aria-hidden', 'true');
    bar.before(clearance);
    document.body.append(bar, portal);
    const clearHeader = () => {
      const size = bar.classList.contains('score-collapsed')
        ? 42
        : Math.ceil(bar.getBoundingClientRect().bottom + 8);
      clearance.style.height = size + 'px';
      clearance.style.minHeight = size + 'px';
      clearance.style.flexBasis = size + 'px';
    };
    new MutationObserver(clearHeader).observe(bar, {
      attributes: true,
      attributeFilter: ['class'],
    });
    new ResizeObserver(clearHeader).observe(bar);
    clearHeader();
    horSetGamePace(horGamePace);
    const dock = document.getElementById('decisionConsole');
    const sync = () => {
      const bidding =
        dock.classList.contains('decision-mode-bid') && !dock.classList.contains('hidden');
      document.body.classList.toggle('r706-bid-open', bidding);
      if (bidding) {
        const seat = document.getElementById('slot-me');
        const box = dock.getBoundingClientRect();
        // Portrait bidding never owns the locked human seat position.
        // Preserve the inherited landscape measurement path.
        if (!matchMedia('(orientation:portrait)').matches) {
          // Containment and translated avatar/name descendants extend beyond
          // the slot's box. Measure their visual bottom in the containing block.
          document.body.style.setProperty('--r706-human-top', '0px');
          const parts = seat
            ? [seat, ...seat.querySelectorAll('.seat-avatar,.name,.bid-badge')]
            : [];
          const bottom = Math.max(
            0,
            ...parts
              .filter((e) => getComputedStyle(e).display !== 'none')
              .map((e) => e.getBoundingClientRect().bottom)
          );
          document.body.style.setProperty('--r706-human-top', box.top - bottom - 8 + 'px');
        }
        try {
          positionSeatBidBadges();
          positionSeatLeadTags();
          positionBotThinkingAtSeat();
        } catch (e) {}
        document.body.style.setProperty('--r706-nest-rise', '0px');
        document.body.style.setProperty('--r706-nest-scale', '1');
        if (matchMedia('(orientation:portrait)').matches) {
          const face = document.querySelector(
            '#nestArea .nest-stay-face,#nestArea .table-nest-flip'
          );
          const avatar = seat?.querySelector('.seat-avatar');
          const partner = document.querySelector('#slot-partner .seat-avatar');
          if (face && avatar && partner) {
            const tag = seat.querySelector('.seat-lead-tag:not(.hidden)');
            const ceiling = partner.getBoundingClientRect().bottom + 8;
            const thinking = seat.querySelector('#botThinking:not(.hidden)');
            const floor =
              Math.min(
                avatar.getBoundingClientRect().top,
                tag?.getBoundingClientRect().top || Infinity,
                thinking?.getBoundingClientRect().top || Infinity
              ) - 8;
            const n = face.getBoundingClientRect();
            if (n.bottom > floor) {
              const fit = Math.min(1, Math.max(0.4, (floor - ceiling) / Math.max(1, n.height)));
              document.body.style.setProperty('--r706-nest-scale', String(fit));
              document.body.style.setProperty(
                '--r706-nest-rise',
                floor - face.getBoundingClientRect().bottom + 'px'
              );
            }
          }
        }
        try {
          positionSeatBidBadges();
          positionSeatLeadTags();
          scheduleNestAlignment033();
        } catch (e) {}
      }
    };
    new MutationObserver(sync).observe(dock, {
      attributes: true,
      childList: true,
      attributeFilter: ['class'],
    });
    new ResizeObserver(sync).observe(dock);
    new ResizeObserver(sync).observe(clearance);
    addEventListener('resize', sync);
    sync();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

// Keep the approved composition attached to the background's cover scale.
function positionPlayedPlane027() {
  if (!matchMedia('(orientation: portrait)').matches || window._trickCapturing) return;
  const scale = Math.max(innerWidth / 875, innerHeight / 1797) / (915 / 1797);
  document.querySelectorAll('#trickArea .table003-played').forEach((w) => {
    w.style.setProperty('--rook027-scale', scale);
    w.style.setProperty('width', 88 * scale + 'px', 'important');
    w.style.setProperty('height', 126 * scale + 'px', 'important');
    const x = innerWidth / 2 + (Number(w.dataset.planeX) - 206) * scale - 44 * scale;
    const y = Number(w.dataset.planeY) * scale - 63 * scale;
    const r = w.getBoundingClientRect();
    w.style.setProperty('left', parseFloat(w.style.left) + x - r.left + 'px', 'important');
    w.style.setProperty('top', parseFloat(w.style.top) + y - r.top + 'px', 'important');
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
  if (Math.abs(delta) < 0.25) return;
  const parent = slot.parentElement;
  const parentScale =
    parent && parent.offsetWidth ? parent.getBoundingClientRect().width / parent.offsetWidth : 1;
  if (!slot.__rook029PriorTranslate)
    slot.__rook029PriorTranslate = {
      value: slot.style.getPropertyValue('translate'),
      priority: slot.style.getPropertyPriority('translate'),
    };
  const translation = getComputedStyle(slot).translate;
  const parts = translation === 'none' ? ['0px', '0px'] : translation.split(/\s+/);
  const x = parseFloat(parts[0]) || 0;
  const y = parts[1] || '0px';
  // Direct inline ownership defeats an older mapper's inline !important rule.
  slot.style.setProperty(
    'translate',
    `${x + delta / Math.max(0.01, parentScale)}px ${y}`,
    'important'
  );
  try {
    positionSeatLeadTags();
    positionSeatBidBadges();
    positionBotThinkingAtSeat();
  } catch (e) {}
}
window.addEventListener('resize', scheduleBottomAvatar029);
window.addEventListener('orientationchange', scheduleBottomAvatar029);

// An independent viewport control avoids inherited zero-size/popover clipping.
function positionPortraitLastTrickClose030() {
  const close = $('portraitLastTrickClose'),
    pop = $('portraitLastTrickPopover'),
    cards = $('portraitLastTrickCards');
  if (!close || !pop || !cards) return;
  if (pop.classList.contains('hidden') || !isPortraitViewport()) {
    close.style.setProperty('display', 'none', 'important');
    return;
  }
  if (close.parentNode !== document.body) document.body.appendChild(close);
  const boxes = Array.from(cards.children).map((c) => c.getBoundingClientRect());
  const left = boxes.length === 4 ? Math.min(...boxes.map((r) => r.left)) : 28;
  const centerY =
    boxes.length === 4
      ? (Math.min(...boxes.map((r) => r.top)) + Math.max(...boxes.map((r) => r.bottom))) / 2
      : 389;
  close.style.cssText = `position:fixed!important;left:${Math.min(innerWidth - 32, Math.max(0, left - 32))}px!important;top:${Math.max(0, centerY - 14)}px!important;right:auto!important;bottom:auto!important;width:28px!important;height:28px!important;min-width:28px!important;min-height:28px!important;display:flex!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;z-index:2147483647!important;padding:0!important;margin:0!important;transform:none!important;translate:none!important;scale:1!important;align-items:center!important;justify-content:center!important;color:#f3e4b5!important;background:#121b14!important;border:1px solid #b89249!important;border-radius:50%!important;font:700 20px/1 system-ui,sans-serif!important;`;
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
  const r = bg ? bg.getBoundingClientRect() : { top: 0, width: innerWidth, height: innerHeight };
  return r.top + imageY * Math.max(r.width / 875, r.height / 1797);
}
function positionNestAlignment033() {
  const area = $('nestArea');
  const pile = area && area.querySelector('.table-nest-pile');
  if (!pile) return;
  if (!isPortraitViewport()) {
    pile.style.removeProperty('translate');
    return;
  }
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
  const parts = current === 'none' ? ['0px', '0px'] : current.split(/\s+/);
  const y = parseFloat(parts[1]) || 0;
  const delta = targetBottom - rect.bottom;
  if (Math.abs(delta) > 0.25)
    pile.style.setProperty(
      'translate',
      `${parts[0] || '0px'} ${y + delta / Math.max(0.01, parentScale)}px`,
      'important'
    );
  window.__nestPlacement039 = {
    key: nestPlacementKey039(),
    translate: getComputedStyle(pile).translate,
  };
}
function positionShuffleWash033() {
  const ov = $('shuffleOverlay');
  if (!ov || !isPortraitViewport()) return;
  const scale = Math.max(innerWidth / 875, innerHeight / 1797) / (915 / 1797);
  ov.style.setProperty('--rook033-wash-scale', String(scale));
  ov.style.setProperty('--rook033-wash-x', innerWidth / 2 + 'px');
  ov.style.setProperty('--rook033-wash-y', tableSceneAnchor033(840) + 'px');
}
window.addEventListener('resize', () => {
  scheduleNestAlignment033();
  positionShuffleWash033();
});
window.addEventListener('orientationchange', scheduleNestAlignment033);

function activeBidSurface034() {
  const dock = $('decisionConsole');
  if (
    !isPortraitViewport() ||
    !dock ||
    dock.classList.contains('hidden') ||
    !dock.classList.contains('decision-mode-bid')
  )
    return null;
  return dock.querySelector('.approved-bid-surface') || dock;
}
function positionBidTurn034(el) {
  const surface = activeBidSurface034();
  if (!surface || !el || el.dataset.humanTurn !== '1' || el.classList.contains('hidden'))
    return false;
  const box = surface.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  if (el.parentNode !== document.body) document.body.appendChild(el);
  el.style.cssText = `position:fixed!important;left:${box.left + box.width / 2}px!important;top:${box.top - 9}px!important;right:auto!important;bottom:auto!important;transform:translate(-50%,-100%)!important;translate:none!important;scale:1!important;margin:0!important;z-index:2147483601!important;pointer-events:none!important;`;
  return true;
}
function syncPresentation034() {
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
    patch = document.createElement('div');
    patch.id = 'quietFire034';
    patch.setAttribute('aria-hidden', 'true');
    patch.innerHTML = '<div class="quiet-fire-sample034"></div>';
    bg.appendChild(patch);
  }
  let glow = $('fireGlow059');
  if (!glow) {
    glow = document.createElement('div');
    glow.id = 'fireGlow059';
    glow.setAttribute('aria-hidden', 'true');
    glow.innerHTML = '<div class="fire-glow-pulse059"></div>';
    bg.appendChild(glow);
  }
  const r = bg.getBoundingClientRect();
  const scale = Math.max(r.width / 875, r.height / 1797);
  patch.style.setProperty('left', r.left + (r.width - 875 * scale) / 2 + 610 * scale + 'px');
  patch.style.setProperty('top', r.top + 390 * scale + 'px');
  patch.style.setProperty('transform', `scale(${scale})`);
  glow.style.setProperty('left', r.left + (r.width - 875 * scale) / 2 + 610 * scale + 'px');
  glow.style.setProperty('top', r.top + 390 * scale + 'px');
  glow.style.setProperty('transform', `scale(${scale})`);
}
(function initPresentation034() {
  function init() {
    const dock = $('decisionConsole');
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        syncPresentation034();
      });
    };
    if (dock) {
      new MutationObserver(schedule).observe(dock, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class'],
      });
      new ResizeObserver(schedule).observe(dock);
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    schedule();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

// ROOK035: approved recordings with pitch-preserving edits for each pace.
const recordedPCM035 = window.HORAudioSamples.presentation;
let recordedContext035 = null;
const recordedBuffers035 = new Map();
const presentationSounds035 = new Set();
function stopPresentationSounds035() {
  if (window.HORShuffle732) window.HORShuffle732.stop();
  for (const s of presentationSounds035) {
    try {
      s.stop();
    } catch (_) {}
  }
  presentationSounds035.clear();
}
function playRecordedCard035(kind, delayMs = 0) {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  if (recordedContext035 !== ctx) {
    recordedBuffers035.clear();
    recordedContext035 = ctx;
  }
  const step = solScaledDelay(CARD_DEAL_MS, 18);
  const pace = step <= 18 ? 'max' : step < 80 ? '3x' : '1x';
  const key = (kind === 'reveal' ? 'deal' : kind) + '-' + pace;
  if (!recordedBuffers035.has(key)) {
    const bytes = atob(recordedPCM035[key]);
    const b = ctx.createBuffer(1, bytes.length / 2, 22050),
      data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      let n = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8);
      if (n >= 32768) n -= 65536;
      data[i] = n / 32768;
    }
    recordedBuffers035.set(key, b);
  }
  const src = ctx.createBufferSource(),
    gain = ctx.createGain();
  src.buffer = recordedBuffers035.get(key);
  if (kind === 'wash')
    src.playbackRate.value =
      src.buffer.duration / (solScaledDelay(shuffleAnimDuration762(), 80) / 1000);
  gain.gain.value = kind === 'reveal' ? 0.5 : 1;
  let filter = null;
  if (kind === 'reveal') {
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
  } else src.connect(gain);
  gain.connect(window.HORAudioMixer.output(ctx, 'gameplay'));
  presentationSounds035.add(src);
  src.onended = () => {
    presentationSounds035.delete(src);
    src.disconnect();
    if (filter) filter.disconnect();
    gain.disconnect();
  };
  src.start(ctx.currentTime + Math.max(0, delayMs) / 1000);
}
function playShuffleSound() {
  if (window.HORShuffle732) return window.HORShuffle732.sound();
  if (soundMuted || !soundCard) return;
  const step = solScaledDelay(CARD_DEAL_MS, 18);
  const pace = step <= 18 ? 'max' : step < 80 ? '3x' : '1x';
  preloadCardWashSound059(pace).then((buffer) => {
    if (!buffer || soundMuted || !soundCard) return;
    whenAudioReady((ctx) => {
      if (soundMuted || !soundCard) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0.58, ctx.currentTime);
      source.connect(gain);
      gain.connect(window.HORAudioMixer.output(ctx, 'gameplay'));
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch (_) {}
      };
      source.start(ctx.currentTime + 0.01);
    });
  });
}
function playDealCardSound(delayMs = 0) {
  preloadCardLandingSounds058();
  if (soundMuted || !soundCard) return;
  setTimeout(
    () => {
      if (
        soundMuted ||
        !soundCard ||
        cardLandingBuffers058.length !== CARD_LANDING_SAMPLE_URLS058.length
      )
        return;
      const options = cardLandingBuffers058
        .map((_, i) => i)
        .filter((i) => i !== lastCardLandingIndex058);
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
      gain.connect(window.HORAudioMixer.output(ctx, 'gameplay'));
      source.start(ctx.currentTime + 0.004);
      source.onended = () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch (_) {}
      };
    },
    Math.max(0, Number(delayMs) || 0)
  );
}
function positionRailControls035(controls) {
  // Tablet room scaling creates a containing block for fixed descendants.
  // Keep the existing buttons/handlers in viewport space on larger viewports.
  if (!controls._railHome035) controls._railHome035 = controls.parentNode;
  const viewportNavigation = innerWidth >= 521;
  const home = viewportNavigation ? document.body : controls._railHome035;
  if (controls.parentNode !== home) home.appendChild(controls);
  if (viewportNavigation) {
    controls.style.setProperty('left', 'auto', 'important');
    controls.style.setProperty('right', 'max(12px, env(safe-area-inset-right))', 'important');
    controls.style.setProperty('top', 'auto', 'important');
    controls.style.setProperty(
      'bottom',
      'max(104px, 18dvh, env(safe-area-inset-bottom))',
      'important'
    );
    controls.style.setProperty('transform', 'none', 'important');
    controls.style.setProperty('translate', 'none', 'important');
    return;
  }
  if (!isPortraitViewport()) {
    ['left', 'top', 'right', 'bottom', 'transform', 'translate'].forEach((k) =>
      controls.style.removeProperty(k)
    );
    return;
  }
  const bg = $('hor-room-bg');
  const r = bg
    ? bg.getBoundingClientRect()
    : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const scale = Math.max(r.width / 875, r.height / 1797);
  const x = r.left + (r.width - 875 * scale) / 2 + 812 * scale;
  const centerY = r.top + 1130 * scale;
  controls.style.setProperty(
    'left',
    Math.max(27, Math.min(innerWidth - 32, x - 13)) - 22 + 'px',
    'important'
  );
  // 069: Keep fittings anchored to table projection through bidding.
  controls.style.setProperty('top', Math.max(80, centerY - 44) + 'px', 'important');
  controls.style.setProperty('right', 'auto', 'important');
  controls.style.setProperty('bottom', 'auto', 'important');
  controls.style.setProperty('transform', 'none', 'important');
  controls.style.setProperty('translate', 'none', 'important');
}
function dealFlight035(player, duration) {
  const landscapeDeal = !!window.HORAngleC?.active();
  if (
    (!isPortraitViewport() && !landscapeDeal) ||
    document.body.classList.contains('reduce-motion')
  )
    return;
  const bg = $('hor-room-bg'),
    r = bg
      ? bg.getBoundingClientRect()
      : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const cover = Math.max(r.width / 875, r.height / 1797),
    offsetX = r.left + (r.width - 875 * cover) / 2;
  const project = (x, y) => ({ x: offsetX + x * cover, y: r.top + y * cover });

  // Deal from a lifted packet above the rear felt, then descend onto the
  // table plane. Portrait centers are not physical card landing positions.
  const dealerSlot = seatSlotIdForIndex(Number.isInteger(game.dealer) ? game.dealer : 0);
  // A packet on the dealer's side of the felt, clear of portraits and rail.
  const packets747 = {
    'slot-me': [610, 1000],
    'slot-partner': [437.5, 720],
    'slot-left': [235, 880],
    'slot-right': [640, 880],
  };
  const start = landscapeDeal ? HORAngleC.dealPacket() : project(...packets747[dealerSlot]);
  const sid = seatSlotIdForIndex(player === 'nest' ? myIndex : player);
  const feltTargets = {
    'slot-partner': [437.5, 690],
    'slot-left': [195, 850],
    'slot-right': [680, 850],
    'slot-me': [437.5, 1090],
  };
  let end = project(...(feltTargets[sid] || feltTargets['slot-me']));
  if (sid === 'slot-me' && player !== 'nest') {
    const holder = document.querySelector('.hand-area');
    const hr = holder && holder.getBoundingClientRect();
    if (hr && hr.width && hr.height)
      end = { x: hr.left + hr.width / 2, y: hr.top + Math.min(hr.height * 0.45, 30) };
  }
  if (player === 'nest') {
    const landing = nestLanding037(Number(window.__dealNest036 && window.__dealNest036.count) || 0);
    const pile = $('nestArea') && $('nestArea').querySelector('.table-nest-pile');
    const pr = pile && pile.getBoundingClientRect();
    end =
      pr && pr.width
        ? {
            x: pr.left + pr.width / 2 + landing.x * cover,
            y: pr.top + pr.height / 2 + landing.y * cover,
          }
        : project(437.5 + landing.x, 800 + landing.y);
  }
  // Visible flight reaches the player; middle cards land on the real Nest pile.
  if (landscapeDeal) end = HORAngleC.dealTarget(player);
  const scale = landscapeDeal ? HORAngleC.frame().scale : cover / (915 / 1797);
  const carrier = document.createElement('div');
  carrier.className = 'deal-moving036';
  carrier.setAttribute('aria-hidden', 'true');
  carrier.dataset.dealer = String(game.dealer);
  carrier.dataset.dealerSlot = dealerSlot;
  carrier.dataset.player = String(player);
  carrier.dataset.startX = String(start.x);
  carrier.dataset.startY = String(start.y);
  carrier.dataset.endX = String(end.x);
  carrier.dataset.endY = String(end.y);
  carrier.style.cssText = `position:fixed!important;left:${start.x - 25 * scale}px!important;top:${start.y - 27 * scale}px!important;width:${50 * scale}px!important;height:${54 * scale}px!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:none!important;z-index:2147483500!important;`;
  const card = document.createElement('div');
  card.className = 'deal-flight035';
  card.style.cssText =
    'position:absolute!important;left:0!important;top:0!important;display:block!important;visibility:visible!important;opacity:1!important;';
  const nestFlightCount = Number(window.__dealNest036 && window.__dealNest036.count) || 0;
  const nestTotal = Array.isArray(game.nest) ? game.nest.length : Number(game.nestCount) || 6;
  if (player === 'nest' && revealTopNest && nestFlightCount === nestTotal - 1) {
    const face = pinnedNestRevealFace() || freezeTopNestCard();
    if (face) {
      card.classList.add('face-up-flight040');
      card.innerHTML = renderCardHTML(face, true);
    }
  }
  if (landscapeDeal) {
    carrier.classList.add('landscape-deal830');
    carrier.style.setProperty('left', start.x - 55 * scale + 'px', 'important');
    carrier.style.setProperty('top', start.y - 51.7 * scale + 'px', 'important');
    card.style.setProperty('--deal-landscale830', scale);
  }
  card.style.setProperty('--deal-scale035', scale);
  carrier.appendChild(card);
  document.body.appendChild(carrier);
  const flights = window.__dealFlights036 || (window.__dealFlights036 = new Set());
  let frame = 0,
    deadline = 0,
    origin = performance.now(),
    stopped = false;
  const flight = {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
      carrier.remove();
      flights.delete(flight);
    },
  };
  flights.add(flight);
  const move = (time) => {
    if (stopped) return;
    if (
      (!isPortraitViewport() && !window.HORAngleC?.active()) ||
      !document.body.classList.contains('in-game') ||
      document.hidden
    ) {
      flight.stop();
      return;
    }
    const t = Math.min(1, (time - origin) / Math.max(1, duration)),
      ease = 1 - Math.pow(1 - t, 2);
    // No sinusoidal upward hop: height steadily settles toward the felt.
    const height = 18 * (landscapeDeal ? scale : cover) * (1 - ease);
    // Bottom receiving path skirts the portrait before entering the holder.
    const bend = project(850, 1260),
      u = 1 - ease;
    const point =
      !landscapeDeal && sid === 'slot-me' && player !== 'nest'
        ? {
            x: u * u * start.x + 2 * u * ease * bend.x + ease * ease * end.x,
            y: u * u * start.y + 2 * u * ease * bend.y + ease * ease * end.y,
          }
        : { x: start.x + (end.x - start.x) * ease, y: start.y + (end.y - start.y) * ease };
    carrier.style.setProperty(
      'transform',
      `translate3d(${point.x - start.x}px,${point.y - start.y - height}px,0)`,
      'important'
    );
    card.style.opacity = String(1 - 0.16 * ease);
    carrier.dataset.dealProgress = String(t);
    if (t < 1) frame = requestAnimationFrame(move);
    else setTimeout(() => flight.stop(), duration > 80 ? 12 : 0);
  };
  carrier.style.setProperty(
    'transform',
    `translate3d(0,${-18 * (landscapeDeal ? scale : cover)}px,0)`,
    'important'
  );
  frame = requestAnimationFrame(move);
  deadline = setTimeout(() => flight.stop(), duration + 120);
}
function stopDealFlights036() {
  for (const flight of window.__dealFlights036 || []) flight.stop();
}
function dealSoundDelay036(flightMs) {
  const paceStep = solScaledDelay(CARD_DEAL_MS, 18);
  const impact = paceStep <= 18 ? 5 : paceStep < 80 ? 27 : 80;
  return Math.max(0, flightMs - impact);
}
function buildDealOrder036(handLength, nestCount, dealer) {
  const first = ((Number.isInteger(dealer) ? dealer : 0) + 1) % 4,
    order = [];
  for (let round = 0; round < Math.max(handLength, nestCount); round++) {
    if (round < handLength) for (let seat = 0; seat < 4; seat++) order.push((first + seat) % 4);
    if (round < nestCount) order.push('nest');
  }
  return order;
}
function flipDealtNest036(token, onDone) {
  if (token !== dealAnimToken || !game) return;
  if (!revealTopNest) {
    onDone();
    return;
  }
  const face = pinnedNestRevealFace() || freezeTopNestCard();
  if (!face) {
    onDone();
    return;
  }
  pinNestRevealFace(face);
  window._horNestFlipHand =
    String(game.handNumber || 0) + ':' + String(game.dealer) + ':' + String(face.id || '');
  window._horNestFlipTok = (window._horNestFlipTok || 0) + 1;
  // Already face up in the flight: land directly, without a second flip/lift.
  game.nestFlipStage = 2;
  game.nestFlipped = true;
  window._horNestPileSig = '';
  // The flight already has its regular deal sound; no delayed second card cue.
  try {
    renderTopNestPeek();
    playBirdNestReaction041();
  } catch (_) {}
  if (window.HORNestReveal838) {
    HORNestReveal838.reveal(face).finally(() => {
      if (token === dealAnimToken) onDone();
    });
  } else onDone();
}
function runDealPresentation(fullHand, onDone) {
  window.HORHandOrder838?.newDeal();
  // Both orientations use the approved all-seat deal presentation.
  const hand = (fullHand || []).map((c) => ({ ...c })),
    token = ++dealAnimToken;
  stopPresentationSounds035();
  stopDealFlights036();
  document.body.classList.remove('dealing035');
  try {
    showGame();
  } catch (_) {}
  if (!game) game = {};
  game.myHand = [];
  const nestTotal = Array.isArray(game.nest) ? game.nest.length : Number(game.nestCount) || 6;
  window.__nestPlacement039 = null;
  window.__birdNestReaction041 = null;
  window.__dealNest036 = { token, count: 0 };
  const order = buildDealOrder036(hand.length, nestTotal, game.dealer);
  for (const id of ['myHand', 'ltHand', 'ltPlays']) {
    const el = $(id);
    if (el) el.innerHTML = '';
  }
  try {
    renderUI();
  } catch (_) {}
  preloadCardLandingSounds058();
  showShuffleOverlay();
  try {
    playShuffleSound();
    renderTopNestPeek();
  } catch (_) {}
  setTimeout(
    () => {
      if (token !== dealAnimToken) return;
      hideShuffleOverlay();
      document.body.classList.add('dealing035');
      let index = 0,
        mine = 0;
      const step = () => {
        if (token !== dealAnimToken) {
          stopDealFlights036();
          document.body.classList.remove('dealing035');
          return;
        }
        if (index >= order.length) {
          window.__dealNest036 = null;
          stopDealFlights036();
          document.body.classList.remove('dealing035');
          game.myHand = hand.slice();
          try {
            sortMyHandInPlace();
            renderHand(false);
            renderTopNestPeek();
          } catch (_) {}
          if (typeof onDone === 'function') onDone();
          return;
        }
        const player = order[index++],
          interval = solScaledDelay(122, 25),
          flight = Math.max(18, interval - 25);
        try {
          dealFlight035(player, flight);
        } catch (_) {}
        // Keep every card, including the face-up sixth Nest card, on one audio cadence.
        try {
          playDealCardSound(dealSoundDelay036(flight));
        } catch (_) {}
        setTimeout(() => {
          if (token !== dealAnimToken) {
            stopDealFlights036();
            document.body.classList.remove('dealing035');
            return;
          }
          if (player === 'nest') {
            window.__dealNest036.count++;
            window._horNestPileSig = '';
            try {
              renderTopNestPeek();
            } catch (_) {}
            if (window.__dealNest036.count === nestTotal) {
              flipDealtNest036(token, step);
              return;
            }
          } else if (player === myIndex) {
            mine++;
            game.myHand = hand.slice(0, mine);
            try {
              renderHand(false, { skipSort: true });
            } catch (_) {}
          }
          step();
        }, interval);
      };
      step();
    },
    solScaledDelay(shuffleAnimDuration762(), 80)
  );
}

// ROOK037: stable, compact natural landings; a render never reshuffles the pile.
function nestLanding037(index) {
  const seed = (Number(game && game.handNumber) || 0) * 19 + (Number(game && game.dealer) || 0) * 7;
  const noise = (salt) => {
    const v = Math.sin((seed + index * 13 + salt) * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  return { x: (noise(3) - 0.5) * 12, y: (noise(9) - 0.5) * 9, angle: (noise(17) - 0.5) * 12 };
}
function applyNestScatter037() {
  if (!isPortraitViewport() && !window.HORAngleC?.active()) return;
  const area = $('nestArea'),
    pile = area && area.querySelector('.table-nest-pile');
  if (!pile) return;
  const cards = pile.querySelectorAll(
    ':scope > .table-nest-under, :scope > .table-nest-top, :scope > .table-nest-flip, :scope > .nest-stay-face'
  );
  cards.forEach((card, i) => {
    const top =
      card.classList.contains('nest-stay-face') ||
      card.classList.contains('table-nest-flip') ||
      card.classList.contains('table-nest-top');
    const p = nestLanding037(top ? Math.max(0, nestCountOnTable() - 1) : i);
    card.style.setProperty('left', p.x + 'px', 'important');
    card.style.setProperty('top', p.y + 'px', 'important');
    card.style.setProperty('translate', '0px 0px', 'important');
    card.style.setProperty('rotate', p.angle + 'deg', 'important');
    if (card.classList.contains('table-nest-under'))
      card.style.setProperty('transform', 'none', 'important');
    card.style.setProperty('z-index', i + 1, 'important');
  });
}

// Keep the physical pile origin through flip/auction renders; resize can re-anchor.
function nestPlacementKey039() {
  const bg = $('hor-room-bg'),
    r = bg && bg.getBoundingClientRect();
  return [
    game && game.handNumber,
    game && game.dealer,
    innerWidth,
    innerHeight,
    r && r.top,
    r && r.width,
    r && r.height,
  ].join(':');
}
function restoreNestPlacement039() {
  if (!isPortraitViewport()) return false;
  const saved = window.__nestPlacement039;
  if (!saved || saved.key !== nestPlacementKey039()) return false;
  const area = $('nestArea'),
    pile = area && area.querySelector('.table-nest-pile');
  if (!pile) return false;
  pile.style.setProperty(
    'translate',
    saved.translate === 'none' ? '0px 0px' : saved.translate,
    'important'
  );
  return true;
}

// ROOK040: accepted discards toss face down to center, then clear with a fade.
const originalRenderUI040 = renderUI;
renderUI = function (...args) {
  const result = originalRenderUI040.apply(this, args);
  try {
    syncDiscardReturn040();
  } catch (e) {}
  return result;
};
function discardReturnKey040() {
  return [game && game.handNumber, game && game.dealer, game && game.bidder].join(':');
}
function stopDiscardReturn040() {
  const state = window.__discardReturn040;
  if (state) {
    state.stopped = true;
    cancelAnimationFrame(state.frame);
    state.group.remove();
  }
  window.__discardReturn040 = null;
}
function syncDiscardReturn040() {
  if (!game || !isPortraitViewport() || !['trump', 'play'].includes(game.phase)) {
    stopDiscardReturn040();
    return;
  }
  const count = Number(game.nestDiscardCount) || 0;
  if (count < 1) return;
  const key = discardReturnKey040();
  if (window.__discardReturn040 && window.__discardReturn040.key === key) return;
  stopDiscardReturn040();
  if (window.__discardReturnSeen040 === key) return;
  window.__discardReturnSeen040 = key;
  const bg = $('hor-room-bg'),
    br = bg
      ? bg.getBoundingClientRect()
      : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const cover = Math.max(br.width / 875, br.height / 1797),
    scale = cover / (915 / 1797);
  const target = {
    x: br.left + (br.width - 875 * cover) / 2 + 437.5 * cover,
    y: br.top + 875 * cover,
  };
  const group = document.createElement('div');
  group.className = 'discard-return-group040';
  group.setAttribute('aria-hidden', 'true');
  group.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483500;';
  document.body.appendChild(group);
  const state = { key, group, frame: 0, stopped: false };
  window.__discardReturn040 = state;
  const seat = $(seatSlotIdForIndex(game.bidder)),
    avatar = seat && seat.querySelector('.seat-avatar,.seat-avatar-side');
  const r = avatar && avatar.getBoundingClientRect();
  const start =
    r && r.width
      ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      : { x: innerWidth / 2, y: innerHeight * 0.85 };
  const reduced = document.body.classList.contains('reduce-motion');
  const duration = reduced ? 0 : solScaledDelay(330, 70),
    stagger = reduced ? 0 : solScaledDelay(45, 12);
  const hold = solScaledDelay(100, 25),
    fade = solScaledDelay(240, 60),
    started = performance.now();
  const fadeAt = duration + (count - 1) * stagger + hold,
    finishAt = fadeAt + fade;
  const cards = Array.from({ length: count }, (_, i) => {
    const node = document.createElement('div');
    node.style.cssText = 'position:fixed;pointer-events:none;display:none;';
    const back = document.createElement('div');
    back.className = 'discard-return-card040';
    back.style.cssText = `width:${50 * scale}px;height:${72 * scale}px;transform:matrix3d(1,0,0,0,0,0.7,0,-0.00115,0,0,1,0,0,0,0,1) rotate(${((i % 3) - 1) * 5}deg);`;
    node.appendChild(back);
    group.appendChild(node);
    return {
      node,
      delay: i * stagger,
      x: ((i % 3) - 1) * 4 * scale,
      y: (i % 2 ? 1 : -1) * 3 * scale,
    };
  });
  const tick = (time) => {
    if (state.stopped) return;
    if (
      !game ||
      discardReturnKey040() !== key ||
      !['trump', 'play'].includes(game.phase) ||
      !isPortraitViewport()
    ) {
      stopDiscardReturn040();
      return;
    }
    const elapsed = time - started;
    for (const c of cards) {
      if (elapsed < c.delay) continue;
      const t = duration ? Math.min(1, (elapsed - c.delay) / duration) : 1,
        ease = 1 - Math.pow(1 - t, 2);
      c.node.style.display = 'block';
      c.node.style.left = start.x + (target.x + c.x - start.x) * ease - 25 * scale + 'px';
      c.node.style.top = start.y + (target.y + c.y - start.y) * ease - 26 * scale + 'px';
    }
    group.style.opacity = String(elapsed < fadeAt ? 1 : Math.max(0, 1 - (elapsed - fadeAt) / fade));
    if (elapsed >= finishAt) {
      stopDiscardReturn040();
      return;
    }
    state.frame = requestAnimationFrame(tick);
  };
  state.frame = requestAnimationFrame(tick);
}

// ROOK041 candidate: subdued bird reaction, steady hand, real seat-to-table travel.
const birdCrowdPCM041 = window.HORAudioSamples.awardCrowd;
let birdCrowdBuffer041 = null,
  birdCrowdContext041 = null;
function playBirdNestReaction041() {
  if (!revealTopNest || !game || soundMuted || !soundCard) return;
  const card = pinnedNestRevealFace() || freezeTopNestCard();
  if (!card || !(isRookCard(card) || (includeRed2 && isRed2(card)))) return;
  const key = String(game.handNumber) + ':' + String(game.dealer) + ':' + String(card.id);
  if (window.__birdNestReaction041 === key) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  window.__birdNestReaction041 = key;
  if (birdCrowdContext041 !== ctx) {
    birdCrowdContext041 = ctx;
    const bytes = atob(birdCrowdPCM041);
    birdCrowdBuffer041 = ctx.createBuffer(1, bytes.length / 2, 22050);
    const out = birdCrowdBuffer041.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
      let v = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8);
      if (v >= 32768) v -= 65536;
      out[i] = v / 32768;
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = birdCrowdBuffer041;
  source.connect(window.HORAudioMixer.output(ctx, 'gameplay'));
  presentationSounds035.add(source);
  source.onended = () => {
    presentationSounds035.delete(source);
    source.disconnect();
  };
  source.start(ctx.currentTime + 0.04);
}
let awardCrowdLastPlayed041 = 0;
window.horPlayAwardCrowd041 = playAwardApplause063;

function reconcileHand041(hand, markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  const old = new Map(Array.from(hand.children).map((el) => [String(el.dataset.id), el]));
  const keep = new Set();
  Array.from(template.content.children).forEach((fresh, index) => {
    const id = String(fresh.dataset.id),
      el = old.get(id) || fresh;
    keep.add(el);
    if (el !== fresh) {
      if (el.className !== fresh.className) el.className = fresh.className;
      if (el.innerHTML !== fresh.innerHTML) el.innerHTML = fresh.innerHTML;
    }
    const at = hand.children[index];
    if (at !== el) hand.insertBefore(el, at || null);
  });
  Array.from(hand.children).forEach((el) => {
    if (!keep.has(el)) el.remove();
  });
}
function rememberOwnPlayOrigin041(id) {
  const hand = $('myHand');
  const el =
    hand &&
    Array.from(hand.querySelectorAll('.card-face')).find(
      (el) => String(el.dataset.id) === String(id)
    );
  const r = el && el.getBoundingClientRect();
  if (r && r.width)
    window.__ownPlayOrigin041 = {
      id: String(id),
      hand: game.handNumber,
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
    };
}
function animatePlayedTravel041(area, trick) {
  if (!isPortraitViewport() || !trick.length) return;
  const signatures = trick.map((t) => String(game.handNumber) + ':' + t.player + ':' + t.card.id);
  const seen = window.__playedTravelSeen041 || [];
  window.__playedTravelSeen041 = signatures;
  // Animate the new live play only; snapshots and routine re-renders never replay older cards.
  const index = trick.length - 1;
  if (seen.includes(signatures[index])) return;
  if (
    document.body.classList.contains('reduce-motion') ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  const t = trick[index],
    wrap = area.querySelectorAll('.trick-card-wrap')[index];
  if (!wrap || !wrap.animate) return;
  const face = wrap.querySelector('.card-face'),
    end = (face || wrap).getBoundingClientRect();
  const slot = $(seatSlotIdForIndex(t.player));
  const avatar = slot && slot.querySelector('.seat-avatar,.seat-avatar-side');
  let from = avatar && avatar.getBoundingClientRect();
  const own = window.__ownPlayOrigin041;
  let x, y;
  if (t.player === myIndex && own && own.hand === game.handNumber && own.id === String(t.card.id)) {
    x = own.x;
    y = own.y;
    window.__ownPlayOrigin041 = null;
  } else {
    if (t.player === myIndex) from = $('myHand') && $('myHand').getBoundingClientRect();
    if (!from || !from.width) return;
    x = from.left + from.width / 2;
    y = from.top + from.height / 2;
  }
  const dx = x - (end.left + end.width / 2),
    dy = y - (end.top + end.height / 2);
  const scene = wrap.querySelector('.played-scene');
  if (!scene || !scene.animate) return;
  const base = getComputedStyle(scene).transform;
  const pose = base === 'none' ? '' : base;
  scene.animate(
    [
      { transform: `translate3d(${dx}px,${dy}px,0) ${pose}`, opacity: 1 },
      { transform: `translate3d(0,0,0) ${pose}`, opacity: 1 },
    ],
    { duration: solScaledDelay(480, 100), easing: 'cubic-bezier(.22,.65,.3,1)' }
  );
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
  } catch (_) {
    return {};
  }
}
function favoritePartner042() {
  const store = favoritePartnerStore042();
  const name = Object.prototype.hasOwnProperty.call(store, favoritePartnerOwner042())
    ? store[favoritePartnerOwner042()]
    : '';
  return BOT_PERSONAS.find((p) => p.name === name) || null;
}
function favoritePartnerSeat042() {
  const me = (players || []).find((p) => p && !p.isBot && p.id === myPeerId);
  return me && Number.isInteger(me.seat) && me.seat >= 0 && me.seat < 4 ? (me.seat + 2) % 4 : -1;
}
function saveFavoritePartner042(name) {
  const persona = BOT_PERSONAS.find((p) => p.name === name);
  if (name && !persona) return false;
  const store = favoritePartnerStore042();
  // defineProperty also handles names such as __proto__ without changing prototypes.
  Object.defineProperty(store, favoritePartnerOwner042(), {
    value: persona ? persona.name : '',
    writable: true,
    enumerable: true,
    configurable: true,
  });
  try {
    localStorage.setItem('horFavoritePartnersV1', JSON.stringify(store));
  } catch (_) {
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
    select.innerHTML =
      '<option value="">No favorite · choose normally</option>' +
      BOT_PERSONAS.map(
        (p) =>
          '<option value="' +
          escapeHtmlSafe(p.name) +
          '">' +
          escapeHtmlSafe(p.name) +
          ' · ' +
          escapeHtmlSafe(STYLE_TITLES[p.style] || p.style) +
          '</option>'
      ).join('');
    select.dataset.favoriteReady = '1';
    select.onchange = () => {
      if (!saveFavoritePartner042(select.value))
        select.value = (favoritePartner042() || {}).name || '';
    };
  }
  const favorite = favoritePartner042();
  select.value = favorite ? favorite.name : '';
  const hint = $('favoritePartnerHint');
  if (hint)
    hint.textContent = favorite
      ? favorite.name +
        ' is your offline partner until you change it. Changes apply to your next offline game. Saved on this device.'
      : 'Keep your favorite for offline play against three bots. Changes apply to your next offline game. Saved on this device.';
}
function applyFavoritePartner042() {
  if (!isHost || isSpectator || !(isSoloPractice || roomCode === 'OFFLINE')) return false;
  const favorite = favoritePartner042(),
    seat = favoritePartnerSeat042();
  if (!favorite || seat < 0) return false;
  if (
    (players || []).some(
      (p) => p && !p.isBot && (playerAvatars[p.id] || p.avatar) === favorite.avatar
    )
  )
    return false;
  const current = playerAtSeat(seat);
  // A human partner always keeps their seat; their host cannot be changed here.
  if (!current || !current.isBot || current.name === favorite.name) return false;
  const existing = (players || []).find((p) => p && p.isBot && p.name === favorite.name);
  if (existing) {
    const oldSeat = existing.seat;
    existing.seat = seat;
    existing.team = seat % 2;
    current.seat = oldSeat;
    current.team = oldSeat % 2;
  } else {
    current.name = favorite.name;
    current.botStyle = favorite.style;
    current.avatar = favorite.avatar || AVATARS[0];
    current.careerPublic =
      horCareerModeOn() &&
      window.HORProgression &&
      HORProgression.localCareer &&
      HORProgression.localCareer.botPublicProfile
        ? HORProgression.localCareer.botPublicProfile(favorite.name)
        : null;
    playerAvatars[current.id] = current.avatar;
  }
  return true;
}
try {
  syncFavoritePartner042();
} catch (_) {}

(function () {
  const FAMILIES = {
    smoothcard735: 'Card lift',
    smoothcard736down: 'Card set down',
    bidup735: 'Bid increase',
    biddown735: 'Bid decrease',
    paper: 'Card movement',
    gather: 'Gather cards',
    click: 'Button',
    wood: 'Wood tap',
    clink: 'Glass clink',
    stamp: 'Trump stamp',
    tick: 'Clock tick',
    wings: 'Wing flaps',
    applause: 'Award applause',
  };
  const previewSources = new Set();
  window.he064Gain = (category) =>
    window.HORAudioMixer?.level(
      category === 'preview'
        ? 'gameplay'
        : category === 'character' || category === 'atmosphere'
          ? category
          : 'gameplay'
    ) ?? 1;
  function stopPreviewAudio() {
    previewSources.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    previewSources.clear();
  }
  function track(src) {
    if (src) previewSources.add(src);
    return src;
  }
  window.he064Track = track;
  function openMenu() {
    const root = document.getElementById('houseEffects064');
    if (!root) return;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('he064-open');
    const done = root.querySelector('#he064Done');
    if (done) done.focus({ preventScroll: true });
  }
  function closeMenu() {
    stopPreviewAudio();
    const root = document.getElementById('houseEffects064');
    if (root) {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('he064-open');
    const opener = document.getElementById('openHouseEffects064');
    if (opener) opener.focus({ preventScroll: true });
  }
  async function playFamily(kind, index) {
    stopPreviewAudio();
    if (soundMuted) return;
    await loadNatural063(kind, index);
    track(playNatural063(kind, 0.65, 0, 'preview', index));
  }
  function init() {
    const host = document.querySelector('.gh-menu-sound .gh-sound-panel');
    if (!host || document.getElementById('houseEffects064')) return;
    const launch = document.createElement('button');
    launch.type = 'button';
    launch.id = 'openHouseEffects064';
    launch.textContent = 'Sound variations & effects';
    launch.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu();
    };
    host.appendChild(launch);
    const root = document.createElement('div');
    root.id = 'houseEffects064';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="he064-shell" role="dialog" aria-label="House Effects"><header class="he064-head"><div><b>House Effects</b><small>Sound choices save automatically</small></div></header><div class="he064-body"></div><footer class="he064-foot"><button type="button" id="he064Done">Done</button></footer></div>';
    document.body.appendChild(root);
    const body = root.querySelector('.he064-body');
    const sounds = document.createElement('section');
    sounds.dataset.hePane = 'sounds';
    const vols = document.createElement('div');
    vols.className = 'he064-vols';
    vols.textContent = 'Volumes and voice mute are in Sounds & Atmosphere → Volume Controls.';
    sounds.appendChild(vols);
    Object.entries(FAMILIES).forEach(([kind, title]) => {
      const row = document.createElement('div');
      row.className = 'he064-row';
      const count = naturalCounts063[kind] || 1;
      const sel = document.createElement('select');
      for (let i = 1; i <= count; i++) {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = 'Variation ' + i;
        sel.appendChild(o);
      }
      if (count > 1) {
        const o = document.createElement('option');
        o.value = 'rotate';
        o.textContent = 'Rotation';
        sel.appendChild(o);
      }
      sel.value = String(naturalPreferences063[kind] ?? (count > 1 ? 'rotate' : 1));
      sel.setAttribute('aria-label', title + ' variation');
      sel.dataset.soundFamily = kind;
      sel.onchange = () => {
        stopPreviewAudio();
        setNaturalPreference063(kind, sel.value === 'rotate' ? 'rotate' : Number(sel.value));
      };
      const play = document.createElement('button');
      play.type = 'button';
      play.textContent = 'Play';
      play.setAttribute('aria-label', 'Play ' + title);
      const stop = document.createElement('button');
      stop.type = 'button';
      stop.textContent = 'Stop';
      stop.setAttribute('aria-label', 'Stop ' + title);
      play.onclick = async () => {
        if (sel.value === 'rotate') {
          stopPreviewAudio();
          for (let n = 0; n < count; n++) {
            await loadNatural063(kind, n + 1);
            track(playNatural063(kind, 0.65, n * 380, 'preview', n + 1));
          }
        } else playFamily(kind, Number(sel.value));
      };
      stop.onclick = stopPreviewAudio;
      row.append(document.createTextNode(title + ' '), sel, play, stop);
      const label = document.createElement('label');
      label.className = 'he-volume';
      label.textContent = 'Volume ';
      const output = document.createElement('output'),
        slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = String(naturalLevels063[kind] ?? 100);
      slider.setAttribute('aria-label', title + ' volume');
      output.textContent = slider.value + '%';
      slider.oninput = () => {
        stopPreviewAudio();
        setNaturalLevel063(kind, slider.value);
        output.textContent = slider.value + '%';
      };
      label.append(output, slider);
      row.append(label);
      sounds.appendChild(row);
    });
    body.append(sounds);
    root.querySelector('#he064Done').onclick = closeMenu;
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.addEventListener('click', (e) => e.stopPropagation());
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
    });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function armRareRaven() {
    const wait = (8 + Math.random() * 7) * 60 * 1000;
    setTimeout(() => {
      const critical =
        document.body.classList.contains('he064-open') ||
        document.body.classList.contains('bidding') ||
        document.getElementById('discardModal');
      if (!critical && !soundMuted && soundRook) playRavenCalls060(1);
      armRareRaven();
    }, wait);
  }
  armRareRaven();
})();

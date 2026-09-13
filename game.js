/* Pre-play selection build 2026-09-11 */
// House of Rooks — host-from-phone multiplayer (PeerJS)
// Author: Jerome Griffin
// Copyright (c) 2026 Jerome Griffin / Griffin House

// Bump this alongside the game.js?v= / sw.js CACHE version on every deploy.
// It's exchanged during the join handshake so a stale host or joiner (e.g.
// one still running old cached JS) gets caught and auto-updated instead of
// silently failing or behaving unpredictably against a mismatched peer.
const APP_VERSION = '349';

function horThisIndex() {
  try {
    const u = new URL('index.html', location.href);
    u.search = '';
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
  const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10);
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
/** If makers take more than bid, overage is subtracted from their score */
let sandbagging = false;
/** Nest counters go to 'lastTrick' (default partnership) or 'bidder' */
let nestGoesTo = 'lastTrick';
/** Who leads the first trick of play, relative to the bid winner:
 * 'bidder' (default — bid winner leads), 'leftOfBidder', or 'rightOfBidder' */
let leadOrder = 'bidder';
/** Alternate rules seen in other Rook groups online — all off by default:
 * misdeal & redeal if any hand has zero counter cards */
let misdealOnNoCounters = false;
/** 'Screw the dealer': if everyone passes, the dealer must bid the
 * minimum instead of the hand being redealt */
let screwTheDealer = false;
/** Open widow: reveal the nest to everyone (not just the bidder) the
 * moment it's picked up, before the bidder discards */
let openWidow = false;
/** Shoot the Moon: bidding every counter in the deck is an all-or-nothing
 * bid — make it and win the game outright, miss it and go set as usual */
let shootMoonEnabled = false;
/** Bot delay: blitz | normal | slow */
let botSpeed = 'normal';
/** Partner discipline + coach (default ON) */
let partnerNeverKill = true;
let partnerFeedLast = true;
let dontStealPartnerBid = true;
let landscapeBidHints = false;
let nestLastTrickAnim = true;
let layDownWinningCards = true;
/** Emphasize suit symbols for color-blind play */
let colorBlindCards = localStorage.getItem('rookColorBlind') === '1';
let minBid = 100;
let handSize = 10;
let nestSizeDefault = 6;
let turnTimeSec = 0; // 0 = off (default), 15/30/45
/** On timeout: auto | lowest | skipLowest | botHand */
let timeoutPolicy = 'auto';
/** Seats under temp-bot-for-hand after timeout policy botHand */
let timeoutBotUntilHandEnd = {}; // seatIdx -> true
let soundCard = true, soundTurn = true, soundRook = true, soundTick = true;
let playLockUntil = 0;
let knownVoids = [{}, {}, {}, {}]; // extreme bot: playerIdx -> {color: true}
let matchStats = { hands: 0, highBid: 0, setsA: 0, setsB: 0, madeA: 0, madeB: 0, bidSum: 0, bidCount: 0 };
const AVATARS = [
  'rookling','fox','badger','owl','cardshark','greenie','bluejay','grumpy','goldfinch',
  'jackal','wolf','raven','lynx','cobra','stag',
  'quill','bramble','moss','emberlyn','cinder','gable','thistle','marrow','pebble',
  'rookery','sable','finch','dagger','willow','hearth','grit','copper','moth','brandy',
  'flint','ivy','shade','barrel','spark','nettle','cobalt','ash','harrier'
];
const AVATAR_LABELS = {
  rookling:'Rookling', fox:'Fox', badger:'Badger', owl:'Owl', cardshark:'Card Shark',
  greenie:'Greenie', bluejay:'Bluejay', grumpy:'Grumpy', goldfinch:'Goldfinch',
  jackal:'Jackal', wolf:'Wolf', raven:'Raven', lynx:'Lynx', cobra:'Cobra', stag:'Stag',
  quill:'Quill', bramble:'Bramble', moss:'Moss', emberlyn:'Emberlyn', cinder:'Cinder',
  gable:'Gable', thistle:'Thistle', marrow:'Marrow', pebble:'Pebble', rookery:'Rookery',
  sable:'Sable', finch:'Finch', dagger:'Dagger', willow:'Willow', hearth:'Hearth',
  grit:'Grit', copper:'Copper', moth:'Moth', brandy:'Brandy', flint:'Flint', ivy:'Ivy',
  shade:'Shade', barrel:'Barrel', spark:'Spark', nettle:'Nettle', cobalt:'Cobalt',
  ash:'Ash', harrier:'Harrier'
};
function avatarSrc(id) { return 'avatar-' + (AVATARS.includes(id) ? id : AVATARS[0]) + '.svg'; }
function avatarHTML(id) { return `<img class="seat-avatar-img" src="${avatarSrc(id)}" alt="${AVATAR_LABELS[id] || 'Avatar'}">`; }
let playerAvatars = {}; // peerId -> emoji
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

function loadMyBank() {
  try { return Math.max(0, parseInt(localStorage.getItem('horBank'), 10) || 0); } catch (e) { return 0; }
}
function saveMyBank(n) {
  try { localStorage.setItem('horBank', String(Math.max(0, Math.floor(Number(n) || 0)))); } catch (e) {}
}
function tableMsgCost() {
  return 100;
}
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
      'Auction’s open. Wallet’s open.',
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
    ]
  };
  const lines = pool[kind];
  if (!lines || !lines.length) return '';
  return lines[Math.floor(Math.random() * lines.length)];
}
function botMaybeTableTalk(kind, ctx) {
  if (!isHost) return;
  if (!players || !players.length) return;
  const now = Date.now();
  if (window._botTalkAt && now - window._botTalkAt < 8000) return;
  if (Math.random() > 0.42) return;
  const cost = tableMsgCost();
  const rich = [];
  players.forEach((p, i) => {
    if (p && p.isBot && bankOfSeat(i) >= cost) rich.push(i);
  });
  if (!rich.length) return;
  let seat = rich[Math.floor(Math.random() * rich.length)];
  if (ctx && typeof ctx.prefer === 'number' && rich.indexOf(ctx.prefer) >= 0 && Math.random() < 0.65) {
    seat = ctx.prefer;
  }
  const text = pickBotTalkLine(kind, seat, ctx);
  if (!text) return;
  window._botTalkAt = now;
  setSeatBank(seat, bankOfSeat(seat) - cost);
  const nm = (players[seat] && players[seat].name) || 'Bot';
  setTimeout(() => {
    try { showTableMsgPopup(nm, text); } catch (e) {}
    try { updateBankDisplays(); } catch (e) {}
    try { broadcast({ type: 'tableMsg', name: nm, text, banks: players.map(p => p.bank || 0) }); } catch (e) {}
  }, 450 + Math.floor(Math.random() * 800));
}
function bankOfSeat(idx) {
  const list = (game && game.players && game.players.length) ? game.players : players;
  const p = list && list[idx];
  if (p && typeof p.bank === 'number') return p.bank;
  if (players[idx] && typeof players[idx].bank === 'number') return players[idx].bank;
  return 0;
}
function setSeatBank(idx, amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (players[idx]) players[idx].bank = n;
  if (game && game.players && game.players[idx]) game.players[idx].bank = n;
  if ((players[idx] && players[idx].id === myPeerId) || idx === myIndex) saveMyBank(n);
}
function creditCapture(idx, pts) {
  const add = Math.floor(Number(pts) || 0);
  if (idx == null || idx < 0 || add <= 0) return;
  setSeatBank(idx, bankOfSeat(idx) + add);
  try { updateBankDisplays(); } catch (e) {}
}
function formatBank(n) { return '$' + Math.max(0, Math.floor(Number(n) || 0)); }
function beerCost() { return 150; }
function whisperCost() { return 200; }
function buzzRemainMs(idx) {
  const p = players[idx] || (game && game.players && game.players[idx]);
  if (!p || !p.buzzUntil) return 0;
  return Math.max(0, p.buzzUntil - Date.now());
}
function formatBuzzLeft(idx) {
  const ms = buzzRemainMs(idx);
  if (ms <= 0) return 'Buzz worn off';
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return 'Buzzed · ' + m + ':' + String(r).padStart(2, '0') + ' left';
}
function clearAllBuzz() {
  (players || []).forEach((p, i) => {
    if (!p) return;
    p.buzzUntil = 0;
    if (game && game.players && game.players[i]) game.players[i].buzzUntil = 0;
  });
  document.querySelectorAll('.seat-bought-beer').forEach((el) => el.remove());
}
function isBuzzed(idx) {
  const p = players[idx] || (game && game.players && game.players[idx]);
  return !!(p && p.buzzUntil && Date.now() < p.buzzUntil);
}
function seatSlotIdForIndex(idx) {
  const base = (myIndex >= 0) ? myIndex : 0;
  if (idx === base) return 'slot-me';
  if (idx === (base + 1) % 4) return 'slot-left';
  if (idx === (base + 2) % 4) return 'slot-partner';
  if (idx === (base + 3) % 4) return 'slot-right';
  return 'slot-me';
}
function animateBeerToSeat(idx) {
  const from = $('slot-me') || document.body;
  const to = $(seatSlotIdForIndex(idx)) || document.body;
  const fly = document.createElement('div');
  fly.className = 'beer-fly';
  fly.textContent = '🍺';
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  fly.style.left = (a.left + a.width / 2 - 16) + 'px';
  fly.style.top = (a.top + a.height / 2 - 16) + 'px';
  document.body.appendChild(fly);
  void fly.offsetWidth;
  fly.style.transform = 'translate(' + ((b.left + b.width / 2) - (a.left + a.width / 2)) + 'px,' + ((b.top + 18) - (a.top + a.height / 2)) + 'px)';
  setTimeout(() => {
    fly.classList.add('landed');
    let mug = to.querySelector('.seat-bought-beer');
    if (!mug) {
      mug = document.createElement('span');
      mug.className = 'seat-bought-beer';
      mug.textContent = '🍺';
      mug.title = 'Buzzed';
      const rack = to.querySelector('.seat-top-rack') || to;
      rack.appendChild(mug);
    }
    setTimeout(() => { try { fly.remove(); } catch (e) {} }, 280);
  }, 720);
}
function buyBotBeer(idx) {
  if (!buyBeerBots) return;
  if (idx == null || idx < 0 || !players[idx] || !players[idx].isBot) return;
  if (!isHost) {
    try { if (hostConnection) hostConnection.send({ type: 'buyBeer', seat: idx }); } catch (e) {}
    return;
  }
  const seat = (myIndex >= 0) ? myIndex : 0;
  const cost = beerCost();
  if (bankOfSeat(seat) < cost) {
    try { alert('A beer costs $' + cost + '. Capture more counters first.'); } catch (e) {}
    return;
  }
  setSeatBank(seat, bankOfSeat(seat) - cost);
  players[idx].buzzUntil = Date.now() + 5 * 60 * 1000;
  if (game && game.players && game.players[idx]) game.players[idx].buzzUntil = players[idx].buzzUntil;
  animateBeerToSeat(idx);
  try { updateBankDisplays(); } catch (e) {}
  try {
    broadcast({ type: 'botBeer', seat: idx, buzzUntil: players[idx].buzzUntil, banks: players.map(p => p.bank || 0) });
  } catch (e) {}
}
window.buyBotBeer = buyBotBeer;

function showTableMsgPopup(name, text) {
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
function loadTableMsgDraft() {
  try { return String(localStorage.getItem('horTableMsgDraft') || ''); } catch (e) { return ''; }
}
function saveTableMsgDraft(text) {
  try { localStorage.setItem('horTableMsgDraft', String(text || '').slice(0, 80)); } catch (e) {}
}
function clearTableMsgDraft() {
  try { localStorage.removeItem('horTableMsgDraft'); } catch (e) {}
}
function refreshTableMsgCostLine() {
  const whisper = whisperTargetIdx >= 0;
  const cost = whisper ? whisperCost() : tableMsgCost();
  const bank = bankOfSeat(myIndex >= 0 ? myIndex : 0);
  const line = $('tableMsgCostLine');
  const title = $('tableMsgModal') && $('tableMsgModal').querySelector('h2');
  const who = (whisper && players[whisperTargetIdx]) ? players[whisperTargetIdx].name : '';
  if (title) title.textContent = whisper ? ('Message ' + who) : 'Message the table';
  if (!line) return;
  if (whisper) {
    if (bank < cost) line.textContent = 'Private note · $' + cost + ' · Bank $' + bank + ' — need $' + cost;
    else line.textContent = 'Private note to ' + who + ' · $' + cost + ' · Bank $' + bank;
    return;
  }
  if (bank < cost) line.textContent = 'Costs $' + cost + ' · Bank $' + bank + ' — held until you have $' + cost;
  else line.textContent = 'Costs $' + cost + ' · Bank $' + bank;
}
function pinTableMsgModal() {
  const modal = $('tableMsgModal');
  if (!modal || modal.classList.contains('hidden')) return;
  const box = modal.querySelector('.modal-content');
  if (!box) return;
  let top = 8;
  try {
    if (window.visualViewport) {
      top = Math.max(8, Math.round(window.visualViewport.offsetTop + 8));
    }
  } catch (e) {}
  box.style.position = 'fixed';
  box.style.left = '50%';
  box.style.top = top + 'px';
  box.style.transform = 'translateX(-50%)';
  box.style.width = 'min(400px, 92vw)';
  box.style.maxHeight = '42vh';
}
function openWhisperBuy(idx) {
  if (!whisperHumans) return;
  if (idx == null || idx < 0 || !players[idx] || players[idx].isBot) return;
  if (idx === myIndex) return;
  whisperTargetIdx = idx;
  openTableMsgBuy({ whisper: true, keepWhisper: true });
  const locked = horExpOn('partnerChatAfterNest') && game && game.phase !== 'play' && game.phase !== 'score';
  const send = $('tableMsgSend');
  if (send) send.disabled = !!locked;
  if (locked) {
    const line = $('tableMsgCostLine');
    if (line) line.textContent = 'Partner chat stays closed until trump is chosen and the nest is buried.';
    try { horToast('Partner chat opens after the nest is buried.'); } catch (e) {}
  }
}
window.openWhisperBuy = openWhisperBuy;
function openTableMsgBuy(opts) {
  const modal = $('tableMsgModal');
  if (!modal) return;
  if (!(opts && opts.keepWhisper)) whisperTargetIdx = (opts && opts.whisper) ? whisperTargetIdx : -1;
  refreshTableMsgCostLine();
  const inp = $('tableMsgInput');
  if (inp) inp.value = loadTableMsgDraft();
  modal.classList.remove('hidden');
  pinTableMsgModal();
  try { if (inp) setTimeout(() => { inp.focus(); pinTableMsgModal(); }, 50); } catch (e) {}
}
function closeTableMsgBuy() {
  const inp = $('tableMsgInput');
  if (inp) saveTableMsgDraft(String(inp.value || '').trim());
  const modal = $('tableMsgModal');
  if (modal) modal.classList.add('hidden');
  whisperTargetIdx = -1;
}
function holdTableMsgBuy() {
  const inp = $('tableMsgInput');
  saveTableMsgDraft(String((inp && inp.value) || '').trim());
  closeTableMsgBuy();
}
function submitTableMsgBuy() {
  const inp = $('tableMsgInput');
  const text = String((inp && inp.value) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!text) return;
  saveTableMsgDraft(text);
  const whisperTo = whisperTargetIdx;
  const cost = whisperTo >= 0 ? whisperCost() : tableMsgCost();
  const seat = (myIndex >= 0) ? myIndex : 0;
  if (bankOfSeat(seat) < cost) {
    refreshTableMsgCostLine();
    return;
  }
  if (isHost) {
    setSeatBank(seat, bankOfSeat(seat) - cost);
    clearTableMsgDraft();
    if (inp) inp.value = '';
    const fromName = (players[seat] && players[seat].name) || myName || 'Player';
    closeTableMsgBuy();
    if (whisperTo >= 0) {
      if (horExpOn('partnerChatAfterNest') && game && game.phase !== 'play' && game.phase !== 'score') {
        try { horToast('Partner chat opens after the nest is buried.'); } catch (e) {}
        return;
      }
      showTableMsgPopup(fromName + ' → ' + ((players[whisperTo] && players[whisperTo].name) || 'them'), text);
      try { updateBankDisplays(); } catch (e) {}
      try {
        broadcast({
          type: 'whisper',
          from: seat,
          to: whisperTo,
          fromId: players[seat] && players[seat].id,
          toId: players[whisperTo] && players[whisperTo].id,
          name: fromName,
          text,
          banks: players.map(p => p.bank || 0)
        });
      } catch (e) {}
      return;
    }
    showTableMsgPopup(fromName, text);
    try { updateBankDisplays(); } catch (e) {}
    try { broadcast({ type: 'tableMsg', name: fromName, text, banks: players.map(p => p.bank || 0) }); } catch (e) {}
    return;
  }
  try {
    if (hostConnection && hostConnection.open) {
      hostConnection.send(whisperTo >= 0
        ? { type: 'buyWhisper', to: whisperTo, text }
        : { type: 'buyTableMsg', text });
    }
  } catch (e) {}
  clearTableMsgDraft();
  if (inp) inp.value = '';
  closeTableMsgBuy();
}
function updateBankDisplays() {
  const seatBase = (typeof myIndex === 'number' && myIndex >= 0) ? myIndex : 0;
  const map = {
    partner: (seatBase + 2) % 4,
    left: (seatBase + 1) % 4,
    right: (seatBase + 3) % 4,
    me: seatBase
  };
  Object.keys(map).forEach((slot) => {
    const el = document.querySelector('[data-bank-slot="' + slot + '"]');
    if (!el) return;
    const idx = map[slot];
    el.textContent = formatBank(bankOfSeat(idx));
    el.classList.toggle('is-mine', slot === 'me');
    el.title = slot === 'me' ? 'Tap to send a table message' : '';
  });
  document.querySelectorAll('.wait-seat-bank').forEach((el) => {
    const seat = parseInt(el.getAttribute('data-wait-bank'), 10);
    if (Number.isFinite(seat)) el.textContent = formatBank(bankOfSeat(seat));
  });
}
function applyBanksFromList(list) {
  if (!Array.isArray(list)) return;
  list.forEach((amt, i) => {
    if (players[i]) players[i].bank = Math.max(0, Math.floor(Number(amt) || 0));
    if (game && game.players && game.players[i]) game.players[i].bank = players[i] ? players[i].bank : 0;
  });
  try { updateBankDisplays(); } catch (e) {}
}

function readTargetScoreFromUI() {
  const ts = $('opt-target-score');
  const custom = $('opt-target-score-custom');
  if (!ts) return targetScore || 500;
  if (ts.value === 'custom') {
    const raw = custom ? String(custom.value || '').replace(/[^\d]/g, '') : '';
    let v = parseInt(raw, 10);
    if (!Number.isFinite(v) || v < 50) v = targetScore >= 50 ? targetScore : 500;
    if (v > 5000) v = 5000;
    return v;
  }
  return parseInt(ts.value, 10) || 500;
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
  const presets = ['200', '300', '500', '1000'];
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
      if (!Number.isFinite(v) || v < 50) {
        custom.focus();
        custom.select();
        return;
      }
      targetScore = Math.min(5000, v);
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
      if (Number.isFinite(v) && v >= 50) {
        targetScore = Math.min(5000, v);
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
let buyBeerBots = false;
let whisperHumans = false;
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
  renderPlaquePickers();
}
function renderPlaquePickers() {
  ['plaquePickA', 'plaquePickB'].forEach((id, team) => {
    const host = $(id);
    if (!host) return;
    const cur = team === 0 ? plaqueA : plaqueB;
    host.innerHTML = Object.keys(PLAQUE_STYLES).map((key) => {
      const s = PLAQUE_STYLES[key];
      return '<button type="button" class="plaque-swatch' + (key === cur ? ' active' : '') + '" data-plaque="' + key + '" style="background:' + s.bg + ';color:' + s.fg + '">' + s.label + '</button>';
    }).join('');
    host.querySelectorAll('[data-plaque]').forEach((btn) => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-plaque');
        if (team === 0) plaqueA = key; else plaqueB = key;
        applyPlaqueColors();
        try { localStorage.setItem('horPlaqueA', plaqueA); localStorage.setItem('horPlaqueB', plaqueB); } catch (e) {}
      };
    });
  });
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
  recomputeHandAndNest();
  syncOptionsUI();
  if (broadcastChange && isHost) {
    try { broadcastPlaySettings(); } catch (e) {}
  }
}

function syncOptionsUI() {
  const saEl = $('opt-specials-anytime');
  if (saEl) saEl.checked = !!specialsAnytime;
  const mtvEl = $('opt-must-trump');
  if (mtvEl) mtvEl.checked = !!mustTrumpWhenVoid;
  const bos = $('opt-bid-only');
  if (bos) bos.checked = !!bidOnlyScoring;
  const sbag = $('opt-sandbagging');
  if (sbag) sbag.checked = !!sandbagging;
  const ng = $('opt-nest-goes-to');
  if (ng) ng.value = nestGoesTo;
  const lo = $('opt-lead-order');
  if (lo) lo.value = leadOrder;
  const mdc = $('opt-misdeal-no-counters');
  if (mdc) mdc.checked = !!misdealOnNoCounters;
  const std = $('opt-screw-dealer');
  if (std) std.checked = !!screwTheDealer;
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
  const beerOpt = $('opt-buy-beer');
  if (beerOpt) beerOpt.checked = !!buyBeerBots;
  document.body.classList.toggle('buy-beer-on', !!buyBeerBots);
  const whOpt = $('opt-whisper');
  if (whOpt) whOpt.checked = !!whisperHumans;
  document.body.classList.toggle('whisper-on', !!whisperHumans);
  const avMo = $('opt-avatar-motion');
  if (avMo) avMo.checked = window.horAvatarMotion !== false;
  document.body.classList.toggle('no-avatar-motion', window.horAvatarMotion === false);
  const tvOpt = $('opt-tv-display');
  if (tvOpt) tvOpt.checked = !!window.horTvDisplay;
  document.body.classList.toggle('hor-tv-display', !!window.horTvDisplay);
  const kickMuteOpt = $('opt-host-kick-mute');
  if (kickMuteOpt) kickMuteOpt.checked = !!window.horHostKickMute;
  const cbCards = $('opt-color-blind');
  if (cbCards) cbCards.checked = !!colorBlindCards;
  document.body.classList.toggle('color-blind-cards', !!colorBlindCards);
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
    bidOnlyScoring, sandbagging, nestGoesTo, leadOrder, misdealOnNoCounters, screwTheDealer, openWidow, shootMoonEnabled, botSpeed, colorBlindCards, handSortMode, timeoutPolicy,
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
  localStorage.setItem('rookMuted', soundMuted ? '1' : '0');
  updateMuteButtons();
  if (!soundMuted) ensureAudio();
}

/** Soft snap / place when a card hits the table */
function playCardSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;

  const t = ctx.currentTime;
  // Brief noise burst filtered for a "card slap"
  const bufferSize = Math.floor(ctx.sampleRate * 0.06);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.09);

  // Soft low thump
  const osc = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
  g2.gain.setValueAtTime(0.2, t);
  g2.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
  osc.connect(g2);
  g2.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

/** Three clear beeps when it is your turn (timed with name flashes) */
function playTurnSound() {
  if (soundMuted || !soundTurn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
  const t = ctx.currentTime;
  // 3 distinct beeps ~0.45s apart — matches flash pulses
  const beeps = [
    { freq: 880, at: 0 },
    { freq: 880, at: 0.45 },
    { freq: 1046.5, at: 0.9 },
  ];
  beeps.forEach(({ freq, at }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = t + at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  });
}

/** Shared raspy crow "caw" synth (noise + falling saw + formant) */
function playCawBurst(startOffset, pitch) {
  if (soundMuted || !soundRook) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = t + (startOffset || 0);
  const dur = 0.28;
  const p = pitch || 360;

  const nLen = Math.floor(ctx.sampleRate * (dur + 0.05));
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nData = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.12));
    nData[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = nBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(p * 1.8, s);
  bp.frequency.exponentialRampToValueAtTime(p * 0.9, s + dur);
  bp.Q.value = 2.5;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.0001, s);
  nGain.gain.exponentialRampToValueAtTime(0.45, s + 0.03);
  nGain.gain.exponentialRampToValueAtTime(0.15, s + 0.12);
  nGain.gain.exponentialRampToValueAtTime(0.001, s + dur);
  noise.connect(bp);
  bp.connect(nGain);
  nGain.connect(ctx.destination);
  noise.start(s);
  noise.stop(s + dur + 0.02);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(p, s);
  osc.frequency.exponentialRampToValueAtTime(p * 0.72, s + dur);
  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.setValueAtTime(p * 2.2, s);
  formant.frequency.exponentialRampToValueAtTime(p * 1.4, s + dur);
  formant.Q.value = 4;
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.0001, s);
  oGain.gain.exponentialRampToValueAtTime(0.22, s + 0.025);
  oGain.gain.exponentialRampToValueAtTime(0.08, s + 0.14);
  oGain.gain.exponentialRampToValueAtTime(0.001, s + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  osc.connect(formant);
  formant.connect(lp);
  lp.connect(oGain);
  oGain.connect(ctx.destination);
  osc.start(s);
  osc.stop(s + dur + 0.02);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(p * 0.5, s);
  sub.frequency.exponentialRampToValueAtTime(p * 0.35, s + 0.15);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, s);
  sg.gain.exponentialRampToValueAtTime(0.2, s + 0.02);
  sg.gain.exponentialRampToValueAtTime(0.001, s + 0.2);
  sub.connect(sg);
  sg.connect(ctx.destination);
  sub.start(s);
  sub.stop(s + 0.22);
}

/** Distinct double crow when the Rook is played */
function playRookSound() {
  if (soundMuted || !soundRook) return;
  if (!ensureAudio()) return;
  // Classic double "caw caw"
  playCawBurst(0.0, 380);
  playCawBurst(0.32, 340);
}

/** Single "caw" when the Red 2 is played */
function playRed2Sound() {
  if (soundMuted || !soundRook) return;
  if (!ensureAudio()) return;
  playCawBurst(0.0, 420);
}

function playTickSound() {
  if (soundMuted || !soundTick) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.07);
}

/** Soft UI click (buttons, selects) */
function playClickSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(920, t);
  osc.frequency.exponentialRampToValueAtTime(480, t + 0.04);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}

function playSitSound() {
  if (soundMuted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [523, 659, 784].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const s = t + i * 0.07;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.14, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.18);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.2);
  });
}

/** Bid placed — short rising blip (like casino chip / bid) */
function playBidSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [440, 554, 659].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = f;
    const s = t + i * 0.045;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.1, s + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.09);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.1);
  });
}

/** Pass — soft descending tone */
function playPassSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(360, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.16);
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Auction won / nest taken */
function playWinBidSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const s = t + i * 0.07;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(0.16, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.28);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.3);
  });
}

/** Discard / nest shuffle — multiple soft card taps */
function playDiscardSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 4; i++) {
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.3));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + i * 180;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    const s = t + i * 0.05;
    g.gain.setValueAtTime(0.22, s);
    g.gain.exponentialRampToValueAtTime(0.01, s + 0.05);
    noise.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    noise.start(s);
    noise.stop(s + 0.055);
  }
}

/** Trump named — bright fanfare blip */
function playTrumpSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [392, 523.25, 659.25].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const s = t + i * 0.06;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.09, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.22);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.24);
  });
}

/** Trick won — short success chime */
function playTrickWinSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [659.25, 830.61, 987.77].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    const s = t + i * 0.055;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(0.15, s + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.25);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.27);
  });
}

/** Hand made */
function playMadeSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const s = t + i * 0.08;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(0.14, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.35);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.38);
  });
}

/** Hand set — low warning */
function playSetSound() {
  if (soundMuted || !soundCard) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [220, 185, 146.8].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const s = t + i * 0.1;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.1, s + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, s + 0.28);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.3);
  });
}

/** Longer shuffle — ~1.5s of layered card-riffle noise */
function playShuffleSound() {
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
    g.connect(ctx.destination);
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
    g.connect(ctx.destination);
    osc.start(s);
    osc.stop(s + 0.14);
  }
}

/** Short pre-auction tip so everyone knows how bidding works */
let biddingIntroTimer = null;
function showBiddingIntro(onDone, minBidOverride) {
  const min = minBidOverride != null ? minBidOverride : (minBid || 100);
  let el = $('biddingIntro');
  if (!el) {
    el = document.createElement('div');
    el.id = 'biddingIntro';
    el.className = 'bidding-intro hidden';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <div class="bidding-intro-card">
        <div class="bidding-intro-title">Bidding</div>
        <p class="bidding-intro-body"></p>
      </div>`;
    document.body.appendChild(el);
  }
  const body = el.querySelector('.bidding-intro-body');
  if (body) {
    body.innerHTML =
      `Bids start at <strong>${min}</strong> and climbs by <strong>5</strong>.`;
  }
  el.classList.remove('hidden');
  if (biddingIntroTimer) clearTimeout(biddingIntroTimer);
  const ms = 3200;
  biddingIntroTimer = setTimeout(() => {
    el.classList.add('hidden');
    biddingIntroTimer = null;
    if (typeof onDone === 'function') onDone();
  }, ms);
}

/** Fanfare when Rook captures Red 2 or a trump 1 is taken */
function playCaptureFanfare(kind) {
  if (soundMuted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  // Rising triumphant arpeggio + short drum thud
  const notes = kind === 'trump1'
    ? [392, 523.25, 659.25, 783.99, 1046.5]
    : [261.63, 329.63, 392, 523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = i % 2 === 0 ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(freq, t0 + i * 0.07);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.07);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + i * 0.07 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.07 + 0.28);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0 + i * 0.07);
    osc.stop(t0 + i * 0.07 + 0.32);
  });
  // Sparkle noise burst
  try {
    const n = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.25));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'highpass';
    bp.frequency.value = 2000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12, t0 + 0.15);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(ctx.destination);
    src.start(t0 + 0.15);
    src.stop(t0 + 0.42);
  } catch (e) {}
  // Optional vibration
  try {
    if (navigator.vibrate) navigator.vibrate(kind === 'rook-red2' ? [40, 40, 80, 40, 120] : [30, 50, 30]);
  } catch (e) {}
}

let captureOverlayTimer = null;
let captureCelebrationQueue = [];
let captureCelebrationRunning = false;
/**
 * kind: 'rook-red2' | 'trump1' | 'high-points'
 * winnerName: display name
 * amount: point value of the trick (used for high-points)
 */
function showCaptureCelebration(kind, winnerName, amount) {
  const ov = $('captureOverlay');
  if (!ov) return;
  const title = $('captureTitle');
  const sub = $('captureSub');
  const emoji = $('captureEmoji');
  const name = winnerName || 'Someone';
  ov.classList.remove('hidden', 'capture-rook', 'capture-one');
  if (kind === 'rook-red2') {
    ov.classList.add('capture-rook');
    if (emoji) emoji.textContent = '🐦💥';
    if (title) title.textContent = 'THE BIRD TAKES RED 2!';
    if (sub) sub.textContent = name + ' steals the 2nd-highest trump';
  } else if (kind === 'high-points') {
    ov.classList.add('capture-rook');
    if (emoji) emoji.textContent = '💰🔥';
    if (title) title.textContent = 'BIG TRICK!';
    if (sub) sub.textContent = name + ' takes ' + (Number(amount) || 0) + ' points!';
  } else {
    ov.classList.add('capture-one');
    if (emoji) emoji.textContent = '👑✨';
    if (title) title.textContent = 'TRUMP 1 CAPTURED!';
    if (sub) sub.textContent = name + ' takes the high 1';
  }
  ov.setAttribute('aria-hidden', 'false');
  try {
    ov.style.animation = 'none';
    ov.offsetHeight;
    ov.style.animation = '';
  } catch (e) {}
  try { playCaptureFanfare(kind === 'rook-red2' ? 'rook-red2' : 'trump1'); } catch (e) {}
  if (captureOverlayTimer) clearTimeout(captureOverlayTimer);
  captureOverlayTimer = setTimeout(() => {
    ov.classList.add('hidden');
    ov.setAttribute('aria-hidden', 'true');
    captureOverlayTimer = null;
    captureCelebrationRunning = false;
    playNextCaptureCelebration();
  }, 2400);
}

function queueCaptureCelebrations(items, winnerName) {
  if (!Array.isArray(items)) items = items ? [items] : [];
  items.forEach(item => {
    const entry = (typeof item === 'string') ? { kind: item } : (item || {});
    if (!entry.kind) return;
    captureCelebrationQueue.push({ kind: entry.kind, winnerName: entry.winnerName || winnerName || 'Player', amount: Number(entry.amount) || 0 });
  });
  playNextCaptureCelebration();
}

function playNextCaptureCelebration() {
  if (captureCelebrationRunning || !captureCelebrationQueue.length) return;
  const next = captureCelebrationQueue.shift();
  captureCelebrationRunning = true;
  showCaptureCelebration(next.kind, next.winnerName, next.amount);
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
function playDealCardSound() {
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
  g.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.05);
}

/** Legacy short deal sound → full shuffle */
function playDealSound() {
  playShuffleSound();
}

/** Shuffle overlay + deal cards into hand one-by-one */
let dealAnimToken = 0;
const SHUFFLE_ANIM_MS = 1600;
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
      <div class="shuffle-deck" aria-hidden="true">
        <div class="shuffle-card sc1"></div>
        <div class="shuffle-card sc2"></div>
        <div class="shuffle-card sc3"></div>
        <div class="shuffle-card sc4"></div>
        <div class="shuffle-card sc5"></div>
      </div>
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
  ov.classList.add('shuffling');
}

function hideShuffleOverlay() {
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
function runDealPresentation(fullHand, onDone) {
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

  showShuffleOverlay();
  try { playShuffleSound(); } catch (e) {}

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
      setTimeout(step, CARD_DEAL_MS);
    };
    step();
  }, SHUFFLE_ANIM_MS);
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
    default: break;
  }
  if (broadcastNet && isHost) {
    try { broadcast({ type: 'sfx', name }); } catch (e) {}
  }
}

function notifyCardPlayed(card) {
  const isRook = card && (card.color === 'rook' || card.id === 'rook');
  const isR2 = card && (typeof isRed2 === 'function' ? isRed2(card) : card.id === 'red-2');
  const name = isRook ? 'rook' : (isR2 ? 'red2' : 'card');
  playSfx(name, { broadcastNet: true });
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

function pulseTurnFlash() {
  try {
    const me = $('slot-me');
    if (me) {
      me.classList.add('is-turn', 'turn-flash-seat');
      const nameEl = me.querySelector('.name');
      if (nameEl) {
        nameEl.classList.remove('turn-name-flash');
        void nameEl.offsetWidth;
        nameEl.classList.add('turn-name-flash');
      }
    }
    const msg = $('messageArea');
    if (msg) {
      msg.classList.remove('turn-msg-flash');
      void msg.offsetWidth;
      msg.classList.add('turn-msg-flash');
    }
    const ltHand = $('ltHand');
    const ltLabel = $('ltHandLabel');
    const theater = $('landscapeTheater');
    if (ltHand) {
      ltHand.classList.remove('lt-turn-flash');
      void ltHand.offsetWidth;
      ltHand.classList.add('lt-turn-flash');
    }
    if (ltLabel) {
      ltLabel.classList.remove('lt-turn-flash-label');
      void ltLabel.offsetWidth;
      ltLabel.classList.add('lt-turn-flash-label');
    }
    if (theater) theater.classList.add('lt-your-turn');
  } catch (e) {}
}

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
function notifyYourTurn() {
  try {
    const key = game
      ? `${game.phase}:${game.currentPlayer}:${(game.trick && game.trick.length) || 0}`
      : String(Date.now());
    const now = Date.now();
    if (window._lastTurnBeepKey === key && now - (window._lastTurnBeepAt || 0) < 2500) {
      pulseTurnFlash();
      return;
    }
    window._lastTurnBeepKey = key;
    window._lastTurnBeepAt = now;
  } catch (e) {}
  try {
    const ctx = ensureAudio();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch (e) {}
  try { playTurnSound(); } catch (e) {}
  // Phone buzz (Android Chrome; many iPhones ignore Vibration API)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
      navigator.vibrate([80, 50, 80, 50, 120]);
    }
  } catch (e) {}
  turnFlashUntil = Date.now() + 2200;
  pulseTurnFlash();
  setTimeout(() => {
    try {
      const me = $('slot-me');
      if (me) me.classList.remove('turn-flash-seat');
      const nameEl = me && me.querySelector('.name');
      if (nameEl) nameEl.classList.remove('turn-name-flash');
      const msg = $('messageArea');
      if (msg) msg.classList.remove('turn-msg-flash');
    } catch (e) {}
  }, 2300);
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


function saveSession() {
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
    el.classList.toggle('occupied', !!p);
    el.classList.toggle('is-me', !!(p && p.id === myPeerId));
    el.classList.toggle('is-bot', !!(p && p.isBot));
    if (p && p.id === myPeerId) mySeat = s;
    if (p) {
      const tag = p.isHost ? 'Host' : (p.isBot ? 'Bot' : (p.id === myPeerId ? 'You' : 'Sat'));
      const face = p.avatar ? '<img class="wait-seat-av" src="' + avatarSrc(p.avatar) + '" alt="">' : '';
      let extra = tag + ' · ' + (s % 2 === 0 ? teamA : teamB);
      if (p.isBot && !isSpectator && !(p.id === myPeerId)) extra = 'Bot · tap to replace (bot moves)';
      el.innerHTML = face
        + '<span class="wait-seat-name">' + escapeHtmlSafe(p.name) + '</span>'
        + '<span class="wait-seat-tag">' + extra + '</span>';
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
  if (shareBtn) shareBtn.textContent = qrOk ? 'Share' : 'Share code';
  if (speak) {
    speak.textContent = qrOk
      ? 'Share this code or QR. Friends tap an open seat to sit.'
      : 'Wi‑Fi table. Read this code out loud. Friends open House of Rooks on their own phone and join with the code.';
  }
  if (hint) {
    hint.textContent = qrOk
      ? 'Same website + this table code. Keep this tab open.'
      : 'QR will not work here — it would send a phone-only link the other person cannot open. Guest: Join with a code → type the 4 letters → Sit down.';
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

const PEER_BROKERS = [
  { host: '0.peerjs.com', port: 443, path: '/', secure: true },
  { host: 'peerjs.92k.de', port: 443, path: '/', secure: true }
];
let horPeerBrokerIndex = 0;

let horForceRelayIce = false;

function horIceConfig(forceRelay) {
  const relay = !!(forceRelay || horForceRelayIce);
  return {
    iceCandidatePoolSize: relay ? 2 : 8,
    iceTransportPolicy: relay ? 'relay' : 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'turn:0.peerjs.com:3478', username: 'peerjs', credential: 'peerjsp' },
      { urls: 'turn:0.peerjs.com:3478?transport=tcp', username: 'peerjs', credential: 'peerjsp' },
      { urls: 'turns:0.peerjs.com:443', username: 'peerjs', credential: 'peerjsp' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:80?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.stunprotocol.org:3478' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ]
  };
}

function peerOptions(broker, forceRelay) {
  const b = broker || PEER_BROKERS[horPeerBrokerIndex % PEER_BROKERS.length] || PEER_BROKERS[0];
  return {
    host: b.host,
    port: b.port,
    path: b.path || '/',
    secure: b.secure !== false,
    debug: 0,
    pingInterval: 4000,
    config: horIceConfig(forceRelay)
  };
}

function horNextBroker() {
  horPeerBrokerIndex = (horPeerBrokerIndex + 1) % PEER_BROKERS.length;
  return PEER_BROKERS[horPeerBrokerIndex];
}

function createRoom() {
  myName = ($('hor-player-name').value || '').trim() || 'Host';
  if (typeof Peer === 'undefined') {
    $('lobbyStatus').textContent = 'PeerJS failed to load. Check your internet connection and refresh.';
    return;
  }
  roomCode = shortCode();
  isHost = true;
  $('lobbyStatus').textContent = 'Creating room…';

  try {
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    const opts = peerOptions();
    horDebugLog('HOST: creating peer on broker ' + opts.host + ' code=' + roomCode);
    peer = new Peer(peerRoomId(roomCode), opts);
  } catch (e) {
    console.error(e);
    $('lobbyStatus').textContent = 'Could not create Peer: ' + e.message;
    return;
  }

  peer.on('open', id => {
    horDebugLog('HOST: peer open, id=' + id + ', room code=' + roomCode);
    myPeerId = id;
    if (window._horHandoffSnapshot) {
      try { finishHostHandoff(id); } catch (e) { console.error(e); }
      return;
    }
    players = [{ id, name: myName, team: 0, isHost: true, isBot: false, seat: 0, bank: loadMyBank() }];
    myIndex = 0;
    beerSeats = pickBeerSeats();
    showWaiting();
    saveSession();
    if ($('lobbyStatus')) $('lobbyStatus').textContent = '';
    if ($('waitingStatus')) {
      $('waitingStatus').textContent = 'Table is live. Friends on the same Wi‑Fi can join with this code.';
    }
    // Give the public broker a moment to actually register the id
    // before guests start connecting — a common PeerJS race.
    try { peer.socket && peer.socket.send && peer.socket.send({ type: 'HEARTBEAT' }); } catch (e) {}
  });


  peer.on('connection', conn => {
    horDebugLog('HOST: incoming connection event, remote peer=' + conn.peer);
    setupConn(conn);
  });

  // The Peer's connection to the signaling server can drop in the
  // background (mobile browsers throttling long-lived sockets, brief
  // network blips) without the Peer object itself being destroyed.
  // PeerJS exposes this via the 'disconnected' event and a matching
  // reconnect() method — without this, the room would silently stop
  // being joinable while the UI still showed the host screen normally.
  peer.on('disconnected', () => {
    console.warn('Host peer disconnected from signaling server, attempting reconnect…');
    horDebugLog('HOST: peer disconnected from signaling server, attempting reconnect…');
    try { peer.reconnect(); } catch (e) {}
  });

  peer.on('error', err => {
    console.error('Peer error:', err);
    horDebugLog('HOST: peer error type=' + (err && err.type) + ' msg=' + (err && err.message));
    if (err.type === 'unavailable-id') {
      roomCode = shortCode();
      try { peer.destroy(); } catch (e) {}
      peer = null;
      // Retry once with new code
      setTimeout(createRoom, 200);
    } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
      const next = horNextBroker();
      $('lobbyStatus').textContent = brokerRetryMessage();
      try { peer.destroy(); } catch (e) {}
      peer = null;
      setTimeout(createRoom, 350);
    } else {
      $('lobbyStatus').textContent = 'Error: ' + (err.type || err.message || 'unknown');
    }
  });
}


function joinRoom() {
  myName = ($('hor-player-name').value || '').trim() || 'Player';
  const code = ($('hor-room-code').value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) return alert('Enter a room code');
  if (phoneLooksOffline()) {
    setJoinStatus(noServiceJoinMessage());
    return;
  }
  if (typeof Peer === 'undefined') {
    setJoinStatus('PeerJS failed to load. Check your internet connection and refresh.');
    return;
  }
  roomCode = code;
  isHost = false;
  joinInProgress = true;
  horForceRelayIce = false;
  setJoinStatus('Connecting to table ' + code + '…');

  try {
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
    peer = new Peer(undefined, peerOptions(null, horForceRelayIce));
  } catch (e) {
    joinInProgress = false;
    setJoinStatus('Could not start multiplayer: ' + e.message);
    return;
  }

  let finished = false;
  let joinTimer = null;
  const finishFailure = (message) => {
    if (finished) return;
    finished = true;
    joinInProgress = false;
    clearTimeout(joinTimer);
    setJoinStatus(message);
  };

  let joinTries = 0;
  const maxJoinTries = 6;
  const tryTimeoutMs = 11000;

  const tryConnect = () => {
    if (finished || !peer) return;
    joinTries += 1;
    const targetId = peerRoomId(roomCode);
    horDebugLog('JOIN: attempt ' + joinTries + '/' + maxJoinTries + ', connecting to targetId=' + targetId);
    setJoinStatus(joinTries >= 3
      ? 'Table found. This hotspot is blocking a direct path — trying a relay…'
      : 'Table found. Linking to the host…');
    let conn;
    try {
      // Close any previous in-flight join so retries don't leave zombie channels.
      if (horJoinConn && horJoinConn !== hostConnection) {
        try { horJoinConn.close(); } catch (e) {}
      }
      // Keep the initial join connection deliberately simple. Once open,
      // setupConn installs the normal game transport.
      conn = peer.connect(targetId, {
        reliable: true,
        serialization: 'json',
        label: 'hor-table',
        metadata: { app: 'hor', v: APP_VERSION }
      });
      horJoinConn = conn;
      hostConnection = conn;
      setupConn(conn);
      // Surface the actual WebRTC state while establishing the first join.
      // This distinguishes signaling success from a DataChannel/ICE failure.
      if (conn.peerConnection) {
        const pc = conn.peerConnection;
        const report = () => {
          if (finished) return;
          const ice = pc.iceConnectionState || 'unknown';
          const cs = pc.connectionState || '';
          if (ice === 'failed' || cs === 'failed') {
            setJoinStatus('Table found, but this network blocked the direct path. Trying another way…');
          } else if (horForceRelayIce || joinTries >= 3) {
            setJoinStatus('Table found. Using a relay so a hotspot can reach the host…');
          } else {
            setJoinStatus('Table found. Linking to the host…');
          }
          horDebugLog('JOIN: ICE state=' + ice + ' pc=' + cs + ' (attempt ' + joinTries + ')');
        };
        try { pc.addEventListener('iceconnectionstatechange', report); } catch(e) {}
        try { pc.addEventListener('connectionstatechange', report); } catch(e) {}
        report();
      }
    } catch (e) {
      finishFailure('Could not connect to table: ' + (e.message || e));
      return;
    }

    conn.on('open', () => {
      horDebugLog('JOIN: data channel open on attempt ' + joinTries + '. Sending join message…');
      if (finished) return;
      finished = true;
      joinInProgress = false;
      clearTimeout(joinTimer);
      const joinMsg = { type: 'join', name: myName, id: myPeerId, spectator: !!isSpectator, bank: loadMyBank(), appVersion: APP_VERSION, reconnect: true };
      if (pendingPreviewJoin) joinMsg.preview = true;
      if (!isSpectator && typeof pendingWelcomeSeat === 'number' && pendingWelcomeSeat >= 0 && pendingWelcomeSeat <= 3) {
        joinMsg.preferredSeat = pendingWelcomeSeat;
      }
      const ok = horNetSendRaw(conn, joinMsg);
      horDebugLog('JOIN: join message send returned ok=' + ok);
      if (!ok) {
        finishFailure('Connection opened but the join message could not be sent.');
        return;
      }
      setJoinStatus('Connected. Waiting for the host…');
    });

    conn.on('error', err => {
      console.error('Join connection error:', err);
      horDebugLog('JOIN: data connection error on attempt ' + joinTries + ': ' + (err && (err.type || err.message)));
      // Don't fail immediately here — let the attempt timeout below decide
      // whether to retry, since a single connection error doesn't always
      // mean the whole join attempt is doomed.
    });

    joinTimer = setTimeout(() => {
      if (finished) return;
      try { conn.close(); } catch (e) {}
      if (joinTries >= maxJoinTries) {
        horDebugLog('JOIN: giving up after ' + joinTries + ' attempts');
        finishFailure('The table was found, but this hotspot never finished the link. Phone hotspots often block phone-to-phone play. Put both phones on the same regular Wi‑Fi, or use cell data on both — not one phone as a hotspot. Keep the host screen open and try the code again.');
        return;
      }
      horDebugLog('JOIN: attempt ' + joinTries + ' timed out, retrying…');
      if (joinTries >= 2 && !horForceRelayIce) {
        horForceRelayIce = true;
        setJoinStatus('Table found. Switching to a relay path for this hotspot…');
        try { if (peer) peer.destroy(); } catch (e) {}
        peer = null;
        setTimeout(() => {
          if (finished) return;
          try {
            peer = new Peer(undefined, peerOptions(null, true));
            peer.on('open', (id) => {
              myPeerId = id;
              setTimeout(() => { try { tryConnect(); } catch (e2) {} }, 400);
            });
            peer.on('error', () => { try { tryConnect(); } catch (e3) {} });
          } catch (e4) {
            setTimeout(tryConnect, 500);
          }
        }, 300);
        return;
      }
      setJoinStatus(joinTries >= 3
        ? 'Still linking through a relay. Hotspots are slow to open this path…'
        : 'Table found. Still linking to the host…');
      setTimeout(tryConnect, 600);
    }, tryTimeoutMs);
  };

  peer.on('open', id => {
    myPeerId = id;
    horDebugLog('JOIN: peer open, my id=' + id);
    // Wait briefly so the host id is listed on the broker and ICE can gather.
    setTimeout(() => { try { tryConnect(); } catch (e) {} }, 700);
  });

  // See the matching comment in createRoom() — the signaling connection can
  // drop silently in the background without the Peer object being destroyed.
  peer.on('disconnected', () => {
    console.warn('Join peer disconnected from signaling server, attempting reconnect…');
    horDebugLog('JOIN: peer disconnected from signaling server, attempting reconnect…');
    try { peer.reconnect(); } catch (e) {}
  });

  peer.on('error', err => {
    console.error('Join Peer error:', err);
    horDebugLog('JOIN: peer error type=' + (err && err.type) + ' msg=' + (err && err.message));
    if (finished) return;
    const type = err && err.type;
    if (type === 'peer-unavailable') {
      if (joinTries < maxJoinTries && !finished) {
        setJoinStatus('Host not listed yet. Waiting and retrying…');
        setTimeout(() => { try { tryConnect(); } catch (e) {} }, 900);
        return;
      }
      finishFailure('That room code is not currently available. Verify the host is still on the table and use the current code.');
    } else if (type === 'network' || type === 'server-error' || type === 'socket-error') {
      const next = horNextBroker();
      setJoinStatus(brokerRetryMessage());
      try { if (peer) peer.destroy(); } catch (e) {}
      peer = null;
      setTimeout(() => { try { joinRoom(); } catch (e2) {} }, 400);
    } else finishFailure('Multiplayer error: ' + (type || err.message || 'unknown error') + (err && err.message ? '' : ''));
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
  let el = document.getElementById('horNetworkToast');
  if (!el) {
    el = document.createElement('div'); el.id = 'horNetworkToast'; el.className = 'hor-network-toast';
    document.body.appendChild(el);
  }
  el.textContent = text; el.classList.add('show');
  clearTimeout(el.__t); el.__t = setTimeout(() => el.classList.remove('show'), 2600);
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
            bank: loadMyBank(),
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
        if (peer && peer.disconnected) peer.reconnect();
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
            settings: { includeRed2, red2Points, targetScore, botDifficulty, layDownWinningCards, experimental: window.horExperimental || {} },
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
            settings: { includeRed2, red2Points, targetScore, botDifficulty, layDownWinningCards, experimental: window.horExperimental || {} },
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
              currentPlayer: game.currentPlayer,
              trick: game.trick,
              ledColor: game.ledColor,
              players: players.map(p => ({ name: p.name, team: p.team, id: p.id, isBot: !!p.isBot, bank: p.bank || 0 })),
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
            settings: { includeRed2, red2Points, targetScore, botDifficulty, layDownWinningCards, experimental: window.horExperimental || {} }
          });
          break;
        }
        if (players.find(p => p.id === data.id)) {
          return;
        }
        players.push({ id: data.id, name: data.name, team: 0, isHost: false, isBot: false, seat: -1, bank: Math.max(0, Math.floor(Number(data.bank) || 0)) });
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
          settings: { includeRed2, red2Points, targetScore, botDifficulty, experimental: window.horExperimental || {} },
        });
        try { conn.send({ type: 'players', players: publicPlayersSnapshot(), beerSeats }); } catch (e) {}
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
      case 'buyBeer':
        if (typeof data.seat === 'number') buyBotBeer(data.seat);
        break;
      case 'claimAllTrumps':
        if (game && game.phase === 'play') hostProcessAllTrumpsClaim(data);
        break;
      case 'declineClaim':
        if (game && game.phase === 'play') hostDeclineClaim(data.player);
        break;
      case 'avatar':
        if (data.id) playerAvatars[data.id] = data.avatar || data.emoji || AVATARS[0];
        broadcast({ type: 'avatar', id: data.id, avatar: data.avatar || data.emoji || AVATARS[0] });
        try { renderUI(); } catch (e) {}
        break;
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
      case 'buyTableMsg':
        (function () {
          const text = String(data.text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
          if (!text) return;
          const connId = conn && conn.peer;
          const seat = players.findIndex(p => p.id === connId || p.id === data.id);
          if (seat < 0) return;
          const cost = tableMsgCost();
          if (bankOfSeat(seat) < cost) {
            try { conn.send({ type: 'message', text: 'Not enough bank for a table message ($' + cost + ').' }); } catch (e) {}
            return;
          }
          setSeatBank(seat, bankOfSeat(seat) - cost);
          const nm = (players[seat] && players[seat].name) || 'Player';
          showTableMsgPopup(nm, text);
          try { updateBankDisplays(); } catch (e) {}
          broadcast({ type: 'tableMsg', name: nm, text, banks: players.map(p => p.bank || 0) });
        })();
        break;
      case 'buyWhisper':
        (function () {
          if (!whisperHumans) return;
          const text = String(data.text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
          if (!text) return;
          const connId = conn && conn.peer;
          const seat = players.findIndex(p => p.id === connId || p.id === data.id);
          const to = data.to;
          if (seat < 0 || typeof to !== 'number' || !players[to] || players[to].isBot) return;
          if (horExpOn('partnerChatAfterNest') && game && game.phase !== 'play' && game.phase !== 'score') {
            try { conn.send({ type: 'message', text: 'Private messages wait until the nest is buried.' }); } catch (e) {}
            return;
          }
          if (players[seat] && players[seat].muted) {
            try { conn.send({ type: 'message', text: 'You are muted at this table.' }); } catch (e) {}
            return;
          }
          const cost = whisperCost();
          if (bankOfSeat(seat) < cost) {
            try { conn.send({ type: 'message', text: 'Not enough bank for a private message ($' + cost + ').' }); } catch (e) {}
            return;
          }
          setSeatBank(seat, bankOfSeat(seat) - cost);
          const nm = (players[seat] && players[seat].name) || 'Player';
          if (seat === myIndex || to === myIndex) showTableMsgPopup(nm + ' (private)', text);
          try { updateBankDisplays(); } catch (e) {}
          broadcast({
            type: 'whisper',
            from: seat,
            to,
            fromId: players[seat] && players[seat].id,
            toId: players[to] && players[to].id,
            name: nm,
            text,
            banks: players.map(p => p.bank || 0)
          });
        })();
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
        if (Array.isArray(data.banks)) applyBanksFromList(data.banks);
        if (data.toId === myPeerId || data.fromId === myPeerId || data.to === myIndex || data.from === myIndex) {
          showTableMsgPopup((data.name || 'Player') + (data.to === myIndex ? ' (private)' : ' → you'), data.text);
        }
        break;
      case 'botBeer':
        if (typeof data.seat === 'number' && players[data.seat]) {
          players[data.seat].buzzUntil = data.buzzUntil;
          if (game && game.players && game.players[data.seat]) game.players[data.seat].buzzUntil = data.buzzUntil;
        }
        if (Array.isArray(data.banks)) applyBanksFromList(data.banks);
        try { animateBeerToSeat(data.seat); } catch (e) {}
        break;
      case 'buyBeer':
        break;
      case 'welcome':
        horDebugLog('CLIENT: welcome received, yourId=' + data.yourId + ', players=' + (data.players ? data.players.length : 0) + ', hostVersion=' + data.hostVersion);
        if (data.hostVersion && data.hostVersion !== APP_VERSION) {
          const s = $('lobbyStatus');
          const weAreStale = horVersionNum(APP_VERSION) < horVersionNum(data.hostVersion);
          if (weAreStale) {
            if (s) s.textContent = 'This device is running an outdated version. Updating automatically…';
            setTimeout(horForceUpdate, 1500);
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
          if (data.settings.targetScore) targetScore = data.settings.targetScore;
          if (typeof data.settings.layDownWinningCards === 'boolean') layDownWinningCards = data.settings.layDownWinningCards;
        }
        // Mid-game reclaim should not yank the player back to the lobby.
        if (!horExpOn('netResyncOnReclaim') || !data.reclaimed || !game || game.phase === 'lobby' || game.phase === 'waiting') {
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
              if (game.phase === 'bidding' && game.currentPlayer === myIndex) showBidUI();
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
        if (Array.isArray(data.nestPreview)) game.nestPreview = data.nestPreview.map(c => ({ ...c }));
        if (Array.isArray(data.hand) && data.hand.length) game.myHand = data.hand.map(c => ({ ...c }));
        if (game.bidder === myIndex || data.peerId === myPeerId) {
          // A discard selection belongs to exactly one hand.  Always start a
          // fresh selection set when a new discard phase begins; otherwise a
          // previous hand's selected card IDs can survive into this hand.
          // On iPhone Safari this can look like 6/6 selected after only a
          // couple of taps, and Confirm Discard then rejects the stale IDs.
          window.selectedForDiscard = new Set();
          showDiscardUI(!!data.showKitty);
          try { renderHand(true); } catch (e) {}
          fitHandToScreen();
        }
        break;
      case 'discardRejected': {
        const needed = (data && data.needed) || (game && game.discardCount) || 5;
        const btn = $('confirmDiscard');
        if (btn) {
          btn.disabled = false;
          btn.textContent = `Confirm Discard (${window.selectedForDiscard?.size || 0}/${needed})`;
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
      case 'message':
        $('messageArea').textContent = data.text;
        break;
      case 'tableMsg':
        if (Array.isArray(data.banks)) applyBanksFromList(data.banks);
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
        if (typeof data.sandbagging === 'boolean') sandbagging = data.sandbagging;
        if (data.nestGoesTo) nestGoesTo = data.nestGoesTo;
        if (data.leadOrder) leadOrder = data.leadOrder;
        if (typeof data.misdealOnNoCounters === 'boolean') misdealOnNoCounters = data.misdealOnNoCounters;
        if (typeof data.screwTheDealer === 'boolean') screwTheDealer = data.screwTheDealer;
        if (typeof data.openWidow === 'boolean') openWidow = data.openWidow;
        if (typeof data.shootMoonEnabled === 'boolean') shootMoonEnabled = data.shootMoonEnabled;
        if (data.botSpeed) botSpeed = data.botSpeed;
        if (typeof data.partnerNeverKill === 'boolean') partnerNeverKill = data.partnerNeverKill;
        if (typeof data.partnerFeedLast === 'boolean') partnerFeedLast = data.partnerFeedLast;
        if (typeof data.dontStealPartnerBid === 'boolean') dontStealPartnerBid = data.dontStealPartnerBid;
        if (typeof data.landscapeBidHints === 'boolean') landscapeBidHints = data.landscapeBidHints;
        if (typeof data.nestLastTrickAnim === 'boolean') nestLastTrickAnim = data.nestLastTrickAnim;
        if (typeof data.layDownWinningCards === 'boolean') layDownWinningCards = data.layDownWinningCards;
        if (typeof data.colorBlindCards === 'boolean') {
          colorBlindCards = data.colorBlindCards;
          document.body.classList.toggle('color-blind-cards', !!colorBlindCards);
        }
        if (data.handSortMode) handSortMode = normalizeHandSortMode(data.handSortMode);
        if (data.timeoutPolicy) timeoutPolicy = data.timeoutPolicy;
        if (typeof data.turnTimeSec === 'number') turnTimeSec = data.turnTimeSec;
        if (data.minBid) minBid = data.minBid;

        if (data.handSize) handSize = data.handSize;
        if (data.nestSizeDefault) nestSizeDefault = data.nestSizeDefault;
        if (data.targetScore) {
          targetScore = data.targetScore;
          const td = $('targetDisplay');
          if (td) td.textContent = String(targetScore);
        }
        if (data.botDifficulty) botDifficulty = data.botDifficulty;
        try { recomputeHandAndNest(); } catch (e) {}
        try { syncOptionsUI(); } catch (e) {}
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
        if (data.summary) {
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
          if (finalScores[0] >= goal || finalScores[1] >= goal) {
            const winner = finalScores[0] > finalScores[1] ? 'Team A'
              : (finalScores[1] > finalScores[0] ? 'Team B' : 'Tie');
            showWinCelebration(winner, [...finalScores]);
          }
        }
        break;
      case 'hostGone':
        alert(data.message || 'Host disconnected. Game ended.');
        try { sessionStorage.removeItem('rookSession'); } catch (e) {}
        location.reload();
        break;
      case 'matchRematch':
        try { hideCelePage(); } catch (e) {}
        break;
      case 'returnWaiting':
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
      startBtn.disabled = players.length !== 4;
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

    const sa = $('opt-specials-anytime');
    if (sa) {
      sa.checked = !!specialsAnytime;
      sa.onchange = () => {
        specialsAnytime = sa.checked;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const bos = $('opt-bid-only');
    if (bos) {
      bos.checked = !!bidOnlyScoring;
      bos.onchange = () => {
        bidOnlyScoring = bos.checked;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const sbag = $('opt-sandbagging');
    if (sbag) {
      sbag.checked = !!sandbagging;
      sbag.onchange = () => {
        sandbagging = !!sbag.checked;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const ng = $('opt-nest-goes-to');
    if (ng) {
      ng.value = nestGoesTo;
      ng.onchange = () => {
        nestGoesTo = ng.value || 'lastTrick';
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const lo = $('opt-lead-order');
    if (lo) {
      lo.value = leadOrder;
      lo.onchange = () => {
        leadOrder = lo.value || 'bidder';
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const mdc = $('opt-misdeal-no-counters');
    if (mdc) {
      mdc.checked = !!misdealOnNoCounters;
      mdc.onchange = () => {
        misdealOnNoCounters = !!mdc.checked;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const std = $('opt-screw-dealer');
    if (std) {
      std.checked = !!screwTheDealer;
      std.onchange = () => {
        screwTheDealer = !!std.checked;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const ow = $('opt-open-widow');
    if (ow) {
      ow.checked = !!openWidow;
      ow.onchange = () => {
        openWidow = !!ow.checked;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
    const stm = $('opt-shoot-moon');
    if (stm) {
      stm.checked = !!shootMoonEnabled;
      stm.onchange = () => {
        shootMoonEnabled = !!stm.checked;
        try { broadcastPlaySettings(); } catch (e) {}
      };
    }
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
    bindCoach('opt-buy-beer', () => buyBeerBots, v => {
      buyBeerBots = v;
      document.body.classList.toggle('buy-beer-on', !!v);
    });
    bindCoach('opt-whisper', () => whisperHumans, v => {
      whisperHumans = v;
      document.body.classList.toggle('whisper-on', !!v);
    });
    bindCoach('opt-avatar-motion', () => window.horAvatarMotion !== false, v => {
      window.horAvatarMotion = v;
      document.body.classList.toggle('no-avatar-motion', !v);
      try { localStorage.setItem('horAvatarMotion', v ? '1' : '0'); } catch (e) {}
    });
    bindCoach('opt-tv-display', () => !!window.horTvDisplay, v => {
      window.horTvDisplay = v;
      document.body.classList.toggle('hor-tv-display', !!v);
      try { localStorage.setItem('horTvDisplay', v ? '1' : '0'); } catch (e) {}
    });
    bindCoach('opt-host-kick-mute', () => !!window.horHostKickMute, v => {
      window.horHostKickMute = v;
      try { localStorage.setItem('horHostKickMute', v ? '1' : '0'); } catch (e) {}
      try { document.querySelectorAll('.hor-kick-mute').forEach(n => { if (!v) n.remove(); }); } catch (e) {}
    });
    const hsm = $('opt-hand-sort');
    if (hsm) {
      hsm.value = normalizeHandSortMode(handSortMode);
      hsm.onchange = () => {
        handSortMode = normalizeHandSortMode(hsm.value);
        persistHandSortMode();
        try { if (game && game.myHand) renderHand(game.phase === 'discard' && game.bidder === myIndex); } catch (e) {}
      };
    }
    const cbc = $('opt-color-blind');
    if (cbc) {
      cbc.checked = !!colorBlindCards;
      cbc.onchange = () => {
        colorBlindCards = cbc.checked;
        try { localStorage.setItem('rookColorBlind', colorBlindCards ? '1' : '0'); } catch (e) {}
        document.body.classList.toggle('color-blind-cards', !!colorBlindCards);
        try { if (game && game.myHand) renderHand(false); } catch (e) {}
      };
    }
    document.body.classList.toggle('color-blind-cards', !!colorBlindCards);

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
    const sc = $('opt-sound-card'); if (sc) { sc.checked = soundCard; sc.onchange = () => { soundCard = sc.checked; }; }
    const st = $('opt-sound-turn'); if (st) { st.checked = soundTurn; st.onchange = () => { soundTurn = st.checked; }; }
    const sr = $('opt-sound-rook'); if (sr) { sr.checked = soundRook; sr.onchange = () => { soundRook = sr.checked; }; }
    const sk = $('opt-sound-tick'); if (sk) { sk.checked = soundTick; sk.onchange = () => { soundTick = sk.checked; }; }
    const avatarGrid = $('avatarGrid');
    if (avatarGrid) {
      avatarGrid.innerHTML = AVATARS.map((id, i) => `<button type="button" class="avatar-choice" data-avatar="${id}" title="${AVATAR_LABELS[id]}"><img src="${avatarSrc(id)}" alt="${AVATAR_LABELS[id]}"><span>${AVATAR_LABELS[id]}</span></button>`).join('');
      avatarGrid.querySelectorAll('.avatar-choice').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-avatar');
          if (!id) return;
          if (myPeerId) playerAvatars[myPeerId] = id;
          const meP = players.find(p => p.id === myPeerId);
          if (meP) meP.avatar = id;
          avatarGrid.querySelectorAll('.avatar-choice').forEach(b => b.classList.toggle('selected', b === btn));
          try { broadcast({ type: 'avatar', id: myPeerId, avatar: id }); } catch (e) {}
          try { renderUI(); } catch (e) {}
        };
      });
      const current = playerAvatars[myPeerId] || (players.find(p => p.id === myPeerId) || {}).avatar || AVATARS[0];
      avatarGrid.querySelectorAll('.avatar-choice').forEach(b => b.classList.toggle('selected', b.getAttribute('data-avatar') === current));
    }

    applyGriffinDefaults({ broadcastChange: false });
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
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  try { syncSoloHostExtrasUI(); } catch (e) {}
  try { syncOptionsUI(); } catch (e) {}
  try { wireRuleOptionControls(); } catch (e) {}
  try { wireTargetScoreUI(); } catch (e) {}
  try { syncTargetScoreUI(); } catch (e) {}
  try { refreshCardBackPickers(); } catch (e) {}
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
  const ts = $('opt-target-score');
  if (ts) {
    ts.value = String(targetScore);
    ts.onchange = () => {
      targetScore = parseInt(ts.value, 10) || 500;
      const td = $('targetDisplay');
      if (td) td.textContent = String(targetScore);
      try { broadcastPlaySettings(); } catch (e) {}
    };
  }
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

function publicPlayersSnapshot() {
  ensurePlayerSeats(players);
  return (players || []).filter(Boolean).map((p) => ({
    id: p.id,
    name: p.name,
    team: typeof p.team === 'number' ? p.team : ((p.seat || 0) % 2),
    isHost: !!p.isHost,
    isBot: !!p.isBot,
    seat: (typeof p.seat === 'number' ? p.seat : -1),
    bank: p.bank || 0,
    avatar: p.avatar || playerAvatars[p.id] || '',
    botStyle: p.botStyle || '',
    isTempBot: !!p.isTempBot
  }));
}

function applyPlayersSnapshot(list) {
  players = ensurePlayerSeats(Array.isArray(list) ? list.map((p) => Object.assign({}, p)) : []);
  players.forEach((p) => {
    if (p && p.id && p.avatar) playerAvatars[p.id] = p.avatar;
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
    fillBtn.textContent = empty > 0 ? `Fill ${empty} empty seat${empty === 1 ? '' : 's'} with bots` : 'Table full';
  }
}

const BOT_PERSONAS = [
  { name: 'Crow', style: 'safe', avatar: 'raven', blurb: 'Folds early. Rarely overbids.' },
  { name: 'Blaze', style: 'aggressive', avatar: 'fox', blurb: 'Pushes bids and leads hot.' },
  { name: 'Nix', style: 'tricky', avatar: 'jackal', blurb: 'Sneaky leads. Hides counters.' },
  { name: 'Titan', style: 'trumpHeavy', avatar: 'badger', blurb: 'Pulls trump early and often.' },
  { name: 'Pike', style: 'pointHungry', avatar: 'cardshark', blurb: 'Hunts every counter on the felt.' },
  { name: 'Drift', style: 'passive', avatar: 'goldfinch', blurb: 'Ducks tricks. Lets others fight.' },
  { name: 'Dice', style: 'randomish', avatar: 'greenie', blurb: 'Chaos seat. Unpredictable plays.' },
  { name: 'Anchor', style: 'partnerFirst', avatar: 'rookling', blurb: 'Feeds partner. Protects the bid.' },
  { name: 'Wager', style: 'bidHappy', avatar: 'bluejay', blurb: 'Loves the auction. Climbs bids.' },
  { name: 'Hollow', style: 'voidMaker', avatar: 'grumpy', blurb: 'Strips a color to ruff later.' },
  { name: 'Ember', style: 'balanced', avatar: 'owl', blurb: 'Steady book. No wild swings.' },
  { name: 'Vex', style: 'tricky', avatar: 'cobra', blurb: 'Baits leads, then snaps trump.' },
  { name: 'Frost', style: 'safe', avatar: 'lynx', blurb: 'Tight defense. Waits you out.' },
  { name: 'Fang', style: 'aggressive', avatar: 'wolf', blurb: 'Takes command of the table.' },
  { name: 'Halo', style: 'partnerFirst', avatar: 'stag', blurb: 'Never kills partner’s winner.' },
  { name: 'Quill', style: 'countSaver', avatar: 'quill', blurb: 'Hides counters until the trick is safe.' },
  { name: 'Bramble', style: 'leadLong', avatar: 'bramble', blurb: 'Leads the long color and stays there.' },
  { name: 'Moss', style: 'safe', avatar: 'moss', blurb: 'Sits still. Only fights fat piles.' },
  { name: 'Emberlyn', style: 'showboat', avatar: 'emberlyn', blurb: 'Flashes high cards just to be seen.' },
  { name: 'Cinder', style: 'rookHunter', avatar: 'cinder', blurb: 'Hunts the Bird and the painted two.' },
  { name: 'Gable', style: 'lastTrick', avatar: 'gable', blurb: 'Saves trump for the last pile.' },
  { name: 'Thistle', style: 'sandbag', avatar: 'thistle', blurb: 'Underbids, then plays tight defense.' },
  { name: 'Marrow', style: 'countSaver', avatar: 'marrow', blurb: 'Won’t feed a counter into a fight.' },
  { name: 'Pebble', style: 'passive', avatar: 'pebble', blurb: 'Ducks every trick it can.' },
  { name: 'Rookery', style: 'trumpHeavy', avatar: 'rookery', blurb: 'Draws trump like it owes them rent.' },
  { name: 'Sable', style: 'tricky', avatar: 'sable', blurb: 'Off-speed leads. Then a snap.' },
  { name: 'Finch', style: 'partnerFirst', avatar: 'finch', blurb: 'Carries partner across the line.' },
  { name: 'Dagger', style: 'aggressive', avatar: 'dagger', blurb: 'Takes the trick. Asks later.' },
  { name: 'Willow', style: 'safe', avatar: 'willow', blurb: 'Low leads. Soft auction.' },
  { name: 'Hearth', style: 'balanced', avatar: 'hearth', blurb: 'Keeps the book honest.' },
  { name: 'Grit', style: 'voidMaker', avatar: 'grit', blurb: 'Strips a suit so it can ruff.' },
  { name: 'Copper', style: 'pointHungry', avatar: 'copper', blurb: 'If it counts, Copper wants it.' },
  { name: 'Moth', style: 'randomish', avatar: 'moth', blurb: 'Flits. No two hands the same.' },
  { name: 'Brandy', style: 'bidHappy', avatar: 'brandy', blurb: 'Opens the auction for sport.' },
  { name: 'Flint', style: 'aggressive', avatar: 'flint', blurb: 'Hard leads. Harder follows.' },
  { name: 'Ivy', style: 'partnerFirst', avatar: 'ivy', blurb: 'Clings to partner’s winners.' },
  { name: 'Shade', style: 'tricky', avatar: 'shade', blurb: 'Hides in mid ranks, then bites.' },
  { name: 'Barrel', style: 'safe', avatar: 'barrel', blurb: 'Heavy seat. Won’t chase thin bids.' },
  { name: 'Spark', style: 'bidHappy', avatar: 'spark', blurb: 'Lights the auction early.' },
  { name: 'Nettle', style: 'voidMaker', avatar: 'nettle', blurb: 'Stings a short color down to zero.' },
  { name: 'Cobalt', style: 'leadLong', avatar: 'cobalt', blurb: 'Pounds the long color all night.' },
  { name: 'Ash', style: 'lastTrick', avatar: 'ash', blurb: 'Waits on the last trick’s nest.' },
  { name: 'Harrier', style: 'rookHunter', avatar: 'harrier', blurb: 'Circles until the Bird drops.' },
];
const STYLE_TITLES = {
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
};
const STYLE_HOWTO = {
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
};
function personaByName(name) {
  return BOT_PERSONAS.find(p => p.name === name) || null;
}
function botHowToHTML(p) {
  if (!p) return '';
  const title = STYLE_TITLES[p.style] || p.style;
  const how = STYLE_HOWTO[p.style] || p.blurb || '';
  return '<b>' + escapeHtmlSafe(p.name) + '</b> · ' + escapeHtmlSafe(title)
    + '<span>' + escapeHtmlSafe(how) + '</span>';
}
function hideBotStyleTip() {
  const tip = $('botStyleTip');
  if (tip) tip.classList.add('hidden');
}
function showBotStyleTip(name, ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  const p = personaByName(name);
  const tip = $('botStyleTip');
  if (!p || !tip) return;
  tip.innerHTML = botHowToHTML(p);
  tip.classList.remove('hidden');
  const x = ev && ev.clientX ? ev.clientX : 24;
  const y = ev && ev.clientY ? ev.clientY : 24;
  tip.style.left = Math.max(8, Math.min(window.innerWidth - 220, x - 20)) + 'px';
  tip.style.top = Math.max(8, y + 12) + 'px';
}
function botNameAttr(p) {
  if (!p || !p.isBot || !p.name) return '';
  return ' data-botname="' + escapeHtmlSafe(p.name) + '"';
}
function applyBotNameAttr(el, p) {
  if (!el) return;
  if (p && p.isBot && p.name) el.setAttribute('data-botname', p.name);
  else el.removeAttribute('data-botname');
}

function availableBotPersonas() {
  const used = new Set((players || []).filter(p => p && p.isBot).map(p => p.name));
  return BOT_PERSONAS.filter(p => !used.has(p.name));
}

function addBot(seat, personaPick) {
  if (!isHost) return;
  if (seatedCount() >= 4) return;
  const target = (typeof seat === 'number' && seat >= 0 && !playerAtSeat(seat)) ? seat : firstEmptySeat();
  if (target < 0) return;
  const pool = availableBotPersonas();
  let persona = null;
  if (personaPick) {
    persona = pool.find(p => p.name === personaPick || p.name === (personaPick && personaPick.name))
      || BOT_PERSONAS.find(p => p.name === personaPick || p.name === (personaPick && personaPick.name));
  }
  if (!persona) persona = pool[Math.floor(Math.random() * pool.length)] || BOT_PERSONAS[botCount() % BOT_PERSONAS.length];
  if ((players || []).some(p => p && p.isBot && p.name === persona.name)) return;
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
    bank: 0,
  });
  const usedAv = new Set((players || []).filter(p => p && p.avatar && p.id !== id).map(p => p.avatar));
  if (usedAv.has(players[players.length - 1].avatar)) {
    const free = AVATARS.find(a => !usedAv.has(a));
    if (free) players[players.length - 1].avatar = free;
  }
  playerAvatars[id] = players[players.length - 1].avatar;
  balanceTeams();
  try { broadcast({ type: 'players', players: publicPlayersSnapshot(), beerSeats }); } catch (e) {}
  updateWaitingUI();
  updateBotButtons();
}

function closeBotPicker() {
  const m = $('botPickerModal');
  if (m) m.classList.add('hidden');
}

function openBotPicker(seat) {
  const m = $('botPickerModal');
  const grid = $('botPickerGrid');
  if (!m || !grid) {
    addBot(seat);
    return;
  }
  const pool = availableBotPersonas();
  if (!pool.length) {
    addBot(seat);
    return;
  }
  grid.innerHTML = pool.map(p =>
    '<button type="button" class="bot-pick" data-bot="' + p.name + '">'
    + '<img src="' + avatarSrc(p.avatar) + '" alt="">'
    + '<b>' + p.name + '</b>'
    + '<i>' + (STYLE_TITLES[p.style] || p.style) + '</i>'
    + '<span>' + (STYLE_HOWTO[p.style] || p.blurb || '') + '</span>'
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
      bank: 0
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






function updateWaitingUI() {
  const list = $('playersList');
  if (list) list.innerHTML = '';
  const teamA = (typeof teamLabel === 'function') ? teamLabel(0) : 'Griffin';
  const teamB = (typeof teamLabel === 'function') ? teamLabel(1) : 'Raven';
  for (let s = 0; s < 4; s++) {
    const el = $('waitSeat' + s);
    if (!el) continue;
    const p = playerAtSeat(s);
    el.classList.toggle('occupied', !!p);
    el.classList.toggle('is-me', !!(p && p.id === myPeerId));
    el.classList.toggle('is-bot', !!(p && p.isBot));
    if (p) {
      const tag = p.isHost ? 'Host' : (p.isBot ? 'Bot' : 'Sat');
      const face = p.avatar ? '<img class="wait-seat-av" src="' + avatarSrc(p.avatar) + '" alt="">' : '';
      const seatTag = (p.isBot && !isHost)
        ? 'Bot · tap to replace'
        : (tag + ' · ' + (s % 2 === 0 ? teamA : teamB));
      el.innerHTML = face
        + '<span class="wait-seat-name"' + botNameAttr(p) + '>' + escapeHtmlSafe(p.name) + '</span>'
        + '<span class="wait-seat-bank' + (p.id === myPeerId ? ' is-mine' : '') + '" data-wait-bank="' + s + '">' + formatBank(p.bank || 0) + '</span>'
        + '<span class="wait-seat-tag">' + seatTag + '</span>';
    } else if (isHost) {
      el.innerHTML = '<span class="wait-seat-name">Open</span>'
        + '<span class="wait-seat-tag">Tap to seat a bot</span>';
    } else {
      el.innerHTML = '<span class="wait-seat-name">Sit</span>'
        + '<span class="wait-seat-tag">Tap to take this chair</span>';
    }
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
    if (players.length >= 4) {
      status.innerHTML = `✅ Table full (${humans} player${humans === 1 ? '' : 's'}${bots ? `, ${bots} bot${bots === 1 ? '' : 's'}` : ''}). Host can start.`;
    } else if (isHost) {
      status.innerHTML = `<b>${players.length}/4</b> seated · ${empty} open`;
    } else {
      status.textContent = `Waiting for host… (${players.length}/4 seats filled)`;
    }
  }
  const startBtn = $('startBtn');
  if (startBtn) {
    if (isHost) {
      startBtn.disabled = players.length !== 4;
      startBtn.classList.remove('hidden');
      startBtn.style.display = '';
      if (players.length === 4) {
        startBtn.textContent = 'Start Game';
      } else {
        startBtn.textContent = `Start Game (${players.length}/4 — need ${empty} more)`;
      }
    } else {
      // Guests never see start
      startBtn.classList.add('hidden');
    }
  }
  const fillHint = $('fillSeatsHint');
  if (fillHint) {
    fillHint.textContent = empty > 0
      ? `Need ${empty} more seat${empty === 1 ? '' : 's'}: invite friends or set Bots to ${bots + empty}.`
      : 'Table is full — start when ready.';
  }
  if (isHost) updateBotButtons();
  try { syncSoloHostExtrasUI(); } catch (e) {}
}



function setLobbyPortraitOrientation() {
  // The lobby/waiting room should always use its portrait presentation.
  // Screen Orientation locking is best-effort because some browsers only
  // allow it in installed/fullscreen contexts; CSS still keeps the lobby
  // visible and portrait-styled when locking is unavailable.
  try {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      const p = screen.orientation.lock('portrait');
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (e) {}
}

function releaseGameOrientationLock() {
  try {
    if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      screen.orientation.unlock();
    }
  } catch (e) {}
}

function showGame() {
  releaseGameOrientationLock();
  hideWelcomeScreen();
  lobby.classList.add('hidden');
  waiting.classList.add('hidden');
  if (game && game.phase && game.phase !== 'score') {
    try { hideCelePage(); } catch (e) {}
  }
  gameScreen.classList.remove('hidden');
  try { document.body.classList.add('in-game'); document.body.classList.remove('at-table'); } catch (e) {}
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
  const body = document.querySelector('#rulesModal .rules-text') || $('rulesModal');
  if (!body) return;
  const total = typeof totalCountersInDeck === 'function' ? totalCountersInDeck() : '—';
  const sheet = `
    <p><b>Hand</b> ${handSize} · <b>Nest</b> ${nestSizeDefault} · <b>Min bid</b> ${minBid} · <b>Play to</b> ${targetScore} · <b>Counters</b> ${total}</p>
    <p><b>Rook</b> ${includeRook ? (rookLowest ? 'lowest trump' : 'highest trump') : 'off'} ·
       <b>1s</b> ${includeOnes ? (onesHigh ? 'high in color (15 pts)' : '15 pts') : 'off'} ·
       <b>Red 2</b> ${includeRed2 ? (red2Points + ' pts') : 'off'} ·
       <b>Special Red 1</b> ${includeRed1 ? 'yes (highest, 30 pts)' : 'no'}</p>
    <p><b>Scoring</b> ${bidOnlyScoring ? 'bid only when made' : (sandbagging ? 'sandbagging on' : 'full counters when made')} ·
       <b>Nest</b> ${nestGoesTo === 'bidder' ? 'to bidding team' : 'to last-trick winner'}</p>
    ${sandbagging ? '<p>Every 10 over the bid is 10 overpoints. At 100 overpoints, deduct 100.</p>' : ''}
    <p>Four seats, partners opposite. Follow color if you can. Gold cards are legal on your turn — long-press a dim card to see why.</p>
    <p class="rules-bots">Bots only use public information — they never see private hands.</p>
  `;
  let box = $('variantRulesBox');
  if (!box && body.classList && body.classList.contains('rules-text')) {
    box = document.createElement('div');
    box.id = 'variantRulesBox';
    body.insertBefore(box, body.firstChild);
  }
  if (box) box.innerHTML = sheet;
}

// ========== Host Game Logic ==========
function playToastClink() {
  try {
    const ctx = ensureAudio && ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const hit = (at, detune) => {
      const n = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      n.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 4200 + detune;
      bp.Q.value = 2.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, at);
      ng.gain.exponentialRampToValueAtTime(0.22, at + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      n.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
      n.start(at); n.stop(at + 0.05);
      [2450, 3120, 4180, 5620, 7340].forEach((hz, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(hz + detune * (0.12 + i * 0.03), at);
        o.frequency.exponentialRampToValueAtTime(hz * 0.97 + detune * 0.08, at + 0.28);
        const peak = 0.07 / (1 + i * 0.55);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(peak, at + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18 + i * 0.05);
        o.connect(g); g.connect(ctx.destination);
        o.start(at); o.stop(at + 0.36);
      });
    };
    hit(now, -80);
    hit(now + 0.07, 140);
  } catch (e) {}
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

function hostStartGame() {
  if (!isHost) return;
  if (tourCardOpen()) {
    afterTourCard(() => hostStartGame());
    return;
  }
  if (seatedCount() !== 4) {
    const need = 4 - seatedCount();
    alert(`Need 4 players at the table (currently ${seatedCount()} seated).\n\nFriends tap an open seat, or tap an empty chair to seat a bot.`);
    return;
  }

  // Seat order is the table: 0 bottom host side, 1 left, 2 partner, 3 right
  packPlayersBySeat();
  players = players.filter(p => p && p.seat >= 0).slice(0, 4);
  players.forEach((p, i) => { p.team = i % 2; });
  broadcast({ type: 'players', players: publicPlayersSnapshot() });

  try { targetScore = readTargetScoreFromUI(); } catch (e) {
    const tsEl = $('opt-target-score');
    if (tsEl) targetScore = parseInt(tsEl.value, 10) || 500;
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
  try {
    (players || []).forEach((p, i) => {
      if (!p) return;
      p.bank = 0;
      if (game && game.players && game.players[i]) game.players[i].bank = 0;
    });
    saveMyBank(0);
    try { updateBankDisplays(); } catch (e) {}
  } catch (e) {}
  handHistory = [];
  recentTricks = [];
  matchTricks = [];
  lastCompletedTrick = null;
  lastCompletedTrickWinner = null;
  try { hideCelePage(); } catch (e) {}

  game = {
    phase: 'deal',
    dealer: 0,
    scores: [0, 0], // team A, team B
    sandbagOverpoints: [0, 0], // accumulated 10-point overage units for each team
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

function showHostGameTools(on) {
  document.querySelectorAll('.host-only').forEach(el => {
    if (el.id === 'btnPerfectDeal') {
      const showExp = on && isHost && isHostOnlyHuman() && experimentalHandOpt;
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
    }
    try { clearTrumpBanners(); } catch (e) {}
    try { updateLandscapeTheater(); } catch (e) {}
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
      wheel.style.transition = 'transform 2.4s cubic-bezier(0.12, 0.7, 0.12, 1)';
      wheel.style.transform = 'rotate(' + target + 'deg)';
    }
    if (resultEl) resultEl.textContent = 'Spinning…';
    setTimeout(() => {
      if (resultEl) resultEl.textContent = value === 0 ? '0% — fair deal' : ('+' + value + '% extra chance');
      setTimeout(() => {
        ov.classList.add('hidden');
        resolve(value);
      }, 650);
    }, 2500);
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

function hostDealNow() {
  recentTricks = [];
  lastCompletedTrick = null;
  lastCompletedTrickWinner = null;
  landscapeLastSummary = null;
  window._ltShowRemaining = false;
  try {
    const endEl = $('ltEndGame');
    if (endEl) { endEl.classList.add('hidden'); endEl.innerHTML = ''; }
  } catch (e) {}
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
  for (let i = 0; i < 4; i++) {
    sortCardsDisplay(game.hands[i]);
  }
  // House rule: misdeal & redeal if any hand has zero counter cards (no
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

  game.currentPlayer = (game.dealer + 1) % 4;
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
      players: players.map(p => ({ name: p.name, team: p.team, id: p.id, isBot: !!p.isBot, bank: p.bank || 0 })),
      dealer: game.dealer,
      nestCount: game.nest.length,
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
    broadcastState();
    // Brief “how bidding works” tip, then open the auction
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
    setTimeout(finishDeal, SHUFFLE_ANIM_MS + (hs * CARD_DEAL_MS) + 200);
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
  if (!game || game.paused) return;
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

  if (game.currentPlayer === myIndex) {
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
function refreshLandscapeFeltBid() {
  const el = $('ltFeltBid');
  if (!el) return;
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  const myTurn = !!(landscape && game && game.phase === 'bidding' && game.currentPlayer === myIndex && !isSpectator);
  if (!myTurn) {
    el.classList.add('hidden');
    return;
  }
  const nextMin = auctionNextMin();
  const ceiling = maxBid();
  if (!_ltBidSuggested || _ltBidSuggested < nextMin || _ltBidSuggested > ceiling) {
    _ltBidSuggested = Math.min(ceiling, Math.max(nextMin, minBid || 70));
  }
  const high = game.highestBid > 0 ? game.highestBid : '—';
  const nameEl = $('ltFeltBidName');
  const metaEl = $('ltFeltBidMeta');
  const valEl = $('ltFeltVal');
  const bidBtn = $('ltFeltBidBtn');
  if (nameEl) nameEl.textContent = (players[myIndex] && players[myIndex].name) || myName || 'You';
  if (metaEl) metaEl.textContent = '';
  if (valEl) {
    valEl.textContent = formatBidAmount(_ltBidSuggested);
    valEl.classList.toggle('is-moon', isShootMoonBid(_ltBidSuggested));
  }
  if (bidBtn) bidBtn.textContent = isShootMoonBid(_ltBidSuggested)
    ? formatBidAmount(_ltBidSuggested)
    : ('Bid ' + _ltBidSuggested);
  el.classList.remove('hidden');
  if (!el._wired) {
    el._wired = true;
    const minus = $('ltFeltMinus');
    const plus = $('ltFeltPlus');
    const pass = $('ltFeltPassBtn');
    if (minus) minus.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const minv = auctionNextMin();
      if (_ltBidSuggested - 5 >= minv) { _ltBidSuggested -= 5; refreshLandscapeFeltBid(); }
    };
    if (plus) plus.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (_ltBidSuggested + 5 <= maxBid()) { _ltBidSuggested += 5; refreshLandscapeFeltBid(); }
    };
    if (bidBtn) bidBtn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      submitBid(_ltBidSuggested);
    };
    if (pass) pass.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      submitBid(0);
    };
  }
}
function syncLandscapeBidBar() {
  try { refreshLandscapeFeltBid(); } catch (e) {}
}
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
  try { syncLandscapeKittyWait(); } catch (e) {}
  try { syncPortraitWaitBanner(); } catch (e) {}
}

function syncPortraitWaitBanner() {
  const el = $('ptWaitBanner');
  if (!el) return;
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  const phase = game && game.phase;
  const waiting = !!(!landscape && game && (phase === 'discard' || phase === 'trump')
    && game.bidder !== myIndex && !isSpectator);
  el.classList.toggle('hidden', !waiting);
  el.classList.toggle('is-discard', !!(waiting && phase === 'discard'));
  el.classList.toggle('is-trump', !!(waiting && phase === 'trump'));
  document.body.classList.toggle('pt-wait-open', waiting);
  if (!waiting) return;
  const plist = (game.players && game.players.length) ? game.players : players;
  const p = plist[game.bidder] || players[game.bidder] || {};
  const name = p.name || ('Player ' + ((game.bidder || 0) + 1));
  const copy = waitBannerCopy(phase, name);
  const k = $('ptWaitKicker');
  const title = $('ptWaitTitle');
  const sub = $('ptWaitSub');
  if (k) k.textContent = copy.kicker;
  if (title) title.textContent = copy.title;
  if (sub) sub.textContent = copy.sub;
}

function syncLandscapeKittyWait() {
  const el = $('ltKittyWait');
  if (!el) return;
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  const phase = game && game.phase;
  const waiting = !!(landscape && game && (phase === 'discard' || phase === 'trump')
    && game.bidder !== myIndex && !isSpectator);
  el.classList.toggle('hidden', !waiting);
  el.classList.toggle('is-discard', !!(waiting && phase === 'discard'));
  el.classList.toggle('is-trump', !!(waiting && phase === 'trump'));
  document.body.classList.toggle('lt-wait-open', waiting);
  if (!waiting) return;
  const plist = (game.players && game.players.length) ? game.players : players;
  const p = plist[game.bidder] || players[game.bidder] || {};
  const name = p.name || ('Player ' + ((game.bidder || 0) + 1));
  const copy = waitBannerCopy(phase, name);
  const kicker = $('ltWaitKicker');
  const title = $('ltKittyWaitTitle');
  const sub = $('ltKittyWaitSub');
  if (kicker) kicker.textContent = copy.kicker;
  if (title) title.textContent = copy.title;
  if (sub) sub.textContent = copy.sub;
}

function showBidUI() {
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  const nextMin = auctionNextMin();
  const ceiling = maxBid() || 180;
  let suggested = Math.min(ceiling, Math.max(nextMin, parseInt(minBid, 10) || 100));
  if (!Number.isFinite(suggested)) suggested = nextMin;
  _ltBidSuggested = suggested;
  const highNum = auctionHigh();
  const high = highNum > 0 ? highNum : '—';
  const bidderName = (players[myIndex] && players[myIndex].name) || myName || 'Player';
  const html = `<div class="felt-bid-name">${bidderName}</div>
      <div class="bid-meta" aria-hidden="true"></div>
      <div class="bid-stepper">
        <button type="button" class="btn" id="bidMinus" aria-label="Lower bid">−5</button>
        <span id="bidValue" class="bid-value${isShootMoonBid(suggested) ? ' is-moon' : ''}">${formatBidAmount(suggested)}</span>
        <button type="button" class="btn" id="bidPlus" aria-label="Raise bid">+5</button>
      </div>
      <div class="bid-buttons">
        <button class="btn primary" id="bidConfirm">${isShootMoonBid(suggested) ? formatBidAmount(suggested) : ('Bid <span id="bidConfirmVal">' + suggested + '</span>')}</button>
        <button class="btn danger" id="bidPassBtn">Pass</button>
      </div>`;
  const dock = $('feltBidDock');
  const panel = $('actionPanel');
  if (!landscape) {
    try { hideActionPanel(); } catch (e) {}
    if (dock) {
      dock.innerHTML = html;
      dock.classList.remove('hidden');
    }
  } else {
    if (dock) { dock.classList.add('hidden'); dock.innerHTML = ''; }
    if (panel) {
      panel.classList.add('hidden');
      panel.innerHTML = '';
    }
    const oldBar = $('ltBidBar');
    if (oldBar) oldBar.classList.add('hidden');
    try { refreshLandscapeFeltBid(); } catch (e) {}
  }
  {
    const valEl = $('bidValue');
    const confBtn = $('bidConfirm');
    const sync = () => {
      if (valEl) {
        valEl.textContent = formatBidAmount(suggested);
        valEl.classList.toggle('is-moon', isShootMoonBid(suggested));
      }
      if (confBtn) {
        if (isShootMoonBid(suggested)) {
          confBtn.textContent = formatBidAmount(suggested);
        } else {
          confBtn.innerHTML = 'Bid <span id="bidConfirmVal">' + suggested + '</span>';
        }
      }
      _ltBidSuggested = suggested;
      try { syncLandscapeBidBar(); } catch (e) {}
    };
    const minus = $('bidMinus');
    const plus = $('bidPlus');
    const conf = $('bidConfirm');
    const pass = $('bidPassBtn');
    if (minus) minus.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (suggested - 5 >= nextMin) { suggested -= 5; sync(); }
    };
    if (plus) plus.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (suggested + 5 <= ceiling) { suggested += 5; sync(); }
    };
    if (conf) conf.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      submitBid(suggested);
    };
    if (pass) pass.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
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


function submitBid(val) {
  let value = val === 0 || val === '0' ? 0 : parseInt(val, 10);
  if (value !== 0 && !Number.isFinite(value)) {
    try { showBidUI(); } catch (e) {}
    const ma = $('messageArea');
    if (ma) ma.textContent = 'Bid did not go through — pick an amount and tap Bid again.';
    return;
  }
  if (isHost) {
    hostProcessBid({ player: myIndex, value, actionId: horNewActionId('bid') });
  } else {
    const sent = horQueueClientAction({ type: 'bid', player: myIndex, value });
    if (!sent) {
      const ma = $('messageArea');
      if (ma) ma.textContent = 'Bid saved — sending when the table reconnects…';
      horBeginClientReconnect();
    }
  }
  hideActionPanel();
  try {
    const bar = $('ltBidBar');
    if (bar) bar.classList.add('hidden');
  } catch (e) {}
}


function hostProcessBid(data) {
  if (!game || game.paused) return;
  if (!data || data.player !== game.currentPlayer) return;
  if (players[data.player] && players[data.player].disconnected) return;
  if (horRememberAction(data)) return;
  if (data.value !== 0) {
    data.value = parseInt(data.value, 10);
    if (!Number.isFinite(data.value)) return;
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
    try { botMaybeTableTalk('pass', { name: pname, prefer: data.player }); } catch (e) {}

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
    if (data.value <= high || data.value > maxBid() || data.value % 5 !== 0) return;
    game.highestBid = data.value;
    game.bid = data.value;
    game.bidder = data.player;
    // House rule: Shoot the Moon — bidding every counter in the deck is an
    // all-or-nothing bid, flagged here and resolved at scoring time.
    game.shotTheMoon = !!(shootMoonEnabled && data.value === maxBid());
    // Note: passCount is count of permanent passes, not reset — passers stay out
    game.bidStatus[data.player] = data.value;
    const bidMsg = game.shotTheMoon
      ? `${pname} is shooting the moon at ${data.value}!`
      : `${pname} bids ${data.value}`;
    const ma = $('messageArea');
    if (ma) ma.textContent = bidMsg;
    broadcast({ type: 'message', text: bidMsg });
    try { playSfx('bid', { broadcastNet: true }); } catch (e) {}
    try { botMaybeTableTalk('bid', { name: pname, prefer: data.player }); } catch (e) {}
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
  try { playSfx('winBid', { broadcastNet: true }); } catch (e) {}
  // Pass-out only applied during the auction — restore full seats for discard/play
  document.querySelectorAll('.player-slot.is-passed, #slot-me.is-passed').forEach(el => {
    el.classList.remove('is-passed');
  });
  // bidder takes nest — keep preview copy for UI
  const nestSize = game.nest.length;
  game.nestPreview = game.nest.map(c => ({ ...c }));
  // House rule: Open Widow — show everyone what was in the nest the moment
  // it's picked up, instead of only the bidder ever seeing it before the
  // final hand-end reveal.
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
  if (game.bidder === myIndex) {
    // Use the same array the host game uses so Rook cannot be dropped
    game.myHand = game.hands[game.bidder].slice();
    window.selectedForDiscard = new Set();
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
    nestPreview: (game.nestPreview || []).map(c => ({ ...c })),
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
  const ov = $('discardOverlay');
  if (ov) {
    ov.classList.add('hidden');
    ov.classList.remove('landscape-discard-overlay');
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '';
  }
  try {
    const handArea = document.querySelector('.hand-area');
    if (handArea) handArea.classList.remove('hidden');
  } catch (e) {}
}

function showDiscardUI(showKitty) {
  const count = game.discardCount || 5;
  if (!game || !game.myHand) return;
  if (!window.selectedForDiscard) window.selectedForDiscard = new Set();

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
    if (isRed1(card)) return 'red1';
    if (isRed2(card)) return 'red2';
    if (card.color === 'rook' || card.id === 'rook') return 'rook';
    return card.color;
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
    if (includeKittyFlash && game.nestPreview && game.nestPreview.length) {
      const kittyCards = game.nestPreview.slice().sort(compareCardsDisplay).map(c => {
        const cls = cardClass(c);
        return `<div class="card-face ${cls} small kitty-flash-card">${cardInnerHTML(c)}</div>`;
      }).join('');
      kittyBlock = `
        <div class="discard-kitty kitty-flashing${landscape ? ' landscape-kitty-banner' : ''}" id="kittyFlash">
          <div class="kitty-label">Kitty added to your hand</div>
          <div class="kitty-cards">${kittyCards}</div>
          <p class="kitty-hint">Pick ${count} cards to discard — kitty is already in this hand</p>
        </div>`;
    }

    // First screen after winning the bid is deliberately KITTY-ONLY.
    // The bidder's existing hand stays completely hidden until the next
    // screen, where the discard picker is rendered.
    if (includeKittyFlash && game.nestPreview && game.nestPreview.length) {
      const kittyCards = game.nestPreview.slice().sort(compareCardsDisplay).map(c => {
        const cls = cardClass(c);
        return `<div class="card-face ${cls} kitty-flash-card">${cardInnerHTML(c)}</div>`;
      }).join('');
      ov.innerHTML = `
        <div class="discard-sheet discard-sheet-kitty-only">
          <div class="discard-kitty kitty-flashing${landscape ? ' landscape-kitty-banner' : ''}" id="kittyFlash">
            <div class="kitty-label">Kitty added to your hand</div>
            <div class="kitty-cards">${kittyCards}</div>
            <p class="kitty-hint">Your full hand will appear next — then pick ${count} cards to discard.</p>
          </div>
        </div>`;
      ov.classList.remove('hidden');
      ov.setAttribute('aria-hidden', 'false');
      return;
    }

    const rows = groups.map(g => {
      const cards = game.myHand.filter(c => groupFor(c) === g.key)
        .sort(compareCardsDisplay);
      if (!cards.length) return '';
      return `<div class="discard-color-row discard-color-${g.key}">
        <div class="discard-color-label">${g.label}</div>
        <div class="discard-color-cards">${cards.map(c => {
          const id = String(c.id);
          const sel = window.selectedForDiscard.has(id) ? 'selected' : '';
          return `<div class="card-face ${cardClass(c)} ${sel} discard-pick" data-id="${id}">${cardInnerHTML(c)}</div>`;
        }).join('')}</div>
      </div>`;
    }).join('');

    ov.innerHTML = `
      <div class="discard-sheet">
        ${kittyBlock}
        <h2 class="discard-title">Select ${count} cards to discard</h2>
        <p class="discard-sub"><span id="discardCountLabel">${nSel}</span> / ${count} selected</p>
        <div class="discard-groups">${rows}</div>
        <div class="discard-actions">
          <button type="button" class="btn primary" id="confirmDiscard" ${nSel !== count ? 'disabled' : ''}>
            Confirm Discard (${nSel}/${count})
          </button>
        </div>
      </div>`;
    ov.classList.remove('hidden');
    ov.setAttribute('aria-hidden', 'false');

    // Size cards to fit viewport
    fitDiscardOverlayCards();

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
      if (window.selectedForDiscard.has(id)) {
        window.selectedForDiscard.delete(id);
        el.classList.remove('selected');
      } else if (window.selectedForDiscard.size < count) {
        window.selectedForDiscard.add(id);
        el.classList.add('selected');
      }
      const n = window.selectedForDiscard.size;
      const lab = $('discardCountLabel');
      if (lab) lab.textContent = String(n);
      const btn = $('confirmDiscard');
      if (btn) {
        btn.textContent = `Confirm Discard (${n}/${count})`;
        btn.disabled = n !== count;
      }
    };

    ov.querySelectorAll('.discard-pick').forEach(el => {
      el.__discardPointerUsed = false;
      el.addEventListener('pointerup', (e) => {
        // Only treat a primary touch/pen/mouse release as a card tap.
        if (e.pointerType && e.pointerType !== 'mouse' && e.button !== 0) return;
        el.__discardPointerUsed = true;
        toggleDiscardCard(el, e);
        // Safari may still synthesize a click; suppress that one click.
        setTimeout(() => { el.__discardPointerUsed = false; }, 450);
      }, { passive: false });
      el.addEventListener('click', (e) => {
        if (el.__discardPointerUsed) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        toggleDiscardCard(el, e);
      });
    });

    const btn = $('confirmDiscard');
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.selectedForDiscard.size !== count) return;
        const ids = Array.from(window.selectedForDiscard).map(String);
        // Prefer host hand as source of truth when host is bidder
        const source = (isHost && game.hands && game.hands[game.bidder])
          ? game.hands[game.bidder]
          : game.myHand;
        const valid = ids.filter(id => source.some(c => String(c.id) === id));
        if (valid.length !== count) {
          const ma = $('messageArea');
          if (ma) ma.textContent = `Select exactly ${count} cards to discard`;
          btn.disabled = false;
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Discarding…';
        submitDiscard(valid);
      };
    }
  };

  const wantKitty = !!(showKitty && game.nestPreview && game.nestPreview.length && !window._discardKittyShown);
  renderOverlay(wantKitty);
  if (wantKitty) {
    window._discardKittyShown = true;
    if (window._discardKittyTimer) {
      try { clearTimeout(window._discardKittyTimer); } catch (e) {}
    }
    // Kitty is a separate first screen. After the reveal, switch to the
    // normal discard picker; the existing hand is not shown before that.
    window._discardKittyTimer = setTimeout(() => {
      window._discardKittyTimer = null;
      if (game && game.phase === 'discard' && game.bidder === myIndex) {
        renderOverlay(false);
      }
    }, isLandscapeNow() ? 2600 : 3200);
  }
}

function fitDiscardOverlayCards() {
  const ov = $('discardOverlay');
  if (!ov || ov.classList.contains('hidden')) return;
  const sheet = ov.querySelector('.discard-sheet');
  const groups = ov.querySelector('.discard-groups');
  if (!sheet || !groups) return;
  const cards = ov.querySelectorAll('.discard-pick');
  if (!cards.length) return;

  const vw = Math.min(window.innerWidth || 360, sheet.clientWidth || 360);
  const vh = window.innerHeight || 640;
  // Reserve title, subtitle, kitty banner, confirm button, safe area
  const kittyH = ov.querySelector('#kittyFlash') ? 78 : 0;
  const usableH = Math.max(160, vh - 190 - kittyH);
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
    const maxH = Math.min(76, Math.max(52, Math.floor((usableH / 3) - 18)));
    if (cardH > maxH) {
      cardH = maxH;
      cardW = Math.max(32, Math.round(cardH * (58 / 84)));
    }
    ov.style.setProperty('--discard-card-w', cardW + 'px');
    ov.style.setProperty('--discard-card-h', cardH + 'px');
    return;
  }
  const groupRows = Math.ceil((ov.querySelectorAll('.discard-color-row').length || 1));
  // Landscape uses a two-column group grid. This gives every card a real
  // card-sized footprint instead of squeezing five color rows into the short
  // phone viewport.
  const maxH = landscape
    ? Math.min(88, Math.floor((usableH / groupRows) * 0.76))
    : Math.min(72, Math.floor((usableH / groupRows) * 0.68));
  let maxInRow = 1;
  ov.querySelectorAll('.discard-color-cards').forEach(row => {
    maxInRow = Math.max(maxInRow, row.children.length);
  });
  const columnWidth = landscape ? Math.max(120, Math.floor((vw - 28) / 2)) : vw;
  const maxW = landscape
    ? Math.min(68, Math.floor((columnWidth - 24) / maxInRow) - 3)
    : Math.min(54, Math.floor((vw - 48) / maxInRow) - 4);
  let cardW = Math.max(30, Math.min(maxW, Math.round(maxH * (58 / 84))));
  let cardH = Math.round(cardW * (84 / 58));
  if (cardH > maxH) {
    cardH = maxH;
    cardW = Math.max(26, Math.round(cardH * (58 / 84)));
  }
  ov.style.setProperty('--discard-card-w', cardW + 'px');
  ov.style.setProperty('--discard-card-h', cardH + 'px');
}


function rejectDiscardLocal(needed, message) {
  const btn = $('confirmDiscard');
  if (btn) {
    btn.disabled = false;
    btn.textContent = `Confirm Discard (${window.selectedForDiscard?.size || 0}/${needed})`;
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
  if (!game || game.phase !== 'discard') return; // already processed
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
}


function showTrumpUI() {
  const landscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
  if (landscape) {
    // The landscape theater is the real UI surface; #app is hidden there.
    try { syncLandscapeTrumpBar(); } catch (e) {}
    const panel = $('actionPanel');
    if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
    return;
  }
  try {
    const bar = $('ltTrumpBar');
    if (bar) bar.classList.add('hidden');
  } catch (e) {}
  const panel = $('actionPanel');
  if (!panel) return;
  panel.classList.remove('hidden');
  let html = `<h3>Choose Trump Color</h3><div class="trump-buttons">`;
  COLORS.forEach(c => {
    html += `<button class="btn trump-btn ${c}" onclick="submitTrump('${c}')">${COLOR_NAMES[c]}</button>`;
  });
  html += `</div>`;
  panel.innerHTML = html;
}

function submitTrump(color) {
  if (isHost) {
    hostProcessTrump({ player: myIndex, color, actionId: horNewActionId('trump') });
  } else {
    const sent = horQueueClientAction({ type: 'trump', player: myIndex, color });
    if (!sent) horBeginClientReconnect();
  }
}


function hostProcessTrump(data) {
  if (!game || game.phase !== 'trump') return;
  if (data.player !== game.bidder) return;
  if (horRememberAction(data)) return;
  game.trump = data.color;
  game.phase = 'play';
  try { hideActionPanel(); } catch (e) {}
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
      hands: game.hands, nest: game.nest, bid: game.bid, bidder: game.bidder,
      trump: game.trump, currentPlayer: game.currentPlayer, trick: game.trick,
      ledColor: game.ledColor, tricksTaken: game.tricksTaken, nestCards: game.nestCards,
      passCount: game.passCount, highestBid: game.highestBid, discardCount: game.discardCount,
      nestDiscardCount: game.nestDiscardCount, targetScore: game.targetScore,
      nestPreview: game.nestPreview, nestRevealCards: game.nestRevealCards, sandbagOverpoints: game.sandbagOverpoints || [0, 0], paused: false,
    })),
    players: players.map(p => ({ ...p })),
    settings: { includeRed2, red2Points, includeRed1, includeOnes, onesHigh, includeRook, rookLowest,
      specialsAnytime, mustTrumpWhenVoid, minBid, targetScore, handSize, nestSizeDefault, ruleVariant,
      botDifficulty, turnTimeSec },
    matchStats: { ...matchStats },
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
  if (s.targetScore) targetScore = s.targetScore;
  if (typeof s.sandbagging === 'boolean') sandbagging = s.sandbagging;
  if (typeof s.includeRed2 === 'boolean') includeRed2 = s.includeRed2;
  if (s.red2Points) red2Points = s.red2Points;
  matchStats = snapshot.matchStats || matchStats;
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
    // Resume current phase prompts
    if (game.phase === 'play') hostPromptPlay();
    else if (game.phase === 'bidding') hostPromptBid();
    else if (game.phase === 'discard') {
      if (game.bidder === myIndex) showDiscardUI();
      else if (players[game.bidder]?.isBot) scheduleBot();
      else hostSendDiscardStart(game.bidder, players[game.bidder] && players[game.bidder].id, false);
    } else if (game.phase === 'trump') {
      if (game.bidder === myIndex) showTrumpUI();
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
      settings: { includeRed2, red2Points, targetScore, botDifficulty, layDownWinningCards }
    });
  } catch (e) {}
  if (!game) return;
  try {
    const idx = players.findIndex(p => p && p.id === playerId);
    sendTo(playerId, Object.assign({}, {
      type: 'state',
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
      currentPlayer: game.currentPlayer,
      trick: game.trick,
      ledColor: game.ledColor,
      players: players.map(p => ({ name: p.name, team: p.team, id: p.id, isBot: !!p.isBot, bank: p.bank || 0, disconnected: !!p.disconnected })),
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
  const keepBank = players[idx].bank || 0;
  players[idx] = {
    id: data.id,
    name: name || players[idx].replacedHumanName || players[idx].name || 'Player',
    team,
    isHost: false,
    isBot: false,
    isTempBot: false,
    disconnected: false,
    bank: Math.max(keepBank, Math.floor(Number(data.bank) || 0))
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
  if (isHost) {
    // Host leaving ends the room for others unless we transfer — keep simple: confirm
    if (!confirm('You are the host. Leaving will end the room for everyone. Continue?')) return;
    try { broadcast({ type: 'error', message: 'Host left the game.' }); } catch (e) {}
    location.reload();
    return;
  }
  if (!confirm('Leave and let a bot take your seat?')) return;
  try {
    if (hostConnection && hostConnection.open) {
      hostConnection.send({ type: 'leaveReplace', playerId: myPeerId, name: myName });
    }
  } catch (e) {}
  setTimeout(() => location.reload(), 300);
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
      if (!mustFollow && isTrumpCard(opp, trump)) return false;
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
    ? 'has all remaining trumps / winning cards'
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
  if (!isHost || !game || game.phase !== 'play') return;
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
  setTimeout(() => {
    if (!game || game.phase !== 'play') return;
    game.claimAnimation = null;
    game.claimAnimating = false;
    game.resolvingTrick = false;
    hostEndHand();
  }, 4000);
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
    el.style.setProperty('--delay', `${0.06 * i}s`);
    el.style.zIndex = String(10 + i);

    layer.appendChild(el);
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
    }, 850);
  }, landMs + 2000);
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
    }, 450);
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
  if (game.currentPlayer === myIndex) {
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
  if (!game || game.phase !== 'play' || myIndex < 0 || isSpectator) return false;
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
  } else if (game.ledColor && card.color !== game.ledColor && !isSpecialCard(card)) {
    // Player failed to follow — mark void for extreme AI
    if (!knownVoids[data.player]) knownVoids[data.player] = {};
    knownVoids[data.player][game.ledColor] = true;
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
    try { creditCapture(winner.player, trickPoints); } catch (e) {}
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
    $('messageArea').textContent = msg;
    broadcast({ type: 'message', text: msg });
    try { playSfx('trick', { broadcastNet: true }); } catch (e) {}
    // Highlight winner card in trick. The trick is broadcast/rendered first so
    // everyone can clearly see the played cards before any celebration appears.
    const pendingCaptureEvents = (() => {
      try {
        const caps = detectSpecialCaptures(game.trick, winner);
        const wName = (players[winner.player] && players[winner.player].name) || 'Player';
        const events = [];
        if (caps && caps.length) {
          caps.forEach(kind => events.push({ kind, winnerName: wName }));
        }
        if (trickPoints >= 30) {
          events.push({ kind: 'high-points', amount: trickPoints, winnerName: wName });
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
    if (pendingCaptureEvents.events.length) {
      setTimeout(() => {
        try {
          queueCaptureCelebrations(pendingCaptureEvents.events, pendingCaptureEvents.winnerName);
          broadcast({ type: 'specialCapture', kinds: pendingCaptureEvents.events, winnerName: pendingCaptureEvents.winnerName });
        } catch (e) {}
      }, 850);
    }

    setTimeout(() => {
      if (!game) return;
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
        try { recordMatchTrick(entry); } catch (e) {}
        try {
          const ov = $('portraitLast3Overlay');
          if (ov && !ov.classList.contains('hidden')) renderPortraitLast3();
        } catch (e) {}
      } catch (e) {}
      game.trick = [];
      game.ledColor = null;
      game.lastTrickWinner = null;
      game.currentPlayer = winner.player;
      game.resolvingTrick = false;
      game.resolvingTrickPoints = 0;
      window._trickCapturing = false;
      window._trickFlightKey = '';
      window._trickTakenRel = -1;
      try { clearTrickFlightLayers(); } catch (e) {}
      try { clearBottomTookMark(); } catch (e) {}
      try { updateLandscapeTheater(); } catch (e) {}
      if (game.hands.every(h => h.length === 0)) {
        hostEndHand();
      } else {
        broadcastState();
        hostPromptPlay();
      }
    }, 2800);
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
  const HOLD_MS = 3200;
  const FADE_MS = 500;
  try {
    let layer = document.getElementById('ghNestAnim');
    if (layer) layer.remove();
    layer = document.createElement('div');
    layer.id = 'ghNestAnim';
    layer.className = 'gh-nest-anim';
    const ptsTxt = pts ? (' · ' + pts + ' pts') : '';
    const n = Math.max(cards.length, 1);
    layer.innerHTML =
      '<div class="gh-nest-banner">' +
        escapeHtmlSafe(winnerName || 'Winner') + ' takes the nest' + ptsTxt +
      '</div>' +
      '<div class="gh-nest-row" style="--nest-count:' + n + '"></div>';
    document.body.appendChild(layer);
    const row = layer.querySelector('.gh-nest-row');
    const avail = Math.min(window.innerWidth * 0.94, 760);
    // Fit every nest card in the available row. Never force a minimum width
    // that can make the final card clip off-screen.
    const gap = window.innerWidth <= 600 ? 2 : 4;
    const cardW = Math.max(18, Math.min(72, Math.floor((avail - gap * Math.max(0, n - 1)) / n)));
    const cardH = Math.round(cardW * (84 / 58));
    if (cards.length) {
      cards.forEach((c, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'gh-nest-card';
        wrap.style.cssText = 'flex:1 1 0;min-width:0;max-width:' + cardW + 'px;animation-delay:' + (i * 0.08) + 's';
        wrap.innerHTML = nestCardMarkup(c);
        const face = wrap.querySelector('.card-face');
        if (face) {
          face.style.cssText = 'width:100%;height:auto;min-width:0;min-height:0;aspect-ratio:58/84;max-width:100%';
        }
        row.appendChild(wrap);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'gh-nest-empty';
      empty.textContent = 'Nest cards unavailable';
      row.appendChild(empty);
    }
    setTimeout(() => { try { layer.classList.add('out'); } catch (e) {} }, HOLD_MS);
    setTimeout(() => { try { layer.remove(); } catch (e) {} }, HOLD_MS + FADE_MS);
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
      creditCapture(nestSeat, nestPtsShown);
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
  let sandbagPenalty = 0;
  let sandbagOverAdded = 0;
  let sandbagDeduction = 0;
  if (!Array.isArray(game.sandbagOverpoints) || game.sandbagOverpoints.length !== 2) {
    game.sandbagOverpoints = [0, 0];
  }
  // Scoring: set → −bid. Made → full counters, bid-only, or optional sandbagging.
  // Every complete 10 points over bid becomes 10 overpoints. At 100 accumulated
  // overpoints, deduct 100 from that team's total score and carry the remainder.
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
    } else if (sandbagging && pts > bid) {
      sandbagOverAdded = Math.floor((pts - bid) / 10) * 10;
      if (sandbagOverAdded) {
        game.sandbagOverpoints[team] += sandbagOverAdded;
        sandbagPenalty = sandbagOverAdded;
      }
      const wholePenalties = Math.floor(game.sandbagOverpoints[team] / 100);
      if (wholePenalties > 0) {
        sandbagDeduction = wholePenalties * 100;
        game.sandbagOverpoints[team] %= 100;
      }
    }
    const finalDelta = delta - (sandbagDeduction || 0);
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

  game.phase = 'score';
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
    sandbagPenalty: sandbagPenalty || 0,
    sandbagOverAdded: sandbagOverAdded || 0,
    sandbagDeduction: sandbagDeduction || 0,
    sandbagOverpoints: (game.sandbagOverpoints || [0, 0]).slice(),
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

  const finishToScore = () => {
    broadcast({ type: 'handResult', summary, history: handHistory, matchTricks: matchTricks || [] });
    broadcastState();
    showScoreModal(summary);
    const goal = game.targetScore || targetScore || 300;
    if (game.scores[0] >= goal || game.scores[1] >= goal) {
      const winner = game.scores[0] > game.scores[1] ? 'Team A' : (game.scores[1] > game.scores[0] ? 'Team B' : 'Tie');
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
    return '<div class="' + cls + '">'
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
    if (w < 20) w = Math.max(80, Math.floor(((modal && modal.clientWidth) || window.innerWidth) * 0.42));
    if (h < 40) h = Math.max(90, Math.floor(modalH * 0.28) - 40);
    const gap = n >= 10 ? 2 : (n >= 7 ? 3 : 4);
    let best = { cols: Math.min(3, n), rows: Math.ceil(n / Math.min(3, n)), area: -1, cw: 20, ch: 29 };
    const maxCols = Math.min(n, 7);
    for (let cols = 1; cols <= maxCols; cols++) {
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

function showStatsModal() {
  const modal = $('statsModal');
  const body = $('statsBody');
  if (!modal || !body) return;
  const avg = matchStats.bidCount ? Math.round(matchStats.bidSum / matchStats.bidCount) : 0;
  body.innerHTML = `
    <div class="stats-grid">
      <div><b>Hands played</b><br>${matchStats.hands || 0}</div>
      <div><b>High bid</b><br>${matchStats.highBid || 0}</div>
      <div><b>Avg bid</b><br>${avg}</div>
      <div><b>Team A made / set</b><br>${matchStats.madeA || 0} / ${matchStats.setsA || 0}</div>
      <div><b>Team B made / set</b><br>${matchStats.madeB || 0} / ${matchStats.setsB || 0}</div>
    </div>
  `;
  modal.classList.remove('hidden');
}

function wireScoreModalActions(summary) {
  const modal = $('scoreModal');
  if (!modal || !summary) return;
  const goal = game?.targetScore || targetScore || 300;
  const gameOver = summary.scores[0] >= goal || summary.scores[1] >= goal;
  const revealBtn = $('scoreModalRevealHands');
  const last3Btn = $('scoreModalLast3');
  const histBtn = $('scoreModalHistory');
  const nextBtn = $('scoreModalNext');

  if (revealBtn) {
    const hasReveal = Array.isArray(summary.claimRevealHands) && summary.claimRevealHands.some(h => Array.isArray(h.cards));
    revealBtn.classList.toggle('hidden', !hasReveal);
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

  // Nest display is rebuilt from the immutable hand-result snapshot only.
  // Do not read game.nestCards here: those cards are also moved into tricks.
  const nest = Array.isArray(summary.nestCards) && summary.nestCards.length
    ? summary.nestCards.map(c => ({ ...c }))
    : ((game && Array.isArray(game.nestRevealCards) && game.nestRevealCards.length)
        ? game.nestRevealCards.map(c => ({ ...c }))
        : ((game && Array.isArray(game.nestCards) && game.nestCards.length)
            ? game.nestCards.map(c => ({ ...c })) : []));
  const nestWinner = summary.nestWinnerName || 'Winner';
  const nestPts = Number(summary.nestPts || 0);
  const nestMarkup = `
      <section class="scoreboard-nest-final" aria-label="Nest cards">
        <div class="scoreboard-nest-final-title">Nest — ${nestWinner}${nestPts ? ` · ${nestPts} pts` : ''}</div>
        <div class="scoreboard-nest-final-cards">
          ${nest.length ? nest.map(c => {
            const html = typeof nestCardMarkup === 'function' ? nestCardMarkup(c) : '';
            return `<div class="nest-final-card">${html}</div>`;
          }).join('') : '<div class="nest-final-empty">No nest cards recorded</div>'}
        </div>
      </section>`;
  body.innerHTML = `
    <div class="scoreboard ${summary.made ? 'made-hand' : 'set-hand'}">
      <div class="score-banner ${summary.made ? 'banner-made' : 'banner-set'}">${summary.made ? '✅ BID MADE!' : '❌ SET!'}</div>
      <div class="scoreboard-row">
        <div class="scoreboard-team ${summary.scores[0] >= summary.scores[1] ? 'leading' : ''}">
          <div class="sb-label">Team A</div>
          <div class="sb-total">${summary.scores[0]}</div>
          <div class="sb-delta">${da >= 0 ? '+' : ''}${da} this hand</div>
        </div>
        <div class="scoreboard-vs">vs</div>
        <div class="scoreboard-team ${summary.scores[1] >= summary.scores[0] ? 'leading' : ''}">
          <div class="sb-label">Team B</div>
          <div class="sb-total">${summary.scores[1]}</div>
          <div class="sb-delta">${db >= 0 ? '+' : ''}${db} this hand</div>
        </div>
      </div>
      <div class="scoreboard-goal">First to <b>${goal}</b></div>
      ${nestMarkup}
      <div class="scoreboard-detail">
        <div><b>Bid:</b> ${formatBidAmount(summary.bid)} by Team ${teamName} — ${summary.made ? '✅ Made' : '❌ Set'}</div>
        <div><b>Trump:</b> ${COLOR_NAMES[summary.trump] || summary.trump || '—'}</div>
        <div><b>Counters taken:</b> A ${summary.pointsA} · B ${summary.pointsB}
          · total ${summary.pointsA + summary.pointsB} / ${typeof totalCountersInDeck === 'function' ? totalCountersInDeck() : '—'}</div>
        <div><b>Hands played:</b> ${handHistory.length || 1}</div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  wireScoreModalActions(summary);
}



function showWinCelebration(winner, scores) {
  try { clearAllBuzz(); } catch (e) {}
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
  try { clearTableForShuffle(); } catch (e) {}
  if (game) game.dealer = (game.dealer + 1) % 4;
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
    sandbagOverpoints: game.sandbagOverpoints || [0, 0],
    bid: game.bid,
    highestBid: Number.isFinite(Number(game.highestBid)) ? game.highestBid : auctionHigh(),
    minBid: minBid,
    passCount: game.passCount || 0,
    bidder: game.bidder,
    trump: game.trump,
    currentPlayer: game.currentPlayer,
    trick: game.trick,
    ledColor: game.ledColor,
    players: players.map(p => ({ name: p.name, team: p.team, id: p.id, isBot: !!p.isBot, bank: p.bank || 0 })),
    dealer: game.dealer,
    nestCount: game.nest.length,
    handsCount: game.hands.map(h => h.length),
    targetScore: game.targetScore || targetScore,
    lastTrickWinner: (game.lastTrickWinner != null ? game.lastTrickWinner : null),
    resolvingTrick: !!game.resolvingTrick,
    paused: !!game.paused,
    bidStatus: game.bidStatus || [null, null, null, null],
    discardCount: game.discardCount || 0,
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
    clearTimeout(window._bottomTrickWinnerNoticeTimer);
    window._bottomTrickWinnerNoticeTimer = setTimeout(() => {
      try { el.classList.remove('btwn-show'); } catch (e) {}
    }, 2200);
  } catch (e) { console.error('bottom trick winner notice', e); }
}

function applyState(data) {
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
    sandbagOverpoints: Array.isArray(data.sandbagOverpoints) ? data.sandbagOverpoints : (game.sandbagOverpoints || [0, 0]),
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
    currentPlayer: data.currentPlayer,
    trick: data.trick || [],
    ledColor: data.ledColor,
    players: data.players,
    dealer: data.dealer,
    handsCount: data.handsCount,
    targetScore: data.targetScore || game.targetScore || targetScore,
    lastTrickWinner: (data.lastTrickWinner != null ? data.lastTrickWinner : null),
    resolvingTrick: !!data.resolvingTrick,
    paused: !!data.paused,
    bidStatus: data.bidStatus || game.bidStatus || [null, null, null, null],
    discardCount: data.discardCount != null ? data.discardCount : (game.discardCount || 0),
    handPoints: data.handPoints || game.handPoints || [0, 0],
    trumpClaimPlayer: data.trumpClaimPlayer != null ? data.trumpClaimPlayer : null,
    revealedHands: null,
    claimDeclined: !!data.claimDeclined,
    claimAnimation: data.claimAnimation || null,
    claimAnimating: !!data.claimAnimating,
    resolvingTrickPoints: Number(data.resolvingTrickPoints || 0),
    nestRevealCards: Array.isArray(data.nestRevealCards) ? data.nestRevealCards.map(c => ({ ...c })) : (game.nestRevealCards || []),
  });
  if (Array.isArray(data.players)) {
    // Public state is authoritative about table order. Keep the local
    // human index synchronized by stable peer id; this is especially
    // important for the host's partner at seat 2.
    if (!isSpectator && myPeerId) {
      const stateMyIndex = data.players.findIndex(p => p && p.id === myPeerId);
      if (stateMyIndex >= 0) myIndex = stateMyIndex;
    }
    data.players.forEach((sp, i) => {
      if (typeof sp.bank !== 'number') return;
      if (players[i] && players[i].id === sp.id) players[i].bank = sp.bank;
      else {
        const gp = players.find(p => p && p.id === sp.id);
        if (gp) gp.bank = sp.bank;
      }
    });
    try { updateBankDisplays(); } catch (e) {}
  }
  if (data.recentTricks) recentTricks = data.recentTricks;
  if (data.matchTricks) matchTricks = data.matchTricks;
  if (data.targetScore) targetScore = data.targetScore;
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
  const other = bidderTeam === 0 ? ptsB : ptsA;
  const need = Math.max(0, bid - made);
  const label = (typeof teamLabel === 'function')
    ? teamLabel
    : (i) => (i === 1 ? 'Raven' : 'Griffin');
  const us = label(bidderTeam);
  const them = label(1 - bidderTeam);
  const tricksDone = Array.isArray(recentTricks) ? recentTricks.length : 0;
  const trickBit = tricksDone >= 3 ? ` · trick ${tricksDone}` : '';
  el.classList.remove('hidden', 'made', 'short');
  let line;
  if (phase === 'discard' || phase === 'trump') {
    line = `${us} bid ${bid} · need ${need} more`;
  } else if (need === 0) {
    el.classList.add('made');
    line = `${us} has it — ${made} / ${bid}${trickBit} · ${them} ${other}`;
  } else {
    el.classList.add('short');
    line = `${us} ${made} / ${bid} — need ${need} more${trickBit} · ${them} ${other}`;
  }
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
    el.classList.remove('trump-stamp-anim');
    el.textContent = '';
    delete el.dataset.trumpStamped;
    try {
      el.querySelectorAll('.trump-stamp-burst').forEach((n) => n.remove());
    } catch (e) {}
  });
  const tb = typeof $ === 'function' ? $('trumpBadge') : document.getElementById('trumpBadge');
  if (tb) tb.classList.add('hidden');
}

// ========== Trump stamp FX ==========
function playTrumpStampFx(el) {
  if (!el) return;
  // Restart the CSS animation even if it's already mid-play.
  el.classList.remove('trump-stamp-anim');
  // eslint-disable-next-line no-unused-expressions
  void el.offsetWidth; // force reflow so the class re-triggers
  el.classList.add('trump-stamp-anim');

  // Little impact ring/dust burst at the moment the "stamp" lands.
  const burst = document.createElement('span');
  burst.className = 'trump-stamp-burst';
  el.appendChild(burst);
  setTimeout(() => burst.remove(), 1000);

  el.addEventListener('animationend', function onEnd(ev) {
    if (ev.animationName === 'trumpStampSlam') {
      el.classList.remove('trump-stamp-anim');
      el.removeEventListener('animationend', onEnd);
    }
  });
}

// ========== Rendering ==========
function renderUI() {
  if (!game) return;
  if (horExpOn('renderOptimization')) {
    const handIds = (game.myHand || []).map(c => c && c.id).join(',');
    const trickIds = ((game.trick && game.trick.cards) || []).map(c => (c && (c.id || (c.card && c.card.id))) || '').join(',');
    const sig = [game.phase, game.currentPlayer, game.bidder, game.trump, game.bid, (game.scores||[]).join('/'), handIds, trickIds, myIndex, game.paused ? 1 : 0].join('|');
    const now = Date.now();
    if (sig === window.__horUiSig && now - (window.__horUiAt || 0) < 80) return;
    window.__horUiSig = sig;
    window.__horUiAt = now;
  }
  if ($('scoreA')) $('scoreA').textContent = game.scores[0];
  if ($('scoreB')) $('scoreB').textContent = game.scores[1];
  if ($('targetDisplay')) $('targetDisplay').textContent = String(game.targetScore || targetScore || 500);
  const sandbagScore = $('sandbagScore');
  const sandbagTotals = game.sandbagOverpoints || [0, 0];
  if (sandbagScore) {
    sandbagScore.classList.toggle('hidden', !sandbagging);
    const sa = $('sandbagA'), sb = $('sandbagB');
    if (sa) sa.textContent = Number(sandbagTotals[0] || 0);
    if (sb) sb.textContent = Number(sandbagTotals[1] || 0);
  }
  const ltA = $('ltScoreA'), ltB = $('ltScoreB'), ltT = $('ltTarget');
  if (ltA) ltA.textContent = game.scores[0];
  if (ltB) ltB.textContent = game.scores[1];
  if (ltT) ltT.textContent = String(game.targetScore || targetScore || 500);
  const ltSand = $('ltSandbagScore');
  const sb = game.sandbagOverpoints || [0, 0];
  if (ltSand) {
    ltSand.classList.toggle('hidden', !sandbagging);
    const sa = $('ltSandA'), sbEl = $('ltSandB');
    if (sa) sa.textContent = Number(sb[0] || 0);
    if (sbEl) sbEl.textContent = Number(sb[1] || 0);
  }
  if ($('phaseLabel')) $('phaseLabel').textContent = {
    dealing: 'Dealing',
    bidding: 'Bidding',
    discard: 'Discard',
    trump: 'Choose Trump',
    play: 'Playing',
    score: 'Hand Score'
  }[game.phase] || game.phase;

  // Color stamp is only for an in-progress hand. Hide it once the round
  // is scored (and during deal/bid) so the previous trump does not linger
  // into the next hand's shuffle / bidding UI.
  const showTrumpStamp = !!(game.trump && (game.phase === 'play' || game.phase === 'trump'));
  if (showTrumpStamp) {
    if ($('trumpDisplay')) {
      $('trumpDisplay').textContent = `Trump: ${COLOR_NAMES[game.trump] || game.trump}`;
      $('trumpDisplay').style.color = game.trump === 'yellow' ? '#f9a825' : (game.trump === 'green' ? '#81c784' : game.trump);
    }
    const tb = $('trumpBadge');
    if (tb) {
      tb.textContent = `Trump: ${COLOR_NAMES[game.trump]}`;
      tb.className = 'felt-badge trump-' + game.trump;
      tb.classList.remove('hidden');
    }
    const stamp = 'TRUMP  ·  ' + String(COLOR_NAMES[game.trump] || game.trump).toUpperCase();
    // NOTE: renderUI() runs very frequently (turn-flash re-application, network
    // updates, etc). Rebuilding className on every call would clobber the
    // 'trump-stamp-anim' class mid-animation before the browser ever paints
    // it, so we only touch the specific classes/attrs that actually need to
    // change instead of overwriting className wholesale.
    ['trumpBanner', 'ltTrumpStamp'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      const isNewStamp = el.dataset.trumpStamped !== game.trump;
      el.textContent = stamp;
      el.classList.remove('hidden');
      COLORS.forEach((c) => el.classList.remove('trump-' + c));
      el.classList.add('trump-banner', 'trump-' + game.trump);
      if (isNewStamp) {
        el.dataset.trumpStamped = game.trump;
        playTrumpStampFx(el);
      }
    });
  } else {
    if ($('trumpDisplay')) $('trumpDisplay').textContent = game.bid ? `Bid: ${formatBidAmount(game.bid, { short: true })}` : '';
    const tb = $('trumpBadge');
    if (tb) tb.classList.add('hidden');
    ['trumpBanner', 'ltTrumpStamp'].forEach((id) => {
      const el = $(id);
      if (el) {
        el.classList.add('hidden');
        delete el.dataset.trumpStamped;
      }
    });
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

  const ptsBar = $('trickPtsBar');
  if (ptsBar) {
    const tlen = (game.trick && game.trick.length) || 0;
    if (game.phase === 'play' && tlen > 0) {
      let pts = 0;
      try { pts = (typeof trickPointsSoFar === 'function') ? trickPointsSoFar() : 0; } catch (e) { pts = 0; }
      if (game.resolvingTrick && Number(game.resolvingTrickPoints) >= 0) {
        pts = Number(game.resolvingTrickPoints) || pts;
      }
      const leadName = (trickLeadIdx >= 0 && game.players && game.players[trickLeadIdx] && game.players[trickLeadIdx].name)
        ? game.players[trickLeadIdx].name
        : '';
      ptsBar.textContent = pts + ' pts' + (leadName ? ' · ' + leadName + ' leading' : '');
      ptsBar.classList.remove('hidden');
    } else {
      ptsBar.textContent = '';
      ptsBar.classList.add('hidden');
    }
  }

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
          nameEl.innerHTML = `<span class="player-name-text">${playerName}</span>`;
        } else {
          nameEl.innerHTML = `<span class="seat-avatar">${avatarHTML(av)}</span> <span class="player-name-text">${playerName}</span>`;
        }
        applyBotNameAttr(nameEl, game.players[idx]);
      }
      const cc = el.querySelector('.cards-count');
      if (cc) cc.textContent = '';
      // Bid / pass status
      let bb = el.querySelector('.bid-badge');
      if (!bb) {
        bb = document.createElement('div');
        bb.className = 'bid-badge';
        el.appendChild(bb);
      }
      if (game.phase === 'bidding' && game.bidStatus) {
        const st = game.bidStatus[idx];
        if (st === 'pass') {
          bb.textContent = 'PASS';
          bb.className = 'bid-badge bid-pass';
          bb.classList.remove('hidden');
        } else if (typeof st === 'number' && st > 0) {
          bb.textContent = isShootMoonBid(st) ? formatBidAmount(st, { short: true }) : ('BID ' + st);
          bb.className = 'bid-badge bid-value-badge' + (game.bidder === idx ? ' bid-high' : '') + (isShootMoonBid(st) ? ' bid-moon' : '');
          bb.classList.remove('hidden');
        } else {
          bb.textContent = '';
          bb.classList.add('hidden');
        }
      } else if (game.phase !== 'bidding' && game.bidder === idx && game.bid) {
        bb.textContent = isShootMoonBid(game.bid) ? formatBidAmount(game.bid, { short: true }) : ('BID ' + game.bid);
        bb.className = 'bid-badge bid-value-badge bid-high' + (isShootMoonBid(game.bid) ? ' bid-moon' : '');
        bb.classList.remove('hidden');
      } else {
        bb.textContent = '';
        bb.classList.add('hidden');
      }
    }
    el.classList.toggle('is-turn', idx === whoseTurn && !game.resolvingTrick);
    el.classList.toggle('is-trick-lead', idx === trickLeadIdx);
    el.classList.toggle('is-hand-winner', !!(game.claimAnimating && game.trumpClaimPlayer === idx));
    let leadTag = el.querySelector(':scope > .seat-lead-tag');
    if (!leadTag) {
      leadTag = document.createElement('div');
      leadTag.className = 'seat-lead-tag';
      el.appendChild(leadTag);
    }
    if (idx === trickLeadIdx) {
      leadTag.textContent = 'LEADING';
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
    const meNameEl = meSlot.querySelector('.name');
    if (meNameEl) {
      const meP = (game.players && game.players[seatBase])
        || (players && players[seatBase])
        || null;
      const meName = (meP && meP.name) || myName || 'Player';
      const meId = (meP && meP.id) || myPeerId;
      const av = playerAvatars[meId] || (meP && meP.avatar) || AVATARS[seatBase % AVATARS.length];
      meNameEl.innerHTML = `<span class="seat-avatar">${avatarHTML(av)}</span> <span class="player-name-text">${escapeHtmlSafe(meName)}</span>`;
      applyBotNameAttr(meNameEl, meP);
      try { updateBankDisplays(); } catch (e) {}
      // Re-apply flash after name HTML rewrite so animation is not wiped
      if (turnFlashUntil && Date.now() < turnFlashUntil) {
        meNameEl.classList.add('turn-name-flash');
        meSlot.classList.add('turn-flash-seat');
      }
    }
    meSlot.classList.toggle('is-turn', seatBase === whoseTurn && !game.resolvingTrick);
    meSlot.classList.toggle('is-trick-lead', seatBase === trickLeadIdx);
    meSlot.classList.toggle('is-hand-winner', !!(game.claimAnimating && game.trumpClaimPlayer === seatBase));
    let meLead = meSlot.querySelector(':scope > .seat-lead-tag');
    if (!meLead) {
      meLead = document.createElement('div');
      meLead.className = 'seat-lead-tag';
      meSlot.appendChild(meLead);
    }
    if (seatBase === trickLeadIdx) {
      meLead.textContent = 'LEADING';
      meLead.classList.remove('hidden');
    } else {
      meLead.textContent = '';
      meLead.classList.add('hidden');
    }
    if (turnFlashUntil && Date.now() < turnFlashUntil) {
      meSlot.classList.add('turn-flash-seat');
    }
    meSlot.classList.toggle('is-passed', !!(game.phase === 'bidding' && game.bidStatus && game.bidStatus[seatBase] === 'pass'));
    let bb = meSlot.querySelector('.bid-badge');
    if (!bb) {
      bb = document.createElement('div');
      bb.className = 'bid-badge';
      meSlot.appendChild(bb);
    }
    if (game.phase === 'bidding' && game.bidStatus) {
      const st = game.bidStatus[seatBase];
      if (st === 'pass') {
        bb.textContent = 'PASS';
        bb.className = 'bid-badge bid-pass';
        bb.classList.remove('hidden');
      } else if (typeof st === 'number' && st > 0) {
        bb.textContent = isShootMoonBid(st) ? formatBidAmount(st, { short: true }) : ('BID ' + st);
        bb.className = 'bid-badge bid-value-badge' + (game.bidder === seatBase ? ' bid-high' : '') + (isShootMoonBid(st) ? ' bid-moon' : '');
        bb.classList.remove('hidden');
      } else {
        bb.textContent = '';
        bb.classList.add('hidden');
      }
    } else if (game.phase !== 'bidding' && game.bidder === seatBase && game.bid) {
      bb.textContent = isShootMoonBid(game.bid) ? formatBidAmount(game.bid, { short: true }) : ('BID ' + game.bid);
      bb.className = 'bid-badge bid-value-badge bid-high' + (isShootMoonBid(game.bid) ? ' bid-moon' : '');
      bb.classList.remove('hidden');
    } else {
      bb.textContent = '';
      bb.classList.add('hidden');
    }
  }


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
    trickArea.innerHTML = '<div class="trick-empty">Trick</div>';
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
      const style = `--sx:${s.x}px;--sy:${s.y}px;--srot:${s.rot}deg;z-index:${i + 1};--card-i:${i};`;
      const who = (game.players && game.players[t.player] && game.players[t.player].name)
        || (players[t.player] && players[t.player].name)
        || ('P' + (t.player + 1));
      return `<div class="trick-card-wrap ${isLatest ? 'latest' : ''} ${isWinner ? 'winner' : ''} ${isRookPulse ? 'rook-play-pulse' : ''}" style="${style}">
        ${renderCardHTML(t.card, false)}
        <div class="trick-card-name">${escapeHtmlSafe(who)}</div>
      </div>`;
    }).join('');
    const caption = winnerName
      ? `🏆 ${winnerName} wins`
      : `${lastName} · ${trick.length}/4`;
    const resolveKey = trickResolveKey(game.lastTrickWinner, trick);
    const alreadyTaken = !!(game.resolvingTrick && window._trickFlightKey && window._trickFlightKey === resolveKey);
    if (!window._trickCapturing && !alreadyTaken) {
      trickArea.innerHTML = `
        <div class="trick-stack${(typeof gfxOn === 'function' && gfxOn('trickFan')) ? ' trick-fan' : ''}">
          ${cardsHtml}
        </div>
        <div class="trick-caption">${caption}</div>
      `;
    } else {
      const cap = trickArea.querySelector('.trick-caption');
      if (cap) cap.textContent = caption;
    }
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
      }, 1100);
    } else if (room) {
      room.classList.remove('trick-resolving');
    }
  }
  try { updateLandscapeTheater(); } catch (e) {}
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
  const seat = document.getElementById('slot-me');
  if (!seat) return;
  seat.classList.add('took-this-trick');
  let chip = seat.querySelector('.you-took-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'you-took-chip';
    chip.textContent = 'You take it';
    seat.appendChild(chip);
  }
  chip.classList.remove('pop');
  void chip.offsetWidth;
  chip.classList.add('pop');
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

function animateTrickCaptureRobust(stackEl, winnerIdx) {
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
    'pointer-events:none;z-index:2147483000;overflow:visible;';
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
      'position:fixed!important;left:' + r.left + 'px;top:' + r.top + 'px;' +
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
    const delay = i * 55;
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
        'transform 780ms cubic-bezier(.18,.78,.18,1), opacity 780ms ease-out';
      void clone.offsetWidth;
      requestAnimationFrame(() => {
        if (!clone.isConnected) return;
        clone.style.transform = endTransform;
        clone.style.opacity = '0';
      });
    }, delay);
  });

  const cleanupMs = 1150 + Math.max(0, flightCount - 1) * 55;
  setTimeout(() => {
    try { layer.remove(); } catch (e) {}
    window._trickCapturing = false;
  }, cleanupMs);
}

function animateLandscapeTrickCapture(winnerIdx) {
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
      layer.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;overflow:visible;';
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
          clone.style.transition = 'transform 720ms cubic-bezier(.16,.82,.2,1), opacity 720ms ease-in';
          void clone.offsetWidth;
          requestAnimationFrame(() => {
            if (!clone.isConnected) return;
            clone.style.transform = `translate3d(${dx}px,${dy}px,0) rotate(${spin}deg) scale(.34)`;
            clone.style.opacity = '0';
          });
        }, i * 50);
      });

      const cleanup = 920 + Math.max(0, faces.length - 1) * 50;
      setTimeout(() => {
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
  const n = game.myHand.length;
  if (n <= 0) return;

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
  const available = Math.max(140, rawW - padL - padR - safety);

  const maxHByViewport = Math.max(42, Math.min(88, Math.floor(vh * 0.20)));
  const maxW = 60;
  // Shrink earlier so 9–10 cards fit cleanly on ~320–390px screens
  const minW = n >= 15 ? 16 : n >= 13 ? 18 : n >= 11 ? 20 : n >= 9 ? 22 : 26;

  // Prefer zero/near-zero gap when many cards so everything stays on-screen
  let gap = n >= 12 ? 0 : n >= 9 ? 1 : n >= 7 ? 2 : 3;
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

/** Color bucket for display. Rook is its own group on the far left when it is high. */
function displayColorGroup(card) {
  if (!card) return 99;
  if (isRookCard(card)) return (typeof rookLowest !== 'undefined' && rookLowest) ? 50 : -1;
  const i = COLORS.indexOf(card.color);
  return i >= 0 ? i : 5;
}

/**
 * One comparator for every visible pile (hand, nest merge, discard rows, kitty flash).
 * Rook (when high) is always leftmost. Default otherwise: by color, high → low.
 */
function compareCardsDisplay(a, b) {
  const rookHigh = !(typeof rookLowest !== 'undefined' && rookLowest);
  if (rookHigh) {
    const aR = isRookCard(a);
    const bR = isRookCard(b);
    if (aR !== bR) return aR ? -1 : 1;
  }

  const mode = normalizeHandSortMode(handSortMode);
  const trump = (game && game.trump) || null;

  if (mode === 'rank') {
    const d = effectiveRank(b) - effectiveRank(a);
    if (d) return d;
    return displayColorGroup(a) - displayColorGroup(b);
  }
  if (mode === 'counters') {
    const d = cardPoints(b) - cardPoints(a);
    if (d) return d;
  }

  if (trump) {
    const aT = isTrumpCard(a, trump);
    const bT = isTrumpCard(b, trump);
    if (aT !== bT) return aT ? -1 : 1;
    if (aT && bT) {
      return trumpDefendStrength(b, trump) - trumpDefendStrength(a, trump);
    }
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
  const n = game.myHand.length;
  handEl.innerHTML = game.myHand.map((card, idx) => {
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
    const tag = (trump && !hideStar) ? '<span class="c-trump-tag" aria-label="trump">★</span>' : '';
    return `<div class="card-face ${cls} ${extra}" data-id="${card.id}">${cardInnerHTML(card)}${tag}</div>`;
  }).join('');

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
            } else if (window.selectedForDiscard.size < needed) {
              window.selectedForDiscard.add(id);
              el.classList.add('selected');
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
        } else if (window.selectedForDiscard.size < needed) {
          window.selectedForDiscard.add(id);
          el.classList.add('selected');
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
  const dock = $('feltBidDock');
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
function setBotThinking(on) {
  const el = $('botThinking');
  if (!el) return;
  const waitPhase = !!(game && (game.phase === 'discard' || game.phase === 'trump') && game.bidder !== myIndex);
  if (waitPhase) {
    el.classList.add('hidden');
    return;
  }
  if (on) {
    const p = players[game?.currentPlayer] || players[game?.bidder];
    el.textContent = p ? `${p.name} is thinking…` : 'Bot is thinking…';
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
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
  return Math.max(120, Math.round(delay * mult));
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



function runBotAction() {
  if (!game || !isHost || game.resolvingTrick || game.claimAnimating) return;
  if (window.horTourBlocking) {
    window.horTourResumeBot = true;
    return;
  }
  const actor = (game.phase === 'discard' || game.phase === 'trump') ? game.bidder : game.currentPlayer;
  const prevDiff = botDifficulty;
  if (isBuzzed(actor)) botDifficulty = 'easy';
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

function cycleTheme() {
  const ids = (window.horRoomThemeIds && window.horRoomThemeIds.length)
    ? window.horRoomThemeIds
    : ['midnight', 'house', 'riverboat', 'cabin', 'speakeasy', 'slate', 'burgundy', 'ember', 'harbor', 'sandbar', 'ivy', 'frost', 'cocoa', 'plum', 'ink'];
  let cur = 0;
  ids.forEach((id, i) => {
    if (document.body.classList.contains('room-theme-' + id)) cur = i;
  });
  const next = ids[(cur + 1) % ids.length];
  if (typeof window.applyRoomTheme === 'function') window.applyRoomTheme(next, true);
  else {
    ids.forEach((id) => document.body.classList.remove('room-theme-' + id));
    document.body.classList.add('room-theme-' + next);
  }
  try {
    if (typeof horToast === 'function') horToast('Table: ' + next.replace(/^./, c => c.toUpperCase()));
  } catch (e) {}
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
  knownVoids = [{}, {}, {}, {}];
  lastTurnIndex = -1;
  window._turnOppKey = '';
  window._lastTurnBeepKey = '';
  lastTrickLen = 0;
  game.currentPlayer = (game.dealer + 1) % 4;
  game.passCount = 0;
  game.highestBid = (minBid || 70) - 5;
  game.bidder = -1;
  game.bid = 0;
  game.shotTheMoon = false;
  game.trump = null;
  game.bidStatus = [null, null, null, null];
  game.phase = 'dealing';
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
        input.focus();
        input.select();
        input.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    el.onclick = ((seat) => () => welcomeJoin(false, seat))(s);
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
  try {
    ensureAudio();
    isSpectator = false;
    isSoloPractice = true;
    try { document.body.classList.add('offline-play'); } catch (e) {}
    isHost = true;
    peer = null;
    hostConnection = null;
    try { if (typeof connMap === 'object') Object.keys(connMap).forEach(k => delete connMap[k]); } catch (e) {}

    myName = (($('hor-player-name') && $('hor-player-name').value) || '').trim() || myName || 'You';
    myPeerId = 'solo-' + Math.random().toString(36).slice(2, 9);
    roomCode = 'OFFLINE';
    players = [{ id: myPeerId, name: myName, team: 0, isHost: true, isBot: false, seat: 0, bank: loadMyBank() }];

    // 3 named persona bots (no network)
    while (players.length < 4) addBot();
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

    playTableToast(() => {
      try { hostStartGame(); } catch (e) { console.error(e); }
    });

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
bindClick('leaveReplaceBtn', () => { try { clientLeaveReplace(); } catch (e) { console.error(e); } });
(function wireBotStyleLongPress() {
  let timer = 0;
  let armedName = '';
  let shown = false;
  const cancel = () => { if (timer) { clearTimeout(timer); timer = 0; } armedName = ''; };
  const sourceName = (el) => {
    if (!el) return '';
    const tagged = el.closest && el.closest('[data-botname]');
    return tagged ? (tagged.getAttribute('data-botname') || '') : '';
  };
  document.addEventListener('pointerdown', (e) => {
    const name = sourceName(e.target);
    shown = false;
    if (!name) return;
    cancel();
    armedName = name;
    const x = e.clientX || 24;
    const y = e.clientY || 24;
    timer = setTimeout(() => {
      timer = 0;
      shown = true;
      showBotStyleTip(armedName, { clientX: x, clientY: y, preventDefault() {}, stopPropagation() {} });
    }, 480);
  }, { passive: true });
  document.addEventListener('pointerup', cancel, { passive: true });
  document.addEventListener('pointercancel', cancel, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (!timer) return;
    if (Math.abs((e.movementX || 0)) + Math.abs((e.movementY || 0)) > 10) cancel();
  }, { passive: true });
  document.addEventListener('click', (e) => {
    if (shown) {
      e.preventDefault();
      e.stopPropagation();
      shown = false;
      return;
    }
    const tip = $('botStyleTip');
    if (tip && !tip.classList.contains('hidden') && !tip.contains(e.target)) hideBotStyleTip();
  }, true);
})();
bindClick('botPickerClose', closeBotPicker);
const _botPickModal = $('botPickerModal');
if (_botPickModal) _botPickModal.addEventListener('click', (e) => { if (e.target === _botPickModal) closeBotPicker(); });
bindClick('leaveBtn', () => {
  try { sessionStorage.removeItem('rookSession'); } catch (e) {}
  location.reload();
});
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
  // worker (not names, bank, or table settings) and reloads the latest
  // deployed version. For when a device is stuck on stale cached code that
  // the automatic version-mismatch check hasn't caught yet.
  const ok = window.confirm('This will clear this app\'s cached files on this device and reload. Your name, bank, and settings are kept. Continue?');
  if (ok) horForceUpdate();
});
bindClick('btnMute', toggleMute);
bindClick('btnStats', showStatsModal);
try { wireTargetScoreUI(); } catch (e) {}
bindClick('ltTabTrick', () => setLandscapeTab(false));
bindClick('ltTabLast5', () => setLandscapeTab(true));


bindClick('closeStats', () => { const m = $('statsModal'); if (m) m.classList.add('hidden'); });
bindClick('btnTransferHost', hostTransferHost);
bindClick('btnA11y', () => {
  highContrast = !highContrast;
  try { localStorage.setItem('rookHighContrast', highContrast ? '1' : '0'); } catch (e) {}
  applyA11y();
});
bindClick('btnReduceMotion', () => {
  reduceMotion = !reduceMotion;
  try { localStorage.setItem('rookReduceMotion', reduceMotion ? '1' : '0'); } catch (e) {}
  applyA11y();
});
applyA11y();

// Always bind the in-game Game Options Done button from the global event-listener setup.
// Do not rely on the waiting-room renderer to wire this control: Offline Practice and
// active games can use the modal after the waiting screen has been hidden.
bindClick('closeHostOptionsBtn', (e) => {
  if (e) e.preventDefault();
  closeHostOptionsModal();
});

bindClick('btnGameOptions', () => {
  try {
    const modal = $('hostOptionsModal');
    if (!modal) { console.error('Game options modal missing from DOM'); return; }
    openHostOptionsModal();
  } catch (e) { console.error('Game options open failed:', e); }
});

bindClick('btnToggleTopOpts', () => {
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
bindClick('btnTheme', cycleTheme);
bindClick('btnCardBack', openCardBackModal);
bindClick('btnCardBackLobby', openCardBackModal);
bindClick('closeCardBackModal', closeCardBackModal);
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
    body.innerHTML = handHistory.map((h, i) => `
      <div class="history-item">
        <b>Hand ${i + 1}</b> — Bid ${h.bid} Team ${h.bidderTeam === 0 ? 'A' : 'B'}
        ${h.made ? 'made' : 'set'} · Trump ${COLOR_NAMES[h.trump] || h.trump || '—'}
        · A ${h.pointsA} / B ${h.pointsB} → totals A ${h.scores[0]} B ${h.scores[1]}
      </div>
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
      if (status) status.textContent = 'Table ' + r + ' — enter your name and tap Sit down.';
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
  if (sess && sess.roomCode && horExpOn('lobbyReconnect')) {
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
  document.querySelectorAll('.card-back-choice').forEach(btn => {
    const on = btn.getAttribute('data-back') === cardBackId;
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function cardBackPickerHTML() {
  return CARD_BACKS.map(b => `
    <button type="button" class="card-back-choice${b.id === cardBackId ? ' selected' : ''}"
      data-back="${b.id}" aria-pressed="${b.id === cardBackId ? 'true' : 'false'}"
      title="${b.name}">
      <span class="card-back-swatch cardback-preview-${b.id}" aria-hidden="true"></span>
      <span class="card-back-name">${b.name}</span>
      <span class="card-back-hint">${b.hint}</span>
    </button>
  `).join('');
}

function bindCardBackPicker(root) {
  if (!root) return;
  if (!root.dataset.filled) {
    root.innerHTML = cardBackPickerHTML();
    root.dataset.filled = '1';
  } else {
    root.querySelectorAll('.card-back-choice').forEach(btn => {
      const on = btn.getAttribute('data-back') === cardBackId;
      btn.classList.toggle('selected', on);
    });
  }
  root.querySelectorAll('.card-back-choice').forEach(btn => {
    btn.onclick = () => applyCardBack(btn.getAttribute('data-back'), true);
  });
}

function refreshCardBackPickers() {
  ['cardBackPickerHost', 'cardBackPickerModal'].forEach(id => bindCardBackPicker($(id)));
}

function openCardBackModal() {
  const modal = $('cardBackModal');
  if (!modal) return;
  refreshCardBackPickers();
  modal.classList.remove('hidden');
}

function closeCardBackModal() {
  const modal = $('cardBackModal');
  if (modal) modal.classList.add('hidden');
}
(function wireCardBackModal() {
  const modal = $('cardBackModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCardBackModal();
    });
  }
})();

(function wireTableBank() {
  try {
    document.querySelectorAll('.table-msg-btn, [data-open-table-msg]').forEach((btn) => {
      if (btn && btn.tagName === 'BUTTON') btn.textContent = 'Message Table $100';
    });
  } catch (e) {}
  document.addEventListener('click', (e) => {
    const hit = e.target.closest('.seat-bank.is-mine, .wait-seat-bank.is-mine, .lt-bank.is-mine, .table-msg-btn, [data-open-table-msg]');
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    openTableMsgBuy();
  });
  const send = $('tableMsgSend');
  const hold = $('tableMsgHold');
  const cancel = $('tableMsgCancel');
  const modal = $('tableMsgModal');
  const inp = $('tableMsgInput');
  if (send) send.onclick = () => submitTableMsgBuy();
  if (hold) hold.onclick = () => holdTableMsgBuy();
  if (cancel) cancel.onclick = () => closeTableMsgBuy();
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeTableMsgBuy(); });
  if (inp) {
    inp.addEventListener('input', () => saveTableMsgDraft(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitTableMsgBuy(); });
    inp.addEventListener('focus', () => setTimeout(pinTableMsgModal, 80));
  }
  try {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', pinTableMsgModal);
      window.visualViewport.addEventListener('scroll', pinTableMsgModal);
    }
  } catch (e) {}
})();

(function initPrefs() {
  const t = parseInt(localStorage.getItem('rookTheme') || '0', 10);
  themeIndex = isNaN(t) ? 0 : t % THEMES.length;
  document.body.classList.remove(...THEMES);
  document.body.classList.add(THEMES[themeIndex]);
  try { cardBackId = normalizeCardBackId(localStorage.getItem('rookCardBack') || 'griffin'); } catch (e) { cardBackId = 'griffin'; }
  applyCardBack(cardBackId, false);
  refreshCardBackPickers();
  updateMuteButtons();
})();

window.submitBid = submitBid;
window.submitTrump = submitTrump;
window.submitDiscard = submitDiscard;
window.submitPlay = submitPlay;
window.hideDiscardOverlay = hideDiscardOverlay;

/** Guarantee difficulty options include Extreme (fixes stale DOM / cache). */
function ensureBotDifficultyOptions() {
  const bd = $('opt-bot-difficulty');
  if (!bd) return;
  const wanted = [
    ['easy', 'Easy'],
    ['normal', 'Normal'],
    ['hard', 'Hard'],
    ['extreme', 'Extreme'],
  ];
  const have = new Set(Array.from(bd.options).map(o => o.value));
  wanted.forEach(([val, label]) => {
    if (!have.has(val)) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      bd.appendChild(opt);
    }
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
  const landscape = window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
  if (landscapeBidHints === false || !game || game.phase !== 'bidding' || !landscape) {
    if (el) el.remove();
    return null;
  }
  const hand = (game.myHand && game.myHand.length) ? game.myHand
    : (typeof myIndex === 'number' && myIndex >= 0 && game.hands ? game.hands[myIndex] : []);
  const advice = coachBidAdvice(hand, game);
  if (!el) {
    el = document.createElement('div');
    el.id = 'ghBidHint';
    el.className = 'gh-bid-hint';
    const mount = document.getElementById('landscapeTheater') || document.body;
    mount.appendChild(el);
  }
  el.textContent = advice.text;
  return advice;
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
    const isGameOver = scores[0] >= goal || scores[1] >= goal;
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
      if (game.highestBid) parts.push('High: ' + formatBidAmount(game.highestBid, { short: true }));
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
          high ? 'high' : '',
          st === 'pass' ? 'passed' : '',
          me ? 'me' : '',
          partner ? 'partner' : '',
          toAct ? 'to-act' : '',
        ].filter(Boolean).join(' ');
        let line = 'waiting';
        if (st === 'pass') line = 'PASS';
        else if (high && game.highestBid) line = formatBidAmount(game.highestBid, { short: true });
        else if (typeof st === 'number' && st > 0) line = formatBidAmount(st, { short: true });
        const tag = toAct ? '<div class="lt-bid-turn">TO BID</div>' : (high ? '<div class="lt-bid-high">HIGH</div>' : '');
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
        + (game.highestBid ? (' · high ' + formatBidAmount(game.highestBid, { short: true })) : '');
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
      <div class="lt-bank${isMe ? ' is-mine' : ''}">${formatBank(bankOfSeat(t.player))}</div>
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
    handLabel.innerHTML = 'Your hand <span class="seat-bank is-mine lt-hand-bank">' + formatBank(bankOfSeat(mySeat >= 0 ? mySeat : 0)) + '</span>';
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
        handLabel.textContent = 'Your turn — tap a gold card to play';
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
  setTimeout(() => { try { updateLandscapeTheater(); } catch (e) {} }, 150);
});
window.addEventListener('resize', () => {
  try { updateLandscapeTheater(); } catch (e) {}
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



// ========== Last 3 Tricks (button, not long-hold) ==========
function closePortraitLast3() {
  const ov = $('portraitLast3Overlay');
  if (!ov) return;
  ov.classList.add('hidden');
  ov.setAttribute('aria-hidden', 'true');
}
function renderPortraitLast3() {
  const body = $('portraitLast3Body');
  if (!body) return;
  const list = (window._scoreLastTricks && window._scoreLastTricks.length)
    ? window._scoreLastTricks.slice(0, 3)
    : ((typeof recentTricks !== 'undefined' && recentTricks) ? recentTricks : []).slice(0, 3);
  const plist = (game && game.players) || players || [];
  const nameOf = (idx) => {
    if (plist[idx] && plist[idx].name) return plist[idx].name;
    if (typeof myIndex === 'number' && idx === myIndex && myName) return myName;
    return 'Player ' + ((idx|0) + 1);
  };
  if (!list.length) {
    body.innerHTML = '<div class="portrait-last3-empty">No completed tricks yet</div>';
    return;
  }
  body.innerHTML = list.map((tr, i) => {
    const label = i === 0 ? 'Latest' : (i === 1 ? 'Previous' : '3rd most recent');
    const wName = nameOf(tr.winner);
    const plays = (tr.plays || []).map((t) => {
      const isW = t.player === tr.winner;
      return `<div class="portrait-th-play ${isW ? 'winner' : ''}">
        ${typeof renderCardHTML === 'function' ? renderCardHTML(t.card, true) : ''}
        <div class="portrait-th-name">${escapeHtmlSafe(nameOf(t.player))}</div>
      </div>`;
    }).join('');
    return `<article class="portrait-th-card">
      <div class="portrait-th-head"><span>${label}</span><b>🏆 ${escapeHtmlSafe(wName)}</b></div>
      <div class="portrait-th-plays">${plays}</div>
    </article>`;
  }).join('');
}
function openPortraitLast3() {
  const ov = $('portraitLast3Overlay');
  if (!ov) return;
  try { if (ov.parentElement !== document.body) document.body.appendChild(ov); } catch (e) {}
  ov.style.zIndex = '400000';
  const hand = document.querySelector('.hand-area');
  const ltHand = document.querySelector('.landscape-theater .lt-hand-wrap');
  let clearance = 110;
  const target = ltHand || hand;
  if (target) {
    const r = target.getBoundingClientRect();
    if (r.top > 0) clearance = Math.max(100, Math.ceil(window.innerHeight - r.top + 8));
  }
  document.documentElement.style.setProperty('--portrait-hand-clearance', clearance + 'px');
  renderPortraitLast3();
  ov.classList.remove('hidden');
  ov.setAttribute('aria-hidden', 'false');
}
function syncPortraitLast3Button() {
  const btn = $('portraitLast3Btn');
  if (!btn) return;
  const gameScreen = $('game');
  const visible = !!(gameScreen && !gameScreen.classList.contains('hidden'));
  btn.classList.toggle('hidden', !visible);
  positionPortraitLast3Btn();
}

/** Place the portrait "Last 3" button just to the left of the right wall
 * sconce, with enough clearance that its glow never touches the button.
 * Anchored off the sconce's own measured position (a fixed, simple element)
 * rather than the oval table's curve, which is too irregular near the top
 * to use as a reliable reference. Portrait only. */
function positionPortraitLast3Btn() {
  try {
    if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) return;
    const btn = $('portraitLast3Btn');
    const wrap = document.querySelector('.table-wrap');
    const sconce = document.querySelector('.sconce-right');
    if (!btn || !wrap || !sconce || btn.classList.contains('hidden')) return;
    const wrapRect = wrap.getBoundingClientRect();
    const sconceRect = sconce.getBoundingClientRect();
    if (!wrapRect.width || !sconceRect.width) return;
    // Clear the sconce's glow, but stay close — user wants it shifted
    // toward the sconce (previous 34px clearance touched the table's
    // wood rim on the button's left side instead).
    const CLEARANCE = 17;
    const rightPx = wrapRect.right - (sconceRect.left - CLEARANCE);
    btn.style.left = 'auto';
    btn.style.right = Math.max(8, rightPx) + 'px';
    btn.style.transform = 'none';
  } catch (e) {}
}
(function wireLast3Button() {
  const btn = $('portraitLast3Btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ov = $('portraitLast3Overlay');
      if (ov && !ov.classList.contains('hidden')) closePortraitLast3();
      else openPortraitLast3();
    });
  }
  const close = $('portraitLast3Close');
  if (close) close.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closePortraitLast3(); });
  const ov = $('portraitLast3Overlay');
  if (ov) ov.addEventListener('click', (e) => { if (e.target === ov) closePortraitLast3(); });
  window.addEventListener('resize', () => {
    const ovEl = $('portraitLast3Overlay');
    if (ovEl && !ovEl.classList.contains('hidden')) openPortraitLast3();
    positionPortraitLast3Btn();
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(positionPortraitLast3Btn, 60);
    setTimeout(positionPortraitLast3Btn, 300);
  });
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

/** Nearby play (Wi‑Fi hotspot) — browsers cannot do true Bluetooth multiplayer */
(function wireNearbyPlay() {
  function openNearbySheet() {
    const s = $('nearbySheet');
    if (!s) return;
    s.classList.remove('hidden');
    s.setAttribute('aria-hidden', 'false');
    // Hide "Create room" when already in a room
    const createBtn = $('nearbyCreateBtn');
    const waiting = $('waiting');
    const inWaiting = waiting && !waiting.classList.contains('hidden');
    if (createBtn) createBtn.style.display = inWaiting ? 'none' : '';
  }
  function closeNearbySheet() {
    const s = $('nearbySheet');
    if (!s) return;
    s.classList.add('hidden');
    s.setAttribute('aria-hidden', 'true');
  }
  window.openNearbySheet = openNearbySheet;
  window.closeNearbySheet = closeNearbySheet;

  function bind(id, fn) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  }
  bind('nearbyPlayBtn', openNearbySheet);
  bind('nearbyPlayBtnWaiting', openNearbySheet);
  bind('nearbyCloseBtn', closeNearbySheet);
  bind('nearbyCreateBtn', () => {
    closeNearbySheet();
    const realCreate = $('createBtn');
    if (realCreate) realCreate.click();
  });
  // Tap backdrop to close
  const sheet = $('nearbySheet');
  if (sheet) {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) closeNearbySheet();
    });
  }
})();

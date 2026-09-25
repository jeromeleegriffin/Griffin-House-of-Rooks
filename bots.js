/* House of Rooks — extracted module | Author: Jerome Griffin */
/* One partnership engine. Difficulty gates knowledge + discipline.
 * Extreme: full count, tight auction, light persona habit.
 * Hard: count + voids, buys a little more, light persona tilt.
 * Normal: no count, obvious voids only, full persona.
 * Easy: no count, no voids, loose auction, full persona + slips.
 */

function botLevel() {
  const d = (typeof botDifficulty === 'string') ? botDifficulty : 'extreme';
  if (d === 'easy' || d === 'normal' || d === 'hard' || d === 'extreme') return d;
  return 'extreme';
}
function extremeOn() { return botLevel() === 'extreme'; }
function botCanCount() { const l = botLevel(); return l === 'extreme' || l === 'hard'; }
function botCanReadVoids() { return botLevel() !== 'easy'; }
function botFullPersona() { const l = botLevel(); return l === 'easy' || l === 'normal'; }
function botLightPersona() { const l = botLevel(); return l === 'hard' || l === 'extreme'; }
function seatStyle(seat) {
  return (typeof botPersonaStyle === 'function') ? (botPersonaStyle(seat) || 'balanced') : 'balanced';
}
function habitGag(style) {
  return style === 'randomish' || style === 'showboat';
}

function botSeatTeam(seat) {
  const p = players[seat];
  if (p && typeof p.team === 'number') return p.team;
  return seat % 2;
}
function partnerOf(seat) { return (seat + 2) % 4; }
function leftOf(seat) { return (seat + 1) % 4; }
function rightOf(seat) { return (seat + 3) % 4; }

function isVoid(seat, color) {
  if (!botCanReadVoids()) return false;
  return !!(knownVoids[seat] && color && knownVoids[seat][color]);
}

function teamCapturedPoints(team) {
  const pile = (game && game.tricksTaken && game.tricksTaken[team]) || [];
  let n = 0;
  for (let i = 0; i < pile.length; i++) n += cardPoints(pile[i]);
  return n;
}

function deckPointTotal() {
  return (typeof totalCountersInDeck === 'function') ? totalCountersInDeck() : 200;
}

function extremeSeenCards(seat) {
  const seen = [];
  const push = (c) => { if (c && c.id) seen.push(c); };
  const hand = (game.hands && game.hands[seat]) || [];
  hand.forEach(push);
  (game.trick || []).forEach(t => push(t.card));
  if (!botCanCount()) return seen;
  const taken = game.tricksTaken || [];
  (taken[0] || []).forEach(push);
  (taken[1] || []).forEach(push);
  if (seat === game.bidder) (game.nestCards || []).forEach(push);
  if (typeof openWidow !== 'undefined' && openWidow && game.nestPreview) {
    game.nestPreview.forEach(push);
  }
  if (typeof revealTopNest !== 'undefined' && revealTopNest && game.topNestCard) push(game.topNestCard);
  return seen;
}

function extremeUnseen(seat) {
  if (!botCanCount()) return [];
  const deck = (typeof makeDeck === 'function') ? makeDeck() : [];
  const used = {};
  extremeSeenCards(seat).forEach(c => { if (c && c.id) used[c.id] = true; });
  return deck.filter(c => c && c.id && !used[c.id]);
}

function remainingTrumpCount(seat) {
  const trump = game && game.trump;
  const mine = ((game.hands && game.hands[seat]) || []).filter(c => isTrumpCard(c, trump));
  if (!botCanCount()) return { mine: mine.length, out: 99 };
  const unseen = extremeUnseen(seat);
  return { mine: mine.length, out: unseen.filter(c => isTrumpCard(c, trump)).length };
}

function highestAmong(cards, led, trump) {
  if (!cards || !cards.length) return null;
  let best = cards[0];
  for (let i = 1; i < cards.length; i++) {
    if (compareCards(cards[i], best, led, trump) > 0) best = cards[i];
  }
  return best;
}
function cardBeats(a, b, led, trump) {
  if (!a) return false;
  if (!b) return true;
  return compareCards(a, b, led, trump) > 0;
}
function isTopRemaining(card, seat, led, trump) {
  if (!card || !botCanCount()) return false;
  const unseen = extremeUnseen(seat);
  const threat = unseen.find(c => cardBeats(c, card, led || card.color, trump));
  const trickThreat = (game.trick || []).find(t => cardBeats(t.card, card, led || card.color, trump));
  return !threat && !trickThreat;
}
function cheapWinner(winners, trump) {
  if (!winners || !winners.length) return null;
  const copy = winners.slice();
  copy.sort((a, b) => {
    const pa = cardPoints(a), pb = cardPoints(b);
    const sa = isPermanentTrump(a) ? 80 : (a.color === trump ? 25 : 0);
    const sb = isPermanentTrump(b) ? 80 : (b.color === trump ? 25 : 0);
    return (sa - sb) || (pa - pb) || (effectiveRank(a) - effectiveRank(b));
  });
  return copy[0];
}
function lowestCard(arr) {
  if (!arr || !arr.length) return null;
  return arr.slice().sort((a, b) => cardPoints(a) - cardPoints(b) || effectiveRank(a) - effectiveRank(b))[0];
}
function highestCounter(arr) {
  if (!arr || !arr.length) return null;
  return arr.slice().sort((a, b) => cardPoints(b) - cardPoints(a) || effectiveRank(a) - effectiveRank(b))[0];
}
function colorLen(hand, color) {
  return hand.filter(c => c.color === color && !isPermanentTrump(c)).length;
}

function extremeAnalyze(hand) {
  const a = (typeof analyzeHand === 'function') ? analyzeHand(hand) : {
    byColor: { green: [], red: [], yellow: [], black: [] },
    suitScores: {}, rook: null, red1: null, red2: null, voids: 0, shorts: 0
  };
  const trump = (typeof bestTrumpColor === 'function') ? bestTrumpColor(hand) : 'green';
  const t = (a.byColor && a.byColor[trump]) || [];
  const honors = t.filter(c => {
    const r = c.rank;
    return r === 1 || r === 14 || r === 13 || r === 12 || r === 10;
  }).length;
  const ones = hand.filter(c => c.rank === 1 && !isRed1(c)).length;
  const fourteens = hand.filter(c => c.rank === 14).length;
  const ownPts = hand.reduce((s, c) => s + cardPoints(c), 0);
  const goodTrump = (t.length >= 6) || (t.length >= 5 && honors >= 1) || (t.length >= 4 && honors >= 3);
  let marks = 0;
  if (goodTrump) marks += 1;
  if (a.rook) marks += 1;
  if (ones >= 1) marks += 1;
  if (fourteens >= 2) marks += 1;
  if ((a.voids || 0) >= 1 || (a.shorts || 0) >= 2) marks += 1;

  let ev = 0;
  ev += ownPts * 0.55;
  ev += t.length * 7;
  ev += honors * 6;
  if (a.rook) ev += rookLowest ? 8 : 18;
  if (a.red1) ev += 16;
  if (a.red2) ev += 12;
  ev += (a.voids || 0) * 14;
  ev += Math.max(0, (a.shorts || 0) - 1) * 6;
  const deckPts = deckPointTotal();
  ev += Math.min(36, Math.max(18, Math.round(deckPts * 0.14)));
  ev += Math.min(40, Math.round((deckPts - ownPts) * 0.18));
  ev = Math.max(0, Math.min(deckPts, ev));
  return { analysis: a, trump, trumpLen: t.length, honors, ones, fourteens, ownPts, goodTrump, marks, ev };
}

function legacyBotBid() {
  if (typeof nestAuctionLocked === 'function' && nestAuctionLocked()) return;
  const hand = game.hands[game.currentPlayer];
  const ceiling = (typeof bidCeilingFor === 'function') ? bidCeilingFor(game.currentPlayer) : maxBid();
  const floor = (minBid || 70);
  const nextMin = game.highestBid + 5;
  extremeBid(hand, floor, ceiling, nextMin);
}

function extremeBid(hand, floor, ceiling, nextMin) {
  const seat = game.currentPlayer;
  const info = extremeAnalyze(hand);
  const partnerSeat = partnerOf(seat);
  const myTeam = botSeatTeam(seat);
  const scores = (game && game.scores) || [0, 0];
  const target = (game && game.targetScore) || (typeof targetScore !== 'undefined' ? targetScore : 500);
  const myScore = scores[myTeam] || 0;
  const theirScore = scores[1 - myTeam] || 0;
  const needToWin = Math.max(0, target - myScore);
  const theyNeed = Math.max(0, target - theirScore);
  const level = botLevel();
  const style = (typeof botPersonaStyle === 'function') ? botPersonaStyle(seat) : 'balanced';

  let raw = info.ev;
  if (info.trumpLen >= 7) raw += 12;
  else if (info.trumpLen <= 3) raw -= 18;
  if (info.marks >= 4) raw += 10;
  if (info.marks <= 1) raw -= 15;

  if (level === 'extreme') raw -= 12;
  else if (level === 'hard') raw -= 2;
  else if (level === 'normal') raw += 16;
  else raw += 32;

  if ((botFullPersona() || botLightPersona()) && !habitGag(style)) {
    if (style === 'bidHappy' || style === 'aggressive' || style === 'widowFiend') raw += (level === 'easy' ? 18 : level === 'normal' ? 12 : 8);
    if (style === 'safe' || style === 'passive' || style === 'sandbag' || style === 'trumpShy') raw -= (level === 'easy' ? 16 : 10);
    if (style === 'partnerFirst' || style === 'bidOnce' || style === 'climbOnly') raw -= 4;
    if (style === 'pointHungry' || style === 'trumpHeavy' || style === 'rookHunter' || style === 'setDog') raw += 5;
    if (style === 'lastTrick' || style === 'antiMoon') raw -= 3;
    if (style === 'scoreHawk') {
      const behind = theyNeed + 40 < needToWin || myScore + 40 < theirScore;
      raw += behind ? 12 : -14;
    }
    if (style === 'quietDealer') raw += (seat === game.dealer ? -12 : (seat === (game.dealer + 1) % 4 ? 8 : 0));
    if (style === 'moonDreamer' && info.marks >= 4) raw += 20;
  }

  let want = Math.floor(raw / 5) * 5;
  want = Math.max(0, Math.min(ceiling, want));

  if (level === 'extreme' || level === 'hard') {
    if (theyNeed <= floor + 20 && info.marks >= 2) want = Math.max(want, floor);
    if (needToWin <= floor && info.marks >= 2 && info.goodTrump) want = Math.max(want, floor);
  }

  const respectPartner = (dontStealPartnerBid !== false) && (
    style === 'partnerFirst'
    || level === 'extreme' || level === 'hard'
    || (level === 'normal' && Math.random() >= 0.45)
  );
  if (respectPartner && game.bidder === partnerSeat && game.highestBid >= floor) {
    const steal = style !== 'partnerFirst' && (
      (info.trumpLen >= 7 && info.honors >= 3)
      || (info.ev >= game.highestBid + 35 && info.goodTrump && (info.analysis.rook || info.trumpLen >= 6))
    );
    if (!steal) {
      hostProcessBid({ player: seat, value: 0 });
      return;
    }
  }

  let openMarks = 2;
  if (level === 'hard') openMarks = 2;
  if (level === 'normal') openMarks = 1;
  if (level === 'easy') openMarks = 0;

  let bid = 0;
  if (game.highestBid < floor) {
    if (info.marks >= openMarks || info.ev >= floor - (level === 'easy' ? 40 : level === 'normal' ? 20 : 8)
      || (info.goodTrump && info.ev >= floor - 25)) {
      bid = floor;
    }
    if (level === 'easy' && info.ev >= floor - 50) bid = floor;
    // Tight seats pass a 100 the book would buy unless the hand is marked.
    if ((style === 'safe' || style === 'passive' || style === 'sandbag') && info.marks < 3 && info.trumpLen < 6) {
      bid = 0;
    }
    // Hot seats open the floor on any two-mark or long-trump hand.
    if ((style === 'aggressive' || style === 'bidHappy' || style === 'widowFiend') && (info.marks >= 2 || info.trumpLen >= 5 || info.goodTrump || style === 'widowFiend')) {
      bid = floor;
    }
    if (style === 'climbOnly' || style === 'passFirst') bid = 0;
    if (style === 'lastBidder') bid = 0;
    if (style === 'scoreHawk' && myScore >= theirScore && info.marks < 4) bid = 0;
  } else if (nextMin <= ceiling) {
    if (style === 'bidOnce') {
      bid = 0;
    } else if (want >= nextMin) {
      if (style === 'antiMoon' && nextMin >= ceiling - 20) bid = 0;
      else if (style === 'moonDreamer' && info.marks >= 4 && info.trumpLen >= 6 && ceiling === nextMin) bid = nextMin;
      else if (level === 'extreme' && info.marks >= 4 && info.ev >= nextMin + 20 && nextMin + 10 <= ceiling) {
        bid = nextMin + 10;
      } else {
        bid = nextMin;
      }
    } else if (want + (level === 'easy' ? 35 : level === 'normal' ? 20 : 15) >= nextMin && (info.goodTrump || level === 'easy')) {
      bid = nextMin;
    }
  }

  const capPad = level === 'extreme' ? 20 : level === 'hard' ? 28 : level === 'normal' ? 40 : 55;
  if (bid > 0 && bid > info.ev + capPad && bid > floor) {
    bid = (game.highestBid < floor) ? floor : 0;
  }

  if (typeof isShootMoonBid === 'function' && isShootMoonBid(bid)) {
    if (!(info.trumpLen >= 7 && info.analysis.rook && info.marks >= 4)) bid = Math.max(0, ceiling - 20);
  }

  hostProcessBid({ player: seat, value: bid });
}

function legacyBotDiscard() {
  const hand = game.hands[game.bidder].slice();
  const needed = game.discardCount || 5;
  const trump = bestTrumpColor(hand);
  extremeDiscard(hand, needed, trump);
}

function extremeDiscard(hand, needed, trump) {
  const colors = (typeof COLORS !== 'undefined') ? COLORS : ['green', 'red', 'yellow', 'black'];
  const level = botLevel();
  const lastTrickLikely = (() => {
    const t = hand.filter(c => isTrumpCard(c, trump));
    const top = highestAmong(t, trump, trump);
    return t.length >= 5 || (top && (isPermanentTrump(top) || effectiveRank(top) >= 14));
  })();

  const buryScore = (c) => {
    if (!c) return 0;
    if (c.color === 'rook' || isRed1(c) || isRed2(c)) return 100000;
    if (c.color === trump || isPermanentTrump(c)) return 20000 + effectiveRank(c) + cardPoints(c) * 4;
    const len = colorLen(hand, c.color);
    const p = cardPoints(c);
    let s = 200 + effectiveRank(c);
    if (level === 'easy') return s;
    if (len === 1) s -= 80;
    else if (len === 2) s -= 50;
    else if (len === 3) s -= 10;
    else s += 20;
    if (level !== 'normal') {
      if (p >= 10 && len <= 2) s -= 35;
      if (p === 5 && len <= 2) s -= 25;
    }
    if (c.rank === 1 && len >= 2) s += 400;
    if (c.rank === 1 && len === 1) s += 80;
    if (lastTrickLikely && p > 0 && len <= 2 && botCanCount()) s -= 20;
    if (!lastTrickLikely && p >= 10 && len >= 3) s += 120;
    const st = seatStyle(game.bidder);
    if (st === 'voidMaker' && len <= 2 && c.color !== trump) s -= 40;
    if (st === 'lastTrick' && p >= 10 && c.color !== trump) s -= 25;
    if (st === 'countSaver' && p >= 10) s -= 15;
    if (st === 'nestDump' && p >= 10 && !lastTrickLikely) s += 80;
    return s;
  };

  const pick = [];
  const picked = new Set();
  const rank = hand.map(c => ({ card: c, score: buryScore(c) }));
  rank.sort((a, b) => a.score - b.score);

  const style = seatStyle(game.bidder);
  if (level !== 'easy') {
    const maxStrip = (style === 'voidMaker') ? 4 : 3;
    colors.forEach(col => {
      if (col === trump) return;
      const group = hand.filter(c => c.color === col && !isPermanentTrump(c));
      if (group.length > 0 && group.length <= maxStrip && pick.length + group.length <= needed) {
        group.forEach(c => {
          if (pick.length >= needed) return;
          pick.push(c.id);
          picked.add(c.id);
        });
      }
    });
  }

  for (let i = 0; i < rank.length && pick.length < needed; i++) {
    const c = rank[i].card;
    if (picked.has(c.id)) continue;
    if (c.color === 'rook' || isRed1(c) || isRed2(c)) continue;
    if (c.color === trump && pick.length + 1 < needed) continue;
    pick.push(c.id);
    picked.add(c.id);
  }
  for (let i = 0; i < rank.length && pick.length < needed; i++) {
    const c = rank[i].card;
    if (picked.has(c.id)) continue;
    pick.push(c.id);
  }
  hostProcessDiscard({ player: game.bidder, cardIds: pick.slice(0, needed) });
}

function legacyBotChooseTrump() {
  const hand = game.hands[game.bidder];
  let color = bestTrumpColor(hand);
  if ((botFullPersona() || botLightPersona()) && typeof styleTrumpColor === 'function') {
    const st = seatStyle(game.bidder);
    if (!habitGag(st)) color = styleTrumpColor(hand, st) || color;
  }
  if (seatStyle(game.bidder) === 'colorStubborn') {
    const colors = (typeof COLORS !== 'undefined') ? COLORS : ['green','red','yellow','black'];
    const lens = colors.map(col => ({col, n: colorLen(hand, col)})).sort((a,b)=>b.n-a.n);
    if (lens[1] && lens[1].n >= 3) color = lens[1].col;
  }
  hostProcessTrump({ player: game.bidder, color });
}

function trickPointsSoFar() {
  return (game.trick || []).reduce((s, t) => s + cardPoints(t.card), 0);
}
function currentTrickWinner() {
  if (!game.trick || !game.trick.length) return null;
  let winner = game.trick[0];
  for (let i = 1; i < game.trick.length; i++) {
    if (compareCards(game.trick[i].card, winner.card, game.ledColor, game.trump) > 0) {
      winner = game.trick[i];
    }
  }
  return winner;
}

function legacyBotPlay() {
  const idx = game.currentPlayer;
  const hand = game.hands[idx];
  if (!hand || !hand.length) return;
  let legal = hand.filter(c => canPlay(c, hand, game.ledColor, game.trump));
  if (!legal.length) legal = hand.slice();

  if (isBuzzed(idx) && Math.random() < 0.42) {
    hostProcessPlay({ player: idx, cardId: legal[Math.floor(Math.random() * legal.length)].id });
    return;
  }

  if (botLevel() === 'easy' && Math.random() < 0.12) {
    hostProcessPlay({ player: idx, cardId: legal[Math.floor(Math.random() * legal.length)].id });
    return;
  }

  let choice = extremePickCard(idx, hand, legal);
  choice = applyHabitPlay(idx, hand, legal, choice);
  hostProcessPlay({ player: idx, cardId: (choice || legal[0] || hand[0]).id });
}



/* ==========================================================================\n * BUILD 461 — FROZEN SOL 7 CORE + EXISTING PERSONA LAYER\n *\n * Intelligence and personality are intentionally separate. Every normal bot\n * uses the validated Sol 7 decision core. Existing botStyle personas may move\n * a decision only inside a bounded, strategically defensible window. The\n * original pre-461 engine remains below as legacy helpers/fallback reference.\n * Sol7 source of truth: ai_lab/sol7_validated/Sol7_FROZEN.py + checksum.\n * ========================================================================== */
function sol7TrumpScore(hand, color) {
  const suited = (hand || []).filter(c => c && c.color === color && !isRed2(c));
  const ranks = new Set(suited.map(c => c.rank));
  const controls = (ranks.has(1) ? 5 : 0) + (ranks.has(14) ? 4 : 0) +
    (ranks.has(13) ? 2.5 : 0) + (ranks.has(12) ? 1.5 : 0);
  const counters = suited.reduce((n,c)=>n+cardPoints(c),0);
  const n = suited.length;
  const depth = n * 10 + Math.max(0, n - 4) * 4;
  return depth + controls * 4 + counters * 0.55;
}
function sol7TrumpColor(hand) {
  const colors = (typeof COLORS !== 'undefined') ? COLORS : ['green','red','yellow','black'];
  return colors.slice().sort((a,b) => {
    const d = sol7TrumpScore(hand,b) - sol7TrumpScore(hand,a);
    if (Math.abs(d) > 1e-9) return d;
    const lb = colorLen(hand,b), la = colorLen(hand,a);
    if (lb !== la) return lb-la;
    return colors.indexOf(a)-colors.indexOf(b);
  })[0] || 'green';
}
function sol7Power(hand) {
  const a = analyzeHand(hand);
  const t = sol7TrumpColor(hand);
  const lens = {}; COLORS.forEach(c => { lens[c] = (a.byColor[c] || []).length; });
  const p = (hand || []).reduce((n,c)=>n+cardPoints(c),0);
  const honors = (a.byColor[t] || []).filter(c => [1,14,13,12,10].includes(c.rank)).length;
  const voids = COLORS.filter(c => lens[c] === 0).length;
  const shorts = COLORS.filter(c => lens[c] <= 1).length;
  return p*.62 + lens[t]*8 + honors*7 + voids*10 + shorts*3 + (a.rook?20:0) + (a.red2?10:0);
}
function sol7BidCeiling(hand, seat) {
  const v = sol7Power(hand);
  if (v < 62) return 0;
  let cap = 70 + Math.floor((Math.max(0,v-62)*1.35)/5)*5;
  const high = game.highestBid || 65;
  if (high <= 90 && v >= 68) cap = Math.max(cap, high+5);
  if (high <= 110 && v >= 76) cap = Math.max(cap, high+5);
  const mine = (game.scores || [0,0])[botSeatTeam(seat)] || 0;
  const theirs = (game.scores || [0,0])[1-botSeatTeam(seat)] || 0;
  if (theirs-mine >= 100) cap += 5;
  if (mine >= 425 && mine > theirs) cap -= 5;
  const legalCap = (typeof bidCeilingFor === 'function') ? bidCeilingFor(seat) : maxBid();
  return Math.max(0, Math.min(legalCap, 200, Math.floor(cap/5)*5));
}
function sol7PersonaBidCeiling(base, hand, seat) {
  const style = seatStyle(seat);
  const v = sol7Power(hand);
  let cap = base;
  // Personality may shade a close auction, never replace the intelligence core.
  if (['aggressive','bidHappy','widowFiend','pointHungry','setDog','moonDreamer'].includes(style) && v >= 62) cap += 5;
  if (['safe','passive','sandbag','trumpShy','antiMoon'].includes(style)) cap -= 5;
  if (style === 'scoreHawk') {
    const sc=game.scores||[0,0], me=sc[botSeatTeam(seat)]||0, them=sc[1-botSeatTeam(seat)]||0;
    cap += (them-me>=80 ? 5 : -5);
  }
  if (style === 'quietDealer') cap += (seat === game.dealer ? -5 : (seat === (game.dealer+1)%4 ? 5 : 0));
  // Old hard overrides (bidOnce/climbOnly/passFirst) are intentionally softened.
  // They remain visible as close-decision preferences rather than forced mistakes.
  if (style === 'bidOnce' && game.highestBid >= (minBid||70)) cap -= 5;
  if (style === 'climbOnly' && game.highestBid < (minBid||70)) cap -= 5;
  if (style === 'passFirst' && seat === (game.dealer+1)%4) cap -= 5;
  const legalCap=(typeof bidCeilingFor==='function')?bidCeilingFor(seat):maxBid();
  return Math.max(0,Math.min(legalCap,200,Math.floor(cap/5)*5));
}
function botBid() {
  if (typeof nestAuctionLocked === 'function' && nestAuctionLocked()) return;
  const seat=game.currentPlayer, hand=game.hands[seat];
  const floor=(minBid||70), ask=(game.highestBid||floor-5)+5;
  let cap=sol7PersonaBidCeiling(sol7BidCeiling(hand,seat),hand,seat);
  // Preserve Sol7/production partnership discipline: don't steal partner except with a clearly superior ceiling.
  if (game.bidder===partnerOf(seat) && game.highestBid>=floor && cap < game.highestBid+15) cap=0;
  const bid = cap>=ask ? ask : 0;
  hostProcessBid({player:seat,value:bid});
}
function sol7DiscardKeepScore(card, hand, trump) {
  if (card.color==='rook') return 20000;
  if (isRed2(card)) return 18000;
  if (isTrumpCard(card,trump)) return 5000 + effectiveRank(card)*8 + cardPoints(card)*20;
  const ln=colorLen(hand,card.color), r=card.rank, p=cardPoints(card);
  let control = r===1?1800:r===14?1150:r===13?550:r===12?260:0;
  let counter=p*28;
  const tc=hand.filter(c=>isTrumpCard(c,trump)).length;
  const strong=tc>=6 || hand.some(c=>c.color==='rook') || hand.some(c=>isRed2(c));
  if (p && ln<=2 && r!==1 && r!==14) counter -= strong?260:120;
  const vp=(p===0&&ln===1)?900:(p===0&&ln===2)?520:(p===0&&ln===3)?140:0;
  return control+counter+effectiveRank(card)*2+ln*45-vp;
}
function sol7KeptHand(hand, needed, trump) {
  return hand.slice().sort((a,b)=>sol7DiscardKeepScore(b,hand,trump)-sol7DiscardKeepScore(a,hand,trump)).slice(0,hand.length-needed);
}
function botDiscard() {
  const hand=game.hands[game.bidder].slice(), needed=game.discardCount||6, trump=sol7TrumpColor(hand);
  let kept=sol7KeptHand(hand,needed,trump);
  const style=seatStyle(game.bidder);
  // Hollow/void-oriented personas may finish a short side-suit void only when the
  // swap is very close to Sol7's keep score. This preserves personality without
  // throwing away controls/counters.
  if (style==='voidMaker') {
    const keptSet=new Set(kept.map(c=>c.id));
    const buried=hand.filter(c=>!keptSet.has(c.id));
    const side=COLORS.filter(c=>c!==trump).map(col=>kept.filter(c=>c.color===col&&!isPermanentTrump(c))).filter(g=>g.length===1);
    if (side.length) {
      const victim=side[0][0];
      const candidates=buried.filter(c=>c.color!==victim.color&&!isPermanentTrump(c));
      candidates.sort((a,b)=>sol7DiscardKeepScore(b,hand,trump)-sol7DiscardKeepScore(a,hand,trump));
      const repl=candidates[0];
      if (repl && sol7DiscardKeepScore(victim,hand,trump)-sol7DiscardKeepScore(repl,hand,trump)<=120) {
        kept=kept.filter(c=>c.id!==victim.id).concat([repl]);
      }
    }
  }
  const keepIds=new Set(kept.map(c=>c.id));
  const bury=hand.filter(c=>!keepIds.has(c.id)).slice(0,needed).map(c=>c.id);
  hostProcessDiscard({player:game.bidder,cardIds:bury});
}
function botChooseTrump() {
  const hand=game.hands[game.bidder], base=sol7TrumpColor(hand), style=seatStyle(game.bidder);
  let color=base;
  const ranked=COLORS.slice().sort((a,b)=>sol7TrumpScore(hand,b)-sol7TrumpScore(hand,a));
  // Trick/color-stubborn personas may choose #2 only when it is genuinely close.
  if ((style==='tricky'||style==='colorStubborn') && ranked[1] && sol7TrumpScore(hand,base)-sol7TrumpScore(hand,ranked[1])<=5) color=ranked[1];
  hostProcessTrump({player:game.bidder,color});
}
function sol7PickCard(idx, hand, legal) {
  const tr=game.trump, partner=partnerOf(idx), team=botSeatTeam(idx), trick=game.trick||[];
  const played=[]; (game.tricksTaken||[]).forEach(a=>(a||[]).forEach(c=>played.push(c)));
  trick.forEach(t=>played.push(t.card));
  const visibleNest = idx===game.bidder ? (game.nestCards||[]) : [];
  const used=new Set(); hand.concat(played,visibleNest).forEach(c=>{if(c&&c.id)used.add(c.id);});
  const unseen=((typeof makeDeck==='function')?makeDeck():[]).filter(c=>c&&c.id&&!used.has(c.id));
  const led=trick.length ? (game.ledColor || trick[0].card.color) : null;
  const topRemaining=(c,l)=>!unseen.some(x=>compareCards(x,c,l||c.color,tr)>0);
  const safeLow=(arr)=>lowestCard((arr||[]).filter(c=>!isPermanentTrump(c)).length?(arr||[]).filter(c=>!isPermanentTrump(c)):arr);
  const cheapWin=(arr)=>cheapWinner((arr||[]).filter(c=>!isPermanentTrump(c)).length?(arr||[]).filter(c=>!isPermanentTrump(c)):arr,tr);
  if (!trick.length) {
    const ts=legal.filter(c=>isTrumpCard(c,tr)), plain=ts.filter(c=>!isPermanentTrump(c));
    const outTr=unseen.filter(c=>isTrumpCard(c,tr)).length;
    if (ts.length>=4 && outTr>=2 && plain.length) return lowestCard(plain);
    const side=legal.filter(c=>!isTrumpCard(c,tr));
    if (side.length) {
      const groups={}; COLORS.filter(c=>c!==tr).forEach(c=>groups[c]=side.filter(x=>x.color===c));
      const cols=Object.keys(groups).filter(c=>groups[c].length).sort((a,b)=>groups[b].length-groups[a].length || Math.max(...groups[b].map(effectiveRank))-Math.max(...groups[a].map(effectiveRank)));
      if(cols.length){const g=groups[cols[0]], tops=g.filter(c=>topRemaining(c,cols[0])); if(tops.length)return tops.slice().sort((a,b)=>cardPoints(a)-cardPoints(b)||effectiveRank(a)-effectiveRank(b))[0]; const z=g.filter(c=>cardPoints(c)===0); return lowestCard(z.length?z:g);}
    }
    return safeLow(legal);
  }
  const w=currentTrickWinner(), val=trickPointsSoFar();
  const beat=legal.filter(c=>{const copy=trick.concat([{player:idx,card:c}]); let win=copy[0]; for(let i=1;i<copy.length;i++)if(compareCards(copy[i].card,win.card,led,tr)>0)win=copy[i]; return win.player===idx;});
  if (w && w.player===partner) {
    if (trick.length===3) {const feeds=legal.filter(c=>cardPoints(c)>0&&!isPermanentTrump(c)&&compareCards(c,w.card,led,tr)<=0); if(feeds.length)return highestCounter(feeds);}
    const z=legal.filter(c=>cardPoints(c)===0); return safeLow(z.length?z:legal);
  }
  if (beat.length) {
    if (trick.length===3 || val>=10) return cheapWin(beat);
    const cheap=beat.filter(c=>!isTrumpCard(c,tr)&&cardPoints(c)===0); if(cheap.length)return lowestCard(cheap);
  }
  const follows=hand.some(c=>followsLedSuit(c,led,tr));
  if(!follows && w && botSeatTeam(w.player)!==team && val>=10){const tw=legal.filter(c=>isTrumpCard(c,tr)&&beat.includes(c)); if(tw.length)return cheapWin(tw);}
  const z=legal.filter(c=>cardPoints(c)===0); return safeLow(z.length?z:legal);
}
function sol7PersonaSafe(idx, base, alt, legal) {
  if (!alt || !base || alt.id===base.id) return base;
  const tr=game.trump, trick=game.trick||[], w=currentTrickWinner(), partner=partnerOf(idx), pts=trickPointsSoFar();
  if (isPermanentTrump(alt) && !isPermanentTrump(base) && pts<20) return base;
  if (w && w.player===partner) {
    const baseKills=compareCards(base,w.card,game.ledColor,tr)>0, altKills=compareCards(alt,w.card,game.ledColor,tr)>0;
    if (altKills && !baseKills) return base;
  }
  // On a live trick, don't let persona turn a Sol7 winner into a loser or vice versa
  // unless the pile is small; personality belongs in close decisions.
  if (w) {
    const bw=compareCards(base,w.card,game.ledColor,tr)>0, aw=compareCards(alt,w.card,game.ledColor,tr)>0;
    if (bw!==aw && pts>=10) return base;
  }
  const cost=Math.abs(cardPoints(alt)-cardPoints(base));
  if(cost>10) return base;
  return alt;
}
function botPlay() {
  const idx=game.currentPlayer, hand=game.hands[idx]; if(!hand||!hand.length)return;
  let legal=hand.filter(c=>canPlay(c,hand,game.ledColor,game.trump)); if(!legal.length)legal=hand.slice();
  if(isBuzzed(idx)&&Math.random()<0.42){hostProcessPlay({player:idx,cardId:legal[Math.floor(Math.random()*legal.length)].id});return;}
  const base=sol7PickCard(idx,hand,legal)||legal[0];
  const persona=applyHabitPlay(idx,hand,legal,base);
  const choice=sol7PersonaSafe(idx,base,persona,legal);
  hostProcessPlay({player:idx,cardId:(choice||base||legal[0]).id});
}

function clampHumanCard(idx, legal, card, bookPick) {
  if (!card) return bookPick;
  const trump = game.trump;
  const partnerIdx = partnerOf(idx);
  const winner = currentTrickWinner();
  const partnerWinning = !!(winner && winner.player === partnerIdx);
  // Never dump the Bird or a painted one on an empty lead.
  if (!game.ledColor && (card.color === 'rook' || (typeof isRed1 === 'function' && isRed1(card)))) {
    return bookPick;
  }
  // Never kill partner's winner when the book already had a duck.
  if (partnerWinning && winner && compareCards(card, winner.card, game.ledColor, trump) > 0) {
    return bookPick;
  }
  return card;
}

function applyHabitPlay(idx, hand, legal, bookPick) {
  if (!legal || !legal.length) return bookPick;
  const style = seatStyle(idx);
  if (!style || style === 'balanced') return bookPick;
  if (habitGag(style)) {
    if (botFullPersona() && typeof pickStyledCard === 'function') {
      return clampHumanCard(idx, legal, pickStyledCard(idx, legal), bookPick);
    }
    return bookPick;
  }

  const trump = game.trump;
  const winner = currentTrickWinner();
  const pts = trickPointsSoFar();
  const partnerIdx = partnerOf(idx);
  const partnerWinning = !!(winner && winner.player === partnerIdx);
  const lastToPlay = !!(game.ledColor && game.trick && game.trick.length === 3);
  const beaters = winner
    ? legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) > 0)
    : [];
  const trumps = legal.filter(c => isTrumpCard(c, trump));
  const zeros = legal.filter(c => cardPoints(c) === 0 && !isPermanentTrump(c));
  const off = legal.filter(c => !isTrumpCard(c, trump));
  const colors = (typeof COLORS !== 'undefined') ? COLORS : ['green', 'red', 'yellow', 'black'];

  let habit = null;
  if (style === 'partnerFirst') {
    if (partnerWinning && winner) {
      const ducks = legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) <= 0);
      if (lastToPlay) habit = highestCounter(ducks.length ? ducks : legal);
      else habit = lowestCard((ducks.filter(c => cardPoints(c) === 0).length ? ducks.filter(c => cardPoints(c) === 0) : ducks) || legal);
    }
  } else if (style === 'pointHungry' || style === 'bidHappy') {
    if (beaters.length && pts >= (style === 'bidHappy' ? 5 : 10)) habit = cheapWinner(beaters, trump);
  } else if (style === 'countSaver') {
    if (!lastToPlay && !partnerWinning && zeros.length) habit = lowestCard(zeros);
  } else if (style === 'trumpHeavy' || style === 'aggressive') {
    if (!game.ledColor && trumps.length) {
      const plain = trumps.filter(c => c.color === trump && !isPermanentTrump(c));
      habit = (plain.length ? plain : trumps).slice().sort((a, b) => effectiveRank(b) - effectiveRank(a))[0];
    }
  } else if (style === 'safe' || style === 'passive' || style === 'sandbag') {
    if (!game.ledColor) habit = lowestCard(zeros.length ? zeros : (off.length ? off : legal));
  } else if (style === 'leadLong') {
    if (!game.ledColor) {
      const groups = colors.map(col => legal.filter(c => c.color === col && col !== trump && !isPermanentTrump(c))).filter(g => g.length);
      groups.sort((a, b) => b.length - a.length);
      if (groups[0]) habit = lowestCard(groups[0].filter(c => cardPoints(c) === 0).length ? groups[0].filter(c => cardPoints(c) === 0) : groups[0]);
    }
  } else if (style === 'lastTrick') {
    if (!game.ledColor && hand.length > 3 && off.length) habit = lowestCard(zeros.filter(c => off.indexOf(c) >= 0).length ? zeros.filter(c => off.indexOf(c) >= 0) : off);
  } else if (style === 'rookHunter') {
    const bird = beaters.filter(c => c.color === 'rook' || (typeof isRed2 === 'function' && isRed2(c)) || (typeof isRed1 === 'function' && isRed1(c)));
    if (pts >= 15 && bird.length) habit = bird[0];
  } else if (style === 'voidMaker') {
    if (!partnerWinning && !beaters.length) {
      const shorts = colors.map(col => legal.filter(c => c.color === col && !isPermanentTrump(c))).filter(g => g.length);
      shorts.sort((a, b) => a.length - b.length);
      if (shorts[0] && shorts[0][0].color !== trump) habit = lowestCard(shorts[0]);
    }
  } else if (style === 'tricky' || style === 'midRank') {
    if (!game.ledColor) {
      const mid = legal.filter(c => !cardPoints(c) && effectiveRank(c) >= 8 && !isPermanentTrump(c));
      if (mid.length) habit = mid[Math.floor(mid.length / 2)];
    }
  } else if (style === 'trumpShy') {
    if (!game.ledColor && off.length) habit = lowestCard(zeros.filter(c => off.indexOf(c) >= 0).length ? zeros.filter(c => off.indexOf(c) >= 0) : off);
  } else if (style === 'trumpUp') {
    if (!game.ledColor && trumps.length) {
      const plain = trumps.filter(c => c.color === trump && !isPermanentTrump(c));
      habit = (plain.length ? plain : trumps).slice().sort((a,b)=>effectiveRank(b)-effectiveRank(a))[0];
    }
  } else if (style === 'trumpDown') {
    if (!game.ledColor && trumps.length) {
      const plain = trumps.filter(c => c.color === trump && !isPermanentTrump(c) && cardPoints(c)===0);
      habit = lowestCard(plain.length ? plain : trumps.filter(c => !isPermanentTrump(c)));
    }
  } else if (style === 'shortLead') {
    if (!game.ledColor) {
      const shorts = colors.map(col => legal.filter(c => c.color === col && !isPermanentTrump(c))).filter(g => g.length && g[0].color !== trump);
      shorts.sort((a,b)=>a.length-b.length);
      if (shorts[0]) habit = lowestCard(shorts[0]);
    }
  } else if (style === 'eggSitter') {
    if (!game.ledColor && zeros.length) habit = lowestCard(zeros);
  } else if (style === 'honorCash') {
    const ones = legal.filter(c => c.rank === 1 && !isPermanentTrump(c));
    if (!game.ledColor && ones.length) habit = ones[0];
    if (lastToPlay && ones.length && beaters.indexOf(ones[0]) >= 0) habit = ones[0];
  } else if (style === 'secondHandLow') {
    if (game.trick && game.trick.length === 1 && zeros.length) habit = lowestCard(zeros);
  } else if (style === 'thirdHandHigh') {
    if (game.trick && game.trick.length === 2 && beaters.length) habit = cheapWinner(beaters, trump);
  } else if (style === 'fiveHunter') {
    if (pts === 5 && beaters.length) habit = cheapWinner(beaters, trump);
  } else if (style === 'fourteenHold') {
    if (!lastToPlay && bookPick && bookPick.rank === 14 && zeros.length) habit = lowestCard(zeros);
  } else if (style === 'ruffHappy') {
    if (!partnerWinning && trumps.length && game.ledColor && game.ledColor !== trump) {
      const follow = legal.some(c => followsLedSuit(c, game.ledColor, trump));
      if (!follow) habit = cheapWinner(trumps, trump);
    }
  } else if (style === 'setDog') {
    const oppBid = game.bidder >= 0 && botSeatTeam(game.bidder) !== botSeatTeam(idx);
    if (oppBid && beaters.length && pts >= 5) habit = cheapWinner(beaters, trump);
  } else if (style === 'leftHandVoid') {
    if (!game.ledColor && botCanReadVoids()) {
      for (let i = 0; i < colors.length; i++) {
        const col = colors[i];
        if (col === trump) continue;
        if (isVoid(leftOf(idx), col)) {
          const g = legal.filter(c => c.color === col);
          if (g.length) { habit = lowestCard(g); break; }
        }
      }
    }
  } else if (style === 'partnerSignal') {
    if (!game.ledColor && botCanReadVoids()) {
      const pidx = partnerOf(idx);
      for (let i = 0; i < colors.length; i++) {
        const col = colors[i];
        if (col === trump) continue;
        if (isVoid(pidx, col)) {
          const g = legal.filter(c => c.color === col);
          if (g.length) { habit = lowestCard(g); break; }
        }
      }
    }
  }

  if (botFullPersona() && !habit && typeof pickStyledCard === 'function') {
    habit = pickStyledCard(idx, legal);
  }
  return clampHumanCard(idx, legal, habit, bookPick);
}

function extremePickCard(idx, hand, legal) {
  const trump = game.trump;
  const partnerIdx = partnerOf(idx);
  const myTeam = botSeatTeam(idx);
  const isBidderTeam = game.bidder >= 0 && botSeatTeam(game.bidder) === myTeam;
  const bidAmt = game.bid || game.highestBid || 0;
  const madePts = teamCapturedPoints(myTeam);
  const oppPts = teamCapturedPoints(1 - myTeam);
  const lastGoesNest = (typeof nestGoesTo === 'undefined' || nestGoesTo === 'lastTrick');
  const cardsLeftMine = hand.length;
  const winner = currentTrickWinner();
  const pts = trickPointsSoFar();
  const remainingSeats = game.ledColor ? (4 - game.trick.length) : 3;
  const lastToPlay = !!(game.ledColor && remainingSeats === 1);
  const partnerWinning = !!(winner && winner.player === partnerIdx);
  const oppWinning = !!(winner && botSeatTeam(winner.player) !== myTeam);
  const trInfo = remainingTrumpCount(idx);
  const haveTrumpControl = botCanCount() && (trInfo.mine > trInfo.out || (trInfo.mine >= 3 && trInfo.out <= 2));
  const makersNeed = isBidderTeam ? Math.max(0, bidAmt - madePts) : Math.max(0, bidAmt - oppPts);
  const setFight = isBidderTeam ? (madePts < bidAmt) : (oppPts < bidAmt);
  const honorPartner = partnerNeverKill !== false && botLevel() !== 'easy';
  const feedPartner = partnerFeedLast !== false && botLevel() !== 'easy';

  const trumps = legal.filter(c => isTrumpCard(c, trump));
  const off = legal.filter(c => !isTrumpCard(c, trump));
  const zeros = legal.filter(c => cardPoints(c) === 0);
  const beaters = winner
    ? legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) > 0)
    : [];

  const partnerSafe = (arr) => {
    if (!winner || !honorPartner) return arr.slice();
    const safe = arr.filter(c => compareCards(c, winner.card, game.ledColor, trump) <= 0);
    return safe.length ? safe : arr.slice();
  };

  if (!game.ledColor) {
    const colors = (typeof COLORS !== 'undefined') ? COLORS : ['green', 'red', 'yellow', 'black'];
    if (botCanReadVoids()) {
      for (let i = 0; i < colors.length; i++) {
        const col = colors[i];
        if (col === trump) continue;
        const lhoVoid = isVoid(leftOf(idx), col);
        const rhoVoid = isVoid(rightOf(idx), col);
        const mineCol = legal.filter(c => c.color === col && !isPermanentTrump(c));
        if (!mineCol.length) continue;
        const top = highestAmong(mineCol, col, trump);
        if (lhoVoid && rhoVoid && !isVoid(partnerIdx, col)) {
          const z = mineCol.filter(c => cardPoints(c) === 0);
          if (z.length) return lowestCard(z);
        }
        if ((lhoVoid && !isVoid(leftOf(idx), trump)) || (rhoVoid && !isVoid(rightOf(idx), trump))) continue;
        if (top && isTopRemaining(top, idx, col, trump) && cardPoints(top) >= 10) return top;
      }
    }

    if (isBidderTeam && trumps.length && (haveTrumpControl || trInfo.mine >= 4)) {
      const mid = trumps.slice().sort((a, b) => effectiveRank(b) - effectiveRank(a));
      const plain = mid.filter(c => c.color === trump && !isPermanentTrump(c));
      if (plain.length) return plain[0];
      return mid[mid.length - 1] || trumps[0];
    }

    const groups = [];
    colors.forEach(col => {
      if (col === trump) return;
      const g = off.filter(c => c.color === col);
      if (g.length) groups.push(g);
    });
    groups.sort((a, b) => b.length - a.length);
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const col = g[0].color;
      if (botCanReadVoids() && isVoid(leftOf(idx), col) && !isVoid(leftOf(idx), trump)) continue;
      const z = g.filter(c => cardPoints(c) === 0);
      if (z.length) return lowestCard(z);
    }
    if (zeros.length) {
      const plainZ = zeros.filter(c => !isPermanentTrump(c));
      return lowestCard(plainZ.length ? plainZ : zeros);
    }
    const safeOff = off.length ? off : legal.filter(c => !isPermanentTrump(c));
    return lowestCard(safeOff.length ? safeOff : legal);
  }

  if (partnerWinning && honorPartner) {
    const pool = partnerSafe(legal);
    if (lastToPlay && feedPartner) {
      const feed = pool.filter(c => cardPoints(c) > 0 && !isPermanentTrump(c));
      if (feed.length) return highestCounter(feed);
      return highestCounter(pool) || lowestCard(pool);
    }
    const ducks = pool.filter(c => cardPoints(c) === 0 && !isPermanentTrump(c));
    if (ducks.length) return lowestCard(ducks);
    return lowestCard(pool);
  }

  if (lastToPlay) {
    if (beaters.length && (pts > 0 || (lastGoesNest && cardsLeftMine === 1))) {
      if (cardsLeftMine === 1 || pts >= 15) {
        return beaters.find(c => isTopRemaining(c, idx, game.ledColor, trump)) || cheapWinner(beaters, trump);
      }
      return cheapWinner(beaters, trump);
    }
    const junk = legal.filter(c => cardPoints(c) === 0 && !isPermanentTrump(c));
    return lowestCard(junk.length ? junk : legal);
  }

  if (oppWinning && beaters.length) {
    const fat = pts >= 10 || (pts >= 5 && makersNeed > 0 && (isBidderTeam || setFight));
    if (fat) {
      const huge = pts >= 20 || (game.trick || []).some(t => isPermanentTrump(t.card));
      if (!huge && botLevel() !== 'easy') {
        const noBird = beaters.filter(c => c.color !== 'rook' && !isRed1(c));
        if (noBird.length) return cheapWinner(noBird, trump);
      }
      return cheapWinner(beaters, trump);
    }
    if (pts === 0 && zeros.length) {
      const duck = zeros.filter(c => beaters.indexOf(c) < 0 && !isPermanentTrump(c));
      if (duck.length) return lowestCard(duck);
    }
    if (setFight && pts >= 5) return cheapWinner(beaters, trump);
  }

  const followingLed = legal.some(c => followsLedSuit(c, game.ledColor, trump));
  if (!followingLed && trumps.length && oppWinning && pts >= 10) {
    const ruffBeat = trumps.filter(c => beaters.indexOf(c) >= 0);
    const cheapRuff = cheapWinner(ruffBeat.length ? ruffBeat : trumps, trump);
    if (cheapRuff && !(isPermanentTrump(cheapRuff) && pts < 20 && trumps.length > 1)) return cheapRuff;
  }

  const sluffPool = legal.filter(c => !isPermanentTrump(c));
  const sluffZeros = sluffPool.filter(c => cardPoints(c) === 0);
  const pool = sluffZeros.length ? sluffZeros : (sluffPool.length ? sluffPool : legal);
  pool.sort((a, b) => {
    const la = colorLen(hand, a.color);
    const lb = colorLen(hand, b.color);
    const va = (a.color !== trump && la <= 2) ? -30 : 0;
    const vb = (b.color !== trump && lb <= 2) ? -30 : 0;
    return (va - vb) || (cardPoints(a) - cardPoints(b)) || (effectiveRank(a) - effectiveRank(b));
  });
  return pool[0] || legal[0];
}

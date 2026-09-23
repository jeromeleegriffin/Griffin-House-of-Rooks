/* House of Rooks — extracted module | Author: Jerome Griffin */
/* bots: bid, nest discard, play
 *
 * Extreme difficulty is a partnership card-counting engine.
 * Personas (names, avatars, table talk) stay, but Extreme ignores
 * botStyle for bidding, nest, trump, and card play. Hard / Normal /
 * Easy still use persona styles.
 */

function extremeOn() {
  return typeof botDifficulty === 'string' && botDifficulty === 'extreme';
}

function botSeatTeam(seat) {
  const p = players[seat];
  if (p && typeof p.team === 'number') return p.team;
  return seat % 2;
}

function partnerOf(seat) {
  return (seat + 2) % 4;
}

function leftOf(seat) {
  return (seat + 1) % 4;
}

function rightOf(seat) {
  return (seat + 3) % 4;
}

function isVoid(seat, color) {
  return !!(knownVoids[seat] && color && knownVoids[seat][color]);
}

function teamCapturedPoints(team) {
  const pile = (game && game.tricksTaken && game.tricksTaken[team]) || [];
  let n = 0;
  for (let i = 0; i < pile.length; i++) n += cardPoints(pile[i]);
  return n;
}

function nestPointsForBidder(seat) {
  if (!game || seat !== game.bidder) return 0;
  const nest = game.nestCards || game.nestRevealCards || [];
  let n = 0;
  for (let i = 0; i < nest.length; i++) n += cardPoints(nest[i]);
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
  const taken = game.tricksTaken || [];
  (taken[0] || []).forEach(push);
  (taken[1] || []).forEach(push);
  if (seat === game.bidder) {
    (game.nestCards || []).forEach(push);
  }
  if (typeof openWidow !== 'undefined' && openWidow && game.nestPreview) {
    game.nestPreview.forEach(push);
  }
  return seen;
}

function extremeUnseen(seat) {
  const deck = (typeof makeDeck === 'function') ? makeDeck() : [];
  const seen = extremeSeenCards(seat);
  const used = {};
  seen.forEach(c => { if (c && c.id) used[c.id] = true; });
  return deck.filter(c => c && c.id && !used[c.id]);
}

function remainingTrumpCount(seat) {
  const trump = game && game.trump;
  const unseen = extremeUnseen(seat);
  const mine = ((game.hands && game.hands[seat]) || []).filter(c => isTrumpCard(c, trump));
  return {
    mine: mine.length,
    out: unseen.filter(c => isTrumpCard(c, trump)).length
  };
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
  if (!card) return false;
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
    const ra = effectiveRank(a), rb = effectiveRank(b);
    return (sa - sb) || (pa - pb) || (ra - rb);
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

/* Distribution and long trump beat a pile of stray honors. Voids are
 * ruffing power. Off-suit counters are mostly defensive. Nest EV is
 * added separately because the widow is unseen at bid time. */

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
  const nestEv = Math.min(36, Math.max(18, Math.round(deckPts * 0.14)));
  ev += nestEv;
  ev += Math.min(40, Math.round((deckPts - ownPts) * 0.18));
  ev = Math.max(0, Math.min(deckPts, ev));

  return {
    analysis: a,
    trump,
    trumpLen: t.length,
    honors,
    ones,
    fourteens,
    ownPts,
    goodTrump,
    marks,
    ev,
    nestEv
  };
}

function botBid() {
  const hand = game.hands[game.currentPlayer];
  const botStyle = players[game.currentPlayer]?.botStyle || 'balanced';
  const ceiling = (typeof bidCeilingFor === 'function') ? bidCeilingFor(game.currentPlayer) : maxBid();
  const floor = (minBid || 70);
  const nextMin = game.highestBid + 5;

  if (extremeOn()) {
    extremeBid(hand, floor, ceiling, nextMin);
    return;
  }

  if (botDifficulty !== 'hard') {
    let strength = 0;
    const byColor = { green: 0, red: 0, yellow: 0, black: 0 };
    hand.forEach(c => {
      if (c.color === 'rook') strength += 28;
      else if (isRed2(c) || isRed1(c)) strength += 24;
      else {
        byColor[c.color] = (byColor[c.color] || 0) + 1;
        if (c.rank >= 12) strength += 8;
        else if (c.rank >= 10) strength += 4;
        else if (c.rank === 5) strength += 2;
      }
    });
    if (botDifficulty === 'easy') strength *= 0.82;
    let bid = 0;
    if (strength > 38 && game.highestBid < ceiling - 10) {
      bid = Math.min(ceiling, game.highestBid + 5 + (Math.random() < 0.4 ? 5 : 0));
    } else if (strength > 26 && game.highestBid < 160) {
      bid = game.highestBid + 5;
    } else if (game.highestBid < floor && Math.random() < (botDifficulty === 'easy' ? 0.62 : 0.82)) {
      bid = floor;
    }
    bid = applyStyleToBid(botStyle, strength, bid, floor, ceiling, nextMin, game.highestBid);
    hostProcessBid({ player: game.currentPlayer, value: bid });
    return;
  }

  const { value, trump: estTrump, analysis } = estimateHandValue(hand);
  let nestBoost = 24;
  if (botStyle === 'bidHappy' || botStyle === 'aggressive') nestBoost += 10;
  if (botStyle === 'safe' || botStyle === 'passive') nestBoost -= 8;
  let target = Math.floor((value + nestBoost) / 5) * 5;
  target = Math.max(floor, Math.min(ceiling, target));

  const partnerSeat = (game.currentPlayer + 2) % 4;
  if (dontStealPartnerBid !== false && game.bidder === partnerSeat && game.highestBid >= floor) {
    const trumpLen = ((analysis && analysis.byColor && analysis.byColor[estTrump]) || []).length;
    const power = value >= 70 && (analysis.rook || analysis.red1 || trumpLen >= 6);
    const stealOk = (botStyle === 'bidHappy' || botStyle === 'aggressive')
      ? value >= game.highestBid + 10
      : (power && value >= game.highestBid + 25);
    if (!stealOk) {
      hostProcessBid({ player: game.currentPlayer, value: 0 });
      return;
    }
  }

  let bid = 0;
  const openingThreshold = Math.max(44, floor - 46);
  if (game.highestBid < floor && value >= openingThreshold) {
    bid = floor;
  } else if (nextMin <= ceiling && (target >= nextMin - 20 || value >= openingThreshold)) {
    bid = nextMin;
    if (bid > target + 30) bid = 0;
  }
  if (bid > 0 && value < openingThreshold) bid = 0;
  bid = applyStyleToBid(botStyle, value, bid, floor, ceiling, nextMin, game.highestBid);
  hostProcessBid({ player: game.currentPlayer, value: bid });
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

  let raw = info.ev;
  if (info.trumpLen >= 7) raw += 12;
  else if (info.trumpLen <= 3) raw -= 18;
  if (info.marks >= 4) raw += 10;
  if (info.marks <= 1) raw -= 15;
  raw -= 12;
  let want = Math.floor(raw / 5) * 5;
  want = Math.max(0, Math.min(ceiling, want));

  if (theyNeed <= floor + 20 && info.marks >= 2) {
    want = Math.max(want, floor);
  }
  if (needToWin <= floor && info.marks >= 2 && info.goodTrump) {
    want = Math.max(want, floor);
  }

  if (dontStealPartnerBid !== false && game.bidder === partnerSeat && game.highestBid >= floor) {
    const steal = (info.trumpLen >= 7 && info.honors >= 3)
      || (info.ev >= game.highestBid + 35 && info.goodTrump && (info.analysis.rook || info.trumpLen >= 6));
    if (!steal) {
      hostProcessBid({ player: seat, value: 0 });
      return;
    }
  }

  let bid = 0;
  if (game.highestBid < floor) {
    if (info.marks >= 2 || info.ev >= floor - 8 || (info.goodTrump && info.ev >= floor - 25)) {
      bid = floor;
    }
  } else if (nextMin <= ceiling) {
    if (want >= nextMin) {
      if (info.marks >= 4 && info.ev >= nextMin + 20 && nextMin + 10 <= ceiling) {
        bid = nextMin + 10;
      } else {
        bid = nextMin;
      }
    } else if (want + 15 >= nextMin && info.goodTrump && info.marks >= 3) {
      bid = nextMin;
    }
  }

  if (bid > 0 && bid > info.ev + 20 && bid > floor) {
    bid = (game.highestBid < floor) ? floor : 0;
    if (bid > info.ev + 25) bid = 0;
  }

  if (typeof isShootMoonBid === 'function' && isShootMoonBid(bid)) {
    if (!(info.trumpLen >= 7 && info.analysis.rook && info.marks >= 4)) bid = Math.max(0, ceiling - 20);
  }

  hostProcessBid({ player: seat, value: bid });
}

function botDiscard() {
  const hand = game.hands[game.bidder].slice();
  const needed = game.discardCount || 5;
  const trump = bestTrumpColor(hand);

  if (extremeOn()) {
    extremeDiscard(hand, needed, trump);
    return;
  }

  if (botDifficulty !== 'hard') {
    const scored = hand.map(c => {
      let score = c.rank;
      if (c.color === 'rook') score = 1000;
      else if (isRed1(c) || isRed2(c)) score = 900;
      else if (c.rank === 14 || c.rank === 10) score += 50;
      else if (c.rank === 5 || c.rank === 1) score += 20;
      return { card: c, score };
    });
    scored.sort((a, b) => a.score - b.score);
    hostProcessDiscard({ player: game.bidder, cardIds: scored.slice(0, needed).map(s => s.card.id) });
    return;
  }

  const keepScore = (c) => {
    if (c.color === 'rook') return 10000;
    if (isRed1(c) || isRed2(c)) return 9000;
    if (c.color === trump) return 5000 + effectiveRank(c) + cardPoints(c) * 3;
    const p = cardPoints(c);
    if (p >= 10) return 2000 + p * 10;
    if (p === 5) return 800;
    const len = hand.filter(x => x.color === c.color).length;
    let s = effectiveRank(c) + (len <= 2 ? -40 : 0);
    const style = botPersonaStyle(game.bidder);
    if (style === 'voidMaker' && len <= 2 && c.color !== trump) s -= 80;
    if (style === 'trumpHeavy' && c.color === trump) s += 2500;
    if (style === 'pointHungry' && cardPoints(c) >= 10) s += 1500;
    if (style === 'safe' && cardPoints(c) >= 10) s += 900;
    if (style === 'aggressive' && c.color !== trump && !cardPoints(c)) s -= 20;
    return s;
  };

  const ranked = hand.map(c => ({ card: c, score: keepScore(c) }));
  ranked.sort((a, b) => a.score - b.score);
  const discard = [];
  for (const item of ranked) {
    if (discard.length >= needed) break;
    if (item.card.color === 'rook' || isRed1(item.card) || isRed2(item.card)) continue;
    discard.push(item.card.id);
  }
  for (const item of ranked) {
    if (discard.length >= needed) break;
    if (discard.includes(item.card.id)) continue;
    discard.push(item.card.id);
  }
  hostProcessDiscard({ player: game.bidder, cardIds: discard.slice(0, needed) });
}

function extremeDiscard(hand, needed, trump) {
  const colors = (typeof COLORS !== 'undefined') ? COLORS : ['green', 'red', 'yellow', 'black'];
  const lastTrickLikely = (() => {
    const t = hand.filter(c => isTrumpCard(c, trump));
    const top = highestAmong(t, trump, trump);
    return t.length >= 5 || (top && (isPermanentTrump(top) || effectiveRank(top) >= 14));
  })();

  const buryScore = (c) => {
    if (!c) return 0;
    if (c.color === 'rook' || isRed1(c) || isRed2(c)) return 100000;
    if (c.color === trump || isPermanentTrump(c)) {
      return 20000 + effectiveRank(c) + cardPoints(c) * 4;
    }
    const len = colorLen(hand, c.color);
    const p = cardPoints(c);
    let s = 200 + effectiveRank(c);
    if (len === 1) s -= 80;
    else if (len === 2) s -= 50;
    else if (len === 3) s -= 10;
    else s += 20;
    if (p >= 10 && len <= 2) s -= 35;
    if (p === 5 && len <= 2) s -= 25;
    if (c.rank === 1 && len >= 2) s += 400;
    if (c.rank === 1 && len === 1) s += 80;
    if (lastTrickLikely && p > 0 && len <= 2) s -= 20;
    if (!lastTrickLikely && p >= 10 && len >= 3) s += 120;
    return s;
  };

  const pick = [];
  const picked = new Set();
  const rank = hand.map(c => ({ card: c, score: buryScore(c) }));
  rank.sort((a, b) => a.score - b.score);

  colors.forEach(col => {
    if (col === trump) return;
    const group = hand.filter(c => c.color === col && !isPermanentTrump(c));
    if (group.length > 0 && group.length <= 3 && pick.length + group.length <= needed) {
      group.sort((a, b) => buryScore(a) - buryScore(b));
      group.forEach(c => {
        if (pick.length >= needed) return;
        pick.push(c.id);
        picked.add(c.id);
      });
    }
  });

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
    picked.add(c.id);
  }
  hostProcessDiscard({ player: game.bidder, cardIds: pick.slice(0, needed) });
}

function botChooseTrump() {
  const hand = game.hands[game.bidder];
  if (extremeOn()) {
    hostProcessTrump({ player: game.bidder, color: bestTrumpColor(hand) });
    return;
  }
  const style = botPersonaStyle(game.bidder);
  const color = styleTrumpColor(hand, style) || bestTrumpColor(hand);
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

function botPlay() {
  const idx = game.currentPlayer;
  const hand = game.hands[idx];
  if (!hand || !hand.length) return;

  let legal = hand.filter(c => canPlay(c, hand, game.ledColor, game.trump));
  if (legal.length === 0) legal = hand.slice();

  if (isBuzzed(idx) && Math.random() < 0.42) {
    hostProcessPlay({ player: idx, cardId: legal[Math.floor(Math.random() * legal.length)].id });
    return;
  }

  if (extremeOn() && !isBuzzed(idx)) {
    const choice = extremePickCard(idx, hand, legal);
    hostProcessPlay({ player: idx, cardId: (choice || legal[0] || hand[0]).id });
    return;
  }

  const isHard = !isBuzzed(idx) && botDifficulty === 'hard';
  const partnerIdx = (idx + 2) % 4;
  const myTeam = players[idx].team;
  const isBidderTeam = game.bidder >= 0 && players[game.bidder].team === myTeam;
  const trump = game.trump;

  const styled = pickStyledCard(idx, legal);
  if (styled) {
    hostProcessPlay({ player: idx, cardId: styled.id });
    return;
  }

  if (!isHard) {
    const winner = currentTrickWinner();
    const partnerWinning = winner && winner.player === partnerIdx;
    const remaining = 4 - game.trick.length;
    let choice;
    if (!game.ledColor) {
      const safe = legal.filter(c => cardPoints(c) === 0);
      safe.sort((a, b) => (a.rank || 0) - (b.rank || 0));
      choice = safe[0] || legal[Math.floor(legal.length / 2)] || legal[0];
    } else if (partnerWinning) {
      let pool = legal.slice();
      if (partnerNeverKill !== false && winner) {
        const safe = legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) <= 0);
        if (safe.length) pool = safe;
      }
      if (partnerFeedLast !== false && remaining === 1) {
        pool.sort((a, b) => cardPoints(b) - cardPoints(a) || (a.rank || 0) - (b.rank || 0));
        choice = pool[0];
      } else {
        pool.sort((a, b) => cardPoints(a) - cardPoints(b) || (a.rank || 0) - (b.rank || 0));
        choice = pool[0];
      }
    } else {
      const pts = trickPointsSoFar();
      const beaters = legal.filter(c => winner && compareCards(c, winner.card, game.ledColor, trump) > 0);
      if (pts >= 10 && beaters.length) {
        beaters.sort((a, b) => cardPoints(a) - cardPoints(b) || (a.rank || 0) - (b.rank || 0));
        choice = beaters[0];
      } else {
        legal.sort((a, b) => cardPoints(a) - cardPoints(b) || (a.rank || 0) - (b.rank || 0));
        choice = legal[0];
      }
    }
    hostProcessPlay({ player: idx, cardId: (choice || hand[0]).id });
    return;
  }

  const strength = (c) => {
    let s = effectiveRank(c);
    if (c.color === 'rook') s = rookLowest ? -50 : 500;
    if (isRed1(c)) s = 600;
    if (isRed2(c)) s = 450;
    if (c.color === trump || isPermanentTrump(c)) s += 200;
    return s;
  };

  let choice = null;

  if (!game.ledColor) {
    const trumps = legal.filter(c => c.color === trump || isPermanentTrump(c));
    const off = legal.filter(c => c.color !== trump && !isPermanentTrump(c));
    if (isBidderTeam && trumps.length) {
      trumps.sort((a, b) => strength(a) - strength(b));
      choice = trumps[0];
    } else {
      const safe = off.filter(c => cardPoints(c) === 0);
      safe.sort((a, b) => strength(a) - strength(b));
      choice = safe[0] || off.sort((a, b) => strength(a) - strength(b))[0] || legal[0];
    }
  } else {
    const winner = currentTrickWinner();
    const partnerWinning = winner && winner.player === partnerIdx;
    const pts = trickPointsSoFar();
    const remaining = 4 - game.trick.length;
    const winners = legal.filter(c => {
      if (!winner) return true;
      return compareCards(c, winner.card, game.ledColor, game.trump) > 0;
    });

    if (partnerWinning && (partnerNeverKill !== false || partnerFeedLast !== false)) {
      let pool = legal.slice();
      if (partnerNeverKill !== false && winner) {
        const safe = legal.filter(c => compareCards(c, winner.card, game.ledColor, game.trump) <= 0);
        if (safe.length) pool = safe;
      }
      if (partnerFeedLast !== false && remaining === 1) {
        const feed = pool.slice().sort((a, b) => cardPoints(b) - cardPoints(a) || strength(a) - strength(b));
        const counters = feed.filter(c => cardPoints(c) > 0 && !isPermanentTrump(c));
        choice = (counters[0] || feed[0]);
      } else {
        const ducks = pool.filter(c => cardPoints(c) === 0);
        ducks.sort((a, b) => strength(a) - strength(b));
        choice = ducks[0] || pool.sort((a, b) => strength(a) - strength(b))[0];
      }
    } else if (winners.length && (pts >= 10 || remaining === 0 || pts >= 5)) {
      winners.sort((a, b) => strength(a) - strength(b));
      choice = winners[0];
    } else {
      const canRuff = game.ledColor !== trump && legal.some(c => c.color === trump || isPermanentTrump(c));
      if (canRuff && pts >= 10 && !partnerWinning) {
        const ruffs = legal.filter(c => c.color === trump || isPermanentTrump(c));
        ruffs.sort((a, b) => strength(a) - strength(b));
        choice = ruffs[0];
      } else {
        const junk = legal.filter(c => !isPermanentTrump(c) && cardPoints(c) === 0);
        const soft = legal.filter(c => !isPermanentTrump(c));
        const pool = junk.length ? junk : soft.length ? soft : legal;
        pool.sort((a, b) => strength(a) - strength(b));
        choice = pool[0];
      }
    }
  }

  if (!choice) choice = legal[0] || hand[0];
  hostProcessPlay({ player: idx, cardId: choice.id });
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
  const haveTrumpControl = trInfo.mine > trInfo.out || (trInfo.mine >= 3 && trInfo.out <= 2);
  const makersNeed = isBidderTeam ? Math.max(0, bidAmt - madePts) : Math.max(0, bidAmt - oppPts);
  const setFight = isBidderTeam ? (madePts < bidAmt) : (oppPts < bidAmt);

  const trumps = legal.filter(c => isTrumpCard(c, trump));
  const off = legal.filter(c => !isTrumpCard(c, trump));
  const zeros = legal.filter(c => cardPoints(c) === 0);
  const beaters = winner
    ? legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) > 0)
    : [];

  const partnerSafe = (arr) => {
    if (!winner || partnerNeverKill === false) return arr.slice();
    const safe = arr.filter(c => compareCards(c, winner.card, game.ledColor, trump) <= 0);
    return safe.length ? safe : arr.slice();
  };

  if (!game.ledColor) {
    const colors = (typeof COLORS !== 'undefined') ? COLORS : ['green', 'red', 'yellow', 'black'];
    for (let i = 0; i < colors.length; i++) {
      const col = colors[i];
      if (col === trump) continue;
      const lhoVoid = isVoid(leftOf(idx), col);
      const rhoVoid = isVoid(rightOf(idx), col);
      const bothOppVoid = lhoVoid && rhoVoid;
      const lhoTrumpVoid = isVoid(leftOf(idx), trump);
      const rhoTrumpVoid = isVoid(rightOf(idx), trump);
      const mineCol = legal.filter(c => c.color === col && !isPermanentTrump(c));
      if (!mineCol.length) continue;
      const top = highestAmong(mineCol, col, trump);
      if (bothOppVoid && !isVoid(partnerIdx, col)) {
        const z = mineCol.filter(c => cardPoints(c) === 0);
        if (z.length) return lowestCard(z);
      }
      if ((lhoVoid && !lhoTrumpVoid) || (rhoVoid && !rhoTrumpVoid)) {
        continue;
      }
      if (top && isTopRemaining(top, idx, col, trump) && cardPoints(top) >= 10) {
        return top;
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
      if (isVoid(leftOf(idx), col) && !isVoid(leftOf(idx), trump)) continue;
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

  if (partnerWinning) {
    const pool = partnerSafe(legal);
    if (lastToPlay && partnerFeedLast !== false) {
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
        const sure = beaters.find(c => isTopRemaining(c, idx, game.ledColor, trump)) || cheapWinner(beaters, trump);
        return sure || cheapWinner(beaters, trump);
      }
      return cheapWinner(beaters, trump);
    }
    const junk = legal.filter(c => cardPoints(c) === 0 && !isPermanentTrump(c));
    return lowestCard(junk.length ? junk : legal);
  }

  if (oppWinning && beaters.length) {
    const fat = pts >= 10 || (pts >= 5 && makersNeed > 0 && (isBidderTeam || setFight));
    const overRuffRisk = !lastToPlay && game.ledColor !== trump;
    if (fat) {
      const huge = pts >= 20 || (game.trick || []).some(t => isPermanentTrump(t.card));
      if (!huge) {
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
    if (overRuffRisk && pts < 10) {
      const duck = legal.filter(c => cardPoints(c) === 0 && !isPermanentTrump(c));
      if (duck.length) return lowestCard(duck);
    }
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

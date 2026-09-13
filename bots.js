/* House of Rooks — extracted module | Author: Jerome Griffin */
/* bots: bid, nest discard, play */
function botBid() {
  const hand = game.hands[game.currentPlayer];
  const botStyle = players[game.currentPlayer]?.botStyle || 'balanced';
  const ceiling = maxBid();
  const floor = (minBid || 70);
  const nextMin = game.highestBid + 5;

  if (botDifficulty !== 'extreme' && botDifficulty !== 'hard') {
    // Original simple logic for easy/normal
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
    const longest = Math.max(...Object.values(byColor));
    if (botDifficulty === 'easy') strength *= 0.82;
    let bid = 0;
    if (strength > 46 && game.highestBid < ceiling - 15) {
      bid = Math.min(ceiling, game.highestBid + 5 + (Math.random() < 0.35 ? 5 : 0));
    } else if (strength > 32 && game.highestBid < 120) {
      bid = game.highestBid + 5;
    } else if (game.highestBid < floor && Math.random() < (botDifficulty === 'easy' ? 0.48 : 0.68)) {
      bid = floor;
    }
    bid = applyStyleToBid(botStyle, strength, bid, floor, ceiling, nextMin, game.highestBid);
    hostProcessBid({ player: game.currentPlayer, value: bid });
    return;
  }

  // Extreme / Hard: distribution + counters estimate
  const { value, trump: estTrump, analysis } = estimateHandValue(hand);
  // Nest expected value ~15–25 average counters
  let nestBoost = botDifficulty === 'extreme' ? 24 : 18;
  if (botStyle === 'bidHappy' || botStyle === 'aggressive') nestBoost += 10;
  if (botStyle === 'safe' || botStyle === 'passive') nestBoost -= 8;
  let target = Math.floor((value + nestBoost) / 5) * 5;
  target = Math.max(floor, Math.min(ceiling, target));

  // Partner already owns the auction → don't steal (option on by default)
  const partnerSeat = (game.currentPlayer + 2) % 4;
  if (dontStealPartnerBid !== false && game.bidder === partnerSeat && game.highestBid >= floor) {
    // Only take over with a clear power hand well above partner's bid
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
  // Open at the floor when the hand has enough real strength to justify
  // owning the auction. The old 35-point cutoff made bots pass even with
  // useful Rook/special/long-trump combinations.
  const openingThreshold = botDifficulty === 'extreme' ? Math.max(44, floor - 46) : Math.max(50, floor - 40);
  if (game.highestBid < floor && value >= openingThreshold) {
    bid = floor;
  } else if (target > game.highestBid && nextMin <= ceiling) {
    // Bid just enough to stay alive, with a controlled jump on monster hands.
    if (botDifficulty === 'extreme' && value >= 88 && nextMin + 10 <= ceiling) {
      bid = Math.min(ceiling, nextMin + 10);
    } else {
      bid = nextMin;
    }
    // Never bid materially beyond the hand's estimated ceiling.
    if (bid > target + 15) bid = 0;
  }
  // Hard remains disciplined, but should still compete with a legitimate hand.
  if (botDifficulty === 'hard' && bid > 0 && value < openingThreshold) bid = 0;
  bid = applyStyleToBid(botStyle, value, bid, floor, ceiling, nextMin, game.highestBid);

  hostProcessBid({ player: game.currentPlayer, value: bid });
}

function botDiscard() {
  const hand = game.hands[game.bidder].slice();
  const needed = game.discardCount || 5;
  const trump = bestTrumpColor(hand);

  if (botDifficulty !== 'extreme' && botDifficulty !== 'hard') {
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

  // Extreme: create voids, keep trump & counters, dump weak off-suit
  const keepScore = (c) => {
    if (c.color === 'rook') return 10000;
    if (isRed1(c) || isRed2(c)) return 9000;
    if (c.color === trump) return 5000 + effectiveRank(c) + cardPoints(c) * 3;
    const p = cardPoints(c);
    if (p >= 10) return 2000 + p * 10; // keep high counters off-suit for defense
    if (p === 5) return 800;
    // Prefer discarding from shortest non-trump suits to void
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
  // Never discard permanent trumps if we can avoid it
  const discard = [];
  for (const item of ranked) {
    if (discard.length >= needed) break;
    if (item.card.color === 'rook' || isRed1(item.card) || isRed2(item.card)) continue;
    discard.push(item.card.id);
  }
  // Fill remaining only if forced
  for (const item of ranked) {
    if (discard.length >= needed) break;
    if (discard.includes(item.card.id)) continue;
    discard.push(item.card.id);
  }
  hostProcessDiscard({ player: game.bidder, cardIds: discard.slice(0, needed) });
}

function botChooseTrump() {
  const hand = game.hands[game.bidder];
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
  if (!hand || hand.length === 0) return;

  let legal = hand.filter(c => canPlay(c, hand, game.ledColor, game.trump));
  if (legal.length === 0) legal = hand.slice();

  if (isBuzzed(idx) && Math.random() < 0.42) {
    hostProcessPlay({ player: idx, cardId: legal[Math.floor(Math.random() * legal.length)].id });
    return;
  }

  const isExtreme = !isBuzzed(idx) && (botDifficulty === 'extreme' || botDifficulty === 'hard');
  const botStyle = botPersonaStyle(idx);
  const myTeam = players[idx].team;

  const styled = pickStyledCard(idx, legal);
  if (styled) {
    hostProcessPlay({ player: idx, cardId: styled.id });
    return;
  }
  const partnerIdx = (idx + 2) % 4;
  const isBidderTeam = game.bidder >= 0 && players[game.bidder].team === myTeam;
  const trump = game.trump;

  if (!isExtreme) {
    // Partner-aware play for easy/normal
    const winner = currentTrickWinner();
    const partnerWinning = winner && winner.player === partnerIdx;
    const remaining = 4 - game.trick.length;
    let choice;
    if (!game.ledColor) {
      const safe = legal.filter(c => cardPoints(c) === 0);
      safe.sort((a, b) => (a.rank || 0) - (b.rank || 0));
      choice = safe[0] || legal[Math.floor(legal.length / 2)] || legal[0];
    } else if (partnerWinning) {
      // Never beat partner when option on
      let pool = legal.slice();
      if (partnerNeverKill !== false && winner) {
        const safe = legal.filter(c => compareCards(c, winner.card, game.ledColor, trump) <= 0);
        if (safe.length) pool = safe;
      }
      if (partnerFeedLast !== false && remaining === 1) {
        // Last to play — feed highest counter that still doesn't beat partner
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

  // ---- Leading ----
  if (!game.ledColor) {
    const trumps = legal.filter(c => c.color === trump || isPermanentTrump(c));
    const off = legal.filter(c => c.color !== trump && !isPermanentTrump(c));
    // Extreme: lead into opponent voids when known
    if (botDifficulty === 'extreme') {
      const opp = [(idx + 1) % 4, (idx + 3) % 4];
      for (const col of COLORS) {
        if (col === trump) continue;
        const bothVoid = opp.every(o => knownVoids[o] && knownVoids[o][col]);
        const have = off.filter(c => c.color === col && cardPoints(c) === 0);
        if (bothVoid && have.length) {
          have.sort((a, b) => strength(a) - strength(b));
          choice = have[0];
        }
      }
    }
    if (choice) {
      hostProcessPlay({ player: idx, cardId: choice.id });
      return;
    }
    if (isBidderTeam && trumps.length) {
      // Strategy: lead trump early to draw enemy trump (especially extreme)
      if (botDifficulty === 'extreme') {
        // Lead mid/high trump, save Rook for capturing counters
        const nonRook = trumps.filter(c => c.color !== 'rook' && !isRed1(c));
        nonRook.sort((a, b) => strength(b) - strength(a));
        choice = nonRook[0] || trumps[0];
      } else {
        trumps.sort((a, b) => strength(a) - strength(b));
        choice = trumps[0];
      }
    } else {
      // Lead low non-counter off-suit
      const safe = off.filter(c => cardPoints(c) === 0);
      safe.sort((a, b) => strength(a) - strength(b));
      choice = safe[0] || off.sort((a, b) => strength(a) - strength(b))[0] || legal[0];
    }
  } else {
    // ---- Following ----
    const winner = currentTrickWinner();
    const partnerWinning = winner && winner.player === partnerIdx;
    const pts = trickPointsSoFar();
    const remaining = 4 - game.trick.length; // players left after me

    // Cards that can beat current winner
    const winners = legal.filter(c => {
      if (!winner) return true;
      return compareCards(c, winner.card, game.ledColor, game.trump) > 0;
    });

    if (partnerWinning && (partnerNeverKill !== false || partnerFeedLast !== false)) {
      // Partner has it — never kill the winner; feed if last
      let pool = legal.slice();
      if (partnerNeverKill !== false && winner) {
        const safe = legal.filter(c => compareCards(c, winner.card, game.ledColor, game.trump) <= 0);
        if (safe.length) pool = safe;
      }
      if (partnerFeedLast !== false && remaining === 1) {
        // Last seat: dump highest counter that still loses to partner
        const feed = pool.slice().sort((a, b) => cardPoints(b) - cardPoints(a) || strength(a) - strength(b));
        // Prefer real counters; avoid permanent tops unless needed
        const counters = feed.filter(c => cardPoints(c) > 0 && !isPermanentTrump(c));
        choice = (counters[0] || feed[0]);
      } else {
        const ducks = pool.filter(c => cardPoints(c) === 0);
        ducks.sort((a, b) => strength(a) - strength(b));
        choice = ducks[0] || pool.sort((a, b) => strength(a) - strength(b))[0];
      }
    } else if (winners.length && (pts >= 10 || remaining === 0 || pts >= 5)) {
      // Worth taking: play cheapest winner
      winners.sort((a, b) => strength(a) - strength(b));
      // Extreme: if huge points (Rook on table), use enough power
      if (botDifficulty === 'extreme' && pts >= 20) {
        winners.sort((a, b) => strength(b) - strength(a));
        choice = winners[0];
      } else {
        choice = winners[0];
      }
    } else if (winners.length && botDifficulty === 'extreme' && pts === 0 && remaining > 0) {
      // Low-point trick mid-way — underplay if we have low cards
      const low = legal.filter(c => cardPoints(c) === 0 && !winners.includes(c));
      low.sort((a, b) => strength(a) - strength(b));
      choice = low[0] || winners.sort((a, b) => strength(a) - strength(b))[0];
    } else {
      // Void of led + trump in hand → ruff if points on table (extreme)
      const canRuff = game.ledColor !== trump && legal.some(c => c.color === trump || isPermanentTrump(c));
      if (botDifficulty === 'extreme' && canRuff && pts >= 10 && !partnerWinning) {
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


const CLOUD_AVATARS = new Set(["anchor", "ash", "barrel", "blaze", "bramble", "brandy", "cobalt", "copper", "dice", "drift", "ember", "emberlyn", "fang", "finch", "flint", "frost", "gable", "grit", "halo", "harrier", "hearth", "hm01", "hm02", "hm03", "hm04", "hm05", "hm06", "hm07", "hm08", "hm09", "hm10", "hm11", "hm12", "hm13", "hm14", "hm15", "hm16", "hm17", "hm18", "hm19", "hm20", "hm21", "hm22", "hm23", "hm24", "hm25", "hm26", "hm27", "hm28", "hm29", "hm30", "hm31", "hm32", "hollow", "hw01", "hw02", "hw03", "hw04", "hw05", "hw06", "hw07", "hw08", "hw09", "hw10", "hw11", "hw12", "hw13", "hw14", "hw15", "hw16", "hw17", "hw18", "hw19", "hw20", "hw21", "hw22", "hw23", "hw24", "hw25", "hw26", "hw27", "hw28", "hw29", "hw30", "hw31", "hw32", "ivy", "jerome_founder", "marrow", "moss", "moth", "nettle", "nix", "pebble", "pike", "quill", "rita", "rookery", "sable", "shade", "spark", "thistle", "titan", "vex", "wager", "willow"]);
function safeAvatar(value) { return typeof value === "string" && CLOUD_AVATARS.has(value) ? value : "cinder"; }
function safeVoice(v) { return ["avatar","male","female","silent"].includes(v) ? v : "avatar"; }
function safeOptions(o = {}) { const targetScore = o.targetScore ?? 500; if (!Number.isInteger(targetScore) || targetScore < 1 || targetScore > 2000) throw Error("INVALID_TARGET_SCORE"); const result = {targetScore}; for (const k of ["includeRed2","revealTopNest","shootMoonEnabled"]) { if (o[k] !== undefined) { if (typeof o[k] !== "boolean") throw Error("INVALID_OPTIONS"); result[k] = o[k]; } } return result; }
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.mjs
import { DurableObject } from "cloudflare:workers";

// ../server/rules.mjs
var COLORS = Object.freeze(["green", "red", "yellow", "black"]);
var RANKS = Object.freeze([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
var POINT_VALUES = Object.freeze({ 5: 5, 10: 10, 14: 10, rook: 20 });
var DEFAULT_RULES = Object.freeze({
  includeOnes: true,
  includeRed2: true,
  red2Points: 20,
  includeRed1: false,
  includeRook: true,
  onesHigh: true,
  rookLowest: false,
  specialsAnytime: false,
  mustTrumpWhenVoid: false
});
function resolveRules(options = {}) {
  return { ...DEFAULT_RULES, ...options };
}
__name(resolveRules, "resolveRules");
function isRed2(card) {
  return !!card && card.id === "red-2";
}
__name(isRed2, "isRed2");
function isRed1(card) {
  return !!card && (card.id === "red1-special" || card.specialRed1 === true);
}
__name(isRed1, "isRed1");
function effectiveRank(card, options = DEFAULT_RULES) {
  const rules = resolveRules(options);
  if (!card) return 0;
  if (card.color === "rook") return rules.rookLowest ? -1 : 1e3;
  if (isRed1(card)) return 1001;
  if (isRed2(card)) return 999;
  if (rules.onesHigh && card.rank === 1) return 15;
  return card.rank;
}
__name(effectiveRank, "effectiveRank");
function makeDeck(options = DEFAULT_RULES) {
  const rules = resolveRules(options);
  const deck = [];
  for (const color of COLORS) {
    for (const rank of RANKS) deck.push({ color, rank, id: `${color}-${rank}` });
    if (rules.includeOnes) deck.push({ color, rank: 1, id: `${color}-1` });
  }
  if (rules.includeRed2) deck.push({ color: "red", rank: 2, id: "red-2" });
  if (rules.includeRed1) {
    deck.push({ color: "red", rank: 1, id: "red1-special", specialRed1: true });
  }
  if (rules.includeRook) deck.push({ color: "rook", rank: 99, id: "rook" });
  return deck;
}
__name(makeDeck, "makeDeck");
function cardPoints(card, options = DEFAULT_RULES) {
  const rules = resolveRules(options);
  if (!card) return 0;
  if (card.color === "rook" || card.id === "rook") return 20;
  if (isRed1(card)) return 30;
  if (isRed2(card) || card.id === "red-2") return parseInt(rules.red2Points, 10) || 20;
  if (card.rank === 1 || card.rank === "1") return rules.includeOnes ? 15 : 0;
  const rank = parseInt(card.rank, 10);
  return POINT_VALUES[rank] || 0;
}
__name(cardPoints, "cardPoints");
function isPermanentTrump(card, options = DEFAULT_RULES) {
  const rules = resolveRules(options);
  if (!card) return false;
  if (card.color === "rook" || card.id === "rook") return !!rules.includeRook;
  if (isRed2(card)) return !!rules.includeRed2;
  if (isRed1(card)) return !!rules.includeRed1;
  return false;
}
__name(isPermanentTrump, "isPermanentTrump");
function compareCards(a, b, ledColor, trump, options = DEFAULT_RULES) {
  const rules = resolveRules(options);
  const aIsTrump = isPermanentTrump(a, rules) || a.color === trump;
  const bIsTrump = isPermanentTrump(b, rules) || b.color === trump;
  if (aIsTrump && !bIsTrump) return 1;
  if (!aIsTrump && bIsTrump) return -1;
  if (aIsTrump && bIsTrump) {
    if (rules.rookLowest) {
      if (isRed1(a) && !isRed1(b)) return 1;
      if (isRed1(b) && !isRed1(a)) return -1;
      if (isRed2(a) && !isRed2(b) && b.color !== "rook") return 1;
      if (isRed2(b) && !isRed2(a) && a.color !== "rook") return -1;
      if (a.color === "rook") return -1;
      if (b.color === "rook") return 1;
      return effectiveRank(a, rules) - effectiveRank(b, rules);
    }
    if (isRed1(a)) return 1;
    if (isRed1(b)) return -1;
    if (a.color === "rook") return 1;
    if (b.color === "rook") return -1;
    if (isRed2(a)) return 1;
    if (isRed2(b)) return -1;
    return effectiveRank(a, rules) - effectiveRank(b, rules);
  }
  if (a.color === ledColor && b.color !== ledColor) return 1;
  if (a.color !== ledColor && b.color === ledColor) return -1;
  if (a.color === ledColor && b.color === ledColor) {
    return effectiveRank(a, rules) - effectiveRank(b, rules);
  }
  return 0;
}
__name(compareCards, "compareCards");
function isSpecialCard(card, options = DEFAULT_RULES) {
  const rules = resolveRules(options);
  if (!card) return false;
  if (card.color === "rook" || card.id === "rook") return !!rules.includeRook;
  if (isRed2(card)) return !!rules.includeRed2;
  if (isRed1(card)) return !!rules.includeRed1;
  return false;
}
__name(isSpecialCard, "isSpecialCard");
function isTrumpCard(card, trump, options = DEFAULT_RULES) {
  if (!card) return false;
  if (isSpecialCard(card, options)) return true;
  return trump && card.color === trump;
}
__name(isTrumpCard, "isTrumpCard");
function followsLedSuit(card, ledColor, trump, options = DEFAULT_RULES) {
  if (!card || !ledColor) return false;
  if (isSpecialCard(card, options)) return !!(trump && ledColor === trump);
  return card.color === ledColor;
}
__name(followsLedSuit, "followsLedSuit");
function canPlay(card, hand, ledColor, trump, options = DEFAULT_RULES) {
  const rules = resolveRules(options);
  if (!ledColor) return true;
  if (rules.specialsAnytime && isSpecialCard(card, rules)) return true;
  const hasLedColor = hand.some((c) => followsLedSuit(c, ledColor, trump, rules));
  if (hasLedColor) return followsLedSuit(card, ledColor, trump, rules);
  const hasTrump = hand.some((c) => isTrumpCard(c, trump, rules));
  if (rules.mustTrumpWhenVoid && hasTrump) return isTrumpCard(card, trump, rules);
  return true;
}
__name(canPlay, "canPlay");

// ../server/deal.mjs
var SEATS = 4;
var DEFAULT_HAND_SIZE = 10;
var DEFAULT_NEST_SIZE = 6;
var MAX_DEAL_ATTEMPTS = 12;
function secureRandomIndex(length) {
  if (!Number.isInteger(length) || length < 1 || length > 4294967296) {
    throw new RangeError("Invalid random index range");
  }
  const range = 4294967296;
  const limit = Math.floor(range / length) * length;
  const sample = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return sample[0] % length;
}
__name(secureRandomIndex, "secureRandomIndex");
function secureShuffle(cards) {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
__name(secureShuffle, "secureShuffle");
function randomDealerSeat() {
  return secureRandomIndex(SEATS);
}
__name(randomDealerSeat, "randomDealerSeat");
function splitDeal(deck, handSize, nestSize) {
  const needed = handSize * SEATS;
  if (deck.length < needed) throw new Error("DECK_TOO_SMALL");
  let nestCount = Math.max(0, deck.length - needed);
  if (nestCount < 1 && deck.length > needed) nestCount = deck.length - needed;
  if (deck.length >= needed + nestSize) nestCount = nestSize;
  const nest = deck.splice(0, nestCount);
  while (deck.length > needed) nest.push(deck.pop());
  const hands = [];
  for (let seat = 0; seat < SEATS; seat++) hands.push(deck.splice(0, handSize));
  return { hands, nest };
}
__name(splitDeal, "splitDeal");
function dealHand({
  rules: ruleOptions = {},
  handSize = DEFAULT_HAND_SIZE,
  nestSize = DEFAULT_NEST_SIZE,
  misdealOnNoCounters = true,
  deckFactory = makeDeck,
  shuffle = secureShuffle
} = {}) {
  if (!Number.isInteger(handSize) || handSize < 1) throw new Error("INVALID_HAND_SIZE");
  if (!Number.isInteger(nestSize) || nestSize < 0) throw new Error("INVALID_NEST_SIZE");
  const rules = resolveRules(ruleOptions);
  const maxAttempts = misdealOnNoCounters ? MAX_DEAL_ATTEMPTS : 1;
  let deal;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const deck = shuffle(deckFactory(rules));
    deal = splitDeal(deck, handSize, nestSize);
    deal.attempts = attempt;
    const anyEmptyCounterHand = deal.hands.some((hand) => !hand.some((card) => cardPoints(card, rules) > 0));
    if (!misdealOnNoCounters || !anyEmptyCounterHand || attempt === maxAttempts) return deal;
  }
  return deal;
}
__name(dealHand, "dealHand");
function firstActorSeat(dealer) {
  const value = Number(dealer);
  return (Number.isFinite(value) ? value + 1 : 0) % SEATS;
}
__name(firstActorSeat, "firstActorSeat");

// ../server/auction.mjs
var SEATS2 = 4;
function passedCount(status) {
  return status.filter((value) => value === "pass").length;
}
__name(passedCount, "passedCount");
function nextActiveSeat(currentPlayer, status) {
  for (let step = 1; step <= SEATS2; step++) {
    const seat = (currentPlayer + step) % SEATS2;
    if (status[seat] !== "pass") return seat;
  }
  return null;
}
__name(nextActiveSeat, "nextActiveSeat");
function finish(state, event) {
  return { accepted: true, event, state: { ...state, phase: "discard" } };
}
__name(finish, "finish");
function allPassed(state, options) {
  if (options.screwTheDealer) {
    const bid = options.minBid;
    const bidStatus = [...state.bidStatus];
    bidStatus[state.dealer] = bid;
    return {
      accepted: true,
      event: "dealer-forced-bid",
      state: {
        ...state,
        phase: "discard",
        bidder: state.dealer,
        bid,
        highestBid: bid,
        bidStatus,
        passCount: passedCount(state.bidStatus)
      }
    };
  }
  return {
    accepted: true,
    event: "all-passed-redeal",
    state: { ...state, phase: "redeal" }
  };
}
__name(allPassed, "allPassed");
function applyBid(input, seat, submittedValue, rawOptions = {}) {
  const rules = rawOptions.rules || {};
  const derivedMaxBid = makeDeck(rules).reduce((sum, card) => sum + cardPoints(card, rules), 0);
  const options = {
    minBid: 100,
    shootMoonEnabled: true,
    screwTheDealer: false,
    scores: rawOptions.scores ?? input?.scores ?? [0, 0],
    ...rawOptions,
    maxBid: Number.isInteger(rawOptions.maxBid) ? rawOptions.maxBid : derivedMaxBid
  };
  const state = {
    bidStatus: [null, null, null, null],
    highestBid: options.minBid - 5,
    bid: 0,
    bidder: -1,
    shotTheMoon: false,
    ...input
  };
  if (!state || state.phase !== "bidding") return { accepted: false, reason: "NOT_BIDDING", state: input };
  if (state.paused) return { accepted: false, reason: "PAUSED", state: input };
  if ((options.auctionOpen ?? state.auctionOpen) === false) return { accepted: false, reason: "AUCTION_NOT_OPEN", state: input };
  if (!Number.isInteger(seat) || seat < 0 || seat >= SEATS2) return { accepted: false, reason: "INVALID_SEAT", state: input };
  if (seat !== state.currentPlayer) return { accepted: false, reason: "NOT_YOUR_TURN", state: input };
  if (state.bidStatus[seat] === "pass") return { accepted: false, reason: "ALREADY_PASSED", state: input };
  const value = submittedValue === 0 ? 0 : typeof submittedValue === "number" || typeof submittedValue === "string" ? Number(submittedValue) : NaN;
  if (!Number.isInteger(value)) return { accepted: false, reason: "INVALID_BID", state: input };
  if (value !== 0) {
    const high = Number.parseInt(state.highestBid ?? state.bid, 10);
    if (value <= high || value > options.maxBid || value % 5 !== 0) {
      return { accepted: false, reason: "ILLEGAL_BID", state: input };
    }
    const isMoonBid = !!options.shootMoonEnabled && value === options.maxBid;
    const team = seat % 2;
    const next2 = {
      ...state,
      highestBid: value,
      bid: value,
      bidder: seat,
      bidStatus: [...state.bidStatus],
      shotTheMoon: isMoonBid
    };
    next2.bidStatus[seat] = value;
    if (isMoonBid) return finish(next2, "moon-bid-won-auction");
    return advanceOrFinish(next2, options, "bid-accepted");
  }
  const next = {
    ...state,
    bidStatus: [...state.bidStatus]
  };
  next.bidStatus[seat] = "pass";
  const passes = passedCount(next.bidStatus);
  next.passCount = passes;
  if (next.bidder >= 0 && passes >= 3) return finish(next, "auction-won-by-high-bidder");
  if (passes >= 4) return allPassed(next, options);
  return advanceOrFinish(next, options, "player-passed");
}
__name(applyBid, "applyBid");
function advanceOrFinish(state, options, event) {
  const passed = passedCount(state.bidStatus);
  if (state.bidder >= 0 && passed >= 3) return finish(state, "auction-won-by-high-bidder");
  if (passed >= 4) return allPassed(state, options);
  const nextSeat = nextActiveSeat(state.currentPlayer, state.bidStatus);
  if (nextSeat === null) {
    return state.bidder >= 0 ? finish(state, "auction-won-by-high-bidder") : allPassed(state, options);
  }
  const next = { ...state, currentPlayer: nextSeat };
  if (next.bidder >= 0 && next.bidStatus.every((status, index) => index === next.bidder || status === "pass")) {
    return finish(next, "auction-won-by-high-bidder");
  }
  return { accepted: true, event, state: next };
}
__name(advanceOrFinish, "advanceOrFinish");

// ../server/game.mjs
var clone = /* @__PURE__ */ __name((value) => structuredClone(value), "clone");
var teamForSeat = /* @__PURE__ */ __name((seat) => seat % 2, "teamForSeat");
var DEFAULT_GAME_OPTIONS = Object.freeze({
  targetScore: 500,
  handSize: 10,
  nestSize: 6,
  minBid: 100,
  includeOnes: DEFAULT_RULES.includeOnes,
  revealTopNest: true,
  openWidow: false,
  shootMoonEnabled: true,
  screwTheDealer: false,
  leadOrder: "bidder",
  nestGoesTo: "lastTrick",
  bidOnlyScoring: false,
  sandbagging: false,
  misdealOnNoCounters: true,
  layDownWinningCards: true
});
function normalizeOptions(options = {}) {
  const ruleOptions = { ...options.rules || {} };
  for (const key of [
    "includeOnes",
    "includeRed2",
    "red2Points",
    "includeRed1",
    "includeRook",
    "onesHigh",
    "rookLowest",
    "specialsAnytime",
    "mustTrumpWhenVoid"
  ]) {
    if (options[key] !== void 0) ruleOptions[key] = options[key];
  }
  return {
    ...DEFAULT_GAME_OPTIONS,
    ...options,
    rules: resolveRules(ruleOptions)
  };
}
__name(normalizeOptions, "normalizeOptions");
function dealState(state, dealer, handNumber, shuffleOverride) {
  const deal = dealHand({
    rules: state.settings.rules,
    handSize: state.settings.handSize,
    nestSize: state.settings.nestSize,
    misdealOnNoCounters: state.settings.misdealOnNoCounters,
    shuffle: shuffleOverride
  });
  return {
    ...state,
    handNumber,
    dealer,
    phase: "bidding",
    hands: deal.hands,
    nest: deal.nest,
    nestPreview: null,
    nestCards: null,
    nestRevealCards: null,
    widowSpread: [],
    discardCount: 0,
    bidder: -1,
    bid: 0,
    highestBid: state.settings.minBid - 5,
    bidStatus: [null, null, null, null],
    passCount: 0,
    shotTheMoon: false,
    claimDeclined: false,
    trump: null,
    currentPlayer: firstActorSeat(dealer),
    trick: [],
    ledColor: null,
    tricksTaken: [[], []],
    topNestCard: state.settings.revealTopNest ? deal.nest[0] || null : null,
    dealAttempts: deal.attempts,
    lastSummary: null,
    lastTrickWinner: null
  };
}
__name(dealState, "dealState");
function createMatch(seats, options = {}, testHooks = {}) {
  if (!Array.isArray(seats) || seats.length !== 4 || seats.some((s) => !s || typeof s.playerId !== "string" || !s.playerId || typeof s.name !== "string" || !s.name.trim())) {
    throw new Error("FOUR_PLAYERS_REQUIRED");
  }
  if (new Set(seats.map((s) => s.playerId)).size !== 4) throw new Error("DUPLICATE_PLAYER_ID");
  const settings = normalizeOptions(options);
  if (!Number.isInteger(settings.targetScore) || settings.targetScore < 1) throw new Error("INVALID_TARGET_SCORE");
  if (!Number.isInteger(settings.minBid) || settings.minBid < 1 || settings.minBid % 5 !== 0) throw new Error("INVALID_MIN_BID");
  if (!(/* @__PURE__ */ new Set(["bidder", "leftOfBidder", "rightOfBidder"])).has(settings.leadOrder)) throw new Error("INVALID_LEAD_ORDER");
  if (!(/* @__PURE__ */ new Set(["lastTrick", "bidder"])).has(settings.nestGoesTo)) throw new Error("INVALID_NEST_DESTINATION");
  const state = {
    settings,
    players: seats.map((player, seat) => ({
      seat,
      playerId: String(player.playerId),
      name: player.name.trim().slice(0, 40),
      team: teamForSeat(seat),
      isBot: player.isBot === true,
      avatar: player.avatar, voice: player.voice
    })),
    scores: [0, 0],
    sandbagOverpoints: [0, 0],
    matchResult: null,
    handNumber: 1
  };
  const dealer = Number.isInteger(testHooks.dealer) ? testHooks.dealer : randomDealerSeat();
  return dealState(state, dealer, 1, testHooks.shuffle);
}
__name(createMatch, "createMatch");
function prepareDiscard(state) {
  const hand = state.hands[state.bidder];
  const nest = state.nest;
  if (!hand || state.bidder < 0) throw new Error("INVALID_BIDDER");
  const hands = state.hands.map((cards, seat) => seat === state.bidder ? [...cards, ...nest] : cards);
  return {
    ...state,
    phase: "discard",
    hands,
    nestPreview: clone(nest),
    nest: [],
    nestCards: null,
    nestRevealCards: null,
    topNestCard: null,
    widowSpread: state.settings.openWidow ? clone(nest) : [],
    discardCount: nest.length,
    currentPlayer: state.bidder
  };
}
__name(prepareDiscard, "prepareDiscard");
function submitBid(state, seat, value) {
  const result = applyBid(state, seat, value, {
    minBid: state.settings.minBid,
    shootMoonEnabled: state.settings.shootMoonEnabled,
    screwTheDealer: state.settings.screwTheDealer,
    scores: state.scores,
    rules: state.settings.rules
  });
  if (!result.accepted) return result;
  if (result.state.phase === "discard") return { ...result, state: prepareDiscard(result.state) };
  return result;
}
__name(submitBid, "submitBid");
function discardCards(state, seat, requestedIds) {
  if (state.phase !== "discard") return { accepted: false, reason: "NOT_DISCARDING", state };
  if (seat !== state.bidder) return { accepted: false, reason: "NOT_BIDDER", state };
  if (!Array.isArray(requestedIds)) return { accepted: false, reason: "INVALID_DISCARD", state };
  const ids = [...new Set(requestedIds.map((value) => String(value)))];
  if (ids.length !== state.discardCount) return { accepted: false, reason: "WRONG_DISCARD_COUNT", state };
  const requested = new Set(ids);
  const hand = state.hands[seat];
  const discarded = hand.filter((card) => requested.has(String(card.id)));
  if (discarded.length !== state.discardCount) return { accepted: false, reason: "CARD_NOT_IN_HAND", state };
  const remaining = hand.filter((card) => !requested.has(String(card.id)));
  const hands = state.hands.map((cards, index) => index === seat ? remaining : cards);
  const snapshot = clone(discarded);
  return {
    accepted: true,
    event: "discard-complete",
    state: {
      ...state,
      phase: "trump",
      hands,
      nestCards: snapshot,
      nestRevealCards: clone(snapshot),
      nestDiscardCount: snapshot.length,
      currentPlayer: seat
    }
  };
}
__name(discardCards, "discardCards");
function chooseTrump(state, seat, color) {
  if (state.phase !== "trump") return { accepted: false, reason: "NOT_CHOOSING_TRUMP", state };
  if (seat !== state.bidder) return { accepted: false, reason: "NOT_BIDDER", state };
  if (!COLORS.includes(color)) return { accepted: false, reason: "INVALID_TRUMP", state };
  let currentPlayer;
  if (state.settings.leadOrder === "bidder") currentPlayer = state.bidder;
  else if (state.settings.leadOrder === "rightOfBidder") currentPlayer = (state.bidder + 3) % 4;
  else currentPlayer = (state.bidder + 1) % 4;
  return {
    accepted: true,
    event: "trump-chosen",
    state: {
      ...state,
      phase: "play",
      trump: color,
      currentPlayer,
      trick: [],
      ledColor: null,
      tricksTaken: [[], []]
    }
  };
}
__name(chooseTrump, "chooseTrump");
function matchResult(scores, target) {
  const [a, b] = scores;
  if (a >= target || b >= target) {
    if (a >= target && b >= target) return a === b ? "Tie" : a > b ? "Team A" : "Team B";
    return a >= target ? "Team A" : "Team B";
  }
  if (a <= -target || b <= -target) {
    if (a <= -target && b <= -target) return a === b ? "Tie" : a > b ? "Team A" : "Team B";
    return a <= -target ? "Team B" : "Team A";
  }
  return null;
}
__name(matchResult, "matchResult");
function finishHand(state, lastWinner) {
  const settings = state.settings;
  const nestTeam = settings.nestGoesTo === "bidder" ? state.bidder % 2 : lastWinner % 2;
  const tricksTaken = state.tricksTaken.map((cards) => [...cards]);
  if (state.nestCards?.length) tricksTaken[nestTeam].push(...state.nestCards);
  const pointsA = tricksTaken[0].reduce((sum, card) => sum + cardPoints(card, settings.rules), 0);
  const pointsB = tricksTaken[1].reduce((sum, card) => sum + cardPoints(card, settings.rules), 0);
  const expected = makeDeck(settings.rules).reduce((sum, card) => sum + cardPoints(card, settings.rules), 0);
  if (pointsA + pointsB !== expected) throw new Error("COUNTER_TOTAL_MISMATCH");
  const bidderTeam = state.bidder % 2;
  const makerPoints = bidderTeam === 0 ? pointsA : pointsB;
  const opponentPoints = bidderTeam === 0 ? pointsB : pointsA;
  const scores = [...state.scores];
  const sandbagOverpoints = [...state.sandbagOverpoints];
  let made = makerPoints >= state.bid;
  let makerDelta = -state.bid;
  let sandbagOverAdded = 0;
  let sandbagDeduction = 0;
  if (made) {
    makerDelta = makerPoints;
    if (settings.bidOnlyScoring) makerDelta = state.bid;
    else if (settings.sandbagging && makerPoints > state.bid) {
      sandbagOverAdded = Math.floor((makerPoints - state.bid) / 10) * 10;
      sandbagOverpoints[bidderTeam] += sandbagOverAdded;
      const wholePenalties = Math.floor(sandbagOverpoints[bidderTeam] / 100);
      if (wholePenalties > 0) {
        sandbagDeduction = wholePenalties * 100;
        sandbagOverpoints[bidderTeam] %= 100;
      }
      makerDelta -= sandbagDeduction;
    }
  }
  scores[bidderTeam] += makerDelta;
  scores[1 - bidderTeam] += opponentPoints;
  let shotMoonResult = null;
  if (state.shotTheMoon) {
    shotMoonResult = made ? "made" : "failed";
    if (made) {
      const bonus = Math.max(0, settings.targetScore - scores[bidderTeam]);
      scores[bidderTeam] += bonus;
      makerDelta += bonus;
    }
  }
  const result = matchResult(scores, settings.targetScore);
  const summary = {
    pointsA,
    pointsB,
    bid: state.bid,
    bidderTeam,
    made,
    trump: state.trump,
    scores,
    scoreDeltaA: bidderTeam === 0 ? makerDelta : opponentPoints,
    scoreDeltaB: bidderTeam === 1 ? makerDelta : opponentPoints,
    shotTheMoon: !!state.shotTheMoon,
    shotMoonResult,
    sandbagOverAdded,
    sandbagDeduction,
    nestTeam,
    matchResult: result
  };
  return {
    ...state,
    phase: result ? "complete" : "score",
    scores,
    sandbagOverpoints,
    tricksTaken,
    nestTeam,
    lastTrickWinner: lastWinner,
    matchResult: result,
    lastSummary: summary
  };
}
__name(finishHand, "finishHand");
function cardIsDefiniteWinner(state, card, seat) {
  if (!state?.hands || !card) return false;
  const { trump, settings } = state;
  const ledColor = isTrumpCard(card, trump, settings.rules) ? trump || card.color : card.color;
  if (!ledColor) return false;
  for (let opponentSeat = 0; opponentSeat < 4; opponentSeat++) {
    if (opponentSeat === seat) continue;
    const opponentHand = state.hands[opponentSeat] || [];
    const mustFollow = opponentHand.some((candidate) => followsLedSuit(candidate, ledColor, trump, settings.rules));
    for (const opponentCard of opponentHand) {
      if (!opponentCard) continue;
      if (isTrumpCard(card, trump, settings.rules)) {
        if (isTrumpCard(opponentCard, trump, settings.rules) && compareCards(opponentCard, card, trump, trump, settings.rules) > 0) return false;
        continue;
      }
      if (opponentCard.color === card.color && compareCards(opponentCard, card, card.color, trump, settings.rules) > 0) return false;
      if (!mustFollow && isTrumpCard(opponentCard, trump, settings.rules)) return false;
    }
  }
  return true;
}
__name(cardIsDefiniteWinner, "cardIsDefiniteWinner");
function getRemainingClaim(state) {
  if (!state || !state.settings.layDownWinningCards || state.phase !== "play" || state.claimDeclined || state.trick?.length || !state.hands) return null;
  const remaining = state.hands.reduce((sum, hand) => sum + (hand?.length || 0), 0);
  if (remaining < 2 || Math.max(...state.hands.map((hand) => hand?.length || 0)) <= 1) return null;
  const force = [];
  for (let seat = 0; seat < 4; seat++) {
    const hand = state.hands[seat] || [];
    const opponentsHaveCards = state.hands.reduce((sum, other, index) => sum + (index === seat ? 0 : other?.length || 0), 0);
    if (hand.length && (!opponentsHaveCards || hand.every((card) => cardIsDefiniteWinner(state, card, seat)))) {
      force.push(seat);
    }
  }
  const trumpHolders = [];
  for (let seat = 0; seat < 4; seat++) {
    if ((state.hands[seat] || []).some((card) => isTrumpCard(card, state.trump, state.settings.rules))) trumpHolders.push(seat);
  }
  const trumpHolder = trumpHolders.length === 1 ? trumpHolders[0] : null;
  if (force.length === 1) {
    const seat = force[0];
    return { seat, reason: trumpHolder === seat ? "trumps" : "rest" };
  }
  if (trumpHolder !== null && force.includes(trumpHolder)) return { seat: trumpHolder, reason: "trumps" };
  return null;
}
__name(getRemainingClaim, "getRemainingClaim");
function claimRemainingCards(state, seat) {
  const claim = getRemainingClaim(state);
  if (!claim || claim.seat !== seat || state.currentPlayer !== seat) {
    return { accepted: false, reason: "CLAIM_NOT_AVAILABLE", state };
  }
  const claimCards = [
    ...(state.trick || []).map((entry) => clone(entry.card)),
    ...state.hands.flat().map(clone)
  ];
  const tricksTaken = state.tricksTaken.map((cards) => [...cards]);
  tricksTaken[state.players[seat].team].push(...claimCards);
  const claimed = {
    ...state,
    hands: [[], [], [], []],
    trick: [],
    ledColor: null,
    currentPlayer: seat,
    tricksTaken,
    lastTrickWinner: seat
  };
  return {
    accepted: true,
    event: "remaining-cards-claimed",
    reason: claim.reason,
    state: finishHand(claimed, seat)
  };
}
__name(claimRemainingCards, "claimRemainingCards");
function declineRemainingClaim(state, seat) {
  const claim = getRemainingClaim(state);
  if (!claim || claim.seat !== seat || state.currentPlayer !== seat) {
    return { accepted: false, reason: "CLAIM_NOT_AVAILABLE", state };
  }
  return {
    accepted: true,
    event: "remaining-claim-declined",
    state: { ...state, claimDeclined: true }
  };
}
__name(declineRemainingClaim, "declineRemainingClaim");
function playCard(state, seat, cardId) {
  if (state.phase !== "play") return { accepted: false, reason: "NOT_PLAYING", state };
  if (seat !== state.currentPlayer) return { accepted: false, reason: "NOT_YOUR_TURN", state };
  const hand = state.hands[seat];
  const index = hand.findIndex((card2) => String(card2.id) === String(cardId));
  if (index < 0) return { accepted: false, reason: "CARD_NOT_IN_HAND", state };
  const card = hand[index];
  if (!canPlay(card, hand, state.ledColor, state.trump, state.settings.rules)) {
    return { accepted: false, reason: "ILLEGAL_CARD", state };
  }
  const hands = state.hands.map((cards) => [...cards]);
  hands[seat].splice(index, 1);
  const trick = [...state.trick, { player: seat, card: clone(card) }];
  let ledColor = state.ledColor;
  if (!ledColor) {
    ledColor = card.color === "rook" || isRed2(card) || isRed1(card) ? state.trump : card.color;
  }
  if (trick.length < 4) {
    return {
      accepted: true,
      event: "card-played",
      state: { ...state, hands, trick, ledColor, currentPlayer: (seat + 1) % 4 }
    };
  }
  let winner = trick[0];
  for (let i = 1; i < trick.length; i++) {
    if (compareCards(trick[i].card, winner.card, ledColor, state.trump, state.settings.rules) > 0) winner = trick[i];
  }
  const winnerTeam = winner.player % 2;
  const tricksTaken = state.tricksTaken.map((cards) => [...cards]);
  tricksTaken[winnerTeam].push(...trick.map((entry) => clone(entry.card)));
  const next = {
    ...state,
    hands,
    trick: [],
    ledColor: null,
    currentPlayer: winner.player,
    tricksTaken,
    lastTrickWinner: winner.player
  };
  if (hands.every((cards) => cards.length === 0)) {
    return { accepted: true, event: "hand-complete", state: finishHand(next, winner.player) };
  }
  return { accepted: true, event: "trick-complete", state: next };
}
__name(playCard, "playCard");
function redeal(state) {
  if (state.phase !== "redeal") return { accepted: false, reason: "NOT_REDEALING", state };
  return { accepted: true, event: "redeal-started", state: dealState(state, state.dealer, state.handNumber) };
}
__name(redeal, "redeal");
function startNextHand(state) {
  if (state.phase !== "score") return { accepted: false, reason: "NOT_READY_FOR_NEXT_HAND", state };
  if (state.matchResult) return { accepted: false, reason: "MATCH_COMPLETE", state };
  return {
    accepted: true,
    event: "next-hand-started",
    state: dealState(state, (state.dealer + 3) % 4, state.handNumber + 1)
  };
}
__name(startNextHand, "startNextHand");
function playerView(state, seat) {
  if (!Number.isInteger(seat) || seat < 0 || seat >= 4) throw new Error("INVALID_SEAT");
  const bidderView = seat === state.bidder;
  const remainingClaim = getRemainingClaim(state);
  return {
    phase: state.phase,
    revision: state.revision,
    handNumber: state.handNumber,
    players: state.players.map(({ seat: playerSeat, name, team, isBot, avatar, voice }) => ({ seat: playerSeat, name, team, isBot: !!isBot, avatar, voice })),
    dealer: state.dealer,
    currentPlayer: state.currentPlayer,
    hand: clone(state.hands[seat]),
    handCounts: state.hands.map((hand) => hand.length),
    bid: state.bid,
    highestBid: state.highestBid,
    bidder: state.bidder,
    bidStatus: clone(state.bidStatus),
    passCount: state.passCount,
    trump: state.trump,
    trick: clone(state.trick),
    ledColor: state.ledColor,
    // Captured card values are public, so expose only the two team totals.
    // The approved game's bidding dock needs these to show live bid progress.
    handPoints: state.tricksTaken.map(
      (cards) => cards.reduce((sum, card) => sum + cardPoints(card, state.settings.rules), 0)
    ),
    scores: [...state.scores],
    targetScore: state.settings.targetScore, rules: state.settings.rules, revealTopNest: state.settings.revealTopNest, shotTheMoon: !!state.shotTheMoon, shootMoonEnabled: state.settings.shootMoonEnabled,
    nestCount: state.nest.length,
    discardCount: bidderView && state.phase === "discard" ? state.discardCount : null,
    topNestCard: state.phase === "bidding" && state.settings.revealTopNest ? clone(state.topNestCard) : null,
    nestPreview: bidderView && state.phase === "discard" ? clone(state.nestPreview) : null,
    widowSpread: state.settings.openWidow && state.phase === "discard" ? clone(state.widowSpread) : [],
    nestCards: ["score", "complete"].includes(state.phase) ? clone(state.nestCards) : null,
    lastSummary: ["score", "complete"].includes(state.phase) ? clone(state.lastSummary) : null,
    matchResult: state.matchResult,
    canClaimRemaining: !!remainingClaim && remainingClaim.seat === seat && state.currentPlayer === seat,
    remainingClaimReason: remainingClaim?.seat === seat && state.currentPlayer === seat ? remainingClaim.reason : null
  };
}
__name(playerView, "playerView");

// ../server/bots.mjs
function chooseTestBotAction(state, seat) {
  const hand = state.hands[seat] || [];
  if (state.phase === "bidding") {
    const partner = (seat + 2) % 4;
    if (state.bidder === partner) return { type: "bid", value: 0 };
    const deckCap = makeDeck(state.settings.rules).reduce((sum, card) => sum + cardPoints(card, state.settings.rules), 0);
    const next = state.highestBid < state.settings.minBid ? state.settings.minBid : state.highestBid + 5;
    const points = hand.reduce((sum, card) => sum + cardPoints(card, state.settings.rules), 0);
    const honors = hand.reduce((sum, card) => sum + (effectiveRank(card, state.settings.rules) >= 13 ? 1 : 0), 0);
    const trumpLength = COLORS.reduce((best, color) => Math.max(
      best,
      hand.filter((card) => card.color === color && !isPermanentTrump(card, state.settings.rules)).length
    ), 0);
    const estimate = points + honors * 7 + trumpLength * 5;
    return { type: "bid", value: next <= deckCap && estimate >= next * 0.72 ? next : 0 };
  }
  if (state.phase === "discard") {
    if (seat !== state.bidder) return null;
    const trump = state.trump || COLORS[0];
    const count = state.discardCount || 0;
    const ordered = [...hand].sort((a, b) => {
      const score = /* @__PURE__ */ __name((card) => cardPoints(card, state.settings.rules) * 100 + (isTrumpCard(card, trump, state.settings.rules) ? 1e4 : 0) + effectiveRank(card, state.settings.rules), "score");
      return score(a) - score(b);
    });
    return { type: "discard", cardIds: ordered.slice(0, count).map((card) => card.id) };
  }
  if (state.phase === "trump") {
    if (seat !== state.bidder) return null;
    const color = [...COLORS].sort((a, b) => {
      const value = /* @__PURE__ */ __name((color2) => hand.filter((card) => card.color === color2 && !isPermanentTrump(card, state.settings.rules)).length * 10 + hand.filter((card) => card.color === color2).reduce((sum, card) => sum + effectiveRank(card, state.settings.rules), 0), "value");
      return value(b) - value(a);
    })[0];
    return { type: "trump", color };
  }
  if (state.phase === "play") {
    const legal = hand.filter((card) => canPlay(card, hand, state.ledColor, state.trump, state.settings.rules));
    if (!legal.length) return null;
    if (!state.trick.length) {
      legal.sort((a, b) => cardPoints(a, state.settings.rules) - cardPoints(b, state.settings.rules) || effectiveRank(a, state.settings.rules) - effectiveRank(b, state.settings.rules));
      return { type: "play", cardId: legal[0].id };
    }
    let winner = state.trick[0];
    for (const entry of state.trick.slice(1)) {
      if (compareCards(entry.card, winner.card, state.ledColor, state.trump, state.settings.rules) > 0) winner = entry;
    }
    const partnerWinning = winner.player % 2 === seat % 2;
    const ranked = legal.map((card) => ({
      card,
      beats: compareCards(card, winner.card, state.ledColor, state.trump, state.settings.rules) > 0
    })).sort((a, b) => effectiveRank(a.card, state.settings.rules) - effectiveRank(b.card, state.settings.rules));
    const pick = partnerWinning ? ranked.find((item) => !item.beats) || ranked[0] : ranked.find((item) => item.beats) || ranked[0];
    return { type: "play", cardId: pick.card.id };
  }
  return null;
}
__name(chooseTestBotAction, "chooseTestBotAction");

// ../room.mjs
var clone2 = /* @__PURE__ */ __name((value) => structuredClone(value), "clone");
function validateIdentity(playerId, displayName) {
  if (typeof playerId !== "string" || !playerId.trim() || playerId.length > 128) throw new Error("INVALID_PLAYER_ID");
  if (typeof displayName !== "string" || !displayName.trim() || displayName.length > 40) throw new Error("INVALID_DISPLAY_NAME");
}
__name(validateIdentity, "validateIdentity");
var RoomService = class {
  static {
    __name(this, "RoomService");
  }
  constructor(storage, { tokenFactory = /* @__PURE__ */ __name(() => crypto.randomUUID(), "tokenFactory") } = {}) {
    this.storage = storage;
    this.tokenFactory = tokenFactory;
  }
  async create(roomId, hostId, displayName, avatar = "cinder", voice = "avatar") {
    validateIdentity(hostId, displayName);
    if (await this.storage.get(roomId)) throw new Error("ROOM_EXISTS");
    const token = this.tokenFactory();
    const room = {
      id: roomId,
      status: "waiting",
      revision: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      seats: [
        { playerId: hostId, displayName, token, avatar: safeAvatar(avatar), voice: safeVoice(voice) },
        null,
        null,
        null
      ],
      hands: null,
      turn: 0,
      plays: [],
      actions: {}
    };
    await this.storage.put(roomId, room);
    return { roomId, seat: 0, token };
  }
  async join(roomId, playerId, displayName, resumeToken = null, avatar = "dagger", voice = "avatar") {
    validateIdentity(playerId, displayName);
    const room = await this.#room(roomId);
    const existing = room.seats.findIndex((seat2) => seat2?.playerId === playerId);
    if (existing >= 0) {
      const existingToken = room.seats[existing].token;
      if (typeof resumeToken !== "string" || resumeToken !== existingToken) throw new Error("PLAYER_ALREADY_SEATED");
      return { roomId, seat: existing, token: existingToken };
    }
    if (room.status !== "waiting") throw new Error("ROOM_NOT_JOINABLE");
    let seat = room.seats.findIndex((entry) => entry === null);
    // Before the first deal only, a joining human can take a test bot's seat.
    // Existing humans stay reserved; active games never enter this branch.
    if (seat < 0 && !room.gameState && !room.hands) {
      seat = room.seats.findIndex((entry) => entry?.isBot === true && entry.token === null);
    }
    if (seat < 0) throw new Error("ROOM_FULL");
    const token = this.tokenFactory();
    room.seats[seat] = { playerId, displayName, token, avatar: safeAvatar(avatar), voice: safeVoice(voice) };
    room.lastActivityAt = Date.now();
    room.revision += 1;
    await this.storage.put(roomId, room);
    return { roomId, seat, token };
  }
  async fillOpenSeatsWithBots(roomId, token) {
    const room = await this.#room(roomId);
    const hostSeat = this.#authorizedSeat(room, token);
    if (hostSeat !== 0) throw new Error("HOST_ONLY");
    if (room.status !== "waiting") throw new Error("ROOM_NOT_JOINABLE");
    
    const open = room.seats.map((entry, seat) => entry === null ? seat : -1).filter((seat) => seat >= 0);
    if (!open.length) return this.snapshot(roomId, token);
    for (const seat of open) {
      room.seats[seat] = {
        playerId: `private-test-bot-${seat}`,
        displayName: `Test Bot ${seat + 1}`,
        token: null,
        isBot: true,
        avatar: ["cinder", "dagger", "crow", "blaze"][seat]
      };
    }
    room.lastActivityAt = Date.now();
    room.revision += 1;
    await this.storage.put(roomId, room);
    return this.snapshot(roomId, token);
  }
  // handsBySeat is a controlled test fixture, not a real shuffle/deal.
  async startFixtureGame(roomId, token, handsBySeat) {
    const room = await this.#room(roomId);
    const seat = this.#authorizedSeat(room, token);
    if (seat !== 0) throw new Error("HOST_ONLY");
    if (room.status !== "waiting" || room.seats.some((entry) => entry === null)) {
      throw new Error("FOUR_PLAYERS_REQUIRED");
    }
    if (!Array.isArray(handsBySeat) || handsBySeat.length !== 4 || handsBySeat.some((hand) => !Array.isArray(hand))) {
      throw new Error("INVALID_FIXTURE_HANDS");
    }
    room.hands = clone2(handsBySeat);
    room.status = "playing";
    room.turn = 0;
    room.revision += 1;
    room.lastActivityAt = Date.now();
    await this.storage.put(roomId, room);
    return this.snapshot(roomId, token);
  }
  async startGame(roomId, token, options = {}) {
    const room = await this.#room(roomId);
    const seat = this.#authorizedSeat(room, token);
    if (seat !== 0) throw new Error("HOST_ONLY");
    if (room.status !== "waiting" || room.seats.some((entry) => entry === null)) {
      throw new Error("FOUR_PLAYERS_REQUIRED");
    }
    room.gameState = createMatch(room.seats.map((entry) => ({
      playerId: entry.playerId,
      name: entry.displayName,
      isBot: entry.isBot === true,
      avatar: entry.avatar, voice: entry.voice
    })), options);
    room.status = "playing";
    room.revision += 1;
    room.lastActivityAt = Date.now();
    await this.storage.put(roomId, room);
    await this.#driveBots(roomId);
    return this.#gameSnapshot(await this.#room(roomId), token);
  }
  async bid(roomId, token, action) {
    return this.#applyGameAction(roomId, token, action, "bid", (game, seat, value) => submitBid(game, seat, value), action?.value);
  }
  async discard(roomId, token, action) {
    return this.#applyGameAction(roomId, token, action, "discard", (game, seat, cardIds) => discardCards(game, seat, cardIds), action?.cardIds);
  }
  async chooseTrump(roomId, token, action) {
    return this.#applyGameAction(roomId, token, action, "trump", (game, seat, color) => chooseTrump(game, seat, color), action?.color);
  }
  async playCard(roomId, token, action) {
    return this.#applyGameAction(roomId, token, action, "play", (game, seat, cardId) => playCard(game, seat, cardId), action?.cardId);
  }
  async claimRemainingCards(roomId, token, action) {
    return this.#applyGameAction(roomId, token, action, "claim", (game, seat) => claimRemainingCards(game, seat), null);
  }
  async declineRemainingClaim(roomId, token, action) {
    return this.#applyGameAction(roomId, token, action, "decline-claim", (game, seat) => declineRemainingClaim(game, seat), null);
  }
  async startNextHand(roomId, token, action) {
    return this.#applyGameAction(roomId, token, action, "next-hand", (game, seat) => seat === 0 ? startNextHand(game) : {accepted:false,reason:"HOST_ONLY"}, null);
  }
  async redeal(roomId, token, action) {
    return this.#applyGameAction(roomId, token, action, "redeal", (game) => redeal(game), null);
  }
  async playFixtureCard(roomId, token, { actionId, expectedRevision, cardId }) {
    const room = await this.#room(roomId);
    const seat = this.#authorizedSeat(room, token);
    if (typeof actionId !== "string" || !actionId) throw new Error("ACTION_ID_REQUIRED");
    const previous = room.actions[actionId];
    if (previous) {
      if (previous.seat !== seat) throw new Error("ACTION_ID_REUSED");
      return { ...clone2(previous.result), duplicate: true };
    }
    if (room.status !== "playing") throw new Error("GAME_NOT_PLAYING");
    if (expectedRevision !== room.revision) throw new Error("STALE_REVISION");
    if (room.turn !== seat) throw new Error("NOT_YOUR_TURN");
    const hand = room.hands[seat];
    const cardIndex = hand.indexOf(cardId);
    if (cardIndex < 0) throw new Error("CARD_NOT_IN_YOUR_HAND");
    hand.splice(cardIndex, 1);
    room.plays.push({ seat, cardId });
    room.turn = (seat + 1) % 4;
    room.revision += 1;
    room.lastActivityAt = Date.now();
    if (room.hands.every((cards) => cards.length === 0)) room.status = "complete";
    const result = { accepted: true, revision: room.revision, status: room.status };
    room.actions[actionId] = { seat, result };
    await this.storage.put(roomId, room);
    return result;
  }
  async snapshot(roomId, token) {
    let room = await this.#room(roomId);
    this.#authorizedSeat(room, token);
    // Resume a persisted bot turn if an earlier request ended after saving it.
    await this.#driveBots(roomId);
    room = await this.#room(roomId);
    if (room.gameState) return this.#gameSnapshot(room, token);
    const seat = this.#authorizedSeat(room, token);
    if (room.status === "waiting") {
      return {
        phase: "waiting",
        roomId: room.id,
        status: room.status,
        revision: room.revision,
        handNumber: 0,
        players: room.seats.map((player, index) => ({
          seat: index,
          name: player?.displayName ?? "Open seat",
          team: index % 2,
          occupied: !!player,
          isBot: player?.isBot === true,
          avatar: player?.avatar, voice: player?.voice
        })),
        occupiedSeats: room.seats.map((player, index) => player ? index : null).filter((index) => index !== null),
        dealer: null,
        currentPlayer: 0,
        hand: [],
        handCounts: [0, 0, 0, 0],
        bid: null,
        highestBid: null,
        bidder: null,
        passCount: 0,
        trump: null,
        trick: [],
        ledColor: null,
        scores: [0, 0],
        targetScore: 500,
        discardCount: null,
        nestCount: 0,
        lastSummary: null,
        matchResult: null,
        canClaimRemaining: false
      };
    }
    return {
      roomId: room.id,
      status: room.status,
      revision: room.revision,
      turn: room.turn,
      players: room.seats.map((player, index) => player && {
        seat: index,
        displayName: player.displayName,
        occupied: true
      }),
      plays: clone2(room.plays),
      hand: room.hands ? clone2(room.hands[seat]) : null
    };
  }
  async seatForToken(roomId, token) {
    const room = await this.#room(roomId);
    return this.#authorizedSeat(room, token);
  }
  async cleanup(roomId, { now = Date.now(), maxIdleMs = 60 * 60 * 1e3 } = {}) {
    const room = await this.storage.get(roomId);
    if (!room) return false;
    const expired = now - room.lastActivityAt >= maxIdleMs;
    if (room.status === "complete" || expired) {
      await this.storage.delete(roomId);
      return true;
    }
    return false;
  }
  async #room(roomId) {
    const room = await this.storage.get(roomId);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    return room;
  }
  #authorizedSeat(room, token) {
    if (typeof token !== "string" || !token.trim()) throw new Error("UNAUTHORIZED");
    const seat = room.seats.findIndex((entry) => entry && !entry.isBot && entry.token === token);
    if (seat < 0) throw new Error("UNAUTHORIZED");
    return seat;
  }
  #gameSnapshot(room, token) {
    const seat = this.#authorizedSeat(room, token);
    return {
      ...playerView(room.gameState, seat),
      roomId: room.id,
      status: room.status,
      revision: room.revision,
      occupiedSeats: room.seats.map((entry, index) => entry ? index : null).filter((index) => index !== null)
    };
  }
  async #applyGameAction(roomId, token, action, type, transition, value) {
    const room = await this.#room(roomId);
    const seat = this.#authorizedSeat(room, token);
    const actionId = action?.actionId;
    if (typeof actionId !== "string" || !actionId) throw new Error("ACTION_ID_REQUIRED");
    const fingerprint = JSON.stringify({ type, seat, expectedRevision: action.expectedRevision, value });
    const previous = room.actions[actionId];
    if (previous) {
      if (previous.seat !== seat || previous.fingerprint !== fingerprint) throw new Error("ACTION_ID_REUSED");
      return { ...clone2(previous.result), duplicate: true };
    }
    if (room.status !== "playing" || !room.gameState) throw new Error("GAME_NOT_PLAYING");
    if (action.expectedRevision !== room.revision) throw new Error("STALE_REVISION");
    const result = transition(room.gameState, seat, value);
    if (!result.accepted) throw new Error(result.reason || "INVALID_ACTION");
    room.gameState = result.state;
    room.revision += 1;
    room.lastActivityAt = Date.now();
    if (room.gameState.phase === "complete") room.status = "complete";
    const response = { accepted: true, event: result.event, revision: room.revision, status: room.status };
    room.actions[actionId] = { seat, fingerprint, result: response };
    await this.storage.put(roomId, room);
    await this.#driveBots(roomId);
    return { ...response, revision: (await this.#room(roomId)).revision };
  }
  async #driveBots(roomId) {
    for (let steps = 0; steps < 500; steps += 1) {
      const room = await this.#room(roomId);
      const state = room.gameState;
      if (room.status !== "playing" || !state || !["bidding", "discard", "trump", "play"].includes(state.phase)) return;
      const seat = state.currentPlayer;
      if (!room.seats[seat]?.isBot) return;
      const action = chooseTestBotAction(state, seat);
      if (!action) return;
      let result;
      if (action.type === "bid") result = submitBid(state, seat, action.value);
      else if (action.type === "discard") result = discardCards(state, seat, action.cardIds);
      else if (action.type === "trump") result = chooseTrump(state, seat, action.color);
      else if (action.type === "play") result = playCard(state, seat, action.cardId);
      else return;
      if (!result.accepted) throw new Error("TEST_BOT_ACTION_REJECTED");
      room.gameState = result.state;
      room.revision += 1;
      room.lastActivityAt = Date.now();
      if (room.gameState.phase === "complete") room.status = "complete";
      await this.storage.put(roomId, room);
    }
    throw new Error("TEST_BOT_ACTION_LIMIT");
  }
};

// client-page.mjs
var CLIENT_HTML = "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <meta name=\"color-scheme\" content=\"dark\">\n  <title>Griffin House of Rooks — Private Room Test</title>\n  <style>\n    :root { color-scheme: dark; font: 16px/1.45 system-ui, sans-serif; background: #151310; color: #f5eee2; }\n    * { box-sizing: border-box; }\n    body { margin: 0 auto; max-width: 760px; padding: 20px 14px 48px; }\n    h1 { font-size: 1.4rem; margin: 0; }\n    h2 { font-size: 1.12rem; margin: 0 0 10px; }\n    p { margin: 8px 0; }\n    .muted { color: #c5b9a6; }\n    .note, .panel { padding: 14px; border: 1px solid #514532; border-radius: 12px; background: #211e19; margin: 12px 0; }\n    .note { border-color: #99773d; background: #282116; }\n    label { display: block; margin: 10px 0 5px; color: #e0d4c1; }\n    input, button, select { font: inherit; color: inherit; padding: 10px 11px; border-radius: 8px; border: 1px solid #7c6948; background: #171613; }\n    input { width: 100%; }\n    button { background: #332b1f; cursor: pointer; }\n    button:disabled { opacity: .45; cursor: default; }\n    .row { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }\n    .row > * { flex: 1 1 140px; }\n    .seats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }\n    .seat { background: #171613; border: 1px solid #514532; border-radius: 9px; padding: 10px; }\n    .active { border-color: #e2bb62; box-shadow: inset 0 0 0 1px #e2bb62; }\n    .badge { color: #e6c677; }\n    .cards { display: flex; flex-wrap: wrap; gap: 7px; }\n    .card { min-width: 60px; min-height: 78px; padding: 8px; border-radius: 8px; background: #f1e8d6; color: #211e19; border: 2px solid #b8975b; font-weight: 700; }\n    .card.selected { outline: 3px solid #e2bb62; transform: translateY(-3px); }\n    .red { color: #b32628; }\n    .green { color: #267348; }\n    .yellow { color: #8c7018; }\n    .black, .rook { color: #282828; }\n    .feed { min-height: 42px; padding: 10px; background: #171613; border-radius: 8px; color: #d8c9ac; }\n    #table { display: none; }\n    @media (max-width: 420px) { body { padding: 16px 10px 36px; } .panel { padding: 12px; } }\n  </style>\n</head>\n<body>\n  <h1>Griffin House of Rooks</h1>\n  <div class=\"muted\">Private four-player online room test</div>\n  <div class=\"note\"><b>Private test only.</b> This page connects to an isolated test server. It is not the live 5:31 game. The access key is held only in this browser tab; never share it publicly.</div>\n\n  <section class=\"panel\" id=\"setup\">\n    <h2>Connect to the private test</h2>\n    <label for=\"server\">Test server address</label><input id=\"server\" type=\"url\" placeholder=\"https://your-private-test.workers.dev\" autocomplete=\"url\">\n    <label for=\"gate\">Private test access key</label><input id=\"gate\" type=\"password\" autocomplete=\"off\">\n    <label for=\"name\">Your name at the table</label><input id=\"name\" maxlength=\"40\" autocomplete=\"nickname\" placeholder=\"Name\">\n    <div class=\"row\" style=\"margin-top:12px\"><button id=\"create\">Create a private room</button></div>\n    <label for=\"roomCode\">Or enter a room code</label><input id=\"roomCode\" maxlength=\"8\" autocapitalize=\"characters\" placeholder=\"8-character code\">\n    <div class=\"row\" style=\"margin-top:12px\"><button id=\"join\">Join room</button><button id=\"resume\" hidden>Reconnect to my room</button></div>\n    <p id=\"setupMessage\" class=\"feed\" role=\"status\">Enter your name and the room code from the host phone.</p>\n    <p class=\"muted\">Your room code and a private reconnect token are saved on this phone so a refresh can reconnect you. Career records are not stored.</p>\n  </section>\n\n  <section id=\"table\">\n    <div class=\"panel row\"><div><b>Room <span id=\"roomLabel\"></span></b><div id=\"phase\" class=\"badge\"></div></div><button id=\"leave\">Disconnect this phone</button></div>\n    <section class=\"panel\"><h2>Players</h2><div id=\"seats\" class=\"seats\"></div></section>\n    <section class=\"panel\"><h2>Score</h2><div id=\"scores\"></div><div id=\"round\" class=\"muted\"></div><p id=\"summary\"></p></section>\n    <section class=\"panel\"><h2>Cards on the table</h2><div id=\"trick\" class=\"feed\"></div></section>\n    <section class=\"panel\"><h2>Your private hand</h2><div id=\"hand\" class=\"cards\"></div><div id=\"handHint\" class=\"muted\" style=\"margin:8px 0\"></div><div id=\"controls\" class=\"row\"></div></section>\n    <p id=\"message\" class=\"feed\" role=\"status\"></p>\n  </section>\n  <script>\n    const $ = (selector) => document.querySelector(selector);\n    const credKey = \"griffin-rooks-private-test-seat-v1\";\n    let creds = null, snapshot = null, selected = new Set(), busy = false, timer = null;\n    let pollJob = null, minimumRevision = -1, connecting = false;\n    const esc = (value) => String(value ?? \"\").replace(/[&<>\"']/g, char => ({\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",'\"':\"&quot;\", \"'\":\"&#39;\"}[char]));\n    const roomPath = (action = \"\") => `/rooms/${encodeURIComponent(creds.roomCode)}${action ? `/${action}` : \"\"}`;\n    function server() {\n      const value = $(\"#server\").value.trim().replace(/\\/$/, \"\");\n      if (!value) return \"\";\n      const parsed = new URL(value);\n      if (parsed.protocol !== \"https:\" && ![\"localhost\", \"127.0.0.1\"].includes(parsed.hostname)) {\n        throw new Error(\"Use a secure https:// test server address.\");\n      }\n      return parsed.origin;\n    }\n    function gate() { return $(\"#gate\").value; }\n    async function request(path, { method = \"GET\", body, token = creds?.token } = {}) {\n      const headers = { \"X-Test-Gate-UTF8\": encodeURIComponent(gate()) };\n      if (token) headers.Authorization = `Bearer ${token}`;\n      if (body !== undefined) headers[\"Content-Type\"] = \"application/json\";\n      const url = new URL(`${server()}${path}`);\n      // Each private snapshot must reach the authoritative room, never an old cache entry.\n      if (method === \"GET\") url.searchParams.set(\"_fresh\", crypto.randomUUID());\n      const controller = new AbortController();\n      const timeout = setTimeout(() => controller.abort(), 12000);\n      try {\n        const response = await fetch(url.toString(), { method, headers, cache: \"no-store\", signal: controller.signal, body: body === undefined ? undefined : JSON.stringify(body) });\n        const data = await response.json().catch(() => ({}));\n        if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);\n        return data;\n      } catch (error) {\n        if (error.name === \"AbortError\") throw new Error(\"Connection timed out. Your saved seat is safe. Try again.\");\n        throw error;\n      } finally { clearTimeout(timeout); }\n    }\n    function explain(error) {\n      const messages = {\n        ROOM_FULL: \"All four seats are held by people. Check the room code on the host phone.\",\n        ROOM_NOT_JOINABLE: \"This game has already started. Only players with a saved seat can reconnect.\",\n        ROOM_NOT_FOUND: \"This room has expired or the code is incorrect. Check the host phone for its current room code.\",\n        PLAYER_ALREADY_SEATED: \"This player already has a reserved seat. Use the same browser that originally joined, then tap Reconnect to my room.\",\n        TEST_ACCESS_REQUIRED: \"Private access was not accepted. Enter the existing private test access key on this device.\",\n        UNAUTHORIZED: \"This saved seat could not be verified. Keep your saved data and check that you are using the original browser.\",\n        HOST_ONLY: \"Only the phone that created this room can do that.\"\n      };\n      return messages[error.message] || error.message;\n    }\n    function saveCredentials() {\n      localStorage.setItem(credKey, JSON.stringify({ roomCode: creds.roomCode, seat: creds.seat, token: creds.token, playerId: creds.playerId, server: server() }));\n      $(\"#resume\").hidden = false;\n    }\n    function say(message) {\n      $(\"#message\").textContent = message;\n      $(\"#setupMessage\").textContent = message;\n      const botMessage = $(\"#botMessage\");\n      if (botMessage) botMessage.textContent = message;\n    }\n    function setConnected() { $(\"#setup\").style.display = \"none\"; $(\"#table\").style.display = \"block\"; $(\"#roomLabel\").textContent = creds.roomCode; }\n    function savedSeat() {\n      try { return JSON.parse(localStorage.getItem(credKey) || \"null\"); } catch { return null; }\n    }\n    function adoptCredentials(value) {\n      clearInterval(timer);\n      creds = value; snapshot = null; minimumRevision = -1; pollJob = null; busy = false; selected.clear();\n    }\n    function receiveSnapshot(incoming, owner = creds) {\n      if (!owner || creds !== owner || !incoming?.phase || !Number.isInteger(incoming.revision)) return false;\n      if (incoming.revision < minimumRevision || (snapshot && incoming.revision < snapshot.revision)) return false;\n      minimumRevision = Math.max(minimumRevision, incoming.revision);\n      if (snapshot?.revision === incoming.revision) return true;\n      snapshot = incoming; render(); return true;\n    }\n    async function finishConnection(message) {\n      const owner = creds;\n      const incoming = await request(roomPath(\"snapshot\"), { token: owner.token });\n      if (!receiveSnapshot(incoming, owner)) return;\n      setConnected(); startPolling(); say(message);\n    }\n    async function createRoom() {\n      const name = $(\"#name\").value.trim();\n      if (!server() || !gate() || !name) throw new Error(\"Enter the test server, access key, and your table name first.\");\n      const playerId = localStorage.getItem(\"griffin-rooks-private-test-player-v1\") || crypto.randomUUID();\n      localStorage.setItem(\"griffin-rooks-private-test-player-v1\", playerId);\n      const result = await request(\"/rooms\", { method: \"POST\", body: { playerId, displayName: name }, token: null });\n      adoptCredentials({ roomCode: result.roomCode, seat: result.seat, token: result.token, playerId });\n      saveCredentials();\n      await finishConnection(\"Room created. Share this room code. Another phone can join a test bot's seat until you start the game.\");\n    }\n    async function joinRoom() {\n      const name = $(\"#name\").value.trim(), code = $(\"#roomCode\").value.replace(/\\s/g, \"\").toUpperCase();\n      if (!server() || !gate() || !name || !/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) throw new Error(\"Enter the test server, access key, your name, and the 8-character room code from the host phone.\");\n      const saved = savedSeat();\n      const resume = saved?.roomCode === code && saved.server === server() && typeof saved.token === \"string\" && saved.token && typeof saved.playerId === \"string\" ? saved : null;\n      const playerId = resume?.playerId || localStorage.getItem(\"griffin-rooks-private-test-player-v1\") || crypto.randomUUID();\n      localStorage.setItem(\"griffin-rooks-private-test-player-v1\", playerId);\n      const result = await request(`/rooms/${encodeURIComponent(code)}/join`, { method: \"POST\", token: null, body: { playerId, displayName: name, ...(resume ? { resumeToken: resume.token } : {}) } });\n      adoptCredentials({ roomCode: code, seat: result.seat, token: result.token, playerId });\n      saveCredentials(); await finishConnection(resume ? \"Reconnected to your reserved seat.\" : \"You joined the room.\");\n    }\n    async function reconnect() {\n      const saved = savedSeat();\n      if (!saved) throw new Error(\"No saved room is available on this phone.\");\n      $(\"#server\").value = saved.server || \"\";\n      if (!gate()) throw new Error(\"Enter the private access key to reconnect.\");\n      adoptCredentials(saved);\n      await finishConnection(\"Reconnected to your reserved seat.\");\n    }\n    async function refresh(force = false) {\n      const owner = creds;\n      if (!owner) return false;\n      if (!force && pollJob?.owner === owner) return pollJob.promise;\n      const job = { owner, promise: null };\n      pollJob = job;\n      job.promise = (async () => {\n        try { return receiveSnapshot(await request(roomPath(\"snapshot\"), { token: owner.token }), owner); }\n        catch (error) { if (creds === owner) say(`Connection issue: ${explain(error)}`); return false; }\n        finally { if (pollJob === job) pollJob = null; }\n      })();\n      return job.promise;\n    }\n    function startPolling() { clearInterval(timer); timer = setInterval(() => refresh(), 1400); }\n    async function connect(action) {\n      if (connecting) return;\n      connecting = true;\n      [\"#create\", \"#join\", \"#resume\"].forEach(id => { $(id).disabled = true; });\n      say(\"Connecting to the private room…\");\n      try { await action(); } catch (error) { say(explain(error)); }\n      finally { connecting = false; [\"#create\", \"#join\", \"#resume\"].forEach(id => { $(id).disabled = false; }); }\n    }\n    function cardName(card) {\n      if (!card) return \"?\";\n      if (card.id === \"rook\" || card.color === \"rook\") return \"ROOK\";\n      if (card.specialRed1 || card.id === \"red1-special\") return \"RED 1\";\n      if (card.id === \"red-2\") return \"RED 2\";\n      return `${card.color.toUpperCase()} ${card.rank === 14 ? \"14\" : card.rank}`;\n    }\n    function cardMarkup(card, index, isSelectable) {\n      const color = card.color === \"rook\" ? \"rook\" : card.color;\n      const chosen = selected.has(String(card.id));\n      return `<button class=\"card ${color} ${chosen ? \"selected\" : \"\"}\" ${isSelectable ? `data-card=\"${esc(card.id)}\"` : \"disabled\"}>${esc(cardName(card))}</button>`;\n    }\n    function actionControls() {\n      const s = snapshot, mine = creds.seat, isTurn = s.currentPlayer === mine, isBidder = s.bidder === mine;\n      const out = [];\n      const button = (label, action, disabled = false) => `<button data-action=\"${action}\" ${disabled ? \"disabled\" : \"\"}>${label}</button>`;\n      if (s.phase === \"waiting\") out.push(button(\"Start game\", \"start\", s.occupiedSeats.length !== 4 || mine !== 0));\n      if (s.phase === \"bidding\" && isTurn) {\n        out.push(`<label>Bid (enter 0 to pass)<input id=\"bidValue\" type=\"number\" min=\"0\" step=\"5\" value=\"${Math.max(0, Number(s.highestBid) + 5)}\"></label>${button(\"Submit bid / pass\", \"bid\")}`);\n      }\n      if (s.phase === \"discard\" && isBidder) out.push(button(`Discard selected cards (${selected.size}/${s.discardCount})`, \"discard\", selected.size !== s.discardCount));\n      if (s.phase === \"trump\" && isBidder) out.push(`<label>Choose trump<select id=\"trumpValue\"><option value=\"green\">Green</option><option value=\"red\">Red</option><option value=\"yellow\">Yellow</option><option value=\"black\">Black</option></select></label>${button(\"Set trump\", \"trump\")}`);\n      if (s.phase === \"play\" && isTurn) {\n        out.push(button(\"Play selected card\", \"play\", selected.size !== 1));\n        if (s.canClaimRemaining) { out.push(button(\"Claim the remaining cards\", \"claim\")); out.push(button(\"Keep playing\", \"decline\")); }\n      }\n      if (s.phase === \"redeal\") out.push(button(\"Deal again\", \"redeal\", mine !== 0));\n      if (s.phase === \"score\") out.push(button(s.matchResult ? \"Match complete\" : \"Next hand\", \"next\", !!s.matchResult));\n      return out.join(\"\");\n    }\n    function render() {\n      if (!snapshot) return;\n      const s = snapshot;\n      $(\"#phase\").textContent = `${s.phase.toUpperCase()} · Hand ${s.handNumber} · revision ${s.revision}`;\n      $(\"#seats\").innerHTML = s.players.map(p => `<div class=\"seat ${p.seat === s.currentPlayer && [\"bidding\",\"play\"].includes(s.phase) ? \"active\" : \"\"}\"><b>Seat ${p.seat + 1}</b><br>${esc(p.name)}<br><span class=\"muted\">Team ${p.team === 0 ? \"A\" : \"B\"} · ${s.handCounts[p.seat]} cards${p.seat === s.dealer ? \" · dealer\" : \"\"}${p.seat === s.bidder ? \" · bidder\" : \"\"}</span></div>`).join(\"\");\n      let fillButton = document.getElementById(\"fillBotsBtn\");\n      if (!fillButton) {\n        fillButton = document.createElement(\"button\");\n        fillButton.id = \"fillBotsBtn\";\n        fillButton.type = \"button\";\n        fillButton.style.width = \"100%\";\n        fillButton.style.marginTop = \"10px\";\n        fillButton.addEventListener(\"click\", () => takeAction(\"fillBots\"));\n        $(\"#seats\").insertAdjacentElement(\"afterend\", fillButton);\n      }\n      const humanCount = s.players.filter(p => p.occupied && !p.isBot).length;\n      const openCount = 4 - s.occupiedSeats.length;\n      fillButton.hidden = creds.seat !== 0 || s.phase !== \"waiting\" || openCount < 1;\n      fillButton.disabled = busy;\n      fillButton.textContent = busy ? \"Please wait…\" : \"Fill open seats with test bots\";\n      let botMessage = $(\"#botMessage\");\n      if (!botMessage) {\n        botMessage = document.createElement(\"p\");\n        botMessage.id = \"botMessage\";\n        botMessage.setAttribute(\"role\", \"status\");\n        botMessage.className = \"muted\";\n        fillButton.insertAdjacentElement(\"afterend\", botMessage);\n      }\n      botMessage.hidden = creds.seat !== 0 || s.phase !== \"waiting\";\n      $(\"#scores\").textContent = `Team A: ${s.scores[0]}  ·  Team B: ${s.scores[1]}  ·  First to ${s.targetScore}`;\n      $(\"#round\").textContent = `Bid ${s.bid || \"—\"} · Trump ${s.trump || \"not chosen\"} · ${s.passCount} passes`;\n      $(\"#summary\").textContent = s.matchResult ? `Result: ${s.matchResult}` : (s.lastSummary ? JSON.stringify(s.lastSummary) : \"\");\n      $(\"#trick\").textContent = s.trick.length ? s.trick.map(t => `Seat ${t.player + 1}: ${cardName(t.card)}`).join(\"  ·  \") : \"No cards on the table right now.\";\n      const hand = s.hand || [];\n      const canSelect = (s.phase === \"discard\" && s.bidder === creds.seat) || (s.phase === \"play\" && s.currentPlayer === creds.seat);\n      if (!canSelect) selected.clear();\n      $(\"#hand\").innerHTML = hand.length ? hand.map((card, index) => cardMarkup(card, index, canSelect)).join(\"\") : \"<span class='muted'>No cards to show.</span>\";\n      $(\"#handHint\").textContent = s.phase === \"discard\" ? (s.bidder === creds.seat ? `Choose exactly ${s.discardCount} cards to put in the nest.` : `Waiting for ${esc(s.players[s.bidder]?.name || \"the bidder\")} to discard the nest.`) : s.phase === \"play\" ? (s.currentPlayer === creds.seat ? `It is your turn. Led color: ${s.ledColor || \"none\"}.` : `Waiting for ${esc(s.players[s.currentPlayer]?.name || \"the next player\")} to play.`) : s.phase === \"bidding\" ? `Highest bid: ${s.highestBid}. ${s.currentPlayer === creds.seat ? \"It is your turn to bid or pass.\" : `Waiting for ${esc(s.players[s.currentPlayer]?.name || \"the next player\")} to bid or pass.`}` : \"\";\n      $(\"#controls\").innerHTML = actionControls();\n      $(\"#hand\").querySelectorAll(\"[data-card]\").forEach(el => el.addEventListener(\"click\", () => {\n        const id = el.dataset.card;\n        if (selected.has(id)) selected.delete(id);\n        else if (snapshot.phase === \"discard\" && selected.size >= snapshot.discardCount) {\n          say(`You have selected ${snapshot.discardCount} cards. Tap a selected card to deselect it before choosing another.`);\n          return;\n        } else selected.add(id);\n        render();\n      }));\n      $(\"#controls\").querySelectorAll(\"[data-action]\").forEach(el => el.addEventListener(\"click\", () => takeAction(el.dataset.action)));\n    }\n    async function takeAction(type) {\n      if (busy || !snapshot) return;\n      busy = true;\n      const owner = creds;\n      try {\n        // Read only the controls belonging to this action. Other phases have\n        // no bid/trump inputs; reading them used to throw before the request.\n        const routes = { fillBots: \"fill-bots\", start: \"start\", bid: \"bid\", discard: \"discard\", trump: \"trump\", play: \"play\", claim: \"claim-remaining\", decline: \"decline-claim\", redeal: \"redeal\", next: \"next-hand\" };\n        const route = routes[type];\n        if (!route) throw new Error(\"Unknown table action.\");\n        let data = {};\n        if (type === \"bid\") data = { value: Number($(\"#bidValue\").value) };\n        else if (type === \"discard\") data = { cardIds: [...selected] };\n        else if (type === \"trump\") data = { color: $(\"#trumpValue\").value };\n        else if (type === \"play\") data = { cardId: [...selected][0] };\n        const payload = { actionId: crypto.randomUUID(), expectedRevision: snapshot.revision, ...data };\n        const fillButton = $(\"#fillBotsBtn\");\n        if (fillButton) { fillButton.disabled = true; fillButton.textContent = \"Please wait…\"; }\n        say(type === \"fillBots\" ? \"Adding test bots to the open seats…\" : \"Sending your action…\");\n        const result = await request(roomPath(route), { method: \"POST\", body: payload, token: owner.token });\n        if (creds !== owner) return;\n        if (Number.isInteger(result.revision)) minimumRevision = Math.max(minimumRevision, result.revision);\n        // Fill returns the fresh table itself; show it immediately even if a poll is in flight.\n        receiveSnapshot(result, owner);\n        selected.clear();\n        say(type === \"fillBots\" ? \"Test bots added. Tap Start game below your hand.\" : \"Action accepted.\");\n        await refresh(true);\n      } catch (error) {\n        if (creds !== owner) return;\n        say(`Action not accepted: ${explain(error)}. Refreshing the table…`);\n        await refresh(true);\n      } finally {\n        if (creds !== owner) return;\n        busy = false;\n        const fillButton = $(\"#fillBotsBtn\");\n        if (fillButton) { fillButton.disabled = false; fillButton.textContent = \"Fill open seats with test bots\"; }\n      }\n    }\n    $(\"#create\").addEventListener(\"click\", () => connect(createRoom));\n    $(\"#join\").addEventListener(\"click\", () => connect(joinRoom));\n    $(\"#resume\").addEventListener(\"click\", () => connect(reconnect));\n    $(\"#leave\").addEventListener(\"click\", () => { adoptCredentials(null); $(\"#table\").style.display = \"none\"; $(\"#setup\").style.display = \"block\"; say(\"Disconnected. Your seat is saved on this phone for reconnecting.\"); });\n    try {\n      const saved = JSON.parse(localStorage.getItem(credKey) || \"null\");\n      if (saved) { $(\"#server\").value = saved.server || \"\"; $(\"#roomCode\").value = saved.roomCode || \"\"; $(\"#resume\").hidden = false; }\n    } catch { localStorage.removeItem(credKey); }\n    if (!$(\"#server\").value && [\"http:\", \"https:\"].includes(location.protocol)) $(\"#server\").value = location.origin;\n  </script>\n</body>\n</html>\n";

// four-player-check-page.mjs
var FOUR_PLAYER_CHECK_HTML = '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <meta name="color-scheme" content="dark">\n  <title>Griffin House of Rooks \u2014 Four player test</title>\n  <style>\n    :root { color-scheme: dark; font: 16px/1.5 system-ui,sans-serif; background:#151310; color:#f5eee2 }\n    * { box-sizing:border-box } body { max-width:760px; margin:0 auto; padding:22px 14px 48px }\n    h1 { font: bold 1.45rem/1.2 system-ui,sans-serif; margin:0 0 6px }\n    .panel { margin:14px 0; padding:14px; border:1px solid #514532; border-radius:12px; background:#211e19 }\n    .note { border-color:#99773d; background:#282116 }\n    label { display:block; margin:10px 0 5px }\n    input,button { width:100%; padding:11px; border-radius:8px; border:1px solid #7c6948; background:#171613; color:inherit; font:inherit }\n    button { margin-top:12px; background:#332b1f; cursor:pointer }\n    button:disabled { opacity:.5; cursor:wait }\n    #status { color:#e6c677; font-weight:700 }\n    #log { white-space:pre-wrap; overflow-wrap:anywhere; min-height:8em; padding:12px; border-radius:8px; background:#171613; color:#d8c9ac }\n    .small { color:#c5b9a6; font-size:.92rem }\n  </style>\n</head>\n<body>\n  <h1>Four player room check</h1>\n  <div class="small">A private test that runs four separate player identities and live connections from this one browser.</div>\n  <section class="panel note">\n    <b>Private test only.</b> This creates a test room, checks four live connections, plays it automatically, and leaves the room to expire. It does not touch the live game or save careers. If your private test session is already active, leave the key blank. Otherwise, enter the key; it is sent once over HTTPS and cleared from this page.\n  </section>\n  <section class="panel">\n    <label for="gate">Private test access key</label>\n    <input id="gate" type="password" autocomplete="off" autocapitalize="off">\n    <button id="run">Run four player test</button>\n    <p id="status" role="status">Ready</p>\n    <div id="log" aria-live="polite">The test will connect four live sockets, check synchronized private views and reconnect, then play through a complete match.</div>\n  </section>\n  <p class="small">This checks four simultaneous live connections to the deployed private room server from one browser. It does not prove four different phones, networks, or human players.</p>\n<script>\n(() => {\n  const $ = (s) => document.querySelector(s);\n  const logBox = $("#log"), statusBox = $("#status"), button = $("#run");\n  let actionNumber = 0;\n  let activeSockets = [];\n  const say = (line) => { logBox.textContent += `\\n${line}`; logBox.scrollTop = logBox.scrollHeight; };\n  const setStatus = (value) => { statusBox.textContent = value; };\n  async function api(path, { method = "GET", token, body } = {}) {\n    const headers = {};\n    if ($("#gate").value) headers["X-Test-Gate"] = $("#gate").value;\n    if (token) headers.Authorization = `Bearer ${token}`;\n    if (body !== undefined) headers["Content-Type"] = "application/json";\n    const response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache:"no-store" });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);\n    return data;\n  }\n  const snap = (room, token) => api(`/rooms/${room}/snapshot`, { token });\n  const action = (room, seat, path, view, extra = {}, actionId = `poc-${++actionNumber}`) => api(`/rooms/${room}/${path}`, {\n    method:"POST", token:seat.token,\n    body:{ actionId, expectedRevision:view.revision, ...extra }\n  });\n  function isSpecial(card) { return card?.color === "rook" || card?.id === "rook" || card?.id === "red-2"; }\n  function isTrump(card, trump) { return isSpecial(card) || card?.color === trump; }\n  function follows(card, ledColor, trump) { return isSpecial(card) ? ledColor === trump : card?.color === ledColor; }\n  function canPlay(card, hand, ledColor, trump) {\n    if (!ledColor) return true;\n    const hasLed = hand.some(item => follows(item, ledColor, trump));\n    if (hasLed) return follows(card, ledColor, trump);\n    return true;\n  }\n  function collectStrings(value, found = []) {\n    if (typeof value === "string") found.push(value);\n    else if (Array.isArray(value)) value.forEach(item=>collectStrings(item,found));\n    else if (value && typeof value === "object") Object.values(value).forEach(item=>collectStrings(item,found));\n    return found;\n  }\n  async function postAction(room, seat, path, view, extra = {}) {\n    await action(room, seat, path, view, extra);\n    return snap(room, seat.token);\n  }\n  function waitForOpen(socket) {\n    return new Promise((resolve, reject) => {\n      const timer = setTimeout(() => reject(new Error("WebSocket open timed out.")), 8000);\n      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once:true });\n      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("WebSocket connection failed.")); }, { once:true });\n    });\n  }\n  async function openSeatSocket(room, seat) {\n    const {ticket} = await api(`/rooms/${room}/ws-ticket`, { method:"POST", token:seat.token, body:{} });\n    const url = new URL(`/rooms/${room}/ws`, location.href);\n    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";\n    url.searchParams.set("ticket", ticket);\n    const socket = new WebSocket(url);\n    const buffered = [], waiting = [];\n    let closed = false;\n    socket.addEventListener("message", event => {\n      let message;\n      try { message = JSON.parse(event.data); } catch { return; }\n      const waiter = waiting.shift();\n      if (waiter) { clearTimeout(waiter.timer); waiter.resolve(message); }\n      else buffered.push(message);\n    });\n    socket.addEventListener("close", () => {\n      closed = true;\n      while (waiting.length) { const waiter = waiting.shift(); clearTimeout(waiter.timer); waiter.reject(new Error("WebSocket closed before the expected update.")); }\n    });\n    await waitForOpen(socket);\n    const nextSnapshot = () => new Promise((resolve, reject) => {\n      if (buffered.length) return resolve(buffered.shift());\n      if (closed) return reject(new Error("WebSocket is closed."));\n      const waiter = { resolve, reject, timer:setTimeout(() => {\n        const index = waiting.indexOf(waiter);\n        if (index >= 0) waiting.splice(index, 1);\n        reject(new Error("Timed out waiting for a WebSocket snapshot."));\n      }, 8000) };\n      waiting.push(waiter);\n    });\n    const first = await nextSnapshot();\n    if (first.type !== "snapshot" || !first.snapshot) throw new Error("WebSocket did not send its initial player snapshot.");\n    return { socket, nextSnapshot, first:first.snapshot };\n  }\n  function assertPrivateSnapshots(views) {\n    const hands = views.map(view => view.hand.map(card => card.id));\n    for (let i=0;i<4;i++) for (let j=0;j<4;j++) if (i!==j) {\n      const strings = collectStrings(views[i]);\n      for (const cardId of hands[j]) if (strings.includes(cardId)) throw new Error(`Seat ${i+1} live snapshot exposed another seat\'s card.`);\n    }\n  }\n  async function run() {\n    const gate = $("#gate").value;\n    if (gate) {\n      const session = await fetch("/cloud-game/launch", {\n        method:"POST", headers:{"Content-Type":"application/json"},\n        body:JSON.stringify({key:gate}), cache:"no-store", credentials:"same-origin"\n      });\n      if (!session.ok) throw new Error("Private test access was not accepted.");\n      $("#gate").value = "";\n    }\n    actionNumber = 0;\n    logBox.textContent = "Starting the isolated four player check\u2026";\n    setStatus("Connecting");\n    const playerIds = Array.from({length:4}, () => `auto-${crypto.randomUUID()}`);\n    const names = ["Test Player 1","Test Player 2","Test Player 3","Test Player 4"];\n    const created = await api("/rooms", { method:"POST", body:{ playerId:playerIds[0], displayName:names[0] } });\n    const room = created.roomCode;\n    const seats = [{ playerId:playerIds[0], seat:created.seat, token:created.token }];\n    say(`Room created: ${room}`);\n    for (let i=1;i<4;i++) {\n      const joined = await api(`/rooms/${room}/join`, { method:"POST", body:{playerId:playerIds[i],displayName:names[i]} });\n      seats.push({playerId:playerIds[i],seat:joined.seat,token:joined.token});\n    }\n    if (seats.map(s=>s.seat).join(",") !== "0,1,2,3") throw new Error("Seats were not assigned in order.");\n    say("PASS \u2014 four different identities received seats 1\u20134.");\n\n    const duplicateWithoutToken = await fetch(`/rooms/${room}/join`, {\n      method:"POST", headers:{"X-Test-Gate":$("#gate").value,"Content-Type":"application/json"},\n      body:JSON.stringify({playerId:playerIds[0],displayName:"Test Player 1"})\n    });\n    const duplicateBody = await duplicateWithoutToken.json().catch(()=>({}));\n    if (duplicateWithoutToken.ok || duplicateBody.error !== "PLAYER_ALREADY_SEATED") throw new Error("Duplicate seat claim was not rejected.");\n    say("PASS \u2014 a duplicate seat claim without the private resume token was rejected.");\n\n    const resumed = await api(`/rooms/${room}/join`, { method:"POST", body:{playerId:playerIds[0],displayName:names[0],resumeToken:seats[0].token} });\n    if (resumed.seat !== 0 || resumed.token !== seats[0].token) throw new Error("Reconnect did not return the same seat.");\n    say("PASS \u2014 reconnect credentials returned the original seat.");\n\n    const sockets = [];\n    for (const seat of seats) {\n      const client = await openSeatSocket(room,seat);\n      sockets.push(client);\n      activeSockets.push(client.socket);\n    }\n    const initialSocketViews = sockets.map(client=>client.first);\n    if (initialSocketViews.some((view,seat)=>view.phase!=="waiting" || view.players?.[seat]?.name!==names[seat])) {\n      throw new Error("Live connections did not receive the correct waiting-room seat views.");\n    }\n    say("PASS \u2014 four simultaneous WebSockets connected and each received its own seat view.");\n\n    await api(`/rooms/${room}/start`, { method:"POST", token:seats[0].token, body:{} });\n    let pushedViews = await Promise.all(sockets.map(client=>client.nextSnapshot()));\n    pushedViews = pushedViews.map(message=>message.snapshot);\n    if (pushedViews.some((view,index)=>view.phase!=="bidding" || view.hand.length!==10 || view.revision<=initialSocketViews[index].revision)) {\n      throw new Error("A live WebSocket did not receive the new dealt game state.");\n    }\n    assertPrivateSnapshots(pushedViews);\n    say("PASS \u2014 starting the deal pushed the updated state to every connection without exposing other hands.");\n\n    const interruptedSeat = 2;\n    await new Promise((resolve,reject)=>{\n      const socket=sockets[interruptedSeat].socket;\n      if (socket.readyState===WebSocket.CLOSED) return resolve();\n      const timer=setTimeout(()=>reject(new Error("The test connection did not close cleanly.")),3000);\n      socket.addEventListener("close",()=>{clearTimeout(timer);resolve();},{once:true});\n      socket.close(1000,"POC reconnect check");\n    });\n    const reconnected = await openSeatSocket(room,seats[interruptedSeat]);\n    const reconnectedView = reconnected.first;\n    if (reconnectedView.phase!==pushedViews[interruptedSeat].phase ||\n        reconnectedView.revision!==pushedViews[interruptedSeat].revision ||\n        JSON.stringify(reconnectedView.hand)!==JSON.stringify(pushedViews[interruptedSeat].hand)) {\n      throw new Error("A reconnected socket did not restore the same seat\'s current private view.");\n    }\n    sockets[interruptedSeat]=reconnected;\n    activeSockets[interruptedSeat]=reconnected.socket;\n    say("PASS \u2014 a closed connection rejoined the same seat and received its current private hand.");\n    for (const client of sockets) { try { client.socket.close(1000,"POC socket check complete"); } catch {} }\n    activeSockets = [];\n\n    let views = await Promise.all(seats.map(s=>snap(room,s.token)));\n    if (views.some(v=>v.phase!=="bidding" || v.hand.length!==10)) throw new Error("The room did not deal four private 10-card hands.");\n    const hands = views.map(v=>v.hand.map(card=>card.id));\n    if (new Set(hands.flat()).size !== 40 || views.some(v=>v.nestCount!==6)) throw new Error("The four hands and six-card nest were not dealt correctly.");\n    for (let i=0;i<4;i++) for (let j=0;j<4;j++) if (i!==j) {\n      const strings = collectStrings(views[i]);\n      for (const cardId of hands[j]) if (strings.includes(cardId)) throw new Error(`Seat ${i+1} snapshot exposed another seat\'s card.`);\n    }\n    say("PASS \u2014 server dealt 10 cards per player and each snapshot hid the other three hands.");\n\n    let completedHands = 0;\n    let totalPlays = 0;\n    const maxHands = 20;\n    while (true) {\n      setStatus(`Playing hand ${completedHands+1}`);\n      let view = await snap(room,seats[0].token);\n      if (view.phase === "bidding") {\n        let firstBid = true;\n        let guard = 0;\n        while (view.phase === "bidding" && guard++ < 8) {\n          const seat = seats[view.currentPlayer];\n          const own = await snap(room,seat.token);\n          if (firstBid) {\n            const id = `poc-${++actionNumber}`;\n            const [one,two] = await Promise.all([\n              action(room,seat,"bid",own,{value:100},id),\n              action(room,seat,"bid",own,{value:100},id)\n            ]);\n            if (!!one.duplicate === !!two.duplicate) throw new Error("A repeated simultaneous action was not handled exactly once.");\n            say("PASS \u2014 a simultaneous duplicate bid was recorded once.");\n            view = await snap(room,seat.token);\n          } else view = await postAction(room,seat,"bid",own,{value:0});\n          firstBid = false;\n        }\n      }\n      if (view.phase !== "discard") throw new Error(`Expected discard phase; got ${view.phase}.`);\n      const bidder = seats[view.bidder];\n      let own = await snap(room,bidder.token);\n      view = await postAction(room,bidder,"discard",own,{cardIds:own.hand.slice(0,own.discardCount).map(card=>card.id)});\n      if (view.phase !== "trump") throw new Error(`Expected trump phase; got ${view.phase}.`);\n      own = await snap(room,bidder.token);\n      view = await postAction(room,bidder,"trump",own,{color:"yellow"});\n\n      let handPlays = 0, guard = 0;\n      while (view.phase === "play" && guard++ < 48) {\n        const seat = seats[view.currentPlayer];\n        own = await snap(room,seat.token);\n        if (own.canClaimRemaining) {\n          view = await postAction(room,seat,"decline-claim",own);\n          continue;\n        }\n        const legal = own.hand.find(card=>canPlay(card,own.hand,own.ledColor,own.trump));\n        if (!legal) throw new Error(`No legal test move found for seat ${seat.seat+1}.`);\n        view = await postAction(room,seat,"play",own,{cardId:legal.id});\n        handPlays++; totalPlays++;\n      }\n      if (!["score","complete"].includes(view.phase) || handPlays !== 40) throw new Error(`Hand did not finish cleanly (phase ${view.phase}, plays ${handPlays}).`);\n      completedHands++;\n      say(`PASS \u2014 hand ${completedHands} finished; score ${view.scores[0]}\u2013${view.scores[1]}.`);\n      if (view.phase === "complete") {\n        if (!view.matchResult || Math.max(...view.scores) < view.targetScore) throw new Error("Match completion did not match the target score.");\n        say(`PASS \u2014 full match completed in ${completedHands} hands and ${totalPlays} card plays.`);\n        break;\n      }\n      if (completedHands >= maxHands) throw new Error(`Match was still active after ${maxHands} hands; stopped safely.`);\n      const next = await snap(room,seats[0].token);\n      view = await postAction(room,seats[0],"next-hand",next);\n      if (view.phase !== "bidding") throw new Error("Next hand did not begin after scoring.");\n    }\n\n    const finalViews = await Promise.all(seats.map(s=>snap(room,s.token)));\n    if (finalViews.some(v=>v.phase!=="complete" || v.hand.length!==0)) throw new Error("Final room state did not match for all four seats.");\n    say("PASS \u2014 all four seat views agree on the completed match; room will expire through normal cleanup.");\n    setStatus("PASS \u2014 automated four player match complete");\n  }\n  button.addEventListener("click", async () => {\n    button.disabled = true;\n    try { await run(); }\n    catch (error) { say(`BLOCKED \u2014 ${error.message}`); setStatus("Test stopped"); }\n    finally {\n      for (const socket of activeSockets) { try { socket.close(1000,"POC test cleanup"); } catch {} }\n      activeSockets = [];\n      button.disabled = false;\n    }\n  });\n})();\n<\/script>\n</body>\n</html>\n';

// cloud-game-launch-page.mjs
var CLOUD_GAME_LAUNCH_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>Private Griffin House game test</title>
<style>
  :root{color-scheme:dark;font:16px/1.5 system-ui,sans-serif;background:#151310;color:#f5eee2}
  *{box-sizing:border-box}body{max-width:620px;margin:0 auto;padding:28px 16px}
  main{background:#211e19;border:1px solid #80683e;border-radius:14px;padding:20px}
  h1{font:700 1.35rem Georgia,serif;color:#e6c677;margin:0 0 12px}
  p{color:#d4c8b5}label{display:block;margin:18px 0 6px}
  input,button{font:inherit;color:inherit;border:1px solid #80683e;border-radius:8px;padding:12px;background:#171613;width:100%}
  button{margin-top:16px;background:#332b1f;cursor:pointer;font-weight:700}
  #status{min-height:28px;margin-top:12px;color:#e6c677}
</style></head><body><main>
<h1>Private Griffin House test</h1>
<p>This opens a separate copy of the current game screen. It uses the private test server and does not save career records.</p>
<label for="key">Private test access key</label><input id="key" type="password" autocomplete="off">
<button id="open" type="button">Open private game test</button><div id="status" role="status"></div>
</main><script>
const button=document.getElementById('open'),key=document.getElementById('key'),status=document.getElementById('status');
button.addEventListener('click',async()=>{
  if(!key.value){status.textContent='Enter the private test key.';return;}
  button.disabled=true;status.textContent='Opening the isolated game screen\u2026';
  try{
    const response=await fetch('/cloud-game/launch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:key.value}),cache:'no-store'});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'The private test key was not accepted.');}
    key.value='';
    location.replace('/cloud-game/game');
  }catch(error){status.textContent=error.message;button.disabled=false;}
});
<\/script></body></html>`;

// cloud-game-adapter-page.mjs
var CLOUD_GAME_ADAPTER = "/*\n * Build-797 screen adapter for the isolated Cloudflare room server.\n * This source is injected only by the private test Worker when ?cloud=1 is\n * present. It is never added to the live Test site or production game.\n */\n(() => {\n  const query = new URLSearchParams(location.search);\n  if (!query.has(\"cloud\")) return;\n  // Private 846 adapter, eight-character Cloudflare room codes.\n  const codeField = document.getElementById(\"hor-room-code\");\n  if (codeField) codeField.maxLength = 8;\n  if (![\"846-premium-owner-repair-20261020-r7\"].includes(window.HOR_SCRIPT_BUILD)) {\n    const notice = document.getElementById(\"lobbyStatus\");\n    if (notice) notice.textContent = \"This game version has not been verified for private cloud play. Please wait for the test adapter update.\";\n    // Fail closed rather than silently falling back to browser-hosted rooms.\n    for (const name of [\"createRoom\", \"joinRoom\", \"startGameWithToast\"]) window[name] = () => {};\n    document.addEventListener(\"click\", event => {\n      if (event.target.closest?.(\"#friendsToggleBtn,#createBtn,#joinConfirmBtn,#startBtn,#rejoinBtn,#reconnectBtn\")) { event.preventDefault(); event.stopImmediatePropagation(); }\n    }, true);\n    return;\n  }\n\n  const native = {};\n  for (const name of [\"submitBid\", \"submitDiscard\", \"submitTrump\", \"submitPlay\", \"startGameWithToast\", \"clientLeaveReplace\", \"saveSession\", \"isBotTurn\", \"scheduleBot\", \"runBotAction\", \"horStartHeartbeat\", \"horBeginClientReconnect\", \"horRecordCareerHand\", \"mergeLifetimeStats\", \"noteHumanAuction\", \"noteHumanHandEnd\", \"hostStartNextHand\", \"hostProcessAllTrumpsClaim\", \"hostDeclineClaim\", \"showAllTrumpsClaimUI\", \"leaveTableAfterConfirmation043\", \"leaveTableToLobby043\", \"onWaitSeatClick\"])\n    native[name] = window[name];\n  const credentialKey = \"ghr-private-cloud-seat-v1\";\n  const playerIdKey = \"ghr-private-cloud-player-v1\";\n  let credentials = null;\n  let latest = null;\n  let lastRevision = -1;\n  let timer = null;\n  let socket = null;\n  let socketReconnectTimer = null;\n  let socketRetryCount = 0;\n  let busy = false;\n  let queuedAction = null;\n  let presented = null;\n  let lastScoreSignature = \"\";\n  let redealRevision = -1;\n\n  const status = (message) => {\n    const lobby = document.getElementById(\"lobby\");\n    const el = lobby && !lobby.classList.contains(\"hidden\")\n      ? document.getElementById(\"lobbyStatus\")\n      : (document.getElementById(\"messageArea\") || document.getElementById(\"lobbyStatus\"));\n    if (el) el.textContent = message;\n  };\n  const showBotFillStatus = (message, button) => {\n    if (button) button.title = message;\n    status(message);\n  };\n  const ownId = () => {\n    let id = localStorage.getItem(playerIdKey);\n    if (!id) {\n      id = crypto.randomUUID();\n      localStorage.setItem(playerIdKey, id);\n    }\n    return id;\n  };\n  const api = async (path, { method = \"GET\", body, token = credentials?.token } = {}) => {\n    const headers = {};\n    if (token) headers.Authorization = \"Bearer \" + token;\n    if (body !== undefined) headers[\"Content-Type\"] = \"application/json\";\n    // The legacy game assets need a GitHub Pages <base>, but API routes belong\n    // to the private Worker. Resolve them explicitly against the current origin.\n    const response = await fetch(new URL(path, window.location.origin), {\n      method,\n      headers,\n      body: body === undefined ? undefined : JSON.stringify(body),\n      cache: \"no-store\",\n    });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) throw new Error(data.error || (\"HTTP_\" + response.status));\n    return data;\n  };\n  const roomPath = (action = \"\") => \"/rooms/\" + encodeURIComponent(credentials.roomCode) + (action ? \"/\" + action : \"\");\n  const playerIdForSeat = (seat) => \"cloud-seat-\" + seat;\n\n  function credentialsFrom(result, playerId) {\n    sessionStorage.removeItem(\"ghr-cloud-disconnected\");\n    presented = null;\n    window._horCloudWinnerShown = false;\n    window._cloudKittyHand = null;\n    credentials = {\n      roomCode: result.roomCode || result.roomId,\n      seat: Number(result.seat),\n      serverRoomId: result.roomId || null,\n      token: result.token,\n      playerId,\n    };\n    localStorage.setItem(credentialKey, JSON.stringify(credentials));\n    roomCode = credentials.roomCode;\n    myIndex = credentials.seat;\n    myPeerId = playerIdForSeat(credentials.seat);\n    myName = (document.getElementById(\"hor-player-name\")?.value || \"Player\").trim() || \"Player\";\n    isSpectator = false;\n  }\n\n  function mapPlayers(snap) {\n    return Array.from({ length: 4 }, (_, seat) => {\n      const p = snap.players?.find((entry) => entry && Number(entry.seat) === seat);\n      if (!p || p.occupied === false) return null;\n      return {\n        id: playerIdForSeat(seat),\n        name: p.name || p.displayName || (\"Player \" + (seat + 1)),\n        seat,\n        team: Number.isInteger(p.team) ? p.team : seat % 2,\n        isHost: seat === 0,\n        isBot: p.isBot === true,\n        bank: 0,\n        avatar: p.avatar || [\"cinder\", \"dagger\", \"crow\", \"blaze\"][seat],\n        voice: p.voice || \"avatar\",\n      };\n    });\n  }\n\n  function enterWaiting(snap) {\n    latest = snap;\n    const tablePlayers = mapPlayers(snap);\n    players = tablePlayers.filter(Boolean);\n    game = {\n      phase: \"waiting\",\n      players: tablePlayers,\n      scores: [0, 0],\n      hands: [[], [], [], []],\n      myHand: [],\n      handNumber: 0,\n      targetScore: 500,\n    };\n    isHost = credentials.seat === 0;\n    myIndex = credentials.seat;\n    myPeerId = playerIdForSeat(credentials.seat);\n    window._horStayInGame = false;\n    try { horMarkActiveTable(false); } catch (_) {}\n    try { showWaiting(); } catch (_) {\n      document.getElementById(\"lobby\")?.classList.add(\"hidden\");\n      document.getElementById(\"waiting\")?.classList.remove(\"hidden\");\n    }\n    const hostOptions = document.getElementById(\"hostOptions\");\n    const hostOptionsButton = document.getElementById(\"openHostOptionsBtn\");\n    if (hostOptions) hostOptions.classList.add(\"hidden\");\n    if (hostOptionsButton) hostOptionsButton.classList.add(\"hidden\");\n    const code = document.getElementById(\"displayCode\");\n    if (code) code.textContent = credentials.roomCode;\n    try { updateWaitingUI(); } catch (_) {}\n    const start = document.getElementById(\"startBtn\");\n    if (start && credentials.seat === 0) {\n      start.classList.remove(\"hidden\");\n      start.disabled = snap.occupiedSeats?.length !== 4;\n      start.textContent = \"Start Game\";\n    }\n  }\n\n  function gameSnapshot(snap) {\n    if (![\"score\", \"complete\"].includes(snap.phase)) {\n      document.getElementById(\"scoreModal\")?.classList.add(\"hidden\");\n      document.body.classList.remove(\"remaining-open\");\n    }\n    if (typeof snap.shootMoonEnabled === \"boolean\") shootMoonEnabled = snap.shootMoonEnabled;\n    if (snap.rules) {\n      includeRed2 = !!snap.rules.includeRed2;\n      includeOnes = !!snap.rules.includeOnes;\n      includeRook = !!snap.rules.includeRook;\n      includeRed1 = !!snap.rules.includeRed1;\n      onesHigh = !!snap.rules.onesHigh;\n      rookLowest = !!snap.rules.rookLowest;\n      specialsAnytime = !!snap.rules.specialsAnytime;\n      mustTrumpWhenVoid = !!snap.rules.mustTrumpWhenVoid;\n    }\n    const tablePlayers = mapPlayers(snap);\n    const hand = Array.isArray(snap.hand) ? snap.hand.map((card) => ({ ...card })) : [];\n    const viewPhase = snap.phase === \"complete\" ? \"score\" : snap.phase;\n    const hands = [[], [], [], []];\n    hands[credentials.seat] = hand.map((card) => ({ ...card }));\n    players = tablePlayers;\n    myIndex = credentials.seat;\n    myPeerId = playerIdForSeat(credentials.seat);\n    // Host permissions belong to the server credential, not the legacy\n    // browser referee. All dealt cloud views use the native client UI path.\n    isHost = false;\n    const view = {\n      phase: viewPhase,\n      cloudRevision: snap.revision,\n      scores: snap.scores || [0, 0],\n      sandbagOverpoints: [0, 0],\n      bid: snap.bid || 0,\n      highestBid: snap.highestBid,\n      shotTheMoon: !!snap.shotTheMoon,\n      trumpVoiceEvent790: snap.trump ? \"cloud-trump:\" + credentials.roomCode + \":\" + snap.handNumber + \":\" + snap.bidder + \":\" + snap.trump : null,\n      trumpVoiceRestore790: !presented,\n      minBid: 100,\n      passCount: snap.passCount || 0,\n      bidder: snap.bidder,\n      trump: snap.trump,\n      currentPlayer: snap.currentPlayer,\n      trick: (snap.trick || []).map((entry) => ({ player: entry.player, card: { ...entry.card } })),\n      ledColor: snap.ledColor,\n      players: tablePlayers,\n      dealer: snap.dealer,\n      handsCount: snap.handCounts || [0, 0, 0, 0],\n      targetScore: snap.targetScore || 500,\n      lastTrickWinner: snap.lastTrickWinner,\n      resolvingTrick: false,\n      paused: false,\n      bidStatus: snap.bidStatus || [null, null, null, null],\n      discardCount: snap.discardCount || 0,\n      nestAuctionOpen: snap.phase === \"bidding\",\n      revealTopNest: snap.revealTopNest !== false,\n      nestFlipped: snap.phase === \"bidding\",\n      topNestCard: snap.topNestCard || null,\n      nestFlipStage: 0,\n      widowSpread: snap.widowSpread || [],\n      handPoints: snap.handPoints || [0, 0],\n      trumpClaimPlayer: snap.canClaimRemaining ? credentials.seat : null,\n      claimDeclined: !!snap.claimDeclined,\n      claimAnimation: null,\n      claimAnimating: false,\n      resolvingTrickPoints: 0,\n    };\n    const current = game || {};\n    Object.assign(current, {\n      phase: viewPhase,\n      cloudRevision: snap.revision,\n      scores: view.scores,\n      sandbagOverpoints: view.sandbagOverpoints,\n      bid: view.bid,\n      highestBid: view.highestBid,\n      shotTheMoon: view.shotTheMoon,\n      passCount: view.passCount,\n      bidder: view.bidder,\n      trump: view.trump,\n      currentPlayer: view.currentPlayer,\n      trick: view.trick,\n      ledColor: view.ledColor,\n      players: tablePlayers,\n      dealer: view.dealer,\n      handsCount: view.handsCount,\n      handNumber: snap.handNumber,\n      targetScore: view.targetScore,\n      lastTrickWinner: view.lastTrickWinner,\n      resolvingTrick: false,\n      paused: false,\n      bidStatus: view.bidStatus,\n      discardCount: view.discardCount,\n      nestAuctionOpen: snap.phase === \"bidding\",\n      nestFlipped: snap.phase === \"bidding\",\n      topNestCard: view.topNestCard,\n      widowSpread: view.widowSpread,\n      handPoints: view.handPoints,\n      trumpClaimPlayer: view.trumpClaimPlayer,\n      claimDeclined: view.claimDeclined,\n      claimAnimation: null,\n      claimAnimating: false,\n      resolvingTrickPoints: 0,\n      hands,\n      myHand: hand,\n      nest: Array.from({ length: Number(snap.nestCount) || 0 }, () => null),\n      nestPreview: Array.isArray(snap.nestPreview) ? snap.nestPreview : [],\n      kittyTaken: Array.isArray(snap.nestPreview) ? snap.nestPreview : [],\n      nestCards: Array.isArray(snap.nestCards) ? snap.nestCards : [],\n      nestRevealCards: Array.isArray(snap.nestCards) ? snap.nestCards : [],\n      lastSummary: snap.lastSummary || null,\n      matchResult: snap.matchResult || null,\n    });\n    game = current;\n    if (snap.phase === \"discard\" && snap.bidder === credentials.seat &&\n        window._cloudKittyHand !== snap.handNumber) {\n      window._cloudKittyHand = snap.handNumber;\n      window._discardFlowKey = typeof discardFlowIdentity === \"function\" ? discardFlowIdentity(hand, snap.bidder) : \"\";\n      window._discardPage = \"kitty\";\n      window.selectedForDiscard = new Set();\n      window._discardSubmitting = false;\n      window._discardStartReceived = false;\n      window._discardKittyShown = false;\n    }\n    try { applyState(view); if (snap.phase !== \"discard\") renderHand(false); } catch (error) { status(\"Could not draw the current table: \" + error.message); }\n\n    // Presentation observes confirmed public changes; reconnect snapshots are quiet.\n    if (presented?.hand === snap.handNumber) {\n      for (let seat = 0; seat < 4; seat++) {\n        const value = snap.bidStatus?.[seat];\n        if (value == null || value === presented.bids?.[seat] || tablePlayers[seat]?.isBot) continue;\n        const moon = !!snap.shotTheMoon && seat === snap.bidder;\n        const action = value === \"pass\" ? \"pass\" : moon ? \"shootMoon\" : \"bid\";\n        window.HORBidVoice801?.receive({event:{id:\"cloud-bid:\" + credentials.roomCode + \":\" + snap.handNumber + \":\" + snap.revision + \":\" + seat,player:seat,action,amount:Number(value)||0,clip:moon?\"moon-\"+(snap.handNumber%2+1):undefined}});\n      }\n      if (snap.shotTheMoon && !presented.moon) window.HORMoonHowl?.play(\"cloud-moon:\" + credentials.roomCode + \":\" + snap.handNumber);\n      if (snap.phase === \"play\" && snap.trump && !presented.trump) window.HORTrumpVoice?.chosen(game, playerAvatars);\n    }\n    presented = {hand:snap.handNumber,bids:[...(snap.bidStatus||[])],trump:snap.trump,moon:!!snap.shotTheMoon};\n\n    if (snap.lastSummary) {\n      const signature = String(snap.handNumber) + \":\" + String(snap.revision);\n      if (signature !== lastScoreSignature) {\n        lastScoreSignature = signature;\n        const nestCards = snap.nestCards || [];\n        const nestPts = nestCards.reduce((sum, card) => sum + (typeof cardPoints === \"function\" ? cardPoints(card) : 0), 0);\n        const nestWinnerName = snap.lastSummary.nestTeam != null && typeof teamLabel === \"function\"\n          ? teamLabel(snap.lastSummary.nestTeam)\n          : \"Winning team\";\n        try { showScoreModal({ ...snap.lastSummary, nestCards, nestPts, nestWinnerName }); } catch (_) {}\n        wireCloudScoreButton(!!snap.matchResult);\n        if (snap.matchResult && !window._horCloudWinnerShown) {\n          window._horCloudWinnerShown = true;\n          try { showWinCelebration(snap.matchResult === \"Team A\" ? teamLabel(0) : snap.matchResult === \"Team B\" ? teamLabel(1) : snap.matchResult, snap.scores); } catch (_) {}\n        }\n      }\n    }\n    if (snap.phase === \"redeal\" && credentials.seat === 0 && redealRevision !== snap.revision) {\n      redealRevision = snap.revision;\n      setTimeout(() => sendAction(\"redeal\", {}), 0);\n    }\n  }\n\n  function wireCloudScoreButton(isFinal) {\n    const next = document.getElementById(\"scoreModalNext\") || document.querySelector(\"#scoreModal [data-action='next']\") || document.querySelector(\"#scoreModal button:last-of-type\");\n    if (!next) return;\n    next.textContent = isFinal ? \"OK\" : credentials.seat === 0 ? \"Next Hand\" : \"Waiting for host\";\n    next.disabled = !isFinal && credentials.seat !== 0;\n    next.onclick = (event) => {\n      event.preventDefault();\n      document.getElementById(\"scoreModal\")?.classList.add(\"hidden\");\n      if (!isFinal) sendAction(\"next-hand\", {});\n    };\n  }\n\n  async function refresh() {\n    if (!credentials || busy) return;\n    try {\n      const snap = await api(roomPath(\"snapshot\"));\n      receiveSnapshot(snap);\n    } catch (error) {\n      status(\"Connection issue. Reconnecting\\u2026 (\" + error.message + \")\");\n    }\n  }\n\n  function receiveSnapshot(snap) {\n    if (!credentials || !snap || (credentials.serverRoomId && snap.roomId !== credentials.serverRoomId) || !Number.isInteger(snap.revision) || snap.revision < lastRevision) return;\n    if (!credentials.serverRoomId) { credentials.serverRoomId = snap.roomId; localStorage.setItem(credentialKey, JSON.stringify(credentials)); }\n    latest = snap;\n    if (snap.revision !== lastRevision || lastRevision < 0) {\n      lastRevision = snap.revision;\n      if (snap.phase === \"waiting\") enterWaiting(snap);\n      else gameSnapshot(snap);\n    }\n  }\n\n  function setFallbackPolling(enabled) {\n    clearInterval(timer);\n    timer = enabled ? setInterval(refresh, 15000) : null;\n  }\n\n  function scheduleSocketReconnect() {\n    if (socketReconnectTimer || !credentials) return;\n    setFallbackPolling(true);\n    const delay = Math.min(30000, 1000 * (2 ** Math.min(socketRetryCount++, 5)));\n    socketReconnectTimer = setTimeout(() => {\n      socketReconnectTimer = null;\n      connectSocket();\n    }, delay);\n  }\n\n  async function connectSocket() {\n    if (!credentials || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;\n    const owner = credentials;\n    try {\n      const issued = await api(roomPath(\"ws-ticket\"), { method: \"POST\", body: {} });\n      if (credentials !== owner) return;\n      const endpoint = new URL(roomPath(\"ws\"), window.location.origin);\n      endpoint.protocol = endpoint.protocol === \"https:\" ? \"wss:\" : \"ws:\";\n      endpoint.searchParams.set(\"ticket\", issued.ticket);\n      const next = new WebSocket(endpoint.toString());\n      socket = next;\n      next.onopen = () => {\n        socketRetryCount = 0;\n        setFallbackPolling(false);\n      };\n      next.onmessage = (event) => {\n        if (credentials !== owner) return;\n        try {\n          const message = JSON.parse(event.data);\n          if (message.type === \"snapshot\") receiveSnapshot(message.snapshot);\n        } catch (_) {}\n      };\n      next.onerror = () => {};\n      next.onclose = () => {\n        if (socket === next) {\n          socket = null;\n          scheduleSocketReconnect();\n        }\n      };\n    } catch (_) {\n      scheduleSocketReconnect();\n    }\n  }\n\n  function startRealtime() {\n    clearInterval(timer);\n    clearTimeout(socketReconnectTimer);\n    socketReconnectTimer = null;\n    try { socket?.close(); } catch (_) {}\n    socket = null;\n    socketRetryCount = 0;\n    lastRevision = -1;\n    refresh();\n    setFallbackPolling(true);\n    connectSocket();\n  }\n\n  async function joinByCode() {\n    const input = document.getElementById(\"hor-room-code\");\n    const name = (document.getElementById(\"hor-player-name\")?.value || \"\").trim();\n    const code = (input?.value || \"\").trim().toUpperCase();\n    if (!name || !code) throw new Error(\"Enter your name and the room code.\");\n    const playerId = ownId();\n    let saved = null;\n    try { saved = JSON.parse(localStorage.getItem(credentialKey) || \"null\"); } catch (_) {}\n    const resumeToken = saved?.roomCode === code && saved?.playerId === playerId ? saved.token : null;\n    const result = await api(\"/rooms/\" + encodeURIComponent(code) + \"/join\", {\n      method: \"POST\",\n      body: { playerId, displayName: name, resumeToken, avatar: ensurePreferredAvatar(), voice: loadPreferredVoice() },\n      token: null,\n    });\n    credentialsFrom({ ...result, roomCode: code }, playerId);\n    startRealtime();\n  }\n\n  async function createCloudRoom() {\n    const name = (document.getElementById(\"hor-player-name\")?.value || \"\").trim();\n    if (!name) throw new Error(\"Enter your name first.\");\n    const playerId = ownId();\n    const result = await api(\"/rooms\", {\n      method: \"POST\",\n      body: { playerId, displayName: name, avatar: ensurePreferredAvatar(), voice: loadPreferredVoice() },\n      token: null,\n    });\n    credentialsFrom(result, playerId);\n    startRealtime();\n  }\n\n  async function sendAction(route, data) {\n    if (!credentials || !latest) return;\n    if (busy) {\n      // A pushed next turn may arrive before the previous HTTP refresh finishes.\n      // Keep one intention only for that exact authoritative room/hand/revision.\n      queuedAction = {route, data, owner: credentials, revision: latest.revision, hand: latest.handNumber};\n      return;\n    }\n    busy = true;\n    const body = {\n      actionId: crypto.randomUUID(),\n      expectedRevision: latest.revision,\n      ...data,\n    };\n    try {\n      await api(roomPath(route), { method: \"POST\", body });\n      await refreshAfterAction();\n    } catch (error) {\n      status(\"Move not accepted: \" + error.message);\n      await refreshAfterAction();\n    } finally {\n      busy = false;\n      const next = queuedAction;\n      queuedAction = null;\n      if (next && next.owner === credentials && next.revision === latest?.revision && next.hand === latest?.handNumber)\n        queueMicrotask(() => sendAction(next.route, next.data));\n    }\n  }\n\n  async function refreshAfterAction() {\n    if (!credentials) return;\n    try { receiveSnapshot(await api(roomPath(\"snapshot\"))); } catch (_) {}\n  }\n\n  async function startCloudGame() {\n    if (!credentials || credentials.seat !== 0) return;\n    try {\n      await api(roomPath(\"start\"), { method: \"POST\", body: {options: {targetScore: normalizeTargetScore(targetScore), includeRed2, revealTopNest, shootMoonEnabled}}, token: credentials.token });\n      await refreshAfterAction();\n    } catch (error) { status(\"Could not start the table: \" + error.message); }\n  }\n\n  async function reconnectCloudRoom() {\n    if (sessionStorage.getItem(\"ghr-cloud-disconnected\") === \"1\") return false;\n    let saved = null;\n    try { saved = JSON.parse(localStorage.getItem(credentialKey) || \"null\"); } catch (_) { return false; }\n    if (!saved || !saved.roomCode || !saved.token) return false;\n    credentials = saved;\n    roomCode = saved.roomCode;\n    myIndex = saved.seat;\n    myPeerId = playerIdForSeat(saved.seat);\n    myName = (document.getElementById(\"hor-player-name\")?.value || \"Player\").trim() || \"Player\";\n    try {\n      const snap = await api(roomPath(\"snapshot\"));\n      latest = snap;\n      if (snap.phase === \"waiting\") enterWaiting(snap);\n      else gameSnapshot(snap);\n      startRealtime();\n      return true;\n    } catch (error) {\n      if ([\"ROOM_NOT_FOUND\", \"UNAUTHORIZED\"].includes(error.message)) {\n        localStorage.removeItem(credentialKey);\n        credentials = null;\n        return false;\n      }\n      status(\"Connection interrupted. Your seat is saved; retrying.\");\n      startRealtime();\n      return true;\n    }\n  }\n\n  function disconnectCloudRoom() {\n    // Disconnect is reversible: keep the server seat and its reconnect credential.\n    sessionStorage.setItem(\"ghr-cloud-disconnected\", \"1\");\n    credentials = null;\n    clearInterval(timer);\n    clearTimeout(socketReconnectTimer);\n    socketReconnectTimer = null;\n    const previous = socket;\n    socket = null;\n    try { previous?.close(); } catch (_) {}\n    location.reload();\n  }\n  window.clientLeaveReplace = () => {\n    if (!credentials) return native.clientLeaveReplace?.();\n    if (confirm(\"Leave this screen? Your seat stays reserved so you can rejoin. No bot will replace you.\")) disconnectCloudRoom();\n  };\n  window.leaveTableAfterConfirmation043 = (...args) => credentials ? disconnectCloudRoom() : native.leaveTableAfterConfirmation043?.(...args);\n  window.leaveTableToLobby043 = (...args) => credentials ? disconnectCloudRoom() : native.leaveTableToLobby043?.(...args);\n  // Spectator mode is unsupported by the private room server.\n  for (const id of [\"spectateBtn\", \"welcomeWatchBtn\"]) {\n    const button = document.getElementById(id);\n    if (button) { button.disabled = true; button.title = \"Watch-only unavailable in cloud test\"; }\n  }\n  // Existing listener registrations may still hold the legacy leave callback.\n  document.addEventListener(\"click\", event => {\n    const button = event.target.closest?.(\"#leaveBtn,#leaveReplaceBtn,#rejoinBtn,#reconnectBtn,#friendsToggleBtn,#createBtn,#joinConfirmBtn,#fillSeatsBtn,#startBtn,#spectateBtn,#welcomeWatchBtn,#shareBtn,#showQrBtn\");\n    if (!button) return;\n    event.preventDefault();\n    event.stopImmediatePropagation();\n    if ([\"spectateBtn\", \"welcomeWatchBtn\"].includes(button.id)) {\n      status(\"Watch-only is unavailable in the private Cloudflare test.\");\n      return;\n    }\n    if ([\"shareBtn\", \"showQrBtn\"].includes(button.id)) {\n      status(\"Open this private Cloudflare page separately and enter room code \" + (credentials?.roomCode || \"\"));\n      return;\n    }\n    if ([\"friendsToggleBtn\", \"createBtn\"].includes(button.id)) {\n      createCloudRoom().catch(error => status(error.message));\n    } else if (button.id === \"joinConfirmBtn\") {\n      joinByCode().catch(error => status(error.message));\n    } else if (button.id === \"fillSeatsBtn\") {\n      if (credentials?.seat !== 0) { showBotFillStatus(\"This phone is not connected as the host. Rejoin the host seat, then try again.\", button); return; }\n      if (busy) { showBotFillStatus(\"The table is finishing another action. Wait a moment, then tap again.\", button); return; }\n      busy = true;\n      button.disabled = true;\n      showBotFillStatus(\"Adding test bots to the open seats\u2026\", button);\n      api(roomPath(\"fill-bots\"), { method: \"POST\", body: {} })\n        .then(snap => { receiveSnapshot(snap); showBotFillStatus(\"Bots added. The table is ready to start.\", button); })\n        .catch(error => showBotFillStatus(\"Could not add bots: \" + error.message, button))\n        .finally(() => { busy = false; button.disabled = false; });\n    } else if (button.id === \"startBtn\") {\n      startCloudGame();\n    } else if ([\"rejoinBtn\", \"reconnectBtn\"].includes(button.id)) {\n      sessionStorage.removeItem(\"ghr-cloud-disconnected\");\n      reconnectCloudRoom();\n    } else window.clientLeaveReplace();\n  }, true);\n  let cloudSeat = null;\n  try { cloudSeat = JSON.parse(localStorage.getItem(credentialKey) || \"null\"); } catch (_) {}\n  document.getElementById(\"reconnectBox\")?.classList.toggle(\"hidden\", !cloudSeat?.token || !cloudSeat?.roomCode);\n  if (cloudSeat?.token && cloudSeat?.roomCode) {\n    const codeEl = document.getElementById(\"reconnectCode\");\n    if (codeEl) codeEl.textContent = cloudSeat.roomCode;\n    const resume = document.getElementById(\"reconnectBtn\");\n    if (resume) { resume.classList.remove(\"hidden\"); resume.textContent = \"Rejoin your reserved seat\"; }\n  }\n  window.saveSession = (...args) => credentials ? undefined : native.saveSession?.(...args);\n  window.createRoom = function () { return createCloudRoom().catch((error) => status(error.message)); };\n  window.joinRoom = function () { return joinByCode().catch((error) => status(error.message)); };\n  window.startGameWithToast = function (...args) { return credentials ? startCloudGame() : native.startGameWithToast?.(...args); };\n  window.submitBid = function (value, opts) {\n    if (!credentials) return native.submitBid?.(value, opts);\n    if (Number(value) !== 0 && isShootMoonBid(Number(value)) && !opts?.moonConfirmed) return;\n    return sendAction(\"bid\", { value: Number(value) });\n  };\n  window.submitDiscard = function (cardIds) { if (!credentials) return native.submitDiscard?.(cardIds); return sendAction(\"discard\", { cardIds: [...cardIds] }); };\n  window.submitTrump = function (color) { if (!credentials) return native.submitTrump?.(color); return sendAction(\"trump\", { color }); };\n  window.submitPlay = function (cardId) {\n    if (!credentials) return native.submitPlay?.(cardId);\n    if (Date.now() < playLockUntil) return;\n    playLockUntil = Date.now() + 450;\n    return sendAction(\"play\", { cardId });\n  };\n  window.hostStartNextHand = function (...args) { return credentials ? sendAction(\"next-hand\", {}) : native.hostStartNextHand?.(...args); };\n  window.onWaitSeatClick = async function (seat) {\n    if (!credentials) return native.onWaitSeatClick?.(seat);\n    if (!credentials) { status(\"Join the room before adding test bots.\"); return; }\n    if (credentials.seat !== 0) { status(\"Only the host can add test bots.\"); return; }\n    const target = (latest?.players || []).find(player => Number(player?.seat) === Number(seat));\n    if (target?.occupied) { status(\"That seat is already occupied.\"); return; }\n    const humanCount = (latest?.players || []).filter(player => player?.occupied && !player.isBot).length;\n    \n    if (busy) return;\n    busy = true;\n    try {\n      const snap = await api(roomPath(\"fill-bots\"), { method: \"POST\", body: {} });\n      latest = snap;\n      lastRevision = snap.revision;\n      enterWaiting(snap);\n    } catch (error) {\n      status(\"Could not add test bots: \" + error.message);\n    } finally {\n      busy = false;\n    }\n  };\n  window.hostProcessAllTrumpsClaim = function (...args) { return credentials ? sendAction(\"claim-remaining\", {}) : native.hostProcessAllTrumpsClaim?.(...args); };\n  window.hostDeclineClaim = function (...args) { return credentials ? sendAction(\"decline-claim\", {}) : native.hostDeclineClaim?.(...args); };\n\n  // Replace the existing PeerJS-only claim buttons with the same approved copy,\n  // routed through the authoritative room service instead.\n  window.showAllTrumpsClaimUI = function (...args) {\n    if (!credentials) return native.showAllTrumpsClaimUI?.(...args);\n    if (!latest?.canClaimRemaining || latest.currentPlayer !== credentials?.seat) return;\n    const panel = document.getElementById(\"actionPanel\");\n    if (!panel) return;\n    const reason = latest.remainingClaimReason === \"trumps\"\n      ? \"controls every remaining winning card\"\n      : \"can take the rest of the tricks\";\n    panel.className = \"action-panel trump-claim-panel lt-floating-panel\";\n    panel.classList.remove(\"hidden\", \"bid-panel\");\n    panel.innerHTML = \"<span><strong>\" + String(myName).replace(/[&<>\"']/g, \"\") + \"</strong> \" + reason + \".</span>\"\n      + '<button type=\"button\" id=\"layDownClaimBtn\" class=\"btn primary\">Lay Down &amp; End Hand</button>'\n      + '<button type=\"button\" id=\"continueClaimBtn\" class=\"btn\">Continue Playing</button>';\n    document.getElementById(\"layDownClaimBtn\")?.addEventListener(\"click\", () => sendAction(\"claim-remaining\", {}));\n    document.getElementById(\"continueClaimBtn\")?.addEventListener(\"click\", () => sendAction(\"decline-claim\", {}));\n  };\n\n  // Keep ordinary offline play in this copy available when cloud=1 is absent.\n  // The cloud branch has no careers, local award writes, or PeerJS seats.\n  // Private-test bots are controlled only by the server room reducer.\n  try { window.horRecordCareerHand = (...args) => credentials ? ({ ok: true, skipped: \"private-cloud-test\" }) : native.horRecordCareerHand?.(...args); } catch (_) {}\n  try { window.mergeLifetimeStats = (...args) => credentials ? undefined : native.mergeLifetimeStats?.(...args); } catch (_) {}\n  try { window.noteHumanAuction = (...args) => credentials ? undefined : native.noteHumanAuction?.(...args); } catch (_) {}\n  try { window.noteHumanHandEnd = (...args) => credentials ? undefined : native.noteHumanHandEnd?.(...args); } catch (_) {}\n  // PeerJS liveness must never evict or replace a cloud seat.\n  clearInterval(horHeartbeatTimer);\n  window.horStartHeartbeat = (...args) => credentials ? undefined : native.horStartHeartbeat?.(...args);\n  window.horBeginClientReconnect = (...args) => credentials ? undefined : native.horBeginClientReconnect?.(...args);\n  window.HOR_CLOUD_TEST_ACTIVE = true;\n  window.HORCloudDiagnostics = () => ({busy, queued: !!queuedAction, revision:lastRevision, seat:credentials?.seat ?? null});\n  // The Durable Object controls test bots. Prevent the legacy browser bot\n  // loop from issuing a second move against the same visible game.\n  window.isBotTurn = (...args) => credentials ? false : native.isBotTurn?.(...args);\n  window.scheduleBot = (...args) => credentials ? undefined : native.scheduleBot?.(...args);\n  window.runBotAction = (...args) => credentials ? undefined : native.runBotAction?.(...args);\n  status(\"Private cloud room test ready.\");\n  reconnectCloudRoom().then((resumed) => {\n    if (!resumed) status(\"Private cloud room test ready. Create a room or join with a code.\");\n  });\n})();\n\n";

// worker.mjs
var IDLE_ROOM_MS = 60 * 60 * 1e3;
var COMPLETED_ROOM_GRACE_MS = 5 * 60 * 1e3;
var PRIVATE_SESSION_COOKIE = "GHR-Private-Test";
var PRIVATE_SESSION_MS = 60 * 60 * 1e3;
var WS_TICKET_TTL_MS = 15e3;
var json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store, max-age=0", "pragma": "no-cache", "expires": "0", "vary": "Authorization, Cookie, X-Test-Gate, X-Test-Gate-UTF8" }
}), "json");
var fail = /* @__PURE__ */ __name((error) => {
  const known = /* @__PURE__ */ new Set([
    "ROOM_EXISTS",
    "ROOM_NOT_FOUND",
    "ROOM_FULL",
    "ROOM_NOT_JOINABLE",
    "HOST_ONLY",
    "FOUR_PLAYERS_REQUIRED",
    "INVALID_FIXTURE_HANDS",
    "ACTION_ID_REQUIRED",
    "ACTION_ID_REUSED",
    "GAME_NOT_PLAYING",
    "STALE_REVISION",
    "NOT_YOUR_TURN",
    "CARD_NOT_IN_YOUR_HAND",
    "CARD_NOT_IN_HAND",
    "UNAUTHORIZED",
    "PLAYER_ALREADY_SEATED",
    "INVALID_PLAYER_ID",
    "INVALID_DISPLAY_NAME",
    "NOT_BIDDING",
    "PAUSED",
    "AUCTION_NOT_OPEN",
    "INVALID_SEAT",
    "ALREADY_PASSED",
    "TWO_HUMANS_REQUIRED",
    "NO_OPEN_SEATS",
    "INVALID_BID", "INVALID_OPTIONS", "INVALID_TARGET_SCORE",
    "ILLEGAL_BID",
    "MOON_BID_NOT_ALLOWED",
    "INVALID_BIDDER",
    "NOT_DISCARDING",
    "NOT_BIDDER",
    "INVALID_DISCARD",
    "WRONG_DISCARD_COUNT",
    "NOT_CHOOSING_TRUMP",
    "INVALID_TRUMP",
    "NOT_PLAYING",
    "ILLEGAL_CARD",
    "COUNTER_TOTAL_MISMATCH",
    "INVALID_HAND_SIZE",
    "INVALID_NEST_SIZE",
    "DECK_TOO_SMALL",
    "INVALID_TARGET_SCORE",
    "INVALID_MIN_BID",
    "INVALID_LEAD_ORDER",
    "INVALID_NEST_DESTINATION",
    "DUPLICATE_PLAYER_ID",
    "NOT_REDEALING",
    "NOT_READY_FOR_NEXT_HAND",
    "MATCH_COMPLETE",
    "CLAIM_NOT_AVAILABLE"
  ]);
  return json(
    { error: known.has(error?.message) ? error.message : "INTERNAL_ERROR" },
    known.has(error?.message) ? 400 : 500
  );
}, "fail");
async function serveClient(request, env) {
  const response = env.ASSETS ? await env.ASSETS.fetch(request) : new Response(CLIENT_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (headers.get("content-type")?.includes("text/html")) headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
__name(serveClient, "serveClient");
function secureHtml(html) {
  return new Response(html, { headers: {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' wss://griffin-room-local-poc.jeromeleegriffin.workers.dev; form-action 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "cache-control": "no-store"
  } });
}
__name(secureHtml, "secureHtml");
function secureCloudGameHtml() {
  return new Response(CLOUD_GAME_LAUNCH_HTML, { headers: {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "cache-control": "no-store"
  } });
}
__name(secureCloudGameHtml, "secureCloudGameHtml");
function injectCloudGameAdapter(html) {
  if (typeof html !== "string" || !html.includes("</head>") || !html.includes("</body>")) {
    throw new Error("UPSTREAM_GAME_HTML_UNEXPECTED");
  }
  const prelude = `<base href="/cloud-game/assets/"><script>history.replaceState(null,"",location.pathname+"?cloud=1");try{if(navigator.serviceWorker&&navigator.serviceWorker.register)navigator.serviceWorker.register=()=>Promise.resolve(null)}catch(_){}<\/script>`;
  const adapter = `<script>${CLOUD_GAME_ADAPTER}<\/script>`;
  return html.replace(/<head([^>]*)>/i, (_whole, attrs) => `<head${attrs}>${prelude}`).replace(/<\/body>/i, `${adapter}</body>`).replace(/id="hor-room-code"([^>]*?)maxlength="6"/i, 'id="hor-room-code"$1maxlength="8"');
}
__name(injectCloudGameAdapter, "injectCloudGameAdapter");
function secureIntegratedGameHtml(html) {
  return new Response(html, { headers: {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' wss: https://0.peerjs.com wss://0.peerjs.com https://cdn.jsdelivr.net https://unpkg.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "cache-control": "no-store"
  } });
}
__name(secureIntegratedGameHtml, "secureIntegratedGameHtml");
function sameSecret(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  const encoder = new TextEncoder();
  const left = encoder.encode(actual);
  const right = encoder.encode(expected);
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return mismatch === 0;
}
__name(sameSecret, "sameSecret");
function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex, "bytesToHex");
async function digestHex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}
__name(digestHex, "digestHex");
async function issueRoomSocketTicket(storage, roomId, seat, seatToken, now = Date.now()) {
  const ticket = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const key = `ws-ticket:${await digestHex(ticket)}`;
  await storage.put(key, { roomId, seat, seatToken, expiresAt: now + WS_TICKET_TTL_MS });
  return { ticket, expiresAt: now + WS_TICKET_TTL_MS };
}
__name(issueRoomSocketTicket, "issueRoomSocketTicket");
async function consumeRoomSocketTicket(storage, ticket, roomId, now = Date.now()) {
  if (typeof ticket !== "string" || !/^[0-9a-f]{64}$/.test(ticket)) return null;
  const key = `ws-ticket:${await digestHex(ticket)}`;
  const record = await storage.get(key);
  if (!record) return null;
  if (record.roomId !== roomId) return null;
  await storage.delete(key);
  if (record.expiresAt <= now) return null;
  return record;
}
__name(consumeRoomSocketTicket, "consumeRoomSocketTicket");
async function signPrivateSession(secret, expiresAt, nonce) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = `${expiresAt}.${nonce}`;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`GHR-Private-Test|${payload}`));
  return `${payload}.${bytesToHex(new Uint8Array(signature))}`;
}
__name(signPrivateSession, "signPrivateSession");
async function issuePrivateSession(secret, now = Date.now()) {
  const expiresAt = now + PRIVATE_SESSION_MS;
  const nonce = crypto.randomUUID();
  return { token: await signPrivateSession(secret, expiresAt, nonce), expiresAt };
}
__name(issuePrivateSession, "issuePrivateSession");
async function verifyPrivateSession(token, secret, now = Date.now()) {
  if (typeof token !== "string" || typeof secret !== "string") return false;
  const match = token.match(/^(\d{13})\.([0-9a-f-]{36})\.([0-9a-f]{64})$/);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + PRIVATE_SESSION_MS + 5e3) return false;
  const expected = await signPrivateSession(secret, expiresAt, match[2]);
  return sameSecret(token, expected);
}
__name(verifyPrivateSession, "verifyPrivateSession");
function cookieValue(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}
__name(cookieValue, "cookieValue");
async function authorizedTestRequest(request, expected) {
  const session = cookieValue(request, PRIVATE_SESSION_COOKIE);
  if (await verifyPrivateSession(session, expected)) return true;
  return sameSecret(requestGate(request), expected);
}
__name(authorizedTestRequest, "authorizedTestRequest");
function requestGate(request) {
  const encoded = request.headers.get("x-test-gate-utf8");
  if (encoded !== null) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }
  return request.headers.get("x-test-gate");
}
__name(requestGate, "requestGate");
var RoomDO = class extends DurableObject {
  static {
    __name(this, "RoomDO");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.allowTestFixtures = env.ALLOW_TEST_FIXTURES === "1";
    this.service = new RoomService(ctx.storage);
    this.roomKey = ctx.id.toString();
    this.serial = Promise.resolve();
  }
  fetch(request) {
    const task = this.serial.then(async () => {
      const url = new URL(request.url);
      const isSocketUpgrade = request.headers.get("upgrade")?.toLowerCase() === "websocket";
      const response = isSocketUpgrade ? await this.#connectSocket(request, url) : await this.#dispatch(request);
      if (response.ok && request.method !== "GET") {
        let status;
        try {
          status = (await response.clone().json()).status;
        } catch {
        }
        const delay = status === "complete" ? COMPLETED_ROOM_GRACE_MS : IDLE_ROOM_MS;
        await this.ctx.storage.setAlarm(Date.now() + delay);
      }
      if (response.ok && request.method === "POST" && url.pathname !== "/ws-ticket") {
        await this.#broadcastSnapshots();
      }
      return response;
    });
    this.serial = task.catch(() => {
    });
    return task;
  }
  async #connectSocket(request, url) {
    if (request.method !== "GET" || url.pathname !== "/ws" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "WEBSOCKET_UPGRADE_REQUIRED" }, 426);
    }
    const record = await consumeRoomSocketTicket(this.ctx.storage, url.searchParams.get("ticket"), this.roomKey);
    if (!record) return json({ error: "INVALID_OR_EXPIRED_SOCKET_TICKET" }, 401);
    try {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [`seat:${record.seat}`]);
      server.serializeAttachment({ seat: record.seat, seatToken: record.seatToken });
      const snapshot = await this.service.snapshot(this.roomKey, record.seatToken);
      server.send(JSON.stringify({ type: "snapshot", snapshot }));
      return new Response(null, { status: 101, webSocket: client });
    } catch {
      return json({ error: "WEBSOCKET_SETUP_FAILED" }, 500);
    }
  }
  async #broadcastSnapshots() {
    for (const socket of this.ctx.getWebSockets?.() || []) {
      if (socket.readyState !== 1) continue;
      const attachment = socket.deserializeAttachment();
      if (!attachment || !Number.isInteger(attachment.seat) || typeof attachment.seatToken !== "string") {
        try {
          socket.close(1008, "Invalid seat session");
        } catch {
        }
        continue;
      }
      try {
        const snapshot = await this.service.snapshot(this.roomKey, attachment.seatToken);
        socket.send(JSON.stringify({ type: "snapshot", snapshot }));
      } catch {
        try {
          socket.close(1008, "Seat session expired");
        } catch {
        }
      }
    }
  }
  async webSocketMessage(socket) {
    try {
      socket.close(1008, "Use the room action API");
    } catch {
    }
  }
  async webSocketClose() {
  }
  async webSocketError(socket) {
    try {
      socket.close(1011, "Socket error");
    } catch {
    }
  }
  async alarm() {
    const task = this.serial.then(async () => {
      await this.service.cleanup(this.roomKey, { maxIdleMs: IDLE_ROOM_MS });
      const room = await this.ctx.storage.get(this.roomKey);
      if (!room) {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 6e4, room.lastActivityAt + IDLE_ROOM_MS));
    });
    this.serial = task.catch(() => {
    });
    return task;
  }
  async #dispatch(request) {
    const url = new URL(request.url);
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    try {
      if (request.method === "POST" && url.pathname === "/create") {
        const body = await request.json();
        return json(await this.service.create(this.roomKey, body.playerId, body.displayName, body.avatar, body.voice), 201);
      }
      if (request.method === "POST" && url.pathname === "/join") {
        const body = await request.json();
        return json(await this.service.join(this.roomKey, body.playerId, body.displayName, body.resumeToken, body.avatar, body.voice), 201);
      }
      if (request.method === "POST" && url.pathname === "/fill-bots") {
        return json(await this.service.fillOpenSeatsWithBots(this.roomKey, token));
      }
      if (request.method === "GET" && url.pathname === "/snapshot") {
        return json(await this.service.snapshot(this.roomKey, token));
      }
      if (request.method === "POST" && url.pathname === "/ws-ticket") {
        const seat = await this.service.seatForToken(this.roomKey, token);
        return json(await issueRoomSocketTicket(this.ctx.storage, this.roomKey, seat, token));
      }
      if (this.allowTestFixtures && request.method === "POST" && url.pathname === "/start-fixture") {
        const body = await request.json();
        return json(await this.service.startFixtureGame(this.roomKey, token, body.handsBySeat));
      }
      if (request.method === "POST" && url.pathname === "/start") {
        const body = await request.json(); return json(await this.service.startGame(this.roomKey, token, safeOptions(body.options)));
      }
      if (request.method === "POST" && url.pathname === "/bid") {
        return json(await this.service.bid(this.roomKey, token, await request.json()));
      }
      if (request.method === "POST" && url.pathname === "/discard") {
        return json(await this.service.discard(this.roomKey, token, await request.json()));
      }
      if (request.method === "POST" && url.pathname === "/trump") {
        return json(await this.service.chooseTrump(this.roomKey, token, await request.json()));
      }
      if (request.method === "POST" && url.pathname === "/play") {
        return json(await this.service.playCard(this.roomKey, token, await request.json()));
      }
      if (request.method === "POST" && url.pathname === "/claim-remaining") {
        return json(await this.service.claimRemainingCards(this.roomKey, token, await request.json()));
      }
      if (request.method === "POST" && url.pathname === "/decline-claim") {
        return json(await this.service.declineRemainingClaim(this.roomKey, token, await request.json()));
      }
      if (request.method === "POST" && url.pathname === "/next-hand") {
        return json(await this.service.startNextHand(this.roomKey, token, await request.json()));
      }
      if (request.method === "POST" && url.pathname === "/redeal") {
        return json(await this.service.redeal(this.roomKey, token, await request.json()));
      }
      if (this.allowTestFixtures && request.method === "POST" && url.pathname === "/play-fixture") {
        const body = await request.json();
        return json(await this.service.playFixtureCard(this.roomKey, token, body));
      }
      return json({ error: "NOT_FOUND" }, 404);
    } catch (error) {
      return fail(error);
    }
  }
};
var alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function roomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
__name(roomCode, "roomCode");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/cloud-game/index.html") {
      return secureCloudGameHtml();
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/cloud-game/assets/")) {
      const rawAssetPath = url.pathname.slice("/cloud-game/assets/".length);
      let assetParts;
      try {
        assetParts = rawAssetPath.split("/").map(decodeURIComponent);
      } catch {
        assetParts = [];
      }
      if (!assetParts.length || assetParts.some((part) => !part || part === "." || part === ".." || /[\\/\u0000]/.test(part) || /%[0-9a-f]{2}/i.test(part))) {
        return new Response("Not found", { status: 404 });
      }
      try {
        const assetPath = assetParts.map(encodeURIComponent).join("/");
        const upstream = await fetch(`https://raw.githubusercontent.com/jeromeleegriffin/Test/18cf361be26dd5d65b3c8aa384c2a5434f730a93/${assetPath}`, {
          method: request.method,
          headers: { "accept": request.headers.get("accept") || "*/*" },
          redirect: "follow",
          cf: { cacheEverything: true, cacheTtlByStatus: {"200-299": 86400, "300-599": -1} }
        });
        const headers = new Headers();
        for (const name of ["content-type", "etag", "last-modified"]) {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        }
        const mime = {js:"text/javascript",css:"text/css",html:"text/html",json:"application/json",svg:"image/svg+xml",webp:"image/webp",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",mp3:"audio/mpeg",ogg:"audio/ogg",wav:"audio/wav",woff2:"font/woff2",wasm:"application/wasm"}[rawAssetPath.split(".").pop().toLowerCase()]; if (mime) headers.set("content-type", mime); headers.set("cache-control", upstream.ok ? "public, max-age=300" : "no-store"); headers.set("x-ghr-origin-cache", upstream.headers.get("cf-cache-status") || "UNKNOWN");
        headers.set("x-content-type-options", "nosniff");
        return new Response(request.method === "HEAD" ? null : upstream.body, {
          status: upstream.status,
          headers
        });
      } catch {
        return new Response("Game asset temporarily unavailable", { status: 502 });
      }
    }
    if (request.method === "POST" && url.pathname === "/cloud-game/launch") {
      let suppliedGate = null;
      try {
        suppliedGate = (await request.json())?.key;
      } catch {
      }
      if (!sameSecret(suppliedGate, env.TEST_GATE_KEY)) {
        return json({ error: "TEST_ACCESS_REQUIRED" }, 401);
      }
      const session = await issuePrivateSession(env.TEST_GATE_KEY);
      return new Response(null, { status: 204, headers: {
        "Set-Cookie": `${PRIVATE_SESSION_COOKIE}=${session.token}; Path=/; Max-Age=${Math.floor(PRIVATE_SESSION_MS / 1e3)}; HttpOnly; Secure; SameSite=Strict`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer"
      } });
    }
    if (request.method === "GET" && url.pathname === "/cloud-game/game") {
      if (!await verifyPrivateSession(cookieValue(request, PRIVATE_SESSION_COOKIE), env.TEST_GATE_KEY)) {
        return new Response("The private test session expired. Open the private test page and enter the key again.", {
          status: 401,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" }
        });
      }
      try {
        const upstream = await fetch("https://raw.githubusercontent.com/jeromeleegriffin/Test/18cf361be26dd5d65b3c8aa384c2a5434f730a93/index.html", { redirect: "follow", cf: {cacheEverything: true, cacheTtlByStatus: {"200-299":86400,"300-599":-1}} });
        if (!upstream.ok) return new Response("The private game copy is temporarily unavailable.", { status: 502 });
        const integrated = injectCloudGameAdapter(await upstream.text());
        return secureIntegratedGameHtml(integrated);
      } catch {
        return new Response("The private game copy is temporarily unavailable.", { status: 502 });
      }
    }
    if (url.pathname === "/four-player-check") return secureHtml(FOUR_PLAYER_CHECK_HTML);
    if (url.pathname.startsWith("/rooms/") || url.pathname === "/rooms") {
      if (!await authorizedTestRequest(request, env.TEST_GATE_KEY)) {
        return json({ error: "TEST_ACCESS_REQUIRED" }, 401);
      }
    }
    const match = url.pathname.match(/^\/rooms\/([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8})(?:\/(join|snapshot|ws-ticket|ws|fill-bots|start-fixture|play-fixture|start|bid|discard|trump|play|claim-remaining|decline-claim|next-hand|redeal))?$/);
    if (request.method === "POST" && url.pathname === "/rooms") {
      try {
        const body = await request.json();
        if (typeof body.playerId !== "string" || typeof body.displayName !== "string") {
          return json({ error: "PLAYER_ID_AND_DISPLAY_NAME_REQUIRED" }, 400);
        }
        const code2 = roomCode();
        const stub2 = env.ROOMS.getByName(code2);
        const response = await stub2.fetch("https://room.local/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!response.ok) return response;
        return json({ roomCode: code2, ...await response.json() }, 201);
      } catch {
        return json({ error: "INVALID_REQUEST" }, 400);
      }
    }
    if (!match) return serveClient(request, env);
    const [, code, action] = match;
    if (!action) return serveClient(request, env);
    const stub = env.ROOMS.getByName(code);
    const target = new URL(request.url);
    target.hostname = "room.local";
    target.pathname = action === "join" ? "/join" : `/${action}`;
    return stub.fetch(new Request(target, request));
  }
};
export {
  RoomDO,
  consumeRoomSocketTicket,
  worker_default as default,
  injectCloudGameAdapter,
  issueRoomSocketTicket
};
//# sourceMappingURL=worker.js.map



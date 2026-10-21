function beginCloudClaim(room,result){if(result.event!=="remaining-cards-claimed")return;const before=room.gameState,player=before.currentPlayer,cards=clone2(before.hands[player]);room.claimOpening={player,cards,reason:result.reason,scores:before.scores,expiresAt:Date.now()+cloudDelay(room,4400,600)};result.state.lastSummary={...result.state.lastSummary,claimer:player,claimerName:before.players[player]?.name,claimReason:result.reason,claimRevealHands:before.hands.map((cards,seat)=>({player:seat,name:before.players[seat]?.name,team:seat%2,laidDown:seat===player,cards:clone2(cards)})),lastTricks:clone2(room.recentTricks||[])};}
function cloudDelay(room,base,floor=0){const divisor=room.pace===99?20:room.pace===3?3:1;return Math.max(floor,Math.round(base/divisor));}
function cloudStampDuration(room){return cloudDelay(room,1950,950);}
function beginCloudCollection(room,result){const before=room.gameState,after=result.state;if(!["trick-complete","hand-complete"].includes(result.event)||before.trick?.length!==3)return;const seat=before.currentPlayer,removed=before.hands[seat].filter(c=>!after.hands[seat].some(x=>x.id===c.id));if(removed.length!==1)return;const trick=[...before.trick,{player:seat,card:removed[0]}],winner=after.lastTrickWinner,winning=trick.find(p=>p.player===winner)?.card,bird=winning?.id==="rook"&&trick.some(p=>p.card.id==="red-2"),points=trick.reduce((n,p)=>n+cardPoints(p.card,before.settings.rules),0);room.trickOpening={trick,winner,ledColor:before.ledColor,points,scores:before.scores,bird,expiresAt:Date.now()+(bird?cloudDelay(room,6200,room.pace===99?2700:room.pace===3?3400:0):cloudDelay(room,3600,600))};room.recentTricks=[{plays:trick,winner,ledColor:before.ledColor,trump:before.trump,points,team:winner%2,winnerName:before.players[winner]?.name,hand:before.handNumber},...(room.recentTricks||[])].slice(0,3);}
function beginCloudTrump(room){room.trumpOpening={handNumber:room.gameState.handNumber,durationMs:cloudStampDuration(room),expiresAt:Date.now()+cloudStampDuration(room)+850};}
function beginCloudOpening(room) {room.x1=freshOnlineX1(room.gameState);room.opening={id:crypto.randomUUID(),handNumber:room.gameState.handNumber,notBefore:Date.now()+cloudDelay(room,3500,350),expiresAt:Date.now()+25000,readySeats:[]};}
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
  async create(roomId, hostId, displayName, avatar = "cinder", voice = "avatar", pace = 1) {
    if(![1,3,99].includes(pace))throw Error("INVALID_PACE");
    validateIdentity(hostId, displayName);
    if (await this.storage.get(roomId)) throw new Error("ROOM_EXISTS");
    const token = this.tokenFactory();
    const room = {
      id: roomId, pace,
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
  async fillOpenSeatsWithBots(roomId, token, requestedSeat) {
    const room = await this.#room(roomId);
    const hostSeat = this.#authorizedSeat(room, token);
    if (hostSeat !== 0) throw new Error("HOST_ONLY");
    if (room.status !== "waiting") throw new Error("ROOM_NOT_JOINABLE");
    
    const open = room.seats.map((entry, seat) => entry === null ? seat : -1).filter((seat) => seat >= 0);
    if (!open.length) return this.snapshot(roomId, token);
    if(requestedSeat!==undefined){if(!Number.isInteger(requestedSeat)||requestedSeat<1||requestedSeat>3)throw Error("INVALID_SEAT");if(room.seats[requestedSeat]!==null)throw Error("SEAT_OCCUPIED");}
    for (const seat of requestedSeat===undefined?open:[requestedSeat]) {
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
    beginCloudOpening(room);
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
        pace:room.pace||1,
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
      pace:room.pace||1,
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
  async setBotSeat(roomId,token,{seat,name,expectedRevision}){const room=await this.#room(roomId);if(this.#authorizedSeat(room,token)!==0)throw Error("HOST_ONLY");if(room.status!=="waiting")throw Error("ROOM_NOT_JOINABLE");if(expectedRevision!==room.revision)throw Error("STALE_REVISION");if(!Number.isInteger(seat)||seat<1||seat>3)throw Error("INVALID_SEAT");const old=room.seats[seat];if(old&&!old.isBot)throw Error("HUMAN_SEAT_RESERVED");if(name===null){room.seats[seat]=null;}else{const pool={"Crow":"crow","Blaze":"blaze","Nix":"nix","Titan":"titan","Pike":"pike","Drift":"drift","Dice":"dice","Anchor":"anchor","Wager":"wager","Hollow":"hollow","Ember":"ember","Vex":"vex","Frost":"frost","Fang":"fang","Halo":"halo","Quill":"quill","Bramble":"bramble","Moss":"moss","Emberlyn":"emberlyn","Cinder":"cinder","Gable":"gable","Thistle":"thistle","Marrow":"marrow","Pebble":"pebble","Rookery":"rookery","Sable":"sable","Finch":"finch","Dagger":"dagger","Willow":"willow","Hearth":"hearth","Grit":"grit","Copper":"copper","Moth":"moth","Brandy":"brandy","Flint":"flint","Ivy":"ivy","Shade":"shade","Barrel":"barrel","Spark":"spark","Nettle":"nettle","Cobalt":"cobalt","Ash":"ash","Harrier":"harrier","Claire":"claire","June":"june","Tess":"tess","Marcus":"marcus","Owen":"owen","Daniel":"daniel","Sofia":"sofia","Rafael":"rafael","Samir":"samir","Jerome":"jerome_founder","Rita":"rita"};const avatar=pool[name];if(!Object.prototype.hasOwnProperty.call(pool,name))throw Error("INVALID_BOT");if(room.seats.some((p,i)=>i!==seat&&p&&(p.avatar===avatar||p.displayName===name)))throw Error("BOT_ALREADY_SEATED");room.seats[seat]={playerId:`private-test-bot-${seat}`,displayName:name,avatar,isBot:true,token:null};}room.revision++;room.lastActivityAt=Date.now();await this.storage.put(roomId,room);return this.snapshot(roomId,token);}
  async readyForBidding(roomId, token, handNumber, openingId) {const room=await this.#room(roomId);const seat=this.#authorizedSeat(room,token);if(room.gameState?.handNumber!==handNumber)throw Error("STALE_DEAL");if(openingId&&room.opening&&openingId!==room.opening.id)throw Error("STALE_DEAL");if(room.opening&&!room.opening.readySeats.includes(seat)){room.opening.readySeats.push(seat);await this.storage.put(roomId,room);}await this.#driveBots(roomId);return this.#gameSnapshot(await this.#room(roomId),token);}
  async setPace(roomId,token,pace){const room=await this.#room(roomId);if(this.#authorizedSeat(room,token)!==0)throw Error("HOST_ONLY");if(![1,3,99].includes(pace))throw Error("INVALID_PACE");if(room.pace!==pace){room.pace=pace;room.revision++;room.lastActivityAt=Date.now();delete room.botTurn;await this.storage.put(roomId,room);}await this.#driveBots(roomId);return this.snapshot(roomId,token);}
  async closeTable(roomId, token) { const room=await this.storage.get(roomId); if(!room)throw Error("ROOM_NOT_FOUND"); if(this.#authorizedSeat(room,token)!==0)throw Error("HOST_ONLY"); if(room.status!=="closed"){room.status="closed";room.closedAt=Date.now();room.lastActivityAt=Date.now();room.revision++;await this.storage.put(roomId,room);}return {status:"closed"}; }
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
    if(room.status==="closed")throw Error("ROOM_CLOSED");
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
      botIntelligence: onlineX1Proof(room),
      phase:room.claimOpening?"play":room.trickOpening?"play":room.opening?"dealing":room.gameState.phase,
      ...(room.trickOpening?{trick:clone2(room.trickOpening.trick),ledColor:room.trickOpening.ledColor,lastTrickWinner:room.trickOpening.winner,currentPlayer:room.trickOpening.winner,resolvingTrick:true,resolvingTrickPoints:room.trickOpening.points,scores:room.trickOpening.scores,lastSummary:null,matchResult:null,nestCards:null,canClaimRemaining:false}:{}),
      ...(room.claimOpening?{claimAnimation:{player:room.claimOpening.player,cards:clone2(room.claimOpening.cards),reason:room.claimOpening.reason},resolvingTrick:true,resolvingTrickPoints:0,canClaimRemaining:false,scores:room.claimOpening.scores,lastSummary:null,matchResult:null,nestCards:null}:{}),
      claimDeclined:!!room.gameState.claimDeclined,
      recentTricks:clone2(room.recentTricks||[]),
      trumpPresentationMs:room.trumpOpening?.durationMs||cloudStampDuration(room),
      trumpOpening:room.trumpOpening?{handNumber:room.trumpOpening.handNumber,remainingMs:Math.max(0,room.trumpOpening.expiresAt-Date.now())}:null,
      opening:room.opening?{id:room.opening.id,handNumber:room.opening.handNumber,minimumRemainingMs:Math.max(0,room.opening.notBefore-Date.now()),deadlineRemainingMs:Math.max(0,room.opening.expiresAt-Date.now())}:null,
      pace:room.pace||1,
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
    if(room.claimOpening&&Date.now()<room.claimOpening.expiresAt)throw Error("CLAIM_IN_PROGRESS");
    if(room.trickOpening&&Date.now()<room.trickOpening.expiresAt)throw Error("TRICK_IN_PROGRESS");
    if(room.opening)throw Error("DEAL_IN_PROGRESS");
    if(room.trumpOpening&&Date.now()<room.trumpOpening.expiresAt)throw Error("TRUMP_IN_PROGRESS");
    if (action.expectedRevision !== room.revision) throw new Error("STALE_REVISION");
    const result = transition(room.gameState, seat, value);
    if (!result.accepted) throw new Error(result.reason || "INVALID_ACTION");
    if(room.gameState.phase==="trump"&&result.state.phase==="play")beginCloudTrump(room);
    beginCloudCollection(room,result);
    beginCloudClaim(room,result);
    observeOnlineX1(room, room.gameState, result);
    room.gameState = result.state;
    if((type==="next-hand"||type==="redeal")&&room.gameState.phase==="bidding")beginCloudOpening(room);
    room.revision += 1;
    room.lastActivityAt = Date.now();
    if (room.gameState.phase === "complete"&&!room.trickOpening&&!room.claimOpening) room.status = "complete";
    const response = { accepted: true, event: result.event, revision: room.revision, status: room.status };
    room.actions[actionId] = { seat, fingerprint, result: response };
    await this.storage.put(roomId, room);
    await this.#driveBots(roomId);
    return { ...response, revision: (await this.#room(roomId)).revision };
  }
  async #driveBots(roomId) {
    for (let steps = 0; steps < 500; steps += 1) {
      const room = await this.#room(roomId);
      if(room.opening){const o=room.opening;const allReady=room.seats.every((seat,index)=>seat.isBot||o.readySeats.includes(index));if(Date.now()<o.notBefore||(!allReady&&Date.now()<o.expiresAt))return;delete room.opening;room.revision++;await this.storage.put(roomId,room);}
      if(room.trumpOpening){if(Date.now()<room.trumpOpening.expiresAt)return;delete room.trumpOpening;room.revision++;await this.storage.put(roomId,room); }
      if(room.trickOpening){if(Date.now()<room.trickOpening.expiresAt)return;delete room.trickOpening;room.revision++;if(room.gameState.phase==="complete")room.status="complete";await this.storage.put(roomId,room); }
      if(room.claimOpening){if(Date.now()<room.claimOpening.expiresAt)return;delete room.claimOpening;room.revision++;if(room.gameState.phase==="complete")room.status="complete";await this.storage.put(roomId,room); }
      const state = room.gameState;
      if (room.status !== "playing" || !state || !["bidding", "discard", "trump", "play"].includes(state.phase)) return;
      const seat = state.currentPlayer;
      if (!room.seats[seat]?.isBot) return;
      if(["bidding","discard","trump","play"].includes(state.phase)){const key=`${state.handNumber}:${room.revision}:${seat}`;if(room.botTurn?.key!==key){room.botTurn={key,due:Date.now()+cloudDelay(room,state.phase==="bidding"?1600:1200,state.phase==="bidding"?160:120)};await this.storage.put(roomId,room);return;}if(Date.now()<room.botTurn.due)return;delete room.botTurn;}
      const decision = chooseOnlineBotAction(room, seat);
      const action = decision.action;
      if (!action) return;
      let result;
      if (action.type === "bid") result = submitBid(state, seat, action.value);
      else if (action.type === "discard") result = discardCards(state, seat, action.cardIds);
      else if (action.type === "trump") result = chooseTrump(state, seat, action.color);
      else if (action.type === "play") result = playCard(state, seat, action.cardId);
      else return;
      if (!result.accepted) throw new Error("TEST_BOT_ACTION_REJECTED");
      if(room.gameState.phase==="trump"&&result.state.phase==="play")beginCloudTrump(room);
    beginCloudCollection(room,result);
    beginCloudClaim(room,result);
    observeOnlineX1(room, state, result, decision);
    room.gameState = result.state;
      room.revision += 1;
      room.lastActivityAt = Date.now();
      if (room.gameState.phase === "complete"&&!room.trickOpening&&!room.claimOpening) room.status = "complete";
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
var CLOUD_GAME_ADAPTER = "/*\n * Build-797 screen adapter for the isolated Cloudflare room server.\n * This source is injected only by the private test Worker when ?cloud=1 is\n * present. It is never added to the live Test site or production game.\n */\n(() => {\n  const query = new URLSearchParams(location.search);\n  if (!query.has(\"cloud\")) return;\n  // Private 846 adapter, eight-character Cloudflare room codes.\n  const codeField = document.getElementById(\"hor-room-code\");\n  if (codeField) codeField.maxLength = 8;\n  if (![\"846-r10-ambience-levels-20261021\"].includes(window.HOR_SCRIPT_BUILD)) {\n    const notice = document.getElementById(\"lobbyStatus\");\n    if (notice) notice.textContent = \"This game version has not been verified for private cloud play. Please wait for the test adapter update.\";\n    // Fail closed rather than silently falling back to browser-hosted rooms.\n    for (const name of [\"createRoom\", \"joinRoom\", \"startGameWithToast\"]) window[name] = () => {};\n    document.addEventListener(\"click\", event => {\n      if (event.target.closest?.(\"#friendsToggleBtn,#createBtn,#joinConfirmBtn,#startBtn,#rejoinBtn,#reconnectBtn\")) { event.preventDefault(); event.stopImmediatePropagation(); }\n    }, true);\n    return;\n  }\n\n  const native = {};\n  for (const name of [\"submitBid\", \"submitDiscard\", \"submitTrump\", \"submitPlay\", \"startGameWithToast\", \"clientLeaveReplace\", \"saveSession\", \"isBotTurn\", \"scheduleBot\", \"runBotAction\", \"horStartHeartbeat\", \"horBeginClientReconnect\", \"horRecordCareerHand\", \"mergeLifetimeStats\", \"noteHumanAuction\", \"noteHumanHandEnd\", \"hostStartNextHand\", \"hostProcessAllTrumpsClaim\", \"hostDeclineClaim\", \"showAllTrumpsClaimUI\", \"leaveTableAfterConfirmation043\", \"leaveTableToLobby043\", \"onWaitSeatClick\"])\n    native[name] = window[name];\n  const credentialKey = \"ghr-private-cloud-seat-v1\";\n  const playerIdKey = \"ghr-private-cloud-player-v1\";\n  let credentials = null;\n  let latest = null;\n  let lastRevision = -1;\n  let timer = null;\n  let socket = null;\n  let socketReconnectTimer = null;\n  let socketRetryCount = 0;\n  let busy = false;\n  let queuedAction = null;\n  let presented = null;\n  let lastScoreSignature = \"\";\n  let redealRevision = -1;\n  let cloudDealOwner=null, cloudDealTimer=null;\n  let cloudAudio = null;\n\n  const status = (message) => {\n    const lobby = document.getElementById(\"lobby\");\n    const el = lobby && !lobby.classList.contains(\"hidden\")\n      ? document.getElementById(\"lobbyStatus\")\n      : (document.getElementById(\"messageArea\") || document.getElementById(\"lobbyStatus\"));\n    if (el) el.textContent = message;\n  };\n  const showBotFillStatus = (message, button) => {\n    if (button) button.title = message;\n    status(message);\n  };\n  const ownId = () => {\n    let id = localStorage.getItem(playerIdKey);\n    if (!id) {\n      id = crypto.randomUUID();\n      localStorage.setItem(playerIdKey, id);\n    }\n    return id;\n  };\n  const api = async (path, { method = \"GET\", body, token = credentials?.token } = {}) => {\n    const headers = {};\n    if (token) headers.Authorization = \"Bearer \" + token;\n    if (body !== undefined) headers[\"Content-Type\"] = \"application/json\";\n    // The legacy game assets need a GitHub Pages <base>, but API routes belong\n    // to the private Worker. Resolve them explicitly against the current origin.\n    const response = await fetch(new URL(path, window.location.origin), {\n      method,\n      headers,\n      body: body === undefined ? undefined : JSON.stringify(body),\n      cache: \"no-store\",\n    });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) { if (data.error === \"ROOM_CLOSED\" && credentials) finishClosedTable(); throw new Error(data.error || (\"HTTP_\" + response.status)); }\n    return data;\n  };\n  const roomPath = (action = \"\") => \"/rooms/\" + encodeURIComponent(credentials.roomCode) + (action ? \"/\" + action : \"\");\n  const playerIdForSeat = (seat) => \"cloud-seat-\" + seat;\n\n  function credentialsFrom(result, playerId) {\n    sessionStorage.removeItem(\"ghr-cloud-disconnected\");\n    presented = null;\n    window._horCloudWinnerShown = false;\n    window._cloudKittyHand = null;\n    credentials = {\n      roomCode: result.roomCode || result.roomId,\n      seat: Number(result.seat),\n      serverRoomId: result.roomId || null,\n      token: result.token,\n      playerId,\n    };\n    localStorage.setItem(credentialKey, JSON.stringify(credentials));\n    roomCode = credentials.roomCode;\n    myIndex = credentials.seat;\n    myPeerId = playerIdForSeat(credentials.seat);\n    myName = (document.getElementById(\"hor-player-name\")?.value || \"Player\").trim() || \"Player\";\n    isSpectator = false;\n  }\n\n  function mapPlayers(snap) {\n    return Array.from({ length: 4 }, (_, seat) => {\n      const p = snap.players?.find((entry) => entry && Number(entry.seat) === seat);\n      if (!p || p.occupied === false) return null;\n      return {\n        id: playerIdForSeat(seat),\n        name: p.name || p.displayName || (\"Player \" + (seat + 1)),\n        seat,\n        team: Number.isInteger(p.team) ? p.team : seat % 2,\n        isHost: seat === 0,\n        isBot: p.isBot === true,\n        bank: 0,\n        avatar: p.avatar || [\"cinder\", \"dagger\", \"crow\", \"blaze\"][seat],\n        voice: p.voice || \"avatar\",\n      };\n    });\n  }\n\n  function paintCloudPace(pace) {\n    const n=[1,3,99].includes(Number(pace))?Number(pace):1;\n    horGamePace=n;document.body.dataset.gamePace=n===99?\"max\":String(n);document.body.style.setProperty(\"--hor-pace-factor\",String(1/(n===99?20:n)));horPaintGamePace();\n    document.querySelectorAll('#scoreSpeed701 [data-score-pace]').forEach(button=>{button.disabled=!!credentials&&credentials.seat!==0;button.title=button.disabled?\"The host controls table speed\":\"\";});\n  }\n  let paceSending=false,pendingCloudPace=null;\n  async function requestCloudPace(value) {\n    if(!credentials||credentials.seat!==0)return;\n    pendingCloudPace=Number(value);if(paceSending)return;paceSending=true;const owner=credentials;\n    try{while(pendingCloudPace!==null&&credentials===owner){const pace=pendingCloudPace;pendingCloudPace=null;const snap=await api(roomPath(\"pace\"),{method:\"POST\",body:{pace}});if(credentials!==owner)return;receiveSnapshot(snap);localStorage.setItem(\"horGamePace\",String(snap.pace));}}\n    catch(error){pendingCloudPace=null;status(\"Could not change table speed: \"+error.message);await refresh();}finally{paceSending=false;}\n  }\n  const nativePace=window.horSetGamePace;\n  window.horSetGamePace=window.__ghSetGamePace630=function(value){return credentials?requestCloudPace(value):nativePace(value);};\n  window.addEventListener(\"click\",event=>{const button=event.target.closest?.('#scoreSpeed701 [data-score-pace]');if(!button||!credentials)return;event.preventDefault();event.stopImmediatePropagation();if(credentials.seat===0)requestCloudPace(button.dataset.scorePace);},true);\n  const endEffects=window.HOREndHandEffectsV12;\n  if(endEffects){const play=endEffects.play;endEffects.play=function(...args){const result=play.apply(this,args);document.querySelector('#endHandEffectsV12 .end-hand-v12-skip')?.remove();return result;};}\n\n  function enterWaiting(snap) {\n    paintCloudPace(snap.pace);\n    latest = snap;\n    const tablePlayers = mapPlayers(snap);\n    players = tablePlayers.filter(Boolean);\n    game = {\n      phase: \"waiting\",\n      players: tablePlayers,\n      scores: [0, 0],\n      hands: [[], [], [], []],\n      myHand: [],\n      handNumber: 0,\n      targetScore: 500,\n    };\n    isHost = credentials.seat === 0;\n    myIndex = credentials.seat;\n    myPeerId = playerIdForSeat(credentials.seat);\n    window._horStayInGame = false;\n    try { horMarkActiveTable(false); } catch (_) {}\n    try { showWaiting(); } catch (_) {\n      document.getElementById(\"lobby\")?.classList.add(\"hidden\");\n      document.getElementById(\"waiting\")?.classList.remove(\"hidden\");\n    }\n    const hostOptions = document.getElementById(\"hostOptions\");\n    const hostOptionsButton = document.getElementById(\"openHostOptionsBtn\");\n    if (hostOptions) hostOptions.classList.add(\"hidden\");\n    if (hostOptionsButton) hostOptionsButton.classList.add(\"hidden\");\n    const code = document.getElementById(\"displayCode\");\n    if (code) code.textContent = credentials.roomCode;\n    try { updateWaitingUI(); } catch (_) {}\n    const leaveControl=document.getElementById(\"leaveBtn\"); if(leaveControl) leaveControl.textContent=credentials.seat===0 ? \"Close table\" : \"Leave table\";\n    const start = document.getElementById(\"startBtn\");\n    if (start && credentials.seat === 0) {\n      start.classList.remove(\"hidden\");\n      start.disabled = snap.occupiedSeats?.length !== 4;\n      start.textContent = \"Start Game\";\n    }\n  }\n\n  // A restored cloud hand skips the native deal, which normally primes impacts.\n  // Retry on trusted interaction too; a network failure must not silence the hand.\n  function warmCloudAudio() {\n    if (!credentials) return;\n    try { preloadCardLandingSounds058().catch(() => {}); } catch (_) {}\n  }\n  document.addEventListener(\"pointerdown\", warmCloudAudio, { passive: true });\n\n  function presentCloudCardAudio(snap) {\n    const cards = (snap.trick || []).filter(entry => entry?.card?.id);\n    if (!cloudAudio || cloudAudio.owner !== credentials || cloudAudio.hand !== snap.handNumber) {\n      cloudAudio = { owner: credentials, hand: snap.handNumber, seen: new Set(cards.map(entry => entry.card.id)) };\n      warmCloudAudio();\n      return; // Reconnect/new-hand snapshots describe history, not fresh plays.\n    }\n    const fresh = cards.filter(entry => !cloudAudio.seen.has(entry.card.id));\n    for (const entry of cards) cloudAudio.seen.add(entry.card.id);\n    if (snap.phase === \"play\" && fresh.length) {\n      // A catch-up snapshot can contain several cards: sound the latest only.\n      // The native dispatcher retains mute, effects levels and bird-sound rules.\n      try { notifyCardPlayed(fresh[fresh.length - 1].card); } catch (_) {}\n    }\n  }\n\n  function gameSnapshot(snap) {\n    paintCloudPace(snap.pace);\n    if(cloudDealOwner && cloudDealOwner.credentials===credentials && cloudDealOwner.hand===snap.handNumber && (!snap.opening?.id||cloudDealOwner.id===snap.opening.id) && !cloudDealOwner.done) return;\n    const restoringCloudView=!presented;\n    const beginDeal=snap.phase===\"dealing\" && (!cloudDealOwner || cloudDealOwner.credentials!==credentials || cloudDealOwner.hand!==snap.handNumber || !!snap.opening?.id && cloudDealOwner.id!==snap.opening.id);\n\n    if (![\"score\", \"complete\"].includes(snap.phase)) {\n      document.getElementById(\"scoreModal\")?.classList.add(\"hidden\");\n      document.body.classList.remove(\"remaining-open\");\n    }\n    if (typeof snap.shootMoonEnabled === \"boolean\") shootMoonEnabled = snap.shootMoonEnabled;\n    if (snap.rules) {\n      includeRed2 = !!snap.rules.includeRed2;\n      includeOnes = !!snap.rules.includeOnes;\n      includeRook = !!snap.rules.includeRook;\n      includeRed1 = !!snap.rules.includeRed1;\n      onesHigh = !!snap.rules.onesHigh;\n      rookLowest = !!snap.rules.rookLowest;\n      specialsAnytime = !!snap.rules.specialsAnytime;\n      mustTrumpWhenVoid = !!snap.rules.mustTrumpWhenVoid;\n    }\n    const tablePlayers = mapPlayers(snap);\n    const hand = Array.isArray(snap.hand) ? snap.hand.map((card) => ({ ...card })) : [];\n    const viewPhase = snap.phase === \"complete\" ? \"score\" : snap.phase === \"dealing\" ? \"dealing\" : snap.phase;\n    const hands = [[], [], [], []];\n    hands[credentials.seat] = hand.map((card) => ({ ...card }));\n    players = tablePlayers;\n    myIndex = credentials.seat;\n    myPeerId = playerIdForSeat(credentials.seat);\n    // Host permissions belong to the server credential, not the legacy\n    // browser referee. All dealt cloud views use the native client UI path.\n    isHost = false;\n    const view = {\n      phase: viewPhase,\n      cloudRevision: snap.revision,\n      scores: snap.scores || [0, 0],\n      sandbagOverpoints: [0, 0],\n      bid: snap.bid || 0,\n      highestBid: snap.highestBid,\n      shotTheMoon: !!snap.shotTheMoon,\n      trumpVoiceEvent790: snap.trump ? \"cloud-trump:\" + credentials.roomCode + \":\" + snap.handNumber + \":\" + snap.bidder + \":\" + snap.trump : null,\n      trumpVoiceRestore790: !presented,\n      trumpPresentation833: !!snap.trumpOpening,\n      trumpPresentationMs833: snap.trumpPresentationMs || 1950,\n      minBid: 100,\n      passCount: snap.passCount || 0,\n      bidder: snap.bidder,\n      trump: snap.trump,\n      currentPlayer: snap.currentPlayer,\n      trick: (snap.trick || []).map((entry) => ({ player: entry.player, card: { ...entry.card } })),\n      ledColor: snap.ledColor,\n      players: tablePlayers,\n      dealer: snap.dealer,\n      handsCount: snap.handCounts || [0, 0, 0, 0],\n      targetScore: snap.targetScore || 500,\n      lastTrickWinner: snap.lastTrickWinner,\n      trumpPresentation833: !!snap.trumpOpening,\n      trumpPresentationMs833: snap.trumpPresentationMs || 1950,\n      resolvingTrick: !!snap.resolvingTrick,\n      paused: false,\n      bidStatus: snap.bidStatus || [null, null, null, null],\n      discardCount: snap.discardCount || 0,\n      nestAuctionOpen: snap.phase === \"bidding\",\n      revealTopNest: snap.revealTopNest !== false,\n      nestFlipped: snap.phase === \"bidding\",\n      topNestCard: snap.topNestCard || null,\n      nestFlipStage: 0,\n      widowSpread: snap.widowSpread || [],\n      handPoints: snap.handPoints || [0, 0],\n      recentTricks: snap.recentTricks || [],\n      trumpClaimPlayer: snap.canClaimRemaining ? credentials.seat : null,\n      claimDeclined: !!snap.claimDeclined,\n      claimAnimation: snap.claimAnimation||null,\n      claimAnimating: !!snap.claimAnimation,\n      resolvingTrickPoints: Number(snap.resolvingTrickPoints)||0,\n    };\n    const current = game || {};\n    Object.assign(current, {\n      phase: viewPhase,\n      cloudRevision: snap.revision,\n      scores: view.scores,\n      sandbagOverpoints: view.sandbagOverpoints,\n      bid: view.bid,\n      highestBid: view.highestBid,\n      shotTheMoon: view.shotTheMoon,\n      passCount: view.passCount,\n      bidder: view.bidder,\n      trump: view.trump,\n      currentPlayer: view.currentPlayer,\n      trick: view.trick,\n      ledColor: view.ledColor,\n      players: tablePlayers,\n      dealer: view.dealer,\n      handsCount: view.handsCount,\n      handNumber: snap.handNumber,\n      targetScore: view.targetScore,\n      lastTrickWinner: view.lastTrickWinner,\n      trumpPresentation833: !!snap.trumpOpening,\n      trumpPresentationMs833: snap.trumpPresentationMs || 1950,\n      resolvingTrick: !!snap.resolvingTrick,\n      paused: false,\n      bidStatus: view.bidStatus,\n      discardCount: view.discardCount,\n      nestAuctionOpen: snap.phase === \"bidding\",\n      nestFlipped: snap.phase === \"bidding\",\n      topNestCard: view.topNestCard,\n      widowSpread: view.widowSpread,\n      handPoints: view.handPoints,\n      trumpClaimPlayer: view.trumpClaimPlayer,\n      claimDeclined: view.claimDeclined,\n      claimAnimation: snap.claimAnimation||null,\n      claimAnimating: !!snap.claimAnimation,\n      resolvingTrickPoints: Number(snap.resolvingTrickPoints)||0,\n      hands,\n      myHand: hand,\n      nest: Array.from({ length: Number(snap.nestCount) || 0 }, () => null),\n      nestPreview: Array.isArray(snap.nestPreview) ? snap.nestPreview : [],\n      kittyTaken: Array.isArray(snap.nestPreview) ? snap.nestPreview : [],\n      nestCards: Array.isArray(snap.nestCards) ? snap.nestCards : [],\n      nestRevealCards: Array.isArray(snap.nestCards) ? snap.nestCards : [],\n      lastSummary: snap.lastSummary || null,\n      matchResult: snap.matchResult || null,\n    });\n    if(beginDeal) current.myHand=[];\n    game = current;\n    if (snap.phase === \"discard\" && snap.bidder === credentials.seat &&\n        window._cloudKittyHand !== snap.handNumber) {\n      window._cloudKittyHand = snap.handNumber;\n      window._discardFlowKey = typeof discardFlowIdentity === \"function\" ? discardFlowIdentity(hand, snap.bidder) : \"\";\n      window._discardPage = \"kitty\";\n      window.selectedForDiscard = new Set();\n      window._discardSubmitting = false;\n      window._discardStartReceived = false;\n      window._discardKittyShown = false;\n    }\n    try { applyState(view); if (snap.phase !== \"discard\") renderHand(false); } catch (error) { status(\"Could not draw the current table: \" + error.message); }\n\n    if(![\"bidding\",\"discard\",\"trump\"].includes(snap.phase)) {\n      try {setBotThinking(snap.phase===\"play\"&&!snap.resolvingTrick&&!snap.trumpOpening&&!!tablePlayers[snap.currentPlayer]?.isBot);} catch(_){}\n    }\n\n    if(beginDeal) {\n      const owner={credentials,hand:snap.handNumber,id:snap.opening?.id,done:false};cloudDealOwner=owner;\n      status(\"Preparing the table\u2026\");\n      cloudDealTimer=setTimeout(()=>{\n        if(credentials!==owner.credentials || cloudDealOwner!==owner)return;\n        runDealPresentation(hand,()=>{\n          if(credentials!==owner.credentials || cloudDealOwner!==owner)return;\n          owner.done=true;acknowledgeDeal(owner);\n        });\n      },solScaledDelay(1500,150));\n    }\n\n    presentCloudCardAudio(snap);\n\n    // Presentation observes confirmed public changes; reconnect snapshots are quiet.\n    if (presented?.hand === snap.handNumber) {\n      for (let seat = 0; seat < 4; seat++) {\n        const value = snap.bidStatus?.[seat];\n        if (value == null || value === presented.bids?.[seat]) continue;\n        const moon = !!snap.shotTheMoon && seat === snap.bidder;\n        const action = value === \"pass\" ? \"pass\" : moon ? \"shootMoon\" : \"bid\";\n        window.HORBidVoice801?.receive({event:{id:\"cloud-bid:\" + credentials.roomCode + \":\" + snap.handNumber + \":\" + snap.revision + \":\" + seat,player:seat,action,amount:Number(value)||0,clip:moon?\"moon-\"+(snap.handNumber%2+1):undefined}});\n      }\n      if (snap.shotTheMoon && !presented.moon) window.HORMoonHowl?.play(\"cloud-moon:\" + credentials.roomCode + \":\" + snap.handNumber);\n      if (snap.phase === \"play\" && snap.trump && !presented.trump) window.HORTrumpVoice?.chosen(game, playerAvatars);\n    }\n    presented = {hand:snap.handNumber,bids:[...(snap.bidStatus||[])],trump:snap.trump,moon:!!snap.shotTheMoon};\n\n    if (snap.lastSummary) {\n      const signature = credentials.roomCode+\":\"+snap.handNumber+\":\"+JSON.stringify(snap.scores);\n      if (signature !== lastScoreSignature) {\n        lastScoreSignature = signature;\n        const nestCards = snap.nestCards || [];\n        const nestPts = nestCards.reduce((sum, card) => sum + (typeof cardPoints === \"function\" ? cardPoints(card) : 0), 0);\n        const nestWinnerName = snap.lastSummary.nestTeam != null && typeof teamLabel === \"function\"\n          ? teamLabel(snap.lastSummary.nestTeam)\n          : \"Winning team\";\n        const summary={...snap.lastSummary,nestCards,nestPts,nestWinnerName,careerEvent:{matchId:\"cloud:\"+credentials.roomCode,hand:snap.handNumber}};\n        try { if(restoringCloudView||typeof presentCompletedHandV12!==\"function\")showScoreModal(summary);else presentCompletedHandV12(summary); } catch(_){showScoreModal(summary);}\n\n      }\n    }\n    if (snap.phase === \"redeal\" && credentials.seat === 0 && redealRevision !== snap.revision) {\n      redealRevision = snap.revision;\n      setTimeout(() => sendAction(\"redeal\", {}), 0);\n    }\n  }\n\n  async function acknowledgeDeal(owner) {\n    if(credentials!==owner.credentials || cloudDealOwner!==owner)return;\n    try {\n      const snap=await api(roomPath(\"ready\"),{method:\"POST\",body:{handNumber:owner.hand,openingId:owner.id}});\n      if(credentials!==owner.credentials || cloudDealOwner!==owner)return;\n      if(!latest || snap.revision>=latest.revision) {latest=snap;lastRevision=snap.revision;}\n      gameSnapshot(latest);\n      if(latest.phase===\"dealing\")cloudDealTimer=setTimeout(()=>acknowledgeDeal(owner),Math.max(250,Math.min(1000,latest.opening?.minimumRemainingMs||500)));\n    } catch(error) {\n      if(credentials===owner.credentials && cloudDealOwner===owner && latest?.handNumber===owner.hand) cloudDealTimer=setTimeout(()=>acknowledgeDeal(owner),1000);\n    }\n  }\n\n  function wireCloudScoreButton(isFinal) {\n    const next = document.getElementById(\"scoreModalNext\") || document.querySelector(\"#scoreModal [data-action='next']\") || document.querySelector(\"#scoreModal button:last-of-type\");\n    if (!next) return;\n    next.textContent = isFinal ? \"OK\" : credentials.seat === 0 ? \"Next Hand\" : \"Waiting for host\";\n    next.disabled = !isFinal && credentials.seat !== 0;\n    next.onclick = (event) => {\n      event.preventDefault();\n      document.getElementById(\"scoreModal\")?.classList.add(\"hidden\");\n      if (!isFinal) sendAction(\"next-hand\", {});\n    };\n  }\n\n  async function refresh() {\n    if (!credentials || busy) return;\n    try {\n      const snap = await api(roomPath(\"snapshot\"));\n      receiveSnapshot(snap);\n    } catch (error) {\n      status(\"Connection issue. Reconnecting\\u2026 (\" + error.message + \")\");\n    }\n  }\n\n  function receiveSnapshot(snap) {\n    if (!credentials || !snap || (credentials.serverRoomId && snap.roomId !== credentials.serverRoomId) || !Number.isInteger(snap.revision) || snap.revision < lastRevision) return;\n    if (!credentials.serverRoomId) { credentials.serverRoomId = snap.roomId; localStorage.setItem(credentialKey, JSON.stringify(credentials)); }\n    latest = snap;\n    if (snap.revision !== lastRevision || lastRevision < 0) {\n      lastRevision = snap.revision;\n      if (snap.phase === \"waiting\") enterWaiting(snap);\n      else gameSnapshot(snap);\n    }\n  }\n\n  function setFallbackPolling(enabled) {\n    clearInterval(timer);\n    timer = enabled ? setInterval(refresh, 15000) : null;\n  }\n\n  function scheduleSocketReconnect() {\n    if (socketReconnectTimer || !credentials) return;\n    setFallbackPolling(true);\n    const delay = Math.min(30000, 1000 * (2 ** Math.min(socketRetryCount++, 5)));\n    socketReconnectTimer = setTimeout(() => {\n      socketReconnectTimer = null;\n      connectSocket();\n    }, delay);\n  }\n\n  async function connectSocket() {\n    if (!credentials || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;\n    const owner = credentials;\n    try {\n      const issued = await api(roomPath(\"ws-ticket\"), { method: \"POST\", body: {} });\n      if (credentials !== owner) return;\n      const endpoint = new URL(roomPath(\"ws\"), window.location.origin);\n      endpoint.protocol = endpoint.protocol === \"https:\" ? \"wss:\" : \"ws:\";\n      endpoint.searchParams.set(\"ticket\", issued.ticket);\n      const next = new WebSocket(endpoint.toString());\n      socket = next;\n      next.onopen = () => {\n        socketRetryCount = 0;\n        setFallbackPolling(false);\n      };\n      next.onmessage = (event) => {\n        if (credentials !== owner) return;\n        try {\n          const message = JSON.parse(event.data);\n          if (message.type === \"room-closed\") { finishClosedTable(); return; }\n          if (message.type === \"snapshot\") receiveSnapshot(message.snapshot);\n        } catch (_) {}\n      };\n      next.onerror = () => {};\n      next.onclose = () => {\n        if (socket === next) {\n          socket = null;\n          scheduleSocketReconnect();\n        }\n      };\n    } catch (_) {\n      scheduleSocketReconnect();\n    }\n  }\n\n  function startRealtime() {\n    clearInterval(timer);\n    clearTimeout(socketReconnectTimer);\n    socketReconnectTimer = null;\n    try { socket?.close(); } catch (_) {}\n    socket = null;\n    socketRetryCount = 0;\n    lastRevision = -1;\n    refresh();\n    setFallbackPolling(true);\n    connectSocket();\n  }\n\n  async function joinByCode() {\n    const input = document.getElementById(\"hor-room-code\");\n    const name = (document.getElementById(\"hor-player-name\")?.value || \"\").trim();\n    const code = (input?.value || \"\").trim().toUpperCase();\n    if (!name || !code) throw new Error(\"Enter your name and the room code.\");\n    const playerId = ownId();\n    let saved = null;\n    try { saved = JSON.parse(localStorage.getItem(credentialKey) || \"null\"); } catch (_) {}\n    const resumeToken = saved?.roomCode === code && saved?.playerId === playerId ? saved.token : null;\n    const result = await api(\"/rooms/\" + encodeURIComponent(code) + \"/join\", {\n      method: \"POST\",\n      body: { playerId, displayName: name, resumeToken, avatar: ensurePreferredAvatar(), voice: loadPreferredVoice() },\n      token: null,\n    });\n    credentialsFrom({ ...result, roomCode: code }, playerId);\n    startRealtime();\n  }\n\n  async function createCloudRoom() {\n    const name = (document.getElementById(\"hor-player-name\")?.value || \"\").trim();\n    if (!name) throw new Error(\"Enter your name first.\");\n    const playerId = ownId();\n    const result = await api(\"/rooms\", {\n      method: \"POST\",\n      body: { playerId, displayName: name, avatar: ensurePreferredAvatar(), voice: loadPreferredVoice(), pace:horGamePace },\n      token: null,\n    });\n    credentialsFrom(result, playerId);\n    startRealtime();\n  }\n\n  async function sendAction(route, data) {\n    if (!credentials || !latest) return;\n    if(latest.resolvingTrick || latest.trumpOpening || latest.phase===\"dealing\" || (cloudDealOwner && cloudDealOwner.credentials===credentials && !cloudDealOwner.done))return;\n    if (busy) {\n      // A pushed next turn may arrive before the previous HTTP refresh finishes.\n      // Keep one intention only for that exact authoritative room/hand/revision.\n      queuedAction = {route, data, owner: credentials, revision: latest.revision, hand: latest.handNumber};\n      return;\n    }\n    busy = true;\n    const body = {\n      actionId: crypto.randomUUID(),\n      expectedRevision: latest.revision,\n      ...data,\n    };\n    try {\n      await api(roomPath(route), { method: \"POST\", body });\n      await refreshAfterAction();\n    } catch (error) {\n      status(\"Move not accepted: \" + error.message);\n      await refreshAfterAction();\n    } finally {\n      busy = false;\n      const next = queuedAction;\n      queuedAction = null;\n      if (next && next.owner === credentials && next.revision === latest?.revision && next.hand === latest?.handNumber)\n        queueMicrotask(() => sendAction(next.route, next.data));\n    }\n  }\n\n  async function refreshAfterAction() {\n    if (!credentials) return;\n    try { receiveSnapshot(await api(roomPath(\"snapshot\"))); } catch (_) {}\n  }\n\n  async function startCloudGame() {\n    if (!credentials || credentials.seat !== 0) return;\n    try {\n      await api(roomPath(\"start\"), { method: \"POST\", body: {options: {targetScore: normalizeTargetScore(targetScore), includeRed2, revealTopNest, shootMoonEnabled}}, token: credentials.token });\n      await refreshAfterAction();\n    } catch (error) { status(\"Could not start the table: \" + error.message); }\n  }\n\n  async function reconnectCloudRoom() {\n    if (sessionStorage.getItem(\"ghr-cloud-disconnected\") === \"1\") return false;\n    let saved = null;\n    try { saved = JSON.parse(localStorage.getItem(credentialKey) || \"null\"); } catch (_) { return false; }\n    if (!saved || !saved.roomCode || !saved.token) return false;\n    credentials = saved;\n    roomCode = saved.roomCode;\n    myIndex = saved.seat;\n    myPeerId = playerIdForSeat(saved.seat);\n    myName = (document.getElementById(\"hor-player-name\")?.value || \"Player\").trim() || \"Player\";\n    try {\n      const snap = await api(roomPath(\"snapshot\"));\n      latest = snap;\n      if (snap.phase === \"waiting\") enterWaiting(snap);\n      else gameSnapshot(snap);\n      startRealtime();\n      return true;\n    } catch (error) {\n      if ([\"ROOM_NOT_FOUND\", \"UNAUTHORIZED\"].includes(error.message)) {\n        localStorage.removeItem(credentialKey);\n        credentials = null;paintCloudPace(Number(localStorage.getItem(\"horGamePace\"))||1);\n        return false;\n      }\n      status(\"Connection interrupted. Your seat is saved; retrying.\");\n      startRealtime();\n      return true;\n    }\n  }\n\n  function disconnectCloudRoom() {\n    // Disconnect is reversible: keep the server seat and its reconnect credential.\n    sessionStorage.setItem(\"ghr-cloud-disconnected\", \"1\");\n    credentials = null;paintCloudPace(Number(localStorage.getItem(\"horGamePace\"))||1);\n    clearTimeout(cloudDealTimer);cloudDealOwner=null;\n    clearInterval(timer);\n    clearTimeout(socketReconnectTimer);\n    socketReconnectTimer = null;\n    const previous = socket;\n    socket = null;\n    try { previous?.close(); } catch (_) {}\n    location.reload();\n  }\n  function finishClosedTable() {\n    if (!credentials) return;\n    credentials=null;paintCloudPace(Number(localStorage.getItem(\"horGamePace\"))||1); latest=null; queuedAction=null;\n    clearTimeout(cloudDealTimer);cloudDealOwner=null;\n    localStorage.removeItem(credentialKey);\n    sessionStorage.removeItem(\"ghr-cloud-disconnected\");\n    clearInterval(timer);clearTimeout(socketReconnectTimer);socketReconnectTimer=null;\n    const previous=socket;socket=null;try{previous?.close();}catch(_){}\n    alert(\"The host closed this table. You can create or join another table.\");\n    location.replace(location.origin+\"/\");\n  }\n  async function closeCloudTable() {\n    if (!credentials || credentials.seat!==0) return;\n    if (!confirm(\"Close this table for everyone? The current game will end and this table code cannot be reused.\")) return;\n    try { await api(roomPath(\"close\"),{method:\"POST\",body:{}}); finishClosedTable(); }\n    catch(error) { status(\"Could not close table: \"+error.message); }\n  }\n  window.clientLeaveReplace = () => {\n    if (!credentials) return native.clientLeaveReplace?.();\n    if (credentials.seat===0) {closeCloudTable();return;}\n    if (confirm(\"Leave this screen? Your seat stays reserved so you can rejoin. No bot will replace you.\")) disconnectCloudRoom();\n  };\n  window.leaveTableAfterConfirmation043 = (...args) => !credentials ? native.leaveTableAfterConfirmation043?.(...args) : credentials.seat===0 ? closeCloudTable() : disconnectCloudRoom();\n  window.leaveTableToLobby043 = (...args) => !credentials ? native.leaveTableToLobby043?.(...args) : credentials.seat===0 ? closeCloudTable() : disconnectCloudRoom();\n  // Spectator mode is unsupported by the private room server.\n  for (const id of [\"spectateBtn\", \"welcomeWatchBtn\"]) {\n    const button = document.getElementById(id);\n    if (button) { button.disabled = true; button.title = \"Watch-only unavailable in cloud test\"; }\n  }\n  // Existing listener registrations may still hold the legacy leave callback.\n  document.addEventListener(\"click\", event => {\n    const button = event.target.closest?.(\"#leaveBtn,#leaveReplaceBtn,#rejoinBtn,#reconnectBtn,#friendsToggleBtn,#createBtn,#joinConfirmBtn,#fillSeatsBtn,#startBtn,#spectateBtn,#welcomeWatchBtn,#shareBtn,#showQrBtn\");\n    if (!button) return;\n    if ([\"shareBtn\", \"showQrBtn\"].includes(button.id)) return;\n    event.preventDefault();\n    event.stopImmediatePropagation();\n    if ([\"spectateBtn\", \"welcomeWatchBtn\"].includes(button.id)) {\n      status(\"Watch-only is unavailable in the private Cloudflare test.\");\n      return;\n    }\n    if ([\"shareBtn\", \"showQrBtn\"].includes(button.id)) {\n      status(\"Open this private Cloudflare page separately and enter room code \" + (credentials?.roomCode || \"\"));\n      return;\n    }\n    if ([\"friendsToggleBtn\", \"createBtn\"].includes(button.id)) {\n      createCloudRoom().catch(error => status(error.message));\n    } else if (button.id === \"joinConfirmBtn\") {\n      joinByCode().catch(error => status(error.message));\n    } else if (button.id === \"fillSeatsBtn\") {\n      if (credentials?.seat !== 0) { showBotFillStatus(\"This phone is not connected as the host. Rejoin the host seat, then try again.\", button); return; }\n      if (busy) { showBotFillStatus(\"The table is finishing another action. Wait a moment, then tap again.\", button); return; }\n      busy = true;\n      button.disabled = true;\n      showBotFillStatus(\"Adding test bots to the open seats\u2026\", button);\n      api(roomPath(\"fill-bots\"), { method: \"POST\", body: {} })\n        .then(snap => { receiveSnapshot(snap); showBotFillStatus(\"Bots added. The table is ready to start.\", button); })\n        .catch(error => showBotFillStatus(\"Could not add bots: \" + error.message, button))\n        .finally(() => { busy = false; button.disabled = false; });\n    } else if (button.id === \"startBtn\") {\n      startCloudGame();\n    } else if ([\"rejoinBtn\", \"reconnectBtn\"].includes(button.id)) {\n      sessionStorage.removeItem(\"ghr-cloud-disconnected\");\n      reconnectCloudRoom();\n    } else window.clientLeaveReplace();\n  }, true);\n  let cloudSeat = null;\n  try { cloudSeat = JSON.parse(localStorage.getItem(credentialKey) || \"null\"); } catch (_) {}\n  document.getElementById(\"reconnectBox\")?.classList.toggle(\"hidden\", !cloudSeat?.token || !cloudSeat?.roomCode);\n  if (cloudSeat?.token && cloudSeat?.roomCode) {\n    const codeEl = document.getElementById(\"reconnectCode\");\n    if (codeEl) codeEl.textContent = cloudSeat.roomCode;\n    const resume = document.getElementById(\"reconnectBtn\");\n    if (resume) { resume.classList.remove(\"hidden\"); resume.textContent = \"Rejoin your reserved seat\"; }\n  }\n  window.saveSession = (...args) => credentials ? undefined : native.saveSession?.(...args);\n  window.createRoom = function () { return createCloudRoom().catch((error) => status(error.message)); };\n  window.joinRoom = function () { return joinByCode().catch((error) => status(error.message)); };\n  window.startGameWithToast = function (...args) { return credentials ? startCloudGame() : native.startGameWithToast?.(...args); };\n  window.submitBid = function (value, opts) {\n    if (!credentials) return native.submitBid?.(value, opts);\n    if (Number(value) !== 0 && isShootMoonBid(Number(value)) && !opts?.moonConfirmed) return;\n    return sendAction(\"bid\", { value: Number(value) });\n  };\n  window.submitDiscard = function (cardIds) { if (!credentials) return native.submitDiscard?.(cardIds); return sendAction(\"discard\", { cardIds: [...cardIds] }); };\n  window.submitTrump = function (color) { if (!credentials) return native.submitTrump?.(color); return sendAction(\"trump\", { color }); };\n  window.submitPlay = function (cardId) {\n    if (!credentials) return native.submitPlay?.(cardId);\n    if (Date.now() < playLockUntil) return;\n    playLockUntil = Date.now() + 450;\n    return sendAction(\"play\", { cardId });\n  };\n  window.hostStartNextHand = function (...args) { return credentials ? sendAction(\"next-hand\", {}) : native.hostStartNextHand?.(...args); };\n  // Page the approved chooser with a horizontal finger gesture, preserving taps.\n  const botGrid=document.getElementById(\"botPickerGrid\");let botSwipe=null,botSwipeUntil=0,botPaging=false;\n  botGrid?.addEventListener(\"touchstart\",event=>{const t=event.touches;if(t.length===1)botSwipe={x:t[0].clientX,y:t[0].clientY};else botSwipe=null;},{passive:true});\n  botGrid?.addEventListener(\"touchend\",async event=>{const start=botSwipe;botSwipe=null;const t=event.changedTouches[0];if(!start||!t)return;const dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.5)return;const nav=document.querySelector(\"#botPickerModal .house-legacy-nav\"),buttons=nav?.querySelectorAll(\"button\"),button=buttons?.[dx<0?1:0];event.preventDefault();botSwipeUntil=Date.now()+600;if(!button||button.disabled||botPaging)return;botPaging=true;const direction=dx<0?-1:1;try{await botGrid.animate([{transform:\"translateX(0)\",opacity:1},{transform:`translateX(${direction*25}%)`,opacity:0}],{duration:120,easing:\"ease-in\",fill:\"none\"}).finished;button.click();await botGrid.animate([{transform:`translateX(${-direction*25}%)`,opacity:0},{transform:\"translateX(0)\",opacity:1}],{duration:180,easing:\"ease-out\",fill:\"none\"}).finished;}finally{botPaging=false;}},{passive:false});\n  botGrid?.addEventListener(\"touchcancel\",()=>{botSwipe=null;},{passive:true});\n  botGrid?.addEventListener(\"click\",event=>{if(Date.now()<botSwipeUntil){event.preventDefault();event.stopImmediatePropagation();}},true);\n  const nativeShowBidUI=window.showBidUI;\n  window.showBidUI=function(...args){\n    if(credentials&&(latest?.phase!==\"bidding\"||game?.phase!==\"bidding\"||cloudDealOwner?.credentials===credentials&&!cloudDealOwner.done||!document.getElementById(\"shuffleOverlay\")?.classList.contains(\"hidden\")&&document.getElementById(\"shuffleOverlay\")))return;\n    return nativeShowBidUI.apply(this,args);\n  };\n  const nativeCloudScore=window.showScoreModal;\n  window.showScoreModal=function(...args){const result=nativeCloudScore.apply(this,args);if(credentials)wireCloudScoreButton(!!latest?.matchResult);return result;};\n  const nativeBotPicker=window.openBotPicker;\n  async function cloudBotSeat(seat, name) {\n    if(busy||!credentials)return;\n    busy=true;\n    try {const snap=await api(roomPath(\"bot-seat\"),{method:\"POST\",body:{seat, name, expectedRevision:latest.revision}});receiveSnapshot(snap,credentials);closeBotPicker();}\n    catch(error){status(\"Could not change bot: \"+error.message);await refresh(true);}\n    finally{busy=false;}\n  }\n  window.openBotPicker=function(seat,replaceBot=false){\n    if(!credentials)return nativeBotPicker(seat,replaceBot);\n    if(credentials.seat!==0||latest?.phase!==\"waiting\")return;\n    nativeBotPicker(seat,replaceBot);\n    document.querySelectorAll(\"#botPickerGrid .bot-pick\").forEach(button=>{button.onclick=()=>cloudBotSeat(seat,button.getAttribute(\"data-bot\"));});\n    const remove=document.getElementById(\"botPickerRemove830\");if(remove)remove.onclick=()=>cloudBotSeat(seat,null);\n  };\n  window.onWaitSeatClick=function(seat){\n    if(!credentials)return native.onWaitSeatClick?.(seat);\n    if(credentials.seat!==0||latest?.phase!==\"waiting\")return;\n    const target=latest.players?.find(p=>p.seat===Number(seat));\n    if(target?.occupied&&!target.isBot)return;\n    window.openBotPicker(Number(seat),!!target?.isBot);\n  };\n  window.addEventListener(\"click\",event=>{\n    if(!credentials||credentials.seat!==0||latest?.phase!==\"waiting\"||matchMedia(\"(orientation: landscape)\").matches)return;\n    const button=event.target.closest?.('[id^=\"waitSeat\"]');if(!button||!/^waitSeat[1-3]$/.test(button.id))return;\n    const seat=Number(button.id.slice(-1)),target=latest.players?.find(p=>p.seat===seat);\n    if(target?.occupied&&!target.isBot)return;\n    event.preventDefault();event.stopImmediatePropagation();window.onWaitSeatClick(seat);\n  },true);\n  window.hostProcessAllTrumpsClaim = function (...args) { return credentials ? sendAction(\"claim-remaining\", {}) : native.hostProcessAllTrumpsClaim?.(...args); };\n  window.hostDeclineClaim = function (...args) { return credentials ? sendAction(\"decline-claim\", {}) : native.hostDeclineClaim?.(...args); };\n\n  // Replace the existing PeerJS-only claim buttons with the same approved copy,\n  // routed through the authoritative room service instead.\n  window.showAllTrumpsClaimUI = function (...args) {\n    if (!credentials) return native.showAllTrumpsClaimUI?.(...args);\n    if (!latest?.canClaimRemaining || latest.currentPlayer !== credentials?.seat) return;\n    const panel = document.getElementById(\"actionPanel\");\n    if (!panel) return;\n    const reason = latest.remainingClaimReason === \"trumps\"\n      ? \"controls every remaining winning card\"\n      : \"can take the rest of the tricks\";\n    panel.className = \"action-panel trump-claim-panel lt-floating-panel\";\n    panel.classList.remove(\"hidden\", \"bid-panel\");\n    panel.innerHTML = \"<span><strong>\" + String(myName).replace(/[&<>\"']/g, \"\") + \"</strong> \" + reason + \".</span>\"\n      + '<button type=\"button\" id=\"layDownClaimBtn\" class=\"btn primary\">Lay Down &amp; End Hand</button>'\n      + '<button type=\"button\" id=\"continueClaimBtn\" class=\"btn\">Continue Playing</button>';\n    document.getElementById(\"layDownClaimBtn\")?.addEventListener(\"click\", () => sendAction(\"claim-remaining\", {}));\n    document.getElementById(\"continueClaimBtn\")?.addEventListener(\"click\", () => sendAction(\"decline-claim\", {}));\n  };\n\n  // Keep ordinary offline play in this copy available when cloud=1 is absent.\n  // The cloud branch has no careers, local award writes, or PeerJS seats.\n  // Private-test bots are controlled only by the server room reducer.\n  try { window.horRecordCareerHand = (...args) => credentials ? ({ ok: true, skipped: \"private-cloud-test\" }) : native.horRecordCareerHand?.(...args); } catch (_) {}\n  try { window.mergeLifetimeStats = (...args) => credentials ? undefined : native.mergeLifetimeStats?.(...args); } catch (_) {}\n  try { window.noteHumanAuction = (...args) => credentials ? undefined : native.noteHumanAuction?.(...args); } catch (_) {}\n  try { window.noteHumanHandEnd = (...args) => credentials ? undefined : native.noteHumanHandEnd?.(...args); } catch (_) {}\n  // PeerJS liveness must never evict or replace a cloud seat.\n  clearInterval(horHeartbeatTimer);\n  window.horStartHeartbeat = (...args) => credentials ? undefined : native.horStartHeartbeat?.(...args);\n  window.horBeginClientReconnect = (...args) => credentials ? undefined : native.horBeginClientReconnect?.(...args);\n  window.HOR_CLOUD_TEST_ACTIVE = true;\n  window.HORCloudDiagnostics = () => ({busy, queued: !!queuedAction, revision:lastRevision, seat:credentials?.seat ?? null});\n  // The Durable Object controls test bots. Prevent the legacy browser bot\n  // loop from issuing a second move against the same visible game.\n  window.isBotTurn = (...args) => credentials ? false : native.isBotTurn?.(...args);\n  window.scheduleBot = (...args) => credentials ? undefined : native.scheduleBot?.(...args);\n  window.runBotAction = (...args) => credentials ? undefined : native.runBotAction?.(...args);\n  status(\"Private cloud room test ready.\");\n  const requestedName = String(window.GHR_CLOUD_NAME || \"\").trim().slice(0, 12);\n  const playerNameField = document.getElementById(\"hor-player-name\");\n  if (requestedName && playerNameField) playerNameField.value = requestedName;\n  async function launchCloudEntry() {\n    const invite = window.GHR_CLOUD_INVITE;\n    if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(invite || \"\")) {\n      const input = document.getElementById(\"hor-room-code\");\n      if (input) input.value = invite;\n      if ((playerNameField?.value || \"\").trim()) {\n        await joinByCode();\n      } else {\n        try { setLobbyJoining(true); } catch (_) {}\n        status(\"Invited to table \" + invite + \". Enter your name and take your seat.\");\n      }\n      return;\n    }\n    if (window.GHR_CLOUD_CREATE) {\n      if (!(playerNameField?.value || \"\").trim()) {\n        status(\"Enter your name first, then tap Play With Friends to create a table.\");\n        return;\n      }\n      await createCloudRoom();\n      return;\n    }\n    if (!await reconnectCloudRoom()) status(\"Online table ready. Create a room or join with a code.\");\n  }\n  launchCloudEntry().catch(error => status(\"Could not open online table: \" + error.message));\n})();\n\n";

// worker.mjs
var IDLE_ROOM_MS = 60 * 60 * 1e3;
var COMPLETED_ROOM_GRACE_MS = 5 * 60 * 1e3;
var PRIVATE_SESSION_COOKIE = "GHR-Online-v1";
var PRIVATE_SESSION_MS = 12 * 60 * 60 * 1e3;
var WS_TICKET_TTL_MS = 15e3;
var json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store, max-age=0", "pragma": "no-cache", "expires": "0", "vary": "Authorization, Cookie, X-Test-Gate, X-Test-Gate-UTF8" }
}), "json");
var fail = /* @__PURE__ */ __name((error) => {
  if(error?.message==="ROOM_CLOSED")return json({error:"ROOM_CLOSED"},410);
  const known = /* @__PURE__ */ new Set([
    "ROOM_EXISTS", "DEAL_IN_PROGRESS", "STALE_DEAL", "TRUMP_IN_PROGRESS", "TRICK_IN_PROGRESS", "CLAIM_IN_PROGRESS", "INVALID_PACE",
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
  const prelude = `<base href="/cloud-game/assets/"><script>(()=>{const q=new URLSearchParams(location.hash.slice(1)),p=new URLSearchParams(location.search);window.GHR_CLOUD_INVITE=q.get("room")||p.get("room")||"";window.GHR_CLOUD_CREATE=(q.get("create")||p.get("create"))==="1";window.GHR_CLOUD_NAME=(q.get("name")||p.get("name")||"").slice(0,12);history.replaceState(null,"",location.pathname+"?cloud=1")})();try{if(navigator.serviceWorker&&navigator.serviceWorker.register)navigator.serviceWorker.register=()=>Promise.resolve(null)}catch(_){}<\/script>`;
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
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`GHR-Online-v1|${payload}`));
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
        let status, opening;
        try {
          const view=await response.clone().json();status=view.status;opening=view.opening;
        } catch {
        }
        const savedRoom=await this.ctx.storage.get(this.roomKey);const pendingOpening=savedRoom?.status==="playing"?savedRoom.opening:null;const pendingBot=savedRoom?.status==="playing"&&savedRoom.gameState?savedRoom.botTurn:null;const pendingTrump=savedRoom?.status==="playing"?savedRoom.trumpOpening:null;const pendingTrick=savedRoom?.trickOpening;const pendingClaim=savedRoom?.claimOpening;const delay = pendingClaim?Math.max(1,pendingClaim.expiresAt-Date.now()):pendingTrick?Math.max(1,pendingTrick.expiresAt-Date.now()):pendingTrump?Math.max(1,pendingTrump.expiresAt-Date.now()):pendingOpening?Math.max(1,pendingOpening.expiresAt-Date.now()):pendingBot?Math.max(1,pendingBot.due-Date.now()):status === "complete" ? COMPLETED_ROOM_GRACE_MS : IDLE_ROOM_MS;
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
      } catch (error) {
        if(error?.message==="ROOM_CLOSED") { try{socket.send(JSON.stringify({type:"room-closed"}));socket.close(1000,"Table closed");}catch(_){}continue; }
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
      if(await this.ctx.storage.get("__audio_report_only")) {
        this.ctx.storage.sql.exec("DELETE FROM audio_reports WHERE updated <= ?",Date.now()-60*60*1000);
        const count=this.ctx.storage.sql.exec("SELECT COUNT(*) AS count FROM audio_reports").toArray()[0].count;
        if(count)await this.ctx.storage.setAlarm(Date.now()+60*60*1000);else await this.ctx.storage.deleteAlarm();
        return;
      }
      await this.service.cleanup(this.roomKey, { maxIdleMs: IDLE_ROOM_MS });
      let room = await this.ctx.storage.get(this.roomKey);
      if(room?.status==="playing"&&(room.opening||room.trumpOpening||room.trickOpening||room.claimOpening||room.botTurn)){await this.service.snapshot(this.roomKey,room.seats.find(p=>p&&!p.isBot).token);await this.#broadcastSnapshots();room=await this.ctx.storage.get(this.roomKey);}
      if (!room) {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      const due=room.status==="playing"?(room.claimOpening?.expiresAt||room.trickOpening?.expiresAt||room.opening?.expiresAt||room.trumpOpening?.expiresAt||room.botTurn?.due):null;await this.ctx.storage.setAlarm(due?Math.max(Date.now()+1,due):Math.max(Date.now()+6e4,room.lastActivityAt+IDLE_ROOM_MS));
    });
    this.serial = task.catch(() => {
    });
    return task;
  }
  async #dispatch(request) {
    const url = new URL(request.url);
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    try {
      if (request.method === "POST" && url.pathname === "/audio-report") {
        const report=sanitizeAudioReport(await request.json());
        if(!report)return json({error:"INVALID_REPORT"},400);
        this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS audio_reports(id TEXT PRIMARY KEY,updated INTEGER NOT NULL,payload TEXT NOT NULL)");
        this.ctx.storage.sql.exec("INSERT INTO audio_reports(id,updated,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,payload=excluded.payload",report.id,Date.now(),JSON.stringify(report));
        this.ctx.storage.sql.exec("DELETE FROM audio_reports WHERE id NOT IN (SELECT id FROM audio_reports ORDER BY updated DESC LIMIT 64)");
        await this.ctx.storage.put("__audio_report_only",true);
        return json({ok:true});
      }
      if (request.method === "POST" && url.pathname === "/create") {
        const body = await request.json();
        return json(await this.service.create(this.roomKey, body.playerId, body.displayName, body.avatar, body.voice,body.pace??1), 201);
      }
      if (request.method === "POST" && url.pathname === "/join") {
        const body = await request.json();
        return json(await this.service.join(this.roomKey, body.playerId, body.displayName, body.resumeToken, body.avatar, body.voice), 201);
      }
      if(request.method==="POST"&&url.pathname==="/bot-seat")return json(await this.service.setBotSeat(this.roomKey,token,await request.json()));
      if(request.method==="POST"&&url.pathname==="/ready"){const body=await request.json();return json(await this.service.readyForBidding(this.roomKey,token,body.handNumber,body.openingId));}
      if(request.method==="POST"&&url.pathname==="/pace")return json(await this.service.setPace(this.roomKey,token,(await request.json()).pace));
      if (request.method === "POST" && url.pathname === "/close") return json(await this.service.closeTable(this.roomKey,token));
      if (request.method === "POST" && url.pathname === "/fill-bots") {
        const body=await request.json();return json(await this.service.fillOpenSeatsWithBots(this.roomKey, token,body.seat));
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
    if (url.pathname === "/audio-check/report") return handleAudioReport(request,env);
    const isEntry = ["/", "/index.html", "/cloud-game/index.html", "/cloud-game/game"].includes(url.pathname);
    const isRoom = url.pathname === "/rooms" || url.pathname.startsWith("/rooms/");
    if (["/cloud-game/launch", "/four-player-check"].includes(url.pathname)) return new Response("Not found", {status:404});
    if (isRoom) {
      if (request.method !== "GET" && request.headers.get("origin") !== url.origin) return json({error:"SAME_ORIGIN_REQUIRED"},403);
      if (!await verifyPrivateSession(cookieValue(request, PRIVATE_SESSION_COOKIE), env.TEST_GATE_KEY)) return json({error:"SESSION_REQUIRED"},401);
      const bucket = url.pathname === "/rooms" || url.pathname.endsWith("/join") ? env.ENTRY_LIMIT : env.ACTION_LIMIT;
      if (!bucket) return json({error:"SERVER_CONFIGURATION_REQUIRED"},503);
      const {success} = await bucket.limit({key: (request.headers.get("CF-Connecting-IP") || "unknown") + ":" + (bucket === env.ENTRY_LIMIT ? url.pathname === "/rooms" ? "create" : "join" : "action")});
      if (!success) return new Response(JSON.stringify({error:"TOO_MANY_REQUESTS"}),{status:429,headers:{"content-type":"application/json","cache-control":"no-store","retry-after":"60"}});
    }
    if (isEntry && request.method === "GET") {
      let session = null;
      if (!await verifyPrivateSession(cookieValue(request, PRIVATE_SESSION_COOKIE),env.TEST_GATE_KEY)) {
        if (!env.ENTRY_LIMIT) return new Response("Temporarily unavailable",{status:503});
        const {success}=await env.ENTRY_LIMIT.limit({key:(request.headers.get("CF-Connecting-IP")||"unknown")+":session"});
        if (!success) return new Response("Please try again shortly.",{status:429,headers:{"retry-after":"60","cache-control":"no-store"}});
        session=await issuePrivateSession(env.TEST_GATE_KEY);
      }
      try {
        const upstream=await fetch("https://raw.githubusercontent.com/jeromeleegriffin/Test/90078a710948c7643caafb18986e34dc71ce7cee/index.html",{redirect:"follow",cf:{cacheEverything:true,cacheTtlByStatus:{"200-299":86400,"300-599":-1}}});
        if (!upstream.ok) return new Response("The game is temporarily unavailable. Please reload shortly.",{status:502,headers:{"cache-control":"no-store"}});
        const response=secureIntegratedGameHtml(injectAudioDiagnostics(injectCloudGameAdapter(await upstream.text()),url));
        if (session) response.headers.set("Set-Cookie",`${PRIVATE_SESSION_COOKIE}=${session.token}; Path=/; Max-Age=${Math.floor(PRIVATE_SESSION_MS/1000)}; HttpOnly; Secure; SameSite=Strict`);
        return response;
      } catch { return new Response("The game is temporarily unavailable. Please reload shortly.",{status:502,headers:{"cache-control":"no-store"}}); }
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
        const upstream = await fetch(`https://raw.githubusercontent.com/jeromeleegriffin/Test/90078a710948c7643caafb18986e34dc71ce7cee/${assetPath}`, {
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
        const upstream = await fetch("https://raw.githubusercontent.com/jeromeleegriffin/Test/90078a710948c7643caafb18986e34dc71ce7cee/index.html", { redirect: "follow", cf: {cacheEverything: true, cacheTtlByStatus: {"200-299":86400,"300-599":-1}} });
        if (!upstream.ok) return new Response("The private game copy is temporarily unavailable.", { status: 502 });
        const integrated = injectAudioDiagnostics(injectCloudGameAdapter(await upstream.text()),url);
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
    const match = url.pathname.match(/^\/rooms\/([23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8})(?:\/(join|snapshot|ws-ticket|ws|close|pace|ready|bot-seat|fill-bots|start-fixture|play-fixture|start|bid|discard|trump|play|claim-remaining|decline-claim|next-hand|redeal))?$/);
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
    if (!match) return new Response("Not found", {status:404});
    const [, code, action] = match;
    if (!action) return new Response("Not found", {status:404});
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



const AUDIO_DIAGNOSTIC_COLLECTOR = "/* Opt-in sound check. No cards, names, room IDs, credentials or device IDs. */\n(() => {\n  'use strict';\n  const id = '__GHR_AUDIO_REPORT_ID__';\n  if (!/^[a-f0-9]{32}$/.test(id)) return;\n  const samples = [];\n  let sequence = 0, lastSent = 0, sending = false, lastClock = null, lastAt = null;\n  let test = { requested: false, heard: null };\n  const panel = document.createElement('aside');\n  panel.style.cssText = 'position:fixed;top:4px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#18251f;color:#fff;border:1px solid #c9ad66;border-radius:8px;padding:7px;font:12px system-ui;max-width:95vw;text-align:center';\n  panel.innerHTML = '<span>Sound check active</span> <button type=\"button\" data-check=\"test\">Test sound</button> <button type=\"button\" data-check=\"yes\" hidden>I hear it</button> <button type=\"button\" data-check=\"no\" hidden>No sound</button><small style=\"display:block\">Only audio state and sound settings are reported.</small>';\n  document.body.appendChild(panel);\n  const label = panel.querySelector('span');\n  const read = fn => { try { return fn(); } catch (_) { return null; } };\n  function sample(reason) {\n    const at = performance.now();\n    const ctx = read(() => typeof audioCtx === 'undefined' ? null : audioCtx);\n    const clock = ctx ? ctx.currentTime : null;\n    const cabin = read(() => window.CabinAmbience041?.inspect());\n    const mixer = window.HORAudioMixer;\n    const voice = read(() => window.HORVoiceQueue?.inspect());\n    const trump = read(() => window.HORTrumpVoice?.getState());\n    const frame = {\n      sequence: ++sequence, reason, elapsedMs: Math.round(at),\n      build: read(() => window.HOR_BUILD), pageBuild: read(() => window.HOR_PAGE_BUILD),\n      scriptBuild: read(() => window.HOR_SCRIPT_BUILD), hidden: document.hidden,\n      inGame: document.body.classList.contains('in-game'),\n      phase: read(() => typeof game === 'undefined' ? null : game?.phase),\n      muted: read(() => typeof soundMuted === 'undefined' ? null : soundMuted),\n      storedMuted: read(() => localStorage.getItem('rookMuted') === '1'),\n      soundOptions: { cards: read(() => soundCard), turn: read(() => soundTurn), ticks: read(() => soundTick) },\n      main: ctx ? { state: ctx.state, clock, sampleRate: ctx.sampleRate,\n        clockDelta: lastClock === null ? null : +(clock - lastClock).toFixed(4),\n        wallDeltaMs: lastAt === null ? null : Math.round(at - lastAt) } : null,\n      mixer: mixer ? { master: mixer.level('master'), voices: mixer.level('voices'),\n        gameplay: mixer.level('gameplay'), atmosphere: mixer.level('atmosphere'),\n        character: mixer.level('character'), settings: mixer.settings() } : null,\n      cabin: cabin ? { running: cabin.running, contextState: cabin.contextState,\n        enabled: cabin.enabled, unlocked: cabin.unlocked, allowed: cabin.allowed,\n        volume: cabin.volume, fireVolume: cabin.fireVolume, busGain: cabin.busGain,\n        timers: cabin.timers, voices: cabin.voices } : null,\n      voiceQueue: voice ? { active: !!voice.active, pending: voice.pending.length, starts: voice.log.filter(e => e.type === 'start').length } : null,\n      trump: trump ? { playing: trump.playing, cacheSize: trump.cacheSize, loadFailures: trump.history.filter(e => e.type === 'load-failed').length } : null,\n      assets: { cabin: !!window.HORCabinSamples,\n        landingBuffers: read(() => typeof cardLandingBuffers058 === 'undefined' ? 0 : cardLandingBuffers058.length) },\n      test: { ...test },\n    };\n    lastClock = clock; lastAt = at;\n    samples.push(frame); if (samples.length > 12) samples.shift();\n  }\n  async function send(reason, force = false) {\n    sample(reason);\n    if (sending || (!force && Date.now() - lastSent < 10000)) return;\n    sending = true; lastSent = Date.now();\n    try {\n      const response = await fetch('/audio-check/report', {\n        method: 'POST', headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ id, samples }), cache: 'no-store', keepalive: true,\n      });\n      label.textContent = response.ok ? 'Sound check received \u00b7 play normally' : 'Sound check could not send';\n    } catch (_) { label.textContent = 'Sound check waiting for connection'; }\n    finally { sending = false; }\n  }\n  panel.querySelector('[data-check=\"test\"]').onclick = async () => {\n    test = { requested: true, heard: null };\n    let ctx;\n    try {\n      const AudioCtx = window.AudioContext || window.webkitAudioContext;\n      ctx = new AudioCtx(); await ctx.resume();\n      test.state = ctx.state;\n      const gain = ctx.createGain(); gain.gain.value = 0.08; gain.connect(ctx.destination);\n      for (const [i, frequency] of [440, 660].entries()) {\n        const oscillator = ctx.createOscillator(); oscillator.frequency.value = frequency;\n        oscillator.connect(gain); oscillator.start(ctx.currentTime + i * 0.3);\n        oscillator.stop(ctx.currentTime + i * 0.3 + 0.18);\n      }\n      setTimeout(() => { test.clock = ctx.currentTime; ctx.close().catch(() => {}); send('test-finished', true); }, 900);\n    } catch (_) { test.error = 'test-unavailable'; }\n    panel.querySelector('[data-check=\"yes\"]').hidden = false;\n    panel.querySelector('[data-check=\"no\"]').hidden = false;\n    send('test-requested', true);\n  };\n  for (const [name, heard] of [['yes', true], ['no', false]]) {\n    panel.querySelector('[data-check=\"' + name + '\"]').onclick = () => { test.heard = heard; send('test-answer', true); };\n  }\n  document.addEventListener('visibilitychange', () => send('visibility', true));\n  document.addEventListener('pointerup', () => setTimeout(() => send('interaction'), 350), { passive: true });\n  const timer = setInterval(() => send('heartbeat'), 10000);\n  setTimeout(() => { clearInterval(timer); send('check-ended', true); }, 15 * 60 * 1000);\n  send('opened', true);\n})();\n";
function sanitizeAudioReport(body) {
  if (!body || !/^[a-f0-9]{32}$/.test(body.id || '') || !Array.isArray(body.samples)) return null;
  const n = (v, max = 1e9) => typeof v === 'number' && Number.isFinite(v) ? Math.max(-max, Math.min(max, v)) : null;
  const b = v => typeof v === 'boolean' ? v : null;
  const state = v => ['running', 'suspended', 'interrupted', 'closed', 'not-created'].includes(v) ? v : null;
  const build = v => typeof v === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(v) ? v : null;
  const level = v => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null;
  const levels = obj => Object.fromEntries(['master', 'voices', 'gameplay', 'atmosphere', 'character'].map(key => [key, level(obj?.[key])]));
  const samples = body.samples.slice(-12).map(s => ({
    sequence: n(s?.sequence), elapsedMs: n(s?.elapsedMs),
    reason: ['opened', 'heartbeat', 'interaction', 'visibility', 'test-requested', 'test-finished', 'test-answer', 'check-ended'].includes(s?.reason) ? s.reason : null,
    build: build(s?.build), pageBuild: build(s?.pageBuild), scriptBuild: build(s?.scriptBuild),
    hidden: b(s?.hidden), inGame: b(s?.inGame),
    phase: ['bidding','dealing','discard','trump','play','score','complete','redeal'].includes(s?.phase) ? s.phase : null,
    muted: b(s?.muted), storedMuted: b(s?.storedMuted),
    soundOptions: {cards:b(s?.soundOptions?.cards),turn:b(s?.soundOptions?.turn),ticks:b(s?.soundOptions?.ticks)},
    main: s?.main ? {state:state(s.main.state),clock:n(s.main.clock),clockDelta:n(s.main.clockDelta),wallDeltaMs:n(s.main.wallDeltaMs),sampleRate:n(s.main.sampleRate,384000)} : null,
    mixer: s?.mixer ? {...levels(s.mixer),settings:{...levels(s.mixer.settings),voicesMuted:b(s.mixer.settings?.voicesMuted)}} : null,
    cabin: s?.cabin ? {running:b(s.cabin.running),contextState:state(s.cabin.contextState),enabled:b(s.cabin.enabled),unlocked:b(s.cabin.unlocked),allowed:b(s.cabin.allowed),volume:n(s.cabin.volume,100),fireVolume:n(s.cabin.fireVolume,100),busGain:n(s.cabin.busGain,10),timers:n(s.cabin.timers,100),voices:Array.isArray(s.cabin.voices)?s.cabin.voices.slice(0,12).filter(v=>['fire','wind','bird','crickets','owl','wolf','rain'].includes(v?.name)).map(v=>({name:v.name,level:level(v.level)})):[]} : null,
    voiceQueue: s?.voiceQueue ? {active:b(s.voiceQueue.active),pending:n(s.voiceQueue.pending,100),starts:n(s.voiceQueue.starts,100)} : null,
    trump: s?.trump ? {playing:b(s.trump.playing),cacheSize:n(s.trump.cacheSize,100),loadFailures:n(s.trump.loadFailures,100)} : null,
    assets: {cabin:b(s?.assets?.cabin),landingBuffers:n(s?.assets?.landingBuffers,20)},
    test: {requested:b(s?.test?.requested),heard:b(s?.test?.heard),state:state(s?.test?.state),clock:n(s?.test?.clock),error:s?.test?.error==='test-unavailable'?'test-unavailable':null},
  }));
  return {id:body.id,samples};
}

async function handleAudioReport(request, env) {
  const url = new URL(request.url);
  if (request.method !== 'POST') return json({error:'METHOD_NOT_ALLOWED'},405);
  if (request.headers.get('origin') !== url.origin) return json({error:'SAME_ORIGIN_REQUIRED'},403);
  if (!await verifyPrivateSession(cookieValue(request, PRIVATE_SESSION_COOKIE),env.TEST_GATE_KEY)) return json({error:'SESSION_REQUIRED'},401);
  const rate = env.ACTION_LIMIT;
  if (!rate) return json({error:'SERVER_CONFIGURATION_REQUIRED'},503);
  if (!(await rate.limit({key:(request.headers.get('CF-Connecting-IP')||'unknown')+':audio-check'})).success) return json({error:'TOO_MANY_REQUESTS'},429);
  const text = await request.text();
  if (text.length > 32768) return json({error:'REPORT_TOO_LARGE'},413);
  let report;
  try { report=sanitizeAudioReport(JSON.parse(text)); } catch (_) {}
  if (!report) return json({error:'INVALID_REPORT'},400);
  return env.ROOMS.getByName('__ghr_audio_diagnostics_v1').fetch('https://room.local/audio-report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(report)});
}

function injectAudioDiagnostics(html, url) {
  const id=url.searchParams.get('audioCheck');
  if (!/^[a-f0-9]{32}$/.test(id||'')) return html;
  const source=AUDIO_DIAGNOSTIC_COLLECTOR.replace('__GHR_AUDIO_REPORT_ID__',id);
  return html.replace(/<\/body>/i,'<script>'+source+'<\/script></body>');
}

// Preserved X1 sources; isolated namespace, no browser worker or private partner input.
const ONLINE_X1 = (() => {
const module = undefined; const globalThis = {};
/* Faithful scalar port of frozen rollout.cpp. Card IDs and sampling budget unchanged. */
(function(root){'use strict';
const colors=['green','red','yellow','black'], FULL=(1n<<46n)-1n, U=(1n<<64n)-1n;
const col=c=>c<40?Math.floor(c/10):c<44?c-40:c===44?1:4;
const rank=c=>c<40?c%10+5:c<44?15:c===44?999:1000;
const point=c=>c>=44?20:c>=40?15:c%10+5===5?5:[10,14].includes(c%10+5)?10:0;
const cat=(c,tr)=>c>=44?tr:col(c);
const mask=a=>a.reduce((m,c)=>m|(1n<<BigInt(c)),0n);
const bits=m=>{let a=[];for(let c=0;c<46;c++)if(m&(1n<<BigInt(c)))a.push(c);return a;};
const pop=x=>{let n=0;while(x){x&=x-1;n++;}return n;};
const beat=(a,b,led,tr)=>cat(a,tr)!==cat(b,tr)?cat(a,tr)===tr||(cat(b,tr)!==tr&&cat(a,tr)===led):rank(a)>rank(b);
const legal=(h,t,tr)=>{if(!t.c.length)return h.slice();let q=h.filter(c=>cat(c,tr)===cat(t.c[0],tr));return q.length?q:h.slice();};
const win=(t,tr)=>{let w=0;for(let i=1;i<t.c.length;i++)if(beat(t.c[i],t.c[w],cat(t.c[0],tr),tr))w=i;return w;};
const low=(a,tr)=>a.reduce((a,b)=>((cat(b,tr)===tr?1000000:0)+point(b)*2000+rank(b))<((cat(a,tr)===tr?1000000:0)+point(a)*2000+rank(a))?b:a);
const nonperm=a=>{let q=a.filter(c=>c<44);return q.length?q:a;};
function solmove(h,t,tr,played,nest,seat){
 const L=legal(h,t,tr),partner=(seat+2)%4,unseen=bits(FULL&~(mask(h)|played|nest|mask(t.c)));
 const top=(c,led)=>!unseen.some(x=>beat(x,c,led,tr));
 if(!t.c.length){const ts=L.filter(c=>cat(c,tr)===tr),plain=ts.filter(c=>c<44),side=L.filter(c=>cat(c,tr)!==tr);
  if(ts.length>=4&&unseen.filter(c=>cat(c,tr)===tr).length>=2&&plain.length)return low(plain,tr);
  if(side.length){let best=-1,bn=-1,br=-1,groups=colors.map((_,i)=>side.filter(c=>col(c)===i));for(let c=0;c<4;c++){let g=groups[c];if(c===tr||!g.length)continue;let r=Math.max(...g.map(rank));if(g.length>bn||(g.length===bn&&r>br)){best=c;bn=g.length;br=r;}}
   if(best>=0){let g=groups[best],tops=g.filter(c=>top(c,best)),zeros=g.filter(c=>!point(c));return low(tops.length?tops:zeros.length?zeros:g,tr);}}
  return low(nonperm(L),tr);
 }
 const wi=win(t,tr),w=t.s[wi],val=t.c.reduce((a,c)=>a+point(c),0),led=cat(t.c[0],tr),winners=L.filter(c=>beat(c,t.c[wi],led,tr)),zeros=L.filter(c=>!point(c));
 if(w===partner){if(t.c.length===3){let f=L.filter(c=>point(c)&&c<44&&!beat(c,t.c[wi],led,tr));if(f.length)return f.reduce((a,b)=>point(b)>point(a)||(point(b)===point(a)&&rank(b)<rank(a))?b:a);}return low(nonperm(zeros.length?zeros:L),tr);}
 if(winners.length){if(t.c.length===3||val>=10)return low(nonperm(winners),tr);let cheap=winners.filter(c=>cat(c,tr)!==tr&&!point(c));if(cheap.length)return cheap.reduce((a,b)=>rank(b)<rank(a)?b:a);}
 return low(nonperm(zeros.length?zeros:L),tr);
}
class RNG{constructor(x){this.x=x;}next(){this.x=(this.x+0x9e3779b97f4a7c15n)&U;let z=this.x;z=((z^(z>>30n))*0xbf58476d1ce4e5b9n)&U;z=((z^(z>>27n))*0x94d049bb133111ebn)&U;return(z^(z>>31n))&U;}n(k){return Number(this.next()%BigInt(k));}}
class Sampler{
 constructor(seed){this.rng=new RNG(seed);this.seats=[];this.sizes=[];this.slots=[];this.groups=[];this.allow=Array(46).fill(0);this.accepted=0;this.proposed=0;}
 feasible(remain,counts){let G=this.seats.length;for(let m=1;m<(1<<G);m++){let need=0,cap=0;for(let x=1;x<(1<<G);x++)if((x&m)===x)need+=counts[x];for(let g=0;g<G;g++)if(m&(1<<g))cap+=remain[g];if(need>cap)return false;}return true;}
 init(unseen,seat,lengths,voids,tr,hidden,partnerMask=null){for(let s=0;s<4;s++)if(s!==seat){this.seats.push(s);this.sizes.push(lengths[s]);}if(hidden){this.seats.push(4);this.sizes.push(6);}let cards=bits(unseen),counts=Array(16).fill(0),remain=this.sizes.slice();
  for(let c of cards){let m=0;for(let g=0;g<this.seats.length;g++)if((partnerMask===null
    ? this.seats[g]===4||!(voids[this.seats[g]]&(1<<cat(c,tr)))
    : this.seats[g]===4 ? !(partnerMask&(1n<<BigInt(c)))
    : ((this.seats[g]===(seat+2)%4)===!!(partnerMask&(1n<<BigInt(c))))&&!(voids[this.seats[g]]&(1<<cat(c,tr)))))m|=1<<g;this.allow[c]=m;if(!m)return false;counts[m]++;}if(!this.feasible(remain,counts))return false;
  for(let i=cards.length-1;i>0;i--){let j=this.rng.n(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}cards.sort((a,b)=>pop(this.allow[a])-pop(this.allow[b]));let grouped=this.seats.map(()=>[]);
  for(let c of cards){let m=this.allow[c];counts[m]--;let opts=[],weights=[],total=0;for(let g=0;g<this.seats.length;g++)if(remain[g]&&(m&(1<<g))){remain[g]--;let ok=this.feasible(remain,counts);remain[g]++;if(ok){opts.push(g);weights.push(remain[g]);total+=remain[g];}}if(!opts.length)return false;let q=this.rng.n(total),j=0;while(q>=weights[j])q-=weights[j++];let g=opts[j];remain[g]--;grouped[g].push(c);}
  grouped.forEach((a,g)=>a.forEach(c=>{this.slots.push(c);this.groups.push(g);}));this.mix(512);return this.slots.length===cards.length;
 }
 mix(steps){let N=this.slots.length;if(N<2)return;for(let z=0;z<steps;z++){this.proposed++;let k=2;if(N>=3&&this.rng.n(4)===0)k=Math.min(N,3+this.rng.n(2));let ix=[];for(let j=0;j<k;j++){let q;do{q=this.rng.n(N);}while(ix.includes(q));ix.push(q);}let ok=ix.every((i,j)=>!!(this.allow[this.slots[i]]&(1<<this.groups[ix[(j+1)%k]])));if(!ok)continue;let last=this.slots[ix[k-1]];for(let j=k-1;j>0;j--)this.slots[ix[j]]=this.slots[ix[j-1]];this.slots[ix[0]]=last;this.accepted++;}}
 fill(s){this.seats.forEach(g=>{if(g<4)s.h[g]=[];});if(this.seats.length===4){s.nest=0n;s.nestpts=0;}this.slots.forEach((c,i)=>{let seat=this.seats[this.groups[i]];if(seat===4){s.nest|=1n<<BigInt(c);s.nestpts+=point(c);}else s.h[seat].push(c);});for(let seat of this.seats){if(seat===4)continue;let h=s.h[seat];for(let i=h.length-1;i>0;i--){let j=this.rng.n(i+1);[h[i],h[j]]=[h[j],h[i]];}}}
}
function copy(s){return {...s,h:s.h.map(a=>a.slice()),t:{c:s.t.c.slice(),s:s.t.s.slice()},points:s.points.slice()};}
function complete(world,seat,first){let s=copy(world),rootteam=seat%2,c=first;while(true){let at=s.h[seat].indexOf(c);if(at<0)throw Error('simulation card absent');s.h[seat].splice(at,1);s.t.c.push(c);s.t.s.push(seat);s.played|=1n<<BigInt(c);if(s.t.c.length===4){let w=s.t.s[win(s.t,s.tr)];s.points[w%2]+=s.t.c.reduce((a,c)=>a+point(c),0);s.t={c:[],s:[]};seat=w;if(s.h.every(h=>!h.length)){s.points[w%2]+=s.nestpts;break;}}else seat=(seat+1)%4;c=solmove(s.h[seat],s.t,s.tr,s.played,seat===s.bidder?s.nest:0n,seat);}let b=s.bidder%2;if(s.points[b]<s.bid)s.points[b]=-s.bid;return s.points[rootteam]-s.points[1-rootteam];}
function choose(v){let {h,tc,ts,tr,seat,bidder,bid,points,voids}=v,played=BigInt(v.played),nest=BigInt(v.nest),seed=BigInt(v.seed),samples=h.length<=3?256:128;
 let partnerMask=Object.prototype.hasOwnProperty.call(v,'partnerMask')?BigInt(v.partnerMask):null;
 // null means unauthorized/absent; 0n means an eligible partner has no cards.
 if(partnerMask!==null){let n=(bits(played).length-tc.length)/4,expected=10-n-(ts.includes((seat+2)%4)?1:0);if(partnerMask<0n||(partnerMask&~FULL)||(partnerMask&(played|nest|mask(h)))||bits(partnerMask).length!==expected||bits(partnerMask).some(c=>voids[(seat+2)%4]&(1<<cat(c,tr))))return{card:-8,out:Array(12).fill(0)};}
 let base={h:[[],[],[],[]],t:{c:tc.slice(),s:ts.slice()},tr,bidder,bid,points:points.slice(),played,nest,nestpts:bits(nest).reduce((a,c)=>a+point(c),0)};base.h[seat]=h.slice();let L=legal(h,base.t,tr),reference=solmove(h,base.t,tr,played,nest,seat),out=Array(12).fill(0);if(L.length===1)return{card:L[0],out};let completed=(bits(played).length-tc.length)/4,lengths=Array(4).fill(10-completed);ts.forEach(s=>lengths[s]--);if(lengths[seat]!==h.length)return{card:-2,out};let sampler=new Sampler(seed);if(!sampler.init(FULL&~(played|nest|mask(h)),seat,lengths,voids,tr,seat!==bidder,partnerMask))return{card:-3,out};let sum=L.map(()=>0),dsq=L.map(()=>0),ri=L.indexOf(reference);
 for(let i=0;i<samples;i++){sampler.mix(64);let world=copy(base);sampler.fill(world);let all=played;if(bits(world.nest).length!==6||(all&world.nest))return{card:-4,out};all|=world.nest;for(let s=0;s<4;s++){let hm=mask(world.h[s]);if(world.h[s].length!==lengths[s]||bits(hm).length!==lengths[s]||(all&hm))return{card:-5,out};all|=hm;if(world.h[s].some(c=>voids[s]&(1<<cat(c,tr))))return{card:-6,out};}if(all!==FULL)return{card:-7,out};let vals=L.map((c,j)=>{let n=complete(world,seat,c);sum[j]+=n;return n;});vals.forEach((n,j)=>{let d=n-vals[ri];dsq[j]+=d*d;});}
 let best=ri,bestadv=0;L.forEach((c,j)=>{let d=(sum[j]-sum[ri])/samples,se=Math.sqrt(Math.max(0,dsq[j]/samples-d*d)/Math.max(1,samples-1)),adjusted=d-.5-.5*se;if(adjusted>bestadv){bestadv=adjusted;best=j;}});out.splice(0,8,samples,L.length,reference,sum[ri]/samples,sum[best]/samples,sampler.accepted,sampler.proposed,Number(L[best]!==reference));return{card:L[best],out};
}
function trump(h){let scores=colors.map((_,c)=>{let suited=h.filter(x=>col(x)===c&&x!==44),n=suited.length,ranks=new Set(suited.map(rank));let controls=(ranks.has(15)?5:0)+(ranks.has(14)?4:0)+(ranks.has(13)?2.5:0)+(ranks.has(12)?1.5:0);return n*10+Math.max(0,n-4)*4+controls*4+suited.reduce((a,x)=>a+point(x),0)*.55;});let best=0;for(let c=1;c<4;c++)if(scores[c]>scores[best]||(scores[c]===scores[best]&&h.filter(x=>col(x)===c).length>h.filter(x=>col(x)===best).length))best=c;return best;}
function ceiling(h,ctx){let lens=colors.map((_,c)=>h.filter(x=>col(x)===c).length),honors=colors.map((_,c)=>h.filter(x=>col(x)===c&&[15,14,13,12,10].includes(rank(x))).length),t=trump(h),v=h.reduce((a,c)=>a+point(c),0)*.62+lens[t]*8+honors[t]*7+lens.filter(n=>!n).length*10+lens.filter(n=>n<=1).length*3+(h.includes(45)?20:0)+(h.includes(44)?10:0);if(v<62)return 0;let cap=70+Math.floor(Math.max(0,v-62)*1.35/5)*5,high=ctx.high??65,partner=(ctx.seat+2)%4;if(high<=90&&v>=68)cap=Math.max(cap,high+5);if(high<=110&&v>=76)cap=Math.max(cap,high+5);if(ctx.history.some(([s,b])=>s===partner&&b>0))cap+=5;let mine=ctx.scores[ctx.seat%2],theirs=ctx.scores[1-ctx.seat%2];if(theirs-mine>=100)cap+=5;if(mine>=425&&mine>theirs)cap-=5;return Math.max(0,Math.min(200,Math.floor(cap/5)*5));}
function discard(h,n,tr){let lens=colors.map((_,c)=>h.filter(x=>col(x)===c&&x!==44).length),strong=h.filter(x=>cat(x,tr)===tr).length>=6||h.includes(45)||h.includes(44);let keep=x=>{if(x===45)return 20000;if(x===44)return 18000;if(cat(x,tr)===tr)return 5000+rank(x)*8+point(x)*20;let ln=lens[col(x)]||0,r=rank(x),p=point(x),control=r===15?1800:r===14?1150:r===13?550:r===12?260:0,counter=p*28;if(p&&ln<=2&&![15,14].includes(r))counter-=strong?260:120;let vp=p===0?(ln===1?900:ln===2?520:ln===3?140:0):0;return control+counter+r*2+ln*45-vp;};return h.slice().sort((a,b)=>keep(b)-keep(a)).slice(0,h.length-n);}
const api={choose,solmove,legal,mask,colors,point,rank,col,cat,trump,ceiling,discard,RNG};if(typeof module!=='undefined')module.exports=api;root.X1Core=api;
})(globalThis);

/* SHA-256 for HTTP Android LAN testing where crypto.subtle is unavailable. */
(function(r){r.x1SHA256=function(input){const bytes=new TextEncoder().encode(input),K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],len=Math.ceil((bytes.length+9)/64)*64,b=new Uint8Array(len);b.set(bytes);b[bytes.length]=128;let dv=new DataView(b.buffer);dv.setUint32(len-8,Math.floor(bytes.length*8/4294967296));dv.setUint32(len-4,bytes.length*8);let ro=(x,n)=>(x>>>n)|(x<<(32-n));for(let off=0;off<len;off+=64){let w=new Uint32Array(64);for(let i=0;i<16;i++)w[i]=dv.getUint32(off+i*4);for(let i=16;i<64;i++){let x=w[i-15],y=w[i-2];w[i]=(ro(x,7)^ro(x,18)^(x>>>3))+w[i-16]+(ro(y,17)^ro(y,19)^(y>>>10))+w[i-7];}let [a,c,d,e,f,g,h,j]=H;for(let i=0;i<64;i++){let t1=(j+(ro(f,6)^ro(f,11)^ro(f,25))+((f&g)^(~f&h))+K[i]+w[i])>>>0,t2=((ro(a,2)^ro(a,13)^ro(a,22))+((a&c)^(a&d)^(c&d)))>>>0;j=h;h=g;g=f;f=(e+t1)>>>0;e=d;d=c;c=a;a=(t1+t2)>>>0;}[a,c,d,e,f,g,h,j].forEach((v,i)=>H[i]=(H[i]+v)>>>0);}let out=new Uint8Array(32),v=new DataView(out.buffer);H.forEach((x,i)=>v.setUint32(i*4,x));return out;};})(globalThis);

/* X1 partner bidding experiment PF-20261012. Own/public input only. */
(function(root){'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.X1Core;
const ALL=Array.from({length:46},(_,i)=>i),R=ALL.map(C.rank),P=ALL.map(C.point),COL=ALL.map(C.col);
const cat=(c,t)=>c>=44?t:COL[c];
const beat=(a,b,l,t)=>cat(a,t)!==cat(b,t)?cat(a,t)===t||(cat(b,t)!==t&&cat(a,t)===l):R[a]>R[b];
// Independent numeric implementation of the unchanged Sol7 continuation.
// It is used only to evaluate hypothetical contracts, never to play real cards.
function move(h,tc,ts,tr,seen,nest,seat){
 const led=tc.length?cat(tc[0],tr):-1,follow=h.filter(c=>cat(c,tr)===led),L=follow.length?follow:h;
 const unknown=ALL.filter(c=>!h.includes(c)&&!seen[c]&&!nest.includes(c)&&!tc.includes(c));
 const low=a=>a.reduce((a,b)=>((cat(b,tr)===tr?1000000:0)+P[b]*2000+R[b])<((cat(a,tr)===tr?1000000:0)+P[a]*2000+R[a])?b:a);
 const np=a=>{const b=a.filter(c=>c<44);return b.length?b:a;};
 if(!tc.length){const trump=L.filter(c=>cat(c,tr)===tr),plain=trump.filter(c=>c<44),side=L.filter(c=>cat(c,tr)!==tr);
  if(trump.length>=4&&unknown.filter(c=>cat(c,tr)===tr).length>=2&&plain.length)return low(plain);
  if(side.length){let best=[],br=-1;for(let color=0;color<4;color++){const g=side.filter(c=>COL[c]===color),r=Math.max(...g.map(c=>R[c]));if(g.length>best.length||(g.length===best.length&&r>br)){best=g;br=r;}}
   const top=best.filter(c=>!unknown.some(x=>beat(x,c,COL[c],tr))),zero=best.filter(c=>!P[c]);return low(top.length?top:zero.length?zero:best);}
  return low(np(L));
 }
 let wi=0;for(let i=1;i<tc.length;i++)if(beat(tc[i],tc[wi],led,tr))wi=i;
 const val=tc.reduce((a,c)=>a+P[c],0),wins=L.filter(c=>beat(c,tc[wi],led,tr)),zero=L.filter(c=>!P[c]);
 if(ts[wi]===(seat+2)%4){if(tc.length===3){const f=L.filter(c=>P[c]&&c<44&&!beat(c,tc[wi],led,tr));if(f.length)return f.reduce((a,b)=>P[b]>P[a]||(P[b]===P[a]&&R[b]<R[a])?b:a);}return low(np(zero.length?zero:L));}
 if(wins.length){if(tc.length===3||val>=10)return low(np(wins));const cheap=wins.filter(c=>cat(c,tr)!==tr&&!P[c]);if(cheap.length)return cheap.reduce((a,b)=>R[b]<R[a]?b:a);}
 return low(np(zero.length?zero:L));
}
function contract(hands,nest,bidder){
 const hs=hands.map(h=>h.slice()),all=hs[bidder].concat(nest),tr=C.trump(all);hs[bidder]=C.discard(all,6,tr);
 const buried=all.filter(c=>!hs[bidder].includes(c)),seen=Array(46).fill(false),points=[0,0];let lead=bidder;
 for(let k=0;k<10;k++){const tc=[],ts=[];for(let j=0;j<4;j++){const s=(lead+j)%4,c=move(hs[s],tc,ts,tr,seen,s===bidder?buried:[],s);hs[s].splice(hs[s].indexOf(c),1);tc.push(c);ts.push(s);seen[c]=true;}
  let wi=0;for(let j=1;j<4;j++)if(beat(tc[j],tc[wi],cat(tc[0],tr),tr))wi=j;lead=ts[wi];points[lead%2]+=tc.reduce((a,c)=>a+P[c],0);}
 points[lead%2]+=buried.reduce((a,c)=>a+P[c],0);return points;
}
function validate(v){
 const keys=['h','seat','dealer','high','bidder','history','scores','passed','limit','target','revealed','moon'];
 if(Object.keys(v).some(k=>!keys.includes(k)))throw Error('unauthorized bidding input');
 if(v.h.length!==10||new Set(v.h).size!==10||v.h.some(c=>!Number.isInteger(c)||c<0||c>45))throw Error('invalid own hand');
 if(![v.seat,v.dealer].every(s=>Number.isInteger(s)&&s>=0&&s<4)||!Number.isInteger(v.bidder)||v.bidder< -1||v.bidder>3)throw Error('invalid seats');
 if(!Array.isArray(v.passed)||v.passed.length!==4||v.passed.some(p=>typeof p!=='boolean')||v.scores.length!==2||v.scores.some(x=>!Number.isFinite(x)))throw Error('invalid public state');
 if(!Number.isFinite(v.high)||v.high%5||v.high<65||v.high>200||!Number.isFinite(v.limit)||v.limit>200||!Number.isFinite(v.target)||v.target<=0)throw Error('invalid contract');
 if(v.revealed!==null&&(!Number.isInteger(v.revealed)||v.revealed<0||v.revealed>45||v.h.includes(v.revealed)))throw Error('invalid public reveal');
 if(typeof v.moon!=='boolean')throw Error('invalid moon setting');
 if(!Array.isArray(v.history)||v.history.some(x=>!Array.isArray(x)||x.length!==2||!Number.isInteger(x[0])||x[0]<0||x[0]>3||!Number.isFinite(x[1])||x[1]<0||x[1]>200))throw Error('invalid public history');
}
function rngFor(v){let x=2166136261;for(const c of JSON.stringify([v.h,v.seat,v.dealer,v.high,v.bidder,v.history,v.scores,v.passed,v.limit,v.target,v.revealed,v.moon]))x=Math.imul(x^c.charCodeAt(0),16777619)>>>0;return n=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)%n;};}
function auction(hands,v,raise,shifts){
 const active=v.passed.map(x=>!x),hist=v.history.filter(x=>x[1]>0).map(x=>x.slice());let high=v.high,bidder=v.bidder;
 if(raise){high=typeof raise==='number'?raise:high+5;bidder=v.seat;hist.push([v.seat,high]);if(v.moon&&high===200)return {bidder,bid:high};}else active[v.seat]=false;
 for(let cur=(v.seat+1)%4,guard=0;guard<160;guard++,cur=(cur+1)%4){
  if(bidder>=0&&active.filter(Boolean).length<=1)return {bidder,bid:high};
  if(!active[cur])continue;
  const cap=Math.min(v.moon&&v.scores[cur%2]<0?195:v.limit,C.ceiling(hands[cur],{seat:cur,high,history:hist,scores:v.scores})+shifts[cur]);
  if(cap>=high+5&&high+5<=v.limit){high+=5;bidder=cur;hist.push([cur,high]);if(v.moon&&high===200)return {bidder,bid:high};}else active[cur]=false;
 }
 throw Error('hypothetical auction did not terminate');
}
function utility(points,a,v){const delta=points.slice();if(points[a.bidder%2]<a.bid)delta[a.bidder%2]=-a.bid;
 const team=v.seat%2,s=v.scores.map((n,i)=>n+delta[i]);if(v.moon&&a.bid===200&&points[a.bidder%2]===200)s[a.bidder%2]=Math.max(s[a.bidder%2],v.target);const terminal=Math.max(...s)>=v.target||Math.min(...s)<=-v.target;
 // Match result dominates a one-hand margin; otherwise use score difference.
 if(terminal)return s[team]===s[1-team]?0:s[team]>s[1-team]?400:-400;
 return Math.max(-399,Math.min(399,s[team]-s[1-team]));
}
// Compare modest legal jumps with the minimum raise on the same sampled deals.
// Opponent cards are sampled from unseen cards, never read from the live game.
function decideJump(v){
 validate(v);
 const cap=C.ceiling(v.h,{seat:v.seat,high:v.high,history:v.history,scores:v.scores}),ask=v.high+5;
 if(cap<ask||ask>v.limit)return {bid:0,cap,reason:'original ceiling',samples:0};
 if(v.bidder<0||v.bidder%2===v.seat%2)return {bid:ask,cap,reason:'minimum raise',samples:0};
 const candidates=[ask,...[10,15,20,25].map(n=>v.high+n).filter(n=>n<=Math.min(cap-10,v.limit,195))];
 if(candidates.length===1)return {bid:ask,cap,reason:'minimum raise; insufficient jump reserve',samples:0};
 const rng=rngFor(v),unknown=ALL.filter(c=>!v.h.includes(c)&&c!==v.revealed),maxima=Array(4).fill(0),rows=[];
 for(const [seat,bid]of v.history)maxima[seat]=Math.max(maxima[seat],bid);
 for(let i=0;i<128;i++){
  const cards=unknown.slice();for(let j=cards.length-1;j>0;j--){const k=rng(j+1);[cards[j],cards[k]]=[cards[k],cards[j]];}
  const n=v.revealed===null?6:5,nest=cards.slice(0,n);if(v.revealed!==null)nest.unshift(v.revealed);
  const hs=[];let offset=n;for(let seat=0;seat<4;seat++){hs[seat]=seat===v.seat?v.h.slice():cards.slice(offset,offset+10);if(seat!==v.seat)offset+=10;}
  const shifts=Array.from({length:4},(_,seat)=>seat===v.seat?0:[-20,0,20][rng(3)]);let w=1;
  for(let seat=0;seat<4;seat++)if(seat!==v.seat&&maxima[seat]){const c=C.ceiling(hs[seat],{seat,high:maxima[seat]-5,history:[],scores:v.scores})+shifts[seat];w*=Math.max(.02,1/(1+Math.exp(Math.max(-40,Math.min(40,(maxima[seat]-c)/10)))));}
  const cache={},values=candidates.map(bid=>{const a=auction(hs,v,bid,shifts),pts=cache[a.bidder]||(cache[a.bidder]=contract(hs,nest,a.bidder));return utility(pts,a,v);});
  rows.push({w,values});
 }
 const sw=rows.reduce((n,r)=>n+r.w,0),neff=sw*sw/rows.reduce((n,r)=>n+r.w*r.w,0);
 const evaluations=candidates.map((bid,j)=>{const gain=rows.reduce((n,r)=>n+r.w*(r.values[j]-r.values[0]),0)/sw,variance=rows.reduce((n,r)=>n+r.w*(r.values[j]-r.values[0]-gain)**2,0)/sw,se=Math.sqrt(variance/Math.max(1,neff-1));return {bid,gain,se};});
 let best=evaluations[0];for(const e of evaluations.slice(1))if(e.gain>2+.5*e.se&&e.gain-.5*e.se>best.gain-.5*best.se)best=e;
 return {bid:best.bid,cap,reason:best.bid===ask?'minimum raise preferred':'evaluated pressure jump',samples:128,evaluations,effectiveSamples:neff};
}
function decide(v){validate(v);const cap=C.ceiling(v.h,{seat:v.seat,high:v.high,history:v.history,scores:v.scores}),ask=v.high+5;
 const baseline=cap>=ask&&ask<=v.limit;if(v.bidder!==(v.seat+2)%4||!baseline)return {bid:baseline?ask:0,cap,reason:'original ceiling',samples:0};
 const rng=rngFor(v),unknown=ALL.filter(c=>!v.h.includes(c)&&c!==v.revealed),maxima=Array(4).fill(0);for(const [s,b]of v.history)maxima[s]=Math.max(maxima[s],b);
 const rows=[];for(let i=0;i<256;i++){const cards=unknown.slice();for(let j=cards.length-1;j>0;j--){const k=rng(j+1);[cards[j],cards[k]]=[cards[k],cards[j]];}const n=v.revealed===null?6:5,nest=cards.slice(0,n);if(v.revealed!==null)nest.unshift(v.revealed);const hs=[];let offset=n;for(let s=0;s<4;s++){hs[s]=s===v.seat?v.h.slice():cards.slice(offset,offset+10);if(s!==v.seat)offset+=10;}
  const shifts=Array.from({length:4},(_,s)=>s===v.seat?0:[-20,0,20][rng(3)]);let w=1;
  for(let s=0;s<4;s++)if(s!==v.seat&&maxima[s]){const c=C.ceiling(hs[s],{seat:s,high:maxima[s]-5,history:[],scores:v.scores})+shifts[s];w*=Math.max(.02,1/(1+Math.exp(Math.max(-40,Math.min(40,(maxima[s]-c)/10)))));}
  const pass=auction(hs,v,false,shifts),raise=auction(hs,v,true,shifts),cache={};const pts=a=>cache[a.bidder]||(cache[a.bidder]=contract(hs,nest,a.bidder));
  const p0=pts(pass),p1=pts(raise);rows.push({w,d:utility(p1,raise,v)-utility(p0,pass,v),made:p1[raise.bidder%2]>=raise.bid,own:raise.bidder===v.seat});
 }
 const sw=rows.reduce((a,r)=>a+r.w,0),avg=f=>rows.reduce((a,r)=>a+r.w*f(r),0)/sw,gain=avg(r=>r.d),neff=sw*sw/rows.reduce((a,r)=>a+r.w*r.w,0),se=Math.sqrt(avg(r=>(r.d-gain)**2)/Math.max(1,neff-1));
 // Risk is included in set penalties and continued bidding; require a modest
 // paired uncertainty margin, without an unconditional 75% success veto.
 const take=gain>2+.5*se;return {bid:take?ask:0,cap,reason:take?'team-value takeover':'support partner',samples:256,gain,se,effectiveSamples:neff,pMake:avg(r=>r.made?1:0),pControl:avg(r=>r.own?1:0)};
}
const api={decide,decideJump,contract,move,validate};if(typeof module!=='undefined')module.exports=api;root.X1Bidding=api;
})(globalThis);

return Object.freeze({core:globalThis.X1Core,bidding:globalThis.X1Bidding,sha256:globalThis.x1SHA256});
})();

// Online X1 sees only its own cards plus confirmed public information.
// Offline partner-mask/Anchor assistance never crosses this boundary.
const ONLINE_X1_VERSION = 'x1-online-v1';
function freshOnlineX1(state) {
  return {
    version: ONLINE_X1_VERSION,
    hand: state.handNumber,
    voids: [0, 0, 0, 0],
    history: [],
    plan: null,
    decisions: { bid: 0, discard: 0, trump: 0, play: 0 },
    fallbacks: 0,
    lastEngine: null,
    lastFallback: null,
    lastDecisionMs: 0,
    maxDecisionMs: 0,
  };
}
function x1CardId(card) {
  if (card?.id === 'rook') return 45;
  if (card?.id === 'red-2') return 44;
  const color = ONLINE_X1.core.colors.indexOf(card?.color),
    rank = Number(card?.rank);
  if (color < 0 || card.id === 'red1-special') throw Error('X1_UNSUPPORTED_CARD');
  if (rank === 1) return 40 + color;
  if (!Number.isInteger(rank) || rank < 5 || rank > 14) throw Error('X1_UNSUPPORTED_CARD');
  return color * 10 + rank - 5;
}
function x1Compatible(state) {
  const s = state.settings,
    r = s.rules;
  return (
    Number(s.minBid) >= 70 &&
    Number(s.minBid) <= 200 &&
    Number(s.minBid) % 5 === 0 &&
    s.handSize === 10 &&
    s.nestSize === 6 &&
    s.nestGoesTo === 'lastTrick' &&
    !s.bidOnlyScoring &&
    !s.openWidow &&
    r.includeOnes &&
    r.onesHigh &&
    r.includeRed2 &&
    r.includeRook &&
    !r.includeRed1 &&
    !r.rookLowest &&
    !r.specialsAnytime &&
    !r.mustTrumpWhenVoid &&
    Number(r.red2Points) === 20
  );
}
function x1OrderedHand(state, seat, memory) {
  const own = state.hands[seat];
  if (memory?.plan?.seat !== seat || !Array.isArray(memory.plan.keep)) return own;
  const byId = new Map(own.map((card) => [x1CardId(card), card]));
  const ordered = memory.plan.keep.filter((id) => byId.has(id)).map((id) => byId.get(id));
  return ordered.length === own.length ? ordered : own;
}
function x1PlayInput(state, seat, memory) {
  const C = ONLINE_X1.core;
  const h = x1OrderedHand(state, seat, memory).map(x1CardId);
  const tc = state.trick.map((p) => x1CardId(p.card)),
    ts = state.trick.map((p) => p.player);
  const playedCards = [
    ...state.tricksTaken[0],
    ...state.tricksTaken[1],
    ...state.trick.map((p) => p.card),
  ];
  const played = C.mask(playedCards.map(x1CardId));
  const nest = seat === state.bidder ? C.mask((state.nestCards || []).map(x1CardId)) : 0n;
  const points = state.tricksTaken.map((cards) =>
    cards.reduce((n, card) => n + cardPoints(card, state.settings.rules), 0)
  );
  const voids = memory.voids.slice();
  const payload =
    '[' +
    [
      JSON.stringify(h),
      JSON.stringify(tc),
      JSON.stringify(ts),
      JSON.stringify(state.trump),
      seat,
      state.bidder,
      state.bid,
      JSON.stringify(points),
      String(played),
      String(nest),
      JSON.stringify(voids),
    ].join(',') +
    ']';
  const bytes = ONLINE_X1.sha256(payload);
  let seed = 0n;
  for (let i = 7; i >= 0; i--) seed = (seed << 8n) | BigInt(bytes[i]);
  return {
    h,
    tc,
    ts,
    tr: C.colors.indexOf(state.trump),
    seat,
    bidder: state.bidder,
    bid: state.bid,
    points,
    played: String(played),
    nest: String(nest),
    voids,
    seed: String(seed),
  };
}
function x1BidInput(state, seat, memory) {
  return {
    h: state.hands[seat].map(x1CardId),
    seat,
    dealer: state.dealer,
    high: state.highestBid,
    bidder: state.bidder,
    history: memory.history.map((row) => row.slice()),
    scores: state.scores.slice(),
    passed: state.bidStatus.map((x) => x === 'pass'),
    limit: 200,
    target: state.settings.targetScore,
    revealed:
      state.settings.revealTopNest && state.topNestCard ? x1CardId(state.topNestCard) : null,
    moon: !!state.settings.shootMoonEnabled,
  };
}
function x1ActionLegal(state, seat, action) {
  if (!action || seat !== state.currentPlayer) return false;
  const hand = state.hands[seat];
  if (state.phase === 'bidding')
    return (
      action.type === 'bid' &&
      Number.isInteger(action.value) &&
      (action.value === 0 ||
        (action.value % 5 === 0 && action.value >= state.highestBid + 5 && action.value <= 200))
    );
  if (state.phase === 'discard')
    return (
      action.type === 'discard' &&
      seat === state.bidder &&
      Array.isArray(action.cardIds) &&
      action.cardIds.length === state.discardCount &&
      new Set(action.cardIds).size === action.cardIds.length &&
      action.cardIds.every((id) => hand.some((c) => c.id === id))
    );
  if (state.phase === 'trump')
    return action.type === 'trump' && seat === state.bidder && COLORS.includes(action.color);
  if (state.phase === 'play') {
    const card = hand.find((c) => c.id === action.cardId);
    return (
      action.type === 'play' &&
      !!card &&
      canPlay(card, hand, state.ledColor, state.trump, state.settings.rules)
    );
  }
  return false;
}
function chooseOnlineBotAction(room, seat) {
  const state = room.gameState,
    memory = room.x1;
  const fallback = (reason) => ({
    action: chooseTestBotAction(state, seat),
    engine: 'legacy',
    reason,
  });
  if (!memory || memory.hand !== state.handNumber) return fallback('existing-hand');
  if (!x1Compatible(state)) return fallback('unsupported-rules');
  if (state.shotTheMoon) return fallback('moon-contract');
  const started = performance.now(),
    C = ONLINE_X1.core;
  let action,
    plan = null,
    engine = 'x1',
    reason = null;
  try {
    if (state.phase === 'bidding') {
      const v = x1BidInput(state, seat, memory),
        ask = v.high + 5;
      const cap = C.ceiling(v.h, { seat, high: v.high, history: v.history, scores: v.scores });
      let value = cap >= ask && ask <= v.limit ? ask : 0;
      // Match normal X1 bidding: no private-partner takeover route online.
      if (value && v.bidder >= 0 && v.bidder % 2 !== seat % 2 && cap >= ask + 15) {
        try {
          const decision = ONLINE_X1.bidding.decideJump(v),
            bid = decision.bid;
          if (
            Number.isSafeInteger(bid) &&
            bid % 5 === 0 &&
            bid >= ask &&
            bid <= Math.min(cap - 10, v.limit, 195) &&
            bid <= v.high + 25
          )
            value = bid;
          else reason = 'bid-jump-baseline';
        } catch (_) {
          reason = 'bid-jump-baseline';
        }
      }
      action = { type: 'bid', value };
    } else if (state.phase === 'discard') {
      const hand = state.hands[seat],
        ids = hand.map(x1CardId),
        trump = C.trump(ids),
        keep = C.discard(ids, state.discardCount, trump);
      plan = { seat, trump, keep };
      const selected = new Set(keep);
      action = {
        type: 'discard',
        cardIds: hand.filter((card) => !selected.has(x1CardId(card))).map((card) => card.id),
      };
    } else if (state.phase === 'trump') {
      const trump =
        memory.plan?.seat === seat ? memory.plan.trump : C.trump(state.hands[seat].map(x1CardId));
      action = { type: 'trump', color: C.colors[trump] };
    } else if (state.phase === 'play') {
      const view = x1PlayInput(state, seat, memory);
      let id;
      if (!memory.sol7) {
        try {
          const result = C.choose(view);
          id = result.card;
        } catch (_) {}
      }
      let card = state.hands[seat].find((card) => x1CardId(card) === id);
      if (
        !card ||
        !canPlay(card, state.hands[seat], state.ledColor, state.trump, state.settings.rules)
      ) {
        id = C.solmove(
          view.h,
          { c: view.tc, s: view.ts },
          view.tr,
          BigInt(view.played),
          BigInt(view.nest),
          seat
        );
        card = state.hands[seat].find((card) => x1CardId(card) === id);
        engine = 'sol7';
        reason = memory.sol7 ? 'sol7-hand' : 'sampling-fallback';
      }
      action = { type: 'play', cardId: card?.id };
    }
    if (!x1ActionLegal(state, seat, action)) return fallback('invalid-x1-action');
    return {
      action,
      plan,
      engine,
      reason,
      ms: Math.round((performance.now() - started) * 100) / 100,
    };
  } catch (_) {
    return fallback('x1-error');
  }
}
function observeOnlineX1(room, before, result, decision = null) {
  const memory = room.x1;
  if (!memory || memory.hand !== before.handNumber || !result.accepted) return;
  const seat = before.currentPlayer;
  if (before.phase === 'bidding' && result.state.highestBid > before.highestBid)
    memory.history.push([seat, result.state.highestBid]);
  if (before.phase === 'play' && before.ledColor) {
    const remaining = new Set(result.state.hands[seat].map((c) => c.id));
    const card = before.hands[seat].find((c) => !remaining.has(c.id));
    if (card && !followsLedSuit(card, before.ledColor, before.trump, before.settings.rules))
      memory.voids[seat] |= 1 << COLORS.indexOf(before.ledColor);
  }
  if (!decision) return;
  memory.decisions[decision.action.type]++;
  memory.lastEngine = decision.engine;
  memory.lastDecisionMs = decision.ms || 0;
  memory.maxDecisionMs = Math.max(memory.maxDecisionMs || 0, memory.lastDecisionMs);
  if (decision.plan) memory.plan = decision.plan;
  if (decision.engine === 'sol7') memory.sol7 = true;
  if (decision.reason) {
    memory.fallbacks++;
    memory.lastFallback = decision.reason;
  }
}
function onlineX1Proof(room) {
  const m = room.x1;
  return {
    version: ONLINE_X1_VERSION,
    active: m?.lastEngine || (m ? 'x1' : 'legacy'),
    decisions: m ? { ...m.decisions } : { bid: 0, discard: 0, trump: 0, play: 0 },
    fallbacks: m?.fallbacks || 0,
    lastFallback: m?.lastFallback || null,
    lastDecisionMs: m?.lastDecisionMs || 0,
    maxDecisionMs: m?.maxDecisionMs || 0,
    partnerAssist: false,
  };
}

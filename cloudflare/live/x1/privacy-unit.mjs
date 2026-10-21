import assert from 'node:assert/strict';
import { api, players } from './test-harness.mjs';
const {
  createMatch,
  submitBid,
  discardCards,
  chooseTrump,
  playCard,
  makeDeck,
  canPlay,
  x1PlayInput,
  x1BidInput,
  freshOnlineX1,
  chooseOnlineBotAction,
  observeOnlineX1,
  ONLINE_X1,
  onlineX1Proof,
} = api;
const state = createMatch(players, { targetScore: 100, misdealOnNoCounters: false });
let memory = freshOnlineX1(state),
  room = { gameState: state, x1: memory };
const own = state.currentPlayer;
// Building bid input must never read another seat's hand or the private nest.
const bidState = structuredClone(state),
  ownHand = bidState.hands[own];
bidState.hands = Array.from({ length: 4 }, (_, seat) => (seat === own ? ownHand : null));
for (let seat = 0; seat < 4; seat++)
  if (seat !== own)
    Object.defineProperty(bidState.hands, seat, {
      get() {
        throw Error('READ_OTHER_HAND');
      },
    });
Object.defineProperty(bidState, 'nest', {
  get() {
    throw Error('READ_SECRET_NEST');
  },
});
const bv = x1BidInput(bidState, own, memory);
assert.deepEqual(Object.keys(bv), [
  'h',
  'seat',
  'dealer',
  'high',
  'bidder',
  'history',
  'scores',
  'passed',
  'limit',
  'target',
  'revealed',
  'moon',
]);
let decided = chooseOnlineBotAction({ gameState: bidState, x1: memory }, own);
assert.equal(decided.engine, 'x1');
assert.equal(decided.action.type, 'bid');
let s = {
  ...state,
  phase: 'play',
  trump: 'green',
  bidder: 0,
  bid: 100,
  highestBid: 100,
  currentPlayer: 1,
  hands: makeDeck().reduce(
    (hs, c, i) => {
      if (i < 40) hs[Math.floor(i / 10)].push(c);
      return hs;
    },
    [[], [], [], []]
  ),
  nestCards: makeDeck().slice(40),
  trick: [],
  tricksTaken: [[], []],
  ledColor: null,
};
memory = freshOnlineX1(s);
const baseline = x1PlayInput(s, 1, memory);
assert.equal('partnerMask' in baseline, false);
assert.equal(baseline.nest, '0');
const changed = structuredClone(s);
[changed.hands[0], changed.hands[2]] = [changed.hands[2], changed.hands[0]];
changed.nestCards.reverse();
assert.deepEqual(x1PlayInput(changed, 1, memory), baseline, 'Hidden state changed X1 input/seed');
const poisoned = structuredClone(s);
for (const seat of [0, 2, 3])
  Object.defineProperty(poisoned.hands, seat, {
    get() {
      throw Error('READ_OTHER_HAND');
    },
  });
Object.defineProperty(poisoned, 'nestCards', {
  get() {
    throw Error('READ_NON_BIDDER_NEST');
  },
});
assert.deepEqual(x1PlayInput(poisoned, 1, memory), baseline);
const before = performance.now();
const first = chooseOnlineBotAction({ gameState: poisoned, x1: memory }, 1);
assert.equal(first.engine, 'x1');
assert(
  canPlay(
    s.hands[1].find((c) => c.id === first.action.cardId),
    s.hands[1],
    null,
    'green',
    s.settings.rules
  )
);
const second = chooseOnlineBotAction({ gameState: changed, x1: structuredClone(memory) }, 1);
assert.deepEqual(second.action, first.action, 'Hidden deal changed public/own-only decision');
const bidder = x1PlayInput(s, 0, memory);
assert.notEqual(bidder.nest, '0');
assert.equal('partnerMask' in bidder, false);
const variant = structuredClone(s);
for (const minBid of [5, 65, 205]) {
  const custom = structuredClone(state);
  custom.settings.minBid = minBid;
  assert.equal(chooseOnlineBotAction({gameState: custom, x1: freshOnlineX1(custom)}, custom.currentPlayer).reason, 'unsupported-rules');
}
variant.settings.rules.includeRed2 = false;
assert.equal(
  chooseOnlineBotAction({ gameState: variant, x1: memory }, 1).reason,
  'unsupported-rules'
);
assert.equal(chooseOnlineBotAction({ gameState: s }, 1).reason, 'existing-hand');
const moon = { ...s, shotTheMoon: true };
assert.equal(chooseOnlineBotAction({ gameState: moon, x1: memory }, 1).reason, 'moon-contract');
// Inferred void information and auction history follow confirmed transitions only.
const bidResult = { accepted: true, state: { ...state, highestBid: 100 } };
observeOnlineX1(room, state, bidResult);
assert.deepEqual(memory.history, []);
assert.deepEqual(room.x1.history, [[own, 100]]);
const lead = {
  ...s,
  currentPlayer: 2,
  ledColor: 'green',
  trick: [{ player: 0, card: s.hands[0][0] }],
};
const action = { action: { type: 'play', cardId: lead.hands[2][0].id }, engine: 'x1', ms: 1 };
const result = playCard(lead, 2, action.action.cardId);
assert(result.accepted);
observeOnlineX1({ gameState: lead, x1: memory }, lead, result, action);
assert(memory.voids[2] & 1);
const proof = onlineX1Proof({ x1: memory });
assert.equal(proof.partnerAssist, false);
for (const key of [
  'h',
  'hands',
  'nest',
  'nestCards',
  'plan',
  'history',
  'voids',
  'seed',
  'partnerMask',
])
  assert.equal(key in proof, false);
// Invalid engine output cannot bypass the authoritative reducer guard.
const choose = ONLINE_X1.core.choose;
try {
  ONLINE_X1.core.choose = () => ({ card: -3 });
  const fallback = chooseOnlineBotAction({ gameState: s, x1: freshOnlineX1(s) }, 1);
  assert.equal(fallback.engine, 'sol7');
  assert(fallback.action.cardId);
} finally {
  ONLINE_X1.core.choose = choose;
}
console.log(
  JSON.stringify({
    pass: true,
    privacy:
      'poisoned private-hand getters; hidden-deal invariance; no partner input; non-bidder nest withheld',
    deterministicReplay: true,
    unsupportedAndMoonFallback: true,
    authoritativeVoidHistory: true,
    ms: Math.round(performance.now() - before),
  })
);

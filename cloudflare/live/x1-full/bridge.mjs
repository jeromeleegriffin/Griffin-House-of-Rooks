// Online X1 uses own/public input; sole-human partner assistance is explicitly gated.
const ONLINE_X1_VERSION = 'x1-online-v2';
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
function x1PlayInput(state, seat, memory, partner = null) {
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
  const privilege = partner === null ? {} : {partnerMask:String(C.mask(state.hands[partner].map(x1CardId)))};
  return {
    ...privilege,
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
        (action.value % 5 === 0 && action.value >= state.highestBid + 5 && action.value <= makeDeck(state.settings.rules).reduce((n,c)=>n+cardPoints(c,state.settings.rules),0)))
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
function choosePreviousOnlineBotAction(room, seat) {
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
    if (card && !(before.settings.rules.specialsAnytime && isSpecialCard(card,before.settings.rules)) && !followsLedSuit(card, before.ledColor, before.trump, before.settings.rules))
      memory.voids[seat] |= 1 << COLORS.indexOf(before.ledColor);
  }
  if (!decision) return;
  memory.decisions[decision.action.type]++;
  memory.lastEngine = decision.engine;
  memory.lastPartnerAssist = !!decision.partnerAssist;
  memory.partnerDecisions = (memory.partnerDecisions || 0) + Number(!!decision.partnerAssist);
  memory.ruleDecisions = (memory.ruleDecisions || 0) + Number(decision.engine === "x1-rules");
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
    partnerAssist: !!m?.lastPartnerAssist,
    partnerDecisions: m?.partnerDecisions || 0,
    ruleDecisions: m?.ruleDecisions || 0,
    handEngineVersion: m?.version || "legacy",
  };
}

function chooseOnlineBotAction(room,seat) {
 const s=room.gameState,m=room.x1;
 if(!m||m.hand!==s.handNumber||m.version!==ONLINE_X1_VERSION)return choosePreviousOnlineBotAction(room,seat);
 const partner=x1EligiblePartner(room,seat),started=performance.now();
 try {
  let d;
  if(!x1Compatible(s)||s.shotTheMoon)d=chooseExtendedX1(room,seat,partner);
  else {
   d=choosePreviousOnlineBotAction(room,seat);
   if(d.engine!=="x1")return d;
   if(s.phase==='bidding') {
    if(partner!==null&&s.bidder===partner){const v=x1BidInput(s,seat,m),ask=v.high+5,cap=ONLINE_X1.core.ceiling(v.h,{seat,high:v.high,history:v.history,scores:v.scores});if(cap>=ask){const p=ONLINE_X1.bidding.decide(v);if(![0,ask].includes(p.bid))throw Error('X1_BAD_TAKEOVER');d.action={type:'bid',value:p.bid};}}
    if(s.settings.shootMoonEnabled){const v=x1ExtendedView(s,seat,m,partner),power=Math.max(...Array.from({length:4},(_,tr)=>X1_RULES.plan({...v,tr},0,false).score));if(power>=90||d.action.value===200){const p=X1_RULES.bid(v,[d.action.value===200?0:d.action.value,200]);d.action={type:'bid',value:p.bid};}}
   }
   if(s.phase==='play'&&partner!==null){const v=x1PlayInput(s,seat,m,partner),p=ONLINE_X1.core.choose(v);const card=s.hands[seat].find(c=>x1CardId(c)===p.card);if(!card)throw Error('X1_PARTNER_SAMPLE');d.action={type:'play',cardId:card.id};}
   d.partnerAssist=partner!==null;
  }
  if(s.phase==='play'&&!s.shotTheMoon){const card=x1AnchorRoute(s,seat,partner);if(card)d.action={type:'play',cardId:card.id};}
  if(!x1ActionLegal(s,seat,d.action))throw Error('X1_RULE_ACTION_ILLEGAL');
  return {...d,ms:Math.round((performance.now()-started)*100)/100};
 }catch(e){return {action:chooseTestBotAction(s,seat),engine:'legacy',reason:'x1-extension-error:'+e.message,partnerAssist:false};}
}

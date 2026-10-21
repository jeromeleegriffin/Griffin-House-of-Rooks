// Detached rule-aware X1 view; no live opposing hand crosses this boundary.
function x1EligiblePartner(room, seat) {
  const s=room.gameState,p=s.players,roster=room.seats;
  if(!['bidding','discard','trump','play'].includes(s.phase)||s.paused||!Array.isArray(p)||p.length!==4||!Array.isArray(roster)||roster.length!==4)return null;
  if(p.some((a,i)=>!a||a.seat!==i||a.team!==i%2||typeof a.isBot!=='boolean'||!a.playerId||!roster[i]||roster[i].playerId!==a.playerId||!!roster[i].isBot!==a.isBot))return null;
  if(new Set(p.map(a=>a.playerId)).size!==4||p.filter(a=>!a.isBot).length!==1)return null;
  const partner=(seat+2)%4;
  return p[seat]?.isBot&&!p[partner].isBot?partner:null;
}
function x1ExtendedView(state, seat, memory, partner=null) {
  const deck=makeDeck(state.settings.rules),ids=new Map(deck.map((c,i)=>[c.id,i]));
  const index=c=>{const n=ids.get(c.id);if(n===undefined)throw Error('X1_UNKNOWN_CARD');return n;};
  const cards=deck.map(c=>({id:c.id,color:COLORS.indexOf(c.color),rank:effectiveRank(c,state.settings.rules),points:cardPoints(c,state.settings.rules),special:isPermanentTrump(c,state.settings.rules)}));
  const played=[...state.tricksTaken[0],...state.tricksTaken[1],...state.trick.map(p=>p.card)].map(index);
  const tc=state.trick.map(p=>index(p.card)),ts=state.trick.map(p=>p.player),completed=(played.length-tc.length)/4;
  const lengths=Array(4).fill(state.settings.handSize-completed);for(const s of ts)lengths[s]--;
  const knownNest=seat===state.bidder&&state.phase==='play'?(state.nestCards||[]).map(index):[];
  const v={cards,h:state.hands[seat].map(index),seat,tr:COLORS.indexOf(state.trump),tc,ts,played,nest:knownNest,
    hiddenNest:state.phase==='play'&&seat!==state.bidder?deck.length-4*state.settings.handSize:0,
    lengths,voids:memory.voids.slice(),points:state.tricksTaken.map(a=>a.reduce((n,c)=>n+cardPoints(c,state.settings.rules),0)),
    settings:{handSize:state.settings.handSize,nestGoesTo:state.settings.nestGoesTo,leadOrder:state.settings.leadOrder,bidOnlyScoring:state.settings.bidOnlyScoring,sandbagging:state.settings.sandbagging,screwTheDealer:state.settings.screwTheDealer,minBid:state.settings.minBid,targetScore:state.settings.targetScore,shootMoonEnabled:state.settings.shootMoonEnabled,rules:{...state.settings.rules}},
    sandbagOverpoints:state.sandbagOverpoints.slice(),scores:state.scores.slice(),bidder:state.bidder,bid:state.bid,moon:!!state.shotTheMoon,
    dealer:state.dealer,high:state.highestBid,passed:state.bidStatus.map(b=>b==='pass'),history:memory.history.map(r=>r.slice()),
    publicWidow:state.settings.openWidow?(state.widowSpread||[]).map(index):[],
    revealed:state.phase==='bidding'&&state.settings.revealTopNest&&state.topNestCard?index(state.topNestCard):null};
  if(partner!==null){v.partner=partner;v.partnerHand=state.hands[partner].map(index);}
  return v;
}
function chooseExtendedX1(room,seat,partner) {
  const s=room.gameState,m=room.x1,v=x1ExtendedView(s,seat,m,partner);let action,plan=null,samples=0;
  if(s.phase==='bidding'){const d=X1_RULES.bid(v);action={type:'bid',value:d.bid};samples=d.samples;}
  else if(s.phase==='discard'){const p=X1_RULES.plan(v,s.discardCount);plan={seat,trump:p.tr,keep:p.keep,extended:true};const keep=new Set(p.keep.map(i=>v.cards[i].id));action={type:'discard',cardIds:s.hands[seat].filter(c=>!keep.has(c.id)).map(c=>c.id)};samples=128;}
  else if(s.phase==='trump'){const tr=m.plan?.seat===seat?m.plan.trump:X1_RULES.plan(v,0,false).tr;action={type:'trump',color:COLORS[tr]};}
  else if(s.phase==='play'){const d=X1_RULES.choose(v);action={type:'play',cardId:v.cards[d.card].id};samples=d.samples;}
  else throw Error('X1_UNSUPPORTED_PHASE');
  return {action,plan,engine:'x1-rules',reason:null,partnerAssist:partner!==null,samples};
}
// Preserve the approved Anchor partner-first route, restricted to sole-human play.
function x1AnchorRoute(state,seat,partner) {
  const actor=state.players[seat];
  if(partner===null||!(actor.avatar==='anchor'||actor.name==='Anchor'||(actor.name==='Rita'&&actor.avatar==='rita')))return null;
  const r=state.settings.rules,trump=state.trump,hand=state.hands[partner],legal=state.hands[seat].filter(c=>canPlay(c,state.hands[seat],state.ledColor,trump,r));
  const rank=c=>effectiveRank(c,r),points=c=>cardPoints(c,r),permanent=c=>isPermanentTrump(c,r),isTrump=c=>isTrumpCard(c,trump,r);
  const cheap=a=>a.slice().sort((a,b)=>rank(a)-rank(b))[0],pointy=a=>a.slice().sort((a,b)=>points(b)-points(a)||rank(b)-rank(a))[0];
  const team=seat%2,bidTeam=state.bidder%2,captured=state.tricksTaken.map(a=>a.reduce((n,c)=>n+points(c),0)),protecting=bidTeam===team&&captured[team]<state.bid,setting=bidTeam!==team&&captured[bidTeam]<state.bid,partnerTrump=hand.filter(isTrump);
  if(!state.ledColor){
    for(const col of COLORS.filter(col=>col!==trump&&!hand.some(c=>c.color===col&&!permanent(c)))){const a=legal.filter(c=>c.color===col&&!permanent(c));if(a.length)return cheap(a);}
    if(partnerTrump.length<=2&&protecting){const a=legal.filter(c=>!isTrump(c)&&points(c)===0);if(a.length)return cheap(a);}
    if(setting&&partnerTrump.some(c=>permanent(c)||rank(c)>=14)){const a=legal.filter(c=>!isTrump(c));if(a.length)return cheap(a);}return null;
  }
  let winner=state.trick[0];for(const p of state.trick.slice(1))if(compareCards(p.card,winner.card,state.ledColor,trump,r)>0)winner=p;
  const pts=state.trick.reduce((n,p)=>n+points(p.card),0);
  if(winner?.player===partner&&pts>0){const a=legal.filter(c=>points(c)>0&&!permanent(c));if(a.length)return pointy(a);const zero=legal.filter(c=>points(c)===0&&!permanent(c));if(zero.length)return cheap(zero);}
  if(winner&&winner.player%2!==team&&pts>=5&&setting){const a=legal.filter(c=>compareCards(c,winner.card,state.ledColor,trump,r)>0);if(a.length)return a.slice().sort((a,b)=>(permanent(a)?100:0)-(permanent(b)?100:0)||rank(a)-rank(b))[0];}
  if(protecting&&partnerTrump.length<=2&&pts<10){const a=legal.filter(c=>!permanent(c)&&points(c)===0);if(a.length)return cheap(a);}return null;
}

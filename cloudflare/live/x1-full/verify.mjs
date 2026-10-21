import assert from 'node:assert/strict';
import fs from 'node:fs';
import {api,players} from './test-harness.mjs';
const {X1_RULES,createMatch,submitBid,discardCards,chooseTrump,playCard,freshOnlineX1,x1ExtendedView,x1EligiblePartner,chooseOnlineBotAction,observeOnlineX1,makeDeck,canPlay,compareCards,cardPoints,finishHand}=api;
const reports={ruleConfigurations:0,legalComparisons:0,rankingComparisons:0,scoreComparisons:0,hands:[],privacy:0};
function roomFor(s){return {gameState:s,x1:freshOnlineX1(s),seats:s.players.map(p=>({playerId:p.playerId,isBot:p.isBot}))};}
function ready(options={},bid=100){let s=createMatch(players,{misdealOnNoCounters:false,minBid:Math.min(100,bid),...options},{dealer:3});const seat=s.currentPlayer;s=submitBid(s,seat,bid).state;while(s.phase==='bidding')s=submitBid(s,s.currentPlayer,0).state;s=discardCards(s,s.bidder,s.hands[s.bidder].slice(0,s.discardCount).map(c=>c.id)).state;return chooseTrump(s,s.bidder,'green').state;}
// Pair every relevant rule behavior against the authoritative reducer helpers.
for(let mask=0;mask<256;mask++){
 const options={includeOnes:!!(mask&1),onesHigh:!!(mask&2),includeRed2:!!(mask&4),includeRed1:!!(mask&8),includeRook:!!(mask&16),rookLowest:!!(mask&32),specialsAnytime:!!(mask&64),mustTrumpWhenVoid:!!(mask&128),red2Points:mask%3===0?10:20};
 const s=ready(options,70),room=roomFor(s),v=x1ExtendedView(s,s.currentPlayer,room.x1),R=X1_RULES.rules(v),deck=makeDeck(s.settings.rules);
 for(let led=0;led<4;led++){
  const first=deck.findIndex(c=>!c.specialRed1&&c.color===['green','red','yellow','black'][led]&&c.rank===5);
  const own=deck.filter((_,i)=>i%3===0).map(c=>v.cards.findIndex(d=>d.id===c.id));
  assert.deepEqual(R.legal(own,[first]).sort((a,b)=>a-b),own.filter(i=>canPlay(deck[i],own.map(j=>deck[j]),['green','red','yellow','black'][led],'green',s.settings.rules)).sort((a,b)=>a-b));reports.legalComparisons++;
  for(let a=0;a<deck.length;a++)for(let b=0;b<deck.length;b++)if(a!==b){assert.equal(R.beats(a,b,led),compareCards(deck[a],deck[b],['green','red','yellow','black'][led],'green',s.settings.rules)>0);reports.rankingComparisons++;}
 }
 reports.ruleConfigurations++;
}
// Compare scoring utility to final reducer outcomes, including negative-score Moon.
for(const moon of [false,true])for(const bidOnly of [false,true])for(const nestTo of ['lastTrick','bidder'])for(const sandbag of [false,true])for(const scores of [[0,0],[-120,450]])for(const cut of [0,4,20,40]){
 const s=ready({targetScore:500,bidOnlyScoring:bidOnly,nestGoesTo:nestTo,sandbagging:sandbag},moon?200:100),deck=makeDeck(s.settings.rules);s.scores=scores.slice();s.sandbagOverpoints=[90,90];s.shotTheMoon=moon;s.bid=moon?200:100;s.nestCards=deck.slice(40);s.tricksTaken=[deck.slice(0,cut),deck.slice(cut,40)];s.hands=[[],[],[],[]];
 const done=finishHand(s,1),points=[done.lastSummary.pointsA,done.lastSummary.pointsB],v=x1ExtendedView(s,0,freshOnlineX1(s));const actual=done.matchResult?done.matchResult==='Tie'?0:done.matchResult==='Team A'?10000:-10000:Math.max(-9999,Math.min(9999,done.scores[0]-done.scores[1]));assert.equal(X1_RULES.utility(v,points),actual);reports.scoreComparisons++;
}
const cases=[{}, {includeRed2:false}, {includeOnes:false,includeRed2:false,includeRook:false}, {onesHigh:false,rookLowest:true}, {includeRed1:true,red2Points:10}, {specialsAnytime:true,mustTrumpWhenVoid:true}, {nestGoesTo:'bidder',bidOnlyScoring:true}, {openWidow:true}, {handSize:9,minBid:70}];
for(const options of cases)for(const moon of [false,true]){
 let s=ready({...options,shootMoonEnabled:moon},moon?makeDeck(api.normalizeOptions(options).rules).reduce((n,c)=>n+cardPoints(c,api.normalizeOptions(options).rules),0):100),room=roomFor(s),actions=0,maxMs=0;
 while(s.phase==='play'){
  const seat=s.currentPlayer,now=performance.now(),d=chooseOnlineBotAction(room,seat);maxMs=Math.max(maxMs,performance.now()-now);
  assert(['x1','x1-rules'].includes(d.engine),JSON.stringify({options,moon,reason:d.reason}));
  const next=playCard(s,seat,d.action.cardId);assert(next.accepted,next.reason);observeOnlineX1(room,s,next,d);s=next.state;room.gameState=s;actions++;assert(actions<=s.settings.handSize*4);
 }
 assert(['score','complete'].includes(s.phase));assert.equal(room.x1.fallbacks,0);reports.hands.push({options,moon,actions,maxMs:Math.round(maxMs),scores:s.scores});
}
// Exercise the expanded bidding, discard and trump paths directly.
for(const options of [{includeRed2:false},{includeRed1:true},{specialsAnytime:true,mustTrumpWhenVoid:true},{}]){
 let s=createMatch(players,{misdealOnNoCounters:false,...options},{dealer:0}),room=roomFor(s);
 let d=chooseOnlineBotAction(room,1);assert.notEqual(d.engine,'legacy',d.reason);assert(submitBid(s,1,d.action.value).accepted);
 const total=makeDeck(s.settings.rules).reduce((n,c)=>n+cardPoints(c,s.settings.rules),0);
 s=submitBid(s,1,total).state;room.gameState=s;
 d=chooseOnlineBotAction(room,1);assert.equal(d.engine,'x1-rules',d.reason);let next=discardCards(s,1,d.action.cardIds);assert(next.accepted);observeOnlineX1(room,s,next,d);s=next.state;room.gameState=s;
 d=chooseOnlineBotAction(room,1);next=chooseTrump(s,1,d.action.color);assert(next.accepted);assert.equal(d.engine,'x1-rules',d.reason);
}
// A hand of ten controlling trumps must recognize a makeable Moon even below zero.
for(const scores of [[0,0],[100,-250]]){
 const s=createMatch(players,{misdealOnNoCounters:false},{dealer:0}),room=roomFor(s),deck=makeDeck(s.settings.rules);
 const own=deck.filter(c=>c.id==='rook'||c.id==='red-2'||c.color==='green'&&(c.rank===1||c.rank>=8));assert.equal(own.length,10);
 s.hands[1]=own;s.scores=scores;
 const v=x1ExtendedView(s,1,room.x1),d=X1_RULES.bid(v,[100,200]);assert.equal(d.bid,200,JSON.stringify({scores,d}));
}
// Private-hand invariance and permitted sole-human assistance boundaries.
for(const options of [{includeRed2:false},{specialsAnytime:true},{shootMoonEnabled:true}]){
 let s=ready(options,options.shootMoonEnabled?200:100);s.currentPlayer=1;s.trick=[];s.ledColor=null;const room=roomFor(s),normal=x1ExtendedView(s,1,room.x1);
 const hidden=structuredClone(s);for(const seat of [0,2,3])Object.defineProperty(hidden.hands,seat,{get(){throw Error('PRIVATE_HAND_READ');}});Object.defineProperty(hidden,'nestCards',{get(){throw Error('PRIVATE_NEST_READ');}});
 assert.deepEqual(x1ExtendedView(hidden,1,room.x1),normal);const guarded={...room,gameState:hidden};const decision=chooseOnlineBotAction(guarded,1);assert.notEqual(decision.engine,'legacy',decision.reason);assert.deepEqual(decision.action,chooseOnlineBotAction(room,1).action);assert.equal(x1EligiblePartner(room,2),0);assert.equal(x1EligiblePartner(room,1),null);
 const one=x1ExtendedView(s,2,room.x1,0);assert.equal(one.partner,0);assert.deepEqual(one.partnerHand,s.hands[0].map(c=>one.cards.findIndex(d=>d.id===c.id)));
 room.seats[1].isBot=false;room.gameState.players[1].isBot=false;assert.equal(x1EligiblePartner(room,2),null);reports.privacy++;
}
// Approved Anchor route: feed the sole-human partner's void, never another hand.
{
 const s=ready({shootMoonEnabled:false}),room=roomFor(s),deck=makeDeck(s.settings.rules),card=id=>deck.find(c=>c.id===id);
 s.currentPlayer=2;s.bidder=2;s.bid=100;s.players[2].avatar='anchor';s.players[2].name='Anchor';s.hands[2]=[card('red-5'),card('green-14')];s.hands[0]=[card('green-1')];
 for(const seat of [1,3])Object.defineProperty(s.hands,seat,{get(){throw Error('ANCHOR_OPPONENT_READ');}});
 assert.equal(x1EligiblePartner(room,2),0);assert.equal(api.x1AnchorRoute(s,2,0).id,'red-5');assert.equal(api.x1AnchorRoute(s,2,null),null);
}
fs.mkdirSync(new URL('./tests/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./tests/verification.json',import.meta.url),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));

/* Frozen X1 / Sol 7 card play; owner-authorized X1 bid-jump evaluation. Sole-offline-human EPA stays at the detached worker boundary. */
(function(){'use strict';
if(typeof X1Core==='undefined'){let selected='x1';try{if((localStorage.getItem('horMainIntelligence')??localStorage.getItem('horMainIntelligenceX1Experiment'))==='sol7')selected='sol7';}catch(e){}const why='Champion core failed to load; using House legacy intelligence';console.error('[Main intelligence fallback]',why);window.HORX1Integration={status:()=>({requested:selected,active:'legacy',reason:why,initializationError:why,lastDecision:null,epa:false,ready:false,hand:0,pending:false}),metrics:{decisions:[],fallbacks:[{engine:'legacy',reason:why}]}};const show=()=>{const s=document.getElementById('x1MainSelector'),t=document.getElementById('x1MainStatus');if(s)s.disabled=true;if(t)t.textContent='Selected: '+selected+' · '+why+' · Partner Assist: unavailable';};show();document.addEventListener('DOMContentLoaded',show);return;}
const C=X1Core,key='horMainIntelligence',original={bid:botBid,discard:botDiscard,trump:botChooseTrump,play:botPlay};
let requested='x1';try{let saved=localStorage.getItem(key);if(saved===null)saved=localStorage.getItem('horMainIntelligenceX1Experiment');if(saved==='sol7')requested='sol7';}catch(e){}
let active=requested,epoch=0,seq=0,pending=null,worker=null,ready=false,reason='',history=[],plannedTrump=null,strategyOrder=null,initError='',lastDecision=null;
const metrics={bids:[],decisions:[],fallbacks:[],engines:[],source:'f1650289373b82ffbc04a610a5dad94a9572a1a0a9781d28d29e5e9d606f77c6'};
// Return only a seat entitlement. Never pass the game/hands object to the worker.
function eligiblePartner(seat,phase="play"){
 try{
  if(active!=='x1'||!isHost||isSoloPractice!==true||roomCode!=='OFFLINE'||hostConnection||Object.keys(connMap||{}).length||!game||game.phase!==phase||game.paused)return null;
  const ps=game.players;if(!Array.isArray(ps)||ps.length!==4||!Array.isArray(players)||players.length!==4)return null;
  if(ps.some((p,i)=>!p||p.seat!==i||p.team!==i%2||!p.id||typeof p.isBot!=='boolean'))return null;
  if(new Set(ps.map(p=>p.id)).size!==4||ps.filter(p=>!p.isBot).length!==1||ps.filter(p=>p.isBot).length!==3)return null;
  if(ps.some(p=>{const q=players.find(q=>q&&q.id===p.id);return !q||q.seat!==p.seat||q.team!==p.team||q.isBot!==p.isBot;}))return null;
  const partner=(seat+2)%4;if(!ps[seat]?.isBot||ps[partner].isBot||ps[seat].team!==ps[partner].team)return null;
  if(!Array.isArray(game.hands?.[partner]))return null;
  return partner;
 }catch(_){return null;}
}

function anchorPartnerRoute(seat,legal){
 try{
  const actor=game?.players?.[seat];
  if(!actor?.isBot||!(actor.name==='Anchor'||(actor.name==='Rita'&&actor.avatar==='rita'))||actor.botStyle!=='partnerFirst')return null;
  const partner=eligiblePartner(seat,'play');
  if(partner===null||!Array.isArray(game.hands?.[partner])||game.currentPlayer!==seat||!legal?.length)return null;
  const partnerHand=game.hands[partner],trump=game.trump,myTeam=actor.team;
  const voids=COLORS.filter(col=>col!==trump&&!partnerHand.some(c=>c.color===col&&!isPermanentTrump(c)));
  const bidderTeam=game.bidder>=0?game.players[game.bidder]?.team:null;
  const bid=game.bid||game.highestBid||0;
  const protecting=bidderTeam===myTeam&&teamCapturedPoints(myTeam)<bid;
  const setting=bidderTeam!==null&&bidderTeam!==myTeam&&teamCapturedPoints(bidderTeam)<bid;
  const partnerTrump=partnerHand.filter(c=>isTrumpCard(c,trump));
  const cheap=arr=>arr.slice().sort((a,b)=>effectiveRank(a)-effectiveRank(b))[0]||null;
  const pointy=arr=>arr.slice().sort((a,b)=>cardPoints(b)-cardPoints(a)||effectiveRank(b)-effectiveRank(a))[0]||null;
  if(!game.ledColor){
   for(const col of voids){const g=legal.filter(c=>c.color===col&&!isPermanentTrump(c));if(g.length)return cheap(g);}
   if(partnerTrump.length<=2&&protecting){const g=legal.filter(c=>!isTrumpCard(c,trump)&&cardPoints(c)===0);if(g.length)return cheap(g);}
   if(setting&&partnerTrump.some(c=>isPermanentTrump(c)||effectiveRank(c)>=14)){const g=legal.filter(c=>!isTrumpCard(c,trump));if(g.length)return cheap(g);}
   return null;
  }
  const winner=currentTrickWinner(),pts=trickPointsSoFar();
  if(winner?.player===partner&&pts>0){const g=legal.filter(c=>cardPoints(c)>0&&!isPermanentTrump(c));if(g.length)return pointy(g);const zero=legal.filter(c=>cardPoints(c)===0&&!isPermanentTrump(c));if(zero.length)return cheap(zero);}
  if(winner&&game.players[winner.player]?.team!==myTeam&&pts>=5&&setting){const g=legal.filter(c=>compareCards(c,winner.card,game.ledColor,trump)>0);if(g.length)return g.slice().sort((a,b)=>(isPermanentTrump(a)?100:0)-(isPermanentTrump(b)?100:0)||effectiveRank(a)-effectiveRank(b))[0];}
  if(protecting&&partnerTrump.length<=2&&pts<10){const g=legal.filter(c=>!isPermanentTrump(c)&&cardPoints(c)===0);if(g.length)return cheap(g);}
 }catch(e){console.warn('[Partner route] X1 retained',e);}
 return null;
}
function authority(){return JSON.stringify({host:isHost,offline:isSoloPractice,room:roomCode,connected:!!hostConnection,peers:Object.keys(connMap||{}),active,paused:!!game?.paused,hand:game?.handNumber,players:(game?.players||[]).map(p=>[p.id,p.seat,p.team,p.isBot]),roster:(players||[]).map(p=>[p.id,p.seat,p.team,p.isBot])});}
const id=c=>{if(c.id==='rook')return 45;if(c.id==='red-2')return 44;let col=C.colors.indexOf(c.color),rank=Number(c.rank);if(col<0||c.id==='red1-special')throw Error('unsupported card');if(rank===1)return 40+col;if(rank<5||rank>14)throw Error('unsupported rank');return col*10+rank-5;};
function record(phase,engine=active){lastDecision={phase,engine,hand:epoch,seat:game&&(phase==='discard'||phase==='trump'?game.bidder:game.currentPlayer)};paint();}
function cancelPending(){epoch++;if(pending){let p=pending;pending=null;clearTimeout(p.timer);p.resolve({error:'stale action'});}}
function paint(){let select=document.getElementById('x1MainSelector'),status=document.getElementById('x1MainStatus');if(select)select.value=requested;if(status)status.textContent='Selected: '+(requested==='x1'?'X1 — New Champion':'Sol 7 — Original Champion')+' · Active: '+(active==='x1'?'X1':active==='sol7'?'Sol 7':'House legacy')+(requested!==active?' · '+(reason||'next hand'):'')+(reason?' · '+reason:'')+' · Worker: '+(ready?'ready':initError||'initializing')+' · Last decision: '+(lastDecision?lastDecision.engine+' / '+lastDecision.phase:'none yet')+' · Partner Assist: '+(eligiblePartner(game?.currentPlayer)!==null?'eligible X1 partner':'off for this seat');}
function logFallback(why,engine='sol7'){active=engine;reason=why;metrics.fallbacks.push({hand:epoch,engine,reason:why});console.error('[Main intelligence fallback]',why);paint();let el=document.getElementById('messageArea');if(el)el.textContent='Bot intelligence: '+(engine==='sol7'?'Sol 7':'House legacy')+' fallback — '+why;}
function init(){try{worker=new Worker('x1/worker.js');worker.onmessage=e=>{let r=e.data;if(r.ready){ready=true;paint();return;}if(!pending||r.id!==pending.id)return;let p=pending;pending=null;clearTimeout(p.timer);p.resolve(r);};worker.onerror=e=>{initError='X1 worker initialization/execution failed';ready=false;if(pending){let p=pending;pending=null;clearTimeout(p.timer);p.resolve({error:initError});}if(active==='x1')logFallback(initError);};}catch(e){initError='X1 worker unavailable: '+e.message;active='sol7';reason=initError;metrics.fallbacks.push({hand:epoch,engine:'sol7',reason:initError});}}
function compatible(){try{return handSize===10&&includeOnes&&onesHigh&&includeRed2&&includeRook&&!includeRed1&&!rookLowest&&Number(red2Points)===20&&nestGoesTo==='lastTrick'&&!specialsAnytime&&!mustTrumpWhenVoid&&!bidOnlyScoring&&Number(minBid)>=70&&Number(minBid)<=200&&Number(minBid)%5===0&&makeDeck().length===46;}catch(e){return false;}}
function boundary(){epoch++;history=[];plannedTrump=null;strategyOrder=null;if(pending){let p=pending;pending=null;clearTimeout(p.timer);p.resolve({error:'stale hand'});}active=requested;reason='';if(!compatible())logFallback('Frozen champions require the standard 46-card rules','legacy');else if(active==='x1'&&initError)logFallback(initError);metrics.engines.push({hand:epoch,active,requested});paint();}
const deal=hostDealNow;hostDealNow=function(){boundary();return deal.apply(this,arguments);};
const processBid=hostProcessBid;hostProcessBid=function(data){let phase=game&&game.phase,actor=game&&game.currentPlayer,high=game&&game.highestBid;let r=processBid.apply(this,arguments);if(phase==='bidding'&&data&&data.player===actor&&data.value>high&&game&&game.highestBid===data.value)history.push([data.player,data.value]);return r;};
function hand(seat){let actual=game.hands[seat];if(seat===game.bidder&&strategyOrder){let map=new Map(actual.map(c=>[id(c),c]));return strategyOrder.filter(x=>map.has(x)).map(x=>map.get(x));}return actual;}
function view(seat){let h=hand(seat).map(id),tc=game.trick.map(t=>id(t.card)),ts=game.trick.map(t=>t.player),tr=C.colors.indexOf(game.trump),playedCards=[...(game.tricksTaken[0]||[]),...(game.tricksTaken[1]||[]),...game.trick.map(t=>t.card)],played=C.mask(playedCards.map(id)),nest=seat===game.bidder?C.mask((game.nestCards||[]).map(id)):0n,voids=knownVoids.map(v=>C.colors.reduce((m,c,i)=>m|(v[c]?1<<i:0),0)),points=[teamCapturedPoints(0),teamCapturedPoints(1)];
 let v={h,tc,ts,tr,seat,bidder:game.bidder,bid:game.bid,points,played:String(played),nest:String(nest),voids};
 const partner=eligiblePartner(seat);if(partner!==null)v.partnerMask=String(C.mask(game.hands[partner].map(id)));
 // Match Python's exact JSON representation of public/own masks; no lossy Number conversion.
 let payload='['+[JSON.stringify(h),JSON.stringify(tc),JSON.stringify(ts),JSON.stringify(game.trump),seat,game.bidder,game.bid,JSON.stringify(points),String(played),String(nest),JSON.stringify(voids)].join(',')+']';return{v,payload};}
function contractGuard(){if(active!=='legacy'&&game&&game.shotTheMoon)logFallback('Instant-win moon is outside the frozen championship contract rules','legacy');}
function solPlay(){let seat=game.currentPlayer,{v}=view(seat),c=C.solmove(v.h,{c:v.tc,s:v.ts},v.tr,BigInt(v.played),BigInt(v.nest),seat),card=game.hands[seat].find(x=>id(x)===c);if(!card||!canPlay(card,game.hands[seat],game.ledColor,game.trump))throw Error('Sol7 legality validation failed');record('play','sol7');hostProcessPlay({player:seat,cardId:card.id});}
function bidView(seat){return {h:hand(seat).map(id),seat,dealer:game.dealer,high:game.highestBid,bidder:game.bidder,history:history.map(x=>x.slice()),scores:game.scores.slice(),passed:[0,1,2,3].map(s=>hasPassedBid(s)),limit:maxBid(),target:Number(game.targetScore||targetScore||500),revealed:revealTopNest&&game.nestAuctionOpen&&game.topNestCard?id(game.topNestCard):null,moon:!!shootMoonEnabled};}
function submitBid(seat,bid,detail){const ask=game.highestBid+5,limit=typeof bidCeilingFor==='function'?bidCeilingFor(seat):maxBid();if(bid!==0&&(!Number.isSafeInteger(bid)||bid%5!==0||bid<ask||bid>limit||(isShootMoonBid(bid)&&!moonBidAllowed(seat))))bid=0;record('bid');lastDecision.smart=!!detail;lastDecision.bidding=detail?.reason||'original';if(detail){metrics.bids.push({seat,hand:epoch,...detail,bid});if(metrics.bids.length>1000)metrics.bids.shift();}hostProcessBid({player:seat,value:bid});}
botBid=function(){if(!isHost||!game||game.paused||game.phase!=='bidding')return;if(active==='legacy'){record('bid');return original.bid();}if(nestAuctionLocked()||pending)return;
 const seat=game.currentPlayer,cap=C.ceiling(hand(seat).map(id),{seat,high:game.highestBid,history,scores:game.scores}),ask=game.highestBid+5,baseline=cap>=ask?ask:0;
 // Preserve partner takeover policy; evaluate pressure jumps against opponents only.
 const partnerDecision=eligiblePartner(seat,'bidding')!==null&&game.bidder===(seat+2)%4;
 const jumpDecision=active==='x1'&&game.bidder>=0&&game.bidder%2!==seat%2&&cap>=ask+15;
 if((!partnerDecision&&!jumpDecision)||!baseline)return submitBid(seat,baseline,null);
 const g=game,handEpoch=epoch,v=bidView(seat),fingerprint=JSON.stringify(v),entitlement=authority(),request=++seq;
 const response=new Promise(resolve=>{pending={id:request,resolve,timer:setTimeout(()=>{if(!pending||pending.id!==request)return;pending=null;resolve({error:'smart bidding worker timeout'});},15000)};try{if(!worker)throw Error('X1 worker unavailable');worker.postMessage({id:request,type:partnerDecision?'bid':'bidJump',v});}catch(e){const p=pending;pending=null;clearTimeout(p.timer);resolve({error:String(e)});}});
 response.then(r=>{if(!isHost||epoch!==handEpoch||game!==g||!game||game.phase!=='bidding'||game.currentPlayer!==seat)return;if(game.paused||JSON.stringify(bidView(seat))!==fingerprint||authority()!==entitlement){scheduleBot();return;}
 if(r.error||!r.result||!(partnerDecision?[0,ask].includes(r.result.bid):Number.isSafeInteger(r.result.bid)&&r.result.bid%5===0&&r.result.bid>=ask&&r.result.bid<=Math.min(cap-10,maxBid(),195)&&r.result.bid<=game.highestBid+25)){const why=r.error||'invalid smart bid response';console.error('[X1 bidding fallback]',why);metrics.fallbacks.push({hand:epoch,engine:'original X1 bidding',reason:why});return submitBid(seat,baseline,{reason:'original bidding fallback',error:why});}
 submitBid(seat,r.result.bid,{...r.result,ms:r.ms});
 }).catch(e=>{console.error('[X1 bidding]',e);if(game===g&&epoch===handEpoch&&game.phase==='bidding'&&game.currentPlayer===seat)submitBid(seat,baseline,{reason:'original bidding fallback',error:String(e)});});};
botDiscard=function(){if(!isHost||!game||game.paused||game.phase!=='discard')return;contractGuard();record('discard');if(active==='legacy')return original.discard();let h=game.hands[game.bidder],ids=h.map(id);plannedTrump=C.trump(ids);strategyOrder=C.discard(ids,game.discardCount,plannedTrump);let keep=new Set(strategyOrder);hostProcessDiscard({player:game.bidder,cardIds:h.filter(c=>!keep.has(id(c))).map(c=>c.id)});};
botChooseTrump=function(){if(!isHost||!game||game.paused||game.phase!=='trump')return;record('trump');if(active==='legacy')return original.trump();let tr=plannedTrump??C.trump(game.hands[game.bidder].map(id));hostProcessTrump({player:game.bidder,color:C.colors[tr]});};
botPlay=function(){if(!isHost||!game||game.paused||game.phase!=='play'||game.resolvingTrick||game.claimAnimating)return;contractGuard();if(active==='legacy'){record('play');return original.play();}if(pending)return;if(active==='sol7')return solPlay();let seat=game.currentPlayer,g=game,handEpoch=epoch,{v,payload}=view(seat),fingerprint=JSON.stringify(v),entitlement=authority(),request=++seq;
 let response=new Promise(resolve=>{pending={id:request,resolve,timer:setTimeout(()=>{if(!pending||pending.id!==request)return;pending=null;initError='X1 worker did not respond within 60 seconds';ready=false;if(worker)worker.terminate();worker=null;resolve({error:initError});},60000)};try{if(!worker)throw Error(initError||'worker unavailable');worker.postMessage({id:request,v,payload});}catch(e){let p=pending;pending=null;clearTimeout(p.timer);resolve({error:String(e)});}});
 response.then(r=>{if(!isHost||epoch!==handEpoch||game!==g||!game||game.phase!=='play'||game.currentPlayer!==seat)return;let current=view(seat);if(JSON.stringify(current.v)!==fingerprint||authority()!==entitlement){scheduleBot();return;}if(game.paused){scheduleBot();return;}if(r.error||r.card<0){logFallback(r.error||'X1 sampling failure '+r.card);solPlay();return;}let card=game.hands[seat].find(c=>id(c)===r.card);if(!card||!canPlay(card,game.hands[seat],game.ledColor,game.trump)){logFallback('X1 returned an illegal card');solPlay();return;}metrics.decisions.push({hand:epoch,seat,ms:r.ms,seed:r.seed,card:r.card,search:r.out,epa:Object.prototype.hasOwnProperty.call(v,'partnerMask')});if(metrics.decisions.length>2000)metrics.decisions.shift();if(game.paused){scheduleBot();return;}const legal=game.hands[seat].filter(c=>canPlay(c,game.hands[seat],game.ledColor,game.trump));const routed=anchorPartnerRoute(seat,legal);if(routed&&legal.some(c=>c.id===routed.id))card=routed;record('play','x1');lastDecision.epa=Object.prototype.hasOwnProperty.call(v,'partnerMask');lastDecision.partnerRoute=!!routed;hostProcessPlay({player:seat,cardId:card.id});}).catch(e=>{logFallback(String(e));if(isHost&&game===g&&epoch===handEpoch&&game.phase==='play'&&game.currentPlayer===seat)solPlay();});};
function bind(){let s=document.getElementById('x1MainSelector');if(s&&!s.__x1){s.__x1=true;s.addEventListener('change',()=>{if(!horDeveloperToolsEnabled()||!isHost){paint();return;}requested=s.value==='sol7'?'sol7':'x1';try{localStorage.setItem(key,requested);}catch(e){}paint();});}paint();}
const play=hostProcessPlay;hostProcessPlay=function(){const g=game,count=g?.hands?.reduce((n,h)=>n+h.length,0);const r=play.apply(this,arguments);if(game!==g||g?.hands?.reduce((n,h)=>n+h.length,0)!==count)cancelPending();return r;};
const pause=hostTogglePause;hostTogglePause=function(){cancelPending();return pause.apply(this,arguments);};
const snapshot=applyPlayersSnapshot;applyPlayersSnapshot=function(){cancelPending();return snapshot.apply(this,arguments);};
const pack=packPlayersBySeat;packPlayersBySeat=function(){cancelPending();return pack.apply(this,arguments);};
const undo=hostUndoLastPlay;hostUndoLastPlay=function(){cancelPending();return undo.apply(this,arguments);};
const leave=leaveTableToLobby043;leaveTableToLobby043=function(){cancelPending();return leave.apply(this,arguments);};
window.addEventListener('pagehide',cancelPending);
window.HORX1Integration={status:()=>({requested,active,reason,ready,initializationError:initError,lastDecision,epa:eligiblePartner(game?.currentPlayer)!==null,partnerSeat:eligiblePartner(game?.currentPlayer),hand:epoch,pending:!!pending}),metrics,view,bidView,eligiblePartner,cardId:id};init();bind();document.addEventListener('DOMContentLoaded',bind);
})();

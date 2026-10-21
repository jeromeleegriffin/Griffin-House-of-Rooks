import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='https://griffin-house-of-rooks-x1-qa-20261021.jeromeleegriffin.workers.dev';
const entry=await fetch(base+'/');
assert.equal(entry.status,200);
const cookie=entry.headers.get('set-cookie')?.split(';')[0];
assert(cookie);
let code,token;
async function api(route,body,auth=token,expected=200){
 const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:base,...(auth?{Authorization:'Bearer '+auth}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const v=await r.json();assert.equal(r.status,expected,route.split('/').at(-1)+': '+(v.error||'status'));return v;
}
try{
 const playerId=crypto.randomUUID();
 const host=await api('/rooms',{playerId,displayName:'X1 suspension QA',pace:99},null,201);
 code=host.roomCode;token=host.token;const path='/rooms/'+code;
 await api(path+'/fill-bots',{});
 let before=await api(path+'/start',{options:{targetScore:100,shootMoonEnabled:false}});
 await api(path+'/ready',{handNumber:before.handNumber,openingId:before.opening?.id});
 // Establish an actual pending bot turn, independent of the random dealer.
 const setupDeadline=Date.now()+30000;
 while(true){
  assert(Date.now()<setupDeadline,'Could not establish pending bot turn');
  before=await api(path+'/snapshot');
  if(before.phase==='dealing'||before.trumpOpening||before.resolvingTrick){await new Promise(r=>setTimeout(r,250));continue;}
  if(before.currentPlayer!==host.seat)break;
  let route,data={};
  if(before.phase==='bidding'){route='bid';data.value=before.highestBid<100?100:0;}
  else if(before.phase==='discard'){route='discard';data.cardIds=before.hand.slice(0,before.discardCount).map(c=>c.id);}
  else if(before.phase==='trump'){route='trump';data.color='green';}
  else if(before.phase==='play'){
   if(before.canClaimRemaining)route='decline-claim';
   else{route='play';const suit=c=>c.id==='rook'||c.id==='red-2'?before.trump:c.color;const follow=before.hand.filter(c=>suit(c)===before.ledColor);data.cardId=(before.ledColor&&follow.length?follow:before.hand)[0].id;}
  }else throw Error('Unexpected setup phase '+before.phase);
  before=await api(path+'/'+route,{actionId:crypto.randomUUID(),expectedRevision:before.revision,...data});
  if(before.currentPlayer!==host.seat&&!before.trumpOpening&&!before.resolvingTrick&&before.phase!=='dealing')break;
 }
 assert.notEqual(before.currentPlayer,host.seat);
 const beforeDecisions=Object.values(before.botIntelligence.decisions).reduce((a,b)=>a+b,0);
 console.log(JSON.stringify({setup:{phase:before.phase,currentPlayer:before.currentPlayer,ownCardCount:before.hand.length,botDecisions:beforeDecisions}}));
 const detached=Date.now();console.log('Ten-minute detached-client window started; no room requests during this interval.');
 while(Date.now()-detached<600000)await new Promise(r=>setTimeout(r,Math.min(45000,600000-(Date.now()-detached))));
 const joined=await api(path+'/join',{playerId,displayName:'X1 suspension resume',resumeToken:token},null,201);
 assert.equal(joined.seat,host.seat);assert.equal(joined.token,token);
 const after=await api(path+'/snapshot');
 assert.equal(after.handNumber,before.handNumber);const retained=new Set(after.hand.map(c=>c.id));assert(before.hand.every(c=>retained.has(c.id)),'Original own cards lost without a client action');
 assert(after.revision>=before.revision);assert(Object.values(after.botIntelligence.decisions).reduce((a,b)=>a+b,0)>beforeDecisions,'Pending bot did not progress while disconnected');assert.equal(after.currentPlayer,host.seat);assert.equal(after.botIntelligence.fallbacks,0);
 const report={pass:true,scope:'Real Cloudflare HTTP API, one GitHub runner; not physical phone suspension or cellular roaming',detachedMs:Date.now()-detached,sameSeatTokenAndOwnCards:true,persistedAlarmBotProgress:true,revisionBefore:before.revision,revisionAfter:after.revision,intelligence:after.botIntelligence};
 fs.mkdirSync('x1-evidence',{recursive:true});fs.writeFileSync('x1-evidence/ten-minute-suspension.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{if(code&&token)await api('/rooms/'+code+'/close',{});}

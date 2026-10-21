import assert from 'node:assert/strict';
import fs from 'node:fs';
let source=fs.readFileSync(new URL('./worker-live.mjs',import.meta.url),'utf8').replace('import { DurableObject } from "cloudflare:workers";','class DurableObject{constructor(ctx){this.ctx=ctx}}')+'\nexport {RoomService};';const {RoomService}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));let now=Date.now();Date.now=()=>now;
const reports=[];let actions=0,rejoins=0;
const storage=()=>{const m=new Map();return {async get(k){return structuredClone(m.get(k))},async put(k,v){m.set(k,structuredClone(v))},async delete(k){return m.delete(k)}}};
const perm=c=>c.color==='rook'||(c.color==='red'&&c.rank===2);
const suit=(c,t)=>perm(c)?t:c.color;
for(const humans of [2,4])for(let run=0;run<5;run++){
const db=storage();let svc=new RoomService(db);const room=crypto.randomUUID();const ids=Array.from({length:humans},()=>crypto.randomUUID());const seats=[await svc.create(room,ids[0],'Test 1')];for(let i=1;i<humans;i++)seats.push(await svc.join(room,ids[i],'Test '+(i+1)));
if(humans===2)await svc.fillOpenSeatsWithBots(room,seats[0].token);
await assert.rejects(()=>svc.snapshot(room,null),/UNAUTHORIZED/);
await assert.rejects(()=>svc.startGame(room,seats[1].token),/HOST_ONLY/);
await svc.startGame(room,seats[0].token);
let hands=0,lastHand=0,steps=0;
while(steps++<5000){now+=30000;let v=await svc.snapshot(room,seats[0].token);if(v.handNumber!==lastHand){hands++;lastHand=v.handNumber;const views=await Promise.all(seats.map(s=>svc.snapshot(room,s.token)));for(let i=0;i<humans;i++)for(let j=0;j<humans;j++)if(i!==j)assert.equal(views[i].hand.some(c=>views[j].hand.some(d=>d.id===c.id)),false);}
if(v.phase==='complete'){assert(v.matchResult);reports.push({humans,bots:4-humans,run,hands,steps,scores:v.scores});break;}
if(v.resolvingTrick||v.trumpOpening||v.phase==='dealing')continue;const seat=['score','redeal'].includes(v.phase)?seats[0]:seats[v.currentPlayer];if(!seat)continue;let own=await svc.snapshot(room,seat.token);
if(steps%7===0||['discard','trump'].includes(v.phase)){const original=own;svc=new RoomService(db);const resumed=await svc.join(room,ids[seat.seat],'Test',seat.token);assert.equal(resumed.seat,seat.seat);assert.equal(resumed.token,seat.token);own=await svc.snapshot(room,seat.token);assert.deepEqual(own.hand,original.hand);assert.equal(own.currentPlayer,original.currentPlayer);rejoins++;await assert.rejects(()=>svc.join(room,ids[seat.seat],'Thief'),/PLAYER_ALREADY_SEATED/);}
let method,payload={};if(v.phase==='bidding'){method='bid';payload.value=own.highestBid<100?100:0;}else if(v.phase==='discard'){method='discard';payload.cardIds=own.hand.slice(0,own.discardCount).map(c=>c.id);}else if(v.phase==='trump'){method='chooseTrump';payload.color='green';}else if(v.phase==='play'){if(own.canClaimRemaining)method='declineRemainingClaim';else{method='playCard';const legal=own.hand.find(c=>!own.ledColor||suit(c,own.trump)===own.ledColor||!own.hand.some(d=>suit(d,own.trump)===own.ledColor));assert(legal);payload.cardId=legal.id;}}else if(v.phase==='score')method='startNextHand';else if(v.phase==='redeal')method='redeal';else throw Error(v.phase);
const a={actionId:crypto.randomUUID(),expectedRevision:own.revision,...payload};const before=own.revision;await assert.rejects(()=>svc[method](room,seat.token,{...a,actionId:crypto.randomUUID(),expectedRevision:before-1}),/STALE_REVISION/);const result=await svc[method](room,seat.token,a);actions++;const duplicate=await svc[method](room,seat.token,a);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.accepted,true);
}
assert(steps<5000);
}
const result={scope:'Local deployed RoomService with structured-clone storage adapter; not Cloudflare or rendered browser',matches:reports.length,actions,rejoins,reports};fs.mkdirSync(new URL('./tests/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('./tests/pace-audit-service-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require(process.env.GHR_ACORN_PATH || 'acorn');
const adapter = fs.readFileSync(process.argv[2] || process.env.GHR_ADAPTER_SOURCE || 'cloudflare/live/adapter-live.js','utf8');
const main = fs.readFileSync(process.env.GHR_GAME_SOURCE || 'game060.js','utf8');
function functions(source) {
 const found = new Map();
 function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration') found.set(node.id.name, source.slice(node.start,node.end));
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if(value && typeof value === 'object') visit(value);
 }
 visit(parse(source,{ecmaVersion:'latest',sourceType:'script'}));return found;
}
const af=functions(adapter), mf=functions(main);
const workerSource=fs.readFileSync(process.env.GHR_WORKER_SOURCE || 'cloudflare/live/worker-live.mjs','utf8').replace('import { DurableObject } from "cloudflare:workers";','class DurableObject {}');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(workerSource).toString('base64'));
const network=[];
globalThis.fetch=async url=>{
 const parsed=new URL(url);const pathname=parsed.pathname;
 assert(pathname.startsWith('/jeromeleegriffin/Test/374bf70223a9df7113d83786cd55f2ee6c25f4ae/'));
 const path=pathname.split('/').slice(4).join('/');network.push(path);
 return new Response(fs.readFileSync((process.env.GHR_ASSET_ROOT || '.')+'/'+path),{headers:{'content-type':'application/octet-stream'}});
};
let failOne=false, started=[], timers=[], callbacks={};
const warnings=[];
class AudioContext {
 constructor(){this.state='running';this.currentTime=1;this.destination={};}
 resume(){this.state='running';return Promise.resolve();}
 decodeAudioData(bytes){assert(bytes.byteLength>44);return Promise.resolve({duration:0.2,length:bytes.byteLength});}
 createBufferSource(){const s={connect(){},disconnect(){},start(){started.push(this.buffer)},buffer:null};return s;}
 createGain(){return {gain:{setValueAtTime(){}},connect(){},disconnect(){}};}
}
const ctx={console:{...console,warn:(...args)=>warnings.push(String(args[0]))},URL,Promise,Map,Set,Date,Array,Number,String,Object,Math,AudioContext,webkitAudioContext:AudioContext,
 document:{hidden:false,body:{classList:{contains:()=>true,remove(){}}},getElementById:()=>null,addEventListener(type,fn){callbacks[type]=fn;}},
 fetch:async path=>{if(failOne){failOne=false;return new Response('offline',{status:503});}return worker.fetch(new Request(new URL(path,'https://unit.example/cloud-game/assets/')),{})},
 setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},
 credentials:{roomCode:'UNITTEST',seat:0},cloudDealOwner:null,cloudDealTimer:null,presented:null,cloudAudio:null,lastScoreSignature:'',redealRevision:null,
 game:{},players:[],myIndex:0,myPeerId:'',isHost:false,shootMoonEnabled:true,includeRed2:true,includeOnes:true,includeRook:true,includeRed1:false,onesHigh:true,rookLowest:false,specialsAnytime:true,mustTrumpWhenVoid:false,
 soundMuted:false,soundCard:true,audioCtx:null,cardLandingBuffers058:[],cardLandingLoad058:null,lastCardLandingIndex058:-1,
 CARD_LANDING_SAMPLE_URLS058:[1,2,3,4,5].map(i=>'assets/audio/card-play/card-land-'+String(i).padStart(2,'0')+'.wav'),
 solScaledDelay:()=>0,playCardMotionSound059(){},birdFightCaptureConfirmed064:()=>false,markRookJustPlayed(){},
 paintCloudPace(){},playerIdForSeat:i=>'cloud-seat-'+i,status(){},applyState(){},renderHand(){},setBotThinking(){},cardPoints:()=>0,showScoreModal(){},sendAction(){},
};ctx.window=ctx;ctx.HORAudioMixer={output:()=>({})};
const cardEvents=[];ctx.recordCard=id=>cardEvents.push(id);
vm.createContext(ctx);
vm.runInContext(['ensureAudio','whenAudioReady','preloadCardLandingSounds058','playCardSound','notifyCardPlayed'].map(n=>mf.get(n)).join('\n')+'\nfunction playSfx(name){if(name==="card")playCardSound();}',ctx);
// Observe the real notify function without changing its behavior.
vm.runInContext('const notifyOriginal=notifyCardPlayed;notifyCardPlayed=function(card){recordCard(card.id);return notifyOriginal(card)};',ctx);
vm.runInContext(['mapPlayers','warmCloudAudio','presentCloudCardAudio','gameSnapshot'].map(n=>af.get(n)||'').join('\n'),ctx);
const snapshot=(revision,trick,handNumber=1)=>({revision,handNumber,phase:'play',pace:1,trick,players:[0,1,2,3].map(seat=>({seat,name:'Unit',isBot:seat>0,occupied:true})),hand:[],handCounts:[10,10,10,10],bidStatus:[null,null,null,null],trump:'red',currentPlayer:0});
const play=(id,player=0)=>({player,card:{id,color:'yellow',rank:5}});
async function settle(){for(let i=0;i<25;i++)await new Promise(r=>setImmediate(r));}
function flush(){const batch=timers;timers=[];batch.forEach(fn=>fn());}
ctx.gameSnapshot(snapshot(1,[play('yellow-5')]));await settle();
assert.equal(ctx.cardLandingBuffers058.length,5,'reconnect during play must load all five existing impacts');
assert.equal(cardEvents.length,0,'restoring an existing card must remain quiet');
assert.equal(started.length,0);
ctx.gameSnapshot(snapshot(2,[play('yellow-5'),play('yellow-6',1)]));await settle();flush();
assert.deepEqual(cardEvents,['yellow-6']);assert.equal(started.length,1,'confirmed new play must reach actual impact source.start');
ctx.gameSnapshot(snapshot(3,[play('yellow-5'),play('yellow-6',1)]));flush();assert.equal(started.length,1,'pace updates and duplicate snapshots must not replay');
ctx.gameSnapshot(snapshot(4,[]));flush();assert.equal(started.length,1,'trick cleanup must not replay');
ctx.gameSnapshot(snapshot(5,[play('yellow-7',2)]));flush();assert.equal(started.length,2);
ctx.gameSnapshot(snapshot(6,[play('yellow-5')],2));flush();assert.equal(started.length,2,'new-hand restore must not replay cards');
ctx.gameSnapshot(snapshot(7,[play('yellow-5'),play('yellow-8',1),play('yellow-9',2)],2));flush();assert.equal(started.length,3,'catch-up snapshot emits latest play only, never a burst');
const netCount=network.length;ctx.gameSnapshot(snapshot(8,[play('yellow-5'),play('yellow-8',1),play('yellow-9',2)],2));await settle();assert.equal(network.length,netCount,'loaded buffers reused');
ctx.soundMuted=true;ctx.gameSnapshot(snapshot(9,[play('yellow-10')],2));flush();assert.equal(started.length,3,'mute preserved');
ctx.soundMuted=false;ctx.soundCard=false;ctx.gameSnapshot(snapshot(10,[play('yellow-11')],2));flush();assert.equal(started.length,3,'effects disabled preserved');
ctx.soundCard=true;ctx.credentials={roomCode:'OTHER123',seat:0};ctx.gameSnapshot(snapshot(1,[play('yellow-12')]));flush();assert.equal(started.length,3,'different room restore quiet');
// Existing loader clears a failed request; a later trusted tap retries via the bridge.
ctx.cardLandingBuffers058=[];ctx.cardLandingLoad058=null;failOne=true;ctx.warmCloudAudio();await settle();assert.equal(ctx.cardLandingBuffers058.length,0);ctx.warmCloudAudio();await settle();assert.equal(ctx.cardLandingBuffers058.length,5);
assert(adapter.includes('document.addEventListener("pointerdown", warmCloudAudio'));
console.log('PASS: actual Cloudflare gameSnapshot + native preload/notify/card-impact functions; zero-buffer reconnect, confirmed source.start, no restore/duplicate/cleanup bursts, new-hand/room isolation, mute/effects preferences, failed-load retry, immutable Worker WAV routing. Mock AudioContext; no audible/browser claim.');

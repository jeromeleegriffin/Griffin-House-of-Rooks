/* Griffin House of Rooks — dormant progression framework (RookGame450)
 * SAFE DEFAULT: OFF. It creates no UI, no identity, no network calls and changes no gameplay while disabled.
 * To activate later, change enabled:false to enabled:true after the Worker/database is ready.
 */
(function(){
'use strict';
const CONFIG = {
  enabled: false,                 // MASTER KILL SWITCH — LEAVE FALSE FOR DORMANT INSTALL
  uiEnabled: false,               // career card / achievement screens
  notificationsEnabled: false,    // unlock toast
  identityEnabled: false,         // anonymous ID + device secret
  cloudEnabled: false,            // v2 Worker calls
  recoveryEnabled: false,         // recovery-code UI/API
  botProgressionEnabled: false,   // calculate levels/badges for named bots
  endpoint: '',                   // future v2 Worker URL; intentionally blank
  schemaVersion: 1
};
const LEVELS = [{"level":1,"title":"Rookling","points":0},{"level":2,"title":"New Hand","points":500},{"level":3,"title":"Trick Taker","points":1250},{"level":4,"title":"Nest Hunter","points":2500},{"level":5,"title":"Table Regular","points":4000},{"level":6,"title":"Card Sharp","points":6000},{"level":7,"title":"Rook Chaser","points":8500},{"level":8,"title":"Bidder","points":11500},{"level":9,"title":"Trump Tactician","points":15000},{"level":10,"title":"Rook Veteran","points":20000},{"level":11,"title":"Rook Veteran I","points":25000},{"level":12,"title":"Rook Veteran II","points":30500},{"level":13,"title":"Rook Veteran III","points":36500},{"level":14,"title":"Rook Veteran IV","points":43000},{"level":15,"title":"Seasoned Player","points":50000},{"level":16,"title":"Seasoned Player I","points":59000},{"level":17,"title":"Seasoned Player II","points":68500},{"level":18,"title":"Seasoned Player III","points":78500},{"level":19,"title":"Seasoned Player IV","points":89000},{"level":20,"title":"Rook Expert","points":100000},{"level":21,"title":"Rook Expert I","points":113000},{"level":22,"title":"Rook Expert II","points":127000},{"level":23,"title":"Rook Expert III","points":142000},{"level":24,"title":"Rook Expert IV","points":158000},{"level":25,"title":"Master Bidder","points":175000},{"level":26,"title":"Master Bidder I","points":193000},{"level":27,"title":"Master Bidder II","points":212000},{"level":28,"title":"Master Bidder III","points":232000},{"level":29,"title":"Master Bidder IV","points":253000},{"level":30,"title":"Table Master","points":275000},{"level":31,"title":"Table Master I","points":298000},{"level":32,"title":"Table Master II","points":322000},{"level":33,"title":"Table Master III","points":347000},{"level":34,"title":"Table Master IV","points":373000},{"level":35,"title":"Nest Master","points":400000},{"level":36,"title":"Nest Master I","points":428000},{"level":37,"title":"Nest Master II","points":457000},{"level":38,"title":"Nest Master III","points":487000},{"level":39,"title":"Nest Master IV","points":518000},{"level":40,"title":"Rook Master","points":550000},{"level":41,"title":"Rook Master I","points":585000},{"level":42,"title":"Rook Master II","points":622000},{"level":43,"title":"Rook Master III","points":662000},{"level":44,"title":"Rook Master IV","points":705000},{"level":45,"title":"Griffin Elite","points":750000},{"level":46,"title":"Griffin Elite I","points":798000},{"level":47,"title":"Griffin Elite II","points":849000},{"level":48,"title":"Griffin Elite III","points":900000},{"level":49,"title":"Griffin Elite IV","points":950000},{"level":50,"title":"House Legend","points":1000000}];
const MEDALS = ['Bronze','Silver','Gold','Platinum','Griffin'];
const FAMILIES = [{"id":"career_points","name":"Point Collector","stat":"points","thresholds":[1000,10000,50000,250000,1000000]},{"id":"hands","name":"Old Hand","stat":"hands","thresholds":[25,100,500,2500,10000]},{"id":"games","name":"Game Night","stat":"gamesPlayed","thresholds":[10,50,250,1000,5000]},{"id":"wins","name":"Winner","stat":"gamesWon","thresholds":[5,25,100,500,2500]},{"id":"tricks","name":"Trick Taker","stat":"tricksWon","thresholds":[50,250,1000,5000,20000]},{"id":"rook_hunter","name":"Rook Hunter","stat":"rookCaptures","thresholds":[10,50,250,1000,5000]},{"id":"red2_hunter","name":"Red 2 Hunter","stat":"red2Captures","thresholds":[10,50,250,1000,5000]},{"id":"big_tricks","name":"Heavy Hitter","stat":"bigTricks","thresholds":[10,50,250,1000,5000]},{"id":"nest_raider","name":"Nest Raider","stat":"nestWins","thresholds":[10,50,250,1000,5000]},{"id":"nest_points","name":"Nest Fortune","stat":"nestPts","thresholds":[250,2500,12500,50000,250000]},{"id":"bids_won","name":"Bid Winner","stat":"bidsWon","thresholds":[10,50,250,1000,5000]},{"id":"bids_made","name":"Contract Keeper","stat":"bidsMade","thresholds":[10,50,250,1000,5000]},{"id":"moon_made","name":"Moonshiner","stat":"moonMade","thresholds":[1,5,25,100,500]},{"id":"moon_attempts","name":"Moon Chaser","stat":"moonAttempts","thresholds":[5,25,100,500,2000]},{"id":"bagger","name":"Bag Collector","stat":"bags","thresholds":[10,50,250,1000,5000]},{"id":"streak","name":"Hot Streak","stat":"longestWinStreak","thresholds":[2,3,5,7,10]},{"id":"exact_bid","name":"Exactly","stat":"exactBidMakes","thresholds":[1,10,50,250,1000]},{"id":"close_wins","name":"Photo Finish","stat":"closeWins","thresholds":[1,10,50,250,1000]},{"id":"routs","name":"Dominator","stat":"routWins","thresholds":[1,10,50,250,1000]},{"id":"sweeps","name":"Clean House","stat":"sweepHands","thresholds":[1,5,25,100,500]},{"id":"bird_two","name":"Bird & Two","stat":"rookAndRed2SameHand","thresholds":[1,10,50,250,1000]},{"id":"comebacks","name":"Comeback Kid","stat":"comebackWins","thresholds":[1,10,50,250,1000]},{"id":"colors","name":"Trump Traveler","stat":"allTrumpColorWins","thresholds":[1,5,25,100,500]},{"id":"made_streak","name":"Contract Streak","stat":"longestMadeBidStreak","thresholds":[2,3,5,7,10]},{"id":"partners","name":"Partner Power","stat":"samePartnerWins","thresholds":[5,25,100,500,2000]}];
const FEATS = [{"id":"first_trick","name":"First Trick","description":"Win your first trick","stat":"tricksWon","threshold":1},{"id":"first_win","name":"First Victory","description":"Win your first game","stat":"gamesWon","threshold":1},{"id":"first_rook","name":"Got the Bird","description":"Capture the Rook","stat":"rookCaptures","threshold":1},{"id":"first_red2","name":"Seeing Red","description":"Capture the Red 2","stat":"red2Captures","threshold":1},{"id":"first_nest","name":"Nest Egg","description":"Win your first nest","stat":"nestWins","threshold":1},{"id":"first_bid","name":"I\u2019ll Take It","description":"Win your first bid","stat":"bidsWon","threshold":1},{"id":"first_contract","name":"Made It","description":"Make your first contract","stat":"bidsMade","threshold":1},{"id":"first_moon","name":"Shooting Star","description":"Successfully Shoot the Moon","stat":"moonMade","threshold":1},{"id":"high_bid_150","name":"Bold Bid","description":"Win a bid of 150 or higher","stat":"highBid","threshold":150},{"id":"high_bid_180","name":"Fearless","description":"Win a bid of 180 or higher","stat":"highBid","threshold":180},{"id":"high_bid_200","name":"No Fear","description":"Win a bid of 200 or higher","stat":"highBid","threshold":200},{"id":"hand_150","name":"Big Haul","description":"Capture 150+ points in one hand","stat":"bestHandPoints","threshold":150},{"id":"hand_200","name":"Monster Hand","description":"Capture 200+ points in one hand","stat":"bestHandPoints","threshold":200},{"id":"trick_50","name":"Monster Trick","description":"Take a 50+ point trick","stat":"bestTrickPoints","threshold":50},{"id":"exact_one","name":"Called It","description":"Make a contract exactly","stat":"exactBidMakes","threshold":1},{"id":"close_one","name":"Too Close","description":"Win a game by 5 points or less","stat":"closeWins","threshold":1},{"id":"rout_one","name":"Rout","description":"Win a game by 200+ points","stat":"routWins","threshold":1},{"id":"sweep_one","name":"Clean Sweep","description":"Take every trick in a hand","stat":"sweepHands","threshold":1},{"id":"bird_two_one","name":"Bird & Two","description":"Capture the Rook and Red 2 in the same hand","stat":"rookAndRed2SameHand","threshold":1},{"id":"all_colors_one","name":"Four Colors","description":"Win with every trump color","stat":"allTrumpColorWins","threshold":1}];
const EXTRA_DEFAULTS = {
  currentWinStreak:0,longestWinStreak:0,currentMadeBidStreak:0,longestMadeBidStreak:0,
  exactBidMakes:0,closeWins:0,routWins:0,comebackWins:0,sweepHands:0,bestHandPoints:0,bestTrickPoints:0,
  rookAndRed2SameHand:0,allTrumpColorWins:0,samePartnerWins:0,trumpWins:{black:0,red:0,green:0,yellow:0},
  achievements:{},lastUpdated:null
};
function clone(x){return JSON.parse(JSON.stringify(x));}
function n(x){x=Number(x);return Number.isFinite(x)?x:0;}
function levelFor(points){
  points=n(points); let row=LEVELS[0]; for(const r of LEVELS){if(points>=r.points) row=r; else break;}
  const i=LEVELS.indexOf(row), next=LEVELS[i+1]||null;
  return {level:row.level,title:row.title,points,threshold:row.points,nextThreshold:next?next.points:null,
    progress:next?Math.max(0,Math.min(1,(points-row.points)/(next.points-row.points))):1};
}
function evaluate(stats, already){
  stats=stats||{}; already=already||{}; const unlocked=[];
  for(const f of FAMILIES){ const value=n(stats[f.stat]); f.thresholds.forEach((t,i)=>{const id=f.id+'_'+(i+1); if(value>=t&&!already[id]) unlocked.push({id,type:'family',family:f.id,name:f.name,medal:MEDALS[i],tier:i+1,threshold:t});});}
  for(const a of FEATS){if(n(stats[a.stat])>=a.threshold&&!already[a.id]) unlocked.push({...a,type:'feat'});}
  return unlocked;
}
function randomBytes(len){const b=new Uint8Array(len);crypto.getRandomValues(b);return b;}
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function uuid(){return crypto.randomUUID?crypto.randomUUID():b64url(randomBytes(18));}
function makeRecoveryCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';const b=randomBytes(12);for(let i=0;i<12;i++)s+=alphabet[b[i]%alphabet.length];return 'GRIFFIN-'+s.slice(0,4)+'-'+s.slice(4,8)+'-'+s.slice(8);}
function identityRead(){try{return JSON.parse(localStorage.getItem('horPlayerIdentityV1')||'null');}catch(e){return null;}}
function identityCreate(){if(!CONFIG.enabled||!CONFIG.identityEnabled)return null;let x=identityRead();if(x)return x;x={playerId:uuid(),deviceSecret:b64url(randomBytes(32)),createdAt:new Date().toISOString(),recoveryCode:null};localStorage.setItem('horPlayerIdentityV1',JSON.stringify(x));return x;}
function extrasRead(key){try{return Object.assign(clone(EXTRA_DEFAULTS),JSON.parse(localStorage.getItem('horProgressV1:'+key)||'{}'));}catch(e){return clone(EXTRA_DEFAULTS);}}
function extrasWrite(key,x){if(!CONFIG.enabled)return;try{x.lastUpdated=new Date().toISOString();localStorage.setItem('horProgressV1:'+key,JSON.stringify(x));}catch(e){}}
async function api(path,body){if(!CONFIG.enabled||!CONFIG.cloudEnabled||!CONFIG.endpoint)return null;const id=identityCreate();if(!id)return null;const r=await fetch(CONFIG.endpoint.replace(/\/$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json','X-Player-ID':id.playerId,'X-Device-Secret':id.deviceSecret},body:JSON.stringify(body||{})});if(!r.ok)throw new Error('Progression API '+r.status);return r.json();}
async function createRecoveryCode(){if(!CONFIG.enabled||!CONFIG.recoveryEnabled)return null;const code=makeRecoveryCode();const result=await api('/v2/recovery/create',{code});if(result&&result.ok){const id=identityRead();id.recoveryCode=code;localStorage.setItem('horPlayerIdentityV1',JSON.stringify(id));return code;}return null;}
async function restoreWithCode(code){if(!CONFIG.enabled||!CONFIG.recoveryEnabled||!CONFIG.cloudEnabled)return null;const r=await fetch(CONFIG.endpoint.replace(/\/$/,'')+'/v2/recovery/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:String(code||'').trim().toUpperCase(),newDeviceSecret:b64url(randomBytes(32))})});if(!r.ok)return null;const data=await r.json();if(data&&data.ok&&data.playerId&&data.deviceSecret){localStorage.setItem('horPlayerIdentityV1',JSON.stringify({playerId:data.playerId,deviceSecret:data.deviceSecret,createdAt:new Date().toISOString(),recovered:true}));}return data;}
function activate(){if(!CONFIG.enabled)return false;if(CONFIG.identityEnabled)identityCreate();return true;}
window.HORProgression={CONFIG,LEVELS,FAMILIES,FEATS,MEDALS,EXTRA_DEFAULTS,levelFor,evaluate,identityRead,identityCreate,extrasRead,extrasWrite,createRecoveryCode,restoreWithCode,api,activate};
if(CONFIG.enabled)activate();
})();

/* RookGame451 offline-first extension.
 * This block is intentionally inert while HORProgression.CONFIG.enabled === false.
 * It adds local-first human/bot ledgers plus a durable outbox for later Cloudflare sync.
 */
(function(){
'use strict';
if(!window.HORProgression) return;
const P=window.HORProgression;
const LEDGER_PREFIX='horCareerLedgerV1:';
const OUTBOX_KEY='horProgressOutboxV1';
const INSTALL_KEY='horInstallIdV1';
function safeParse(s,f){try{return JSON.parse(s);}catch(e){return f;}}
function installId(){let x=localStorage.getItem(INSTALL_KEY);if(x)return x;x='install-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem(INSTALL_KEY,x);return x;}
function actorKey(type,id){return String(type||'human')+':'+String(id||'local');}
function ledgerRead(type,id){const k=actorKey(type,id);return safeParse(localStorage.getItem(LEDGER_PREFIX+k),{schemaVersion:1,actorType:type||'human',actorId:id||'local',installId:installId(),stats:{},achievements:{},revision:0,updatedAt:null});}
function ledgerWrite(type,id,record){if(!P.CONFIG.enabled)return record;const k=actorKey(type,id);record=record||ledgerRead(type,id);record.schemaVersion=1;record.actorType=type||record.actorType||'human';record.actorId=id||record.actorId||'local';record.installId=record.installId||installId();record.revision=(Number(record.revision)||0)+1;record.updatedAt=new Date().toISOString();localStorage.setItem(LEDGER_PREFIX+k,JSON.stringify(record));queueSnapshot(record);return record;}
function queueRead(){return safeParse(localStorage.getItem(OUTBOX_KEY),[]);}
function queueWrite(q){if(!P.CONFIG.enabled)return;localStorage.setItem(OUTBOX_KEY,JSON.stringify(q.slice(-500)));}
function queueSnapshot(record){if(!P.CONFIG.enabled)return;const q=queueRead();const key=record.actorType+':'+record.actorId;const item={id:key+':'+record.revision,actorType:record.actorType,actorId:record.actorId,installId:record.installId,revision:record.revision,updatedAt:record.updatedAt,snapshot:record};const old=q.findIndex(x=>x.actorType+':'+x.actorId===key);if(old>=0)q.splice(old,1);q.push(item);queueWrite(q);}
function mergeCounters(local,cloud){const out={};const keys=new Set([...Object.keys(local||{}),...Object.keys(cloud||{})]);for(const k of keys){const a=local?local[k]:undefined,b=cloud?cloud[k]:undefined;if(k==='achievements'){out[k]=Object.assign({},b||{},a||{});continue;}if(k==='trumpWins'){out[k]={};for(const c of ['black','red','green','yellow'])out[k][c]=Math.max(Number(a&&a[c])||0,Number(b&&b[c])||0);continue;}if(typeof a==='number'||typeof b==='number')out[k]=Math.max(Number(a)||0,Number(b)||0);else out[k]=(a!==undefined?a:b);}return out;}
async function flushOutbox(){if(!P.CONFIG.enabled||!P.CONFIG.cloudEnabled||!P.CONFIG.endpoint||!navigator.onLine)return {ok:false,reason:'offline-or-disabled'};let q=queueRead();let sent=0;for(const item of [...q]){try{const res=await P.api('/v2/sync',{offlineFirst:true,actorType:item.actorType,actorId:item.actorId,installId:item.installId,revision:item.revision,snapshot:item.snapshot});if(res&&res.ok){q=q.filter(x=>x.id!==item.id);queueWrite(q);sent++;if(res.record){const merged=ledgerRead(item.actorType,item.actorId);merged.stats=mergeCounters(merged.stats,res.record.stats||{});merged.achievements=Object.assign({},res.record.achievements||{},merged.achievements||{});localStorage.setItem(LEDGER_PREFIX+actorKey(item.actorType,item.actorId),JSON.stringify(merged));}}}catch(e){break;}}return {ok:true,sent,pending:q.length};}
function humanActorId(){const ident=P.identityRead&&P.identityRead();return ident&&ident.playerId?ident.playerId:'guest-'+installId();}
function botActorId(name){return 'bot-'+String(name||'bot').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function recordLocal(type,id,mutator){if(!P.CONFIG.enabled)return null;const r=ledgerRead(type,id);r.stats=r.stats||{};r.achievements=r.achievements||{};if(typeof mutator==='function')mutator(r);const unlocks=P.evaluate(Object.assign({},r.stats),r.achievements);for(const u of unlocks)r.achievements[u.id]={unlockedAt:new Date().toISOString(),type:u.type,tier:u.tier||null};ledgerWrite(type,id,r);return {record:r,unlocks};}
function recordHuman(mutator){return recordLocal('human',humanActorId(),mutator);}
function recordBot(name,mutator){return recordLocal('bot',botActorId(name),mutator);}
function localLeaderboard(stat='points',actorType=null){const rows=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith(LEDGER_PREFIX))continue;const r=safeParse(localStorage.getItem(k),null);if(!r||(actorType&&r.actorType!==actorType))continue;rows.push({actorType:r.actorType,actorId:r.actorId,value:Number(r.stats&&r.stats[stat])||0,level:P.levelFor(Number(r.stats&&r.stats.points)||0),record:r});}return rows.sort((a,b)=>b.value-a.value);}
P.offline={installId,actorKey,ledgerRead,ledgerWrite,recordLocal,recordHuman,recordBot,humanActorId,botActorId,queueRead,flushOutbox,localLeaderboard,mergeCounters};
window.addEventListener('online',()=>{if(P.CONFIG.enabled&&P.CONFIG.cloudEnabled)flushOutbox();});
})();

/* RookGame452 — local progression preview + celebration presentation layer.
 * Still SAFE/DORMANT by default. This block does not activate accounting or cloud.
 * It can preview existing rookLifetimeStats read-only and preview animations manually.
 */
(function(){
'use strict';
if(!window.HORProgression) return;
const P=window.HORProgression;
const PRESENT_KEY='horProgressPresentationV1';
const MIGRATION_KEY='horProgressMigrationV1';
const state={queue:[],showing:false};
function safeParse(s,f){try{return JSON.parse(s);}catch(e){return f;}}
function presentationPrefs(){return Object.assign({mode:'full',sound:true,nearProgress:true},safeParse(localStorage.getItem(PRESENT_KEY),{}));}
function savePresentationPrefs(v){localStorage.setItem(PRESENT_KEY,JSON.stringify(Object.assign(presentationPrefs(),v||{})));}
function legacyStore(){return safeParse(localStorage.getItem('rookLifetimeStats'),{})||{};}
function normalizeLegacy(x){x=x||{};return {
  hands:+x.hands||0,bidsWon:+x.bidsWon||0,highBid:+x.highBid||0,bidsMade:+x.bidsMade||0,bidsSet:+x.bidsSet||0,
  points:+x.points||0,tricksWon:+x.tricksWon||0,rookCaptures:+x.rookCaptures||0,red2Captures:+x.red2Captures||0,
  bigTricks:+x.bigTricks||0,nestWins:+x.nestWins||0,nestPts:+x.nestPts||0,moonAttempts:+x.moonAttempts||0,
  moonMade:+x.moonMade||0,bags:+x.bags||0,gamesPlayed:+x.gamesPlayed||0,gamesWon:+x.gamesWon||0,
  longestWinStreak:+x.longestWinStreak||0,exactBidMakes:+x.exactBidMakes||0,closeWins:+x.closeWins||0,routWins:+x.routWins||0,
  comebackWins:+x.comebackWins||0,sweepHands:+x.sweepHands||0,bestHandPoints:+x.bestHandPoints||0,bestTrickPoints:+x.bestTrickPoints||0,
  rookAndRed2SameHand:+x.rookAndRed2SameHand||0,allTrumpColorWins:+x.allTrumpColorWins||0,longestMadeBidStreak:+x.longestMadeBidStreak||0,
  samePartnerWins:+x.samePartnerWins||0
};}
function simulateName(name){const raw=legacyStore()[name];if(!raw)return null;const stats=normalizeLegacy(raw);const unlocks=P.evaluate(stats,{});const level=P.levelFor(stats.points);return {name,raw,stats,level,unlocks,achievementCount:unlocks.length,isBot:!!raw.isBot};}
function simulateAll(){const s=legacyStore();return Object.keys(s).map(simulateName).filter(Boolean).sort((a,b)=>b.stats.points-a.stats.points);}
function findPersonal(){const s=legacyStore(), names=Object.keys(s);const exact=[];for(const wanted of ['Jerome','Host']){const hit=names.find(n=>n.toLowerCase()===wanted.toLowerCase());if(hit)exact.push(simulateName(hit));}return exact;}
function dryRunDelta(name,delta){const base=simulateName(name);if(!base)return null;const stats=Object.assign({},base.stats);for(const [k,v] of Object.entries(delta||{})){if(typeof v==='number')stats[k]=(+stats[k]||0)+v;else stats[k]=v;}const already={};for(const u of base.unlocks)already[u.id]=true;return {before:base,after:{stats,level:P.levelFor(stats.points),newUnlocks:P.evaluate(stats,already)}};}
function ensureCss(){if(document.getElementById('horProgressCelebrationCss'))return;const st=document.createElement('style');st.id='horProgressCelebrationCss';st.textContent=`
#horProgressToastHost{position:fixed;right:14px;top:14px;z-index:2147483647;pointer-events:none;max-width:min(390px,calc(100vw - 28px));font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.hor-ach-toast{position:relative;overflow:hidden;background:linear-gradient(145deg,#101613,#20271d);border:2px solid #c99a36;border-radius:16px;color:#fff;padding:14px 16px 14px 66px;box-shadow:0 12px 38px #000a;min-height:54px;transform:translateX(120%);opacity:0;transition:.42s cubic-bezier(.2,.8,.2,1)}
.hor-ach-toast.show{transform:translateX(0);opacity:1}.hor-ach-toast.hide{transform:translateX(120%);opacity:0}.hor-ach-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:34px;filter:drop-shadow(0 0 7px #d5aa4b88)}
.hor-ach-kicker{font-size:11px;letter-spacing:.15em;color:#e7c66e;text-transform:uppercase;font-weight:800}.hor-ach-title{font-size:18px;font-weight:900;margin-top:2px}.hor-ach-sub{font-size:12px;color:#ddd;margin-top:3px}.hor-ach-shine{position:absolute;inset:-50%;background:linear-gradient(100deg,transparent 42%,#fff5 50%,transparent 58%);transform:translateX(-70%) rotate(8deg);animation:horShine 1.2s .2s ease-out 1}@keyframes horShine{to{transform:translateX(70%) rotate(8deg)}}
.hor-level-toast{border-color:#f2cf68;background:radial-gradient(circle at 20% 20%,#51431c,#151b15 58%)}.hor-major-toast{min-height:76px;border-width:3px;box-shadow:0 0 28px #e0b84d55,0 15px 45px #000b}.hor-progressbar{height:6px;background:#ffffff20;border-radius:8px;margin-top:8px;overflow:hidden}.hor-progressbar>i{display:block;height:100%;background:#e5bd58;width:0;transition:width .8s .25s ease}
#horProgressPreview{position:fixed;inset:3vh 3vw;z-index:2147483640;background:#0d120ff7;color:#fff;border:2px solid #b88a31;border-radius:18px;box-shadow:0 20px 70px #000;display:none;overflow:auto;padding:18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif}#horProgressPreview.show{display:block}#horProgressPreview button{background:#2b342b;color:#fff;border:1px solid #b88a31;border-radius:9px;padding:9px 12px;margin:4px;font-weight:700}#horProgressPreview table{width:100%;border-collapse:collapse;margin-top:12px}#horProgressPreview th,#horProgressPreview td{padding:7px;border-bottom:1px solid #ffffff18;text-align:left}#horProgressPreview .warn{color:#ffd276}#horProgressPreview .ok{color:#aee6a5}`;document.head.appendChild(st);}
function host(){ensureCss();let h=document.getElementById('horProgressToastHost');if(!h){h=document.createElement('div');h.id='horProgressToastHost';document.body.appendChild(h);}return h;}
function tone(){try{const p=presentationPrefs();if(!p.sound)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=660;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.055,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.35);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.38);}catch(e){}}
function enqueue(ev){state.queue.push(ev);pump();}
function pump(){if(state.showing||!state.queue.length)return;const prefs=presentationPrefs();if(prefs.mode==='off'){state.queue.shift();return pump();}state.showing=true;const ev=state.queue.shift(),h=host(),d=document.createElement('div');const major=!!ev.major;d.className='hor-ach-toast '+(ev.kind==='level'?'hor-level-toast ':'')+(major?'hor-major-toast ':'');d.innerHTML='<span class="hor-ach-icon">'+(ev.icon||'🏆')+'</span><div class="hor-ach-kicker">'+(ev.kicker||'Achievement Unlocked')+'</div><div class="hor-ach-title">'+(ev.title||'Achievement')+'</div><div class="hor-ach-sub">'+(ev.subtitle||'')+'</div>'+(ev.progress!=null?'<div class="hor-progressbar"><i></i></div>':'')+(prefs.mode==='full'?'<span class="hor-ach-shine"></span>':'');h.appendChild(d);requestAnimationFrame(()=>{d.classList.add('show');const b=d.querySelector('.hor-progressbar i');if(b)b.style.width=Math.max(0,Math.min(100,ev.progress*100))+'%';});tone();const ms=prefs.mode==='minimal'?1800:(major?4500:3300);setTimeout(()=>{d.classList.add('hide');setTimeout(()=>{d.remove();state.showing=false;pump();},450);},ms);}
function previewCelebration(kind){if(kind==='level')enqueue({kind:'level',icon:'★',kicker:'Level Up',title:'Level 25 — Master Bidder',subtitle:'Your Rook career just reached a new level.',progress:.08,major:true});else if(kind==='griffin')enqueue({icon:'🦅',kicker:'Griffin Medal Earned',title:'Rook Hunter — Griffin',subtitle:'Capture 5,000 Rooks',major:true});else if(kind==='feat')enqueue({icon:'🌙',kicker:'Rare Feat',title:'Shooting Star',subtitle:'Successfully Shoot the Moon',major:true});else enqueue({icon:'🏆',kicker:'Achievement Unlocked',title:'Rook Hunter — Gold',subtitle:'Capture 250 Rooks',progress:1});}
function careerStorageDiagnostic(){const rows=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k)continue;if(k==='rookLifetimeStats'||/rook|hor|stat|career|progress/i.test(k)){const raw=localStorage.getItem(k);let summary='';try{const v=JSON.parse(raw);if(v&&typeof v==='object')summary=Array.isArray(v)?('array · '+v.length+' items'):('object · '+Object.keys(v).length+' keys');else summary=String(v);}catch(e){summary=(raw==null?'null':('text · '+String(raw).length+' chars'));}rows.push({key:k,summary});}}rows.sort((a,b)=>a.key.localeCompare(b.key));return {lifetimePresent:localStorage.getItem('rookLifetimeStats')!==null,lifetimeCharacters:(localStorage.getItem('rookLifetimeStats')||'').length,totalLocalStorageKeys:localStorage.length,rows};}
function showPreview(){ensureCss();let el=document.getElementById('horProgressPreview');if(!el){el=document.createElement('div');el.id='horProgressPreview';document.body.appendChild(el);}const personal=findPersonal(),all=simulateAll(),diag=careerStorageDiagnostic();let body='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h2 style="margin:0">Progression Dry Run</h2><div class="ok">READ ONLY — nothing on this screen awards, migrates, uploads, or changes statistics.</div></div><button onclick="HORProgression.preview.hide()">Close</button></div>';
if(!personal.length)body+='<p class="warn">No exact local lifetime record named Jerome or Host was found on this device. The table below still shows every stored player/bot record.</p>';if(personal.length>1)body+='<p class="warn"><b>Jerome and Host both exist as separate records.</b> Do not merge them automatically until their totals are reviewed.</p>';
body+='<h3>Jerome / Host simulation</h3>'+(personal.length?'<table><tr><th>Name</th><th>Points</th><th>Hands</th><th>Wins</th><th>Level if enabled</th><th>Retroactive medals/feats</th></tr>'+personal.map(x=>'<tr><td>'+x.name+'</td><td>'+x.stats.points.toLocaleString()+'</td><td>'+x.stats.hands.toLocaleString()+'</td><td>'+x.stats.gamesWon.toLocaleString()+'</td><td>'+x.level.level+' — '+x.level.title+'</td><td>'+x.achievementCount+'</td></tr>').join('')+'</table>':'<p>None found.</p>');
body+='<h3>Celebration previews</h3><p>These animations are visual previews only.</p><button onclick="HORProgression.preview.celebrate(\'normal\')">Normal Achievement</button><button onclick="HORProgression.preview.celebrate(\'level\')">Level Up</button><button onclick="HORProgression.preview.celebrate(\'griffin\')">Griffin Tier</button><button onclick="HORProgression.preview.celebrate(\'feat\')">Rare Feat</button>';
body+='<h3>All locally stored careers</h3><table><tr><th>Player</th><th>Type</th><th>Points</th><th>Level</th><th>Achievements if enabled</th></tr>'+all.map(x=>'<tr><td>'+x.name+'</td><td>'+(x.isBot?'Bot':'Human')+'</td><td>'+x.stats.points.toLocaleString()+'</td><td>'+x.level.level+' — '+x.level.title+'</td><td>'+x.achievementCount+'</td></tr>').join('')+'</table>';
body+='<h3>Storage diagnostic</h3><p class="'+(diag.lifetimePresent?'ok':'warn')+'"><b>rookLifetimeStats:</b> '+(diag.lifetimePresent?('PRESENT · '+diag.lifetimeCharacters+' stored characters'):'NOT PRESENT on this browser/device')+'</p><p><b>Total localStorage keys:</b> '+diag.totalLocalStorageKeys+'</p>'+(diag.rows.length?'<table><tr><th>Related storage key</th><th>What is stored</th></tr>'+diag.rows.map(x=>'<tr><td>'+x.key+'</td><td>'+x.summary+'</td></tr>').join('')+'</table>':'<p class="warn">No Rook / House / stats / career / progression storage keys were found.</p>')+'<p style="opacity:.75">Diagnostic is READ ONLY. It does not create, erase, migrate, or alter statistics.</p>';
body+='<p style="opacity:.75;margin-top:18px">Migration marker currently: <b>'+(localStorage.getItem(MIGRATION_KEY)||'NOT MIGRATED')+'</b>. This preview does not change it.</p>';el.innerHTML=body;el.classList.add('show');return {personal,all,diagnostic:diag};}
function hidePreview(){const e=document.getElementById('horProgressPreview');if(e)e.classList.remove('show');}
P.presentation={prefs:presentationPrefs,savePrefs:savePresentationPrefs,enqueue,previewCelebration};
P.preview={legacyStore,normalizeLegacy,simulateName,simulateAll,findPersonal,dryRunDelta,careerStorageDiagnostic,show:showPreview,hide:hidePreview,celebrate:previewCelebration};
})();

/* RookGame453 — Career Protection / Recovery Kit.
 * Local backup/restore works without Cloudflare. Cloud recovery remains dormant until configured.
 * Backup payload includes legacy lifetime stats, progression ledgers, presentation prefs, identity,
 * migration markers and pending sync outbox so an offline career can be restored after storage loss.
 */
(function(){
'use strict';
if(!window.HORProgression) return;
const P=window.HORProgression;
const BACKUP_VERSION=1;
const FRIENDLY_KEY='horFriendlyRecoveryCodeV1';
const LAST_BACKUP_KEY='horLastCareerBackupV1';
function safeParse(s,f){try{return JSON.parse(s);}catch(e){return f;}}
function randomCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=new Uint8Array(12);crypto.getRandomValues(b);let s='';for(const x of b)s+=a[x%a.length];return 'GRF-'+s.slice(0,4)+'-'+s.slice(4,8)+'-'+s.slice(8);}
function friendlyCode(){let c=localStorage.getItem(FRIENDLY_KEY);if(c)return c;c=randomCode();localStorage.setItem(FRIENDLY_KEY,c);return c;}
function collectKeys(){const exact=['rookLifetimeStats','horPlayerIdentityV1','horProgressOutboxV1','horInstallIdV1','horProgressPresentationV1','horProgressMigrationV1',FRIENDLY_KEY,LAST_BACKUP_KEY];const prefixes=['horCareerLedgerV1:','horProgressV1:'];const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k)continue;if(exact.includes(k)||prefixes.some(p=>k.startsWith(p)))data[k]=localStorage.getItem(k);}return data;}
function buildBackup(){const code=friendlyCode();const data=collectKeys();data[FRIENDLY_KEY]=code;return {format:'GriffinHouseOfRooksCareerBackup',version:BACKUP_VERSION,createdAt:new Date().toISOString(),recoveryCode:code,data};}
function downloadBackup(){const payload=buildBackup();const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');const stamp=payload.createdAt.replace(/[:.]/g,'-');a.href=URL.createObjectURL(blob);a.download='Griffin-Rook-Career-Backup-'+stamp+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);localStorage.setItem(LAST_BACKUP_KEY,payload.createdAt);return payload;}
function validateBackup(x){if(!x||x.format!=='GriffinHouseOfRooksCareerBackup'||Number(x.version)!==BACKUP_VERSION||!x.data||typeof x.data!=='object')throw new Error('This is not a valid Griffin House of Rooks career backup.');return x;}
function restoreBackupObject(x,opts){x=validateBackup(x);opts=Object.assign({overwrite:true},opts||{});let restored=0;for(const [k,v] of Object.entries(x.data)){if(v==null)continue;if(!opts.overwrite&&localStorage.getItem(k)!=null)continue;localStorage.setItem(k,String(v));restored++;}localStorage.setItem(LAST_BACKUP_KEY,new Date().toISOString());return {ok:true,restored,recoveryCode:x.recoveryCode||localStorage.getItem(FRIENDLY_KEY)||null,createdAt:x.createdAt};}
function restoreBackupFile(file,opts){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('Could not read backup file.'));r.onload=()=>{try{resolve(restoreBackupObject(JSON.parse(String(r.result||'')),opts));}catch(e){reject(e);}};r.readAsText(file);});}
function protectionStatus(){return {recoveryCode:friendlyCode(),lastBackupAt:localStorage.getItem(LAST_BACKUP_KEY),cloudEnabled:!!(P.CONFIG.enabled&&P.CONFIG.cloudEnabled),localProgressionEnabled:!!P.CONFIG.enabled};}
function showRecoveryKit(){const s=protectionStatus();alert('GRIFFIN HOUSE OF ROOKS — RECOVERY KIT\n\nRecovery Code: '+s.recoveryCode+'\n\nSave this code with your backup file. Until Cloudflare backup is enabled, the code alone cannot recreate erased statistics. Use Backup Career to create the recovery file.');return s;}
P.protection={friendlyCode,buildBackup,downloadBackup,validateBackup,restoreBackupObject,restoreBackupFile,protectionStatus,showRecoveryKit};
})();


/* RookGame454 — live local-career bridge + safe activation controller.
 * Default remains TEST/PREVIEW. Cloud remains OFF.
 * This bridge mirrors the game's authoritative rookLifetimeStats into progression ledgers,
 * so it cannot double-add a completed match. Official bots receive stable bot IDs and
 * retain both a local career and future global-ready identity.
 */
(function(){
'use strict';
if(!window.HORProgression) return;
const P=window.HORProgression;
const MODE_KEY='horProgressModeV1'; // preview | local
const MIGRATION_KEY='horProgressMigrationV1';
const PLAYER_NAME_KEY='horProgressHumanNameV1';
const BOT_REL_PREFIX='horBotRelationshipV1:';
function safeParse(s,f){try{return JSON.parse(s);}catch(e){return f;}}
function mode(){return localStorage.getItem(MODE_KEY)==='local'?'local':'preview';}
function setMode(v){v=v==='local'?'local':'preview';localStorage.setItem(MODE_KEY,v);applyMode();return v;}
function applyMode(){const live=mode()==='local';P.CONFIG.enabled=live;P.CONFIG.uiEnabled=live;P.CONFIG.notificationsEnabled=live;P.CONFIG.identityEnabled=live;P.CONFIG.botProgressionEnabled=live;P.CONFIG.cloudEnabled=false;P.CONFIG.recoveryEnabled=false;P.CONFIG.endpoint='';if(live&&P.activate)P.activate();return live;}
function copyStats(x){const out={};for(const [k,v] of Object.entries(x||{})){if(typeof v==='number'&&Number.isFinite(v))out[k]=v;}return out;}
function actorFor(name,rec){if(rec&&rec.isBot)return {type:'bot',id:P.offline.botActorId(name)};let id=P.offline.humanActorId();return {type:'human',id};}
function syncOne(name,rec,showCelebrations){if(!name||!rec||!P.offline)return null;const a=actorFor(name,rec);const old=P.offline.ledgerRead(a.type,a.id);const oldLevel=P.levelFor(Number(old.stats&&old.stats.points)||0);const oldAch=Object.assign({},old.achievements||{});const next=old;next.displayName=name;next.isBot=!!rec.isBot;next.avatar=rec.avatar||next.avatar||null;next.botStyle=rec.botStyle||next.botStyle||null;next.officialBotId=rec.isBot?a.id:null;next.stats=Object.assign({},next.stats||{},copyStats(rec));const unlocks=P.evaluate(next.stats,oldAch);for(const u of unlocks)next.achievements[u.id]={unlockedAt:new Date().toISOString(),type:u.type,tier:u.tier||null};P.offline.ledgerWrite(a.type,a.id,next);const newLevel=P.levelFor(Number(next.stats.points)||0);if(showCelebrations&&P.CONFIG.notificationsEnabled&&P.presentation){if(newLevel.level>oldLevel.level)P.presentation.enqueue({kind:'level',icon:'★',kicker:'Level Up',title:'Level '+newLevel.level+' — '+newLevel.title,subtitle:name+' reached '+Number(next.stats.points||0).toLocaleString()+' career points.',major:newLevel.level%5===0});for(const u of unlocks){const fam=P.FAMILIES.find(f=>u.id.startsWith(f.id+':'));const title=fam?fam.name+(u.tier?' — '+u.tier:''):u.id;P.presentation.enqueue({icon:u.tier==='Griffin'?'🦅':'🏆',kicker:u.type==='feat'?'Rare Feat':'Achievement Unlocked',title,subtitle:name,major:u.type==='feat'||u.tier==='Griffin'});}}
return {name,actor:a,level:newLevel,unlocks};}
function syncFromLifetime(store,opts){opts=Object.assign({celebrate:true},opts||{});if(mode()!=='local')return {ok:false,reason:'preview-mode'};store=store||safeParse(localStorage.getItem('rookLifetimeStats'),{});const rows=[];for(const [name,rec] of Object.entries(store||{}))rows.push(syncOne(name,rec,opts.celebrate));localStorage.setItem(MIGRATION_KEY,JSON.stringify({version:1,at:new Date().toISOString(),source:'rookLifetimeStats',records:rows.length}));return {ok:true,rows};}
function previewActivation(){const store=safeParse(localStorage.getItem('rookLifetimeStats'),{})||{};const rows=Object.entries(store).map(([name,rec])=>{const e=P.evaluate(rec,{});return {name,isBot:!!rec.isBot,points:Number(rec.points)||0,level:P.levelFor(Number(rec.points)||0),achievements:e.length};});return {mode:mode(),wouldMigrate:rows.length,rows,cloudWillRemainOff:true};}
function activateLocal(){setMode('local');const result=syncFromLifetime(null,{celebrate:false});return {ok:true,mode:'local',cloud:false,migration:result,recoveryCode:P.protection&&P.protection.friendlyCode?P.protection.friendlyCode():null};}
function deactivateLocal(){setMode('preview');return {ok:true,mode:'preview',cloud:false};}
function relationshipRead(botName){return safeParse(localStorage.getItem(BOT_REL_PREFIX+String(botName||'').toLowerCase()),{games:0,humanWins:0,botWins:0,partnerGames:0,partnerWins:0});}
function relationshipWrite(botName,r){localStorage.setItem(BOT_REL_PREFIX+String(botName||'').toLowerCase(),JSON.stringify(r));return r;}
function recordRelationships(players,winnerLabel){if(mode()!=='local'||!Array.isArray(players))return;const human=players.find(p=>p&&!p.isBot);if(!human)return;for(const b of players.filter(p=>p&&p.isBot)){const r=relationshipRead(b.name);r.games++;const hw=(winnerLabel==='Team A'&&human.team===0)||(winnerLabel==='Team B'&&human.team===1);const bw=(winnerLabel==='Team A'&&b.team===0)||(winnerLabel==='Team B'&&b.team===1);if(human.team===b.team){r.partnerGames++;if(hw)r.partnerWins++;}else{if(hw)r.humanWins++;if(bw)r.botWins++;}relationshipWrite(b.name,r);}}
function showActivationPanel(){const pr=previewActivation();const el=document.createElement('div');el.id='horActivationPanel';el.style='position:fixed;inset:4vh 4vw;z-index:2147483600;background:#0c120ff8;color:white;border:2px solid #b88a31;border-radius:16px;padding:18px;overflow:auto;font:15px system-ui;box-shadow:0 20px 80px #000';el.innerHTML='<h2 style="margin-top:0">Career System Test & Activation</h2><p><b>Current mode:</b> '+pr.mode.toUpperCase()+'</p><p><b>Cloudflare progression:</b> OFF. This build will not turn it on.</p><p><b>Existing careers detected:</b> '+pr.wouldMigrate+'</p><p>Use <b>Dry Run</b> first. When satisfied, <b>Turn On Local Careers</b> imports existing lifetime totals once and then keeps levels, achievements and official bot careers current on this device.</p><button id="horDry" style="padding:10px;margin:4px">Dry Run</button><button id="horOn" style="padding:10px;margin:4px">Turn On Local Careers</button><button id="horOff" style="padding:10px;margin:4px">Return to Preview Mode</button><button id="horClose" style="padding:10px;margin:4px">Close</button><div id="horActResult" style="margin-top:12px;white-space:pre-wrap"></div>';document.body.appendChild(el);el.querySelector('#horDry').onclick=()=>{if(P.preview)P.preview.show();};el.querySelector('#horOn').onclick=()=>{const r=activateLocal();el.querySelector('#horActResult').textContent='Local careers are ON. '+r.migration.rows.length+' existing careers were imported. Cloud remains OFF. Recovery code: '+r.recoveryCode;};el.querySelector('#horOff').onclick=()=>{deactivateLocal();el.querySelector('#horActResult').textContent='Returned to PREVIEW mode. Existing saved career data was not deleted.';};el.querySelector('#horClose').onclick=()=>el.remove();return pr;}
P.localCareer={mode,setMode,applyMode,previewActivation,activateLocal,deactivateLocal,syncFromLifetime,recordRelationships,relationshipRead,showActivationPanel};
applyMode();
})();

/* Build 461 targeted Android/Samsung persona-avatar long-press guard.
 * Scope: bot/persona avatar images only. Cards and all other images are untouched. */
(function(){
  'use strict';
  function tagged(el){ return el && el.closest ? el.closest('[data-botname]') : null; }
  function avatarImage(el){
    const host=tagged(el);
    const img=el && el.closest ? el.closest('img') : null;
    return host && img && host.contains(img) ? img : null;
  }
  function blockNativeImageAction(e){
    if(!avatarImage(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }
  document.addEventListener('contextmenu', blockNativeImageAction, {capture:true, passive:false});
  document.addEventListener('dragstart', blockNativeImageAction, {capture:true, passive:false});
  document.addEventListener('selectstart', blockNativeImageAction, {capture:true, passive:false});
  document.addEventListener('touchstart', function(e){
    const img=avatarImage(e.target);
    if(!img) return;
    img.draggable=false;
    img.style.webkitTouchCallout='none';
    img.style.webkitUserSelect='none';
    img.style.userSelect='none';
  }, {capture:true, passive:true});
})();

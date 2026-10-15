/* Griffin House of Rooks — local Career/Stats framework (RookGame450)
 * Local-only Career/Stats. No online user-data storage or sync is included.
 */
(function(){
'use strict';
const CONFIG = {
  enabled: true,                  // Local careers are always available
  uiEnabled: true,
  notificationsEnabled: true,
  botProgressionEnabled: true,
  schemaVersion: 1
};
const LEVELS = [{"level":1,"title":"Rookling","points":0},{"level":2,"title":"New Hand","points":500},{"level":3,"title":"Trick Taker","points":1250},{"level":4,"title":"Nest Hunter","points":2500},{"level":5,"title":"Table Regular","points":4000},{"level":6,"title":"Card Sharp","points":6000},{"level":7,"title":"Rook Chaser","points":8500},{"level":8,"title":"Bidder","points":11500},{"level":9,"title":"Trump Tactician","points":15000},{"level":10,"title":"Rook Veteran","points":20000},{"level":11,"title":"Rook Veteran I","points":25000},{"level":12,"title":"Rook Veteran II","points":30500},{"level":13,"title":"Rook Veteran III","points":36500},{"level":14,"title":"Rook Veteran IV","points":43000},{"level":15,"title":"Seasoned Player","points":50000},{"level":16,"title":"Seasoned Player I","points":59000},{"level":17,"title":"Seasoned Player II","points":68500},{"level":18,"title":"Seasoned Player III","points":78500},{"level":19,"title":"Seasoned Player IV","points":89000},{"level":20,"title":"Rook Expert","points":100000},{"level":21,"title":"Rook Expert I","points":113000},{"level":22,"title":"Rook Expert II","points":127000},{"level":23,"title":"Rook Expert III","points":142000},{"level":24,"title":"Rook Expert IV","points":158000},{"level":25,"title":"Master Bidder","points":175000},{"level":26,"title":"Master Bidder I","points":193000},{"level":27,"title":"Master Bidder II","points":212000},{"level":28,"title":"Master Bidder III","points":232000},{"level":29,"title":"Master Bidder IV","points":253000},{"level":30,"title":"Table Master","points":275000},{"level":31,"title":"Table Master I","points":298000},{"level":32,"title":"Table Master II","points":322000},{"level":33,"title":"Table Master III","points":347000},{"level":34,"title":"Table Master IV","points":373000},{"level":35,"title":"Nest Master","points":400000},{"level":36,"title":"Nest Master I","points":428000},{"level":37,"title":"Nest Master II","points":457000},{"level":38,"title":"Nest Master III","points":487000},{"level":39,"title":"Nest Master IV","points":518000},{"level":40,"title":"Rook Master","points":550000},{"level":41,"title":"Rook Master I","points":585000},{"level":42,"title":"Rook Master II","points":622000},{"level":43,"title":"Rook Master III","points":662000},{"level":44,"title":"Rook Master IV","points":705000},{"level":45,"title":"Griffin Elite","points":750000},{"level":46,"title":"Griffin Elite I","points":798000},{"level":47,"title":"Griffin Elite II","points":849000},{"level":48,"title":"Griffin Elite III","points":900000},{"level":49,"title":"Griffin Elite IV","points":950000},{"level":50,"title":"House Legend","points":1000000}];
const MEDALS = ['Bronze','Silver','Gold','Platinum','Griffin'];
const FAMILIES = [{"id":"career_points","name":"Point Collector","stat":"points","thresholds":[1000,10000,50000,250000,1000000]},{"id":"hands","name":"Old Hand","stat":"hands","thresholds":[25,100,500,2500,10000]},{"id":"games","name":"Game Night","stat":"gamesPlayed","thresholds":[10,50,250,1000,5000]},{"id":"wins","name":"Winner","stat":"gamesWon","thresholds":[5,25,100,500,2500]},{"id":"tricks","name":"Trick Taker","stat":"tricksWon","thresholds":[50,250,1000,5000,20000]},{"id":"high_roller_made","name":"High Roller","stat":"highRollerMade","thresholds":[1,5,25,100,500]},{"id":"red2_hunter","name":"Red 2 Hunter","stat":"red2Captures","thresholds":[10,50,250,1000,5000]},{"id":"big_tricks","name":"Heavy Hitter","stat":"bigTricks","thresholds":[10,50,250,1000,5000]},{"id":"nest_raider","name":"Nest Raider","stat":"nestWins","thresholds":[10,50,250,1000,5000]},{"id":"nest_points","name":"Nest Fortune","stat":"nestPts","thresholds":[250,2500,12500,50000,250000]},{"id":"bids_won","name":"Bid Winner","stat":"bidsWon","thresholds":[10,50,250,1000,5000]},{"id":"bids_made","name":"Contract Keeper","stat":"bidsMade","thresholds":[10,50,250,1000,5000]},{"id":"moon_made","name":"Moonshiner","stat":"moonMade","thresholds":[1,5,25,100,500]},{"id":"moon_attempts","name":"Moon Chaser","stat":"moonAttempts","thresholds":[5,25,100,500,2000]},{"id":"bagger","name":"Bag Collector","stat":"bags","thresholds":[10,50,250,1000,5000]},{"id":"streak","name":"Hot Streak","stat":"longestWinStreak","thresholds":[2,3,5,7,10]},{"id":"exact_bid","name":"Exactly","stat":"exactBidMakes","thresholds":[1,10,50,250,1000]},{"id":"close_wins","name":"Photo Finish","stat":"closeWins","thresholds":[1,10,50,250,1000]},{"id":"routs","name":"Dominator","stat":"routWins","thresholds":[1,10,50,250,1000]},{"id":"sweeps","name":"Clean House","stat":"sweepHands","thresholds":[1,5,25,100,500]},{"id":"bot_partner_wins","name":"Winning Partnership","stat":"bestPartnerWins","thresholds":[5,10,25,50,100]},{"id":"comebacks","name":"Comeback Kid","stat":"comebackWins","thresholds":[1,10,50,250,1000]},{"id":"colors","name":"Trump Traveler","stat":"allTrumpColorWins","thresholds":[1,5,25,100,500]},{"id":"made_streak","name":"Contract Streak","stat":"longestMadeBidStreak","thresholds":[2,3,5,7,10]},{"id":"partners","name":"Partner Power","stat":"samePartnerWins","thresholds":[5,25,100,500,2000]}];
const FEATS = [{"id":"first_trick","name":"First Trick","description":"Win your first trick","stat":"tricksWon","threshold":1},{"id":"first_win","name":"First Victory","description":"Win your first game","stat":"gamesWon","threshold":1},{"id":"perfect_contract_three","name":"Perfect Contract","description":"Make three contracts for exactly the required bid","stat":"exactBidMakes","threshold":3},{"id":"first_red2","name":"Seeing Red","description":"Capture the Red 2","stat":"red2Captures","threshold":1},{"id":"first_nest","name":"Nest Egg","description":"Win your first nest","stat":"nestWins","threshold":1},{"id":"first_bid","name":"I’ll Take It","description":"Win your first bid","stat":"bidsWon","threshold":1},{"id":"first_contract","name":"Made It","description":"Make your first contract","stat":"bidsMade","threshold":1},{"id":"first_moon","name":"Shooting Star","description":"Successfully Shoot the Moon","stat":"moonMade","threshold":1},{"id":"high_bid_150","name":"Bold Bid","description":"Win a bid of 150 or higher","stat":"highBid","threshold":150},{"id":"high_bid_180","name":"Fearless","description":"Win a bid of 180 or higher","stat":"highBid","threshold":180},{"id":"high_bid_200","name":"No Fear","description":"Win a bid of 200 or higher","stat":"highBid","threshold":200},{"id":"hand_150","name":"Big Haul","description":"Capture 150+ points in one hand","stat":"bestHandPoints","threshold":150},{"id":"hand_200","name":"Monster Hand","description":"Capture 200+ points in one hand","stat":"bestHandPoints","threshold":200},{"id":"trick_50","name":"Monster Trick","description":"Take a 50+ point trick","stat":"bestTrickPoints","threshold":50},{"id":"exact_one","name":"Called It","description":"Make a contract exactly","stat":"exactBidMakes","threshold":1},{"id":"close_one","name":"Too Close","description":"Win a game by 5 points or less","stat":"closeWins","threshold":1},{"id":"rout_one","name":"Rout","description":"Win a game by 200+ points","stat":"routWins","threshold":1},{"id":"sweep_one","name":"Clean Sweep","description":"Take every trick in a hand","stat":"sweepHands","threshold":1},{"id":"red2_rescue_first","name":"Red 2 Rescue","description":"Capture an opponent’s Red 2 in a resolved trick or legal claim","stat":"red2Rescues","threshold":1},{"id":"all_colors_one","name":"Four Colors","description":"Win with every trump color","stat":"allTrumpColorWins","threshold":1}];
const EXTRA_DEFAULTS = {
  currentWinStreak:0,longestWinStreak:0,currentMadeBidStreak:0,longestMadeBidStreak:0,
  exactBidMakes:0,closeWins:0,routWins:0,comebackWins:0,sweepHands:0,bestHandPoints:0,bestTrickPoints:0,
  rookAndRed2SameHand:0,highRollerMade:0,red2Rescues:0,bestPartnerWins:0,allTrumpColorWins:0,samePartnerWins:0,trumpWins:{black:0,red:0,green:0,yellow:0},
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
function extrasRead(key){try{return Object.assign(clone(EXTRA_DEFAULTS),JSON.parse(localStorage.getItem('horProgressV1:'+key)||'{}'));}catch(e){return clone(EXTRA_DEFAULTS);}}
function extrasWrite(key,x){if(!CONFIG.enabled)return;try{x.lastUpdated=new Date().toISOString();localStorage.setItem('horProgressV1:'+key,JSON.stringify(x));}catch(e){}}
function activate(){return !!CONFIG.enabled;}
window.HORProgression={CONFIG,LEVELS,FAMILIES,FEATS,MEDALS,EXTRA_DEFAULTS,levelFor,evaluate,extrasRead,extrasWrite,activate};
if(CONFIG.enabled)activate();
})();

/* Career storage implementation is isolated and independently tested. */
HORCareerCore.install(window.HORProgression);

/* RookGame452 — local progression preview + celebration presentation layer.
 * Presentation previews do not award points; canonical career accounting owns all awards.
 * It can preview existing rookLifetimeStats read-only and preview animations manually.
 */
(function(){
'use strict';
if(!window.HORProgression) return;
const P=window.HORProgression;
const PRESENT_KEY='horProgressPresentationV1';
const MIGRATION_KEY='horProgressMigrationV1';
const state={queue:[],active:0,maxVisible:5};
function safeParse(s,f){try{if(s==null||s==='')return f;const v=JSON.parse(s);return v==null?f:v;}catch(e){return f;}}
function presentationPrefs(){return Object.assign({sound:true,nearProgress:true},safeParse(localStorage.getItem(PRESENT_KEY),{}),{mode:'full'});}
function savePresentationPrefs(v){localStorage.setItem(PRESENT_KEY,JSON.stringify(Object.assign(presentationPrefs(),v||{})));}
function legacyStore(){return safeParse(localStorage.getItem('rookLifetimeStats'),{})||{};}
function normalizeLegacy(x){x=x||{};return {
  hands:+x.hands||0,bidsWon:+x.bidsWon||0,highBid:+x.highBid||0,bidsMade:+x.bidsMade||0,bidsSet:+x.bidsSet||0,
  points:+x.points||0,tricksWon:+x.tricksWon||0,rookCaptures:+x.rookCaptures||0,red2Captures:+x.red2Captures||0,
  bigTricks:+x.bigTricks||0,nestWins:+x.nestWins||0,nestPts:+x.nestPts||0,moonAttempts:+x.moonAttempts||0,
  moonMade:+x.moonMade||0,bags:+x.bags||0,gamesPlayed:+x.gamesPlayed||0,gamesWon:+x.gamesWon||0,
  longestWinStreak:+x.longestWinStreak||0,exactBidMakes:+x.exactBidMakes||0,closeWins:+x.closeWins||0,routWins:+x.routWins||0,
  comebackWins:+x.comebackWins||0,sweepHands:+x.sweepHands||0,bestHandPoints:+x.bestHandPoints||0,bestTrickPoints:+x.bestTrickPoints||0,
  rookAndRed2SameHand:+x.rookAndRed2SameHand||0,highRollerMade:+x.highRollerMade||0,red2Rescues:+x.red2Rescues||0,bestPartnerWins:+x.bestPartnerWins||0,allTrumpColorWins:+x.allTrumpColorWins||0,longestMadeBidStreak:+x.longestMadeBidStreak||0,
  samePartnerWins:+x.samePartnerWins||0
};}
function simulateName(name){const raw=legacyStore()[name];if(!raw)return null;const stats=normalizeLegacy(raw);const unlocks=P.evaluate(stats,{});const level=P.levelFor(stats.points);return {name,raw,stats,level,unlocks,achievementCount:unlocks.length,isBot:!!raw.isBot};}
function simulateAll(){const s=legacyStore();return Object.keys(s).map(simulateName).filter(Boolean).sort((a,b)=>b.stats.points-a.stats.points);}
function findPersonal(){const s=legacyStore(), names=Object.keys(s);const exact=[];for(const wanted of ['Jerome','Host']){const hit=names.find(n=>n.toLowerCase()===wanted.toLowerCase());if(hit)exact.push(simulateName(hit));}return exact;}
function dryRunDelta(name,delta){const base=simulateName(name);if(!base)return null;const stats=Object.assign({},base.stats);for(const [k,v] of Object.entries(delta||{})){if(typeof v==='number')stats[k]=(+stats[k]||0)+v;else stats[k]=v;}const already={};for(const u of base.unlocks)already[u.id]=true;return {before:base,after:{stats,level:P.levelFor(stats.points),newUnlocks:P.evaluate(stats,already)}};}
function ensureCss(){if(document.getElementById('horProgressCelebrationCss'))return;const st=document.createElement('style');st.id='horProgressCelebrationCss';st.textContent=`
#horProgressToastHost{position:fixed;right:14px;top:14px;z-index:2147483647;pointer-events:none;width:min(310px,calc(100vw - 24px));font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column;gap:7px}

/* Rook552 — special-event toasts: modern floating House notices, not brown dialogs. */
.hor-ach-toast{background:linear-gradient(145deg,rgba(9,18,17,.96),rgba(14,25,22,.94));border:1px solid rgba(224,187,82,.72);border-radius:16px;box-shadow:0 12px 30px #0008,0 0 22px rgba(212,173,66,.08);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
.hor-ach-toast.hor-major-toast{background:radial-gradient(circle at 18% 35%,rgba(219,183,74,.12),transparent 36%),linear-gradient(145deg,rgba(6,15,18,.97),rgba(13,24,20,.96));border-color:#e1bd5d;box-shadow:0 14px 34px #0009,0 0 28px rgba(225,189,93,.16)}

.hor-ach-toast{position:relative;overflow:hidden;background:linear-gradient(145deg,#101613,#20271d);border:1px solid #c99a36;border-radius:13px;color:#fff;padding:9px 11px 9px 48px;box-shadow:0 9px 28px #0009;min-height:42px;transform:translateX(120%);opacity:0;transition:.42s cubic-bezier(.2,.8,.2,1)}
.hor-ach-toast.show{transform:translateX(0);opacity:1}.hor-ach-toast.hide{transform:translateX(120%);opacity:0}.hor-ach-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:24px;filter:drop-shadow(0 0 7px #d5aa4b88)}
.hor-ach-kicker{font-size:9px;letter-spacing:.13em;color:#e7c66e;text-transform:uppercase;font-weight:800}.hor-ach-title{font-size:15px;font-weight:850;margin-top:2px}.hor-ach-sub{font-size:10.5px;color:#ddd;margin-top:3px}.hor-ach-shine{position:absolute;inset:-50%;background:linear-gradient(100deg,transparent 42%,#fff5 50%,transparent 58%);transform:translateX(-70%) rotate(8deg);animation:horShine 1.2s .2s ease-out 1}@keyframes horShine{to{transform:translateX(70%) rotate(8deg)}}
.hor-level-toast{border-color:#f2cf68;background:radial-gradient(circle at 20% 20%,#51431c,#151b15 58%)}.hor-major-toast{min-height:56px;border-width:2px;box-shadow:0 0 28px #e0b84d55,0 15px 45px #000b}.hor-progressbar{height:6px;background:#ffffff20;border-radius:8px;margin-top:8px;overflow:hidden}.hor-progressbar>i{display:block;height:100%;background:#e5bd58;width:0;transition:width .8s .25s ease}
#horProgressPreview{position:fixed;inset:3vh 3vw;z-index:2147483640;background:#0d120ff7;color:#fff;border:2px solid #b88a31;border-radius:18px;box-shadow:0 20px 70px #000;display:none;overflow:auto;padding:18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif}#horProgressPreview.show{display:block}#horProgressPreview button{background:#2b342b;color:#fff;border:1px solid #b88a31;border-radius:9px;padding:9px 12px;margin:4px;font-weight:700}#horProgressPreview table{width:100%;border-collapse:collapse;margin-top:12px}#horProgressPreview th,#horProgressPreview td{padding:7px;border-bottom:1px solid #ffffff18;text-align:left}#horProgressPreview .warn{color:#ffd276}#horProgressPreview .ok{color:#aee6a5}`;document.head.appendChild(st);}
function host(){ensureCss();let h=document.getElementById('horProgressToastHost');if(!h){h=document.createElement('div');h.id='horProgressToastHost';document.body.appendChild(h);}return h;}
function tone(){if(presentationPrefs().sound&&window.horPlayNatural063)window.horPlayNatural063('wood',.35);}
function localAward(ev){const id=P.core?.read()?.identity?.id;return !!(ev&&ev.human===true&&!ev.remote&&id&&ev.careerRef===P.core.digest(id).slice(0,16));}
function enqueue(ev){if(!localAward(ev))return;if(window.HORRavenFight741?.deferCelebration(()=>enqueue(ev)))return;state.queue.push(ev);pump();}
function pump(){if(window.HORRavenFight741?.deferCelebration(pump))return;const prefs=presentationPrefs();while(state.active<state.maxVisible&&state.queue.length){const ev=state.queue.shift();if(!localAward(ev))continue;state.active++;const h=host(),d=document.createElement('div');const major=!!ev.major;d.className='hor-ach-toast '+(ev.kind==='level'?'hor-level-toast ':'')+(major?'hor-major-toast ':'');d.innerHTML='<span class="hor-ach-icon">'+(ev.icon||'🏆')+'</span><div class="hor-ach-kicker">'+(ev.kicker||'Achievement Unlocked')+'</div><div class="hor-ach-title">'+(ev.title||'Achievement')+'</div><div class="hor-ach-sub">'+(ev.subtitle||'')+'</div>'+(ev.progress!=null?'<div class="hor-progressbar"><i></i></div>':'')+(prefs.mode==='full'?'<span class="hor-ach-shine"></span>':'');h.appendChild(d);requestAnimationFrame(()=>{d.classList.add('show');const b=d.querySelector('.hor-progressbar i');if(b)b.style.width=Math.max(0,Math.min(100,ev.progress*100))+'%';});if(major&&ev.kind!=='level'&&prefs.sound&&window.horPlayAwardCrowd041)window.horPlayAwardCrowd041();else tone();const ms=prefs.mode==='minimal'?1500:(major?3200:2400);d.__presentationTimer741=(window.HORRavenFight741?.later||setTimeout)(()=>{d.classList.add('hide');d.__presentationTimer741=(window.HORRavenFight741?.later||setTimeout)(()=>{d.remove();state.active=Math.max(0,state.active-1);pump();},450);},ms);}}
function previewCelebration(kind){const own=ev=>Object.assign(ev,{human:true,careerRef:P.core?.digest(P.core?.read()?.identity?.id||'').slice(0,16)});const enqueue=ev=>P.presentation.enqueue(own(ev));if(kind==='level')enqueue({kind:'level',icon:'★',kicker:'Level Up',title:'Level 25 — Master Bidder',subtitle:'Your Rook career just reached a new level.',progress:.08,major:true});else if(kind==='griffin')enqueue({icon:'🦅',kicker:'Griffin Medal Earned',title:'Rook Hunter — Griffin',subtitle:'Capture 5,000 Rooks',major:true});else if(kind==='feat')enqueue({icon:'🌙',kicker:'Rare Feat',title:'Shooting Star',subtitle:'Successfully Shoot the Moon',major:true});else enqueue({icon:'🏆',kicker:'Achievement Unlocked',title:'Rook Hunter — Gold',subtitle:'Capture 250 Rooks',progress:1});}
function careerStorageDiagnostic(){const rows=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k)continue;if(k==='rookLifetimeStats'||/rook|hor|stat|career|progress/i.test(k)){const raw=localStorage.getItem(k);let summary='';try{const v=JSON.parse(raw);if(v&&typeof v==='object')summary=Array.isArray(v)?('array · '+v.length+' items'):('object · '+Object.keys(v).length+' keys');else summary=String(v);}catch(e){summary=(raw==null?'null':('text · '+String(raw).length+' chars'));}rows.push({key:k,summary});}}rows.sort((a,b)=>a.key.localeCompare(b.key));return {lifetimePresent:localStorage.getItem('rookLifetimeStats')!==null,lifetimeCharacters:(localStorage.getItem('rookLifetimeStats')||'').length,totalLocalStorageKeys:localStorage.length,rows};}
function showPreview(){ensureCss();let el=document.getElementById('horProgressPreview');if(!el){el=document.createElement('div');el.id='horProgressPreview';document.body.appendChild(el);}const personal=findPersonal(),all=simulateAll(),diag=careerStorageDiagnostic();let body='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h2 style="margin:0">Progression Dry Run</h2><div class="ok">READ ONLY — nothing on this screen awards, migrates, uploads, or changes statistics.</div></div><button onclick="HORProgression.preview.hide()">Close</button></div>';
if(!personal.length)body+='<p class="warn">No exact local lifetime record named Jerome or Host was found on this device. The table below still shows every stored player/bot record.</p>';if(personal.length>1)body+='<p class="warn"><b>Jerome and Host both exist as separate records.</b> Do not merge them automatically until their totals are reviewed.</p>';
body+='<h3>Jerome / Host simulation</h3>'+(personal.length?'<table><tr><th>Name</th><th>Points</th><th>Hands</th><th>Wins</th><th>Level if enabled</th><th>Retroactive medals/feats</th></tr>'+personal.map(x=>'<tr><td>'+x.name+'</td><td>'+x.stats.points.toLocaleString()+'</td><td>'+x.stats.hands.toLocaleString()+'</td><td>'+x.stats.gamesWon.toLocaleString()+'</td><td>'+x.level.level+' — '+x.level.title+'</td><td>'+x.achievementCount+'</td></tr>').join('')+'</table>':'<p>None found.</p>');
body+='<h3>Celebration previews</h3><p>These animations are visual previews only.</p><button onclick="HORProgression.preview.celebrate(\'normal\')">Normal Achievement</button><button onclick="HORProgression.preview.celebrate(\'level\')">Level Up</button><button onclick="HORProgression.preview.celebrate(\'griffin\')">Griffin Tier</button><button onclick="HORProgression.preview.celebrate(\'feat\')">Rare Feat</button>';
body+='<h3>All locally stored careers</h3><table><tr><th>Player</th><th>Type</th><th>Points</th><th>Level</th><th>Achievements if enabled</th></tr>'+all.map(x=>'<tr><td>'+x.name+'</td><td>'+(x.isBot?'Bot':'Human')+'</td><td>'+x.stats.points.toLocaleString()+'</td><td>'+x.level.level+' — '+x.level.title+'</td><td>'+x.achievementCount+'</td></tr>').join('')+'</table>';
body+='<h3>Storage diagnostic</h3><p class="'+(diag.lifetimePresent?'ok':'warn')+'"><b>rookLifetimeStats:</b> '+(diag.lifetimePresent?('PRESENT · '+diag.lifetimeCharacters+' stored characters'):'NOT PRESENT on this browser/device')+'</p><p><b>Total localStorage keys:</b> '+diag.totalLocalStorageKeys+'</p>'+(diag.rows.length?'<table><tr><th>Related storage key</th><th>What is stored</th></tr>'+diag.rows.map(x=>'<tr><td>'+x.key+'</td><td>'+x.summary+'</td></tr>').join('')+'</table>':'<p class="warn">No Rook / House / stats / career / progression storage keys were found.</p>')+'<p style="opacity:.75">Diagnostic is READ ONLY. It does not create, erase, migrate, or alter statistics.</p>';
body+='<p style="opacity:.75;margin-top:18px">Migration marker currently: <b>'+(localStorage.getItem(MIGRATION_KEY)||'NOT MIGRATED')+'</b>. This preview does not change it.</p>';el.innerHTML=body;el.classList.add('show');return {personal,all,diagnostic:diag};}
function hidePreview(){const e=document.getElementById('horProgressPreview');if(e)e.classList.remove('show');}
P.presentation={resetVisuals(){state.queue.length=0;state.active=0;document.querySelectorAll('#horProgressToastHost .hor-ach-toast').forEach(d=>(window.HORRavenFight741?.stopClock||clearTimeout)(d.__presentationTimer741));document.getElementById('horProgressToastHost')?.replaceChildren();},prefs:presentationPrefs,savePrefs:savePresentationPrefs,enqueue,previewCelebration};
P.preview={legacyStore,normalizeLegacy,simulateName,simulateAll,findPersonal,dryRunDelta,careerStorageDiagnostic,show:showPreview,hide:hidePreview,celebrate:previewCelebration};
})();

/* RookGame454 — live local-career bridge + safe activation controller.
 * Local careers are always enabled. Cloud remains OFF.
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
function safeParse(s,f){try{if(s==null||s==='')return f;const v=JSON.parse(s);return v==null?f:v;}catch(e){return f;}}
function mode(){return 'local';}
function applyMode(){try{localStorage.setItem(MODE_KEY,'local');}catch(e){}P.CONFIG.enabled=P.CONFIG.uiEnabled=P.CONFIG.notificationsEnabled=P.CONFIG.botProgressionEnabled=true;P.core.migrate();return true;}
function setMode(){applyMode();try{window.horCareerModeChanged?.('local');}catch(e){}return 'local';}
function syncFromLifetime(store,opts){return P.careerAdapters.sync(store,opts);}
function previewActivation(){const store=safeParse(localStorage.getItem('rookLifetimeStats'),{})||{};return {mode:mode(),wouldMigrate:Object.keys(store).length,rows:Object.keys(store).map(name=>({name,isBot:!!store[name].isBot,points:store[name].points||0,level:P.levelFor(store[name].points||0),achievements:P.evaluate(store[name],{}).length})),cloudWillRemainOff:true};}
function activateLocal(opts){const r=P.careerAdapters.activate(opts);applyMode();return r;}
function relationshipRead(name){return P.careerAdapters.relationshipRead(name);}
function recordRelationships(){return {ok:true,source:'atomic-hand-event'};}
function publicProfile(){return P.careerAdapters.profile();}
function botPublicProfile(name){return P.careerAdapters.profile('bot',P.offline.botActorId(name),name);}
function showCareerCard(profile){
 if(window.HORBidRepair737?.required()){window.horToast?.('Finish your bid before viewing a player.');return false;}
 if(!profile||!profile.enabled)return false;
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const num=x=>Math.max(0,Number(x)||0).toLocaleString();
 const human=profile.isBot!==true;
 
 const ledger=(()=>{try{if(profile.careerRef!==P.core.digest(P.core.read()?.identity.id||'').slice(0,16))return {stats:profile,achievements:Object.fromEntries((profile.achievements||[]).map(id=>[id,true])),partners:profile.partners||{},retiredAchievements:profile.retiredAchievements||{}};const id=human?P.offline.humanActorId():P.offline.botActorId(profile.displayName);return P.offline.ledgerRead(human?'human':'bot',id)||{};}catch(e){return {};}})();
 const stats=ledger.stats||{};
 const earned=ledger.achievements||{};
 const families=P.FAMILIES||[],feats=P.FEATS||[];
 const entries=[];
 families.forEach(f=>{
   const val=Math.max(0,Number(stats[f.stat])||0),thresholds=f.thresholds||[];
   const tiers=thresholds.reduce((highest,t,i)=>earned[f.id+'_'+(i+1)]?i+1:highest,0);
   if(f.id==='bagger'){if(tiers)entries.push({name:f.name+' · Historical',detail:'Retired rule; earned medals are kept.',value:1,target:1,remaining:0,complete:true,earned:P.MEDALS[tiers-1]+' · '+tiers+' / '+thresholds.length});return;}
   const next=thresholds[Math.min(tiers,thresholds.length-1)]||0;
   const complete=tiers>=thresholds.length;
   entries.push({name:f.name,detail:complete?'All five medals earned':((P.MEDALS||[])[tiers]||'Next medal'),value:val,target:next,remaining:complete?0:Math.max(0,next-val),complete,earned:tiers?P.MEDALS[tiers-1]+' · '+tiers+' / '+thresholds.length:'Not yet earned',unverified:!Number.isFinite(Number(stats[f.stat]))});
 });
 feats.forEach(f=>{const complete=!!earned[f.id],val=Math.max(0,Number(stats[f.stat])||0),target=Number(f.threshold)||1;entries.push({name:f.name,detail:f.description||'Special feat',value:val,target,remaining:complete?0:Math.max(0,target-val),complete,earned:complete?'Earned':'Locked',unverified:!Number.isFinite(Number(stats[f.stat]))});});
 for(const id of Object.keys(ledger.retiredAchievements||{}))entries.push({name:'Historical award · '+id.replaceAll('_',' '),detail:'Retired achievement preserved from your saved career',value:1,target:1,remaining:0,complete:true,earned:'Retired · earned'});
 const best=Object.values(ledger.partners||profile.partners||{}).filter(p=>p.games>0).sort((a,b)=>b.wins-a.wins||(b.wins/b.games)-(a.wins/a.games)||a.name.localeCompare(b.name))[0]||null;
 let style=document.getElementById('horCareerCardFitStyle');
 if(!style){style=document.createElement('style');style.id='horCareerCardFitStyle';style.textContent=`
 #horCareerBackdrop{position:fixed;inset:0;background:#0009;z-index:2147483637;touch-action:manipulation}
 #horPublicCareerCard{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;width:min(620px,calc(100vw - 20px));height:min(560px,calc(100dvh - 20px));z-index:2147483638;background:#0c120ff8;color:#fff;border:2px solid #b88a31;border-radius:16px;padding:12px;font:13px/1.25 system-ui;box-shadow:0 20px 80px #000;overflow:hidden;display:flex;flex-direction:column;gap:8px}
 #horPublicCareerCard *{box-sizing:border-box}
 #horPublicCareerCard h2{font-size:clamp(15px,4vw,20px);margin:0;overflow-wrap:anywhere}
 #horPublicCareerCard .career-level{color:#e7c66b;font-size:12px}
 #horPublicCareerCard .career-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;border:1px solid #b88a31;flex-shrink:0}
 #horPublicCareerCard button{min-width:44px;min-height:38px;padding:5px 10px;border:1px solid #b88a31;border-radius:8px;background:#182019;color:#fff;font:inherit;touch-action:manipulation}
 #horPublicCareerCard button:disabled{opacity:.35}
 #horPublicCareerCard .career-head,#horPublicCareerCard .career-nav{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0}
 #horPublicCareerCard .career-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:7px}
 #horPublicCareerCard .career-points{padding:7px;border:1px solid #b88a3155;border-radius:7px}
 #horPublicCareerCard .career-points strong{color:#e7c66b;font-size:16px}
 #horPublicCareerCard .career-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 #horPublicCareerCard .career-stat,#horPublicCareerCard .career-ach{background:#ffffff0a;padding:7px;border-radius:7px;min-width:0}
 #horPublicCareerCard .career-stat span{display:block;color:#d3c8ad;font-size:11px}
 #horPublicCareerCard .career-stat strong{font-size:15px}
 #horPublicCareerCard .career-ach{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:3px}
 #horPublicCareerCard .career-ach small{color:#d3c8ad}
 #horPublicCareerCard .career-meter{height:5px;border-radius:8px;background:#41443e;overflow:hidden}
 #horPublicCareerCard .career-meter i{display:block;height:100%;background:#d2ae56}
 #horPublicCareerCard .career-nav{margin-top:auto}
 @media(max-height:480px){#horPublicCareerCard{gap:4px;padding:7px;font-size:11px}#horPublicCareerCard .career-body{gap:4px}#horPublicCareerCard .career-ach{padding:4px}#horPublicCareerCard .career-stats{gap:4px}#horPublicCareerCard .career-stat{padding:4px}}
 `;document.head.appendChild(style);}
 let backdrop=document.getElementById('horCareerBackdrop');if(!backdrop){backdrop=document.createElement('div');backdrop.id='horCareerBackdrop';document.body.appendChild(backdrop);}
 let el=document.getElementById('horPublicCareerCard');if(!el){el=document.createElement('div');el.id='horPublicCareerCard';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');document.body.appendChild(el);}
 let page=0;
 if(el._horCareerClose){el._horCareerClose();}
 const previousFocus=document.activeElement;let closed=false;
 const perPage=()=>window.innerHeight<480?2:window.innerHeight<660?4:5;
 const pageCount=()=>1+Math.ceil(entries.length/perPage());
 function close(e,back=false){if(e){e.preventDefault();e.stopPropagation();}if(closed)return;closed=true;el.style.display='none';backdrop.style.display='none';document.removeEventListener('keydown',onKey,true);backdrop.removeEventListener('pointerdown',onBackdrop);window.removeEventListener('resize',onResize);el._horCareerClose=null;previousFocus?.focus?.({preventScroll:true});window.dispatchEvent(new CustomEvent('hor-career-card-closed',{detail:{back}}));}
 function onBackdrop(e){
   e.preventDefault();e.stopImmediatePropagation();
   // Keep the dismissal gesture from landing on the newly exposed table.
   window.__horCareerDismissGesture=true;
   const types=['pointerup','mouseup','touchend','click','pointercancel'];
   let timer;
   const cleanup=()=>{window.__horCareerDismissGesture=false;clearTimeout(timer);for(const type of types)document.removeEventListener(type,swallow,true);document.removeEventListener('pointerdown',cleanup,true);};
   const swallow=ev=>{ev.preventDefault();ev.stopImmediatePropagation();if(ev.type==='click'||ev.type==='pointercancel')cleanup();else {clearTimeout(timer);timer=setTimeout(cleanup,500);}};
   for(const type of types)document.addEventListener(type,swallow,{capture:true,passive:false});
   document.addEventListener('pointerdown',cleanup,true);
   close();
 }
 function onResize(){if(!closed){page=Math.min(page,pageCount()-1);render();}}
 function onKey(e){if(e.key==='Escape'){close(e);}else if(e.key==='Tab'){const items=[...el.querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);e.preventDefault();items[(i+(e.shiftKey?-1:1)+items.length)%items.length]?.focus();}}
 backdrop.addEventListener('pointerdown',onBackdrop,{passive:false});
 window.addEventListener('resize',onResize);el._horCareerClose=close;
 el.onpointerdown=e=>e.stopPropagation();
 function render(){
   const max=pageCount(),winpct=profile.gamesPlayed?Math.round(100*profile.gamesWon/profile.gamesPlayed):0;
   let body='';
   if(page===0){
     const rows=[['Games Played',num(profile.gamesPlayed)],['Games Won',num(profile.gamesWon)+' ('+winpct+'%)']];
     const partner=best?esc(best.name)+' · '+num(best.wins)+' wins · '+Math.round(best.wins/best.games*100)+'%':'No verified partnership history yet';
     body='<div class="career-points"><strong>'+num(profile.points)+'</strong> Career Points · '+(profile.nextThreshold?num(Math.max(0,profile.nextThreshold-profile.points))+' to next level':'Maximum level')+'</div><div class="career-stats">'+rows.map(([k,v])=>'<div class="career-stat"><span>'+k+'</span><strong>'+v+'</strong></div>').join('')+'</div><div class="career-stat"><span>Best Bot Partner</span><strong>'+partner+'</strong></div><div class="career-stat"><span>Achievements Earned</span><strong>'+num(profile.achievementCount)+' / '+(families.length*5+feats.length)+(profile.retiredAchievementCount?' + '+num(profile.retiredAchievementCount)+' retired':'')+'</strong></div>';
     if(profile.personaTitle||profile.personaHabit||profile.personaHow)body='<div class="career-stat career-persona"><span>Playing persona</span><strong>'+esc(profile.personaTitle||'House Player')+'</strong><div>'+esc(profile.personaHabit||'')+'</div><small>'+esc(profile.personaHow||'')+'</small></div>'+body;
   }else{
     const chunk=entries.slice((page-1)*perPage(),page*perPage());
     body=chunk.map(a=>{const pct=a.complete?100:(a.target?Math.min(100,Math.max(0,a.value/a.target*100)):0);return '<div class="career-ach"><div><b>'+esc(a.name)+'</b> · '+esc(a.earned)+'</div><small>'+esc(a.detail)+'</small><div class="career-meter"><i style="width:'+pct+'%"></i></div><small>'+(a.complete?'Completed':num(a.value)+' / '+num(a.target)+' · '+num(a.remaining)+' more needed')+'</small></div>';}).join('');
   }
   const avatarValue=(typeof avatarSrc==='function' && profile.avatar && !profile.avatar.startsWith('assets/'))?avatarSrc(profile.avatar):profile.avatar;
   const avatar=(typeof avatarValue==='string' && /^(assets\/|data:image\/(?:png|jpeg|webp);base64,)/.test(avatarValue))?'<img src="'+esc(avatarValue)+'" alt="" style="width:38px;height:38px;object-fit:cover;border-radius:50%">':'';
   el.innerHTML='<div class="career-head"><div style="display:flex;align-items:center;gap:8px">'+avatar+'<div><h2 id="horCareerName">'+esc(profile.displayName||'Player')+'</h2><div class="career-level">★ Level '+num(profile.level||1)+' · '+esc(profile.title||'Rookling')+'</div></div></div><div><button id="horCareerCardBack" aria-label="Back to Career menu">‹ Back</button><button id="horCareerCardClose" aria-label="Close career card">✕</button></div></div><div class="career-body">'+body+'</div><div class="career-nav"><button id="horCareerPrev" '+(page===0?'disabled':'')+'>← Previous</button><span>'+(page===0?'Career':'Achievements')+' · '+(page+1)+' / '+max+'</span><button id="horCareerNext" '+(page===max-1?'disabled':'')+'>Next →</button></div>';
   el.querySelector('#horCareerCardClose').onclick=close;el.querySelector('#horCareerCardBack').onclick=e=>close(e,true);
   el.querySelector('#horCareerPrev').onclick=()=>{if(page>0){page--;render();}};
   el.querySelector('#horCareerNext').onclick=()=>{if(page<pageCount()-1){page++;render();}};
 }
 backdrop.style.display='block';el.style.display='flex';document.addEventListener('keydown',onKey,true);render();el.querySelector('#horCareerCardClose').focus({preventScroll:true});return true;
}
function showCareerGuide(){let el=document.getElementById('horCareerGuide');if(!el){el=document.createElement('div');el.id='horCareerGuide';el.style='position:fixed;inset:5vh 5vw;z-index:2147483635;background:#0c120ff8;color:#fff;border:2px solid #b88a31;border-radius:16px;padding:18px;overflow:auto;font:14px system-ui;box-shadow:0 20px 80px #000';document.body.appendChild(el);}const esc=x=>String(x==null?'':x).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));let h='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h2 style="margin:0">Career Levels & Achievements</h2><div style="opacity:.8">Reference guide — viewing this does not turn Careers on.</div></div><button id="horGuideClose" style="padding:10px">Close</button></div><h3>50 Career Levels</h3><table style="width:100%;border-collapse:collapse"><tr><th>Level</th><th>Title</th><th>Career Points Required</th></tr>'+P.LEVELS.map(x=>'<tr><td>'+x.level+'</td><td>'+esc(x.title)+'</td><td>'+Number(x.points||0).toLocaleString()+'</td></tr>').join('')+'</table><h3>125 Tiered Achievement Awards</h3><p>25 achievement families × Bronze, Silver, Gold, Platinum and Griffin tiers.</p>'+P.FAMILIES.map(f=>'<div style="margin:12px 0;padding:10px;border:1px solid #ffffff22;border-radius:10px"><b>'+esc(f.name)+'</b><div>'+P.MEDALS.map((m,i)=>'<span style="display:inline-block;margin:5px 8px 0 0">'+m+': <b>'+Number(f.thresholds[i]||0).toLocaleString()+'</b></span>').join('')+'</div></div>').join('')+'<h3>20 Special / Rare Feats</h3>'+P.FEATS.map(a=>'<div style="margin:8px 0;padding:9px;border-bottom:1px solid #ffffff18"><b>'+esc(a.name)+'</b> — '+esc(a.description)+' <span style="opacity:.75">(requirement: '+Number(a.threshold||0).toLocaleString()+')</span></div>').join('')+'<p style="opacity:.75"><b>Total:</b> 145 achievement awards/feats, plus 50 Career Levels.</p>';el.innerHTML=h;el.style.display='block';el.querySelector('#horGuideClose').onclick=()=>el.style.display='none';return true;}

function restoreCareerFromRecoveryCode(){
 const input=document.createElement('input');input.type='file';input.setAttribute('data-hor-career-export','1');input.style.display='none';document.body.appendChild(input);
 // Android file providers do not consistently label JSON with application/json.
 // Allow selection, then validate the full backup structure before writing anything.
 const status=message=>{const out=document.getElementById('horActResult');if(out){out.setAttribute('role','status');out.setAttribute('aria-live','polite');out.textContent=message;}};
 input.onchange=async()=>{const file=input.files?.[0];if(!file){input.remove();return;}try{status('Checking backup…');const result=await P.protection.restoreBackupFile(file);if(result.testProfile){status('Opening the separate test career. Your original career is kept.');return;}applyMode();const message=result.duplicate?'This backup is already present.':'Career restored and verified. Reload to refresh your name and preferences.';status(message);alert(message);}catch(e){const message='Career not replaced: '+e.message;status(message);alert(message);}finally{input.remove();}};
 input.addEventListener('cancel',()=>input.remove(),{once:true});input.click();return input;
}

const TEST_BACKUP_KEY='horCareerExpertTestBackupV1';
function expertHumanName(store){store=store||safeParse(localStorage.getItem('rookLifetimeStats'),{})||{};const saved=localStorage.getItem(PLAYER_NAME_KEY);if(saved&&store[saved]&&!store[saved].isBot)return saved;const own=Object.keys(store).find(n=>store[n]&&!store[n].isBot);return own||saved||'Player';}
function expertBackup(){const payload={at:new Date().toISOString(),lifetime:localStorage.getItem('rookLifetimeStats'),mode:localStorage.getItem(MODE_KEY)};localStorage.setItem(TEST_BACKUP_KEY,JSON.stringify(payload));return payload;}
function expertRestore(){return {ok:false,reason:'Use a validated exported Career Backup.'};}
function expertPreset(){return {ok:false,reason:'Counter presets are disabled on durable careers. Use disposable test fixtures.'};}
function showExpertTestLab(result){let box=document.getElementById('horExpertCareerLab');if(box){box.remove();return;}box=document.createElement('div');box.id='horExpertCareerLab';box.style='margin-top:14px;padding:12px;border:1px solid #b88a31;border-radius:12px;background:#080c0a';box.innerHTML='<h3 style="margin-top:0">Expert Career / Stats Test Lab</h3><p style="opacity:.8">Uses the real local lifetime-stat store and production Career sync/evaluation. Presets stop one count below a real threshold so the next normal game event can earn it.</p><button data-x="backup">BACKUP CURRENT CAREER/STATS</button> <button data-x="restore">RESTORE TEST BACKUP</button><br><br><button data-p="level">Near Next Level</button> <button data-p="achievement">Near Achievement</button> <button data-p="medal">Near Medal/Award</button> <button data-p="level">Level-Up Ready</button> <button data-p="rare">Rare Feat Test</button><pre id="horExpertResult" style="white-space:pre-wrap"></pre>';const host=document.getElementById('horActivationPanel');host.appendChild(box);const out=box.querySelector('#horExpertResult');box.querySelector('[data-x="backup"]').onclick=()=>{expertBackup();out.textContent='Backup saved on this device.';};box.querySelector('[data-x="restore"]').onclick=()=>{if(!confirm('Restore the Career/Stats test backup? Current test changes will be replaced.'))return;const r=expertRestore();out.textContent=r.ok?'Test backup restored.':'No test backup exists.';};box.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{if(!localStorage.getItem(TEST_BACKUP_KEY)){if(!confirm('This will change real local Career/stat counters for testing. Create a backup and continue?'))return;expertBackup();}const r=expertPreset(b.dataset.p);out.textContent=r.ok?('Preset applied to '+r.name+'. Play normally to cross the production threshold.'):r.reason;});}

function showActivationPanel(){const pr=previewActivation();const el=document.createElement('div');el.id='horActivationPanel';el.style='position:fixed;inset:4vh 4vw;z-index:2147483600;background:#0c120ff8;color:white;border:2px solid #b88a31;border-radius:16px;padding:18px;overflow:auto;font:15px system-ui';el.innerHTML='<h2>Career Diagnostics</h2><p>Careers, levels and local-player awards are always enabled. Cloud storage remains off.</p><button id="horDry">Dry Run</button><button id="horGuide">Levels & Achievements</button><button id="horCode">Download Recovery Information</button><button id="horRestoreRecovery">Restore Career Backup</button><button id="horBackup">Download Career Backup</button><button id="horExpertLab">Expert Test Lab</button><button id="horClose">Close</button><div id="horActResult"></div>';document.body.appendChild(el);el.querySelector('#horDry').onclick=()=>P.preview.show();el.querySelector('#horGuide').onclick=showCareerGuide;el.querySelector('#horCode').onclick=()=>P.protection.downloadRecoveryCode();el.querySelector('#horRestoreRecovery').onclick=restoreCareerFromRecoveryCode;el.querySelector('#horBackup').onclick=()=>P.protection.downloadBackup();el.querySelector('#horExpertLab').onclick=()=>{el.querySelector('#horActResult').textContent='Career test fixtures run only on disposable test data; saved careers cannot be changed by presets.';};el.querySelector('#horClose').onclick=()=>el.remove();return pr;}
P.localCareer={mode,setMode,applyMode,previewActivation,activateLocal,syncFromLifetime,recordRelationships,relationshipRead,publicProfile,botPublicProfile,showCareerCard,showCareerGuide,restoreCareerFromRecoveryCode,showActivationPanel,expertBackup,expertRestore,expertPreset};
applyMode();try{if(typeof window.horCareerModeChanged==='function')window.horCareerModeChanged(mode());}catch(e){}
try{window.dispatchEvent(new CustomEvent('hor-career-ready',{detail:{mode:mode()}}));}catch(e){}
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

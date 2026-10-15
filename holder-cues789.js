/* Local presentation only. Never owns turns, hands, scores, AI or network state. */
(()=>{'use strict';
const preference='horHolderCueVibrationV1',motion=matchMedia('(prefers-reduced-motion:reduce)');
let area=null,live=null,current=null,local=-1,spectator=false,cycle='',turn='',shown='',win='',pendingWin='',pendingCards='',timer=0,frame=0,token=0,hapticTimer=0,ownsHaptic=false;
let enabled=true;try{enabled=localStorage.getItem(preference)!=='0';}catch(_){}
const heard=new Set(),seenWins=new Set(),events=[];
function record(type,data={}){events.push({type,at:performance.now(),...data});if(events.length>120)events.shift();}
function reduced(){return motion.matches||(typeof reduceMotion!=='undefined'&&reduceMotion);}
function eligible(){return current&&Number.isInteger(local)&&local>=0&&!spectator&&current.players?.[local]&&!current.players[local].isBot;}
function present(){
 if(!eligible()||document.hidden||current.paused||!document.body.classList.contains('in-game')||!area)return false;
 const r=area.getBoundingClientRect(),s=getComputedStyle(area);
 return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&s.display!=='none'&&s.visibility!=='hidden'&&!document.body.classList.contains('he064-open');
}
function opportunity(){
 if(!eligible()||current.paused||current.claimAnimating||current.resolvingTrick)return '';
 const g=current,actor=(g.phase==='discard'||g.phase==='trump')?g.bidder:g.currentPlayer;
 if(actor!==local||!['bidding','discard','trump','play'].includes(g.phase))return '';
 const cards=(g.tricksTaken||[]).reduce((n,a)=>n+(a?.length||0),0);
 return cycle+'|'+g.phase+'|'+actor+'|'+(g.phase==='bidding'?g.highestBid||0:g.phase==='play'?cards+':'+(g.trick||[]).map(t=>t.card?.id).join(','):'');
}
function vibrate(pattern){
 if(!enabled||!present()||typeof navigator.vibrate!=='function')return;
 try{if(navigator.vibrate(pattern)!==false){ownsHaptic=true;clearTimeout(hapticTimer);const duration=Array.isArray(pattern)?pattern.reduce((a,b)=>a+b,0):pattern;hapticTimer=setTimeout(()=>{ownsHaptic=false},duration);record('vibration',{pattern})}}catch(_){}
}
function stopHaptic(){clearTimeout(hapticTimer);if(ownsHaptic){try{navigator.vibrate?.(0)}catch(_){}ownsHaptic=false;}}
function clear(reason){token++;clearTimeout(timer);timer=0;win='';pendingWin='';pendingCards='';shown='';if(area)delete area.dataset.holderCue;stopHaptic();if(live)live.textContent='';record('clear',{reason});}
function showTurn(){
 if(!present()||!turn||win)return;
 if(shown===turn)return;
 shown=turn;delete area.dataset.holderCue;void area.offsetWidth;area.dataset.holderReduced=String(reduced());area.dataset.holderCue='turn';
 if(live)live.textContent='Your turn';record('turn',{key:turn,reduced:reduced()});
 if(!heard.has(turn)){heard.add(turn);vibrate(18)}
}
function launchWin(key){
 if(!present()||pendingWin!==key||!['play','score'].includes(current.phase))return;
 pendingWin='';pendingCards='';win=key;shown='';const ticket=++token;area.dataset.holderReduced=String(reduced());area.dataset.holderCue='win';
 if(live)live.textContent='Trick won';record('win',{key,reduced:reduced()});vibrate(reduced()?18:[18,322,18]);
 timer=setTimeout(()=>{if(ticket!==token)return;timer=0;win='';delete area.dataset.holderCue;turn=opportunity();if(present()&&turn)showTurn();else if(live)live.textContent='';},reduced()?900:800);
}
function arrival(key,ticket,source){
 if(ticket!==token||pendingWin!==key||!present())return;
 record('arrival',{key,source});schedule(()=>{if(ticket===token)launchWin(key)});
}
function captureWaiter(winner,cards){
 const key=pendingWin,ticket=token;
 const signature=(cards||[]).map(t=>t.card?.id).join(',');
 if(!key||winner!==local||signature!==pendingCards)return ()=>{};
 record('collection-start',{key});
 return ()=>arrival(key,ticket,'collection-end');
}
function refresh(){
 frame=0;const desired=matchMedia('(orientation:portrait)').matches?document.querySelector('.game-room > .hand-area'):(document.getElementById('ltHandWrap')||document.querySelector('.lt-hand-wrap'));
 if(desired!==area){clear('holder orientation changed');area=desired;}
 if(live&&area&&live.parentNode!==area)area.append(live);
 if(area&&!live){live=document.createElement('span');live.className='holder-cue-accessible789';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');area.append(live);}
 if(area?.classList.contains('hand-area')&&!area.querySelector(':scope > .holder-cue-wash793')){
  const wash=document.createElement('span');wash.className='holder-cue-wash793';wash.setAttribute('aria-hidden','true');area.append(wash);
 }
 if(!present()){if(shown||win||pendingWin)clear('not visible/paused');return;}
 area.dataset.holderReduced=String(reduced());turn=opportunity();
 const g=current;
 if(g.phase==='play'&&g.resolvingTrick&&g.trick?.length===4&&g.lastTrickWinner===local){
  const key=cycle+'|'+(g.tricksTaken||[]).reduce((n,a)=>n+(a?.length||0),0)+'|'+g.trick.map(t=>t.card?.id).join(',');
  if(!seenWins.has(key)){
   seenWins.add(key);pendingWin=key;pendingCards=g.trick.map(t=>t.card?.id).join(',');const ticket=token;
   // Quiet the previous turn while the four cards are revealed and collected.
   shown='';delete area.dataset.holderCue;stopHaptic();if(live)live.textContent='';
   record('win-wait',{key});
   // The raven encounter replaces ordinary card collection. Keep its existing gate.
   window.HORRavenFight741?.deferCelebration(()=>arrival(key,ticket,'raven-complete'));
  }
 }
 // If there was no drawable flight, acknowledge only once the resolved trick
 // has actually cleared; never leave the following human turn waiting forever.
 if(pendingWin&&!g.resolvingTrick&&!document.querySelector('.trick-capture-flight-layer')&&!window.HORRavenFight741?.getState().active){
  arrival(pendingWin,token,'collection-cleared');
 }
 if(win||pendingWin)return;
 if(turn)showTurn();else if(shown){shown='';delete area.dataset.holderCue;if(live)live.textContent='';stopHaptic();record('idle');}
}
let released=null;
function schedule(release){if(release)released=release;if(!frame)frame=requestAnimationFrame(()=>{const fn=released;released=null;refresh();fn?.()});}
function sync(g,me,isSpectator){
 const nextCycle=[g?.dealer,g?.handNumber,...(g?.players||[]).map(p=>p.id+':'+p.isBot)].join('|');
 if(!g||local!==me||spectator!==!!isSpectator||cycle!==nextCycle||(g.phase==='deal'&&current?.phase!=='deal')){clear('new table/hand/viewer');heard.clear();seenWins.clear();}
 current=g;local=me;spectator=!!isSpectator;cycle=nextCycle;schedule();
}
function notifyTurn(){schedule();}
function init(){
 const box=document.getElementById('opt-holder-vibration789');if(box){box.checked=enabled;box.addEventListener('change',()=>{enabled=box.checked;try{localStorage.setItem(preference,enabled?'1':'0')}catch(_){}if(!enabled)stopHaptic();});}
 schedule();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clear('hidden');else schedule()});
addEventListener('pagehide',()=>clear('pagehide'));addEventListener('pageshow',()=>schedule());
addEventListener('resize',()=>schedule());motion.addEventListener('change',()=>{clear('motion preference');schedule()});
new MutationObserver(()=>schedule()).observe(document.body,{attributes:true,attributeFilter:['class']});
window.HORHolderCues789={sync,notifyTurn,clear,captureWaiter,getState:()=>({mode:area?.dataset.holderCue||'idle',turn,shown,win,pendingWin,enabled,reduced:reduced(),events:events.slice()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

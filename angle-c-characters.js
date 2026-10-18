/* Lower-camera review. Identity and game state are read-only inputs. */
(()=>{'use strict';
const NS='http://www.w3.org/2000/svg',W=1844,H=853,scene='assets/lower-camera/room-table-shelf834.svg';
const theater=document.getElementById('landscapeTheater');if(!theater)return;
const mask='M-18 540 A940 270 0 0 1 1862 540 L1862 853 H-18Z';
const seats=[{pose:'left',offset:1,x:6,w:398},{pose:'top',offset:2,x:770,w:304},{pose:'right',offset:3,x:1441,w:398}];
const root=document.createElementNS(NS,'svg');root.id='lowerCameraScene';root.setAttribute('viewBox',`0 0 ${W} ${H}`);root.setAttribute('aria-hidden','true');
root.innerHTML=`<defs><clipPath id="lowerRailMask"><path d="${mask}"/></clipPath></defs><image href="${scene}" width="${W}" height="${H}"/><g id="lowerBodies"></g><image href="${scene}" width="${W}" height="${H}" clip-path="url(#lowerRailMask)"/>`;
theater.prepend(root);
const bodyGroup=root.querySelector('#lowerBodies'),bodies=seats.map(s=>{const img=document.createElementNS(NS,'image');img.dataset.seat=s.pose;img.setAttribute('y','0');img.setAttribute('preserveAspectRatio','xMidYMid meet');bodyGroup.append(img);return img;});
const back=document.createElement('img');back.id='lowerHolderBack';back.src='assets/cardholder/holder047.png';back.alt='';theater.append(back);
const lip=document.createElement('img');lip.id='angleCHolderLip';lip.src=back.src;lip.alt='';theater.append(lip);
const fx=document.createElement('div');fx.id='angleCHouseFX';fx.setAttribute('aria-hidden','true');fx.innerHTML='<div class="lower-fire"><div></div></div><div class="lower-wick"><div></div></div>';theater.append(fx);
const names=document.createElement('div');names.id='angleCNames';theater.append(names);
const labels=Array.from({length:4},()=>{const b=document.createElement('button');b.type='button';b.className='angle-c-player-name';b.innerHTML='<span class="lower-name"></span><span class="angle-c-level"></span><span class="angle-c-status" role="status"></span>';b.onclick=()=>{const p=game?.players?.find(p=>p.id===b.dataset.playerId);if(p&&typeof horShowCareerForPlayer==='function')horShowCareerForPlayer(p);};names.append(b);return b;});
function statusFor(g,index,local,spectator){
 if(!g)return '';
 if(g.phase==='bidding'){
  const s=window.HORUnifiedBidding752?.state(g,index,local,spectator);
  const humanBidding=!g.paused&&g.currentPlayer===index&&index===local&&!spectator&&!g.players?.[index]?.isBot;
  const text=[humanBidding?'Bidding':s?.label,s?.previous].filter(Boolean).join(' · ');
  return text||(!g.paused&&g.currentPlayer===index?'Bidding':'');
 }
 if(g.phase==='play'){
  // Lead means the card CURRENTLY WINNING the incomplete trick, not the
  // opening player or the next actor. Reuse the game engine's authoritative
  // Rook/trump comparison (including specials) rather than guessing by rank.
  let leader=null;
  if(g.trick?.length){
   try {
    const winning=(typeof currentTrickWinner==='function')?currentTrickWinner():null;
    if(winning&&Number.isInteger(Number(winning.player)))leader=Number(winning.player);
    else if(typeof compareCards==='function'){
     let best=g.trick[0];
     for(let j=1;j<g.trick.length;j++)if(compareCards(g.trick[j].card,best.card,g.ledColor,g.trump)>0)best=g.trick[j];
     leader=Number(best.player);
    }
   }catch(_){leader=null;}
  }
  const labels=[];
  if(index===leader)labels.push('Lead');
  if(index===g.currentPlayer&&!g.resolvingTrick&&!g.paused)labels.push(g.players?.[index]?.isBot?'Thinking…':'Turn');
  return labels.join(' · ');
 }
 if(index===g.bidder&&g.phase==='discard')return 'Choosing discards';
 if(index===g.bidder&&g.phase==='trump')return 'Choosing trump';
 return '';
}

function set(el,key,value){if(el.getAttribute(key)!==String(value))el.setAttribute(key,String(value));}
function identity(p){return String((typeof playerAvatars!=='undefined'&&playerAvatars[p.id])||p.avatar||'').toLowerCase();}
function load(img,path,key){
 const href='assets/characters077/'+path;
 if(img.dataset.expected===href)return;img.dataset.expected=href;img.style.visibility='hidden';
 const done=()=>{if(img.dataset.expected!==href)return;set(img,'href',href);img.style.visibility='visible';delete img.dataset.fallback;};
 const failed=()=>{if(img.dataset.expected!==href)return;const p=game?.players?.find(p=>identity(p)===key);if(!p)return;set(img,'href',avatarSrc((typeof playerAvatars!=='undefined'&&playerAvatars[p.id])||p.avatar));img.dataset.fallback=key;img.style.visibility='visible';};
 if(window.HORAssetLoading772?.requireImages)window.HORAssetLoading772.requireImages([href]).then(done).catch(failed);
 else{const probe=new Image();probe.onload=done;probe.onerror=failed;probe.src=href;}
}
function text(el,value){if(el.textContent!==value)el.textContent=value;}
function sync(){
 const active=!!window.HORAngleC?.active();for(const e of [root,back,lip,names,fx])e.toggleAttribute('hidden',!active);
 if(!active){const ink=document.getElementById('trumpInk714'),home=document.getElementById('hor-room-bg')||document.body;if(ink&&ink.parentNode!==home)home.append(ink);return;}
 const g=HORAngleC.frame(),l=window.HORLowerLayout;
 Object.assign(root.style,{left:g.left+'px',top:g.top+'px',width:W*g.scale+'px',height:H*g.scale+'px'});
 const base=typeof myIndex==='number'&&myIndex>=0?myIndex:0,cast=window.HORCharacterStudio077?.characters||{};
 const inward=Math.max(0,-g.left/g.scale-95);
 seats.forEach((s,i)=>{const p=game?.players?.[(base+s.offset)%4],img=bodies[i];img.style.display=p?'':'none';if(!p)return;
  const key=identity(p),c=cast[key],path=c?.poses?.[s.pose];set(img,'x',s.x+(s.pose==='left'?inward:s.pose==='right'?-inward:0));set(img,'width',s.w);set(img,'height',s.w*1.5);set(img,'data-identity',key);
  if(path)load(img,path,key);else{set(img,'href',avatarSrc((typeof playerAvatars!=='undefined'&&playerAvatars[p.id])||p.avatar));img.dataset.fallback=key;img.style.visibility='visible';}
 });
 if(l){for(const e of [back,lip])Object.assign(e.style,{left:l.holderX+'px',top:l.holderY+'px',width:l.holderW+'px',height:l.holderH+'px'});lip.style.clipPath=`inset(${353/722*100}% 0 0 0)`;}
 Object.assign(fx.style,{left:g.left+'px',top:g.top+'px',transform:'scale('+g.scale+')'});
 const xy=[[922,790],[205,400],[922,310],[1640,400]];

 labels.forEach((b,i)=>{const p=game?.players?.[(base+i)%4];b.hidden=!p;if(!p)return;b.dataset.playerId=p.id;
  const prof=typeof horCareerProfileForPlayer==='function'?horCareerProfileForPlayer(p):p.careerPublic;
  text(b.querySelector('.lower-name'),p.name||'Player');text(b.querySelector('.angle-c-level'),prof?.enabled?'Level '+prof.level:'');const status=statusFor(game,(base+i)%4,myIndex,isSpectator).replace(/THINKING(?:\.{3}|…)/g,'Thinking…').replace(/PASSED/g,'Passed');text(b.querySelector('.angle-c-status'),status);b.dataset.position=['me','left','top','right'][i];b.dataset.phase=game?.phase||'';
  const side=i===1||i===3;const x=i===0||i===2?innerWidth/2:i===1?Math.max(60,innerWidth*.10):Math.min(innerWidth-60,innerWidth*.90);b.style.left=x+'px';const labelHalf=b.offsetHeight/2;
  const lowest=i!==0&&l?Math.min(innerHeight-24,l.handY-labelHalf-8):innerHeight-24;
  let y=i===0?innerHeight-20:Math.max(i===2?42:72,Math.min(lowest,g.top+xy[i][1]*g.scale));
  if(i===2){b.style.left=Math.max(8,Math.min(innerWidth-b.offsetWidth-8,g.left+1080*g.scale+8))+'px';y=8;}
  b.style.top=y+'px';
 });
 const ink=document.getElementById('trumpInk714');if(ink&&ink.parentNode!==theater)theater.append(ink);
 document.getElementById('angleCNotice').textContent='840 · Stable discard';
}
let last='',queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});}
function track(){
 if(window.HORAngleC?.active()&&typeof game!=='undefined'&&game){
  const plays=(game.trick||[]).map(t=>t.player+':'+t.card?.id).join(',');
  const key=[game.phase,game.currentPlayer,game.bidder,game.highestBid,JSON.stringify(game.bidStatus),plays,game.trump,game.ledColor,game.resolvingTrick,game.paused,myIndex,(game.players||[]).map(p=>p?.id+':'+p?.name+':'+(p?identity(p):'')).join(','),Math.floor(performance.now()/1000)].join('|');
  if(key!==last){last=key;schedule();}
 }else if(last){last='';schedule();}
 requestAnimationFrame(track);
}
new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
for(const id of ['ltHand','ltPlays']){const e=document.getElementById(id);if(e)new MutationObserver(schedule).observe(e,{childList:true});}
addEventListener('resize',schedule);document.addEventListener('hor-artwork-retry',()=>{bodies.forEach(b=>delete b.dataset.expected);schedule();});
window.HORAngleCCharacters={sync,statusFor,inspect:()=>({bodies:bodies.map(b=>({seat:b.dataset.seat,identity:b.dataset.identity,href:b.getAttribute('href'),fallback:b.dataset.fallback||null})),layout:window.HORLowerLayout})};
window.HORAssetLoading772?.requireImages([scene]).catch(()=>{});sync();requestAnimationFrame(track);
})();
/* Landscape entrance: original identity, favorite-partner and start handlers stay in charge. */
(()=>{'use strict';
 const lobby=document.getElementById('lobby');if(!lobby)return;
 const NS='http://www.w3.org/2000/svg',host=document.createElement('div');host.id='landingLandscapeReview';host.setAttribute('aria-hidden','true');
 host.innerHTML='<svg viewBox="0 0 1844 853" preserveAspectRatio="xMidYMin slice"><defs><clipPath id="landingOvalRailMask"><path d="M-18 540 A940 270 0 0 1 1862 540 L1862 853 H-18Z"/></clipPath></defs><image data-room830 href="assets/lower-camera/room-table-shelf834.svg" width="1844" height="853" preserveAspectRatio="xMidYMid meet"/><g></g><image data-room830 href="assets/lower-camera/room-table-shelf834.svg" width="1844" height="853" preserveAspectRatio="xMidYMid meet" clip-path="url(#landingOvalRailMask)"/></svg>';lobby.prepend(host);
 const group=host.querySelector('g'),poses=['left','top','right'],bodies=poses.map(p=>{const e=document.createElementNS(NS,'image');e.dataset.seat=p;e.setAttribute('y','0');group.append(e);return e;});let signature='';
 function sync(){if(!matchMedia('(orientation:landscape)').matches||lobby.classList.contains('hidden'))return;
  const roster=window.HORLanding783?.inspect()?.roster||[],cast=window.HORCharacterStudio077?.characters||{},sw=host.clientWidth,sh=host.clientHeight,sceneScale=Math.max(sw/1844,sh/853),inward=Math.max(0,(1844-sw/sceneScale)/2-95);const svg=host.querySelector('svg');svg.setAttribute('viewBox','0 0 1844 853');svg.querySelector('path').removeAttribute('transform');svg.querySelectorAll('[data-room830]').forEach(e=>{e.setAttribute('width',1844);e.setAttribute('height',853);});
  roster.forEach((p,i)=>{const e=bodies[i],width=[398,304,398][i],path=cast[p.avatar]?.poses?.[poses[i]],x=[6+inward,770,1441-inward][i];e.setAttribute('x',x);e.setAttribute('width',width);e.setAttribute('height',width*1.5);if(!path)return;const href='assets/characters077/'+path;if(e.dataset.expected===href)return;e.dataset.expected=href;e.style.visibility='hidden';window.HORAssetLoading772.requireImages([href]).then(()=>{if(e.dataset.expected!==href)return;e.setAttribute('href',href);e.style.visibility='visible';}).catch(()=>{});});
 }
 const original=document.getElementById('landingScene783');if(original)new MutationObserver(sync).observe(original,{childList:true});addEventListener('resize',sync);new MutationObserver(sync).observe(lobby,{attributes:true,attributeFilter:['class']});sync();
})();
/* Waiting-room landscape reads the real seated roster; existing seat buttons own actions. */
(()=>{'use strict';const waiting=document.getElementById('waiting');if(!waiting)return;
 const NS='http://www.w3.org/2000/svg',host=document.createElement('div');host.id='friendsLandscapeReview';host.setAttribute('aria-hidden','true');host.innerHTML='<svg viewBox="0 0 1844 853" preserveAspectRatio="xMidYMin slice"><defs><clipPath id="friendsOvalRailMask"><path d="M-18 540 A940 270 0 0 1 1862 540 L1862 853 H-18Z"/></clipPath></defs><image data-room830 href="assets/lower-camera/room-table-shelf834.svg" width="1844" height="853" preserveAspectRatio="xMidYMid meet"/><g></g><image data-room830 href="assets/lower-camera/room-table-shelf834.svg" width="1844" height="853" preserveAspectRatio="xMidYMid meet" clip-path="url(#friendsOvalRailMask)"/></svg>';waiting.prepend(host);
 const poses=['left','top','right'],group=host.querySelector('g'),bodies=poses.map(p=>{const e=document.createElementNS(NS,'image');e.dataset.seat=p;e.setAttribute('y','0');group.append(e);return e;});let queued=false;
 function sync(){if(waiting.classList.contains('hidden')||!matchMedia('(orientation:landscape)').matches)return;const me=players.find(p=>p&&p.id===myPeerId),base=me&&me.seat>=0?me.seat:0,cast=window.HORCharacterStudio077?.characters||{},sw=host.clientWidth,sh=host.clientHeight,sceneScale=Math.max(sw/1844,sh/853),inward=Math.max(0,(1844-sw/sceneScale)/2-95);const svg=host.querySelector('svg');svg.setAttribute('viewBox','0 0 1844 853');svg.querySelector('path').removeAttribute('transform');svg.querySelectorAll('[data-room830]').forEach(e=>{e.setAttribute('width',1844);e.setAttribute('height',853);});
 bodies.forEach((e,i)=>{const p=playerAtSeat((base+i+1)%4);e.style.display=p?'':'none';if(!p){delete e.dataset.expected;e.removeAttribute('href');return;}const key=String((typeof playerAvatars!=='undefined'&&playerAvatars[p.id])||p.avatar||'').toLowerCase(),path=cast[key]?.poses?.[poses[i]],href=path?'assets/characters077/'+path:avatarSrc(key),width=[398,304,398][i];e.dataset.player=p.id;e.dataset.identity=key;e.setAttribute('x',[6+inward,770,1441-inward][i]);e.setAttribute('width',width);e.setAttribute('height',width*1.5);if(e.dataset.expected===href)return;e.dataset.expected=href;e.style.visibility='hidden';window.HORAssetLoading772.requireImages([href]).then(()=>{if(e.dataset.expected!==href)return;e.setAttribute('href',href);e.style.visibility='visible';}).catch(()=>{});});
 }
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;sync();});}};
 new MutationObserver(schedule).observe(waiting,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});addEventListener('resize',schedule);window.HORFriendsLandscapeReview={sync,inspect:()=>bodies.map(e=>({seat:e.dataset.seat,player:e.dataset.player,identity:e.dataset.identity,href:e.getAttribute('href'),visible:e.style.display!=='none'&&e.style.visibility!=='hidden'}))};sync();
 const picker=document.getElementById('botPickerModal');if(picker)new MutationObserver(()=>{if(!picker.classList.contains('hidden')&&matchMedia('(orientation:landscape)').matches){const p=picker.querySelector('.bot-picker-sheet>p');if(p)p.textContent='Choose a player for this seat.';}}).observe(picker,{attributes:true,attributeFilter:['class']});
})();

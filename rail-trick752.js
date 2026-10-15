/* 753: one read-only rail presentation, refined from 752. Game event boundary is unchanged. */
(() => {
 'use strict';
 let current=null,local=-1,spectator=false,cycle='',root=null,seen='',pending='',epoch=0,motions=[],release=null,active=false;
 let asset=null,assetFailed=false,assetRequest=null,frame=0,suspended=false;
 const stats={starts:0,clears:0,last:null};
 const portrait=()=>matchMedia('(orientation:portrait)').matches;
 function clear(reason='clear') {
  epoch++;pending='';release=null;motions.forEach(a=>a.cancel());motions=[];
  if(active)stats.clears++;active=false;root?.classList.remove('is-active');stats.last=reason;
  const live=root?.querySelector('.rail-accessible753');if(live)live.textContent='';
 }
 function remove(){if(root){root.remove();root=null;}}
 function key(g){return [g.handNumber,g.dealer,g.lastTrickWinner,...(g.trick||[]).map(t=>t.player+'/'+t.card?.id)].join(':');}
 function relevant(g,hand){return current===g&&g.handNumber===hand&&g.phase==='play'&&document.body.classList.contains('in-game')&&!document.hidden;}
 function obstacles(){return [...document.querySelectorAll('#myHand > .card-face,#slot-me .seat-avatar,.game-room>.hand-area,.holder004-backrest,#trickPtsBar,.in-game-leave,#decisionConsole,#trumpCase714')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&!e.hidden&&r.width&&r.height;});}
 function modalOpen(){return [...document.querySelectorAll('.modal:not(.hidden),#discardOverlay:not(.hidden),#kittyReceivedOverlay:not(.hidden)')].some(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width&&r.height;});}
 function canRest(){return !suspended&&current?.phase==='play'&&document.body.classList.contains('in-game')&&portrait()&&!document.hidden&&!modalOpen()&&!window.HORRavenFight741?.getState().active&&!window._trickCapturing&&!document.querySelector('.trick-capture-flight-layer');}
 function place(){
  if(!root||!portrait())return false;
  const br=document.getElementById('hor-room-bg')?.getBoundingClientRect();
  const scale=Math.max((br?.width||innerWidth)/875,(br?.height||innerHeight)/1797),sceneTop=br?.top||0,sceneX=(innerWidth-875*scale)/2;
  const av=document.querySelector('#slot-me .seat-avatar')?.getBoundingClientRect(),hand=document.querySelector('.game-room>.hand-area')?.getBoundingClientRect(),rear=document.querySelector('.holder004-backrest')?.getBoundingClientRect();
  // Contour and horizontal placement are registered to the 875px scene, not screen text layout.
  let textScale=scale;
  const cards=obstacles().filter(e=>e.matches('#myHand > .card-face'));
  const cardTop=Math.min(innerHeight,...cards.map(e=>e.getBoundingClientRect().top));
  const low=Math.max(sceneTop+1160*scale,(av?.bottom||0)+6),ceiling=Math.min(sceneTop+1410*scale,(hand?.top||innerHeight)-8,(rear?.top||innerHeight)-6,cardTop-8);
  // Use the rendered vector's real ink bounds, including its shallow edge finish.
  const ink=root.querySelector('.rail-rest753').getBBox();
  const available=ceiling-low;
  if(available>=16&&(ink.height+2)*scale>available)textScale=available/(ink.height+2);
  const width=400*textScale,height=82*textScale;
  const inkTop=(ink.y-1)*textScale,inkBottom=(ink.y+ink.height+1)*textScale,high=ceiling-inkBottom;
  const top=Math.max(low-inkTop,Math.min(high,sceneTop+1290*scale+3)); // Clamp above actual cards, including enlarged short hands.
  stats.clearance={cardTop,ceiling,low,high:high+inkTop,height:inkBottom-inkTop,avatar:av?.toJSON(),hand:hand?.toJSON(),rear:rear?.toJSON()};
  if(high<low-inkTop)return false;
  const left=sceneX+437.5*scale-width/2;
  const css=`left:${left}px;top:${top}px;width:${width}px;height:${height}px;`;if(root.style.cssText!==css)root.style.cssText=css;
  const r={left:left+(ink.x-1)*textScale,right:left+(ink.x+ink.width+1)*textScale,top:top+inkTop,bottom:top+inkBottom,width:(ink.width+2)*textScale,height:inkBottom-inkTop};
  const blocked=obstacles().filter(e=>{const o=e.getBoundingClientRect();return Math.min(r.right,o.right)>Math.max(r.left,o.left)&&Math.min(r.bottom,o.bottom)>Math.max(r.top,o.top);});
  stats.collisions=blocked.map(e=>e.id||e.className);if(blocked.length)return false;
  // Two sampled highlights on the same existing brass/wood lip. Use the upper
  // hairline when the lower inset falls behind the hand; never draw a new strip.
  const ridge=sceneTop+1296*scale>(hand?.top||innerHeight)-2?1278:1296;
  const brass=root.querySelector('.rail-brass-light752'),by=sceneTop+(ridge-28)*scale;
  brass.setAttribute('viewBox',`237.5 ${ridge-28} 400 34`);
  brass.style.cssText=`left:${sceneX+237.5*scale-left}px;top:${by-top}px;width:${400*scale}px;height:${34*scale}px;`;
  brass.querySelector('.rail-reflection-path753').setAttribute('d',`M237.5 ${ridge-15} Q437.5 ${ridge+15} 637.5 ${ridge-15}`);
  const mask=brass.querySelector('#rail753-clearance');
  mask.setAttribute('x','237.5');mask.setAttribute('y',String(ridge-28));mask.setAttribute('width','400');mask.setAttribute('height','34');
  mask.innerHTML=`<rect x="237.5" y="${ridge-28}" width="400" height="34" fill="white"/>`+obstacles().map(e=>{const o=e.getBoundingClientRect();return `<rect x="${(o.left-sceneX-3)/scale}" y="${(o.top-sceneTop-3)/scale}" width="${(o.width+6)/scale}" height="${(o.height+6)/scale}" fill="black"/>`;}).join('');
  stats.geometry={viewport:[innerWidth,innerHeight],text:r,brassY:by,brassRidgeImageY:ridge,avatar:av?.toJSON(),hand:hand?.toJSON(),rear:rear?.toJSON(),sceneScale:scale,sceneOrigin:[sceneX,sceneTop],curveSag:20*textScale,textScale,reflectionExcludesProtectedRects:true};
  return true;
 }
 function requestAsset(){
  if(assetRequest||assetFailed)return;
  assetRequest=fetch('assets/ui752/trick-won-lettering.svg').then(r=>{if(!r.ok)throw Error('lettering asset '+r.status);return r.text();}).then(text=>{
   const svg=new DOMParser().parseFromString(text,'image/svg+xml').documentElement;
   if(svg.tagName!=='svg'||svg.querySelector('parsererror')||!svg.querySelector('#rail753-glyphs'))throw Error('invalid lettering asset');
   asset=svg;schedule();
  }).catch(error=>{assetFailed=true;clear('missing lettering asset');remove();console.warn('Rail announcement:',error);});
 }
 function ensure(){
  if(assetFailed)return false;
  if(!canRest()){if(root)root.hidden=true;return false;}
  if(!asset){requestAsset();return false;}
  if(!root){
   root=document.createElement('div');root.id='railTrickWon752';
   const svg=document.importNode(asset,true);svg.classList.add('rail-engraving753');svg.setAttribute('aria-hidden','true');root.appendChild(svg);
   const brass=document.createElementNS('http://www.w3.org/2000/svg','svg');brass.setAttribute('class','rail-brass-light752');brass.setAttribute('viewBox','237.5 1268 400 34');brass.setAttribute('aria-hidden','true');
   brass.innerHTML='<defs><linearGradient id="rail753-glint"><stop stop-color="#d5b072" stop-opacity="0"/><stop offset=".5" stop-color="#e9cc91"/><stop offset="1" stop-color="#d5b072" stop-opacity="0"/></linearGradient><mask id="rail753-clearance" maskUnits="userSpaceOnUse"></mask></defs><path class="rail-reflection-path753" mask="url(#rail753-clearance)" d="M237.5 1281 Q437.5 1311 637.5 1281" fill="none" stroke="url(#rail753-glint)" stroke-width="2.1" stroke-linecap="round" pathLength="400" stroke-dasharray="64 480"/>';
   root.appendChild(brass);const live=document.createElement('span');live.className='rail-accessible753';live.setAttribute('role','status');live.setAttribute('aria-live','polite');root.appendChild(live);document.body.appendChild(root);
  }
  root.hidden=false;
  if(!place()){root.hidden=true;return false;}return true;
 }
 function refresh(){
  frame=0;
  if(!canRest()){if(active||(pending&&(modalOpen()||!portrait()||!document.body.classList.contains('in-game'))))clear('presentation interrupted');if(root)root.hidden=true;if(!document.body.classList.contains('in-game')){clear('left table');remove();}return;}
  if(!ensure()&&active)clear('clearance changed');if(pending)release?.();
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(refresh);}
 function launch(g,hand,token){
  if(token!==epoch)return;
  if(!relevant(g,hand)||!portrait()){clear('not visible portrait table');return;}
  if(modalOpen()){clear('modal open');return;}
  if(!ensure()){
   if(asset&&!assetFailed)clear('no safe rail clearance');return;
  }
  stats.starts++;pending='';release=null;active=true;root.classList.add('is-active');
  root.querySelector('.rail-accessible753').textContent='Trick won';
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('reduce-motion');
  const duration=reduced?1100:1800;stats.duration=duration;
  const letters=[...root.querySelectorAll('.rail-illuminated-letter753')];
  letters.forEach((letter,i)=>{
   const enter=reduced?.06:.10+i*.032;
   const anim=letter.animate([{opacity:0,offset:0},{opacity:0,offset:Math.max(.001,enter-.045)},{opacity:.94,offset:enter+.065},{opacity:.76,offset:.74},{opacity:0,offset:1}],{duration,easing:'ease-in-out',fill:'both'});motions.push(anim);
  });
  if(!reduced){const sweep=root.querySelector('.rail-brass-light752');motions.push(sweep.animate([{opacity:0},{opacity:.66,offset:.35},{opacity:0}],{duration:950,easing:'ease-in-out',fill:'both'}));motions.push(sweep.firstElementChild.nextElementSibling.animate([{strokeDashoffset:64},{strokeDashoffset:-400}],{duration:950,easing:'ease-in-out',fill:'both'}));}
  const done=motions[0];if(!done){clear('empty artwork');return;}
  done.finished.then(()=>{if(token===epoch)clear('complete');}).catch(()=>{if(token===epoch){clear('animation canceled');schedule();}});
 }
 function sync(g,me,isSpectator){
  const nextCycle=[g?.dealer,g?.handNumber,...(g?.players||[]).map(p=>p.id)].join('|');
  if(current!==g||local!==me||spectator!==isSpectator||cycle!==nextCycle){clear('table/viewer/dealer changed');seen='';}
  current=g;local=me;spectator=isSpectator;cycle=nextCycle;
  if(!g||g.phase!=='play'||!document.body.classList.contains('in-game')){if(active||pending)clear('phase/reset');if(root)root.hidden=true;seen='';return;}
  if(active&&stats.hand!==g.handNumber)clear('new hand');
  if((active||pending)&&g.trick?.length>0&&g.trick.length<4)clear('next played card');
  schedule();if(pending)release?.();
  if(!g.resolvingTrick||g.trick?.length!==4||!Number.isInteger(me)||me<0||isSpectator||g.lastTrickWinner!==me||g.players?.[me]?.isBot)return;
  const id=key(g);if(seen===id)return;seen=id;
  clear('new local win');stats.hand=g.handNumber;pending=id;
  const token=epoch,hand=g.handNumber;
  queueMicrotask(()=>{
   if(token!==epoch||!relevant(g,hand))return;
   release=()=>{if(token!==epoch||!relevant(g,hand))return;if(window.HORRavenFight741?.getState().active)return;if(window._trickResolveTimer||window._trickCapturing||document.querySelector('.trick-capture-flight-layer'))return;try{launch(g,hand,token);}catch(error){clear('animation error');console.warn('Rail announcement:',error);}};
   if(window.HORRavenFight741?.deferCelebration(release))return;release();
  });
 }
 addEventListener('resize',()=>{if(!portrait())clear('landscape');schedule();});
 addEventListener('pagehide',()=>{suspended=true;clear('navigation');remove();});
 addEventListener('pageshow',()=>{suspended=false;schedule();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clear('hidden');if(root)root.hidden=true;}else schedule();});
 new MutationObserver(records=>{if(records.some(r=>!root||!(r.target===root||root.contains(r.target))))schedule();}).observe(document.body,{attributes:true,childList:true,subtree:true,attributeFilter:['class','hidden']});
 matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',()=>{clear('motion preference');schedule();});
 window.HORRailTrick752={sync,clear,getState:()=>({active,pending:!!pending,resting:false,seen,stats:JSON.parse(JSON.stringify(stats))})};
})();

/* R714 physical trump case. Presentation only; submitTrump/hostProcessTrump own rules. */
(function () {
 'use strict';
 const colors=['green','red','yellow','black'];
 const pigment={green:[14,143,62],red:[225,29,46],yellow:[255,213,26],black:[11,11,11]};
 const assetRoot='assets/trump714/';
 const specs={case:[2069,760,57,136,1980,481], 'lid-inner':[2187,719,57,165,2081,412],
  'lid-outer':[2172,724,38,166,2095,392],stamp:[1254,1254,283,107,677,1027]};
 // Source-art registration: recessed wooden opening, excluding surrounding rails/hinges.
 const panel={left:126,right:2067,top:244,bottom:466};
 const plaque={cx:(panel.left+panel.right)/2,cy:(panel.top+panel.bottom)/2,width:1000,height:1000*342/2022};
 let tentativeTrump=null, choiceKey=null, confirmGroup=null, fallbackDock=null;
 const portrait=()=>matchMedia('(orientation:portrait)').matches;
 const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
 let ready=false, root, canvas, ctx, stamp, lid, closed, buttons=[], dockRef, submitRef;
 let last=null, accepted=null, markColor=null, current=null, currentMe=-1, opts={};
 let pending=false, running=false, epoch=0, clockTimers=[], motions=[], pressed=false;
 let destroyed=false, mask=null, trace=[];
 let stampSource=null, stampPaint=null, shadow=null, motionFrame=0, pose=null, inkColor=null;
 const materials={};
 const log=(event,detail)=>{trace.push({event,detail,t:performance.now()});if(trace.length>80)trace.shift();};
 const svg=name=>{const [w,h,x,y,vw,vh]=specs[name];return `<svg viewBox="${x} ${y} ${vw} ${vh}" aria-hidden="true"><image width="${w}" height="${h}" href="${assetRoot+name}.png"/></svg>`;};
 function plaqueArt(color){
  const x=plaque.cx-plaque.width/2,y=plaque.cy-plaque.height/2;
  return `<image x="${x}" y="${y}" width="${plaque.width}" height="${plaque.height}" href="${assetRoot}confirm-brass.png" aria-hidden="true"/><text x="${plaque.cx}" y="${plaque.cy}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="700" fill="#302c25" aria-hidden="true">CONFIRM ${color.toUpperCase()}</text>`;
 }
 function updateChoice(){
  if(confirmGroup){
   confirmGroup.style.display=tentativeTrump?'':'none';
   confirmGroup.setAttribute('aria-disabled',String(pending||running));
   confirmGroup.setAttribute('tabindex',tentativeTrump&&!pending&&!running?'0':'-1');
   if(tentativeTrump){confirmGroup.setAttribute('aria-label','Confirm '+tentativeTrump+' trump');confirmGroup.innerHTML=plaqueArt(tentativeTrump)+'<rect class="tc-confirm-hit" x="126" y="165" width="1941" height="330" fill="transparent"/>';}
  }
  buttons.forEach(b=>{b.disabled=pending||running;b.toggleAttribute('data-selected',b.dataset.trump===tentativeTrump);b.setAttribute('aria-pressed',String(b.dataset.trump===tentativeTrump));});
  if(fallbackDock?.isConnected){
   fallbackDock.querySelectorAll('[data-trump]').forEach(b=>{
    const selected=b.dataset.trump===tentativeTrump;
    b.disabled=pending;b.setAttribute('aria-pressed',String(selected));b.classList.toggle('tc-fallback-confirm',selected);
    b.setAttribute('aria-label',(selected?'Confirm ':'Choose ')+b.dataset.trump+' trump');
    b.innerHTML=selected?`<svg viewBox="${plaque.cx-plaque.width/2} ${plaque.cy-plaque.height/2} ${plaque.width} ${plaque.height}" aria-hidden="true">${plaqueArt(tentativeTrump)}</svg>`:b.dataset.trump[0].toUpperCase()+b.dataset.trump.slice(1);
   });
  }
 }
 function beginChoice(g){
  const key=g?`${g.handNumber}:${g.bidder}`:choiceKey;
  if(key!==choiceKey){choiceKey=key;tentativeTrump=null;pending=false;}
 }
 function chooseFallback(dock,submit,g){
  ensure();beginChoice(g);dockRef=dock;submitRef=submit;fallbackDock=dock;
  dock.querySelectorAll('[data-trump]').forEach(b=>b.onclick=()=>b.dataset.trump===tentativeTrump?confirmChoice():select(b.dataset.trump));updateChoice();
 }
 function ensure(){
  if(root)return;
  root=document.createElement('section');root.id='trumpCase714';root.hidden=true;
  root.setAttribute('aria-label','Choose trump');root.setAttribute('role','group');
  root.innerHTML='<div class="tc-art tc-lid">'+svg('lid-inner')+'</div><div class="tc-art tc-base">'+svg('case')+'</div><div class="tc-art tc-closed">'+svg('lid-outer')+'</div><div class="tc-art tc-stamp">'+svg('stamp')+'</div><div class="tc-access" role="status" aria-live="polite"></div>';
  const padGroup=document.createElement('div');padGroup.className='tc-pads';
  colors.forEach(color=>{const b=document.createElement('button');b.type='button';b.className='tc-pad';b.dataset.trump=color;b.setAttribute('aria-label','Choose '+color+' as trump');b.innerHTML='<span>'+color.toUpperCase()+'</span>';b.addEventListener('click',()=>select(color));buttons.push(b);padGroup.appendChild(b);});
  root.appendChild(padGroup);document.body.appendChild(root);
  stamp=root.querySelector('.tc-stamp');stamp.innerHTML='<canvas aria-hidden="true"></canvas>';stampPaint=stamp.firstChild;stampPaint.width=338;stampPaint.height=514;
  shadow=document.createElement('div');shadow.className='tc-contact-shadow746';shadow.hidden=true;shadow.setAttribute('aria-hidden','true');document.body.appendChild(shadow);drawStamp(null,1);lid=root.querySelector('.tc-lid');closed=root.querySelector('.tc-closed');
  const lidSvg=lid.querySelector('svg');lidSvg.removeAttribute('aria-hidden');
  confirmGroup=document.createElementNS('http://www.w3.org/2000/svg','g');confirmGroup.classList.add('tc-confirm');confirmGroup.setAttribute('role','button');confirmGroup.style.display='none';confirmGroup.setAttribute('tabindex','-1');
  confirmGroup.addEventListener('click',confirmChoice);confirmGroup.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();confirmChoice();}});lidSvg.appendChild(confirmGroup);
  canvas=document.createElement('canvas');canvas.id='trumpInk714';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');ctx=canvas.getContext('2d');
  (document.getElementById('hor-room-bg')||document.body).appendChild(canvas);
 }
 function ownsPortrait(){return ready&&portrait();}
 function position(){
  if(!root||root.hidden)return;
  const rear=document.querySelector('.holder004-backrest');const hand=document.getElementById('myHand');
  const y=rear&&rear.getBoundingClientRect().height?rear.getBoundingClientRect().top+1:hand?hand.getBoundingClientRect().top-6:innerHeight-65;
  root.style.top=Math.max(48,y-root.getBoundingClientRect().height)+'px';
 }
 function restore(){
  document.body.classList.remove('trump714-avatar');
  if(dockRef)dockRef.classList.remove('trump714-owned');
 }
 function stop(reason,hide=true){
  epoch++;cancelAnimationFrame(motionFrame);motionFrame=0;pose=null;inkColor=null;if(shadow)shadow.hidden=true;if(stampPaint)drawStamp(null,1);clockTimers.forEach(clearTimeout);clockTimers=[];motions.forEach(a=>a.cancel());motions=[];
  running=false;pressed=false;pending=false;
  if(root){root.classList.remove('tc-directional');delete root.dataset.origin;root.style.opacity='';stamp.style.transform='';lid.style.transform='';closed.style.opacity='';closed.style.transform='';buttons.forEach(b=>{b.disabled=false;delete b.dataset.selected});if(hide)root.hidden=true;}
  restore();log('cancel',reason);
 }
 function showCase(interactive){
  ensure();const opening=root.hidden&&interactive;root.hidden=false;root.style.opacity='';root.setAttribute('aria-hidden',interactive?'false':'true');
  buttons.forEach(b=>b.disabled=!interactive);document.body.classList.add('trump714-avatar');position();
  if(opening&&!reduced()){const duration=opts.scaled?opts.scaled(220,0):220;if(duration>30)animate(lid,[{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration,fill:'none',easing:'ease-out'});}
 }
 function choose(dock,submit,g){
  if(!ownsPortrait())return false;
  ensure();beginChoice(g);dockRef=dock;submitRef=submit;fallbackDock=null;
  dock.classList.remove('decision-mode-bid','hidden');dock.classList.add('decision-mode-trump','trump714-owned');
  dock.innerHTML='';
  if(!running&&!pending)showCase(true);updateChoice();
  // Selection authority is still the caller's original callback.
  last={phase:'trump',trump:null};
  return true;
 }
 function select(color){
  if(pending||running||!colors.includes(color)||!submitRef)return;
  tentativeTrump=color;updateChoice();root.querySelector('.tc-access').textContent=color+' selected. Confirm or choose another color.';log('tentative',color);
 }
 function confirmChoice(){
  const color=tentativeTrump;
  if(pending||running||!colors.includes(color)||!submitRef)return;
  pending=true;updateChoice();root.querySelector('.tc-access').textContent='Confirming '+color+' trump';log('submitted',color);
  const callback=submitRef;callback(color);
  const token=epoch;clockTimers.push(setTimeout(()=>{if(token===epoch&&pending&&!running&&current&&current.phase==='trump'){pending=false;updateChoice();root.querySelector('.tc-access').textContent='Waiting for connection. You may retry confirmation.';}},4000));
 }
 function timing(fn,at,token){clockTimers.push(setTimeout(()=>{if(token===epoch)fn();},at));}
 function animate(el,frames,settings){const a=el.animate(frames,{fill:'forwards',...settings});motions.push(a);return a;}
 function geometry(){
  const scale=Math.max(innerWidth/875,innerHeight/1797);
  return {scale,left:(innerWidth-875*scale)/2,top:0,x:440*scale+(innerWidth-875*scale)/2,y:850*scale};
 }
 function paint(color){
  markColor=color;
  if(!canvas||!ctx)return;
  canvas.hidden=!color||!portrait()||!document.body.classList.contains('in-game');
  if(canvas.hidden||!mask)return;
  const dpr=Math.min(devicePixelRatio||1,3),geo=geometry();
  canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);
  canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
  const tmp=document.createElement('canvas');tmp.width=mask.w;tmp.height=mask.h;const tc=tmp.getContext('2d');const out=tc.createImageData(mask.w,mask.h);const rgb=pigment[color];
  for(let i=0;i<mask.alpha.length;i++){const k=i*4;const a=mask.alpha[i];out.data[k]=rgb[0];out.data[k+1]=rgb[1];out.data[k+2]=rgb[2];out.data[k+3]=Math.round(a*.94);}
  tc.putImageData(out,0,0);ctx.drawImage(tmp,geo.left+mask.x*geo.scale,mask.y*geo.scale,mask.w*geo.scale,mask.h*geo.scale);
 }
 function sound(){try{if(typeof playNatural063==='function')playNatural063('stamp',.6);}catch(_){}}
 // The approved raster is one camera-facing view. Keep its handle upright;
 // reproject only the visible sole/rim toward the table plane, anchored at
 // the working-face centre (source pixel 621,975), not the image bottom.
 function buildMaterials(im){
  const source=document.createElement('canvas');source.width=338;source.height=514;
  const c=source.getContext('2d');c.drawImage(im,283,107,677,1027,0,0,338,514);
  materials.clean=source;const pixels=c.getImageData(0,0,338,514);
  for(const color of colors){const out=new ImageData(new Uint8ClampedArray(pixels.data),338,514),rgb=pigment[color];let count=0;
   for(let y=0;y<514;y++)for(let x=0;x<338;x++){
    const px=283+x*677/338,py=107+y*1027/514,k=(y*338+x)*4,r=out.data[k],g=out.data[k+1],b=out.data[k+2];
    // Only raised gold relief inside the rubber face; brass rim is excluded.
    if(((px-622)/230)**2+((py-975)/116)**2<.94&&r>95&&g>45&&r>g*1.12&&b<g*.72&&out.data[k+3]){
     const light=.65+.35*g/255;for(let channel=0;channel<3;channel++)out.data[k+channel]=Math.round(rgb[channel]*light);count++;
    }
   }
   const layer=document.createElement('canvas');layer.width=338;layer.height=514;layer.getContext('2d').putImageData(out,0,0);materials[color]=layer;log('ink-mask',{color,pixels:count});
  }
  drawStamp(null,1);
 }
 function drawStamp(color,sole){
  if(!stampPaint||!materials.clean)return;
  const c=stampPaint.getContext('2d'),image=materials[color]||materials.clean;
  const cut=(830-107)*514/1027,face=(975-107)*514/1027,shift=(face-cut)*(1-sole);
  c.clearRect(0,0,338,514);
  c.drawImage(image,0,0,338,cut,0,shift,338,cut);
  c.drawImage(image,0,cut,338,514-cut,0,cut+shift,338,(514-cut)*sole);
 }
 function ceremony(color,chooser){
  stop('new-ceremony');accepted=color;pending=false;running=true;pressed=false;
  const duration=reduced()?0:Math.max(0,opts.scaled?opts.scaled(1950,0):1950);
  if(duration<150){paint(color);running=false;log('reduced-or-fast',color);return;}
  showCase(false);tentativeTrump=color;updateChoice();const token=epoch;
  buttons.forEach(b=>{if(b.dataset.trump===color)b.dataset.selected='';});
  const slotId=seatSlotIdForIndex(chooser),direction=({'slot-me':'bottom','slot-partner':'top','slot-left':'left','slot-right':'right'})[slotId];
  if(!direction){stop('missing-chooser-seat');paint(color);return;}
  root.dataset.origin=direction;root.classList.toggle('tc-directional',direction!=='bottom');if(direction!=='bottom')document.body.classList.remove('trump714-avatar');
  const s=stamp.getBoundingClientRect(),g=geometry(),slot=document.getElementById(slotId),avatar=slot?.querySelector('.seat-avatar,.seat-avatar-side'),seat=(avatar||slot)?.getBoundingClientRect();
  const sx=s.left+s.width/2,sy=s.top+s.height*(975-107)/1027;
  const fallback={bottom:[sx,sy],top:[g.x,g.y-130],left:[g.x-145,g.y-35],right:[g.x+145,g.y-35]}[direction];
  const ox=direction==='bottom'?sx:Math.max(s.width*.6,Math.min(innerWidth-s.width*.6,seat?.width?seat.left+seat.width/2:fallback[0]));
  const oy=direction==='bottom'?sy:Math.max(48+s.height,Math.min(innerHeight-75,seat?.height?(direction==='top'?seat.bottom+18:seat.top+seat.height*.72):fallback[1]));
  const pad=buttons.find(b=>b.dataset.trump===color).getBoundingClientRect(),px=pad.left+pad.width/2,py=pad.top+pad.height*.30;
  const origin={x:ox,y:oy},target={x:g.x,y:g.y};
  // h is height above the felt; screen y is its camera projection. Travel
  // x/y remains on the table plane. No per-seat roll or sideways wrist twist.
  const frame=(t,x,y,h,sole,scale)=>({t,x,y,h,sole,scale});
  const depth=y=>Math.max(.9,Math.min(1.035,1+(y-g.y)/1800));
  const startScale=depth(oy),frames=direction==='bottom'?[
   frame(0,ox,oy,0,1,startScale),frame(.06,px,py,20,.80,startScale),frame(.12,px,py,0,.48,startScale),frame(.18,px,py,0,.48,startScale),frame(.25,px,py,26,.80,startScale)
  ]:[frame(0,ox,oy,12,.80,startScale),frame(.18,ox,oy,26,.80,startScale),frame(.25,ox,oy,26,.80,startScale)];
  frames.push(frame(.48,g.x,g.y,32,.68,1),frame(.56,g.x,g.y,0,.48,1),frame(.63,g.x,g.y,0,.48,1),frame(.73,g.x,g.y,32,.68,1),frame(.91,ox,oy,26,.80,startScale),frame(.98,ox,oy,0,direction==='bottom'?1:.80,startScale),frame(1,ox,oy,0,direction==='bottom'?1:.80,startScale));
  if(direction!=='bottom'){inkColor=color;log('inked',{color,source:'remote-chooser',visiblePad:false});}
  log('direction',{chooser,slotId,direction,origin,destination:target,frames,contactAnchor:{sourceX:621,sourceY:975},contactAt:.56,inkAt:direction==='bottom'?.12:0});
  root.dataset.stage='ceremony';shadow.hidden=false;
  const start=performance.now();let picked=direction!=='bottom',contact=false,segment=0;
  function render(now){
   if(token!==epoch||!running)return;
   const t=Math.min(1,Math.max(0,(now-start)/duration));
   while(segment<frames.length-2&&t>frames[segment+1].t)segment++;
   const a=frames[segment],b=frames[segment+1],u=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))),ease=u*u*(3-2*u),mix=k=>a[k]+(b[k]-a[k])*ease;
   if(!picked&&t>=.12){picked=true;inkColor=color;log('inked',{color,source:'selected-pad',pad:{x:px,y:py},at:t});}
   if(!contact&&t>=.56){contact=true;pressed=true;paint(color);sound();log('pressed',{color,at:t,height:0});}
   const x=mix('x'),y=mix('y'),height=mix('h'),scale=mix('scale'),sole=mix('sole');
   pose={x,y,height,sole,scale,t,inkColor,direction,contact};
   stamp.style.transform=`translate(${x-sx}px,${y-sy-height}px) scale(${scale})`;
   drawStamp(inkColor,sole);
   shadow.style.left=x+'px';shadow.style.top=y+'px';shadow.style.width=(s.width*scale*.9+height*.20)+'px';shadow.style.height=(s.width*scale*.22+height*.08)+'px';shadow.style.opacity=String(.23-height*.0045);
   if(t>=.86&&direction==='bottom'&&root.dataset.stage!=='closing'){root.dataset.stage='closing';animate(lid,[{transform:'scaleY(1)',opacity:1},{transform:'scaleY(0)',opacity:.7}],{duration:duration*.065,easing:'ease-in'});animate(closed,[{opacity:0,transform:'scaleY(0)'},{opacity:1,transform:'scaleY(1)'}],{duration:duration*.08,easing:'ease-out'});}
   root.style.opacity=t>.96?String((1-t)/.04):'1';
   if(t<1)motionFrame=requestAnimationFrame(tick);else{stop('complete');paint(color);log('complete',color);}
  }
  function tick(now){try{render(now);}catch(error){stop('animation-error');paint(color);log('animation-error',String(error));}}
  tick(start);if(running)motionFrame=requestAnimationFrame(tick);
  // A deadline handles throttled frames; normal contact is tied to render time.
  timing(()=>{if(running){stop('deadline');paint(color);log('deadline',color);}},duration+50,token);
  log('started',{color,duration});
 }
 function sync(g,me,options){
  ensure();current=g;currentMe=me;opts=options||{};
  if(g?.phase==='trump')beginChoice(g);else if(g?.phase!=='play'){choiceKey=null;tentativeTrump=null;updateChoice();}
  if(!g||!document.body.classList.contains('in-game')){stop('no-game');accepted=null;last=null;paint(null);return;}
  const snapshot={phase:g.phase,trump:g.trump};
  if(!portrait()){if(running||!root.hidden)stop('landscape');canvas.hidden=true;last=snapshot;return;}
  if(g.phase!=='play'){
   if(markColor)paint(null);
   if(g.phase!=='trump'){if(running||pending||!root.hidden||dockRef?.classList.contains('trump714-owned'))stop('phase-'+g.phase);accepted=null;}
   else if(g.paused||opts.spectator||g.bidder!==me){if(!root.hidden)stop('not-choosing');}
  } else if(colors.includes(g.trump)) {
   const fresh=last&&last.phase==='trump'&&!last.trump;
   if(fresh&&accepted!==g.trump&&ready&&!g.paused&&!g.trick?.length){if(Number.isInteger(g.bidder)&&g.bidder>=0&&g.bidder<4)ceremony(g.trump,g.bidder);else paint(g.trump);}
   else if(!running){if(!root.hidden)stop('playing');paint(g.trump);accepted=g.trump;}
   // Never let the ceremony obscure the first played trick.
   if(running&&(g.trick?.length||g.paused)){stop('play-advanced');paint(g.trump);accepted=g.trump;}
  }
  last=snapshot;
 }
 function resized(){
  if(running){stop('viewport-change');if(current?.phase==='play')paint(current.trump);}
  if(!portrait()){stop('landscape');if(canvas)canvas.hidden=true;return;}
  if(current?.phase==='play')paint(current.trump);
  else if(current?.phase==='trump'&&current.bidder===currentMe&&!opts.spectator&&!current.paused&&dockRef&&submitRef)choose(dockRef,submitRef,current);
  position();
 }
 function prepareMaterials(){
  const preload=[...Object.keys(specs),'confirm-brass'].map(name=>window.HORAssetLoading772.image(assetRoot+name+'.png').then(im=>{
   if(name==='stamp'){stampSource=im;buildMaterials(im);}return true;
  }).catch(error=>{log('asset-error',String(error));return false;}));
  Promise.all(preload).then(values=>{ready=values.every(Boolean);log('assets',ready);});
 }
 prepareMaterials();document.addEventListener('hor-artwork-retry',()=>{if(!ready)prepareMaterials();});
 const faintTable=new Image();faintTable.onload=()=>{document.body.classList.add('trump746-faint');log('faint-table',true);};faintTable.onerror=()=>log('faint-table',false);faintTable.src='assets/trump746/table-faint.png';
 const table=new Image();table.onload=()=>{
  // Actual-pixel mask: the approved pale crest has a distinct red/blue ratio
  // from blue felt. No new crest silhouette or table image is synthesized.
  const x=260,y=750,w=360,h=220,src=document.createElement('canvas');src.width=w;src.height=h;const c=src.getContext('2d');c.drawImage(table,x,y,w,h,0,0,w,h);const data=c.getImageData(0,0,w,h).data,alpha=new Uint8ClampedArray(w*h);
  for(let i=0;i<alpha.length;i++){const k=i*4;const strength=(data[k]-.15*data[k+2]-3)/15;alpha[i]=Math.max(0,Math.min(1,strength))*255;}
  mask={x,y,w,h,alpha};if(markColor)paint(markColor);
 };table.src='assets/table003/room-table-perspective.png';
 window.addEventListener('resize',resized);window.addEventListener('orientationchange',()=>requestAnimationFrame(resized));
 matchMedia('(orientation:portrait)').addEventListener('change',resized);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){stop('background');if(current?.phase==='play')paint(current.trump);}});
 new MutationObserver(()=>{if(!document.body.classList.contains('in-game')&&root&&(running||!root.hidden||markColor)){stop('left-table');paint(null);last=null;accepted=null;}}).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.HORTrump714={choose,chooseFallback,sync,ownsPortrait,inspect:()=>({panel,plaque,tentativeTrump,choiceKey,ready,running,pending,accepted,markColor,visible:!!root&&!root.hidden,trace:trace.slice(),pose,inkColor,maskReady:!!mask})};
})();

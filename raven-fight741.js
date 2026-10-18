/* 741: presentation observer for an already resolved Black Bird capture.
   Never changes game state, card ownership, score, legality or turn timers. */
(function(){'use strict';
const T=window.HORRavenTimeline741,frames=['UP','MID','DOWN'],images={},bounds={BLACK_WINGS_UP:[634,542,1675,1680],BLACK_WINGS_MID:[499,732,1682,1644],BLACK_WINGS_DOWN:[511,919,1675,1754],RED_WINGS_UP:[615,552,1765,1720],RED_WINGS_MID:[627,667,1829,1672],RED_WINGS_DOWN:[620,901,1729,1733]};
let enabled=true,loaded=false,active=null,seen='',owned='',serial=0,raf=0,timer=0,canvas=null,ctx=null;
// One presentation gate; award/state processing is never gated.
const clocks=new Set();
function later(fn,ms){const c={fn,left:ms,start:0,id:0};clocks.add(c);arm(c);return c;}
function arm(c){if(active&&!active.preview)return;c.start=performance.now();c.id=setTimeout(()=>{clocks.delete(c);c.fn()},Math.max(0,c.left));}
function stopClock(c){if(!c)return;clearTimeout(c.id);clocks.delete(c);}
function pauseClocks(){for(const c of clocks){if(c.id){clearTimeout(c.id);c.left=Math.max(0,c.left-(performance.now()-c.start));c.id=0;}}}
function resumeClocks(stale){for(const c of [...clocks]){if(stale)stopClock(c);else if(!c.id)arm(c);}}
function relevant(a){return a.preview||(typeof game!=='undefined'&&game===a.game&&document.body.classList.contains('in-game'));}
const stats={starts:0,finishes:0,cancels:0,last:null};
const ready=Promise.all(Object.keys(bounds).map(name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=768;c.getContext('2d').drawImage(im,0,0,768,768);images[name]=c;resolve()};im.onerror=()=>reject(Error(name));im.src='assets/raven-fight/'+name+'.png';}))).then(()=>{loaded=true;return true}).catch(()=>false);
function signature(g){return g&&g.trick?String(g.handNumber)+':'+String(g.lastTrickWinner)+':'+g.trick.map(p=>p.player+'/'+p.card?.id).join('|'):'';}
function eligible(g){if(!g||g.phase!=='play'||!g.resolvingTrick||g.trick?.length!==4||g.lastTrickWinner==null)return false;const winner=g.trick.find(p=>p.player===g.lastTrickWinner);return !!winner&&detectSpecialCaptures(g.trick,winner).includes('rook-red2');}
function ownsCapture(g){return enabled&&loaded&&eligible(g)&&owned===signature(g);}
function geometry(black,red){
 const b=black?.getBoundingClientRect(),r=red?.getBoundingClientRect();if(!b?.width||!r?.width)return null;
 const land=matchMedia('(orientation: landscape)').matches,el=land?document.querySelector('#ltViewTrick'):document.querySelector('.table-felt');const f=el?.getBoundingClientRect();
 if(land&&window.HORAngleC?.active()){
  const scene=HORAngleC.frame(),l=window.HORLowerLayout;
  const left=Math.max(8,innerWidth*.10),right=innerWidth-left,top=Math.max(44,scene.top+300*scene.scale),bottom=Math.min(innerHeight-12,Math.max(top+88,(l?.handY??innerHeight*.74)-8));
  if(right-left<80||bottom-top<45)return null;
  return {left,top,w:right-left,h:bottom-top,starts:{black:{x:(b.left+b.width/2-left)/(right-left),y:(b.top+b.height/2-top)/(bottom-top)},red:{x:(r.left+r.width/2-left)/(right-left),y:(r.top+r.height/2-top)/(bottom-top)}}};
 }
 const left=Math.max(2,f?.left??2),right=Math.min(innerWidth-2,f?.right??innerWidth-2),top=Math.max(44,f?.top??44),bottom=Math.min(innerHeight-8,f?.bottom??innerHeight-8);
 if(right-left<80||bottom-top<80)return null;
 return {left,top,w:right-left,h:bottom-top,starts:{black:{x:(b.left+b.width/2-left)/(right-left),y:(b.top+b.height/2-top)/(bottom-top)},red:{x:(r.left+r.width/2-left)/(right-left),y:(r.top+r.height/2-top)/(bottom-top)}}};
}
function clear(reason,complete=false){const a=active;window.HORRavenAudio761?.stop();active=null;cancelAnimationFrame(raf);clearTimeout(timer);raf=timer=0;canvas?.remove();canvas=ctx=null;document.body.classList.remove('raven-fight-active741');if(!a)return;if(complete)stats.finishes++;else stats.cancels++;stats.last={id:a.id,reason,elapsed:performance.now()-a.born,duration:a.duration,settle:a.settle,preview:a.preview};const stale=!relevant(a);resumeClocks(stale);if(!stale)for(const fn of a.callbacks){try{fn()}catch(e){console.warn('Deferred presentation:',e)}}else {try{window.HORProgression?.presentation?.resetVisuals();captureCelebrationQueue=[];captureCelebrationRunning=false;document.querySelectorAll('#captureOverlay,#bigTrickOverlay,#tableMsgPopup').forEach(e=>e.classList.add('hidden'));document.getElementById('bottomTrickWinnerNotice')?.classList.remove('btwn-show');document.getElementById('horNetworkToast')?.classList.remove('show');}catch(_){}}if(a.onDone)try{a.onDone()}catch(_){} }

function bird(side,p,g){if(p.alpha<=.001||p.scale<=0)return;const black=side==='black',name=(black?'BLACK':'RED')+'_WINGS_'+frames[p.frame],bb=bounds[name],ax=black?1280:1024,ay=1280,span=Math.min(g.w*.46,g.h*.54,210),scale=span/1200*(black?1:.8)*p.scale,cs=Math.cos(p.angle),sn=Math.sin(p.angle),corners=[[bb[0],bb[1]],[bb[2],bb[1]],[bb[2],bb[3]],[bb[0],bb[3]]].map(([x,y])=>{x=(x-ax)*scale;y=(y-ay)*scale;return [x*cs-y*sn,x*sn+y*cs]}),xs=corners.map(c=>c[0]),ys=corners.map(c=>c[1]),x=Math.max(2-Math.min(...xs),Math.min(g.w-2-Math.max(...xs),p.x*g.w)),y=Math.max(2-Math.min(...ys),Math.min(g.h-2-Math.max(...ys),p.y*g.h));ctx.save();ctx.translate(x,y);ctx.rotate(p.angle);ctx.scale(scale,scale);ctx.globalAlpha=p.alpha;ctx.drawImage(images[name],-ax,-ay,2304,2304);ctx.restore();return {side,name,scale,alpha:p.alpha,box:{left:x+Math.min(...xs),right:x+Math.max(...xs),top:y+Math.min(...ys),bottom:y+Math.max(...ys)}};}
function draw(ms){const a=active;if(!a||!ctx)return null;if(a.landscape)return HORRavenLandscape837.draw(ctx,a.g,ms,a.reduced);ctx.clearRect(0,0,a.g.w,a.g.h);const span=Math.min(a.g.w*.46,a.g.h*.54,210),spread=Math.min(1,span*.36/(a.g.w*.17)),state=T.sample(ms,a.g.starts,a.reduced,spread),red=bird('red',state.red,a.g),black=bird('black',state.black,a.g);
 if(state.particles){const age=(ms-1250)/1000;for(let i=0;i<9;i++){const k=i*2.399;ctx.save();ctx.translate(a.g.w*.51+Math.cos(k)*age*a.g.w*.15,a.g.h*.38+Math.sin(k)*age*a.g.h*.06+age*age*a.g.h*.1);ctx.rotate(k+age*(i%2?2:-2));ctx.globalAlpha=Math.max(0,1-age/1.3)*.8;ctx.strokeStyle=i%3?'#686d78':'#b2333a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-4);ctx.quadraticCurveTo(5,0,0,5);ctx.quadraticCurveTo(-2,0,0,-4);ctx.stroke();ctx.restore();}}
 return {time:ms,phase:state.phase,red,black,geometry:a.g};
}
function launch(a){try{launchSafe(a)}catch(e){console.warn('Raven presentation:',e);clear('animation error')}}
function launchSafe(a){if(active!==a)return;if(!a.preview){const selector=matchMedia('(orientation: landscape)').matches?'#ltPlays .card-face':'#trickArea .card-face';const els=[...document.querySelectorAll(selector)];a.black=els.find(e=>e.dataset.id==='rook');a.red=els.find(e=>e.dataset.id==='red-2');}a.landscape=!!window.HORRavenLandscape837?.available();const g=a.landscape?HORRavenLandscape837.geometry(a.black,a.red):geometry(a.black,a.red);if(!g){clear('missing geometry');return;}a.g=g;if(!a.preview){document.querySelectorAll('#trickArea .played-scene,#ltPlays .card-face').forEach(e=>e.getAnimations().forEach(x=>{try{x.finish()}catch(_){}}));}canvas=document.createElement('canvas');canvas.id='ravenFight741';canvas.setAttribute('aria-hidden','true');canvas.style.cssText=`position:fixed;left:${g.left}px;top:${g.top}px;width:${g.w}px;height:${g.h}px;z-index:${a.preview?2147483641:100001};pointer-events:none;`;
 const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(g.w*d);canvas.height=Math.round(g.h*d);ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);document.body.appendChild(canvas);a.started=performance.now();stats.starts++;if(a.landscape){a.cues=[[300,'approach',.65],[1650,'call',.65],[3750,'flutter',.65]];a.cueDuration=5100;}window.HORRavenAudio761?.start(a);
 const end=a.landscape?5100:a.reduced?700:T.duration;const tick=now=>{if(active!==a)return;const elapsed=now-a.started;if(elapsed>=a.duration){clear('complete',true);return;}try{draw(elapsed/a.duration*end);raf=requestAnimationFrame(tick)}catch(e){console.warn('Raven frame:',e);clear('animation error')}};draw(1);raf=requestAnimationFrame(tick);
 // Independent bounded cleanup also works when RAF is throttled.
 timer=setTimeout(()=>{if(active===a)clear('deadline',true)},a.duration);
}
function play({blackCardElement,redCardElement,captureId,duration=2750,settle=0,reducedMotion=false,preview=false,onDone}){if(!enabled||!loaded||!blackCardElement||!redCardElement)return false;clear('replaced');const a=active={id:captureId||'preview-'+(++serial),black:blackCardElement,red:redCardElement,duration:Math.max(20,duration),settle,reduced:reducedMotion,preview,onDone,game:typeof game!=='undefined'?game:null,hand:typeof game!=='undefined'?game?.handNumber:null,callbacks:[],born:performance.now()};if(!preview){pauseClocks();document.body.classList.add('raven-fight-active741');}timer=setTimeout(()=>launch(a),Math.max(0,settle));return true;}
function sync(g,{scaled,reduced=false,pace=1}={}){
 const key=signature(g);if(!eligible(g)){if(active&&!active.preview)clear('state changed');seen=owned='';return;}
 if(!enabled||!loaded||!document.body.classList.contains('in-game'))return;
 if(seen===key)return;seen=key;owned=key;
 const selector=matchMedia('(orientation: landscape)').matches?'#ltPlays .card-face':'#trickArea .card-face',els=[...document.querySelectorAll(selector)],black=els.find(e=>e.dataset.id==='rook'),red=els.find(e=>e.dataset.id==='red-2');
 if(window.HORRavenLandscape837?.available()){const timing=HORRavenLandscape837.timing(pace,reduced);play({blackCardElement:black,redCardElement:red,captureId:'capture-'+(++serial)+'-'+key,...timing,reducedMotion:reduced});if(!active)owned='';return;}
 const budget=scaled?scaled(2750,0):2750,settle=Math.min((scaled?scaled(480,100):480)+16,budget*.4),brief=reduced||pace===99;
 play({blackCardElement:black,redCardElement:red,captureId:'capture-'+(++serial)+'-'+key,duration:brief?Math.min(700,budget-settle):budget-settle,settle,reducedMotion:brief});
 // If assets/DOM cannot be rendered, keep the existing ordinary capture path.
 if(!active)owned='';
}
function cancel(reason='cancelled'){clear(reason);}
function deferCelebration(fn){if(!active||active.preview)return false;active.callbacks.push(fn);return true;}
function destroy(){cancel('destroy');enabled=false;}
window.HORRavenFight741={ready,collectionDelay(g,pace,reduced,network=false){if(!eligible(g))return 0;if(!network&&(!enabled||!loaded||!window.HORRavenLandscape837?.available()))return 0;const t=HORRavenLandscape837.timing(network?1:pace,network?false:reduced);return t.duration+t.settle+180;},sync,play,cancel,destroy,ownsCapture,deferCelebration,later,stopClock,replacesBirdMessage(){return enabled&&loaded},setEnabled(v){enabled=!!v;if(!enabled){owned='';cancel('disabled');}},getState(){return {enabled,loaded,active:!!active,id:active?.id,pending:!!active&&!canvas,duration:active?.duration,landscape:active?.landscape,stats:JSON.parse(JSON.stringify(stats))}},inspectFrame:draw};
window.addEventListener('resize',()=>cancel('resize'));window.addEventListener('pagehide',()=>cancel('navigation'));document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel('hidden')});matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>cancel('motion preference'));
new MutationObserver(()=>{if(active&&!document.body.classList.contains('in-game'))cancel('left game')}).observe(document.body,{attributes:true,attributeFilter:['class']});
})();

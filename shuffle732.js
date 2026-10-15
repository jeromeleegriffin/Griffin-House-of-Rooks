/* Build732: approved731 wash/riffle/bridge. Presentation only; game owns dealing. */
(()=>{'use strict';
const BASE=5600,old=[0,1836,2340,2916,5454,5652,6084,6480,7200],now=[0,1836,2450,3000,3720,4050,4360,4720,5600];
let animations=[],sources=[],cards=[],raf=0,generation=0,active=false,started=0,duration=BASE,minimal=false,lastEvent=null;
const buffers=new Map(),loading=new Map(),art=new Image();art.src='assets/images/cardback-griffin-approved-133.png';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function mapped(s){let k=1;while(k<old.length-1&&s>old[k])k++;return now[k-1]+(now[k]-now[k-1])*(s-old[k-1])/(old[k]-old[k-1]);}
function silence(){for(const s of sources)try{s.stop()}catch(_){}sources=[];}
function clean(el){if(el._bridge)el._bridge.style.display='none';for(const p of ['overflow','background','box-shadow','border','transform'])el.style.removeProperty(p);}
function stop(){generation++;active=false;cancelAnimationFrame(raf);raf=0;animations.forEach(a=>a.cancel());animations=[];silence();cards.forEach(clean);}
function bridge(t){for(let i=0;i<cards.length;i++){
 const el=cards[i],rank=(i*17+11)%46;
 if(minimal||t<3830||t>=4930){clean(el);continue;}
 let cv=el._bridge;if(!cv){cv=document.createElement('canvas');cv.width=228;cv.height=320;cv.style.cssText='position:absolute;left:-20px;top:-48px;width:114px;height:160px;pointer-events:none';el.appendChild(cv);el._bridge=cv;}
 cv.style.display='block';el.style.setProperty('overflow','visible','important');el.style.setProperty('background','none','important');el.style.setProperty('border','0','important');el.style.setProperty('box-shadow','none','important');
 const rise=smooth((t-3830)/340),release=4200+rank*9,fall=smooth((t-release)/110),bend=rise*(1-fall),amp=(33+rank*.035)*bend;
 const side=rank%2?-1:1,join=1-smooth((t-3830)/190),x=side*5*join+(rank%3-1)*.18;
 el.style.setProperty('transform',`translate(${x}px,${-rank*.25}px)`,'important');
 const c=cv.getContext('2d');c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,114,160);
 const w=74-12*bend,left=(114-w)/2,top=48;
 if(art.complete&&art.naturalWidth)for(let j=0;j<48;j++){
  const u=j/48,u2=(j+1)/48,hump=Math.sin(Math.PI*(u+u2)/2)*amp;
  c.drawImage(art,u*art.naturalWidth,0,art.naturalWidth/48,art.naturalHeight,left+u*w,top-hump,w/48+.45,106);
 }
 c.strokeStyle='#514735';c.lineWidth=.28;
 for(const yy of [top,top+106]){c.beginPath();for(let j=0;j<=48;j++){const u=j/48;c.lineTo(left+u*w,yy-Math.sin(Math.PI*u)*amp);}c.stroke();}
}}
function tick(){if(!active)return;const t=Math.min(BASE,(performance.now()-started)*BASE/duration);bridge(t);if(soundMuted||!soundCard)silence();if(t<BASE)raf=requestAnimationFrame(tick);}
function start(ov,ms){
 stop();active=true;duration=ms;started=performance.now();ov.classList.add('shuffle732');
 minimal=ms<400||matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('reduce-motion');
 const plane=ov.querySelector('.shuffle-plane033');plane.replaceChildren();cards=[];
 for(let i=0;i<46;i++){
  const el=document.createElement('div');el.className='shuffle-card';plane.appendChild(el);cards.push(el);el.style.zIndex=i+1;
  const rank=(i*17+11)%46,side=rank%2?-1:1,l=Math.floor(rank/2),a=i*2.39996,rad=31+(i*7%53),x=Math.cos(a)*rad,y=Math.sin(a)*rad*.45;
  const b=((i*13+7)%46)*2.39996,c=((i*19+3)%46)*2.39996,r2=35+(i*11%48),r3=28+(i*5%58),lag=(i%4)*.003,stackX=(rank%3-1)*.18,stackY=-rank*.25;
  const f=(offset,x,y,r,rx=0,ry=0)=>({offset:mapped(offset*7200)/BASE,easing:'cubic-bezier(.35,0,.25,1)',transform:`translate(${x}px,${y}px) rotate(${r}deg) rotateX(${rx}deg) rotateY(${ry}deg)`});
  const release=.405+rank*.0069;
  const frames=minimal?[f(0,stackX,stackY,0),f(1,stackX,stackY,0)]:[
   f(0,(i%3-1)*.18,-i*.25,0),f(.035+lag,(i%3-1)*.18,-i*.25,0),f(.095+lag,x,y,Math.sin(a)*35),
   f(.145+lag,Math.cos(b)*r2,Math.sin(b)*r2*.45,Math.cos(b)*48),f(.195+lag,Math.cos(c)*r3,Math.sin(c)*r3*.45,Math.sin(c)*42),
   f(.222+lag,Math.cos(c)*r3*.48,Math.sin(b)*15,Math.sin(b)*18),f(.255,stackX,stackY,0),
   f(.325,side*(49+l*.18),-l*.48-5,side*11,0,-side*13),f(release,side*(47+l*.18),-l*.48-8,side*10,0,-side*19),
   f(release+.018,side*19,-rank*.26+5,side*3,7,-side*5),f(release+.042,side*6,-rank*.26,side*.8),
   f(.785,side*5,-rank*.26,side*.5),f(.845,stackX,-11-rank*.30,0,18),f(.90,stackX,stackY,0,-2),
   f(.945,stackX+1.8,stackY,0),f(.975,stackX,stackY,0),f(1,stackX,stackY,0)];
  animations.push(el.animate(frames,{duration:ms,fill:'both',easing:'linear'}));
  const z=(offset,value)=>({offset:mapped(offset*7200)/BASE,zIndex:value,easing:'steps(1,end)'});
  if(!minimal)animations.push(el.animate([z(0,i+1),z(.12+lag,(i*13+7)%46+1),z(.17+lag,(i*19+3)%46+1),z(.232+lag,rank+1),z(1,rank+1)],{duration:ms,fill:'both',easing:'linear'}));
 }
 lastEvent={duration:ms,minimal,cards:46};raf=requestAnimationFrame(tick);
}
function load(ctx,pace){
 if(buffers.has(pace))return Promise.resolve(buffers.get(pace));if(loading.has(pace))return loading.get(pace);
 const p=fetch('assets/audio/shuffle732/'+pace+'.wav').then(r=>{if(!r.ok)throw Error('shuffle audio');return r.arrayBuffer()}).then(b=>ctx.decodeAudioData(b)).then(b=>{buffers.set(pace,b);return b}).catch(()=>null).finally(()=>loading.delete(pace));loading.set(pace,p);return p;
}
function sound(){
 if(!active||duration<400||soundMuted||!soundCard)return;
 const ctx=ensureAudio();if(!ctx)return;const token=generation,pace=Math.max(1,Math.min(4,Math.round(BASE/duration)));
 load(ctx,pace).then(buffer=>{if(!buffer||token!==generation||!active||soundMuted||!soundCard)return;
 whenAudioReady(c=>{
  if(token!==generation||!active||soundMuted||!soundCard)return;
  const elapsed=(performance.now()-started)/1000;if(elapsed>=duration/1000)return;
  const source=c.createBufferSource();source.buffer=buffer;source.playbackRate.value=buffer.duration/(duration/1000);source.connect(window.HORAudioMixer.output(c,'gameplay'));sources.push(source);
  source.onended=()=>{sources=sources.filter(s=>s!==source);source.disconnect()};
  source.start(c.currentTime,elapsed*source.playbackRate.value);source.stop(c.currentTime+Math.max(0,duration/1000-elapsed));
 });});
}
const warm=()=>{if(typeof ensureAudio!=='function'||soundMuted||!soundCard)return;const c=ensureAudio();if(c)[1,3].forEach(p=>load(c,p));};
document.addEventListener('pointerdown',warm,{once:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
new MutationObserver(()=>{if(!document.body.classList.contains('in-game')&&active)stop()}).observe(document.body,{attributes:true,attributeFilter:['class']});
window.HORShuffle732={start,stop,sound,silence,inspect:()=>({active,duration,motions:animations.length,sounds:sources.length,lastEvent}),seek:ms=>{cancelAnimationFrame(raf);animations.forEach(a=>{a.pause();a.currentTime=ms});bridge(ms*BASE/duration)}};
})();

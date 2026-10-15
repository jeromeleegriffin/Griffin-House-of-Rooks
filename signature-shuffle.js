/* Signature shuffle: visual adapter over the existing 732 lifecycle.
   Game and dealing logic remain unchanged from inspected Build 753. */
(()=>{'use strict';
const legacy=window.HORShuffle732,BASE=5600,HOLD_START=1833,HOLD_END=2400,GAP=HOLD_END-HOLD_START,PLAY=BASE-GAP;
// Omit only the stationary fully-lifted hold. All moving sections keep native tempo.
function visualTime(elapsed){const t=Math.max(0,Math.min(PLAY,elapsed*PLAY/duration));return t<HOLD_START?t:t+GAP;}
function presentationTime(assetMs){return assetMs>=HOLD_END?assetMs-GAP:assetMs;}
window.HORShuffleLegacy732=legacy;
let player=null,canvas=null,overlay=null,raf=0,active=false,mode='none',generation=0,started=0,duration=PLAY,minimal=false,soundRequested=false;
let sources=[],last=null,stats=null;const buffers=new Map(),pending=new Map();
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function gain(){return Math.max(0,Math.min(1,1))}
function silence(){for(const s of sources){try{s.node.stop();s.node.disconnect();s.envelope?.disconnect();s.gain.disconnect()}catch(_){}}sources=[];legacy.silence()}
function stop(){generation++;active=false;cancelAnimationFrame(raf);raf=0;silence();legacy.stop();if(player){player.close();stats=player.inspect();player=null}canvas?.remove();canvas=null;overlay?.classList.remove('signature-shuffle');overlay=null;mode='none';soundRequested=false}
function geometry(t){
 const bg=document.getElementById('hor-room-bg'),r=bg?bg.getBoundingClientRect():{left:0,top:0,width:innerWidth,height:innerHeight};
 const cover=Math.max(r.width/875,r.height/1797),scale=cover/(915/1797),ox=r.left+(r.width-875*cover)/2;
 let slot='slot-me';try{slot=seatSlotIdForIndex(Number.isInteger(game.dealer)?game.dealer:0)}catch(_){}
 const loc={'slot-me':[610,1000],'slot-partner':[437.5,720],'slot-left':[235,880],'slot-right':[640,880]}[slot]||[610,1000];
 const mix=minimal?1:smooth((t-5070)/490),size=(300+(202.381-300)*mix)*scale;
 const x=innerWidth/2+(ox+loc[0]*cover+5.4*scale-innerWidth/2)*mix;
 // Match the existing carrier's initial printed-card center and lifted start.
 const y0=r.top+840*cover,y1=r.top+loc[1]*cover-18*cover-3.22*scale;
 const y=y0+(y1-y0)*mix;
 canvas.style.width=canvas.style.height=size+'px';canvas.style.left=(x-size/2)+'px';canvas.style.top=(y-size/2+(5.5+(4.743-5.5)*mix)*scale)+'px';
 return {x,y,size,slot,mix};
}
function tick(now){if(!active||mode!=='asset')return;const t=Math.min(BASE,visualTime(now-started));geometry(t);if(player)player.draw(minimal?5599:t);if(soundMuted||!soundCard)silence();else for(const s of sources)s.gain.gain.setTargetAtTime(gain(),s.ctx.currentTime,.015);if(t<BASE)raf=requestAnimationFrame(tick)}
function start(ov,ms){
 stop();overlay=ov;duration=Math.max(1,ms);started=performance.now();active=true;
 // Preserve the approved landscape presentation and provide a deterministic rollback switch.
 if(!isPortraitViewport()||new URLSearchParams(location.search).get('shuffle')==='legacy'){
  mode='legacy';legacy.start(ov,ms);last={mode,duration};return;
 }
 mode='asset';minimal=ms<600||matchMedia('(prefers-reduced-motion:reduce)').matches||document.body.classList.contains('reduce-motion');
 ov.classList.add('signature-shuffle');canvas=document.createElement('canvas');canvas.className='signature-shuffle-canvas';canvas.setAttribute('aria-hidden','true');ov.appendChild(canvas);
 player=new GriffinShuffleAsset.Player(canvas,{skipCornerHold:true});const token=generation,p=player;
 geometry(0);last={mode,duration,minimal,art:'approved Griffin PNG',frames:168,omittedStationaryFrames:17,removedHoldMs:GAP,releaseDurationAt1x:850};
 p.seek(minimal?5599:0).then(()=>{if(!active||token!==generation)return;if(p.last<0){last.fallback='approved poster while retrying';last.assetUnavailable=true}});
 raf=requestAnimationFrame(tick);
}
function load(ctx,pace){if(buffers.has(pace))return Promise.resolve(buffers.get(pace));if(pending.has(pace))return pending.get(pace);const p=fetch('assets/audio/shuffle732/'+pace+'.wav').then(r=>{if(!r.ok)throw Error('shuffle audio');return r.arrayBuffer()}).then(b=>ctx.decodeAudioData(b)).then(b=>{buffers.set(pace,b);return b}).catch(()=>null).finally(()=>pending.delete(pace));pending.set(pace,p);return p}
// Decode on a player gesture before the opening needs it; never delay the visual clock.
for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{const c=ensureAudio();if(c){load(c,1);load(c,3)}},{once:true,capture:true});
// Map the visual epoch to the browser's output clock when it is valid. This
// removes common speaker-buffer lag without shifting one gesture relative to another.
function audioEpoch(c,elapsed){const now=performance.now(),stamp=c.getOutputTimestamp?.();if(stamp&&stamp.performanceTime>0&&Math.abs(now-stamp.performanceTime)<1000){const outputNow=stamp.contextTime+(now-stamp.performanceTime)/1000,lag=c.currentTime-outputNow;if(lag>=0&&lag<=.25)return stamp.contextTime+(started-stamp.performanceTime)/1000;}return c.currentTime-elapsed;}
function sound(){
 if(mode.startsWith('legacy'))return legacy.sound();if(!active||minimal||soundMuted||!soundCard||soundRequested)return;
 soundRequested=true;const ctx=ensureAudio();if(!ctx)return;const token=generation,pace=Math.max(1,Math.min(4,Math.round(BASE/duration)));
 load(ctx,pace).then(buffer=>{if(!buffer||token!==generation||!active||soundMuted||!soundCard)return;whenAudioReady(c=>{
  if(token!==generation||!active||soundMuted||!soundCard)return;
  const scale=duration/PLAY,ratio=buffer.duration/(BASE/1000*scale),elapsed=(performance.now()-started)/1000,epoch=audioEpoch(c,elapsed);
  // Full native riffle ends at verified source silence3.80s. Bridge resumes from that
  // same quiet boundary on its own visual clock; no flap is cut or duplicated.
  // Frame73 is first visibly moving riffle frame; frame127 begins visible bridge release.
  for(const [begin,end,phase,attack] of [[.18,.76,.18,0],[3.014,3.80,73/30,.008],[3.80,5.10,3.80,0]]){
   const from=(presentationTime(phase*1000)/1000-attack)*scale,to=from+(end-begin)*scale;if(elapsed>=to)continue;
   const at=Math.max(elapsed,from,c.currentTime-epoch),length=to-at;if(length<=0)continue;const node=c.createBufferSource(),g=c.createGain(),envelope=c.createGain();node.buffer=buffer;node.playbackRate.value=ratio;g.gain.value=gain();node.connect(envelope);envelope.connect(g);g.connect(window.HORAudioMixer.output(c,'gameplay'));
   const when=Math.max(c.currentTime,epoch+at),fade=Math.min(.008,length/3);envelope.gain.setValueAtTime(0,when);envelope.gain.linearRampToValueAtTime(1,when+fade);envelope.gain.setValueAtTime(1,when+length-fade);envelope.gain.linearRampToValueAtTime(0,when+length);
   const item={node,gain:g,envelope,ctx:c,sourceBegin:begin,sourceEnd:end,phase,attack,presentationFrom:from,scheduledWhen:when,outputLatency:c.outputLatency||0};sources.push(item);node.onended=()=>{sources=sources.filter(s=>s!==item);try{node.disconnect();envelope.disconnect();g.disconnect()}catch(_){}};
   node.start(when,(begin*scale+(at-from))*ratio,length*ratio);
  }
 });});
}
async function seek(ms){if(mode!=='asset')return legacy.seek(ms);cancelAnimationFrame(raf);raf=0;const t=Math.min(BASE,visualTime(Math.max(0,ms)));geometry(t);await player?.seek(minimal?5599:t)}
function inspect(){return {active,mode,duration,minimal,startedAt:started,motions:raf?1:0,sounds:sources.length,audioGains:sources.map(s=>s.gain.gain.value),audioRates:sources.map(s=>s.node.playbackRate.value),audioSchedule:sources.map(s=>({sourceBegin:s.sourceBegin,sourceEnd:s.sourceEnd,phase:s.phase,attack:s.attack,presentationFrom:s.presentationFrom,scheduledWhen:s.scheduledWhen,outputLatency:s.outputLatency})),lastEvent:last,asset:player?.inspect()||stats}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',stop);window.addEventListener('orientationchange',stop);
new MutationObserver(()=>{if(active&&!document.body.classList.contains('in-game'))stop()}).observe(document.body,{attributes:true,attributeFilter:['class']});
window.HORShuffle732={start,stop,sound,silence,seek,inspect};window.HORSignatureShuffle=window.HORShuffle732;
})();

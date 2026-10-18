/* Quiet recorded cues only; never gate animation, awards, state or timers. */
(function(){'use strict';
const names=['approach','call','flutter'],bytes=new Map(),buffers=new Map(),sources=new Set();
let decoding=null,current=null,generation=0,monitor=0;
const stats={starts:0,stops:0,cues:[],skipped:0};
const files=Promise.all(names.map(async name=>{try{const r=await fetch('assets/audio/raven-fight761/'+name+'.wav');if(r.ok)bytes.set(name,await r.arrayBuffer())}catch(_){}}));
function level(){if(document.hidden||soundMuted||!soundCard||!soundRook)return 0;const v=1;return Math.max(0,Math.min(1,Number.isFinite(v)?v:1));}
function warm(){if(decoding)return decoding;const c=ensureAudio();if(!c)return Promise.resolve(false);decoding=files.then(async()=>{for(const name of names){if(!bytes.has(name))continue;try{buffers.set(name,await c.decodeAudioData(bytes.get(name).slice(0)))}catch(_){}}return buffers.size===3;});return decoding;}
for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{warm().catch(()=>{})},{once:true,capture:true});
function stop(){clearInterval(monitor);monitor=0;generation++;if(current)stats.stops++;current=null;for(const item of [...sources]){try{const now=item.c.currentTime;item.g.gain.cancelScheduledValues(now);item.g.gain.setValueAtTime(item.g.gain.value,now);item.g.gain.linearRampToValueAtTime(0,now+.02);item.s.stop(now+.02)}catch(_){dispose(item)}}}
function dispose(item){sources.delete(item);try{item.s.disconnect();item.e.disconnect();item.g.disconnect()}catch(_){}}
function update(){if(!current)return;const value=level();if(!value){stop();return}for(const item of sources)item.g.gain.value=value;}
function start(a){stop();if(a.reduced||!level()){stats.skipped++;return}const token=generation,c=ensureAudio();if(!c)return;current=a;stats.starts++;monitor=setInterval(update,40);
 warm().then(()=>{if(token!==generation||current!==a||!level()||c.state!=='running')return;const elapsed=(performance.now()-a.started)/1000,duration=a.duration/1000;
  // Never emit a late catch-up call after a stalled fetch/decode/resume.
  if(elapsed>.15){stats.skipped++;return}
  const cues=a.cues||(a.duration<1100?[[0,'approach',.4]]:[[350,'approach',1],[1120,'call',1],[2350,'flutter',1]]);
  for(const [phase,name,quiet] of cues){const b=buffers.get(name);if(!b)continue;const offset=phase/(a.cueDuration||2750)*duration;if(elapsed>offset+.06)continue;const delay=Math.max(0,offset-elapsed),length=Math.min(b.duration,duration-elapsed-delay);if(length<.06)continue;
   const s=c.createBufferSource(),e=c.createGain(),g=c.createGain();s.buffer=b;s.playbackRate.value=1;g.gain.value=level();s.connect(e);e.connect(g);g.connect(window.HORAudioMixer.output(c,'character'));
   const at=c.currentTime+delay,fade=Math.min(.06,length/3);e.gain.setValueAtTime(0,at);e.gain.linearRampToValueAtTime(quiet,at+fade);e.gain.setValueAtTime(quiet,at+length-fade);e.gain.linearRampToValueAtTime(0,at+length);const item={s,e,g,c,name};sources.add(item);s.onended=()=>dispose(item);s.start(at,0,length);stats.cues.push({id:a.id,name,phase,offsetMs:offset*1000,lengthMs:length*1000,rate:1});if(stats.cues.length>60)stats.cues.shift();
  }
 }).catch(()=>{});
}
window.HORRavenAudio761={start,stop,update,warm,getState(){return {active:!!current,sources:sources.size,loaded:buffers.size,level:level(),stats:JSON.parse(JSON.stringify(stats))}}};
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
})();

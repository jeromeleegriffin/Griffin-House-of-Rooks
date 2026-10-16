/* All spoken lines share one output. No game state ownership. */
(()=>{'use strict';
const pending=[];let active=null,serial=0;const log=[];
function record(type,id){log.push({type,id});if(log.length>100)log.shift();}
function next(){
 if(active)return;
 while(pending.length){
  const h=pending.shift();if(h.cancelled||!h.options.valid()){h.finish();continue;}
  active=h;const token=++serial;h.deadline=setTimeout(()=>h.stop(),8000);
  whenAudioReady(ctx=>{
   if(active!==h||token!==serial||h.cancelled)return;
   if(!h.options.valid()){h.finish();return;}
   clearTimeout(h.deadline);
   const source=ctx.createBufferSource(),gain=ctx.createGain();h.source=source;h.gain=gain;
   source.buffer=h.buffer;gain.gain.value=h.options.gain??.8;source.connect(gain);gain.connect(window.HORAudioMixer.output(ctx,'voices'));
   source.onended=()=>h.finish();
   if(typeof presentationSounds035!=='undefined')presentationSounds035.add(source);
   source.start();record('start',h.options.id);h.options.onStart?.();
  });return;
 }
}
function enqueueBuffer(buffer,options){
 let done=false;const h={buffer,options,cancelled:false,source:null,gain:null,
  stop(){if(done)return;h.cancelled=true;if(h.source){try{h.source.stop();}catch(_){}}h.finish();},
  finish(){if(done)return;done=true;clearTimeout(h.deadline);const was=active===h;if(was){active=null;serial++;}if(h.source){if(typeof presentationSounds035!=='undefined')presentationSounds035.delete(h.source);try{h.source.disconnect();h.gain.disconnect();}catch(_){}}record('end',options.id);options.onEnd?.();if(was)queueMicrotask(next);}
 };pending.push(h);queueMicrotask(next);return h;
}
function stop(owner){for(const h of [...pending])if(!owner||h.options.owner===owner)h.stop();for(let i=pending.length-1;i>=0;i--)if(pending[i].cancelled)pending.splice(i,1);if(active&&(!owner||active.options.owner===owner))active.stop();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.HORVoiceQueue={enqueueBuffer,stop,inspect:()=>({active:active?.options.id||null,pending:pending.filter(h=>!h.cancelled).map(h=>h.options.id),log:log.slice()})};
})();

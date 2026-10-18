/* Shared nest-only reveal. Recorded crowd cue remains owned by playBirdNestReaction041. */
(()=>{'use strict';let atlas=null,active=null,last='',serial=0;const stats={starts:0,finishes:0,cancels:0};
const ready=new Promise(resolve=>{const im=new Image();im.onload=()=>{atlas=im;resolve(true)};im.onerror=()=>resolve(false);im.src='assets/nest-reveal838/bird-heads.png';});
const isBird=c=>!!c&&(isRookCard(c)||(includeRed2&&isRed2(c)));
function end(complete=false){const a=active;if(!a)return;active=null;cancelAnimationFrame(a.raf);clearTimeout(a.timer);a.canvas?.remove();a.el?.classList.remove('nest838-reveal','nest838-red');if(complete)stats.finishes++;else stats.cancels++;a.resolve();}
function reset(){end();last='';serial++;}
function reveal(face){if(!game||!revealTopNest||!isBird(face))return Promise.resolve();const key=String(serial)+':'+String(face.id);if(active?.key===key)return active.promise;if(last===key)return Promise.resolve();
 const el=document.querySelector('#nestArea .nest-stay-face,#nestArea .table-nest-front .card-face');if(!el||!el.getBoundingClientRect().width)return Promise.resolve();
 last=key;end();const reduced=reduceMotion||matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?650:950;let resolve;const promise=new Promise(r=>resolve=r);const a=active={key,el,resolve,promise,born:performance.now(),duration,raf:0,timer:0,g:game};stats.starts++;el.classList.add('nest838-reveal');el.classList.toggle('nest838-red',!isRookCard(face));el.style.setProperty('--nest838-duration',duration+'ms');
 // Same cue in portrait and landscape; its existing per-reveal guard prevents duplicates.
 try{playBirdNestReaction041()}catch{}
 if(atlas&&!reduced){const canvas=a.canvas=document.createElement('canvas');canvas.width=580;canvas.height=840;canvas.className='nest838-relief';canvas.setAttribute('aria-hidden','true');el.append(canvas);const ctx=canvas.getContext('2d'),red=!isRookCard(face),cell=atlas.width/2;
 const tick=now=>{if(active!==a)return;if(game!==a.g||!revealTopNest||!['dealing','bidding'].includes(game.phase)||document.hidden){end();return;}const p=Math.min(1,(now-a.born)/duration),lift=Math.sin(Math.PI*p),alpha=Math.min(1,p*6,(1-p)*6);ctx.clearRect(0,0,580,840);ctx.save();ctx.globalAlpha=Math.max(0,alpha)*.95;ctx.filter='drop-shadow(0px '+Math.round(12*lift)+'px '+Math.round(10*lift)+'px #0006)';ctx.drawImage(atlas,red?cell:0,0,cell,atlas.height,red?24:5,(red?110:65)-58*lift,red?532:570,red?630:755);ctx.restore();if(p<1)a.raf=requestAnimationFrame(tick);else end(true);};a.raf=requestAnimationFrame(tick);
 }
 a.timer=setTimeout(()=>end(true),duration+30);return promise;}
function sync(){if(active&&(!game||!['dealing','bidding'].includes(game.phase)||!revealTopNest))end();if(!game||!revealTopNest||!(game.nestFlipped||game.nestFlipStage>=2))return;const face=pinnedNestRevealFace();if(isBird(face))reveal(face);}
addEventListener('resize',()=>end());addEventListener('pagehide',()=>end());document.addEventListener('visibilitychange',()=>{if(document.hidden)end()});window.HORNestReveal838={ready,reveal,sync,reset,cancel:end,inspect:()=>({active:!!active,last,stats:{...stats}})};
})();

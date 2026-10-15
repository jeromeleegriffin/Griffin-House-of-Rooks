/* Extends the 772 readiness service; presentation only, no player-state writes. */
(()=>{'use strict';
const paths=["assets/images/RookPremium.png?v=632","assets/images/Red2Premium.png?v=632","assets/images/Rook.webp","assets/images/Red2-card.webp",
  "assets/cards/numbered/black-1.png",
  "assets/cards/numbered/black-10.png",
  "assets/cards/numbered/black-11.png",
  "assets/cards/numbered/black-12.png",
  "assets/cards/numbered/black-13.png",
  "assets/cards/numbered/black-14.png",
  "assets/cards/numbered/black-5.png",
  "assets/cards/numbered/black-6.png",
  "assets/cards/numbered/black-7.png",
  "assets/cards/numbered/black-8.png",
  "assets/cards/numbered/black-9.png",
  "assets/cards/numbered/green-1.png",
  "assets/cards/numbered/green-10.png",
  "assets/cards/numbered/green-11.png",
  "assets/cards/numbered/green-12.png",
  "assets/cards/numbered/green-13.png",
  "assets/cards/numbered/green-14.png",
  "assets/cards/numbered/green-5.png",
  "assets/cards/numbered/green-6.png",
  "assets/cards/numbered/green-7.png",
  "assets/cards/numbered/green-8.png",
  "assets/cards/numbered/green-9.png",
  "assets/cards/numbered/red-1.png",
  "assets/cards/numbered/red-10.png",
  "assets/cards/numbered/red-11.png",
  "assets/cards/numbered/red-12.png",
  "assets/cards/numbered/red-13.png",
  "assets/cards/numbered/red-14.png",
  "assets/cards/numbered/red-5.png",
  "assets/cards/numbered/red-6.png",
  "assets/cards/numbered/red-7.png",
  "assets/cards/numbered/red-8.png",
  "assets/cards/numbered/red-9.png",
  "assets/cards/numbered/yellow-1.png",
  "assets/cards/numbered/yellow-10.png",
  "assets/cards/numbered/yellow-11.png",
  "assets/cards/numbered/yellow-12.png",
  "assets/cards/numbered/yellow-13.png",
  "assets/cards/numbered/yellow-14.png",
  "assets/cards/numbered/yellow-5.png",
  "assets/cards/numbered/yellow-6.png",
  "assets/cards/numbered/yellow-7.png",
  "assets/cards/numbered/yellow-8.png",
  "assets/cards/numbered/yellow-9.png",
  "assets/images/RookPremium.png?v=rook036",
  "assets/images/Red2-card.webp?v=rook036",
  "assets/signature-shuffle/poster.png",
  "assets/signature-shuffle/sheet-00.webp",
  "assets/signature-shuffle/sheet-01.webp",
  "assets/signature-shuffle/sheet-02.webp",
  "assets/signature-shuffle/sheet-03.webp",
  "assets/signature-shuffle/sheet-04.webp",
  "assets/signature-shuffle/sheet-05.webp",
  "assets/signature-shuffle/sheet-06.webp",
  "assets/signature-shuffle/sheet-07.webp",
  "assets/signature-shuffle/sheet-08.webp",
  "assets/signature-shuffle/sheet-09.webp",
  "assets/signature-shuffle/sheet-10.webp",
  "assets/signature-shuffle/sheet-11.webp",
  "assets/signature-shuffle/sheet-12.webp",
  "assets/signature-shuffle/sheet-13.webp",
  "assets/table003/room-table-perspective.png",
  "assets/trump746/table-faint.png",
  "assets/approved805/ceiling-wood.png",
  "assets/house736/lantern-clipped.svg",
  "assets/house736/lantern-approved.png",
  "assets/cardholder/holder047.png",
  "assets/cardholder/backrest004.png",
  "assets/cardholder/bridge004.png",
  "assets/bidbox-approved/bidbox_complete_blank.png?v=712",
  "assets/images/griffin-icon.png",
  "assets/images/griffin-icon.png?v=631",
  "assets/trump714/case.png",
  "assets/trump714/lid-inner.png",
  "assets/trump714/lid-outer.png",
  "assets/trump714/stamp.png",
  "assets/trump714/confirm-brass.png",
  "assets/images/cardback-classic.jpg",
  "assets/images/cardback-signature.png",
  "assets/images/cardback-clash.jpg",
  "assets/images/cardback-raven.jpg",
  "assets/images/cardback-dive.jpg",
  "assets/images/cardback-felt.jpg",
  "assets/images/cardback-aftermath.jpg",
  "assets/images/cardback-griffin.jpg",
  "assets/images/cardback-griffin-approved-133.png",
  "assets/images/cardback-crimson.jpg",
  "assets/images/cardback-griffin-clean.jpg",
  "assets/images/cardback-midnight.jpg",
  "assets/images/cardback-aerial.jpg",
  "assets/images/cardback-faceoff.jpg"
];
const loaded=new Set(),pending=new Map();
let running=null,failed=[],busy=false,replay=false,booted=false,initialRevealComplete=false,fadeTimer=0,paintFrame=0;
const required=new Set(paths),wait=ms=>new Promise(r=>setTimeout(r,ms));
const panel=()=>document.getElementById('houseLoading');
function progress(){
 const done=[...required].filter(p=>loaded.has(p)).length,total=required.size;
 const percent=total?Math.floor(done/total*100):0,el=panel();
 if(el){el.querySelector('.hl-fill').style.transform=`scaleX(${percent/100})`;el.querySelector('.hl-track').setAttribute('aria-valuenow',percent);el.querySelector('#houseLoadingPercent').textContent=percent+'%';el.querySelector('.hl-info span').textContent=`Artwork ready: ${done} / ${total}`;}
 return {done,total,percent};
}
function show(){if(initialRevealComplete)return;clearTimeout(fadeTimer);const el=panel();if(!el)return;el.hidden=false;el.classList.remove('is-ready');document.documentElement.classList.add('house-loading');}
function notice(text,retry=false){const el=panel();if(!el)return;el.querySelector('.hl-note').textContent=text;el.querySelector('.hl-controls').hidden=!retry;}
function complete(){
 if(!booted||pending.size||[...required].some(p=>!loaded.has(p)))return;
 progress();notice('');initialRevealComplete=true;document.documentElement.classList.remove('house-loading');
 const el=panel();if(!el)return;
 el.classList.add('is-ready');
 fadeTimer=setTimeout(()=>{if([...required].every(p=>loaded.has(p)))el.hidden=true;},matchMedia('(prefers-reduced-motion:reduce)').matches?0:280);
}
function once(src){return new Promise((resolve,reject)=>{
 const img=new Image();let settled=false;
 const timer=setTimeout(()=>finish(false),15000);
 function finish(ok){if(settled)return;settled=true;clearTimeout(timer);img.onload=img.onerror=null;
  if(ok){loaded.add(src);progress();resolve(img);}else{img.removeAttribute('src');reject(Error('Image unavailable: '+src));}}
 img.onload=()=>{if(img.decode)img.decode().then(()=>finish(img.naturalWidth>0),()=>finish(false));else finish(img.naturalWidth>0);};
 img.onerror=()=>finish(false);img.src=src;
});}
function image(src){
 if(loaded.has(src)){const img=new Image();img.src=src;return img.decode().then(()=>img).catch(()=>{loaded.delete(src);if(required.has(src))show();return image(src);});}if(pending.has(src))return pending.get(src);
 const job=(async()=>{for(let n=0;n<3;n++){try{return await once(src);}catch(e){if(n===2)throw e;await wait(400*(n+1));}}})().finally(()=>{pending.delete(src);complete();});
 pending.set(src,job);return job;
}
function requireImages(sources){
 let added=false;for(const src of sources){if(!src||/^(data:|#)/.test(src))continue;if(!required.has(src)){required.add(src);added=true;}}
 if([...required].some(p=>!loaded.has(p)))show();
 if(added&&booted)prepare().catch(()=>{});
 return Promise.all(sources.filter(Boolean).map(image));
}
function visibleSources(){
 const result=[];
 for(const el of document.querySelectorAll('#landingScene783 image,#friendsScene803 image,#characters077 image,#app img')){
  if(!el.getClientRects().length||getComputedStyle(el).display==='none')continue;
  const src=el.getAttribute('href')||el.getAttribute('src');if(src&&!src.startsWith('data:'))result.push(src);
 }
 if(document.documentElement.classList.contains('hor-original-cards'))result.push('assets/images/Rook.png','assets/images/Red2.png?v=632');
 return result;
}
function prepare(){
 if(running)return running;busy=true;show();notice('');failed=[];
 running=(async()=>{
  // The set can grow when the existing renderers select their actual seated cast.
  const attempted=new Set();
  while(true){const queue=[...required].filter(p=>!loaded.has(p)&&!attempted.has(p));if(!queue.length)break;let next=0;
   await Promise.all(Array.from({length:4},async()=>{while(next<queue.length){const src=queue[next++];attempted.add(src);try{await image(src);}catch(_){failed.push(src);}}}));
  }
  if(failed.length){notice('Some artwork could not load. Check your connection, then retry.',true);throw Error('Essential artwork unavailable');}
  return true;
 })().finally(()=>{running=null;busy=false;complete();});return running;
}
// Preserve the existing offline entry capture gate and resume its original handler once.
document.addEventListener('click',async e=>{
 const el=e.target.closest?.('#soloPracticeBtn');if(!el||replay||[...required].every(p=>loaded.has(p)))return;
 e.preventDefault();e.stopImmediatePropagation();if(busy)return;
 try{await prepare();replay=true;try{el.click();}finally{replay=false;}}catch(_){}
},true);
// Never substitute a different bird or discard its image node after a failure.
document.addEventListener('error',e=>{
 const img=e.target;if(!(img instanceof HTMLImageElement)||!img.matches('.numbered-card-img,.rook-bird-img,.red2-img'))return;
 const n=Number(img.dataset.loadRetry772||0);if(n>=2)return;img.dataset.loadRetry772=String(n+1);
 const src=img.getAttribute('src');setTimeout(()=>{if(img.isConnected&&src)img.src=src;},500*(n+1));
},true);
window.HORAssetLoading772={image,prepare,requireImages,hasDecoded:src=>loaded.has(src),inspect:()=>({...progress(),initialRevealComplete,loaded:progress().done,total:required.size,busy,failed:failed.slice(),pending:pending.size,paths:[...required]})};
function retry(){failed=[];prepare().catch(()=>{});document.dispatchEvent(new Event('hor-artwork-retry'));}
function boot(){
 booted=true;for(const src of visibleSources())required.add(src);
 panel()?.querySelector('#houseLoadingRetry').addEventListener('click',retry);
 // Observe only image source changes / scene additions, not progress DOM or animation frames.
 new MutationObserver(records=>{
  if(!records.some(r=>r.type==='attributes'||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('img,image,svg')||n.querySelector?.('img,image')))))return;
  if(!paintFrame)paintFrame=requestAnimationFrame(()=>{paintFrame=0;const sources=visibleSources();const fresh=sources.filter(p=>!required.has(p));if(fresh.length)requireImages(fresh).catch(()=>{});});
 }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href']});
 prepare().catch(()=>{});
}
addEventListener('online',()=>{if(failed.length)retry();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(boot),{once:true});else requestAnimationFrame(boot);
})();

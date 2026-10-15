/* Character Studio077 / build769. Identity follows players; pose follows view-relative seat.
   No rules, teams, turn, dealing, hand or room-state writes. See HANDOFF/BUILD_767. */
(()=>{'use strict';
const NS='http://www.w3.org/2000/svg',W=875,H=1797;
const characters=Object.freeze({
...window.HORHumanAvatars,
jerome_founder:{name:"Jerome",design:"Owner-approved founder",voice:"jerome",availability:"public-human-and-bot",poses:{left:"jerome_founder-left.webp",top:"jerome_founder-top.webp",right:"jerome_founder-right.webp"}},
"nettle":{"name": "Nettle", "design": "Elder-nettle", "voice": "female", "poses": {"left": "nettle-left.webp", "top": "nettle-top.webp", "right": "nettle-right.webp"}},
"ash":{"name": "Ash", "design": "Elder-ash", "voice": "female", "poses": {"left": "ash-left.webp", "top": "ash-top.webp", "right": "ash-right.webp"}},
"cobalt":{"name": "Cobalt", "design": "Elder-cobalt", "voice": "male", "poses": {"left": "cobalt-left.webp", "top": "cobalt-top.webp", "right": "cobalt-right.webp"}},
"harrier":{"name": "Harrier", "design": "Elder-harrier", "voice": "male", "poses": {"left": "harrier-left.webp", "top": "harrier-top.webp", "right": "harrier-right.webp"}},
"blaze":{"name": "Blaze", "design": "W1", "voice": "female", "poses": {"left": "blaze-left.webp", "top": "blaze-top.webp", "right": "blaze-right.webp"}},
"nix":{"name": "Nix", "design": "W2", "voice": "female", "poses": {"left": "nix-left.webp", "top": "nix-top.webp", "right": "nix-right.webp"}},
"anchor":{"name": "Anchor", "design": "W3", "voice": "female", "poses": {"left": "anchor-left.webp", "top": "anchor-top.webp", "right": "anchor-right.webp"}},
"wager":{"name": "Wager", "design": "W4", "voice": "female", "poses": {"left": "wager-left.webp", "top": "wager-top.webp", "right": "wager-right.webp"}},
"ember":{"name": "Ember", "design": "W5", "voice": "female", "poses": {"left": "ember-left.webp", "top": "ember-top.webp", "right": "ember-right.webp"}},
"titan":{"name": "Titan", "design": "M1", "voice": "male", "poses": {"left": "titan-left.webp", "top": "titan-top.webp", "right": "titan-right.webp"}},
"pike":{"name": "Pike", "design": "M2", "voice": "male", "poses": {"left": "pike-left.webp", "top": "pike-top.webp", "right": "pike-right.webp"}},
"drift":{"name": "Drift", "design": "M3", "voice": "male", "poses": {"left": "drift-left.webp", "top": "drift-top.webp", "right": "drift-right.webp"}},
"dice":{"name": "Dice", "design": "M4", "voice": "male", "poses": {"left": "dice-left.webp", "top": "dice-top.webp", "right": "dice-right.webp"}},
"hollow":{"name": "Hollow", "design": "M5", "voice": "male", "poses": {"left": "hollow-left.webp", "top": "hollow-top.webp", "right": "hollow-right.webp"}},
"vex":{"name": "Vex", "design": "YW1", "voice": "female", "poses": {"left": "vex-left.webp", "top": "vex-top.webp", "right": "vex-right.webp"}},
"bramble":{"name": "Bramble", "design": "YW2", "voice": "female", "poses": {"left": "bramble-left.webp", "top": "bramble-top.webp", "right": "bramble-right.webp"}},
"emberlyn":{"name": "Emberlyn", "design": "YW3", "voice": "female", "poses": {"left": "emberlyn-left.webp", "top": "emberlyn-top.webp", "right": "emberlyn-right.webp"}},
"frost":{"name": "Frost", "design": "YM1", "voice": "male", "poses": {"left": "frost-left.webp", "top": "frost-top.webp", "right": "frost-right.webp"}},
"fang":{"name": "Fang", "design": "YM2", "voice": "male", "poses": {"left": "fang-left.webp", "top": "fang-top.webp", "right": "fang-right.webp"}},
"halo":{"name": "Halo", "design": "YM3", "voice": "male", "poses": {"left": "halo-left.webp", "top": "halo-top.webp", "right": "halo-right.webp"}},
"thistle":{"name": "Thistle", "design": "AW1", "voice": "female", "poses": {"left": "thistle-left.webp", "top": "thistle-top.webp", "right": "thistle-right.webp"}},
"pebble":{"name": "Pebble", "design": "AW2", "voice": "female", "poses": {"left": "pebble-left.webp", "top": "pebble-top.webp", "right": "pebble-right.webp"}},
"rookery":{"name": "Rookery", "design": "AW3", "voice": "female", "poses": {"left": "rookery-left.webp", "top": "rookery-top.webp", "right": "rookery-right.webp"}},
"sable":{"name": "Sable", "design": "AW4", "voice": "female", "poses": {"left": "sable-left.webp", "top": "sable-top.webp", "right": "sable-right.webp"}},
"willow":{"name": "Willow", "design": "AW5", "voice": "female", "poses": {"left": "willow-left.webp", "top": "willow-top.webp", "right": "willow-right.webp"}},
"quill":{"name": "Quill", "design": "AM1", "voice": "male", "poses": {"left": "quill-left.webp", "top": "quill-top.webp", "right": "quill-right.webp"}},
"moss":{"name": "Moss", "design": "AM2", "voice": "male", "poses": {"left": "moss-left.webp", "top": "moss-top.webp", "right": "moss-right.webp"}},
"gable":{"name": "Gable", "design": "AM3", "voice": "male", "poses": {"left": "gable-left.webp", "top": "gable-top.webp", "right": "gable-right.webp"}},
"marrow":{"name": "Marrow", "design": "AM4", "voice": "male", "poses": {"left": "marrow-left.webp", "top": "marrow-top.webp", "right": "marrow-right.webp"}},
"finch":{"name": "Finch", "design": "AM5", "voice": "male", "poses": {"left": "finch-left.webp", "top": "finch-top.webp", "right": "finch-right.webp"}},
"moth":{"name": "Moth", "design": "EW1", "voice": "female", "poses": {"left": "moth-left.webp", "top": "moth-top.webp", "right": "moth-right.webp"}},
"brandy":{"name": "Brandy", "design": "EW2", "voice": "female", "poses": {"left": "brandy-left.webp", "top": "brandy-top.webp", "right": "brandy-right.webp"}},
"ivy":{"name": "Ivy", "design": "EW3", "voice": "female", "poses": {"left": "ivy-left.webp", "top": "ivy-top.webp", "right": "ivy-right.webp"}},
"shade":{"name": "Shade", "design": "EW4", "voice": "female", "poses": {"left": "shade-left.webp", "top": "shade-top.webp", "right": "shade-right.webp"}},
"spark":{"name": "Spark", "design": "EW5", "voice": "female", "poses": {"left": "spark-left.webp", "top": "spark-top.webp", "right": "spark-right.webp"}},
"hearth":{"name": "Hearth", "design": "EM1", "voice": "male", "poses": {"left": "hearth-left.webp", "top": "hearth-top.webp", "right": "hearth-right.webp"}},
"grit":{"name": "Grit", "design": "EM2", "voice": "male", "poses": {"left": "grit-left.webp", "top": "grit-top.webp", "right": "grit-right.webp"}},
"copper":{"name": "Copper", "design": "EM3", "voice": "male", "poses": {"left": "copper-left.webp", "top": "copper-top.webp", "right": "copper-right.webp"}},
"flint":{"name": "Flint", "design": "EM4", "voice": "male", "poses": {"left": "flint-left.webp", "top": "flint-top.webp", "right": "flint-right.webp"}},
"barrel":{"name": "Barrel", "design": "EM5", "voice": "male", "poses": {"left": "barrel-left.webp", "top": "barrel-top.webp", "right": "barrel-right.webp"}},
sofia:{"name": "Sofia", "design": "Sofia05", "voice": "female", "poses": {"left": "sofia-left.png", "top": "sofia-top.png", "right": "sofia-right.png"}},
rafael:{"name": "Rafael", "design": "Rafael11", "voice": "male", "poses": {"left": "rafael-left.png", "top": "rafael-top.png", "right": "rafael-right.png"}},
samir:{"name": "Samir", "design": "Samir12", "voice": "male", "poses": {"left": "samir-left.png", "top": "samir-top.png", "right": "samir-right.png"}},

claire:{"name": "Claire", "design": "Claire03", "voice": "female", "poses": {"left": "claire-left.png", "top": "claire-top.png", "right": "claire-right.png"}},
june:{"name": "June", "design": "June04", "voice": "female", "poses": {"left": "june-left.png", "top": "june-top.png", "right": "june-right.png"}},
tess:{"name": "Tess", "design": "Tess06", "voice": "female", "poses": {"left": "tess-left.png", "top": "tess-top.png", "right": "tess-right.png"}},
marcus:{"name": "Marcus", "design": "Marcus08", "voice": "male", "poses": {"left": "marcus-left.png", "top": "marcus-top.png", "right": "marcus-right.png"}},
owen:{"name": "Owen", "design": "Owen09", "voice": "male", "poses": {"left": "owen-left.png", "top": "owen-top.png", "right": "owen-right.png"}},
daniel:{"name": "Daniel", "design": "Daniel10", "voice": "male", "poses": {"left": "daniel-left.png", "top": "daniel-top.png", "right": "daniel-right.png"}},

 dagger:{name:'Dagger',design:'Adrian07',voice:'male',poses:{left:'dagger-left.png',top:'dagger-top.png',right:'dagger-right.png'}},
 cinder:{name:'Cinder',design:'Elena02',voice:'female',poses:{left:'cinder-left.png',top:'cinder-top.png',right:'cinder-right.png'}},
 crow:{name:'Crow',design:'Maya01',voice:'female',poses:{left:'crow-left.png',top:'crow-top.png',right:'crow-right.png'},foreground:{right:'crow-right-arm.png'}}
});
// Hard OUTER rail boundary traced from unchanged875x1797 TABLE-003 pixels.
const outside='M0 0H875V797L628 592Q590 563 534 561Q436 554 336 563Q298 565 254 594L0 799Z';
// Far-seat rail contact: extend the far-body mask to the visible outer wood edge.
// Side masks and all artwork/seat positions remain unchanged.
const farOutside='M0 0H875V797L628 592Q590 571 534 569Q436 562 336 571Q298 573 254 594L0 799Z';
const seats=[
 {slot:'slot-left',pose:'left',offset:1,x:-44.53,y:362.91,w:345.10,label:[110,711],status:[110,357]},
 {slot:'slot-partner',pose:'top',offset:2,x:309.48,y:300.57,w:256.04,label:[437,531],status:[437,289]},
 {slot:'slot-right',pose:'right',offset:3,x:610.05,y:376.27,w:322.84,label:[781,717],status:[781,370]}
];
let root,svg,labels,frame=0,ready=true,enabled=new URLSearchParams(location.search).get('characters')!=='legacy';
const portrait=()=>matchMedia('(orientation:portrait)').matches;
function geom(){const r=document.getElementById('hor-room-bg')?.getBoundingClientRect()||{left:0,top:0,width:innerWidth,height:innerHeight};const s=Math.max(r.width/W,r.height/H);return{s,x:r.left+(r.width-W*s)/2,y:r.top};}
function occupant(seat){if(!enabled||!ready||!portrait()||!document.body.classList.contains('in-game')||typeof game==='undefined'||!game)return null;const base=myIndex>=0?myIndex:0,index=(base+seat.offset)%4,p=game.players?.[index];if(!p)return null;const avatar=(typeof playerAvatars!=='undefined'&&playerAvatars[p.id])||p.avatar||((typeof AVATARS!=='undefined')?AVATARS[index%AVATARS.length]:'');const key=String(avatar).toLowerCase();const c=characters[key];if(!c)return null;const needed=[c.poses[seat.pose],c.foreground?.[seat.pose]].filter(Boolean);needed.forEach(loadPose);return needed.every(path=>poseReady.has(path))?{key,index,id:p.id,name:p.name||c.name,character:c}:null;}
function make(){root=document.createElement('div');root.id='characters077';root.setAttribute('aria-hidden','true');root.innerHTML=`<svg xmlns="${NS}" width="875" height="1797" viewBox="0 0 875 1797"><defs><clipPath id="cs077-outside"><path d="${outside}"/></clipPath><clipPath id="cs077-far-outside"><path d="${farOutside}"/></clipPath><clipPath id="cs077-cobalt-crop"><rect x="294" y="0" width="289" height="1797"/></clipPath><clipPath id="cs077-cobalt-top"><path d="${farOutside}" clip-path="url(#cs077-cobalt-crop)"/></clipPath></defs><g>${seats.map(s=>`<image clip-path="url(#${s.pose==='top'?'cs077-far-outside':'cs077-outside'})" data-seat="${s.pose}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.w*1.5}"/>`).join('')}</g><g>${seats.map(s=>`<image data-foreground="${s.pose}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.w*1.5}"/>`).join('')}</g></svg>`;(document.getElementById('hor-room-bg')||document.body).appendChild(root);svg=root.querySelector('svg');labels=document.createElement('div');labels.id='characterLabels077';for(const s of seats){const e=document.createElement('div');e.className='cs077-label name';e.dataset.seat=s.slot;labels.appendChild(e);}document.body.appendChild(labels);}
function releasePosition(el){if(el&&el.__cs077PriorStyle!==undefined){el.style.cssText=el.__cs077PriorStyle;delete el.__cs077PriorStyle;}}
function placePill(el,slot,cx,bottom,fit=false){
 if(el.__cs077PriorStyle===undefined)el.__cs077PriorStyle=el.style.cssText;
 if(el.parentNode!==slot)slot.appendChild(el);
 el.style.cssText='position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;transform:none!important;translate:none!important;scale:1!important;margin:0!important;pointer-events:none!important;z-index:300!important;';
 const r=el.getBoundingClientRect(),sx=r.width/Math.max(1,el.offsetWidth),sy=r.height/Math.max(1,el.offsetHeight);
 if(fit)cx=Math.max(r.width/2+6,Math.min(innerWidth-r.width/2-6,cx));
 // Tablet scene extends beyond the 520px app; keep status text inside its hard clip.
 if(innerWidth>428){const a=document.getElementById('app')?.getBoundingClientRect();if(a&&a.width)cx=Math.max(a.left+r.width/2+6,Math.min(a.right-r.width/2-6,cx));}
 el.style.setProperty('translate',`${(cx-r.left-r.width/2)/Math.max(.01,sx)}px ${(bottom-r.top-r.height)/Math.max(.01,sy)}px`,'important');
}
function positionLead(el){
 const slot=el?.parentElement,s=seats.find(s=>s.slot===slot?.id);
 if(!s||!occupant(s)){releasePosition(el);return false;}
 const copy=labels?.querySelector(`[data-seat="${s.slot}"] .cs077-lead793`);
 if(copy)copy.style.visibility=el.classList.contains('hidden')?'hidden':'visible';
 return true;
}
function positionStatus(el,index){
 if(!el||el.dataset.humanTurn==='1'||!portrait()){releasePosition(el);return false;}
 // Auction owner supplies explicit actors. Outside auction, follow the live turn/bidder,
 // never the shared pill's previous parent (the767 regression).
 let actor=index;
 if(!Number.isInteger(actor)&&typeof game!=='undefined'&&game){
  actor=game.phase==='bidding'&&el.hasAttribute('data-auction-player')?Number(el.dataset.auctionPlayer):
   (game.phase==='discard'||game.phase==='trump'?game.bidder:game.currentPlayer);
 }
 const sid=Number.isInteger(actor)&&typeof seatSlotIdForIndex==='function'?seatSlotIdForIndex(actor):null,s=seats.find(s=>s.slot===sid);
 if(!s||!occupant(s)){releasePosition(el);return false;}
 const g=geom(),slot=document.getElementById(s.slot);
 const row=labels?.querySelector(`[data-seat="${s.slot}"]`)?.getBoundingClientRect();
 // Fixed status bottom for this seat. Never move with a phase, LEAD or message length.
 placePill(el,slot,row?.width?row.left+row.width/2:g.x+s.status[0]*g.s,g.y+s.status[1]*g.s,true);
 return true;
}

function imageState(el,path){if(path){const href='assets/characters077/'+path;if(el.getAttribute('href')!==href)el.setAttribute('href',href);el.style.display='';}else{el.style.display='none';el.removeAttribute('href');}}
function sync(){frame=0;if(!root)make();const bg=document.getElementById('hor-room-bg');if(bg&&root.parentElement!==bg)bg.appendChild(root);const g=geom();svg.style.cssText=`left:${g.x}px;top:${g.y}px;transform:scale(${g.s});`;if(document.body.classList.contains('cs077-ready')!==(enabled&&ready))document.body.classList.toggle('cs077-ready',enabled&&ready);for(const s of seats){const o=occupant(s),slot=document.getElementById(s.slot);slot?.classList.toggle('cs077-seat',!!o);const body=root.querySelector(`[data-seat="${s.pose}"]`);
// Cobalt's source includes his lap; use a torso-sized framing behind the existing rail.
// Reset on every occupant change so no other character inherits this adjustment.
const bodyClip=o?.key==='cobalt'&&s.pose==='top'?'cs077-cobalt-top':(s.pose==='top'?'cs077-far-outside':'cs077-outside');
if(body.getAttribute('clip-path')!==`url(#${bodyClip})`)body.setAttribute('clip-path',`url(#${bodyClip})`);
// 793: enlarge only Jerome 8%, anchored at his original rail contact. Same hard clip.
const placement=o?.key==='cobalt'&&s.pose==='top'?{x:272.5,y:295,w:330}:
 o?.key==='jerome_founder'?{x:s.x-s.w*.04,y:s.label[1]+(s.y-s.label[1])*1.08,w:s.w*1.08}:s;
for(const [attr,value] of Object.entries({x:placement.x,y:placement.y,width:placement.w,height:placement.w*1.5}))if(body.getAttribute(attr)!==String(value))body.setAttribute(attr,value);
imageState(body,o?.character.poses[s.pose]);imageState(root.querySelector(`[data-foreground="${s.pose}"]`),o?.character.foreground?.[s.pose]);const label=labels.querySelector(`[data-seat="${s.slot}"]`);label.style.display=o?'':'none';if(o){const original=slot.querySelector('.seat-identity-copy');
if(!label.querySelector('.cs077-identity793'))label.innerHTML='<span class="cs077-identity793"></span><span class="cs077-lead793" style="visibility:hidden">LEAD</span>';
const identity=label.querySelector('.cs077-identity793');
if(original&&identity.innerHTML!==original.innerHTML){identity.innerHTML=original.innerHTML;try{horBindCareerBadges(label);}catch(_){}}
label.dataset.botname=slot.querySelector('.name')?.dataset.botname||'';
const bounds=document.getElementById('app')?.getBoundingClientRect(),left=bounds?.width?Math.max(0,bounds.left):0,right=bounds?.width?Math.min(innerWidth,bounds.right):innerWidth;
const width=label.getBoundingClientRect().width;
label.style.left=Math.max(left+width/2+6,Math.min(right-width/2-6,g.x+s.status[0]*g.s))+'px';
label.style.top=(g.y+s.status[1]*g.s-22-label.getBoundingClientRect().height)+'px';positionLead(slot.querySelector(':scope > .seat-lead-tag'));for(const el of slot.querySelectorAll(':scope>.auction-status,:scope>#botThinking'))positionStatus(el);}}try{positionSeatLeadTags();const pill=document.getElementById('botThinking');if(pill&&!pill.classList.contains('hidden'))positionBotThinkingAtSeat();}catch(_){} }
const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
// Narrow default offline cast pool only: original random selection, empty-seat assignment,
// explicit persona picks and saved favorite-partner priority remain in addBot().
function castPool(pool){if(!enabled)return pool;const selected=pool.filter(p=>characters[p.avatar]);return selected.length?selected:pool;}
function setEnabled(value){enabled=!!value;sync();}
window.HORCharacterStudio077={characters,castPool,sync,positionStatus,positionLead,setEnabled,inspect:()=>({enabled,ready,portrait:portrait(),geometry:geom(),seats:seats.map(s=>({...s,active:!!occupant(s),occupant:occupant(s)})),outside})};
// Load only the artwork needed by visible seats. Keep the legacy portrait until decoded.
const poseReady=new Set(),posePending=new Map(),poseFailed=new Map();
function loadPose(path){if(window.HORAssetLoading772.hasDecoded('assets/characters077/'+path)){poseReady.add(path);return;}if(poseReady.has(path)||posePending.has(path)||Date.now()-(poseFailed.get(path)||0)<30000)return;const job=window.HORAssetLoading772.requireImages(['assets/characters077/'+path]).then(()=>{poseReady.add(path);poseFailed.delete(path);}).catch(()=>{poseFailed.set(path,Date.now());}).finally(()=>{posePending.delete(path);schedule();});posePending.set(path,job);}
function retryPoses(){poseFailed.clear();schedule();}
document.addEventListener('hor-artwork-retry',retryPoses);addEventListener('online',retryPoses);document.addEventListener('click',retryPoses);document.addEventListener('visibilitychange',()=>{if(!document.hidden)retryPoses()});
schedule();
addEventListener('resize',schedule);addEventListener('orientationchange',schedule);document.addEventListener('visibilitychange',schedule);new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
})();

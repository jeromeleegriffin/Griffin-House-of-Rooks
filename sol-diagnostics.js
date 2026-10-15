/* Rook596 — SOL diagnostics v3: explicit recording + Deep UI Trace / Tap to Identify.
   Diagnostics only. Does not alter rules, AI choices, scoring, card order, or game timing. */
(function(){
'use strict';
const SPEEDS=[1,2,3,4]; let speed=1,seq=0,recording=false,recordStarted=0,identifyArmed=false;
const started=Date.now(),log=[];
const watched=['slot-me','slot-left','slot-partner','slot-right','seatStatusPill','botThinking','actionPanel','ltTrumpBar','trumpStamp','topNestPeek','bidProgress','winOverlay','bigTrickOverlay','captureOverlay','trickArea','hand','feltBidDock','topBar','hostOptionsModal','btnSolFast'];
const importantRe=/bid|think|trump|win|trick|nest|moon|score|menu|modal|overlay|badge|status/i;
function dev(){try{return typeof window.horDeveloperToolsEnabled==='function'&&window.horDeveloperToolsEnabled();}catch(e){return false;}}
function css(el,pseudo){try{const c=getComputedStyle(el,pseudo||null);return {display:c.display,visibility:c.visibility,opacity:c.opacity,position:c.position,left:c.left,top:c.top,right:c.right,bottom:c.bottom,width:c.width,height:c.height,transform:c.transform,transformOrigin:c.transformOrigin,zIndex:c.zIndex,overflow:c.overflow,overflowX:c.overflowX,overflowY:c.overflowY,clipPath:c.clipPath,content:c.content,background:c.background,border:c.border,boxShadow:c.boxShadow,pointerEvents:c.pointerEvents};}catch(e){return {error:String(e)}}}
function rect(el){if(!el)return null;const r=el.getBoundingClientRect();return{id:el.id||'',tag:el.tagName||'',cls:String(el.className||''),x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),text:String(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,140),style:css(el)};}
function pseudo(el){return{before:css(el,'::before'),after:css(el,'::after')}}
function ancestors(el){const out=[];let n=el,i=0;while(n&&n.nodeType===1&&i++<18){out.push({...rect(n),pseudo:pseudo(n)});n=n.parentElement;}return out;}
function selector(el){if(!el||el.nodeType!==1)return'';if(el.id)return'#'+CSS.escape(el.id);let s=el.tagName.toLowerCase();if(el.classList.length)s+='.'+[...el.classList].slice(0,4).map(x=>CSS.escape(x)).join('.');return s;}
function matchedRules(el){const out=[];for(const sh of [...document.styleSheets]){let rules;try{rules=sh.cssRules}catch(e){out.push({sheet:sh.href||'inline',blocked:true});continue}if(!rules)continue;walk(rules,sh.href||'inline');}function walk(rules,sheet){for(const r of [...rules]){if(r.cssRules){walk(r.cssRules,sheet);continue}if(!r.selectorText)continue;try{if(el.matches(r.selectorText))out.push({sheet,selector:r.selectorText,css:r.style.cssText.slice(0,900)});}catch(e){}}}return out.slice(-80);}
function stackContexts(el){return ancestors(el).filter(x=>{const s=x.style;return s.position!=='static'&&s.zIndex!=='auto'||s.transform!=='none'||+s.opacity<1||s.clipPath!=='none';});}
function fingerprint(){const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};return{scripts:[...document.scripts].map(x=>({src:x.src||'inline',hash:x.src?'external':fnv(x.textContent||'')})),styles:[...document.querySelectorAll('link[rel=stylesheet],style')].map(x=>({src:x.href||'inline',id:x.id||'',hash:x.tagName==='STYLE'?fnv(x.textContent||''):'external'}))};}
function duplicateIds(){const m={};document.querySelectorAll('[id]').forEach(e=>(m[e.id]||(m[e.id]=[])).push(selector(e)));return Object.fromEntries(Object.entries(m).filter(([,v])=>v.length>1));}
function legacy(){const sels=['#seatStatusPill','#botThinking','#ltTrumpBar','.seat-bid-badge','.bid-badge','#actionPanel.trump-showdown'];const o={};sels.forEach(s=>o[s]=[...document.querySelectorAll(s)].map(rect));return o;}
function gameState(){try{return typeof window.horSolDiagnosticState==='function'?window.horSolDiagnosticState():null}catch(e){return null}}
function deepElement(el){return{element:rect(el),pseudo:pseudo(el),ancestors:ancestors(el),stacking:stackContexts(el),matchedRules:matchedRules(el),outerHTML:String(el.outerHTML||'').slice(0,3000)};}
function snap(kind,detail,force){if(!dev())return;if(!force&&!recording&&!['record-start','export','error','unhandled-rejection','identify'].includes(kind))return;const els={};watched.forEach(id=>{const e=document.getElementById(id);if(e)els[id]=rect(e)});document.querySelectorAll('.seat-bid-badge,.bid-badge,.bot-thinking,.seat-status-pill,.moon-approved-overlay,.trump-spinup-approved').forEach((e,i)=>els[(e.id||e.className||'node')+'#'+i]=rect(e));log.push({seq:++seq,t:+((Date.now()-started)/1000).toFixed(3),kind,detail:detail||null,build:String(window.HOR_PAGE_BUILD||window.HOR_LIVE_VERSION||'?'),speed:window.HOR_SOL_SPEED||1,viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio,orientation:innerWidth>innerHeight?'landscape':'portrait'},state:gameState(),elements:els,duplicates:duplicateIds()});if(log.length>4000)log.splice(0,300);paintRecord();}
window.HOR_SOL_SPEED=1;window.horSolDiagCapture=snap;
function paintSpeed(){const b=document.getElementById('btnSolFast');if(!b)return;b.textContent=speed===1?'SOL NORMAL':'SOL '+speed+'×';b.dataset.speed=String(speed);}
function cycle(){speed=SPEEDS[(SPEEDS.indexOf(speed)+1)%SPEEDS.length];window.HOR_SOL_SPEED=speed;paintSpeed();snap('speed-change',{speed});}
function paintRecord(){const a=document.getElementById('btnSolDiagRecord'),b=document.getElementById('btnSolDiagStop'),st=document.getElementById('solDiagState'),id=document.getElementById('btnSolDiagIdentify');if(a)a.classList.toggle('hidden',recording);if(b)b.classList.toggle('hidden',!recording);if(st){st.textContent=identifyArmed?'◎ IDENTIFY ARMED — tap the mystery object':recording?'● RECORDING — '+log.length+' events':'Not recording';st.classList.toggle('recording',recording||identifyArmed)}if(id){id.classList.toggle('is-recording',identifyArmed);id.textContent=identifyArmed?'◎ TAP OBJECT NOW':'◎ IDENTIFY UI OBJECT';}}
function startRecord(){log.length=0;seq=0;recording=true;recordStarted=Date.now();snap('record-start',{fingerprint:fingerprint(),legacy:legacy()},true);}
function payload(){return{format:'Griffin House SOL diagnostics v3 / Deep UI Trace',build:String(window.HOR_PAGE_BUILD||'?'),started:new Date(recordStarted||started).toISOString(),exported:new Date().toISOString(),fingerprint:fingerprint(),duplicates:duplicateIds(),legacy:legacy(),note:'Game DOM/state diagnostic capture only. No other apps, tabs, notifications, passwords, or phone screen are captured.',events:log};}
function exportLog(){
  if(recording)snap('record-stop',null,true);
  recording=false;identifyArmed=false;paintRecord();
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const filename='GRIFFIN_HOUSE_DIAGNOSTICS_BUILD_'+String(window.HOR_PAGE_BUILD||'unknown')+'_'+stamp+'.json';
  const blob=new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;
  document.body.appendChild(a);a.click();
  let note=document.getElementById('solDiagExportNotice');
  if(!note){note=document.createElement('div');note.id='solDiagExportNotice';document.body.appendChild(note);}
  note.textContent='DIAGNOSTICS EXPORTED: '+filename;note.classList.add('show');
  setTimeout(()=>note.classList.remove('show'),6500);
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
}
function armIdentify(){identifyArmed=!identifyArmed;paintRecord();}
function identifyAt(e){if(!identifyArmed)return; e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const x=e.clientX,y=e.clientY,stack=document.elementsFromPoint(x,y);const detail={point:{x,y},stack:stack.slice(0,14).map(deepElement),fingerprint:fingerprint(),duplicates:duplicateIds(),legacy:legacy()};identifyArmed=false;snap('identify',detail,true);paintRecord();}
function ensureEmergency(){if(document.getElementById('solDiagEmergency'))return;const b=document.createElement('button');b.id='solDiagEmergency';b.type='button';b.textContent='DIAG';b.title='Emergency diagnostics';const p=document.createElement('div');p.id='solDiagEmergencyPanel';p.className='hidden';p.innerHTML='<button data-d=\"record\">● RECORD</button><button data-d=\"identify\">◎ IDENTIFY</button><button data-d=\"export\">EXPORT</button>';document.body.append(b,p);b.onclick=e=>{e.preventDefault();p.classList.toggle('hidden')};p.addEventListener('click',e=>{const k=e.target&&e.target.dataset&&e.target.dataset.d;if(k==='record')startRecord();if(k==='identify')armIdentify();if(k==='export')exportLog();p.classList.add('hidden')});}
function init(){ensureEmergency();const b=document.getElementById('btnSolFast');if(b){b.addEventListener('click',cycle);paintSpeed()}const sb=document.getElementById('btnSolBot');if(sb){sb.addEventListener('click',()=>{if(typeof window.horToggleSolBot==='function')window.horToggleSolBot()});if(typeof window.horSolBotPaint==='function')window.horSolBotPaint()}document.getElementById('btnSolDiagRecord')?.addEventListener('click',startRecord);document.getElementById('btnSolDiagStop')?.addEventListener('click',exportLog);document.getElementById('btnSolDiagExport')?.addEventListener('click',exportLog);document.getElementById('btnSolDiagIdentify')?.addEventListener('click',armIdentify);paintRecord();if(!dev())return;setInterval(()=>snap('heartbeat',{fingerprint:fingerprint()}),2000);const root=document.body;const mo=new MutationObserver(ms=>{const rows=[];for(const m of ms){const t=m.target;if(!t||t.nodeType!==1)continue;if(importantRe.test(t.id||'')||importantRe.test(String(t.className||''))){rows.push({type:m.type,target:selector(t),attribute:m.attributeName||'',oldValue:m.oldValue||null,newValue:m.attributeName?t.getAttribute(m.attributeName):null,added:[...m.addedNodes||[]].filter(n=>n.nodeType===1).map(n=>String(n.outerHTML||'').slice(0,800)),removed:[...m.removedNodes||[]].filter(n=>n.nodeType===1).map(n=>String(n.outerHTML||'').slice(0,800))});}}if(rows.length)snap('ui-mutation',{mutations:rows.slice(0,30)});});mo.observe(root,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style','hidden']});document.addEventListener('pointerdown',identifyAt,true);window.addEventListener('error',e=>snap('error',{message:e.message||'unknown',file:e.filename||'',line:e.lineno||0},true));window.addEventListener('unhandledrejection',e=>snap('unhandled-rejection',{reason:String(e.reason||'unknown')},true));}
window.HORSolDiagnostics={snap,exportLog,startRecord,armIdentify,isRecording:()=>recording};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* ===== ROOK611 COMPACT LAYOUT TOOL — CLEAN REBUILD ===== */
(function(){
'use strict';
const ID='ghCompact611', OUT='ghCompactOutline611';
let selected=null,pick=false,mode='move',step=5,collapsed=true;
const originals=new WeakMap(), delta=new WeakMap();
const LAYOUT_KEY='ghc611LayoutV2', TOOLPOS_KEY='ghc611ToolPosV2';
const tracked=new Map();
const $=q=>document.querySelector(q);
function label(el){
 if(!el)return 'NONE';
 if(el.id)return '#'+el.id;
 let c=typeof el.className==='string'?el.className.trim().split(/\s+/).filter(Boolean).slice(0,2):[];
 return el.tagName.toLowerCase()+(c.length?'.'+c.join('.'):'');
}
function stableSelector(el){
 if(!el)return '';
 if(el.id)return '#'+CSS.escape(el.id);
 let parts=[],n=el;
 while(n&&n!==document.body&&parts.length<6){let part=n.tagName.toLowerCase();if(typeof n.className==='string'){let cs=n.className.trim().split(/\s+/).filter(Boolean).slice(0,2);if(cs.length)part+='.'+cs.map(CSS.escape).join('.')}let sib=n.parentElement?[...n.parentElement.children].filter(x=>x.tagName===n.tagName):[];if(sib.length>1)part+=`:nth-of-type(${sib.indexOf(n)+1})`;parts.unshift(part);n=n.parentElement}return parts.join(' > ')
}
function readPersisted(){try{const d=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null');return d&&d.items?d:{version:3,savedAt:new Date().toISOString(),items:{}}}catch(e){return {version:3,savedAt:new Date().toISOString(),items:{}}}}
function saveAll(){
 const prior=readPersisted();
 const data={version:3,savedAt:new Date().toISOString(),items:Object.assign({},prior.items||{})};
 tracked.forEach((el,sel)=>{if(!el||!el.isConnected)return;let a=delta.get(el),o=originals.get(el),r=el.getBoundingClientRect();if(!a||!o)return;data.items[sel]={selector:sel,x:a.x,y:a.y,w:a.w,h:a.h,s:a.s,original:{width:+o.w.toFixed(2),height:+o.h.toFixed(2),inlineStyle:o.css||''},final:{left:+r.left.toFixed(2),top:+r.top.toFixed(2),right:+r.right.toFixed(2),bottom:+r.bottom.toFixed(2),width:+r.width.toFixed(2),height:+r.height.toFixed(2)},inlineStyle:el.getAttribute('style')||''};});
 try{localStorage.setItem(LAYOUT_KEY,JSON.stringify(data))}catch(e){} return data
}
function keep(el){if(!originals.has(el)){let r=el.getBoundingClientRect(),sel=stableSelector(el); originals.set(el,{css:el.style.cssText,w:r.width,h:r.height,selector:sel});delta.set(el,{x:0,y:0,w:0,h:0,s:1});if(sel)tracked.set(sel,el)}}
function q(){if(!selected)return null;keep(selected);return delta.get(selected)}
function imp(el,k,v){el.style.setProperty(k,v,'important')}
function read(msg=''){
 let n=$('#ghcRead611');if(!n)return;
 if(!selected){n.textContent=pick?'PICK: tap an item':'No item selected';return}
 let a=q(),r=selected.getBoundingClientRect();
 n.textContent=`${label(selected)}  X${Math.round(r.left)} Y${Math.round(r.top)}  ${Math.round(r.width)}×${Math.round(r.height)}  Δ${a.x},${a.y}${msg?'  '+msg:''}`;
}
function outline(){
 let o=$('#'+OUT);if(!o)return;
 if(!selected||!selected.isConnected){o.hidden=true;return}
 let r=selected.getBoundingClientRect();o.hidden=false;
 Object.assign(o.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
}
function select(el){if(!el||el.closest?.('#'+ID))return;const lt=el.closest?.('#portraitLastTrickGroup,#portraitLastTrickCards,.portrait-last-trick-mini-card,.portrait-last-simple-face');if(lt)el=document.getElementById('portraitLastTrickGroup')||el;selected=el;keep(el);pick=false;let b=$('[data-c611="pick"]');if(b)b.textContent='PICK';read('SELECTED');outline()}
function apply(){
 if(!selected)return;let a=q(),o=originals.get(selected);
 imp(selected,'translate',`${a.x}px ${a.y}px`);
 if(a.w||a.s!==1)imp(selected,'width',Math.max(2,(o.w+a.w)*a.s)+'px');
 if(a.h||a.s!==1)imp(selected,'height',Math.max(2,(o.h+a.h)*a.s)+'px');
 read();outline();saveAll()
}
function action(dir){
 if(!selected){read('PICK FIRST');return}
 let a=q();
 if(mode==='move'){if(dir==='l')a.x-=step;if(dir==='r')a.x+=step;if(dir==='u')a.y-=step;if(dir==='d')a.y+=step}
 else {if(dir==='l')a.w-=step;if(dir==='r')a.w+=step;if(dir==='u')a.h+=step;if(dir==='d')a.h-=step}
 apply()
}
function scale(by){if(!selected)return;let a=q();a.s=Math.max(.25,Math.min(3,+(a.s+by).toFixed(2)));apply()}
function reset(){if(!selected)return;let o=originals.get(selected);if(o){let sel=o.selector;selected.style.cssText=o.css;originals.delete(selected);delta.delete(selected);if(sel){tracked.delete(sel);let d=readPersisted();if(d.items&&d.items[sel]){delete d.items[sel];try{localStorage.setItem(LAYOUT_KEY,JSON.stringify(d))}catch(e){}}}}saveAll();read('RESET');outline()}
function done(){
 selected=null; pick=false;
 let b=$('[data-c611="pick"]'); if(b)b.textContent='PICK';
 let o=$('#'+OUT); if(o)o.hidden=true;
 read('DONE');
}
function parent(){if(selected&&selected.parentElement&&selected.parentElement!==document.body)select(selected.parentElement)}
function visibleKids(el){return Array.from(el?.children||[]).filter(x=>{if(x.closest?.('#'+ID))return false;let r=x.getBoundingClientRect(),c=getComputedStyle(x);return c.display!=='none'&&c.visibility!=='hidden'&&r.width&&r.height})}
function child(){
 if(!selected)return;
 let kids=visibleKids(selected); if(kids.length){select(kids[0]);return}
 let p=selected.parentElement,sibs=visibleKids(p),i=sibs.indexOf(selected);if(i>=0&&sibs.length>1)select(sibs[(i+1)%sibs.length]);else read('NO CHILD')
}
function copy(){
 if(!selected)return;let a=q(),r=selected.getBoundingClientRect();
 let txt=`${label(selected)} | X=${Math.round(r.left)} Y=${Math.round(r.top)} W=${Math.round(r.width)} H=${Math.round(r.height)} | ΔX=${a.x} ΔY=${a.y} ΔW=${a.w} ΔH=${a.h} SCALE=${a.s.toFixed(2)}`;
 navigator.clipboard?.writeText(txt).then(()=>read('COPIED')).catch(()=>{let x=$('#ghcText611');x.hidden=false;x.value=txt;x.select();read('SELECT TEXT')})
}

function restoreSaved(){
 let data=null;try{data=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null')}catch(e){};if(!data||!data.items)return;
 // Rook647 one-time migration: the recovered +65 Last 3 delta is now baked into source geometry.
 // Remove only that exact legacy record so it cannot be applied a second time. Future mapper moves still persist normally.
 try{const a=data.items['#portraitLast3Btn'];if(a&&Number(a.x)===65&&Number(a.y)===0){delete data.items['#portraitLast3Btn'];localStorage.setItem(LAYOUT_KEY,JSON.stringify(data));}}catch(e){}
 Object.entries(data.items).forEach(([sel,a])=>{let el=null;try{el=document.querySelector(sel)}catch(e){};if(!el)return;keep(el);let d=delta.get(el);Object.assign(d,{x:Number(a.x)||0,y:Number(a.y)||0,w:Number(a.w)||0,h:Number(a.h)||0,s:Number(a.s)||1});let o=originals.get(el);imp(el,'translate',`${d.x}px ${d.y}px`);if(d.w||d.s!==1)imp(el,'width',Math.max(2,(o.w+d.w)*d.s)+'px');if(d.h||d.s!==1)imp(el,'height',Math.max(2,(o.h+d.h)*d.s)+'px')});
}
function exportLayout(){let data=saveAll(),txt=JSON.stringify(data,null,2),blob=new Blob([txt],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ROOK_LAYOUT_EXACT.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);navigator.clipboard?.writeText(txt).catch(()=>{});read('LAYOUT EXPORTED')}
function importLayout(){let i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=()=>{let f=i.files&&i.files[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{try{let d=JSON.parse(String(rd.result||''));localStorage.setItem(LAYOUT_KEY,JSON.stringify(d));location.reload()}catch(e){read('BAD LAYOUT FILE')}};rd.readAsText(f)};i.click()}
function makeToolDraggable(t){let drag=null;const start=e=>{if(e.target.closest('button,input,textarea,label'))return;let r=t.getBoundingClientRect();drag={dx:e.clientX-r.left,dy:e.clientY-r.top};t.setPointerCapture?.(e.pointerId);e.preventDefault()};const move=e=>{if(!drag)return;t.dataset.dock='free';t.style.setProperty('left',Math.max(0,e.clientX-drag.dx)+'px','important');t.style.setProperty('top',Math.max(0,e.clientY-drag.dy)+'px','important');t.style.setProperty('right','auto','important');t.style.setProperty('bottom','auto','important');t.style.setProperty('transform','none','important')};const end=()=>{if(!drag)return;drag=null;let r=t.getBoundingClientRect();try{localStorage.setItem(TOOLPOS_KEY,JSON.stringify({left:r.left,top:r.top}))}catch(e){}};t.addEventListener('pointerdown',start);t.addEventListener('pointermove',move);t.addEventListener('pointerup',end);t.addEventListener('pointercancel',end)}

function dock(pos){let t=$('#'+ID);t.dataset.dock=pos;localStorage.setItem('ghc611Dock',pos)}
function setOpen(open){
 collapsed=!open;
 const t=$('#'+ID);if(!t)return;
 // Header and Settings use the same state and the same tool, never a copy.
 if(open){if(typeof closeHostOptionsModal==='function')closeHostOptionsModal();document.body.appendChild(t);t.dataset.dock='top';t.hidden=false;}
 t.classList.toggle('collapsed',collapsed);
 t.classList.toggle('r706-layout-open',open);
 if(!open){pick=false;done();const pane=document.getElementById('optPaneSettings');if(pane)pane.appendChild(t);}
 $('[data-c611="collapse"]').textContent=collapsed?'LAYOUT':'×';
 const b=document.getElementById('ghTopLayout693');if(b){b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-controls',ID);}
}
function toggle(){setOpen(collapsed)}
window.HORCompactLayout={toggle,setOpen,isOpen:()=>!collapsed};
const ghcNamesOriginal=new Map();
function ghcNameEl(sid){const slot=document.getElementById(sid);return slot&&slot.querySelector('.player-name-text');}
function ghcSyncNameInputs(){document.querySelectorAll('#ghcNames611 input[data-name-seat]').forEach(i=>{const el=ghcNameEl(i.dataset.nameSeat);if(el)i.value=String(el.textContent||'').trim();});}
function ghcApplyNames(){document.querySelectorAll('#ghcNames611 input[data-name-seat]').forEach(i=>{const el=ghcNameEl(i.dataset.nameSeat);if(!el)return;if(!ghcNamesOriginal.has(i.dataset.nameSeat))ghcNamesOriginal.set(i.dataset.nameSeat,String(el.textContent||''));el.textContent=i.value;});}
function ghcRestoreNames(){document.querySelectorAll('#ghcNames611 input[data-name-seat]').forEach(i=>{const el=ghcNameEl(i.dataset.nameSeat),v=ghcNamesOriginal.get(i.dataset.nameSeat);if(el&&v!=null)el.textContent=v;});ghcSyncNameInputs();}

function build(){
 if($('#'+ID))return;
 let t=document.createElement('div');t.id=ID;t.className='collapsed';t.dataset.dock='menu';
 t.innerHTML=`
 <div class="ghc-mini"><button data-c611="collapse">LAYOUT</button><span class="ghc-speed-slot" id="ghcSpeedSlot611"></span></div>
 <div class="ghc-full">
   <div class="ghc-line">
    <button data-c611="pick">PICK</button><button data-c611="parent">PARENT</button><button data-c611="child">CHILD</button>
    <button data-c611="mode">MOVE</button><button data-c611="step">STEP 5</button>
    <button data-c611="collapse">×</button>
   </div>
   <div id="ghcRead611">No item selected</div>
   <div class="ghc-line">
    <button data-c611="l">←</button><button data-c611="u">↑</button><button data-c611="d">↓</button><button data-c611="r">→</button>
    <button data-c611="sm">−SIZE</button><button data-c611="sp">+SIZE</button>
    <button data-c611="reset">RESET</button><button data-c611="done">DONE</button><button data-c611="more">•••</button>
   </div>
   <div class="ghc-more">
    <button data-c611="top">TOP</button><button data-c611="bottom">BOTTOM</button><button data-c611="left">LEFT</button><button data-c611="right">RIGHT</button><button data-c611="copy">COPY</button><button data-c611="export">EXPORT LAYOUT</button><button data-c611="import">IMPORT</button><button data-c611="names">NAMES</button>
   </div>
   <div class="ghc-names" id="ghcNames611">
    <div class="ghc-names-title">NAME TEST — display only</div>
    <label>TOP <input data-name-seat="slot-partner"></label>
    <label>LEFT <input data-name-seat="slot-left"></label>
    <label>RIGHT <input data-name-seat="slot-right"></label>
    <label>BOTTOM <input data-name-seat="slot-me"></label>
    <div class="ghc-name-actions"><button data-c611="nameApply">APPLY</button><button data-c611="nameRestore">RESTORE</button><button data-c611="namesClose">CLOSE</button></div>
   </div>
   <textarea id="ghcText611" hidden readonly></textarea>
 </div>`;
 // Rook677 recovery: keep diagnostics inside the existing upper Settings menu.
 // The real speed control already lives in optPaneSettings; do not move or duplicate it.
 const settingsPane=document.getElementById('optPaneSettings');
 if(settingsPane) settingsPane.appendChild(t); else { t.hidden=true; document.body.appendChild(t); }
 let o=document.createElement('div');o.id=OUT;o.hidden=true;document.body.appendChild(o);
 t.addEventListener('pointerdown',e=>e.stopPropagation(),true);
 t.addEventListener('click',e=>{
  e.stopPropagation();let k=e.target.dataset.c611;if(!k)return;
  if(k==='collapse')toggle();
  else if(k==='pick'){pick=!pick;e.target.textContent=pick?'CANCEL':'PICK';read()}
  else if(k==='parent')parent();else if(k==='child')child();else if(k==='done')done();
  else if(k==='mode'){mode=mode==='move'?'resize':'move';e.target.textContent=mode.toUpperCase();read(mode.toUpperCase())}
  else if(k==='step'){step=step===1?5:step===5?10:1;e.target.textContent='STEP '+step;read('STEP '+step)}
  else if(['l','u','d','r'].includes(k))action(k);
  else if(k==='sm')scale(-.05);else if(k==='sp')scale(.05);
  else if(k==='reset')reset();else if(k==='more')t.classList.toggle('show-more');
  else if(k==='names'){const p=document.getElementById('ghcNames611');p.classList.toggle('show');if(p.classList.contains('show'))ghcSyncNameInputs()}
  else if(k==='nameApply')ghcApplyNames();else if(k==='nameRestore')ghcRestoreNames();else if(k==='namesClose')document.getElementById('ghcNames611')?.classList.remove('show');
  else if(k==='copy')copy();else if(k==='export')exportLayout();else if(k==='import')importLayout();else if(['top','bottom','left','right'].includes(k))dock(k)
 });
 makeToolDraggable(t);
 try{let p=JSON.parse(localStorage.getItem(TOOLPOS_KEY)||'null');if(p){t.dataset.dock='free';t.style.setProperty('left',p.left+'px','important');t.style.setProperty('top',p.top+'px','important');t.style.setProperty('right','auto','important');t.style.setProperty('bottom','auto','important');t.style.setProperty('transform','none','important')}}catch(e){}
 setTimeout(restoreSaved,0);
}
document.addEventListener('pointerdown',e=>{if(!pick||e.target.closest?.('#'+ID))return;e.preventDefault();e.stopImmediatePropagation();select(e.target)},true);
addEventListener('resize',()=>{read();outline()});
new MutationObserver(()=>{if(selected&&!selected.isConnected){selected=null;read('ELEMENT REPLACED');outline()}}).observe(document.documentElement,{subtree:true,childList:true});
build();
})();


// ROOK025: coordinate capture completed; no tap listener or overlay in normal play.

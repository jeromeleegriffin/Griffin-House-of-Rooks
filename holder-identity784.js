/* Portrait presentation only. Move the original controls; never own game state. */
(()=>{'use strict';
let row,identity,name,anchor,pot,potAnchor,savedStyle='',active=false,hand,area,frame=0;
const portrait=matchMedia('(orientation:portrait)');
function fitTouches(){
 frame=0;if(!active||!hand||!area)return;
 const h=hand.getBoundingClientRect(),rail=area.querySelector('.hand-rail').getBoundingClientRect();
 const scale=hand.offsetWidth?h.width/hand.offsetWidth:1;
 // The existing front-rail mask starts at 61% across its usable center.
 // Remove only card hit pixels already hidden behind that wood, not visible faces.
 const cut=Math.max(0,(h.bottom-(rail.top+rail.height*.61))/scale);
 const value=cut.toFixed(3)+'px';
 if(hand.style.getPropertyValue('--holder-hit-cut784')!==value)hand.style.setProperty('--holder-hit-cut784',value);
}
function scheduleFit(){if(!frame)frame=requestAnimationFrame(fitTouches);}
function mount(){
 const slot=document.getElementById('slot-me');area=document.querySelector('.game-room > .hand-area');
 if(!slot||!area)return false;
 if(!row){
  row=document.createElement('div');row.id='holderPlaques784';
  identity=document.createElement('div');identity.id='holderIdentity784';row.appendChild(identity);area.appendChild(row);
  identity.addEventListener('click',e=>{
   if(e.target.closest('.hor-career-badge'))return;
   e.preventDefault();e.stopPropagation();
   const badge=name?.querySelector('.hor-career-badge');
   if(badge){badge.click();return;}
   const p=typeof game!=='undefined'&&game?.players?.[myIndex];
   if(p)horShowCareerForPlayer(p);
  });
  identity.addEventListener('keydown',e=>{if(e.target===identity&&(e.key==='Enter'||e.key===' ')){e.preventDefault();identity.click();}});
  identity.setAttribute('role','button');identity.tabIndex=0;
  hand=document.getElementById('myHand');
  const observer=new ResizeObserver(scheduleFit);observer.observe(area);observer.observe(hand);
 }
 if(!active){
  name=slot.querySelector('.name');pot=document.getElementById('trickPtsBar');if(!name||!pot)return false;
  // An inert spacer preserves the old seat's layout, not a second identity/control.
  anchor=document.createElement('span');anchor.className='holder-identity-anchor784';anchor.setAttribute('aria-hidden','true');
  anchor.style.cssText=`display:block;width:${name.offsetWidth}px;height:${name.offsetHeight}px;flex:0 0 auto;pointer-events:none`;
  name.before(anchor);savedStyle=name.getAttribute('style')||'';name.id='holderPlayerName784';identity.appendChild(name);
  potAnchor=document.createComment('original trickPtsBar position');pot.before(potAnchor);row.appendChild(pot);
  active=true;
  hand.classList.add('holder-hit-clip784');scheduleFit();
 }
 return true;
}
function release(){
 if(!active)return;
 identity.querySelectorAll('.auction-status').forEach(e=>e.remove());
 name.querySelectorAll('.hor-career-badge').forEach(b=>{b.setAttribute('role','button');b.tabIndex=0;});
 anchor.replaceWith(name);name.removeAttribute('id');name.setAttribute('style',savedStyle);
 potAnchor.replaceWith(pot);row.hidden=true;active=false;
 hand.classList.remove('holder-hit-clip784');hand.style.removeProperty('--holder-hit-cut784');
}
function sync(){
 const enabled=portrait.matches&&document.body.classList.contains('in-game')&&typeof game!=='undefined'&&!!game&&typeof myIndex!=='undefined'&&myIndex>=0&&!isSpectator;
 if(!enabled){release();return;}
 if(!mount())return;
 row.hidden=false;
 // Legacy inline plaque/mapper decoration must not carry its old seat coordinates here.
 name.removeAttribute('style');
 const text=name.querySelector('.player-name-text')?.textContent||'';
 const badge=name.querySelector('.hor-career-badge');
 if(badge){badge.removeAttribute('role');badge.tabIndex=-1;}
 identity.title=text+(badge?' '+badge.textContent:'')+' — View Career';
 identity.setAttribute('aria-label',identity.title);
 scheduleFit();
}
function bidTarget(slot){return active&&slot?.id==='slot-me'?identity:null;}
function refresh(){sync();if(typeof renderUI==='function'&&typeof game!=='undefined'&&game)renderUI();}
portrait.addEventListener('change',refresh);
new MutationObserver(()=>sync()).observe(document.body,{attributes:true,attributeFilter:['class']});
window.HORHolderIdentity784={sync,bidTarget};
})();

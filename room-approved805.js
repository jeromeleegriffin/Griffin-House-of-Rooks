/* Approved Room B. Only the background behind the unchanged outer rail is repainted. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg', W=875, H=1797;
  const outside='M0 0H875V797L628 592Q590 563 534 561Q436 554 336 563Q298 565 254 594L0 799Z';
  const layers=new Map();let frame=0;
  function layer(host){
    let el=layers.get(host);if(el&&el.parentNode===host)return el;
    if(!el){
      el=document.createElementNS(NS,'svg');el.classList.add('room-layer805');el.setAttribute('viewBox','0 0 875 1797');el.setAttribute('width',W);el.setAttribute('height',H);el.setAttribute('aria-hidden','true');
      const clip='room805-'+host.id;
      el.innerHTML=`<defs><clipPath id="${clip}"><path d="${outside}"/></clipPath></defs><foreignObject width="875" height="1797" clip-path="url(#${clip})"><div xmlns="http://www.w3.org/1999/xhtml" class="room805-canvas"><div class="room805-fireplace"><div class="room805-hearth"><div class="room805-fire-base"></div><div class="hearth-tongues736"><i class="hearth-tongue736 tongue-a736"></i><i class="hearth-tongue736 tongue-b736"></i><i class="hearth-tongue736 tongue-c736"></i><b class="hearth-ember736"></b></div><div class="room805-glow"></div></div></div><div class="room805-lamp-wall"></div><div class="room805-lantern"><img src="assets/house736/lantern-clipped.svg" alt=""/><div class="lantern-flame736"></div></div><div class="room805-ceiling"></div><div class="room805-shade"></div></div></foreignObject>`;
      layers.set(host,el);
    }
    host.prepend(el);return el;
  }
  function sync(){
    frame=0;
    const landing=document.getElementById('landingScene783'),friends=document.getElementById('friendsScene803'),bg=document.getElementById('hor-room-bg');
    if(landing){layer(landing);const r=landing.getBoundingClientRect();document.getElementById('lobby').style.setProperty('--room805-scale',Math.max(r.width/W,r.height/H));}
    if(friends)layer(friends);
    if(bg){const el=layer(bg),r=bg.getBoundingClientRect(),s=Math.max(r.width/W,r.height/H);el.style.cssText=`left:${r.left+(r.width-W*s)/2}px;top:${r.top}px;transform:scale(${s})`;}
    document.body.classList.toggle('room805-visible',!document.hidden);
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
  function init(){
    const branding=document.getElementById('landingBrand783');
    if(branding){const img=document.createElement('img');img.src='assets/approved805/griffin-logo.png';img.alt='Griffin House of Rooks';branding.replaceChildren(img);branding.classList.add('room805-brand-ready');}
    const partner=document.getElementById('landingPartner783');
    if(partner)partner.innerHTML='<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-13-2L3 9m0-5v5h5M5 16a8 8 0 0 0 13 2l3-3m0 5v-5h-5"/></svg>Change Partner</span>';
    document.body.classList.add('room805-ready');sync();
    for(const id of ['landingScene783','friendsScene803','hor-room-bg']){const host=document.getElementById(id);if(!host)continue;new ResizeObserver(schedule).observe(host);new MutationObserver(schedule).observe(host,{childList:true});}
    window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);document.addEventListener('visibilitychange',schedule);
  }
  window.HORRoom805={sync:schedule};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

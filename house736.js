/* Banked house effects, registered to existing room pixels; no game ownership. */
(() => {
  'use strict';
  let lantern, frame=0;
  function sync() {
    frame=0;
    const bg=document.getElementById('hor-room-bg');
    if(!bg)return;
    if(!lantern){
      lantern=document.createElement('div');lantern.id='houseLantern736';lantern.setAttribute('aria-hidden','true');
      // Reuse an adjacent wood strip to cover only the baked-in lamp. The
      // banked lantern itself is preserved with a code-native silhouette mask.
      lantern.innerHTML='<div class="lamp-wall736"></div><img src="assets/house736/lantern-clipped.svg" alt=""><div class="lantern-flame736"></div>';
      bg.appendChild(lantern);
    }
    const r=bg.getBoundingClientRect(),scale=Math.max(r.width/875,r.height/1797),ox=r.left+(r.width-875*scale)/2;
    lantern.style.left=(ox+120*scale)+'px';lantern.style.top=(r.top+320*scale)+'px';lantern.style.transform=`scale(${scale})`;
    const fire=document.getElementById('quietFire034');
    if(fire&&!fire.querySelector('.hearth-tongues736')) {
      const tongues=document.createElement('div');tongues.className='hearth-tongues736';
      tongues.innerHTML='<i class="hearth-tongue736 tongue-a736"></i><i class="hearth-tongue736 tongue-b736"></i><i class="hearth-tongue736 tongue-c736"></i><b class="hearth-ember736"></b>';
      fire.appendChild(tongues);
    }
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
  function init(){sync();const bg=document.getElementById('hor-room-bg');if(bg)new ResizeObserver(schedule).observe(bg);new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});window.addEventListener('resize',schedule);window.addEventListener('orientationchange',schedule);document.addEventListener('visibilitychange',schedule);}
  window.HORHouse736={sync};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

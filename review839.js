/* 839 presentation repair. No card/rule/network ownership. */
(()=>{'use strict';
const theater=document.getElementById('landscapeTheater'),nav=document.querySelector('.in-game-leave');
if(theater){
 const cue=document.createElement('div');cue.id='landscapeHolderCue839';const img=document.createElement('img');img.src='assets/cardholder/holder047.png';img.alt='';cue.append(img);theater.append(cue);
 function fit(){const l=window.HORLowerLayout;if(!l)return;Object.assign(cue.style,{left:l.holderX+'px',top:l.holderY+'px',width:l.holderW+'px',height:l.holderH+'px'});}
 addEventListener('resize',()=>requestAnimationFrame(fit));new MutationObserver(fit).observe(theater,{subtree:true,childList:true});fit();
}
// Retain decoded scene images across orientation changes; do not blank the live scene.
const retained=[];for(const src of ['assets/lower-camera/room-table-shelf834.svg','assets/table003/room-table-perspective.png','assets/cardholder/holder047.png']){const img=new Image();img.src=src;img.decode?.().catch(()=>{});retained.push(img);}
function installedLaunch840(){document.body.classList.toggle('installed-fullscreen840',matchMedia('(display-mode: fullscreen)').matches&&!(document.fullscreenElement||document.webkitFullscreenElement));}
installedLaunch840();document.addEventListener('fullscreenchange',installedLaunch840);matchMedia('(display-mode: fullscreen)').addEventListener('change',installedLaunch840);
window.HORReview839={sceneImages:retained};
})();

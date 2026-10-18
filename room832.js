/* Place room utilities in the dock; keep native controls and original homes. */
(()=>{'use strict';
 const lobby=document.getElementById('lobby'),waiting=document.getElementById('waiting'),dock=document.getElementById('roomEntryDock830'),menu=document.getElementById('landingMenuButton783');
 if(!dock||!menu)return;const home=document.createComment('portrait menu home');menu.before(home);
 const tools=document.createElement('div');tools.id='roomTools832';tools.setAttribute('aria-label','Screen and menu');
 function fit(){
  const wide=matchMedia('(orientation:landscape)').matches,entryButton=lobby.querySelector('.room-fullscreen831'),waitButton=waiting.querySelector('.room-fullscreen831'),waitDock=document.getElementById('friendsDock803');
  if(wide){if(tools.parentNode!==dock||dock.lastElementChild!==tools)dock.append(tools);if(menu.parentNode!==tools)tools.append(menu);if(entryButton&&entryButton.parentNode!==tools)tools.append(entryButton);if(waitButton&&waitDock&&waitButton.parentNode!==waitDock)waitDock.append(waitButton);}
  else{if(menu.parentNode!==home.parentNode)home.after(menu);if(entryButton&&entryButton.parentNode!==lobby)lobby.append(entryButton);if(waitButton&&waitButton.parentNode!==waiting)waiting.append(waitButton);}
 }
 addEventListener('resize',fit);document.addEventListener('DOMContentLoaded',fit);new MutationObserver(fit).observe(dock,{childList:true});fit();
})();

/*836 intentionally leaves table art, bidding, dealing and stamp timing with their existing owners. */
(()=>{'use strict';
 const recap=document.getElementById('celeRecap');if(recap)new MutationObserver(()=>{const grid=recap.querySelector('.recap-grid');if(!grid||grid.querySelector('[data-finish836]'))return;const target=game?.targetScore||targetScore||500,scores=game?.scores||[];const loser=scores.findIndex(v=>v<=-target);if(loser>=0&&!scores.some(v=>v>=target)){const note=document.createElement('small');note.dataset.finish836='1';note.textContent=teamLabel(loser)+' reached −'+Number(target).toLocaleString()+'.';grid.firstElementChild.append(note);}}).observe(recap,{childList:true});
})();

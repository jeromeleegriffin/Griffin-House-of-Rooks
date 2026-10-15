/* Reads the existing bidding authority; never submits or advances the game. */
(() => {
  let syncing=false;const previousDisabled=new WeakMap();
  function required(){return !!(game&&game.phase==='bidding'&&game.currentPlayer===myIndex&&!isSpectator&&!horSolSeatIsBot()&&!hasPassedBid(myIndex));}
  function sync(){
    if(syncing)return;syncing=true;
    try{
      const waiting=required();document.body.classList.toggle('human-bid-required737',waiting);
      const nav=document.querySelector('.in-game-leave');
      if(nav){
        if(nav.inert!==waiting)nav.inert=waiting;
        nav.querySelectorAll('button').forEach(b=>{
          if(waiting){if(!previousDisabled.has(b))previousDisabled.set(b,b.disabled);if(!b.disabled)b.disabled=true;}
          else if(previousDisabled.has(b)){b.disabled=previousDisabled.get(b);previousDisabled.delete(b);}
        });
      }
      // A local host knows whether its synchronous bid was accepted. A client
      // retains its existing packet/ack presentation ownership in applyState.
      const dock=document.getElementById('decisionConsole');
      if(waiting&&isHost&&!game.paused&&!nestAuctionLocked()&&!window.horTourBlocking&&dock
        &&(dock.classList.contains('hidden')||!dock.classList.contains('decision-mode-bid')||!dock.querySelector('#bidConfirm'))){
        showBidUI();
        window.HORBidRepair737.lastRecovery={phase:game.phase,currentPlayer:game.currentPlayer,high:auctionHigh(),at:Date.now()};
      }
    }finally{syncing=false;}
  }
  function init(){
    const dock=document.getElementById('decisionConsole');
    if(dock)new MutationObserver(sync).observe(dock,{attributes:true,childList:true,attributeFilter:['class']});
    window.addEventListener('resize',sync);window.addEventListener('orientationchange',sync);
    document.addEventListener('visibilitychange',sync);window.addEventListener('pageshow',sync);
    for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>{
      if(required()&&e.target.closest?.('.in-game-leave')){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    sync();
  }
  window.HORBidRepair737={sync,required,lastRecovery:null};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

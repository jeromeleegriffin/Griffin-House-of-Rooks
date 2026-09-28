/* Rook517 — compatibility guard.
   The old Rook513 file installed a MutationObserver that continuously forced
   lobby/waiting/game visibility and also replaced the Play With Friends
   onclick handler.  That guard outlived the navigation code it protected and
   could fight the current multiplayer state machine, producing a brief table
   flash followed by an apparently frozen UI.  Navigation now has one owner:
   game.js.  Keep only the harmless legacy room cleanup here. */
(function () {
  function $(id){ return document.getElementById(id); }
  function cleanRoom(){
    var g=$('game'); if(!g)return;
    g.style.setProperty('background','transparent','important');
    g.style.setProperty('background-color','transparent','important');
    g.style.setProperty('background-image','none','important');
    g.querySelectorAll('.room-decor,.sconce,.wall-frame,.chandelier').forEach(function(el){
      el.style.setProperty('display','none','important');
      el.setAttribute('aria-hidden','true');
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',cleanRoom,{once:true});
  else cleanRoom();
  setTimeout(cleanRoom,300);
})();

/* Rook513 activation bridge.
   Safe drop-in replacement for rook512-room.js when mobile GitHub upload is easier.
   It preserves the approved room and loads the cumulative 513 CSS/behavior overlays. */
(function () {
  function addCss() {
    if (document.getElementById('rook513-css')) return;
    var l=document.createElement('link');
    l.id='rook513-css'; l.rel='stylesheet'; l.href='rook513.css?v=513';
    document.head.appendChild(l);
  }
  function addJs() {
    if (document.getElementById('rook513-js')) return;
    var s=document.createElement('script');
    s.id='rook513-js'; s.src='rook513.js?v=513';
    document.head.appendChild(s);
  }
  function ensureRoom() {
    var bg=document.getElementById('hor-room-bg');
    if(!bg){ bg=document.createElement('div'); bg.id='hor-room-bg'; bg.setAttribute('aria-hidden','true'); document.body.insertBefore(bg,document.body.firstChild); }
    bg.style.setProperty('position','fixed','important');
    bg.style.setProperty('inset','0','important');
    bg.style.setProperty('z-index','0','important');
    bg.style.setProperty('pointer-events','none','important');
    bg.style.setProperty('background-color','#07090f','important');
    bg.style.setProperty('background-image',"url('./room-card-club.jpg')",'important');
    bg.style.setProperty('background-repeat','no-repeat','important');
    bg.style.setProperty('background-size','cover','important');
    bg.style.setProperty('background-position','center 16%','important');
    var game=document.getElementById('game');
    if(game){
      game.style.setProperty('background','transparent','important');
      game.style.setProperty('background-color','transparent','important');
      game.style.setProperty('background-image','none','important');
      game.querySelectorAll('.room-decor,.sconce,.wall-frame,.chandelier').forEach(function(el){el.style.setProperty('display','none','important');});
    }
  }
  function boot(){ensureRoom();addCss();addJs();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();

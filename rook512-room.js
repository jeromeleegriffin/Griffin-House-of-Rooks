/* Rook514 activation bridge — cumulative visual roll.
   Loads after rook510-avatars.js. Keeps the proven 513 behavior layer intact. */
(function () {
  function addCss() {
    if (document.getElementById('rook514-css')) return;
    var l=document.createElement('link');
    l.id='rook514-css'; l.rel='stylesheet'; l.href='rook514.css?v=518';
    document.head.appendChild(l);
  }
  function add513Css() {
    if (document.getElementById('rook513-css')) return;
    var l=document.createElement('link');
    l.id='rook513-css'; l.rel='stylesheet'; l.href='rook513.css?v=518';
    document.head.appendChild(l);
  }
  function add513Js() {
    if (document.getElementById('rook513-js')) return;
    var s=document.createElement('script');
    s.id='rook513-js'; s.src='rook513.js?v=518';
    document.head.appendChild(s);
  }
  function ensureRoom() {
    var bg=document.getElementById('hor-room-bg');
    if(!bg){
      bg=document.createElement('div');
      bg.id='hor-room-bg';
      bg.setAttribute('aria-hidden','true');
      document.body.insertBefore(bg,document.body.firstChild);
    }
    bg.style.setProperty('position','fixed','important');
    bg.style.setProperty('inset','0','important');
    bg.style.setProperty('z-index','0','important');
    bg.style.setProperty('pointer-events','none','important');
    bg.style.setProperty('background-color','#07090f','important');
    bg.style.setProperty('background-image',"url('./room-card-club-514.jpg')",'important');
    bg.style.setProperty('background-repeat','no-repeat','important');
    bg.style.setProperty('background-size','cover','important');
    bg.style.setProperty('background-position','center top','important');

    var game=document.getElementById('game');
    if(game){
      game.style.setProperty('background','transparent','important');
      game.style.setProperty('background-color','transparent','important');
      game.style.setProperty('background-image','none','important');
      game.querySelectorAll('.room-decor,.sconce,.wall-frame,.chandelier').forEach(function(el){
        el.style.setProperty('display','none','important');
        el.setAttribute('aria-hidden','true');
      });
    }
  }

  /* Add Jerome as a real selectable human portrait and make all legacy/missing
     human fallbacks land on a modern portrait instead of the cartoon rookling. */
  function modernHumanAvatars() {
    try {
      if (typeof AVATARS !== 'undefined' && AVATARS.indexOf('jerome') < 0) AVATARS.push('jerome');
      if (typeof AVATAR_LABELS !== 'undefined') AVATAR_LABELS.jerome='Jerome';

      var prior = window.avatarSrc;
      window.avatarSrc = function(id) {
        var key = (window.avatarKey ? window.avatarKey(id) : String(id == null ? '' : id).toLowerCase().replace(/[^a-z0-9]/g,''));
        if (key === 'jerome') return 'avatar-jerome.png';
        /* Existing saved cartoon/default human choices migrate visually to Anchor. */
        if (!key || key === 'rookling') return 'avatar-anchor.webp';
        var src = prior ? prior(id) : ('avatar-' + key + '.webp');
        if (src === 'avatar-rookling.svg') return 'avatar-anchor.webp';
        return src;
      };
    } catch(e) {}
  }

  function boot(){ ensureRoom(); add513Css(); modernHumanAvatars(); addCss(); add513Js(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  setTimeout(function(){ ensureRoom(); modernHumanAvatars(); }, 250);
})();

/* Rook513 — cumulative behavior guard. */
(function () {
  function $(id){ return document.getElementById(id); }
  var hostWaitingLock=false, observer=null;
  function cleanRoom(){var g=$('game');if(!g)return;g.style.setProperty('background','transparent','important');g.style.setProperty('background-color','transparent','important');g.style.setProperty('background-image','none','important');g.querySelectorAll('.room-decor,.sconce,.wall-frame,.chandelier').forEach(function(el){el.style.setProperty('display','none','important');el.setAttribute('aria-hidden','true');});}
  function clearJoin(){var l=$('lobby'),f=$('joinForm');if(l)l.classList.remove('joining');if(f)f.classList.add('hidden');try{var a=document.activeElement;if(a&&a.id==='hor-room-code'&&a.blur)a.blur();}catch(_) {}}
  function liveHand(){try{return !!(game&&game.phase&&['dealing','bidding','discard','trump','play'].indexOf(game.phase)>=0);}catch(_){return false;}}
  function enforce(){if(!hostWaitingLock||liveHand()){hostWaitingLock=false;if(observer){observer.disconnect();observer=null;}return;}clearJoin();var l=$('lobby'),w=$('waiting'),g=$('game');if(l)l.classList.add('hidden');if(w)w.classList.remove('hidden');if(g)g.classList.add('hidden');}
  function lock(){hostWaitingLock=true;enforce();if(!observer&&window.MutationObserver){observer=new MutationObserver(enforce);observer.observe(document.getElementById('app')||document.body,{attributes:true,subtree:true,attributeFilter:['class']});}}
  function host(ev){if(ev){try{ev.preventDefault();ev.stopPropagation();}catch(_){}}clearJoin();try{if(typeof ensureAudio==='function')ensureAudio();}catch(_){}try{isSpectator=false;}catch(_){}try{if(typeof createRoom!=='function')throw new Error('Host function unavailable');createRoom();var tries=0,t=setInterval(function(){tries++;var w=$('waiting');if(w&&!w.classList.contains('hidden')){clearInterval(t);lock();}else if(tries>=100)clearInterval(t);},100);}catch(err){console.error(err);var s=$('lobbyStatus');if(s)s.textContent='Error: '+(err.message||err);}}
  function wire(){cleanRoom();var b=$('friendsToggleBtn');if(b)b.onclick=host;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();setTimeout(wire,0);setTimeout(cleanRoom,300);
})();

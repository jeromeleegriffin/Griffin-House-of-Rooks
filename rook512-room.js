/* Rook512 room hotfix — approved room visibility + legacy decor removal.
   Surgical test patch: no gameplay or table geometry changes. */
(function () {
  function ensureRoom() {
    var bg = document.getElementById('hor-room-bg');
    if (!bg) {
      bg = document.createElement('div');
      bg.id = 'hor-room-bg';
      bg.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(bg, document.body.firstChild);
    }

    /* Apply the approved room plate directly so this hotfix does not depend
       on an additional stylesheet being wired into index.html. */
    bg.style.setProperty('position', 'fixed', 'important');
    bg.style.setProperty('inset', '0', 'important');
    bg.style.setProperty('z-index', '0', 'important');
    bg.style.setProperty('pointer-events', 'none', 'important');
    bg.style.setProperty('background-color', '#07090f', 'important');
    bg.style.setProperty('background-image', "url('./room-card-club.jpg')", 'important');
    bg.style.setProperty('background-repeat', 'no-repeat', 'important');
    bg.style.setProperty('background-size', 'cover', 'important');
    bg.style.setProperty('background-position',
      (matchMedia && matchMedia('(orientation: landscape)').matches) ? 'center center' : 'center 16%',
      'important');

    /* This is the confirmed blocker: the legacy in-game surface has its own
       opaque !important room-theme background above the approved room plate. */
    var game = document.getElementById('game');
    if (game) {
      game.style.setProperty('background', 'transparent', 'important');
      game.style.setProperty('background-color', 'transparent', 'important');
      game.style.setProperty('background-image', 'none', 'important');

      /* Remove the actual old generated room dressing. */
      var old = game.querySelectorAll('.room-decor, .sconce, .wall-frame, .chandelier');
      for (var i = 0; i < old.length; i++) {
        old[i].style.setProperty('display', 'none', 'important');
        old[i].setAttribute('aria-hidden', 'true');
      }
    }
  }

  function run() {
    ensureRoom();
    setTimeout(ensureRoom, 0);
    setTimeout(ensureRoom, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  window.addEventListener('orientationchange', function () {
    setTimeout(ensureRoom, 100);
  });
})();

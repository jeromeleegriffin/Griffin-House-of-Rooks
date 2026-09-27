/* Rook513 — cumulative behavior fixes loaded after game.js/polish.js.
   Fixes Play with Friends host flow and reinforces room cleanup. */
(function () {
  function $(id) { return document.getElementById(id); }

  function cleanRoom() {
    var game = $('game');
    if (!game) return;
    game.style.setProperty('background', 'transparent', 'important');
    game.style.setProperty('background-color', 'transparent', 'important');
    game.style.setProperty('background-image', 'none', 'important');
    game.querySelectorAll('.room-decor, .sconce, .wall-frame, .chandelier').forEach(function (el) {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function hostFriends(ev) {
    if (ev) {
      try { ev.preventDefault(); } catch (_) {}
      try { ev.stopPropagation(); } catch (_) {}
    }

    /* Explicitly leave the join-code state. This prevents the old joining class /
       focused room-code input from making the lobby jump into Join with a code. */
    var lobby = $('lobby');
    var joinForm = $('joinForm');
    if (lobby) lobby.classList.remove('joining');
    if (joinForm) joinForm.classList.add('hidden');
    try {
      var active = document.activeElement;
      if (active && active.blur) active.blur();
    } catch (_) {}

    try { if (typeof ensureAudio === 'function') ensureAudio(); } catch (_) {}
    try { if (typeof isSpectator !== 'undefined') isSpectator = false; } catch (_) {}

    /* Use the real current host function directly. Do not route through the
       hidden legacy create button or the Join-with-code controls. */
    try {
      if (typeof createRoom === 'function') {
        createRoom();
        if (typeof saveSession === 'function') saveSession();
      } else {
        var status = $('lobbyStatus');
        if (status) status.textContent = 'Could not start the host table. Refresh and try again.';
      }
    } catch (err) {
      console.error(err);
      var s = $('lobbyStatus');
      if (s) s.textContent = 'Error: ' + (err && err.message ? err.message : err);
    }
  }

  function wire() {
    cleanRoom();
    var friends = $('friendsToggleBtn');
    if (friends) {
      /* onclick replaces the earlier polish.js assignment deterministically. */
      friends.onclick = hostFriends;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire, { once: true });
  } else {
    wire();
  }
  setTimeout(wire, 0);
  setTimeout(cleanRoom, 300);
})();

/* Rook513 — room compatibility guard for older theme/decor code. */
(function () {
  function applyRoomFix() {
    var game = document.getElementById('game');
    if (!game) return;
    var decor = game.querySelector('.room-decor');
    if (decor) {
      decor.setAttribute('aria-hidden', 'true');
      decor.style.setProperty('display', 'none', 'important');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyRoomFix, { once: true });
  } else {
    applyRoomFix();
  }
})();

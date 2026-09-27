/* Rook512 — inject approved room layer + CSS overlays. Appearance only. */
(function () {
  function ensureCss(id, href) {
    if (document.getElementById(id)) return;
    var link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  ensureCss('rook511-css', 'rook511.css?v=512');
  ensureCss('rook512-css', 'rook512.css?v=512');

  function ensureRoom() {
    if (document.getElementById('hor-room-bg')) return;
    var bg = document.createElement('div');
    bg.id = 'hor-room-bg';
    bg.setAttribute('aria-hidden', 'true');
    var host = document.body;
    host.insertBefore(bg, host.firstChild);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureRoom);
  } else {
    ensureRoom();
  }
})();

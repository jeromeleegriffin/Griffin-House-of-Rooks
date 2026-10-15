/* Presentation adapter only. R706 owns all values, event handlers and rules. */
(function approvedPortraitBidAsset() {
  function init() {
    const dock = document.getElementById('decisionConsole');
    if (!dock) return;
    const portrait = window.matchMedia('(orientation: portrait)');
    let updating = false;
    function update() {
      if (updating) return;
      updating = true;
      try {
        const active = portrait.matches && dock.classList.contains('decision-mode-bid') && !dock.classList.contains('hidden');
        let surface = Array.from(dock.children).find(el => el.classList.contains('approved-bid-surface'));
        if (!active) {
          if (dock.classList.contains('approved-bid-portrait')) dock.classList.remove('approved-bid-portrait');
          if (surface) {
            Array.from(surface.childNodes).forEach(node => {
              if (!(node.nodeType === 1 && node.classList.contains('approved-bid-art'))) dock.insertBefore(node, surface);
            });
            surface.remove();
          }
          return;
        }
        if (!surface) {
          surface = document.createElement('div');
          surface.className = 'approved-bid-surface';
          surface.setAttribute('role', 'group');
          surface.setAttribute('aria-label', 'Place your bid');
          const art = document.createElement('img');
          art.className = 'approved-bid-art';
          art.src = 'assets/bidbox-approved/bidbox_complete_blank.png?v=712';
          art.alt = '';
          art.setAttribute('aria-hidden', 'true');
          art.draggable = false;
          surface.appendChild(art);
          // Move the actual nodes, preserving R706 closures and onclick handlers.
          while (dock.firstChild) surface.appendChild(dock.firstChild);
          dock.appendChild(surface);
        }
        if (!dock.classList.contains('approved-bid-portrait')) dock.classList.add('approved-bid-portrait');
      } finally { updating = false; }
    }
    new MutationObserver(update).observe(dock, { childList: true, attributes: true, attributeFilter: ['class'] });
    portrait.addEventListener('change', update);
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

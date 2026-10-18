/* Banked hand presentation: reads trump and existing rule helpers only. */
(() => {
  function ordinary(card) {
    return !!(
      game &&
      COLORS.includes(game.trump) &&
      card &&
      card.color === game.trump &&
      !isSpecialCard(card)
    );
  }
  function boundary(hand) {
    if (!game || !COLORS.includes(game.trump) || !hand?.length) return -1;
    let i = 0;
    while (i < hand.length && isTrumpCard(hand[i], game.trump)) i++;
    return i > 0 && i < hand.length ? i - 1 : -1;
  }
  function markup(card) {
    if (!ordinary(card)) return '';
    const src = `assets/cards/numbered/${card.color}-${card.rank}.png`;
    return `<span class="trump-tick739" aria-hidden="true"></span><svg class="trump-relief739" viewBox="0 0 580 840" aria-hidden="true" focusable="false"><image href="${src}" width="580" height="840" filter="url(#trump-number-relief739)"/></svg>`;
  }
  function init() {
    // Extract ink luminance from the unchanged raster in the overlay only.
    // Two restrained edge shadows give relief; no new numeral is drawn.
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.setAttribute('width', '0');
    defs.setAttribute('height', '0');
    defs.setAttribute('aria-hidden', 'true');
    defs.style.cssText = 'position:absolute;pointer-events:none;';
    defs.innerHTML =
      '<defs><filter id="trump-number-relief739" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -.3333 -.3333 -.3333 0 1" result="ink"/><feComponentTransfer in="ink" result="inkMask"><feFuncA type="discrete" tableValues="0 0 0 1 1 1 1 1 1 1 1 1 1 1 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="inkMask" operator="in" result="number"/><feDropShadow in="number" dx="-4" dy="-4" stdDeviation="1" flood-color="#fff9df" flood-opacity=".58" result="lit"/><feDropShadow in="lit" dx="5" dy="6" stdDeviation="1.4" flood-color="#4b2915" flood-opacity=".3"/></filter></defs>';
    document.body.appendChild(defs);
  }
  window.HORTrumpHand739 = { ordinary, boundary, markup };
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

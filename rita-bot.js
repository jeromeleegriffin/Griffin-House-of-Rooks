/* Register after the existing game and before the character renderer. */
(() => {
  'use strict';
  if (!BOT_PERSONAS.some((p) => p.avatar === 'rita'))
    BOT_PERSONAS.push({
      name: 'Rita',
      style: 'partnerFirst',
      avatar: 'rita',
      blurb: 'Feeds partner. Protects the bid.',
    });
})();

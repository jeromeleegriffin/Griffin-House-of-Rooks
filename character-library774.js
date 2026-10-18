/* Character library774 registration. Existing rules/seat assignment/AI untouched. */
(() => {
  'use strict';
  const names = ['Claire', 'June', 'Tess', 'Marcus', 'Owen', 'Daniel', 'Sofia', 'Rafael', 'Samir'];
  for (const name of names) {
    const id = name.toLowerCase();
    if (!AVATARS.includes(id)) AVATARS.push(id);
    AVATAR_LABELS[id] = name;
    if (!BOT_PERSONAS.some((p) => p.name === name))
      BOT_PERSONAS.push({
        name,
        avatar: id,
        style: 'balanced',
        blurb: 'A new face at the Griffin table.',
      });
  }
  // Public Jerome uses neutral legacy metadata; never activate partnerFirst bidding.
  if (!BOT_PERSONAS.some((p) => p.avatar === 'jerome_founder'))
    BOT_PERSONAS.push({
      name: 'Jerome',
      avatar: 'jerome_founder',
      style: 'balanced',
      blurb: 'Jerome at the Griffin table.',
    });
  // Refresh only the existing favorite options if the game initialized them before registration.
  const select = document.getElementById('opt-favorite-partner');
  if (select) delete select.dataset.favoriteReady;
  syncFavoritePartner042();
})();

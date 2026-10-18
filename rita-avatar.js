/* Rita: owner-provided likeness, public human choice and shared bot identity. */
(() => {
  'use strict';
  const rita = Object.freeze({
    name: 'Rita',
    design: 'Rita owner-reference 2026-10-15',
    voice: 'female',
    availability: 'public-human-and-bot',
    poses: Object.freeze({
      left: 'human/rita-left.webp',
      top: 'human/rita-top.webp',
      right: 'human/rita-right.webp',
    }),
  });
  window.HORHumanAvatars = Object.freeze({ ...window.HORHumanAvatars, rita });
})();

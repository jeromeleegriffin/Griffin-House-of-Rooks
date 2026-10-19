/* Private display order only. Card legality, hands, scores and bot inputs retain their owners. */
(() => {
  'use strict';
  let record = null;
  const sid = (c) => String(c.id),
    special = (c) => (isRookCard(c) ? 0 : includeRed2 && isRed2(c) ? 1 : 2);
  function preset(cards) {
    const counts = {};
    for (const c of cards) if (special(c) === 2) counts[c.color] = (counts[c.color] || 0) + 1;
    const tie = ['black', 'green', 'red', 'yellow'];
    return [...cards].sort(
      (a, b) =>
        special(a) - special(b) ||
        (special(a) < 2
          ? 0
          : (counts[b.color] || 0) - (counts[a.color] || 0) ||
            tie.indexOf(a.color) - tie.indexOf(b.color) ||
            (Number(b.rank) === 1 ? 15 : Number(b.rank)) -
              (Number(a.rank) === 1 ? 15 : Number(a.rank)))
    );
  }
  function key() {
    return [
      typeof roomCode === 'undefined' ? '' : roomCode,
      typeof myPeerId === 'undefined' ? '' : myPeerId,
      game?.dealer,
      (game?.scores || []).join(','),
    ].join('|');
  }
  function save() {
    try {
      sessionStorage.setItem('horPrivateOrder838', JSON.stringify(record));
    } catch {}
  }
  function ensure(cards) {
    const k = key(),
      ids = cards.map(sid);
    if (!record) {
      try {
        const r = JSON.parse(sessionStorage.getItem('horPrivateOrder838') || 'null');
        if (r && r.key === k && Array.isArray(r.ids) && new Set(r.ids).size === r.ids.length)
          record = r;
      } catch {}
    }
    if (!record || record.key !== k || ids.some((id) => !record.ids.includes(id)))
      record = { key: k, ids: preset(cards).map(sid), locked: false };
    return record;
  }
  function ordered(cards) {
    if (!cards?.length) return [];
    const r = ensure(cards),
      by = new Map(cards.map((c) => [sid(c), c]));
    const list = r.ids.filter((id) => by.has(id)).map((id) => by.get(id));
    if (game?.phase === 'play' && game.trump) {
      const trumps = list.filter((c) => isTrumpCard(c, game.trump)).sort(compareCardsDisplay);
      const plain = list.filter((c) => !isTrumpCard(c, game.trump));
      // Keep manual ordering within the plain cards, but always gather the
      // called trump with the birds once the trump choice is authoritative.
      if (!r.locked) plain.sort(compareCardsDisplay);
      return [...trumps, ...plain];
    }
    return list;
  }
  function apply(cards) {
    if (!cards?.sort || !cards.length) return cards;
    cards.splice(0, cards.length, ...ordered(cards));
    return cards;
  }
  function lock(cards, keep, discard) {
    const valid = new Set(cards.map(sid)),
      all = [...keep, ...discard].map(String);
    if (
      all.length !== cards.length ||
      new Set(all).size !== cards.length ||
      all.some((id) => !valid.has(id))
    )
      return false;
    record = { key: key(), ids: all, locked: true };
    save();
    return true;
  }
  function newDeal() {
    record = null;
    try {
      sessionStorage.removeItem('horPrivateOrder838');
    } catch {}
    window.HORManualNest838?.reset();
    window.HORNestReveal838?.reset();
  }
  window.HORHandOrder838 = {
    preset,
    ordered,
    apply,
    lock,
    newDeal,
    inspect: () => (record ? JSON.parse(JSON.stringify(record)) : null),
  };
})();

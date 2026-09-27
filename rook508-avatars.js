/* Rook508 portrait boot — safe if game.js is already 508-patched. */
(function () {
  if (!document.getElementById('rook508-css')) {
    var link = document.createElement('link');
    link.id = 'rook508-css';
    link.rel = 'stylesheet';
    link.href = 'rook508.css';
    document.head.appendChild(link);
  }
  const PNG = {
    grit:1, nix:1, copper:1, crow:1, blaze:1, titan:1, pike:1, drift:1, dice:1,
    anchor:1, wager:1, hollow:1, ember:1, vex:1, frost:1, fang:1, halo:1,
    quill:1, bramble:1, moss:1, emberlyn:1, cinder:1, gable:1, thistle:1, marrow:1,
    pebble:1, rookery:1, sable:1, finch:1, dagger:1, willow:1, hearth:1, moth:1,
    brandy:1, flint:1, ivy:1, shade:1, barrel:1, spark:1, nettle:1, cobalt:1,
    ash:1, harrier:1
  };
  const extra = ['crow','blaze','nix','titan','pike','drift','dice','anchor','wager','hollow','ember','vex','frost','fang','halo'];
  const labels = { crow:'Crow', blaze:'Blaze', nix:'Nix', titan:'Titan', pike:'Pike', drift:'Drift', dice:'Dice', anchor:'Anchor', wager:'Wager', hollow:'Hollow', ember:'Ember', vex:'Vex', frost:'Frost', fang:'Fang', halo:'Halo' };
  const remap = { raven:'crow', fox:'blaze', jackal:'nix', badger:'titan', cardshark:'pike', goldfinch:'drift', greenie:'dice', rookling:'anchor', bluejay:'wager', grumpy:'hollow', owl:'ember', cobra:'vex', lynx:'frost', wolf:'fang', stag:'halo' };

  if (typeof AVATARS !== 'undefined') {
    extra.forEach(function (id) { if (AVATARS.indexOf(id) < 0) AVATARS.push(id); });
  }
  if (typeof AVATAR_LABELS !== 'undefined') {
    Object.keys(labels).forEach(function (k) { if (!AVATAR_LABELS[k]) AVATAR_LABELS[k] = labels[k]; });
  }
  window.AVATAR_PNG_IDS = PNG;
  window.avatarKey = function (id) {
    return String(id == null ? '' : id).toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  window.avatarSrc = function (id) {
    const key = window.avatarKey(id);
    if (key && PNG[key]) return 'avatar-' + key + '.webp';
    if (typeof AVATARS !== 'undefined' && AVATARS.indexOf(key) >= 0) return 'avatar-' + key + '.svg';
    return 'avatar-rookling.svg';
  };
  if (typeof BOT_PERSONAS !== 'undefined') {
    BOT_PERSONAS.forEach(function (p) {
      if (!p || !p.avatar) return;
      if (PNG[p.avatar]) return;
      if (remap[p.avatar]) p.avatar = remap[p.avatar];
    });
  }
})();

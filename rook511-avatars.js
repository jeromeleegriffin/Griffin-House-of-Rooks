/* Rook511 portrait resolver, human picker, persist, legacy migrate */
(function () {
  if (!document.getElementById('rook511-css')) {
    var link = document.createElement('link');
    link.id = 'rook511-css';
    link.rel = 'stylesheet';
    link.href = 'rook511.css?v=511';
    document.head.appendChild(link);
  }
  var PNG = {
    grit:1, nix:1, copper:1, crow:1, blaze:1, titan:1, pike:1, drift:1, dice:1,
    anchor:1, wager:1, hollow:1, ember:1, vex:1, frost:1, fang:1, halo:1,
    quill:1, bramble:1, moss:1, emberlyn:1, cinder:1, gable:1, thistle:1, marrow:1,
    pebble:1, rookery:1, sable:1, finch:1, dagger:1, willow:1, hearth:1, moth:1,
    brandy:1, flint:1, ivy:1, shade:1, barrel:1, spark:1, nettle:1, cobalt:1,
    ash:1, harrier:1
  };
  var PNG_FILE = { jerome: 'avatar-jerome.png' };
  var extra = ['crow','blaze','nix','titan','pike','drift','dice','anchor','wager','hollow','ember','vex','frost','fang','halo','jerome'];
  var labels = {
    crow:'Crow', blaze:'Blaze', nix:'Nix', titan:'Titan', pike:'Pike', drift:'Drift',
    dice:'Dice', anchor:'Anchor', wager:'Wager', hollow:'Hollow', ember:'Ember',
    vex:'Vex', frost:'Frost', fang:'Fang', halo:'Halo', jerome:'Jerome'
  };
  var remap = {
    raven:'crow', fox:'blaze', jackal:'nix', badger:'titan', cardshark:'pike',
    goldfinch:'drift', greenie:'dice', rookling:'anchor', bluejay:'wager',
    grumpy:'hollow', owl:'ember', cobra:'vex', lynx:'frost', wolf:'fang', stag:'halo'
  };
  var FALLBACK = 'grit';
  function keyOf(id) { return String(id == null ? '' : id).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function migrate(id) {
    var k = keyOf(id);
    if (PNG[k] || PNG_FILE[k]) return k;
    if (remap[k]) return remap[k];
    return '';
  }
  function srcOf(id) {
    var k = migrate(id);
    if (k && PNG_FILE[k]) return PNG_FILE[k];
    if (k && PNG[k]) return 'avatar-' + k + '.webp';
    return 'avatar-' + FALLBACK + '.webp';
  }
  if (typeof AVATARS !== 'undefined') extra.forEach(function (id) { if (AVATARS.indexOf(id) < 0) AVATARS.push(id); });
  if (typeof AVATAR_LABELS !== 'undefined') Object.keys(labels).forEach(function (k) { if (!AVATAR_LABELS[k]) AVATAR_LABELS[k] = labels[k]; });
  if (typeof AVATAR_PNG_IDS !== 'undefined') { Object.keys(PNG).forEach(function (k) { AVATAR_PNG_IDS[k] = 1; }); AVATAR_PNG_IDS.jerome = 1; }
  else window.AVATAR_PNG_IDS = Object.assign({ jerome: 1 }, PNG);
  window.AVATAR_MIGRATE = remap;
  window.avatarKey = keyOf;
  window.avatarMigrate = migrate;
  window.avatarSrc = function (id) { return srcOf(id); };
  window.HUMAN_AVATARS = ['jerome'].concat(Object.keys(PNG));
  if (typeof BOT_PERSONAS !== 'undefined') {
    BOT_PERSONAS.forEach(function (p) {
      if (!p || !p.avatar) return;
      if (PNG[p.avatar]) return;
      if (remap[p.avatar]) p.avatar = remap[p.avatar];
    });
  }
  function persistMine(id) {
    var k = migrate(id) || FALLBACK;
    try {
      if (typeof playerAvatars !== 'undefined' && typeof myPeerId !== 'undefined' && myPeerId) playerAvatars[myPeerId] = k;
      if (typeof players !== 'undefined' && typeof myPeerId !== 'undefined') {
        var me = players.find(function (p) { return p && p.id === myPeerId; });
        if (me) me.avatar = k;
      }
      if (typeof window.horSavePrefs === 'function') window.horSavePrefs({ avatar: k });
      else {
        var raw = {};
        try { raw = JSON.parse(localStorage.getItem('horPrefs') || '{}') || {}; } catch (e) {}
        raw.avatar = k;
        localStorage.setItem('horPrefs', JSON.stringify(raw));
      }
    } catch (e) {}
    return k;
  }
  function restoreMine() {
    var saved = '';
    try {
      if (typeof window.horLoadPrefs === 'function') saved = window.horLoadPrefs().avatar || '';
      else saved = (JSON.parse(localStorage.getItem('horPrefs') || '{}') || {}).avatar || '';
    } catch (e) {}
    var k = migrate(saved) || '';
    if (k) persistMine(k);
  }
  function paintSelector() {
    var grid = document.getElementById('avatarGrid');
    if (!grid) return;
    var ids = window.HUMAN_AVATARS || [];
    var labs = typeof AVATAR_LABELS !== 'undefined' ? AVATAR_LABELS : labels;
    grid.innerHTML = ids.map(function (id) {
      var lab = labs[id] || id;
      return '<button type="button" class="avatar-choice" data-avatar="' + id + '" title="' + lab + '"><img src="' + avatarSrc(id) + '" alt="' + lab + '"><span>' + lab + '</span></button>';
    }).join('');
    var current = 'grit';
    try {
      current = (typeof playerAvatars !== 'undefined' && myPeerId && playerAvatars[myPeerId]) ||
        (typeof window.horLoadPrefs === 'function' && window.horLoadPrefs().avatar) || 'grit';
    } catch (e) {}
    current = migrate(current) || 'grit';
    grid.querySelectorAll('.avatar-choice').forEach(function (btn) {
      btn.classList.toggle('selected', btn.getAttribute('data-avatar') === current);
      btn.onclick = function () {
        var id = persistMine(btn.getAttribute('data-avatar'));
        grid.querySelectorAll('.avatar-choice').forEach(function (b) {
          b.classList.toggle('selected', b.getAttribute('data-avatar') === id);
        });
        try { if (typeof broadcast === 'function') broadcast({ type: 'avatar', id: myPeerId, avatar: id }); } catch (e) {}
        try { if (typeof renderUI === 'function') renderUI(); } catch (e) {}
      };
    });
  }
  function decorateImgs() {
    document.querySelectorAll('.seat-avatar-img, .wait-seat-av, .lt-bid-av, .avatar-choice img').forEach(function (img) {
      if (img.getAttribute('data-rook511-err')) return;
      img.setAttribute('data-rook511-err', '1');
      img.addEventListener('error', function () {
        if (img.getAttribute('data-rook511-fell')) return;
        img.setAttribute('data-rook511-fell', '1');
        img.src = 'avatar-' + FALLBACK + '.webp';
      });
    });
  }
  function boot() { restoreMine(); paintSelector(); decorateImgs(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 50);
  setTimeout(boot, 400);
})();

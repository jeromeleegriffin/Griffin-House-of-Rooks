/* Approved trump audio only. Presentation never reads hands or changes gameplay. */
(function () {
  'use strict';
  const colors = ['black', 'green', 'red', 'yellow'],
    cast = window.HORTrumpCast790 || {};
  const male = new Set(
    'barrel cobalt copper dice drift fang finch flint frost gable grit halo harrier hearth hollow marrow moss pike quill titan jerome dagger rafael samir marcus owen daniel'.split(
      ' '
    )
  );
  const cache = new Map(),
    history = [],
    seen = new Set();
  let previous = null,
    event = null,
    serial = 0,
    source = null;
  try {
    for (const id of JSON.parse(sessionStorage.getItem('horTrumpHeard790') || '[]')) seen.add(id);
  } catch (_) {}
  function record(type, detail = {}) {
    history.push({ type, ...detail });
    if (history.length > 80) history.shift();
  }
  function remember(id) {
    if (!id) return;
    seen.add(id);
    while (seen.size > 128) seen.delete(seen.values().next().value);
    try {
      sessionStorage.setItem('horTrumpHeard790', JSON.stringify([...seen]));
    } catch (_) {}
  }
  function voiceFor(avatar) {
    const id = String(avatar || '').toLowerCase();
    if (id === 'jerome_founder') return 'jerome';
    if (cast[id]) return id;
    return window.HORHumanAvatars?.[id]?.voice || (male.has(id) ? 'male' : 'female');
  }
  // One resolver for preview and play; preference is independent of the portrait.
  function effectiveVoice(avatar, preference, isBot = false) {
    if (preference === 'silent') return 'silent';
    const assigned = voiceFor(avatar);
    if (assigned === 'jerome') return assigned;
    if (!isBot && ['male', 'female'].includes(preference))
      return cast[assigned]?.presentation === preference ? assigned : preference;
    return assigned;
  }
  function assetPath(voice, color) {
    if (!colors.includes(color) || voice === 'silent') return null;
    if (cast[voice]) return cast[voice].colors[color];
    if (voice === 'jerome') return 'voices/jerome/trumps_are_' + color + '.ogg';
    return ['male', 'female'].includes(voice)
      ? 'assets/trump-voice/' + voice + '-' + color + '.wav'
      : null;
  }

  function allowed(preview = false) {
    return (
      !document.hidden &&
      (preview || document.body.classList.contains('in-game')) &&
      typeof soundMuted !== 'undefined' &&
      !soundMuted &&
      window.HORAudioMixer.voicesAllowed()
    );
  }
  function stop(reason) {
    serial++;
    event = null;
    if (source) {
      try {
        source.stop();
      } catch (_) {}
      source = null;
    }
    record('stop', { reason });
  }
  function load(voice, color, selectedPath) {
    const path = selectedPath || assetPath(voice, color);
    if (!path) return Promise.resolve(null);
    if (cache.has(path)) {
      const hit = cache.get(path);
      cache.delete(path);
      cache.set(path, hit);
      return hit;
    }
    const promise = fetch(path)
      .then((r) => {
        if (!r.ok) throw Error('voice asset ' + r.status);
        return r.arrayBuffer();
      })
      .then((b) => ensureAudio().decodeAudioData(b))
      .catch(() => {
        if (cache.get(path) === promise) cache.delete(path);
        record('load-failed', { path });
        return null;
      });
    cache.set(path, promise);
    while (cache.size > 24) cache.delete(cache.keys().next().value);
    return promise;
  }
  function warm(voice) {
    if (voice !== 'silent') for (const color of colors) load(voice, color);
  }
  function preload() {
    try {
      warm(effectiveVoice(ensurePreferredAvatar(), loadPreferredVoice()));
    } catch (_) {}
  }
  function playerVoice(p, avatars) {
    const avatar = avatars?.[p.id] || p.avatar || 'rookling';
    return { avatar, voice: effectiveVoice(avatar, p.voice, !!p.isBot) };
  }
  function warmTable(g, avatars) {
    for (const p of g.players || []) if (p) warm(playerVoice(p, avatars).voice);
  }
  async function announce(e, isPreview = false) {
    const token = serial,
      requested = performance.now();
    if (!allowed(isPreview)) {
      record('suppressed', { reason: 'sound-settings', color: e.color });
      return false;
    }
    const selectedPath = window.HORJeromeVoiceLines?.resolve(e.voice, 'trump', e.color);
    const buffer = await load(e.voice, e.color, selectedPath);
    const current = () =>
      buffer &&
      token === serial &&
      event === e &&
      allowed(isPreview) &&
      performance.now() - requested < 8000;
    if (!current()) return false;
    return new Promise((resolve) => {
      let started = false;
      const timeout = setTimeout(() => resolve(false), 8000);
      const handle = window.HORVoiceQueue.enqueueBuffer(buffer, {
        id: e.id || 'trump-preview',
        owner: 'trump',
        gain: 0.8,
        valid: current,
        onStart: () => {
          started = true;
          clearTimeout(timeout);
          record(isPreview ? 'preview' : 'played', {
            id: e.id,
            color: e.color,
            voice: e.voice,
            avatar: e.avatar,
            chooser: e.chooser,
            path: selectedPath || assetPath(e.voice, e.color),
          });
          resolve(true);
        },
        onEnd: () => {
          if (source === handle) source = null;
          if (!started) {
            clearTimeout(timeout);
            resolve(false);
          }
        },
      });
      source = handle;
    });
  }
  function chosen(g, avatars) {
    const id = g?.trumpVoiceEvent790,
      p = g?.players?.[g.bidder];
    if (!id || seen.has(id) || g.phase !== 'play' || !p || !colors.includes(g.trump)) return;
    remember(id);
    stop('new-choice');
    event = { id, color: g.trump, chooser: g.bidder, ...playerVoice(p, avatars) };
    if (event.voice !== 'silent') announce(event);
    else record('suppressed', { reason: 'player-silent', id, color: g.trump });
  }
  function sync(g, avatars) {
    if (!g || !document.body.classList.contains('in-game')) {
      stop('no-game');
      previous = null;
      return;
    }
    if (['bidding', 'discard', 'trump'].includes(g.phase)) {
      const tableKey = (g.players || [])
        .map((p) => p && Object.values(playerVoice(p, avatars)).join(':'))
        .join('|');
      if (previous?.tableKey !== tableKey) warmTable(g, avatars);
      if (event) stop('phase-change');
      previous = { phase: g.phase, tableKey };
      return;
    }
    if (g.phase === 'play' && g.trumpVoiceEvent790) {
      // Restore/initial snapshots are quiet. Replayed UI cannot recreate an event.
      if (g.trumpVoiceRestore790 || !previous) remember(g.trumpVoiceEvent790);
      else if (previous.phase === 'trump') chosen(g, avatars);
    }
    if (!allowed() && source) stop('muted-or-hidden');
    if (g.phase !== 'play' && event) stop('phase-change');
    previous = { phase: g.phase, tableKey: previous?.tableKey };
  }
  function preview(avatar, preference) {
    stop('preview');
    const voice = effectiveVoice(avatar, preference);
    if (voice === 'silent') return Promise.resolve(false);
    event = { voice, avatar, color: 'red' };
    return announce(event, true);
  }
  addEventListener('pagehide', () => {
    stop('pagehide');
    previous = null;
  });
  document.addEventListener('pointerdown', preload, { once: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop('hidden');
  });
  new MutationObserver(() => {
    if (!document.body.classList.contains('in-game')) {
      if (event?.id) stop('left-table');
      previous = null;
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.HORTrumpVoice = {
    sync,
    chosen,
    stop,
    preload,
    preview,
    effectiveVoice,
    voiceFor,
    assetPath,
    getState: () => ({ event, playing: !!source, cacheSize: cache.size, history: history.slice() }),
  };
})();

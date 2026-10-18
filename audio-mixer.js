/* Shared output controls. Existing per-sound envelopes and ambient balance are retained. */
(function () {
  'use strict';
  const KEY = 'horAudioMixerV1';
  const defaults = {
    master: 1,
    voices: 0.7,
    gameplay: 1,
    character: 1,
    atmosphere: 1,
    voicesMuted: false,
  };
  const levels = { ...defaults };
  let masterMuted = false;
  try {
    masterMuted = localStorage.getItem('rookMuted') === '1';
  } catch (_) {}
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k of Object.keys(defaults)) {
      if (k === 'voicesMuted') {
        levels[k] = saved[k] === true;
        continue;
      }
      if (typeof saved[k] === 'number' && Number.isFinite(saved[k]))
        levels[k] = Math.max(0, Math.min(1, saved[k]));
    }
  } catch (_) {}
  const contexts = new Map();
  const channel = (c) => (['voices', 'character', 'atmosphere'].includes(c) ? c : 'gameplay');
  const level = (c) =>
    c === 'master' && masterMuted ? 0 : c === 'voices' && levels.voicesMuted ? 0 : (levels[c] ?? 1);
  function ramp(ctx, node, value) {
    node.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
  }
  function output(ctx, category = 'gameplay') {
    let buses = contexts.get(ctx);
    if (!buses) {
      const master = ctx.createGain();
      master.gain.value = level('master');
      master.connect(ctx.destination);
      buses = { master };
      contexts.set(ctx, buses);
    }
    const key = channel(category);
    if (!buses[key]) {
      const bus = ctx.createGain();
      bus.gain.value = level(key);
      bus.connect(buses.master);
      buses[key] = bus;
    }
    return buses[key];
  }
  function set(key, value) {
    if (!(key in defaults)) return;
    if (key === 'voicesMuted') levels[key] = !!value;
    else {
      if (!Number.isFinite(Number(value))) return;
      levels[key] = Math.max(0, Math.min(1, Number(value)));
    }
    for (const [ctx, buses] of contexts) {
      if (ctx.state === 'closed') {
        contexts.delete(ctx);
        continue;
      }
      for (const [name, node] of Object.entries(buses)) ramp(ctx, node, level(name));
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(levels));
    } catch (_) {}
    if (!level('voices') || !level('master')) {
      window.HORBidVoice801?.stop();
      window.HORTrumpVoice?.stop('voice-volume-off');
    }
    renderValues();
  }
  // Global mute changes output gain only; saved per-channel preferences stay intact.
  function setMuted(value) {
    masterMuted = !!value;
    for (const [ctx, buses] of contexts) {
      if (ctx.state === 'closed') {
        contexts.delete(ctx);
        continue;
      }
      ramp(ctx, buses.master, level('master'));
    }
    if (masterMuted) {
      window.HORBidVoice801?.stop();
      window.HORTrumpVoice?.stop('master-muted');
    }
  }
  function renderValues() {
    const panel = document.getElementById('horAudioLevels');
    if (!panel) return;
    panel.querySelectorAll('[data-audio-level]').forEach((el) => {
      const k = el.dataset.audioLevel;
      el.value = String(Math.round(levels[k] * 100));
      panel.querySelector('[data-audio-value="' + k + '"]').textContent = el.value + '%';
    });
    panel.querySelector('[data-audio-mute]').checked = levels.voicesMuted;
  }
  function mount() {
    const host = document.querySelector('.gh-menu-sound .gh-sound-panel');
    if (!host || document.getElementById('horAudioLevels')) return;
    const panel = document.createElement('fieldset');
    panel.id = 'horAudioLevels';
    panel.innerHTML =
      '<legend>Audio levels</legend>' +
      [
        ['master', 'Master'],
        ['voices', 'Voices'],
        ['gameplay', 'Game effects'],
        ['character', 'Character effects'],
        ['atmosphere', 'Ambience'],
      ]
        .map(
          ([key, label]) =>
            '<label class="hor-audio-row" for="hor-audio-' +
            key +
            '"><span>' +
            label +
            '</span><output data-audio-value="' +
            key +
            '"></output><input id="hor-audio-' +
            key +
            '" data-audio-level="' +
            key +
            '" type="range" min="0" max="100" step="1"></label>'
        )
        .join('') +
      '<label class="hor-audio-mute"><input type="checkbox" data-audio-mute> Mute voices</label><small>Voices: bids, passes, Shoot the Moon and trump calls. Character effects: wolf howl and raven effects. Ambience: background sounds; fire and cabin controls below keep their individual balance.</small>';
    panel.addEventListener('input', (e) => {
      if (e.target.dataset.audioLevel)
        set(e.target.dataset.audioLevel, Number(e.target.value) / 100);
    });
    panel.addEventListener('change', (e) => {
      if (e.target.hasAttribute('data-audio-mute')) set('voicesMuted', e.target.checked);
    });
    host.prepend(panel);
    renderValues();
  }
  window.HORAudioMixer = {
    output,
    set,
    setMuted,
    level,
    voicesAllowed: () => level('voices') > 0 && level('master') > 0,
    settings: () => ({ ...levels }),
  };
  window.he064Volumes = levels;
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();

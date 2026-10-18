/* Confirmed Moon declaration cue. Reuses the preserved CC0 cabin wolf recording. */
(function () {
  'use strict';
  const seen = new Set();
  let source = null,
    serial = 0,
    bufferPromise = null;
  const history = [];
  try {
    for (const id of JSON.parse(sessionStorage.getItem('horMoonHeardV2') || '[]')) seen.add(id);
  } catch (_) {}
  const volume = () => {
    try {
      const v = localStorage.getItem('horMoonHowlVolumeV1');
      return v === null ? 1 : Math.max(0, Math.min(1, Number(v) / 100 || 0));
    } catch (_) {
      return 1;
    }
  };
  const allowed = () =>
    !document.hidden &&
    document.body.classList.contains('in-game') &&
    typeof soundMuted !== 'undefined' &&
    !soundMuted &&
    soundCard &&
    volume() > 0;
  function stop() {
    serial++;
    try {
      source?.stop();
    } catch (_) {}
    source = null;
  }
  function load() {
    return (
      bufferPromise ||
      (bufferPromise = fetch('assets/audio/cabin041/wolf.wav')
        .then((r) => {
          if (!r.ok) throw Error('Wolf audio unavailable');
          return r.arrayBuffer();
        })
        .then((b) => ensureAudio().decodeAudioData(b))
        .catch(() => {
          bufferPromise = null;
          return null;
        }))
    );
  }
  async function play(id) {
    if (typeof id !== 'string' || !id || seen.has(id)) return false;
    seen.add(id);
    try {
      sessionStorage.setItem('horMoonHeardV2', JSON.stringify([...seen].slice(-512)));
    } catch (_) {}
    if (!allowed()) {
      history.push({ id, status: 'muted' });
      return false;
    }
    stop();
    const token = serial,
      start = performance.now(),
      buffer = await load();
    if (!buffer || token !== serial || !allowed() || performance.now() - start > 2500) return false;
    return new Promise((resolve) => {
      const deadline = setTimeout(() => resolve(false), 2500);
      whenAudioReady((ctx) => {
        clearTimeout(deadline);
        if (performance.now() - start > 2500) {
          resolve(false);
          return;
        }
        if (token !== serial || !allowed()) {
          resolve(false);
          return;
        }
        const s = ctx.createBufferSource(),
          g = ctx.createGain();
        s.buffer = buffer;
        g.gain.value = 14 * volume();
        s.connect(g);
        g.connect(window.HORAudioMixer.output(ctx, 'character'));
        source = s;
        if (typeof presentationSounds035 !== 'undefined') presentationSounds035.add(s);
        s.onended = () => {
          if (source === s) {
            source = null;
          }
          if (typeof presentationSounds035 !== 'undefined') presentationSounds035.delete(s);
          s.disconnect();
          g.disconnect();
        };
        s.start();
        history.push({ id, status: 'played' });
        resolve(true);
      });
    });
  }
  function sync() {
    if (source && !allowed()) stop();
  }
  document.addEventListener(
    'pointerdown',
    () => {
      try {
        load();
      } catch (_) {}
    },
    { once: true, passive: true }
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  addEventListener('pagehide', stop);
  setInterval(sync, 100);
  window.HORMoonHowl = { play, stop, history, preload: load };
})();

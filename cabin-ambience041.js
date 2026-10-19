/* Cabin ambience: CC0 recordings, separate preferences, quiet real-time scheduling.
   See assets/audio/cabin041/CC0_SOURCES.txt for sources and processing. */
(() => {
  'use strict';
  const PCM = window.HORCabinSamples;

  const RATE = 12000;
  const DEFAULT_FIRE_VOLUME = 10; // A faint hint; independent of outdoor ambience.
  const saved = (key) => {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  };
  let enabled = saved('rookCabinAmbience041') !== '0';
  const stored = saved('rookCabinVolume041');
  let volume = stored === null ? 6 : Math.max(0, Math.min(100, Number(stored) || 0));
  const storedFire = saved('rookFireVolume758');
  let fireVolume =
    storedFire === null ? DEFAULT_FIRE_VOLUME : Math.max(0, Math.min(100, Number(storedFire) || 0));
  let owlsEnabled = saved('rookOwls758') !== '0';
  const defaults = {
    wind: 100,
    bird: 100,
    crickets: 100,
    owl: 100,
    wolf: 100,
    rain: 100,
    cricketRate: 1,
  };
  const settings = { ...defaults };
  try {
    const data = JSON.parse(saved('horAmbientSoundsV1') || '{}');
    for (const key of Object.keys(defaults))
      if (Number.isFinite(data[key]))
        settings[key] = Math.max(
          key === 'cricketRate' ? 0.5 : 0,
          Math.min(key === 'cricketRate' ? 2 : 100, data[key])
        );
  } catch (_) {}
  function setSound(key, value) {
    if (!(key in defaults) || !Number.isFinite(Number(value))) return;
    settings[key] = Math.max(
      key === 'cricketRate' ? 0.5 : 0,
      Math.min(key === 'cricketRate' ? 2 : 100, Number(value))
    );
    remember('horAmbientSoundsV1', JSON.stringify(settings));
    if (key === 'cricketRate') {
      stop();
      sync();
    } else sync();
  }
  const soundLevel = (name) => (name === 'fire' ? fireVolume / 100 : (settings[name] ?? 100) / 100);
  let owlDue = 0,
    owlCalls = 0,
    pageActive = true;
  let ctx = null,
    bus = null,
    unlocked = false,
    running = false,
    epoch = 0,
    rainUntil = 0,
    busyUntil = 0;
  const buffers = new Map(),
    voices = new Set(),
    timers = new Set();
  const random = (lo, hi) => lo + Math.random() * (hi - lo);
  const remember = (key, value) => {
    try {
      localStorage.setItem(key, String(value));
    } catch (_) {}
  };
  const screenVisible = () => {
    const screen = document.getElementById('game');
    return !screen || !screen.classList.contains('hidden');
  };
  const allowed = () =>
    pageActive &&
    screenVisible() &&
    enabled &&
    volume > 0 &&
    !document.hidden &&
    document.body.classList.contains('in-game') &&
    !(typeof soundMuted !== 'undefined' && soundMuted);
  function buffer(name) {
    if (buffers.has(name)) return buffers.get(name);
    const raw = atob(PCM[name]),
      b = ctx.createBuffer(1, raw.length / 2, RATE),
      out = b.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
      let v = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
      if (v >= 32768) v -= 65536;
      out[i] = v / 32768;
    }
    buffers.set(name, b);
    return b;
  }
  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }
  function voice(name, seconds = 0, loop = false, fade = 2) {
    if (!running || !allowed() || soundLevel(name) <= 0) return null;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      now = ctx.currentTime;
    source.buffer = buffer(name);
    source.loop = loop;
    source.connect(gain);
    const level = ctx.createGain();
    level.gain.value = soundLevel(name);
    gain.connect(level);
    level.connect(bus);
    const duration = seconds || source.buffer.duration;
    const f = Math.min(fade, duration / 3);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + f);
    if (seconds || !loop) {
      gain.gain.setValueAtTime(1, now + duration - f);
      gain.gain.linearRampToValueAtTime(0, now + duration);
    }
    const v = {
      name,
      source,
      gain,
      level,
      stop() {
        try {
          source.stop();
        } catch (_) {}
      },
    };
    voices.add(v);
    source.onended = () => {
      voices.delete(v);
      source.disconnect();
      gain.disconnect();
      level.disconnect();
    };
    source.start(now);
    if (seconds || !loop) source.stop(now + duration + 0.02);
    return v;
  }
  function hushWildlife() {
    for (const v of voices) {
      if (!['bird', 'wolf', 'crickets', 'owl'].includes(v.name)) continue;
      const now = ctx.currentTime;
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + 1);
      try {
        v.source.stop(now + 1.05);
      } catch (_) {}
    }
  }
  function schedule(kind, lo, hi, token) {
    const delay = (random(lo, hi) * 1000) / (kind === 'crickets' ? settings.cricketRate : 1);
    if (kind === 'owl') owlDue = Date.now() + delay;
    later(() => {
      if (token !== epoch || !running) return;
      if (!allowed()) {
        sync();
        return;
      }
      const now = ctx.currentTime;
      if (soundLevel(kind) <= 0 || (kind === 'rain' && now < rainUntil)) {
        schedule(kind, lo, hi, token);
        return;
      }
      if (kind === 'rain') {
        const duration = random(60, 120);
        rainUntil = now + duration + 15;
        busyUntil = rainUntil;
        hushWildlife();
        voice('rain', duration, true, 10);
      } else if ((kind !== 'owl' || owlsEnabled) && now >= rainUntil && now >= busyUntil) {
        const duration = kind === 'crickets' ? random(8, 15) : buffer(kind).duration;
        const started = voice(kind, duration, kind === 'crickets', kind === 'crickets' ? 3 : 0.2);
        if (kind === 'owl' && started) owlCalls++;
        busyUntil = now + duration + 15;
      }
      schedule(kind, lo, hi, token);
    }, delay);
  }
  function stop() {
    running = false;
    owlDue = 0;
    epoch++;
    timers.forEach(clearTimeout);
    timers.clear();
    rainUntil = 0;
    busyUntil = 0;
    const token = epoch,
      oldBus = bus;
    bus = null;
    if (ctx && oldBus) {
      const now = ctx.currentTime;
      oldBus.gain.cancelScheduledValues(now);
      oldBus.gain.setValueAtTime(oldBus.gain.value, now);
      oldBus.gain.linearRampToValueAtTime(0, now + 0.12);
    }
    for (const v of voices) {
      try {
        v.source.stop(ctx.currentTime + 0.13);
      } catch (_) {}
    }
    voices.clear();
    setTimeout(() => {
      if (oldBus) oldBus.disconnect();
      if (token === epoch && !running && ctx && ctx.state === 'running')
        ctx.suspend().catch(() => {});
    }, 160);
  }
  async function sync() {
    if (!allowed() || !unlocked) {
      if (running) stop();
      return;
    }
    if (running) {
      for (const v of voices)
        v.level.gain.setTargetAtTime(soundLevel(v.name), ctx.currentTime, 0.25);
      if (bus) bus.gain.setTargetAtTime(volume / 30, ctx.currentTime, 0.25);
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      ctx = ctx || new AudioCtx();
      running = true;
      const token = ++epoch;
      await ctx.resume();
      if (token !== epoch || !allowed()) {
        if (token === epoch) stop();
        return;
      }
      bus = ctx.createGain();
      bus.gain.setValueAtTime(volume / 30, ctx.currentTime);
      bus.connect(window.HORAudioMixer.output(ctx, 'atmosphere'));
      voice('fire', 0, true, 3);
      voice('wind', 0, true, 5);
      schedule('bird', 120, 240, token);
      schedule('crickets', 120, 240, token);
      schedule('owl', 900, 1800, token);
      schedule('wolf', 480, 900, token);
      schedule('rain', 1200, 2400, token);
    } catch (_) {
      stop();
    }
  }
  function controls() {
    const toggle = document.getElementById('opt-cabin-ambience');
    const slider = document.getElementById('opt-cabin-volume');
    const label = document.getElementById('cabin-volume-value');
    if (toggle) {
      toggle.checked = enabled;
      toggle.onchange = () => {
        enabled = toggle.checked;
        remember('rookCabinAmbience041', enabled ? '1' : '0');
        controls();
        sync();
      };
    }
    if (slider) {
      slider.value = String(volume);
      slider.disabled = !enabled;
      slider.oninput = () => {
        volume = Math.max(0, Math.min(100, Number(slider.value) || 0));
        remember('rookCabinVolume041', volume);
        if (label) label.textContent = volume + '%';
        sync();
      };
    }
    if (label) label.textContent = volume + '%';
    const fire = document.getElementById('opt-fire-volume'),
      fireLabel = document.getElementById('fire-volume-value');
    if (fire) {
      fire.value = String(fireVolume);
      fire.disabled = !enabled;
      fire.oninput = () => {
        fireVolume = Math.max(0, Math.min(100, Number(fire.value) || 0));
        remember('rookFireVolume758', fireVolume);
        if (fireLabel) fireLabel.textContent = fireVolume + '%';
        sync();
      };
    }
    if (fireLabel) fireLabel.textContent = fireVolume + '%';
    const owl = document.getElementById('opt-owl-ambience');
    if (owl) {
      owl.checked = owlsEnabled;
      owl.onchange = () => {
        owlsEnabled = owl.checked;
        remember('rookOwls758', owlsEnabled ? '1' : '0');
        if (!owlsEnabled) for (const v of voices) if (v.name === 'owl') v.stop();
      };
    }
  }
  window.CabinAmbience041 = {
    sync,
    stop,
    setSound,
    settings: () => ({ ...settings }),
    inspect: () => ({
      running,
      enabled,
      volume,
      fireVolume,
      owlsEnabled,
      owlDue,
      owlCalls,
      settings: { ...settings },
      timers: timers.size,
      voices: [...voices].map((v) => ({ name: v.name, level: v.level.gain.value })),
      busGain: bus?.gain.value ?? 0,
    }),
  };
  function init() {
    controls();
    document.addEventListener(
      'pointerdown',
      () => {
        unlocked = true;
        sync();
      },
      { passive: true }
    );
    document.addEventListener('keydown', () => {
      unlocked = true;
      sync();
    });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pagehide', () => {
      pageActive = false;
      stop();
    });
    window.addEventListener('pageshow', () => {
      pageActive = true;
      sync();
    });
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const screen = document.getElementById('game');
    if (screen) observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

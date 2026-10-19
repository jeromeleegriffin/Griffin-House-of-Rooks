/* Owner-approved Griffin Seal and Raven Flight presentations. Final Trick removed at owner request. */
(function () {
  'use strict';
  const ROOT = 'assets/end-hand-v12/';
  const titles = {
    seal: 'The Griffin Seal',
    raven: 'The Raven’s Flight',
  };
  let bag = [];
  let previous = null;
  let active = null;
  let pending = 0;
  const deferred = new Set();
  const seen = new Set();
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const smooth = (v) => {
    const t = clamp(v);
    return t * t * (3 - 2 * t);
  };
  function next() {
    if (!bag.length) {
      bag = ['seal', 'raven'];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag[0] === previous) [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    previous = bag.shift();
    return previous;
  }
  function safeRect() {
    if (window.HORAngleC?.active()) {
      const f = window.HORAngleC.frame();
      const top = Math.max(24, f.top + 330 * f.scale);
      const bottom = Math.min(
        innerHeight - 42,
        (window.HORLowerLayout?.handY ?? innerHeight * 0.82) - 12
      );
      return { x: innerWidth * 0.29, y: top, w: innerWidth * 0.42, h: Math.max(50, bottom - top) };
    }
    const t = document.querySelector('.table')?.getBoundingClientRect();
    if (t?.width > 0)
      return {
        x: t.left + t.width * 0.21,
        y: t.top + t.height * 0.34,
        w: t.width * 0.58,
        h: t.height * 0.36,
      };
    return {
      x: innerWidth * 0.18,
      y: innerHeight * 0.26,
      w: innerWidth * 0.64,
      h: innerHeight * 0.42,
    };
  }
  function image(src, className) {
    const el = new Image();
    el.src = ROOT + src;
    el.alt = '';
    el.className = className;
    return el;
  }
  function release() {
    const waiting = [...deferred];
    deferred.clear();
    waiting.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.error(error);
      }
    });
  }
  function clearPending() {
    clearTimeout(pending);
    pending = 0;
  }
  function prepare() {
    if (active) return;
    clearPending();
    // Career awards are recorded before the nest hold ends. Reserve their
    // presentation now so they cannot sound before the House effect starts.
    pending = setTimeout(() => {
      pending = 0;
      release();
    }, 6500);
  }
  function stop(complete = false) {
    clearPending();
    const job = active;
    if (!job) {
      release();
      return;
    }
    active = null;
    cancelAnimationFrame(job.raf);
    clearTimeout(job.deadline);
    clearInterval(job.audioMonitor);
    if (job.audio) {
      job.audio.pause();
      job.audio.removeAttribute('src');
      job.audio.load();
    }
    job.root.remove();
    document.body.classList.remove('end-hand-v12-running');
    try {
      if (complete) {
        if (!job.revealed) job.onReveal();
        job.onComplete();
      }
    } finally {
      release();
    }
  }
  function play({ key, onReveal, onComplete, reduced = false }) {
    clearPending();
    if (seen.has(key)) {
      if (!active) release();
      return false;
    }
    if (active) stop(true);
    seen.add(key);
    if (seen.size > 128) seen.delete(seen.values().next().value);
    const kind = next();
    const root = document.createElement('div');
    root.id = 'endHandEffectsV12';
    root.dataset.effect = kind;
    root.innerHTML =
      '<div class="end-hand-v12-stage"><div class="end-hand-v12-glow"></div></div><button type="button" class="end-hand-v12-skip">Skip effect</button><span class="end-hand-v12-status" role="status"></span>';
    const stage = root.querySelector('.end-hand-v12-stage');
    const glow = root.querySelector('.end-hand-v12-glow');
    const art = image(
      kind === 'raven' ? 'raven/raven-mid.png' : 'griffin/griffin-seal-master.png',
      'end-hand-v12-art ' + kind
    );
    stage.appendChild(art);
    root.querySelector('[role="status"]').textContent = titles[kind];
    document.body.appendChild(root);
    document.body.classList.add('end-hand-v12-running');
    const job = {
      root,
      onReveal,
      onComplete,
      revealed: false,
      raf: 0,
      deadline: 0,
      audioMonitor: 0,
      audio: null,
    };
    active = job;
    root.querySelector('button').onclick = () => stop(true);
    let audio;
    try {
      audio = new Audio(ROOT + 'audio/' + kind + '.wav');
      job.audio = audio;
      const volume = () => {
        const mixer = window.HORAudioMixer;
        audio.volume = 0.7 * (mixer?.level('master') ?? 1) * (mixer?.level('character') ?? 1);
      };
      volume();
      audio.play().catch(() => {}); // Mobile autoplay denial must never hold the scoreboard.
      job.audioMonitor = setInterval(volume, 40);
    } catch (_) {
      /* Visual presentation remains available without audio. */
    }
    const start = performance.now();
    function frame(now) {
      if (active !== job) return;
      const ms = now - start,
        t = clamp(ms / 2500),
        ease = smooth(t);
      const cross = smooth((ms - 2150) / 1050),
        visible = Math.min(1, t * 7) * (1 - cross);
      const r = safeRect();
      Object.assign(stage.style, {
        left: r.x + 'px',
        top: r.y + 'px',
        width: r.w + 'px',
        height: r.h + 'px',
      });
      glow.style.opacity = String((kind === 'seal' ? 0.5 : 0.12) * visible);
      art.style.opacity = String(visible);
      if (kind === 'seal')
        art.style.transform = reduced
          ? 'none'
          : `translateY(${(1 - ease) * 22}%) scale(${0.88 + 0.12 * ease})`;
      if (kind === 'raven') {
        const pose = reduced ? 'mid' : ['up', 'mid', 'down', 'mid'][Math.floor(t * 11) % 4];
        const path = ROOT + 'raven/raven-' + pose + '.png';
        if (art.getAttribute('src') !== path) art.src = path;
        art.style.transform = reduced
          ? 'none'
          : `translateX(${(ease - 0.5) * 22}%) translateY(${-Math.sin(t * Math.PI) * 8}%) scale(${0.82 + 0.14 * ease})`;
      }
      if (ms >= 2150 && !job.revealed) {
        job.revealed = true;
        onReveal();
      }
      if (ms >= 3200) {
        stop(true);
        return;
      }
      job.raf = requestAnimationFrame(frame);
    }
    // Bounded completion even if animation frames stop; ownership cleared by stop().
    job.deadline = setTimeout(() => {
      if (active === job) stop(true);
    }, 3400);
    job.raf = requestAnimationFrame(frame);
    return true;
  }
  window.HOREndHandEffectsV12 = {
    prepare,
    play,
    cancel: () => stop(),
    deferCelebration(fn) {
      if (!active && !pending) return false;
      deferred.add(fn);
      return true;
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(true);
  });
  addEventListener('pagehide', () => stop());
  new MutationObserver(() => {
    if (active && !document.body.classList.contains('in-game')) stop();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  // Warm only the approved poses; no baseline images are copied or regenerated.
  image('griffin/griffin-seal-master.png', '');
  for (const pose of ['up', 'mid', 'down']) image('raven/raven-' + pose + '.png', '');
})();

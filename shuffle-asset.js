/* Asset-only playback. No deck, RNG, hand, score, turn, or game-state access. */
(() => {
  'use strict';
  const ROOT = 'assets/signature-shuffle/',
    SIZE = 384,
    PER = 12,
    COUNT = 168,
    DURATION = 5600;
  let first = null;
  function sheet(n) {
    const src = ROOT + 'sheet-' + String(n).padStart(2, '0') + '.webp';
    return fetch(src).then((r) => {
      if (!r.ok) throw Error('shuffle asset');
      return r.blob();
    });
  }
  function firstSheet() {
    if (!first)
      first = sheet(0).catch((e) => {
        first = null;
        throw e;
      });
    return first;
  }
  firstSheet().catch(() => {});
  const poster = new Image();
  poster.src = ROOT + 'poster.png';
  class ShuffleAsset {
    constructor(canvas, { skipCornerHold = false } = {}) {
      this.skipCornerHold = skipCornerHold;
      this.canvas = canvas;
      canvas.width = canvas.height = SIZE;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.pages = new Map();
      this.pending = new Map();
      this.retryAt = new Map();
      this.closed = false;
      this.last = -1;
      this.loads = 0;
      this.misses = 0;
      this.token = 0;
      if (poster.complete && poster.naturalWidth) this.ctx.drawImage(poster, 0, 0, SIZE, SIZE);
    }
    async page(n) {
      if (this.closed) return null;
      if ((this.retryAt.get(n) || 0) > performance.now()) return null;
      if (this.pages.has(n)) return this.pages.get(n);
      if (this.pending.has(n)) return this.pending.get(n);
      const token = this.token;
      const blob = n === 0 ? firstSheet() : sheet(n);
      const p = blob
        .then((b) => {
          if (!b) throw Error('shuffle asset unavailable');
          return createImageBitmap(b);
        })
        .then((bitmap) => {
          if (this.closed || token !== this.token) {
            bitmap.close();
            return null;
          }
          this.pages.set(n, bitmap);
          this.loads++;
          // At most two decoded atlases (13.5 MiB) are retained. Each bitmap is released explicitly.
          while (this.pages.size > 2) {
            const old = this.pages.keys().next().value;
            this.pages.get(old).close();
            this.pages.delete(old);
          }
          return bitmap;
        })
        .catch(() => {
          this.retryAt.set(n, performance.now() + 1000);
          return null;
        })
        .finally(() => this.pending.delete(n));
      this.pending.set(n, p);
      return p;
    }
    frame(ms) {
      return Math.min(COUNT - 1, Math.max(0, Math.floor((ms / DURATION) * COUNT)));
    }
    paint(frame, bitmap) {
      const cell = frame % PER;
      this.ctx.clearRect(0, 0, SIZE, SIZE);
      this.ctx.drawImage(
        bitmap,
        (cell % 3) * SIZE,
        Math.floor(cell / 3) * SIZE,
        SIZE,
        SIZE,
        0,
        0,
        SIZE,
        SIZE
      );
      this.last = frame;
    }
    draw(ms) {
      const frame = this.frame(ms),
        p = Math.floor(frame / PER),
        bitmap = this.pages.get(p);
      if (bitmap) {
        if (frame !== this.last) this.paint(frame, bitmap);
      } else {
        this.misses++;
        this.page(p);
      }
      const next = this.skipCornerHold && p === 4 ? 6 : p + 1,
        threshold = this.skipCornerHold && p === 4 ? 0 : 4;
      if (frame % PER >= threshold && next < 14 && !this.pending.has(next) && !this.pages.has(next))
        this.page(next);
      return !!bitmap;
    }
    async seek(ms) {
      const f = this.frame(ms),
        b = await this.page(Math.floor(f / PER));
      if (b && !this.closed) this.paint(f, b);
    }
    close() {
      this.closed = true;
      this.token++;
      for (const b of this.pages.values()) b.close();
      this.pages.clear();
      this.ctx.clearRect(0, 0, SIZE, SIZE);
    }
    inspect() {
      return {
        frame: this.last,
        decodedPages: this.pages.size,
        decodedBytes: this.pages.size * PER * SIZE * SIZE * 4,
        loads: this.loads,
        misses: this.misses,
        closed: this.closed,
      };
    }
  }
  window.GriffinShuffleAsset = { Player: ShuffleAsset, duration: DURATION, frames: COUNT };
})();

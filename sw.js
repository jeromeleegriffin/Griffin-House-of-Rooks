/* House of Rooks service worker
 * Author: Jerome Griffin
 * Copyright (c) 2026 Jerome Griffin / Griffin House
 */
const CACHE = 'house-of-rooks-v537';
const SHELL = [
  './vendor/peerjs.min.js',
  './',
  './index.html',
  './shuffle-statistics.html',
  './rules.js',
  './rules.js?v=537',
  './bots.js',
  './bots.js?v=537',
  './game.js',
  './game.js?v=537',
  './rook510-avatars.js',
  './rook510-avatars.js?v=537',
  './rook510.css',
  './rook510.css?v=537',
  './polish.js',
  './polish.js?v=537',
  './progression.js',
  './progression.js?v=537',
  './style.css',
  './style.css?v=537',
  './hor-version.js',
  './splash-battle.png',
  './wait-nest-portrait.jpg',
  './wait-trump-portrait.jpg',
  './wait-nest-landscape.jpg',
  './wait-trump-landscape.jpg',
  './apple-touch-icon.png',
  './griffin-icon.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './manifest.json',
  './privacy.html',
  './Rook.webp',
  './Red2-card.webp',
  './Red2.webp',
  './Rook.png',
  './Red2.png',
  './icon-192.png',
  './icon-512.png',
  './kitty-wait.jpg',
  './lobby-hero.jpg',
  './lobby-hero-wide.jpg',
  './lobby-hero-port-362.jpg',
  './lobby-hero-landscape.jpg',
  './lobby-banner-land-361.jpg',
  './lobby-hero-3.jpg',
  './lobby-hero-4.jpg',
  './lobby-hero-5.jpg',
  './lobby-hero-6.jpg',
  './lobby-hero-7.jpg',
  './lobby-hero-8.jpg',
  './lobby-hero-9.jpg',
  './lobby-hero-10.jpg',
  './lobby-hero-11.jpg',
  './cardback-classic.jpg',
  './cardback-raven.jpg',
  './cardback-griffin.jpg',
  './cardback-felt.jpg',
  './cardback-crimson.jpg',
  './cardback-midnight.jpg',
  './cardback-faceoff.jpg',
  './cardback-clash.jpg',
  './cardback-aerial.jpg',
  './cardback-dive.jpg',
  './avatar-anchor.webp',
  './avatar-ash.webp',
  './avatar-barrel.webp',
  './avatar-blaze.webp',
  './avatar-bramble.webp',
  './avatar-brandy.webp',
  './avatar-cinder.webp',
  './avatar-cobalt.webp',
  './avatar-copper.webp',
  './avatar-crow.webp',
  './avatar-dagger.webp',
  './avatar-dice.webp',
  './avatar-drift.webp',
  './avatar-ember.webp',
  './avatar-emberlyn.webp',
  './avatar-fang.webp',
  './avatar-finch.webp',
  './avatar-flint.webp',
  './avatar-frost.webp',
  './avatar-gable.webp',
  './avatar-grit.webp',
  './avatar-halo.webp',
  './avatar-harrier.webp',
  './avatar-hearth.webp',
  './avatar-hollow.webp',
  './avatar-ivy.webp',
  './avatar-marrow.webp',
  './avatar-moss.webp',
  './avatar-moth.webp',
  './avatar-nettle.webp',
  './avatar-nix.webp',
  './avatar-pebble.webp',
  './avatar-pike.webp',
  './avatar-quill.webp',
  './avatar-rookery.webp',
  './avatar-sable.webp',
  './avatar-shade.webp',
  './avatar-spark.webp',
  './avatar-thistle.webp',
  './avatar-titan.webp',
  './avatar-vex.webp',
  './avatar-wager.webp',
  './avatar-willow.webp',
  './avatar-ash.svg',
  './avatar-badger.svg',
  './avatar-barrel.svg',
  './avatar-bluejay.svg',
  './avatar-bramble.svg',
  './avatar-brandy.svg',
  './avatar-cardshark.svg',
  './avatar-cinder.svg',
  './avatar-cobalt.svg',
  './avatar-cobra.svg',
  './avatar-copper.svg',
  './avatar-dagger.svg',
  './avatar-emberlyn.svg',
  './avatar-finch.svg',
  './avatar-flint.svg',
  './avatar-fox.svg',
  './avatar-gable.svg',
  './avatar-goldfinch.svg',
  './avatar-greenie.svg',
  './avatar-grit.svg',
  './avatar-grumpy.svg',
  './avatar-harrier.svg',
  './avatar-hearth.svg',
  './avatar-ivy.svg',
  './avatar-jackal.svg',
  './avatar-lynx.svg',
  './avatar-marrow.svg',
  './avatar-moss.svg',
  './avatar-moth.svg',
  './avatar-nettle.svg',
  './avatar-owl.svg',
  './avatar-pebble.svg',
  './avatar-quill.svg',
  './avatar-raven.svg',
  './avatar-rookery.svg',
  './avatar-rookling.svg',
  './avatar-sable.svg',
  './avatar-shade.svg',
  './avatar-spark.svg',
  './avatar-stag.svg',
  './avatar-thistle.svg',
  './avatar-willow.svg',
  './avatar-wolf.svg',
  './cardback-aftermath.jpg',
  './rook512-room.js','./rook512-room.js?v=537',
  './rook513.css','./rook513.css?v=537','./rook513.js','./rook513.js?v=537',
  './rook514.css','./rook514.css?v=537','./rook518-trump.css','./rook518-trump.css?v=537','./room-card-club-514.jpg','./avatar-jerome.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
function cacheLookup(request) {
  const url = new URL(request.url);
  const leaf = url.pathname.split('/').pop();
  return caches.open(CACHE).then((c) =>
    c.match(request).then((hit) => {
      if (hit) return hit;
      if (!leaf) return c.match('./index.html');
      return c.match('./' + leaf);
    })
  );
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Never let Safari boot an old cached game shell/code when online.
  // Network-first for the app's HTML/JS/CSS; cache is only an offline fallback.
  const path = url.pathname;
  const isAppAsset = /\.(html|js|css)$/.test(path) || path.endsWith('/');
  const forceFresh = url.searchParams.has('fresh') || url.searchParams.has('v');

  const isHtml = /\.html$/.test(path) || path.endsWith('/');
  if (isHtml) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => cacheLookup(e.request))
    );
    return;
  }
  if (isAppAsset || forceFresh) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok && !isHtml) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cacheLookup(e.request))
    );
    return;
  }

  e.respondWith(
    cacheLookup(e.request).then((cached) => {
      return cached || fetch(e.request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});

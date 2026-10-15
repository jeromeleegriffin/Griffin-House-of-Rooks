/* House of Rooks service worker
 * Author: Jerome Griffin
 * Copyright (c) 2026 Jerome Griffin / Griffin House
 */
const BUILD = '712';
const CACHE = 'house-of-rooks-v712';
const SHELL = [
  './',
  './index.html',
  './vendor/peerjs.min.js',
  './vendor/peerjs.min.js?v=rook044',
  './style.css?v=rook044',
  './rules.js?v=rook044',
  './game.js?v=rook044',
  './polish.js?v=rook044',
  './shuffle-statistics.html',
  './rules.js',
  './rules.js?v=712',
  './bots.js',
  './bots.js?v=712',
  './cabin-ambience041.js',
  './cabin-ambience041.js?v=041',
  './game.js',
  './game.js?v=712',
  './sol-diagnostics.js',
  './sol-diagnostics.js?v=712',
  './rook510-avatars.js',
  './rook510-avatars.js?v=712',
  './rook510.css',
  './rook510.css?v=712',
  './polish.js',
  './polish.js?v=712',
  './progression.js',
  './progression.js?v=712',
  './style.css',
  './style.css?v=712',
  './hor-version.js',
  './hor-version.js?v=712',
  './approved-bid-portrait.js?v=712',
  './approved-bid-portrait.css?v=712',
  './assets/bidbox-approved/bidbox_complete_blank.png?v=712',
  './assets/bidbox-approved/asset_map.json',
  './assets/images/wait-nest-portrait.jpg?v=712',
  './assets/images/wait-trump-portrait.jpg?v=712',
  './assets/images/wait-nest-landscape.jpg?v=712',
  './assets/images/wait-trump-landscape.jpg?v=712',
  './assets/images/splash-battle.png',
  './assets/images/wait-nest-portrait.jpg',
  './assets/images/wait-trump-portrait.jpg',
  './assets/images/wait-nest-landscape.jpg',
  './assets/images/wait-trump-landscape.jpg',
  './assets/images/apple-touch-icon.png',
  './assets/images/griffin-icon.png?v=712',
  './assets/images/cardback-griffin-clean.jpg?v=712',
  './assets/images/icon-192-maskable.png',
  './assets/images/icon-512-maskable.png',
  './manifest.json',
  './privacy.html',
  './assets/images/Rook.webp',
  './assets/images/Red2-card.webp',
  './assets/images/Red2.webp',
  './assets/images/Rook.png',
  './assets/images/Red2.png',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/kitty-wait.jpg',
  './assets/images/lobby-hero.jpg',
  './assets/images/lobby-hero-wide.jpg',
  './assets/images/lobby-hero-port-362.jpg',
  './assets/images/lobby-hero-landscape.jpg',
  './assets/images/lobby-banner-land-361.jpg',
  './assets/images/lobby-hero-3.jpg',
  './assets/images/lobby-hero-4.jpg',
  './assets/images/lobby-hero-5.jpg',
  './assets/images/lobby-hero-6.jpg',
  './assets/images/lobby-hero-7.jpg',
  './assets/images/lobby-hero-8.jpg',
  './assets/images/lobby-hero-9.jpg',
  './assets/images/lobby-hero-10.jpg',
  './assets/images/lobby-hero-11.jpg',
  './assets/images/cardback-classic.jpg',
  './assets/images/cardback-raven.jpg',
  './assets/images/cardback-griffin.jpg',
  './assets/images/cardback-felt.jpg',
  './assets/images/cardback-crimson.jpg',
  './assets/images/cardback-midnight.jpg',
  './assets/images/cardback-faceoff.jpg',
  './assets/images/cardback-clash.jpg',
  './assets/images/cardback-aerial.jpg',
  './assets/images/cardback-dive.jpg',
  './assets/images/avatar-anchor.webp',
  './assets/images/avatar-ash.webp',
  './assets/images/avatar-barrel.webp',
  './assets/images/avatar-blaze.webp',
  './assets/images/avatar-bramble.webp',
  './assets/images/avatar-brandy.webp',
  './assets/images/avatar-cinder.webp',
  './assets/images/avatar-cobalt.webp',
  './assets/images/avatar-copper.webp',
  './assets/images/avatar-crow.webp',
  './assets/images/avatar-dagger.webp',
  './assets/images/avatar-dice.webp',
  './assets/images/avatar-drift.webp',
  './assets/images/avatar-ember.webp',
  './assets/images/avatar-emberlyn.webp',
  './assets/images/avatar-fang.webp',
  './assets/images/avatar-finch.webp',
  './assets/images/avatar-flint.webp',
  './assets/images/avatar-frost.webp',
  './assets/images/avatar-gable.webp',
  './assets/images/avatar-grit.webp',
  './assets/images/avatar-halo.webp',
  './assets/images/avatar-harrier.webp',
  './assets/images/avatar-hearth.webp',
  './assets/images/avatar-hollow.webp',
  './assets/images/avatar-ivy.webp',
  './assets/images/avatar-marrow.webp',
  './assets/images/avatar-moss.webp',
  './assets/images/avatar-moth.webp',
  './assets/images/avatar-nettle.webp',
  './assets/images/avatar-nix.webp',
  './assets/images/avatar-pebble.webp',
  './assets/images/avatar-pike.webp',
  './assets/images/avatar-quill.webp',
  './assets/images/avatar-rookery.webp',
  './assets/images/avatar-sable.webp',
  './assets/images/avatar-shade.webp',
  './assets/images/avatar-spark.webp',
  './assets/images/avatar-thistle.webp',
  './assets/images/avatar-titan.webp',
  './assets/images/avatar-vex.webp',
  './assets/images/avatar-wager.webp',
  './assets/images/avatar-willow.webp',
  './assets/images/avatar-ash.svg',
  './assets/images/avatar-badger.svg',
  './assets/images/avatar-barrel.svg',
  './assets/images/avatar-bluejay.svg',
  './assets/images/avatar-bramble.svg',
  './assets/images/avatar-brandy.svg',
  './assets/images/avatar-cardshark.svg',
  './assets/images/avatar-cinder.svg',
  './assets/images/avatar-cobalt.svg',
  './assets/images/avatar-cobra.svg',
  './assets/images/avatar-copper.svg',
  './assets/images/avatar-dagger.svg',
  './assets/images/avatar-emberlyn.svg',
  './assets/images/avatar-finch.svg',
  './assets/images/avatar-flint.svg',
  './assets/images/avatar-fox.svg',
  './assets/images/avatar-gable.svg',
  './assets/images/avatar-goldfinch.svg',
  './assets/images/avatar-greenie.svg',
  './assets/images/avatar-grit.svg',
  './assets/images/avatar-grumpy.svg',
  './assets/images/avatar-harrier.svg',
  './assets/images/avatar-hearth.svg',
  './assets/images/avatar-ivy.svg',
  './assets/images/avatar-jackal.svg',
  './assets/images/avatar-lynx.svg',
  './assets/images/avatar-marrow.svg',
  './assets/images/avatar-moss.svg',
  './assets/images/avatar-moth.svg',
  './assets/images/avatar-nettle.svg',
  './assets/images/avatar-owl.svg',
  './assets/images/avatar-pebble.svg',
  './assets/images/avatar-quill.svg',
  './assets/images/avatar-raven.svg',
  './assets/images/avatar-rookery.svg',
  './assets/images/avatar-rookling.svg',
  './assets/images/avatar-sable.svg',
  './assets/images/avatar-shade.svg',
  './assets/images/avatar-spark.svg',
  './assets/images/avatar-stag.svg',
  './assets/images/avatar-thistle.svg',
  './assets/images/avatar-willow.svg',
  './assets/images/avatar-wolf.svg',
  './assets/images/cardback-aftermath.jpg',
  './rook512-room.js','./rook512-room.js?v=712',
  './rook513.css','./rook513.css?v=712','./rook513.js','./rook513.js?v=712',
  './rook514.css','./rook514.css?v=712','./rook518-trump.css','./rook518-trump.css?v=712','./assets/images/room-card-club-514.jpg','./assets/images/avatar-jerome.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => /^house-of-rooks-v\d+$/.test(k) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
function cacheLookup(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return caches.open(CACHE).then(async c => {
    const hit = await c.match(request);
    if (hit) return hit;
    if (url.pathname.endsWith('/')) return c.match(new URL('index.html', url).href);
    return c.match(url.href);
  });
}
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'HOR_BUILD_QUERY' && e.ports[0]) {
    e.ports[0].postMessage({build:BUILD, cache:CACHE});
  }
});

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

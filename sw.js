/* House of Rooks service worker
 * Author: Jerome Griffin
 * Copyright (c) 2026 Jerome Griffin / Griffin House
 */
const CACHE = 'house-of-rooks-v368';
const SHELL = [
  './',
  './index.html',
  './rules.js',
  './rules.js?v=368',
  './bots.js',
  './bots.js?v=368',
  './game.js',
  './game.js?v=368',
  './polish.js',
  './polish.js?v=368',
  './style.css',
  './style.css?v=368',
  './hor-version.js',
  './splash-battle.png',
  './wait-nest-portrait.jpg',
  './wait-trump-portrait.jpg',
  './wait-nest-landscape.jpg',
  './wait-trump-landscape.jpg',
  './apple-touch-icon.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './manifest.json',
  './vendor/peerjs.min.js',
  './privacy.html',
  './Rook.webp',
  './Red2-card.webp',
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
  './cardback-aftermath.jpg'
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
  if (leaf === 'lobby-hero-2.jpg') return Promise.resolve(undefined);
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

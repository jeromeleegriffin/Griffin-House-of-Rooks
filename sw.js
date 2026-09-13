/* House of Rooks service worker
 * Author: Jerome Griffin
 * Copyright (c) 2026 Jerome Griffin / Griffin House
 */
const CACHE = 'house-of-rooks-v201';
const SHELL = [
  './',
  './index.html',
  './rules.js',
  './rules.js?v=201',
  './bots.js',
  './bots.js?v=201',
  './game.js',
  './game.js?v=201',
  './polish.js',
  './polish.js?v=201',
  './style.css',
  './style.css?v=201',
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
  './kitty-wait.jpg'
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
  const bare = url.origin + url.pathname;
  return caches.match(request).then((hit) => {
    if (hit) return hit;
    return caches.match(bare);
  }).then((hit) => {
    if (hit) return hit;
    const leaf = url.pathname.split('/').pop();
    if (!leaf) return caches.match('./index.html');
    return caches.match('./' + leaf);
  });
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

/* House of Rooks service worker
 * Author: Jerome Griffin
 * Copyright (c) 2026 Jerome Griffin / Griffin House
 */
const CACHE = 'house-of-rooks-v512';
const SHELL = [
  './','./index.html','./vendor/peerjs.min.js','./shuffle-statistics.html',
  './rules.js','./rules.js?v=512','./bots.js','./bots.js?v=512',
  './game.js','./game.js?v=512','./rook511-avatars.js','./rook511-avatars.js?v=512',
  './rook511.css','./rook511.css?v=512','./rook512.css','./rook512.css?v=512',
  './rook512-room.js','./rook512-room.js?v=512',
  './polish.js','./polish.js?v=512','./progression.js','./progression.js?v=512',
  './style.css','./style.css?v=512',
  './hor-version.js','./room-card-club.jpg',
  './splash-battle.png','./wait-nest-portrait.jpg','./wait-trump-portrait.jpg',
  './wait-nest-landscape.jpg','./wait-trump-landscape.jpg','./apple-touch-icon.png','./griffin-icon.png',
  './icon-192-maskable.png','./icon-512-maskable.png','./manifest.json','./privacy.html',
  './Rook.webp','./Red2-card.webp','./Red2.webp','./Rook.png','./Red2.png','./icon-192.png','./icon-512.png'
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
  const path = url.pathname;
  const isAppAsset = /\.(html|js|css)$/.test(path) || path.endsWith('/');
  const forceFresh = url.searchParams.has('fresh') || url.searchParams.has('v');
  const isHtml = /\.html$/.test(path) || path.endsWith('/');
  if (isHtml) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => cacheLookup(e.request)));
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

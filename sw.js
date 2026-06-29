const CACHE = 'dnd-player-card-v3';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './favicon/site.webmanifest',
  './favicon/android-chrome-192x192.png',
  './favicon/android-chrome-512x512.png',
  './favicon/apple-touch-icon.png',
  './favicon/favicon.ico',
  './favicon/favicon-32x32.png',
  './favicon/favicon-16x16.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for same-origin assets; pass through for external (fonts, CDN)
self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

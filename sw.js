const CACHE_NAME = 'wordsmart-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/logo.svg',
  './icons/logo-16.png',
  './icons/logo-32.png',
  './icons/logo-180.png',
  './icons/logo-192.png',
  './icons/logo-512.png',
  './icons/logo-192-maskable.png',
  './icons/logo-512-maskable.png'
];

// Install the service worker and cache the necessary files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Serve cached content when offline, falling back to the network,
// and caching same-origin GET responses as they come in so new
// pages (drills opened via ?drill=N, fonts, etc.) work offline too
// after a first visit.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;

        const isSameOrigin = event.request.url.startsWith(self.location.origin);
        if (isSameOrigin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// Update the cache if a new version is detected, and take control
// of already-open tabs immediately instead of waiting for reload.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

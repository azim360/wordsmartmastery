const CACHE_NAME = 'wordsmart-cache-v5';
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

// Install the service worker, pre-cache core assets, and skip waiting immediately
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache).catch(err => console.warn('Cache addAll warning:', err)))
  );
});

// Update the cache if a new version is detected, purge all older caches (v1, v2, v3, etc.),
// and take control of already-open tabs immediately.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('[SW] Purging old cache version:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler:
// 1. Navigation / HTML requests: Network-First with Cache Fallback
//    Ensures old users always receive the latest app updates when online.
// 2. Static Assets (images, fonts, JSON): Stale-While-Revalidate
//    Ensures fast instant loads with background freshness.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Ignore Firebase API / auth calls from caching
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('identitytoolkit') ||
      url.pathname.startsWith('/api/')) {
    return;
  }

  const isNavigation = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) ||
    url.pathname.endsWith('index.html') ||
    url.pathname === '/';

  if (isNavigation) {
    // Network-First for HTML
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback to cached index.html
          return caches.match(event.request)
            .then(cached => cached || caches.match('./index.html') || caches.match('./'));
        })
    );
    return;
  }

  // Stale-While-Revalidate for other static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && isSameOrigin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => null);

      return cached || networkFetch;
    })
  );
});

// Message listener for client coordination
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_OLD_CACHES') {
    caches.keys().then(names => Promise.all(names.map(n => n !== CACHE_NAME ? caches.delete(n) : null)));
  }
});

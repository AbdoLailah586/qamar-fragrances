/* Qamar Fragrances Installable App Service Worker */
const CACHE_NAME = 'qamar-app-v2';
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/pwa/icon-192.png',
  '/pwa/icon-512.png',
  '/pwa/apple-touch-icon.png',
  '/qamar-images/626c06f2fe557fd9.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never serve stale API responses from Service Worker
  if (url.pathname.startsWith('/api/')) return;

  // App navigation: Network first with offline shell fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put('/index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cachedShell = await caches.match('/index.html');
          return cachedShell || (await caches.match('/offline.html')) || Response.error();
        })
    );
    return;
  }

  // Static images, PWA icons, and hashed Vite assets: Cache first with background refresh
  if (
    url.pathname.startsWith('/qamar-images/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/pwa/')
  ) {
    event.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});

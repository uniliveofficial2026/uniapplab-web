const CACHE_NAME = 'greedy-slot-pwa-v5';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/icon.svg'
];

function shouldBypassCache(url) {
  const path = url.pathname;
  // Never cache Vite/dev modules or app shells — stale JS caused the stretched wheel bug.
  if (
    path.startsWith('/src/') ||
    path.startsWith('/@') ||
    path.startsWith('/node_modules/') ||
    path.includes('.') && (path.endsWith('.tsx') || path.endsWith('.ts') || path.endsWith('.jsx') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.mjs')) ||
    url.searchParams.has('v') ||
    url.searchParams.has('preview') ||
    path === '/' ||
    path === '/index.html' ||
    path.endsWith('/index.html') ||
    path === '/admin' ||
    path.startsWith('/admin') ||
    path.includes('/admin')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/socket.io/') ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('chrome-extension')
  ) {
    return;
  }

  const url = new URL(event.request.url);

  // Network-first for app code so layout fixes always reach the admin iframe.
  if (shouldBypassCache(url) || url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

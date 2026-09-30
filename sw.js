const CACHE_NAME = 'cms-pwa-shell-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Online-first PWA: Firebase Auth/Firestore and all API/data requests are never cached.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});

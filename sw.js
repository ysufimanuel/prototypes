const CACHE_NAME = 'cms-pwa-shell-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Keep the service worker intentionally passive for the CMS shell.
// Firebase Auth/Firestore, API requests, the manifest, and any external
// resources must be handled directly by the browser. Intercepting every GET
// here can turn Vercel auth redirects into opaque/CORS failures.
//
// No fetch handler on purpose: the app is online-first and does not currently
// maintain an offline cache, so the browser should own every network request.

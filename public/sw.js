// Service Worker for Akash Inventory System — PWA offline support
const CACHE_NAME = 'akash-inv-v55';
const STATIC_ASSETS = ['/manifest.json'];

// Install — skip caching static assets, just activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — clean up ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Fetch — network-first for everything (only fall back to cache if offline)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.protocol === 'chrome-extension:') return;

  // Network-first — always try network, only use cache if offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

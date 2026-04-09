const CACHE_NAME = 'learnnest-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png'
];

// 1. Install Event: Saves files to the browser's cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Fetch Event: Intercepts network requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Return the cached file if found, otherwise go to the network
      return response || fetch(event.request);
    })
  );
});

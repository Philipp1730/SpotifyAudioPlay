// sw.js (Service Worker)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('my-cache').then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './styles.css',
        './script.js',
        './images/icon-192x192.png',
        './images/icon-512x512.png'
      ]).catch((error) => {
        console.error('Failed to cache resources:', error);
        // Log the URL of the failing request
        if (error.request) {
          console.error('Failing request URL:', error.request.url);
        }
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

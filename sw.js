const CACHE_NAME = 'b787-master-v3';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './output.css',
  './manifest.json',
  './alpine.js',
  './supabase.js',
  './chart.js',
  './confetti.js',
  './icon.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap'
];

// Instalación: Cachear recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

// Activación: Limpiar caches viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch: Estrategia Cache First, luego Network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en cache, devolverlo
        if (response) return response;
        // Si no, ir a la red
        return fetch(event.request);
      })
  );
});
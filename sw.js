// ============================================================
// SERVICE WORKER - Proyecto Escalafón v4
// Estrategia: Cache-first para assets, Network-first para APIs
// ============================================================
const CACHE_NAME = 'escalafon-v5';

// Assets estáticos que SÍ existen y deben cachearse
const STATIC_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/js/app.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://unpkg.com/@supabase/supabase-js@2',
  'https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js',
];

// Instalación: cachear assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // addAll falla si uno falla; usamos add individual con manejo de error
        return Promise.allSettled(
          STATIC_CACHE.map(url => cache.add(url).catch(e => console.warn('[SW] No se pudo cachear:', url, e)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activación: limpiar caches anteriores
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: estrategia según el tipo de request
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Peticiones a Supabase → Network-first (datos siempre frescos)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Todo lo demás → Cache-first, fallback a network
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
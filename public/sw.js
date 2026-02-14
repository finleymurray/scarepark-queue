const CACHE_NAME = 'immersive-core-v3';

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/icons/admin-192.png',
  '/icons/admin-512.png',
  '/icons/control-192.png',
  '/icons/control-512.png',
  '/icons/signoff-192.png',
  '/icons/signoff-512.png',
  '/logo.png',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for HTML/API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and Supabase API calls
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase')) return;

  // Next.js chunks (_next/) — network-first so deploys don't break navigation
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (images, fonts, icons, logos) — cache-first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/logos/') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages — network-first with cache fallback
  // Skip same-origin navigation requests so Next.js client-side routing works cleanly
  if (request.mode === 'navigate') {
    return;
  }
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
});

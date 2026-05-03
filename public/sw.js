const CACHE_NAME = 'vector-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Cache app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== 'osm-tiles')
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Allow the app to trigger skipWaiting via postMessage
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Network-first for navigation, cache-first for tiles, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // API requests: network-only, don't cache (they are guarded by the app)
  if (url.pathname.startsWith('/api/')) return;

  // OSM tiles: cache-first with network fallback
  if (url.hostname.match(/^[abc]\.tile\.openstreetmap\.org$/)) {
    event.respondWith(
      caches.open('osm-tiles').then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => {
            // Return a transparent 1x1 PNG tile as fallback when offline
            return new Response(
              Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)),
              { headers: { 'Content-Type': 'image/png' } }
            );
          });
        })
      )
    );
    return;
  }

  // Same-origin requests: stale-while-revalidate (cache-first, update in background)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => {
            // Network failed — return cached version or offline fallback
            if (cached) return cached;
            // For navigation requests, return cached index.html (SPA)
            if (event.request.mode === 'navigate') {
              return cache.match('/index.html').then((indexCached) => {
                if (indexCached) return indexCached;
                // Nothing in cache at all — return a minimal offline page
                return new Response(
                  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vector — Offline</title>' +
                  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
                  '<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;' +
                  'min-height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0;text-align:center}' +
                  '.c{max-width:400px;padding:2rem}h1{font-size:1.5rem}p{opacity:.7}' +
                  'button{margin-top:1rem;padding:.5rem 1.5rem;border:none;border-radius:8px;' +
                  'background:#4361ee;color:#fff;font-size:1rem;cursor:pointer}</style></head>' +
                  '<body><div class="c"><h1>📴 Vector is Offline</h1>' +
                  '<p>The app couldn\'t load because no cached version is available and there\'s no network connection.</p>' +
                  '<p>Your saved data is safe in local storage. Connect to the internet and try again.</p>' +
                  '<button onclick="location.reload()">Retry</button></div></body></html>',
                  { headers: { 'Content-Type': 'text/html' }, status: 200 }
                );
              });
            }
            return new Response('Offline', { status: 503, statusText: 'Offline' });
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // External requests: try network, fall back to cache
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(event.request).then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }).catch(() => cache.match(event.request).then((cached) =>
        cached || new Response('Offline', { status: 503, statusText: 'Offline' })
      ))
    )
  );
});

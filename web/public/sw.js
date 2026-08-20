const CACHE_NAME = 'meridianed-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.jpg',
  '/manifest.json',
];

// API routes that can be cached for offline use (read-only)
const CACHEABLE_API_PATTERNS = [
  '/api/v1/analytics/kpi/',
  '/api/v1/portal/',
  '/api/v1/portal',
  '/api/v1/attendance',
  '/api/v1/grades/report-card',
  '/api/v1/deped-forms/sf1',
  '/api/v1/deped-forms/sf5',
  '/api/v1/deped-forms/sf6',
  '/api/v1/deped-forms/sf10',
  '/api/v1/competency-tracker/scores',
  '/api/v1/competency-tracker/student-summary',
  '/api/v1/enrollments',
  '/api/v1/announcements',
  '/api/v1/assignments/list',
  '/api/v1/certifications',
];

function isCacheableApi(url) {
  return CACHEABLE_API_PATTERNS.some((p) => url.includes(p));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // API requests — stale-while-revalidate for cacheable reads
  if (request.url.includes('/api/')) {
    if (isCacheableApi(request.url)) {
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
          cache.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            }).catch(() => cached || new Response(JSON.stringify({ offline: true, cached: false }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }));
            return cached || fetchPromise;
          })
        )
      );
      return;
    }
    // Non-cacheable API calls (writes) — network only
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    );
    return;
  }

  const url = new URL(request.url);
  const isStaticAsset = url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff');

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // HTML/navigation — stale-while-revalidate (shell works offline)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => cached || caches.match('/index.html'));
        return cached || fetchPromise;
      })
    )
  );
});

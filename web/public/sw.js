const CACHE_VERSION = 'v4.0.1';
const CACHE_NAME = `meridianed-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.jpg',
  '/manifest.json',
];

// API routes that can be cached for offline use (read-only, stale-while-revalidate)
// These are read-only endpoints where stale data is acceptable for offline viewing
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

// API patterns that should NEVER be cached (mutating operations)
const NON_CACHEABLE_API_PATTERNS = [
  '/api/v1/auth/',
  '/api/v1/assignments/',
  '/api/v1/attendance/',
  '/api/v1/grades/',
  '/api/v1/enrollments/',
  '/api/v1/submissions/',
  '/api/v1/deped-forms/',
  '/api/v1/users/',
  '/api/v1/students/',
  '/api/v1/teachers/',
  '/api/v1/sections/',
  '/api/v1/schedule/',
  '/api/v1/conduct/',
  '/api/v1/interventions/',
  '/api/v1/mfa/',
  '/api/v1/privacy/',
  '/api/v1/uploads/',
  '/api/v1/push/',
  '/api/v1/ai/',
];

function isCacheableApi(url) {
  // First check if it's a non-cacheable pattern
  if (NON_CACHEABLE_API_PATTERNS.some((p) => url.includes(p))) {
    return false;
  }
  // Then check if it's a cacheable pattern
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

  const url = new URL(request.url);
  const isStaticAsset = url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff');

  // API requests
  if (url.pathname.startsWith('/api/')) {
    if (isCacheableApi(url.pathname)) {
      // Stale-while-revalidate for read-only cacheable APIs
      event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
          cache.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
              if (response && response.status === 200) {
                // Only cache successful responses
                cache.put(request, response.clone());
              }
              return response;
            }).catch(() => {
              if (cached) return cached;
              return new Response(JSON.stringify({ offline: true, cached: false, message: 'Network unavailable and no cached data' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              });
            });
            return cached || fetchPromise;
          })
        )
      );
      return;
    }
    // Non-cacheable API calls (writes) — network only with offline fallback
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ 
        offline: true, 
        error: 'Network unavailable. Write operations require online connection.' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    );
    return;
  }

  // Static assets - cache-first with background update
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

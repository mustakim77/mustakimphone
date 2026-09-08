// ==========================================
// SERVICE WORKER - MUSTAKIM PHONE PWA
// ==========================================
const CACHE_NAME = 'mustakimphone-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/manifest.json'
];

// Install: cache semua aset statis
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: hapus cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network First untuk API, Cache First untuk aset statis
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET dan request ke Supabase (selalu fresh dari network)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('postimg.cc')) return;

  // Strategi: Network First dengan fallback ke cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Simpan response ke cache jika sukses
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        // Offline: ambil dari cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback halaman offline untuk navigasi
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

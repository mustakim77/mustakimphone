// ==========================================
// SERVICE WORKER - MUSTAKIM PHONE PWA
// ==========================================
const CACHE_NAME = 'mustakimphone-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './manifest.json'
];

// Install: cache semua aset statis dengan penanganan error per item
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[SW] Caching static assets');
      await Promise.allSettled(
        STATIC_ASSETS.map(asset => cache.add(asset).catch(err => console.warn('[SW] Gagal cache asset:', asset, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: hapus cache versi lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network First untuk data dinamis, Cache First / Stale-While-Revalidate untuk aset statis
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET dan request ke Supabase API (selalu fresh dari network)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;

  // Strategi: Network First dengan fallback ke Cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Simpan response ke cache jika sukses (status 200)
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => {
        // Mode offline: ambil dari cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback halaman utama untuk permintaan dokumen/halaman navigasi
          if (event.request.destination === 'document' || event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('/index.html');
          }
          return new Response('Offline: Konten tidak tersedia tanpa internet.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

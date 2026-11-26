/* GTG Fitness trainer app: service worker.
 * - Pre-caches the trainer pages so the app opens instantly and works offline.
 * - Pages: network first (so edits show up), falling back to the cached copy, then offline.html.
 * - Styles / scripts / images / fonts: cached copy first, refreshed in the background.
 * Bump CACHE_VERSION whenever you change a file in PRECACHE.
 */
const CACHE_VERSION = 'gtg-trainer-v5';
const PRECACHE = [
  'trainerdashboard.html', 'trainercalendar.html', 'trainermyschedule.html',
  'trainerprogress.html', 'traineravailability.html', 'edit-profile-trainer.html', 'offline.html',
  'app.css', 'responsive.css', 'edit-profile.css', 'trainer.css',
  'trainer-availability.js', 'measurement.js', 'trainer.js', 'pwa.js', 'shell.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  // Never cache the database (Supabase) or any other site: always ask the network
  if (url.origin !== self.location.origin) return;
  // Always fetch the database settings and connector fresh
  if (/\/(supabase-config|gtg-db)\.js$/.test(url.pathname)) return;

  // Page loads
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('offline.html')))
    );
    return;
  }

  // Everything else (css, js, images, fonts, even from other sites): cached copy first, refresh in the background
  event.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
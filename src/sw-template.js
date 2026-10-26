/* global __SW_PRECACHE__ */
// Service worker template. vite.config.js fills in the version and the list of built files
// and emits it as /sw.js, so every deploy precaches the whole app for offline use.

const VERSION = '__SW_VERSION__';
const PRECACHE = __SW_PRECACHE__;
const APP_CACHE = `devtools-app-${VERSION}`;
const RUNTIME_CACHE = 'devtools-runtime';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// Servers often send "Vary: Origin"; module scripts carry an Origin header while precache
// requests don't, so a strict match would miss and fail offline
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      // Cache individually so one failed file doesn't abort the whole install
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('devtools-app-') && k !== APP_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Pages: network first so deploys show up immediately, cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html', MATCH).then((r) => r || caches.match('/', MATCH)))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  // Hashed build assets never change: cache first
  if (sameOrigin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request, MATCH).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }))
    );
    return;
  }

  // Everything else (fonts, icons, manifest): stale while revalidate
  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) =>
      cache.match(request, MATCH).then((hit) => {
        const network = fetch(request)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    )
  );
});

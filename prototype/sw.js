/* Magic Quill — service worker (offline support + installable PWA).
 *
 * Strategy:
 *  - Precache the whole app shell on install (it is tiny, ~200 KB).
 *  - Same-origin GETs: NETWORK-FIRST, falling back to cache. This keeps the
 *    game fresh after a grown-up re-uploads new files, while still working with
 *    no internet. Navigations fall back to the cached index.html when offline.
 *  - Cross-origin GETs (the Google font): CACHE-FIRST, best-effort — so after the
 *    first online visit the font is available offline too.
 *
 * To force every device to refresh after a deploy, bump CACHE_VERSION below.
 */
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'mq-cache-' + CACHE_VERSION;

const PRECACHE = [
  './',
  'index.html',
  'replay.html',
  'manifest.webmanifest',
  'icon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'css/game.css',
  'css/fonts.css',
  'fonts/baloo2-500-latin.woff2',
  'fonts/baloo2-500-latin-ext.woff2',
  'fonts/baloo2-700-latin.woff2',
  'fonts/baloo2-700-latin-ext.woff2',
  'fonts/baloo2-800-latin.woff2',
  'fonts/baloo2-800-latin-ext.woff2',
  'js/letters.js',
  'js/words.js',
  'js/topics.js',
  'js/adventures.js',
  'js/tracer.js',
  'js/freehand.js',
  'js/narrator.js',
  'js/sounds.js',
  'js/unicorn.js',
  'js/game.js',
  'js/replay.js',
  'js/topics-editor.js',
  'js/adventures-editor.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // ignore individual precache misses so one 404 can't abort the install
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // network-first: fresh when online, cached when not
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) =>
            hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())
          )
        )
    );
    return;
  }

  // cross-origin (Google font): cache-first, fill the cache in the background
  event.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit || Response.error())
    )
  );
});

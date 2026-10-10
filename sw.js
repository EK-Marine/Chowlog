// ChowLog service worker. Every GitHub Pages app on your account shares one web address
// (yourname.github.io), so everything here is namespaced with APP_ID and never touches other apps' data.
const APP_ID = 'chowlog';
const VERSION = 41; // bump this when you change any app file so phones pick up the update
const CACHE = `${APP_ID}-v${VERSION}`;
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const precache = () => caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))));

self.addEventListener('install', e => {
  // cache:'reload' skips the browser's HTTP cache so a new version never precaches stale files.
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // Remove only ChowLog's own old versions; other apps' caches are left alone.
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(APP_ID + '-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Self-heal: if another app on the same address cleared ChowLog's cache, rebuild it the next time ChowLog opens online.
self.addEventListener('message', e => {
  if (e.data === 'heal') e.waitUntil(caches.has(CACHE).then(ok => ok ? null : precache()).catch(() => {}));
});

// Serve from cache instantly (works with zero signal), refresh the cache in the background.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never touch API / food-database calls
  if (!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return; // only ChowLog's own files
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req.url, { cache: 'no-cache' })
      .then(r => { if (r.ok) cache.put(req, r.clone()); return r; })
      .catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const r = await net;
    if (r) return r;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});

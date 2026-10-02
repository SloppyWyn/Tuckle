/* Offline play. The page is one file, so keeping it (plus the manifest, the icons and the two web fonts) is enough to
   play without a connection once it has loaded.
   - The page: network first, so a new build arrives as soon as there's a connection (the page's own update check then
     reloads it on the menus); if the network fails or hangs for 4 s, the last good copy is served.
   - version.json: always the network (it only matters when online; the page ignores a failed check).
   - Fonts (Google Fonts CSS and font files) and the icons: from the cache, refreshed in the background. */
const CACHE = 'tuckle-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const timeout = (ms, p) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v) }, e => { clearTimeout(t); no(e) }) });

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.pathname.endsWith('/version.json')) return; // straight to the network
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('/index.html'))) {
    e.respondWith(timeout(4000, fetch(req)).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)) }
      return res;
    }).catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (font || url.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res }).catch(() => hit);
      return hit || net;
    })));
  }
});

// Flux Mobile works offline: the app itself is kept on the device (your videos are already stored on the device)
const CACHE = 'flux-lite-v2';
const FILES = ['/lite/', '/lite/index.html', '/lite/manifest.webmanifest', '/lite/icon-192.png', '/lite/icon-512.png', '/lite/app.js', '/lite/app.css', '/lite/shared.js', '/lite/asr-worker.js', '/fonts/fonts.css'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  // newest version when online, saved copy when offline
  e.respondWith(fetch(e.request).then((r) => { if (r.ok && (u.pathname.startsWith('/lite/') || u.pathname.startsWith('/fonts/'))) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('/lite/'))));
});

// オフラインでも遊べるように：いつもは最新を取りにいき、取れないときだけ前に取ったものを返す
const CACHE = 'kabe-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin) && !req.url.includes('fonts.g')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url.split('?')[0], copy)); }
    return res;
  }).catch(() => caches.match(req.url.split('?')[0]).then(r => r || caches.match('./'))));
});

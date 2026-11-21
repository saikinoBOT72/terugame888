// オフラインでも遊べるように：いつもは最新を取りにいき、取れないときだけ前に取ったものを返す
// 自分のファイルは毎回サーバーに確かめる（GitHub Pages は10分の控えを許すので、古い版が出ないように）
// 控えは ?v= ごと覚える（取れなかったときに、新しい index.html へ古い bundle.js が混ざらないように）。ページ（index.html・versus.html など）だけは ? を外して覚える
const CACHE = 'kabe-v2';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const keyOf = req => req.mode === 'navigate' ? req.url.split('?')[0] : req.url;
self.addEventListener('fetch', e => {
  const req = e.request, same = req.url.startsWith(self.location.origin);
  if (req.method !== 'GET' || !same && !req.url.includes('fonts.g')) return;
  const key = keyOf(req);
  e.respondWith(fetch(same ? new Request(req, { cache: 'no-cache' }) : req).then(res => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone(), path = key.split('?')[0];
      caches.open(CACHE).then(async c => {
        if (same && key !== path) for (const k of await c.keys()) if (k.url !== key && k.url.split('?')[0] === path) c.delete(k);   // 同じファイルの古い版は捨てる
        c.put(key, copy);
      });
    }
    return res;
  }).catch(() => caches.match(key).then(r => r || (req.mode === 'navigate' ? caches.match(self.registration.scope) : Response.error()))));
});

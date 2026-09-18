/* Povećajte VERSION pri svakom objavljivanju nove verzije aplikacije. */
const VERSION = 'v5';
const CORE = `dinamo-core-${VERSION}`;
const RUNTIME = `dinamo-runtime-${VERSION}`;
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest',
  'content/text.json', 'content/teams.json', 'content/news.json', 'content/season.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![CORE, RUNTIME].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Admin panel se ne dira
  if (url.origin === location.origin && url.pathname.startsWith('/admin')) return;

  // Sadržaj (content/*.json): mreža prvo, da izmjene stignu odmah
  if (url.origin === location.origin && url.pathname.includes('/content/')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Stranica: mreža prvo, uz rezervu iz predmemorije (radi bez interneta)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CORE).then(c => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }

  // Ostalo (ikone, fontovi, podaci): predmemorija odmah, osvježi u pozadini
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(RUNTIME).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});

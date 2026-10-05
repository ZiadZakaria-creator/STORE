/* sw.js — PWA. زوّد VERSION مع كل تغيير في الملفات علشان العملاء ياخدوا النسخة الجديدة. */
const VERSION = 'v1';
const CACHE = 'store-' + VERSION;

const CORE = [
  './', 'index.html', '404.html', 'manifest.webmanifest', 'firebase-config.js',
  'assets/css/tokens.css', 'assets/css/base.css', 'assets/css/components.css', 'assets/css/store.css',
  'assets/img/icon.svg',
  'js/core/boot.js', 'js/core/core.js', 'js/core/config.js', 'js/core/i18n.js', 'js/core/money.js',
  'js/core/validate.js', 'js/core/db.js', 'js/core/db-demo.js', 'js/core/db-firebase.js',
  'data/demo-data.js',
  'js/services/governorates.js', 'js/services/settings.js', 'js/services/catalog.js', 'js/services/images.js',
  'js/ui/icons.js', 'js/ui/common.js', 'js/ui/product-card.js',
  'js/pages/home.js', 'js/pages/notfound.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('store-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firestore و Firebase و أي API: من الشبكة دايماً
  if (url.origin !== self.location.origin) return;
  // اللوحة متتخزنش
  if (url.pathname.includes('/admin/')) return;

  // صفحات HTML: الشبكة الأول (علشان التحديثات)، والكاش لو مفيش نت
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // باقي الملفات: الكاش الأول، والشبكة لو مش موجودة
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});

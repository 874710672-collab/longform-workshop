/* sw.js — 网络优先，离线可读
   改版本号即可强制清旧缓存（每次部署改 CACHE 数字 + index.html 里的 ?v=）
*/
const CACHE = 'longform-v1';
const ASSETS = [
  './',
  './index.html',
  './lf-store.js',
  './lf-compat.js',
  './api.js',
  './check.js',
  './lf-prompts.js',
  './lf-tidy.js',
  './lf-engine.js',
  './lf-app1.js',
  './lf-app2.js',
  './lf-app3.js',
  './lf-app4.js',
  './lf-boot.js',
  './lf-style.css',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // 模型接口不缓存
  const u = new URL(req.url);
  if (u.pathname.includes('/chat/completions')) return;

  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

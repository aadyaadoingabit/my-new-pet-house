// Lets My Pet House open offline after the first visit.
// App files: network first (so updates show up right away), cached copy when offline.
// Libraries and fonts: cached first, since they never change.
const CACHE = 'pet-house-v1';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './src/main.js', './src/world.js', './src/avatar.js', './src/style.js', './src/state.js',
  './src/panels.js', './src/ai.js', './src/optimize.js',
  './vendor/three.module.min.js', './vendor/OrbitControls.js', './vendor/OutlineEffect.js',
  './vendor/RoundedBoxGeometry.js', './vendor/BufferGeometryUtils.js', './vendor/anthropic-sdk.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !font) return; // AI and Spotify calls go straight to the network

  const cacheFirst = font || url.pathname.includes('/vendor/') || url.pathname.includes('/icons/');
  e.respondWith(caches.open(CACHE).then(async cache => {
    if (cacheFirst) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  }));
});

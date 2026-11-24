// Offline cache for the app shell. Bump CACHE when shipping changes to the cached files.
const CACHE = 'expense-tracker-v3';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icons/icon.svg',
  './src/main.js', './src/app/controller.js',
  './src/core/dates.js', './src/core/expenses.js', './src/core/budget.js',
  './src/data/config.js', './src/data/storage.js',
  './src/ui/views.js', './src/ui/format.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});

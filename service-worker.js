const CACHE_NAME = 'calendar-90-180-v2';
const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

const SHARED_KEY = './shared-backup.txt';

async function handleShareTarget(request) {
  try {
    const form = await request.formData();
    let content = '';
    const file = form.get('backup');
    if (file && typeof file !== 'string') content = await file.text();
    if (!content) content = String(form.get('text') || '');
    if (content) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(SHARED_KEY, new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
    }
  } catch (error) {
    // страница сообщит, что файл получить не удалось
  }
  return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const shareUrl = new URL('./share-target', self.registration.scope);

  if (request.method === 'POST' && new URL(request.url).pathname === shareUrl.pathname) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

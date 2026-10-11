/* Built by Vite: all URLs are relative to this worker's scope. */
const VERSION = '__VERSION__';
const ASSETS = __ASSETS__;
const PREFIX = `sonne-blocks:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const url = path => new URL(path, self.registration.scope).href;
const allowed = new Set(ASSETS.map(url));
self.addEventListener('install', event => {
  // Installation only succeeds if every required local resource is cached.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(url(path), { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const owned = (await caches.keys()).filter(key => key.startsWith(PREFIX));
    // Keep the previous cache for another still-open tab. Never delete unrelated caches.
    const old = owned.filter(key => key !== CACHE);
    await Promise.all(old.slice(0, -1).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    // Keep HTML and scripts on the same version until the user chooses to update.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url('./index.html'))) || fetch(request)));
  } else if (allowed.has(request.url)) {
    // Assets are immutable and same-origin. Preview/static hosts may send Vary: Origin;
    // module requests include Origin whereas the precache fetch does not.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  }
});

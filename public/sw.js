/* eslint-disable no-restricted-globals */
/**
 * NOVA Linux service worker.
 *
 * Strategy
 * --------
 * - Navigations: network first (so a deploy is picked up immediately), falling
 *   back to the cached shell when offline.
 * - Same-origin assets (hashed by Vite): stale-while-revalidate, because the
 *   file name changes whenever the content changes.
 * - Third-party API calls (search, weather, fonts): never cached here — the
 *   apps show their own honest failure states, and stale search results would
 *   be a lie.
 *
 * The scope is derived at runtime so the same file works on GitHub Pages
 * sub-paths and on a root deployment.
 */

/**
 * Bump on every release: the install handler deletes every cache whose name
 * does not start with this string, so a new version is what evicts the old shell
 * instead of leaving users on a stale index.html.
 */
const VERSION = 'nova-v6';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const scope = self.registration.scope;
const shellFiles = ['', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'].map(
  (file) => scope + file.replace(/^\//, ''),
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => Promise.allSettled(shellFiles.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match(`${scope}index.html`);
          if (shell) return shell;
          return caches.match(scope) || new Response('Offline', { status: 503, statusText: 'Offline' });
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

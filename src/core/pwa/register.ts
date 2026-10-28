/**
 * Service-worker registration for the installable PWA build.
 *
 * Registration only happens in production and only when the browser supports
 * it — a dev server would fight the HMR socket. Failures are silent by design:
 * the desktop must work with or without offline caching.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  const base = import.meta.env.BASE_URL || '/';
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('nova:update-ready'));
            }
          });
        });
      })
      .catch(() => {
        /* offline support is optional */
      });
  });
}

/** Ask the waiting worker to activate immediately (used by the update toast). */
export function applyServiceWorkerUpdate(): void {
  navigator.serviceWorker?.getRegistration().then((registration) => {
    registration?.waiting?.postMessage('skip-waiting');
  });
}

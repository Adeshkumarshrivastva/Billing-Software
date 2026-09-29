'use client';

import { useEffect } from 'react';

// This app is 100% local — no PWA, no offline mode, no service worker. But a
// Service Worker registered on this origin (http://localhost:3000) by some
// OTHER project you ran on the same port earlier (CRA, Vite PWA, an old Next
// experiment, ...) stays installed in the browser and keeps intercepting
// requests, serving its own stale cached HTML/CSS. That's what shows up as
// "a different page of the project with broken styling" that sometimes loads
// instead of the real app.
//
// This guard runs on every page load and evicts any such leftover: it
// unregisters every service worker for this origin and clears the Cache
// Storage. If it actually removed a worker, it reloads once (guarded against
// a loop) so the page comes back straight from the dev server, uncached.
export function LocalOnlyGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    (async () => {
      let removedWorker = false;

      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            const ok = await registration.unregister();
            removedWorker = removedWorker || ok;
          }
        }
      } catch {
        /* getRegistrations can throw in some privacy modes — ignore */
      }

      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } catch {
        /* Cache Storage unavailable — ignore */
      }

      // Only reload when a worker was genuinely killed, and only once, so a
      // controlled page becomes uncontrolled immediately without ping-ponging.
      if (removedWorker && !sessionStorage.getItem('sw-evicted')) {
        sessionStorage.setItem('sw-evicted', '1');
        window.location.reload();
      }
    })();
  }, []);

  return null;
}

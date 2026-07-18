const APP_SW_VERSION = "easypay-install-v1";

function isLegacyWorkboxCache(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const staleNames = cacheNames.filter(isLegacyWorkboxCache);
      await Promise.allSettled(staleNames.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  ),
);

// Network-only fetch handler: this enables Chrome installability without
// serving stale cached shells across the role-specific PWAs.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data === "EASYPAY_SW_VERSION") {
    event.source?.postMessage({ version: APP_SW_VERSION });
  }
});
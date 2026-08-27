// FundTracker Service Worker
const CACHE = "fundtracker-v1";
const PRECACHE = ["/dashboard", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Remove old caches
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Only handle GET requests
  if (e.request.method !== "GET") return;
  // Skip non-http(s) requests
  if (!e.request.url.startsWith("http")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache successful responses for navigation requests
        if (res.ok && e.request.mode === "navigate") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
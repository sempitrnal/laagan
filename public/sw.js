const CACHE = "laagan-v2";
const STATIC = ["/", "/manifest.json", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() };
  }
  const title = payload.title || "Laagan";
  const options = {
    body: payload.body || "New activity",
    icon: "/icon-192.svg",
    badge: "/icon-192.svg",
    data: payload.data || {},
    tag: payload.tag || "laagan",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});

function isNavigation(req) {
  return req.mode === "navigate" || req.destination === "document";
}

function isFirebase(req) {
  const url = req.url;
  return (
    url.includes("firestore.googleapis.com") ||
    url.includes("googleapis.com") ||
    url.includes("firebaseio.com")
  );
}

/* ── Network-first for HTML, cache-first for static assets ── */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (isFirebase(event.request)) return;

  // HTML pages: always fetch fresh, fall back to cache
  if (isNavigation(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((c) => c || caches.match("/")),
        ),
    );
    return;
  }

  // Static assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return res;
      });
    }),
  );
});

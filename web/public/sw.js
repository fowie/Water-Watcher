// Water-Watcher Service Worker
// Handles push notifications for deal alerts and river condition changes.
// Implements caching strategies for offline support.

const CACHE_VERSION = "ww-cache-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const OFFLINE_URL = "/offline.html";

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// ─── Install ──────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Pre-cache essential assets; ignore failures for missing files
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            // Asset may not exist yet — that's ok
          })
        )
      );
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  // Clean up old caches and claim all clients
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE && key !== API_CACHE && key.startsWith("ww-cache-")
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => clients.claim())
  );
});

// ─── Fetch — Caching Strategies ───────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip SSE connections
  if (url.pathname.startsWith("/api/sse/")) return;

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets (CSS, JS, fonts, images): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(
              (cached) =>
                cached || caches.match(OFFLINE_URL) || new Response("Offline", { status: 503 })
            )
        )
    );
    return;
  }
});

/**
 * Cache-first strategy: serve from cache, falling back to network.
 * Updates cache on network fetch for freshness.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

/**
 * Network-first strategy: try network, fall back to cache.
 * Caches successful responses.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Check if a path corresponds to a static asset.
 */
function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico|avif)$/i.test(pathname) ||
    pathname.startsWith("/_next/static/");
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Water Watcher", body: event.data.text() };
  }

  const title = data.title || "Water Watcher";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag || "water-watcher",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab if one is open at the target URL
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("activate", (event) => {
  // Claim all clients so the SW is active immediately
  event.waitUntil(clients.claim());
});

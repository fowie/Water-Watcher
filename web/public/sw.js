// Water-Watcher Service Worker
// Handles push notifications for deal alerts and river condition changes.
// No caching strategy — Next.js handles asset caching.

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

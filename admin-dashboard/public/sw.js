/* Marketplace Admin PWA service worker: push notifications + click-through. */

const CACHE = "marketplace-admin-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler makes the app installable. Network passthrough only.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "Marketplace Admin", body: event.data ? event.data.text() : "" };
  }
  const data = payload.data || {};
  const options = {
    body: payload.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    data,
    tag: data.notificationId || undefined,
  };
  event.waitUntil(self.registration.showNotification(payload.title || "Marketplace Admin", options));
});

// Map backend notification routes onto this SPA's real routes. Background
// pushes open a URL directly, so it must be a route react-router knows.
const normalizeRoute = (route) => {
  if (!route) return "/";
  if (route.startsWith("/requests/")) return route;
  if (route.startsWith("/requests")) return "/requests";
  if (route.startsWith("/order/")) return `/orders/${route.split("/").pop()}`;
  if (route.startsWith("/orders")) return "/orders";
  if (route.startsWith("/chat")) return "/chat";
  if (route.startsWith("/vendors/")) return route;
  // Admin has no per-ticket route - land on the support section.
  if (route.startsWith("/support") || route.startsWith("/disputes")) return "/support";
  return "/";
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = new URL(normalizeRoute(data.route), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "notification-click", data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => client.postMessage({ type: "push-resubscribe" }));
    })
  );
});

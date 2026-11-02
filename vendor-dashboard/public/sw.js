/* MySooq Vendor PWA service worker: push notifications + click-through. */

const CACHE = "mysooq-vendor-shell-v1";

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
    payload = { title: "MySooq Vendor", body: event.data ? event.data.text() : "" };
  }
  const data = payload.data || {};
  const options = {
    body: payload.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data,
    tag: data.notificationId || undefined,
  };
  event.waitUntil(self.registration.showNotification(payload.title || "MySooq Vendor", options));
});

// Map backend notification routes onto this SPA's real routes. Background
// pushes open a URL directly, so it must be a route react-router knows.
const normalizeRoute = (route) => {
  if (!route) return "/";
  if (route.startsWith("/vendor/orders/")) return route.replace("/vendor", "");
  if (route.startsWith("/vendor/requests/")) return route.replace("/vendor", "");
  if (route === "/vendor/orders" || route === "/orders") return "/orders";
  if (route.startsWith("/order/")) return `/orders/${route.split("/").pop()}`;
  if (route === "/vendor/requests" || route === "/requests") return "/requests";
  if (route.startsWith("/requests/")) return route;
  if (route.startsWith("/messages/")) return route;
  if (route.startsWith("/vendor/account/")) return route.replace("/vendor", "");
  if (route === "/vendor/shop" || route === "/shop") return "/shop";
  if (route === "/vendor/settings" || route === "/settings") return "/settings";
  if (route.startsWith("/support") || route.startsWith("/disputes")) return "/support";
  if (route.startsWith("/chat")) return "/messages";
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

// Ask any open window to re-register (the SW has no auth token to POST one).
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => client.postMessage({ type: "push-resubscribe" }));
    })
  );
});

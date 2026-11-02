/**
 * Web Push registration (PWA only). Native uses FCM via registerPushToken().
 *
 * Subscribes the browser's ServiceWorker PushManager using the backend's VAPID
 * public key (GET /push/public-key) and persists the subscription
 * (POST /push/subscribe). Called from notifications.registerPushToken on web,
 * which is itself invoked from authSlice on login/refresh - so no UI change.
 *
 * Imported dynamically (so this web-only module never loads in the native
 * bundle); every browser-API access is feature-detected and failure-tolerant.
 */
import api from "./api";
import { captureError } from "./sentry";

// VAPID keys are base64url; the PushManager wants a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerWebPush() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
    return null;
  }

  // Permission must already be granted to hold a push subscription. Prompting
  // is handled by ensurePushPermission() inside a real user gesture (browsers
  // ignore/reject requestPermission outside one); never ask here.
  if (Notification.permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;

  // VAPID public key from the backend. api returns the parsed envelope body.
  let publicKey = null;
  try {
    const body = await api.get("/push/public-key");
    publicKey = body?.data?.publicKey || body?.publicKey || null;
  } catch (err) {
    captureError(err, { source: "webPushRegistration", stage: "fetchVapidKey" });
    return null;
  }
  if (!publicKey) {
    captureError(new Error("VAPID public key missing from /push/public-key"), {
      source: "webPushRegistration",
      stage: "fetchVapidKey",
    });
    return null;
  }

  // Reuse an existing subscription only when it was created with the current
  // VAPID key. After a server-side key rotation the old subscription is
  // rejected by the push service (401/403), so drop and recreate it.
  const desiredKey = urlBase64ToUint8Array(publicKey);
  const asBytes = (key) => {
    if (key instanceof ArrayBuffer) return new Uint8Array(key);
    if (ArrayBuffer.isView(key)) return new Uint8Array(key.buffer, key.byteOffset, key.byteLength);
    if (typeof key === "string") return urlBase64ToUint8Array(key);
    return null;
  };
  const sameKey = (a, b) =>
    !!a && a.length === b.length && a.every((byte, i) => byte === b[i]);

  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const currentKey = asBytes(subscription.options?.applicationServerKey);
    if (!sameKey(currentKey, desiredKey)) {
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: desiredKey,
    });
  }

  // Persist (auth header attached by the api request interceptor).
  const persist = async (sub) => {
    const json = sub.toJSON();
    await api.post("/push/subscribe", {
      endpoint: json.endpoint,
      keys: json.keys, // { p256dh, auth }
      userAgent: navigator.userAgent,
    });
  };

  try {
    await persist(subscription);
  } catch (err) {
    // The server may have pruned this endpoint (404/410) or rejected it.
    // Drop the browser subscription and recreate + persist once more so the
    // user is not stuck with a dead subscription the backend can never reach.
    captureError(err, { source: "webPushRegistration", stage: "persistSubscription" });
    try {
      await subscription.unsubscribe().catch(() => {});
    } catch (_) {}
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: desiredKey,
      });
      await persist(subscription);
    } catch (err2) {
      captureError(err2, { source: "webPushRegistration", stage: "resubscribe" });
      return null;
    }
  }
  return subscription;
}

/** Tear down the browser subscription (e.g. on logout). Best-effort. */
export async function unregisterWebPush() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const { endpoint } = subscription.toJSON();
    await api.post("/push/unsubscribe", { endpoint }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  } catch (_) {}
}

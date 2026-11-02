/**
 * Web push (browser) for the admin dashboard.
 *
 *  - registerWebPush(): subscribes this browser with the backend's VAPID key and
 *    persists the subscription (POST /push/subscribe).
 *  - ensurePush(context): shows a themed "why we need this" soft-ask before the
 *    real browser prompt. The Enable tap is the user gesture Safari requires.
 */
import { api } from '../api/client';

const SEEN_KEY = 'mysooq_admin_push_asked_v1';

export const isWebPushSupported = () =>
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  typeof Notification !== 'undefined';

// VAPID keys are base64url; PushManager wants a Uint8Array.
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
};

export async function registerWebPush(): Promise<PushSubscription | null> {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;

  let publicKey: string | null = null;
  try {
    const body: any = await api.get('/push/public-key');
    publicKey = body?.data?.publicKey || body?.publicKey || null;
  } catch (_) {
    return null;
  }
  if (!publicKey) return null;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  try {
    const json = subscription.toJSON();
    await api.post('/push/subscribe', {
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    });
  } catch (_) {
    return null;
  }
  return subscription;
}

export async function unregisterWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const { endpoint } = subscription.toJSON();
    await api.post('/push/unsubscribe', { endpoint }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  } catch (_) {}
}

// --- Soft-ask prompt controller ---
type ReasonKey = 'auto' | 'notifications' | 'support' | 'request';
type PromptPayload = { title: string; message: string; resolve: (ok: boolean) => void };

let promptHost: ((p: PromptPayload | null) => void) | null = null;

export const subscribePromptHost = (fn: (p: PromptPayload | null) => void) => {
  promptHost = fn;
  return () => {
    if (promptHost === fn) promptHost = null;
  };
};

const REASONS: Record<ReasonKey, { title: string; message: string }> = {
  auto: {
    title: 'Stay ahead of every issue',
    message:
      "Turn on notifications and we'll alert you the moment a support ticket, dispute, request or flagged order needs your attention - even when this tab is closed. You can switch this off any time.",
  },
  notifications: {
    title: 'Get alerts as they happen',
    message:
      'Enable notifications so new support tickets, disputes and requests reach you in real time instead of waiting for a refresh. You can switch this off any time.',
  },
  support: {
    title: 'Don\u2019t keep them waiting',
    message:
      'Your reply notifies the customer or vendor. Turn on notifications so you also catch their response the moment it arrives. You can switch this off any time.',
  },
  request: {
    title: 'Keep the marketplace moving',
    message:
      'Actions on requests notify the people involved. Turn on notifications so you stay on top of replies and escalations. You can switch this off any time.',
  },
};

export function requestPermissionNow(): void {
  if (!isWebPushSupported()) return;
  try {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
        .then((perm) => {
          if (perm === 'granted') registerWebPush().catch(() => {});
        })
        .catch(() => {});
    } else if (Notification.permission === 'granted') {
      registerWebPush().catch(() => {});
    }
  } catch (_) {}
}

let inFlight: Promise<boolean> | null = null;

export async function ensurePush(context: ReasonKey = 'auto'): Promise<boolean> {
  if (!isWebPushSupported()) return false;

  if (Notification.permission === 'granted') {
    registerWebPush().catch(() => {});
    return false;
  }
  if (Notification.permission === 'denied') return false;

  if (context === 'auto') {
    try {
      if (localStorage.getItem(SEEN_KEY)) return false;
      localStorage.setItem(SEEN_KEY, '1');
    } catch (_) {}
  }

  if (inFlight) return inFlight;
  if (!promptHost) return false;

  const copy = REASONS[context] || REASONS.auto;
  inFlight = new Promise<boolean>((resolve) => {
    promptHost!({ ...copy, resolve });
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

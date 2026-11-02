/**
 * Push-permission soft-ask.
 *
 * Browsers only show their native permission prompt once, and a hard "deny"
 * is effectively permanent. So instead of letting the raw prompt fire cold, we
 * explain WHY notifications matter first (a themed popup), and only call the
 * real `Notification.requestPermission()` when the user taps Enable - which is
 * also the user gesture Safari requires.
 *
 * Called from:
 *   - auto:          after login / warm start (once per install)
 *   - notifications: when the user opens the Notification Center
 *   - request:       when the customer posts a Request (pinged sellers reply)
 *   - response:      when the customer accepts a seller's offer
 *   - chats:         when the customer sends a chat message
 *
 * Native is untouched for now (Expo push is deferred): on native this simply
 * delegates to the existing registerPushToken() flow.
 */
import { Platform } from 'react-native';
import { showAlert } from '../lib/safeAlert';
import * as Store from '../lib/storage';
import { registerPushToken, getPushPermissionState } from './notifications';

const AUTO_ASKED_KEY = 'push_auto_asked_v1';
const UNSUPPORTED_TIP_KEY = 'push_unsupported_tip_v1';

export const isWebPushSupported = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  typeof Notification !== 'undefined';

const REASONS = {
  auto: {
    title: 'Never miss a thing on MySooq',
    message:
      "Turn on notifications and we'll tell you the moment a seller replies to your request, your order status changes, or you get a new message. You can switch this off any time.",
  },
  notifications: {
    title: 'Get updates without checking',
    message:
      "Enable notifications and new order updates, seller replies and messages will pop up the second they happen - even when MySooq isn't open. You can switch this off any time.",
  },
  request: {
    title: 'Get replies faster',
    message:
      "Your request is going out to nearby sellers. Turn on notifications so you know the instant someone replies and can be first to respond. You can switch this off any time.",
  },
  response: {
    title: 'Keep the seller in the loop',
    message:
      "Since you picked a seller, we'll notify them for you. Turn on notifications so you also catch their confirmation and any message they send. You can switch this off any time.",
  },
  chats: {
    title: 'Don\u2019t leave them waiting',
    message:
      "Turn on notifications so you never miss a reply to your messages - we'll alert you the moment the other person responds. You can switch this off any time.",
  },
};

let _inFlight = null;

/** Call Notification.requestPermission() synchronously inside the tap. */
const requestPermissionNow = () => {
  try {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') registerPushToken().catch(() => {});
      }).catch(() => {});
    } else if (Notification.permission === 'granted') {
      registerPushToken().catch(() => {});
    }
  } catch (_) {}
};

const ask = (copy, onEnable) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (v) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    showAlert(copy.title, copy.message, [
      { text: 'Not now', style: 'cancel', onPress: () => finish(false) },
      {
        text: 'Enable',
        onPress: () => {
          // Web: invoke the browser prompt directly in the tap handler so
          // Safari treats it as a user gesture. Native: request the OS dialog.
          try { onEnable(); } catch (_) {}
          finish(true);
        },
      },
    ]);
  });

/**
 * Ensure the user has been given a chance to enable push.
 * Resolves to true if a prompt was shown (not necessarily granted).
 */
export async function ensurePushPermission(context = 'auto') {
  if (Platform.OS !== 'web') {
    // Ask with an explanation before the OS dialog. Android only shows that
    // dialog a limited number of times and iOS once, so firing it silently at
    // login was easy to miss and impossible to recover from.
    const { status, canAskAgain } = await getPushPermissionState();

    if (status === 'granted') {
      registerPushToken().catch(() => {});
      return false;
    }
    if (!canAskAgain) {
      // The OS won't prompt again. The persistent banner and Notification
      // Settings provide the "open your settings" path instead.
      return false;
    }
    if (context === 'auto') {
      try {
        if (await Store.getItemAsync(AUTO_ASKED_KEY)) return false;
        await Store.setItemAsync(AUTO_ASKED_KEY, '1');
      } catch (_) {}
    }

    if (_inFlight) return _inFlight;
    _inFlight = ask(REASONS[context] || REASONS.auto, () => {
      registerPushToken().catch(() => {});
    }).finally(() => {
      _inFlight = null;
    });
    await _inFlight;
    return true;
  }

  // Web but browser can't do push (e.g. iOS Safari tab, not installed). Only
  // surface a helpful tip from an explicit "view notifications" intent.
  if (!isWebPushSupported()) {
    if (context === 'notifications') {
      try {
        if (!(await Store.getItemAsync(UNSUPPORTED_TIP_KEY))) {
          await Store.setItemAsync(UNSUPPORTED_TIP_KEY, '1');
          showAlert(
            'Add MySooq to your Home Screen',
            'On this device, notifications only work once MySooq is installed. Tap the Share button, choose "Add to Home Screen", then open it from there and enable notifications.',
            [{ text: 'Got it' }],
          );
        }
      } catch (_) {}
    }
    return false;
  }

  if (Notification.permission === 'granted') {
    registerPushToken().catch(() => {});
    return false;
  }
  if (Notification.permission === 'denied') {
    // Browser won't re-prompt; nothing useful to show automatically.
    return false;
  }

  // permission === 'default'
  if (context === 'auto') {
    try {
      if (await Store.getItemAsync(AUTO_ASKED_KEY)) return false;
      await Store.setItemAsync(AUTO_ASKED_KEY, '1');
    } catch (_) {}
  }

  if (_inFlight) return _inFlight;
  _inFlight = ask(REASONS[context] || REASONS.auto, requestPermissionNow).finally(() => {
    _inFlight = null;
  });
  await _inFlight;
  return true;
}

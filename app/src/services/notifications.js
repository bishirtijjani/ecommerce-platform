import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import api from './api';
import { captureError } from './sentry';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 54 presentation keys. `shouldShowAlert` is deprecated and ignored
    // when the banner/list keys are present, so we set the current API only.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Hard-coded fallback so a build where Constants.easConfig is unavailable
// (some Expo Go / misconfigured EAS builds) still resolves a project id
// instead of throwing ERR_NOTIFICATIONS_NO_EXPERIENCE_ID and silently
// leaving fcmToken null on the server.
const FALLBACK_PROJECT_ID = 'a95f02ee-b847-4b29-93db-6268b4c76d14';

const getProjectId = () =>
  Constants?.easConfig?.projectId ||
  Constants?.expoConfig?.extra?.eas?.projectId ||
  FALLBACK_PROJECT_ID;

/**
 * Current OS/browser permission state:
 *   'granted' | 'denied' | 'undetermined' | 'unsupported'
 */
export const getPushPermissionStatus = async () => {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission; // granted | denied | default
  }
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (_) {
    return 'undetermined';
  }
};

/**
 * Full permission state, including whether the OS will still show its dialog.
 * `canAskAgain` is false on iOS after a denial and on Android once the system
 * has stopped prompting - in that case the only path is the Settings app.
 */
export const getPushPermissionState = async () => {
  if (Platform.OS === 'web') {
    const supported = typeof Notification !== 'undefined';
    return {
      status: supported ? Notification.permission : 'unsupported',
      canAskAgain: supported && Notification.permission === 'default',
    };
  }
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    return { status, canAskAgain: canAskAgain !== false };
  } catch (_) {
    return { status: 'undetermined', canAskAgain: true };
  }
};

/** Open the OS app settings so a denied user can re-enable notifications. */
export const openNotificationSettings = async () => {
  if (Platform.OS === 'web') return false;
  try {
    await Linking.openSettings();
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Request notification permissions and register the FCM/APNs token with our backend.
 * Safe to call multiple times - no-ops if permission denied.
 */
export const registerPushToken = async () => {
  // On web there's no FCM/APNs - register a browser Push subscription instead.
  // Dynamic import so the web-only module never loads into the native bundle.
  if (Platform.OS === 'web') {
    try {
      const { registerWebPush } = await import('./webPush');
      return await registerWebPush();
    } catch (error) {
      console.warn('[Notifications] web push registration failed:', error?.message);
      captureError(error, { source: 'webPushRegistration' });
      return null;
    }
  }
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0B3D24',
    });
  }

  const projectId = getProjectId();

  // Try a couple of times: transient network/Expo-service hiccups are common
  // on first launch and a single failure used to leave the user unregistered
  // forever (the server then has no token and can never push to them).
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const token = (
        await Notifications.getExpoPushTokenAsync({ projectId })
      ).data;
      // Persist with a retry too - a flaky network on the POST must not drop
      // a token we successfully obtained.
      let persisted = false;
      for (let p = 1; p <= 3 && !persisted; p += 1) {
        try {
          await api.post('/auth/fcm-token', { fcmToken: token });
          persisted = true;
        } catch (err) {
          lastError = err;
          if (p < 3) await new Promise((r) => setTimeout(r, 500 * p));
        }
      }
      if (persisted) return token;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  console.warn('[Notifications] Token registration failed:', lastError?.message);
  captureError(lastError, {
    source: 'pushRegistration',
    platform: Platform.OS,
    stage: 'getExpoPushTokenAsync',
    projectId,
    hasProjectId: !!projectId,
    permission: finalStatus,
    attempts: 3,
  });
  return null;
};

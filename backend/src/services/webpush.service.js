/**
 * Web Push (VAPID) sender - the browser/PWA counterpart to FCM.
 *
 * `pushAndSocket` (notify.service) calls `sendToUser` alongside the FCM send.
 * Native devices receive FCM via `User.fcmToken`; web PWAs receive a browser
 * Push via the `PushSubscription` rows registered from `/push/subscribe`.
 *
 * Fully optional: if VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are unset (e.g. a
 * fresh dev clone), this module configures nothing and `sendToUser` is a no-op,
 * so the rest of the notification fan-out is unaffected.
 */

const webpush = require('web-push');
const { prisma } = require('../config/database');
const { config } = require('../config');
const { logger } = require('../utils/logger');

let _configured = false;
if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      config.VAPID_SUBJECT || 'mailto:hello@mysooq.ng',
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY,
    );
    _configured = true;
  } catch (err) {
    logger.warn('web-push VAPID config invalid - web push disabled', { error: err.message });
  }
}

const isConfigured = () => _configured;

/**
 * Send a push to every browser subscription a user has registered.
 * Dead endpoints (404/410) are pruned. Fire-and-forget at the call site.
 *
 * @param {string} userId
 * @param {{ title: string, body: string, data?: object }} payload
 */
const sendToUser = async (userId, { title, body, data = {} }) => {
  if (!_configured || !userId) return { sent: 0, pruned: 0, failed: 0, skipped: true };

  let subs = [];
  try {
    subs = await prisma.pushSubscription.findMany({ where: { userId } });
  } catch (err) {
    logger.warn('web push: subscription lookup failed', { userId, error: err.message });
    return { sent: 0, pruned: 0, failed: 0, error: err.message };
  }
  if (!subs.length) return { sent: 0, pruned: 0, failed: 0 };

  const payload = JSON.stringify({ title, body, data });
  let sent = 0;
  let pruned = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent += 1;
      } catch (err) {
        // 404 Not Found / 410 Gone → the browser dropped the subscription.
        if (err.statusCode === 404 || err.statusCode === 410) {
          pruned += 1;
          try {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          } catch (_) {}
          return;
        }

        failed += 1;
        // 401/403 here is almost always a VAPID mismatch: the subscription was
        // created with a different applicationServerKey (e.g. keys rotated in
        // .env) or the push service rejected our JWT.
        if (err.statusCode === 401 || err.statusCode === 403) {
          logger.warn('web push rejected - check VAPID key match', {
            userId,
            subscriptionId: sub.id,
            statusCode: err.statusCode,
            error: err.message,
          });
          return;
        }
        logger.warn('web push send failed (non-fatal)', {
          userId,
          subscriptionId: sub.id,
          statusCode: err.statusCode,
          error: err.message,
        });
      }
    }),
  );

  return { sent, pruned, failed };
};

module.exports = { isConfigured, sendToUser };

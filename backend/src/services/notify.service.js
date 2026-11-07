/**
 * Centralized notification fan-out.
 *
 * `pushAndSocket()` is the single entry point for every user-facing notification:
 *   1. Persist a Notification row (drives the in-app Notification Center).
 *   2. Emit `notification:new` to the user's socket room (live unread badge).
 *   3. Send a push (Expo or FCM, chosen by token shape) if the user has a token.
 *      Permanent token failures null out `User.fcmToken` (dead-letter).
 *
 * All order/lifecycle code must call `pushAndSocket` instead of emitting
 * sockets or invoking push helpers directly - this keeps the Notification
 * Center in sync with the tray and prevents the three-parallel-channels drift
 * that the Phase 4 audit found.
 */

const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');
const { NOTIFICATION, REQUEST, getUserRoom } = require('../sockets/events');
const notificationService = require('./notification.service');
const webpushService = require('./webpush.service');
const emailService = require('./email.service');

// Alerts a user must not miss when they have no push device at all. They get
// emailed instead, through the same SMTP transport as OTP/verification mail.
const FALLBACK_NOTIFICATION_TYPES = new Set([
  'REQUEST_PING',
  'REQUEST_ASSIGNED',
  'REQUEST_RESPONSE',
  'ORDER',
  'ORDER_STATUS',
]);
const PUBLIC_APP_URL = 'https://customer.marketplace.ng';

const sendEmailFallback = async (userId, user, { type, title, body, data }) => {
  if (!user?.email) return;
  const prefs = user.notificationPreferences;
  if (prefs && prefs.emailEnabled === false) return;

  const link = data?.route ? `${PUBLIC_APP_URL}${data.route}` : PUBLIC_APP_URL;
  try {
    await emailService.sendEmail({
      to: user.email,
      subject: title,
      text: `${body}\n\nOpen Marketplace: ${link}`,
      html: `<p>${body}</p><p><a href="${link}">Open Marketplace</a></p>`,
    });
    logger.info('Notification email fallback sent', { userId, type });
  } catch (err) {
    logger.warn('Notification email fallback failed (non-fatal)', {
      userId,
      type,
      error: err.message,
    });
  }
};

let _io = null;
const setIO = (io) => { _io = io; };
const getIO = () => _io;

// ============================================================
// Push + socket + persist fan-out
// ============================================================

/**
 * Send a notification to `userId`.
 *
 * @param {string} userId
 * @param {object} payload
 * @param {string} payload.type   ORDER_STATUS | SYSTEM | ...
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {object} [payload.data] Free-form. `data.route` (e.g. `/order/abc`)
 *                                is consumed by the mobile to deep-link on tap.
 * @param {string} [payload.orderId]
 * @param {string} [payload.transactionId]
 * @param {boolean} [payload.silent=false] If true, skips push but still persists
 *                                         + emits socket (for low-priority updates).
 */
const PUSH_ELIGIBLE_STATUSES = new Set(['ACTIVE', 'PENDING']);
// Account/security alerts must still reach a just-suspended user (they are
// often the explanation for why the app stopped working), even though normal
// order/chat notifications are suppressed for non-active accounts.
const CRITICAL_NOTIFICATION_TYPES = new Set(['ACCOUNT', 'SYSTEM']);

/**
 * Map a notification type onto the user's preference toggles. Unknown types
 * are always allowed (security/account alerts must not be silenced).
 */
const isTypeAllowed = (type, prefs) => {
  if (!prefs) return true;
  if (type === 'ORDER' || type === 'ORDER_STATUS' || type === 'ORDER_MESSAGE') {
    return prefs.orderUpdates !== false;
  }
  if (
    type === 'REQUEST_PING' ||
    type === 'REQUEST_RESPONSE' ||
    type === 'REQUEST_ASSIGNED' ||
    type === 'REQUEST_STATUS' ||
    type === 'REQUEST_EXPIRED'
  ) {
    return prefs.requestAlerts !== false;
  }
  if (type === 'PROMOTION') return prefs.promotions !== false;
  return true;
};

/**
 * Persist the outcome of a native send and dead-letter permanently invalid
 * tokens. Exported so the BullMQ worker uses the exact same logic.
 */
const handleNativePushResult = async ({ userId, fcmToken, result, type }) => {
  if (result?.code === 'INVALID_TOKEN' && fcmToken && userId) {
    try {
      await prisma.user.updateMany({ where: { id: userId, fcmToken }, data: { fcmToken: null } });
      logger.info('Cleared invalid push token', { userId, type });
    } catch (err) {
      logger.warn('Clear-invalid-token write failed', { userId, error: err.message });
    }
    return;
  }
  logger.info('Native push result', {
    userId,
    type,
    success: !!result?.success,
    code: result?.code || null,
    detail: result?.detail || null,
  });
};

/**
 * Reject a promise after `ms` so an unreachable Redis cannot leave a
 * fire-and-forget dispatch pending forever.
 */
const withTimeout = (promise, ms, label) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

/**
 * Send a native push. Preferred path is the notification queue (retries with
 * exponential backoff); if Redis/the queue is unavailable we fall back to the
 * direct send so notifications never depend on the queue being healthy.
 */
const dispatchNativePush = async ({ userId, fcmToken, notificationId, title, body, data }) => {
  if (!fcmToken) return { success: false, code: 'NO_TOKEN' };

  const payloadData = { ...data, notificationId: notificationId || '' };
  try {
    const { notificationQueue } = require('../queues');
    const { NOTIFICATION_JOBS, DEFAULT_JOB_OPTIONS } = require('../queues/jobs');
    await withTimeout(
      notificationQueue.add(
        NOTIFICATION_JOBS.SEND_PUSH,
        { userId, fcmToken, title, body, data: payloadData },
        DEFAULT_JOB_OPTIONS,
      ),
      5000,
      'Notification queue add',
    );
    logger.info('Native push enqueued', {
      userId,
      type: data?.type || null,
      token: String(fcmToken).slice(0, 18),
    });
    return { queued: true };
  } catch (err) {
    // A queue timeout can still complete in the background, so a rare duplicate
    // is possible - preferred over silently dropping the notification.
    logger.warn('Notification queue unavailable - sending native push inline', {
      userId,
      error: err.message,
    });
  }

  const result = await notificationService.sendToDevice(fcmToken, { title, body, data: payloadData });
  await handleNativePushResult({ userId, fcmToken, result, type: data?.type });
  return result;
};

const pushAndSocket = async (userId, payload) => {
  const { type, title, body, data = {}, orderId, transactionId, silent = false } = payload;

  if (!userId || !type || !title || !body) {
    logger.warn('pushAndSocket: missing required field', { userId, type, hasTitle: !!title, hasBody: !!body });
    return null;
  }

  // Single user lookup up-front - used for the status gate AND for push.
  // Skips a redundant findUnique we used to do later in the push branch.
  let user = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        fcmToken: true,
        status: true,
        deletedAt: true,
        email: true,
        phone: true,
        firstName: true,
        notificationPreferences: {
          select: {
            pushEnabled: true,
            orderUpdates: true,
            promotions: true,
            requestAlerts: true,
            emailEnabled: true,
          },
        },
      },
    });
  } catch (err) {
    logger.warn('pushAndSocket: user lookup failed (non-fatal)', { userId, error: err.message });
  }

  // Don't persist Notification rows for users that can't actually use them
  // (deleted/suspended/deactivated). Active + Pending users get full
  // treatment so OTP/verification flows aren't blocked. Account/security
  // alerts are the exception - a suspended user should be told why.
  if (
    user &&
    (user.deletedAt ||
      (!PUSH_ELIGIBLE_STATUSES.has(user.status) && !CRITICAL_NOTIFICATION_TYPES.has(type)))
  ) {
    return null;
  }

  // 1. Persist - drives the Notification Center feed + unread count.
  let row;
  try {
    row = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data,
        orderId: orderId || null,
        transactionId: transactionId || null,
      },
    });
  } catch (err) {
    logger.error('Notification persist failed', { userId, type, error: err.message });
    // Continue - socket+push are best-effort even if DB write fails.
  }

  // 2. Socket - live unread badge + Notification Center prepend.
  // _io is null when running in a worker-only process (BullMQ host without
  // an HTTP socket server); in that case the row + push still fire so the
  // user sees the notification on next foreground / via push.
  if (_io) {
    try {
      _io.to(getUserRoom(userId)).emit(NOTIFICATION.NEW, {
        id: row?.id,
        type,
        title,
        body,
        data,
        route: data.route || null,
        orderId: orderId || null,
        transactionId: transactionId || null,
        createdAt: row?.createdAt || new Date(),
      });

      // Domain-specific companion event so Request screens can react without
      // re-parsing the generic notification type. Payload carries requestId.
      const requestEvent =
        type === 'REQUEST_PING' ? REQUEST.NEW
          : type === 'REQUEST_RESPONSE' ? REQUEST.RESPONSE_NEW
            : type === 'REQUEST_ASSIGNED' ? REQUEST.ASSIGNED
              : null;
      if (requestEvent) {
        _io.to(getUserRoom(userId)).emit(requestEvent, {
          id: row?.id,
          type,
          title,
          body,
          requestId: data.requestId || null,
          route: data.route || null,
          createdAt: row?.createdAt || new Date(),
        });
      }
    } catch (err) {
      logger.warn('Socket emit failed (notification:new)', { userId, error: String(err) });
    }
  }

  // 3. Push - best-effort. Native sends go through the notification queue so
  // transient Expo/FCM failures retry with backoff; web push is sent inline
  // (one HTTP call per browser subscription).
  if (!silent && user) {
    const prefs = user.notificationPreferences;
    const pushEnabled = prefs ? prefs.pushEnabled : true;
    const typeAllowed = isTypeAllowed(type, prefs);

    if (pushEnabled && typeAllowed) {
      const pushData = {
        type,
        route: data.route || '',
        orderId: orderId || '',
        transactionId: transactionId || '',
        notificationId: row?.id || '',
        ...(data.requestId ? { requestId: String(data.requestId) } : {}),
        ...(data.conversationId ? { conversationId: String(data.conversationId) } : {}),
        ...(data.ticketId ? { ticketId: String(data.ticketId) } : {}),
        ...(data.disputeId ? { disputeId: String(data.disputeId) } : {}),
        ...(data.otp ? { otp: String(data.otp) } : {}),
        ...(data.kind ? { kind: String(data.kind) } : {}),
        ...(data.audience ? { audience: String(data.audience) } : {}),
      };

      // Web push - browser/PWA subscriptions (PushSubscription rows). Fires
      // independently of fcmToken so web-only users still get tray alerts.
      webpushService
        .sendToUser(userId, { title, body, data: pushData })
        .then((stats) => {
          if (stats?.sent) {
            logger.info('Web push delivered', {
              userId,
              type,
              sent: stats.sent,
              pruned: stats.pruned,
              failed: stats.failed,
            });
          }
        })
        .catch((err) => logger.warn('Web push delivery failed (non-fatal)', { userId, type, error: err.message }));

      // FCM / Expo (native devices) - only when a device token exists.
      if (user.fcmToken) {
        dispatchNativePush({
          userId,
          fcmToken: user.fcmToken,
          notificationId: row?.id || null,
          title,
          body,
          data: pushData,
        }).catch((err) => logger.warn('Native push dispatch failed (non-fatal)', {
          userId,
          type,
          error: err.message,
        }));
      } else {
        logger.debug('Native push skipped: no device token', { userId, type });
      }
    } else {
      logger.debug('Push suppressed by preferences', { userId, type, pushEnabled, typeAllowed });
    }

    // Fallback: this user has no device token. If they have no browser
    // subscription either, nothing would reach them, so critical alerts go by
    // email using the SMTP transport that already sends OTPs.
    if (!user.fcmToken && FALLBACK_NOTIFICATION_TYPES.has(type)) {
      let hasWebPush = false;
      try {
        hasWebPush = (await prisma.pushSubscription.count({ where: { userId } })) > 0;
      } catch (_) {}
      if (!hasWebPush) {
        sendEmailFallback(userId, user, { type, title, body, data }).catch(() => {});
      }
    }
  }

  return row;
};

// ============================================================
// Lifecycle hooks - translate domain events into user-facing notifications.
// ============================================================

const ORDER_STATUS_TEMPLATES = {
  PROCESSING: { title: 'Order confirmed', body: 'The vendor is preparing your order now.' },
  SHIPPED:    { title: 'Order shipped',   body: 'Your order is on its way.' },
  DELIVERED:  { title: 'Delivered',       body: 'Your order has been delivered. Tap to rate.' },
  CANCELLED:  { title: 'Order cancelled', body: 'Your order has been cancelled.' },
};

const resolveTemplate = (status) => ORDER_STATUS_TEMPLATES[status];

/**
 * `order` → notification for the customer, plus the vendor when the change was
 * made by someone else (customer cancellation or admin override). A vendor
 * changing their own order status must not receive a push for their own action.
 * Called from order.service.updateStatus and the worker auto-cancel.
 */
const onOrderStatusChanged = async (order, prevStatus, { actorRole } = {}) => {
  if (!order || !order.customerId) return;
  if (prevStatus === order.status) return;

  const tpl = resolveTemplate(order.status);
  if (!tpl) return; // PENDING, etc. - no notification

  await pushAndSocket(order.customerId, {
    type: 'ORDER_STATUS',
    title: tpl.title,
    body: tpl.body,
    data: { route: `/order/${order.id}`, status: order.status, audience: 'customer' },
    orderId: order.id,
  });

  if (order.vendor?.userId && actorRole !== 'VENDOR') {
    await pushAndSocket(order.vendor.userId, {
      type: 'ORDER',
      title: tpl.title,
      body: `Order update: ${tpl.body}`,
      data: { route: `/vendor/orders/${order.id}`, status: order.status, audience: 'vendor' },
      orderId: order.id,
    });
  }
};

module.exports = {
  setIO,
  getIO,
  pushAndSocket,
  onOrderStatusChanged,
  handleNativePushResult,
  isTypeAllowed,
};

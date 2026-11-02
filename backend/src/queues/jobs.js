/**
 * BullMQ job type constants and payload definitions.
 *
 * ALL job types MUST be defined here.
 * Workers consume jobs by type from the respective queues.
 *
 * NAMING: QUEUE_NAME.JOB_TYPE
 */

// --- Queue names ---
const QUEUES = {
  NOTIFICATION: 'notification-queue',
  ORDER: 'order-queue',
  REQUEST: 'request-queue',
};

// --- Job types per queue ---

const NOTIFICATION_JOBS = {
  /** Send push notification via FCM */
  SEND_PUSH: 'send-push',
  /** Send SMS via Termii */
  SEND_SMS: 'send-sms',
  /** Send OTP via Termii */
  SEND_OTP: 'send-otp',
};

const ORDER_JOBS = {};

// --- Request (reverse marketplace) jobs ---
const REQUEST_JOBS = {
  /** Ping the next batch of sellers when nobody has replied yet. */
  TOPUP: 'request-topup',
  /** Mark an open request EXPIRED once its window closes. */
  EXPIRY: 'request-expiry',
};

// --- Default job options ---
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: {
    age: 86400, // Keep completed jobs for 24h
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
  },
};

module.exports = {
  QUEUES,
  NOTIFICATION_JOBS,
  ORDER_JOBS,
  REQUEST_JOBS,
  DEFAULT_JOB_OPTIONS,
};

/**
 * Shared constants used across the entire backend.
 *
 * Import from here instead of hardcoding magic strings.
 */

// Redis key prefixes - all Redis keys MUST use these prefixes
const REDIS_KEYS = {
  OTP: "otp:", // otp:{phone}
  PENDING_REG: "pending_reg:", // pending_reg:{email}
  OTP_COOLDOWN: "otp_cooldown:", // otp_cooldown:{email} - 60s between resends
  SESSION: "session:", // session:{userId}
  RATE_LIMIT: "ratelimit:", // ratelimit:{ip}:{endpoint}
  HANDOFF: "handoff:", // handoff:{token} - one-time app->web SSO code
};

// Redis TTLs (in seconds)
const REDIS_TTL = {
  OTP: 600, // 10 minutes
  PENDING_REG: 600, // 10 minutes (same as OTP)
  OTP_COOLDOWN: 60, // 60 seconds between resend requests
  SESSION: 604800, // 7 days
  HANDOFF: 120, // 2 minutes - long enough to open the browser, short enough to be safe
  EMAIL_LINK: 604800, // 7 days - auto-login links embedded in emails (single-use)
};

// OTP settings
const OTP = {
  LENGTH: 6,
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 3,
};

// Transaction PIN
const PIN = {
  LENGTH: 6,
  MAX_ATTEMPTS: 3,
  LOCKOUT_MINUTES: 30,
};

// Pagination defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

module.exports = {
  REDIS_KEYS,
  REDIS_TTL,
  OTP,
  PIN,
  PAGINATION,
};

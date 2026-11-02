/**
 * Rate limiting middleware.
 *
 * Prevents brute-force attacks on sensitive endpoints:
 * - Login attempts
 * - OTP verification
 * - PIN verification
 * - Registration
 *
 * USAGE:
 *   const { authLimiter, otpLimiter, generalLimiter } = require('../middlewares/rate-limit.middleware');
 *   router.post('/login', authLimiter, validate(loginSchema), controller.login);
 */

const rateLimit = require('express-rate-limit');
const { ApiResponse } = require('../utils/api-response');

/**
 * Auth endpoints - 5 attempts per 2 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many login attempts. Try again in 2 minutes.'),
  keyGenerator: (req) => req.ip,
});

/**
 * Token refresh - 20 attempts per minute per IP.
 *
 * Deliberately separate from the global limiter (which /auth/refresh is exempt
 * from in app.js): a 429 on this endpoint reaches the client as a failed refresh,
 * and a failed refresh used to log the user out. 20/min is far above the real
 * rate (the client coalesces concurrent refreshes) while still capping abuse.
 */
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many refresh attempts. Try again shortly.'),
});

/**
 * OTP endpoints - 3 attempts per 2 minutes per phone number.
 */
const otpLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many OTP requests. Try again in 2 minutes.'),
  keyGenerator: (req) => req.body?.phone || req.ip,
});

/**
 * PIN verification - 3 attempts per 5 minutes.
 */
const pinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many PIN attempts. Account temporarily locked.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * General API rate limit - 100 requests per minute.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many requests. Slow down.'),
});

/**
 * Registration - 3 accounts per IP per hour.
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many registration attempts. Try again later.'),
});

/**
 * Order creation - 30 new orders per hour per authenticated user.
 *
 * Single biggest abuse vector: a compromised account or buggy client
 * dispatching hundreds of orders in a loop.
 * Per-user keying (not per-IP) is intentional: IPs are shared on mobile
 * networks and Wi-Fi, but a hijacked session is scoped to one userId.
 */
const orderCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error(
    'You\'ve placed too many orders this hour. Please wait a few minutes and try again.',
  ),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Order quote - 60 pricing quotes per 10 minutes per authenticated user.
 *
 * Cheap to compute (no external API call, unlike the old delivery-fare
 * quote), but still worth capping against a client stuck in a retry loop
 * hammering the pricing endpoint.
 */
const quoteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many quote requests. Please slow down.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Vendor callback requests - 5 per 10 minutes per IP.
 *
 * Public, unauthenticated endpoint (same trust level as the contact form),
 * so it's IP-keyed rather than user-keyed. Caps a single caller from
 * spamming a vendor's inbox with fake callback requests.
 */
const callbackRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('Too many callback requests. Please try again later.'),
});

/**
 * Chat message sending - 60 messages per 5 minutes per authenticated user.
 *
 * Generous for a normal back-and-forth conversation but caps a client stuck
 * in a retry loop (or deliberate spam) from hammering a vendor's inbox.
 * Starting a NEW conversation is cheap-but-not-free too (it's still just a
 * find-or-create), so it shares this limiter rather than getting its own.
 */
const chatMessageLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('You\'re sending messages too quickly. Please slow down.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Request creation - 50 new requests per day per authenticated user.
 *
 * A Request fans out to ~10 sellers at once, so it is far heavier than a
 * normal write. Caps a single account from carpet-bombing the seller base.
 */
const requestCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('You\'ve posted too many requests today. Please try again tomorrow.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Request responses - 30 replies per hour per authenticated seller.
 */
const requestResponseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: ApiResponse.error('You\'re responding too quickly. Please slow down.'),
  keyGenerator: (req) => req.user?.id || req.ip,
});

module.exports = {
  authLimiter,
  refreshLimiter,
  otpLimiter,
  pinLimiter,
  generalLimiter,
  registrationLimiter,
  orderCreationLimiter,
  quoteLimiter,
  callbackRequestLimiter,
  chatMessageLimiter,
  requestCreationLimiter,
  requestResponseLimiter,
};

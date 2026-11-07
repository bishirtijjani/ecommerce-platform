/**
 * Auth service - business logic for authentication.
 *
 * RULES:
 * - All database access goes through Prisma client
 * - Never access req/res here - this is a pure logic layer
 * - Throw AppError for any business rule violations
 * - All password/PIN operations use bcrypt
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { prisma } = require("../../config/database");
const { redis } = require("../../config/redis");
const { config } = require("../../config");
const { AppError } = require("../../utils/api-error");
const { logger } = require("../../utils/logger");
const { REDIS_KEYS, REDIS_TTL, OTP } = require("../../utils/constants");
const { canonicalizeEmail } = require("../../utils/email-canonical");
const { parseDurationMs } = require("../../utils/duration");

const SALT_ROUNDS = 12;

// Session rows must live as long as the refresh JWT they carry. This used to be
// a hard-coded 7 days, which silently contradicted JWT_REFRESH_EXPIRY (30d in
// production) and forced a full re-login every week even though the token was
// still valid.
const SESSION_TTL_MS = parseDurationMs(
  config.JWT_REFRESH_EXPIRY,
  7 * 24 * 60 * 60 * 1000,
);
const sessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS);

/**
 * Case-insensitive email lookup. New registrations are stored lowercase
 * (validator normalizes on the way in), but historical rows may be
 * mixed-case, so any auth lookup must not rely on exact `@unique` match or
 * it silently locks those accounts out. Pass `client: tx` to use inside a
 * transaction.
 */
const findUserByEmail = (email, { client = prisma, ...rest } = {}) =>
  client.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    ...rest,
  });

/**
 * Persist a welcome notification for a freshly verified account. This is the
 * "the app exists" touch - it lands in the Notification Center immediately,
 * so even a user who never grants push permission sees that notifications work.
 */
const sendWelcomeNotification = async (user) => {
  if (!user?.id) return;
  try {
    const notifyService = require("../../services/notify.service");
    const isVendor = user.role === "VENDOR";
    await notifyService.pushAndSocket(user.id, {
      type: "SYSTEM",
      title: isVendor ? "Welcome to Marketplace sellers" : "Welcome to Marketplace",
      body: isVendor
        ? "Your application is in. We will notify you the moment it is reviewed."
        : "Browse local vendors, chat with them directly, or post a request and let sellers come to you.",
      data: { route: isVendor ? "/notifications" : "/home" },
    });
  } catch (err) {
    logger.warn("Welcome notification failed (non-fatal)", {
      userId: user.id,
      error: err.message,
    });
  }
};

/**
 * Register a new user.
 * Stores registration data in Redis only - no DB write until OTP verified.
 */
const register = async ({
  email,
  firstName,
  lastName,
  phone,
  password,
  role = 'CUSTOMER',
  state,
  lga,
}) => {
  // Only block if an ACTIVE (verified) user already has this email
  const existing = await findUserByEmail(email);
  if (existing) {
    throw AppError.conflict("Email already registered", { code: "EMAIL_TAKEN" });
  }

  if (phone) {
    const phoneExists = await prisma.user.findUnique({ where: { phone } });
    if (phoneExists) {
      throw AppError.conflict("Phone number already registered", { code: "PHONE_TAKEN" });
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Store pending registration data in Redis (overwrites any previous attempt)
  const pendingKey = `${REDIS_KEYS.PENDING_REG}${email}`;
  const pendingData = JSON.stringify({
    email,
    firstName,
    lastName,
    phone,
    passwordHash,
    role,
    state,
    lga,
  });
  await redis.set(pendingKey, pendingData, "EX", REDIS_TTL.PENDING_REG);

  logger.info("Pending registration stored in Redis", { email, role });

  return { email, role };
};

/**
 * Login - verify credentials, return tokens.
 */
const login = async ({ email, password }, sessionMeta = {}) => {
  const user = await findUserByEmail(email, {
    include: { vendor: true },
  });

  if (!user) {
    throw AppError.unauthorized("Invalid email or password", { code: "INVALID_CREDENTIALS" });
  }

  if (user.status === "SUSPENDED") {
    throw AppError.forbidden("Account suspended. Contact support.", { code: "ACCOUNT_SUSPENDED" });
  }

  if (user.status === "DEACTIVATED") {
    throw AppError.forbidden("Account deactivated", { code: "ACCOUNT_DEACTIVATED" });
  }

  if (user.status === "PENDING") {
    throw AppError.forbidden(
      "Email not verified. Please check your email for the verification code.",
    );
  }

  if (!user.passwordHash) {
    throw AppError.badRequest("Password is required to login", { code: "PASSWORD_REQUIRED" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw AppError.unauthorized("Invalid email or password", { code: "INVALID_CREDENTIALS" });
  }

  const tokens = await issueSession(user, sessionMeta);

  logger.info("User logged in", { userId: user.id });

  return { user: buildAuthUser(user), tokens };
};

/**
 * The user payload both apps consume after auth. Kept in one place so password
 * login and the app->web handoff exchange can never drift apart.
 */
const buildAuthUser = (user) => ({
  id: user.id,
  email: user.email,
  phone: user.phone || null,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  permissions: user.permissions ?? null,
  status: user.status,
  vendorId: user.vendor?.id || null,
  // Capability set: one account can be customer + vendor at once. Apps read
  // this to show the right home (or an enroll prompt) instead of gating login
  // on the single `role`.
  roles: {
    customer: true,
    vendor: user.vendor ? user.vendor.status : null,
  },
});

/**
 * Mint tokens + persist the session row (full device fingerprint). Shared by
 * password login and the one-time app->web handoff exchange.
 */
const issueSession = async (user, sessionMeta = {}) => {
  const tokens = generateTokens(user);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt: sessionExpiry(),
      ipAddress: sessionMeta.ipAddress || null,
      deviceInfo: sessionMeta.deviceInfo || null,
      deviceName: sessionMeta.deviceName || null,
      deviceModel: sessionMeta.deviceModel || null,
      userAgent: sessionMeta.userAgent || null,
      lastUsedAt: new Date(),
    },
  });

  return tokens;
};

/**
 * App -> web SSO handoff.
 *
 * The customer app is already authenticated; when the user taps "Open your
 * shop" we mint a short-lived, single-use code and open the vendor web app
 * with it in the URL. The web app exchanges it for its own tokens, so the
 * user never logs in a second time.
 */
const createHandoff = async (userId, ttlSeconds = REDIS_TTL.HANDOFF) => {
  const token = crypto.randomBytes(32).toString("base64url");
  await redis.set(`${REDIS_KEYS.HANDOFF}${token}`, userId, "EX", ttlSeconds);
  return { token };
};

const exchangeHandoff = async (token, sessionMeta = {}) => {
  if (!token || typeof token !== "string") {
    throw AppError.unauthorized("Invalid or expired link", { code: "HANDOFF_INVALID" });
  }

  const key = `${REDIS_KEYS.HANDOFF}${token}`;
  // GETDEL: single-use by construction - a replayed link finds nothing.
  const userId = await redis.getdel(key);
  if (!userId) {
    throw AppError.unauthorized("This link has expired. Please try again.", { code: "HANDOFF_INVALID" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vendor: true },
  });
  if (!user || user.deletedAt || user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    throw AppError.unauthorized("Invalid or expired link", { code: "HANDOFF_INVALID" });
  }

  const tokens = await issueSession(user, sessionMeta);
  logger.info("App->web handoff exchanged", { userId: user.id });
  return { user: buildAuthUser(user), tokens };
};

/**
 * Generate and store OTP for email verification.
 * @param {string} email
 * @param {object} [opts]
 * @param {boolean} [opts.checkCooldown] - Enforce 60s between requests (resend/forgot flows)
 */
const generateOtp = async (email, { checkCooldown = false } = {}) => {
  if (checkCooldown) {
    const cooldownKey = `${REDIS_KEYS.OTP_COOLDOWN}${email}`;
    const ttl = await redis.ttl(cooldownKey);
    if (ttl > 0) {
      throw AppError.tooManyRequests(
        `Please wait ${ttl} second${ttl === 1 ? "" : "s"} before requesting another code.`,
      );
    }
    await redis.set(cooldownKey, "1", "EX", REDIS_TTL.OTP_COOLDOWN);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
  const redisKey = `${REDIS_KEYS.OTP}${email}`;

  await redis.set(redisKey, code, "EX", REDIS_TTL.OTP);

  // Refresh pending registration TTL so it doesn't expire before the new OTP
  const pendingKey = `${REDIS_KEYS.PENDING_REG}${email}`;
  const hasPending = await redis.exists(pendingKey);
  if (hasPending) {
    await redis.expire(pendingKey, REDIS_TTL.PENDING_REG);
  }

  logger.info("OTP generated", { email, checkCooldown });

  return code;
};

/**
 * Verify OTP and create user from pending registration data.
 *
 * For customer registrations, also issues an access/refresh token pair and
 * creates a session row so the client can drop straight into the authed app
 * (no second login step). Vendor registrations intentionally still return
 * verification-only - the vendor dashboard funnels them to /login because
 * their vendor profile is PENDING_APPROVAL until an admin approves it.
 */
const verifyOtp = async (email, code, sessionMeta = {}) => {
  const otpKey = `${REDIS_KEYS.OTP}${email}`;
  const storedCode = await redis.get(otpKey);

  if (!storedCode) {
    // A duplicate submit (double-click, client retry) after a successful verify
    // finds the OTP already consumed. If the account now exists and is active,
    // report success instead of a confusing "expired" error. No tokens are
    // issued here - this only acknowledges the already-completed verification.
    const already = await findUserByEmail(email, { select: { id: true, status: true } });
    if (already && already.status === "ACTIVE") {
      logger.info("OTP already verified (duplicate submit)", { email, userId: already.id });
      return { verified: true, userId: already.id, alreadyVerified: true };
    }
    throw AppError.badRequest("OTP expired or not found. Request a new one.", { code: "OTP_EXPIRED" });
  }

  if (storedCode !== code) {
    throw AppError.badRequest("Invalid OTP code", { code: "INVALID_OTP" });
  }

  // Delete OTP after successful verification
  await redis.del(otpKey);

  // Pull pending registration data from Redis
  const pendingKey = `${REDIS_KEYS.PENDING_REG}${email}`;
  const pendingRaw = await redis.get(pendingKey);

  if (!pendingRaw) {
    // Could be a non-registration OTP (e.g. password reset or vendor verification)
    // Check if this is a vendor with PENDING status
    const user = await findUserByEmail(email);
    if (user && user.role === 'VENDOR' && user.status === 'PENDING') {
      // Update vendor status to ACTIVE after email verification
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' }
      });
      logger.info("Vendor email verified and activated", { email, userId: user.id });
      sendWelcomeNotification(user).catch(() => {});
      return { verified: true, userId: user.id };
    }
    // Other OTP types (password reset, etc.)
    logger.info("OTP verified (no pending registration)", { email });
    return { verified: true };
  }

  const pending = JSON.parse(pendingRaw);

  // Vendor signups carry an extra `vendor` payload - provision the
  // vendor profile inside the same transaction so a partial failure
  // leaves nothing behind.
  const isVendor = pending.role === 'VENDOR' && pending.vendor;

  const user = await prisma.$transaction(async (tx) => {
    // Re-check uniqueness inside the tx in case another caller raced us
    // between vendorRegister/register and this verification.
    const emailTaken = await findUserByEmail(pending.email, { client: tx });
    if (emailTaken) throw AppError.conflict('Email already registered', { code: 'EMAIL_TAKEN' });
    if (pending.phone) {
      const phoneTaken = await tx.user.findUnique({ where: { phone: pending.phone } });
      if (phoneTaken) throw AppError.conflict('Phone number already registered', { code: 'PHONE_TAKEN' });
    }

    // Multi-account detection (FLAG, never block): the raw email is unique, but
    // gmail dot/+tag/googlemail variants map many signups to one real mailbox.
    // If the canonical form already exists, create this account pre-flagged for
    // review. Does not restrict the account - just surfaces it to admins.
    const emailCanonical = canonicalizeEmail(pending.email);
    const canonicalDupes = await tx.user.count({ where: { emailCanonical, deletedAt: null } });
    const reviewFields = canonicalDupes > 0
      ? {
          emailCanonical,
          reviewFlag: true,
          reviewReason: `Email canonical "${emailCanonical}" shared with ${canonicalDupes} existing account(s)`,
          reviewFlaggedAt: new Date(),
        }
      : { emailCanonical };

    if (isVendor) {
      const m = pending.vendor;

      const created = await tx.user.create({
        data: {
          email: pending.email,
          ...reviewFields,
          phone: pending.phone,
          firstName: pending.firstName,
          lastName: pending.lastName,
          passwordHash: pending.passwordHash,
          role: 'VENDOR',
          status: 'ACTIVE',
          state: pending.state ?? null,
          lga: pending.lga ?? null,
          vendor: {
            create: {
              name: m.businessName,
              description: null,
              phone: m.businessPhone,
              email: m.businessEmail,
              // Location is collected in the dashboard's onboarding wizard
              // after first login. Prisma still requires these columns, so
              // seed placeholders. Admin approval gates customer visibility
              // until real coords replace these.
              address: m.businessAddress || 'Pending - set in onboarding',
              lat: typeof m.lat === 'number' ? m.lat : 0,
              lng: typeof m.lng === 'number' ? m.lng : 0,
              state: pending.state ?? null,
              lga: pending.lga ?? null,
              openingTime: m.openingTime,
              closingTime: m.closingTime,
              status: 'PENDING_APPROVAL',
              averageRating: 0,
              isOpen: false,
              isActive: true,
            },
          },
        },
        include: { vendor: true },
      });

      return created;
    }

    const newUser = await tx.user.create({
      data: {
        email: pending.email,
        ...reviewFields,
        firstName: pending.firstName,
        lastName: pending.lastName,
        phone: pending.phone,
        passwordHash: pending.passwordHash,
        role: pending.role,
        state: pending.state ?? null,
        lga: pending.lga ?? null,
        status: "ACTIVE", // Already verified
      },
    });

    return newUser;
  });

  // Clean up Redis
  await redis.del(pendingKey);

  // Alert the team inbox about the new vendor application (best-effort - a
  // mail failure must never fail the signup the user just completed).
  if (isVendor && user.vendor) {
    const emailService = require("../../services/email.service");
    emailService
      .sendVendorApplicationAlertEmail({
        to: config.CONTACT_INBOX_EMAIL,
        vendorName: user.vendor.name,
        contactEmail: user.vendor.email,
        contactPhone: user.vendor.phone,
        isResubmission: false,
      })
      .catch((err) => logger.warn("New vendor application team email failed (non-fatal)", { vendorId: user.vendor.id, error: err.message }));
  }

  logger.info("OTP verified, user created", {
    userId: user.id,
    email,
    role: user.role,
  });

  // Welcome touch for both customers and vendors (fire-and-forget).
  sendWelcomeNotification(user).catch(() => {});

  // Admin alert (best-effort): a new signup collided with an existing canonical
  // email → possible multi-accounting. Distinctive marker for log-based alerting;
  // the reviewFlag column is the durable, queryable signal for the admin panel.
  if (user.reviewFlag) {
    logger.warn("FRAUD_REVIEW_FLAG multi-account signup", {
      signal: "EMAIL_CANONICAL_DUPLICATE",
      userId: user.id,
      email: user.email,
      emailCanonical: user.emailCanonical,
      reason: user.reviewReason,
    });
  }

  // Auto-login customers right after verification - the user just proved
  // email ownership and we hold their password hash, so a second login step
  // adds nothing. Vendors skip this on purpose (see function-level note).
  if (user.role !== 'VENDOR') {
    const tokens = generateTokens(user);
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        expiresAt: sessionExpiry(),
        ipAddress: sessionMeta.ipAddress || null,
        deviceInfo: sessionMeta.deviceInfo || null,
        deviceName: sessionMeta.deviceName || null,
        deviceModel: sessionMeta.deviceModel || null,
        userAgent: sessionMeta.userAgent || null,
        lastUsedAt: new Date(),
      },
    });

    return {
      verified: true,
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        vendorId: null,
      },
      tokens,
    };
  }

  return { verified: true, userId: user.id };
};

// Grace window for refresh-token rotation. If a client presents a token that
// was rotated moments ago - a second tab refreshing at the same instant, or a
// retry after the response was lost - we hand back the current pair instead of
// a 401. Without this the losing request signs the user out.
const REFRESH_GRACE_SECONDS = 60;
const rotatedKey = (token) =>
  `refresh:rotated:${crypto.createHash("sha256").update(String(token)).digest("hex")}`;

const findCurrentSession = async (token) => {
  const session = await prisma.session.findUnique({
    where: { refreshToken: token },
    include: { user: true },
  });
  if (!session || session.isRevoked || session.expiresAt < new Date()) return null;
  return session;
};

const findGraceSession = async (oldToken) => {
  let replacement;
  try {
    replacement = await redis.get(rotatedKey(oldToken));
  } catch (err) {
    logger.warn("Refresh grace lookup failed (non-fatal)", { error: err.message });
    return null;
  }
  if (!replacement) return null;
  return findCurrentSession(replacement);
};

// The grace path must not mint another refresh token: both callers converge on
// the one that is already live, so the next rotation has a single starting point.
const reuseSession = (session) => ({
  accessToken: signAccessToken(session.user),
  refreshToken: session.refreshToken,
});

/**
 * Refresh access token using a valid refresh token.
 * Carries the original session's device fingerprint forward to the new
 * session row, so devices remain identifiable across rotations. Updates
 * `lastUsedAt` so the Sessions screen reflects recent activity.
 */
const refreshAccessToken = async (refreshToken, sessionMeta = {}) => {
  const session = await findCurrentSession(refreshToken);

  if (!session) {
    const grace = await findGraceSession(refreshToken);
    if (grace) {
      logger.info("Refresh replayed a just-rotated token (grace window)", {
        userId: grace.userId,
      });
      return reuseSession(grace);
    }
    throw AppError.unauthorized("Invalid or expired refresh token", { code: "REFRESH_TOKEN_INVALID" });
  }

  const tokens = generateTokens(session.user);

  // Claim the session and create its replacement atomically. `updateMany` with
  // `isRevoked: false` makes rotation single-winner: if a concurrent request
  // already claimed it, count is 0 and we fall through to the grace path rather
  // than issuing two long-lived sessions.
  const rotated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.session.updateMany({
      where: { id: session.id, isRevoked: false },
      data: { isRevoked: true, lastUsedAt: new Date() },
    });
    if (claimed.count === 0) return false;

    await tx.session.create({
      data: {
        userId: session.userId,
        refreshToken: tokens.refreshToken,
        expiresAt: sessionExpiry(),
        // Prefer freshly-supplied meta (request that hit /refresh) but fall
        // back to the prior session's fingerprint so we never lose attribution.
        ipAddress: sessionMeta.ipAddress || session.ipAddress || null,
        deviceInfo: sessionMeta.deviceInfo || session.deviceInfo || null,
        deviceName: sessionMeta.deviceName || session.deviceName || null,
        deviceModel: sessionMeta.deviceModel || session.deviceModel || null,
        userAgent: sessionMeta.userAgent || session.userAgent || null,
        lastUsedAt: new Date(),
      },
    });
    return true;
  });

  if (!rotated) {
    const grace = await findGraceSession(refreshToken);
    if (grace) return reuseSession(grace);
    throw AppError.unauthorized("Invalid or expired refresh token", { code: "REFRESH_TOKEN_INVALID" });
  }

  try {
    await redis.set(rotatedKey(refreshToken), tokens.refreshToken, "EX", REFRESH_GRACE_SECONDS);
  } catch (err) {
    logger.warn("Could not store refresh grace pointer (non-fatal)", { error: err.message });
  }

  return tokens;
};

/**
 * Request password reset - generates and returns OTP if user is ACTIVE.
 * Silently succeeds for unknown/inactive emails (don't leak existence).
 */
const requestPasswordReset = async (email) => {
  const user = await findUserByEmail(email);

  if (!user || user.status !== "ACTIVE") {
    logger.info("Password reset requested for unknown/inactive email", {
      email,
    });
    return null; // Caller will respond generically
  }

  const code = await generateOtp(email, { checkCooldown: true });
  return code;
};

/**
 * Reset password - verifies OTP then updates password atomically.
 */
const resetPassword = async (email, code, newPassword) => {
  // Verify OTP (also handles pending_reg cleanup if somehow present)
  const otpKey = `${REDIS_KEYS.OTP}${email}`;
  const storedCode = await redis.get(otpKey);

  if (!storedCode) {
    throw AppError.badRequest("OTP expired or not found. Request a new one.", { code: "OTP_EXPIRED" });
  }
  if (storedCode !== code) {
    throw AppError.badRequest("Invalid reset code.", { code: "INVALID_OTP" });
  }

  await redis.del(otpKey);

  const user = await findUserByEmail(email);
  if (!user || user.status !== "ACTIVE") {
    throw AppError.badRequest("No active account found for this email.", { code: "ACCOUNT_NOT_FOUND" });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    // Revoke all existing sessions - force re-login on all devices
    prisma.session.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    }),
  ]);

  logger.info("Password reset successful", { email });
};

/**
 * List active sessions for a user.
 */
const listSessions = async (userId, currentRefreshToken) => {
  const sessions = await prisma.session.findMany({
    where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      deviceInfo: true,
      deviceName: true,
      deviceModel: true,
      userAgent: true,
      ipAddress: true,
      lastUsedAt: true,
      createdAt: true,
      expiresAt: true,
      refreshToken: true,
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceInfo: s.deviceInfo,
    deviceName: s.deviceName,
    deviceModel: s.deviceModel,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    lastUsedAt: s.lastUsedAt,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.refreshToken === currentRefreshToken,
  }));
};

/**
 * Revoke a specific session by ID.
 */
const revokeSession = async (userId, sessionId) => {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw AppError.notFound('Session not found');
  }
  await prisma.session.update({ where: { id: sessionId }, data: { isRevoked: true } });
};

/**
 * Revoke all sessions except the current one.
 */
const revokeOtherSessions = async (userId, currentRefreshToken) => {
  await prisma.session.updateMany({
    where: { userId, isRevoked: false, refreshToken: { not: currentRefreshToken } },
    data: { isRevoked: true },
  });
};

/**
 * Update FCM token for push notifications.
 */
const updateFcmToken = async (userId, fcmToken) => {
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken },
  });
};

/** Clear the device token on native logout so a signed-out device stops buzzing. */
const clearFcmToken = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: { fcmToken: null },
  });
};

/**
 * Get user profile.
 */
const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
      dateOfBirth: true,
      address: true,
      // State/LGA captured at registration - the compose screen prefills its
      // location picks from these (spread into the response below via `rest`).
      state: true,
      lga: true,
      kycStatus: true,
      role: true,
      permissions: true,
      status: true,
      createdAt: true,
      vendor: { select: { id: true, status: true } },
    },
  });

  if (!user) throw AppError.notFound("User not found");

  const { vendor, ...rest } = user;

  return {
    ...rest,
    // Capability set - mirrors the login payload so both apps can tell whether
    // this account already has a shop even after a cold start / profile reload.
    vendorId: vendor?.id || null,
    roles: {
      customer: true,
      vendor: vendor ? vendor.status : null,
    },
    // DEPRECATED compat shim. KYC is now trust-based only - there is no phone
    // OTP step. Pinned to false so any older web bundle still cached in a
    // customer's browser keeps showing the BVN confirmation sheet (it reads
    // `kycPhoneOtpEnabled !== false`). Safe to delete once no pre-cutover
    // clients remain.
    kycPhoneOtpEnabled: false,
  };
};

/**
 * Update user profile - name, phone, address, dateOfBirth.
 */
const updateProfile = async (userId, data) => {
  // If phone is being changed, check uniqueness
  if (data.phone) {
    const phoneOwner = await prisma.user.findUnique({
      where: { phone: data.phone },
    });
    if (phoneOwner && phoneOwner.id !== userId) {
      throw AppError.conflict("Phone number already in use", { code: "PHONE_TAKEN" });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName && { lastName: data.lastName }),
      ...(data.phone && { phone: data.phone }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.lga !== undefined && { lga: data.lga }),
      ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
    },
    select: {
      id: true,
      phone: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePicture: true,
      dateOfBirth: true,
      address: true,
      state: true,
      lga: true,
      kycStatus: true,
      role: true,
      permissions: true,
      status: true,
      createdAt: true,
    },
  });

  return user;
};

/**
 * Update profile picture URL.
 */
const updateProfilePicture = async (userId, url) => {
  await prisma.user.update({
    where: { id: userId },
    data: { profilePicture: url },
  });
  logger.info("Profile picture updated", { userId });
};

/**
 * Logout - revoke the refresh token.
 */
const logout = async (refreshToken) => {
  await prisma.session.updateMany({
    where: { refreshToken },
    data: { isRevoked: true },
  });
};

/**
 * Get notification preferences for a user.
 * Creates default preferences if none exist.
 */
const getNotificationPreferences = async (userId) => {
  let prefs = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.notificationPreferences.create({
      data: {
        userId,
        pushEnabled: true,
        orderUpdates: true,
        promotions: true,
        requestAlerts: true,
        emailEnabled: true,
        emailPromotions: false,
        smsEnabled: false,
      },
    });
  }

  return prefs;
};

/**
 * Update notification preferences.
 */
const updateNotificationPreferences = async (userId, data) => {
  const prefs = await prisma.notificationPreferences.upsert({
    where: { userId },
    create: {
      userId,
      pushEnabled: data.pushEnabled ?? true,
      orderUpdates: data.orderUpdates ?? true,
      promotions: data.promotions ?? true,
      requestAlerts: data.requestAlerts ?? true,
      emailEnabled: data.emailEnabled ?? true,
      emailPromotions: data.emailPromotions ?? false,
      smsEnabled: data.smsEnabled ?? false,
    },
    update: {
      ...(data.pushEnabled !== undefined && { pushEnabled: data.pushEnabled }),
      ...(data.orderUpdates !== undefined && { orderUpdates: data.orderUpdates }),
      ...(data.promotions !== undefined && { promotions: data.promotions }),
      ...(data.requestAlerts !== undefined && { requestAlerts: data.requestAlerts }),
      ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
      ...(data.emailPromotions !== undefined && { emailPromotions: data.emailPromotions }),
      ...(data.smsEnabled !== undefined && { smsEnabled: data.smsEnabled }),
    },
  });

  logger.info("Notification preferences updated", { userId });
  return prefs;
};

/**
 * Generate Cloudinary upload signature for direct upload from the client.
 *
 * `kind` selects the folder + publicId convention:
 *   - "profile" → ecommerce/profiles/{userId}/profile_{ts}      (default)
 *   - "return"  → ecommerce/returns/{userId}/return_{ts}_{nonce}
 *   - "product" → ecommerce/products/{userId}/prod_{ts}_{nonce}
 *
 * Each issued signature is logged with the caller id + folder.
 */
const UPLOAD_KINDS = {
  profile: { root: "profiles", prefix: "profile" },
  return: { root: "returns", prefix: "return" },
  product: { root: "products", prefix: "prod" },
  product_video: { root: "products", prefix: "prodv" },
   // Vendor storefront imagery. User-folder-scoped (the vendor's own user id),
   // so a vendor can only write into their own logo/cover tree. No extra role
   // gate needed beyond `authenticate` - same trust model as `product`, which
   // the vendor dashboard already mints.
   vendor_logo: { root: "vendor-logos", prefix: "logo" },
   vendor_cover: { root: "vendor-covers", prefix: "cover" },
   // Shop category card image (per-vendor override of a subcategory picture).
   category: { root: "categories", prefix: "cat" },
   // Shop story highlights (Instagram-style) shown on the vendor storefront.
   highlight: { root: "highlights", prefix: "hl" },
   highlight_video: { root: "highlights", prefix: "hlv" },
   dispute: { root: "disputes", prefix: "ev" },
  ticket: { root: "tickets", prefix: "att" },
  chat: { root: "chat", prefix: "att" },
   // Reverse-marketplace request attachments (images + inline video).
   request: { root: "requests", prefix: "req" },
   request_video: { root: "requests", prefix: "reqv" },
};

/**
 * Issue a Cloudinary upload signature. Every kind is user-folder-scoped:
 * `ecommerce/<root>/<userId>/...`.
 */
const getCloudinaryUploadSignature = async (userId, userRole, kind = "profile", scopeId = null) => {
  const cloudName = config.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.CLOUDINARY_API_KEY;
  const apiSecret = config.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw AppError.serviceUnavailable("Cloudinary not configured");
  }

  const spec = UPLOAD_KINDS[kind];
  if (!spec) {
    throw AppError.badRequest(`Unsupported upload kind: ${kind}`);
  }

  const folderScopeId = userId;

  const crypto = require("crypto");
  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `ecommerce/${spec.root}/${folderScopeId}`;
  // Return docs add a short nonce so two uploads in the same second don't
  // collide on publicId. Profiles keep the legacy shape.
  const publicId = kind === "profile"
    ? `${spec.prefix}_${timestamp}`
    : `${spec.prefix}_${timestamp}_${crypto.randomBytes(4).toString("hex")}`;

  const signatureString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureString).digest("hex");

  // Audit trail: every signature issuance is captured in the application log.
  logger.info("cloudinary.upload_signature.issued", {
    userId, userRole, kind, folder, publicId, timestamp,
  });

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder,
    publicId,
    kind,
  };
};

/**
 * Delete user account (soft delete - anonymize data).
 */
const deleteAccount = async (userId) => {
  const { ACTIVE_STATUSES } = require('../../utils/status');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: {
        take: 1,
        where: { status: { in: ACTIVE_STATUSES } },
      },
    },
  });

  if (!user) throw AppError.notFound('User not found');

  if (user.orders.length > 0) {
    throw AppError.conflict(
      'Cannot delete account with active orders. Please complete or cancel all orders first.',
    );
  }

  await prisma.$transaction([
    prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}@deleted.local`,
        phone: `deleted_${userId}`,
        firstName: 'Deleted',
        lastName: 'User',
        address: null,
        profilePicture: null,
        fcmToken: null,
        kycStatus: 'NONE',
        status: 'DEACTIVATED',
        deletedAt: new Date(),
      },
    }),
  ]);

  logger.info('User account deleted', { userId });

  // Drop this user from the socket-auth cache so the next reconnect re-reads
  // and refuses the (now DEACTIVATED) account.
  try {
    const { invalidateUserAuthCache } = require('../../sockets');
    invalidateUserAuthCache(userId);
  } catch (_) {
    // Sockets not initialized in this process (e.g. CLI script) - ignore.
  }

  return { message: 'Account deleted successfully' };
};

// --- Internal helpers ---

const buildAccessPayload = (user) => ({
  id: user.id,
  role: user.role,
  email: user.email,
  ...(user.role === 'ADMIN' && { permissions: user.permissions ?? null }),
});

const signAccessToken = (user) =>
  jwt.sign(buildAccessPayload(user), config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY,
  });

const generateTokens = (user) => {
  const accessToken = signAccessToken(user);

  const refreshToken = jwt.sign(
    { id: user.id, jti: uuidv4() },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY },
  );

  return { accessToken, refreshToken };
};

const vendorRegister = async ({
  email,
  phone,
  firstName,
  lastName,
  password,
  businessName,
  businessPhone,
  businessEmail,
  businessAddress,
  lat,
  lng,
  state,
  lga,
  openingTime,
  closingTime,
}) => {
  // Only block if a verified user already owns this email/phone. Users who
  // abandon a previous attempt can retry - the pending Redis entry is keyed
  // by email and gets overwritten.
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw AppError.conflict("Email already registered", { code: "EMAIL_TAKEN" });
  }

  const phoneExists = await prisma.user.findUnique({ where: { phone } });
  if (phoneExists) {
    throw AppError.conflict("Phone number already registered", { code: "PHONE_TAKEN" });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Stash full registration payload in Redis. The user/vendor/wallet rows
  // are only created once the email OTP is verified (see verifyOtp).
  const pendingKey = `${REDIS_KEYS.PENDING_REG}${email}`;
  const pendingData = JSON.stringify({
    email,
    firstName,
    lastName,
    phone,
    passwordHash,
    role: 'VENDOR',
    state: state ?? null,
    lga: lga ?? null,
    vendor: {
      businessName,
      businessPhone,
      businessEmail,
      businessAddress: businessAddress || null,
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
      openingTime,
      closingTime,
    },
  });
  await redis.set(pendingKey, pendingData, "EX", REDIS_TTL.PENDING_REG);

  const code = await generateOtp(email);

  logger.info("Pending vendor registration stored in Redis", { email, businessName });

  return {
    email,
    businessName,
    code,
  };
};

/**
 * Enroll an EXISTING, already-verified user as a vendor.
 *
 * Unlike vendorRegister (a fresh signup that mints a User after OTP), this
 * runs inside an authenticated session: no new account, no new email, no OTP.
 * It just attaches a Vendor profile + VendorWallet to the caller's user so
 * one person can be customer + vendor on a single login. Mirrors the
 * vendor-creation block in verifyOtp so behaviour stays identical.
 */
const enrollVendor = async (userId, data) => {
  const {
    businessName,
    businessPhone,
    businessEmail,
    businessAddress,
    lat,
    lng,
    state,
    lga,
    openingTime,
    closingTime,
  } = data || {};

  const required = { businessName, businessPhone, openingTime, closingTime };
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw AppError.badRequest(`Missing required field: ${key}`, { code: "VALIDATION_FAILED" });
    }
  }

  const existing = await prisma.vendor.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    throw AppError.conflict("This account already has a vendor profile", { code: "VENDOR_EXISTS" });
  }

  // Shop State/LGA: prefer what the wizard sent, else fall back to the
  // account's registration values (the account -> shop inheritance).
  let shopState = state ?? null;
  let shopLga = lga ?? null;
  if (shopState == null || shopLga == null) {
    const owner = await prisma.user.findUnique({
      where: { id: userId },
      select: { state: true, lga: true },
    });
    shopState = shopState ?? owner?.state ?? null;
    shopLga = shopLga ?? owner?.lga ?? null;
  }

  const vendor = await prisma.$transaction(async (tx) => {
    const created = await tx.vendor.create({
      data: {
        userId,
        name: businessName,
        description: null,
        phone: businessPhone,
        email: businessEmail || null,
        // Real location is captured in the dashboard onboarding wizard after
        // enrolling; seed placeholders so the required columns are satisfied.
        // Admin approval gates customer visibility until then.
        address: businessAddress || "Pending - set in onboarding",
        lat: typeof lat === "number" ? lat : 0,
        lng: typeof lng === "number" ? lng : 0,
        state: shopState,
        lga: shopLga,
        openingTime,
        closingTime,
        status: "PENDING_APPROVAL",
        averageRating: 0,
        isOpen: false,
        isActive: true,
      },
    });

    return created;
  });

  logger.info("Vendor profile enrolled for existing user", { userId, vendorId: vendor.id });

  // Alert the team inbox about the new vendor application (best-effort).
  const emailService = require("../../services/email.service");
  emailService
    .sendVendorApplicationAlertEmail({
      to: config.CONTACT_INBOX_EMAIL,
      vendorName: vendor.name,
      contactEmail: vendor.email,
      contactPhone: vendor.phone,
      isResubmission: false,
    })
    .catch((err) => logger.warn("New vendor application team email failed (non-fatal)", { vendorId: vendor.id, error: err.message }));

  return { vendorId: vendor.id, status: vendor.status };
};

/**
 * Request a phone number change - verifies password, sends OTP (via SMS in
 * prod, dev-logged otherwise) to the new number. Stores the pending change
 * in Redis so the confirm step can look it up.
 *
 * NOTE: also stashes the OLD phone number so the confirm step can notify it
 * after the change (security signal for account-takeover detection).
 */
const requestPhoneChange = async (userId, { newPhone, password }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, phone: true },
  });
  if (!user) throw AppError.notFound('User not found');
  if (!user.passwordHash) throw AppError.badRequest('Password not set on this account');

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) throw AppError.unauthorized('Incorrect password', { code: 'INCORRECT_PASSWORD' });

  const existing = await prisma.user.findUnique({ where: { phone: newPhone } });
  if (existing) throw AppError.conflict('Phone number already in use', { code: 'PHONE_TAKEN' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const key = `phone:change:${userId}`;

  // Send OTP to the NEW phone first; only stash the pending change in Redis
  // if delivery succeeded. If we stashed first and delivery failed, the user
  // would see a generic "OTP expired" later - opaque and frustrating.
  // Lazy-require to avoid circular import at boot.
  const messagingService = require('../../services/messaging.service');
  try {
    await messagingService.sendOtp(newPhone, code);
  } catch (err) {
    logger.warn('Phone-change OTP send failed', { userId, error: err.message });
    throw AppError.serviceUnavailable('Could not send verification code. Please try again shortly.');
  }

  await redis.set(
    key,
    JSON.stringify({ newPhone, oldPhone: user.phone || null, code }),
    'EX',
    10 * 60,
  );

  logger.info('Phone change OTP generated', { userId, newPhone });
};

/**
 * Confirm a phone number change - verifies OTP and applies the new phone.
 * After applying, sends a security notice via SMS to the OLD phone (so a
 * fraudster who silently rotates the number out of an account can't do so
 * without leaving a trail with the legitimate owner).
 */
const confirmPhoneChange = async (userId, { newPhone, otp }) => {
  const key = `phone:change:${userId}`;
  const raw = await redis.get(key);
  if (!raw) throw AppError.badRequest('OTP expired or not requested. Please start again.');

  // Rename the redis-stored `code` to `expectedOtp` so it doesn't shadow the
  // `code` property we pass on the AppError options below.
  const { newPhone: storedPhone, oldPhone, code: expectedOtp } = JSON.parse(raw);
  if (storedPhone !== newPhone) throw AppError.badRequest('Phone number mismatch');
  if (expectedOtp !== otp) throw AppError.badRequest('Invalid OTP', { code: 'INVALID_OTP' });

  await prisma.user.update({ where: { id: userId }, data: { phone: newPhone } });
  await redis.del(key);

  // Notify the old number - fire-and-forget. Mask the new number for safety.
  if (oldPhone) {
    const maskedNew = newPhone.length > 4 ? `****${newPhone.slice(-4)}` : newPhone;
    const messagingService = require('../../services/messaging.service');
    messagingService
      .sendSms(
        oldPhone,
        `Security notice: the phone number on your ${config.APP_NAME || 'Marketplace'} account was changed to ${maskedNew}. If this wasn't you, contact support immediately.`,
      )
      .catch((err) => logger.warn('Old-phone change-notice SMS failed', { userId, error: err.message }));
  }

  logger.info('Phone number changed', { userId, newPhone });
};

module.exports = {
  register,
  vendorRegister,
  enrollVendor,
  login,
  createHandoff,
  exchangeHandoff,
  generateOtp,
  verifyOtp,
  refreshAccessToken,
  requestPasswordReset,
  resetPassword,
  updateFcmToken,
  clearFcmToken,
  getProfile,
  updateProfile,
  updateProfilePicture,
  logout,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  getNotificationPreferences,
  updateNotificationPreferences,
  getCloudinaryUploadSignature,
  deleteAccount,
  requestPhoneChange,
  confirmPhoneChange,
};

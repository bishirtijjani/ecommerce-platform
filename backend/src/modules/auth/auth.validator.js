/**
 * Auth module - Zod validation schemas.
 *
 * Every request to auth endpoints is validated against these schemas
 * via the validate middleware BEFORE reaching the controller.
 */

const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  phone: z
    .string()
    .trim()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number"),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  // Nigerian State + LGA. The current customer app collects them at signup,
  // but they stay optional here so older clients and the pin-first vendor flow
  // keep working.
  state: z.string().trim().max(60).optional(),
  lga: z.string().trim().max(80).optional(),
  // Not trimmed - a password's leading/trailing characters are part of the
  // secret; stripping them would silently change what gets hashed.
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
});

const sendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
  // Not trimmed - see registerSchema for why password stays untouched.
  newPassword: z.string().min(8).max(72),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const updateFcmTokenSchema = z.object({
  fcmToken: z.string().min(1, "FCM token is required"),
});

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number")
    .optional(),
  address: z.string().trim().max(255).optional(),
  state: z.string().trim().max(60).optional(),
  lga: z.string().trim().max(80).optional(),
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format")
    .optional(),
});

const updateProfilePictureSchema = z.object({
  url: z.string().url("Invalid URL").optional(),
});

const updateNotificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  orderUpdates: z.boolean().optional(),
  promotions: z.boolean().optional(),
  requestAlerts: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  emailPromotions: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
});

const requestPhoneChangeSchema = z.object({
  newPhone: z.string().trim().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  // Not trimmed - see registerSchema for why password stays untouched.
  password: z.string().min(1),
});

const confirmPhoneChangeSchema = z.object({
  newPhone: z.string().trim().regex(/^0[789][01]\d{8}$/, 'Invalid Nigerian phone number'),
  otp: z.string().trim().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const vendorRegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(/^0[789][01]\d{8}$/, "Invalid Nigerian phone number"),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  // Not trimmed - see registerSchema for why password stays untouched.
  password: z.string().min(8).max(72),
  businessName: z.string().trim().min(2).max(100),
  businessPhone: z.string().trim().min(10),
  businessEmail: z.string().trim().toLowerCase().email(),
  // Location is collected post-signup in the dashboard's OnboardingWizard so
  // vendors can drop a real pin on a map; the vendor starts at
  // PENDING_APPROVAL and admin approval blocks until coords are real.
  businessAddress: z.string().trim().min(5).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // Shop location may be captured here or completed in onboarding; the
  // approval gate requires it to be complete before APPROVED.
  state: z.string().trim().max(60).optional(),
  lga: z.string().trim().max(80).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).default('22:00'),
});

/**
 * Attach a shop to an already-authenticated account (customer -> vendor).
 * Mirrors vendorRegisterSchema's business half; identity comes from the
 * session, so there is no email/password here.
 */
const vendorEnrollSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  businessPhone: z.string().trim().min(10),
  businessEmail: z.string().trim().toLowerCase().email().optional(),
  businessAddress: z.string().trim().min(5).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // Shop location is captured pin-first in onboarding; State/LGA are derived
  // from the pin, so enrollment does not require them.
  state: z.string().trim().max(60).optional(),
  lga: z.string().trim().max(80).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
});

const handoffExchangeSchema = z.object({
  token: z.string().min(1),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  sendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  updateFcmTokenSchema,
  updateProfileSchema,
  updateProfilePictureSchema,
  updateNotificationPreferencesSchema,
  vendorRegisterSchema,
  vendorEnrollSchema,
  handoffExchangeSchema,
  requestPhoneChangeSchema,
  confirmPhoneChangeSchema,
};

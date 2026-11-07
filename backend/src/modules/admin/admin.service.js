/**
 * Admin service - user management, transaction oversight, order management, vendor management.
 */

const { prisma } = require('../../config/database');
const { Prisma } = require('@prisma/client');
const { redis } = require('../../config/redis');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { REDIS_KEYS, REDIS_TTL } = require('../../utils/constants');
const { config } = require('../../config');
const emailService = require('../../services/email.service');
const { createAuditLog } = require('../../utils/audit');
const { ACTIVE_STATUSES } = require('../../utils/status');
const orderService = require('../order/order.service');
const { deriveVendorCategories } = require('../vendor/vendor.service');
const { getIO } = require('../../sockets');
const { ORDER, getOrderRoom, getUserRoom } = require('../../sockets/events');
const notifyService = require('../../services/notify.service');
const {
  missingVendorLocation,
} = require('../../utils/location');

/**
 * One-time auto-login link for vendor emails. Reuses the app->web handoff
 * (single-use Redis code) with a long TTL so the link still works days later.
 * Falls back to the plain app URL if minting fails, so the email always sends.
 */
const buildVendorLoginLink = async (userId) => {
  if (!userId) return config.VENDOR_APP_URL;
  try {
    const authService = require('../auth/auth.service');
    const { token } = await authService.createHandoff(userId, REDIS_TTL.EMAIL_LINK);
    return `${config.VENDOR_APP_URL}/auth/continue?h=${encodeURIComponent(token)}`;
  } catch (err) {
    logger.warn('Failed to mint vendor login link', { userId, error: err.message });
    return config.VENDOR_APP_URL;
  }
};

/**
 * Best-effort in-app + push notification for an admin-initiated account change.
 * Email is still sent alongside where relevant; push/notification-center are
 * additive so a user who is not checking their inbox still sees the change.
 */
const notifyUser = (userId, { type = 'ACCOUNT', title, body, route = '/notifications', audience } = {}) => {
  if (!userId) return Promise.resolve(null);
  return notifyService
    .pushAndSocket(userId, {
      type,
      title,
      body,
      data: { route, ...(audience ? { audience } : {}) },
    })
    .catch((err) => {
      logger.warn('Admin notification failed (non-fatal)', { userId, title, error: err.message });
      return null;
    });
};

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * List all customers with optional search + status/kyc filters.
 */
const getAllCustomers = async ({ page = 1, limit = 20, search, status, kycStatus }) => {
  const where = {
    role: 'CUSTOMER',
    ...(status && { status }),
    ...(kycStatus && { kycStatus }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        state: true,
        lga: true,
        role: true,
        status: true,
        kycStatus: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { customers, total, page, limit };
};

/**
 * Invalidate the socket-auth cache for a user, and force-disconnect any of
 * their currently-open sockets when their access has been revoked. The user
 * sits in the `user:{userId}` room; we ask every connection in that room to
 * terminate so the next reconnect re-runs the handshake auth check.
 */
const invalidateCustomerSockets = (userId, { forceDisconnect = false } = {}) => {
  try {
    const { invalidateUserAuthCache, getIO } = require('../../sockets');
    invalidateUserAuthCache(userId);
    if (forceDisconnect) {
      try {
        const io = getIO();
        io.in(`user:${userId}`).disconnectSockets();
      } catch (_) {}
    }
  } catch (_) {}
};

/**
 * Suspend, deactivate, or reactivate a customer. Refuses to act on non-CUSTOMER
 * users - vendors have their own status endpoints.
 */
const updateCustomerStatus = async (customerId, status, reason, adminUserId, ipAddress, userAgent) => {
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, role: true, status: true, firstName: true, lastName: true, email: true },
  });
  if (!user) throw AppError.notFound('Customer not found');
  if (user.role !== 'CUSTOMER') throw AppError.badRequest('Not a customer account');
  if (user.status === status) throw AppError.badRequest(`Customer is already ${status}`);

  const userId = customerId;
  const revoking = status === 'SUSPENDED' || status === 'DEACTIVATED';

  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });

  await createAuditLog(
    adminUserId,
    'UPDATE_CUSTOMER_STATUS',
    'CUSTOMER',
    userId,
    { from: user.status, to: status, reason: reason || null },
    ipAddress,
    userAgent,
  );

  logger.info('Customer status updated', { customerId, from: user.status, to: status, reason });

  invalidateCustomerSockets(userId, { forceDisconnect: revoking });

  return updated;
};

/**
 * Granular customer edit - any subset of profile fields, KYC status, and
 * account status. Records a diff in the audit log so each field change is
 * independently traceable. Mirrors the vendor-profile update pattern but is
 * field-level granular.
 */
const updateCustomer = async (customerId, data, adminUserId, ipAddress, userAgent) => {
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      role: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      address: true,
      state: true,
      lga: true,
      dateOfBirth: true,
      kycStatus: true,
      status: true,
    },
  });
  if (!user) throw AppError.notFound('Customer not found');
  if (user.role !== 'CUSTOMER') throw AppError.badRequest('Not a customer account');

  const { reason, ...rest } = data;

  const profileFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'state', 'lga', 'dateOfBirth', 'kycStatus', 'status'];
  const updateData = {};
  const changes = {};

  for (const key of profileFields) {
    if (rest[key] === undefined) continue;
    const before = user[key];
    const after = rest[key];
    const beforeISO = before instanceof Date ? before.toISOString() : before;
    const afterISO = after instanceof Date ? after.toISOString() : after;
    if (beforeISO !== afterISO) {
      updateData[key] = after;
      changes[key] = { from: beforeISO ?? null, to: afterISO ?? null };
    }
  }

  if (Object.keys(changes).length === 0) {
    throw AppError.badRequest('No changes detected');
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: customerId },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        state: true,
        lga: true,
        dateOfBirth: true,
        kycStatus: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
      throw AppError.conflict(`Field already in use: ${target || 'unique constraint'}`);
    }
    throw err;
  }

  await createAuditLog(
    adminUserId,
    'UPDATE_CUSTOMER',
    'CUSTOMER',
    customerId,
    { changes, reason: reason || null },
    ipAddress,
    userAgent,
  );

  logger.info('Customer updated by admin', { customerId, fields: Object.keys(changes), reason });

  // Revoke active sessions when access-relevant fields change.
  const accessChanged = 'status' in changes || 'email' in changes || 'phone' in changes;
  if (accessChanged) {
    const forceDisconnect =
      changes.status?.to === 'SUSPENDED' || changes.status?.to === 'DEACTIVATED';
    invalidateCustomerSockets(customerId, { forceDisconnect });
  }

  // Tell the account owner what changed. Status changes are account-critical;
  // email/phone changes are a security alert (they are login identifiers).
  if (changes.status) {
    const next = String(changes.status.to || '').toUpperCase();
    notifyUser(customerId, {
      title: next === 'ACTIVE' ? 'Account reactivated' : `Account ${next.toLowerCase()}`,
      body: next === 'ACTIVE'
        ? 'Your Marketplace account is active again. Welcome back.'
        : `Your account status is now ${next.toLowerCase()}${reason ? `: ${reason}` : '.'}`,
      audience: 'customer',
    });
  } else if ('email' in changes || 'phone' in changes) {
    notifyUser(customerId, {
      title: 'Account details updated',
      body: 'Your login details were updated by Marketplace support. If this was not you, contact support immediately.',
      audience: 'customer',
    });
  }

  return updated;
};

/**
 * Shared identity-field editor for a role's *linked user account* (vendor
 * owner). End users can't change their own email/phone in-app - those
 * are login credentials, so the apps tell them to contact support - this is the
 * admin-side correction path. Updates firstName/lastName/email/phone on the
 * User row, records a field-level audit diff, and revokes the user's live
 * sessions when an access-relevant field (email/phone) changes so the next
 * request re-runs auth. Mirrors updateCustomer without the customer-only
 * KYC/status side-effects.
 */
const updateLinkedUserAccount = async ({
  userId,
  entityId,
  entityType,
  auditAction,
  data,
  adminUserId,
  ipAddress,
  userAgent,
}) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  if (!user) throw AppError.notFound('User account not found');

  const { reason, ...rest } = data;
  const fields = ['firstName', 'lastName', 'email', 'phone'];
  const updateData = {};
  const changes = {};
  for (const key of fields) {
    if (rest[key] === undefined) continue;
    if (user[key] !== rest[key]) {
      updateData[key] = rest[key];
      changes[key] = { from: user[key] ?? null, to: rest[key] ?? null };
    }
  }

  if (Object.keys(changes).length === 0) {
    throw AppError.badRequest('No changes detected');
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
      throw AppError.conflict(`Field already in use: ${target || 'unique constraint'}`);
    }
    throw err;
  }

  await createAuditLog(
    adminUserId,
    auditAction,
    entityType,
    entityId,
    { changes, reason: reason || null },
    ipAddress,
    userAgent,
  );

  logger.info('User account updated by admin', {
    entityType,
    entityId,
    userId,
    fields: Object.keys(changes),
    reason,
  });

  // Email/phone are access-relevant (login identifiers) - drop live sessions so
  // the user re-authenticates with the new credentials.
  if ('email' in changes || 'phone' in changes) {
    invalidateCustomerSockets(userId, { forceDisconnect: false });
  }

  notifyUser(userId, {
    title: 'Account details updated',
    body: 'Your account details were updated by Marketplace support. If this was not you, contact support immediately.',
  });

  return updated;
};

/**
 * Admin edit of a vendor owner's account identity (name/email/phone). This
 * is the login email on the linked User - distinct from the vendor's public
 * business email edited via updateVendorProfile. Standalone vendors with no
 * linked user account can't be edited here.
 */
const updateVendorAccount = async (vendorId, data, adminUserId, ipAddress, userAgent) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, userId: true },
  });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (!vendor.userId) throw AppError.badRequest('This vendor has no linked user account to edit');

  return updateLinkedUserAccount({
    userId: vendor.userId,
    entityId: vendorId,
    entityType: 'VENDOR',
    auditAction: 'UPDATE_VENDOR_ACCOUNT',
    data,
    adminUserId,
    ipAddress,
    userAgent,
  });
};

/**
 * Get a single customer with profile, wallet, and lightweight activity counts.
 * Rejects non-CUSTOMER roles so admins can't accidentally use customer-only
 * endpoints to peek at vendor records.
 */
const getCustomerById = async (customerId) => {
  const user = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      profilePicture: true,
      dateOfBirth: true,
      address: true,
      state: true,
      lga: true,
      kycStatus: true,
      role: true,
      status: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      // One account can also run a store. Surfaced so the admin UI can warn
      // that suspending this person (account-level) bans that facet too.
      vendor: { select: { id: true, status: true } },
    },
  });
  if (!user) throw AppError.notFound('Customer not found');

  const [orderCount, addressCount] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.savedAddress.count({ where: { userId: customerId } }),
  ]);

  const { vendor, ...safeUser } = user;
  return {
    ...safeUser,
    counts: { orders: orderCount, addresses: addressCount },
    // Null when this user only acts as a customer. Drives the cross-facet
    // suspension warning - account suspension blocks that facet too.
    otherProfiles: {
      vendor: vendor ? { id: vendor.id, status: vendor.status } : null,
    },
  };
};

/**
 * Roster-level customer counts for the management dashboard KPI cards.
 */
const getCustomerStats = async () => {
  const base = { role: 'CUSTOMER', deletedAt: null };
  const [total, active, suspended, kycVerified, kycPending] = await Promise.all([
    prisma.user.count({ where: base }),
    prisma.user.count({ where: { ...base, status: 'ACTIVE' } }),
    prisma.user.count({ where: { ...base, status: 'SUSPENDED' } }),
    prisma.user.count({ where: { ...base, kycStatus: 'VERIFIED' } }),
    prisma.user.count({ where: { ...base, kycStatus: 'PENDING' } }),
  ]);
  return { total, active, suspended, kycVerified, kycPending };
};

/**
 * Wipe a customer's KYC status back to NONE so they can re-verify from scratch.
 */
const wipeCustomerKyc = async (customerId, reason, adminUserId, ipAddress, userAgent) => {
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, role: true, kycStatus: true },
  });
  if (!user) throw AppError.notFound('Customer not found');
  if (user.role !== 'CUSTOMER') throw AppError.badRequest('Not a customer account');
  if (user.kycStatus === 'NONE') {
    throw AppError.badRequest('No KYC data to wipe');
  }

  const updated = await prisma.user.update({
    where: { id: customerId },
    data: { kycStatus: 'NONE' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      kycStatus: true,
      status: true,
    },
  });

  await createAuditLog(
    adminUserId,
    'WIPE_CUSTOMER_KYC',
    'CUSTOMER',
    customerId,
    { previousKycStatus: user.kycStatus, reason },
    ipAddress,
    userAgent,
  );

  logger.info('Customer KYC wiped by admin', { customerId, reason });

  // Drop session caches - old JWTs may carry stale kyc-derived claims, and
  // the user's verification screen needs a fresh load.
  invalidateCustomerSockets(customerId);

  return updated;
};

/**
 * Paginated order history for a customer.
 */
const getCustomerOrders = async ({ customerId, page = 1, limit = 20, status }) => {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true },
  });
  if (!customer) throw AppError.notFound('Customer not found');

  const where = { customerId, ...(status && { status }) };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        vendor: { select: { id: true, name: true } },
        shippingAddress: { select: { label: true, address: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
};

/**
 * Saved addresses for a customer.
 */
const getCustomerAddresses = async (customerId) => {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true },
  });
  if (!customer) throw AppError.notFound('Customer not found');

  return prisma.savedAddress.findMany({
    where: { userId: customerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
};

/**
 * Get platform dashboard stats.
 */
const ACTIVE_ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED'];

const getDashboardStats = async () => {
  const [totalUsers, totalVendors, totalOrders, activeOrders] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    prisma.vendor.count({ where: { status: 'APPROVED' } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ACTIVE_ORDER_STATUSES } } }),
  ]);

  return {
    totalUsers,
    totalVendors,
    totalOrders,
    activeOrders,
  };
};

// ============================================================
// Admin Order Management
// ============================================================

/**
 * Relations every admin-facing order payload carries. Mutations reuse this
 * so the row the dashboard swaps into its list keeps its customer/vendor
 * names instead of degrading to a bare record.
 */
const ADMIN_ORDER_INCLUDE = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  vendor: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  },
  shippingAddress: true,
  items: true,
  discountCode: { select: { id: true, code: true } },
};

const buildOrdersWhere = ({ status, source, categoryId, categorySlug, startDate, endDate, search }) => {
  // Both date bounds must land in the same createdAt object - spreading them
  // separately would overwrite gte with lte when both are set. A date-only
  // endDate ("2026-07-14") means "through the end of that day", so it becomes
  // an exclusive bound on the following midnight.
  const createdAt = {};
  if (startDate) createdAt.gte = new Date(startDate);
  if (endDate) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      const nextDay = new Date(endDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      createdAt.lt = nextDay;
    } else {
      createdAt.lte = new Date(endDate);
    }
  }

  // Every whitespace-separated term must match somewhere on the order (id),
  // its customer, or vendor - same shape as the vendor search. IDs get pasted
  // from the dashboard as "#8bb74672" - drop the prefix.
  const terms = (search || '')
    .split(/\s+/)
    .map((t) => t.replace(/^#/, ''))
    .filter(Boolean);

  return {
    ...(categoryId && { vendor: { is: { products: { some: { isAvailable: true, categoryId } } } } }),
    ...(categorySlug && { vendor: { is: { products: { some: { isAvailable: true, category: { is: { slug: categorySlug } } } } } } }),
    ...((startDate || endDate) && { createdAt }),
    ...(terms.length > 0 && {
      AND: terms.map((t) => ({
        OR: [
          { id: { contains: t, mode: 'insensitive' } },
          { customer: { is: { firstName: { contains: t, mode: 'insensitive' } } } },
          { customer: { is: { lastName: { contains: t, mode: 'insensitive' } } } },
          { customer: { is: { phone: { contains: t, mode: 'insensitive' } } } },
          { customer: { is: { email: { contains: t, mode: 'insensitive' } } } },
          { vendor: { is: { name: { contains: t, mode: 'insensitive' } } } },
        ],
      })),
    }),
  };
};

const getAllOrders = async ({ page = 1, limit = 20, status, source, ...filters }) => {
  const where = { ...(status && { status }), ...(source && { source }), ...buildOrdersWhere(filters) };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: ADMIN_ORDER_INCLUDE,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
};

/**
 * Single order with everything the detail modal shows, including the
 * customer's rating.
 */
const getOrderById = async (orderId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      ...ADMIN_ORDER_INCLUDE,
      rating: true,
    },
  });
  if (!order) throw AppError.notFound('Order not found');
  return order;
};

/**
 * Headline counts for the orders console: live workload plus today's outcomes.
 */
const getOrderStats = async () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [active, deliveredToday, cancelledToday] = await Promise.all([
    prisma.order.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.order.count({ where: { deliveredAt: { gte: startOfToday } } }),
    prisma.order.count({ where: { cancelledAt: { gte: startOfToday } } }),
  ]);

  return { active, deliveredToday, cancelledToday };
};

/** Hard cap so an unbounded export can't pull the whole table into memory. */
const EXPORT_MAX_ROWS = 5000;

/**
 * Full filtered result set (not just the current page) for CSV export.
 */
const exportOrders = async (filters) => {
  return prisma.order.findMany({
    where: buildOrdersWhere(filters),
    orderBy: { createdAt: 'desc' },
    take: EXPORT_MAX_ROWS,
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true, email: true } },
      vendor: { select: { name: true } },
      shippingAddress: { select: { address: true } },
    },
  });
};

/**
 * Force cancel an order with reason. Bypasses the normal transition rules
 * (that is the point - unsticking orders the FSM can no longer move) and
 * restores the reserved stock - there's no payment to refund.
 */
const forceCancelOrder = async (orderId, reason, adminUserId, ipAddress, userAgent) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, vendor: { select: { userId: true } } },
  });
  if (!order) throw AppError.notFound('Order not found');
  if (['CANCELLED', 'DELIVERED'].includes(order.status)) {
    throw AppError.badRequest('Cannot cancel order in current status');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: 'admin',
        cancellationReason: reason,
      },
      include: ADMIN_ORDER_INCLUDE,
    });

    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity }, isAvailable: true },
        });
      }
    }

    return updatedOrder;
  });

  await createAuditLog(
    adminUserId,
    'FORCE_CANCEL_ORDER',
    'ORDER',
    orderId,
    { reason, previousStatus: order.status },
    ipAddress,
    userAgent,
  );

  logger.info('Order force cancelled by admin', { orderId, reason, adminUserId });

  try {
    getIO().to(getOrderRoom(orderId)).emit(ORDER.CANCELLED, {
      orderId,
      reason,
      cancelledBy: 'ADMIN',
    });
  } catch (err) {
    logger.warn('Socket emit failed for force cancel', { orderId, error: err.message });
  }

  // Socket events only reach clients that are currently connected. Persist a
  // Notification row + push for both parties so an admin cancellation is not
  // missed while the app is backgrounded.
  notifyUser(order.customerId, {
    type: 'ORDER_STATUS',
    title: 'Order cancelled',
    body: `Your order was cancelled by Marketplace support${reason ? `: ${reason}` : '.'}`,
    route: `/order/${orderId}`,
    audience: 'customer',
  });
  notifyUser(order.vendor?.userId, {
    type: 'ORDER',
    title: 'Order cancelled by support',
    body: `An order was cancelled by Marketplace support${reason ? `: ${reason}` : '.'}`,
    route: `/vendor/orders/${orderId}`,
    audience: 'vendor',
  });

  return updated;
};

/**
 * Admin override to move an order one step along its lifecycle. Delegates to
 * the canonical order-service updateStatus so transition validation,
 * lifecycle timestamps, socket events, and the settlement queue all behave
 * exactly as they do for customer/vendor updates.
 */
const adminUpdateOrderStatus = async (orderId, status, reason, adminUserId, ipAddress, userAgent) => {
  if (status === 'CANCELLED') {
    throw AppError.badRequest('Use the cancel endpoint to cancel an order');
  }

  const previous = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!previous) throw AppError.notFound('Order not found');

  await orderService.updateStatus(orderId, status, adminUserId, 'ADMIN', {
    reason: reason || 'Admin override',
  });

  await createAuditLog(
    adminUserId,
    'OVERRIDE_ORDER_STATUS',
    'ORDER',
    orderId,
    { from: previous.status, to: status, reason },
    ipAddress,
    userAgent,
  );

  logger.info('Order status updated by admin', { orderId, status, reason, adminUserId });

  return getOrderById(orderId);
};

// ============================================================
// Admin Vendor Management
// ============================================================

/**
 * List all vendors with filtering.
 */
const getAllVendors = async ({ page = 1, limit = 20, categoryId, categorySlug, status, search }) => {
  // Each search term must match somewhere on the vendor (business name/contact)
  // or its owning user, so multi-word queries like "john bakery" match across fields.
  const terms = (search || '').split(/\s+/).filter(Boolean);
  const where = {
    ...(categoryId && { products: { some: { isAvailable: true, categoryId } } }),
    ...(categorySlug && { products: { some: { isAvailable: true, category: { is: { slug: categorySlug } } } } }),
    ...(status && { status }),
    ...(terms.length > 0 && {
      AND: terms.map((t) => ({
        OR: [
          { name: { contains: t, mode: 'insensitive' } },
          { email: { contains: t, mode: 'insensitive' } },
          { phone: { contains: t, mode: 'insensitive' } },
          { user: { is: { firstName: { contains: t, mode: 'insensitive' } } } },
          { user: { is: { lastName: { contains: t, mode: 'insensitive' } } } },
          { user: { is: { email: { contains: t, mode: 'insensitive' } } } },
        ],
      })),
    }),
  };

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
    prisma.vendor.count({ where }),
  ]);

  // Attach each shop's derived categories (from its available products).
  const categoriesByVendor = await deriveVendorCategories(vendors.map((v) => v.id));
  const withCategories = vendors.map((v) => ({ ...v, categories: categoriesByVendor.get(v.id) || [] }));

  return { vendors: withCategories, total, page, limit };
};

/**
 * Vendor counts per status. Powers the admin "Pending approval" tab badge,
 * the Vendors nav badge and the dashboard stat.
 */
const getVendorStatusCounts = async () => {
  const rows = await prisma.vendor.groupBy({ by: ['status'], _count: { _all: true } });
  const counts = { PENDING_APPROVAL: 0, APPROVED: 0, SUSPENDED: 0, REJECTED: 0, total: 0 };
  for (const row of rows) {
    counts[row.status] = row._count._all;
    counts.total += row._count._all;
  }
  return counts;
};

/**
 * Get single vendor by ID with full detail.
 */
const getVendorById = async (vendorId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
        },
      },
      tags: { include: { tag: true } },
    },
  });
  if (!vendor) throw AppError.notFound('Vendor not found');
  return vendor;
};

/**
 * Approve a pending vendor.
 */
const approveVendor = async (vendorId, adminUserId, ipAddress, userAgent) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { user: { select: { email: true, firstName: true } } },
  });
  if (!vendor) throw AppError.notFound('Vendor not found');
  // PENDING_APPROVAL is the normal path; REJECTED is the admin "changed my mind"
  // path - approving a rejected vendor reverses the rejection and clears the
  // stale reason so it doesn't linger on the now-active profile.
  if (vendor.status !== 'PENDING_APPROVAL' && vendor.status !== 'REJECTED') {
    throw AppError.badRequest('Only a pending or rejected vendor can be approved');
  }
  const reversedRejection = vendor.status === 'REJECTED';

  const missingLocation = missingVendorLocation(vendor);
  if (missingLocation.length) {
    throw AppError.badRequest(
      'Complete the shop location before approving this vendor',
      {
        code: 'VENDOR_LOCATION_REQUIRED',
        errors: missingLocation.map((field) => ({
          field,
          message: field === 'location'
            ? 'Drop a real map pin (0,0 is not accepted)'
            : `${field} is required`,
        })),
      },
    );
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'APPROVED', rejectionReason: null },
  });

  await createAuditLog(adminUserId, 'APPROVE_VENDOR', 'VENDOR', vendorId, { vendorName: vendor.name, reversedRejection }, ipAddress, userAgent);

  logger.info('Vendor approved', { vendorId, reversedRejection });

  const recipientEmail = vendor.email || vendor.user?.email;
  if (recipientEmail) {
    const dashboardUrl = await buildVendorLoginLink(vendor.userId);
    emailService.sendVendorApprovedEmail(recipientEmail, vendor.name, dashboardUrl).catch((err) =>
      logger.error('Failed to send vendor approved email', { vendorId, err: err.message })
    );
  }

  notifyUser(vendor.userId, {
    type: 'ACCOUNT',
    title: 'Vendor approved',
    body: `${vendor.name} is now live on Marketplace. Open your dashboard to start selling.`,
    route: '/vendor/dashboard',
    audience: 'vendor',
  });

  return updated;
};

/**
 * Reject a pending vendor.
 */
const rejectVendor = async (vendorId, reason, adminUserId, ipAddress, userAgent) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { user: { select: { email: true } } },
  });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (vendor.status !== 'PENDING_APPROVAL') throw AppError.badRequest('Vendor is not pending approval');

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'REJECTED', rejectionReason: reason },
  });

  await createAuditLog(adminUserId, 'REJECT_VENDOR', 'VENDOR', vendorId, { vendorName: vendor.name, reason }, ipAddress, userAgent);

  logger.info('Vendor rejected', { vendorId, reason });

  const recipientEmail = vendor.email || vendor.user?.email;
  if (recipientEmail) {
    emailService.sendVendorRejectedEmail(recipientEmail, vendor.name, reason).catch((err) =>
      logger.error('Failed to send vendor rejected email', { vendorId, err: err.message })
    );
  }

  notifyUser(vendor.userId, {
    type: 'ACCOUNT',
    title: 'Vendor application rejected',
    body: `${vendor.name} was not approved${reason ? `: ${reason}` : '.'} You can update your details and reapply.`,
    route: '/vendor/account/rejected',
    audience: 'vendor',
  });

  return updated;
};

/**
 * Suspend a vendor.
 */
const suspendVendor = async (vendorId, reason, adminUserId, ipAddress, userAgent) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { user: { select: { email: true } } },
  });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (vendor.status === 'SUSPENDED') throw AppError.badRequest('Vendor is already suspended');

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'SUSPENDED', suspensionReason: reason },
  });

  await createAuditLog(adminUserId, 'SUSPEND_VENDOR', 'VENDOR', vendorId, { vendorName: vendor.name, reason }, ipAddress, userAgent);

  logger.info('Vendor suspended', { vendorId, reason });

  const recipientEmail = vendor.email || vendor.user?.email;
  if (recipientEmail) {
    emailService.sendVendorSuspendedEmail(recipientEmail, vendor.name, reason).catch((err) =>
      logger.error('Failed to send vendor suspended email', { vendorId, err: err.message })
    );
  }

  notifyUser(vendor.userId, {
    type: 'ACCOUNT',
    title: 'Shop suspended',
    body: `${vendor.name} has been suspended${reason ? `: ${reason}` : '.'} Contact support to appeal.`,
    route: '/vendor/account/suspended',
    audience: 'vendor',
  });

  return updated;
};

/**
 * Unsuspend a vendor.
 */
const unsuspendVendor = async (vendorId, adminUserId, ipAddress, userAgent) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { user: { select: { email: true } } },
  });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (vendor.status !== 'SUSPENDED') throw AppError.badRequest('Vendor is not suspended');

  const missingLocation = missingVendorLocation(vendor);
  if (missingLocation.length) {
    throw AppError.badRequest(
      'Complete the shop location before reinstating this vendor',
      {
        code: 'VENDOR_LOCATION_REQUIRED',
        errors: missingLocation.map((field) => ({
          field,
          message: field === 'location'
            ? 'Drop a real map pin (0,0 is not accepted)'
            : `${field} is required`,
        })),
      },
    );
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'APPROVED', suspensionReason: null },
  });

  await createAuditLog(adminUserId, 'UNSUSPEND_VENDOR', 'VENDOR', vendorId, { vendorName: vendor.name }, ipAddress, userAgent);

  logger.info('Vendor unsuspended', { vendorId });

  const recipientEmail = vendor.email || vendor.user?.email;
  if (recipientEmail) {
    const dashboardUrl = await buildVendorLoginLink(vendor.userId);
    emailService.sendVendorUnsuspendedEmail(recipientEmail, vendor.name, dashboardUrl).catch((err) =>
      logger.error('Failed to send vendor unsuspended email', { vendorId, err: err.message })
    );
  }

  notifyUser(vendor.userId, {
    type: 'ACCOUNT',
    title: 'Shop reinstated',
    body: `${vendor.name} is live again. Welcome back.`,
    route: '/vendor/dashboard',
    audience: 'vendor',
  });

  return updated;
};

/**
 * Update vendor core profile (admin override).
 */
const updateVendorProfile = async (vendorId, data, adminUserId, ipAddress, userAgent) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');

  const allowedFields = [
    'name', 'description', 'phone', 'email', 'address', 'state', 'lga', 'lat', 'lng',
    'openingTime', 'closingTime', 'openingDays', 'logoUrl', 'coverImageUrl',
    'photos', 'policies', 'adminActiveOverride',
  ];
  const updateData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: updateData,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      tags: { include: { tag: true } },
    },
  });

  await createAuditLog(adminUserId, 'UPDATE_VENDOR_PROFILE', 'VENDOR', vendorId, { fields: Object.keys(updateData) }, ipAddress, userAgent);

  logger.info('Vendor profile updated by admin', { vendorId, fields: Object.keys(updateData) });

  // Admin's visibility override affects the vendor's *effective* open
  // status just as much as the vendor's own toggle, so broadcast the same
  // way so browse screens and the dashboard stay live.
  if (updateData.adminActiveOverride !== undefined) {
    const vendorService = require('../vendor/vendor.service');
    vendorService.broadcastVendorStatus(updated);
  }

  notifyUser(vendor.userId, {
    type: 'SYSTEM',
    title: 'Shop profile updated',
    body: 'Marketplace support updated your shop profile. Open your shop settings to review it.',
    route: '/vendor/shop',
    audience: 'vendor',
  });

  return updated;
};

/**
 * Get per-vendor analytics.
 */
const getVendorAnalytics = async (vendorId, { startDate, endDate, period = 'daily' }) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });
  if (!vendor) throw AppError.notFound('Vendor not found');

  const dateFilter = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate && { lte: new Date(endDate) }),
  };
  const orderWhere = {
    vendorId,
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
  };

  const [
    totalOrders,
    completedOrders,
    cancelledOrders,
    revenueStats,
    ratingStats,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: orderWhere }),
    prisma.order.count({ where: { ...orderWhere, status: 'DELIVERED' } }),
    prisma.order.count({ where: { ...orderWhere, status: 'CANCELLED' } }),
    prisma.order.aggregate({
      where: { ...orderWhere, status: 'DELIVERED' },
      _sum: { subtotal: true },
      _avg: { subtotal: true },
      _count: true,
    }),
    prisma.rating.aggregate({
      where: {
        order: { vendorId },
        vendorScore: { not: null },
      },
      _avg: { vendorScore: true },
      _count: { vendorScore: true },
    }),
    prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, status: true, subtotal: true, total: true, createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  // Revenue trend (daily or weekly grouped)
  const startFilter = startDate ? Prisma.sql`AND "createdAt" >= ${new Date(startDate)}` : Prisma.empty;
  const endFilter = endDate ? Prisma.sql`AND "createdAt" <= ${new Date(endDate)}` : Prisma.empty;

  const trends = period === 'weekly'
    ? await prisma.$queryRaw`
        SELECT
          DATE_TRUNC('week', "createdAt") as period,
          COUNT(*) as orders,
          COALESCE(SUM("subtotal"), 0) as revenue
        FROM orders
        WHERE "vendorId" = ${vendorId}
          AND status = 'DELIVERED'
          ${startFilter}
          ${endFilter}
        GROUP BY DATE_TRUNC('week', "createdAt")
        ORDER BY period DESC
        LIMIT 12`
    : await prisma.$queryRaw`
        SELECT
          DATE("createdAt") as period,
          COUNT(*) as orders,
          COALESCE(SUM("subtotal"), 0) as revenue
        FROM orders
        WHERE "vendorId" = ${vendorId}
          AND status = 'DELIVERED'
          ${startFilter}
          ${endFilter}
        GROUP BY DATE("createdAt")
        ORDER BY period DESC
        LIMIT 30`;

  const acceptanceRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0;
  const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : 0;

  return {
    vendor: { id: vendor.id, name: vendor.name, status: vendor.status, averageRating: vendor.averageRating },
    summary: {
      totalOrders,
      completedOrders,
      cancelledOrders,
      acceptanceRate: parseFloat(acceptanceRate),
      cancellationRate: parseFloat(cancellationRate),
      totalRevenue: revenueStats._sum.subtotal || 0,
      averageOrderValue: revenueStats._avg.subtotal || 0,
      averageRating: ratingStats._avg.vendorScore || vendor.averageRating,
      totalRatings: ratingStats._count.vendorScore || 0,
    },
    trends,
    recentOrders,
  };
};

// ============================================================
// Tag Management
// ============================================================

/**
 * List all tags.
 */
const getAllTags = async ({ page = 1, limit = 50, category, isActive }) => {
  const where = {
    ...(category && { category }),
    ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
  };

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { vendors: true } },
      },
    }),
    prisma.tag.count({ where }),
  ]);

  return { tags, total, page, limit };
};

/**
 * Create a new global tag.
 */
const createTag = async ({ name, category, color, icon }, adminUserId, ipAddress, userAgent) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const existing = await prisma.tag.findUnique({ where: { slug } });
  if (existing) throw AppError.conflict(`Tag with slug "${slug}" already exists`);

  const tag = await prisma.tag.create({
    data: { name, slug, category: category || null, color: color || null, icon: icon || null },
  });

  await createAuditLog(adminUserId, 'CREATE_TAG', 'TAG', tag.id, { name, category }, ipAddress, userAgent);

  return tag;
};

/**
 * Update a tag.
 */
const updateTag = async (tagId, data, adminUserId, ipAddress, userAgent) => {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw AppError.notFound('Tag not found');

  const updated = await prisma.tag.update({
    where: { id: tagId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await createAuditLog(adminUserId, 'UPDATE_TAG', 'TAG', tagId, data, ipAddress, userAgent);

  return updated;
};

/**
 * Delete a tag.
 */
const deleteTag = async (tagId, adminUserId, ipAddress, userAgent) => {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw AppError.notFound('Tag not found');

  await prisma.tag.delete({ where: { id: tagId } });

  await createAuditLog(adminUserId, 'DELETE_TAG', 'TAG', tagId, { name: tag.name }, ipAddress, userAgent);
};

/**
 * Assign/replace tags on a vendor.
 */
const setVendorTags = async (vendorId, tagIds, adminUserId, ipAddress, userAgent) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');

  // Validate all tagIds exist
  const tags = await prisma.tag.findMany({ where: { id: { in: tagIds } } });
  if (tags.length !== tagIds.length) throw AppError.badRequest('One or more tag IDs are invalid');

  await prisma.$transaction([
    prisma.vendorTag.deleteMany({ where: { vendorId } }),
    ...tagIds.map((tagId) =>
      prisma.vendorTag.create({ data: { vendorId, tagId } })
    ),
  ]);

  await createAuditLog(adminUserId, 'SET_VENDOR_TAGS', 'VENDOR', vendorId, { tagIds }, ipAddress, userAgent);

  return prisma.vendorTag.findMany({
    where: { vendorId },
    include: { tag: true },
  });
};

// ============================================================
// Vendor Category Management
// ============================================================

const categoryService = require('../category/category.service');
const settingsService = require('../../services/settings.service');

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * List all categories (admin view - includes inactive + vendor counts).
 */
const getAllCategories = async ({ page = 1, limit = 50, isActive } = {}) => {
  const where = {
    ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
  };

  const [categories, total] = await Promise.all([
    prisma.vendorCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { vendors: true, products: true } },
        owner: { select: { id: true, name: true } },
        // EVERY subcategory (global + vendor-created) is returned inline so the
        // dashboard can render the ownership-grouped tree, and its counts, in a
        // single request. Previously the UI fired one request per category
        // (N+1) and only ever saw the global rows.
        subcategories: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            sortOrder: true,
            isActive: true,
            vendorId: true,
            owner: { select: { id: true, name: true } },
            _count: { select: { products: true } },
          },
        },
      },
    }),
    prisma.vendorCategory.count({ where }),
  ]);

  // Vendors actually selling in each category - distinct vendors with an
  // AVAILABLE product filed under it. More meaningful than the `vendors`
  // relation (which is the explicit "industry" link) and computed for the
  // whole page in one grouped query.
  const catIds = categories.map((c) => c.id);
  const productRows = catIds.length
    ? await prisma.product.groupBy({
        by: ['categoryId', 'vendorId'],
        where: { isAvailable: true, categoryId: { in: catIds } },
      })
    : [];
  const vendorCounts = new Map();
  productRows.forEach((row) => vendorCounts.set(row.categoryId, (vendorCounts.get(row.categoryId) || 0) + 1));

  const enriched = categories.map((c) => ({
    ...c,
    vendorCount: vendorCounts.get(c.id) || 0,
    subcategories: c.subcategories.map((s) => ({ ...s, owned: !!s.vendorId })),
  }));

  return { categories: enriched, total, page, limit };
};

/**
 * Create a vendor category.
 */
const createCategory = async (
  { name, slug, description, icon, color, imageUrl, sortOrder, hasPreparation, attributeSchema },
  adminUserId,
  ipAddress,
  userAgent,
) => {
  const finalSlug = (slug && slugify(slug)) || slugify(name);
  if (!finalSlug) throw AppError.badRequest('Category name produces an empty slug');

  const existing = await prisma.vendorCategory.findFirst({
    where: { OR: [{ slug: finalSlug }, { name }] },
  });
  if (existing) {
    throw AppError.conflict(
      existing.slug === finalSlug
        ? `Category with slug "${finalSlug}" already exists`
        : `Category with name "${name}" already exists`,
    );
  }

  const category = await prisma.vendorCategory.create({
    data: {
      name,
      slug: finalSlug,
      description: description || null,
      icon: icon || null,
      color: color || null,
      imageUrl: imageUrl || null,
      sortOrder: sortOrder ?? 0,
      hasPreparation: hasPreparation ?? true,
      attributeSchema: attributeSchema || null,
    },
  });

  await createAuditLog(
    adminUserId,
    'CREATE_CATEGORY',
    'VENDOR_CATEGORY',
    category.id,
    { name, slug: finalSlug },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return category;
};

/**
 * Update a vendor category.
 */
const updateCategory = async (categoryId, data, adminUserId, ipAddress, userAgent) => {
  const category = await prisma.vendorCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.notFound('Category not found');

  // Slug uniqueness check if it's changing
  if (data.slug && data.slug !== category.slug) {
    const slug = slugify(data.slug);
    const clash = await prisma.vendorCategory.findFirst({
      where: { slug, NOT: { id: categoryId } },
    });
    if (clash) throw AppError.conflict(`Category with slug "${slug}" already exists`);
    data.slug = slug;
  }

  // Name uniqueness check if it's changing
  if (data.name && data.name !== category.name) {
    const clash = await prisma.vendorCategory.findFirst({
      where: { name: data.name, NOT: { id: categoryId } },
    });
    if (clash) throw AppError.conflict(`Category with name "${data.name}" already exists`);
  }

  const updated = await prisma.vendorCategory.update({
    where: { id: categoryId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.hasPreparation !== undefined && { hasPreparation: data.hasPreparation }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.attributeSchema !== undefined && { attributeSchema: data.attributeSchema }),
    },
  });

  await createAuditLog(
    adminUserId,
    'UPDATE_CATEGORY',
    'VENDOR_CATEGORY',
    categoryId,
    data,
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return updated;
};

/**
 * Replace a category's attributeSchema in one call.
 * Passing `null` clears the schema; passing an object replaces it.
 */
const updateCategoryAttributeSchema = async (categoryId, attributeSchema, adminUserId, ipAddress, userAgent) => {
  const category = await prisma.vendorCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.notFound('Category not found');

  const updated = await prisma.vendorCategory.update({
    where: { id: categoryId },
    data: { attributeSchema: attributeSchema ?? null },
  });

  await createAuditLog(
    adminUserId,
    'UPDATE_CATEGORY_ATTRIBUTE_SCHEMA',
    'VENDOR_CATEGORY',
    categoryId,
    { attributeSchema },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return updated;
};

/**
 * Delete a vendor category.
 *
 * - Soft-delete (isActive=false) when vendors are still attached.
 * - Hard-delete only when zero vendors reference it.
 * - Never breaks the FK; this protects historical order data that joins through vendor.category.
 */
const deleteCategory = async (categoryId, adminUserId, ipAddress, userAgent) => {
  const category = await prisma.vendorCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { vendors: true, products: true } } },
  });
  if (!category) throw AppError.notFound('Category not found');

  const vendorCount = category._count.vendors;
  const productCount = category._count.products;

  // A category that is still referenced cannot be hard-deleted: products hold a
  // REQUIRED FK to it, so the delete would throw a raw constraint error. When
  // anything still uses it, deactivate instead - it disappears from the public
  // taxonomy while products, vendors and order history stay intact (reversible).
  if (vendorCount > 0 || productCount > 0) {
    const updated = await prisma.vendorCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    await createAuditLog(
      adminUserId,
      'DEACTIVATE_CATEGORY',
      'VENDOR_CATEGORY',
      categoryId,
      { name: category.name, vendorCount, productCount },
      ipAddress,
      userAgent,
    );

    categoryService.invalidateCache();
    return { soft: true, vendorCount, productCount, category: updated };
  }

  await prisma.vendorCategory.delete({ where: { id: categoryId } });

  await createAuditLog(
    adminUserId,
    'DELETE_CATEGORY',
    'VENDOR_CATEGORY',
    categoryId,
    { name: category.name },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return { soft: false, vendorCount: 0, productCount: 0 };
};

/**
 * Reorder global categories in one transaction. Only admin-owned (global) rows
 * can be reordered - vendor-created rows are private to their vendor and are
 * managed from the vendor's own dashboard.
 */
const reorderCategories = async (items, adminUserId, ipAddress, userAgent) => {
  const ids = items.map((i) => i.id);
  const owned = await prisma.vendorCategory.findMany({
    where: { id: { in: ids }, vendorId: null },
    select: { id: true },
  });
  if (owned.length !== ids.length) {
    throw AppError.badRequest('Only global categories can be reordered');
  }

  await prisma.$transaction(
    items.map((item) => prisma.vendorCategory.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })),
  );

  await createAuditLog(adminUserId, 'REORDER_CATEGORIES', 'VENDOR_CATEGORY', 'global', { count: items.length }, ipAddress, userAgent);
  categoryService.invalidateCache();
  return { updated: items.length };
};

// ============================================================
// Home categories (customer app Home grid layout)
// ============================================================

const HOME_CATEGORIES_KEY = 'home.categories';

/**
 * Return every global category annotated with whether it is featured on the
 * customer app Home grid and its current position there. Powers the admin
 * drag-and-drop editor.
 */
const getHomeCategories = async () => {
  const [categories, setting] = await Promise.all([
    prisma.vendorCategory.findMany({
      where: { vendorId: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        icon: true,
        color: true,
        isActive: true,
        _count: { select: { products: true, subcategories: true } },
      },
    }),
    settingsService.getSetting(HOME_CATEGORIES_KEY, { items: [] }),
  ]);

  const orderMap = new Map();
  const featuredIds = [];
  const items = Array.isArray(setting?.items) ? setting.items : [];
  items.forEach((item, index) => {
    if (item && item.id) {
      orderMap.set(item.id, index);
      if (item.featured) featuredIds.push(item.id);
    }
  });

  const enriched = categories.map((c) => ({
    ...c,
    featured: featuredIds.includes(c.id),
    homePosition: orderMap.has(c.id) ? orderMap.get(c.id) : null,
  }));

  // Featured first, in their saved order; the rest after, by the normal order.
  enriched.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.featured && b.featured) return (a.homePosition ?? 0) - (b.homePosition ?? 0);
    return 0;
  });

  return { categories: enriched, featuredIds };
};

/**
 * Persist the Home grid layout: an ordered list of { id, featured }. Order is
 * the array order. Only global (admin-owned) category ids are accepted, and
 * unknown ids are rejected so a stale client can't store junk.
 */
const updateHomeCategories = async (items, adminUserId, ipAddress, userAgent) => {
  const list = Array.isArray(items) ? items : [];
  const ids = list.map((i) => i.id);

  if (ids.length) {
    const owned = await prisma.vendorCategory.findMany({
      where: { id: { in: ids }, vendorId: null },
      select: { id: true },
    });
    if (owned.length !== new Set(ids).size) {
      throw AppError.badRequest('Only global categories can be added to the Home grid');
    }
  }

  const value = {
    items: list.map((i) => ({ id: i.id, featured: !!i.featured })),
  };

  await settingsService.setSetting(HOME_CATEGORIES_KEY, value, adminUserId);
  await createAuditLog(
    adminUserId,
    'UPDATE_HOME_CATEGORIES',
    'VENDOR_CATEGORY',
    'global',
    { count: value.items.length, featured: value.items.filter((i) => i.featured).length },
    ipAddress,
    userAgent,
  );

  return { updated: value.items.length, items: value.items };
};

// ============================================================
// Subcategory management
// ============================================================

/**
 * List subcategories under a category. `scope`:
 *   - "global" (default): only admin-owned rows (vendorId null)
 *   - "all": every subcategory under the category, including vendor-created
 *     ones - the oversight view (ownership flagged so bad vendor rows can be
 *     moderated).
 */
const listSubcategories = async (categoryId, { page = 1, limit = 50, scope = 'global' } = {}) => {
  const category = await prisma.vendorCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.notFound('Category not found');

  const wantAll = scope === 'all';
  const where = {
    categoryId,
    ...(wantAll ? {} : { vendorId: null }),
  };

  const [subcategories, total] = await Promise.all([
    prisma.subcategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        sortOrder: true,
        isActive: true,
        vendorId: true,
        owner: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.subcategory.count({ where }),
  ]);

  const rows = subcategories.map((s) => ({
    ...s,
    owned: !!s.vendorId,
  }));

  return { subcategories: rows, total, page, limit };
};

/**
 * Create an admin-owned (global) subcategory under a category. Mirrors the
 * vendor's createOwnSubcategory minus the vendor scoping.
 */
const createSubcategory = async (categoryId, { name, imageUrl = null, sortOrder }, adminUserId, ipAddress, userAgent) => {
  const category = await prisma.vendorCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.notFound('Category not found');

  const trimmed = name ? String(name).trim() : '';
  if (!trimmed || trimmed.length > 60) {
    throw AppError.badRequest('Subcategory name is required and must be 60 characters or fewer');
  }

  const clash = await prisma.subcategory.findFirst({
    where: { categoryId, vendorId: null, name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (clash) throw AppError.conflict(`A global subcategory named "${trimmed}" already exists under this category`);

  const created = await prisma.subcategory.create({
    data: {
      categoryId,
      vendorId: null,
      name: trimmed,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      sortOrder: sortOrder ?? 0,
    },
  });

  await createAuditLog(
    adminUserId,
    'CREATE_SUBCATEGORY',
    'SUBCATEGORY',
    created.id,
    { categoryId, name: trimmed },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return created;
};

/**
 * Update a subcategory. Unlike the vendor path, an admin can also rename
 * vendor-created (owned) rows when moderating them.
 */
const updateSubcategory = async (categoryId, subcategoryId, data, adminUserId, ipAddress, userAgent) => {
  const subcategory = await prisma.subcategory.findFirst({
    where: { id: subcategoryId, categoryId },
  });
  if (!subcategory) throw AppError.notFound('Subcategory not found');

  const updateData = {};
  if (data.name !== undefined) {
    const trimmed = String(data.name).trim();
    if (!trimmed || trimmed.length > 60) {
      throw AppError.badRequest('Subcategory name must be between 1 and 60 characters');
    }
    const clash = await prisma.subcategory.findFirst({
      where: {
        categoryId,
        vendorId: subcategory.vendorId, // null-safe: compares null to null
        name: { equals: trimmed, mode: 'insensitive' },
        NOT: { id: subcategoryId },
      },
    });
    if (clash) throw AppError.conflict('A subcategory with this name already exists under that category');
    updateData.name = trimmed;
  }
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl ? String(data.imageUrl).trim() : null;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.subcategory.update({
    where: { id: subcategoryId },
    data: updateData,
  });

  await createAuditLog(
    adminUserId,
    'UPDATE_SUBCATEGORY',
    'SUBCATEGORY',
    subcategoryId,
    { categoryId, ...updateData },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return updated;
};

/**
 * Delete a subcategory. Products filed under it keep their category and have
 * subcategoryId nulled (optional relation -> SetNull). Because that silently
 * unfiles products, deletion is refused while products still use the row unless
 * the caller explicitly confirms with `unfile: true`.
 */
const deleteSubcategory = async (categoryId, subcategoryId, adminUserId, ipAddress, userAgent, { unfile = false } = {}) => {
  const subcategory = await prisma.subcategory.findFirst({
    where: { id: subcategoryId, categoryId },
    include: { _count: { select: { products: true } } },
  });
  if (!subcategory) throw AppError.notFound('Subcategory not found');

  const productCount = subcategory._count.products;
  if (productCount > 0 && !unfile) {
    throw AppError.conflict(
      `This subcategory is used by ${productCount} product${productCount === 1 ? '' : 's'}. ` +
        `Confirm to remove it and unfile those products, or move them to another subcategory first.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    if (productCount > 0) {
      await tx.product.updateMany({ where: { subcategoryId }, data: { subcategoryId: null } });
    }
    await tx.subcategory.delete({ where: { id: subcategoryId } });
  });

  await createAuditLog(
    adminUserId,
    'DELETE_SUBCATEGORY',
    'SUBCATEGORY',
    subcategoryId,
    { categoryId, name: subcategory.name, owned: !!subcategory.vendorId, unfiledProducts: productCount },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return { success: true, unfiledProducts: productCount };
};

/**
 * Reorder global subcategories within a category in one transaction. Only
 * admin-owned (global) rows can be reordered.
 */
const reorderSubcategories = async (categoryId, items, adminUserId, ipAddress, userAgent) => {
  const ids = items.map((i) => i.id);
  const owned = await prisma.subcategory.findMany({
    where: { id: { in: ids }, categoryId, vendorId: null },
    select: { id: true },
  });
  if (owned.length !== ids.length) {
    throw AppError.badRequest('Only global subcategories in this category can be reordered');
  }

  await prisma.$transaction(
    items.map((item) => prisma.subcategory.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })),
  );

  await createAuditLog(
    adminUserId,
    'REORDER_SUBCATEGORIES',
    'SUBCATEGORY',
    categoryId,
    { count: items.length },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return { updated: items.length };
};

// ============================================================
// Platform Settings
// ============================================================

// Defaults merge beneath persisted rows so removing a key from the admin UI
// falls back to a sane value instead of going missing.
const DEFAULT_PLATFORM_SETTINGS = {
  platformName: 'Ecommerce',
  defaultCurrency: 'NGN',
  timezone: 'Africa/Lagos',
  supportEmail: 'support@example.com',
  supportPhone: '+2348000000000',
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  newOrderAlerts: true,
};

const SETTINGS_KEY = 'platform';

/**
 * Get platform settings - persisted rows merged over the defaults (persisted
 * wins). Backed by the PlatformSetting table, not a hardcoded stub.
 */
const getPlatformSettings = async () => {
  const row = await prisma.platformSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const persisted = (row?.value && typeof row.value === 'object' && !Array.isArray(row.value)) ? row.value : {};
  return { ...DEFAULT_PLATFORM_SETTINGS, ...persisted };
};

/**
 * Upsert platform settings into the PlatformSetting table. Only known keys are
 * persisted so a stale client can't smuggle unrelated JSON into settings.
 */
const updatePlatformSettings = async (settings, adminUserId = 'ADMIN') => {
  const cleaned = {};
  for (const key of Object.keys(DEFAULT_PLATFORM_SETTINGS)) {
    if (settings[key] !== undefined) cleaned[key] = settings[key];
  }

  if (Object.keys(cleaned).length > 0) {
    await prisma.platformSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: cleaned, updatedBy: adminUserId },
      update: { value: cleaned, updatedBy: adminUserId },
    });
  }

  logger.info('Platform settings updated', { keys: Object.keys(cleaned), adminUserId });

  return getPlatformSettings();
};

// ============================================================
// Audit Log
// ============================================================

/**
 * Get audit logs with filters.
 */
const getAuditLogs = async ({ page = 1, limit = 20, action, entityType, startDate, endDate }) => {
  const where = {};

  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        adminUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, limit };
};

// ============================================================
// Platform Analytics Functions
// ============================================================

/**
 * Get platform revenue analytics
 */
/**
 * Gross order value (GMV) analytics - orders don't carry payment status
 * anymore, so "revenue" here means completed order totals, not a ledger sum.
 */
const getRevenueAnalytics = async ({ startDate, endDate }) => {
  const where = {
    status: 'DELIVERED',
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [totalRevenue, revenueByVendor, revenueTrend] = await Promise.all([
    prisma.order.aggregate({
      where,
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ['vendorId'],
      where,
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    }),
    (() => {
      const sFilter = startDate ? Prisma.sql`AND "createdAt" >= ${new Date(startDate)}` : Prisma.empty;
      const eFilter = endDate ? Prisma.sql`AND "createdAt" <= ${new Date(endDate)}` : Prisma.empty;
      return prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          SUM(total) as revenue,
          COUNT(*) as orders
        FROM "orders"
        WHERE status = 'DELIVERED'
          ${sFilter}
          ${eFilter}
        GROUP BY DATE("createdAt")
        ORDER BY date DESC
        LIMIT 30
      `;
    })(),
  ]);

  return {
    totalRevenue: totalRevenue._sum.total || 0,
    totalOrders: totalRevenue._count || 0,
    topVendors: revenueByVendor,
    revenueTrend,
  };
};

/**
 * Get platform order analytics
 */
const getOrderAnalytics = async ({ startDate, endDate }) => {
  const where = {
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [totalOrders, ordersByStatus, cancelledCount] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.order.count({ where: { ...where, status: 'CANCELLED' } }),
  ]);

  return {
    totalOrders,
    ordersByStatus,
    cancellationRate: totalOrders > 0 ? (cancelledCount / totalOrders) * 100 : 0,
  };
};

/**
 * Get platform customer analytics
 */
const getCustomerAnalytics = async ({ startDate, endDate }) => {
  const where = {
    role: 'CUSTOMER',
    deletedAt: null,
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [totalCustomers, newCustomers, topCustomersByOrders] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    prisma.user.count({ where }),
    prisma.$queryRaw`
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u.email,
        COUNT(o.id) as "orderCount"
      FROM "users" u
      LEFT JOIN "orders" o ON u.id = o."customerId"
      WHERE u.role = 'CUSTOMER' AND u."deletedAt" IS NULL
      GROUP BY u.id, u."firstName", u."lastName", u.email
      ORDER BY "orderCount" DESC
      LIMIT 10
    `,
  ]);

  return {
    totalCustomers,
    newCustomers,
    topCustomers: topCustomersByOrders,
  };
};

/**
 * Get geographic analytics - vendor distribution by category/location. Order
 * destinations no longer carry raw lat/lng directly (they ship to a
 * SavedAddress), so the location breakdown is vendor-side only.
 */
const getGeographicAnalytics = async ({ startDate, endDate }) => {
  const sFilter = startDate ? Prisma.sql`AND o."createdAt" >= ${new Date(startDate)}` : Prisma.empty;
  const eFilter = endDate ? Prisma.sql`AND o."createdAt" <= ${new Date(endDate)}` : Prisma.empty;

  const vendorDistribution = await prisma.$queryRaw`
    SELECT
      v.name,
      ROUND(v.lat::numeric, 2) as lat,
      ROUND(v.lng::numeric, 2) as lng,
      COUNT(o.id) as "orderCount",
      SUM(t.amount) as "totalRevenue"
    FROM "vendors" v
    LEFT JOIN "orders" o ON v.id = o."vendorId"
    LEFT JOIN "transactions" t ON o.id::text = t.metadata->>'orderId'
    WHERE v.status = 'APPROVED'
      ${sFilter}
      ${eFilter}
    GROUP BY v.id, v.name, v.lat, v.lng
    ORDER BY "totalRevenue" DESC
  `;

  return { vendorDistribution };
};

/**
 * Get real-time platform metrics
 */
const getRealtimeMetrics = async () => {
  const [activeOrders, recentOrders, activeVendors] = await Promise.all([
    prisma.order.count({
      where: { status: { in: ['PENDING', 'PROCESSING', 'SHIPPED'] } },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, vendor: true },
    }),
    prisma.vendor.count({ where: { status: 'APPROVED', isOpen: true } }),
  ]);

  return {
    activeOrders,
    recentOrders,
    systemHealth: { activeVendors },
  };
};


// ============================================================
// Marketing Oversight
// ============================================================

const getPlatformCampaigns = async ({ page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    prisma.platformCampaign.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: { select: { id: true, name: true } },
      },
    }),
    prisma.platformCampaign.count(),
  ]);

  return { campaigns, total, page, limit };
};

const createPlatformCampaign = async (data, adminUserId, ipAddress, userAgent) => {
  const campaign = await prisma.platformCampaign.create({
    data: {
      name: data.name,
      type: data.type,
      description: data.description || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      budget: data.budget ?? 0,
      targetAudience: data.targetAudience || 'all',
      status: data.status || 'draft',
      createdBy: adminUserId,
    },
    include: { vendor: { select: { id: true, name: true } } },
  });

  await createAuditLog(
    adminUserId,
    'CREATE_CAMPAIGN',
    'PlatformCampaign',
    campaign.id,
    { name: campaign.name, type: campaign.type },
    ipAddress,
    userAgent,
  );

  return campaign;
};

const updatePlatformCampaign = async (campaignId, data, adminUserId, ipAddress, userAgent) => {
  const campaign = await prisma.platformCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw AppError.notFound('Campaign not found');

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.startDate !== undefined) updateData.startDate = data.startDate || null;
  if (data.endDate !== undefined) updateData.endDate = data.endDate || null;
  if (data.budget !== undefined) updateData.budget = data.budget;
  if (data.targetAudience !== undefined) updateData.targetAudience = data.targetAudience || 'all';
  if (data.status !== undefined) updateData.status = data.status;

  const updated = await prisma.platformCampaign.update({
    where: { id: campaignId },
    data: updateData,
    include: { vendor: { select: { id: true, name: true } } },
  });

  await createAuditLog(
    adminUserId,
    'UPDATE_CAMPAIGN',
    'PlatformCampaign',
    campaignId,
    updateData,
    ipAddress,
    userAgent,
  );

  return updated;
};

/**
 * Fan a newly-activated promotion/announcement out to its audience. Best-effort
 * and batched so a large audience doesn't hold the admin request open.
 */
const broadcastCampaignNotification = async (campaign) => {
  const where = {
    status: 'ACTIVE',
    deletedAt: null,
    role: { in: ['CUSTOMER', 'VENDOR'] },
  };
  if (campaign.targetAudience === 'customers') where.role = 'CUSTOMER';
  else if (campaign.targetAudience === 'vendors') where.role = 'VENDOR';

  const users = await prisma.user.findMany({ where, select: { id: true }, take: 5000 });
  let delivered = 0;

  for (const batch of chunk(users, 100)) {
    await Promise.all(
      batch.map((u) =>
        notifyUser(u.id, {
          type: 'PROMOTION',
          title: campaign.name,
          body: campaign.description || 'A new offer is live on Marketplace. Tap to explore.',
          route: '/home',
        }),
      ),
    );
    delivered += batch.length;
  }

  logger.info('Campaign notification broadcast', {
    campaignId: campaign.id,
    audience: campaign.targetAudience,
    delivered,
  });
  return delivered;
};

const setCampaignStatus = async (campaignId, status, adminUserId, ipAddress, userAgent) => {
  const campaign = await prisma.platformCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw AppError.notFound('Campaign not found');

  const updated = await prisma.platformCampaign.update({
    where: { id: campaignId },
    data: { status },
    include: { vendor: { select: { id: true, name: true } } },
  });

  await createAuditLog(
    adminUserId,
    'SET_CAMPAIGN_STATUS',
    'PlatformCampaign',
    campaignId,
    { status },
    ipAddress,
    userAgent,
  );

  // Only broadcast on the draft/paused -> active transition. Re-saving an
  // already-active campaign must not spam the audience again.
  if (status === 'active' && campaign.status !== 'active') {
    broadcastCampaignNotification(updated).catch((err) =>
      logger.warn('Campaign broadcast failed (non-fatal)', { campaignId, error: err.message }),
    );
  }

  return updated;
};

const deletePlatformCampaign = async (campaignId, adminUserId, ipAddress, userAgent) => {
  const campaign = await prisma.platformCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw AppError.notFound('Campaign not found');

  await prisma.platformCampaign.delete({ where: { id: campaignId } });

  await createAuditLog(
    adminUserId,
    'DELETE_CAMPAIGN',
    'PlatformCampaign',
    campaignId,
    { name: campaign.name },
    ipAddress,
    userAgent,
  );

  return { success: true };
};

const getDiscountCodes = async ({ page = 1, limit = 20, status }) => {
  const skip = (page - 1) * limit;
  const where = {
    ...(status && { status }),
  };

  const [discounts, total] = await Promise.all([
    prisma.discountCode.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.discountCode.count({ where }),
  ]);

  return { discounts, total, page, limit };
};

const approveDiscountCode = async (discountId, adminUserId, ipAddress, userAgent) => {
  const discount = await prisma.discountCode.update({
    where: { id: discountId },
    data: { status: 'APPROVED' },
  });

  await createAuditLog(
    adminUserId,
    'APPROVE_DISCOUNT',
    'DiscountCode',
    discountId,
    { code: discount.code },
    ipAddress,
    userAgent
  );

  return discount;
};

const rejectDiscountCode = async (discountId, reason, adminUserId, ipAddress, userAgent) => {
  const discount = await prisma.discountCode.update({
    where: { id: discountId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
    },
  });

  await createAuditLog(
    adminUserId,
    'REJECT_DISCOUNT',
    'DiscountCode',
    discountId,
    { code: discount.code, reason },
    ipAddress,
    userAgent
  );

  return discount;
};

// ============================================================
// Ratings moderation
// ============================================================

const getAllRatings = async ({ page = 1, limit = 20, search, score, sort = 'newest' } = {}) => {
  const where = {
    ...(score && { vendorScore: score }),
    ...(search && {
      OR: [
        { order: { is: { vendor: { is: { name: { contains: search, mode: 'insensitive' } } } } } },
        { customer: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
        { customer: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        { vendorComment: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const orderBy =
    sort === 'oldest' ? { createdAt: 'asc' }
    : sort === 'highest' ? { vendorScore: 'desc' }
    : sort === 'lowest' ? { vendorScore: 'asc' }
    : { createdAt: 'desc' };

  const [ratings, total] = await Promise.all([
    prisma.rating.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        order: {
          select: {
            id: true,
            status: true,
            total: true,
            vendor: { select: { id: true, name: true } },
          },
        },
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.rating.count({ where }),
  ]);

  return { ratings, total, page, limit };
};

/**
 * Delete a rating for moderation (abusive/inflated) and recompute the vendor's
 * average from the remaining ratings - same aggregation rateOrder uses so the
 * shop score never goes stale.
 */
const deleteRating = async (ratingId, adminUserId, ipAddress, userAgent) => {
  const rating = await prisma.rating.findUnique({
    where: { id: ratingId },
    include: { order: { select: { vendorId: true } }, customer: { select: { firstName: true, lastName: true } } },
  });
  if (!rating) throw AppError.notFound('Rating not found');

  await prisma.rating.delete({ where: { id: ratingId } });

  // Recompute the vendor's average identical to order.service.rateOrder.
  if (rating.order?.vendorId) {
    const orderIds = (await prisma.order.findMany({
      where: { vendorId: rating.order.vendorId },
      select: { id: true },
    })).map((o) => o.id);

    const agg = await prisma.rating.aggregate({
      where: { orderId: { in: orderIds }, vendorScore: { not: null } },
      _avg: { vendorScore: true },
    });

    await prisma.vendor.update({
      where: { id: rating.order.vendorId },
      data: { averageRating: agg._avg.vendorScore || 0 },
    });
  }

  await createAuditLog(
    adminUserId,
    'DELETE_RATING',
    'Rating',
    ratingId,
    { vendorScore: rating.vendorScore, customer: `${rating.customer.firstName || ''} ${rating.customer.lastName || ''}`.trim() },
    ipAddress,
    userAgent,
  );

  return { success: true };
};

// ============================================================
// Callback request leads (chat-commerce "request a callback")
// ============================================================

const getCallbackRequests = async ({ page = 1, limit = 20, search, vendorId } = {}) => {
  const where = {
    ...(vendorId && { vendorId }),
    ...(search && {
      OR: [
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { vendor: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  };

  const [callbacks, total] = await Promise.all([
    prisma.callbackRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        vendor: { select: { id: true, name: true, phone: true, email: true } },
        product: { select: { id: true, name: true, imageUrl: true } },
      },
    }),
    prisma.callbackRequest.count({ where }),
  ]);

  return { callbacks, total, page, limit };
};

// ============================================================
// Highlight moderation (vendor story highlights)
// ============================================================

const getAllHighlights = async ({ page = 1, limit = 20, search, vendorId, isActive } = {}) => {
  const where = {
    ...(vendorId && { vendorId }),
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { vendor: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  };

  const [highlights, total] = await Promise.all([
    prisma.highlight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        vendor: { select: { id: true, name: true, logoUrl: true } },
        _count: { select: { stories: true } },
      },
    }),
    prisma.highlight.count({ where }),
  ]);

  return { highlights, total, page, limit };
};

const setHighlightStatus = async (highlightId, isActive, adminUserId, ipAddress, userAgent) => {
  const highlight = await prisma.highlight.findUnique({ where: { id: highlightId } });
  if (!highlight) throw AppError.notFound('Highlight not found');

  const updated = await prisma.highlight.update({
    where: { id: highlightId },
    data: { isActive },
    include: { vendor: { select: { id: true, name: true } } },
  });

  await createAuditLog(
    adminUserId,
    isActive ? 'ACTIVATE_HIGHLIGHT' : 'DEACTIVATE_HIGHLIGHT',
    'Highlight',
    highlightId,
    { name: highlight.name },
    ipAddress,
    userAgent,
  );

  return updated;
};

const deleteHighlight = async (highlightId, adminUserId, ipAddress, userAgent) => {
  const highlight = await prisma.highlight.findUnique({ where: { id: highlightId }, select: { id: true, name: true } });
  if (!highlight) throw AppError.notFound('Highlight not found');

  await prisma.highlight.delete({ where: { id: highlightId } });

  await createAuditLog(
    adminUserId,
    'DELETE_HIGHLIGHT',
    'Highlight',
    highlightId,
    { name: highlight.name },
    ipAddress,
    userAgent,
  );

  return { success: true };
};

// ============================================================
// Product catalogue moderation (global, cross-vendor)
// ============================================================

const listAllProducts = async ({ page = 1, limit = 20, search, vendorId, categoryId, isAvailable, condition } = {}) => {
  const where = {
    ...(vendorId && { vendorId }),
    ...(categoryId && { categoryId }),
    ...(isAvailable !== undefined && { isAvailable }),
    ...(condition && { condition }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { vendor: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        vendorId: true,
        name: true,
        description: true,
        categoryId: true,
        subcategoryId: true,
        basePrice: true,
        stock: true,
        imageUrl: true,
        images: true,
        videoUrl: true,
        isAvailable: true,
        condition: true,
        createdAt: true,
        updatedAt: true,
        vendor: {
          select: { id: true, name: true, isActive: true, status: true },
        },
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true } },
        _count: { select: { orderItems: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { products: products.map((p) => ({ ...p, orderCount: p._count.orderItems })), total, page, limit };
};

// ============================================================
// Staff Management
// ============================================================

/**
 * List all staff members (users with role=ADMIN).
 */
async function listStaff() {
  return prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      permissions: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * A super admin is an ADMIN whose permissions are null/undefined (legacy =
 * full access) or whose permission list contains 'ALL'. An explicit empty
 * array [] is a scoped admin with no permissions.
 */
function _isSuperAdmin(actor) {
  return (
    actor.permissions == null ||
    (Array.isArray(actor.permissions) && actor.permissions.includes('ALL'))
  );
}

/**
 * Create a new staff member.
 */
async function createStaff(data, actor, ipAddress, userAgent) {
  const { email, password, firstName, lastName, permissions } = data;

  if ((permissions || []).includes('ALL') && !_isSuperAdmin(actor)) {
    throw AppError.forbidden('Only a super admin can grant full (ALL) access');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw AppError.conflict('Email already in use');

  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 12);

  const staff = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: permissions || [],
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      permissions: true,
    }
  });

  await createAuditLog(
    actor.id,
    'CREATE_STAFF',
    'User',
    staff.id,
    { email: staff.email, permissions: staff.permissions },
    ipAddress,
    userAgent
  );

  return staff;
}

/**
 * Update staff permissions.
 */
async function updateStaffPermissions(staffId, permissions, actor, ipAddress, userAgent) {
  if (staffId === actor.id) {
    throw AppError.forbidden('You cannot modify your own permissions');
  }
  if ((permissions || []).includes('ALL') && !_isSuperAdmin(actor)) {
    throw AppError.forbidden('Only a super admin can grant full (ALL) access');
  }

  const staff = await prisma.user.findUnique({ where: { id: staffId } });
  if (!staff || staff.role !== 'ADMIN') throw AppError.notFound('Staff member not found');

  const updated = await prisma.user.update({
    where: { id: staffId },
    data: { permissions },
    select: {
      id: true,
      email: true,
      permissions: true,
    }
  });

  await createAuditLog(
    actor.id,
    'UPDATE_STAFF_PERMISSIONS',
    'User',
    staffId,
    { oldPermissions: staff.permissions, newPermissions: permissions },
    ipAddress,
    userAgent
  );

  return updated;
}

/**
 * Update staff profile (name/phone/status).
 */
async function updateStaffProfile(staffId, data, actor, ipAddress, userAgent) {
  if (staffId === actor.id && data.status && data.status !== 'ACTIVE') {
    throw AppError.forbidden('You cannot suspend or deactivate your own account');
  }

  const staff = await prisma.user.findUnique({ where: { id: staffId } });
  if (!staff || staff.role !== 'ADMIN') throw AppError.notFound('Staff member not found');

  const updated = await prisma.user.update({
    where: { id: staffId },
    data: {
      ...(data.firstName && { firstName: data.firstName }),
      ...(data.lastName && { lastName: data.lastName }),
      ...(data.phone && { phone: data.phone }),
      ...(data.status && { status: data.status }),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
    }
  });

  await createAuditLog(
    actor.id,
    'UPDATE_STAFF_PROFILE',
    'User',
    staffId,
    { data },
    ipAddress,
    userAgent
  );

  return updated;
}

// ============================================================
// Banner Management
// ============================================================

async function getBanners() {
  return prisma.banner.findMany({
    orderBy: { priority: 'desc' },
  });
}

async function createBanner(data, adminUserId) {
  return prisma.banner.create({
    data: {
      title: data.title,
      subtitle: data.subtitle || null,
      imageUrl: data.imageUrl,
      deepLink: data.deepLink || null,
      bgColor: data.bgColor || null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      audience: data.audience || null,
      priority: Number(data.priority || 0),
      isActive: data.isActive !== false,
      createdBy: adminUserId,
    },
  });
}

async function updateBanner(id, data, adminUserId) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Banner not found');

  return prisma.banner.update({
    where: { id },
    data: {
      title: data.title,
      subtitle: data.subtitle,
      imageUrl: data.imageUrl,
      deepLink: data.deepLink,
      bgColor: data.bgColor,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      audience: data.audience,
      priority: data.priority !== undefined ? Number(data.priority) : undefined,
      isActive: data.isActive,
    },
  });
}

async function deleteBanner(id, adminUserId) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Banner not found');

  return prisma.banner.delete({ where: { id } });
}

/**
 * Notification delivery health - lets the admin dashboard verify the push
 * pipeline without waiting for a business event.
 */
const getNotificationHealth = async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [usersWithDeviceToken, webPushSubscriptions, webPushUsers, notifications24h, latest] =
    await Promise.all([
      prisma.user.count({ where: { fcmToken: { not: null } } }),
      prisma.pushSubscription.count(),
      prisma.pushSubscription.findMany({ distinct: ['userId'], select: { userId: true } }),
      prisma.notification.count({ where: { createdAt: { gte: since } } }),
      prisma.notification.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, userId: true, type: true, title: true, createdAt: true },
      }),
    ]);

  const { isConfigured } = require('../../services/webpush.service');
  return {
    webPushConfigured: isConfigured(),
    usersWithDeviceToken,
    webPushSubscriptions,
    usersWithWebPush: webPushUsers.length,
    notificationsLast24h: notifications24h,
    latestNotification: latest,
  };
};

/** Send a notification to the calling admin so the tray can be tested. */
const sendTestNotification = async (adminUserId) => {
  const row = await notifyService.pushAndSocket(adminUserId, {
    type: 'SYSTEM',
    title: 'Test notification',
    body: 'If you can see this, Marketplace notifications are working on this device.',
    data: { route: '/notifications', test: true },
  });
  return { notificationId: row?.id || null, persisted: !!row };
};

/** Broadcast a test notification to every active user so delivery can be verified end-to-end. */
const broadcastTestNotification = async (adminUserId) => {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true },
    take: 5000,
  });
  let sent = 0;
  for (const batch of chunk(users, 100)) {
    await Promise.all(
      batch.map((u) =>
        notifyUser(u.id, {
          type: 'SYSTEM',
          title: 'Marketplace test notification',
          body: 'If you see this, notifications are working on your device.',
          route: '/notifications',
        }),
      ),
    );
    sent += batch.length;
  }
  logger.info('Broadcast test notification sent', { adminUserId, recipients: sent });
  return { recipients: sent };
};

/**
 * Send an arbitrary notification to one user, or to every active user.
 *
 * Backs the admin dashboard's "send at will" tool. Business code must keep
 * calling notifyUser/pushAndSocket with its own templates.
 */
const sendNotification = async ({
  userId,
  email,
  all = false,
  title,
  body,
  route = '/notifications',
  audience,
} = {}) => {
  if (!title || !body) {
    throw AppError.badRequest('title and body are required', { code: 'VALIDATION_FAILED' });
  }

  if (all) {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true },
      take: 5000,
    });
    let sent = 0;
    for (const batch of chunk(users, 100)) {
      const rows = await Promise.all(
        batch.map((u) => notifyUser(u.id, { type: 'SYSTEM', title, body, route, audience })),
      );
      sent += rows.filter(Boolean).length;
    }
    logger.info('Admin notification broadcast', { title, recipients: sent });
    return { recipients: sent, notificationId: null, userId: null };
  }

  let targetId = userId || null;
  if (!targetId && email) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    targetId = user?.id || null;
  }
  if (!targetId) {
    throw AppError.badRequest('userId or email is required', { code: 'VALIDATION_FAILED' });
  }

  const row = await notifyUser(targetId, { type: 'SYSTEM', title, body, route, audience });
  return { recipients: row ? 1 : 0, notificationId: row?.id || null, userId: targetId };
};

module.exports = {
  getAllCustomers,
  updateCustomerStatus,
  updateCustomer,
  updateVendorAccount,
  wipeCustomerKyc,
  getCustomerById,
  getCustomerStats,
  getCustomerOrders,
  getCustomerAddresses,
  getDashboardStats,
  getAllOrders,
  getOrderById,
  getOrderStats,
  exportOrders,
  forceCancelOrder,
  adminUpdateOrderStatus,
  getAllVendors,
  getVendorStatusCounts,
  getVendorById,
  approveVendor,
  rejectVendor,
  suspendVendor,
  unsuspendVendor,
  updateVendorProfile,
  getVendorAnalytics,
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  setVendorTags,
  getAllCategories,
  createCategory,
  updateCategory,
  updateCategoryAttributeSchema,
  deleteCategory,
  reorderCategories,
  getHomeCategories,
  updateHomeCategories,
  listSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  reorderSubcategories,
  getPlatformSettings,
  updatePlatformSettings,
  createAuditLog,
  getAuditLogs,
  getRevenueAnalytics,
  getOrderAnalytics,
  getCustomerAnalytics,
  getGeographicAnalytics,
  getRealtimeMetrics,
  getPlatformCampaigns,
  createPlatformCampaign,
  updatePlatformCampaign,
  setCampaignStatus,
  deletePlatformCampaign,
  getDiscountCodes,
  approveDiscountCode,
  rejectDiscountCode,
  getAllRatings,
  deleteRating,
  listAllProducts,
  getCallbackRequests,
  getAllHighlights,
  setHighlightStatus,
  deleteHighlight,
  // Staff management
  listStaff,
  createStaff,
  updateStaffPermissions,
  updateStaffProfile,
  // Banner management
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  // Notification delivery
  getNotificationHealth,
  sendTestNotification,
  broadcastTestNotification,
  sendNotification,
};

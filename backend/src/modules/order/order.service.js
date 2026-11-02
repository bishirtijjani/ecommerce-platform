/**
 * Order service - order lifecycle for the marketplace.
 *
 * Every order belongs to exactly one customer and one vendor. No
 * rider/dispatch leg - the vendor self-fulfills and marks the order
 * shipped/delivered directly.
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { canTransition: canTransitionStatus, ACTIVE_STATUSES } = require('../../utils/status');
const { getIO } = require('../../sockets');
const { ORDER, getOrderRoom } = require('../../sockets/events');
const {
  emitOrderCreated,
  emitStatusChanged,
  emitVendorAccepted,
  emitVendorShipped,
  emitCompleted,
  emitCancelled,
} = require('../../sockets/handlers/order.handler');
const notifyService = require('../../services/notify.service');
const { verifyQuoteToken } = require('../../utils/quote-token');

// ============================================================
// Resolve & price line items - server-truth, never trusts client.
//
// For each client-supplied item the server:
//   1. Loads the Product (must belong to the vendor)
//   2. Resolves variantId (single-variant products auto-resolve; multi-variant
//      products require an explicit variantId)
//   3. Validates every selected option group exists on the product, the
//      selection respects minSelect/maxSelect, and every required group is satisfied
//   4. Computes unitPrice = variant.price + Σ option priceDeltas
//   5. Snapshots option choices into the shape persisted on OrderItem.selectedOptions
// ============================================================

const resolveLineItems = async (vendorId, rawItems) => {
  if (!rawItems || rawItems.length === 0) return [];

  const productIds = [...new Set(rawItems.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      variants: true,
      optionGroups: { include: { items: true } },
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const resolved = [];
  for (const raw of rawItems) {
    const product = productMap.get(raw.productId);
    if (!product) {
      throw AppError.badRequest(`Product ${raw.productId} not found`);
    }
    if (product.vendorId !== vendorId) {
      throw AppError.badRequest(`Product ${raw.productId} does not belong to this vendor`);
    }
    if (!product.isAvailable) {
      throw AppError.badRequest(`Product "${product.name}" is unavailable`);
    }

    // Variant resolution
    let variant;
    if (raw.variantId) {
      variant = product.variants.find((v) => v.id === raw.variantId);
      if (!variant) throw AppError.badRequest(`Variant ${raw.variantId} not found on product ${product.name}`);
    } else if (product.variants.length === 1) {
      variant = product.variants[0];
    } else if (product.variants.length === 0) {
      throw AppError.badRequest(`Product "${product.name}" has no variants configured`);
    } else {
      throw AppError.badRequest(`Product "${product.name}" has multiple variants - variantId is required`);
    }
    if (!variant.isAvailable) {
      throw AppError.badRequest(`Variant of "${product.name}" is unavailable`);
    }
    if (variant.stock < raw.quantity) {
      throw AppError.badRequest(`Insufficient stock for "${product.name}" (have ${variant.stock}, want ${raw.quantity})`);
    }

    // Option-group validation + price delta accumulation
    const optionsSnapshot = [];
    let optionDelta = 0;
    const providedByGroup = new Map(
      (raw.selectedOptions || []).map((s) => [s.groupId, new Set(s.itemIds)]),
    );

    for (const group of product.optionGroups) {
      const picked = providedByGroup.get(group.id) || new Set();
      const isRequired = group.selectionRule === 'REQUIRED_ONE' || group.selectionRule === 'REQUIRED_MULTIPLE';

      if (picked.size < group.minSelect) {
        throw AppError.badRequest(`Option group "${group.name}" requires at least ${group.minSelect} selection(s)`);
      }
      if (picked.size > group.maxSelect) {
        throw AppError.badRequest(`Option group "${group.name}" allows at most ${group.maxSelect} selection(s)`);
      }
      if (isRequired && picked.size === 0) {
        throw AppError.badRequest(`Option group "${group.name}" is required`);
      }
      if (group.selectionRule === 'REQUIRED_ONE' || group.selectionRule === 'OPTIONAL_ONE') {
        if (picked.size > 1) {
          throw AppError.badRequest(`Option group "${group.name}" allows only one selection`);
        }
      }

      const pickedItems = [];
      for (const itemId of picked) {
        const item = group.items.find((i) => i.id === itemId);
        if (!item) {
          throw AppError.badRequest(`Option item ${itemId} not found in group "${group.name}"`);
        }
        if (!item.isAvailable) {
          throw AppError.badRequest(`Option "${item.name}" in "${group.name}" is unavailable`);
        }
        optionDelta += Number(item.priceDelta);
        pickedItems.push({ itemId: item.id, itemName: item.name, priceDelta: Number(item.priceDelta) });
      }

      if (pickedItems.length > 0) {
        optionsSnapshot.push({ groupId: group.id, groupName: group.name, items: pickedItems });
      }
    }

    // Reject any extraneous groupIds the client sent that don't exist on the product
    for (const groupId of providedByGroup.keys()) {
      if (!product.optionGroups.find((g) => g.id === groupId)) {
        throw AppError.badRequest(`Option group ${groupId} does not exist on this product`);
      }
    }

    const unitPrice = Number(variant.price) + optionDelta;
    const lineTotal = unitPrice * raw.quantity;
    const substitution = raw.substitution || 'NONE';

    resolved.push({
      productId: product.id,
      variantId: variant.id,
      variant,
      quantity: raw.quantity,
      unitPrice,
      lineTotal,
      selectedOptions: optionsSnapshot,
      specialInstructions: raw.specialInstructions || null,
      substitution,
      name: product.name,
      description: product.description || null,
    });
  }

  return resolved;
};

// ============================================================
// Estimate / Calculate Pricing - server-truth pricing.
// Exported so the `/quote` endpoint can return the same numbers
// that createOrder will persist.
// ============================================================

const estimateOrder = async ({ vendorId, items, resolvedItems, promoCode }) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true },
  });
  if (!vendor) throw AppError.badRequest('Vendor not found');

  const resolved = resolvedItems ?? await resolveLineItems(vendorId, items);
  const subtotal = resolved.reduce((sum, it) => sum + it.lineTotal, 0);

  let discountAmount = 0;
  let discountCodeId = null;
  let loadedDiscount = null;

  if (promoCode) {
    const discount = await prisma.discountCode.findUnique({
      where: { code: promoCode.trim().toUpperCase() },
    });

    if (!discount) {
      throw AppError.badRequest(`Promo code "${promoCode}" is invalid.`, { code: 'PROMO_INVALID' });
    }
    if (discount.status !== 'APPROVED') {
      throw AppError.badRequest(`Promo code "${promoCode}" is not active.`, { code: 'PROMO_NOT_ACTIVE' });
    }
    const now = new Date();
    if (discount.startDate && now < new Date(discount.startDate)) {
      throw AppError.badRequest(`Promo code "${promoCode}" has not started yet.`, { code: 'PROMO_NOT_STARTED' });
    }
    if (discount.endDate && now > new Date(discount.endDate)) {
      throw AppError.badRequest(`Promo code "${promoCode}" has expired.`, { code: 'PROMO_EXPIRED' });
    }
    if (discount.used >= discount.usageLimit) {
      throw AppError.badRequest(`Promo code "${promoCode}" has reached its usage limit.`, { code: 'PROMO_LIMIT_REACHED' });
    }
    if (discount.vendorId && discount.vendorId !== vendorId) {
      throw AppError.badRequest(`Promo code "${promoCode}" is not valid for this vendor.`, { code: 'PROMO_VENDOR_MISMATCH' });
    }
    if (subtotal < Number(discount.minOrder)) {
      throw AppError.badRequest(`Promo code "${promoCode}" requires a minimum spend of ₦${discount.minOrder}.`, { code: 'PROMO_MIN_ORDER' });
    }

    if (discount.type === 'percentage') {
      discountAmount = Math.ceil((subtotal * Number(discount.value)) / 100);
      if (discount.maxDiscount) {
        discountAmount = Math.min(discountAmount, Number(discount.maxDiscount));
      }
    } else {
      discountAmount = Number(discount.value);
    }
    discountAmount = Math.min(discountAmount, subtotal);
    discountCodeId = discount.id;
    loadedDiscount = discount;
  }

  const total = Math.max(0, subtotal - discountAmount);

  return {
    subtotal,
    tax: 0,
    total,
    resolvedItems: resolved,
    discountAmount,
    discountCodeId,
  };
};

// Backwards-compat alias for older callers.
const calculatePricing = estimateOrder;

// ============================================================
// Persist a priced order + its line items in one transaction, decrementing
// variant stock as it goes. Shared by the customer-initiated createOrder
// (quote-verified) and the vendor-initiated createOrderForVendor (chat-
// commerce "log this order" path, no quote token involved).
// ============================================================

const persistOrderTx = async ({ customerId, vendorId, shippingAddressId, resolvedItems, pricing, discountAmount, discountCodeId, source }) => {
  return prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        status: 'PENDING',
        source: source || 'CUSTOMER',
        customerId,
        vendorId,
        shippingAddressId,
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        total: pricing.total,
        discountAmount: discountAmount || 0,
        discountCodeId: discountCodeId || null,
      },
    });

    if (discountCodeId) {
      await tx.discountCode.update({
        where: { id: discountCodeId },
        data: { used: { increment: 1 } },
      });
    }

    await tx.orderItem.createMany({
      data: resolvedItems.map((it) => ({
        orderId: newOrder.id,
        productId: it.productId,
        variantId: it.variantId,
        name: it.name,
        description: it.description,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        lineTotal: it.lineTotal,
        selectedOptions: it.selectedOptions,
        specialInstructions: it.specialInstructions,
        substitution: it.substitution || null,
      })),
    });

    // Decrement stock on the resolved variant (single SKU or many - same path).
    for (const it of resolvedItems) {
      await tx.productVariant.update({
        where: { id: it.variantId },
        data: {
          stock: { decrement: it.quantity },
          // If we just drove stock to zero, flag the SKU unavailable.
          ...((it.variant.stock - it.quantity) <= 0 ? { isAvailable: false } : {}),
        },
      });
    }

    return newOrder;
  });
};

// ============================================================
// Create Order
// ============================================================

const createOrder = async (customerId, orderData) => {
  const {
    vendorId,
    items,
    shippingAddressId,
    quoteToken,
    promoCode,
  } = orderData;

  // Verify signed quote token. Spec: stale quotes must be rejected; the
  // vendor fingerprint and locked pricing must match the server-recomputed
  // numbers exactly.
  let quotePayload;
  try {
    quotePayload = verifyQuoteToken(quoteToken);
  } catch (err) {
    if (err.code === 'EXPIRED') {
      throw AppError.badRequest('Quote has expired - please request a fresh quote.', { code: 'QUOTE_EXPIRED' });
    }
    throw AppError.badRequest('Invalid quote token.', { code: 'QUOTE_INVALID' });
  }

  const shippingAddress = await prisma.savedAddress.findUnique({ where: { id: shippingAddressId } });
  if (!shippingAddress || shippingAddress.userId !== customerId) {
    throw AppError.badRequest('Invalid shipping address', { code: 'INVALID_SHIPPING_ADDRESS' });
  }

  // Resolve + price items server-side (validates variants + option groups).
  const resolvedItems = await resolveLineItems(vendorId, items);
  if (resolvedItems.length === 0) {
    throw AppError.badRequest('Order must contain at least one item');
  }

  const pricing = await estimateOrder({ vendorId, resolvedItems, promoCode });
  const { resolvedItems: _omit, discountAmount, discountCodeId, ...persistablePricing } = pricing;

  // Re-validate that the quote payload still matches what we just recomputed.
  // A mismatch means either pricing settings changed mid-quote OR the client
  // tampered with the body - either way we refuse and force a re-quote.
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const fingerprintMismatch = (quotePayload.vendorId || null) !== (vendorId || null);
  const priceMismatch =
    round2(quotePayload.subtotal) !== round2(pricing.subtotal) ||
    round2(quotePayload.total) !== round2(pricing.total) ||
    (quotePayload.promoCode || null) !== (promoCode || null);

  if (fingerprintMismatch || priceMismatch) {
    throw AppError.badRequest(
      'Quote no longer matches the current order - please request a fresh quote.',
      { code: 'QUOTE_MISMATCH' },
    );
  }

  // Create order in transaction
  const order = await persistOrderTx({
    customerId, vendorId, shippingAddressId, resolvedItems,
    pricing: persistablePricing, discountAmount, discountCodeId,
  });

  logger.info('Order created', { orderId: order.id, vendorId, customerId });

  // Notify vendor of new order via socket
  const io = getIO();
  emitOrderCreated(io, { ...order, items: resolvedItems });

  // emitOrderCreated above is a live-only nudge to the vendor room (for the
  // Orders page's sound/toast/refetch) - it has no fallback if the dashboard
  // tab isn't open, and persists nothing. Route the same event through
  // pushAndSocket too so it lands in the vendor's Notification Center and
  // fires a push, same as every other vendor-facing event.
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { userId: true },
  });
  if (vendor?.userId) {
    const amountText = `₦${Number(pricing.total).toLocaleString('en-NG')}`;
    notifyService.pushAndSocket(vendor.userId, {
      type: 'ORDER',
      title: 'New order received',
      body: `New order for ${amountText} - tap to view and accept.`,
      data: { route: '/vendor/orders', audience: 'vendor' },
      orderId: order.id,
    }).catch((err) => logger.warn('New-order vendor notification failed', { orderId: order.id, error: err.message }));
  }

  return order;
};

// ============================================================
// Create Order (vendor-initiated)
//
// Chat-commerce "log this order" path: the vendor agreed terms with the
// customer by phone/chat and is recording the order themselves - there is
// no customer-submitted quote to verify. Trust boundary is the vendor's own
// authenticated+ownership-checked session (see vendor.service.createVendorOrder),
// not a signed quote token. New order starts PENDING then is immediately
// auto-accepted to PROCESSING - the vendor already agreed to it - via the
// same updateStatus pipeline the "accept" button uses, so timestamps/
// notifications/sockets all stay on one code path.
// ============================================================

const createOrderForVendor = async (vendorId, vendorUserId, { customerId, shippingAddressId, items, promoCode }) => {
  const shippingAddress = await prisma.savedAddress.findUnique({ where: { id: shippingAddressId } });
  if (!shippingAddress || shippingAddress.userId !== customerId) {
    throw AppError.badRequest('Invalid shipping address', { code: 'INVALID_SHIPPING_ADDRESS' });
  }

  const resolvedItems = await resolveLineItems(vendorId, items);
  if (resolvedItems.length === 0) {
    throw AppError.badRequest('Order must contain at least one item');
  }

  const pricing = await estimateOrder({ vendorId, resolvedItems, promoCode });
  const { resolvedItems: _omit, discountAmount, discountCodeId, ...persistablePricing } = pricing;

  const order = await persistOrderTx({
    customerId, vendorId, shippingAddressId, resolvedItems,
    pricing: persistablePricing, discountAmount, discountCodeId,
    source: 'VENDOR',
  });

  logger.info('Order logged by vendor', { orderId: order.id, vendorId, customerId, source: 'VENDOR' });

  // Auto-accept: the vendor is creating this record after already agreeing
  // to fulfil it, so there's no separate "awaiting vendor confirmation" step.
  const accepted = await updateStatus(order.id, 'PROCESSING', vendorUserId, 'VENDOR');

  // Let the customer know a vendor logged an order on their behalf - they
  // weren't the one who submitted it, so they need the heads-up.
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { name: true } });
  notifyService.pushAndSocket(customerId, {
    type: 'ORDER',
    title: 'Order logged',
    body: `${vendor?.name || 'A vendor'} logged an order for you - tap to view.`,
    data: { route: `/order/${order.id}`, audience: 'customer' },
    orderId: order.id,
  }).catch((err) => logger.warn('Vendor-logged order customer notification failed', { orderId: order.id, error: err.message }));

  return accepted;
};

// ============================================================
// Update Order Status
// ============================================================

const updateStatus = async (orderId, newStatus, userId, role, payload = {}) => {
  const normalised = typeof payload === 'string' ? { reason: payload } : (payload || {});
  const reason = normalised.reason;
  const trackingNumber = normalised.trackingNumber || null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true } },
      vendor: { select: { id: true, userId: true, name: true } },
    },
  });

  if (!order) throw AppError.notFound('Order not found');

  // Enforce valid transitions
  if (!canTransitionStatus(order.status, newStatus)) {
    throw AppError.badRequest(
      `Invalid status transition: ${order.status} → ${newStatus}`,
      { code: 'INVALID_TRANSITION' },
    );
  }

  // Role-based authorization
  if (role === 'CUSTOMER') {
    if (newStatus !== 'CANCELLED') throw AppError.forbidden('Customers can only cancel orders');
    if (order.customerId !== userId) throw AppError.forbidden('Not your order');
  }
  if (role === 'VENDOR') {
    if (!['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(newStatus)) {
      throw AppError.forbidden('Vendors can only process, ship, deliver, or cancel');
    }
    // Per-order ownership check - without it any authenticated vendor could
    // PATCH any other vendor's order through the direct status route.
    if (!order.vendor || order.vendor.userId !== userId) {
      throw AppError.forbidden('Not your order');
    }
  }

  const updateData = { status: newStatus };

  // Set lifecycle timestamps
  switch (newStatus) {
    case 'PROCESSING':
      // One vendor action (accept) covers both "confirmed" and "processing" -
      // there's no separate accept-then-process step in this simplified flow.
      updateData.confirmedAt = new Date();
      updateData.processingAt = new Date();
      break;
    case 'SHIPPED':
      updateData.shippedAt = new Date();
      if (trackingNumber) updateData.trackingNumber = trackingNumber;
      break;
    case 'DELIVERED':
      updateData.deliveredAt = new Date();
      break;
    case 'CANCELLED':
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = role.toLowerCase();
      updateData.cancellationReason = reason;
      break;
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
  });

  logger.info('Order status updated', { orderId, from: order.status, to: newStatus });

  const io = getIO();
  emitStatusChanged(io, orderId, newStatus, { trackingNumber: updated.trackingNumber || null }, order.vendorId);

  if (newStatus === 'PROCESSING' && order.vendor) {
    emitVendorAccepted(io, orderId, { id: order.vendor.id, name: order.vendor.name });
  }
  if (newStatus === 'SHIPPED') {
    emitVendorShipped(io, orderId, updated.trackingNumber);
  }
  if (newStatus === 'CANCELLED') {
    emitCancelled(io, orderId, order.customerId, reason || 'Order cancelled');

    // Restore stock reserved at order creation - no money to refund, just
    // release the held inventory back to the vendor's variants.
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      if (item.variantId) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity }, isAvailable: true },
        });
      }
    }
  }

  if (newStatus === 'DELIVERED' && order.vendor) {
    await prisma.vendor.update({
      where: { id: order.vendorId },
      data: { totalOrders: { increment: 1 } },
    });
    emitCompleted(io, orderId);
  }

  // Unified notification pipeline (Notification Center row + socket + push).
  await notifyService.onOrderStatusChanged(
    { ...updated, customerId: order.customerId, vendorId: order.vendorId, vendor: order.vendor },
    order.status,
    { actorRole: role },
  );

  return updated;
};

// ============================================================
// Get Orders
// ============================================================

const getOrders = async (userId, role, { page, limit, status, categoryId, categorySlug, scope }) => {
  const statuses = status ? status.split(',').map((s) => s.trim()).filter(Boolean) : null;
  // `scope` (customer|vendor) lets one account act under a specific lens
  // regardless of its primary JWT role. Defaults to `role`.
  const ownership = (scope ? scope.toUpperCase() : role);
  const where = {
    ...(statuses && statuses.length > 0 && { status: { in: statuses } }),
    AND: [
      ...(ownership === 'CUSTOMER' ? [{ customerId: userId }] : []),
      ...(ownership === 'VENDOR' ? [{ vendor: { is: { userId } } }] : []),
      // Category filters target the ORDERING VENDOR's derived categories, i.e.
      // it must have an available product in that category.
      ...(categoryId ? [{ vendor: { is: { products: { some: { isAvailable: true, categoryId } } } } }] : []),
      ...(categorySlug ? [{ vendor: { is: { products: { some: { isAvailable: true, category: { is: { slug: categorySlug } } } } } } }] : []),
    ],
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        vendor: { select: { id: true, name: true } },
        rating: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
};

// ============================================================
// Get Order by ID
// ============================================================

/**
 * A caller may view an order if they're the customer, the owning vendor, or
 * an admin. One account can hold several roles (a vendor owner still places
 * customer orders), so this checks IDENTITY, not scalar role.
 */
const isParticipant = (order, userId, role) => {
  if (role === 'ADMIN') return true;
  if (order.customerId === userId) return true;
  if (order.vendorId && order.vendor?.userId === userId) return true;
  return false;
};

const getOrderById = async (orderId, userId, role) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      vendor: { select: { id: true, userId: true, name: true, phone: true, address: true } },
      shippingAddress: true,
      items: true,
      rating: true,
    },
  });

  if (!order) throw AppError.notFound('Order not found');

  if (!isParticipant(order, userId, role)) {
    throw AppError.forbidden('Not authorized to view this order');
  }

  return order;
};

// ============================================================
// Rate Order
// ============================================================

const rateOrder = async (orderId, customerId, ratingData) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) throw AppError.notFound('Order not found');
  if (order.customerId !== customerId) throw AppError.forbidden('Not your order');
  if (order.status !== 'DELIVERED') {
    throw AppError.badRequest('Can only rate delivered orders');
  }

  const existing = await prisma.rating.findUnique({ where: { orderId } });
  if (existing) throw AppError.conflict('Already rated');

  const rating = await prisma.rating.create({
    data: {
      orderId,
      customerId,
      vendorScore: ratingData.vendorScore,
      vendorComment: ratingData.vendorComment,
    },
  });

  // Update vendor average rating
  if (ratingData.vendorScore && order.vendorId) {
    const vendorOrders = await prisma.order.findMany({
      where: { vendorId: order.vendorId },
      select: { id: true },
    });
    const orderIds = vendorOrders.map((o) => o.id);

    const ratings = await prisma.rating.aggregate({
      where: {
        orderId: { in: orderIds },
        vendorScore: { not: null },
      },
      _avg: { vendorScore: true },
    });

    await prisma.vendor.update({
      where: { id: order.vendorId },
      data: { averageRating: ratings._avg.vendorScore || 0 },
    });
  }

  return rating;
};

// ============================================================
// Customer cancellation
//
// Simplified flat rule: cancellable while PAID or PROCESSING (the FSM
// transitions table already enforces this - SHIPPED only allows -> DELIVERED),
// full refund always, no cancellation-fee policy.
// ============================================================

const cancelOrder = async (orderId, customerId, reason) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customerId: true },
  });
  if (!order) throw AppError.notFound('Order not found');
  if (order.customerId !== customerId) throw AppError.forbidden('Not your order');

  await updateStatus(orderId, 'CANCELLED', customerId, 'CUSTOMER', { reason: reason || 'Customer cancelled' });

  return { orderId, status: 'CANCELLED' };
};

// ============================================================
// Active order - single-query home banner. Backed by the
// (customerId, status) composite index.
// ============================================================

const getActiveOrder = async (customerId) => {
  const active = await prisma.order.findFirst({
    where: {
      customerId,
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      vendor: {
        select: { id: true, name: true },
      },
    },
  });
  return active || null;
};

// ============================================================
// In-app messaging
// ============================================================

const assertMessageParticipant = async (orderId, userId, role) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, vendorId: true, vendor: { select: { userId: true } } },
  });
  if (!order) throw AppError.notFound('Order not found');
  if (role === 'ADMIN') return order;
  const allowedUserIds = new Set();
  if (order.customerId) allowedUserIds.add(order.customerId);
  if (order.vendor?.userId) allowedUserIds.add(order.vendor.userId);
  if (!allowedUserIds.has(userId)) {
    throw AppError.forbidden('Not authorized to message on this order');
  }
  return order;
};

const listMessages = async (orderId, userId, role, { before, limit }) => {
  await assertMessageParticipant(orderId, userId, role);

  const where = { orderId };
  if (before) where.createdAt = { lt: new Date(before) };

  const messages = await prisma.orderMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit || 30, 1), 100),
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
  return messages.reverse(); // chronological ASC for client rendering
};

const postMessage = async (orderId, userId, role, body) => {
  const order = await assertMessageParticipant(orderId, userId, role);

  const message = await prisma.orderMessage.create({
    data: { orderId, fromUserId: userId, body: body.trim() },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });

  const io = getIO();
  io.to(getOrderRoom(orderId)).emit(ORDER.MESSAGE_NEW, {
    orderId,
    message,
  });

  // Push the other party so a backgrounded app wakes.
  //   - CUSTOMER → /order/:id      (customer app's order detail)
  //   - VENDOR   → /vendor/orders/:id (vendor dashboard's order detail)
  const sender = message.fromUser;
  const senderName = `${sender?.firstName || ''} ${sender?.lastName || ''}`.trim() || 'New message';
  const recipients = [];
  if (order.customerId && order.customerId !== userId) {
    recipients.push({ userId: order.customerId, route: `/order/${orderId}`, audience: 'customer' });
  }
  if (order.vendor?.userId && order.vendor.userId !== userId) {
    recipients.push({ userId: order.vendor.userId, route: `/vendor/orders/${orderId}`, audience: 'vendor' });
  }
  const preview = message.body.length > 80 ? `${message.body.slice(0, 80)}…` : message.body;
  await Promise.all(
    recipients.map(({ userId: rid, route, audience }) =>
      notifyService.pushAndSocket(rid, {
        type: 'ORDER_MESSAGE',
        title: senderName,
        body: preview,
        data: { route, orderId, kind: 'message', audience },
        orderId,
      }).catch((err) => logger.warn('postMessage notify failed', { rid, error: err.message })),
    ),
  );

  return message;
};

// ============================================================
// Admin Functions
// ============================================================

const getAllOrdersAdmin = async ({ page, limit, status, categoryId, categorySlug, startDate, endDate, customerId, vendorId }) => {
  const where = {
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(vendorId && { vendorId }),
    ...(categoryId && { vendor: { is: { products: { some: { isAvailable: true, categoryId } } } } }),
    ...(categorySlug && { vendor: { is: { products: { some: { isAvailable: true, category: { is: { slug: categorySlug } } } } } } }),
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vendor: { select: { id: true, name: true, phone: true } },
        rating: true,
        items: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
};

/**
 * Admin force-cancel. Blocks once the order is DELIVERED or already CANCELLED.
 */
const forceCancelOrder = async (orderId, reason, adminId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error('Order not found');
  if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
    throw new Error('Cannot cancel order in current status');
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
    });

    // Restore stock on the resolved variant for each line item.
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: item.quantity },
              isAvailable: true,
            },
          });
        }
      }
    }

    return updatedOrder;
  });

  logger.info('Order force-cancelled by admin', { orderId, adminId, reason });

  const io = getIO();
  emitCancelled(io, orderId, order.customerId, reason, { cancelledBy: 'admin' });

  return updated;
};

const adminUpdateStatus = async (orderId, newStatus, adminId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new Error('Order not found');

  if (!canTransitionStatus(order.status, newStatus)) {
    throw new Error(`Invalid status transition from ${order.status} to ${newStatus}`);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true } },
      vendor: { select: { id: true, name: true } },
    },
  });

  const io = getIO();
  emitStatusChanged(io, orderId, newStatus, {}, order.vendorId);

  return updated;
};

module.exports = {
  calculatePricing,
  estimateOrder,
  resolveLineItems,
  createOrder,
  createOrderForVendor,
  updateStatus,
  getOrders,
  getOrderById,
  rateOrder,
  cancelOrder,
  getActiveOrder,
  listMessages,
  postMessage,
  // Admin functions
  getAllOrdersAdmin,
  forceCancelOrder,
  adminUpdateStatus,
};

/**
 * Order socket handler.
 *
 * ROOMS:
 * - order:{orderId} - customer and vendor join this room during an active order
 * - vendor:{vendorId} - vendor-specific room for new orders + catalogue updates
 * - Events in the order room: status changes, completion, cancellation
 */

const { ORDER, getOrderRoom, getVendorRoom } = require('../events');
const { logger } = require('../../utils/logger');

const registerOrderHandlers = (io, socket) => {
  /**
   * Join an order tracking room.
   * Payload: { orderId: string }
   */
  socket.on(ORDER.JOIN_ROOM, (data) => {
    const { orderId } = data;
    if (!orderId) return;

    const room = getOrderRoom(orderId);
    socket.join(room);

    logger.debug('Joined order room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });

  /**
   * Leave an order tracking room.
   * Payload: { orderId: string }
   */
  socket.on(ORDER.LEAVE_ROOM, (data) => {
    const { orderId } = data;
    if (!orderId) return;

    const room = getOrderRoom(orderId);
    socket.leave(room);

    logger.debug('Left order room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });

  /**
   * Join vendor room to receive new order + catalogue notifications.
   * Payload: { vendorId: string }
   */
  socket.on(ORDER.JOIN_VENDOR_ROOM, (data) => {
    const { vendorId } = data;
    if (!vendorId) return;

    const room = getVendorRoom(vendorId);
    socket.join(room);

    logger.debug('Joined vendor room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });

  /**
   * Leave vendor room.
   * Payload: { vendorId: string }
   */
  socket.on(ORDER.LEAVE_VENDOR_ROOM, (data) => {
    const { vendorId } = data;
    if (!vendorId) return;

    const room = getVendorRoom(vendorId);
    socket.leave(room);

    logger.debug('Left vendor room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });
};

// --- Server-side emit helpers (used by services/workers) ---

/**
 * Emit ORDER.CREATED when a new order is created. Sends to the vendor room
 * for vendor acceptance.
 */
const emitOrderCreated = (io, order) => {
  const vendorRoom = getVendorRoom(order.vendorId);
  io.to(vendorRoom).emit(ORDER.CREATED, {
    orderId: order.id,
    customerId: order.customerId,
    vendorId: order.vendorId,
    items: order.items,
    total: Number(order.total),
    createdAt: order.createdAt,
  });
  logger.info('ORDER.CREATED emitted to vendor', { orderId: order.id, vendorId: order.vendorId });
};

/**
 * Emit ORDER.STATUS_CHANGED on status updates.
 * Sends to the order room (customer + vendor) and the vendor's room (the
 * vendor dashboard's socket only joins the vendor room, never per-order
 * rooms, so without this its order list/detail never sees updates).
 */
const emitStatusChanged = (io, orderId, status, metadata = {}, vendorId = null) => {
  const payload = {
    orderId,
    status,
    timestamp: Date.now(),
    ...metadata,
  };
  io.to(getOrderRoom(orderId)).emit(ORDER.STATUS_CHANGED, payload);
  if (vendorId) {
    io.to(getVendorRoom(vendorId)).emit(ORDER.STATUS_CHANGED, payload);
  }
  logger.info('ORDER.STATUS_CHANGED emitted', { orderId, status, vendorId: vendorId || undefined });
};

/**
 * Emit ORDER.VENDOR_ACCEPTED when the vendor accepts the order.
 * Sends to the customer's personal room via the order room.
 */
const emitVendorAccepted = (io, orderId, vendorInfo) => {
  io.to(getOrderRoom(orderId)).emit(ORDER.VENDOR_ACCEPTED, {
    orderId,
    vendor: vendorInfo,
    timestamp: Date.now(),
  });
  logger.info('ORDER.VENDOR_ACCEPTED emitted', { orderId });
};

/**
 * Emit ORDER.VENDOR_SHIPPED when the vendor marks the order shipped.
 */
const emitVendorShipped = (io, orderId, trackingNumber) => {
  io.to(getOrderRoom(orderId)).emit(ORDER.VENDOR_SHIPPED, {
    orderId,
    trackingNumber: trackingNumber || null,
    timestamp: Date.now(),
  });
  logger.info('ORDER.VENDOR_SHIPPED emitted', { orderId });
};

/**
 * Emit ORDER.COMPLETED when the order is delivered + settled.
 */
const emitCompleted = (io, orderId) => {
  io.to(getOrderRoom(orderId)).emit(ORDER.COMPLETED, {
    orderId,
    status: 'DELIVERED',
    timestamp: Date.now(),
  });
  logger.info('ORDER.COMPLETED emitted', { orderId });
};

/**
 * Emit ORDER.CANCELLED when the order is cancelled.
 * Sends to the order room and the customer's personal room.
 */
const emitCancelled = (io, orderId, customerId, reason, extras = {}) => {
  const { getUserRoom } = require('../events');
  const payload = {
    orderId,
    status: 'CANCELLED',
    reason,
    timestamp: Date.now(),
    ...extras,
  };
  io.to(getOrderRoom(orderId)).emit(ORDER.CANCELLED, payload);
  io.to(getUserRoom(customerId)).emit(ORDER.CANCELLED, payload);
  logger.info('ORDER.CANCELLED emitted', { orderId, reason });
};

module.exports = {
  registerOrderHandlers,
  emitOrderCreated,
  emitStatusChanged,
  emitVendorAccepted,
  emitVendorShipped,
  emitCompleted,
  emitCancelled,
};

/**
 * Order routes - /orders
 */

const { Router } = require('express');
const orderController = require('./order.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { idempotency } = require('../../middlewares/idempotency.middleware');
const { orderCreationLimiter, quoteLimiter } = require('../../middlewares/rate-limit.middleware');
const {
  createOrderSchema,
  updateStatusSchema,
  listOrdersSchema,
  rateOrderSchema,
  cancelOrderSchema,
  quoteOrderSchema,
  postMessageSchema,
  listMessagesSchema,
} = require('./order.validator');

const router = Router();

// All order routes require authentication
router.use(authenticate);

// ============================================================
// Public endpoints (any authenticated user)
// ============================================================

// Server-truth quote - POST same shape as createOrder, returns pricing + validUntil
router.post('/quote', quoteLimiter, validate(quoteOrderSchema), orderController.getQuote);

// List orders (customers see theirs, vendors see theirs)
router.get('/', validate(listOrdersSchema, 'query'), orderController.getOrders);

// Active order for the home banner. Single query against the
// (customerId, status) composite index. Returns the current active order
// or null. Must be registered BEFORE /:orderId so /active doesn't get
// captured as `orderId='active'`.
router.get('/active', orderController.getActiveOrder);

// Get single order details
router.get('/:orderId', orderController.getOrderById);

// In-app messaging - list + post (customer/vendor, both in the order).
// Idempotent post so a flaky network retry can't double-send the same message.
router.get('/:orderId/messages', validate(listMessagesSchema, 'query'), orderController.listMessages);
router.post('/:orderId/messages', idempotency, validate(postMessageSchema), orderController.postMessage);

// ============================================================
// Customer endpoints
// ============================================================

// Create a new order - capped per user (abuse mitigation).
router.post('/', authorize('CUSTOMER'), orderCreationLimiter, idempotency, validate(createOrderSchema), orderController.createOrder);

// Cancel order (customer only, before shipping) - full refund, no fee policy.
router.delete('/:orderId', authorize('CUSTOMER'), validate(cancelOrderSchema), orderController.cancelOrder);

// Rate a delivered order (customer only).
router.post('/:orderId/rate', authorize('CUSTOMER'), validate(rateOrderSchema), orderController.rateOrder);

// ============================================================
// Vendor endpoints
// ============================================================

// Update order status (vendor: PROCESSING, SHIPPED, DELIVERED, CANCELLED).
// Idempotency-Key support lets the vendor client retry a transition over a
// flaky network without driving the FSM forward twice.
router.patch(
  '/:orderId/status',
  authorize('VENDOR', 'ADMIN'),
  idempotency,
  validate(updateStatusSchema),
  orderController.updateStatus,
);

// ============================================================
// Admin endpoints
// ============================================================

// Get all orders with advanced filtering (admin only)
router.get('/admin/all', authorize('ADMIN'), orderController.getAllOrdersAdmin);

// Force cancel order with reason (admin only)
router.patch('/:orderId/force-cancel', authorize('ADMIN'), orderController.forceCancelOrder);

// Admin status override (admin only)
router.patch('/:orderId/admin-status', authorize('ADMIN'), orderController.adminUpdateStatus);

module.exports = router;

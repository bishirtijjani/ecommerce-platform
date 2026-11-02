/**
 * Order validator schemas
 */

const { z } = require('zod');
const { ALL_STATUSES } = require('../../utils/status');

const ORDER_STATUSES = ALL_STATUSES;

// Substitution preference per line item (e.g. grocery order where an exact
// item is out of stock).
const SUBSTITUTION_PREFERENCES = ['NONE', 'VENDOR_PICK', 'CONTACT_ME'];

const itemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  /// Customer's option selections per group. Server validates against the live
  /// option-group config and snapshots into OrderItem.selectedOptions.
  selectedOptions: z.array(z.object({
    groupId: z.string().uuid(),
    itemIds: z.array(z.string().uuid()).default([]),
  })).optional(),
  specialInstructions: z.string().max(200).optional(),
  substitution: z.enum(SUBSTITUTION_PREFERENCES).optional(),
});

// ============================================================
// Create Order Schema
// ============================================================

const createOrderSchema = z.object({
  vendorId: z.string().uuid('vendorId is required'),

  // Where the order ships - one of the customer's saved addresses.
  shippingAddressId: z.string().uuid('shippingAddressId is required'),

  // Items. Server resolves `unitPrice`/`lineTotal` from the variant + option
  // group price deltas - clients never set prices.
  items: z.array(itemSchema).min(1, 'Order must contain at least one item'),

  // Special instructions
  specialInstructions: z.string().optional(),

  // Signed quote token from POST /orders/quote.
  // Server re-verifies signature + TTL + locked numbers before persisting.
  quoteToken: z.string().min(20),
  promoCode: z.string().trim().toUpperCase().optional(),
});

// ============================================================
// Update Status Schema
// ============================================================

const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  reason: z.string().optional(),
  // Optional carrier tracking reference, set on the SHIPPED transition.
  trackingNumber: z.string().max(100).optional(),
});

// ============================================================
// List Orders Schema
// ============================================================

const listOrdersSchema = z.object({
  status: z.string().optional(), // comma-separated statuses allowed
  // Which ownership lens to list under. Defaults to the caller's JWT role.
  scope: z.enum(['customer', 'vendor']).optional(),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Rate Order Schema
// ============================================================

const rateOrderSchema = z.object({
  vendorScore: z.number().int().min(1).max(5),
  vendorComment: z.string().optional(),
});

// ============================================================
// Cancel Order Schema
// ============================================================

const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

// ============================================================
// Quote Schema - server-truth pricing preview without persisting an order.
// ============================================================

const quoteOrderSchema = z.object({
  vendorId: z.string().uuid(),
  items: z.array(itemSchema).min(1),
  promoCode: z.string().trim().toUpperCase().optional(),
});

// ============================================================
// Messaging Schemas
// ============================================================

const postMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(1000),
});

const listMessagesSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = {
  createOrderSchema,
  updateStatusSchema,
  listOrdersSchema,
  rateOrderSchema,
  cancelOrderSchema,
  quoteOrderSchema,
  postMessageSchema,
  listMessagesSchema,
  ORDER_STATUSES,
  SUBSTITUTION_PREFERENCES,
};

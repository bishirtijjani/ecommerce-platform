/**
 * Chat validator schemas.
 */

const { z } = require('zod');

// ============================================================
// Start (find-or-create) a conversation
// ============================================================

const startConversationSchema = z.object({
  vendorId: z.string().uuid('vendorId is required'),
  // Optional product context - set when the chat is opened from a product
  // page rather than the vendor storefront directly.
  productId: z.string().uuid().optional(),
  productName: z.string().trim().max(200).optional(),
  productImage: z.string().url().optional(),
});

// ============================================================
// Post a message
// ============================================================

const postChatMessageSchema = z
  .object({
    body: z.string().trim().max(2000).optional().default(''),
    attachmentUrls: z.array(z.string().url()).max(5).optional().default([]),
  })
  .refine((data) => data.body.length > 0 || data.attachmentUrls.length > 0, {
    message: 'Message cannot be empty',
    path: ['body'],
  });

// ============================================================
// List queries
// ============================================================

const listConversationsQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  archived: z.enum(['true', 'false']).optional(),
  // Which side of the marketplace the caller is browsing. Required because a
  // single account can be customer + vendor at once, so scalar `role` is
  // ambiguous; defaults to the legacy role-based behaviour when omitted.
  side: z.enum(['vendor', 'customer']).optional(),
});

const listChatMessagesQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ============================================================
// Archive toggle
// ============================================================

const archiveConversationSchema = z.object({
  archived: z.boolean(),
});

module.exports = {
  startConversationSchema,
  postChatMessageSchema,
  listConversationsQuerySchema,
  listChatMessagesQuerySchema,
  archiveConversationSchema,
};

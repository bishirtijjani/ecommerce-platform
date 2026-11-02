/**
 * Request module validation schemas (zod).
 *
 * A Request is a customer's broadcast need ("I need X"). Category is optional
 * - omitting it (the "Other / not sure" path) makes matching fall back to
 * keyword search over seller/product text.
 */

const { z } = require('zod');

const uuid = z.string().uuid();

const createRequestSchema = z
  .object({
    categoryId: uuid.optional().nullable(),
    subcategoryId: uuid.optional().nullable(),

    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    images: z.array(z.string().url()).max(5).optional(),
    videos: z.array(z.string().url()).max(1).optional(),

    quantity: z.coerce.number().int().positive().max(100000).optional().nullable(),
    budgetMin: z.coerce.number().nonnegative().optional().nullable(),
    budgetMax: z.coerce.number().nonnegative().optional().nullable(),
    neededBy: z.coerce.date().optional().nullable(),
    urgency: z.enum(['NORMAL', 'URGENT']).optional(),

    address: z.string().trim().min(3).max(300),
    // Optional: only used to rank/filter NEARBY matches by distance. A customer
    // who denied GPS still gets matched on state/LGA scope.
    lat: z.coerce.number().min(-90).max(90).optional().nullable(),
    lng: z.coerce.number().min(-180).max(180).optional().nullable(),
    placeId: z.string().trim().max(200).optional().nullable(),

    // Optional at the API level on purpose: older app builds (installed PWAs,
    // store binaries) never send them. The current compose screen requires
    // State and treats LGA as optional, and findMatches degrades gracefully.
    state: z.string().trim().max(60).optional().nullable(),
    lga: z.string().trim().max(80).optional().nullable(),

    reach: z.enum(['NEARBY', 'ANYWHERE']).optional(),
    radiusKm: z.coerce.number().int().min(1).max(500).optional(),
  })
  .refine(
    (d) => d.budgetMin == null || d.budgetMax == null || d.budgetMin <= d.budgetMax,
    { message: 'budgetMin cannot exceed budgetMax', path: ['budgetMin'] },
  );

const respondRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(1000),
  price: z.coerce.number().nonnegative().optional().nullable(),
  priceNote: z.string().trim().max(120).optional().nullable(),
  etaText: z.string().trim().max(120).optional().nullable(),
});

const acceptResponseSchema = z.object({ responseId: uuid });

const listRequestsQuerySchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'EXPIRED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const inboxQuerySchema = z.object({
  seen: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const adminListRequestsQuerySchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'EXPIRED', 'CANCELLED']).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

module.exports = {
  createRequestSchema,
  respondRequestSchema,
  acceptResponseSchema,
  listRequestsQuerySchema,
  inboxQuerySchema,
  adminListRequestsQuerySchema,
};

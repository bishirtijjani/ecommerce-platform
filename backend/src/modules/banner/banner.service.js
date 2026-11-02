/**
 * Banner service - Phase 6.
 *
 * Customer-facing read: returns banners that are currently `isActive`, not
 * scheduled-future via `startsAt`, not expired via `endsAt`, and whose
 * `audience` predicate (if any) matches the requesting user.
 *
 * Audience predicates are small JSON shapes evaluated server-side so we
 * never ship a banner intended for one segment to another:
 *   { "kyc": "VERIFIED" }              - only verified users see it
 *   { "minOrders": 1 }                 - only users with ≥1 completed order
 *   { "categorySlug": "fashion" }      - only users who've ordered from this category
 * Empty / null audience = visible to everyone.
 *
 * Audience evaluation is batched into a SINGLE user profile lookup up front.
 * Previously each candidate banner could do up to 3 separate DB calls → 60
 * round-trips for a heavy banner shelf. Now: one `User.findUnique`,
 * optionally one `Order.count`, optionally one raw aggregate over ordered
 * category slugs - total 1-3 DB reads regardless of banner count.
 *
 * Admin CRUD for banners follows the same shape as categories/vendors but
 * is intentionally not in this module - it lands in `modules/admin/admin.service`.
 */

const { prisma } = require('../../config/database');

// Inspect every candidate's audience and figure out which user-profile
// fields we actually need. Lets us skip expensive lookups when no banner
// targets that audience field.
const profileNeeds = (candidates) => {
  const need = { kyc: false, minOrders: false, categorySlug: false };
  for (const b of candidates) {
    const a = b.audience;
    if (!a || typeof a !== 'object') continue;
    if (a.kyc) need.kyc = true;
    if (typeof a.minOrders === 'number' && a.minOrders > 0) need.minOrders = true;
    if (a.categorySlug) need.categorySlug = true;
  }
  return need;
};

const buildProfile = async (userId, needs) => {
  const profile = {};
  if (needs.kyc) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    });
    profile.kyc = u?.kycStatus || null;
  }
  if (needs.minOrders) {
    profile.completedOrders = await prisma.order.count({
      where: { customerId: userId, status: 'DELIVERED' },
    });
  }
  if (needs.categorySlug) {
    // Aggregate category slugs server-side so we don't fetch every order the
    // user has ever placed. Prisma's `distinct` requires the discriminator to
    // be in `select`, and even with that it's still N rows then de-dup on the
    // client; a raw aggregate is constant in row count and free of the cap.
    const slugRows = await prisma.$queryRaw`
      SELECT DISTINCT pc."slug" AS slug
      FROM "orders" o
      INNER JOIN "order_items" oi ON oi."orderId" = o.id
      LEFT JOIN "products" p ON oi."productId" = p.id
      LEFT JOIN "vendor_categories" pc ON p."categoryId" = pc.id
      WHERE o."customerId" = ${userId}
        AND pc."slug" IS NOT NULL
    `;
    profile.categorySlugs = new Set(
      slugRows.map((r) => r.slug).filter(Boolean),
    );
  }
  return profile;
};

const matchesAudience = (audience, profile) => {
  if (!audience || typeof audience !== 'object') return true;
  // Arrays are typeof 'object' but never the shape we expect - treat as
  // malformed (admin paste error) and refuse to ship the banner.
  if (Array.isArray(audience)) return false;
  if (Object.keys(audience).length === 0) return true;
  if (audience.kyc && profile.kyc !== audience.kyc) return false;
  if (typeof audience.minOrders === 'number' && audience.minOrders > 0) {
    if ((profile.completedOrders ?? 0) < audience.minOrders) return false;
  }
  if (audience.categorySlug) {
    if (!profile.categorySlugs || !profile.categorySlugs.has(audience.categorySlug)) return false;
  }
  return true;
};

const listActiveForUser = async (userId) => {
  const now = new Date();
  const candidates = await prisma.banner.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 20,
  });

  if (candidates.length === 0) return [];

  const needs = profileNeeds(candidates);
  const profile = (needs.kyc || needs.minOrders || needs.categorySlug)
    ? await buildProfile(userId, needs)
    : {};

  return candidates.filter((b) => matchesAudience(b.audience, profile));
};

module.exports = { listActiveForUser };

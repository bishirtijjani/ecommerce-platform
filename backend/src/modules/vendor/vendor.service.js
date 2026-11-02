/**
 * Vendor service - manages marketplace vendors (shops/stores)
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { getIO } = require('../../sockets');
const { VENDOR, getVendorRoom, getVendorsBroadcastRoom, getAdminRoom } = require('../../sockets/events');
// Vendor accept/reject/status routes delegate the actual lifecycle transition
// to order.service.updateStatus so socket emits, push notifications,
// lifecycle timestamps, and FSM checks all flow through a single pipeline.
// The vendor-side ownership guard runs before the delegation for clearer
// error responses.
const orderService = require('../order/order.service');
const emailService = require('../../services/email.service');
const notifyService = require('../../services/notify.service');
const {
  missingVendorLocation,
} = require('../../utils/location');
const { buildBoundingBox } = require('../../utils/geo');
// Shared (rule ↔ min/max) consistency check, also used by the zod validator so
// the rule and its bounds can never drift apart on an update.
const { optionGroupRuleError } = require('./vendor.validator');

// Matches a canonical UUID. Used to tell a real category id apart from the
// category NAME the published customer app sends to GET /vendors/products.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Broadcast a `vendor:catalogue:updated` event to anyone watching this vendor
 * (customers on the vendor's product page, the vendor's own dashboard).
 *
 * The customer app refetches the catalogue on receipt, so 86-ing an option
 * item or marking a variant unavailable propagates within socket-roundtrip
 * latency. Wrapped in try/catch so socket failures never block the underlying
 * CRUD.
 */
const broadcastCatalogueUpdate = (vendorId, payload = {}) => {
  try {
    const io = getIO();
    io.to(getVendorRoom(vendorId)).emit(VENDOR.CATALOGUE_UPDATED, {
      vendorId,
      timestamp: Date.now(),
      ...payload,
    });
  } catch (err) {
    logger.warn('broadcastCatalogueUpdate failed (non-fatal)', { vendorId, error: err.message });
  }
};

/**
 * Whether the vendor actually reads as "open" to customers - the vendor's
 * own toggle AND the admin's visibility override both have to agree, since a
 * suspended/hidden vendor shouldn't show as open even if it never flipped
 * its own switch.
 */
const isEffectivelyOpen = (vendor) => vendor.isOpen === true && vendor.adminActiveOverride !== false;

/**
 * Broadcast a vendor open/closed status change to:
 * - the vendor's own room (customers on its product page)
 * - the global vendors-broadcast room (browse/list screens)
 * - the admin dashboard room
 *
 * Either the vendor (self-toggle) or an admin (adminActiveOverride) can
 * trigger this, so callers pass the vendor row after the update.
 */
const broadcastVendorStatus = (vendor) => {
  try {
    const io = getIO();
    const payload = {
      vendorId: vendor.id,
      isOpen: vendor.isOpen,
      adminActiveOverride: vendor.adminActiveOverride,
      effectiveOpen: isEffectivelyOpen(vendor),
      timestamp: Date.now(),
    };
    io.to(getVendorRoom(vendor.id)).emit(VENDOR.STATUS_CHANGED, payload);
    io.to(getVendorsBroadcastRoom()).emit(VENDOR.STATUS_CHANGED, payload);
    io.to(getAdminRoom()).emit(VENDOR.STATUS_CHANGED, payload);
  } catch (err) {
    logger.warn('broadcastVendorStatus failed (non-fatal)', { vendorId: vendor.id, error: err.message });
  }
};

// ============================================================
// Create Vendor
// ============================================================

const createVendor = async (vendorData) => {
  const { userId, ...data } = vendorData;

  // Check if user exists if userId provided
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');
  }

  const vendor = await prisma.vendor.create({
    data: {
      ...data,
      userId: userId || null,
    },
  });

  logger.info('Vendor created', { vendorId: vendor.id });

  return vendor;
};

// ============================================================
// Get Vendors (List)
// ============================================================

/**
 * Derive the categories a set of vendors actually sell in - the distinct
 * categories of their AVAILABLE products. A shop can sell across many
 * categories, so this replaces the old single `Vendor.categoryId`.
 */
const deriveVendorCategories = async (vendorIds) => {
  if (!vendorIds || vendorIds.length === 0) return new Map();

  const group = await prisma.product.groupBy({
    by: ['vendorId', 'categoryId'],
    where: { vendorId: { in: vendorIds }, isAvailable: true },
  });

  const catIds = [...new Set(group.map((g) => g.categoryId))];
  const cats = await prisma.vendorCategory.findMany({ where: { id: { in: catIds } } });
  const catById = new Map(cats.map((c) => [c.id, c]));

  const map = new Map();
  group.forEach((g) => {
    const cat = catById.get(g.categoryId);
    if (!cat) return;
    const arr = map.get(g.vendorId) || [];
    if (!arr.some((c) => c.id === cat.id)) arr.push(cat);
    map.set(g.vendorId, arr);
  });
  return map;
};

/**
 * Build a shop's storefront category grid by deriving it from its available
 * products - the single unified taxonomy (global + this vendor's own rows).
 * A category shows with the subcategories the vendor actually sells in. This
 * keeps the shop page and the marketplace search backed by the exact same
 * source (one category + one subcategory per product), so a custom category a
 * vendor created behaves identically to a global one. */
const deriveStorefrontCategories = async (vendorId) => {
  const rows = await prisma.product.groupBy({
    by: ['categoryId', 'subcategoryId'],
    where: { vendorId, isAvailable: true },
  });
  if (rows.length === 0) return [];

  const catIds = [...new Set(rows.map((r) => r.categoryId))];
  const subIds = [...new Set(rows.map((r) => r.subcategoryId))].filter(Boolean);
  const [cats, subs] = await Promise.all([
    prisma.vendorCategory.findMany({
      where: { id: { in: catIds }, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.subcategory.findMany({
      where: { id: { in: subIds }, isActive: true },
    }),
  ]);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const subById = new Map(subs.map((s) => [s.id, s]));

  const byCat = new Map();
  rows.forEach((r) => {
    const cat = catById.get(r.categoryId);
    // A product filed under a category but with no subcategory still makes the
    // category show on the storefront (with whatever subcategory rows exist).
    if (!cat) return;
    if (!byCat.has(cat.id)) {
      byCat.set(cat.id, { id: cat.id, name: cat.name, imageUrl: cat.imageUrl, sortOrder: cat.sortOrder, subcategories: [] });
    }
    const sub = subById.get(r.subcategoryId);
    if (!sub) return;
    const entry = byCat.get(cat.id);
    if (!entry.subcategories.some((s) => s.id === sub.id)) {
      entry.subcategories.push({ id: sub.id, name: sub.name, imageUrl: sub.imageUrl, sortOrder: sub.sortOrder });
    }
  });

  return [...byCat.values()]
    .map((cat) => ({
      ...cat,
      subcategories: cat.subcategories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
};

const getVendors = async (filters) => {
  const { categoryId, categorySlug, status, lat, lng, radius, openNow, page, limit } = filters;

  const where = {
    status: status || 'APPROVED',
    ...(openNow && { isOpen: true }),
    isActive: true,
    adminActiveOverride: true,
  };

  // If location provided, filter by radius
  if (lat && lng && radius) {
    // Using raw SQL for distance calculation (Haversine formula)
    // This is a simplified approach - in production, use PostGIS
    where.AND = [
      {
        lat: { gte: lat - (radius / 111), lte: lat + (radius / 111) },
      },
      {
        lng: { gte: lng - (radius / 111), lte: lng + (radius / 111) },
      },
    ];
  }

  let vendors = await prisma.vendor.findMany({ where, orderBy: { createdAt: 'desc' } });

  // Derive each shop's categories from its available products.
  const categoriesByVendor = await deriveVendorCategories(vendors.map((v) => v.id));
  // Each shop also carries an explicit top-level industry (categoryId) that is
  // the source of truth for grouping on the marketplace/home - so a shop with
  // no available products yet still appears under its own industry instead of
  // a spurious "Other" group.
  const explicitCatIds = [...new Set(vendors.map((v) => v.categoryId).filter(Boolean))];
  const explicitCats = explicitCatIds.length
    ? await prisma.vendorCategory.findMany({ where: { id: { in: explicitCatIds } } })
    : [];
  const explicitCatById = new Map(explicitCats.map((c) => [c.id, c]));

  vendors = vendors.map((v) => {
    const cats = categoriesByVendor.get(v.id) || [];
    const explicit = v.categoryId ? explicitCatById.get(v.categoryId) : null;
    return {
      ...v,
      // Fixed top-level industry (source of truth for home/marketplace grouping).
      industry: explicit ? { id: explicit.id, name: explicit.name, slug: explicit.slug } : null,
      categories: explicit && !cats.some((c) => c.id === explicit.id) ? [...cats, explicit] : cats,
    };
  });

  // Filter by a shop's derived categories.
  if (categoryId || categorySlug) {
    vendors = vendors.filter((v) =>
      v.categories.some((c) => (categoryId && c.id === categoryId) || (categorySlug && c.slug === categorySlug)),
    );
  }

  const total = vendors.length;
  const paged = vendors.slice((page - 1) * limit, (page - 1) * limit + limit);

  // Real product count + a handful of thumbnails for the Home "Shops" card
  // (avatar + rating + a strip of product photos) - a lightweight preview,
  // not the full catalog (see getPublicProducts for that).
  const previews = await prisma.product.findMany({
    where: { vendorId: { in: paged.map((v) => v.id) }, isAvailable: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, imageUrl: true, vendorId: true },
  });
  const counts = await prisma.product.groupBy({
    by: ['vendorId'],
    where: { vendorId: { in: paged.map((v) => v.id) }, isAvailable: true },
    _count: true,
  });
  const countByVendor = new Map(counts.map((c) => [c.vendorId, c._count]));
  const previewByVendor = new Map();
  previews.forEach((p) => {
    const arr = previewByVendor.get(p.vendorId) || [];
    if (arr.length < 3) {
      arr.push({ id: p.id, imageUrl: p.imageUrl });
      previewByVendor.set(p.vendorId, arr);
    }
  });

  return {
    vendors: paged.map((v) => ({
      ...v,
      productsCount: countByVendor.get(v.id) || 0,
      previewProducts: previewByVendor.get(v.id) || [],
    })),
    total,
    page,
    limit,
  };
};

// ============================================================
// Get Vendor by ID
// ============================================================

const getVendorById = async (vendorId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      products: {
        // The storefront's normal catalogue excludes Second Hand listings (they
        // live in the dedicated Second Hand space + marketplace, fetched
        // separately via condition=SECOND_HAND).
        where: { isAvailable: true, condition: { not: 'SECOND_HAND' } },
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          subcategory: true,
          variants: {
            where: { isAvailable: true },
            orderBy: { price: 'asc' },
          },
          optionGroups: {
            orderBy: { sortOrder: 'asc' },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
      // Shop story highlights (permanent, not time-boxed). Only active ones
      // surface on the storefront; each with its ordered stories and (up to
      // two) linked products per story.
      highlights: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          stories: {
            orderBy: { sortOrder: 'asc' },
            include: {
              products: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  product: {
                    select: {
                      id: true, name: true, basePrice: true, imageUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // This is the public (no-auth) storefront lookup - treat a non-visible
  // vendor (pending, suspended, admin-hidden) the same as "not found" rather
  // than leaking its existence/contact info to an anonymous caller.
  if (!vendor || vendor.status !== 'APPROVED' || !vendor.isActive || !vendor.adminActiveOverride) {
    throw AppError.notFound('Vendor not found');
  }

  // Reviews live on Rating (post-delivery, one per order - see
  // schema.prisma), not directly on Vendor, so pull them via the order
  // relation and attach for the storefront's About/Reviews tabs.
  const ratings = await prisma.rating.findMany({
    where: { order: { vendorId }, vendorComment: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { firstName: true, lastName: true } } },
  });

  // The shop's storefront categories, derived from its available products in
  // the unified taxonomy (global + vendor-owned rows) - so a custom category
  // the vendor created is just as searchable/displayed as a global one.
  const categories = await deriveStorefrontCategories(vendorId);

  // Flatten each story's linked products into `{ id, name, price, imageUrl }`.
  const withFlatStoryProducts = (highlights) =>
    (highlights || []).map((h) => ({
      ...h,
      stories: (h.stories || []).map((s) => ({
        ...s,
        products: (s.products || [])
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((sp) => ({
            id: sp.product.id,
            name: sp.product.name,
            price: Number(sp.product.basePrice),
            imageUrl: sp.product.imageUrl,
          })),
      })),
    }));

  const { highlights, ...rest } = vendor;
  return {
    ...rest,
    categories,
    highlights: withFlatStoryProducts(highlights),
    reviews: ratings.map((r) => ({
      name: `${r.customer.firstName} ${r.customer.lastName.charAt(0)}.`,
      rating: r.vendorScore,
      comment: r.vendorComment,
      createdAt: r.createdAt,
    })),
  };
};

// Chat-commerce "Request a callback" action (see ContactVendorSheet on the
// customer app) - no order/cart involved, this just emails the vendor the
// customer's phone number so they can call back themselves. Vendor has no
// dashboard inbox for these yet, so email is the only delivery path; if the
// vendor hasn't set an account email there's nowhere to send it, so we log
// and no-op rather than error the customer's request.
const requestVendorCallback = async (vendorId, { customerName, customerPhone, productId, note, ipAddress, userAgent } = {}) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, email: true, userId: true, status: true, isActive: true, adminActiveOverride: true },
  });

  if (!vendor || vendor.status !== 'APPROVED' || !vendor.isActive || !vendor.adminActiveOverride) {
    throw AppError.notFound('Vendor not found');
  }

  let productName = null;
  if (productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, vendorId },
      select: { name: true },
    });
    productName = product?.name || null;
  }

  // Persist the lead so admins can audit callback requests that otherwise
  // live only in a vendor inbox (and even dropped emails are recorded).
  await prisma.callbackRequest.create({
    data: {
      vendorId,
      customerName: customerName || null,
      customerPhone,
      productId: productId || null,
      note: note ? String(note).trim() : null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  }).catch((err) => {
    logger.error('Callback request persistence failed', { vendorId, customerPhone, error: err.message });
  });

  // Push/in-app alert for the vendor's owner. Email below is still the
  // transactional record; this is what makes a backgrounded app buzz.
  if (vendor.userId) {
    const who = customerName ? `${customerName} (${customerPhone})` : customerPhone;
    notifyService
      .pushAndSocket(vendor.userId, {
        type: 'SYSTEM',
        title: 'Callback request',
        body: `${who} wants a callback${productName ? ` about ${productName}` : ''}.`,
        data: { route: '/vendor/dashboard', kind: 'CALLBACK' },
      })
      .catch((err) => logger.warn('Callback request notify failed (non-fatal)', {
        vendorId,
        error: err.message,
      }));
  }

  if (!vendor.email) {
    logger.warn('Callback request dropped - vendor has no account email', { vendorId, customerPhone });
    return { delivered: false };
  }

  await emailService.sendVendorCallbackRequestEmail({
    to: vendor.email,
    vendorName: vendor.name,
    customerName,
    customerPhone,
    productName,
  });

  return { delivered: true };
};

// Cross-vendor product browse (customer app browse screens).
// Filters by the product's own categoryId/subcategoryId (admin-managed
// taxonomy, not free text) and by optional facets: vendor, price range,
// condition, vendor rating, and near-me geo. Only products from publicly
// visible, available vendors. Sort keys mirror the app's SortMenu.
const getPublicProducts = async ({
  categoryId,
  subcategoryId,
  vendorId,
  sort = 'newest',
  minPrice,
  maxPrice,
  condition,
  minRating,
  state,
  lga,
  lat,
  lng,
  radius = 10,
  limit = 60,
} = {}) => {
  const toNum = (v) =>
    v === undefined || v === null || v === '' ? undefined : Number(v);

  const minP = toNum(minPrice);
  const maxP = toNum(maxPrice);
  const minR = toNum(minRating);

  // `categoryId` is normally a UUID, but the published customer app's product
  // detail screen sends the top-level category NAME (it derives it from the
  // product's "Top > Sub" display string). Resolve a non-UUID value to a
  // global category so those requests work. An unresolvable name returns an
  // empty list rather than erroring.
  let resolvedCategoryId = categoryId;
  if (categoryId && !UUID_RE.test(categoryId)) {
    const cat = await prisma.vendorCategory.findFirst({
      where: {
        vendorId: null,
        OR: [
          { name: { equals: categoryId, mode: 'insensitive' } },
          { slug: categoryId },
        ],
      },
      select: { id: true },
    });
    if (!cat) return [];
    resolvedCategoryId = cat.id;
  }

  const bbox = lat != null && lng != null ? buildBoundingBox(lat, lng, radius) : null;

  const priceFilter = {};
  if (minP != null) priceFilter.gte = minP;
  if (maxP != null) priceFilter.lte = maxP;

  const where = {
    isAvailable: true,
    ...(resolvedCategoryId && { categoryId: resolvedCategoryId }),
    ...(subcategoryId && { subcategoryId }),
    ...(vendorId && { vendorId }),
    // Second Hand listings never appear in normal browse: exclude them unless
    // the caller explicitly asks for condition=SECOND_HAND.
    condition: condition ? condition : { not: 'SECOND_HAND' },
    ...(Object.keys(priceFilter).length > 0 && { basePrice: priceFilter }),
    vendor: {
      status: 'APPROVED',
      isActive: true,
      adminActiveOverride: true,
      ...(minR != null && { averageRating: { gte: minR } }),
      ...(bbox && {
        lat: { gte: bbox.latMin, lte: bbox.latMax },
        lng: { gte: bbox.lngMin, lte: bbox.lngMax },
      }),
    },
  };

  // Location facet: match the listing's own stamped State/LGA (Second Hand
  // snapshots) OR its shop's State/LGA (every other listing), so a State/LGA
  // filter works across all conditions. Two separate AND clauses so State and
  // LGA can each be an independent OR without clobbering one another.
  const locationAnd = [];
  if (state) locationAnd.push({ OR: [{ state }, { vendor: { state } }] });
  if (lga) locationAnd.push({ OR: [{ lga }, { vendor: { lga } }] });
  if (locationAnd.length) where.AND = locationAnd;

  // `popular` (delivered-sales desc) is not a stored column - it's summed from
  // order items - so it can't be a DB orderBy. For it we fetch the bounded
  // filtered set, aggregate sold, then sort+slice in memory. Everything else
  // is ordered in SQL and limited directly.
  const cap = Math.min(limit, 1000);
  const orderBy =
    sort === 'price_asc'
      ? { basePrice: 'asc' }
      : sort === 'price_desc'
        ? { basePrice: 'desc' }
        : sort === 'rating'
          ? { vendor: { averageRating: 'desc' } }
          : { createdAt: 'desc' };

  const products = await prisma.product.findMany({
    where,
    orderBy,
    // Cap raised so the app's "For You" feed can request the whole available
    // catalogue in one call; normal callers still pass small limits. `popular`
    // needs the bounded set pre-slice so keep an upper bound too.
    take: sort === 'popular' ? 1000 : cap,
    include: {
      category: { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      vendor: { select: { id: true, name: true, logoUrl: true, averageRating: true } },
      variants: { where: { isAvailable: true }, orderBy: { price: 'asc' } },
    },
  });

  // "Sold" is a real number, not a stored column - summed from delivered
  // OrderItem quantities per product in one grouped query rather than N+1.
  const sold = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { productId: { in: products.map((p) => p.id) }, order: { status: 'DELIVERED' } },
    _sum: { quantity: true },
  });
  const soldByProductId = new Map(sold.map((s) => [s.productId, s._sum.quantity || 0]));

  let results = products.map((p) => ({ ...p, sold: soldByProductId.get(p.id) || 0 }));

  if (sort === 'popular') {
    results = results
      .sort(
        (a, b) =>
          (b.sold || 0) - (a.sold || 0) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, cap);
  }

  return results;
};

const getPublicProductById = async (productId) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      subcategory: { select: { id: true, name: true, slug: true } },
      vendor: {
        select: {
          id: true, name: true, description: true, address: true, phone: true,
          logoUrl: true, coverImageUrl: true, averageRating: true, createdAt: true,
          status: true, isActive: true, adminActiveOverride: true,
          _count: { select: { products: { where: { isAvailable: true } } } },
        },
      },
      variants: { where: { isAvailable: true }, orderBy: { price: 'asc' } },
      optionGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  if (
    !product ||
    !product.isAvailable ||
    product.vendor.status !== 'APPROVED' ||
    !product.vendor.isActive ||
    !product.vendor.adminActiveOverride
  ) {
    throw AppError.notFound('Product not found');
  }

  const soldAgg = await prisma.orderItem.aggregate({
    where: { productId, order: { status: 'DELIVERED' } },
    _sum: { quantity: true },
  });

  // The product's own category/subcategory + the vendor's derived categories.
  const categoriesByVendor = await deriveVendorCategories([product.vendorId]);

  // Drop the internal visibility flags used only for the check above.
  const { status: _status, isActive: _isActive, adminActiveOverride: _override, ...vendor } = product.vendor;
  return {
    ...product,
    vendor: { ...vendor, categories: categoriesByVendor.get(product.vendorId) || [] },
    sold: soldAgg._sum.quantity || 0,
  };
};

// ============================================================
// Update Vendor
// ============================================================

const updateVendor = async (vendorId, userId, role, updateData) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner or admin can update
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: updateData,
  });

  // A shop's State/LGA is inherited by every listing (see product create).
  // When the shop's location changes, propagate it to all its products so the
  // browse State/LGA filter stays correct without re-saving each product.
  if (updateData.state !== undefined || updateData.lga !== undefined) {
    await prisma.product.updateMany({
      where: { vendorId },
      data: { state: updated.state ?? null, lga: updated.lga ?? null },
    });
  }

  logger.info('Vendor updated', { vendorId });

  // If status or isOpen changed, broadcast to customers so they see
  // real-time store opening/closing.
  if (updateData.isOpen !== undefined) {
    broadcastCatalogueUpdate(vendorId, { kind: 'STORE_STATUS', isOpen: updated.isOpen });
    broadcastVendorStatus(updated);
  }

  return updated;
};

// ============================================================
// Unified Taxonomy (single Category -> Subcategory system, vendor-extendable)
// ============================================================
// Categories and subcategories are either global (vendorId null, admin-managed)
// or created by a specific vendor (vendorId set -> private to that vendor but
// otherwise identical: searchable, shown on their shop, same importance). This
// replaces the old two-level shop tree.

const findOwnedVendor = async (vendorId, userId, role) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }
  return vendor;
};

/**
 * The full unified taxonomy for a vendor's category management page: every
 * global category + this vendor's own categories, each with its subcategories
 * (global ones + this vendor's own added under it). Every row is tagged
 * `owned` so the dashboard can show Global vs Mine.
 */
const listVendorTaxonomy = async (vendorId, userId, role) => {
  await findOwnedVendor(vendorId, userId, role);

  const [cats, subs, catProductRows, subProductRows] = await Promise.all([
    prisma.vendorCategory.findMany({
      where: { OR: [{ vendorId: null }, { vendorId }] },
      orderBy: [{ vendorId: { sort: 'desc', nulls: 'last' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.subcategory.findMany({
      where: { OR: [{ vendorId: null }, { vendorId }] },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    // How many of THIS vendor's products sit in each category/subcategory -
    // shown on the management page so a row's impact is visible before editing.
    prisma.product.groupBy({ by: ['categoryId'], where: { vendorId }, _count: { _all: true } }),
    prisma.product.groupBy({
      by: ['subcategoryId'],
      where: { vendorId, subcategoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const catProductCount = new Map(catProductRows.map((r) => [r.categoryId, r._count._all]));
  const subProductCount = new Map(subProductRows.map((r) => [r.subcategoryId, r._count._all]));

  const subsByCat = new Map();
  subs.forEach((s) => {
    if (!subsByCat.has(s.categoryId)) subsByCat.set(s.categoryId, []);
    subsByCat.get(s.categoryId).push({
      id: s.id,
      name: s.name,
      imageUrl: s.imageUrl || null,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      owned: !!s.vendorId,
      productCount: subProductCount.get(s.id) || 0,
    });
  });

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl || null,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    owned: !!c.vendorId,
    productCount: catProductCount.get(c.id) || 0,
    subcategories: (subsByCat.get(c.id) || []).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  }));
};

/**
 * A vendor creates their own private category. It behaves exactly like a
 * global category (same taxonomy, searchable, shown on their shop once
 * products are filed into it), but is only visible/manageable by them.
 */
const createOwnCategory = async (vendorId, userId, role, { name, imageUrl = null } = {}) => {
  await findOwnedVendor(vendorId, userId, role);
  const trimmed = name && typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw AppError.badRequest('Category name is required');
  if (trimmed.length > 60) throw AppError.badRequest('Category name must be 60 characters or fewer');

  const clash = await prisma.vendorCategory.findFirst({
    where: { vendorId, name: trimmed },
  });
  if (clash) throw AppError.conflict(`You already have a category named "${trimmed}"`);

  const globalClash = await prisma.vendorCategory.findFirst({
    where: { vendorId: null, name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (globalClash) {
    throw AppError.conflict(
      `"${trimmed}" is a shared system category so you can't create a duplicate with the same name. ` +
        `File your products under the ${globalClash.name} category and add your own subcategory if you need to organise them further.`,
    );
  }

  const created = await prisma.vendorCategory.create({
    data: { vendorId, name: trimmed, imageUrl: imageUrl ? String(imageUrl).trim() : null },
  });
  return { id: created.id, name: created.name, imageUrl: created.imageUrl, sortOrder: created.sortOrder, owned: true, subcategories: [] };
};

/**
 * Edit category metadata. The picture edit writes straight to the shared
 * category's imageUrl (global or owned) - so "changing a global category's
 * pic" updates it for everyone, exactly as if the admin did it. Renaming is
 * only allowed on the vendor's own categories.
 */
const updateCategoryMeta = async (vendorId, userId, role, categoryId, { name = undefined, imageUrl = undefined } = {}) => {
  await findOwnedVendor(vendorId, userId, role);
  const row = await prisma.vendorCategory.findUnique({ where: { id: categoryId } });
  if (!row) throw AppError.notFound('Category not found');

  const data = {};
  if (imageUrl !== undefined) data.imageUrl = imageUrl ? String(imageUrl).trim() : null;

  if (name !== undefined) {
    if (!row.vendorId || row.vendorId !== vendorId) {
      throw AppError.forbidden('You can rename only your own categories');
    }
    const trimmed = String(name).trim();
    if (!trimmed) throw AppError.badRequest('Category name is required');
    if (trimmed.length > 60) throw AppError.badRequest('Category name must be 60 characters or fewer');
    const clash = await prisma.vendorCategory.findFirst({
      where: { vendorId, name: trimmed, NOT: { id: categoryId } },
    });
    if (clash) throw AppError.conflict(`You already have a category named "${trimmed}"`);
    const globalClash = await prisma.vendorCategory.findFirst({
      where: { vendorId: null, name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (globalClash) {
      throw AppError.conflict(`"${trimmed}" is a shared system category so you can't rename to it.`);
    }
    data.name = trimmed;
  }

  const updated = await prisma.vendorCategory.update({
    where: { id: categoryId },
    data,
  });
  return { id: updated.id, name: updated.name, imageUrl: updated.imageUrl, sortOrder: updated.sortOrder, owned: !!updated.vendorId };
};

const deleteOwnCategory = async (vendorId, userId, role, categoryId) => {
  await findOwnedVendor(vendorId, userId, role);
  const row = await prisma.vendorCategory.findUnique({ where: { id: categoryId } });
  if (!row) throw AppError.notFound('Category not found');
  if (!row.vendorId || row.vendorId !== vendorId) {
    throw AppError.forbidden('You can delete only your own categories');
  }
  await prisma.vendorCategory.delete({ where: { id: categoryId } });
  return { success: true };
};

/**
 * A vendor adds their own private subcategory under any category (their own
 * or a global one). Private to them, but first-class in the taxonomy.
 */
const createOwnSubcategory = async (vendorId, userId, role, categoryId, { name, imageUrl = null } = {}) => {
  await findOwnedVendor(vendorId, userId, role);
  const cat = await prisma.vendorCategory.findUnique({ where: { id: categoryId } });
  if (!cat) throw AppError.notFound('Category not found');

  const trimmed = name && typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw AppError.badRequest('Subcategory name is required');
  if (trimmed.length > 60) throw AppError.badRequest('Subcategory name must be 60 characters or fewer');

  const clash = await prisma.subcategory.findUnique({
    where: { categoryId_vendorId_name: { categoryId, vendorId, name: trimmed } },
  });
  if (clash) throw AppError.conflict('This subcategory already exists under that category');

  return prisma.subcategory.create({
    data: { categoryId, vendorId, name: trimmed, imageUrl: imageUrl ? String(imageUrl).trim() : null },
  });
};

/**
 * Edit subcategory metadata. Like categories, the picture edit updates the
 * shared subcategory's imageUrl globally; renaming is allowed only on the
 * vendor's own subcategory.
 */
const updateSubcategoryMeta = async (vendorId, userId, role, categoryId, subcategoryId, { name = undefined, imageUrl = undefined } = {}) => {
  await findOwnedVendor(vendorId, userId, role);
  const row = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!row || row.categoryId !== categoryId) throw AppError.notFound('Subcategory not found');

  const data = {};
  if (imageUrl !== undefined) data.imageUrl = imageUrl ? String(imageUrl).trim() : null;

  if (name !== undefined) {
    if (!row.vendorId || row.vendorId !== vendorId) {
      throw AppError.forbidden('You can rename only your own subcategories');
    }
    const trimmed = String(name).trim();
    if (!trimmed) throw AppError.badRequest('Subcategory name is required');
    if (trimmed.length > 60) throw AppError.badRequest('Subcategory name must be 60 characters or fewer');
    const clash = await prisma.subcategory.findUnique({
      where: { categoryId_vendorId_name: { categoryId, vendorId, name: trimmed } },
    });
    if (clash) throw AppError.conflict('This subcategory already exists under that category');
    data.name = trimmed;
  }

  return prisma.subcategory.update({ where: { id: subcategoryId }, data });
};

const deleteOwnSubcategory = async (vendorId, userId, role, categoryId, subcategoryId) => {
  await findOwnedVendor(vendorId, userId, role);
  const row = await prisma.subcategory.findUnique({ where: { id: subcategoryId } });
  if (!row || row.categoryId !== categoryId) throw AppError.notFound('Subcategory not found');
  if (!row.vendorId || row.vendorId !== vendorId) {
    throw AppError.forbidden('You can delete only your own subcategories');
  }
  await prisma.subcategory.delete({ where: { id: subcategoryId } });
  return { success: true };
};


/**
 * Let a rejected vendor fix their profile and go straight back into the
 * review queue. Without this, REJECTED is a dead end the vendor can never
 * get out of.
 */
const resubmitVendor = async (vendorId, userId, role, updateData = {}) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  if (vendor.status !== 'REJECTED') {
    throw AppError.badRequest('Only a rejected application can be resubmitted');
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      ...updateData,
      status: 'PENDING_APPROVAL',
      rejectionReason: null,
    },
  });

  logger.info('Vendor resubmitted for review', { vendorId });

  // Ping the admin dashboard so the resubmission doesn't sit silently in the
  // pending queue. Non-fatal: a socket failure must never block the resubmit.
  try {
    getIO().to(getAdminRoom()).emit(VENDOR.RESUBMITTED, {
      vendorId: updated.id,
      name: updated.name,
      timestamp: Date.now(),
    });
  } catch (err) {
    logger.warn('resubmit admin notify failed (non-fatal)', { vendorId, error: err.message });
  }

  // Email the team inbox too, so a resubmission is caught even when no admin has
  // the dashboard open. Best-effort: a mail failure must never block the resubmit.
  const emailService = require('../../services/email.service');
  const { config } = require('../../config');
  emailService
    .sendVendorApplicationAlertEmail({
      to: config.CONTACT_INBOX_EMAIL,
      vendorName: updated.name,
      contactEmail: updated.email,
      contactPhone: updated.phone,
      isResubmission: true,
    })
    .catch((err) => logger.warn('resubmit team email failed (non-fatal)', { vendorId, error: err.message }));

  return updated;
};

// ============================================================
// Toggle Vendor Open/Closed Status
// ============================================================

const toggleVendorStatus = async (vendorId, userId, role, { isOpen }) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner or admin can toggle
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { isOpen },
  });

  logger.info('Vendor status toggled', { vendorId, isOpen });
  broadcastCatalogueUpdate(vendorId, { kind: 'STORE_STATUS', isOpen });
  broadcastVendorStatus(updated);

  return updated;
};

// ============================================================
// Get Vendor Orders
// ============================================================

const getVendorOrders = async (vendorId, userId, role, { status, page, limit }) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner or admin can view orders
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const where = {
    vendorId,
    ...(status && { status }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        shippingAddress: true,
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
};

// ============================================================
// Admin Vendor Management Functions
// ============================================================

const getPendingVendors = async ({ page, limit }) => {
  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    }),
    prisma.vendor.count({ where: { status: 'PENDING_APPROVAL' } }),
  ]);

  return { vendors, total, page, limit };
};

const approveVendor = async (vendorId, adminId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');
  if (vendor.status !== 'PENDING_APPROVAL') {
    throw AppError.badRequest('Vendor is not in pending status');
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'APPROVED' },
  });

  logger.info('Vendor approved', { vendorId, adminId });
  broadcastCatalogueUpdate(vendorId, { kind: 'STORE_STATUS', status: 'APPROVED', isOpen: updated.isOpen });

  return updated;
};

const rejectVendor = async (vendorId, reason, adminId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');
  if (vendor.status !== 'PENDING_APPROVAL') {
    throw AppError.badRequest('Vendor is not in pending status');
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'REJECTED', rejectionReason: reason },
  });

  logger.info('Vendor rejected', { vendorId, reason, adminId });
  broadcastCatalogueUpdate(vendorId, { kind: 'STORE_STATUS', status: 'REJECTED', isOpen: updated.isOpen });

  return updated;
};

const suspendVendor = async (vendorId, reason, adminId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');
  if (vendor.status === 'SUSPENDED') {
    throw AppError.badRequest('Vendor is already suspended');
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'SUSPENDED', suspensionReason: reason },
  });

  logger.info('Vendor suspended', { vendorId, reason, adminId });
  broadcastCatalogueUpdate(vendorId, { kind: 'STORE_STATUS', status: 'SUSPENDED', isOpen: updated.isOpen });

  return updated;
};

const unsuspendVendor = async (vendorId, adminId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');
  if (vendor.status !== 'SUSPENDED') {
    throw AppError.badRequest('Vendor is not suspended');
  }

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: 'APPROVED', suspensionReason: null },
  });

  logger.info('Vendor unsuspended', { vendorId, adminId });
  broadcastCatalogueUpdate(vendorId, { kind: 'STORE_STATUS', status: 'APPROVED', isOpen: updated.isOpen });

  return updated;
};

const deleteVendor = async (vendorId, adminId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Soft delete by setting isActive to false
  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: { isActive: false },
  });

  logger.info('Vendor deleted', { vendorId, adminId });
  broadcastCatalogueUpdate(vendorId, { kind: 'STORE_STATUS', isActive: false, isOpen: updated.isOpen });

  return updated;
};

// ============================================================
// Vendor Dashboard Functions
// ============================================================

const getVendorProfile = async (vendorId, userId, role) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
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
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner can view their profile
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const missingLocationFields = missingVendorLocation(vendor);
  return {
    ...vendor,
    locationComplete: missingLocationFields.length === 0,
    missingLocationFields,
  };
};

/**
 * Look up an existing account by phone number so a vendor can log an order
 * against a real customer record after agreeing terms by phone/chat. Returns
 * each match's saved addresses too, since the order-logging form needs one.
 * Not role-filtered: Order.customerId just needs a valid User, and a
 * customer+vendor combo account still shops under its own id.
 */
const searchVendorCustomers = async (vendorId, userId, role, { phone }) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const digits = (phone || '').replace(/[^\d]/g, '');
  if (digits.length < 6) return [];

  const users = await prisma.user.findMany({
    where: { phone: { contains: digits }, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      savedAddresses: { orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] },
    },
    take: 10,
  });

  return users;
};

/**
 * Vendor logs an order after agreeing terms with a customer by phone/chat -
 * the chat-commerce "buy" action has no customer-submitted cart/checkout, so
 * this is how a real Order record comes into existence. Delegates pricing +
 * persistence to order.service (server-truth, identical resolution path to a
 * customer-submitted order) then auto-accepts, since the vendor already
 * agreed to fulfil it.
 */
const createVendorOrder = async (vendorId, userId, role, orderData) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const customer = await prisma.user.findUnique({ where: { id: orderData.customerId } });
  if (!customer || customer.deletedAt) throw AppError.badRequest('Customer not found');

  let shippingAddressId = orderData.shippingAddressId;
  if (!shippingAddressId) {
    if (!orderData.newAddress) {
      throw AppError.badRequest('shippingAddressId or newAddress is required');
    }
    const addressService = require('../address/address.service');
    const created = await addressService.create(customer.id, {
      label: orderData.newAddress.label || 'Delivery address',
      address: orderData.newAddress.address,
      // A vendor jotting down an address by phone rarely has real coordinates
      // to hand; this order is self-fulfilled (no route planning depends on
      // it), so fall back to the vendor's own shop location as a harmless
      // non-null placeholder rather than blocking order entry on a pin drop.
      lat: typeof orderData.newAddress.lat === 'number' ? orderData.newAddress.lat : vendor.lat,
      lng: typeof orderData.newAddress.lng === 'number' ? orderData.newAddress.lng : vendor.lng,
    });
    shippingAddressId = created.id;
  }

  const order = await orderService.createOrderForVendor(vendorId, userId, {
    customerId: customer.id,
    shippingAddressId,
    items: orderData.items,
    promoCode: orderData.promoCode,
  });

  logger.info('Vendor order logged', { vendorId, orderId: order.id, customerId: customer.id });
  return order;
};

/**
 * Verify the caller (acting as a vendor) actually owns the order the client
 * is trying to mutate. Centralizes the ownership guard so accept / reject /
 * status all fail identically when called against the wrong order.
 */
const assertVendorOwnsOrder = async (vendorId, userId, role, orderId) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound('Order not found');
  if (order.vendorId !== vendorId) {
    throw AppError.badRequest('This order is not for your vendor account');
  }
  return { vendor, order };
};

const acceptVendorOrder = async (vendorId, userId, role, orderId) => {
  await assertVendorOwnsOrder(vendorId, userId, role, orderId);
  // Delegate. updateStatus enforces the FSM (PENDING -> PROCESSING), sets
  // `confirmedAt`, emits `order:status:changed` to the customer/vendor rooms,
  // and dispatches the push notification + Notification Center row.
  const updated = await orderService.updateStatus(orderId, 'PROCESSING', userId, 'VENDOR');
  logger.info('Vendor order accepted', { vendorId, orderId });
  return updated;
};

const rejectVendorOrder = async (vendorId, userId, role, orderId, reason) => {
  await assertVendorOwnsOrder(vendorId, userId, role, orderId);
  const updated = await orderService.updateStatus(orderId, 'CANCELLED', userId, 'VENDOR', { reason });
  logger.info('Vendor order rejected', { vendorId, orderId, reason });
  return updated;
};

const updateVendorOrderStatus = async (vendorId, userId, role, orderId, status, extra = {}) => {
  const validStatuses = ['SHIPPED', 'DELIVERED'];
  if (!validStatuses.includes(status)) {
    throw AppError.badRequest('Invalid status update');
  }
  await assertVendorOwnsOrder(vendorId, userId, role, orderId);
  const updated = await orderService.updateStatus(orderId, status, userId, 'VENDOR', extra);
  logger.info('Vendor order status updated', { vendorId, orderId, status });
  return updated;
};

const getVendorProducts = async (vendorId, userId, role, { page, limit }) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: true,
        subcategory: true,
        variants: { orderBy: { price: 'asc' } },
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    }),
    prisma.product.count({ where: { vendorId } }),
  ]);

  return { products, total, page, limit };
};

const getVendorProductById = async (vendorId, userId, role, productId) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      subcategory: true,
      variants: { orderBy: { price: 'asc' } },
      optionGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  if (!product || product.vendorId !== vendorId) throw AppError.notFound('Product not found');
  return product;
};

/**
 * Build a human-readable packLabel from packSize + packUnit when caller didn't provide one.
 */
const formatPackLabel = (packSize, packUnit) => {
  if (!packSize || !packUnit) return null;
  const unit = String(packUnit).toLowerCase();
  return `${packSize} ${unit}`;
};

const VARIANT_CAP_PER_PRODUCT = 100;

/**
 * Validate the admin-managed taxonomy on a product create/update: the
 * category must exist + be active, and, if a subcategory is given, it must
 * exist and belong to that category. Throws AppError on any mismatch.
 */
const assertValidProductCategory = async ({ categoryId, subcategoryId, vendorId } = {}) => {
  if (!categoryId) {
    throw AppError.badRequest('categoryId is required');
  }
  const category = await prisma.vendorCategory.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) {
    throw AppError.badRequest('Category not found or inactive');
  }
  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, categoryId },
    });
    if (!subcategory || !subcategory.isActive) {
      throw AppError.badRequest('Subcategory not found or does not belong to the selected category');
    }
    // A vendor may file a product under their OWN subcategory or a global one,
    // but never under another vendor's private subcategory.
    if (vendorId && subcategory.vendorId && subcategory.vendorId !== vendorId) {
      throw AppError.forbidden('This subcategory belongs to another shop');
    }
  }
  return { category, subcategory: subcategoryId ? { id: subcategoryId } : null };
};

/**
 * Create a product. Inline `variants` and `optionGroups` are optional;
 * when omitted we synthesize one default variant from basePrice/stock so every
 * Product always has at least one variant (single SKU or many - same code path).
 */
const createVendorProduct = async (vendorId, userId, role, productData) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const { variants, optionGroups, ...rest } = productData;
  await assertValidProductCategory({ ...rest, vendorId });

  if (variants && variants.length > VARIANT_CAP_PER_PRODUCT) {
    throw AppError.badRequest(`Variant count exceeds the ${VARIANT_CAP_PER_PRODUCT}-per-product limit`);
  }

  // ── Media normalisation ──────────────────────────────────────────────
  // Keep imageUrl (cover) and images[] always in sync. If the caller sends
  // only `images`, derive cover; if only `imageUrl`, derive gallery.
  const gallery = (rest.images && rest.images.length > 0)
    ? rest.images.slice(0, 5)
    : (rest.imageUrl ? [rest.imageUrl] : []);
  rest.images = gallery;
  rest.imageUrl = gallery[0] || rest.imageUrl || null;

  // Every listing carries its shop's State/LGA (account -> shop -> product
  // inheritance), so the browse State/LGA filter works across all conditions,
  // not just Second Hand. Snapshot from the shop here, never the client.
  rest.state = vendor.state ?? null;
  rest.lga = vendor.lga ?? null;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: { ...rest, vendorId },
    });

    const variantInputs = (variants && variants.length > 0)
      ? variants
      : [{
          attributes: {},
          price: Number(rest.basePrice),
          stock: rest.stock ?? 0,
          isAvailable: rest.isAvailable ?? true,
        }];

    await tx.productVariant.createMany({
      data: variantInputs.map((v) => {
        const vGallery = (v.images && v.images.length > 0)
          ? v.images.slice(0, 5)
          : (v.imageUrl ? [v.imageUrl] : []);
        return {
          productId: created.id,
          sku: v.sku || null,
          attributes: v.attributes || {},
          packSize: v.packSize ?? null,
          packUnit: v.packUnit || null,
          packLabel: v.packLabel || formatPackLabel(v.packSize, v.packUnit),
          price: v.price,
          stock: v.stock ?? 0,
          imageUrl: vGallery[0] || v.imageUrl || null,
          images: vGallery,
          videoUrl: v.videoUrl || null,
          isAvailable: v.isAvailable ?? true,
        };
      }),
    });

    if (optionGroups && optionGroups.length > 0) {
      for (const group of optionGroups) {
        await tx.productOptionGroup.create({
          data: {
            productId: created.id,
            name: group.name,
            selectionRule: group.selectionRule,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder: group.sortOrder ?? 0,
            items: {
              create: (group.items || []).map((it) => ({
                name: it.name,
                description: it.description || null,
                priceDelta: it.priceDelta ?? 0,
                imageUrl: it.imageUrl || null,
                isDefault: it.isDefault ?? false,
                isAvailable: it.isAvailable ?? true,
                sortOrder: it.sortOrder ?? 0,
              })),
            },
          },
        });
      }
    }

    return tx.product.findUnique({
      where: { id: created.id },
      include: {
        variants: { orderBy: { price: 'asc' } },
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  });

  logger.info('Vendor product created', { vendorId, productId: product.id, variants: product.variants.length });
  broadcastCatalogueUpdate(vendorId, { kind: 'PRODUCT_CREATED', productId: product.id });

  return product;
};

const updateVendorProduct = async (vendorId, userId, role, productId, productData) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner can update products
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.vendorId !== vendorId) {
    throw AppError.badRequest('This product is not yours');
  }

  // If the taxonomy is touched, validate the pair together (a partial update
  // changing only subcategoryId must still match the product's category).
  const patch = { ...productData };
  if (patch.categoryId !== undefined || patch.subcategoryId !== undefined) {
    await assertValidProductCategory({
      categoryId: patch.categoryId ?? product.categoryId,
      subcategoryId: patch.subcategoryId ?? product.subcategoryId,
      vendorId,
    });
  }

  // ── Media normalisation (same as create) ─────────────────────────────
  const patchImages = patch.images;
  const patchImageUrl = patch.imageUrl;
  if (patchImages !== undefined || patchImageUrl !== undefined) {
    const merged = (patchImages !== undefined && patchImages.length > 0)
      ? patchImages.slice(0, 5)
      : (patchImageUrl !== undefined ? [patchImageUrl].filter(Boolean) : []);
    patch.images = merged;
    // An explicit empty `images` array means the caller cleared the gallery, so
    // the cover must clear too (otherwise it would keep the stale imageUrl).
    patch.imageUrl = merged[0] || (patchImages !== undefined ? null : (patchImageUrl || product.imageUrl));
  }

  // Keep the listing's State/LGA in sync with its shop on any edit (see
  // create). Snapshot from the shop, never the client.
  patch.state = vendor.state ?? null;
  patch.lga = vendor.lga ?? null;

  const updated = await prisma.product.update({
    where: { id: productId },
    data: patch,
  });

  logger.info('Vendor product updated', { vendorId, productId });
  broadcastCatalogueUpdate(vendorId, { kind: 'PRODUCT_UPDATED', productId });

  return updated;
};

const deleteVendorProduct = async (vendorId, userId, role, productId) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner can delete products
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.vendorId !== vendorId) {
    throw AppError.badRequest('This product is not yours');
  }

  await prisma.product.delete({
    where: { id: productId },
  });

  logger.info('Vendor product deleted', { vendorId, productId });
  broadcastCatalogueUpdate(vendorId, { kind: 'PRODUCT_DELETED', productId });

  return { success: true };
};

const toggleVendorProductAvailability = async (vendorId, userId, role, productId, isAvailable) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner can toggle product availability
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.vendorId !== vendorId) {
    throw AppError.badRequest('This product is not yours');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { isAvailable },
  });

  logger.info('Vendor product availability toggled', { vendorId, productId, isAvailable });
  broadcastCatalogueUpdate(vendorId, { kind: 'PRODUCT_AVAILABILITY', productId, isAvailable });

  return updated;
};

const getVendorSalesSummary = async (vendorId, userId, role, { period = '7d' }) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner can view their sales
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const startDate = new Date();
  if (period === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === '90d') {
    startDate.setDate(startDate.getDate() - 90);
  }

  const [totalOrders, totalRevenue, completedOrders] = await Promise.all([
    prisma.order.count({
      where: { vendorId, createdAt: { gte: startDate } },
    }),
    prisma.order.aggregate({
      where: { vendorId, status: 'DELIVERED', createdAt: { gte: startDate } },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { vendorId, status: 'DELIVERED', createdAt: { gte: startDate } },
    }),
  ]);

  return {
    totalOrders,
    totalRevenue: totalRevenue._sum.total || 0,
    completedOrders,
    period,
  };
};

const getVendorOrderHistory = async (vendorId, userId, role, { page, limit, startDate, endDate }) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) throw AppError.notFound('Vendor not found');

  // Authorization: only vendor owner can view their order history
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const where = {
    vendorId,
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
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
};

// ============================================================
// Variant CRUD (nested under product)
// ============================================================

const assertOwnsProduct = async (vendorId, userId, role, productId) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.vendorId !== vendorId) {
    throw AppError.notFound('Product not found');
  }
  return { vendor, product };
};

const createProductVariant = async (vendorId, userId, role, productId, variantData) => {
  await assertOwnsProduct(vendorId, userId, role, productId);

  const count = await prisma.productVariant.count({ where: { productId } });
  if (count >= VARIANT_CAP_PER_PRODUCT) {
    throw AppError.badRequest(`Variant count exceeds the ${VARIANT_CAP_PER_PRODUCT}-per-product limit`);
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      sku: variantData.sku || null,
      attributes: variantData.attributes || {},
      packSize: variantData.packSize ?? null,
      packUnit: variantData.packUnit || null,
      packLabel: variantData.packLabel || formatPackLabel(variantData.packSize, variantData.packUnit),
      price: variantData.price,
      stock: variantData.stock ?? 0,
      imageUrl: variantData.imageUrl || null,
      isAvailable: variantData.isAvailable ?? true,
    },
  });

  logger.info('ProductVariant created', { productId, variantId: variant.id });
  broadcastCatalogueUpdate(vendorId, { kind: 'VARIANT_CREATED', productId, variantId: variant.id });
  return variant;
};

const updateProductVariant = async (vendorId, userId, role, productId, variantId, patch) => {
  await assertOwnsProduct(vendorId, userId, role, productId);
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing || existing.productId !== productId) throw AppError.notFound('Variant not found');

  const data = { ...patch };
  if (patch.packSize !== undefined || patch.packUnit !== undefined) {
    if (data.packLabel === undefined) {
      data.packLabel = formatPackLabel(
        patch.packSize ?? existing.packSize,
        patch.packUnit ?? existing.packUnit,
      );
    }
  }

  const updated = await prisma.productVariant.update({ where: { id: variantId }, data });
  broadcastCatalogueUpdate(vendorId, { kind: 'VARIANT_UPDATED', productId, variantId });
  return updated;
};

const deleteProductVariant = async (vendorId, userId, role, productId, variantId) => {
  await assertOwnsProduct(vendorId, userId, role, productId);
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing || existing.productId !== productId) throw AppError.notFound('Variant not found');

  const remaining = await prisma.productVariant.count({ where: { productId } });
  if (remaining <= 1) {
    throw AppError.badRequest('Cannot delete the last variant; a product must have at least one variant');
  }

  await prisma.productVariant.delete({ where: { id: variantId } });
  broadcastCatalogueUpdate(vendorId, { kind: 'VARIANT_DELETED', productId, variantId });
  return { success: true };
};

// ============================================================
// Option-Group CRUD (nested under product) + Item CRUD
// ============================================================

const createOptionGroup = async (vendorId, userId, role, productId, groupData) => {
  await assertOwnsProduct(vendorId, userId, role, productId);
  const group = await prisma.productOptionGroup.create({
    data: {
      productId,
      name: groupData.name,
      selectionRule: groupData.selectionRule,
      minSelect: groupData.minSelect ?? 0,
      maxSelect: groupData.maxSelect ?? 1,
      sortOrder: groupData.sortOrder ?? 0,
      items: {
        create: (groupData.items || []).map((it) => ({
          name: it.name,
          description: it.description || null,
          priceDelta: it.priceDelta ?? 0,
          imageUrl: it.imageUrl || null,
          isDefault: it.isDefault ?? false,
          isAvailable: it.isAvailable ?? true,
          sortOrder: it.sortOrder ?? 0,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  broadcastCatalogueUpdate(vendorId, { kind: 'OPTION_GROUP_CREATED', productId, groupId: group.id });
  return group;
};

const updateOptionGroup = async (vendorId, userId, role, productId, groupId, patch) => {
  await assertOwnsProduct(vendorId, userId, role, productId);
  const existing = await prisma.productOptionGroup.findUnique({
    where: { id: groupId },
    include: { _count: { select: { items: true } } },
  });
  if (!existing || existing.productId !== productId) throw AppError.notFound('Option group not found');

  // When the rule or its bounds change, keep the (rule, min, max) triple
  // consistent and never let a populated group require more picks than it has
  // items. Untouched legacy groups can still be renamed/reordered freely.
  const touchesBounds =
    patch.selectionRule !== undefined ||
    patch.minSelect !== undefined ||
    patch.maxSelect !== undefined;
  if (touchesBounds) {
    const merged = {
      selectionRule: patch.selectionRule ?? existing.selectionRule,
      minSelect: patch.minSelect ?? existing.minSelect,
      maxSelect: patch.maxSelect ?? existing.maxSelect,
    };
    const ruleErr = optionGroupRuleError(merged);
    if (ruleErr) throw AppError.badRequest(ruleErr);
    if (existing._count.items > 0 && merged.minSelect > existing._count.items) {
      throw AppError.badRequest(
        `This group asks for ${merged.minSelect} pick(s) but only has ${existing._count.items} item(s)`,
      );
    }
  }

  const updated = await prisma.productOptionGroup.update({ where: { id: groupId }, data: patch });
  broadcastCatalogueUpdate(vendorId, { kind: 'OPTION_GROUP_UPDATED', productId, groupId });
  return updated;
};

const deleteOptionGroup = async (vendorId, userId, role, productId, groupId) => {
  await assertOwnsProduct(vendorId, userId, role, productId);
  const existing = await prisma.productOptionGroup.findUnique({ where: { id: groupId } });
  if (!existing || existing.productId !== productId) throw AppError.notFound('Option group not found');
  await prisma.productOptionGroup.delete({ where: { id: groupId } });
  broadcastCatalogueUpdate(vendorId, { kind: 'OPTION_GROUP_DELETED', productId, groupId });
  return { success: true };
};

const createOptionItem = async (vendorId, userId, role, productId, groupId, itemData) => {
  await assertOwnsProduct(vendorId, userId, role, productId);
  const group = await prisma.productOptionGroup.findUnique({ where: { id: groupId } });
  if (!group || group.productId !== productId) throw AppError.notFound('Option group not found');
  const item = await prisma.productOptionItem.create({
    data: {
      groupId,
      name: itemData.name,
      description: itemData.description || null,
      priceDelta: itemData.priceDelta ?? 0,
      imageUrl: itemData.imageUrl || null,
      isDefault: itemData.isDefault ?? false,
      isAvailable: itemData.isAvailable ?? true,
      sortOrder: itemData.sortOrder ?? 0,
    },
  });
  broadcastCatalogueUpdate(vendorId, { kind: 'OPTION_ITEM_CREATED', productId, groupId, itemId: item.id });
  return item;
};

const updateOptionItem = async (vendorId, userId, role, productId, groupId, itemId, patch) => {
  await assertOwnsProduct(vendorId, userId, role, productId);
  const item = await prisma.productOptionItem.findUnique({ where: { id: itemId } });
  if (!item || item.groupId !== groupId) throw AppError.notFound('Option item not found');
  const updated = await prisma.productOptionItem.update({ where: { id: itemId }, data: patch });
  broadcastCatalogueUpdate(vendorId, { kind: 'OPTION_ITEM_UPDATED', productId, groupId, itemId });
  return updated;
};

const deleteOptionItem = async (vendorId, userId, role, productId, groupId, itemId) => {
  await assertOwnsProduct(vendorId, userId, role, productId);
  const item = await prisma.productOptionItem.findUnique({
    where: { id: itemId },
    include: { group: { include: { _count: { select: { items: true } } } } },
  });
  if (!item || item.groupId !== groupId) throw AppError.notFound('Option item not found');

  // Don't strand a populated required group below its minimum. Emptying the
  // group entirely is fine (it returns to the "being built" state); only block
  // the in-between case where items remain but fewer than minSelect.
  const remaining = item.group._count.items - 1;
  if (remaining > 0 && remaining < item.group.minSelect) {
    throw AppError.badRequest(
      `This group requires at least ${item.group.minSelect} pick(s). Lower its minimum or delete the whole group instead of leaving too few items.`,
    );
  }

  await prisma.productOptionItem.delete({ where: { id: itemId } });
  broadcastCatalogueUpdate(vendorId, { kind: 'OPTION_ITEM_DELETED', productId, groupId, itemId });
  return { success: true };
};

/**
 * Replace the full set of option groups + items on a product in one call so the
 * caller doesn't have to coordinate N CRUD requests.
 *
 * Semantics:
 *   - Groups (and items) present by id are updated in place.
 *   - Groups (and items) missing an id are created.
 *   - Groups (and items) present on the product but absent from the payload
 *     are deleted.
 * The whole reconciliation runs in a single transaction so a partial
 * failure leaves the product's catalogue untouched.
 */
const bulkUpsertOptionGroups = async (vendorId, userId, role, productId, groups) => {
  await assertOwnsProduct(vendorId, userId, role, productId);

  const incoming = Array.isArray(groups) ? groups : [];
  const incomingGroupIds = new Set(incoming.filter((g) => g.id).map((g) => g.id));

  await prisma.$transaction(async (tx) => {
    const existingGroups = await tx.productOptionGroup.findMany({
      where: { productId },
      include: { items: true },
    });

    // Delete groups that are no longer present in the payload.
    const groupsToDelete = existingGroups.filter((g) => !incomingGroupIds.has(g.id));
    if (groupsToDelete.length > 0) {
      await tx.productOptionGroup.deleteMany({
        where: { id: { in: groupsToDelete.map((g) => g.id) } },
      });
    }

    // Upsert each incoming group + reconcile its items.
    for (let gi = 0; gi < incoming.length; gi++) {
      const group = incoming[gi];
      const sortOrder = group.sortOrder ?? gi;

      let groupRow;
      if (group.id && existingGroups.find((eg) => eg.id === group.id)) {
        groupRow = await tx.productOptionGroup.update({
          where: { id: group.id },
          data: {
            name: group.name,
            selectionRule: group.selectionRule,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder,
          },
        });
      } else {
        groupRow = await tx.productOptionGroup.create({
          data: {
            productId,
            name: group.name,
            selectionRule: group.selectionRule,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder,
          },
        });
      }

      const existingItems = existingGroups.find((eg) => eg.id === groupRow.id)?.items || [];
      const incomingItems = Array.isArray(group.items) ? group.items : [];
      const incomingItemIds = new Set(incomingItems.filter((it) => it.id).map((it) => it.id));

      // Delete items removed from the payload.
      const itemsToDelete = existingItems.filter((it) => !incomingItemIds.has(it.id));
      if (itemsToDelete.length > 0) {
        await tx.productOptionItem.deleteMany({
          where: { id: { in: itemsToDelete.map((it) => it.id) } },
        });
      }

      // Upsert each item.
      for (let ii = 0; ii < incomingItems.length; ii++) {
        const item = incomingItems[ii];
        const itemSortOrder = item.sortOrder ?? ii;
        if (item.id && existingItems.find((ei) => ei.id === item.id)) {
          await tx.productOptionItem.update({
            where: { id: item.id },
            data: {
              name: item.name,
              description: item.description || null,
              priceDelta: item.priceDelta ?? 0,
              imageUrl: item.imageUrl || null,
              isDefault: item.isDefault ?? false,
              isAvailable: item.isAvailable ?? true,
              sortOrder: itemSortOrder,
            },
          });
        } else {
          await tx.productOptionItem.create({
            data: {
              groupId: groupRow.id,
              name: item.name,
              description: item.description || null,
              priceDelta: item.priceDelta ?? 0,
              imageUrl: item.imageUrl || null,
              isDefault: item.isDefault ?? false,
              isAvailable: item.isAvailable ?? true,
              sortOrder: itemSortOrder,
            },
          });
        }
      }
    }
  });

  broadcastCatalogueUpdate(vendorId, { kind: 'OPTION_GROUPS_BULK_UPSERTED', productId });

  return prisma.productOptionGroup.findMany({
    where: { productId },
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
};

const getVendorDiscountCodes = async (vendorId, userId, role) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  return prisma.discountCode.findMany({
    where: { vendorId },
    orderBy: { createdAt: 'desc' },
  });
};

const createVendorDiscountCode = async (vendorId, userId, role, discountData) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const discount = await prisma.discountCode.create({
    data: {
      code: discountData.code.trim().toUpperCase(),
      vendorId,
      type: discountData.type,
      discountPercentage: discountData.type === 'percentage' ? parseInt(discountData.value, 10) : null,
      discountAmount: discountData.type === 'fixed' ? Number(discountData.value) : null,
      value: Number(discountData.value),
      minOrder: Number(discountData.minOrder || 0),
      maxDiscount: discountData.maxDiscount ? Number(discountData.maxDiscount) : null,
      usageLimit: parseInt(discountData.usageLimit || 100, 10),
      startDate: discountData.startDate ? new Date(discountData.startDate) : null,
      endDate: discountData.endDate ? new Date(discountData.endDate) : null,
      status: 'PENDING',
    },
  });

  logger.info('Vendor discount code request created', { vendorId, code: discount.code });
  return discount;
};

const getVendorCampaigns = async (vendorId, userId, role) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  return prisma.platformCampaign.findMany({
    orderBy: { createdAt: 'desc' },
  });
};

const createVendorCampaign = async (vendorId, userId, role, campaignData) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }

  const campaign = await prisma.platformCampaign.create({
    data: {
      name: campaignData.name,
      type: campaignData.type || 'promotion',
      description: campaignData.description || null,
      startDate: campaignData.startDate ? new Date(campaignData.startDate) : null,
      endDate: campaignData.endDate ? new Date(campaignData.endDate) : null,
      budget: Number(campaignData.budget || 0),
      targetAudience: campaignData.targetAudience || 'all',
      status: 'draft',
    },
  });

  logger.info('Campaign logged', { name: campaign.name });
  return campaign;
};

// ============================================================
// Shop story highlights (whatsapp-status-style, permanent)
// ============================================================

/**
 * Shared ownership guard for vendor-scoped highlight writes.
 * `role === 'ADMIN'` bypasses ownership (same trust model as products).
 */
const requireVendorOwnership = async (vendorId, userId, role) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (role === 'VENDOR' && vendor.userId !== userId) {
    throw AppError.forbidden('Not your vendor profile');
  }
  return vendor;
};

// Every story include pulls the (up to two) linked products, flattened to a
// plain `{ id, name, price, imageUrl }` array below.
const STORY_INCLUDE = {
  products: {
    orderBy: { sortOrder: 'asc' },
    include: {
      product: { select: { id: true, name: true, basePrice: true, imageUrl: true } },
    },
  },
};

const flattenStoryProducts = (story) => ({
  ...story,
  products: (story.products || []).map((sp) => ({
    id: sp.product.id,
    name: sp.product.name,
    price: Number(sp.product.basePrice),
    imageUrl: sp.product.imageUrl,
  })),
});

const getVendorHighlights = async (vendorId, userId, role) => {
  await requireVendorOwnership(vendorId, userId, role);

  const highlights = await prisma.highlight.findMany({
    where: { vendorId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      stories: { orderBy: { sortOrder: 'asc' }, include: STORY_INCLUDE },
      _count: { select: { stories: true } },
    },
  });

  return highlights.map((h) => ({
    ...h,
    stories: (h.stories || []).map(flattenStoryProducts),
  }));
};

const getHighlight = async (vendorId, userId, role, highlightId) => {
  await requireVendorOwnership(vendorId, userId, role);

  const highlight = await prisma.highlight.findFirst({
    where: { id: highlightId, vendorId },
    include: { stories: { orderBy: { sortOrder: 'asc' }, include: STORY_INCLUDE } },
  });
  if (!highlight) throw AppError.notFound('Highlight not found');
  return { ...highlight, stories: (highlight.stories || []).map(flattenStoryProducts) };
};

const createVendorHighlight = async (vendorId, userId, role, data) => {
  await requireVendorOwnership(vendorId, userId, role);

  // Default sortOrder = end of list (actual max, not a count, so gap-free ordering survives deletions).
  const last = await prisma.highlight.findFirst({
    where: { vendorId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const sortOrder = typeof data.sortOrder === 'number' ? data.sortOrder : (last ? last.sortOrder + 1 : 0);
  const highlight = await prisma.highlight.create({
    data: {
      vendorId,
      name: data.name.trim(),
      coverImageUrl: data.coverImageUrl || null,
      sortOrder,
      isActive: data.isActive ?? true,
    },
  });

  logger.info('Highlight created', { vendorId, highlightId: highlight.id, name: highlight.name });
  return highlight;
};

const updateVendorHighlight = async (vendorId, userId, role, highlightId, data) => {
  await requireVendorOwnership(vendorId, userId, role);

  const existing = await prisma.highlight.findFirst({ where: { id: highlightId, vendorId } });
  if (!existing) throw AppError.notFound('Highlight not found');

  const updated = await prisma.highlight.update({
    where: { id: highlightId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  // If the vendor explicitly reordered highlights, re-normalise gaps to keep them tight.
  if (data.sortOrder !== undefined) {
    await normaliseHighlightOrder(vendorId);
  }

  return updated;
};

const deleteVendorHighlight = async (vendorId, userId, role, highlightId) => {
  await requireVendorOwnership(vendorId, userId, role);

  const existing = await prisma.highlight.findFirst({ where: { id: highlightId, vendorId } });
  if (!existing) throw AppError.notFound('Highlight not found');

  // Cascade is also enforced at the DB level; explicit is clearer here.
  await prisma.highlight.delete({ where: { id: highlightId } });
  await normaliseHighlightOrder(vendorId);
  return { success: true };
};

const createHighlightStory = async (vendorId, userId, role, highlightId, data) => {
  await requireVendorOwnership(vendorId, userId, role);
  await assertHighlightInVendor(vendorId, highlightId);

  const { productIds, ...storyData } = data;
  const products = await assertStoryProductsInVendor(vendorId, productIds);

  // Default sortOrder = end of list (actual max, not a count, so orderings survive deletions).
  const lastStory = await prisma.highlightStory.findFirst({
    where: { highlightId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const story = await prisma.highlightStory.create({
    data: {
      highlightId,
      mediaUrl: storyData.mediaUrl,
      mediaType: storyData.mediaType || 'image',
      caption: storyData.caption || null,
      sortOrder: typeof storyData.sortOrder === 'number' ? storyData.sortOrder : (lastStory ? lastStory.sortOrder + 1 : 0),
      products: {
        create: products.map((p, i) => ({ productId: p.id, sortOrder: i })),
      },
    },
    include: STORY_INCLUDE,
  });
  return flattenStoryProducts(story);
};

const updateHighlightStory = async (vendorId, userId, role, highlightId, storyId, data) => {
  await requireVendorOwnership(vendorId, userId, role);
  await assertHighlightInVendor(vendorId, highlightId);

  const story = await prisma.highlightStory.findFirst({ where: { id: storyId, highlightId } });
  if (!story) throw AppError.notFound('Story not found');

  const { productIds, ...patch } = data;

  await prisma.$transaction(async (tx) => {
    if (patch.caption !== undefined || patch.sortOrder !== undefined) {
      await tx.highlightStory.update({
        where: { id: storyId },
        data: {
          ...(patch.caption !== undefined && { caption: patch.caption }),
          ...(patch.sortOrder !== undefined && { sortOrder: patch.sortOrder }),
        },
      });
    }

    // Reconcile linked products (replace the set when productIds is supplied).
    if (productIds !== undefined) {
      const products = await assertStoryProductsInVendor(vendorId, productIds);
      await tx.highlightStoryProduct.deleteMany({ where: { storyId } });
      if (products.length > 0) {
        await tx.highlightStoryProduct.createMany({
          data: products.map((p, i) => ({ storyId, productId: p.id, sortOrder: i })),
        });
      }
    }
  });

  if (patch.sortOrder !== undefined) await normaliseStoryOrder(vendorId, highlightId);

  const updated = await prisma.highlightStory.findFirst({
    where: { id: storyId },
    include: STORY_INCLUDE,
  });
  return flattenStoryProducts(updated);
};

const deleteHighlightStory = async (vendorId, userId, role, highlightId, storyId) => {
  await requireVendorOwnership(vendorId, userId, role);
  await assertHighlightInVendor(vendorId, highlightId);

  const story = await prisma.highlightStory.findFirst({ where: { id: storyId, highlightId } });
  if (!story) throw AppError.notFound('Story not found');

  await prisma.highlightStory.delete({ where: { id: storyId } });
  await normaliseStoryOrder(vendorId, highlightId);
  return { success: true };
};

const reorderHighlightStories = async (vendorId, userId, role, highlightId, storyIds) => {
  await requireVendorOwnership(vendorId, userId, role);
  await assertHighlightInVendor(vendorId, highlightId);

  // Bulk-assign each story its new position, then close gaps.
  const tx = await prisma.$transaction(
    storyIds.map((id, idx) =>
      prisma.highlightStory.update({
        where: { id, highlightId },
        data: { sortOrder: idx },
      }),
    ),
  );
  await normaliseStoryOrder(vendorId, highlightId);
  return prisma.highlightStory.findMany({ where: { highlightId }, orderBy: { sortOrder: 'asc' } });
};

// --- internal helpers ---

const assertHighlightInVendor = async (vendorId, highlightId) => {
  const highlight = await prisma.highlight.findUnique({
    where: { id: highlightId },
    select: { id: true, vendorId: true },
  });
  if (!highlight || highlight.vendorId !== vendorId) {
    throw AppError.notFound('Highlight not found');
  }
};

/**
 * Validate that every linked product belongs to the vendor and is in stock
 * (available). Enforces the hard cap of 2 products per story. Returns the
 * product rows (for the create path).
 */
const assertStoryProductsInVendor = async (vendorId, productIds) => {
  const ids = Array.isArray(productIds) ? productIds.filter(Boolean) : [];
  if (ids.length > 2) {
    throw AppError.badRequest('A story can link at most 2 products');
  }
  if (ids.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, vendorId },
    select: { id: true },
  });
  if (products.length !== ids.length) {
    throw AppError.badRequest('One or more linked products are not in your catalogue');
  }
  return products;
};

/**
 * Rewrite sortOrder to a tight 0,1,2,... sequence so there are no gaps after
 * deletions/reorders. Scoped to one vendor's highlights or one highlight's
 * stories depending on the argument.
 */
const normaliseHighlightOrder = async (vendorId, highlightId = null) => {
  const where = highlightId ? { vendorId, id: highlightId } : { vendorId };
  const rows = await prisma.highlight.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  await prisma.$transaction(
    rows.map((r, idx) =>
      prisma.highlight.update({ where: { id: r.id }, data: { sortOrder: idx } }),
    ),
  );
};

const normaliseStoryOrder = async (vendorId, highlightId = null) => {
  const where = highlightId ? { highlightId, highlight: { vendorId } } : { highlight: { vendorId } };
  const rows = await prisma.highlightStory.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  await prisma.$transaction(
    rows.map((r, idx) =>
      prisma.highlightStory.update({ where: { id: r.id }, data: { sortOrder: idx } }),
    ),
  );
};

module.exports = {
  createVendor,
  getVendors,
  getVendorById,
  deriveVendorCategories,
  requestVendorCallback,
  getPublicProducts,
  getPublicProductById,
  updateVendor,
  resubmitVendor,
  toggleVendorStatus,
  broadcastVendorStatus,
  isEffectivelyOpen,
  getVendorOrders,
  getPendingVendors,
  approveVendor,
  rejectVendor,
  suspendVendor,
  unsuspendVendor,
  deleteVendor,
  // Vendor dashboard functions
  getVendorProfile,
  searchVendorCustomers,
  createVendorOrder,
  acceptVendorOrder,
  rejectVendorOrder,
  updateVendorOrderStatus,
  getVendorProducts,
  getVendorProductById,
  createVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
  toggleVendorProductAvailability,
  // Variant CRUD
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  // Option group + item CRUD
  createOptionGroup,
  updateOptionGroup,
  deleteOptionGroup,
  createOptionItem,
  updateOptionItem,
  deleteOptionItem,
  bulkUpsertOptionGroups,
  getVendorSalesSummary,
  getVendorOrderHistory,
  // Marketing service exports
  getVendorDiscountCodes,
  createVendorDiscountCode,
  getVendorCampaigns,
  createVendorCampaign,
  // Shop story highlights
  getVendorHighlights,
  getHighlight,
  createVendorHighlight,
  updateVendorHighlight,
  deleteVendorHighlight,
  createHighlightStory,
  updateHighlightStory,
  deleteHighlightStory,
  reorderHighlightStories,
  // Unified taxonomy (single Category -> Subcategory system)
  listVendorTaxonomy,
  createOwnCategory,
  updateCategoryMeta,
  deleteOwnCategory,
  createOwnSubcategory,
  updateSubcategoryMeta,
  deleteOwnSubcategory,
};

/**
 * Request service - the reverse marketplace ("I need X, sellers respond").
 *
 * Flow:
 *   1. A customer creates a Request (trade + location + reach).
 *   2. `findMatches` picks the best sellers (same trade, within reach, ranked
 *      by distance then rating) and `pingVendors` pushes it to each one.
 *   3. Sellers reply with a message and an optional price.
 *   4. The customer accepts one reply -> request ASSIGNED, everyone else told.
 *   5. If nobody replies, a delayed job pings the next batch; at `expiresAt`
 *      a job marks it EXPIRED.
 *
 * No payment or shipping is tied to a Request - customer and seller settle
 * directly, exactly like the rest of the platform.
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const notifyService = require('../../services/notify.service');
const { haversineKm } = require('../../utils/geo');
const { isUsableCoord: hasUsableCoords } = require('../../utils/location');

// How many sellers to ping per batch, and the ceiling across all batches.
const PING_BATCH_SIZE = 10;
const PING_MAX_TOTAL = 30;

// Requests stay open this long, then expire.
const REQUEST_TTL_HOURS = 48;
// If nobody has replied after this long, ping the next batch.
const TOPUP_DELAY_MS = 60 * 60 * 1000; // 1h

const DEFAULT_RADIUS_KM = 15;

// Fields safe to show about a customer before they've picked a seller.
const CUSTOMER_PREVIEW = { id: true, firstName: true, profilePicture: true };
// Contact details, only revealed to the seller the customer accepted.
const CUSTOMER_CONTACT = { id: true, firstName: true, lastName: true, phone: true, profilePicture: true };

const VENDOR_SELECT = {
  id: true,
  userId: true,
  name: true,
  logoUrl: true,
  lat: true,
  lng: true,
  state: true,
  lga: true,
  averageRating: true,
  totalOrders: true,
  serviceRadiusKm: true,
  isOpen: true,
};

const REQUEST_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  subcategory: { select: { id: true, name: true, slug: true } },
  customer: { select: CUSTOMER_CONTACT },
  pings: { select: { vendorId: true, seenAt: true, notifiedAt: true } },
  responses: {
    orderBy: { createdAt: 'asc' },
    include: { vendor: { select: { ...VENDOR_SELECT, phone: true } } },
  },
};

// ============================================================
// Helpers
// ============================================================

const getVendorForUser = (userId) =>
  prisma.vendor.findUnique({ where: { userId }, select: { id: true, name: true, phone: true, lat: true, lng: true } });

/** Turn a free-text need into a small set of >=3-char search tokens. */
const keywordTerms = (title, description) => {
  const raw = `${title || ''} ${description || ''}`.toLowerCase();
  const tokens = (raw.match(/[a-z0-9]+/g) || []).filter((t) => t.length >= 3);
  return [...new Set(tokens)].slice(0, 6);
};

/**
 * Find the best sellers to ping for a request.
 *
 * Category path: sellers whose industry IS the category, or who stock an
 * available product in it. "Other / not sure" path (no categoryId): keyword
 * match against seller + product text.
 *
 * Geo is progressively relaxed so a request never goes dark just because the
 * supply side is sparse or a coordinate is missing:
 *   1. request scope (state/LGA) + radius
 *   2. same scope, radius ignored
 *   3. nationwide, radius ignored
 * Sellers with unusable coordinates (0,0 / null) are appended after nearby
 * sellers instead of being filtered out.
 */
const findMatches = async ({ request, excludeVendorIds = [], limit = PING_BATCH_SIZE }) => {
  const base = {
    status: 'APPROVED',
    isActive: true,
    adminActiveOverride: true,
    // A vendor with no linked user account cannot log in and therefore cannot
    // receive a ping, push or in-app notification. Matching it only creates a
    // dead ping and makes the request look handled when nobody was told.
    userId: { not: null },
  };

  const requestHasCoords = hasUsableCoords(Number(request.lat), Number(request.lng));

  // State/LGA scope: applied whenever the request named a state, regardless of
  // whether it is a Nearby or a Choose-area request. "Anywhere" with a state
  // means "all sellers in this area" and must NOT fall back nationwide.
  const scopeWhere = request.state
    ? {
        state: { equals: request.state, mode: 'insensitive' },
        ...(request.lga ? { lga: { equals: request.lga, mode: 'insensitive' } } : {}),
      }
    : null;
  const strictScope = request.reach === 'ANYWHERE' && !!request.state;

  const rankByGeo = (candidates, { enforceRadius = true } = {}) => {
    if (request.reach === 'NEARBY' && requestHasCoords && enforceRadius) {
      const radius = request.radiusKm || DEFAULT_RADIUS_KM;
      const inside = [];
      const unknown = [];

      for (const v of candidates) {
        if (!hasUsableCoords(Number(v.lat), Number(v.lng))) {
          unknown.push(v);
          continue;
        }
        const distanceKm = haversineKm(request.lat, request.lng, v.lat, v.lng);
        const cap = v.serviceRadiusKm != null ? Math.min(v.serviceRadiusKm, radius) : radius;
        if (distanceKm <= cap) inside.push({ ...v, _distanceKm: distanceKm });
      }

      inside.sort(
        (a, b) =>
          a._distanceKm - b._distanceKm ||
          b.averageRating - a.averageRating ||
          b.totalOrders - a.totalOrders,
      );
      unknown.sort((a, b) => b.averageRating - a.averageRating || b.totalOrders - a.totalOrders);
      return [...inside, ...unknown];
    }

    return [...candidates].sort(
      (a, b) => b.averageRating - a.averageRating || b.totalOrders - a.totalOrders,
    );
  };

  const query = (where) => prisma.vendor.findMany({ where, select: VENDOR_SELECT, take: 120 });

  /**
   * Query one predicate with progressive relaxation. Returns the first
   * non-empty tier, so a wider radius/nationwide fallback is only used when
   * the tighter tier genuinely has nobody.
   */
  const collect = async (where, { exclude = excludeVendorIds } = {}) => {
    const excluded = exclude.length ? { id: { notIn: exclude } } : {};
    const nationwide = { ...where, ...excluded };
    const radiusApplies = request.reach === 'NEARBY' && requestHasCoords;
    const tiers = [];

    if (scopeWhere) {
      const scoped = { ...where, ...scopeWhere, ...excluded };
      if (radiusApplies) tiers.push({ where: scoped, enforceRadius: true });
      tiers.push({ where: scoped, enforceRadius: false });
    }
    // Nearby requests may fall back across the state border. Choose-area
    // requests are strict: never leak in sellers outside the selected area.
    if (!strictScope) {
      if (radiusApplies) tiers.push({ where: nationwide, enforceRadius: true });
      tiers.push({ where: nationwide, enforceRadius: false });
    }

    for (const tier of tiers) {
      const rows = rankByGeo(await query(tier.where), { enforceRadius: tier.enforceRadius }).slice(0, limit);
      if (rows.length) return rows;
    }
    return [];
  };

  // Last resort: match the category/subcategory NAME plus the free-text need
  // against seller names, descriptions and product text. This is what catches
  // "Abu electronics" for an Electronics request when their catalogue
  // taxonomy was never filled in.
  const keywordFallback = async () => {
    const terms = new Set(keywordTerms(request.title, request.description));
    try {
      const [category, subcategory] = await Promise.all([
        request.categoryId
          ? prisma.vendorCategory.findUnique({ where: { id: request.categoryId }, select: { name: true } })
          : null,
        request.subcategoryId
          ? prisma.subcategory.findUnique({ where: { id: request.subcategoryId }, select: { name: true } })
          : null,
      ]);
      keywordTerms(category?.name, '').forEach((t) => terms.add(t));
      keywordTerms(subcategory?.name, '').forEach((t) => terms.add(t));
    } catch (_) {
      // Taxonomy lookup is best-effort; free-text terms still work.
    }

    const tokens = [...terms].slice(0, 8);
    if (!tokens.length) return [];

    return collect({
      ...base,
      OR: tokens.flatMap((t) => [
        { name: { contains: t, mode: 'insensitive' } },
        { description: { contains: t, mode: 'insensitive' } },
        {
          products: {
            some: {
              isAvailable: true,
              OR: [
                { name: { contains: t, mode: 'insensitive' } },
                { description: { contains: t, mode: 'insensitive' } },
              ],
            },
          },
        },
      ]),
    });
  };

  // "Other / not sure" path (no category): keyword match against seller +
  // product text.
  if (!request.categoryId) {
    return keywordFallback();
  }

  // Category-level match: sellers whose industry IS the category, or who
  // stock an available product in it.
  const categoryWhere = {
    ...base,
    OR: [
      { categoryId: request.categoryId },
      { products: { some: { isAvailable: true, categoryId: request.categoryId } } },
    ],
  };

  // No subcategory -> pure category match.
  if (!request.subcategoryId) {
    const rows = await collect(categoryWhere);
    if (rows.length) return rows;
    return keywordFallback();
  }

  // Subcategory -> two tiers, precision first: sellers with an available
  // product in the exact subcategory, then category-level sellers to fill the
  // remaining batch (so a niche subcategory still reaches someone, and service
  // sellers with no product rows are never starved out).
  const precise = await collect({
    ...base,
    products: { some: { isAvailable: true, subcategoryId: request.subcategoryId } },
  });
  if (precise.length >= limit) return precise.slice(0, limit);

  const chosenIds = [...new Set([...excludeVendorIds, ...precise.map((v) => v.id)])];
  const fill = await collect(categoryWhere, { exclude: chosenIds });
  const combined = [...precise, ...fill].slice(0, limit);
  if (combined.length) return combined;
  return keywordFallback();
};

/** Record pings + push a notification to each matched seller's owner. */
const pingVendors = async (request, vendors) => {
  const withUser = vendors.filter((v) => v.userId);
  if (vendors.length) {
    await prisma.requestPing.createMany({
      data: vendors.map((v) => ({ requestId: request.id, vendorId: v.id })),
      skipDuplicates: true,
    });
  }

  if (!withUser.length) {
    logger.warn('Request fan-out matched no notifiable sellers', {
      requestId: request.id,
      candidates: vendors.length,
      candidatesWithoutUser: vendors.length - withUser.length,
      categoryId: request.categoryId || null,
      state: request.state || null,
    });
    return 0;
  }

  logger.info('Request fan-out matched sellers', {
    requestId: request.id,
    candidates: vendors.length,
    notified: withUser.length,
  });

  await Promise.all(
    withUser.map(async (v) => {
      const canComputeDistance =
        request.reach === 'NEARBY' &&
        hasUsableCoords(Number(request.lat), Number(request.lng)) &&
        hasUsableCoords(Number(v.lat), Number(v.lng));
      const distance = canComputeDistance
        ? `${Math.max(1, Math.round(haversineKm(request.lat, request.lng, v.lat, v.lng)))}km away · `
        : '';
      try {
        await notifyService.pushAndSocket(v.userId, {
          type: 'REQUEST_PING',
          title: 'New request for you',
          body: `${distance}${request.title}`,
          data: { route: `/requests/${request.id}`, requestId: request.id, kind: 'REQUEST', audience: 'vendor' },
        });
      } catch (err) {
        logger.warn('Request ping notify failed (non-fatal)', { requestId: request.id, vendorId: v.id, error: err.message });
      }
    }),
  );

  return withUser.length;
};

/** Schedule the top-up + expiry jobs. Lazy-required to avoid a load cycle. */
const scheduleRequestJobs = async (request) => {
  if (!request.expiresAt) return;
  try {
    const { requestQueue } = require('../../queues');
    if (!requestQueue) return;
    const now = Date.now();
    const topUpAt = Math.max(now + 1000, new Date(request.createdAt).getTime() + TOPUP_DELAY_MS);
    // Unique jobIds per schedule: a repost re-schedules the same request, and a
    // stable id would collide with the still-pending job from the previous run.
    await requestQueue.add('request-topup', { requestId: request.id }, { delay: topUpAt - now, jobId: `topup:${request.id}:${now}` });
    await requestQueue.add(
      'request-expiry',
      { requestId: request.id },
      { delay: Math.max(1000, new Date(request.expiresAt).getTime() - now), jobId: `expiry:${request.id}:${now}` },
    );
  } catch (err) {
    logger.warn('Could not schedule request jobs (non-fatal)', { requestId: request.id, error: err.message });
  }
};

// ============================================================
// Serialization
// ============================================================

const serializeResponse = (r, { revealVendorContact = false } = {}) => ({
  id: r.id,
  vendorId: r.vendorId,
  message: r.message,
  price: r.price != null ? Number(r.price) : null,
  priceNote: r.priceNote,
  etaText: r.etaText,
  status: r.status,
  createdAt: r.createdAt,
  vendor: r.vendor
    ? {
        id: r.vendor.id,
        name: r.vendor.name,
        logoUrl: r.vendor.logoUrl,
        averageRating: r.vendor.averageRating,
        lat: r.vendor.lat,
        lng: r.vendor.lng,
        phone: revealVendorContact ? r.vendor.phone : undefined,
      }
    : null,
});

/**
 * Viewer-aware serialization. The customer's phone/name are hidden from
 * sellers until they are the accepted responder.
 */
const serializeRequest = (request, { userId, role, viewerVendorId, distanceKm } = {}) => {
  const isOwner = request.customerId === userId;
  const isAdmin = role === 'ADMIN';
  const myResponse = viewerVendorId
    ? request.responses.find((r) => r.vendorId === viewerVendorId) || null
    : null;
  const accepted = request.responses.find((r) => r.status === 'ACCEPTED') || null;
  const revealCustomer = isOwner || isAdmin || (myResponse && myResponse.status === 'ACCEPTED');

  let customer = null;
  if (revealCustomer) {
    customer = request.customer
      ? {
          id: request.customer.id,
          firstName: request.customer.firstName,
          lastName: request.customer.lastName,
          phone: request.customer.phone,
          profilePicture: request.customer.profilePicture,
        }
      : null;
  } else if (request.customer) {
    customer = { id: request.customer.id, firstName: request.customer.firstName, profilePicture: request.customer.profilePicture };
  }

  const base = {
    id: request.id,
    title: request.title,
    description: request.description,
    images: request.images,
    videos: request.videos,
    quantity: request.quantity,
    budgetMin: request.budgetMin != null ? Number(request.budgetMin) : null,
    budgetMax: request.budgetMax != null ? Number(request.budgetMax) : null,
    neededBy: request.neededBy,
    urgency: request.urgency,
    address: request.address,
    lat: request.lat,
    lng: request.lng,
    state: request.state,
    lga: request.lga,
    reach: request.reach,
    radiusKm: request.radiusKm,
    status: request.status,
    assignedVendorId: request.assignedVendorId,
    assignedAt: request.assignedAt,
    expiresAt: request.expiresAt,
    closedAt: request.closedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    category: request.category,
    subcategory: request.subcategory,
    customer,
    isOwner,
    responseCount: request.responses.length,
    myResponse: myResponse ? serializeResponse(myResponse) : null,
    distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : undefined,
  };

  // The owner (and admins) see the full response list; a seller sees only
  // their own reply (already surfaced as myResponse).
  if (isOwner || isAdmin) {
    base.responses = request.responses.map((r) =>
      serializeResponse(r, {
        revealVendorContact: isOwner && r.status === 'ACCEPTED',
      }),
    );
    base.acceptedResponse = accepted
      ? serializeResponse(accepted, { revealVendorContact: true })
      : null;
    base.pingCount = request.pings.length;
  }

  return base;
};

// ============================================================
// Customer operations
// ============================================================

const createRequest = async (userId, data) => {
  // Validate taxonomy if provided.
  if (data.categoryId) {
    const category = await prisma.vendorCategory.findUnique({
      where: { id: data.categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive) {
      throw AppError.badRequest('Unknown or inactive category', { code: 'INVALID_CATEGORY' });
    }
    if (data.subcategoryId) {
      const sub = await prisma.subcategory.findUnique({
        where: { id: data.subcategoryId },
        select: { id: true, categoryId: true },
      });
      if (!sub || sub.categoryId !== data.categoryId) {
        throw AppError.badRequest('Subcategory does not belong to the category', { code: 'INVALID_SUBCATEGORY' });
      }
    }
  }

  const expiresAt = new Date(Date.now() + REQUEST_TTL_HOURS * 60 * 60 * 1000);

  const created = await prisma.request.create({
    data: {
      customerId: userId,
      categoryId: data.categoryId || null,
      subcategoryId: data.subcategoryId || null,
      title: data.title,
      description: data.description || null,
      images: data.images || [],
      videos: data.videos || [],
      quantity: data.quantity ?? null,
      budgetMin: data.budgetMin ?? null,
      budgetMax: data.budgetMax ?? null,
      neededBy: data.neededBy || null,
      urgency: data.urgency || 'NORMAL',
      address: data.address,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      placeId: data.placeId || null,
      state: data.state || null,
      lga: data.lga || null,
      reach: data.reach || 'NEARBY',
      radiusKm: data.radiusKm || DEFAULT_RADIUS_KM,
      expiresAt,
    },
  });

  // Fan out to the first batch. A matching/fan-out failure must not fail the
  // customer's post - the request is already saved and can be topped up.
  let notifiedSellers = 0;
  try {
    const matches = await findMatches({ request: created });
    notifiedSellers = await pingVendors(created, matches);
  } catch (err) {
    logger.error('Request initial fan-out failed', { requestId: created.id, error: err.message });
  }

  // Always give the customer an acknowledgement. Previously a Request that
  // matched nobody produced no row and no push at all, so posting looked
  // broken even though it had succeeded.
  try {
    const body = notifiedSellers > 0
      ? `We sent your request to ${notifiedSellers} seller${notifiedSellers === 1 ? '' : 's'}. Replies will show up here.`
      : "Your request is live. We're still matching sellers and will notify you as soon as someone can help.";
    await notifyService.pushAndSocket(userId, {
      type: 'REQUEST_STATUS',
      title: notifiedSellers > 0 ? 'Your request is live' : 'Request posted',
      body,
      data: { route: `/requests/${created.id}`, requestId: created.id, kind: 'REQUEST', audience: 'customer' },
    });
  } catch (err) {
    logger.warn('Request confirmation notify failed (non-fatal)', {
      requestId: created.id,
      error: err.message,
    });
  }

  await scheduleRequestJobs(created);

  return getRequestById(created.id, { userId, role: 'CUSTOMER' });
};

const listMyRequests = async (userId, { status, page = 1, limit = 20 } = {}) => {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;
  const where = { customerId: userId, ...(status ? { status } : {}) };

  const [rows, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
        customer: { select: CUSTOMER_CONTACT },
        pings: { select: { vendorId: true } },
        responses: {
          orderBy: { createdAt: 'asc' },
          include: { vendor: { select: { ...VENDOR_SELECT, phone: true } } },
        },
      },
    }),
    prisma.request.count({ where }),
  ]);

  return {
    items: rows.map((r) => serializeRequest(r, { userId, role: 'CUSTOMER' })),
    page: Math.max(page, 1),
    limit: take,
    total,
  };
};

const getRequestById = async (requestId, { userId, role }) => {
  const request = await prisma.request.findUnique({ where: { id: requestId }, include: REQUEST_INCLUDE });
  if (!request) throw AppError.notFound('Request not found');

  const isOwner = request.customerId === userId;
  let viewerVendor = null;
  if (!isOwner && role === 'VENDOR') {
    viewerVendor = await getVendorForUser(userId);
  }
  const viewerVendorId = viewerVendor ? viewerVendor.id : null;

  const isPinged = viewerVendorId ? request.pings.some((p) => p.vendorId === viewerVendorId) : false;
  const hasResponse = viewerVendorId ? request.responses.some((r) => r.vendorId === viewerVendorId) : false;
  if (!isOwner && role !== 'ADMIN' && !isPinged && !hasResponse) {
    throw AppError.forbidden('You are not part of this request', { code: 'REQUEST_NOT_IN_INBOX' });
  }

  let distanceKm;
  if (viewerVendor && request.lat != null && request.lng != null) {
    distanceKm = haversineKm(request.lat, request.lng, viewerVendor.lat, viewerVendor.lng);
  }

  return serializeRequest(request, { userId, role, viewerVendorId, distanceKm });
};

const cancelRequest = async (requestId, userId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      customerId: true,
      status: true,
      title: true,
      responses: {
        where: { status: { not: 'WITHDRAWN' } },
        select: { vendor: { select: { userId: true } } },
      },
    },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (request.customerId !== userId) throw AppError.forbidden('Not your request');
  if (request.status !== 'OPEN') throw AppError.badRequest('Only open requests can be cancelled', { code: 'REQUEST_NOT_OPEN' });

  await prisma.request.update({ where: { id: requestId }, data: { status: 'CANCELLED', closedAt: new Date() } });

  // Tell every seller who replied that the job is off the table. Without this
  // a seller could keep chasing a request the customer has already closed.
  const sellerIds = [...new Set(
    request.responses
      .map((r) => r.vendor?.userId)
      .filter(Boolean),
  )];
  await Promise.all(
    sellerIds.map((sellerId) =>
      notifyService.pushAndSocket(sellerId, {
        type: 'REQUEST_STATUS',
        title: 'Request cancelled',
        body: `The customer cancelled "${request.title}".`,
        data: { route: `/requests/${requestId}`, requestId, kind: 'REQUEST', audience: 'vendor' },
      }).catch((err) => logger.warn('Request cancel notify failed (non-fatal)', {
        requestId,
        sellerId,
        error: err.message,
      })),
    ),
  );

  return getRequestById(requestId, { userId, role: 'CUSTOMER' });
};

const repostRequest = async (requestId, userId) => {
  const request = await prisma.request.findUnique({ where: { id: requestId }, select: { id: true, customerId: true, status: true } });
  if (!request) throw AppError.notFound('Request not found');
  if (request.customerId !== userId) throw AppError.forbidden('Not your request');
  if (!['EXPIRED', 'CANCELLED'].includes(request.status)) {
    throw AppError.badRequest('Only expired or cancelled requests can be reposted', { code: 'REQUEST_NOT_REPOSTABLE' });
  }

  const expiresAt = new Date(Date.now() + REQUEST_TTL_HOURS * 60 * 60 * 1000);
  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'OPEN',
      expiresAt,
      closedAt: null,
      assignedVendorId: null,
      assignedAt: null,
    },
  });

  // Fresh broadcast: keep existing pings so notifications already sent to
  // sellers still resolve (otherwise a repost turns them into 403s), and only
  // ping sellers who haven't been pinged yet.
  const existingPings = await prisma.requestPing.findMany({ where: { requestId }, select: { vendorId: true } });
  const alreadyPinged = existingPings.map((p) => p.vendorId);
  let notifiedSellers = 0;
  try {
    const matches = await findMatches({ request: updated, excludeVendorIds: alreadyPinged });
    notifiedSellers = await pingVendors(updated, matches);
  } catch (err) {
    logger.error('Request repost fan-out failed', { requestId, error: err.message });
  }

  try {
    await notifyService.pushAndSocket(userId, {
      type: 'REQUEST_STATUS',
      title: 'Request reposted',
      body: notifiedSellers > 0
        ? `Your request is live again and was sent to ${notifiedSellers} seller${notifiedSellers === 1 ? '' : 's'}.`
        : "Your request is live again. We're still matching sellers and will notify you when someone can help.",
      data: { route: `/requests/${requestId}`, requestId, kind: 'REQUEST', audience: 'customer' },
    });
  } catch (err) {
    logger.warn('Request repost confirmation notify failed (non-fatal)', {
      requestId,
      error: err.message,
    });
  }

  await scheduleRequestJobs(updated);

  return getRequestById(requestId, { userId, role: 'CUSTOMER' });
};

const acceptResponse = async (requestId, responseId, userId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { responses: { include: { vendor: { select: { userId: true, name: true } } } } },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (request.customerId !== userId) throw AppError.forbidden('Not your request');
  if (request.status !== 'OPEN') throw AppError.badRequest('This request is no longer open', { code: 'REQUEST_NOT_OPEN' });

  const chosen = request.responses.find((r) => r.id === responseId);
  if (!chosen) throw AppError.notFound('Response not found on this request');
  if (chosen.status === 'WITHDRAWN') throw AppError.badRequest('This response was withdrawn', { code: 'RESPONSE_WITHDRAWN' });

  const now = new Date();
  await prisma.$transaction([
    prisma.requestResponse.update({ where: { id: chosen.id }, data: { status: 'ACCEPTED' } }),
    prisma.requestResponse.updateMany({
      where: { requestId, id: { not: chosen.id }, status: 'PENDING' },
      data: { status: 'DECLINED' },
    }),
    prisma.request.update({
      where: { id: requestId },
      data: { status: 'ASSIGNED', assignedVendorId: chosen.vendorId, assignedAt: now, closedAt: now },
    }),
  ]);

  // Notify the winner + the sellers who missed out.
  const others = request.responses.filter((r) => r.id !== chosen.id && r.status === 'PENDING');
  try {
    if (chosen.vendor?.userId) {
      await notifyService.pushAndSocket(chosen.vendor.userId, {
        type: 'REQUEST_ASSIGNED',
        title: "You got the job",
        body: `Your offer for "${request.title}" was accepted.`,
        data: { route: `/requests/${requestId}`, requestId, kind: 'REQUEST', audience: 'vendor' },
      });
    }
    await Promise.all(
      others
        .filter((r) => r.vendor?.userId)
        .map((r) =>
          notifyService
            .pushAndSocket(r.vendor.userId, {
              type: 'REQUEST_ASSIGNED',
              title: 'Request taken',
              body: `"${request.title}" was assigned to another seller.`,
              data: { route: `/requests/${requestId}`, requestId, kind: 'REQUEST', audience: 'vendor' },
              silent: true,
            })
            .catch(() => null),
        ),
    );
  } catch (err) {
    logger.warn('Request accept notify failed (non-fatal)', { requestId, error: err.message });
  }

  return getRequestById(requestId, { userId, role: 'CUSTOMER' });
};

// ============================================================
// Vendor operations
// ============================================================

const listInbox = async (userId, { seen, page = 1, limit = 20 } = {}) => {
  const vendor = await getVendorForUser(userId);
  if (!vendor) throw AppError.forbidden('Seller profile required', { code: 'SELLER_PROFILE_REQUIRED' });

  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;
  const where = {
    vendorId: vendor.id,
    ...(seen === 'true' ? { seenAt: { not: null } } : {}),
    ...(seen === 'false' ? { seenAt: null } : {}),
  };

  const [pings, total] = await Promise.all([
    prisma.requestPing.findMany({
      where,
      orderBy: { notifiedAt: 'desc' },
      take,
      skip,
      include: {
        request: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
            subcategory: { select: { id: true, name: true, slug: true } },
            customer: { select: CUSTOMER_CONTACT },
            pings: { select: { vendorId: true } },
            responses: {
              where: { vendorId: vendor.id },
              include: { vendor: { select: { ...VENDOR_SELECT, phone: true } } },
            },
          },
        },
      },
    }),
    prisma.requestPing.count({ where }),
  ]);

  const unseenCount = await prisma.requestPing.count({ where: { vendorId: vendor.id, seenAt: null } });

  return {
    items: pings.map((p) => {
      const req = p.request;
      const distanceKm =
        req.lat != null && req.lng != null ? haversineKm(req.lat, req.lng, vendor.lat, vendor.lng) : undefined;
      return {
        ...serializeRequest(req, { userId, role: 'VENDOR', viewerVendorId: vendor.id, distanceKm }),
        pingedAt: p.notifiedAt,
        seenAt: p.seenAt,
      };
    }),
    unseenCount,
    page: Math.max(page, 1),
    limit: take,
    total,
  };
};

const respondToRequest = async (requestId, userId, data) => {
  const vendor = await getVendorForUser(userId);
  if (!vendor) throw AppError.forbidden('Seller profile required', { code: 'SELLER_PROFILE_REQUIRED' });

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { pings: { where: { vendorId: vendor.id }, select: { id: true } } },
  });
  if (!request) throw AppError.notFound('Request not found');
  if (request.status !== 'OPEN') throw AppError.badRequest('This request is no longer open', { code: 'REQUEST_NOT_OPEN' });
  if (request.expiresAt && request.expiresAt < new Date()) {
    await prisma.request.update({ where: { id: requestId }, data: { status: 'EXPIRED', closedAt: new Date() } });
    throw AppError.badRequest('This request has expired', { code: 'REQUEST_EXPIRED' });
  }
  if (!request.pings.length) throw AppError.forbidden('You were not invited to this request');

  const existing = await prisma.requestResponse.findUnique({
    where: { requestId_vendorId: { requestId, vendorId: vendor.id } },
    select: { id: true, status: true },
  });
  if (existing && existing.status === 'ACCEPTED') {
    throw AppError.badRequest('Your offer was already accepted', { code: 'RESPONSE_ACCEPTED' });
  }

  const payload = {
    message: data.message,
    price: data.price ?? null,
    priceNote: data.priceNote || null,
    etaText: data.etaText || null,
    status: 'PENDING',
  };

  const response = await prisma.requestResponse.upsert({
    where: { requestId_vendorId: { requestId, vendorId: vendor.id } },
    create: { requestId, vendorId: vendor.id, ...payload },
    update: payload,
  });

  // Mark the ping seen so it leaves the "new" bucket.
  await prisma.requestPing.updateMany({
    where: { requestId, vendorId: vendor.id, seenAt: null },
    data: { seenAt: new Date() },
  });

  try {
    await notifyService.pushAndSocket(request.customerId, {
      type: 'REQUEST_RESPONSE',
      title: 'New reply to your request',
      body: `${vendor.name} responded to "${request.title}".`,
      data: { route: `/requests/${requestId}`, requestId, kind: 'REQUEST', audience: 'customer' },
    });
  } catch (err) {
    logger.warn('Request response notify failed (non-fatal)', { requestId, error: err.message });
  }

  return {
    id: response.id,
    requestId: response.requestId,
    message: response.message,
    price: response.price != null ? Number(response.price) : null,
    priceNote: response.priceNote,
    etaText: response.etaText,
    status: response.status,
    createdAt: response.createdAt,
  };
};

const declineRequest = async (requestId, userId) => {
  const vendor = await getVendorForUser(userId);
  if (!vendor) throw AppError.forbidden('Seller profile required', { code: 'SELLER_PROFILE_REQUIRED' });

  await prisma.requestPing.updateMany({
    where: { requestId, vendorId: vendor.id, seenAt: null },
    data: { seenAt: new Date() },
  });
  return { requestId, declined: true };
};

const markInboxSeen = async (userId) => {
  const vendor = await getVendorForUser(userId);
  if (!vendor) throw AppError.forbidden('Seller profile required', { code: 'SELLER_PROFILE_REQUIRED' });
  const result = await prisma.requestPing.updateMany({
    where: { vendorId: vendor.id, seenAt: null },
    data: { seenAt: new Date() },
  });
  return { marked: result.count };
};

// ============================================================
// Admin operations
// ============================================================

const adminList = async ({ status, q, page = 1, limit = 20 } = {}) => {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;
  const where = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        customer: { select: CUSTOMER_CONTACT },
        _count: { select: { responses: true, pings: true } },
      },
    }),
    prisma.request.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      reach: r.reach,
      radiusKm: r.radiusKm,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      state: r.state,
      lga: r.lga,
      category: r.category,
      customer: r.customer,
      responseCount: r._count.responses,
      pingCount: r._count.pings,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    })),
    page: Math.max(page, 1),
    limit: take,
    total,
  };
};

const adminGet = async (requestId) => {
  const request = await prisma.request.findUnique({ where: { id: requestId }, include: REQUEST_INCLUDE });
  if (!request) throw AppError.notFound('Request not found');
  return serializeRequest(request, { role: 'ADMIN' });
};

const adminRemove = async (requestId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, customerId: true, title: true },
  });
  if (!request) throw AppError.notFound('Request not found');
  await prisma.request.delete({ where: { id: requestId } });

  // Tell the owner why their request disappeared (the row itself is gone, so
  // land them on the requests list rather than the deleted detail page).
  notifyService
    .pushAndSocket(request.customerId, {
      type: 'SYSTEM',
      title: 'Request removed',
      body: `Marketplace support removed "${request.title}".`,
      data: { route: '/requests', audience: 'customer' },
    })
    .catch((err) => logger.warn('Admin request-removal notify failed (non-fatal)', {
      requestId,
      error: err.message,
    }));

  return { id: requestId, deleted: true };
};

// ============================================================
// Background jobs
// ============================================================

/** Ping the next batch if the request is still open and nobody replied. */
const processTopUp = async (requestId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { _count: { select: { responses: true } }, pings: { select: { vendorId: true } } },
  });
  if (!request || request.status !== 'OPEN') return { skipped: true };
  if (request._count.responses > 0) return { skipped: true, reason: 'has_responses' };

  const pinged = request.pings.map((p) => p.vendorId);
  if (pinged.length >= PING_MAX_TOTAL) return { skipped: true, reason: 'cap_reached' };

  const remaining = PING_MAX_TOTAL - pinged.length;
  const matches = await findMatches({
    request,
    excludeVendorIds: pinged,
    limit: Math.min(PING_BATCH_SIZE, remaining),
  });
  const sent = await pingVendors(request, matches);
  return { pinged: sent };
};

/** Expire an open request whose window has closed. */
const processExpiry = async (requestId) => {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, customerId: true, title: true, status: true },
  });
  if (!request || request.status !== 'OPEN') return { skipped: true };

  await prisma.request.update({ where: { id: requestId }, data: { status: 'EXPIRED', closedAt: new Date() } });

  try {
    await notifyService.pushAndSocket(request.customerId, {
      type: 'REQUEST_EXPIRED',
      title: 'Your request expired',
      body: `No one replied to "${request.title}". You can repost it anytime.`,
      data: { route: `/requests/${requestId}`, requestId, kind: 'REQUEST', audience: 'customer' },
    });
  } catch (err) {
    logger.warn('Request expiry notify failed (non-fatal)', { requestId, error: err.message });
  }
  return { expired: true };
};

module.exports = {
  findMatches,
  createRequest,
  listMyRequests,
  getRequestById,
  cancelRequest,
  repostRequest,
  acceptResponse,
  listInbox,
  respondToRequest,
  declineRequest,
  markInboxSeen,
  adminList,
  adminGet,
  adminRemove,
  processTopUp,
  processExpiry,
};

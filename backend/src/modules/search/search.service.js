/**
 * Search & discovery service - hybrid full-text + trigram retrieval.
 *
 * Retrieval strategy (per entity):
 *   1. Full-text (tsvector @@ tsquery, 'simple' config) for token / word-order
 *      independent / multi-word matching. The last query token is prefix-matched
 *      (`:*`) so search-as-you-type works ("sho" -> "shoe").
 *   2. word_similarity() trigram fallback for typos and words buried inside long
 *      names ("shoe" inside "Men's Leather Derby Shoe").
 *   3. Surface widening: vendors also match on category name + tags; products
 *      also match on their VENDOR's name so cross-entity queries like
 *      "acme running shoes" resolve to Acme's "Running Shoes".
 *
 * Ranking blends ts_rank (token relevance, weighted x4) with word_similarity
 * (fuzzy closeness) so exact/near-exact matches lead and typos still surface.
 *
 *   /search   - the above, optional geo bbox + category/type filters.
 *   /nearby   - bounding-box-only vendor list (no text query).
 *
 * Visibility filter is the canonical `isActive=true AND adminActiveOverride=true`
 * that vendor.service.getVendors uses, so search is neither a superset nor a
 * subset of the listing.
 */

const { prisma } = require('../../config/database');
const { Prisma } = require('@prisma/client');
const { deriveVendorCategories } = require('../vendor/vendor.service');

const SEARCH_LIMIT = 25;
// word_similarity threshold for the fuzzy fallback. Lower than the classic
// similarity() 0.15 because word_similarity is asymmetric and already rewards
// the best-matching extent; 0.3 keeps typos in without flooding noise.
const WSIM_THRESHOLD = 0.3;
// ts_rank carries more signal than a fuzzy score, so weight it up when blending.
const FTS_WEIGHT = 4;

// Approximate degrees per km at Nigeria's latitude (~10°N). Good enough for
// a bounding-box filter; the lat/lng pair below corrects for both axes.
const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

const buildBoundingBox = (lat, lng, radiusKm) => {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / kmPerDegLng(lat);
  return {
    latMin: lat - dLat,
    latMax: lat + dLat,
    lngMin: lng - dLng,
    lngMax: lng + dLng,
  };
};

const toRad = (d) => (d * Math.PI) / 180;
const haversineKm = (la1, lo1, la2, lo2) => {
  const R = 6371;
  const dLat = toRad(la2 - la1);
  const dLng = toRad(lo2 - lo1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// Customer-facing visibility filter - must match what vendor.service.getVendors
// uses so search results aren't a superset/subset of the listing.
const VENDOR_VISIBLE_FILTER = {
  isActive: true,
  adminActiveOverride: true,
  status: 'APPROVED',
};

// A vendor belongs to a category when it has available products in it (a shop
// can sell across many categories - see vendor.service.deriveVendorCategories).
const VENDOR_IN_CATEGORY = (slug) => ({
  products: { some: { isAvailable: true, category: { is: { slug } } } },
});

/**
 * Build a prefix tsquery string from raw user input.
 *   "acme running shoes" -> "acme & running & shoes:*"
 * Tokens are reduced to alphanumerics (so user text can never inject tsquery
 * operators), ANDed together, and the final token is prefix-matched for
 * type-ahead. Returns '' when the input has no usable tokens; to_tsquery('') is
 * a valid empty query that simply matches nothing.
 */
const toPrefixTsQuery = (raw) => {
  const tokens = (raw.toLowerCase().match(/[a-z0-9]+/g) || []);
  if (tokens.length === 0) return '';
  return tokens
    .map((tok, i) => (i === tokens.length - 1 ? `${tok}:*` : tok))
    .join(' & ');
};

// Escape LIKE/ILIKE wildcards so a query like "50%" is matched literally.
const likeContains = (raw) => `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Attach straight-line distance (km) from the user to each vendor-bearing
 * result, when we have a user location. Mutates nothing; returns a new array.
 */
const withDistance = (rows, lat, lng, pickCoords) => {
  if (lat == null || lng == null) return rows;
  const ulat = Number(lat);
  const ulng = Number(lng);
  return rows.map((row) => {
    const c = pickCoords(row);
    if (c?.lat == null || c?.lng == null) return row;
    return { ...row, _distanceKm: haversineKm(ulat, ulng, c.lat, c.lng) };
  });
};

/**
 * Unified search across vendors and products.
 * Returns `{ results: [{ kind:'vendor'|'product', ... }], query, category }`.
 *
 * Optional facet params (mirroring GET /vendors/products) narrow the products
 * leg: minPrice/maxPrice, condition, minRating, and the existing lat/lng/radius
 * geo. `sort` reorders the product results after ranking; `relevance` (default)
 * keeps the blended score order.
 */
const search = async ({
  q,
  type,
  category,
  lat,
  lng,
  radius,
  minPrice,
  maxPrice,
  condition,
  minRating,
  sort = 'relevance',
}) => {
  const query = (q || '').trim();
  const cat = (category || '').trim() || null;
  const radiusKm = Number(radius) || 10;
  const hasGeo = lat != null && lng != null;

  const toNum = (v) =>
    v === undefined || v === null || v === '' ? undefined : Number(v);
  const minP = toNum(minPrice);
  const maxP = toNum(maxPrice);
  const minR = toNum(minRating);
  const cond = condition || null;

  const wantsVendors = !type || type === 'vendor';
  const wantsProducts = !type || type === 'product';

  // ── Vendors ────────────────────────────────────────────
  let vendors = [];
  if (wantsVendors) {
    if (query) {
      const tsq = toPrefixTsQuery(query);
      const like = likeContains(query);
      const bbox = hasGeo ? buildBoundingBox(Number(lat), Number(lng), radiusKm) : null;
      const bboxFragment = bbox
        ? Prisma.sql`AND v."lat" BETWEEN ${bbox.latMin} AND ${bbox.latMax} AND v."lng" BETWEEN ${bbox.lngMin} AND ${bbox.lngMax}`
        : Prisma.empty;
      // Push the category scope into the ranked query so the LIMIT is taken from
      // within-category matches, not filtered after the fact in hydration. A
      // lateral join gives each vendor a representative category row (name for
      // ranking, slug for scoping) from their available products.
      const catFragment = cat ? Prisma.sql`AND vc."slug" = ${cat}` : Prisma.empty;

      // Combined query-time vector (name + description + category name) so a
      // descriptive query like "Acme Footwear" matches a vendor named
      // "Acme" in the "Footwear" category.
      const rows = await prisma.$queryRaw(Prisma.sql`
        WITH q AS (SELECT to_tsquery('simple', ${tsq}) AS tsq)
        SELECT v.id,
          ts_rank(
            setweight(to_tsvector('simple', coalesce(v."name", '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(v."description", '')), 'B') ||
            setweight(to_tsvector('simple', coalesce(vc."name", '')), 'C'),
            q.tsq
          ) * ${FTS_WEIGHT} + word_similarity(${query}, v."name") AS score
        FROM "vendors" v
        LEFT JOIN LATERAL (
          SELECT pc."name", pc."slug"
          FROM "products" p2
          JOIN "vendor_categories" pc ON pc.id = p2."categoryId"
          WHERE p2."vendorId" = v.id AND p2."isAvailable" = true
          LIMIT 1
        ) vc ON true
        CROSS JOIN q
        WHERE v."isActive" = true
          AND v."adminActiveOverride" = true
          AND v."status" = 'APPROVED'
          AND (
            v."search_vector" @@ q.tsq
            OR to_tsvector('simple',
                 coalesce(v."name", '') || ' ' ||
                 coalesce(v."description", '') || ' ' ||
                 coalesce(vc."name", '')
               ) @@ q.tsq
            OR word_similarity(${query}, v."name") > ${WSIM_THRESHOLD}
            OR EXISTS (
              SELECT 1 FROM "vendor_tags" vt
              JOIN "tags" tg ON tg.id = vt."tagId"
              WHERE vt."vendorId" = v.id AND tg."name" ILIKE ${like}
            )
          )
          ${catFragment}
          ${bboxFragment}
        ORDER BY score DESC
        LIMIT ${SEARCH_LIMIT}
      `);

      const ids = rows.map((r) => r.id);
      const scoreById = new Map(rows.map((r) => [r.id, Number(r.score)]));
      if (ids.length > 0) {
        const hydrated = await prisma.vendor.findMany({
          where: {
            id: { in: ids },
            ...VENDOR_VISIBLE_FILTER,
            ...(cat && VENDOR_IN_CATEGORY(cat)),
          },
        });
        const categoriesByVendor = await deriveVendorCategories(ids);
        vendors = hydrated
          .map((v) => ({
            ...v,
            categories: categoriesByVendor.get(v.id) || [],
            _score: scoreById.get(v.id) ?? 0,
          }))
          .sort((a, b) => b._score - a._score);
      }
    } else {
      // No text query → straight findMany with bbox / category filters.
      const where = {
        ...VENDOR_VISIBLE_FILTER,
        ...(cat && VENDOR_IN_CATEGORY(cat)),
      };
      if (hasGeo) {
        const bbox = buildBoundingBox(Number(lat), Number(lng), radiusKm);
        where.lat = { gte: bbox.latMin, lte: bbox.latMax };
        where.lng = { gte: bbox.lngMin, lte: bbox.lngMax };
      }
      const found = await prisma.vendor.findMany({
        where,
        take: SEARCH_LIMIT,
        orderBy: [{ averageRating: 'desc' }, { totalOrders: 'desc' }],
      });
      const categoriesByVendor = await deriveVendorCategories(found.map((v) => v.id));
      vendors = found.map((v) => ({ ...v, categories: categoriesByVendor.get(v.id) || [] }));
    }
  }

  // ── Products ────────────────────────────────────────────
  let products = [];
  if (wantsProducts && query) {
    const tsq = toPrefixTsQuery(query);
    // Scope products to their own category (products carry the taxonomy now,
    // not the vendor), applied inside the ranked query (see vendor note above).
    const catFragment = cat ? Prisma.sql`AND vc."slug" = ${cat}` : Prisma.empty;

    // Facet fragments pushed into the ranked query so the LIMIT is taken from
    // within-facet matches (filtering after hydration would shrink the page
    // instead of refilling it). Price/condition live on the product; rating and
    // the geo box live on the vendor.
    const pBbox = hasGeo ? buildBoundingBox(Number(lat), Number(lng), radiusKm) : null;
    const priceInRange = {};
    if (minP != null) priceInRange.gte = minP;
    if (maxP != null) priceInRange.lte = maxP;

    const facetFragments = [
      minP != null ? Prisma.sql`AND p."basePrice" >= ${minP}` : Prisma.empty,
      maxP != null ? Prisma.sql`AND p."basePrice" <= ${maxP}` : Prisma.empty,
      cond ? Prisma.sql`AND p."condition"::text = ${cond}` : Prisma.empty,
      minR != null ? Prisma.sql`AND v."averageRating" >= ${minR}` : Prisma.empty,
      pBbox
        ? Prisma.sql`AND v."lat" BETWEEN ${pBbox.latMin} AND ${pBbox.latMax} AND v."lng" BETWEEN ${pBbox.lngMin} AND ${pBbox.lngMax}`
        : Prisma.empty,
    ];

    // Match products on their own vector OR on "<vendor name> <product name>"
    // so "acme running shoes" finds Acme's "Running Shoes". ts_rank blends the
    // product-vector relevance with the vendor-name relevance.
    const rows = await prisma.$queryRaw(Prisma.sql`
      WITH q AS (SELECT to_tsquery('simple', ${tsq}) AS tsq)
      SELECT p.id,
        (
          ts_rank(p."search_vector", q.tsq) +
          ts_rank(to_tsvector('simple', coalesce(v."name", '')), q.tsq)
        ) * ${FTS_WEIGHT} + word_similarity(${query}, p."name") AS score
      FROM "products" p
      JOIN "vendors" v ON v.id = p."vendorId"
      JOIN "vendor_categories" vc ON vc.id = p."categoryId"
      CROSS JOIN q
      WHERE p."isAvailable" = true
        AND v."isActive" = true
        AND v."adminActiveOverride" = true
        AND v."status" = 'APPROVED'
        AND (
          p."search_vector" @@ q.tsq
          OR to_tsvector('simple',
               coalesce(v."name", '') || ' ' || coalesce(p."name", '')
             ) @@ q.tsq
          OR word_similarity(${query}, p."name") > ${WSIM_THRESHOLD}
        )
        ${catFragment}
        ${Prisma.join(facetFragments, ' ')}
      ORDER BY score DESC
      LIMIT ${SEARCH_LIMIT}
    `);

    const ids = rows.map((r) => r.id);
    const scoreById = new Map(rows.map((r) => [r.id, Number(r.score)]));
    if (ids.length > 0) {
      const hydrated = await prisma.product.findMany({
        where: {
          id: { in: ids },
          isAvailable: true,
          ...(cat && { category: { slug: cat } }),
          ...(cond && { condition: cond }),
          ...(Object.keys(priceInRange).length > 0 && { basePrice: priceInRange }),
          vendor: {
            ...VENDOR_VISIBLE_FILTER,
            ...(minR != null && { averageRating: { gte: minR } }),
          },
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          variants: { orderBy: { price: 'asc' }, take: 1 },
          vendor: {
            select: {
              id: true, name: true, lat: true, lng: true,
              logoUrl: true, isOpen: true, averageRating: true,
            },
          },
        },
      });
      let withScores = hydrated.map((p) => ({ ...p, _score: scoreById.get(p.id) ?? 0 }));

      // Sort the (small, <=SEARCH_LIMIT) product page. `relevance` keeps the
      // blended ts_rank order; the rest mirror the browse screens.
      if (sort === 'price_asc') {
        withScores.sort((a, b) => Number(a.basePrice) - Number(b.basePrice));
      } else if (sort === 'price_desc') {
        withScores.sort((a, b) => Number(b.basePrice) - Number(a.basePrice));
      } else if (sort === 'rating') {
        withScores.sort((a, b) => (b.vendor?.averageRating || 0) - (a.vendor?.averageRating || 0));
      } else if (sort === 'newest') {
        withScores.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else {
        withScores.sort((a, b) => b._score - a._score);
      }
      products = withScores;
    }
  }

  // Attach distance for the UI (vendors by own coords, products by vendor's).
  vendors = withDistance(vendors, lat, lng, (v) => ({ lat: v.lat, lng: v.lng }));
  products = withDistance(products, lat, lng, (p) => ({ lat: p.vendor?.lat, lng: p.vendor?.lng }));

  return {
    results: [
      ...vendors.map((v) => ({ kind: 'vendor', ...v })),
      ...products.map((p) => ({ kind: 'product', ...p })),
    ],
    query,
    category: cat,
  };
};

/**
 * Geo-filtered vendor list. Bounding-box pre-filter then in-memory Haversine
 * sort (the bbox is coarse). PostGIS `ST_DWithin` substitution is a follow-up
 * when the dataset grows.
 */
const nearby = async ({ type, category, lat, lng, radius }) => {
  if (lat == null || lng == null) {
    return { vendors: [], note: 'lat and lng are required for nearby' };
  }
  const radiusKm = Number(radius) || 10;
  const bbox = buildBoundingBox(Number(lat), Number(lng), radiusKm);
  const cat = (category || '').trim() || null;

  const where = {
    ...VENDOR_VISIBLE_FILTER,
    lat: { gte: bbox.latMin, lte: bbox.latMax },
    lng: { gte: bbox.lngMin, lte: bbox.lngMax },
    ...(cat && VENDOR_IN_CATEGORY(cat)),
    ...(type && { type }),
  };

  let vendors = await prisma.vendor.findMany({
    where,
    take: SEARCH_LIMIT,
  });
  const categoriesByVendor = await deriveVendorCategories(vendors.map((v) => v.id));
  vendors = vendors.map((v) => ({ ...v, categories: categoriesByVendor.get(v.id) || [] }));

  vendors = vendors
    .map((v) => ({ ...v, _distanceKm: haversineKm(Number(lat), Number(lng), v.lat, v.lng) }))
    .filter((v) => v._distanceKm <= radiusKm)
    .sort((a, b) => a._distanceKm - b._distanceKm);

  return { vendors };
};

module.exports = { search, nearby };

/**
 * productFilters - the single source of truth for the product filter + sort
 * vocabulary used by every customer browse surface (category, subcategory,
 * marketplace, storefront, search).
 *
 * Filtering/sorting is server-side: buildProductQuery() maps the UI state to
 * query params accepted by GET /vendors/products and GET /search (see
 * backend/src/modules/vendor/vendor.validator.js -> publicProductsSchema, and
 * search.service.js). applyProductFilters() is the client-side equivalent,
 * used only where a screen already holds the full catalogue (embedded vendor
 * detail payloads).
 *
 * Sort keys MUST stay in sync with PUBLIC_PRODUCTS_SORTS on the backend.
 */
import { PRESET_RANGES, priceInRange } from "../components/product/PriceFilterBar";
import { matchesCondition } from "../components/product/ConditionFilterBar";

export { PRESET_RANGES, priceInRange, matchesCondition };

export const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "popular", label: "Popular" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
  { key: "rating", label: "Top rated" },
];

// Search adds a relevance default (the server's blended ts_rank order).
export const SEARCH_SORTS = [{ key: "relevance", label: "Best match" }, ...SORTS];

export const DEFAULT_SORT = "newest";

export const RATING_OPTIONS = [
  { value: 4, label: "4★ & up" },
  { value: 3, label: "3★ & up" },
];

export const RADIUS_OPTIONS = [1, 5, 15];

export const DEFAULT_FILTERS = {
  priceIndex: null,
  condition: null,
  minRating: null,
  state: null,
  lga: null,
  nearMe: false,
  radiusKm: 15,
};

export const sortLabel = (key, list = SORTS) =>
  (list.find((s) => s.key === key) || list[0] || {}).label || "Sort";

/** Number of facets currently narrowing the results (for the badge). */
export function countActiveFilters(f) {
  if (!f) return 0;
  let n = 0;
  if (f.priceIndex != null) n += 1;
  if (f.condition) n += 1;
  if (f.minRating != null) n += 1;
  if (f.state) n += 1;
  if (f.lga) n += 1;
  if (f.nearMe) n += 1;
  return n;
}

/** Map a PriceFilterBar index to server min/maxPrice params. */
export function priceParams(priceIndex) {
  if (priceIndex == null || !PRESET_RANGES[priceIndex]) return {};
  const { min, max } = PRESET_RANGES[priceIndex];
  return { minPrice: min, ...(max !== Infinity ? { maxPrice: max } : {}) };
}

/**
 * Build the query params for GET /vendors/products from a browse screen's
 * scope + filter state. Empty/absent facets are omitted so the backend applies
 * its own defaults.
 */
export function buildProductQuery({
  categoryId,
  subcategoryId,
  vendorId,
  condition,
  state,
  lga,
  filters,
  sort,
  location,
  limit,
} = {}) {
  const f = filters || {};
  const params = {};
  if (categoryId) params.categoryId = categoryId;
  if (subcategoryId) params.subcategoryId = subcategoryId;
  if (vendorId) params.vendorId = vendorId;
  // Marketplace scope (e.g. the Second Hand marketplace passes condition =
  // SECOND_HAND + the selected state/lga).
  if (condition) params.condition = condition;
  // Location facet: a screen-level scope (Second Hand marketplace) or the
  // user's filter-sheet choice; scope wins when both are set.
  const stateParam = state || f.state;
  const lgaParam = lga || f.lga;
  if (stateParam) params.state = stateParam;
  if (lgaParam) params.lga = lgaParam;
  if (sort) params.sort = sort;

  Object.assign(params, priceParams(f.priceIndex));
  // The buyer-facing condition filter only applies when the screen isn't
  // already condition-scoped (Second Hand marketplace).
  if (!condition && f.condition) params.condition = f.condition;
  if (f.minRating != null) params.minRating = f.minRating;

  // Near-me only applies when we actually have coordinates; otherwise the
  // backend would filter everything out.
  if (f.nearMe && location?.latitude != null && location?.longitude != null) {
    params.lat = location.latitude;
    params.lng = location.longitude;
    params.radius = f.radiusKm || 15;
  }

  if (limit) params.limit = limit;
  return params;
}

/** Stable cache key for a params object (sorted keys, so order never matters). */
export function buildBrowseKey(params) {
  return Object.keys(params || {})
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

/**
 * Client-side filter/sort over an already-loaded catalogue. Mirrors
 * buildProductQuery's semantics so a screen that holds the full list (e.g. the
 * embedded vendor detail payload) behaves the same as a server-filtered one.
 * `newest` is a no-op (input is already newest-first).
 */
export function applyProductFilters(list, { query, filters, sort } = {}) {
  const f = filters || {};
  let out = Array.isArray(list) ? [...list] : [];

  const q = (query || "").trim().toLowerCase();
  if (q) out = out.filter((p) => (p.title || "").toLowerCase().includes(q));
  if (f.priceIndex != null) out = out.filter((p) => priceInRange(p.price, f.priceIndex));
  if (f.condition) out = out.filter((p) => matchesCondition(p, f.condition));
  if (f.minRating != null) out = out.filter((p) => (p.rating || 0) >= f.minRating);
  if (f.state) out = out.filter((p) => p.state === f.state);
  if (f.lga) out = out.filter((p) => p.lga === f.lga);

  if (sort === "price_asc") out.sort((a, b) => a.price - b.price);
  else if (sort === "price_desc") out.sort((a, b) => b.price - a.price);
  else if (sort === "rating") out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === "popular") out.sort((a, b) => (b.sold || 0) - (a.sold || 0));

  return out;
}

/**
 * useProductBrowse - shared server-side product browse hook.
 *
 * Builds the /vendors/products query from a screen's scope (category /
 * subcategory / vendor) + filter state + sort, dispatches the fetch, caches the
 * result in the marketplace slice keyed by the query, and returns normalized
 * products. Every browse screen uses this so filter/sort behaviour is identical
 * everywhere and repeated visits hit the cache.
 */
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProductBrowse } from "../store/slices/marketplaceSlice";
import { buildProductQuery, buildBrowseKey } from "../lib/productFilters";
import { normalizeProduct } from "../lib/normalizeMarketplace";

export default function useProductBrowse({
  enabled = true,
  categoryId,
  subcategoryId,
  vendorId,
  condition,
  state,
  lga,
  filters,
  sort,
  limit = 200,
} = {}) {
  const dispatch = useDispatch();
  const location = useSelector((s) => s.location);
  const loadingKey = useSelector((s) => s.marketplace.productBrowse.loadingKey);

  const params = useMemo(
    () =>
      buildProductQuery({
        categoryId, subcategoryId, vendorId, condition, state, lga, filters, sort, location, limit,
      }),
    [categoryId, subcategoryId, vendorId, condition, state, lga, filters, sort, location, limit]
  );
  const key = useMemo(() => buildBrowseKey(params), [params]);

  const entry = useSelector((s) => s.marketplace.productBrowse.byKey[key]);

  useEffect(() => {
    if (!enabled) return;
    if (entry?.list) return;
    dispatch(fetchProductBrowse({ key, params }));
  }, [dispatch, enabled, key, params, entry?.list]);

  const products = useMemo(
    () => (entry?.list || []).map(normalizeProduct).filter(Boolean),
    [entry?.list]
  );

  const loading = Boolean(enabled && !entry?.list && loadingKey === key);

  const refetch = () => dispatch(fetchProductBrowse({ key, params }));

  return { products, loading, params, key, refetch };
}

/**
 * marketplaceSlice - real backend data for the customer app's browsing
 * screens (Home, CategoryScreen, SubcategoryScreen, VendorStorefrontScreen,
 * ProductDetailScreen). Replaces the old app/src/data/marketplace.js mock
 * catalog now that the backend has a real seeded catalog and public
 * (no-auth) browse routes - see backend/src/modules/vendor/vendor.routes.js.
 *
 * Each cache is keyed so repeat visits (e.g. re-opening the same vendor
 * storefront) don't refetch, mirroring categoriesSlice's cache-then-refresh
 * shape.
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchVendors = createAsyncThunk(
  "marketplace/fetchVendors",
  async (_, { rejectWithValue }) => {
    try {
      const json = await api.get("/vendors");
      return json?.data || [];
    } catch (error) {
      return rejectWithValue(error.message || "Failed to load shops");
    }
  }
);

export const fetchVendorDetail = createAsyncThunk(
  "marketplace/fetchVendorDetail",
  async (vendorId, { rejectWithValue }) => {
    try {
      const json = await api.get(`/vendors/${vendorId}`);
      return { vendorId, vendor: json?.data || null };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to load shop");
    }
  }
);

export const fetchProductsByCategory = createAsyncThunk(
  "marketplace/fetchProductsByCategory",
  async (categoryId, { rejectWithValue }) => {
    try {
      const json = await api.get("/vendors/products", { params: { categoryId } });
      return { categoryId, products: json?.data || [] };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to load products");
    }
  }
);

// Home screen's "Featured listings" - latest products across all vendors,
// no category filter. Kept separate from productsByCategory's cache since
// it's keyed by nothing (there's no single categoryPrefix to key it under).
export const fetchFeaturedProducts = createAsyncThunk(
  "marketplace/fetchFeaturedProducts",
  async (_, { rejectWithValue }) => {
    try {
      const json = await api.get("/vendors/products", { params: { limit: 12 } });
      return json?.data || [];
    } catch (error) {
      return rejectWithValue(error.message || "Failed to load listings");
    }
  }
);

// CategoriesScreen "For You" feed - the whole available catalogue (not the
// 12-item home teaser), newest first. Kept in its own cache so it doesn't
// collide with the shared `featured` list used by Home/Marketplace screens.
export const fetchAllProducts = createAsyncThunk(
  "marketplace/fetchAllProducts",
  async (_, { rejectWithValue }) => {
    try {
      const json = await api.get("/vendors/products", { params: { limit: 500 } });
      return json?.data || [];
    } catch (error) {
      return rejectWithValue(error.message || "Failed to load products");
    }
  }
);

export const fetchProductDetail = createAsyncThunk(
  "marketplace/fetchProductDetail",
  async (productId, { rejectWithValue }) => {
    try {
      const json = await api.get(`/vendors/products/${productId}`);
      return { productId, product: json?.data || null };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to load product");
    }
  }
);

// Generic server-side product browse (GET /vendors/products) with the full
// filter/sort param set. Callers pass a stable `key` (buildBrowseKey(params))
// so results are cached per query; see hooks/useProductBrowse.js.
export const fetchProductBrowse = createAsyncThunk(
  "marketplace/fetchProductBrowse",
  async ({ key, params }, { rejectWithValue }) => {
    try {
      const json = await api.get("/vendors/products", { params });
      return { key, products: json?.data || [] };
    } catch (error) {
      return rejectWithValue(error.message || "Failed to load products");
    }
  }
);

const initialState = {
  vendors: { list: [], loading: false, error: null, lastFetchedAt: 0 },
  vendorDetail: { byId: {}, loadingId: null, error: null },
  productsByCategory: { byPrefix: {}, loadingPrefix: null, error: null },
  featured: { list: [], loading: false, error: null, lastFetchedAt: 0 },
  allProducts: { list: [], loading: false, error: null, lastFetchedAt: 0 },
  productDetail: { byId: {}, loadingId: null, error: null },
  productBrowse: { byKey: {}, loadingKey: null, error: null },
};

const marketplaceSlice = createSlice({
  name: "marketplace",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendors.pending, (state) => {
        state.vendors.loading = true;
        state.vendors.error = null;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.vendors.loading = false;
        state.vendors.list = action.payload;
        state.vendors.lastFetchedAt = Date.now();
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.vendors.loading = false;
        state.vendors.error = action.payload || "Failed to load shops";
      })

      .addCase(fetchVendorDetail.pending, (state, action) => {
        state.vendorDetail.loadingId = action.meta.arg;
        state.vendorDetail.error = null;
      })
      .addCase(fetchVendorDetail.fulfilled, (state, action) => {
        state.vendorDetail.loadingId = null;
        state.vendorDetail.byId[action.payload.vendorId] = action.payload.vendor;
      })
      .addCase(fetchVendorDetail.rejected, (state, action) => {
        state.vendorDetail.loadingId = null;
        state.vendorDetail.error = action.payload || "Failed to load shop";
      })

      .addCase(fetchProductsByCategory.pending, (state, action) => {
        state.productsByCategory.loadingPrefix = action.meta.arg;
        state.productsByCategory.error = null;
      })
      .addCase(fetchProductsByCategory.fulfilled, (state, action) => {
        state.productsByCategory.loadingPrefix = null;
        state.productsByCategory.byPrefix[action.payload.categoryId] = action.payload.products;
      })
      .addCase(fetchProductsByCategory.rejected, (state, action) => {
        state.productsByCategory.loadingPrefix = null;
        state.productsByCategory.error = action.payload || "Failed to load products";
      })

      .addCase(fetchFeaturedProducts.pending, (state) => {
        state.featured.loading = true;
        state.featured.error = null;
      })
      .addCase(fetchFeaturedProducts.fulfilled, (state, action) => {
        state.featured.loading = false;
        state.featured.list = action.payload;
        state.featured.lastFetchedAt = Date.now();
      })
      .addCase(fetchFeaturedProducts.rejected, (state, action) => {
        state.featured.loading = false;
        state.featured.error = action.payload || "Failed to load listings";
      })

      .addCase(fetchAllProducts.pending, (state) => {
        state.allProducts.loading = true;
        state.allProducts.error = null;
      })
      .addCase(fetchAllProducts.fulfilled, (state, action) => {
        state.allProducts.loading = false;
        state.allProducts.list = action.payload;
        state.allProducts.lastFetchedAt = Date.now();
      })
      .addCase(fetchAllProducts.rejected, (state, action) => {
        state.allProducts.loading = false;
        state.allProducts.error = action.payload || "Failed to load products";
      })

      .addCase(fetchProductDetail.pending, (state, action) => {
        state.productDetail.loadingId = action.meta.arg;
        state.productDetail.error = null;
      })
      .addCase(fetchProductDetail.fulfilled, (state, action) => {
        state.productDetail.loadingId = null;
        state.productDetail.byId[action.payload.productId] = action.payload.product;
      })
      .addCase(fetchProductDetail.rejected, (state, action) => {
        state.productDetail.loadingId = null;
        state.productDetail.error = action.payload || "Failed to load product";
      })

      .addCase(fetchProductBrowse.pending, (state, action) => {
        state.productBrowse.loadingKey = action.meta.arg.key;
        state.productBrowse.error = null;
      })
      .addCase(fetchProductBrowse.fulfilled, (state, action) => {
        state.productBrowse.loadingKey = null;
        state.productBrowse.byKey[action.payload.key] = {
          list: action.payload.products,
          lastFetchedAt: Date.now(),
        };
      })
      .addCase(fetchProductBrowse.rejected, (state, action) => {
        state.productBrowse.loadingKey = null;
        state.productBrowse.error = action.payload || "Failed to load products";
      });
  },
});

export default marketplaceSlice.reducer;

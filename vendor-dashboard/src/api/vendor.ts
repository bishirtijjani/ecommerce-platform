import api from './client';
import type {
  DiscountCode, Highlight, HighlightInput, HighlightStory, StoryInput, Order, Paginated, Product,
  ProductCondition, ProductOptionGroup, ProductVariant, SalesSummary, Vendor, VendorCategory, TaxonomyCategory, TaxonomySubcategory, CreateCategoryInput, UpdateCategoryInput, VendorCustomer,
} from '../types';

// Public admin-managed taxonomy (categories + their subcategories) - used by
// the product form's dependent dropdowns. No auth needed (public route).
export const getCategories = () =>
  api.get<unknown, { data: VendorCategory[] }>('/categories').then((r) => r.data);

export const getVendorProfile = (vendorId: string) =>
  api.get<unknown, { data: Vendor }>(`/vendors/vendor/${vendorId}/profile`).then((r) => r.data);

// Nigerian States + LGAs (public reference data) for the State/LGA selects.
export const getStates = () =>
  api.get<unknown, { data: string[] }>('/geo/states').then((r) => r.data);

export const getLgas = (state: string) =>
  api.get<unknown, { data: string[] }>(`/geo/states/${encodeURIComponent(state)}/lgas`).then((r) => r.data);

export interface ReverseGeocodeResult {
  address: string | null;
  city: string | null;
  state: string | null;
  lga: string | null;
  country: string | null;
}

/** Resolve a map pin to an address + canonical State/LGA. */
export const reverseGeocode = (lat: number, lng: number) =>
  api
    .get<unknown, { data: ReverseGeocodeResult }>('/geo/reverse', { params: { lat, lng } })
    .then((r) => r.data);

export interface PlaceSearchResult {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  state: string | null;
  lga: string | null;
}

/** Free-text place/address search for the map picker. */
export const searchPlaces = (query: string) =>
  api
    .get<unknown, { data: PlaceSearchResult[] }>('/geo/search', { params: { query } })
    .then((r) => r.data);

export const updateVendorProfile = (vendorId: string, data: Partial<Vendor>) =>
  api.patch<unknown, { data: Vendor }>(`/vendors/vendor/${vendorId}/profile`, data).then((r) => r.data);

export const resubmitVendor = (vendorId: string, data: Partial<Vendor>) =>
  api.patch<unknown, { data: Vendor }>(`/vendors/vendor/${vendorId}/resubmit`, data).then((r) => r.data);

export const toggleVendorStatus = (vendorId: string, isOpen: boolean) =>
  api.patch<unknown, { data: Vendor }>(`/vendors/${vendorId}/status`, { isOpen }).then((r) => r.data);

// ---- Orders ----

export const getVendorOrders = (
  vendorId: string,
  params: { status?: string; page?: number; limit?: number } = {},
) => api.get<unknown, Paginated<Order>>(`/vendors/vendor/${vendorId}/orders`, { params }).then((r) => r);

export const getOrderById = (orderId: string) =>
  api.get<unknown, { data: Order }>(`/orders/${orderId}`).then((r) => r.data);

export const acceptOrder = (vendorId: string, orderId: string) =>
  api.patch<unknown, { data: Order }>(`/vendors/vendor/${vendorId}/orders/${orderId}/accept`).then((r) => r.data);

export const rejectOrder = (vendorId: string, orderId: string, reason: string) =>
  api.patch<unknown, { data: Order }>(`/vendors/vendor/${vendorId}/orders/${orderId}/reject`, { reason }).then((r) => r.data);

export const updateOrderStatus = (
  vendorId: string,
  orderId: string,
  status: 'SHIPPED' | 'DELIVERED',
  trackingNumber?: string,
) =>
  api
    .patch<unknown, { data: Order }>(`/vendors/vendor/${vendorId}/orders/${orderId}/status`, { status, trackingNumber })
    .then((r) => r.data);

export const searchCustomers = (vendorId: string, phone: string) =>
  api.get<unknown, { data: VendorCustomer[] }>(`/vendors/vendor/${vendorId}/customers`, { params: { phone } }).then((r) => r.data);

export interface LogOrderInput {
  customerId: string;
  shippingAddressId?: string;
  newAddress?: { label?: string; address: string; lat?: number; lng?: number };
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    selectedOptions?: { groupId: string; itemIds: string[] }[];
    specialInstructions?: string;
  }[];
  promoCode?: string;
}

export const logVendorOrder = (vendorId: string, input: LogOrderInput) =>
  api.post<unknown, { data: Order }>(`/vendors/vendor/${vendorId}/orders`, input).then((r) => r.data);

export interface OrderMessage {
  id: string;
  orderId: string;
  body: string;
  createdAt: string;
  fromUser: { id: string; firstName: string; lastName: string; role: string };
}

export const listOrderMessages = (orderId: string) =>
  api.get<unknown, { data: OrderMessage[] }>(`/orders/${orderId}/messages`).then((r) => r.data);
export const postOrderMessage = (orderId: string, body: string) =>
  api.post<unknown, { data: OrderMessage }>(`/orders/${orderId}/messages`, { body }).then((r) => r.data);

// ---- Products ----

export const getVendorProducts = (vendorId: string, params: { page?: number; limit?: number } = {}) =>
  api.get<unknown, Paginated<Product>>(`/vendors/vendor/${vendorId}/products`, { params }).then((r) => r);

export const getVendorProductById = (vendorId: string, productId: string) =>
  api.get<unknown, { data: Product }>(`/vendors/vendor/${vendorId}/products/${productId}`).then((r) => r.data);

export interface VariantPayload {
  sku?: string;
  attributes?: Record<string, string>;
  price: number;
  stock?: number;
  isAvailable?: boolean;
}

export interface OptionGroupPayload {
  id?: string;
  name: string;
  selectionRule: string;
  minSelect: number;
  maxSelect: number;
  items: { id?: string; name: string; priceDelta: number; isDefault: boolean; isAvailable: boolean }[];
}

export interface ProductInput {
  name: string;
  description?: string;
  basePrice: number;
  categoryId: string;
  subcategoryId?: string | null;
  imageUrl?: string;
  images?: string[];
  videoUrl?: string;
  isAvailable?: boolean;
  stock?: number;
  condition?: ProductCondition;
  variants?: VariantPayload[];
  optionGroups?: OptionGroupPayload[];
}

export const createProduct = (vendorId: string, input: ProductInput) =>
  api.post<unknown, { data: Product }>(`/vendors/vendor/${vendorId}/products`, input).then((r) => r.data);

export const updateProduct = (vendorId: string, productId: string, input: Partial<ProductInput>) =>
  api.put<unknown, { data: Product }>(`/vendors/vendor/${vendorId}/products/${productId}`, input).then((r) => r.data);

export const deleteProduct = (vendorId: string, productId: string) =>
  api.delete(`/vendors/vendor/${vendorId}/products/${productId}`);

export const toggleProductAvailability = (vendorId: string, productId: string, isAvailable: boolean) =>
  api
    .patch<unknown, { data: Product }>(`/vendors/vendor/${vendorId}/products/${productId}/availability`, { isAvailable })
    .then((r) => r.data);

export const createVariant = (vendorId: string, productId: string, input: Partial<ProductVariant>) =>
  api.post<unknown, { data: ProductVariant }>(`/vendors/vendor/${vendorId}/products/${productId}/variants`, input).then((r) => r.data);

export const updateVariant = (vendorId: string, productId: string, variantId: string, input: Partial<ProductVariant>) =>
  api
    .patch<unknown, { data: ProductVariant }>(`/vendors/vendor/${vendorId}/products/${productId}/variants/${variantId}`, input)
    .then((r) => r.data);

export const deleteVariant = (vendorId: string, productId: string, variantId: string) =>
  api.delete(`/vendors/vendor/${vendorId}/products/${productId}/variants/${variantId}`);

export const bulkUpsertOptionGroups = (vendorId: string, productId: string, groups: OptionGroupPayload[]) =>
  api
    .put<unknown, { data: ProductOptionGroup[] }>(`/vendors/vendor/${vendorId}/products/${productId}/option-groups`, { groups })
    .then((r) => r.data);

// ---- Analytics ----

export const getSalesSummary = (vendorId: string, period: '7d' | '30d' | '90d') =>
  api
    .get<unknown, { data: SalesSummary }>(`/vendors/vendor/${vendorId}/analytics/sales`, { params: { period } })
    .then((r) => r.data);

export const getOrderHistory = (
  vendorId: string,
  params: { page?: number; limit?: number; startDate?: string; endDate?: string } = {},
) => api.get<unknown, Paginated<Order>>(`/vendors/vendor/${vendorId}/analytics/orders`, { params }).then((r) => r);

// ---- Marketing ----

export const getDiscountCodes = (vendorId: string) =>
  api.get<unknown, { data: DiscountCode[] }>(`/vendors/vendor/${vendorId}/marketing/discounts`).then((r) => r.data);

export interface DiscountCodeInput {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrder?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate?: string;
  endDate?: string;
}

export const createDiscountCode = (vendorId: string, input: DiscountCodeInput) =>
  api.post<unknown, { data: DiscountCode }>(`/vendors/vendor/${vendorId}/marketing/discounts`, input).then((r) => r.data);

// ---- Shop story highlights (whatsapp-status-style, permanent) ----

export const getVendorHighlights = (vendorId: string) =>
  api.get<unknown, { data: Highlight[] }>(`/vendors/vendor/${vendorId}/highlights`).then((r) => r.data);

export const createHighlight = (vendorId: string, input: HighlightInput) =>
  api.post<unknown, { data: Highlight }>(`/vendors/vendor/${vendorId}/highlights`, input).then((r) => r.data);

export const updateHighlight = (vendorId: string, highlightId: string, input: Partial<HighlightInput>) =>
  api.patch<unknown, { data: Highlight }>(`/vendors/vendor/${vendorId}/highlights/${highlightId}`, input).then((r) => r.data);

export const deleteHighlight = (vendorId: string, highlightId: string) =>
  api.delete(`/vendors/vendor/${vendorId}/highlights/${highlightId}`);

export const createStory = (vendorId: string, highlightId: string, input: StoryInput) =>
  api
    .post<unknown, { data: HighlightStory }>(`/vendors/vendor/${vendorId}/highlights/${highlightId}/stories`, input)
    .then((r) => r.data);

export const updateStory = (vendorId: string, highlightId: string, storyId: string, input: Partial<StoryInput>) =>
  api
    .patch<unknown, { data: HighlightStory }>(
      `/vendors/vendor/${vendorId}/highlights/${highlightId}/stories/${storyId}`,
      input,
    )
    .then((r) => r.data);

export const deleteStory = (vendorId: string, highlightId: string, storyId: string) =>
  api.delete(`/vendors/vendor/${vendorId}/highlights/${highlightId}/stories/${storyId}`);

export const reorderStories = (vendorId: string, highlightId: string, storyIds: string[]) =>
  api
    .patch<unknown, { data: HighlightStory[] }>(
      `/vendors/vendor/${vendorId}/highlights/${highlightId}/stories/reorder`,
      { storyIds },
    )
    .then((r) => r.data);

// ── Unified taxonomy (single Category -> Subcategory system) ─────────────────
// Every category/subcategory is either global (owned: false) or this vendor's
// own (owned: true). Vendors list the full taxonomy (tagged Global vs Yours),
// create their own category, add their own subcategory under any category, and
// edit the picture of any row (updates the shared image). See vendor.service
// listVendorTaxonomy/createOwnCategory/updateCategoryMeta/createOwnSubcategory/
// updateSubcategoryMeta on the backend.

export const getVendorTaxonomy = (vendorId: string) =>
  api
    .get<unknown, { data: TaxonomyCategory[] }>(`/vendors/vendor/${vendorId}/categories`)
    .then((r) => r.data);

export const createOwnCategory = (vendorId: string, input: CreateCategoryInput) =>
  api
    .post<unknown, { data: TaxonomyCategory }>(`/vendors/vendor/${vendorId}/categories`, input)
    .then((r) => r.data);

export const updateCategoryMeta = (
  vendorId: string,
  categoryId: string,
  input: UpdateCategoryInput,
) =>
  api
    .patch<unknown, { data: TaxonomyCategory }>(`/vendors/vendor/${vendorId}/categories/${categoryId}`, input)
    .then((r) => r.data);

export const deleteOwnCategory = (vendorId: string, categoryId: string) =>
  api
    .delete<unknown, { data: { success: boolean } }>(`/vendors/vendor/${vendorId}/categories/${categoryId}`)
    .then((r) => r.data);

export const createOwnSubcategory = (
  vendorId: string,
  categoryId: string,
  input: CreateCategoryInput,
) =>
  api
    .post<unknown, { data: TaxonomySubcategory }>(
      `/vendors/vendor/${vendorId}/categories/${categoryId}/subcategories`,
      input,
    )
    .then((r) => r.data);

export const updateSubcategoryMeta = (
  vendorId: string,
  categoryId: string,
  subcategoryId: string,
  input: UpdateCategoryInput,
) =>
  api
    .patch<unknown, { data: TaxonomySubcategory }>(
      `/vendors/vendor/${vendorId}/categories/${categoryId}/subcategories/${subcategoryId}`,
      input,
    )
    .then((r) => r.data);

export const deleteOwnSubcategory = (
  vendorId: string,
  categoryId: string,
  subcategoryId: string,
) =>
  api
    .delete<unknown, { data: { success: boolean } }>(
      `/vendors/vendor/${vendorId}/categories/${categoryId}/subcategories/${subcategoryId}`,
    )
    .then((r) => r.data);



import api from "../../services/api";
import { newIdempotencyKey } from "../../services/idempotency";

export const VENDOR_BASE = (vendorId) => `/vendors/vendor/${vendorId}`;

export const getVendorProfile = (vendorId) =>
  api.get(`/vendors/vendor/${vendorId}/profile`).then((r) => r.data);

export const updateVendorProfile = (vendorId, data) =>
  api.patch(`/vendors/vendor/${vendorId}/profile`, data).then((r) => r.data);

export const resubmitVendor = (vendorId, data) =>
  api.patch(`/vendors/vendor/${vendorId}/resubmit`, data).then((r) => r.data);

export const toggleVendorStatus = (vendorId, isOpen) =>
  api.patch(`/vendors/${vendorId}/status`, { isOpen }).then((r) => r.data);

/** Resolve a map pin to an address + canonical State/LGA. */
export const reverseGeocode = (lat, lng) =>
  api.get('/geo/reverse', { params: { lat, lng } }).then((r) => r.data);

// Orders
export const getVendorOrders = (vendorId, params = {}) =>
  api.get(`/vendors/vendor/${vendorId}/orders`, { params });

export const getOrderById = (orderId) =>
  api.get(`/orders/${orderId}`).then((r) => r.data);

export const acceptOrder = (vendorId, orderId) =>
  api.patch(`/vendors/vendor/${vendorId}/orders/${orderId}/accept`).then((r) => r.data);

export const rejectOrder = (vendorId, orderId, reason) =>
  api.patch(`/vendors/vendor/${vendorId}/orders/${orderId}/reject`, { reason }).then((r) => r.data);

export const updateOrderStatus = (vendorId, orderId, status, trackingNumber) =>
  api.patch(`/vendors/vendor/${vendorId}/orders/${orderId}/status`, { status, trackingNumber }).then((r) => r.data);

export const searchCustomers = (vendorId, phone) =>
  api.get(`/vendors/vendor/${vendorId}/customers`, { params: { phone } }).then((r) => r.data);

export const logVendorOrder = (vendorId, input) =>
  api.post(`/vendors/vendor/${vendorId}/orders`, input).then((r) => r.data);

export const listOrderMessages = (orderId) =>
  api.get(`/orders/${orderId}/messages`).then((r) => r.data);

export const postOrderMessage = (orderId, body) =>
  api.post(`/orders/${orderId}/messages`, { body }).then((r) => r.data);

// Products
export const getVendorProducts = (vendorId, params = {}) =>
  api.get(`/vendors/vendor/${vendorId}/products`, { params: { limit: 100, ...params } });

export const getVendorProductById = (vendorId, productId) =>
  api.get(`/vendors/vendor/${vendorId}/products/${productId}`).then((r) => r.data);

export const createProduct = (vendorId, input) =>
  api.post(`/vendors/vendor/${vendorId}/products`, input).then((r) => r.data);

export const updateProduct = (vendorId, productId, input) =>
  api.put(`/vendors/vendor/${vendorId}/products/${productId}`, input).then((r) => r.data);

export const deleteProduct = (vendorId, productId) =>
  api.delete(`/vendors/vendor/${vendorId}/products/${productId}`);

export const toggleProductAvailability = (vendorId, productId, isAvailable) =>
  api.patch(`/vendors/vendor/${vendorId}/products/${productId}/availability`, { isAvailable }).then((r) => r.data);

// Variants
export const createVariant = (vendorId, productId, input) =>
  api.post(`/vendors/vendor/${vendorId}/products/${productId}/variants`, input).then((r) => r.data);

export const updateVariant = (vendorId, productId, variantId, input) =>
  api.patch(`/vendors/vendor/${vendorId}/products/${productId}/variants/${variantId}`, input).then((r) => r.data);

export const deleteVariant = (vendorId, productId, variantId) =>
  api.delete(`/vendors/vendor/${vendorId}/products/${productId}/variants/${variantId}`);

// Option groups
export const bulkUpsertOptionGroups = (vendorId, productId, groups) =>
  api.put(`/vendors/vendor/${vendorId}/products/${productId}/option-groups`, { groups }).then((r) => r.data);

// Analytics
export const getSalesSummary = (vendorId, period) =>
  api.get(`/vendors/vendor/${vendorId}/analytics/sales`, { params: { period } }).then((r) => r.data);

export const getOrderHistory = (vendorId, params = {}) =>
  api.get(`/vendors/vendor/${vendorId}/analytics/orders`, { params });

// Marketing
export const getDiscountCodes = (vendorId) =>
  api.get(`/vendors/vendor/${vendorId}/marketing/discounts`).then((r) => r.data);

export const createDiscountCode = (vendorId, input) =>
  api.post(`/vendors/vendor/${vendorId}/marketing/discounts`, input).then((r) => r.data);

export const getVendorCampaigns = (vendorId) =>
  api.get(`/vendors/vendor/${vendorId}/marketing/campaigns`).then((r) => r.data);

export const createVendorCampaign = (vendorId, input) =>
  api.post(`/vendors/vendor/${vendorId}/marketing/campaigns`, input).then((r) => r.data);

// Highlights
export const getVendorHighlights = (vendorId) =>
  api.get(`/vendors/vendor/${vendorId}/highlights`).then((r) => r.data);

export const createHighlight = (vendorId, input) =>
  api.post(`/vendors/vendor/${vendorId}/highlights`, input).then((r) => r.data);

export const updateHighlight = (vendorId, highlightId, input) =>
  api.patch(`/vendors/vendor/${vendorId}/highlights/${highlightId}`, input).then((r) => r.data);

export const deleteHighlight = (vendorId, highlightId) =>
  api.delete(`/vendors/vendor/${vendorId}/highlights/${highlightId}`);

export const createStory = (vendorId, highlightId, input) =>
  api.post(`/vendors/vendor/${vendorId}/highlights/${highlightId}/stories`, input).then((r) => r.data);

export const updateStory = (vendorId, highlightId, storyId, input) =>
  api.patch(`/vendors/vendor/${vendorId}/highlights/${highlightId}/stories/${storyId}`, input).then((r) => r.data);

export const deleteStory = (vendorId, highlightId, storyId) =>
  api.delete(`/vendors/vendor/${vendorId}/highlights/${highlightId}/stories/${storyId}`);

export const reorderStories = (vendorId, highlightId, storyIds) =>
  api.patch(`/vendors/vendor/${vendorId}/highlights/${highlightId}/stories/reorder`, { storyIds }).then((r) => r.data);

// Taxonomy
export const getVendorTaxonomy = (vendorId) =>
  api.get(`/vendors/vendor/${vendorId}/categories`).then((r) => r.data);

export const createOwnCategory = (vendorId, input) =>
  api.post(`/vendors/vendor/${vendorId}/categories`, input).then((r) => r.data);

export const updateCategoryMeta = (vendorId, categoryId, input) =>
  api.patch(`/vendors/vendor/${vendorId}/categories/${categoryId}`, input).then((r) => r.data);

export const deleteOwnCategory = (vendorId, categoryId) =>
  api.delete(`/vendors/vendor/${vendorId}/categories/${categoryId}`).then((r) => r.data);

export const createOwnSubcategory = (vendorId, categoryId, input) =>
  api.post(`/vendors/vendor/${vendorId}/categories/${categoryId}/subcategories`, input).then((r) => r.data);

export const updateSubcategoryMeta = (vendorId, categoryId, subcategoryId, input) =>
  api.patch(`/vendors/vendor/${vendorId}/categories/${categoryId}/subcategories/${subcategoryId}`, input).then((r) => r.data);

export const deleteOwnSubcategory = (vendorId, categoryId, subcategoryId) =>
  api.delete(`/vendors/vendor/${vendorId}/categories/${categoryId}/subcategories/${subcategoryId}`).then((r) => r.data);

// Requests
export const listRequestInbox = (params = {}) =>
  api.get("/requests/inbox", { params, skipToast: true }).then((r) => r.data);

export const getRequest = (requestId) =>
  api.get(`/requests/${requestId}`, { skipToast: true }).then((r) => r.data);

export const respondToRequest = (requestId, payload) =>
  api.post(`/requests/${requestId}/responses`, payload).then((r) => r.data);

export const declineRequest = (requestId) =>
  api.post(`/requests/${requestId}/decline`).then((r) => r.data);

export const markInboxSeen = () =>
  api.post("/requests/inbox/seen").then((r) => r.data);

// Chat
// This screen always browses the VENDOR side. The side must be declared
// explicitly because one account can be customer + vendor at once, so the
// backend cannot infer it from the scalar role - without it the seller sees
// their own customer-side conversations instead of their shop's threads.
// Mirrors vendor-dashboard/src/api/chat.ts.
export const listConversations = (params = {}) =>
  api
    .get("/chats", {
      params: { side: "vendor", ...(params.archived ? { archived: "true" } : {}) },
    })
    .then((r) => r.data);

export const getChatUnreadCount = () =>
  api.get("/chats/unread-count", { params: { side: "vendor" } }).then((r) => r.data.count);

export const getConversation = (conversationId) =>
  api.get(`/chats/${conversationId}`).then((r) => r.data);

// The backend paginates chat history with `before` (a datetime), not `cursor`.
// Sending `cursor` is silently dropped by the query schema, so pagination
// would always replay the newest page.
export const listChatMessages = (conversationId, before) =>
  api.get(`/chats/${conversationId}/messages`, { params: before ? { before } : undefined }).then((r) => r.data);

export const sendChatMessage = (conversationId, body, attachmentUrls = []) =>
  api
    .post(`/chats/${conversationId}/messages`, { body, attachmentUrls }, {
      headers: { "Idempotency-Key": newIdempotencyKey() },
    })
    .then((r) => r.data);

export const markConversationRead = (conversationId) =>
  api.post(`/chats/${conversationId}/read`).then((r) => r.data);

export const setConversationArchived = (conversationId, archived) =>
  api.patch(`/chats/${conversationId}/archive`, { archived }).then((r) => r.data);

// Support
export const getSupportTickets = () => api.get("/support/tickets").then((r) => r.data);
export const createSupportTicket = (data) =>
  api
    .post("/support/tickets", data, { headers: { "Idempotency-Key": newIdempotencyKey() } })
    .then((r) => r.data);

// Geo
export const getStates = () => api.get("/geo/states").then((r) => r.data);
export const getLgas = (state) => api.get(`/geo/states/${encodeURIComponent(state)}/lgas`).then((r) => r.data);

// Categories public
export const getCategories = () => api.get("/categories").then((r) => r.data);

// Enrollment
export const vendorEnroll = (data) => api.post("/auth/vendor/enroll", data).then((r) => r.data);

// Upload helper: returns signature? reuse backend upload signature if exists
export const getUploadSignature = () => api.post("/auth/upload-signature").then((r) => r.data);
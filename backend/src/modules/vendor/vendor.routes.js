/**
 * Vendor routes - /vendors
 * Vendor management endpoints
 */

const { Router } = require('express');
const vendorController = require('./vendor.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  createVendorSchema,
  updateVendorSchema,
  listVendorsSchema,
  publicProductsSchema,
  toggleVendorStatusSchema,
  // Vendor dashboard schemas
  updateVendorProfileSchema,
  searchVendorCustomersSchema,
  createVendorOrderSchema,
  vendorOrdersSchema,
  rejectOrderSchema,
  updateOrderStatusSchema,
  vendorProductsSchema,
  createProductSchema,
  updateProductSchema,
  toggleProductAvailabilitySchema,
  vendorAnalyticsSchema,
  vendorOrderHistorySchema,
  variantInputSchema,
  updateVariantSchema,
  optionGroupInputSchema,
  optionGroupUpdateSchema,
   optionItemInputSchema,
   optionItemUpdateSchema,
   createCallbackRequestSchema,
   // Shop story highlights
   createHighlightSchema,
   updateHighlightSchema,
   createHighlightStorySchema,
   updateHighlightStorySchema,
   reorderStoriesSchema,
   // Unified taxonomy (single Category -> Subcategory system)
   createCategorySchema,
   createSubcategorySchema,
   updateCategorySchema,
} = require('./vendor.validator');
const { callbackRequestLimiter } = require('../../middlewares/rate-limit.middleware');

const {
  createVendorDiscountSchema,
  createVendorCampaignSchema,
} = require('./marketing.validator');

const router = Router();

// ============================================================
// Public endpoints (no auth - customer app browsing)
// ============================================================
// Literal routes must be registered before the generic `/:vendorId` param
// route below, or Express would match e.g. GET /vendors/products as
// vendorId="products".

// Browse vendors (with filters) - always APPROVED-only, see controller.
router.get('/', validate(listVendorsSchema, 'query'), vendorController.getVendors);

// Cross-vendor product browse for CategoryScreen/SubcategoryScreen/Home.
router.get('/products', validate(publicProductsSchema, 'query'), vendorController.getPublicProducts);
router.get('/products/:productId', vendorController.getPublicProductById);

// Chat-commerce "Request a callback" action (ContactVendorSheet) - emails the
// vendor the customer's phone number, no order/cart involved.
router.post(
  '/:vendorId/callback-request',
  callbackRequestLimiter,
  validate(createCallbackRequestSchema),
  vendorController.requestVendorCallback,
);

// Get vendor details (+ its available products) for VendorStorefrontScreen.
router.get('/:vendorId', vendorController.getVendorById);

// ============================================================
// Vendor endpoints
// ============================================================

// Update vendor profile
router.patch('/:vendorId', authenticate, authorize('VENDOR', 'ADMIN'), validate(updateVendorSchema), vendorController.updateVendor);

// Toggle open/closed status
router.patch('/:vendorId/status', authenticate, authorize('VENDOR', 'ADMIN'), validate(toggleVendorStatusSchema), vendorController.toggleVendorStatus);

// Get vendor orders
router.get('/:vendorId/orders', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.getVendorOrders);

// ============================================================
// Admin endpoints
// ============================================================

// Create vendor (admin only)
router.post('/', authenticate, authorize('ADMIN'), validate(createVendorSchema), vendorController.createVendor);

// Get pending vendors (admin only)
router.get('/admin/pending', authenticate, authorize('ADMIN'), vendorController.getPendingVendors);

// Approve vendor (admin only)
router.patch('/:vendorId/approve', authenticate, authorize('ADMIN'), vendorController.approveVendor);

// Reject vendor (admin only)
router.patch('/:vendorId/reject', authenticate, authorize('ADMIN'), vendorController.rejectVendor);

// Suspend vendor (admin only)
router.patch('/:vendorId/suspend', authenticate, authorize('ADMIN'), vendorController.suspendVendor);

// Unsuspend vendor (admin only)
router.patch('/:vendorId/unsuspend', authenticate, authorize('ADMIN'), vendorController.unsuspendVendor);

// Delete vendor (admin only)
router.delete('/:vendorId', authenticate, authorize('ADMIN'), vendorController.deleteVendor);

// ============================================================
// Vendor Dashboard Endpoints
// ============================================================

// Vendor profile
router.get('/vendor/:vendorId/profile', authenticate, authorize('VENDOR'), vendorController.getVendorProfile);
router.patch('/vendor/:vendorId/profile', authenticate, authorize('VENDOR'), validate(updateVendorProfileSchema), vendorController.updateVendor);

// Resubmit a rejected application for review (optionally fixing profile fields in the same call)
router.patch('/vendor/:vendorId/resubmit', authenticate, authorize('VENDOR'), validate(updateVendorProfileSchema), vendorController.resubmitVendor);

// Unified taxonomy - a single Category -> Subcategory system. Vendors manage
  // the categories/subcategories that show on their shop: list the full
  // taxonomy (global + theirs, tagged Global vs Mine), create their own custom
  // category, add their own subcategory under any category, and edit the
  // picture of any category/subcategory (updates the shared image).
  router.get('/vendor/:vendorId/categories', authenticate, authorize('VENDOR'), vendorController.listVendorTaxonomy);
  router.post('/vendor/:vendorId/categories', authenticate, authorize('VENDOR'), validate(createCategorySchema), vendorController.createOwnCategory);
router.patch('/vendor/:vendorId/categories/:categoryId', authenticate, authorize('VENDOR'), validate(updateCategorySchema), vendorController.updateCategoryMeta);
router.delete('/vendor/:vendorId/categories/:categoryId', authenticate, authorize('VENDOR'), vendorController.deleteOwnCategory);
router.post('/vendor/:vendorId/categories/:categoryId/subcategories', authenticate, authorize('VENDOR'), validate(createSubcategorySchema), vendorController.createOwnSubcategory);
router.patch('/vendor/:vendorId/categories/:categoryId/subcategories/:subcategoryId', authenticate, authorize('VENDOR'), vendorController.updateSubcategoryMeta);
router.delete('/vendor/:vendorId/categories/:categoryId/subcategories/:subcategoryId', authenticate, authorize('VENDOR'), vendorController.deleteOwnSubcategory);

// Customer lookup for the "log an order" flow (chat-commerce - vendor
// records the order after agreeing terms by phone/chat).
router.get('/vendor/:vendorId/customers', authenticate, authorize('VENDOR', 'ADMIN'), validate(searchVendorCustomersSchema, 'query'), vendorController.searchVendorCustomers);

// Vendor orders
router.get('/vendor/:vendorId/orders', authenticate, authorize('VENDOR'), validate(vendorOrdersSchema, 'query'), vendorController.getVendorOrders);
router.post('/vendor/:vendorId/orders', authenticate, authorize('VENDOR', 'ADMIN'), validate(createVendorOrderSchema), vendorController.createVendorOrder);
router.patch('/vendor/:vendorId/orders/:orderId/accept', authenticate, authorize('VENDOR'), vendorController.acceptVendorOrder);
router.patch('/vendor/:vendorId/orders/:orderId/reject', authenticate, authorize('VENDOR'), validate(rejectOrderSchema), vendorController.rejectVendorOrder);
router.patch('/vendor/:vendorId/orders/:orderId/status', authenticate, authorize('VENDOR'), validate(updateOrderStatusSchema), vendorController.updateVendorOrderStatus);

// Vendor products
// Admins share these routes (not a separate /admin namespace) because the service
// layer is already role-aware: the ownership guard is skipped when role === 'ADMIN',
// so admins can manage any vendor's catalogue from the admin dashboard.
router.get('/vendor/:vendorId/products', authenticate, authorize('VENDOR', 'ADMIN'), validate(vendorProductsSchema, 'query'), vendorController.getVendorProducts);
router.get('/vendor/:vendorId/products/:productId', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.getVendorProductById);
router.post('/vendor/:vendorId/products', authenticate, authorize('VENDOR', 'ADMIN'), validate(createProductSchema), vendorController.createVendorProduct);
router.put('/vendor/:vendorId/products/:productId', authenticate, authorize('VENDOR', 'ADMIN'), validate(updateProductSchema), vendorController.updateVendorProduct);
router.delete('/vendor/:vendorId/products/:productId', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.deleteVendorProduct);
router.patch('/vendor/:vendorId/products/:productId/availability', authenticate, authorize('VENDOR', 'ADMIN'), validate(toggleProductAvailabilitySchema), vendorController.toggleVendorProductAvailability);

// Product variants (nested)
router.post('/vendor/:vendorId/products/:productId/variants', authenticate, authorize('VENDOR', 'ADMIN'), validate(variantInputSchema), vendorController.createProductVariant);
router.patch('/vendor/:vendorId/products/:productId/variants/:variantId', authenticate, authorize('VENDOR', 'ADMIN'), validate(updateVariantSchema), vendorController.updateProductVariant);
router.delete('/vendor/:vendorId/products/:productId/variants/:variantId', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.deleteProductVariant);

// Product option groups (size/color/customization)
router.post('/vendor/:vendorId/products/:productId/option-groups', authenticate, authorize('VENDOR', 'ADMIN'), validate(optionGroupInputSchema), vendorController.createOptionGroup);
router.patch('/vendor/:vendorId/products/:productId/option-groups/:groupId', authenticate, authorize('VENDOR', 'ADMIN'), validate(optionGroupUpdateSchema), vendorController.updateOptionGroup);
router.delete('/vendor/:vendorId/products/:productId/option-groups/:groupId', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.deleteOptionGroup);

// Bulk-upsert all option groups + items in one shot (catalogue import / template apply).
// Body: { groups: [{ id?, name, selectionRule, minSelect, maxSelect, sortOrder?, items: [{ id?, name, priceDelta?, isDefault?, isAvailable?, sortOrder? }] }] }
router.put('/vendor/:vendorId/products/:productId/option-groups', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.bulkUpsertOptionGroups);

// Option items within a group
router.post('/vendor/:vendorId/products/:productId/option-groups/:groupId/items', authenticate, authorize('VENDOR', 'ADMIN'), validate(optionItemInputSchema), vendorController.createOptionItem);
router.patch('/vendor/:vendorId/products/:productId/option-groups/:groupId/items/:itemId', authenticate, authorize('VENDOR', 'ADMIN'), validate(optionItemUpdateSchema), vendorController.updateOptionItem);
router.delete('/vendor/:vendorId/products/:productId/option-groups/:groupId/items/:itemId', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.deleteOptionItem);

// Vendor analytics
router.get('/vendor/:vendorId/analytics/sales', authenticate, authorize('VENDOR'), validate(vendorAnalyticsSchema, 'query'), vendorController.getVendorSalesSummary);
router.get('/vendor/:vendorId/analytics/orders', authenticate, authorize('VENDOR'), validate(vendorOrderHistorySchema, 'query'), vendorController.getVendorOrderHistory);

// Vendor Marketing
router.get('/vendor/:vendorId/marketing/discounts', authenticate, authorize('VENDOR'), vendorController.getVendorDiscountCodes);
router.post('/vendor/:vendorId/marketing/discounts', authenticate, authorize('VENDOR'), validate(createVendorDiscountSchema), vendorController.createVendorDiscountCode);
router.get('/vendor/:vendorId/marketing/campaigns', authenticate, authorize('VENDOR'), vendorController.getVendorCampaigns);
router.post('/vendor/:vendorId/marketing/campaigns', authenticate, authorize('VENDOR'), validate(createVendorCampaignSchema), vendorController.createVendorCampaign);

// Shop story highlights (whatsapp-status-style, permanent - not time-boxed)
// Collection (a highlight group)
router.get('/vendor/:vendorId/highlights', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.getVendorHighlights);
router.post('/vendor/:vendorId/highlights', authenticate, authorize('VENDOR', 'ADMIN'), validate(createHighlightSchema), vendorController.createVendorHighlight);
router.get('/vendor/:vendorId/highlights/:highlightId', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.getHighlight);
router.patch('/vendor/:vendorId/highlights/:highlightId', authenticate, authorize('VENDOR', 'ADMIN'), validate(updateHighlightSchema), vendorController.updateVendorHighlight);
router.delete('/vendor/:vendorId/highlights/:highlightId', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.deleteVendorHighlight);

// Stories within a highlight. Literal `/reorder` MUST precede `/:storyId`
// or Express matches storyId="reorder" (see the /:vendorId note above).
router.post('/vendor/:vendorId/highlights/:highlightId/stories', authenticate, authorize('VENDOR', 'ADMIN'), validate(createHighlightStorySchema), vendorController.createHighlightStory);
router.patch('/vendor/:vendorId/highlights/:highlightId/stories/reorder', authenticate, authorize('VENDOR', 'ADMIN'), validate(reorderStoriesSchema), vendorController.reorderHighlightStories);
router.patch('/vendor/:vendorId/highlights/:highlightId/stories/:storyId', authenticate, authorize('VENDOR', 'ADMIN'), validate(updateHighlightStorySchema), vendorController.updateHighlightStory);
router.delete('/vendor/:vendorId/highlights/:highlightId/stories/:storyId', authenticate, authorize('VENDOR', 'ADMIN'), vendorController.deleteHighlightStory);

module.exports = router;

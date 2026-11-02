/**
 * Admin routes - /admin
 * All routes require ADMIN role.
 */

const { Router } = require('express');
const adminController = require('./admin.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  ticketMessageSchema: supportTicketMessageSchema,
  updateTicketStatusSchema: supportUpdateTicketStatusSchema,
  assignTicketSchema: supportAssignTicketSchema,
  ticketListQuerySchema: supportTicketListQuerySchema,
  disputeMessageSchema: supportDisputeMessageSchema,
  resolveDisputeSchema: supportResolveDisputeSchema,
  disputeListQuerySchema: supportDisputeListQuerySchema,
} = require('../support/support.validator');
const waitlistController = require('../waitlist/waitlist.controller');
const { listWaitlistQuerySchema } = require('../waitlist/waitlist.validator');
const {
  updateCustomerStatusSchema,
  updateCustomerSchema,
  updateVendorAccountSchema,
  wipeCustomerKycSchema,
  listAllOrdersSchema,
  exportAllOrdersSchema,
  forceCancelOrderSchema,
  adminUpdateOrderStatusSchema,
  listAllVendorsSchema,
  approveVendorSchema,
  rejectVendorSchema,
  suspendVendorSchema,
  unsuspendVendorSchema,
  updateVendorProfileSchema,
  createTagSchema,
  createCategorySchema,
  updateCategorySchema,
  updateAttributeSchemaSchema,
  listCategoriesSchema,
  listSubcategoriesSchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  reorderCategoriesSchema,
  reorderSubcategoriesSchema,
  updateHomeCategoriesSchema,
  deleteSubcategoryQuerySchema,
  updateTagSchema,
  setVendorTagsSchema,
  updatePlatformSettingsSchema,
  customerOrdersSchema,
  listAllCustomersSchema,
  paginationSchema,
  paginationStatusSchema,
  getAllTagsSchema,
  getAuditLogsSchema,
  createStaffSchema,
  updateStaffPermissionsSchema,
  updateStaffProfileSchema,
  listRatingsQuerySchema,
  listCallbacksQuerySchema,
  listProductsQuerySchema,
  listChatsQuerySchema,
  createCampaignSchema,
  updateCampaignSchema,
  updateCampaignStatusSchema,
  listHighlightsQuerySchema,
  updateHighlightStatusSchema,
} = require('./admin.validator');
const { PERMISSIONS } = require('../../config/permissions');
const chatController = require('../chat/chat.controller');
const requestController = require('../request/request.controller');
const { adminListRequestsQuerySchema } = require('../request/request.validator');

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Order management
router.get('/orders', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), validate(listAllOrdersSchema, 'query'), adminController.getAllOrders);
// Static paths before '/orders/:orderId' so they aren't captured as IDs.
router.get('/orders/stats', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), adminController.getOrderStats);
router.get('/orders/export', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), validate(exportAllOrdersSchema, 'query'), adminController.exportOrders);
router.get('/orders/:orderId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), adminController.getOrderById);
router.patch('/orders/:orderId/cancel', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), validate(forceCancelOrderSchema), adminController.forceCancelOrder);
router.patch('/orders/:orderId/status', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), validate(adminUpdateOrderStatusSchema), adminController.adminUpdateOrderStatus);

// Vendor management
router.get('/vendors', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(listAllVendorsSchema, 'query'), adminController.getAllVendors);
router.get('/vendors/status-counts', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), adminController.getVendorStatusCounts);
router.get('/vendors/:vendorId', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), adminController.getVendorById);
router.put('/vendors/:vendorId', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(updateVendorProfileSchema), adminController.updateVendorProfile);
router.patch('/vendors/:vendorId/account', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(updateVendorAccountSchema), adminController.updateVendorAccount);
router.patch('/vendors/:vendorId/approve', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(approveVendorSchema), adminController.approveVendor);
router.patch('/vendors/:vendorId/reject', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(rejectVendorSchema), adminController.rejectVendor);
router.patch('/vendors/:vendorId/suspend', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(suspendVendorSchema), adminController.suspendVendor);
router.patch('/vendors/:vendorId/unsuspend', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(unsuspendVendorSchema), adminController.unsuspendVendor);
router.get('/vendors/:vendorId/analytics', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), adminController.getVendorAnalytics);
router.post('/vendors/:vendorId/tags', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(setVendorTagsSchema), adminController.setVendorTags);

// Tag management
router.get('/tags', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(getAllTagsSchema, 'query'), adminController.getAllTags);
router.post('/tags', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(createTagSchema), adminController.createTag);
router.put('/tags/:tagId', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(updateTagSchema), adminController.updateTag);
router.delete('/tags/:tagId', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), adminController.deleteTag);

// Vendor category management
router.get('/categories', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(listCategoriesSchema, 'query'), adminController.getAllCategories);
router.post('/categories', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(createCategorySchema), adminController.createCategory);
// Static path before '/categories/:categoryId' so "reorder" isn't read as an id.
router.patch('/categories/reorder', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(reorderCategoriesSchema), adminController.reorderCategories);
router.put('/categories/:categoryId', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(updateCategorySchema), adminController.updateCategory);
router.patch('/categories/:categoryId/attribute-schema', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(updateAttributeSchemaSchema), adminController.updateCategoryAttributeSchema);
router.delete('/categories/:categoryId', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), adminController.deleteCategory);

// Subcategory management (admin-owned global rows + oversight of vendor rows)
router.get('/categories/:categoryId/subcategories', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(listSubcategoriesSchema, 'query'), adminController.getSubcategories);
router.post('/categories/:categoryId/subcategories', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(createSubcategorySchema), adminController.createSubcategory);
router.patch('/categories/:categoryId/subcategories/reorder', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(reorderSubcategoriesSchema), adminController.reorderSubcategories);
router.put('/categories/:categoryId/subcategories/:subcategoryId', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(updateSubcategorySchema), adminController.updateSubcategory);
router.delete('/categories/:categoryId/subcategories/:subcategoryId', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(deleteSubcategoryQuerySchema, 'query'), adminController.deleteSubcategory);

// Customer app Home grid layout (which categories show + their order)
router.get('/home/categories', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), adminController.getHomeCategories);
router.put('/home/categories', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(updateHomeCategoriesSchema), adminController.updateHomeCategories);

// Customer management
router.get('/customers', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(listAllCustomersSchema, 'query'), adminController.getAllCustomers);
// Static path must precede the /:customerId param route so "stats" isn't read as an id.
router.get('/customers/stats', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getCustomerStats);
router.get('/customers/:customerId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getCustomerById);
router.get('/customers/:customerId/orders', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(customerOrdersSchema, 'query'), adminController.getCustomerOrders);
router.get('/customers/:customerId/addresses', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getCustomerAddresses);
router.patch('/customers/:customerId/status', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(updateCustomerStatusSchema), adminController.updateCustomerStatus);
router.patch('/customers/:customerId', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(updateCustomerSchema), adminController.updateCustomer);
router.post('/customers/:customerId/wipe-kyc', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(wipeCustomerKycSchema), adminController.wipeCustomerKyc);

// Chat oversight - buyer<->vendor conversations across the whole platform.
// Thread detail + messages reuse chat.service's participant guard (ADMIN
// role is allowed) and chat.controller's read handlers.
router.get('/chats', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(listChatsQuerySchema, 'query'), chatController.adminListConversations);
router.get('/chats/:conversationId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), chatController.adminGetConversation);
router.get('/chats/:conversationId/messages', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), chatController.listMessages);
router.delete('/chats/:conversationId/messages/:messageId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), chatController.adminDeleteMessage);

// Ratings moderation (post-delivery scores customers left on vendors)
router.get('/ratings', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(listRatingsQuerySchema, 'query'), adminController.getAllRatings);
router.delete('/ratings/:ratingId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), adminController.deleteRating);

// Global product catalogue (cross-vendor moderation)
router.get('/products', authorize('ADMIN', PERMISSIONS.MANAGE_VENDORS), validate(listProductsQuerySchema, 'query'), adminController.getAllProducts);

// Callback request leads (chat-commerce "request a callback")
router.get('/callbacks', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(listCallbacksQuerySchema, 'query'), adminController.getCallbackRequests);

// Reverse-marketplace Requests (customer needs broadcast to matched sellers)
router.get('/requests', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(adminListRequestsQuerySchema, 'query'), requestController.adminList);
router.get('/requests/:requestId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), requestController.adminGet);
router.delete('/requests/:requestId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), requestController.adminRemove);

// Platform settings
router.get('/settings', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.getPlatformSettings);
router.patch('/settings', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(updatePlatformSettingsSchema), adminController.updatePlatformSettings);

// Staff management
router.get('/staff', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), adminController.listStaff);
router.post('/staff', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), validate(createStaffSchema), adminController.createStaff);
router.patch('/staff/:staffId/permissions', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), validate(updateStaffPermissionsSchema), adminController.updateStaffPermissions);
router.patch('/staff/:staffId/profile', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), validate(updateStaffProfileSchema), adminController.updateStaffProfile);

// Audit logs
router.get('/audit-logs', authorize('ADMIN', PERMISSIONS.MANAGE_STAFF), validate(getAuditLogsSchema, 'query'), adminController.getAuditLogs);

// Platform analytics
router.get('/analytics/revenue', authorize('ADMIN', PERMISSIONS.MANAGE_FINANCE), adminController.getRevenueAnalytics);
router.get('/analytics/orders', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), adminController.getOrderAnalytics);
router.get('/analytics/customers', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), adminController.getCustomerAnalytics);
router.get('/analytics/geographic', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), adminController.getGeographicAnalytics);
router.get('/analytics/realtime', authorize('ADMIN', PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_VENDORS), adminController.getRealtimeMetrics);

// Dispute resolution - backed by modules/support
router.get('/disputes', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportDisputeListQuerySchema, 'query'), adminController.getDisputes);
router.get('/disputes/:disputeId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), adminController.getDisputeDetail);
router.patch('/disputes/:disputeId/resolve', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportResolveDisputeSchema), adminController.resolveDispute);
router.post('/disputes/:disputeId/messages', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportDisputeMessageSchema), adminController.postDisputeMessageAdmin);

// Support management - backed by modules/support
router.get('/support/tickets', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportTicketListQuerySchema, 'query'), adminController.getSupportTickets);
router.get('/support/tickets/:ticketId', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), adminController.getTicketDetail);
router.patch('/support/tickets/:ticketId/status', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportUpdateTicketStatusSchema), adminController.updateTicketStatus);
router.patch('/support/tickets/:ticketId/assign', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportAssignTicketSchema), adminController.assignTicket);
router.post('/support/tickets/:ticketId/messages', authorize('ADMIN', PERMISSIONS.MANAGE_SUPPORT), validate(supportTicketMessageSchema), adminController.postTicketMessageAdmin);

// Pre-launch waitlist - backed by modules/waitlist
router.get('/waitlist', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), validate(listWaitlistQuerySchema, 'query'), waitlistController.adminListEntries);
router.get('/waitlist/summary', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), waitlistController.adminSummary);
router.delete('/waitlist/:id', authorize('ADMIN', PERMISSIONS.MANAGE_USERS), waitlistController.adminDeleteEntry);

// Marketing oversight
router.get('/marketing/campaigns', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(paginationSchema, 'query'), adminController.getPlatformCampaigns);
router.post('/marketing/campaigns', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(createCampaignSchema), adminController.createPlatformCampaign);
router.put('/marketing/campaigns/:campaignId', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(updateCampaignSchema), adminController.updatePlatformCampaign);
router.patch('/marketing/campaigns/:campaignId/status', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(updateCampaignStatusSchema), adminController.setCampaignStatus);
router.delete('/marketing/campaigns/:campaignId', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.deletePlatformCampaign);
router.get('/marketing/discounts', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(paginationStatusSchema, 'query'), adminController.getDiscountCodes);
router.patch('/marketing/discounts/:discountId/approve', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.approveDiscountCode);
router.patch('/marketing/discounts/:discountId/reject', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.rejectDiscountCode);

// Highlight moderation (vendor story highlights previously live-only)
router.get('/marketing/highlights', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(listHighlightsQuerySchema, 'query'), adminController.getAllHighlights);
router.patch('/marketing/highlights/:highlightId', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), validate(updateHighlightStatusSchema), adminController.setHighlightStatus);
router.delete('/marketing/highlights/:highlightId', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.deleteHighlight);

// Banner management
router.get('/marketing/banners', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.getBanners);
router.post('/marketing/banners', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.createBanner);
router.put('/marketing/banners/:bannerId', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.updateBanner);
router.delete('/marketing/banners/:bannerId', authorize('ADMIN', PERMISSIONS.MANAGE_SETTINGS), adminController.deleteBanner);

// Notification delivery health + test send
router.get('/notifications/health', authorize('ADMIN'), adminController.getNotificationHealth);
router.post('/notifications/test', authorize('ADMIN'), adminController.sendTestNotification);
router.post('/notifications/broadcast', authorize('ADMIN'), adminController.broadcastTestNotification);
router.post('/notifications/send', authorize('ADMIN'), adminController.sendNotification);

module.exports = router;

/**
 * Admin controller - HTTP handlers for admin operations.
 */

const adminService = require('./admin.service');
const supportController = require('../support/support.controller');
const { ApiResponse } = require('../../utils/api-response');

const getAllCustomers = async (req, res, next) => {
  try {
    const { customers, total, page, limit } = await adminService.getAllCustomers(req.query);
    res.json(ApiResponse.paginated('Customers', customers, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const updateCustomerStatus = async (req, res, next) => {
  try {
    const result = await adminService.updateCustomerStatus(
      req.params.customerId,
      req.body.status,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Customer status updated', result));
  } catch (error) {
    next(error);
  }
};

const updateCustomer = async (req, res, next) => {
  try {
    const result = await adminService.updateCustomer(
      req.params.customerId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Customer updated', result));
  } catch (error) {
    next(error);
  }
};

const updateVendorAccount = async (req, res, next) => {
  try {
    const result = await adminService.updateVendorAccount(
      req.params.vendorId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Vendor account updated', result));
  } catch (error) {
    next(error);
  }
};

const wipeCustomerKyc = async (req, res, next) => {
  try {
    const result = await adminService.wipeCustomerKyc(
      req.params.customerId,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Customer KYC wiped', result));
  } catch (error) {
    next(error);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    const customer = await adminService.getCustomerById(req.params.customerId);
    res.json(ApiResponse.success('Customer detail', customer));
  } catch (error) {
    next(error);
  }
};

const getCustomerStats = async (req, res, next) => {
  try {
    const stats = await adminService.getCustomerStats();
    res.json(ApiResponse.success('Customer stats', stats));
  } catch (error) {
    next(error);
  }
};
const getCustomerOrders = async (req, res, next) => {
  try {
    const { orders, total, page, limit } = await adminService.getCustomerOrders({
      customerId: req.params.customerId,
      ...req.query,
    });
    res.json(ApiResponse.paginated('Customer orders', orders, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getCustomerAddresses = async (req, res, next) => {
  try {
    const addresses = await adminService.getCustomerAddresses(req.params.customerId);
    res.json(ApiResponse.success('Customer addresses', addresses));
  } catch (error) {
    next(error);
  }
};

const getDashboard = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(ApiResponse.success('Dashboard stats', stats));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Order Management Controllers
// ============================================================

const getAllOrders = async (req, res, next) => {
  try {
    const { orders, total, page, limit } = await adminService.getAllOrders(req.query);
    res.json(ApiResponse.paginated('All orders', orders, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await adminService.getOrderById(req.params.orderId);
    res.json(ApiResponse.success('Order detail', order));
  } catch (error) {
    next(error);
  }
};

const getOrderStats = async (req, res, next) => {
  try {
    const stats = await adminService.getOrderStats();
    res.json(ApiResponse.success('Order stats', stats));
  } catch (error) {
    next(error);
  }
};

const exportOrders = async (req, res, next) => {
  try {
    const orders = await adminService.exportOrders(req.query);

    const headers = [
      'id', 'status', 'source', 'subtotal',
      'discountAmount', 'total', 'customerName', 'customerPhone', 'customerEmail',
      'vendorName', 'shippingAddress',
      'cancelledBy', 'cancellationReason', 'createdAt', 'deliveredAt',
    ];
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = orders.map((o) => [
      o.id, o.status, o.source, o.subtotal,
      o.discountAmount, o.total,
      `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim(),
      o.customer?.phone, o.customer?.email,
      o.vendor?.name,
      o.shippingAddress?.address,
      o.cancelledBy, o.cancellationReason,
      o.createdAt?.toISOString(), o.deliveredAt?.toISOString(),
    ].map(escape).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

const forceCancelOrder = async (req, res, next) => {
  try {
    const result = await adminService.forceCancelOrder(
      req.params.orderId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Order cancelled', result));
  } catch (error) {
    next(error);
  }
};

const adminUpdateOrderStatus = async (req, res, next) => {
  try {
    const result = await adminService.adminUpdateOrderStatus(
      req.params.orderId,
      req.body.status,
      req.body.reason,
      req.user.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json(ApiResponse.success('Order status updated', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Vendor Management Controllers
// ============================================================

const getAllVendors = async (req, res, next) => {
  try {
    const { vendors, total, page, limit } = await adminService.getAllVendors(req.query);
    res.json(ApiResponse.paginated('All vendors', vendors, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getVendorStatusCounts = async (req, res, next) => {
  try {
    const counts = await adminService.getVendorStatusCounts();
    res.json(ApiResponse.success('Vendor status counts', counts));
  } catch (error) {
    next(error);
  }
};

const getVendorById = async (req, res, next) => {
  try {
    const vendor = await adminService.getVendorById(req.params.vendorId);
    res.json(ApiResponse.success('Vendor detail', vendor));
  } catch (error) {
    next(error);
  }
};

const approveVendor = async (req, res, next) => {
  try {
    const result = await adminService.approveVendor(
      req.params.vendorId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Vendor approved', result));
  } catch (error) {
    next(error);
  }
};

const rejectVendor = async (req, res, next) => {
  try {
    const result = await adminService.rejectVendor(
      req.params.vendorId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Vendor rejected', result));
  } catch (error) {
    next(error);
  }
};

const suspendVendor = async (req, res, next) => {
  try {
    const result = await adminService.suspendVendor(
      req.params.vendorId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Vendor suspended', result));
  } catch (error) {
    next(error);
  }
};

const unsuspendVendor = async (req, res, next) => {
  try {
    const result = await adminService.unsuspendVendor(
      req.params.vendorId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Vendor unsuspended', result));
  } catch (error) {
    next(error);
  }
};

const updateVendorProfile = async (req, res, next) => {
  try {
    const result = await adminService.updateVendorProfile(
      req.params.vendorId, req.body, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Vendor profile updated', result));
  } catch (error) {
    next(error);
  }
};

const getVendorAnalytics = async (req, res, next) => {
  try {
    const result = await adminService.getVendorAnalytics(req.params.vendorId, req.query);
    res.json(ApiResponse.success('Vendor analytics', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Tag Management Controllers
// ============================================================

const getAllTags = async (req, res, next) => {
  try {
    const { tags, total, page, limit } = await adminService.getAllTags(req.query);
    res.json(ApiResponse.paginated('Tags', tags, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const createTag = async (req, res, next) => {
  try {
    const tag = await adminService.createTag(req.body, req.user.id, req.ip, req.headers['user-agent']);
    res.status(201).json(ApiResponse.success('Tag created', tag));
  } catch (error) {
    next(error);
  }
};

const updateTag = async (req, res, next) => {
  try {
    const tag = await adminService.updateTag(req.params.tagId, req.body, req.user.id, req.ip, req.headers['user-agent']);
    res.json(ApiResponse.success('Tag updated', tag));
  } catch (error) {
    next(error);
  }
};

const deleteTag = async (req, res, next) => {
  try {
    await adminService.deleteTag(req.params.tagId, req.user.id, req.ip, req.headers['user-agent']);
    res.json(ApiResponse.success('Tag deleted'));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Vendor Category Management
// ============================================================

const getAllCategories = async (req, res, next) => {
  try {
    const { categories, total, page, limit } = await adminService.getAllCategories({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      isActive: req.query.isActive,
    });
    res.json(ApiResponse.paginated('Categories', categories, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const category = await adminService.createCategory(
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.status(201).json(ApiResponse.success('Category created', category));
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await adminService.updateCategory(
      req.params.categoryId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Category updated', category));
  } catch (error) {
    next(error);
  }
};

const updateCategoryAttributeSchema = async (req, res, next) => {
  try {
    const category = await adminService.updateCategoryAttributeSchema(
      req.params.categoryId,
      req.body.attributeSchema,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Category attribute schema updated', category));
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const result = await adminService.deleteCategory(
      req.params.categoryId,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    const message = result.soft
      ? `Category deactivated (still used by ${result.productCount} product${result.productCount === 1 ? '' : 's'})`
      : 'Category deleted';
    res.json(ApiResponse.success(message, result));
  } catch (error) {
    next(error);
  }
};

const reorderCategories = async (req, res, next) => {
  try {
    const result = await adminService.reorderCategories(
      req.body.items,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Category order updated', result));
  } catch (error) {
    next(error);
  }
};

const reorderSubcategories = async (req, res, next) => {
  try {
    const result = await adminService.reorderSubcategories(
      req.params.categoryId,
      req.body.items,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Subcategory order updated', result));
  } catch (error) {
    next(error);
  }
};

const getHomeCategories = async (req, res, next) => {
  try {
    const result = await adminService.getHomeCategories();
    res.json(ApiResponse.success('Home categories retrieved', result));
  } catch (error) {
    next(error);
  }
};

const updateHomeCategories = async (req, res, next) => {
  try {
    const result = await adminService.updateHomeCategories(
      req.body.items,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Home categories updated', result));
  } catch (error) {
    next(error);
  }
};

const setVendorTags = async (req, res, next) => {
  try {
    const tags = await adminService.setVendorTags(
      req.params.vendorId, req.body.tagIds, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Vendor tags updated', tags));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Subcategory Management Controllers
// ============================================================

const getSubcategories = async (req, res, next) => {
  try {
    const { subcategories, total, page, limit } = await adminService.listSubcategories(req.params.categoryId, req.query);
    res.json(ApiResponse.paginated('Subcategories', subcategories, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const createSubcategory = async (req, res, next) => {
  try {
    const subcategory = await adminService.createSubcategory(
      req.params.categoryId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.status(201).json(ApiResponse.success('Subcategory created', subcategory));
  } catch (error) {
    next(error);
  }
};

const updateSubcategory = async (req, res, next) => {
  try {
    const subcategory = await adminService.updateSubcategory(
      req.params.categoryId,
      req.params.subcategoryId,
      req.body,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Subcategory updated', subcategory));
  } catch (error) {
    next(error);
  }
};

const deleteSubcategory = async (req, res, next) => {
  try {
    const result = await adminService.deleteSubcategory(
      req.params.categoryId,
      req.params.subcategoryId,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
      { unfile: req.query.unfile === 'true' },
    );
    res.json(ApiResponse.success('Subcategory deleted', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Ratings Moderation Controllers
// ============================================================

const getAllRatings = async (req, res, next) => {
  try {
    const { ratings, total, page, limit } = await adminService.getAllRatings(req.query);
    res.json(ApiResponse.paginated('Ratings', ratings, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const deleteRating = async (req, res, next) => {
  try {
    const result = await adminService.deleteRating(
      req.params.ratingId,
      req.user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.json(ApiResponse.success('Rating deleted', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Callback Request Leads Controllers
// ============================================================

const getCallbackRequests = async (req, res, next) => {
  try {
    const { callbacks, total, page, limit } = await adminService.getCallbackRequests(req.query);
    res.json(ApiResponse.paginated('Callback requests', callbacks, page, limit, total));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Product catalogue moderation
// ============================================================

const getAllProducts = async (req, res, next) => {
  try {
    const { products, total, page, limit } = await adminService.listAllProducts(req.query);
    res.json(ApiResponse.paginated('Products', products, page, limit, total));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Platform Settings Controllers
// ============================================================

const getPlatformSettings = async (req, res, next) => {
  try {
    const settings = await adminService.getPlatformSettings();
    res.json(ApiResponse.success('Platform settings', settings));
  } catch (error) {
    next(error);
  }
};

const updatePlatformSettings = async (req, res, next) => {
  try {
    const result = await adminService.updatePlatformSettings(req.body, req.user?.id || 'ADMIN');
    res.json(ApiResponse.success('Platform settings updated', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Audit Log Controllers
// ============================================================

const getAuditLogs = async (req, res, next) => {
  try {
    const { logs, total, page, limit } = await adminService.getAuditLogs(req.query);
    res.json(ApiResponse.paginated('Audit logs', logs, page, limit, total));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Platform Analytics Controllers
// ============================================================

const getRevenueAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getRevenueAnalytics(req.query);
    res.json(ApiResponse.success('Revenue analytics', analytics));
  } catch (error) {
    next(error);
  }
};

const getOrderAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getOrderAnalytics(req.query);
    res.json(ApiResponse.success('Order analytics', analytics));
  } catch (error) {
    next(error);
  }
};

const getCustomerAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getCustomerAnalytics(req.query);
    res.json(ApiResponse.success('Customer analytics', analytics));
  } catch (error) {
    next(error);
  }
};

const getGeographicAnalytics = async (req, res, next) => {
  try {
    const analytics = await adminService.getGeographicAnalytics(req.query);
    res.json(ApiResponse.success('Geographic analytics', analytics));
  } catch (error) {
    next(error);
  }
};

const getRealtimeMetrics = async (req, res, next) => {
  try {
    const metrics = await adminService.getRealtimeMetrics();
    res.json(ApiResponse.success('Real-time metrics', metrics));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Support tickets + disputes - delegated to the support module.
// The admin namespace keeps these paths so existing admin-dashboard URLs work.
// ============================================================

const getDisputes = (req, res, next) => {
  req.params.id = req.params.disputeId; // path-compat shim
  return supportController.adminListDisputes(req, res, next);
};

const resolveDispute = (req, res, next) => {
  req.params.id = req.params.disputeId;
  return supportController.adminResolveDispute(req, res, next);
};

const getDisputeDetail = (req, res, next) => {
  req.params.id = req.params.disputeId;
  return supportController.getDisputeById(req, res, next);
};

const postDisputeMessageAdmin = (req, res, next) => {
  req.params.id = req.params.disputeId;
  return supportController.postDisputeMessage(req, res, next);
};

const getSupportTickets = (req, res, next) => supportController.adminListTickets(req, res, next);

const updateTicketStatus = (req, res, next) => {
  req.params.id = req.params.ticketId;
  return supportController.adminUpdateTicketStatus(req, res, next);
};

const getTicketDetail = (req, res, next) => {
  req.params.id = req.params.ticketId;
  return supportController.getTicketById(req, res, next);
};

const postTicketMessageAdmin = (req, res, next) => {
  req.params.id = req.params.ticketId;
  return supportController.postTicketMessage(req, res, next);
};

const assignTicket = (req, res, next) => {
  req.params.id = req.params.ticketId;
  return supportController.adminAssignTicket(req, res, next);
};

const getPlatformCampaigns = async (req, res, next) => {
  try {
    const { campaigns, total, page, limit } = await adminService.getPlatformCampaigns(req.query);
    res.json(ApiResponse.paginated('Platform campaigns', campaigns, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const getDiscountCodes = async (req, res, next) => {
  try {
    const { discounts, total, page, limit } = await adminService.getDiscountCodes(req.query);
    res.json(ApiResponse.paginated('Discount codes', discounts, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const approveDiscountCode = async (req, res, next) => {
  try {
    const result = await adminService.approveDiscountCode(
      req.params.discountId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Discount code approved', result));
  } catch (error) {
    next(error);
  }
};

const rejectDiscountCode = async (req, res, next) => {
  try {
    const result = await adminService.rejectDiscountCode(
      req.params.discountId, req.body.reason, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Discount code rejected', result));
  } catch (error) {
    next(error);
  }
};

const createPlatformCampaign = async (req, res, next) => {
  try {
    const campaign = await adminService.createPlatformCampaign(
      req.body, req.user.id, req.ip, req.headers['user-agent']
    );
    res.status(201).json(ApiResponse.success('Campaign created', campaign));
  } catch (error) {
    next(error);
  }
};

const updatePlatformCampaign = async (req, res, next) => {
  try {
    const campaign = await adminService.updatePlatformCampaign(
      req.params.campaignId, req.body, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Campaign updated', campaign));
  } catch (error) {
    next(error);
  }
};

const setCampaignStatus = async (req, res, next) => {
  try {
    const campaign = await adminService.setCampaignStatus(
      req.params.campaignId, req.body.status, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Campaign status updated', campaign));
  } catch (error) {
    next(error);
  }
};

const deletePlatformCampaign = async (req, res, next) => {
  try {
    const result = await adminService.deletePlatformCampaign(
      req.params.campaignId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Campaign deleted', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Highlight Moderation Controllers
// ============================================================

const getAllHighlights = async (req, res, next) => {
  try {
    const { highlights, total, page, limit } = await adminService.getAllHighlights(req.query);
    res.json(ApiResponse.paginated('Highlights', highlights, page, limit, total));
  } catch (error) {
    next(error);
  }
};

const setHighlightStatus = async (req, res, next) => {
  try {
    const highlight = await adminService.setHighlightStatus(
      req.params.highlightId, req.body.isActive, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Highlight status updated', highlight));
  } catch (error) {
    next(error);
  }
};

const deleteHighlight = async (req, res, next) => {
  try {
    const result = await adminService.deleteHighlight(
      req.params.highlightId, req.user.id, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Highlight deleted', result));
  } catch (error) {
    next(error);
  }
};

async function listStaff(req, res, next) {
  try {
    const staff = await adminService.listStaff();
    res.json(ApiResponse.success('Staff members', staff));
  } catch (error) {
    next(error);
  }
}

async function createStaff(req, res, next) {
  try {
    const staff = await adminService.createStaff(
      req.body, req.user, req.ip, req.headers['user-agent']
    );
    res.status(201).json(ApiResponse.success('Staff member created', staff));
  } catch (error) {
    next(error);
  }
}

async function updateStaffPermissions(req, res, next) {
  try {
    const result = await adminService.updateStaffPermissions(
      req.params.staffId, req.body.permissions, req.user, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Staff permissions updated', result));
  } catch (error) {
    next(error);
  }
}

async function updateStaffProfile(req, res, next) {
  try {
    const result = await adminService.updateStaffProfile(
      req.params.staffId, req.body, req.user, req.ip, req.headers['user-agent']
    );
    res.json(ApiResponse.success('Staff profile updated', result));
  } catch (error) {
    next(error);
  }
}

async function getBanners(req, res, next) {
  try {
    const banners = await adminService.getBanners();
    res.json(ApiResponse.success('Banners retrieved', banners));
  } catch (error) { next(error); }
}

async function createBanner(req, res, next) {
  try {
    const banner = await adminService.createBanner(req.body, req.user.id);
    res.status(201).json(ApiResponse.success('Banner created', banner));
  } catch (error) { next(error); }
}

async function updateBanner(req, res, next) {
  try {
    const banner = await adminService.updateBanner(req.params.bannerId, req.body, req.user.id);
    res.json(ApiResponse.success('Banner updated', banner));
  } catch (error) { next(error); }
}

async function deleteBanner(req, res, next) {
  try {
    await adminService.deleteBanner(req.params.bannerId, req.user.id);
    res.json(ApiResponse.success('Banner deleted'));
  } catch (error) { next(error); }
}

// ============================================================
// Notification delivery health
// ============================================================

async function getNotificationHealth(req, res, next) {
  try {
    const health = await adminService.getNotificationHealth();
    res.json(ApiResponse.success('Notification health', health));
  } catch (error) { next(error); }
}

async function sendTestNotification(req, res, next) {
  try {
    const result = await adminService.sendTestNotification(req.user.id);
    res.json(ApiResponse.success('Test notification sent', result));
  } catch (error) { next(error); }
}

async function broadcastTestNotification(req, res, next) {
  try {
    const result = await adminService.broadcastTestNotification(req.user.id);
    res.json(ApiResponse.success('Broadcast test notification sent', result));
  } catch (error) { next(error); }
}

async function sendNotification(req, res, next) {
  try {
    const { userId, email, all, title, body, route, audience } = req.body || {};
    const result = await adminService.sendNotification({
      userId,
      email,
      all: all === true,
      title,
      body,
      route,
      audience,
    });
    res.json(ApiResponse.success('Notification sent', result));
  } catch (error) { next(error); }
}

module.exports = {
  getAllCustomers,
  updateCustomerStatus,
  updateCustomer,
  updateVendorAccount,
  wipeCustomerKyc,
  getCustomerById,
  getCustomerStats,
  getCustomerOrders,
  getCustomerAddresses,
  getDashboard,
  getAllOrders,
  getOrderById,
  getOrderStats,
  exportOrders,
  forceCancelOrder,
  adminUpdateOrderStatus,
  getAllVendors,
  getVendorStatusCounts,
  getVendorById,
  approveVendor,
  rejectVendor,
  suspendVendor,
  unsuspendVendor,
  updateVendorProfile,
  getVendorAnalytics,
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  getAllCategories,
  createCategory,
  updateCategory,
  updateCategoryAttributeSchema,
  deleteCategory,
  reorderCategories,
  getHomeCategories,
  updateHomeCategories,
  setVendorTags,
  getSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  reorderSubcategories,
  getAllRatings,
  deleteRating,
  getCallbackRequests,
  getAllProducts,
  getPlatformSettings,
  updatePlatformSettings,
  getAuditLogs,
  getRevenueAnalytics,
  getOrderAnalytics,
  getCustomerAnalytics,
  getGeographicAnalytics,
  getRealtimeMetrics,
  getDisputes,
  resolveDispute,
  getDisputeDetail,
  postDisputeMessageAdmin,
  getSupportTickets,
  updateTicketStatus,
  getTicketDetail,
  postTicketMessageAdmin,
  assignTicket,
  getPlatformCampaigns,
  createPlatformCampaign,
  updatePlatformCampaign,
  setCampaignStatus,
  deletePlatformCampaign,
  getDiscountCodes,
  approveDiscountCode,
  rejectDiscountCode,
  getAllHighlights,
  setHighlightStatus,
  deleteHighlight,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  // Staff management
  listStaff,
  createStaff,
  updateStaffPermissions,
  updateStaffProfile,
  // Notification delivery
  getNotificationHealth,
  sendTestNotification,
  broadcastTestNotification,
  sendNotification,
};

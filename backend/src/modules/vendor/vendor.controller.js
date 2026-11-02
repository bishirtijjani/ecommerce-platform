/**
 * Vendor controller - handles HTTP requests for vendor operations
 */

const vendorService = require('./vendor.service');
const { ApiResponse } = require('../../utils/api-response');

// ============================================================
// Create Vendor (Admin only)
// ============================================================

const createVendor = async (req, res, next) => {
  try {
    const vendorData = req.body;

    const vendor = await vendorService.createVendor(vendorData);

    res.status(201).json(
      ApiResponse.success('Vendor created successfully', vendor)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Vendors (List)
// ============================================================

const getVendors = async (req, res, next) => {
  try {
    const { categoryId, categorySlug, lat, lng, radius, openNow, page, limit } = req.query;

    // This route is public (no auth) - status is never taken from the query
    // string, so an anonymous caller can't ask to see PENDING/REJECTED/
    // SUSPENDED vendors. getVendors() defaults to APPROVED when omitted.
    const result = await vendorService.getVendors({
      categoryId,
      categorySlug,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radius: radius ? parseFloat(radius) : undefined,
      // The query validator already coerces openNow to a real boolean, so
      // compare against true (not the string 'true', which never matches now).
      openNow: openNow === true || openNow === 'true',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json(
      ApiResponse.success('Vendors retrieved', result.vendors, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Vendor by ID
// ============================================================

const getVendorById = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    const vendor = await vendorService.getVendorById(vendorId);

    res.json(
      ApiResponse.success('Vendor retrieved', vendor)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Request a callback (public, no auth) - chat-commerce "Request a callback"
// action from ContactVendorSheet on the customer app.
// ============================================================

const requestVendorCallback = async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    // Honeypot: silently succeed without sending anything (see contact.controller
    // for the same convention).
    if (req.body.website && req.body.website.trim() !== '') {
      return res.status(201).json(
        ApiResponse.success('Thanks - the vendor will call you back soon.', null),
      );
    }

    await vendorService.requestVendorCallback(vendorId, {
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json(
      ApiResponse.success('Thanks - the vendor will call you back soon.', null),
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Public product browsing (no auth) - cross-vendor, for the customer app's
// category/subcategory screens and product detail page.
// ============================================================

const getPublicProducts = async (req, res, next) => {
  try {
    const {
      categoryId,
      subcategoryId,
      vendorId,
      sort,
      minPrice,
      maxPrice,
      condition,
      minRating,
      state,
      lga,
      lat,
      lng,
      radius,
      limit,
    } = req.query;

    const products = await vendorService.getPublicProducts({
      categoryId,
      subcategoryId,
      vendorId,
      sort,
      minPrice,
      maxPrice,
      condition,
      minRating,
      state,
      lga,
      lat,
      lng,
      radius,
      limit,
    });

    res.json(ApiResponse.success('Products retrieved', products));
  } catch (error) {
    next(error);
  }
};

const getPublicProductById = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await vendorService.getPublicProductById(productId);

    res.json(ApiResponse.success('Product retrieved', product));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Update Vendor
// ============================================================

const updateVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const updateData = req.body;

    const vendor = await vendorService.updateVendor(
      vendorId,
      userId,
      role,
      updateData
    );

    res.json(
      ApiResponse.success('Vendor updated', vendor)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Resubmit Vendor Application (after rejection)
// ============================================================

const resubmitVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const updateData = req.body;

    const vendor = await vendorService.resubmitVendor(
      vendorId,
      userId,
      role,
      updateData
    );

    res.json(
      ApiResponse.success('Application resubmitted for review', vendor)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Toggle Vendor Open/Closed Status
// ============================================================

const toggleVendorStatus = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { isOpen } = req.body;

    const vendor = await vendorService.toggleVendorStatus(
      vendorId,
      userId,
      role,
      { isOpen }
    );

    res.json(
      ApiResponse.success('Vendor status updated', vendor)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Vendor Orders
// ============================================================

const getVendorOrders = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { status, page, limit } = req.query;

    const result = await vendorService.getVendorOrders(
      vendorId,
      userId,
      role,
      {
        status,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      }
    );

    res.json(
      ApiResponse.success('Vendor orders retrieved', result.orders, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

// Categories & Subcategories (single unified taxonomy, vendor-extendable)
// ============================================================
// GET lists the full taxonomy (global + this vendor's own) tagged `owned`;
// the rest create/edit/delete the vendor's own rows and let a vendor update
// the picture of any category/subcategory (which edits the shared row image).

const listVendorTaxonomy = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const result = await vendorService.listVendorTaxonomy(vendorId, req.user.id, req.user.role);
    res.json(ApiResponse.success('Categories retrieved', result));
  } catch (error) {
    next(error);
  }
};

const createOwnCategory = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const result = await vendorService.createOwnCategory(vendorId, req.user.id, req.user.role, req.body || {});
    res.json(ApiResponse.success('Category created', result));
  } catch (error) {
    next(error);
  }
};

const updateCategoryMeta = async (req, res, next) => {
  try {
    const { vendorId, categoryId } = req.params;
    const result = await vendorService.updateCategoryMeta(vendorId, req.user.id, req.user.role, categoryId, req.body || {});
    res.json(ApiResponse.success('Category updated', result));
  } catch (error) {
    next(error);
  }
};

const deleteOwnCategory = async (req, res, next) => {
  try {
    const { vendorId, categoryId } = req.params;
    const result = await vendorService.deleteOwnCategory(vendorId, req.user.id, req.user.role, categoryId);
    res.json(ApiResponse.success('Category deleted', result));
  } catch (error) {
    next(error);
  }
};

const createOwnSubcategory = async (req, res, next) => {
  try {
    const { vendorId, categoryId } = req.params;
    const result = await vendorService.createOwnSubcategory(vendorId, req.user.id, req.user.role, categoryId, req.body || {});
    res.json(ApiResponse.success('Subcategory created', result));
  } catch (error) {
    next(error);
  }
};

const updateSubcategoryMeta = async (req, res, next) => {
  try {
    const { vendorId, categoryId, subcategoryId } = req.params;
    const result = await vendorService.updateSubcategoryMeta(vendorId, req.user.id, req.user.role, categoryId, subcategoryId, req.body || {});
    res.json(ApiResponse.success('Subcategory updated', result));
  } catch (error) {
    next(error);
  }
};

const deleteOwnSubcategory = async (req, res, next) => {
  try {
    const { vendorId, categoryId, subcategoryId } = req.params;
    const result = await vendorService.deleteOwnSubcategory(vendorId, req.user.id, req.user.role, categoryId, subcategoryId);
    res.json(ApiResponse.success('Subcategory deleted', result));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Vendor Controllers
// ============================================================

const getPendingVendors = async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    const result = await vendorService.getPendingVendors({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json(
      ApiResponse.success('Pending vendors retrieved', result.vendors, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

const approveVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const adminId = req.user.id;

    const vendor = await vendorService.approveVendor(vendorId, adminId);

    res.json(
      ApiResponse.success('Vendor approved', vendor)
    );
  } catch (error) {
    next(error);
  }
};

const rejectVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const vendor = await vendorService.rejectVendor(vendorId, reason, adminId);

    res.json(
      ApiResponse.success('Vendor rejected', vendor)
    );
  } catch (error) {
    next(error);
  }
};

const suspendVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const vendor = await vendorService.suspendVendor(vendorId, reason, adminId);

    res.json(
      ApiResponse.success('Vendor suspended', vendor)
    );
  } catch (error) {
    next(error);
  }
};

const unsuspendVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const adminId = req.user.id;

    const vendor = await vendorService.unsuspendVendor(vendorId, adminId);

    res.json(
      ApiResponse.success('Vendor unsuspended', vendor)
    );
  } catch (error) {
    next(error);
  }
};

const deleteVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const adminId = req.user.id;

    await vendorService.deleteVendor(vendorId, adminId);

    res.json(
      ApiResponse.success('Vendor deleted successfully', { success: true })
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Vendor Dashboard Controllers
// ============================================================

const getVendorProfile = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const vendor = await vendorService.getVendorProfile(vendorId, userId, role);

    res.json(
      ApiResponse.success('Vendor profile retrieved', vendor)
    );
  } catch (error) {
    next(error);
  }
};

const searchVendorCustomers = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { phone } = req.query;
    const customers = await vendorService.searchVendorCustomers(vendorId, req.user.id, req.user.role, { phone });
    res.json(ApiResponse.success('Matching customers retrieved', customers));
  } catch (error) {
    next(error);
  }
};

const createVendorOrder = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const order = await vendorService.createVendorOrder(vendorId, req.user.id, req.user.role, req.body);
    res.status(201).json(ApiResponse.success('Order logged', order));
  } catch (error) {
    next(error);
  }
};

const acceptVendorOrder = async (req, res, next) => {
  try {
    const { vendorId, orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const order = await vendorService.acceptVendorOrder(vendorId, userId, role, orderId);

    res.json(
      ApiResponse.success('Order accepted', order)
    );
  } catch (error) {
    next(error);
  }
};

const rejectVendorOrder = async (req, res, next) => {
  try {
    const { vendorId, orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { reason } = req.body;

    const order = await vendorService.rejectVendorOrder(vendorId, userId, role, orderId, reason);

    res.json(
      ApiResponse.success('Order rejected', order)
    );
  } catch (error) {
    next(error);
  }
};

const updateVendorOrderStatus = async (req, res, next) => {
  try {
    const { vendorId, orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { status, trackingNumber } = req.body;

    const order = await vendorService.updateVendorOrderStatus(
      vendorId, userId, role, orderId, status, { trackingNumber },
    );

    res.json(
      ApiResponse.success('Order status updated', order)
    );
  } catch (error) {
    next(error);
  }
};

const getVendorProducts = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { page, limit } = req.query;

    const result = await vendorService.getVendorProducts(
      vendorId,
      userId,
      role,
      {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      }
    );

    res.json(
      ApiResponse.success('Vendor products retrieved', result.products, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

const createVendorProduct = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const productData = req.body;

    const product = await vendorService.createVendorProduct(vendorId, userId, role, productData);

    res.status(201).json(
      ApiResponse.success('Product created', product)
    );
  } catch (error) {
    next(error);
  }
};

const updateVendorProduct = async (req, res, next) => {
  try {
    const { vendorId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const productData = req.body;

    const product = await vendorService.updateVendorProduct(vendorId, userId, role, productId, productData);

    res.json(
      ApiResponse.success('Product updated', product)
    );
  } catch (error) {
    next(error);
  }
};

const deleteVendorProduct = async (req, res, next) => {
  try {
    const { vendorId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    await vendorService.deleteVendorProduct(vendorId, userId, role, productId);

    res.json(
      ApiResponse.success('Product deleted', { success: true })
    );
  } catch (error) {
    next(error);
  }
};

const toggleVendorProductAvailability = async (req, res, next) => {
  try {
    const { vendorId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { isAvailable } = req.body;

    const product = await vendorService.toggleVendorProductAvailability(vendorId, userId, role, productId, isAvailable);

    res.json(
      ApiResponse.success('Product availability updated', product)
    );
  } catch (error) {
    next(error);
  }
};

const getVendorSalesSummary = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = '7d' } = req.query;

    const summary = await vendorService.getVendorSalesSummary(vendorId, userId, role, { period });

    res.json(
      ApiResponse.success('Sales summary retrieved', summary)
    );
  } catch (error) {
    next(error);
  }
};

const getVendorOrderHistory = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { page, limit, startDate, endDate } = req.query;

    const result = await vendorService.getVendorOrderHistory(
      vendorId,
      userId,
      role,
      {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        startDate,
        endDate,
      }
    );

    res.json(
      ApiResponse.success('Order history retrieved', result.orders, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Variant + Option-group Controllers
// ============================================================

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

const getVendorProductById = wrap(async (req, res) => {
  const { vendorId, productId } = req.params;
  const product = await vendorService.getVendorProductById(vendorId, req.user.id, req.user.role, productId);
  res.json(ApiResponse.success('Product retrieved', product));
});

const createProductVariant = wrap(async (req, res) => {
  const { vendorId, productId } = req.params;
  const variant = await vendorService.createProductVariant(vendorId, req.user.id, req.user.role, productId, req.body);
  res.status(201).json(ApiResponse.success('Variant created', variant));
});

const updateProductVariant = wrap(async (req, res) => {
  const { vendorId, productId, variantId } = req.params;
  const variant = await vendorService.updateProductVariant(vendorId, req.user.id, req.user.role, productId, variantId, req.body);
  res.json(ApiResponse.success('Variant updated', variant));
});

const deleteProductVariant = wrap(async (req, res) => {
  const { vendorId, productId, variantId } = req.params;
  await vendorService.deleteProductVariant(vendorId, req.user.id, req.user.role, productId, variantId);
  res.json(ApiResponse.success('Variant deleted', { success: true }));
});

const createOptionGroup = wrap(async (req, res) => {
  const { vendorId, productId } = req.params;
  const group = await vendorService.createOptionGroup(vendorId, req.user.id, req.user.role, productId, req.body);
  res.status(201).json(ApiResponse.success('Option group created', group));
});

const updateOptionGroup = wrap(async (req, res) => {
  const { vendorId, productId, groupId } = req.params;
  const group = await vendorService.updateOptionGroup(vendorId, req.user.id, req.user.role, productId, groupId, req.body);
  res.json(ApiResponse.success('Option group updated', group));
});

const deleteOptionGroup = wrap(async (req, res) => {
  const { vendorId, productId, groupId } = req.params;
  await vendorService.deleteOptionGroup(vendorId, req.user.id, req.user.role, productId, groupId);
  res.json(ApiResponse.success('Option group deleted', { success: true }));
});

const createOptionItem = wrap(async (req, res) => {
  const { vendorId, productId, groupId } = req.params;
  const item = await vendorService.createOptionItem(vendorId, req.user.id, req.user.role, productId, groupId, req.body);
  res.status(201).json(ApiResponse.success('Option item created', item));
});

const updateOptionItem = wrap(async (req, res) => {
  const { vendorId, productId, groupId, itemId } = req.params;
  const item = await vendorService.updateOptionItem(vendorId, req.user.id, req.user.role, productId, groupId, itemId, req.body);
  res.json(ApiResponse.success('Option item updated', item));
});

const deleteOptionItem = wrap(async (req, res) => {
  const { vendorId, productId, groupId, itemId } = req.params;
  await vendorService.deleteOptionItem(vendorId, req.user.id, req.user.role, productId, groupId, itemId);
  res.json(ApiResponse.success('Option item deleted', { success: true }));
});

const bulkUpsertOptionGroups = wrap(async (req, res) => {
  const { vendorId, productId } = req.params;
  const groups = await vendorService.bulkUpsertOptionGroups(
    vendorId,
    req.user.id,
    req.user.role,
    productId,
    req.body.groups || [],
  );
  res.json(ApiResponse.success('Option groups synced', groups));
});

const getVendorDiscountCodes = wrap(async (req, res) => {
  const { vendorId } = req.params;
  const result = await vendorService.getVendorDiscountCodes(vendorId, req.user.id, req.user.role);
  res.json(ApiResponse.success('Vendor discount codes retrieved', result));
});

const createVendorDiscountCode = wrap(async (req, res) => {
  const { vendorId } = req.params;
  const discountData = req.body;
  const result = await vendorService.createVendorDiscountCode(vendorId, req.user.id, req.user.role, discountData);
  res.status(201).json(ApiResponse.success('Discount code request submitted', result));
});

const getVendorCampaigns = wrap(async (req, res) => {
  const { vendorId } = req.params;
  const result = await vendorService.getVendorCampaigns(vendorId, req.user.id, req.user.role);
  res.json(ApiResponse.success('Vendor campaigns retrieved', result));
});

const createVendorCampaign = wrap(async (req, res) => {
  const { vendorId } = req.params;
  const campaignData = req.body;
  const result = await vendorService.createVendorCampaign(vendorId, req.user.id, req.user.role, campaignData);
  res.status(201).json(ApiResponse.success('Campaign created successfully', result));
});

// ============================================================
// Shop story highlights (whatsapp-status-style, permanent)
// ============================================================

const getVendorHighlights = wrap(async (req, res) => {
  const { vendorId } = req.params;
  const result = await vendorService.getVendorHighlights(vendorId, req.user.id, req.user.role);
  res.json(ApiResponse.success('Highlights retrieved', result));
});

const getHighlight = wrap(async (req, res) => {
  const { vendorId, highlightId } = req.params;
  const highlight = await vendorService.getHighlight(vendorId, req.user.id, req.user.role, highlightId);
  res.json(ApiResponse.success('Highlight retrieved', highlight));
});

const createVendorHighlight = wrap(async (req, res) => {
  const { vendorId } = req.params;
  const highlight = await vendorService.createVendorHighlight(vendorId, req.user.id, req.user.role, req.body);
  res.status(201).json(ApiResponse.success('Highlight created', highlight));
});

const updateVendorHighlight = wrap(async (req, res) => {
  const { vendorId, highlightId } = req.params;
  const highlight = await vendorService.updateVendorHighlight(vendorId, req.user.id, req.user.role, highlightId, req.body);
  res.json(ApiResponse.success('Highlight updated', highlight));
});

const deleteVendorHighlight = wrap(async (req, res) => {
  const { vendorId, highlightId } = req.params;
  await vendorService.deleteVendorHighlight(vendorId, req.user.id, req.user.role, highlightId);
  res.json(ApiResponse.success('Highlight deleted', { success: true }));
});

const createHighlightStory = wrap(async (req, res) => {
  const { vendorId, highlightId } = req.params;
  const story = await vendorService.createHighlightStory(vendorId, req.user.id, req.user.role, highlightId, req.body);
  res.status(201).json(ApiResponse.success('Story added', story));
});

const updateHighlightStory = wrap(async (req, res) => {
  const { vendorId, highlightId, storyId } = req.params;
  const story = await vendorService.updateHighlightStory(vendorId, req.user.id, req.user.role, highlightId, storyId, req.body);
  res.json(ApiResponse.success('Story updated', story));
});

const deleteHighlightStory = wrap(async (req, res) => {
  const { vendorId, highlightId, storyId } = req.params;
  await vendorService.deleteHighlightStory(vendorId, req.user.id, req.user.role, highlightId, storyId);
  res.json(ApiResponse.success('Story deleted', { success: true }));
});

const reorderHighlightStories = wrap(async (req, res) => {
  const { vendorId, highlightId } = req.params;
  const stories = await vendorService.reorderHighlightStories(vendorId, req.user.id, req.user.role, highlightId, req.body.storyIds);
  res.json(ApiResponse.success('Stories reordered', stories));
});

module.exports = {
  createVendor,
  getVendors,
  getVendorById,
  requestVendorCallback,
  getPublicProducts,
  getPublicProductById,
  updateVendor,
  resubmitVendor,
  toggleVendorStatus,
  getVendorOrders,
  // Unified taxonomy (single Category -> Subcategory system)
  listVendorTaxonomy,
  createOwnCategory,
  updateCategoryMeta,
  deleteOwnCategory,
  createOwnSubcategory,
  updateSubcategoryMeta,
  deleteOwnSubcategory,
  // Admin controllers
  getPendingVendors,
  approveVendor,
  rejectVendor,
  suspendVendor,
  unsuspendVendor,
  deleteVendor,
  // Vendor dashboard controllers
  getVendorProfile,
  searchVendorCustomers,
  createVendorOrder,
  acceptVendorOrder,
  rejectVendorOrder,
  updateVendorOrderStatus,
  getVendorProducts,
  createVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
  toggleVendorProductAvailability,
  getVendorSalesSummary,
  getVendorOrderHistory,
  // variants + option groups
  getVendorProductById,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  createOptionGroup,
  updateOptionGroup,
  deleteOptionGroup,
  createOptionItem,
  updateOptionItem,
  deleteOptionItem,
  bulkUpsertOptionGroups,
  // marketing controllers
  getVendorDiscountCodes,
  createVendorDiscountCode,
  getVendorCampaigns,
  createVendorCampaign,
  // highlights controllers
  getVendorHighlights,
  getHighlight,
  createVendorHighlight,
  updateVendorHighlight,
  deleteVendorHighlight,
  createHighlightStory,
  updateHighlightStory,
  deleteHighlightStory,
  reorderHighlightStories,
};

/**
 * Order controller - handles HTTP requests for order operations
 */

const orderService = require('./order.service');
const { ApiResponse } = require('../../utils/api-response');
const { issueQuoteToken } = require('../../utils/quote-token');

// ============================================================
// Create Order
// ============================================================

const createOrder = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const orderData = req.body;

    const order = await orderService.createOrder(customerId, orderData);

    res.status(201).json(
      ApiResponse.success('Order created successfully', order)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Orders (List)
// ============================================================

const getOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { status, categoryId, categorySlug, scope, page, limit } = req.query;

    const result = await orderService.getOrders(userId, role, {
      status,
      categoryId,
      categorySlug,
      scope,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json(
      ApiResponse.paginated('Orders retrieved', result.orders, result.page, result.limit, result.total)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Order by ID
// ============================================================

const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const order = await orderService.getOrderById(orderId, userId, role);

    res.json(
      ApiResponse.success('Order retrieved', order)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Update Order Status
// ============================================================

const updateStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status, reason, trackingNumber } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    const order = await orderService.updateStatus(
      orderId,
      status,
      userId,
      role,
      { reason, trackingNumber },
    );

    res.json(
      ApiResponse.success('Order status updated', order)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Cancel Order - customer path.
// ============================================================

const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const customerId = req.user.id;

    const result = await orderService.cancelOrder(orderId, customerId, reason);

    res.json(
      ApiResponse.success('Order cancelled', result),
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Active order - single-shot fetch for the home banner.
// ============================================================

const getActiveOrder = async (req, res, next) => {
  try {
    const active = await orderService.getActiveOrder(req.user.id);
    res.json(ApiResponse.success('Active order', active));
  } catch (err) {
    next(err);
  }
};

// ============================================================
// Messaging
// ============================================================

const listMessages = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { before, limit } = req.query;
    const messages = await orderService.listMessages(orderId, req.user.id, req.user.role, {
      before,
      limit: limit ? parseInt(limit, 10) : 30,
    });
    res.json(ApiResponse.success('Messages retrieved', messages));
  } catch (error) {
    next(error);
  }
};

const postMessage = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { body } = req.body;
    const message = await orderService.postMessage(orderId, req.user.id, req.user.role, body);
    res.status(201).json(ApiResponse.success('Message posted', message));
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Rate Order
// ============================================================

const rateOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const ratingData = req.body;
    const customerId = req.user.id;

    const rating = await orderService.rateOrder(orderId, customerId, ratingData);

    res.status(201).json(
      ApiResponse.success('Rating submitted', rating)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Controllers
// ============================================================

const getAllOrdersAdmin = async (req, res, next) => {
  try {
    const { status, categoryId, categorySlug, page, limit, startDate, endDate, customerId, vendorId } = req.query;

    const result = await orderService.getAllOrdersAdmin({
      status,
      categoryId,
      categorySlug,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      startDate,
      endDate,
      customerId,
      vendorId,
    });

    res.json(
      ApiResponse.success('Orders retrieved', result.orders, {
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

const forceCancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const order = await orderService.forceCancelOrder(orderId, reason, adminId);

    res.json(
      ApiResponse.success('Order cancelled by admin', order)
    );
  } catch (error) {
    next(error);
  }
};

const adminUpdateStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    const order = await orderService.adminUpdateStatus(orderId, status, adminId);

    res.json(
      ApiResponse.success('Order status updated by admin', order)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Quote (Estimate) - POST with full body shape: same numbers the eventual
// createOrder will persist. Client submits the order payload here, shows the
// breakdown to the user, then submits to POST / with the matching shape AND
// the returned quoteToken. Server re-verifies the token signature and TTL
// before accepting the create.
// ============================================================

const getQuote = async (req, res, next) => {
  try {
    const pricing = await orderService.estimateOrder(req.body);
    const { resolvedItems, ...quote } = pricing;

    const { token, expiresAt } = issueQuoteToken({
      vendorId: req.body.vendorId,
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      promoCode: req.body.promoCode || null,
    });

    res.json(
      ApiResponse.success('Quote calculated', {
        ...quote,
        quoteToken: token,
        validUntil: new Date(expiresAt).toISOString(),
      }),
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getQuote,
  getOrders,
  getOrderById,
  updateStatus,
  cancelOrder,
  getActiveOrder,
  listMessages,
  postMessage,
  rateOrder,
  // Admin controllers
  getAllOrdersAdmin,
  forceCancelOrder,
  adminUpdateStatus,
};

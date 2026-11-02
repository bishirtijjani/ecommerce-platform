/**
 * Chat controller - HTTP handlers for buyer<->vendor conversations.
 */

const chatService = require('./chat.service');
const { ApiResponse } = require('../../utils/api-response');

const startConversation = async (req, res, next) => {
  try {
    const conversation = await chatService.startConversation(req.user.id, req.body);
    res.status(201).json(ApiResponse.success('Conversation ready', conversation));
  } catch (err) {
    next(err);
  }
};

const listConversations = async (req, res, next) => {
  try {
    const conversations = await chatService.listConversations(req.user.id, req.user.role, req.query);
    res.json(ApiResponse.success('Conversations', conversations));
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const result = await chatService.getUnreadCount(req.user.id, req.user.role, req.query.side);
    res.json(ApiResponse.success('Unread count', result));
  } catch (err) {
    next(err);
  }
};

const getConversationById = async (req, res, next) => {
  try {
    const conversation = await chatService.getConversationById(req.params.conversationId, req.user.id, req.user.role);
    res.json(ApiResponse.success('Conversation', conversation));
  } catch (err) {
    next(err);
  }
};

const listMessages = async (req, res, next) => {
  try {
    const messages = await chatService.listMessages(req.params.conversationId, req.user.id, req.user.role, req.query);
    res.json(ApiResponse.success('Messages retrieved', messages));
  } catch (err) {
    next(err);
  }
};

const postMessage = async (req, res, next) => {
  try {
    const message = await chatService.postMessage(req.params.conversationId, req.user.id, req.user.role, req.body);
    res.status(201).json(ApiResponse.success('Message sent', message));
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const conversation = await chatService.markRead(req.params.conversationId, req.user.id, req.user.role);
    res.json(ApiResponse.success('Marked as read', conversation));
  } catch (err) {
    next(err);
  }
};

const setArchived = async (req, res, next) => {
  try {
    const conversation = await chatService.setArchived(
      req.params.conversationId,
      req.user.id,
      req.user.role,
      req.body.archived,
    );
    res.json(ApiResponse.success(req.body.archived ? 'Conversation archived' : 'Conversation unarchived', conversation));
  } catch (err) {
    next(err);
  }
};

// Admin oversight handlers (reachable only via the /admin/chats namespace -
// route-level checks live in admin.routes.js).

const adminListConversations = async (req, res, next) => {
  try {
    const { conversations, total, page, limit } = await chatService.listAllConversations({
      ...req.query,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(ApiResponse.paginated('All conversations', conversations, page, limit, total));
  } catch (err) {
    next(err);
  }
};

const adminGetConversation = async (req, res, next) => {
  try {
    const conversation = await chatService.adminGetConversation(
      req.params.conversationId,
      req.user.id,
      req.user.role,
    );
    res.json(ApiResponse.success('Conversation', conversation));
  } catch (err) {
    next(err);
  }
};

const adminDeleteMessage = async (req, res, next) => {
  try {
    const result = await chatService.deleteMessage(
      req.params.conversationId,
      req.params.messageId,
      req.user.id,
      req.user.role,
    );
    res.json(ApiResponse.success('Message deleted', result));
  } catch (err) {
    next(err);
  }
};

module.exports = {
  startConversation,
  listConversations,
  getUnreadCount,
  getConversationById,
  listMessages,
  postMessage,
  markRead,
  setArchived,
  adminListConversations,
  adminGetConversation,
  adminDeleteMessage,
};

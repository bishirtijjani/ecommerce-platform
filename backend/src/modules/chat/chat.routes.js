/**
 * Chat routes - /chats
 *
 * Buyer<->vendor conversations - the chat-commerce core surface. Every
 * authenticated user can be on either side of a thread (a VENDOR-role user
 * chatting with a *different* vendor is still just "a customer" for that
 * thread), so route-level authorize() stays permissive; chat.service scopes
 * every query to conversations the caller actually belongs to.
 */

const { Router } = require('express');
const chatController = require('./chat.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { idempotency } = require('../../middlewares/idempotency.middleware');
const { chatMessageLimiter } = require('../../middlewares/rate-limit.middleware');
const {
  startConversationSchema,
  postChatMessageSchema,
  listConversationsQuerySchema,
  listChatMessagesQuerySchema,
  archiveConversationSchema,
} = require('./chat.validator');

const router = Router();

router.use(authenticate);

// Find-or-create the (customer, vendor) thread. Idempotent by design (unique
// on customerId+vendorId) but still guarded by Idempotency-Key so a flaky
// network retry on the client can't race two creates.
router.post(
  '/',
  authorize('CUSTOMER'),
  chatMessageLimiter,
  idempotency,
  validate(startConversationSchema),
  chatController.startConversation,
);

router.get('/', validate(listConversationsQuerySchema, 'query'), chatController.listConversations);
router.get('/unread-count', chatController.getUnreadCount);
router.get('/:conversationId', chatController.getConversationById);
router.get('/:conversationId/messages', validate(listChatMessagesQuerySchema, 'query'), chatController.listMessages);
router.post(
  '/:conversationId/messages',
  chatMessageLimiter,
  idempotency,
  validate(postChatMessageSchema),
  chatController.postMessage,
);
router.post('/:conversationId/read', chatController.markRead);
router.patch('/:conversationId/archive', validate(archiveConversationSchema), chatController.setArchived);

module.exports = router;

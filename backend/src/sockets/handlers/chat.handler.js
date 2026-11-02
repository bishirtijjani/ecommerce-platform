/**
 * Chat socket handler.
 *
 * ROOMS:
 * - chat:{conversationId} - both parties join this while the thread is open
 *   on screen, for live message delivery + typing indicators.
 *
 * The actual message persistence + the MESSAGE_NEW/CONVERSATION_UPDATED
 * emits happen server-side in chat.service.postMessage (mirrors how
 * order.service emits ORDER.MESSAGE_NEW) - this handler only owns room
 * membership and the purely-ephemeral typing indicator, which never touches
 * the database.
 */

const { CHAT, getConversationRoom } = require('../events');
const { logger } = require('../../utils/logger');

const registerChatHandlers = (io, socket) => {
  /**
   * Join a conversation room.
   * Payload: { conversationId: string }
   */
  socket.on(CHAT.JOIN_ROOM, (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;

    const room = getConversationRoom(conversationId);
    socket.join(room);

    logger.debug('Joined chat room', { userId: socket.user.id, room });
  });

  /**
   * Leave a conversation room.
   * Payload: { conversationId: string }
   */
  socket.on(CHAT.LEAVE_ROOM, (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;

    const room = getConversationRoom(conversationId);
    socket.leave(room);

    logger.debug('Left chat room', { userId: socket.user.id, room });
  });

  /**
   * Typing indicator - purely ephemeral, relayed to everyone else in the
   * room (i.e. the other party, since only 2 people are ever in a chat room).
   * Payload: { conversationId: string }
   */
  socket.on(CHAT.TYPING_START, (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;
    socket.to(getConversationRoom(conversationId)).emit(CHAT.TYPING_START, {
      conversationId,
      userId: socket.user.id,
    });
  });

  socket.on(CHAT.TYPING_STOP, (data) => {
    const { conversationId } = data || {};
    if (!conversationId) return;
    socket.to(getConversationRoom(conversationId)).emit(CHAT.TYPING_STOP, {
      conversationId,
      userId: socket.user.id,
    });
  });
};

module.exports = { registerChatHandlers };

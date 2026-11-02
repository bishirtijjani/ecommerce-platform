/**
 * Bridges the socket → Redux store for chat events (`chat:message:new`,
 * `chat:conversation:updated`). Subscribed once at the AppNavigator level
 * when the user is authenticated, mirroring notificationsBus.js.
 */

import socketService from './socket';

let lastUnsubscribers = [];

/**
 * @param {Function} dispatch
 * @param {{ chatMessageReceived: Function, chatConversationUpdated: Function }} actions
 * @param {Function} getCurrentUserId - returns the signed-in user's id (a
 *   getter, not a snapshot, so it always reads the current value even though
 *   this subscription is set up once per auth session).
 */
export const subscribeChatSocketToStore = (dispatch, { chatMessageReceived, chatConversationUpdated }, getCurrentUserId) => {
  // Idempotent - re-subscribing replaces the previous handlers.
  lastUnsubscribers.forEach((fn) => fn());
  lastUnsubscribers = [];

  lastUnsubscribers.push(
    socketService.onChatMessageNew(({ conversationId, message }) => {
      if (!conversationId || !message) return;
      const currentUserId = getCurrentUserId?.();
      dispatch(chatMessageReceived({ conversationId, message, isMine: message.senderId === currentUserId }));
    }),
  );
  lastUnsubscribers.push(
    socketService.onChatConversationUpdated((data) => {
      if (!data?.conversationId) return;
      dispatch(chatConversationUpdated(data));
    }),
  );

  return () => {
    lastUnsubscribers.forEach((fn) => fn());
    lastUnsubscribers = [];
  };
};

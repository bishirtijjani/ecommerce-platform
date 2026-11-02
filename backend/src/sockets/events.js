/**
 * Socket.io event name constants.
 *
 * ALL socket events MUST be defined here.
 * No hardcoded event strings anywhere else in the codebase.
 *
 * Naming convention: DOMAIN:ACTION
 * Examples: order:status:changed, vendor:catalogue:updated
 */

// --- Connection lifecycle ---
const CONNECTION = {
  CONNECT: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'connect_error',
  AUTH_ERROR: 'auth_error',
};

// --- Order lifecycle events ---
const ORDER = {
  // Server → Customer/Vendor: order created
  CREATED: 'order:created',

  // Server → Customer/Vendor: status changed
  STATUS_CHANGED: 'order:status:changed',

  // Server → Customer: vendor accepted the order
  VENDOR_ACCEPTED: 'order:vendor:accepted',

  // Server → Customer: vendor marked the order shipped
  VENDOR_SHIPPED: 'order:vendor:shipped',

  // Server → Customer/Vendor: order completed (delivered + settled)
  COMPLETED: 'order:completed',

  // Server → Customer/Vendor: order cancelled
  CANCELLED: 'order:cancelled',

  // Customer/Vendor → Server: join order tracking room
  JOIN_ROOM: 'order:room:join',

  // Customer/Vendor → Server: leave order tracking room
  LEAVE_ROOM: 'order:room:leave',

  // Customer/Vendor → Server: join a vendor-scoped room (catalogue updates, new orders)
  JOIN_VENDOR_ROOM: 'vendor:room:join',
  LEAVE_VENDOR_ROOM: 'vendor:room:leave',

  // Server → Order room: new in-app message
  MESSAGE_NEW: 'order:message:new',
};

// --- Vendor catalogue events ---
const VENDOR = {
  // Server → anyone watching the vendor: a product/variant/option was changed.
  // Customers viewing this vendor's catalogue refetch on receipt.
  CATALOGUE_UPDATED: 'vendor:catalogue:updated',

  // Server → everyone (vendor room + global browse room + admin room): the
  // vendor's open/closed state changed (self-toggle or admin override).
  // Broadcast broadly so browse lists and the admin dashboard update live,
  // without each client having to join every vendor's room.
  STATUS_CHANGED: 'vendor:status:changed',

  // Server → admin room: a rejected vendor resubmitted their application, so
  // it is back in PENDING_APPROVAL. Lets the admin dashboard surface it live
  // instead of the resubmission sitting silently in the queue.
  RESUBMITTED: 'vendor:resubmitted',
};

// --- Notification events ---
const NOTIFICATION = {
  // Server → User: generic in-app notification
  NEW: 'notification:new',
};

// --- Request events (reverse marketplace: customer need → seller replies) ---
const REQUEST = {
  // Server → pinged seller's personal room: a new request was pushed to you
  NEW: 'request:new',

  // Server → customer's personal room: a seller replied to your request
  RESPONSE_NEW: 'request:response:new',

  // Server → customer + responding sellers: the request was assigned/closed
  ASSIGNED: 'request:assigned',
};

// --- Chat events (buyer<->vendor conversations, the chat-commerce core) ---
const CHAT = {
  // Customer/Vendor → Server: join a conversation room while its thread is open
  JOIN_ROOM: 'chat:room:join',
  LEAVE_ROOM: 'chat:room:leave',

  // Server → conversation room: a new message was posted
  MESSAGE_NEW: 'chat:message:new',

  // Server → the OTHER party's personal room: lets the Chats list/tab badge
  // update live even when that party isn't inside this thread.
  CONVERSATION_UPDATED: 'chat:conversation:updated',

  // Customer/Vendor → Server → conversation room (relayed to the other
  // party only): typing indicator. Payload: { conversationId }
  TYPING_START: 'chat:typing:start',
  TYPING_STOP: 'chat:typing:stop',

  // Server → conversation room: the other party read up to `readAt`
  READ: 'chat:read',
};

// --- Room naming helpers ---

/**
 * Get the room name for a specific order.
 * Customer and vendor join this room during an active order.
 */
const getOrderRoom = (orderId) => `order:${orderId}`;

/**
 * Get the vendor room name.
 * Used for sending new orders and catalogue updates to a vendor.
 */
const getVendorRoom = (vendorId) => `vendor:${vendorId}`;

/**
 * Get the personal room name for a user.
 * Used for wallet updates, notifications, etc.
 */
const getUserRoom = (userId) => `user:${userId}`;

/**
 * Global room every connected socket joins. Used for broadcasts that any
 * client may care about regardless of role/screen, e.g. vendor open/closed
 * status changes for browse lists.
 */
const getVendorsBroadcastRoom = () => 'vendors:broadcast';

/**
 * Room joined only by ADMIN-role sockets (the admin dashboard).
 */
const getAdminRoom = () => 'admin:dashboard';

/**
 * Room for a single chat conversation. Both parties join this while the
 * thread is open on screen, for live message delivery + typing indicators.
 */
const getConversationRoom = (conversationId) => `chat:${conversationId}`;

module.exports = {
  CONNECTION,
  ORDER,
  VENDOR,
  NOTIFICATION,
  CHAT,
  REQUEST,
  getOrderRoom,
  getVendorRoom,
  getUserRoom,
  getVendorsBroadcastRoom,
  getAdminRoom,
  getConversationRoom,
};

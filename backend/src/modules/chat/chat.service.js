/**
 * Chat service - buyer<->vendor conversations, the chat-commerce core surface
 * (see ContactVendorSheet in the mobile app: browse, then negotiate directly
 * with the vendor by phone or chat).
 *
 * A Conversation is keyed by (customerId, vendorId) - one persistent thread
 * per pair, reused across every product the customer asks about. This is
 * deliberately NOT scoped to an Order - contrast with order.service's
 * OrderMessage thread, which is post-purchase logistics chat tied to one
 * specific order and already existed before this module.
 *
 * All cross-cutting concerns reuse platform infrastructure:
 *   - prisma           <- config/database
 *   - AppError         <- utils/api-error
 *   - logger           <- utils/logger
 *   - notifyService     <- services/notify.service (pushAndSocket)
 *   - getIO/CHAT events <- sockets (mirrors order.service's ORDER.MESSAGE_NEW pattern)
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { getIO } = require('../../sockets');
const { CHAT, getConversationRoom, getUserRoom } = require('../../sockets/events');
const notifyService = require('../../services/notify.service');
const { config } = require('../../config');

// ============================================================
// Selects + helpers
// ============================================================

const CONVERSATION_SELECT = {
  id: true,
  customerId: true,
  vendorId: true,
  contextProductId: true,
  contextProductName: true,
  contextProductImage: true,
  lastMessageAt: true,
  lastMessageBody: true,
  lastMessageSenderId: true,
  customerLastReadAt: true,
  vendorLastReadAt: true,
  customerArchived: true,
  vendorArchived: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: { id: true, firstName: true, lastName: true, profilePicture: true, phone: true },
  },
  vendor: {
    select: { id: true, userId: true, name: true, logoUrl: true, phone: true, isOpen: true, isActive: true },
  },
};

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, firstName: true, lastName: true, role: true, profilePicture: true } },
};

/**
 * Server-side guard: every attachment URL must come from our Cloudinary cloud.
 * Mirrors support.service.validateCloudinaryUrls.
 */
const validateAttachmentUrls = (urls = []) => {
  if (!Array.isArray(urls) || urls.length === 0) return;
  const cloudName = (config.CLOUDINARY_CLOUD_NAME || '').trim();
  if (!cloudName) return; // dev mode without Cloudinary - skip
  const expectedPrefix = `https://res.cloudinary.com/${cloudName}/`;
  for (const url of urls) {
    if (typeof url !== 'string' || !url.startsWith(expectedPrefix)) {
      throw AppError.badRequest('Invalid attachment URL - upload via the in-app flow.', {
        code: 'INVALID_ATTACHMENT_URL',
      });
    }
  }
};

const getViewerVendor = (userId) =>
  prisma.vendor.findUnique({ where: { userId }, select: { id: true, userId: true, name: true, isActive: true } });

/**
 * Shape a raw Conversation row for the given viewer side. Strips the fields
 * that only make sense from the other side's perspective and computes the
 * derived `unread`/`lastMessageIsMine` flags client-side would otherwise have
 * to reconstruct from four separate timestamp fields.
 */
const decorateConversation = (c, side) => {
  const isVendorSide = side === 'vendor';
  const myLastReadAt = isVendorSide ? c.vendorLastReadAt : c.customerLastReadAt;
  const lastSenderIsMe =
    !!c.lastMessageSenderId &&
    (isVendorSide ? c.lastMessageSenderId === c.vendor?.userId : c.lastMessageSenderId === c.customerId);
  const unread =
    !!c.lastMessageAt && !lastSenderIsMe && (!myLastReadAt || new Date(myLastReadAt) < new Date(c.lastMessageAt));

  return {
    id: c.id,
    vendor: c.vendor
      ? {
          id: c.vendor.id,
          name: c.vendor.name,
          logoUrl: c.vendor.logoUrl,
          phone: c.vendor.phone,
          isOpen: c.vendor.isOpen,
        }
      : null,
    // Only meaningful (and only sent) on the vendor's own view of the thread.
    ...(isVendorSide && c.customer
      ? {
          customer: {
            id: c.customer.id,
            firstName: c.customer.firstName,
            lastName: c.customer.lastName,
            profilePicture: c.customer.profilePicture,
            phone: c.customer.phone,
          },
        }
      : {}),
    contextProductId: c.contextProductId,
    contextProductName: c.contextProductName,
    contextProductImage: c.contextProductImage,
    lastMessageAt: c.lastMessageAt,
    lastMessageBody: c.lastMessageBody,
    lastMessageIsMine: lastSenderIsMe,
    unread,
    // The COUNTERPARTY's read cursor - lets the thread UI show a "seen" tick
    // under my own last message. My own cursor isn't useful to expose (I
    // already know what I've read).
    otherLastReadAt: isVendorSide ? c.customerLastReadAt : c.vendorLastReadAt,
    archived: isVendorSide ? c.vendorArchived : c.customerArchived,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

/**
 * Authorize + classify the viewer's side on a conversation.
 * Returns { conversation (raw row), side: 'customer' | 'vendor' | 'admin' }.
 */
const assertParticipant = async (conversationId, userId, role) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: CONVERSATION_SELECT,
  });
  if (!conversation) throw AppError.notFound('Conversation not found');

  if (conversation.customerId === userId) return { conversation, side: 'customer' };
  if (conversation.vendor?.userId === userId) return { conversation, side: 'vendor' };
  if (role === 'ADMIN') return { conversation, side: 'admin' };
  throw AppError.forbidden('You do not have access to this conversation');
};

// ============================================================
// Public API
// ============================================================

/**
 * Find or create the (customer, vendor) conversation. Customer-initiated
 * only - vendors reply on threads a customer started, matching the "browse
 * then message the vendor" flow. Reopens a thread the customer had archived
 * and refreshes the product-context chip when reached from a different
 * product page than last time.
 */
const startConversation = async (customerId, data) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: data.vendorId },
    select: { id: true, name: true, isActive: true, userId: true },
  });
  if (!vendor) throw AppError.notFound('Vendor not found');
  if (!vendor.isActive) throw AppError.badRequest('This vendor is not currently active', { code: 'VENDOR_INACTIVE' });

  const existing = await prisma.conversation.findUnique({
    where: { customerId_vendorId: { customerId, vendorId: data.vendorId } },
    select: CONVERSATION_SELECT,
  });

  if (existing) {
    const contextChanged = data.productId && data.productId !== existing.contextProductId;
    if (!existing.customerArchived && !contextChanged) {
      return decorateConversation(existing, 'customer');
    }
    const updated = await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        customerArchived: false,
        ...(contextChanged && {
          contextProductId: data.productId,
          contextProductName: data.productName || null,
          contextProductImage: data.productImage || null,
        }),
      },
      select: CONVERSATION_SELECT,
    });
    return decorateConversation(updated, 'customer');
  }

  const created = await prisma.conversation.create({
    data: {
      customerId,
      vendorId: data.vendorId,
      // Treat creation as the thread's own timeline event so a brand-new,
      // still-empty conversation sorts correctly in the list instead of
      // needing null-handling in ORDER BY.
      lastMessageAt: new Date(),
      contextProductId: data.productId || null,
      contextProductName: data.productName || null,
      contextProductImage: data.productImage || null,
    },
    select: CONVERSATION_SELECT,
  });

  logger.info('chat.conversation.created', { conversationId: created.id, customerId, vendorId: data.vendorId });

  // Tell the vendor a new customer has opened a thread. Previously the row was
  // created silently and the vendor only found out if/when a message arrived.
  if (vendor.userId) {
    const customerName =
      `${created.customer?.firstName || ''} ${created.customer?.lastName || ''}`.trim() || 'A customer';
    const product = created.contextProductName ? ` about ${created.contextProductName}` : '';
    notifyService
      .pushAndSocket(vendor.userId, {
        type: 'CHAT',
        title: 'New customer chat',
        body: `${customerName} started a chat${product}.`,
        data: { route: `/messages/${created.id}`, kind: 'chat', conversationId: created.id, audience: 'vendor' },
      })
      .catch((err) => logger.warn('chat.startConversation notify failed', {
        conversationId: created.id,
        error: err.message,
      }));
  }

  return decorateConversation(created, 'customer');
};

/**
 * Resolve which side of the marketplace the caller is browsing.
 *
 * A unified account can be customer + vendor at once, so scalar `role` alone
 * is ambiguous (an enrolled vendor often keeps role CUSTOMER). Clients that
 * care (the vendor dashboard) send `side`; otherwise we fall back to the
 * legacy role-based behaviour. `vendor` is only non-null on the vendor side.
 */
const resolveChatSide = async (userId, role, side) => {
  const viewerVendor = await getViewerVendor(userId);
  let isVendorSide;
  if (side === 'vendor') isVendorSide = !!viewerVendor;
  else if (side === 'customer') isVendorSide = false;
  else isVendorSide = role === 'VENDOR';
  return { isVendorSide, vendor: isVendorSide ? viewerVendor : null };
};

/**
 * List the caller's conversations (customer lens or vendor lens, whichever
 * side they're on).
 */
const listConversations = async (userId, role, { cursor, limit, archived, side }) => {
  const { isVendorSide, vendor } = await resolveChatSide(userId, role, side);

  // Explicit vendor side but no vendor profile: nothing to show (and never
  // fall back to the customer inbox, which has a different shape).
  if (side === 'vendor' && !vendor) return [];

  const wantArchived = archived === 'true';

  const where = isVendorSide
    ? { vendorId: vendor.id, vendorArchived: wantArchived }
    : { customerId: userId, customerArchived: wantArchived };

  if (cursor) where.lastMessageAt = { lt: new Date(cursor) };

  const take = Math.min(Math.max(limit || 20, 1), 100);
  const conversations = await prisma.conversation.findMany({
    where,
    select: CONVERSATION_SELECT,
    orderBy: { lastMessageAt: 'desc' },
    take,
  });

  return conversations.map((c) => decorateConversation(c, isVendorSide ? 'vendor' : 'customer'));
};

/**
 * Total unread-conversation count for the caller (Chats tab badge).
 * Scoped to the caller's own (typically small) conversation set, so an
 * in-memory pass over the read cursors is cheap - the alternative is a raw
 * SQL CASE expression for one badge number.
 */
const getUnreadCount = async (userId, role, side) => {
  const { isVendorSide, vendor } = await resolveChatSide(userId, role, side);
  if (side === 'vendor' && !vendor) return { count: 0 };

  const where = isVendorSide
    ? { vendorId: vendor.id, vendorArchived: false }
    : { customerId: userId, customerArchived: false };

  const rows = await prisma.conversation.findMany({
    where: { ...where, lastMessageSenderId: { not: null } },
    select: {
      lastMessageAt: true,
      lastMessageSenderId: true,
      customerLastReadAt: true,
      vendorLastReadAt: true,
      customerId: true,
      vendor: { select: { userId: true } },
    },
  });

  const count = rows.filter((c) => {
    const lastSenderIsMe = isVendorSide
      ? c.lastMessageSenderId === c.vendor?.userId
      : c.lastMessageSenderId === c.customerId;
    if (lastSenderIsMe) return false;
    const myLastReadAt = isVendorSide ? c.vendorLastReadAt : c.customerLastReadAt;
    return !myLastReadAt || new Date(myLastReadAt) < new Date(c.lastMessageAt);
  }).length;

  return { count };
};

const getConversationById = async (conversationId, userId, role) => {
  const { conversation, side } = await assertParticipant(conversationId, userId, role);
  return decorateConversation(conversation, side === 'admin' ? 'customer' : side);
};

const listMessages = async (conversationId, userId, role, { before, limit }) => {
  await assertParticipant(conversationId, userId, role);

  const where = { conversationId };
  if (before) where.createdAt = { lt: new Date(before) };

  const messages = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit || 30, 1), 100),
    include: MESSAGE_INCLUDE,
  });
  return messages.reverse(); // chronological ASC for client rendering
};

const postMessage = async (conversationId, userId, role, data) => {
  validateAttachmentUrls(data.attachmentUrls);

  const { conversation, side } = await assertParticipant(conversationId, userId, role);
  if (side === 'admin') throw AppError.forbidden('Admins cannot post chat messages');

  const body = (data.body || '').trim();
  const attachmentUrls = data.attachmentUrls || [];
  const now = new Date();
  const isCustomer = side === 'customer';

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: { conversationId, senderId: userId, body, attachmentUrls },
      include: MESSAGE_INCLUDE,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        lastMessageBody: body || (attachmentUrls.length ? 'Sent a photo' : ''),
        lastMessageSenderId: userId,
        // Sending marks the thread read on the sender's own side, and
        // un-archives it on the RECIPIENT's side - a new message should
        // always resurface a thread the other party had hidden.
        ...(isCustomer ? { customerLastReadAt: now, vendorArchived: false } : { vendorLastReadAt: now, customerArchived: false }),
      },
    }),
  ]);

  const io = getIO();
  io.to(getConversationRoom(conversationId)).emit(CHAT.MESSAGE_NEW, { conversationId, message });

  // Nudge the recipient's personal room so their Chats list / tab badge
  // updates live even when they aren't inside this thread right now.
  const recipientId = isCustomer ? conversation.vendor?.userId : conversation.customerId;
  if (recipientId) {
    io.to(getUserRoom(recipientId)).emit(CHAT.CONVERSATION_UPDATED, {
      conversationId,
      lastMessageAt: now,
      lastMessageBody: message.body,
      lastMessageIsMine: false,
    });

    const senderName = isCustomer
      ? `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || 'New message'
      : conversation.vendor?.name || 'Vendor';
    const preview =
      message.body?.length > 0
        ? message.body.length > 80
          ? `${message.body.slice(0, 80)}…`
          : message.body
        : 'Sent a photo';
    // Vendor-dashboard and customer-app routes diverge - each app's socket
    // listener + notification tap-through resolves its own half.
    const route = isCustomer ? `/messages/${conversationId}` : `/chat/${conversationId}`;

    notifyService
      .pushAndSocket(recipientId, {
        type: 'CHAT',
        title: senderName,
        body: preview,
        data: { route, kind: 'chat', conversationId, audience: isCustomer ? 'vendor' : 'customer' },
      })
      .catch((err) => logger.warn('chat.postMessage notify failed', { recipientId, error: err.message }));
  }

  return message;
};

const markRead = async (conversationId, userId, role) => {
  const { side } = await assertParticipant(conversationId, userId, role);
  if (side === 'admin') return { id: conversationId };

  const now = new Date();
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: side === 'customer' ? { customerLastReadAt: now } : { vendorLastReadAt: now },
    select: CONVERSATION_SELECT,
  });

  // Live read-receipt tick for whoever's watching the thread right now.
  const io = getIO();
  io.to(getConversationRoom(conversationId)).emit(CHAT.READ, { conversationId, side, readAt: now });

  return decorateConversation(updated, side);
};

const setArchived = async (conversationId, userId, role, archived) => {
  const { side } = await assertParticipant(conversationId, userId, role);
  if (side === 'admin') throw AppError.badRequest('Not applicable to admin viewers');

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: side === 'customer' ? { customerArchived: archived } : { vendorArchived: archived },
    select: CONVERSATION_SELECT,
  });
  return decorateConversation(updated, side);
};

// ============================================================
// Admin oversight (used through the /admin/chats namespace)
// ============================================================

const ADMIN_CONVERSATION_SELECT = {
  ...CONVERSATION_SELECT,
  _count: { select: { messages: true } },
};

/**
 * Admin: paginated view of EVERY buyer<->vendor conversation on the platform
 * (including archived threads), with optional vendor/customer/context filters.
 * This is the oversight surface the vendor and customer lenses can't reach.
 */
const listAllConversations = async ({ page = 1, limit = 20, search, vendorId, customerId } = {}) => {
  const where = {
    ...(vendorId && { vendorId }),
    ...(customerId && { customerId }),
    ...(search && {
      OR: [
        { vendor: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { customer: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
        { customer: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        { customer: { is: { phone: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      select: ADMIN_CONVERSATION_SELECT,
      orderBy: { lastMessageAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  // Admin sees BOTH sides of every thread, unlike the player lenses which
  // strip the counterparty's profile.
  const rows = conversations.map((c) => ({
    id: c.id,
    customer: c.customer
      ? {
          id: c.customer.id,
          firstName: c.customer.firstName,
          lastName: c.customer.lastName,
          profilePicture: c.customer.profilePicture,
          phone: c.customer.phone,
        }
      : null,
    vendor: c.vendor
      ? {
          id: c.vendor.id,
          name: c.vendor.name,
          logoUrl: c.vendor.logoUrl,
          phone: c.vendor.phone,
          isActive: c.vendor.isActive,
          isOpen: c.vendor.isOpen,
        }
      : null,
    contextProductId: c.contextProductId,
    contextProductName: c.contextProductName,
    contextProductImage: c.contextProductImage,
    lastMessageAt: c.lastMessageAt,
    lastMessageBody: c.lastMessageBody,
    lastMessageSenderId: c.lastMessageSenderId,
    messageCount: c._count.messages,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  return { conversations: rows, total, page, limit };
};

/**
 * Admin: same thread detail as the participants see, keeping both sides'
 * profile blocks (the participant lenses drop the other party).
 */
const adminGetConversation = async (conversationId, userId, role) => {
  const { conversation, side } = await assertParticipant(conversationId, userId, role);
  const count = await prisma.chatMessage.count({ where: { conversationId } });
  return {
    ...decorateConversation(conversation, side === 'admin' ? 'customer' : side),
    customer: conversation.customer
      ? {
          id: conversation.customer.id,
          firstName: conversation.customer.firstName,
          lastName: conversation.customer.lastName,
          profilePicture: conversation.customer.profilePicture,
          phone: conversation.customer.phone,
        }
      : null,
    vendor: conversation.vendor
      ? {
          id: conversation.vendor.id,
          name: conversation.vendor.name,
          logoUrl: conversation.vendor.logoUrl,
          phone: conversation.vendor.phone,
        }
      : null,
    messageCount: count,
  };
};

/**
 * Admin: delete a chat message for moderation. If the deleted message was the
 * thread's last, refresh the denormalized preview so the list doesn't point at
 * a ghost message.
 */
const deleteMessage = async (conversationId, messageId, userId, role) => {
  if (role !== 'ADMIN') throw AppError.forbidden('Only admins can delete chat messages');

  await assertParticipant(conversationId, userId, role);

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, conversationId },
    select: { id: true, createdAt: true },
  });
  if (!message) throw AppError.notFound('Message not found');

  const [deleted, newest] = await Promise.all([
    prisma.chatMessage.delete({ where: { id: messageId } }),
    prisma.chatMessage.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: { body: true, senderId: true, createdAt: true },
    }),
  ]);

  // If we removed the newest message, roll the conversation preview back to
  // the message before it (or blank the preview entirely).
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: newest ? newest.createdAt : null,
      lastMessageBody: newest ? newest.body : null,
      lastMessageSenderId: newest ? newest.senderId : null,
    },
  });

  return { id: deleted.id };
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
  listAllConversations,
  adminGetConversation,
  deleteMessage,
};

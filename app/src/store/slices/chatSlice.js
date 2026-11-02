/**
 * Chat slice - buyer<->vendor conversations, the chat-commerce core surface
 * (see ContactVendorSheet: browse, then negotiate directly with the vendor
 * by phone or chat).
 *
 * Wiring:
 *  - REST: GET /chats (list), GET /chats/unread-count, POST /chats (start),
 *    GET /chats/:id, GET/POST /chats/:id/messages, POST /chats/:id/read,
 *    PATCH /chats/:id/archive.
 *  - Socket: `chat:message:new` (live-appends to the open thread + updates
 *    the list preview) and `chat:conversation:updated` (updates the list
 *    preview + unread badge for a thread that ISN'T open right now) - see
 *    services/socket.js and the chatBridge subscription wired in AppNavigator.
 *
 * Patterns mirror supportSlice.js (envelope-unwrapping HTTP, idempotency key
 * on conversation creation) and notificationsSlice.js (unread badge kept in
 * sync from both REST and socket).
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { newIdempotencyKey } from '../../services/idempotency';

const MESSAGES_PAGE_SIZE = 30;

// ============================================================
// Conversations list
// ============================================================

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async ({ archived = false } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      // One account can be customer + vendor; the app always browses the
      // customer side, so state it explicitly rather than relying on role.
      params.append('side', 'customer');
      if (archived) params.append('archived', 'true');
      const envelope = await api.get(`/chats?${params.toString()}`);
      return envelope?.data || [];
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load chats');
    }
  },
);

export const fetchChatUnreadCount = createAsyncThunk(
  'chat/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await api.get('/chats/unread-count?side=customer');
      return envelope?.data?.count ?? 0;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to fetch unread count');
    }
  },
);

export const startConversation = createAsyncThunk(
  'chat/startConversation',
  async (data, { rejectWithValue }) => {
    try {
      const envelope = await api.post('/chats', data, {
        headers: { 'Idempotency-Key': newIdempotencyKey() },
      });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue({
        message: error?.message || 'Failed to start chat',
        status: error?.status ?? null,
      });
    }
  },
);

export const setConversationArchived = createAsyncThunk(
  'chat/setConversationArchived',
  async ({ conversationId, archived }, { rejectWithValue }) => {
    try {
      await api.patch(`/chats/${conversationId}/archive`, { archived });
      return { conversationId, archived };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to update chat');
    }
  },
);

// ============================================================
// Active thread
// ============================================================

export const fetchConversationDetail = createAsyncThunk(
  'chat/fetchConversationDetail',
  async (conversationId, { rejectWithValue }) => {
    try {
      const envelope = await api.get(`/chats/${conversationId}`);
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load chat');
    }
  },
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ conversationId, before } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (before) params.append('before', before);
      params.append('limit', String(MESSAGES_PAGE_SIZE));
      const envelope = await api.get(`/chats/${conversationId}/messages?${params.toString()}`);
      return { before, messages: envelope?.data || [] };
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to load messages');
    }
  },
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, body, attachmentUrls = [] }, { rejectWithValue }) => {
    try {
      const envelope = await api.post(`/chats/${conversationId}/messages`, { body, attachmentUrls });
      return envelope?.data;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to send message');
    }
  },
);

export const markConversationRead = createAsyncThunk(
  'chat/markConversationRead',
  async (conversationId, { rejectWithValue }) => {
    try {
      await api.post(`/chats/${conversationId}/read`);
      return conversationId;
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to mark as read');
    }
  },
);

// ============================================================
// Slice
// ============================================================

const initialState = {
  conversations: [],
  conversationsLoading: false,
  conversationsError: null,
  unreadCount: 0,

  activeConversationId: null, // which thread is "open" right now - gates live-append vs. badge-bump
  activeConversation: null,
  activeMessages: [],
  activeLoading: false,
  loadingMoreMessages: false,
  hasMoreMessages: true,
  sending: false,
};

const upsertConversationPreview = (state, conversationId, patch) => {
  const idx = state.conversations.findIndex((c) => c.id === conversationId);
  if (idx === -1) return false;
  state.conversations[idx] = { ...state.conversations[idx], ...patch };
  return true;
};

const resortByLastMessage = (state) => {
  state.conversations.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveConversationId(state, action) {
      state.activeConversationId = action.payload || null;
    },
    clearActiveConversation(state) {
      state.activeConversationId = null;
      state.activeConversation = null;
      state.activeMessages = [];
      state.hasMoreMessages = true;
    },
    // Bridged from socket `chat:message:new` - only reaches sockets that
    // joined this conversation's room, i.e. someone with the thread open.
    chatMessageReceived(state, action) {
      const { conversationId, message, isMine } = action.payload;
      const preview = message.body?.trim()
        ? message.body
        : Array.isArray(message.attachmentUrls) && message.attachmentUrls.length
          ? 'Sent a photo'
          : '';

      const existed = upsertConversationPreview(state, conversationId, {
        lastMessageAt: message.createdAt,
        lastMessageBody: preview,
        lastMessageIsMine: isMine,
        unread: !isMine && state.activeConversationId !== conversationId,
      });
      if (existed) resortByLastMessage(state);

      if (state.activeConversationId === conversationId) {
        if (!state.activeMessages.find((m) => m.id === message.id)) {
          state.activeMessages.push(message);
        }
      } else if (!isMine && existed) {
        state.unreadCount += 1;
      }
    },
    // Bridged from socket `chat:conversation:updated` - reaches the
    // recipient's personal room regardless of whether the thread is open, so
    // the Chats LIST screen (not inside any thread) still updates live.
    chatConversationUpdated(state, action) {
      const { conversationId, lastMessageAt, lastMessageBody } = action.payload;
      const isActive = state.activeConversationId === conversationId;
      const existed = upsertConversationPreview(state, conversationId, {
        lastMessageAt,
        lastMessageBody,
        lastMessageIsMine: false,
        unread: !isActive,
      });
      if (existed) {
        resortByLastMessage(state);
        if (!isActive) state.unreadCount += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // --- list ---
      .addCase(fetchConversations.pending, (state) => {
        state.conversationsLoading = true;
        state.conversationsError = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.conversationsLoading = false;
        state.conversationsError = action.payload || 'Failed to load chats';
      })

      .addCase(fetchChatUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })

      .addCase(startConversation.fulfilled, (state, action) => {
        const conv = action.payload;
        if (!conv) return;
        const idx = state.conversations.findIndex((c) => c.id === conv.id);
        if (idx === -1) state.conversations.unshift(conv);
        else state.conversations[idx] = conv;
      })

      .addCase(setConversationArchived.fulfilled, (state, action) => {
        state.conversations = state.conversations.filter((c) => c.id !== action.payload.conversationId);
      })

      // --- active thread ---
      .addCase(fetchConversationDetail.pending, (state) => {
        state.activeLoading = true;
      })
      .addCase(fetchConversationDetail.fulfilled, (state, action) => {
        state.activeLoading = false;
        state.activeConversation = action.payload;
      })
      .addCase(fetchConversationDetail.rejected, (state) => {
        state.activeLoading = false;
      })

      .addCase(fetchMessages.pending, (state, action) => {
        if (action.meta.arg?.before) state.loadingMoreMessages = true;
        else state.activeLoading = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.activeLoading = false;
        state.loadingMoreMessages = false;
        const { before, messages } = action.payload;
        state.hasMoreMessages = messages.length >= MESSAGES_PAGE_SIZE;
        if (!before) {
          state.activeMessages = messages;
        } else {
          const seen = new Set(state.activeMessages.map((m) => m.id));
          state.activeMessages = [...messages.filter((m) => !seen.has(m.id)), ...state.activeMessages];
        }
      })
      .addCase(fetchMessages.rejected, (state) => {
        state.activeLoading = false;
        state.loadingMoreMessages = false;
      })

      .addCase(sendMessage.pending, (state) => {
        state.sending = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false;
        const message = action.payload;
        if (!message) return;
        if (!state.activeMessages.find((m) => m.id === message.id)) {
          state.activeMessages.push(message);
        }
        const preview = message.body?.trim()
          ? message.body
          : Array.isArray(message.attachmentUrls) && message.attachmentUrls.length
            ? 'Sent a photo'
            : '';
        const existed = upsertConversationPreview(state, message.conversationId || state.activeConversationId, {
          lastMessageAt: message.createdAt,
          lastMessageBody: preview,
          lastMessageIsMine: true,
          unread: false,
        });
        if (existed) resortByLastMessage(state);
      })
      .addCase(sendMessage.rejected, (state) => {
        state.sending = false;
      })

      .addCase(markConversationRead.fulfilled, (state, action) => {
        const conversationId = action.payload;
        const conv = state.conversations.find((c) => c.id === conversationId);
        if (conv?.unread) {
          conv.unread = false;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });
  },
});

export const { setActiveConversationId, clearActiveConversation, chatMessageReceived, chatConversationUpdated } =
  chatSlice.actions;
export default chatSlice.reducer;

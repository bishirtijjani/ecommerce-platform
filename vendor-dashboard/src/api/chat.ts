import api from './client';
import type { ChatMessage, Conversation } from '../types';

/** Random-enough key for the idempotency header - matches the customer app's newIdempotencyKey(). */
const idemKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// This dashboard always browses the VENDOR side. Declaring it explicitly is
// required because one account can be customer + vendor at once, so the
// backend can't infer the side from the scalar role.
export const listConversations = (params: { archived?: boolean } = {}) =>
  api
    .get<unknown, { data: Conversation[] }>('/chats', {
      params: { side: 'vendor', ...(params.archived ? { archived: 'true' } : {}) },
    })
    .then((r) => r.data);

export const getChatUnreadCount = () =>
  api.get<unknown, { data: { count: number } }>('/chats/unread-count', { params: { side: 'vendor' } }).then((r) => r.data.count);

export const getConversation = (conversationId: string) =>
  api.get<unknown, { data: Conversation }>(`/chats/${conversationId}`).then((r) => r.data);

export const listChatMessages = (conversationId: string, before?: string) =>
  api
    .get<unknown, { data: ChatMessage[] }>(`/chats/${conversationId}/messages`, { params: before ? { before } : undefined })
    .then((r) => r.data);

export const sendChatMessage = (conversationId: string, body: string, attachmentUrls: string[] = []) =>
  api
    .post<unknown, { data: ChatMessage }>(
      `/chats/${conversationId}/messages`,
      { body, attachmentUrls },
      { headers: { 'Idempotency-Key': idemKey() } },
    )
    .then((r) => r.data);

export const markConversationRead = (conversationId: string) =>
  api.post<unknown, { data: Conversation }>(`/chats/${conversationId}/read`).then((r) => r.data);

export const setConversationArchived = (conversationId: string, archived: boolean) =>
  api.patch<unknown, { data: Conversation }>(`/chats/${conversationId}/archive`, { archived }).then((r) => r.data);

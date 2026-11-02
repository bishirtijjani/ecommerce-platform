import api from './client';
import type { ApiResponse } from './client';
import type { Paginated, ChatConversation, ChatMessage } from '../types';

export interface ChatListParams {
  page?: number;
  limit?: number;
  search?: string;
  vendorId?: string;
  customerId?: string;
}

export const listConversations = (params: ChatListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<ChatConversation>>('/admin/chats', { params, signal }).then((r) => r);

export const getConversation = (id: string, signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<ChatConversation>>(`/admin/chats/${id}`, { signal }).then((r) => r.data);

export const getConversationMessages = (id: string, signal?: AbortSignal) =>
  api.get<unknown, ApiResponse<ChatMessage[]>>(`/admin/chats/${id}/messages`, { signal }).then((r) => r.data);

export const deleteMessage = (conversationId: string, messageId: string) =>
  api
    .delete<unknown, ApiResponse<{ success: boolean }>>(`/admin/chats/${conversationId}/messages/${messageId}`)
    .then((r) => r.data);
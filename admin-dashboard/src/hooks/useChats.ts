import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listConversations,
  getConversation,
  getConversationMessages,
  deleteMessage,
  type ChatListParams,
} from '../api/chats';
import type { ApiError } from '../api/client';

export const useChats = (params: ChatListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'chats', params],
    queryFn: ({ signal }) => listConversations(params, signal),
    placeholderData: (prev) => prev,
  });

export const useConversation = (id: string) =>
  useQuery({ queryKey: ['admin', 'chats', id], queryFn: ({ signal }) => getConversation(id, signal), enabled: !!id });

export const useConversationMessages = (id: string) =>
  useQuery({ queryKey: ['admin', 'chats', id, 'messages'], queryFn: ({ signal }) => getConversationMessages(id, signal), enabled: !!id });

export const useDeleteChatMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      deleteMessage(conversationId, messageId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'chats'] });
      qc.invalidateQueries({ queryKey: ['admin', 'chats', vars.conversationId] });
      qc.invalidateQueries({ queryKey: ['admin', 'chats', vars.conversationId, 'messages'] });
      toast.success('Message deleted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import {
  listConversations, getChatUnreadCount, getConversation, listChatMessages,
  sendChatMessage, markConversationRead, setConversationArchived,
} from '../api/chat';
import { chatSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import type { ApiError } from '../api/client';
import type { ChatMessage } from '../types';

const MESSAGES_PAGE_SIZE = 30;

export const useConversations = (archived = false) =>
  useQuery({
    queryKey: ['conversations', archived],
    queryFn: () => listConversations({ archived }),
    refetchInterval: 20_000, // safety net alongside the socket bridge below
  });

export const useChatUnreadCount = () =>
  useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: getChatUnreadCount,
    refetchInterval: 20_000,
  });

export const useConversation = (conversationId: string | undefined) =>
  useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId as string),
    enabled: !!conversationId,
  });

/**
 * Message history, oldest-first. Each fetched page from the API is already
 * chronological ASC; react-query appends new pages to the END of
 * `data.pages` as `fetchNextPage()` (older messages) is called, so consumers
 * must reverse `data.pages` before flattening to get a top(oldest)->bottom
 * (newest) render order. `pages[0]` is always the newest chunk - that's
 * where a freshly sent/received message gets appended (see
 * useSendChatMessage / useChatSocketBridge below).
 */
export const useConversationMessages = (conversationId: string | undefined) =>
  useInfiniteQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: ({ pageParam }) => listChatMessages(conversationId as string, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.length >= MESSAGES_PAGE_SIZE ? lastPage[0]?.createdAt : undefined),
    enabled: !!conversationId,
  });

const appendToNewestPage = (
  qc: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: ChatMessage,
) => {
  qc.setQueryData<InfiniteData<ChatMessage[]>>(['chat-messages', conversationId], (old) => {
    if (!old) return old;
    const pages = [...old.pages];
    const newest = pages[0] || [];
    if (newest.some((m) => m.id === message.id)) return old;
    pages[0] = [...newest, message];
    return { ...old, pages };
  });
};

export const useSendChatMessage = (conversationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, attachmentUrls = [] }: { body: string; attachmentUrls?: string[] }) =>
      sendChatMessage(conversationId, body, attachmentUrls),
    onSuccess: (message) => {
      appendToNewestPage(qc, conversationId, message);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useMarkConversationRead = (conversationId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markConversationRead(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-unread-count'] });
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },
  });
};

export const useSetConversationArchived = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, archived }: { conversationId: string; archived: boolean }) =>
      setConversationArchived(conversationId, archived),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(i18n.t('toasts.conversationUpdated'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

/**
 * Connects the chat socket for the lifetime of an authenticated session and
 * keeps the react-query caches (conversations list, unread badge, open
 * thread) in sync with live events. Mount ONCE near the app root (AppShell) -
 * per-thread concerns (typing indicator, read receipts, room join/leave)
 * live in Messages.tsx instead, scoped to whichever conversation is open.
 */
export const useChatSocketBridge = () => {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!isAuthenticated) {
      chatSocket.disconnect();
      return undefined;
    }
    chatSocket.connect();

    const offMessage = chatSocket.on('chatMessageNew', (data) => {
      const { conversationId, message } = data as { conversationId: string; message: ChatMessage };
      if (!conversationId || !message) return;
      appendToNewestPage(qc, conversationId, message);
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (message.senderId !== userIdRef.current) {
        qc.invalidateQueries({ queryKey: ['chat-unread-count'] });
      }
    });

    const offConversationUpdated = chatSocket.on('chatConversationUpdated', () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['chat-unread-count'] });
    });

    return () => {
      offMessage();
      offConversationUpdated();
    };
  }, [isAuthenticated, qc]);
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import {
  listRequestInbox, getRequest, respondToRequest, declineRequest, markInboxSeen,
  type RespondToRequestInput,
} from '../api/requests';
import type { ApiError } from '../api/client';

export const useRequestInbox = (params: { seen?: 'true' | 'false'; page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: ['request-inbox', params],
    queryFn: () => listRequestInbox(params),
    refetchInterval: 20_000,
    placeholderData: (prev) => prev,
  });

export const useRequestUnreadCount = () =>
  useQuery({
    queryKey: ['request-unread-count'],
    queryFn: () => listRequestInbox({ seen: 'false', limit: 1 }),
    refetchInterval: 20_000,
    select: (page) => page.unseenCount,
  });

export const useRequest = (requestId: string | undefined) =>
  useQuery({
    queryKey: ['request', requestId],
    queryFn: () => getRequest(requestId as string),
    enabled: !!requestId,
  });

const invalidateRequests = (qc: ReturnType<typeof useQueryClient>, requestId?: string) => {
  qc.invalidateQueries({ queryKey: ['request-inbox'] });
  qc.invalidateQueries({ queryKey: ['request-unread-count'] });
  if (requestId) qc.invalidateQueries({ queryKey: ['request', requestId] });
};

export const useRespondToRequest = (requestId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RespondToRequestInput) => respondToRequest(requestId, payload),
    onSuccess: () => {
      invalidateRequests(qc, requestId);
      toast.success(i18n.t('toasts.responseSent'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDeclineRequest = (requestId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => declineRequest(requestId),
    onSuccess: () => {
      invalidateRequests(qc, requestId);
      toast.success(i18n.t('toasts.requestDeclined'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useMarkInboxSeen = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markInboxSeen(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['request-inbox'] });
      qc.invalidateQueries({ queryKey: ['request-unread-count'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

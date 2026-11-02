import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '../i18n';
import { closeTicket, createTicket, getTicket, listTickets, postTicketMessage } from '../api/support';
import type { ApiError } from '../api/client';
import type { CreateTicketInput } from '../types';

export const useTickets = (params: { status?: string; page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: ['support-tickets', params],
    queryFn: () => listTickets(params),
  });

export const useTicket = (ticketId: string | undefined) =>
  useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: () => getTicket(ticketId as string),
    enabled: !!ticketId,
  });

export const useCreateTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTicketInput) => createTicket(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success(i18n.t('toasts.ticketSubmitted'), { description: i18n.t('toasts.ticketSubmittedSub') });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const usePostTicketMessage = (ticketId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, attachmentUrls = [] }: { body: string; attachmentUrls?: string[] }) =>
      postTicketMessage(ticketId, body, attachmentUrls),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useCloseTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => closeTicket(ticketId),
    onSuccess: (_ticket, ticketId) => {
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success(i18n.t('toasts.ticketClosed'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

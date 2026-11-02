import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listTickets,
  getTicket,
  updateTicketStatus,
  assignTicket,
  postTicketMessage,
  listDisputes,
  getDispute,
  resolveDispute,
  postDisputeMessage,
  type TicketListParams,
  type DisputeListParams,
} from '../api/support';
import type { ApiError } from '../api/client';

export const useTickets = (params: TicketListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'support', 'tickets', params],
    queryFn: ({ signal }) => listTickets(params, signal),
    placeholderData: (prev) => prev,
  });

export const useTicket = (id: string) =>
  useQuery({ queryKey: ['admin', 'support', 'tickets', id], queryFn: ({ signal }) => getTicket(id, signal), enabled: !!id });

const invalidateTickets = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['admin', 'support', 'tickets'] });
};

export const useUpdateTicketStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) => updateTicketStatus(id, status, notes),
    onSuccess: () => {
      invalidateTickets(qc);
      toast.success('Ticket status updated');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useAssignTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedToId }: { id: string; assignedToId: string | null }) => assignTicket(id, assignedToId),
    onSuccess: () => {
      invalidateTickets(qc);
      toast.success('Ticket assigned');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const usePostTicketMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, isInternal }: { id: string; body: string; isInternal?: boolean }) => postTicketMessage(id, body, isInternal),
    onSuccess: () => {
      invalidateTickets(qc);
      toast.success('Message posted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const useDisputes = (params: DisputeListParams = {}) =>
  useQuery({
    queryKey: ['admin', 'support', 'disputes', params],
    queryFn: ({ signal }) => listDisputes(params, signal),
    placeholderData: (prev) => prev,
  });

export const useDispute = (id: string) =>
  useQuery({ queryKey: ['admin', 'support', 'disputes', id], queryFn: ({ signal }) => getDispute(id, signal), enabled: !!id });

const invalidateDisputes = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['admin', 'support', 'disputes'] });
};

export const useResolveDispute = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution, resolutionNotes }: { id: string; resolution: string; resolutionNotes?: string }) =>
      resolveDispute(id, resolution, resolutionNotes),
    onSuccess: () => {
      invalidateDisputes(qc);
      toast.success('Dispute resolved');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};

export const usePostDisputeMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, isInternal }: { id: string; body: string; isInternal?: boolean }) => postDisputeMessage(id, body, isInternal),
    onSuccess: () => {
      invalidateDisputes(qc);
      toast.success('Message posted');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });
};
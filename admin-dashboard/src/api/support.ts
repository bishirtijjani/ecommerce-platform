import api from './client';
import type { ApiResponse } from './client';
import type { Paginated, SupportTicket, Dispute } from '../types';

// ============================================================
// Tickets
// ============================================================

export interface TicketListParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority?: string;
  assignedToId?: string;
}

export const listTickets = (params: TicketListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<SupportTicket>>('/admin/support/tickets', { params, signal }).then((r) => r);

export const getTicket = (id: string, signal?: AbortSignal) =>
  api
    .get<unknown, ApiResponse<SupportTicket & { messages?: { id: string; body: string; isInternal: boolean; createdAt: string; fromUser: { id: string; firstName: string; lastName: string; role: string } | null }[] }>>(`/admin/support/tickets/${id}`, { signal })
    .then((r) => r.data);

export const updateTicketStatus = (id: string, status: string, notes?: string) =>
  api.patch<unknown, ApiResponse<SupportTicket>>(`/admin/support/tickets/${id}/status`, { status, notes }).then((r) => r.data);

export const assignTicket = (id: string, assignedToId: string | null) =>
  api.patch<unknown, ApiResponse<SupportTicket>>(`/admin/support/tickets/${id}/assign`, { assignedToId }).then((r) => r.data);

export const postTicketMessage = (id: string, body: string, isInternal = false) =>
  api.post<unknown, ApiResponse<SupportTicket>>(`/admin/support/tickets/${id}/messages`, { body, isInternal }).then((r) => r.data);

// ============================================================
// Disputes
// ============================================================

export interface DisputeListParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
}

export const listDisputes = (params: DisputeListParams = {}, signal?: AbortSignal) =>
  api.get<unknown, Paginated<Dispute>>('/admin/disputes', { params, signal }).then((r) => r);

export const getDispute = (id: string, signal?: AbortSignal) =>
  api
    .get<unknown, ApiResponse<Dispute & { messages?: { id: string; body: string; isInternal: boolean; createdAt: string; fromUser: { id: string; firstName: string; lastName: string; role: string } | null }[] }>>(`/admin/disputes/${id}`, { signal })
    .then((r) => r.data);

export const resolveDispute = (id: string, resolution: string, resolutionNotes?: string) =>
  api.patch<unknown, ApiResponse<Dispute>>(`/admin/disputes/${id}/resolve`, { resolution, resolutionNotes }).then((r) => r.data);

export const postDisputeMessage = (id: string, body: string, isInternal = false) =>
  api.post<unknown, ApiResponse<Dispute>>(`/admin/disputes/${id}/messages`, { body, isInternal }).then((r) => r.data);
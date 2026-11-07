import api from './client';
import type { CreateTicketInput, Paginated, SupportTicket, SupportTicketMessage } from '../types';

/** Random-enough key for the idempotency header - matches the customer app's newIdempotencyKey(). */
const idemKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Support tickets raised by this vendor to the platform team.
 *
 * These hit the shared, role-agnostic `/support/tickets` endpoints (any
 * authenticated user - customer or vendor - owns their own tickets). Replies
 * from the Marketplace team land in the same thread, so this is the vendor's
 * built-in channel to the platform owners.
 */

export const listTickets = (params: { status?: string; page?: number; limit?: number } = {}) =>
  api.get<unknown, Paginated<SupportTicket>>('/support/tickets', { params }).then((r) => r);

export const getTicket = (ticketId: string) =>
  api.get<unknown, { data: SupportTicket }>(`/support/tickets/${ticketId}`).then((r) => r.data);

export const createTicket = (payload: CreateTicketInput) =>
  api
    .post<unknown, { data: SupportTicket }>('/support/tickets', payload, {
      headers: { 'Idempotency-Key': idemKey() },
    })
    .then((r) => r.data);

export const postTicketMessage = (ticketId: string, body: string, attachmentUrls: string[] = []) =>
  api
    .post<unknown, { data: SupportTicketMessage }>(`/support/tickets/${ticketId}/messages`, { body, attachmentUrls })
    .then((r) => r.data);

export const closeTicket = (ticketId: string) =>
  api.patch<unknown, { data: SupportTicket }>(`/support/tickets/${ticketId}/close`).then((r) => r.data);

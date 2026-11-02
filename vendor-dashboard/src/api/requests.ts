import api from './client';
import type { RequestItem, RequestResponse } from '../types';

export interface RequestInboxPage {
  items: RequestItem[];
  unseenCount: number;
  page: number;
  limit: number;
  total: number;
}

export interface RespondToRequestInput {
  message: string;
  price?: number;
  priceNote?: string;
  etaText?: string;
}

export const listRequestInbox = (params: { seen?: 'true' | 'false'; page?: number; limit?: number } = {}) =>
  api.get<unknown, { data: RequestInboxPage }>('/requests/inbox', { params }).then((r) => r.data);

export const getRequest = (requestId: string) =>
  api.get<unknown, { data: RequestItem }>(`/requests/${requestId}`).then((r) => r.data);

export const respondToRequest = (requestId: string, payload: RespondToRequestInput) =>
  api.post<unknown, { data: RequestResponse }>(`/requests/${requestId}/responses`, payload).then((r) => r.data);

export const declineRequest = (requestId: string) =>
  api.post<unknown, { data: { requestId: string; declined: true } }>(`/requests/${requestId}/decline`).then((r) => r.data);

export const markInboxSeen = () =>
  api.post<unknown, { data: { marked: number } }>('/requests/inbox/seen').then((r) => r.data);

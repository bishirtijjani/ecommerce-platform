import api from './client';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { route?: string } | null;
  orderId: string | null;
  readAt: string | null;
  createdAt: string;
}

export const listNotifications = (params: { page?: number; limit?: number } = {}) =>
  api.get<unknown, { data: AppNotification[] }>('/notifications', { params }).then((r) => r.data);

export const getUnreadCount = () =>
  api.get<unknown, { data: { count: number } }>('/notifications/unread-count').then((r) => r.data.count);

export const markRead = (id: string) => api.patch(`/notifications/${id}/read`);
export const markAllRead = () => api.patch('/notifications/read-all');

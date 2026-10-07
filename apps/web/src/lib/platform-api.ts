'use client';

import { api } from './api';

export interface AppNotification {
  id: string;
  type: 'course_assigned' | 'deadline_reminder' | 'result';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  course: { id: string; title: string } | null;
}

export interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: unknown;
  ipAddress: string | null;
  createdAt: string;
  userName: string;
  userUsername: string | null;
}

export async function listNotifications(
  token: string,
  query: { unreadOnly?: boolean; limit?: number } = {},
): Promise<AppNotification[]> {
  const params = new URLSearchParams();
  if (query.unreadOnly) params.set('unreadOnly', 'true');
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();
  return api<AppNotification[]>(`/notifications${qs ? `?${qs}` : ''}`, { token });
}

export async function getUnreadCount(token: string): Promise<number> {
  const result = await api<{ count: number }>('/notifications/unread-count', { token });
  return result.count;
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await api(`/notifications/${id}/read`, { method: 'POST', token });
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await api('/notifications/read-all', { method: 'POST', token });
}

export async function listAuditLogs(
  token: string,
  query: { entityType?: string; limit?: number; offset?: number } = {},
): Promise<{ items: AuditItem[]; total: number }> {
  const params = new URLSearchParams();
  if (query.entityType) params.set('entityType', query.entityType);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.offset !== undefined) params.set('offset', String(query.offset));
  const qs = params.toString();
  return api<{ items: AuditItem[]; total: number }>(`/audit${qs ? `?${qs}` : ''}`, { token });
}

export async function getSettings(
  token: string,
): Promise<Record<string, string>> {
  return api<Record<string, string>>('/settings', { token });
}

export async function updateSettings(
  token: string,
  values: Record<string, string>,
): Promise<Record<string, string>> {
  return api<Record<string, string>>('/settings', {
    method: 'PATCH',
    body: { values },
    token,
  });
}

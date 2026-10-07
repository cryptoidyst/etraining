'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/platform-api';
import { Icon } from './ui';
import { cx } from './utils';

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => getUnreadCount(token!),
    enabled: Boolean(token),
    refetchInterval: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(token!, { limit: 20 }),
    enabled: Boolean(token) && open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(token!, id),
    onSuccess: invalidate,
  });
  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(token!),
    onSuccess: invalidate,
  });

  const unread = countQuery.data ?? 0;
  const items = listQuery.data ?? [];

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="iconbtn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Notifications"
        aria-label="Notifications"
      >
        <Icon name="bell" />
        {unread > 0 && <span className="badge-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-sticky)' as unknown as number }}
            onClick={() => setOpen(false)}
          />
          <div className="dropdown" style={{ zIndex: 'calc(var(--z-sticky) + 1)' as unknown as number }}>
            <div className="dropdown__head">
              <span className="mono">Notifications</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  className="backlink"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="dropdown__list">
              {listQuery.isLoading && <p className="palette__empty">Loading…</p>}
              {!listQuery.isLoading && items.length === 0 && (
                <p className="palette__empty">No notifications.</p>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.isRead) markReadMutation.mutate(n.id);
                  }}
                  className={cx('dropdown__item', !n.isRead && 'is-unread')}
                >
                  <p className="cell-strong" style={{ fontSize: 'var(--text-sm)' }}>
                    {n.title}
                  </p>
                  <p className="text-muted text-sm" style={{ marginTop: 'var(--space-2xs)' }}>
                    {n.message}
                  </p>
                  <p className="mono" style={{ marginTop: 'var(--space-2xs)' }}>
                    {timeAgo(n.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

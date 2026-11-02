import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, getUnreadCount, markRead, markAllRead } from '../../api/notifications';
import { ensurePush } from '../../services/push';
import { formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';
import { EmptyState } from '../ui/EmptyState';

export const NotificationBell = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: unread = 0 } = useQuery({
    queryKey: ['unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
  });

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications({ limit: 8 }),
    enabled: open,
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleItemClick = async (id: string, route?: string) => {
    await markRead(id);
    qc.invalidateQueries({ queryKey: ['unread-count'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    setOpen(false);
    if (route === '/vendor/orders') navigate('/orders');
    else if (route?.startsWith('/order/')) navigate(`/orders/${route.split('/').pop()}`);
    else if (route?.startsWith('/messages/')) navigate(route);
    else if (route?.startsWith('/vendor/orders/')) navigate(route.replace('/vendor', ''));
    else if (route?.startsWith('/vendor/requests/')) navigate(route.replace('/vendor', ''));
    else if (route === '/vendor/requests' || route === '/requests') navigate('/requests');
    else if (route?.startsWith('/requests/')) navigate(route);
    else if (route === '/vendor/dashboard') navigate('/');
    else if (route === '/vendor/shop') navigate('/shop');
    else if (route === '/vendor/settings') navigate('/settings');
    else if (
      route === '/vendor/account/pending' ||
      route === '/vendor/account/rejected' ||
      route === '/vendor/account/suspended'
    ) {
      navigate(route.replace('/vendor', ''));
    } else if (route?.startsWith('/support') || route?.startsWith('/disputes')) {
      navigate('/support');
    } else if (route === '/notifications') navigate('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          // Opening the feed is the natural moment to offer push.
          if (!open) ensurePush('notifications');
          setOpen((v) => !v);
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted hover:text-text-primary"
        aria-label={t('notifications.title')}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error ring-2 ring-bg-surface" />
        )}
      </button>
      {open && (
        <div className="fixed right-4 top-16 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-bg-surface shadow-popover animate-slide-up sm:absolute sm:right-0 sm:top-11">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-text-primary">{t('notifications.title')}</p>
            {unread > 0 && (
              <button
                className="text-xs font-medium text-brand hover:text-brand-strong"
                onClick={async () => {
                  await markAllRead();
                  qc.invalidateQueries({ queryKey: ['unread-count'] });
                  qc.invalidateQueries({ queryKey: ['notifications'] });
                }}
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data?.length ? (
              data.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n.id, n.data?.route)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-bg-muted',
                    !n.readAt && 'bg-brand-soft/40',
                  )}
                >
                  <p className="text-sm font-medium text-text-primary">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-text-muted">{n.body}</p>
                  <p className="text-[11px] text-text-placeholder">{formatRelative(n.createdAt)}</p>
                </button>
              ))
            ) : (
              <EmptyState icon={Bell} title={t('notifications.empty')} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

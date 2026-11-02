import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Inbox, MapPin, MessageSquare, Clock3 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { Badge, RequestStatusBadge } from '../../components/ui/Badge';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { useRequestInbox, useMarkInboxSeen } from '../../hooks/useRequests';
import { formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { RequestItem } from '../../types';

const LIMIT = 20;

const RequestRow = ({ item, isNew, onOpen }: { item: RequestItem; isNew: boolean; onOpen: () => void }) => {
  const { t } = useTranslation();
  const responded = !!item.myResponse;
  const category = [item.category?.name, item.subcategory?.name].filter(Boolean).join(' · ');

  return (
    <button
      onClick={onOpen}
      className="flex w-full flex-col gap-2 border-b border-border px-4 py-3.5 text-left last:border-0 hover:bg-bg-muted active:bg-bg-muted sm:px-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('truncate text-sm', isNew ? 'font-bold text-text-primary' : 'font-medium text-text-primary')}>
              {item.title}
            </p>
            {isNew && <Badge tone="brand">{t('requests.new')}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-muted">{category || t('requests.list.uncategorised')}</p>
        </div>
        <RequestStatusBadge status={item.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        {item.distanceKm != null && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {t('requests.kmAway', { km: item.distanceKm.toFixed(1) })}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          {formatRelative(item.createdAt)}
        </span>
        {responded ? (
          <span className="inline-flex items-center gap-1 font-medium text-brand">
            <MessageSquare className="h-3 w-3" />
            {t('requests.youResponded')}
          </span>
        ) : item.responseCount > 0 ? (
          <span>{t('requests.responseCount', { count: item.responseCount })}</span>
        ) : null}
      </div>
    </button>
  );
};

export default function RequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') === 'new' ? 'new' : 'all';
  const page = Number(params.get('page') || 1);

  const { data, isLoading, isError, refetch } = useRequestInbox({
    seen: filter === 'new' ? 'false' : undefined,
    page,
    limit: LIMIT,
  });

  const markSeen = useMarkInboxSeen();
  const [newIds] = useState(() => new Set<string>());
  const capturedRef = useRef(false);

  useEffect(() => {
    if (capturedRef.current || !data) return;
    capturedRef.current = true;
    data.items.forEach((item) => {
      if (!item.seenAt) newIds.add(item.id);
    });
  }, [data, newIds]);

  useEffect(() => {
    markSeen.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || LIMIT))) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{t('nav.requests')}</h1>
        <p className="mt-0.5 text-sm text-text-muted">{t('requests.list.subtitle')}</p>
      </div>

      <Card>
        <Tabs
          items={[
            { key: 'all', label: t('common.all') },
            { key: 'new', label: t('requests.new'), count: data?.unseenCount },
          ]}
          active={filter}
          onChange={(key) => setParams((p) => { p.set('filter', key === 'all' ? '' : key); p.set('page', '1'); return p; })}
        />

        {isLoading ? (
          <PageSpinner />
        ) : isError ? (
          <ErrorState title={t('requests.list.couldntLoad')} onRetry={() => refetch()} />
        ) : items.length ? (
          <div>
            {items.map((item) => (
              <RequestRow
                key={item.id}
                item={item}
                isNew={newIds.has(item.id) || !item.seenAt}
                onOpen={() => navigate(`/requests/${item.id}`)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Inbox}
            title={t('requests.list.emptyTitle')}
            subtitle={filter === 'new' ? t('requests.list.emptyNew') : t('requests.list.emptyAll')}
          />
        )}

        <Pagination
          page={data?.page || page}
          totalPages={totalPages}
          onChange={(p) => setParams((sp) => { sp.set('page', String(p)); return sp; })}
        />
      </Card>
    </div>
  );
}

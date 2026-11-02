import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Plus, Search } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { Pagination } from '../../components/ui/Pagination';
import { OrderCard } from '../../components/OrderCard';
import { useVendorOrders } from '../../hooks/useOrders';
import { formatNaira, formatDateTime } from '../../lib/format';
import { LogOrderModal } from './LogOrderModal';

const TABS = [
  { key: '' },
  { key: 'PENDING' },
  { key: 'PROCESSING' },
  { key: 'SHIPPED' },
  { key: 'DELIVERED' },
  { key: 'CANCELLED' },
];

export default function OrdersList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const page = Number(params.get('page') || 1);
  const [search, setSearch] = useState('');
  const [logOrderOpen, setLogOrderOpen] = useState(params.get('logOrder') === '1');

  const { data, isLoading } = useVendorOrders({ status: status || undefined, page, limit: 20 });

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    if (!search.trim()) return data.data;
    const q = search.toLowerCase();
    return data.data.filter((o) => `${o.customer?.firstName} ${o.customer?.lastName} ${o.customer?.phone}`.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('nav.orders')}</h1>
          <p className="mt-0.5 text-sm text-text-muted">{t('orders.list.subtitle')}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setLogOrderOpen(true)}>
          {t('orders.logNew')}
        </Button>
      </div>

      <Card>
        <Tabs
          items={TABS.map((tab) => ({ ...tab, label: tab.key ? t(`status.order.${tab.key}`) : t('common.all') }))}
          active={status}
          onChange={(key) => setParams((p) => { p.set('status', key); p.set('page', '1'); return p; })}
        />
        <div className="border-b border-border p-4">
          <Input
            placeholder={t('orders.list.searchPlaceholder')}
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {isLoading ? (
          <PageSpinner />
        ) : filtered.length ? (
          <>
            <div className="divide-y divide-border md:hidden">
              {filtered.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    <th className="px-5 py-2.5">{t('table.customer')}</th>
                    <th className="px-5 py-2.5">{t('table.items')}</th>
                    <th className="px-5 py-2.5">{t('table.total')}</th>
                    <th className="px-5 py-2.5">{t('table.status')}</th>
                    <th className="px-5 py-2.5">{t('table.placed')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((order) => (
                    <tr key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="cursor-pointer hover:bg-bg-muted">
                      <td className="px-5 py-3">
                        <p className="font-medium text-text-primary">
                          {order.customer?.firstName} {order.customer?.lastName}
                        </p>
                        <p className="text-xs text-text-muted">{order.customer?.phone}</p>
                      </td>
                      <td className="px-5 py-3 text-text-muted">{order.items.length}</td>
                      <td className="px-5 py-3 font-medium text-text-primary">{formatNaira(order.total)}</td>
                      <td className="px-5 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3 text-text-muted">{formatDateTime(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Package}
            title={t('orders.list.emptyTitle')}
            subtitle={status ? t('orders.list.emptyFiltered', { status: t(`status.order.${status}`).toLowerCase() }) : t('dashboard.noOrdersSub')}
          />
        )}
        {data?.meta && (
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onChange={(p) => setParams((sp) => { sp.set('page', String(p)); return sp; })} />
        )}
      </Card>

      <LogOrderModal open={logOrderOpen} onClose={() => { setLogOrderOpen(false); params.delete('logOrder'); setParams(params); }} />
    </div>
  );
}

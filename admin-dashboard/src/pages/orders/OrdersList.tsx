import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Package } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrders } from '../../hooks/useOrders';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { Badge, OrderStatusBadge } from '../../components/ui/Badge';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { formatNaira, formatDateTime, formatRelative } from '../../lib/format';
import type { OrderSource, OrderStatus } from '../../types';

const ORDER_STATUSES: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const ORDER_SOURCES: { value: OrderSource | ''; label: string }[] = [
  { value: '', label: 'All sources' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'VENDOR', label: 'Vendor' },
];

const SOURCE_TONE: Record<OrderSource, 'neutral' | 'brand'> = { CUSTOMER: 'neutral', VENDOR: 'brand' };
const SOURCE_LABEL: Record<OrderSource, string> = { CUSTOMER: 'Customer', VENDOR: 'Vendor' };

export const SourceBadge = ({ source }: { source?: OrderSource | null }) =>
  source ? <Badge tone={SOURCE_TONE[source]}>{SOURCE_LABEL[source]}</Badge> : null;

const OrderRow = ({ order }: { order: { id: string; status: OrderStatus; source?: OrderSource; total: number; createdAt: string; customer?: { firstName: string; lastName: string }; vendor?: { name: string } } }) => (
  <tr className="border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors">
    <td className="px-4 py-3 text-sm font-medium text-text-primary">#{order.id.slice(-8).toUpperCase()}</td>
    <td className="px-4 py-3 text-sm text-text-primary">{order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : '-'}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{order.vendor?.name ?? '-'}</td>
    <td className="px-4 py-3 text-sm font-medium text-text-primary">{formatNaira(order.total)}</td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <SourceBadge source={order.source} />
        <OrderStatusBadge status={order.status} />
      </div>
    </td>
    <td className="px-4 py-3 text-sm text-text-muted" title={formatDateTime(order.createdAt)}>{formatRelative(order.createdAt)}</td>
    <td className="px-4 py-3 text-right">
      <Link
        to={`/orders/${order.id}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <Eye className="h-4 w-4" />
        View
      </Link>
    </td>
  </tr>
);

const OrderCard = ({ order }: { order: { id: string; status: OrderStatus; source?: OrderSource; total: number; createdAt: string; customer?: { firstName: string; lastName: string }; vendor?: { name: string } } }) => (
  <Link to={`/orders/${order.id}`} className="block rounded-lg border border-border bg-bg-surface p-4 shadow-card hover:shadow-popover transition-shadow">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-text-primary">#{order.id.slice(-8).toUpperCase()}</span>
      <div className="flex items-center gap-2">
        <SourceBadge source={order.source} />
        <OrderStatusBadge status={order.status} />
      </div>
    </div>
    <div className="mt-3 space-y-1 text-sm">
      <p><span className="text-text-muted">Customer:</span> {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : '-'}</p>
      <p><span className="text-text-muted">Vendor:</span> {order.vendor?.name ?? '-'}</p>
      <p><span className="text-text-muted">Total:</span> <span className="font-medium text-text-primary">{formatNaira(order.total)}</span></p>
      <p className="text-xs text-text-muted">{formatRelative(order.createdAt)}</p>
    </div>
  </Link>
);

export default function OrdersList() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [source, setSource] = useState<OrderSource | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useOrders({
    page,
    limit,
    status: status || undefined,
    source: source || undefined,
    search: debouncedSearch || undefined,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Orders</h1>
          <p className="text-sm text-text-muted">View and manage marketplace orders.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              placeholder="Search orders..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <Select
              value={status}
              onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPage(1); }}
            >
              {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select
              value={source}
              onChange={(e) => { setSource(e.target.value as OrderSource | ''); setPage(1); }}
            >
              {ORDER_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          {source && (
            <div className="mt-3 flex items-center justify-between rounded-md bg-bg-muted p-3 text-xs">
              <span className="text-text-muted">Filtered by source: {SOURCE_LABEL[source]}</span>
              <button onClick={() => setSource('')} className="font-medium text-brand hover:text-brand-strong">
                Clear source filter
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState icon={Package} title="No orders found" subtitle="Try adjusting your filters or search query." />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((order) => <OrderRow key={order.id} order={order} />)}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
          </Card>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.data.map((order) => <OrderCard key={order.id} order={order} />)}
          </div>
          {data.meta && data.meta.totalPages > 1 && (
            <div className="md:hidden">
              <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

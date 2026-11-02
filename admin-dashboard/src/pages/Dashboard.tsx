import { useMemo, useState } from 'react';
import {
  Users,
  Store,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  ClipboardCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { PageSpinner } from '../components/ui/Spinner';
import { ErrorState } from '../components/ui/EmptyState';
import { useDashboardStats } from '../hooks/useAdmin';
import { useOrderAnalytics, useRevenueAnalytics } from '../hooks/useAdmin';
import { useVendorStatusCounts } from '../hooks/useVendors';
import { formatNaira, formatNumber, formatDate } from '../lib/format';
import { cn } from '../lib/cn';

const DateRangePicker = ({
  days,
  onChange,
}: {
  days: number;
  onChange: (days: number) => void;
}) => {
  const options = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={days === o.value}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            days === o.value ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [days]);

  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: vendorCounts } = useVendorStatusCounts();
  const { data: revenue, isLoading: revenueLoading } = useRevenueAnalytics({ startDate, endDate });
  const { data: orders, isLoading: ordersLoading } = useOrderAnalytics({ startDate, endDate });

  if (statsLoading) return <PageSpinner />;
  if (statsError || !stats) return <ErrorState onRetry={() => window.location.reload()} />;

  const isLoading = revenueLoading || ordersLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted">Overview of marketplace performance.</p>
        </div>
        <DateRangePicker days={days} onChange={setDays} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={formatNumber(stats.totalUsers)} icon={Users} tone="info" />
        <StatCard label="Vendors" value={formatNumber(stats.totalVendors)} icon={Store} tone="brand" />
        <StatCard label="Pending vendors" value={formatNumber(vendorCounts?.PENDING_APPROVAL ?? 0)} icon={ClipboardCheck} tone="warning" />
        <StatCard label="Total orders" value={formatNumber(stats.totalOrders)} icon={ShoppingBag} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
            <p className="text-xs text-text-muted">{formatDate(startDate)} – {formatDate(endDate)}</p>
          </CardHeader>
          <CardBody>
            {isLoading ? (
              <div className="h-64 animate-pulse rounded-md bg-bg-muted" />
            ) : revenue?.revenueTrend?.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue.revenueTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgb(var(--brand-default))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="rgb(var(--brand-default))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-default))" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      stroke="rgb(var(--text-muted))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `₦${Number(v).toLocaleString('en-NG')}`}
                      stroke="rgb(var(--text-muted))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgb(var(--bg-surface))',
                        borderColor: 'rgb(var(--border-default))',
                        borderRadius: 12,
                      }}
                      formatter={(value) => [formatNaira(Number(value)), 'Revenue']}
                      labelFormatter={(label) => formatDate(label as string)}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="rgb(var(--brand-default))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-text-muted">No revenue data for this period</div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardBody>
            {isLoading ? (
              <div className="h-64 animate-pulse rounded-md bg-bg-muted" />
            ) : orders?.ordersByStatus?.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={orders.ordersByStatus} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-default))" vertical={false} />
                    <XAxis dataKey="status" stroke="rgb(var(--text-muted))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgb(var(--text-muted))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgb(var(--bg-surface))',
                        borderColor: 'rgb(var(--border-default))',
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="rgb(var(--brand-default))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-text-muted">No order data for this period</div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Total revenue</p>
              <p className="text-xl font-bold text-text-primary">{revenue ? formatNaira(revenue.totalRevenue) : '-'}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-info-soft">
              <ShoppingBag className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-text-muted">Orders in period</p>
              <p className="text-xl font-bold text-text-primary">{orders ? formatNumber(orders.totalOrders) : '-'}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-4">
            <div className={cn('flex h-12 w-12 items-center justify-center rounded-full', (orders?.cancellationRate ?? 0) > 10 ? 'bg-error-soft' : 'bg-warning-soft')}>
              <TrendingDown className={cn('h-6 w-6', (orders?.cancellationRate ?? 0) > 10 ? 'text-error' : 'text-warning')} />
            </div>
            <div>
              <p className="text-sm text-text-muted">Cancellation rate</p>
              <p className="text-xl font-bold text-text-primary">{orders ? `${orders.cancellationRate}%` : '-'}</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

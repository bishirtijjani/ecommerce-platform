import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Package, Wallet, CheckCircle2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Pagination } from '../../components/ui/Pagination';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageSpinner } from '../../components/ui/Spinner';
import { OrderCard } from '../../components/OrderCard';
import { useSalesSummary, useOrderHistory } from '../../hooks/useAnalytics';
import { formatNaira, formatDate } from '../../lib/format';
import { cn } from '../../lib/cn';

const PERIODS = [
  { key: '7d', labelKey: 'analytics.period7d' },
  { key: '30d', labelKey: 'analytics.period30d' },
  { key: '90d', labelKey: 'analytics.period90d' },
] as const;

export default function Analytics() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [page, setPage] = useState(1);
  const { data: summary, isLoading: summaryLoading } = useSalesSummary(period);
  const { data: history, isLoading: historyLoading } = useOrderHistory({ page, limit: 10 });

  const chartData = useMemo(() => {
    if (!history?.data) return [];
    const byDay = new Map<string, number>();
    history.data.forEach((o) => {
      const day = formatDate(o.createdAt);
      byDay.set(day, (byDay.get(day) || 0) + Number(o.total));
    });
    return Array.from(byDay.entries())
      .map(([date, total]) => ({ date, total }))
      .reverse();
  }, [history]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('analytics.title')}</h1>
          <p className="mt-0.5 text-sm text-text-muted">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex gap-1 rounded-md bg-bg-muted p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                period === p.key ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
              )}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {summaryLoading ? (
        <PageSpinner />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t('analytics.ordersPeriod', { period: t(`analytics.period${period}`) })} value={String(summary?.totalOrders ?? 0)} icon={Package} tone="brand" />
          <StatCard label={t('analytics.revenuePeriod', { period: t(`analytics.period${period}`) })} value={formatNaira(summary?.totalRevenue ?? 0)} icon={Wallet} tone="success" />
          <StatCard label={t('dashboard.completed')} value={String(summary?.completedOrders ?? 0)} icon={CheckCircle2} tone="info" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.revenueTrend')}</CardTitle>
        </CardHeader>
        <CardBody>
          {chartData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-default))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'rgb(var(--text-muted))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'rgb(var(--text-muted))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${v / 1000}k`} />
                <Tooltip
                  formatter={(value) => formatNaira(Number(value))}
                  contentStyle={{
                    background: 'rgb(var(--bg-surface))',
                    border: '1px solid rgb(var(--border-default))',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="total" fill="rgb(var(--brand-default))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart3} title={t('analytics.notEnoughData')} subtitle={t('analytics.notEnoughDataSub')} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.orderHistory')}</CardTitle>
        </CardHeader>
        {historyLoading ? (
          <PageSpinner />
        ) : history?.data.length ? (
          <>
            <div className="divide-y divide-border md:hidden">
              {history.data.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    <th className="px-5 py-2.5">{t('table.customer')}</th>
                    <th className="px-5 py-2.5">{t('table.total')}</th>
                    <th className="px-5 py-2.5">{t('table.status')}</th>
                    <th className="px-5 py-2.5">{t('table.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.data.map((o) => (
                    <tr key={o.id} className="hover:bg-bg-muted">
                      <td className="px-5 py-3 font-medium text-text-primary">
                        {o.customer?.firstName} {o.customer?.lastName}
                      </td>
                      <td className="px-5 py-3 text-text-primary">{formatNaira(o.total)}</td>
                      <td className="px-5 py-3">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-5 py-3 text-text-muted">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState icon={BarChart3} title={t('analytics.noOrders')} />
        )}
        {history?.meta && <Pagination page={history.meta.page} totalPages={history.meta.totalPages} onChange={setPage} />}
      </Card>
    </div>
  );
}

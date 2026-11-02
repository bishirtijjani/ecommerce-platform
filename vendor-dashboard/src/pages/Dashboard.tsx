import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, Wallet, CheckCircle2, Clock3, ArrowRight, Boxes, Store, Plus } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { OrderStatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageSpinner } from '../components/ui/Spinner';
import { OrderCard } from '../components/OrderCard';
import { useSalesSummary } from '../hooks/useAnalytics';
import { useVendorOrders } from '../hooks/useOrders';
import { useVendorProfile } from '../hooks/useVendor';
import { formatNaira, formatRelative } from '../lib/format';

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: vendor } = useVendorProfile();
  const { data: summary, isLoading: summaryLoading } = useSalesSummary('7d');
  const { data: pending, isLoading: pendingLoading } = useVendorOrders({ status: 'PENDING', limit: 5 });
  const { data: recent, isLoading: recentLoading } = useVendorOrders({ limit: 6 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{vendor ? t('dashboard.welcomeNamed', { name: vendor.name }) : t('dashboard.welcome')}</h1>
        <p className="mt-0.5 text-sm text-text-muted">{t('dashboard.subtitle')}</p>
      </div>

      {summaryLoading ? (
        <PageSpinner />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t('dashboard.ordersPeriod')} value={String(summary?.totalOrders ?? 0)} icon={Package} tone="brand" />
          <StatCard label={t('dashboard.revenuePeriod')} value={formatNaira(summary?.totalRevenue ?? 0)} icon={Wallet} tone="success" />
          <StatCard label={t('dashboard.completed')} value={String(summary?.completedOrders ?? 0)} icon={CheckCircle2} tone="info" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('dashboard.needsAttention')}</CardTitle>
            <Link to="/orders?status=PENDING" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-strong">
              {t('dashboard.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          {pendingLoading ? (
            <PageSpinner />
          ) : pending?.data.length ? (
            <div className="divide-y divide-border">
              {pending.data.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Clock3} title={t('dashboard.nothingAction')} subtitle={t('dashboard.nothingActionSub')} />
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2.5">
            <Link to="/orders?logOrder=1">
              <Button variant="secondary" className="w-full justify-start" icon={<Plus className="h-4 w-4" />}>
                {t('dashboard.logOrder')}
              </Button>
            </Link>
            <Link to="/products/new">
              <Button variant="secondary" className="w-full justify-start" icon={<Boxes className="h-4 w-4" />}>
                {t('dashboard.addProduct')}
              </Button>
            </Link>
            <Link to="/shop">
              <Button variant="secondary" className="w-full justify-start" icon={<Store className="h-4 w-4" />}>
                {t('dashboard.editShop')}
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentOrders')}</CardTitle>
          <Link to="/orders" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-strong">
            {t('dashboard.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        {recentLoading ? (
          <PageSpinner />
        ) : recent?.data.length ? (
          <>
            <div className="divide-y divide-border sm:hidden">
              {recent.data.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
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
                  {recent.data.map((order) => (
                    <tr key={order.id} className="cursor-pointer hover:bg-bg-muted" onClick={() => (window.location.href = `/orders/${order.id}`)}>
                      <td className="px-5 py-3 font-medium text-text-primary">
                        {order.customer?.firstName} {order.customer?.lastName}
                      </td>
                      <td className="px-5 py-3 text-text-muted">{order.items.length}</td>
                      <td className="px-5 py-3 text-text-primary">{formatNaira(order.total)}</td>
                      <td className="px-5 py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3 text-text-muted">{formatRelative(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState icon={Package} title={t('dashboard.noOrders')} subtitle={t('dashboard.noOrdersSub')} />
        )}
      </Card>
    </div>
  );
}

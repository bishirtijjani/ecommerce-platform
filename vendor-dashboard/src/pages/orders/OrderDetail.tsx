import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Phone, Send, CheckCircle2, XCircle, Truck, PackageCheck, Clock3,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { PageSpinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import {
  useOrder, useAcceptOrder, useRejectOrder, useUpdateOrderStatus, useOrderMessages, usePostOrderMessage,
} from '../../hooks/useOrders';
import { formatNaira, formatDateTime } from '../../lib/format';
import { cn } from '../../lib/cn';

const TIMELINE = [
  { key: 'createdAt', labelKey: 'orders.timeline.placed', icon: Clock3 },
  { key: 'confirmedAt', labelKey: 'orders.timeline.accepted', icon: CheckCircle2 },
  { key: 'shippedAt', labelKey: 'status.order.SHIPPED', icon: Truck },
  { key: 'deliveredAt', labelKey: 'status.order.DELIVERED', icon: PackageCheck },
] as const;

export default function OrderDetail() {
  const { t } = useTranslation();
  const { orderId } = useParams();
  const { data: order, isLoading, isError, refetch } = useOrder(orderId);
  const { data: messages } = useOrderMessages(orderId);
  const postMessage = usePostOrderMessage(orderId as string);
  const acceptOrder = useAcceptOrder(orderId as string);
  const rejectOrder = useRejectOrder(orderId as string);
  const updateStatus = useUpdateOrderStatus(orderId as string);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [shipOpen, setShipOpen] = useState(false);
  const [tracking, setTracking] = useState('');
  const [messageBody, setMessageBody] = useState('');

  if (isLoading) return <PageSpinner />;
  if (isError || !order) return <ErrorState title={t('orders.detail.couldntLoad')} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/orders" className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-text-primary">{t('orders.detail.title', { id: order.id.slice(0, 8).toUpperCase() })}</h1>
          <p className="text-sm text-text-muted">{t('orders.detail.placed', { date: formatDateTime(order.createdAt) })}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('table.items')}</CardTitle>
            </CardHeader>
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <p className="text-xs text-text-muted">
                        {item.selectedOptions.flatMap((g) => g.items.map((it) => it.itemName)).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-text-muted">
                      {item.quantity} × {formatNaira(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-text-primary">{formatNaira(item.lineTotal)}</p>
                </div>
              ))}
            </div>
            <CardBody className="space-y-1.5 border-t border-border pt-4">
              <div className="flex justify-between text-sm text-text-muted">
                <span>{t('orders.detail.subtotal')}</span>
                <span>{formatNaira(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-success-strong">
                  <span>{t('orders.detail.discount')}</span>
                  <span>-{formatNaira(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-text-primary">
                <span>{t('table.total')}</span>
                <span>{formatNaira(order.total)}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('orders.detail.messages')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="max-h-72 space-y-3 overflow-y-auto">
                {messages?.length ? (
                  messages.map((m) => (
                    <div key={m.id} className={cn('flex', m.fromUser.role === 'VENDOR' ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-3.5 py-2 text-sm',
                          m.fromUser.role === 'VENDOR' ? 'bg-brand text-text-onBrand' : 'bg-bg-muted text-text-primary',
                        )}
                      >
                        <p>{m.body}</p>
                        <p className={cn('mt-1 text-[10px]', m.fromUser.role === 'VENDOR' ? 'text-white/70' : 'text-text-placeholder')}>
                          {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-text-muted">{t('orders.detail.noMessages')}</p>
                )}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!messageBody.trim()) return;
                  postMessage.mutate(messageBody.trim());
                  setMessageBody('');
                }}
              >
                <Input
                  placeholder={t('orders.detail.messagePlaceholder')}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon" icon={<Send className="h-4 w-4" />} disabled={!messageBody.trim()} />
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('table.actions')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2.5">
              {order.status === 'PENDING' && (
                <>
                  <Button className="w-full" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => acceptOrder.mutate()} loading={acceptOrder.isPending}>
                    {t('orders.actions.accept')}
                  </Button>
                  <Button variant="danger" className="w-full" icon={<XCircle className="h-4 w-4" />} onClick={() => setRejectOpen(true)}>
                    {t('orders.actions.reject')}
                  </Button>
                </>
              )}
              {order.status === 'PROCESSING' && (
                <>
                  <Button className="w-full" icon={<Truck className="h-4 w-4" />} onClick={() => setShipOpen(true)}>
                    {t('orders.actions.markShipped')}
                  </Button>
                  <Button variant="danger" className="w-full" icon={<XCircle className="h-4 w-4" />} onClick={() => setRejectOpen(true)}>
                    {t('orders.actions.cancel')}
                  </Button>
                </>
              )}
              {order.status === 'SHIPPED' && (
                <Button
                  className="w-full"
                  icon={<PackageCheck className="h-4 w-4" />}
                  onClick={() => updateStatus.mutate({ status: 'DELIVERED' })}
                  loading={updateStatus.isPending}
                >
                  {t('orders.actions.markDelivered')}
                </Button>
              )}
              {(order.status === 'DELIVERED' || order.status === 'CANCELLED') && (
                <p className="text-sm text-text-muted">{order.status === 'DELIVERED' ? t('orders.detail.isComplete') : t('orders.detail.isCancelled')}</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('orders.detail.timeline')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {TIMELINE.map((step, i) => {
                const value = order[step.key as keyof typeof order] as string | null;
                const done = !!value;
                return (
                  <div key={step.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn('flex h-6 w-6 items-center justify-center rounded-full', done ? 'bg-brand text-text-onBrand' : 'bg-bg-muted text-text-placeholder')}>
                        <step.icon className="h-3.5 w-3.5" />
                      </div>
                      {i < TIMELINE.length - 1 && <div className={cn('h-6 w-px', done ? 'bg-brand' : 'bg-border')} />}
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', done ? 'text-text-primary' : 'text-text-placeholder')}>{t(step.labelKey)}</p>
                      {value && <p className="text-xs text-text-muted">{formatDateTime(value)}</p>}
                    </div>
                  </div>
                );
              })}
              {order.status === 'CANCELLED' && (
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-error-soft text-error-strong">
                    <XCircle className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{t('status.order.CANCELLED')}</p>
                    <p className="text-xs text-text-muted">{order.cancellationReason}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('table.customer')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={`${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`} size={40} />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {order.customer?.firstName} {order.customer?.lastName}
                  </p>
                  <a href={`tel:${order.customer?.phone}`} className="flex items-center gap-1 text-xs text-brand hover:text-brand-strong">
                    <Phone className="h-3 w-3" /> {order.customer?.phone}
                  </a>
                </div>
              </div>
              {order.shippingAddress && (
                <div className="flex items-start gap-2 border-t border-border pt-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                  <div>
                    <p className="font-medium text-text-primary">{order.shippingAddress.label}</p>
                    <p className="text-text-muted">{order.shippingAddress.address}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={order.status === 'PENDING' ? t('orders.reject.title') : t('orders.cancel.title')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t('orders.actions.neverMind')}
            </Button>
            <Button
              variant="danger"
              loading={rejectOrder.isPending}
              disabled={rejectReason.trim().length < 5}
              onClick={() => rejectOrder.mutate(rejectReason.trim(), { onSuccess: () => setRejectOpen(false) })}
            >
              {order.status === 'PENDING' ? t('orders.actions.reject') : t('orders.actions.cancel')}
            </Button>
          </>
        }
      >
        <Textarea
          label={t('orders.reject.reason')}
          required
          placeholder={t('orders.reject.reasonPlaceholder')}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          hint={t('orders.reject.reasonHint')}
        />
      </Modal>

      <Modal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title={t('orders.actions.markShipped')}
        footer={
          <>
            <Button variant="outline" onClick={() => setShipOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={updateStatus.isPending}
              onClick={() => updateStatus.mutate({ status: 'SHIPPED', trackingNumber: tracking || undefined }, { onSuccess: () => setShipOpen(false) })}
            >
              {t('orders.ship.confirm')}
            </Button>
          </>
        }
      >
        <Input label={t('orders.ship.trackingLabel')} placeholder={t('orders.ship.trackingPlaceholder')} value={tracking} onChange={(e) => setTracking(e.target.value)} />
      </Modal>
    </div>
  );
}

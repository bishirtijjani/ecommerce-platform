import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, Truck, XCircle, RefreshCcw, AlertCircle } from 'lucide-react';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { useOrder, useCancelOrder, useUpdateOrderStatus } from '../../hooks/useOrders';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Input';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageSpinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/EmptyState';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatNaira, formatDateTime, formatDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { SourceBadge } from './OrdersList';
import type { OrderStatus } from '../../types';

const STATUSES: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

const StatusTimeline = ({ order }: { order: { createdAt: string; confirmedAt?: string | null; processingAt?: string | null; shippedAt?: string | null; deliveredAt?: string | null; cancelledAt?: string | null } }) => {
  const steps = [
    { label: 'Placed', date: order.createdAt },
    { label: 'Confirmed', date: order.confirmedAt },
    { label: 'Processing', date: order.processingAt },
    { label: 'Shipped', date: order.shippedAt },
    { label: 'Delivered', date: order.deliveredAt },
  ].filter((s) => s.date);

  if (order.cancelledAt) {
    steps.push({ label: 'Cancelled', date: order.cancelledAt });
  }

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn('h-2.5 w-2.5 rounded-full', i === steps.length - 1 ? 'bg-brand' : 'bg-bg-strong')} />
            {i !== steps.length - 1 && <div className="h-full w-px bg-border" />}
          </div>
          <div className="pb-5">
            <p className="text-sm font-medium text-text-primary">{step.label}</p>
            <p className="text-xs text-text-muted">{formatDateTime(step.date as string)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useOrder(orderId || '');

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('PENDING');
  const [statusReason, setStatusReason] = useState('');

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const updateStatus = useUpdateOrderStatus();
  const cancelOrder = useCancelOrder();

  if (isLoading) return <PageSpinner />;
  if (error || !data) return <ErrorState onRetry={() => window.location.reload()} />;

  const order = data;
  const canCancel = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
  const canUpdateStatus = order.status !== 'CANCELLED' && order.status !== 'DELIVERED';

  const handleStatusUpdate = () => {
    updateStatus.mutate(
      { id: order.id, status: newStatus, reason: statusReason },
      { onSuccess: () => setStatusModalOpen(false) },
    );
  };

  const handleCancel = () => {
    cancelOrder.mutate(
      { id: order.id, reason: cancelReason },
      { onSuccess: () => setCancelModalOpen(false) },
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumbs items={[{ label: 'Orders', to: '/orders' }, { label: `Order #${order.id.slice(-8).toUpperCase()}` }]} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-bg-surface hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 text-text-muted" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Order #{order.id.slice(-8).toUpperCase()}</h1>
            <p className="text-sm text-text-muted">Placed {formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.source ? <SourceBadge source={order.source} /> : <span className="text-sm text-text-muted">-</span>}
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardBody className="divide-y divide-border">
              {order.items.length ? order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-muted">
                      <Package className="h-5 w-5 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{item.name}</p>
                      <p className="text-xs text-text-muted">Qty: {item.quantity} · Unit: {formatNaira(item.unitPrice)}</p>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <p className="mt-1 text-xs text-text-muted">
                          {item.selectedOptions.map((g) => `${g.groupName}: ${g.items.map((i) => i.itemName).join(', ')}`).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{formatNaira(item.lineTotal)}</p>
                </div>
              )) : <EmptyState icon={Package} title="No items" />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Subtotal</span>
                <span className="text-text-primary">{formatNaira(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Tax</span>
                <span className="text-text-primary">{formatNaira(order.tax)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Discount</span>
                  <span className="text-success-strong">-{formatNaira(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-text-primary">Total</span>
                <span className="text-text-primary">{formatNaira(order.total)}</span>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {canUpdateStatus && (
                <Button className="w-full" icon={<Truck className="h-4 w-4" />} onClick={() => { setNewStatus(order.status); setStatusModalOpen(true); }}>
                  Update status
                </Button>
              )}
              {canCancel && (
                <Button className="w-full" variant="outline" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelModalOpen(true)}>
                  Cancel order
                </Button>
              )}
              {!canUpdateStatus && !canCancel && (
                <div className="flex items-center gap-2 rounded-md bg-bg-muted p-3 text-sm text-text-muted">
                  <AlertCircle className="h-4 w-4" /> This order is {order.status.toLowerCase()} and cannot be changed.
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer & vendor</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Customer</p>
                <p className="text-sm font-medium text-text-primary">{order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : '-'}</p>
                <p className="text-sm text-text-muted">{order.customer?.phone}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Vendor</p>
                <p className="text-sm font-medium text-text-primary">{order.vendor?.name ?? '-'}</p>
                <p className="text-sm text-text-muted">{order.vendor?.phone}</p>
              </div>
              {order.shippingAddress && (
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Shipping address</p>
                  <p className="text-sm text-text-primary">{order.shippingAddress.label}</p>
                  <p className="text-sm text-text-muted">{order.shippingAddress.address}</p>
                </div>
              )}
              {order.trackingNumber && (
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Tracking number</p>
                  <p className="text-sm font-medium text-text-primary">{order.trackingNumber}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardBody>
              <StatusTimeline order={order} />
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update order status"
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusModalOpen(false)} disabled={updateStatus.isPending}>Cancel</Button>
            <Button onClick={handleStatusUpdate} loading={updateStatus.isPending} icon={<RefreshCcw className="h-4 w-4" />}>
              Update status
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="New status" value={newStatus} onChange={(e) => setNewStatus(e.target.value as OrderStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Textarea label="Reason (optional)" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Add a note..." />
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        title="Cancel this order?"
        description="Cancelling will restore stock and notify the customer. This action cannot be undone."
        confirmLabel="Cancel order"
        danger
        loading={cancelOrder.isPending}
        disabled={cancelReason.trim().length === 0}
      >
        <div className="mt-3">
          <Textarea
            label="Reason"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is this order being cancelled?"
            error={cancelReason.trim().length === 0 ? 'A reason is required' : undefined}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

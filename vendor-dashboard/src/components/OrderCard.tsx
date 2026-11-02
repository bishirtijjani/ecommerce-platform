import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from './ui/Avatar';
import { OrderStatusBadge } from './ui/Badge';
import { formatNaira, formatRelative } from '../lib/format';
import type { Order } from '../types';

/** Tap target for an order on mobile - the card-list counterpart to the desktop table row. */
export const OrderCard = ({ order }: { order: Order }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const name = `${order.customer?.firstName || t('common.guest')} ${order.customer?.lastName || ''}`.trim();

  return (
    <button
      onClick={() => navigate(`/orders/${order.id}`)}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-0 active:bg-bg-muted"
    >
      <Avatar name={name} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-text-primary">{name}</p>
          <p className="shrink-0 text-sm font-semibold text-text-primary">{formatNaira(order.total)}</p>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-xs text-text-muted">
            {t('common.itemCount', { count: order.items.length })} · {formatRelative(order.createdAt)}
          </p>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>
    </button>
  );
};

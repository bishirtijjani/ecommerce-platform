import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-bg-muted text-text-muted',
  brand: 'bg-brand-soft text-brand-strong',
  success: 'bg-success-soft text-success-strong',
  warning: 'bg-warning-soft text-warning-strong',
  error: 'bg-error-soft text-error-strong',
  info: 'bg-info-soft text-info-strong',
};

export const Badge = ({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
      toneClasses[tone],
      className,
    )}
  >
    {children}
  </span>
);

const ORDER_STATUS_TONE: Record<string, Tone> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  SHIPPED: 'brand',
  DELIVERED: 'success',
  CANCELLED: 'error',
};

export const OrderStatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
  return <Badge tone={ORDER_STATUS_TONE[status] || 'neutral'}>{t(`status.order.${status}`, status)}</Badge>;
};

const REQUEST_STATUS_TONE: Record<string, Tone> = {
  OPEN: 'success',
  ASSIGNED: 'brand',
  EXPIRED: 'neutral',
  CANCELLED: 'error',
};

export const RequestStatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
  return <Badge tone={REQUEST_STATUS_TONE[status] || 'neutral'}>{t(`status.request.${status}`, status)}</Badge>;
};

const VENDOR_STATUS_TONE: Record<string, Tone> = {
  APPROVED: 'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'error',
  REJECTED: 'error',
};

export const VendorStatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
  return <Badge tone={VENDOR_STATUS_TONE[status] || 'neutral'}>{t(`status.vendor.${status}`, status)}</Badge>;
};

// New / pre-owned / Second Hand listing. Defaults to NEW when absent.
export const ProductConditionBadge = ({ condition }: { condition?: string | null }) => {
  const { t } = useTranslation();
  if (condition === 'SECOND_HAND') {
    return <Badge tone="brand">{t('status.condition.SECOND_HAND')}</Badge>;
  }
  return (
    <Badge tone={condition === 'USED' ? 'warning' : 'success'}>
      {condition === 'USED' ? t('status.condition.USED') : t('status.condition.NEW')}
    </Badge>
  );
};

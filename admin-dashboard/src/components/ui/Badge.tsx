import type { ReactNode } from 'react';
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

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const OrderStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={ORDER_STATUS_TONE[status] || 'neutral'}>{ORDER_STATUS_LABEL[status] || status}</Badge>
);

const REQUEST_STATUS_TONE: Record<string, Tone> = {
  OPEN: 'info',
  ASSIGNED: 'success',
  EXPIRED: 'warning',
  CANCELLED: 'neutral',
};

const REQUEST_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const RequestStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={REQUEST_STATUS_TONE[status] || 'neutral'}>{REQUEST_STATUS_LABEL[status] || status}</Badge>
);

const VENDOR_STATUS_TONE: Record<string, Tone> = {
  APPROVED: 'success',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'error',
  REJECTED: 'error',
};

const VENDOR_STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved',
  PENDING_APPROVAL: 'Pending review',
  SUSPENDED: 'Suspended',
  REJECTED: 'Rejected',
};

export const VendorStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={VENDOR_STATUS_TONE[status] || 'neutral'}>{VENDOR_STATUS_LABEL[status] || status}</Badge>
);

const CUSTOMER_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  SUSPENDED: 'error',
  DEACTIVATED: 'neutral',
};

export const CustomerStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={CUSTOMER_STATUS_TONE[status] || 'neutral'}>{status.replace('_', ' ')}</Badge>
);

const KYC_STATUS_TONE: Record<string, Tone> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  FAILED: 'error',
  NONE: 'neutral',
};

export const KycStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={KYC_STATUS_TONE[status] || 'neutral'}>{status}</Badge>
);

// New / pre-owned / Second Hand listing. Defaults to NEW when absent.
export const ProductConditionBadge = ({ condition }: { condition?: string | null }) => {
  if (condition === 'SECOND_HAND') return <Badge tone="brand">Second Hand</Badge>;
  return <Badge tone={condition === 'USED' ? 'warning' : 'success'}>{condition === 'USED' ? 'Used' : 'New'}</Badge>;
};

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Store, MapPin, Clock, Star, CheckCircle, XCircle, PauseCircle, PlayCircle, RefreshCcw, Pencil } from 'lucide-react';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { useVendor, useApproveVendor, useRejectVendor, useSuspendVendor, useUnsuspendVendor, useUpdateVendorProfile } from '../../hooks/useVendors';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { Avatar } from '../../components/ui/Avatar';
import { VendorStatusBadge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/EmptyState';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPhone, formatDate } from '../../lib/format';
import { VendorProducts } from './VendorProducts';
import { VendorEditModal } from './VendorEditModal';

const POLICY_LABELS: Record<string, string> = {
  shipping: 'Shipping',
  returns: 'Returns',
  payment: 'Payment',
  shopPolicies: 'Shop policies',
};

export default function VendorDetail() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useVendor(vendorId || '');

  const updateProfile = useUpdateVendorProfile();
  const [editing, setEditing] = useState(false);

  const [actionType, setActionType] = useState<'approve' | 'reject' | 'suspend' | 'unsuspend' | null>(null);
  const [reason, setReason] = useState('');
  const [tab, setTab] = useState<'overview' | 'products'>('overview');

  const approve = useApproveVendor();
  const reject = useRejectVendor();
  const suspend = useSuspendVendor();
  const unsuspend = useUnsuspendVendor();

  if (isLoading) return <PageSpinner />;
  if (error || !data) return <ErrorState onRetry={() => window.location.reload()} />;

  const vendor = data;

  const closeAction = () => {
    setActionType(null);
    setReason('');
  };

  const handleConfirm = () => {
    if (!actionType) return;
    const onSettled = () => closeAction();
    switch (actionType) {
      case 'approve':
        approve.mutate(vendor.id, { onSettled });
        break;
      case 'reject':
        reject.mutate({ id: vendor.id, reason }, { onSettled });
        break;
      case 'suspend':
        suspend.mutate({ id: vendor.id, reason }, { onSettled });
        break;
      case 'unsuspend':
        unsuspend.mutate(vendor.id, { onSettled });
        break;
    }
  };

  const actionTitle = {
    approve: 'Approve vendor',
    reject: 'Reject vendor',
    suspend: 'Suspend vendor',
    unsuspend: 'Unsuspend vendor',
  }[actionType || 'approve'];

  const actionLoading = approve.isPending || reject.isPending || suspend.isPending || unsuspend.isPending;
  const needsReason = actionType === 'reject' || actionType === 'suspend';
  const canConfirm = !needsReason || reason.trim().length > 0;

  const policies = Object.entries(vendor.policies ?? {}).filter(([, value]) => value?.trim());

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumbs items={[{ label: 'Vendors', to: '/vendors' }, { label: vendor.name }]} />
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
            <h1 className="text-xl font-bold text-text-primary">{vendor.name}</h1>
            <p className="text-sm text-text-muted">Vendor since {formatDate(vendor.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VendorStatusBadge status={vendor.status} />
          <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
            Edit shop
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-32 w-full bg-bg-muted sm:h-40">
          {vendor.coverImageUrl ? (
            <img src={vendor.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">No cover image</div>
          )}
        </div>
        <div className="flex items-center gap-4 px-4 py-4">
          <Avatar src={vendor.logoUrl} name={vendor.name} size={64} className="rounded-lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text-primary">{vendor.name}</p>
            <p className="truncate text-sm text-text-muted">{vendor.address || 'No address'}</p>
          </div>
        </div>
      </Card>

      <Tabs
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'products', label: 'Products' },
        ]}
        active={tab}
        onChange={(key) => setTab(key as 'overview' | 'products')}
      />

      {tab === 'products' ? (
        <VendorProducts vendorId={vendor.id} />
      ) : (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Shop information</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted">
                    <Store className="h-4 w-4 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-text-muted">Contact</p>
                    <p className="text-sm font-medium text-text-primary">{vendor.email || 'No email'}</p>
                    <p className="text-sm text-text-muted">{formatPhone(vendor.phone)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted">
                    <MapPin className="h-4 w-4 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-text-muted">Address</p>
                    <p className="text-sm text-text-primary">{vendor.address || 'No address'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted">
                    <Clock className="h-4 w-4 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-text-muted">Opening hours</p>
                    <p className="text-sm text-text-primary">{vendor.openingTime} – {vendor.closingTime}</p>
                    <p className="flex flex-wrap gap-1 text-sm text-text-muted">
                      {vendor.openingDays.map((day) => (
                        <span key={day} className="rounded bg-bg-muted px-1.5 py-0.5 text-xs">{day}</span>
                      ))}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted">
                    <Star className="h-4 w-4 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-text-muted">Rating & orders</p>
                    <p className="flex items-center gap-1 text-sm text-text-primary">
                      {vendor.averageRating.toFixed(1)}
                      <Star className="h-3.5 w-3.5 fill-current text-warning" />
                      <span>· {vendor.totalOrders} orders</span>
                    </p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {vendor.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm text-text-primary">{vendor.description}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Shop photos & policies</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-text-muted">Shop photos</p>
                {vendor.photos?.length ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {vendor.photos.map((url, index) => (
                      <img
                        key={`${url}-${index}`}
                        src={url}
                        alt="Shop photo"
                        className="h-16 w-16 rounded-md border border-border object-cover"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-text-muted">No shop photos added.</p>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase text-text-muted">Policies</p>
                {policies.length ? (
                  <dl className="mt-2 space-y-3">
                    {policies.map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-sm font-medium text-text-primary">{POLICY_LABELS[key] ?? key}</dt>
                        <dd className="whitespace-pre-wrap text-sm text-text-muted">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-text-muted">No policies set.</p>
                )}
              </div>
            </CardBody>
          </Card>

          {(vendor.suspensionReason || vendor.rejectionReason) && (
            <Card className="border-error/30 bg-error-soft/30">
              <CardHeader>
                <CardTitle>Admin note</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-error-strong">{vendor.suspensionReason || vendor.rejectionReason}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {vendor.user ? (
                <>
                  <p className="text-sm font-medium text-text-primary">{vendor.user.firstName} {vendor.user.lastName}</p>
                  <p className="text-sm text-text-muted">{vendor.user.email}</p>
                  <p className="text-sm text-text-muted">{formatPhone(vendor.user.phone)}</p>
                </>
              ) : (
                <EmptyState icon={Store} title="No owner linked" subtitle="This vendor has no associated user account." />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {vendor.status === 'PENDING_APPROVAL' && (
                <>
                  <Button className="w-full" icon={<CheckCircle className="h-4 w-4" />} onClick={() => setActionType('approve')}>
                    Approve vendor
                  </Button>
                  <Button className="w-full" variant="outline" icon={<XCircle className="h-4 w-4" />} onClick={() => setActionType('reject')}>
                    Reject vendor
                  </Button>
                </>
              )}
              {vendor.status === 'APPROVED' && (
                <Button className="w-full" variant="outline" icon={<PauseCircle className="h-4 w-4" />} onClick={() => setActionType('suspend')}>
                  Suspend vendor
                </Button>
              )}
              {vendor.status === 'SUSPENDED' && (
                <Button className="w-full" icon={<PlayCircle className="h-4 w-4" />} onClick={() => setActionType('unsuspend')}>
                  Unsuspend vendor
                </Button>
              )}
              {vendor.status === 'REJECTED' && (
                <Button className="w-full" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => setActionType('approve')}>
                  Approve vendor
                </Button>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
      )}

      <VendorEditModal
        vendor={editing ? vendor : null}
        onClose={() => setEditing(false)}
        onSubmit={(data) => updateProfile.mutate({ id: vendor.id, data }, { onSuccess: () => setEditing(false) })}
        loading={updateProfile.isPending}
      />

      <Modal
        open={!!actionType}
        onClose={closeAction}
        title={actionTitle}
        footer={
          <>
            <Button variant="outline" onClick={closeAction} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleConfirm} loading={actionLoading} disabled={!canConfirm}>Confirm</Button>
          </>
        }
      >
        {needsReason ? (
          <Textarea
            label="Reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`Why are you ${actionType === 'reject' ? 'rejecting' : 'suspending'} this vendor?`}
            error={reason.trim().length === 0 ? 'A reason is required' : undefined}
          />
        ) : (
          <p className="text-sm text-text-muted">Are you sure you want to {actionType} <span className="font-medium text-text-primary">{vendor.name}</span>?</p>
        )}
      </Modal>
    </div>
  );
}

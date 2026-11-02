import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Store, Eye, CheckCircle, XCircle, PauseCircle, PlayCircle } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useVendors, useVendorStatusCounts, useApproveVendor, useRejectVendor, useSuspendVendor, useUnsuspendVendor } from '../../hooks/useVendors';
import { Card, CardBody } from '../../components/ui/Card';
import { Tabs } from '../../components/ui/Tabs';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { VendorStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { Avatar } from '../../components/ui/Avatar';
import { formatPhone, formatRelative } from '../../lib/format';
import type { Vendor, VendorStatus } from '../../types';

const STATUSES: { value: VendorStatus | ''; label: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: '', label: 'All' },
];

const ActionButton = ({
  vendor,
  onAction,
}: {
  vendor: Vendor;
  onAction: (vendor: Vendor, action: 'approve' | 'reject' | 'suspend' | 'unsuspend') => void;
}) => {
  if (vendor.status === 'PENDING_APPROVAL') {
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onAction(vendor, 'approve')} title="Approve">
          <CheckCircle className="h-4 w-4 text-success" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onAction(vendor, 'reject')} title="Reject">
          <XCircle className="h-4 w-4 text-error" />
        </Button>
      </div>
    );
  }
  if (vendor.status === 'APPROVED') {
    return (
      <Button variant="ghost" size="icon" onClick={() => onAction(vendor, 'suspend')} title="Suspend">
        <PauseCircle className="h-4 w-4 text-warning" />
      </Button>
    );
  }
  if (vendor.status === 'SUSPENDED') {
    return (
      <Button variant="ghost" size="icon" onClick={() => onAction(vendor, 'unsuspend')} title="Unsuspend">
        <PlayCircle className="h-4 w-4 text-success" />
      </Button>
    );
  }
  return null;
};

const VendorRow = ({ vendor, onAction }: { vendor: Vendor; onAction: (v: Vendor, action: 'approve' | 'reject' | 'suspend' | 'unsuspend') => void }) => {
  const navigate = useNavigate();
  const open = () => navigate(`/vendors/${vendor.id}`);
  return (
    <tr
      onClick={open}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open();
      }}
      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-bg-muted/40 focus-visible:bg-bg-muted/40 focus-visible:outline-none"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar src={vendor.logoUrl} name={vendor.name} size={36} className="rounded-md" />
          <div>
            <p className="text-sm font-medium text-text-primary">{vendor.name}</p>
            <p className="text-xs text-text-muted">{formatPhone(vendor.phone)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-text-muted">{vendor.user ? `${vendor.user.firstName} ${vendor.user.lastName}` : '-'}</td>
      <td className="px-4 py-3"><VendorStatusBadge status={vendor.status} /></td>
      <td className="px-4 py-3 text-sm text-text-muted">{formatRelative(vendor.createdAt)}</td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <ActionButton vendor={vendor} onAction={onAction} />
          <Link
            to={`/vendors/${vendor.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Eye className="h-4 w-4" />
            View
          </Link>
        </div>
      </td>
    </tr>
  );
};

const VendorCard = ({ vendor, onAction }: { vendor: Vendor; onAction: (v: Vendor, action: 'approve' | 'reject' | 'suspend' | 'unsuspend') => void }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/vendors/${vendor.id}`)}
      className="cursor-pointer rounded-lg border border-border bg-bg-surface p-4 shadow-card transition-colors hover:border-brand/40"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar src={vendor.logoUrl} name={vendor.name} size={40} className="rounded-md" />
          <div>
            <p className="text-sm font-semibold text-text-primary">{vendor.name}</p>
            <p className="text-xs text-text-muted">{formatPhone(vendor.phone)}</p>
          </div>
        </div>
        <VendorStatusBadge status={vendor.status} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-text-muted">{formatRelative(vendor.createdAt)}</span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ActionButton vendor={vendor} onAction={onAction} />
          <Link
            to={`/vendors/${vendor.id}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-primary transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label={`View ${vendor.name}`}
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default function VendorsList() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  // Default to the pending queue - admins land straight on applications to review.
  const [status, setStatus] = useState<VendorStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: counts } = useVendorStatusCounts();

  const { data, isLoading, error } = useVendors({
    page,
    limit,
    status: status || undefined,
    search: debouncedSearch || undefined,
  });

  const [actionVendor, setActionVendor] = useState<Vendor | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'suspend' | 'unsuspend' | null>(null);
  const [reason, setReason] = useState('');

  const approve = useApproveVendor();
  const reject = useRejectVendor();
  const suspend = useSuspendVendor();
  const unsuspend = useUnsuspendVendor();

  const openAction = (vendor: Vendor, action: 'approve' | 'reject' | 'suspend' | 'unsuspend') => {
    setActionVendor(vendor);
    setActionType(action);
    setReason('');
  };

  const closeAction = () => {
    setActionVendor(null);
    setActionType(null);
    setReason('');
  };

  const handleConfirm = () => {
    if (!actionVendor || !actionType) return;
    const onSettled = () => closeAction();
    switch (actionType) {
      case 'approve':
        approve.mutate(actionVendor.id, { onSettled });
        break;
      case 'reject':
        reject.mutate({ id: actionVendor.id, reason }, { onSettled });
        break;
      case 'suspend':
        suspend.mutate({ id: actionVendor.id, reason }, { onSettled });
        break;
      case 'unsuspend':
        unsuspend.mutate(actionVendor.id, { onSettled });
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Vendors</h1>
        <p className="text-sm text-text-muted">Review and manage vendor shops.</p>
      </div>

      <Tabs
        items={STATUSES.map((s) => ({
          key: s.value,
          label: s.label,
          count:
            counts
              ? s.value === ''
                ? counts.total
                : counts[s.value as keyof typeof counts]
              : undefined,
        }))}
        active={status}
        onChange={(key) => { setStatus(key as VendorStatus | ''); setPage(1); }}
      />

      <Card>
        <CardBody>
          <Input placeholder="Search vendors..." leftIcon={<Search className="h-4 w-4" />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState
          icon={Store}
          title={status === 'PENDING_APPROVAL' ? 'No pending applications' : 'No vendors found'}
          subtitle={
            status === 'PENDING_APPROVAL'
              ? 'New vendor applications will appear here for review.'
              : 'Try adjusting your filters or search query.'
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((vendor) => <VendorRow key={vendor.id} vendor={vendor} onAction={openAction} />)}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.data.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} onAction={openAction} />)}
          </div>
          {data.meta && data.meta.totalPages > 1 && <div className="md:hidden"><Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} /></div>}
        </>
      )}

      <Modal
        open={!!actionVendor && !!actionType}
        onClose={closeAction}
        title={actionTitle}
        footer={
          <>
            <Button variant="outline" onClick={closeAction} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleConfirm} loading={actionLoading} disabled={!canConfirm}>
              Confirm
            </Button>
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
          <p className="text-sm text-text-muted">
            Are you sure you want to {actionType} <span className="font-medium text-text-primary">{actionVendor?.name}</span>?
          </p>
        )}
      </Modal>
    </div>
  );
}

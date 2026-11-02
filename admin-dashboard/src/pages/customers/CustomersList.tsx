import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, Eye, Ban, CheckCircle, UserX } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useCustomers, useUpdateCustomerStatus } from '../../hooks/useCustomers';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { CustomerStatusBadge, KycStatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Select as ReasonSelect, Textarea } from '../../components/ui/Input';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { formatPhone, formatRelative, initials } from '../../lib/format';
import type { Customer, CustomerStatus } from '../../types';

const STATUSES: { value: CustomerStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
];

const UPDATE_STATUSES: { value: CustomerStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
];

const ActionButton = ({
  customer,
  onAction,
}: {
  customer: Customer;
  onAction: (customer: Customer) => void;
}) => {
  if (customer.status === 'ACTIVE' || customer.status === 'PENDING') {
    return (
      <Button variant="ghost" size="icon" onClick={() => onAction(customer)} title="Change status">
        <Ban className="h-4 w-4 text-warning" />
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="icon" onClick={() => onAction(customer)} title="Reactivate">
      <CheckCircle className="h-4 w-4 text-success" />
    </Button>
  );
};

const CustomerRow = ({ customer, onAction }: { customer: Customer; onAction: (c: Customer) => void }) => (
  <tr className="border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
          {initials(customer.firstName, customer.lastName)}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{customer.firstName} {customer.lastName}</p>
          <p className="text-xs text-text-muted">{customer.email}</p>
        </div>
      </div>
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatPhone(customer.phone)}</td>
    <td className="px-4 py-3"><CustomerStatusBadge status={customer.status} /></td>
    <td className="px-4 py-3"><KycStatusBadge status={customer.kycStatus} /></td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatRelative(customer.createdAt)}</td>
    <td className="px-4 py-3 text-right">
      <div className="flex items-center justify-end gap-1">
        <ActionButton customer={customer} onAction={onAction} />
        <Link
          to={`/customers/${customer.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-primary transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <Eye className="h-4 w-4" />
          View
        </Link>
      </div>
    </td>
  </tr>
);

const CustomerCard = ({ customer, onAction }: { customer: Customer; onAction: (c: Customer) => void }) => (
  <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-card">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">
          {initials(customer.firstName, customer.lastName)}
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">{customer.firstName} {customer.lastName}</p>
          <p className="text-xs text-text-muted">{customer.email}</p>
        </div>
      </div>
      <CustomerStatusBadge status={customer.status} />
    </div>
    <div className="mt-3 space-y-1 text-sm">
      <p><span className="text-text-muted">Phone:</span> {formatPhone(customer.phone)}</p>
      <p><span className="text-text-muted">KYC:</span> <KycStatusBadge status={customer.kycStatus} /></p>
      <p className="text-xs text-text-muted">{formatRelative(customer.createdAt)}</p>
    </div>
    <div className="mt-3 flex items-center justify-end gap-1">
      <ActionButton customer={customer} onAction={onAction} />
      <Link
        to={`/customers/${customer.id}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-primary transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label={`View ${customer.firstName} ${customer.lastName}`}
      >
        <Eye className="h-4 w-4" />
      </Link>
    </div>
  </div>
);

export default function CustomersList() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useCustomers({
    page,
    limit,
    status: status || undefined,
    search: debouncedSearch || undefined,
  });

  const [actionCustomer, setActionCustomer] = useState<Customer | null>(null);
  const [newStatus, setNewStatus] = useState<CustomerStatus>('ACTIVE');
  const [reason, setReason] = useState('');
  const updateStatus = useUpdateCustomerStatus();

  const openAction = (customer: Customer) => {
    setActionCustomer(customer);
    setNewStatus(customer.status === 'ACTIVE' || customer.status === 'PENDING' ? 'SUSPENDED' : 'ACTIVE');
    setReason('');
  };

  const closeAction = () => {
    setActionCustomer(null);
    setReason('');
  };

  const handleConfirm = () => {
    if (!actionCustomer) return;
    updateStatus.mutate(
      { id: actionCustomer.id, status: newStatus, reason },
      { onSuccess: () => closeAction() },
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Customers</h1>
        <p className="text-sm text-text-muted">Manage customer accounts and KYC status.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input placeholder="Search customers..." leftIcon={<Search className="h-4 w-4" />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <Select value={status} onChange={(e) => { setStatus(e.target.value as CustomerStatus | ''); setPage(1); }}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState icon={Users} title="No customers found" subtitle="Try adjusting your filters or search query." />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">KYC</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((customer) => <CustomerRow key={customer.id} customer={customer} onAction={openAction} />)}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.data.map((customer) => <CustomerCard key={customer.id} customer={customer} onAction={openAction} />)}
          </div>
          {data.meta && data.meta.totalPages > 1 && <div className="md:hidden"><Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} /></div>}
        </>
      )}

      <Modal
        open={!!actionCustomer}
        onClose={closeAction}
        title="Update customer status"
        footer={
          <>
            <Button variant="outline" onClick={closeAction} disabled={updateStatus.isPending}>Cancel</Button>
            <Button onClick={handleConfirm} loading={updateStatus.isPending} icon={newStatus === 'ACTIVE' ? <CheckCircle className="h-4 w-4" /> : <UserX className="h-4 w-4" />}>
              Update status
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ReasonSelect label="New status" value={newStatus} onChange={(e) => setNewStatus(e.target.value as CustomerStatus)}>
            {UPDATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </ReasonSelect>
          <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a note..." />
        </div>
      </Modal>
    </div>
  );
}

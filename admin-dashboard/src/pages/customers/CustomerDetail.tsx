import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Mail, Phone, Calendar, Shield, RefreshCcw, Ban, CheckCircle, MapPin } from 'lucide-react';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { useCustomer, useCustomerOrders, useUpdateCustomerStatus, useUpdateCustomer, useWipeCustomerKyc } from '../../hooks/useCustomers';
import { StateLgaPicker } from '../../components/ui/StateLgaPicker';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select, Textarea } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { CustomerStatusBadge, KycStatusBadge, OrderStatusBadge } from '../../components/ui/Badge';
import { PageSpinner, InlineSpinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/EmptyState';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPhone, formatDate, formatNaira, formatRelative, initials } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { CustomerStatus } from '../../types';

const UPDATE_STATUSES: CustomerStatus[] = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

export default function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useCustomer(customerId || '');
  const [ordersPage, setOrdersPage] = useState(1);
  const { data: ordersData, isLoading: ordersLoading } = useCustomerOrders(customerId || '', { page: ordersPage, limit: 10 });

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<CustomerStatus>('ACTIVE');
  const [reason, setReason] = useState('');

  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [kycReason, setKycReason] = useState('');

  const updateStatus = useUpdateCustomerStatus();
  const updateCustomer = useUpdateCustomer();
  const wipeKyc = useWipeCustomerKyc();

  const [locState, setLocState] = useState('');
  const [locLga, setLocLga] = useState('');

  useEffect(() => {
    if (!data) return;
    setLocState(data.state || '');
    setLocLga(data.lga || '');
  }, [data]);

  if (isLoading) return <PageSpinner />;
  if (error || !data) return <ErrorState onRetry={() => window.location.reload()} />;

  const customer = data;

  const handleStatusUpdate = () => {
    updateStatus.mutate(
      { id: customer.id, status: newStatus, reason },
      { onSuccess: () => setStatusModalOpen(false) },
    );
  };

  const handleWipeKyc = () => {
    wipeKyc.mutate(
      { id: customer.id, reason: kycReason },
      { onSuccess: () => setKycModalOpen(false) },
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumbs items={[{ label: 'Customers', to: '/customers' }, { label: `${customer.firstName} ${customer.lastName}` }]} />
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
            <h1 className="text-xl font-bold text-text-primary">{customer.firstName} {customer.lastName}</h1>
            <p className="text-sm text-text-muted">Customer since {formatDate(customer.createdAt)}</p>
          </div>
        </div>
        <CustomerStatusBadge status={customer.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">
                  {initials(customer.firstName, customer.lastName)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Name</p>
                  <p className="text-sm font-medium text-text-primary">{customer.firstName} {customer.lastName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted">
                  <Mail className="h-4 w-4 text-text-muted" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Email</p>
                  <p className="text-sm text-text-primary">{customer.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted">
                  <Phone className="h-4 w-4 text-text-muted" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Phone</p>
                  <p className="text-sm text-text-primary">{formatPhone(customer.phone)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted">
                  <Calendar className="h-4 w-4 text-text-muted" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Date of birth</p>
                  <p className="text-sm text-text-primary">{customer.dateOfBirth ? formatDate(customer.dateOfBirth) : '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-muted">
                  <Shield className="h-4 w-4 text-text-muted" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">KYC status</p>
                  <KycStatusBadge status={customer.kycStatus} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <StateLgaPicker
                state={locState}
                lga={locLga}
                onChange={(patch) => {
                  if (patch.state !== undefined) setLocState(patch.state);
                  if (patch.lga !== undefined) setLocLga(patch.lga);
                }}
              />
              <Button
                className="w-full"
                icon={<MapPin className="h-4 w-4" />}
                loading={updateCustomer.isPending}
                disabled={!locState || !locLga || updateCustomer.isPending}
                onClick={() =>
                  updateCustomer.mutate({
                    id: customer.id,
                    input: { state: locState, lga: locLga },
                  })
                }
              >
                Save location
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent orders</CardTitle>
            </CardHeader>
            <CardBody>
              {ordersLoading ? (
                <InlineSpinner />
              ) : !ordersData?.data?.length ? (
                <EmptyState icon={Users} title="No orders yet" subtitle="This customer hasn't placed any orders." />
              ) : (
                <div className="divide-y divide-border">
                  {ordersData.data.map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-text-primary">Order #{order.id.slice(-8).toUpperCase()}</p>
                        <p className="text-xs text-text-muted">{formatRelative(order.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-text-primary">{formatNaira(order.total)}</span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {ordersData?.meta && ordersData.meta.totalPages > 1 && (
                <Pagination page={ordersPage} totalPages={ordersData.meta.totalPages} onChange={setOrdersPage} />
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              <Button
                className="w-full"
                variant={customer.status === 'ACTIVE' ? 'outline' : 'primary'}
                icon={customer.status === 'ACTIVE' ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                onClick={() => { setNewStatus(customer.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'); setReason(''); setStatusModalOpen(true); }}
              >
                {customer.status === 'ACTIVE' ? 'Suspend customer' : 'Reactivate customer'}
              </Button>
              {customer.kycStatus !== 'NONE' && (
                <Button className="w-full" variant="outline" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => { setKycReason(''); setKycModalOpen(true); }}>
                  Reset KYC
                </Button>
              )}
            </CardBody>
          </Card>

          {customer.otherProfiles?.vendor && (
            <Card className={cn('border-l-4', customer.otherProfiles.vendor.status === 'APPROVED' ? 'border-l-success' : 'border-l-warning')}>
              <CardHeader>
                <CardTitle>Linked vendor profile</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-sm font-medium text-text-primary">{customer.otherProfiles.vendor.name}</p>
                <p className="text-xs text-text-muted">Status: {customer.otherProfiles.vendor.status.replace('_', ' ')}</p>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update customer status"
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusModalOpen(false)} disabled={updateStatus.isPending}>Cancel</Button>
            <Button onClick={handleStatusUpdate} loading={updateStatus.isPending} disabled={updateStatus.isPending}>Update status</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="New status" value={newStatus} onChange={(e) => setNewStatus(e.target.value as CustomerStatus)}>
            {UPDATE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Textarea label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a note..." />
        </div>
      </Modal>

      <Modal
        open={kycModalOpen}
        onClose={() => setKycModalOpen(false)}
        title="Reset KYC status"
        footer={
          <>
            <Button variant="outline" onClick={() => setKycModalOpen(false)} disabled={wipeKyc.isPending}>Cancel</Button>
            <Button onClick={handleWipeKyc} loading={wipeKyc.isPending} variant="danger" disabled={kycReason.trim().length === 0}>Reset KYC</Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          required
          value={kycReason}
          onChange={(e) => setKycReason(e.target.value)}
          placeholder="Why are you resetting this customer's KYC?"
          error={kycReason.trim().length === 0 ? 'A reason is required' : undefined}
        />
      </Modal>
    </div>
  );
}

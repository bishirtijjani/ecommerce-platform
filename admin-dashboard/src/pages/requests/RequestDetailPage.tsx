import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Trash2 } from 'lucide-react';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { useRequest, useDeleteRequest } from '../../hooks/useRequests';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, RequestStatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Avatar } from '../../components/ui/Avatar';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { formatNaira, formatPhone, formatDate, formatDateTime, formatRelative } from '../../lib/format';

const RESPONSE_STATUS_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  WITHDRAWN: 'neutral',
};

const ResponseStatusBadge = ({ status }: { status: string }) => (
  <Badge tone={RESPONSE_STATUS_TONE[status] || 'neutral'}>{status}</Badge>
);

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <p className="text-xs font-semibold uppercase text-text-muted">{label}</p>
    <p className="text-sm text-text-primary">{value}</p>
  </div>
);

export default function RequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { data: request, isLoading, error } = useRequest(requestId || '');
  const deleteRequest = useDeleteRequest();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) return <PageSpinner />;
  if (error || !request) return <ErrorState onRetry={() => window.location.reload()} />;

  const handleDelete = () => {
    deleteRequest.mutate(request.id, { onSuccess: () => navigate('/requests') });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumbs items={[{ label: 'Requests', to: '/requests' }, { label: request.title }]} />

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
            <h1 className="text-xl font-bold text-text-primary">{request.title}</h1>
            <p className="text-sm text-text-muted">Posted {formatRelative(request.createdAt)}</p>
          </div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Request details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-6">
              {request.description && (
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Description</p>
                  <p className="text-sm text-text-primary">{request.description}</p>
                </div>
              )}
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Category" value={request.category?.name ?? '-'} />
                <Field label="Subcategory" value={request.subcategory?.name ?? '-'} />
                <Field label="Quantity" value={request.quantity ?? '-'} />
                <Field
                  label="Budget"
                  value={
                    request.budgetMin == null && request.budgetMax == null
                      ? '-'
                      : `${request.budgetMin == null ? '' : formatNaira(request.budgetMin)} – ${request.budgetMax == null ? '' : formatNaira(request.budgetMax)}`.replace(/^ – | – $/g, '')
                  }
                />
                <Field label="Needed by" value={request.neededBy ? formatDate(request.neededBy) : '-'} />
                <Field label="Urgency" value={request.urgency} />
                <Field
                  label="Reach"
                  value={request.reach === 'NEARBY' ? `Nearby · ${request.radiusKm}km` : 'Anywhere'}
                />
                <Field
                  label="Location"
                  value={
                    <>
                      {[request.lga, request.state].filter(Boolean).join(', ') || request.address}
                      {[request.lga, request.state].filter(Boolean).length > 0 && (
                        <span className="ml-1.5 text-text-muted">{request.address}</span>
                      )}
                      {request.lat != null && request.lng != null && (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${request.lat}&mlon=${request.lng}#map=16/${request.lat}/${request.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1.5 font-medium text-brand hover:underline"
                        >
                          View on map
                        </a>
                      )}
                    </>
                  }
                />
              </div>
              {request.images.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Images</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {request.images.map((src) => (
                      <img
                        key={src}
                        src={src}
                        alt="Request attachment"
                        className="h-20 w-20 rounded-md border border-border object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
              {request.videos?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Videos</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {request.videos.map((src) => (
                      <video
                        key={src}
                        src={src}
                        controls
                        className="h-40 w-64 rounded-md border border-border bg-black object-contain"
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Responses ({request.responseCount})</CardTitle>
            </CardHeader>
            <CardBody>
              {!request.responses.length ? (
                <EmptyState icon={MessageSquare} title="No responses" subtitle="No seller has replied to this request yet." />
              ) : (
                <div className="divide-y divide-border">
                  {request.responses.map((response) => (
                    <div key={response.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar size={36} src={response.vendor?.logoUrl} name={response.vendor?.name ?? 'Seller'} />
                          <div>
                            <p className="text-sm font-medium text-text-primary">{response.vendor?.name ?? '-'}</p>
                            <p className="text-xs text-text-muted">{formatRelative(response.createdAt)}</p>
                          </div>
                        </div>
                        <ResponseStatusBadge status={response.status} />
                      </div>
                      <p className="text-sm text-text-primary">{response.message}</p>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted">
                        <span>Price: <span className="text-text-primary">{formatNaira(response.price)}</span></span>
                        {response.priceNote && <span>Note: <span className="text-text-primary">{response.priceNote}</span></span>}
                        {response.etaText && <span>ETA: <span className="text-text-primary">{response.etaText}</span></span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody>
              {request.customer ? (
                <div className="flex items-center gap-3">
                  <Avatar
                    size={40}
                    src={request.customer.profilePicture}
                    name={`${request.customer.firstName} ${request.customer.lastName}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {request.customer.firstName} {request.customer.lastName}
                    </p>
                    <p className="text-sm text-text-muted">{formatPhone(request.customer.phone)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-muted">Customer details unavailable.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="Created" value={formatDateTime(request.createdAt)} />
              <Field label="Expires" value={formatDateTime(request.expiresAt)} />
              <Field label="Updated" value={formatDateTime(request.updatedAt)} />
              {request.assignedAt && <Field label="Assigned" value={formatDateTime(request.assignedAt)} />}
              {request.closedAt && <Field label="Closed" value={formatDateTime(request.closedAt)} />}
              <Field label="Pings" value={request.pingCount} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardBody>
              <Button
                className="w-full"
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setConfirmOpen(true)}
              >
                Remove request
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Remove request"
        description="Permanently remove this request? Sellers' responses will be deleted too."
        confirmLabel="Remove"
        danger
        loading={deleteRequest.isPending}
      />
    </div>
  );
}

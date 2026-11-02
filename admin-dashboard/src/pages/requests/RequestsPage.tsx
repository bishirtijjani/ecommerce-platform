import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ClipboardList } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useRequests } from '../../hooks/useRequests';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { RequestStatusBadge } from '../../components/ui/Badge';
import { formatPhone, formatDateTime, formatRelative } from '../../lib/format';
import type { RequestRow } from '../../types';

const STATUSES = ['OPEN', 'ASSIGNED', 'EXPIRED', 'CANCELLED'];

const reachLabel = (request: RequestRow) =>
  request.reach === 'NEARBY' ? `Nearby · ${request.radiusKm}km` : 'Anywhere';

const customerName = (request: RequestRow) =>
  request.customer ? `${request.customer.firstName} ${request.customer.lastName}` : '-';

const RequestTableRow = ({ request, onOpen }: { request: RequestRow; onOpen: (id: string) => void }) => (
  <tr
    onClick={() => onOpen(request.id)}
    className="cursor-pointer border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors"
  >
    <td className="px-4 py-3 text-sm font-medium text-text-primary">
      <p className="max-w-xs truncate" title={request.title}>{request.title}</p>
    </td>
    <td className="px-4 py-3"><RequestStatusBadge status={request.status} /></td>
    <td className="px-4 py-3 text-sm text-text-muted">{request.category?.name ?? '-'}</td>
    <td className="px-4 py-3 text-sm text-text-muted">
      <p className="text-text-primary">{customerName(request)}</p>
      <p className="text-xs text-text-muted">{formatPhone(request.customer?.phone)}</p>
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{reachLabel(request)}</td>
    <td className="px-4 py-3 text-sm text-text-muted tabular-nums">{request.responseCount}</td>
    <td className="px-4 py-3 text-sm text-text-muted tabular-nums">{request.pingCount}</td>
    <td className="px-4 py-3 text-sm text-text-muted" title={formatDateTime(request.createdAt)}>
      {formatRelative(request.createdAt)}
    </td>
  </tr>
);

const RequestCard = ({ request, onOpen }: { request: RequestRow; onOpen: (id: string) => void }) => (
  <button
    type="button"
    onClick={() => onOpen(request.id)}
    className="w-full rounded-lg border border-border bg-bg-surface p-4 text-left shadow-card"
  >
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-semibold text-text-primary">{request.title}</p>
      <RequestStatusBadge status={request.status} />
    </div>
    <div className="mt-3 space-y-1 text-sm">
      <p><span className="text-text-muted">Category:</span> {request.category?.name ?? '-'}</p>
      <p><span className="text-text-muted">Customer:</span> {customerName(request)}</p>
      <p><span className="text-text-muted">Phone:</span> {formatPhone(request.customer?.phone)}</p>
      <p><span className="text-text-muted">Reach:</span> {reachLabel(request)}</p>
      <p>
        <span className="text-text-muted">Activity:</span> {request.responseCount} responses · {request.pingCount} pings
      </p>
      <p className="text-xs text-text-muted">{formatDateTime(request.createdAt)}</p>
    </div>
  </button>
);

export default function RequestsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useRequests({
    page,
    limit,
    q: debouncedSearch || undefined,
    status: status || undefined,
  });

  const openRequest = (requestId: string) => navigate(`/requests/${requestId}`);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Requests</h1>
        <p className="text-sm text-text-muted">Review customer requests across the marketplace.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              placeholder="Search requests..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <Select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.items?.length ? (
        <EmptyState icon={ClipboardList} title="No requests found" subtitle="There are no requests matching your filters." />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Reach</th>
                    <th className="px-4 py-3">Responses</th>
                    <th className="px-4 py-3">Pings</th>
                    <th className="px-4 py-3">Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((request) => (
                    <RequestTableRow key={request.id} request={request} onOpen={openRequest} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.items.map((request) => (
              <RequestCard key={request.id} request={request} onOpen={openRequest} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="md:hidden">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

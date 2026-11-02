import { useState } from 'react';
import { Search, Phone } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useCallbacks } from '../../hooks/useCallbacks';
import { useVendors } from '../../hooks/useVendors';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Input';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { formatPhone, formatDateTime, formatRelative } from '../../lib/format';
import type { CallbackRequest } from '../../types';

const CallbackRow = ({ request }: { request: CallbackRequest }) => (
  <tr className="border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors">
    <td className="px-4 py-3 text-sm font-medium text-text-primary">{request.customerName ?? '-'}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{formatPhone(request.customerPhone)}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{request.vendor?.name ?? '-'}</td>
    <td className="px-4 py-3 text-sm text-text-muted">{request.product?.name ?? '-'}</td>
    <td className="px-4 py-3 text-sm text-text-muted">
      {request.note ? (
        <p className="max-w-xs truncate" title={request.note}>{request.note}</p>
      ) : '-'}
    </td>
    <td className="px-4 py-3 text-sm text-text-muted" title={formatDateTime(request.createdAt)}>
      {formatRelative(request.createdAt)}
    </td>
  </tr>
);

const CallbackCard = ({ request }: { request: CallbackRequest }) => (
  <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-card">
    <div className="flex items-start justify-between">
      <p className="text-sm font-semibold text-text-primary">{request.customerName ?? '-'}</p>
      <span className="text-xs text-text-muted">{formatRelative(request.createdAt)}</span>
    </div>
    <div className="mt-3 space-y-1 text-sm">
      <p><span className="text-text-muted">Phone:</span> {formatPhone(request.customerPhone)}</p>
      <p><span className="text-text-muted">Vendor:</span> {request.vendor?.name ?? '-'}</p>
      <p><span className="text-text-muted">Product:</span> {request.product?.name ?? '-'}</p>
      {request.note && <p><span className="text-text-muted">Notes:</span> {request.note}</p>}
      <p className="text-xs text-text-muted">{formatDateTime(request.createdAt)}</p>
    </div>
  </div>
);

export default function CallbacksPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [vendorId, setVendorId] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useCallbacks({
    page,
    limit,
    search: debouncedSearch || undefined,
    vendorId: vendorId || undefined,
  });

  const { data: vendorsData } = useVendors({ page: 1, limit: 100 });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Callback requests</h1>
        <p className="text-sm text-text-muted">View customer callback requests.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              placeholder="Search by name..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <Select
              value={vendorId}
              onChange={(e) => { setVendorId(e.target.value); setPage(1); }}
            >
              <option value="">All vendors</option>
              {vendorsData?.data.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState icon={Phone} title="No callback requests" subtitle="There are no callback requests matching your filters." />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((request) => <CallbackRow key={request.id} request={request} />)}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.data.map((request) => <CallbackCard key={request.id} request={request} />)}
          </div>
          {data.meta && data.meta.totalPages > 1 && (
            <div className="md:hidden">
              <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
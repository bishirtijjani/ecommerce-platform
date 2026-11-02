import { useState } from 'react';
import { Search, Star, Trash2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useRatings, useDeleteRating } from '../../hooks/useRatings';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { InlineSpinner } from '../../components/ui/Spinner';
import { Avatar } from '../../components/ui/Avatar';
import { formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';
import type { Rating } from '../../types';

const SCORES: { value: number | ''; label: string }[] = [
  { value: '', label: 'All ratings' },
  { value: 5, label: '5 stars' },
  { value: 4, label: '4 stars' },
  { value: 3, label: '3 stars' },
  { value: 2, label: '2 stars' },
  { value: 1, label: '1 star' },
];

const customerName = (rating: Rating) => (rating.customer ? `${rating.customer.firstName} ${rating.customer.lastName}` : '-');

const RatingStars = ({ score }: { score: number | null }) => {
  const value = score ?? 0;
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('h-3.5 w-3.5', i < value ? 'fill-current text-warning' : 'text-text-muted')} />
      ))}
    </div>
  );
};

const RatingRow = ({ rating, onDelete }: { rating: Rating; onDelete: (rating: Rating) => void }) => (
  <tr className="border-b border-border last:border-0 hover:bg-bg-muted/40 transition-colors">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar size={36} name={rating.customer ? `${rating.customer.firstName} ${rating.customer.lastName}` : 'Customer'} />
        <div>
          <p className="text-sm font-medium text-text-primary">{customerName(rating)}</p>
          <p className="text-xs text-text-muted">#{rating.orderId.slice(-8).toUpperCase()}</p>
        </div>
      </div>
    </td>
    <td className="px-4 py-3 text-sm text-text-muted">{rating.order?.vendor?.name ?? '-'}</td>
    <td className="px-4 py-3">
      <p className="max-w-xs truncate text-sm text-text-primary" title={rating.vendorComment ?? undefined}>{rating.vendorComment ?? '-'}</p>
      <p className="text-xs text-text-muted">{formatRelative(rating.createdAt)}</p>
    </td>
    <td className="px-4 py-3"><RatingStars score={rating.vendorScore} /></td>
    <td className="px-4 py-3 text-right">
      <Button variant="ghost" size="icon" onClick={() => onDelete(rating)} title="Delete rating" aria-label="Delete rating">
        <Trash2 className="h-4 w-4 text-error" />
      </Button>
    </td>
  </tr>
);

const RatingCard = ({ rating, onDelete }: { rating: Rating; onDelete: (rating: Rating) => void }) => (
  <div className="rounded-lg border border-border bg-bg-surface p-4 shadow-card">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <Avatar size={40} name={rating.customer ? `${rating.customer.firstName} ${rating.customer.lastName}` : 'Customer'} />
        <div>
          <p className="text-sm font-semibold text-text-primary">{customerName(rating)}</p>
          <p className="text-xs text-text-muted">#{rating.orderId.slice(-8).toUpperCase()}</p>
        </div>
      </div>
      <RatingStars score={rating.vendorScore} />
    </div>
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-text-muted">Vendor:</span>
      <span className="text-text-primary">{rating.order?.vendor?.name ?? '-'}</span>
    </div>
    <p className="mt-2 text-sm text-text-primary">{rating.vendorComment ?? '-'}</p>
    <div className="mt-3 flex items-center justify-between">
      <span className="text-xs text-text-muted">{formatRelative(rating.createdAt)}</span>
      <Button variant="ghost" size="icon" onClick={() => onDelete(rating)} title="Delete rating" aria-label="Delete rating">
        <Trash2 className="h-4 w-4 text-error" />
      </Button>
    </div>
  </div>
);

export default function RatingsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [score, setScore] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useRatings({
    page,
    limit,
    search: debouncedSearch || undefined,
    score: score === '' ? undefined : score,
  });

  const deleteRating = useDeleteRating();
  const [deleteTarget, setDeleteTarget] = useState<Rating | null>(null);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRating.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Product ratings</h1>
        <p className="text-sm text-text-muted">Review and remove marketplace ratings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              placeholder="Search customers..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <Select
              value={score}
              onChange={(e) => { setScore(e.target.value === '' ? '' : Number(e.target.value)); setPage(1); }}
            >
              {SCORES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <InlineSpinner />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !data?.data?.length ? (
        <EmptyState icon={Star} title="No ratings found" subtitle="Try adjusting your filters or search query." />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-bg-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Review</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((rating) => <RatingRow key={rating.id} rating={rating} onDelete={setDeleteTarget} />)}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta?.totalPages ?? 1} onChange={setPage} />
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {data.data.map((rating) => <RatingCard key={rating.id} rating={rating} onDelete={setDeleteTarget} />)}
          </div>
          {data.meta && data.meta.totalPages > 1 && (
            <div className="md:hidden">
              <Pagination page={page} totalPages={data.meta.totalPages} onChange={setPage} />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete rating"
        description="Permanently delete this rating? The vendor's average rating will be recalculated."
        confirmLabel="Delete"
        danger
        loading={deleteRating.isPending}
      />
    </div>
  );
}
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export const Pagination = ({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3">
      <p className="text-sm text-text-muted">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          icon={<ChevronLeft className="h-4 w-4" />}
          aria-label="Previous page"
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          icon={<ChevronRight className="h-4 w-4" />}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

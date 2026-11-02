import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Spinner = ({ className, label }: { className?: string; label?: string }) => (
  <Loader2 className={cn('animate-spin text-brand', className)} aria-label={label || 'Loading'} />
);

export const PageSpinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex h-full min-h-[240px] w-full items-center justify-center">
    <Spinner className="h-6 w-6" label={label} />
  </div>
);

export const InlineSpinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
    <Spinner className="h-5 w-5" label={label} />
    <span>{label}</span>
  </div>
);

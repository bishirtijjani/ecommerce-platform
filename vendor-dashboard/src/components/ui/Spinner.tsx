import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('animate-spin text-brand', className)} />
);

export const PageSpinner = () => (
  <div className="flex h-full min-h-[240px] w-full items-center justify-center">
    <Spinner className="h-6 w-6" />
  </div>
);

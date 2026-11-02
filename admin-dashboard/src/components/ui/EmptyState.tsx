import type { ReactNode } from 'react';
import { AlertTriangle, type LucideIcon } from 'lucide-react';

export const EmptyState = ({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-fade-in">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
      <Icon className="h-6 w-6 text-brand" strokeWidth={1.75} />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-text-muted">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const ErrorState = ({ title = 'Something went wrong', subtitle, onRetry }: { title?: string; subtitle?: string; onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-fade-in">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-soft" aria-hidden="true">
      <AlertTriangle className="h-6 w-6 text-error" strokeWidth={1.75} />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {subtitle && <p className="max-w-sm text-sm text-text-muted">{subtitle}</p>}
    </div>
    {onRetry && (
      <button onClick={onRetry} className="text-sm font-medium text-brand hover:text-brand-strong">
        Try again
      </button>
    )}
  </div>
);

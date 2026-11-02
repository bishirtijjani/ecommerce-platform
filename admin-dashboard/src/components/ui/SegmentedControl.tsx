import { cn } from '../../lib/cn';

export interface SegmentOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * A compact filter/segmented control. Used to switch between ownership scopes
 * (All / Global / Vendor-created / Inactive) without leaving the page.
 */
export const SegmentedControl = ({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className={cn('inline-flex flex-wrap gap-1 rounded-lg border border-border bg-bg-muted p-1', className)}
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            active ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                active ? 'bg-brand-soft text-brand-strong' : 'bg-bg-strong text-text-muted',
              )}
            >
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

import { cn } from '../../lib/cn';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export const Tabs = ({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (key: string) => void }) => (
  <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
    {items.map((item) => (
      <button
        key={item.key}
        onClick={() => onChange(item.key)}
        className={cn(
          'relative flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition-colors',
          active === item.key ? 'text-brand' : 'text-text-muted hover:text-text-primary',
        )}
      >
        {item.label}
        {item.count !== undefined && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-semibold',
              active === item.key ? 'bg-brand-soft text-brand-strong' : 'bg-bg-muted text-text-muted',
            )}
          >
            {item.count}
          </span>
        )}
        {active === item.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />}
      </button>
    ))}
  </div>
);

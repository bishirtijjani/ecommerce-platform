import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/cn';

export const StatCard = ({
  label,
  value,
  icon: Icon,
  trend,
  tone = 'brand',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  tone?: 'brand' | 'success' | 'warning' | 'info';
}) => {
  const toneClass = {
    brand: 'bg-brand-soft text-brand-strong',
    success: 'bg-success-soft text-success-strong',
    warning: 'bg-warning-soft text-warning-strong',
    info: 'bg-info-soft text-info-strong',
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-md', toneClass)}>
          <Icon className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-text-primary">{value}</p>
      {trend && (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', trend.value >= 0 ? 'text-success-strong' : 'text-error-strong')}>
          {trend.value >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          <span>{Math.abs(trend.value)}%</span>
          <span className="font-normal text-text-muted">{trend.label}</span>
        </div>
      )}
    </div>
  );
};

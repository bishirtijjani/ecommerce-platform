import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

interface Crumb {
  label: string;
  to?: string;
}

export const Breadcrumbs = ({ items, className }: { items: Crumb[]; className?: string }) => (
  <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-sm text-text-muted', className)}>
    {items.map((item, idx) => {
      const isLast = idx === items.length - 1;
      return (
        <span key={idx} className="flex items-center gap-1">
          {item.to && !isLast ? (
            <Link to={item.to} className="hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded">
              {item.label}
            </Link>
          ) : (
            <span className={cn('font-medium', isLast ? 'text-text-primary' : '')}>{item.label}</span>
          )}
          {!isLast && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
        </span>
      );
    })}
  </nav>
);

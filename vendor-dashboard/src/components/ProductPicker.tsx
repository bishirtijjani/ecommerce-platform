import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check, Plus } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatNaira } from '../lib/format';
import type { ReactNode } from 'react';

export interface PickerProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  description?: string | null;
}

interface ProductPickerProps {
  products: PickerProduct[];
  selectedIds?: string[];
  max?: number;
  maxReached?: boolean;
  onSelect: (id: string) => void;
  showSearch?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  triggerLabel?: string;
  inline?: boolean;
  trailing?: (p: PickerProduct) => ReactNode;
  className?: string;
  listClassName?: string;
  maxHeight?: string;
}

const truncate = (text: string | null | undefined, len: number) => {
  if (!text) return '';
  const t = text.trim();
  return t.length > len ? `${t.slice(0, len)}…` : t;
};

export const ProductPicker = ({
  products,
  selectedIds = [],
  max,
  maxReached,
  onSelect,
  showSearch = true,
  searchPlaceholder,
  emptyText,
  triggerLabel,
  inline = false,
  trailing,
  className,
  listClassName,
  maxHeight = 'max-h-64',
}: ProductPickerProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const resolvedSearchPlaceholder = searchPlaceholder ?? t('products.picker.searchPlaceholder');
  const resolvedEmptyText = emptyText ?? t('products.picker.noMatches');
  const resolvedTriggerLabel = triggerLabel ?? t('dashboard.addProduct');

  const filtered = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q),
    );
  }, [products, query]);

  const pick = (id: string) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
  };

  if (maxReached) return null;

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:border-brand hover:text-brand',
        inline && 'shrink-0',
      )}
    >
      <Plus className="h-4 w-4" /> {resolvedTriggerLabel}
    </button>
  );

  if (!open) {
    return inline ? <>{trigger}</> : <div className={className}>{trigger}</div>;
  }

  return (
    <div className={cn(inline && 'w-full', className)}>
      {showSearch && (
        <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder={resolvedSearchPlaceholder}
                className="w-full rounded-md border border-border bg-bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-placeholder focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          )}

          <div className={cn('overflow-y-auto rounded-md border border-border', maxHeight, listClassName)}>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-text-muted">{resolvedEmptyText}</p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const atMax = !!max && selectedIds.length >= max && !isSelected;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={atMax}
                        onClick={() => pick(p.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                          isSelected ? 'bg-brand-soft' : 'hover:bg-bg-muted',
                          atMax && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-bg-muted">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg text-text-placeholder">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-text-primary">{p.name}</p>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-brand" />}
                          </div>
                          <p className="truncate text-xs text-text-muted">
                            {truncate(p.description, 90) || t('products.picker.noDescription')}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-success">{formatNaira(p.price)}</p>
                        </div>
                        {trailing && <div className="shrink-0">{trailing(p)}</div>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
      </div>
  );
};


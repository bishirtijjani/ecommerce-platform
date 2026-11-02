import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check, ChevronDown, Tags } from 'lucide-react';
import { cn } from '../lib/cn';

export interface PickerOption {
  id: string;
  name: string;
  imageUrl?: string | null;
  owned?: boolean;
}

interface TaxonomyPickerProps {
  label?: string;
  required?: boolean;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  error?: string;
  allowNone?: boolean;
  noneLabel?: string;
}

/** A modern searchable popover picker (same style as the product picker) used
 * for choosing a category or subcategory. Shows each row's thumbnail and a
 * subtle Yours/Global tag. `allowNone` offers an explicit "none" choice so a
 * product can be filed under just a category. */
export const TaxonomyPicker = ({
  label,
  required,
  options,
  value,
  onChange,
  placeholder,
  emptyText,
  disabled = false,
  error,
  allowNone = false,
  noneLabel,
}: TaxonomyPickerProps) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('categories.picker.select');
  const resolvedEmptyText = emptyText ?? t('categories.picker.empty');
  const resolvedNoneLabel = noneLabel ?? t('products.form.noSubcategory');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => options.find((o) => o.id === value) || null, [options, value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const pick = (id: string) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  const thumb = (o: PickerOption) =>
    o.imageUrl ? (
      <img src={o.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
    ) : (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-bg-muted text-text-muted">
        <Tags className="h-4 w-4" />
      </div>
    );

  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-text-primary">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-border bg-bg-surface px-3 py-2 text-left text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30',
          disabled && 'cursor-not-allowed opacity-50',
          error && 'border-error',
        )}
      >
        {selected ? (
          <>
            {thumb(selected)}
            <span className="min-w-0 flex-1 truncate">{selected.name}</span>
            {selected.owned && <span className="shrink-0 text-xs text-text-muted">{t('categories.yours')}</span>}
          </>
        ) : (
          <span className="flex-1 text-text-placeholder">{resolvedPlaceholder}</span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="relative">
          <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-bg-surface shadow-lg">
            <div className="relative m-2 mb-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                placeholder={t('categories.picker.searchPlaceholder')}
                className="w-full rounded-md border border-border bg-bg-muted py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-placeholder focus:border-brand focus:outline-none"
              />
            </div>

            <div className="max-h-64 overflow-y-auto pb-1">
              {allowNone && (
                <button
                  type="button"
                  onClick={() => pick('')}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-bg-muted',
                    value === '' && 'bg-brand-soft',
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-bg-muted text-text-muted">
                    <Tags className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-sm text-text-muted">{resolvedNoneLabel}</span>
                  {value === '' && <Check className="h-4 w-4 shrink-0 text-brand" />}
                </button>
              )}

              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-muted">{resolvedEmptyText}</p>
              ) : (
                filtered.map((o) => {
                  const isSelected = o.id === value;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => pick(o.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-bg-muted',
                        isSelected && 'bg-brand-soft',
                      )}
                    >
                      {thumb(o)}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-text-primary">{o.name}</p>
                        {o.owned && <p className="text-xs text-text-muted">{t('categories.yours')}</p>}
                      </div>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-brand" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
};
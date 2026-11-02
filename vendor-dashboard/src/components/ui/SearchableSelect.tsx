import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SearchableSelectProps {
  label?: string;
  value: string;
  onSelect: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
  required?: boolean;
  id?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

/**
 * Searchable single-select for long option lists (e.g. the 774 Nigerian LGAs).
 * A styled trigger opens a dropdown with a search box; the list filters as you
 * type. Closes on outside click or Escape. Controlled - the parent owns `value`.
 * Works on touch/mobile, unlike a native <datalist> combobox.
 */
export default function SearchableSelect({
  label,
  value,
  onSelect,
  options,
  placeholder = 'Select...',
  disabled = false,
  error,
  hint,
  required,
  id,
  searchPlaceholder = 'Search...',
  emptyText = 'No matches',
}: SearchableSelectProps) {
  const autoId = useId();
  const fieldId = id || autoId;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    // Focus the search box once the menu is mounted.
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <div ref={rootRef} className="relative">
        <button
          type="button"
          id={fieldId}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => !disabled && setOpen((v) => !v)}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md border bg-bg-surface px-3.5 py-2.5 text-left text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-error focus:ring-error/30' : 'border-border focus:border-brand',
          )}
        >
          <span className={cn('truncate', value ? 'text-text-primary' : 'text-text-placeholder')}>
            {value || placeholder}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border border-border bg-bg-surface shadow-lg animate-fade-in">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-text-muted" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none"
              />
            </div>
            <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-text-muted">{emptyText}</li>
              ) : (
                filtered.map((option) => {
                  const selected = option === value;
                  return (
                    <li key={option}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          onSelect(option);
                          close();
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-bg-muted',
                          selected ? 'font-medium text-brand-strong' : 'text-text-primary',
                        )}
                      >
                        <span className="truncate">{option}</span>
                        {selected && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
      {error ? (
        <p className="text-xs text-error-strong">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

import { useId } from 'react';
import { cn } from '../../lib/cn';

const HEX = /^#[0-9a-fA-F]{6}$/;
const SWATCH_FALLBACK = '#0B3D24';

interface ColorFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

export const ColorField = ({ label, value, onChange, error, hint, required, className }: ColorFieldProps) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const swatchValue = HEX.test(value) ? value : SWATCH_FALLBACK;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <div className="flex items-center gap-2.5">
        <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-md border border-border">
          <input
            id={id}
            type="color"
            value={swatchValue}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            aria-label={label ? `${label} picker` : 'Color picker'}
            className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0"
          />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0B3D24"
          spellCheck={false}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          aria-invalid={!!error}
          className={cn(
            'w-full rounded-md border bg-bg-surface px-3.5 py-2.5 font-mono text-sm text-text-primary placeholder:text-text-placeholder',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30',
            error ? 'border-error focus:ring-error/30' : 'border-border focus:border-brand',
          )}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-error-strong">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

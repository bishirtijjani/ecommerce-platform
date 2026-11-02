import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface FieldWrapProps {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

const FieldWrap = ({ id, label, error, hint, required, children }: FieldWrapProps) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
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

const baseFieldClasses =
  'w-full rounded-md border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-placeholder ' +
  'transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 disabled:cursor-not-allowed';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, required, leftIcon, rightSlot, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id || autoId;
    const describedBy = [error ? `${fieldId}-error` : undefined, hint ? `${fieldId}-hint` : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
    return (
      <FieldWrap id={fieldId} label={label} error={error} hint={hint} required={required}>
        <div className="relative">
          {leftIcon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{leftIcon}</div>}
          <input
            ref={ref}
            id={fieldId}
            className={cn(
              baseFieldClasses,
              error ? 'border-error focus:ring-error/30' : 'border-border focus:border-brand',
              leftIcon && 'pl-10',
              rightSlot && 'pr-10',
              className,
            )}
            aria-describedby={describedBy}
            aria-invalid={!!error}
            {...props}
          />
          {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
        </div>
      </FieldWrap>
    );
  },
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, required, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id || autoId;
    const describedBy = [error ? `${fieldId}-error` : undefined, hint ? `${fieldId}-hint` : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
    return (
      <FieldWrap id={fieldId} label={label} error={error} hint={hint} required={required}>
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(
            baseFieldClasses,
            'min-h-[96px] resize-y',
            error ? 'border-error focus:ring-error/30' : 'border-border focus:border-brand',
            className,
          )}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          {...props}
        />
      </FieldWrap>
    );
  },
);
Textarea.displayName = 'Textarea';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, required, children, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id || autoId;
    const describedBy = [error ? `${fieldId}-error` : undefined, hint ? `${fieldId}-hint` : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
    return (
      <FieldWrap id={fieldId} label={label} error={error} hint={hint} required={required}>
        <select
          ref={ref}
          id={fieldId}
          className={cn(
            baseFieldClasses,
            'appearance-none bg-no-repeat bg-[right_0.75rem_center] pr-9',
            "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236B7280%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
            error ? 'border-error focus:ring-error/30' : 'border-border focus:border-brand',
            className,
          )}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          {...props}
        >
          {children}
        </select>
      </FieldWrap>
    );
  },
);
Select.displayName = 'Select';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];

  // Bottom sheet on mobile (full-width, slides up from the bottom edge,
  // rounded top only), centered dialog from sm: up - one component, two
  // layouts, since most vendors will be doing this one-thumb on a phone.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[color:var(--scrim)]" onClick={onClose} />
      <div
        className={cn(
          'relative w-full max-h-[92vh] overflow-y-auto rounded-t-xl border border-border bg-bg-surface shadow-popover animate-slide-up',
          'sm:rounded-lg sm:max-h-[90vh]',
          sizeClasses,
        )}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg-surface px-5 py-4">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-bg-muted hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-bg-surface px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)] [&>button]:w-full sm:flex-row sm:justify-end sm:pb-4 sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

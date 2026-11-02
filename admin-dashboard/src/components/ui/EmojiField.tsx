import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smile } from 'lucide-react';
import { cn } from '../../lib/cn';

const EMOJIS = [
  '🛒', '🍏', '🥖', '🥩', '🐟', '🧺', '👗', '👟',
  '💄', '🧴', '📱', '💻', '🛋️', '🚗', '🏠', '🔧',
  '⚽', '🎁', '💊', '📚', '✨', '🔥', '✅', '⭐',
  '❤️', '🏷️', '🎉', '📍', '🧵', '🍲', '🎨', '🌿',
];

const POPOVER_WIDTH = 256;
const GAP = 6;
const MARGIN = 8;

interface EmojiFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export const EmojiField = ({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  placeholder,
  className,
}: EmojiFieldProps) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  // Position the portal-anchored grid, flipping above the field when there is
  // not enough room below. Fixed positioning keeps it clear of the modal's own
  // scroll container, which previously clipped the grid.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const height = popRef.current?.getBoundingClientRect().height ?? 260;
      const spaceBelow = window.innerHeight - anchor.bottom - GAP - MARGIN;
      const spaceAbove = anchor.top - GAP - MARGIN;
      const openUp = spaceBelow < height && spaceAbove > spaceBelow;
      const left = Math.min(
        Math.max(MARGIN, anchor.right - POPOVER_WIDTH),
        window.innerWidth - POPOVER_WIDTH - MARGIN,
      );
      const top = openUp ? Math.max(MARGIN, anchor.top - GAP - height) : anchor.bottom + GAP;
      setPos({ top, left });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <div ref={anchorRef} className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          aria-invalid={!!error}
          className={cn(
            'w-full rounded-md border bg-bg-surface px-3.5 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-placeholder',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30',
            error ? 'border-error focus:ring-error/30' : 'border-border focus:border-brand',
          )}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Pick an emoji"
          aria-expanded={open}
          className={cn(
            'absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors hover:bg-bg-muted hover:text-text-primary',
            open ? 'bg-bg-muted text-text-primary' : 'text-text-muted',
          )}
        >
          <Smile className="h-4 w-4" />
        </button>
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

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="listbox"
            aria-label="Emoji options"
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: POPOVER_WIDTH,
              maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
            }}
            className="z-[60] overflow-y-auto overscroll-contain rounded-md border border-border bg-bg-surface p-2 shadow-popover"
          >
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="option"
                  aria-selected={value === emoji}
                  onClick={() => {
                    onChange(emoji);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded text-base transition-colors hover:bg-bg-muted',
                    value === emoji && 'bg-brand-soft',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="mt-1.5 w-full rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-muted hover:text-text-primary"
              >
                Clear
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
